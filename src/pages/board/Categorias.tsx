import React, { useEffect, useMemo, useState } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { useGlobalFilter } from '../../context/GlobalFilterContext';
import { PeriodSelector } from '../../components/common/PeriodSelector';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '../../components/common/DataState';
import { getErrorMessage, fetchCategoryBoard, CategoryBoardResponse } from '../../lib/api';
import { Target, TrendingUp, Gauge, Layers, Search } from 'lucide-react';
import { AttainmentBar, KpiCard, SourceBadge, formatCurrency, formatNumber, formatPercent, tdStyle, thStyle } from './shared';

/**
 * Categorias — item avulso no topo do menu.
 *
 * Mesma leitura do Quadro de Vendas, agrupada por categoria/fabricante:
 * meta importada x realizado de GET /api/board/categories.
 */
export const CategoriasPage: React.FC = () => {
  const { t } = useTheme();
  const { periodType, ano, mes, startDate, endDate, periodLabel } = useGlobalFilter();

  const [data, setData] = useState<CategoryBoardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetchCategoryBoard({
          ano: periodType === 'personalizado' ? undefined : ano,
          mes: periodType === 'mensal' ? mes : undefined,
          start: startDate || undefined,
          end: endDate || undefined,
        });
        if (mounted) setData(res);
      } catch (e) {
        if (mounted) {
          setData(null);
          setError(getErrorMessage(e, 'Falha ao carregar as categorias.'));
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
    return all.filter((r) => r.categoria.toLowerCase().includes(term));
  }, [data, query]);

  const kpis = data?.kpis;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap', marginBottom: 18 }}>
        <div>
          <h1 className="num" style={{ margin: '0 0 4px', fontSize: 24, fontWeight: 700, color: t.text }}>
            Categorias
          </h1>
          <p style={{ margin: 0, fontSize: 13, color: t.textSecondary }}>
            Meta importada x realizado por categoria/fabricante — {periodLabel}.
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
          <KpiCard label="Categorias" value={formatNumber(kpis.categorias)} icon={Layers} hint="Com meta ou realizado no período" />
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, border: `1px solid ${t.border}`, borderRadius: 8, padding: '9px 14px', background: t.surface, marginBottom: 14, maxWidth: 380 }}>
        <Search size={16} color={t.textMuted} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar categoria..."
          style={{ border: 'none', outline: 'none', background: 'transparent', color: t.text, width: '100%', fontSize: 13 }}
        />
      </div>

      {loading && <LoadingBlock label="Carregando categorias..." />}
      {error && <ErrorBlock message={error} />}
      {!loading && !error && rows.length === 0 && (
        <EmptyBlock
          title="Nenhuma categoria no período"
          description="Importe as metas por categoria em Administração › Dados e Exportações e confirme se a fonte de realizado está respondendo para este período."
        />
      )}

      {!loading && !error && rows.length > 0 && (
        <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 820 }}>
              <thead>
                <tr style={{ background: t.bgSecondary, borderBottom: `1px solid ${t.border}` }}>
                  <th style={thStyle(t.textMuted)}>Categoria</th>
                  <th style={thStyle(t.textMuted, 'right')}>Meta</th>
                  <th style={thStyle(t.textMuted, 'right')}>Realizado</th>
                  <th style={thStyle(t.textMuted, 'right')}>Gap</th>
                  <th style={thStyle(t.textMuted)}>Atingimento</th>
                  <th style={thStyle(t.textMuted, 'right')}>Participação</th>
                  <th style={thStyle(t.textMuted, 'right')}>Margem</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.categoria} style={{ borderBottom: `1px solid ${t.border}` }}>
                    <td style={{ ...tdStyle(t.text), fontWeight: 600 }}>{r.categoria}</td>
                    <td className="num" style={tdStyle(t.textSecondary, 'right')}>{formatCurrency(r.meta)}</td>
                    <td className="num" style={{ ...tdStyle(t.text, 'right'), fontWeight: 600 }}>{formatCurrency(r.realizado)}</td>
                    <td className="num" style={tdStyle(r.gap >= 0 ? '#22c55e' : '#ef4444', 'right')}>{formatCurrency(r.gap)}</td>
                    <td style={tdStyle(t.text)}>
                      <AttainmentBar pct={r.atingimento} />
                    </td>
                    <td className="num" style={tdStyle(t.textSecondary, 'right')}>{formatPercent(r.participacao)}</td>
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
