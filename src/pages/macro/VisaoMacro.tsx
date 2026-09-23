import React, { useEffect, useMemo, useState } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { ScrollableChart } from '../../components/common/ScrollableChart';
import { useGlobalFilter } from '../../context/GlobalFilterContext';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '../../components/common/DataState';
import { ExportExcelButton } from '../../components/common/ExportExcelButton';
import { PeriodSelector } from '../../components/common/PeriodSelector';
import { getErrorMessage, fetchDashboard, DashboardResponse } from '../../lib/api';
import { ComposedChart, LineChart, Line, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import {
  AttainmentRanking,
  ChartCard,
  ChartGrid,
  ChartTooltip,
  LegendSwatch,
  ShareDonut,
  StatusTag,
  attainmentStatus,
  fmtBRLShort,
  fmtPct,
  pctOf,
  useChartColors,
} from '../../components/charts/chartKit';

const MES = ['', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const fmt = (v: number) => `R$ ${v.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`;

export const VisaoMacroPage: React.FC = () => {
  const { t } = useTheme();
  const { ano, mes, startDate, endDate, periodType, selectedPeriod } = useGlobalFilter();
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true); setError(null);
      try {
        const res = await fetchDashboard({
          ano: periodType === 'personalizado' ? undefined : ano,
          mes: periodType === 'mensal' ? mes : undefined,
          start: startDate || undefined,
          end: endDate || undefined,
        });
        if (mounted) setData(res);
      } catch (e) {
        if (mounted) setError(getErrorMessage(e, 'Falha ao carregar visão macro'));
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [ano, mes, startDate, endDate, periodType]);

  const colors = useChartColors();
  const chartData = useMemo(() => {
    let metaAcum = 0;
    let realizadoAcum = 0;
    return (data?.serieMensal || []).map((d) => {
      metaAcum += d.meta;
      realizadoAcum += d.realizado;
      return {
        mes: `${MES[d.mes] || d.mes}/${String(d.ano).slice(2)}`,
        meta: d.meta,
        realizado: d.realizado,
        pct: pctOf(d.realizado, d.meta),
        metaAcum,
        realizadoAcum,
        pctAcum: pctOf(realizadoAcum, metaAcum),
      };
    });
  }, [data]);

  const handleExport = () => [{
    sheetName: 'Macro',
    data: (data?.fabricantes || []).map((f) => ({
      Fabricante: f.fabricante, Meta: f.meta, Realizado: f.realizado, GAP: f.gap, Atingimento: f.pctR, Margem: f.pctMargem, Período: selectedPeriod,
    })),
  }];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <div>
          <h1 className="num" style={{ margin: '0 0 4px', fontSize: 24, fontWeight: 700, color: t.text }}>Visão Macro</h1>
          <p style={{ margin: 0, fontSize: 13, color: t.textSecondary }}>Consolidado corporativo a partir dos indicadores do banco.</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <PeriodSelector />
          <ExportExcelButton getSheets={handleExport} fileName="visao-macro" />
        </div>
      </div>
      {loading && <LoadingBlock />}
      {error && <ErrorBlock message={error} />}
      {!loading && !error && !data && <EmptyBlock />}
      {!loading && !error && data && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10, marginBottom: 16 }}>
            {[
              ['Meta', fmt(data.kpis.meta)],
              ['Realizado', fmt(data.kpis.realizado)],
              ['GAP', fmt(data.kpis.gap)],
              ['Atingimento', `${data.kpis.atingimento.toFixed(1)}%`],
              ['Margem', `${data.kpis.margem.toFixed(1)}%`],
            ].map(([l, v]) => (
              <div key={String(l)} style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 10, padding: 12 }}>
                <div style={{ fontSize: 11, color: t.textMuted }}>{l}</div>
                <div className="num" style={{ fontWeight: 700, color: t.text }}>{v}</div>
              </div>
            ))}
          </div>
          {chartData.length === 0 ? (
            <EmptyBlock title="Sem série" />
          ) : (
            <ChartGrid min={420}>
              <ChartCard
                title="Meta x Realizado por mês"
                subtitle="Faturamento mensal no ano · passe o mouse para ver o atingimento"
                legend={
                  <>
                    <LegendSwatch color={colors.series[0]} label="Realizado" />
                    <LegendSwatch color={colors.target} label="Meta" line dashed />
                  </>
                }
                height={270}
              >
                <ScrollableChart minWidth={Math.max(0, chartData.length * 56)} height="100%"><ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData} margin={{ top: 8, right: 8, left: 4, bottom: 0 }}>
                    <CartesianGrid stroke={colors.grid} vertical={false} />
                    <XAxis dataKey="mes" stroke={colors.axis} fontSize={11} tickLine={false} />
                    <YAxis stroke={colors.axis} fontSize={11} tickLine={false} axisLine={false} tickFormatter={fmtBRLShort} width={78} />
                    <Tooltip
                      cursor={{ fill: `${colors.series[0]}10` }}
                      content={
                        <ChartTooltip
                          valueFormatter={(v) => fmt(v)}
                          footer={(row) => (
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 12 }}>
                              <StatusTag status={attainmentStatus(Number(row.pct), Number(row.meta) > 0)} />
                              <strong className="num" style={{ color: t.text }}>{fmtPct(Number(row.pct) || 0)}</strong>
                            </div>
                          )}
                        />
                      }
                    />
                    <Bar dataKey="realizado" name="Realizado" fill={colors.series[0]} radius={[4, 4, 0, 0]} maxBarSize={34} />
                    <Line type="monotone" dataKey="meta" name="Meta" stroke={colors.target} strokeWidth={2} strokeDasharray="5 4" dot={false} />
                  </ComposedChart>
                </ResponsiveContainer></ScrollableChart>
              </ChartCard>
              <ChartCard
                title="Acumulado no ano"
                subtitle="O ritmo do ano: soma do realizado x soma da meta"
                legend={
                  <>
                    <LegendSwatch color={colors.series[0]} label="Realizado acumulado" line />
                    <LegendSwatch color={colors.target} label="Meta acumulada" line dashed />
                  </>
                }
                height={270}
              >
                <ScrollableChart minWidth={Math.max(0, chartData.length * 56)} height="100%"><ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
                    <CartesianGrid stroke={colors.grid} vertical={false} />
                    <XAxis dataKey="mes" stroke={colors.axis} fontSize={11} tickLine={false} />
                    <YAxis stroke={colors.axis} fontSize={11} tickLine={false} axisLine={false} tickFormatter={fmtBRLShort} width={78} />
                    <Tooltip
                      cursor={{ stroke: colors.axis, strokeDasharray: '3 3' }}
                      content={
                        <ChartTooltip
                          valueFormatter={(v) => fmt(v)}
                          footer={(row) => (
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 12, color: t.textSecondary }}>
                              <span>Atingimento acumulado</span>
                              <strong className="num" style={{ color: t.text }}>{fmtPct(Number(row.pctAcum) || 0)}</strong>
                            </div>
                          )}
                        />
                      }
                    />
                    <Line type="monotone" dataKey="metaAcum" name="Meta acumulada" stroke={colors.target} strokeWidth={2} strokeDasharray="5 4" dot={false} />
                    <Line
                      type="monotone"
                      dataKey="realizadoAcum"
                      name="Realizado acumulado"
                      stroke={colors.series[0]}
                      strokeWidth={2}
                      dot={{ r: 4, fill: colors.series[0], stroke: colors.surface, strokeWidth: 2 }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer></ScrollableChart>
              </ChartCard>
            </ChartGrid>
          )}

          {(data.fabricantes || []).length > 0 && (
            <ChartGrid min={360}>
              <ChartCard title="Participação no faturamento" subtitle="Realizado por fabricante no período">
                <ShareDonut data={data.fabricantes.map((f) => ({ label: f.fabricante, value: f.realizado }))} totalLabel="Realizado" />
              </ChartCard>
              <ChartCard title="Atingimento por fabricante" subtitle="Realizado ÷ meta, do maior para o menor">
                <AttainmentRanking
                  items={data.fabricantes.map((f) => ({ key: f.fabricante, label: f.fabricante, pct: f.pctR, meta: f.meta, realizado: f.realizado }))}
                  maxRows={8}
                />
              </ChartCard>
            </ChartGrid>
          )}
          {(data.fabricantes || []).length === 0 ? <EmptyBlock title="Sem fabricantes" /> : (
            <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 12, overflow: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                <thead>
                  <tr style={{ color: t.textMuted, textAlign: 'left', borderBottom: `1px solid ${t.border}` }}>
                    <th style={{ padding: 12 }}>Fabricante</th><th>Meta</th><th>Realizado</th><th>GAP</th><th>Ating.%</th><th>Margem%</th>
                  </tr>
                </thead>
                <tbody>
                  {data.fabricantes.map((f) => (
                    <tr key={f.fabricante} style={{ borderTop: `1px solid ${t.border}`, color: t.text }}>
                      <td style={{ padding: 12 }}>{f.fabricante}</td>
                      <td>{fmt(f.meta)}</td>
                      <td>{fmt(f.realizado)}</td>
                      <td>{fmt(f.gap)}</td>
                      <td>{f.pctR.toFixed(1)}%</td>
                      <td>{f.pctMargem.toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
};
