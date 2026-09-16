from __future__ import annotations

import base64
import io
import secrets
import string
from datetime import UTC, datetime, timedelta
from typing import Any

import pyotp
import qrcode
from fastapi import APIRouter, Body, Depends, HTTPException, status
from qrcode.image.pil import PilImage

from app.db import get_connection
from app.mail import send_test_email
from app.security import get_current_user

router = APIRouter(prefix="/2fa", tags=["2fa"])

TABLE_SQL = """
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

ALTERS = [
    "ALTER TABLE autenticacao_2fa ADD COLUMN IF NOT EXISTS backup_codes text[] DEFAULT '{}'",
    "ALTER TABLE autenticacao_2fa ADD COLUMN IF NOT EXISTS require_next_login boolean DEFAULT true",
    "ALTER TABLE autenticacao_2fa ADD COLUMN IF NOT EXISTS activated_at timestamptz",
]


def _ensure_table(conn) -> None:
    conn.execute(TABLE_SQL)
    for stmt in ALTERS:
        try:
            conn.execute(stmt)
        except Exception:
            pass
    conn.commit()


def _generate_numeric_code(length: int = 6) -> str:
    return "".join(str(secrets.randbelow(10)) for _ in range(length))


def _generate_backup_codes(count: int = 8) -> list[str]:
    alphabet = string.ascii_uppercase + string.digits
    codes: list[str] = []
    for _ in range(count):
        raw = "".join(secrets.choice(alphabet) for _ in range(8))
        codes.append(f"{raw[:4]}-{raw[4:]}")
    return codes


def _qr_data_url(provisioning_uri: str) -> str:
    qr = qrcode.QRCode(version=1, box_size=8, border=2)
    qr.add_data(provisioning_uri)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white", image_factory=PilImage)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    b64 = base64.b64encode(buf.getvalue()).decode("ascii")
    return f"data:image/png;base64,{b64}"


def _aware(dt: datetime | None) -> datetime | None:
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=UTC)
    return dt


def _normalize_totp_secret(secret: str | None) -> str:
    """Base32 secrets sometimes arrive with spaces/dashes/lowercase from clients/DB."""
    if not secret:
        return ""
    return (
        str(secret)
        .strip()
        .replace(" ", "")
        .replace("-", "")
        .replace("\n", "")
        .replace("\t", "")
        .upper()
    )


def _normalize_otp_code(code: str | None) -> str:
    """Keep digits only (apps sometimes include spaces or a dash)."""
    if code is None:
        return ""
    return "".join(ch for ch in str(code).strip() if ch.isdigit())


def _verify_totp(secret: str | None, code: str | None, *, window: int = 2) -> bool:
    """
    Validate a TOTP code with a wider window to tolerate small clock skew
    between the server and the authenticator device.
    window=2 => current ± 2 steps (about ±60s with 30s period).
    """
    sec = _normalize_totp_secret(secret)
    code_n = _normalize_otp_code(code)
    if not sec or len(code_n) != 6:
        return False
    try:
        return bool(pyotp.TOTP(sec).verify(code_n, valid_window=window))
    except Exception:
        return False


@router.get("/status")
def twofa_status(user: dict[str, Any] = Depends(get_current_user)) -> dict[str, Any]:
    with get_connection() as conn:
        _ensure_table(conn)
        row = conn.execute(
            """
            SELECT metodo, status, telefone, email, require_next_login, activated_at
            FROM autenticacao_2fa
            WHERE user_id = %s
            """,
            (user["id"],),
        ).fetchone()
    if not row or not row["status"]:
        return {"enabled": False, "method": None, "requireNextLogin": True, "activatedAt": None}
    activated = row["activated_at"]
    return {
        "enabled": True,
        "method": row["metodo"],
        "phone": row.get("telefone"),
        "email": row.get("email"),
        "requireNextLogin": bool(row.get("require_next_login", True)),
        "activatedAt": activated.isoformat() if activated else None,
    }


@router.post("/init")
def twofa_init(body: dict = Body(...), user: dict[str, Any] = Depends(get_current_user)) -> dict[str, Any]:
    method = (body.get("method") or "authenticator").lower().strip()
    phone = (body.get("phone") or body.get("telefone") or "").strip() or None
    email = (body.get("email") or user.get("email") or "").strip() or None

    with get_connection() as conn:
        _ensure_table(conn)

        if method == "authenticator":
            secret = _normalize_totp_secret(pyotp.random_base32())
            totp = pyotp.TOTP(secret)
            # issuer without spaces avoids quirks in some authenticator apps
            account_name = str(user.get("email") or user["id"]).strip()
            provisioning_uri = totp.provisioning_uri(
                name=account_name,
                issuer_name="CHOK-Dados",
            )
            conn.execute(
                """
                INSERT INTO autenticacao_2fa(
                    user_id, metodo, segredo, status, telefone, email,
                    codigo_temp, expira_temp, backup_codes, require_next_login, activated_at
                )
                VALUES (%s, %s, %s, false, %s, %s, NULL, NULL, '{}', true, NULL)
                ON CONFLICT (user_id) DO UPDATE SET
                    metodo = EXCLUDED.metodo,
                    segredo = EXCLUDED.segredo,
                    status = false,
                    telefone = EXCLUDED.telefone,
                    email = EXCLUDED.email,
                    codigo_temp = NULL,
                    expira_temp = NULL,
                    backup_codes = '{}',
                    activated_at = NULL
                """,
                (str(user["id"]), "authenticator", secret, phone, email),
            )
            conn.commit()
            return {
                "ok": True,
                "method": "authenticator",
                "secret": secret,
                "provisioningUri": provisioning_uri,
                "qrCodeDataUrl": _qr_data_url(provisioning_uri),
            }

        if method in ("email", "sms"):
            if method == "sms" and not phone:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Telefone é obrigatório para 2FA por SMS.",
                )
            if method == "email" and not email:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="E-mail é obrigatório para 2FA por e-mail.",
                )

            code = _generate_numeric_code(6)
            expires = datetime.now(UTC) + timedelta(minutes=5)
            conn.execute(
                """
                INSERT INTO autenticacao_2fa(
                    user_id, metodo, segredo, status, telefone, email,
                    codigo_temp, expira_temp, backup_codes, require_next_login, activated_at
                )
                VALUES (%s, %s, NULL, false, %s, %s, %s, %s, '{}', true, NULL)
                ON CONFLICT (user_id) DO UPDATE SET
                    metodo = EXCLUDED.metodo,
                    segredo = NULL,
                    status = false,
                    telefone = EXCLUDED.telefone,
                    email = EXCLUDED.email,
                    codigo_temp = EXCLUDED.codigo_temp,
                    expira_temp = EXCLUDED.expira_temp,
                    backup_codes = '{}',
                    activated_at = NULL
                """,
                (user["id"], method, phone, email, code, expires),
            )
            conn.commit()

            delivered = False
            if method == "email" and email:
                try:
                    send_test_email(
                        email,
                        subject="Seu código CHOK 2FA",
                        body=f"Seu código de verificação é: {code}\n\nVálido por 5 minutos.",
                    )
                    delivered = True
                except Exception:
                    delivered = False

            return {
                "ok": True,
                "method": method,
                "delivery": method,
                "delivered": delivered if method == "email" else False,
                "expiresIn": 300,
                **({"devCode": code} if method == "sms" else {}),
            }

        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Método inválido")


@router.post("/resend")
def twofa_resend(body: dict = Body(default={}), user: dict[str, Any] = Depends(get_current_user)) -> dict[str, Any]:
    with get_connection() as conn:
        _ensure_table(conn)
        row = conn.execute(
            "SELECT metodo, telefone, email, status FROM autenticacao_2fa WHERE user_id = %s",
            (user["id"],),
        ).fetchone()
        if not row:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Configuração 2FA não encontrada")
        method = row["metodo"]
        if method not in ("email", "sms"):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Reenvio só para e-mail/SMS")
        if row["status"]:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="2FA já está ativo")

        code = _generate_numeric_code(6)
        expires = datetime.now(UTC) + timedelta(minutes=5)
        conn.execute(
            "UPDATE autenticacao_2fa SET codigo_temp = %s, expira_temp = %s WHERE user_id = %s",
            (code, expires, user["id"]),
        )
        conn.commit()

        delivered = False
        if method == "email" and row.get("email"):
            try:
                send_test_email(
                    row["email"],
                    subject="Seu código CHOK 2FA",
                    body=f"Seu código de verificação é: {code}\n\nVálido por 5 minutos.",
                )
                delivered = True
            except Exception:
                delivered = False

        return {
            "ok": True,
            "delivery": method,
            "delivered": delivered if method == "email" else False,
            "expiresIn": 300,
            **({"devCode": code} if method == "sms" else {}),
        }


@router.post("/verify")
def twofa_verify(body: dict = Body(...), user: dict[str, Any] = Depends(get_current_user)) -> dict[str, Any]:
    raw_code = body.get("code", "")
    code = _normalize_otp_code(raw_code)
    # backup-style codes (XXXX-XXXX) may appear here only after enable; activation uses 6 digits
    require_next = body.get("requireNextLogin")
    if require_next is None:
        require_next = True
    require_next = bool(require_next)

    if not code:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Código é obrigatório")
    if len(code) != 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Informe o código de 6 dígitos do aplicativo autenticador.",
        )

    with get_connection() as conn:
        _ensure_table(conn)
        row = conn.execute(
            "SELECT metodo, segredo, codigo_temp, expira_temp, status FROM autenticacao_2fa WHERE user_id = %s",
            (str(user["id"]),),
        ).fetchone()
        if not row:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Configuração 2FA não encontrada. Gere o QR novamente.")

        method = (row["metodo"] or "").lower().strip()
        ok = False

        if method == "authenticator":
            secret = row["segredo"]
            if not secret:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Segredo não encontrado. Volte e gere o QR code novamente.",
                )
            ok = _verify_totp(secret, code, window=2)
        elif method in ("email", "sms"):
            temp = row["codigo_temp"]
            exp = _aware(row["expira_temp"])
            if not temp or not exp:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Código temporário não disponível",
                )
            if datetime.now(UTC) > exp:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Código expirado")
            ok = secrets.compare_digest(code, _normalize_otp_code(str(temp)))
        else:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Método desconhecido")

        if not ok:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Código inválido. Confira o horário do celular e use o código atual do app (ou gere o QR de novo).",
            )

        backup_codes = _generate_backup_codes(8)
        now = datetime.now(UTC)
        conn.execute(
            """
            UPDATE autenticacao_2fa
            SET status = true,
                codigo_temp = NULL,
                expira_temp = NULL,
                backup_codes = %s,
                require_next_login = %s,
                activated_at = %s
            WHERE user_id = %s
            """,
            (backup_codes, require_next, now, user["id"]),
        )
        conn.commit()

        return {
            "ok": True,
            "enabled": True,
            "method": method,
            "backupCodes": backup_codes,
            "requireNextLogin": require_next,
            "activatedAt": now.isoformat(),
        }


@router.post("/disable")
def twofa_disable(body: dict = Body(default={}), user: dict[str, Any] = Depends(get_current_user)) -> dict[str, Any]:
    code = str(body.get("code") or "").strip().replace(" ", "")

    with get_connection() as conn:
        _ensure_table(conn)
        row = conn.execute(
            "SELECT metodo, segredo, status, backup_codes FROM autenticacao_2fa WHERE user_id = %s",
            (user["id"],),
        ).fetchone()
        if not row or not row["status"]:
            conn.execute(
                """
                UPDATE autenticacao_2fa
                SET status = false, segredo = NULL, codigo_temp = NULL, expira_temp = NULL,
                    backup_codes = '{}', activated_at = NULL
                WHERE user_id = %s
                """,
                (user["id"],),
            )
            conn.commit()
            return {"ok": True, "enabled": False}

        if code:
            method = (row["metodo"] or "").lower().strip()
            valid = False
            if method == "authenticator" and row.get("segredo"):
                valid = _verify_totp(row["segredo"], code, window=2)
            if not valid and row.get("backup_codes"):
                codes = list(row["backup_codes"] or [])
                code_up = str(code).strip().upper().replace(" ", "")
                if code_up in [str(c).upper().replace(" ", "") for c in codes]:
                    valid = True
            if not valid:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Código inválido")

        conn.execute(
            """
            UPDATE autenticacao_2fa
            SET status = false,
                segredo = NULL,
                codigo_temp = NULL,
                expira_temp = NULL,
                backup_codes = '{}',
                activated_at = NULL
            WHERE user_id = %s
            """,
            (user["id"],),
        )
        conn.commit()
        return {"ok": True, "enabled": False}
