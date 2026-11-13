import React, { useEffect, useMemo, useState } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useGlobalFilter } from '../../context/GlobalFilterContext';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '../../components/common/DataState';
import {
  getErrorMessage,
  fetchTopCustomers,
  fetchClientesCrescimento,
  fetchDashboardFilterOptions,
  TopCustomerRow,
  ClienteCrescimentoRow,
  ClientesCrescimentoResponse,
  DashboardFilterOptions,
  JanelaCrescimento,
  BaseCrescimento,
} from '../../lib/api';
import { SingleSelectFilter } from '../../components/common/SingleSelectFilter';
import { ClienteDetalhe, ClienteAlvo } from '../../components/clientes/ClienteDetalhe';
import { podeFiltrarEquipe, podeFiltrarVendedor } from '../../types';
import { TrendingUp, TrendingDown, Trophy } from 'lucide-react';

/**
 * TOP Clientes.
 *
 * Três leituras, de cima para baixo:
 *
 *   1. O ranking do vendedor, com a quantidade que ELE escolhe ver (3, 5, 10,
 *      15, 20, 30, 50 ou 100) — tabela com rolagem própria, para o ranking
 *      não empurrar o resto da tela para baixo.
 *   2. Lado a lado, a carteira que CRESCE e a carteira que CAI dentro do
 *      período que ele escolher para analisar.
 *
 * Clicar em qualquer linha abre a ficha do cliente (a mesma do Dashboard e
 * dos Não Positivados).
 *
 * A tela antiga "TOP 20 Clientes" saiu: ela mostrava o mesmo comparativo de
 * crescimento, só que preso aos 20 primeiros de cada vendedor e sem escolha
 * de período. O comparativo agora vive aqui, sobre a carteira inteira.
 */

