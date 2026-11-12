from __future__ import annotations

import hmac
import secrets
from datetime import UTC, datetime, timedelta
from typing import Any

import bcrypt
import jwt
from fastapi import Depends, Header, HTTPException, status, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.config import get_settings
from app import sessions
from app.db import get_connection

bearer_scheme = HTTPBearer(auto_error=False)

# SELECT canônico: colunas PT do auth.sql → aliases EN usados pela API/JWT
USER_SELECT = """
    SELECT
      id::text AS id,
      name,
      email,
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
      fabricante AS manufacturer,
      status,
      last_login_at,
      COALESCE(extra_permissions, '{}'::text[]) AS extra_permissions
    FROM usuarios
"""

# Espelho de src/types.ts (Permission).
#
# ╔══════════════════════════════════════════════════════════════════════════╗
# ║ MATRIZ DE PERFIS — 10 papeis                                             ║
# ╠══════════════════════════════════════════════════════════════════════════╣
# ║ SUPERADMIN         total       altera tudo, sem portao                    ║
# ║ ADMIN              total       altera mediante confirmacao                ║
# ║ GERENTE_COMERCIAL  total       so leitura  (COM margens)                  ║
# ║ GERENTE_VENDAS     total       so leitura  (SEM margens)                  ║
# ║ COMPRADOR          total       altera apos liberacao do admin             ║
# ║ SUPERVISOR         equipe      so leitura                                 ║
# ║ ANALISTA           total       altera apos liberacao do admin             ║
# ║ FORNECEDOR         fabricante  so leitura, so a Visual Fabricantes        ║
# ║ VENDEDOR           proprio     so leitura                                 ║
# ║ SAR                total       altera apos liberacao do admin             ║
# ╚══════════════════════════════════════════════════════════════════════════╝
#
# Duas dimensoes INDEPENDENTES, e e importante nao confundi-las:
#
#   1. O que o papel VE        -> ROLE_PERMISSIONS (abaixo) + scope_filters
#   2. O que o papel ALTERA    -> MODO_ESCRITA (abaixo) + require_write
#
# "Acesso total" nesta matriz significa toda a leitura COMERCIAL da
# plataforma. A administracao da propria plataforma (cadastro de usuarios,
# importacoes e exportacoes) continua restrita a SUPERADMIN e ADMIN: e o que
# separa "ver tudo" de "administrar tudo".
#
# "margin.view" e o que libera margem/custo. Quem nao a tem recebe margem
# nula do backend, nao um campo escondido na tela.

#: Leitura comercial completa — a base de "acesso total".
_LEITURA_TOTAL = [
    "sales-board.view",
    "categories.view",
    "dashboard.view",
    "targets.view",
    "customers.view",
    "products.view",
    "settings.view",
    "manufacturers.view",
    "manufacturers.export",
    "comparisons.view",
    "simulations.run",
    "calendar.view",
    "purchasing.view",
    "sar.view",
    "search.global",
]

#: Permissoes de ESCRITA. Só entram nos papeis que podem alterar alguma coisa
#: — inclusive nos que dependem de liberacao, porque ali o portao e o
#: MODO_ESCRITA, não a ausencia da permissao. Papel de leitura nao recebe
#: nenhuma delas: assim, mesmo que um portao falhe, nao ha o que escrever.
_ESCRITA_OPERACIONAL = [
    "targets.create",
    "targets.edit",
    "customers.edit",
    "calendar.edit",
    "purchasing.edit",
]

