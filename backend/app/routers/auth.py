from __future__ import annotations

from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, status

from app.db import get_connection
from app.schemas import LoginRequest, LoginResponse, UserOut
from app.security import create_access_token, get_current_user, verify_password
from app.services import user_to_out

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=LoginResponse)
def login(payload: LoginRequest) -> LoginResponse:
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
    return LoginResponse(token=token, tokenType="Bearer", expiresIn=expires_in, user=user_to_out(data))


@router.get("/me", response_model=UserOut)
def me(user: dict = Depends(get_current_user)) -> UserOut:
    return user_to_out(user)


@router.post("/logout")
def logout(_user: dict = Depends(get_current_user)) -> dict[str, bool]:
    return {"ok": True}
