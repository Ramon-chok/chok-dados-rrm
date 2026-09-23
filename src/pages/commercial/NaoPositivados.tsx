import React, { useEffect, useMemo, useState } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useGlobalFilter } from '../../context/GlobalFilterContext';
import { ExportExcelButton } from '../../components/common/ExportExcelButton';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '../../components/common/DataState';
import { MultiSelectFilter } from '../../components/common/MultiSelectFilter';
import { SingleSelectFilter } from '../../components/common/SingleSelectFilter';
import {
  getErrorMessage,
  fetchNaoPositivadosImport,
  fetchDashboardFilterOptions,
  NaoPositivadosImportResponse,
  NaoPositivadoNivel,
  NaoPositivadoRow,
  DashboardFilterOptions,
} from '../../lib/api';
import { Search } from 'lucide-react';

const NIVEL_LABELS: Record<NaoPositivadoNivel, string> = {
  total: 'Chok Total',
  equipe: 'Por Equipe',
  vendedor: 'Por Vendedor',
};

const fmtValor = (v: number) => `R$ ${v.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`;

const SUCCESS_GREEN = { light: '#0EA968', dark: '#1FAE6E' };

export const NaoPositivadosPage: React.FC = () => {
  const { t, mode } = useTheme();
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
  const [selectedCategoria, setSelectedCategoria] = useState('');
  const [selectedMunicipios, setSelectedMunicipios] = useState<string[]>([]);

  const [data, setData] = useState<NaoPositivadosImportResponse | null>(null);
  const [query, setQuery] = useState('');
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
        // Filtros são um extra da tela — sem eles, segue no escopo padrão.
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
    // Categoria escolhida pode não existir mais depois de trocar de dados.
    setSelectedCategoria('');
  }, [data]);

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
          nivel: canFilterVendedor && selectedVendedor ? 'vendedor' : canFilterEquipe && selectedEquipe ? 'equipe' : undefined,
          equipe: canFilterEquipe && selectedEquipe ? selectedEquipe : undefined,
          vendedor: canFilterVendedor && selectedVendedor ? selectedVendedor : undefined,
        });
        if (mounted) setData(res);
      } catch (e) {
        if (mounted) setError(getErrorMessage(e, 'Falha ao carregar não positivados'));
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [ano, mes, startDate, endDate, periodType, canFilterEquipe, canFilterVendedor, selectedEquipe, selectedVendedor]);

  const municipioOptions = useMemo(() => {
    const set = new Set<string>();
    (data?.rows || []).forEach((c) => {
      if (c.municipio) set.add(c.municipio);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [data]);

  useEffect(() => {
    // Municípios selecionados podem não existir mais depois de trocar de dados.
    setSelectedMunicipios((prev) => prev.filter((m) => municipioOptions.includes(m)));
  }, [municipioOptions]);

  const filtered = useMemo(() => {
    const list = data?.rows || [];
    const q = query.toLowerCase();
    return list.filter((c) => {
      const matchesQuery =
        !q ||
        (c.razaoSocial || '').toLowerCase().includes(q) ||
        (c.nomeFantasia || '').toLowerCase().includes(q) ||
        (c.codCliente || '').toLowerCase().includes(q) ||
        (c.vendedor || '').toLowerCase().includes(q);
      const matchesMunicipio =
        selectedMunicipios.length === 0 || selectedMunicipios.includes(c.municipio || '');
      return matchesQuery && matchesMunicipio;
    });
  }, [data, query, selectedMunicipios]);

  const effectiveNivel = data?.nivel || 'total';

  // Valor total de venda do cliente (soma de todos os fabricantes) — ou, se
  // o usuário filtrar por um fabricante específico, o valor daquela coluna.
  const totalValor = (c: NaoPositivadoRow) =>
    Object.values(c.fabricantes || {}).reduce((acc: number, v) => acc + (Number(v) || 0), 0);
  const lastColLabel = selectedCategoria || 'Valor Total';
  const lastColValue = (c: NaoPositivadoRow) =>
    selectedCategoria ? Number(c.fabricantes?.[selectedCategoria]) || 0 : totalValor(c);
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
        [lastColLabel]: lastColValue(c),
        Período: selectedPeriod,
      })),
    },
  ];

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
          <MultiSelectFilter
            label="Município"
            options={municipioOptions}
            selected={selectedMunicipios}
            onChange={setSelectedMunicipios}
            placeholder="Todos os municípios"
          />
          {(data?.categorias.length || 0) > 0 && (
            <SingleSelectFilter
              label="Categoria"
              options={data!.categorias.map((c) => ({ value: c, label: c }))}
              value={selectedCategoria}
              onChange={setSelectedCategoria}
              placeholder="Todas as categorias"
              allLabel="Todas as categorias"
            />
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
        <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ overflow: 'auto', maxHeight: 620 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
              <thead>
                <tr style={{ color: t.textMuted, textAlign: 'left', borderBottom: `1px solid ${t.border}`, background: t.surfaceElevated }}>
                  <th style={{ padding: 12, position: 'sticky', top: 0, background: t.surfaceElevated }}>Cód. Cliente</th>
                  <th style={{ position: 'sticky', top: 0, background: t.surfaceElevated }}>Razão Social</th>
                  <th style={{ position: 'sticky', top: 0, background: t.surfaceElevated }}>Nome Fantasia</th>
                  <th style={{ position: 'sticky', top: 0, background: t.surfaceElevated }}>Município</th>
                  {effectiveNivel === 'vendedor' && <th style={{ position: 'sticky', top: 0, background: t.surfaceElevated }}>Vendedor</th>}
                  {(effectiveNivel === 'vendedor' || effectiveNivel === 'equipe') && <th style={{ position: 'sticky', top: 0, background: t.surfaceElevated }}>Equipe</th>}
                  <th style={{ textAlign: 'right', position: 'sticky', top: 0, background: t.surfaceElevated, minWidth: 140 }}>{lastColLabel}</th>
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
                    <td style={{ textAlign: 'right', padding: '10px 12px' }}>
                      <ValueStatus value={lastColValue(c)} theme={t} mode={mode} formatter={fmtValor} />
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

// Valor com sinalização de cor: verde quando houve venda no período/categoria
// exibida, vermelho quando o valor é zero (sem venda).
const ValueStatus: React.FC<{ value: number; theme: any; mode: 'light' | 'dark'; formatter: (v: number) => string }> = ({
  value,
  theme: t,
  mode,
  formatter,
}) => {
  const hasSale = value > 0;
  const color = hasSale ? SUCCESS_GREEN[mode] : t.complementaryRed;
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
      <span className="num" style={{ fontSize: 12.5, fontWeight: 700, color }}>
        {formatter(value)}
      </span>
    </div>
  );
};
