"""Camadas de proteção HTTP: limite de corpo, rate limit, cabeçalhos de
segurança, checagem de Origin (CSRF) e validação genérica de query string.

Tudo em memória do processo. Com vários workers/instâncias o limite passa a
ser POR PROCESSO — para DDoS volumétrico, a defesa real precisa estar na
borda (Cloudflare/WAF/Nginx). Aqui ficam as defesas de aplicação.
"""

from __future__ import annotations

import json
import re
import threading
import time
from collections import defaultdict, deque
from urllib.parse import parse_qsl, urlsplit

from starlette.types import ASGIApp, Message, Receive, Scope, Send

from app.config import get_settings
from app.sanitize import has_control_chars

# --------------------------------------------------------------------------
# Utilidades
# --------------------------------------------------------------------------

UNSAFE_METHODS = {"POST", "PUT", "PATCH", "DELETE"}
_DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}(?:[T ][\d:.+\-Zz]+)?$")
_DATE_PARAMS = {"start", "end", "dia", "data", "dataReferencia"}
MAX_QUERY_STRING = 2048
MAX_QUERY_VALUE = 200
MAX_QUERY_PARAMS = 30


def _headers(scope: Scope) -> dict[str, str]:
    return {k.decode("latin-1").lower(): v.decode("latin-1") for k, v in scope.get("headers", [])}


def client_ip(scope: Scope) -> str:
    """IP do cliente. Só confia em X-Forwarded-For se TRUST_PROXY=true
    (senão qualquer um forjaria o cabeçalho para burlar o rate limit)."""
    settings = get_settings()
    if settings.trust_proxy:
        xff = _headers(scope).get("x-forwarded-for", "")
        if xff:
            # último salto = o adicionado pelo NOSSO proxy confiável
            parts = [p.strip() for p in xff.split(",") if p.strip()]
            if parts:
                return parts[-1]
    client = scope.get("client")
    return client[0] if client else "unknown"


async def _send_json(send: Send, status: int, message: str, extra_headers: list[tuple[bytes, bytes]] | None = None) -> None:
    body = json.dumps({"error": message}).encode("utf-8")
    headers = [
        (b"content-type", b"application/json"),
        (b"content-length", str(len(body)).encode()),
        (b"x-content-type-options", b"nosniff"),
        (b"cache-control", b"no-store"),
    ]
    if extra_headers:
        headers.extend(extra_headers)
    await send({"type": "http.response.start", "status": status, "headers": headers})
    await send({"type": "http.response.body", "body": body})


# --------------------------------------------------------------------------
# Limite de tamanho do corpo (DoS por payload gigante, inclusive chunked)
# --------------------------------------------------------------------------


class _BodyTooLarge(Exception):
    pass


class BodySizeLimitMiddleware:
    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    def _limit_for(self, path: str) -> int:
        s = get_settings()
        if path.startswith("/api/imports"):
            return s.max_import_body_bytes
        if path.startswith("/api/users/") and path.endswith("/avatar"):
            return s.max_avatar_bytes + 64 * 1024  # + overhead do multipart
        return s.max_body_bytes

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http" or scope["method"] not in UNSAFE_METHODS:
            await self.app(scope, receive, send)
            return

        limit = self._limit_for(scope["path"])
        declared = _headers(scope).get("content-length")
        if declared is not None:
            try:
                if int(declared) > limit:
                    await _send_json(send, 413, "Corpo da requisição excede o tamanho máximo permitido.")
                    return
            except ValueError:
                await _send_json(send, 400, "Content-Length inválido.")
                return

        received = 0
        response_started = False

        async def limited_receive() -> Message:
            nonlocal received
            message = await receive()
            if message["type"] == "http.request":
                received += len(message.get("body", b""))
                if received > limit:
                    raise _BodyTooLarge()
            return message

        async def tracking_send(message: Message) -> None:
            nonlocal response_started
            if message["type"] == "http.response.start":
                response_started = True
            await send(message)

        try:
            await self.app(scope, limited_receive, tracking_send)
        except _BodyTooLarge:
            if not response_started:
                await _send_json(send, 413, "Corpo da requisição excede o tamanho máximo permitido.")


