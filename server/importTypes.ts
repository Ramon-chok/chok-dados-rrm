// Configuração central de cada tipo de importação: tabela de destino, chave
// lógica de upsert (regra 11 do PRD — cada conjunto de dados tem a sua) e o
// formato esperado de cada coluna. Adicionar um novo tipo de dado no futuro
// (estoque, devoluções, VDI, etc. — regra 29) é acrescentar uma entrada aqui,
// sem precisar tocar nas rotas ou no motor de upsert.
//
// `snapshot: true` marca os indicadores diários (regra 5): a API injeta
// automaticamente data_referencia/mes_referencia/ano_referencia como parte da
// chave, então o mesmo período é atualizado (UPDATE) e um novo período sempre
// cria uma linha nova (INSERT) — nunca se sobrescreve o passado.

export type ColumnKind = 'text' | 'numeric' | 'integer' | 'date' | 'boolean';

export interface ImportColumn {
  name: string;
  kind: ColumnKind;
}

export interface ImportTypeConfig {
  id: string;
  label: string;
  table: string;
  /** Colunas (nomes de sistema) que formam a chave lógica de upsert nesta tabela. */
  keyColumns: string[];
  /** Todas as colunas de valor esperadas (inclui as de chave, exceto data_referencia em tipos snapshot). */
  columns: ImportColumn[];
  /** true = indicador diário/estado-no-tempo; false = cadastro ou fato transacional com data própria. */
  snapshot: boolean;
  /**
   * true = a tabela tem colunas data_importacao/importacao_id (fatos
   * transacionais e indicadores snapshot). false = tabela de cadastro, que só
   * tem atualizado_em (DEFAULT now()) — ver server/upsert.ts. Padrão: true.
   */
  tracksImport?: boolean;
}

