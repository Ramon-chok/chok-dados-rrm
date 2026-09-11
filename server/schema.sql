-- =============================================================================
-- CHOK — Esquema do banco histórico
-- =============================================================================
-- Todas as tabelas usam CREATE TABLE IF NOT EXISTS / índices IF NOT EXISTS,
-- então este arquivo pode ser reexecutado com segurança (ver server/migrate.ts).
--
-- Conceito central: tabelas de CADASTRO guardam o dado mais recente (upsert por
-- código natural). Tabelas de INDICADOR/SNAPSHOT guardam um registro por
-- (data_referencia + chave da entidade) e NUNCA são sobrescritas entre
-- períodos diferentes — apenas o mesmo período é atualizado (upsert).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- CADASTROS (dimensões) — upsert pelo código natural, sempre representam o
-- estado ATUAL do cadastro.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS gerencias (
  codigo_gerencia TEXT PRIMARY KEY,
  nome_gerencia   TEXT NOT NULL,
  atualizado_em   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS fabricantes (
  nome_fabricante TEXT PRIMARY KEY,
  razao_social    TEXT,
  cnpj            TEXT,
  atualizado_em   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS supervisores (
  nome_supervisor TEXT PRIMARY KEY,
  gerencia        TEXT,
  email           TEXT,
  atualizado_em   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS equipes (
  nome_equipe   TEXT PRIMARY KEY,
  supervisor    TEXT,
  gerencia      TEXT,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS vendedores (
  cod_vendedor  TEXT PRIMARY KEY,
  nome          TEXT NOT NULL,
  email         TEXT,
  equipe        TEXT,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Histórico de vínculo vendedor -> equipe (regra 18 do PRD: o vínculo muda ao
-- longo do tempo, mas o passado precisa continuar analisável com o vínculo
-- que valia naquele momento). Alimentado manualmente/por processo à parte —
-- não faz parte do fluxo padrão de upsert de cadastro.
CREATE TABLE IF NOT EXISTS vendedor_equipe_historico (
  id            BIGSERIAL PRIMARY KEY,
  cod_vendedor  TEXT NOT NULL,
  equipe        TEXT NOT NULL,
  valido_de     DATE NOT NULL,
  valido_ate    DATE,
  criado_em     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_veh_vendedor ON vendedor_equipe_historico(cod_vendedor, valido_de);

CREATE TABLE IF NOT EXISTS clientes (
  cod_cliente   TEXT PRIMARY KEY,
  razao_social  TEXT,
  cnpj          TEXT,
  cod_vendedor  TEXT,
  status        TEXT,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS categorias (
  cod_categoria  TEXT PRIMARY KEY,
  nome_categoria TEXT,
  fabricante     TEXT,
  atualizado_em  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS produtos (
  cod_produto   TEXT PRIMARY KEY,
  descricao     TEXT,
  fabricante    TEXT,
  categoria     TEXT,
  preco_tabela  NUMERIC(14,2),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- METAS — históricas por competência (regra 19: meta de setembro não pode ser
-- sobrescrita pela meta de outubro).
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS metas_mensais (
  ano_mes           TEXT NOT NULL, -- 'YYYY-MM'
  cod_vendedor      TEXT NOT NULL,
  fabricante        TEXT NOT NULL,
  meta_faturamento  NUMERIC(14,2),
  meta_cobertura    NUMERIC(10,2),
  data_importacao   TIMESTAMPTZ NOT NULL DEFAULT now(),
  importacao_id     BIGINT,
  PRIMARY KEY (ano_mes, cod_vendedor, fabricante)
);

-- ---------------------------------------------------------------------------
-- FATOS TRANSACIONAIS — upsert pela chave natural do próprio registro
-- (nota fiscal, visita agendada). Cada linha já carrega sua própria data.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS vendas (
  numero_pedido   TEXT PRIMARY KEY,
  data_emissao    DATE NOT NULL,
  cod_cliente     TEXT,
  cod_vendedor    TEXT,
  valor_total     NUMERIC(14,2),
  data_importacao TIMESTAMPTZ NOT NULL DEFAULT now(),
  importacao_id   BIGINT
);
CREATE INDEX IF NOT EXISTS idx_vendas_data ON vendas(data_emissao);
CREATE INDEX IF NOT EXISTS idx_vendas_vendedor ON vendas(cod_vendedor, data_emissao);

CREATE TABLE IF NOT EXISTS visitas (
  cod_cliente     TEXT NOT NULL,
  cod_vendedor    TEXT NOT NULL,
  data_visita     DATE NOT NULL,
  status_visita   TEXT,
  data_importacao TIMESTAMPTZ NOT NULL DEFAULT now(),
  importacao_id   BIGINT,
  PRIMARY KEY (cod_cliente, cod_vendedor, data_visita)
);

-- ---------------------------------------------------------------------------
-- INDICADORES DIÁRIOS (SNAPSHOT) — o coração do pedido do PRD (seções 5, 16,
-- 33-35). Uma linha por (data_referencia + chave da entidade). Reenviar o
-- mesmo dia faz UPDATE; um novo dia sempre cria uma nova linha.
-- ---------------------------------------------------------------------------

-- aba "Mês": desempenho diário consolidado por vendedor
CREATE TABLE IF NOT EXISTS indicadores_vendedor (
  data_referencia         DATE NOT NULL,
  cod_vendedor            TEXT NOT NULL,
  gerencia                TEXT,
  nome_vendedor           TEXT,
  meta_faturamento        NUMERIC(14,2),
  realizado_faturamento   NUMERIC(14,2),
  meta_cobertura          NUMERIC(10,2),
  realizado_cobertura     NUMERIC(10,2),
  meta_sortimento         NUMERIC(10,2),
  realizado_sortimento    NUMERIC(10,2),
  pct_margem              NUMERIC(6,2),
  mes_referencia          INT NOT NULL,
  ano_referencia          INT NOT NULL,
  data_importacao         TIMESTAMPTZ NOT NULL DEFAULT now(),
  importacao_id           BIGINT,
  PRIMARY KEY (data_referencia, cod_vendedor)
);
CREATE INDEX IF NOT EXISTS idx_ind_vend_periodo ON indicadores_vendedor(ano_referencia, mes_referencia);
CREATE INDEX IF NOT EXISTS idx_ind_vend_vendedor ON indicadores_vendedor(cod_vendedor, data_referencia);

-- aba "Categorias": desempenho diário por vendedor x fabricante
CREATE TABLE IF NOT EXISTS indicadores_fabricante (
  data_referencia      DATE NOT NULL,
  cod_vendedor         TEXT NOT NULL,
  fabricante           TEXT NOT NULL,
  gerencia             TEXT,
  equipe               TEXT,
  meta                 NUMERIC(14,2),
  realizado            NUMERIC(14,2),
  cobertura            NUMERIC(10,2),
  realizado_cobertura  NUMERIC(10,2),
  pct_margem           NUMERIC(6,2),
  mes_referencia       INT NOT NULL,
  ano_referencia       INT NOT NULL,
  data_importacao      TIMESTAMPTZ NOT NULL DEFAULT now(),
  importacao_id        BIGINT,
  PRIMARY KEY (data_referencia, cod_vendedor, fabricante)
);
CREATE INDEX IF NOT EXISTS idx_ind_fab_periodo ON indicadores_fabricante(ano_referencia, mes_referencia);
CREATE INDEX IF NOT EXISTS idx_ind_fab_vendedor ON indicadores_fabricante(cod_vendedor, data_referencia);

-- aba "Positivação": visitas/vendas/roteiro consolidados por dia e vendedor
CREATE TABLE IF NOT EXISTS indicadores_positivacao (
  data_referencia     DATE NOT NULL,
  cod_vendedor        TEXT NOT NULL,
  equipe              TEXT,
  visitas_previstas   INT,
  visitas_realizadas  INT,
  vendas_previstas    INT,
  vendas_realizadas   INT,
  fora_de_rota        INT,
  gps_ok              INT,
  pedidos             INT,
  apontamentos        INT,
  mes_referencia      INT NOT NULL,
  ano_referencia      INT NOT NULL,
  data_importacao     TIMESTAMPTZ NOT NULL DEFAULT now(),
  importacao_id       BIGINT,
  PRIMARY KEY (data_referencia, cod_vendedor)
);
CREATE INDEX IF NOT EXISTS idx_ind_pos_periodo ON indicadores_positivacao(ano_referencia, mes_referencia);
CREATE INDEX IF NOT EXISTS idx_ind_pos_vendedor ON indicadores_positivacao(cod_vendedor, data_referencia);

-- ---------------------------------------------------------------------------
-- AUDITORIA DE IMPORTAÇÃO (regras 26-28)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS importacoes (
  id               BIGSERIAL PRIMARY KEY,
  tipo             TEXT NOT NULL,
  arquivo          TEXT,
  usuario_nome     TEXT,
  usuario_email    TEXT,
  data_referencia  DATE,
  mes_referencia   INT,
  ano_referencia   INT,
  data_importacao  TIMESTAMPTZ NOT NULL DEFAULT now(),
  total_linhas     INT NOT NULL DEFAULT 0,
  novos            INT NOT NULL DEFAULT 0,
  atualizados      INT NOT NULL DEFAULT 0,
  rejeitados       INT NOT NULL DEFAULT 0,
  status           TEXT NOT NULL, -- CONCLUIDO | CONCLUIDO_COM_AVISOS | FALHA
  mensagem_erro    TEXT
);
CREATE INDEX IF NOT EXISTS idx_importacoes_tipo_data ON importacoes(tipo, data_importacao DESC);

CREATE TABLE IF NOT EXISTS importacoes_erros (
  id             BIGSERIAL PRIMARY KEY,
  importacao_id  BIGINT NOT NULL REFERENCES importacoes(id) ON DELETE CASCADE,
  linha          INT,
  motivo         TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_importacoes_erros_importacao ON importacoes_erros(importacao_id);
