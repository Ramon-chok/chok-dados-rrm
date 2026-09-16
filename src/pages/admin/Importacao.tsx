import React, { useState, useEffect } from 'react';
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
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { submitImport, fetchImportHistory, ImportLogEntry, ApiError } from '../../lib/api';

export type ImportType = 'sortimento' | 'top_clientes' | 'dados_app' | 'nao_positivados';

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
   * Dica de correspondência coluna do sistema -> nome exato do cabeçalho na
   * planilha real (quando o nome real usa acentos/pontuação/ordem diferente
   * do nome de sistema e o casamento automático por substring não funciona).
   */
  headerHints?: Record<string, string>;
}

interface ImportTypeOption {
  id: ImportType;
  label: string;
  description: string;
  /** Caminho público (public/templates/importacao/) do modelo .xlsx pronto para download. */
  templateFile: string;
  sheets: ImportSheetOption[];
}

const IMPORT_TYPES: ImportTypeOption[] = [
  {
    id: 'sortimento',
    label: 'Lista de Sortimento',
    description: 'Catálogo de produtos do sortimento: código, descrição, fornecedor e categoria',
    templateFile: '/templates/importacao/sortimento.xlsx',
    sheets: [
      {
        key: 'sortimento',
        sheetName: '',
        label: 'Sortimento',
        columns: ['cod_produto', 'descricao_produto', 'fornecedor', 'categoria'],
        headerHints: {
          cod_produto: 'CÓDIGO',
          descricao_produto: 'PRODUTO',
          fornecedor: 'FABRICANTE',
          categoria: 'CATEGORIA',
        },
      },
    ],
  },
  {
    id: 'top_clientes',
    label: 'Top Clientes',
    description:
      'Ranking de clientes por vendedor, equipe e gerência (aba "top_20_clientes") e venda total no mês por cliente (aba "top_clientes")',
    templateFile: '/templates/importacao/top_clientes.xlsx',
    sheets: [
      {
        key: 'top_20_clientes',
        sheetName: 'top_20_clientes',
        label: 'Top 20 Clientes (Vendedor / Equipe / Gerência)',
        columns: [
          'nivel',
          'gerencia',
          'equipe',
          'cod_vendedor',
          'nome_vendedor',
          'pasta',
          'cod_cliente',
          'cliente_redes',
          'trimestre_25',
          'trimestre_26',
          'pct_cresc_trimestre',
          'mes_25',
          'mes_26',
          'pct_cresc_mes',
        ],
        // Regra do negócio: nesta aba só ficam visíveis a coluna de
        // identificação do cliente (código ou Cliente/Redes) e as colunas
        // de trimestre, mês e percentual — o restante (nível, gerência,
        // equipe, vendedor, pasta) continua sendo lido, só não é exibido.
        visibleColumns: [
          'cod_cliente',
          'cliente_redes',
          'trimestre_25',
          'trimestre_26',
          'pct_cresc_trimestre',
          'mes_25',
          'mes_26',
          'pct_cresc_mes',
        ],
        headerHints: {
          nivel: 'Nível',
          gerencia: 'Gerências',
          equipe: 'Equipes',
          cod_vendedor: 'Cod',
          nome_vendedor: 'Vendedor',
          pasta: 'Pasta',
          cod_cliente: 'Cod cliente',
          cliente_redes: 'Cliente/Redes',
          trimestre_25: 'Trimestre 25',
          trimestre_26: 'Trimestre 26',
          pct_cresc_trimestre: '% Cresc.',
          // A planilha real repete "% Cresc." (trimestre e mês) — a 2ª
          // ocorrência é desambiguada para "% Cresc. (2)" na leitura (ver
          // dedup de cabeçalhos em handleFileChange).
          pct_cresc_mes: '% Cresc. (2)',
          // mes_25/mes_26: cabeçalho real é a própria data do mês (muda a
          // cada carga) — sem texto fixo para casar automaticamente, o
          // usuário escolhe manualmente no mapeamento.
        },
      },
      {
        key: 'top_clientes',
        sheetName: 'top_clientes',
        label: 'Top Clientes (Venda Total no Mês)',
        columns: ['cod_cliente', 'cliente', 'venda_total_mes'],
        // Na planilha real desta aba, as 3 primeiras linhas são filtros da
        // tabela dinâmica (tp_ped / dt_ped) — o cabeçalho de verdade só
        // aparece na linha 4.
        headerRow: 4,
        headerHints: {
          cod_cliente: 'cd_clien',
          cliente: 'razão social',
          venda_total_mes: 'Soma de vl_venda',
        },
      },
    ],
  },
  {
    id: 'dados_app',
    label: 'Dados App',
    description:
      'Indicadores consolidados do aplicativo: Mês (com fórmulas), Positivação e Categorias (com fórmulas)',
    templateFile: '/templates/importacao/dados_app.xlsx',
    sheets: [
      {
        key: 'mes',
        sheetName: 'Mês',
        label: 'Mês',
        // Nomes de sistema (devem bater com backend/app/import_types.py).
        // headerHints mapeia cada um para o cabeçalho real da planilha.
        columns: [
          'cod_vendedor',
          'gerencia',
          'nome_vendedor',
          'meta_faturamento',
          'realizado_faturamento',
          'meta_cobertura',
          'realizado_cobertura',
          'meta_sortimento',
          'realizado_sortimento',
          'pct_margem',
          'data_inicial_faseamento',
          'realizado_faseamento',
          'meta_faseamento',
          'realizado_faseamento_2',
          'data_inicial_desconcentracao',
          'data_final_desconcentracao',
          'meta_desconcentracao',
          'realizado_desconcentracao',
          'visitas_diaria',
          'positivacao_diaria',
          'fora_de_rota_diaria',
          'visitas_acumulada',
          'positivacao_acumulada',
          'fora_de_rota_acumulada',
          'data_inicial_faseamento_ii',
          'data_final_faseamento_ii',
          'meta_faseamento_ii',
          'realizado_faseamento_ii',
          'data_inicial_desafio',
          'data_final_desafio',
          'meta_desafio',
          'realizado_desafio',
        ],
        headerHints: {
          cod_vendedor: 'Vendedor',
          gerencia: 'Gerência',
          nome_vendedor: 'Nome Vendedor',
          meta_faturamento: 'Meta Faturamento',
          realizado_faturamento: 'Realizado Faturamento',
          meta_cobertura: 'Meta Cobertura',
          realizado_cobertura: 'Realizado Cobertura',
          meta_sortimento: 'Meta Sortimento',
          realizado_sortimento: 'Realizado Sortimento',
          pct_margem: '%Margem',
          data_inicial_faseamento: 'Data Inicial Faseamento',
          realizado_faseamento: 'Realizado Faseamento',
          meta_faseamento: 'Meta Faseamento',
          // Planilhas às vezes repetem o mesmo título; o parser desambigua com " (2)".
          realizado_faseamento_2: 'Realizado Faseamento (2)',
          data_inicial_desconcentracao: 'Data Inicial Desconcentração',
          data_final_desconcentracao: 'Data Final Desconcentração',
          meta_desconcentracao: 'Meta Desconcentração',
          realizado_desconcentracao: 'Realizado Desconcentração',
          visitas_diaria: 'Visitas Diária',
          positivacao_diaria: 'Positivação Diária',
          fora_de_rota_diaria: 'Fora de Rota Diária',
          visitas_acumulada: 'Visitas Acumulada',
          positivacao_acumulada: 'Positivação Acumulada',
          fora_de_rota_acumulada: 'Fora de Rota Acumulada',
          data_inicial_faseamento_ii: 'Data Inicial Faseamento II',
          data_final_faseamento_ii: 'Data Final Faseamento II',
          meta_faseamento_ii: 'Meta Faseamento II',
          realizado_faseamento_ii: 'Realizado Faseamento II',
          data_inicial_desafio: 'Data Inicial Desafio',
          data_final_desafio: 'Data Final Desafio',
          meta_desafio: 'Meta Desafio',
          realizado_desafio: 'Realizado Desafio',
        },
      },
      {
        key: 'categorias',
        sheetName: 'Categorias',
        label: 'Categorias',
        columns: [
          'cod_vendedor',
          'fabricante',
          'gerencia',
          'equipe',
          'meta',
          'realizado',
          'cobertura',
          'realizado_cobertura',
          'pct_margem',
        ],
        headerHints: {
          cod_vendedor: 'Cod',
          fabricante: 'Fabricantes',
          gerencia: 'Gerências',
          equipe: 'Equipes',
          meta: 'Meta',
          realizado: 'Realizado',
          cobertura: 'Cobertura',
          realizado_cobertura: 'Realizado Cob.',
          pct_margem: '%Margem',
        },
      },
    ],
  },
  {
    id: 'nao_positivados',
    label: 'Não Positivados',
    description: 'Clientes sem compra no período, segmentados por Vendedor, Equipe e Chok Total',
    templateFile: '/templates/importacao/nao_positivados.xlsx',
    sheets: [
      {
        // Na planilha real, cada fabricante vira uma coluna própria (matriz
        // cliente x fabricante com o valor vendido no período) e a lista de
        // fabricantes muda com o tempo — por isso `columns` só lista os
        // campos de identificação do cliente. Todas as demais colunas do
        // arquivo (uma por fabricante) são capturadas automaticamente pelo
        // backend e viram a coluna `fabricantes` (ver dynamicJsonColumn em
        // server/importTypes.ts) — não precisam ser mapeadas aqui.
        key: 'por_vendedor',
        sheetName: 'Por vendedor',
        label: 'Por Vendedor',
        columns: ['cod_vendedor', 'cod_cliente', 'razao_social', 'nome_fantasia', 'municipio'],
        headerHints: {
          cod_vendedor: 'cd_vend',
          cod_cliente: 'cd_clien',
          razao_social: 'nome',
          nome_fantasia: 'Nome Fantasia',
          municipio: 'municipio',
        },
      },
      {
        key: 'equipe',
        sheetName: 'Equipe',
        label: 'Equipe',
        columns: ['equipe', 'cod_cliente', 'razao_social', 'nome_fantasia', 'municipio'],
        headerHints: {
          equipe: 'Cd Equipe',
          cod_cliente: 'cd_clien',
          razao_social: 'nome',
          nome_fantasia: 'Nome Fantasia',
          municipio: 'municipio',
        },
      },
      {
        key: 'chok_total',
        sheetName: 'Chok total',
        label: 'Chok Total',
        columns: ['cod_cliente', 'razao_social', 'nome_fantasia', 'municipio'],
        headerHints: {
          cod_cliente: 'cd_clien',
          razao_social: 'nome',
          nome_fantasia: 'Nome Fantasia',
          municipio: 'municipio',
        },
      },
    ],
  },
];

