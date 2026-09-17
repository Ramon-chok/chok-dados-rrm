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
  nome_gerencia   VARCHAR(200) NOT NULL,
  atualizado_em   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS login (
  id BIGSERIAL PRIMARY KEY,
  cod VARCHAR(200) NOT NULL,
  nome VARCHAR(200),
  password VARCHAR(200) NOT NULL,
  role VARCHAR(200) NOT NULL
);

INSERT INTO login (cod, nome, password, role) VALUES ('admin', 'Administrador', 'Chok@2026', 'admin');
INSERT INTO login (cod, nome, password, role) VALUES ('admin', 'Administrador', 'Chok@2026', 'admin');
INSERT INTO login (cod, nome, password, role) VALUES ('admin', 'Administrador', 'Chok@2026', 'admin');
INSERT INTO login (cod, nome, password, role) VALUES ('admin', 'Administrador', 'Chok@2026', 'admin');

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
-- TELA DE IMPORTAÇÃO — novos tipos (Lista de Sortimento, Top Clientes,
-- Não Positivados). "Dados App" reaproveita as tabelas indicadores_* acima.
-- ---------------------------------------------------------------------------

-- Lista de Sortimento — PK própria (id): a planilha pode repetir cod_produto
-- e NENHUMA linha é descartada. Cada importação regrava a tabela inteira.
CREATE TABLE IF NOT EXISTS sortimento (
  id            BIGSERIAL PRIMARY KEY,
  cod_produto   TEXT NOT NULL,
  produto       TEXT,
  fabricante    TEXT,
  categoria     TEXT,
  linha         TEXT,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE sortimento ADD COLUMN IF NOT EXISTS id BIGSERIAL;
ALTER TABLE sortimento ADD COLUMN IF NOT EXISTS produto TEXT;
ALTER TABLE sortimento ADD COLUMN IF NOT EXISTS fabricante TEXT;
ALTER TABLE sortimento ADD COLUMN IF NOT EXISTS categoria TEXT;
ALTER TABLE sortimento ADD COLUMN IF NOT EXISTS linha TEXT;
ALTER TABLE sortimento ADD COLUMN IF NOT EXISTS atualizado_em TIMESTAMPTZ DEFAULT now();
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

-- Top Clientes — aba "top_20_clientes": ranking de clientes por vendedor
CREATE TABLE IF NOT EXISTS top_20_clientes (
  data_referencia       DATE NOT NULL,
  cod_vendedor          TEXT NOT NULL,
  cod_cliente           TEXT NOT NULL,
  nivel                 TEXT,
  gerencia              TEXT,
  equipe                TEXT,
  nome_vendedor         TEXT,
  pasta                 TEXT,
  cliente_redes         TEXT,
  trimestre_25          NUMERIC(14,2),
  trimestre_26          NUMERIC(14,2),
  pct_cresc_trimestre   NUMERIC(6,2),
  mes_25                NUMERIC(14,2),
  mes_26                NUMERIC(14,2),
  pct_cresc_mes         NUMERIC(6,2),
  mes_referencia        INT NOT NULL,
  ano_referencia        INT NOT NULL,
  data_importacao       TIMESTAMPTZ NOT NULL DEFAULT now(),
  importacao_id         BIGINT,
  PRIMARY KEY (data_referencia, cod_vendedor, cod_cliente)
);
CREATE INDEX IF NOT EXISTS idx_top20_periodo ON top_20_clientes(ano_referencia, mes_referencia);
CREATE INDEX IF NOT EXISTS idx_top20_vendedor ON top_20_clientes(cod_vendedor, data_referencia);

-- Top Clientes — aba "top_clientes": venda total no mês por cliente
CREATE TABLE IF NOT EXISTS top_clientes (
  data_referencia   DATE NOT NULL,
  cod_cliente       TEXT NOT NULL,
  cliente           TEXT,
  venda_total_mes   NUMERIC(14,2),
  mes_referencia    INT NOT NULL,
  ano_referencia    INT NOT NULL,
  data_importacao   TIMESTAMPTZ NOT NULL DEFAULT now(),
  importacao_id     BIGINT,
  PRIMARY KEY (data_referencia, cod_cliente)
);
CREATE INDEX IF NOT EXISTS idx_topcli_periodo ON top_clientes(ano_referencia, mes_referencia);

-- Não Positivados — aba "Por vendedor". Na planilha real é uma matriz
-- cliente x fabricante (uma coluna por fabricante, com o valor vendido no
-- período) — a lista de fabricantes muda com o tempo, então em vez de uma
-- coluna fixa por fabricante, `fabricantes` guarda o mapa completo
-- {"3M": 1234.56, "ARCOR": 0, ...} vindo direto da planilha (ver
-- dynamicJsonColumn em server/importTypes.ts e server/upsert.ts).
CREATE TABLE IF NOT EXISTS nao_positivados_vendedor (
  data_referencia     DATE NOT NULL,
  cod_vendedor        TEXT NOT NULL,
  cod_cliente         TEXT NOT NULL,
  razao_social        TEXT,
  nome_fantasia       TEXT,
  municipio           TEXT,
  fabricantes         JSONB NOT NULL DEFAULT '{}'::jsonb,
  mes_referencia      INT NOT NULL,
  ano_referencia      INT NOT NULL,
  data_importacao     TIMESTAMPTZ NOT NULL DEFAULT now(),
  importacao_id       BIGINT,
  PRIMARY KEY (data_referencia, cod_vendedor, cod_cliente)
);
CREATE INDEX IF NOT EXISTS idx_naopos_vend_periodo ON nao_positivados_vendedor(ano_referencia, mes_referencia);

-- Não Positivados — aba "Equipe" (mesma matriz cliente x fabricante, por equipe)
CREATE TABLE IF NOT EXISTS nao_positivados_equipe (
  data_referencia     DATE NOT NULL,
  equipe              TEXT NOT NULL,
  cod_cliente         TEXT NOT NULL,
  razao_social        TEXT,
  nome_fantasia       TEXT,
  municipio           TEXT,
  fabricantes         JSONB NOT NULL DEFAULT '{}'::jsonb,
  mes_referencia      INT NOT NULL,
  ano_referencia      INT NOT NULL,
  data_importacao     TIMESTAMPTZ NOT NULL DEFAULT now(),
  importacao_id       BIGINT,
  PRIMARY KEY (data_referencia, equipe, cod_cliente)
);
CREATE INDEX IF NOT EXISTS idx_naopos_equipe_periodo ON nao_positivados_equipe(ano_referencia, mes_referencia);

-- Não Positivados — aba "Chok total" (mesma matriz cliente x fabricante, consolidado)
CREATE TABLE IF NOT EXISTS nao_positivados_chok_total (
  data_referencia     DATE NOT NULL,
  cod_cliente         TEXT NOT NULL,
  razao_social        TEXT,
  nome_fantasia       TEXT,
  municipio           TEXT,
  fabricantes         JSONB NOT NULL DEFAULT '{}'::jsonb,
  mes_referencia      INT NOT NULL,
  ano_referencia      INT NOT NULL,
  data_importacao     TIMESTAMPTZ NOT NULL DEFAULT now(),
  importacao_id       BIGINT,
  PRIMARY KEY (data_referencia, cod_cliente)
);
CREATE INDEX IF NOT EXISTS idx_naopos_chok_periodo ON nao_positivados_chok_total(ano_referencia, mes_referencia);

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

-- Raio-X — aba "Acompanhamento" (planilha diária fornecida pelo SAR, ver
-- tipo "raiox" em server/importTypes.ts e a configuração de colunas em
-- src/pages/admin/Importacao.tsx). Snapshot diário: uma linha por
-- (data_referencia, cod_vendedor); reenviar o mesmo dia atualiza (UPDATE),
-- um novo dia sempre cria uma linha nova.
CREATE TABLE IF NOT EXISTS raiox (
  data_referencia               DATE NOT NULL,
  cod_vendedor                  TEXT NOT NULL,
  vendedor                      TEXT,
  equipe                        TEXT,

  visitas_previstas             INT,
  visitas_realizadas            INT,
  visitas_fora_rota             INT,
  perc_gps                      NUMERIC(6,2),

  apontamentos_inconsistencia   TEXT,
  positiva_prevista             INT,
  pedidos                       INT,
  perc_positivacao              NUMERIC(6,2),

  fora_rota_positivacao         INT,
  perc_fora_rota                NUMERIC(6,2),
  produtividade                 NUMERIC(10,2),

  hora_inicio                   TIME,
  hora_check_in                 TIME,
  hora_check_out                TIME,
  hora_fim                      TIME,
  -- Duração (não hora-do-dia) — pode passar de 24h somada, por isso é TEXT
  -- ("HH:MM:SS"), não TIME (ver parseDuration em server/parse.ts).
  tempo_campo                   TEXT,

  acumulado_prevista            INT,
  acumulado_realizadas          INT,
  acumulado_porcentagem         NUMERIC(6,2),
  acumulado_fora_rota           INT,
  perc_fora_rota_acumulado      NUMERIC(6,2),

  acumulado_positivacao_visitas INT,
  acumulado_positivacao_pedidos INT,
  perc_positivacao_acumulado    NUMERIC(6,2),
  acumulado_positivacao_fora_rota INT,
  perc_positivacao_fora_rota    NUMERIC(6,2),

  mes_referencia      INT NOT NULL,
  ano_referencia       INT NOT NULL,
  data_importacao      TIMESTAMPTZ NOT NULL DEFAULT now(),
  importacao_id        BIGINT,
  PRIMARY KEY (data_referencia, cod_vendedor)
);
-- Colunas abaixo garantem a atualização de instalações que já tinham a
-- versão antiga (e incompatível) desta tabela criada por CREATE TABLE IF
-- NOT EXISTS antes desta revisão.
ALTER TABLE raiox ADD COLUMN IF NOT EXISTS vendedor TEXT;
ALTER TABLE raiox ADD COLUMN IF NOT EXISTS equipe TEXT;
ALTER TABLE raiox ADD COLUMN IF NOT EXISTS visitas_previstas INT;
ALTER TABLE raiox ADD COLUMN IF NOT EXISTS visitas_realizadas INT;
ALTER TABLE raiox ADD COLUMN IF NOT EXISTS visitas_fora_rota INT;
ALTER TABLE raiox ADD COLUMN IF NOT EXISTS perc_gps NUMERIC(6,2);
ALTER TABLE raiox ADD COLUMN IF NOT EXISTS apontamentos_inconsistencia TEXT;
-- Instalações antigas podem ter criado a coluna como INT — converte para TEXT.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM information_schema.columns
     WHERE table_name = 'raiox'
       AND column_name = 'apontamentos_inconsistencia'
       AND data_type IN ('integer', 'bigint', 'smallint', 'numeric')
  ) THEN
    ALTER TABLE raiox
      ALTER COLUMN apontamentos_inconsistencia TYPE TEXT
      USING apontamentos_inconsistencia::text;
  END IF;
