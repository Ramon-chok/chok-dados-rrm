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

-- ---------------------------------------------------------------------------
-- TELA DE IMPORTAÇÃO — Lista de Sortimento
-- Colunas alinhadas com a UI (Importacao.tsx): CÓDIGO, PRODUTO, FABRICANTE,
-- CATEGORIA, LINHA.
-- PK própria (id): a planilha pode repetir o mesmo cod_produto e NENHUMA
-- linha pode ser descartada. Cada importação apaga e regrava a tabela
-- inteira (replace_all_rows em app.import_types / app.upsert).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sortimento (
  id            BIGSERIAL PRIMARY KEY,
  cod_produto   TEXT NOT NULL,
  produto       TEXT,
  fabricante    TEXT,
  categoria     TEXT,
  linha         TEXT,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Bancos já existentes com layout antigo (PK = cod_produto):
ALTER TABLE sortimento ADD COLUMN IF NOT EXISTS id BIGSERIAL;
ALTER TABLE sortimento ADD COLUMN IF NOT EXISTS produto TEXT;
ALTER TABLE sortimento ADD COLUMN IF NOT EXISTS fabricante TEXT;
ALTER TABLE sortimento ADD COLUMN IF NOT EXISTS categoria TEXT;
ALTER TABLE sortimento ADD COLUMN IF NOT EXISTS linha TEXT;
ALTER TABLE sortimento ADD COLUMN IF NOT EXISTS atualizado_em TIMESTAMPTZ DEFAULT now();
-- Se a PK antiga ainda for cod_produto, troca para id e libera duplicatas.
DO $sortimento_pk$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.key_column_usage
    WHERE table_schema = 'public'
      AND table_name = 'sortimento'
      AND constraint_name = 'sortimento_pkey'
      AND column_name = 'cod_produto'
  ) THEN
    ALTER TABLE sortimento DROP CONSTRAINT sortimento_pkey;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'sortimento'
      AND constraint_type = 'PRIMARY KEY'
  ) THEN
    ALTER TABLE sortimento ADD PRIMARY KEY (id);
  END IF;
END
$sortimento_pk$;
CREATE INDEX IF NOT EXISTS idx_sortimento_cod ON sortimento(cod_produto);
CREATE INDEX IF NOT EXISTS idx_sortimento_fab ON sortimento(fabricante);

-- Não Positivados — 3 níveis da mesma planilha (Por Vendedor / Equipe / Chok
-- Total), cada um com seu próprio destino. Cada fabricante é uma coluna na
-- planilha real; todas as colunas não mapeadas explicitamente na importação
-- são capturadas em "fabricantes" (jsonb), o que também alimenta o filtro
-- por categoria na tela.
CREATE TABLE IF NOT EXISTS nao_positivados_vendedor (
  data_referencia  DATE NOT NULL,
  cod_vendedor     TEXT NOT NULL,
  cod_cliente      TEXT NOT NULL,
  razao_social     TEXT,
  nome_fantasia    TEXT,
  municipio        TEXT,
  fabricantes      JSONB NOT NULL DEFAULT '{}'::jsonb,
  mes_referencia   INT NOT NULL,
  ano_referencia   INT NOT NULL,
  data_importacao  TIMESTAMPTZ NOT NULL DEFAULT now(),
  importacao_id    BIGINT,
  PRIMARY KEY (data_referencia, cod_vendedor, cod_cliente)
);
-- Bancos já existentes (ex.: criados pelo antigo espelho Node) podem ter
-- essa tabela sem as colunas do novo formato jsonb — adiciona sem apagar nada.
ALTER TABLE nao_positivados_vendedor ADD COLUMN IF NOT EXISTS razao_social TEXT;
ALTER TABLE nao_positivados_vendedor ADD COLUMN IF NOT EXISTS nome_fantasia TEXT;
ALTER TABLE nao_positivados_vendedor ADD COLUMN IF NOT EXISTS municipio TEXT;
ALTER TABLE nao_positivados_vendedor ADD COLUMN IF NOT EXISTS fabricantes JSONB NOT NULL DEFAULT '{}'::jsonb;
CREATE INDEX IF NOT EXISTS idx_nao_pos_vend_periodo ON nao_positivados_vendedor(ano_referencia, mes_referencia);
CREATE INDEX IF NOT EXISTS idx_nao_pos_vend_vendedor ON nao_positivados_vendedor(cod_vendedor, data_referencia);

