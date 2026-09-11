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
            SELECT id, name, email, password_hash, role, telefone, endereco, bairro, municipio, estado, cep,
                   codigo, equipe, supervisor, status, last_login_at, extra_permissions
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
            "UPDATE usuarios SET last_login_at = %s WHERE id = %s",
            (datetime.now(UTC), row["id"]),
        )
        conn.commit()
        row = dict(row)
        row["last_login_at"] = datetime.now(UTC)

    token = create_access_token(row["id"], row["email"], row["role"])
    return LoginResponse(token=token, user=user_to_out(row))


@router.get("/me", response_model=UserOut)
def me(user: dict = Depends(get_current_user)) -> UserOut:
    return user_to_out(user)
    