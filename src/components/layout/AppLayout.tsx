import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { PageId } from '../../types';
import { LogoutModal } from '../auth/LogoutModal';
import { APP_CONFIG } from '../../config/appConfig';
import {
  LayoutGrid,
  AlertTriangle,
  Trophy,
  Layers,
  BookOpen,
  BarChart3,
  FlaskConical,
  Target,
  Clock,
  Sparkles,
  FileText,
  Users,
  Settings,
  ShieldAlert,
  User,
  LogOut,
  Menu,
  X,
  Sun,
  Moon,
  Bell,
  Search,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Building,
  Compass,
  ShoppingBag,
  History,
  UploadCloud,
  Award,
  Activity,
  Route,
  DollarSign,
} from 'lucide-react';

interface AppLayoutProps {
  currentPage: PageId;
  onNavigate: (page: PageId) => void;
  children: React.ReactNode;
}

interface NavItem {
  id: PageId;
  name: string;
  icon: React.ReactNode;
  external?: boolean;
  url?: string;
  requiredPermission?: string;
  adminOnly?: boolean;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

export const AppLayout: React.FC<AppLayoutProps> = ({ currentPage, onNavigate, children }) => {
  const { currentUser, setIsLogoutModalOpen, canAccessPage } = useAuth();
  const { mode, toggleTheme, t } = useTheme();

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isNavbarCollapsed, setIsNavbarCollapsed] = useState(() => {
    try {
      return localStorage.getItem('chok_navbar_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  const toggleNavbarCollapse = () => {
    setIsNavbarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('chok_navbar_collapsed', String(next));
      } catch {}
      return next;
    });
  };

  const navGroups: NavGroup[] = [
    {
      label: 'Principal',
      items: [
        { id: 'dashboard', name: 'Dashboard', icon: <LayoutGrid size={17} /> },
        { id: 'macro-view', name: 'Visão Macro', icon: <Compass size={17} /> },
      ],
    },
    {
      label: 'Comercial',
      items: [
        { id: 'not-positivated', name: 'Não Positivados', icon: <AlertTriangle size={17} /> },
        { id: 'top-customers', name: 'TOP Clientes', icon: <Trophy size={17} /> },
        { id: 'sortiments', name: 'Sortimentos', icon: <Layers size={17} /> },
        { id: 'objectives', name: 'Objetivos', icon: <Target size={17} /> },
        {
          id: 'catalog',
          name: 'Catálogo',
          icon: <BookOpen size={17} />,
          external: true,
          url: APP_CONFIG.CATALOG_URL,
        },
      ],
    },
    {
      label: 'SAR',
      items: [
        { id: 'sar-raio-x', name: 'Raio-X', icon: <Activity size={17} /> },
        { id: 'sar-base-roteiro', name: 'Base de Roteiro', icon: <Route size={17} /> },
        { id: 'sar-verba-indenizatoria', name: 'Verba Indenizatória', icon: <DollarSign size={17} /> },
      ],
    },
    {
      label: 'Análises',
      items: [
        { id: 'analytics', name: 'Análises', icon: <BarChart3 size={17} /> },
        { id: 'history', name: 'Histórico', icon: <History size={17} /> },
      ],
    },
    {
      label: 'Conta',
      items: [
        { id: 'profile', name: 'Meu Perfil', icon: <User size={17} /> },
        { id: 'settings', name: 'Configurações', icon: <Settings size={17} /> },
        { id: 'credits', name: 'Créditos', icon: <Award size={17} /> },
      ],
    },
    {
      label: 'Administração',
      items: [
        { id: 'users', name: 'Usuários & RBAC', icon: <Users size={17} />, adminOnly: true },
        { id: 'imports', name: 'ImportaÃ§Ã£o', icon: <UploadCloud size={17} />, adminOnly: true },
      ],
    },
  ];

  const handleNavClick = (item: NavItem) => {
    if (item.external && item.url) {
      window.open(item.url, '_blank', 'noopener,noreferrer');
      return;
    }
    onNavigate(item.id);
    setIsMobileMenuOpen(false);
  };

