import React, { useState, useMemo, Fragment } from 'react';
import * as XLSX from 'xlsx';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useGlobalFilter } from '../../context/GlobalFilterContext';
import { PeriodSelector } from '../../components/common/PeriodSelector';
import { Download, Users, CheckCircle2, XCircle, Percent } from 'lucide-react';

interface VendedorData {
  nome: string;
  meta: number;
  realizado: number;
  metaCobertura: number;
  realizadoCobertura: number;
  crescimento: number;
  participacao: number;
}

interface EquipeData {
  nome: string;
  meta: number;
  realizado: number;
  metaCobertura: number;
  realizadoCobertura: number;
  crescimento: number;
  participacao: number;
  vendedores: VendedorData[];
}

interface FabricanteData {
  nome: string;
  meta: number;
  realizado: number;
  metaCobertura: number;
  realizadoCobertura: number;
  crescimento: number;
  participacao: number;
  equipes: EquipeData[];
}

const dados: FabricanteData[] = [
  {
    nome: 'ARCOR', meta: 480000, realizado: 402100, metaCobertura: 420, realizadoCobertura: 312, crescimento: 4.2, participacao: 23.1,
    equipes: [
      { nome: 'TRAB ALFA', meta: 210000, realizado: 185300, metaCobertura: 200, realizadoCobertura: 154, crescimento: 3.1, participacao: 46.1,
        vendedores: [
          { nome: 'Vendedor 003', meta: 110000, realizado: 98200, metaCobertura: 105, realizadoCobertura: 82, crescimento: 2.4, participacao: 53.0 },
          { nome: 'Vendedor 004', meta: 100000, realizado: 87100, metaCobertura: 95, realizadoCobertura: 72, crescimento: 4.0, participacao: 47.0 },
        ] },
      { nome: 'TRAB BETA', meta: 270000, realizado: 216800, metaCobertura: 220, realizadoCobertura: 158, crescimento: 5.0, participacao: 53.9,
        vendedores: [
          { nome: 'Vendedor 011', meta: 150000, realizado: 128400, metaCobertura: 120, realizadoCobertura: 90, crescimento: 6.1, participacao: 59.2 },
          { nome: 'Vendedor 012', meta: 120000, realizado: 88400, metaCobertura: 100, realizadoCobertura: 68, crescimento: 3.5, participacao: 40.8 },
        ] },
    ],
  },
  {
    nome: 'HEINZ', meta: 320000, realizado: 298500, metaCobertura: 350, realizadoCobertura: 260, crescimento: 2.8, participacao: 17.2,
    equipes: [
      { nome: 'TRAB ALFA', meta: 160000, realizado: 152300, metaCobertura: 180, realizadoCobertura: 135, crescimento: 2.0, participacao: 51.0,
        vendedores: [
          { nome: 'Vendedor 003', meta: 90000, realizado: 88900, metaCobertura: 100, realizadoCobertura: 78, crescimento: 1.5, participacao: 58.4 },
          { nome: 'Vendedor 004', meta: 70000, realizado: 63400, metaCobertura: 80, realizadoCobertura: 57, crescimento: 2.8, participacao: 41.6 },
        ] },
      { nome: 'TRAB GAMA', meta: 160000, realizado: 146200, metaCobertura: 170, realizadoCobertura: 125, crescimento: 3.6, participacao: 49.0,
        vendedores: [
          { nome: 'Vendedor 020', meta: 160000, realizado: 146200, metaCobertura: 170, realizadoCobertura: 125, crescimento: 3.6, participacao: 100.0 },
        ] },
    ],
  },
  {
    nome: 'NESTLÉ', meta: 610000, realizado: 445200, metaCobertura: 560, realizadoCobertura: 410, crescimento: -1.4, participacao: 25.5,
    equipes: [
      { nome: 'TRAB BETA', meta: 380000, realizado: 268400, metaCobertura: 320, realizadoCobertura: 232, crescimento: -2.0, participacao: 60.3,
        vendedores: [
          { nome: 'Vendedor 011', meta: 220000, realizado: 162100, metaCobertura: 180, realizadoCobertura: 134, crescimento: -1.1, participacao: 60.4 },
          { nome: 'Vendedor 012', meta: 160000, realizado: 106300, metaCobertura: 140, realizadoCobertura: 98, crescimento: -3.3, participacao: 39.6 },
        ] },
      { nome: 'TRAB GAMA', meta: 230000, realizado: 176800, metaCobertura: 240, realizadoCobertura: 178, crescimento: -0.6, participacao: 39.7,
        vendedores: [
          { nome: 'Vendedor 020', meta: 230000, realizado: 176800, metaCobertura: 240, realizadoCobertura: 178, crescimento: -0.6, participacao: 100.0 },
        ] },
    ],
  },
  {
    nome: 'UNILEVER', meta: 275000, realizado: 261900, metaCobertura: 310, realizadoCobertura: 245, crescimento: 6.7, participacao: 15.0,
    equipes: [
      { nome: 'TRAB ALFA', meta: 275000, realizado: 261900, metaCobertura: 310, realizadoCobertura: 245, crescimento: 6.7, participacao: 100.0,
        vendedores: [
          { nome: 'Vendedor 003', meta: 140000, realizado: 138200, metaCobertura: 160, realizadoCobertura: 128, crescimento: 5.9, participacao: 52.8 },
          { nome: 'Vendedor 004', meta: 135000, realizado: 123700, metaCobertura: 150, realizadoCobertura: 117, crescimento: 7.6, participacao: 47.2 },
        ] },
    ],
  },
];

