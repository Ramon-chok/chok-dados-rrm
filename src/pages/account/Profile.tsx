import React, { useState, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { RoleBadge } from '../../components/auth/RoleBadge';
import { Role } from '../../types';
import { Building, Check, Save, Camera, ImagePlus, Trash2, User as UserIcon } from 'lucide-react';

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

  // ▼▼▼ NOVO: Estado das imagens de Avatar e Capa ▼▼▼
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  if (!currentUser) return null;

  const handleImageUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    setter: (url: string) => void
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validação simples de tamanho (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('A imagem deve ter no máximo 5MB.');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setter(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

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
          <span>Informações atualizadas com sucesso!</span>
        </div>
      )}

      {/* ▼▼▼ NOVO: BANNER DE CAPA + AVATAR (Estilo LinkedIn) ▼▼▼ */}
      <div
        style={{
          background: t.surface,
          border: `1px solid ${t.border}`,
          borderRadius: '14px',
          overflow: 'hidden',
          marginBottom: '22px',
        }}
      >
        {/* Área de Capa */}
        <div
          style={{
            position: 'relative',
            height: '180px',
            background: coverUrl
              ? `url(${coverUrl}) center/cover no-repeat`
              : `linear-gradient(135deg, ${t.primary} 0%, #8B0510 60%, #1a1a1a 100%)`,
            transition: 'all 0.3s ease',
          }}
        >
          {/* Overlay decorativo (só quando não há capa) */}
          {!coverUrl && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background:
                  'radial-gradient(circle at 20% 30%, rgba(255,255,255,0.12) 0%, transparent 40%), radial-gradient(circle at 80% 70%, rgba(255,255,255,0.08) 0%, transparent 40%)',
              }}
            />
          )}

          {/* Botão de trocar capa */}
          <div style={{ position: 'absolute', top: '14px', right: '14px', display: 'flex', gap: '8px' }}>
            {coverUrl && (
              <button
                type="button"
                onClick={() => setCoverUrl(null)}
                title="Remover capa"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '1px solid rgba(255,255,255,0.25)',
                  background: 'rgba(0,0,0,0.55)',
                  backdropFilter: 'blur(8px)',
                  color: '#fff',
                  fontSize: '12.5px',
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                <Trash2 size={14} />
              </button>
            )}
            <button
              type="button"
              onClick={() => coverInputRef.current?.click()}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px',
                borderRadius: '8px',
                border: '1px solid rgba(255,255,255,0.25)',
                background: 'rgba(0,0,0,0.55)',
                backdropFilter: 'blur(8px)',
                color: '#fff',
                fontSize: '12.5px',
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              <ImagePlus size={14} />
              {coverUrl ? 'Alterar capa' : 'Adicionar capa'}
            </button>
            <input
              ref={coverInputRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => handleImageUpload(e, setCoverUrl)}
            />
          </div>
        </div>

        {/* Faixa de informação + Avatar sobreposto */}
        <div style={{ position: 'relative', padding: '0 24px 22px' }}>
          {/* Avatar */}
          <div
            style={{
              position: 'relative',
              width: '112px',
              height: '112px',
              marginTop: '-56px',
              borderRadius: '50%',
              background: avatarUrl ? `url(${avatarUrl}) center/cover no-repeat` : t.primary,
              border: `4px solid ${t.surface}`,
              boxShadow: '0 6px 20px rgba(0, 0, 0, 0.35)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontSize: '36px',
              fontWeight: 700,
              overflow: 'hidden',
            }}
          >
            {!avatarUrl && (currentUser.avatarInitials || <UserIcon size={40} />)}

            {/* Botão trocar avatar (câmera) */}
            <button
              type="button"
              onClick={() => avatarInputRef.current?.click()}
              title="Alterar foto de perfil"
              style={{
                position: 'absolute',
                bottom: '2px',
                right: '2px',
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                border: `2px solid ${t.surface}`,
                background: t.primary,
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
              }}
            >
              <Camera size={15} />
            </button>
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => handleImageUpload(e, setAvatarUrl)}
            />
          </div>

          {/* Botão remover avatar */}
          {avatarUrl && (
            <button
              type="button"
              onClick={() => setAvatarUrl(null)}
              style={{
                position: 'absolute',
                left: '130px',
                top: '10px',
                padding: '4px 10px',
                borderRadius: '6px',
                border: `1px solid ${t.border}`,
                background: t.bgSecondary,
                color: t.textMuted,
                fontSize: '11.5px',
                cursor: 'pointer',
              }}
            >
              Remover foto
            </button>
          )}

          {/* Informações rápidas */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'space-between',
              alignItems: 'flex-end',
              gap: '16px',
              marginTop: '14px',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: t.text }}>
                  {currentUser.name}
                </h2>
                <RoleBadge role={currentUser.role as Role} size="md" />
              </div>
              <div style={{ marginTop: '4px', fontSize: '13px', color: t.textMuted }}>
                {currentUser.email} • {city}/{state}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '18px', fontSize: '12.5px' }}>
              <div style={{ textAlign: 'right' }}>
                <div style={{ color: t.textMuted, marginBottom: '2px' }}>Status</div>
                <div style={{ color: '#3DD68C', fontWeight: 600 }}>● {currentUser.status}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ color: t.textMuted, marginBottom: '2px' }}>Último acesso</div>
                <div style={{ color: t.textSecondary, fontWeight: 500 }}>{currentUser.lastLoginAt}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* ▲▲▲ FIM DO BANNER ▲▲▲ */}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
        {/* Dados Profissionais e Vínculo */}
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
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
            <div className="form-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
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

            <div className="form-grid-3" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 100px', gap: '16px', marginBottom: '22px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12.5px', color: t.textSecondary, marginBottom: '6px' }}>
                  Telefone {isVendedor ? '(Bloqueado)' : ''}
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

      <style>{`
        @media (max-width: 720px) {
          .form-grid-2, .form-grid-3 {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
};