ROLE_PERMISSIONS: dict[str, list[str]] = {
    # Acesso tecnico irrestrito + manutencao da plataforma. Altera qualquer
    # criterio e parametro sem portao nenhum.
    "SUPERADMIN": ["admin.full_access", "platform.manage"],
    # Mesma alcada de leitura e escrita do SUPERADMIN; a diferenca esta no
    # MODO_ESCRITA, que exige confirmacao explicita a cada alteracao.
    "ADMIN": ["admin.full_access"],
    # Acesso total COM visual das margens, sem alterar nada.
    "GERENTE_COMERCIAL": [*_LEITURA_TOTAL, "audit.view", "margin.view"],
    # Acesso total SEM visual das margens, sem alterar nada.
    "GERENTE_VENDAS": [*_LEITURA_TOTAL, "audit.view"],
    # Acesso total; altera apos liberacao do admin.
    "COMPRADOR": [*_LEITURA_TOTAL, "margin.view", *_ESCRITA_OPERACIONAL],
    "ANALISTA": [*_LEITURA_TOTAL, "margin.view", *_ESCRITA_OPERACIONAL],
    "SAR": [*_LEITURA_TOTAL, "margin.view", *_ESCRITA_OPERACIONAL],
    # Somente visualizacao, e so dos dados da propria equipe. O recorte por
    # equipe e aplicado no SQL por scope_filters, nao na tela.
    "SUPERVISOR": _LEITURA_TOTAL,
    # Somente visualizacao, e so dos proprios dados (recorte por codigo de
    # vendedor, tambem no SQL).
    "VENDEDOR": _LEITURA_TOTAL,
    # Representante do fabricante (perfil EXTERNO). Enxerga somente a Visual
    # Fabricantes, e dentro dela somente o fabricante vinculado ao cadastro
    # dele. NUNCA margem, em combinacao nenhuma de filtros.
    "FORNECEDOR": [
        "manufacturers.view",
        "manufacturers.export",
        "targets.view",
    ],
}

ROLE_LABELS = {
    "SUPERADMIN": "Super Administrador",
    "ADMIN": "Administrador",
    "GERENTE_COMERCIAL": "Gerente Comercial",
    "GERENTE_VENDAS": "Gerente de Vendas",
    "COMPRADOR": "Comprador",
    "SUPERVISOR": "Supervisor",
    "ANALISTA": "Analista",
    "FORNECEDOR": "Fornecedor",
    "VENDEDOR": "Vendedor",
    "SAR": "SAR",
}

# ── Modos de alteracao ──────────────────────────────────────────────────────
#
#   "livre"        altera direto
#   "confirmacao"  altera, mas cada requisicao precisa vir confirmada
#   "liberacao"    altera so enquanto houver liberacao ativa concedida pelo admin
#   "leitura"      nao altera nada
#
MODO_LIVRE = "livre"
MODO_CONFIRMACAO = "confirmacao"
MODO_LIBERACAO = "liberacao"
MODO_LEITURA = "leitura"

MODO_ESCRITA: dict[str, str] = {
    "SUPERADMIN": MODO_LIVRE,
    "ADMIN": MODO_CONFIRMACAO,
    "GERENTE_COMERCIAL": MODO_LEITURA,
    "GERENTE_VENDAS": MODO_LEITURA,
    "COMPRADOR": MODO_LIBERACAO,
    "SUPERVISOR": MODO_LEITURA,
    "ANALISTA": MODO_LIBERACAO,
    "FORNECEDOR": MODO_LEITURA,
    "VENDEDOR": MODO_LEITURA,
    "SAR": MODO_LIBERACAO,
}

#: Cabecalho que o navegador envia para confirmar uma alteracao (modo
#: "confirmacao"). A tela so o envia depois que a pessoa confirma no dialogo.
CABECALHO_CONFIRMACAO = "x-confirmar-alteracao"

#: Papeis com alcada administrativa plena. SUPERADMIN acompanha o ADMIN em
#: toda checagem que antes comparava `role == "ADMIN"`.
ROLES_ADMIN = ("SUPERADMIN", "ADMIN")

#: Papeis com visao consolidada (nao travam equipe/vendedor no escopo).
ROLES_VISAO_GERAL = (*ROLES_ADMIN, "GERENTE_COMERCIAL", "GERENTE_VENDAS")

#: Descricao do escopo mostrada na faixa "Escopo Ativo" dos perfis de apoio.
ROLE_APOIO_LABEL_HINT = {
    "COMPRADOR": "Compras (Fornecedores, negociacoes, custos e investimentos de toda a empresa)",
    "ANALISTA": "Analise (Dados comerciais autorizados de toda a empresa)",
    "SAR": "SAR (Produtividade, roteiro e positivacao de todas as equipes)",
}

#: Papeis que enxergam toda a empresa mas sao de apoio (compras/analise/SAR).
ROLES_APOIO_GLOBAL = ("COMPRADOR", "ANALISTA", "SAR")


