import React, { useEffect, useMemo, useState } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { ExportExcelButton } from '../../components/common/ExportExcelButton';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '../../components/common/DataState';
import { fetchSortimento, SortimentoRow } from '../../lib/api';
import { Search } from 'lucide-react';

export const SortimentosPage: React.FC = () => {
  const { t } = useTheme();
  const [rows, setRows] = useState<SortimentoRow[]>([]);
  const [query, setQuery] = useState('');
  const [fab, setFab] = useState('Todos');
  const [linha, setLinha] = useState('Todas');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchSortimento({
          q: query || undefined,
          fabricante: fab === 'Todos' ? undefined : fab,
          linha: linha === 'Todas' ? undefined : linha,
        });
        if (mounted) setRows(data);
      } catch (e) {
        if (mounted) setError(e instanceof Error ? e.message : 'Falha ao carregar sortimentos');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [query, fab, linha]);

  const fabs = useMemo(
    () => ['Todos', ...Array.from(new Set(rows.map((r) => r.fabricante).filter(Boolean) as string[])).sort()],
    [rows]
  );
  const linhas = useMemo(
    () => ['Todas', ...Array.from(new Set(rows.map((r) => r.linha).filter(Boolean) as string[])).sort()],
    [rows]
  );

  const handleExport = () => [
    {
      sheetName: 'Sortimentos',
      data: rows.map((p) => ({
        Código: p.codigo,
        Produto: p.produto,
        Fabricante: p.fabricante,
        Categoria: p.categoria,
        Linha: p.linha,
        'Atualizado em': p.atualizadoEm,
      })),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <div>
          <h1 className="num" style={{ margin: '0 0 4px', fontSize: 24, fontWeight: 700, color: t.text }}>
            Sortimentos
          </h1>
          <p style={{ margin: 0, fontSize: 13, color: t.textSecondary }}>
            Lista importada da planilha de sortimento ({rows.length.toLocaleString('pt-BR')} itens).
          </p>
        </div>
        <ExportExcelButton getSheets={handleExport} fileName="sortimentos" />
      </div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            border: `1px solid ${t.border}`,
            borderRadius: 8,
            padding: '10px 14px',
            background: t.surface,
            flex: '1 1 240px',
          }}
        >
          <Search size={16} color={t.textMuted} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar código, produto, fabricante..."
            style={{
              border: 'none',
              outline: 'none',
              background: 'transparent',
              color: t.text,
              width: '100%',
            }}
          />
        </div>
        <select
          value={fab}
          onChange={(e) => setFab(e.target.value)}
          style={{
            padding: '8px 10px',
            borderRadius: 8,
            border: `1px solid ${t.border}`,
            background: t.surface,
            color: t.text,
          }}
        >
          {fabs.map((f) => (
            <option key={f} value={f}>
              {f === 'Todos' ? 'Todos os fabricantes' : f}
            </option>
          ))}
        </select>
        <select
          value={linha}
          onChange={(e) => setLinha(e.target.value)}
          style={{
            padding: '8px 10px',
            borderRadius: 8,
            border: `1px solid ${t.border}`,
            background: t.surface,
            color: t.text,
          }}
        >
          {linhas.map((l) => (
            <option key={l} value={l}>
              {l === 'Todas' ? 'Todas as linhas' : l}
            </option>
          ))}
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
                <th style={{ padding: 12 }}>Código</th>
                <th>Produto</th>
                <th>Fabricante</th>
                <th>Categoria</th>
                <th>Linha</th>
                <th>Atualizado</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.codigo} style={{ borderTop: `1px solid ${t.border}`, color: t.text }}>
                  <td style={{ padding: 12, fontWeight: 600 }}>{p.codigo}</td>
                  <td>{p.produto || '—'}</td>
                  <td>{p.fabricante || '—'}</td>
                  <td>{p.categoria || '—'}</td>
                  <td>{p.linha || '—'}</td>
                  <td style={{ color: t.textMuted }}>
                    {p.atualizadoEm
                      ? new Date(p.atualizadoEm).toLocaleString('pt-BR')
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
