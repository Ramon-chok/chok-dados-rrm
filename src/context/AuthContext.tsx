import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, Permission, PageId } from '../types';

export const MOCK_USERS: User[] = [
  {
    id: 'user-admin',
    name: 'Ramon Silva',
    email: 'ramon21.empresa@gmail.com',
    role: 'ADMIN',
    roleLabel: 'Administrador',
    avatarInitials: 'RS',
    phone: '(16) 99742-1080',
    address: 'Av. Presidente Vargas, 2000',
    neighborhood: 'Jardim América',
    city: 'Ribeirão Preto',
    state: 'SP',
    cep: '14020-260',
    manager: 'Diretoria Geral',
    status: 'Ativo',
    lastLoginAt: 'Hoje às 18:05',
    scope: {
      level: 'EMPRESA',
      description: 'Visão Global da Empresa (Acesso irrestrito a todos os dados e módulos)',
    },
    permissions: [
      'admin.full_access',
      'dashboard.view',
      'analytics.view',
      'analytics.create',
      'studies.view',
      'studies.create',
      'targets.view',
      'targets.create',
      'targets.edit',
      'sales.view',
      'sales.edit',
      'customers.view',
      'customers.edit',
      'products.view',
      'imports.view',
      'imports.create',
      'reports.view',
      'reports.export',
      'history.view',
      'users.view',
      'users.create',
      'users.edit',
      'users.delete',
      'settings.view',
      'settings.edit',
      'audit.view',
    ],
  },
  {
    id: 'user-gerente',
    name: 'Carlos Mendes',
    email: 'carlos.mendes@chok.com.br',
    role: 'GERENTE',
    roleLabel: 'Gerência',
    avatarInitials: 'CM',
    phone: '(16) 98112-4433',
    address: 'Rua General Osório, 850',
    neighborhood: 'Centro',
    city: 'Ribeirão Preto',
    state: 'SP',
    cep: '14010-000',
    manager: 'Gerência TRAD',
    status: 'Ativo',
    lastLoginAt: 'Hoje às 14:22',
    scope: {
      level: 'GERENTE',
      description: 'Gerência TRAD (Visão completa da empresa, sem alteração estrutural)',
      manager: 'TRAD',
    },
    permissions: [
      'dashboard.view',
      'analytics.view',
      'studies.view',
      'targets.view',
      'sales.view',
      'customers.view',
      'products.view',
      'reports.view',
      'reports.export',
      'history.view',
      'settings.view',
    ],
  },
  {
    id: 'user-supervisor',
    name: 'Marcos Valério',
    email: 'marcos.valerio@chok.com.br',
    role: 'SUPERVISOR',
    roleLabel: 'Supervisor',
    avatarInitials: 'MV',
    phone: '(16) 99120-7788',
    address: 'Rua Barão do Rio Branco, 412',
    neighborhood: 'Centro',
    city: 'Sertãozinho',
    state: 'SP',
    cep: '14160-000',
    team: 'TRAB ALFA',
    supervisor: 'Supervisor A',
    manager: 'TRAD',
    status: 'Ativo',
    lastLoginAt: 'Ontem às 17:40',
    scope: {
      level: 'SUPERVISOR',
      description: 'Equipe TRAB ALFA (Acesso exclusivo e consolidado à própria equipe)',
      team: 'TRAB ALFA',
      supervisor: 'Supervisor A',
      manager: 'TRAD',
    },
    permissions: [
      'dashboard.view',
      'analytics.view',
      'studies.view',
      'targets.view',
      'sales.view',
      'customers.view',
      'products.view',
      'reports.view',
      'history.view',
    ],
  },
  {
    id: 'user-vendedor',
    name: 'João Souza',
    email: 'joao.vendedor003@chok.com.br',
    role: 'VENDEDOR',
    roleLabel: 'Vendedor',
    avatarInitials: 'JS',
    phone: '(16) 99233-5511',
    address: 'Rua Florêncio de Abreu, 1420',
    neighborhood: 'Centro',
    city: 'Ribeirão Preto',
    state: 'SP',
    cep: '14015-060',
    sellerCode: '003',
    team: 'TRAB ALFA',
    supervisor: 'Supervisor A',
    manager: 'TRAD',
    status: 'Ativo',
    lastLoginAt: 'Hoje às 09:15',
    scope: {
      level: 'VENDEDOR',
      description: 'Vendedor 003 (Acesso restrito exclusivamente aos próprios clientes, produtos e metas)',
      sellerCode: '003',
      team: 'TRAB ALFA',
      supervisor: 'Supervisor A',
      manager: 'TRAD',
    },
    permissions: [
      'dashboard.view',
      'targets.view',
      'sales.view',
      'customers.view',
      'products.view',
      'analytics.view',
      'history.view',
    ],
  },
];

