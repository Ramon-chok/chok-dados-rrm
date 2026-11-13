/**
 * Os 10 perfis da plataforma.
 *
 * Esta lista substituiu os tipos de usuário anteriores. O papel genérico
 * `GERENTE` saiu: quem estava nele é remapeado para `GERENTE_COMERCIAL` pela
 * migration `backend/sql/perfis.sql`.
 *
 * Espelho de `ROLE_PERMISSIONS` em `backend/app/security.py` — a matriz que
 * vale é a do servidor; esta aqui decide apenas o que o menu mostra.
 */
export type Role =
  | 'SUPERADMIN'
  | 'ADMIN'
  | 'GERENTE_COMERCIAL'
  | 'GERENTE_VENDAS'
  | 'COMPRADOR'
  | 'SUPERVISOR'
  | 'ANALISTA'
  | 'FORNECEDOR'
  | 'VENDEDOR'
  | 'SAR';

/** Alçada administrativa plena: SUPERADMIN acompanha o ADMIN em tudo. */
export const ROLES_ADMIN: Role[] = ['SUPERADMIN', 'ADMIN'];

/** Único lugar que decide "é administrador?" — evita comparar com 'ADMIN' solto. */
export const isAdminRole = (role?: Role | null): boolean =>
  !!role && ROLES_ADMIN.includes(role);

/** Papéis com visão consolidada de todas as equipes (não travam equipe/vendedor). */
export const ROLES_VISAO_GERAL: Role[] = [...ROLES_ADMIN, 'GERENTE_COMERCIAL', 'GERENTE_VENDAS'];

/** Papéis que podem abrir Comparativos & Simulações (Seção 9 — exclusivo). */
export const ROLES_COMPARATIVOS: Role[] = [...ROLES_VISAO_GERAL];

/** Papéis que podem filtrar livremente por equipe (os demais já vêm recortados). */
export const podeFiltrarEquipe = (role?: Role | null): boolean =>
  !!role && ROLES_VISAO_GERAL.includes(role);

/** Papéis que podem escolher o vendedor (gestão + supervisão da própria equipe). */
export const podeFiltrarVendedor = (role?: Role | null): boolean =>
  !!role && (ROLES_VISAO_GERAL.includes(role) || role === 'SUPERVISOR');

/**
 * Como cada perfil ALTERA dados. É uma dimensão independente do que ele VÊ:
 * um perfil pode ter acesso total de leitura e não poder mudar nada.
 *
 *   'livre'        altera direto                        (Super Administrador)
 *   'confirmacao'  altera, confirmando cada alteração    (Administrador)
 *   'liberacao'    altera só com liberação do admin      (Comprador, Analista, SAR)
 *   'leitura'      não altera nada                       (os demais)
 *
 * Espelho de MODO_ESCRITA em backend/app/security.py. A trava é lá: aqui o
 * modo serve para a tela não oferecer um botão que o servidor vai recusar.
 */
export type ModoEscrita = 'livre' | 'confirmacao' | 'liberacao' | 'leitura';

export const MODO_ESCRITA: Record<Role, ModoEscrita> = {
  SUPERADMIN: 'livre',
  ADMIN: 'confirmacao',
  GERENTE_COMERCIAL: 'leitura',
  GERENTE_VENDAS: 'leitura',
  COMPRADOR: 'liberacao',
  SUPERVISOR: 'leitura',
  ANALISTA: 'liberacao',
  FORNECEDOR: 'leitura',
  VENDEDOR: 'leitura',
  SAR: 'liberacao',
};

export const modoEscritaDoPapel = (role?: Role | null): ModoEscrita =>
  role ? MODO_ESCRITA[role] ?? 'leitura' : 'leitura';

/** Papéis que nunca alteram nada — a tela mostra os dados em modo consulta. */
export const ehSomenteLeitura = (role?: Role | null): boolean =>
  modoEscritaDoPapel(role) === 'leitura';

/** Estado de escrita do usuário logado, vindo de `/api/acessos/meu-estado`. */
export interface EstadoEscrita {
  modo: ModoEscrita;
  /** true quando o usuário pode alterar AGORA (já conta a liberação ativa). */
  podeAlterar: boolean;
  exigeConfirmacao: boolean;
  /** Quando a liberação temporária termina (ISO), se houver uma ativa. */
  liberacaoExpiraEm: string | null;
  liberacaoConcedidaPor: string | null;
  papel?: Role;
}

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
  | 'search.global'
  /** Exportar rankings e tabelas da Visual Fabricantes. */
  | 'manufacturers.export'
  /** Manutenção da própria plataforma (exclusivo do SUPERADMIN). */
  | 'platform.manage';

export interface DataScope {
  level: 'VENDEDOR' | 'SUPERVISOR' | 'GERENTE' | 'FORNECEDOR' | 'EMPRESA';
  description: string;
  sellerCode?: string;
  team?: string;
  supervisor?: string;
  manager?: string;
  /** Fabricante representado — só o perfil FORNECEDOR usa. */
  manufacturer?: string;
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
  /**
   * Fabricante vinculado ao cadastro. Define o escopo do perfil FORNECEDOR:
   * sem ele, nenhum dado comercial é liberado a esse perfil.
   */
  manufacturer?: string;
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
  /**
   * Texto e ícone SOBRE a cor principal.
   *
   * No claro é branco; no escuro é quase preto, porque lá a cor principal é
   * um azul clareado (#809CC6) e texto branco sobre ele não alcança 4,5:1.
   * Usar '#fff' fixo em botão primário quebra o contraste no tema escuro.
   */
  primaryForeground: string;
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
  /** Gradiente de cabeçalho/realce (azul Arantes → turquesa). */
  gradientFrom: string;
  gradientTo: string;
  /** Sombra padrão dos cards. */
  shadow: string;
  // ── Tokens da identidade do Grupo Arantes ───────────────────
  /**
   * Degradê oficial da marca, na íntegra. O azul domina: ele ocupa os
   * primeiros 30% e a turquesa só aparece no fim. Uso restrito a marca,
   * login, ícone de app e faixa do topo — nunca em fundo de card ou seção.
   */
  gradient: string;
  /** Azul institucional (#2A4C7F, Pantone 307C). */
  brandAzul: string;
  /**
   * Turquesa institucional (#44ABAA, Pantone 638C). Decorativa no tema
   * claro: sobre branco dá 2,7:1, abaixo do mínimo para texto. Para texto
   * e botão use `accentTeal`, que é a versão legível.
   */
  brandTurquesa: string;
  /** Fundo neutro de aplicação da marca (#E8E8E6). */
  brandFundo: string;
  /**
   * Azul de informação ("a fazer", "em andamento"). É céu e vivo, separado
   * de propósito do azul-marinho da marca: cor de status nunca pode ser
   * confundida com cor institucional.
   */
  info: string;
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
  | 'top-customers'
  | 'sortiments'
  | 'catalog'
  | 'objectives'
  | 'commercial-calendar'
  | 'comparisons'
  | 'purchasing'
  // Fabricantes
  | 'manufacturer-visual'
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
  | 'import-history'
  | 'write-grants';
