import React, { useState } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { APP_CONFIG } from '../../config/appConfig';
import { Settings, Shield, Globe, Bell, Check, Save } from 'lucide-react';

export const SettingsPage: React.FC = () => {
  const { t, mode, setMode } = useTheme();
  const { currentUser } = useAuth();
  const isAdmin = currentUser?.role === 'ADMIN';

  const [catalogUrl, setCatalogUrl] = useState(APP_CONFIG.catalogUrl);
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  return (
    <div style={{ maxWidth: '800px' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 className="num" style={{ margin: '0 0 4px', fontSize: '24px', fontWeight: 700, color: t.text }}>
          Configurações da Plataforma
        </h1>
        <p style={{ margin: 0, fontSize: '13px', color: t.textSecondary }}>
          Preferências do sistema, parâmetros corporativos e integrações externas.
        </p>
      </div>

      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Aparência */}
        <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: '12px', padding: '20px' }}>
          <div style={{ fontSize: '15px', fontWeight: 600, color: t.text, marginBottom: '4px' }}>
            Aparência & Tema
          </div>
          <div style={{ fontSize: '12.5px', color: t.textMuted, marginBottom: '16px' }}>
            Alterne entre o tema escuro industrial ou o tema claro de alta visibilidade.
          </div>

          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => setMode('dark')}
              style={{
                flex: '1 1 140px',
                padding: '12px',
                borderRadius: '8px',
                border: `2px solid ${mode === 'dark' ? t.primary : t.border}`,
                background: '#0D0F12',
                color: '#fff',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Tema Origin (Padrão)
            </button>
            <button
              type="button"
              onClick={() => setMode('light')}
              style={{
                flex: '1 1 140px',
                padding: '12px',
                borderRadius: '8px',
                border: `2px solid ${mode === 'light' ? t.primary : t.border}`,
                background: '#FFFFFF',
                color: '#111827',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Tema RR Mind
            </button>
          </div>
        </div>

        {/* Integração do Catálogo */}
        <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: '12px', padding: '20px' }}>
          <div style={{ fontSize: '15px', fontWeight: 600, color: t.text, marginBottom: '4px' }}>
            Link do Catálogo Externo Oficial
          </div>
          <div style={{ fontSize: '12.5px', color: t.textMuted, marginBottom: '16px' }}>
            Endereço web oficial do catálogo aberto pelos vendedores no menu lateral.
          </div>

          <input
            type="url"
            value={catalogUrl}
            onChange={(e) => setCatalogUrl(e.target.value)}
            disabled={!isAdmin}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              padding: '10px 14px',
              borderRadius: '8px',
              border: `1px solid ${t.border}`,
              background: t.surfaceElevated,
              color: t.text,
              fontSize: '13px',
            }}
          />
          {!isAdmin && (
            <div style={{ fontSize: '11.5px', color: t.textMuted, marginTop: '6px' }}>
              Somente usuários administradores podem alterar a URL do catálogo corporativo.
            </div>
          )}
        </div>

        {/* Notificações */}
        <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: '12px', padding: '20px' }}>
          <div style={{ fontSize: '15px', fontWeight: 600, color: t.text, marginBottom: '4px' }}>
            Alertas & Auditoria
          </div>
          <div style={{ fontSize: '12.5px', color: t.textMuted, marginBottom: '16px' }}>
            Notificações operacionais sobre novas importações ou fechamentos mensais.
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '13px', color: t.text }}>
            <input
              type="checkbox"
              checked={emailAlerts}
              onChange={(e) => setEmailAlerts(e.target.checked)}
              style={{ accentColor: t.primary, width: '16px', height: '16px' }}
            />
            <span>Receber alertas de divergência e importações críticas</span>
          </label>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '12px' }}>
          {savedSuccess && (
            <span style={{ fontSize: '13px', color: '#3DD68C', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Check size={16} /> Preferências salvas com sucesso!
            </span>
          )}
          <button
            type="submit"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 22px',
              borderRadius: '8px',
              border: 'none',
              background: t.primary,
              color: '#fff',
              fontSize: '13.5px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <Save size={16} />
            <span>Salvar Alterações</span>
          </button>
        </div>
      </form>
    </div>
  );
};
