import React, { useEffect, useMemo, useState } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useGlobalFilter } from '../../context/GlobalFilterContext';
import { ExportExcelButton } from '../../components/common/ExportExcelButton';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '../../components/common/DataState';
import {
  fetchTargets,
  fetchObjetivosFaseamento,
  fetchDashboardFilterOptions,
  TargetRow,
  ObjetivosFaseamentoResponse,
  DashboardFilterOptions,
} from '../../lib/api';
import { Target, ChevronDown } from 'lucide-react';

const fmt = (v: number) => `R$ ${v.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`;
const fmtPct = (v: number) => `${v.toFixed(1)}%`;

export const ObjetivosPage: React.FC = () => {
  const { t } = useTheme();
  const { currentUser } = useAuth();
  const { ano, mes, startDate, endDate, periodType } = useGlobalFilter();
  const [rows, setRows] = useState<TargetRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const role = currentUser?.role;
  // Admin/Gerência filtram por equipe ou vendedor; Supervisor só por
  // vendedor da própria equipe (equipe já travada no backend); Vendedor não
  // tem filtro (só vê os próprios dados).
  const canFilterEquipe = role === 'ADMIN' || role === 'GERENTE';
  const canFilterVendedor = role === 'ADMIN' || role === 'GERENTE' || role === 'SUPERVISOR';

  const [filterOptions, setFilterOptions] = useState<DashboardFilterOptions | null>(null);
  const [selectedEquipe, setSelectedEquipe] = useState('');
  const [selectedVendedor, setSelectedVendedor] = useState('');

  const [faseamento, setFaseamento] = useState<ObjetivosFaseamentoResponse | null>(null);
  const [faseamentoLoading, setFaseamentoLoading] = useState(true);
  const [faseamentoError, setFaseamentoError] = useState<string | null>(null);

  useEffect(() => {
    if (!canFilterEquipe && !canFilterVendedor) return;
    let mounted = true;
    (async () => {
      try {
        const opts = await fetchDashboardFilterOptions();
        if (mounted) setFilterOptions(opts);
      } catch {
        // Filtros são um extra da tela — sem eles, segue no escopo padrão do usuário.
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
      setFaseamentoLoading(true);
      setFaseamentoError(null);
      try {
        const res = await fetchObjetivosFaseamento({
          ano: periodType === 'personalizado' ? undefined : ano,
          mes: periodType === 'mensal' ? mes : undefined,
          start: startDate || undefined,
          end: endDate || undefined,
          equipe: canFilterEquipe && selectedEquipe ? selectedEquipe : undefined,
          vendedor: canFilterVendedor && selectedVendedor ? selectedVendedor : undefined,
        });
        if (mounted) setFaseamento(res);
      } catch (e) {
        if (mounted) setFaseamentoError(e instanceof Error ? e.message : 'Falha ao carregar metas de faseamento');
      } finally {
        if (mounted) setFaseamentoLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [ano, mes, startDate, endDate, periodType, canFilterEquipe, canFilterVendedor, selectedEquipe, selectedVendedor]);

  const anoMes = periodType === 'mensal' && ano && mes
    ? `${ano}-${String(mes).padStart(2, '0')}`
    : undefined;

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true); setError(null);
      try {
        const data = await fetchTargets(anoMes ? { ano_mes: anoMes } : undefined);
        if (mounted) setRows(data);
      } catch (e) {
        if (mounted) setError(e instanceof Error ? e.message : 'Falha ao carregar objetivos');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [anoMes]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      (r.vendedor || '').toLowerCase().includes(q) ||
      (r.equipe || '').toLowerCase().includes(q) ||
      (r.fabricante || '').toLowerCase().includes(q) ||
      (r.codVendedor || '').toLowerCase().includes(q)
    );
  }, [rows, query]);

  const totals = useMemo(() => ({
    metaFat: filtered.reduce((s, r) => s + (r.metaFaturamento || 0), 0),
    metaCob: filtered.reduce((s, r) => s + (r.metaCobertura || 0), 0),
  }), [filtered]);

  const handleExport = () => [{
    sheetName: 'Objetivos',
    data: filtered.map((r) => ({
      'Ano-Mês': r.anoMes,
      'Cód. Vendedor': r.codVendedor,
      Vendedor: r.vendedor,
      Equipe: r.equipe,
      Fabricante: r.fabricante,
      'Meta Faturamento': r.metaFaturamento,
      'Meta Cobertura': r.metaCobertura,
    })),
  }];

  const faseamentoSelectStyle: React.CSSProperties = {
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

  const faseamentoCard = (title: string, block: { meta: number; realizado: number; pct: number } | undefined) => (
    <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 10, padding: 12, flex: 1, minWidth: 160 }}>
      <div style={{ fontSize: 11, color: t.textMuted, marginBottom: 6 }}>{title}</div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 10, color: t.textMuted }}>Meta</div>
          <div className="num" style={{ fontWeight: 700, color: t.text }}>{fmt(block?.meta || 0)}</div>
        </div>
        <div>
          <div style={{ fontSize: 10, color: t.textMuted }}>Realizado</div>
          <div className="num" style={{ fontWeight: 700, color: t.text }}>{fmt(block?.realizado || 0)}</div>
        </div>
        <div>
          <div style={{ fontSize: 10, color: t.textMuted }}>Ating.</div>
          <div className="num" style={{ fontWeight: 700, color: t.primary }}>{fmtPct(block?.pct || 0)}</div>
        </div>
      </div>
    </div>
  );

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <div>
          <h1 className="num" style={{ margin: '0 0 4px', fontSize: 24, fontWeight: 700, color: t.text }}>Objetivos</h1>
          <p style={{ margin: 0, fontSize: 13, color: t.textSecondary }}>Metas mensais a partir da tabela metas_mensais.</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          {canFilterEquipe && (
            <div style={{ position: 'relative' }}>
              <select value={selectedEquipe} onChange={(e) => setSelectedEquipe(e.target.value)} style={faseamentoSelectStyle}>
                <option value="">Todas as equipes</option>
                {(filterOptions?.equipes || []).map((eq) => (
                  <option key={eq} value={eq}>{eq}</option>
                ))}
              </select>
              <ChevronDown size={13} color={t.textMuted} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
            </div>
          )}
          {canFilterVendedor && (
            <div style={{ position: 'relative' }}>
              <select value={selectedVendedor} onChange={(e) => setSelectedVendedor(e.target.value)} style={faseamentoSelectStyle}>
                <option value="">Todos os vendedores</option>
                {vendedorOptions.map((v) => (
                  <option key={v.codVendedor} value={v.codVendedor}>{v.nome}</option>
                ))}
              </select>
              <ChevronDown size={13} color={t.textMuted} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
            </div>
          )}
          <ExportExcelButton getSheets={handleExport} fileName="objetivos" />
        </div>
      </div>

      {/* Metas de Faseamento / Faseamento II / Desconcentração / Desafio — aba "Mês" do Dados App */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 10 }}>Faseamento &amp; Desafios</div>
        {faseamentoLoading && <LoadingBlock />}
        {faseamentoError && <ErrorBlock message={faseamentoError} />}
        {!faseamentoLoading && !faseamentoError && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {faseamentoCard('Meta Faseamento', faseamento?.faseamento)}
            {faseamentoCard('Meta Faseamento II', faseamento?.faseamentoII)}
            {faseamentoCard('Meta Desconcentração', faseamento?.desconcentracao)}
            {faseamentoCard('Meta Desafio', faseamento?.desafio)}
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 10, marginBottom: 14 }}>
        <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 10, padding: 12 }}>
          <div style={{ fontSize: 11, color: t.textMuted, display: 'flex', alignItems: 'center', gap: 6 }}><Target size={14} /> Meta faturamento</div>
          <div className="num" style={{ fontWeight: 700, color: t.text }}>{fmt(totals.metaFat)}</div>
        </div>
        <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 10, padding: 12 }}>
          <div style={{ fontSize: 11, color: t.textMuted }}>Meta cobertura</div>
          <div className="num" style={{ fontWeight: 700, color: t.text }}>{totals.metaCob.toLocaleString('pt-BR')}</div>
        </div>
        <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 10, padding: 12 }}>
          <div style={{ fontSize: 11, color: t.textMuted }}>Registros</div>
          <div className="num" style={{ fontWeight: 700, color: t.text }}>{filtered.length}</div>
        </div>
      </div>
      <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filtrar vendedor, equipe ou fabricante..." style={{ width: '100%', maxWidth: 420, marginBottom: 14, padding: '10px 12px', borderRadius: 8, border: `1px solid ${t.border}`, background: t.surface, color: t.text }} />
      {loading && <LoadingBlock />}
      {error && <ErrorBlock message={error} />}
      {!loading && !error && filtered.length === 0 && <EmptyBlock />}
      {!loading && !error && filtered.length > 0 && (
        <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 12, overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
            <thead>
              <tr style={{ color: t.textMuted, textAlign: 'left', borderBottom: `1px solid ${t.border}` }}>
                <th style={{ padding: 12 }}>Ano-Mês</th><th>Vendedor</th><th>Equipe</th><th>Fabricante</th><th>Meta fat.</th><th>Meta cob.</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => (
                <tr key={`${r.anoMes}-${r.codVendedor}-${r.fabricante}-${i}`} style={{ borderTop: `1px solid ${t.border}`, color: t.text }}>
                  <td style={{ padding: 12 }}>{r.anoMes}</td>
                  <td>{r.vendedor || r.codVendedor}</td>
                  <td>{r.equipe || '—'}</td>
                  <td>{r.fabricante || '—'}</td>
                  <td>{fmt(r.metaFaturamento)}</td>
                  <td>{r.metaCobertura.toLocaleString('pt-BR')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
