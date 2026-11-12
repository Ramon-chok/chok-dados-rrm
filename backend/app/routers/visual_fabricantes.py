"""Visual Fabricantes — leitura comercial por fabricante (PRD v1.0).

Esta é a camada de servidor da tela "Visual Fabricantes". Ela traz para dentro
da plataforma CHOK as funções descritas no PRD da Plataforma de Desenvolvimento
de Fabricantes, usando as bases que ESTE sistema já importa:

    indicadores_fabricante  → valor, meta, cobertura e margem por dia/vendedor
    sortimento              → categorias, linhas e SKUs de cada fabricante
    top_clientes            → clientes atendidos (quando a carga traz fabricante)
    nao_positivados_*       → clientes sem positivação no fabricante
    metas_fabricante        → metas financeiras por fabricante e datas exatas
    produtos_foco           → itens acompanhados e a referência de clientes
    acessos_fabricante      → histórico de consultas (RF-029)

Princípios do PRD aplicados aqui, e que valem para TODAS as rotas:

1. **Autorização no servidor** (RF-001/002/003). O recorte vem de
   ``scope_filters(user)``: Supervisor não sai da própria equipe, Vendedor não
   sai do próprio código e FORNECEDOR não sai do fabricante vinculado ao
   cadastro dele. Trocar o parâmetro na URL não concede outro escopo.
2. **Margens nunca saem sem permissão** (RF-004/RF-027). Sem ``margin.view`` o
   campo volta ``None`` — não é um dado escondido na tela.
3. **Ausência é diferente de zero** (RF-007, RN-09). Quando a base não cobre o
   período, ou quando a coluna necessária não existe na carga, a resposta diz
   que está indisponível em vez de devolver 0.
4. **Precedência temporal** (RF-031, RN-10). ``indicadores_fabricante`` pode
   receber o mesmo fechamento regravado em várias ``data_referencia``. Somar
   essas datas duplicaria o valor. O servidor detecta o caso e passa a usar
   apenas a carga mais recente de cada mês, informando qual regra usou.
5. **Rastreabilidade**. Toda resposta traz ``fontes`` e, quando couber,
   ``avisos`` — a tela mostra os dois junto dos números.
"""

from __future__ import annotations

from datetime import date
from typing import Any

from fastapi import APIRouter, Body, Depends, HTTPException, Query, Request

from app.cache import cached, invalidate_all
from app.db import get_connection
from app.sanitize import clean_optional, clean_text, like_pattern
from app.security import (
    estado_escrita,
    get_current_user,
    has_permission,
    is_admin,
    require_permission,
    require_write,
)
from app.services import SEM_VINCULO, num, scope_filters

router = APIRouter(tags=["visual-fabricantes"])

#: Quantos grupos a TELA destaca nos rankings. A exportação leva todos os
#: grupos positivos (RN-06) — por isso o limite aqui não corta a consulta.
TOP_DESTAQUE = 20

#: Página das margens (RF-028).
MARGENS_PAGINA = 100


# ─────────────────────────────────────────────────────────────────────────────
# Datas e períodos (RN-01, RN-05)
# ─────────────────────────────────────────────────────────────────────────────
def _data(valor: str | None, campo: str) -> date | None:
    if not valor:
        return None
    try:
        return date.fromisoformat(str(valor).strip()[:10])
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=f'Data inválida em "{campo}".') from exc


def _periodo(inicio: str | None, fim: str | None, rotulo: str) -> tuple[date, date]:
    """Intervalo com limites INCLUSIVOS. Recusa intervalo invertido."""
    ini = _data(inicio, f"{rotulo}Inicio")
    f = _data(fim, f"{rotulo}Fim")
    if not ini or not f:
        raise HTTPException(status_code=400, detail=f"Informe início e fim do período {rotulo.upper()}.")
    if f < ini:
        raise HTTPException(
            status_code=400,
            detail=f"O período {rotulo.upper()} termina antes de começar; confira as datas.",
        )
    return ini, f


def _periodo_opcional(inicio: str | None, fim: str | None, rotulo: str) -> tuple[date, date] | None:
    if not inicio and not fim:
        return None
    return _periodo(inicio, fim, rotulo)


# ─────────────────────────────────────────────────────────────────────────────
# Escopo (RF-002, RF-003)
# ─────────────────────────────────────────────────────────────────────────────
def _escopo(
    user: dict[str, Any],
    alias_vendedor: str,
    alias_equipe: str | None,
    alias_fabricante: str | None,
) -> tuple[list[str], list[Any]]:
    scope = scope_filters(user)
    parts: list[str] = []
    params: list[Any] = []
    if scope.get("vendedor"):
        parts.append(f"{alias_vendedor} = %s")
        params.append(scope["vendedor"])
    if scope.get("equipe") and alias_equipe:
        parts.append(f"{alias_equipe} = %s")
        params.append(scope["equipe"])
    if scope.get("fabricante"):
        if not alias_fabricante:
            raise HTTPException(status_code=403, detail="Consulta sem recorte por fabricante.")
        parts.append(f"{alias_fabricante} = %s")
        params.append(scope["fabricante"])
    return parts, params


def _perfil_externo(user: dict[str, Any]) -> bool:
    """True para o representante do fabricante (perfil de fora da CHOK).

    Serve para decidir o que NÃO mostrar a ele por padrão: nomes de vendedores
    e composição de equipes são estrutura interna da CHOK, e o PRD descreve os
    rankings do fabricante como de redes e produtos. As permissões finas de
    cada papel ainda serão definidas com a CHOK; até lá, o padrão é o
    conservador, porque liberar depois é fácil e recolher depois já não é.
    """
    return bool(scope_filters(user).get("fabricante"))


def _fabricante_autorizado(user: dict[str, Any], fabricante: str | None) -> str | None:
    """Devolve o fabricante efetivo, recusando escopo alheio.

    O FORNECEDOR só abre o fabricante vinculado ao cadastro dele; pedir outro
    é 403, não uma lista vazia — a diferença importa para o CA-01 do PRD.
    """
    pedido = clean_optional(fabricante, 160)
    travado = scope_filters(user).get("fabricante")
    if travado:
        if pedido and pedido.strip().upper() != str(travado).strip().upper():
            raise HTTPException(
                status_code=403,
                detail="Este perfil só pode consultar o fabricante vinculado ao próprio cadastro.",
            )
        return str(travado)
    return pedido


# ─────────────────────────────────────────────────────────────────────────────
# Precedência temporal (RF-031, RN-10)
# ─────────────────────────────────────────────────────────────────────────────
def _recorte_base(
    user: dict[str, Any],
    inicio: date,
    fim: date,
    fabricante: str | None,
    equipe: str | None,
    vendedor: str | None,
) -> tuple[str, list[Any]]:
    """WHERE comum de ``indicadores_fabricante`` (alias f, join v)."""
    parts, params = _escopo(user, "f.cod_vendedor", "v.equipe", "f.fabricante")
    parts.append("f.data_referencia >= %s")
    params.append(inicio)
    parts.append("f.data_referencia <= %s")
    params.append(fim)
    if fabricante:
        parts.append("f.fabricante = %s")
        params.append(fabricante)
    scope = scope_filters(user)
    if equipe and not scope.get("equipe") and not scope.get("vendedor"):
        parts.append("v.equipe = %s")
        params.append(clean_text(equipe, 120))
    if vendedor and not scope.get("vendedor"):
        parts.append("f.cod_vendedor = %s")
        params.append(clean_text(vendedor, 40))
    return " AND ".join(["1=1", *parts]), params


def _detectar_precedencia(conn: Any, where: str, params: list[Any]) -> tuple[str, list[date]]:
    """Diz se o período é movimento diário ou carga repetida do mesmo fechamento.

    Quando, dentro de um mesmo mês, várias ``data_referencia`` somam exatamente
    o mesmo valor, elas são a MESMA extração regravada. Somá-las infla o
    resultado; por isso a leitura passa a considerar só a carga mais recente de
    cada mês — que é a "precedência por cobertura" do PRD (RN-10).
    """
    rows = conn.execute(
        f"""
        SELECT f.ano_referencia AS ano, f.mes_referencia AS mes, f.data_referencia AS d,
               ROUND(COALESCE(SUM(f.realizado), 0), 2) AS total
        FROM indicadores_fabricante f
        LEFT JOIN vendedores v ON v.cod_vendedor = f.cod_vendedor
        WHERE {where}
        GROUP BY 1, 2, 3
        ORDER BY 3
        """,
        params,
    ).fetchall()
    datas = [r["d"] for r in rows if r["d"]]
    por_mes: dict[tuple[int, int], set[Any]] = {}
    datas_por_mes: dict[tuple[int, int], set[Any]] = {}
    for r in rows:
        chave = (r["ano"], r["mes"])
        por_mes.setdefault(chave, set()).add(num(r["total"]))
        datas_por_mes.setdefault(chave, set()).add(r["d"])
    repetido = any(len(datas_por_mes[k]) > 1 and len(por_mes[k]) == 1 for k in por_mes)
    return ("ultima_carga" if repetido else "soma"), datas


