"""Motor genérico de UPSERT em lote (espelho de server/upsert.ts)."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Any

from psycopg import Connection

from app.import_types import ImportTypeConfig
from app.parse import parse_date_only, parse_integer, parse_numeric, parse_text

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


def map_and_validate_rows(
    cfg: ImportTypeConfig,
    mapping: dict[str, str],
    raw_rows: list[dict[str, Any]],
) -> tuple[list[MappedRow], list[RowError]]:
    valid: list[MappedRow] = []
    errors: list[RowError] = []

    for idx, raw in enumerate(raw_rows):
        linha = idx + 1
        values: dict[str, Any] = {}
        row_error: str | None = None

        for col in cfg.columns:
            source_header = mapping.get(col.name)
            raw_value = raw.get(source_header) if source_header else None

            if col.kind == "numeric":
                parsed_ok, parsed_val = parse_numeric(raw_value)
            elif col.kind == "integer":
                parsed_ok, parsed_val = parse_integer(raw_value)
            elif col.kind == "date":
                parsed_ok, parsed_val = parse_date_only(raw_value)
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


def upsert_rows(
    conn: Connection,
    cfg: ImportTypeConfig,
    rows: list[MappedRow],
    importacao_id: int,
    data_importacao: datetime,
    snapshot: SnapshotContext | None,
) -> UpsertOutcome:
    if not rows:
        return UpsertOutcome(0, 0)

    value_columns = [c.name for c in cfg.columns]
    extra_columns = (
        ["data_referencia", "mes_referencia", "ano_referencia", "data_importacao", "importacao_id"]
        if cfg.snapshot
        else ["data_importacao", "importacao_id"]
    )
    insert_columns = [*value_columns, *extra_columns]
    update_set = ", ".join(
        f"{c} = EXCLUDED.{c}" for c in insert_columns if c not in cfg.key_columns
    )

    novos = 0
    atualizados = 0

    for i in range(0, len(rows), CHUNK_SIZE):
        chunk = rows[i : i + CHUNK_SIZE]
        params: list[Any] = []
        tuples: list[str] = []

        for row in chunk:
            row_params: list[Any] = [row.values.get(c) for c in value_columns]
            if cfg.snapshot and snapshot:
                row_params.extend(
                    [snapshot.data_referencia, snapshot.mes_referencia, snapshot.ano_referencia]
                )
            row_params.extend([data_importacao, importacao_id])

            placeholders = ", ".join(["%s"] * len(row_params))
            tuples.append(f"({placeholders})")
            params.extend(row_params)

        sql = f"""
            INSERT INTO {cfg.table} ({", ".join(insert_columns)})
            VALUES {", ".join(tuples)}
            ON CONFLICT ({", ".join(cfg.key_columns)})
            DO UPDATE SET {update_set}
            RETURNING (xmax = 0) AS inserted
        """
        result = conn.execute(sql, params)
        for rec in result.fetchall():
            if rec["inserted"]:
                novos += 1
            else:
                atualizados += 1

    return UpsertOutcome(novos=novos, atualizados=atualizados)
