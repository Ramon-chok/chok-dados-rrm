import React, { useEffect, useMemo, useState } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { useGlobalFilter } from '../../context/GlobalFilterContext';
import { PeriodSelector } from '../../components/common/PeriodSelector';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '../../components/common/DataState';
import { fetchAnalyticsTree, AnalyticsTreeNode } from '../../lib/api';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

const fmt = (v: number) => `R$ ${v.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`;

export const AnalisesPage: React.FC = () => {
  const { t } = useTheme();
  const { ano, mes, startDate, endDate, periodType } = useGlobalFilter();
  const [tree, setTree] = useState<AnalyticsTreeNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true); setError(null);
      try {
        const data = await fetchAnalyticsTree({
          ano: periodType === 'personalizado' ? undefined : ano,
          mes: periodType === 'mensal' ? mes : undefined,
          start: startDate || undefined,
          end: endDate || undefined,
        });
        if (mounted) setTree(data);
      } catch (e) {
        if (mounted) setError(e instanceof Error ? e.message : 'Falha ao carregar análises');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [ano, mes, startDate, endDate, periodType]);

  const chartData = useMemo(() => tree.map((f) => ({ nome: f.nome, meta: f.meta, realizado: f.realizado })), [tree]);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 18, gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 className="num" style={{ margin: '0 0 4px', fontSize: 24, fontWeight: 700, color: t.text }}>Análises</h1>
          <p style={{ margin: 0, fontSize: 13, color: t.textSecondary }}>Árvore fabricante → equipe → vendedor (indicadores_fabricante).</p>
        </div>
        <PeriodSelector />
      </div>
      {loading && <LoadingBlock />}
      {error && <ErrorBlock message={error} />}
      {!loading && !error && tree.length === 0 && <EmptyBlock />}
      {!loading && !error && tree.length > 0 && (
        <>
          <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 12, padding: 16, height: 260, marginBottom: 16 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke={t.border} />
                <XAxis dataKey="nome" stroke={t.textMuted} fontSize={11} />
                <YAxis stroke={t.textMuted} fontSize={11} />
                <Tooltip />
                <Bar dataKey="meta" fill={t.textMuted} />
                <Bar dataKey="realizado" fill={t.primary} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 12, overflow: 'hidden' }}>
            {tree.map((fab) => (
              <div key={fab.nome} style={{ borderBottom: `1px solid ${t.border}` }}>
                <button onClick={() => setExpanded((s) => ({ ...s, [fab.nome]: !s[fab.nome] }))} style={{ width: '100%', textAlign: 'left', padding: '12px 14px', background: 'transparent', border: 'none', color: t.text, cursor: 'pointer', display: 'flex', justifyContent: 'space-between' }}>
                  <strong>{fab.nome}</strong>
                  <span style={{ color: t.textSecondary }}>{fmt(fab.realizado)} / {fmt(fab.meta)}</span>
                </button>
                {expanded[fab.nome] && (fab.equipes || []).map((eq) => (
                  <div key={eq.nome} style={{ padding: '8px 14px 12px 28px', borderTop: `1px solid ${t.border}` }}>
                    <div style={{ fontWeight: 600, marginBottom: 6 }}>{eq.nome}</div>
                    {(eq.vendedores || []).map((v) => (
                      <div key={v.nome} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, color: t.textSecondary, padding: '4px 0' }}>
                        <span>{v.nome}</span>
                        <span>{fmt(v.realizado)} / {fmt(v.meta)}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};
