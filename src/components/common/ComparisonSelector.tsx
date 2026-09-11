import React from 'react';
import { useTheme } from '../../context/ThemeContext';
import { Calendar, CalendarRange, ArrowLeftRight, ChevronDown } from 'lucide-react';

export type ComparisonGranularity = 'ano' | 'mes' | 'dia';

export type ComparisonMode =
  | 'ano_vs_ano'
  | 'mes_vs_mes'
  | 'periodo_meses'
  | 'dia_vs_dia'
  | 'periodo_dias'
  | 'mesmo_mes_anos'
  | 'ytd_vs_ytd';

export interface ComparisonConfig {
  granularity: ComparisonGranularity;
  mode: ComparisonMode;
  periodA: string;
  periodB: string;
  labelA: string;
  labelB: string;
  yearA?: number;
  yearB?: number;
  monthA?: number; // 1-12
  monthB?: number; // 1-12
  startMonth?: number;
  endMonth?: number;
  dateA?: string;
  dateB?: string;
  startDateA?: string;
  endDateA?: string;
  startDateB?: string;
  endDateB?: string;
}

interface ComparisonSelectorProps {
  config: ComparisonConfig;
  onChange: (config: ComparisonConfig) => void;
}

const YEARS = [2026, 2025, 2024, 2023, 2022, 2021];

const MONTHS = [
  { value: 1, short: 'Jan', full: 'Janeiro' },
  { value: 2, short: 'Fev', full: 'Fevereiro' },
  { value: 3, short: 'Mar', full: 'Março' },
  { value: 4, short: 'Abr', full: 'Abril' },
  { value: 5, short: 'Mai', full: 'Maio' },
  { value: 6, short: 'Jun', full: 'Junho' },
  { value: 7, short: 'Jul', full: 'Julho' },
  { value: 8, short: 'Ago', full: 'Agosto' },
  { value: 9, short: 'Set', full: 'Setembro' },
  { value: 10, short: 'Out', full: 'Outubro' },
  { value: 11, short: 'Nov', full: 'Novembro' },
  { value: 12, short: 'Dez', full: 'Dezembro' },
];