  const pageTitles: Record<PageId, string> = {
    'macro-view': 'Visão Macro',
    dashboard: 'Dashboard',
    'not-positivated': 'Não Positivados',
    'top-customers': 'TOP Clientes',
    sortiments: 'Sortimentos',
    catalog: 'Catálogo de Produtos',
    objectives: 'Objetivos',
    'sar-raio-x': 'Raio-X',
    'sar-base-roteiro': 'Base de Roteiro',
    'sar-verba-indenizatoria': 'Verba Indenizatória',
    sales: 'Vendas',
    analytics: 'Análises',
    studies: 'Estudos',
    targets: 'Metas',
    history: 'Histórico',
    insights: 'Insights',
    reports: 'Relatórios',
    profile: 'Meu Perfil',
    settings: 'Configurações',
    credits: 'Créditos',
    users: 'Usuários & RBAC',
    imports: 'Importação',
    audit: 'Auditoria',
  };

  return (
    <div
      style={{
        background: t.bg,
        color: t.text,
        fontFamily: "'Inter', sans-serif",
        minHeight: '100vh',
        display: 'flex',
        position: 'relative',
      }}
    >
      {/* Mobile Menu Backdrop */}
      {isMobileMenuOpen && (
        <div
          onClick={() => setIsMobileMenuOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(3px)',
            zIndex: 40,
          }}
        />
      )}

