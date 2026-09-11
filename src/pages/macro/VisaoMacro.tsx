import React, { useState, useMemo } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import {
  ComparisonSelector,
  ComparisonConfig,
} from '../../components/common/ComparisonSelector';
import { MultiSelectFilter } from '../../components/common/MultiSelectFilter';
import { ExportExcelButton } from '../../components/common/ExportExcelButton';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  ChevronRight,
  Filter,
  BarChart3,
  Layers,
  Users,
  Package,
  Award,
} from 'lucide-react';

const FABRICANTES = ['ARCOR', 'HEINZ', 'NESTLÉ', 'UNILEVER'];
const GERENCIAS = ['TRAD', 'AS'];
const EQUIPES = ['TRAB ALFA', 'TRAB BETA', 'TRAB GAMA'];
const VENDEDORES = [
  'Vendedor 003',
  'Vendedor 004',
  'Vendedor 011',
  'Vendedor 012',
  'Vendedor 020',
];

const fmtR = (v: number) =>
  `R$ ${Math.round(v).toLocaleString('pt-BR')}`;

const fmtShortR = (v: number) => {
  if (v >= 1000000) return `R$ ${(v / 1000000).toFixed(2)}M`;
  if (v >= 1000) return `R$ ${(v / 1000).toFixed(0)}k`;
  return `R$ ${v}`;
};

