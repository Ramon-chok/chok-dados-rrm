from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query

from app.cache import cached
from app.db import get_connection
from app.sanitize import like_pattern
from app.security import ROLES_VISAO_GERAL, get_current_user
from app.services import num, scope_filters
from app.routers.metas import aplicar, metas_definidas

router = APIRouter(tags=["analytics"])


def _resolve_filters(
    user: dict[str, Any], equipe_param: str | None, vendedor_param: str | None
) -> dict[str, str | None]:
    """Combina o escopo obrigatório do usuário com os filtros opcionais de
    equipe/vendedor escolhidos na tela. ADMIN/GERENTE podem filtrar livremente
    por equipe e/ou vendedor; SUPERVISOR tem a equipe travada na própria e só
    pode filtrar por vendedor; VENDEDOR sempre vê só o próprio código,
    ignorando qualquer filtro enviado.
    """
    role = user["role"]
    if role == "VENDEDOR":
        return {"equipe": None, "vendedor": user.get("seller_code")}
    if role == "SUPERVISOR":
        return {"equipe": user.get("team"), "vendedor": vendedor_param}
    return {"equipe": equipe_param, "vendedor": vendedor_param}


def _period_clause(
    alias: str,
    ano: int | None,
    mes: int | None,
    start: str | None,
    end: str | None,
    params: list[Any],
) -> str:
    clauses: list[str] = []
    if ano:
        clauses.append(f"{alias}.ano_referencia = %s")
        params.append(ano)
    if mes:
        clauses.append(f"{alias}.mes_referencia = %s")
        params.append(mes)
    if start:
        clauses.append(f"{alias}.data_referencia >= %s")
        params.append(start)
    if end:
        clauses.append(f"{alias}.data_referencia <= %s")
        params.append(end)
    return (" AND " + " AND ".join(clauses)) if clauses else ""


