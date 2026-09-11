import React, { useEffect, useMemo, useState } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { ExportExcelButton } from '../../components/common/ExportExcelButton';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '../../components/common/DataState';
import { fetchProducts, ProductRow } from '../../lib/api';
import { Search } from 'lucide-react';

const fmt = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

export const SortimentosPage: React.FC = () => {
  const { t } = useTheme();
  const [rows, setRows] = useState<ProductRow[]>([]);
  const [query, setQuery] = useState('');
  const [fab, setFab] = useState('Todos');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true); setError(null);
      try {
        const data = await fetchProducts({ q: query || undefined, fabricante: fab === 'Todos' ? undefined : fab });
        if (mounted) setRows(data);
      } catch (e) {
        if (mounted) setError(e instanceof Error ? e.message : 'Falha ao carregar sortimentos');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [query, fab]);

  const fabs = useMemo(() => ['Todos', ...Array.from(new Set(rows.map((r) => r.fabricante).filter(Boolean) as string[]))], [rows]);

  const handleExport = () => [{
    sheetName: 'Sortimentos',
    data: rows.map((p) => ({ Código: p.codigo, Produto: p.nome, Fabricante: p.fabricante, Categoria: p.categoria, Preço: p.preco, Status: p.status })),
  }];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <div>
          <h1 className="num" style={{ margin: '0 0 4px', fontSize: 24, fontWeight: 700, color: t.text }}>Sortimentos</h1>
          <p style={{ margin: 0, fontSize: 13, color: t.textSecondary }}>Produtos cadastrados na tabela produtos.</p>
        </div>
        <ExportExcelButton getSheets={handleExport} fileName="sortimentos" />
      </div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, border: `1px solid ${t.border}`, borderRadius: 8, padding: '10px 14px', background: t.surface, flex: '1 1 240px' }}>
          <Search size={16} color={t.textMuted} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar produto..." style={{ border: 'none', outline: 'none', background: 'transparent', color: t.text, width: '100%' }} />
        </div>
        <select value={fab} onChange={(e) => setFab(e.target.value)} style={{ padding: '8px 10px', borderRadius: 8, border: `1px solid ${t.border}`, background: t.surface, color: t.text }}>
          {fabs.map((f) => <option key={f} value={f}>{f}</option>)}
        </select>
      </div>
      {loading && <LoadingBlock />}
      {error && <ErrorBlock message={error} />}
      {!loading && !error && rows.length === 0 && <EmptyBlock />}
      {!loading && !error && rows.length > 0 && (
        <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 12, overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
            <thead>
              <tr style={{ color: t.textMuted, textAlign: 'left', borderBottom: `1px solid ${t.border}` }}>
                <th style={{ padding: 12 }}>Código</th><th>Produto</th><th>Fabricante</th><th>Categoria</th><th>Preço</th><th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.codigo} style={{ borderTop: `1px solid ${t.border}`, color: t.text }}>
                  <td style={{ padding: 12 }}>{p.codigo}</td>
                  <td>{p.nome}</td>
                  <td>{p.fabricante || '—'}</td>
                  <td>{p.categoria || '—'}</td>
                  <td>{fmt(p.preco || 0)}</td>
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
