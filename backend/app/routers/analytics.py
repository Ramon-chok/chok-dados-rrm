from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query

from app.db import get_connection
from app.security import get_current_user
from app.services import num, scope_filters

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

        fab_params: list[Any] = []
        fab_parts = ["1=1"]
        fab_period = _period_clause("f", ano, mes, start, end, fab_params)
        if fab_period:
            fab_parts.append(fab_period.replace(" AND ", "", 1))
        if eff_vendedor:
            fab_parts.append("f.cod_vendedor = %s")
            fab_params.append(eff_vendedor)
        if eff_equipe:
            fab_parts.append("f.equipe = %s")
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
            WHERE {" AND ".join(fab_parts)}
            GROUP BY f.fabricante
            ORDER BY SUM(f.realizado) DESC
            """,
            fab_params,
        ).fetchall()

        # Quebra por vendedor dentro de cada fabricante — só faz sentido (e só
        # é enviada) quando o resultado já está restrito a uma única equipe
        # (Supervisor, ou Admin/Gerência filtrando por equipe) e ainda não a
        # um único vendedor específico (nesse caso a linha do fabricante já É
        # a do vendedor).
        fab_vendedores_rows: list[Any] = []
        if eff_equipe and not eff_vendedor:
            fab_vendedores_rows = conn.execute(
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
        if eff_vendedor:
            top_parts.append("v.cod_vendedor = %s")
            top_params.append(eff_vendedor)
        if eff_equipe:
            top_parts.append("ve.equipe = %s")
            top_params.append(eff_equipe)
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

    fab_vendedores_by_fabricante: dict[str, list[dict[str, Any]]] = {}
    for r in fab_vendedores_rows:
        meta_v = num(r["meta"])
        real_v = num(r["realizado"])
        meta_cob_v = num(r["meta_cobertura"])
        real_cob_v = num(r["realizado_cobertura"])
        fab_vendedores_by_fabricante.setdefault(r["fabricante"], []).append(
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
                **(
                    {"vendedores": fab_vendedores_by_fabricante[r["fabricante"]]}
                    if r["fabricante"] in fab_vendedores_by_fabricante
                    else {}
                ),
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


@router.get("/analytics/filter-options")
def filter_options(user: dict[str, Any] = Depends(get_current_user)) -> dict[str, Any]:
    """Opções para os filtros de Equipe/Vendedor do Dashboard, já restritas ao
    escopo do usuário: ADMIN/GERENTE veem tudo; SUPERVISOR só a própria
    equipe; VENDEDOR não recebe opções (não há o que filtrar)."""
    role = user["role"]
    with get_connection() as conn:
        if role in ("ADMIN", "GERENTE"):
            equipes_rows = conn.execute(
                "SELECT DISTINCT equipe FROM vendedores WHERE equipe IS NOT NULL ORDER BY equipe"
            ).fetchall()
            vendedores_rows = conn.execute(
                "SELECT cod_vendedor, nome, equipe FROM vendedores ORDER BY nome"
            ).fetchall()
            equipes = [r["equipe"] for r in equipes_rows]
        elif role == "SUPERVISOR":
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
            equipes = []
            vendedores_rows = []

    return {
        "equipes": equipes,
        "vendedores": [
            {"codVendedor": r["cod_vendedor"], "nome": r["nome"], "equipe": r["equipe"]}
            for r in vendedores_rows
        ],
    }


@router.get("/analytics/cliente-fabricantes")
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
