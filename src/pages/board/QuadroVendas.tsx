import React, { useEffect, useMemo, useState } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { useGlobalFilter } from '../../context/GlobalFilterContext';
import { PeriodSelector } from '../../components/common/PeriodSelector';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '../../components/common/DataState';
import { getErrorMessage, fetchSalesBoard, SalesBoardResponse } from '../../lib/api';
import { Target, TrendingUp, Users, Gauge, Search } from 'lucide-react';
import { AttainmentBar, KpiCard, SourceBadge, formatCurrency, formatNumber, formatPercent, tdStyle, thStyle } from './shared';

/**
 * Quadro de Vendas — item avulso no topo do menu.
 *
 * Meta (importada pelo administrador em "Dados e Exportações") x realizado do
 * período, vendedor a vendedor. O realizado vem de GET /api/board/sales, que
 * já consulta a API externa quando ela estiver configurada no backend — esta
 * tela não muda quando isso acontecer.
 */
export const QuadroVendasPage: React.FC = () => {
  const { t } = useTheme();
  const { periodType, ano, mes, startDate, endDate, periodLabel } = useGlobalFilter();

  const [data, setData] = useState<SalesBoardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetchSalesBoard({
          ano: periodType === 'personalizado' ? undefined : ano,
          mes: periodType === 'mensal' ? mes : undefined,
          start: startDate || undefined,
          end: endDate || undefined,
        });
        if (mounted) setData(res);
      } catch (e) {
        if (mounted) {
          setData(null);
          setError(getErrorMessage(e, 'Falha ao carregar o quadro de vendas.'));
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [periodType, ano, mes, startDate, endDate]);

  const rows = useMemo(() => {
    const all = data?.rows ?? [];
    const term = query.trim().toLowerCase();
    if (!term) return all;
    return all.filter(
      (r) =>
        (r.vendedor || '').toLowerCase().includes(term) ||
        (r.equipe || '').toLowerCase().includes(term) ||
        r.codVendedor.toLowerCase().includes(term)
    );
  }, [data, query]);

  const kpis = data?.kpis;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap', marginBottom: 18 }}>
        <div>
          <h1 className="num" style={{ margin: '0 0 4px', fontSize: 24, fontWeight: 700, color: t.text }}>
            Quadro de Vendas
          </h1>
          <p style={{ margin: 0, fontSize: 13, color: t.textSecondary }}>
            Meta importada x realizado do período, por vendedor — {periodLabel}.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {data && <SourceBadge fonte={data.fonteRealizado} />}
          <PeriodSelector compact />
        </div>
      </div>

      {kpis && !loading && !error && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 18 }}>
          <KpiCard label="Meta do período" value={formatCurrency(kpis.meta)} icon={Target} hint="Somatório das metas importadas" />
          <KpiCard label="Realizado" value={formatCurrency(kpis.realizado)} icon={TrendingUp} accent="#22c55e" />
          <KpiCard
            label="Gap"
            value={formatCurrency(kpis.gap)}
            icon={Gauge}
            accent={kpis.gap >= 0 ? '#22c55e' : '#ef4444'}
            hint={`Atingimento de ${formatPercent(kpis.atingimento)}`}
          />
          <KpiCard label="Vendedores" value={formatNumber(kpis.vendedores)} icon={Users} hint="Com meta ou realizado no período" />
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, border: `1px solid ${t.border}`, borderRadius: 8, padding: '9px 14px', background: t.surface, marginBottom: 14, maxWidth: 380 }}>
        <Search size={16} color={t.textMuted} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar vendedor, código ou equipe..."
          style={{ border: 'none', outline: 'none', background: 'transparent', color: t.text, width: '100%', fontSize: 13 }}
        />
      </div>

      {loading && <LoadingBlock label="Carregando quadro de vendas..." />}
      {error && <ErrorBlock message={error} />}
      {!loading && !error && rows.length === 0 && (
        <EmptyBlock
          title="Nenhum vendedor no período"
          description="Importe as metas em Administração › Dados e Exportações e confirme se a fonte de realizado está respondendo para este período."
        />
      )}

      {!loading && !error && rows.length > 0 && (
        <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 880 }}>
              <thead>
                <tr style={{ background: t.bgSecondary, borderBottom: `1px solid ${t.border}` }}>
                  <th style={thStyle(t.textMuted)}>Vendedor</th>
                  <th style={thStyle(t.textMuted)}>Equipe</th>
                  <th style={thStyle(t.textMuted, 'right')}>Meta</th>
                  <th style={thStyle(t.textMuted, 'right')}>Realizado</th>
                  <th style={thStyle(t.textMuted, 'right')}>Gap</th>
                  <th style={thStyle(t.textMuted)}>Atingimento</th>
                  <th style={thStyle(t.textMuted, 'right')}>Cobertura</th>
                  <th style={thStyle(t.textMuted, 'right')}>Margem</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.codVendedor} style={{ borderBottom: `1px solid ${t.border}` }}>
                    <td style={tdStyle(t.text)}>
                      <div style={{ fontWeight: 600 }}>{r.vendedor || '—'}</div>
                      <div className="num" style={{ fontSize: 11.5, color: t.textMuted }}>{r.codVendedor}</div>
                    </td>
                    <td style={tdStyle(t.textSecondary)}>{r.equipe || '—'}</td>
                    <td className="num" style={tdStyle(t.textSecondary, 'right')}>{formatCurrency(r.meta)}</td>
                    <td className="num" style={{ ...tdStyle(t.text, 'right'), fontWeight: 600 }}>{formatCurrency(r.realizado)}</td>
                    <td className="num" style={tdStyle(r.gap >= 0 ? '#22c55e' : '#ef4444', 'right')}>{formatCurrency(r.gap)}</td>
                    <td style={tdStyle(t.text)}>
                      <AttainmentBar pct={r.atingimento} />
                    </td>
                    <td className="num" style={tdStyle(t.textSecondary, 'right')}>
                      {formatNumber(r.realizadoCobertura)} / {formatNumber(r.metaCobertura)}
                    </td>
                    <td className="num" style={tdStyle(t.textSecondary, 'right')}>{formatPercent(r.margem)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
