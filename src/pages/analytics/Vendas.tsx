import React, { useState, useMemo } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { useGlobalFilter } from '../../context/GlobalFilterContext';
import { PeriodSelector } from '../../components/common/PeriodSelector';
import { ExportExcelButton } from '../../components/common/ExportExcelButton';
import { Search, ShoppingBag, Filter, CheckCircle2 } from 'lucide-react';

const PEDIDOS_SAMPLE = [
  { id: 'PED-90412', data: '09/09/2026', cliente: 'Mercado Bom Preço', vendedor: 'Vendedor 003', equipe: 'TRAB ALFA', fabricante: 'ARCOR', itens: 14, valor: 14850, status: 'Faturado' },
  { id: 'PED-90411', data: '09/09/2026', cliente: 'Distribuidora Vitória', vendedor: 'Vendedor 011', equipe: 'TRAB BETA', fabricante: 'HEINZ', itens: 22, valor: 28900, status: 'Faturado' },
  { id: 'PED-90410', data: '08/09/2026', cliente: 'Atacado Central', vendedor: 'Vendedor 003', equipe: 'TRAB ALFA', fabricante: 'NESTLÉ', itens: 8, valor: 9400, status: 'Faturado' },
  { id: 'PED-90409', data: '08/09/2026', cliente: 'Rede Sabor & Cia', vendedor: 'Vendedor 020', equipe: 'TRAB GAMA', fabricante: 'UNILEVER', itens: 35, valor: 34120, status: 'Faturado' },
  { id: 'PED-90408', data: '07/09/2026', cliente: 'Comercial Nova Era', vendedor: 'Vendedor 011', equipe: 'TRAB BETA', fabricante: 'ARCOR', itens: 11, valor: 12350, status: 'Faturado' },
  { id: 'PED-90407', data: '06/09/2026', cliente: 'Supermercado Progresso', vendedor: 'Vendedor 004', equipe: 'TRAB ALFA', fabricante: 'HEINZ', itens: 19, valor: 17800, status: 'Faturado' },
  { id: 'PED-90406', data: '05/09/2026', cliente: 'Empório do Vale', vendedor: 'Vendedor 012', equipe: 'TRAB BETA', fabricante: 'NESTLÉ', itens: 15, valor: 16200, status: 'Faturado' },
];

const fmtR = (v: number) => `R$ ${v.toLocaleString('pt-BR')}`;

