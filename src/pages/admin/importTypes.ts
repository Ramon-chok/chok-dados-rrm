/**
 * Catálogo dos tipos de planilha aceitos na importação (tela "Dados e Exportações").
 *
 * Vivia dentro de src/pages/admin/Metas.tsx. Saiu para um módulo próprio porque
 * agora também é consumido pelo Histórico de Importações e pelo catálogo de
 * exportações (src/lib/exportCatalog.ts) — manter a configuração na tela criava
 * dependência circular entre eles.
 *
 * O `id` de cada tipo precisa bater com a chave em backend/app/import_types.py
 * (e no espelho server/importTypes.ts).
 */

export type ImportType =
  | 'metas'
  | 'sortimento'
  | 'verba_indenizatoria'
  | 'raiox'
  | 'base_roteiro';

export interface ImportSheetOption {
  /** Identificador interno da aba dentro do tipo de importação. */
  key: string;
  /**
   * Nome exato da aba dentro da planilha (comparação sem diferenciar
   * maiúsculas/minúsculas e espaços nas pontas). Vazio = usa a primeira
   * aba do arquivo, sem exigir um nome específico.
   */
  sheetName: string;
  label: string;
  /** Colunas esperadas na aba (usadas no mapeamento e na leitura do arquivo). */
  columns: string[];
  /**
   * Quando definido, restringe quais colunas aparecem no mapeamento e na
   * pré-visualização — as demais continuam sendo lidas e enviadas, apenas
   * ficam ocultas na tela.
   */
  visibleColumns?: string[];
  /**
   * Linha (1-based) onde fica o cabeçalho real dentro da aba — algumas
   * planilhas reais têm linhas de filtro/pivot antes do cabeçalho (ex.:
   * aba "top_clientes" do arquivo Top Clientes, cabeçalho na linha 4).
   * Padrão: 1 (primeira linha).
   */
  headerRow?: number;
  /**
   * Dica de correspondência coluna do sistema -> cabeçalho na planilha real
   * (quando o nome real usa acentos/pontuação/ordem diferente do nome de
   * sistema e o casamento automático por substring não funciona).
   *
   * Aceita uma lista de apelidos: o mesmo tipo de importação precisa casar
   * tanto com o modelo baixado nesta tela quanto com o arquivo que o sistema
   * de origem exporta (ex.: "CÓDIGO CLIENTE" no modelo e "SOLD cliente" no
   * relatório real). A comparação ignora acento, caixa e quebras de linha.
   */
  headerHints?: Record<string, string | string[]>;
  /**
   * Colunas sem as quais a linha é rejeitada pelo backend (chave lógica do
   * tipo em backend/app/import_types.py, menos data_referencia, que vem do
   * campo Data de Referência). A tela bloqueia o processamento enquanto
   * alguma delas estiver sem mapeamento, em vez de deixar o usuário enviar e
   * receber a planilha inteira rejeitada.
   */
  keyColumns?: string[];
}

export interface ImportTypeOption {
  id: ImportType;
  label: string;
  description: string;
  /** Caminho público (public/templates/importacao/) do modelo .xlsx pronto para download. */
  templateFile: string;
  sheets: ImportSheetOption[];
}

