import React, { useEffect, useMemo, useState } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { ScrollableChart } from '../../components/common/ScrollableChart';
import { useGlobalFilter } from '../../context/GlobalFilterContext';
import { PeriodSelector } from '../../components/common/PeriodSelector';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '../../components/common/DataState';
import { fetchAnalyticsTree, AnalyticsTreeNode } from '../../lib/api';
import { BarChart, ComposedChart, Bar, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

const fmt = (v: number) => `R$ ${v.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`;
const fmtInt = (v: number) => v.toLocaleString('pt-BR', { maximumFractionDigits: 0 });

/** Largura mínima da lista de fabricantes/equipes/vendedores; abaixo disso rola na horizontal. */
const TABLE_MIN_WIDTH = 720;

export const AnalisesPage: React.FC = () => {
  const { mode, t } = useTheme();
  const { ano, mes, startDate, endDate, periodType } = useGlobalFilter();
  const [tree, setTree] = useState<AnalyticsTreeNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true); setError(null);
      try {
        const data = await fetchAnalyticsTree({
          ano: periodType === 'personalizado' ? undefined : ano,
          mes: periodType === 'mensal' ? mes : undefined,
          start: startDate || undefined,
          end: endDate || undefined,
        });
        if (mounted) setTree(data);
      } catch (e) {
        if (mounted) setError(e instanceof Error ? e.message : 'Falha ao carregar análises');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [ano, mes, startDate, endDate, periodType]);

  const chartData = useMemo(() => tree.map((f) => ({ nome: f.nome, meta: f.meta, realizado: f.realizado })), [tree]);
  const coberturaChartData = useMemo(() => tree.map((f) => ({ nome: f.nome, meta: f.metaCobertura, realizado: f.realizadoCobertura })), [tree]);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 18, gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 className="num" style={{ margin: '0 0 4px', fontSize: 24, fontWeight: 700, color: t.text }}>Análises</h1>
          <p style={{ margin: 0, fontSize: 13, color: t.textSecondary }}>Árvore fabricante → equipe → vendedor (indicadores_fabricante).</p>
        </div>
        <PeriodSelector />
      </div>
      {loading && <LoadingBlock />}
      {error && <ErrorBlock message={error} />}
      {!loading && !error && tree.length === 0 && <EmptyBlock />}
      {!loading && !error && tree.length > 0 && (
        <>
          <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 12, padding: 16, height: 260, marginBottom: 16 }}>
            <ScrollableChart minWidth={Math.max(0, chartData.length * 90)} height="100%"><ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke={t.border} />
                <XAxis dataKey="nome" stroke={t.textMuted} fontSize={11} />
                <YAxis stroke={t.textMuted} fontSize={11} />
                <Tooltip />
                <Bar dataKey="meta" fill={t.textMuted} />
                <Bar dataKey="realizado" fill={t.primary} />
              </BarChart>
            </ResponsiveContainer></ScrollableChart>
          </div>
          <div style={{ fontSize: 12, fontWeight: 600, color: t.textSecondary, marginBottom: 6 }}>Cobertura</div>
          <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 12, padding: 16, height: 260, marginBottom: 16 }}>
            <ScrollableChart minWidth={Math.max(0, coberturaChartData.length * 90)} height="100%"><ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={coberturaChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke={t.border} />
                <XAxis dataKey="nome" stroke={t.textMuted} fontSize={11} />
                <YAxis stroke={t.textMuted} fontSize={11} />
                <Tooltip />
                <Bar dataKey="meta" fill={t.textMuted} />
                <Area type="monotone" dataKey="realizado" stroke={t.accentBlue} fill={t.accentBlue} fillOpacity={0.3} />
              </ComposedChart>
            </ResponsiveContainer></ScrollableChart>
          </div>
          <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 12, overflowX: 'auto', overflowY: 'hidden' }}>
            <div style={{ minWidth: TABLE_MIN_WIDTH }}>
            {tree.map((fab) => {
              const isSelected = !!expanded[fab.nome];
              const isHovered = hoveredRow === fab.nome;
              const selectedBg = mode === 'dark' ? `${t.primary}22` : `${t.primary}14`;
              const selectedHoverBg = mode === 'dark' ? `${t.primary}30` : `${t.primary}20`;
              const rowBg = isSelected
                ? isHovered
                  ? selectedHoverBg
                  : selectedBg
                : isHovered
                  ? t.hover
                  : 'transparent';

              return (
                <div key={fab.nome} style={{ borderBottom: `1px solid ${t.border}` }}>
                  <button
                    onClick={() => setExpanded((s) => ({ ...s, [fab.nome]: !s[fab.nome] }))}
                    onMouseEnter={() => setHoveredRow(fab.nome)}
                    onMouseLeave={() => setHoveredRow(null)}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '12px 14px',
                      background: rowBg,
                      border: 'none',
                      borderLeft: `3px solid ${isSelected ? t.primary : isHovered ? t.borderActive : 'transparent'}`,
                      color: isSelected ? t.primary : t.text,
                      cursor: 'pointer',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: 16,
                      transition: 'background 0.15s ease, color 0.15s ease, border-color 0.15s ease',
                      boxShadow: isSelected
                        ? mode === 'dark'
                          ? `inset 0 0 0 1px ${t.primary}33`
                          : `inset 0 0 0 1px ${t.primary}28`
                        : 'none',
                    }}
                  >
                    <strong style={{ color: isSelected ? t.primary : t.text, minWidth: 0, overflowWrap: 'anywhere' }}>{fab.nome}</strong>
                    <span
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 14,
                        flexShrink: 0,
                        whiteSpace: 'nowrap',
                        color: isSelected ? t.primaryHover : t.textSecondary,
                      }}
                    >
                      <span>{fmt(fab.realizado)} / {fmt(fab.meta)}</span>
                      <span style={{ width: 1, height: 14, background: t.border }} />
                      <span style={{ fontSize: 11 }}>
                        Cobertura: {fmtInt(fab.realizadoCobertura)} / {fmtInt(fab.metaCobertura)}
                      </span>
                    </span>
                  </button>
                  {isSelected && (fab.equipes || []).map((eq) => (
                    <div
                      key={eq.nome}
                      style={{
                        padding: '8px 14px 12px 28px',
                        borderTop: `1px solid ${t.border}`,
                        background: mode === 'dark' ? `${t.primary}0D` : `${t.primary}08`,
                        borderLeft: `3px solid ${t.primary}`,
                      }}
                    >
                      <div style={{ fontWeight: 600, marginBottom: 6, color: t.text }}>{eq.nome}</div>
                      {(eq.vendedores || []).map((v) => (
                        <div
                          key={v.nome}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            gap: 16,
                            fontSize: 12.5,
                            color: t.textSecondary,
                            padding: '4px 0',
                          }}
                        >
                          <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>{v.nome}</span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0, whiteSpace: 'nowrap' }}>
                            <span>{fmt(v.realizado)} / {fmt(v.meta)}</span>
                            <span style={{ width: 1, height: 14, background: t.border }} />
                            <span style={{ fontSize: 11 }}>
                              Cobertura: {fmtInt(v.realizadoCobertura)} / {fmtInt(v.metaCobertura)}
                            </span>
                          </span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              );
            })}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