END $$;
ALTER TABLE raiox ADD COLUMN IF NOT EXISTS positiva_prevista INT;
ALTER TABLE raiox ADD COLUMN IF NOT EXISTS pedidos INT;
ALTER TABLE raiox ADD COLUMN IF NOT EXISTS perc_positivacao NUMERIC(6,2);
ALTER TABLE raiox ADD COLUMN IF NOT EXISTS fora_rota_positivacao INT;
ALTER TABLE raiox ADD COLUMN IF NOT EXISTS perc_fora_rota NUMERIC(6,2);
ALTER TABLE raiox ADD COLUMN IF NOT EXISTS produtividade NUMERIC(10,2);
ALTER TABLE raiox ADD COLUMN IF NOT EXISTS hora_inicio TIME;
ALTER TABLE raiox ADD COLUMN IF NOT EXISTS hora_check_in TIME;
ALTER TABLE raiox ADD COLUMN IF NOT EXISTS hora_check_out TIME;
ALTER TABLE raiox ADD COLUMN IF NOT EXISTS hora_fim TIME;
ALTER TABLE raiox ADD COLUMN IF NOT EXISTS tempo_campo TEXT;
ALTER TABLE raiox ADD COLUMN IF NOT EXISTS acumulado_prevista INT;
ALTER TABLE raiox ADD COLUMN IF NOT EXISTS acumulado_realizadas INT;
ALTER TABLE raiox ADD COLUMN IF NOT EXISTS acumulado_porcentagem NUMERIC(6,2);
ALTER TABLE raiox ADD COLUMN IF NOT EXISTS acumulado_fora_rota INT;
ALTER TABLE raiox ADD COLUMN IF NOT EXISTS perc_fora_rota_acumulado NUMERIC(6,2);
ALTER TABLE raiox ADD COLUMN IF NOT EXISTS acumulado_positivacao_visitas INT;
ALTER TABLE raiox ADD COLUMN IF NOT EXISTS acumulado_positivacao_pedidos INT;
ALTER TABLE raiox ADD COLUMN IF NOT EXISTS perc_positivacao_acumulado NUMERIC(6,2);
ALTER TABLE raiox ADD COLUMN IF NOT EXISTS acumulado_positivacao_fora_rota INT;
ALTER TABLE raiox ADD COLUMN IF NOT EXISTS perc_positivacao_fora_rota NUMERIC(6,2);
ALTER TABLE raiox ADD COLUMN IF NOT EXISTS mes_referencia INT;
ALTER TABLE raiox ADD COLUMN IF NOT EXISTS ano_referencia INT;
ALTER TABLE raiox ADD COLUMN IF NOT EXISTS data_importacao TIMESTAMPTZ DEFAULT now();
ALTER TABLE raiox ADD COLUMN IF NOT EXISTS importacao_id BIGINT;
-- Colunas da versão antiga que não existem mais na configuração atual.
ALTER TABLE raiox DROP COLUMN IF EXISTS semanas_ativas;
ALTER TABLE raiox DROP COLUMN IF EXISTS dia_semana;
ALTER TABLE raiox DROP COLUMN IF EXISTS revistas_pedidos;
ALTER TABLE raiox DROP COLUMN IF EXISTS positivacao;
ALTER TABLE raiox DROP COLUMN IF EXISTS vendas;
ALTER TABLE raiox DROP COLUMN IF EXISTS faturamento;
ALTER TABLE raiox DROP COLUMN IF EXISTS hora_ultimo_pedido;
ALTER TABLE raiox DROP COLUMN IF EXISTS acumulado_visitas;
ALTER TABLE raiox DROP COLUMN IF EXISTS acumulado_visitas_realizadas;
ALTER TABLE raiox DROP COLUMN IF EXISTS acumulado_positivacao;
ALTER TABLE raiox DROP COLUMN IF EXISTS acumulado_pedidos;
-- A versão antiga tinha PK (data_referencia, cod_vendedor, mes_referencia,
-- ano_referencia) — mes/ano são derivados de data_referencia (mesmo padrão
-- de indicadores_vendedor/indicadores_positivacao) e não deveriam fazer
-- parte da chave. Corrige instalações que já tinham a PK antiga.
DO $raiox_pk$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'raiox'
      AND constraint_name = 'raiox_pkey'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.key_column_usage
    WHERE table_schema = 'public'
      AND table_name = 'raiox'
      AND constraint_name = 'raiox_pkey'
      AND column_name = 'mes_referencia'
  ) THEN
    -- PK já está no formato correto (data_referencia, cod_vendedor).
    NULL;
  ELSIF EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'raiox'
      AND constraint_name = 'raiox_pkey'
  ) THEN
    ALTER TABLE raiox DROP CONSTRAINT raiox_pkey;
    ALTER TABLE raiox ADD PRIMARY KEY (data_referencia, cod_vendedor);
  ELSE
    ALTER TABLE raiox ADD PRIMARY KEY (data_referencia, cod_vendedor);
  END IF;
END
$raiox_pk$;
CREATE INDEX IF NOT EXISTS idx_raiox_periodo ON raiox(ano_referencia, mes_referencia);