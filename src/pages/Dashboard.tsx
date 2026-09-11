import React, { useEffect, useMemo, useState } from 'react';
import { useTheme } from '../context/ThemeContext';
import { useGlobalFilter } from '../context/GlobalFilterContext';
import { PeriodSelector } from '../components/common/PeriodSelector';
import { ExportExcelButton } from '../components/common/ExportExcelButton';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '../components/common/DataState';
import { fetchDashboard, DashboardResponse } from '../lib/api';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

const fmt = (v: number) => `R$ ${v.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`;
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
    return () => { mounted = false; };
  }, [ano, mes, startDate, endDate, periodType]);

  const chartData = useMemo(
    () => (data?.serieMensal || []).map((d) => ({
      mes: `${MES[d.mes] || d.mes}/${String(d.ano).slice(2)}`,
      meta: d.meta / 1_000_000,
      realizado: d.realizado / 1_000_000,
    })),
    [data]
  );

  const kpis = data?.kpis;
  const dynamicKpis = [
    { label: 'Realizado', value: fmt(kpis?.realizado ?? 0) },
    { label: 'Meta do mês', value: fmt(kpis?.meta ?? 0) },
    { label: 'Atingimento', value: `${(kpis?.atingimento ?? 0).toFixed(1)}%` },
    { label: 'GAP', value: fmt(kpis?.gap ?? 0) },
    { label: 'Margem bruta', value: `${(kpis?.margem ?? 0).toFixed(1)}%` },
  ];

  const handleExport = () => [
    { sheetName: 'KPIs', data: dynamicKpis.map((k) => ({ Indicador: k.label, Valor: k.value, Período: selectedPeriod })) },
    { sheetName: 'Top Clientes', data: (data?.topClientes || []).map((c, i) => ({ Posição: i + 1, Cliente: c.nome, Equipe: c.equipe, Faturamento: c.valor })) },
    { sheetName: 'Fabricantes', data: (data?.fabricantes || []).map((f) => ({ Fabricante: f.fabricante, Meta: f.meta, Realizado: f.realizado, Atingimento: f.pctR, Margem: f.pctMargem })) },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 className="num" style={{ margin: '0 0 4px', fontSize: 24, fontWeight: 700, color: t.text }}>Dashboard</h1>
          <p style={{ margin: 0, fontSize: 13, color: t.textSecondary }}>Dados consolidados diretamente do banco de dados.</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <PeriodSelector />
          <ExportExcelButton getSheets={handleExport} fileName={`dashboard-${selectedPeriod}`} />
        </div>
      </div>

      {loading && <LoadingBlock />}
      {error && <ErrorBlock message={error} />}
      {!loading && !error && !data && <EmptyBlock />}

      {!loading && !error && data && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 20 }}>
            {dynamicKpis.map((k) => (
              <div key={k.label} style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 12, padding: '14px 16px' }}>
                <div style={{ fontSize: 11.5, color: t.textMuted, marginBottom: 6 }}>{k.label}</div>
                <div className="num" style={{ fontSize: 18, fontWeight: 700, color: t.text }}>{k.value}</div>
              </div>
            ))}
          </div>

          <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 12, padding: 16, marginBottom: 20, height: 280 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: t.text, marginBottom: 10 }}>Meta x Realizado (R$ mi)</div>
            {chartData.length === 0 ? (
              <EmptyBlock title="Sem série mensal" description="Importe indicadores de vendedor para ver o gráfico." />
            ) : (
              <ResponsiveContainer width="100%" height="90%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={t.border} />
                  <XAxis dataKey="mes" stroke={t.textMuted} fontSize={11} />
                  <YAxis stroke={t.textMuted} fontSize={11} />
                  <Tooltip />
                  <Bar dataKey="meta" fill={t.textMuted} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="realizado" fill={t.primary} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 12, padding: 16 }}>
              <div style={{ fontWeight: 600, marginBottom: 12, color: t.text }}>Top clientes</div>
              {(data.topClientes || []).length === 0 ? <EmptyBlock title="Sem clientes" /> : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                  <thead>
                    <tr style={{ color: t.textMuted, textAlign: 'left' }}>
                      <th style={{ padding: '6px 0' }}>#</th>
                      <th>Cliente</th>
                      <th>Equipe</th>
                      <th>Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.topClientes.map((c, i) => (
                      <tr key={`${c.nome}-${i}`} style={{ borderTop: `1px solid ${t.border}`, color: t.text }}>
                        <td style={{ padding: '8px 0' }}>{i + 1}</td>
                        <td>{c.nome}</td>
                        <td>{c.equipe || '—'}</td>
                        <td>{fmt(c.valor)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 12, padding: 16 }}>
              <div style={{ fontWeight: 600, marginBottom: 12, color: t.text }}>Fabricantes</div>
              {(data.fabricantes || []).length === 0 ? <EmptyBlock title="Sem fabricantes" /> : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                  <thead>
                    <tr style={{ color: t.textMuted, textAlign: 'left' }}>
                      <th style={{ padding: '6px 0' }}>Fabricante</th>
                      <th>Realizado</th>
                      <th>%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.fabricantes.map((f) => (
                      <tr key={f.fabricante} style={{ borderTop: `1px solid ${t.border}`, color: t.text }}>
                        <td style={{ padding: '8px 0' }}>{f.fabricante}</td>
                        <td>{fmt(f.realizado)}</td>
                        <td>{f.pctR.toFixed(1)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
