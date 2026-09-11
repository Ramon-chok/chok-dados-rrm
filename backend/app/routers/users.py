from __future__ import annotations

import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status

from app.db import get_connection
from app.schemas import UserCreate, UserOut, UserUpdate
from app.security import USER_SELECT, hash_password, require_roles
from app.services import user_to_out

router = APIRouter(prefix="/users", tags=["users"])


@router.get("", response_model=list[UserOut])
def list_users(_admin: dict[str, Any] = Depends(require_roles("ADMIN"))) -> list[UserOut]:
    with get_connection() as conn:
        rows = conn.execute(USER_SELECT + " ORDER BY name").fetchall()
    return [user_to_out(dict(r)) for r in rows]


@router.post("", response_model=UserOut, status_code=201)
def create_user(payload: UserCreate, _admin: dict[str, Any] = Depends(require_roles("ADMIN"))) -> UserOut:
    with get_connection() as conn:
        existing = conn.execute(
            "SELECT id FROM usuarios WHERE lower(email) = %s",
            (payload.email.lower(),),
        ).fetchone()
        if existing:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="E-mail já cadastrado.")
        conn.execute(
            """
            INSERT INTO usuarios (
                name, email, password_hash, role, telefone, endereco, bairro,
                municipio, estado, cep, codigo, equipe, supervisor, status
            ) VALUES (
                %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
            )
            RETURNING id
            """,
            (
                payload.name,
                payload.email.lower(),
                hash_password(payload.password),
                payload.role,
                payload.phone,
                payload.address,
                payload.neighborhood,
                payload.city,
                payload.state,
                payload.cep,
                payload.sellerCode,
                payload.team,
                payload.supervisor,
                payload.status,
            ),
        )
        # psycopg3 cursor may not return via execute; fetch via last id
        row_id = conn.execute("SELECT id::text AS id FROM usuarios WHERE lower(email) = %s", (payload.email.lower(),)).fetchone()
        conn.commit()
        row = conn.execute(USER_SELECT + " WHERE id::text = %s", (row_id["id"],)).fetchone()
    return user_to_out(dict(row))


@router.patch("/{user_id}", response_model=UserOut)
def update_user(
    user_id: str,
    payload: UserUpdate,
    _admin: dict[str, Any] = Depends(require_roles("ADMIN")),
) -> UserOut:
    fields: list[str] = []
    values: list[Any] = []
    data = payload.model_dump(exclude_unset=True)
    mapping = {
        "name": "name",
        "email": "email",
        "role": "role",
        "phone": "telefone",
        "address": "endereco",
        "neighborhood": "bairro",
        "city": "municipio",
        "state": "estado",
        "cep": "cep",
        "sellerCode": "codigo",
        "team": "equipe",
        "supervisor": "supervisor",
        "status": "status",
    }
    for key, column in mapping.items():
        if key in data:
            value = data[key]
            if key == "email" and value:
                value = str(value).lower()
            fields.append(f"{column} = %s")
            values.append(value)
    if "password" in data and data["password"]:
        fields.append("password_hash = %s")
        values.append(hash_password(data["password"]))
    if not fields:
        raise HTTPException(status_code=400, detail="Nenhum campo para atualizar.")
    fields.append("updated_at = now()")
    values.append(user_id)
    with get_connection() as conn:
        result = conn.execute(
            f"UPDATE usuarios SET {', '.join(fields)} WHERE id::text = %s",
            values,
        )
        if result.rowcount == 0:
            raise HTTPException(status_code=404, detail="Usuário não encontrado.")
        conn.commit()
        row = conn.execute(USER_SELECT + " WHERE id::text = %s", (user_id,)).fetchone()
    return user_to_out(dict(row))


@router.delete("/{user_id}")
def delete_user(user_id: str, _admin: dict[str, Any] = Depends(require_roles("ADMIN"))) -> dict[str, bool]:
    with get_connection() as conn:
        result = conn.execute("DELETE FROM usuarios WHERE id::text = %s", (user_id,))
        if result.rowcount == 0:
            raise HTTPException(status_code=404, detail="Usuário não encontrado.")
        conn.commit()
    return {"ok": True}
