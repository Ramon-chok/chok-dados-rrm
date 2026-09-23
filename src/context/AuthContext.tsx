import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { User, Permission, PageId } from '../types';
import {
  getErrorMessage,
  apiListUsers,
  apiLogin,
  apiLogin2FA,
  apiLogout,
  clearApiCache,
  apiMe,
  apiSession,
  ApiError,
  isLoginRequires2FA,
  setUnauthorizedHandler,
} from '../lib/api';
import { clearAuthToken } from '../lib/authToken';

/** Tempos da sessão, já em epoch ms do relógio do navegador (corrigido pelo servidor). */
export interface SessionTimes {
  startedAt: number;
  expiresAt: number;
  rememberMe: boolean;
}

/** Aviso mostrado na tela de login depois de uma desconexão automática. */
const SESSION_EXPIRED_NOTICE = 'Sua sessão atingiu o tempo máximo e foi encerrada. Faça login novamente.';
const SESSION_ENDED_NOTICE = 'Sua sessão foi encerrada. Faça login novamente.';

/** setTimeout aceita no máximo ~24,8 dias; acima disso reagenda em etapas. */
const MAX_TIMEOUT_MS = 2_147_000_000;

export type LoginOutcome =
  | { success: true }
  | { success: false; error: string }
  | { success: false; requires2FA: true; tempToken: string; method?: string };

interface AuthContextType {
  currentUser: User | null;
  isAuthenticated: boolean;
  /** true apenas enquanto a sessão inicial (cookie/me) está sendo validada */
  isLoading: boolean;
  token: string | null;
  login: (email: string, password?: string, rememberMe?: boolean) => Promise<LoginOutcome>;
  complete2FALogin: (tempToken: string, code: string) => Promise<LoginOutcome>;
  logout: () => void;
  hasPermission: (permission: Permission) => boolean;
  canAccessPage: (pageId: PageId) => boolean;
  availableUsers: User[];
  refreshUsers: () => Promise<void>;
  isLogoutModalOpen: boolean;
  setIsLogoutModalOpen: (open: boolean) => void;
  /** null enquanto não autenticado ou enquanto os tempos ainda não chegaram do servidor. */
  session: SessionTimes | null;
  sessionNotice: string | null;
  clearSessionNotice: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  // token é armazenado em HttpOnly cookie pelo backend; não mantemos token em JS
  // isLoading = bootstrap da sessão. NÃO usar no login/2FA — isso desmonta o LoginView e perde o estado pending2FA.
  const [isLoading, setIsLoading] = useState(true);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const [session, setSession] = useState<SessionTimes | null>(null);
  const [sessionNotice, setSessionNotice] = useState<string | null>(null);
  // Lido pelo handler de 401 (registrado uma vez) sem depender de closure desatualizada.
  const authenticatedRef = useRef(false);

  const hardLogout = useCallback(() => {
    clearAuthToken();
    clearApiCache();
    authenticatedRef.current = false;
    setCurrentUser(null);
    setSession(null);
    setAvailableUsers([]);
    setIsLogoutModalOpen(false);
  }, []);

  /** Tempo total da sessão atingido: encerra no servidor e volta ao login com aviso. */
  const expireSession = useCallback(() => {
    if (!authenticatedRef.current) return;
    hardLogout();
    setSessionNotice(SESSION_EXPIRED_NOTICE);
    void apiLogout();
  }, [hardLogout]);

  useEffect(() => {
    authenticatedRef.current = !!currentUser;
  }, [currentUser]);

  // Busca os tempos da sessão sempre que um usuário entra (login, 2FA ou cookie existente).
  useEffect(() => {
    if (!currentUser) return;
    let mounted = true;
    (async () => {
      try {
        const sentAt = Date.now();
        const info = await apiSession();
        const receivedAt = Date.now();
        // Diferença entre o relógio do servidor e o do navegador (meio do round-trip).
        const offset = new Date(info.serverTime).getTime() - (sentAt + receivedAt) / 2;
        if (!mounted) return;
        setSession({
          startedAt: new Date(info.startedAt).getTime() - offset,
          expiresAt: new Date(info.expiresAt).getTime() - offset,
          rememberMe: info.rememberMe,
        });
      } catch {
        // Sem os tempos, o contador não aparece; o backend continua recusando o token expirado.
      }
    })();
    return () => {
      mounted = false;
    };
  }, [currentUser?.id]);

  // Desconecta exatamente quando o tempo total acaba. Timers ficam atrasados em abas
  // em segundo plano, então também confere ao voltar o foco para a aba.
  useEffect(() => {
    if (!session) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const check = () => {
      const remaining = session.expiresAt - Date.now();
      if (remaining <= 0) {
        expireSession();
        return;
      }
      if (timer) clearTimeout(timer);
      timer = setTimeout(check, Math.min(remaining, MAX_TIMEOUT_MS));
    };
    check();
    const onVisible = () => {
      if (document.visibilityState === 'visible') check();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', check);
    return () => {
      if (timer) clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', check);
    };
  }, [session, expireSession]);

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
      // 401 com o usuário logado = token expirado/revogado no servidor.
      if (authenticatedRef.current) setSessionNotice(SESSION_ENDED_NOTICE);
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
  ): Promise<LoginOutcome> => {
    // Não alterar isLoading aqui: o App desmonta LoginView quando isLoading=true
    // e o estado local de 2FA (pending2FA) seria perdido.
    setSessionNotice(null);
    try {
      const body = await apiLogin(email.trim(), password, rememberMe);
      if (isLoginRequires2FA(body)) {
        return {
          success: false,
          requires2FA: true,
          tempToken: body.tempToken,
          method: body.method,
        };
      }
      setCurrentUser(body.user);
      if (body.user.role === 'ADMIN') await refreshUsers();
      else setAvailableUsers([]);
      return { success: true };
    } catch (err) {
      hardLogout();
      const message =
        getErrorMessage(err, 'Falha ao autenticar.');
      return { success: false, error: message };
    }
  };

  const complete2FALogin = async (tempToken: string, code: string): Promise<LoginOutcome> => {
    // Mesmo motivo do login: manter LoginView montado até o usuário autenticar de fato.
    try {
      const body = await apiLogin2FA(tempToken, code.trim());
      setCurrentUser(body.user);
      if (body.user.role === 'ADMIN') await refreshUsers();
      else setAvailableUsers([]);
      return { success: true };
    } catch (err) {
      const message =
        getErrorMessage(err, 'Código 2FA inválido.');
      return { success: false, error: message };
    }
  };

  const logout = () => {
    // immediately clear client state so UI returns to login
    clearAuthToken();
    clearApiCache();
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
      case 'top-20-customers':
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
        return currentUser.role !== 'VENDEDOR' && hasPermission('analytics.view');
      case 'studies':
        return hasPermission('studies.view');
      case 'targets':
        return hasPermission('targets.view');
      case 'history':
        return currentUser.role !== 'VENDEDOR' && hasPermission('history.view');
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
        complete2FALogin,
        logout,
        hasPermission,
        canAccessPage,
        availableUsers,
        refreshUsers,
        isLogoutModalOpen,
        setIsLogoutModalOpen,
        session,
        sessionNotice,
        clearSessionNotice: () => setSessionNotice(null),
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