def modo_escrita(role: str | None) -> str:
    """Como este papel altera dados. Papel desconhecido nao altera nada."""
    return MODO_ESCRITA.get(str(role or "").upper(), MODO_LEITURA)


def is_admin(role: str | None) -> bool:
    """True para SUPERADMIN e ADMIN - a alcada administrativa plena."""
    return str(role or "").upper() in ROLES_ADMIN


#: Caminhos que o perfil FORNECEDOR pode alcançar.
#:
#: Ele é um perfil EXTERNO: representa o fabricante, não a CHOK. Boa parte das
#: rotas internas (dashboard consolidado, quadros, catálogo, opções de filtro,
#: SAR) usa só `get_current_user`, sem permissão específica, porque até agora
#: todo perfil autenticado era interno. Conferir permissão rota a rota deixaria
#: uma pendente no primeiro endpoint novo que alguém escrevesse — e a falha
#: seria silenciosa, entregando dado a quem não deve.
#:
#: Por isso a regra é invertida aqui: para o fornecedor, tudo é negado, menos o
#: que esta lista libera. Esquecer de incluir algo custa um 403 visível; o
#: contrário custaria um vazamento.
FORNECEDOR_PERMITIDO = (
    "/api/auth/",
    "/api/twofa/",
    "/api/insights/visual/",
    # O próprio estado de escrita: devolve só o modo DELE, que é sempre
    # "leitura". É o que faz o selo do topo dizer "somente visualização" em
    # vez de não aparecer.
    "/api/acessos/meu-estado",
)


def _fornecedor_pode_acessar(caminho: str) -> bool:
    return any(caminho.startswith(prefixo) for prefixo in FORNECEDOR_PERMITIDO)


def has_permission(user: dict[str, Any], permission: str) -> bool:
    """Checagem de permissão no SERVIDOR (não confia no que a tela manda)."""
    role = str(user.get("role") or "")
    if is_admin(role):
        return True
    granted = permissions_for(role, list(user.get("extra_permissions") or []))
    return "admin.full_access" in granted or permission in granted


def require_permission(permission: str):
    """Dependency FastAPI: 403 quando o perfil não tem a permissão pedida.

    Usada nas rotas novas (comparativos, compras, calendário) para que trocar a
    URL na mão não dê acesso a nada fora da responsabilidade do usuário.
    """

    def _dep(user: dict[str, Any] = Depends(get_current_user)) -> dict[str, Any]:
        if not has_permission(user, permission):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Sem permissão para esta operação.",
            )
        return user

    return _dep


# ─────────────────────────────────────────────────────────────────────────────
# Portão de escrita (RF da matriz de perfis)
# ─────────────────────────────────────────────────────────────────────────────
#
# Toda rota que ALTERA dado comercial passa por `require_write`. Ela não
# substitui a permissão: confere a permissão E depois o modo de escrita do
# papel. Os dois precisam passar.
#
# O que NÃO passa por aqui, de propósito: login, 2FA, logout e as ações que o
# usuário faz na própria conta (avatar, senha). Isso é autoatendimento, não
# alteração de critério ou parâmetro do negócio — travar um perfil de leitura
# fora da própria conta não significa impedi-lo de entrar no sistema.

_liberacoes_prontas = False


