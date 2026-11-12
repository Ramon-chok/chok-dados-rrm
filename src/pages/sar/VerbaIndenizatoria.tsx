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
import { ScrollableChart } from '../../components/common/ScrollableChart';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '../../components/common/DataState';
import { SingleSelectFilter } from '../../components/common/SingleSelectFilter';
import {
  fetchVerbaIndenizatoria,
  getErrorMessage,
  VerbaIndenizatoriaRow,
} from '../../lib/api';
import { Calendar, DollarSign, Search, X } from 'lucide-react';
import { podeFiltrarEquipe, podeFiltrarVendedor } from '../../types';

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

// Quantos vendedores o gráfico mostra de uma vez (a tabela abaixo sempre
// mostra todos os que passaram no filtro) — evita um eixo X ilegível quando
// a equipe/gerência tem muitos vendedores.
const CHART_MAX_BARS = 20;

function fmtMoeda(v: number | null | undefined): string {
  if (v === null || v === undefined || Number.isNaN(v)) return '—';
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fmtKm(v: number | null | undefined): string {
  if (v === null || v === undefined || Number.isNaN(v)) return '—';
  return `${v.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} km`;
}

/**
 * Verba Indenizatória (SAR) — fechamento da verba de rota por vendedor,
 * alimentado pela importação "Verba Indenizatória" (tabela
 * verba_indenizatoria, ver src/pages/admin/Metas.tsx).
 *
 * Como no Raio-X, o filtro de dia específico tem prioridade sobre mês/ano: com
 * um dia escolhido os valores são os daquele fechamento; sem ele, o servidor
 * soma por vendedor no período (km e dinheiro são aditivos).
 */
export const VerbaIndenizatoriaPage: React.FC = () => {
  const { t } = useTheme();
  const { currentUser } = useAuth();

  const role = currentUser?.role;
  // Vendedor já vê só a própria linha (recorte travado no backend) — para ele
  // o filtro de vendedor não tem o que escolher.
  const canFilterVendedor = podeFiltrarVendedor(role);
  const canFilterEquipe = podeFiltrarEquipe(role);

  const currentYear = new Date().getFullYear();
  const [ano, setAno] = useState<number>(currentYear);
  const [mes, setMes] = useState<number | ''>('');
  const [dia, setDia] = useState<string>('');
  const [anosDisponiveis, setAnosDisponiveis] = useState<number[]>([currentYear]);

  const [rows, setRows] = useState<VerbaIndenizatoriaRow[]>([]);
  const [mode, setMode] = useState<'dia' | 'periodo'>('periodo');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState('');
  const [selectedVendedor, setSelectedVendedor] = useState('');
  const [selectedEquipe, setSelectedEquipe] = useState('');

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchVerbaIndenizatoria({
          ano,
          mes: dia ? undefined : mes || undefined,
          dia: dia || undefined,
        });
        if (!mounted) return;
        setRows(data.rows);
        setMode(data.mode);
        setAnosDisponiveis(data.anosDisponiveis.length ? data.anosDisponiveis : [currentYear]);
      } catch (e) {
        if (mounted) setError(getErrorMessage(e, 'Falha ao carregar a Verba Indenizatória'));
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

  const equipeOptions = useMemo(() => {
    const equipes = new Set<string>();
    rows.forEach((r) => {
      if (r.equipe) equipes.add(r.equipe);
    });
    return Array.from(equipes).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [rows]);

  // Filtro que deixou de existir no novo período não deve seguir travando a tela.
  useEffect(() => {
    if (loading) return;
    if (selectedVendedor && !vendedorOptions.some(([code]) => code === selectedVendedor)) {
      setSelectedVendedor('');
    }
    if (selectedEquipe && !equipeOptions.includes(selectedEquipe)) {
      setSelectedEquipe('');
    }
  }, [vendedorOptions, equipeOptions, selectedVendedor, selectedEquipe, loading]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      const okVendedor = !selectedVendedor || r.codVendedor === selectedVendedor;
      const okEquipe = !selectedEquipe || r.equipe === selectedEquipe;
      const okQuery =
        !q ||
        (r.vendedor || '').toLowerCase().includes(q) ||
        (r.codVendedor || '').toLowerCase().includes(q) ||
        (r.equipe || '').toLowerCase().includes(q);
      return okVendedor && okEquipe && okQuery;
    });
  }, [rows, query, selectedVendedor, selectedEquipe]);

  const totals = useMemo(
    () =>
      filtered.reduce(
        (acc, r) => ({
          kmTotal: acc.kmTotal + (r.kmTotal || 0),
          verba: acc.verba + (r.verbaIndenizatoria || 0),
          desconto: acc.desconto + (r.desconto || 0),
          reembolso: acc.reembolso + (r.reembolso || 0),
          aPagar: acc.aPagar + (r.aPagar || 0),
        }),
        { kmTotal: 0, verba: 0, desconto: 0, reembolso: 0, aPagar: 0 }
      ),
    [filtered]
  );

  const chartData = useMemo(
    () =>
      [...filtered]
        .sort((a, b) => (b.aPagar || 0) - (a.aPagar || 0))
        .slice(0, CHART_MAX_BARS)
        .map((r) => ({
          vendedor: r.vendedor || r.codVendedor,
          verba: Math.round((r.verbaIndenizatoria || 0) * 100) / 100,
          desconto: Math.round((r.desconto || 0) * 100) / 100,
          reembolso: Math.round((r.reembolso || 0) * 100) / 100,
          aPagar: Math.round((r.aPagar || 0) * 100) / 100,
        })),
    [filtered]
  );

  const anoOptions = anosDisponiveis.map((a) => ({ value: String(a), label: String(a) }));
  const mesOptions = MESES.map((label, idx) => ({ value: String(idx + 1), label }));

  const kpiCards: [string, string][] = [
    ['KM Total', fmtKm(totals.kmTotal)],
    ['Verba Indenizatória', fmtMoeda(totals.verba)],
    ['Desconto', fmtMoeda(totals.desconto)],
    ['Reembolso', fmtMoeda(totals.reembolso)],
    ['A Pagar', fmtMoeda(totals.aPagar)],
  ];

  const colHeaderStyle: React.CSSProperties = {
    padding: '8px 12px',
    textAlign: 'left',
    fontWeight: 600,
    fontSize: 11.5,
    color: t.textMuted,
    whiteSpace: 'nowrap',
    // Cabeçalho preso no topo da área rolável. Precisa de fundo opaco, senão
    // as linhas passam por baixo dele ao rolar.
    position: 'sticky',
    top: 0,
    zIndex: 2,
    background: t.surface,
    // boxShadow no lugar de borderBottom: com borderCollapse: 'collapse' a
    // borda de uma célula sticky não é pintada de forma confiável.
    boxShadow: `inset 0 -1px 0 ${t.border}`,
  };
  const cellStyle: React.CSSProperties = { padding: '10px 12px', whiteSpace: 'nowrap' };
  const numCellStyle: React.CSSProperties = { ...cellStyle, textAlign: 'right' };
  /**
   * Linha de totais presa no RODAPÉ da área rolável.
   *
   * O total é a informação mais importante da tela: se ele rolasse junto com
   * as linhas, sumiria assim que a lista passasse da altura visível.
   */
  const footCellStyle: React.CSSProperties = {
    ...cellStyle,
    fontWeight: 700,
    position: 'sticky',
    bottom: 0,
    zIndex: 2,
    background: t.surfaceElevated,
    boxShadow: `inset 0 2px 0 ${t.border}`,
  };
  const footNumCellStyle: React.CSSProperties = { ...footCellStyle, textAlign: 'right' };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <h1 className="num" style={{ margin: 0, fontSize: 24, fontWeight: 700, color: t.text }}>
              Verba Indenizatória
            </h1>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: 6,
                background: `${t.primary}1F`,
                color: t.primary,
                border: `1px solid ${t.primary}40`,
              }}
            >
              SAR
            </span>
          </div>
          <p style={{ margin: 0, fontSize: 13, color: t.textSecondary }}>
            Fechamento da verba de rota por vendedor — km total, verba, desconto, reembolso e o valor a pagar.
            {mode === 'periodo'
              ? ' Os valores do período estão somados por vendedor.'
              : ' Valores do fechamento do dia selecionado.'}
          </p>
        </div>
      </div>

      {/* FILTROS: dia específico tem prioridade sobre mês/ano (ver fetch acima) */}
      <div
        style={{
          display: 'flex',
          gap: 10,
          alignItems: 'flex-end',
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

        {canFilterEquipe && equipeOptions.length > 0 && (
          <SingleSelectFilter
            label="Equipe"
            options={equipeOptions.map((e) => ({ value: e, label: e }))}
            value={selectedEquipe}
            onChange={setSelectedEquipe}
            placeholder="Todas as equipes"
            allLabel="Todas as equipes"
          />
        )}

        {canFilterVendedor && (
          <SingleSelectFilter
            label="Vendedor"
            options={vendedorOptions.map(([code, nome]) => ({ value: code, label: nome }))}
            value={selectedVendedor}
            onChange={setSelectedVendedor}
            placeholder="Todos os vendedores"
            allLabel="Todos os vendedores"
          />
        )}

        <div style={{ flex: 1, minWidth: 200 }}>
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
            <Search size={12} /> Buscar
          </label>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Código, nome ou equipe"
            style={{
              width: '100%',
              padding: '8px 10px',
              borderRadius: 8,
              border: `1px solid ${t.border}`,
              background: t.surfaceElevated,
              color: t.text,
              fontSize: 13,
            }}
          />
        </div>
      </div>

      {loading ? (
        <LoadingBlock label="Carregando verba indenizatória..." />
      ) : error ? (
        <ErrorBlock message={error} />
      ) : rows.length === 0 ? (
        <EmptyBlock
          title="Nenhuma verba indenizatória importada para este período"
          description='Importe a planilha em Administração › Dados e Exportações, escolhendo o conjunto "Verba Indenizatória". A Data de Referência define o período do fechamento.'
        />
      ) : (
        <>
          {/* KPIs */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
              gap: 12,
              marginBottom: 16,
            }}
          >
            {kpiCards.map(([label, value]) => (
              <div
                key={label}
                style={{
                  background: t.surface,
                  border: `1px solid ${t.border}`,
                  borderRadius: 12,
                  padding: '14px 16px',
                }}
              >
                <div style={{ fontSize: 11, fontWeight: 600, color: t.textMuted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                  {label}
                </div>
                <div className="num" style={{ fontSize: 19, fontWeight: 700, color: t.text }}>
                  {value}
                </div>
              </div>
            ))}
          </div>

          {/* GRÁFICO */}
          <div
            style={{
              background: t.surface,
              border: `1px solid ${t.border}`,
              borderRadius: 12,
              padding: 16,
              marginBottom: 16,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <DollarSign size={16} color={t.primary} />
              <div style={{ fontSize: 14, fontWeight: 600, color: t.text }}>
                Verba por vendedor
                {filtered.length > CHART_MAX_BARS && (
                  <span style={{ fontSize: 11.5, fontWeight: 500, color: t.textMuted }}>
                    {' '}
                    — {CHART_MAX_BARS} maiores de {filtered.length.toLocaleString('pt-BR')} (a tabela mostra todos)
                  </span>
                )}
              </div>
            </div>
            {chartData.length === 0 ? (
              <EmptyBlock title="Nenhum vendedor no filtro atual" />
            ) : (
              <ScrollableChart minWidth={Math.max(560, chartData.length * 72)} height={320}>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData} margin={{ top: 8, right: 12, left: 4, bottom: 56 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={t.border} vertical={false} />
                    <XAxis
                      dataKey="vendedor"
                      tick={{ fill: t.textMuted, fontSize: 11 }}
                      angle={-35}
                      textAnchor="end"
                      interval={0}
                      height={64}
                    />
                    <YAxis
                      tick={{ fill: t.textMuted, fontSize: 11 }}
                      tickFormatter={(v: number) => v.toLocaleString('pt-BR', { notation: 'compact' })}
                    />
                    <Tooltip
                      formatter={(v: number) => fmtMoeda(v)}
                      contentStyle={{
                        background: t.surfaceElevated,
                        border: `1px solid ${t.border}`,
                        borderRadius: 8,
                        color: t.text,
                        fontSize: 12,
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12, color: t.textSecondary }} />
                    <Bar dataKey="verba" name="Verba" fill={t.accentBlue} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="desconto" name="Desconto" fill={t.complementaryRed} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="reembolso" name="Reembolso" fill={t.accentPurpleLight} radius={[4, 4, 0, 0]} />
                    <Line dataKey="aPagar" name="A pagar" stroke={t.primary} strokeWidth={2} dot={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </ScrollableChart>
            )}
          </div>

          {/* TABELA */}
          <div
            style={{
              background: t.surface,
              border: `1px solid ${t.border}`,
              borderRadius: 12,
              overflow: 'hidden',
            }}
          >
            {/* Altura FIXA com rolagem só aqui dentro: a lista de vendedores
                não estica mais a página inteira. O cabeçalho fica preso no
                topo e a linha de totais no rodapé, então as duas referências
                continuam à vista enquanto se rola. */}
            <div style={{ maxHeight: 460, overflowY: 'auto', overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, color: t.text }}>
                <thead>
                  <tr>
                    <th style={colHeaderStyle}>Código</th>
                    <th style={colHeaderStyle}>Nome</th>
                    <th style={colHeaderStyle}>Equipe</th>
                    <th style={{ ...colHeaderStyle, textAlign: 'right' }}>KM Total</th>
                    <th style={{ ...colHeaderStyle, textAlign: 'right' }}>Verba Indenizatória</th>
                    <th style={{ ...colHeaderStyle, textAlign: 'right' }}>Desconto</th>
                    <th style={{ ...colHeaderStyle, textAlign: 'right' }}>Reembolso</th>
                    <th style={{ ...colHeaderStyle, textAlign: 'right' }}>A Pagar</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ ...cellStyle, color: t.textMuted, textAlign: 'center', padding: '24px 12px' }}>
                        Nenhum vendedor encontrado com os filtros atuais.
                      </td>
                    </tr>
                  ) : (
                    filtered.map((r) => (
                      <tr key={r.codVendedor} style={{ borderTop: `1px solid ${t.border}` }}>
                        <td className="num" style={cellStyle}>{r.codVendedor}</td>
                        <td style={cellStyle}>{r.vendedor}</td>
                        <td style={{ ...cellStyle, color: t.textSecondary }}>{r.equipe || '—'}</td>
                        <td className="num" style={numCellStyle}>{fmtKm(r.kmTotal)}</td>
                        <td className="num" style={numCellStyle}>{fmtMoeda(r.verbaIndenizatoria)}</td>
                        <td className="num" style={numCellStyle}>{fmtMoeda(r.desconto)}</td>
                        <td className="num" style={numCellStyle}>{fmtMoeda(r.reembolso)}</td>
                        <td className="num" style={{ ...numCellStyle, fontWeight: 700 }}>{fmtMoeda(r.aPagar)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
                {filtered.length > 0 && (
                  <tfoot>
                    <tr>
                      <td style={footCellStyle} colSpan={3}>
                        Total ({filtered.length.toLocaleString('pt-BR')}{' '}
                        {filtered.length === 1 ? 'vendedor' : 'vendedores'})
                      </td>
                      <td className="num" style={footNumCellStyle}>{fmtKm(totals.kmTotal)}</td>
                      <td className="num" style={footNumCellStyle}>{fmtMoeda(totals.verba)}</td>
                      <td className="num" style={footNumCellStyle}>{fmtMoeda(totals.desconto)}</td>
                      <td className="num" style={footNumCellStyle}>{fmtMoeda(totals.reembolso)}</td>
                      <td className="num" style={{ ...footNumCellStyle, color: t.primary }}>
                        {fmtMoeda(totals.aPagar)}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
