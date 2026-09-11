import {
  authHeader,
  clearAuthToken,
  getStoredToken,
  isTokenExpired,
  storeAuthToken,
} from './authToken';

// Cliente HTTP único do frontend — só fala com o backend (/api/*).
// Todas as páginas autenticadas enviam Authorization: Bearer <JWT>.

const IMPORT_API_KEY = ((import.meta as any).env?.VITE_IMPORT_API_KEY as string) || '';

export interface ImportRowError {
  linha: number;
  motivo: string;
}

export interface ImportResultSummary {
  importId: number;
  tipo: string;
  tipoLabel: string;
  arquivo: string | null;
  dataReferencia: string;
  totalAnalisados: number;
  novos: number;
  atualizados: number;
  rejeitados: number;
  status: 'CONCLUIDO' | 'CONCLUIDO_COM_AVISOS' | 'FALHA';
  erros: ImportRowError[];
}

export interface ImportLogEntry {
  id: number;
  tipo: string;
  arquivo: string | null;
  usuario_nome: string | null;
  usuario_email: string | null;
  data_referencia: string | null;
  mes_referencia: number | null;
  ano_referencia: number | null;
  data_importacao: string;
  total_linhas: number;
  novos: number;
  atualizados: number;
  rejeitados: number;
  status: 'CONCLUIDO' | 'CONCLUIDO_COM_AVISOS' | 'FALHA';
  mensagem_erro: string | null;
}

export interface DashboardResponse {
  kpis: {
    meta: number;
    realizado: number;
    gap: number;
    atingimento: number;
    margem: number;
    metaCobertura: number;
    realizadoCobertura: number;
    gapCobertura: number;
    pctCobertura: number;
    metaSortimento: number;
    realizadoSortimento: number;
    gapSortimento: number;
    pctSortimento: number;
  };
  serieMensal: Array<{ ano: number; mes: number; meta: number; realizado: number; margem: number }>;
  fabricantes: Array<{
    fabricante: string;
    meta: number;
    realizado: number;
    gap: number;
    pctR: number;
    metaCobertura: number;
    realizadoCobertura: number;
    pctCob: number;
    pctMargem: number;
  }>;
  topClientes: Array<{ nome: string; equipe: string | null; valor: number; eRede: boolean; codigo: string | null }>;
}

export interface AnalyticsTreeNode {
  nome: string;
  meta: number;
  realizado: number;
  metaCobertura: number;
  realizadoCobertura: number;
  participacao?: number;
  crescimento?: number;
  equipes?: AnalyticsTreeNode[];
  vendedores?: Array<{
    nome: string;
    codVendedor?: string;
    meta: number;
    realizado: number;
    metaCobertura: number;
    realizadoCobertura: number;
    participacao?: number;
    crescimento?: number;
  }>;
}

export interface HistoryRow {
  ano: number;
  mesNum: number;
  fabricante: string | null;
  equipe: string | null;
  vendedor: string | null;
  codVendedor: string | null;
  meta: number;
  realizado: number;
  metaClientes: number;
  positivados: number;
  margemPct: number;
}

export interface SaleRow {
  id: string;
  data: string | null;
  cliente: string | null;
  vendedor: string | null;
  equipe: string | null;
  valor: number;
  status: string;
}

export interface ProductRow {
  codigo: string;
  nome: string | null;
  fabricante: string | null;
  categoria: string | null;
  preco: number;
  atualizadoEm: string | null;
  status: string;
}

export interface TopCustomerRow {
  pos: number;
  codigo: string | null;
  nome: string | null;
  vendedor: string | null;
  vendedorCod: string | null;
  equipe: string | null;
  faturamento: number;
  part: number;
}

export interface NotPositivatedResponse {
  kpis: {
    baseClientes: number;
    positivados: number;
    naoPositivados: number;
    positivacaoPct: number;
  };
  clientes: Array<{
    codigo: string;
    nome: string | null;
    vendedor: string | null;
    equipe: string | null;
    supervisor: string | null;
    gerencia: string | null;
    ultimaCompra: string | null;
    dias: number;
    status: string;
  }>;
}

export interface TargetRow {
  anoMes: string;
  codVendedor: string;
  vendedor: string | null;
  equipe: string | null;
  fabricante: string | null;
  metaFaturamento: number;
  metaCobertura: number;
}

export interface SarPositivacaoRow {
  codigo: string;
  nome: string;
  equipe: string | null;
  visitasPrevistas: number;
  visitasRealizadas: number;
  vendasPrevistas: number;
  vendasRealizadas: number;
  foraDeRota: number;
  gpsOk: number;
  pedidos: number;
  apontamentos: number;
}

export interface LoginApiResponse {
  token: string;
  tokenType?: string;
  expiresIn?: number;
  user: import('../types').User;
}

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

type UnauthorizedHandler = () => void;
let onUnauthorized: UnauthorizedHandler | null = null;

/** AuthContext registra handler para limpar sessão em 401. */
export function setUnauthorizedHandler(handler: UnauthorizedHandler | null) {
  onUnauthorized = handler;
}

function qs(params?: Record<string, string | number | boolean | null | undefined>): string {
  if (!params) return '';
  const sp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null || v === '') return;
    sp.set(k, String(v));
  });
  const s = sp.toString();
  return s ? `?${s}` : '';
}

