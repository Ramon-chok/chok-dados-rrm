import React, { useMemo } from 'react';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useGlobalFilter } from '../context/GlobalFilterContext';
import { PeriodSelector } from '../components/common/PeriodSelector';
import { ExportExcelButton } from '../components/common/ExportExcelButton';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';

function Sparkline({ points, color, width = 88, height = 28 }: { points: number[]; color: string; width?: number; height?: number }) {
  const max = Math.max(...points);
  const min = Math.min(...points);
  const range = max - min || 1;
  const coords = points
    .map((p, i) => {
      const x = (i / (points.length - 1)) * width;
      const y = height - ((p - min) / range) * height;
      return `${x},${y}`;
    })
    .join(' ');
  return (
    <svg width={width} height={height}>
      <polyline points={coords} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const metaRealizado = [
  { mes: 'Abr', meta: 3.6, realizado: 3.4 },
  { mes: 'Mai', meta: 3.7, realizado: 3.9 },
  { mes: 'Jun', meta: 3.8, realizado: 3.5 },
  { mes: 'Jul', meta: 3.9, realizado: 3.7 },
  { mes: 'Ago', meta: 3.9, realizado: 3.95 },
  { mes: 'Set', meta: 4.0, realizado: 3.21 },
];

const topClientes = [
  { pos: 1, prev: 1, nome: 'Mercado Bom Preço', equipe: 'TRAB ALFA', valor: 'R$ 182.400' },
  { pos: 2, prev: 4, nome: 'Distribuidora Vitória', equipe: 'TRAB BETA', valor: 'R$ 156.900' },
  { pos: 3, prev: 2, nome: 'Atacado Central', equipe: 'TRAB ALFA', valor: 'R$ 141.300' },
  { pos: 4, prev: 3, nome: 'Rede Sabor & Cia', equipe: 'TRAB GAMA', valor: 'R$ 128.750' },
  { pos: 5, prev: 7, nome: 'Comercial Nova Era', equipe: 'TRAB BETA', valor: 'R$ 119.020' },
];

const allFabricantes = [
  { fabricante: 'ARCOR', metaVal: 480000, realVal: 402100, metaR: 'R$ 480.000', realizadoR: 'R$ 402.100', gapR: '-R$ 77.900', pctR: 83.8, metaCob: '1.240', realizadoCob: '1.096', pctCob: 88.4, pctMargem: 22.1 },
  { fabricante: 'HEINZ', metaVal: 320000, realVal: 298500, metaR: 'R$ 320.000', realizadoR: 'R$ 298.500', gapR: '-R$ 21.500', pctR: 93.3, metaCob: '980', realizadoCob: '910', pctCob: 92.9, pctMargem: 26.4 },
  { fabricante: 'NESTLÉ', metaVal: 610000, realVal: 445200, metaR: 'R$ 610.000', realizadoR: 'R$ 445.200', gapR: '-R$ 164.800', pctR: 73.0, metaCob: '1.510', realizadoCob: '1.180', pctCob: 78.1, pctMargem: 19.8 },
  { fabricante: 'UNILEVER', metaVal: 275000, realVal: 261900, metaR: 'R$ 275.000', realizadoR: 'R$ 261.900', gapR: '-R$ 13.100', pctR: 95.2, metaCob: '860', realizadoCob: '822', pctCob: 95.6, pctMargem: 28.5 },
];

export const DashboardPage: React.FC = () => {
  const { t } = useTheme();
  const { currentUser } = useAuth();
  const { selectedPeriod, periodMetrics } = useGlobalFilter();

  const chartData = useMemo(
    () => metaRealizado.map((d) => ({ ...d, meta: d.meta, realizado: d.realizado })),
    []
  );

  // RBAC Fabricantes filtering:
  // Admin / Gerência: Todos os fabricantes
  // Supervisor: Somente fabricantes relacionados à sua equipe (ARCOR, HEINZ, UNILEVER)
  // Vendedor: Somente fabricantes com os quais trabalha (ARCOR, HEINZ)
  const visibleFabricantes = useMemo(() => {
    if (!currentUser || currentUser.role === 'ADMIN' || currentUser.role === 'GERENTE') {
      return allFabricantes;
    }
    if (currentUser.role === 'SUPERVISOR') {
      return allFabricantes.filter((f) => ['ARCOR', 'HEINZ', 'UNILEVER'].includes(f.fabricante));
    }
    if (currentUser.role === 'VENDEDOR') {
      return allFabricantes.filter((f) => ['ARCOR', 'HEINZ'].includes(f.fabricante));
    }
    return allFabricantes;
  }, [currentUser]);

  const dynamicKpis = useMemo(() => [
    { label: 'Realizado', value: `R$ ${(periodMetrics?.realizado ?? 3214800).toLocaleString('pt-BR')}`, delta: '+6,2%', positive: true, spark: [40, 44, 42, 48, 51, 55, 58, 62] },
    { label: 'Meta do mês', value: `R$ ${(periodMetrics?.meta ?? 4000000).toLocaleString('pt-BR')}`, delta: `período: ${selectedPeriod}`, positive: null, spark: [50, 50, 50, 50, 50, 50, 50, 50] },
    { label: 'Atingimento', value: `${(periodMetrics?.atingimento ?? 80.4).toFixed(1)}%`, delta: (periodMetrics?.atingimento ?? 80.4) >= 85 ? '+2,1 p.p.' : '-3,1 p.p.', positive: (periodMetrics?.atingimento ?? 80.4) >= 85, spark: [86, 84, 83, 82, 81, 81, 80, 80] },
    { label: 'GAP', value: `R$ ${(periodMetrics?.gap ?? -785200).toLocaleString('pt-BR')}`, delta: 'em aberto', positive: false, spark: [90, 88, 85, 82, 79, 77, 76, 78] },
    { label: 'Margem bruta', value: `${(periodMetrics?.margemBruta ?? periodMetrics?.margem ?? 24.8).toFixed(1)}%`, delta: '+0,6 p.p.', positive: true, spark: [22, 22.5, 23, 23, 23.8, 24, 24.3, 24.8] },
  ], [periodMetrics, selectedPeriod]);

  const handleExportDashboard = () => [
    {
      sheetName: 'KPIs Consolidados',
      data: dynamicKpis.map((k) => ({
        Indicador: k.label,
        Valor: k.value,
        Variação: k.delta,
        Período: selectedPeriod,
      })),
    },
    {
      sheetName: 'Top Clientes',
      data: topClientes.map((c) => ({
        Posição: c.pos,
        'Posição Anterior': c.prev,
        Cliente: c.nome,
        Equipe: c.equipe,
        Faturamento: c.valor,
      })),
    },
    {
      sheetName: 'Fabricantes',
      data: visibleFabricantes.map((cat) => ({
        Fabricante: cat.fabricante,
        'Meta R$': cat.metaR,
        'Realizado R$': cat.realizadoR,
        'Atingimento %': cat.pctR,
        'Meta Cobertura': cat.metaCob,
        'Cobertura Realizada': cat.realizadoCob,
        'Cobertura %': cat.pctCob,
        'Margem %': cat.pctMargem,
      })),
    },
  ];

  return (
    <div>
      {/* Top filters bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 className="num" style={{ margin: '0 0 4px', fontSize: '22px', fontWeight: 700, color: t.text }}>
            Visão Geral de Vendas e Metas
          </h2>
          <div style={{ fontSize: '12.5px', color: t.textMuted }}>
            {currentUser?.scope.description} · Período: <strong>{selectedPeriod}</strong>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <PeriodSelector />
          <ExportExcelButton
            filename={`Dashboard_Chok_${selectedPeriod.replace(/\s+/g, '_')}.xlsx`}
            onPrepareData={handleExportDashboard}
          />
        </div>
      </div>

      {/* KPI ROW */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
          gap: '14px',
          marginBottom: '20px',
        }}
      >
        {dynamicKpis.map((k) => (
          <div
            key={k.label}
            style={{
              background: t.surface,
              border: `1px solid ${t.border}`,
              borderRadius: '12px',
              padding: '18px 18px 16px',
            }}
          >
            <div style={{ fontSize: '13px', color: t.textSecondary, marginBottom: '8px' }}>{k.label}</div>
            <div className="num" style={{ fontSize: '24px', fontWeight: 600, marginBottom: '6px', color: t.text }}>
              {k.value}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span
                style={{
                  fontSize: '12.5px',
                  color: k.positive === null ? t.textMuted : k.positive ? '#3DD68C' : t.primaryHover,
                }}
              >
                {k.delta}
              </span>
              <Sparkline
                points={k.spark}
                color={k.positive === false ? t.primaryHover : k.positive === null ? t.textMuted : '#3DD68C'}
                width={70}
                height={22}
              />
            </div>
          </div>
        ))}
      </div>

      {/* CHART + RANKING */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1.5fr 1fr',
          gap: '16px',
          marginBottom: '20px',
        }}
        className="dashboard-chart-grid"
      >
        <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: '12px', padding: '20px' }}>
          <div style={{ fontSize: '14.5px', fontWeight: 600, marginBottom: '4px', color: t.text }}>Meta x Realizado</div>
          <div style={{ fontSize: '12.5px', color: t.textMuted, marginBottom: '14px' }}>Valores em R$ milhões — últimos 6 meses</div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} barGap={6}>
              <CartesianGrid vertical={false} stroke={t.border} strokeDasharray="3 3" />
              <XAxis dataKey="mes" tick={{ fill: t.textMuted, fontSize: 12 }} axisLine={{ stroke: t.border }} tickLine={false} />
              <YAxis tick={{ fill: t.textMuted, fontSize: 12 }} axisLine={false} tickLine={false} width={30} />
              <Tooltip
                contentStyle={{ background: t.surfaceElevated, border: `1px solid ${t.border}`, borderRadius: 8, fontSize: 12.5 }}
                labelStyle={{ color: t.text }}
                itemStyle={{ color: t.textSecondary }}
              />
              <Bar dataKey="meta" fill={t.border} radius={[4, 4, 0, 0]} name="Meta" />
              <Bar dataKey="realizado" fill={t.primary} radius={[4, 4, 0, 0]} name="Realizado" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: '12px', padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '14px' }}>
            <div style={{ fontSize: '14.5px', fontWeight: 600, color: t.text }}>Top clientes</div>
            <div style={{ fontSize: '12px', color: t.textMuted }}>Top 20 · empresa</div>
          </div>
          {topClientes.map((c) => {
            const change = c.prev - c.pos;
            return (
              <div
                key={c.pos}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '9px 6px',
                  borderRadius: '8px',
                  borderBottom: `1px solid ${t.border}`,
                }}
              >
                <div className="num" style={{ width: 20, fontSize: '13.5px', color: t.textMuted, fontWeight: 600 }}>
                  {c.pos}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '13.5px', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: t.text }}>
                    {c.nome}
                  </div>
                  <div style={{ fontSize: '11.5px', color: t.textMuted }}>{c.equipe}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="num" style={{ fontSize: '13px', fontWeight: 600, color: t.text }}>{c.valor}</div>
                  <div style={{ fontSize: '11px', color: change > 0 ? '#3DD68C' : change < 0 ? t.primaryHover : t.textMuted }}>
                    {change > 0 ? `▲ ${change}` : change < 0 ? `▼ ${Math.abs(change)}` : '='}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* FABRICANTES TABLE */}
      <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: '12px', padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <div style={{ fontSize: '15px', fontWeight: 600, color: t.text }}>Fabricantes</div>
          <div style={{ fontSize: '12px', color: t.textMuted }}>
            {currentUser?.role === 'ADMIN' || currentUser?.role === 'GERENTE'
              ? 'Todos os fabricantes cadastrados'
              : currentUser?.role === 'SUPERVISOR'
              ? `Fabricantes da equipe ${currentUser.team || 'TRAB ALFA'}`
              : `Fabricantes atribuídos ao vendedor ${currentUser?.sellerCode || '003'}`}
          </div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ color: t.textMuted, fontWeight: 500 }}>
                {['Fabricante', 'Meta', 'Realizado', 'GAP', 'Atingimento', 'Meta cobertura', 'Realizado cobertura', '% cobertura', '% margem'].map((h, i) => (
                  <th
                    key={h}
                    style={{
                      textAlign: i === 0 ? 'left' : 'right',
                      padding: '0 10px 10px 10px',
                      borderBottom: `1px solid ${t.border}`,
                      fontWeight: 500,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleFabricantes.map((row) => (
                <tr key={row.fabricante}>
                  <td style={{ padding: '11px 10px', fontWeight: 600, color: t.text }}>{row.fabricante}</td>
                  <td className="num" style={{ padding: '11px 10px', textAlign: 'right', color: t.textSecondary }}>{row.metaR}</td>
                  <td className="num" style={{ padding: '11px 10px', textAlign: 'right', color: t.text }}>{row.realizadoR}</td>
                  <td className="num" style={{ padding: '11px 10px', textAlign: 'right', fontWeight: 600, color: t.primaryHover }}>{row.gapR}</td>
                  <td
                    className="num"
                    style={{
                      padding: '11px 10px',
                      textAlign: 'right',
                      fontWeight: 600,
                      color: row.pctR >= 90 ? '#3DD68C' : row.pctR >= 80 ? t.text : t.primaryHover,
                    }}
                  >
                    {row.pctR?.toFixed(1) ?? '-'}%
                  </td>
                  <td className="num" style={{ padding: '11px 10px', textAlign: 'right', color: t.textSecondary }}>{row.metaCob}</td>
                  <td className="num" style={{ padding: '11px 10px', textAlign: 'right', color: t.text }}>{row.realizadoCob}</td>
                  <td
                    className="num"
                    style={{
                      padding: '11px 10px',
                      textAlign: 'right',
                      fontWeight: 600,
                      color: row.pctCob >= 90 ? '#3DD68C' : row.pctCob >= 80 ? t.text : t.primaryHover,
                    }}
                  >
                    {row.pctCob?.toFixed(1) ?? '-'}%
                  </td>
                  <td
                    className="num"
                    style={{
                      padding: '11px 10px',
                      textAlign: 'right',
                      fontWeight: 600,
                      color: row.pctMargem >= 25 ? '#3DD68C' : row.pctMargem >= 20 ? t.text : t.primaryHover,
                    }}
                  >
                    {row.pctMargem?.toFixed(1) ?? '-'}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <style>{`
        @media (max-width: 980px) {
          .dashboard-chart-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
};
