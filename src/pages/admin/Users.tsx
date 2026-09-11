import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { RoleBadge } from '../../components/auth/RoleBadge';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '../../components/common/DataState';
import { Role } from '../../types';
import { Search } from 'lucide-react';

export const UsersPage: React.FC = () => {
  const { availableUsers, currentUser, refreshUsers } = useAuth();
  const { t } = useTheme();
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('TODOS');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true); setError(null);
      try { await refreshUsers(); }
      catch (e) { if (mounted) setError(e instanceof Error ? e.message : 'Falha ao listar usuários'); }
      finally { if (mounted) setLoading(false); }
    })();
    return () => { mounted = false; };
  }, [refreshUsers]);

  const filteredUsers = availableUsers.filter((u) => {
    if (roleFilter !== 'TODOS' && u.role !== roleFilter) return false;
    const q = query.toLowerCase();
    return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || u.role.toLowerCase().includes(q);
  });

  return (
    <div>
      <div style={{ marginBottom: 22 }}>
        <h1 className="num" style={{ margin: '0 0 6px', fontSize: 24, fontWeight: 700, color: t.text }}>Usuários</h1>
        <p style={{ margin: 0, fontSize: 13.5, color: t.textSecondary }}>Lista via /api/users com token JWT de administrador.</p>
      </div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 18, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, border: `1px solid ${t.border}`, borderRadius: 8, padding: '10px 14px', flex: '1 1 280px', background: t.surface }}>
          <Search size={16} color={t.textMuted} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar..." style={{ border: 'none', outline: 'none', background: 'transparent', color: t.text, fontSize: 13.5, width: '100%' }} />
        </div>
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto' }}>
          {['TODOS', 'ADMIN', 'GERENTE', 'SUPERVISOR', 'VENDEDOR'].map((r) => (
            <button key={r} onClick={() => setRoleFilter(r)} style={{ fontSize: 12.5, padding: '8px 12px', borderRadius: 8, cursor: 'pointer', border: `1px solid ${roleFilter === r ? t.primary : t.border}`, background: roleFilter === r ? t.primary : t.surface, color: roleFilter === r ? '#fff' : t.textSecondary, fontWeight: roleFilter === r ? 600 : 500 }}>{r}</button>
          ))}
        </div>
      </div>
      {loading && <LoadingBlock />}
      {error && <ErrorBlock message={error} />}
      {!loading && !error && filteredUsers.length === 0 && <EmptyBlock title="Sem usuários" />}
      {!loading && !error && filteredUsers.length > 0 && (
        <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 12, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ color: t.textMuted }}>
                {['Usuário', 'Perfil', 'Status', 'Último acesso'].map((h) => (
                  <th key={h} style={{ textAlign: 'left', padding: '12px 16px', borderBottom: `1px solid ${t.border}`, background: t.bgSecondary }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((u) => (
                <tr key={u.id} style={{ borderBottom: `1px solid ${t.border}`, background: currentUser?.id === u.id ? `${t.primary}08` : 'transparent' }}>
                  <td style={{ padding: '14px 16px' }}>
                    <div style={{ fontWeight: 600, color: t.text }}>{u.name}{currentUser?.id === u.id ? ' (Você)' : ''}</div>
                    <div style={{ fontSize: 11.5, color: t.textMuted }}>{u.email}</div>
                  </td>
                  <td style={{ padding: '14px 16px' }}><RoleBadge role={u.role as Role} size="sm" /></td>
                  <td style={{ padding: '14px 16px' }}><span style={{ color: '#3DD68C', fontSize: 12, fontWeight: 600 }}>● {u.status}</span></td>
                  <td style={{ padding: '14px 16px', color: t.textMuted, fontSize: 12 }}>{u.lastLoginAt || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
