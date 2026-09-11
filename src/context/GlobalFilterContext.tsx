import React, { createContext, useContext, useState, useMemo } from 'react';

export type PeriodType = 'semanal' | 'mensal' | 'trimestral' | 'semestral' | 'anual' | 'personalizado';

export interface PeriodOption {
  id: string;
  label: string;
  type: PeriodType;
}

export interface RawPeriodData {
  meta: number;
  realizado: number;
  gap: number;
  atingimento: number;
  margem: number;
  positivados: number;
  naoPositivados: number;
  baseClientes: number;
  ticketMedio: number;
}

export interface PeriodSummaryMetrics extends RawPeriodData {
  margemBruta: number;
  clientesTotal: number;
  clientesPositivados: number;
  clientesNaoPositivados: number;
  positivacaoPct: number;
}

export interface GlobalFilterState {
  periodType: PeriodType;
  selectedPeriod: string;
  startDate: string;
  endDate: string;
  setPeriodType: (type: PeriodType) => void;
  setSelectedPeriod: (period: string) => void;
  setCustomDateRange: (start: string, end: string) => void;
  availablePeriods: PeriodOption[];
  periodMetrics: PeriodSummaryMetrics;
  periodLabel: string;
}

export const PERIOD_PRESETS: Record<PeriodType, PeriodOption[]> = {
  semanal: [
    { id: 'sem-36-2026', label: 'Semana 36 — 2026', type: 'semanal' },
    { id: 'sem-35-2026', label: 'Semana 35 — 2026', type: 'semanal' },
    { id: 'sem-34-2026', label: 'Semana 34 — 2026', type: 'semanal' },
    { id: 'sem-33-2026', label: 'Semana 33 — 2026', type: 'semanal' },
  ],
  mensal: [
    { id: 'set-2026', label: 'Setembro/2026', type: 'mensal' },
    { id: 'ago-2026', label: 'Agosto/2026', type: 'mensal' },
    { id: 'jul-2026', label: 'Julho/2026', type: 'mensal' },
    { id: 'jun-2026', label: 'Junho/2026', type: 'mensal' },
    { id: 'mai-2026', label: 'Maio/2026', type: 'mensal' },
    { id: 'abr-2026', label: 'Abril/2026', type: 'mensal' },
  ],
  trimestral: [
    { id: 't3-2026', label: '3º Trimestre 2026', type: 'trimestral' },
    { id: 't2-2026', label: '2º Trimestre 2026', type: 'trimestral' },
    { id: 't1-2026', label: '1º Trimestre 2026', type: 'trimestral' },
    { id: 't4-2025', label: '4º Trimestre 2025', type: 'trimestral' },
  ],
  semestral: [
    { id: 's2-2026', label: '2º Semestre 2026', type: 'semestral' },
    { id: 's1-2026', label: '1º Semestre 2026', type: 'semestral' },
    { id: 's2-2025', label: '2º Semestre 2025', type: 'semestral' },
    { id: 's1-2025', label: '1º Semestre 2025', type: 'semestral' },
  ],
  anual: [
    { id: 'ano-2026', label: '2026', type: 'anual' },
    { id: 'ano-2025', label: '2025', type: 'anual' },
    { id: 'ano-2024', label: '2024', type: 'anual' },
  ],
  personalizado: [
    { id: 'custom-range', label: 'Período Personalizado', type: 'personalizado' },
  ],
};

