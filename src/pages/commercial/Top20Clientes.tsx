import React, { useEffect, useMemo, useState } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useGlobalFilter } from '../../context/GlobalFilterContext';
import { ExportExcelButton } from '../../components/common/ExportExcelButton';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '../../components/common/DataState';
import { SingleSelectFilter } from '../../components/common/SingleSelectFilter';
import {
  fetchTop20Customers,
  fetchDashboardFilterOptions,
  Top20ClienteRow,
  DashboardFilterOptions,
} from '../../lib/api';

const fmt = (v: number) => `R$ ${v.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`;
const fmtPct = (v: number) => `${v.toFixed(1)}%`;
const fmtDate = (v: string | null) => (v ? new Date(v).toLocaleDateString('pt-BR') : '—');
const crescColor = (v: number, t: any) => (v >= 0 ? '#3DD68C' : t.complementaryRed);

export const Top20ClientesPage: React.FC = () => {
  const { t } = useTheme();
  const { currentUser } = useAuth();
  const { selectedPeriod, startDate, endDate, ano, mes, periodType } = useGlobalFilter();

  const role = currentUser?.role;
  // Mesmo critério do Dashboard: Admin/Gerência podem escolher equipe e
  // vendedor livremente; Supervisor só escolhe vendedor (equipe já é a dele,
  // travada no backend); Vendedor não tem filtro (só vê os próprios dados).
  const canFilterEquipe = role === 'ADMIN' || role === 'GERENTE';
  const canFilterVendedor = role === 'ADMIN' || role === 'GERENTE' || role === 'SUPERVISOR';

  const [filterOptions, setFilterOptions] = useState<DashboardFilterOptions | null>(null);
  const [selectedEquipe, setSelectedEquipe] = useState('');
  const [selectedVendedor, setSelectedVendedor] = useState('');

  const [rows, setRows] = useState<Top20ClienteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!canFilterEquipe && !canFilterVendedor) return;
    let mounted = true;
    (async () => {
      try {
        const opts = await fetchDashboardFilterOptions();
        if (mounted) setFilterOptions(opts);
      } catch {
        // Filtros são um extra da tela — sem eles, a página segue no escopo padrão do usuário.
      }
    })();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const vendedorOptions = useMemo(() => {
    const all = filterOptions?.vendedores || [];
    return selectedEquipe ? all.filter((v) => v.equipe === selectedEquipe) : all;
  }, [filterOptions, selectedEquipe]);

  useEffect(() => {
    if (selectedVendedor && !vendedorOptions.some((v) => v.codVendedor === selectedVendedor)) {
      setSelectedVendedor('');
    }
  }, [vendedorOptions, selectedVendedor]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetchTop20Customers({
          ano: periodType === 'personalizado' ? undefined : ano,
          mes: periodType === 'mensal' ? mes : undefined,
          start: startDate || undefined,
          end: endDate || undefined,
          equipe: canFilterEquipe && selectedEquipe ? selectedEquipe : undefined,
          vendedor: canFilterVendedor && selectedVendedor ? selectedVendedor : undefined,
        });
        if (mounted) setRows(res);
      } catch (e) {
        if (mounted) setError(e instanceof Error ? e.message : 'Falha ao carregar Top 20 Clientes');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [ano, mes, startDate, endDate, periodType, canFilterEquipe, canFilterVendedor, selectedEquipe, selectedVendedor]);

  const handleExport = () => [
    {
      sheetName: 'Top 20 Clientes',
      data: rows.map((r) => ({
        'Data Referência': fmtDate(r.dataReferencia),
        Nível: r.nivel,
        Gerência: r.gerencia,
        Equipe: r.equipe,
        'Cód. Vendedor': r.codVendedor,
        Vendedor: r.nomeVendedor,
        Pasta: r.pasta,
        'Cód. Cliente': r.codCliente,
        'Cliente/Redes': r.clienteRedes,
        'Trimestre 25': r.trimestre25,
        'Trimestre 26': r.trimestre26,
        '% Cresc. Trimestre': r.pctCrescTrimestre,
        'Mês 25': r.mes25,
        'Mês 26': r.mes26,
        '% Cresc. Mês': r.pctCrescMes,
        Período: selectedPeriod,
      })),
    },
  ];

  const thStyle: React.CSSProperties = {
    padding: '10px 12px',
    fontSize: 11,
    fontWeight: 700,
    color: t.textMuted,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    textAlign: 'left',
    borderBottom: `1px solid ${t.border}`,
    background: t.surfaceElevated,
    position: 'sticky',
    top: 0,
    whiteSpace: 'nowrap',
  };
  const tdStyle: React.CSSProperties = {
    padding: '10px 12px',
    fontSize: 12.5,
    color: t.text,
    borderBottom: `1px solid ${t.border}`,
    whiteSpace: 'nowrap',
  };

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 16,
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div>
          <h1 className="num" style={{ margin: '0 0 4px', fontSize: 24, fontWeight: 700, color: t.text }}>
            TOP 20 Clientes
          </h1>
          <p style={{ margin: 0, fontSize: 13, color: t.textSecondary }}>
            Ranking por vendedor/equipe/gerência — dados exatamente como importados.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          {canFilterEquipe && (
            <SingleSelectFilter
              label="Equipe"
              options={(filterOptions?.equipes || []).map((eq) => ({ value: eq, label: eq }))}
              value={selectedEquipe}
              onChange={setSelectedEquipe}
              placeholder="Todas as equipes"
              allLabel="Todas as equipes"
            />
          )}
          {canFilterVendedor && (
            <SingleSelectFilter
              label="Vendedor"
              options={vendedorOptions.map((v) => ({ value: v.codVendedor, label: v.nome }))}
              value={selectedVendedor}
              onChange={setSelectedVendedor}
              placeholder="Todos os vendedores"
              allLabel="Todos os vendedores"
            />
          )}
          <ExportExcelButton getSheets={handleExport} fileName="top-20-clientes" />
        </div>
      </div>

      {loading && <LoadingBlock />}
      {error && <ErrorBlock message={error} />}
      {!loading && !error && rows.length === 0 && <EmptyBlock title="Sem registros" />}

      {!loading && !error && rows.length > 0 && (
        <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ overflow: 'auto', maxHeight: 640 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={thStyle}>Data Referência</th>
                  <th style={thStyle}>Nível</th>
                  <th style={thStyle}>Gerência</th>
                  <th style={thStyle}>Equipe</th>
                  <th style={thStyle}>Vendedor</th>
                  <th style={thStyle}>Pasta</th>
                  <th style={thStyle}>Cód. Cliente</th>
                  <th style={thStyle}>Cliente/Redes</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Trimestre 25</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Trimestre 26</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>% Cresc. Trim.</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Mês 25</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Mês 26</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>% Cresc. Mês</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr
                    key={`${r.codVendedor}-${r.codCliente}-${i}`}
                    onMouseEnter={(e) => (e.currentTarget.style.background = t.surfaceElevated)}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <td style={{ ...tdStyle, color: t.textMuted }}>{fmtDate(r.dataReferencia)}</td>
                    <td style={tdStyle}>{r.nivel || '—'}</td>
                    <td style={{ ...tdStyle, color: t.textSecondary }}>{r.gerencia || '—'}</td>
                    <td style={{ ...tdStyle, color: t.textSecondary }}>{r.equipe || '—'}</td>
                    <td style={{ ...tdStyle, fontWeight: 600 }}>{r.nomeVendedor || r.codVendedor}</td>
                    <td style={tdStyle}>{r.pasta || '—'}</td>
                    <td style={{ ...tdStyle, fontFamily: 'monospace', color: t.textMuted }}>{r.codCliente}</td>
                    <td style={{ ...tdStyle, fontWeight: 600 }}>{r.clienteRedes || '—'}</td>
                    <td className="num" style={{ ...tdStyle, textAlign: 'right' }}>{fmt(r.trimestre25)}</td>
                    <td className="num" style={{ ...tdStyle, textAlign: 'right' }}>{fmt(r.trimestre26)}</td>
                    <td
                      className="num"
                      style={{ ...tdStyle, textAlign: 'right', fontWeight: 700, color: crescColor(r.pctCrescTrimestre, t) }}
                    >
                      {fmtPct(r.pctCrescTrimestre)}
                    </td>
                    <td className="num" style={{ ...tdStyle, textAlign: 'right' }}>{fmt(r.mes25)}</td>
                    <td className="num" style={{ ...tdStyle, textAlign: 'right' }}>{fmt(r.mes26)}</td>
                    <td
                      className="num"
                      style={{ ...tdStyle, textAlign: 'right', fontWeight: 700, color: crescColor(r.pctCrescMes, t) }}
                    >
                      {fmtPct(r.pctCrescMes)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