const METRICAS = [
  { key: 'meta', label: 'Meta' },
  { key: 'realizado', label: 'Realizado' },
  { key: 'gap', label: 'GAP' },
  { key: 'atingimento', label: 'Atingimento' },
  { key: 'metaCobertura', label: 'Meta de Cobertura' },
  { key: 'realizadoCobertura', label: 'Realizado' },
  { key: 'crescimento', label: 'Crescimento' },
  { key: 'participacao', label: 'Participação' },
];

const fmtR = (v: number) => `R$ ${Math.round(v).toLocaleString('pt-BR')}`;

function computeRow<T extends { meta: number; realizado: number; metaCobertura?: number; realizadoCobertura?: number }>(
  row: T
): T & { gap: number; atingimento: number; metaCobertura: number; realizadoCobertura: number } {
  const gap = row.realizado - row.meta;
  const atingimento = row.meta > 0 ? (row.realizado / row.meta) * 100 : 0;
  const metaCobertura = row.metaCobertura ?? 0;
  const realizadoCobertura = row.realizadoCobertura ?? 0;
  return { ...row, gap, atingimento, metaCobertura, realizadoCobertura };
}

function MetricCell({ metricKey, row }: { metricKey: string; row: any }) {
  const { t } = useTheme();
  const v = row[metricKey];
  if (v === undefined || v === null) return <span>-</span>;
  if (metricKey === 'meta' || metricKey === 'realizado') return <span className="num">{fmtR(v)}</span>;
  if (metricKey === 'gap')
    return <span className="num" style={{ fontWeight: 600, color: v >= 0 ? '#3DD68C' : t.primaryHover }}>{v >= 0 ? '+' : ''}{fmtR(v)}</span>;
  if (metricKey === 'atingimento')
    return <span className="num" style={{ fontWeight: 600, color: v >= 90 ? '#3DD68C' : v >= 75 ? t.text : t.primaryHover }}>{typeof v === 'number' ? `${v.toFixed(1)}%` : `${v}%`}</span>;
  if (metricKey === 'metaCobertura')
    return <span className="num">{v} cli</span>;
  if (metricKey === 'realizadoCobertura') {
    const pct = row.metaCobertura > 0 ? (v / row.metaCobertura) * 100 : 0;
    return (
      <span className="num" style={{ fontWeight: 600, color: pct >= 80 ? '#3DD68C' : pct >= 70 ? t.text : t.primaryHover }}>
        {v} cli <span style={{ fontSize: '11px', fontWeight: 500, opacity: 0.85 }}>({pct.toFixed(0)}%)</span>
      </span>
    );
  }
  if (metricKey === 'crescimento')
    return <span className="num" style={{ fontWeight: 600, color: v >= 0 ? '#3DD68C' : t.primaryHover }}>{v >= 0 ? '+' : ''}{typeof v === 'number' ? `${v.toFixed(1)}%` : `${v}%`}</span>;
  if (metricKey === 'participacao') return <span className="num">{typeof v === 'number' ? `${v.toFixed(1)}%` : `${v}%`}</span>;
  return <span>{v}</span>;
}