def _filtro_precedencia(conn: Any, where: str, params: list[Any], modo: str) -> tuple[str, list[Any], str, list[date]]:
    """Acrescenta ao WHERE a restrição da carga mais recente, quando for o caso."""
    detectado, datas = _detectar_precedencia(conn, where, params)
    efetivo = detectado if modo == "auto" else modo
    if efetivo != "ultima_carga":
        return where, params, efetivo, datas
    novo = (
        where
        + """ AND f.data_referencia IN (
            SELECT MAX(f2.data_referencia)
            FROM indicadores_fabricante f2
            LEFT JOIN vendedores v2 ON v2.cod_vendedor = f2.cod_vendedor
            WHERE """
        + where.replace("f.", "f2.").replace("v.", "v2.")
        + """
            GROUP BY f2.ano_referencia, f2.mes_referencia
        )"""
    )
    return novo, [*params, *params], efetivo, datas


# ─────────────────────────────────────────────────────────────────────────────
# Indicadores e comparação (seção 9 do PRD)
# ─────────────────────────────────────────────────────────────────────────────
def _indicadores(
    conn: Any,
    user: dict[str, Any],
    inicio: date,
    fim: date,
    fabricante: str | None,
    equipe: str | None,
    vendedor: str | None,
    modo: str,
    ver_margem: bool,
) -> dict[str, Any]:
    where, params = _recorte_base(user, inicio, fim, fabricante, equipe, vendedor)
    where, params, precedencia, datas = _filtro_precedencia(conn, where, params, modo)

    row = conn.execute(
        f"""
        SELECT COALESCE(SUM(f.realizado), 0)            AS valor,
               COALESCE(SUM(f.meta), 0)                 AS meta,
               COALESCE(SUM(f.realizado_cobertura), 0)  AS clientes,
               COALESCE(SUM(f.cobertura), 0)            AS meta_clientes,
               COUNT(DISTINCT f.cod_vendedor)           AS vendedores,
               COUNT(DISTINCT v.equipe)                 AS equipes,
               COUNT(DISTINCT f.fabricante)             AS fabricantes,
               COALESCE(SUM(
                 CASE WHEN f.pct_margem IS NOT NULL AND f.realizado > 0
                      THEN f.pct_margem * f.realizado END), 0)  AS margem_num,
               COALESCE(SUM(
                 CASE WHEN f.pct_margem IS NOT NULL AND f.realizado > 0
                      THEN f.realizado END), 0)                 AS margem_den
        FROM indicadores_fabricante f
        LEFT JOIN vendedores v ON v.cod_vendedor = f.cod_vendedor
        WHERE {where}
        """,
        params,
    ).fetchone()

    valor = num(row["valor"])
    meta = num(row["meta"])
    clientes = num(row["clientes"])
    den = num(row["margem_den"])

    # Margem PONDERADA pelo valor (PRD, seção 9): a média simples dos
    # percentuais está errada para o resumo. Denominador zero => indisponível,
    # nunca 0%.
    margem = round(num(row["margem_num"]) / den, 2) if den else None

    return {
        "inicio": inicio.isoformat(),
        "fim": fim.isoformat(),
        "dias": (fim - inicio).days + 1,
        "valor": round(valor, 2),
        "meta": round(meta, 2),
        # Atingimento só existe com meta positiva; sem meta é indisponível,
        # não 0% (evita divisão por zero e leitura errada).
        "atingimento": round(valor / meta * 100, 2) if meta > 0 else None,
        "faltaParaMeta": round(max(0.0, meta - valor), 2) if meta > 0 else None,
        "clientes": round(clientes, 2),
        "metaClientes": round(num(row["meta_clientes"]), 2),
        # Ticket por CLIENTE (não por pedido) — base vazia devolve None.
        "ticket": round(valor / clientes, 2) if clientes else None,
        "vendedores": int(row["vendedores"] or 0),
        "equipes": int(row["equipes"] or 0),
        "fabricantes": int(row["fabricantes"] or 0),
        "margem": margem if ver_margem else None,
        "margemDisponivel": bool(den) if ver_margem else None,
        "precedencia": precedencia,
        "datasComCarga": [d.isoformat() for d in datas],
        "semDados": not datas,
    }


def _delta(a: float | None, b: float | None) -> dict[str, Any]:
    """Diferença e variação entre A (anterior) e B (analisado).

    Base A igual a zero NÃO gera percentual (RN-05): a variação volta nula e a
    tela mostra "sem base comparável" em vez de um crescimento infinito.
    """
    if a is None or b is None:
        return {"anterior": a, "atual": b, "diferenca": None, "variacao": None, "semBase": True}
    diferenca = b - a
    variacao = (b / a - 1) * 100 if a else None
    return {
        "anterior": round(a, 2),
        "atual": round(b, 2),
        "diferenca": round(diferenca, 2),
        "variacao": round(variacao, 2) if variacao is not None else None,
        "semBase": not a,
    }


# ─────────────────────────────────────────────────────────────────────────────
# Auditoria de consultas (RF-029)
# ─────────────────────────────────────────────────────────────────────────────
def _chave_origem(request: Request) -> str:
    """Pseudonimiza a origem. Pseudonimização NÃO é anonimização garantida."""
    import hashlib

    bruto = (request.client.host if request.client else "") or "desconhecida"
    return hashlib.sha256(bruto.encode("utf-8")).hexdigest()[:16]


