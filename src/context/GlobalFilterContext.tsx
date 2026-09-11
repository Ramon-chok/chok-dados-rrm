import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { fetchDashboard, fetchNotPositivated } from '../lib/api';
import { useAuth } from './AuthContext';

export type PeriodType = 'semanal' | 'mensal' | 'trimestral' | 'semestral' | 'anual' | 'personalizado';

export interface PeriodOption {
  id: string;
  label: string;
  type: PeriodType;
  ano?: number;
  mes?: number;
  start?: string;
  end?: string;
}

export interface PeriodSummaryMetrics {
  meta: number;
  realizado: number;
  gap: number;
  atingimento: number;
  margem: number;
  margemBruta: number;
  positivados: number;
  naoPositivados: number;
  baseClientes: number;
  clientesTotal: number;
  clientesPositivados: number;
  clientesNaoPositivados: number;
  positivacaoPct: number;
  ticketMedio: number;
}

export interface GlobalFilterState {
  periodType: PeriodType;
  selectedPeriod: string;
  startDate: string;
  endDate: string;
  ano?: number;
  mes?: number;
  setPeriodType: (type: PeriodType) => void;
  setSelectedPeriod: (period: string) => void;
  setCustomDateRange: (start: string, end: string) => void;
  availablePeriods: PeriodOption[];
  periodMetrics: PeriodSummaryMetrics;
  periodLabel: string;
  isLoadingMetrics: boolean;
  metricsError: string | null;
}

