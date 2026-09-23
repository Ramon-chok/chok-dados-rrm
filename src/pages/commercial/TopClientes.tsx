import React, { useEffect, useMemo, useState } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useGlobalFilter } from '../../context/GlobalFilterContext';
import { ExportExcelButton } from '../../components/common/ExportExcelButton';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '../../components/common/DataState';
import { getErrorMessage, fetchTopCustomers, TopCustomerRow } from '../../lib/api';
import { SingleSelectFilter } from '../../components/common/SingleSelectFilter';

const fmt = (v: number) => `R$ ${v.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`;

export const TopClientesPage: React.FC = () => {
  const { t, mode } = useTheme();
  const { currentUser } = useAuth();
  const { selectedPeriod, startDate, endDate } = useGlobalFilter();
  const [rows, setRows] = useState<TopCustomerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [topN, setTopN] = useState(20);
  const [selectedEquipe, setSelectedEquipe] = useState('');
  const [selectedVendedor, setSelectedVendedor] = useState('');

  const role = currentUser?.role;
  // Supervisor já vê apenas a própria equipe (escopo travado no backend) —
  // não faz sentido oferecer o filtro de Equipe. Vendedor já vê só os
  // próprios dados, então nem Equipe nem Vendedor fazem sentido para ele.
  const canFilterEquipe = role === 'ADMIN' || role === 'GERENTE';
  const canFilterVendedor = role === 'ADMIN' || role === 'GERENTE' || role === 'SUPERVISOR';

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true); setError(null);
      try {
        const data = await fetchTopCustomers({ start: startDate || undefined, end: endDate || undefined, limit: topN });
        if (mounted) setRows(data);
      } catch (e) {
        if (mounted) setError(getErrorMessage(e, 'Falha ao carregar top clientes'));
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [startDate, endDate, topN]);

  const equipeOptions = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((c) => { if (c.equipe) set.add(c.equipe); });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [rows]);

  const vendedorOptions = useMemo(() => {
    const map = new Map<string, string>();
    rows.forEach((c) => {
      if (!c.vendedor) return;
      if (selectedEquipe && c.equipe !== selectedEquipe) return;
      map.set(c.vendedorCod || c.vendedor, c.vendedor);
    });
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1], 'pt-BR'));
  }, [rows, selectedEquipe]);

  useEffect(() => {
    if (selectedVendedor && !vendedorOptions.some(([code]) => code === selectedVendedor)) {
      setSelectedVendedor('');
    }
  }, [vendedorOptions, selectedVendedor]);

  const filteredRows = useMemo(
    () =>
      rows.filter((c) => {
        const matchesEquipe = !selectedEquipe || c.equipe === selectedEquipe;
        const matchesVendedor = !selectedVendedor || (c.vendedorCod || c.vendedor) === selectedVendedor;
        return matchesEquipe && matchesVendedor;
      }),
    [rows, selectedEquipe, selectedVendedor]
  );

  const maxPart = useMemo(() => Math.max(1, ...filteredRows.map((c) => c.part)), [filteredRows]);

  const handleExport = () => [{
    sheetName: `Top ${topN}`,
    data: filteredRows.map((c) => ({ Posição: c.pos, Código: c.codigo, Cliente: c.nome, Vendedor: c.vendedor, Equipe: c.equipe, Faturamento: c.faturamento, 'Participação %': c.part, Período: selectedPeriod })),
  }];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <div>
          <h1 className="num" style={{ margin: '0 0 4px', fontSize: 24, fontWeight: 700, color: t.text }}>Top Clientes</h1>
          <p style={{ margin: 0, fontSize: 13, color: t.textSecondary }}>Ranking a partir da planilha Top Clientes (venda total no mês).</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <SingleSelectFilter
            label="Exibir"
            options={[10, 20, 50, 100].map((n) => ({ value: String(n), label: `Top ${n}` }))}
            value={String(topN)}
            onChange={(v) => setTopN(Number(v) || 20)}
            allowClear={false}
          />
          {canFilterEquipe && (
            <SingleSelectFilter
              label="Equipe"
              options={equipeOptions.map((eq) => ({ value: eq, label: eq }))}
              value={selectedEquipe}
              onChange={setSelectedEquipe}
              placeholder="Todas as equipes"
              allLabel="Todas as equipes"
            />
          )}
          {canFilterVendedor && (
            <SingleSelectFilter
              label="Vendedor"
              options={vendedorOptions.map(([code, nome]) => ({ value: code, label: nome }))}
              value={selectedVendedor}
              onChange={setSelectedVendedor}
              placeholder="Todos os vendedores"
              allLabel="Todos os vendedores"
            />
          )}
          <ExportExcelButton getSheets={handleExport} fileName="top-clientes" />
        </div>
      </div>
      {loading && <LoadingBlock />}
      {error && <ErrorBlock message={error} />}
      {!loading && !error && filteredRows.length === 0 && <EmptyBlock />}
      {!loading && !error && filteredRows.length > 0 && (
        <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 12, overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
            <thead>
              <tr style={{ color: t.textMuted, textAlign: 'left', borderBottom: `1px solid ${t.border}` }}>
                <th style={{ padding: 12 }}>#</th><th>Código</th><th>Cliente</th><th>Vendedor</th><th>Equipe</th><th>Faturamento</th><th>Part.%</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((c) => (
                <tr key={`${c.codigo}-${c.pos}`} style={{ borderTop: `1px solid ${t.border}`, color: t.text }}>
                  <td style={{ padding: 12 }}>{c.pos}</td>
                  <td>{c.codigo}</td>
                  <td>{c.nome}</td>
                  <td>{c.vendedor || '—'}</td>
                  <td>{c.equipe || '—'}</td>
                  <td>{fmt(c.faturamento)}</td>
                  <td><PartBadge value={c.part} max={maxPart} theme={t} mode={mode} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

// Selo de Part.% com intensidade de cor proporcional ao valor na listagem
// atual — mesma cor da marca (respeitando claro/escuro), só a intensidade varia.
const PartBadge: React.FC<{ value: number; max: number; theme: any; mode: 'light' | 'dark' }> = ({ value, max, theme: t, mode }) => {
  const ratio = Math.max(0, Math.min(1, value / max));
  const alpha = Math.round(24 + ratio * 90);
  const bg = `${t.primary}${alpha.toString(16).padStart(2, '0')}`;
  return (
    <span
      className="num"
      style={{
        display: 'inline-block',
        padding: '3px 10px',
        borderRadius: 6,
        fontWeight: 700,
        fontSize: 12,
        background: bg,
        color: mode === 'dark' ? t.text : t.primaryDark,
      }}
    >
      {value.toFixed(1)}%
    </span>
  );
};
