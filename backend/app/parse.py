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


_EXCEL_ERROR_RE = re.compile(r"^#(DIV/0!|N/?A|VALUE!|REF!|NAME\?|NUM!|NULL!|CALC!|SPILL!|GETTING_DATA)$", re.I)


def parse_numeric(raw: object) -> ParseResult[float]:
    if raw is None or raw == "":
        return True, None
    if isinstance(raw, bool):
        return False, "valor numérico inválido"
    if isinstance(raw, (int, float)):
        # Planilhas com #DIV/0! / #N/A frequentemente chegam como ±inf ou NaN
        # via SheetJS — rejeitar em vez de derrubar a importação com OverflowError.
        if isinstance(raw, float) and not math.isfinite(raw):
            return False, f'valor numérico inválido: "{raw}"'
        return True, float(raw)
    s = str(raw).strip()
    if s == "":
        return True, None
    if _EXCEL_ERROR_RE.match(s) or s.lower() in {"nan", "inf", "+inf", "-inf", "infinity", "+infinity", "-infinity"}:
        return False, f'valor numérico inválido: "{raw}"'
    if re.search(r",\d{1,2}$", s):
        normalized = s.replace(".", "").replace(",", ".")
    else:
        normalized = s.replace(",", "")
    cleaned = re.sub(r"[R$\s%]", "", normalized)
    try:
        value = float(cleaned)
    except ValueError:
        return False, f'valor numérico inválido: "{raw}"'
    if not math.isfinite(value):
        return False, f'valor numérico inválido: "{raw}"'
    return True, value


def parse_integer(raw: object) -> ParseResult[int]:
    ok, value = parse_numeric(raw)
    if not ok:
        return False, value  # type: ignore[return-value]
    if value is None:
        return True, None
    if not math.isfinite(value):
        return False, f'valor inteiro inválido: "{raw}"'
    try:
        return True, int(value)
    except (OverflowError, ValueError):
        return False, f'valor inteiro inválido: "{raw}"'


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


TRUE_VALUES = {"sim", "s", "true", "verdadeiro", "1", "x", "yes", "y"}
FALSE_VALUES = {"nao", "não", "n", "false", "falso", "0", "", "no"}


def parse_boolean(raw: object) -> ParseResult[bool]:
    if raw is None or raw == "":
        return True, False
    if isinstance(raw, bool):
        return True, raw
    if isinstance(raw, (int, float)):
        return True, bool(raw)
    s = str(raw).strip().lower()
    if s in TRUE_VALUES:
        return True, True
    if s in FALSE_VALUES:
        return True, False
    return False, f'valor booleano inválido: "{raw}" (use sim/não)'


def _format_hms(total_seconds: float) -> str:
    s = round(total_seconds)
    hh, rem = divmod(s, 3600)
    mm, ss = divmod(rem, 60)
    return f"{hh:02d}:{mm:02d}:{ss:02d}"


_TIME_RE = re.compile(r"^(\d{1,2}):(\d{2})(?::(\d{2}))?$")
_DURATION_RE = re.compile(r"^(\d{1,3}):(\d{2})(?::(\d{2}))?$")


def parse_time_of_day(raw: object) -> ParseResult[str]:
    """Hora-do-dia (ex.: check-in) — aceita "HH:MM[:SS]" e a hora serial do
    Excel (fração do dia: 0.5 = 12:00). Sempre normalizada para <24h, pois
    representa um instante do dia, não uma duração."""
    if raw is None or raw == "":
        return True, None

    if isinstance(raw, (int, float)) and not isinstance(raw, bool):
        if not math.isfinite(raw):
            return False, f'hora inválida: "{raw}"'
        frac = (raw % 1 + 1) % 1
        return True, _format_hms(frac * 86400)

    s = str(raw).strip()
    if s == "":
        return True, None
    m = _TIME_RE.match(s)
    if m:
        hh, mm = int(m.group(1)), int(m.group(2))
        ss = int(m.group(3)) if m.group(3) else 0
        if hh > 23 or mm > 59 or ss > 59:
            return False, f'hora inválida: "{raw}"'
        return True, f"{hh:02d}:{mm:02d}:{ss:02d}"
    return False, f'hora inválida: "{raw}"'


def parse_duration(raw: object) -> ParseResult[str]:
    """Duração (ex.: tempo em campo) — mesmo formato, mas SEM normalizar para
    24h: uma jornada pode ultrapassar meia-noite quando somada (ex.:
    26:15:00), por isso é gravada como texto, não TIME."""
    if raw is None or raw == "":
        return True, None

    if isinstance(raw, (int, float)) and not isinstance(raw, bool):
        if not math.isfinite(raw) or raw < 0:
            return False, f'duração inválida: "{raw}"'
        return True, _format_hms(raw * 86400)

    s = str(raw).strip()
    if s == "":
        return True, None
    m = _DURATION_RE.match(s)
    if m:
        hh, mm = int(m.group(1)), int(m.group(2))
        ss = int(m.group(3)) if m.group(3) else 0
        if mm > 59 or ss > 59:
            return False, f'duração inválida: "{raw}"'
        return True, f"{hh:02d}:{mm:02d}:{ss:02d}"
    return False, f'duração inválida: "{raw}"'
