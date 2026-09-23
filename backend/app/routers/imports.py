from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Path, Query

from app.cache import invalidate_all
from app.db import get_connection
from app.errors import PublicServerError, log_exception, logger
import app.import_types as import_types
from app.parse import parse_date_only
from app.schemas import ImportRequest, ImportResultSummary, ImportRowError
from app.security import require_import_access, require_roles
from app.services import iso
from app.upsert import SnapshotContext, map_and_validate_rows, upsert_rows

router = APIRouter(prefix="/imports", tags=["imports"])


# Limite duro por POST — protege o banco de payloads monstruosos (DoS).
# O frontend fatia planilhas pesadas em lotes menores que este teto.
MAX_ROWS_PER_REQUEST = 2500


@router.post("", response_model=ImportResultSummary)
def create_import(
    body: ImportRequest,
    _access: dict[str, Any] | None = Depends(require_import_access),
) -> ImportResultSummary:
    cfg = import_types.get_import_type_config(body.tipo)
    if not cfg:
        available = ", ".join(sorted(getattr(import_types, "IMPORT_TYPE_CONFIGS", {}).keys()))
        logger.warning("Tipo de importação desconhecido recebido: %r", body.tipo)
        raise HTTPException(
            status_code=400,
            detail=f'Tipo de importação desconhecido: "{body.tipo}". Tipos válidos: {available}.',
        )

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
    if len(body.rows) > MAX_ROWS_PER_REQUEST:
        raise HTTPException(
            status_code=413,
            detail=(
                f"Lote com {len(body.rows)} linhas excede o limite de {MAX_ROWS_PER_REQUEST} "
                "por requisição. Envie a planilha fatiada em partes."
            ),
        )
    if not body.mapping:
        raise HTTPException(status_code=400, detail="Mapeamento de colunas ausente.")

    chunk_index = body.chunkIndex if body.chunkIndex is not None else 0
    total_chunks = body.totalChunks if body.totalChunks is not None else 1
    if chunk_index < 0 or total_chunks < 1 or chunk_index >= total_chunks:
        raise HTTPException(status_code=400, detail="Metadados de fatiamento inválidos (chunkIndex/totalChunks).")
    if chunk_index > 0 and body.importId is None:
        raise HTTPException(
            status_code=400,
            detail="Lotes seguintes exigem importId retornado no primeiro lote.",
        )

    row_offset = body.rowOffset or 0
    valid, errors = map_and_validate_rows(cfg, body.mapping, body.rows, row_offset=row_offset)
    data_importacao = datetime.now(UTC)
    total_linhas = len(body.rows)
    # Só o 1º lote de tipos replace_* pode apagar snapshot/tabela.
    clear_before = chunk_index == 0
    is_last_chunk = chunk_index >= total_chunks - 1

    try:
        with get_connection() as conn:
            if chunk_index == 0:
                seq = conn.execute(
                    "SELECT nextval(pg_get_serial_sequence('importacoes', 'id')) AS id"
                ).fetchone()
                importacao_id = int(seq["id"])
            else:
                importacao_id = int(body.importId)  # type: ignore[arg-type]
                existing = conn.execute(
                    "SELECT id, tipo FROM importacoes WHERE id = %s",
                    (importacao_id,),
                ).fetchone()
                if not existing:
                    raise HTTPException(status_code=400, detail=f'importId {importacao_id} não encontrado.')
                if existing["tipo"] != cfg.id:
                    raise HTTPException(
                        status_code=400,
                        detail="importId não corresponde ao tipo desta importação.",
                    )

            outcome = upsert_rows(
                conn,
                cfg,
                valid,
                importacao_id,
                data_importacao,
                SnapshotContext(data_referencia, mes_referencia, ano_referencia) if cfg.snapshot else None,
                clear_before=clear_before,
            )

            status_label = (
                "CONCLUIDO"
                if not errors
                else "CONCLUIDO_COM_AVISOS"
                if valid
                else "FALHA"
            )
            # Enquanto houver lotes pendentes, marca como parcial no log.
            if not is_last_chunk and status_label != "FALHA":
                log_status = "CONCLUIDO_COM_AVISOS"
            else:
                log_status = status_label

            if chunk_index == 0:
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
                        log_status,
                    ),
                )
            else:
                conn.execute(
                    """
                    UPDATE importacoes
                       SET total_linhas = total_linhas + %s,
                           novos = novos + %s,
                           atualizados = atualizados + %s,
                           rejeitados = rejeitados + %s,
                           status = %s,
                           data_importacao = %s
                     WHERE id = %s
                    """,
                    (
                        total_linhas,
                        outcome.novos,
                        outcome.atualizados,
                        len(errors),
                        log_status if is_last_chunk else "CONCLUIDO_COM_AVISOS",
                        data_importacao,
                        importacao_id,
                    ),
                )

            if errors:
                with conn.cursor() as cur:
                    cur.executemany(
                        "INSERT INTO importacoes_erros (importacao_id, linha, motivo) VALUES (%s, %s, %s)",
                        [(importacao_id, e.linha, e.motivo) for e in errors],
                    )

            # commit final import metadata (upsert_rows commits per chunk)
            conn.commit()
            invalidate_all()

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
            chunkIndex=chunk_index,
            totalChunks=total_chunks,
            done=is_last_chunk,
        )
    except HTTPException:
        raise
    except Exception as err:
        # Detalhe técnico só no log do servidor; na tela/histórico fica a mensagem
        # genérica com o código de referência para o suporte localizar o registro.
        ref = log_exception(f"Falha na importação tipo={cfg.id} arquivo={body.arquivo!r}", err)
        message = f"Falha interna ao processar a importação (ref. {ref})."
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
        raise PublicServerError("Falha ao processar a importação. Nenhum dado foi gravado.", ref=ref) from err


@router.get("")
def list_imports(
    tipo: str | None = Query(default=None, max_length=64, pattern=r"^[A-Za-z0-9_\-]+$"),
    limit: int = Query(default=100, ge=1, le=500),
    _admin: dict[str, Any] = Depends(require_roles("ADMIN")),
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


@router.delete("/history")
def clear_import_history(
    _admin: dict[str, Any] = Depends(require_roles("ADMIN")),
) -> dict[str, Any]:
    """Remove todo o histórico de importações (e erros associados via CASCADE)."""
    with get_connection() as conn:
        # Apaga erros primeiro para cobrir FKs sem ON DELETE CASCADE em bases legadas.
        err = conn.execute("DELETE FROM importacoes_erros")
        result = conn.execute("DELETE FROM importacoes")
        conn.commit()
        deleted = int(result.rowcount or 0)
        deleted_errors = int(err.rowcount or 0)
    return {"ok": True, "deleted": deleted, "deletedErrors": deleted_errors}


@router.get("/{import_id}/erros")
def list_import_errors(
    import_id: int = Path(ge=1, le=2**31 - 1),
    _admin: dict[str, Any] = Depends(require_roles("ADMIN")),
) -> list[dict[str, Any]]:
    with get_connection() as conn:
        rows = conn.execute(
            "SELECT linha, motivo FROM importacoes_erros WHERE importacao_id = %s ORDER BY linha",
            (import_id,),
        ).fetchall()
    return [dict(r) for r in rows]
