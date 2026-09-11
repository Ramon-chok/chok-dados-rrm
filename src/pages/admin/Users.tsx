import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { RoleBadge } from '../../components/auth/RoleBadge';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '../../components/common/DataState';
import { Role } from '../../types';
import { Search, Plus, X } from 'lucide-react'; // Importado o ícone X para o Modal
import { apiCreateUser } from '../../lib/api';

export const UsersPage: React.FC = () => {
  const { availableUsers, currentUser, refreshUsers } = useAuth();
  const { t } = useTheme();
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('TODOS');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createEmail, setCreateEmail] = useState('');
  const [createPassword, setCreatePassword] = useState('');
  const [createRole, setCreateRole] = useState<Role>('VENDEDOR');
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Estado para efeito de hover dinâmico na tabela (inline-styles amigável)
  const [hoveredRowId, setHoveredRowId] = useState<string | null>(null);

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
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '12px 0' }}>
      
      {/* HEADER PRINCIPAL - Responsivo e alinhado */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        gap: '16px', 
        marginBottom: '28px', 
        flexWrap: 'wrap' 
      }}>
        <div>
          <h1 className="num" style={{ margin: '0 0 6px', fontSize: '26px', fontWeight: 700, color: t.text }}>
            Gestão de Usuários & Controle de Acesso
          </h1>
          <p style={{ margin: 0, fontSize: '14px', color: t.textSecondary }}>
            Administração de perfis de usuário e permissões funcionais.
          </p>
        </div>

        <button
          onClick={() => setIsCreateModalOpen(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '11px 18px',
            borderRadius: '8px',
            border: 'none',
            background: t.primary,
            color: '#fff',
            fontSize: '13.5px',
            fontWeight: 600,
            cursor: 'pointer',
            boxShadow: `0 4px 12px ${t.primary}40`,
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={(e) => e.currentTarget.style.filter = 'brightness(1.1)'}
          onMouseLeave={(e) => e.currentTarget.style.filter = 'none'}
        >
          <Plus size={16} />
          Cadastrar Usuário
        </button>
      </div>

      {/* FILTROS & BUSCA */}
      <div style={{ 
        display: 'flex', 
        gap: '12px', 
        marginBottom: '24px', 
        flexWrap: 'wrap',
        alignItems: 'center'
      }}>
        {/* Input de Busca */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '10px', 
          border: `1px solid ${t.border}`, 
          borderRadius: '8px', 
          padding: '10px 14px', 
          flex: '1 1 280px', 
          background: t.surface,
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          transition: 'border-color 0.2s ease'
        }}>
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
              width: '100%' 
            }} 
          />
        </div>

        {/* Filtros de Role Pills */}
        <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '4px' }}>
          {['TODOS', 'ADMIN', 'GERENTE', 'SUPERVISOR', 'VENDEDOR'].map((r) => {
            const isActive = roleFilter === r;
            return (
              <button 
                key={r} 
                onClick={() => setRoleFilter(r)} 
                style={{ 
                  fontSize: '12.5px', 
                  padding: '8px 14px', 
                  borderRadius: '20px', 
                  cursor: 'pointer', 
                  border: `1px solid ${isActive ? t.primary : t.border}`, 
                  background: isActive ? t.primary : t.surface, 
                  color: isActive ? '#fff' : t.textSecondary, 
                  fontWeight: isActive ? 600 : 500,
                  whiteSpace: 'nowrap',
                  transition: 'all 0.15s ease',
                }}
              >
                {r}
              </button>
            );
          })}
        </div>
      </div>

      {/* RENDERIZADOR DE ESTADOS */}
      {loading && <LoadingBlock />}
      {error && <ErrorBlock message={error} />}
      {!loading && !error && filteredUsers.length === 0 && <EmptyBlock title="Nenhum usuário correspondente encontrado" />}
      
      {/* LISTA / TABELA */}
      {!loading && !error && filteredUsers.length > 0 && (
        <div style={{ 
          background: t.surface, 
          border: `1px solid ${t.border}`, 
          borderRadius: '12px', 
          overflow: 'hidden',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)'
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13.5px' }}>
            <thead>
              <tr style={{ color: t.textMuted, borderBottom: `2px solid ${t.border}` }}>
                {['Usuário', 'Perfil', 'Status', 'Último acesso'].map((h) => (
                  <th key={h} style={{ textAlign: 'left', padding: '14px 20px', background: t.bgSecondary, fontWeight: 600 }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((u) => {
                const isCurrentUser = currentUser?.id === u.id;
                const isHovered = hoveredRowId === u.id;

                return (
                  <tr 
                    key={u.id} 
                    onMouseEnter={() => setHoveredRowId(u.id)}
                    onMouseLeave={() => setHoveredRowId(null)}
                    style={{ 
                      borderBottom: `1px solid ${t.border}`, 
                      transition: 'background-color 0.15s ease',
                      background: isCurrentUser 
                        ? `${t.primary}08` 
                        : isHovered 
                          ? `${t.textMuted}06` 
                          : 'transparent'
                    }}
                  >
                    {/* Coluna do Usuário */}
                    <td style={{ padding: '14px 20px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, color: t.text }}>
                            {u.name}
                            {isCurrentUser && (
                              <span style={{ 
                                background: `${t.primary}18`, 
                                color: t.primary, 
                                fontSize: '10.5px', 
                                padding: '1px 6px', 
                                borderRadius: '4px',
                                fontWeight: 700
                              }}>
                                Você
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: '11.5px', color: t.textMuted, marginTop: '2px' }}>{u.email}</div>
                        </div>
                      </div>
                    </td>

                    {/* Coluna do Perfil */}
                    <td style={{ padding: '14px 20px' }}>
                      <RoleBadge role={u.role as Role} size="sm" />
                    </td>

                    {/* Coluna do Status */}
                    <td style={{ padding: '14px 20px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ 
                          width: '7px', 
                          height: '7px', 
                          borderRadius: '50%', 
                          background: '#3DD68C', 
                          display: 'inline-block' 
                        }} />
                        <span style={{ color: t.text, fontSize: '12.5px', fontWeight: 500 }}>
                          {u.status}
                        </span>
                      </div>
                    </td>

                    {/* Coluna do Último Acesso */}
                    <td style={{ padding: '14px 20px', color: t.textMuted, fontSize: '12.5px' }}>
                      {u.lastLoginAt || '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* MODAL DE CRIAÇÃO */}
      {isCreateModalOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.4)',
            backdropFilter: 'blur(4px)', // Desfoca o fundo delicadamente
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '20px',
          }}
        >
          <div
            style={{
              background: t.surface,
              border: `1px solid ${t.border}`,
              borderRadius: '16px',
              padding: '24px',
              width: '100%',
              maxWidth: '480px',
              boxShadow: '0 24px 48px rgba(0,0,0,0.2)',
              position: 'relative'
            }}
          >
            {/* Header do Modal */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: t.text }}>
                Convidar Novo Usuário
              </h3>
              <button 
                onClick={() => setIsCreateModalOpen(false)}
                style={{ 
                  background: 'transparent', 
                  border: 'none', 
                  color: t.textSecondary, 
                  cursor: 'pointer',
                  padding: '4px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <X size={18} />
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setCreateLoading(true);
                setCreateError(null);
                try {
                  await apiCreateUser({ name: createName, email: createEmail, password: createPassword, role: createRole });
                  await refreshUsers();
                  setIsCreateModalOpen(false);
                  setCreateName('');
                  setCreateEmail('');
                  setCreatePassword('');
                  setCreateRole('VENDEDOR');
                } catch (err) {
                  setCreateError(err instanceof Error ? err.message : 'Falha ao criar usuário');
                } finally {
                  setCreateLoading(false);
                }
              }}
            >
              {/* Nome */}
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: t.textSecondary, marginBottom: '6px' }}>Nome completo</label>
                <input 
                  required 
                  disabled={createLoading}
                  value={createName} 
                  onChange={(e) => setCreateName(e.target.value)} 
                  style={{ 
                    width: '100%', 
                    boxSizing: 'border-box',
                    padding: '10px 12px', 
                    borderRadius: '8px', 
                    border: `1px solid ${t.border}`, 
                    background: t.surfaceElevated, 
                    color: t.text,
                    outline: 'none',
                    fontSize: '13.5px'
                  }} 
                />
              </div>

              {/* Email */}
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: t.textSecondary, marginBottom: '6px' }}>E-mail corporativo</label>
                <input 
                  required 
                  type="email" 
                  disabled={createLoading}
                  value={createEmail} 
                  onChange={(e) => setCreateEmail(e.target.value)} 
                  style={{ 
                    width: '100%', 
                    boxSizing: 'border-box',
                    padding: '10px 12px', 
                    borderRadius: '8px', 
                    border: `1px solid ${t.border}`, 
                    background: t.surfaceElevated, 
                    color: t.text,
                    outline: 'none',
                    fontSize: '13.5px'
                  }} 
                />
              </div>

              {/* Senha */}
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: t.textSecondary, marginBottom: '6px' }}>Senha temporária</label>
                <input 
                  required 
                  type="password" 
                  disabled={createLoading}
                  value={createPassword} 
                  onChange={(e) => setCreatePassword(e.target.value)} 
                  style={{ 
                    width: '100%', 
                    boxSizing: 'border-box',
                    padding: '10px 12px', 
                    borderRadius: '8px', 
                    border: `1px solid ${t.border}`, 
                    background: t.surfaceElevated, 
                    color: t.text,
                    outline: 'none',
                    fontSize: '13.5px'
                  }} 
                />
              </div>

              {/* Perfil */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: t.textSecondary, marginBottom: '6px' }}>Perfil de acesso</label>
                <select 
                  value={createRole} 
                  disabled={createLoading}
                  onChange={(e) => setCreateRole(e.target.value as Role)} 
                  style={{ 
                    width: '100%', 
                    boxSizing: 'border-box',
                    padding: '10px 12px', 
                    borderRadius: '8px', 
                    border: `1px solid ${t.border}`, 
                    background: t.surfaceElevated, 
                    color: t.text,
                    outline: 'none',
                    fontSize: '13.5px',
                    cursor: 'pointer'
                  }}
                >
                  {['ADMIN', 'GERENTE', 'SUPERVISOR', 'VENDEDOR'].map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>

              {/* Box de Erro Customizado */}
              {createError && (
                <div style={{ 
                  color: '#e23f3f', 
                  background: '#e23f3f15', 
                  border: '1px solid #e23f3f30', 
                  borderRadius: '6px', 
                  padding: '10px 12px', 
                  fontSize: '12.5px', 
                  marginBottom: '16px',
                  fontWeight: 500
                }}>
                  {createError}
                </div>
              )}

              {/* Botões de Ação */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button 
                  type="button" 
                  disabled={createLoading}
                  onClick={() => setIsCreateModalOpen(false)} 
                  style={{ 
                    padding: '10px 16px', 
                    borderRadius: '8px', 
                    border: `1px solid ${t.border}`, 
                    background: t.surfaceElevated, 
                    color: t.textSecondary, 
                    cursor: 'pointer',
                    fontSize: '13.5px',
                    fontWeight: 500
                  }}
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  disabled={createLoading} 
                  style={{ 
                    padding: '10px 18px', 
                    borderRadius: '8px', 
                    border: 'none', 
                    background: t.primary, 
                    color: '#fff', 
                    cursor: 'pointer',
                    fontSize: '13.5px',
                    fontWeight: 600,
                    opacity: createLoading ? 0.7 : 1,
                    transition: 'all 0.2s ease'
                  }}
                >
                  {createLoading ? 'Enviando...' : 'Convidar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};