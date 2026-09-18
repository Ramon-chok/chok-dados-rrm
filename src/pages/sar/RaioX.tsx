import React, { useEffect, useMemo, useState } from 'react';
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { ExportExcelButton } from '../../components/common/ExportExcelButton';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '../../components/common/DataState';
import { SingleSelectFilter } from '../../components/common/SingleSelectFilter';
import { fetchRaioX, fetchRaioXDetalhe, RaioXDetalheRow, RaioXRow } from '../../lib/api';
import { Activity, BarChart3, Calendar, Layers, X } from 'lucide-react';

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

// Quantos vendedores o gráfico mostra de uma vez (a tabela abaixo sempre
// mostra todos os que passaram no filtro) — evita um eixo X ilegível quando
// a equipe/gerência tem muitos vendedores.
const CHART_MAX_BARS = 20;

function fmtPct(v: number | null | undefined): string {
  if (v === null || v === undefined || Number.isNaN(v)) return '—';
  return `${(v * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
}

function fmtNum(v: number | null | undefined): string {
  if (v === null || v === undefined || Number.isNaN(v)) return '—';
  return v.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
}

function fmtHora(v: string | null | undefined): string {
  if (!v) return '—';
  // "HH:MM:SS" -> "HH:MM" (segundos não ajudam a leitura na tabela)
  return v.slice(0, 5);
}

export const RaioXPage: React.FC = () => {
  const { t } = useTheme();
  const { currentUser } = useAuth();

  const role = currentUser?.role;
  // Supervisor (e Admin/Gerência) enxergam vários vendedores na mesma
  // listagem — o filtro deixa a visão focada em um vendedor específico da
  // equipe. Vendedor já vê só a própria linha (recorte travado no backend).
  const canFilterVendedor = role === 'ADMIN' || role === 'GERENTE' || role === 'SUPERVISOR';

  const currentYear = new Date().getFullYear();
  const [ano, setAno] = useState<number>(currentYear);
  const [mes, setMes] = useState<number | ''>('');
  const [dia, setDia] = useState<string>('');
  const [anosDisponiveis, setAnosDisponiveis] = useState<number[]>([currentYear]);

  const [rows, setRows] = useState<RaioXRow[]>([]);
  const [mode, setMode] = useState<'dia' | 'periodo'>('periodo');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState('');
  const [selectedVendedor, setSelectedVendedor] = useState('');

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchRaioX({
          ano,
          mes: dia ? undefined : mes || undefined,
          dia: dia || undefined,
        });
        if (!mounted) return;
        setRows(data.rows);
        setMode(data.mode);
        setAnosDisponiveis(data.anosDisponiveis.length ? data.anosDisponiveis : [currentYear]);
      } catch (e) {
        if (mounted) setError(e instanceof Error ? e.message : 'Falha ao carregar Raio-X');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ano, mes, dia]);

  const vendedorOptions = useMemo(() => {
    const map = new Map<string, string>();
    rows.forEach((r) => map.set(r.codVendedor, r.vendedor || r.codVendedor));
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1], 'pt-BR'));
  }, [rows]);

  // Vendedor Detalhado (tabela vendedor_detalhado): busca e filtro próprios,
  // independentes do Raio-X original — a planilha pode ser importada sozinha.
  // Vendedor logado só recebe as próprias visitas (recorte no backend).
  // O vendedor escolhido no Raio-X (filtro ou clique na linha) é o mesmo do detalhado.
  const detalheSel = selectedVendedor;
  const [detalhe, setDetalhe] = useState<RaioXDetalheRow[]>([]);
  const [detalheVendedores, setDetalheVendedores] = useState<{ codVendedor: string; vendedor: string }[]>([]);
  const [detalheLoading, setDetalheLoading] = useState(true);
  const [detalheError, setDetalheError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setDetalheLoading(true);
      setDetalheError(null);
      try {
        const data = await fetchRaioXDetalhe({
          ano,
          mes: dia ? undefined : mes || undefined,
          dia: dia || undefined,
          codVendedor: detalheSel || undefined,
        });
        if (!mounted) return;
        setDetalhe(data.rows);
        setDetalheVendedores(data.vendedores);
      } catch (e) {
        if (mounted) setDetalheError(e instanceof Error ? e.message : 'Falha ao carregar vendedor detalhado');
      } finally {
        if (mounted) setDetalheLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [detalheSel, ano, mes, dia]);

  // Opções do filtro: vendedores do Raio-X + vendedores que só existem no detalhado.
  const vendedorOptionsAll = useMemo(() => {
    const map = new Map<string, string>(vendedorOptions);
    detalheVendedores.forEach((v) => {
      if (!map.has(v.codVendedor)) map.set(v.codVendedor, v.vendedor || v.codVendedor);
    });
    return Array.from(map.entries()).sort((x, y) => x[1].localeCompare(y[1], 'pt-BR'));
  }, [vendedorOptions, detalheVendedores]);

  // Agrega as visitas por dia para o gráfico (visitas, vendas e valor vendido).
  const detalheChart = useMemo(() => {
    const byDay = new Map<string, { visitas: number; vendas: number; valor: number }>();
    detalhe.forEach((r) => {
      const d = byDay.get(r.data) || { visitas: 0, vendas: 0, valor: 0 };
      d.visitas += 1;
      if (r.venda) d.vendas += 1;
      d.valor += r.valorVenda || 0;
      byDay.set(r.data, d);
    });
    return Array.from(byDay.entries())
      .sort((x, y) => x[0].localeCompare(y[0]))
      .map(([data, d]) => ({
        dia: `${data.slice(8, 10)}/${data.slice(5, 7)}`,
        visitas: d.visitas,
        vendas: d.vendas,
        valor: Math.round(d.valor * 100) / 100,
      }));
  }, [detalhe]);

  const detalheResumo = useMemo(
    () => ({
      visitas: detalhe.length,
      vendas: detalhe.filter((r) => r.venda).length,
      valor: detalhe.reduce((acc, r) => acc + (r.valorVenda || 0), 0),
      foraRota: detalhe.filter((r) => !r.dentroRota).length,
    }),
    [detalhe]
  );

  const detalheNome = detalheSel ? vendedorOptionsAll.find(([c]) => c === detalheSel)?.[1] || '' : '';

  useEffect(() => {
    if (!loading && !detalheLoading && selectedVendedor && !vendedorOptionsAll.some(([code]) => code === selectedVendedor)) {
      setSelectedVendedor('');
    }
  }, [vendedorOptionsAll, selectedVendedor, loading, detalheLoading]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      const matchesVendedor = !selectedVendedor || r.codVendedor === selectedVendedor;
      const matchesQuery =
        !q ||
        (r.vendedor || '').toLowerCase().includes(q) ||
        (r.codVendedor || '').toLowerCase().includes(q) ||
        (r.equipe || '').toLowerCase().includes(q) ||
        (r.apontamentosInconsistencia || '').toLowerCase().includes(q);
      return matchesVendedor && matchesQuery;
    });
  }, [rows, query, selectedVendedor]);

  const totals = useMemo(() => {
    const n = filtered.length || 1;
    return filtered.reduce(
      (acc, r) => ({
        visitasPrevistas: acc.visitasPrevistas + (r.visitasPrevistas || 0),
        visitasRealizadas: acc.visitasRealizadas + (r.visitasRealizadas || 0),
        pedidos: acc.pedidos + (r.pedidos || 0),
        visitasForaRota: acc.visitasForaRota + (r.visitasForaRota || 0),
        percPositivacao: acc.percPositivacao + (r.percPositivacao || 0) / n,
        percForaRota: acc.percForaRota + (r.percForaRota || 0) / n,
        percGps: acc.percGps + (r.percGps || 0) / n,
        produtividade: acc.produtividade + (r.produtividade || 0) / n,
      }),
      {
        visitasPrevistas: 0,
        visitasRealizadas: 0,
        pedidos: 0,
        visitasForaRota: 0,
        percPositivacao: 0,
        percForaRota: 0,
        percGps: 0,
        produtividade: 0,
      }
    );
  }, [filtered]);

  const acumulado = useMemo(() => {
    const n = filtered.length || 1;
    return filtered.reduce(
      (acc, r) => ({
        prevista: acc.prevista + (r.acumuladoPrevista || 0),
        realizadas: acc.realizadas + (r.acumuladoRealizadas || 0),
        porcentagem: acc.porcentagem + (r.acumuladoPorcentagem || 0) / n,
        percPositivacao: acc.percPositivacao + (r.percPositivacaoAcumulado || 0) / n,
      }),
      { prevista: 0, realizadas: 0, porcentagem: 0, percPositivacao: 0 }
    );
  }, [filtered]);

  const chartData = useMemo(
    () =>
      [...filtered]
        .sort((a, b) => (b.visitasPrevistas || 0) - (a.visitasPrevistas || 0))
        .slice(0, CHART_MAX_BARS)
        .map((r) => ({
          vendedor: r.vendedor || r.codVendedor,
          previstas: r.visitasPrevistas,
          realizadas: r.visitasRealizadas,
          percPositivacao: Math.round((r.percPositivacao || 0) * 1000) / 10,
        })),
    [filtered]
  );

  const handleExport = () => [
    {
      sheetName: 'RaioX',
      data: filtered.map((r) => ({
        Código: r.codVendedor,
        Vendedor: r.vendedor,
        Equipe: r.equipe,
        Dias: r.diasComDados,
        'Visitas Prev.': r.visitasPrevistas,
        'Visitas Real.': r.visitasRealizadas,
        'Fora de Rota': r.visitasForaRota,
        '% Fora Rota': r.percForaRota,
        '% GPS': r.percGps,
        Pedidos: r.pedidos,
        '% Positivação': r.percPositivacao,
        Produtividade: r.produtividade,
        Início: fmtHora(r.horaInicio),
        Fim: fmtHora(r.horaFim),
        'T. Campo': fmtHora(r.tempoCampo),
        'Acumulado Prev.': r.acumuladoPrevista,
        'Acumulado Real.': r.acumuladoRealizadas,
        'Acumulado %': r.acumuladoPorcentagem,
        '% Positivação Acumulada': r.percPositivacaoAcumulado,
        Apontamentos: r.apontamentosInconsistencia || '',
      })),
    },
  ];

  const anoOptions = anosDisponiveis.map((a) => ({ value: String(a), label: String(a) }));
  const mesOptions = MESES.map((label, idx) => ({ value: String(idx + 1), label }));

  const kpiCards: [string, string, string?][] = [
    ['Visitas Previstas', fmtNum(totals.visitasPrevistas)],
    ['Visitas Realizadas', fmtNum(totals.visitasRealizadas)],
    ['% Fora de Rota', fmtPct(totals.percForaRota)],
    ['% GPS', fmtPct(totals.percGps)],
    ['Pedidos', fmtNum(totals.pedidos)],
    ['% Positivação', fmtPct(totals.percPositivacao)],
    ['Produtividade', fmtNum(totals.produtividade)],
  ];

  const groupHeaderStyle: React.CSSProperties = {
    padding: '8px 12px',
    textAlign: 'center',
    fontSize: 10.5,
    fontWeight: 700,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: t.textMuted,
    borderBottom: `1px solid ${t.border}`,
  };
  const colHeaderStyle: React.CSSProperties = {
    padding: '8px 12px',
    textAlign: 'left',
    fontWeight: 600,
    fontSize: 11.5,
    color: t.textMuted,
    borderBottom: `1px solid ${t.border}`,
    whiteSpace: 'nowrap',
  };
  const cellStyle: React.CSSProperties = { padding: '10px 12px', whiteSpace: 'nowrap' };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <div>
          <h1 className="num" style={{ margin: '0 0 4px', fontSize: 24, fontWeight: 700, color: t.text }}>
            Raio-X SAR
          </h1>
          <p style={{ margin: 0, fontSize: 13, color: t.textSecondary }}>
            Acompanhamento diário de vendedores importado da planilha Raio-X (aba "Acompanhamento").
          </p>
        </div>
        <ExportExcelButton onPrepareData={handleExport} filename="raio-x-sar.xlsx" />
      </div>

      {/* FILTROS: dia tem prioridade sobre mês/ano — ver comentário no fetch acima */}
      <div
        style={{
          display: 'flex',
          gap: 10,
          alignItems: 'center',
          flexWrap: 'wrap',
          marginBottom: 16,
          background: t.surface,
          border: `1px solid ${t.border}`,
          borderRadius: 12,
          padding: 12,
        }}
      >
        <SingleSelectFilter
          label="Ano"
          options={anoOptions}
          value={String(ano)}
          onChange={(v) => setAno(Number(v) || currentYear)}
          allowClear={false}
        />
        <SingleSelectFilter
          label="Mês"
          options={mesOptions}
          value={mes ? String(mes) : ''}
          onChange={(v) => setMes(v ? Number(v) : '')}
          placeholder="Todos os meses"
          allLabel="Todos os meses"
        />

        <div>
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 11,
              fontWeight: 600,
              color: t.textMuted,
              marginBottom: 4,
            }}
          >
            <Calendar size={12} /> Dia específico
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input
              type="date"
              value={dia}
              onChange={(e) => setDia(e.target.value)}
              style={{
                padding: '8px 10px',
                borderRadius: 8,
                border: `1px solid ${t.border}`,
                background: t.surfaceElevated,
                color: t.text,
                fontSize: 13,
              }}
            />
            {dia && (
              <button
                type="button"
                onClick={() => setDia('')}
                title="Voltar para visão por mês/ano"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 30,
                  height: 34,
                  borderRadius: 8,
                  border: `1px solid ${t.border}`,
                  background: t.surfaceElevated,
                  color: t.textSecondary,
                  cursor: 'pointer',
                }}
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {canFilterVendedor && (
          <SingleSelectFilter
            label="Vendedor"
            options={vendedorOptionsAll.map(([code, nome]) => ({ value: code, label: nome }))}
            value={selectedVendedor}
            onChange={setSelectedVendedor}
            placeholder="Todos os vendedores"
            allLabel="Todos os vendedores"
          />
        )}

        <div style={{ marginLeft: 'auto', minWidth: 220 }}>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar vendedor ou equipe..."
            style={{
              width: '100%',
              padding: '9px 12px',
              borderRadius: 8,
              border: `1px solid ${t.border}`,
              background: t.surfaceElevated,
              color: t.text,
              fontSize: 13,
            }}
          />
        </div>
      </div>

      {!dia && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: t.textMuted, marginBottom: 14 }}>
          <Layers size={13} />
          <span>
            Valores agregados de {mes ? `${MESES[mes - 1]}/${ano}` : `todo o ano de ${ano}`} — soma para contagens
            (visitas, pedidos), média para percentuais.
          </span>
        </div>
      )}

      {loading && <LoadingBlock />}
      {error && <ErrorBlock message={error} />}

      {!loading && !error && (
        <>
          {/* KPIs — período/dia selecionado */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 10, marginBottom: 14 }}>
            {kpiCards.map(([label, value]) => (
              <div key={label} style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 10, padding: 12 }}>
                <div style={{ fontSize: 11, color: t.textMuted, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Activity size={13} />
                  {label}
                </div>
                <div className="num" style={{ fontWeight: 700, color: t.text, fontSize: 16, marginTop: 4 }}>
                  {value}
                </div>
              </div>
            ))}
          </div>

          {/* KPIs — acumulado (campanha/período informado na própria planilha) */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: t.textMuted, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8 }}>
              Indicadores acumulados (conforme planilha)
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10 }}>
              {[
                ['Acumulado Previsto', fmtNum(acumulado.prevista)],
                ['Acumulado Realizado', fmtNum(acumulado.realizadas)],
                ['% Acumulado', fmtPct(acumulado.porcentagem)],
                ['% Positivação Acumulada', fmtPct(acumulado.percPositivacao)],
              ].map(([label, value]) => (
                <div key={label} style={{ background: t.surfaceElevated, border: `1px solid ${t.border}`, borderRadius: 10, padding: 12 }}>
                  <div style={{ fontSize: 11, color: t.textMuted }}>{label}</div>
                  <div className="num" style={{ fontWeight: 700, color: t.text, fontSize: 15, marginTop: 4 }}>
                    {value}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {filtered.length === 0 ? (
            <EmptyBlock description="Nenhum registro de Raio-X encontrado para os filtros atuais. Importe a planilha em Admin → Importação ou ajuste dia/mês/ano." />
          ) : (
            <>
              {/* GRÁFICO — visitas previstas x realizadas por vendedor, com % positivação */}
              <div
                style={{
                  background: t.surface,
                  border: `1px solid ${t.border}`,
                  borderRadius: 12,
                  padding: 16,
                  marginBottom: 16,
                  height: 340,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <BarChart3 size={16} color={t.primary} />
                  <div style={{ fontSize: 14, fontWeight: 700, color: t.text }}>Visitas Previstas x Realizadas por Vendedor</div>
                  {chartData.length < filtered.length && (
                    <span style={{ fontSize: 11, color: t.textMuted }}>
                      (top {CHART_MAX_BARS} de {filtered.length} vendedores, por visitas previstas)
                    </span>
                  )}
                </div>
                <ResponsiveContainer width="100%" height="86%">
                  <ComposedChart data={chartData} margin={{ top: 4, right: 8, left: -8, bottom: 24 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={t.border} vertical={false} />
                    <XAxis
                      dataKey="vendedor"
                      stroke={t.textMuted}
                      fontSize={11}
                      tickLine={false}
                      axisLine={{ stroke: t.border }}
                      angle={-20}
                      textAnchor="end"
                      interval={0}
                      height={50}
                    />
                    <YAxis yAxisId="left" stroke={t.textMuted} fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      stroke={t.textMuted}
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v) => `${v}%`}
                      domain={[0, 100]}
                    />
                    <Tooltip
                      cursor={{ fill: `${t.primary}08` }}
                      contentStyle={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 8, fontSize: 12 }}
                      formatter={(value: number, name: string) =>
                        name === '% Positivação' ? [`${value}%`, name] : [value.toLocaleString('pt-BR'), name]
                      }
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar yAxisId="left" dataKey="previstas" name="Previstas" fill={t.textMuted} radius={[4, 4, 0, 0]} maxBarSize={36} />
                    <Bar yAxisId="left" dataKey="realizadas" name="Realizadas" fill={t.primary} radius={[4, 4, 0, 0]} maxBarSize={36} />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="percPositivacao"
                      name="% Positivação"
                      stroke="#3DD68C"
                      strokeWidth={2.5}
                      dot={{ r: 3, fill: '#3DD68C' }}
                      activeDot={{ r: 5 }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>

              {/* TABELA — todos os vendedores filtrados, agrupada como na planilha original */}
              <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 12, overflow: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                  <thead>
                    <tr>
                      <th colSpan={2} style={groupHeaderStyle}>Identificação</th>
                      <th colSpan={4} style={{ ...groupHeaderStyle, borderLeft: `1px solid ${t.border}` }}>Visitas</th>
                      <th colSpan={4} style={{ ...groupHeaderStyle, borderLeft: `1px solid ${t.border}` }}>Positivação</th>
                      <th colSpan={3} style={{ ...groupHeaderStyle, borderLeft: `1px solid ${t.border}` }}>Horários</th>
                      <th colSpan={4} style={{ ...groupHeaderStyle, borderLeft: `1px solid ${t.border}` }}>Acumulado</th>
                      <th colSpan={1} style={{ ...groupHeaderStyle, borderLeft: `1px solid ${t.border}` }}>Observações</th>
                    </tr>
                    <tr>
                      <th style={colHeaderStyle}>Vendedor</th>
                      <th style={colHeaderStyle}>Equipe</th>
                      <th style={{ ...colHeaderStyle, borderLeft: `1px solid ${t.border}` }}>Dias</th>
                      <th style={colHeaderStyle}>Prev.</th>
                      <th style={colHeaderStyle}>Real.</th>
                      <th style={colHeaderStyle}>% Fora Rota</th>
                      <th style={{ ...colHeaderStyle, borderLeft: `1px solid ${t.border}` }}>% GPS</th>
                      <th style={colHeaderStyle}>Pedidos</th>
                      <th style={colHeaderStyle}>% Positiv.</th>
                      <th style={colHeaderStyle}>Produtiv.</th>
                      <th style={{ ...colHeaderStyle, borderLeft: `1px solid ${t.border}` }}>Início</th>
                      <th style={colHeaderStyle}>Fim</th>
                      <th style={colHeaderStyle}>T. Campo</th>
                      <th style={{ ...colHeaderStyle, borderLeft: `1px solid ${t.border}` }}>Prev.</th>
                      <th style={colHeaderStyle}>Real.</th>
                      <th style={colHeaderStyle}>%</th>
                      <th style={colHeaderStyle}>% Positiv.</th>
                      <th style={{ ...colHeaderStyle, borderLeft: `1px solid ${t.border}` }}>Apontamentos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((r) => (
                      <tr
                        key={r.codVendedor}
                        onClick={() => setSelectedVendedor(selectedVendedor === r.codVendedor ? '' : r.codVendedor)}
                        title="Clique para ver o Vendedor Detalhado"
                        style={{
                          borderTop: `1px solid ${t.border}`,
                          color: t.text,
                          cursor: 'pointer',
                          background: selectedVendedor === r.codVendedor ? `${t.primary}14` : undefined,
                        }}
                      >
                        <td style={{ ...cellStyle, fontWeight: 600 }}>{r.vendedor || r.codVendedor}</td>
                        <td style={{ ...cellStyle, color: t.textSecondary }}>{r.equipe || '—'}</td>
                        <td className="num" style={{ ...cellStyle, borderLeft: `1px solid ${t.border}`, color: t.textMuted }}>
                          {r.diasComDados}
                        </td>
                        <td className="num" style={cellStyle}>{fmtNum(r.visitasPrevistas)}</td>
                        <td className="num" style={cellStyle}>{fmtNum(r.visitasRealizadas)}</td>
                        <td className="num" style={cellStyle}>{fmtPct(r.percForaRota)}</td>
                        <td className="num" style={{ ...cellStyle, borderLeft: `1px solid ${t.border}` }}>{fmtPct(r.percGps)}</td>
                        <td className="num" style={cellStyle}>{fmtNum(r.pedidos)}</td>
                        <td className="num" style={cellStyle}>{fmtPct(r.percPositivacao)}</td>
                        <td className="num" style={cellStyle}>{fmtNum(r.produtividade)}</td>
                        <td className="num" style={{ ...cellStyle, borderLeft: `1px solid ${t.border}`, color: t.textSecondary }}>
                          {fmtHora(r.horaInicio)}
                        </td>
                        <td className="num" style={{ ...cellStyle, color: t.textSecondary }}>{fmtHora(r.horaFim)}</td>
                        <td className="num" style={{ ...cellStyle, color: t.textSecondary }}>{fmtHora(r.tempoCampo)}</td>
                        <td className="num" style={{ ...cellStyle, borderLeft: `1px solid ${t.border}`, color: t.textMuted }}>
                          {fmtNum(r.acumuladoPrevista)}
                        </td>
                        <td className="num" style={{ ...cellStyle, color: t.textMuted }}>{fmtNum(r.acumuladoRealizadas)}</td>
                        <td className="num" style={{ ...cellStyle, color: t.textMuted }}>{fmtPct(r.acumuladoPorcentagem)}</td>
                        <td className="num" style={{ ...cellStyle, color: t.textMuted }}>{fmtPct(r.percPositivacaoAcumulado)}</td>
                        <td
                          style={{
                            ...cellStyle,
                            borderLeft: `1px solid ${t.border}`,
                            color: r.apontamentosInconsistencia ? t.text : t.textMuted,
                            whiteSpace: 'normal',
                            maxWidth: 280,
                            minWidth: 140,
                            lineHeight: 1.35,
                          }}
                          title={r.apontamentosInconsistencia || undefined}
                        >
                          {r.apontamentosInconsistencia || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}

      {/* VENDEDOR DETALHADO — visita a visita (tabela vendedor_detalhado) */}
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: t.text, marginBottom: 8 }}>
                  Vendedor Detalhado{detalheNome ? ` — ${detalheNome}` : ''}
                  {!detalheSel && <span style={{ fontWeight: 400, fontSize: 12, color: t.textMuted }}> (todos — clique em um vendedor da tabela para filtrar)</span>}
                </div>
                {detalheLoading ? (
                  <LoadingBlock />
                ) : detalheError ? (
                  <ErrorBlock message={detalheError} />
                ) : detalhe.length === 0 ? (
                  <EmptyBlock description="Nenhuma visita detalhada para este vendedor no período. Importe a planilha Vendedor Detalhado em Admin → Importação." />
                ) : (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 10, marginBottom: 14 }}>
                      {([
                        ['Visitas', fmtNum(detalheResumo.visitas)],
                        ['Vendas', fmtNum(detalheResumo.vendas)],
                        ['Valor Vendido', detalheResumo.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })],
                        ['Fora de Rota', fmtNum(detalheResumo.foraRota)],
                      ] as [string, string][]).map(([label, value]) => (
                        <div key={label} style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 10, padding: 12 }}>
                          <div style={{ fontSize: 11, color: t.textMuted }}>{label}</div>
                          <div className="num" style={{ fontWeight: 700, color: t.text, fontSize: 16, marginTop: 4 }}>{value}</div>
                        </div>
                      ))}
                    </div>

                    <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 12, padding: 16, marginBottom: 16, height: 320 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                        <BarChart3 size={16} color={t.primary} />
                        <div style={{ fontSize: 14, fontWeight: 700, color: t.text }}>Visitas, Vendas e Valor Vendido por Dia</div>
                      </div>
                      <ResponsiveContainer width="100%" height="86%">
                        <ComposedChart data={detalheChart} margin={{ top: 4, right: 8, left: -8, bottom: 4 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke={t.border} vertical={false} />
                          <XAxis dataKey="dia" stroke={t.textMuted} fontSize={11} tickLine={false} axisLine={{ stroke: t.border }} />
                          <YAxis yAxisId="left" stroke={t.textMuted} fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                          <YAxis yAxisId="right" orientation="right" stroke={t.textMuted} fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => v.toLocaleString('pt-BR')} />
                          <Tooltip
                            contentStyle={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 8, fontSize: 12 }}
                            formatter={(value: number, name: string) =>
                              name === 'Valor Vendido'
                                ? [value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }), name]
                                : [value.toLocaleString('pt-BR'), name]
                            }
                          />
                          <Legend wrapperStyle={{ fontSize: 12 }} />
                          <Bar yAxisId="left" dataKey="visitas" name="Visitas" fill={t.textMuted} radius={[4, 4, 0, 0]} maxBarSize={28} />
                          <Bar yAxisId="left" dataKey="vendas" name="Vendas" fill={t.primary} radius={[4, 4, 0, 0]} maxBarSize={28} />
                          <Line yAxisId="right" type="monotone" dataKey="valor" name="Valor Vendido" stroke="#3DD68C" strokeWidth={2.5} dot={{ r: 3, fill: '#3DD68C' }} />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>

                    <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 12, overflow: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                        <thead>
                          <tr>
                            {['Data', 'Hora', ...(detalheSel ? [] : ['Vendedor']), 'Cliente', 'Ação', 'Dentro da Rota', 'Permanência', 'Venda', 'Valor', 'Motivo Não Venda', 'Motivo Não Visita'].map((h) => (
                              <th key={h} style={colHeaderStyle}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {detalhe.map((r, i) => (
                            <tr key={`${r.data}-${r.hora}-${r.codigoCliente}-${i}`} style={{ borderTop: `1px solid ${t.border}`, color: t.text }}>
                              <td style={{ ...cellStyle, fontWeight: 600 }}>{r.data.slice(8, 10)}/{r.data.slice(5, 7)}/{r.data.slice(0, 4)}</td>
                              <td className="num" style={{ ...cellStyle, color: t.textSecondary }}>{fmtHora(r.hora)}</td>
                              {!detalheSel && <td style={{ ...cellStyle, fontWeight: 600 }}>{r.vendedor || r.codigoVendedor}</td>}
                              <td style={{ ...cellStyle, whiteSpace: 'normal', minWidth: 160 }}>
                                {r.nomeCliente || '—'}
                                {r.codigoCliente && <span style={{ color: t.textMuted }}> ({r.codigoCliente})</span>}
                              </td>
                              <td style={{ ...cellStyle, color: t.textSecondary }}>{r.acao || '—'}</td>
                              <td style={{ ...cellStyle, color: r.dentroRota ? t.text : '#F5A623' }}>{r.dentroRota ? 'Sim' : 'Não'}</td>
                              <td className="num" style={{ ...cellStyle, color: t.textSecondary }}>{r.permanencia || '—'}</td>
                              <td style={{ ...cellStyle, color: r.venda ? '#3DD68C' : t.textMuted }}>{r.venda ? 'Sim' : 'Não'}</td>
                              <td className="num" style={cellStyle}>
                                {r.valorVenda ? r.valorVenda.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—'}
                              </td>
                              <td style={{ ...cellStyle, whiteSpace: 'normal', minWidth: 140, color: r.motivoNaoVenda ? t.text : t.textMuted }}>{r.motivoNaoVenda || '—'}</td>
                              <td style={{ ...cellStyle, whiteSpace: 'normal', minWidth: 140, color: r.motivoNaoVisita ? t.text : t.textMuted }}>{r.motivoNaoVisita || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>
    </div>
  );
};
