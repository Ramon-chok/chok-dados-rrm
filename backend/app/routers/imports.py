from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query

from app.db import get_connection
from app.import_types import get_import_type_config
from app.parse import parse_date_only
from app.schemas import ImportRequest, ImportResultSummary, ImportRowError
from app.security import require_import_api_key
from app.services import iso
from app.upsert import SnapshotContext, map_and_validate_rows, upsert_rows

router = APIRouter(prefix="/imports", tags=["imports"])


@router.post("", response_model=ImportResultSummary)
def create_import(
    body: ImportRequest,
    _: None = Depends(require_import_api_key),
) -> ImportResultSummary:
    cfg = get_import_type_config(body.tipo)
    if not cfg:
        raise HTTPException(status_code=400, detail=f'Tipo de importação desconhecido: "{body.tipo}".')

    ok, data_referencia = parse_date_only(body.dataReferencia)
    if not ok or not data_referencia:
        raise HTTPException(
            status_code=400,
            detail="data_referencia é obrigatória e deve ser uma data válida (regra 10 do processo).",
        )

    ano_str, mes_str, _ = data_referencia.split("-")
    mes_referencia = int(mes_str)
    ano_referencia = int(ano_str)

    if not body.rows:
        raise HTTPException(status_code=400, detail="Nenhuma linha para importar.")
    if not body.mapping:
        raise HTTPException(status_code=400, detail="Mapeamento de colunas ausente.")

    valid, errors = map_and_validate_rows(cfg, body.mapping, body.rows)
    data_importacao = datetime.now(UTC)
    total_linhas = len(body.rows)

    try:
        with get_connection() as conn:
            with conn.transaction():
                seq = conn.execute(
                    "SELECT nextval(pg_get_serial_sequence('importacoes', 'id')) AS id"
                ).fetchone()
                importacao_id = int(seq["id"])

                outcome = upsert_rows(
                    conn,
                    cfg,
                    valid,
                    importacao_id,
                    data_importacao,
                    SnapshotContext(data_referencia, mes_referencia, ano_referencia) if cfg.snapshot else None,
                )

                status_label = (
                    "CONCLUIDO"
                    if not errors
                    else "CONCLUIDO_COM_AVISOS"
                    if valid
                    else "FALHA"
                )

                conn.execute(
                    """
                    INSERT INTO importacoes
                      (id, tipo, arquivo, usuario_nome, usuario_email, data_referencia, mes_referencia, ano_referencia,
                       data_importacao, total_linhas, novos, atualizados, rejeitados, status)
                    VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                    """,
                    (
                        importacao_id,
                        cfg.id,
                        body.arquivo,
                        body.usuarioNome,
                        body.usuarioEmail,
                        data_referencia,
                        mes_referencia,
                        ano_referencia,
                        data_importacao,
                        total_linhas,
                        outcome.novos,
                        outcome.atualizados,
                        len(errors),
                        status_label,
                    ),
                )

                if errors:
                    conn.executemany(
                        "INSERT INTO importacoes_erros (importacao_id, linha, motivo) VALUES (%s, %s, %s)",
                        [(importacao_id, e.linha, e.motivo) for e in errors],
                    )

        return ImportResultSummary(
            importId=importacao_id,
            tipo=cfg.id,
            tipoLabel=cfg.label,
            arquivo=body.arquivo,
            dataReferencia=data_referencia,
            totalAnalisados=total_linhas,
            novos=outcome.novos,
            atualizados=outcome.atualizados,
            rejeitados=len(errors),
            status=status_label,  # type: ignore[arg-type]
            erros=[ImportRowError(linha=e.linha, motivo=e.motivo) for e in errors],
        )
    except HTTPException:
        raise
    except Exception as err:
        message = str(err)
        try:
            with get_connection() as conn:
                conn.execute(
                    """
                    INSERT INTO importacoes
                      (tipo, arquivo, usuario_nome, usuario_email, data_referencia, mes_referencia, ano_referencia,
                       data_importacao, total_linhas, novos, atualizados, rejeitados, status, mensagem_erro)
                    VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,0,0,%s,'FALHA',%s)
                    """,
                    (
                        cfg.id,
                        body.arquivo,
                        body.usuarioNome,
                        body.usuarioEmail,
                        data_referencia,
                        mes_referencia,
                        ano_referencia,
                        data_importacao,
                        total_linhas,
                        total_linhas,
                        message,
                    ),
                )
                conn.commit()
        except Exception:
            pass
        raise HTTPException(
            status_code=500,
            detail="Falha ao processar a importação. Nenhum dado foi gravado.",
        ) from err


@router.get("")
def list_imports(
    tipo: str | None = None,
    limit: int = Query(default=100, ge=1, le=500),
) -> list[dict[str, Any]]:
    params: list[Any] = []
    where = ""
    if tipo:
        where = "WHERE tipo = %s"
        params.append(tipo)
    params.append(limit)
    with get_connection() as conn:
        rows = conn.execute(
            f"""
            SELECT id, tipo, arquivo, usuario_nome, usuario_email, data_referencia, mes_referencia,
                   ano_referencia, data_importacao, total_linhas, novos, atualizados, rejeitados, status, mensagem_erro
            FROM importacoes
            {where}
            ORDER BY data_importacao DESC
            LIMIT %s
            """,
            params,
        ).fetchall()
    out: list[dict[str, Any]] = []
    for r in rows:
        item = dict(r)
        item["data_referencia"] = iso(item.get("data_referencia"))
        item["data_importacao"] = iso(item.get("data_importacao"))
        out.append(item)
    return out


@router.get("/{import_id}/erros")
def list_import_errors(import_id: int) -> list[dict[str, Any]]:
    with get_connection() as conn:
        rows = conn.execute(
            "SELECT linha, motivo FROM importacoes_erros WHERE importacao_id = %s ORDER BY linha",
            (import_id,),
        ).fetchall()
    return [dict(r) for r in rows]
