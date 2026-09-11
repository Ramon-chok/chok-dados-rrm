import React from 'react';
import { Role } from '../../types';

interface RoleBadgeProps {
  role: Role;
  size?: 'sm' | 'md';
}

export const RoleBadge: React.FC<RoleBadgeProps> = ({ role, size = 'md' }) => {
  const styles: Record<Role, { bg: string; text: string; border: string }> = {
    ADMIN: { bg: 'rgba(227, 6, 19, 0.12)', text: '#FF1F2D', border: 'rgba(227, 6, 19, 0.35)' },
    GERENTE: { bg: 'rgba(234, 179, 8, 0.12)', text: '#FACC15', border: 'rgba(234, 179, 8, 0.35)' },
    SUPERVISOR: { bg: 'rgba(59, 130, 246, 0.12)', text: '#60A5FA', border: 'rgba(59, 130, 246, 0.35)' },
    VENDEDOR: { bg: 'rgba(34, 197, 94, 0.12)', text: '#4ADE80', border: 'rgba(34, 197, 94, 0.35)' },
  };

  const style = styles[role] || styles.ADMIN;
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
      {role}
    </span>
  );
};