interface AuthContextType {
  currentUser: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password?: string, rememberMe?: boolean) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  switchUser: (userId: string) => void;
  hasPermission: (permission: Permission) => boolean;
  canAccessPage: (pageId: PageId) => boolean;
  availableUsers: User[];
  isLogoutModalOpen: boolean;
  setIsLogoutModalOpen: (open: boolean) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const savedUserId = localStorage.getItem('chok_auth_user_id');
    if (savedUserId) {
      const found = MOCK_USERS.find((u) => u.id === savedUserId);
      if (found) return found;
    }
    // Default to Ramon (Admin) so user can immediately evaluate the screens as instructed in PRD
    return MOCK_USERS[0];
  });

  const [isLoading, setIsLoading] = useState(false);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);

  const login = async (email: string, _password?: string, rememberMe = true): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true);
    // Simulate brief authentication latency
    await new Promise((res) => setTimeout(res, 450));

    const normalizedEmail = email.trim().toLowerCase();
    const user = MOCK_USERS.find((u) => u.email.toLowerCase() === normalizedEmail);

    if (!user) {
      setIsLoading(false);
      return {
        success: false,
        error: 'E-mail ou credenciais corporativas não encontradas no sistema.',
      };
    }

    setCurrentUser(user);
    if (rememberMe) {
      localStorage.setItem('chok_auth_user_id', user.id);
    } else {
      sessionStorage.setItem('chok_auth_user_id', user.id);
    }
    setIsLoading(false);
    return { success: true };
  };

  const logout = () => {
    localStorage.removeItem('chok_auth_user_id');
    sessionStorage.removeItem('chok_auth_user_id');
    setCurrentUser(null);
    setIsLogoutModalOpen(false);
  };

  const switchUser = (userId: string) => {
    const user = MOCK_USERS.find((u) => u.id === userId);
    if (user) {
      setCurrentUser(user);
      localStorage.setItem('chok_auth_user_id', user.id);
    }
  };

  const hasPermission = (permission: Permission): boolean => {
    if (!currentUser) return false;
    if (currentUser.role === 'ADMIN' || currentUser.permissions.includes('admin.full_access')) return true;
    return currentUser.permissions.includes(permission);
  };

  const canAccessPage = (pageId: PageId): boolean => {
    if (!currentUser) return false;
    if (pageId === 'macro-view') {
      return currentUser.role === 'ADMIN' || currentUser.role === 'GERENTE' || currentUser.role === 'SUPERVISOR';
    }
    if (currentUser.role === 'ADMIN') return true;

    switch (pageId) {
      case 'dashboard':
        return hasPermission('dashboard.view');
      case 'not-positivated':
      case 'top-customers':
      case 'sortiments':
      case 'catalog':
      case 'objectives':
        return hasPermission('customers.view') || hasPermission('products.view') || hasPermission('sales.view') || hasPermission('targets.view');
      case 'sar-raio-x':
      case 'sar-base-roteiro':
      case 'sar-verba-indenizatoria':
        return true;
      case 'analytics':
        return hasPermission('analytics.view');
      case 'studies':
        return hasPermission('studies.view');
      case 'targets':
        return hasPermission('targets.view');
      case 'history':
        return hasPermission('history.view');
      case 'insights':
        return hasPermission('analytics.view') || hasPermission('dashboard.view');
      case 'reports':
        return hasPermission('reports.view');
      case 'users':
        return hasPermission('users.view') || currentUser.role === 'ADMIN';
      case 'imports':
        return currentUser.role === 'ADMIN';
      case 'audit':
        return hasPermission('audit.view') || currentUser.role === 'ADMIN';
      case 'credits':
      case 'profile':
      case 'settings':
        return true;
      default:
        return true;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        isAuthenticated: !!currentUser,
        isLoading,
        login,
        logout,
        switchUser,
        hasPermission,
        canAccessPage,
        availableUsers: MOCK_USERS,
        isLogoutModalOpen,
        setIsLogoutModalOpen,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
