"""Motor genérico de UPSERT em lote (espelho de server/upsert.ts).

Regra de importação: NENHUMA linha válida da planilha é descartada por
duplicidade de chave antes da gravação. Tudo o que passou na validação
é processado.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Any

from psycopg import Connection
from psycopg.types.json import Jsonb

from app.import_types import ImportTypeConfig
from app.parse import (
    parse_boolean,
    parse_date_only,
    parse_duration,
    parse_integer,
    parse_numeric,
    parse_text,
    parse_time_of_day,
)

CHUNK_SIZE = 500


@dataclass
class RowError:
    linha: int
    motivo: str


@dataclass
class MappedRow:
    linha: int
    values: dict[str, Any]


@dataclass
class SnapshotContext:
    data_referencia: str
    mes_referencia: int
    ano_referencia: int


@dataclass
class UpsertOutcome:
    novos: int
    atualizados: int


EMPTY_DASHES = {"-", "–", "—"}


def map_and_validate_rows(
    cfg: ImportTypeConfig,
    mapping: dict[str, str],
    raw_rows: list[dict[str, Any]],
    row_offset: int = 0,
) -> tuple[list[MappedRow], list[RowError]]:
    valid: list[MappedRow] = []
    errors: list[RowError] = []

    mapped_headers = {h for h in mapping.values() if h}

    for idx, raw in enumerate(raw_rows):
        # row_offset permite que lotes fatiados reportem o número real da
        # linha no arquivo original (1-based no arquivo completo).
        linha = row_offset + idx + 1
        values: dict[str, Any] = {}
        row_error: str | None = None

        for col in cfg.columns:
            if col.kind == "jsonb" and cfg.dynamic_json_column and col.name == cfg.dynamic_json_column:
                json_value: dict[str, Any] = {}
                for header, cell_value in raw.items():
                    if header in mapped_headers:
                        continue
                    if cell_value is None or cell_value == "":
                        continue
                    ok_num, num_val = parse_numeric(cell_value)
                    json_value[header] = num_val if ok_num and num_val is not None else cell_value
                values[col.name] = json_value
                continue

            source_header = mapping.get(col.name)
            raw_value = raw.get(source_header) if source_header else None
            # Planilhas do SAR usam "-" como "vazio" em colunas não-texto
            # (ex.: hora/valor de uma visita sem venda) — vira célula vazia.
            if col.kind != "text" and isinstance(raw_value, str) and raw_value.strip() in EMPTY_DASHES:
                raw_value = None

            if col.kind == "numeric":
                parsed_ok, parsed_val = parse_numeric(raw_value)
            elif col.kind == "integer":
                parsed_ok, parsed_val = parse_integer(raw_value)
            elif col.kind == "date":
                parsed_ok, parsed_val = parse_date_only(raw_value)
                # Allow empty dates for non-key columns (some date columns
                # are optional in the layout, e.g. Data Final Desconcentração).
                # parse_date_only returns (False, 'data ausente') for empty
                # values; convert that into a successful parse with None
                # when the column is not part of the key.
                if not parsed_ok and parsed_val == "data ausente" and col.name not in cfg.key_columns:
                    parsed_ok, parsed_val = True, None
            elif col.kind == "boolean":
                parsed_ok, parsed_val = parse_boolean(raw_value)
            elif col.kind == "time":
                parsed_ok, parsed_val = parse_time_of_day(raw_value)
            elif col.kind == "duration":
                parsed_ok, parsed_val = parse_duration(raw_value)
            elif col.kind == "jsonb":
                parsed_ok, parsed_val = True, raw_value if isinstance(raw_value, dict) else {}
            else:
                parsed_ok, parsed_val = parse_text(raw_value)

            if not parsed_ok:
                row_error = f'coluna "{col.name}": {parsed_val}'
                break

            if col.name in cfg.key_columns and (parsed_val is None or parsed_val == ""):
                row_error = f'coluna de chave "{col.name}" está vazia'
                break

            values[col.name] = parsed_val

        if row_error:
            errors.append(RowError(linha=linha, motivo=row_error))
        else:
            valid.append(MappedRow(linha=linha, values=values))

    return valid, errors


def _row_params(
    cfg: ImportTypeConfig,
    row: MappedRow,
    value_columns: list[str],
    importacao_id: int,
    data_importacao: datetime,
    snapshot: SnapshotContext | None,
) -> list[Any]:
    params: list[Any] = []
    for c in value_columns:
        val = row.values.get(c)
        col_cfg = next((cc for cc in cfg.columns if cc.name == c), None)
        if col_cfg and col_cfg.kind == "jsonb":
            # psycopg não adapta dict puro para jsonb — precisa do wrapper.
            val = Jsonb(val if isinstance(val, dict) else {})
        params.append(val)
    if cfg.snapshot and snapshot:
        params.extend([snapshot.data_referencia, snapshot.mes_referencia, snapshot.ano_referencia])
    if cfg.tracks_import:
        params.extend([data_importacao, importacao_id])
    return params


def _insert_columns(cfg: ImportTypeConfig) -> list[str]:
    value_columns = [c.name for c in cfg.columns]
    extra_columns: list[str] = []
    if cfg.snapshot:
        extra_columns.extend(["data_referencia", "mes_referencia", "ano_referencia"])
    if cfg.tracks_import:
        extra_columns.extend(["data_importacao", "importacao_id"])
    return [*value_columns, *extra_columns]


def _bulk_insert_all(
    conn: Connection,
    cfg: ImportTypeConfig,
    rows: list[MappedRow],
    importacao_id: int,
    data_importacao: datetime,
    snapshot: SnapshotContext | None,
) -> UpsertOutcome:
    """Insere TODAS as linhas do arquivo, sem ON CONFLICT e sem dedupe."""
    value_columns = [c.name for c in cfg.columns]
    insert_columns = _insert_columns(cfg)

    novos = 0
    for i in range(0, len(rows), CHUNK_SIZE):
        chunk = rows[i : i + CHUNK_SIZE]
        params: list[Any] = []
        tuples: list[str] = []

        for row in chunk:
            row_params = _row_params(
                cfg, row, value_columns, importacao_id, data_importacao, snapshot
            )
            placeholders = ", ".join(["%s"] * len(row_params))
            tuples.append(f"({placeholders})")
            params.extend(row_params)

        sql = f"INSERT INTO {cfg.table} ({', '.join(insert_columns)}) VALUES {', '.join(tuples)}"
        conn.execute(sql, params)
        novos += len(chunk)
        conn.commit()

    return UpsertOutcome(novos=novos, atualizados=0)


def _replace_snapshot_rows(
    conn: Connection,
    cfg: ImportTypeConfig,
    rows: list[MappedRow],
    importacao_id: int,
    data_importacao: datetime,
    snapshot: SnapshotContext,
    *,
    clear_before: bool = True,
) -> UpsertOutcome:
    """Apaga o snapshot da data_referencia (se clear_before) e grava o lote."""
    if clear_before:
        conn.execute(f"DELETE FROM {cfg.table} WHERE data_referencia = %s", (snapshot.data_referencia,))
    return _bulk_insert_all(conn, cfg, rows, importacao_id, data_importacao, snapshot)


def _replace_all_rows(
    conn: Connection,
    cfg: ImportTypeConfig,
    rows: list[MappedRow],
    importacao_id: int,
    data_importacao: datetime,
    snapshot: SnapshotContext | None,
    *,
    clear_before: bool = True,
) -> UpsertOutcome:
    """Apaga a tabela inteira (se clear_before) e grava o lote (ex.: sortimento)."""
    if clear_before:
        conn.execute(f"DELETE FROM {cfg.table}")
    return _bulk_insert_all(conn, cfg, rows, importacao_id, data_importacao, snapshot)


def upsert_rows(
    conn: Connection,
    cfg: ImportTypeConfig,
    rows: list[MappedRow],
    importacao_id: int,
    data_importacao: datetime,
    snapshot: SnapshotContext | None,
    *,
    clear_before: bool = True,
) -> UpsertOutcome:
    """Grava todas as linhas válidas da planilha.

    Nenhuma linha é descartada por duplicidade de chave antes da gravação.
    - replace_all_rows: DELETE tabela + INSERT de todas as linhas
    - replace_snapshot_rows: DELETE do dia + INSERT de todas as linhas
    - demais tipos: UPSERT linha a linha (cada ocorrência do arquivo é aplicada;
      evita erro do Postgres com a mesma chave repetida no mesmo statement)

    clear_before=False é usado nos lotes seguintes de uma importação fatiada
    (só o 1º POST pode apagar snapshot/tabela; os demais apenas acrescentam).
    """
    if not rows:
        return UpsertOutcome(0, 0)

    if getattr(cfg, "replace_all_rows", False):
        return _replace_all_rows(
            conn, cfg, rows, importacao_id, data_importacao, snapshot, clear_before=clear_before
        )

    if cfg.replace_snapshot_rows:
        assert snapshot is not None, "replace_snapshot_rows requer snapshot=True"
        return _replace_snapshot_rows(
            conn, cfg, rows, importacao_id, data_importacao, snapshot, clear_before=clear_before
        )

    value_columns = [c.name for c in cfg.columns]
    insert_columns = _insert_columns(cfg)
    update_parts = [f"{c} = EXCLUDED.{c}" for c in insert_columns if c not in cfg.key_columns]
    if not cfg.tracks_import:
        # Tabelas de cadastro não recebem data_importacao/importacao_id (não
        # têm essas colunas) — em vez disso, tocam atualizado_em no UPDATE.
        # No INSERT, o DEFAULT now() da coluna já cobre a linha nova.
        update_parts.append("atualizado_em = now()")
    update_set = ", ".join(update_parts) if update_parts else None

    novos = 0
    atualizados = 0

    # Uma linha por statement: cada ocorrência da planilha é processada.
    # Evita "ON CONFLICT DO UPDATE cannot affect row a second time" e
    # NÃO remove linhas do arquivo antes de gravar.
    for idx, row in enumerate(rows, start=1):
        row_params = _row_params(cfg, row, value_columns, importacao_id, data_importacao, snapshot)
        placeholders = ", ".join(["%s"] * len(row_params))
        if update_set:
            sql = f"""
                INSERT INTO {cfg.table} ({", ".join(insert_columns)})
                VALUES ({placeholders})
                ON CONFLICT ({", ".join(cfg.key_columns)})
                DO UPDATE SET {update_set}
                RETURNING (xmax = 0) AS inserted
            """
        else:
            sql = f"""
                INSERT INTO {cfg.table} ({", ".join(insert_columns)})
                VALUES ({placeholders})
                ON CONFLICT ({", ".join(cfg.key_columns)})
                DO NOTHING
                RETURNING (xmax = 0) AS inserted
            """
        result = conn.execute(sql, row_params)
        rec = result.fetchone()
        if rec is None:
            atualizados += 1
        elif rec["inserted"]:
            novos += 1
        else:
            atualizados += 1

        if idx % CHUNK_SIZE == 0:
            conn.commit()

    conn.commit()
    return UpsertOutcome(novos=novos, atualizados=atualizados)
