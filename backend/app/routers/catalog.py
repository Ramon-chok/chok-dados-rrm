from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, Query

from app.db import get_connection
from app.security import get_current_user
from app.services import iso, num, scope_filters

router = APIRouter(tags=["catalog"])


@router.get("/catalog/products")
def products(
    q: str | None = None,
    fabricante: str | None = None,
    categoria: str | None = None,
    user: dict[str, Any] = Depends(get_current_user),
) -> list[dict[str, Any]]:
    params: list[Any] = []
    parts = ["1=1"]
    if fabricante:
        parts.append("p.fabricante = %s")
        params.append(fabricante)
    if categoria:
        parts.append("p.categoria = %s")
        params.append(categoria)
    if q:
        parts.append("(p.cod_produto ILIKE %s OR p.descricao ILIKE %s)")
        like = f"%{q}%"
        params.extend([like, like])
    with get_connection() as conn:
        rows = conn.execute(
            f"""
            SELECT p.cod_produto, p.descricao, p.fabricante, p.categoria, p.preco_tabela, p.atualizado_em
            FROM produtos p
            WHERE {" AND ".join(parts)}
            ORDER BY p.fabricante, p.descricao
            """,
            params,
        ).fetchall()
    return [
        {
            "codigo": r["cod_produto"],
            "nome": r["descricao"],
            "fabricante": r["fabricante"],
            "categoria": r["categoria"],
            "preco": num(r["preco_tabela"]),
            "atualizadoEm": iso(r["atualizado_em"]),
            "status": "Ativo",
        }
        for r in rows
    ]


@router.get("/catalog/customers")
def customers(
    q: str | None = None,
    status_filter: str | None = Query(default=None, alias="status"),
    user: dict[str, Any] = Depends(get_current_user),
) -> list[dict[str, Any]]:
    params: list[Any] = []
    parts = ["1=1"]
    scope = scope_filters(user)
    if scope.get("vendedor"):
        parts.append("c.cod_vendedor = %s")
        params.append(scope["vendedor"])
    if status_filter:
        parts.append("c.status = %s")
        params.append(status_filter)
    if q:
        parts.append("(c.cod_cliente ILIKE %s OR c.razao_social ILIKE %s OR c.cnpj ILIKE %s)")
        like = f"%{q}%"
        params.extend([like, like, like])
    with get_connection() as conn:
        rows = conn.execute(
            f"""
            SELECT c.cod_cliente, c.razao_social, c.cnpj, c.cod_vendedor, c.status,
                   ve.nome AS nome_vendedor, ve.equipe
            FROM clientes c
            LEFT JOIN vendedores ve ON ve.cod_vendedor = c.cod_vendedor
            WHERE {" AND ".join(parts)}
            ORDER BY c.razao_social
            """,
            params,
        ).fetchall()
    return [dict(r) for r in rows]


@router.get("/catalog/sellers")
def sellers(user: dict[str, Any] = Depends(get_current_user)) -> list[dict[str, Any]]:
    params: list[Any] = []
    parts = ["1=1"]
    scope = scope_filters(user)
    if scope.get("equipe"):
        parts.append("v.equipe = %s")
        params.append(scope["equipe"])
    if scope.get("vendedor"):
        parts.append("v.cod_vendedor = %s")
        params.append(scope["vendedor"])
    with get_connection() as conn:
        rows = conn.execute(
            f"""
            SELECT v.cod_vendedor, v.nome, v.email, v.equipe, e.supervisor, e.gerencia
            FROM vendedores v
            LEFT JOIN equipes e ON e.nome_equipe = v.equipe
            WHERE {" AND ".join(parts)}
            ORDER BY v.nome
            """,
            params,
        ).fetchall()
    return [dict(r) for r in rows]


@router.get("/catalog/teams")
def teams(_user: dict[str, Any] = Depends(get_current_user)) -> list[dict[str, Any]]:
    with get_connection() as conn:
        rows = conn.execute(
            "SELECT nome_equipe, supervisor, gerencia FROM equipes ORDER BY nome_equipe"
        ).fetchall()
    return [dict(r) for r in rows]


