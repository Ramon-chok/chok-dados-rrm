from __future__ import annotations

from datetime import date as date_cls
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query

from app.db import get_connection
from app.parse import parse_date_only
from app.security import get_current_user
from app.services import iso, num, scope_filters

router = APIRouter(tags=["catalog"])


def _resolve_equipe_vendedor(
    user: dict[str, Any], equipe_param: str | None, vendedor_param: str | None
) -> tuple[str | None, str | None]:
    """Mesma regra do Dashboard: ADMIN/GERENTE filtram livremente por equipe
    e/ou vendedor; SUPERVISOR tem a equipe travada na própria; VENDEDOR
    sempre vê só o próprio código."""
    role = user["role"]
    if role == "VENDEDOR":
        return None, user.get("seller_code")
    if role == "SUPERVISOR":
        return user.get("team"), vendedor_param
    return equipe_param, vendedor_param


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


@router.get("/catalog/sortimento")
def sortimento(
    q: str | None = None,
    fabricante: str | None = None,
    categoria: str | None = None,
    linha: str | None = None,
    _user: dict[str, Any] = Depends(get_current_user),
) -> list[dict[str, Any]]:
    """Lista o catálogo importado na tabela sortimento (Lista de Sortimento)."""
    params: list[Any] = []
    parts = ["1=1"]
    if fabricante:
        parts.append("s.fabricante = %s")
        params.append(fabricante)
    if categoria:
        parts.append("s.categoria = %s")
        params.append(categoria)
    if linha:
        parts.append("s.linha = %s")
        params.append(linha)
    if q:
        parts.append(
            "(s.cod_produto ILIKE %s OR COALESCE(s.produto, '') ILIKE %s "
            "OR COALESCE(s.fabricante, '') ILIKE %s OR COALESCE(s.categoria, '') ILIKE %s "
            "OR COALESCE(s.linha, '') ILIKE %s)"
        )
        like = f"%{q}%"
        params.extend([like, like, like, like, like])
    with get_connection() as conn:
        rows = conn.execute(
            f"""
            SELECT
              s.id,
              s.cod_produto,
              s.produto,
              s.fabricante,
              s.categoria,
              s.linha,
              s.atualizado_em
            FROM sortimento s
            WHERE {" AND ".join(parts)}
            ORDER BY s.fabricante NULLS LAST, s.produto NULLS LAST, s.cod_produto, s.id
            """,
            params,
        ).fetchall()
    return [
        {
            "id": r["id"],
            "codigo": r["cod_produto"],
            "produto": r["produto"],
            "fabricante": r["fabricante"],
            "categoria": r["categoria"],
            "linha": r["linha"],
            "atualizadoEm": iso(r["atualizado_em"]),
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


@router.get("/commercial/objetivos-faseamento")
def objetivos_faseamento(
    ano: int | None = None,
    mes: int | None = None,
    start: str | None = None,
    end: str | None = None,
    equipe: str | None = None,
    vendedor: str | None = None,
    user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    """Metas de Faseamento, Faseamento II, Desconcentração e Desafio (aba
    "Mês" do Dados App, tabela indicadores_vendedor) — total do escopo do
    usuário, com Admin/Gerência podendo filtrar por equipe ou vendedor e
    Supervisor podendo filtrar por vendedor da própria equipe."""
    eff_equipe, eff_vendedor = _resolve_equipe_vendedor(user, equipe, vendedor)

    join_scope = " JOIN vendedores vsc ON vsc.cod_vendedor = iv.cod_vendedor" if eff_equipe else ""
    params: list[Any] = []
    parts = ["1=1"]
    if ano:
        parts.append("iv.ano_referencia = %s")
        params.append(ano)
    if mes:
        parts.append("iv.mes_referencia = %s")
        params.append(mes)
    if start:
        parts.append("iv.data_referencia >= %s")
        params.append(start)
    if end:
        parts.append("iv.data_referencia <= %s")
        params.append(end)
    if eff_equipe:
        parts.append("vsc.equipe = %s")
        params.append(eff_equipe)
    if eff_vendedor:
        parts.append("iv.cod_vendedor = %s")
        params.append(eff_vendedor)

    with get_connection() as conn:
        row = conn.execute(
            f"""
            SELECT
              COALESCE(SUM(iv.meta_faseamento), 0) AS meta_faseamento,
              COALESCE(SUM(iv.realizado_faseamento), 0) AS realizado_faseamento,
              COALESCE(SUM(iv.meta_faseamento_ii), 0) AS meta_faseamento_ii,
              COALESCE(SUM(iv.realizado_faseamento_ii), 0) AS realizado_faseamento_ii,
              COALESCE(SUM(iv.meta_desconcentracao), 0) AS meta_desconcentracao,
              COALESCE(SUM(iv.realizado_desconcentracao), 0) AS realizado_desconcentracao,
              COALESCE(SUM(iv.meta_desafio), 0) AS meta_desafio,
              COALESCE(SUM(iv.realizado_desafio), 0) AS realizado_desafio
            FROM indicadores_vendedor iv
            {join_scope}
            WHERE {" AND ".join(parts)}
            """,
            params,
        ).fetchone()

    def block(meta_key: str, realizado_key: str) -> dict[str, float]:
        meta_v = num(row[meta_key])
        real_v = num(row[realizado_key])
        return {
            "meta": meta_v,
            "realizado": real_v,
            "pct": round((real_v / meta_v * 100) if meta_v else 0, 1),
        }

    return {
        "faseamento": block("meta_faseamento", "realizado_faseamento"),
        "faseamentoII": block("meta_faseamento_ii", "realizado_faseamento_ii"),
        "desconcentracao": block("meta_desconcentracao", "realizado_desconcentracao"),
        "desafio": block("meta_desafio", "realizado_desafio"),
    }


@router.get("/commercial/top-customers")
def top_customers(
    start: str | None = None,
    end: str | None = None,
    limit: int = Query(default=20, ge=1, le=200),
    user: dict[str, Any] = Depends(get_current_user),
) -> list[dict[str, Any]]:
    # Vem da planilha "Top Clientes" (aba "top_clientes", venda total no mês
    # por cliente) — a tabela `vendas` não tem importação implementada ainda.
    # tv.equipe (via join com vendedores, fonte confiável) tem prioridade
    # sobre tc.equipe (valor já importado, usado como fallback).
    params: list[Any] = []
    parts = ["1=1"]
    scope = scope_filters(user)
    if start:
        parts.append("tc.data_referencia >= %s")
        params.append(start)
    if end:
        parts.append("tc.data_referencia <= %s")
        params.append(end)
    if scope.get("vendedor"):
        parts.append("tc.cod_vendedor = %s")
        params.append(scope["vendedor"])
    if scope.get("equipe"):
        parts.append("COALESCE(tv.equipe, tc.equipe) = %s")
        params.append(scope["equipe"])
    params.append(limit)
    with get_connection() as conn:
        rows = conn.execute(
            f"""
            SELECT tc.cod_cliente,
                   COALESCE(c.razao_social, tc.cliente, tc.cod_cliente) AS nome,
                   tc.cod_vendedor,
                   COALESCE(tv.nome, tc.nome_vendedor) AS nome_vendedor,
                   COALESCE(tv.equipe, tc.equipe) AS equipe,
                   COALESCE(SUM(tc.venda_total_mes), 0) AS faturamento
            FROM top_clientes tc
            LEFT JOIN clientes c ON c.cod_cliente = tc.cod_cliente
            LEFT JOIN vendedores tv ON tv.cod_vendedor = tc.cod_vendedor
            WHERE {" AND ".join(parts)}
            GROUP BY tc.cod_cliente, c.razao_social, tc.cliente, tc.cod_vendedor,
                     tv.nome, tc.nome_vendedor, tv.equipe, tc.equipe
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


@router.get("/commercial/top-20-customers")
def top_20_customers(
    ano: int | None = None,
    mes: int | None = None,
    start: str | None = None,
    end: str | None = None,
    gerencia: str | None = None,
    equipe: str | None = None,
    vendedor: str | None = None,
    user: dict[str, Any] = Depends(get_current_user),
) -> list[dict[str, Any]]:
    """Lista bruta da planilha "Top Clientes" (aba "top_20_clientes") — dados
    exatamente como importados, sem agregação. Admin/Gerência veem tudo e
    podem filtrar por gerência, equipe ou vendedor; Supervisor só vê a
    própria equipe (podendo filtrar por vendedor dela); Vendedor só vê os
    próprios registros.
    """
    eff_equipe, eff_vendedor = _resolve_equipe_vendedor(user, equipe, vendedor)
    eff_gerencia = gerencia if user["role"] in ("ADMIN", "GERENTE") else None

    params: list[Any] = []
    parts = ["1=1"]
    if ano:
        parts.append("t.ano_referencia = %s")
        params.append(ano)
    if mes:
        parts.append("t.mes_referencia = %s")
        params.append(mes)
    if start:
        parts.append("t.data_referencia >= %s")
        params.append(start)
    if end:
        parts.append("t.data_referencia <= %s")
        params.append(end)
    if eff_vendedor:
        parts.append("t.cod_vendedor = %s")
        params.append(eff_vendedor)
    if eff_equipe:
        # Prioriza a equipe resolvida via vendedores (fonte confiável) sobre
        # o valor já importado na própria planilha.
        parts.append("COALESCE(tv.equipe, t.equipe) = %s")
        params.append(eff_equipe)
    if eff_gerencia:
        parts.append("t.gerencia = %s")
        params.append(eff_gerencia)

    with get_connection() as conn:
        rows = conn.execute(
            f"""
            SELECT t.data_referencia, t.nivel, t.gerencia,
                   COALESCE(tv.equipe, t.equipe) AS equipe,
                   t.cod_vendedor, COALESCE(tv.nome, t.nome_vendedor) AS nome_vendedor,
                   t.pasta, t.cod_cliente, t.cliente_redes,
                   t.trimestre_25, t.trimestre_26, t.pct_cresc_trimestre,
                   t.mes_25, t.mes_26, t.pct_cresc_mes
            FROM top_20_clientes t
            LEFT JOIN vendedores tv ON tv.cod_vendedor = t.cod_vendedor
            WHERE {" AND ".join(parts)}
            ORDER BY t.gerencia, COALESCE(tv.equipe, t.equipe), t.cod_vendedor, t.nivel
            """,
            params,
        ).fetchall()

    return [
        {
            "dataReferencia": iso(r["data_referencia"]),
            "nivel": r["nivel"],
            "gerencia": r["gerencia"],
            "equipe": r["equipe"],
            "codVendedor": r["cod_vendedor"],
            "nomeVendedor": r["nome_vendedor"],
            "pasta": r["pasta"],
            "codCliente": r["cod_cliente"],
            "clienteRedes": r["cliente_redes"],
            "trimestre25": num(r["trimestre_25"]),
            "trimestre26": num(r["trimestre_26"]),
            "pctCrescTrimestre": num(r["pct_cresc_trimestre"]),
            "mes25": num(r["mes_25"]),
            "mes26": num(r["mes_26"]),
            "pctCrescMes": num(r["pct_cresc_mes"]),
        }
        for r in rows
    ]


@router.get("/commercial/nao-positivados-import")
def nao_positivados_import(
    ano: int | None = None,
    mes: int | None = None,
    start: str | None = None,
    end: str | None = None,
    nivel: str | None = Query(default=None, pattern="^(vendedor|equipe|total)$"),
    equipe: str | None = None,
    vendedor: str | None = None,
    user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    """Não Positivados a partir da planilha importada (3 abas/tabelas
    separadas — não é uma agregação derivada). Vendedor só vê a própria
    linha (nível "vendedor" travado); Supervisor só vê a própria equipe
    (nível "equipe" travado); Admin/Gerência veem o Chok Total por padrão,
    podendo trocar para o nível vendedor ou equipe (com filtro opcional).
    Cada fabricante é uma coluna na planilha original, capturada na coluna
    "fabricantes" — a lista de categorias devolvida vem exatamente dela.
    """
    role = user["role"]
    if role == "VENDEDOR":
        eff_nivel = "vendedor"
        eff_equipe = None
        eff_vendedor = user.get("seller_code")
    elif role == "SUPERVISOR":
        eff_nivel = "equipe"
        eff_equipe = user.get("team")
        eff_vendedor = None
    else:
        eff_nivel = nivel or "total"
        eff_equipe = equipe
        eff_vendedor = vendedor

    params: list[Any] = []
    parts = ["1=1"]
    if ano:
        parts.append("n.ano_referencia = %s")
        params.append(ano)
    if mes:
        parts.append("n.mes_referencia = %s")
        params.append(mes)
    if start:
        parts.append("n.data_referencia >= %s")
        params.append(start)
    if end:
        parts.append("n.data_referencia <= %s")
        params.append(end)

    join = ""
    extra_select = ""
    if eff_nivel == "vendedor":
        table = "nao_positivados_vendedor"
        join = "LEFT JOIN vendedores v ON v.cod_vendedor = n.cod_vendedor"
        extra_select = ", n.cod_vendedor, COALESCE(v.nome, n.cod_vendedor) AS vendedor_nome, v.equipe AS vendedor_equipe"
        if eff_vendedor:
            parts.append("n.cod_vendedor = %s")
            params.append(eff_vendedor)
    elif eff_nivel == "equipe":
        table = "nao_positivados_equipe"
        extra_select = ", n.equipe"
        if eff_equipe:
            parts.append("n.equipe = %s")
            params.append(eff_equipe)
    else:
        table = "nao_positivados_chok_total"

    with get_connection() as conn:
        rows = conn.execute(
            f"""
            SELECT n.cod_cliente, n.razao_social, n.nome_fantasia, n.municipio, n.fabricantes
                   {extra_select}
            FROM {table} n
            {join}
            WHERE {" AND ".join(parts)}
            ORDER BY n.razao_social
            """,
            params,
        ).fetchall()

    categorias = sorted({k for r in rows for k in (r["fabricantes"] or {}).keys()})

    out_rows = []
    for r in rows:
        item: dict[str, Any] = {
            "codCliente": r["cod_cliente"],
            "razaoSocial": r["razao_social"],
            "nomeFantasia": r["nome_fantasia"],
            "municipio": r["municipio"],
            "fabricantes": r["fabricantes"] or {},
        }
        if eff_nivel == "vendedor":
            item["codVendedor"] = r["cod_vendedor"]
            item["vendedor"] = r["vendedor_nome"]
            item["equipe"] = r["vendedor_equipe"]
        elif eff_nivel == "equipe":
            item["equipe"] = r["equipe"]
        out_rows.append(item)

    return {"nivel": eff_nivel, "categorias": categorias, "rows": out_rows}


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


@router.get("/sar/raiox")
def sar_raiox(
    ano: int | None = None,
    mes: int | None = None,
    dia: str | None = None,
    user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    """Dados da tabela raiox (importação "Raio-X — Acompanhamento") para a
    tela sar/RaioX.tsx: filtráveis por dia exato (`dia`) ou por período
    (`ano` + `mes` opcional). Quando `dia` não é informado, os valores são
    agregados por vendedor (SOMA para contagens, MÉDIA para percentuais) no
    período pedido. O recorte RBAC segue o mesmo padrão de /sar/positivacao."""
    if mes is not None and not (1 <= mes <= 12):
        raise HTTPException(status_code=400, detail='Parâmetro "mes" deve estar entre 1 e 12.')

    dia_ok: str | None = None
    if dia:
        ok, parsed = parse_date_only(dia)
        if not ok or not parsed:
            raise HTTPException(status_code=400, detail=f'Data inválida em "dia": "{dia}".')
        dia_ok = parsed

    ano_efetivo = ano or date_cls.today().year
    scope = scope_filters(user)

    params: list[Any] = []
    parts = ["1=1"]
    if dia_ok:
        parts.append("r.data_referencia = %s")
        params.append(dia_ok)
    else:
        parts.append("r.ano_referencia = %s")
        params.append(ano_efetivo)
        if mes:
            parts.append("r.mes_referencia = %s")
            params.append(mes)
    if scope.get("equipe"):
        parts.append("r.equipe = %s")
        params.append(scope["equipe"])
    if scope.get("vendedor"):
        parts.append("r.cod_vendedor = %s")
        params.append(scope["vendedor"])

    with get_connection() as conn:
        rows = conn.execute(
            f"""
            SELECT
              r.cod_vendedor,
              COALESCE(MAX(r.vendedor), MAX(v.nome), r.cod_vendedor) AS vendedor,
              MAX(r.equipe) AS equipe,
              COUNT(DISTINCT r.data_referencia) AS dias_com_dados,
              COALESCE(SUM(r.visitas_previstas), 0) AS visitas_previstas,
              COALESCE(SUM(r.visitas_realizadas), 0) AS visitas_realizadas,
              COALESCE(SUM(r.visitas_fora_rota), 0) AS visitas_fora_rota,
              AVG(r.perc_gps) AS perc_gps,
              COALESCE(SUM(r.apontamentos_inconsistencia), 0) AS apontamentos_inconsistencia,
              COALESCE(SUM(r.positiva_prevista), 0) AS positiva_prevista,
              COALESCE(SUM(r.pedidos), 0) AS pedidos,
              AVG(r.perc_positivacao) AS perc_positivacao,
              COALESCE(SUM(r.fora_rota_positivacao), 0) AS fora_rota_positivacao,
              AVG(r.perc_fora_rota) AS perc_fora_rota,
              AVG(r.produtividade) AS produtividade,
              MIN(r.hora_inicio) AS hora_inicio,
              MIN(r.hora_check_in) AS hora_check_in,
              MAX(r.hora_check_out) AS hora_check_out,
              MAX(r.hora_fim) AS hora_fim,
              MAX(r.tempo_campo::interval)::text AS tempo_campo,
              COALESCE(SUM(r.acumulado_prevista), 0) AS acumulado_prevista,
              COALESCE(SUM(r.acumulado_realizadas), 0) AS acumulado_realizadas,
              AVG(r.acumulado_porcentagem) AS acumulado_porcentagem,
              COALESCE(SUM(r.acumulado_fora_rota), 0) AS acumulado_fora_rota,
              AVG(r.perc_fora_rota_acumulado) AS perc_fora_rota_acumulado,
              COALESCE(SUM(r.acumulado_positivacao_visitas), 0) AS acumulado_positivacao_visitas,
              COALESCE(SUM(r.acumulado_positivacao_pedidos), 0) AS acumulado_positivacao_pedidos,
              AVG(r.perc_positivacao_acumulado) AS perc_positivacao_acumulado,
              COALESCE(SUM(r.acumulado_positivacao_fora_rota), 0) AS acumulado_positivacao_fora_rota,
              AVG(r.perc_positivacao_fora_rota) AS perc_positivacao_fora_rota
            FROM raiox r
            LEFT JOIN vendedores v ON v.cod_vendedor = r.cod_vendedor
            WHERE {" AND ".join(parts)}
            GROUP BY r.cod_vendedor
            ORDER BY equipe, vendedor
            """,
            params,
        ).fetchall()

        anos_rows = conn.execute(
            "SELECT DISTINCT ano_referencia FROM raiox ORDER BY ano_referencia DESC"
        ).fetchall()

    def hora(value: Any) -> str | None:
        return value.isoformat() if value else None

    out_rows = [
        {
            "codVendedor": r["cod_vendedor"],
            "vendedor": r["vendedor"],
            "equipe": r["equipe"],
            "diasComDados": int(r["dias_com_dados"] or 0),
            "visitasPrevistas": num(r["visitas_previstas"]),
            "visitasRealizadas": num(r["visitas_realizadas"]),
            "visitasForaRota": num(r["visitas_fora_rota"]),
            "percGps": round(num(r["perc_gps"]), 4),
            "apontamentosInconsistencia": num(r["apontamentos_inconsistencia"]),
            "positivaPrevista": num(r["positiva_prevista"]),
            "pedidos": num(r["pedidos"]),
            "percPositivacao": round(num(r["perc_positivacao"]), 4),
            "foraRotaPositivacao": num(r["fora_rota_positivacao"]),
            "percForaRota": round(num(r["perc_fora_rota"]), 4),
            "produtividade": round(num(r["produtividade"]), 4),
            "horaInicio": hora(r["hora_inicio"]),
            "horaCheckIn": hora(r["hora_check_in"]),
            "horaCheckOut": hora(r["hora_check_out"]),
            "horaFim": hora(r["hora_fim"]),
            "tempoCampo": r["tempo_campo"],
            "acumuladoPrevista": num(r["acumulado_prevista"]),
            "acumuladoRealizadas": num(r["acumulado_realizadas"]),
            "acumuladoPorcentagem": round(num(r["acumulado_porcentagem"]), 4),
            "acumuladoForaRota": num(r["acumulado_fora_rota"]),
            "percForaRotaAcumulado": round(num(r["perc_fora_rota_acumulado"]), 4),
            "acumuladoPositivacaoVisitas": num(r["acumulado_positivacao_visitas"]),
            "acumuladoPositivacaoPedidos": num(r["acumulado_positivacao_pedidos"]),
            "percPositivacaoAcumulado": round(num(r["perc_positivacao_acumulado"]), 4),
            "acumuladoPositivacaoForaRota": num(r["acumulado_positivacao_fora_rota"]),
            "percPositivacaoForaRota": round(num(r["perc_positivacao_fora_rota"]), 4),
        }
        for r in rows
    ]

    anos_disponiveis = [int(a["ano_referencia"]) for a in anos_rows]
    if ano_efetivo not in anos_disponiveis:
        anos_disponiveis = sorted({*anos_disponiveis, ano_efetivo}, reverse=True)

    return {
        "mode": "dia" if dia_ok else "periodo",
        "ano": ano_efetivo,
        "mes": mes if not dia_ok else None,
        "dia": dia_ok,
        "anosDisponiveis": anos_disponiveis,
        "rows": out_rows,
    }