function buildMonthlyPresets(now = new Date()): PeriodOption[] {
  const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  const out: PeriodOption[] = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const ano = d.getFullYear();
    const mes = d.getMonth() + 1;
    const label = `${months[mes - 1]}/${ano}`;
    const start = `${ano}-${String(mes).padStart(2, '0')}-01`;
    const lastDay = new Date(ano, mes, 0).getDate();
    const end = `${ano}-${String(mes).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    out.push({ id: `${ano}-${String(mes).padStart(2, '0')}`, label, type: 'mensal', ano, mes, start, end });
  }
  return out;
}

function buildYearlyPresets(now = new Date()): PeriodOption[] {
  const y = now.getFullYear();
  return [0, 1, 2].map((offset) => {
    const ano = y - offset;
    return { id: `ano-${ano}`, label: String(ano), type: 'anual' as const, ano, start: `${ano}-01-01`, end: `${ano}-12-31` };
  });
}

const EMPTY_METRICS: PeriodSummaryMetrics = {
  meta: 0, realizado: 0, gap: 0, atingimento: 0, margem: 0, margemBruta: 0,
  positivados: 0, naoPositivados: 0, baseClientes: 0, clientesTotal: 0,
  clientesPositivados: 0, clientesNaoPositivados: 0, positivacaoPct: 0, ticketMedio: 0,
};

const GlobalFilterContext = createContext<GlobalFilterState | undefined>(undefined);

export const GlobalFilterProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const monthly = useMemo(() => buildMonthlyPresets(), []);
  const yearly = useMemo(() => buildYearlyPresets(), []);

  const [periodType, setPeriodTypeState] = useState<PeriodType>('mensal');
  const [selectedPeriod, setSelectedPeriod] = useState<string>(monthly[0]?.label || '');
  const [startDate, setStartDate] = useState<string>(monthly[0]?.start || '');
  const [endDate, setEndDate] = useState<string>(monthly[0]?.end || '');
  const [ano, setAno] = useState<number | undefined>(monthly[0]?.ano);
  const [mes, setMes] = useState<number | undefined>(monthly[0]?.mes);
  const [periodMetrics, setPeriodMetrics] = useState<PeriodSummaryMetrics>(EMPTY_METRICS);
  const [isLoadingMetrics, setIsLoadingMetrics] = useState(false);
  const [metricsError, setMetricsError] = useState<string | null>(null);

  const availablePeriods = useMemo(() => {
    if (periodType === 'mensal') return monthly;
    if (periodType === 'anual') return yearly;
    if (periodType === 'personalizado') {
      return [{ id: 'custom-range', label: 'Período Personalizado', type: 'personalizado' as const, start: startDate, end: endDate }];
    }
    return monthly;
  }, [periodType, monthly, yearly, startDate, endDate]);

  const applyPreset = (opt: PeriodOption) => {
    setSelectedPeriod(opt.label);
    if (opt.start) setStartDate(opt.start);
    if (opt.end) setEndDate(opt.end);
    setAno(opt.ano);
    setMes(opt.mes);
  };

  const setPeriodType = (type: PeriodType) => {
    setPeriodTypeState(type);
    if (type === 'personalizado') {
      setSelectedPeriod(`Personalizado (${startDate} a ${endDate})`);
      setAno(undefined);
      setMes(undefined);
      return;
    }
    const presets = type === 'anual' ? yearly : monthly;
    if (presets[0]) applyPreset(presets[0]);
  };

  const handleSetSelectedPeriod = (period: string) => {
    const found = availablePeriods.find((p) => p.label === period || p.id === period);
    if (found) applyPreset(found);
    else setSelectedPeriod(period);
  };

  const setCustomDateRange = (start: string, end: string) => {
    setStartDate(start);
    setEndDate(end);
    setSelectedPeriod(`Personalizado (${start} a ${end})`);
    setAno(undefined);
    setMes(undefined);
  };

  useEffect(() => {
    if (!isAuthenticated) {
      setPeriodMetrics(EMPTY_METRICS);
      setMetricsError(null);
      return;
    }
    let mounted = true;
    (async () => {
      setIsLoadingMetrics(true);
      setMetricsError(null);
      try {
        const dash = await fetchDashboard({
          ano: periodType === 'personalizado' ? undefined : ano,
          mes: periodType === 'mensal' ? mes : undefined,
          start: startDate || undefined,
          end: endDate || undefined,
        });
        let pos = { baseClientes: 0, positivados: 0, naoPositivados: 0, positivacaoPct: 0 };
        try {
          const np = await fetchNotPositivated({ start: startDate || undefined, end: endDate || undefined });
          pos = np.kpis;
        } catch { /* optional */ }
        if (!mounted) return;
        const k = dash.kpis;
        setPeriodMetrics({
          meta: k.meta, realizado: k.realizado, gap: k.gap, atingimento: k.atingimento,
          margem: k.margem, margemBruta: k.margem,
          positivados: pos.positivados, naoPositivados: pos.naoPositivados,
          baseClientes: pos.baseClientes, clientesTotal: pos.baseClientes,
          clientesPositivados: pos.positivados, clientesNaoPositivados: pos.naoPositivados,
          positivacaoPct: pos.positivacaoPct,
          ticketMedio: pos.positivados > 0 ? k.realizado / pos.positivados : 0,
        });
      } catch (err) {
        if (!mounted) return;
        setPeriodMetrics(EMPTY_METRICS);
        setMetricsError(err instanceof Error ? err.message : 'Falha ao carregar métricas do período.');
      } finally {
        if (mounted) setIsLoadingMetrics(false);
      }
    })();
    return () => { mounted = false; };
  }, [isAuthenticated, periodType, ano, mes, startDate, endDate]);

  const periodLabel = useMemo(() => {
    if (periodType === 'personalizado') return `${startDate} até ${endDate}`;
    return selectedPeriod;
  }, [periodType, selectedPeriod, startDate, endDate]);

  return (
    <GlobalFilterContext.Provider
      value={{
        periodType, selectedPeriod, startDate, endDate, ano, mes,
        setPeriodType, setSelectedPeriod: handleSetSelectedPeriod, setCustomDateRange,
        availablePeriods, periodMetrics, periodLabel, isLoadingMetrics, metricsError,
      }}
    >
      {children}
    </GlobalFilterContext.Provider>
  );
};

export function useGlobalFilter(): GlobalFilterState {
  const ctx = useContext(GlobalFilterContext);
  if (!ctx) throw new Error('useGlobalFilter must be used within GlobalFilterProvider');
  return ctx;
}