@router.get("/catalog/manufacturers")
def manufacturers(_user: dict[str, Any] = Depends(get_current_user)) -> list[dict[str, Any]]:
    with get_connection() as conn:
        rows = conn.execute(
            "SELECT nome_fabricante, razao_social, cnpj FROM fabricantes ORDER BY nome_fabricante"
        ).fetchall()
    return [dict(r) for r in rows]


@router.get("/commercial/targets")
def targets(
    ano_mes: str | None = None,
    user: dict[str, Any] = Depends(get_current_user),
) -> list[dict[str, Any]]:
    params: list[Any] = []
    parts = ["1=1"]
    scope = scope_filters(user)
    if ano_mes:
        parts.append("m.ano_mes = %s")
        params.append(ano_mes)
    if scope.get("vendedor"):
        parts.append("m.cod_vendedor = %s")
        params.append(scope["vendedor"])
    with get_connection() as conn:
        rows = conn.execute(
            f"""
            SELECT m.ano_mes, m.cod_vendedor, ve.nome, ve.equipe, m.fabricante,
                   m.meta_faturamento, m.meta_cobertura
            FROM metas_mensais m
            LEFT JOIN vendedores ve ON ve.cod_vendedor = m.cod_vendedor
            WHERE {" AND ".join(parts)}
            ORDER BY m.ano_mes DESC, ve.nome, m.fabricante
            """,
            params,
        ).fetchall()
    return [
        {
            "anoMes": r["ano_mes"],
            "codVendedor": r["cod_vendedor"],
            "vendedor": r["nome"],
            "equipe": r["equipe"],
            "fabricante": r["fabricante"],
            "metaFaturamento": num(r["meta_faturamento"]),
            "metaCobertura": num(r["meta_cobertura"]),
        }
        for r in rows
    ]