export const ComparisonSelector: React.FC<ComparisonSelectorProps> = ({ config, onChange }) => {
  const { t } = useTheme();

  // Ensure config has granularity and defaults
  const currentGranularity: ComparisonGranularity = config.granularity || 'ano';
  const currentYearA = config.yearA || 2026;
  const currentYearB = config.yearB || 2025;
  const currentMonthA = config.monthA || 9;
  const currentMonthB = config.monthB || 8;
  const currentStartMonth = config.startMonth || 1;
  const currentEndMonth = config.endMonth || 9;
  const currentDateA = config.dateA || '2026-09-10';
  const currentDateB = config.dateB || '2026-09-09';
  const currentStartDateA = config.startDateA || '2026-09-01';
  const currentEndDateA = config.endDateA || '2026-09-10';
  const currentStartDateB = config.startDateB || '2025-09-01';
  const currentEndDateB = config.endDateB || '2025-09-10';

  const formatShortDate = (iso: string) => {
    if (!iso) return '';
    const parts = iso.split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return iso;
  };

  const handleGranularityChange = (gran: ComparisonGranularity) => {
    if (gran === 'ano') {
      onChange({
        granularity: 'ano',
        mode: 'ano_vs_ano',
        periodA: String(currentYearA),
        periodB: String(currentYearB),
        labelA: `Ano ${currentYearA}`,
        labelB: `Ano ${currentYearB}`,
        yearA: currentYearA,
        yearB: currentYearB,
      });
    } else if (gran === 'mes') {
      const mA = MONTHS.find((m) => m.value === currentMonthA)?.short || 'Set';
      const mB = MONTHS.find((m) => m.value === currentMonthB)?.short || 'Ago';
      onChange({
        granularity: 'mes',
        mode: 'mes_vs_mes',
        periodA: `${mA}/${currentYearA}`,
        periodB: `${mB}/${currentYearA}`,
        labelA: `${mA}/${currentYearA}`,
        labelB: `${mB}/${currentYearA}`,
        monthA: currentMonthA,
        monthB: currentMonthB,
        yearA: currentYearA,
        yearB: currentYearA,
      });
    } else {
      // dia
      onChange({
        granularity: 'dia',
        mode: 'dia_vs_dia',
        periodA: currentDateA,
        periodB: currentDateB,
        labelA: formatShortDate(currentDateA),
        labelB: formatShortDate(currentDateB),
        dateA: currentDateA,
        dateB: currentDateB,
      });
    }
  };

  // Ano changes
  const handleYearChange = (yearA: number, yearB: number) => {
    onChange({
      ...config,
      granularity: 'ano',
      mode: 'ano_vs_ano',
      yearA,
      yearB,
      periodA: String(yearA),
      periodB: String(yearB),
      labelA: `Ano ${yearA}`,
      labelB: `Ano ${yearB}`,
    });
  };

  // Mes changes
  const handleMonthVsMonthChange = (
    mA: number,
    yA: number,
    mB: number,
    yB: number
  ) => {
    const monthObjA = MONTHS.find((m) => m.value === mA)?.short || 'Set';
    const monthObjB = MONTHS.find((m) => m.value === mB)?.short || 'Ago';
    onChange({
      ...config,
      granularity: 'mes',
      mode: 'mes_vs_mes',
      monthA: mA,
      yearA: yA,
      monthB: mB,
      yearB: yB,
      periodA: `${monthObjA}/${yA}`,
      periodB: `${monthObjB}/${yB}`,
      labelA: `${monthObjA}/${yA}`,
      labelB: `${monthObjB}/${yB}`,
    });
  };

  const handleMonthRangeChange = (
    sM: number,
    eM: number,
    yA: number,
    yB: number
  ) => {
    const sMonth = MONTHS.find((m) => m.value === sM)?.short || 'Jan';
    const eMonth = MONTHS.find((m) => m.value === eM)?.short || 'Set';
    onChange({
      ...config,
      granularity: 'mes',
      mode: 'periodo_meses',
      startMonth: sM,
      endMonth: eM,
      yearA: yA,
      yearB: yB,
      periodA: `${sMonth}-${eMonth}/${yA}`,
      periodB: `${sMonth}-${eMonth}/${yB}`,
      labelA: `${sMonth}-${eMonth}/${yA}`,
      labelB: `${sMonth}-${eMonth}/${yB}`,
    });
  };

  // Dia changes
  const handleDayVsDayChange = (dA: string, dB: string) => {
    onChange({
      ...config,
      granularity: 'dia',
      mode: 'dia_vs_dia',
      dateA: dA,
      dateB: dB,
      periodA: dA,
      periodB: dB,
      labelA: formatShortDate(dA),
      labelB: formatShortDate(dB),
    });
  };

  const handleDayRangeChange = (sA: string, eA: string, sB: string, eB: string) => {
    onChange({
      ...config,
      granularity: 'dia',
      mode: 'periodo_dias',
      startDateA: sA,
      endDateA: eA,
      startDateB: sB,
      endDateB: eB,
      periodA: `${sA} a ${eA}`,
      periodB: `${sB} a ${eB}`,
      labelA: `${formatShortDate(sA)} a ${formatShortDate(eA)}`,
      labelB: `${formatShortDate(sB)} a ${formatShortDate(eB)}`,
    });
  };

  const selectStyle: React.CSSProperties = {
    fontSize: '12.5px',
    fontWeight: 500,
    color: t.text,
    background: t.surfaceElevated,
    border: `1px solid ${t.border}`,
    borderRadius: '6px',
    padding: '4px 22px 4px 8px',
    cursor: 'pointer',
    outline: 'none',
    appearance: 'none',
    WebkitAppearance: 'none',
  };

  const dateInputStyle: React.CSSProperties = {
    fontSize: '12px',
    fontWeight: 500,
    color: t.text,
    background: t.surfaceElevated,
    border: `1px solid ${t.border}`,
    borderRadius: '6px',
    padding: '4px 6px',
    cursor: 'pointer',
    outline: 'none',
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        flexWrap: 'wrap',
        background: t.surface,
        border: `1px solid ${t.border}`,
        borderRadius: '10px',
        padding: '6px 12px',
      }}
    >
      {/* Title with icon */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <ArrowLeftRight size={15} color={t.primary} />
        <span
          style={{
            fontSize: '12px',
            fontWeight: 600,
            color: t.textSecondary,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            whiteSpace: 'nowrap',
          }}
        >
          Nível de Análise:
        </span>
      </div>

      {/* Level Selector (Ano / Mês / Dia) */}
      <div
        style={{
          display: 'flex',
          background: t.surfaceElevated,
          border: `1px solid ${t.border}`,
          borderRadius: '8px',
          padding: '2px',
          gap: '2px',
        }}
      >
        {(['ano', 'mes', 'dia'] as ComparisonGranularity[]).map((gran) => {
          const isSelected = currentGranularity === gran;
          const label = gran === 'ano' ? 'Ano' : gran === 'mes' ? 'Mês' : 'Dia';
          return (
            <button
              key={gran}
              onClick={() => handleGranularityChange(gran)}
              style={{
                border: 'none',
                background: isSelected ? t.primary : 'transparent',
                color: isSelected ? '#ffffff' : t.textSecondary,
                fontSize: '12px',
                fontWeight: isSelected ? 600 : 500,
                padding: '4px 12px',
                borderRadius: '6px',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                whiteSpace: 'nowrap',
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* SUB-SELECTIONS ACCORDING TO LEVEL */}

      {/* 1. ANO LEVEL */}
      {currentGranularity === 'ano' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '12px', color: t.textMuted, fontWeight: 500 }}>Base:</span>
          <div style={{ position: 'relative' }}>
            <select
              value={currentYearA}
              onChange={(e) => handleYearChange(Number(e.target.value), currentYearB)}
              style={selectStyle}
            >
              {YEARS.map((y) => (
                <option key={y} value={y}>
                  Ano {y}
                </option>
              ))}
            </select>
            <ChevronDown
              size={12}
              color={t.textMuted}
              style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
            />
          </div>

          <span style={{ fontSize: '12px', color: t.primary, fontWeight: 600 }}>vs</span>

          <span style={{ fontSize: '12px', color: t.textMuted, fontWeight: 500 }}>Comparado:</span>
          <div style={{ position: 'relative' }}>
            <select
              value={currentYearB}
              onChange={(e) => handleYearChange(currentYearA, Number(e.target.value))}
              style={selectStyle}
            >
              {YEARS.map((y) => (
                <option key={y} value={y}>
                  Ano {y}
                </option>
              ))}
            </select>
            <ChevronDown
              size={12}
              color={t.textMuted}
              style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
            />
          </div>

          {/* Presets Ano */}
          <div style={{ position: 'relative', marginLeft: '4px' }}>
            <select
              value=""
              onChange={(e) => {
                const val = e.target.value;
                if (val === '2026_2025') handleYearChange(2026, 2025);
                if (val === '2025_2024') handleYearChange(2025, 2024);
                if (val === '2026_2024') handleYearChange(2026, 2024);
              }}
              style={{
                ...selectStyle,
                color: t.primary,
                background: `${t.primary}12`,
                borderColor: `${t.primary}40`,
                fontWeight: 600,
              }}
            >
              <option value="" disabled>
                Atalhos Ano ▾
              </option>
              <option value="2026_2025">2026 vs 2025</option>
              <option value="2025_2024">2025 vs 2024</option>
              <option value="2026_2024">2026 vs 2024</option>
            </select>
          </div>
        </div>
      )}

      {/* 2. MÊS LEVEL */}
      {currentGranularity === 'mes' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {/* Sub-mode selector */}
          <div style={{ position: 'relative' }}>
            <select
              value={config.mode === 'periodo_meses' ? 'periodo_meses' : 'mes_vs_mes'}
              onChange={(e) => {
                const newMode = e.target.value as ComparisonMode;
                if (newMode === 'periodo_meses') {
                  handleMonthRangeChange(1, 9, currentYearA, currentYearB);
                } else {
                  handleMonthVsMonthChange(currentMonthA, currentYearA, currentMonthB, currentYearB);
                }
              }}
              style={{ ...selectStyle, fontWeight: 600, color: t.primary }}
            >
              <option value="mes_vs_mes">Mês x Mês</option>
              <option value="periodo_meses">Período de Meses</option>
            </select>
            <ChevronDown
              size={12}
              color={t.primary}
              style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
            />
          </div>

          {/* Mode 2.1: Mês vs Mês */}
          {config.mode !== 'periodo_meses' && (
            <>
              {/* Mês A + Ano A */}
              <div style={{ display: 'flex', gap: '4px' }}>
                <div style={{ position: 'relative' }}>
                  <select
                    value={currentMonthA}
                    onChange={(e) =>
                      handleMonthVsMonthChange(
                        Number(e.target.value),
                        currentYearA,
                        currentMonthB,
                        currentYearB
                      )
                    }
                    style={selectStyle}
                  >
                    {MONTHS.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.short}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    size={12}
                    color={t.textMuted}
                    style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
                  />
                </div>
                <div style={{ position: 'relative' }}>
                  <select
                    value={currentYearA}
                    onChange={(e) =>
                      handleMonthVsMonthChange(
                        currentMonthA,
                        Number(e.target.value),
                        currentMonthB,
                        currentYearB
                      )
                    }
                    style={selectStyle}
                  >
                    {YEARS.map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    size={12}
                    color={t.textMuted}
                    style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
                  />
                </div>
              </div>

              <span style={{ fontSize: '12px', color: t.primary, fontWeight: 600 }}>vs</span>

              {/* Mês B + Ano B */}
              <div style={{ display: 'flex', gap: '4px' }}>
                <div style={{ position: 'relative' }}>
                  <select
                    value={currentMonthB}
                    onChange={(e) =>
                      handleMonthVsMonthChange(
                        currentMonthA,
                        currentYearA,
                        Number(e.target.value),
                        currentYearB
                      )
                    }
                    style={selectStyle}
                  >
                    {MONTHS.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.short}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    size={12}
                    color={t.textMuted}
                    style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
                  />
                </div>
                <div style={{ position: 'relative' }}>
                  <select
                    value={currentYearB}
                    onChange={(e) =>
                      handleMonthVsMonthChange(
                        currentMonthA,
                        currentYearA,
                        currentMonthB,
                        Number(e.target.value)
                      )
                    }
                    style={selectStyle}
                  >
                    {YEARS.map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    size={12}
                    color={t.textMuted}
                    style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
                  />
                </div>
              </div>

              {/* Presets Mês x Mês */}
              <div style={{ position: 'relative', marginLeft: '4px' }}>
                <select
                  value=""
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === 'set26_ago26') handleMonthVsMonthChange(9, 2026, 8, 2026);
                    if (val === 'set26_set25') handleMonthVsMonthChange(9, 2026, 9, 2025);
                    if (val === 'ago26_ago25') handleMonthVsMonthChange(8, 2026, 8, 2025);
                  }}
                  style={{
                    ...selectStyle,
                    color: t.primary,
                    background: `${t.primary}12`,
                    borderColor: `${t.primary}40`,
                    fontWeight: 600,
                  }}
                >
                  <option value="" disabled>
                    Atalhos Mês ▾
                  </option>
                  <option value="set26_ago26">Set/26 vs Ago/26 (Mês Anterior)</option>
                  <option value="set26_set25">Set/26 vs Set/25 (Mesmo Mês)</option>
                  <option value="ago26_ago25">Ago/26 vs Ago/25</option>
                </select>
              </div>
            </>
          )}

          {/* Mode 2.2: Período de Meses */}
          {config.mode === 'periodo_meses' && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ fontSize: '11px', color: t.textMuted }}>De</span>
                <div style={{ position: 'relative' }}>
                  <select
                    value={currentStartMonth}
                    onChange={(e) =>
                      handleMonthRangeChange(
                        Number(e.target.value),
                        currentEndMonth,
                        currentYearA,
                        currentYearB
                      )
                    }
                    style={selectStyle}
                  >
                    {MONTHS.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.short}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    size={12}
                    color={t.textMuted}
                    style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
                  />
                </div>
                <span style={{ fontSize: '11px', color: t.textMuted }}>até</span>
                <div style={{ position: 'relative' }}>
                  <select
                    value={currentEndMonth}
                    onChange={(e) =>
                      handleMonthRangeChange(
                        currentStartMonth,
                        Number(e.target.value),
                        currentYearA,
                        currentYearB
                      )
                    }
                    style={selectStyle}
                  >
                    {MONTHS.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.short}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    size={12}
                    color={t.textMuted}
                    style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
                  />
                </div>
              </div>

              {/* Ano A vs Ano B */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <div style={{ position: 'relative' }}>
                  <select
                    value={currentYearA}
                    onChange={(e) =>
                      handleMonthRangeChange(
                        currentStartMonth,
                        currentEndMonth,
                        Number(e.target.value),
                        currentYearB
                      )
                    }
                    style={selectStyle}
                  >
                    {YEARS.map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    size={12}
                    color={t.textMuted}
                    style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
                  />
                </div>

                <span style={{ fontSize: '12px', color: t.primary, fontWeight: 600 }}>vs</span>

                <div style={{ position: 'relative' }}>
                  <select
                    value={currentYearB}
                    onChange={(e) =>
                      handleMonthRangeChange(
                        currentStartMonth,
                        currentEndMonth,
                        currentYearA,
                        Number(e.target.value)
                      )
                    }
                    style={selectStyle}
                  >
                    {YEARS.map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    size={12}
                    color={t.textMuted}
                    style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
                  />
                </div>
              </div>

              {/* Presets Período de Meses */}
              <div style={{ position: 'relative', marginLeft: '4px' }}>
                <select
                  value=""
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === 'jan_set') handleMonthRangeChange(1, 9, 2026, 2025);
                    if (val === 'sem1') handleMonthRangeChange(1, 6, 2026, 2025);
                    if (val === 'tri1') handleMonthRangeChange(1, 3, 2026, 2025);
                  }}
                  style={{
                    ...selectStyle,
                    color: t.primary,
                    background: `${t.primary}12`,
                    borderColor: `${t.primary}40`,
                    fontWeight: 600,
                  }}
                >
                  <option value="" disabled>
                    Atalhos Período ▾
                  </option>
                  <option value="jan_set">Jan-Set (YTD 26 vs 25)</option>
                  <option value="sem1">1º Semestre (26 vs 25)</option>
                  <option value="tri1">1º Trimestre (26 vs 25)</option>
                </select>
              </div>
            </>
          )}
        </div>
      )}

      {/* 3. DIA LEVEL */}
      {currentGranularity === 'dia' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {/* Sub-mode selector */}
          <div style={{ position: 'relative' }}>
            <select
              value={config.mode === 'periodo_dias' ? 'periodo_dias' : 'dia_vs_dia'}
              onChange={(e) => {
                const newMode = e.target.value as ComparisonMode;
                if (newMode === 'periodo_dias') {
                  handleDayRangeChange(
                    currentStartDateA,
                    currentEndDateA,
                    currentStartDateB,
                    currentEndDateB
                  );
                } else {
                  handleDayVsDayChange(currentDateA, currentDateB);
                }
              }}
              style={{ ...selectStyle, fontWeight: 600, color: t.primary }}
            >
              <option value="dia_vs_dia">Dia x Dia</option>
              <option value="periodo_dias">Período de Dias</option>
            </select>
            <ChevronDown
              size={12}
              color={t.primary}
              style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
            />
          </div>

          {/* Mode 3.1: Dia vs Dia */}
          {config.mode !== 'periodo_dias' && (
            <>
              <input
                type="date"
                value={currentDateA}
                onChange={(e) => handleDayVsDayChange(e.target.value, currentDateB)}
                style={dateInputStyle}
              />

              <span style={{ fontSize: '12px', color: t.primary, fontWeight: 600 }}>vs</span>

              <input
                type="date"
                value={currentDateB}
                onChange={(e) => handleDayVsDayChange(currentDateA, e.target.value)}
                style={dateInputStyle}
              />

              {/* Presets Dia x Dia */}
              <div style={{ position: 'relative', marginLeft: '4px' }}>
                <select
                  value=""
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === 'ontem') handleDayVsDayChange('2026-09-10', '2026-09-09');
                    if (val === 'ano_anterior') handleDayVsDayChange('2026-09-10', '2025-09-10');
                    if (val === 'inicio_mes') handleDayVsDayChange('2026-09-01', '2025-09-01');
                  }}
                  style={{
                    ...selectStyle,
                    color: t.primary,
                    background: `${t.primary}12`,
                    borderColor: `${t.primary}40`,
                    fontWeight: 600,
                  }}
                >
                  <option value="" disabled>
                    Atalhos Dia ▾
                  </option>
                  <option value="ontem">10/09 vs 09/09 (Dia Anterior)</option>
                  <option value="ano_anterior">10/09/26 vs 10/09/25 (Mesmo Dia)</option>
                  <option value="inicio_mes">01/09/26 vs 01/09/25</option>
                </select>
              </div>
            </>
          )}

          {/* Mode 3.2: Período de Dias */}
          {config.mode === 'periodo_dias' && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ fontSize: '11px', color: t.textMuted }}>A:</span>
                <input
                  type="date"
                  value={currentStartDateA}
                  onChange={(e) =>
                    handleDayRangeChange(
                      e.target.value,
                      currentEndDateA,
                      currentStartDateB,
                      currentEndDateB
                    )
                  }
                  style={dateInputStyle}
                />
                <span style={{ fontSize: '11px', color: t.textMuted }}>a</span>
                <input
                  type="date"
                  value={currentEndDateA}
                  onChange={(e) =>
                    handleDayRangeChange(
                      currentStartDateA,
                      e.target.value,
                      currentStartDateB,
                      currentEndDateB
                    )
                  }
                  style={dateInputStyle}
                />
              </div>

              <span style={{ fontSize: '12px', color: t.primary, fontWeight: 600 }}>vs</span>

              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ fontSize: '11px', color: t.textMuted }}>B:</span>
                <input
                  type="date"
                  value={currentStartDateB}
                  onChange={(e) =>
                    handleDayRangeChange(
                      currentStartDateA,
                      currentEndDateA,
                      e.target.value,
                      currentEndDateB
                    )
                  }
                  style={dateInputStyle}
                />
                <span style={{ fontSize: '11px', color: t.textMuted }}>a</span>
                <input
                  type="date"
                  value={currentEndDateB}
                  onChange={(e) =>
                    handleDayRangeChange(
                      currentStartDateA,
                      currentEndDateA,
                      currentStartDateB,
                      e.target.value
                    )
                  }
                  style={dateInputStyle}
                />
              </div>

              {/* Presets Período de Dias */}
              <div style={{ position: 'relative', marginLeft: '4px' }}>
                <select
                  value=""
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === 'set_1_10') {
                      handleDayRangeChange('2026-09-01', '2026-09-10', '2025-09-01', '2025-09-10');
                    }
                    if (val === 'ultimos_7') {
                      handleDayRangeChange('2026-09-04', '2026-09-10', '2026-08-28', '2026-09-03');
                    }
                    if (val === 'ultimos_30') {
                      handleDayRangeChange('2026-08-12', '2026-09-10', '2026-07-13', '2026-08-11');
                    }
                  }}
                  style={{
                    ...selectStyle,
                    color: t.primary,
                    background: `${t.primary}12`,
                    borderColor: `${t.primary}40`,
                    fontWeight: 600,
                  }}
                >
                  <option value="" disabled>
                    Atalhos Período ▾
                  </option>
                  <option value="set_1_10">01 a 10 Set (2026 vs 2025)</option>
                  <option value="ultimos_7">Últimos 7 dias vs 7 anteriores</option>
                  <option value="ultimos_30">Últimos 30 dias vs 30 anteriores</option>
                </select>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};
