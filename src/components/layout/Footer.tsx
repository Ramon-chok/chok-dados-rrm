import React, { useMemo, useState } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { APP_CONFIG } from '../../config/appConfig';

/** Rodapé enterprise exibido no fim de todas as páginas autenticadas. */
export const Footer: React.FC = () => {
  const { t } = useTheme();
  const year = useMemo(() => new Date().getFullYear(), []);
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (email && email.includes('@')) {
      setSubscribed(true);
      setTimeout(() => {
        setSubscribed(false);
        setEmail('');
      }, 3000);
    }
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <footer
      className="app-footer"
      role="contentinfo"
      style={{
        position: 'relative',
        marginTop: 48,
        background: `linear-gradient(180deg, ${t.surface}00 0%, ${t.surface}80 30%, ${t.surface} 100%)`,
        borderTop: `1px solid ${t.border}`,
      }}
    >
      {/* Glow decorativo no topo */}
      <div
        aria-hidden="true"
        className="app-footer-glow"
        style={{
          background: `radial-gradient(ellipse at center, ${t.primary}22 0%, transparent 70%)`,
        }}
      />

      {/* ============ SEÇÃO PRINCIPAL ============ */}
      <div className="app-footer-main content-pad">
        {/* Coluna 1: Marca + Descrição + Newsletter */}
        <div className="app-footer-brand-col">
          <div className="app-footer-brand">
            <div
              className="app-footer-logo-wrapper"
              style={{
                background: `linear-gradient(135deg, ${t.surface} 0%, ${t.primary}0A 100%)`,
                borderColor: t.border,
                boxShadow: `0 4px 12px ${t.primary}15, inset 0 0 0 1px ${t.primary}20`,
              }}
            >
              <img
                src="/img/Chok Logo.png"
                alt={APP_CONFIG.companyName}
                style={{ width: 22, height: 'auto', objectFit: 'contain' }}
              />
            </div>
            <div className="app-footer-brand-text">
              <div className="num app-footer-title" style={{ color: t.text }}>
                {APP_CONFIG.companyName}
              </div>
              <div className="app-footer-subtitle" style={{ color: t.primary }}>
                Chokdados
              </div>
            </div>
          </div>

          <p className="app-footer-description" style={{ color: t.textMuted }}>
            Plataforma de inteligência comercial que transforma dados em decisões
            estratégicas. Desenvolvida para equipes que buscam performance,
            escalabilidade e resultados mensuráveis.
          </p>
        </div>

        {/* Coluna 2: Produto */}
        <div className="app-footer-col">
          <div className="app-footer-section-title" style={{ color: t.text }}>
            DADOS
          </div>
          <ul className="app-footer-list">
            <FooterLink t={t} href="/dashboard">Dashboard</FooterLink>
            <FooterLink t={t} href="/VisaoMacro">Macro</FooterLink>
            <FooterLink t={t} href="/relatorios">Relatórios</FooterLink>
            <FooterLink t={t} href="#integracoes">Integrações</FooterLink>
            <FooterLink t={t} href="#api">API</FooterLink>
            <FooterLink t={t} href="#changelog" badge="Novo">Changelog</FooterLink>
          </ul>
        </div>

        {/* Coluna 3: Empresa */}
        <div className="app-footer-col">
          <div className="app-footer-section-title" style={{ color: t.text }}>
            Empresa
          </div>
          <ul className="app-footer-list">
            <FooterLink t={t} href="#sobre">Sobre nós</FooterLink>
            <FooterLink t={t} href="#carreiras">Carreiras</FooterLink>
            <FooterLink t={t} href="#blog">Blog</FooterLink>
            <FooterLink t={t} href="#imprensa">Imprensa</FooterLink>
            <FooterLink t={t} href="#parceiros">Parceiros</FooterLink>
            <FooterLink t={t} href="#contato">Contato</FooterLink>
          </ul>
        </div>

        {/* Coluna 4: Suporte + Legal */}
        <div className="app-footer-col">
          <div className="app-footer-section-title" style={{ color: t.text }}>
            Suporte
          </div>
          <ul className="app-footer-list">
            <FooterLink t={t} href="#ajuda">Central de Ajuda</FooterLink>
            <FooterLink t={t} href="#docs">Documentação</FooterLink>
            <FooterLink t={t} href="#status">Status do Sistema</FooterLink>
            <FooterLink t={t} href="#privacidade">Privacidade</FooterLink>
            <FooterLink t={t} href="#termos">Termos de Uso</FooterLink>
            <FooterLink t={t} href="#lgpd">LGPD</FooterLink>
          </ul>
        </div>
      </div>

      {/* ============ FAIXA INFERIOR ============ */}
      <div
        className="app-footer-bottom content-pad"
        style={{ borderTop: `1px solid ${t.border}` }}
      >
        <div className="app-footer-bottom-inner">
          {/* Copyright */}
          <div className="app-footer-copyright" style={{ color: t.textMuted }}>
            <span>© {year} <strong style={{ color: t.textSecondary }}>{APP_CONFIG.companyName}</strong></span>
            <span className="app-footer-divider" style={{ background: t.border }} />
            <span className="app-footer-divider" style={{ background: t.border }} />
            <span>Atualizado pela RR Mind</span>
          </div>

          {/* Redes Sociais + Versão + Topo */}
          <div className="app-footer-actions">
            <div className="app-footer-socials">
              <SocialIcon t={t} label="LinkedIn" href="#linkedin">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14zM8.339 18.338v-8.65H5.667v8.65h2.672zM7.004 8.575c.834 0 1.512-.679 1.512-1.515a1.513 1.513 0 1 0-1.512 1.515zm11.335 9.763v-4.943c0-2.31-.5-4.084-3.198-4.084-1.298 0-2.17.712-2.526 1.386h-.037V9.688h-2.565v8.65h2.67v-4.28c0-1.13.213-2.22 1.612-2.22 1.378 0 1.395 1.29 1.395 2.29v4.21h2.649z" />
                </svg>
              </SocialIcon>
              <SocialIcon t={t} label="GitHub" href="#github">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
                </svg>
              </SocialIcon>
              <SocialIcon t={t} label="Twitter" href="#twitter">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </SocialIcon>
              <SocialIcon t={t} label="YouTube" href="#youtube">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                </svg>
              </SocialIcon>
            </div>

            <span
              className="num app-footer-version"
              title="Versão do build atual"
              style={{
                background: `${t.primary}14`,
                color: t.primary,
                border: `1px solid ${t.primary}30`,
              }}
            >
              v{APP_CONFIG.systemVersion}
            </span>
          </div>
        </div>
      </div>

      <style>{`
        /* ===== GLOW ===== */
        .app-footer-glow {
          position: absolute;
          top: -1px;
          left: 50%;
          transform: translateX(-50%);
          width: 60%;
          height: 200px;
          pointer-events: none;
          opacity: 0.6;
          filter: blur(40px);
        }

        /* ===== SEÇÃO PRINCIPAL ===== */
        .app-footer-main {
          display: grid;
          grid-template-columns: 1.6fr 1fr 1fr 1fr;
          gap: 48px;
          padding: 64px 28px 48px;
          position: relative;
        }

        /* ===== MARCA ===== */
        .app-footer-brand-col {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }
        .app-footer-brand {
          display: flex;
          align-items: center;
          gap: 14px;
        }
        .app-footer-logo-wrapper {
          width: 48px;
          height: 48px;
          border-radius: 12px;
          border-width: 1px;
          border-style: solid;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .app-footer-logo-wrapper:hover {
          transform: translateY(-2px) scale(1.03);
        }
        .app-footer-title {
          font-size: 18px;
          font-weight: 800;
          letter-spacing: -0.02em;
          line-height: 1.1;
        }
        .app-footer-subtitle {
          font-size: 11.5px;
          font-weight: 600;
          letter-spacing: 0.02em;
          text-transform: uppercase;
          margin-top: 4px;
        }
        .app-footer-description {
          font-size: 13px;
          line-height: 1.65;
          max-width: 380px;
          margin: 0;
        }

        /* ===== NEWSLETTER ===== */
        .app-footer-newsletter {
          margin-top: 8px;
        }
        .app-footer-newsletter-form {
          display: flex;
          gap: 8px;
          max-width: 380px;
        }
        .app-footer-newsletter-input {
          flex: 1;
          padding: 10px 14px;
          border-radius: 10px;
          font-size: 13px;
          outline: none;
          transition: all 0.2s ease;
        }
        .app-footer-newsletter-input:focus {
          border-color: currentColor !important;
          box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.15);
        }
        .app-footer-newsletter-btn {
          padding: 10px 18px;
          border-radius: 10px;
          border: none;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          white-space: nowrap;
          transition: all 0.2s ease;
        }
        .app-footer-newsletter-btn:hover {
          transform: translateY(-1px);
          filter: brightness(1.05);
        }

        /* ===== COLUNAS DE LINKS ===== */
        .app-footer-col {
          display: flex;
          flex-direction: column;
        }
        .app-footer-section-title {
          font-size: 12px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          margin-bottom: 20px;
          display: block;
        }
        .app-footer-list {
          list-style: none;
          padding: 0;
          margin: 0;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        /* ===== BADGES ===== */
        .app-footer-trust {
          padding: 24px 28px;
        }
        .app-footer-trust-inner {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 24px;
          flex-wrap: wrap;
        }
        .app-footer-badges {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }

        /* ===== STATUS PILL ===== */
        .app-footer-status-pill {
          display: inline-flex;
          align-items: center;
          gap: 14px;
          padding: 8px 14px;
          border-radius: 999px;
          border-width: 1px;
          border-style: solid;
          font-size: 12px;
          transition: all 0.2s ease;
        }
        .app-footer-status-pill:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.05);
        }
        .app-footer-status-indicator {
          display: flex;
          align-items: center;
          gap: 8px;
          font-weight: 500;
        }
        .app-footer-status-link {
          font-weight: 600;
          text-decoration: none;
          font-size: 11.5px;
          padding-left: 12px;
          border-left: 1px solid currentColor;
          border-color: rgba(0,0,0,0.1);
        }
        .app-footer-status-link:hover {
          text-decoration: underline;
        }

        /* ===== FAIXA INFERIOR ===== */
        .app-footer-bottom {
          padding: 20px 28px;
        }
        .app-footer-bottom-inner {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 20px;
          flex-wrap: wrap;
        }
        .app-footer-copyright {
          display: flex;
          align-items: center;
          gap: 12px;
          font-size: 12px;
          flex-wrap: wrap;
        }
        .app-footer-divider {
          width: 3px;
          height: 3px;
          border-radius: 50%;
          opacity: 0.5;
        }
        .app-footer-actions {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .app-footer-socials {
          display: flex;
          gap: 6px;
        }
        .app-footer-version {
          padding: 5px 12px;
          border-radius: 999px;
          font-weight: 700;
          font-size: 11px;
          letter-spacing: 0.04em;
        }
        .app-footer-top-btn {
          width: 34px;
          height: 34px;
          border-radius: 10px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 700;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s ease;
        }
        .app-footer-top-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.08);
        }

        /* ===== INDICADOR PULSANTE ===== */
        .app-footer-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #22C55E;
          box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.6);
          animation: app-footer-pulse 2.2s ease-out infinite;
        }
        @keyframes app-footer-pulse {
          0%   { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.6); }
          70%  { box-shadow: 0 0 0 8px rgba(34, 197, 94, 0); }
          100% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0); }
        }

        @media (prefers-reduced-motion: reduce) {
          .app-footer-dot,
          .app-footer-logo-wrapper,
          .app-footer-top-btn,
          .app-footer-status-pill { animation: none; transition: none; }
        }

        /* ===== RESPONSIVIDADE ===== */
        @media (max-width: 1024px) {
          .app-footer-main {
            grid-template-columns: 1fr 1fr;
            gap: 40px;
            padding: 48px 24px 32px;
          }
          .app-footer-brand-col {
            grid-column: 1 / -1;
          }
        }
        @media (max-width: 640px) {
          .app-footer-main {
            grid-template-columns: 1fr;
            gap: 32px;
            padding: 40px 20px 24px;
          }
          .app-footer-trust-inner,
          .app-footer-bottom-inner {
            flex-direction: column;
            align-items: flex-start;
          }
          .app-footer-newsletter-form {
            flex-direction: column;
          }
          .app-footer-copyright {
            font-size: 11.5px;
          }
        }
      `}</style>
    </footer>
  );
};

