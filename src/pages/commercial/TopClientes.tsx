import React, { useState, useMemo } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useGlobalFilter } from '../../context/GlobalFilterContext';
import { PeriodSelector } from '../../components/common/PeriodSelector';
import { ExportExcelButton } from '../../components/common/ExportExcelButton';

const TOP_N_OPTIONS = [5, 10, 20, 30, 50, 100];
const LEVELS = ['Empresa', 'Equipe', 'Vendedor', 'Fabricante'];

const allClientes = [
  { pos: 1, prev: 1, codigo: '00021', nome: 'Mercado Bom Preço', vendedor: 'Vendedor 003', vendedorCod: '003', equipe: 'TRAB ALFA', supervisor: 'Supervisor A', gerencia: 'TRAD', faturamento: 182400, part: 8.9, crescimento: 4.2 },
  { pos: 2, prev: 4, codigo: '00088', nome: 'Distribuidora Vitória', vendedor: 'Vendedor 011', vendedorCod: '011', equipe: 'TRAB BETA', supervisor: 'Supervisor B', gerencia: 'TRAD', faturamento: 156900, part: 7.7, crescimento: 11.5 },
  { pos: 3, prev: 2, codigo: '00034', nome: 'Atacado Central', vendedor: 'Vendedor 003', vendedorCod: '003', equipe: 'TRAB ALFA', supervisor: 'Supervisor A', gerencia: 'TRAD', faturamento: 141300, part: 6.9, crescimento: -2.1 },
  { pos: 4, prev: 3, codigo: '00099', nome: 'Rede Sabor & Cia', vendedor: 'Vendedor 020', vendedorCod: '020', equipe: 'TRAB GAMA', supervisor: 'Supervisor C', gerencia: 'AS', faturamento: 128750, part: 6.3, crescimento: 1.8 },
  { pos: 5, prev: 7, codigo: '00112', nome: 'Comercial Nova Era', vendedor: 'Vendedor 011', vendedorCod: '011', equipe: 'TRAB BETA', supervisor: 'Supervisor B', gerencia: 'TRAD', faturamento: 119020, part: 5.8, crescimento: 15.4 },
  { pos: 6, prev: 5, codigo: '00145', nome: 'Mercadinho Trevo', vendedor: 'Vendedor 004', vendedorCod: '004', equipe: 'TRAB ALFA', supervisor: 'Supervisor A', gerencia: 'TRAD', faturamento: 102300, part: 5.0, crescimento: -6.8 },
  { pos: 7, prev: 6, codigo: '00201', nome: 'Atacarejo Popular', vendedor: 'Vendedor 020', vendedorCod: '020', equipe: 'TRAB GAMA', supervisor: 'Supervisor C', gerencia: 'AS', faturamento: 98750, part: 4.8, crescimento: 0.6 },
  { pos: 8, prev: null, codigo: '00256', nome: 'Rede Economia', vendedor: 'Vendedor 011', vendedorCod: '011', equipe: 'TRAB BETA', supervisor: 'Supervisor B', gerencia: 'TRAD', faturamento: 91200, part: 4.5, crescimento: 22.0 },
];

const fmt = (v: number) => `R$ ${v.toLocaleString('pt-BR')}`;

