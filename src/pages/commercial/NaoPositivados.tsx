import React, { useEffect, useMemo, useState } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useGlobalFilter } from '../../context/GlobalFilterContext';
import { PeriodSelector } from '../../components/common/PeriodSelector';
import { ExportExcelButton } from '../../components/common/ExportExcelButton';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '../../components/common/DataState';
import {
  fetchNaoPositivadosImport,
  fetchDashboardFilterOptions,
  NaoPositivadosImportResponse,
  NaoPositivadoNivel,
  DashboardFilterOptions,
} from '../../lib/api';
import { Search, ChevronDown } from 'lucide-react';

const NIVEL_LABELS: Record<NaoPositivadoNivel, string> = {
  total: 'Chok Total',
  equipe: 'Por Equipe',
  vendedor: 'Por Vendedor',
};

export const NaoPositivadosPage: React.FC = () => {
  const { t } = useTheme();
  const { currentUser } = useAuth();
  const { selectedPeriod, startDate, endDate, ano, mes, periodType } = useGlobalFilter();

  const role = currentUser?.role;
  // Admin/Gerência: veem o Chok Total por padrão, mas podem trocar para ver
  // por Equipe ou por Vendedor (com filtro opcional de qual). Supervisor: só
  // o nível Equipe, travado na própria equipe. Vendedor: só o nível
  // Vendedor, travado no próprio código — nenhum seletor aparece pra eles.
  const canPickNivel = role === 'ADMIN' || role === 'GERENTE';

  const [nivel, setNivel] = useState<NaoPositivadoNivel>('total');
  const [filterOptions, setFilterOptions] = useState<DashboardFilterOptions | null>(null);
  const [selectedEquipe, setSelectedEquipe] = useState('');
  const [selectedVendedor, setSelectedVendedor] = useState('');
  const [selectedCategoria, setSelectedCategoria] = useState('');

  const [data, setData] = useState<NaoPositivadosImportResponse | null>(null);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!canPickNivel) return;
    let mounted = true;
    (async () => {
      try {
        const opts = await fetchDashboardFilterOptions();
        if (mounted) setFilterOptions(opts);
      } catch {
        // Filtros são um extra da tela — sem eles, segue no nível padrão.
      }
    })();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const vendedorOptions = useMemo(() => filterOptions?.vendedores || [], [filterOptions]);

  useEffect(() => {
    // Categoria escolhida pode não existir mais depois de trocar de nível/filtro.
    setSelectedCategoria('');
  }, [nivel, selectedEquipe, selectedVendedor]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetchNaoPositivadosImport({
          ano: periodType === 'personalizado' ? undefined : ano,
          mes: periodType === 'mensal' ? mes : undefined,
          start: startDate || undefined,
          end: endDate || undefined,
          nivel: canPickNivel ? nivel : undefined,
          equipe: canPickNivel && nivel === 'equipe' && selectedEquipe ? selectedEquipe : undefined,
          vendedor: canPickNivel && nivel === 'vendedor' && selectedVendedor ? selectedVendedor : undefined,
        });
        if (mounted) setData(res);
      } catch (e) {
        if (mounted) setError(e instanceof Error ? e.message : 'Falha ao carregar não positivados');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [ano, mes, startDate, endDate, periodType, canPickNivel, nivel, selectedEquipe, selectedVendedor]);

  const filtered = useMemo(() => {
    const list = data?.rows || [];
    const q = query.toLowerCase();
    if (!q) return list;
    return list.filter(
      (c) =>
        (c.razaoSocial || '').toLowerCase().includes(q) ||
        (c.nomeFantasia || '').toLowerCase().includes(q) ||
        (c.codCliente || '').toLowerCase().includes(q) ||
        (c.vendedor || '').toLowerCase().includes(q)
    );
  }, [data, query]);

  const effectiveNivel = data?.nivel || nivel;

  const handleExport = () => [
    {
      sheetName: 'Não Positivados',
      data: filtered.map((c) => ({
        'Cód. Cliente': c.codCliente,
        'Razão Social': c.razaoSocial,
        'Nome Fantasia': c.nomeFantasia,
        Município: c.municipio,
        ...(effectiveNivel === 'vendedor' ? { Vendedor: c.vendedor, Equipe: c.equipe } : {}),
        ...(effectiveNivel === 'equipe' ? { Equipe: c.equipe } : {}),
        ...(selectedCategoria ? { [selectedCategoria]: c.fabricantes?.[selectedCategoria] ?? '' } : {}),
        Período: selectedPeriod,
      })),
    },
  ];

  const selectStyle: React.CSSProperties = {
    fontSize: '13px',
    fontWeight: 600,
    color: t.text,
    background: t.surfaceElevated,
    border: `1px solid ${t.border}`,
    borderRadius: '6px',
    padding: '5px 26px 5px 10px',
    cursor: 'pointer',
    outline: 'none',
    appearance: 'none',
    WebkitAppearance: 'none',
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <div>
          <h1 className="num" style={{ margin: '0 0 4px', fontSize: 24, fontWeight: 700, color: t.text }}>
            Não Positivados
          </h1>
          <p style={{ margin: 0, fontSize: 13, color: t.textSecondary }}>
            {NIVEL_LABELS[effectiveNivel]} — dados exatamente como importados.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <PeriodSelector />
          {canPickNivel && (
            <div style={{ position: 'relative' }}>
              <select value={nivel} onChange={(e) => setNivel(e.target.value as NaoPositivadoNivel)} style={selectStyle}>
                <option value="total">Chok Total</option>
                <option value="equipe">Por Equipe</option>
                <option value="vendedor">Por Vendedor</option>
              </select>
              <ChevronDown size={13} color={t.textMuted} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
            </div>
          )}
          {canPickNivel && nivel === 'equipe' && (
            <div style={{ position: 'relative' }}>
              <select value={selectedEquipe} onChange={(e) => setSelectedEquipe(e.target.value)} style={selectStyle}>
                <option value="">Todas as equipes</option>
                {(filterOptions?.equipes || []).map((eq) => (
                  <option key={eq} value={eq}>{eq}</option>
                ))}
              </select>
              <ChevronDown size={13} color={t.textMuted} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
            </div>
          )}
          {canPickNivel && nivel === 'vendedor' && (
            <div style={{ position: 'relative' }}>
              <select value={selectedVendedor} onChange={(e) => setSelectedVendedor(e.target.value)} style={selectStyle}>
                <option value="">Todos os vendedores</option>
                {vendedorOptions.map((v) => (
                  <option key={v.codVendedor} value={v.codVendedor}>{v.nome}</option>
                ))}
              </select>
              <ChevronDown size={13} color={t.textMuted} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
            </div>
          )}
          {(data?.categorias.length || 0) > 0 && (
            <div style={{ position: 'relative' }}>
              <select value={selectedCategoria} onChange={(e) => setSelectedCategoria(e.target.value)} style={selectStyle}>
                <option value="">Todas as categorias</option>
                {data!.categorias.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <ChevronDown size={13} color={t.textMuted} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
            </div>
          )}
          <ExportExcelButton getSheets={handleExport} fileName="nao-positivados" />
        </div>
      </div>

      {data && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 10, marginBottom: 14 }}>
          <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 10, padding: 12 }}>
            <div style={{ fontSize: 11, color: t.textMuted }}>Não positivados</div>
            <div className="num" style={{ fontWeight: 700, color: t.text }}>{filtered.length}</div>
          </div>
          <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 10, padding: 12 }}>
            <div style={{ fontSize: 11, color: t.textMuted }}>Categorias (fabricantes)</div>
            <div className="num" style={{ fontWeight: 700, color: t.text }}>{data.categorias.length}</div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, border: `1px solid ${t.border}`, borderRadius: 8, padding: '10px 14px', background: t.surface, marginBottom: 14, maxWidth: 420 }}>
        <Search size={16} color={t.textMuted} />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar cliente..." style={{ border: 'none', outline: 'none', background: 'transparent', color: t.text, width: '100%' }} />
      </div>

      {loading && <LoadingBlock />}
      {error && <ErrorBlock message={error} />}
      {!loading && !error && filtered.length === 0 && <EmptyBlock title="Sem registros" />}
      {!loading && !error && filtered.length > 0 && (
        <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 12, overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
            <thead>
              <tr style={{ color: t.textMuted, textAlign: 'left', borderBottom: `1px solid ${t.border}` }}>
                <th style={{ padding: 12 }}>Cód. Cliente</th>
                <th>Razão Social</th>
                <th>Nome Fantasia</th>
                <th>Município</th>
                {effectiveNivel === 'vendedor' && <th>Vendedor</th>}
                {(effectiveNivel === 'vendedor' || effectiveNivel === 'equipe') && <th>Equipe</th>}
                {selectedCategoria && <th style={{ textAlign: 'right' }}>{selectedCategoria}</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.codCliente} style={{ borderTop: `1px solid ${t.border}`, color: t.text }}>
                  <td style={{ padding: 12, fontFamily: 'monospace', color: t.textMuted }}>{c.codCliente}</td>
                  <td style={{ fontWeight: 600 }}>{c.razaoSocial || '—'}</td>
                  <td>{c.nomeFantasia || '—'}</td>
                  <td>{c.municipio || '—'}</td>
                  {effectiveNivel === 'vendedor' && <td>{c.vendedor || c.codVendedor || '—'}</td>}
                  {(effectiveNivel === 'vendedor' || effectiveNivel === 'equipe') && <td>{c.equipe || '—'}</td>}
                  {selectedCategoria && (
                    <td className="num" style={{ textAlign: 'right' }}>
                      {c.fabricantes?.[selectedCategoria] ?? '—'}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
