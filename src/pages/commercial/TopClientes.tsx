import React, { useEffect, useState } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { useGlobalFilter } from '../../context/GlobalFilterContext';
import { PeriodSelector } from '../../components/common/PeriodSelector';
import { ExportExcelButton } from '../../components/common/ExportExcelButton';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '../../components/common/DataState';
import { fetchTopCustomers, TopCustomerRow } from '../../lib/api';

const fmt = (v: number) => `R$ ${v.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`;

export const TopClientesPage: React.FC = () => {
  const { t } = useTheme();
  const { selectedPeriod, startDate, endDate } = useGlobalFilter();
  const [rows, setRows] = useState<TopCustomerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [topN, setTopN] = useState(20);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true); setError(null);
      try {
        const data = await fetchTopCustomers({ start: startDate || undefined, end: endDate || undefined, limit: topN });
        if (mounted) setRows(data);
      } catch (e) {
        if (mounted) setError(e instanceof Error ? e.message : 'Falha ao carregar top clientes');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [startDate, endDate, topN]);

  const handleExport = () => [{
    sheetName: `Top ${topN}`,
    data: rows.map((c) => ({ Posição: c.pos, Código: c.codigo, Cliente: c.nome, Vendedor: c.vendedor, Equipe: c.equipe, Faturamento: c.faturamento, 'Participação %': c.part, Período: selectedPeriod })),
  }];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <div>
          <h1 className="num" style={{ margin: '0 0 4px', fontSize: 24, fontWeight: 700, color: t.text }}>Top Clientes</h1>
          <p style={{ margin: 0, fontSize: 13, color: t.textSecondary }}>Ranking a partir da tabela vendas.</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <select value={topN} onChange={(e) => setTopN(Number(e.target.value))} style={{ padding: '8px 10px', borderRadius: 8, border: `1px solid ${t.border}`, background: t.surface, color: t.text }}>
            {[10, 20, 50, 100].map((n) => <option key={n} value={n}>Top {n}</option>)}
          </select>
          <PeriodSelector />
          <ExportExcelButton getSheets={handleExport} fileName="top-clientes" />
        </div>
      </div>
      {loading && <LoadingBlock />}
      {error && <ErrorBlock message={error} />}
      {!loading && !error && rows.length === 0 && <EmptyBlock />}
      {!loading && !error && rows.length > 0 && (
        <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 12, overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
            <thead>
              <tr style={{ color: t.textMuted, textAlign: 'left', borderBottom: `1px solid ${t.border}` }}>
                <th style={{ padding: 12 }}>#</th><th>Código</th><th>Cliente</th><th>Vendedor</th><th>Equipe</th><th>Faturamento</th><th>Part.%</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={`${c.codigo}-${c.pos}`} style={{ borderTop: `1px solid ${t.border}`, color: t.text }}>
                  <td style={{ padding: 12 }}>{c.pos}</td>
                  <td>{c.codigo}</td>
                  <td>{c.nome}</td>
                  <td>{c.vendedor || '—'}</td>
                  <td>{c.equipe || '—'}</td>
                  <td>{fmt(c.faturamento)}</td>
                  <td>{c.part.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
