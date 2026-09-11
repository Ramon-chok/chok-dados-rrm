import React, { useEffect, useMemo, useState } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { useGlobalFilter } from '../../context/GlobalFilterContext';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '../../components/common/DataState';
import { ExportExcelButton } from '../../components/common/ExportExcelButton';
import { fetchDashboard, DashboardResponse } from '../../lib/api';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';

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
        if (mounted) setError(e instanceof Error ? e.message : 'Falha ao carregar visão macro');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [ano, mes, startDate, endDate, periodType]);

  const chartData = useMemo(
    () => (data?.serieMensal || []).map((d) => ({
      mes: `${MES[d.mes] || d.mes}/${String(d.ano).slice(2)}`,
      meta: d.meta,
      realizado: d.realizado,
    })),
    [data]
  );

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
        <ExportExcelButton getSheets={handleExport} fileName="visao-macro" />
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
          <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 12, padding: 16, height: 280, marginBottom: 16 }}>
            {chartData.length === 0 ? <EmptyBlock title="Sem série" /> : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={t.border} />
                  <XAxis dataKey="mes" stroke={t.textMuted} fontSize={11} />
                  <YAxis stroke={t.textMuted} fontSize={11} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="meta" fill={t.textMuted} name="Meta" />
                  <Bar dataKey="realizado" fill={t.primary} name="Realizado" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
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
