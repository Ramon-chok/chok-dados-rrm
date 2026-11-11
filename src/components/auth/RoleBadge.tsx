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
 * Cores por perfil, já no padrão GA 360 (azuis e turquesa, com o vermelho
 * reservado ao ADMIN). Cada papel novo entrou aqui junto com os originais —
 * `Record<Role, …>` garante, em tempo de compilação, que nenhum fique de fora.
 */
const PALETA: Record<Role, { bg: string; text: string; border: string }> = {
  ADMIN: { bg: 'rgba(227, 6, 19, 0.12)', text: '#FF5A66', border: 'rgba(227, 6, 19, 0.35)' },
  GERENTE: { bg: 'rgba(245, 165, 36, 0.12)', text: '#F5A524', border: 'rgba(245, 165, 36, 0.35)' },
  GERENTE_COMERCIAL: { bg: 'rgba(45, 212, 191, 0.12)', text: '#2DD4BF', border: 'rgba(45, 212, 191, 0.35)' },
  GERENTE_VENDAS: { bg: 'rgba(94, 234, 212, 0.12)', text: '#5EEAD4', border: 'rgba(94, 234, 212, 0.35)' },
  SUPERVISOR: { bg: 'rgba(47, 127, 240, 0.12)', text: '#6FB4FF', border: 'rgba(47, 127, 240, 0.35)' },
  VENDEDOR: { bg: 'rgba(61, 214, 140, 0.12)', text: '#3DD68C', border: 'rgba(61, 214, 140, 0.35)' },
  COMPRADOR: { bg: 'rgba(167, 139, 250, 0.12)', text: '#A78BFA', border: 'rgba(167, 139, 250, 0.35)' },
  ANALISTA: { bg: 'rgba(129, 180, 255, 0.12)', text: '#81B4FF', border: 'rgba(129, 180, 255, 0.35)' },
  SAR: { bg: 'rgba(21, 57, 110, 0.35)', text: '#9FC4FF', border: 'rgba(47, 127, 240, 0.35)' },
};

/** Rótulos curtos — os compostos não cabem no selo por extenso. */
const ROTULOS: Partial<Record<Role, string>> = {
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
