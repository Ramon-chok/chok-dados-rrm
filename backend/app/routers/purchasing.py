"""Seção 3 — módulo de Compras (perfil Comprador).

Cadastro e acompanhamento de fornecedores, negociações e fechamentos, com
valores, custos, descontos, bonificações e investimentos.

Permissões (conferidas no servidor, não na tela):

* ``purchasing.view`` — ler fornecedores, negociações e o resumo;
* ``purchasing.edit`` — criar, alterar e remover.

Hoje só ADMIN, COMPRADOR e GERENTE_COMERCIAL chegam aqui; qualquer outro perfil
recebe 403 mesmo digitando a URL na mão.
"""

from __future__ import annotations

from datetime import date
from typing import Any

from fastapi import APIRouter, Body, Depends, HTTPException, Query

from app.db import get_connection
from app.sanitize import clean_optional, clean_text, like_pattern
from app.security import require_permission, require_write
from app.services import num

router = APIRouter(tags=["purchasing"])

_STATUS_FORNECEDOR = {"Ativo", "Inativo"}
_STATUS_NEGOCIACAO = {"aberta", "fechada", "cancelada"}


def _parse_dia(valor: Any, campo: str) -> date | None:
    if valor in (None, ""):
        return None
    try:
        return date.fromisoformat(str(valor).strip()[:10])
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=f'Data inválida em "{campo}".') from exc


def _numero(body: dict[str, Any], chave: str) -> float | None:
    valor = body.get(chave)
    if valor in (None, ""):
        return None
    try:
        return round(float(valor), 2)
    except (TypeError, ValueError) as exc:
        raise HTTPException(status_code=400, detail=f'Valor numérico inválido em "{chave}".') from exc


# ─────────────────────────────────────────────────────────────────────────────
# Fornecedores
# ─────────────────────────────────────────────────────────────────────────────
def _fornecedor_out(r: Any) -> dict[str, Any]:
    return {
        "id": r["id"],
        "nome": r["nome"],
        "cnpj": r["cnpj"],
        "fabricante": r["fabricante"],
        "contato": r["contato"],
        "email": r["email"],
        "telefone": r["telefone"],
        "condicaoPagamento": r["condicao_pagamento"],
        "observacoes": r["observacoes"],
        "status": r["status"],
    }


@router.get("/purchasing/suppliers")
def listar_fornecedores(
    q: str | None = Query(default=None, max_length=80),
    status: str | None = Query(default=None, max_length=20),
    _user: dict[str, Any] = Depends(require_permission("purchasing.view")),
) -> list[dict[str, Any]]:
    parts = ["1=1"]
    params: list[Any] = []
    if q:
        parts.append("(nome ILIKE %s OR cnpj ILIKE %s OR fabricante ILIKE %s)")
        like = like_pattern(q)
        params.extend([like, like, like])
    if status in _STATUS_FORNECEDOR:
        parts.append("status = %s")
        params.append(status)
    with get_connection() as conn:
        rows = conn.execute(
            f"SELECT * FROM fornecedores WHERE {' AND '.join(parts)} ORDER BY nome LIMIT 500",
            params,
        ).fetchall()
    return [_fornecedor_out(r) for r in rows]


def _fornecedor_payload(body: dict[str, Any]) -> dict[str, Any]:
    nome = clean_text(body.get("nome"), 200)
    if not nome:
        raise HTTPException(status_code=400, detail="Informe o nome do fornecedor.")
    status_valor = clean_text(body.get("status") or "Ativo", 20)
    # CNPJ guardado só com dígitos, para não duplicar o mesmo fornecedor por
    # causa da pontuação (o índice único é sobre o valor gravado).
    cnpj_bruto = clean_optional(body.get("cnpj"), 32)
    cnpj = "".join(c for c in (cnpj_bruto or "") if c.isdigit()) or None
    return {
        "nome": nome,
        "cnpj": cnpj,
        "fabricante": clean_optional(body.get("fabricante"), 160),
        "contato": clean_optional(body.get("contato"), 200),
        "email": clean_optional(body.get("email"), 200),
        "telefone": clean_optional(body.get("telefone"), 60),
        "condicao_pagamento": clean_optional(body.get("condicaoPagamento"), 120),
        "observacoes": clean_optional(body.get("observacoes"), 2000),
        "status": status_valor if status_valor in _STATUS_FORNECEDOR else "Ativo",
    }


