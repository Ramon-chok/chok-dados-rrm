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

export type ColumnKind = 'text' | 'numeric' | 'integer' | 'date';

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
};

export function getImportTypeConfig(id: string): ImportTypeConfig | undefined {
  return IMPORT_TYPE_CONFIGS[id];
}
