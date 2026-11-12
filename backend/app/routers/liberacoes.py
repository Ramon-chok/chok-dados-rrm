"""Liberações de alteração — o portão de escrita dos perfis de apoio.

Comprador, Analista e SAR têm acesso total de leitura, mas só alteram dados
**enquanto houver uma liberação ativa concedida por um administrador**. Este
módulo é a administração dessas liberações.

Por que a liberação EXPIRA
--------------------------
Ela nasce com prazo de propósito. Uma permissão de escrita concedida para
resolver uma pendência específica, se não expirasse sozinha, ficaria aberta
indefinidamente por esquecimento — e o portão viraria enfeite. O admin
concede pelo tempo que a tarefa pede; passado o prazo, o perfil volta sozinho
a ser de leitura, sem ninguém precisar lembrar de revogar.

Quem concede
------------
Somente SUPERADMIN e ADMIN (``require_roles`` já libera os dois). O ADMIN, por
estar em modo "confirmação", precisa confirmar a concessão como qualquer outra
alteração que ele faz — conceder escrita a outra pessoa é exatamente o tipo de
ação que não deve acontecer sem intenção explícita.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any

from fastapi import APIRouter, Body, Depends, HTTPException, Query

from app.db import get_connection
from app.sanitize import clean_optional
from app.security import (
    MODO_LIBERACAO,
    USER_SELECT,
    _garantir_tabela_liberacoes,
    estado_escrita,
    get_current_user,
    modo_escrita,
    require_roles,
    require_write,
)

router = APIRouter(tags=["liberacoes"])

#: Teto do prazo de uma liberação. Acima disso já não é "liberar para resolver
#: uma pendência", é mudar o perfil da pessoa — e isso se faz no cadastro.
MAX_HORAS = 72
HORAS_PADRAO = 8


@router.get("/acessos/meu-estado")
def meu_estado(user: dict[str, Any] = Depends(get_current_user)) -> dict[str, Any]:
    """Como ESTE usuário altera dados agora.

    A tela usa isto para decidir o que oferecer: botão de salvar normal,
    botão que abre o diálogo de confirmação, ou aviso de que falta liberação.
    É conveniência de interface — quem decide continua sendo o servidor, a
    cada requisição de escrita.
    """
    estado = estado_escrita(user)
    return {
        **estado,
        "papel": user.get("role"),
    }


@router.get("/acessos/liberacoes")
def listar_liberacoes(
    incluir_encerradas: bool = Query(default=False),
    _admin: dict[str, Any] = Depends(require_roles()),
) -> dict[str, Any]:
    """Liberações concedidas, com quem concedeu e até quando valem."""
    parts = ["1=1"]
    if not incluir_encerradas:
        parts.append("l.revogado_em IS NULL AND l.expira_em > now()")

    with get_connection() as conn:
        _garantir_tabela_liberacoes(conn)
        rows = conn.execute(
            f"""
            SELECT l.id, l.usuario_id, l.usuario_email, l.concedido_por, l.concedido_em,
                   l.expira_em, l.motivo, l.revogado_em, l.revogado_por,
                   u.name AS usuario_nome, u.role AS usuario_papel
            FROM liberacoes_escrita l
            LEFT JOIN usuarios u ON u.id::text = l.usuario_id
            WHERE {" AND ".join(parts)}
            ORDER BY l.concedido_em DESC
            LIMIT 200
            """
        ).fetchall()

        # Quem pode receber liberação: só os papéis que dependem dela.
        candidatos = conn.execute(
            USER_SELECT + " WHERE status = 'Ativo' ORDER BY name"
        ).fetchall()

    agora = datetime.now(UTC)
    return {
        "liberacoes": [
            {
                "id": int(r["id"]),
                "usuarioId": r["usuario_id"],
                "usuario": r["usuario_nome"] or r["usuario_email"],
                "papel": r["usuario_papel"],
                "concedidoPor": r["concedido_por"],
                "concedidoEm": r["concedido_em"].isoformat() if r["concedido_em"] else None,
                "expiraEm": r["expira_em"].isoformat() if r["expira_em"] else None,
                "motivo": r["motivo"],
                "revogadoEm": r["revogado_em"].isoformat() if r["revogado_em"] else None,
                "revogadoPor": r["revogado_por"],
                "ativa": bool(r["revogado_em"] is None and r["expira_em"] and r["expira_em"] > agora),
            }
            for r in rows
        ],
        "candidatos": [
            {
                "id": str(c["id"]),
                "nome": c["name"],
                "email": c["email"],
                "papel": c["role"],
            }
            for c in candidatos
            if modo_escrita(c["role"]) == MODO_LIBERACAO
        ],
        "horasPadrao": HORAS_PADRAO,
        "maxHoras": MAX_HORAS,
    }


@router.post("/acessos/liberacoes", status_code=201)
def conceder(
    body: dict[str, Any] = Body(...),
    admin: dict[str, Any] = Depends(require_write("admin.full_access")),
) -> dict[str, Any]:
    """Concede a um usuário a permissão de alterar, por um prazo."""
    usuario_id = clean_optional(body.get("usuarioId"), 40)
    if not usuario_id:
        raise HTTPException(status_code=400, detail="Informe o usuário que receberá a liberação.")
    try:
        horas = int(body.get("horas") or HORAS_PADRAO)
    except (TypeError, ValueError) as exc:
        raise HTTPException(status_code=400, detail="Prazo inválido.") from exc
    if horas < 1 or horas > MAX_HORAS:
        raise HTTPException(
            status_code=400,
            detail=(
                f"O prazo precisa ficar entre 1 e {MAX_HORAS} horas. Para acesso permanente de escrita, "
                "mude o perfil do usuário no cadastro em vez de liberar por tempo."
            ),
        )

    with get_connection() as conn:
        _garantir_tabela_liberacoes(conn)
        alvo = conn.execute(
            "SELECT id::text AS id, name, email, role FROM usuarios WHERE id::text = %s",
            (usuario_id,),
        ).fetchone()
        if not alvo:
            raise HTTPException(status_code=404, detail="Usuário não encontrado.")
        if modo_escrita(alvo["role"]) != MODO_LIBERACAO:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"O perfil {alvo['role']} não usa liberação temporária: ou ele já altera dados, "
                    "ou é um perfil de visualização. Liberar não mudaria nada."
                ),
            )
        # Uma liberação por vez: a nova substitui a anterior em vigor, para
        # não ficar uma pilha de prazos sobrepostos difícil de auditar.
        conn.execute(
            """
            UPDATE liberacoes_escrita
            SET revogado_em = now(), revogado_por = %s
            WHERE usuario_id = %s AND revogado_em IS NULL AND expira_em > now()
            """,
            (str(admin.get("email") or admin.get("id")), usuario_id),
        )
        conn.execute(
            """
            INSERT INTO liberacoes_escrita
              (usuario_id, usuario_email, concedido_por, expira_em, motivo)
            VALUES (%s, %s, %s, %s, %s)
            """,
            (
                usuario_id,
                alvo["email"],
                str(admin.get("email") or admin.get("id")),
                datetime.now(UTC) + timedelta(hours=horas),
                clean_optional(body.get("motivo"), 300),
            ),
        )
        conn.commit()

    return {"ok": True, "usuario": alvo["name"], "horas": horas}


@router.delete("/acessos/liberacoes/{liberacao_id}")
def revogar(
    liberacao_id: int,
    admin: dict[str, Any] = Depends(require_write("admin.full_access")),
) -> dict[str, Any]:
    """Encerra uma liberação antes do prazo."""
    with get_connection() as conn:
        _garantir_tabela_liberacoes(conn)
        linha = conn.execute(
            "SELECT id FROM liberacoes_escrita WHERE id = %s AND revogado_em IS NULL",
            (liberacao_id,),
        ).fetchone()
        if not linha:
            raise HTTPException(status_code=404, detail="Liberação não encontrada ou já encerrada.")
        conn.execute(
            "UPDATE liberacoes_escrita SET revogado_em = now(), revogado_por = %s WHERE id = %s",
            (str(admin.get("email") or admin.get("id")), liberacao_id),
        )
        conn.commit()
    return {"ok": True}
