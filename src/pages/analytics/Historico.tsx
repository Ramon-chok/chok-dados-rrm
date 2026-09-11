import React, { useEffect, useMemo, useState } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { useGlobalFilter } from '../../context/GlobalFilterContext';
import { ExportExcelButton } from '../../components/common/ExportExcelButton';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '../../components/common/DataState';
import { fetchHistory, fetchManufacturers, fetchTeams, HistoryRow } from '../../lib/api';

const MES = ['', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const fmt = (v: number) => `R$ ${v.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`;

export const HistoricoPage: React.FC = () => {
  const { t } = useTheme();
  const { selectedPeriod } = useGlobalFilter();
  const [fabricante, setFabricante] = useState('Todos');
  const [equipe, setEquipe] = useState('Todas');
  const [fabs, setFabs] = useState<string[]>(['Todos']);
  const [equipes, setEquipes] = useState<string[]>(['Todas']);
  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [m, teams] = await Promise.all([fetchManufacturers(), fetchTeams()]);
        setFabs(['Todos', ...m.map((x) => String(x.nome_fabricante || '')).filter(Boolean)]);
        setEquipes(['Todas', ...teams.map((x) => String(x.nome_equipe || '')).filter(Boolean)]);
      } catch { /* keep defaults */ }
    })();
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true); setError(null);
      try {
        const data = await fetchHistory({
          fabricante: fabricante === 'Todos' ? undefined : fabricante,
          equipe: equipe === 'Todas' ? undefined : equipe,
        });
        if (mounted) setRows(data);
      } catch (e) {
        if (mounted) setError(e instanceof Error ? e.message : 'Falha ao carregar histórico');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [fabricante, equipe]);

  const historicoPorMes = useMemo(() => {
    const map = new Map<string, { mes: string; meta: number; realizado: number; positivados: number; metaClientes: number; margemPct: number; n: number }>();
    rows.forEach((r) => {
      const key = `${r.ano}-${r.mesNum}`;
      const label = `${MES[r.mesNum] || r.mesNum}/${r.ano}`;
      const cur = map.get(key) || { mes: label, meta: 0, realizado: 0, positivados: 0, metaClientes: 0, margemPct: 0, n: 0 };
      cur.meta += r.meta; cur.realizado += r.realizado; cur.positivados += r.positivados; cur.metaClientes += r.metaClientes; cur.margemPct += r.margemPct; cur.n += 1;
      map.set(key, cur);
    });
    return Array.from(map.values()).map((h) => ({
      ...h,
      gap: h.realizado - h.meta,
      atingimento: h.meta ? (h.realizado / h.meta) * 100 : 0,
      coberturaPct: h.metaClientes ? (h.positivados / h.metaClientes) * 100 : 0,
      margemPct: h.n ? h.margemPct / h.n : 0,
    }));
  }, [rows]);

  const handleExport = () => [{
    sheetName: 'Histórico',
    data: historicoPorMes.map((h) => ({
      'Mês': h.mes, Meta: h.meta, Realizado: h.realizado, GAP: h.gap, Atingimento: h.atingimento,
      Positivados: h.positivados, 'Meta Clientes': h.metaClientes, Cobertura: h.coberturaPct, Margem: h.margemPct, Período: selectedPeriod,
    })),
  }];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <div>
          <h1 className="num" style={{ margin: '0 0 4px', fontSize: 24, fontWeight: 700, color: t.text }}>Histórico</h1>
          <p style={{ margin: 0, fontSize: 13, color: t.textSecondary }}>Consolidado mensal a partir de indicadores_fabricante.</p>
        </div>
        <ExportExcelButton getSheets={handleExport} fileName="historico" />
      </div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <select value={fabricante} onChange={(e) => setFabricante(e.target.value)} style={{ padding: '8px 10px', borderRadius: 8, border: `1px solid ${t.border}`, background: t.surface, color: t.text }}>
          {fabs.map((f) => <option key={f} value={f}>{f}</option>)}
        </select>
        <select value={equipe} onChange={(e) => setEquipe(e.target.value)} style={{ padding: '8px 10px', borderRadius: 8, border: `1px solid ${t.border}`, background: t.surface, color: t.text }}>
          {equipes.map((f) => <option key={f} value={f}>{f}</option>)}
        </select>
      </div>
      {loading && <LoadingBlock />}
      {error && <ErrorBlock message={error} />}
      {!loading && !error && historicoPorMes.length === 0 && <EmptyBlock />}
      {!loading && !error && historicoPorMes.length > 0 && (
        <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 12, overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
            <thead>
              <tr style={{ color: t.textMuted, textAlign: 'left', borderBottom: `1px solid ${t.border}` }}>
                <th style={{ padding: 12 }}>Mês</th><th>Meta</th><th>Realizado</th><th>GAP</th><th>Ating.%</th><th>Cobertura%</th><th>Margem%</th>
              </tr>
            </thead>
            <tbody>
              {historicoPorMes.map((h) => (
                <tr key={h.mes} style={{ borderTop: `1px solid ${t.border}`, color: t.text }}>
                  <td style={{ padding: 12 }}>{h.mes}</td>
                  <td>{fmt(h.meta)}</td>
                  <td>{fmt(h.realizado)}</td>
                  <td>{fmt(h.gap)}</td>
                  <td>{h.atingimento.toFixed(1)}%</td>
                  <td>{h.coberturaPct.toFixed(1)}%</td>
                  <td>{h.margemPct.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