const fmt = (v: number) => `R$ ${v.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`;
const fmtPct = (v: number) => `${v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;

/** Quantidades oferecidas no filtro "Exibir" do ranking. */
const QUANTIDADES = [3, 5, 10, 15, 20, 30, 50, 100];

const JANELAS: Array<{ value: JanelaCrescimento; label: string }> = [
  { value: 'mes', label: 'Mês' },
  { value: 'trimestre', label: 'Trimestre' },
  { value: 'semestre', label: 'Semestre' },
];

const BASES: Array<{ value: BaseCrescimento; label: string }> = [
  { value: 'anterior', label: 'Período anterior' },
  { value: 'ano_anterior', label: 'Mesmo período do ano anterior' },
];

export const TopClientesPage: React.FC = () => {
  const { t, mode } = useTheme();
  const { currentUser } = useAuth();
  const { startDate, endDate, ano, mes, periodType, periodLabel } = useGlobalFilter();

  const role = currentUser?.role;
  // Supervisor já vê apenas a própria equipe (escopo travado no backend) —
  // não faz sentido oferecer o filtro de Equipe. Vendedor já vê só os
  // próprios dados, então nem Equipe nem Vendedor fazem sentido para ele.
  const canFilterEquipe = podeFiltrarEquipe(role);
  const canFilterVendedor = podeFiltrarVendedor(role);

  const [selectedEquipe, setSelectedEquipe] = useState('');
  const [selectedVendedor, setSelectedVendedor] = useState('');
  const [filterOptions, setFilterOptions] = useState<DashboardFilterOptions | null>(null);

  // ── Ranking ───────────────────────────────────────────────────────────
  const [topN, setTopN] = useState(20);
  const [rows, setRows] = useState<TopCustomerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── Crescimento x queda ───────────────────────────────────────────────
  const [janela, setJanela] = useState<JanelaCrescimento>('mes');
  const [baseComparacao, setBaseComparacao] = useState<BaseCrescimento>('anterior');
  const [movimento, setMovimento] = useState<ClientesCrescimentoResponse | null>(null);
  const [movLoading, setMovLoading] = useState(true);
  const [movError, setMovError] = useState<string | null>(null);

  // ── Ficha do cliente ──────────────────────────────────────────────────
  const [clienteAberto, setClienteAberto] = useState<ClienteAlvo | null>(null);

  useEffect(() => {
    if (!canFilterEquipe && !canFilterVendedor) return;
    let mounted = true;
    (async () => {
      try {
        const opts = await fetchDashboardFilterOptions();
        if (mounted) setFilterOptions(opts);
      } catch {
        // Filtros são um extra da tela — sem eles, segue no escopo padrão.
      }
    })();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        // Busca com folga: os filtros de equipe/vendedor são aplicados na
        // tela, então pedir exatamente `topN` cortaria clientes antes do
        // filtro e o "Top 10 da equipe X" viria incompleto.
        const data = await fetchTopCustomers({
          start: startDate || undefined,
          end: endDate || undefined,
          limit: canFilterEquipe || canFilterVendedor ? 200 : topN,
        });
        if (mounted) setRows(data);
      } catch (e) {
        if (mounted) setError(getErrorMessage(e, 'Falha ao carregar top clientes'));
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [startDate, endDate, topN, canFilterEquipe, canFilterVendedor]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setMovLoading(true);
      setMovError(null);
      try {
        const res = await fetchClientesCrescimento({
          ano: periodType === 'personalizado' ? undefined : ano,
          mes: periodType === 'mensal' ? mes : undefined,
          janela,
          base: baseComparacao,
          equipe: canFilterEquipe && selectedEquipe ? selectedEquipe : undefined,
          vendedor: canFilterVendedor && selectedVendedor ? selectedVendedor : undefined,
          limit: 100,
        });
        if (mounted) setMovimento(res);
      } catch (e) {
        if (mounted) setMovError(getErrorMessage(e, 'Falha ao carregar o comparativo de carteira'));
      } finally {
        if (mounted) setMovLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [ano, mes, periodType, janela, baseComparacao, canFilterEquipe, canFilterVendedor, selectedEquipe, selectedVendedor]);

  const equipeOptions = useMemo(() => {
    const set = new Set<string>();
    (filterOptions?.equipes || []).forEach((eq) => set.add(eq));
    rows.forEach((c) => {
      if (c.equipe) set.add(c.equipe);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [filterOptions, rows]);

  const vendedorOptions = useMemo(() => {
    const map = new Map<string, string>();
    (filterOptions?.vendedores || []).forEach((v) => {
      if (selectedEquipe && v.equipe !== selectedEquipe) return;
      map.set(v.codVendedor, v.nome);
    });
    rows.forEach((c) => {
      if (!c.vendedor) return;
      if (selectedEquipe && c.equipe !== selectedEquipe) return;
      map.set(c.vendedorCod || c.vendedor, c.vendedor);
    });
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1], 'pt-BR'));
  }, [filterOptions, rows, selectedEquipe]);

  useEffect(() => {
    if (selectedVendedor && !vendedorOptions.some(([code]) => code === selectedVendedor)) {
      setSelectedVendedor('');
    }
  }, [vendedorOptions, selectedVendedor]);

  /**
   * Ranking já filtrado e renumerado.
   *
   * A posição é recalculada depois do filtro: mostrar "7, 12, 30" numa lista
   * de três linhas faria o usuário procurar as que faltam.
   */
  const rankingFiltrado = useMemo(() => {
    const filtradas = rows.filter((c) => {
      const matchesEquipe = !selectedEquipe || c.equipe === selectedEquipe;
      const matchesVendedor = !selectedVendedor || (c.vendedorCod || c.vendedor) === selectedVendedor;
      return matchesEquipe && matchesVendedor;
    });
    const recortadas = filtradas.slice(0, topN);
    const total = recortadas.reduce((acc, c) => acc + c.faturamento, 0) || 1;
    return recortadas.map((c, i) => ({
      ...c,
      pos: i + 1,
      part: (c.faturamento / total) * 100,
    }));
  }, [rows, selectedEquipe, selectedVendedor, topN]);

  const maxPart = useMemo(
    () => Math.max(1, ...rankingFiltrado.map((c) => c.part)),
    [rankingFiltrado]
  );

  const thStyle: React.CSSProperties = {
    padding: '10px 12px',
    fontSize: 11,
    fontWeight: 700,
    color: t.textMuted,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    textAlign: 'left',
    borderBottom: `1px solid ${t.border}`,
    background: t.surfaceElevated,
    position: 'sticky',
    top: 0,
    whiteSpace: 'nowrap',
  };
  const tdStyle: React.CSSProperties = {
    padding: '10px 12px',
    fontSize: 12.5,
    color: t.text,
    borderBottom: `1px solid ${t.border}`,
  };

  const sectionTitleStyle: React.CSSProperties = {
    fontSize: 13,
    fontWeight: 700,
    color: t.text,
    marginBottom: 10,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <div>
          <h1 className="num" style={{ margin: '0 0 4px', fontSize: 24, fontWeight: 700, color: t.text }}>
            TOP Clientes
          </h1>
          <p style={{ margin: 0, fontSize: 13, color: t.textSecondary }}>
            Ranking da carteira e o movimento dela — quem cresce e quem cai. Clique em um cliente para
            abrir a ficha completa.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <SingleSelectFilter
            label="Exibir"
            options={QUANTIDADES.map((n) => ({ value: String(n), label: `Top ${n}` }))}
            value={String(topN)}
            onChange={(v) => setTopN(Number(v) || 20)}
            allowClear={false}
          />
          {canFilterEquipe && (
            <SingleSelectFilter
              label="Equipe"
              options={equipeOptions.map((eq) => ({ value: eq, label: eq }))}
              value={selectedEquipe}
              onChange={setSelectedEquipe}
              placeholder="Todas as equipes"
              allLabel="Todas as equipes"
            />
          )}
          {canFilterVendedor && (
            <SingleSelectFilter
              label="Vendedor"
              options={vendedorOptions.map(([code, nome]) => ({ value: code, label: nome }))}
              value={selectedVendedor}
              onChange={setSelectedVendedor}
              placeholder="Todos os vendedores"
              allLabel="Todos os vendedores"
            />
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════════
          1. RANKING — tabela com rolagem própria
      ═══════════════════════════════════════════ */}
      <div style={sectionTitleStyle}>
        <Trophy size={15} color={t.accentTeal} />
        Top {topN} da carteira
        {rankingFiltrado.length > 0 && (
          <span
            className="num"
            style={{
              fontSize: 10,
              fontWeight: 700,
              padding: '2px 8px',
              borderRadius: 20,
              background: `${t.primary}15`,
              color: t.primary,
              border: `1px solid ${t.primary}30`,
            }}
          >
            {rankingFiltrado.length}
          </span>
        )}
      </div>

      {loading && <LoadingBlock />}
      {error && <ErrorBlock message={error} />}
      {!loading && !error && rankingFiltrado.length === 0 && <EmptyBlock />}
      {!loading && !error && rankingFiltrado.length > 0 && (
        <div
          style={{
            background: t.surface,
            border: `1px solid ${t.border}`,
            borderRadius: 12,
            overflow: 'hidden',
            marginBottom: 28,
          }}
        >
          {/* Rolagem própria: o ranking cresce até 100 linhas e não pode
              empurrar as tabelas de crescimento para fora da tela. */}
          <div style={{ overflow: 'auto', maxHeight: 460 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ ...thStyle, width: 54 }}>#</th>
                  <th style={thStyle}>Código</th>
                  <th style={thStyle}>Cliente</th>
                  <th style={thStyle}>Vendedor</th>
                  <th style={thStyle}>Equipe</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Faturamento</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Part.%</th>
                </tr>
              </thead>
              <tbody>
                {rankingFiltrado.map((c) => (
                  <tr
                    key={`${c.codigo}-${c.pos}`}
                    onClick={() => setClienteAberto({ codigo: c.codigo, nome: c.nome || c.codigo || '' })}
                    style={{ cursor: 'pointer' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = t.surfaceElevated)}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <td style={tdStyle}>
                      <span
                        className="num"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: 24,
                          height: 24,
                          borderRadius: 6,
                          background: c.pos <= 3 ? `${t.primary}15` : t.surfaceElevated,
                          color: c.pos <= 3 ? t.primary : t.textMuted,
                          fontSize: 11,
                          fontWeight: 700,
                        }}
                      >
                        {c.pos}
                      </span>
                    </td>
                    <td style={{ ...tdStyle, fontFamily: 'var(--ga-mono)', color: t.textMuted }}>{c.codigo || '—'}</td>
                    <td style={{ ...tdStyle, fontWeight: 600 }}>{c.nome || '—'}</td>
                    <td style={{ ...tdStyle, color: t.textSecondary }}>{c.vendedor || '—'}</td>
                    <td style={{ ...tdStyle, color: t.textSecondary }}>{c.equipe || '—'}</td>
                    <td className="num" style={{ ...tdStyle, textAlign: 'right', fontWeight: 700 }}>
                      {fmt(c.faturamento)}
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>
                      <PartBadge value={c.part} max={maxPart} theme={t} mode={mode} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════
          2. CRESCIMENTO x QUEDA — duas tabelas lado a lado
      ═══════════════════════════════════════════ */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          gap: 12,
          flexWrap: 'wrap',
          marginBottom: 10,
        }}
      >
        <div>
          <div style={{ ...sectionTitleStyle, marginBottom: 4 }}>Movimento da carteira</div>
          <p style={{ margin: 0, fontSize: 12, color: t.textSecondary, maxWidth: '62ch' }}>
            Toda a base do recorte atual, não só os primeiros do ranking. Quem aparece só na janela
            atual entra como <strong>novo</strong>; quem aparece só na janela de comparação conta como
            queda total.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <SingleSelectFilter
            label="Janela"
            options={JANELAS.map((j) => ({ value: j.value, label: j.label }))}
            value={janela}
            onChange={(v) => setJanela((v as JanelaCrescimento) || 'mes')}
            allowClear={false}
          />
          <SingleSelectFilter
            label="Comparar com"
            options={BASES.map((b) => ({ value: b.value, label: b.label }))}
            value={baseComparacao}
            onChange={(v) => setBaseComparacao((v as BaseCrescimento) || 'anterior')}
            allowClear={false}
          />
        </div>
      </div>

      {movimento && !movLoading && !movError && (
        <div style={{ fontSize: 11.5, color: t.textMuted, marginBottom: 12 }}>
          Comparando <strong style={{ color: t.text }}>{movimento.periodoAtual.join(' + ') || '—'}</strong> com{' '}
          <strong style={{ color: t.text }}>{movimento.periodoBase.join(' + ') || '—'}</strong> ·{' '}
          {movimento.resumo.clientes} clientes na base · {movimento.resumo.cresceram} em alta ·{' '}
          {movimento.resumo.cairam} em queda
        </div>
      )}

      {movLoading && <LoadingBlock label="Comparando as janelas de período…" />}
      {movError && <ErrorBlock message={movError} />}

      {!movLoading && !movError && movimento && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(380px, 100%), 1fr))',
            gap: 16,
            marginBottom: 12,
          }}
        >
          <TabelaMovimento
            titulo="Em crescimento"
            descricao="Clientes que compraram mais na janela atual"
            icone={<TrendingUp size={15} color={t.success} />}
            cor={t.success}
            linhas={movimento.crescimento}
            total={movimento.resumo.ganho}
            onSelect={(c) => setClienteAberto({ codigo: c.codigo, nome: c.nome || c.codigo })}
          />
          <TabelaMovimento
            titulo="Em queda"
            descricao="Clientes que compraram menos ou pararam de comprar"
            icone={<TrendingDown size={15} color={t.danger} />}
            cor={t.danger}
            linhas={movimento.queda}
            total={movimento.resumo.perda}
            onSelect={(c) => setClienteAberto({ codigo: c.codigo, nome: c.nome || c.codigo })}
          />
        </div>
      )}

      <ClienteDetalhe
        alvo={clienteAberto}
        onClose={() => setClienteAberto(null)}
        ano={periodType === 'personalizado' ? undefined : ano}
        mes={periodType === 'mensal' ? mes : undefined}
        start={startDate || undefined}
        end={endDate || undefined}
        equipe={canFilterEquipe && selectedEquipe ? selectedEquipe : undefined}
        vendedor={canFilterVendedor && selectedVendedor ? selectedVendedor : undefined}
        periodoLabel={periodLabel}
      />
    </div>
  );
};

/**
 * Uma das duas tabelas de movimento.
 *
 * As duas têm exatamente a mesma estrutura de colunas, de propósito: lado a
 * lado, o olho compara linha com linha sem reaprender o layout.
 */
const TabelaMovimento: React.FC<{
  titulo: string;
  descricao: string;
  icone: React.ReactNode;
  cor: string;
  linhas: ClienteCrescimentoRow[];
  total?: number;
  onSelect: (c: ClienteCrescimentoRow) => void;
}> = ({ titulo, descricao, icone, cor, linhas, total, onSelect }) => {
  const { t } = useTheme();

  const thStyle: React.CSSProperties = {
    padding: '9px 11px',
    fontSize: 10.5,
    fontWeight: 700,
    color: t.textMuted,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    textAlign: 'left',
    background: t.surfaceElevated,
    borderBottom: `1px solid ${t.border}`,
    position: 'sticky',
    top: 0,
    whiteSpace: 'nowrap',
  };
  const tdStyle: React.CSSProperties = {
    padding: '9px 11px',
    fontSize: 12,
    color: t.text,
    borderBottom: `1px solid ${t.border}`,
  };

  return (
    <section
      style={{
        background: t.surface,
        border: `1px solid ${t.border}`,
        borderRadius: 12,
        overflow: 'hidden',
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <header style={{ padding: '14px 16px', borderBottom: `1px solid ${t.border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {icone}
          <h3 style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: t.text }}>{titulo}</h3>
          <span
            className="num"
            style={{
              fontSize: 10,
              fontWeight: 700,
              padding: '2px 8px',
              borderRadius: 20,
              background: `${cor}1A`,
              color: cor,
              border: `1px solid ${cor}40`,
            }}
          >
            {linhas.length}
          </span>
          {total !== undefined && total !== 0 && (
            <span className="num" style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 700, color: cor }}>
              {total > 0 ? '+' : ''}
              {fmt(total)}
            </span>
          )}
        </div>
        <div style={{ fontSize: 11.5, color: t.textMuted, marginTop: 3 }}>{descricao}</div>
      </header>

      {linhas.length === 0 ? (
        <div style={{ padding: '26px 16px', textAlign: 'center', fontSize: 12.5, color: t.textMuted }}>
          Nenhum cliente nesta condição na janela escolhida.
        </div>
      ) : (
        <div style={{ overflow: 'auto', maxHeight: 440 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={thStyle}>Cliente</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Anterior</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Atual</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Variação</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((c) => (
                <tr
                  key={c.codigo}
                  onClick={() => onSelect(c)}
                  style={{ cursor: 'pointer' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = t.surfaceElevated)}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <td style={{ ...tdStyle, maxWidth: 220 }}>
                    <div
                      style={{
                        fontWeight: 600,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                      title={c.nome || c.codigo}
                    >
                      {c.nome || c.codigo}
                    </div>
                    <div style={{ fontSize: 10.5, color: t.textMuted, marginTop: 1 }}>
                      {[c.vendedor, c.municipio].filter(Boolean).join(' · ') || c.codigo}
                    </div>
                  </td>
                  <td className="num" style={{ ...tdStyle, textAlign: 'right', color: t.textSecondary }}>
                    {fmt(c.anterior)}
                  </td>
                  <td className="num" style={{ ...tdStyle, textAlign: 'right', fontWeight: 600 }}>
                    {fmt(c.atual)}
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>
                    <div className="num" style={{ fontWeight: 700, color: cor, fontSize: 12 }}>
                      {c.variacao === null ? (c.movimento === 'entrou' ? 'novo' : '—') : fmtPct(c.variacao)}
                    </div>
                    <div className="num" style={{ fontSize: 10.5, color: t.textMuted, marginTop: 1 }}>
                      {c.diferenca > 0 ? '+' : ''}
                      {fmt(c.diferenca)}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};

// Selo de Part.% com intensidade de cor proporcional ao valor na listagem
// atual — mesma cor da marca (respeitando claro/escuro), só a intensidade varia.
const PartBadge: React.FC<{ value: number; max: number; theme: any; mode: 'light' | 'dark' }> = ({
  value,
  max,
  theme: t,
  mode,
}) => {
  const ratio = Math.max(0, Math.min(1, value / max));
  const alpha = Math.round(24 + ratio * 90);
  const bg = `${t.primary}${alpha.toString(16).padStart(2, '0')}`;
  return (
    <span
      className="num"
      style={{
        display: 'inline-block',
        padding: '3px 10px',
        borderRadius: 6,
        fontWeight: 700,
        fontSize: 12,
        background: bg,
        color: mode === 'dark' ? t.text : t.primaryDark,
      }}
    >
      {value.toFixed(1)}%
    </span>
  );
};
