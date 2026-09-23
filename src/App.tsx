import React, { useState } from 'react';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { GlobalFilterProvider } from './context/GlobalFilterContext';
import { PageId } from './types';
import { LoginView } from './components/auth/LoginView';
import { AppLayout } from './components/layout/AppLayout';
import { VisaoMacroPage } from './pages/macro/VisaoMacro';
import { DashboardPage } from './pages/Dashboard';
import { NaoPositivadosPage } from './pages/commercial/NaoPositivados';
import { Top20ClientesPage } from './pages/commercial/Top20Clientes';
import { TopClientesPage } from './pages/commercial/TopClientes';
import { SortimentosPage } from './pages/commercial/Sortimentos';
import { CatalogoPage } from './pages/commercial/Catalogo';
import { ObjetivosPage } from './pages/commercial/Objetivos';
import { RaioXPage } from './pages/sar/RaioX';
import { BaseRoteiroPage } from './pages/sar/BaseRoteiro';
import { VerbaIndenizatoriaPage } from './pages/sar/VerbaIndenizatoria';
import { VendasPage } from './pages/analytics/Vendas';
import { AnalisesPage } from './pages/analytics/Analises';
import { HistoricoPage } from './pages/analytics/Historico';
import { InsightsPage } from './pages/analytics/Insights';
import { EstudosPage } from './pages/analytics/Estudos';
import { ProfilePage } from './pages/account/Profile';
import { SettingsPage } from './pages/account/Settings';
import { CreditosPage } from './pages/account/Creditos';
import { UsersPage } from './pages/admin/Users';
import { ImportacaoPage } from './pages/admin/Importacao';
import { ShieldAlert, ArrowLeft } from 'lucide-react';
import { ErrorBoundary } from './components/common/ErrorBoundary';

function MainApp() {
  const { isAuthenticated, currentUser, canAccessPage, isLoading } = useAuth();
  const { t } = useTheme();
  const [currentPage, setCurrentPage] = useState<PageId>('dashboard');

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
              background: 'rgba(227, 6, 19, 0.12)',
              border: `1px solid rgba(227, 6, 19, 0.3)`,
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
          <p style={{ margin: '0 0 20px', fontSize: '13.5px', color: t.textSecondary, lineHeight: 1.5 }}>
            O perfil atual (<strong>{currentUser?.roleLabel}</strong>) não possui permissão para acessar o módulo selecionado conforme a matriz RBAC do PRD (Seção 6).
          </p>

          <div
            style={{
              background: t.bgSecondary,
              borderRadius: '8px',
              padding: '12px 14px',
              fontSize: '12.5px',
              color: t.textMuted,
              marginBottom: '24px',
              textAlign: 'left',
            }}
          >
            <strong>Escopo Ativo:</strong> {currentUser?.scope.description}
          </div>

          <button
            onClick={() => setCurrentPage('dashboard')}
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
            <span>Retornar ao Dashboard</span>
          </button>
        </div>
      );
    }

    switch (currentPage) {
      case 'macro-view':
        return <VisaoMacroPage />;
      case 'dashboard':
        return <DashboardPage />;
      case 'not-positivated':
        return <NaoPositivadosPage />;
      case 'top-20-customers':
        return <Top20ClientesPage />;
      case 'top-customers':
        return <TopClientesPage />;
      case 'sortiments':
        return <SortimentosPage />;
      case 'catalog':
        return <CatalogoPage />;
      case 'objectives':
        return <ObjetivosPage />;
      case 'sar-raio-x':
        return <RaioXPage />;
      case 'sar-base-roteiro':
        return <BaseRoteiroPage />;
      case 'sar-verba-indenizatoria':
        return <VerbaIndenizatoriaPage />;
      case 'sales':
        return <VendasPage />;
      case 'analytics':
        return <AnalisesPage />;
      case 'history':
        return <HistoricoPage />;
      case 'insights':
        return <InsightsPage />;
      case 'studies':
        return <EstudosPage />;
      case 'profile':
        return <ProfilePage />;
      case 'settings':
        return <SettingsPage />;
      case 'credits':
        return <CreditosPage />;
      case 'users':
        return <UsersPage />;
      case 'imports':
        return <ImportacaoPage />;
      default:
        return <DashboardPage />;
    }
  };

  return (
    <AppLayout currentPage={currentPage} onNavigate={setCurrentPage}>
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
          </GlobalFilterProvider>
        </AuthProvider>
      </ErrorBoundary>
    </ThemeProvider>
  );
}