// Fixed deterministic metrics per period preset to guarantee data consistency across all pages
const PERIOD_DATA_MAP: Record<string, RawPeriodData> = {
  'Agosto/2026': {
    meta: 5000000,
    realizado: 4800000,
    gap: -200000,
    atingimento: 96.0,
    margem: 24.2,
    positivados: 1380,
    naoPositivados: 462,
    baseClientes: 1842,
    ticketMedio: 3478,
  },
  'Setembro/2026': {
    meta: 4000000,
    realizado: 3214800,
    gap: -785200,
    atingimento: 80.37,
    margem: 24.8,
    positivados: 1294,
    naoPositivados: 548,
    baseClientes: 1842,
    ticketMedio: 2484,
  },
  'Julho/2026': {
    meta: 3900000,
    realizado: 3705000,
    gap: -195000,
    atingimento: 95.0,
    margem: 23.8,
    positivados: 1350,
    naoPositivados: 492,
    baseClientes: 1842,
    ticketMedio: 2744,
  },
  'Junho/2026': {
    meta: 3800000,
    realizado: 3500000,
    gap: -300000,
    atingimento: 92.1,
    margem: 23.0,
    positivados: 1310,
    naoPositivados: 532,
    baseClientes: 1842,
    ticketMedio: 2671,
  },
  'Maio/2026': {
    meta: 3700000,
    realizado: 3900000,
    gap: 200000,
    atingimento: 105.4,
    margem: 25.1,
    positivados: 1410,
    naoPositivados: 432,
    baseClientes: 1842,
    ticketMedio: 2765,
  },
  'Abril/2026': {
    meta: 3600000,
    realizado: 3400000,
    gap: -200000,
    atingimento: 94.4,
    margem: 23.4,
    positivados: 1280,
    naoPositivados: 562,
    baseClientes: 1842,
    ticketMedio: 2656,
  },
  'Semana 36 — 2026': {
    meta: 1000000,
    realizado: 890000,
    gap: -110000,
    atingimento: 89.0,
    margem: 24.5,
    positivados: 812,
    naoPositivados: 1030,
    baseClientes: 1842,
    ticketMedio: 1096,
  },
  'Semana 35 — 2026': {
    meta: 980000,
    realizado: 945000,
    gap: -35000,
    atingimento: 96.4,
    margem: 24.3,
    positivados: 860,
    naoPositivados: 982,
    baseClientes: 1842,
    ticketMedio: 1098,
  },
  'Semana 34 — 2026': {
    meta: 950000,
    realizado: 920000,
    gap: -30000,
    atingimento: 96.8,
    margem: 24.1,
    positivados: 840,
    naoPositivados: 1002,
    baseClientes: 1842,
    ticketMedio: 1095,
  },
  'Semana 33 — 2026': {
    meta: 950000,
    realizado: 910000,
    gap: -40000,
    atingimento: 95.8,
    margem: 23.9,
    positivados: 825,
    naoPositivados: 1017,
    baseClientes: 1842,
    ticketMedio: 1103,
  },
  '3º Trimestre 2026': {
    meta: 12900000,
    realizado: 11719800,
    gap: -1180200,
    atingimento: 90.85,
    margem: 24.4,
    positivados: 1540,
    naoPositivados: 302,
    baseClientes: 1842,
    ticketMedio: 7610,
  },
  '2º Trimestre 2026': {
    meta: 11100000,
    realizado: 10800000,
    gap: -300000,
    atingimento: 97.3,
    margem: 24.2,
    positivados: 1580,
    naoPositivados: 262,
    baseClientes: 1842,
    ticketMedio: 6835,
  },
  '1º Trimestre 2026': {
    meta: 10500000,
    realizado: 10100000,
    gap: -400000,
    atingimento: 96.2,
    margem: 23.8,
    positivados: 1510,
    naoPositivados: 332,
    baseClientes: 1842,
    ticketMedio: 6688,
  },
  '4º Trimestre 2025': {
    meta: 10200000,
    realizado: 9950000,
    gap: -250000,
    atingimento: 97.5,
    margem: 23.5,
    positivados: 1490,
    naoPositivados: 352,
    baseClientes: 1842,
    ticketMedio: 6677,
  },
  '1º Semestre 2026': {
    meta: 21600000,
    realizado: 20900000,
    gap: -700000,
    atingimento: 96.76,
    margem: 24.0,
    positivados: 1680,
    naoPositivados: 162,
    baseClientes: 1842,
    ticketMedio: 12440,
  },
  '2º Semestre 2026': {
    meta: 24000000,
    realizado: 22100000,
    gap: -1900000,
    atingimento: 92.08,
    margem: 24.6,
    positivados: 1660,
    naoPositivados: 182,
    baseClientes: 1842,
    ticketMedio: 13313,
  },
  '1º Semestre 2025': {
    meta: 19800000,
    realizado: 18700000,
    gap: -1100000,
    atingimento: 94.44,
    margem: 23.1,
    positivados: 1620,
    naoPositivados: 222,
    baseClientes: 1842,
    ticketMedio: 11543,
  },
  '2º Semestre 2025': {
    meta: 21000000,
    realizado: 20200000,
    gap: -800000,
    atingimento: 96.19,
    margem: 23.7,
    positivados: 1640,
    naoPositivados: 202,
    baseClientes: 1842,
    ticketMedio: 12317,
  },
  '2026': {
    meta: 45600000,
    realizado: 43000000,
    gap: -2600000,
    atingimento: 94.3,
    margem: 24.3,
    positivados: 1780,
    naoPositivados: 62,
    baseClientes: 1842,
    ticketMedio: 24157,
  },
  '2025': {
    meta: 40800000,
    realizado: 38900000,
    gap: -1900000,
    atingimento: 95.34,
    margem: 23.4,
    positivados: 1740,
    naoPositivados: 102,
    baseClientes: 1842,
    ticketMedio: 22356,
  },
  '2024': {
    meta: 36000000,
    realizado: 34200000,
    gap: -1800000,
    atingimento: 95.0,
    margem: 22.8,
    positivados: 1690,
    naoPositivados: 152,
    baseClientes: 1842,
    ticketMedio: 20236,
  },
};

