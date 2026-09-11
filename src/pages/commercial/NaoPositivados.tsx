import React, { useState } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { useGlobalFilter } from '../../context/GlobalFilterContext';
import { PeriodSelector } from '../../components/common/PeriodSelector';
import { ExportExcelButton } from '../../components/common/ExportExcelButton';
import { Search, ChevronDown } from 'lucide-react';

const FILTERS = ['Período: Setembro/2026', 'Fabricante: Todos', 'Gerência: Todas', 'Supervisor: Todos', 'Equipe: Todas', 'Vendedor: Todos', 'Cidade: Todas'];

const clientes = [
  { codigo: '00184', nome: 'Padaria São José', cidade: 'Ribeirão Preto', vendedor: 'Vendedor 012', supervisor: 'Supervisor A', gerencia: 'TRAD', ultimaCompra: '12/06/2026', dias: 89, status: 'Crítico', potencial: 'Alto', fabricante: 'ARCOR' },
  { codigo: '00297', nome: 'Mercadinho Vitória', cidade: 'Sertãozinho', vendedor: 'Vendedor 004', supervisor: 'Supervisor B', gerencia: 'TRAD', ultimaCompra: '02/07/2026', dias: 68, status: 'Atenção', potencial: 'Médio', fabricante: 'HEINZ' },
  { codigo: '00412', nome: 'Empório Bom Gosto', cidade: 'Ribeirão Preto', vendedor: 'Vendedor 012', supervisor: 'Supervisor A', gerencia: 'TRAD', ultimaCompra: '20/07/2026', dias: 50, status: 'Atenção', potencial: 'Alto', fabricante: 'NESTLÉ' },
  { codigo: '00558', nome: 'Mercado Nova Aliança', cidade: 'Sertãozinho', vendedor: 'Vendedor 004', supervisor: 'Supervisor B', gerencia: 'TRAD', ultimaCompra: '05/08/2026', dias: 35, status: 'Regular', potencial: 'Baixo', fabricante: 'UNILEVER' },
  { codigo: '00671', nome: 'Distribuidora Sabor', cidade: 'Jaboticabal', vendedor: 'Vendedor 007', supervisor: 'Supervisor C', gerencia: 'AS', ultimaCompra: '22/08/2026', dias: 18, status: 'Regular', potencial: 'Médio', fabricante: 'ARCOR' },
];

