from __future__ import annotations

import hmac
import secrets
from datetime import UTC, datetime, timedelta
from typing import Any

import bcrypt
import jwt
from fastapi import Depends, Header, HTTPException, status, Request
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
    return bcrypt.hashpw(plain.encode("utf-8"), bcrypt.gensalt(rounds=12)).decode("utf-8")


# Hash descartável: comparado quando o usuário não existe, para que o tempo de
# resposta não revele se o e-mail/código está cadastrado (enumeração por timing).
_DUMMY_HASH = bcrypt.hashpw(b"dummy-password-for-timing", bcrypt.gensalt(rounds=12)).decode("utf-8")


def verify_password(plain: str, hashed: str | None) -> bool:
    try:
        # bcrypt só considera 72 bytes; o schema já limita, aqui é só defesa.
        matches = bcrypt.checkpw(plain.encode("utf-8")[:72], (hashed or _DUMMY_HASH).encode("utf-8"))
        return matches and bool(hashed)
    except ValueError:
        return False


def token_ttl_minutes(remember_me: bool = True) -> int:
    """Com "manter conectado" a sessão dura 7x mais; sem ele, é curta."""
    settings = get_settings()
    base = settings.jwt_expire_minutes
    return base * 7 if remember_me else base


def set_auth_cookie(response: Any, token: str, expires_in: int, remember_me: bool) -> None:
    """Grava o cookie HttpOnly de sessão.

    - remember_me=True  -> cookie persistente (max_age): sobrevive ao fechar o navegador.
    - remember_me=False -> cookie de SESSÃO (sem max_age): some ao fechar o navegador,
      além de o JWT expirar bem antes.
    """
    settings = get_settings()
    samesite = (settings.jwt_cookie_same_site or "Lax").lower()
    if samesite not in ("lax", "strict", "none"):
        samesite = "lax"
    response.set_cookie(
        settings.jwt_cookie_name or "chok_auth_token",
        token,
        max_age=expires_in if remember_me else None,
        path=settings.jwt_cookie_path or "/",
        domain=settings.jwt_cookie_domain,
        secure=bool(settings.jwt_cookie_secure),
        httponly=True,  # nunca legível por JS: XSS não rouba a sessão
        samesite=samesite,
    )


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
        "jti": secrets.token_urlsafe(16),  # id único: permite revogar no logout
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=minutes)).timestamp()),
    }
    if extra:
        payload.update(extra)
    token = jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)
    if isinstance(token, bytes):
        token = token.decode("utf-8")
    return token, minutes * 60


_revocation_table_ready = False


def _ensure_revocation_table(conn: Any) -> None:
    global _revocation_table_ready
    if _revocation_table_ready:
        return
    conn.execute("CREATE TABLE IF NOT EXISTS tokens_revogados (jti TEXT PRIMARY KEY, expira_em TIMESTAMPTZ NOT NULL)")
    conn.commit()
    _revocation_table_ready = True


def revoke_token(token: str | None) -> None:
    """Invalida o JWT no servidor (logout). Aceita token já expirado; ignora inválido."""
    if not token:
        return
    settings = get_settings()
    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret,
            algorithms=[settings.jwt_algorithm],
            options={"verify_exp": False},
        )
    except jwt.InvalidTokenError:
        return
    jti = payload.get("jti")
    exp = payload.get("exp")
    if payload.get("typ") != "access" or not jti or not exp:
        return
    with get_connection() as conn:
        _ensure_revocation_table(conn)
        conn.execute("DELETE FROM tokens_revogados WHERE expira_em < now()")
        conn.execute(
            "INSERT INTO tokens_revogados (jti, expira_em) VALUES (%s, %s) ON CONFLICT (jti) DO NOTHING",
            (str(jti), datetime.fromtimestamp(int(exp), UTC)),
        )
        conn.commit()


def decode_token(token: str) -> dict[str, Any]:
    settings = get_settings()
    try:
        return jwt.decode(
            token,
            settings.jwt_secret,
            algorithms=[settings.jwt_algorithm],
            options={"require": ["exp", "iat", "sub"]},
        )
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


def _api_key_valid(provided: str | None) -> bool:
    expected = get_settings().import_api_key
    return bool(expected and provided and hmac.compare_digest(provided.encode(), expected.encode()))


def require_import_api_key(x_api_key: str | None = Header(default=None, alias="x-api-key")) -> None:
    """Somente para AUTOMAÇÕES (scripts). Comparação em tempo constante.

    Sem IMPORT_API_KEY configurada a chave fica DESABILITADA (antes, vazio
    significava "sem autenticação") e só sessão de ADMIN é aceita.
    """
    if not _api_key_valid(x_api_key):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Chave de importação ausente ou inválida.",
        )


def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> dict[str, Any]:
    token: str | None = None
    # prefer Authorization header
    if credentials is not None and credentials.scheme.lower() == "bearer":
        token = credentials.credentials
    else:
        # fallback to cookie
        try:
            settings = get_settings()
            cookie_name = settings.jwt_cookie_name or "chok_auth_token"
            token = request.cookies.get(cookie_name)
        except Exception:
            token = None

    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Não autenticado.")
    payload = decode_token(token)
    # O tempToken do 2FA (typ="2fa_pending") é assinado com o mesmo segredo e é
    # emitido só com a senha: aceitá-lo aqui anularia o 2FA por completo.
    if payload.get("typ") != "access":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido.")
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido.")

    jti = payload.get("jti")
    if not jti:
        # tokens anteriores à revogação não têm jti: exigem novo login
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Sessão expirada. Faça login novamente.")

    with get_connection() as conn:
        _ensure_revocation_table(conn)
        revoked = conn.execute("SELECT 1 FROM tokens_revogados WHERE jti = %s", (str(jti),)).fetchone()
        row = None if revoked else conn.execute(USER_SELECT + " WHERE id::text = %s", (str(user_id),)).fetchone()

    if revoked:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Sessão encerrada. Faça login novamente.")
    if not row:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Usuário não encontrado.")
    if row["status"] != "Ativo":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Usuário inativo.")
    return dict(row)


def require_import_access(
    request: Request,
    x_api_key: str | None = Header(default=None, alias="x-api-key"),
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> dict[str, Any] | None:
    """Importações: sessão de ADMIN (tela do site) OU chave de automação válida.

    A chave NUNCA deve ir para o bundle do frontend (VITE_*): qualquer pessoa
    a leria no navegador. A tela do site autentica pelo cookie de admin.
    """
    if _api_key_valid(x_api_key):
        return None
    user = get_current_user(request, credentials)
    if user["role"] != "ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Somente administradores podem importar dados.",
        )
    return user


def require_roles(*roles: str):
    def _dep(user: dict[str, Any] = Depends(get_current_user)) -> dict[str, Any]:
        if user["role"] == "ADMIN":
            return user
        if user["role"] not in roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Sem permissão para esta operação.")
        return user

    return _dep
