from __future__ import annotations

"""Cache em memória (TTL) para os endpoints de leitura.

Segurança: a chave inclui o ESCOPO do usuário (role/equipe/código do vendedor) e todos os
parâmetros da consulta — um SUPERVISOR nunca recebe o resultado de outra equipe. A
autenticação continua rodando antes (Depends), o cache só evita refazer as queries.

Invalidação: a chave inclui uma "versão dos dados" derivada da tabela `importacoes`
(lida no máximo a cada DATA_VERSION_TTL s). Qualquer importação nova/limpeza muda a versão
e todos os workers passam a ignorar o cache antigo, sem depender de memória compartilhada.
"""

import functools
import threading
import time
from collections import OrderedDict
from typing import Any, Callable, TypeVar

from app.db import get_connection

F = TypeVar("F", bound=Callable[..., Any])

DEFAULT_TTL = 120.0
MAX_ENTRIES = 512
DATA_VERSION_TTL = 5.0

_lock = threading.Lock()
_store: OrderedDict[tuple, tuple[float, Any]] = OrderedDict()
_version: tuple[float, str] = (0.0, "")
_inflight: dict[tuple, threading.Event] = {}


def data_version() -> str:
    global _version
    now = time.monotonic()
    checked_at, value = _version
    if value and now - checked_at < DATA_VERSION_TTL:
        return value
    try:
        with get_connection() as conn:
            row = conn.execute(
                "SELECT COALESCE(MAX(id), 0) AS m, COUNT(*) AS c, MAX(data_importacao) AS d FROM importacoes"
            ).fetchone()
        value = f"{row['m']}:{row['c']}:{row['d']}"
    except Exception:
        # Sem versão confiável, prefere o valor anterior a derrubar a requisição.
        value = value or "0"
    _version = (now, value)
    return value


def invalidate_all() -> None:
    """Chamado após importações: descarta tudo neste worker e força reler a versão."""
    global _version
    with _lock:
        _store.clear()
    _version = (0.0, "")


def _scope_key(user: dict[str, Any]) -> tuple:
    return (user.get("role"), user.get("team"), user.get("seller_code"))


def cached(ttl: float = DEFAULT_TTL) -> Callable[[F], F]:
    """Decorator para endpoints GET. Exige um parâmetro `user` ou `_user` (Depends)."""

    def deco(fn: F) -> F:
        @functools.wraps(fn)
        def wrapper(*args: Any, **kwargs: Any) -> Any:
            user = kwargs.get("user") or kwargs.get("_user")
            if user is None:
                return fn(*args, **kwargs)
            params = tuple(sorted((k, v) for k, v in kwargs.items() if k not in ("user", "_user")))
            key = (fn.__module__, fn.__name__, _scope_key(user), params, data_version())

            while True:
                with _lock:
                    hit = _store.get(key)
                    if hit and hit[0] > time.monotonic():
                        _store.move_to_end(key)
                        return hit[1]
                    waiter = _inflight.get(key)
                    if waiter is None:
                        _inflight[key] = threading.Event()
                        break
                # Outra requisição já está calculando o mesmo resultado: espera em vez de duplicar a query.
                waiter.wait(timeout=30)

            try:
                result = fn(*args, **kwargs)
                with _lock:
                    _store[key] = (time.monotonic() + ttl, result)
                    _store.move_to_end(key)
                    while len(_store) > MAX_ENTRIES:
                        _store.popitem(last=False)
                return result
            finally:
                with _lock:
                    event = _inflight.pop(key, None)
                if event:
                    event.set()

        return wrapper  # type: ignore[return-value]

    return deco
