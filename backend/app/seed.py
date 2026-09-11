from __future__ import annotations

from app.config import get_settings
from app.db import get_connection
from app.security import hash_password

SEED_USERS = [
    {
        "name": "Ramon Sanchez",
        "email": "ramon21.empresa@gmail.com",
        "role": "ADMIN",
        "telefone": "(11) 11111-1111",
        "endereco": "Av. Presidente Vargas, 2000",
        "bairro": "Jardim América",
        "municipio": "Ribeirão Preto",
        "estado": "SP",
        "cep": "14020-260",
        "codigo": "100",
        "equipe": None,
        "supervisor": None,
    },
    {
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
            existing = conn.execute(
                "SELECT id FROM usuarios WHERE lower(email) = %s",
                (user["email"].lower(),),
            ).fetchone()
            if existing:
                conn.execute(
                    """
                    UPDATE usuarios SET
                      name = %(name)s,
                      password_hash = %(password_hash)s,
                      role = %(role)s,
                      telefone = %(telefone)s,
                      endereco = %(endereco)s,
                      bairro = %(bairro)s,
                      municipio = %(municipio)s,
                      estado = %(estado)s,
                      cep = %(cep)s,
                      codigo = %(codigo)s,
                      equipe = %(equipe)s,
                      supervisor = %(supervisor)s,
                      status = 'Ativo',
                      updated_at = now()
                    WHERE lower(email) = lower(%(email)s)
                    """,
                    {**user, "password_hash": password_hash},
                )
            else:
                conn.execute(
                    """
                    INSERT INTO usuarios (
                        name, email, password_hash, role, telefone, endereco, bairro,
                        municipio, estado, cep, codigo, equipe, supervisor, status
                    ) VALUES (
                        %(name)s, %(email)s, %(password_hash)s, %(role)s, %(telefone)s,
                        %(endereco)s, %(bairro)s, %(municipio)s, %(estado)s, %(cep)s,
                        %(codigo)s, %(equipe)s, %(supervisor)s, 'Ativo'
                    )
                    """,
                    {**user, "password_hash": password_hash},
                )
        conn.commit()