export const VendasPage: React.FC = () => {
  const { t } = useTheme();
  const { selectedPeriod, periodMetrics } = useGlobalFilter();
  const [query, setQuery] = useState('');
  const [fabFilter, setFabFilter] = useState('Todos');

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return PEDIDOS_SAMPLE.filter((p) => {
      if (fabFilter !== 'Todos' && p.fabricante !== fabFilter) return false;
      return (
        p.id.toLowerCase().includes(q) ||
        p.cliente.toLowerCase().includes(q) ||
        p.vendedor.toLowerCase().includes(q) ||
        p.equipe.toLowerCase().includes(q)
      );
    });
  }, [query, fabFilter]);

  const handleExportExcel = () => {
    const data = filtered.map((p) => ({
      'Nº Pedido': p.id,
      Data: p.data,
      Cliente: p.cliente,
      Vendedor: p.vendedor,
      Equipe: p.equipe,
      Fabricante: p.fabricante,
      Itens: p.itens,
      'Valor Total R$': p.valor,
      Status: p.status,
    }));
    return [{ sheetName: 'Vendas Detalhadas', data }];
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 className="num" style={{ margin: '0 0 4px', fontSize: '24px', fontWeight: 700, color: t.text }}>
            Visão Analítica de Vendas & Faturamento
          </h1>
          <p style={{ margin: 0, fontSize: '13px', color: t.textSecondary }}>
            Registro analítico de pedidos, notas fiscais e composição transacional no período.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <PeriodSelector />
          <ExportExcelButton filename={`Vendas_${selectedPeriod.replace(/\s+/g, '_')}.xlsx`} onPrepareData={handleExportExcel} />
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', marginBottom: '20px' }}>
        <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: '12px', padding: '18px' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: t.textSecondary, textTransform: 'uppercase', marginBottom: '4px' }}>Faturamento Período</div>
          <div className="num" style={{ fontSize: '22px', fontWeight: 700, color: t.text }}>{fmtR(periodMetrics.realizado)}</div>
          <div style={{ fontSize: '12px', color: t.textMuted }}>{selectedPeriod}</div>
        </div>
        <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: '12px', padding: '18px' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: t.textSecondary, textTransform: 'uppercase', marginBottom: '4px' }}>Pedidos Emitidos</div>
          <div className="num" style={{ fontSize: '22px', fontWeight: 700, color: t.text }}>{Math.round(periodMetrics.realizado / 2480)}</div>
          <div style={{ fontSize: '12px', color: '#3DD68C' }}>100% integrados ao ERP</div>
        </div>
        <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: '12px', padding: '18px' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: t.textSecondary, textTransform: 'uppercase', marginBottom: '4px' }}>Ticket Médio</div>
          <div className="num" style={{ fontSize: '22px', fontWeight: 700, color: t.text }}>{fmtR(periodMetrics.ticketMedio)}</div>
          <div style={{ fontSize: '12px', color: t.textMuted }}>Média por pedido</div>
        </div>
      </div>

      {/* Filtros e Tabela */}
      <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: '12px', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${t.border}`, display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', border: `1px solid ${t.border}`, borderRadius: '8px', padding: '8px 12px', flex: '1 1 240px', background: t.surfaceElevated }}>
            <Search size={15} color={t.textMuted} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por cliente, pedido ou vendedor..."
              style={{ border: 'none', outline: 'none', background: 'transparent', color: t.text, fontSize: '13px', width: '100%' }}
            />
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            {['Todos', 'ARCOR', 'HEINZ', 'NESTLÉ', 'UNILEVER'].map((fab) => (
              <button
                key={fab}
                onClick={() => setFabFilter(fab)}
                style={{
                  fontSize: '12px',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: `1px solid ${fabFilter === fab ? t.primary : t.border}`,
                  background: fabFilter === fab ? t.primary : t.surfaceElevated,
                  color: fabFilter === fab ? '#fff' : t.textSecondary,
                  cursor: 'pointer',
                  fontWeight: fabFilter === fab ? 600 : 500,
                }}
              >
                {fab}
              </button>
            ))}
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ color: t.textMuted, background: t.bgSecondary }}>
                {['Pedido', 'Data', 'Cliente', 'Vendedor', 'Equipe', 'Fabricante', 'Itens', 'Valor Total', 'Status'].map((h, i) => (
                  <th key={h} style={{ textAlign: i === 7 ? 'right' : 'left', padding: '12px 16px', borderBottom: `1px solid ${t.border}`, fontWeight: 500 }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id} style={{ borderBottom: `1px solid ${t.border}` }}>
                  <td className="num" style={{ padding: '12px 16px', fontWeight: 600, color: t.primary }}>{p.id}</td>
                  <td style={{ padding: '12px 16px', color: t.textMuted, fontSize: '12px' }}>{p.data}</td>
                  <td style={{ padding: '12px 16px', fontWeight: 500, color: t.text }}>{p.cliente}</td>
                  <td style={{ padding: '12px 16px', color: t.textSecondary }}>{p.vendedor}</td>
                  <td style={{ padding: '12px 16px', color: t.textSecondary }}>{p.equipe}</td>
                  <td style={{ padding: '12px 16px', color: t.textSecondary }}>{p.fabricante}</td>
                  <td className="num" style={{ padding: '12px 16px', color: t.textMuted }}>{p.itens}</td>
                  <td className="num" style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, color: t.text }}>{fmtR(p.valor)}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ fontSize: '11.5px', fontWeight: 600, color: '#3DD68C', background: 'rgba(61, 214, 140, 0.1)', padding: '3px 8px', borderRadius: '6px' }}>
                      ● {p.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