export const NaoPositivadosPage: React.FC = () => {
  const { t } = useTheme();
  const { selectedPeriod, periodMetrics } = useGlobalFilter();
  const [searchTerm, setSearchTerm] = useState('');

  const statusColor = (s: string) => (s === 'Crítico' ? t.primaryHover : s === 'Atenção' ? '#E8B339' : t.textSecondary);

  const kpis = [
    { label: 'Base de clientes', value: (periodMetrics?.clientesTotal ?? periodMetrics?.baseClientes ?? 1842).toLocaleString('pt-BR') },
    { label: 'Positivados', value: (periodMetrics?.clientesPositivados ?? periodMetrics?.positivados ?? 1294).toLocaleString('pt-BR') },
    { label: 'Não positivados', value: (periodMetrics?.clientesNaoPositivados ?? periodMetrics?.naoPositivados ?? 548).toLocaleString('pt-BR') },
    {
      label: '% Positivação',
      value: `${(
        periodMetrics?.positivacaoPct ??
        ((periodMetrics?.positivados || 1294) / (periodMetrics?.baseClientes || 1842)) * 100
      ).toFixed(1)}%`,
    },
  ];

  const filtered = clientes.filter(
    (c) => c.nome.toLowerCase().includes(searchTerm.toLowerCase()) || c.codigo.includes(searchTerm) || c.cidade.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleExportExcel = () => {
    const data = filtered.map((c) => ({
      Código: c.codigo,
      Cliente: c.nome,
      Cidade: c.cidade,
      Vendedor: c.vendedor,
      Supervisor: c.supervisor,
      Gerência: c.gerencia,
      'Última Compra': c.ultimaCompra,
      'Dias Sem Comprar': c.dias,
      Status: c.status,
      Potencial: c.potencial,
      Fabricante: c.fabricante,
      Período: selectedPeriod,
    }));
    return [{ sheetName: 'Não Positivados', data }];
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 className="num" style={{ margin: '0 0 4px', fontSize: '22px', fontWeight: 700, color: t.text }}>
            Clientes Não Positivados
          </h2>
          <div style={{ fontSize: '12.5px', color: t.textMuted }}>
            Identificação de clientes sem compra no período, dias de inatividade e nível de risco comercial · Período: <strong>{selectedPeriod}</strong>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <PeriodSelector />
          <ExportExcelButton
            filename={`Nao_Positivados_${selectedPeriod.replace(/\s+/g, '_')}.xlsx`}
            onPrepareData={handleExportExcel}
          />
        </div>
      </div>

      {/* KPIs */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
          gap: '14px',
          marginBottom: '20px',
        }}
      >
        {kpis.map((k) => (
          <div key={k.label} style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: '12px', padding: '16px 18px' }}>
            <div style={{ fontSize: '13px', color: t.textSecondary, marginBottom: '8px' }}>{k.label}</div>
            <div className="num" style={{ fontSize: '24px', fontWeight: 600, color: t.text }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Filtros + busca */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '16px', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', border: `1px solid ${t.border}`, borderRadius: '8px', padding: '8px 12px', flex: '1 1 240px', background: t.surface }}>
          <Search size={15} color={t.textMuted} />
          <input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por código, cliente ou cidade..."
            style={{
              border: 'none',
              outline: 'none',
              background: 'transparent',
              color: t.text,
              fontSize: '13.5px',
              width: '100%',
              fontFamily: "'Inter', sans-serif",
            }}
          />
        </div>
        {FILTERS.map((f) => (
          <div key={f} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: t.textSecondary, border: `1px solid ${t.border}`, borderRadius: '8px', padding: '8px 12px', background: t.surface, cursor: 'pointer' }}>
            <span>{f}</span>
            <ChevronDown size={13} color={t.textMuted} />
          </div>
        ))}
      </div>

      {/* Tabela */}
      <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: '12px', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ color: t.textMuted }}>
                {['Código', 'Cliente', 'Cidade', 'Vendedor', 'Supervisor', 'Gerência', 'Última compra', 'Dias sem compra', 'Status', 'Potencial', 'Fabricante'].map((h) => (
                  <th key={h} style={{ textAlign: 'left', padding: '12px 14px', borderBottom: `1px solid ${t.border}`, fontWeight: 500, whiteSpace: 'nowrap', background: t.bgSecondary }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.codigo} style={{ borderBottom: `1px solid ${t.border}` }}>
                  <td className="num" style={{ padding: '12px 14px', color: t.textSecondary }}>{c.codigo}</td>
                  <td style={{ padding: '12px 14px', fontWeight: 500, color: t.text }}>{c.nome}</td>
                  <td style={{ padding: '12px 14px', color: t.textSecondary }}>{c.cidade}</td>
                  <td style={{ padding: '12px 14px', color: t.textSecondary }}>{c.vendedor}</td>
                  <td style={{ padding: '12px 14px', color: t.textSecondary }}>{c.supervisor}</td>
                  <td style={{ padding: '12px 14px', color: t.textSecondary }}>{c.gerencia}</td>
                  <td className="num" style={{ padding: '12px 14px', color: t.textSecondary }}>{c.ultimaCompra}</td>
                  <td className="num" style={{ padding: '12px 14px', fontWeight: 600, color: t.text }}>{c.dias}</td>
                  <td style={{ padding: '12px 14px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: statusColor(c.status) }}>● {c.status}</span>
                  </td>
                  <td style={{ padding: '12px 14px', color: t.textSecondary }}>{c.potencial}</td>
                  <td style={{ padding: '12px 14px', fontWeight: 500, color: t.text }}>{c.fabricante}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ padding: '12px 14px', borderTop: `1px solid ${t.border}`, fontSize: '12.5px', color: t.textMuted }}>
          Mostrando {filtered.length} de 548 clientes não positivados
        </div>
      </div>
    </div>
  );
};
