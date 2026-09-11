import React, { useEffect, useMemo, useState } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { useGlobalFilter } from '../../context/GlobalFilterContext';
import { ExportExcelButton } from '../../components/common/ExportExcelButton';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '../../components/common/DataState';
import { fetchTargets, TargetRow } from '../../lib/api';
import { Target } from 'lucide-react';

const fmt = (v: number) => `R$ ${v.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`;

export const ObjetivosPage: React.FC = () => {
  const { t } = useTheme();
  const { ano, mes, periodType } = useGlobalFilter();
  const [rows, setRows] = useState<TargetRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const anoMes = periodType === 'mensal' && ano && mes
    ? `${ano}-${String(mes).padStart(2, '0')}`
    : undefined;

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true); setError(null);
      try {
        const data = await fetchTargets(anoMes ? { ano_mes: anoMes } : undefined);
        if (mounted) setRows(data);
      } catch (e) {
        if (mounted) setError(e instanceof Error ? e.message : 'Falha ao carregar objetivos');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [anoMes]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      (r.vendedor || '').toLowerCase().includes(q) ||
      (r.equipe || '').toLowerCase().includes(q) ||
      (r.fabricante || '').toLowerCase().includes(q) ||
      (r.codVendedor || '').toLowerCase().includes(q)
    );
  }, [rows, query]);

  const totals = useMemo(() => ({
    metaFat: filtered.reduce((s, r) => s + (r.metaFaturamento || 0), 0),
    metaCob: filtered.reduce((s, r) => s + (r.metaCobertura || 0), 0),
  }), [filtered]);

  const handleExport = () => [{
    sheetName: 'Objetivos',
    data: filtered.map((r) => ({
      'Ano-Mês': r.anoMes,
      'Cód. Vendedor': r.codVendedor,
      Vendedor: r.vendedor,
      Equipe: r.equipe,
      Fabricante: r.fabricante,
      'Meta Faturamento': r.metaFaturamento,
      'Meta Cobertura': r.metaCobertura,
    })),
  }];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <div>
          <h1 className="num" style={{ margin: '0 0 4px', fontSize: 24, fontWeight: 700, color: t.text }}>Objetivos</h1>
          <p style={{ margin: 0, fontSize: 13, color: t.textSecondary }}>Metas mensais a partir da tabela metas_mensais.</p>
        </div>
        <ExportExcelButton getSheets={handleExport} fileName="objetivos" />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 10, marginBottom: 14 }}>
        <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 10, padding: 12 }}>
          <div style={{ fontSize: 11, color: t.textMuted, display: 'flex', alignItems: 'center', gap: 6 }}><Target size={14} /> Meta faturamento</div>
          <div className="num" style={{ fontWeight: 700, color: t.text }}>{fmt(totals.metaFat)}</div>
        </div>
        <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 10, padding: 12 }}>
          <div style={{ fontSize: 11, color: t.textMuted }}>Meta cobertura</div>
          <div className="num" style={{ fontWeight: 700, color: t.text }}>{totals.metaCob.toLocaleString('pt-BR')}</div>
        </div>
        <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 10, padding: 12 }}>
          <div style={{ fontSize: 11, color: t.textMuted }}>Registros</div>
          <div className="num" style={{ fontWeight: 700, color: t.text }}>{filtered.length}</div>
        </div>
      </div>
      <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filtrar vendedor, equipe ou fabricante..." style={{ width: '100%', maxWidth: 420, marginBottom: 14, padding: '10px 12px', borderRadius: 8, border: `1px solid ${t.border}`, background: t.surface, color: t.text }} />
      {loading && <LoadingBlock />}
      {error && <ErrorBlock message={error} />}
      {!loading && !error && filtered.length === 0 && <EmptyBlock />}
      {!loading && !error && filtered.length > 0 && (
        <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 12, overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
            <thead>
              <tr style={{ color: t.textMuted, textAlign: 'left', borderBottom: `1px solid ${t.border}` }}>
                <th style={{ padding: 12 }}>Ano-Mês</th><th>Vendedor</th><th>Equipe</th><th>Fabricante</th><th>Meta fat.</th><th>Meta cob.</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => (
                <tr key={`${r.anoMes}-${r.codVendedor}-${r.fabricante}-${i}`} style={{ borderTop: `1px solid ${t.border}`, color: t.text }}>
                  <td style={{ padding: 12 }}>{r.anoMes}</td>
                  <td>{r.vendedor || r.codVendedor}</td>
                  <td>{r.equipe || '—'}</td>
                  <td>{r.fabricante || '—'}</td>
                  <td>{fmt(r.metaFaturamento)}</td>
                  <td>{r.metaCobertura.toLocaleString('pt-BR')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