@router.get("/commercial/top-customers")
def top_customers(
    start: str | None = None,
    end: str | None = None,
    limit: int = Query(default=20, ge=1, le=200),
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
    params.append(limit)
    with get_connection() as conn:
        rows = conn.execute(
            f"""
            SELECT v.cod_cliente,
                   COALESCE(c.razao_social, v.cod_cliente) AS nome,
                   v.cod_vendedor,
                   ve.nome AS nome_vendedor,
                   ve.equipe,
                   COALESCE(SUM(v.valor_total), 0) AS faturamento
            FROM vendas v
            LEFT JOIN clientes c ON c.cod_cliente = v.cod_cliente
            LEFT JOIN vendedores ve ON ve.cod_vendedor = v.cod_vendedor
            WHERE {" AND ".join(parts)}
            GROUP BY v.cod_cliente, c.razao_social, v.cod_vendedor, ve.nome, ve.equipe
            ORDER BY faturamento DESC
            LIMIT %s
            """,
            params,
        ).fetchall()
    total = sum(num(r["faturamento"]) for r in rows) or 1
    out = []
    for i, r in enumerate(rows, start=1):
        fat = num(r["faturamento"])
        out.append(
            {
                "pos": i,
                "codigo": r["cod_cliente"],
                "nome": r["nome"],
                "vendedor": r["nome_vendedor"],
                "vendedorCod": r["cod_vendedor"],
                "equipe": r["equipe"],
                "faturamento": fat,
                "part": round(fat / total * 100, 1),
            }
        )
    return out


@router.get("/commercial/not-positivated")
def not_positivated(
    start: str | None = None,
    end: str | None = None,
    user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    params: list[Any] = []
    scope = scope_filters(user)
    cliente_parts = ["1=1"]
    if scope.get("vendedor"):
        cliente_parts.append("c.cod_vendedor = %s")
        params.append(scope["vendedor"])

    with get_connection() as conn:
        rows = conn.execute(
            f"""
            SELECT c.cod_cliente, c.razao_social, c.cod_vendedor, ve.nome AS nome_vendedor,
                   ve.equipe, e.supervisor, e.gerencia, c.status,
                   MAX(v.data_emissao) AS ultima_compra
            FROM clientes c
            LEFT JOIN vendedores ve ON ve.cod_vendedor = c.cod_vendedor
            LEFT JOIN equipes e ON e.nome_equipe = ve.equipe
            LEFT JOIN vendas v ON v.cod_cliente = c.cod_cliente
            WHERE {" AND ".join(cliente_parts)}
            GROUP BY c.cod_cliente, c.razao_social, c.cod_vendedor, ve.nome, ve.equipe,
                     e.supervisor, e.gerencia, c.status
            ORDER BY ultima_compra NULLS FIRST, c.razao_social
            """,
            params,
        ).fetchall()

    from datetime import date as date_cls

    today = date_cls.today()
    lista = []
    positivados = 0
    for r in rows:
        ultima = r["ultima_compra"]
        in_period = True
        if start and ultima:
            in_period = ultima.isoformat() >= start
        if end and ultima:
            in_period = in_period and ultima.isoformat() <= end
        if ultima and in_period:
            positivados += 1
            continue
        dias = (today - ultima).days if ultima else 999
        if dias >= 60:
            st = "Crítico"
        elif dias >= 30:
            st = "Atenção"
        else:
            st = "Regular"
        lista.append(
            {
                "codigo": r["cod_cliente"],
                "nome": r["razao_social"],
                "vendedor": r["nome_vendedor"],
                "equipe": r["equipe"],
                "supervisor": r["supervisor"],
                "gerencia": r["gerencia"],
                "ultimaCompra": ultima.isoformat() if ultima else None,
                "dias": dias,
                "status": st,
            }
        )

    base = len(rows)
    nao = len(lista)
    return {
        "kpis": {
            "baseClientes": base,
            "positivados": positivados,
            "naoPositivados": nao,
            "positivacaoPct": round((positivados / base * 100) if base else 0, 1),
        },
        "clientes": lista,
    }


@router.get("/sar/positivacao")
def sar_positivacao(
    ano: int | None = None,
    mes: int | None = None,
    user: dict[str, Any] = Depends(get_current_user),
) -> list[dict[str, Any]]:
    params: list[Any] = []
    parts = ["1=1"]
    scope = scope_filters(user)
    if ano:
        parts.append("p.ano_referencia = %s")
        params.append(ano)
    if mes:
        parts.append("p.mes_referencia = %s")
        params.append(mes)
    if scope.get("equipe"):
        parts.append("p.equipe = %s")
        params.append(scope["equipe"])
    if scope.get("vendedor"):
        parts.append("p.cod_vendedor = %s")
        params.append(scope["vendedor"])
    with get_connection() as conn:
        rows = conn.execute(
            f"""
            SELECT p.cod_vendedor, COALESCE(MAX(v.nome), p.cod_vendedor) AS nome,
                   p.equipe,
                   COALESCE(SUM(p.visitas_previstas), 0) AS visitas_previstas,
                   COALESCE(SUM(p.visitas_realizadas), 0) AS visitas_realizadas,
                   COALESCE(SUM(p.vendas_previstas), 0) AS vendas_previstas,
                   COALESCE(SUM(p.vendas_realizadas), 0) AS vendas_realizadas,
                   COALESCE(SUM(p.fora_de_rota), 0) AS fora_de_rota,
                   COALESCE(SUM(p.gps_ok), 0) AS gps_ok,
                   COALESCE(SUM(p.pedidos), 0) AS pedidos,
                   COALESCE(SUM(p.apontamentos), 0) AS apontamentos
            FROM indicadores_positivacao p
            LEFT JOIN vendedores v ON v.cod_vendedor = p.cod_vendedor
            WHERE {" AND ".join(parts)}
            GROUP BY p.cod_vendedor, p.equipe
            ORDER BY p.equipe, nome
            """,
            params,
        ).fetchall()
    out: list[dict[str, Any]] = []
    skip = {"cod_vendedor", "nome", "equipe"}
    for r in rows:
        item = dict(r)
        for key, value in item.items():
            if key not in skip:
                item[key] = num(value)
        out.append(item)
    return out
