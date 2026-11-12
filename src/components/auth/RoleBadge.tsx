import React from 'react';
import { Role } from '../../types';
import { useTheme } from '../../context/ThemeContext';

interface RoleBadgeProps {
  role: Role;
  size?: 'sm' | 'md';
  /** Texto exibido; por padrão o próprio código do papel. */
  label?: string;
}

/**
 * Cores dos 10 perfis, no padrão GA 360 (azuis e turquesa, com o vermelho
 * reservado à administração). `Record<Role, …>` garante, em tempo de
 * compilação, que nenhum papel fique de fora.
 */
const PALETA: Record<Role, { bg: string; text: string; border: string }> = {
  SUPERADMIN: { bg: 'rgba(197, 46, 43, 0.18)', text: '#E75F5A', border: 'rgba(197, 46, 43, 0.45)' },
  ADMIN: { bg: 'rgba(197, 46, 43, 0.12)', text: '#E0716D', border: 'rgba(197, 46, 43, 0.35)' },
  GERENTE_COMERCIAL: { bg: 'rgba(68, 171, 170, 0.14)', text: '#49B6B4', border: 'rgba(68, 171, 170, 0.38)' },
  GERENTE_VENDAS: { bg: 'rgba(62, 150, 160, 0.14)', text: '#61A6C2', border: 'rgba(62, 150, 160, 0.38)' },
  COMPRADOR: { bg: 'rgba(43, 96, 120, 0.16)', text: '#61A6C2', border: 'rgba(43, 96, 120, 0.4)' },
  SUPERVISOR: { bg: 'rgba(42, 76, 127, 0.18)', text: '#809CC6', border: 'rgba(42, 76, 127, 0.45)' },
  ANALISTA: { bg: 'rgba(128, 156, 198, 0.14)', text: '#92ACD3', border: 'rgba(128, 156, 198, 0.38)' },
  // Perfil externo: tom âmbar, para destoar à primeira vista dos internos.
  FORNECEDOR: { bg: 'rgba(149, 93, 9, 0.16)', text: '#E0AC52', border: 'rgba(149, 93, 9, 0.42)' },
  VENDEDOR: { bg: 'rgba(32, 121, 74, 0.14)', text: '#4EBC81', border: 'rgba(32, 121, 74, 0.4)' },
  SAR: { bg: 'rgba(42, 76, 127, 0.3)', text: '#9FC4FF', border: 'rgba(42, 76, 127, 0.5)' },
};

/** Rótulos curtos — os compostos não cabem no selo por extenso. */
const ROTULOS: Partial<Record<Role, string>> = {
  SUPERADMIN: 'SUPERADMIN',
  GERENTE_COMERCIAL: 'GER. COMERCIAL',
  GERENTE_VENDAS: 'GER. VENDAS',
};

export const RoleBadge: React.FC<RoleBadgeProps> = ({ role, size = 'md', label }) => {
  const { t } = useTheme();
  const style = PALETA[role] || { bg: t.surfaceElevated, text: t.textSecondary, border: t.border };
  const padding = size === 'sm' ? '2px 8px' : '4px 10px';
  const fontSize = size === 'sm' ? '11px' : '12px';

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '5px',
        padding,
        fontSize,
        fontWeight: 600,
        borderRadius: '6px',
        background: style.bg,
        color: style.text,
        border: `1px solid ${style.border}`,
        letterSpacing: '0.03em',
        textTransform: 'uppercase',
        lineHeight: 1,
        whiteSpace: 'nowrap',
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: style.text }} />
      {label || ROTULOS[role] || role}
    </span>
  );
};
