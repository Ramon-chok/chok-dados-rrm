from __future__ import annotations

from typing import Any, Literal

import re

from pydantic import BaseModel, Field, field_validator

from app.sanitize import clean_email, clean_optional, clean_text

Role = Literal["ADMIN", "GERENTE", "SUPERVISOR", "VENDEDOR"]
ImportStatus = Literal["CONCLUIDO", "CONCLUIDO_COM_AVISOS", "FALHA"]

_EMAIL_RE = re.compile(r"^[^\s@<>\"'`;,()\\]+@[^\s@<>\"'`;,()\\]+\.[^\s@<>\"'`;,()\\]{2,}$")
_CEP_RE = re.compile(r"^[0-9.\-]{5,12}$")
_PHONE_RE = re.compile(r"^[0-9+()\-\s.]{6,25}$")
MAX_PASSWORD_BYTES = 72  # limite real do bcrypt


def _check_password(value: str | None) -> str | None:
    if value is None:
        return value
    if len(value.encode("utf-8")) > MAX_PASSWORD_BYTES:
        raise ValueError("Senha muito longa (máximo 72 bytes).")
    if "\x00" in value:
        raise ValueError("Senha inválida.")
    return value


class LoginRequest(BaseModel):
    # identificador: e-mail OU código do usuário
    email: str = Field(min_length=1, max_length=100)
    password: str = Field(min_length=1, max_length=128)
    rememberMe: bool = True

    @field_validator("email", mode="before")
    @classmethod
    def _sanitize_identifier(cls, v: object) -> str:
        return clean_text(v, 100)

    @field_validator("password")
    @classmethod
    def _password_ok(cls, v: str) -> str:
        return _check_password(v) or ""


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


_OPTIONAL_TEXT_FIELDS = (
    "address", "neighborhood", "city", "state", "sellerCode", "team", "supervisor", "manager",
)


class _UserInputMixin(BaseModel):
    """Sanitiza TODOS os campos de texto de usuário na entrada."""

    @field_validator("name", mode="before", check_fields=False)
    @classmethod
    def _clean_name(cls, v: object) -> object:
        return clean_text(v, 120) if v is not None else v

    @field_validator("email", mode="before", check_fields=False)
    @classmethod
    def _clean_user_email(cls, v: object) -> object:
        if v is None:
            return v
        email = clean_email(v)
        if not _EMAIL_RE.match(email):
            raise ValueError("E-mail inválido.")
        return email

    @field_validator(*_OPTIONAL_TEXT_FIELDS, mode="before", check_fields=False)
    @classmethod
    def _clean_optional_fields(cls, v: object) -> object:
        return clean_optional(v, 150)

    @field_validator("cep", mode="before", check_fields=False)
    @classmethod
    def _clean_cep(cls, v: object) -> object:
        cleaned = clean_optional(v, 12)
        if cleaned and not _CEP_RE.match(cleaned):
            raise ValueError("CEP inválido.")
        return cleaned

    @field_validator("phone", mode="before", check_fields=False)
    @classmethod
    def _clean_phone(cls, v: object) -> object:
        cleaned = clean_optional(v, 25)
        if cleaned and not _PHONE_RE.match(cleaned):
            raise ValueError("Telefone inválido.")
        return cleaned

    @field_validator("password", mode="after", check_fields=False)
    @classmethod
    def _password_ok(cls, v: str | None) -> str | None:
        return _check_password(v)


class UserCreate(_UserInputMixin):
    name: str = Field(min_length=1, max_length=120)
    email: str = Field(max_length=254)
    password: str = Field(min_length=8, max_length=128)
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


class UserUpdate(_UserInputMixin):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    email: str | None = Field(default=None, max_length=254)
    password: str | None = Field(default=None, min_length=8, max_length=128)
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
    tipo: str = Field(max_length=64, pattern=r"^[A-Za-z0-9_\-]+$")
    dataReferencia: str = Field(max_length=32)
    arquivo: str | None = Field(default=None, max_length=255)
    usuarioNome: str | None = Field(default=None, max_length=120)
    usuarioEmail: str | None = Field(default=None, max_length=254)
    mapping: dict[str, str] = Field(max_length=200)
    rows: list[dict[str, Any]] = Field(max_length=2500)
    # Fatiamento de planilhas pesadas: o frontend envia vários POSTs
    # sequenciais com o mesmo importId a partir do 2º lote.
    chunkIndex: int | None = Field(default=None, ge=0)
    totalChunks: int | None = Field(default=None, ge=1)
    importId: int | None = None
    # Deslocamento 0-based no arquivo original — corrige o número da linha
    # nos erros de validação quando o lote não é o primeiro.
    rowOffset: int | None = Field(default=None, ge=0)
    useMacro: bool | None = Field(default=None)

    @field_validator("arquivo", "usuarioNome", "usuarioEmail", mode="before")
    @classmethod
    def _clean_meta(cls, v: object) -> object:
        return clean_optional(v, 255)

    @field_validator("mapping", mode="before")
    @classmethod
    def _clean_mapping(cls, v: object) -> object:
        if isinstance(v, dict):
            return {clean_text(k, 120): clean_text(val, 200) for k, val in v.items()}
        return v


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
