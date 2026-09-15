from __future__ import annotations

import smtplib
import ssl
import logging
from email.message import EmailMessage
from typing import Optional

from app.config import get_settings

logger = logging.getLogger(__name__)


def send_welcome_email(to_email: str, name: Optional[str], password: str) -> None:
    """Envia um e-mail com as credenciais para um novo usuário.

    Não lança exceções em caso de falha: apenas registra o erro.
    """
    settings = get_settings()
    host = settings.smtp_host
    port = int(settings.smtp_port or 0)
    user = settings.smtp_user
    pwd = settings.smtp_password
    secure = bool(settings.smtp_secure)
    from_addr = settings.smtp_from or user

    if not host or not port or not user or not pwd:
        logger.info("SMTP não configurado: pulando envio de e-mail de boas-vindas")
        return

    subject = "Bem-vindo(a) — Acesso à plataforma"
    body = (
        f"Olá {name or ''},\n\n"
        "Seu usuário foi criado com sucesso. Abaixo estão suas credenciais de acesso:\n\n"
        f"E-mail: {to_email}\n"
        f"Senha: {password}\n\n"
        "Recomendamos alterar sua senha após o primeiro acesso.\n\n"
        "Atenciosamente,\n"
        "Equipe"
    )

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = from_addr
    msg["To"] = to_email
    msg.set_content(body)

    try:
        if secure:
            context = ssl.create_default_context()
            with smtplib.SMTP_SSL(host, port, context=context) as server:
                server.login(user, pwd)
                server.send_message(msg)
        else:
            with smtplib.SMTP(host, port, timeout=10) as server:
                server.ehlo()
                try:
                    server.starttls(context=ssl.create_default_context())
                except Exception:
                    pass
                server.login(user, pwd)
                server.send_message(msg)
        logger.info(f"E-mail de boas-vindas enviado para {to_email}")
    except Exception as exc:  # pragma: no cover - environment-specific
        logger.exception("Falha ao enviar e-mail de boas-vindas: %s", exc)