@router.post("/purchasing/suppliers", status_code=201)
def criar_fornecedor(
    body: dict[str, Any] = Body(...),
    user: dict[str, Any] = Depends(require_write("purchasing.edit")),
) -> dict[str, Any]:
    dados = _fornecedor_payload(body)
    colunas = ", ".join(dados.keys())
    marcas = ", ".join(["%s"] * len(dados))
    with get_connection() as conn:
        existente = (
            conn.execute("SELECT id FROM fornecedores WHERE cnpj = %s", (dados["cnpj"],)).fetchone()
            if dados["cnpj"]
            else None
        )
        if existente:
            raise HTTPException(status_code=409, detail="Já existe um fornecedor com este CNPJ.")
        row = conn.execute(
            f"INSERT INTO fornecedores ({colunas}, criado_por) VALUES ({marcas}, %s) RETURNING *",
            [*dados.values(), str(user["id"])],
        ).fetchone()
        conn.commit()
    return _fornecedor_out(row)


@router.patch("/purchasing/suppliers/{fornecedor_id}")
def atualizar_fornecedor(
    fornecedor_id: int,
    body: dict[str, Any] = Body(...),
    _user: dict[str, Any] = Depends(require_write("purchasing.edit")),
) -> dict[str, Any]:
    dados = _fornecedor_payload(body)
    sets = ", ".join(f"{c} = %s" for c in dados)
    with get_connection() as conn:
        if dados["cnpj"]:
            conflito = conn.execute(
                "SELECT id FROM fornecedores WHERE cnpj = %s AND id <> %s", (dados["cnpj"], fornecedor_id)
            ).fetchone()
            if conflito:
                raise HTTPException(status_code=409, detail="Já existe outro fornecedor com este CNPJ.")
        row = conn.execute(
            f"UPDATE fornecedores SET {sets}, atualizado_em = now() WHERE id = %s RETURNING *",
            [*dados.values(), fornecedor_id],
        ).fetchone()
        conn.commit()
    if not row:
        raise HTTPException(status_code=404, detail="Fornecedor não encontrado.")
    return _fornecedor_out(row)


@router.delete("/purchasing/suppliers/{fornecedor_id}")
def remover_fornecedor(
    fornecedor_id: int,
    _user: dict[str, Any] = Depends(require_write("purchasing.edit")),
) -> dict[str, bool]:
    with get_connection() as conn:
        row = conn.execute("DELETE FROM fornecedores WHERE id = %s RETURNING id", (fornecedor_id,)).fetchone()
        conn.commit()
    if not row:
        raise HTTPException(status_code=404, detail="Fornecedor não encontrado.")
    return {"ok": True}


# ─────────────────────────────────────────────────────────────────────────────
# Negociações / pedidos de compra
# ─────────────────────────────────────────────────────────────────────────────
def _negociacao_out(r: Any) -> dict[str, Any]:
    valor = num(r["valor_compra"])
    desconto = num(r["desconto"])
    bonificacao = num(r["bonificacao"])
    investimento = num(r["investimento"])
    return {
        "id": r["id"],
        "fornecedorId": r["fornecedor_id"],
        "fornecedor": r.get("fornecedor_nome"),
        "fabricante": r["fabricante"],
        "categoria": r["categoria"],
        "descricao": r["descricao"],
        "dataNegociacao": r["data_negociacao"].isoformat() if r["data_negociacao"] else None,
        "valorCompra": valor,
        "desconto": desconto,
        "bonificacao": bonificacao,
        "investimento": investimento,
        # Custo efetivo: o que sai do caixa depois de desconto e bonificação.
        "custoLiquido": round(valor - desconto - bonificacao, 2),
        "status": r["status"],
    }


