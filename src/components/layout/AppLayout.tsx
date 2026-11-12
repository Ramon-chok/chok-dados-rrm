import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { PageId } from '../../types';
import { LogoutModal } from '../auth/LogoutModal';
import { Footer } from './Footer';
import { APP_CONFIG } from '../../config/appConfig';
import {
  LayoutGrid,
  AlertTriangle,
  Trophy,
  Layers,
  BookOpen,
  ClipboardList,
  Tags,
  Target,
  Users,
  Settings,
  User,
  LogOut,
  Menu,
  X,
  Sun,
  Moon,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ExternalLink,
  Building,
  Compass,
  Award,
  Activity,
  Route,
  DollarSign,
  Clock,
  Bot,
  Database,
  CalendarDays,
  Scale,
  Timer,
  ShoppingBag,
} from 'lucide-react';
import { ScrollToTopButton } from './ScrollToTopButton';
import { SessionTimer } from './SessionTimer';
import { GlobalSearch } from '../common/GlobalSearch';

interface AppLayoutProps {
  currentPage: PageId;
  /** O contexto opcional leva, por exemplo, o fabricante escolhido na pesquisa. */
  onNavigate: (page: PageId, contexto?: { fabricante?: string; categoria?: string }) => void;
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
  const { currentUser, setIsLogoutModalOpen, canAccessPage, idleWarning, idleSecondsLeft, keepSessionAlive } =
    useAuth();
  const { mode, toggleTheme, t } = useTheme();
  const isAiChatPage = currentPage === 'ai-chat';

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isNavbarCollapsed, setIsNavbarCollapsed] = useState(() => {
    try {
      return localStorage.getItem('chok_navbar_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  /**
   * Grupos do menu que estão recolhidos. Guardado no navegador para a
   * organização que o usuário montou sobreviver ao recarregar a página.
   */
  const [gruposFechados, setGruposFechados] = useState<string[]>(() => {
    try {
      const salvo = JSON.parse(localStorage.getItem('chok_menu_grupos_fechados') || '[]');
      return Array.isArray(salvo) ? salvo.filter((x): x is string => typeof x === 'string') : [];
    } catch {
      return [];
    }
  });

  const alternarGrupo = (rotulo: string) => {
    setGruposFechados((anterior) => {
      const proximo = anterior.includes(rotulo)
        ? anterior.filter((x) => x !== rotulo)
        : [...anterior, rotulo];
      try {
        localStorage.setItem('chok_menu_grupos_fechados', JSON.stringify(proximo));
      } catch {}
      return proximo;
    });
  };

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
      // Avulsos: ficam no topo, acima de "Principal", sem título de grupo.
      label: '',
      items: [
        { id: 'sales-board', name: 'Quadro de Vendas', icon: <ClipboardList size={17} /> },
        { id: 'categories', name: 'Categorias', icon: <Tags size={17} /> },
      ],
    },
    {
      label: 'Principal',
      items: [
        { id: 'dashboard', name: 'Dashboard', icon: <LayoutGrid size={17} /> },
        { id: 'macro-view', name: 'Visão Macro', icon: <Compass size={17} /> },
        { id: 'ai-chat', name: 'Chok IA', icon: <Bot size={17} /> },
      ],
    },
    {
      label: 'Comercial',
      items: [
        { id: 'not-positivated', name: 'Não Positivados', icon: <AlertTriangle size={17} /> },
        { id: 'top-20-customers', name: 'TOP 20 Clientes', icon: <Award size={17} /> },
        { id: 'top-customers', name: 'TOP Clientes', icon: <Trophy size={17} /> },
        { id: 'sortiments', name: 'Sortimentos', icon: <Layers size={17} /> },
        { id: 'objectives', name: 'Objetivos', icon: <Target size={17} /> },
        { id: 'commercial-calendar', name: 'Calendário', icon: <CalendarDays size={17} /> },
        { id: 'comparisons', name: 'Comparativos', icon: <Scale size={17} /> },
        { id: 'purchasing', name: 'Compras', icon: <ShoppingBag size={17} /> },
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
        { id: 'targets', name: 'Dados e Exportações', icon: <Database size={17} />, adminOnly: true },
        { id: 'import-history', name: 'Histórico de Importações', icon: <Clock size={17} />, adminOnly: true },
      ],
    },
  ];

  /**
   * Atalhos da barra inferior (celular): as telas de uso diário que ESTE perfil
   * pode abrir. Sai tudo do mesmo `navGroups`/`canAccessPage` usado no menu
   * lateral — não existe uma segunda lista de permissões para manter em dia.
   */
  const ORDEM_ATALHOS: PageId[] = [
    'dashboard',
    'sales-board',
    'commercial-calendar',
    'purchasing',
    'sar-raio-x',
    'top-customers',
    'profile',
  ];
  const todosItens = navGroups.flatMap((grupo) => grupo.items);
  const atalhosMobile = ORDEM_ATALHOS.map((id) => todosItens.find((item) => item.id === id))
    .filter((item): item is NavItem => {
      if (!item) return false;
      if (item.adminOnly && currentUser?.role !== 'ADMIN') return false;
      return canAccessPage(item.id);
    })
    .slice(0, 5);

  /**
   * Se a tela ativa estiver dentro de um grupo recolhido, abre o grupo.
   * Sem isto, navegar pela barra inferior (celular) ou pela pesquisa deixaria o
   * item selecionado escondido, e o menu pareceria "fora de sincronia".
   */
  useEffect(() => {
    const grupo = navGroups.find((g) => g.label && g.items.some((i) => i.id === currentPage));
    if (grupo && gruposFechados.includes(grupo.label)) alternarGrupo(grupo.label);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage]);

  const handleNavClick = (item: NavItem) => {
    if (item.external && item.url) {
      window.open(item.url, '_blank', 'noopener,noreferrer');
      return;
    }
    onNavigate(item.id);
    setIsMobileMenuOpen(false);
  };

  const pageTitles: Record<PageId, string> = {
    'sales-board': 'Quadro de Vendas',
    categories: 'Categorias',
    'macro-view': 'Visão Macro',
    'ai-chat': 'Chok IA',
    dashboard: 'Dashboard',
    'not-positivated': 'Não Positivados',
    'top-20-customers': 'TOP 20 Clientes',
    'top-customers': 'TOP Clientes',
    sortiments: 'Sortimentos',
    catalog: 'Catálogo de Produtos',
    objectives: 'Objetivos',
    'commercial-calendar': 'Calendário Comercial',
    comparisons: 'Comparativos & Simulações',
    purchasing: 'Compras',
    'import-history': 'Histórico de Importações',
    'sar-raio-x': 'Raio-X',
    'sar-base-roteiro': 'Base de Roteiro',
    'sar-verba-indenizatoria': 'Verba Indenizatória',
    profile: 'Meu Perfil',
    settings: 'Configurações',
    credits: 'Créditos',
    users: 'Usuários & RBAC',
    targets: 'Dados e Exportações',
  };

  return (
    <div
      style={{
        background: t.bg,
        color: t.text,
        fontFamily: "'Inter', sans-serif",
        minHeight: '100vh',
        height: isAiChatPage ? '100vh' : undefined,
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
              <img src="/img/Chok Logo.png" alt="Chok Logo" style={{ width: '21px', height: '26px' }} />
              <span className="num" style={{ fontSize: '19px', fontWeight: 700, color: t.text, letterSpacing: '-0.02em' }}>
                Chok
              </span>
            </div>
          ) : (
            <div
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
              onClick={toggleNavbarCollapse}
              title="Expandir barra de navegação"
            >
              <img src="/img/Chok Logo.png" alt="Chok Logo" style={{ width: '21px', height: '26px' }} />
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
            title="Recolher barra de navegação"
            aria-label="Recolher barra de navegação"
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
              title="Expandir barra de navegação"
              aria-label="Expandir barra de navegação"
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

            // Os itens avulsos do topo não têm rótulo — e, sem rótulo, não há
            // onde pôr a setinha. Eles entram sempre abertos, como antes.
            const recolhivel = !!group.label && !isNavbarCollapsed;
            const fechado = recolhivel && gruposFechados.includes(group.label);

            return (
              <div key={group.label || 'avulsos'} style={{ marginBottom: isNavbarCollapsed ? '10px' : fechado ? '6px' : '18px', transition: 'margin-bottom 0.24s ease' }}>
                {recolhivel && (
                  <button
                    onClick={() => alternarGrupo(group.label)}
                    aria-expanded={!fechado}
                    title={fechado ? `Mostrar telas de ${group.label}` : `Ocultar telas de ${group.label}`}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '4px 10px 6px',
                      border: 'none',
                      background: 'transparent',
                      cursor: 'pointer',
                      color: fechado ? t.textSecondary : t.textMuted,
                      fontSize: '11.5px',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                      textAlign: 'left',
                      minHeight: 0,
                      transition: 'color 0.16s ease',
                    }}
                  >
                    <ChevronDown size={13} className="ga-grupo-seta" data-fechado={fechado} />
                    <span style={{ flex: 1 }}>{group.label}</span>
                    {/* Com o grupo fechado, o contador mostra o que ficou escondido. */}
                    {fechado && (
                      <span
                        className="num"
                        style={{
                          fontSize: '10px',
                          padding: '1px 6px',
                          borderRadius: 20,
                          background: t.surfaceElevated,
                          border: `1px solid ${t.border}`,
                          color: t.textMuted,
                        }}
                      >
                        {accessibleItems.length}
                      </span>
                    )}
                  </button>
                )}
                {group.label && isNavbarCollapsed && (
                  <div style={{ height: '1px', background: t.border, margin: '6px 4px 8px' }} />
                )}

                <div className="ga-grupo-itens" data-fechado={fechado}>
                  <div>
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
                </div>
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
            title={isNavbarCollapsed ? `${currentUser.name} (${currentUser.role})` : undefined}
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
                    {currentUser.role}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </aside>

      {/* Main Content Area */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <header
          style={{
            height: '68px',
            borderBottom: `1px solid ${t.border}`,
            display: isAiChatPage ? 'none' : 'flex',
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
            {/* Perfil autenticado via JWT */}
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

            {/* Pesquisa inteligente (Seção 7) — também abre com Ctrl/⌘+K */}
            <GlobalSearch onNavigate={onNavigate} />

            {/* Tempo restante da sessão (desconexão automática ao final) */}
            <SessionTimer />

            {/* Theme Toggle Button */}
            <button
              onClick={(evento) => {
                // O círculo da animação nasce no centro do próprio botão.
                const caixa = evento.currentTarget.getBoundingClientRect();
                toggleTheme({ x: caixa.left + caixa.width / 2, y: caixa.top + caixa.height / 2 });
              }}
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
                overflow: 'hidden',
              }}
              title={mode === 'dark' ? 'Mudar para Modo Claro' : 'Mudar para Modo Escuro'}
              aria-label={mode === 'dark' ? 'Mudar para modo claro' : 'Mudar para modo escuro'}
            >
              {/* A `key` troca junto com o tema: isso remonta o ícone e faz a
                  animação de giro rodar a cada alternância. */}
              <span key={mode} className="ga-theme-icon">
                {mode === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
              </span>
            </button>
          </div>
        </header>

        {/* Data Scope Banner for non-admin profiles */}
        {!isAiChatPage && currentUser && currentUser.role !== 'ADMIN' && (
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

        {/* Aviso de inatividade (Seção 4): último minuto antes da desconexão. */}
        {idleWarning && (
          <div
            className="ga-fade-in"
            style={{
              padding: '10px 28px',
              background: `${t.warning}1A`,
              borderBottom: `1px solid ${t.warning}55`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              flexWrap: 'wrap',
              fontSize: '12.5px',
              color: t.text,
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Timer size={15} color={t.warning} />
              Sem atividade há quase 40 minutos. Sua sessão será encerrada em{' '}
              <strong className="num">{idleSecondsLeft}s</strong>.
            </span>
            <button
              onClick={keepSessionAlive}
              className="ga-tap"
              style={{
                padding: '6px 14px',
                borderRadius: 8,
                border: 'none',
                background: t.warning,
                color: '#0C1725',
                fontWeight: 700,
                fontSize: '12.5px',
                cursor: 'pointer',
              }}
            >
              Continuar conectado
            </button>
          </div>
        )}

        {/* Main Content View */}
        <main
          style={{
            flex: 1,
            minHeight: 0,
            display: isAiChatPage ? 'flex' : undefined,
            padding: isAiChatPage ? 0 : '28px',
          }}
          className="content-pad"
        >
          {children}
        </main>

        {!isAiChatPage && (
          <>
            <Footer />
            <ScrollToTopButton />
          </>
        <Footer />
        <ScrollToTopButton />

        {/* Seção 10 — barra inferior no celular: as telas mais usadas a um
            toque, sem precisar abrir o menu lateral. Só aparece em telas
            estreitas; no desktop a navegação continua sendo a lateral. */}
        {atalhosMobile.length > 1 && (
          <nav
            className="mobile-tabbar"
            aria-label="Navegação rápida"
            style={{
              background: t.bgSecondary,
              borderTop: `1px solid ${t.border}`,
            }}
          >
            {atalhosMobile.map((item) => {
              const ativo = currentPage === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item)}
                  aria-current={ativo ? 'page' : undefined}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 3,
                    padding: '7px 2px',
                    border: 'none',
                    background: 'transparent',
                    color: ativo ? t.accentTeal : t.textMuted,
                    cursor: 'pointer',
                    fontSize: 9.5,
                    fontWeight: ativo ? 700 : 500,
                    transition: 'color 0.16s ease',
                  }}
                >
                  {item.icon}
                  <span
                    style={{
                      maxWidth: '100%',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {item.name}
                  </span>
                </button>
              );
            })}
          </nav>
        )}
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
        .mobile-tabbar { display: none; }
        @media (max-width: 760px) {
          .mobile-tabbar {
            display: flex;
            position: fixed;
            left: 0;
            right: 0;
            bottom: 0;
            z-index: 45;
            padding-bottom: env(safe-area-inset-bottom, 0px);
          }
          /* Espaço para o conteúdo não ficar atrás da barra. */
          .content-pad { padding-bottom: 76px !important; }
        }
      `}</style>
    </div>
  );
};
