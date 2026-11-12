from __future__ import annotations

from datetime import date, datetime
from typing import Any

from app.schemas import DataScope, UserOut
from app.security import (
    ROLE_APOIO_LABEL_HINT,
    ROLE_LABELS,
    ROLES_APOIO_GLOBAL,
    ROLES_VISAO_GERAL,
    is_admin,
    permissions_for,
)


#: Chave impossível usada como recorte quando um FORNECEDOR ainda não tem
#: fabricante vinculado: a consulta volta vazia em vez de voltar a base
#: inteira. Nunca deve ser exibida ao usuário.
#:
#: Sem caractere de controle de propósito: o Postgres recusa o byte NUL dentro
#: de um parâmetro de texto, e o erro de banco mascararia justamente o caso que
#: esta constante existe para tratar.
SEM_VINCULO = "__SEM_VINCULO_FABRICANTE__"


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
    if is_admin(role):
        descricao = (
            "Visão Global da Empresa + manutenção da plataforma (acesso técnico irrestrito)"
            if role == "SUPERADMIN"
            else "Visão Global da Empresa (Acesso irrestrito a todos os dados e módulos)"
        )
        return DataScope(level="EMPRESA", description=descricao)
    # Representante do fabricante: o escopo é o fabricante do cadastro dele.
    # Sem vínculo preenchido o escopo fica vazio de propósito — e
    # `scope_filters` devolve um fabricante impossível, para que a consulta
    # volte vazia em vez de voltar "tudo".
    if role == "FORNECEDOR":
        fabricante = row.get("manufacturer")
        return DataScope(
            level="FORNECEDOR",
            description=(
                f"Fabricante {fabricante} (Acesso exclusivo aos resultados deste fabricante, sem margens)"
                if fabricante
                else "Fabricante não vinculado — nenhum dado comercial é liberado até o vínculo ser definido"
            ),
            manufacturer=fabricante,
        )
    # Perfis de apoio (Comprador, Analista, SAR): acompanham a empresa inteira
    # dentro do que o papel permite, mas sem o acesso irrestrito do ADMIN.
    if role in ROLES_APOIO_GLOBAL:
        return DataScope(
            level="EMPRESA",
            description=ROLE_APOIO_LABEL_HINT.get(role, "Visão consolidada da empresa"),
        )
    if role in ("GERENTE_COMERCIAL", "GERENTE_VENDAS"):
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
        manufacturer=row.get("manufacturer"),
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
    """Recorte OBRIGATÓRIO de dados do usuário — aplicado no SQL, não na tela.

    Supervisor fica travado na própria equipe e Vendedor no próprio código,
    mesmo que a requisição mande outro valor. Os demais papéis enxergam o
    consolidado (o que cada um pode *ver* é decidido pelas permissões).
    """
    role = user["role"]
    if role in ROLES_VISAO_GERAL or role in ROLES_APOIO_GLOBAL:
        return {}
    if role == "FORNECEDOR":
        # Representante do fabricante: recorte por fabricante, nunca por equipe
        # ou vendedor. Sem vínculo no cadastro, devolve uma chave que não
        # existe — a consulta volta vazia em vez de voltar a base inteira.
        return {"fabricante": user.get("manufacturer") or SEM_VINCULO}
    if role == "SUPERVISOR":
        return {"equipe": user.get("team")}
    return {"vendedor": user.get("seller_code")}
