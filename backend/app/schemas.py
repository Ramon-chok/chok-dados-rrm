from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field

Role = Literal["ADMIN", "GERENTE", "SUPERVISOR", "VENDEDOR"]
ImportStatus = Literal["CONCLUIDO", "CONCLUIDO_COM_AVISOS", "FALHA"]


class LoginRequest(BaseModel):
    email: str
    password: str
    rememberMe: bool = True


class DataScope(BaseModel):
    level: Literal["VENDEDOR", "SUPERVISOR", "GERENTE", "EMPRESA"]
    description: str
    sellerCode: str | None = None
    equipe: str | None = None
    supervisor: str | None = None
    manager: str | None = None


class UserOut(BaseModel):
    id: int
    name: str
    email: str
    role: Role
    roleLabel: str
    avatarInitials: str
    telefone: str | None = None
    endereco: str | None = None
    bairro: str | None = None
    municipio: str | None = None
    estado: str | None = None
    cep: str | None = None
    codigo: str | None = None
    equipe: str | None = None
    supervisor: str | None = None
    status: Literal["Ativo", "Inativo"]
    lastLoginAt: str | None = None
    scope: DataScope
    permissions: list[str]


class LoginResponse(BaseModel):
    token: str
    user: UserOut


class UserCreate(BaseModel):
    name: str
    email: str
    password: str = Field(min_length=6)
    role: Role
    telefone: str | None = None
    endereco: str | None = None
    bairro: str | None = None
    municipio: str | None = None
    estado: str | None = None
    cep: str | None = None
    codigo: str | None = None
    equipe: str | None = None
    supervisor: str | None = None
    status: Literal["Ativo", "Inativo"] = "Ativo"


class UserUpdate(BaseModel):
    name: str | None = None
    email: str | None = None
    password: str | None = Field(default=None, min_length=6)
    role: Role | None = None
    telefone: str | None = None
    endereco: str | None = None
    bairro: str | None = None
    municipio: str | None = None
    estado: str | None = None
    cep: str | None = None
    codigo: str | None = None
    equipe: str | None = None
    supervisor: str | None = None
    status: Literal["Ativo", "Inativo"] | None = None


class ImportRequest(BaseModel):
    tipo: str
    dataReferencia: str
    arquivo: str | None = None
    usuarioNome: str | None = None
    usuarioEmail: str | None = None
    mapping: dict[str, str]
    rows: list[dict[str, Any]]


class ImportRowError(BaseModel):
    linha: int
    motivo: str


class ImportResultSummary(BaseModel):
    importId: int
    tipo: str
    tipoLabel: str
    arquivo: str | None
    dataReferencia: str
    totalAnalisados: int
    novos: int
    atualizados: int
    rejeitados: int
    status: ImportStatus
    erros: list[ImportRowError]


class PeriodQuery(BaseModel):
    start: str | None = None
    end: str | None = None
    ano: int | None = None
    mes: int | None = None
    equipe: str | None = None
    vendedor: str | None = None
    fabricante: str | None = None
    gerencia: str | None = None
