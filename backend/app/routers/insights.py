"""Rotas acrescentadas na evolução do sistema.

Nada aqui substitui endpoint existente: `/api/dashboard`, `/api/board/*` e
`/api/commercial/*` continuam intactos e seguem sendo a fonte dos mesmos
números. Este módulo apenas acrescenta as leituras que as telas novas pedem:

* ``/insights/kpis``          → Faturamento, Cobertura e Sortimento em DIA e MÊS
                                (carrossel do Dashboard), + pedidos e ticket médio.
* ``/insights/top-clientes``  → TOP N com alternância dia / mês / personalizado.
* ``/insights/busca``         → pesquisa inteligente (cliente, CNPJ, SKU, pedido…).
* ``/insights/fabricante*``   → drill Fabricante → Categoria → Produto → Cliente.
* ``/insights/comparativo``   → comparativo entre períodos (gerentes).
* ``/insights/calendario``    → eventos comerciais + semanas do ciclo SAR.
* ``/insights/sessoes``       → histórico de sessões (Seção 4).

Regras de segurança aplicadas em TODAS elas:

1. O recorte de dados vem de ``scope_filters(user)`` e é colado no SQL — o
   Supervisor não sai da própria equipe e o Vendedor não sai do próprio código,
   mesmo que mande outro valor na querystring.
2. Margem/custo só saem do servidor com a permissão ``margin.view``; sem ela o
   campo vem ``None`` (não é "escondido na tela").
3. Rotas de escrita e as exclusivas de gerência usam ``require_permission(...)``.
"""

from __future__ import annotations

from datetime import date, timedelta
from typing import Any

from fastapi import APIRouter, Body, Depends, HTTPException, Query

from app.cache import cached, invalidate_all
from app.db import get_connection
from app.sanitize import clean_optional, clean_text, like_pattern
from app.security import get_current_user, has_permission, require_permission
from app.services import num, scope_filters

router = APIRouter(tags=["insights"])

# ── Ciclo comercial de 4 semanas (Seção 8) ──────────────────────────────────
# A semana vai de DOMINGO a SÁBADO, como no calendário civil.
#
# Referência combinada: a PRIMEIRA linha semanal exibida no calendário de
# janeiro/2026 é a "Semana 3". Como 01/01/2026 cai numa quinta, essa linha
# começa no domingo 28/12/2025. A partir daí a sequência 1-2-3-4 nunca
# reinicia ao virar mês ou ano.
#
# (A âncora era 29/12/2025 enquanto a semana começava na segunda; ao passar
# para domingo ela recuou um dia, de propósito, para janeiro/2026 continuar
# abrindo na Semana 3.)
#
# Atenção: é o ciclo comercial interno, NÃO a semana ISO do ano.
CICLO_ANCORA = date(2025, 12, 28)
CICLO_ANCORA_SEMANA = 3


def domingo_da_semana(dia: date) -> date:
    """Domingo que abre a semana daquela data."""
    # weekday(): segunda=0 … domingo=6. isoweekday() % 7 dá domingo=0.
    return dia - timedelta(days=dia.isoweekday() % 7)


def semana_comercial(dia: date) -> int:
    """Número da semana no ciclo comercial interno (1..4)."""
    delta = (domingo_da_semana(dia) - CICLO_ANCORA).days // 7
    return (delta + CICLO_ANCORA_SEMANA - 1) % 4 + 1


def _parse_dia(valor: str | None, campo: str = "dia") -> date | None:
    if not valor:
        return None
    try:
        return date.fromisoformat(str(valor).strip()[:10])
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=f'Data inválida em "{campo}".') from exc


def _escopo_sql(
    user: dict[str, Any], alias_vendedor: str, alias_equipe: str | None = None
) -> tuple[list[str], list[Any]]:
    """Cláusulas obrigatórias do escopo do usuário (nunca vêm do cliente)."""
    scope = scope_filters(user)
    parts: list[str] = []
    params: list[Any] = []
    if scope.get("vendedor"):
        parts.append(f"{alias_vendedor} = %s")
        params.append(scope["vendedor"])
    if scope.get("equipe") and alias_equipe:
        parts.append(f"{alias_equipe} = %s")
        params.append(scope["equipe"])
    return parts, params


def _filtros_opcionais(
    user: dict[str, Any],
    equipe: str | None,
    vendedor: str | None,
    alias_vendedor: str,
    alias_equipe: str | None,
) -> tuple[list[str], list[Any]]:
    """Escopo obrigatório + filtros da tela (só para quem pode usá-los)."""
    parts, params = _escopo_sql(user, alias_vendedor, alias_equipe)
    scope = scope_filters(user)
    if vendedor and not scope.get("vendedor"):
        parts.append(f"{alias_vendedor} = %s")
        params.append(clean_text(vendedor, 40))
    if equipe and not scope.get("equipe") and not scope.get("vendedor") and alias_equipe:
        parts.append(f"{alias_equipe} = %s")
        params.append(clean_text(equipe, 120))
    return parts, params


def _bloco(meta: float, realizado: float) -> dict[str, Any]:
    return {
        "meta": round(meta, 2),
        "realizado": round(realizado, 2),
        "gap": round(realizado - meta, 2),
        "pct": round(realizado / meta * 100, 2) if meta else 0.0,
    }