interface HistoryItem {
  id: string;
  tipo: string;
  arquivo: string;
  usuario: string;
  dataHora: string;
  total: number;
  validos: number;
  atualizados: number;
  novos: number;
  rejeitados: number;
  status: 'Concluído' | 'Concluído com Avisos' | 'Falha';
}

// Tipos compostos (Top Clientes, Dados App, Não Positivados) enviam um POST
// por aba com tipo = "<id-do-tipo>__<chave-da-aba>" — aqui resolvemos de volta
// para "Rótulo do Tipo — Rótulo da Aba" ao exibir o histórico.
function labelForTipo(tipo: string): string {
  const [baseId, sheetKey] = tipo.split('__');
  const typeCfg = IMPORT_TYPES.find((t) => t.id === baseId);
  if (!typeCfg) return tipo;
  if (!sheetKey) return typeCfg.label;
  const sheetCfg = typeCfg.sheets.find((s) => s.key === sheetKey);
  return sheetCfg ? `${typeCfg.label} — ${sheetCfg.label}` : typeCfg.label;
}

// Converte um registro de auditoria vindo da API (server/routes/imports.ts)
// para o formato que esta tela já exibia — mantém a UI existente intacta.
function toHistoryItem(entry: ImportLogEntry): HistoryItem {
  const statusMap: Record<ImportLogEntry['status'], HistoryItem['status']> = {
    CONCLUIDO: 'Concluído',
    CONCLUIDO_COM_AVISOS: 'Concluído com Avisos',
    FALHA: 'Falha',
  };
  return {
    id: `imp-${entry.id}`,
    tipo: labelForTipo(entry.tipo),
    arquivo: entry.arquivo || '—',
    usuario: entry.usuario_nome || '—',
    dataHora: new Date(entry.data_importacao).toLocaleString('pt-BR'),
    total: entry.total_linhas,
    validos: entry.total_linhas - entry.rejeitados,
    atualizados: entry.atualizados,
    novos: entry.novos,
    rejeitados: entry.rejeitados,
    status: statusMap[entry.status] || 'Falha',
  };
}

