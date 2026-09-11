import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { LogOut, AlertTriangle, X } from 'lucide-react';

export const LogoutModal: React.FC = () => {
  const { isLogoutModalOpen, setIsLogoutModalOpen, logout, currentUser } = useAuth();
  const { t } = useTheme();

  if (!isLogoutModalOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.72)',
        backdropFilter: 'blur(4px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        animation: 'fadeIn 0.15s ease-out',
      }}
      onClick={() => setIsLogoutModalOpen(false)}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '440px',
          background: t.surface,
          border: `1px solid ${t.border}`,
          borderRadius: '14px',
          padding: '24px',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.45)',
          position: 'relative',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={() => setIsLogoutModalOpen(false)}
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            background: 'transparent',
            border: 'none',
            color: t.textMuted,
            cursor: 'pointer',
            padding: '4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '6px',
          }}
          title="Fechar"
        >
          <X size={18} />
        </button>

        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', marginBottom: '20px' }}>
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '10px',
              background: 'rgba(227, 6, 19, 0.12)',
              border: `1px solid rgba(227, 6, 19, 0.3)`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: t.primary,
              flexShrink: 0,
            }}
          >
            <LogOut size={22} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: t.text }}>
              Encerrar Sessão
            </h3>
            <p style={{ margin: '6px 0 0', fontSize: '13.5px', color: t.textSecondary, lineHeight: 1.5 }}>
              Deseja realmente sair da plataforma? As alterações não salvas poderão ser perdidas e você precisará se autenticar novamente.
            </p>
          </div>
        </div>

        {currentUser && (
          <div
            style={{
              background: t.bgSecondary,
              border: `1px solid ${t.border}`,
              borderRadius: '8px',
              padding: '12px 14px',
              marginBottom: '22px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
            }}
          >
            <div
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '50%',
                background: t.primary,
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 600,
                fontSize: '13px',
              }}
            >
              {currentUser.avatarInitials}
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: '13.5px', fontWeight: 600, color: t.text }}>
                {currentUser.name}
              </div>
              <div style={{ fontSize: '12px', color: t.textMuted, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                {currentUser.email} · {currentUser.roleLabel}
              </div>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <button
            type="button"
            onClick={() => setIsLogoutModalOpen(false)}
            style={{
              padding: '9px 16px',
              borderRadius: '8px',
              border: `1px solid ${t.border}`,
              background: 'transparent',
              color: t.textSecondary,
              fontSize: '13.5px',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'background 0.15s ease',
            }}
          >
            Permanecer Conectado
          </button>
          <button
            type="button"
            onClick={logout}
            style={{
              padding: '9px 18px',
              borderRadius: '8px',
              border: 'none',
              background: t.primary,
              color: '#FFFFFF',
              fontSize: '13.5px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 2px 8px rgba(227, 6, 19, 0.35)',
            }}
          >
            <LogOut size={14} />
            Sim, Encerrar Sessão
          </button>
        </div>
      </div>
    </div>
  );
};
