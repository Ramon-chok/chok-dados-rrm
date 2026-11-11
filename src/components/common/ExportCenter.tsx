/**
 * Central de Exportações — o único lugar do sistema que gera planilha.
 *
 * As telas não têm mais botão "Exportar Excel": a análise é feita dentro do
 * sistema e a extração é um ato consciente, feito aqui, escolhendo QUAIS telas
 * devem sair em planilha. Cada tela selecionada busca os próprios dados pelos
 * mesmos endpoints que ela usa (ver src/lib/exportCatalog.ts), com o período
 * escolhido no filtro global.
 */
import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Files,
  Layers,
  Loader2,
  X,
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useGlobalFilter } from '../../context/GlobalFilterContext';
import { PeriodSelector } from './PeriodSelector';
import { downloadWorkbook, slugifyFilename, type ExcelSheetData } from '../../lib/excel';
import {
  datasetsByGroup,
  type ExportContext,
  type ExportDataset,
} from '../../lib/exportCatalog';
import { getErrorMessage } from '../../lib/api';

type ModoArquivo = 'unico' | 'separado';

type StatusTela = 'pendente' | 'buscando' | 'ok' | 'vazio' | 'erro';

interface ResultadoTela {
  status: StatusTela;
  linhas: number;
  mensagem?: string;
}

const GRUPOS = datasetsByGroup();

