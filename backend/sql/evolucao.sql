-- ---------------------------------------------------------------------------
-- EVOLUÇÃO — tabelas acrescentadas sem tocar em nada que já existia.
-- Tudo é IF NOT EXISTS / ADD COLUMN IF NOT EXISTS: pode rodar em produção
-- quantas vezes for preciso, e nenhuma tabela anterior é alterada ou recriada.
-- ---------------------------------------------------------------------------

-- Seção 4 — Histórico de sessões (login, logout, duração, motivo do fim).
-- Nenhuma senha trafega ou é guardada aqui; só metadados da sessão.
CREATE TABLE IF NOT EXISTS sessoes_log (
  id            BIGSERIAL PRIMARY KEY,
  usuario_id    TEXT NOT NULL,
  usuario_email VARCHAR(200),
  jti           TEXT,
  remember_me   BOOLEAN NOT NULL DEFAULT false,
  ip            VARCHAR(64),
  user_agent    VARCHAR(400),
  login_em      TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Carimbo da última requisição autenticada: base da regra de 40 min de AFK.
  ultimo_acesso TIMESTAMPTZ NOT NULL DEFAULT now(),
  logout_em     TIMESTAMPTZ,
  duracao_seg   INTEGER,
  -- 'logout' | 'inatividade' | 'expiracao' | 'revogado'
  motivo_fim    VARCHAR(30)
);
CREATE INDEX IF NOT EXISTS idx_sessoes_log_usuario ON sessoes_log(usuario_id, login_em DESC);
CREATE INDEX IF NOT EXISTS idx_sessoes_log_jti ON sessoes_log(jti);

-- Seção 8 — Calendário comercial: campanhas, oportunidades e ações de fabricante.
CREATE TABLE IF NOT EXISTS eventos_comerciais (
  id                 BIGSERIAL PRIMARY KEY,
  titulo             VARCHAR(200) NOT NULL,
  descricao          TEXT,
  -- 'campanha' | 'oportunidade' | 'acao_fabricante' | 'reuniao' | 'outro'
  tipo               VARCHAR(40) NOT NULL DEFAULT 'campanha',
  data_inicio        DATE NOT NULL,
  data_fim           DATE,
  fabricante         VARCHAR(160),
  categoria          VARCHAR(160),
  equipe             VARCHAR(160),
  cod_vendedor       VARCHAR(40),
  responsavel        VARCHAR(200),
  potencial_faturamento NUMERIC(14,2),
  investimento_previsto NUMERIC(14,2),
  faturamento_realizado NUMERIC(14,2),
  investimento_realizado NUMERIC(14,2),
  -- 'planejado' | 'em_andamento' | 'concluido' | 'cancelado'
  status             VARCHAR(30) NOT NULL DEFAULT 'planejado',
  criado_por         TEXT,
  criado_em          TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_eventos_com_periodo ON eventos_comerciais(data_inicio, data_fim);
CREATE INDEX IF NOT EXISTS idx_eventos_com_equipe ON eventos_comerciais(equipe);
CREATE INDEX IF NOT EXISTS idx_eventos_com_fab ON eventos_comerciais(fabricante);

-- Seção 3 (Compradores) — fornecedores e negociações.
CREATE TABLE IF NOT EXISTS fornecedores (
  id             BIGSERIAL PRIMARY KEY,
  nome           VARCHAR(200) NOT NULL,
  cnpj           VARCHAR(32),
  fabricante     VARCHAR(160),
  contato        VARCHAR(200),
  email          VARCHAR(200),
  telefone       VARCHAR(60),
  condicao_pagamento VARCHAR(120),
  observacoes    TEXT,
  status         VARCHAR(20) NOT NULL DEFAULT 'Ativo',
  criado_por     TEXT,
  criado_em      TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_fornecedores_fab ON fornecedores(fabricante);
CREATE UNIQUE INDEX IF NOT EXISTS idx_fornecedores_cnpj ON fornecedores(cnpj) WHERE cnpj IS NOT NULL;

CREATE TABLE IF NOT EXISTS negociacoes_compra (
  id              BIGSERIAL PRIMARY KEY,
  fornecedor_id   BIGINT REFERENCES fornecedores(id) ON DELETE SET NULL,
  fabricante      VARCHAR(160),
  categoria       VARCHAR(160),
  descricao       TEXT,
  data_negociacao DATE NOT NULL,
  valor_compra    NUMERIC(14,2),
  desconto        NUMERIC(14,2),
  bonificacao     NUMERIC(14,2),
  investimento    NUMERIC(14,2),
  -- 'aberta' | 'fechada' | 'cancelada'
  status          VARCHAR(20) NOT NULL DEFAULT 'aberta',
  criado_por      TEXT,
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_negociacoes_data ON negociacoes_compra(data_negociacao DESC);
CREATE INDEX IF NOT EXISTS idx_negociacoes_fornecedor ON negociacoes_compra(fornecedor_id);

-- Bancos que já tinham sessoes_log de uma versão anterior desta migration:
ALTER TABLE sessoes_log ADD COLUMN IF NOT EXISTS ultimo_acesso TIMESTAMPTZ NOT NULL DEFAULT now();
CREATE INDEX IF NOT EXISTS idx_sessoes_log_abertas ON sessoes_log(jti) WHERE logout_em IS NULL;