def _registrar_acesso(
    request: Request,
    user: dict[str, Any],
    fabricante: str | None,
    recurso: str,
    sucesso: bool = True,
    detalhe: str | None = None,
) -> None:
    """Grava o evento. Falha de auditoria nunca derruba a consulta."""
    try:
        with get_connection() as conn:
            conn.execute(
                """
                INSERT INTO acessos_fabricante
                  (fabricante, usuario_id, usuario_email, usuario_nome, papel,
                   recurso, sucesso, detalhe, origem_chave)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    fabricante,
                    str(user.get("id")),
                    user.get("email"),
                    user.get("name"),
                    user.get("role"),
                    recurso,
                    sucesso,
                    detalhe,
                    _chave_origem(request),
                ),
            )
            conn.commit()
    except Exception:  # noqa: BLE001 — auditoria é acessória à resposta
        pass


# ─────────────────────────────────────────────────────────────────────────────
# 1. Catálogo de fabricantes (RF-005, RF-007)
# ─────────────────────────────────────────────────────────────────────────────
@router.get("/insights/visual/catalogo")
@cached()
def catalogo(
    user: dict[str, Any] = Depends(require_permission("manufacturers.view")),
) -> dict[str, Any]:
    """Fabricantes que ESTE usuário pode abrir, com a cobertura temporal de cada um.

    ``coberturaDeclarada`` é o intervalo que a base diz ter. Ele não comprova
    completude da origem (PRD, seção 12): a homologação é que confere se o
    conteúdo daquele intervalo está inteiro.
    """
    parts, params = _escopo(user, "f.cod_vendedor", "v.equipe", "f.fabricante")
    where = " AND ".join(["1=1", *parts])
    with get_connection() as conn:
        rows = conn.execute(
            f"""
            SELECT f.fabricante,
                   MIN(f.data_referencia) AS inicio,
                   MAX(f.data_referencia) AS fim,
                   COUNT(DISTINCT f.data_referencia) AS dias,
                   COUNT(DISTINCT f.cod_vendedor) AS vendedores,
                   COALESCE(SUM(f.realizado), 0) AS realizado,
                   MAX(f.data_importacao) AS atualizado_em
            FROM indicadores_fabricante f
            LEFT JOIN vendedores v ON v.cod_vendedor = f.cod_vendedor
            WHERE {where}
            GROUP BY f.fabricante
            ORDER BY f.fabricante
            """,
            params,
        ).fetchall()
        skus = conn.execute(
            """
            SELECT fabricante,
                   COUNT(DISTINCT cod_produto) AS skus,
                   COUNT(DISTINCT COALESCE(categoria, 'Sem categoria')) AS categorias,
                   COUNT(DISTINCT COALESCE(linha, 'Sem linha')) AS linhas
            FROM sortimento WHERE fabricante IS NOT NULL GROUP BY fabricante
            """
        ).fetchall()
    extra = {r["fabricante"]: r for r in skus}

    itens = []
    for r in rows:
        x = extra.get(r["fabricante"]) or {}
        itens.append(
            {
                "fabricante": r["fabricante"],
                "coberturaDeclarada": {
                    "inicio": r["inicio"].isoformat() if r["inicio"] else None,
                    "fim": r["fim"].isoformat() if r["fim"] else None,
                    "diasComCarga": int(r["dias"] or 0),
                },
                "vendedores": int(r["vendedores"] or 0),
                "realizadoTotal": round(num(r["realizado"]), 2),
                "skus": int(x.get("skus") or 0),
                "categorias": int(x.get("categorias") or 0),
                "linhas": int(x.get("linhas") or 0),
                "atualizadoEm": r["atualizado_em"].isoformat() if r["atualizado_em"] else None,
            }
        )

    scope = scope_filters(user)
    travado = scope.get("fabricante")
    # Fornecedor sem vínculo: o filtro interno usa uma chave impossível, que
    # nunca pode aparecer na resposta. O que a tela mostra é a pendência.
    vinculo = None if (not travado or travado == SEM_VINCULO) else travado
    return {
        "fabricantes": itens,
        "escopoTravado": bool(travado),
        "fabricanteDoPerfil": vinculo,
        "vinculoPendente": bool(travado) and vinculo is None,
        "podeVerMargem": has_permission(user, "margin.view"),
        "podeGravarMetas": has_permission(user, "targets.edit") and estado_escrita(user)["podeAlterar"],
        "podeVerAcessos": has_permission(user, "audit.view") or is_admin(user.get("role")),
        "podeExportar": has_permission(user, "manufacturers.export"),
        "fontes": {
            "valores": "Indicadores por Fabricante",
            "sortimento": "Lista de Sortimento",
        },
    }


# ─────────────────────────────────────────────────────────────────────────────
# 2. Visão geral: indicadores A/B (RF-006, RF-009 a RF-012)
# ─────────────────────────────────────────────────────────────────────────────
@router.get("/insights/visual/resumo")
@cached()
def resumo(
    fabricante: str | None = Query(default=None, max_length=160),
    bInicio: str = Query(max_length=10),
    bFim: str = Query(max_length=10),
    aInicio: str | None = Query(default=None, max_length=10),
    aFim: str | None = Query(default=None, max_length=10),
    equipe: str | None = Query(default=None, max_length=120),
    vendedor: str | None = Query(default=None, max_length=40),
    precedencia: str = Query(default="auto", pattern="^(auto|soma|ultima_carga)$"),
    user: dict[str, Any] = Depends(require_permission("manufacturers.view")),
) -> dict[str, Any]:
    """Indicadores do período analisado (B) e, quando informado, do anterior (A)."""
    fab = _fabricante_autorizado(user, fabricante)
    ver_margem = has_permission(user, "margin.view")
    b_ini, b_fim = _periodo(bInicio, bFim, "b")
    periodo_a = _periodo_opcional(aInicio, aFim, "a")

    with get_connection() as conn:
        bloco_b = _indicadores(conn, user, b_ini, b_fim, fab, equipe, vendedor, precedencia, ver_margem)
        bloco_a = (
            _indicadores(conn, user, periodo_a[0], periodo_a[1], fab, equipe, vendedor, precedencia, ver_margem)
            if periodo_a
            else None
        )
        # Cobertura temporal do fabricante inteiro: serve para dizer se o
        # período pedido está dentro do que a base realmente tem.
        lim_parts, lim_params = _escopo(user, "f.cod_vendedor", "v.equipe", "f.fabricante")
        if fab:
            lim_parts = [*lim_parts, "f.fabricante = %s"]
            lim_params = [*lim_params, fab]
        lim_where = " AND ".join(["1=1", *lim_parts])
        limites = conn.execute(
            f"""
            SELECT MIN(f.data_referencia) AS inicio, MAX(f.data_referencia) AS fim
            FROM indicadores_fabricante f
            LEFT JOIN vendedores v ON v.cod_vendedor = f.cod_vendedor
            WHERE {lim_where}
            """,
            lim_params,
        ).fetchone()

    avisos: list[str] = []
    if bloco_b["semDados"]:
        avisos.append("O período analisado não tem carga nesta base: ausência de dados, não venda zero.")
    if bloco_a and bloco_a["semDados"]:
        avisos.append("O período anterior não tem carga: a comparação fica sem base, e não como queda.")
    if bloco_b["precedencia"] == "ultima_carga":
        avisos.append(
            "As datas do período repetem o mesmo fechamento. Para não somar cópias da mesma extração, "
            "a leitura usa apenas a carga mais recente de cada mês (precedência por cobertura)."
        )
    if periodo_a and not (periodo_a[1] < b_ini or b_fim < periodo_a[0]):
        avisos.append("Os períodos A e B se sobrepõem: a comparação não é independente.")
    inicio_base = limites["inicio"] if limites else None
    fim_base = limites["fim"] if limites else None
    if inicio_base and b_ini < inicio_base:
        avisos.append(f"A base começa em {inicio_base.isoformat()}; o trecho anterior a essa data não existe.")
    if fim_base and b_fim > fim_base:
        avisos.append(f"A base vai até {fim_base.isoformat()}; o trecho posterior ainda não foi carregado.")

    comparacao = {}
    if bloco_a:
        for campo in ("valor", "meta", "clientes", "ticket", "margem"):
            comparacao[campo] = _delta(bloco_a.get(campo), bloco_b.get(campo))

    return {
        "fabricante": fab,
        "periodoB": bloco_b,
        "periodoA": bloco_a,
        "comparacao": comparacao,
        "coberturaDeclarada": {
            "inicio": inicio_base.isoformat() if inicio_base else None,
            "fim": fim_base.isoformat() if fim_base else None,
        },
        "podeVerMargem": ver_margem,
        "avisos": avisos,
        "fontes": {
            "valores": "Indicadores por Fabricante",
            "margem": "Indicadores por Fabricante (percentual ponderado pelo valor)",
        },
    }


# ─────────────────────────────────────────────────────────────────────────────
# 3. Evolução acumulada (RF-012)
# ─────────────────────────────────────────────────────────────────────────────
@router.get("/insights/visual/evolucao")
@cached()
def evolucao(
    fabricante: str | None = Query(default=None, max_length=160),
    inicio: str | None = Query(default=None, max_length=10),
    fim: str | None = Query(default=None, max_length=10),
    equipe: str | None = Query(default=None, max_length=120),
    vendedor: str | None = Query(default=None, max_length=40),
    precedencia: str = Query(default="auto", pattern="^(auto|soma|ultima_carga)$"),
    user: dict[str, Any] = Depends(require_permission("manufacturers.view")),
) -> dict[str, Any]:
    """Série mensal de meta e realizado, mais o acumulado do período.

    O acumulado é só a soma do que já aconteceu. Nenhum ponto é projetado:
    o PRD proíbe apresentar projeção como realizado.
    """
    fab = _fabricante_autorizado(user, fabricante)
    hoje = date.today()
    ini = _data(inicio, "inicio") or date(hoje.year, 1, 1)
    f = _data(fim, "fim") or hoje
    if f < ini:
        raise HTTPException(status_code=400, detail="O período termina antes de começar.")

    with get_connection() as conn:
        where, params = _recorte_base(user, ini, f, fab, equipe, vendedor)
        where, params, modo, _ = _filtro_precedencia(conn, where, params, precedencia)
        rows = conn.execute(
            f"""
            SELECT f.ano_referencia AS ano, f.mes_referencia AS mes,
                   COALESCE(SUM(f.meta), 0) AS meta,
                   COALESCE(SUM(f.realizado), 0) AS realizado,
                   COALESCE(SUM(f.realizado_cobertura), 0) AS clientes
            FROM indicadores_fabricante f
            LEFT JOIN vendedores v ON v.cod_vendedor = f.cod_vendedor
            WHERE {where}
            GROUP BY 1, 2 ORDER BY 1, 2
            """,
            params,
        ).fetchall()

    serie: list[dict[str, Any]] = []
    acc_meta = acc_real = 0.0
    for r in rows:
        meta, real = num(r["meta"]), num(r["realizado"])
        acc_meta += meta
        acc_real += real
        serie.append(
            {
                "ano": int(r["ano"] or 0),
                "mes": int(r["mes"] or 0),
                "meta": round(meta, 2),
                "realizado": round(real, 2),
                "clientes": round(num(r["clientes"]), 2),
                "acumuladoMeta": round(acc_meta, 2),
                "acumuladoRealizado": round(acc_real, 2),
                "atingimento": round(real / meta * 100, 2) if meta > 0 else None,
            }
        )
    return {
        "fabricante": fab,
        "inicio": ini.isoformat(),
        "fim": f.isoformat(),
        "precedencia": modo,
        "serie": serie,
        "semDados": not serie,
        "fontes": {"valores": "Indicadores por Fabricante"},
    }


# ─────────────────────────────────────────────────────────────────────────────
# 4. Dimensões: categorias, linhas, equipes e vendedores (RF-013, RF-014)
# ─────────────────────────────────────────────────────────────────────────────
@router.get("/insights/visual/dimensoes")
@cached()
def dimensoes(
    fabricante: str | None = Query(default=None, max_length=160),
    bInicio: str = Query(max_length=10),
    bFim: str = Query(max_length=10),
    aInicio: str | None = Query(default=None, max_length=10),
    aFim: str | None = Query(default=None, max_length=10),
    equipe: str | None = Query(default=None, max_length=120),
    vendedor: str | None = Query(default=None, max_length=40),
    precedencia: str = Query(default="auto", pattern="^(auto|soma|ultima_carga)$"),
    user: dict[str, Any] = Depends(require_permission("manufacturers.view")),
) -> dict[str, Any]:
    """Comparação A/B por equipe e por vendedor, mais o sortimento do fabricante.

    A comparação é feita por CHAVE (código do vendedor, nome da equipe), nunca
    por posição no ranking: entrada e saída de um grupo são distinguíveis
    (RF-014). Categorias e linhas vêm da Lista de Sortimento, que descreve o
    portfólio — ela não carrega valor por período, e a resposta diz isso.
    """
    fab = _fabricante_autorizado(user, fabricante)
    b_ini, b_fim = _periodo(bInicio, bFim, "b")
    periodo_a = _periodo_opcional(aInicio, aFim, "a")

    def agregar(conn: Any, ini: date, f: date, chave: str, rotulo: str) -> dict[str, dict[str, Any]]:
        where, params = _recorte_base(user, ini, f, fab, equipe, vendedor)
        where, params, _, _ = _filtro_precedencia(conn, where, params, precedencia)
        rows = conn.execute(
            f"""
            SELECT {chave} AS chave, {rotulo} AS rotulo,
                   COALESCE(SUM(f.realizado), 0) AS valor,
                   COALESCE(SUM(f.meta), 0) AS meta,
                   COALESCE(SUM(f.realizado_cobertura), 0) AS clientes
            FROM indicadores_fabricante f
            LEFT JOIN vendedores v ON v.cod_vendedor = f.cod_vendedor
            WHERE {where}
            GROUP BY 1, 2
            """,
            params,
        ).fetchall()
        return {
            str(r["chave"]): {
                "rotulo": r["rotulo"] or str(r["chave"]),
                "valor": num(r["valor"]),
                "meta": num(r["meta"]),
                "clientes": num(r["clientes"]),
            }
            for r in rows
            if r["chave"] is not None
        }

    def comparar(a: dict[str, dict[str, Any]], b: dict[str, dict[str, Any]]) -> list[dict[str, Any]]:
        saida = []
        for chave in sorted(set(a) | set(b)):
            ra, rb = a.get(chave), b.get(chave)
            valor_a = ra["valor"] if ra else None
            valor_b = rb["valor"] if rb else None
            if ra and rb:
                movimento = "cresceu" if (valor_b or 0) > (valor_a or 0) else (
                    "caiu" if (valor_b or 0) < (valor_a or 0) else "estavel"
                )
            elif rb:
                movimento = "entrou"
            else:
                movimento = "saiu"
            saida.append(
                {
                    "chave": chave,
                    "rotulo": (rb or ra or {}).get("rotulo", chave),
                    "valor": _delta(valor_a, valor_b if valor_b is not None else 0.0)
                    if ra
                    else {"anterior": None, "atual": round(valor_b or 0, 2), "diferenca": None, "variacao": None, "semBase": True},
                    "clientesB": round((rb or {}).get("clientes", 0), 2),
                    "metaB": round((rb or {}).get("meta", 0), 2),
                    "movimento": movimento,
                }
            )
        saida.sort(key=lambda x: x["valor"]["atual"] or 0, reverse=True)
        return saida

    with get_connection() as conn:
        eq_b = agregar(conn, b_ini, b_fim, "COALESCE(v.equipe, 'Sem equipe')", "COALESCE(v.equipe, 'Sem equipe')")
        vd_b = agregar(conn, b_ini, b_fim, "f.cod_vendedor", "COALESCE(v.nome, f.cod_vendedor)")
        if periodo_a:
            eq_a = agregar(conn, periodo_a[0], periodo_a[1], "COALESCE(v.equipe, 'Sem equipe')", "COALESCE(v.equipe, 'Sem equipe')")
            vd_a = agregar(conn, periodo_a[0], periodo_a[1], "f.cod_vendedor", "COALESCE(v.nome, f.cod_vendedor)")
        else:
            eq_a, vd_a = {}, {}

        sort_parts = ["1=1"]
        sort_params: list[Any] = []
        if fab:
            sort_parts.append("fabricante = %s")
            sort_params.append(fab)
        elif scope_filters(user).get("fabricante"):
            sort_parts.append("fabricante = %s")
            sort_params.append(scope_filters(user)["fabricante"])
        categorias = conn.execute(
            f"""
            SELECT COALESCE(categoria, 'Sem categoria') AS nome,
                   COUNT(DISTINCT cod_produto) AS skus,
                   COUNT(DISTINCT COALESCE(linha, 'Sem linha')) AS linhas
            FROM sortimento WHERE {" AND ".join(sort_parts)}
            GROUP BY 1 ORDER BY skus DESC
            """,
            sort_params,
        ).fetchall()
        linhas = conn.execute(
            f"""
            SELECT COALESCE(linha, 'Sem linha') AS nome,
                   COALESCE(categoria, 'Sem categoria') AS categoria,
                   COUNT(DISTINCT cod_produto) AS skus
            FROM sortimento WHERE {" AND ".join(sort_parts)}
            GROUP BY 1, 2 ORDER BY skus DESC
            """,
            sort_params,
        ).fetchall()

    externo = _perfil_externo(user)
    return {
        "fabricante": fab,
        "equipes": [] if externo else (comparar(eq_a, eq_b) if periodo_a else comparar({}, eq_b)),
        "vendedores": [] if externo else (comparar(vd_a, vd_b) if periodo_a else comparar({}, vd_b)),
        "estruturaInterna": not externo,
        "categorias": [
            {"nome": r["nome"], "skus": int(r["skus"] or 0), "linhas": int(r["linhas"] or 0)} for r in categorias
        ],
        "linhas": [
            {"nome": r["nome"], "categoria": r["categoria"], "skus": int(r["skus"] or 0)} for r in linhas
        ],
        "comparouPeriodos": bool(periodo_a),
        "avisos": (
            [] if categorias else ["A Lista de Sortimento não tem itens deste fabricante: categorias e linhas ficam indisponíveis."]
        )
        + (
            [
                "Equipes e vendedores descrevem a estrutura comercial da CHOK e não compõem a visão do "
                "representante do fabricante."
            ]
            if externo
            else []
        ),
        "fontes": {
            "equipes": "Indicadores por Fabricante",
            "vendedores": "Indicadores por Fabricante",
            "categorias": "Lista de Sortimento (portfólio, sem valor por período)",
            "linhas": "Lista de Sortimento (portfólio, sem valor por período)",
        },
    }


# ─────────────────────────────────────────────────────────────────────────────
# 5. Rankings (RF-015 a RF-019, RN-06)
# ─────────────────────────────────────────────────────────────────────────────
def _tem_coluna(conn: Any, tabela: str, coluna: str) -> bool:
    row = conn.execute(
        """
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = %s AND column_name = %s
        """,
        (tabela, coluna),
    ).fetchone()
    return bool(row)


@router.get("/insights/visual/rankings")
@cached()
def rankings(
    fabricante: str | None = Query(default=None, max_length=160),
    inicio: str = Query(max_length=10),
    fim: str = Query(max_length=10),
    equipe: str | None = Query(default=None, max_length=120),
    vendedor: str | None = Query(default=None, max_length=40),
    precedencia: str = Query(default="auto", pattern="^(auto|soma|ultima_carga)$"),
    user: dict[str, Any] = Depends(require_permission("manufacturers.view")),
) -> dict[str, Any]:
    """Rankings de clientes/redes e de vendedores, com participação.

    Regras do PRD mantidas: entram apenas grupos com valor final POSITIVO; a
    participação usa todo o valor filtrado (não apenas o Top 20, por isso somar
    o Top 20 pode dar menos de 100%); a resposta devolve TODOS os grupos
    positivos — a tela destaca vinte e a exportação leva o conjunto inteiro.
    """
    fab = _fabricante_autorizado(user, fabricante)
    ini, f = _periodo(inicio, fim, "periodo")

    with get_connection() as conn:
        where, params = _recorte_base(user, ini, f, fab, equipe, vendedor)
        where, params, modo, _ = _filtro_precedencia(conn, where, params, precedencia)

        vendedores = conn.execute(
            f"""
            SELECT f.cod_vendedor AS codigo,
                   COALESCE(MAX(v.nome), f.cod_vendedor) AS nome,
                   COALESCE(MAX(v.equipe), 'Sem equipe') AS equipe,
                   COALESCE(SUM(f.realizado), 0) AS valor,
                   COALESCE(SUM(f.realizado_cobertura), 0) AS clientes,
                   COALESCE(SUM(f.meta), 0) AS meta
            FROM indicadores_fabricante f
            LEFT JOIN vendedores v ON v.cod_vendedor = f.cod_vendedor
            WHERE {where}
            GROUP BY f.cod_vendedor
            HAVING COALESCE(SUM(f.realizado), 0) > 0
            ORDER BY valor DESC, nome
            """,
            params,
        ).fetchall()

        # Clientes: dependem de `top_clientes` trazer a coluna `fabricante`.
        # Sem ela, o bloco volta vazio COM motivo — nunca preenchido na marra.
        clientes: list[Any] = []
        motivo_clientes: str | None = None
        if _tem_coluna(conn, "top_clientes", "fabricante"):
            cli_parts, cli_params = _escopo(user, "tc.cod_vendedor", "tv.equipe", "tc.fabricante")
            cli_parts.append("tc.data_referencia >= %s")
            cli_params.append(ini)
            cli_parts.append("tc.data_referencia <= %s")
            cli_params.append(f)
            if fab:
                cli_parts.append("tc.fabricante = %s")
                cli_params.append(fab)
            if equipe and not scope_filters(user).get("equipe"):
                cli_parts.append("tv.equipe = %s")
                cli_params.append(clean_text(equipe, 120))
            if vendedor and not scope_filters(user).get("vendedor"):
                cli_parts.append("tc.cod_vendedor = %s")
                cli_params.append(clean_text(vendedor, 40))
            try:
                clientes = conn.execute(
                    f"""
                    SELECT MIN(tc.cod_cliente) AS codigo,
                           COALESCE(MAX(c.razao_social), MAX(tc.cliente), MIN(tc.cod_cliente)) AS nome,
                           COALESCE(MAX(tc.equipe), 'Sem equipe') AS equipe,
                           COALESCE(BOOL_OR(c.e_rede), false) AS e_rede,
                           COALESCE(SUM(tc.venda_total_mes), 0) AS valor
                    FROM top_clientes tc
                    LEFT JOIN clientes c ON c.cod_cliente = tc.cod_cliente
                    LEFT JOIN vendedores tv ON tv.cod_vendedor = tc.cod_vendedor
                    WHERE {" AND ".join(["1=1", *cli_parts])}
                    GROUP BY tc.cod_cliente
                    HAVING COALESCE(SUM(tc.venda_total_mes), 0) > 0
                    ORDER BY valor DESC
                    """,
                    cli_params,
                ).fetchall()
            except Exception:  # noqa: BLE001
                conn.rollback()
                clientes = []
                motivo_clientes = "A consulta de clientes por fabricante falhou nesta carga."
        else:
            motivo_clientes = (
                "A carga de Top Clientes não traz a coluna de fabricante: o ranking de clientes "
                "por fabricante fica indisponível (ausência de origem, não venda zero)."
            )

    externo = _perfil_externo(user)
    if externo:
        # Zera o bloco ANTES de montar a resposta: assim o nome do vendedor não
        # chega sequer a existir no JSON enviado ao navegador dele.
        vendedores = []

    total_vend = sum(num(r["valor"]) for r in vendedores)
    total_cli = sum(num(r["valor"]) for r in clientes)

    return {
        "fabricante": fab,
        "inicio": ini.isoformat(),
        "fim": f.isoformat(),
        "precedencia": modo,
        "destaque": TOP_DESTAQUE,
        "vendedores": {
            "total": round(total_vend, 2),
            "indisponivel": (
                "O ranking por vendedor descreve a estrutura comercial da CHOK e não compõe a visão do "
                "representante do fabricante."
                if externo
                else None
            ),
            "itens": [
                {
                    "chave": r["codigo"],
                    "nome": r["nome"],
                    "equipe": r["equipe"],
                    "valor": round(num(r["valor"]), 2),
                    "clientes": round(num(r["clientes"]), 2),
                    "meta": round(num(r["meta"]), 2),
                    "participacao": round(num(r["valor"]) / total_vend * 100, 2) if total_vend else None,
                }
                for r in vendedores
            ],
        },
        "clientes": {
            "total": round(total_cli, 2),
            "indisponivel": motivo_clientes,
            "itens": [
                {
                    "chave": r["codigo"],
                    "nome": r["nome"],
                    "equipe": r["equipe"],
                    # "Sem rede" declarado é diferente de vínculo ausente (RF-017):
                    # aqui só é marcado como rede quem o cadastro afirma que é.
                    "rede": bool(r["e_rede"]),
                    "valor": round(num(r["valor"]), 2),
                    "participacao": round(num(r["valor"]) / total_cli * 100, 2) if total_cli else None,
                }
                for r in clientes
            ],
        },
        "observacao": (
            "A participação usa todo o valor filtrado do período, não apenas os vinte destacados: "
            "somar o Top 20 pode resultar em menos de 100%."
        ),
        "fontes": {"vendedores": "Indicadores por Fabricante", "clientes": "Top Clientes"},
    }


# ─────────────────────────────────────────────────────────────────────────────
# 6. Clientes a recuperar (RF-020 a RF-022, RN-07)
# ─────────────────────────────────────────────────────────────────────────────
@router.get("/insights/visual/recuperar")
@cached()
def recuperar(
    fabricante: str | None = Query(default=None, max_length=160),
    aInicio: str = Query(max_length=10),
    aFim: str = Query(max_length=10),
    bInicio: str = Query(max_length=10),
    bFim: str = Query(max_length=10),
    busca: str | None = Query(default=None, max_length=120),
    user: dict[str, Any] = Depends(require_permission("manufacturers.view")),
) -> dict[str, Any]:
    """Clientes com compra em A e sem recompra em B, no mesmo fabricante.

    Regras do PRD mantidas:

    * a chave é cliente + fabricante (RN-07);
    * os períodos precisam ser completos, CRONOLÓGICOS e SEM SOBREPOSIÇÃO —
      fora disso a lista não é apresentada como válida (CA-09);
    * a recompra é verificada em TODA a base do fabricante dentro de B, e não
      apenas na carteira do vendedor de A: assim, cliente que voltou a comprar
      com outro vendedor não aparece como perdido (RF-021, CA-08);
    * vendedor e equipe mostrados referem-se ao período A e não representam a
      responsabilidade atual — confirmar antes de abordar.
    """
    fab = _fabricante_autorizado(user, fabricante)
    a_ini, a_fim = _periodo(aInicio, aFim, "a")
    b_ini, b_fim = _periodo(bInicio, bFim, "b")
    if a_fim >= b_ini:
        raise HTTPException(
            status_code=400,
            detail="Os períodos precisam ser cronológicos e sem sobreposição: A deve terminar antes de B começar.",
        )

    with get_connection() as conn:
        if not _tem_coluna(conn, "top_clientes", "fabricante"):
            return {
                "fabricante": fab,
                "oportunidades": [],
                "indisponivel": (
                    "A carga de Top Clientes não traz a coluna de fabricante. Sem ela não dá para afirmar "
                    "que um cliente deixou de comprar DESTE fabricante — a lista fica indisponível em vez "
                    "de apresentar um resultado que a base não sustenta."
                ),
                "semPositivacao": _sem_positivacao(conn, user, fab, b_ini, b_fim, busca),
                "periodoA": {"inicio": a_ini.isoformat(), "fim": a_fim.isoformat()},
                "periodoB": {"inicio": b_ini.isoformat(), "fim": b_fim.isoformat()},
                "fontes": {"semPositivacao": "Não Positivados (por vendedor)"},
            }

        esc_parts, esc_params = _escopo(user, "tc.cod_vendedor", "tv.equipe", "tc.fabricante")
        fab_sql = "AND tc.fabricante = %s" if fab else ""
        fab_param = [fab] if fab else []

        carteira = conn.execute(
            f"""
            SELECT tc.cod_cliente AS codigo,
                   COALESCE(MAX(c.razao_social), MAX(tc.cliente), tc.cod_cliente) AS nome,
                   COALESCE(MAX(tc.nome_vendedor), MAX(tc.cod_vendedor), '—') AS vendedor,
                   COALESCE(MAX(tc.equipe), 'Sem equipe') AS equipe,
                   MAX(tc.fabricante) AS fabricante,
                   MAX(tc.data_referencia) AS ultima_compra,
                   COALESCE(SUM(tc.venda_total_mes), 0) AS valor_a
            FROM top_clientes tc
            LEFT JOIN clientes c ON c.cod_cliente = tc.cod_cliente
            LEFT JOIN vendedores tv ON tv.cod_vendedor = tc.cod_vendedor
            WHERE {" AND ".join(["1=1", *esc_parts])}
              AND tc.data_referencia BETWEEN %s AND %s {fab_sql}
            GROUP BY tc.cod_cliente
            HAVING COALESCE(SUM(tc.venda_total_mes), 0) > 0
            """,
            [*esc_params, a_ini, a_fim, *fab_param],
        ).fetchall()

        # Recompra: TODA a base do fabricante em B (sem recorte de vendedor),
        # para não transformar troca de carteira em "cliente perdido".
        recompra_parts = ["1=1"]
        recompra_params: list[Any] = []
        if fab:
            recompra_parts.append("tc.fabricante = %s")
            recompra_params.append(fab)
        elif scope_filters(user).get("fabricante"):
            recompra_parts.append("tc.fabricante = %s")
            recompra_params.append(scope_filters(user)["fabricante"])
        recomprou = {
            r["codigo"]
            for r in conn.execute(
                f"""
                SELECT tc.cod_cliente AS codigo
                FROM top_clientes tc
                WHERE {" AND ".join(recompra_parts)}
                  AND tc.data_referencia BETWEEN %s AND %s
                GROUP BY tc.cod_cliente
                HAVING COALESCE(SUM(tc.venda_total_mes), 0) > 0
                """,
                [*recompra_params, b_ini, b_fim],
            ).fetchall()
        }

        sem_pos = _sem_positivacao(conn, user, fab, b_ini, b_fim, busca)

    termo = (clean_optional(busca, 120) or "").strip().lower()
    oportunidades = []
    for r in carteira:
        if r["codigo"] in recomprou:
            continue
        linha = {
            "codigo": r["codigo"],
            "nome": r["nome"],
            "fabricante": r["fabricante"],
            "vendedorEmA": r["vendedor"],
            "equipeEmA": r["equipe"],
            "ultimaCompra": r["ultima_compra"].isoformat() if r["ultima_compra"] else None,
            "valorEmA": round(num(r["valor_a"]), 2),
        }
        if termo:
            alvo = " ".join(str(v or "") for v in linha.values()).lower()
            if termo not in alvo:
                continue
        oportunidades.append(linha)
    # Ordem pelo valor que o cliente representava em A: é a leitura de
    # prioridade comercial que o PRD pede.
    oportunidades.sort(key=lambda x: x["valorEmA"], reverse=True)

    return {
        "fabricante": fab,
        "oportunidades": oportunidades,
        "indisponivel": None,
        "semPositivacao": sem_pos,
        "periodoA": {"inicio": a_ini.isoformat(), "fim": a_fim.isoformat()},
        "periodoB": {"inicio": b_ini.isoformat(), "fim": b_fim.isoformat()},
        "observacao": (
            "Vendedor, equipe e última compra referem-se ao período A e não representam o cadastro "
            "atual de responsabilidade: confirme antes da abordagem."
        ),
        "fontes": {"oportunidades": "Top Clientes", "semPositivacao": "Não Positivados (por vendedor)"},
    }


def _sem_positivacao(
    conn: Any,
    user: dict[str, Any],
    fab: str | None,
    ini: date,
    fim: date,
    busca: str | None,
) -> dict[str, Any]:
    """Clientes sem positivação no fabricante, direto da base Não Positivados.

    Bloco independente da recuperação: é uma leitura que a base sustenta
    sozinha, útil mesmo quando o cruzamento A/B fica indisponível.
    """
    travado = scope_filters(user).get("fabricante")
    alvo = fab or travado
    if not alvo:
        return {"itens": [], "indisponivel": "Escolha um fabricante para ver os clientes sem positivação."}

    parts, params = _escopo(user, "n.cod_vendedor", "v.equipe", None)
    parts.append("n.data_referencia BETWEEN %s AND %s")
    params.extend([ini, fim])
    termo = clean_optional(busca, 120)
    if termo:
        parts.append("(n.razao_social ILIKE %s OR n.nome_fantasia ILIKE %s OR n.cod_cliente ILIKE %s)")
        padrao = like_pattern(termo)
        params.extend([padrao, padrao, padrao])
    try:
        rows = conn.execute(
            f"""
            SELECT n.cod_cliente AS codigo,
                   COALESCE(MAX(n.razao_social), MAX(n.nome_fantasia), n.cod_cliente) AS nome,
                   COALESCE(MAX(n.municipio), '—') AS municipio,
                   COALESCE(MAX(v.nome), MAX(n.cod_vendedor), '—') AS vendedor,
                   COALESCE(MAX(v.equipe), 'Sem equipe') AS equipe,
                   COALESCE(MAX(
                     CASE WHEN (n.fabricantes ->> %s) ~ '^-?[0-9]+([.,][0-9]+)?$'
                          THEN replace(n.fabricantes ->> %s, ',', '.')::numeric END
                   ), 0) AS valor
            FROM nao_positivados_vendedor n
            LEFT JOIN vendedores v ON v.cod_vendedor = n.cod_vendedor
            WHERE {" AND ".join(["1=1", *parts])}
              AND (n.fabricantes -> %s) IS NOT NULL
            GROUP BY n.cod_cliente
            ORDER BY valor DESC
            LIMIT 500
            """,
            [alvo, alvo, *params, alvo],
        ).fetchall()
    except Exception:  # noqa: BLE001
        conn.rollback()
        return {"itens": [], "indisponivel": "A base de Não Positivados não cobre este recorte."}

    return {
        "itens": [
            {
                "codigo": r["codigo"],
                "nome": r["nome"],
                "municipio": r["municipio"],
                "vendedor": r["vendedor"],
                "equipe": r["equipe"],
                "valor": round(num(r["valor"]), 2),
            }
            for r in rows
        ],
        "indisponivel": None if rows else "Nenhum cliente sem positivação neste fabricante e período.",
    }


# ─────────────────────────────────────────────────────────────────────────────
# 7. Produtos foco (RF-023, RN-08)
# ─────────────────────────────────────────────────────────────────────────────
@router.get("/insights/visual/produtos-foco")
def produtos_foco(
    fabricante: str | None = Query(default=None, max_length=160),
    user: dict[str, Any] = Depends(require_permission("manufacturers.view")),
) -> dict[str, Any]:
    """Itens acompanhados e a referência de clientes de CADA um.

    As coberturas não são somáveis: o mesmo cliente pode contar em vários
    produtos, então sete coberturas não formam uma carteira única (RN-08).
    """
    fab = _fabricante_autorizado(user, fabricante)
    parts = ["ativo = true"]
    params: list[Any] = []
    alvo = fab or scope_filters(user).get("fabricante")
    if alvo:
        parts.append("fabricante = %s")
        params.append(alvo)
    with get_connection() as conn:
        rows = conn.execute(
            f"""
            SELECT pf.id, pf.fabricante, pf.cod_produto, pf.descricao, pf.meta_clientes,
                   (SELECT MAX(s.produto) FROM sortimento s
                     WHERE s.cod_produto = pf.cod_produto) AS produto_sortimento,
                   (SELECT MAX(COALESCE(s.categoria, 'Sem categoria')) FROM sortimento s
                     WHERE s.cod_produto = pf.cod_produto) AS categoria
            FROM produtos_foco pf
            WHERE {" AND ".join(parts)}
            ORDER BY pf.fabricante, pf.cod_produto
            """,
            params,
        ).fetchall()
    return {
        "fabricante": fab,
        "itens": [
            {
                "id": int(r["id"]),
                "fabricante": r["fabricante"],
                "codProduto": r["cod_produto"],
                "descricao": r["descricao"] or r["produto_sortimento"],
                "categoria": r["categoria"],
                "metaClientes": int(r["meta_clientes"] or 0),
                # Cobertura real por item exige venda no nível do produto, que
                # esta base ainda não traz. Indisponível é diferente de zero.
                "clientesAtendidos": None,
            }
            for r in rows
        ],
        "podeEditar": has_permission(user, "targets.edit") and estado_escrita(user)["podeAlterar"],
        "avisos": [
            "A cobertura de cada item depende de venda no nível do produto, que ainda não é carregada: "
            "a referência de clientes é exibida, o atendido fica indisponível (e não zero).",
            "Coberturas de itens diferentes não se somam: o mesmo cliente pode contar em vários produtos.",
        ],
        "fontes": {"itens": "Produtos foco (cadastro da plataforma)", "descricao": "Lista de Sortimento"},
    }


@router.post("/insights/visual/produtos-foco", status_code=201)
def salvar_produto_foco(
    body: dict[str, Any] = Body(...),
    user: dict[str, Any] = Depends(require_write("targets.edit")),
) -> dict[str, Any]:
    """Cadastra ou atualiza um item foco. Fabricante é obrigatório."""
    fab = _fabricante_autorizado(user, clean_optional(body.get("fabricante"), 160))
    if not fab:
        raise HTTPException(status_code=400, detail="Informe o fabricante do produto foco.")
    cod = clean_optional(body.get("codProduto"), 60)
    if not cod:
        raise HTTPException(status_code=400, detail="Informe o código do produto.")
    try:
        meta = int(body.get("metaClientes") or 0)
    except (TypeError, ValueError) as exc:
        raise HTTPException(status_code=400, detail="Referência de clientes inválida.") from exc
    if meta < 0:
        raise HTTPException(status_code=400, detail="A referência de clientes não pode ser negativa.")

    with get_connection() as conn:
        conn.execute(
            """
            INSERT INTO produtos_foco (fabricante, cod_produto, descricao, meta_clientes, criado_por)
            VALUES (%s, %s, %s, %s, %s)
            ON CONFLICT (fabricante, cod_produto) DO UPDATE SET
              descricao = EXCLUDED.descricao,
              meta_clientes = EXCLUDED.meta_clientes,
              ativo = true,
              atualizado_em = now()
            """,
            (fab, cod, clean_optional(body.get("descricao"), 200), meta, str(user.get("email") or user.get("id"))),
        )
        conn.commit()
    invalidate_all()
    return {"ok": True, "fabricante": fab, "codProduto": cod}


@router.delete("/insights/visual/produtos-foco/{item_id}")
def remover_produto_foco(
    item_id: int,
    user: dict[str, Any] = Depends(require_write("targets.edit")),
) -> dict[str, Any]:
    with get_connection() as conn:
        alvo = conn.execute("SELECT fabricante FROM produtos_foco WHERE id = %s", (item_id,)).fetchone()
        if not alvo:
            raise HTTPException(status_code=404, detail="Produto foco não encontrado.")
        _fabricante_autorizado(user, alvo["fabricante"])
        conn.execute("UPDATE produtos_foco SET ativo = false, atualizado_em = now() WHERE id = %s", (item_id,))
        conn.commit()
    invalidate_all()
    return {"ok": True}


# ─────────────────────────────────────────────────────────────────────────────
# 8. Metas financeiras por fabricante (RF-024, RF-025, RN-08)
# ─────────────────────────────────────────────────────────────────────────────
@router.get("/insights/visual/metas")
def listar_metas(
    fabricante: str | None = Query(default=None, max_length=160),
    user: dict[str, Any] = Depends(require_permission("manufacturers.view")),
) -> dict[str, Any]:
    """Metas gravadas no servidor — leem-se em qualquer sessão (RF-025)."""
    fab = _fabricante_autorizado(user, fabricante)
    parts = ["1=1"]
    params: list[Any] = []
    alvo = fab or scope_filters(user).get("fabricante")
    if alvo:
        parts.append("fabricante = %s")
        params.append(alvo)
    with get_connection() as conn:
        rows = conn.execute(
            f"""
            SELECT id, fabricante, inicio, fim, meta_valor, meta_cobertura, observacao,
                   criado_por, atualizado_em
            FROM metas_fabricante WHERE {" AND ".join(parts)}
            ORDER BY inicio DESC, fabricante
            """,
            params,
        ).fetchall()
    return {
        "fabricante": fab,
        "metas": [
            {
                "id": int(r["id"]),
                "fabricante": r["fabricante"],
                "inicio": r["inicio"].isoformat(),
                "fim": r["fim"].isoformat(),
                "metaValor": round(num(r["meta_valor"]), 2),
                "metaCobertura": round(num(r["meta_cobertura"]), 2) if r["meta_cobertura"] is not None else None,
                "observacao": r["observacao"],
                "criadoPor": r["criado_por"],
                "atualizadoEm": r["atualizado_em"].isoformat() if r["atualizado_em"] else None,
            }
            for r in rows
        ],
        # O fornecedor LÊ a meta do próprio fabricante e nunca grava (RF-025, CA-20).
        # Perfis de leitura e quem está sem liberação também só leem.
        "podeGravar": has_permission(user, "targets.edit") and estado_escrita(user)["podeAlterar"],
        "observacao": (
            "A meta pertence ao fabricante e às datas exatas. Gerência, equipe e vendedor não a rateiam, "
            "e metas de intervalos sobrepostos não são somadas automaticamente."
        ),
    }


@router.post("/insights/visual/metas", status_code=201)
def gravar_meta(
    body: dict[str, Any] = Body(...),
    user: dict[str, Any] = Depends(require_write("targets.edit")),
) -> dict[str, Any]:
    fab = _fabricante_autorizado(user, clean_optional(body.get("fabricante"), 160))
    if not fab:
        raise HTTPException(status_code=400, detail="Informe o fabricante da meta.")
    ini, fim = _periodo(body.get("inicio"), body.get("fim"), "meta")
    try:
        valor = float(body.get("metaValor") or 0)
        cobertura = body.get("metaCobertura")
        cobertura = float(cobertura) if cobertura not in (None, "") else None
    except (TypeError, ValueError) as exc:
        raise HTTPException(status_code=400, detail="Valor de meta inválido.") from exc
    if valor <= 0:
        raise HTTPException(
            status_code=400,
            detail="A meta precisa ser positiva: sem meta positiva o atingimento não tem denominador.",
        )

    with get_connection() as conn:
        conn.execute(
            """
            INSERT INTO metas_fabricante
              (fabricante, inicio, fim, meta_valor, meta_cobertura, observacao, criado_por)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (fabricante, inicio, fim) DO UPDATE SET
              meta_valor = EXCLUDED.meta_valor,
              meta_cobertura = EXCLUDED.meta_cobertura,
              observacao = EXCLUDED.observacao,
              atualizado_em = now()
            """,
            (
                fab,
                ini,
                fim,
                valor,
                cobertura,
                clean_optional(body.get("observacao"), 400),
                str(user.get("email") or user.get("id")),
            ),
        )
        sobrepostas = conn.execute(
            """
            SELECT COUNT(*) AS total FROM metas_fabricante
            WHERE fabricante = %s AND NOT (fim < %s OR inicio > %s)
            """,
            (fab, ini, fim),
        ).fetchone()
        conn.commit()
    invalidate_all()
    return {
        "ok": True,
        "fabricante": fab,
        "aviso": (
            "Há mais de uma meta cobrindo este intervalo. Elas não são somadas automaticamente: "
            "defina qual vale antes de usar o atingimento."
            if int(num(sobrepostas["total"])) > 1
            else None
        ),
    }


@router.delete("/insights/visual/metas/{meta_id}")
def remover_meta(
    meta_id: int,
    user: dict[str, Any] = Depends(require_write("targets.edit")),
) -> dict[str, Any]:
    with get_connection() as conn:
        alvo = conn.execute("SELECT fabricante FROM metas_fabricante WHERE id = %s", (meta_id,)).fetchone()
        if not alvo:
            raise HTTPException(status_code=404, detail="Meta não encontrada.")
        _fabricante_autorizado(user, alvo["fabricante"])
        conn.execute("DELETE FROM metas_fabricante WHERE id = %s", (meta_id,))
        conn.commit()
    invalidate_all()
    return {"ok": True}


# ─────────────────────────────────────────────────────────────────────────────
# 9. Margens — visão administrativa (RF-027, RF-028, RN-09)
# ─────────────────────────────────────────────────────────────────────────────
@router.get("/insights/visual/margens")
@cached()
def margens(
    fabricante: str | None = Query(default=None, max_length=160),
    inicio: str = Query(max_length=10),
    fim: str = Query(max_length=10),
    busca: str | None = Query(default=None, max_length=120),
    pagina: int = Query(default=1, ge=1, le=500),
    user: dict[str, Any] = Depends(require_permission("margin.view")),
) -> dict[str, Any]:
    """Margem por vendedor/equipe, ponderada pelo valor, com busca e paginação.

    Exclusiva de quem tem ``margin.view``. O FORNECEDOR não tem essa permissão
    em nenhuma combinação, então esta rota responde 403 para ele — a margem não
    é um campo escondido na tela, ela não sai do servidor (RF-004, CA-03).

    Campo ausente aparece como indisponível, nunca como 0% (RN-09).
    """
    fab = _fabricante_autorizado(user, fabricante)
    ini, f = _periodo(inicio, fim, "periodo")
    termo = clean_optional(busca, 120)

    with get_connection() as conn:
        where, params = _recorte_base(user, ini, f, fab, None, None)
        where, params, modo, _ = _filtro_precedencia(conn, where, params, "auto")
        if termo:
            where += " AND (v.nome ILIKE %s OR f.cod_vendedor ILIKE %s OR v.equipe ILIKE %s OR f.fabricante ILIKE %s)"
            padrao = like_pattern(termo)
            params = [*params, padrao, padrao, padrao, padrao]

        total = conn.execute(
            f"""
            SELECT COUNT(*) AS total FROM (
              SELECT 1 FROM indicadores_fabricante f
              LEFT JOIN vendedores v ON v.cod_vendedor = f.cod_vendedor
              WHERE {where}
              GROUP BY f.fabricante, f.cod_vendedor
            ) q
            """,
            params,
        ).fetchone()

        rows = conn.execute(
            f"""
            SELECT f.fabricante,
                   f.cod_vendedor AS codigo,
                   COALESCE(MAX(v.nome), f.cod_vendedor) AS nome,
                   COALESCE(MAX(v.equipe), 'Sem equipe') AS equipe,
                   COALESCE(SUM(f.realizado), 0) AS valor,
                   COALESCE(SUM(CASE WHEN f.pct_margem IS NOT NULL AND f.realizado > 0
                                     THEN f.pct_margem * f.realizado END), 0) AS margem_num,
                   COALESCE(SUM(CASE WHEN f.pct_margem IS NOT NULL AND f.realizado > 0
                                     THEN f.realizado END), 0) AS margem_den
            FROM indicadores_fabricante f
            LEFT JOIN vendedores v ON v.cod_vendedor = f.cod_vendedor
            WHERE {where}
            GROUP BY f.fabricante, f.cod_vendedor
            ORDER BY valor DESC
            LIMIT %s OFFSET %s
            """,
            [*params, MARGENS_PAGINA, (pagina - 1) * MARGENS_PAGINA],
        ).fetchall()

        resumo_row = conn.execute(
            f"""
            SELECT COALESCE(SUM(CASE WHEN f.pct_margem IS NOT NULL AND f.realizado > 0
                                     THEN f.pct_margem * f.realizado END), 0) AS n,
                   COALESCE(SUM(CASE WHEN f.pct_margem IS NOT NULL AND f.realizado > 0
                                     THEN f.realizado END), 0) AS d
            FROM indicadores_fabricante f
            LEFT JOIN vendedores v ON v.cod_vendedor = f.cod_vendedor
            WHERE {where}
            """,
            params,
        ).fetchone()

    den_total = num(resumo_row["d"])
    itens = []
    for r in rows:
        den = num(r["margem_den"])
        itens.append(
            {
                "fabricante": r["fabricante"],
                "codigo": r["codigo"],
                "nome": r["nome"],
                "equipe": r["equipe"],
                "valor": round(num(r["valor"]), 2),
                # Denominador zero => indisponível (traço na tela), não 0%.
                "margem": round(num(r["margem_num"]) / den, 2) if den else None,
                "valorComMargem": round(den, 2),
            }
        )

    total_itens = int(num(total["total"]))
    return {
        "fabricante": fab,
        "inicio": ini.isoformat(),
        "fim": f.isoformat(),
        "precedencia": modo,
        "pagina": pagina,
        "porPagina": MARGENS_PAGINA,
        "total": total_itens,
        "paginas": max(1, (total_itens + MARGENS_PAGINA - 1) // MARGENS_PAGINA),
        "itens": itens,
        "margemPonderada": round(num(resumo_row["n"]) / den_total, 2) if den_total else None,
        "valorComMargem": round(den_total, 2),
        "observacao": (
            "Margem ponderada pelo valor: a média simples dos percentuais daria outro número e estaria errada. "
            "Linhas sem percentual na origem ficam indisponíveis, não zeradas."
        ),
        "fontes": {"margem": "Indicadores por Fabricante (pct_margem)"},
    }


# ─────────────────────────────────────────────────────────────────────────────
# 10. Histórico de acessos (RF-029)
# ─────────────────────────────────────────────────────────────────────────────
@router.get("/insights/visual/acessos")
def acessos(
    fabricante: str | None = Query(default=None, max_length=160),
    limit: int = Query(default=100, ge=1, le=500),
    user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    """Consultas registradas na Visual Fabricantes.

    Só a administração e quem tem ``audit.view`` lê o histórico de todos; os
    demais perfis leem apenas os próprios eventos, e o fornecedor não lê
    histórico nenhum (capacidade exclusiva da gestão no PRD, seção 4).
    """
    pode_ver_tudo = is_admin(user.get("role")) or has_permission(user, "audit.view")
    if not pode_ver_tudo and scope_filters(user).get("fabricante"):
        raise HTTPException(status_code=403, detail="Histórico de acessos é exclusivo da gestão.")

    parts = ["1=1"]
    params: list[Any] = []
    if not pode_ver_tudo:
        parts.append("usuario_id = %s")
        params.append(str(user.get("id")))
    fab = clean_optional(fabricante, 160)
    if fab:
        parts.append("fabricante = %s")
        params.append(fab)
    params.append(limit)

    with get_connection() as conn:
        rows = conn.execute(
            f"""
            SELECT id, ocorrido_em, fabricante, usuario_email, usuario_nome, papel,
                   recurso, sucesso, detalhe, origem_chave
            FROM acessos_fabricante
            WHERE {" AND ".join(parts)}
            ORDER BY ocorrido_em DESC
            LIMIT %s
            """,
            params,
        ).fetchall()

    return {
        "eventos": [
            {
                "id": int(r["id"]),
                "ocorridoEm": r["ocorrido_em"].isoformat() if r["ocorrido_em"] else None,
                "fabricante": r["fabricante"],
                "usuario": r["usuario_nome"] or r["usuario_email"],
                "papel": r["papel"],
                "recurso": r["recurso"],
                "sucesso": bool(r["sucesso"]),
                "detalhe": r["detalhe"],
                "origemChave": r["origem_chave"],
            }
            for r in rows
        ],
        "escopoCompleto": pode_ver_tudo,
        "observacao": (
            "A chave de origem é pseudonimizada (resumo do endereço), o que não é anonimização garantida. "
            "O nome exibido é o do cadastro autenticado."
        ),
    }


@router.post("/insights/visual/acessos", status_code=201)
def registrar_acesso(
    request: Request,
    body: dict[str, Any] = Body(default={}),
    user: dict[str, Any] = Depends(require_permission("manufacturers.view")),
) -> dict[str, Any]:
    """Registra a consulta aberta na tela (fabricante e recurso)."""
    fab = _fabricante_autorizado(user, clean_optional(body.get("fabricante"), 160))
    _registrar_acesso(
        request,
        user,
        fab,
        clean_text(body.get("recurso") or "visual-fabricantes", 80),
        True,
        clean_optional(body.get("detalhe"), 200),
    )
    return {"ok": True}
