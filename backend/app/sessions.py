"""Seção 4 — controle de sessão, inatividade (AFK) e histórico.

O que é imposto no SERVIDOR (fechar a aba, trocar a URL ou mexer no relógio do
navegador não contorna nada):

* **Expiração total** — já existia: o JWT tem `exp` e `decode_token` recusa
  token vencido. Com "manter conectado" o TTL é 7x maior (`token_ttl_minutes`).
* **Inatividade de 40 minutos** — novo. Cada requisição autenticada carimba
  `ultimo_acesso` da sessão (gravação limitada a 1x por minuto por sessão, para
  não transformar leitura em escrita). Passados 40 minutos sem nenhuma
  requisição, a sessão é encerrada, o JWT é revogado e a próxima chamada recebe
  401 — inclusive quando "manter conectado" está marcado.

Nenhuma senha é lida, trafegada ou guardada aqui: `sessoes_log` tem só
metadados (quem, quando, de onde, por quanto tempo e por que terminou).
"""

from __future__ import annotations

import threading
import time
from datetime import UTC, datetime
from typing import Any

#: Janela de inatividade pedida no escopo (40 minutos).
IDLE_LIMIT_SECONDS = 40 * 60

#: Só regrava `ultimo_acesso` depois deste intervalo — evita um UPDATE por request.
_ACTIVITY_WRITE_EVERY = 60.0

_lock = threading.Lock()
#: jti -> monotonic da última gravação feita por ESTE processo.
_last_write: dict[str, float] = {}

MOTIVO_LOGOUT = "logout"
MOTIVO_INATIVIDADE = "inatividade"
MOTIVO_EXPIRACAO = "expiracao"


def _trim_cache() -> None:
    if len(_last_write) > 5_000:
        for chave in list(_last_write)[:2_000]:
            _last_write.pop(chave, None)


def registrar_login(
    conn: Any,
    *,
    user_id: str,
    email: str | None,
    jti: str | None,
    remember_me: bool,
    ip: str | None,
    user_agent: str | None,
) -> None:
    """Abre uma linha de sessão. Falha aqui nunca impede o usuário de entrar."""
    if not jti:
        return
    try:
        conn.execute(
            """
            INSERT INTO sessoes_log (usuario_id, usuario_email, jti, remember_me, ip, user_agent, ultimo_acesso)
            VALUES (%s, %s, %s, %s, %s, %s, now())
            """,
            (str(user_id), (email or "")[:200], str(jti), bool(remember_me), (ip or "")[:64], (user_agent or "")[:400]),
        )
        conn.commit()
        with _lock:
            _last_write[str(jti)] = time.monotonic()
            _trim_cache()
    except Exception:
        conn.rollback()


def encerrar(conn: Any, jti: str | None, motivo: str = MOTIVO_LOGOUT) -> None:
    """Fecha a sessão aberta deste `jti`, calculando a duração."""
    if not jti:
        return
    try:
        conn.execute(
            """
            UPDATE sessoes_log
            SET logout_em = now(),
                duracao_seg = GREATEST(0, EXTRACT(EPOCH FROM (now() - login_em))::int),
                motivo_fim = %s
            WHERE jti = %s AND logout_em IS NULL
            """,
            (motivo[:30], str(jti)),
        )
        conn.commit()
    except Exception:
        conn.rollback()
    finally:
        with _lock:
            _last_write.pop(str(jti), None)


def verificar_e_marcar_atividade(conn: Any, jti: str | None) -> str | None:
    """Aplica a regra de inatividade e carimba a atividade atual.

    Retorna ``None`` quando a sessão segue válida, ou o motivo do encerramento
    (``"inatividade"``) para quem chamou devolver 401.

    Sessão sem linha em `sessoes_log` (token emitido antes desta funcionalidade)
    continua valendo pelo `exp` do JWT — não se derruba ninguém por falta de
    histórico.
    """
    if not jti:
        return None
    chave = str(jti)

    try:
        row = conn.execute(
            "SELECT logout_em, motivo_fim, EXTRACT(EPOCH FROM (now() - COALESCE(ultimo_acesso, login_em)))::int AS ocioso "
            "FROM sessoes_log WHERE jti = %s",
            (chave,),
        ).fetchone()
    except Exception:
        conn.rollback()
        return None

    if row is None:
        return None
    if row["logout_em"] is not None:
        return row["motivo_fim"] or MOTIVO_LOGOUT

    ocioso = int(row["ocioso"] or 0)
    if ocioso >= IDLE_LIMIT_SECONDS:
        encerrar(conn, chave, MOTIVO_INATIVIDADE)
        return MOTIVO_INATIVIDADE

    agora = time.monotonic()
    with _lock:
        ultimo = _last_write.get(chave, 0.0)
        precisa = agora - ultimo >= _ACTIVITY_WRITE_EVERY
        if precisa:
            _last_write[chave] = agora
            _trim_cache()
    if precisa:
        try:
            conn.execute("UPDATE sessoes_log SET ultimo_acesso = now() WHERE jti = %s", (chave,))
            conn.commit()
        except Exception:
            conn.rollback()
    return None


def segundos_restantes_inatividade(conn: Any, jti: str | None) -> int | None:
    """Quanto falta para a desconexão por inatividade (para o contador da tela)."""
    if not jti:
        return None
    try:
        row = conn.execute(
            "SELECT EXTRACT(EPOCH FROM (now() - COALESCE(ultimo_acesso, login_em)))::int AS ocioso "
            "FROM sessoes_log WHERE jti = %s AND logout_em IS NULL",
            (str(jti),),
        ).fetchone()
    except Exception:
        conn.rollback()
        return None
    if row is None:
        return None
    return max(0, IDLE_LIMIT_SECONDS - int(row["ocioso"] or 0))


def agora_iso() -> str:
    return datetime.now(UTC).isoformat()
