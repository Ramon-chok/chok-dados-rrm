export type Role = 'ADMIN' | 'GERENTE' | 'SUPERVISOR' | 'VENDEDOR';

export type Permission =
  | 'dashboard.view'
  | 'analytics.view'
  | 'analytics.create'
  | 'studies.view'
  | 'studies.create'
  | 'targets.view'
  | 'targets.create'
  | 'targets.edit'
  | 'sales.view'
  | 'sales.edit'
  | 'customers.view'
  | 'customers.edit'
  | 'products.view'
  | 'imports.view'
  | 'imports.create'
  | 'reports.view'
  | 'reports.export'
  | 'history.view'
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
  | 'dashboard'
  | 'macro-view'
  | 'not-positivated'
  | 'top-customers'
  | 'sortiments'
  | 'catalog'
  | 'objectives'
  | 'sar-raio-x'
  | 'sar-base-roteiro'
  | 'sar-verba-indenizatoria'
  | 'analytics'
  | 'studies'
  | 'targets'
  | 'sales'
  | 'history'
  | 'insights'
  | 'reports'
  | 'imports'
  | 'profile'
  | 'settings'
  | 'credits'
  | 'users'
  | 'audit';

