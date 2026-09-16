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

    # Verifica se o usuário possui 2FA habilitado; se sim, retorna um token temporário para verificação do 2FA.
    with get_connection() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS autenticacao_2fa (
                user_id text PRIMARY KEY,
                metodo VARCHAR(50),
                segredo VARCHAR(100),
                status boolean DEFAULT false,
                telefone VARCHAR(20),
                email VARCHAR(100),
                codigo_temp VARCHAR(10),
                expira_temp timestamptz,
                backup_codes text[] DEFAULT '{}',
                require_next_login boolean DEFAULT true,
                activated_at timestamptz
            )
            """
        )
        for alter in (
            "ALTER TABLE autenticacao_2fa ADD COLUMN IF NOT EXISTS backup_codes text[] DEFAULT '{}'",
            "ALTER TABLE autenticacao_2fa ADD COLUMN IF NOT EXISTS require_next_login boolean DEFAULT true",
            "ALTER TABLE autenticacao_2fa ADD COLUMN IF NOT EXISTS activated_at timestamptz",
        ):
            try:
                conn.execute(alter)
            except Exception:
                pass
        conn.commit()

        row2 = conn.execute(
            """
            SELECT status, metodo, require_next_login, telefone, email
            FROM autenticacao_2fa
            WHERE user_id = %s
            """,
            (str(data["id"]),),
        ).fetchone()

        # Se 2FA ativo e método e-mail/SMS, gera e envia código para este login
        if row2 and row2["status"]:
            method = (row2.get("metodo") or "authenticator").lower().strip()
            if method in ("email", "sms"):
                import secrets as _secrets

                code = "".join(str(_secrets.randbelow(10)) for _ in range(6))
                expires = datetime.now(UTC) + timedelta(minutes=5)
                conn.execute(
                    """
                    UPDATE autenticacao_2fa
                    SET codigo_temp = %s, expira_temp = %s
                    WHERE user_id = %s
                    """,
                    (code, expires, str(data["id"])),
                )
                conn.commit()
                if method == "email":
                    dest = (row2.get("email") or data.get("email") or "").strip()
                    if dest:
                        try:
                            from app.mail import send_test_email

                            send_test_email(
                                dest,
                                subject="Seu código CHOK 2FA",
                                body=f"Seu código de verificação de login é: {code}\n\nVálido por 5 minutos.",
                            )
                        except Exception:
                            pass

    if row2 and row2["status"]:
        # create short-lived temp token for 2FA verification (5 minutes)
        settings = get_settings()
        now = datetime.now(UTC)
        payload2 = {
            "sub": str(data["id"]),
            "typ": "2fa_pending",
            "iat": int(now.timestamp()),
            "exp": int((now + timedelta(minutes=5)).timestamp()),
        }
        temp_token = jwt.encode(payload2, settings.jwt_secret, algorithm=settings.jwt_algorithm)
        if isinstance(temp_token, bytes):
            temp_token = temp_token.decode("utf-8")
        return {
            "requires2FA": True,
            "tempToken": temp_token,
            "method": (row2.get("metodo") or "authenticator"),
        }

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

    user_id = str(decoded.get("sub") or "")
    from app.routers.twofa import _normalize_otp_code, _verify_totp

    code_digits = _normalize_otp_code(code)
    code_raw = str(code or "").strip().replace(" ", "").upper()
    with get_connection() as conn:
        row = conn.execute(
            """
            SELECT metodo, segredo, codigo_temp, expira_temp, backup_codes, status
            FROM autenticacao_2fa
            WHERE user_id = %s
            """,
            (user_id,),
        ).fetchone()
        if not row or not row.get("status"):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Configuração 2FA não encontrada")
        method = (row["metodo"] or "").lower().strip()
        ok = False
        used_backup: str | None = None
        if method == "authenticator":
            ok = _verify_totp(row.get("segredo"), code_digits, window=2)
        else:
            temp_code = row["codigo_temp"]
            exp = row["expira_temp"]
            if exp is not None and getattr(exp, "tzinfo", None) is None:
                exp = exp.replace(tzinfo=UTC)
            if temp_code and exp and datetime.now(UTC) <= exp:
                ok = code_digits == _normalize_otp_code(str(temp_code))

        # códigos de backup (one-time) — formato XXXX-XXXX
        if not ok:
            backups = list(row.get("backup_codes") or [])
            upper_map = {str(c).upper().replace(" ", ""): str(c) for c in backups}
            if code_raw in upper_map:
                ok = True
                used_backup = upper_map[code_raw]
            elif code_digits and code_digits in {str(c).upper().replace("-", "").replace(" ", "") for c in backups}:
                # aceita backup sem hífen
                for original in backups:
                    compact = str(original).upper().replace("-", "").replace(" ", "")
                    if compact == code_digits:
                        ok = True
                        used_backup = str(original)
                        break

        if not ok:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Código inválido. Use o código atual do autenticador (6 dígitos) ou um código de backup.",
            )

        if used_backup:
            remaining = [c for c in (row.get("backup_codes") or []) if str(c) != used_backup]
            conn.execute(
                "UPDATE autenticacao_2fa SET backup_codes = %s, codigo_temp = NULL, expira_temp = NULL WHERE user_id = %s",
                (remaining, user_id),
            )
            conn.commit()

    # load user data and issue final token
    with get_connection() as conn:
        rowu = conn.execute(
            """
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
            WHERE id::text = %s
            """,
            (user_id,),
        ).fetchone()
        if not rowu:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuário não encontrado")
        data = dict(rowu)

    token, expires_in = create_access_token(data["id"], data["email"], data["role"], remember_me=True)
    # set cookie
    try:
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
        settings = get_settings()
        cookie_name = settings.jwt_cookie_name or "chok_auth_token"
        if response is not None:
            response.delete_cookie(cookie_name, path=settings.jwt_cookie_path or "/", domain=settings.jwt_cookie_domain)
    except Exception:
        pass
    return {"ok": True}
