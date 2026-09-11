from __future__ import annotations

from datetime import date, datetime
from typing import Any

from app.schemas import DataScope, UserOut
from app.security import ROLE_LABELS, permissions_for


def initials(name: str) -> str:
    parts = [p for p in (name or "").split() if p]
    if not parts:
        return "?"
    if len(parts) == 1:
        return parts[0][:2].upper()
    return (parts[0][0] + parts[-1][0]).upper()


def format_last_login(value: datetime | None) -> str | None:
    if value is None:
        return None
    return value.strftime("%d/%m/%Y %H:%M")


def build_scope(row: dict[str, Any]) -> DataScope:
    role = row["role"]
    if role == "ADMIN":
        return DataScope(
            level="EMPRESA",
            description="Visão Global da Empresa (Acesso irrestrito a todos os dados e módulos)",
        )
    if role == "GERENTE":
        manager = row.get("manager") or "Gerência"
        return DataScope(
            level="GERENTE",
            description=f"{manager} (Visão completa da gerência, sem alteração estrutural)",
            manager=row.get("manager"),
        )
    if role == "SUPERVISOR":
        team = row.get("team") or "Equipe"
        return DataScope(
            level="SUPERVISOR",
            description=f"Equipe {team} (Acesso exclusivo e consolidado à própria equipe)",
            team=row.get("team"),
            supervisor=row.get("supervisor"),
            manager=row.get("manager"),
        )
    return DataScope(
        level="VENDEDOR",
        description=(
            f"Vendedor {row.get('seller_code') or ''} "
            "(Acesso restrito exclusivamente aos próprios clientes, produtos e metas)"
        ).strip(),
        sellerCode=row.get("seller_code"),
        team=row.get("team"),
        supervisor=row.get("supervisor"),
        manager=row.get("manager"),
    )


def user_to_out(row: dict[str, Any]) -> UserOut:
    extra = list(row.get("extra_permissions") or [])
    return UserOut(
        id=str(row["id"]),
        name=row["name"],
        email=row["email"],
        role=row["role"],
        roleLabel=ROLE_LABELS.get(row["role"], row["role"]),
        avatarInitials=initials(row["name"] or ""),
        phone=row.get("phone"),
        address=row.get("address"),
        neighborhood=row.get("neighborhood"),
        city=row.get("city"),
        state=row.get("state"),
        cep=row.get("cep"),
        sellerCode=row.get("seller_code"),
        team=row.get("team"),
        supervisor=row.get("supervisor"),
        manager=row.get("manager"),
        status=row.get("status") or "Ativo",
        lastLoginAt=format_last_login(row.get("last_login_at")),
        scope=build_scope(row),
        permissions=permissions_for(row["role"], extra),
    )


def iso(value: date | datetime | None) -> str | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.isoformat()
    return value.isoformat()


def num(value: Any) -> float:
    if value is None:
        return 0.0
    return float(value)


def scope_filters(user: dict[str, Any]) -> dict[str, str | None]:
    role = user["role"]
    if role in ("ADMIN", "GERENTE"):
        return {}
    if role == "SUPERVISOR":
        return {"equipe": user.get("team")}
    return {"vendedor": user.get("seller_code")}
