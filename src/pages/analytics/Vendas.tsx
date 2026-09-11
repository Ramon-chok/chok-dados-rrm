import React, { useEffect, useMemo, useState } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { useGlobalFilter } from '../../context/GlobalFilterContext';
import { PeriodSelector } from '../../components/common/PeriodSelector';
import { ExportExcelButton } from '../../components/common/ExportExcelButton';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '../../components/common/DataState';
import { fetchSales, SaleRow } from '../../lib/api';
import { Search } from 'lucide-react';

const fmtR = (v: number) => `R$ ${v.toLocaleString('pt-BR')}`;

export const VendasPage: React.FC = () => {
  const { t } = useTheme();
  const { selectedPeriod, startDate, endDate } = useGlobalFilter();
  const [query, setQuery] = useState('');
  const [rows, setRows] = useState<SaleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchSales({ q: query || undefined, start: startDate || undefined, end: endDate || undefined, limit: 500 });
        if (mounted) setRows(data);
      } catch (e) {
        if (mounted) setError(e instanceof Error ? e.message : 'Falha ao carregar vendas');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [query, startDate, endDate]);

  const handleExportExcel = () => [{
    sheetName: 'Vendas',
    data: rows.map((p) => ({
      Pedido: p.id, Data: p.data, Cliente: p.cliente, Vendedor: p.vendedor, Equipe: p.equipe, Valor: p.valor, Status: p.status, Período: selectedPeriod,
    })),
  }];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 18 }}>
        <div>
          <h1 className="num" style={{ margin: '0 0 4px', fontSize: 24, fontWeight: 700, color: t.text }}>Vendas</h1>
          <p style={{ margin: 0, fontSize: 13, color: t.textSecondary }}>Pedidos faturados a partir da tabela vendas.</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}><PeriodSelector /><ExportExcelButton getSheets={handleExportExcel} fileName="vendas" /></div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, border: `1px solid ${t.border}`, borderRadius: 8, padding: '10px 14px', background: t.surface, marginBottom: 14, maxWidth: 420 }}>
        <Search size={16} color={t.textMuted} />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar pedido, cliente ou vendedor..." style={{ border: 'none', outline: 'none', background: 'transparent', color: t.text, width: '100%', fontSize: 13.5 }} />
      </div>
      {loading && <LoadingBlock />}
      {error && <ErrorBlock message={error} />}
      {!loading && !error && rows.length === 0 && <EmptyBlock />}
      {!loading && !error && rows.length > 0 && (
        <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 12, overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
            <thead>
              <tr style={{ color: t.textMuted, textAlign: 'left', borderBottom: `1px solid ${t.border}` }}>
                <th style={{ padding: 12 }}>Pedido</th><th>Data</th><th>Cliente</th><th>Vendedor</th><th>Equipe</th><th>Valor</th><th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id} style={{ borderTop: `1px solid ${t.border}`, color: t.text }}>
                  <td style={{ padding: 12 }}>{p.id}</td>
                  <td>{p.data || '—'}</td>
                  <td>{p.cliente || '—'}</td>
                  <td>{p.vendedor || '—'}</td>
                  <td>{p.equipe || '—'}</td>
                  <td>{fmtR(p.valor)}</td>
                  <td>{p.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