// Esta tela importa as metas/definições comerciais e as planilhas
// operacionais do SAR (Verba Indenizatória, Raio-X e Base de Roteiro). Os
// valores realizados do comercial NÃO são carregados por planilha: eles vêm
// das APIs externas (ver backend/app/providers.py) e são comparados contra as
// metas importadas aqui.
//
// Para acrescentar um novo conjunto, basta adicionar outro item neste array
// com as colunas da planilha — o assistente de importação é genérico e já
// lida com N abas. O `id` precisa bater com a chave do tipo em
// backend/app/import_types.py (e no espelho server/importTypes.ts).
export const IMPORT_TYPES: ImportTypeOption[] = [
  {
    id: 'metas',
    label: 'Metas Comerciais',
    description:
      'Meta de faturamento e de cobertura por vendedor, equipe e fabricante, com o mês de referência em ano_mes (formato AAAA-MM). Metas gerais (cobertura, sortimento, faseamento, desconcentração e desafio) são definidas na própria tela, em "Definir metas".',
    templateFile: '/templates/importacao/metas.xlsx',
    sheets: [
      {
        key: 'metas',
        // Vazio = usa a primeira aba do arquivo, sem exigir um nome específico.
        sheetName: '',
        label: 'Metas',
        // Nomes de sistema — devem bater com backend/app/import_types.py,
        // entrada "metas" (tabela metas_mensais).
        columns: ['ano_mes', 'cod_vendedor', 'equipe', 'fabricante', 'meta_faturamento', 'meta_cobertura'],
        keyColumns: ['ano_mes', 'cod_vendedor', 'fabricante'],
        headerHints: {
          ano_mes: 'ANO/MÊS',
          cod_vendedor: 'CÓDIGO VENDEDOR',
          equipe: ['EQUIPE', 'TIME'],
          // O cabeçalho agora é FABRICANTE; CATEGORIA continua aceito para
          // planilhas antigas não quebrarem na próxima importação.
          fabricante: ['FABRICANTE', 'INDÚSTRIA', 'CATEGORIA'],
          meta_faturamento: 'META FATURAMENTO',
          meta_cobertura: 'META COBERTURA',
        },
      },
    ],
  },
  {
    id: 'sortimento',
    label: 'Lista de Sortimento',
    description:
      'Produtos do sortimento (mix) por fabricante, categoria e linha. ATENÇÃO: cada envio SUBSTITUI a lista inteira — a planilha precisa trazer todos os itens vigentes, não só as novidades.',
    templateFile: '/templates/importacao/sortimento.xlsx',
    sheets: [
      {
        key: 'sortimento',
        // Vazio = usa a primeira aba do arquivo. A planilha de origem vem com
        // a aba chamada "Plan1", que é o padrão do Excel.
        sheetName: '',
        label: 'Sortimento',
        // Nomes de sistema — devem bater com backend/app/import_types.py,
        // entrada "sortimento" (tabela sortimento).
        columns: ['cod_produto', 'produto', 'fabricante', 'categoria', 'linha'],
        // O backend grava com replace_all_rows (apaga a tabela e regrava), e
        // o código do produto pode repetir entre linhas do mix. A chave aqui
        // serve só para exigir que a coluna esteja mapeada.
        keyColumns: ['cod_produto'],
        headerHints: {
          cod_produto: ['CÓDIGO', 'CODIGO', 'COD PRODUTO', 'CÓD. PRODUTO', 'SKU'],
          produto: ['PRODUTO', 'DESCRIÇÃO', 'DESCRICAO', 'ITEM'],
          fabricante: ['FABRICANTE', 'INDÚSTRIA', 'INDUSTRIA', 'MARCA'],
          categoria: ['CATEGORIA'],
          linha: ['LINHA', 'SUBCATEGORIA', 'SEGMENTO'],
        },
      },
    ],
  },
  {
    id: 'verba_indenizatoria',
    label: 'Verba Indenizatória',
    description:
      'Fechamento da verba de rota por vendedor: km total, verba, desconto, reembolso e o valor a pagar. Uma linha por vendedor no período informado na Data de Referência.',
    templateFile: '/templates/importacao/verba_indenizatoria.xlsx',
    sheets: [
      {
        key: 'verba_indenizatoria',
        // Vazio = usa a primeira aba do arquivo, sem exigir nome específico.
        sheetName: '',
        label: 'Verba Indenizatória',
        // Nomes de sistema — devem bater com backend/app/import_types.py,
        // entrada "verba_indenizatoria" (tabela verba_indenizatoria).
        columns: [
          'cod_vendedor',
          'vendedor',
          'equipe',
          'km_total',
          'verba_indenizatoria',
          'desconto',
          'reembolso',
          'a_pagar',
        ],
        keyColumns: ['cod_vendedor'],
        headerHints: {
          // Cada coluna aceita vários apelidos: o 1º é o do modelo baixado
          // aqui, os seguintes cobrem os nomes dos relatórios de origem.
          cod_vendedor: ['CÓDIGO VENDEDOR', 'CODIGO', 'CÓDIGO', 'COD VENDEDOR'],
          vendedor: ['NOME', 'VENDEDOR', 'COLABORADOR'],
          equipe: ['EQUIPE', 'SUPERVISÃO', 'SUPERVISAO'],
          km_total: ['KM TOTAL', 'KM RODADO', 'RODADO', 'KM'],
          verba_indenizatoria: ['VERBA INDENIZATÓRIA', 'VERBA INDENIZATORIA', 'VERBA'],
          desconto: ['DESCONTO', 'DESCONTOS'],
          reembolso: ['REEMBOLSO', 'REEMBOLSOS'],
          a_pagar: ['A PAGAR', 'TOTAL A PAGAR', 'VALOR A PAGAR'],
        },
      },
    ],
  },
  {
    id: 'raiox',
    label: 'Raio-X',
    description:
      'Raio-X fornecido pelo SAR para acompanhamento diário de vendedores (aba "Acompanhamento"). Alimenta a tela SAR › Raio-X.',
    templateFile: '/templates/importacao/raiox.xlsx',
    sheets: [
      {
        // key interna usada no payload (tipo = "raiox"). O nome da aba no
        // Excel continua sendo "Acompanhamento".
        key: 'raiox',
        // Preferência, não exigência: não achando esta aba, o assistente usa
        // a aba de dados do arquivo e avisa na tela (o relatório real vem com
        // a aba "RelatorioResumoTrabalhoDiario").
        sheetName: 'Acompanhamento',
        label: 'Acompanhamento',
        keyColumns: ['cod_vendedor'],

        // Nomes de sistema (devem bater com backend/app/import_types.py,
        // entrada "raiox"). A planilha real repete alguns rótulos de coluna
        // entre a seção diária e a seção "acumulado" (ex.: "% FORA ROTA" e
        // "% POSITIVAÇÃO") — por isso as colunas do acumulado usam nomes de
        // sistema próprios (…_acumulado) em vez de reaproveitar o mesmo nome
        // da seção diária, que faria as duas colidirem no mapeamento.
        columns: [
          'cod_vendedor',
          'vendedor',
          'equipe',

          'visitas_previstas',
          'visitas_realizadas',
          'visitas_fora_rota',
          'perc_gps',

          'apontamentos_inconsistencia',
          'positiva_prevista',
          'pedidos',
          'perc_positivacao',

          'fora_rota_positivacao',
          'perc_fora_rota',
          'produtividade',

          'hora_inicio',
          'hora_check_in',
          'hora_check_out',
          'hora_fim',
          'tempo_campo',

          'acumulado_prevista',
          'acumulado_realizadas',
          'acumulado_porcentagem',
          'acumulado_fora_rota',
          'perc_fora_rota_acumulado',

          'acumulado_positivacao_visitas',
          'acumulado_positivacao_pedidos',
          'perc_positivacao_acumulado',
          'acumulado_positivacao_fora_rota',
          'perc_positivacao_fora_rota',
        ],

        headerHints: {
          cod_vendedor: 'CODIGO',
          vendedor: 'VENDEDOR',
          equipe: 'EQUIPE',

          visitas_previstas: 'PREVISTA',
          visitas_realizadas: 'REALIZADA',
          visitas_fora_rota: 'FORA DE ROTA VISITAS',
          perc_gps: '% GPS',

          apontamentos_inconsistencia: 'APONTAMENTOS',
          // A planilha real repete "PREVISTA" (visitas e positivação) — o
          // parser desambigua a 2ª ocorrência com " (2)" (ver dedup de
          // cabeçalhos em handleFileChange), então o mesmo texto de dica
          // funciona para as duas, na ordem em que aparecem nas colunas.
          positiva_prevista: 'PREVISTA',
          pedidos: 'PEDIDOS',
          perc_positivacao: '% POSITIVAÇÃO',

          fora_rota_positivacao: 'FORA DE ROTA',
          perc_fora_rota: '% FORA ROTA',
          produtividade: 'PRODUTIVIDADE',

          hora_inicio: 'PRIMEIRO PONTO',
          hora_check_in: 'CHECK-IN',
          hora_check_out: 'CHECK-OUT',
          hora_fim: 'FIM',
          tempo_campo: 'T. EM CAMPO',

          acumulado_prevista: 'ACUMULADO PREVISTA',
          acumulado_realizadas: 'ACUMULADO REALIZADAS',
          acumulado_porcentagem: 'ACUMULADO PORCENTAGEM',
          acumulado_fora_rota: 'ACUMULADO FORA ROTA',
          perc_fora_rota_acumulado: '% FORA ROTA ACUMULADO',

          acumulado_positivacao_visitas: 'ACUMULADO VISITAS',
          acumulado_positivacao_pedidos: 'ACUMULADO PEDIDOS',
          // Mesmo texto real de "% POSITIVAÇÃO" repetido — desambiguado pelo
          // mesmo mecanismo de sufixo " (2)".
          perc_positivacao_acumulado: '% POSITIVAÇÃO',
          acumulado_positivacao_fora_rota: 'POSITIVACAO FORA ROTA',
          perc_positivacao_fora_rota: '% FORA ROTA POSITIVACAO',
        },
      },
    ],
  },
  {
    id: 'base_roteiro',
    label: 'Base de Roteiro',
    description:
      'Clientes roteirizados com latitude/longitude, dia (2=segunda … 6=sexta) e semana ("1", "2", "3", "4", "1,3", "2,4", "1234"). Alimenta o mapa da tela SAR › Base de Roteiro.',
    templateFile: '/templates/importacao/base_roteiro.xlsx',
    sheets: [
      {
        key: 'base_roteiro',
        // A aba de dados costuma ser a 1ª ("Roteiro" no modelo_roteiro, que
        // ainda traz uma aba "Instruções" depois dela).
        sheetName: '',
        label: 'Base de Roteiro',
        // Nomes de sistema — devem bater com backend/app/import_types.py,
        // entrada "base_roteiro" (tabela base_roteiro).
        columns: [
          'cod_cliente',
          'razao_social',
          'nome_fantasia',
          'cod_vendedor',
          'vendedor',
          'equipe',
          'municipio',
          'bairro',
          'endereco',
          'latitude',
          'longitude',
          'dia',
          'semana',
          'sequencia',
          'frequencia',
        ],
        // Só cliente e vendedor são obrigatórios. Nome do vendedor e equipe,
        // quando a planilha não traz (caso do modelo_roteiro), são resolvidos
        // pelo cadastro de vendedores na leitura (ver COALESCE em
        // /sar/base-roteiro).
        keyColumns: ['cod_cliente', 'cod_vendedor'],
        headerHints: {
          // "SOLD cliente"/"SOLD vendedor" são os nomes do relatório real de
          // roteirização; os demais apelidos cobrem o modelo baixado aqui.
          cod_cliente: ['CÓDIGO CLIENTE', 'SOLD cliente', 'COD CLIENTE', 'CÓDIGO DO PDV', 'CODIGO CLIENTE'],
          razao_social: ['RAZÃO SOCIAL', 'Nome do cliente', 'NOME DO PDV', 'CLIENTE'],
          nome_fantasia: ['NOME FANTASIA', 'FANTASIA'],
          // cod_vendedor vem antes de vendedor na lista de colunas acima: o
          // auto-match consome o cabeçalho encontrado, então "CÓDIGO
          // VENDEDOR" sai de circulação antes de a dica "VENDEDOR" procurar
          // correspondência parcial.
          cod_vendedor: ['CÓDIGO VENDEDOR', 'SOLD vendedor', 'COD VENDEDOR', 'CODIGO VENDEDOR'],
          vendedor: ['VENDEDOR', 'Nome do Colaborador', 'COLABORADOR'],
          equipe: ['EQUIPE', 'SUPERVISÃO', 'REGIONAL'],
          municipio: ['MUNICÍPIO', 'Cidade', 'MUNICIPIO'],
          bairro: ['BAIRRO'],
          endereco: ['ENDEREÇO', 'ENDERECO', 'LOGRADOURO'],
          latitude: ['LATITUDE', 'LAT'],
          longitude: ['LONGITUDE', 'LONG', 'LNG'],
          dia: ['DIA', 'DIA DA SEMANA', 'DIA VISITA'],
          semana: ['SEMANA'],
          sequencia: ['SEQUÊNCIA', 'SEQUENCIA', 'SEQ', 'ORDEM'],
          frequencia: ['FREQUÊNCIA', 'FREQUENCIA', 'PERIODICIDADE'],
        },
      },
    ],
  },
];

// Tipos compostos (Top Clientes, Dados App, Não Positivados) enviam um POST
// por aba com tipo = "<id-do-tipo>__<chave-da-aba>" — aqui resolvemos de volta
// para "Rótulo do Tipo — Rótulo da Aba" ao exibir o histórico.
export function labelForTipo(tipo: string): string {
  const [baseId, sheetKey] = tipo.split('__');
  const typeCfg = IMPORT_TYPES.find((t) => t.id === baseId);
  if (!typeCfg) return tipo;
  if (!sheetKey) return typeCfg.label;
  const sheetCfg = typeCfg.sheets.find((s) => s.key === sheetKey);
  return sheetCfg ? `${typeCfg.label} — ${sheetCfg.label}` : typeCfg.label;
}
