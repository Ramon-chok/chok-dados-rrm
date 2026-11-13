import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { PageId, isAdminRole } from '../../types';
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
  Factory,
  KeyRound,
  TrendingUp,
  Home,
} from 'lucide-react';
import { ScrollToTopButton } from './ScrollToTopButton';
import { GlobalSearch } from '../common/GlobalSearch';
import { ReportarBug } from './ReportarBug';

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
  adminOnly?: boolean;
  /** Selo curto à direita do item (ex.: "novo", "validando"). */
  selo?: string;
}

interface NavGroup {
  label: string;
  icon?: React.ReactNode;
  items: NavItem[];
}

/**
 * Casca da aplicação: barra lateral, faixa do topo e área de conteúdo.
 *
 * Organização (pedido do usuário, referência visual enviada):
 *
 *   • Barra lateral — só as telas de TRABALHO, em grupos recolhíveis com a
 *     seta à direita, itens recuados com linha-guia e o item ativo marcado por
 *     um traço na borda direita.
 *   • Faixa do topo — pesquisa, Chok IA, reportar bug, tema e o avatar.
 *     Conta e Administração saíram da barra lateral e vivem no menu do
 *     avatar, ao lado do tema: são telas de configuração, não de trabalho.
 *   • Saíram da faixa: o selo de perfil, o selo de alteração e o contador de
 *     sessão. Saiu de todas as telas: a tarja "Escopo Ativo". O aviso de
 *     inatividade (último minuto antes da desconexão) continua, porque ele
 *     pede uma ação do usuário.
 */
