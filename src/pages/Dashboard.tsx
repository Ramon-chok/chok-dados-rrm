import React, { useEffect, useMemo, useState } from 'react';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useGlobalFilter } from '../context/GlobalFilterContext';
import { PeriodSelector } from '../components/common/PeriodSelector';
import { ExportExcelButton } from '../components/common/ExportExcelButton';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '../components/common/DataState';
import {
  fetchDashboard,
  fetchDashboardFilterOptions,
  fetchClienteFabricantes,
  fetchFabricanteDetalhe,
  DashboardResponse,
  DashboardFilterOptions,
  ClienteFabricantesResponse,
  FabricanteDetalheResponse,
} from '../lib/api';
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import { ChevronDown, ChevronRight } from 'lucide-react';

const fmt = (v: number) => `R$ ${v.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`;
const fmtInt = (v: number) => v.toLocaleString('pt-BR', { maximumFractionDigits: 0 });
const fmtPct = (v: number) => `${v.toFixed(1)}%`;

export const DashboardPage: React.FC = () => {
  const { t } = useTheme();
  const { currentUser } = useAuth();
  const { selectedPeriod, startDate, endDate, ano, mes, periodType } = useGlobalFilter();
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const role = currentUser?.role;
  // Admin/Gerência podem escolher equipe e vendedor livremente; Supervisor só
  // escolhe vendedor (a equipe já é a dele, travada no backend); Vendedor não
  // tem filtro (só vê os próprios dados).
  const canFilterEquipe = role === 'ADMIN' || role === 'GERENTE';
  const canFilterVendedor = role === 'ADMIN' || role === 'GERENTE' || role === 'SUPERVISOR';

  const [filterOptions, setFilterOptions] = useState<DashboardFilterOptions | null>(null);
  const [selectedEquipe, setSelectedEquipe] = useState<string>('');
  const [selectedVendedor, setSelectedVendedor] = useState<string>('');

  useEffect(() => {
    if (!canFilterEquipe && !canFilterVendedor) return;
    let mounted = true;
    (async () => {
      try {
        const opts = await fetchDashboardFilterOptions();
        if (mounted) setFilterOptions(opts);
      } catch {
        // Filtros são um extra da tela — se falhar, o dashboard continua
        // funcionando sem eles (mostrando o escopo padrão do usuário).
      }
    })();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Vendedores disponíveis no dropdown: se uma equipe estiver selecionada
  // (Admin/Gerência), restringe a lista a essa equipe.
  const vendedorOptions = useMemo(() => {
    const all = filterOptions?.vendedores || [];
    return selectedEquipe ? all.filter((v) => v.equipe === selectedEquipe) : all;
  }, [filterOptions, selectedEquipe]);

  useEffect(() => {
    if (selectedVendedor && !vendedorOptions.some((v) => v.codVendedor === selectedVendedor)) {
      setSelectedVendedor('');
    }
  }, [vendedorOptions, selectedVendedor]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetchDashboard({
          ano: periodType === 'personalizado' ? undefined : ano,
          mes: periodType === 'mensal' ? mes : undefined,
          start: startDate || undefined,
          end: endDate || undefined,
          equipe: canFilterEquipe && selectedEquipe ? selectedEquipe : undefined,
          vendedor: canFilterVendedor && selectedVendedor ? selectedVendedor : undefined,
        });
        if (mounted) setData(res);
      } catch (e) {
        if (mounted) setError(e instanceof Error ? e.message : 'Falha ao carregar dashboard');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [ano, mes, startDate, endDate, periodType, canFilterEquipe, canFilterVendedor, selectedEquipe, selectedVendedor]);

  // Gráfico mostra Meta x Realizado x Margem por FABRICANTE (não mais por
  // mês) — usa a mesma lista já filtrada por equipe/vendedor que alimenta a
  // tabela de fabricantes abaixo, então reflete o mesmo escopo do usuário.
  const chartData = useMemo(
    () =>
      (data?.fabricantes || []).map((f) => ({
        fabricante: f.fabricante,
        meta: f.meta / 1_000_000,
        realizado: f.realizado / 1_000_000,
        margem: f.pctMargem,
      })),
    [data]
  );

  const kpis = data?.kpis;

  const cardGroups = kpis
    ? [
        [
          {
            kind: 'main' as const,
            title: 'Faturamento',
            meta: kpis.meta,
            realizado: kpis.realizado,
            pct: kpis.atingimento,
            formatter: fmt,
          },
          {
            kind: 'gap' as const,
            title: 'GAP Faturamento',
            gap: kpis.gap,
            pct: kpis.atingimento - 100,
            formatter: fmt,
          },
        ],
        [
          {
            kind: 'main' as const,
            title: 'Cobertura',
            meta: kpis.metaCobertura,
            realizado: kpis.realizadoCobertura,
            pct: kpis.pctCobertura,
            formatter: fmtInt,
          },
          {
            kind: 'gap' as const,
            title: 'GAP Cobertura',
            gap: kpis.gapCobertura,
            pct: kpis.pctCobertura - 100,
            formatter: fmtInt,
          },
        ],
        [
          {
            kind: 'main' as const,
            title: 'Sortimento',
            meta: kpis.metaSortimento,
            realizado: kpis.realizadoSortimento,
            pct: kpis.pctSortimento,
            formatter: fmt,
          },
          {
            kind: 'gap' as const,
            title: 'GAP Sortimento',
            gap: kpis.gapSortimento,
            pct: kpis.pctSortimento - 100,
            formatter: fmt,
          },
        ],
        [
          {
            kind: 'single' as const,
            title: 'Margem Total',
            value: kpis.margem,
          },
        ],
      ]
    : [];

  const handleExport = () => [
    {
      sheetName: 'KPIs',
      data: kpis
        ? [
            { Indicador: 'Meta Faturamento', Valor: kpis.meta },
            { Indicador: 'Realizado Faturamento', Valor: kpis.realizado },
            { Indicador: 'Atingimento Faturamento %', Valor: kpis.atingimento },
            { Indicador: 'GAP Faturamento', Valor: kpis.gap },
            { Indicador: 'Meta Cobertura', Valor: kpis.metaCobertura },
            { Indicador: 'Realizado Cobertura', Valor: kpis.realizadoCobertura },
            { Indicador: 'Atingimento Cobertura %', Valor: kpis.pctCobertura },
            { Indicador: 'GAP Cobertura', Valor: kpis.gapCobertura },
            { Indicador: 'Meta Sortimento', Valor: kpis.metaSortimento },
            { Indicador: 'Realizado Sortimento', Valor: kpis.realizadoSortimento },
            { Indicador: 'Atingimento Sortimento %', Valor: kpis.pctSortimento },
            { Indicador: 'GAP Sortimento', Valor: kpis.gapSortimento },
            { Indicador: 'Margem Total %', Valor: kpis.margem },
          ].map((k) => ({ ...k, Período: selectedPeriod }))
        : [],
    },
    {
      sheetName: 'Top Clientes',
      data: (data?.topClientes || []).map((c, i) => ({
        Posição: i + 1,
        'É Rede': c.eRede ? 'Sim' : 'Não',
        Código: c.codigo || '—',
        Cliente: c.nome,
        Equipe: c.equipe,
        Faturamento: c.valor,
      })),
    },
    {
      sheetName: 'Fabricantes',
      data: (data?.fabricantes || []).map((f) => ({
        Fabricante: f.fabricante,
        Meta: f.meta,
        Realizado: f.realizado,
        'Atingimento %': f.pctR,
        'Meta Cobertura': f.metaCobertura,
        'Realizado Cobertura': f.realizadoCobertura,
        'Atingimento Cobertura %': f.pctCob,
        'Margem %': f.pctMargem,
      })),
    },
  ];

  // ─── Estilos base reutilizáveis ─────────────────────────────
  const cardStyle: React.CSSProperties = {
    background: t.surface,
    border: `1px solid ${t.border}`,
    borderRadius: 12,
    padding: '14px 16px',
    flex: 1,
    minWidth: 0,
  };
  const cardTitleStyle: React.CSSProperties = {
    fontSize: 11.5,
    color: t.textMuted,
    marginBottom: 8,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  };
  const statLabelStyle: React.CSSProperties = { fontSize: 10.5, color: t.textMuted, marginBottom: 2 };
  const statValueStyle: React.CSSProperties = { fontSize: 15, fontWeight: 700, color: t.text };
  const sectionTitleStyle: React.CSSProperties = {
    fontSize: 13,
    fontWeight: 700,
    color: t.text,
    marginBottom: 12,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  };
  const sectionBadgeStyle: React.CSSProperties = {
    fontSize: 10,
    fontWeight: 700,
    padding: '2px 8px',
    borderRadius: 20,
    background: `${t.primary}15`,
    color: t.primary,
    border: `1px solid ${t.primary}30`,
  };

  const posColor = (v: number) => (v >= 0 ? '#3DD68C' : t.primaryHover);
  const pctColor = (v: number) => (v >= 100 ? '#3DD68C' : v >= 80 ? '#F59E0B' : t.primaryHover);

  const filterSelectStyle: React.CSSProperties = {
    fontSize: '13px',
    fontWeight: 600,
    color: t.text,
    background: t.surfaceElevated,
    border: `1px solid ${t.border}`,
    borderRadius: '6px',
    padding: '5px 26px 5px 10px',
    cursor: 'pointer',
    outline: 'none',
    appearance: 'none',
    WebkitAppearance: 'none',
  };

  // ─── Fabricantes: expandir para ver a quebra por equipe/vendedor ───
  // Vendedor não tem o que abrir — já vê só o próprio número.
  const canDrilldownFabricante = role !== 'VENDEDOR';
  const [expandedFabricante, setExpandedFabricante] = useState<string | null>(null);
  const [fabricanteDetalhe, setFabricanteDetalhe] = useState<Record<string, FabricanteDetalheResponse | 'loading' | 'error'>>({});

  // Filtros/período mudaram → os números do dashboard mudaram, então qualquer
  // detalhe de fabricante já buscado fica desatualizado.
  useEffect(() => {
    setExpandedFabricante(null);
    setFabricanteDetalhe({});
  }, [data]);

  const handleToggleFabricante = async (fabricante: string) => {
    if (expandedFabricante === fabricante) {
      setExpandedFabricante(null);
      return;
    }
    setExpandedFabricante(fabricante);
    if (fabricanteDetalhe[fabricante]) return;
    setFabricanteDetalhe((prev) => ({ ...prev, [fabricante]: 'loading' }));
    try {
      const res = await fetchFabricanteDetalhe({
        fabricante,
        ano: periodType === 'personalizado' ? undefined : ano,
        mes: periodType === 'mensal' ? mes : undefined,
        start: startDate || undefined,
        end: endDate || undefined,
        equipe: canFilterEquipe && selectedEquipe ? selectedEquipe : undefined,
        vendedor: canFilterVendedor && selectedVendedor ? selectedVendedor : undefined,
      });
      setFabricanteDetalhe((prev) => ({ ...prev, [fabricante]: res }));
    } catch {
      setFabricanteDetalhe((prev) => ({ ...prev, [fabricante]: 'error' }));
    }
  };

  // ─── Top Clientes: expandir para ver a quebra por fabricante ───
  const [expandedCliente, setExpandedCliente] = useState<string | null>(null);
  const [clienteFabricantes, setClienteFabricantes] = useState<Record<string, ClienteFabricantesResponse | 'loading' | 'error'>>({});

  const handleToggleCliente = async (clienteKey: string, codigo: string | null, nome: string) => {
    if (expandedCliente === clienteKey) {
      setExpandedCliente(null);
      return;
    }
    setExpandedCliente(clienteKey);
    if (clienteFabricantes[clienteKey]) return;
    setClienteFabricantes((prev) => ({ ...prev, [clienteKey]: 'loading' }));
    try {
      const res = await fetchClienteFabricantes({
        codigo: codigo || undefined,
        nome: codigo ? undefined : nome,
        ano: periodType === 'personalizado' ? undefined : ano,
        mes: periodType === 'mensal' ? mes : undefined,
        start: startDate || undefined,
        end: endDate || undefined,
        equipe: canFilterEquipe && selectedEquipe ? selectedEquipe : undefined,
        vendedor: canFilterVendedor && selectedVendedor ? selectedVendedor : undefined,
      });
      setClienteFabricantes((prev) => ({ ...prev, [clienteKey]: res }));
    } catch {
      setClienteFabricantes((prev) => ({ ...prev, [clienteKey]: 'error' }));
    }
  };

  // ─── Estilos das tabelas ────────────────────────────────────
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
  };
  const tdStyle: React.CSSProperties = {
    padding: '10px 12px',
    fontSize: 12.5,
    color: t.text,
    borderBottom: `1px solid ${t.border}`,
  };

  return (
    <div>
      {/* ═══════════════════════════════════════════
          HEADER
      ═══════════════════════════════════════════ */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 20,
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div>
          <h1 className="num" style={{ margin: '0 0 4px', fontSize: 24, fontWeight: 700, color: t.text }}>
            Dashboard
          </h1>
          <p style={{ margin: 0, fontSize: 13, color: t.textSecondary }}>
            Dados consolidados diretamente do banco de dados.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <PeriodSelector />
          {canFilterEquipe && (
            <div style={{ position: 'relative' }}>
              <select
                value={selectedEquipe}
                onChange={(e) => setSelectedEquipe(e.target.value)}
                style={filterSelectStyle}
              >
                <option value="">Todas as equipes</option>
                {(filterOptions?.equipes || []).map((eq) => (
                  <option key={eq} value={eq}>
                    {eq}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={13}
                color={t.textMuted}
                style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
              />
            </div>
          )}
          {canFilterVendedor && (
            <div style={{ position: 'relative' }}>
              <select
                value={selectedVendedor}
                onChange={(e) => setSelectedVendedor(e.target.value)}
                style={filterSelectStyle}
              >
                <option value="">Todos os vendedores</option>
                {vendedorOptions.map((v) => (
                  <option key={v.codVendedor} value={v.codVendedor}>
                    {v.nome}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={13}
                color={t.textMuted}
                style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
              />
            </div>
          )}
          <ExportExcelButton getSheets={handleExport} fileName={`dashboard-${selectedPeriod}`} />
        </div>
      </div>

      {loading && <LoadingBlock />}
      {error && <ErrorBlock message={error} />}
      {!loading && !error && !data && <EmptyBlock />}

      {!loading && !error && data && kpis && (
        <>
          {/* ═══════════════════════════════════════════
              SEÇÃO 1: KPIs
          ═══════════════════════════════════════════ */}
          <div style={{ marginBottom: 24 }}>
            <div style={sectionTitleStyle}>
              Indicadores de Performance
              <span style={sectionBadgeStyle}>{selectedPeriod}</span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
              {cardGroups.map((group, gi) => (
                <div
                  key={gi}
                  style={{
                    display: 'flex',
                    gap: 12,
                    flex: group.length > 1 ? '1 1 380px' : '1 1 160px',
                  }}
                >
                  {group.map((card, ci) => {
                    if (card.kind === 'main') {
                      return (
                        <div key={ci} style={cardStyle}>
                          <div style={cardTitleStyle}>{card.title}</div>
                          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                            <div style={{ minWidth: 70 }}>
                              <div style={statLabelStyle}>Meta</div>
                              <div className="num" style={statValueStyle}>
                                {card.formatter(card.meta)}
                              </div>
                            </div>
                            <div style={{ minWidth: 70 }}>
                              <div style={statLabelStyle}>Realizado</div>
                              <div className="num" style={statValueStyle}>
                                {card.formatter(card.realizado)}
                              </div>
                            </div>
                            <div style={{ minWidth: 60 }}>
                              <div style={statLabelStyle}>Atingimento</div>
                              <div className="num" style={{ ...statValueStyle, color: t.primary }}>
                                {fmtPct(card.pct)}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    }
                    if (card.kind === 'gap') {
                      return (
                        <div key={ci} style={cardStyle}>
                          <div style={cardTitleStyle}>{card.title}</div>
                          <div
                            className="num"
                            style={{
                              fontSize: 17,
                              fontWeight: 700,
                              color: posColor(card.gap),
                              marginBottom: 3,
                            }}
                          >
                            {card.formatter(card.gap)}
                          </div>
                          <div
                            className="num"
                            style={{ fontSize: 12, fontWeight: 600, color: posColor(card.pct) }}
                          >
                            {card.pct >= 0 ? '+' : ''}
                            {fmtPct(card.pct)}
                          </div>
                        </div>
                      );
                    }
                    return (
                      <div key={ci} style={cardStyle}>
                        <div style={cardTitleStyle}>{card.title}</div>
                        <div className="num" style={{ fontSize: 18, fontWeight: 700, color: t.text }}>
                          {fmtPct(card.value)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          {/* ═══════════════════════════════════════════
              SEÇÃO 2: GRÁFICO POR FABRICANTE
          ═══════════════════════════════════════════ */}
          <div style={{ marginBottom: 24 }}>
            <div style={sectionTitleStyle}>Meta x Realizado por Fabricante</div>
            <div
              style={{
                background: t.surface,
                border: `1px solid ${t.border}`,
                borderRadius: 12,
                padding: '20px 20px 12px',
                height: 380,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 14,
                }}
              >
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: t.text }}>
                    Meta x Realizado
                  </div>
                  <div style={{ fontSize: 11.5, color: t.textMuted, marginTop: 2 }}>
                    Valores em milhões (R$) por fabricante · Margem em percentual
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
                  <LegendItem color={t.textMuted} label="Meta" theme={t} />
                  <LegendItem color={t.primary} label="Realizado" theme={t} />
                  <LegendItem color="#3DD68C" label="Margem %" theme={t} line />
                </div>
              </div>

              {chartData.length === 0 ? (
                <EmptyBlock
                  title="Sem fabricantes"
                  description="Importe indicadores por fabricante para ver o gráfico."
                />
              ) : (
                <ResponsiveContainer width="100%" height="82%">
                  <ComposedChart data={chartData} margin={{ top: 8, right: 8, left: -8, bottom: 24 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={t.border} vertical={false} />
                    <XAxis
                      dataKey="fabricante"
                      stroke={t.textMuted}
                      fontSize={11}
                      tickLine={false}
                      axisLine={{ stroke: t.border }}
                      angle={-20}
                      textAnchor="end"
                      interval={0}
                      height={50}
                    />
                    <YAxis
                      yAxisId="left"
                      stroke={t.textMuted}
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      stroke={t.textMuted}
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v) => `${v}%`}
                    />
                    <Tooltip
                      cursor={{ fill: `${t.primary}08` }}
                      contentStyle={{
                        background: t.surface,
                        border: `1px solid ${t.border}`,
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                      formatter={(value: number, name: string) =>
                        name === 'Margem %'
                          ? [fmtPct(value), name]
                          : [`R$ ${value.toFixed(2)} mi`, name]
                      }
                    />
                    <Bar
                      yAxisId="left"
                      dataKey="meta"
                      name="Meta"
                      fill={t.textMuted}
                      radius={[4, 4, 0, 0]}
                      maxBarSize={40}
                    />
                    <Bar
                      yAxisId="left"
                      dataKey="realizado"
                      name="Realizado"
                      fill={t.primary}
                      radius={[4, 4, 0, 0]}
                      maxBarSize={40}
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="margem"
                      name="Margem %"
                      stroke="#3DD68C"
                      strokeWidth={2.5}
                      dot={{ r: 3, fill: '#3DD68C' }}
                      activeDot={{ r: 5 }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* ═══════════════════════════════════════════
              SEÇÃO 3: TOP CLIENTES (largura total)
          ═══════════════════════════════════════════ */}
          <div style={{ marginBottom: 24 }}>
            <div style={sectionTitleStyle}>
              Top Clientes
              {(data.topClientes || []).length > 0 && (
                <span style={sectionBadgeStyle}>{data.topClientes.length}</span>
              )}
            </div>
            <div
              style={{
                background: t.surface,
                border: `1px solid ${t.border}`,
                borderRadius: 12,
                overflow: 'hidden',
              }}
            >
              {(data.topClientes || []).length === 0 ? (
                <div style={{ padding: 16 }}>
                  <EmptyBlock title="Sem clientes" />
                </div>
              ) : (
                <div style={{ overflowX: 'auto', maxHeight: 420 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        <th style={{ ...thStyle, width: 50 }}>#</th>
                        <th style={thStyle}>Código</th>
                        <th style={thStyle}>Cliente</th>
                        <th style={thStyle}>Equipe</th>
                        <th style={{ ...thStyle, textAlign: 'right' }}>Valor</th>
                        <th style={{ ...thStyle, width: 40 }} />
                      </tr>
                    </thead>
                    <tbody>
                      {data.topClientes.map((c, i) => {
                        const clienteKey = `${c.codigo || c.nome}-${i}`;
                        const isOpen = expandedCliente === clienteKey;
                        const detail = clienteFabricantes[clienteKey];
                        return (
                          <React.Fragment key={clienteKey}>
                            <tr
                              style={{ transition: 'background 0.15s', cursor: 'pointer' }}
                              onClick={() => handleToggleCliente(clienteKey, c.codigo, c.nome)}
                              onMouseEnter={(e) => (e.currentTarget.style.background = t.surfaceElevated)}
                              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                            >
                              <td style={tdStyle}>
                                <span
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    width: 24,
                                    height: 24,
                                    borderRadius: 6,
                                    background: i < 3 ? `${t.primary}15` : t.surfaceElevated,
                                    color: i < 3 ? t.primary : t.textMuted,
                                    fontSize: 11,
                                    fontWeight: 700,
                                  }}
                                >
                                  {i + 1}
                                </span>
                              </td>
                              <td style={{ ...tdStyle, color: t.textMuted, fontFamily: 'monospace' }}>
                                {c.eRede ? '—' : c.codigo || '—'}
                              </td>
                              <td style={{ ...tdStyle, fontWeight: 600 }}>{c.nome}</td>
                              <td style={{ ...tdStyle, color: t.textSecondary }}>{c.equipe || '—'}</td>
                              <td
                                className="num"
                                style={{ ...tdStyle, textAlign: 'right', fontWeight: 700, color: t.text }}
                              >
                                {fmt(c.valor)}
                              </td>
                              <td style={{ ...tdStyle, textAlign: 'center', color: t.textMuted }}>
                                {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                              </td>
                            </tr>
                            {isOpen && (
                              <tr>
                                <td colSpan={6} style={{ padding: 0, background: t.surfaceElevated, borderBottom: `1px solid ${t.border}` }}>
                                  <div style={{ padding: '10px 16px 14px 58px' }}>
                                    {detail === 'loading' && (
                                      <div style={{ fontSize: 12, color: t.textMuted }}>Carregando fabricantes…</div>
                                    )}
                                    {detail === 'error' && (
                                      <div style={{ fontSize: 12, color: t.primaryHover }}>
                                        Não foi possível carregar a quebra por fabricante.
                                      </div>
                                    )}
                                    {detail && detail !== 'loading' && detail !== 'error' && (
                                      <>
                                        <div style={{ fontSize: 10.5, color: t.textMuted, marginBottom: 8, fontStyle: 'italic' }}>
                                          Desempenho por fabricante do(s) vendedor(es) responsável(is) por este
                                          cliente — não é a divisão exata da compra deste cliente por fabricante
                                          (a base de vendas não registra o fabricante do produto).
                                        </div>
                                        {detail.fabricantes.length === 0 ? (
                                          <div style={{ fontSize: 12, color: t.textMuted }}>Sem dados de fabricante para este cliente.</div>
                                        ) : (
                                          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                            <thead>
                                              <tr>
                                                <th style={{ ...thStyle, background: 'transparent', position: 'static' }}>Fabricante</th>
                                                <th style={{ ...thStyle, background: 'transparent', position: 'static', textAlign: 'right' }}>Meta</th>
                                                <th style={{ ...thStyle, background: 'transparent', position: 'static', textAlign: 'right' }}>Realizado</th>
                                                <th style={{ ...thStyle, background: 'transparent', position: 'static', textAlign: 'right' }}>% Ating.</th>
                                                <th style={{ ...thStyle, background: 'transparent', position: 'static', textAlign: 'right' }}>% Cob.</th>
                                              </tr>
                                            </thead>
                                            <tbody>
                                              {detail.fabricantes.map((f) => (
                                                <tr key={f.fabricante}>
                                                  <td style={{ ...tdStyle, fontWeight: 600 }}>{f.fabricante}</td>
                                                  <td className="num" style={{ ...tdStyle, textAlign: 'right' }}>{fmt(f.meta)}</td>
                                                  <td className="num" style={{ ...tdStyle, textAlign: 'right', fontWeight: 600 }}>{fmt(f.realizado)}</td>
                                                  <td className="num" style={{ ...tdStyle, textAlign: 'right' }}>{fmtPct(f.pctR)}</td>
                                                  <td className="num" style={{ ...tdStyle, textAlign: 'right' }}>{fmtPct(f.pctCob)}</td>
                                                </tr>
                                              ))}
                                            </tbody>
                                          </table>
                                        )}
                                      </>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* ═══════════════════════════════════════════
              SEÇÃO 4: FABRICANTES (largura total, abaixo)
          ═══════════════════════════════════════════ */}
          <div style={{ marginBottom: 8 }}>
            <div style={sectionTitleStyle}>
              Performance por Fabricante
              {(data.fabricantes || []).length > 0 && (
                <span style={sectionBadgeStyle}>{data.fabricantes.length}</span>
              )}
            </div>
            <div
              style={{
                background: t.surface,
                border: `1px solid ${t.border}`,
                borderRadius: 12,
                overflow: 'hidden',
              }}
            >
              {(data.fabricantes || []).length === 0 ? (
                <div style={{ padding: 16 }}>
                  <EmptyBlock title="Sem fabricantes" />
                </div>
              ) : (
                <div style={{ overflowX: 'auto', maxHeight: 480 }}>
                  <table
                    style={{
                      width: '100%',
                      borderCollapse: 'collapse',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    <thead>
                      <tr>
                        <th style={{ ...thStyle, width: 28 }} />
                        <th style={thStyle}>Fabricante</th>
                        <th style={{ ...thStyle, textAlign: 'right' }}>Meta</th>
                        <th style={{ ...thStyle, textAlign: 'right' }}>Realizado</th>
                        <th style={{ ...thStyle, textAlign: 'right' }}>% Ating.</th>
                        <th style={{ ...thStyle, textAlign: 'right' }}>Meta Cob.</th>
                        <th style={{ ...thStyle, textAlign: 'right' }}>Real. Cob.</th>
                        <th style={{ ...thStyle, textAlign: 'right' }}>% Cob.</th>
                        <th style={{ ...thStyle, textAlign: 'right' }}>Margem %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.fabricantes.map((f) => {
                        const isOpen = expandedFabricante === f.fabricante;
                        const detail = fabricanteDetalhe[f.fabricante];
                        return (
                          <React.Fragment key={f.fabricante}>
                            <tr
                              style={{ transition: 'background 0.15s', cursor: canDrilldownFabricante ? 'pointer' : 'default' }}
                              onClick={() => canDrilldownFabricante && handleToggleFabricante(f.fabricante)}
                              onMouseEnter={(e) => (e.currentTarget.style.background = t.surfaceElevated)}
                              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                            >
                              <td style={{ ...tdStyle, textAlign: 'center', color: t.textMuted }}>
                                {canDrilldownFabricante && (isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />)}
                              </td>
                              <td style={{ ...tdStyle, fontWeight: 600 }}>{f.fabricante}</td>
                              <td className="num" style={{ ...tdStyle, textAlign: 'right' }}>
                                {fmt(f.meta)}
                              </td>
                              <td
                                className="num"
                                style={{ ...tdStyle, textAlign: 'right', fontWeight: 600 }}
                              >
                                {fmt(f.realizado)}
                              </td>
                              <td style={{ ...tdStyle, textAlign: 'right' }}>
                                <PctWithBar value={f.pctR} color={pctColor(f.pctR)} theme={t} />
                              </td>
                              <td className="num" style={{ ...tdStyle, textAlign: 'right', color: t.textSecondary }}>
                                {fmtInt(f.metaCobertura)}
                              </td>
                              <td className="num" style={{ ...tdStyle, textAlign: 'right' }}>
                                {fmtInt(f.realizadoCobertura)}
                              </td>
                              <td style={{ ...tdStyle, textAlign: 'right' }}>
                                <PctWithBar value={f.pctCob} color={pctColor(f.pctCob)} theme={t} />
                              </td>
                              <td
                                className="num"
                                style={{
                                  ...tdStyle,
                                  textAlign: 'right',
                                  fontWeight: 600,
                                  color: f.pctMargem >= 0 ? '#3DD68C' : t.primaryHover,
                                }}
                              >
                                {fmtPct(f.pctMargem)}
                              </td>
                            </tr>
                            {isOpen && (
                              <tr>
                                <td colSpan={9} style={{ padding: 0, background: t.surfaceElevated, borderBottom: `1px solid ${t.border}` }}>
                                  <div style={{ padding: '10px 16px 14px 44px' }}>
                                    {detail === 'loading' && (
                                      <div style={{ fontSize: 12, color: t.textMuted }}>Carregando detalhamento…</div>
                                    )}
                                    {detail === 'error' && (
                                      <div style={{ fontSize: 12, color: t.primaryHover }}>
                                        Não foi possível carregar o detalhamento deste fabricante.
                                      </div>
                                    )}
                                    {detail && detail !== 'loading' && detail !== 'error' && (
                                      <FabricanteDrilldown detail={detail} theme={t} pctColor={pctColor} />
                                    )}
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════
// COMPONENTE AUXILIAR - Legenda customizada
// ═══════════════════════════════════════════
const LegendItem: React.FC<{ color: string; label: string; theme: any; line?: boolean }> = ({
  color,
  label,
  theme: t,
  line,
}) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
    {line ? (
      <div style={{ width: 14, height: 2.5, background: color, borderRadius: 1 }} />
    ) : (
      <div style={{ width: 12, height: 12, background: color, borderRadius: 3 }} />
    )}
    <span style={{ fontSize: 11.5, color: t.textSecondary, fontWeight: 500 }}>{label}</span>
  </div>
);

// ═══════════════════════════════════════════
// COMPONENTE AUXILIAR - Percentual + barra de progresso
// ═══════════════════════════════════════════
const PctWithBar: React.FC<{ value: number; color: string; theme: any }> = ({ value, color, theme: t }) => (
  <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
    <span className="num" style={{ fontSize: 12.5, fontWeight: 700, color }}>
      {`${value.toFixed(1)}%`}
    </span>
    <div style={{ width: 64, height: 5, borderRadius: 3, background: t.border, overflow: 'hidden' }}>
      <div
        style={{
          width: `${Math.max(0, Math.min(100, value))}%`,
          height: '100%',
          background: color,
          borderRadius: 3,
        }}
      />
    </div>
  </div>
);

// ═══════════════════════════════════════════
// COMPONENTE AUXILIAR - Detalhamento de fabricante por equipe/vendedor
// Admin/Gerência sem filtro de equipe veem várias equipes (cada uma com seus
// vendedores); Supervisor — ou Admin/Gerência já filtrando por equipe — cai
// no caso de uma única equipe, e mostra só os vendedores dela.
// ═══════════════════════════════════════════
const FabricanteDrilldown: React.FC<{
  detail: import('../lib/api').FabricanteDetalheResponse;
  theme: any;
  pctColor: (v: number) => string;
}> = ({ detail, theme: t, pctColor }) => {
  const thStyle: React.CSSProperties = {
    padding: '8px 10px',
    fontSize: 10.5,
    fontWeight: 700,
    color: t.textMuted,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    textAlign: 'left',
  };
  const tdStyle: React.CSSProperties = {
    padding: '8px 10px',
    fontSize: 12,
    color: t.text,
    borderBottom: `1px solid ${t.border}`,
  };

  if (detail.equipes.length === 0) {
    return <div style={{ fontSize: 12, color: t.textMuted }}>Sem dados para este fabricante.</div>;
  }

  const renderVendedorRows = (vendedores: typeof detail.equipes[0]['vendedores']) =>
    vendedores.map((v) => (
      <tr key={v.codVendedor}>
        <td style={{ ...tdStyle, paddingLeft: 24 }}>{v.nome}</td>
        <td className="num" style={{ ...tdStyle, textAlign: 'right' }}>{fmt(v.meta)}</td>
        <td className="num" style={{ ...tdStyle, textAlign: 'right', fontWeight: 600 }}>{fmt(v.realizado)}</td>
        <td style={{ ...tdStyle, textAlign: 'right' }}>
          <PctWithBar value={v.pctR} color={pctColor(v.pctR)} theme={t} />
        </td>
        <td className="num" style={{ ...tdStyle, textAlign: 'right', color: t.textSecondary }}>{fmtInt(v.metaCobertura)}</td>
        <td className="num" style={{ ...tdStyle, textAlign: 'right' }}>{fmtInt(v.realizadoCobertura)}</td>
        <td style={{ ...tdStyle, textAlign: 'right' }}>
          <PctWithBar value={v.pctCob} color={pctColor(v.pctCob)} theme={t} />
        </td>
      </tr>
    ));

  const single = detail.equipes.length === 1;

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr>
          <th style={thStyle}>{single ? 'Vendedor' : 'Equipe / Vendedor'}</th>
          <th style={{ ...thStyle, textAlign: 'right' }}>Meta</th>
          <th style={{ ...thStyle, textAlign: 'right' }}>Realizado</th>
          <th style={{ ...thStyle, textAlign: 'right' }}>% Ating.</th>
          <th style={{ ...thStyle, textAlign: 'right' }}>Meta Cob.</th>
          <th style={{ ...thStyle, textAlign: 'right' }}>Real. Cob.</th>
          <th style={{ ...thStyle, textAlign: 'right' }}>% Cob.</th>
        </tr>
      </thead>
      <tbody>
        {single
          ? renderVendedorRows(detail.equipes[0].vendedores)
          : detail.equipes.map((eq) => (
              <React.Fragment key={eq.equipe}>
                <tr>
                  <td style={{ ...tdStyle, fontWeight: 700 }}>{eq.equipe}</td>
                  <td className="num" style={{ ...tdStyle, textAlign: 'right', fontWeight: 700 }}>{fmt(eq.meta)}</td>
                  <td className="num" style={{ ...tdStyle, textAlign: 'right', fontWeight: 700 }}>{fmt(eq.realizado)}</td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>
                    <PctWithBar value={eq.pctR} color={pctColor(eq.pctR)} theme={t} />
                  </td>
                  <td className="num" style={{ ...tdStyle, textAlign: 'right', fontWeight: 700, color: t.textSecondary }}>{fmtInt(eq.metaCobertura)}</td>
                  <td className="num" style={{ ...tdStyle, textAlign: 'right', fontWeight: 700 }}>{fmtInt(eq.realizadoCobertura)}</td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>
                    <PctWithBar value={eq.pctCob} color={pctColor(eq.pctCob)} theme={t} />
                  </td>
                </tr>
                {renderVendedorRows(eq.vendedores)}
              </React.Fragment>
            ))}
      </tbody>
    </table>
  );
};