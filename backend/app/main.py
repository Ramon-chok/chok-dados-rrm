from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from http import HTTPStatus

from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from pathlib import Path
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app import __version__
from app.config import get_settings
from app.db import close_pool
from app.errors import GENERIC_ERROR, SERVICE_UNAVAILABLE, PublicServerError, is_database_unavailable, log_exception
from app.hardening import (
    BodySizeLimitMiddleware,
    RateLimitMiddleware,
    RequestGuardMiddleware,
    SecurityHeadersMiddleware,
)
from app.routers import analytics, auth, catalog, imports, users, twofa

settings = get_settings()
origins = [o.strip() for o in settings.cors_origins.split(",") if o.strip()]


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    yield
    close_pool()


app = FastAPI(
    title="CHOK Dados API",
    version=__version__,
    description="Backend Python do RR Mind / CHOK Dados: importação histórica, auth RBAC e leitura analítica.",
    lifespan=lifespan,
    # Não publica o schema/Swagger em produção (mapa gratuito da superfície de ataque).
    docs_url=None if settings.environment.lower() == "production" else "/docs",
    redoc_url=None,
    openapi_url=None if settings.environment.lower() == "production" else "/openapi.json",
)

# Diretório público para avatares de usuários
avatars_dir = Path(__file__).resolve().parent.parent / "avatars"
avatars_dir.mkdir(parents=True, exist_ok=True)
app.mount("/avatars", StaticFiles(directory=str(avatars_dir)), name="avatars")

# Quando `allow_origins` é '*' os navegadores não permitem `Access-Control-Allow-Credentials: true`.
# Recomendamos definir origens específicas em produção (ex: https://app.suaempresa.com).
cors_allow_origins = ["*"] if origins == ["*"] else origins
cors_allow_credentials = False if cors_allow_origins == ["*"] else True
# Ordem de execução (o ÚLTIMO adicionado é o mais externo):
#   SecurityHeaders > CORS > RateLimit > BodySize > RequestGuard > rotas
# RateLimit corre antes de o corpo ser lido, barrando inundação a baixo custo,
# e o CORS envolve tudo para que até as respostas 403/413/429 sejam legíveis.
app.add_middleware(RequestGuardMiddleware)
app.add_middleware(BodySizeLimitMiddleware)
app.add_middleware(RateLimitMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_allow_origins,
    allow_credentials=cors_allow_credentials,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "x-api-key"],
    max_age=600,
)
app.add_middleware(GZipMiddleware, minimum_size=1024)
app.add_middleware(SecurityHeadersMiddleware)


def _error_payload(message: str, extra: dict | None = None, status_code: int = 500) -> JSONResponse:
    body: dict = {"error": message}
    if extra:
        body.update(extra)
    return JSONResponse(status_code=status_code, content=body)


# Mensagens padrão por status quando a exceção não traz um texto seguro para o usuário.
_DEFAULT_STATUS_MESSAGES = {
    400: "Requisição inválida.",
    401: "Não autenticado.",
    403: "Sem permissão para esta operação.",
    404: "Recurso não encontrado.",
    405: "Operação não permitida.",
    409: "Conflito com o estado atual dos dados.",
    413: "Conteúdo maior que o permitido.",
    422: "Dados inválidos.",
    429: "Muitas requisições. Aguarde um instante e tente novamente.",
}


@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException) -> JSONResponse:
    # Registrado na classe base do Starlette para cobrir também 404/405 de rota
    # inexistente (que não passam pelo HTTPException do FastAPI).
    headers = getattr(exc, "headers", None)
    if exc.status_code >= 500:
        # 5xx nunca repassa o `detail` (pode conter texto de exceção interna).
        ref = log_exception(f"HTTP {exc.status_code} em {request.method} {request.url.path}: {exc.detail!r}", exc)
        response = _error_payload(GENERIC_ERROR, extra={"ref": ref}, status_code=exc.status_code)
    else:
        detail = exc.detail
        fallback = _DEFAULT_STATUS_MESSAGES.get(exc.status_code, "Requisição inválida.")
        # Frases padrão do Starlette ("Not Found", "Method Not Allowed"...) viram texto em português.
        is_default_phrase = isinstance(detail, str) and detail == HTTPStatus(exc.status_code).phrase
        message = detail if isinstance(detail, str) and detail and not is_default_phrase else fallback
        response = _error_payload(message, status_code=exc.status_code)
    if headers:
        response.headers.update(headers)
    return response


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(_request: Request, exc: RequestValidationError) -> JSONResponse:
    # Só o nome do campo: não devolve `input`/`ctx`/`msg` do Pydantic (podem refletir
    # dado do cliente ou detalhes de implementação dos validadores).
    fields = sorted({str(e.get("loc", ("",))[-1]) for e in exc.errors() if e.get("loc")})
    return _error_payload("Dados enviados inválidos. Revise os campos e tente novamente.", extra={"fields": fields}, status_code=400)


@app.exception_handler(PublicServerError)
async def public_server_error_handler(_request: Request, exc: PublicServerError) -> JSONResponse:
    # Já registrado no log por quem levantou; a mensagem foi escrita para o usuário.
    return _error_payload(exc.message, extra={"ref": exc.ref} if exc.ref else None, status_code=exc.status_code)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    ref = log_exception(f"Erro não tratado em {request.method} {request.url.path}", exc)
    if is_database_unavailable(exc):
        return _error_payload(SERVICE_UNAVAILABLE, extra={"ref": ref}, status_code=503)
    return _error_payload(GENERIC_ERROR, extra={"ref": ref})


@app.get("/api/health")
def health() -> dict[str, bool]:
    return {"ok": True}


app.include_router(auth.router, prefix="/api")
app.include_router(users.router, prefix="/api")
app.include_router(imports.router, prefix="/api")
app.include_router(analytics.router, prefix="/api")
app.include_router(catalog.router, prefix="/api")
app.include_router(twofa.router, prefix="/api")