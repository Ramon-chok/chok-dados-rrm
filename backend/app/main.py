from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request
from fastapi.staticfiles import StaticFiles
from pathlib import Path
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse

from app import __version__
from app.config import get_settings
from app.db import close_pool
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


@app.exception_handler(HTTPException)
async def http_exception_handler(_request: Request, exc: HTTPException) -> JSONResponse:
    detail = exc.detail
    message = detail if isinstance(detail, str) else str(detail)
    return _error_payload(message, status_code=exc.status_code)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(_request: Request, exc: RequestValidationError) -> JSONResponse:
    # Não devolve `input`/`ctx` (poderia refletir dado sensível ou malicioso do cliente).
    safe = [{"loc": [str(p) for p in e.get("loc", ())], "msg": str(e.get("msg", ""))} for e in exc.errors()]
    return _error_payload("Corpo da requisição inválido.", extra={"detail": safe}, status_code=400)


@app.exception_handler(Exception)
async def unhandled_exception_handler(_request: Request, exc: Exception) -> JSONResponse:
    print("[app] Erro não tratado:", exc)
    return _error_payload("Erro interno inesperado.")


@app.get("/api/health")
def health() -> dict[str, bool]:
    return {"ok": True}


app.include_router(auth.router, prefix="/api")
app.include_router(users.router, prefix="/api")
app.include_router(imports.router, prefix="/api")
app.include_router(analytics.router, prefix="/api")
app.include_router(catalog.router, prefix="/api")
app.include_router(twofa.router, prefix="/api")