export const AnalisesPage: React.FC = () => {
  const { t } = useTheme();
  const { currentUser } = useAuth();
  const { selectedPeriod, periodMetrics } = useGlobalFilter();
  const [activeMetrics, setActiveMetrics] = useState(['meta', 'realizado', 'gap', 'atingimento', 'metaCobertura', 'realizadoCobertura']);
  const [expanded, setExpanded] = useState<Set<string>>(new Set(['ARCOR']));

  const toggleMetric = (key: string) =>
    setActiveMetrics((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));

  const toggleExpand = (path: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });

  // RBAC filtering of dados
  const dadosFiltrados = useMemo(() => {
    if (!currentUser || currentUser.role === 'ADMIN' || currentUser.role === 'GERENTE') {
      return dados;
    }
    if (currentUser.role === 'SUPERVISOR') {
      const equipeNome = currentUser.team || 'TRAB ALFA';
      return dados
        .map((f) => ({
          ...f,
          equipes: f.equipes.filter((eq) => eq.nome === equipeNome),
        }))
        .filter((f) => f.equipes.length > 0);
    }
    if (currentUser.role === 'VENDEDOR') {
      const vendedorNome = currentUser.name;
      return dados
        .map((f) => ({
          ...f,
          equipes: f.equipes
            .map((eq) => ({
              ...eq,
              vendedores: eq.vendedores.filter((v) => v.nome === vendedorNome || v.nome === 'Vendedor 003'),
            }))
            .filter((eq) => eq.vendedores.length > 0),
        }))
        .filter((f) => f.equipes.length > 0);
    }
    return dados;
  }, [currentUser]);

  // Gráfico 2: Meta x Realizado — com todos os fabricantes
  const metaRealizadoChartData = useMemo(() => {
    return dados.map((f) => {
      const row = computeRow(f);
      return {
        nome: f.nome,
        meta: Math.round(row.meta / 1000),
        realizado: Math.round(row.realizado / 1000),
        atingimento: row.atingimento.toFixed(1),
      };
    });
  }, []);

  // Gráfico 3: Cobertura — considerando todos os fabricantes
  const coberturaFabricantesChartData = useMemo(() => {
    return dados.map((f) => {
      const row = computeRow(f);
      return {
        nome: f.nome,
        metaCobertura: row.metaCobertura,
        realizado: row.realizadoCobertura,
        atingimento: row.metaCobertura > 0 ? ((row.realizadoCobertura / row.metaCobertura) * 100).toFixed(1) : '0.0',
      };
    });
  }, []);

  // Gráfico de Cobertura ao longo do tempo
  const coberturaChartData = useMemo(() => {
    return [
      { mes: 'Abr', atendidos: 1190, naoAtendidos: 652, coberturaPct: 64.6 },
      { mes: 'Mai', atendidos: 1225, naoAtendidos: 617, coberturaPct: 66.5 },
      { mes: 'Jun', atendidos: 1260, naoAtendidos: 582, coberturaPct: 68.4 },
      { mes: 'Jul', atendidos: 1294, naoAtendidos: 548, coberturaPct: 70.3 },
      { mes: 'Ago', atendidos: 1310, naoAtendidos: 532, coberturaPct: 71.1 },
      { mes: 'Set', atendidos: periodMetrics?.clientesPositivados ?? 1342, naoAtendidos: periodMetrics?.clientesNaoPositivados ?? 500, coberturaPct: periodMetrics?.positivacaoPct ?? 72.9 },
    ];
  }, [periodMetrics]);

  const totalClientes = periodMetrics?.clientesTotal ?? 1842;
  const clientesAtendidos = periodMetrics?.clientesPositivados ?? 1320;
  const clientesNaoAtendidos = periodMetrics?.clientesNaoPositivados ?? 522;
  const percentualCobertura = periodMetrics?.positivacaoPct ?? (totalClientes > 0 ? (clientesAtendidos / totalClientes) * 100 : 71.7);

  const exportToExcel = () => {
    const rows: any[] = [];
    dadosFiltrados.forEach((f) => {
      const fRow = computeRow(f);
      rows.push({
        Nível: 'Fabricante',
        Nome: f.nome,
        Meta: fRow.meta,
        Realizado: fRow.realizado,
        GAP: fRow.gap,
        Atingimento: `${fRow.atingimento.toFixed(1)}%`,
        'Meta de Cobertura': fRow.metaCobertura,
        'Realizado Cobertura': fRow.realizadoCobertura,
      });
      f.equipes.forEach((eq) => {
        const eqRow = computeRow(eq);
        rows.push({
          Nível: 'Equipe',
          Nome: `${f.nome} > ${eq.nome}`,
          Meta: eqRow.meta,
          Realizado: eqRow.realizado,
          GAP: eqRow.gap,
          Atingimento: `${eqRow.atingimento.toFixed(1)}%`,
          'Meta de Cobertura': eqRow.metaCobertura,
          'Realizado Cobertura': eqRow.realizadoCobertura,
        });
      });
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Análises');
    XLSX.writeFile(wb, `chok_analises_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 className="num" style={{ margin: '0 0 4px', fontSize: '22px', fontWeight: 700, color: t.text }}>
            Análises
          </h2>
          <div style={{ fontSize: '12.5px', color: t.textMuted }}>
            Análise de cobertura da carteira, comparativo Meta x Realizado e matriz analítica hierárquica · Período: <strong>{selectedPeriod}</strong>
          </div>
        </div>

        <PeriodSelector />
      </div>

      {/* 1. ANÁLISE DE COBERTURA (Cards da Carteira) */}
      <div>
        <div style={{ fontSize: '15px', fontWeight: 600, color: t.text, marginBottom: '12px' }}>
          1. Análise de Cobertura da Carteira
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '14px',
          }}
        >
          <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: '12px', padding: '18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '13px', color: t.textSecondary }}>Total de clientes</span>
              <Users size={18} color={t.accentBlue} />
            </div>
            <div className="num" style={{ fontSize: '26px', fontWeight: 700, color: t.text }}>
              {totalClientes.toLocaleString('pt-BR')}
            </div>
            <div style={{ fontSize: '11.5px', color: t.textMuted, marginTop: '4px' }}>
              Base cadastral ativa
            </div>
          </div>

          <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: '12px', padding: '18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '13px', color: t.textSecondary }}>Clientes atendidos</span>
              <CheckCircle2 size={18} color="#3DD68C" />
            </div>
            <div className="num" style={{ fontSize: '26px', fontWeight: 700, color: '#3DD68C' }}>
              {clientesAtendidos.toLocaleString('pt-BR')}
            </div>
            <div style={{ fontSize: '11.5px', color: t.textMuted, marginTop: '4px' }}>
              Clientes positivados no período
            </div>
          </div>

          <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: '12px', padding: '18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '13px', color: t.textSecondary }}>Clientes não atendidos</span>
              <XCircle size={18} color={t.primaryHover} />
            </div>
            <div className="num" style={{ fontSize: '26px', fontWeight: 700, color: t.primaryHover }}>
              {clientesNaoAtendidos.toLocaleString('pt-BR')}
            </div>
            <div style={{ fontSize: '11.5px', color: t.textMuted, marginTop: '4px' }}>
              Oportunidade de positivação
            </div>
          </div>

          <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: '12px', padding: '18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '13px', color: t.textSecondary }}>Percentual de cobertura</span>
              <Percent size={18} color={t.accentPurple} />
            </div>
            <div className="num" style={{ fontSize: '26px', fontWeight: 700, color: t.text }}>
              {percentualCobertura.toFixed(1)}%
            </div>
            <div style={{ height: '6px', width: '100%', background: t.border, borderRadius: '4px', marginTop: '8px', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${Math.min(100, percentualCobertura)}%`, background: t.primary, borderRadius: '4px' }} />
            </div>
          </div>
        </div>
      </div>

      {/* 2. GRÁFICO META X REALIZADO (TODOS OS FABRICANTES) */}
      <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: '12px', padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
          <div>
            <div style={{ fontSize: '14.5px', fontWeight: 600, color: t.text }}>2. Gráfico Meta x Realizado</div>
            <div style={{ fontSize: '12px', color: t.textMuted }}>Comparativo comercial considerando todos os fabricantes (em R$ mil)</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '12px', color: t.textSecondary }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: t.borderActive }} />
              <span>Meta</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: t.primary }} />
              <span>Realizado</span>
            </div>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={metaRealizadoChartData} barGap={6}>
            <CartesianGrid vertical={false} stroke={t.border} strokeDasharray="3 3" />
            <XAxis dataKey="nome" tick={{ fill: t.textMuted, fontSize: 12 }} axisLine={{ stroke: t.border }} tickLine={false} />
            <YAxis tick={{ fill: t.textMuted, fontSize: 12 }} axisLine={false} tickLine={false} width={42} />
            <Tooltip
              contentStyle={{ background: t.surfaceElevated, border: `1px solid ${t.border}`, borderRadius: 8, fontSize: 12.5 }}
              labelStyle={{ color: t.text, fontWeight: 600 }}
              itemStyle={{ color: t.textSecondary }}
              formatter={(value: any, name: any) => [`R$ ${value} mil`, name === 'meta' ? 'Meta' : 'Realizado']}
            />
            <Bar dataKey="meta" fill={t.borderActive} radius={[4, 4, 0, 0]} name="Meta" />
            <Bar dataKey="realizado" fill={t.primary} radius={[4, 4, 0, 0]} name="Realizado" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* 3. GRÁFICO DE COBERTURA (POSICIONADO LOGO ABAIXO DO SEGUNDO GRÁFICO - TODOS OS FABRICANTES) */}
      <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: '12px', padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
          <div>
            <div style={{ fontSize: '14.5px', fontWeight: 600, color: t.text }}>3. Gráfico de Cobertura</div>
            <div style={{ fontSize: '12px', color: t.textMuted }}>
              Meta de cobertura x Clientes atendidos considerando todos os fabricantes
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', fontSize: '12px', color: t.textSecondary, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: t.borderActive }} />
              <span>Meta Cobertura (cli)</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: t.accentBlue }} />
              <span>Realizado (cli)</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#3DD68C', fontWeight: 600, marginLeft: '4px' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#3DD68C' }} />
              <span>{percentualCobertura.toFixed(1)}% consolidado</span>
            </div>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={coberturaFabricantesChartData} barGap={6}>
            <CartesianGrid vertical={false} stroke={t.border} strokeDasharray="3 3" />
            <XAxis dataKey="nome" tick={{ fill: t.textMuted, fontSize: 12 }} axisLine={{ stroke: t.border }} tickLine={false} />
            <YAxis tick={{ fill: t.textMuted, fontSize: 12 }} axisLine={false} tickLine={false} width={42} />
            <Tooltip
              contentStyle={{ background: t.surfaceElevated, border: `1px solid ${t.border}`, borderRadius: 8, fontSize: 12.5 }}
              labelStyle={{ color: t.text, fontWeight: 600 }}
              formatter={(val: any, name: any, item: any) => [
                `${val} clientes ${name === 'realizado' ? `(${item.payload.atingimento}%)` : ''}`,
                name === 'metaCobertura' ? 'Meta de Cobertura' : 'Realizado',
              ]}
            />
            <Bar dataKey="metaCobertura" fill={t.borderActive} radius={[4, 4, 0, 0]} name="Meta Cobertura" />
            <Bar dataKey="realizado" fill={t.accentBlue} radius={[4, 4, 0, 0]} name="Realizado" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* 4. MATRIZ ANALÍTICA & DRILL-DOWN */}
      <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: '12px', overflow: 'hidden' }}>
        <div style={{ padding: '18px 20px', borderBottom: `1px solid ${t.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <div style={{ fontSize: '15px', fontWeight: 600, color: t.text }}>4. Matriz Analítica Hierárquica</div>
            <div style={{ fontSize: '12px', color: t.textMuted }}>Drill-Down Fabricante → Equipe → Vendedor com consolidação de métricas</div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {METRICAS.map((m) => {
                const on = activeMetrics.includes(m.key);
                return (
                  <div
                    key={m.key}
                    onClick={() => toggleMetric(m.key)}
                    style={{
                      fontSize: '12px',
                      padding: '5px 10px',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      border: `1px solid ${on ? t.primary : t.border}`,
                      background: on ? `${t.primary}18` : t.surfaceElevated,
                      color: on ? t.primary : t.textSecondary,
                      fontWeight: on ? 600 : 500,
                    }}
                  >
                    {m.label}
                  </div>
                );
              })}
            </div>

            <button
              onClick={exportToExcel}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '7px',
                fontSize: '12.5px',
                fontWeight: 600,
                padding: '7px 12px',
                borderRadius: '8px',
                border: `1px solid ${t.border}`,
                background: t.surfaceElevated,
                color: t.text,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              <Download size={14} color={t.primary} />
              <span>Exportar Excel</span>
            </button>
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ color: t.textMuted }}>
                <th style={{ textAlign: 'left', padding: '12px 16px', borderBottom: `1px solid ${t.border}`, fontWeight: 500, background: t.bgSecondary }}>
                  Fabricante / Equipe / Vendedor
                </th>
                {activeMetrics.map((mk) => (
                  <th key={mk} style={{ textAlign: 'right', padding: '12px 16px', borderBottom: `1px solid ${t.border}`, fontWeight: 500, whiteSpace: 'nowrap', background: t.bgSecondary }}>
                    {METRICAS.find((m) => m.key === mk)?.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dadosFiltrados.map((f) => {
                const fRow = computeRow(f);
                const fOpen = expanded.has(f.nome);
                return (
                  <Fragment key={f.nome}>
                    <tr
                      onClick={() => toggleExpand(f.nome)}
                      style={{ borderBottom: `1px solid ${t.border}`, cursor: 'pointer', background: fOpen ? `${t.surfaceElevated}` : 'transparent' }}
                    >
                      <td style={{ padding: '12px 16px', fontWeight: 700, color: t.text }}>
                        <span style={{ display: 'inline-block', transform: fOpen ? 'rotate(90deg)' : 'none', transition: 'transform .15s ease', marginRight: 8, color: t.primary }}>
                          ›
                        </span>
                        {f.nome}
                      </td>
                      {activeMetrics.map((mk) => (
                        <td key={mk} style={{ padding: '12px 16px', textAlign: 'right' }}>
                          <MetricCell metricKey={mk} row={fRow} />
                        </td>
                      ))}
                    </tr>
                    {fOpen &&
                      f.equipes.map((eq) => {
                        const eRow = computeRow(eq);
                        const ePath = `${f.nome}|${eq.nome}`;
                        const eOpen = expanded.has(ePath);
                        return (
                          <Fragment key={ePath}>
                            <tr
                              onClick={() => toggleExpand(ePath)}
                              style={{ borderBottom: `1px solid ${t.border}`, cursor: 'pointer', background: t.surface }}
                            >
                              <td style={{ padding: '10px 16px 10px 36px', fontWeight: 600, color: t.textSecondary }}>
                                <span style={{ display: 'inline-block', transform: eOpen ? 'rotate(90deg)' : 'none', transition: 'transform .15s ease', marginRight: 8, color: t.textMuted }}>
                                  ›
                                </span>
                                {eq.nome}
                              </td>
                              {activeMetrics.map((mk) => (
                                <td key={mk} style={{ padding: '10px 16px', textAlign: 'right' }}>
                                  <MetricCell metricKey={mk} row={eRow} />
                                </td>
                              ))}
                            </tr>
                            {eOpen &&
                              eq.vendedores.map((v) => {
                                const vRow = computeRow(v);
                                return (
                                  <tr key={`${ePath}|${v.nome}`} style={{ borderBottom: `1px solid ${t.border}`, background: t.bgSecondary }}>
                                    <td style={{ padding: '9px 16px 9px 60px', color: t.textMuted }}>
                                      {v.nome}
                                    </td>
                                    {activeMetrics.map((mk) => (
                                      <td key={mk} style={{ padding: '9px 16px', textAlign: 'right' }}>
                                        <MetricCell metricKey={mk} row={vRow} />
                                      </td>
                                    ))}
                                  </tr>
                                );
                              })}
                          </Fragment>
                        );
                      })}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