def _garantir_tabela_liberacoes(conn: Any) -> None:
    """Cria a tabela na primeira consulta, para a rota funcionar antes da migration."""
    global _liberacoes_prontas
    if _liberacoes_prontas:
        return
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS liberacoes_escrita (
          id             BIGSERIAL PRIMARY KEY,
          usuario_id     TEXT NOT NULL,
          usuario_email  TEXT,
          concedido_por  TEXT,
          concedido_em   TIMESTAMPTZ NOT NULL DEFAULT now(),
          expira_em      TIMESTAMPTZ NOT NULL,
          motivo         TEXT,
          revogado_em    TIMESTAMPTZ,
          revogado_por   TEXT
        )
        """
    )
    conn.commit()
    _liberacoes_prontas = True


def liberacao_ativa(user_id: str) -> dict[str, Any] | None:
    """Liberação em vigor deste usuário, se houver. Expirada ou revogada não conta."""
    try:
        with get_connection() as conn:
            _garantir_tabela_liberacoes(conn)
            return conn.execute(
                """
                SELECT id, concedido_por, concedido_em, expira_em, motivo
                FROM liberacoes_escrita
                WHERE usuario_id = %s AND revogado_em IS NULL AND expira_em > now()
                ORDER BY expira_em DESC
                LIMIT 1
                """,
                (str(user_id),),
            ).fetchone()
    except Exception:  # noqa: BLE001 — sem liberação legível, não libera
        return None


def confirmacao_presente(request: Request) -> bool:
    """O navegador confirmou esta alteração?

    A tela só manda este cabeçalho depois que a pessoa confirma no diálogo.
    Ele é uma confirmação de INTENÇÃO, não uma credencial: quem o envia já
    está autenticado e já tem a permissão. O que ele evita é a alteração
    disparada sem querer.
    """
    valor = request.headers.get(CABECALHO_CONFIRMACAO) or ""
    return valor.strip().lower() in ("1", "true", "sim", "confirmado")


def require_write(permission: str):
    """Dependency das rotas que alteram dados.

    Devolve 403 para papel de leitura, 428 para quem precisa confirmar e ainda
    não confirmou, e 403 com código próprio para quem depende de liberação e
    não tem nenhuma ativa. Os códigos vão em `detail` como objeto, para a tela
    saber qual caminho oferecer (abrir o diálogo de confirmação ou explicar
    que falta liberação) em vez de mostrar um erro genérico.
    """

    def _dep(
        request: Request,
        user: dict[str, Any] = Depends(get_current_user),
    ) -> dict[str, Any]:
        modo = modo_escrita(user.get("role"))

        # O modo vem antes da permissão de propósito. Um perfil de leitura
        # também não tem a permissão de escrita (as duas travas existem), mas
        # dizer "você não tem permissão" a um Gerente Comercial, que enxerga
        # tudo, confunde. "Seu perfil é de visualização" explica o desenho.
        if modo == MODO_LEITURA:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "codigo": "somente_leitura",
                    "mensagem": (
                        "Seu perfil tem acesso de visualização. Alterações precisam ser feitas por um "
                        "perfil com permissão de escrita."
                    ),
                },
            )

        if not has_permission(user, permission):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "codigo": "sem_permissao",
                    "mensagem": "Seu perfil não tem permissão para esta operação.",
                },
            )

        if modo == MODO_LIVRE:
            return user

        if modo == MODO_CONFIRMACAO:
            if confirmacao_presente(request):
                return user
            raise HTTPException(
                status_code=status.HTTP_428_PRECONDITION_REQUIRED,
                detail={
                    "codigo": "confirmacao_necessaria",
                    "mensagem": "Esta alteração precisa ser confirmada antes de ser aplicada.",
                },
            )

        if modo == MODO_LIBERACAO:
            ativa = liberacao_ativa(str(user.get("id")))
            if ativa:
                return user
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "codigo": "liberacao_necessaria",
                    "mensagem": (
                        "Seu perfil altera dados apenas com liberação do administrador. "
                        "Peça a liberação e tente novamente."
                    ),
                },
            )

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"codigo": "somente_leitura", "mensagem": "Alteração não permitida para este perfil."},
        )

    return _dep


def estado_escrita(user: dict[str, Any]) -> dict[str, Any]:
    """Resumo que a tela usa para saber o que oferecer ao usuário."""
    modo = modo_escrita(user.get("role"))
    ativa = liberacao_ativa(str(user.get("id"))) if modo == MODO_LIBERACAO else None
    return {
        "modo": modo,
        "podeAlterar": modo in (MODO_LIVRE, MODO_CONFIRMACAO) or bool(ativa),
        "exigeConfirmacao": modo == MODO_CONFIRMACAO,
        "liberacaoExpiraEm": ativa["expira_em"].isoformat() if ativa else None,
        "liberacaoConcedidaPor": ativa["concedido_por"] if ativa else None,
    }


def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode("utf-8"), bcrypt.gensalt(rounds=12)).decode("utf-8")


# Hash descartável: comparado quando o usuário não existe, para que o tempo de
# resposta não revele se o e-mail/código está cadastrado (enumeração por timing).
_DUMMY_HASH = bcrypt.hashpw(b"dummy-password-for-timing", bcrypt.gensalt(rounds=12)).decode("utf-8")


def verify_password(plain: str, hashed: str | None) -> bool:
    try:
        # bcrypt só considera 72 bytes; o schema já limita, aqui é só defesa.
        matches = bcrypt.checkpw(plain.encode("utf-8")[:72], (hashed or _DUMMY_HASH).encode("utf-8"))
        return matches and bool(hashed)
    except ValueError:
        return False


def token_ttl_minutes(remember_me: bool = True) -> int:
    """Com "manter conectado" a sessão dura 7x mais; sem ele, é curta."""
    settings = get_settings()
    base = settings.jwt_expire_minutes
    return base * 7 if remember_me else base


def set_auth_cookie(response: Any, token: str, expires_in: int, remember_me: bool) -> None:
    """Grava o cookie HttpOnly de sessão.

    - remember_me=True  -> cookie persistente (max_age): sobrevive ao fechar o navegador.
    - remember_me=False -> cookie de SESSÃO (sem max_age): some ao fechar o navegador,
      além de o JWT expirar bem antes.
    """
    settings = get_settings()
    samesite = (settings.jwt_cookie_same_site or "Lax").lower()
    if samesite not in ("lax", "strict", "none"):
        samesite = "lax"
    response.set_cookie(
        settings.jwt_cookie_name or "chok_auth_token",
        token,
        max_age=expires_in if remember_me else None,
        path=settings.jwt_cookie_path or "/",
        domain=settings.jwt_cookie_domain,
        secure=bool(settings.jwt_cookie_secure),
        httponly=True,  # nunca legível por JS: XSS não rouba a sessão
        samesite=samesite,
    )


def create_access_token(
    user_id: str,
    email: str,
    role: str,
    *,
    remember_me: bool = True,
    extra: dict[str, Any] | None = None,
) -> tuple[str, int]:
    """Retorna (jwt, expires_in_seconds)."""
    settings = get_settings()
    minutes = token_ttl_minutes(remember_me)
    now = datetime.now(UTC)
    payload: dict[str, Any] = {
        "sub": str(user_id),
        "email": email,
        "role": role,
        "typ": "access",
        "jti": secrets.token_urlsafe(16),  # id único: permite revogar no logout
        "rm": bool(remember_me),  # "manter conectado" — só informativo para o contador de sessão
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=minutes)).timestamp()),
    }
    if extra:
        payload.update(extra)
    token = jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)
    if isinstance(token, bytes):
        token = token.decode("utf-8")
    return token, minutes * 60


_revocation_table_ready = False


def _ensure_revocation_table(conn: Any) -> None:
    global _revocation_table_ready
    if _revocation_table_ready:
        return
    conn.execute("CREATE TABLE IF NOT EXISTS tokens_revogados (jti TEXT PRIMARY KEY, expira_em TIMESTAMPTZ NOT NULL)")
    conn.commit()
    _revocation_table_ready = True


def revoke_token(token: str | None) -> None:
    """Invalida o JWT no servidor (logout). Aceita token já expirado; ignora inválido."""
    if not token:
        return
    settings = get_settings()
    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret,
            algorithms=[settings.jwt_algorithm],
            options={"verify_exp": False},
        )
    except jwt.InvalidTokenError:
        return
    jti = payload.get("jti")
    exp = payload.get("exp")
    if payload.get("typ") != "access" or not jti or not exp:
        return
    with get_connection() as conn:
        _ensure_revocation_table(conn)
        conn.execute("DELETE FROM tokens_revogados WHERE expira_em < now()")
        conn.execute(
            "INSERT INTO tokens_revogados (jti, expira_em) VALUES (%s, %s) ON CONFLICT (jti) DO NOTHING",
            (str(jti), datetime.fromtimestamp(int(exp), UTC)),
        )
        conn.commit()


def decode_token(token: str) -> dict[str, Any]:
    settings = get_settings()
    try:
        return jwt.decode(
            token,
            settings.jwt_secret,
            algorithms=[settings.jwt_algorithm],
            options={"require": ["exp", "iat", "sub"]},
        )
    except jwt.ExpiredSignatureError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expirado.") from exc
    except jwt.InvalidTokenError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido.") from exc


def permissions_for(role: str, extra: list[str] | None = None) -> list[str]:
    base = list(ROLE_PERMISSIONS.get(role, []))
    if extra:
        for item in extra:
            if item not in base:
                base.append(item)
    if is_admin(role) and "admin.full_access" not in base:
        base.insert(0, "admin.full_access")
    return base


def _api_key_valid(provided: str | None) -> bool:
    expected = get_settings().import_api_key
    return bool(expected and provided and hmac.compare_digest(provided.encode(), expected.encode()))


def require_import_api_key(x_api_key: str | None = Header(default=None, alias="x-api-key")) -> None:
    """Somente para AUTOMAÇÕES (scripts). Comparação em tempo constante.

    Sem IMPORT_API_KEY configurada a chave fica DESABILITADA (antes, vazio
    significava "sem autenticação") e só sessão de ADMIN é aceita.
    """
    if not _api_key_valid(x_api_key):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Chave de importação ausente ou inválida.",
        )


def extract_token(request: Request, credentials: HTTPAuthorizationCredentials | None) -> str | None:
    """JWT do header Authorization (Bearer) ou, na falta dele, do cookie HttpOnly."""
    if credentials is not None and credentials.scheme.lower() == "bearer":
        return credentials.credentials
    cookie_name = get_settings().jwt_cookie_name or "chok_auth_token"
    return request.cookies.get(cookie_name)


def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> dict[str, Any]:
    token = extract_token(request, credentials)

    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Não autenticado.")
    payload = decode_token(token)
    # O tempToken do 2FA (typ="2fa_pending") é assinado com o mesmo segredo e é
    # emitido só com a senha: aceitá-lo aqui anularia o 2FA por completo.
    if payload.get("typ") != "access":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido.")
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido.")

    jti = payload.get("jti")
    if not jti:
        # tokens anteriores à revogação não têm jti: exigem novo login
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Sessão expirada. Faça login novamente.")

    with get_connection() as conn:
        _ensure_revocation_table(conn)
        revoked = conn.execute("SELECT 1 FROM tokens_revogados WHERE jti = %s", (str(jti),)).fetchone()
        # Inatividade (40 min) é imposta AQUI, no servidor: fechar a aba, mexer no
        # relógio do navegador ou chamar a API direto não contorna a regra.
        encerrada = None if revoked else sessions.verificar_e_marcar_atividade(conn, str(jti))
        row = (
            None
            if revoked or encerrada
            else conn.execute(USER_SELECT + " WHERE id::text = %s", (str(user_id),)).fetchone()
        )

    if revoked:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Sessão encerrada. Faça login novamente.")
    if encerrada:
        # Revoga o JWT para que ele não volte a valer nem com o cookie em mãos.
        revoke_token(token)
        detalhe = (
            "Sessão encerrada por inatividade. Faça login novamente."
            if encerrada == sessions.MOTIVO_INATIVIDADE
            else "Sessão encerrada. Faça login novamente."
        )
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=detalhe)
    if not row:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Usuário não encontrado.")
    if row["status"] != "Ativo":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Usuário inativo.")
    # Perfil externo: só alcança as rotas do próprio escopo (ver
    # FORNECEDOR_PERMITIDO). Vale para qualquer rota, inclusive as que não
    # declaram permissão própria.
    if row["role"] == "FORNECEDOR" and not _fornecedor_pode_acessar(request.url.path):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Este perfil acessa somente a visão do fabricante que representa.",
        )
    # Disponível para rotas que precisam dos tempos da sessão (iat/exp), ex.: /auth/session.
    request.state.token_payload = payload
    return dict(row)


def require_import_access(
    request: Request,
    x_api_key: str | None = Header(default=None, alias="x-api-key"),
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> dict[str, Any] | None:
    """Importações: sessão de ADMIN (tela do site) OU chave de automação válida.

    A chave NUNCA deve ir para o bundle do frontend (VITE_*): qualquer pessoa
    a leria no navegador. A tela do site autentica pelo cookie de admin.
    """
    if _api_key_valid(x_api_key):
        return None
    user = get_current_user(request, credentials)
    if not is_admin(user["role"]):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Somente administradores podem importar dados.",
        )
    return user


def require_roles(*roles: str):
    def _dep(user: dict[str, Any] = Depends(get_current_user)) -> dict[str, Any]:
        if is_admin(user["role"]):
            return user
        if user["role"] not in roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Sem permissão para esta operação.")
        return user

    return _dep
