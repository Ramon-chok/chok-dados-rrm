from __future__ import annotations

from datetime import UTC, datetime, timedelta
import jwt

import hmac

from fastapi import APIRouter, Depends, HTTPException, Request, status, Response
from typing import Any

from app.db import get_connection
from app.config import get_settings
from app.schemas import LoginRequest, LoginResponse, UserOut
from app.hardening import login_throttle
from app.sanitize import clean_text
from app.security import create_access_token, get_current_user, revoke_token, set_auth_cookie, verify_password, require_roles
from pydantic import BaseModel, Field
from fastapi import Body
from app.mail import test_smtp_connection, send_test_email
from app.services import user_to_out

router = APIRouter(prefix="/auth", tags=["auth"])

INVALID_CREDENTIALS = "Credenciais corporativas incorretas."


class TwoFALoginRequest(BaseModel):
    tempToken: str = Field(min_length=10, max_length=2048)
    code: str = Field(min_length=1, max_length=32)


def _locked(retry_after: int) -> HTTPException:
    minutes = max(1, (retry_after + 59) // 60)
    return HTTPException(
        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        detail=f"Muitas tentativas. Tente novamente em {minutes} min.",
        headers={"Retry-After": str(retry_after)},
    )


def _touch_last_login(user_id: str) -> None:
    with get_connection() as conn:
        conn.execute(
            "UPDATE usuarios SET last_login_at = %s, updated_at = now() WHERE id::text = %s",
            (datetime.now(UTC), str(user_id)),
        )
        conn.commit()


@router.post("/login")
def login(payload: LoginRequest, response: Response) -> object:
    # payload.email is treated as a generic identifier: can be an e-mail or user code
    identifier_raw = (payload.email or "").strip()
    identifier_lower = identifier_raw.lower()

    # Força bruta: bloqueia POR CONTA (além do rate limit por IP no middleware).
    throttle_key = f"login:{identifier_lower}"
    retry = login_throttle.locked_for(throttle_key)
    if retry:
        raise _locked(retry)

    with get_connection() as conn:
        # try to find by email (case-insensitive) or by codigo (exact match)
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
            WHERE lower(email) = %s OR codigo = %s
            """,
            (identifier_lower, identifier_raw),
        ).fetchone()

    # verify_password roda o bcrypt mesmo sem usuário (tempo constante).
    password_ok = verify_password(payload.password, row["password_hash"] if row else None)
    if not row or not password_ok:
        login_throttle.register_failure(throttle_key)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=INVALID_CREDENTIALS)
    login_throttle.reset(throttle_key)
    # Mesma mensagem genérica para inativo: não revela que a conta existe.
    if row["status"] != "Ativo":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=INVALID_CREDENTIALS)

    data = dict(row)
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

        # Se 2FA ativo por e-mail, gera e envia código para este login
        if row2 and row2["status"]:
            method = (row2.get("metodo") or "authenticator").lower().strip()
            if method == "sms":
                # SMS foi descontinuado: contas antigas passam a receber o código por e-mail.
                method = "email"
                conn.execute(
                    "UPDATE autenticacao_2fa SET metodo = 'email', telefone = NULL WHERE user_id = %s",
                    (str(data["id"]),),
                )
                conn.commit()
                row2 = {**row2, "metodo": "email"}
            if method == "email":
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
                if True:
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
            # Guarda a escolha do checkbox "Manter sessão conectada" até o 2FA terminar.
            "rm": bool(payload.rememberMe),
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

    _touch_last_login(data["id"])
    data["last_login_at"] = datetime.now(UTC)
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
    # Cookie HttpOnly: persistente só se "manter conectado" estiver marcado.
    set_auth_cookie(response, token, expires_in, payload.rememberMe)

    return LoginResponse(token=token, tokenType="Bearer", expiresIn=expires_in, user=user_to_out(data))



@router.post("/2fa-login")
def twofa_login(payload: TwoFALoginRequest, response: Response):
    """Completa o login usando `tempToken` retornado por /login e o `code` do 2FA."""
    temp = payload.tempToken
    code = clean_text(payload.code, 32)
    settings = get_settings()
    generic_invalid = "Sessão de verificação inválida. Faça login novamente."
    try:
        decoded = jwt.decode(
            temp,
            settings.jwt_secret,
            algorithms=[settings.jwt_algorithm],
            options={"require": ["exp", "iat", "sub"]},
        )
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Sessão de verificação expirada. Faça login novamente.")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=generic_invalid)

    if decoded.get("typ") != "2fa_pending":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=generic_invalid)

    user_id = str(decoded.get("sub") or "")
    # A escolha "Manter sessão conectada" feita na tela de login viaja no tempToken.
    remember_me = bool(decoded.get("rm", False))

    # 6 dígitos = 1.000.000 combinações: sem limite, dá para adivinhar em minutos.
    throttle_key = f"2fa:{user_id}"
    retry = login_throttle.locked_for(throttle_key)
    if retry:
        raise _locked(retry)

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
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=generic_invalid)
        method = (row["metodo"] or "").lower().strip()
        ok = False
        used_backup: str | None = None
        used_temp_code = False
        if method == "authenticator":
            ok = _verify_totp(row.get("segredo"), code_digits, window=1)
        else:
            temp_code = row["codigo_temp"]
            exp = row["expira_temp"]
            if exp is not None and getattr(exp, "tzinfo", None) is None:
                exp = exp.replace(tzinfo=UTC)
            if temp_code and exp and datetime.now(UTC) <= exp and code_digits:
                ok = hmac.compare_digest(code_digits, _normalize_otp_code(str(temp_code)))
                used_temp_code = ok

        # códigos de backup (uso único) — formato XXXX-XXXX, com ou sem hífen
        if not ok:
            candidate = code_raw.replace("-", "")
            for original in list(row.get("backup_codes") or []):
                compact = str(original).upper().replace("-", "").replace(" ", "")
                if candidate and hmac.compare_digest(compact, candidate):
                    ok = True
                    used_backup = str(original)
                    break

        if not ok:
            login_throttle.register_failure(throttle_key)
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
        elif used_temp_code:
            # código por e-mail é de uso único
            conn.execute(
                "UPDATE autenticacao_2fa SET codigo_temp = NULL, expira_temp = NULL WHERE user_id = %s",
                (user_id,),
            )
            conn.commit()

    login_throttle.reset(throttle_key)

    # carrega o usuário e emite o token final
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
        if not rowu or rowu["status"] != "Ativo":
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=generic_invalid)
        data = dict(rowu)

    _touch_last_login(user_id)
    data["last_login_at"] = datetime.now(UTC)
    token, expires_in = create_access_token(
        data["id"],
        data["email"],
        data["role"],
        remember_me=remember_me,
        extra={"sellerCode": data.get("seller_code"), "team": data.get("team")},
    )
    set_auth_cookie(response, token, expires_in, remember_me)

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
def logout(request: Request, response: Response) -> dict[str, bool]:
    """Encerra a sessão: REVOGA o JWT no servidor (não só apaga o cookie) e limpa o cookie.
    Não exige autenticação válida: sempre limpa o cookie."""
    settings = get_settings()
    cookie_name = settings.jwt_cookie_name or "chok_auth_token"
    token = request.cookies.get(cookie_name)
    auth_header = request.headers.get("authorization", "")
    if auth_header.lower().startswith("bearer "):
        try:
            revoke_token(auth_header[7:].strip())
        except Exception:
            pass
    try:
        revoke_token(token)
    except Exception:
        # banco indisponível não pode impedir o usuário de sair
        pass
    response.delete_cookie(cookie_name, path=settings.jwt_cookie_path or "/", domain=settings.jwt_cookie_domain)
    return {"ok": True}
