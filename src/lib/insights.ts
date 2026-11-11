/**
 * Camada de API das telas acrescentadas na evolução.
 *
 * Fica separada de `api.ts` de propósito: aquele arquivo continua intocado e
 * seguindo servindo as telas que já existiam. Aqui só entram as rotas novas
 * (`/api/insights/*`), reaproveitando o mesmo `request` — portanto o mesmo
 * cookie HttpOnly, o mesmo tratamento de 401, cache e timeout.
 */
import { request } from './api';

// ─── Seção 5 — Indicadores DIA × MÊS ────────────────────────────────────────
export interface KpiBloco {
  meta: number;
  realizado: number;
  gap: number;
  pct: number;
}

export interface KpiPeriodo {
  faturamento: KpiBloco;
  cobertura: KpiBloco;
  sortimento: KpiBloco;
  pedidos: number;
  ticketMedio: number;
  /** `null` quando o perfil não tem `margin.view` — o número nem chega ao navegador. */
  margem: number | null;
  semDados: boolean;
}

export interface KpisDiaMesResponse {
  dia: KpiPeriodo;
  mes: KpiPeriodo;
  referencia: {
    diaSelecionado: string | null;
    semanaComercial: number | null;
    diasDisponiveis: string[];
    podeVerMargem: boolean;
    /**
     * `snapshot_mensal` → as datas da base são cargas repetidas do mesmo
     * fechamento mensal, então o painel do DIA é o retrato do mês naquela data.
     * `dia_unico` → só existe uma data no período.
     * `null` → há movimento diário de verdade.
     */
    avisoCarga: 'snapshot_mensal' | 'dia_unico' | null;
  };
}

export interface PeriodoQuery {
  ano?: number;
  mes?: number;
  start?: string;
  end?: string;
  equipe?: string;
  vendedor?: string;
}

/** Monta a querystring ignorando campos vazios/não informados. */
function qs(params: object): string {
  const sp = new URLSearchParams();
  Object.entries(params as Record<string, unknown>).forEach(([k, v]) => {
    if (v === undefined || v === null || v === '') return;
    sp.set(k, String(v));
  });
  const s = sp.toString();
  return s ? `?${s}` : '';
}

export function fetchKpisDiaMes(params: PeriodoQuery & { dia?: string } = {}): Promise<KpisDiaMesResponse> {
  return request<KpisDiaMesResponse>(`/insights/kpis${qs(params)}`);
}

// ─── Seção 5 — TOP clientes ─────────────────────────────────────────────────
export interface TopClienteItem {
  nome: string;
  codigo: string | null;
  equipe: string | null;
  eRede: boolean;
  valor: number;
  participacao: number;
}

export interface TopClientesResponse {
  escopo: 'dia' | 'mes' | 'personalizado';
  dia: string | null;
  total: number;
  clientes: TopClienteItem[];
}

export function fetchTopClientesInsight(
  params: PeriodoQuery & { dia?: string; limit?: number } = {}
): Promise<TopClientesResponse> {
  return request<TopClientesResponse>(`/insights/top-clientes${qs(params)}`);
}

// ─── Seção 7 — Pesquisa inteligente ─────────────────────────────────────────
export type BuscaTipo = 'cliente' | 'produto' | 'fabricante' | 'categoria' | 'pedido';

export interface BuscaItem {
  id: string;
  titulo: string;
  detalhe: string;
  valor?: number;
  fabricante?: string | null;
}

export interface BuscaGrupo {
  tipo: BuscaTipo;
  rotulo: string;
  itens: BuscaItem[];
}

export interface BuscaResponse {
  termo: string;
  grupos: BuscaGrupo[];
}

export function fetchBusca(q: string, limit = 6): Promise<BuscaResponse> {
  return request<BuscaResponse>(`/insights/busca${qs({ q, limit })}`);
}

// ─── Seção 6 — Desempenho por fabricante / categoria ────────────────────────
//
// A TELA de "Desempenho por Fabricante" foi retirada do sistema a pedido.
// Estes tipos e fetchers continuam aqui porque os endpoints seguem ativos e
// funcionando no backend (`/api/insights/fabricantes` e `/fabricante-drill`,
// protegidos por `manufacturers.view`): se a tela voltar, ou outra precisar
// desses números, o cliente tipado já existe. Exports não usados são
// removidos pelo bundler, então não pesam no build.
export interface FabricanteResumoRow {
  fabricante: string;
  meta: number;
  realizado: number;
  pct: number;
  metaCobertura: number;
  realizadoCobertura: number;
  pctCobertura: number;
  margem: number | null;
  skus: number;
  categorias: number;
  participacao: number;
}

