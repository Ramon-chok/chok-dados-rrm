"""Sanitização central de entradas de texto.

Regras:
- remove NUL/caracteres de controle (o Postgres rejeita \\x00 e logs são
  vulneráveis a injeção de linhas);
- normaliza Unicode (NFKC) para evitar homógrafos/variações de "<";
- remove tags HTML/`javascript:` — o React já escapa na saída, mas isto
  impede que marcação maliciosa seja PERSISTIDA e reutilizada por outros
  consumidores (e-mails, exportações, relatórios);
- limita tamanho.

Não escapa aspas/`&`: a defesa contra SQL Injection é o uso exclusivo de
consultas parametrizadas, e escapar na entrada corromperia os dados.
"""

from __future__ import annotations

import re
import unicodedata
from typing import Any

_CONTROL_CHARS = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f​-‏ -‮⁦-⁩﻿]")
_HTML_TAG = re.compile(r"<\s*/?\s*[a-zA-Z!?][^>]*>", re.S)
_DANGEROUS_SCHEME = re.compile(r"(?i)\b(?:javascript|vbscript|data)\s*:")
_EVENT_HANDLER = re.compile(r"(?i)\bon[a-z]{3,20}\s*=")

DEFAULT_MAX_LEN = 255


def clean_text(value: Any, max_len: int = DEFAULT_MAX_LEN, *, multiline: bool = False) -> str:
    """Retorna `value` como texto seguro e aparado (string vazia se None)."""
    if value is None:
        return ""
    text = unicodedata.normalize("NFKC", str(value))
    if multiline:
        text = text.replace("\r\n", "\n").replace("\r", "\n")
    else:
        text = re.sub(r"[\t\r\n]+", " ", text)
    text = _CONTROL_CHARS.sub("", text)
    text = _HTML_TAG.sub("", text)
    text = _DANGEROUS_SCHEME.sub("", text)
    text = _EVENT_HANDLER.sub("", text)
    return text.strip()[:max_len]


def clean_optional(value: Any, max_len: int = DEFAULT_MAX_LEN) -> str | None:
    if value is None:
        return None
    text = clean_text(value, max_len)
    return text or None


def clean_email(value: Any) -> str:
    return clean_text(value, 254).lower().replace(" ", "")


def escape_like(value: str) -> str:
    """Escapa curingas de LIKE/ILIKE (`\\`, `%`, `_`) para busca literal.

    Sem isto, `q=%%%%%%%%` vira uma varredura cara (DoS) e `_` casa qualquer
    caractere, vazando mais linhas do que o usuário pediu.
    """
    return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def like_pattern(value: str, max_len: int = 100) -> str:
    return f"%{escape_like(clean_text(value, max_len))}%"


def has_control_chars(value: str) -> bool:
    return bool(_CONTROL_CHARS.search(value))