@router.get("/dashboard")
@cached()
def dashboard(
    ano: int | None = None,
    mes: int | None = None,
    start: str | None = None,
    end: str | None = None,
    equipe: str | None = None,
    vendedor: str | None = None,
    user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    scope = _resolve_filters(user, equipe, vendedor)
    eff_equipe = scope.get("equipe")
    eff_vendedor = scope.get("vendedor")

    # indicadores_vendedor não tem coluna equipe — precisa de join com
    # vendedores para poder restringir por equipe (ex.: Supervisor).
    join_vend_scope = " JOIN vendedores vsc ON vsc.cod_vendedor = iv.cod_vendedor" if eff_equipe else ""

    params: list[Any] = []
    where_parts = ["1=1"]
    where_parts_sql = _period_clause("iv", ano, mes, start, end, params)
    if where_parts_sql:
        where_parts.append(where_parts_sql.replace(" AND ", "", 1))
    if eff_equipe:
        where_parts.append("vsc.equipe = %s")
        params.append(eff_equipe)
    if eff_vendedor:
        where_parts.append("iv.cod_vendedor = %s")
        params.append(eff_vendedor)
    where = "WHERE " + " AND ".join(where_parts)

    with get_connection() as conn:
        kpis = conn.execute(
            f"""
            SELECT
              COALESCE(SUM(iv.meta_faturamento), 0) AS meta,
              COALESCE(SUM(iv.realizado_faturamento), 0) AS realizado,
              COALESCE(AVG(iv.pct_margem), 0) AS margem,
              COALESCE(SUM(iv.meta_cobertura), 0) AS meta_cobertura,
              COALESCE(SUM(iv.realizado_cobertura), 0) AS realizado_cobertura,
              COALESCE(SUM(iv.meta_sortimento), 0) AS meta_sortimento,
              COALESCE(SUM(iv.realizado_sortimento), 0) AS realizado_sortimento
            FROM indicadores_vendedor iv
            {join_vend_scope}
            {where}
            """,
            params,
        ).fetchone()

        serie_params: list[Any] = []
        serie_where_parts = ["1=1"]
        serie_period = _period_clause("iv", ano, None, start, end, serie_params)
        if serie_period:
            serie_where_parts.append(serie_period.replace(" AND ", "", 1))
        if eff_equipe:
            serie_where_parts.append("vsc.equipe = %s")
            serie_params.append(eff_equipe)
        if eff_vendedor:
            serie_where_parts.append("iv.cod_vendedor = %s")
            serie_params.append(eff_vendedor)
        serie = conn.execute(
            f"""
            SELECT iv.ano_referencia, iv.mes_referencia,
                   COALESCE(SUM(iv.meta_faturamento), 0) AS meta,
                   COALESCE(SUM(iv.realizado_faturamento), 0) AS realizado,
                   COALESCE(AVG(iv.pct_margem), 0) AS margem
            FROM indicadores_vendedor iv
            {join_vend_scope}
            WHERE {" AND ".join(serie_where_parts)}
            GROUP BY iv.ano_referencia, iv.mes_referencia
            ORDER BY iv.ano_referencia, iv.mes_referencia
            """,
            serie_params,
        ).fetchall()

        # indicadores_fabricante tem uma coluna "equipe" própria, mas ela vem
        # da planilha de Categorias com valores que não são o nome real da
        # equipe (ex.: códigos numéricos) — não dá pra confiar nela para
        # restringir por equipe. Assim como em indicadores_vendedor, resolve
        # equipe via JOIN com vendedores (fonte confiável, mesma tabela usada
        # nos filtros de Equipe/Vendedor da tela).
        fab_join_scope = " JOIN vendedores vf ON vf.cod_vendedor = f.cod_vendedor" if eff_equipe else ""
        fab_params: list[Any] = []
        fab_parts = ["1=1"]
        fab_period = _period_clause("f", ano, mes, start, end, fab_params)
        if fab_period:
            fab_parts.append(fab_period.replace(" AND ", "", 1))
        if eff_vendedor:
            fab_parts.append("f.cod_vendedor = %s")
            fab_params.append(eff_vendedor)
        if eff_equipe:
            fab_parts.append("vf.equipe = %s")
            fab_params.append(eff_equipe)
        fabricantes = conn.execute(
            f"""
            SELECT f.fabricante,
                   COALESCE(SUM(f.meta), 0) AS meta,
                   COALESCE(SUM(f.realizado), 0) AS realizado,
                   COALESCE(SUM(f.cobertura), 0) AS meta_cobertura,
                   COALESCE(SUM(f.realizado_cobertura), 0) AS realizado_cobertura,
                   COALESCE(AVG(f.pct_margem), 0) AS pct_margem
            FROM indicadores_fabricante f
            {fab_join_scope}
            WHERE {" AND ".join(fab_parts)}
            GROUP BY f.fabricante
            -- Só faz sentido analisar fabricante com meta definida — sem
            -- meta não há o que comparar, e some da listagem/gráfico. Mas se
            -- houve venda (realizado > 0) mesmo sem meta cadastrada, mantém
            -- visível — é dado real que não pode ficar escondido.
            HAVING COALESCE(SUM(f.meta), 0) > 0 OR COALESCE(SUM(f.realizado), 0) > 0
            ORDER BY SUM(f.realizado) DESC
            """,
            fab_params,
        ).fetchall()

        # Top Clientes vem da planilha "Top Clientes" (aba "top_clientes",
        # venda total no mês por cliente) — não da tabela `vendas` (que não
        # tem importação implementada ainda). tc.equipe vem junto na
        # importação, mas — como em indicadores_fabricante — prefere-se a
        # equipe resolvida via `vendedores` (fonte confiável) quando existir,
        # com fallback para o valor já importado.
        top_params: list[Any] = []
        top_parts = ["1=1"]
        top_period = _period_clause("tc", ano, mes, start, end, top_params)
        if top_period:
            top_parts.append(top_period.replace(" AND ", "", 1))
        if eff_vendedor:
            top_parts.append("tc.cod_vendedor = %s")
            top_params.append(eff_vendedor)
        if eff_equipe:
            top_parts.append("COALESCE(tv.equipe, tc.equipe) = %s")
            top_params.append(eff_equipe)
        top_clientes = conn.execute(
            f"""
            SELECT COALESCE(c.razao_social, tc.cliente, tc.cod_cliente) AS nome,
                   COALESCE(tv.equipe, tc.equipe) AS equipe,
                   -- Uma "rede" agrupa vários cod_cliente sob o mesmo nome
                   -- comercial: se qualquer código do grupo estiver marcado
                   -- como rede, o grupo inteiro é tratado como rede (não faz
                   -- sentido expor um único código nesse caso).
                   BOOL_OR(COALESCE(c.e_rede, false)) AS e_rede,
                   MIN(tc.cod_cliente) AS codigo,
                   COALESCE(SUM(tc.venda_total_mes), 0) AS valor
            FROM top_clientes tc
            LEFT JOIN clientes c ON c.cod_cliente = tc.cod_cliente
            LEFT JOIN vendedores tv ON tv.cod_vendedor = tc.cod_vendedor
            WHERE {" AND ".join(top_parts)}
            GROUP BY 1, 2
            ORDER BY valor DESC
            LIMIT 10
            """,
            top_params,
        ).fetchall()

        # Cobertura geral e sortimento definidos na tela vencem os importados.
        definidas = metas_definidas(conn, ano, mes, eff_equipe, eff_vendedor)

    def pct(realizado_v: float, meta_v: float) -> float:
        return round((realizado_v / meta_v * 100) if meta_v else 0, 1)

    meta = num(kpis["meta"])
    realizado = num(kpis["realizado"])
    gap = realizado - meta
    atingimento = (realizado / meta * 100) if meta else 0

    meta_cobertura = aplicar(num(kpis["meta_cobertura"]), definidas["meta_cobertura"])
    realizado_cobertura = num(kpis["realizado_cobertura"])
    meta_sortimento = aplicar(num(kpis["meta_sortimento"]), definidas["meta_sortimento"])
    realizado_sortimento = num(kpis["realizado_sortimento"])

    return {
        "kpis": {
            "meta": meta,
            "realizado": realizado,
            "gap": gap,
            "atingimento": round(atingimento, 2),
            "margem": round(num(kpis["margem"]), 2),
            "metaCobertura": meta_cobertura,
            "realizadoCobertura": realizado_cobertura,
            "gapCobertura": realizado_cobertura - meta_cobertura,
            "pctCobertura": pct(realizado_cobertura, meta_cobertura),
            "metaSortimento": meta_sortimento,
            "realizadoSortimento": realizado_sortimento,
            "gapSortimento": realizado_sortimento - meta_sortimento,
            "pctSortimento": pct(realizado_sortimento, meta_sortimento),
        },
        "serieMensal": [
            {
                "ano": r["ano_referencia"],
                "mes": r["mes_referencia"],
                "meta": num(r["meta"]),
                "realizado": num(r["realizado"]),
                "margem": round(num(r["margem"]), 2),
            }
            for r in serie
        ],
        "fabricantes": [
            {
                "fabricante": r["fabricante"],
                "meta": num(r["meta"]),
                "realizado": num(r["realizado"]),
                "gap": num(r["realizado"]) - num(r["meta"]),
                "pctR": round((num(r["realizado"]) / num(r["meta"]) * 100) if num(r["meta"]) else 0, 1),
                "metaCobertura": num(r["meta_cobertura"]),
                "realizadoCobertura": num(r["realizado_cobertura"]),
                "pctCob": round(
                    (num(r["realizado_cobertura"]) / num(r["meta_cobertura"]) * 100)
                    if num(r["meta_cobertura"])
                    else 0,
                    1,
                ),
                "pctMargem": round(num(r["pct_margem"]), 1),
            }
            for r in fabricantes
        ],
        "topClientes": [
            {
                "nome": r["nome"],
                "equipe": r["equipe"],
                "valor": num(r["valor"]),
                "eRede": bool(r["e_rede"]),
                "codigo": None if r["e_rede"] else r["codigo"],
            }
            for r in top_clientes
        ],
    }


@router.get("/analytics/fabricante-detalhe")
@cached()
def fabricante_detalhe(
    fabricante: str,
    ano: int | None = None,
    mes: int | None = None,
    start: str | None = None,
    end: str | None = None,
    equipe: str | None = None,
    vendedor: str | None = None,
    user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    """Quebra de um fabricante ao clicar na listagem do Dashboard.

    Sempre agrupa por equipe e, dentro dela, por vendedor. Para
    Admin/Gerência sem filtro de equipe ativo, isso devolve todas as equipes
    (visão completa); para Supervisor — ou Admin/Gerência já filtrando por
    uma equipe — o escopo já resolve para uma única equipe (visão
    delimitada), e o frontend mostra só os vendedores dela.
    """
    scope = _resolve_filters(user, equipe, vendedor)
    eff_equipe = scope.get("equipe")
    eff_vendedor = scope.get("vendedor")

    params: list[Any] = [fabricante]
    parts = ["f.fabricante = %s"]
    period = _period_clause("f", ano, mes, start, end, params)
    if period:
        parts.append(period.replace(" AND ", "", 1))
    if eff_vendedor:
        parts.append("f.cod_vendedor = %s")
        params.append(eff_vendedor)
    if eff_equipe:
        # f.equipe não é confiável (ver nota em /dashboard) — filtra pela
        # equipe resolvida via vendedores (join abaixo).
        parts.append("v.equipe = %s")
        params.append(eff_equipe)

    with get_connection() as conn:
        rows = conn.execute(
            f"""
            SELECT COALESCE(v.equipe, f.equipe) AS equipe, f.cod_vendedor,
                   COALESCE(MAX(v.nome), f.cod_vendedor) AS nome_vendedor,
                   COALESCE(SUM(f.meta), 0) AS meta,
                   COALESCE(SUM(f.realizado), 0) AS realizado,
                   COALESCE(SUM(f.cobertura), 0) AS meta_cobertura,
                   COALESCE(SUM(f.realizado_cobertura), 0) AS realizado_cobertura
            FROM indicadores_fabricante f
            LEFT JOIN vendedores v ON v.cod_vendedor = f.cod_vendedor
            WHERE {" AND ".join(parts)}
            GROUP BY COALESCE(v.equipe, f.equipe), f.cod_vendedor
            ORDER BY COALESCE(v.equipe, f.equipe), SUM(f.realizado) DESC
            """,
            params,
        ).fetchall()

    grouped: dict[str, dict[str, Any]] = {}
    for r in rows:
        eq_name = r["equipe"] or "—"
        eq = grouped.setdefault(
            eq_name,
            {
                "equipe": eq_name,
                "meta": 0.0,
                "realizado": 0.0,
                "metaCobertura": 0.0,
                "realizadoCobertura": 0.0,
                "vendedores": [],
            },
        )
        meta_v = num(r["meta"])
        real_v = num(r["realizado"])
        meta_cob_v = num(r["meta_cobertura"])
        real_cob_v = num(r["realizado_cobertura"])
        eq["meta"] += meta_v
        eq["realizado"] += real_v
        eq["metaCobertura"] += meta_cob_v
        eq["realizadoCobertura"] += real_cob_v
        eq["vendedores"].append(
            {
                "codVendedor": r["cod_vendedor"],
                "nome": r["nome_vendedor"],
                "meta": meta_v,
                "realizado": real_v,
                "pctR": round((real_v / meta_v * 100) if meta_v else 0, 1),
                "metaCobertura": meta_cob_v,
                "realizadoCobertura": real_cob_v,
                "pctCob": round((real_cob_v / meta_cob_v * 100) if meta_cob_v else 0, 1),
            }
        )

    equipes_out = []
    for eq in grouped.values():
        equipes_out.append(
            {
                **eq,
                "pctR": round((eq["realizado"] / eq["meta"] * 100) if eq["meta"] else 0, 1),
                "pctCob": round(
                    (eq["realizadoCobertura"] / eq["metaCobertura"] * 100) if eq["metaCobertura"] else 0, 1
                ),
            }
        )
    equipes_out.sort(key=lambda e: e["realizado"], reverse=True)

    return {"fabricante": fabricante, "equipes": equipes_out}


@router.get("/analytics/filter-options")
@cached()
def filter_options(user: dict[str, Any] = Depends(get_current_user)) -> dict[str, Any]:
    """Opções para os filtros de Equipe/Vendedor do Dashboard, já restritas ao
    escopo do usuário: os perfis de visão geral (SUPERADMIN, ADMIN e as duas
    gerências) veem tudo; SUPERVISOR só a própria equipe; VENDEDOR não recebe
    opções (não há o que filtrar)."""
    role = user["role"]
    with get_connection() as conn:
        if role in ROLES_VISAO_GERAL:
            gerencias_rows = conn.execute(
                "SELECT DISTINCT nome_gerencia FROM gerencias WHERE nome_gerencia IS NOT NULL ORDER BY nome_gerencia"
            ).fetchall()
            equipes_rows = conn.execute(
                "SELECT DISTINCT equipe FROM vendedores WHERE equipe IS NOT NULL ORDER BY equipe"
            ).fetchall()
            vendedores_rows = conn.execute(
                "SELECT cod_vendedor, nome, equipe FROM vendedores ORDER BY nome"
            ).fetchall()
            gerencias = [r["nome_gerencia"] for r in gerencias_rows]
            equipes = [r["equipe"] for r in equipes_rows]
        elif role == "SUPERVISOR":
            gerencias = []
            team = user.get("team")
            equipes = [team] if team else []
            vendedores_rows = (
                conn.execute(
                    "SELECT cod_vendedor, nome, equipe FROM vendedores WHERE equipe = %s ORDER BY nome",
                    (team,),
                ).fetchall()
                if team
                else []
            )
        else:
            gerencias = []
            equipes = []
            vendedores_rows = []

    return {
        "gerencias": gerencias,
        "equipes": equipes,
        "vendedores": [
            {"codVendedor": r["cod_vendedor"], "nome": r["nome"], "equipe": r["equipe"]}
            for r in vendedores_rows
        ],
    }


@router.get("/analytics/cliente-fabricantes")
@cached()
def cliente_fabricantes(
    codigo: str | None = None,
    nome: str | None = None,
    ano: int | None = None,
    mes: int | None = None,
    start: str | None = None,
    end: str | None = None,
    equipe: str | None = None,
    vendedor: str | None = None,
    user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    """Quebra por fabricante ao "abrir" um Top Cliente no Dashboard.

    IMPORTANTE — aproximação: a tabela de vendas guarda só o total do pedido,
    sem o fabricante do produto vendido, então não existe forma de saber
    exatamente quanto esse cliente comprou de cada fabricante. Em vez disso,
    esta rota localiza o(s) vendedor(es) responsável(is) pelo cliente (tabela
    clientes) e devolve o desempenho por fabricante desse(s) vendedor(es)
    (indicadores_fabricante) — ou seja, contexto do vendedor, não a divisão
    real da compra do cliente por fabricante.
    """
    if not codigo and not nome:
        raise HTTPException(status_code=400, detail="Informe codigo ou nome do cliente.")

    scope = _resolve_filters(user, equipe, vendedor)
    eff_equipe = scope.get("equipe")
    eff_vendedor = scope.get("vendedor")

    with get_connection() as conn:
        cli_params: list[Any] = []
        cli_parts = ["cod_vendedor IS NOT NULL"]
        if codigo:
            cli_parts.append("cod_cliente = %s")
            cli_params.append(codigo)
        else:
            cli_parts.append("razao_social = %s")
            cli_params.append(nome)
        cliente_rows = conn.execute(
            f"SELECT DISTINCT cod_vendedor FROM clientes WHERE {' AND '.join(cli_parts)}",
            cli_params,
        ).fetchall()
        cod_vendedores = [r["cod_vendedor"] for r in cliente_rows]

        if eff_vendedor:
            cod_vendedores = [c for c in cod_vendedores if c == eff_vendedor]
        elif eff_equipe:
            team_rows = conn.execute(
                "SELECT cod_vendedor FROM vendedores WHERE equipe = %s", (eff_equipe,)
            ).fetchall()
            team_set = {r["cod_vendedor"] for r in team_rows}
            cod_vendedores = [c for c in cod_vendedores if c in team_set]

        if not cod_vendedores:
            return {"vendedoresConsiderados": [], "fabricantes": []}

        fab_params: list[Any] = [cod_vendedores]
        fab_parts = ["f.cod_vendedor = ANY(%s)"]
        fab_period = _period_clause("f", ano, mes, start, end, fab_params)
        if fab_period:
            fab_parts.append(fab_period.replace(" AND ", "", 1))
        rows = conn.execute(
            f"""
            SELECT f.fabricante, f.cod_vendedor,
                   COALESCE(MAX(v.nome), f.cod_vendedor) AS nome_vendedor,
                   COALESCE(SUM(f.meta), 0) AS meta,
                   COALESCE(SUM(f.realizado), 0) AS realizado,
                   COALESCE(SUM(f.cobertura), 0) AS meta_cobertura,
                   COALESCE(SUM(f.realizado_cobertura), 0) AS realizado_cobertura
            FROM indicadores_fabricante f
            LEFT JOIN vendedores v ON v.cod_vendedor = f.cod_vendedor
            WHERE {" AND ".join(fab_parts)}
            GROUP BY f.fabricante, f.cod_vendedor
            ORDER BY f.fabricante, SUM(f.realizado) DESC
            """,
            fab_params,
        ).fetchall()

    grouped: dict[str, dict[str, Any]] = {}
    for r in rows:
        fab_key = r["fabricante"] or "—"
        fab = grouped.setdefault(
            fab_key,
            {
                "fabricante": fab_key,
                "meta": 0.0,
                "realizado": 0.0,
                "metaCobertura": 0.0,
                "realizadoCobertura": 0.0,
                "vendedores": [],
            },
        )
        meta_v = num(r["meta"])
        real_v = num(r["realizado"])
        meta_cob_v = num(r["meta_cobertura"])
        real_cob_v = num(r["realizado_cobertura"])
        fab["meta"] += meta_v
        fab["realizado"] += real_v
        fab["metaCobertura"] += meta_cob_v
        fab["realizadoCobertura"] += real_cob_v
        fab["vendedores"].append(
            {
                "codVendedor": r["cod_vendedor"],
                "nome": r["nome_vendedor"],
                "meta": meta_v,
                "realizado": real_v,
                "pctR": round((real_v / meta_v * 100) if meta_v else 0, 1),
                "metaCobertura": meta_cob_v,
                "realizadoCobertura": real_cob_v,
                "pctCob": round((real_cob_v / meta_cob_v * 100) if meta_cob_v else 0, 1),
            }
        )

    fabricantes_out = []
    for fab in grouped.values():
        fabricantes_out.append(
            {
                **fab,
                "pctR": round((fab["realizado"] / fab["meta"] * 100) if fab["meta"] else 0, 1),
                "pctCob": round(
                    (fab["realizadoCobertura"] / fab["metaCobertura"] * 100) if fab["metaCobertura"] else 0, 1
                ),
            }
        )
    fabricantes_out.sort(key=lambda f: f["realizado"], reverse=True)

    return {"vendedoresConsiderados": cod_vendedores, "fabricantes": fabricantes_out}


@router.get("/analytics/tree")
@cached()
def analytics_tree(
    ano: int | None = None,
    mes: int | None = None,
    start: str | None = None,
    end: str | None = None,
    user: dict[str, Any] = Depends(get_current_user),
) -> list[dict[str, Any]]:
    params: list[Any] = []
    parts = ["1=1"]
    period = _period_clause("f", ano, mes, start, end, params)
    if period:
        parts.append(period.replace(" AND ", "", 1))
    scope = scope_filters(user)
    if scope.get("equipe"):
        parts.append("f.equipe = %s")
        params.append(scope["equipe"])
    if scope.get("vendedor"):
        parts.append("f.cod_vendedor = %s")
        params.append(scope["vendedor"])

    with get_connection() as conn:
        rows = conn.execute(
            f"""
            SELECT f.fabricante, f.equipe, f.cod_vendedor,
                   COALESCE(MAX(v.nome), f.cod_vendedor) AS nome_vendedor,
                   COALESCE(SUM(f.meta), 0) AS meta,
                   COALESCE(SUM(f.realizado), 0) AS realizado,
                   COALESCE(SUM(f.cobertura), 0) AS meta_cobertura,
                   COALESCE(SUM(f.realizado_cobertura), 0) AS realizado_cobertura
            FROM indicadores_fabricante f
            LEFT JOIN vendedores v ON v.cod_vendedor = f.cod_vendedor
            WHERE {" AND ".join(parts)}
            GROUP BY f.fabricante, f.equipe, f.cod_vendedor
            ORDER BY f.fabricante, f.equipe, f.cod_vendedor
            """,
            params,
        ).fetchall()

    total_real = sum(num(r["realizado"]) for r in rows) or 1
    tree: dict[str, Any] = {}
    for r in rows:
        fab = tree.setdefault(
            r["fabricante"] or "—",
            {"nome": r["fabricante"] or "—", "meta": 0, "realizado": 0, "metaCobertura": 0, "realizadoCobertura": 0, "equipes": {}},
        )
        fab["meta"] += num(r["meta"])
        fab["realizado"] += num(r["realizado"])
        fab["metaCobertura"] += num(r["meta_cobertura"])
        fab["realizadoCobertura"] += num(r["realizado_cobertura"])
        eq_name = r["equipe"] or "—"
        eq = fab["equipes"].setdefault(
            eq_name,
            {"nome": eq_name, "meta": 0, "realizado": 0, "metaCobertura": 0, "realizadoCobertura": 0, "vendedores": []},
        )
        eq["meta"] += num(r["meta"])
        eq["realizado"] += num(r["realizado"])
        eq["metaCobertura"] += num(r["meta_cobertura"])
        eq["realizadoCobertura"] += num(r["realizado_cobertura"])
        eq["vendedores"].append(
            {
                "nome": r["nome_vendedor"],
                "codVendedor": r["cod_vendedor"],
                "meta": num(r["meta"]),
                "realizado": num(r["realizado"]),
                "metaCobertura": num(r["meta_cobertura"]),
                "realizadoCobertura": num(r["realizado_cobertura"]),
            }
        )

    def enrich(node: dict[str, Any], parent_real: float) -> dict[str, Any]:
        real = node["realizado"]
        node["participacao"] = round(real / parent_real * 100, 1) if parent_real else 0
        node["crescimento"] = 0
        return node

    result = []
    for fab in tree.values():
        equipes = []
        for eq in fab["equipes"].values():
            vendedores = [enrich(v, eq["realizado"] or 1) for v in eq["vendedores"]]
            eq_out = enrich({k: v for k, v in eq.items() if k != "vendedores"}, fab["realizado"] or 1)
            eq_out["vendedores"] = vendedores
            equipes.append(eq_out)
        fab_out = enrich({k: v for k, v in fab.items() if k != "equipes"}, total_real)
        fab_out["equipes"] = equipes
        result.append(fab_out)
    return result


@router.get("/analytics/history")
@cached()
def history(
    fabricante: str | None = None,
    equipe: str | None = None,
    vendedor: str | None = None,
    user: dict[str, Any] = Depends(get_current_user),
) -> list[dict[str, Any]]:
    params: list[Any] = []
    parts = ["1=1"]
    # O escopo do usuário prevalece sobre os filtros enviados: antes, um VENDEDOR
    # que passasse ?vendedor=<outro código> via a carteira de outra pessoa.
    scope = _resolve_filters(user, equipe, vendedor)
    if fabricante:
        parts.append("f.fabricante = %s")
        params.append(fabricante)
    if scope.get("equipe"):
        # f.equipe não é confiável (ver nota em /dashboard): usa a equipe do cadastro.
        parts.append("v.equipe = %s")
        params.append(scope["equipe"])
    if scope.get("vendedor"):
        parts.append("f.cod_vendedor = %s")
        params.append(scope["vendedor"])

    with get_connection() as conn:
        rows = conn.execute(
            f"""
            SELECT f.ano_referencia, f.mes_referencia, f.fabricante, f.equipe, f.cod_vendedor,
                   COALESCE(MAX(v.nome), f.cod_vendedor) AS nome_vendedor,
                   COALESCE(SUM(f.meta), 0) AS meta,
                   COALESCE(SUM(f.realizado), 0) AS realizado,
                   COALESCE(SUM(f.cobertura), 0) AS meta_clientes,
                   COALESCE(SUM(f.realizado_cobertura), 0) AS positivados,
                   COALESCE(AVG(f.pct_margem), 0) AS margem_pct
            FROM indicadores_fabricante f
            LEFT JOIN vendedores v ON v.cod_vendedor = f.cod_vendedor
            WHERE {" AND ".join(parts)}
            GROUP BY f.ano_referencia, f.mes_referencia, f.fabricante, f.equipe, f.cod_vendedor
            ORDER BY f.ano_referencia, f.mes_referencia, f.fabricante
            """,
            params,
        ).fetchall()
    return [
        {
            "ano": r["ano_referencia"],
            "mesNum": r["mes_referencia"],
            "fabricante": r["fabricante"],
            "equipe": r["equipe"],
            "vendedor": r["nome_vendedor"],
            "codVendedor": r["cod_vendedor"],
            "meta": num(r["meta"]),
            "realizado": num(r["realizado"]),
            "metaClientes": num(r["meta_clientes"]),
            "positivados": num(r["positivados"]),
            "margemPct": round(num(r["margem_pct"]), 1),
        }
        for r in rows
    ]


@router.get("/analytics/evolucao")
@cached()
def evolucao(
    ano: int | None = Query(default=None, ge=2000, le=2100),
    fabricante: str | None = Query(default=None, max_length=120),
    equipe: str | None = Query(default=None, max_length=120),
    vendedor: str | None = Query(default=None, max_length=40),
    user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    """Série mensal consolidada para os gráficos de evolução (tela Histórico).

    Já chega agregada por mês (e por mês × fabricante / mês × equipe) para o
    navegador não receber uma linha por vendedor. O escopo RBAC é aplicado
    como no Dashboard: equipe resolvida via `vendedores` (fonte confiável).
    """
    scope = _resolve_filters(user, equipe, vendedor)
    eff_equipe = scope.get("equipe")
    eff_vendedor = scope.get("vendedor")

    params: list[Any] = []
    parts = ["f.ano_referencia IS NOT NULL", "f.mes_referencia IS NOT NULL"]
    if ano:
        parts.append("f.ano_referencia = %s")
        params.append(ano)
    if fabricante:
        parts.append("f.fabricante = %s")
        params.append(fabricante)
    if eff_equipe:
        parts.append("v.equipe = %s")
        params.append(eff_equipe)
    if eff_vendedor:
        parts.append("f.cod_vendedor = %s")
        params.append(eff_vendedor)
    where = " AND ".join(parts)
    base_from = "FROM indicadores_fabricante f LEFT JOIN vendedores v ON v.cod_vendedor = f.cod_vendedor"

    # Opções dos filtros: independem do fabricante/ano escolhidos (senão a lista encolhe
    # ao selecionar), mas respeitam o escopo do usuário.
    opt_params: list[Any] = []
    opt_parts = ["1=1"]
    if eff_equipe:
        opt_parts.append("v.equipe = %s")
        opt_params.append(eff_equipe)
    if eff_vendedor:
        opt_parts.append("f.cod_vendedor = %s")
        opt_params.append(eff_vendedor)
    opt_where = " AND ".join(opt_parts)

    with get_connection() as conn:
        mensal = conn.execute(
            f"""
            SELECT f.ano_referencia AS ano, f.mes_referencia AS mes,
                   COALESCE(SUM(f.meta), 0) AS meta,
                   COALESCE(SUM(f.realizado), 0) AS realizado,
                   COALESCE(SUM(f.cobertura), 0) AS meta_cobertura,
                   COALESCE(SUM(f.realizado_cobertura), 0) AS realizado_cobertura,
                   COALESCE(AVG(f.pct_margem), 0) AS margem
            {base_from}
            WHERE {where}
            GROUP BY 1, 2
            ORDER BY 1, 2
            """,
            params,
        ).fetchall()
        por_fabricante = conn.execute(
            f"""
            SELECT f.fabricante, f.ano_referencia AS ano, f.mes_referencia AS mes,
                   COALESCE(SUM(f.meta), 0) AS meta,
                   COALESCE(SUM(f.realizado), 0) AS realizado
            {base_from}
            WHERE {where} AND f.fabricante IS NOT NULL
            GROUP BY 1, 2, 3
            ORDER BY 2, 3, 1
            """,
            params,
        ).fetchall()
        por_equipe = (
            []
            if user["role"] == "VENDEDOR"
            else conn.execute(
                f"""
                SELECT COALESCE(v.equipe, 'Sem equipe') AS equipe, f.ano_referencia AS ano, f.mes_referencia AS mes,
                       COALESCE(SUM(f.meta), 0) AS meta,
                       COALESCE(SUM(f.realizado), 0) AS realizado
                {base_from}
                WHERE {where}
                GROUP BY 1, 2, 3
                ORDER BY 2, 3, 1
                """,
                params,
            ).fetchall()
        )
        fabricantes = conn.execute(
            f"SELECT DISTINCT f.fabricante {base_from} WHERE {opt_where} AND f.fabricante IS NOT NULL ORDER BY 1",
            opt_params,
        ).fetchall()
        anos = conn.execute(
            f"SELECT DISTINCT f.ano_referencia AS ano {base_from} WHERE {opt_where} AND f.ano_referencia IS NOT NULL ORDER BY 1 DESC",
            opt_params,
        ).fetchall()

    return {
        "mensal": [
            {
                "ano": r["ano"],
                "mes": r["mes"],
                "meta": num(r["meta"]),
                "realizado": num(r["realizado"]),
                "metaCobertura": num(r["meta_cobertura"]),
                "realizadoCobertura": num(r["realizado_cobertura"]),
                "margem": round(num(r["margem"]), 2),
            }
            for r in mensal
        ],
        "porFabricante": [
            {"fabricante": r["fabricante"], "ano": r["ano"], "mes": r["mes"], "meta": num(r["meta"]), "realizado": num(r["realizado"])}
            for r in por_fabricante
        ],
        "porEquipe": [
            {"equipe": r["equipe"], "ano": r["ano"], "mes": r["mes"], "meta": num(r["meta"]), "realizado": num(r["realizado"])}
            for r in por_equipe
        ],
        "fabricantes": [r["fabricante"] for r in fabricantes],
        "anos": [r["ano"] for r in anos],
    }


@router.get("/analytics/sales")
@cached()
def sales(
    q: str | None = None,
    fabricante: str | None = None,
    start: str | None = None,
    end: str | None = None,
    limit: int = Query(default=200, ge=1, le=1000),
    user: dict[str, Any] = Depends(get_current_user),
) -> list[dict[str, Any]]:
    params: list[Any] = []
    parts = ["1=1"]
    scope = scope_filters(user)
    if start:
        parts.append("v.data_emissao >= %s")
        params.append(start)
    if end:
        parts.append("v.data_emissao <= %s")
        params.append(end)
    if scope.get("vendedor"):
        parts.append("v.cod_vendedor = %s")
        params.append(scope["vendedor"])
    if q:
        parts.append("(v.numero_pedido ILIKE %s OR c.razao_social ILIKE %s OR ve.nome ILIKE %s)")
        like = like_pattern(q)
        params.extend([like, like, like])
    params.append(limit)
    with get_connection() as conn:
        rows = conn.execute(
            f"""
            SELECT v.numero_pedido, v.data_emissao, v.cod_cliente, c.razao_social,
                   v.cod_vendedor, ve.nome AS nome_vendedor, ve.equipe, v.valor_total
            FROM vendas v
            LEFT JOIN clientes c ON c.cod_cliente = v.cod_cliente
            LEFT JOIN vendedores ve ON ve.cod_vendedor = v.cod_vendedor
            WHERE {" AND ".join(parts)}
            ORDER BY v.data_emissao DESC, v.numero_pedido DESC
            LIMIT %s
            """,
            params,
        ).fetchall()
    return [
        {
            "id": r["numero_pedido"],
            "data": r["data_emissao"].isoformat() if r["data_emissao"] else None,
            "cliente": r["razao_social"] or r["cod_cliente"],
            "vendedor": r["nome_vendedor"] or r["cod_vendedor"],
            "equipe": r["equipe"],
            "valor": num(r["valor_total"]),
            "status": "Faturado",
        }
        for r in rows
    ]


# ─────────────────────────────────────────────────────────────────────────────
# FICHA DO CLIENTE
#
# Abre ao clicar em um cliente no Dashboard, no TOP Clientes ou nos Não
# Positivados. Junta, para o MESMO período já filtrado na tela:
#
#   • o realizado de venda do cliente (planilha "Top Clientes");
#   • o peso dele na carteira do vendedor (participação e posição);
#   • o quanto ele representa da meta do vendedor, incluindo os objetivos de
#     faseamento, faseamento II, desconcentração e desafio (aba "Mês");
#   • os fabricantes em que esse cliente comprou, com valor.
#
# Honestidade da fonte: o valor por FABRICANTE é real — vem da matriz
# cliente x fabricante da planilha de Não Positivados, onde cada fabricante é
# uma coluna com o valor vendido no período. Já CATEGORIA e PRODUTO não
# existem por cliente em nenhuma base importada (a venda é gravada só no total
# do pedido), então o nível de item é servido pela Lista de Sortimento — é o
# portfólio daquele fabricante, não a compra daquele cliente, e a resposta diz
# isso em `avisos` para a tela poder avisar o usuário.
# ─────────────────────────────────────────────────────────────────────────────


def _blocos_objetivo(
    row: dict[str, Any] | None, definidas: dict[str, float | None] | None = None
) -> dict[str, dict[str, float]]:
    """Meta/realizado/pct de cada objetivo do vendedor no período.

    `definidas` são as metas gravadas na tela; quando existem, vencem as
    importadas da aba Mês.
    """
    definidas = definidas or {}

    def bloco(meta_key: str, real_key: str) -> dict[str, float]:
        meta_v = aplicar(num(row[meta_key]) if row else 0.0, definidas.get(meta_key))
        real_v = num(row[real_key]) if row else 0.0
        return {
            "meta": meta_v,
            "realizado": real_v,
            "pct": round((real_v / meta_v * 100) if meta_v else 0, 1),
        }

    return {
        "faseamento": bloco("meta_faseamento", "realizado_faseamento"),
        "faseamentoII": bloco("meta_faseamento_ii", "realizado_faseamento_ii"),
        "desconcentracao": bloco("meta_desconcentracao", "realizado_desconcentracao"),
        "desafio": bloco("meta_desafio", "realizado_desafio"),
    }


@router.get("/analytics/cliente-detalhe")
@cached()
def cliente_detalhe(
    codigo: str | None = None,
    nome: str | None = None,
    ano: int | None = None,
    mes: int | None = None,
    start: str | None = None,
    end: str | None = None,
    equipe: str | None = None,
    vendedor: str | None = None,
    user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    """Ficha de um cliente no período: venda, peso na carteira, peso na meta e
    quebra por fabricante.

    `codigo` identifica um ponto de venda; `nome` identifica uma REDE (vários
    códigos sob o mesmo nome comercial), e nesse caso tudo é somado.
    """
    if not codigo and not nome:
        raise HTTPException(status_code=400, detail="Informe codigo ou nome do cliente.")

    scope = _resolve_filters(user, equipe, vendedor)
    eff_equipe = scope.get("equipe")
    eff_vendedor = scope.get("vendedor")

    # Identificação do cliente (ou da rede) dentro do recorte do usuário.
    # O nome segue a mesma expressão usada pelo Dashboard, para que clicar na
    # linha de lá encontre exatamente a mesma coisa aqui.
    nome_expr = "COALESCE(c.razao_social, tc.cliente, tc.cod_cliente)"
    base_params: list[Any] = []
    base_parts = ["1=1"]
    periodo_sql = _period_clause("tc", ano, mes, start, end, base_params)
    if periodo_sql:
        base_parts.append(periodo_sql.replace(" AND ", "", 1))
    if eff_vendedor:
        base_parts.append("tc.cod_vendedor = %s")
        base_params.append(eff_vendedor)
    if eff_equipe:
        base_parts.append("COALESCE(tv.equipe, tc.equipe) = %s")
        base_params.append(eff_equipe)

    cliente_params = list(base_params)
    cliente_parts = list(base_parts)
    if codigo:
        cliente_parts.append("tc.cod_cliente = %s")
        cliente_params.append(codigo)
    else:
        cliente_parts.append(nome_expr + " = %s")
        cliente_params.append(nome)

    with get_connection() as conn:
        cliente = conn.execute(
            f"""
            SELECT {nome_expr} AS nome,
                   MIN(tc.cod_cliente) AS codigo,
                   COUNT(DISTINCT tc.cod_cliente) AS pontos,
                   MAX(tc.municipio) AS municipio,
                   MAX(tc.cod_vendedor) AS cod_vendedor,
                   MAX(COALESCE(tv.nome, tc.nome_vendedor)) AS vendedor,
                   MAX(COALESCE(tv.equipe, tc.equipe)) AS equipe,
                   MAX(tc.gerencia) AS gerencia,
                   BOOL_OR(COALESCE(c.e_rede, false)) AS e_rede,
                   COALESCE(SUM(tc.venda_total_mes), 0) AS realizado
            FROM top_clientes tc
            LEFT JOIN clientes c ON c.cod_cliente = tc.cod_cliente
            LEFT JOIN vendedores tv ON tv.cod_vendedor = tc.cod_vendedor
            WHERE {" AND ".join(cliente_parts)}
            GROUP BY 1
            ORDER BY realizado DESC
            LIMIT 1
            """,
            cliente_params,
        ).fetchone()

        # Cliente SEM venda no período não está em `top_clientes` — e é
        # exatamente o caso da tela de Não Positivados, onde abrir a ficha é
        # mais útil do que em qualquer outro lugar. Recorre ao cadastro para
        # identificá-lo e segue com realizado zero, em vez de devolver 404.
        sem_venda = cliente is None
        if sem_venda:
            cad_params: list[Any] = []
            cad_parts = ["1=1"]
            if codigo:
                cad_parts.append("c.cod_cliente = %s")
                cad_params.append(codigo)
            else:
                cad_parts.append("c.razao_social = %s")
                cad_params.append(nome)
            cliente = conn.execute(
                f"""
                SELECT COALESCE(c.razao_social, c.cod_cliente) AS nome,
                       MIN(c.cod_cliente) AS codigo,
                       COUNT(DISTINCT c.cod_cliente) AS pontos,
                       NULL::text AS municipio,
                       MAX(c.cod_vendedor) AS cod_vendedor,
                       MAX(v.nome) AS vendedor,
                       MAX(v.equipe) AS equipe,
                       NULL::text AS gerencia,
                       BOOL_OR(COALESCE(c.e_rede, false)) AS e_rede,
                       0::numeric AS realizado
                FROM clientes c
                LEFT JOIN vendedores v ON v.cod_vendedor = c.cod_vendedor
                WHERE {" AND ".join(cad_parts)}
                GROUP BY 1
                LIMIT 1
                """,
                cad_params,
            ).fetchone()

            if cliente is None:
                raise HTTPException(status_code=404, detail="Cliente não encontrado.")

            # O recorte do usuário vale igual no caminho de fallback: sem
            # isto, um Vendedor abriria a ficha de um cliente de outro.
            if eff_vendedor and cliente["cod_vendedor"] != eff_vendedor:
                raise HTTPException(status_code=404, detail="Cliente fora do seu escopo.")
            if eff_equipe and cliente["equipe"] != eff_equipe:
                raise HTTPException(status_code=404, detail="Cliente fora do seu escopo.")

        cod_vendedor = cliente["cod_vendedor"]
        realizado_cliente = num(cliente["realizado"])

        # ── Carteira do vendedor dono do cliente ───────────────────────────
        # "O que isso influencia na carteira": a carteira de referência é a do
        # vendedor responsável. Sem vendedor identificado, cai no recorte que
        # o usuário já está vendo na tela.
        cart_params = list(base_params)
        cart_parts = list(base_parts)
        if cod_vendedor:
            cart_parts.append("tc.cod_vendedor = %s")
            cart_params.append(cod_vendedor)
        carteira = conn.execute(
            f"""
            SELECT COALESCE(SUM(tc.venda_total_mes), 0) AS total,
                   COUNT(DISTINCT tc.cod_cliente) AS clientes
            FROM top_clientes tc
            LEFT JOIN clientes c ON c.cod_cliente = tc.cod_cliente
            LEFT JOIN vendedores tv ON tv.cod_vendedor = tc.cod_vendedor
            WHERE {" AND ".join(cart_parts)}
            """,
            cart_params,
        ).fetchone()

        # Posição do cliente no ranking dessa carteira.
        posicao_row = conn.execute(
            f"""
            SELECT COUNT(*) + 1 AS posicao
            FROM (
              SELECT COALESCE(SUM(tc.venda_total_mes), 0) AS valor
              FROM top_clientes tc
              LEFT JOIN clientes c ON c.cod_cliente = tc.cod_cliente
              LEFT JOIN vendedores tv ON tv.cod_vendedor = tc.cod_vendedor
              WHERE {" AND ".join(cart_parts)}
              GROUP BY {nome_expr}
            ) ranking
            WHERE ranking.valor > %s
            """,
            [*cart_params, realizado_cliente],
        ).fetchone()

        # ── Meta e objetivos do vendedor ───────────────────────────────────
        meta_row = None
        if cod_vendedor:
            meta_params: list[Any] = [cod_vendedor]
            meta_parts = ["iv.cod_vendedor = %s"]
            meta_periodo = _period_clause("iv", ano, mes, start, end, meta_params)
            if meta_periodo:
                meta_parts.append(meta_periodo.replace(" AND ", "", 1))
            meta_row = conn.execute(
                f"""
                SELECT COALESCE(SUM(iv.meta_faturamento), 0) AS meta,
                       COALESCE(SUM(iv.realizado_faturamento), 0) AS realizado,
                       COALESCE(SUM(iv.meta_cobertura), 0) AS meta_cobertura,
                       COALESCE(SUM(iv.realizado_cobertura), 0) AS realizado_cobertura,
                       COALESCE(SUM(iv.meta_faseamento), 0) AS meta_faseamento,
                       COALESCE(SUM(iv.realizado_faseamento), 0) AS realizado_faseamento,
                       COALESCE(SUM(iv.meta_faseamento_ii), 0) AS meta_faseamento_ii,
                       COALESCE(SUM(iv.realizado_faseamento_ii), 0) AS realizado_faseamento_ii,
                       COALESCE(SUM(iv.meta_desconcentracao), 0) AS meta_desconcentracao,
                       COALESCE(SUM(iv.realizado_desconcentracao), 0) AS realizado_desconcentracao,
                       COALESCE(SUM(iv.meta_desafio), 0) AS meta_desafio,
                       COALESCE(SUM(iv.realizado_desafio), 0) AS realizado_desafio
                FROM indicadores_vendedor iv
                WHERE {" AND ".join(meta_parts)}
                """,
                meta_params,
            ).fetchone()

        definidas_vendedor = metas_definidas(conn, ano, mes, None, cod_vendedor) if cod_vendedor else {}

        # ── Crescimento (planilha TOP 20 Clientes) ─────────────────────────
        cresc_params: list[Any] = []
        cresc_parts = ["1=1"]
        cresc_periodo = _period_clause("t", ano, mes, start, end, cresc_params)
        if cresc_periodo:
            cresc_parts.append(cresc_periodo.replace(" AND ", "", 1))
        if codigo:
            cresc_parts.append("t.cod_cliente = %s")
            cresc_params.append(codigo)
        else:
            cresc_parts.append("t.cliente_redes = %s")
            cresc_params.append(nome)
        crescimento = conn.execute(
            f"""
            SELECT COALESCE(SUM(t.mes_25), 0) AS mes_ant,
                   COALESCE(SUM(t.mes_26), 0) AS mes_atual,
                   COALESCE(SUM(t.trimestre_25), 0) AS tri_ant,
                   COALESCE(SUM(t.trimestre_26), 0) AS tri_atual,
                   COUNT(*) AS linhas
            FROM top_20_clientes t
            WHERE {" AND ".join(cresc_parts)}
            """,
            cresc_params,
        ).fetchone()

        # ── Fabricantes em que o cliente comprou ───────────────────────────
        # A matriz cliente x fabricante da planilha de Não Positivados é a
        # ÚNICA base com valor de venda por fabricante para um cliente.
        codigos_row = conn.execute(
            f"""
            SELECT DISTINCT tc.cod_cliente
            FROM top_clientes tc
            LEFT JOIN clientes c ON c.cod_cliente = tc.cod_cliente
            LEFT JOIN vendedores tv ON tv.cod_vendedor = tc.cod_vendedor
            WHERE {" AND ".join(cliente_parts)}
            """,
            cliente_params,
        ).fetchall()
        # Sem linha em `top_clientes` (cliente não positivado), o código vem
        # do cadastro — senão a quebra por fabricante ficaria vazia justamente
        # para quem mais precisa dela.
        cods_cliente = [r["cod_cliente"] for r in codigos_row]
        if not cods_cliente:
            cods_cliente = [c for c in (codigo, cliente["codigo"]) if c]

        fab_valores: dict[str, float] = {}
        fonte_fabricante: str | None = None
        if cods_cliente:
            for tabela, rotulo in (
                ("nao_positivados_vendedor", "Não Positivados · por vendedor"),
                ("nao_positivados_chok_total", "Não Positivados · Chok total"),
            ):
                np_params: list[Any] = [cods_cliente]
                np_parts = ["n.cod_cliente = ANY(%s)"]
                np_periodo = _period_clause("n", ano, mes, start, end, np_params)
                if np_periodo:
                    np_parts.append(np_periodo.replace(" AND ", "", 1))
                if tabela == "nao_positivados_vendedor" and cod_vendedor:
                    np_parts.append("n.cod_vendedor = %s")
                    np_params.append(cod_vendedor)
                np_rows = conn.execute(
                    f"SELECT n.fabricantes FROM {tabela} n WHERE {' AND '.join(np_parts)}",
                    np_params,
                ).fetchall()
                for r in np_rows:
                    for fab, valor in (r["fabricantes"] or {}).items():
                        try:
                            v = float(valor)
                        except (TypeError, ValueError):
                            continue
                        fab_valores[fab] = fab_valores.get(fab, 0.0) + v
                if fab_valores:
                    fonte_fabricante = rotulo
                    break

    total_fab = sum(v for v in fab_valores.values() if v > 0)
    fabricantes = [
        {
            "fabricante": fab,
            "valor": round(valor, 2),
            "part": round(valor / total_fab * 100, 1) if total_fab else 0.0,
        }
        for fab, valor in fab_valores.items()
        if valor > 0
    ]
    fabricantes.sort(key=lambda f: f["valor"], reverse=True)

    carteira_total = num(carteira["total"]) if carteira else 0.0
    meta_total = num(meta_row["meta"]) if meta_row else 0.0
    realizado_vendedor = num(meta_row["realizado"]) if meta_row else 0.0

    mes_ant = num(crescimento["mes_ant"]) if crescimento else 0.0
    mes_atual = num(crescimento["mes_atual"]) if crescimento else 0.0
    tri_ant = num(crescimento["tri_ant"]) if crescimento else 0.0
    tri_atual = num(crescimento["tri_atual"]) if crescimento else 0.0

    avisos: list[str] = []
    if sem_venda:
        avisos.append(
            "Este cliente não tem venda registrada na planilha Top Clientes no período — ele está "
            "não positivado. Os números de carteira e meta abaixo são do vendedor responsável."
        )
    if not fabricantes:
        avisos.append(
            "Sem valor por fabricante: a planilha de Não Positivados não traz este cliente no "
            "período, ou todos os fabricantes estão zerados para ele."
        )
    if not meta_total:
        avisos.append("Sem meta importada para o vendedor deste cliente no período.")

    return {
        "cliente": {
            "codigo": cliente["codigo"],
            "nome": cliente["nome"],
            "municipio": cliente["municipio"],
            "codVendedor": cod_vendedor,
            "vendedor": cliente["vendedor"],
            "equipe": cliente["equipe"],
            "gerencia": cliente["gerencia"],
            "eRede": bool(cliente["e_rede"]) or int(cliente["pontos"] or 1) > 1,
            "pontos": int(cliente["pontos"] or 1),
        },
        "venda": {
            "realizado": realizado_cliente,
            "mesAnterior": mes_ant,
            "mesAtual": mes_atual,
            "pctCrescMes": round(((mes_atual - mes_ant) / mes_ant * 100) if mes_ant else 0, 1),
            "trimestreAnterior": tri_ant,
            "trimestreAtual": tri_atual,
            "pctCrescTrimestre": round(((tri_atual - tri_ant) / tri_ant * 100) if tri_ant else 0, 1),
            "temComparativo": bool(crescimento and int(crescimento["linhas"] or 0) > 0),
        },
        "carteira": {
            "total": carteira_total,
            "clientes": int(carteira["clientes"] or 0) if carteira else 0,
            "participacao": round(realizado_cliente / carteira_total * 100, 2) if carteira_total else 0.0,
            "posicao": int(posicao_row["posicao"] or 1) if posicao_row else 1,
        },
        "meta": {
            "metaTotal": meta_total,
            "realizadoVendedor": realizado_vendedor,
            "pctAtingimento": round(realizado_vendedor / meta_total * 100, 1) if meta_total else 0.0,
            # Quanto da meta TOTAL do vendedor este cliente sozinho cobre.
            "contribuicaoNaMeta": round(realizado_cliente / meta_total * 100, 2) if meta_total else 0.0,
            "gap": realizado_vendedor - meta_total,
            "objetivos": _blocos_objetivo(meta_row, definidas_vendedor),
        },
        "fabricantes": fabricantes,
        "fonteFabricante": fonte_fabricante,
        "avisos": avisos,
    }


@router.get("/analytics/cliente-fabricante-itens")
@cached()
def cliente_fabricante_itens(
    fabricante: str = Query(max_length=160),
    user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    """Categorias e produtos de um fabricante, para abrir dentro da ficha do
    cliente.

    FONTE: Lista de Sortimento (+ preço de tabela do cadastro de produtos).
    Nenhuma base importada registra a venda do cliente no nível de item — a
    venda é gravada no total do pedido —, então aqui vem o PORTFÓLIO do
    fabricante, e a resposta declara isso em `fonte`/`temValorPorItem`.
    """
    fab = (fabricante or "").strip()
    if not fab:
        raise HTTPException(status_code=400, detail="Informe o fabricante.")

    escopo = scope_filters(user)
    if escopo.get("fabricante") and escopo["fabricante"] != fab:
        raise HTTPException(status_code=403, detail="Fabricante fora do seu escopo.")

    with get_connection() as conn:
        rows = conn.execute(
            """
            SELECT COALESCE(s.categoria, 'Sem categoria') AS categoria,
                   COALESCE(s.linha, 'Sem linha') AS linha,
                   s.cod_produto,
                   COALESCE(s.produto, p.descricao, s.cod_produto) AS produto,
                   p.preco_tabela
            FROM sortimento s
            LEFT JOIN produtos p ON p.cod_produto = s.cod_produto
            WHERE s.fabricante = %s
            ORDER BY 1, 4
            """,
            (fab,),
        ).fetchall()

    categorias: dict[str, dict[str, Any]] = {}
    for r in rows:
        cat = categorias.setdefault(
            r["categoria"], {"categoria": r["categoria"], "skus": 0, "produtos": []}
        )
        cat["skus"] += 1
        cat["produtos"].append(
            {
                "codigo": r["cod_produto"],
                "produto": r["produto"],
                "linha": r["linha"],
                "precoTabela": num(r["preco_tabela"]),
            }
        )

    saida = sorted(categorias.values(), key=lambda c: c["skus"], reverse=True)
    return {
        "fabricante": fab,
        "categorias": saida,
        "totalSkus": sum(c["skus"] for c in saida),
        "temValorPorItem": False,
        "fonte": "Lista de Sortimento (portfólio do fabricante, sem valor por cliente)",
    }