async function request<T>(path: string, options?: RequestInit & { skipAuth?: boolean }): Promise<T> {
  const { skipAuth, ...fetchOpts } = options || {};

  if (!skipAuth && isTokenExpired()) {
    clearAuthToken();
    onUnauthorized?.();
    throw new ApiError('Sessão expirada. Faça login novamente.', 401);
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(IMPORT_API_KEY ? { 'x-api-key': IMPORT_API_KEY } : {}),
    ...(!skipAuth ? authHeader() : {}),
    ...((fetchOpts.headers as Record<string, string>) || {}),
  };

  const res = await fetch(`/api${path}`, {
    ...fetchOpts,
    headers,
  });

  if (!res.ok) {
    let message = `Erro ${res.status} ao chamar ${path}`;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
      else if (body?.detail) message = typeof body.detail === 'string' ? body.detail : message;
    } catch {
      // ignore
    }

    if (res.status === 401 && !skipAuth) {
      clearAuthToken();
      onUnauthorized?.();
    }

    throw new ApiError(message, res.status);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export async function apiLogin(
  email: string,
  password: string,
  rememberMe = true
): Promise<LoginApiResponse> {
  const body = await request<LoginApiResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password, rememberMe }),
    skipAuth: true,
  });

  if (!body?.token) {
    throw new ApiError('Login não retornou token.', 500);
  }

  storeAuthToken(body.token, body.expiresIn, rememberMe);
  return body;
}

export function apiMe(): Promise<import('../types').User> {
  return request<import('../types').User>('/auth/me');
}

export function apiLogout(): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>('/auth/logout', { method: 'POST' }).catch(() => ({ ok: true }));
}

export function apiListUsers(): Promise<import('../types').User[]> {
  return request<import('../types').User[]>('/users');
}

export interface UserCreatePayload {
  name: string;
  email: string;
  password: string;
  role: string;
  phone?: string | null;
  address?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
  cep?: string | null;
  sellerCode?: string | null;
  team?: string | null;
  supervisor?: string | null;
  status?: 'Ativo' | 'Inativo';
}

export function apiCreateUser(payload: UserCreatePayload): Promise<import('../types').User> {
  return request<import('../types').User>('/users', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function apiUpdateUser(id: string, payload: Partial<UserCreatePayload>): Promise<import('../types').User> {
  return request<import('../types').User>(`/users/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export function fetchDashboard(params?: {
  ano?: number;
  mes?: number;
  start?: string;
  end?: string;
}): Promise<DashboardResponse> {
  return request<DashboardResponse>(`/dashboard${qs(params)}`);
}

export function fetchAnalyticsTree(params?: {
  ano?: number;
  mes?: number;
  start?: string;
  end?: string;
}): Promise<AnalyticsTreeNode[]> {
  return request<AnalyticsTreeNode[]>(`/analytics/tree${qs(params)}`);
}

export function fetchHistory(params?: {
  fabricante?: string;
  equipe?: string;
  vendedor?: string;
}): Promise<HistoryRow[]> {
  return request<HistoryRow[]>(`/analytics/history${qs(params)}`);
}

export function fetchSales(params?: {
  q?: string;
  fabricante?: string;
  start?: string;
  end?: string;
  limit?: number;
}): Promise<SaleRow[]> {
  return request<SaleRow[]>(`/analytics/sales${qs(params)}`);
}

export function fetchProducts(params?: {
  q?: string;
  fabricante?: string;
  categoria?: string;
}): Promise<ProductRow[]> {
  return request<ProductRow[]>(`/catalog/products${qs(params)}`);
}

export function fetchCustomers(params?: { q?: string; status?: string }): Promise<Record<string, unknown>[]> {
  return request(`/catalog/customers${qs(params)}`);
}

export function fetchSellers(): Promise<Record<string, unknown>[]> {
  return request('/catalog/sellers');
}

export function fetchTeams(): Promise<Record<string, unknown>[]> {
  return request('/catalog/teams');
}

export function fetchManufacturers(): Promise<Record<string, unknown>[]> {
  return request('/catalog/manufacturers');
}

export function fetchTargets(params?: { ano_mes?: string }): Promise<TargetRow[]> {
  return request<TargetRow[]>(`/commercial/targets${qs(params)}`);
}

export function fetchTopCustomers(params?: {
  start?: string;
  end?: string;
  limit?: number;
}): Promise<TopCustomerRow[]> {
  return request<TopCustomerRow[]>(`/commercial/top-customers${qs(params)}`);
}

export function fetchNotPositivated(params?: {
  start?: string;
  end?: string;
}): Promise<NotPositivatedResponse> {
  return request<NotPositivatedResponse>(`/commercial/not-positivated${qs(params)}`);
}

export function fetchSarPositivacao(params?: {
  ano?: number;
  mes?: number;
}): Promise<SarPositivacaoRow[]> {
  return request<SarPositivacaoRow[]>(`/sar/positivacao${qs(params)}`);
}

export interface SubmitImportParams {
  tipo: string;
  dataReferencia: string;
  arquivo?: string;
  usuarioNome?: string;
  usuarioEmail?: string;
  mapping: Record<string, string>;
  rows: Record<string, unknown>[];
}

export function submitImport(params: SubmitImportParams): Promise<ImportResultSummary> {
  return request<ImportResultSummary>('/imports', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export function fetchImportHistory(limit = 50): Promise<ImportLogEntry[]> {
  return request<ImportLogEntry[]>(`/imports?limit=${limit}`);
}

export { request, getStoredToken, clearAuthToken, storeAuthToken };