const GlobalFilterContext = createContext<GlobalFilterState | undefined>(undefined);

export const GlobalFilterProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [periodType, setPeriodTypeState] = useState<PeriodType>('mensal');
  const [selectedPeriod, setSelectedPeriod] = useState<string>('Setembro/2026');
  const [startDate, setStartDate] = useState<string>('2026-08-01');
  const [endDate, setEndDate] = useState<string>('2026-09-09');

  const setPeriodType = (type: PeriodType) => {
    setPeriodTypeState(type);
    const presets = PERIOD_PRESETS[type];
    if (presets && presets.length > 0) {
      if (type === 'personalizado') {
        setSelectedPeriod(`Personalizado (${startDate} a ${endDate})`);
      } else {
        setSelectedPeriod(presets[0].label);
      }
    }
  };

  const setCustomDateRange = (start: string, end: string) => {
    setStartDate(start);
    setEndDate(end);
    setSelectedPeriod(`Personalizado (${start} a ${end})`);
  };

  const availablePeriods = useMemo(() => {
    return PERIOD_PRESETS[periodType] || [];
  }, [periodType]);

  const periodMetrics: PeriodSummaryMetrics = useMemo(() => {
    const raw = PERIOD_DATA_MAP[selectedPeriod] || {
      meta: 4200000,
      realizado: 3950000,
      gap: -250000,
      atingimento: 94.05,
      margem: 24.5,
      positivados: 1320,
      naoPositivados: 522,
      baseClientes: 1842,
      ticketMedio: 2992,
    };

    const base = raw.baseClientes || 1842;
    const pos = raw.positivados || 1294;
    const naoPos = raw.naoPositivados || Math.max(0, base - pos);
    const posPct = base > 0 ? (pos / base) * 100 : 70.3;

    return {
      ...raw,
      margemBruta: raw.margem,
      clientesTotal: base,
      clientesPositivados: pos,
      clientesNaoPositivados: naoPos,
      positivacaoPct: Number(posPct.toFixed(1)),
    };
  }, [selectedPeriod]);

  const periodLabel = useMemo(() => {
    if (periodType === 'personalizado') {
      return `${startDate} até ${endDate}`;
    }
    return selectedPeriod;
  }, [periodType, selectedPeriod, startDate, endDate]);

  return (
    <GlobalFilterContext.Provider
      value={{
        periodType,
        selectedPeriod,
        startDate,
        endDate,
        setPeriodType,
        setSelectedPeriod,
        setCustomDateRange,
        availablePeriods,
        periodMetrics,
        periodLabel,
      }}
    >
      {children}
    </GlobalFilterContext.Provider>
  );
};

export const useGlobalFilter = () => {
  const context = useContext(GlobalFilterContext);
  if (!context) {
    throw new Error('useGlobalFilter must be used within a GlobalFilterProvider');
  }
  return context;
};