export const AppLayout: React.FC<AppLayoutProps> = ({ currentPage, onNavigate, children }) => {
  const { currentUser, setIsLogoutModalOpen, canAccessPage, idleWarning, idleSecondsLeft, keepSessionAlive } =
    useAuth();
  const { mode, toggleTheme, t } = useTheme();
  const isAiChatPage = currentPage === 'ai-chat';
  const ehAdmin = isAdminRole(currentUser?.role);

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [menuAvatarAberto, setMenuAvatarAberto] = useState(false);
  const menuAvatarRef = useRef<HTMLDivElement>(null);
  /** Celular: opções da faixa recolhidas atrás da setinha. */
  const [extrasAbertos, setExtrasAbertos] = useState(false);
  const extrasRef = useRef<HTMLDivElement>(null);

  const [isNavbarCollapsed, setIsNavbarCollapsed] = useState(() => {
    try {
      return localStorage.getItem('chok_navbar_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  /** Grupos recolhidos — guardados no navegador para sobreviver ao recarregar. */
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
      const proximo = anterior.includes(rotulo) ? anterior.filter((x) => x !== rotulo) : [...anterior, rotulo];
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

  /** Telas de trabalho — barra lateral. */
  const navGroups: NavGroup[] = [
    {
      // Avulsos: no topo, sem título de grupo.
      label: '',
      items: [
        { id: 'dashboard', name: 'Início', icon: <Home size={17} /> },
        { id: 'sales-board', name: 'Quadro de Vendas', icon: <ClipboardList size={17} /> },
        { id: 'categories', name: 'Categorias', icon: <Tags size={17} /> },
      ],
    },
    {
      label: 'Principal',
      icon: <LayoutGrid size={17} />,
      items: [
        { id: 'macro-view', name: 'Visão Macro', icon: <Compass size={17} /> },
        { id: 'ai-chat', name: 'Chok IA', icon: <Bot size={17} /> },
      ],
    },
    {
      label: 'Comercial',
      icon: <TrendingUp size={17} />,
      items: [
        { id: 'not-positivated', name: 'Não Positivados', icon: <AlertTriangle size={17} /> },
        { id: 'top-customers', name: 'TOP Clientes', icon: <Trophy size={17} /> },
        { id: 'sortiments', name: 'Sortimentos', icon: <Layers size={17} /> },
        { id: 'objectives', name: 'Objetivos', icon: <Target size={17} /> },
        { id: 'commercial-calendar', name: 'Calendário', icon: <CalendarDays size={17} /> },
        { id: 'comparisons', name: 'Comparativos', icon: <Scale size={17} /> },
        { id: 'purchasing', name: 'Compras', icon: <ShoppingBag size={17} /> },
        { id: 'manufacturer-visual', name: 'Visual Fabricantes', icon: <Factory size={17} /> },
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
      icon: <Activity size={17} />,
      items: [
        { id: 'sar-raio-x', name: 'Raio-X', icon: <Activity size={17} /> },
        { id: 'sar-base-roteiro', name: 'Base de Roteiro', icon: <Route size={17} /> },
        { id: 'sar-verba-indenizatoria', name: 'Verba Indenizatória', icon: <DollarSign size={17} /> },
      ],
    },
  ];

  /** Conta e Administração — menu do avatar, ao lado do tema. */
  const itensConta: NavItem[] = [
    { id: 'profile', name: 'Meu Perfil', icon: <User size={16} /> },
    { id: 'settings', name: 'Configurações', icon: <Settings size={16} /> },
    { id: 'credits', name: 'Créditos', icon: <Award size={16} /> },
  ];
  const itensAdmin: NavItem[] = [
    { id: 'users', name: 'Usuários & RBAC', icon: <Users size={16} />, adminOnly: true },
    { id: 'targets', name: 'Dados, Metas e Exportações', icon: <Database size={16} />, adminOnly: true },
    { id: 'import-history', name: 'Histórico de Importações', icon: <Clock size={16} />, adminOnly: true },
    { id: 'write-grants', name: 'Liberações de Alteração', icon: <KeyRound size={16} />, adminOnly: true },
  ];

  const podeVer = (item: NavItem) => {
    if (item.adminOnly && !ehAdmin) return false;
    return canAccessPage(item.id);
  };

  /** Atalhos da barra inferior no celular: as telas de uso diário deste perfil. */
  const ORDEM_ATALHOS: PageId[] = [
    'dashboard',
    'manufacturer-visual',
    'sales-board',
    'top-customers',
    'commercial-calendar',
    'purchasing',
    'sar-raio-x',
    'profile',
  ];
  const todosItens = [...navGroups.flatMap((g) => g.items), ...itensConta, ...itensAdmin];
  const atalhosMobile = ORDEM_ATALHOS.map((id) => todosItens.find((item) => item.id === id))
    .filter((item): item is NavItem => !!item && podeVer(item))
    .slice(0, 5);

  /** Se a tela ativa está num grupo recolhido, abre o grupo. */
  useEffect(() => {
    const grupo = navGroups.find((g) => g.label && g.items.some((i) => i.id === currentPage));
    if (grupo && gruposFechados.includes(grupo.label)) alternarGrupo(grupo.label);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage]);

  // Menu do avatar: fecha com clique fora e com Esc.
  useEffect(() => {
    if (!menuAvatarAberto) return;
    const aoClicar = (e: MouseEvent) => {
      if (menuAvatarRef.current && !menuAvatarRef.current.contains(e.target as Node)) setMenuAvatarAberto(false);
    };
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuAvatarAberto(false);
    };
    document.addEventListener('mousedown', aoClicar);
    document.addEventListener('keydown', aoTeclar);
    return () => {
      document.removeEventListener('mousedown', aoClicar);
      document.removeEventListener('keydown', aoTeclar);
    };
  }, [menuAvatarAberto]);

  // Opções recolhidas: fecham com clique fora, Esc e ao trocar de tela.
  useEffect(() => {
    if (!extrasAbertos) return;
    const aoClicar = (e: MouseEvent) => {
      if (extrasRef.current && !extrasRef.current.contains(e.target as Node)) setExtrasAbertos(false);
    };
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setExtrasAbertos(false);
    };
    document.addEventListener('mousedown', aoClicar);
    document.addEventListener('keydown', aoTeclar);
    return () => {
      document.removeEventListener('mousedown', aoClicar);
      document.removeEventListener('keydown', aoTeclar);
    };
  }, [extrasAbertos]);
  useEffect(() => setExtrasAbertos(false), [currentPage]);

  const handleNavClick = (item: NavItem) => {
    if (item.external && item.url) {
      window.open(item.url, '_blank', 'noopener,noreferrer');
      return;
    }
    onNavigate(item.id);
    setIsMobileMenuOpen(false);
    setMenuAvatarAberto(false);
  };

  const pageTitles: Record<PageId, string> = {
    'sales-board': 'Quadro de Vendas',
    categories: 'Categorias',
    'macro-view': 'Visão Macro',
    'ai-chat': 'Chok IA',
    dashboard: 'Início',
    'not-positivated': 'Não Positivados',
    'top-customers': 'TOP Clientes',
    sortiments: 'Sortimentos',
    catalog: 'Catálogo de Produtos',
    objectives: 'Objetivos',
    'commercial-calendar': 'Calendário Comercial',
    comparisons: 'Comparativos & Simulações',
    purchasing: 'Compras',
    'manufacturer-visual': 'Visual Fabricantes',
    'import-history': 'Histórico de Importações',
    'write-grants': 'Liberações de Alteração',
    'sar-raio-x': 'Raio-X',
    'sar-base-roteiro': 'Base de Roteiro',
    'sar-verba-indenizatoria': 'Verba Indenizatória',
    profile: 'Meu Perfil',
    settings: 'Configurações',
    credits: 'Créditos',
    users: 'Usuários & RBAC',
    targets: 'Dados, Metas e Exportações',
  };

  const renderItem = (item: NavItem) => {
    const ativo = currentPage === item.id;
    return (
      <div
        key={item.id}
        role="link"
        tabIndex={0}
        aria-current={ativo ? 'page' : undefined}
        onClick={() => handleNavClick(item)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleNavClick(item);
          }
        }}
        title={item.name}
        className={`nav-item${isNavbarCollapsed ? ' nav-item--compacto' : ''}`}
      >
        <span className="nav-item__icone">{item.icon}</span>
        {!isNavbarCollapsed && <span className="nav-item__rotulo">{item.name}</span>}
        {!isNavbarCollapsed && item.selo && <span className="nav-item__selo">{item.selo}</span>}
        {!isNavbarCollapsed && item.external && (
          <ExternalLink size={13} style={{ color: t.textMuted, flexShrink: 0 }} />
        )}
      </div>
    );
  };

  const contaVisivel = itensConta.filter(podeVer);
  const adminVisivel = itensAdmin.filter(podeVer);

  return (
    <div
      style={{
        background: t.bg,
        color: t.text,
        fontFamily: 'var(--ga-sans)',
        minHeight: '100vh',
        height: isAiChatPage ? '100vh' : undefined,
        display: 'flex',
        position: 'relative',
      }}
    >
      {isMobileMenuOpen && (
        <div
          onClick={() => setIsMobileMenuOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.6)',
            backdropFilter: 'blur(3px)',
            zIndex: 40,
          }}
        />
      )}

      {/* ═══════════════ BARRA LATERAL ═══════════════ */}
      <aside
        style={{
          width: isNavbarCollapsed ? '72px' : '252px',
          height: '100vh',
          position: 'sticky',
          top: 0,
          flexShrink: 0,
          background: t.bgSecondary,
          borderRight: `1px solid ${t.border}`,
          display: 'flex',
          flexDirection: 'column',
          padding: isNavbarCollapsed ? '18px 10px' : '20px 12px',
          zIndex: 50,
          transition: 'width 0.22s ease, padding 0.22s ease, transform 0.25s ease',
          boxSizing: 'border-box',
        }}
        className={`sidebar-container ${isMobileMenuOpen ? 'mobile-open' : ''} ${isNavbarCollapsed ? 'navbar-collapsed' : ''}`}
      >
        {/* Marca */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: isNavbarCollapsed ? 'center' : 'space-between',
            padding: isNavbarCollapsed ? '0 0 14px' : '0 6px 20px',
          }}
        >
          {!isNavbarCollapsed ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
              <img
                src="/img/marca/favicon.svg"
                alt=""
                aria-hidden="true"
                style={{ width: '30px', height: '30px', borderRadius: '8px', flexShrink: 0 }}
              />
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontFamily: 'var(--ga-display)',
                    fontSize: '15.5px',
                    fontWeight: 700,
                    color: t.text,
                    letterSpacing: '-0.02em',
                    lineHeight: 1.15,
                  }}
                >
                  {APP_CONFIG.appName}
                </div>
                <div
                  style={{
                    fontFamily: 'var(--ga-display)',
                    fontSize: '9px',
                    fontWeight: 600,
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    color: t.textMuted,
                    lineHeight: 1.3,
                    marginTop: '1px',
                  }}
                >
                  {APP_CONFIG.brandEndorsement}
                </div>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={toggleNavbarCollapse}
              title="Expandir barra de navegação"
              aria-label="Expandir barra de navegação"
              style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer', minHeight: 0 }}
            >
              <img src="/img/marca/favicon.svg" alt={APP_CONFIG.appFullName} style={{ width: 30, height: 30, borderRadius: 8 }} />
            </button>
          )}

          <button
            type="button"
            onClick={toggleNavbarCollapse}
            className="sidebar-toggle-btn"
            style={{
              background: 'transparent',
              border: `1px solid ${t.border}`,
              borderRadius: '7px',
              color: t.textSecondary,
              cursor: 'pointer',
              display: isNavbarCollapsed ? 'none' : 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '26px',
              height: '26px',
              minHeight: 0,
              padding: 0,
            }}
            title="Recolher barra de navegação"
            aria-label="Recolher barra de navegação"
          >
            <ChevronLeft size={15} />
          </button>

          <button
            type="button"
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

        {isNavbarCollapsed && (
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '12px' }}>
            <button
              type="button"
              onClick={toggleNavbarCollapse}
              style={{
                background: t.surfaceElevated,
                border: `1px solid ${t.border}`,
                borderRadius: '7px',
                color: t.textSecondary,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '28px',
                height: '28px',
                minHeight: 0,
                padding: 0,
              }}
              title="Expandir barra de navegação"
              aria-label="Expandir barra de navegação"
            >
              <ChevronRight size={15} />
            </button>
          </div>
        )}

        {/* Itens */}
        <nav aria-label="Telas" style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
          {navGroups.map((group) => {
            const acessiveis = group.items.filter(podeVer);
            if (acessiveis.length === 0) return null;

            // Sem rótulo (avulsos) ou barra recolhida: lista simples.
            if (!group.label || isNavbarCollapsed) {
              return (
                <div key={group.label || 'avulsos'} style={{ marginBottom: 8 }}>
                  {group.label && isNavbarCollapsed && (
                    <div style={{ height: 1, background: t.border, margin: '6px 6px 8px' }} />
                  )}
                  {acessiveis.map(renderItem)}
                </div>
              );
            }

            const fechado = gruposFechados.includes(group.label);
            const temAtivo = acessiveis.some((i) => i.id === currentPage);
            return (
              <div key={group.label} style={{ marginBottom: 4 }}>
                <button
                  type="button"
                  className="nav-grupo__titulo"
                  aria-expanded={!fechado}
                  onClick={() => alternarGrupo(group.label)}
                  style={temAtivo ? { color: t.primary } : undefined}
                >
                  <span style={{ display: 'flex', color: temAtivo ? t.primary : t.textMuted }}>{group.icon}</span>
                  <span style={{ flex: 1 }}>{group.label}</span>
                  {fechado && (
                    <span className="num nav-item__selo" title="Telas neste grupo">
                      {acessiveis.length}
                    </span>
                  )}
                  <ChevronDown size={15} className="nav-grupo__seta" />
                </button>
                <div className="ga-grupo-itens" data-fechado={fechado}>
                  <div>
                    <div className="nav-grupo__itens">{acessiveis.map(renderItem)}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </nav>
      </aside>

      {/* ═══════════════ ÁREA PRINCIPAL ═══════════════ */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        {/* Faixa do topo — assinatura da marca (classe .faixa-marca). */}
        <header
          style={{
            height: '64px',
            display: isAiChatPage ? 'none' : 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            padding: '0 24px',
            position: 'sticky',
            top: 0,
            zIndex: 30,
          }}
          className="header-bar faixa-marca"
        >
          <span className="faixa-marca__mascara" aria-hidden="true">
            <img src="/img/marca/simbolo-branco.svg" alt="" className="faixa-marca__simbolo" />
          </span>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: '1 1 auto' }}>
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(true)}
              className="hamburger faixa-botao"
              aria-label="Abrir menu lateral"
            >
              <Menu size={17} />
            </button>
            <h1
              style={{
                margin: 0,
                fontFamily: 'var(--ga-display)',
                fontSize: '18px',
                fontWeight: 700,
                letterSpacing: '-0.02em',
                color: '#fff',
                minWidth: 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {pageTitles[currentPage] || APP_CONFIG.appName}
            </h1>
          </div>

          {/* Ações da faixa. No computador ficam todas à vista; no celular,
              pesquisa · bug · tema recolhem atrás da setinha (itens ocultos) e
              só o avatar fica sempre visível. O Chok IA saiu daqui: virou o
              botão flutuante no canto inferior direito. */}
          <div className="faixa-acoes" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
            <div ref={extrasRef} style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <button
                type="button"
                className="faixa-botao faixa-mais"
                aria-label={extrasAbertos ? 'Ocultar opções' : 'Mostrar mais opções'}
                aria-expanded={extrasAbertos}
                aria-controls="faixa-extras"
                title={extrasAbertos ? 'Ocultar opções' : 'Mais opções'}
                onClick={() => setExtrasAbertos((v) => !v)}
              >
                <ChevronDown size={17} className="faixa-mais__seta" />
              </button>

              <div
                id="faixa-extras"
                className="faixa-extras"
                data-aberto={extrasAbertos}
                // Escolher uma opção recolhe o grupo. O diálogo que ela abre
                // (pesquisa, bug) continua visível — ver .faixa-extras no CSS.
                onClick={(e) => {
                  if ((e.target as HTMLElement).closest('.faixa-botao')) setExtrasAbertos(false);
                }}
              >
                <GlobalSearch onNavigate={onNavigate} naFaixa />

                <ReportarBug paginaAtual={pageTitles[currentPage] || currentPage} />

                <button
                  type="button"
                  className="faixa-botao"
                  onClick={(evento) => {
                    const caixa = evento.currentTarget.getBoundingClientRect();
                    toggleTheme({ x: caixa.left + caixa.width / 2, y: caixa.top + caixa.height / 2 });
                  }}
                  title={mode === 'dark' ? 'Mudar para modo claro' : 'Mudar para modo escuro'}
                  aria-label={mode === 'dark' ? 'Mudar para modo claro' : 'Mudar para modo escuro'}
                  style={{ overflow: 'hidden' }}
                >
                  <span key={mode} className="ga-theme-icon">
                    {mode === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
                  </span>
                </button>
              </div>
            </div>

            {/* Avatar → Conta e Administração */}
            {currentUser && (
              <div ref={menuAvatarRef} style={{ position: 'relative' }}>
                <button
                  type="button"
                  className="faixa-avatar"
                  aria-haspopup="menu"
                  aria-expanded={menuAvatarAberto}
                  onClick={() => setMenuAvatarAberto((v) => !v)}
                  title={currentUser.name}
                >
                  {currentUser.avatarInitials}
                </button>

                {menuAvatarAberto && (
                  <div className="menu-avatar" role="menu">
                    <div className="menu-avatar__cabeca">
                      <span className="faixa-avatar" style={{ cursor: 'default' }} aria-hidden="true">
                        {currentUser.avatarInitials}
                      </span>
                      <div style={{ minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: 13.5,
                            fontWeight: 600,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {currentUser.name}
                        </div>
                        <div
                          style={{
                            fontSize: 11.5,
                            color: t.textMuted,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {currentUser.email}
                        </div>
                      </div>
                    </div>

                    {contaVisivel.length > 0 && <div className="menu-avatar__rotulo">Conta</div>}
                    {contaVisivel.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        role="menuitem"
                        className="menu-avatar__item"
                        aria-current={currentPage === item.id ? 'page' : undefined}
                        onClick={() => handleNavClick(item)}
                      >
                        {item.icon}
                        {item.name}
                      </button>
                    ))}

                    {adminVisivel.length > 0 && <div className="menu-avatar__rotulo">Administração</div>}
                    {adminVisivel.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        role="menuitem"
                        className="menu-avatar__item"
                        aria-current={currentPage === item.id ? 'page' : undefined}
                        onClick={() => handleNavClick(item)}
                      >
                        {item.icon}
                        {item.name}
                      </button>
                    ))}

                    <div style={{ height: 1, background: t.border, margin: '6px 4px' }} />
                    <button
                      type="button"
                      role="menuitem"
                      className="menu-avatar__item menu-avatar__item--sair"
                      onClick={() => {
                        setMenuAvatarAberto(false);
                        setIsLogoutModalOpen(true);
                      }}
                    >
                      <LogOut size={16} />
                      Sair da conta
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </header>

        {/* Aviso de inatividade: último minuto antes da desconexão. */}
        {idleWarning && (
          <div
            className="ga-fade-in"
            style={{
              padding: '10px 24px',
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
              type="button"
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

        <main
          style={{
            flex: 1,
            minHeight: 0,
            minWidth: 0,
            display: isAiChatPage ? 'flex' : undefined,
            padding: isAiChatPage ? 0 : '24px',
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
        )}

        {/* Barra inferior no celular: as telas mais usadas a um toque. */}
        {atalhosMobile.length > 1 && (
          <nav
            className="mobile-tabbar"
            aria-label="Navegação rápida"
            style={{ background: t.bgSecondary, borderTop: `1px solid ${t.border}` }}
          >
            {atalhosMobile.map((item) => {
              const ativo = currentPage === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
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
                    fontSize: 10,
                    fontWeight: ativo ? 700 : 500,
                  }}
                >
                  {item.icon}
                  <span style={{ maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.name}
                  </span>
                </button>
              );
            })}
          </nav>
        )}
      </div>

      {/* Chok IA — botão flutuante no canto inferior direito, como nas
          plataformas de atendimento. Some na própria tela da IA. */}
      {!isAiChatPage && canAccessPage('ai-chat') && (
        <button
          type="button"
          className="ia-flutuante"
          onClick={() => onNavigate('ai-chat')}
          aria-label="Abrir o Chok IA"
          title="Abrir o Chok IA"
        >
          <Bot size={22} />
          <span className="ia-flutuante__rotulo">Chok IA</span>
        </button>
      )}

      <LogoutModal />

      <style>{`
        .hamburger { display: none !important; }
        @media (max-width: 980px) {
          .sidebar-container {
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            bottom: 0 !important;
            height: 100dvh !important;
            width: min(280px, 86vw) !important;
            padding: 20px 12px !important;
            transform: translateX(-100%);
            box-shadow: 6px 0 28px rgba(0, 0, 0, 0.4);
          }
          .sidebar-container.mobile-open { transform: translateX(0); }
          .hamburger { display: inline-flex !important; }
          .sidebar-toggle-btn { display: none !important; }
          .mobile-close-btn { display: flex !important; }
        }
        @media (max-width: 620px) {
          .content-pad { padding: 16px !important; }
          .header-bar { padding: 0 12px !important; height: 58px !important; }
          .header-bar h1 { font-size: 16px !important; }
          .faixa-acoes { gap: 6px !important; }
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
          .content-pad { padding-bottom: 80px !important; }
        }
      `}</style>
    </div>
  );
};
