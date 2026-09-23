import React, { useMemo, useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { CheckCircle2, AlertTriangle, XCircle, MinusCircle } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

// ─────────────────────────────────────────────────────────────
// Paleta dos gráficos
// Categórica validada (validate_palette.js) contra as superfícies reais do app:
// claro #FFFFFF e escuro #111827 — separação CVD e visão normal aprovadas.
// A ordem dos slots é o mecanismo de segurança para daltonismo: não reordenar.
// ─────────────────────────────────────────────────────────────
const CATEGORICAL = {
  light: ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300'],
  dark: ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300'],
};

/** Status fixos (não temáticos) — sempre acompanhados de ícone + rótulo. */
export const STATUS_COLORS = {
  good: '#0ca30c',
  warning: '#fab219',
  critical: '#d03b3b',
  neutral: '#8a8f99',
};

/** Divergente em torno de 100% da meta: vermelho (abaixo) ↔ cinza ↔ azul (acima). */
const DIVERGING = {
  light: ['#e34948', '#ee8f8e', '#f6c4c3', '#f0efec', '#b7d3f6', '#6da7ec', '#2a78d6'],
  dark: ['#e66767', '#a83d3f', '#5e2b2e', '#383835', '#1c3f6b', '#256abf', '#5598e7'],
};
/** Limites (em % de atingimento) das 7 classes do divergente. */
const DIVERGING_BREAKS = [70, 85, 97, 103, 115, 130];
export const DIVERGING_LABELS = ['< 70%', '70–85%', '85–97%', '97–103%', '103–115%', '115–130%', '> 130%'];

export function useChartColors() {
  const { mode, t } = useTheme();
  return useMemo(
    () => ({
      series: CATEGORICAL[mode],
      diverging: DIVERGING[mode],
      /** Meta / referência: neutro, para o realizado ser a série em destaque. */
      target: mode === 'dark' ? '#5b6477' : '#c3c2b7',
      other: mode === 'dark' ? '#4b5263' : '#b4b2aa',
      grid: mode === 'dark' ? '#232a3b' : '#eceae4',
      axis: t.textMuted,
      surface: t.surface,
    }),
    [mode, t]
  );
}

// ─────────────────────────────────────────────────────────────
// Formatação
// ─────────────────────────────────────────────────────────────
export const fmtBRL = (v: number) => `R$ ${v.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`;
export const fmtInt = (v: number) => v.toLocaleString('pt-BR', { maximumFractionDigits: 0 });
export const fmtPct = (v: number) => `${v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;

/** Eixos: R$ 1,2 mi / R$ 350 mil. */
export function fmtBRLShort(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `R$ ${(v / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi`;
  if (abs >= 1_000) return `R$ ${(v / 1_000).toLocaleString('pt-BR', { maximumFractionDigits: 0 })} mil`;
  return `R$ ${v.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`;
}

export const MESES_CURTOS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
export const mesLabel = (ano: number, mes: number) => `${MESES_CURTOS[mes - 1] ?? mes}/${String(ano).slice(2)}`;

export const pctOf = (realizado: number, meta: number) => (meta ? (realizado / meta) * 100 : 0);

// ─────────────────────────────────────────────────────────────
// Status de atingimento
// ─────────────────────────────────────────────────────────────
export type AttainmentStatus = 'good' | 'warning' | 'critical' | 'neutral';

export function attainmentStatus(pct: number, hasTarget = true): AttainmentStatus {
  if (!hasTarget) return 'neutral';
  if (pct >= 100) return 'good';
  if (pct >= 80) return 'warning';
  return 'critical';
}

const STATUS_META: Record<AttainmentStatus, { label: string; Icon: typeof CheckCircle2 }> = {
  good: { label: 'Meta atingida', Icon: CheckCircle2 },
  warning: { label: 'Próximo da meta', Icon: AlertTriangle },
  critical: { label: 'Abaixo da meta', Icon: XCircle },
  neutral: { label: 'Sem meta', Icon: MinusCircle },
};

export const StatusTag: React.FC<{ status: AttainmentStatus; compact?: boolean }> = ({ status, compact }) => {
  const { t } = useTheme();
  const { label, Icon } = STATUS_META[status];
  return (
    <span
      style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, color: t.textSecondary, whiteSpace: 'nowrap' }}
      title={label}
    >
      <Icon size={13} color={STATUS_COLORS[status]} aria-hidden />
      {!compact && label}
    </span>
  );
};

// ─────────────────────────────────────────────────────────────
// Estrutura
// ─────────────────────────────────────────────────────────────
export const ChartCard: React.FC<{
  title: string;
  subtitle?: string;
  legend?: React.ReactNode;
  actions?: React.ReactNode;
  height?: number;
  children: React.ReactNode;
  style?: React.CSSProperties;
}> = ({ title, subtitle, legend, actions, height, children, style }) => {
  const { t } = useTheme();
  return (
    <section
      style={{
        background: t.surface,
        border: `1px solid ${t.border}`,
        borderRadius: 12,
        padding: '16px 18px',
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        ...style,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
        <div style={{ minWidth: 0 }}>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: t.text }}>{title}</h3>
          {subtitle && <div style={{ fontSize: 11.5, color: t.textMuted, marginTop: 2 }}>{subtitle}</div>}
        </div>
        {(legend || actions) && (
          <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
            {legend}
            {actions}
          </div>
        )}
      </div>
      <div style={{ flex: 1, minHeight: 0, height }}>{children}</div>
    </section>
  );
};

/** Grade responsiva de cartões: colunas com largura mínima, sem rolagem horizontal. */
export const ChartGrid: React.FC<{ min?: number; children: React.ReactNode; style?: React.CSSProperties }> = ({
  min = 340,
  children,
  style,
}) => (
  <div
    style={{
      display: 'grid',
      gridTemplateColumns: `repeat(auto-fit, minmax(min(${min}px, 100%), 1fr))`,
      gap: 16,
      marginBottom: 16,
      ...style,
    }}
  >
    {children}
  </div>
);

export const LegendSwatch: React.FC<{ color: string; label: string; line?: boolean; dashed?: boolean }> = ({ color, label, line, dashed }) => {
  const { t } = useTheme();
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: t.textSecondary, fontWeight: 500 }}>
      {line ? (
        <span style={{ width: 16, height: 0, borderTop: `2px ${dashed ? 'dashed' : 'solid'} ${color}` }} />
      ) : (
        <span style={{ width: 10, height: 10, borderRadius: 3, background: color }} />
      )}
      {label}
    </span>
  );
};

// ─────────────────────────────────────────────────────────────
// Tooltip temático para Recharts (<Tooltip content={<ChartTooltip ... />} />)
// ─────────────────────────────────────────────────────────────
interface TooltipPayloadItem {
  name?: string;
  value?: number | string;
  color?: string;
  dataKey?: string | number;
  payload?: Record<string, unknown>;
}

export const ChartTooltip: React.FC<{
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string | number;
  /** Formata o valor de cada série (recebe o dataKey para formatos mistos). */
  valueFormatter?: (value: number, dataKey: string) => string;
  /** Linhas extras abaixo das séries (ex.: atingimento calculado). */
  footer?: (row: Record<string, unknown>) => React.ReactNode;
}> = ({ active, payload, label, valueFormatter = (v: number, _dataKey: string) => fmtBRL(v), footer }) => {
  const { t } = useTheme();
  if (!active || !payload || payload.length === 0) return null;
  const row = (payload[0]?.payload ?? {}) as Record<string, unknown>;
  return (
    <div
      style={{
        background: t.surface,
        border: `1px solid ${t.border}`,
        borderRadius: 8,
        padding: '8px 10px',
        fontSize: 12,
        boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
        minWidth: 160,
      }}
    >
      {label !== undefined && label !== '' && <div style={{ fontWeight: 700, color: t.text, marginBottom: 6 }}>{label}</div>}
      {payload.map((p) => (
        <div key={String(p.dataKey)} style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between', padding: '1px 0' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: t.textSecondary }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: p.color }} />
            {p.name}
          </span>
          <span className="num" style={{ color: t.text, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
            {typeof p.value === 'number' ? valueFormatter(p.value, String(p.dataKey)) : p.value}
          </span>
        </div>
      ))}
      {footer && <div style={{ marginTop: 6, paddingTop: 6, borderTop: `1px solid ${t.border}` }}>{footer(row)}</div>}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// Medidor de atingimento (anel) — um número em destaque + progresso visual
// ─────────────────────────────────────────────────────────────
export const AttainmentGauge: React.FC<{
  title: string;
  pct: number;
  meta: number;
  realizado: number;
  formatter: (v: number) => string;
}> = ({ title, pct, meta, realizado, formatter }) => {
  const { t } = useTheme();
  const colors = useChartColors();
  const status = attainmentStatus(pct, meta > 0);
  const size = 104;
  const stroke = 9;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const shown = Math.max(0, Math.min(100, pct));
  // Acima de 100% o anel fica completo e um segundo arco mostra o excedente.
  const overflow = Math.max(0, Math.min(100, pct - 100));
  const ringColor = status === 'neutral' ? colors.other : colors.series[0];
  return (
    <div
      style={{
        background: t.surface,
        border: `1px solid ${t.border}`,
        borderRadius: 12,
        padding: '14px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        minWidth: 0,
      }}
      title={`${title}: ${formatter(realizado)} de ${formatter(meta)} (${fmtPct(pct)})`}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${title}: ${fmtPct(pct)} da meta`} style={{ flexShrink: 0 }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={colors.grid} strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={ringColor}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${(shown / 100) * c} ${c}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dasharray 0.6s ease' }}
        />
        {overflow > 0 && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r - stroke - 2}
            fill="none"
            stroke={colors.series[2]}
            strokeWidth={4}
            strokeLinecap="round"
            strokeDasharray={`${(overflow / 100) * 2 * Math.PI * (r - stroke - 2)} ${c}`}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        )}
        <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central" fill={t.text} fontSize={17} fontWeight={700}>
          {meta > 0 ? `${Math.round(pct)}%` : '—'}
        </text>
      </svg>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 11.5, color: t.textMuted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>
          {title}
        </div>
        <div style={{ fontSize: 12, color: t.textSecondary, marginBottom: 2 }}>
          Realizado <strong className="num" style={{ color: t.text }}>{formatter(realizado)}</strong>
        </div>
        <div style={{ fontSize: 12, color: t.textSecondary, marginBottom: 8 }}>
          Meta <span className="num">{formatter(meta)}</span>
        </div>
        <StatusTag status={status} />
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// Ranking horizontal de atingimento com marcador de 100%
// ─────────────────────────────────────────────────────────────
export interface RankedItem {
  key: string;
  label: string;
  pct: number;
  meta: number;
  realizado: number;
}

export const AttainmentRanking: React.FC<{
  items: RankedItem[];
  formatter?: (v: number) => string;
  onSelect?: (key: string) => void;
  selectedKey?: string | null;
  /** Escala máxima do eixo (padrão: maior valor, mínimo 120%). */
  maxRows?: number;
  emptyText?: string;
}> = ({ items, formatter = fmtBRL, onSelect, selectedKey, maxRows = 12, emptyText = 'Sem dados para ranquear.' }) => {
  const { t } = useTheme();
  const colors = useChartColors();
  const [showAll, setShowAll] = useState(false);
  const sorted = useMemo(() => [...items].sort((a, b) => b.pct - a.pct), [items]);
  const visible = showAll ? sorted : sorted.slice(0, maxRows);
  const scaleMax = Math.max(120, ...sorted.map((i) => i.pct));
  const refLeft = (100 / scaleMax) * 100;

  if (sorted.length === 0) return <div style={{ fontSize: 12.5, color: t.textMuted, padding: '12px 0' }}>{emptyText}</div>;

  return (
    <div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {visible.map((item) => {
          const status = attainmentStatus(item.pct, item.meta > 0);
          const selected = selectedKey === item.key;
          const width = Math.max(0, Math.min(100, (item.pct / scaleMax) * 100));
          const Row = onSelect ? 'button' : 'div';
          return (
            <Row
              key={item.key}
              {...(onSelect ? { type: 'button' as const, onClick: () => onSelect(item.key), 'aria-pressed': selected } : {})}
              title={`${item.label}: ${formatter(item.realizado)} de ${formatter(item.meta)} (${fmtPct(item.pct)})`}
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(80px, 34%) 1fr 64px',
                alignItems: 'center',
                gap: 10,
                padding: '6px 8px',
                borderRadius: 8,
                border: 'none',
                background: selected ? `${colors.series[0]}1f` : 'transparent',
                textAlign: 'left',
                cursor: onSelect ? 'pointer' : 'default',
                width: '100%',
                font: 'inherit',
              }}
              onMouseEnter={(e: React.MouseEvent<HTMLElement>) => {
                if (!selected) e.currentTarget.style.background = t.hover;
              }}
              onMouseLeave={(e: React.MouseEvent<HTMLElement>) => {
                if (!selected) e.currentTarget.style.background = 'transparent';
              }}
            >
              <span style={{ fontSize: 12, color: t.text, fontWeight: selected ? 700 : 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {item.label}
              </span>
              <span style={{ position: 'relative', height: 14, display: 'block' }}>
                <span style={{ position: 'absolute', inset: '5px 0', background: colors.grid, borderRadius: 2 }} />
                <span
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: 2,
                    bottom: 2,
                    width: `${width}%`,
                    background: status === 'neutral' ? colors.other : colors.series[0],
                    borderRadius: '0 4px 4px 0',
                    transition: 'width 0.5s ease',
                  }}
                />
                {/* Marcador da meta (100%) */}
                <span style={{ position: 'absolute', left: `${refLeft}%`, top: -2, bottom: -2, width: 0, borderLeft: `2px dashed ${t.textMuted}` }} />
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
                <span className="num" style={{ fontSize: 12, fontWeight: 700, color: t.text, fontVariantNumeric: 'tabular-nums' }}>
                  {item.meta > 0 ? `${Math.round(item.pct)}%` : '—'}
                </span>
                <StatusTag status={status} compact />
              </span>
            </Row>
          );
        })}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, gap: 8, flexWrap: 'wrap' }}>
        <LegendSwatch color={t.textMuted} label="Meta (100%)" line dashed />
        {sorted.length > maxRows && (
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            style={{ background: 'transparent', border: 'none', color: t.primary, fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: 0 }}
          >
            {showAll ? 'Mostrar menos' : `Ver todos (${sorted.length})`}
          </button>
        )}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// Rosca de participação (parte do todo, no máximo 5 fatias + "Outros")
