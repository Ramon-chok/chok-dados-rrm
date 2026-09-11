import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { RoleBadge } from '../../components/auth/RoleBadge';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '../../components/common/DataState';
import { Role } from '../../types';
import { Search, Plus, X, User, MapPin, Briefcase, Eye, EyeOff, Pencil } from 'lucide-react';
import { apiCreateUser, apiUpdateUser } from '../../lib/api'; // Importado o apiUpdateUser integrado

export const UsersPage: React.FC = () => {
  const { availableUsers, currentUser, refreshUsers } = useAuth();
  const { t } = useTheme();
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('TODOS');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Estados para o Modal de Cadastro
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createCode, setCreateCode] = useState('');
  const [createName, setCreateName] = useState('');
  const [createEmail, setCreateEmail] = useState('');
  const [createPhone, setCreatePhone] = useState('');
  const [createZipCode, setCreateZipCode] = useState('');
  const [createState, setCreateState] = useState('');
  const [createNumber, setCreateNumber] = useState('');
  const [createAddress, setCreateAddress] = useState('');
  const [createNeighborhood, setCreateNeighborhood] = useState('');
  const [createMunicipality, setCreateMunicipality] = useState('');
  const [createPassword, setCreatePassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [createRole, setCreateRole] = useState<Role>('VENDEDOR');
  const [createTeam, setCreateTeam] = useState('');
  const [createSupervisor, setCreateSupervisor] = useState('');
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [cepLoading, setCepLoading] = useState(false);

  // Estados para o Modal de Edição
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editUserId, setEditUserId] = useState<string | null>(null);
  const [editCode, setEditCode] = useState('');
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editZipCode, setEditZipCode] = useState('');
  const [editState, setEditState] = useState('');
  const [editNumber, setEditNumber] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editNeighborhood, setEditNeighborhood] = useState('');
  const [editMunicipality, setEditMunicipality] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [showEditPassword, setShowEditPassword] = useState(false);
  const [editRole, setEditRole] = useState<Role>('VENDEDOR');
  const [editTeam, setEditTeam] = useState('');
  const [editSupervisor, setEditSupervisor] = useState('');
  const [editStatus, setEditStatus] = useState('Ativo');
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editCepLoading, setEditCepLoading] = useState(false);

  // Estado para efeito de hover dinâmico na tabela
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

  // Função para abrir o modal de Edição populando os campos existentes de forma segura
  const handleOpenEditModal = (user: any) => {
    setEditUserId(user.id);
    setEditCode(user.sellerCode || user.code || '');
    setEditName(user.name || '');
    setEditEmail(user.email || '');
    setEditPhone(user.phone || '');
    setEditZipCode(user.cep || user.zipCode || '');
    setEditState(user.state || '');
    setEditNumber(user.number || '');
    setEditAddress(user.address || '');
    setEditNeighborhood(user.neighborhood || '');
    setEditMunicipality(user.city || user.municipality || '');
    setEditPassword(''); // Senha inicia em branco (opcional para alteração)
    setEditRole((user.role as Role) || 'VENDEDOR');
    setEditTeam(user.team || '');
    setEditSupervisor(user.supervisor || '');
    setEditStatus(user.status || 'Ativo');
    setEditError(null);
    setIsEditModalOpen(true);
  };

  // Limpa formulários ao fechar
  const handleCloseModal = () => {
    setIsCreateModalOpen(false);
    setCreateCode('');
    setCreateName('');
    setCreateEmail('');
    setCreatePhone('');
    setCreateZipCode('');
    setCreateState('');
    setCreateNumber('');
    setCreateAddress('');
    setCreateNeighborhood('');
    setCreateMunicipality('');
    setCreatePassword('');
    setCreateRole('VENDEDOR');
    setCreateTeam('');
    setCreateSupervisor('');
    setCreateError(null);
  };

  const handleCloseEditModal = () => {
    setIsEditModalOpen(false);
    setEditUserId(null);
    setEditPassword('');
    setEditError(null);
  };

  const labelStyle = {
    display: 'block', 
    fontSize: '12px', 
    fontWeight: 600, 
    color: t.textSecondary, 
    marginBottom: '6px'
  };

  const inputStyle = {
    width: '100%', 
    boxSizing: 'border-box' as const,
    padding: '10px 12px', 
    borderRadius: '8px', 
    border: `1px solid ${t.border}`, 
    background: t.surfaceElevated, 
    color: t.text,
    outline: 'none',
    fontSize: '13.5px',
    transition: 'border-color 0.2s ease',
  };

  // Password helpers
  function computePasswordScore(pw: string) {
    let score = 0;
    if (pw.length >= 8) score++;
    if (pw.length >= 12) score++;
    if (/[A-Z]/.test(pw)) score++;
    if (/[a-z]/.test(pw)) score++;
    if (/[0-9]/.test(pw)) score++;
    if (/[^A-Za-z0-9]/.test(pw)) score++;
    return Math.min(score, 4);
  }

  function passwordLabel(score: number) {
    switch (score) {
      case 0: return 'Muito fraca';
      case 1: return 'Fraca';
      case 2: return 'Razoável';
      case 3: return 'Boa';
      case 4: return 'Muito forte';
      default: return '';
    }
  }

  function passwordColor(score: number) {
    switch (score) {
      case 0: return '#e23f3f';
      case 1: return '#f25c5c';
      case 2: return '#f5a623';
      case 3: return '#3dd68c';
      case 4: return '#0f9b7c';
      default: return '#ccc';
    }
  }

  function generateStrongPassword(len = 12) {
    const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lower = 'abcdefghijklmnopqrstuvwxyz';
    const digits = '0123456789';
    const symbols = '!@#$%&*()-_=+[]{};:,.<>?';
    const all = upper + lower + digits + symbols;
    const getRand = (chars: string) =>
      chars[Math.floor((crypto.getRandomValues(new Uint32Array(1))[0] / 0xffffffff) * chars.length)];
    
    let pw = '';
    pw += getRand(upper);
    pw += getRand(lower);
    pw += getRand(digits);
    pw += getRand(symbols);
    for (let i = 4; i < len; i++) pw += getRand(all);
    
    const arr = pw.split('');
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr.join('');
  }

  // CEP lookup genérico
  async function lookupCep(cepRaw: string, isEdit: boolean) {
    const cep = cepRaw.replace(/\D/g, '');
    if (cep.length !== 8) return;
    if (isEdit) setEditCepLoading(true); else setCepLoading(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      if (!res.ok) throw new Error('CEP não encontrado');
      const data = await res.json();
      if (data.erro) throw new Error('CEP inválido');
      
      if (isEdit) {
        if (data.logradouro) setEditAddress(data.logradouro);
        if (data.bairro) setEditNeighborhood(data.bairro);
        if (data.localidade) setEditMunicipality(data.localidade);
        if (data.uf) setEditState(data.uf.toUpperCase());
      } else {
        if (data.logradouro) setCreateAddress(data.logradouro);
        if (data.bairro) setCreateNeighborhood(data.bairro);
        if (data.localidade) setCreateMunicipality(data.localidade);
        if (data.uf) setCreateState(data.uf.toUpperCase());
      }
    } catch (err) {
      console.debug('CEP lookup failed', err);
    } finally {
      if (isEdit) setEditCepLoading(false); else setCepLoading(false);
    }
  }

  function formatCep(value: string) {
    const digits = value.replace(/\D/g, '').slice(0, 8);
    if (digits.length <= 5) return digits;
    return `${digits.slice(0, 5)}-${digits.slice(5)}`;
  }

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '12px 0' }}>
      
      {/* HEADER PRINCIPAL */}
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
                {['Usuário', 'Perfil', 'Status', 'Último acesso', 'Ações'].map((h) => (
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
                    <td style={{ padding: '14px 20px' }}>
                      <RoleBadge role={u.role as Role} size="sm" />
                    </td>
                    <td style={{ padding: '14px 20px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ 
                          width: '7px', 
                          height: '7px', 
                          borderRadius: '50%', 
                          background: u.status === 'Inativo' ? '#e23f3f' : '#3DD68C', 
                          display: 'inline-block' 
                        }} />
                        <span style={{ color: t.text, fontSize: '12.5px', fontWeight: 500 }}>{u.status || 'Ativo'}</span>
                      </div>
                    </td>
                    <td style={{ padding: '14px 20px', color: t.textMuted, fontSize: '12.5px' }}>
                      {u.lastLoginAt || '—'}
                    </td>
                    {/* COLUNA DE AÇÕES */}
                    <td style={{ padding: '14px 20px' }}>
                      <button
                        onClick={() => handleOpenEditModal(u)}
                        style={{
                          background: t.surfaceElevated,
                          border: `1px solid ${t.border}`,
                          color: t.text,
                          padding: '6px 10px',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          fontSize: '12px',
                          fontWeight: 600,
                          transition: 'all 0.15s ease'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = t.border}
                        onMouseLeave={(e) => e.currentTarget.style.background = t.surfaceElevated}
                      >
                        <Pencil size={13} />
                        Editar
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* MODAL DE CRIAÇÃO OTIMIZADO */}
      {isCreateModalOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            backdropFilter: 'blur(4px)',
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
              width: '100%',
              maxWidth: '720px',
              maxHeight: '85vh',
              boxShadow: '0 24px 48px rgba(0,0,0,0.25)',
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden'
            }}
          >
            {/* Header do Modal Fixo */}
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              padding: '20px 24px',
              borderBottom: `1px solid ${t.border}`
            }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: t.text }}>
                  Cadastrar Novo Usuário
                </h3>
                <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: t.textSecondary }}>
                  Insira as credenciais e dados de endereço para ativar a conta.
                </p>
              </div>
              <button 
                onClick={handleCloseModal}
                style={{ 
                  background: t.surfaceElevated, 
                  border: `1px solid ${t.border}`, 
                  color: t.textSecondary, 
                  cursor: 'pointer',
                  padding: '6px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <X size={16} />
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setCreateLoading(true);
                setCreateError(null);
                try {
                  await apiCreateUser({ 
                    sellerCode: createCode || undefined,
                    name: createName, 
                    email: createEmail, 
                    phone: createPhone || undefined,
                    cep: createZipCode.replace(/\D/g, '') || undefined,
                    state: createState || undefined,
                    address: createAddress || undefined,
                    neighborhood: createNeighborhood || undefined,
                    city: createMunicipality || undefined,
                    number: createNumber || undefined,
                    password: createPassword, 
                    role: createRole,
                    team: createRole === 'VENDEDOR' ? createTeam || undefined : undefined,
                    supervisor: createRole === 'VENDEDOR' ? createSupervisor || undefined : undefined,
                    status: 'Ativo',
                  });
                  
                  await refreshUsers();
                  handleCloseModal();
                } catch (err) {
                  setCreateError(err instanceof Error ? err.message : 'Falha ao criar usuário');
                } finally {
                  setCreateLoading(false);
                }
              }}
              style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}
            >
              <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
                
                {/* SEÇÃO 1: INFORMAÇÕES BÁSICAS */}
                <div style={{ marginBottom: '24px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', borderBottom: `1px solid ${t.border}`, paddingBottom: '8px' }}>
                    <User size={16} color={t.primary} />
                    <span style={{ fontSize: '13px', fontWeight: 700, color: t.text, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Dados de Acesso e Contato</span>
                  </div>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '12px' }}>
                    <div style={{ gridColumn: 'span 4' }}>
                      <label style={labelStyle}>Código</label>
                      <input required disabled={createLoading} value={createCode} onChange={(e) => setCreateCode(e.target.value)} style={inputStyle} placeholder="Ex: 1212" />
                    </div>
                    <div style={{ gridColumn: 'span 8' }}>
                      <label style={labelStyle}>Nome completo</label>
                      <input required disabled={createLoading} value={createName} onChange={(e) => setCreateName(e.target.value)} style={inputStyle} placeholder="Nome do usuário" />
                    </div>
                    <div style={{ gridColumn: 'span 6' }}>
                      <label style={labelStyle}>E-mail corporativo</label>
                      <input required type="email" disabled={createLoading} value={createEmail} onChange={(e) => setCreateEmail(e.target.value)} style={inputStyle} placeholder="nome@empresa.com" />
                    </div>
                    <div style={{ gridColumn: 'span 6' }}>
                      <label style={labelStyle}>Telefone corporativo</label>
                      <input required disabled={createLoading} value={createPhone} onChange={(e) => setCreatePhone(e.target.value)} style={inputStyle} placeholder="(00) 00000-0000" />
                    </div>
                    <div style={{ gridColumn: 'span 6' }}>
                      <label style={labelStyle}>Senha temporária</label>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <input required type={showPassword ? 'text' : 'password'} disabled={createLoading} value={createPassword} onChange={(e) => setCreatePassword(e.target.value)} style={{ ...inputStyle, flex: 1 }} placeholder="Mínimo 6 caracteres" />
                        <button type="button" disabled={createLoading} onClick={() => setCreatePassword(generateStrongPassword(12))} style={{ padding: '8px 10px', borderRadius: 8, border: `1px solid ${t.border}`, background: t.surfaceElevated, color: t.text, cursor: 'pointer', fontSize: '12.5px', whiteSpace: 'nowrap' }}>Gerar</button>
                        <button type="button" onClick={() => setShowPassword(s => !s)} style={{ padding: '8px', marginLeft: 6, borderRadius: 8, border: `1px solid ${t.border}`, background: t.surfaceElevated, color: t.text, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>

                      {/* Força de senha */}
                      {createPassword && (
                        <div style={{ marginTop: '10px' }}>
                          <div style={{ display: 'flex', gap: '4px', marginBottom: '4px' }}>
                            {[1, 2, 3, 4].map((bar) => {
                              const score = computePasswordScore(createPassword);
                              const isActive = bar <= score;
                              return (
                                <div key={bar} style={{ flex: 1, height: '4px', borderRadius: '2px', background: isActive ? passwordColor(score) : `${t.border}`, transition: 'all 0.15s ease' }} />
                              );
                            })}
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                            <span style={{ fontSize: '11.5px', fontWeight: 700, color: passwordColor(computePasswordScore(createPassword)) }}>{passwordLabel(computePasswordScore(createPassword))}</span>
                          </div>
                        </div>
                      )}
                    </div>
                    <div style={{ gridColumn: 'span 6' }}>
                      <label style={labelStyle}>Perfil de acesso</label>
                      <select value={createRole} disabled={createLoading} onChange={(e) => setCreateRole(e.target.value as Role)} style={{ ...inputStyle, cursor: 'pointer' }}>
                        {['ADMIN', 'GERENTE', 'SUPERVISOR', 'VENDEDOR'].map(r => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* VENDEDOR */}
                {createRole === 'VENDEDOR' && (
                  <div style={{ marginBottom: '24px', padding: '16px', borderRadius: '8px', background: `${t.primary}05`, border: `1px dashed ${t.primary}30` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                      <Briefcase size={16} color={t.primary} />
                      <span style={{ fontSize: '13px', fontWeight: 700, color: t.text }}>Atribuição de Vendas</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <div>
                        <label style={labelStyle}>Equipe</label>
                        <input required disabled={createLoading} value={createTeam} onChange={(e) => setCreateTeam(e.target.value)} placeholder="Nome da Equipe" style={inputStyle} />
                      </div>
                      <div>
                        <label style={labelStyle}>Supervisor Direto</label>
                        <input required disabled={createLoading} value={createSupervisor} onChange={(e) => setCreateSupervisor(e.target.value)} placeholder="Nome do Supervisor" style={inputStyle} />
                      </div>
                    </div>
                  </div>
                )}

                {/* SEÇÃO 2: ENDEREÇO */}
                <div style={{ marginBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', borderBottom: `1px solid ${t.border}`, paddingBottom: '8px' }}>
                    <MapPin size={16} color={t.primary} />
                    <span style={{ fontSize: '13px', fontWeight: 700, color: t.text, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Informações de Localidade</span>
                  </div>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '12px' }}>
                    <div style={{ gridColumn: 'span 4' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <label style={labelStyle}>CEP</label>
                        {cepLoading && <span style={{ fontSize: '11px', color: t.textSecondary }}>Buscando...</span>}
                      </div>
                      <input required disabled={createLoading} value={createZipCode} onChange={(e) => {
                        const formatted = formatCep(e.target.value);
                        setCreateZipCode(formatted);
                        if (formatted.replace(/\D/g, '').length === 8) lookupCep(formatted, false);
                      }} style={inputStyle} placeholder="00000-000" maxLength={9} />
                    </div>
                    <div style={{ gridColumn: 'span 4' }}>
                      <label style={labelStyle}>Estado</label>
                      <input required disabled={createLoading} value={createState} onChange={(e) => setCreateState(e.target.value.toUpperCase())} style={inputStyle} placeholder="Ex: SP" />
                    </div>
                    <div style={{ gridColumn: 'span 4' }}>
                      <label style={labelStyle}>Número</label>
                      <input required disabled={createLoading} value={createNumber} onChange={(e) => setCreateNumber(e.target.value)} style={inputStyle} placeholder="Nº" />
                    </div>
                    <div style={{ gridColumn: 'span 12' }}>
                      <label style={labelStyle}>Endereço</label>
                      <input required disabled={createLoading} value={createAddress} onChange={(e) => setCreateAddress(e.target.value)} style={inputStyle} placeholder="Rua / Avenida" />
                    </div>
                    <div style={{ gridColumn: 'span 6' }}>
                      <label style={labelStyle}>Bairro</label>
                      <input required disabled={createLoading} value={createNeighborhood} onChange={(e) => setCreateNeighborhood(e.target.value)} style={inputStyle} placeholder="Bairro" />
                    </div>
                    <div style={{ gridColumn: 'span 6' }}>
                      <label style={labelStyle}>Município</label>
                      <input required disabled={createLoading} value={createMunicipality} onChange={(e) => setCreateMunicipality(e.target.value)} style={inputStyle} placeholder="Cidade" />
                    </div>
                  </div>
                </div>

              </div>

              {/* Erros e Ações */}
              <div style={{ padding: '16px 24px', borderTop: `1px solid ${t.border}`, background: t.bgSecondary, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {createError && <div style={{ color: '#e23f3f', background: '#e23f3f15', border: '1px solid #e23f3f30', borderRadius: '8px', padding: '10px 14px', fontSize: '12.5px', fontWeight: 500 }}>{createError}</div>}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                  <button type="button" disabled={createLoading} onClick={handleCloseModal} style={{ padding: '10px 18px', borderRadius: '8px', border: `1px solid ${t.border}`, background: t.surface, color: t.textSecondary, cursor: 'pointer', fontSize: '13.5px', fontWeight: 600 }}>Cancelar</button>
                  <button type="submit" disabled={createLoading} style={{ padding: '10px 24px', borderRadius: '8px', border: 'none', background: t.primary, color: '#fff', cursor: 'pointer', fontSize: '13.5px', fontWeight: 600 }}>{createLoading ? 'Salvando...' : 'Cadastrar Usuário'}</button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE EDIÇÃO INTEGRADO */}
      {isEditModalOpen && editUserId && (
        <div
          style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            backdropFilter: 'blur(4px)',
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
              width: '100%',
              maxWidth: '720px',
              maxHeight: '85vh',
              boxShadow: '0 24px 48px rgba(0,0,0,0.25)',
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden'
            }}
          >
            {/* Header do Modal */}
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              padding: '20px 24px',
              borderBottom: `1px solid ${t.border}`
            }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: t.text }}>
                  Editar Informações do Usuário
                </h3>
                <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: t.textSecondary }}>
                  Modifique os campos necessários. Deixe a senha em branco se não desejar alterá-la.
                </p>
              </div>
              <button 
                onClick={handleCloseEditModal}
                style={{ 
                  background: t.surfaceElevated, 
                  border: `1px solid ${t.border}`, 
                  color: t.textSecondary, 
                  cursor: 'pointer',
                  padding: '6px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <X size={16} />
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setEditLoading(true);
                setEditError(null);
                try {
                  // Enviando requisição de atualização para a API integrada do sistema
                  await apiUpdateUser(editUserId, { 
                    sellerCode: editCode || undefined,
                    name: editName, 
                    email: editEmail, 
                    phone: editPhone || undefined,
                    cep: editZipCode.replace(/\D/g, '') || undefined,
                    state: editState || undefined,
                    address: editAddress || undefined,
                    neighborhood: editNeighborhood || undefined,
                    city: editMunicipality || undefined,
                    number: editNumber || undefined,
                    role: editRole,
                    // Se o usuário digitou senha, enviamos ela, senão ignoramos
                    ...(editPassword ? { password: editPassword } : {}),
                    team: editRole === 'VENDEDOR' ? editTeam || undefined : undefined,
                    supervisor: editRole === 'VENDEDOR' ? editSupervisor || undefined : undefined,
                    status: editStatus,
                  });
                  
                  await refreshUsers();
                  handleCloseEditModal();
                } catch (err) {
                  setEditError(err instanceof Error ? err.message : 'Falha ao editar usuário');
                } finally {
                  setEditLoading(false);
                }
              }}
              style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}
            >
              <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
                
                {/* SEÇÃO 1: DADOS DE CONTATO */}
                <div style={{ marginBottom: '24px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', borderBottom: `1px solid ${t.border}`, paddingBottom: '8px' }}>
                    <User size={16} color={t.primary} />
                    <span style={{ fontSize: '13px', fontWeight: 700, color: t.text, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Dados de Acesso e Contato</span>
                  </div>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '12px' }}>
                    <div style={{ gridColumn: 'span 4' }}>
                      <label style={labelStyle}>Código</label>
                      <input required disabled={editLoading} value={editCode} onChange={(e) => setEditCode(e.target.value)} style={inputStyle} placeholder="Ex: 1212" />
                    </div>
                    <div style={{ gridColumn: 'span 8' }}>
                      <label style={labelStyle}>Nome completo</label>
                      <input required disabled={editLoading} value={editName} onChange={(e) => setEditName(e.target.value)} style={inputStyle} placeholder="Nome do usuário" />
                    </div>
                    <div style={{ gridColumn: 'span 6' }}>
                      <label style={labelStyle}>E-mail corporativo</label>
                      <input required type="email" disabled={editLoading} value={editEmail} onChange={(e) => setEditEmail(e.target.value)} style={inputStyle} placeholder="nome@empresa.com" />
                    </div>
                    <div style={{ gridColumn: 'span 6' }}>
                      <label style={labelStyle}>Telefone corporativo</label>
                      <input required disabled={editLoading} value={editPhone} onChange={(e) => setEditPhone(e.target.value)} style={inputStyle} placeholder="(00) 00000-0000" />
                    </div>
                    
                    <div style={{ gridColumn: 'span 6' }}>
                      <label style={labelStyle}>Alterar Senha (Opcional)</label>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <input type={showEditPassword ? 'text' : 'password'} disabled={editLoading} value={editPassword} onChange={(e) => setEditPassword(e.target.value)} style={{ ...inputStyle, flex: 1 }} placeholder="Nova senha se desejar mudar" />
                        <button type="button" disabled={editLoading} onClick={() => setEditPassword(generateStrongPassword(12))} style={{ padding: '8px 10px', borderRadius: 8, border: `1px solid ${t.border}`, background: t.surfaceElevated, color: t.text, cursor: 'pointer', fontSize: '12.5px', whiteSpace: 'nowrap' }}>Gerar</button>
                        <button type="button" onClick={() => setShowEditPassword(s => !s)} style={{ padding: '8px', marginLeft: 6, borderRadius: 8, border: `1px solid ${t.border}`, background: t.surfaceElevated, color: t.text, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {showEditPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>

                      {editPassword && (
                        <div style={{ marginTop: '10px' }}>
                          <div style={{ display: 'flex', gap: '4px', marginBottom: '4px' }}>
                            {[1, 2, 3, 4].map((bar) => {
                              const score = computePasswordScore(editPassword);
                              const isActive = bar <= score;
                              return (
                                <div key={bar} style={{ flex: 1, height: '4px', borderRadius: '2px', background: isActive ? passwordColor(score) : `${t.border}`, transition: 'all 0.15s ease' }} />
                              );
                            })}
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                            <span style={{ fontSize: '11.5px', fontWeight: 700, color: passwordColor(computePasswordScore(editPassword)) }}>{passwordLabel(computePasswordScore(editPassword))}</span>
                          </div>
                        </div>
                      )}
                    </div>

                    <div style={{ gridColumn: 'span 3' }}>
                      <label style={labelStyle}>Perfil de acesso</label>
                      <select value={editRole} disabled={editLoading} onChange={(e) => setEditRole(e.target.value as Role)} style={{ ...inputStyle, cursor: 'pointer' }}>
                        {['ADMIN', 'GERENTE', 'SUPERVISOR', 'VENDEDOR'].map(r => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                      </select>
                    </div>

                    <div style={{ gridColumn: 'span 3' }}>
                      <label style={labelStyle}>Status do usuário</label>
                      <select value={editStatus} disabled={editLoading} onChange={(e) => setEditStatus(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
                        <option value="Ativo">Ativo</option>
                        <option value="Inativo">Inativo</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* VENDEDOR */}
                {editRole === 'VENDEDOR' && (
                  <div style={{ marginBottom: '24px', padding: '16px', borderRadius: '8px', background: `${t.primary}05`, border: `1px dashed ${t.primary}30` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                      <Briefcase size={16} color={t.primary} />
                      <span style={{ fontSize: '13px', fontWeight: 700, color: t.text }}>Atribuição de Vendas</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <div>
                        <label style={labelStyle}>Equipe</label>
                        <input required disabled={editLoading} value={editTeam} onChange={(e) => setEditTeam(e.target.value)} placeholder="Nome da Equipe" style={inputStyle} />
                      </div>
                      <div>
                        <label style={labelStyle}>Supervisor Direto</label>
                        <input required disabled={editLoading} value={editSupervisor} onChange={(e) => setEditSupervisor(e.target.value)} placeholder="Nome do Supervisor" style={inputStyle} />
                      </div>
                    </div>
                  </div>
                )}

                {/* SEÇÃO 2: ENDEREÇO */}
                <div style={{ marginBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', borderBottom: `1px solid ${t.border}`, paddingBottom: '8px' }}>
                    <MapPin size={16} color={t.primary} />
                    <span style={{ fontSize: '13px', fontWeight: 700, color: t.text, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Informações de Localidade</span>
                  </div>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '12px' }}>
                    <div style={{ gridColumn: 'span 4' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <label style={labelStyle}>CEP</label>
                        {editCepLoading && <span style={{ fontSize: '11px', color: t.textSecondary }}>Buscando...</span>}
                      </div>
                      <input required disabled={editLoading} value={editZipCode} onChange={(e) => {
                        const formatted = formatCep(e.target.value);
                        setEditZipCode(formatted);
                        if (formatted.replace(/\D/g, '').length === 8) lookupCep(formatted, true);
                      }} style={inputStyle} placeholder="00000-000" maxLength={9} />
                    </div>
                    <div style={{ gridColumn: 'span 4' }}>
                      <label style={labelStyle}>Estado</label>
                      <input required disabled={editLoading} value={editState} onChange={(e) => setEditState(e.target.value.toUpperCase())} style={inputStyle} placeholder="Ex: SP" />
                    </div>
                    <div style={{ gridColumn: 'span 4' }}>
                      <label style={labelStyle}>Número</label>
                      <input required disabled={editLoading} value={editNumber} onChange={(e) => setEditNumber(e.target.value)} style={inputStyle} placeholder="Nº" />
                    </div>
                    <div style={{ gridColumn: 'span 12' }}>
                      <label style={labelStyle}>Endereço</label>
                      <input required disabled={editLoading} value={editAddress} onChange={(e) => setEditAddress(e.target.value)} style={inputStyle} placeholder="Rua / Avenida" />
                    </div>
                    <div style={{ gridColumn: 'span 6' }}>
                      <label style={labelStyle}>Bairro</label>
                      <input required disabled={editLoading} value={editNeighborhood} onChange={(e) => setEditNeighborhood(e.target.value)} style={inputStyle} placeholder="Bairro" />
                    </div>
                    <div style={{ gridColumn: 'span 6' }}>
                      <label style={labelStyle}>Município</label>
                      <input required disabled={editLoading} value={editMunicipality} onChange={(e) => setEditMunicipality(e.target.value)} style={inputStyle} placeholder="Cidade" />
                    </div>
                  </div>
                </div>

              </div>

              {/* Erros e Ações */}
              <div style={{ padding: '16px 24px', borderTop: `1px solid ${t.border}`, background: t.bgSecondary, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {editError && <div style={{ color: '#e23f3f', background: '#e23f3f15', border: '1px solid #e23f3f30', borderRadius: '8px', padding: '10px 14px', fontSize: '12.5px', fontWeight: 500 }}>{editError}</div>}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                  <button type="button" disabled={editLoading} onClick={handleCloseEditModal} style={{ padding: '10px 18px', borderRadius: '8px', border: `1px solid ${t.border}`, background: t.surface, color: t.textSecondary, cursor: 'pointer', fontSize: '13.5px', fontWeight: 600 }}>Cancelar</button>
                  <button type="submit" disabled={editLoading} style={{ padding: '10px 24px', borderRadius: '8px', border: 'none', background: t.primary, color: '#fff', cursor: 'pointer', fontSize: '13.5px', fontWeight: 600 }}>{editLoading ? 'Atualizando...' : 'Salvar Alterações'}</button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};