"""Origem dos números REALIZADOS mostrados nos quadros.

Regra do projeto: o ADMIN importa apenas METAS/DEFINIÇÕES (ver
`routers/imports.py` + tipo `metas`), e os valores realizados vêm de APIs
externas (ERP/BI). Enquanto a API não está configurada, este módulo devolve
``None`` e `routers/board.py` cai na leitura das tabelas locais — assim a tela
funciona hoje e passa a consumir a API sem nenhuma mudança de contrato.

Para ligar a API externa:
  1. defina ``EXTERNAL_API_BASE_URL`` (e ``EXTERNAL_API_KEY``) no ``.env``;
  2. ajuste `_PATHS` e, se necessário, `_normalize_*` ao formato real da API;
  3. nada mais muda — os routers só conversam com este módulo.

Qualquer falha de rede/formato é registrada e tratada como "sem dados da API":
o quadro continua respondendo com o que existe no banco em vez de quebrar.
"""

from __future__ import annotations

import logging
from typing import Any

import httpx

from app.config import get_settings

logger = logging.getLogger(__name__)

# Caminhos esperados na API externa (relativos a EXTERNAL_API_BASE_URL).
_PATHS = {
    "sales_board": "/vendas/realizado-por-vendedor",
    "categories": "/vendas/realizado-por-categoria",
}


def external_source_enabled() -> bool:
    """True quando há uma API externa configurada para ler os realizados."""
    return bool(get_settings().external_api_base_url.strip())


def _get(path: str, params: dict[str, Any]) -> list[dict[str, Any]] | None:
    settings = get_settings()
    base = settings.external_api_base_url.strip().rstrip("/")
    if not base:
        return None

    headers = {"Accept": "application/json"}
    if settings.external_api_key:
        headers["Authorization"] = f"Bearer {settings.external_api_key}"

    clean = {k: v for k, v in params.items() if v not in (None, "")}
    try:
        with httpx.Client(timeout=settings.external_api_timeout_seconds) as client:
            response = client.get(f"{base}{path}", params=clean, headers=headers)
            response.raise_for_status()
            payload = response.json()
    except Exception:
        # Sem detalhes da exceção na resposta HTTP: só no log do servidor.
        logger.exception("Falha ao consultar a API externa em %s", path)
        return None

    # Aceita tanto uma lista crua quanto {"data": [...]} / {"rows": [...]}.
    if isinstance(payload, dict):
        for key in ("data", "rows", "items", "results"):
            if isinstance(payload.get(key), list):
                return payload[key]
        return None
    if isinstance(payload, list):
        return payload
    return None


def _as_float(value: Any) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return 0.0


def _normalize_sales_board(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Formato de uma linha do Quadro de Vendas, independente da API de origem."""
    out: list[dict[str, Any]] = []
    for row in rows:
        cod = row.get("cod_vendedor") or row.get("codVendedor") or row.get("codigo")
        if not cod:
            continue
        out.append(
            {
                "cod_vendedor": str(cod),
                "vendedor": row.get("vendedor") or row.get("nome") or row.get("nome_vendedor"),
                "equipe": row.get("equipe") or row.get("time"),
                "gerencia": row.get("gerencia"),
                "realizado": _as_float(row.get("realizado") or row.get("faturamento")),
                "realizado_cobertura": _as_float(row.get("realizado_cobertura") or row.get("cobertura")),
                "positivados": _as_float(row.get("positivados") or row.get("clientes_positivados")),
                "margem": _as_float(row.get("margem") or row.get("pct_margem")),
            }
        )
    return out


def _normalize_categories(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Formato de uma linha de Categorias, independente da API de origem."""
    out: list[dict[str, Any]] = []
    for row in rows:
        nome = row.get("categoria") or row.get("fabricante") or row.get("nome")
        if not nome:
            continue
        out.append(
            {
                "categoria": str(nome),
                "fabricante": row.get("fabricante"),
                "realizado": _as_float(row.get("realizado") or row.get("faturamento")),
                "realizado_cobertura": _as_float(row.get("realizado_cobertura") or row.get("cobertura")),
                "margem": _as_float(row.get("margem") or row.get("pct_margem")),
            }
        )
    return out


def fetch_sales_board(
    *,
    start: str | None = None,
    end: str | None = None,
    equipe: str | None = None,
    vendedor: str | None = None,
) -> list[dict[str, Any]] | None:
    """Realizado por vendedor. ``None`` = API não configurada ou indisponível."""
    rows = _get(_PATHS["sales_board"], {"start": start, "end": end, "equipe": equipe, "vendedor": vendedor})
    return _normalize_sales_board(rows) if rows is not None else None


def fetch_categories(
    *,
    start: str | None = None,
    end: str | None = None,
    equipe: str | None = None,
    vendedor: str | None = None,
) -> list[dict[str, Any]] | None:
    """Realizado por categoria/fabricante. ``None`` = sem API disponível."""
    rows = _get(_PATHS["categories"], {"start": start, "end": end, "equipe": equipe, "vendedor": vendedor})
    return _normalize_categories(rows) if rows is not None else None
