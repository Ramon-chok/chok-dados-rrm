import React, { useEffect, useState } from 'react';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { GlobalFilterProvider } from './context/GlobalFilterContext';
import { PageId } from './types';
import { LoginView } from './components/auth/LoginView';
import { AppLayout } from './components/layout/AppLayout';
import { VisaoMacroPage } from './pages/macro/VisaoMacro';
import { DashboardPage } from './pages/Dashboard';
import { NaoPositivadosPage } from './pages/commercial/NaoPositivados';
import { TopClientesPage } from './pages/commercial/TopClientes';
import { SortimentosPage } from './pages/commercial/Sortimentos';
import { CatalogoPage } from './pages/commercial/Catalogo';
import { ObjetivosPage } from './pages/commercial/Objetivos';
import { CalendarioComercialPage } from './pages/commercial/CalendarioComercial';
import { ComparativosPage } from './pages/commercial/Comparativos';
import { ComprasPage } from './pages/commercial/Compras';
import { VisualFabricantesPage } from './pages/manufacturers/VisualFabricantes';
import { RaioXPage } from './pages/sar/RaioX';
import { BaseRoteiroPage } from './pages/sar/BaseRoteiro';
import { VerbaIndenizatoriaPage } from './pages/sar/VerbaIndenizatoria';
import { QuadroVendasPage } from './pages/board/QuadroVendas';
import { CategoriasPage } from './pages/board/Categorias';
import { ProfilePage } from './pages/account/Profile';
import { SettingsPage } from './pages/account/Settings';
import { CreditosPage } from './pages/account/Creditos';
import { UsersPage } from './pages/admin/Users';
import { MetasPage } from './pages/admin/Metas';
import { HistoricoImportacoesPage } from './pages/admin/HistoricoImportacoes';
import { LiberacoesPage } from './pages/admin/Liberacoes';
import { ConfirmacaoAlteracao } from './components/auth/ConfirmacaoAlteracao';
import { AiChatPage } from './pages/AiChat';
import { ShieldAlert, ArrowLeft } from 'lucide-react';
import { ErrorBoundary } from './components/common/ErrorBoundary';

/**
 * Ordem de preferência da tela inicial, seguindo a ordem do menu.
 *
 * Não dá mais para fixar "Quadro de Vendas": ele e Categorias passaram a ser
 * restritos a ADMIN/GERENTE/SUPERVISOR, então o Vendedor cairia direto na
 * tela de acesso negado ao entrar. Aqui se escolhe a primeira tela que o
 * perfil realmente pode abrir.
 */
const PAGINAS_INICIAIS: PageId[] = [
  // Seção 5 do escopo: o Dashboard é a página inicial de TODOS os perfis — o
  // conteúdo dele é que muda conforme o acesso. Por isso ele passou para o
  // topo desta lista; os demais continuam como alternativa para um perfil que,
  // por configuração, fique sem `dashboard.view`.
  'dashboard',
  'sales-board',
  'categories',
  'dashboard',
  'ai-chat',
  'not-positivated',
  'top-customers',
  'sortiments',
  'catalog',
  'objectives',
  'sar-raio-x',
  'sar-base-roteiro',
  'sar-verba-indenizatoria',
  'commercial-calendar',
  'comparisons',
  'purchasing',
  // Fornecedor: é a única tela do escopo dele, então precisa estar
  // nesta lista para ele não cair em 'Meu Perfil' ao entrar.
  'manufacturer-visual',
  'profile',
];

/** Contexto que uma tela pode receber ao ser aberta pela pesquisa inteligente. */
export interface NavContext {
  fabricante?: string;
  categoria?: string;
}

