"""Tratamento centralizado de erros internos.

Regra: o detalhe técnico (exceção, SQL, caminho de arquivo, stack) fica APENAS
no log do servidor. O usuário recebe uma mensagem genérica e um código de
referência curto, que o suporte usa para localizar o registro no log.
"""

from __future__ import annotations

import logging
import secrets
import sys

logger = logging.getLogger("chok")
if not logger.handlers:
    _handler = logging.StreamHandler(sys.stderr)
    _handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(name)s: %(message)s"))
    logger.addHandler(_handler)
    logger.setLevel(logging.INFO)
    logger.propagate = False

GENERIC_ERROR = "Não foi possível concluir a operação. Tente novamente em instantes."
SERVICE_UNAVAILABLE = "Serviço temporariamente indisponível. Tente novamente em instantes."


def new_error_ref() -> str:
    """Código curto (8 hex) para correlacionar a resposta com o log do servidor."""
    return secrets.token_hex(4).upper()


def log_exception(context: str, exc: BaseException | None = None) -> str:
    """Registra a exceção com stack no log do servidor e devolve o código de referência."""
    ref = new_error_ref()
    if exc is not None:
        logger.error("[ref=%s] %s", ref, context, exc_info=(type(exc), exc, exc.__traceback__))
    else:
        logger.exception("[ref=%s] %s", ref, context)
    return ref


def is_database_unavailable(exc: BaseException) -> bool:
    """Banco fora do ar / pool esgotado → 503 em vez de 500."""
    try:
        import psycopg
        from psycopg_pool import PoolTimeout

        return isinstance(exc, (psycopg.OperationalError, PoolTimeout))
    except Exception:
        return False


class PublicServerError(Exception):
    """Erro 5xx cuja mensagem foi escrita para o usuário final (sem detalhe técnico).

    Qualquer outro 5xx tem o texto descartado pelo handler global.
    """

    def __init__(self, message: str, ref: str | None = None, status_code: int = 500) -> None:
        super().__init__(message)
        self.message = message
        self.ref = ref
        self.status_code = status_code
