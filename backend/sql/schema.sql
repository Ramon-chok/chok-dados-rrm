-- =============================================================================
-- CHOK — Esquema do banco histórico (espelho de server/schema.sql)
-- =============================================================================

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

CREATE TABLE IF NOT EXISTS historico (
  id            BIGSERIAL PRIMARY KEY,
  cod_vendedor  TEXT NOT NULL,
  equipe        TEXT NOT NULL,
  valido_de     DATE NOT NULL,
  valido_ate    DATE,
  criado_em     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_veh_vendedor ON historico(cod_vendedor, valido_de);

CREATE TABLE IF NOT EXISTS clientes (
  cod_cliente   TEXT PRIMARY KEY,
  razao_social  TEXT,
  cnpj          TEXT,
  cod_vendedor  TEXT,
  status        TEXT,
  -- true = cliente é uma rede (vários pontos sob um mesmo nome comercial).
  -- Usado no Dashboard para decidir se o Top Clientes mostra o código
  -- individual ou só a posição do ranking.
  e_rede        BOOLEAN NOT NULL DEFAULT false,
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

CREATE TABLE IF NOT EXISTS metas_mensais (
  ano_mes           TEXT NOT NULL,
  cod_vendedor      TEXT NOT NULL,
  fabricante        TEXT NOT NULL,
  meta_faturamento  NUMERIC(14,2),
  meta_cobertura    NUMERIC(10,2),
  data_importacao   TIMESTAMPTZ NOT NULL DEFAULT now(),
  importacao_id     BIGINT,
  PRIMARY KEY (ano_mes, cod_vendedor, fabricante)
);

CREATE TABLE IF NOT EXISTS login (
  id            BIGSERIAL PRIMARY KEY,
  username      TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  email         TEXT,
  role VARCHAR(50),
  criado_em     TIMESTAMPTZ NOT NULL DEFAULT now()
);


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
  -- Campos extras da planilha Dados App (aba Mês)
  data_inicial_faseamento      DATE,
  realizado_faseamento         NUMERIC(14,2),
  meta_faseamento              NUMERIC(14,2),
  realizado_faseamento_2       NUMERIC(14,2),
  data_inicial_desconcentracao DATE,
  data_final_desconcentracao   DATE,
  meta_desconcentracao         NUMERIC(14,2),
  realizado_desconcentracao    NUMERIC(14,2),
  visitas_diaria               INT,
  positivacao_diaria           INT,
  fora_de_rota_diaria          INT,
  visitas_acumulada            INT,
  positivacao_acumulada        INT,
  fora_de_rota_acumulada       INT,
  data_inicial_faseamento_ii   DATE,
  data_final_faseamento_ii     DATE,
  meta_faseamento_ii           NUMERIC(14,2),
  realizado_faseamento_ii      NUMERIC(14,2),
  data_inicial_desafio         DATE,
  data_final_desafio           DATE,
  meta_desafio                 NUMERIC(14,2),
  realizado_desafio            NUMERIC(14,2),
  mes_referencia          INT NOT NULL,
  ano_referencia          INT NOT NULL,
  data_importacao         TIMESTAMPTZ NOT NULL DEFAULT now(),
  importacao_id           BIGINT,
  PRIMARY KEY (data_referencia, cod_vendedor)
);
-- Bancos já existentes: CREATE IF NOT EXISTS não adiciona colunas novas.
ALTER TABLE indicadores_vendedor ADD COLUMN IF NOT EXISTS data_inicial_faseamento DATE;
ALTER TABLE indicadores_vendedor ADD COLUMN IF NOT EXISTS realizado_faseamento NUMERIC(14,2);
ALTER TABLE indicadores_vendedor ADD COLUMN IF NOT EXISTS meta_faseamento NUMERIC(14,2);
ALTER TABLE indicadores_vendedor ADD COLUMN IF NOT EXISTS realizado_faseamento_2 NUMERIC(14,2);
ALTER TABLE indicadores_vendedor ADD COLUMN IF NOT EXISTS data_inicial_desconcentracao DATE;
ALTER TABLE indicadores_vendedor ADD COLUMN IF NOT EXISTS data_final_desconcentracao DATE;
ALTER TABLE indicadores_vendedor ADD COLUMN IF NOT EXISTS meta_desconcentracao NUMERIC(14,2);
ALTER TABLE indicadores_vendedor ADD COLUMN IF NOT EXISTS realizado_desconcentracao NUMERIC(14,2);
ALTER TABLE indicadores_vendedor ADD COLUMN IF NOT EXISTS visitas_diaria INT;
ALTER TABLE indicadores_vendedor ADD COLUMN IF NOT EXISTS positivacao_diaria INT;
ALTER TABLE indicadores_vendedor ADD COLUMN IF NOT EXISTS fora_de_rota_diaria INT;
ALTER TABLE indicadores_vendedor ADD COLUMN IF NOT EXISTS visitas_acumulada INT;
ALTER TABLE indicadores_vendedor ADD COLUMN IF NOT EXISTS positivacao_acumulada INT;
ALTER TABLE indicadores_vendedor ADD COLUMN IF NOT EXISTS fora_de_rota_acumulada INT;
ALTER TABLE indicadores_vendedor ADD COLUMN IF NOT EXISTS data_inicial_faseamento_ii DATE;
ALTER TABLE indicadores_vendedor ADD COLUMN IF NOT EXISTS data_final_faseamento_ii DATE;
ALTER TABLE indicadores_vendedor ADD COLUMN IF NOT EXISTS meta_faseamento_ii NUMERIC(14,2);
ALTER TABLE indicadores_vendedor ADD COLUMN IF NOT EXISTS realizado_faseamento_ii NUMERIC(14,2);
ALTER TABLE indicadores_vendedor ADD COLUMN IF NOT EXISTS data_inicial_desafio DATE;
ALTER TABLE indicadores_vendedor ADD COLUMN IF NOT EXISTS data_final_desafio DATE;
ALTER TABLE indicadores_vendedor ADD COLUMN IF NOT EXISTS meta_desafio NUMERIC(14,2);
ALTER TABLE indicadores_vendedor ADD COLUMN IF NOT EXISTS realizado_desafio NUMERIC(14,2);
CREATE INDEX IF NOT EXISTS idx_ind_vend_periodo ON indicadores_vendedor(ano_referencia, mes_referencia);
CREATE INDEX IF NOT EXISTS idx_ind_vend_vendedor ON indicadores_vendedor(cod_vendedor, data_referencia);

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

-- Planilha "Top Clientes" — aba "top_20_clientes": ranking de clientes por
-- vendedor/equipe/gerência, comparando trimestre e mês.
-- PK é um "id" próprio (não a combinação de negócio) porque a mesma
-- combinação data/vendedor/cliente pode se repetir legitimamente na
-- planilha — cada reimportação apaga e regrava o dia inteiro (ver
-- replace_snapshot_rows em app.import_types / app.upsert), preservando
-- toda e qualquer duplicata exatamente como consta no arquivo.
CREATE TABLE IF NOT EXISTS top_20_clientes (
  id                   BIGSERIAL PRIMARY KEY,
  data_referencia      DATE NOT NULL,
  cod_vendedor         TEXT NOT NULL,
  nivel                TEXT,
  gerencia             TEXT,
  equipe               TEXT,
  nome_vendedor        TEXT,
  pasta                TEXT,
  cod_cliente          TEXT NOT NULL,
  cliente_redes        TEXT,
  trimestre_25         NUMERIC(14,2),
  trimestre_26         NUMERIC(14,2),
  pct_cresc_trimestre  NUMERIC(6,2),
  mes_25               NUMERIC(14,2),
  mes_26               NUMERIC(14,2),
  pct_cresc_mes        NUMERIC(6,2),
  mes_referencia       INT NOT NULL,
  ano_referencia       INT NOT NULL,
  data_importacao      TIMESTAMPTZ NOT NULL DEFAULT now(),
  importacao_id        BIGINT
);
CREATE INDEX IF NOT EXISTS idx_top20_data ON top_20_clientes(data_referencia);
CREATE INDEX IF NOT EXISTS idx_top20_periodo ON top_20_clientes(ano_referencia, mes_referencia);
CREATE INDEX IF NOT EXISTS idx_top20_vendedor ON top_20_clientes(cod_vendedor, data_referencia);

-- Planilha "Top Clientes" — aba "top_clientes": venda total no mês por
-- cliente. Alimenta o Top 10 Clientes do Dashboard (gerencia/equipe/
-- cod_vendedor vêm junto para poder filtrar por escopo do usuário). Mesmo
-- motivo do "id" próprio: um cod_cliente pode se repetir na planilha e
-- nenhuma linha pode ser descartada.
CREATE TABLE IF NOT EXISTS top_clientes (
  id                BIGSERIAL PRIMARY KEY,
  data_referencia   DATE NOT NULL,
  cod_cliente       TEXT NOT NULL,
  gerencia          TEXT,
  equipe            TEXT,
  cod_vendedor      TEXT,
  nome_vendedor     TEXT,
  cliente           TEXT,
  municipio         TEXT,
  venda_total_mes   NUMERIC(14,2),
  mes_referencia    INT NOT NULL,
  ano_referencia    INT NOT NULL,
  data_importacao   TIMESTAMPTZ NOT NULL DEFAULT now(),
  importacao_id     BIGINT
);
-- Bancos já existentes: CREATE IF NOT EXISTS não adiciona colunas novas.
ALTER TABLE top_clientes ADD COLUMN IF NOT EXISTS gerencia TEXT;
ALTER TABLE top_clientes ADD COLUMN IF NOT EXISTS equipe TEXT;
ALTER TABLE top_clientes ADD COLUMN IF NOT EXISTS cod_vendedor TEXT;
ALTER TABLE top_clientes ADD COLUMN IF NOT EXISTS nome_vendedor TEXT;
ALTER TABLE top_clientes ADD COLUMN IF NOT EXISTS municipio TEXT;
CREATE INDEX IF NOT EXISTS idx_top_clientes_data ON top_clientes(data_referencia);
CREATE INDEX IF NOT EXISTS idx_top_clientes_periodo ON top_clientes(ano_referencia, mes_referencia);
CREATE INDEX IF NOT EXISTS idx_top_clientes_vendedor ON top_clientes(cod_vendedor, data_referencia);

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
  status           TEXT NOT NULL,
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