export const ExportCenter: React.FC = () => {
  const { t } = useTheme();
  const filtro = useGlobalFilter();

  const [aberto, setAberto] = useState(false);
  const [selecionadas, setSelecionadas] = useState<string[]>([]);
  const [modo, setModo] = useState<ModoArquivo>('unico');
  const [gerando, setGerando] = useState(false);
  const [resultados, setResultados] = useState<Record<string, ResultadoTela>>({});
  const [concluido, setConcluido] = useState(false);
  const [erroGeral, setErroGeral] = useState<string | null>(null);

  const totalTelas = useMemo(
    () => GRUPOS.reduce((acc, g) => acc + g.datasets.length, 0),
    []
  );

  const marcada = (id: string) => selecionadas.includes(id);

  const alternar = (id: string) => {
    setConcluido(false);
    setSelecionadas((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const alternarGrupo = (ids: string[]) => {
    setConcluido(false);
    const todasMarcadas = ids.every((id) => selecionadas.includes(id));
    setSelecionadas((prev) =>
      todasMarcadas ? prev.filter((id) => !ids.includes(id)) : Array.from(new Set([...prev, ...ids]))
    );
  };

  const selecionarTudo = () => {
    setConcluido(false);
    setSelecionadas(GRUPOS.flatMap((g) => g.datasets.map((d) => d.id)));
  };

  const limparSelecao = () => {
    setConcluido(false);
    setSelecionadas([]);
  };

  const abrir = () => {
    setResultados({});
    setConcluido(false);
    setErroGeral(null);
    setAberto(true);
  };

  const fechar = () => {
    if (gerando) return;
    setAberto(false);
  };

  const contexto = (): ExportContext => ({
    periodType: filtro.periodType,
    ano: filtro.ano,
    mes: filtro.mes,
    startDate: filtro.startDate,
    endDate: filtro.endDate,
    periodLabel: filtro.periodLabel,
  });

  const gerar = async () => {
    if (gerando || selecionadas.length === 0) return;

    const ordenadas: ExportDataset[] = GRUPOS.flatMap((g) => g.datasets).filter((d) =>
      selecionadas.includes(d.id)
    );

    setGerando(true);
    setConcluido(false);
    setErroGeral(null);
    setResultados(
      Object.fromEntries(ordenadas.map((d) => [d.id, { status: 'pendente' as StatusTela, linhas: 0 }]))
    );

    const ctx = contexto();
    const parciais: Record<string, ResultadoTela> = {};
    const abasDoArquivoUnico: ExcelSheetData[] = [];

    for (const dataset of ordenadas) {
      parciais[dataset.id] = { status: 'buscando', linhas: 0 };
      setResultados({ ...parciais });

      try {
        const abas = await dataset.build(ctx);
        const linhas = abas.reduce((acc, aba) => acc + aba.data.length, 0);

        if (linhas === 0) {
          parciais[dataset.id] = {
            status: 'vazio',
            linhas: 0,
            mensagem: 'Sem dados para o período escolhido.',
          };
          setResultados({ ...parciais });
          continue;
        }

        if (modo === 'separado') {
          downloadWorkbook(`${slugifyFilename(dataset.label)}-${slugifyFilename(ctx.periodLabel)}`, abas);
        } else {
          // Em arquivo único, cada aba carrega o nome da tela na frente para
          // não se confundir com as abas das outras telas.
          abas.forEach((aba) => {
            abasDoArquivoUnico.push({
              sheetName: abas.length > 1 ? `${dataset.label} - ${aba.sheetName}` : dataset.label,
              data: aba.data,
            });
          });
        }

        parciais[dataset.id] = { status: 'ok', linhas };
      } catch (e) {
        parciais[dataset.id] = {
          status: 'erro',
          linhas: 0,
          mensagem: getErrorMessage(e, 'Falha ao buscar os dados desta tela.'),
        };
      }
      setResultados({ ...parciais });
    }

    if (modo === 'unico' && abasDoArquivoUnico.length > 0) {
      try {
        downloadWorkbook(`chok-dados-${slugifyFilename(ctx.periodLabel)}`, abasDoArquivoUnico);
      } catch (e) {
        setErroGeral(getErrorMessage(e, 'Falha ao gerar o arquivo.'));
      }
    }

    setGerando(false);
    setConcluido(true);
  };

  const resumo = useMemo(() => {
    const valores = Object.values(resultados) as ResultadoTela[];
    return {
      ok: valores.filter((r) => r.status === 'ok').length,
      vazias: valores.filter((r) => r.status === 'vazio').length,
      erros: valores.filter((r) => r.status === 'erro').length,
      linhas: valores.reduce((acc, r) => acc + r.linhas, 0),
    };
  }, [resultados]);

  const botaoBase: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    borderRadius: 10,
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    whiteSpace: 'nowrap',
  };

  return (
    <>
      {/* Cartão de entrada da extração, no topo da tela de Dados e Exportações */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          flexWrap: 'wrap',
          background: t.surface,
          border: `1px solid ${t.border}`,
          borderRadius: 12,
          padding: '16px 20px',
          marginBottom: 24,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, minWidth: 260, flex: 1 }}>
          <div
            style={{
              width: 42,
              height: 42,
              borderRadius: 12,
              background: `${t.primary}18`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <FileSpreadsheet size={21} color={t.primary} />
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: t.text, marginBottom: 3 }}>
              Extrair dados em planilha
            </div>
            <div style={{ fontSize: 12.5, color: t.textSecondary, lineHeight: 1.5 }}>
              As telas do sistema não têm mais botão de exportar — a extração acontece aqui. Escolha
              quais telas devem sair em Excel ({totalTelas} disponíveis) e o período.
            </div>
          </div>
        </div>
        <button
          onClick={abrir}
          style={{
            ...botaoBase,
            padding: '10px 18px',
            border: 'none',
            background: t.primary,
            color: '#fff',
          }}
        >
          <Download size={16} />
          Extrair
        </button>
      </div>

      {!aberto ? null : (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Extrair dados em planilha"
          onClick={fechar}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9998,
            background: 'rgba(8, 12, 24, 0.72)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 'min(760px, 100%)',
              maxHeight: 'calc(100vh - 48px)',
              display: 'flex',
              flexDirection: 'column',
              background: t.surface,
              border: `1px solid ${t.border}`,
              borderRadius: 16,
              boxShadow: '0 24px 64px rgba(0,0,0,0.35)',
              overflow: 'hidden',
            }}
          >
            {/* Cabeçalho */}
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: 12,
                padding: '20px 22px 16px',
                borderBottom: `1px solid ${t.border}`,
              }}
            >
              <div>
                <div style={{ fontSize: 17, fontWeight: 700, color: t.text, marginBottom: 3 }}>
                  Extrair dados em planilha
                </div>
                <div style={{ fontSize: 12.5, color: t.textSecondary }}>
                  Selecione as telas que você quer levar para o Excel.
                </div>
              </div>
              <button
                onClick={fechar}
                disabled={gerando}
                aria-label="Fechar"
                style={{
                  ...botaoBase,
                  padding: 7,
                  background: 'transparent',
                  border: `1px solid ${t.border}`,
                  color: t.textSecondary,
                  cursor: gerando ? 'not-allowed' : 'pointer',
                  opacity: gerando ? 0.5 : 1,
                }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Corpo */}
            <div style={{ padding: '18px 22px', overflowY: 'auto', flex: 1 }}>
              {/* Período */}
              <div style={{ marginBottom: 18 }}>
                <div
                  style={{
                    fontSize: 11.5,
                    fontWeight: 700,
                    color: t.textMuted,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    marginBottom: 8,
                  }}
                >
                  Período da extração
                </div>
                <PeriodSelector />
                <div style={{ fontSize: 11.5, color: t.textMuted, marginTop: 7, lineHeight: 1.5 }}>
                  Vale para as telas recortadas por período. Sortimentos, Base de Roteiro e Histórico
                  de Importações saem sempre com a última base importada.
                </div>
              </div>

              {/* Formato */}
              <div style={{ marginBottom: 18 }}>
                <div
                  style={{
                    fontSize: 11.5,
                    fontWeight: 700,
                    color: t.textMuted,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    marginBottom: 8,
                  }}
                >
                  Formato do arquivo
                </div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  {[
                    {
                      id: 'unico' as ModoArquivo,
                      icone: <Layers size={15} />,
                      titulo: 'Um arquivo só',
                      ajuda: 'Uma aba por tela',
                    },
                    {
                      id: 'separado' as ModoArquivo,
                      icone: <Files size={15} />,
                      titulo: 'Um arquivo por tela',
                      ajuda: 'Vários downloads',
                    },
                  ].map((opt) => {
                    const ativo = modo === opt.id;
                    return (
                      <button
                        key={opt.id}
                        onClick={() => setModo(opt.id)}
                        disabled={gerando}
                        style={{
                          ...botaoBase,
                          flex: '1 1 200px',
                          alignItems: 'center',
                          padding: '10px 14px',
                          textAlign: 'left',
                          border: `1px solid ${ativo ? t.primary : t.border}`,
                          background: ativo ? `${t.primary}12` : t.surfaceElevated,
                          color: ativo ? t.primary : t.textSecondary,
                          cursor: gerando ? 'not-allowed' : 'pointer',
                        }}
                      >
                        {opt.icone}
                        <span style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                          <span style={{ fontWeight: 600 }}>{opt.titulo}</span>
                          <span style={{ fontSize: 11, fontWeight: 500, color: t.textMuted }}>
                            {opt.ajuda}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Telas */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 10,
                  marginBottom: 10,
                  flexWrap: 'wrap',
                }}
              >
                <div
                  style={{
                    fontSize: 11.5,
                    fontWeight: 700,
                    color: t.textMuted,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  Telas ({selecionadas.length}/{totalTelas} selecionadas)
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={selecionarTudo}
                    disabled={gerando}
                    style={{
                      ...botaoBase,
                      padding: '5px 11px',
                      fontSize: 12,
                      border: `1px solid ${t.border}`,
                      background: t.surfaceElevated,
                      color: t.textSecondary,
                      cursor: gerando ? 'not-allowed' : 'pointer',
                    }}
                  >
                    Selecionar todas
                  </button>
                  <button
                    onClick={limparSelecao}
                    disabled={gerando || selecionadas.length === 0}
                    style={{
                      ...botaoBase,
                      padding: '5px 11px',
                      fontSize: 12,
                      border: `1px solid ${t.border}`,
                      background: t.surfaceElevated,
                      color: t.textSecondary,
                      cursor: gerando || selecionadas.length === 0 ? 'not-allowed' : 'pointer',
                      opacity: selecionadas.length === 0 ? 0.6 : 1,
                    }}
                  >
                    Limpar
                  </button>
                </div>
              </div>

              {GRUPOS.map((grupo) => {
                const ids = grupo.datasets.map((d) => d.id);
                const todasMarcadas = ids.every((id) => selecionadas.includes(id));
                return (
                  <div key={grupo.group} style={{ marginBottom: 14 }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 10,
                        marginBottom: 6,
                      }}
                    >
                      <span style={{ fontSize: 12.5, fontWeight: 700, color: t.text }}>
                        {grupo.group}
                      </span>
                      <button
                        onClick={() => alternarGrupo(ids)}
                        disabled={gerando}
                        style={{
                          ...botaoBase,
                          padding: '3px 8px',
                          fontSize: 11.5,
                          fontWeight: 600,
                          border: 'none',
                          background: 'transparent',
                          color: t.primary,
                          cursor: gerando ? 'not-allowed' : 'pointer',
                        }}
                      >
                        {todasMarcadas ? 'Desmarcar grupo' : 'Marcar grupo'}
                      </button>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {grupo.datasets.map((dataset) => {
                        const res = resultados[dataset.id];
                        const ativo = marcada(dataset.id);
                        return (
                          <label
                            key={dataset.id}
                            style={{
                              display: 'flex',
                              alignItems: 'flex-start',
                              gap: 11,
                              padding: '10px 13px',
                              borderRadius: 10,
                              border: `1px solid ${ativo ? `${t.primary}55` : t.border}`,
                              background: ativo ? `${t.primary}0D` : t.surfaceElevated,
                              cursor: gerando ? 'default' : 'pointer',
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={ativo}
                              disabled={gerando}
                              onChange={() => alternar(dataset.id)}
                              style={{ marginTop: 2, accentColor: t.primary, cursor: 'inherit' }}
                            />
                            <span style={{ flex: 1, minWidth: 0 }}>
                              <span
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 8,
                                  fontSize: 13,
                                  fontWeight: 600,
                                  color: t.text,
                                  flexWrap: 'wrap',
                                }}
                              >
                                {dataset.label}
                                {dataset.ignoresPeriod && (
                                  <span
                                    style={{
                                      fontSize: 10,
                                      fontWeight: 700,
                                      color: t.textMuted,
                                      border: `1px solid ${t.border}`,
                                      borderRadius: 5,
                                      padding: '1px 5px',
                                      textTransform: 'uppercase',
                                      letterSpacing: '0.04em',
                                    }}
                                  >
                                    base completa
                                  </span>
                                )}
                              </span>
                              <span
                                style={{
                                  display: 'block',
                                  fontSize: 11.5,
                                  color: t.textSecondary,
                                  marginTop: 2,
                                  lineHeight: 1.45,
                                }}
                              >
                                {dataset.description}
                              </span>
                              {res && res.status !== 'pendente' && (
                                <span
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 6,
                                    fontSize: 11.5,
                                    fontWeight: 600,
                                    marginTop: 5,
                                    color:
                                      res.status === 'ok'
                                        ? '#3DD68C'
                                        : res.status === 'erro'
                                          ? '#FF5A5A'
                                          : res.status === 'vazio'
                                            ? '#E8B339'
                                            : t.textSecondary,
                                  }}
                                >
                                  {res.status === 'buscando' && (
                                    <>
                                      <Loader2
                                        size={13}
                                        style={{ animation: 'exportSpin 0.9s linear infinite' }}
                                      />
                                      Buscando dados…
                                    </>
                                  )}
                                  {res.status === 'ok' && (
                                    <>
                                      <CheckCircle2 size={13} />
                                      {res.linhas.toLocaleString('pt-BR')} linhas
                                    </>
                                  )}
                                  {res.status === 'vazio' && (
                                    <>
                                      <AlertTriangle size={13} />
                                      {res.mensagem}
                                    </>
                                  )}
                                  {res.status === 'erro' && (
                                    <>
                                      <AlertTriangle size={13} />
                                      {res.mensagem}
                                    </>
                                  )}
                                </span>
                              )}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Rodapé */}
            <div
              style={{
                borderTop: `1px solid ${t.border}`,
                padding: '14px 22px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                flexWrap: 'wrap',
                background: t.bgSecondary,
              }}
            >
              <div style={{ fontSize: 12, color: t.textSecondary, lineHeight: 1.5 }}>
                {erroGeral ? (
                  <span style={{ color: '#FF5A5A', fontWeight: 600 }}>{erroGeral}</span>
                ) : concluido ? (
                  <>
                    <strong style={{ color: t.text }}>
                      {resumo.ok} tela{resumo.ok === 1 ? '' : 's'} extraída
                      {resumo.ok === 1 ? '' : 's'}
                    </strong>{' '}
                    · {resumo.linhas.toLocaleString('pt-BR')} linhas
                    {resumo.vazias > 0 ? ` · ${resumo.vazias} sem dados` : ''}
                    {resumo.erros > 0 ? ` · ${resumo.erros} com falha` : ''}
                  </>
                ) : gerando ? (
                  'Buscando os dados de cada tela…'
                ) : selecionadas.length === 0 ? (
                  'Nenhuma tela selecionada.'
                ) : (
                  `${selecionadas.length} tela${selecionadas.length === 1 ? '' : 's'} · período: ${filtro.periodLabel}`
                )}
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  onClick={fechar}
                  disabled={gerando}
                  style={{
                    ...botaoBase,
                    padding: '9px 16px',
                    border: `1px solid ${t.border}`,
                    background: t.surface,
                    color: t.textSecondary,
                    cursor: gerando ? 'not-allowed' : 'pointer',
                    opacity: gerando ? 0.6 : 1,
                  }}
                >
                  {concluido ? 'Fechar' : 'Cancelar'}
                </button>
                <button
                  onClick={gerar}
                  disabled={gerando || selecionadas.length === 0}
                  style={{
                    ...botaoBase,
                    padding: '9px 18px',
                    border: 'none',
                    background: gerando || selecionadas.length === 0 ? t.surfaceElevated : t.primary,
                    color: gerando || selecionadas.length === 0 ? t.textMuted : '#fff',
                    cursor: gerando || selecionadas.length === 0 ? 'not-allowed' : 'pointer',
                  }}
                >
                  {gerando ? (
                    <>
                      <Loader2 size={15} style={{ animation: 'exportSpin 0.9s linear infinite' }} />
                      Gerando…
                    </>
                  ) : (
                    <>
                      <Download size={15} />
                      {concluido ? 'Extrair novamente' : 'Gerar planilha'}
                    </>
                  )}
                </button>
              </div>
            </div>

            <style>{`@keyframes exportSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
          </div>
        </div>
      )}
    </>
  );
};
