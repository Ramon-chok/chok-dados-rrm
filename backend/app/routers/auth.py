from __future__ import annotations

from datetime import UTC, datetime, timedelta
import jwt

from fastapi import APIRouter, Depends, HTTPException, status, Response
from typing import Any

from app.db import get_connection
from app.config import get_settings
from app.schemas import LoginRequest, LoginResponse, UserOut
from app.security import create_access_token, get_current_user, verify_password, require_roles
from fastapi import Body
from app.mail import test_smtp_connection, send_test_email
from app.services import user_to_out

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login")
def login(payload: LoginRequest, response: Response) -> object:
    email = payload.email.strip().lower()
    with get_connection() as conn:
        row = conn.execute(
            """
            SELECT
              id::text AS id,
              name,
              email,
              password_hash,
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
            WHERE lower(email) = %s
            """,
            (email,),
        ).fetchone()

        if not row or not verify_password(payload.password, row["password_hash"]):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="E-mail ou credenciais corporativas não encontradas no sistema.",
            )
        if row["status"] != "Ativo":
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Usuário inativo.")

        conn.execute(
            "UPDATE usuarios SET last_login_at = %s, updated_at = now() WHERE id::text = %s",
            (datetime.now(UTC), row["id"]),
        )
        conn.commit()
        data = dict(row)
        data["last_login_at"] = datetime.now(UTC)
        data.pop("password_hash", None)

    # check if user has 2FA enabled; if so return a temporary token for 2FA verification
    with get_connection() as conn:
        row2 = conn.execute("SELECT status FROM autenticacao_2fa WHERE user_id = %s", (data["id"],)).fetchone()
    if row2 and row2["status"]:
        # create short-lived temp token for 2FA verification (5 minutes)
        settings = get_settings()
        now = datetime.now(UTC)
        payload2 = {"sub": str(data["id"]), "typ": "2fa_pending", "iat": int(now.timestamp()), "exp": int((now + timedelta(minutes=5)).timestamp())}
        temp_token = jwt.encode(payload2, settings.jwt_secret, algorithm=settings.jwt_algorithm)
        return {"requires2FA": True, "tempToken": temp_token}

    token, expires_in = create_access_token(
        data["id"],
        data["email"],
        data["role"],
        remember_me=payload.rememberMe,
        extra={
            "sellerCode": data.get("seller_code"),
            "team": data.get("team"),
        },
    )
    # also set HttpOnly cookie for compatibility/secure sessions
    try:
        from app.config import get_settings

        settings = get_settings()
        cookie_name = settings.jwt_cookie_name or "chok_auth_token"
        # FastAPI Response.set_cookie uses max_age (seconds)
        # samesite should be one of 'lax', 'strict', 'none' — normalize
        samesite = (settings.jwt_cookie_same_site or "Strict").lower()
        # set cookie (respecting secure/httpOnly settings)
        # If secure=True in dev (http) cookie won't be sent; env can override
        response.set_cookie(
            cookie_name,
            token,
            max_age=expires_in,
            path=settings.jwt_cookie_path or "/",
            domain=settings.jwt_cookie_domain,
            secure=bool(settings.jwt_cookie_secure),
            httponly=bool(settings.jwt_cookie_http_only),
            samesite=samesite,
        )
    except Exception:
        # don't fail login if cookie cannot be set
        pass

    return LoginResponse(token=token, tokenType="Bearer", expiresIn=expires_in, user=user_to_out(data))



@router.post("/2fa-login")
def twofa_login(payload: dict = Body(...), response: Response = None):
    """Completa o login usando `tempToken` retornado por /login e o `code` do 2FA."""
    temp = payload.get("tempToken")
    code = str(payload.get("code") or "").strip()
    if not temp or not code:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="tempToken e code são obrigatórios")
    settings = get_settings()
    try:
        decoded = jwt.decode(temp, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Temp token expirado")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Temp token inválido")

    if decoded.get("typ") != "2fa_pending":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Temp token inválido")

    user_id = decoded.get("sub")
    with get_connection() as conn:
        row = conn.execute("SELECT metodo, segredo, codigo_temp, expira_temp FROM autenticacao_2fa WHERE user_id = %s", (user_id,)).fetchone()
        if not row:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Configuração 2FA não encontrada")
        method = row["metodo"]
        ok = False
        if method == "authenticator":
            secret = row["segredo"]
            if secret:
                import pyotp

                ok = pyotp.TOTP(secret).verify(code, valid_window=1)
        else:
            temp_code = row["codigo_temp"]
            exp = row["expira_temp"]
            if temp_code and exp and datetime.utcnow() <= exp:
                ok = (code == temp_code)
        if not ok:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Código inválido")

    # load user data and issue final token
    with get_connection() as conn:
        rowu = conn.execute("SELECT id::text AS id, name, email, role, telefone AS phone, codigo AS seller_code, equipe AS team FROM usuarios WHERE id::text = %s", (user_id,)).fetchone()
        if not rowu:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuário não encontrado")
        data = dict(rowu)

    token, expires_in = create_access_token(data["id"], data["email"], data["role"], remember_me=True)
    # set cookie
    try:
        from app.config import get_settings

        settings = get_settings()
        cookie_name = settings.jwt_cookie_name or "chok_auth_token"
        samesite = (settings.jwt_cookie_same_site or "Strict").lower()
        if response is not None:
            response.set_cookie(cookie_name, token, max_age=expires_in, path=settings.jwt_cookie_path or "/", domain=settings.jwt_cookie_domain, secure=bool(settings.jwt_cookie_secure), httponly=bool(settings.jwt_cookie_http_only), samesite=samesite)
    except Exception:
        pass

    return LoginResponse(token=token, tokenType="Bearer", expiresIn=expires_in, user=user_to_out(data))


@router.get("/me", response_model=UserOut)
def me(user: dict = Depends(get_current_user)) -> UserOut:
    return user_to_out(user)


@router.post("/email-test")
def email_test(payload: dict = Body(...), _admin: dict[str, Any] = Depends(require_roles("ADMIN"))):
    """Endpoint para testar conexão SMTP e envio de e-mail.

    Body: { "email": "destino@exemplo.com" }
    """
    to = payload.get("email") if isinstance(payload, dict) else None
    if not to:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Campo 'email' é obrigatório no corpo da requisição.")
    try:
        test_smtp_connection()
        send_test_email(to, subject="Teste de SMTP — CHOK Dados", body="Este é um e-mail de teste enviado pelo endpoint /api/email-test.")
        return {"ok": True}
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc))


@router.post("/logout")
def logout(response: Response = None) -> dict[str, bool]:
    # Allow logout without valid auth: always remove cookie if present.
    try:
        from app.config import get_settings

        settings = get_settings()
        cookie_name = settings.jwt_cookie_name or "chok_auth_token"
        if response is not None:
            response.delete_cookie(cookie_name, path=settings.jwt_cookie_path or "/", domain=settings.jwt_cookie_domain)
    except Exception:
        pass
    return {"ok": True}
