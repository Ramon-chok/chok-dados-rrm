"""Aplica schema.sql + auth.sql e faz seed dos usuários de demonstração."""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from app.db import apply_schema, close_pool, get_connection  # noqa: E402
from app.seed import seed_users  # noqa: E402


def main() -> None:
    print("[migrate] Aplicando schema.sql e auth.sql...")
    with get_connection() as conn:
        apply_schema(conn)
    print("[migrate] Semear usuários de demonstração...")
    seed_users()
    print("[migrate] Concluído com sucesso.")
    close_pool()


if __name__ == "__main__":
    try:
        main()
    except Exception as err:
        print("[migrate] Falhou:", err)
        sys.exit(1)
