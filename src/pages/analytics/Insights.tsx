import React, { useEffect, useState } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { useGlobalFilter } from '../../context/GlobalFilterContext';
import { PeriodSelector } from '../../components/common/PeriodSelector';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '../../components/common/DataState';
import { fetchDashboard, fetchNotPositivated, DashboardResponse, NotPositivatedResponse } from '../../lib/api';
import { Sparkles } from 'lucide-react';

export const InsightsPage: React.FC = () => {
  const { t } = useTheme();
  const { ano, mes, startDate, endDate, periodType, selectedPeriod } = useGlobalFilter();
  const [dash, setDash] = useState<DashboardResponse | null>(null);
  const [np, setNp] = useState<NotPositivatedResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true); setError(null);
      try {
        const [d, n] = await Promise.all([
          fetchDashboard({
            ano: periodType === 'personalizado' ? undefined : ano,
            mes: periodType === 'mensal' ? mes : undefined,
            start: startDate || undefined,
            end: endDate || undefined,
          }),
          fetchNotPositivated({ start: startDate || undefined, end: endDate || undefined }),
        ]);
        if (mounted) { setDash(d); setNp(n); }
      } catch (e) {
        if (mounted) setError(e instanceof Error ? e.message : 'Falha ao carregar insights');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [ano, mes, startDate, endDate, periodType]);

  const cards: Array<{ titulo: string; descricao: string }> = [];
  if (dash) {
    cards.push({
      titulo: `Atingimento ${dash.kpis.atingimento.toFixed(1)}% no período ${selectedPeriod}`,
      descricao: `Meta ${dash.kpis.meta.toLocaleString('pt-BR')} · Realizado ${dash.kpis.realizado.toLocaleString('pt-BR')} · GAP ${dash.kpis.gap.toLocaleString('pt-BR')}.`,
    });
    if ((dash.fabricantes || []).length > 0) {
      const top = [...dash.fabricantes].sort((a, b) => b.realizado - a.realizado)[0];
      cards.push({
        titulo: `Maior realizado: ${top.fabricante}`,
        descricao: `Realizado R$ ${top.realizado.toLocaleString('pt-BR')} (${top.pctR.toFixed(1)}% da meta) · margem ${top.pctMargem.toFixed(1)}%.`,
      });
    }
  }
  if (np) {
    cards.push({
      titulo: `${np.kpis.naoPositivados} clientes não positivados`,
      descricao: `Base ${np.kpis.baseClientes} · positivados ${np.kpis.positivados} · taxa ${np.kpis.positivacaoPct}%.`,
    });
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <div>
          <h1 className="num" style={{ margin: '0 0 4px', fontSize: 24, fontWeight: 700, color: t.text }}>Insights</h1>
          <p style={{ margin: 0, fontSize: 13, color: t.textSecondary }}>Resumos gerados apenas com KPIs reais do database.</p>
        </div>
        <PeriodSelector />
      </div>
      {loading && <LoadingBlock />}
      {error && <ErrorBlock message={error} />}
      {!loading && !error && cards.length === 0 && <EmptyBlock />}
      {!loading && !error && cards.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {cards.map((c) => (
            <div key={c.titulo} style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 12, padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <Sparkles size={16} color={t.primary} />
                <strong style={{ color: t.text }}>{c.titulo}</strong>
              </div>
              <div style={{ fontSize: 13, color: t.textSecondary }}>{c.descricao}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
