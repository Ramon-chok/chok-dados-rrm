"""Suporte — relato de bug pelo botão da faixa do topo.

Qualquer usuário logado pode relatar: o relato não altera dado comercial
nenhum, então NÃO passa pelo portão de escrita (`require_write`) — um Vendedor
em modo leitura precisa conseguir avisar que algo quebrou.

O relato é sempre gravado (tabela `relatos_bug`). Se `SUPORTE_EMAIL` e o SMTP
estiverem configurados, um e-mail também sai para o suporte; falha de envio
não derruba o relato, porque o registro no banco é o que importa.
"""

from __future__ import annotations

import logging
import smtplib
import ssl
from email.message import EmailMessage
from typing import Any

from fastapi import APIRouter, Body, Depends, HTTPException, Query

from app.config import get_settings
from app.db import get_connection
from app.sanitize import clean_optional, clean_text
from app.security import get_current_user, require_roles

logger = logging.getLogger(__name__)
router = APIRouter(tags=["suporte"])

_GRAVIDADES = {"baixa", "media", "alta"}


def _avisar_por_email(relato: dict[str, Any]) -> bool:
    """Envia o relato ao suporte. Devolve False (sem exceção) se não deu."""
    settings = get_settings()
    destino = (settings.suporte_email or "").strip()
    if not destino or not settings.smtp_host or not settings.smtp_user or not settings.smtp_password:
        return False
    msg = EmailMessage()
    msg["Subject"] = f"[Cockpit Chok · bug {relato['gravidade']}] {relato['titulo']}"
    msg["From"] = settings.smtp_from or settings.smtp_user
    msg["To"] = destino
    msg.set_content(
        "\n".join(
            [
                f"Relato #{relato['id']}",
                f"Usuário: {relato['usuario_nome']} ({relato['papel']})",
                f"Tela: {relato['pagina'] or '—'}",
                f"Navegador: {relato['navegador'] or '—'}",
                f"Resolução: {relato['tela'] or '—'}",
                "",
                relato["descricao"],
            ]
        )
    )
    try:
        porta = int(settings.smtp_port or 0)
        if settings.smtp_secure:
            with smtplib.SMTP_SSL(settings.smtp_host, porta, context=ssl.create_default_context(), timeout=10) as s:
                s.login(settings.smtp_user, settings.smtp_password)
                s.send_message(msg)
        else:
            with smtplib.SMTP(settings.smtp_host, porta, timeout=10) as s:
                s.ehlo()
                s.starttls(context=ssl.create_default_context())
                s.login(settings.smtp_user, settings.smtp_password)
                s.send_message(msg)
        return True
    except Exception:
        logger.exception("Relato de bug #%s gravado, mas o e-mail ao suporte falhou", relato["id"])
        return False


@router.post("/suporte/bugs", status_code=201)
def relatar_bug(
    body: dict[str, Any] = Body(...),
    user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    titulo = clean_text(body.get("titulo"), 160)
    descricao = clean_text(body.get("descricao"), 4000, multiline=True)
    if len(titulo) < 4:
        raise HTTPException(status_code=400, detail="Descreva o problema em um título curto.")
    if len(descricao) < 10:
        raise HTTPException(status_code=400, detail="Conte o que aconteceu com um pouco mais de detalhe.")
    gravidade = str(body.get("gravidade") or "media").lower()
    if gravidade not in _GRAVIDADES:
        gravidade = "media"

    with get_connection() as conn:
        row = conn.execute(
            """
            INSERT INTO relatos_bug
              (usuario_id, usuario_nome, usuario_email, papel, pagina, titulo, descricao,
               gravidade, navegador, tela)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id
            """,
            (
                str(user.get("id")),
                user.get("name"),
                user.get("email"),
                user.get("role"),
                clean_optional(body.get("pagina"), 120),
                titulo,
                descricao,
                gravidade,
                clean_optional(body.get("navegador"), 300),
                clean_optional(body.get("tela"), 40),
            ),
        ).fetchone()
        conn.commit()

    relato = {
        "id": int(row["id"]),
        "usuario_nome": user.get("name"),
        "papel": user.get("role"),
        "pagina": body.get("pagina"),
        "navegador": body.get("navegador"),
        "tela": body.get("tela"),
        "titulo": titulo,
        "descricao": descricao,
        "gravidade": gravidade,
    }
    return {"ok": True, "id": relato["id"], "emailEnviado": _avisar_por_email(relato)}


@router.get("/suporte/bugs")
def listar_bugs(
    limit: int = Query(default=100, ge=1, le=500),
    _admin: dict[str, Any] = Depends(require_roles()),
) -> list[dict[str, Any]]:
    with get_connection() as conn:
        rows = conn.execute(
            """
            SELECT id, usuario_nome, usuario_email, papel, pagina, titulo, descricao,
                   gravidade, navegador, tela, status, criado_em
            FROM relatos_bug ORDER BY criado_em DESC LIMIT %s
            """,
            (limit,),
        ).fetchall()
    return [
        {
            "id": int(r["id"]),
            "usuario": r["usuario_nome"],
            "email": r["usuario_email"],
            "papel": r["papel"],
            "pagina": r["pagina"],
            "titulo": r["titulo"],
            "descricao": r["descricao"],
            "gravidade": r["gravidade"],
            "navegador": r["navegador"],
            "tela": r["tela"],
            "status": r["status"],
            "criadoEm": r["criado_em"].isoformat() if r["criado_em"] else None,
        }
        for r in rows
    ]