export const IMPORT_TYPE_CONFIGS: Record<string, ImportTypeConfig> = {
  vendas: {
    id: 'vendas',
    label: 'Vendas & Faturamento',
    table: 'vendas',
    keyColumns: ['numero_pedido'],
    snapshot: false,
    columns: [
      { name: 'numero_pedido', kind: 'text' },
      { name: 'data_emissao', kind: 'date' },
      { name: 'cod_cliente', kind: 'text' },
      { name: 'cod_vendedor', kind: 'text' },
      { name: 'valor_total', kind: 'numeric' },
    ],
  },
  metas: {
    id: 'metas',
    label: 'Metas Comerciais',
    table: 'metas_mensais',
    keyColumns: ['ano_mes', 'cod_vendedor', 'fabricante'],
    snapshot: false,
    columns: [
      { name: 'ano_mes', kind: 'text' },
      { name: 'cod_vendedor', kind: 'text' },
      { name: 'fabricante', kind: 'text' },
      { name: 'meta_faturamento', kind: 'numeric' },
      { name: 'meta_cobertura', kind: 'numeric' },
    ],
  },
  clientes: {
    id: 'clientes',
    label: 'Base de Clientes',
    table: 'clientes',
    keyColumns: ['cod_cliente'],
    snapshot: false,
    tracksImport: false,
    columns: [
      { name: 'cod_cliente', kind: 'text' },
      { name: 'razao_social', kind: 'text' },
      { name: 'cnpj', kind: 'text' },
      { name: 'cod_vendedor', kind: 'text' },
      { name: 'status', kind: 'text' },
      { name: 'e_rede', kind: 'boolean' },
    ],
  },
  vendedores: {
    id: 'vendedores',
    label: 'Vendedores',
    table: 'vendedores',
    keyColumns: ['cod_vendedor'],
    snapshot: false,
    tracksImport: false,
    columns: [
      { name: 'cod_vendedor', kind: 'text' },
      { name: 'nome', kind: 'text' },
      { name: 'email', kind: 'text' },
      { name: 'equipe', kind: 'text' },
    ],
  },
  equipes: {
    id: 'equipes',
    label: 'Equipes Comerciais',
    table: 'equipes',
    keyColumns: ['nome_equipe'],
    snapshot: false,
    tracksImport: false,
    columns: [
      { name: 'nome_equipe', kind: 'text' },
      { name: 'supervisor', kind: 'text' },
      { name: 'gerencia', kind: 'text' },
    ],
  },
  supervisores: {
    id: 'supervisores',
    label: 'Supervisores',
    table: 'supervisores',
    keyColumns: ['nome_supervisor'],
    snapshot: false,
    tracksImport: false,
    columns: [
      { name: 'nome_supervisor', kind: 'text' },
      { name: 'gerencia', kind: 'text' },
      { name: 'email', kind: 'text' },
    ],
  },
  gerencias: {
    id: 'gerencias',
    label: 'Gerências',
    table: 'gerencias',
    keyColumns: ['codigo_gerencia'],
    snapshot: false,
    tracksImport: false,
    columns: [
      { name: 'codigo_gerencia', kind: 'text' },
      { name: 'nome_gerencia', kind: 'text' },
    ],
  },
  fabricantes: {
    id: 'fabricantes',
    label: 'Fabricantes / Indústrias',
    table: 'fabricantes',
    keyColumns: ['nome_fabricante'],
    snapshot: false,
    tracksImport: false,
    columns: [
      { name: 'nome_fabricante', kind: 'text' },
      { name: 'razao_social', kind: 'text' },
      { name: 'cnpj', kind: 'text' },
    ],
  },
  categorias: {
    id: 'categorias',
    label: 'Categorias de Produtos',
    table: 'categorias',
    keyColumns: ['cod_categoria'],
    snapshot: false,
    tracksImport: false,
    columns: [
      { name: 'cod_categoria', kind: 'text' },
      { name: 'nome_categoria', kind: 'text' },
      { name: 'fabricante', kind: 'text' },
    ],
  },
  produtos: {
    id: 'produtos',
    label: 'Produtos / Sortimentos',
    table: 'produtos',
    keyColumns: ['cod_produto'],
    snapshot: false,
    tracksImport: false,
    columns: [
      { name: 'cod_produto', kind: 'text' },
      { name: 'descricao', kind: 'text' },
      { name: 'fabricante', kind: 'text' },
      { name: 'categoria', kind: 'text' },
      { name: 'preco_tabela', kind: 'numeric' },
    ],
  },
  visitas: {
    id: 'visitas',
    label: 'Roteiros de Visitas & Positivação',
    table: 'visitas',
    keyColumns: ['cod_cliente', 'cod_vendedor', 'data_visita'],
    snapshot: false,
    columns: [
      { name: 'cod_cliente', kind: 'text' },
      { name: 'cod_vendedor', kind: 'text' },
      { name: 'data_visita', kind: 'date' },
      { name: 'status_visita', kind: 'text' },
    ],
  },

  // ---- Indicadores diários (snapshot) — cobrem as abas Mês / Categorias / Positivação ----

  indicadores_vendedor: {
    id: 'indicadores_vendedor',
    label: 'Indicadores Diários do Vendedor (aba "Mês")',
    table: 'indicadores_vendedor',
    keyColumns: ['data_referencia', 'cod_vendedor'],
    snapshot: true,
    columns: [
      { name: 'cod_vendedor', kind: 'text' },
      { name: 'gerencia', kind: 'text' },
      { name: 'nome_vendedor', kind: 'text' },
      { name: 'meta_faturamento', kind: 'numeric' },
      { name: 'realizado_faturamento', kind: 'numeric' },
      { name: 'meta_cobertura', kind: 'numeric' },
      { name: 'realizado_cobertura', kind: 'numeric' },
      { name: 'meta_sortimento', kind: 'numeric' },
      { name: 'realizado_sortimento', kind: 'numeric' },
      { name: 'pct_margem', kind: 'numeric' },
    ],
  },
  indicadores_fabricante: {
    id: 'indicadores_fabricante',
    label: 'Indicadores Diários por Fabricante (aba "Categorias")',
    table: 'indicadores_fabricante',
    keyColumns: ['data_referencia', 'cod_vendedor', 'fabricante'],
    snapshot: true,
    columns: [
      { name: 'cod_vendedor', kind: 'text' },
      { name: 'fabricante', kind: 'text' },
      { name: 'gerencia', kind: 'text' },
      { name: 'equipe', kind: 'text' },
      { name: 'meta', kind: 'numeric' },
      { name: 'realizado', kind: 'numeric' },
      { name: 'cobertura', kind: 'numeric' },
      { name: 'realizado_cobertura', kind: 'numeric' },
      { name: 'pct_margem', kind: 'numeric' },
    ],
  },
  indicadores_positivacao: {
    id: 'indicadores_positivacao',
    label: 'Indicadores Diários de Positivação (aba "Positivação")',
    table: 'indicadores_positivacao',
    keyColumns: ['data_referencia', 'cod_vendedor'],
    snapshot: true,
    columns: [
      { name: 'cod_vendedor', kind: 'text' },
      { name: 'equipe', kind: 'text' },
      { name: 'visitas_previstas', kind: 'integer' },
      { name: 'visitas_realizadas', kind: 'integer' },
      { name: 'vendas_previstas', kind: 'integer' },
      { name: 'vendas_realizadas', kind: 'integer' },
      { name: 'fora_de_rota', kind: 'integer' },
      { name: 'gps_ok', kind: 'integer' },
      { name: 'pedidos', kind: 'integer' },
      { name: 'apontamentos', kind: 'integer' },
    ],
  },

  // ---- Tela de Importação (novos tipos) ----
  // Cada entrada abaixo corresponde a uma "aba" configurada em
  // src/pages/admin/Importacao.tsx. Tipos com mais de uma aba obrigatória
  // enviam um POST por aba, com tipo = "<id-do-tipo>__<chave-da-aba>".

  sortimento: {
    id: 'sortimento',
    label: 'Lista de Sortimento',
    table: 'sortimento',
    keyColumns: ['cod_produto'],
    snapshot: false,
    tracksImport: false,
    columns: [
      { name: 'cod_produto', kind: 'text' },
      { name: 'produto', kind: 'text' },
      { name: 'fabricante', kind: 'text' },
      { name: 'categoria', kind: 'text' },
      { name: 'linha', kind: 'text' },
    ],
  },

  // Top Clientes — aba "top_20_clientes": ranking por vendedor/equipe/gerência
  top_clientes__top_20_clientes: {
    id: 'top_clientes__top_20_clientes',
    label: 'Top Clientes — Top 20 por Vendedor (aba "top_20_clientes")',
    table: 'top_20_clientes',
    keyColumns: ['data_referencia', 'cod_vendedor', 'cod_cliente'],
    snapshot: true,
    columns: [
      { name: 'nivel', kind: 'text' },
      { name: 'gerencia', kind: 'text' },
      { name: 'equipe', kind: 'text' },
      { name: 'cod_vendedor', kind: 'text' },
      { name: 'nome_vendedor', kind: 'text' },
      { name: 'pasta', kind: 'text' },
      { name: 'cod_cliente', kind: 'text' },
      { name: 'cliente_redes', kind: 'text' },
      { name: 'trimestre_25', kind: 'numeric' },
      { name: 'trimestre_26', kind: 'numeric' },
      { name: 'pct_cresc_trimestre', kind: 'numeric' },
      { name: 'mes_25', kind: 'numeric' },
      { name: 'mes_26', kind: 'numeric' },
      { name: 'pct_cresc_mes', kind: 'numeric' },
    ],
  },

  // Top Clientes — aba "top_clientes": venda total no mês por cliente
  top_clientes__top_clientes: {
    id: 'top_clientes__top_clientes',
    label: 'Top Clien-tes — Venda Total no Mês (aba "top_clientes")',
    table: 'top_clientes',
    keyColumns: ['data_referencia', 'cod_cliente'],
    snapshot: true,
    columns: [
      { name: 'cod_cliente', kind: 'text' },
      { name: 'cliente', kind: 'text' },
      { name: 'venda_total_mes', kind: 'numeric' },
    ],
  },

  // Dados App — reaproveita as mesmas tabelas dos indicadores diários +
  // campos extras da planilha (faseamento, desconcentração, desafio, etc.).
  dados_app__mes: {
    id: 'dados_app__mes',
    label: 'Dados App — Mês',
    table: 'indicadores_vendedor',
    keyColumns: ['data_referencia', 'cod_vendedor'],
    snapshot: true,
    columns: [
      { name: 'cod_vendedor', kind: 'text' },
      { name: 'gerencia', kind: 'text' },
      { name: 'nome_vendedor', kind: 'text' },
      { name: 'meta_faturamento', kind: 'numeric' },
      { name: 'realizado_faturamento', kind: 'numeric' },
      { name: 'meta_cobertura', kind: 'numeric' },
      { name: 'realizado_cobertura', kind: 'numeric' },
      { name: 'meta_sortimento', kind: 'numeric' },
      { name: 'realizado_sortimento', kind: 'numeric' },
      { name: 'pct_margem', kind: 'numeric' },
      { name: 'data_inicial_faseamento', kind: 'date' },
      { name: 'realizado_faseamento', kind: 'numeric' },
      { name: 'meta_faseamento', kind: 'numeric' },
      { name: 'realizado_faseamento_2', kind: 'numeric' },
      { name: 'data_inicial_desconcentracao', kind: 'date' },
      { name: 'data_final_desconcentracao', kind: 'date' },
      { name: 'meta_desconcentracao', kind: 'numeric' },
      { name: 'realizado_desconcentracao', kind: 'numeric' },
      { name: 'visitas_diaria', kind: 'integer' },
      { name: 'positivacao_diaria', kind: 'integer' },
      { name: 'fora_de_rota_diaria', kind: 'integer' },
      { name: 'visitas_acumulada', kind: 'integer' },
      { name: 'positivacao_acumulada', kind: 'integer' },
      { name: 'fora_de_rota_acumulada', kind: 'integer' },
      { name: 'data_inicial_faseamento_ii', kind: 'date' },
      { name: 'data_final_faseamento_ii', kind: 'date' },
      { name: 'meta_faseamento_ii', kind: 'numeric' },
      { name: 'realizado_faseamento_ii', kind: 'numeric' },
      { name: 'data_inicial_desafio', kind: 'date' },
      { name: 'data_final_desafio', kind: 'date' },
      { name: 'meta_desafio', kind: 'numeric' },
      { name: 'realizado_desafio', kind: 'numeric' },
    ],
  },
  dados_app__positivacao: {
    id: 'dados_app__positivacao',
    label: 'Dados App — Positivação',
    table: 'indicadores_positivacao',
    keyColumns: ['data_referencia', 'cod_vendedor'],
    snapshot: true,
    columns: [
      { name: 'cod_vendedor', kind: 'text' },
      { name: 'equipe', kind: 'text' },
      { name: 'visitas_previstas', kind: 'integer' },
      { name: 'visitas_realizadas', kind: 'integer' },
      { name: 'vendas_previstas', kind: 'integer' },
      { name: 'vendas_realizadas', kind: 'integer' },
      { name: 'fora_de_rota', kind: 'integer' },
      { name: 'gps_ok', kind: 'integer' },
      { name: 'pedidos', kind: 'integer' },
      { name: 'apontamentos', kind: 'integer' },
    ],
  },
  dados_app__categorias: {
    id: 'dados_app__categorias',
    label: 'Dados App — Categorias com Fórmulas',
    table: 'indicadores_fabricante',
    keyColumns: ['data_referencia', 'cod_vendedor', 'fabricante'],
    snapshot: true,
    columns: [
      { name: 'cod_vendedor', kind: 'text' },
      { name: 'fabricante', kind: 'text' },
      { name: 'gerencia', kind: 'text' },
      { name: 'equipe', kind: 'text' },
      { name: 'meta', kind: 'numeric' },
      { name: 'realizado', kind: 'numeric' },
      { name: 'cobertura', kind: 'numeric' },
      { name: 'realizado_cobertura', kind: 'numeric' },
      { name: 'pct_margem', kind: 'numeric' },
    ],
  },

  // Não Positivados — 3 bases (vendedor / equipe / Chok total)
  nao_positivados__por_vendedor: {
    id: 'nao_positivados__por_vendedor',
    label: 'Não Positivados — Por Vendedor',
    table: 'nao_positivados_vendedor',
    keyColumns: ['data_referencia', 'cod_vendedor', 'cod_cliente'],
    snapshot: true,
    columns: [
      { name: 'cod_vendedor', kind: 'text' },
      { name: 'vendedor', kind: 'text' },
      { name: 'cod_cliente', kind: 'text' },
      { name: 'cliente', kind: 'text' },
      { name: 'ultima_compra', kind: 'date' },
      { name: 'dias_sem_comprar', kind: 'integer' },
    ],
  },
  nao_positivados__equipe: {
    id: 'nao_positivados__equipe',
    label: 'Não Positivados — Equipe',
    table: 'nao_positivados_equipe',
    keyColumns: ['data_referencia', 'equipe', 'cod_cliente'],
    snapshot: true,
    columns: [
      { name: 'equipe', kind: 'text' },
      { name: 'cod_cliente', kind: 'text' },
      { name: 'cliente', kind: 'text' },
      { name: 'ultima_compra', kind: 'date' },
      { name: 'dias_sem_comprar', kind: 'integer' },
    ],
  },
  nao_positivados__chok_total: {
    id: 'nao_positivados__chok_total',
    label: 'Não Positivados — Chok Total',
    table: 'nao_positivados_chok_total',
    keyColumns: ['data_referencia', 'cod_cliente'],
    snapshot: true,
    columns: [
      { name: 'cod_cliente', kind: 'text' },
      { name: 'cliente', kind: 'text' },
      { name: 'ultima_compra', kind: 'date' },
      { name: 'dias_sem_comprar', kind: 'integer' },
    ],
  },
};

export function getImportTypeConfig(id: string): ImportTypeConfig | undefined {
  return IMPORT_TYPE_CONFIGS[id];
}
