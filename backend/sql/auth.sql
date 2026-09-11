-- Usuários da aplicação (RBAC) + auditoria de ações.

CREATE TABLE IF NOT EXISTS usuarios (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(200),          
  email VARCHAR(200),
  password_hash VARCHAR(200), 
  role VARCHAR(200),
  telefone VARCHAR(200),
  endereco VARCHAR(200),
  bairro VARCHAR(200),
  municipio VARCHAR(200), 
  estado VARCHAR(200), 
  cep VARCHAR(200), 
  equipe VARCHAR(200), 
  supervisor VARCHAR(200), 
  codigo VARCHAR(200),
  status VARCHAR(200) NOT NULL DEFAULT 'Ativo',
  extra_permissions TEXT[] NOT NULL DEFAULT '{}',
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_usuarios_email ON usuarios(email);
CREATE INDEX IF NOT EXISTS idx_usuarios_role ON usuarios(role);

CREATE TABLE IF NOT EXISTS audit_log (
  id BIGSERIAL PRIMARY KEY,
  usuario_id TEXT,
  usuario_email VARCHAR(200),
  acao TEXT NOT NULL,
  recurso VARCHAR(200),
  detalhe VARCHAR(200),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_log_criado ON audit_log(criado_em DESC);
