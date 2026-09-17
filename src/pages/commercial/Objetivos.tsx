import React, { useEffect, useMemo, useState } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useGlobalFilter } from '../../context/GlobalFilterContext';
import { ExportExcelButton } from '../../components/common/ExportExcelButton';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '../../components/common/DataState';
import { SingleSelectFilter } from '../../components/common/SingleSelectFilter';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import {
  fetchTargets,
  fetchObjetivosFaseamento,
  fetchDashboardFilterOptions,
  TargetRow,
  ObjetivosFaseamentoResponse,
  DashboardFilterOptions,
} from '../../lib/api';

const fmt = (v: number) => `R$ ${v.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`;
const fmtPct = (v: number) => `${v.toFixed(1)}%`;
const SUCCESS_GREEN = { light: '#0EA968', dark: '#1FAE6E' };

export const ObjetivosPage: React.FC = () => {
  const { t, mode } = useTheme();
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

  const faseamentoCard = (title: string, block: { meta: number; realizado: number; pct: number } | undefined) => {
    const pct = block?.pct || 0;
    const atingiu = pct >= 100;
    const progressColor = atingiu ? SUCCESS_GREEN[mode] : t.primary;
    const donutData = [
      { name: 'realizado', value: Math.min(100, Math.max(0, pct)) },
      { name: 'restante', value: Math.max(0, 100 - pct) },
    ];

    return (
      <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 10, padding: '18px 20px', width: '100%' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: t.text, marginBottom: 16 }}>{title}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', width: 76, height: 76, flexShrink: 0 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={donutData}
                  dataKey="value"
                  innerRadius={26}
                  outerRadius={36}
                  startAngle={90}
                  endAngle={-270}
                  stroke="none"
                >
                  <Cell fill={progressColor} />
                  <Cell fill={t.border} />
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 12,
                fontWeight: 700,
                color: progressColor,
              }}
              className="num"
            >
              {fmtPct(pct)}
            </div>
          </div>
          <div style={{ display: 'flex', flex: 1, minWidth: 220, gap: 28, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ fontSize: 11, color: t.textMuted }}>Meta</div>
              <div className="num" style={{ fontSize: 16, fontWeight: 700, color: t.text }}>{fmt(block?.meta || 0)}</div>
            </div>
            <div style={{ width: 1, alignSelf: 'stretch', background: t.border }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ fontSize: 11, color: t.textMuted }}>Realizado</div>
              <div className="num" style={{ fontSize: 16, fontWeight: 700, color: t.text }}>{fmt(block?.realizado || 0)}</div>
            </div>
            <div style={{ width: 1, alignSelf: 'stretch', background: t.border }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ fontSize: 11, color: t.textMuted }}>Atingimento</div>
              <div className="num" style={{ fontSize: 16, fontWeight: 700, color: progressColor }}>{fmtPct(pct)}</div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <div>
          <h1 className="num" style={{ margin: '0 0 4px', fontSize: 24, fontWeight: 700, color: t.text }}>Objetivos</h1>
          <p style={{ margin: 0, fontSize: 13, color: t.textSecondary }}>Metas mensais a partir da tabela metas_mensais.</p>
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
          <ExportExcelButton getSheets={handleExport} fileName="objetivos" />
        </div>
      </div>

      {/* Metas de Faseamento / Faseamento II / Desconcentração / Desafio — aba "Mês" do Dados App.
          Cards empilhados, cada um ocupando toda a largura disponível. */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 2 }}>Faseamento &amp; Desafios</div>
        {canFilterVendedor && (
          <div style={{ fontSize: 11.5, color: t.textMuted, marginBottom: 10 }}>
            Use o filtro de Vendedor acima para visualizar a meta e o realizado individualmente.
          </div>
        )}
        {!canFilterVendedor && <div style={{ marginBottom: 10 }} />}
        {faseamentoLoading && <LoadingBlock />}
        {faseamentoError && <ErrorBlock message={faseamentoError} />}
        {!faseamentoLoading && !faseamentoError && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {faseamentoCard('Meta Faseamento', faseamento?.faseamento)}
            {faseamentoCard('Meta Faseamento II', faseamento?.faseamentoII)}
            {faseamentoCard('Meta Desconcentração', faseamento?.desconcentracao)}
            {faseamentoCard('Meta Desafio', faseamento?.desafio)}
          </div>
        )}
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