export const TopClientesPage: React.FC = () => {
  const { t } = useTheme();
  const { currentUser } = useAuth();
  const { selectedPeriod } = useGlobalFilter();
  const [topN, setTopN] = useState(20);
  const [level, setLevel] = useState('Empresa');

  // RBAC Filtering for TOP Clientes:
  // Admin / Gerência: Todos os clientes
  // Supervisor: Clientes da própria equipe supervisionada
  // Vendedor: Clientes da própria carteira
  const clientesFiltrados = useMemo(() => {
    if (!currentUser || currentUser.role === 'ADMIN' || currentUser.role === 'GERENTE') {
      return allClientes;
    }
    if (currentUser.role === 'SUPERVISOR') {
      return allClientes.filter((c) => c.equipe === (currentUser.team || 'TRAB ALFA'));
    }
    if (currentUser.role === 'VENDEDOR') {
      return allClientes.filter((c) => c.vendedorCod === (currentUser.sellerCode || '003'));
    }
    return allClientes;
  }, [currentUser]);

  const concentracao = [
    { label: 'Top 5', value: 35.6 },
    { label: 'Top 10', value: 51.2 },
    { label: 'Top 20', value: 68.9 },
  ];

  const handleExportExcel = () => {
    const data = clientesFiltrados.slice(0, topN).map((c) => ({
      Posição: c.pos,
      'Posição Anterior': c.prev ?? '-',
      Código: c.codigo,
      Cliente: c.nome,
      Vendedor: c.vendedor,
      Equipe: c.equipe,
      Supervisor: c.supervisor,
      Gerência: c.gerencia,
      'Faturamento (R$)': c.faturamento,
      'Participação %': c.part,
      'Crescimento %': c.crescimento,
      Período: selectedPeriod,
    }));
    return [{ sheetName: `Top ${topN} Clientes`, data }];
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 className="num" style={{ margin: '0 0 4px', fontSize: '22px', fontWeight: 700, color: t.text }}>
            TOP Clientes
          </h2>
          <div style={{ fontSize: '12.5px', color: t.textMuted }}>
            Ranking e evolução de faturamento dos principais clientes · Período: <strong>{selectedPeriod}</strong>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <PeriodSelector />
          <ExportExcelButton
            filename={`Top_Clientes_${level}_${selectedPeriod.replace(/\s+/g, '_')}.xlsx`}
            onPrepareData={handleExportExcel}
          />
        </div>
      </div>

      {/* Controles: nível + Top N */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', gap: '6px', background: t.surface, border: `1px solid ${t.border}`, borderRadius: '10px', padding: '4px', overflowX: 'auto', maxWidth: '100%' }}>
          {LEVELS.map((l) => (
            <div
              key={l}
              onClick={() => setLevel(l)}
              style={{
                fontSize: '13px',
                padding: '6px 12px',
                borderRadius: '7px',
                cursor: 'pointer',
                flexShrink: 0,
                whiteSpace: 'nowrap',
                background: level === l ? t.primary : 'transparent',
                color: level === l ? '#fff' : t.textSecondary,
                fontWeight: level === l ? 600 : 500,
              }}
            >
              {l}
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflowX: 'auto', maxWidth: '100%' }}>
          <span style={{ fontSize: '13px', color: t.textMuted, flexShrink: 0 }}>Top</span>
          {TOP_N_OPTIONS.map((n) => (
            <div
              key={n}
              onClick={() => setTopN(n)}
              style={{
                fontSize: '13px',
                padding: '6px 11px',
                borderRadius: '7px',
                cursor: 'pointer',
                flexShrink: 0,
                border: `1px solid ${topN === n ? t.primary : t.border}`,
                background: topN === n ? `${t.primary}15` : t.surface,
                color: topN === n ? t.primary : t.textSecondary,
                fontWeight: topN === n ? 600 : 500,
              }}
            >
              {n}
            </div>
          ))}
        </div>
      </div>

      {/* Concentração */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '16px',
          marginBottom: '20px',
        }}
      >
        {concentracao.map((c) => (
          <div key={c.label} style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: '12px', padding: '16px 18px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
              <span style={{ fontSize: '13px', color: t.textSecondary }}>Participação {c.label}</span>
              <span className="num" style={{ fontSize: '15px', fontWeight: 600, color: t.text }}>{c.value}%</span>
            </div>
            <div style={{ height: '6px', borderRadius: '4px', background: t.border, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${c.value}%`, background: t.primary, borderRadius: '4px' }} />
            </div>
          </div>
        ))}
      </div>

      {/* Tabela */}
      <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: '12px', overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', borderBottom: `1px solid ${t.border}`, fontSize: '13.5px', color: t.textSecondary }}>
          Top {topN} clientes · Nível: <strong>{level}</strong> · Setembro/2026
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ color: t.textMuted }}>
                {['#', 'Cliente', 'Código', 'Vendedor', 'Equipe', 'Supervisor', 'Gerência', 'Faturamento', 'Participação', 'Crescimento'].map((h) => (
                  <th key={h} style={{ textAlign: 'left', padding: '12px 14px', borderBottom: `1px solid ${t.border}`, fontWeight: 500, whiteSpace: 'nowrap', background: t.bgSecondary }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {clientesFiltrados.slice(0, topN).map((c) => {
                const change = c.prev == null ? null : c.prev - c.pos;
                return (
                  <tr key={c.codigo} style={{ borderBottom: `1px solid ${t.border}` }}>
                    <td className="num" style={{ padding: '12px 14px', fontWeight: 600, color: t.textMuted }}>{c.pos}</td>
                    <td style={{ padding: '12px 14px', fontWeight: 500, color: t.text }}>
                      {c.nome}
                      {c.prev === null && (
                        <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 600, color: '#3DD68C', border: '1px solid #3DD68C55', borderRadius: 5, padding: '1px 6px' }}>
                          novo no top
                        </span>
                      )}
                    </td>
                    <td className="num" style={{ padding: '12px 14px', color: t.textSecondary }}>{c.codigo}</td>
                    <td style={{ padding: '12px 14px', color: t.textSecondary }}>{c.vendedor}</td>
                    <td style={{ padding: '12px 14px', color: t.textSecondary }}>{c.equipe}</td>
                    <td style={{ padding: '12px 14px', color: t.textSecondary }}>{c.supervisor}</td>
                    <td style={{ padding: '12px 14px', color: t.textSecondary }}>{c.gerencia}</td>
                    <td className="num" style={{ padding: '12px 14px', fontWeight: 600, color: t.text }}>{fmt(c.faturamento)}</td>
                    <td className="num" style={{ padding: '12px 14px', color: t.textSecondary }}>{c.part}%</td>
                    <td className="num" style={{ padding: '12px 14px', fontWeight: 600, color: c.crescimento >= 0 ? '#3DD68C' : t.primaryHover }}>
                      {c.crescimento >= 0 ? '+' : ''}{c.crescimento}%
                      {change !== null && change !== 0 && (
                        <span style={{ marginLeft: 6, fontSize: 11, color: t.textMuted }}>
                          {change > 0 ? `▲${change}` : `▼${Math.abs(change)}`}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
