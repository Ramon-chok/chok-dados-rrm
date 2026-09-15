from __future__ import annotations

from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, status, Response

from app.db import get_connection
from app.schemas import LoginRequest, LoginResponse, UserOut
from app.security import create_access_token, get_current_user, verify_password
from app.services import user_to_out

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=LoginResponse)
def login(payload: LoginRequest, response: Response) -> LoginResponse:
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


@router.get("/me", response_model=UserOut)
def me(user: dict = Depends(get_current_user)) -> UserOut:
    return user_to_out(user)


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
