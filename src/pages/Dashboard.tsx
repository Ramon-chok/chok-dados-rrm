import React, { useEffect, useMemo, useState } from 'react';
import { useTheme } from '../context/ThemeContext';
import { useGlobalFilter } from '../context/GlobalFilterContext';
import { PeriodSelector } from '../components/common/PeriodSelector';
import { ExportExcelButton } from '../components/common/ExportExcelButton';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '../components/common/DataState';
import { fetchDashboard, DashboardResponse } from '../lib/api';
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

const fmt = (v: number) => `R$ ${v.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`;
const fmtInt = (v: number) => v.toLocaleString('pt-BR', { maximumFractionDigits: 0 });
const fmtPct = (v: number) => `${v.toFixed(1)}%`;
const MES = ['', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

export const DashboardPage: React.FC = () => {
  const { t } = useTheme();
  const { selectedPeriod, startDate, endDate, ano, mes, periodType } = useGlobalFilter();
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
  }, [ano, mes, startDate, endDate, periodType]);

  const chartData = useMemo(
    () =>
      (data?.serieMensal || []).map((d) => ({
        mes: `${MES[d.mes] || d.mes}/${String(d.ano).slice(2)}`,
        meta: d.meta / 1_000_000,
        realizado: d.realizado / 1_000_000,
        margem: d.margem,
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
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <PeriodSelector />
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
              SEÇÃO 2: GRÁFICO DE EVOLUÇÃO
          ═══════════════════════════════════════════ */}
          <div style={{ marginBottom: 24 }}>
            <div style={sectionTitleStyle}>Evolução Mensal</div>
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
                    Valores em milhões (R$) · Margem em percentual
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
                  title="Sem série mensal"
                  description="Importe indicadores de vendedor para ver o gráfico."
                />
              ) : (
                <ResponsiveContainer width="100%" height="82%">
                  <ComposedChart data={chartData} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={t.border} vertical={false} />
                    <XAxis
                      dataKey="mes"
                      stroke={t.textMuted}
                      fontSize={11}
                      tickLine={false}
                      axisLine={{ stroke: t.border }}
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
                      </tr>
                    </thead>
                    <tbody>
                      {data.topClientes.map((c, i) => (
                        <tr
                          key={`${c.codigo || c.nome}-${i}`}
                          style={{ transition: 'background 0.15s' }}
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
                        </tr>
                      ))}
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
                      {data.fabricantes.map((f) => (
                        <tr
                          key={f.fabricante}
                          style={{ transition: 'background 0.15s' }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = t.surfaceElevated)}
                          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                        >
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
                          <td
                            className="num"
                            style={{
                              ...tdStyle,
                              textAlign: 'right',
                              fontWeight: 700,
                              color: f.pctR >= 100 ? '#3DD68C' : f.pctR >= 80 ? '#F59E0B' : t.primaryHover,
                            }}
                          >
                            {fmtPct(f.pctR)}
                          </td>
                          <td className="num" style={{ ...tdStyle, textAlign: 'right', color: t.textSecondary }}>
                            {fmtInt(f.metaCobertura)}
                          </td>
                          <td className="num" style={{ ...tdStyle, textAlign: 'right' }}>
                            {fmtInt(f.realizadoCobertura)}
                          </td>
                          <td
                            className="num"
                            style={{
                              ...tdStyle,
                              textAlign: 'right',
                              fontWeight: 700,
                              color: f.pctCob >= 100 ? '#3DD68C' : f.pctCob >= 80 ? '#F59E0B' : t.primaryHover,
                            }}
                          >
                            {fmtPct(f.pctCob)}
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
                      ))}
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