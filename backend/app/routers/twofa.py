from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status, Body

from app.db import get_connection
from app.security import get_current_user
from app.mail import send_test_email

router = APIRouter(prefix="/2fa", tags=["2fa"])


def _ensure_table(conn) -> None:
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
            expira_temp timestamptz
        )
        """
    )


@router.get("/status")
def status(user: dict[str, Any] = Depends(get_current_user)) -> dict[str, Any]:
    with get_connection() as conn:
        _ensure_table(conn)
        row = conn.execute("SELECT metodo, status FROM autenticacao_2fa WHERE user_id = %s", (user["id"],)).fetchone()
    if not row:
        return {"enabled": False}
    return {"enabled": bool(row["status"]), "method": row["metodo"]}


@router.post("/init")
def init(body: dict = Body(...), user: dict[str, Any] = Depends(get_current_user)) -> dict[str, Any]:
    method = (body.get("method") or "authenticator").lower()
    phone = body.get("phone")
    email = body.get("email") or user.get("email")

    with get_connection() as conn:
        _ensure_table(conn)
        if method == "authenticator":
            import pyotp

            secret = pyotp.random_base32()
            provisioning_uri = pyotp.totp.TOTP(secret).provisioning_uri(name=user["email"], issuer_name="CHOK Dados")
            conn.execute(
                "INSERT INTO autenticacao_2fa(user_id, metodo, segredo, status, telefone, email) VALUES(%s,%s,%s,false,%s,%s) ON CONFLICT (user_id) DO UPDATE SET metodo = EXCLUDED.metodo, segredo = EXCLUDED.segredo, status = false, telefone = EXCLUDED.telefone, email = EXCLUDED.email",
                (user["id"], "authenticator", secret, phone, email),
            )
            conn.commit()
            return {"ok": True, "provisioning_uri": provisioning_uri}

        if method in ("email", "sms"):
            # generate numeric code and send
            import pyotp

            code = f"{pyotp.random_base32()[:6]}".replace("=", "0")[:6]
            expires = datetime.utcnow() + timedelta(minutes=5)
            conn.execute(
                "INSERT INTO autenticacao_2fa(user_id, metodo, segredo, status, telefone, email, codigo_temp, expira_temp) VALUES(%s,%s,%s,false,%s,%s,%s,%s) ON CONFLICT (user_id) DO UPDATE SET metodo = EXCLUDED.metodo, codigo_temp = EXCLUDED.codigo_temp, expira_temp = EXCLUDED.expira_temp, telefone = EXCLUDED.telefone, email = EXCLUDED.email",
                (user["id"], method, None, phone, email, code, expires),
            )
            conn.commit()
            if method == "email":
                try:
                    send_test_email(email, subject="Seu código CHOK 2FA", body=f"Seu código é: {code}")
                except Exception:
                    # don't leak provider errors
                    pass
            # For SMS we currently only store the code; integration can be added later
            return {"ok": True, "delivery": method}

        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Método inválido")


@router.post("/verify")
def verify(body: dict = Body(...), user: dict[str, Any] = Depends(get_current_user)) -> dict[str, Any]:
    code = str(body.get("code", "")).strip()
    if not code:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Código é obrigatório")

    with get_connection() as conn:
        _ensure_table(conn)
        row = conn.execute("SELECT metodo, segredo, codigo_temp, expira_temp FROM autenticacao_2fa WHERE user_id = %s", (user["id"],)).fetchone()
        if not row:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Configuração 2FA não encontrada")

        method = row["metodo"]
        if method == "authenticator":
            secret = row["segredo"]
            if not secret:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Segredo não encontrado")
            import pyotp

            totp = pyotp.TOTP(secret)
            ok = totp.verify(code, valid_window=1)
            if not ok:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Código inválido")
            conn.execute("UPDATE autenticacao_2fa SET status = true, codigo_temp = NULL, expira_temp = NULL WHERE user_id = %s", (user["id"],))
            conn.commit()
            return {"ok": True}

        if method in ("email", "sms"):
            temp = row["codigo_temp"]
            exp = row["expira_temp"]
            if not temp or not exp:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Código temporário não disponível")
            if datetime.utcnow() > exp:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Código expirado")
            if code != temp:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Código inválido")
            conn.execute("UPDATE autenticacao_2fa SET status = true, codigo_temp = NULL, expira_temp = NULL WHERE user_id = %s", (user["id"],))
            conn.commit()
            return {"ok": True}

        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Método desconhecido")
