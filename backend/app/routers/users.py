from __future__ import annotations

import uuid
from typing import Annotated, Any

from fastapi import APIRouter, Depends, File, HTTPException, Path as PathParam, UploadFile, status
from app.config import get_settings
from app.security import get_current_user
from pathlib import Path

from app.db import get_connection
from app.schemas import UserCreate, UserOut, UserUpdate
from app.security import USER_SELECT, hash_password, require_roles
from app.services import user_to_out
from app.mail import send_welcome_email
import logging

router = APIRouter(prefix="/users", tags=["users"])

# IDs são BIGSERIAL: aceitar SOMENTE dígitos no caminho (barra `../`, `\\`, SQL etc.)
UserId = Annotated[str, PathParam(pattern=r"^\d{1,18}$", description="ID numérico do usuário")]

# Tipos de imagem aceitos -> (extensão, assinatura mágica). SVG fica FORA de
# propósito: SVG servido no mesmo domínio executa <script> (XSS armazenado).
_IMAGE_TYPES: dict[str, tuple[str, tuple[bytes, ...]]] = {
    "image/jpeg": (".jpg", (b"\xff\xd8\xff",)),
    "image/png": (".png", (b"\x89PNG\r\n\x1a\n",)),
    "image/webp": (".webp", (b"RIFF",)),
}

# Diretório relativo para armazenar avatares
AVATARS_DIR = Path(__file__).resolve().parent.parent.parent / "avatars"
AVATARS_DIR.mkdir(parents=True, exist_ok=True)


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
    # tenta enviar e-mail de boas-vindas, falhas não impedem criação
    try:
        send_welcome_email(payload.email.lower(), payload.name)
    except Exception:
        logging.exception("Erro ao enviar e-mail de boas-vindas")
    return user_to_out(dict(row))


@router.patch("/{user_id}", response_model=UserOut)
def update_user(
    user_id: UserId,
    payload: UserUpdate,
    admin: dict[str, Any] = Depends(require_roles("ADMIN")),
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

    # Não permite auto-bloqueio pela tela de usuários.
    if "status" in data and data["status"] == "Inativo" and str(admin.get("id")) == str(user_id):
        raise HTTPException(status_code=400, detail="Você não pode bloquear a própria conta.")

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
        # Impede rebaixar (role) ou inativar o último ADMIN.
        if data.get("status") == "Inativo" or ("role" in data and data["role"] != "ADMIN"):
            target = conn.execute(
                "SELECT role FROM usuarios WHERE id::text = %s",
                (user_id,),
            ).fetchone()
            if target and str(target.get("role") or "").upper() == "ADMIN":
                admin_count = conn.execute(
                    "SELECT COUNT(*) AS total FROM usuarios WHERE upper(role) = 'ADMIN' AND status = 'Ativo'"
                ).fetchone()
                if int(admin_count["total"] or 0) <= 1:
                    raise HTTPException(
                        status_code=400,
                        detail="Não é possível bloquear o último administrador ativo.",
                    )

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
def delete_user(user_id: UserId, admin: dict[str, Any] = Depends(require_roles("ADMIN"))) -> dict[str, bool]:
    if str(admin.get("id")) == str(user_id):
        raise HTTPException(status_code=400, detail="Você não pode excluir a própria conta.")

    with get_connection() as conn:
        target = conn.execute(
            "SELECT id::text AS id, role FROM usuarios WHERE id::text = %s",
            (user_id,),
        ).fetchone()
        if not target:
            raise HTTPException(status_code=404, detail="Usuário não encontrado.")

        # Evita remover o último ADMIN do sistema.
        if str(target.get("role") or "").upper() == "ADMIN":
            admin_count = conn.execute(
                "SELECT COUNT(*) AS total FROM usuarios WHERE upper(role) = 'ADMIN'"
            ).fetchone()
            if int(admin_count["total"] or 0) <= 1:
                raise HTTPException(
                    status_code=400,
                    detail="Não é possível excluir o último administrador do sistema.",
                )

        conn.execute("DELETE FROM autenticacao_2fa WHERE user_id = %s", (user_id,))
        result = conn.execute("DELETE FROM usuarios WHERE id::text = %s", (user_id,))
        if result.rowcount == 0:
            raise HTTPException(status_code=404, detail="Usuário não encontrado.")
        conn.commit()
    return {"ok": True}


@router.post("/{user_id}/avatar")
def upload_avatar(
    user_id: UserId,
    file: UploadFile = File(...),
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, str]:
    # permite somente o próprio usuário ou admin (evita IDOR: trocar avatar alheio)
    if str(current_user.get("id")) != user_id and current_user.get("role") != "ADMIN":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Sem permissão para enviar avatar para este usuário.")

    content_type = (file.content_type or "").lower().split(";")[0].strip()
    if content_type not in _IMAGE_TYPES:
        raise HTTPException(status_code=400, detail="Formato inválido. Use JPG, PNG ou WebP.")
    ext, signatures = _IMAGE_TYPES[content_type]

    max_bytes = get_settings().max_avatar_bytes
    # lê no máximo max_bytes + 1: nunca carrega arquivo gigante em memória
    data = file.file.read(max_bytes + 1)
    try:
        file.file.close()
    except Exception:
        pass
    if len(data) > max_bytes:
        raise HTTPException(status_code=413, detail=f"Imagem maior que {max_bytes // (1024 * 1024)} MB.")
    # confere o CONTEÚDO real (o Content-Type é declarado pelo cliente e forjável)
    if not any(data.startswith(sig) for sig in signatures) or (content_type == "image/webp" and data[8:12] != b"WEBP"):
        raise HTTPException(status_code=400, detail="O arquivo não é uma imagem válida.")

    filename = f"{user_id}{ext}"
    dest = (AVATARS_DIR / filename).resolve()
    if AVATARS_DIR.resolve() not in dest.parents:
        raise HTTPException(status_code=400, detail="Caminho inválido.")

    # remove avatar anterior com outra extensão para não acumular lixo
    for _, (other_ext, _sigs) in _IMAGE_TYPES.items():
        old = AVATARS_DIR / f"{user_id}{other_ext}"
        if other_ext != ext and old.exists():
            try:
                old.unlink()
            except OSError:
                pass
    dest.write_bytes(data)

    return {"url": f"/avatars/{filename}"}