export interface FabricanteDrillResponse {
  fabricante: string;
  categoriaSelecionada: string | null;
  resumo: KpiBloco & {
    metaCobertura: number;
    realizadoCobertura: number;
    margem: number | null;
    skus: number;
    categorias: number;
  };
  categorias: Array<{ categoria: string; skus: number }>;
  produtos: Array<{ codProduto: string; produto: string | null; categoria: string; linha: string | null }>;
  clientes: Array<{ nome: string; codigo: string | null; valor: number }>;
  vendedores: Array<{ codVendedor: string; nome: string; equipe: string; meta: number; realizado: number }>;
  historico: Array<{ ano: number; mes: number; meta: number; realizado: number }>;
  fontes: Record<string, string>;
}

export function fetchFabricantesResumo(params: PeriodoQuery = {}): Promise<FabricanteResumoRow[]> {
  return request<FabricanteResumoRow[]>(`/insights/fabricantes${qs(params)}`);
}

export function fetchFabricanteDrill(
  params: PeriodoQuery & { fabricante: string; categoria?: string }
): Promise<FabricanteDrillResponse> {
  return request<FabricanteDrillResponse>(`/insights/fabricante-drill${qs(params)}`);
}

// ─── Seção 9 — Comparativos ─────────────────────────────────────────────────
export interface ComparativoDelta {
  atual: number | null;
  anterior: number | null;
  diferenca: number | null;
  variacao: number | null;
}

export interface ComparativoResponse {
  periodoA: { ano: number; mes: number | null };
  periodoB: { ano: number; mes: number | null };
  indicadores: Record<string, ComparativoDelta>;
  podeSimular: boolean;
  podeVerMargem: boolean;
}

export function fetchComparativo(params: {
  anoA: number;
  anoB: number;
  mesA?: number;
  mesB?: number;
  equipe?: string;
  vendedor?: string;
}): Promise<ComparativoResponse> {
  return request<ComparativoResponse>(`/insights/comparativo${qs(params)}`);
}

// ─── Seção 8 — Calendário comercial ─────────────────────────────────────────
export type EventoTipo = 'campanha' | 'oportunidade' | 'acao_fabricante' | 'reuniao' | 'outro';
export type EventoStatus = 'planejado' | 'em_andamento' | 'concluido' | 'cancelado';

export interface EventoComercial {
  id: number;
  titulo: string;
  descricao: string | null;
  tipo: EventoTipo;
  dataInicio: string;
  dataFim: string | null;
  fabricante: string | null;
  categoria: string | null;
  equipe: string | null;
  codVendedor: string | null;
  responsavel: string | null;
  potencialFaturamento: number;
  investimentoPrevisto: number;
  faturamentoRealizado: number;
  investimentoRealizado: number;
  status: EventoStatus;
  semanaComercial: number | null;
}

export interface CalendarioResponse {
  ano: number;
  mes: number;
  semanas: Array<{ inicio: string; fim: string; semanaComercial: number }>;
  podeEditar: boolean;
  eventos: EventoComercial[];
}

export type EventoPayload = Omit<EventoComercial, 'id' | 'semanaComercial'>;

export function fetchCalendario(ano: number, mes: number): Promise<CalendarioResponse> {
  return request<CalendarioResponse>(`/insights/calendario${qs({ ano, mes })}`);
}

export function criarEvento(payload: Partial<EventoPayload>): Promise<{ ok: boolean; id: number }> {
  return request<{ ok: boolean; id: number }>('/insights/calendario/eventos', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function atualizarEvento(id: number, payload: Partial<EventoPayload>): Promise<{ ok: boolean; id: number }> {
  return request<{ ok: boolean; id: number }>(`/insights/calendario/eventos/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export function removerEvento(id: number): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>(`/insights/calendario/eventos/${id}`, { method: 'DELETE' });
}

// ─── Seção 4 — Histórico de sessões ─────────────────────────────────────────
export interface SessaoLog {
  id: number;
  usuarioId: string;
  usuarioEmail: string | null;
  rememberMe: boolean;
  ip: string | null;
  userAgent: string | null;
  loginEm: string | null;
  logoutEm: string | null;
  duracaoSeg: number | null;
  motivoFim: string | null;
}

export function fetchSessoes(params: { limit?: number; usuario_id?: string } = {}): Promise<SessaoLog[]> {
  return request<SessaoLog[]>(`/insights/sessoes${qs(params)}`);
}
