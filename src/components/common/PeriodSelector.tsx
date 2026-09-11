import React from 'react';
import { useTheme } from '../../context/ThemeContext';
import { useGlobalFilter, PeriodType } from '../../context/GlobalFilterContext';
import { Calendar, ChevronDown } from 'lucide-react';

interface PeriodSelectorProps {
  compact?: boolean;
  className?: string;
}

export const PeriodSelector: React.FC<PeriodSelectorProps> = ({ compact = false, className = '' }) => {
  const { t } = useTheme();
  const {
    periodType,
    selectedPeriod,
    startDate,
    endDate,
    setPeriodType,
    setSelectedPeriod,
    setCustomDateRange,
    availablePeriods,
  } = useGlobalFilter();

  const PERIOD_TYPE_LABELS: { type: PeriodType; label: string }[] = [
    { type: 'semanal', label: 'Semanal' },
    { type: 'mensal', label: 'Mensal' },
    { type: 'trimestral', label: 'Trimestral' },
    { type: 'semestral', label: 'Semestral' },
    { type: 'anual', label: 'Anual' },
    { type: 'personalizado', label: 'Personalizado' },
  ];

  return (
    <div
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        background: t.surface,
        border: `1px solid ${t.border}`,
        borderRadius: '10px',
        padding: compact ? '4px 8px' : '6px 12px',
        flexWrap: 'wrap',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <Calendar size={15} color={t.primary} />
        <span style={{ fontSize: '12px', fontWeight: 600, color: t.textSecondary, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          Período:
        </span>
      </div>

      {/* Type Dropdown */}
      <div style={{ position: 'relative' }}>
        <select
          value={periodType}
          onChange={(e) => setPeriodType(e.target.value as PeriodType)}
          style={{
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
          }}
        >
          {PERIOD_TYPE_LABELS.map((item) => (
            <option key={item.type} value={item.type}>
              {item.label}
            </option>
          ))}
        </select>
        <ChevronDown
          size={13}
          color={t.textMuted}
          style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
        />
      </div>

      {/* Adaptive 2nd selector */}
      {periodType !== 'personalizado' ? (
        <div style={{ position: 'relative' }}>
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
            style={{
              fontSize: '13px',
              fontWeight: 500,
              color: t.primary,
              background: `${t.primary}10`,
              border: `1px solid ${t.primary}40`,
              borderRadius: '6px',
              padding: '5px 26px 5px 10px',
              cursor: 'pointer',
              outline: 'none',
              appearance: 'none',
              WebkitAppearance: 'none',
            }}
          >
            {availablePeriods.map((p) => (
              <option key={p.id} value={p.label}>
                {p.label}
              </option>
            ))}
          </select>
          <ChevronDown
            size={13}
            color={t.primary}
            style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
          />
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setCustomDateRange(e.target.value, endDate)}
            style={{
              fontSize: '12.5px',
              color: t.text,
              background: t.surfaceElevated,
              border: `1px solid ${t.border}`,
              borderRadius: '6px',
              padding: '4px 8px',
              outline: 'none',
            }}
          />
          <span style={{ fontSize: '12px', color: t.textMuted }}>até</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setCustomDateRange(startDate, e.target.value)}
            style={{
              fontSize: '12.5px',
              color: t.text,
              background: t.surfaceElevated,
              border: `1px solid ${t.border}`,
              borderRadius: '6px',
              padding: '4px 8px',
              outline: 'none',
            }}
          />
        </div>
      )}
    </div>
  );
};
