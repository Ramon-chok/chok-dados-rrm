import React, { useEffect, useMemo, useState } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { useGlobalFilter } from '../../context/GlobalFilterContext';
import { PeriodSelector } from '../../components/common/PeriodSelector';
import { ExportExcelButton } from '../../components/common/ExportExcelButton';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '../../components/common/DataState';
import { fetchNotPositivated, NotPositivatedResponse } from '../../lib/api';
import { Search } from 'lucide-react';

export const NaoPositivadosPage: React.FC = () => {
  const { t } = useTheme();
  const { selectedPeriod, startDate, endDate } = useGlobalFilter();
  const [data, setData] = useState<NotPositivatedResponse | null>(null);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true); setError(null);
      try {
        const res = await fetchNotPositivated({ start: startDate || undefined, end: endDate || undefined });
        if (mounted) setData(res);
      } catch (e) {
        if (mounted) setError(e instanceof Error ? e.message : 'Falha ao carregar não positivados');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [startDate, endDate]);

  const filtered = useMemo(() => {
    const list = data?.clientes || [];
    const q = query.toLowerCase();
    if (!q) return list;
    return list.filter((c) =>
      (c.nome || '').toLowerCase().includes(q) ||
      (c.codigo || '').toLowerCase().includes(q) ||
      (c.vendedor || '').toLowerCase().includes(q)
    );
  }, [data, query]);

  const handleExport = () => [{
    sheetName: 'Não Positivados',
    data: filtered.map((c) => ({
      Código: c.codigo, Cliente: c.nome, Vendedor: c.vendedor, Equipe: c.equipe, Supervisor: c.supervisor,
      Gerência: c.gerencia, 'Última Compra': c.ultimaCompra, Dias: c.dias, Status: c.status, Período: selectedPeriod,
    })),
  }];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <div>
          <h1 className="num" style={{ margin: '0 0 4px', fontSize: 24, fontWeight: 700, color: t.text }}>Não Positivados</h1>
          <p style={{ margin: 0, fontSize: 13, color: t.textSecondary }}>Clientes sem compra no período (base clientes + vendas).</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}><PeriodSelector /><ExportExcelButton getSheets={handleExport} fileName="nao-positivados" /></div>
      </div>
      {data && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 10, marginBottom: 14 }}>
          {[
            ['Base', data.kpis.baseClientes],
            ['Positivados', data.kpis.positivados],
            ['Não positivados', data.kpis.naoPositivados],
            ['Positivação %', `${data.kpis.positivacaoPct}%`],
          ].map(([l, v]) => (
            <div key={String(l)} style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 10, padding: 12 }}>
              <div style={{ fontSize: 11, color: t.textMuted }}>{l}</div>
              <div className="num" style={{ fontWeight: 700, color: t.text }}>{v}</div>
            </div>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, border: `1px solid ${t.border}`, borderRadius: 8, padding: '10px 14px', background: t.surface, marginBottom: 14, maxWidth: 420 }}>
        <Search size={16} color={t.textMuted} />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar cliente..." style={{ border: 'none', outline: 'none', background: 'transparent', color: t.text, width: '100%' }} />
      </div>
      {loading && <LoadingBlock />}
      {error && <ErrorBlock message={error} />}
      {!loading && !error && filtered.length === 0 && <EmptyBlock />}
      {!loading && !error && filtered.length > 0 && (
        <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 12, overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
            <thead>
              <tr style={{ color: t.textMuted, textAlign: 'left', borderBottom: `1px solid ${t.border}` }}>
                <th style={{ padding: 12 }}>Código</th><th>Cliente</th><th>Vendedor</th><th>Equipe</th><th>Última compra</th><th>Dias</th><th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.codigo} style={{ borderTop: `1px solid ${t.border}`, color: t.text }}>
                  <td style={{ padding: 12 }}>{c.codigo}</td>
                  <td>{c.nome}</td>
                  <td>{c.vendedor || '—'}</td>
                  <td>{c.equipe || '—'}</td>
                  <td>{c.ultimaCompra || '—'}</td>
                  <td>{c.dias}</td>
                  <td>{c.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
