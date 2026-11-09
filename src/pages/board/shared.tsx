import React from 'react';
import { useTheme } from '../../context/ThemeContext';
import { Database, Plug, type LucideIcon } from 'lucide-react';
import type { FonteRealizado } from '../../lib/api';

export function formatCurrency(value: number): string {
  return (value || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  });
}

export function formatNumber(value: number): string {
  return (value || 0).toLocaleString('pt-BR', { maximumFractionDigits: 0 });
}

export function formatPercent(value: number): string {
  return `${(value || 0).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
}

/** Verde a partir da meta, âmbar perto dela, vermelho longe. */
export function attainmentColor(pct: number): string {
  if (pct >= 100) return '#22c55e';
  if (pct >= 85) return '#f59e0b';
  return '#ef4444';
}

interface KpiCardProps {
  label: string;
  value: string;
  hint?: string;
  icon?: LucideIcon;
  accent?: string;
}

export const KpiCard: React.FC<KpiCardProps> = ({ label, value, hint, icon: Icon, accent }) => {
  const { t } = useTheme();
  const color = accent || t.primary;
  return (
    <div
      style={{
        background: t.surface,
        border: `1px solid ${t.border}`,
        borderRadius: 12,
        padding: '16px 18px',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        minWidth: 0,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {Icon && <Icon size={15} color={color} />}
        <span
          style={{
            fontSize: 11.5,
            fontWeight: 600,
            color: t.textMuted,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
          }}
        >
          {label}
        </span>
      </div>
      <div
        className="num"
        style={{ fontSize: 22, fontWeight: 700, color: t.text, overflow: 'hidden', textOverflow: 'ellipsis' }}
      >
        {value}
      </div>
      {hint && <div style={{ fontSize: 12, color: t.textSecondary }}>{hint}</div>}
    </div>
  );
};

/**
 * Diz, na própria tela, de onde vieram os valores realizados — para não
 * restar dúvida enquanto a integração com a API externa não estiver ligada.
 */
export const SourceBadge: React.FC<{ fonte: FonteRealizado }> = ({ fonte }) => {
  const { t } = useTheme();
  const isApi = fonte === 'api';
  const Icon = isApi ? Plug : Database;
  const color = isApi ? '#22c55e' : t.textMuted;
  return (
    <span
      title={
        isApi
          ? 'Valores realizados consultados na API externa configurada no backend.'
          : 'API externa ainda não configurada: os realizados saem das tabelas do banco. As metas são sempre as importadas pelo administrador.'
      }
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 10px',
        borderRadius: 999,
        border: `1px solid ${t.border}`,
        background: t.surface,
        fontSize: 11.5,
        fontWeight: 600,
        color,
        whiteSpace: 'nowrap',
      }}
    >
      <Icon size={12} />
      {isApi ? 'Realizado via API' : 'Realizado via banco'}
    </span>
  );
};

/** Barra de atingimento usada nas tabelas dos dois quadros. */
export const AttainmentBar: React.FC<{ pct: number }> = ({ pct }) => {
  const { t } = useTheme();
  const color = attainmentColor(pct);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 110 }}>
      <div style={{ flex: 1, height: 6, borderRadius: 3, background: t.bgSecondary, overflow: 'hidden' }}>
        <div style={{ width: `${Math.min(100, Math.max(0, pct))}%`, height: '100%', background: color }} />
      </div>
      <span className="num" style={{ fontSize: 12.5, fontWeight: 600, color, minWidth: 48, textAlign: 'right' }}>
        {formatPercent(pct)}
      </span>
    </div>
  );
};

export const thStyle = (color: string, align: 'left' | 'right' = 'left'): React.CSSProperties => ({
  padding: '10px 12px',
  textAlign: align,
  fontSize: 11.5,
  fontWeight: 600,
  color,
  textTransform: 'uppercase',
  letterSpacing: '0.03em',
  whiteSpace: 'nowrap',
});

export const tdStyle = (color: string, align: 'left' | 'right' = 'left'): React.CSSProperties => ({
  padding: '10px 12px',
  textAlign: align,
  fontSize: 13,
  color,
  whiteSpace: 'nowrap',
});
