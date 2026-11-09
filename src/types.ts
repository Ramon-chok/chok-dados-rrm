export type Role = 'ADMIN' | 'GERENTE' | 'SUPERVISOR' | 'VENDEDOR';

export type Permission =
  // Quadro de Vendas e Categorias (itens avulsos no topo do menu)
  | 'sales-board.view'
  | 'categories.view'
  // Principal (Dashboard / Visão Macro) — restrito a ADMIN, GERENTE e SUPERVISOR
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
  | 'admin.full_access';

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
}

export type PageId =
  // Avulsos (topo do menu, sem grupo)
  | 'sales-board'
  | 'categories'
  // Principal
  | 'dashboard'
  | 'macro-view'
  // Comercial
  | 'not-positivated'
  | 'top-20-customers'
  | 'top-customers'
  | 'sortiments'
  | 'catalog'
  | 'objectives'
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