CREATE TABLE IF NOT EXISTS nao_positivados_equipe (
  data_referencia  DATE NOT NULL,
  equipe           TEXT NOT NULL,
  cod_cliente      TEXT NOT NULL,
  razao_social     TEXT,
  nome_fantasia    TEXT,
  municipio        TEXT,
  fabricantes      JSONB NOT NULL DEFAULT '{}'::jsonb,
  mes_referencia   INT NOT NULL,
  ano_referencia   INT NOT NULL,
  data_importacao  TIMESTAMPTZ NOT NULL DEFAULT now(),
  importacao_id    BIGINT,
  PRIMARY KEY (data_referencia, equipe, cod_cliente)
);
ALTER TABLE nao_positivados_equipe ADD COLUMN IF NOT EXISTS razao_social TEXT;
ALTER TABLE nao_positivados_equipe ADD COLUMN IF NOT EXISTS nome_fantasia TEXT;
ALTER TABLE nao_positivados_equipe ADD COLUMN IF NOT EXISTS municipio TEXT;
ALTER TABLE nao_positivados_equipe ADD COLUMN IF NOT EXISTS fabricantes JSONB NOT NULL DEFAULT '{}'::jsonb;
CREATE INDEX IF NOT EXISTS idx_nao_pos_equipe_periodo ON nao_positivados_equipe(ano_referencia, mes_referencia);
CREATE INDEX IF NOT EXISTS idx_nao_pos_equipe_equipe ON nao_positivados_equipe(equipe, data_referencia);

CREATE TABLE IF NOT EXISTS nao_positivados_chok_total (
  data_referencia  DATE NOT NULL,
  cod_cliente      TEXT NOT NULL,
  razao_social     TEXT,
  nome_fantasia    TEXT,
  municipio        TEXT,
  fabricantes      JSONB NOT NULL DEFAULT '{}'::jsonb,
  mes_referencia   INT NOT NULL,
  ano_referencia   INT NOT NULL,
  data_importacao  TIMESTAMPTZ NOT NULL DEFAULT now(),
  importacao_id    BIGINT,
  PRIMARY KEY (data_referencia, cod_cliente)
);
ALTER TABLE nao_positivados_chok_total ADD COLUMN IF NOT EXISTS razao_social TEXT;
ALTER TABLE nao_positivados_chok_total ADD COLUMN IF NOT EXISTS nome_fantasia TEXT;
ALTER TABLE nao_positivados_chok_total ADD COLUMN IF NOT EXISTS municipio TEXT;
ALTER TABLE nao_positivados_chok_total ADD COLUMN IF NOT EXISTS fabricantes JSONB NOT NULL DEFAULT '{}'::jsonb;
CREATE INDEX IF NOT EXISTS idx_nao_pos_total_periodo ON nao_positivados_chok_total(ano_referencia, mes_referencia);

-- Raio-X — aba "Acompanhamento" (planilha diária fornecida pelo SAR, ver
-- tipo "raiox" em app.import_types e a configuração de colunas em
-- src/pages/admin/Importacao.tsx). Snapshot diário: uma linha por
-- (data_referencia, cod_vendedor); reenviar o mesmo dia atualiza (UPDATE),
-- um novo dia sempre cria uma linha nova. Espelho de server/schema.sql.
CREATE TABLE IF NOT EXISTS raiox (
  data_referencia               DATE NOT NULL,
  cod_vendedor                  TEXT NOT NULL,
  vendedor                      TEXT,
  equipe                        TEXT,

  visitas_previstas             INT,
  visitas_realizadas            INT,
  visitas_fora_rota             INT,
  perc_gps                      NUMERIC(8,4),

  -- Texto livre (ex.: "Setor vago"); NÃO é contagem numérica.
  apontamentos_inconsistencia   TEXT,
  positiva_prevista             INT,
  pedidos                       INT,
  perc_positivacao              NUMERIC(8,4),

  fora_rota_positivacao         INT,
  perc_fora_rota                NUMERIC(8,4),
  produtividade                 NUMERIC(10,2),

  hora_inicio                   TIME,
  hora_check_in                 TIME,
  hora_check_out                TIME,
  hora_fim                      TIME,
  -- Duração (não hora-do-dia) — pode passar de 24h somada, por isso é TEXT
  -- ("HH:MM:SS"), não TIME (ver parse_duration em app.parse).
  tempo_campo                   TEXT,

  acumulado_prevista            INT,
  acumulado_realizadas          INT,
  acumulado_porcentagem         NUMERIC(8,4),
  acumulado_fora_rota           INT,
  perc_fora_rota_acumulado      NUMERIC(8,4),

  acumulado_positivacao_visitas INT,
  acumulado_positivacao_pedidos INT,
  perc_positivacao_acumulado    NUMERIC(8,4),
  acumulado_positivacao_fora_rota INT,
  perc_positivacao_fora_rota    NUMERIC(8,4),

  mes_referencia      INT NOT NULL,
  ano_referencia       INT NOT NULL,
  data_importacao      TIMESTAMPTZ NOT NULL DEFAULT now(),
  importacao_id        BIGINT,
  PRIMARY KEY (data_referencia, cod_vendedor)
);
CREATE INDEX IF NOT EXISTS idx_raiox_periodo ON raiox(ano_referencia, mes_referencia);