# --------------------------------------------------------------------------
# Rate limit (janela deslizante por IP) + bloqueio de força bruta por conta
# --------------------------------------------------------------------------


class SlidingWindowLimiter:
    def __init__(self) -> None:
        self._hits: dict[str, deque[float]] = defaultdict(deque)
        self._lock = threading.Lock()
        self._last_gc = time.monotonic()

    def hit(self, key: str, limit: int, window: float) -> tuple[bool, int]:
        """Registra uma ocorrência. Retorna (permitido, retry_after_segundos)."""
        now = time.monotonic()
        with self._lock:
            if now - self._last_gc > 60:
                self._gc(now)
            q = self._hits[key]
            cutoff = now - window
            while q and q[0] <= cutoff:
                q.popleft()
            if len(q) >= limit:
                return False, max(1, int(q[0] + window - now) + 1)
            q.append(now)
            return True, 0

    def _gc(self, now: float) -> None:
        # Evita crescimento ilimitado de memória (DoS por muitos IPs/chaves).
        for key in [k for k, q in self._hits.items() if not q or q[-1] < now - 900]:
            self._hits.pop(key, None)
        if len(self._hits) > 50_000:
            for key in list(self._hits)[: len(self._hits) - 50_000]:
                self._hits.pop(key, None)
        self._last_gc = now


limiter = SlidingWindowLimiter()


class LoginThrottle:
    """Bloqueio temporário após N falhas por identificador (conta) — barra
    força bruta distribuída que o limite por IP não pega."""

    def __init__(self) -> None:
        self._fails: dict[str, list[float]] = {}
        self._lock = threading.Lock()

    def _prune(self, key: str, now: float, window: float) -> list[float]:
        fails = [t for t in self._fails.get(key, []) if now - t < window]
        if fails:
            self._fails[key] = fails
        else:
            self._fails.pop(key, None)
        return fails

    def locked_for(self, key: str) -> int:
        s = get_settings()
        now = time.monotonic()
        with self._lock:
            fails = self._prune(key, now, s.login_lock_seconds)
            if len(fails) >= s.login_max_failures:
                return max(1, int(fails[0] + s.login_lock_seconds - now) + 1)
        return 0

    def register_failure(self, key: str) -> None:
        s = get_settings()
        now = time.monotonic()
        with self._lock:
            fails = self._prune(key, now, s.login_lock_seconds)
            fails.append(now)
            self._fails[key] = fails
            if len(self._fails) > 50_000:
                for k in list(self._fails)[:10_000]:
                    self._fails.pop(k, None)

    def reset(self, key: str) -> None:
        with self._lock:
            self._fails.pop(key, None)


login_throttle = LoginThrottle()

_STRICT_PATHS = {
    "/api/auth/login",
    "/api/auth/2fa-login",
    "/api/2fa/verify",
    "/api/2fa/init",
    "/api/2fa/resend",
    "/api/2fa/disable",
    "/api/auth/email-test",
}


class RateLimitMiddleware:
    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        s = get_settings()
        path = scope["path"]
        ip = client_ip(scope)

        checks: list[tuple[str, int, float]] = [(f"g:{ip}", s.rate_limit_per_minute, 60.0)]
        if path in _STRICT_PATHS and scope["method"] == "POST":
            checks.append((f"a:{ip}:{path}", s.rate_limit_auth_per_minute, 60.0))
        elif path.startswith("/api/imports") and scope["method"] == "POST":
            checks.append((f"i:{ip}", s.rate_limit_import_per_minute, 60.0))

        for key, limit, window in checks:
            allowed, retry = limiter.hit(key, limit, window)
            if not allowed:
                await _send_json(
                    send, 429, "Muitas requisições. Aguarde um instante e tente novamente.",
                    [(b"retry-after", str(retry).encode())],
                )
                return
        await self.app(scope, receive, send)


