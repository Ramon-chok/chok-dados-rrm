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
    team: str | None = None
    supervisor: str | None = None
    manager: str | None = None


class UserOut(BaseModel):
    id: str
    name: str
    email: str
    role: Role
    roleLabel: str
    avatarInitials: str
    phone: str | None = None
    address: str | None = None
    neighborhood: str | None = None
    city: str | None = None
    state: str | None = None
    cep: str | None = None
    sellerCode: str | None = None
    team: str | None = None
    supervisor: str | None = None
    manager: str | None = None
    status: Literal["Ativo", "Inativo"]
    lastLoginAt: str | None = None
    scope: DataScope
    permissions: list[str]


class LoginResponse(BaseModel):
    token: str
    tokenType: str = "Bearer"
    expiresIn: int
    user: UserOut


class UserCreate(BaseModel):
    name: str
    email: str
    password: str = Field(min_length=6)
    role: Role
    phone: str | None = None
    address: str | None = None
    neighborhood: str | None = None
    city: str | None = None
    state: str | None = None
    cep: str | None = None
    sellerCode: str | None = None
    team: str | None = None
    supervisor: str | None = None
    manager: str | None = None
    status: Literal["Ativo", "Inativo"] = "Ativo"


class UserUpdate(BaseModel):
    name: str | None = None
    email: str | None = None
    password: str | None = Field(default=None, min_length=6)
    role: Role | None = None
    phone: str | None = None
    address: str | None = None
    neighborhood: str | None = None
    city: str | None = None
    state: str | None = None
    cep: str | None = None
    sellerCode: str | None = None
    team: str | None = None
    supervisor: str | None = None
    manager: str | None = None
    status: Literal["Ativo", "Inativo"] | None = None


class ImportRequest(BaseModel):
    tipo: str
    dataReferencia: str
    arquivo: str | None = None
    usuarioNome: str | None = None
    usuarioEmail: str | None = None
    mapping: dict[str, str]
    rows: list[dict[str, Any]]
    # Fatiamento de planilhas pesadas: o frontend envia vários POSTs
    # sequenciais com o mesmo importId a partir do 2º lote.
    chunkIndex: int | None = Field(default=None, ge=0)
    totalChunks: int | None = Field(default=None, ge=1)
    importId: int | None = None
    # Deslocamento 0-based no arquivo original — corrige o número da linha
    # nos erros de validação quando o lote não é o primeiro.
    rowOffset: int | None = Field(default=None, ge=0)
    useMacro: bool | None = Field(default=None)


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
    chunkIndex: int | None = None
    totalChunks: int | None = None
    done: bool = True


class PeriodQuery(BaseModel):
    start: str | None = None
    end: str | None = None
    ano: int | None = None
    mes: int | None = None