type SheetParsedData = { headers: string[]; rows: Record<string, any>[] };

export const ImportacaoPage: React.FC = () => {
  const { t } = useTheme();
  const { currentUser } = useAuth();

  const [step, setStep] = useState<number>(1);
  const [selectedType, setSelectedType] = useState<ImportType>('sortimento');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [sheetsData, setSheetsData] = useState<Record<string, SheetParsedData>>({});
  const [columnMappings, setColumnMappings] = useState<Record<string, Record<string, string>>>({});
  const [fileError, setFileError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [resultSummary, setResultSummary] = useState<any | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState<boolean>(true);
  const [submitError, setSubmitError] = useState<string | null>(null);
  // Data que os dados REPRESENTAM (regra 10) — pode ser diferente do dia do
  // upload, por isso é sempre editável e nunca assumida silenciosamente.
  const [dataReferencia, setDataReferencia] = useState<string>(() => new Date().toISOString().slice(0, 10));

  const currentTypeConfig = IMPORT_TYPES.find((item) => item.id === selectedType)!;
  const isMultiSheet = currentTypeConfig.sheets.length > 1;

  const loadHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const entries = await fetchImportHistory(50);
      setHistory(entries.map(toHistoryItem));
    } catch (err) {
      console.error('Falha ao carregar histórico de importações:', err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  useEffect(() => {
    loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });

        const newSheetsData: Record<string, SheetParsedData> = {};
        const newMappings: Record<string, Record<string, string>> = {};
        const missingSheets: string[] = [];

        currentTypeConfig.sheets.forEach((sheetCfg) => {
          let wsName: string | undefined;
          if (!sheetCfg.sheetName) {
            wsName = wb.SheetNames[0];
          } else {
            wsName = wb.SheetNames.find(
              (n) => n.trim().toLowerCase() === sheetCfg.sheetName.trim().toLowerCase()
            );
          }

          if (!wsName) {
            missingSheets.push(sheetCfg.sheetName || sheetCfg.label);
            return;
          }

          const ws = wb.Sheets[wsName];
          const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
          if (!data || data.length === 0) return;

          // Algumas planilhas reais têm linhas de filtro/pivot antes do
          // cabeçalho de verdade (ex.: aba "top_clientes" do arquivo Top
          // Clientes) — headerRow indica em que linha (1-based) ele está.
          const headerRowIdx = (sheetCfg.headerRow ?? 1) - 1;
          const rawHeaders = (data[headerRowIdx] || []).map((h: any) => String(h || '').trim());

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
          newSheetsData[sheetCfg.key] = { headers, rows: parsedRows };

          // Auto match columns (inclui as ocultas — elas continuam sendo enviadas).
          // Primeiro tenta a dica de cabeçalho real (headerHints) quando existe,
          // com igualdade exata tendo prioridade sobre correspondência parcial.
          // Cabeçalhos já usados não são reatribuídos (evita duas colunas de
          // sistema apontarem para o mesmo "Realizado Faseamento").
          const autoMap: Record<string, string> = {};
          const usedHeaders = new Set<string>();
          const takeMatch = (pred: (h: string) => boolean): string | undefined => {
            const hit = headers.find((h) => !usedHeaders.has(h) && pred(h));
            if (hit) usedHeaders.add(hit);
            return hit;
          };
          sheetCfg.columns.forEach((req) => {
            const candidates = [sheetCfg.headerHints?.[req], req].filter(Boolean) as string[];
            let matched: string | undefined;
            for (const cand of candidates) {
              matched = takeMatch((h) => h.toLowerCase() === cand.toLowerCase());
              if (matched) break;
            }
            if (!matched) {
              for (const cand of candidates) {
                matched = takeMatch((h) => h.toLowerCase().includes(cand.toLowerCase()));
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
      } catch (err) {
        console.error('Erro ao ler arquivo:', err);
        setFileError('Não foi possível ler o arquivo selecionado. Verifique se é um Excel (.xlsx/.xls/.xlsm) ou CSV válido.');
      }
    };
    reader.readAsBinaryString(file);
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

    setIsProcessing(true);
    setSubmitError(null);

    try {
      const combined = {
        totalAnalisados: 0,
        novos: 0,
        atualizados: 0,
        rejeitados: 0,
        erros: [] as { linha: number; motivo: string }[],
      };

      for (const sheetCfg of currentTypeConfig.sheets) {
        const sheetData = sheetsData[sheetCfg.key];
        if (!sheetData || sheetData.rows.length === 0) continue;

        const result = await submitImport({
          tipo: isMultiSheet ? `${selectedType}__${sheetCfg.key}` : selectedType,
          dataReferencia,
          arquivo: uploadedFile?.name,
          usuarioNome: currentUser?.name,
          usuarioEmail: currentUser?.email,
          mapping: columnMappings[sheetCfg.key] || {},
          rows: sheetData.rows,
        });

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
      loadHistory();
    } catch (err) {
      setSubmitError(
        err instanceof ApiError
          ? err.message
          : 'Falha inesperada ao comunicar com o servidor de importação. Nenhum dado foi gravado.'
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const resetWizard = () => {
    setStep(1);
    setUploadedFile(null);
    setSheetsData({});
    setColumnMappings({});
    setFileError(null);
    setResultSummary(null);
    setSubmitError(null);
    setDataReferencia(new Date().toISOString().slice(0, 10));
  };

  return (
    <div>
      <div style={{ marginBottom: '22px' }}>
        <h1 className="num" style={{ margin: '0 0 6px', fontSize: '24px', fontWeight: 700, color: t.text }}>
          Módulo de Importação & Carga de Dados
        </h1>
        <p style={{ margin: 0, fontSize: '13px', color: t.textSecondary }}>
          Central administrativa para processamento, validação e atualização de sortimento, top clientes, dados do
          app e não positivados.
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
            Selecione a categoria de informação que deseja importar:
          </div>
          <div style={{ fontSize: '13px', color: t.textMuted, marginBottom: '20px' }}>
            Cada categoria possui um layout pré-definido com validação sintática das colunas e das abas exigidas.
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
                  onClick={() => setSelectedType(type.id)}
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
                  {displayCols.map((req) => (
                    <div key={req}>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: t.textSecondary, marginBottom: '6px' }}>
                        Coluna do Sistema: <span style={{ color: t.primary }}>{req}</span>
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
                          border: `1px solid ${t.border}`,
                          background: t.surface,
                          color: t.text,
                          fontSize: '13px',
                        }}
                      >
                        {sheetData.headers.map((col) => (
                          <option key={col} value={col}>
                            {col}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
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

      {/* HISTÓRICO DE IMPORTAÇÕES (Requirement 40) */}
      <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: '12px', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${t.border}`, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Clock size={17} color={t.primary} />
          <div style={{ fontSize: '15px', fontWeight: 600, color: t.text }}>
            Histórico Recente de Importações & Cargas
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ color: t.textMuted, background: t.bgSecondary }}>
                {['Tipo de Dado', 'Arquivo', 'Usuário', 'Data e Hora', 'Registros', 'Status'].map((h) => (
                  <th key={h} style={{ textAlign: 'left', padding: '12px 16px', borderBottom: `1px solid ${t.border}`, fontWeight: 500 }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {history.map((item) => (
                <tr key={item.id} style={{ borderBottom: `1px solid ${t.border}` }}>
                  <td style={{ padding: '12px 16px', fontWeight: 600, color: t.text }}>{item.tipo}</td>
                  <td style={{ padding: '12px 16px', color: t.textSecondary }}>{item.arquivo}</td>
                  <td style={{ padding: '12px 16px', color: t.textSecondary }}>{item.usuario}</td>
                  <td style={{ padding: '12px 16px', color: t.textMuted, fontSize: '12px' }}>{item.dataHora}</td>
                  <td className="num" style={{ padding: '12px 16px', color: t.text }}>
                    {item.validos.toLocaleString('pt-BR')} / {item.total.toLocaleString('pt-BR')}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span
                      style={{
                        fontSize: '11.5px',
                        fontWeight: 600,
                        padding: '3px 8px',
                        borderRadius: '6px',
                        background:
                          item.status === 'Concluído'
                            ? 'rgba(61, 214, 140, 0.12)'
                            : item.status === 'Concluído com Avisos'
                            ? 'rgba(232, 179, 57, 0.12)'
                            : 'rgba(227, 6, 19, 0.12)',
                        color:
                          item.status === 'Concluído'
                            ? '#3DD68C'
                            : item.status === 'Concluído com Avisos'
                            ? '#E8B339'
                            : t.primaryHover,
                      }}
                    >
                      ● {item.status}
                    </span>
                  </td>
                </tr>
              ))}
              {!isLoadingHistory && history.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ padding: '30px 16px', textAlign: 'center', color: t.textMuted, fontSize: '13px' }}>
                    Nenhuma importação registrada ainda. As cargas realizadas aqui ou pela automação Python aparecerão
                    neste histórico.
                  </td>
                </tr>
              )}
              {isLoadingHistory && (
                <tr>
                  <td colSpan={6} style={{ padding: '30px 16px', textAlign: 'center', color: t.textMuted, fontSize: '13px' }}>
                    Carregando histórico de importações...
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
