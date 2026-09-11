import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { RoleBadge } from '../../components/auth/RoleBadge';
import { Role } from '../../types';
import { Users, Shield, Plus, Search, Filter, Edit, CheckCircle, Lock } from 'lucide-react';

export const UsersPage: React.FC = () => {
  const { availableUsers, switchUser, currentUser } = useAuth();
  const { t } = useTheme();

  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('TODOS');

  const filteredUsers = availableUsers.filter((u) => {
    if (roleFilter !== 'TODOS' && u.role !== roleFilter) return false;
    const q = query.toLowerCase();
    return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || u.role.toLowerCase().includes(q);
  });

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '22px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 className="num" style={{ margin: '0 0 6px', fontSize: '24px', fontWeight: 700, color: t.text }}>
            Gestão de Usuários & Controle de Acesso (RBAC)
          </h1>
          <p style={{ margin: 0, fontSize: '13.5px', color: t.textSecondary }}>
            Administração de perfis de usuário e permissões funcionais.
          </p>
        </div>

        <button
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 16px',
            borderRadius: '8px',
            border: 'none',
            background: t.primary,
            color: '#fff',
            fontSize: '13.5px',
            fontWeight: 600,
            cursor: 'pointer',
            boxShadow: '0 2px 10px rgba(227, 6, 19, 0.3)',
          }}
        >
          <Plus size={16} />
          Convidar Usuário
        </button>
      </div>

      {/* Filters row */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '18px', flexWrap: 'wrap' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            border: `1px solid ${t.border}`,
            borderRadius: '8px',
            padding: '10px 14px',
            flex: '1 1 280px',
            background: t.surface,
          }}
        >
          <Search size={16} color={t.textMuted} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nome, e-mail ou perfil..."
            style={{
              border: 'none',
              outline: 'none',
              background: 'transparent',
              color: t.text,
              fontSize: '13.5px',
              width: '100%',
              fontFamily: "'Inter', sans-serif",
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: '6px', overflowX: 'auto' }}>
          {['TODOS', 'ADMIN', 'EMPRESA', 'GERENTE', 'SUPERVISOR', 'VENDEDOR', 'ANALISTA'].map((r) => (
            <button
              key={r}
              onClick={() => setRoleFilter(r)}
              style={{
                fontSize: '12.5px',
                padding: '8px 12px',
                borderRadius: '8px',
                cursor: 'pointer',
                border: `1px solid ${roleFilter === r ? t.primary : t.border}`,
                background: roleFilter === r ? t.primary : t.surface,
                color: roleFilter === r ? '#fff' : t.textSecondary,
                fontWeight: roleFilter === r ? 600 : 500,
                whiteSpace: 'nowrap',
              }}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: '12px', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ color: t.textMuted }}>
                {['Usuário', 'Perfil RBAC', 'Status', 'Último Acesso', 'Ações'].map((h) => (
                  <th key={h} style={{ textAlign: 'left', padding: '12px 16px', borderBottom: `1px solid ${t.border}`, fontWeight: 500, background: t.bgSecondary, whiteSpace: 'nowrap' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((u) => {
                const isCurrent = currentUser?.id === u.id;
                return (
                  <tr key={u.id} style={{ borderBottom: `1px solid ${t.border}`, background: isCurrent ? `${t.primary}08` : 'transparent' }}>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div
                          style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '50%',
                            background: isCurrent ? t.primary : t.surfaceElevated,
                            border: `1px solid ${t.border}`,
                            color: isCurrent ? '#fff' : t.text,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '12px',
                            fontWeight: 600,
                            flexShrink: 0,
                          }}
                        >
                          {u.avatarInitials}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, color: t.text, display: 'flex', alignItems: 'center', gap: '6px' }}>
                            {u.name}
                            {isCurrent && (
                              <span style={{ fontSize: '10.5px', color: t.primary, fontWeight: 700 }}>
                                (Você)
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: '11.5px', color: t.textMuted }}>{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <RoleBadge role={u.role as Role} size="sm" />
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{ color: '#3DD68C', fontSize: '12px', fontWeight: 600 }}>● {u.status}</span>
                    </td>
                    <td style={{ padding: '14px 16px', color: t.textMuted, fontSize: '12px' }}>
                      {u.lastLoginAt}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      {!isCurrent && (
                        <button
                          onClick={() => switchUser(u.id)}
                          style={{
                            fontSize: '12px',
                            padding: '5px 10px',
                            borderRadius: '6px',
                            border: `1px solid ${t.border}`,
                            background: t.surfaceElevated,
                            color: t.primary,
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                          title="Alternar para este perfil para testar permissões"
                        >
                          Simular Acesso
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
