-- =============================================================================
-- CHOK — Perfis de acesso (10 papéis) e apoio da tela "Visual Fabricantes"
-- =============================================================================
-- 100% aditivo: só cria o que não existe e remapeia o papel antigo "GERENTE",
-- que deixou de existir na matriz de perfis. Pode rodar quantas vezes precisar.

-- ── 1. Vínculo do perfil FORNECEDOR com o fabricante que ele representa ──────
-- O escopo do fornecedor é aplicado no SQL (services.scope_filters): sem este
-- vínculo preenchido ele não enxerga fabricante nenhum — nunca "todos".
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS fabricante VARCHAR(200);
CREATE INDEX IF NOT EXISTS idx_usuarios_fabricante ON usuarios(fabricante);

-- ── 2. Remapeamento do papel retirado ───────────────────────────────────────
-- "GERENTE" (genérico) saiu da lista de perfis. Quem estava nele passa a
-- GERENTE_COMERCIAL, que é o papel equivalente na nova matriz.
UPDATE usuarios SET role = 'GERENTE_COMERCIAL' WHERE upper(role) = 'GERENTE';

-- ── 3. Metas financeiras por fabricante (PRD RF-024/RF-025, RN-08) ──────────
-- A meta pertence ao FABRICANTE e a um intervalo de datas EXATO. Gerência,
-- equipe e vendedor não a rateiam, e intervalos sobrepostos não são somados
-- automaticamente: a leitura escolhe a meta cujo intervalo corresponde ao
-- período consultado.
CREATE TABLE IF NOT EXISTS metas_fabricante (
  id              BIGSERIAL PRIMARY KEY,
  fabricante      TEXT NOT NULL,
  inicio          DATE NOT NULL,
  fim             DATE NOT NULL,
  meta_valor      NUMERIC(14,2) NOT NULL DEFAULT 0,
  meta_cobertura  NUMERIC(10,2),
  observacao      TEXT,
  criado_por      TEXT,
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT metas_fabricante_intervalo CHECK (fim >= inicio),
  CONSTRAINT metas_fabricante_unica UNIQUE (fabricante, inicio, fim)
);
CREATE INDEX IF NOT EXISTS idx_metas_fab_periodo ON metas_fabricante(fabricante, inicio, fim);

-- ── 4. Produtos foco (PRD RF-023, RN-08) ────────────────────────────────────
-- Itens definidos para acompanhamento de cobertura, com a referência de
-- clientes de CADA item. As coberturas não são somáveis: o mesmo cliente pode
-- contar em vários produtos (ver RN-08).
CREATE TABLE IF NOT EXISTS produtos_foco (
  id             BIGSERIAL PRIMARY KEY,
  fabricante     TEXT NOT NULL,
  cod_produto    TEXT NOT NULL,
  descricao      TEXT,
  meta_clientes  INT NOT NULL DEFAULT 0,
  ativo          BOOLEAN NOT NULL DEFAULT true,
  criado_por     TEXT,
  criado_em      TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT produtos_foco_unico UNIQUE (fabricante, cod_produto)
);
CREATE INDEX IF NOT EXISTS idx_produtos_foco_fab ON produtos_foco(fabricante, ativo);

-- ── 5. Histórico de acessos à visão do fabricante (PRD RF-029) ──────────────
-- Equivale ao `access_events` do PRD: instante, fabricante, usuário, papel,
-- resultado e a origem pseudonimizada. Pseudonimização NÃO é anonimização.
CREATE TABLE IF NOT EXISTS acessos_fabricante (
  id             BIGSERIAL PRIMARY KEY,
  ocorrido_em    TIMESTAMPTZ NOT NULL DEFAULT now(),
  fabricante     TEXT,
  usuario_id     TEXT,
  usuario_email  TEXT,
  usuario_nome   TEXT,
  papel          TEXT,
  recurso        TEXT,
  sucesso        BOOLEAN NOT NULL DEFAULT true,
  detalhe        TEXT,
  origem_chave   TEXT
);
CREATE INDEX IF NOT EXISTS idx_acessos_fab_instante ON acessos_fabricante(ocorrido_em DESC);
CREATE INDEX IF NOT EXISTS idx_acessos_fab_chave ON acessos_fabricante(fabricante, ocorrido_em DESC);

-- ── 6. Liberações de alteração (portão de escrita) ──────────────────────────
-- Perfis em modo "liberacao" (Comprador, Analista, SAR) só alteram dados
-- enquanto houver uma liberação ATIVA concedida por um administrador. A
-- liberação é temporária de propósito: ela expira sozinha, para que um acesso
-- de escrita concedido para resolver uma pendência não fique aberto para
-- sempre por esquecimento.
CREATE TABLE IF NOT EXISTS liberacoes_escrita (
  id             BIGSERIAL PRIMARY KEY,
  usuario_id     TEXT NOT NULL,
  usuario_email  TEXT,
  concedido_por  TEXT,
  concedido_em   TIMESTAMPTZ NOT NULL DEFAULT now(),
  expira_em      TIMESTAMPTZ NOT NULL,
  motivo         TEXT,
  revogado_em    TIMESTAMPTZ,
  revogado_por   TEXT,
  CONSTRAINT liberacoes_escrita_intervalo CHECK (expira_em > concedido_em)
);
CREATE INDEX IF NOT EXISTS idx_liberacoes_usuario ON liberacoes_escrita(usuario_id, expira_em DESC);
