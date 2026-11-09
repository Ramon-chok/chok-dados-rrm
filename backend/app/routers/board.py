"""Quadro de Vendas e Categorias — os dois itens avulsos no topo do menu.

As METAS vêm de `metas_mensais` (importadas pelo ADMIN na tela
"Metas & Definições"). Os REALIZADOS vêm de `app.providers`: hoje das tabelas
locais, e da API externa assim que ``EXTERNAL_API_BASE_URL`` for configurada.
O campo ``fonteRealizado`` na resposta diz qual das duas respondeu.
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends

from app import providers
from app.cache import cached
from app.db import get_connection
from app.security import get_current_user

router = APIRouter(prefix="/board", tags=["board"])


def _resolve_scope(
    user: dict[str, Any], equipe_param: str | None, vendedor_param: str | None
) -> tuple[str | None, str | None]:
    """Escopo RBAC obrigatório + filtros opcionais da tela.

    ADMIN/GERENTE filtram livremente; SUPERVISOR fica preso à própria equipe;
    VENDEDOR só vê o próprio código, ignorando o que for enviado na query.
    """
    role = user["role"]
    if role == "VENDEDOR":
        return None, user.get("seller_code")
    if role == "SUPERVISOR":
        return user.get("team"), vendedor_param
    return equipe_param, vendedor_param


def _meta_period_clause(
    ano: int | None, mes: int | None, start: str | None, end: str | None, params: list[Any]
) -> str:
    """`metas_mensais.ano_mes` é texto "YYYY-MM" — filtra por prefixo/intervalo."""
    if ano and mes:
        params.append(f"{ano:04d}-{mes:02d}")
        return "m.ano_mes = %s"
    if ano:
        params.append(f"{ano:04d}-%")
        return "m.ano_mes LIKE %s"
    clauses: list[str] = []
    if start:
        clauses.append("m.ano_mes >= %s")
        params.append(start[:7])
    if end:
        clauses.append("m.ano_mes <= %s")
        params.append(end[:7])
    return " AND ".join(clauses) if clauses else "1=1"


def _realizado_period_clause(
    alias: str, ano: int | None, mes: int | None, start: str | None, end: str | None, params: list[Any]
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
    return " AND ".join(clauses) if clauses else "1=1"


def _pct(parte: float, total: float) -> float:
    return round(parte / total * 100, 2) if total else 0.0


def _num(value: Any) -> float:
    try:
        return float(value or 0)
    except (TypeError, ValueError):
        return 0.0


@router.get("/sales")
@cached()
def sales_board(
    ano: int | None = None,
    mes: int | None = None,
    start: str | None = None,
    end: str | None = None,
    equipe: str | None = None,
    vendedor: str | None = None,
    user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    """Meta x realizado por vendedor, com o total do período nos KPIs."""
    eff_equipe, eff_vendedor = _resolve_scope(user, equipe, vendedor)

    # --- metas importadas -------------------------------------------------
    meta_params: list[Any] = []
    meta_where = [_meta_period_clause(ano, mes, start, end, meta_params)]
    if eff_equipe:
        meta_where.append("v.equipe = %s")
        meta_params.append(eff_equipe)
    if eff_vendedor:
        meta_where.append("m.cod_vendedor = %s")
        meta_params.append(eff_vendedor)

    with get_connection() as conn:
        metas = conn.execute(
            f"""
            SELECT
              m.cod_vendedor,
              MAX(v.nome)   AS vendedor,
              MAX(v.equipe) AS equipe,
              COALESCE(SUM(m.meta_faturamento), 0) AS meta,
              COALESCE(SUM(m.meta_cobertura), 0)   AS meta_cobertura
            FROM metas_mensais m
            LEFT JOIN vendedores v ON v.cod_vendedor = m.cod_vendedor
            WHERE {" AND ".join(meta_where)}
            GROUP BY m.cod_vendedor
            """,
            meta_params,
        ).fetchall()

        # --- realizado: API externa quando configurada, senão o banco -----
        externo = providers.fetch_sales_board(
            start=start, end=end, equipe=eff_equipe, vendedor=eff_vendedor
        )
        if externo is not None:
            fonte = "api"
            realizados = externo
        else:
            fonte = "banco"
            real_params: list[Any] = []
            real_where = [_realizado_period_clause("iv", ano, mes, start, end, real_params)]
            if eff_equipe:
                real_where.append("v.equipe = %s")
                real_params.append(eff_equipe)
            if eff_vendedor:
                real_where.append("iv.cod_vendedor = %s")
                real_params.append(eff_vendedor)
            realizados = [
                {
                    "cod_vendedor": r["cod_vendedor"],
                    "vendedor": r["vendedor"],
                    "equipe": r["equipe"],
                    "gerencia": r["gerencia"],
                    "realizado": _num(r["realizado"]),
                    "realizado_cobertura": _num(r["realizado_cobertura"]),
                    "positivados": _num(r["realizado_cobertura"]),
                    "margem": _num(r["margem"]),
                }
                for r in conn.execute(
                    f"""
                    SELECT
                      iv.cod_vendedor,
                      MAX(COALESCE(v.nome, iv.nome_vendedor)) AS vendedor,
                      MAX(v.equipe)    AS equipe,
                      MAX(iv.gerencia) AS gerencia,
                      COALESCE(SUM(iv.realizado_faturamento), 0) AS realizado,
                      COALESCE(SUM(iv.realizado_cobertura), 0)   AS realizado_cobertura,
                      COALESCE(AVG(iv.pct_margem), 0)            AS margem
                    FROM indicadores_vendedor iv
                    LEFT JOIN vendedores v ON v.cod_vendedor = iv.cod_vendedor
                    WHERE {" AND ".join(real_where)}
                    GROUP BY iv.cod_vendedor
                    """,
                    real_params,
                ).fetchall()
            ]

    por_codigo: dict[str, dict[str, Any]] = {}
    for row in metas:
        cod = str(row["cod_vendedor"])
        por_codigo[cod] = {
            "codVendedor": cod,
            "vendedor": row["vendedor"],
            "equipe": row["equipe"],
            "gerencia": None,
            "meta": _num(row["meta"]),
            "metaCobertura": _num(row["meta_cobertura"]),
            "realizado": 0.0,
            "realizadoCobertura": 0.0,
            "positivados": 0.0,
            "margem": 0.0,
        }
    for row in realizados:
        cod = str(row["cod_vendedor"])
        alvo = por_codigo.setdefault(
            cod,
            {
                "codVendedor": cod,
                "vendedor": None,
                "equipe": None,
                "gerencia": None,
                "meta": 0.0,
                "metaCobertura": 0.0,
                "realizado": 0.0,
                "realizadoCobertura": 0.0,
                "positivados": 0.0,
                "margem": 0.0,
            },
        )
        alvo["vendedor"] = alvo["vendedor"] or row.get("vendedor")
        alvo["equipe"] = alvo["equipe"] or row.get("equipe")
        alvo["gerencia"] = alvo["gerencia"] or row.get("gerencia")
        alvo["realizado"] = _num(row.get("realizado"))
        alvo["realizadoCobertura"] = _num(row.get("realizado_cobertura"))
        alvo["positivados"] = _num(row.get("positivados"))
        alvo["margem"] = _num(row.get("margem"))

    rows = sorted(por_codigo.values(), key=lambda r: r["realizado"], reverse=True)
    for row in rows:
        row["gap"] = round(row["realizado"] - row["meta"], 2)
        row["atingimento"] = _pct(row["realizado"], row["meta"])
        row["pctCobertura"] = _pct(row["realizadoCobertura"], row["metaCobertura"])

    meta_total = sum(r["meta"] for r in rows)
    realizado_total = sum(r["realizado"] for r in rows)
    return {
        "fonteRealizado": fonte,
        "kpis": {
            "meta": round(meta_total, 2),
            "realizado": round(realizado_total, 2),
            "gap": round(realizado_total - meta_total, 2),
            "atingimento": _pct(realizado_total, meta_total),
            "vendedores": len(rows),
            "metaCobertura": round(sum(r["metaCobertura"] for r in rows), 2),
            "realizadoCobertura": round(sum(r["realizadoCobertura"] for r in rows), 2),
        },
        "rows": rows,
    }


@router.get("/categories")
@cached()
def categories_board(
    ano: int | None = None,
    mes: int | None = None,
    start: str | None = None,
    end: str | None = None,
    equipe: str | None = None,
    vendedor: str | None = None,
    user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    """Meta x realizado por categoria/fabricante dentro do escopo do usuário."""
    eff_equipe, eff_vendedor = _resolve_scope(user, equipe, vendedor)

    meta_params: list[Any] = []
    meta_where = [_meta_period_clause(ano, mes, start, end, meta_params), "m.fabricante IS NOT NULL"]
    if eff_equipe:
        meta_where.append("v.equipe = %s")
        meta_params.append(eff_equipe)
    if eff_vendedor:
        meta_where.append("m.cod_vendedor = %s")
        meta_params.append(eff_vendedor)

    with get_connection() as conn:
        metas = conn.execute(
            f"""
            SELECT
              m.fabricante AS categoria,
              COALESCE(SUM(m.meta_faturamento), 0) AS meta,
              COALESCE(SUM(m.meta_cobertura), 0)   AS meta_cobertura
            FROM metas_mensais m
            LEFT JOIN vendedores v ON v.cod_vendedor = m.cod_vendedor
            WHERE {" AND ".join(meta_where)}
            GROUP BY m.fabricante
            """,
            meta_params,
        ).fetchall()

        externo = providers.fetch_categories(
            start=start, end=end, equipe=eff_equipe, vendedor=eff_vendedor
        )
        if externo is not None:
            fonte = "api"
            realizados = externo
        else:
            fonte = "banco"
            real_params: list[Any] = []
            real_where = [
                _realizado_period_clause("fab", ano, mes, start, end, real_params),
                "fab.fabricante IS NOT NULL",
            ]
            # A coluna `equipe` de indicadores_fabricante vem da planilha com
            # valores que nem sempre são o nome real da equipe — a equipe
            # confiável sai do JOIN com `vendedores` (mesma regra de analytics.py).
            join_equipe = " JOIN vendedores vf ON vf.cod_vendedor = fab.cod_vendedor" if eff_equipe else ""
            if eff_equipe:
                real_where.append("vf.equipe = %s")
                real_params.append(eff_equipe)
            if eff_vendedor:
                real_where.append("fab.cod_vendedor = %s")
                real_params.append(eff_vendedor)
            realizados = [
                {
                    "categoria": r["categoria"],
                    "fabricante": r["categoria"],
                    "realizado": _num(r["realizado"]),
                    "realizado_cobertura": _num(r["realizado_cobertura"]),
                    "margem": _num(r["margem"]),
                }
                for r in conn.execute(
                    f"""
                    SELECT
                      fab.fabricante AS categoria,
                      COALESCE(SUM(fab.realizado), 0)            AS realizado,
                      COALESCE(SUM(fab.realizado_cobertura), 0)  AS realizado_cobertura,
                      COALESCE(AVG(fab.pct_margem), 0)           AS margem
                    FROM indicadores_fabricante fab
                    {join_equipe}
                    WHERE {" AND ".join(real_where)}
                    GROUP BY fab.fabricante
                    """,
                    real_params,
                ).fetchall()
            ]

    por_nome: dict[str, dict[str, Any]] = {}
    for row in metas:
        nome = str(row["categoria"])
        por_nome[nome] = {
            "categoria": nome,
            "meta": _num(row["meta"]),
            "metaCobertura": _num(row["meta_cobertura"]),
            "realizado": 0.0,
            "realizadoCobertura": 0.0,
            "margem": 0.0,
        }
    for row in realizados:
        nome = str(row["categoria"])
        alvo = por_nome.setdefault(
            nome,
            {
                "categoria": nome,
                "meta": 0.0,
                "metaCobertura": 0.0,
                "realizado": 0.0,
                "realizadoCobertura": 0.0,
                "margem": 0.0,
            },
        )
        alvo["realizado"] = _num(row.get("realizado"))
        alvo["realizadoCobertura"] = _num(row.get("realizado_cobertura"))
        alvo["margem"] = _num(row.get("margem"))

    rows = sorted(por_nome.values(), key=lambda r: r["realizado"], reverse=True)
    realizado_total = sum(r["realizado"] for r in rows)
    for row in rows:
        row["gap"] = round(row["realizado"] - row["meta"], 2)
        row["atingimento"] = _pct(row["realizado"], row["meta"])
        row["pctCobertura"] = _pct(row["realizadoCobertura"], row["metaCobertura"])
        row["participacao"] = _pct(row["realizado"], realizado_total)

    meta_total = sum(r["meta"] for r in rows)
    return {
        "fonteRealizado": fonte,
        "kpis": {
            "meta": round(meta_total, 2),
            "realizado": round(realizado_total, 2),
            "gap": round(realizado_total - meta_total, 2),
            "atingimento": _pct(realizado_total, meta_total),
            "categorias": len(rows),
        },
        "rows": rows,
    }