function MainApp() {
  const { isAuthenticated, currentUser, canAccessPage, isLoading } = useAuth();
  const { t } = useTheme();
  const [currentPage, setCurrentPage] = useState<PageId | null>(null);
  // Preenchido pela pesquisa inteligente (ex.: "abrir o fabricante X").
  const [navContext, setNavContext] = useState<NavContext>({});

  /** Navega e, opcionalmente, já entrega um contexto para a tela destino. */
  const navegar = (pagina: PageId, contexto?: NavContext) => {
    setNavContext(contexto || {});
    setCurrentPage(pagina);
  };

  /** Primeira tela do menu que este perfil pode abrir. */
  const paginaInicial = (): PageId =>
    PAGINAS_INICIAIS.find((p) => canAccessPage(p)) ?? 'profile';

  // A página só pode ser escolhida depois que o usuário chega (canAccessPage
  // depende dele), por isso o estado começa nulo e é definido aqui.
  useEffect(() => {
    if (!isAuthenticated) {
      // Logout: esquece a tela atual para que o próximo login escolha de novo
      // conforme o perfil que entrar.
      if (currentPage !== null) setCurrentPage(null);
      return;
    }
    if (currentPage === null) setCurrentPage(paginaInicial());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, currentPage, currentUser]);

  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: t.bg, color: t.textSecondary, fontSize: 14 }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 40, height: 40, border: '3px solid rgba(255,255,255,0.15)', borderTopColor: t.primary, borderRadius: '50%', animation: 'rr-spin 0.8s linear infinite' }} />
          <div style={{ fontSize: 13, color: t.textSecondary }}>Carregando sessão...</div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginView />;
  }

  // Enquanto o efeito acima não escolheu a tela inicial deste perfil, não
  // renderiza nada. Sem esta guarda, `currentPage` nulo cai no `default` do
  // switch e o Quadro de Vendas aparecia por um instante — inclusive para o
  // Vendedor, que não deve vê-lo. (O tsconfig não usa `strict`, então o nulo
  // não é apontado em tempo de compilação.)
  if (currentPage === null) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: t.bg,
        }}
      />
    );
  }

  // Check if current user has permission to access the active page
  const hasAccess = canAccessPage(currentPage);

  const renderContent = () => {
    if (!hasAccess) {
      return (
        <div
          style={{
            maxWidth: '540px',
            margin: '60px auto',
            background: t.surface,
            border: `1px solid ${t.border}`,
            borderRadius: '16px',
            padding: '36px',
            textAlign: 'center',
            boxShadow: '0 10px 30px rgba(0, 0, 0, 0.25)',
          }}
        >
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '14px',
              background: `${t.danger}1F`,
              border: `1px solid ${t.danger}4D`,
              color: t.primary,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 18px',
            }}
          >
            <ShieldAlert size={28} />
          </div>

          <h2 style={{ margin: '0 0 8px', fontSize: '20px', fontWeight: 700, color: t.text }}>
            Acesso Restrito ao seu Escopo
          </h2>
          <p style={{ margin: '0 0 24px', fontSize: '13.5px', color: t.textSecondary, lineHeight: 1.5 }}>
            O perfil atual (<strong>{currentUser?.roleLabel}</strong>) não possui permissão para acessar o módulo selecionado conforme a matriz RBAC do PRD (Seção 6).
          </p>


          <button
            onClick={() => setCurrentPage(paginaInicial())}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 20px',
              borderRadius: '8px',
              border: 'none',
              background: t.primary,
              color: '#fff',
              fontSize: '13.5px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <ArrowLeft size={16} />
            <span>Voltar para a tela inicial</span>
          </button>
        </div>
      );
    }

    switch (currentPage) {
      case 'sales-board':
        return <QuadroVendasPage />;
      case 'categories':
        return <CategoriasPage />;
      case 'macro-view':
        return <VisaoMacroPage />;
      case 'ai-chat':
        return <AiChatPage />;
      case 'dashboard':
        return (
          <DashboardPage
            onAbrirObjetivos={canAccessPage('objectives') ? () => navegar('objectives') : undefined}
          />
        );
      case 'not-positivated':
        return <NaoPositivadosPage />;
      case 'top-customers':
        return <TopClientesPage />;
      case 'sortiments':
        return <SortimentosPage />;
      case 'catalog':
        return <CatalogoPage />;
      case 'objectives':
        return <ObjetivosPage />;
      case 'commercial-calendar':
        return <CalendarioComercialPage />;
      case 'comparisons':
        return <ComparativosPage />;
      case 'purchasing':
        return <ComprasPage />;
      case 'manufacturer-visual':
        return <VisualFabricantesPage />;
      case 'sar-raio-x':
        return <RaioXPage />;
      case 'sar-base-roteiro':
        return <BaseRoteiroPage />;
      case 'sar-verba-indenizatoria':
        return <VerbaIndenizatoriaPage />;
      case 'profile':
        return <ProfilePage />;
      case 'settings':
        return <SettingsPage />;
      case 'credits':
        return <CreditosPage />;
      case 'users':
        return <UsersPage />;
      case 'targets':
        return <MetasPage />;
      case 'import-history':
        return <HistoricoImportacoesPage />;
      case 'write-grants':
        return <LiberacoesPage />;
      default:
        // Não cai mais no Quadro de Vendas: ele é restrito, e um PageId novo
        // sem `case` aqui exporia a tela a quem não deve vê-la. Perfil é a
        // única página liberada para todos os papéis.
        return <ProfilePage />;
    }
  };

  return (
    <AppLayout currentPage={currentPage} onNavigate={navegar}>
      {/* Erro em uma página não derruba o layout; trocar de página tenta de novo. */}
      <ErrorBoundary resetKey={currentPage}>{renderContent()}</ErrorBoundary>
    </AppLayout>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <ErrorBoundary fullScreen>
        <AuthProvider>
          <GlobalFilterProvider>
            <MainApp />
            {/*
              Fora do roteamento de propósito: a confirmação de alteração é
              acionada pela camada de rede, a partir de qualquer tela que
              grave algo — inclusive da própria tela de login, se um dia ela
              gravar. Montar uma vez evita registrar o confirmador em vários
              lugares e perder o pedido ao trocar de página.
            */}
            <ConfirmacaoAlteracao />
          </GlobalFilterProvider>
        </AuthProvider>
      </ErrorBoundary>
    </ThemeProvider>
  );
}
