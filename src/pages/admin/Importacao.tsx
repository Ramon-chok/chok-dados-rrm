import React, { useState, useEffect } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  RotateCcw,
  Download,
  Clock,
  Database,
  FileCheck,
  ChevronRight,
  Calendar,
  XCircle,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { submitImport, fetchImportHistory, ImportLogEntry, ApiError } from '../../lib/api';

export type ImportType =
  | 'vendas'
  | 'metas'
  | 'clientes'
  | 'vendedores'
  | 'equipes'
  | 'supervisores'
  | 'gerencias'
  | 'fabricantes'
  | 'categorias'
  | 'produtos'
  | 'visitas'
  | 'indicadores_vendedor'
  | 'indicadores_fabricante'
  | 'indicadores_positivacao';

interface ImportTypeOption {
  id: ImportType;
  label: string;
  description: string;
  requiredColumns: string[];
  /** Caminho público (public/templates/importacao/) do modelo .xlsx pronto para download. */
  templateFile: string;
}

const IMPORT_TYPES: ImportTypeOption[] = [
  {
    id: 'vendas',
    label: 'Vendas & Faturamento',
    description: 'Notas fiscais, pedidos faturados, valores e itens vendidos',
    requiredColumns: ['numero_pedido', 'data_emissao', 'cod_cliente', 'cod_vendedor', 'valor_total'],
    templateFile: '/templates/importacao/01_vendas.xlsx',
  },
  {
    id: 'metas',
    label: 'Metas Comerciais',
    description: 'Cotas mensais/semanais por vendedor, fabricante e cobertura',
    requiredColumns: ['ano_mes', 'cod_vendedor', 'fabricante', 'meta_faturamento', 'meta_cobertura'],
    templateFile: '/templates/importacao/02_metas.xlsx',
  },
  {
    id: 'clientes',
    label: 'Base de Clientes',
    description: 'Cadastros de clientes, CNPJ, razão social, endereço e equipe',
    requiredColumns: ['cod_cliente', 'razao_social', 'cnpj', 'cod_vendedor', 'status', 'e_rede'],
    templateFile: '/templates/importacao/03_clientes.xlsx',
  },
  {
    id: 'vendedores',
    label: 'Vendedores',
    description: 'Código de vendedor, nome, email e equipe comercial',
    requiredColumns: ['cod_vendedor', 'nome', 'email', 'equipe'],
    templateFile: '/templates/importacao/04_vendedores.xlsx',
  },
  {
    id: 'equipes',
    label: 'Equipes Comerciais',
    description: 'Equipes de vendas e supervisor responsável',
    requiredColumns: ['nome_equipe', 'supervisor', 'gerencia'],
    templateFile: '/templates/importacao/05_equipes.xlsx',
  },
  {
    id: 'supervisores',
    label: 'Supervisores',
    description: 'Supervisores e sua respectiva gerência de vendas',
    requiredColumns: ['nome_supervisor', 'gerencia', 'email'],
    templateFile: '/templates/importacao/06_supervisores.xlsx',
  },
  {
    id: 'gerencias',
    label: 'Gerências',
    description: 'Unidades de gerência comercial (ex: TRAD, AS)',
    requiredColumns: ['codigo_gerencia', 'nome_gerencia'],
    templateFile: '/templates/importacao/07_gerencias.xlsx',
  },
  {
    id: 'fabricantes',
    label: 'Fabricantes / Indústrias',
    description: 'Indústrias parceiras representadas',
    requiredColumns: ['nome_fabricante', 'razao_social', 'cnpj'],
    templateFile: '/templates/importacao/08_fabricantes.xlsx',
  },
  {
    id: 'categorias',
    label: 'Categorias de Produtos',
    description: 'Categorias mercadológicas e agrupamentos',
    requiredColumns: ['cod_categoria', 'nome_categoria', 'fabricante'],
    templateFile: '/templates/importacao/09_categorias.xlsx',
  },
  {
    id: 'produtos',
    label: 'Produtos / Sortimentos',
    description: 'Itens de catálogo, código de barras, preço e linha',
    requiredColumns: ['cod_produto', 'descricao', 'fabricante', 'categoria', 'preco_tabela'],
    templateFile: '/templates/importacao/10_produtos.xlsx',
  },
  {
    id: 'visitas',
    label: 'Roteiros de Visitas & Positivação',
    description: 'Agendas de visitas presenciais e positivação de campo',
    requiredColumns: ['cod_cliente', 'cod_vendedor', 'data_visita', 'status_visita'],
    templateFile: '/templates/importacao/11_visitas.xlsx',
  },
  {
    id: 'indicadores_vendedor',
    label: 'Indicadores Diários do Vendedor',
    description: 'Snapshot diário consolidado (aba "Mês"): meta e realizado de faturamento, cobertura e sortimento por vendedor',
    requiredColumns: [
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
    ],
    templateFile: '/templates/importacao/12_indicadores_vendedor.xlsx',
  },
  {
    id: 'indicadores_fabricante',
    label: 'Indicadores Diários por Fabricante',
    description: 'Snapshot diário por vendedor x fabricante (aba "Categorias"): meta, realizado, cobertura e margem',
    requiredColumns: ['cod_vendedor', 'fabricante', 'gerencia', 'equipe', 'meta', 'realizado', 'cobertura', 'realizado_cobertura', 'pct_margem'],
    templateFile: '/templates/importacao/13_indicadores_fabricante.xlsx',
  },
  {
    id: 'indicadores_positivacao',
    label: 'Indicadores Diários de Positivação',
    description: 'Snapshot diário de visitas, vendas e roteiro (aba "Positivação") consolidado por vendedor',
    requiredColumns: [
      'cod_vendedor',
      'equipe',
      'visitas_previstas',
      'visitas_realizadas',
      'vendas_previstas',
      'vendas_realizadas',
      'fora_de_rota',
      'gps_ok',
      'pedidos',
      'apontamentos',
    ],
    templateFile: '/templates/importacao/14_indicadores_positivacao.xlsx',
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
    tipo: IMPORT_TYPES.find((t) => t.id === entry.tipo)?.label || entry.tipo,
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

export const ImportacaoPage: React.FC = () => {
  const { t } = useTheme();
  const { currentUser } = useAuth();

  const [step, setStep] = useState<number>(1);
  const [selectedType, setSelectedType] = useState<ImportType>('vendas');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [previewRows, setPreviewRows] = useState<any[]>([]);
  const [allRows, setAllRows] = useState<any[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [resultSummary, setResultSummary] = useState<any | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState<boolean>(true);
  const [submitError, setSubmitError] = useState<string | null>(null);
  // Data que os dados REPRESENTAM (regra 10) — pode ser diferente do dia do
  // upload, por isso é sempre editável e nunca assumida silenciosamente.
  const [dataReferencia, setDataReferencia] = useState<string>(() => new Date().toISOString().slice(0, 10));

  const currentTypeConfig = IMPORT_TYPES.find((item) => item.id === selectedType)!;

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

  // Handle file selection (CSV/XLSX)
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setUploadedFile(file);

      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const bstr = evt.target?.result;
          const wb = XLSX.read(bstr, { type: 'binary' });
          const wsname = wb.SheetNames[0];
          const ws = wb.Sheets[wsname];
          const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];

          if (data && data.length > 0) {
            const headers = (data[0] || []).map((h: any) => String(h || '').trim());
            const rowToObj = (row: any[]) => {
              const obj: Record<string, any> = {};
              headers.forEach((h: string, idx: number) => {
                obj[h || `Coluna_${idx}`] = row[idx] ?? '';
              });
              return obj;
            };

            // Todas as linhas de dados (usadas no envio real ao backend) —
            // ignora linhas totalmente em branco que o Excel às vezes deixa no final.
            const dataRows = data.slice(1).filter((row) => (row || []).some((cell) => cell !== undefined && cell !== ''));
            const parsedRows = dataRows.map(rowToObj);
            setAllRows(parsedRows);
            setPreviewRows(parsedRows.slice(0, 5));

            // Auto match required columns
            const autoMap: Record<string, string> = {};
            currentTypeConfig.requiredColumns.forEach((req) => {
              const matched = headers.find(
                (h) => h.toLowerCase() === req.toLowerCase() || h.toLowerCase().includes(req.toLowerCase())
              );
              if (matched) autoMap[req] = matched;
              else autoMap[req] = headers[0] || '';
            });
            setColumnMapping(autoMap);
            setStep(3);
          }
        } catch (err) {
          console.error('Erro ao ler arquivo:', err);
        }
      };
      reader.readAsBinaryString(file);
    }
  };

  const handleProcessImport = async () => {
    if (!dataReferencia) {
      setSubmitError('Informe a Data de Referência antes de processar a importação.');
      return;
    }
    if (allRows.length === 0) {
      setSubmitError('Nenhuma linha de dados encontrada no arquivo carregado.');
      return;
    }

    setIsProcessing(true);
    setSubmitError(null);

    try {
      const result = await submitImport({
        tipo: selectedType,
        dataReferencia,
        arquivo: uploadedFile?.name,
        usuarioNome: currentUser?.name,
        usuarioEmail: currentUser?.email,
        mapping: columnMapping,
        rows: allRows,
      });

      setResultSummary({
        totalAnalysados: result.totalAnalisados,
        validos: result.totalAnalisados - result.rejeitados,
        atualizados: result.atualizados,
        novos: result.novos,
        rejeitados: result.rejeitados,
        tipoLabel: result.tipoLabel,
        arquivo: result.arquivo || uploadedFile?.name || 'arquivo_importado.xlsx',
        erros: result.erros,
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
    setPreviewRows([]);
    setAllRows([]);
    setColumnMapping({});
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
          Central administrativa para processamento, validação e atualização de vendas, metas, cadastros e sortimentos.
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
            Cada categoria possui um layout pré-definido com validação sintática das colunas e chaves primárias.
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
            Formatos aceitos: Microsoft Excel (.xlsx, .xls) ou Comma-Separated Values (.csv).
          </div>

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
              accept=".csv,.xlsx,.xls"
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
              marginBottom: '24px',
            }}
          >
            {currentTypeConfig.requiredColumns.map((req) => (
              <div key={req}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: t.textSecondary, marginBottom: '6px' }}>
                  Coluna do Sistema: <span style={{ color: t.primary }}>{req}</span>
                </label>
                <select
                  value={columnMapping[req] || ''}
                  onChange={(e) => setColumnMapping({ ...columnMapping, [req]: e.target.value })}
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
                  {previewRows.length > 0 &&
                    Object.keys(previewRows[0]).map((col) => (
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
                  {previewRows.length > 0 &&
                    Object.keys(previewRows[0]).map((col) => (
                      <th key={col} style={{ textAlign: 'left', padding: '10px 12px', borderBottom: `1px solid ${t.border}` }}>
                        {col}
                      </th>
                    ))}
                </tr>
              </thead>
              <tbody>
                {previewRows.map((row, idx) => (
                  <tr key={idx} style={{ borderBottom: `1px solid ${t.border}` }}>
                    {Object.values(row).map((val: any, j) => (
                      <td key={j} style={{ padding: '8px 12px', color: t.textSecondary }}>
                        {String(val)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