// ─────────────────────────────────────────────────────────────
export const ShareDonut: React.FC<{
  data: Array<{ label: string; value: number }>;
  formatter?: (v: number) => string;
  totalLabel?: string;
  onSelect?: (label: string) => void;
}> = ({ data, formatter = fmtBRL, totalLabel = 'Total', onSelect }) => {
  const { t } = useTheme();
  const colors = useChartColors();
  const [hovered, setHovered] = useState<number | null>(null);

  const slices = useMemo(() => {
    const positive = data.filter((d) => d.value > 0).sort((a, b) => b.value - a.value);
    const top = positive.slice(0, 5).map((d, i) => ({ ...d, color: colors.series[i], isOther: false }));
    const rest = positive.slice(5);
    if (rest.length > 0) {
      top.push({ label: `Outros (${rest.length})`, value: rest.reduce((s, d) => s + d.value, 0), color: colors.other, isOther: true });
    }
    return top;
  }, [data, colors]);

  const total = slices.reduce((s, d) => s + d.value, 0);
  if (total <= 0) return <div style={{ fontSize: 12.5, color: t.textMuted, padding: '12px 0' }}>Sem valores para compor a participação.</div>;
  const focus = hovered !== null ? slices[hovered] : null;

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 16 }}>
      <div style={{ position: 'relative', width: 180, height: 180, flexShrink: 0, margin: '0 auto' }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={slices}
              dataKey="value"
              nameKey="label"
              innerRadius={58}
              outerRadius={84}
              paddingAngle={1}
              stroke={colors.surface}
              strokeWidth={2}
              isAnimationActive
              onMouseEnter={(_: unknown, i: number) => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
              onClick={(_: unknown, i: number) => {
                const s = slices[i];
                if (onSelect && s && !s.isOther) onSelect(s.label);
              }}
              style={{ cursor: onSelect ? 'pointer' : 'default', outline: 'none' }}
            >
              {slices.map((s, i) => (
                <Cell key={s.label} fill={s.color} opacity={hovered === null || hovered === i ? 1 : 0.35} />
              ))}
            </Pie>
            <Tooltip content={() => null} />
          </PieChart>
        </ResponsiveContainer>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
            textAlign: 'center',
            padding: '0 34px',
          }}
        >
          <div style={{ fontSize: 10.5, color: t.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>
            {focus ? focus.label : totalLabel}
          </div>
          <div className="num" style={{ fontSize: 15, fontWeight: 700, color: t.text }}>
            {focus ? fmtPct((focus.value / total) * 100) : fmtBRLShort(total)}
          </div>
        </div>
      </div>
      {/* Legenda com valores = visão de tabela (identidade nunca só pela cor) */}
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, flex: '1 1 180px', minWidth: 0 }}>
        {slices.map((s, i) => (
          <li
            key={s.label}
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
            onClick={() => onSelect && !s.isOther && onSelect(s.label)}
            style={{
              display: 'grid',
              gridTemplateColumns: '10px 1fr auto',
              alignItems: 'center',
              gap: 8,
              padding: '5px 6px',
              borderRadius: 6,
              fontSize: 12,
              background: hovered === i ? t.hover : 'transparent',
              cursor: onSelect && !s.isOther ? 'pointer' : 'default',
            }}
          >
            <span style={{ width: 10, height: 10, borderRadius: 3, background: s.color }} />
            <span style={{ color: t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={s.label}>
              {s.label}
            </span>
            <span className="num" style={{ color: t.textSecondary, fontVariantNumeric: 'tabular-nums' }} title={formatter(s.value)}>
              {fmtPct((s.value / total) * 100)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// Mapa de calor de atingimento (linhas × meses), escala divergente em 100%
// ─────────────────────────────────────────────────────────────
function divergingIndex(pct: number): number {
  const idx = DIVERGING_BREAKS.findIndex((b) => pct < b);
  return idx === -1 ? DIVERGING_BREAKS.length : idx;
}

/** Tinta legível sobre a cor da célula (luminância relativa simples). */
function inkFor(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return lum > 0.35 ? '#111827' : '#ffffff';
}

export const AttainmentHeatmap: React.FC<{
  rows: string[];
  columns: Array<{ key: string; label: string }>;
  /** valor[linha][coluna] = { meta, realizado } */
  values: Record<string, Record<string, { meta: number; realizado: number }>>;
  onSelectRow?: (row: string) => void;
  selectedRow?: string | null;
  formatter?: (v: number) => string;
}> = ({ rows, columns, values, onSelectRow, selectedRow, formatter = fmtBRL }) => {
  const { t } = useTheme();
  const colors = useChartColors();
  const [hover, setHover] = useState<{ row: string; col: string } | null>(null);
  const cellW = 52;

  return (
    <div>
      <div style={{ overflowX: 'auto', paddingBottom: 4 }}>
        <table style={{ borderCollapse: 'separate', borderSpacing: 2, fontSize: 11, minWidth: '100%' }}>
          <thead>
            <tr>
              <th
                style={{
                  position: 'sticky',
                  left: 0,
                  background: t.surface,
                  textAlign: 'left',
                  color: t.textMuted,
                  fontWeight: 600,
                  padding: '4px 8px 4px 0',
                  zIndex: 1,
                  minWidth: 120,
                }}
              >
                {onSelectRow ? 'Clique para filtrar' : ''}
              </th>
              {columns.map((c) => (
                <th key={c.key} style={{ color: hover?.col === c.key ? t.text : t.textMuted, fontWeight: 600, minWidth: cellW, padding: '4px 0' }}>
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const selected = selectedRow === row;
              return (
                <tr key={row}>
                  <th
                    scope="row"
                    onClick={() => onSelectRow?.(row)}
                    style={{
                      position: 'sticky',
                      left: 0,
                      background: t.surface,
                      textAlign: 'left',
                      fontWeight: selected ? 700 : 500,
                      color: selected || hover?.row === row ? t.text : t.textSecondary,
                      padding: '0 8px 0 0',
                      maxWidth: 180,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      cursor: onSelectRow ? 'pointer' : 'default',
                      zIndex: 1,
                    }}
                    title={row}
                  >
                    {selected ? '● ' : ''}
                    {row}
                  </th>
                  {columns.map((c) => {
                    const v = values[row]?.[c.key];
                    const has = !!v && v.meta > 0;
                    const pct = has ? pctOf(v!.realizado, v!.meta) : 0;
                    const bg = has ? colors.diverging[divergingIndex(pct)] : 'transparent';
                    const isHover = hover?.row === row && hover?.col === c.key;
                    return (
                      <td
                        key={c.key}
                        onMouseEnter={() => setHover({ row, col: c.key })}
                        onMouseLeave={() => setHover(null)}
                        onClick={() => onSelectRow?.(row)}
                        title={
                          v
                            ? `${row} · ${c.label}\nRealizado: ${formatter(v.realizado)}\nMeta: ${formatter(v.meta)}\nAtingimento: ${has ? fmtPct(pct) : 'sem meta'}`
                            : `${row} · ${c.label}: sem dados`
                        }
                        style={{
                          height: 26,
                          textAlign: 'center',
                          borderRadius: 4,
                          background: bg,
                          border: has ? 'none' : `1px dashed ${t.border}`,
                          color: has ? inkFor(bg) : t.textMuted,
                          fontWeight: 600,
                          fontVariantNumeric: 'tabular-nums',
                          cursor: onSelectRow ? 'pointer' : 'default',
                          outline: isHover ? `2px solid ${t.text}` : 'none',
                          outlineOffset: -1,
                        }}
                      >
                        {has ? Math.round(pct) : v ? '·' : ''}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {/* Escala */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, flexWrap: 'wrap', fontSize: 11, color: t.textMuted }}>
        <span>Atingimento da meta:</span>
        <div style={{ display: 'flex', gap: 2 }}>
          {colors.diverging.map((c, i) => (
            <span key={c} title={DIVERGING_LABELS[i]} style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
              <span style={{ width: 34, height: 10, background: c, borderRadius: 2 }} />
              <span style={{ fontSize: 9.5 }}>{DIVERGING_LABELS[i]}</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};
