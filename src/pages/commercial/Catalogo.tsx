import React, { useEffect, useMemo, useState } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '../../components/common/DataState';
import { fetchProducts, ProductRow } from '../../lib/api';
import { Search, ExternalLink } from 'lucide-react';
import { APP_CATALOG_URL } from '../../config/appConfig';

export const CatalogoPage: React.FC = () => {
  const { t } = useTheme();
  const [rows, setRows] = useState<ProductRow[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true); setError(null);
      try {
        const data = await fetchProducts({ q: query || undefined });
        if (mounted) setRows(data);
      } catch (e) {
        if (mounted) setError(e instanceof Error ? e.message : 'Falha ao carregar catálogo');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [query]);

  const catalogUrl = (import.meta as any).env?.VITE_CATALOG_URL || '';

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <div>
          <h1 className="num" style={{ margin: '0 0 4px', fontSize: 24, fontWeight: 700, color: t.text }}>Catálogo</h1>
          <p style={{ margin: 0, fontSize: 13, color: t.textSecondary }}>Produtos do banco de dados.</p>
        </div>
        {catalogUrl && (
          <a href={catalogUrl} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: t.primary, fontSize: 13, textDecoration: 'none' }}>
            Abrir catálogo externo <ExternalLink size={14} />
          </a>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, border: `1px solid ${t.border}`, borderRadius: 8, padding: '10px 14px', background: t.surface, marginBottom: 14, maxWidth: 420 }}>
        <Search size={16} color={t.textMuted} />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar..." style={{ border: 'none', outline: 'none', background: 'transparent', color: t.text, width: '100%' }} />
      </div>
      {loading && <LoadingBlock />}
      {error && <ErrorBlock message={error} />}
      {!loading && !error && rows.length === 0 && <EmptyBlock />}
      {!loading && !error && rows.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
          {rows.map((p) => (
            <div key={p.codigo} style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 12, padding: 14 }}>
              <div style={{ fontSize: 11, color: t.textMuted, marginBottom: 4 }}>{p.codigo}</div>
              <div style={{ fontWeight: 600, color: t.text, marginBottom: 6 }}>{p.nome}</div>
              <div style={{ fontSize: 12.5, color: t.textSecondary }}>{p.fabricante || '—'} · {p.categoria || '—'}</div>
              <div className="num" style={{ marginTop: 10, fontWeight: 700, color: t.text }}>R$ {(p.preco || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
