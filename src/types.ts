export type Role =
  // Perfis originais do sistema (preservados)
  | 'ADMIN'
  | 'GERENTE'
  | 'SUPERVISOR'
  | 'VENDEDOR'
  // Perfis acrescentados na evolução (Seção 3 do escopo)
  | 'GERENTE_COMERCIAL'
  | 'GERENTE_VENDAS'
  | 'COMPRADOR'
  | 'ANALISTA'
  | 'SAR';

/** Papéis com visão consolidada de todas as equipes (não travam equipe/vendedor). */
export const ROLES_VISAO_GERAL: Role[] = ['ADMIN', 'GERENTE', 'GERENTE_COMERCIAL', 'GERENTE_VENDAS'];

/** Papéis que podem abrir Comparativos & Simulações (Seção 9 — exclusivo). */
export const ROLES_COMPARATIVOS: Role[] = ['ADMIN', 'GERENTE', 'GERENTE_COMERCIAL', 'GERENTE_VENDAS'];

export type Permission =
  // Quadro de Vendas e Categorias (itens avulsos no topo do menu)
  | 'sales-board.view'
  | 'categories.view'
  // Principal (Dashboard / Visão Macro)
  | 'dashboard.view'
  // Metas/definições importadas pelo ADMIN e comparadas com os dados das APIs
  | 'targets.view'
  | 'targets.create'
  | 'targets.edit'
  | 'customers.view'
  | 'customers.edit'
  | 'products.view'
  | 'users.view'
  | 'users.create'
  | 'users.edit'
  | 'users.delete'
  | 'settings.view'
  | 'settings.edit'
  | 'audit.view'
  | 'admin.full_access'
  // ── Novas permissões da evolução ────────────────────────────
  /** Ver margem/custo. Sem ela a margem é omitida pelo backend. */
  | 'margin.view'
  /** Módulo de compras: fornecedores, negociações, investimentos. */
  | 'purchasing.view'
  | 'purchasing.edit'
  /** Leitura de desempenho por fabricante/categoria (API `/insights/fabricante*`). */
  | 'manufacturers.view'
  /** Comparativos e simulações (gerentes). */
  | 'comparisons.view'
  | 'simulations.run'
  /** Calendário comercial e semanas SAR. */
  | 'calendar.view'
  | 'calendar.edit'
  /** Telas operacionais do SAR (Raio-X, roteiro, verba). */
  | 'sar.view'
  /** Pesquisa inteligente global. */
  | 'search.global';

export interface DataScope {
  level: 'VENDEDOR' | 'SUPERVISOR' | 'GERENTE' | 'EMPRESA';
  description: string;
  sellerCode?: string;
  team?: string;
  supervisor?: string;
  manager?: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  roleLabel: string;
  avatarInitials: string;
  phone?: string;
  address?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  cep?: string;
  sellerCode?: string;
  team?: string;
  supervisor?: string;
  manager?: string;
  status: 'Ativo' | 'Inativo';
  lastLoginAt?: string | null;
  scope: DataScope;
  permissions: Permission[];
}

export type ThemeMode = 'dark' | 'light';

export interface ThemeColors {
  bg: string;
  bgSecondary: string;
  surface: string;
  surfaceElevated: string;
  border: string;
  borderActive: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  primary: string;
  primaryHover: string;
  primaryDark: string;
  accentPurple: string;
  accentPurpleLight: string;
  accentBlue: string;
  accentBlueLight: string;
  complementaryRed: string;
  hover: string;
  // ── Tokens acrescentados na padronização visual (GA 360) ────
  /** Verde-água/turquesa: detalhe de destaque do padrão GA 360. */
  accentTeal: string;
  accentTealLight: string;
  /** Semânticas de status, para não repetir hex solto nas telas. */
  success: string;
  warning: string;
  danger: string;
  /** Gradiente de cabeçalho/realce (azul-marinho → turquesa). */
  gradientFrom: string;
  gradientTo: string;
  /** Sombra padrão dos cards. */
  shadow: string;
}

export type PageId =
  // Avulsos (topo do menu, sem grupo)
  | 'sales-board'
  | 'categories'
  // Principal
  | 'dashboard'
  | 'macro-view'
  | 'ai-chat'
  // Comercial
  | 'not-positivated'
  | 'top-20-customers'
  | 'top-customers'
  | 'sortiments'
  | 'catalog'
  | 'objectives'
  | 'commercial-calendar'
  | 'comparisons'
  | 'purchasing'
  // SAR
  | 'sar-raio-x'
  | 'sar-base-roteiro'
  | 'sar-verba-indenizatoria'
  // Conta
  | 'profile'
  | 'settings'
  | 'credits'
  // Administração
  | 'users'
  | 'targets'
  | 'import-history';
