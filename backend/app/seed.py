from __future__ import annotations

from app.config import get_settings
from app.db import get_connection
from app.security import hash_password

SEED_USERS = [
    {
        "id": "1",
        "name": "Ramon Sanchez",
        "email": "ramon21.empresa@gmail.com",
        "role": "ADMIN",
        "telefone": "(11) 11111-1111",
        "endereco": "Av. Presidente Vargas, 2000",
        "bairro": "Jardim América",
        "municipio": "Ribeirão Preto",
        "estado": "SP",
        "cep": "14020-260",
        "codigo": 100,
        "equipe": None,
        "supervisor": None
    },
    {
        "id": "2",
        "name": "Carlos Mendes",
        "email": "carlos.mendes@chok.com.br",
        "role": "GERENTE",
        "telefone": "(16) 98112-4433",
        "endereco": "Rua General Osório, 850",
        "bairro": "Centro",
        "municipio": "Ribeirão Preto",
        "estado": "SP",
        "cep": "14010-000",
        "codigo": None,
        "equipe": None,
        "supervisor": None,
    },
    {
        "id": "3",
        "name": "Marcos Valério",
        "email": "marcos.valerio@chok.com.br",
        "role": "SUPERVISOR",
        "telefone": "(16) 99120-7788",
        "endereco": "Rua Barão do Rio Branco, 412",
        "bairro": "Centro",
        "municipio": "Sertãozinho",
        "estado": "SP",
        "cep": "14160-000",
        "codigo": None,
        "equipe": "TRAB ALFA",
        "supervisor": "Supervisor A",
    },
    {
        "id": "4",
        "name": "João Souza",
        "email": "joao.vendedor003@chok.com.br",
        "role": "VENDEDOR",
        "telefone": "(16) 99233-5511",
        "endereco": "Rua Florêncio de Abreu, 1420",
        "bairro": "Centro",
        "municipio": "Ribeirão Preto",
        "estado": "SP",
        "cep": "14015-060",
        "codigo": "003",
        "equipe": "TRAB ALFA",
        "supervisor": "Supervisor A",
    },
]


def seed_users() -> None:
    settings = get_settings()
    password_hash = hash_password(settings.seed_password)
    with get_connection() as conn:
        for user in SEED_USERS:
            conn.execute(
                """
                INSERT INTO usuarios (
                    id, name, email, password_hash, role, telefone, endereco, bairro,
                    municipio, estado, cep, codigo, equipe, supervisor, status
                ) VALUES (
                    %(id)s, %(name)s, %(email)s, %(password_hash)s, %(role)s, %(telefone)s,
                    %(endereco)s, %(bairro)s, %(municipio)s, %(estado)s, %(cep)s,
                    %(codigo)s, %(equipe)s, %(supervisor)s, 'Ativo'
                )
                ON CONFLICT (id) DO UPDATE SET
                    name = EXCLUDED.name,
                    email = EXCLUDED.email,
                    role = EXCLUDED.role,
                    telefone = EXCLUDED.telefone,
                    endereco = EXCLUDED.endereco,
                    bairro = EXCLUDED.bairro,
                    municipio = EXCLUDED.municipio,
                    estado = EXCLUDED.estado,
                    cep = EXCLUDED.cep,
                    codigo = EXCLUDED.codigo,
                    equipe = EXCLUDED.equipe,
                    supervisor = EXCLUDED.supervisor,
                    updated_at = now()
                """,
                {**user, "password_hash": password_hash},
            )
        conn.commit()
