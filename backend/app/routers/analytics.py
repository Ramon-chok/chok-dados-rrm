from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, Query

from app.db import get_connection
from app.security import get_current_user
from app.services import num, scope_filters

router = APIRouter(tags=["analytics"])


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
def dashboard(
    ano: int | None = None,
    mes: int | None = None,
    start: str | None = None,
    end: str | None = None,
    user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    params: list[Any] = []
    where_parts = ["1=1"]
    where_parts_sql = _period_clause("iv", ano, mes, start, end, params)
    if where_parts_sql:
        where_parts.append(where_parts_sql.replace(" AND ", "", 1))
    scope = scope_filters(user)
    if scope.get("vendedor"):
        where_parts.append("iv.cod_vendedor = %s")
        params.append(scope["vendedor"])
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
            {where}
            """,
            params,
        ).fetchone()

        serie_params: list[Any] = []
        serie_where_parts = ["1=1"]
        serie_period = _period_clause("iv", ano, None, start, end, serie_params)
        if serie_period:
            serie_where_parts.append(serie_period.replace(" AND ", "", 1))
        if scope.get("vendedor"):
            serie_where_parts.append("iv.cod_vendedor = %s")
            serie_params.append(scope["vendedor"])
        serie = conn.execute(
            f"""
            SELECT iv.ano_referencia, iv.mes_referencia,
                   COALESCE(SUM(iv.meta_faturamento), 0) AS meta,
                   COALESCE(SUM(iv.realizado_faturamento), 0) AS realizado,
                   COALESCE(AVG(iv.pct_margem), 0) AS margem
            FROM indicadores_vendedor iv
            WHERE {" AND ".join(serie_where_parts)}
            GROUP BY iv.ano_referencia, iv.mes_referencia
            ORDER BY iv.ano_referencia, iv.mes_referencia
            """,
            serie_params,
        ).fetchall()

        fab_params: list[Any] = []
        fab_parts = ["1=1"]
        fab_period = _period_clause("f", ano, mes, start, end, fab_params)
        if fab_period:
            fab_parts.append(fab_period.replace(" AND ", "", 1))
        if scope.get("vendedor"):
            fab_parts.append("f.cod_vendedor = %s")
            fab_params.append(scope["vendedor"])
        if scope.get("equipe"):
            fab_parts.append("f.equipe = %s")
            fab_params.append(scope["equipe"])
        fabricantes = conn.execute(
            f"""
            SELECT f.fabricante,
                   COALESCE(SUM(f.meta), 0) AS meta,
                   COALESCE(SUM(f.realizado), 0) AS realizado,
                   COALESCE(SUM(f.cobertura), 0) AS meta_cobertura,
                   COALESCE(SUM(f.realizado_cobertura), 0) AS realizado_cobertura,
                   COALESCE(AVG(f.pct_margem), 0) AS pct_margem
            FROM indicadores_fabricante f
            WHERE {" AND ".join(fab_parts)}
            GROUP BY f.fabricante
            ORDER BY SUM(f.realizado) DESC
            """,
            fab_params,
        ).fetchall()

        top_params: list[Any] = []
        top_parts = ["1=1"]
        if start:
            top_parts.append("v.data_emissao >= %s")
            top_params.append(start)
        if end:
            top_parts.append("v.data_emissao <= %s")
            top_params.append(end)
        if ano and mes:
            top_parts.append("EXTRACT(YEAR FROM v.data_emissao) = %s")
            top_params.append(ano)
            top_parts.append("EXTRACT(MONTH FROM v.data_emissao) = %s")
            top_params.append(mes)
        if scope.get("vendedor"):
            top_parts.append("v.cod_vendedor = %s")
            top_params.append(scope["vendedor"])
        top_clientes = conn.execute(
            f"""
            SELECT COALESCE(c.razao_social, v.cod_cliente) AS nome,
                   ve.equipe,
                   -- Uma "rede" agrupa vários cod_cliente sob o mesmo nome
                   -- comercial: se qualquer código do grupo estiver marcado
                   -- como rede, o grupo inteiro é tratado como rede (não faz
                   -- sentido expor um único código nesse caso).
                   BOOL_OR(COALESCE(c.e_rede, false)) AS e_rede,
                   MIN(v.cod_cliente) AS codigo,
                   COALESCE(SUM(v.valor_total), 0) AS valor
            FROM vendas v
            LEFT JOIN clientes c ON c.cod_cliente = v.cod_cliente
            LEFT JOIN vendedores ve ON ve.cod_vendedor = v.cod_vendedor
            WHERE {" AND ".join(top_parts)}
            GROUP BY 1, 2
            ORDER BY valor DESC
            LIMIT 10
            """,
            top_params,
        ).fetchall()

    def pct(realizado_v: float, meta_v: float) -> float:
        return round((realizado_v / meta_v * 100) if meta_v else 0, 1)

    meta = num(kpis["meta"])
    realizado = num(kpis["realizado"])
    gap = realizado - meta
    atingimento = (realizado / meta * 100) if meta else 0

    meta_cobertura = num(kpis["meta_cobertura"])
    realizado_cobertura = num(kpis["realizado_cobertura"])
    meta_sortimento = num(kpis["meta_sortimento"])
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


@router.get("/analytics/tree")
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
def history(
    fabricante: str | None = None,
    equipe: str | None = None,
    vendedor: str | None = None,
    user: dict[str, Any] = Depends(get_current_user),
) -> list[dict[str, Any]]:
    params: list[Any] = []
    parts = ["1=1"]
    scope = scope_filters(user)
    if fabricante:
        parts.append("f.fabricante = %s")
        params.append(fabricante)
    equipe_f = equipe or scope.get("equipe")
    if equipe_f:
        parts.append("f.equipe = %s")
        params.append(equipe_f)
    vend_f = vendedor or scope.get("vendedor")
    if vend_f:
        parts.append("f.cod_vendedor = %s")
        params.append(vend_f)

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


@router.get("/analytics/sales")
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
        like = f"%{q}%"
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
