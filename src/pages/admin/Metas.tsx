import React, { useState } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import {
  Upload,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  RotateCcw,
  Download,
  Clock,
  FileCheck,
  ChevronRight,
  Calendar,
  XCircle,
  Layers,
  Trash2,
  Loader2,
  ShieldCheck,
  Split,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import {
  getErrorMessage,
  submitImportChunked,
  ApiError,
  IMPORT_CHUNK_SIZE,
} from '../../lib/api';

interface ImportProgressState {
  sheetLabel: string;
  sheetIndex: number;
  sheetTotal: number;
  chunkIndex: number;
  totalChunks: number;
  rowsDone: number;
  rowsTotal: number;
  percent: number;
  phase: 'preparing' | 'uploading' | 'finishing';
}

export type ImportType = 'metas' | 'verba_indenizatoria' | 'raiox' | 'base_roteiro';

interface ImportSheetOption {
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

interface ImportTypeOption {
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
const IMPORT_TYPES: ImportTypeOption[] = [
  {
    id: 'metas',
    label: 'Metas Comerciais',
    description:
      'Meta de faturamento e de cobertura por vendedor e categoria, com o mês de referência em ano_mes (formato AAAA-MM).',
    templateFile: '/templates/importacao/metas.xlsx',
    sheets: [
      {
        key: 'metas',
        // Vazio = usa a primeira aba do arquivo, sem exigir um nome específico.
        sheetName: '',
        label: 'Metas',
        // Nomes de sistema — devem bater com backend/app/import_types.py,
        // entrada "metas" (tabela metas_mensais).
        columns: ['ano_mes', 'cod_vendedor', 'fabricante', 'meta_faturamento', 'meta_cobertura'],
        keyColumns: ['ano_mes', 'cod_vendedor', 'fabricante'],
        headerHints: {
          ano_mes: 'ANO/MÊS',
          cod_vendedor: 'CÓDIGO VENDEDOR',
          fabricante: 'CATEGORIA',
          meta_faturamento: 'META FATURAMENTO',
          meta_cobertura: 'META COBERTURA',
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

type SheetParsedData = {
  headers: string[];
  rows: Record<string, any>[];
  /** Nome da aba realmente usada no arquivo (pode não ser a esperada). */
  sheetNameUsado: string;
  /** Linha (1-based) onde o cabeçalho foi encontrado. */
  headerRowUsado: number;
  /** true = a aba esperada não existia e caiu numa alternativa. */
  sheetSubstituida: boolean;
};

/**
 * Normaliza um texto de cabeçalho para comparação: tira acentos, colapsa
 * espaços/quebras de linha e passa para minúsculas.
 *
 * Relatórios reais trazem quebra de linha DENTRO do título da coluna (ex.:
 * "Rodado\nRoteiro", "Previsto \nInicial" no RelatorioResumoTrabalhoDiario),
 * então comparar o texto cru nunca casa com a dica configurada.
 */
function normalizeHeader(value: unknown): string {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

/**
 * Estado do mapeamento de uma aba: o que ficou sem cabeçalho de origem e,
 * dentro disso, quais são colunas de chave (que fariam o backend rejeitar
 * TODAS as linhas).
 */
function diagnosticarMapeamento(
  sheetCfg: ImportSheetOption,
  mapping: Record<string, string>
): { mapeadas: number; total: number; semMapeamento: string[]; chavesFaltando: string[] } {
  const cols = sheetCfg.columns;
  const semMapeamento = cols.filter((c) => !mapping[c]);
  const chaves = sheetCfg.keyColumns ?? [];
  return {
    mapeadas: cols.length - semMapeamento.length,
    total: cols.length,
    semMapeamento,
    chavesFaltando: chaves.filter((c) => !mapping[c]),
  };
}

/** Limpa o texto do cabeçalho preservando a grafia (só colapsa espaços/\n). */
function cleanHeader(value: unknown): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

/** Quantas linhas abaixo do topo procurar o cabeçalho verdadeiro. */
const HEADER_SCAN_DEPTH = 25;

/**
 * A aba com mais linhas preenchidas — usada quando o nome esperado não existe
 * no arquivo. Arquivos reais costumam ter a aba de dados e outras de apoio
 * ("Instruções", "Capa"), e a de dados é sempre a maior.
 */
function escolherAbaComMaisLinhas(wb: XLSX.WorkBook): string | undefined {
  let melhor: string | undefined;
  let maior = -1;
  wb.SheetNames.forEach((n) => {
    const ref = wb.Sheets[n]?.['!ref'];
    if (!ref) return;
    const range = XLSX.utils.decode_range(ref);
    const linhas = range.e.r - range.s.r;
    if (linhas > maior) {
      maior = linhas;
      melhor = n;
    }
  });
  return melhor ?? wb.SheetNames[0];
}

/**
 * Descobre em que linha está o cabeçalho de verdade.
 *
 * Planilhas de sistema quase nunca começam na linha 1: o
 * RelatorioResumoTrabalhoDiario.xls tem 9 linhas de título/filtro e só então o
 * cabeçalho. Em vez de exigir que o usuário conte linhas, pontuamos as
 * primeiras linhas pelo número de colunas esperadas que aparecem nelas e
 * escolhemos a melhor; empate ou nenhuma correspondência cai na primeira
 * linha que tiver pelo menos duas células preenchidas.
 */
function detectHeaderRow(data: any[][], sheetCfg: ImportSheetOption): number {
  // headerRow explícito na configuração manda — é informação de quem conhece
  // a planilha, não um palpite.
  if (sheetCfg.headerRow) return sheetCfg.headerRow;

  const esperados = new Set<string>();
  sheetCfg.columns.forEach((c) => {
    esperados.add(normalizeHeader(c));
    const hint = sheetCfg.headerHints?.[c];
    if (hint) esperados.add(normalizeHeader(hint));
  });

  let melhorLinha = 0;
  let melhorNota = 0;
  const limite = Math.min(data.length, HEADER_SCAN_DEPTH);

  for (let i = 0; i < limite; i++) {
    const row = data[i] || [];
    const celulas = Array.from(row, (c) => normalizeHeader(c)).filter((c) => c !== '');
    if (celulas.length < 2) continue;
    // Conta quantas células casam (igual ou contida) com algo esperado.
    let nota = 0;
    celulas.forEach((cel) => {
      for (const esp of esperados) {
        if (cel === esp || cel.includes(esp) || esp.includes(cel)) {
          nota++;
          break;
        }
      }
    });
    if (nota > melhorNota) {
      melhorNota = nota;
      melhorLinha = i;
    }
  }

  if (melhorNota >= 2) return melhorLinha + 1;

  // Nenhuma correspondência: usa a primeira linha "cheia" (ignora títulos
  // soltos de 1 célula), para o usuário ao menos conseguir mapear à mão.
  for (let i = 0; i < limite; i++) {
    const celulas = Array.from(data[i] || [], (c) => cleanHeader(c)).filter((c) => c !== '');
    if (celulas.length >= 2) return i + 1;
  }
  return 1;
}

/**
 * Metas & Definições (apenas ADMIN).
 *
 * Única porta de entrada manual de dados do sistema: o administrador importa
 * as METAS/DEFINIÇÕES, e os valores realizados chegam pelas APIs externas
 * (ver backend/app/providers.py), que são comparadas contra estas metas nos
 * quadros de Vendas e Categorias.
 */
export const MetasPage: React.FC = () => {
  const { t } = useTheme();
  const { currentUser } = useAuth();

  const [step, setStep] = useState<number>(1);
  const [selectedType, setSelectedType] = useState<ImportType>('metas');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [sheetsData, setSheetsData] = useState<Record<string, SheetParsedData>>({});
  const [columnMappings, setColumnMappings] = useState<Record<string, Record<string, string>>>({});
  const [fileError, setFileError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [importProgress, setImportProgress] = useState<ImportProgressState | null>(null);
  const [resultSummary, setResultSummary] = useState<any | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  // Data que os dados REPRESENTAM (regra 10) — pode ser diferente do dia do
  // upload, por isso é sempre editável e nunca assumida silenciosamente.
  const [dataReferencia, setDataReferencia] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [useMacro, setUseMacro] = useState<boolean>(false);

  const currentTypeConfig = IMPORT_TYPES.find((item) => item.id === selectedType)!;
  const isMultiSheet = currentTypeConfig.sheets.length > 1;

  // Handle file selection (CSV/XLSX) — lê todas as abas exigidas pelo tipo
  // selecionado (uma única aba "livre" para tipos simples, ou N abas com
  // nome fixo para tipos compostos como Top Clientes / Dados App / Não Positivados).
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0]) return;
    const file = e.target.files[0];
    setUploadedFile(file);
    setFileError(null);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const buffer = evt.target?.result as ArrayBuffer;
        const wb = XLSX.read(buffer, { type: 'array' });

        const newSheetsData: Record<string, SheetParsedData> = {};
        const newMappings: Record<string, Record<string, string>> = {};
        const missingSheets: string[] = [];

        currentTypeConfig.sheets.forEach((sheetCfg) => {
          // Escolha da aba, do mais específico para o mais tolerante. Antes,
          // não achar a aba com o nome exato era erro fatal e o upload morria
          // ali — o arquivo real do SAR tem a aba
          // "RelatorioResumoTrabalhoDiario", não "Acompanhamento". Agora o
          // nome é só uma preferência: não achando, usa uma alternativa e
          // avisa, deixando o usuário trocar a aba na tela.
          let wsName: string | undefined;
          let substituida = false;

          if (!sheetCfg.sheetName) {
            wsName = wb.SheetNames[0];
          } else {
            const alvo = normalizeHeader(sheetCfg.sheetName);
            wsName =
              wb.SheetNames.find((n) => normalizeHeader(n) === alvo) ||
              wb.SheetNames.find((n) => normalizeHeader(n).includes(alvo)) ||
              wb.SheetNames.find((n) => alvo.includes(normalizeHeader(n)));
            if (!wsName) {
              // Última tentativa: a aba com mais linhas é quase sempre a de
              // dados (as outras são "Instruções", "Capa", etc.).
              wsName = escolherAbaComMaisLinhas(wb);
              substituida = !!wsName;
            }
          }

          if (!wsName) {
            missingSheets.push(sheetCfg.sheetName || sheetCfg.label);
            return;
          }

          const ws = wb.Sheets[wsName];
          const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
          if (!data || data.length === 0) {
            missingSheets.push(sheetCfg.sheetName || sheetCfg.label);
            return;
          }

          // Algumas planilhas reais têm linhas de filtro/pivot/título antes do
          // cabeçalho de verdade (a aba "top_clientes" do Top Clientes começa
          // na linha 4; o RelatorioResumoTrabalhoDiario.xls, na linha 10).
          // headerRow na configuração manda; sem ele, detectHeaderRow acha.
          const headerRowNum = detectHeaderRow(data, sheetCfg);
          const headerRowIdx = headerRowNum - 1;
          // Array.from (em vez de .map) é essencial aqui: quando a linha de
          // cabeçalho tem células totalmente vazias no meio, o SheetJS
          // devolve um array esparso (buracos reais, não `undefined`). Como
          // .map() pula buracos e os preserva no resultado, os "headers" mais
          // abaixo ficariam com posições undefined — e o .find() usado no
          // auto-match (que NÃO pula buracos) quebraria ao chamar
          // .toLowerCase() nesse undefined. Array.from materializa os
          // buracos como undefined "de verdade", que o map interno then trata.
          // cleanHeader (e não String().trim()): o cabeçalho real pode ter
          // quebra de linha no meio do título ("Rodado\nRoteiro"), que viraria
          // um nome impossível de casar e feio no <select> do mapeamento.
          const rawHeaders = Array.from(data[headerRowIdx] || [], (h: any) => cleanHeader(h));

          // A mesma planilha real pode repetir um nome de coluna (ex.: duas
          // colunas "% Cresc."). Sem desambiguar, a segunda sobrescreveria a
          // primeira no objeto da linha — aqui cada repetição ganha um
          // sufixo " (2)", " (3)"... para continuar endereçável no mapeamento.
          const seenHeaderCount: Record<string, number> = {};
          const headers = rawHeaders.map((h, idx) => {
            const base = h || `Coluna_${idx}`;
            seenHeaderCount[base] = (seenHeaderCount[base] || 0) + 1;
            return seenHeaderCount[base] > 1 ? `${base} (${seenHeaderCount[base]})` : base;
          });

          const rowToObj = (row: any[]) => {
            const obj: Record<string, any> = {};
            headers.forEach((h: string, idx: number) => {
              obj[h] = row[idx] ?? '';
            });
            return obj;
          };

          // Todas as linhas de dados (usadas no envio real ao backend) —
          // ignora linhas totalmente em branco que o Excel às vezes deixa no final.
          const dataRows = data
            .slice(headerRowIdx + 1)
            .filter((row) => (row || []).some((cell) => cell !== undefined && cell !== ''));
          const parsedRows = dataRows.map(rowToObj);
          newSheetsData[sheetCfg.key] = {
            headers,
            rows: parsedRows,
            sheetNameUsado: wsName!,
            headerRowUsado: headerRowNum,
            sheetSubstituida: substituida,
          };

          // Auto match columns (inclui as ocultas — elas continuam sendo enviadas).
          // Tenta cada apelido de headerHints e, por último, o nome de sistema;
          // igualdade (normalizada: sem acento, sem caixa, espaços colapsados)
          // tem prioridade sobre correspondência parcial. Cabeçalhos já usados
          // não são reatribuídos (evita duas colunas de sistema apontarem para
          // o mesmo "Realizado Faseamento").
          const autoMap: Record<string, string> = {};
          const usedHeaders = new Set<string>();
          const takeMatch = (pred: (h: string) => boolean): string | undefined => {
            const hit = headers.find((h) => !usedHeaders.has(h) && pred(h));
            if (hit) usedHeaders.add(hit);
            return hit;
          };
          sheetCfg.columns.forEach((req) => {
            const hint = sheetCfg.headerHints?.[req];
            // headerHints aceita um apelido ou uma lista deles: o mesmo tipo
            // precisa casar tanto com o modelo baixado daqui quanto com o
            // arquivo que o sistema de origem exporta (ex.: "CÓDIGO CLIENTE"
            // no modelo e "SOLD cliente" no relatório real).
            const candidates = [...(Array.isArray(hint) ? hint : hint ? [hint] : []), req].map(
              (c) => normalizeHeader(c)
            );
            let matched: string | undefined;
            for (const cand of candidates) {
              matched = takeMatch((h) => normalizeHeader(h) === cand);
              if (matched) break;
            }
            if (!matched) {
              for (const cand of candidates) {
                matched = takeMatch((h) => normalizeHeader(h).includes(cand));
                if (matched) break;
              }
            }
            autoMap[req] = matched || '';
          });
          newMappings[sheetCfg.key] = autoMap;
        });

        if (missingSheets.length > 0) {
          setFileError(
            `Não foi possível localizar no arquivo a(s) aba(s) obrigatória(s): ${missingSheets
              .map((s) => `"${s}"`)
              .join(', ')}. Verifique o nome das abas na planilha e tente novamente.`
          );
          return;
        }

        setSheetsData(newSheetsData);
        setColumnMappings(newMappings);
        setStep(3);
      } catch {
        setFileError(
          'Não foi possível ler o arquivo selecionado. Verifique se é um Excel (.xlsx/.xls/.xlsm) ou CSV válido e se não está protegido por senha.'
        );
      }
    };
    reader.onerror = () => {
      setFileError('Não foi possível ler o arquivo selecionado. Tente novamente ou use outro arquivo.');
    };
    reader.readAsArrayBuffer(file);
  };

  const handleProcessImport = async () => {
    if (!dataReferencia) {
      setSubmitError('Informe a Data de Referência antes de processar a importação.');
      return;
    }
    const hasAnyRows = currentTypeConfig.sheets.some((s) => (sheetsData[s.key]?.rows.length || 0) > 0);
    if (!hasAnyRows) {
      setSubmitError('Nenhuma linha de dados encontrada no arquivo carregado.');
      return;
    }

    // Trava antes de enviar: sem a chave mapeada o backend rejeita 100% das
    // linhas e o usuário só descobre no fim, com a planilha toda recusada.
    const bloqueios = currentTypeConfig.sheets
      .filter((s) => (sheetsData[s.key]?.rows.length || 0) > 0)
      .map((s) => ({ s, diag: diagnosticarMapeamento(s, columnMappings[s.key] || {}) }))
      .filter(({ diag }) => diag.chavesFaltando.length > 0);

    if (bloqueios.length > 0) {
      const detalhe = bloqueios
        .map(({ s, diag }) =>
          isMultiSheet
            ? `[${s.label}] ${diag.chavesFaltando.join(', ')}`
            : diag.chavesFaltando.join(', ')
        )
        .join(' · ');
      setSubmitError(
        `Falta mapear coluna(s) obrigatória(s): ${detalhe}. ` +
          'Sem elas o sistema não consegue identificar a linha e rejeitaria o arquivo inteiro. ' +
          'Escolha o cabeçalho correspondente da sua planilha nos campos acima.'
      );
      return;
    }

    setIsProcessing(true);
    setSubmitError(null);
    setImportProgress({
      sheetLabel: 'Preparando lotes…',
      sheetIndex: 0,
      sheetTotal: currentTypeConfig.sheets.length,
      chunkIndex: 0,
      totalChunks: 1,
      rowsDone: 0,
      rowsTotal: 0,
      percent: 0,
      phase: 'preparing',
    });

    try {
      const combined = {
        totalAnalisados: 0,
        novos: 0,
        atualizados: 0,
        rejeitados: 0,
        erros: [] as { linha: number; motivo: string }[],
      };

      const sheetsWithData = currentTypeConfig.sheets.filter(
        (s) => (sheetsData[s.key]?.rows.length || 0) > 0
      );

      for (let sheetIdx = 0; sheetIdx < sheetsWithData.length; sheetIdx++) {
        const sheetCfg = sheetsWithData[sheetIdx];
        const sheetData = sheetsData[sheetCfg.key];
        if (!sheetData || sheetData.rows.length === 0) continue;

        const result = await submitImportChunked(
          {
            tipo: isMultiSheet ? `${selectedType}__${sheetCfg.key}` : selectedType,
            dataReferencia,
            arquivo: uploadedFile?.name,
            usuarioNome: currentUser?.name,
            usuarioEmail: currentUser?.email,
            mapping: columnMappings[sheetCfg.key] || {},
            useMacro,
            rows: sheetData.rows,
          },
          {
            sheetLabel: sheetCfg.label,
            chunkSize: IMPORT_CHUNK_SIZE,
            onProgress: (p) => {
              setImportProgress({
                sheetLabel: sheetCfg.label,
                sheetIndex: sheetIdx + 1,
                sheetTotal: sheetsWithData.length,
                chunkIndex: p.chunkIndex + 1,
                totalChunks: p.totalChunks,
                rowsDone: p.rowsDone,
                rowsTotal: p.rowsTotal,
                percent: p.percent,
                phase: p.percent >= 100 ? 'finishing' : 'uploading',
              });
            },
          }
        );

        combined.totalAnalisados += result.totalAnalisados;
        combined.novos += result.novos;
        combined.atualizados += result.atualizados;
        combined.rejeitados += result.rejeitados;
        combined.erros.push(
          ...result.erros.map((er) => ({
            linha: er.linha,
            motivo: isMultiSheet ? `[${sheetCfg.label}] ${er.motivo}` : er.motivo,
          }))
        );
      }

      setImportProgress((prev) =>
        prev
          ? {
              ...prev,
              percent: 100,
              phase: 'finishing',
              rowsDone: prev.rowsTotal,
            }
          : prev
      );

      setResultSummary({
        totalAnalysados: combined.totalAnalisados,
        validos: combined.totalAnalisados - combined.rejeitados,
        atualizados: combined.atualizados,
        novos: combined.novos,
        rejeitados: combined.rejeitados,
        tipoLabel: currentTypeConfig.label,
        arquivo: uploadedFile?.name || 'arquivo_importado.xlsx',
        erros: combined.erros,
      });
      setStep(4);
    } catch (err) {
      setSubmitError(
        err instanceof ApiError
          ? err.message
          : 'Falha inesperada ao comunicar com o servidor de importação. Nenhum dado foi gravado.'
      );
    } finally {
      setIsProcessing(false);
      setImportProgress(null);
    }
  };

  // Trocar o tipo descarta o arquivo já lido: sheetsData/columnMappings são
  // indexados pela chave da aba, que é própria de cada tipo — aproveitá-los
  // em outro tipo levaria a um mapeamento vazio no passo 3.
  const handleSelectType = (id: ImportType) => {
    if (id === selectedType) return;
    setSelectedType(id);
    setUploadedFile(null);
    setSheetsData({});
    setColumnMappings({});
    setFileError(null);
    setSubmitError(null);
    setResultSummary(null);
  };

  const resetWizard = () => {
    setStep(1);
    setUploadedFile(null);
    setSheetsData({});
    setColumnMappings({});
    setFileError(null);
    setResultSummary(null);
    setSubmitError(null);
    setImportProgress(null);
    setDataReferencia(new Date().toISOString().slice(0, 10));
  };

  return (
    <div style={{ position: 'relative' }}>
      {/* Overlay de progresso — importação fatiada em lotes seguros */}
      {isProcessing && importProgress && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Importação em andamento"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: 'rgba(8, 12, 24, 0.72)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
          }}
        >
          <div
            style={{
              width: 'min(520px, 100%)',
              background: t.surface,
              border: `1px solid ${t.border}`,
              borderRadius: '16px',
              padding: '28px 26px 24px',
              boxShadow: '0 24px 64px rgba(0,0,0,0.35)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '18px' }}>
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: '14px',
                  background: `${t.primary}18`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Loader2 size={26} color={t.primary} className="spin" style={{ animation: 'importSpin 0.9s linear infinite' }} />
              </div>
              <div>
                <div style={{ fontSize: '17px', fontWeight: 700, color: t.text, marginBottom: 2 }}>
                  Carregando importação…
                </div>
                <div style={{ fontSize: '12.5px', color: t.textSecondary }}>
                  {importProgress.phase === 'preparing'
                    ? 'Organizando lotes da planilha'
                    : importProgress.phase === 'finishing'
                      ? 'Finalizando gravação e auditoria'
                      : `Enviando aba "${importProgress.sheetLabel}"`}
                </div>
              </div>
            </div>

            <div
              style={{
                height: 10,
                borderRadius: 999,
                background: t.surfaceElevated,
                border: `1px solid ${t.border}`,
                overflow: 'hidden',
                marginBottom: 10,
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${Math.max(4, Math.min(100, importProgress.percent))}%`,
                  background: `linear-gradient(90deg, ${t.primary}, #ff6b6b)`,
                  borderRadius: 999,
                  transition: 'width 0.35s ease',
                }}
              />
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: 12,
                fontSize: '12px',
                color: t.textMuted,
                marginBottom: 16,
                flexWrap: 'wrap',
              }}
            >
              <span>
                Lote {importProgress.chunkIndex}/{importProgress.totalChunks}
                {importProgress.sheetTotal > 1
                  ? ` · Aba ${importProgress.sheetIndex}/${importProgress.sheetTotal}`
                  : ''}
              </span>
              <span className="num" style={{ fontWeight: 600, color: t.text }}>
                {importProgress.percent}%
                {importProgress.rowsTotal > 0
                  ? ` · ${importProgress.rowsDone.toLocaleString('pt-BR')}/${importProgress.rowsTotal.toLocaleString('pt-BR')} linhas`
                  : ''}
              </span>
            </div>

            <div
              style={{
                display: 'flex',
                gap: 10,
                alignItems: 'flex-start',
                background: `${t.primary}0D`,
                border: `1px solid ${t.border}`,
                borderRadius: 10,
                padding: '12px 14px',
                marginBottom: 10,
              }}
            >
              <Split size={16} color={t.primary} style={{ flexShrink: 0, marginTop: 1 }} />
              <div style={{ fontSize: '12.5px', color: t.textSecondary, lineHeight: 1.45 }}>
                A planilha está sendo <strong style={{ color: t.text }}>importada em partes</strong> (lotes de até{' '}
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                gap: 10,
                alignItems: 'flex-start',
                background: t.surfaceElevated,
                border: `1px solid ${t.border}`,
                borderRadius: 10,
                padding: '12px 14px',
              }}
            >
              <ShieldCheck size={16} color={t.primary} style={{ flexShrink: 0, marginTop: 1 }} />
              <div style={{ fontSize: '12.5px', color: t.textSecondary, lineHeight: 1.45 }}>
                Não feche esta aba até o fim do processo.
              </div>
            </div>

            <style>{`@keyframes importSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
          </div>
        </div>
      )}

      <div style={{ marginBottom: '22px' }}>
        <h1 className="num" style={{ margin: '0 0 6px', fontSize: '24px', fontWeight: 700, color: t.text }}>
          Metas &amp; Definições
        </h1>
        <p style={{ margin: 0, fontSize: '13px', color: t.textSecondary }}>
          Importe aqui as metas comerciais (faturamento e cobertura por vendedor e categoria) e as planilhas
          operacionais do SAR — Verba Indenizatória, Raio-X e Base de Roteiro. Os resultados realizados do comercial
          vêm das APIs integradas e são comparados automaticamente contra estas metas nos quadros de Vendas e
          Categorias. Planilhas grandes são enviadas em lotes seguros.
        </p>
      </div>

      {/* STEP INDICATOR */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          background: t.surface,
          border: `1px solid ${t.border}`,
          borderRadius: '12px',
          padding: '14px 20px',
          marginBottom: '24px',
          overflowX: 'auto',
        }}
      >
        {[
          { num: 1, label: 'Tipo de Dado' },
          { num: 2, label: 'Upload do Arquivo' },
          { num: 3, label: 'Mapeamento & Validação' },
          { num: 4, label: 'Resultado da Importação' },
        ].map((s, idx) => (
          <React.Fragment key={s.num}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                opacity: step >= s.num ? 1 : 0.45,
                whiteSpace: 'nowrap',
              }}
            >
              <div
                style={{
                  width: '26px',
                  height: '26px',
                  borderRadius: '50%',
                  background: step >= s.num ? t.primary : t.surfaceElevated,
                  color: step >= s.num ? '#fff' : t.textMuted,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '12.5px',
                  fontWeight: 700,
                }}
              >
                {step > s.num ? <CheckCircle2 size={16} /> : s.num}
              </div>
              <span style={{ fontSize: '13px', fontWeight: step === s.num ? 600 : 500, color: t.text }}>
                {s.label}
              </span>
            </div>
            {idx < 3 && <ChevronRight size={16} color={t.textMuted} style={{ flexShrink: 0 }} />}
          </React.Fragment>
        ))}
      </div>

      {/* STEP 1: Select Type */}
      {step === 1 && (
        <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: '12px', padding: '24px', marginBottom: '24px' }}>
          <div style={{ fontSize: '16px', fontWeight: 600, color: t.text, marginBottom: '6px' }}>
            Selecione o conjunto de dados que deseja importar:
          </div>
          <div style={{ fontSize: '13px', color: t.textMuted, marginBottom: '20px' }}>
            Cada conjunto possui um layout pré-definido com validação das colunas exigidas. Baixe o modelo para
            conferir o cabeçalho esperado antes de enviar.
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: '14px',
              marginBottom: '24px',
            }}
          >
            {IMPORT_TYPES.map((type) => {
              const isSel = selectedType === type.id;
              return (
                <div
                  key={type.id}
                  onClick={() => handleSelectType(type.id)}
                  style={{
                    border: `1.5px solid ${isSel ? t.primary : t.border}`,
                    background: isSel ? `${t.primary}0D` : t.surfaceElevated,
                    borderRadius: '10px',
                    padding: '16px',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <div style={{ fontSize: '14.5px', fontWeight: 600, color: isSel ? t.primary : t.text }}>
                      {type.label}
                    </div>
                    {isSel && <CheckCircle2 size={16} color={t.primary} />}
                  </div>
                  <div style={{ fontSize: '12.5px', color: t.textSecondary, lineHeight: 1.4 }}>
                    {type.description}
                  </div>
                  {type.sheets.length > 1 && (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px',
                        marginTop: '10px',
                        fontSize: '11px',
                        fontWeight: 600,
                        color: t.textMuted,
                      }}
                    >
                      <Layers size={12} />
                      <span>{type.sheets.length} abas obrigatórias</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              onClick={() => setStep(2)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 20px',
                borderRadius: '8px',
                border: 'none',
                background: t.primary,
                color: '#fff',
                fontSize: '13.5px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <span>Avançar para Upload</span>
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: Upload File */}
      {step === 2 && (
        <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: '12px', padding: '24px', marginBottom: '24px' }}>
          <div style={{ fontSize: '16px', fontWeight: 600, color: t.text, marginBottom: '4px' }}>
            Carregar arquivo para: <span style={{ color: t.primary }}>{currentTypeConfig.label}</span>
          </div>
          <div style={{ fontSize: '13px', color: t.textMuted, marginBottom: '14px' }}>
            Formatos aceitos: Microsoft Excel (.xlsx, .xls, .xlsm) ou Comma-Separated Values (.csv).
          </div>

          {currentTypeConfig.sheets.some((s) => s.sheetName) && (
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '8px',
                background: `${t.primary}0D`,
                border: `1px solid ${t.border}`,
                borderRadius: '8px',
                padding: '10px 14px',
                marginBottom: '16px',
                fontSize: '12.5px',
                color: t.textSecondary,
              }}
            >
              <Layers size={15} color={t.primary} style={{ flexShrink: 0, marginTop: '1px' }} />
              <span>
                Este arquivo deve conter a(s) aba(s):{' '}
                {currentTypeConfig.sheets
                  .filter((s) => s.sheetName)
                  .map((s) => (
                    <strong key={s.key} style={{ color: t.text }}>
                      "{s.sheetName}"{' '}
                    </strong>
                  ))}
                — o nome da aba precisa ser exatamente esse (maiúsculas/minúsculas não importam).
              </span>
            </div>
          )}

          <a
            href={currentTypeConfig.templateFile}
            download
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '9px 14px',
              borderRadius: '8px',
              border: `1px solid ${t.primary}`,
              background: `${t.primary}0D`,
              color: t.primary,
              fontSize: '12.5px',
              fontWeight: 600,
              textDecoration: 'none',
              marginBottom: '20px',
            }}
          >
            <Download size={15} />
            <span>Baixar modelo de planilha (.xlsx) para {currentTypeConfig.label}</span>
          </a>

          <div style={{ marginBottom: '20px', maxWidth: '320px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600, color: t.textSecondary, marginBottom: '6px' }}>
              <Calendar size={14} color={t.primary} />
              Data de Referência dos Dados
            </label>
            <input
              type="date"
              value={dataReferencia}
              onChange={(e) => setDataReferencia(e.target.value)}
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: '8px',
                border: `1px solid ${t.border}`,
                background: t.surfaceElevated,
                color: t.text,
                fontSize: '13px',
              }}
            />
            <div style={{ fontSize: '11.5px', color: t.textMuted, marginTop: '5px', lineHeight: 1.4 }}>
              Período que os dados representam — não precisa ser hoje. Ex.: um arquivo enviado dia 12 pode conter o
              fechamento do dia 11.
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, fontSize: '13px' }}>
              <input
                type="checkbox"
                checked={useMacro}
                onChange={(e) => setUseMacro(e.target.checked)}
              />
              <span style={{ color: t.text, fontWeight: 600 }}>Importar com macro</span>
              <span style={{ fontSize: '12px', color: t.textMuted, marginLeft: 8 }}>Preserve processamento especial da planilha (.xlsm)</span>
            </label>
          </div>

          {fileError && (
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '8px',
                background: 'rgba(227, 6, 19, 0.08)',
                border: '1px solid rgba(227, 6, 19, 0.25)',
                borderRadius: '8px',
                padding: '12px 14px',
                marginBottom: '20px',
                fontSize: '12.5px',
                color: t.text,
              }}
            >
              <XCircle size={16} color={t.primary} style={{ flexShrink: 0, marginTop: '1px' }} />
              <span>{fileError}</span>
            </div>
          )}

          <label
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              border: `2px dashed ${t.border}`,
              borderRadius: '12px',
              padding: '48px 24px',
              background: t.surfaceElevated,
              cursor: 'pointer',
              marginBottom: '20px',
              textAlign: 'center',
            }}
          >
            <Upload size={36} color={t.primary} style={{ marginBottom: '12px' }} />
            <div style={{ fontSize: '15px', fontWeight: 600, color: t.text, marginBottom: '4px' }}>
              Clique para selecionar ou arraste o arquivo aqui
            </div>
            <div style={{ fontSize: '12.5px', color: t.textMuted }}>
              Tamanho máximo recomendado: 50MB
            </div>
            <input
              type="file"
              accept=".csv,.xlsx,.xls,.xlsm"
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />
          </label>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button
              onClick={() => setStep(1)}
              style={{
                padding: '9px 16px',
                borderRadius: '8px',
                border: `1px solid ${t.border}`,
                background: t.surface,
                color: t.textSecondary,
                cursor: 'pointer',
                fontSize: '13px',
              }}
            >
              Voltar
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: Column Mapping & Preview */}
      {step === 3 && (
        <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: '12px', padding: '24px', marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <div style={{ fontSize: '16px', fontWeight: 600, color: t.text }}>
                Mapeamento de Colunas & Pré-visualização
              </div>
              <div style={{ fontSize: '12.5px', color: t.textMuted }}>
                Arquivo: <strong>{uploadedFile?.name}</strong> · Data de Referência:{' '}
                <strong>{new Date(dataReferencia + 'T00:00:00').toLocaleDateString('pt-BR')}</strong> · Mapeie as
                colunas do seu arquivo para o sistema
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => setStep(2)}
                style={{
                  padding: '8px 14px',
                  borderRadius: '8px',
                  border: `1px solid ${t.border}`,
                  background: t.surface,
                  color: t.textSecondary,
                  cursor: 'pointer',
                  fontSize: '13px',
                }}
              >
                Trocar Arquivo
              </button>
              <button
                onClick={handleProcessImport}
                disabled={isProcessing}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '9px 18px',
                  borderRadius: '8px',
                  border: 'none',
                  background: t.primary,
                  color: '#fff',
                  fontSize: '13.5px',
                  fontWeight: 600,
                  cursor: isProcessing ? 'not-allowed' : 'pointer',
                  opacity: isProcessing ? 0.7 : 1,
                }}
              >
                <FileCheck size={16} />
                <span>{isProcessing ? 'Processando Base...' : 'Validar e Processar Importação'}</span>
              </button>
            </div>
          </div>

          {submitError && (
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '8px',
                background: 'rgba(227, 6, 19, 0.08)',
                border: '1px solid rgba(227, 6, 19, 0.25)',
                borderRadius: '8px',
                padding: '12px 14px',
                marginBottom: '20px',
                fontSize: '12.5px',
                color: t.text,
              }}
            >
              <XCircle size={16} color={t.primary} style={{ flexShrink: 0, marginTop: '1px' }} />
              <span>{submitError}</span>
            </div>
          )}

          {currentTypeConfig.sheets.map((sheetCfg) => {
            const sheetData = sheetsData[sheetCfg.key];
            if (!sheetData) return null;

            const mapping = columnMappings[sheetCfg.key] || {};
            const displayCols = sheetCfg.visibleColumns ?? sheetCfg.columns;
            const previewRows = sheetData.rows.slice(0, 5);
            const visibleHeaders = Array.from(new Set(displayCols.map((c) => mapping[c]).filter(Boolean)));
            const diag = diagnosticarMapeamento(sheetCfg, mapping);

            return (
              <div key={sheetCfg.key} style={{ marginBottom: '28px' }}>
                {isMultiSheet && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '10px' }}>
                    <Layers size={15} color={t.primary} />
                    <span style={{ fontSize: '14px', fontWeight: 700, color: t.text }}>{sheetCfg.label}</span>
                    <span style={{ fontSize: '11.5px', color: t.textMuted }}>
                      (aba "{sheetCfg.sheetName || sheetData.headers[0]}")
                    </span>
                  </div>
                )}

                {/* DIAGNÓSTICO DA LEITURA: qual aba, qual linha de cabeçalho e
                    o que ficou sem mapear. Sem isso o usuário não tem como
                    saber por que a importação rejeitaria o arquivo. */}
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '8px 16px',
                    alignItems: 'center',
                    background: t.bgSecondary,
                    border: `1px solid ${t.border}`,
                    borderRadius: '10px',
                    padding: '10px 14px',
                    marginBottom: '12px',
                    fontSize: '12px',
                    color: t.textSecondary,
                  }}
                >
                  <span>
                    Aba lida: <strong style={{ color: t.text }}>"{sheetData.sheetNameUsado}"</strong>
                  </span>
                  <span>
                    Cabeçalho na linha <strong style={{ color: t.text }}>{sheetData.headerRowUsado}</strong>
                  </span>
                  <span>
                    Linhas de dados:{' '}
                    <strong style={{ color: t.text }}>{sheetData.rows.length.toLocaleString('pt-BR')}</strong>
                  </span>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 5,
                      fontWeight: 700,
                      color: diag.chavesFaltando.length > 0 ? t.primary : t.text,
                    }}
                  >
                    {diag.chavesFaltando.length > 0 ? <AlertTriangle size={13} /> : <CheckCircle2 size={13} />}
                    {diag.mapeadas}/{diag.total} colunas mapeadas
                  </span>
                </div>

                {sheetData.sheetSubstituida && (
                  <div
                    style={{
                      display: 'flex',
                      gap: '8px',
                      alignItems: 'flex-start',
                      background: 'rgba(234, 179, 8, 0.10)',
                      border: '1px solid rgba(234, 179, 8, 0.30)',
                      borderRadius: '8px',
                      padding: '10px 14px',
                      marginBottom: '12px',
                      fontSize: '12.5px',
                      color: t.text,
                    }}
                  >
                    <AlertTriangle size={15} color="#eab308" style={{ flexShrink: 0, marginTop: '1px' }} />
                    <span>
                      O arquivo não tem a aba <strong>"{sheetCfg.sheetName}"</strong>. Foi usada a aba{' '}
                      <strong>"{sheetData.sheetNameUsado}"</strong>, que é a que tem mais linhas. Confira a amostra
                      abaixo antes de processar.
                    </span>
                  </div>
                )}

                {diag.semMapeamento.length > 0 && (
                  <div
                    style={{
                      display: 'flex',
                      gap: '8px',
                      alignItems: 'flex-start',
                      background:
                        diag.chavesFaltando.length > 0 ? 'rgba(227, 6, 19, 0.08)' : 'rgba(234, 179, 8, 0.10)',
                      border: `1px solid ${
                        diag.chavesFaltando.length > 0 ? 'rgba(227, 6, 19, 0.25)' : 'rgba(234, 179, 8, 0.30)'
                      }`,
                      borderRadius: '8px',
                      padding: '10px 14px',
                      marginBottom: '12px',
                      fontSize: '12.5px',
                      color: t.text,
                      lineHeight: 1.5,
                    }}
                  >
                    <AlertTriangle
                      size={15}
                      color={diag.chavesFaltando.length > 0 ? t.primary : '#eab308'}
                      style={{ flexShrink: 0, marginTop: '1px' }}
                    />
                    <span>
                      {diag.chavesFaltando.length > 0 ? (
                        <>
                          <strong>Obrigatórias sem mapeamento: {diag.chavesFaltando.join(', ')}.</strong> Enquanto
                          faltarem, o processamento fica bloqueado — sem elas o arquivo inteiro seria rejeitado.{' '}
                        </>
                      ) : null}
                      Sem correspondência na sua planilha:{' '}
                      <strong>{diag.semMapeamento.join(', ')}</strong>. As que não existirem no seu arquivo podem
                      ficar em “— não mapear —”: entram vazias e não impedem a importação.
                    </span>
                  </div>
                )}

                {/* MAPPING CONTROLS */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
                    gap: '14px',
                    padding: '16px',
                    background: t.surfaceElevated,
                    borderRadius: '10px',
                    border: `1px solid ${t.border}`,
                    marginBottom: '16px',
                  }}
                >
                  {displayCols.map((req) => {
                    const ehChave = (sheetCfg.keyColumns ?? []).includes(req);
                    const semMapa = !mapping[req];
                    return (
                    <div key={req}>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: t.textSecondary, marginBottom: '6px' }}>
                        Coluna do Sistema: <span style={{ color: t.primary }}>{req}</span>
                        {ehChave && (
                          <span
                            title="Obrigatória: sem ela a linha é rejeitada"
                            style={{ color: t.primary, fontWeight: 700 }}
                          >
                            {' '}*
                          </span>
                        )}
                      </label>
                      <select
                        value={mapping[req] || ''}
                        onChange={(e) =>
                          setColumnMappings({
                            ...columnMappings,
                            [sheetCfg.key]: { ...mapping, [req]: e.target.value },
                          })
                        }
                        style={{
                          width: '100%',
                          padding: '8px 10px',
                          borderRadius: '6px',
                          // Realce quando falta a chave: é o que bloqueia o envio.
                          border: `1px solid ${semMapa && ehChave ? t.primary : t.border}`,
                          background: semMapa && ehChave ? `${t.primary}0D` : t.surface,
                          color: semMapa ? t.textMuted : t.text,
                          fontSize: '13px',
                        }}
                      >
                        {/* A opção vazia é essencial: sem ela, uma coluna que
                            o auto-match não encontrou (valor "") não casava
                            com nenhuma <option> e o navegador exibia o 1º
                            cabeçalho, fazendo parecer mapeada — e não havia
                            como desmapear de propósito. */}
                        <option value="">— não mapear —</option>
                        {sheetData.headers.map((col) => (
                          <option key={col} value={col}>
                            {col}
                          </option>
                        ))}
                      </select>
                    </div>
                    );
                  })}
                </div>

                {/* SAMPLE PREVIEW TABLE */}
                <div style={{ fontSize: '13.5px', fontWeight: 600, color: t.text, marginBottom: '10px' }}>
                  Amostra dos Dados (Primeiras Linhas):
                </div>
                <div style={{ overflowX: 'auto', border: `1px solid ${t.border}`, borderRadius: '8px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
                    <thead>
                      <tr style={{ background: t.surfaceElevated, color: t.textMuted }}>
                        {visibleHeaders.map((col) => (
                          <th key={col} style={{ textAlign: 'left', padding: '10px 12px', borderBottom: `1px solid ${t.border}` }}>
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {previewRows.map((row, idx) => (
                        <tr key={idx} style={{ borderBottom: `1px solid ${t.border}` }}>
                          {visibleHeaders.map((col) => (
                            <td key={col} style={{ padding: '8px 12px', color: t.textSecondary }}>
                              {String(row[col] ?? '')}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* STEP 4: Summary Result (Requirements 39, 40) */}
      {step === 4 && resultSummary && (
        <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: '12px', padding: '24px', marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
            <CheckCircle2 size={24} color="#3DD68C" />
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: t.text }}>
              Importação Processada com Sucesso
            </h2>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
              gap: '14px',
              marginBottom: '24px',
            }}
          >
            <div style={{ background: t.surfaceElevated, padding: '14px', borderRadius: '8px', border: `1px solid ${t.border}` }}>
              <div style={{ fontSize: '12px', color: t.textMuted, marginBottom: '4px' }}>Analisados</div>
              <div className="num" style={{ fontSize: '20px', fontWeight: 700, color: t.text }}>
                {resultSummary.totalAnalysados.toLocaleString('pt-BR')}
              </div>
            </div>

            <div style={{ background: t.surfaceElevated, padding: '14px', borderRadius: '8px', border: `1px solid ${t.border}` }}>
              <div style={{ fontSize: '12px', color: t.textMuted, marginBottom: '4px' }}>Válidos</div>
              <div className="num" style={{ fontSize: '20px', fontWeight: 700, color: '#3DD68C' }}>
                {resultSummary.validos.toLocaleString('pt-BR')}
              </div>
            </div>

            <div style={{ background: t.surfaceElevated, padding: '14px', borderRadius: '8px', border: `1px solid ${t.border}` }}>
              <div style={{ fontSize: '12px', color: t.textMuted, marginBottom: '4px' }}>Atualizados</div>
              <div className="num" style={{ fontSize: '20px', fontWeight: 700, color: t.text }}>
                {resultSummary.atualizados.toLocaleString('pt-BR')}
              </div>
            </div>

            <div style={{ background: t.surfaceElevated, padding: '14px', borderRadius: '8px', border: `1px solid ${t.border}` }}>
              <div style={{ fontSize: '12px', color: t.textMuted, marginBottom: '4px' }}>Novos Inseridos</div>
              <div className="num" style={{ fontSize: '20px', fontWeight: 700, color: '#3DD68C' }}>
                {resultSummary.novos.toLocaleString('pt-BR')}
              </div>
            </div>

            <div style={{ background: t.surfaceElevated, padding: '14px', borderRadius: '8px', border: `1px solid ${t.border}` }}>
              <div style={{ fontSize: '12px', color: t.textMuted, marginBottom: '4px' }}>Inconsistentes</div>
              <div className="num" style={{ fontSize: '20px', fontWeight: 700, color: t.primaryHover }}>
                {resultSummary.rejeitados}
              </div>
            </div>
          </div>

          {resultSummary.erros && resultSummary.erros.length > 0 && (
            <div style={{ marginBottom: '24px' }}>
              <div style={{ fontSize: '14px', fontWeight: 600, color: t.text, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <AlertTriangle size={16} color={t.primaryHover} />
                <span>Registros com Avisos ou Rejeitados:</span>
              </div>
              <div style={{ background: 'rgba(227, 6, 19, 0.05)', border: '1px solid rgba(227, 6, 19, 0.2)', borderRadius: '8px', padding: '12px' }}>
                {resultSummary.erros.map((err: any, i: number) => (
                  <div key={i} style={{ fontSize: '12.5px', color: t.text, marginBottom: '4px' }}>
                    • Linha <strong>#{err.linha}</strong>: {err.motivo}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button
              onClick={resetWizard}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '9px 18px',
                borderRadius: '8px',
                border: `1px solid ${t.border}`,
                background: t.surfaceElevated,
                color: t.text,
                fontSize: '13.5px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <RotateCcw size={15} />
              <span>Realizar Nova Importação</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
