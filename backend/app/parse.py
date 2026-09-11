"""Conversores tolerantes para valores vindos de planilha (espelho de server/parse.ts)."""

from __future__ import annotations

import math
import re
from datetime import UTC, datetime
from typing import TypeVar

T = TypeVar("T")

ParseOk = tuple[True, T | None]
ParseErr = tuple[False, str]
ParseResult = ParseOk[T] | ParseErr

EXCEL_EPOCH_UTC = datetime(1899, 12, 30, tzinfo=UTC)


def parse_numeric(raw: object) -> ParseResult[float]:
    if raw is None or raw == "":
        return True, None
    if isinstance(raw, bool):
        return False, "valor numérico inválido"
    if isinstance(raw, (int, float)):
        if isinstance(raw, float) and math.isnan(raw):
            return False, "valor numérico inválido"
        return True, float(raw)
    s = str(raw).strip()
    if s == "":
        return True, None
    if re.search(r",\d{1,2}$", s):
        normalized = s.replace(".", "").replace(",", ".")
    else:
        normalized = s.replace(",", "")
    cleaned = re.sub(r"[R$\s%]", "", normalized)
    try:
        return True, float(cleaned)
    except ValueError:
        return False, f'valor numérico inválido: "{raw}"'


def parse_integer(raw: object) -> ParseResult[int]:
    ok, value = parse_numeric(raw)
    if not ok:
        return False, value  # type: ignore[return-value]
    if value is None:
        return True, None
    return True, int(value)


def parse_date_only(raw: object) -> ParseResult[str]:
    if raw is None or raw == "":
        return False, "data ausente"

    if isinstance(raw, (int, float)) and not isinstance(raw, bool):
        if not math.isfinite(raw) or raw <= 0:
            return False, f'data inválida: "{raw}"'
        d = datetime.fromtimestamp(EXCEL_EPOCH_UTC.timestamp() + raw * 86400, tz=UTC)
        return True, d.date().isoformat()

    s = str(raw).strip()
    if s == "":
        return False, "data ausente"

    m = re.match(r"^(\d{4})-(\d{2})-(\d{2})", s)
    if m:
        return True, f"{m.group(1)}-{m.group(2)}-{m.group(3)}"

    m = re.match(r"^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$", s)
    if m:
        dd, mm, yyyy = m.group(1), m.group(2), m.group(3)
        return True, f"{yyyy}-{mm.zfill(2)}-{dd.zfill(2)}"

    try:
        as_date = datetime.fromisoformat(s.replace("Z", "+00:00"))
        return True, as_date.date().isoformat()
    except ValueError:
        pass

    return False, f'data inválida: "{raw}"'


def parse_text(raw: object) -> ParseResult[str]:
    if raw is None:
        return True, None
    s = str(raw).strip()
    return True, None if s == "" else s