export const VisaoMacroPage: React.FC = () => {
  const { t } = useTheme();
  const { currentUser } = useAuth();

  // Comparison State
  const [comparisonConfig, setComparisonConfig] = useState<ComparisonConfig>({
    granularity: 'ano',
    mode: 'ano_vs_ano',
    periodA: '2026',
    periodB: '2025',
    labelA: 'Ano 2026',
    labelB: 'Ano 2025',
    yearA: 2026,
    yearB: 2025,
  });

  // Multi-select filters
  const [selectedFabricantes, setSelectedFabricantes] = useState<string[]>([]);
  const [selectedGerencias, setSelectedGerencias] = useState<string[]>([]);
  const [selectedEquipes, setSelectedEquipes] = useState<string[]>([]);
  const [selectedVendedores, setSelectedVendedores] = useState<string[]>([]);

  // Dimension drill-down in breakdown table
  const [activeDimension, setActiveDimension] = useState<
    'fabricante' | 'gerencia' | 'equipe' | 'vendedor'
  >('fabricante');

  // Heatmap dimension view
  const [heatmapType, setHeatmapType] = useState<'equipe' | 'mes'>('equipe');

  // Macro Metrics
  const macroSummary = useMemo(() => {
    // Dynamic calculation reacting to comparison periods and active filters
    let baseA = 43000000;
    let baseB = 38900000;

    const gran = comparisonConfig.granularity || 'ano';
    if (gran === 'dia') {
      if (comparisonConfig.mode === 'periodo_dias') {
        baseA = 1450000;
        baseB = 1320000;
      } else {
        baseA = 145000;
        baseB = 138000;
      }
    } else if (gran === 'mes') {
      if (comparisonConfig.mode === 'periodo_meses') {
        const sM = comparisonConfig.startMonth || 1;
        const eM = comparisonConfig.endMonth || 9;
        const span = Math.max(1, eM - sM + 1);
        baseA = 3600000 * span;
        baseB = 3250000 * span;
      } else {
        const mA = comparisonConfig.monthA || 9;
        const mB = comparisonConfig.monthB || 8;
        const monthWeights = [3.2, 3.4, 3.8, 3.5, 3.9, 3.7, 3.85, 4.8, 3.21, 4.1, 4.3, 4.9];
        baseA = Math.round((monthWeights[(mA - 1) % 12] || 3.5) * 1000000);
        baseB = Math.round((monthWeights[(mB - 1) % 12] || 3.2) * 1000000 * 0.92);
      }
    } else {
      const yA = comparisonConfig.yearA || Number(comparisonConfig.periodA) || 2026;
      const yB = comparisonConfig.yearB || Number(comparisonConfig.periodB) || 2025;
      const yearValues: Record<number, number> = {
        2026: 43000000,
        2025: 38900000,
        2024: 35200000,
        2023: 31800000,
        2022: 28500000,
        2021: 25000000,
      };
      baseA = yearValues[yA] || 40000000;
      baseB = yearValues[yB] || 36000000;
    }

    // Filter ratio
    let filterRatio = 1.0;
    if (selectedFabricantes.length > 0) {
      filterRatio *= selectedFabricantes.length / FABRICANTES.length;
    }
    if (selectedGerencias.length > 0) {
      filterRatio *= selectedGerencias.length / GERENCIAS.length;
    }
    if (selectedEquipes.length > 0) {
      filterRatio *= selectedEquipes.length / EQUIPES.length;
    }
    if (selectedVendedores.length > 0) {
      filterRatio *= selectedVendedores.length / VENDEDORES.length;
    }

    const realA = Math.round(baseA * filterRatio);
    const realB = Math.round(baseB * filterRatio);
    const metaA = Math.round(realA * 1.065);
    const metaB = Math.round(realB * 1.05);
    const diff = realA - realB;
    const growth = realB > 0 ? ((realA - realB) / realB) * 100 : 0;
    const atingA = metaA > 0 ? (realA / metaA) * 100 : 0;
    const atingB = metaB > 0 ? (realB / metaB) * 100 : 0;
    const gapA = realA - metaA;

    return {
      realA,
      realB,
      metaA,
      metaB,
      diff,
      growth,
      atingA,
      atingB,
      gapA,
      pedidosA: Math.round(realA / 3200),
      pedidosB: Math.round(realB / 3100),
      ticketA: Math.round(3200 * (1 + growth / 400)),
      ticketB: 3100,
      positivadosA: Math.round(1450 * filterRatio) || 280,
      positivadosB: Math.round(1380 * filterRatio) || 260,
    };
  }, [
    comparisonConfig,
    selectedFabricantes,
    selectedGerencias,
    selectedEquipes,
    selectedVendedores,
  ]);

  // Evolution comparison chart
  const evolutionChartData = useMemo(() => {
    const gran = comparisonConfig.granularity || 'ano';

    if (gran === 'dia') {
      if (comparisonConfig.mode === 'periodo_dias') {
        const days = ['D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7', 'D8', 'D9', 'D10'];
        const dataA = [14.2, 15.5, 13.8, 16.0, 14.8, 15.2, 13.0, 16.5, 14.5, 15.8];
        const dataB = [13.0, 14.0, 13.2, 14.5, 13.5, 13.8, 12.0, 15.0, 13.6, 14.2];
        return days.map((d, idx) => ({
          mes: d,
          [comparisonConfig.labelA]: Number((dataA[idx] / 10).toFixed(2)),
          [comparisonConfig.labelB]: Number((dataB[idx] / 10).toFixed(2)),
        }));
      } else {
        const hours = ['08h', '10h', '12h', '14h', '16h', '18h', '20h'];
        const dataA = [1.5, 2.8, 2.2, 3.5, 2.6, 1.4, 0.5];
        const dataB = [1.2, 2.4, 2.0, 3.1, 2.2, 1.2, 0.4];
        return hours.map((h, idx) => ({
          mes: h,
          [comparisonConfig.labelA]: dataA[idx],
          [comparisonConfig.labelB]: dataB[idx],
        }));
      }
    }

    if (gran === 'mes' && comparisonConfig.mode !== 'periodo_meses') {
      const weeks = ['Sem 1', 'Sem 2', 'Sem 3', 'Sem 4'];
      const dataA = [0.78, 0.85, 0.72, 0.86];
      const dataB = [0.70, 0.78, 0.69, 0.78];
      return weeks.map((w, idx) => ({
        mes: w,
        [comparisonConfig.labelA]: dataA[idx],
        [comparisonConfig.labelB]: dataB[idx],
      }));
    }

    const months = [
      'Jan',
      'Fev',
      'Mar',
      'Abr',
      'Mai',
      'Jun',
      'Jul',
      'Ago',
      'Set',
      'Out',
      'Nov',
      'Dez',
    ];
    const dataA = [3.2, 3.4, 3.8, 3.5, 3.9, 3.7, 3.85, 4.8, 3.21, 4.1, 4.3, 4.9];
    const dataB = [2.9, 3.0, 3.3, 3.2, 3.5, 3.4, 3.5, 4.25, 2.95, 3.8, 4.0, 4.6];

    return months.map((m, idx) => ({
      mes: m,
      [comparisonConfig.labelA]: dataA[idx],
      [comparisonConfig.labelB]: dataB[idx],
    }));
  }, [comparisonConfig]);

  // Breakdown dimension list
  const breakdownRows = useMemo(() => {
    let items: { name: string; share: number }[] = [];

    if (activeDimension === 'fabricante') {
      items = [
        { name: 'ARCOR', share: 0.32 },
        { name: 'HEINZ', share: 0.28 },
        { name: 'NESTLÉ', share: 0.25 },
        { name: 'UNILEVER', share: 0.15 },
      ];
    } else if (activeDimension === 'gerencia') {
      items = [
        { name: 'TRAD (Tradicional)', share: 0.65 },
        { name: 'AS (Auto Serviço)', share: 0.35 },
      ];
    } else if (activeDimension === 'equipe') {
      items = [
        { name: 'TRAB ALFA', share: 0.42 },
        { name: 'TRAB BETA', share: 0.36 },
        { name: 'TRAB GAMA', share: 0.22 },
      ];
    } else {
      items = [
        { name: 'Vendedor 003 (Carlos Silva)', share: 0.26 },
        { name: 'Vendedor 011 (Marcos Souza)', share: 0.24 },
        { name: 'Vendedor 020 (Renata Lima)', share: 0.2 },
        { name: 'Vendedor 004 (João Pereira)', share: 0.16 },
        { name: 'Vendedor 012 (Felipe Rocha)', share: 0.14 },
      ];
    }

    return items.map((it) => {
      const vA = Math.round(macroSummary.realA * it.share);
      const vB = Math.round(macroSummary.realB * it.share * 0.94);
      const varR = vA - vB;
      const varPct = vB > 0 ? ((vA - vB) / vB) * 100 : 0;
      return {
        dim: it.name,
        periodA: vA,
        periodB: vB,
        varR,
        varPct,
      };
    });
  }, [activeDimension, macroSummary]);

  // Top Clientes Comparison
  const topClientesComparison = useMemo(() => {
    return [
      {
        posA: 1,
        posB: 1,
        nome: 'Mercado Bom Preço',
        equipe: 'TRAB ALFA',
        vA: Math.round(macroSummary.realA * 0.055),
        vB: Math.round(macroSummary.realB * 0.048),
      },
      {
        posA: 2,
        posB: 4,
        nome: 'Distribuidora Vitória',
        equipe: 'TRAB BETA',
        vA: Math.round(macroSummary.realA * 0.048),
        vB: Math.round(macroSummary.realB * 0.038),
      },
      {
        posA: 3,
        posB: 2,
        nome: 'Atacado Central',
        equipe: 'TRAB ALFA',
        vA: Math.round(macroSummary.realA * 0.044),
        vB: Math.round(macroSummary.realB * 0.043),
      },
      {
        posA: 4,
        posB: 3,
        nome: 'Rede Sabor & Cia',
        equipe: 'TRAB GAMA',
        vA: Math.round(macroSummary.realA * 0.039),
        vB: Math.round(macroSummary.realB * 0.04),
      },
      {
        posA: 5,
        posB: 7,
        nome: 'Comercial Nova Era',
        equipe: 'TRAB BETA',
        vA: Math.round(macroSummary.realA * 0.036),
        vB: Math.round(macroSummary.realB * 0.029),
      },
    ].map((c) => {
      const varPct = c.vB > 0 ? ((c.vA - c.vB) / c.vB) * 100 : 0;
      return { ...c, varPct };
    });
  }, [macroSummary]);

  // Products Comparison
  const produtosComparison = useMemo(() => {
    return [
      {
        codigo: 'A-1042',
        nome: 'Bala de goma 500g Sortida',
        fabricante: 'ARCOR',
        categoria: 'Doces',
        vA: Math.round(macroSummary.realA * 0.032),
        vB: Math.round(macroSummary.realB * 0.027),
        share: 3.2,
      },
      {
        codigo: 'A-1088',
        nome: 'Chocolate ao leite 900g Tablete',
        fabricante: 'ARCOR',
        categoria: 'Chocolates',
        vA: Math.round(macroSummary.realA * 0.029),
        vB: Math.round(macroSummary.realB * 0.025),
        share: 2.9,
      },
      {
        codigo: 'H-2210',
        nome: 'Ketchup Tradicional 1kg Bag',
        fabricante: 'HEINZ',
        categoria: 'Condimentos',
        vA: Math.round(macroSummary.realA * 0.038),
        vB: Math.round(macroSummary.realB * 0.031),
        share: 3.8,
      },
      {
        codigo: 'H-2255',
        nome: 'Maionese Especial 500g Squeeze',
        fabricante: 'HEINZ',
        categoria: 'Condimentos',
        vA: Math.round(macroSummary.realA * 0.026),
        vB: Math.round(macroSummary.realB * 0.024),
        share: 2.6,
      },
      {
        codigo: 'N-3301',
        nome: 'Achocolatado em Pó 400g Lata',
        fabricante: 'NESTLÉ',
        categoria: 'Bebidas',
        vA: Math.round(macroSummary.realA * 0.034),
        vB: Math.round(macroSummary.realB * 0.03),
        share: 3.4,
      },
    ].map((p) => ({
      ...p,
      varPct: p.vB > 0 ? ((p.vA - p.vB) / p.vB) * 100 : 0,
    }));
  }, [macroSummary]);

  // Prepare multi-sheet Excel data
  const handlePrepareExcelData = () => {
    const resumoData = [
      {
        Métrica: 'Realizado Período A',
        Valor: fmtR(macroSummary.realA),
        Referência: comparisonConfig.labelA,
      },
      {
        Métrica: 'Realizado Período B',
        Valor: fmtR(macroSummary.realB),
        Referência: comparisonConfig.labelB,
      },
      {
        Métrica: 'Crescimento %',
        Valor: `${macroSummary.growth.toFixed(2)}%`,
        Referência: 'Variação Relativa',
      },
      {
        Métrica: 'Variação Financeira',
        Valor: fmtR(macroSummary.diff),
        Referência: 'A vs B',
      },
      {
        Métrica: 'Meta Período A',
        Valor: fmtR(macroSummary.metaA),
        Referência: comparisonConfig.labelA,
      },
      {
        Métrica: 'Atingimento Período A',
        Valor: `${macroSummary.atingA.toFixed(1)}%`,
        Referência: 'Atingimento da Meta',
      },
      {
        Métrica: 'Positivação Clientes',
        Valor: macroSummary.positivadosA,
        Referência: 'Cobertura',
      },
      {
        Métrica: 'Ticket Médio',
        Valor: fmtR(macroSummary.ticketA),
        Referência: 'Por pedido',
      },
    ];

    const comparacaoData = breakdownRows.map((r) => ({
      Dimensão: r.dim,
      [comparisonConfig.labelA]: r.periodA,
      [comparisonConfig.labelB]: r.periodB,
      'Variação R$': r.varR,
      'Crescimento %': Number(r.varPct.toFixed(2)),
    }));

    const topClientesData = topClientesComparison.map((c) => ({
      [`Posição ${comparisonConfig.labelA}`]: c.posA,
      [`Posição ${comparisonConfig.labelB}`]: c.posB,
      Cliente: c.nome,
      Equipe: c.equipe,
      [comparisonConfig.labelA]: c.vA,
      [comparisonConfig.labelB]: c.vB,
      'Crescimento %': Number(c.varPct.toFixed(2)),
    }));

    const produtosData = produtosComparison.map((p) => ({
      Código: p.codigo,
      Produto: p.nome,
      Fabricante: p.fabricante,
      Categoria: p.categoria,
      [comparisonConfig.labelA]: p.vA,
      [comparisonConfig.labelB]: p.vB,
      'Crescimento %': Number(p.varPct.toFixed(2)),
      'Participação %': p.share,
    }));

    return [
      { sheetName: 'Resumo', data: resumoData },
      { sheetName: 'Comparação Analítica', data: comparacaoData },
      { sheetName: 'Top Clientes', data: topClientesData },
      { sheetName: 'Produtos', data: produtosData },
    ];
  };

  return (
    <div>
      {/* Header & Controls */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '20px',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div>
          <h1
            className="num"
            style={{
              margin: '0 0 4px',
              fontSize: '24px',
              fontWeight: 700,
              color: t.text,
            }}
          >
            Visão Macro & Comparação Estratégica
          </h1>
          <p
            style={{
              margin: 0,
              fontSize: '13px',
              color: t.textSecondary,
            }}
          >
            Análise evolutiva histórica, cruzamento sazonal e inteligência
            comparativa de desempenho.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <ExportExcelButton
            filename={`Visao_Macro_${comparisonConfig.periodA}_vs_${comparisonConfig.periodB}.xlsx`}
            onPrepareData={handlePrepareExcelData}
            label="Exportar Visão Macro"
          />
        </div>
      </div>

      {/* COMPARISON SELECTOR BAR */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: t.surface,
          border: `1px solid ${t.border}`,
          borderRadius: '12px',
          padding: '12px 16px',
          marginBottom: '20px',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <ComparisonSelector
          config={comparisonConfig}
          onChange={setComparisonConfig}
        />

        {/* Multi-Select Filters */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <MultiSelectFilter
            label="Fabricante"
            options={FABRICANTES}
            selected={selectedFabricantes}
            onChange={setSelectedFabricantes}
          />
          <MultiSelectFilter
            label="Gerência"
            options={GERENCIAS}
            selected={selectedGerencias}
            onChange={setSelectedGerencias}
          />
          <MultiSelectFilter
            label="Equipe"
            options={EQUIPES}
            selected={selectedEquipes}
            onChange={setSelectedEquipes}
          />
          <MultiSelectFilter
            label="Vendedor"
            options={VENDEDORES}
            selected={selectedVendedores}
            onChange={setSelectedVendedores}
          />
        </div>
      </div>

      {/* STRATEGIC KPIS CARDS (Requirement 16) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
          gap: '14px',
          marginBottom: '24px',
        }}
      >
        {/* Realizado A vs B */}
        <div
          style={{
            background: t.surface,
            border: `1px solid ${t.border}`,
            borderRadius: '12px',
            padding: '18px',
          }}
        >
          <div
            style={{
              fontSize: '12px',
              fontWeight: 600,
              color: t.textSecondary,
              textTransform: 'uppercase',
              marginBottom: '6px',
            }}
          >
            Faturamento Realizado
          </div>
          <div
            className="num"
            style={{
              fontSize: '24px',
              fontWeight: 700,
              color: t.text,
              marginBottom: '6px',
            }}
          >
            {fmtShortR(macroSummary.realA)}
          </div>
          <div
            style={{
              fontSize: '12px',
              color: t.textMuted,
              display: 'flex',
              justifyContent: 'space-between',
            }}
          >
            <span>vs {comparisonConfig.labelB}:</span>
            <span className="num" style={{ fontWeight: 600, color: t.textSecondary }}>
              {fmtShortR(macroSummary.realB)}
            </span>
          </div>
        </div>

        {/* Crescimento % */}
        <div
          style={{
            background: t.surface,
            border: `1px solid ${t.border}`,
            borderRadius: '12px',
            padding: '18px',
          }}
        >
          <div
            style={{
              fontSize: '12px',
              fontWeight: 600,
              color: t.textSecondary,
              textTransform: 'uppercase',
              marginBottom: '6px',
            }}
          >
            Crescimento Período
          </div>
          <div
            className="num"
            style={{
              fontSize: '24px',
              fontWeight: 700,
              color: macroSummary.growth >= 0 ? '#3DD68C' : t.primaryHover,
              marginBottom: '6px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            {macroSummary.growth >= 0 ? (
              <TrendingUp size={22} color="#3DD68C" />
            ) : (
              <TrendingDown size={22} color={t.primaryHover} />
            )}
            {macroSummary.growth >= 0 ? '+' : ''}
            {macroSummary.growth.toFixed(1)}%
          </div>
          <div
            style={{
              fontSize: '12px',
              color: t.textMuted,
              display: 'flex',
              justifyContent: 'space-between',
            }}
          >
            <span>Variação financeira:</span>
            <span className="num" style={{ fontWeight: 600, color: t.text }}>
              {macroSummary.diff >= 0 ? '+' : ''}
              {fmtShortR(macroSummary.diff)}
            </span>
          </div>
        </div>

        {/* Meta e Atingimento */}
        <div
          style={{
            background: t.surface,
            border: `1px solid ${t.border}`,
            borderRadius: '12px',
            padding: '18px',
          }}
        >
          <div
            style={{
              fontSize: '12px',
              fontWeight: 600,
              color: t.textSecondary,
              textTransform: 'uppercase',
              marginBottom: '6px',
            }}
          >
            Meta e Atingimento ({comparisonConfig.periodA})
          </div>
          <div
            className="num"
            style={{
              fontSize: '24px',
              fontWeight: 700,
              color:
                macroSummary.atingA >= 95
                  ? '#3DD68C'
                  : macroSummary.atingA >= 85
                  ? t.text
                  : t.primaryHover,
              marginBottom: '6px',
            }}
          >
            {macroSummary.atingA.toFixed(1)}%
          </div>
          <div
            style={{
              fontSize: '12px',
              color: t.textMuted,
              display: 'flex',
              justifyContent: 'space-between',
            }}
          >
            <span>Meta: {fmtShortR(macroSummary.metaA)}</span>
            <span style={{ color: t.primaryHover }}>GAP: {fmtShortR(macroSummary.gapA)}</span>
          </div>
        </div>

        {/* Positivação & Ticket */}
        <div
          style={{
            background: t.surface,
            border: `1px solid ${t.border}`,
            borderRadius: '12px',
            padding: '18px',
          }}
        >
          <div
            style={{
              fontSize: '12px',
              fontWeight: 600,
              color: t.textSecondary,
              textTransform: 'uppercase',
              marginBottom: '6px',
            }}
          >
            Clientes & Ticket Médio
          </div>
          <div
            className="num"
            style={{
              fontSize: '24px',
              fontWeight: 700,
              color: t.text,
              marginBottom: '6px',
            }}
          >
            {macroSummary.positivadosA}{' '}
            <span style={{ fontSize: '13px', color: t.textMuted, fontWeight: 400 }}>
              positivados
            </span>
          </div>
          <div
            style={{
              fontSize: '12px',
              color: t.textMuted,
              display: 'flex',
              justifyContent: 'space-between',
            }}
          >
            <span>Ticket médio:</span>
            <span className="num" style={{ fontWeight: 600, color: t.text }}>
              {fmtR(macroSummary.ticketA)}
            </span>
          </div>
        </div>
      </div>

      {/* CHARTS ROW (Requirement 17, 18) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1.4fr 1fr',
          gap: '16px',
          marginBottom: '24px',
        }}
        className="macro-charts-grid"
      >
        {/* Line Chart: Sazonalidade / Evolução Anual */}
        <div
          style={{
            background: t.surface,
            border: `1px solid ${t.border}`,
            borderRadius: '12px',
            padding: '20px',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              marginBottom: '12px',
            }}
          >
            <div>
              <div style={{ fontSize: '15px', fontWeight: 600, color: t.text }}>
                Evolução Mensal Comparativa (Sazonalidade)
              </div>
              <div style={{ fontSize: '12px', color: t.textMuted }}>
                Faturamento em R$ Milhões — Jan a Dez ({comparisonConfig.labelA} x{' '}
                {comparisonConfig.labelB})
              </div>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={evolutionChartData}>
              <CartesianGrid vertical={false} stroke={t.border} strokeDasharray="3 3" />
              <XAxis
                dataKey="mes"
                tick={{ fill: t.textMuted, fontSize: 12 }}
                axisLine={{ stroke: t.border }}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: t.textMuted, fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                width={35}
              />
              <Tooltip
                contentStyle={{
                  background: t.surfaceElevated,
                  border: `1px solid ${t.border}`,
                  borderRadius: 8,
                  fontSize: 12.5,
                }}
                labelStyle={{ color: t.text }}
              />
              <Legend wrapperStyle={{ fontSize: 12, paddingTop: 10 }} />
              <Line
                type="monotone"
                dataKey={comparisonConfig.labelA}
                stroke={t.primary}
                strokeWidth={3}
                dot={{ r: 4, fill: t.primary }}
                activeDot={{ r: 6 }}
              />
              <Line
                type="monotone"
                dataKey={comparisonConfig.labelB}
                stroke={t.textMuted}
                strokeWidth={2}
                strokeDasharray="4 4"
                dot={{ r: 3, fill: t.textMuted }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Bar Chart: Meta x Realizado A x Realizado B */}
        <div
          style={{
            background: t.surface,
            border: `1px solid ${t.border}`,
            borderRadius: '12px',
            padding: '20px',
          }}
        >
          <div style={{ fontSize: '15px', fontWeight: 600, color: t.text, marginBottom: '4px' }}>
            Meta x Realizado Estratégico
          </div>
          <div style={{ fontSize: '12px', color: t.textMuted, marginBottom: '16px' }}>
            Volume consolidado comparativo (R$ Milhões)
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart
              data={[
                {
                  categoria: comparisonConfig.labelA,
                  Realizado: Number((macroSummary.realA / 1000000).toFixed(2)),
                  Meta: Number((macroSummary.metaA / 1000000).toFixed(2)),
                },
                {
                  categoria: comparisonConfig.labelB,
                  Realizado: Number((macroSummary.realB / 1000000).toFixed(2)),
                  Meta: Number((macroSummary.metaB / 1000000).toFixed(2)),
                },
              ]}
              barGap={8}
            >
              <CartesianGrid vertical={false} stroke={t.border} strokeDasharray="3 3" />
              <XAxis
                dataKey="categoria"
                tick={{ fill: t.textMuted, fontSize: 12 }}
                axisLine={{ stroke: t.border }}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: t.textMuted, fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                width={30}
              />
              <Tooltip
                contentStyle={{
                  background: t.surfaceElevated,
                  border: `1px solid ${t.border}`,
                  borderRadius: 8,
                  fontSize: 12.5,
                }}
              />
              <Legend wrapperStyle={{ fontSize: 12, paddingTop: 10 }} />
              <Bar dataKey="Meta" fill={t.border} radius={[4, 4, 0, 0]} />
              <Bar dataKey="Realizado" fill={t.primary} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ANALYTICAL BREAKDOWN WITH DRILL-DOWN (Requirement 19) */}
      <div
        style={{
          background: t.surface,
          border: `1px solid ${t.border}`,
          borderRadius: '12px',
          padding: '20px',
          marginBottom: '24px',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '16px',
            flexWrap: 'wrap',
            gap: '10px',
          }}
        >
          <div>
            <div style={{ fontSize: '15px', fontWeight: 600, color: t.text }}>
              Desdobramento Analítico com Drill-down
            </div>
            <div style={{ fontSize: '12px', color: t.textMuted }}>
              Cruzamento comparativo por entidade organizacional ou fabricante
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              gap: '6px',
              background: t.surfaceElevated,
              padding: '4px',
              borderRadius: '8px',
              border: `1px solid ${t.border}`,
            }}
          >
            {[
              { id: 'fabricante', label: 'Fabricante' },
              { id: 'gerencia', label: 'Gerência' },
              { id: 'equipe', label: 'Equipe' },
              { id: 'vendedor', label: 'Vendedor' },
            ].map((d) => (
              <button
                key={d.id}
                onClick={() => setActiveDimension(d.id as any)}
                style={{
                  fontSize: '12.5px',
                  padding: '5px 12px',
                  borderRadius: '6px',
                  border: 'none',
                  cursor: 'pointer',
                  background: activeDimension === d.id ? t.primary : 'transparent',
                  color: activeDimension === d.id ? '#fff' : t.textSecondary,
                  fontWeight: activeDimension === d.id ? 600 : 500,
                }}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ color: t.textMuted }}>
                <th
                  style={{
                    textAlign: 'left',
                    padding: '10px 14px',
                    borderBottom: `1px solid ${t.border}`,
                    fontWeight: 500,
                  }}
                >
                  {activeDimension.toUpperCase()}
                </th>
                <th
                  style={{
                    textAlign: 'right',
                    padding: '10px 14px',
                    borderBottom: `1px solid ${t.border}`,
                    fontWeight: 500,
                  }}
                >
                  {comparisonConfig.labelA}
                </th>
                <th
                  style={{
                    textAlign: 'right',
                    padding: '10px 14px',
                    borderBottom: `1px solid ${t.border}`,
                    fontWeight: 500,
                  }}
                >
                  {comparisonConfig.labelB}
                </th>
                <th
                  style={{
                    textAlign: 'right',
                    padding: '10px 14px',
                    borderBottom: `1px solid ${t.border}`,
                    fontWeight: 500,
                  }}
                >
                  Variação R$
                </th>
                <th
                  style={{
                    textAlign: 'right',
                    padding: '10px 14px',
                    borderBottom: `1px solid ${t.border}`,
                    fontWeight: 500,
                  }}
                >
                  Crescimento %
                </th>
                <th
                  style={{
                    textAlign: 'center',
                    padding: '10px 14px',
                    borderBottom: `1px solid ${t.border}`,
                    fontWeight: 500,
                  }}
                >
                  Desempenho
                </th>
              </tr>
            </thead>
            <tbody>
              {breakdownRows.map((row) => (
                <tr key={row.dim} style={{ borderBottom: `1px solid ${t.border}` }}>
                  <td
                    style={{
                      padding: '12px 14px',
                      fontWeight: 600,
                      color: t.text,
                    }}
                  >
                    {row.dim}
                  </td>
                  <td
                    className="num"
                    style={{
                      padding: '12px 14px',
                      textAlign: 'right',
                      fontWeight: 600,
                      color: t.text,
                    }}
                  >
                    {fmtR(row.periodA)}
                  </td>
                  <td
                    className="num"
                    style={{
                      padding: '12px 14px',
                      textAlign: 'right',
                      color: t.textSecondary,
                    }}
                  >
                    {fmtR(row.periodB)}
                  </td>
                  <td
                    className="num"
                    style={{
                      padding: '12px 14px',
                      textAlign: 'right',
                      color: row.varR >= 0 ? '#3DD68C' : t.primaryHover,
                      fontWeight: 600,
                    }}
                  >
                    {row.varR >= 0 ? '+' : ''}
                    {fmtR(row.varR)}
                  </td>
                  <td
                    className="num"
                    style={{
                      padding: '12px 14px',
                      textAlign: 'right',
                      color: row.varPct >= 0 ? '#3DD68C' : t.primaryHover,
                      fontWeight: 700,
                    }}
                  >
                    {row.varPct >= 0 ? '+' : ''}
                    {row.varPct.toFixed(1)}%
                  </td>
                  <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 600,
                        padding: '3px 8px',
                        borderRadius: '6px',
                        background:
                          row.varPct >= 5
                            ? 'rgba(61, 214, 140, 0.12)'
                            : row.varPct >= 0
                            ? 'rgba(232, 179, 57, 0.12)'
                            : 'rgba(227, 6, 19, 0.12)',
                        color:
                          row.varPct >= 5
                            ? '#3DD68C'
                            : row.varPct >= 0
                            ? '#E8B339'
                            : t.primaryHover,
                      }}
                    >
                      {row.varPct >= 5
                        ? 'Expansão Alta'
                        : row.varPct >= 0
                        ? 'Estável'
                        : 'Retração'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* COMPARISON SECTIONS: TOP CLIENTES & PRODUTOS (Requirement 22, 23) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '16px',
          marginBottom: '24px',
        }}
        className="macro-tables-grid"
      >
        {/* Top Clientes Comparison */}
        <div
          style={{
            background: t.surface,
            border: `1px solid ${t.border}`,
            borderRadius: '12px',
            padding: '20px',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '14px',
            }}
          >
            <div style={{ fontSize: '15px', fontWeight: 600, color: t.text }}>
              Top Clientes — Comparação de Posição
            </div>
            <div style={{ fontSize: '12px', color: t.textMuted }}>Top 5 Clientes</div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
              <thead>
                <tr style={{ color: t.textMuted }}>
                  <th style={{ textAlign: 'left', padding: '8px 10px', borderBottom: `1px solid ${t.border}` }}>
                    Pos
                  </th>
                  <th style={{ textAlign: 'left', padding: '8px 10px', borderBottom: `1px solid ${t.border}` }}>
                    Cliente
                  </th>
                  <th style={{ textAlign: 'right', padding: '8px 10px', borderBottom: `1px solid ${t.border}` }}>
                    {comparisonConfig.labelA}
                  </th>
                  <th style={{ textAlign: 'right', padding: '8px 10px', borderBottom: `1px solid ${t.border}` }}>
                    Var %
                  </th>
                </tr>
              </thead>
              <tbody>
                {topClientesComparison.map((c) => {
                  const posDiff = c.posB - c.posA;
                  return (
                    <tr key={c.nome} style={{ borderBottom: `1px solid ${t.border}` }}>
                      <td style={{ padding: '10px 10px', fontWeight: 600, color: t.textMuted }}>
                        #{c.posA}{' '}
                        {posDiff !== 0 && (
                          <span
                            style={{
                              fontSize: '11px',
                              color: posDiff > 0 ? '#3DD68C' : t.primaryHover,
                            }}
                          >
                            {posDiff > 0 ? `▲${posDiff}` : `▼${Math.abs(posDiff)}`}
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '10px 10px', color: t.text, fontWeight: 500 }}>
                        <div>{c.nome}</div>
                        <div style={{ fontSize: '11px', color: t.textMuted }}>{c.equipe}</div>
                      </td>
                      <td
                        className="num"
                        style={{
                          padding: '10px 10px',
                          textAlign: 'right',
                          fontWeight: 600,
                          color: t.text,
                        }}
                      >
                        {fmtR(c.vA)}
                      </td>
                      <td
                        className="num"
                        style={{
                          padding: '10px 10px',
                          textAlign: 'right',
                          color: c.varPct >= 0 ? '#3DD68C' : t.primaryHover,
                          fontWeight: 600,
                        }}
                      >
                        {c.varPct >= 0 ? '+' : ''}
                        {c.varPct.toFixed(1)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Produtos Comparison */}
        <div
          style={{
            background: t.surface,
            border: `1px solid ${t.border}`,
            borderRadius: '12px',
            padding: '20px',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '14px',
            }}
          >
            <div style={{ fontSize: '15px', fontWeight: 600, color: t.text }}>
              Produtos — Comparação e Participação
            </div>
            <div style={{ fontSize: '12px', color: t.textMuted }}>Itens Chave</div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
              <thead>
                <tr style={{ color: t.textMuted }}>
                  <th style={{ textAlign: 'left', padding: '8px 10px', borderBottom: `1px solid ${t.border}` }}>
                    Produto
                  </th>
                  <th style={{ textAlign: 'left', padding: '8px 10px', borderBottom: `1px solid ${t.border}` }}>
                    Marca
                  </th>
                  <th style={{ textAlign: 'right', padding: '8px 10px', borderBottom: `1px solid ${t.border}` }}>
                    {comparisonConfig.labelA}
                  </th>
                  <th style={{ textAlign: 'right', padding: '8px 10px', borderBottom: `1px solid ${t.border}` }}>
                    Part. %
                  </th>
                  <th style={{ textAlign: 'right', padding: '8px 10px', borderBottom: `1px solid ${t.border}` }}>
                    Var %
                  </th>
                </tr>
              </thead>
              <tbody>
                {produtosComparison.map((p) => (
                  <tr key={p.codigo} style={{ borderBottom: `1px solid ${t.border}` }}>
                    <td style={{ padding: '10px 10px', color: t.text, fontWeight: 500 }}>
                      {p.nome}
                    </td>
                    <td style={{ padding: '10px 10px', color: t.textSecondary }}>
                      {p.fabricante}
                    </td>
                    <td
                      className="num"
                      style={{
                        padding: '10px 10px',
                        textAlign: 'right',
                        fontWeight: 600,
                        color: t.text,
                      }}
                    >
                      {fmtR(p.vA)}
                    </td>
                    <td
                      className="num"
                      style={{
                        padding: '10px 10px',
                        textAlign: 'right',
                        color: t.textSecondary,
                      }}
                    >
                      {p.share}%
                    </td>
                    <td
                      className="num"
                      style={{
                        padding: '10px 10px',
                        textAlign: 'right',
                        color: p.varPct >= 0 ? '#3DD68C' : t.primaryHover,
                        fontWeight: 600,
                      }}
                    >
                      {p.varPct >= 0 ? '+' : ''}
                      {p.varPct.toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* HEATMAP DE DESEMPENHO (Requirement 24) */}
      <div
        style={{
          background: t.surface,
          border: `1px solid ${t.border}`,
          borderRadius: '12px',
          padding: '20px',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '16px',
            flexWrap: 'wrap',
            gap: '10px',
          }}
        >
          <div>
            <div style={{ fontSize: '15px', fontWeight: 600, color: t.text }}>
              Heatmap de Desempenho e Aderência Comercial
            </div>
            <div style={{ fontSize: '12px', color: t.textMuted }}>
              Cruzamento de intensidade de faturamento x fabricante
            </div>
          </div>

          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              onClick={() => setHeatmapType('equipe')}
              style={{
                fontSize: '12px',
                padding: '5px 12px',
                borderRadius: '6px',
                border: `1px solid ${heatmapType === 'equipe' ? t.primary : t.border}`,
                background: heatmapType === 'equipe' ? t.primary : t.surfaceElevated,
                color: heatmapType === 'equipe' ? '#fff' : t.textSecondary,
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              Equipe x Fabricante
            </button>
            <button
              onClick={() => setHeatmapType('mes')}
              style={{
                fontSize: '12px',
                padding: '5px 12px',
                borderRadius: '6px',
                border: `1px solid ${heatmapType === 'mes' ? t.primary : t.border}`,
                background: heatmapType === 'mes' ? t.primary : t.surfaceElevated,
                color: heatmapType === 'mes' ? '#fff' : t.textSecondary,
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              Mês x Fabricante
            </button>
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ color: t.textMuted }}>
                <th
                  style={{
                    textAlign: 'left',
                    padding: '10px 14px',
                    borderBottom: `1px solid ${t.border}`,
                  }}
                >
                  {heatmapType === 'equipe' ? 'Equipe' : 'Mês'}
                </th>
                {FABRICANTES.map((fab) => (
                  <th
                    key={fab}
                    style={{
                      textAlign: 'center',
                      padding: '10px 14px',
                      borderBottom: `1px solid ${t.border}`,
                    }}
                  >
                    {fab}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(heatmapType === 'equipe'
                ? EQUIPES
                : ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set']
              ).map((rowLabel, i) => (
                <tr key={rowLabel} style={{ borderBottom: `1px solid ${t.border}` }}>
                  <td style={{ padding: '12px 14px', fontWeight: 600, color: t.text }}>
                    {rowLabel}
                  </td>
                  {FABRICANTES.map((fab, j) => {
                    // pseudo heat value 60 - 110%
                    const score = 70 + ((i * 17 + j * 29) % 38);
                    const bg =
                      score >= 95
                        ? 'rgba(61, 214, 140, 0.18)'
                        : score >= 85
                        ? 'rgba(61, 214, 140, 0.08)'
                        : score >= 75
                        ? 'rgba(232, 179, 57, 0.12)'
                        : 'rgba(227, 6, 19, 0.12)';
                    const color =
                      score >= 85 ? '#3DD68C' : score >= 75 ? '#E8B339' : t.primaryHover;
                    return (
                      <td
                        key={fab}
                        style={{
                          padding: '10px 14px',
                          textAlign: 'center',
                        }}
                      >
                        <div
                          style={{
                            background: bg,
                            color,
                            padding: '6px 10px',
                            borderRadius: '6px',
                            fontWeight: 600,
                            display: 'inline-block',
                            minWidth: '60px',
                          }}
                        >
                          {score}%
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <style>{`
        @media (max-width: 980px) {
          .macro-charts-grid,
          .macro-tables-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
};
