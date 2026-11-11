import React, { useEffect, useMemo, useState } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useGlobalFilter } from '../../context/GlobalFilterContext';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '../../components/common/DataState';
import { SingleSelectFilter } from '../../components/common/SingleSelectFilter';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { CheckCircle2, ClipboardList, Search, Target } from 'lucide-react';
import {
  getErrorMessage,
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
        if (mounted) setFaseamentoError(getErrorMessage(e, 'Falha ao carregar metas de faseamento'));
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
        if (mounted) setError(getErrorMessage(e, 'Falha ao carregar objetivos'));
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

  /** Totais da tabela, para dar a ordem de grandeza antes de ler linha a linha. */
  const totais = useMemo(() => {
    const vendedores = new Set<string>();
    const fabricantes = new Set<string>();
    let metaFat = 0;
    let metaCob = 0;
    filtered.forEach((r) => {
      if (r.codVendedor) vendedores.add(r.codVendedor);
      if (r.fabricante) fabricantes.add(r.fabricante);
      metaFat += r.metaFaturamento || 0;
      metaCob += r.metaCobertura || 0;
    });
    return {
      linhas: filtered.length,
      vendedores: vendedores.size,
      fabricantes: fabricantes.size,
      metaFat,
      metaCob,
    };
  }, [filtered]);

  /**
   * Cartão de uma meta de faseamento.
   *
   * Formato compacto de propósito: os quatro cartões agora dividem a largura
   * numa grade, em vez de ocupar uma faixa inteira cada um e empurrar a
   * tabela para fora da primeira tela. O percentual aparece SÓ no centro do
   * anel — antes era repetido numa terceira coluna "Atingimento", gastando
   * espaço sem acrescentar informação.
   */
  const faseamentoCard = (
    title: string,
    block: { meta: number; realizado: number; pct: number } | undefined
  ) => {
    const pct = block?.pct || 0;
    const atingiu = pct >= 100;
    const progressColor = atingiu ? SUCCESS_GREEN[mode] : t.primary;
    const donutData = [
      { name: 'realizado', value: Math.min(100, Math.max(0, pct)) },
      { name: 'restante', value: Math.max(0, 100 - pct) },
    ];

    return (
      <div
        key={title}
        style={{
          background: t.surface,
          border: `1px solid ${t.border}`,
          borderRadius: 12,
          padding: '16px 18px',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: t.text }}>{title}</div>
          {/* Situação com rótulo, não só cor: quem não distingue as cores
              continua lendo se a meta foi batida ou não. */}
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              fontSize: 10.5,
              fontWeight: 700,
              padding: '2px 8px',
              borderRadius: 999,
              background: `${progressColor}1F`,
              color: progressColor,
              whiteSpace: 'nowrap',
            }}
          >
            {atingiu ? <CheckCircle2 size={11} /> : <Target size={11} />}
            {atingiu ? 'Atingida' : 'Em curso'}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ position: 'relative', width: 78, height: 78, flexShrink: 0 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={donutData}
                  dataKey="value"
                  innerRadius={27}
                  outerRadius={37}
                  startAngle={90}
                  endAngle={-270}
                  stroke="none"
                  isAnimationActive={false}
                >
                  <Cell fill={progressColor} />
                  <Cell fill={t.border} />
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div
              className="num"
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 13,
                fontWeight: 700,
                color: progressColor,
              }}
            >
              {fmtPct(pct)}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0, flex: 1 }}>
            <div>
              <div
                style={{
                  fontSize: 10.5,
                  color: t.textMuted,
                  textTransform: 'uppercase',
                  letterSpacing: 0.4,
                  fontWeight: 600,
                }}
              >
                Meta
              </div>
              <div className="num" style={{ fontSize: 15, fontWeight: 700, color: t.text }}>
                {fmt(block?.meta || 0)}
              </div>
            </div>
            <div>
              <div
                style={{
                  fontSize: 10.5,
                  color: t.textMuted,
                  textTransform: 'uppercase',
                  letterSpacing: 0.4,
                  fontWeight: 600,
                }}
              >
                Realizado
              </div>
              <div className="num" style={{ fontSize: 15, fontWeight: 700, color: progressColor }}>
                {fmt(block?.realizado || 0)}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const th: React.CSSProperties = {
    padding: '10px 14px',
    textAlign: 'left',
    fontWeight: 600,
    fontSize: 11.5,
    color: t.textMuted,
    whiteSpace: 'nowrap',
    // Cabeçalho preso ao topo da área rolável; fundo opaco para as linhas não
    // aparecerem por baixo. boxShadow no lugar de borderBottom porque, com
    // borderCollapse, a borda de uma célula sticky não é pintada de forma
    // confiável pelos navegadores.
    position: 'sticky',
    top: 0,
    zIndex: 1,
    background: t.surface,
    boxShadow: `inset 0 -1px 0 ${t.border}`,
  };
  const td: React.CSSProperties = { padding: '10px 14px', whiteSpace: 'nowrap', color: t.text };
  const tdNum: React.CSSProperties = { ...td, textAlign: 'right' };

  const kpis: [string, string][] = [
    ['Linhas de meta', totais.linhas.toLocaleString('pt-BR')],
    ['Vendedores', totais.vendedores.toLocaleString('pt-BR')],
    ['Categorias', totais.fabricantes.toLocaleString('pt-BR')],
    ['Meta de faturamento', fmt(totais.metaFat)],
    ['Meta de cobertura', totais.metaCob.toLocaleString('pt-BR')],
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <div>
          <h1 className="num" style={{ margin: '0 0 4px', fontSize: 24, fontWeight: 700, color: t.text }}>
            Objetivos
          </h1>
          <p style={{ margin: 0, fontSize: 13, color: t.textSecondary }}>
            Metas mensais por vendedor e categoria, e o acompanhamento das metas de faseamento e desafio.
          </p>
        </div>
      </div>

      {/* FILTROS — em barra própria, como nas demais telas. Antes ficavam
          espremidos na linha do título, disputando espaço com o botão de
          exportar, e a busca da tabela ficava solta mais abaixo. */}
      <div
        style={{
          display: 'flex',
          gap: 10,
          alignItems: 'flex-end',
          flexWrap: 'wrap',
          marginBottom: 16,
          background: t.surface,
          border: `1px solid ${t.border}`,
          borderRadius: 12,
          padding: 12,
        }}
      >
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
        <div style={{ flex: 1, minWidth: 220 }}>
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 11,
              fontWeight: 600,
              color: t.textMuted,
              marginBottom: 4,
            }}
          >
            <Search size={12} /> Buscar na tabela
          </label>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Vendedor, equipe ou categoria"
            style={{
              width: '100%',
              padding: '8px 10px',
              borderRadius: 8,
              border: `1px solid ${t.border}`,
              background: t.surfaceElevated,
              color: t.text,
              fontSize: 13,
            }}
          />
        </div>
      </div>

      {/* FASEAMENTO & DESAFIOS — grade, não mais quatro faixas empilhadas. */}
      <div style={{ marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
          <Target size={16} color={t.primary} />
          <div style={{ fontSize: 14, fontWeight: 600, color: t.text }}>Faseamento &amp; Desafios</div>
          {canFilterVendedor && (
            <div style={{ fontSize: 11.5, color: t.textMuted }}>
              — use o filtro de Vendedor para ver meta e realizado individualmente
            </div>
          )}
        </div>
        {faseamentoLoading && <LoadingBlock />}
        {faseamentoError && <ErrorBlock message={faseamentoError} />}
        {!faseamentoLoading && !faseamentoError && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(270px, 1fr))',
              gap: 12,
            }}
          >
            {faseamentoCard('Meta Faseamento', faseamento?.faseamento)}
            {faseamentoCard('Meta Faseamento II', faseamento?.faseamentoII)}
            {faseamentoCard('Meta Desconcentração', faseamento?.desconcentracao)}
            {faseamentoCard('Meta Desafio', faseamento?.desafio)}
          </div>
        )}
      </div>

      {/* METAS MENSAIS */}
      {loading && <LoadingBlock />}
      {error && <ErrorBlock message={error} />}
      {!loading && !error && filtered.length === 0 && (
        <EmptyBlock
          title="Nenhuma meta no período"
          description="Importe a planilha em Administração › Dados e Exportações, ou ajuste o período e os filtros acima."
        />
      )}
      {!loading && !error && filtered.length > 0 && (
        <>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
              gap: 12,
              marginBottom: 12,
            }}
          >
            {kpis.map(([rotulo, valor]) => (
              <div
                key={rotulo}
                style={{
                  background: t.surface,
                  border: `1px solid ${t.border}`,
                  borderRadius: 12,
                  padding: '12px 14px',
                }}
              >
                <div
                  style={{
                    fontSize: 10.5,
                    fontWeight: 600,
                    color: t.textMuted,
                    marginBottom: 5,
                    textTransform: 'uppercase',
                    letterSpacing: 0.4,
                  }}
                >
                  {rotulo}
                </div>
                <div className="num" style={{ fontSize: 17, fontWeight: 700, color: t.text }}>
                  {valor}
                </div>
              </div>
            ))}
          </div>

          <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 12, overflow: 'hidden' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '12px 16px',
                borderBottom: `1px solid ${t.border}`,
              }}
            >
              <ClipboardList size={16} color={t.primary} />
              <div style={{ fontSize: 14, fontWeight: 600, color: t.text }}>
                Metas por vendedor e categoria
                <span style={{ fontSize: 11.5, fontWeight: 500, color: t.textMuted }}>
                  {' '}
                  — {filtered.length.toLocaleString('pt-BR')} linha{filtered.length === 1 ? '' : 's'}
                </span>
              </div>
            </div>
            {/* Altura fixa com rolagem só aqui dentro: a lista não estica mais
                a página inteira conforme o período traz mais metas. */}
            <div style={{ maxHeight: 460, overflowY: 'auto', overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                <thead>
                  <tr>
                    <th style={th}>Ano-Mês</th>
                    <th style={th}>Vendedor</th>
                    <th style={th}>Equipe</th>
                    <th style={th}>Categoria</th>
                    <th style={{ ...th, textAlign: 'right' }}>Meta faturamento</th>
                    <th style={{ ...th, textAlign: 'right' }}>Meta cobertura</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r, i) => (
                    <tr
                      key={`${r.anoMes}-${r.codVendedor}-${r.fabricante}-${i}`}
                      style={{ borderTop: `1px solid ${t.border}` }}
                    >
                      {/* Antes só a primeira célula de cada linha tinha
                          padding: as demais colunas ficavam coladas umas nas
                          outras e os números alinhados à esquerda. */}
                      <td className="num" style={td}>{r.anoMes}</td>
                      <td style={{ ...td, whiteSpace: 'normal', minWidth: 170 }}>{r.vendedor || r.codVendedor}</td>
                      <td style={{ ...td, color: t.textSecondary }}>{r.equipe || '—'}</td>
                      <td style={{ ...td, whiteSpace: 'normal', minWidth: 150 }}>{r.fabricante || '—'}</td>
                      <td className="num" style={tdNum}>{fmt(r.metaFaturamento)}</td>
                      <td className="num" style={tdNum}>{r.metaCobertura.toLocaleString('pt-BR')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