@router.get("/purchasing/negotiations")
def listar_negociacoes(
    start: str | None = Query(default=None, max_length=10),
    end: str | None = Query(default=None, max_length=10),
    fornecedor_id: int | None = Query(default=None, ge=1),
    status: str | None = Query(default=None, max_length=20),
    _user: dict[str, Any] = Depends(require_permission("purchasing.view")),
) -> dict[str, Any]:
    parts = ["1=1"]
    params: list[Any] = []
    if start:
        parts.append("n.data_negociacao >= %s")
        params.append(_parse_dia(start, "start"))
    if end:
        parts.append("n.data_negociacao <= %s")
        params.append(_parse_dia(end, "end"))
    if fornecedor_id:
        parts.append("n.fornecedor_id = %s")
        params.append(fornecedor_id)
    if status in _STATUS_NEGOCIACAO:
        parts.append("n.status = %s")
        params.append(status)
    where = " AND ".join(parts)

    with get_connection() as conn:
        rows = conn.execute(
            f"""
            SELECT n.*, f.nome AS fornecedor_nome
            FROM negociacoes_compra n
            LEFT JOIN fornecedores f ON f.id = n.fornecedor_id
            WHERE {where}
            ORDER BY n.data_negociacao DESC, n.id DESC
            LIMIT 500
            """,
            params,
        ).fetchall()
        resumo = conn.execute(
            f"""
            SELECT COUNT(*) AS total,
                   COUNT(*) FILTER (WHERE n.status = 'fechada') AS fechadas,
                   COALESCE(SUM(n.valor_compra), 0) AS valor,
                   COALESCE(SUM(n.desconto), 0) AS desconto,
                   COALESCE(SUM(n.bonificacao), 0) AS bonificacao,
                   COALESCE(SUM(n.investimento), 0) AS investimento
            FROM negociacoes_compra n WHERE {where}
            """,
            params,
        ).fetchone()

    valor = num(resumo["valor"])
    desconto = num(resumo["desconto"])
    bonificacao = num(resumo["bonificacao"])
    return {
        "resumo": {
            "total": int(resumo["total"] or 0),
            "fechadas": int(resumo["fechadas"] or 0),
            "valorCompra": round(valor, 2),
            "desconto": round(desconto, 2),
            "bonificacao": round(bonificacao, 2),
            "investimento": round(num(resumo["investimento"]), 2),
            "custoLiquido": round(valor - desconto - bonificacao, 2),
            "pctDesconto": round(desconto / valor * 100, 2) if valor else 0.0,
        },
        "negociacoes": [_negociacao_out(r) for r in rows],
    }


def _negociacao_payload(body: dict[str, Any]) -> dict[str, Any]:
    data_negociacao = _parse_dia(body.get("dataNegociacao"), "dataNegociacao")
    if data_negociacao is None:
        raise HTTPException(status_code=400, detail="Informe a data da negociação.")
    status_valor = clean_text(body.get("status") or "aberta", 20)
    fornecedor = body.get("fornecedorId")
    return {
        "fornecedor_id": int(fornecedor) if fornecedor not in (None, "") else None,
        "fabricante": clean_optional(body.get("fabricante"), 160),
        "categoria": clean_optional(body.get("categoria"), 160),
        "descricao": clean_optional(body.get("descricao"), 2000),
        "data_negociacao": data_negociacao,
        "valor_compra": _numero(body, "valorCompra"),
        "desconto": _numero(body, "desconto"),
        "bonificacao": _numero(body, "bonificacao"),
        "investimento": _numero(body, "investimento"),
        "status": status_valor if status_valor in _STATUS_NEGOCIACAO else "aberta",
    }


@router.post("/purchasing/negotiations", status_code=201)
def criar_negociacao(
    body: dict[str, Any] = Body(...),
    user: dict[str, Any] = Depends(require_write("purchasing.edit")),
) -> dict[str, Any]:
    dados = _negociacao_payload(body)
    colunas = ", ".join(dados.keys())
    marcas = ", ".join(["%s"] * len(dados))
    with get_connection() as conn:
        row = conn.execute(
            f"INSERT INTO negociacoes_compra ({colunas}, criado_por) VALUES ({marcas}, %s) RETURNING id",
            [*dados.values(), str(user["id"])],
        ).fetchone()
        conn.commit()
    return {"ok": True, "id": row["id"]}


@router.patch("/purchasing/negotiations/{negociacao_id}")
def atualizar_negociacao(
    negociacao_id: int,
    body: dict[str, Any] = Body(...),
    _user: dict[str, Any] = Depends(require_write("purchasing.edit")),
) -> dict[str, Any]:
    dados = _negociacao_payload(body)
    sets = ", ".join(f"{c} = %s" for c in dados)
    with get_connection() as conn:
        row = conn.execute(
            f"UPDATE negociacoes_compra SET {sets}, atualizado_em = now() WHERE id = %s RETURNING id",
            [*dados.values(), negociacao_id],
        ).fetchone()
        conn.commit()
    if not row:
        raise HTTPException(status_code=404, detail="Negociação não encontrada.")
    return {"ok": True, "id": row["id"]}


@router.delete("/purchasing/negotiations/{negociacao_id}")
def remover_negociacao(
    negociacao_id: int,
    _user: dict[str, Any] = Depends(require_write("purchasing.edit")),
) -> dict[str, bool]:
    with get_connection() as conn:
        row = conn.execute(
            "DELETE FROM negociacoes_compra WHERE id = %s RETURNING id", (negociacao_id,)
        ).fetchone()
        conn.commit()
    if not row:
        raise HTTPException(status_code=404, detail="Negociação não encontrada.")
    return {"ok": True}