-- Percentuais do Raio-X são frações (0.8567): NUMERIC(6,2) perdia precisão.
ALTER TABLE raiox ALTER COLUMN perc_gps TYPE NUMERIC(8,4);
ALTER TABLE raiox ALTER COLUMN perc_positivacao TYPE NUMERIC(8,4);
ALTER TABLE raiox ALTER COLUMN perc_fora_rota TYPE NUMERIC(8,4);
ALTER TABLE raiox ALTER COLUMN acumulado_porcentagem TYPE NUMERIC(8,4);
ALTER TABLE raiox ALTER COLUMN perc_fora_rota_acumulado TYPE NUMERIC(8,4);
ALTER TABLE raiox ALTER COLUMN perc_positivacao_acumulado TYPE NUMERIC(8,4);
ALTER TABLE raiox ALTER COLUMN perc_positivacao_fora_rota TYPE NUMERIC(8,4);

-- Vendedor Detalhado — planilha visita a visita (ver tipo "vendedor_detalhado"
-- em app.import_types e a configuração de colunas em
-- src/pages/admin/Importacao.tsx). Várias linhas por vendedor/dia: id próprio
-- e cada importação substitui o snapshot inteiro da data_referencia.
CREATE TABLE IF NOT EXISTS vendedor_detalhado (
  id                BIGSERIAL PRIMARY KEY,
  data_referencia   DATE NOT NULL,
  gerencia          TEXT,
  supervisao        TEXT,
  codigo_vendedor   TEXT NOT NULL,
  vendedor          TEXT,
  codigo_cliente    TEXT,
  nome_cliente      TEXT,
  acao              TEXT,
  data              DATE,
  dentro_rota       BOOLEAN,
  hora              TIME,
  -- Duração ("HH:MM:SS"), não hora-do-dia — mesmo motivo de raiox.tempo_campo.
  permanencia       TEXT,
  venda             BOOLEAN,
  valor_venda       NUMERIC(14,2),
  motivo_nao_venda  TEXT,
  motivo_nao_visita TEXT,
  mes_referencia    INT NOT NULL,
  ano_referencia    INT NOT NULL,
  data_importacao   TIMESTAMPTZ NOT NULL DEFAULT now(),
  importacao_id     BIGINT
);
CREATE INDEX IF NOT EXISTS idx_vend_det_data ON vendedor_detalhado(data_referencia);
CREATE INDEX IF NOT EXISTS idx_vend_det_periodo ON vendedor_detalhado(ano_referencia, mes_referencia);

-- Bancos que já tinham vendedor_detalhado de uma versão anterior da
-- importação (colunas cod_vendedor / valor): alinha ao layout atual de
-- src/pages/admin/Importacao.tsx sem perder as linhas existentes.
ALTER TABLE vendedor_detalhado ADD COLUMN IF NOT EXISTS gerencia TEXT;
ALTER TABLE vendedor_detalhado ADD COLUMN IF NOT EXISTS supervisao TEXT;
ALTER TABLE vendedor_detalhado ADD COLUMN IF NOT EXISTS codigo_vendedor TEXT;
ALTER TABLE vendedor_detalhado ADD COLUMN IF NOT EXISTS vendedor TEXT;
ALTER TABLE vendedor_detalhado ADD COLUMN IF NOT EXISTS codigo_cliente TEXT;
ALTER TABLE vendedor_detalhado ADD COLUMN IF NOT EXISTS nome_cliente TEXT;
ALTER TABLE vendedor_detalhado ADD COLUMN IF NOT EXISTS acao TEXT;
ALTER TABLE vendedor_detalhado ADD COLUMN IF NOT EXISTS data DATE;
ALTER TABLE vendedor_detalhado ADD COLUMN IF NOT EXISTS dentro_rota BOOLEAN;
ALTER TABLE vendedor_detalhado ADD COLUMN IF NOT EXISTS hora TIME;
ALTER TABLE vendedor_detalhado ADD COLUMN IF NOT EXISTS permanencia TEXT;
ALTER TABLE vendedor_detalhado ADD COLUMN IF NOT EXISTS venda BOOLEAN;
ALTER TABLE vendedor_detalhado ADD COLUMN IF NOT EXISTS motivo_nao_venda TEXT;
ALTER TABLE vendedor_detalhado ADD COLUMN IF NOT EXISTS motivo_nao_visita TEXT;
DO $vd_valor$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_schema = current_schema() AND table_name = 'vendedor_detalhado' AND column_name = 'valor')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_schema = current_schema() AND table_name = 'vendedor_detalhado' AND column_name = 'valor_venda') THEN
    ALTER TABLE vendedor_detalhado RENAME COLUMN valor TO valor_venda;
  END IF;
END $vd_valor$;
ALTER TABLE vendedor_detalhado ADD COLUMN IF NOT EXISTS valor_venda NUMERIC(14,2);
-- cod_vendedor (versão antiga) virou codigo_vendedor; copia onde faltar.
DO $vd_cod$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_schema = current_schema() AND table_name = 'vendedor_detalhado' AND column_name = 'cod_vendedor') THEN
    UPDATE vendedor_detalhado SET codigo_vendedor = cod_vendedor WHERE codigo_vendedor IS NULL;
  END IF;
END $vd_cod$;
CREATE INDEX IF NOT EXISTS idx_vend_det_vendedor ON vendedor_detalhado(codigo_vendedor, data_referencia);
