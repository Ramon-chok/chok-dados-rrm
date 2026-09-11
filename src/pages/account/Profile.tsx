import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { RoleBadge } from '../../components/auth/RoleBadge';
import { Role } from '../../types';
import { User, Mail, Phone, MapPin, Building, ShieldCheck, Check, Save } from 'lucide-react';

export const ProfilePage: React.FC = () => {
  const { currentUser } = useAuth();
  const { t } = useTheme();

  const isVendedor = currentUser?.role === 'VENDEDOR';

  const [email, setEmail] = useState(currentUser?.email || '');
  const [endereco, setEndereco] = useState('Av. Maurílio Biagi, 1800 - Ribeirânia');
  const [phone, setPhone] = useState(currentUser?.phone || '(16) 99742-1080');
  const [city, setCity] = useState(currentUser?.city || 'Ribeirão Preto');
  const [state, setState] = useState(currentUser?.state || 'SP');
  const [isSaved, setIsSaved] = useState(false);

  if (!currentUser) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2500);
  };

  return (
    <div style={{ maxWidth: '940px' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 className="num" style={{ margin: '0 0 6px', fontSize: '24px', fontWeight: 700, color: t.text }}>
          Meu Perfil
        </h1>
        <p style={{ margin: 0, fontSize: '13.5px', color: t.textSecondary }}>
          Consulte seus dados cadastrais, cargo corporativo e escopo hierárquico no sistema.
        </p>
      </div>

      {isSaved && (
        <div
          style={{
            background: 'rgba(61, 214, 140, 0.12)',
            border: '1px solid rgba(61, 214, 140, 0.3)',
            borderRadius: '10px',
            padding: '12px 16px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            color: '#3DD68C',
            fontSize: '13.5px',
          }}
        >
          <Check size={18} />
          <span>Informações de contato atualizadas com sucesso!</span>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '22px' }} className="profile-grid">
        {/* Card Resumo do Usuário */}
        <div
          style={{
            background: t.surface,
            border: `1px solid ${t.border}`,
            borderRadius: '14px',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              width: '84px',
              height: '84px',
              borderRadius: '50%',
              background: t.primary,
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '28px',
              fontWeight: 700,
              marginBottom: '16px',
              boxShadow: '0 4px 16px rgba(227, 6, 19, 0.35)',
            }}
          >
            {currentUser.avatarInitials}
          </div>

          <h2 style={{ margin: '0 0 6px', fontSize: '18px', fontWeight: 600, color: t.text }}>
            {currentUser.name}
          </h2>
          <div style={{ marginBottom: '12px' }}>
            <RoleBadge role={currentUser.role as Role} size="md" />
          </div>
          <div style={{ fontSize: '13px', color: t.textMuted, marginBottom: '20px' }}>
            {currentUser.email}
          </div>

          <div
            style={{
              width: '100%',
              borderTop: `1px solid ${t.border}`,
              paddingTop: '16px',
              textAlign: 'left',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              fontSize: '12.5px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: t.textMuted }}>Status:</span>
              <span style={{ color: '#3DD68C', fontWeight: 600 }}>● {currentUser.status}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: t.textMuted }}>Último Acesso:</span>
              <span style={{ color: t.textSecondary, fontWeight: 500 }}>{currentUser.lastLoginAt}</span>
            </div>
          </div>
        </div>

        {/* Card Formulário & Estrutura Hierárquica */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Dados Profissionais e Vínculo (PRD Seção 46) */}
          <div
            style={{
              background: t.surface,
              border: `1px solid ${t.border}`,
              borderRadius: '14px',
              padding: '24px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <Building size={18} color={t.primary} />
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: t.text }}>
                Vínculo Organizacional & Escopo de Dados
              </h3>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '14px',
                marginBottom: '16px',
              }}
            >
              <div style={{ background: t.bgSecondary, padding: '12px 14px', borderRadius: '8px', border: `1px solid ${t.border}` }}>
                <div style={{ fontSize: '11.5px', color: t.textMuted, marginBottom: '4px' }}>Gerência</div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: t.text }}>
                  {currentUser.manager || 'Diretoria Geral'}
                </div>
              </div>

              <div style={{ background: t.bgSecondary, padding: '12px 14px', borderRadius: '8px', border: `1px solid ${t.border}` }}>
                <div style={{ fontSize: '11.5px', color: t.textMuted, marginBottom: '4px' }}>Supervisão</div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: t.text }}>
                  {currentUser.supervisor || 'Todas as Supervisões'}
                </div>
              </div>

              <div style={{ background: t.bgSecondary, padding: '12px 14px', borderRadius: '8px', border: `1px solid ${t.border}` }}>
                <div style={{ fontSize: '11.5px', color: t.textMuted, marginBottom: '4px' }}>Equipe</div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: t.text }}>
                  {currentUser.team || 'Geral'}
                </div>
              </div>

              <div style={{ background: t.bgSecondary, padding: '12px 14px', borderRadius: '8px', border: `1px solid ${t.border}` }}>
                <div style={{ fontSize: '11.5px', color: t.textMuted, marginBottom: '4px' }}>Código do Vendedor</div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: t.text }}>
                  {currentUser.sellerCode ? `#${currentUser.sellerCode}` : 'Não aplicável'}
                </div>
              </div>
            </div>

            <div
              style={{
                background: 'rgba(227, 6, 19, 0.06)',
                border: '1px solid rgba(227, 6, 19, 0.25)',
                borderRadius: '8px',
                padding: '12px 14px',
                fontSize: '12.5px',
                color: t.text,
              }}
            >
              <strong style={{ color: t.primary }}>Escopo Ativo: </strong>
              {currentUser.scope.description}
            </div>
          </div>

          {/* Dados de Contato Editáveis */}
          <div
            style={{
              background: t.surface,
              border: `1px solid ${t.border}`,
              borderRadius: '14px',
              padding: '24px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: t.text }}>
                Dados Pessoais e de Contato
              </h3>
              {isVendedor && (
                <span style={{ fontSize: '12px', padding: '3px 8px', borderRadius: '6px', background: `${t.primary}15`, color: t.primary, fontWeight: 600 }}>
                  Edição restrita a E-mail e Endereço
                </span>
              )}
            </div>

            {isVendedor && (
              <div
                style={{
                  background: t.bgSecondary,
                  border: `1px solid ${t.border}`,
                  borderRadius: '8px',
                  padding: '10px 14px',
                  marginBottom: '16px',
                  fontSize: '12.5px',
                  color: t.textSecondary,
                }}
              >
                <strong>Regra de Perfil:</strong> Como Vendedor, você tem permissão para alterar exclusivamente seu <strong>E-mail</strong> e <strong>Endereço</strong>. Todos os outros campos são bloqueados para leitura.
              </div>
            )}

            <form onSubmit={handleSave}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', color: t.textSecondary, marginBottom: '6px' }}>
                    Nome Completo (Bloqueado)
                  </label>
                  <input
                    type="text"
                    value={currentUser.name}
                    disabled
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: `1px solid ${t.border}`,
                      background: t.bgSecondary,
                      color: t.textMuted,
                      fontSize: '13.5px',
                      cursor: 'not-allowed',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', color: t.textSecondary, marginBottom: '6px' }}>
                    E-mail {isVendedor ? '(Editável)' : 'Corporativo'}
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: `1px solid ${isVendedor ? t.primary : t.border}`,
                      background: t.surfaceElevated,
                      color: t.text,
                      fontSize: '13.5px',
                    }}
                  />
                </div>
              </div>

              {/* Endereço */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12.5px', color: t.textSecondary, marginBottom: '6px' }}>
                  Endereço / Logradouro {isVendedor ? '(Editável)' : ''}
                </label>
                <input
                  type="text"
                  value={endereco}
                  onChange={(e) => setEndereco(e.target.value)}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: `1px solid ${isVendedor ? t.primary : t.border}`,
                    background: t.surfaceElevated,
                    color: t.text,
                    fontSize: '13.5px',
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 100px', gap: '16px', marginBottom: '22px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', color: t.textSecondary, marginBottom: '6px' }}>
                    Telefone de Contato {isVendedor ? '(Bloqueado)' : ''}
                  </label>
                  <input
                    type="text"
                    value={phone}
                    disabled={isVendedor}
                    onChange={(e) => setPhone(e.target.value)}
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: `1px solid ${t.border}`,
                      background: isVendedor ? t.bgSecondary : t.surfaceElevated,
                      color: isVendedor ? t.textMuted : t.text,
                      fontSize: '13.5px',
                      cursor: isVendedor ? 'not-allowed' : 'text',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', color: t.textSecondary, marginBottom: '6px' }}>
                    Cidade
                  </label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: `1px solid ${t.border}`,
                      background: t.surfaceElevated,
                      color: t.text,
                      fontSize: '13.5px',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', color: t.textSecondary, marginBottom: '6px' }}>
                    UF
                  </label>
                  <input
                    type="text"
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    maxLength={2}
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: `1px solid ${t.border}`,
                      background: t.surfaceElevated,
                      color: t.text,
                      fontSize: '13.5px',
                      textAlign: 'center',
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  type="submit"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '10px 20px',
                    borderRadius: '8px',
                    border: 'none',
                    background: t.primary,
                    color: '#fff',
                    fontWeight: 600,
                    fontSize: '13.5px',
                    cursor: 'pointer',
                    boxShadow: '0 2px 10px rgba(227, 6, 19, 0.3)',
                  }}
                >
                  <Save size={15} />
                  Salvar Alterações
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 820px) {
          .profile-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
};