# ─────────────────────────────────────────────────────────────────────────────
# Seção 5 — Indicadores DIA × MÊS (carrossel do Dashboard)
# ─────────────────────────────────────────────────────────────────────────────
@router.get("/insights/kpis")
@cached()
def kpis_dia_mes(
    ano: int | None = Query(default=None, ge=2000, le=2100),
    mes: int | None = Query(default=None, ge=1, le=12),
    start: str | None = Query(default=None, max_length=10),
    end: str | None = Query(default=None, max_length=10),
    dia: str | None = Query(default=None, max_length=10),
    equipe: str | None = Query(default=None, max_length=120),
    vendedor: str | None = Query(default=None, max_length=40),
    user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    """Faturamento, Cobertura e Sortimento nas duas leituras do carrossel.

    * MÊS — soma do período selecionado, exatamente a mesma agregação de
      ``/api/dashboard``, para que os dois painéis nunca divirjam.
    * DIA — a mesma soma restrita a UMA ``data_referencia``. Sem ``dia``
      informado, usa a data mais recente que existe dentro do período
      (``diaSelecionado``), que é o que o usuário espera ao abrir a tela.
    """
    ver_margem = has_permission(user, "margin.view")
    parts, escopo_params = _filtros_opcionais(user, equipe, vendedor, "iv.cod_vendedor", "v.equipe")
    join = " LEFT JOIN vendedores v ON v.cod_vendedor = iv.cod_vendedor"

    periodo: list[str] = []
    periodo_params: list[Any] = []
    if ano:
        periodo.append("iv.ano_referencia = %s")
        periodo_params.append(ano)
    if mes:
        periodo.append("iv.mes_referencia = %s")
        periodo_params.append(mes)
    if start:
        periodo.append("iv.data_referencia >= %s")
        periodo_params.append(_parse_dia(start, "start"))
    if end:
        periodo.append("iv.data_referencia <= %s")
        periodo_params.append(_parse_dia(end, "end"))

    where_mes = " AND ".join(["1=1", *parts, *periodo])
    base_params = [*escopo_params, *periodo_params]
    agregados = """
        COALESCE(SUM(iv.meta_faturamento), 0)      AS meta_fat,
        COALESCE(SUM(iv.realizado_faturamento), 0) AS real_fat,
        COALESCE(SUM(iv.meta_cobertura), 0)        AS meta_cob,
        COALESCE(SUM(iv.realizado_cobertura), 0)   AS real_cob,
        COALESCE(SUM(iv.meta_sortimento), 0)       AS meta_sor,
        COALESCE(SUM(iv.realizado_sortimento), 0)  AS real_sor,
        COALESCE(AVG(NULLIF(iv.pct_margem, 0)), 0) AS margem
    """

    dia_pedido = _parse_dia(dia)
    pedidos_dia = 0
    dia_row = None

    with get_connection() as conn:
        mes_row = conn.execute(
            f"SELECT {agregados} FROM indicadores_vendedor iv {join} WHERE {where_mes}",
            base_params,
        ).fetchone()

        # Além das datas, o total de cada uma: é o que permite dizer se a base
        # tem movimento DIÁRIO de verdade ou se as datas são apenas o carimbo
        # de cargas repetidas do mesmo fechamento mensal (ver `avisoCarga`).
        dias_rows = conn.execute(
            f"""
            SELECT iv.data_referencia AS d,
                   COALESCE(SUM(iv.realizado_faturamento), 0) AS total
            FROM indicadores_vendedor iv {join}
            WHERE {where_mes}
            GROUP BY iv.data_referencia
            ORDER BY d DESC
            LIMIT 62
            """,
            base_params,
        ).fetchall()
        dias_disponiveis = [r["d"] for r in dias_rows if r["d"]]
        totais_por_dia = {round(num(r["total"]), 2) for r in dias_rows if r["d"]}

        alvo = dia_pedido if dia_pedido in dias_disponiveis else (dias_disponiveis[0] if dias_disponiveis else None)
        if alvo is not None:
            dia_row = conn.execute(
                f"SELECT {agregados} FROM indicadores_vendedor iv {join} "
                f"WHERE {where_mes} AND iv.data_referencia = %s",
                [*base_params, alvo],
            ).fetchone()

        # Pedidos/positivação vêm de indicadores_positivacao (mesma granularidade diária).
        pos_parts, pos_escopo = _filtros_opcionais(user, equipe, vendedor, "p.cod_vendedor", "p.equipe")
        pos_periodo: list[str] = []
        pos_periodo_params: list[Any] = []
        if ano:
            pos_periodo.append("p.ano_referencia = %s")
            pos_periodo_params.append(ano)
        if mes:
            pos_periodo.append("p.mes_referencia = %s")
            pos_periodo_params.append(mes)
        if start:
            pos_periodo.append("p.data_referencia >= %s")
            pos_periodo_params.append(_parse_dia(start, "start"))
        if end:
            pos_periodo.append("p.data_referencia <= %s")
            pos_periodo_params.append(_parse_dia(end, "end"))
        where_pos = " AND ".join(["1=1", *pos_parts, *pos_periodo])
        pos_base = [*pos_escopo, *pos_periodo_params]

        pos_mes = conn.execute(
            f"SELECT COALESCE(SUM(p.pedidos), 0) AS pedidos FROM indicadores_positivacao p WHERE {where_pos}",
            pos_base,
        ).fetchone()
        if alvo is not None:
            pos_dia = conn.execute(
                f"SELECT COALESCE(SUM(p.pedidos), 0) AS pedidos FROM indicadores_positivacao p "
                f"WHERE {where_pos} AND p.data_referencia = %s",
                [*pos_base, alvo],
            ).fetchone()
            pedidos_dia = int(num(pos_dia["pedidos"]))

    def montar(row: Any, pedidos: int) -> dict[str, Any]:
        if row is None:
            vazio = _bloco(0, 0)
            return {
                "faturamento": vazio,
                "cobertura": vazio,
                "sortimento": vazio,
                "pedidos": 0,
                "ticketMedio": 0.0,
                "margem": None,
                "semDados": True,
            }
        fat = _bloco(num(row["meta_fat"]), num(row["real_fat"]))
        return {
            "faturamento": fat,
            "cobertura": _bloco(num(row["meta_cob"]), num(row["real_cob"])),
            "sortimento": _bloco(num(row["meta_sor"]), num(row["real_sor"])),
            "pedidos": pedidos,
            "ticketMedio": round(fat["realizado"] / pedidos, 2) if pedidos else 0.0,
            # Sem margin.view o servidor devolve None — a tela nem recebe o número.
            "margem": round(num(row["margem"]), 2) if ver_margem else None,
            "semDados": False,
        }

    # Honestidade sobre a origem do número do DIA.
    #
    # `indicadores_vendedor` guarda uma linha por (data_referencia, vendedor),
    # mas a planilha que a alimenta hoje é um FECHAMENTO MENSAL: a mesma massa
    # é regravada a cada carga, mudando só a data. Quando é esse o caso, todas
    # as datas do período somam exatamente o mesmo valor — e aí o painel do DIA
    # não é a venda daquele dia, e sim o retrato do mês naquela data.
    #
    # Em vez de inventar um rateio (o escopo proíbe valor fictício), o servidor
    # avisa e a tela mostra o aviso. Assim que existir carga diária de verdade,
    # os totais passam a diferir e o aviso some sozinho.
    if len(dias_disponiveis) > 1 and len(totais_por_dia) == 1:
        aviso_carga = "snapshot_mensal"
    elif len(dias_disponiveis) <= 1:
        aviso_carga = "dia_unico"
    else:
        aviso_carga = None

    return {
        "dia": montar(dia_row, pedidos_dia),
        "mes": montar(mes_row, int(num(pos_mes["pedidos"]))),
        "referencia": {
            "diaSelecionado": alvo.isoformat() if alvo else None,
            "semanaComercial": semana_comercial(alvo) if alvo else None,
            "diasDisponiveis": [d.isoformat() for d in dias_disponiveis],
            "podeVerMargem": ver_margem,
            "avisoCarga": aviso_carga,
        },
    }


# ─────────────────────────────────────────────────────────────────────────────
# Seção 5 — TOP N clientes com alternância dia / mês / período personalizado
# ─────────────────────────────────────────────────────────────────────────────
@router.get("/insights/top-clientes")
@cached()
def top_clientes(
    ano: int | None = Query(default=None, ge=2000, le=2100),
    mes: int | None = Query(default=None, ge=1, le=12),
    start: str | None = Query(default=None, max_length=10),
    end: str | None = Query(default=None, max_length=10),
    dia: str | None = Query(default=None, max_length=10),
    equipe: str | None = Query(default=None, max_length=120),
    vendedor: str | None = Query(default=None, max_length=40),
    limit: int = Query(default=5, ge=1, le=50),
    user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    """TOP clientes da mesma tabela usada pelo Dashboard (``top_clientes``).

    ``dia`` restringe a uma data; ``start``/``end`` cobrem o período personalizado.
    """
    parts, escopo_params = _filtros_opcionais(
        user, equipe, vendedor, "tc.cod_vendedor", "COALESCE(tv.equipe, tc.equipe)"
    )
    periodo: list[str] = []
    periodo_params: list[Any] = []
    dia_ok = _parse_dia(dia)
    if dia_ok:
        periodo.append("tc.data_referencia = %s")
        periodo_params.append(dia_ok)
    else:
        if ano:
            periodo.append("tc.ano_referencia = %s")
            periodo_params.append(ano)
        if mes:
            periodo.append("tc.mes_referencia = %s")
            periodo_params.append(mes)
        if start:
            periodo.append("tc.data_referencia >= %s")
            periodo_params.append(_parse_dia(start, "start"))
        if end:
            periodo.append("tc.data_referencia <= %s")
            periodo_params.append(_parse_dia(end, "end"))

    where = " AND ".join(["1=1", *parts, *periodo])
    with get_connection() as conn:
        rows = conn.execute(
            f"""
            SELECT COALESCE(c.razao_social, tc.cliente, tc.cod_cliente) AS nome,
                   MIN(tc.cod_cliente) AS codigo,
                   BOOL_OR(COALESCE(c.e_rede, false)) AS e_rede,
                   COALESCE(tv.equipe, tc.equipe) AS equipe,
                   COALESCE(SUM(tc.venda_total_mes), 0) AS valor
            FROM top_clientes tc
            LEFT JOIN clientes c ON c.cod_cliente = tc.cod_cliente
            LEFT JOIN vendedores tv ON tv.cod_vendedor = tc.cod_vendedor
            WHERE {where}
            GROUP BY 1, 4
            HAVING COALESCE(SUM(tc.venda_total_mes), 0) <> 0
            ORDER BY valor DESC
            LIMIT %s
            """,
            [*escopo_params, *periodo_params, limit],
        ).fetchall()

    total = sum(num(r["valor"]) for r in rows)
    return {
        "escopo": "dia" if dia_ok else ("personalizado" if (start or end) and not mes else "mes"),
        "dia": dia_ok.isoformat() if dia_ok else None,
        "total": round(total, 2),
        "clientes": [
            {
                "nome": r["nome"],
                # Rede agrupa vários códigos: expor um só confundiria (mesma
                # regra já aplicada no Dashboard).
                "codigo": None if r["e_rede"] else r["codigo"],
                "equipe": r["equipe"],
                "eRede": bool(r["e_rede"]),
                "valor": round(num(r["valor"]), 2),
                "participacao": round(num(r["valor"]) / total * 100, 1) if total else 0.0,
            }
            for r in rows
        ],
    }


# ─────────────────────────────────────────────────────────────────────────────
# Seção 7 — Pesquisa inteligente
# ─────────────────────────────────────────────────────────────────────────────
@router.get("/insights/busca")
@cached(ttl=60)
def busca(
    q: str = Query(min_length=2, max_length=80),
    limit: int = Query(default=6, ge=1, le=25),
    user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    """Busca unificada por cliente, código/CNPJ, produto/SKU, fabricante,
    categoria e pedido — sempre dentro do escopo de quem pesquisa.

    Um VENDEDOR só encontra clientes e pedidos da própria carteira; um
    SUPERVISOR, os da própria equipe. Fabricante/categoria/produto são catálogo
    e por isso não carregam valor financeiro neste retorno.
    """
    termo = clean_text(q, 80)
    if len(termo) < 2:
        return {"termo": termo, "grupos": []}
    like = like_pattern(termo)
    scope = scope_filters(user)
    grupos: list[dict[str, Any]] = []

    with get_connection() as conn:
        # Clientes — restritos à carteira/equipe de quem pesquisa.
        #
        # Duas fontes unidas de propósito: a tabela de cadastro `clientes` e a
        # planilha "Top Clientes" (`top_clientes`), que é de onde vêm os nomes
        # hoje — o cadastro ainda não é alimentado nesta base. Sem a união, a
        # busca por cliente voltaria vazia mesmo havendo 4,5 mil nomes carregados.
        # O recorte por vendedor/equipe é aplicado nos DOIS lados.
        cli_params: list[Any] = [like, like, like]
        cad_scope = ""
        if scope.get("vendedor"):
            cad_scope = " AND c.cod_vendedor = %s"
            cli_params.append(scope["vendedor"])
        elif scope.get("equipe"):
            cad_scope = " AND v.equipe = %s"
            cli_params.append(scope["equipe"])

        cli_params.extend([like, like])
        top_scope = ""
        if scope.get("vendedor"):
            top_scope = " AND tc.cod_vendedor = %s"
            cli_params.append(scope["vendedor"])
        elif scope.get("equipe"):
            top_scope = " AND COALESCE(tv.equipe, tc.equipe) = %s"
            cli_params.append(scope["equipe"])
        cli_params.append(limit)

        clientes = conn.execute(
            f"""
            SELECT cod_cliente, MAX(nome) AS nome, MAX(cnpj) AS cnpj, MAX(extra) AS extra
            FROM (
                SELECT c.cod_cliente, c.razao_social AS nome, c.cnpj, NULL::text AS extra
                FROM clientes c
                LEFT JOIN vendedores v ON v.cod_vendedor = c.cod_vendedor
                WHERE (c.razao_social ILIKE %s OR c.cod_cliente ILIKE %s OR c.cnpj ILIKE %s){cad_scope}

                UNION ALL

                SELECT tc.cod_cliente, tc.cliente AS nome, NULL::text AS cnpj, tc.municipio AS extra
                FROM top_clientes tc
                LEFT JOIN vendedores tv ON tv.cod_vendedor = tc.cod_vendedor
                WHERE (tc.cliente ILIKE %s OR tc.cod_cliente ILIKE %s){top_scope}
            ) AS u
            WHERE cod_cliente IS NOT NULL
            GROUP BY cod_cliente
            ORDER BY 2 NULLS LAST
            LIMIT %s
            """,
            cli_params,
        ).fetchall()
        if clientes:
            grupos.append(
                {
                    "tipo": "cliente",
                    "rotulo": "Clientes",
                    "itens": [
                        {
                            "id": r["cod_cliente"],
                            "titulo": r["nome"] or r["cod_cliente"],
                            "detalhe": " · ".join(
                                x for x in [r["cod_cliente"], r["cnpj"], r["extra"]] if x
                            ),
                        }
                        for r in clientes
                    ],
                }
            )

        produtos = conn.execute(
            """
            SELECT cod_produto,
                   MAX(produto) AS produto,
                   MAX(fabricante) AS fabricante,
                   MAX(categoria) AS categoria
            FROM sortimento
            WHERE cod_produto ILIKE %s OR produto ILIKE %s
            GROUP BY cod_produto
            ORDER BY 2 NULLS LAST
            LIMIT %s
            """,
            [like, like, limit],
        ).fetchall()
        if produtos:
            grupos.append(
                {
                    "tipo": "produto",
                    "rotulo": "Produtos / SKU",
                    "itens": [
                        {
                            "id": r["cod_produto"],
                            "titulo": r["produto"] or r["cod_produto"],
                            "detalhe": " · ".join(
                                x for x in [r["cod_produto"], r["fabricante"], r["categoria"]] if x
                            ),
                            "fabricante": r["fabricante"],
                        }
                        for r in produtos
                    ],
                }
            )

        fabricantes = conn.execute(
            "SELECT DISTINCT fabricante FROM sortimento "
            "WHERE fabricante ILIKE %s AND fabricante IS NOT NULL ORDER BY 1 LIMIT %s",
            [like, limit],
        ).fetchall()
        if fabricantes:
            grupos.append(
                {
                    "tipo": "fabricante",
                    "rotulo": "Fabricantes",
                    "itens": [
                        {"id": r["fabricante"], "titulo": r["fabricante"], "detalhe": "Ver desempenho"}
                        for r in fabricantes
                    ],
                }
            )

        categorias = conn.execute(
            "SELECT categoria, MAX(fabricante) AS fabricante FROM sortimento "
            "WHERE categoria ILIKE %s AND categoria IS NOT NULL GROUP BY categoria ORDER BY 1 LIMIT %s",
            [like, limit],
        ).fetchall()
        if categorias:
            grupos.append(
                {
                    "tipo": "categoria",
                    "rotulo": "Categorias",
                    "itens": [
                        {
                            "id": r["categoria"],
                            "titulo": r["categoria"],
                            "detalhe": r["fabricante"] or "",
                            "fabricante": r["fabricante"],
                        }
                        for r in categorias
                    ],
                }
            )

        ped_parts = ["(ve.numero_pedido ILIKE %s OR c.razao_social ILIKE %s)"]
        ped_params: list[Any] = [like, like]
        if scope.get("vendedor"):
            ped_parts.append("ve.cod_vendedor = %s")
            ped_params.append(scope["vendedor"])
        elif scope.get("equipe"):
            ped_parts.append("vd.equipe = %s")
            ped_params.append(scope["equipe"])
        pedidos = conn.execute(
            f"""
            SELECT ve.numero_pedido, ve.data_emissao, ve.valor_total,
                   COALESCE(c.razao_social, ve.cod_cliente) AS cliente
            FROM vendas ve
            LEFT JOIN clientes c ON c.cod_cliente = ve.cod_cliente
            LEFT JOIN vendedores vd ON vd.cod_vendedor = ve.cod_vendedor
            WHERE {" AND ".join(ped_parts)}
            ORDER BY ve.data_emissao DESC
            LIMIT %s
            """,
            [*ped_params, limit],
        ).fetchall()
        if pedidos:
            grupos.append(
                {
                    "tipo": "pedido",
                    "rotulo": "Pedidos",
                    "itens": [
                        {
                            "id": r["numero_pedido"],
                            "titulo": f"Pedido {r['numero_pedido']}",
                            "detalhe": (
                                f"{r['cliente']} · "
                                f"{r['data_emissao'].strftime('%d/%m/%Y') if r['data_emissao'] else ''}"
                            ).strip(" ·"),
                            "valor": round(num(r["valor_total"]), 2),
                        }
                        for r in pedidos
                    ],
                }
            )

    return {"termo": termo, "grupos": grupos}


# ─────────────────────────────────────────────────────────────────────────────
# Seção 6 — Desempenho por fabricante / categoria
# ─────────────────────────────────────────────────────────────────────────────
def _periodo_fabricante(
    ano: int | None, mes: int | None, start: str | None, end: str | None
) -> tuple[list[str], list[Any]]:
    parts: list[str] = []
    params: list[Any] = []
    if ano:
        parts.append("f.ano_referencia = %s")
        params.append(ano)
    if mes:
        parts.append("f.mes_referencia = %s")
        params.append(mes)
    if start:
        parts.append("f.data_referencia >= %s")
        params.append(_parse_dia(start, "start"))
    if end:
        parts.append("f.data_referencia <= %s")
        params.append(_parse_dia(end, "end"))
    return parts, params


@router.get("/insights/fabricantes")
@cached()
def fabricantes_resumo(
    ano: int | None = Query(default=None, ge=2000, le=2100),
    mes: int | None = Query(default=None, ge=1, le=12),
    start: str | None = Query(default=None, max_length=10),
    end: str | None = Query(default=None, max_length=10),
    user: dict[str, Any] = Depends(require_permission("manufacturers.view")),
) -> list[dict[str, Any]]:
    """Fabricantes com faturamento, cobertura, margem autorizada e nº de SKUs."""
    ver_margem = has_permission(user, "margin.view")
    escopo_parts, escopo_params = _escopo_sql(user, "f.cod_vendedor", "v.equipe")
    per_parts, per_params = _periodo_fabricante(ano, mes, start, end)
    where = " AND ".join(["1=1", *escopo_parts, *per_parts])

    with get_connection() as conn:
        rows = conn.execute(
            f"""
            SELECT f.fabricante,
                   COALESCE(SUM(f.meta), 0) AS meta,
                   COALESCE(SUM(f.realizado), 0) AS realizado,
                   COALESCE(SUM(f.cobertura), 0) AS meta_cob,
                   COALESCE(SUM(f.realizado_cobertura), 0) AS real_cob,
                   COALESCE(AVG(NULLIF(f.pct_margem, 0)), 0) AS margem
            FROM indicadores_fabricante f
            LEFT JOIN vendedores v ON v.cod_vendedor = f.cod_vendedor
            WHERE {where}
            GROUP BY f.fabricante
            HAVING COALESCE(SUM(f.meta), 0) > 0 OR COALESCE(SUM(f.realizado), 0) > 0
            ORDER BY realizado DESC
            """,
            [*escopo_params, *per_params],
        ).fetchall()
        skus = conn.execute(
            """
            SELECT fabricante,
                   COUNT(DISTINCT cod_produto) AS skus,
                   COUNT(DISTINCT categoria) AS categorias
            FROM sortimento WHERE fabricante IS NOT NULL GROUP BY fabricante
            """
        ).fetchall()

    mapa = {r["fabricante"]: r for r in skus}
    total = sum(num(r["realizado"]) for r in rows) or 1
    saida: list[dict[str, Any]] = []
    for r in rows:
        extra = mapa.get(r["fabricante"]) or {}
        meta, realizado = num(r["meta"]), num(r["realizado"])
        meta_cob, real_cob = num(r["meta_cob"]), num(r["real_cob"])
        saida.append(
            {
                "fabricante": r["fabricante"],
                "meta": round(meta, 2),
                "realizado": round(realizado, 2),
                "pct": round(realizado / meta * 100, 2) if meta else 0.0,
                "metaCobertura": round(meta_cob, 2),
                "realizadoCobertura": round(real_cob, 2),
                "pctCobertura": round(real_cob / meta_cob * 100, 2) if meta_cob else 0.0,
                "margem": round(num(r["margem"]), 2) if ver_margem else None,
                "skus": int(extra.get("skus") or 0),
                "categorias": int(extra.get("categorias") or 0),
                "participacao": round(realizado / total * 100, 1),
            }
        )
    return saida


@router.get("/insights/fabricante-drill")
@cached()
def fabricante_drill(
    fabricante: str = Query(max_length=160),
    categoria: str | None = Query(default=None, max_length=160),
    ano: int | None = Query(default=None, ge=2000, le=2100),
    mes: int | None = Query(default=None, ge=1, le=12),
    start: str | None = Query(default=None, max_length=10),
    end: str | None = Query(default=None, max_length=10),
    user: dict[str, Any] = Depends(require_permission("manufacturers.view")),
) -> dict[str, Any]:
    """Navegação Fabricante → Categoria → Produto/SKU → Cliente → Venda.

    Cada nível devolve só o que a base realmente tem hoje:

    * categorias e produtos/SKUs vêm da Lista de Sortimento importada;
    * clientes vêm de ``top_clientes`` e as vendas de ``vendas``, respeitando o escopo.

    Quando um nível ainda não tem carga, ele volta vazio — nada é preenchido com
    valor fictício. ``fontes`` diz de onde cada bloco veio.
    """
    fab = clean_text(fabricante, 160)
    ver_margem = has_permission(user, "margin.view")

    escopo_parts, escopo_params = _escopo_sql(user, "f.cod_vendedor", "v.equipe")
    fab_parts = [*escopo_parts, "f.fabricante = %s"]
    fab_params = [*escopo_params, fab]
    per_parts, per_params = _periodo_fabricante(ano, mes, start, end)

    with get_connection() as conn:
        resumo = conn.execute(
            f"""
            SELECT COALESCE(SUM(f.meta), 0) AS meta,
                   COALESCE(SUM(f.realizado), 0) AS realizado,
                   COALESCE(SUM(f.cobertura), 0) AS meta_cob,
                   COALESCE(SUM(f.realizado_cobertura), 0) AS real_cob,
                   COALESCE(AVG(NULLIF(f.pct_margem, 0)), 0) AS margem
            FROM indicadores_fabricante f
            LEFT JOIN vendedores v ON v.cod_vendedor = f.cod_vendedor
            WHERE {" AND ".join(["1=1", *fab_parts, *per_parts])}
            """,
            [*fab_params, *per_params],
        ).fetchone()

        # Histórico ignora ano/mês de propósito: é a evolução completa do fabricante.
        historico = conn.execute(
            f"""
            SELECT f.ano_referencia AS ano, f.mes_referencia AS mes,
                   COALESCE(SUM(f.meta), 0) AS meta,
                   COALESCE(SUM(f.realizado), 0) AS realizado
            FROM indicadores_fabricante f
            LEFT JOIN vendedores v ON v.cod_vendedor = f.cod_vendedor
            WHERE {" AND ".join(["1=1", *fab_parts])}
              AND f.ano_referencia IS NOT NULL AND f.mes_referencia IS NOT NULL
            GROUP BY 1, 2 ORDER BY 1, 2
            """,
            fab_params,
        ).fetchall()

        vendedores = conn.execute(
            f"""
            SELECT f.cod_vendedor,
                   COALESCE(MAX(v.nome), f.cod_vendedor) AS nome,
                   COALESCE(MAX(v.equipe), '—') AS equipe,
                   COALESCE(SUM(f.meta), 0) AS meta,
                   COALESCE(SUM(f.realizado), 0) AS realizado
            FROM indicadores_fabricante f
            LEFT JOIN vendedores v ON v.cod_vendedor = f.cod_vendedor
            WHERE {" AND ".join(["1=1", *fab_parts, *per_parts])}
            GROUP BY f.cod_vendedor
            HAVING COALESCE(SUM(f.realizado), 0) <> 0 OR COALESCE(SUM(f.meta), 0) <> 0
            ORDER BY realizado DESC LIMIT 100
            """,
            [*fab_params, *per_params],
        ).fetchall()

        categorias = conn.execute(
            """
            SELECT COALESCE(categoria, 'Sem categoria') AS categoria,
                   COUNT(DISTINCT cod_produto) AS skus
            FROM sortimento WHERE fabricante = %s
            GROUP BY 1 ORDER BY skus DESC
            """,
            [fab],
        ).fetchall()

        prod_parts = ["fabricante = %s"]
        prod_params: list[Any] = [fab]
        if categoria:
            prod_parts.append("COALESCE(categoria, 'Sem categoria') = %s")
            prod_params.append(clean_text(categoria, 160))
        produtos = conn.execute(
            f"""
            SELECT cod_produto,
                   MAX(produto) AS produto,
                   MAX(COALESCE(categoria, 'Sem categoria')) AS categoria,
                   MAX(linha) AS linha
            FROM sortimento WHERE {" AND ".join(prod_parts)}
            GROUP BY cod_produto ORDER BY 2 NULLS LAST LIMIT 500
            """,
            prod_params,
        ).fetchall()

        # Clientes que compraram do fabricante no período, dentro do escopo.
        cli_parts, cli_params = _escopo_sql(user, "tc.cod_vendedor", "tv.equipe")
        cli_parts.append("tc.fabricante = %s")
        cli_params.append(fab)
        if ano:
            cli_parts.append("tc.ano_referencia = %s")
            cli_params.append(ano)
        if mes:
            cli_parts.append("tc.mes_referencia = %s")
            cli_params.append(mes)
        try:
            clientes = conn.execute(
                f"""
                SELECT COALESCE(c.razao_social, tc.cliente, tc.cod_cliente) AS nome,
                       MIN(tc.cod_cliente) AS codigo,
                       COALESCE(SUM(tc.venda_total_mes), 0) AS valor
                FROM top_clientes tc
                LEFT JOIN clientes c ON c.cod_cliente = tc.cod_cliente
                LEFT JOIN vendedores tv ON tv.cod_vendedor = tc.cod_vendedor
                WHERE {" AND ".join(["1=1", *cli_parts])}
                GROUP BY 1 HAVING COALESCE(SUM(tc.venda_total_mes), 0) <> 0
                ORDER BY valor DESC LIMIT 50
                """,
                cli_params,
            ).fetchall()
        except Exception:
            # Nem toda carga de `top_clientes` traz a coluna `fabricante`:
            # sem ela o nível "cliente" fica vazio em vez de derrubar a tela.
            conn.rollback()
            clientes = []

    meta, realizado = num(resumo["meta"]), num(resumo["realizado"])
    return {
        "fabricante": fab,
        "categoriaSelecionada": clean_optional(categoria, 160),
        "resumo": {
            **_bloco(meta, realizado),
            "metaCobertura": round(num(resumo["meta_cob"]), 2),
            "realizadoCobertura": round(num(resumo["real_cob"]), 2),
            "margem": round(num(resumo["margem"]), 2) if ver_margem else None,
            "skus": len(produtos),
            "categorias": len(categorias),
        },
        "categorias": [{"categoria": r["categoria"], "skus": int(r["skus"] or 0)} for r in categorias],
        "produtos": [
            {
                "codProduto": r["cod_produto"],
                "produto": r["produto"],
                "categoria": r["categoria"],
                "linha": r["linha"],
            }
            for r in produtos
        ],
        "clientes": [
            {"nome": r["nome"], "codigo": r["codigo"], "valor": round(num(r["valor"]), 2)} for r in clientes
        ],
        "vendedores": [
            {
                "codVendedor": r["cod_vendedor"],
                "nome": r["nome"],
                "equipe": r["equipe"],
                "meta": round(num(r["meta"]), 2),
                "realizado": round(num(r["realizado"]), 2),
            }
            for r in vendedores
        ],
        "historico": [
            {
                "ano": r["ano"],
                "mes": r["mes"],
                "meta": round(num(r["meta"]), 2),
                "realizado": round(num(r["realizado"]), 2),
            }
            for r in historico
        ],
        "fontes": {
            "valores": "Indicadores por Fabricante",
            "categorias": "Lista de Sortimento",
            "produtos": "Lista de Sortimento",
            "clientes": "Top Clientes",
        },
    }


# ─────────────────────────────────────────────────────────────────────────────
# Seção 9 — Comparativos e simulações (exclusivo de gerência)
# ─────────────────────────────────────────────────────────────────────────────
@router.get("/insights/comparativo")
@cached()
def comparativo(
    anoA: int = Query(ge=2000, le=2100),
    anoB: int = Query(ge=2000, le=2100),
    mesA: int | None = Query(default=None, ge=1, le=12),
    mesB: int | None = Query(default=None, ge=1, le=12),
    equipe: str | None = Query(default=None, max_length=120),
    vendedor: str | None = Query(default=None, max_length=40),
    user: dict[str, Any] = Depends(require_permission("comparisons.view")),
) -> dict[str, Any]:
    """Compara dois períodos: atual, anterior, diferença absoluta e variação %.

    Somente LEITURA — as simulações feitas na tela são calculadas no navegador e
    não gravam nada: resultados oficiais e histórico ficam exatamente como estão.
    """
    ver_margem = has_permission(user, "margin.view")
    parts, base_params = _filtros_opcionais(user, equipe, vendedor, "iv.cod_vendedor", "v.equipe")

    def medir(conn: Any, ano: int, mes: int | None) -> dict[str, Any]:
        cond = [*parts, "iv.ano_referencia = %s"]
        params: list[Any] = [*base_params, ano]
        if mes:
            cond.append("iv.mes_referencia = %s")
            params.append(mes)
        row = conn.execute(
            f"""
            SELECT COALESCE(SUM(iv.meta_faturamento), 0) AS meta,
                   COALESCE(SUM(iv.realizado_faturamento), 0) AS realizado,
                   COALESCE(SUM(iv.meta_cobertura), 0) AS meta_cob,
                   COALESCE(SUM(iv.realizado_cobertura), 0) AS real_cob,
                   COALESCE(SUM(iv.meta_sortimento), 0) AS meta_sor,
                   COALESCE(SUM(iv.realizado_sortimento), 0) AS real_sor,
                   COALESCE(AVG(NULLIF(iv.pct_margem, 0)), 0) AS margem
            FROM indicadores_vendedor iv
            LEFT JOIN vendedores v ON v.cod_vendedor = iv.cod_vendedor
            WHERE {" AND ".join(["1=1", *cond])}
            """,
            params,
        ).fetchone()
        inv = conn.execute(
            """
            SELECT COALESCE(SUM(investimento_realizado), 0) AS realizado,
                   COALESCE(SUM(investimento_previsto), 0) AS previsto
            FROM eventos_comerciais
            WHERE EXTRACT(YEAR FROM data_inicio) = %s
              AND (%s::int IS NULL OR EXTRACT(MONTH FROM data_inicio) = %s)
            """,
            [ano, mes, mes],
        ).fetchone()
        return {
            "faturamento": num(row["realizado"]),
            "meta": num(row["meta"]),
            "cobertura": num(row["real_cob"]),
            "metaCobertura": num(row["meta_cob"]),
            "sortimento": num(row["real_sor"]),
            "metaSortimento": num(row["meta_sor"]),
            "margem": num(row["margem"]) if ver_margem else None,
            "investimentoPrevisto": num(inv["previsto"]),
            "investimentoRealizado": num(inv["realizado"]),
        }

    with get_connection() as conn:
        atual = medir(conn, anoA, mesA)
        anterior = medir(conn, anoB, mesB)

    def delta(a: float | None, b: float | None) -> dict[str, Any]:
        if a is None or b is None:
            return {"atual": None, "anterior": None, "diferenca": None, "variacao": None}
        dif = a - b
        return {
            "atual": round(a, 2),
            "anterior": round(b, 2),
            "diferenca": round(dif, 2),
            "variacao": round(dif / b * 100, 2) if b else None,
        }

    return {
        "periodoA": {"ano": anoA, "mes": mesA},
        "periodoB": {"ano": anoB, "mes": mesB},
        "indicadores": {chave: delta(atual[chave], anterior[chave]) for chave in atual},
        "podeSimular": has_permission(user, "simulations.run"),
        "podeVerMargem": ver_margem,
    }


# ─────────────────────────────────────────────────────────────────────────────
# Seção 8 — Calendário comercial e semanas SAR
# ─────────────────────────────────────────────────────────────────────────────
def _linhas_do_mes(ano: int, mes: int) -> list[dict[str, Any]]:
    """Linhas semanais exibidas no mês (domingo a sábado), com o nº do ciclo."""
    primeiro = date(ano, mes, 1)
    inicio = domingo_da_semana(primeiro)
    proximo = date(ano + 1, 1, 1) if mes == 12 else date(ano, mes + 1, 1)
    linhas: list[dict[str, Any]] = []
    cursor = inicio
    while cursor < proximo:
        linhas.append(
            {
                "inicio": cursor.isoformat(),
                "fim": (cursor + timedelta(days=6)).isoformat(),
                "semanaComercial": semana_comercial(cursor),
            }
        )
        cursor += timedelta(days=7)
    return linhas


@router.get("/insights/calendario")
def calendario(
    ano: int = Query(ge=2000, le=2100),
    mes: int = Query(ge=1, le=12),
    user: dict[str, Any] = Depends(require_permission("calendar.view")),
) -> dict[str, Any]:
    """Eventos do mês + numeração contínua das semanas do ciclo comercial."""
    linhas = _linhas_do_mes(ano, mes)
    inicio = date.fromisoformat(linhas[0]["inicio"])
    fim = date.fromisoformat(linhas[-1]["fim"])

    scope = scope_filters(user)
    parts = ["(e.data_inicio <= %s AND COALESCE(e.data_fim, e.data_inicio) >= %s)"]
    params: list[Any] = [fim, inicio]
    # Supervisor/Vendedor só veem o que é da equipe/deles ou aberto a todos.
    if scope.get("equipe"):
        parts.append("(e.equipe IS NULL OR e.equipe = %s)")
        params.append(scope["equipe"])
    if scope.get("vendedor"):
        parts.append("(e.cod_vendedor IS NULL OR e.cod_vendedor = %s)")
        params.append(scope["vendedor"])

    with get_connection() as conn:
        rows = conn.execute(
            f"SELECT e.* FROM eventos_comerciais e WHERE {' AND '.join(parts)} ORDER BY e.data_inicio, e.id",
            params,
        ).fetchall()

    return {
        "ano": ano,
        "mes": mes,
        "semanas": linhas,
        "podeEditar": has_permission(user, "calendar.edit"),
        "eventos": [
            {
                "id": r["id"],
                "titulo": r["titulo"],
                "descricao": r["descricao"],
                "tipo": r["tipo"],
                "dataInicio": r["data_inicio"].isoformat() if r["data_inicio"] else None,
                "dataFim": r["data_fim"].isoformat() if r["data_fim"] else None,
                "fabricante": r["fabricante"],
                "categoria": r["categoria"],
                "equipe": r["equipe"],
                "codVendedor": r["cod_vendedor"],
                "responsavel": r["responsavel"],
                "potencialFaturamento": num(r["potencial_faturamento"]),
                "investimentoPrevisto": num(r["investimento_previsto"]),
                "faturamentoRealizado": num(r["faturamento_realizado"]),
                "investimentoRealizado": num(r["investimento_realizado"]),
                "status": r["status"],
                "semanaComercial": semana_comercial(r["data_inicio"]) if r["data_inicio"] else None,
            }
            for r in rows
        ],
    }


_TIPOS_EVENTO = {"campanha", "oportunidade", "acao_fabricante", "reuniao", "outro"}
_STATUS_EVENTO = {"planejado", "em_andamento", "concluido", "cancelado"}


def _evento_payload(body: dict[str, Any]) -> dict[str, Any]:
    titulo = clean_text(body.get("titulo"), 200)
    if not titulo:
        raise HTTPException(status_code=400, detail="Informe o título do evento.")
    inicio = _parse_dia(body.get("dataInicio"), "dataInicio")
    if inicio is None:
        raise HTTPException(status_code=400, detail="Informe a data inicial do evento.")
    fim = _parse_dia(body.get("dataFim") or None, "dataFim")
    if fim and fim < inicio:
        raise HTTPException(status_code=400, detail="A data final não pode ser anterior à inicial.")
    tipo = clean_text(body.get("tipo") or "campanha", 40)
    status_evento = clean_text(body.get("status") or "planejado", 30)

    def numero(chave: str) -> float | None:
        valor = body.get(chave)
        if valor in (None, ""):
            return None
        try:
            return round(float(valor), 2)
        except (TypeError, ValueError) as exc:
            raise HTTPException(status_code=400, detail=f'Valor numérico inválido em "{chave}".') from exc

    return {
        "titulo": titulo,
        "descricao": clean_optional(body.get("descricao"), 2000),
        "tipo": tipo if tipo in _TIPOS_EVENTO else "campanha",
        "data_inicio": inicio,
        "data_fim": fim,
        "fabricante": clean_optional(body.get("fabricante"), 160),
        "categoria": clean_optional(body.get("categoria"), 160),
        "equipe": clean_optional(body.get("equipe"), 160),
        "cod_vendedor": clean_optional(body.get("codVendedor"), 40),
        "responsavel": clean_optional(body.get("responsavel"), 200),
        "potencial_faturamento": numero("potencialFaturamento"),
        "investimento_previsto": numero("investimentoPrevisto"),
        "faturamento_realizado": numero("faturamentoRealizado"),
        "investimento_realizado": numero("investimentoRealizado"),
        "status": status_evento if status_evento in _STATUS_EVENTO else "planejado",
    }


@router.post("/insights/calendario/eventos", status_code=201)
def criar_evento(
    body: dict[str, Any] = Body(...),
    user: dict[str, Any] = Depends(require_permission("calendar.edit")),
) -> dict[str, Any]:
    dados = _evento_payload(body)
    colunas = ", ".join(dados.keys())
    marcas = ", ".join(["%s"] * len(dados))
    with get_connection() as conn:
        row = conn.execute(
            f"INSERT INTO eventos_comerciais ({colunas}, criado_por) VALUES ({marcas}, %s) RETURNING id",
            [*dados.values(), str(user["id"])],
        ).fetchone()
        conn.commit()
    invalidate_all()
    return {"ok": True, "id": row["id"]}


@router.patch("/insights/calendario/eventos/{evento_id}")
def atualizar_evento(
    evento_id: int,
    body: dict[str, Any] = Body(...),
    _user: dict[str, Any] = Depends(require_permission("calendar.edit")),
) -> dict[str, Any]:
    dados = _evento_payload(body)
    sets = ", ".join(f"{c} = %s" for c in dados)
    with get_connection() as conn:
        row = conn.execute(
            f"UPDATE eventos_comerciais SET {sets}, atualizado_em = now() WHERE id = %s RETURNING id",
            [*dados.values(), evento_id],
        ).fetchone()
        conn.commit()
    if not row:
        raise HTTPException(status_code=404, detail="Evento não encontrado.")
    invalidate_all()
    return {"ok": True, "id": row["id"]}


@router.delete("/insights/calendario/eventos/{evento_id}")
def remover_evento(
    evento_id: int,
    _user: dict[str, Any] = Depends(require_permission("calendar.edit")),
) -> dict[str, bool]:
    with get_connection() as conn:
        row = conn.execute(
            "DELETE FROM eventos_comerciais WHERE id = %s RETURNING id", [evento_id]
        ).fetchone()
        conn.commit()
    if not row:
        raise HTTPException(status_code=404, detail="Evento não encontrado.")
    invalidate_all()
    return {"ok": True}


# ─────────────────────────────────────────────────────────────────────────────
# Seção 4 — Histórico de sessões
# ─────────────────────────────────────────────────────────────────────────────
@router.get("/insights/sessoes")
def sessoes(
    limit: int = Query(default=50, ge=1, le=200),
    usuario_id: str | None = Query(default=None, max_length=40),
    user: dict[str, Any] = Depends(get_current_user),
) -> list[dict[str, Any]]:
    """Histórico de login/logout. Cada um vê o próprio; o ADMIN vê todos."""
    parts = ["1=1"]
    params: list[Any] = []
    if user["role"] == "ADMIN":
        if usuario_id:
            parts.append("usuario_id = %s")
            params.append(clean_text(usuario_id, 40))
    else:
        # Nenhum perfil além do ADMIN consegue ler sessão de outra pessoa,
        # mesmo passando ?usuario_id= na URL.
        parts.append("usuario_id = %s")
        params.append(str(user["id"]))
    params.append(limit)

    with get_connection() as conn:
        rows = conn.execute(
            f"""
            SELECT id, usuario_id, usuario_email, remember_me, ip, user_agent,
                   login_em, logout_em, duracao_seg, motivo_fim
            FROM sessoes_log WHERE {" AND ".join(parts)}
            ORDER BY login_em DESC LIMIT %s
            """,
            params,
        ).fetchall()
    return [
        {
            "id": r["id"],
            "usuarioId": r["usuario_id"],
            "usuarioEmail": r["usuario_email"],
            "rememberMe": bool(r["remember_me"]),
            "ip": r["ip"],
            "userAgent": r["user_agent"],
            "loginEm": r["login_em"].isoformat() if r["login_em"] else None,
            "logoutEm": r["logout_em"].isoformat() if r["logout_em"] else None,
            "duracaoSeg": r["duracao_seg"],
            "motivoFim": r["motivo_fim"],
        }
        for r in rows
    ]