# --------------------------------------------------------------------------
# Cabeçalhos de segurança
# --------------------------------------------------------------------------


class SecurityHeadersMiddleware:
    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        is_api = scope["path"].startswith("/api")
        secure = get_settings().jwt_cookie_secure

        async def send_with_headers(message: Message) -> None:
            if message["type"] == "http.response.start":
                headers = list(message.get("headers", []))
                present = {k.lower() for k, _ in headers}

                def add(name: bytes, value: bytes) -> None:
                    if name not in present:
                        headers.append((name, value))

                add(b"x-content-type-options", b"nosniff")
                add(b"x-frame-options", b"DENY")
                add(b"referrer-policy", b"strict-origin-when-cross-origin")
                add(b"permissions-policy", b"camera=(), microphone=(), geolocation=(), payment=()")
                add(b"cross-origin-resource-policy", b"same-site")
                # Respostas sem CSP: API JSON nunca deve executar nada; avatares
                # (arquivos enviados por usuários) ficam sandboxed.
                add(b"content-security-policy", b"default-src 'none'; frame-ancestors 'none'; sandbox")
                if secure:
                    add(b"strict-transport-security", b"max-age=31536000; includeSubDomains")
                if is_api:
                    add(b"cache-control", b"no-store")
                    add(b"pragma", b"no-cache")
                message["headers"] = headers
            await send(message)

        await self.app(scope, receive, send_with_headers)


# --------------------------------------------------------------------------
# CSRF (defesa em profundidade além do SameSite) + validação de query string
# --------------------------------------------------------------------------


class RequestGuardMiddleware:
    """1. Requisições que alteram estado, autenticadas por COOKIE, só passam se
    `Origin`/`Referer` for uma origem permitida (CORS_ORIGINS).
    2. Query string: tamanho, nº de parâmetros, caracteres de controle e formato
    de datas — validação uniforme para TODAS as rotas GET.
    """

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    @staticmethod
    def _allowed_origins() -> set[str]:
        return {o.strip().rstrip("/").lower() for o in get_settings().cors_origins.split(",") if o.strip()}

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        raw_qs: bytes = scope.get("query_string", b"")
        if raw_qs:
            if len(raw_qs) > MAX_QUERY_STRING:
                await _send_json(send, 414, "Query string muito longa.")
                return
            try:
                pairs = parse_qsl(raw_qs.decode("utf-8"), keep_blank_values=True, max_num_fields=MAX_QUERY_PARAMS)
            except (UnicodeDecodeError, ValueError):
                await _send_json(send, 400, "Parâmetros de consulta inválidos.")
                return
            for key, value in pairs:
                if len(value) > MAX_QUERY_VALUE or has_control_chars(value) or has_control_chars(key):
                    await _send_json(send, 400, f'Parâmetro "{key[:40]}" inválido.')
                    return
                if key in _DATE_PARAMS and value and not _DATE_RE.match(value):
                    await _send_json(send, 400, f'Parâmetro "{key}" deve estar no formato AAAA-MM-DD.')
                    return

        if scope["method"] in UNSAFE_METHODS:
            headers = _headers(scope)
            has_cookie_auth = get_settings().jwt_cookie_name in headers.get("cookie", "")
            has_bearer = headers.get("authorization", "").lower().startswith("bearer ")
            if has_cookie_auth and not has_bearer:
                origin = headers.get("origin") or headers.get("referer")
                allowed = self._allowed_origins()
                if origin:
                    parts = urlsplit(origin)
                    origin_norm = f"{parts.scheme}://{parts.netloc}".lower()
                    if origin_norm not in allowed and "*" not in allowed:
                        # Mesmo host (front servido pelo mesmo domínio, ex.: proxy do Vite)?
                        if parts.netloc.lower() != headers.get("host", "").lower():
                            await _send_json(send, 403, "Origem não permitida.")
                            return
                elif headers.get("sec-fetch-site", "same-origin") == "cross-site":
                    await _send_json(send, 403, "Origem não permitida.")
                    return

        await self.app(scope, receive, send)
