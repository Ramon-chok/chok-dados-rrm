from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any

import bcrypt
import jwt
from fastapi import Depends, Header, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.config import get_settings
from app.db import get_connection

bearer_scheme = HTTPBearer(auto_error=False)

# SELECT canônico: colunas PT do auth.sql → aliases EN usados pela API/JWT
USER_SELECT = """
    SELECT
      id::text AS id,
      name,
      email,
      role,
      telefone AS phone,
      endereco AS address,
      bairro AS neighborhood,
      municipio AS city,
      estado AS state,
      cep,
      codigo AS seller_code,
      equipe AS team,
      supervisor,
      NULL::text AS manager,
      status,
      last_login_at,
      COALESCE(extra_permissions, '{}'::text[]) AS extra_permissions
    FROM usuarios
"""

ROLE_PERMISSIONS: dict[str, list[str]] = {
    "ADMIN": ["admin.full_access"],
    "GERENTE": [
        "dashboard.view",
        "analytics.view",
        "studies.view",
        "targets.view",
        "sales.view",
        "customers.view",
        "products.view",
        "reports.view",
        "reports.export",
        "history.view",
        "settings.view",
    ],
    "SUPERVISOR": [
        "dashboard.view",
        "analytics.view",
        "studies.view",
        "targets.view",
        "sales.view",
        "customers.view",
        "products.view",
        "reports.view",
        "history.view",
    ],
    "VENDEDOR": [
        "dashboard.view",
        "targets.view",
        "sales.view",
        "customers.view",
        "products.view",
        "analytics.view",
        "history.view",
    ],
}

ROLE_LABELS = {
    "ADMIN": "Administrador",
    "GERENTE": "Gerência",
    "SUPERVISOR": "Supervisor",
    "VENDEDOR": "Vendedor",
}


def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except ValueError:
        return False


def token_ttl_minutes(remember_me: bool = True) -> int:
    settings = get_settings()
    base = settings.jwt_expire_minutes
    return base * 7 if remember_me else base


def create_access_token(
    user_id: str,
    email: str,
    role: str,
    *,
    remember_me: bool = True,
    extra: dict[str, Any] | None = None,
) -> tuple[str, int]:
    """Retorna (jwt, expires_in_seconds)."""
    settings = get_settings()
    minutes = token_ttl_minutes(remember_me)
    now = datetime.now(UTC)
    payload: dict[str, Any] = {
        "sub": str(user_id),
        "email": email,
        "role": role,
        "typ": "access",
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=minutes)).timestamp()),
    }
    if extra:
        payload.update(extra)
    token = jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)
    if isinstance(token, bytes):
        token = token.decode("utf-8")
    return token, minutes * 60


def decode_token(token: str) -> dict[str, Any]:
    settings = get_settings()
    try:
        return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except jwt.ExpiredSignatureError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expirado.") from exc
    except jwt.InvalidTokenError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido.") from exc


def permissions_for(role: str, extra: list[str] | None = None) -> list[str]:
    base = list(ROLE_PERMISSIONS.get(role, []))
    if extra:
        for item in extra:
            if item not in base:
                base.append(item)
    if role == "ADMIN" and "admin.full_access" not in base:
        base.insert(0, "admin.full_access")
    return base


def require_import_api_key(x_api_key: str | None = Header(default=None, alias="x-api-key")) -> None:
    expected = get_settings().import_api_key
    if not expected:
        return
    if x_api_key != expected:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Chave de importação ausente ou inválida.",
        )


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> dict[str, Any]:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Não autenticado.")
    payload = decode_token(credentials.credentials)
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido.")

    with get_connection() as conn:
        row = conn.execute(USER_SELECT + " WHERE id::text = %s", (str(user_id),)).fetchone()

    if not row:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Usuário não encontrado.")
    if row["status"] != "Ativo":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Usuário inativo.")
    return dict(row)


def require_roles(*roles: str):
    def _dep(user: dict[str, Any] = Depends(get_current_user)) -> dict[str, Any]:
        if user["role"] == "ADMIN":
            return user
        if user["role"] not in roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Sem permissão para esta operação.")
        return user

    return _dep