      {/* Sidebar Navigation */}
      <aside
        style={{
          width: isNavbarCollapsed ? '68px' : '240px',
          height: '100vh',
          position: 'sticky',
          top: 0,
          flexShrink: 0,
          background: t.bgSecondary,
          borderRight: `1px solid ${t.border}`,
          display: 'flex',
          flexDirection: 'column',
          padding: isNavbarCollapsed ? '20px 8px' : '22px 14px',
          zIndex: 50,
          transition: 'width 0.22s ease, padding 0.22s ease, transform 0.25s ease',
          boxSizing: 'border-box',
        }}
        className={`sidebar-container ${isMobileMenuOpen ? 'mobile-open' : ''} ${isNavbarCollapsed ? 'navbar-collapsed' : ''}`}
      >
        {/* Logo and Brand Identity */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: isNavbarCollapsed ? 'center' : 'space-between',
            padding: isNavbarCollapsed ? '0 0 16px' : '0 4px 24px',
            position: 'relative',
          }}
        >
          {!isNavbarCollapsed ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <svg width="26" height="26" viewBox="0 0 26 26">
                <path d="M13 1 L25 7 L25 19 L13 25 L1 19 L1 7 Z" fill="none" stroke={t.primary} strokeWidth="1.8" />
                <path d="M13 1 V25 M1 7 L25 19 M25 7 L1 19" stroke={t.primary} strokeWidth="1.1" opacity="0.4" />
              </svg>
              <span className="num" style={{ fontSize: '19px', fontWeight: 700, color: t.text, letterSpacing: '-0.02em' }}>
                Chok
              </span>
            </div>
          ) : (
            <div
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
              onClick={toggleNavbarCollapse}
              title="Expandir barra de navegaÃ§Ã£o"
            >
              <svg width="26" height="26" viewBox="0 0 26 26">
                <path d="M13 1 L25 7 L25 19 L13 25 L1 19 L1 7 Z" fill="none" stroke={t.primary} strokeWidth="1.8" />
                <path d="M13 1 V25 M1 7 L25 19 M25 7 L1 19" stroke={t.primary} strokeWidth="1.1" opacity="0.4" />
              </svg>
            </div>
          )}

          {/* Desktop collapse toggle on sidebar */}
          <button
            onClick={toggleNavbarCollapse}
            className="sidebar-toggle-btn"
            style={{
              background: 'transparent',
              border: `1px solid ${t.border}`,
              borderRadius: '6px',
              color: t.textSecondary,
              cursor: 'pointer',
              display: isNavbarCollapsed ? 'none' : 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '26px',
              height: '26px',
              padding: 0,
              transition: 'all 0.15s ease',
            }}
            title="Recolher barra de navegaÃ§Ã£o"
            aria-label="Recolher barra de navegaÃ§Ã£o"
          >
            <ChevronLeft size={15} />
          </button>

          {/* Mobile close button */}
          <button
            onClick={() => setIsMobileMenuOpen(false)}
            className="mobile-close-btn"
            style={{
              background: 'transparent',
              border: 'none',
              color: t.textMuted,
              cursor: 'pointer',
              display: 'none',
              padding: '4px',
            }}
            aria-label="Fechar menu"
          >
            <X size={18} />
          </button>
        </div>

        {/* Small expand button when collapsed */}
        {isNavbarCollapsed && (
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '14px' }}>
            <button
              onClick={toggleNavbarCollapse}
              style={{
                background: t.surfaceElevated,
                border: `1px solid ${t.border}`,
                borderRadius: '6px',
                color: t.textSecondary,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '28px',
                height: '28px',
                padding: 0,
                transition: 'all 0.15s ease',
              }}
              title="Expandir barra de navegaÃ§Ã£o"
              aria-label="Expandir barra de navegaÃ§Ã£o"
            >
              <ChevronRight size={15} />
            </button>
          </div>
        )}

        {/* Navigation Items */}
        <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', paddingRight: isNavbarCollapsed ? 0 : '2px' }}>
          {navGroups.map((group) => {
            // Filter items user can access
            const accessibleItems = group.items.filter((item) => {
              if (item.adminOnly && currentUser?.role !== 'ADMIN') return false;
              return canAccessPage(item.id);
            });

            if (accessibleItems.length === 0) return null;

            return (
              <div key={group.label} style={{ marginBottom: isNavbarCollapsed ? '10px' : '18px' }}>
                {!isNavbarCollapsed ? (
                  <div style={{ fontSize: '11.5px', color: t.textMuted, padding: '0 10px 6px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    {group.label}
                  </div>
                ) : (
                  <div style={{ height: '1px', background: t.border, margin: '6px 4px 8px' }} />
                )}
                {accessibleItems.map((item) => {
                  const isActive = currentPage === item.id;
                  return (
                    <div
                      key={item.id}
                      onClick={() => handleNavClick(item)}
                      title={item.name}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: isNavbarCollapsed ? 'center' : 'flex-start',
                        gap: isNavbarCollapsed ? 0 : '10px',
                        padding: isNavbarCollapsed ? '9px 0' : '9px 10px',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        color: isActive ? t.text : t.textSecondary,
                        background: isActive ? (isNavbarCollapsed ? `${t.primary}18` : t.surfaceElevated) : 'transparent',
                        fontSize: '13.5px',
                        fontWeight: isActive ? 600 : 500,
                        borderLeft: isActive ? `3px solid ${t.primary}` : '3px solid transparent',
                        transition: 'all 0.15s ease',
                        marginBottom: '2px',
                      }}
                    >
                      <span style={{ color: isActive ? t.primary : t.textMuted, display: 'flex' }}>
                        {item.icon}
                      </span>
                      {!isNavbarCollapsed && <span style={{ flex: 1 }}>{item.name}</span>}
                      {!isNavbarCollapsed && item.external && (
                        <ExternalLink size={13} style={{ color: t.textMuted, marginLeft: 'auto', flexShrink: 0 }} />
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}

          {/* Sair Button as per PRD Section 48 */}
          <div style={{ marginTop: '8px', paddingTop: '10px', borderTop: `1px solid ${t.border}` }}>
            <div
              onClick={() => setIsLogoutModalOpen(true)}
              title="Sair da Conta"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: isNavbarCollapsed ? 'center' : 'flex-start',
                gap: isNavbarCollapsed ? 0 : '10px',
                padding: isNavbarCollapsed ? '9px 0' : '9px 10px',
                borderRadius: '8px',
                cursor: 'pointer',
                color: t.primaryHover,
                fontSize: '13.5px',
                fontWeight: 500,
                transition: 'background 0.15s ease',
              }}
            >
              <LogOut size={16} />
              {!isNavbarCollapsed && <span>Sair da Conta</span>}
            </div>
          </div>
        </div>

        {/* User Card in Footer */}
        {currentUser && (
          <div
            style={{
              marginTop: 'auto',
              padding: isNavbarCollapsed ? '8px 0' : '12px 10px',
              borderTop: `1px solid ${t.border}`,
              background: isNavbarCollapsed ? 'transparent' : t.surface,
              borderRadius: '10px',
              display: 'flex',
              justifyContent: 'center',
            }}
            title={isNavbarCollapsed ? `${currentUser.name} (${currentUser.role} Â· ${currentUser.scope.level})` : undefined}
          >
            {isNavbarCollapsed ? (
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  background: t.primary,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: '#fff',
                  flexShrink: 0,
                }}
              >
                {currentUser.avatarInitials}
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%' }}>
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    background: t.primary,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: '#fff',
                    flexShrink: 0,
                  }}
                >
                  {currentUser.avatarInitials}
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {currentUser.name}
                  </div>
                  <div style={{ fontSize: '11px', color: t.textMuted }}>
                    {currentUser.role} Â· {currentUser.scope.level}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </aside>

      {/* Main Content Area */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        {/* Top Header */}
        <header
          style={{
            height: '68px',
            borderBottom: `1px solid ${t.border}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 28px',
            background: t.bg,
            position: 'sticky',
            top: 0,
            zIndex: 30,
          }}
          className="header-bar"
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: '1 1 auto' }}>
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="hamburger"
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '8px',
                border: `1px solid ${t.border}`,
                background: 'transparent',
                cursor: 'pointer',
                color: t.textSecondary,
                display: 'none',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
              aria-label="Abrir menu lateral"
            >
              <Menu size={16} />
            </button>
            <div
              className="num"
              style={{
                fontSize: '19px',
                fontWeight: 600,
                color: t.text,
                minWidth: 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {pageTitles[currentPage] || 'Chok'}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
            {/* Perfil autenticado via JWT (sem simulação) */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 12px',
                borderRadius: '8px',
                border: `1px solid ${t.border}`,
                background: t.surface,
                color: t.text,
                fontSize: '12.5px',
                fontWeight: 500,
              }}
              title="Sessão autenticada com token JWT"
            >
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: t.primary, flexShrink: 0 }} />
              <span className="profile-switcher-label">
                Perfil: <strong>{currentUser?.role}</strong>
              </span>
            </div>

            {/* Theme Toggle Button */}
            <button
              onClick={toggleTheme}
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '8px',
                border: `1px solid ${t.border}`,
                background: 'transparent',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: t.textSecondary,
              }}
              title={mode === 'dark' ? 'Mudar para Modo Claro' : 'Mudar para Modo Escuro'}
            >
              {mode === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
            </button>
          </div>
        </header>

        {/* Data Scope Banner for non-admin profiles */}
        {currentUser && currentUser.role !== 'ADMIN' && (
          <div
            style={{
              padding: '8px 28px',
              background: `${t.primary}0D`,
              borderBottom: `1px solid ${t.primary}33`,
              fontSize: '12.5px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: t.text }}>
              <Building size={14} color={t.primary} />
              <span>
                <strong>Escopo Ativo ({currentUser.role}):</strong> {currentUser.scope.description}
              </span>
            </div>
            
          </div>
        )}

        {/* Main Content View */}
        <main style={{ flex: 1, padding: '28px' }} className="content-pad">
          {children}
        </main>
      </div>

      {/* Logout confirmation modal */}
      <LogoutModal />

      <style>{`
        .hamburger { display: none; }
        .desktop-header-collapse-btn { display: flex; }
        @media (max-width: 980px) {
          .sidebar-container {
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            bottom: 0 !important;
            height: 100vh !important;
            width: 240px !important;
            padding: 22px 14px !important;
            transform: translateX(-100%);
            box-shadow: 6px 0 28px rgba(0, 0, 0, 0.4);
          }
          .sidebar-container.mobile-open {
            transform: translateX(0);
          }
          .hamburger {
            display: flex !important;
          }
          .desktop-header-collapse-btn {
            display: none !important;
          }
          .sidebar-toggle-btn {
            display: none !important;
          }
          .mobile-close-btn {
            display: flex !important;
          }
        }
        @media (max-width: 620px) {
          .content-pad {
            padding: 16px !important;
          }
          .header-bar {
            padding: 0 16px !important;
          }
        }
        @media (max-width: 480px) {
          .profile-switcher-label {
            display: none;
          }
        }
      `}</style>
    </div>
  );
};

