import React, { useState, useMemo } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { useGlobalFilter } from '../../context/GlobalFilterContext';
import { useAuth } from '../../context/AuthContext';
import { PeriodSelector } from '../../components/common/PeriodSelector';
import { ExportExcelButton } from '../../components/common/ExportExcelButton';
import {
  TrendingUp,
  DollarSign,
  Users,
  Percent,
  RotateCcw,
  Calendar,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';

interface HistoricoItem {
  mes: string;
  ano: number;
  mesNum: number;
  fabricante: string;
  equipe: string;
  vendedor: string;
  meta: number;
  realizado: number;
  metaClientes: number;
  positivados: number;
  margemPct: number;
}

const FABRICANTES = ['Todos', 'ARCOR', 'HEINZ', 'NESTLÉ', 'UNILEVER'];
const EQUIPES = ['Todas', 'TRAB ALFA', 'TRAB BETA', 'TRAB GAMA'];
const VENDEDORES = [
  'Todos',
  'Vendedor 003',
  'Vendedor 004',
  'Vendedor 011',
  'Vendedor 012',
  'Vendedor 020',
];

const MESES_INFO = [
  { label: 'Out/25', ano: 2025, mesNum: 10, mult: 0.95 },
  { label: 'Nov/25', ano: 2025, mesNum: 11, mult: 1.02 },
  { label: 'Dez/25', ano: 2025, mesNum: 12, mult: 1.18 },
  { label: 'Jan/26', ano: 2026, mesNum: 1, mult: 0.88 },
  { label: 'Fev/26', ano: 2026, mesNum: 2, mult: 0.92 },
  { label: 'Mar/26', ano: 2026, mesNum: 3, mult: 1.01 },
  { label: 'Abr/26', ano: 2026, mesNum: 4, mult: 0.94 },
  { label: 'Mai/26', ano: 2026, mesNum: 5, mult: 1.05 },
  { label: 'Jun/26', ano: 2026, mesNum: 6, mult: 0.96 },
  { label: 'Jul/26', ano: 2026, mesNum: 7, mult: 0.98 },
  { label: 'Ago/26', ano: 2026, mesNum: 8, mult: 1.22 },
  { label: 'Set/26', ano: 2026, mesNum: 9, mult: 0.95 },
];

const ESTRUTURA_BASE = [
  // ARCOR
  { fabricante: 'ARCOR', equipe: 'TRAB ALFA', vendedor: 'Vendedor 003', metaBase: 110000, realBase: 98200, cliMeta: 105, cliReal: 82, margem: 18.8 },
  { fabricante: 'ARCOR', equipe: 'TRAB ALFA', vendedor: 'Vendedor 004', metaBase: 100000, realBase: 87100, cliMeta: 95, cliReal: 72, margem: 18.2 },
  { fabricante: 'ARCOR', equipe: 'TRAB BETA', vendedor: 'Vendedor 011', metaBase: 150000, realBase: 128400, cliMeta: 120, cliReal: 90, margem: 19.1 },
  { fabricante: 'ARCOR', equipe: 'TRAB BETA', vendedor: 'Vendedor 012', metaBase: 120000, realBase: 88400, cliMeta: 100, cliReal: 68, margem: 17.9 },

  // HEINZ
  { fabricante: 'HEINZ', equipe: 'TRAB ALFA', vendedor: 'Vendedor 003', metaBase: 90000, realBase: 88900, cliMeta: 100, cliReal: 78, margem: 21.4 },
  { fabricante: 'HEINZ', equipe: 'TRAB ALFA', vendedor: 'Vendedor 004', metaBase: 70000, realBase: 63400, cliMeta: 80, cliReal: 57, margem: 20.8 },
  { fabricante: 'HEINZ', equipe: 'TRAB GAMA', vendedor: 'Vendedor 020', metaBase: 160000, realBase: 146200, cliMeta: 170, cliReal: 125, margem: 22.0 },

  // NESTLÉ
  { fabricante: 'NESTLÉ', equipe: 'TRAB BETA', vendedor: 'Vendedor 011', metaBase: 220000, realBase: 162100, cliMeta: 180, cliReal: 134, margem: 16.5 },
  { fabricante: 'NESTLÉ', equipe: 'TRAB BETA', vendedor: 'Vendedor 012', metaBase: 160000, realBase: 106300, cliMeta: 140, cliReal: 98, margem: 15.8 },
  { fabricante: 'NESTLÉ', equipe: 'TRAB GAMA', vendedor: 'Vendedor 020', metaBase: 230000, realBase: 176800, cliMeta: 240, cliReal: 178, margem: 16.9 },

  // UNILEVER
  { fabricante: 'UNILEVER', equipe: 'TRAB ALFA', vendedor: 'Vendedor 003', metaBase: 140000, realBase: 138200, cliMeta: 160, cliReal: 128, margem: 19.5 },
  { fabricante: 'UNILEVER', equipe: 'TRAB ALFA', vendedor: 'Vendedor 004', metaBase: 135000, realBase: 123700, cliMeta: 150, cliReal: 117, margem: 20.1 },
];

// Gerar base histórica mensal consistente
const BASE_HISTORICA: HistoricoItem[] = MESES_INFO.flatMap((m, mIdx) => {
  return ESTRUTURA_BASE.map((item, iIdx) => {
    // Variação sazonal realista
    const fator = m.mult * (1 + ((iIdx % 3) - 1) * 0.03 + Math.sin(mIdx + iIdx) * 0.02);
    const metaAjustada = Math.round(item.metaBase * m.mult);
    const realAjustado = Math.round(item.realBase * fator);
    const cliMeta = item.cliMeta;
    const cliReal = Math.min(cliMeta, Math.round(item.cliReal * (fator * 0.6 + 0.4)));
    const margemAjustada = Number((item.margem + ((mIdx % 2 === 0 ? 0.3 : -0.3))).toFixed(1));

    return {
      mes: m.label,
      ano: m.ano,
      mesNum: m.mesNum,
      fabricante: item.fabricante,
      equipe: item.equipe,
      vendedor: item.vendedor,
      meta: metaAjustada,
      realizado: realAjustado,
      metaClientes: cliMeta,
      positivados: cliReal,
      margemPct: margemAjustada,
    };
  });
});

const PERIODOS_FILTRO = [
  { id: '12M', label: 'Últimos 12 Meses' },
  { id: '6M', label: 'Últimos 6 Meses' },
  { id: '3M', label: 'Últimos 3 Meses' },
  { id: '2026', label: 'Ano 2026' },
  { id: '2025', label: 'Ano 2025' },
];

export const HistoricoPage: React.FC = () => {
  const { t } = useTheme();
  const { currentUser } = useAuth();
  const { selectedPeriod } = useGlobalFilter();

  // Filtros solicitados: Fabricantes, Equipes, Vendedores, Período
  const [selectedFabricante, setSelectedFabricante] = useState('Todos');
  const [selectedEquipe, setSelectedEquipe] = useState('Todas');
  const [selectedVendedor, setSelectedVendedor] = useState('Todos');
  const [selectedFaixa, setSelectedFaixa] = useState('12M');
  const [activeTab, setActiveTab] = useState<'todos' | 'monetario' | 'cobertura' | 'margem'>('todos');

  // RBAC scope inicial
  const dadosBase = useMemo(() => {
    if (!currentUser || currentUser.role === 'ADMIN' || currentUser.role === 'GERENTE') {
      return BASE_HISTORICA;
    }
    if (currentUser.role === 'SUPERVISOR') {
      const eq = currentUser.team || 'TRAB ALFA';
      return BASE_HISTORICA.filter((d) => d.equipe === eq);
    }
    if (currentUser.role === 'VENDEDOR') {
      const vend = currentUser.name || 'Vendedor 003';
      return BASE_HISTORICA.filter((d) => d.vendedor === vend || d.vendedor === 'Vendedor 003');
    }
    return BASE_HISTORICA;
  }, [currentUser]);

  // Opções dinâmicas de equipes e vendedores conforme fabricante selecionado
  const equipesDisponiveis = useMemo(() => {
    let list = dadosBase;
    if (selectedFabricante !== 'Todos') {
      list = list.filter((d) => d.fabricante === selectedFabricante);
    }
    const eqs = Array.from(new Set(list.map((d) => d.equipe)));
    return ['Todas', ...eqs];
  }, [dadosBase, selectedFabricante]);

  const vendedoresDisponiveis = useMemo(() => {
    let list = dadosBase;
    if (selectedFabricante !== 'Todos') {
      list = list.filter((d) => d.fabricante === selectedFabricante);
    }
    if (selectedEquipe !== 'Todas') {
      list = list.filter((d) => d.equipe === selectedEquipe);
    }
    const vends = Array.from(new Set(list.map((d) => d.vendedor)));
    return ['Todos', ...vends];
  }, [dadosBase, selectedFabricante, selectedEquipe]);

  // Filtragem flexível
  const dadosFiltrados = useMemo(() => {
    return dadosBase.filter((d) => {
      if (selectedFabricante !== 'Todos' && d.fabricante !== selectedFabricante) return false;
      if (selectedEquipe !== 'Todas' && d.equipe !== selectedEquipe) return false;
      if (selectedVendedor !== 'Todos' && d.vendedor !== selectedVendedor) return false;

      // Filtro de período / faixa temporal
      if (selectedFaixa === '6M') {
        const ultimos6 = ['Abr/26', 'Mai/26', 'Jun/26', 'Jul/26', 'Ago/26', 'Set/26'];
        if (!ultimos6.includes(d.mes)) return false;
      } else if (selectedFaixa === '3M') {
        const ultimos3 = ['Jul/26', 'Ago/26', 'Set/26'];
        if (!ultimos3.includes(d.mes)) return false;
      } else if (selectedFaixa === '2026') {
        if (d.ano !== 2026) return false;
      } else if (selectedFaixa === '2025') {
        if (d.ano !== 2025) return false;
      }

      return true;
    });
  }, [dadosBase, selectedFabricante, selectedEquipe, selectedVendedor, selectedFaixa]);

  // Agregação histórica mensal
  const historicoPorMes = useMemo(() => {
    const mesesOrdem = MESES_INFO.map((m) => m.label);
    const grupos: { [mes: string]: HistoricoItem[] } = {};

    dadosFiltrados.forEach((item) => {
      if (!grupos[item.mes]) grupos[item.mes] = [];
      grupos[item.mes].push(item);
    });

    return mesesOrdem
      .filter((mes) => grupos[mes] && grupos[mes].length > 0)
      .map((mes) => {
        const items = grupos[mes];
        const metaTotal = items.reduce((acc, i) => acc + i.meta, 0);
        const realTotal = items.reduce((acc, i) => acc + i.realizado, 0);
        const gapTotal = realTotal - metaTotal;
        const atingimento = metaTotal > 0 ? (realTotal / metaTotal) * 100 : 0;

        const cliMetaTotal = items.reduce((acc, i) => acc + i.metaClientes, 0);
        const cliRealTotal = items.reduce((acc, i) => acc + i.positivados, 0);
        const coberturaPct = cliMetaTotal > 0 ? (cliRealTotal / cliMetaTotal) * 100 : 0;

        // Margem ponderada pelo faturamento
        const margemPonderada =
          realTotal > 0
            ? items.reduce((acc, i) => acc + i.margemPct * i.realizado, 0) / realTotal
            : items.reduce((acc, i) => acc + i.margemPct, 0) / items.length;

        return {
          mes,
          meta: metaTotal,
          realizado: realTotal,
          gap: gapTotal,
          atingimento: Number(atingimento.toFixed(1)),
          metaFormatada: Number((metaTotal / 1000000).toFixed(2)),
          realizadoFormatado: Number((realTotal / 1000000).toFixed(2)),
          gapFormatado: Number((gapTotal / 1000000).toFixed(2)),
          metaClientes: cliMetaTotal,
          positivados: cliRealTotal,
          coberturaPct: Number(coberturaPct.toFixed(1)),
          margemPct: Number(margemPonderada.toFixed(1)),
        };
      });
  }, [dadosFiltrados]);

  // Totais e médias consolidadas do período filtrado
  const consolidados = useMemo(() => {
    if (historicoPorMes.length === 0) {
      return {
        metaTotal: 0,
        realTotal: 0,
        gapTotal: 0,
        atingimentoMedio: 0,
        clientesPositivadosTotal: 0,
        coberturaMedia: 0,
        margemMedia: 0,
      };
    }

    const metaTotal = historicoPorMes.reduce((acc, h) => acc + h.meta, 0);
    const realTotal = historicoPorMes.reduce((acc, h) => acc + h.realizado, 0);
    const gapTotal = realTotal - metaTotal;
    const atingimentoMedio = metaTotal > 0 ? (realTotal / metaTotal) * 100 : 0;

    const totalMetaCli = historicoPorMes.reduce((acc, h) => acc + h.metaClientes, 0);
    const totalRealCli = historicoPorMes.reduce((acc, h) => acc + h.positivados, 0);
    const coberturaMedia = totalMetaCli > 0 ? (totalRealCli / totalMetaCli) * 100 : 0;

    const margemMedia =
      realTotal > 0
        ? historicoPorMes.reduce((acc, h) => acc + h.margemPct * h.realizado, 0) / realTotal
        : historicoPorMes.reduce((acc, h) => acc + h.margemPct, 0) / historicoPorMes.length;

    return {
      metaTotal,
      realTotal,
      gapTotal,
      atingimentoMedio,
      clientesPositivadosTotal: Math.round(totalRealCli / historicoPorMes.length),
      coberturaMedia,
      margemMedia,
    };
  }, [historicoPorMes]);

  const limparFiltros = () => {
    setSelectedFabricante('Todos');
    setSelectedEquipe('Todas');
    setSelectedVendedor('Todos');
    setSelectedFaixa('12M');
  };

  const hasFiltrosAtivos =
    selectedFabricante !== 'Todos' ||
    selectedEquipe !== 'Todas' ||
    selectedVendedor !== 'Todos' ||
    selectedFaixa !== '12M';

  const fmtR = (v: number) => `R$ ${Math.round(v).toLocaleString('pt-BR')}`;
  const fmtM = (v: number) => `R$ ${(v / 1000000).toFixed(2)}M`;

  const handleExportExcel = () => {
    const data = historicoPorMes.map((h) => ({
      'Mês / Período': h.mes,
      'Filtro Fabricante': selectedFabricante,
      'Filtro Equipe': selectedEquipe,
      'Filtro Vendedor': selectedVendedor,
      'Meta Monetária (R$)': h.meta,
      'Realizado Monetário (R$)': h.realizado,
      'GAP Monetário (R$)': h.gap,
      'Atingimento %': `${h.atingimento.toFixed(1)}%`,
      'Clientes Positivados': h.positivados,
      'Meta de Clientes': h.metaClientes,
      'Cobertura %': `${h.coberturaPct.toFixed(1)}%`,
      'Margem Comercial %': `${h.margemPct.toFixed(1)}%`,
      Situação: h.atingimento >= 100 ? 'Meta Batida' : 'Abaixo da Cota',
    }));
    return [{ sheetName: 'Histórico Comercial', data }];
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 className="num" style={{ margin: '0 0 4px', fontSize: '24px', fontWeight: 700, color: t.text }}>
            Histórico Comercial & Séries Temporais
          </h1>
          <p style={{ margin: 0, fontSize: '13px', color: t.textSecondary }}>
            Visualização histórica flexível por mês/período com acompanhamento de Meta x Realizado, Cobertura e Margem.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <PeriodSelector />
          <ExportExcelButton
            filename={`Historico_${selectedFabricante}_${selectedEquipe}_${selectedVendedor}.xlsx`}
            onPrepareData={handleExportExcel}
          />
        </div>
      </div>

      {/* BARRA DE FILTROS: Fabricantes, Equipes, Vendedores e Período */}
      <div
        style={{
          background: t.surface,
          border: `1px solid ${t.border}`,
          borderRadius: '12px',
          padding: '16px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '13.5px', fontWeight: 600, color: t.text }}>Filtros de Análise Histórica</span>
            <span style={{ fontSize: '12px', color: t.textMuted }}>
              ({historicoPorMes.length} {historicoPorMes.length === 1 ? 'mês selecionado' : 'meses selecionados'})
            </span>
          </div>

          {hasFiltrosAtivos && (
            <button
              onClick={limparFiltros}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '12px',
                padding: '5px 10px',
                borderRadius: '6px',
                border: `1px solid ${t.border}`,
                background: t.surfaceElevated,
                color: t.primaryHover,
                cursor: 'pointer',
                fontWeight: 500,
              }}
            >
              <RotateCcw size={13} />
              Limpar Filtros
            </button>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
          {/* Filtro Fabricantes */}
          <div>
            <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: t.textMuted, marginBottom: '5px' }}>
              FABRICANTE
            </label>
            <select
              value={selectedFabricante}
              onChange={(e) => {
                setSelectedFabricante(e.target.value);
                setSelectedEquipe('Todas');
                setSelectedVendedor('Todos');
              }}
              style={{
                width: '100%',
                fontSize: '13px',
                color: t.text,
                border: `1px solid ${selectedFabricante !== 'Todos' ? t.primary : t.border}`,
                borderRadius: '8px',
                padding: '9px 12px',
                background: selectedFabricante !== 'Todos' ? `${t.primary}10` : t.surfaceElevated,
                cursor: 'pointer',
                fontFamily: "'Inter', sans-serif",
                outline: 'none',
              }}
            >
              {FABRICANTES.map((f) => (
                <option key={f} value={f}>
                  {f === 'Todos' ? 'Todos os Fabricantes' : f}
                </option>
              ))}
            </select>
          </div>

          {/* Filtro Equipes */}
          <div>
            <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: t.textMuted, marginBottom: '5px' }}>
              EQUIPE
            </label>
            <select
              value={selectedEquipe}
              onChange={(e) => {
                setSelectedEquipe(e.target.value);
                setSelectedVendedor('Todos');
              }}
              style={{
                width: '100%',
                fontSize: '13px',
                color: t.text,
                border: `1px solid ${selectedEquipe !== 'Todas' ? t.primary : t.border}`,
                borderRadius: '8px',
                padding: '9px 12px',
                background: selectedEquipe !== 'Todas' ? `${t.primary}10` : t.surfaceElevated,
                cursor: 'pointer',
                fontFamily: "'Inter', sans-serif",
                outline: 'none',
              }}
            >
              {equipesDisponiveis.map((eq) => (
                <option key={eq} value={eq}>
                  {eq === 'Todas' ? 'Todas as Equipes' : eq}
                </option>
              ))}
            </select>
          </div>

          {/* Filtro Vendedores */}
          <div>
            <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: t.textMuted, marginBottom: '5px' }}>
              VENDEDOR
            </label>
            <select
              value={selectedVendedor}
              onChange={(e) => setSelectedVendedor(e.target.value)}
              style={{
                width: '100%',
                fontSize: '13px',
                color: t.text,
                border: `1px solid ${selectedVendedor !== 'Todos' ? t.primary : t.border}`,
                borderRadius: '8px',
                padding: '9px 12px',
                background: selectedVendedor !== 'Todos' ? `${t.primary}10` : t.surfaceElevated,
                cursor: 'pointer',
                fontFamily: "'Inter', sans-serif",
                outline: 'none',
              }}
            >
              {vendedoresDisponiveis.map((v) => (
                <option key={v} value={v}>
                  {v === 'Todos' ? 'Todos os Vendedores' : v}
                </option>
              ))}
            </select>
          </div>

          {/* Filtro Faixa / Período */}
          <div>
            <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: t.textMuted, marginBottom: '5px' }}>
              MÊS / PERÍODO HISTÓRICO
            </label>
            <select
              value={selectedFaixa}
              onChange={(e) => setSelectedFaixa(e.target.value)}
              style={{
                width: '100%',
                fontSize: '13px',
                color: t.text,
                border: `1px solid ${selectedFaixa !== '12M' ? t.primary : t.border}`,
                borderRadius: '8px',
                padding: '9px 12px',
                background: selectedFaixa !== '12M' ? `${t.primary}10` : t.surfaceElevated,
                cursor: 'pointer',
                fontFamily: "'Inter', sans-serif",
                outline: 'none',
              }}
            >
              {PERIODOS_FILTRO.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* INDICADORES HISTÓRICOS POR MÊS/PERÍODO: Meta x Realizado monetário, Cobertura, Margem */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
          gap: '14px',
        }}
      >
        {/* Indicador 1: Meta x Realizado Monetário */}
        <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: '12px', padding: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '12.5px', color: t.textSecondary, fontWeight: 500 }}>Meta x Realizado (Monetário)</span>
            <DollarSign size={18} color={t.primary} />
          </div>
          <div className="num" style={{ fontSize: '24px', fontWeight: 700, color: t.text }}>
            {fmtM(consolidados.realTotal)}
          </div>
          <div style={{ fontSize: '12px', color: t.textMuted, marginTop: '4px', display: 'flex', justifyContent: 'space-between' }}>
            <span>Meta: <strong>{fmtM(consolidados.metaTotal)}</strong></span>
            <span
              className="num"
              style={{
                fontWeight: 700,
                color: consolidados.atingimentoMedio >= 100 ? '#3DD68C' : consolidados.atingimentoMedio >= 90 ? t.text : t.primaryHover,
              }}
            >
              {consolidados.atingimentoMedio.toFixed(1)}% ating.
            </span>
          </div>
          <div style={{ height: '5px', width: '100%', background: t.border, borderRadius: '4px', marginTop: '8px', overflow: 'hidden' }}>
            <div
              style={{
                height: '100%',
                width: `${Math.min(100, consolidados.atingimentoMedio)}%`,
                background: consolidados.atingimentoMedio >= 100 ? '#3DD68C' : t.primary,
                borderRadius: '4px',
              }}
            />
          </div>
        </div>

        {/* Indicador 2: GAP Monetário */}
        <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: '12px', padding: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '12.5px', color: t.textSecondary, fontWeight: 500 }}>GAP Monetário Acumulado</span>
            <TrendingUp size={18} color={consolidados.gapTotal >= 0 ? '#3DD68C' : t.primaryHover} />
          </div>
          <div
            className="num"
            style={{
              fontSize: '24px',
              fontWeight: 700,
              color: consolidados.gapTotal >= 0 ? '#3DD68C' : t.primaryHover,
            }}
          >
            {consolidados.gapTotal >= 0 ? '+' : ''}{fmtM(consolidados.gapTotal)}
          </div>
          <div style={{ fontSize: '12px', color: t.textMuted, marginTop: '4px' }}>
            {consolidados.gapTotal >= 0
              ? 'Superávit comercial no período'
              : `Diferença monetária de ${fmtR(Math.abs(consolidados.gapTotal))}`}
          </div>
        </div>

        {/* Indicador 3: Cobertura */}
        <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: '12px', padding: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '12.5px', color: t.textSecondary, fontWeight: 500 }}>Cobertura Média da Carteira</span>
            <Users size={18} color={t.accentBlue} />
          </div>
          <div className="num" style={{ fontSize: '24px', fontWeight: 700, color: t.text }}>
            {consolidados.coberturaMedia.toFixed(1)}%
          </div>
          <div style={{ fontSize: '12px', color: t.textMuted, marginTop: '4px' }}>
            Média de <strong>{consolidados.clientesPositivadosTotal.toLocaleString('pt-BR')}</strong> clientes positivados/mês
          </div>
          <div style={{ height: '5px', width: '100%', background: t.border, borderRadius: '4px', marginTop: '8px', overflow: 'hidden' }}>
            <div
              style={{
                height: '100%',
                width: `${Math.min(100, consolidados.coberturaMedia)}%`,
                background: t.accentBlue,
                borderRadius: '4px',
              }}
            />
          </div>
        </div>

        {/* Indicador 4: Margem Comercial */}
        <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: '12px', padding: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '12.5px', color: t.textSecondary, fontWeight: 500 }}>Margem Comercial Média</span>
            <Percent size={18} color="#E8B339" />
          </div>
          <div className="num" style={{ fontSize: '24px', fontWeight: 700, color: t.text }}>
            {consolidados.margemMedia.toFixed(1)}%
          </div>
          <div style={{ fontSize: '12px', color: t.textMuted, marginTop: '4px' }}>
            Rentabilidade líquida média no período selecionado
          </div>
          <div style={{ height: '5px', width: '100%', background: t.border, borderRadius: '4px', marginTop: '8px', overflow: 'hidden' }}>
            <div
              style={{
                height: '100%',
                width: `${Math.min(100, consolidados.margemMedia * 3.5)}%`,
                background: '#E8B339',
                borderRadius: '4px',
              }}
            />
          </div>
        </div>
      </div>

      {/* TABS DE VISUALIZAÇÃO GRÁFICA */}
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
        {[
          { id: 'todos', label: 'Todos os Indicadores' },
          { id: 'monetario', label: 'Meta x Realizado (Monetário)' },
          { id: 'cobertura', label: 'Cobertura (% e Clientes)' },
          { id: 'margem', label: 'Margem Comercial (%)' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            style={{
              fontSize: '12.5px',
              padding: '7px 14px',
              borderRadius: '8px',
              cursor: 'pointer',
              border: `1px solid ${activeTab === tab.id ? t.primary : t.border}`,
              background: activeTab === tab.id ? t.primary : t.surface,
              color: activeTab === tab.id ? '#fff' : t.textSecondary,
              fontWeight: activeTab === tab.id ? 600 : 500,
              transition: 'all .15s ease',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* GRÁFICOS HISTÓRICOS */}
      {(activeTab === 'todos' || activeTab === 'monetario') && (
        <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: '12px', padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
            <div>
              <div style={{ fontSize: '15px', fontWeight: 600, color: t.text }}>
                Evolução Histórica: Meta x Realizado em Monetário (R$ Mi)
              </div>
              <div style={{ fontSize: '12px', color: t.textMuted }}>
                Comparativo mensal conforme filtros: Fabricante ({selectedFabricante}) · Equipe ({selectedEquipe}) · Vendedor ({selectedVendedor})
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', fontSize: '12px', color: t.textSecondary }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: t.borderActive }} />
                <span>Meta (R$ Mi)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: t.primary }} />
                <span>Realizado (R$ Mi)</span>
              </div>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={290}>
            <BarChart data={historicoPorMes} barGap={4}>
              <CartesianGrid vertical={false} stroke={t.border} strokeDasharray="3 3" />
              <XAxis dataKey="mes" tick={{ fill: t.textMuted, fontSize: 12 }} axisLine={{ stroke: t.border }} tickLine={false} />
              <YAxis tick={{ fill: t.textMuted, fontSize: 12 }} axisLine={false} tickLine={false} width={38} />
              <Tooltip
                contentStyle={{ background: t.surfaceElevated, border: `1px solid ${t.border}`, borderRadius: 8, fontSize: 12.5 }}
                labelStyle={{ color: t.text, fontWeight: 600 }}
                formatter={(val: any, name: any) => [`R$ ${val} Mi`, name === 'metaFormatada' ? 'Meta' : 'Realizado']}
              />
              <Bar dataKey="metaFormatada" fill={t.borderActive} radius={[4, 4, 0, 0]} name="metaFormatada" />
              <Bar dataKey="realizadoFormatado" fill={t.primary} radius={[4, 4, 0, 0]} name="realizadoFormatado" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {(activeTab === 'todos' || activeTab === 'cobertura' || activeTab === 'margem') && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: activeTab === 'todos' ? 'repeat(auto-fit, minmax(420px, 1fr))' : '1fr',
            gap: '16px',
          }}
        >
          {/* Gráfico de Cobertura */}
          {(activeTab === 'todos' || activeTab === 'cobertura') && (
            <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: '12px', padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
                <div>
                  <div style={{ fontSize: '14.5px', fontWeight: 600, color: t.text }}>Evolução de Cobertura</div>
                  <div style={{ fontSize: '12px', color: t.textMuted }}>% de clientes positivados vs meta de positivação mês a mês</div>
                </div>
                <div style={{ fontSize: '12px', color: t.accentBlue, fontWeight: 600 }}>
                  ● {consolidados.coberturaMedia.toFixed(1)}% média do período
                </div>
              </div>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={historicoPorMes}>
                  <CartesianGrid vertical={false} stroke={t.border} strokeDasharray="3 3" />
                  <XAxis dataKey="mes" tick={{ fill: t.textMuted, fontSize: 12 }} axisLine={{ stroke: t.border }} tickLine={false} />
                  <YAxis domain={[40, 100]} tick={{ fill: t.textMuted, fontSize: 12 }} axisLine={false} tickLine={false} width={38} unit="%" />
                  <Tooltip
                    contentStyle={{ background: t.surfaceElevated, border: `1px solid ${t.border}`, borderRadius: 8, fontSize: 12.5 }}
                    labelStyle={{ color: t.text, fontWeight: 600 }}
                    formatter={(val: any, name: any, item: any) => [
                      `${val}% (${item.payload.positivados} clientes)`,
                      'Cobertura',
                    ]}
                  />
                  <Line
                    type="monotone"
                    dataKey="coberturaPct"
                    stroke={t.accentBlue}
                    strokeWidth={3}
                    dot={{ r: 4, fill: t.accentBlue, strokeWidth: 2, stroke: t.surface }}
                    activeDot={{ r: 6 }}
                    name="% Cobertura"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Gráfico de Margem */}
          {(activeTab === 'todos' || activeTab === 'margem') && (
            <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: '12px', padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
                <div>
                  <div style={{ fontSize: '14.5px', fontWeight: 600, color: t.text }}>Evolução da Margem Comercial</div>
                  <div style={{ fontSize: '12px', color: t.textMuted }}>Rentabilidade percentual histórica mês a mês</div>
                </div>
                <div style={{ fontSize: '12px', color: '#E8B339', fontWeight: 600 }}>
                  ● {consolidados.margemMedia.toFixed(1)}% média do período
                </div>
              </div>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={historicoPorMes}>
                  <CartesianGrid vertical={false} stroke={t.border} strokeDasharray="3 3" />
                  <XAxis dataKey="mes" tick={{ fill: t.textMuted, fontSize: 12 }} axisLine={{ stroke: t.border }} tickLine={false} />
                  <YAxis domain={[12, 26]} tick={{ fill: t.textMuted, fontSize: 12 }} axisLine={false} tickLine={false} width={38} unit="%" />
                  <Tooltip
                    contentStyle={{ background: t.surfaceElevated, border: `1px solid ${t.border}`, borderRadius: 8, fontSize: 12.5 }}
                    labelStyle={{ color: t.text, fontWeight: 600 }}
                    formatter={(val: any) => [`${val}%`, 'Margem Comercial']}
                  />
                  <Line
                    type="monotone"
                    dataKey="margemPct"
                    stroke="#E8B339"
                    strokeWidth={3}
                    dot={{ r: 4, fill: '#E8B339', strokeWidth: 2, stroke: t.surface }}
                    activeDot={{ r: 6 }}
                    name="% Margem"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* TABELA CRONOLÓGICA DETALHADA COM TODOS OS INDICADORES */}
      <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: '12px', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${t.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
          <div>
            <div style={{ fontSize: '14.5px', fontWeight: 600, color: t.text }}>
              Fechamentos Históricos por Mês/Período
            </div>
            <div style={{ fontSize: '12px', color: t.textMuted }}>
              Indicadores de Meta x Realizado (Monetário), Cobertura e Margem conforme filtros selecionados
            </div>
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ color: t.textMuted, background: t.bgSecondary }}>
                {[
                  'Mês / Período',
                  'Meta (Monetário)',
                  'Realizado (Monetário)',
                  'GAP (Monetário)',
                  'Atingimento %',
                  'Cobertura',
                  'Margem %',
                  'Situação',
                ].map((h, i) => (
                  <th
                    key={h}
                    style={{
                      textAlign: i === 0 || i === 7 ? 'left' : 'right',
                      padding: '12px 16px',
                      borderBottom: `1px solid ${t.border}`,
                      fontWeight: 500,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {historicoPorMes.slice().reverse().map((h) => {
                const isBatida = h.atingimento >= 100;
                return (
                  <tr key={h.mes} style={{ borderBottom: `1px solid ${t.border}` }}>
                    <td style={{ padding: '12px 16px', fontWeight: 600, color: t.text }}>{h.mes}</td>
                    <td className="num" style={{ padding: '12px 16px', textAlign: 'right', color: t.textSecondary }}>
                      {fmtR(h.meta)}
                    </td>
                    <td className="num" style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, color: t.text }}>
                      {fmtR(h.realizado)}
                    </td>
                    <td
                      className="num"
                      style={{
                        padding: '12px 16px',
                        textAlign: 'right',
                        fontWeight: 600,
                        color: h.gap >= 0 ? '#3DD68C' : t.primaryHover,
                      }}
                    >
                      {h.gap >= 0 ? '+' : ''}{fmtR(h.gap)}
                    </td>
                    <td
                      className="num"
                      style={{
                        padding: '12px 16px',
                        textAlign: 'right',
                        fontWeight: 700,
                        color: h.atingimento >= 100 ? '#3DD68C' : h.atingimento >= 90 ? t.text : t.primaryHover,
                      }}
                    >
                      {h.atingimento.toFixed(1)}%
                    </td>
                    <td className="num" style={{ padding: '12px 16px', textAlign: 'right', color: t.textSecondary }}>
                      <span style={{ fontWeight: 600, color: h.coberturaPct >= 75 ? '#3DD68C' : t.text }}>
                        {h.coberturaPct.toFixed(1)}%
                      </span>{' '}
                      <span style={{ fontSize: '11.5px', color: t.textMuted }}>
                        ({h.positivados} cli)
                      </span>
                    </td>
                    <td className="num" style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, color: '#E8B339' }}>
                      {h.margemPct.toFixed(1)}%
                    </td>
                    <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                      <span
                        style={{
                          fontSize: '11.5px',
                          fontWeight: 600,
                          padding: '3px 8px',
                          borderRadius: '6px',
                          background: isBatida ? 'rgba(61, 214, 140, 0.15)' : 'rgba(232, 179, 57, 0.15)',
                          color: isBatida ? '#3DD68C' : '#E8B339',
                        }}
                      >
                        {isBatida ? 'Meta Batida' : 'Abaixo da Cota'}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {historicoPorMes.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ padding: '30px 16px', textAlign: 'center', color: t.textMuted }}>
                    Nenhum registro histórico encontrado para os filtros selecionados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
