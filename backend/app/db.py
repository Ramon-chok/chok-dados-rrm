from __future__ import annotations

from collections.abc import Generator
from contextlib import contextmanager
from pathlib import Path

from psycopg import Connection
from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

from app.config import get_settings

_pool: ConnectionPool | None = None
SQL_DIR = Path(__file__).resolve().parent.parent / "sql"


def _needs_ssl(url: str) -> bool:
    return bool(url) and "localhost" not in url and "127.0.0.1" not in url


def get_pool() -> ConnectionPool:
    global _pool
    if _pool is None:
        settings = get_settings()
        if not settings.database_url:
            raise RuntimeError(
                "DATABASE_URL não configurada. Defina-a em um .env antes de usar a API."
            )
        kwargs: dict[str, object] = {
            "conninfo": settings.database_url,
            "min_size": 1,
            "max_size": 10,
            "kwargs": {"row_factory": dict_row, "autocommit": False},
            "open": True,
        }
        if _needs_ssl(settings.database_url):
            kwargs["kwargs"] = {  # type: ignore[assignment]
                "row_factory": dict_row,
                "autocommit": False,
                "sslmode": "require",
            }
        _pool = ConnectionPool(**kwargs)
    return _pool


@contextmanager
def get_connection() -> Generator[Connection, None, None]:
    pool = get_pool()
    with pool.connection() as conn:
        yield conn


def close_pool() -> None:
    global _pool
    if _pool is not None:
        _pool.close()
        _pool = None


def _sql_statements(sql_text: str) -> list[str]:
    statements: list[str] = []
    buf: list[str] = []
    for line in sql_text.splitlines():
        stripped = line.strip()
        if stripped.startswith("--") or stripped == "":
            continue
        buf.append(line)
        if stripped.endswith(";"):
            stmt = "\n".join(buf).strip()
            if stmt:
                statements.append(stmt)
            buf = []
    rest = "\n".join(buf).strip()
    if rest:
        statements.append(rest)
    return statements


def apply_schema(conn: Connection) -> None:
    for name in ("schema.sql", "auth.sql"):
        sql_text = (SQL_DIR / name).read_text(encoding="utf-8")
        for stmt in _sql_statements(sql_text):
            conn.execute(stmt)
    conn.commit()
