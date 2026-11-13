"""Metas definidas na tela.

Dois cadastros:

* **Metas por fabricante** (`metas_mensais`) — faturamento e cobertura por
  vendedor × fabricante. É a mesma tabela da planilha de metas; aqui a pessoa
  ajusta uma linha sem precisar reimportar o arquivo inteiro.
* **Metas gerais** (`metas_gerais`) — por VENDEDOR ou por EQUIPE: cobertura
  geral, sortimento, faseamento, faseamento II, desconcentração e desafio. A
  planilha não traz essas metas; antes elas só existiam na carga da aba Mês.

Precedência (função `metas_definidas`, usada pelo Dashboard, Objetivos e pela
ficha do cliente): campo preenchido aqui VENCE o valor importado da aba Mês;
campo vazio deixa o importado valer. Assim a tela complementa a carga, sem
obrigar a redigitar o que já veio certo.

Gravação passa pelo portão de escrita (`require_write("targets.edit")`):
Administrador confirma, perfis de apoio precisam de liberação, leitura não grava.
"""

from __future__ import annotations

import re
from typing import Any

from fastapi import APIRouter, Body, Depends, HTTPException, Query

from app.cache import invalidate_all
from app.db import get_connection
from app.sanitize import clean_optional, clean_text
from app.security import estado_escrita, get_current_user, has_permission, require_write
from app.services import num, scope_filters

router = APIRouter(tags=["metas"])

_ANO_MES = re.compile(r"^\d{4}-(0[1-9]|1[0-2])$")

#: Campo da API (camelCase) → coluna da tabela metas_gerais.
CAMPOS_GERAIS: dict[str, str] = {
    "metaCobertura": "meta_cobertura",
    "metaSortimento": "meta_sortimento",
    "metaFaseamento": "meta_faseamento",
    "metaFaseamentoII": "meta_faseamento_ii",
    "metaDesconcentracao": "meta_desconcentracao",
    "metaDesafio": "meta_desafio",
}


def _ano_mes(valor: Any) -> str:
    texto = str(valor or "").strip()
    if not _ANO_MES.match(texto):
        raise HTTPException(status_code=400, detail="Competência inválida: use o formato AAAA-MM.")
    return texto


def _numero_opcional(valor: Any, campo: str) -> float | None:
    if valor in (None, ""):
        return None
    try:
        n = float(valor)
    except (TypeError, ValueError) as exc:
        raise HTTPException(status_code=400, detail=f"Valor inválido em {campo}.") from exc
    if n < 0:
        raise HTTPException(status_code=400, detail=f"{campo} não pode ser negativo.")
    return n


def metas_definidas(
    conn: Any,
    ano: int | None,
    mes: int | None,
    equipe: str | None,
    vendedor: str | None,
) -> dict[str, float | None]:
    """Metas gerais definidas na tela para o recorte, por coluna.

    Devolve ``{coluna: valor}`` com ``None`` onde nada foi definido — o
    chamador mantém o valor importado nesses campos. Só vale para um mês
    fechado (ano + mês): metas são por competência, e somar meses parciais
    de um período personalizado daria um número sem sentido.

    Recorte:
      * vendedor → a linha do vendedor;
      * equipe   → a linha da equipe; sem ela, a soma das linhas dos
                   vendedores daquela equipe;
      * geral    → a soma das linhas de equipe; sem nenhuma, a soma das
                   linhas de vendedor.
    """
    vazio: dict[str, float | None] = {col: None for col in CAMPOS_GERAIS.values()}
    if not ano or not mes:
        return vazio
    ano_mes = f"{ano}-{mes:02d}"
    colunas = ", ".join(f"SUM({c}) AS {c}, COUNT({c}) AS n_{c}" for c in CAMPOS_GERAIS.values())

    def somar(where: str, params: list[Any]) -> dict[str, float | None]:
        row = conn.execute(
            f"SELECT {colunas} FROM metas_gerais WHERE ano_mes = %s AND {where}",
            [ano_mes, *params],
        ).fetchone()
        if not row:
            return dict(vazio)
        return {c: (num(row[c]) if int(row[f"n_{c}"] or 0) > 0 else None) for c in CAMPOS_GERAIS.values()}

    if vendedor:
        return somar("nivel = 'vendedor' AND chave = %s", [vendedor])

    if equipe:
        da_equipe = somar("nivel = 'equipe' AND chave = %s", [equipe])
        dos_vendedores = somar("nivel = 'vendedor' AND equipe = %s", [equipe])
        return {c: da_equipe[c] if da_equipe[c] is not None else dos_vendedores[c] for c in CAMPOS_GERAIS.values()}

    equipes = somar("nivel = 'equipe'", [])
    vendedores = somar("nivel = 'vendedor'", [])
    return {c: equipes[c] if equipes[c] is not None else vendedores[c] for c in CAMPOS_GERAIS.values()}


