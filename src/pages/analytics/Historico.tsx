import React, { useEffect, useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '../../components/common/DataState';
import { SingleSelectFilter } from '../../components/common/SingleSelectFilter';
import { ExportExcelButton } from '../../components/common/ExportExcelButton';
import { ScrollableChart } from '../../components/common/ScrollableChart';
import {
  AttainmentHeatmap,
  ChartCard,
  ChartGrid,
  ChartTooltip,
  LegendSwatch,
  StatusTag,
  attainmentStatus,
  fmtBRL,
  fmtBRLShort,
  fmtInt,
  fmtPct,
  mesLabel,
  pctOf,
  useChartColors,
} from '../../components/charts/chartKit';
import {
  DashboardFilterOptions,
  EvolucaoResponse,
  fetchDashboardFilterOptions,
  fetchEvolucao,
  getErrorMessage,
} from '../../lib/api';

/** Equipes com série própria no gráfico empilhado; o resto vira "Outras". */
const MAX_EQUIPES = 5;

const monthKey = (ano: number, mes: number) => `${ano}-${String(mes).padStart(2, '0')}`;

export const HistoricoPage: React.FC = () => {
  const { t } = useTheme();
  const { currentUser } = useAuth();
  const colors = useChartColors();

  const role = currentUser?.role;
  const canFilterEquipe = role === 'ADMIN' || role === 'GERENTE';
  const canFilterVendedor = canFilterEquipe || role === 'SUPERVISOR';
  const showEquipes = role !== 'VENDEDOR';

  const [ano, setAno] = useState<string>('');
  const [anoTouched, setAnoTouched] = useState(false);
  const [fabricante, setFabricante] = useState('');
  const [equipe, setEquipe] = useState('');
  const [vendedor, setVendedor] = useState('');
  const [filterOptions, setFilterOptions] = useState<DashboardFilterOptions | null>(null);

  const [data, setData] = useState<EvolucaoResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!canFilterVendedor) return;
    let mounted = true;
    fetchDashboardFilterOptions()
      .then((opts) => mounted && setFilterOptions(opts))
      .catch(() => {
        // Filtros extras são opcionais; a tela segue no escopo padrão do usuário.
      });
    return () => {
      mounted = false;
    };
  }, [canFilterVendedor]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetchEvolucao({
          ano: ano ? Number(ano) : undefined,
          fabricante: fabricante || undefined,
          equipe: canFilterEquipe && equipe ? equipe : undefined,
          vendedor: canFilterVendedor && vendedor ? vendedor : undefined,
        });
        if (!mounted) return;
        setData(res);
        // Primeira carga: abre no ano mais recente com dados (a lista vem em ordem decrescente).
        if (!anoTouched && !ano && res.anos.length > 0) {
          setAnoTouched(true);
          setAno(String(res.anos[0]));
        }
      } catch (e) {
        if (mounted) setError(getErrorMessage(e, 'Falha ao carregar o histórico.'));
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ano, fabricante, equipe, vendedor, canFilterEquipe, canFilterVendedor]);

  const vendedorOptions = useMemo(() => {
    const all = filterOptions?.vendedores || [];
    return equipe ? all.filter((v) => v.equipe === equipe) : all;
  }, [filterOptions, equipe]);

  // ─── Séries derivadas ───────────────────────────────────────
  const mensal = useMemo(() => {
    const acc: Record<number, { meta: number; realizado: number }> = {};
    return (data?.mensal || []).map((m) => {
      const running = (acc[m.ano] ||= { meta: 0, realizado: 0 });
      running.meta += m.meta;
      running.realizado += m.realizado;
      return {
        key: monthKey(m.ano, m.mes),
        label: mesLabel(m.ano, m.mes),
        ...m,
        pct: pctOf(m.realizado, m.meta),
        pctCob: pctOf(m.realizadoCobertura, m.metaCobertura),
        metaAcum: running.meta,
        realizadoAcum: running.realizado,
        pctAcum: pctOf(running.realizado, running.meta),
      };
    });
  }, [data]);

  const resumo = useMemo(() => {
    if (mensal.length === 0) return null;
    const meta = mensal.reduce((s, m) => s + m.meta, 0);
    const realizado = mensal.reduce((s, m) => s + m.realizado, 0);
    const melhor = mensal.reduce((best, m) => (m.realizado > best.realizado ? m : best), mensal[0]);
    const ultimo = mensal[mensal.length - 1];
    const anterior = mensal.length > 1 ? mensal[mensal.length - 2] : null;
    const variacao = anterior && anterior.realizado ? ((ultimo.realizado - anterior.realizado) / anterior.realizado) * 100 : null;
    return { meta, realizado, pct: pctOf(realizado, meta), melhor, ultimo, anterior, variacao };
  }, [mensal]);

  const heatmap = useMemo(() => {
    const values: Record<string, Record<string, { meta: number; realizado: number }>> = {};
    const totals: Record<string, number> = {};
    for (const r of data?.porFabricante || []) {
      (values[r.fabricante] ||= {})[monthKey(r.ano, r.mes)] = { meta: r.meta, realizado: r.realizado };
      totals[r.fabricante] = (totals[r.fabricante] || 0) + r.realizado;
    }
    const rows = Object.keys(values).sort((a, b) => (totals[b] || 0) - (totals[a] || 0));
    return { rows, values };
  }, [data]);

  // Equipes: cor fixa por equipe (ordem pelo total do período inteiro), então a cor
  // de uma equipe não muda entre meses nem ao trocar filtros de fabricante.
  const equipesChart = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const r of data?.porEquipe || []) totals[r.equipe] = (totals[r.equipe] || 0) + r.realizado;
    const ranked = Object.keys(totals).sort((a, b) => totals[b] - totals[a]);
    const top = ranked.slice(0, MAX_EQUIPES);
    const hasOther = ranked.length > MAX_EQUIPES;
    const byMonth: Record<string, Record<string, number | string>> = {};
    for (const m of mensal) byMonth[m.key] = { label: m.label };
    for (const r of data?.porEquipe || []) {
      const row = (byMonth[monthKey(r.ano, r.mes)] ||= { label: mesLabel(r.ano, r.mes) });
      const serie = top.includes(r.equipe) ? r.equipe : 'Outras';
      row[serie] = ((row[serie] as number) || 0) + r.realizado;
    }
    const series = [...top, ...(hasOther ? ['Outras'] : [])];
    return { series, rows: Object.values(byMonth), otherCount: ranked.length - top.length };
  }, [data, mensal]);

  const handleExport = () => [
    {
      sheetName: 'Evolução mensal',
      data: mensal.map((m) => ({
        Mês: m.label,
        Meta: m.meta,
        Realizado: m.realizado,
        'Atingimento %': Number(m.pct.toFixed(1)),
        'Meta acumulada': m.metaAcum,
        'Realizado acumulado': m.realizadoAcum,
        'Meta clientes': m.metaCobertura,
        Positivados: m.realizadoCobertura,
        'Cobertura %': Number(m.pctCob.toFixed(1)),
        'Margem média %': m.margem,
      })),
    },
    {
      sheetName: 'Por fabricante',
      data: (data?.porFabricante || []).map((r) => ({
        Fabricante: r.fabricante,
        Mês: mesLabel(r.ano, r.mes),
        Meta: r.meta,
        Realizado: r.realizado,
        'Atingimento %': Number(pctOf(r.realizado, r.meta).toFixed(1)),
      })),
    },
  ];

  const tick = { stroke: colors.axis, fontSize: 11, tickLine: false } as const;
  const chartMinWidth = Math.max(0, mensal.length * 56);

  const statStyle: React.CSSProperties = {
    background: t.surface,
    border: `1px solid ${t.border}`,
    borderRadius: 12,
    padding: '12px 14px',
    minWidth: 0,
  };
  const statLabel: React.CSSProperties = {
    fontSize: 11,
    color: t.textMuted,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    marginBottom: 6,
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap', marginBottom: 18 }}>
        <div>
          <h1 className="num" style={{ margin: '0 0 4px', fontSize: 24, fontWeight: 700, color: t.text }}>
            Histórico
          </h1>
          <p style={{ margin: 0, fontSize: 13, color: t.textSecondary }}>
            Evolução mês a mês de faturamento, cobertura e margem, a partir dos indicadores importados.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <SingleSelectFilter
            label="Ano"
            options={(data?.anos || []).map((a) => ({ value: String(a), label: String(a) }))}
            value={ano}
            onChange={(v) => {
              setAnoTouched(true);
              setAno(v);
            }}
            placeholder="Todos os anos"
            allLabel="Todos os anos"
          />
          <SingleSelectFilter
            label="Fabricante"
            options={(data?.fabricantes || []).map((f) => ({ value: f, label: f }))}
            value={fabricante}
            onChange={setFabricante}
            placeholder="Todos os fabricantes"
            allLabel="Todos os fabricantes"
          />
          {canFilterEquipe && (
            <SingleSelectFilter
              label="Equipe"
              options={(filterOptions?.equipes || []).map((e) => ({ value: e, label: e }))}
              value={equipe}
              onChange={(v) => {
                setEquipe(v);
                setVendedor('');
              }}
              placeholder="Todas as equipes"
              allLabel="Todas as equipes"
            />
          )}
          {canFilterVendedor && (
            <SingleSelectFilter
              label="Vendedor"
              options={vendedorOptions.map((v) => ({ value: v.codVendedor, label: v.nome }))}
              value={vendedor}
              onChange={setVendedor}
              placeholder="Todos os vendedores"
              allLabel="Todos os vendedores"
            />
          )}
          <ExportExcelButton getSheets={handleExport} fileName={`historico-${ano || 'todos'}`} />
        </div>
      </div>

      {loading && <LoadingBlock />}
      {error && <ErrorBlock message={error} />}
      {!loading && !error && mensal.length === 0 && (
        <EmptyBlock description="Nenhum indicador por fabricante encontrado para os filtros atuais. Importe as planilhas de indicadores ou ajuste os filtros." />
      )}

      {!loading && !error && resumo && (
        <>
          {/* ─── Resumo do período ─── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(170px, 100%), 1fr))', gap: 12, marginBottom: 16 }}>
            <div style={statStyle}>
              <div style={statLabel}>Realizado</div>
              <div className="num" style={{ fontSize: 20, fontWeight: 700, color: t.text }}>{fmtBRLShort(resumo.realizado)}</div>
              <div style={{ fontSize: 11.5, color: t.textMuted, marginTop: 2 }}>Meta {fmtBRLShort(resumo.meta)}</div>
            </div>
            <div style={statStyle}>
              <div style={statLabel}>Atingimento</div>
              <div className="num" style={{ fontSize: 20, fontWeight: 700, color: t.text }}>{resumo.meta ? fmtPct(resumo.pct) : '—'}</div>
              <div style={{ marginTop: 4 }}>
                <StatusTag status={attainmentStatus(resumo.pct, resumo.meta > 0)} />
              </div>
            </div>
            <div style={statStyle}>
              <div style={statLabel}>Melhor mês</div>
              <div className="num" style={{ fontSize: 20, fontWeight: 700, color: t.text }}>{resumo.melhor.label}</div>
              <div style={{ fontSize: 11.5, color: t.textMuted, marginTop: 2 }}>{fmtBRLShort(resumo.melhor.realizado)} realizados</div>
            </div>
            <div style={statStyle}>
              <div style={statLabel}>Último mês x anterior</div>
              {resumo.variacao === null ? (
                <div className="num" style={{ fontSize: 20, fontWeight: 700, color: t.text }}>—</div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {resumo.variacao > 0.05 ? (
                    <ArrowUpRight size={18} color="#0ca30c" aria-label="Alta" />
                  ) : resumo.variacao < -0.05 ? (
                    <ArrowDownRight size={18} color="#d03b3b" aria-label="Queda" />
                  ) : (
                    <Minus size={18} color={t.textMuted} aria-label="Estável" />
                  )}
                  <span className="num" style={{ fontSize: 20, fontWeight: 700, color: t.text }}>
                    {resumo.variacao > 0 ? '+' : ''}
                    {fmtPct(resumo.variacao)}
                  </span>
                </div>
              )}
              <div style={{ fontSize: 11.5, color: t.textMuted, marginTop: 2 }}>
                {resumo.anterior ? `${resumo.ultimo.label} vs ${resumo.anterior.label}` : resumo.ultimo.label}
              </div>
            </div>
          </div>

          {/* ─── Mensal e acumulado ─── */}
          <ChartGrid min={420}>
            <ChartCard
              title="Meta x Realizado por mês"
              subtitle="Faturamento mensal · passe o mouse para ver o atingimento"
              legend={
                <>
                  <LegendSwatch color={colors.series[0]} label="Realizado" />
                  <LegendSwatch color={colors.target} label="Meta" line dashed />
                </>
              }
              height={280}
            >
              <ScrollableChart minWidth={chartMinWidth}>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={mensal} margin={{ top: 8, right: 8, left: 4, bottom: 0 }}>
                    <CartesianGrid stroke={colors.grid} vertical={false} />
                    <XAxis dataKey="label" {...tick} axisLine={{ stroke: colors.grid }} />
                    <YAxis {...tick} axisLine={false} tickFormatter={fmtBRLShort} width={78} />
                    <Tooltip
                      cursor={{ fill: `${colors.series[0]}10` }}
                      content={
                        <ChartTooltip
                          valueFormatter={(v) => fmtBRL(v)}
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
                </ResponsiveContainer>
              </ScrollableChart>
            </ChartCard>

            <ChartCard
              title="Acumulado no ano"
              subtitle="Soma do realizado x soma da meta (reinicia a cada ano)"
              legend={
                <>
                  <LegendSwatch color={colors.series[0]} label="Realizado acumulado" line />
                  <LegendSwatch color={colors.target} label="Meta acumulada" line dashed />
                </>
              }
              height={280}
            >
              <ScrollableChart minWidth={chartMinWidth}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={mensal} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
                    <CartesianGrid stroke={colors.grid} vertical={false} />
                    <XAxis dataKey="label" {...tick} axisLine={{ stroke: colors.grid }} />
                    <YAxis {...tick} axisLine={false} tickFormatter={fmtBRLShort} width={78} />
                    <Tooltip
                      cursor={{ stroke: colors.axis, strokeDasharray: '3 3' }}
                      content={
                        <ChartTooltip
                          valueFormatter={(v) => fmtBRL(v)}
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
                </ResponsiveContainer>
              </ScrollableChart>
            </ChartCard>
          </ChartGrid>

          {/* ─── Cobertura e margem ─── */}
          <ChartGrid min={420}>
            <ChartCard
              title="Cobertura de clientes"
              subtitle="Clientes positivados x meta de clientes por mês"
              legend={
                <>
                  <LegendSwatch color={colors.series[2]} label="Positivados" line />
                  <LegendSwatch color={colors.target} label="Meta de clientes" line dashed />
                </>
              }
              height={250}
            >
              <ScrollableChart minWidth={chartMinWidth}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={mensal} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
                    <CartesianGrid stroke={colors.grid} vertical={false} />
                    <XAxis dataKey="label" {...tick} axisLine={{ stroke: colors.grid }} />
                    <YAxis {...tick} axisLine={false} tickFormatter={fmtInt} width={56} />
                    <Tooltip
                      cursor={{ stroke: colors.axis, strokeDasharray: '3 3' }}
                      content={
                        <ChartTooltip
                          valueFormatter={(v) => fmtInt(v)}
                          footer={(row) => (
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 12, color: t.textSecondary }}>
                              <span>Cobertura</span>
                              <strong className="num" style={{ color: t.text }}>{fmtPct(Number(row.pctCob) || 0)}</strong>
                            </div>
                          )}
                        />
                      }
                    />
                    <Line type="monotone" dataKey="metaCobertura" name="Meta de clientes" stroke={colors.target} strokeWidth={2} strokeDasharray="5 4" dot={false} />
                    <Line
                      type="monotone"
                      dataKey="realizadoCobertura"
                      name="Positivados"
                      stroke={colors.series[2]}
                      strokeWidth={2}
                      dot={{ r: 4, fill: colors.series[2], stroke: colors.surface, strokeWidth: 2 }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </ScrollableChart>
            </ChartCard>

            <ChartCard title="Margem média" subtitle="Média do % de margem dos indicadores no mês" height={250}>
              <ScrollableChart minWidth={chartMinWidth}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={mensal} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
                    <defs>
                      <linearGradient id="hist-margem" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={colors.series[0]} stopOpacity={0.28} />
                        <stop offset="100%" stopColor={colors.series[0]} stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke={colors.grid} vertical={false} />
                    <XAxis dataKey="label" {...tick} axisLine={{ stroke: colors.grid }} />
                    <YAxis {...tick} axisLine={false} tickFormatter={(v: number) => `${v}%`} width={48} />
                    <Tooltip cursor={{ stroke: colors.axis, strokeDasharray: '3 3' }} content={<ChartTooltip valueFormatter={(v) => fmtPct(v)} />} />
                    <Area
                      type="monotone"
                      dataKey="margem"
                      name="Margem média"
                      stroke={colors.series[0]}
                      strokeWidth={2}
                      fill="url(#hist-margem)"
                      dot={{ r: 3, fill: colors.series[0], stroke: colors.surface, strokeWidth: 2 }}
                      activeDot={{ r: 6 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </ScrollableChart>
            </ChartCard>
          </ChartGrid>

          {/* ─── Fabricante × mês ─── */}
          {heatmap.rows.length > 0 && (
            <ChartCard
              title="Atingimento por fabricante e mês"
              subtitle={
                fabricante
                  ? `Filtrado em ${fabricante} · clique no nome para remover o filtro`
                  : 'Cada célula = realizado ÷ meta do mês · clique em um fabricante para filtrar a tela'
              }
              style={{ marginBottom: 16 }}
            >
              <AttainmentHeatmap
                rows={heatmap.rows}
                columns={mensal.map((m) => ({ key: m.key, label: m.label }))}
                values={heatmap.values}
                selectedRow={fabricante || null}
                onSelectRow={(row) => setFabricante((cur) => (cur === row ? '' : row))}
              />
            </ChartCard>
          )}

          {/* ─── Equipes ─── */}
          {showEquipes && equipesChart.series.length > 1 && (
            <ChartCard
              title="Realizado por equipe"
              subtitle={
                equipesChart.otherCount > 0
                  ? `As ${MAX_EQUIPES} equipes com maior faturamento no período; as outras ${equipesChart.otherCount} somadas em "Outras"`
                  : 'Composição do faturamento mensal por equipe'
              }
              legend={equipesChart.series.map((s, i) => (
                <LegendSwatch key={s} color={s === 'Outras' ? colors.other : colors.series[i]} label={s} />
              ))}
              height={300}
              style={{ marginBottom: 16 }}
            >
              <ScrollableChart minWidth={chartMinWidth}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={equipesChart.rows} margin={{ top: 8, right: 8, left: 4, bottom: 0 }}>
                    <CartesianGrid stroke={colors.grid} vertical={false} />
                    <XAxis dataKey="label" {...tick} axisLine={{ stroke: colors.grid }} />
                    <YAxis {...tick} axisLine={false} tickFormatter={fmtBRLShort} width={78} />
                    <Tooltip cursor={{ fill: `${colors.series[0]}10` }} content={<ChartTooltip valueFormatter={(v) => fmtBRL(v)} />} />
                    {equipesChart.series.map((s, i) => (
                      <Bar
                        key={s}
                        dataKey={s}
                        name={s}
                        stackId="equipes"
                        fill={s === 'Outras' ? colors.other : colors.series[i]}
                        stroke={colors.surface}
                        strokeWidth={1}
                        maxBarSize={38}
                        radius={i === equipesChart.series.length - 1 ? [4, 4, 0, 0] : undefined}
                      />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </ScrollableChart>
            </ChartCard>
          )}

          {/* ─── Tabela (mesmos números dos gráficos) ─── */}
          <ChartCard title="Tabela mensal" subtitle="Os mesmos valores dos gráficos acima">
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, whiteSpace: 'nowrap' }}>
                <thead>
                  <tr style={{ color: t.textMuted, textAlign: 'right' }}>
                    {['Mês', 'Meta', 'Realizado', 'Ating.', 'Meta clientes', 'Positivados', 'Cobertura', 'Margem'].map((h, i) => (
                      <th
                        key={h}
                        style={{
                          padding: '8px 10px',
                          textAlign: i === 0 ? 'left' : 'right',
                          fontSize: 11,
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em',
                          borderBottom: `1px solid ${t.border}`,
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {mensal.map((m) => (
                    <tr key={m.key} style={{ color: t.text }}>
                      <td style={{ padding: '8px 10px', borderBottom: `1px solid ${t.border}`, fontWeight: 600 }}>{m.label}</td>
                      <td className="num" style={{ padding: '8px 10px', borderBottom: `1px solid ${t.border}`, textAlign: 'right' }}>{fmtBRL(m.meta)}</td>
                      <td className="num" style={{ padding: '8px 10px', borderBottom: `1px solid ${t.border}`, textAlign: 'right', fontWeight: 600 }}>{fmtBRL(m.realizado)}</td>
                      <td style={{ padding: '8px 10px', borderBottom: `1px solid ${t.border}`, textAlign: 'right' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          <span className="num">{m.meta ? fmtPct(m.pct) : '—'}</span>
                          <StatusTag status={attainmentStatus(m.pct, m.meta > 0)} compact />
                        </span>
                      </td>
                      <td className="num" style={{ padding: '8px 10px', borderBottom: `1px solid ${t.border}`, textAlign: 'right' }}>{fmtInt(m.metaCobertura)}</td>
                      <td className="num" style={{ padding: '8px 10px', borderBottom: `1px solid ${t.border}`, textAlign: 'right' }}>{fmtInt(m.realizadoCobertura)}</td>
                      <td className="num" style={{ padding: '8px 10px', borderBottom: `1px solid ${t.border}`, textAlign: 'right' }}>{m.metaCobertura ? fmtPct(m.pctCob) : '—'}</td>
                      <td className="num" style={{ padding: '8px 10px', borderBottom: `1px solid ${t.border}`, textAlign: 'right' }}>{fmtPct(m.margem)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ChartCard>
        </>
      )}
    </div>
  );
};
