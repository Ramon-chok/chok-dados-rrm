import React, { useEffect, useMemo, useState } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { useGlobalFilter } from '../../context/GlobalFilterContext';
import { ExportExcelButton } from '../../components/common/ExportExcelButton';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '../../components/common/DataState';
import { fetchSarPositivacao, SarPositivacaoRow } from '../../lib/api';
import { Activity } from 'lucide-react';

export const RaioXPage: React.FC = () => {
  const { t } = useTheme();
  const { ano, mes, periodType } = useGlobalFilter();
  const [rows, setRows] = useState<SarPositivacaoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true); setError(null);
      try {
        const data = await fetchSarPositivacao({
          ano: periodType === 'personalizado' ? undefined : ano,
          mes: periodType === 'mensal' ? mes : undefined,
        });
        if (mounted) setRows(data);
      } catch (e) {
        if (mounted) setError(e instanceof Error ? e.message : 'Falha ao carregar Raio-X');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [ano, mes, periodType]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      (r.nome || '').toLowerCase().includes(q) ||
      (r.codigo || '').toLowerCase().includes(q) ||
      (r.equipe || '').toLowerCase().includes(q)
    );
  }, [rows, query]);

  const totals = useMemo(() => filtered.reduce((acc, r) => ({
    visitasPrevistas: acc.visitasPrevistas + (r.visitasPrevistas || 0),
    visitasRealizadas: acc.visitasRealizadas + (r.visitasRealizadas || 0),
    vendasPrevistas: acc.vendasPrevistas + (r.vendasPrevistas || 0),
    vendasRealizadas: acc.vendasRealizadas + (r.vendasRealizadas || 0),
    pedidos: acc.pedidos + (r.pedidos || 0),
  }), { visitasPrevistas: 0, visitasRealizadas: 0, vendasPrevistas: 0, vendasRealizadas: 0, pedidos: 0 }), [filtered]);

  const handleExport = () => [{
    sheetName: 'RaioX',
    data: filtered.map((r) => ({
      Código: r.codigo, Nome: r.nome, Equipe: r.equipe,
      'Visitas prev.': r.visitasPrevistas, 'Visitas real.': r.visitasRealizadas,
      'Vendas prev.': r.vendasPrevistas, 'Vendas real.': r.vendasRealizadas,
      'Fora de rota': r.foraDeRota, 'GPS OK': r.gpsOk, Pedidos: r.pedidos, Apontamentos: r.apontamentos,
    })),
  }];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <div>
          <h1 className="num" style={{ margin: '0 0 4px', fontSize: 24, fontWeight: 700, color: t.text }}>Raio-X SAR</h1>
          <p style={{ margin: 0, fontSize: 13, color: t.textSecondary }}>Indicadores de positivação a partir de indicadores_positivacao.</p>
        </div>
        <ExportExcelButton getSheets={handleExport} fileName="raio-x-sar" />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 10, marginBottom: 14 }}>
        {[
          ['Visitas real.', totals.visitasRealizadas],
          ['Visitas prev.', totals.visitasPrevistas],
          ['Vendas real.', totals.vendasRealizadas],
          ['Pedidos', totals.pedidos],
        ].map(([l, v]) => (
          <div key={String(l)} style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 10, padding: 12 }}>
            <div style={{ fontSize: 11, color: t.textMuted, display: 'flex', alignItems: 'center', gap: 6 }}><Activity size={13} />{l}</div>
            <div className="num" style={{ fontWeight: 700, color: t.text }}>{Number(v).toLocaleString('pt-BR')}</div>
          </div>
        ))}
      </div>
      <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar vendedor ou equipe..." style={{ width: '100%', maxWidth: 420, marginBottom: 14, padding: '10px 12px', borderRadius: 8, border: `1px solid ${t.border}`, background: t.surface, color: t.text }} />
      {loading && <LoadingBlock />}
      {error && <ErrorBlock message={error} />}
      {!loading && !error && filtered.length === 0 && <EmptyBlock />}
      {!loading && !error && filtered.length > 0 && (
        <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 12, overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
            <thead>
              <tr style={{ color: t.textMuted, textAlign: 'left', borderBottom: `1px solid ${t.border}` }}>
                <th style={{ padding: 12 }}>Cód.</th><th>Vendedor</th><th>Equipe</th>
                <th>Visitas</th><th>Vendas</th><th>Fora rota</th><th>GPS OK</th><th>Pedidos</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.codigo} style={{ borderTop: `1px solid ${t.border}`, color: t.text }}>
                  <td style={{ padding: 12 }}>{r.codigo}</td>
                  <td>{r.nome}</td>
                  <td>{r.equipe || '—'}</td>
                  <td>{r.visitasRealizadas}/{r.visitasPrevistas}</td>
                  <td>{r.vendasRealizadas}/{r.vendasPrevistas}</td>
                  <td>{r.foraDeRota}</td>
                  <td>{r.gpsOk}</td>
                  <td>{r.pedidos}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