def aplicar(importado: float, definido: float | None) -> float:
    """Meta efetiva: a definida na tela, se houver; senão a importada."""
    return importado if definido is None else definido


# ─────────────────────────────────────────────────────────────────────────────
# Metas gerais (vendedor / equipe)
# ─────────────────────────────────────────────────────────────────────────────
@router.get("/metas/gerais")
def listar_metas_gerais(
    ano_mes: str = Query(max_length=7),
    user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    competencia = _ano_mes(ano_mes)
    escopo = scope_filters(user)
    parts = ["mg.ano_mes = %s"]
    params: list[Any] = [competencia]
    if escopo.get("vendedor"):
        parts.append("((mg.nivel = 'vendedor' AND mg.chave = %s))")
        params.append(escopo["vendedor"])
    elif escopo.get("equipe"):
        parts.append("(mg.equipe = %s OR (mg.nivel = 'equipe' AND mg.chave = %s))")
        params.extend([escopo["equipe"], escopo["equipe"]])
    elif escopo.get("fabricante"):
        parts.append("1=0")  # fornecedor não enxerga metas internas da Chok

    with get_connection() as conn:
        rows = conn.execute(
            f"""
            SELECT mg.*, v.nome AS nome_vendedor
            FROM metas_gerais mg
            LEFT JOIN vendedores v ON mg.nivel = 'vendedor' AND v.cod_vendedor = mg.chave
            WHERE {" AND ".join(parts)}
            ORDER BY mg.nivel DESC, COALESCE(mg.equipe, mg.chave), mg.chave
            """,
            params,
        ).fetchall()

    def linha(r: dict[str, Any]) -> dict[str, Any]:
        out = {
            "anoMes": r["ano_mes"],
            "nivel": r["nivel"],
            "chave": r["chave"],
            "nome": r["nome_vendedor"] if r["nivel"] == "vendedor" else r["chave"],
            "equipe": r["equipe"] if r["nivel"] == "vendedor" else r["chave"],
            "observacao": r["observacao"],
            "atualizadoEm": r["atualizado_em"].isoformat() if r["atualizado_em"] else None,
            "criadoPor": r["criado_por"],
        }
        for campo, coluna in CAMPOS_GERAIS.items():
            out[campo] = num(r[coluna]) if r[coluna] is not None else None
        return out

    return {
        "anoMes": competencia,
        "metas": [linha(r) for r in rows],
        "podeGravar": has_permission(user, "targets.edit") and estado_escrita(user)["podeAlterar"],
    }


@router.put("/metas/gerais")
def gravar_meta_geral(
    body: dict[str, Any] = Body(...),
    user: dict[str, Any] = Depends(require_write("targets.edit")),
) -> dict[str, Any]:
    competencia = _ano_mes(body.get("anoMes"))
    nivel = str(body.get("nivel") or "").lower()
    if nivel not in ("vendedor", "equipe"):
        raise HTTPException(status_code=400, detail="Informe se a meta é de vendedor ou de equipe.")
    chave = clean_text(body.get("chave"), 120)
    if not chave:
        raise HTTPException(status_code=400, detail="Informe o vendedor ou a equipe.")

    valores = {coluna: _numero_opcional(body.get(campo), campo) for campo, coluna in CAMPOS_GERAIS.items()}
    if all(v is None for v in valores.values()):
        raise HTTPException(status_code=400, detail="Preencha pelo menos uma meta.")

    with get_connection() as conn:
        if nivel == "vendedor":
            vend = conn.execute("SELECT equipe FROM vendedores WHERE cod_vendedor = %s", (chave,)).fetchone()
            if vend is None:
                raise HTTPException(status_code=400, detail="Vendedor não encontrado no cadastro.")
            equipe = clean_optional(body.get("equipe"), 120) or vend["equipe"]
        else:
            equipe = chave

        colunas = list(valores.keys())
        conn.execute(
            f"""
            INSERT INTO metas_gerais
              (ano_mes, nivel, chave, equipe, {", ".join(colunas)}, observacao, criado_por, atualizado_em)
            VALUES (%s, %s, %s, %s, {", ".join(["%s"] * len(colunas))}, %s, %s, now())
            ON CONFLICT (ano_mes, nivel, chave) DO UPDATE SET
              equipe = EXCLUDED.equipe,
              {", ".join(f"{c} = EXCLUDED.{c}" for c in colunas)},
              observacao = EXCLUDED.observacao,
              criado_por = EXCLUDED.criado_por,
              atualizado_em = now()
            """,
            [
                competencia,
                nivel,
                chave,
                equipe,
                *valores.values(),
                clean_optional(body.get("observacao"), 400),
                str(user.get("email") or user.get("id")),
            ],
        )
        conn.commit()
    invalidate_all()
    return {"ok": True}


@router.delete("/metas/gerais")
def remover_meta_geral(
    ano_mes: str = Query(max_length=7),
    nivel: str = Query(pattern="^(vendedor|equipe)$"),
    chave: str = Query(max_length=120),
    _user: dict[str, Any] = Depends(require_write("targets.edit")),
) -> dict[str, Any]:
    with get_connection() as conn:
        apagadas = conn.execute(
            "DELETE FROM metas_gerais WHERE ano_mes = %s AND nivel = %s AND chave = %s",
            (_ano_mes(ano_mes), nivel, chave),
        ).rowcount
        conn.commit()
    if not apagadas:
        raise HTTPException(status_code=404, detail="Meta não encontrada.")
    invalidate_all()
    return {"ok": True}


# ─────────────────────────────────────────────────────────────────────────────
# Metas por fabricante (mesma tabela da planilha)
# ─────────────────────────────────────────────────────────────────────────────
@router.put("/metas/fabricante")
def gravar_meta_fabricante(
    body: dict[str, Any] = Body(...),
    user: dict[str, Any] = Depends(require_write("targets.edit")),
) -> dict[str, Any]:
    competencia = _ano_mes(body.get("anoMes"))
    cod_vendedor = clean_text(body.get("codVendedor"), 40)
    fabricante = clean_text(body.get("fabricante"), 160)
    if not cod_vendedor or not fabricante:
        raise HTTPException(status_code=400, detail="Informe o vendedor e o fabricante.")
    faturamento = _numero_opcional(body.get("metaFaturamento"), "Meta de faturamento")
    cobertura = _numero_opcional(body.get("metaCobertura"), "Meta de cobertura")
    if faturamento is None and cobertura is None:
        raise HTTPException(status_code=400, detail="Preencha a meta de faturamento ou de cobertura.")

    with get_connection() as conn:
        vend = conn.execute("SELECT equipe FROM vendedores WHERE cod_vendedor = %s", (cod_vendedor,)).fetchone()
        if vend is None:
            raise HTTPException(status_code=400, detail="Vendedor não encontrado no cadastro.")
        equipe = clean_optional(body.get("equipe"), 120) or vend["equipe"]
        conn.execute(
            """
            INSERT INTO metas_mensais
              (ano_mes, cod_vendedor, equipe, fabricante, meta_faturamento, meta_cobertura, data_importacao)
            VALUES (%s, %s, %s, %s, %s, %s, now())
            ON CONFLICT (ano_mes, cod_vendedor, fabricante) DO UPDATE SET
              equipe = EXCLUDED.equipe,
              meta_faturamento = EXCLUDED.meta_faturamento,
              meta_cobertura = EXCLUDED.meta_cobertura,
              data_importacao = now()
            """,
            (competencia, cod_vendedor, equipe, fabricante, faturamento, cobertura),
        )
        conn.commit()
    invalidate_all()
    return {"ok": True, "registradoPor": str(user.get("email") or user.get("id"))}


@router.delete("/metas/fabricante")
def remover_meta_fabricante(
    ano_mes: str = Query(max_length=7),
    cod_vendedor: str = Query(max_length=40),
    fabricante: str = Query(max_length=160),
    _user: dict[str, Any] = Depends(require_write("targets.edit")),
) -> dict[str, Any]:
    with get_connection() as conn:
        apagadas = conn.execute(
            "DELETE FROM metas_mensais WHERE ano_mes = %s AND cod_vendedor = %s AND fabricante = %s",
            (_ano_mes(ano_mes), cod_vendedor, fabricante),
        ).rowcount
        conn.commit()
    if not apagadas:
        raise HTTPException(status_code=404, detail="Meta não encontrada.")
    invalidate_all()
    return {"ok": True}