/* ===== SUB-COMPONENTES ===== */

const FooterLink: React.FC<{
  t: any;
  href: string;
  badge?: string;
  children: React.ReactNode;
}> = ({ t, href, badge, children }) => (
  <li>
    <a
      href={href}
      className="app-footer-link-item"
      style={{ color: t.textMuted }}
    >
      <span>{children}</span>
      {badge && (
        <span
          className="app-footer-link-badge"
          style={{
            background: `${t.primary}20`,
            color: t.primary,
            border: `1px solid ${t.primary}30`,
          }}
        >
          {badge}
        </span>
      )}
      <style>{`
        .app-footer-link-item {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          text-decoration: none;
          transition: color 0.15s ease, transform 0.15s ease;
          position: relative;
        }
        .app-footer-link-item:hover {
          color: ${t.text} !important;
          transform: translateX(2px);
        }
        .app-footer-link-badge {
          font-size: 9.5px;
          font-weight: 700;
          padding: 2px 6px;
          border-radius: 4px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
      `}</style>
    </a>
  </li>
);

const TrustBadge: React.FC<{ t: any; icon: string; label: string }> = ({
  t,
  icon,
  label,
}) => (
  <div
    className="app-footer-trust-badge"
    style={{
      background: t.surface,
      border: `1px solid ${t.border}`,
      color: t.textSecondary,
    }}
  >
    <span style={{ fontSize: 13 }}>{icon}</span>
    <span>{label}</span>
    <style>{`
      .app-footer-trust-badge {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 6px 12px;
        border-radius: 8px;
        font-size: 11.5px;
        font-weight: 600;
        transition: all 0.2s ease;
      }
      .app-footer-trust-badge:hover {
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(0,0,0,0.06);
      }
    `}</style>
  </div>
);

const SocialIcon: React.FC<{
  t: any;
  label: string;
  href: string;
  children: React.ReactNode;
}> = ({ t, label, href, children }) => (
  <a
    href={href}
    aria-label={label}
    className="app-footer-social-icon"
    style={{
      background: t.surface,
      border: `1px solid ${t.border}`,
      color: t.textSecondary,
    }}
  >
    {children}
    <style>{`
      .app-footer-social-icon {
        width: 34px;
        height: 34px;
        border-radius: 10px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        text-decoration: none;
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      }
      .app-footer-social-icon:hover {
        transform: translateY(-2px);
        color: ${t.primary} !important;
        border-color: ${t.primary}50 !important;
        box-shadow: 0 4px 12px ${t.primary}25;
      }
    `}</style>
  </a>
);