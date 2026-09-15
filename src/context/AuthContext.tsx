import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { User, Permission, PageId } from '../types';
import { apiListUsers, apiLogin, apiLogout, apiMe, ApiError, setUnauthorizedHandler } from '../lib/api';
import { clearAuthToken } from '../lib/authToken';

interface AuthContextType {
  currentUser: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  token: string | null;
  login: (email: string, password?: string, rememberMe?: boolean) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  hasPermission: (permission: Permission) => boolean;
  canAccessPage: (pageId: PageId) => boolean;
  availableUsers: User[];
  refreshUsers: () => Promise<void>;
  isLogoutModalOpen: boolean;
  setIsLogoutModalOpen: (open: boolean) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  // token é armazenado em HttpOnly cookie pelo backend; não mantemos token em JS
  const [isLoading, setIsLoading] = useState(true);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);

  const hardLogout = useCallback(() => {
    clearAuthToken();
    setCurrentUser(null);
    setAvailableUsers([]);
    setIsLogoutModalOpen(false);
  }, []);

  const refreshUsers = useCallback(async () => {
    try {
      const users = await apiListUsers();
      setAvailableUsers(users);
    } catch {
      setAvailableUsers([]);
    }
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      hardLogout();
    });
    return () => setUnauthorizedHandler(null);
  }, [hardLogout]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const user = await apiMe();
        if (!mounted) return;
        setCurrentUser(user);
        if (user.role === 'ADMIN') await refreshUsers();
      } catch {
        // not authenticated
        setCurrentUser(null);
      } finally {
        if (mounted) setIsLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [hardLogout, refreshUsers]);

  const login = async (
    email: string,
    password = '',
    rememberMe = true
  ): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true);
    try {
      const body = await apiLogin(email.trim(), password, rememberMe);
      setCurrentUser(body.user);
      if (body.user.role === 'ADMIN') await refreshUsers();
      else setAvailableUsers([]);
      return { success: true };
    } catch (err) {
      hardLogout();
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Falha ao autenticar.';
      return { success: false, error: message };
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    // immediately clear client state so UI returns to login
    clearAuthToken();
    hardLogout();
    // then notify backend to clear HttpOnly cookie (fire-and-forget)
    void apiLogout().catch(() => {
      /* ignore errors */
    });
  };

  const hasPermission = (permission: Permission): boolean => {
    if (!currentUser) return false;
    if (currentUser.role === 'ADMIN' || currentUser.permissions?.includes('admin.full_access')) return true;
    return currentUser.permissions?.includes(permission) ?? false;
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
        return (
          hasPermission('customers.view') ||
          hasPermission('products.view') ||
          hasPermission('sales.view') ||
          hasPermission('targets.view')
        );
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

  // token payload not available client-side when using HttpOnly cookie

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        isAuthenticated: !!currentUser,
        isLoading,
        token: null,
        login,
        logout,
        hasPermission,
        canAccessPage,
        availableUsers,
        refreshUsers,
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
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
