import React, { useEffect, useMemo, useState } from 'react';
import { useTheme } from '../context/ThemeContext';
import { useGlobalFilter } from '../context/GlobalFilterContext';
import { PeriodSelector } from '../components/common/PeriodSelector';
import { ExportExcelButton } from '../components/common/ExportExcelButton';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '../components/common/DataState';
import { fetchDashboard, DashboardResponse } from '../lib/api';
import { ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from 'recharts';

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
    return () => { mounted = false; };
  }, [ano, mes, startDate, endDate, periodType]);

  const chartData = useMemo(
    () => (data?.serieMensal || []).map((d) => ({
      mes: `${MES[d.mes] || d.mes}/${String(d.ano).slice(2)}`,
      meta: d.meta / 1_000_000,
      realizado: d.realizado / 1_000_000,
      margem: d.margem,
    })),
    [data]
  );

  const kpis = data?.kpis;

  // Cada grupo é renderizado lado a lado (o "principal" com meta/realizado/%
  // e, ao lado, o card de GAP correspondente). O % do GAP é sempre
  // atingimento - 100: negativo quando abaixo da meta, positivo quando acima.
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

  const cardStyle: React.CSSProperties = {
    background: t.surface,
    border: `1px solid ${t.border}`,
    borderRadius: 12,
    padding: '14px 16px',
    flex: 1,
    minWidth: 0,
  };
  const cardTitleStyle: React.CSSProperties = { fontSize: 11.5, color: t.textMuted, marginBottom: 8, fontWeight: 600 };
  const statLabelStyle: React.CSSProperties = { fontSize: 10.5, color: t.textMuted, marginBottom: 2 };
  const statValueStyle: React.CSSProperties = { fontSize: 15, fontWeight: 700, color: t.text };

  const posColor = (v: number) => (v >= 0 ? '#3DD68C' : t.primaryHover);

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

      {!loading && !error && data && kpis && (
        <>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginBottom: 20 }}>
            {cardGroups.map((group, gi) => (
              <div key={gi} style={{ display: 'flex', gap: 12, flex: group.length > 1 ? '1 1 380px' : '1 1 160px' }}>
                {group.map((card, ci) => {
                  if (card.kind === 'main') {
                    return (
                      <div key={ci} style={cardStyle}>
                        <div style={cardTitleStyle}>{card.title}</div>
                        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                          <div style={{ minWidth: 70 }}>
                            <div style={statLabelStyle}>Meta</div>
                            <div className="num" style={statValueStyle}>{card.formatter(card.meta)}</div>
                          </div>
                          <div style={{ minWidth: 70 }}>
                            <div style={statLabelStyle}>Realizado</div>
                            <div className="num" style={statValueStyle}>{card.formatter(card.realizado)}</div>
                          </div>
                          <div style={{ minWidth: 60 }}>
                            <div style={statLabelStyle}>Atingimento</div>
                            <div className="num" style={{ ...statValueStyle, color: t.primary }}>{fmtPct(card.pct)}</div>
                          </div>
                        </div>
                      </div>
                    );
                  }
                  if (card.kind === 'gap') {
                    return (
                      <div key={ci} style={cardStyle}>
                        <div style={cardTitleStyle}>{card.title}</div>
                        <div className="num" style={{ fontSize: 17, fontWeight: 700, color: posColor(card.gap), marginBottom: 3 }}>
                          {card.formatter(card.gap)}
                        </div>
                        <div className="num" style={{ fontSize: 12, fontWeight: 600, color: posColor(card.pct) }}>
                          {card.pct >= 0 ? '+' : ''}{fmtPct(card.pct)}
                        </div>
                      </div>
                    );
                  }
                  return (
                    <div key={ci} style={cardStyle}>
                      <div style={cardTitleStyle}>{card.title}</div>
                      <div className="num" style={{ fontSize: 18, fontWeight: 700, color: t.text }}>{fmtPct(card.value)}</div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 12, padding: 16, marginBottom: 20, height: 300 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: t.text, marginBottom: 10 }}>Meta x Realizado (R$ mi) e Margem (%)</div>
            {chartData.length === 0 ? (
              <EmptyBlock title="Sem série mensal" description="Importe indicadores de vendedor para ver o gráfico." />
            ) : (
              <ResponsiveContainer width="100%" height="90%">
                <ComposedChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={t.border} />
                  <XAxis dataKey="mes" stroke={t.textMuted} fontSize={11} />
                  <YAxis yAxisId="left" stroke={t.textMuted} fontSize={11} />
                  <YAxis yAxisId="right" orientation="right" stroke={t.textMuted} fontSize={11} tickFormatter={(v) => `${v}%`} />
                  <Tooltip
                    formatter={(value: number, name: string) =>
                      name === 'Margem %' ? [fmtPct(value), name] : [`R$ ${value.toFixed(2)} mi`, name]
                    }
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar yAxisId="left" dataKey="meta" name="Meta" fill={t.textMuted} radius={[4, 4, 0, 0]} />
                  <Bar yAxisId="left" dataKey="realizado" name="Realizado" fill={t.primary} radius={[4, 4, 0, 0]} />
                  <Line yAxisId="right" type="monotone" dataKey="margem" name="Margem %" stroke="#3DD68C" strokeWidth={2.5} dot={{ r: 3 }} />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 12, padding: 16, overflowX: 'auto' }}>
              <div style={{ fontWeight: 600, marginBottom: 12, color: t.text }}>Top clientes</div>
              {(data.topClientes || []).length === 0 ? <EmptyBlock title="Sem clientes" /> : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                  <thead>
                    <tr style={{ color: t.textMuted, textAlign: 'left' }}>
                      <th style={{ padding: '6px 0' }}>#</th>
                      <th>Código</th>
                      <th>Cliente</th>
                      <th>Equipe</th>
                      <th>Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.topClientes.map((c, i) => (
                      <tr key={`${c.codigo || c.nome}-${i}`} style={{ borderTop: `1px solid ${t.border}`, color: t.text }}>
                        <td style={{ padding: '8px 0' }}>{i + 1}</td>
                        <td>{c.eRede ? '—' : c.codigo || '—'}</td>
                        <td>{c.nome}</td>
                        <td>{c.equipe || '—'}</td>
                        <td>{fmt(c.valor)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 12, padding: 16, overflowX: 'auto' }}>
              <div style={{ fontWeight: 600, marginBottom: 12, color: t.text }}>Fabricantes</div>
              {(data.fabricantes || []).length === 0 ? <EmptyBlock title="Sem fabricantes" /> : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, whiteSpace: 'nowrap' }}>
                  <thead>
                    <tr style={{ color: t.textMuted, textAlign: 'left' }}>
                      <th style={{ padding: '6px 8px 6px 0' }}>Fabricante</th>
                      <th style={{ padding: '6px 8px' }}>Meta</th>
                      <th style={{ padding: '6px 8px' }}>Realizado</th>
                      <th style={{ padding: '6px 8px' }}>%</th>
                      <th style={{ padding: '6px 8px' }}>Meta Cob.</th>
                      <th style={{ padding: '6px 8px' }}>Realizado Cob.</th>
                      <th style={{ padding: '6px 8px' }}>% Cob.</th>
                      <th style={{ padding: '6px 8px' }}>Margem %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.fabricantes.map((f) => (
                      <tr key={f.fabricante} style={{ borderTop: `1px solid ${t.border}`, color: t.text }}>
                        <td style={{ padding: '8px 8px 8px 0' }}>{f.fabricante}</td>
                        <td style={{ padding: '8px' }}>{fmt(f.meta)}</td>
                        <td style={{ padding: '8px' }}>{fmt(f.realizado)}</td>
                        <td style={{ padding: '8px' }}>{fmtPct(f.pctR)}</td>
                        <td style={{ padding: '8px' }}>{fmtInt(f.metaCobertura)}</td>
                        <td style={{ padding: '8px' }}>{fmtInt(f.realizadoCobertura)}</td>
                        <td style={{ padding: '8px' }}>{fmtPct(f.pctCob)}</td>
                        <td style={{ padding: '8px' }}>{fmtPct(f.pctMargem)}</td>
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
