from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app import __version__
from app.config import get_settings
from app.db import close_pool
from app.routers import analytics, auth, catalog, imports, users

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
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if origins == ["*"] else origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


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
    return _error_payload("Corpo da requisição inválido.", extra={"detail": exc.errors()}, status_code=400)


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
