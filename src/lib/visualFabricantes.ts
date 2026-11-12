/**
 * Camada de API da tela Visual Fabricantes.
 *
 * Espelha `backend/app/routers/visual_fabricantes.py`. Reaproveita o mesmo
 * `request` das demais telas — portanto o mesmo cookie HttpOnly, o mesmo
 * tratamento de 401, cache e timeout.
 *
 * Duas convenções que valem para todos os tipos daqui:
 *
 * * `null` significa INDISPONÍVEL, não zero. Margem sem percentual na origem,
 *   ticket sem cliente na base e atingimento sem meta cadastrada voltam nulos
 *   de propósito, e a tela mostra um traço com a explicação ao lado.
 * * `avisos` e `fontes` acompanham os números. Eles não são decoração: dizem
 *   de onde o valor veio e o que a base não sustenta.
 */
import { request } from './api';

function qs(params: object): string {
  const sp = new URLSearchParams();
  Object.entries(params as Record<string, unknown>).forEach(([k, v]) => {
    if (v === undefined || v === null || v === '') return;
    sp.set(k, String(v));
  });
  const s = sp.toString();
  return s ? `?${s}` : '';
}

/** Regra usada para somar as cargas do período (PRD RN-10). */
export type Precedencia = 'auto' | 'soma' | 'ultima_carga';

export interface PeriodoFiltro {
  inicio: string;
  fim: string;
}

// ─── Catálogo ───────────────────────────────────────────────────────────────
export interface FabricanteCatalogo {
  fabricante: string;
  coberturaDeclarada: { inicio: string | null; fim: string | null; diasComCarga: number };
  vendedores: number;
  realizadoTotal: number;
  skus: number;
  categorias: number;
  linhas: number;
  atualizadoEm: string | null;
}

export interface CatalogoResponse {
  fabricantes: FabricanteCatalogo[];
  /** true quando o perfil é travado em um fabricante (FORNECEDOR). */
  escopoTravado: boolean;
  fabricanteDoPerfil: string | null;
  /** FORNECEDOR sem fabricante vinculado: entra, mas não recebe dado comercial. */
  vinculoPendente?: boolean;
  podeVerMargem: boolean;
  podeGravarMetas: boolean;
  podeVerAcessos: boolean;
  podeExportar: boolean;
  fontes: Record<string, string>;
}

export function fetchCatalogo(): Promise<CatalogoResponse> {
  return request<CatalogoResponse>('/insights/visual/catalogo');
}

// ─── Resumo A/B ─────────────────────────────────────────────────────────────
export interface BlocoIndicadores {
  inicio: string;
  fim: string;
  dias: number;
  valor: number;
  meta: number;
  atingimento: number | null;
  faltaParaMeta: number | null;
  clientes: number;
  metaClientes: number;
  ticket: number | null;
  vendedores: number;
  equipes: number;
  fabricantes: number;
  margem: number | null;
  margemDisponivel: boolean | null;
  precedencia: string;
  datasComCarga: string[];
  semDados: boolean;
}

export interface Delta {
  anterior: number | null;
  atual: number | null;
  diferenca: number | null;
  variacao: number | null;
  /** true quando A é zero ou ausente: sem base comparável, não "crescimento". */
  semBase: boolean;
}

export interface ResumoResponse {
  fabricante: string | null;
  periodoB: BlocoIndicadores;
  periodoA: BlocoIndicadores | null;
  comparacao: Record<string, Delta>;
  coberturaDeclarada: { inicio: string | null; fim: string | null };
  podeVerMargem: boolean;
  avisos: string[];
  fontes: Record<string, string>;
}

export function fetchResumo(params: {
  fabricante?: string;
  bInicio: string;
  bFim: string;
  aInicio?: string;
  aFim?: string;
  equipe?: string;
  vendedor?: string;
  precedencia?: Precedencia;
}): Promise<ResumoResponse> {
  return request<ResumoResponse>(`/insights/visual/resumo${qs(params)}`);
}

// ─── Evolução ───────────────────────────────────────────────────────────────
export interface PontoEvolucao {
  ano: number;
  mes: number;
  meta: number;
  realizado: number;
  clientes: number;
  acumuladoMeta: number;
  acumuladoRealizado: number;
  atingimento: number | null;
}

export interface EvolucaoResponse {
  fabricante: string | null;
  inicio: string;
  fim: string;
  precedencia: string;
  serie: PontoEvolucao[];
  semDados: boolean;
  fontes: Record<string, string>;
}

export function fetchEvolucao(params: {
  fabricante?: string;
  inicio?: string;
  fim?: string;
  equipe?: string;
  vendedor?: string;
  precedencia?: Precedencia;
}): Promise<EvolucaoResponse> {
  return request<EvolucaoResponse>(`/insights/visual/evolucao${qs(params)}`);
}

// ─── Dimensões ──────────────────────────────────────────────────────────────
export type Movimento = 'entrou' | 'saiu' | 'cresceu' | 'caiu' | 'estavel';

export interface LinhaDimensao {
  chave: string;
  rotulo: string;
  valor: Delta;
  clientesB: number;
  metaB: number;
  movimento: Movimento;
}

export interface DimensoesResponse {
  fabricante: string | null;
  equipes: LinhaDimensao[];
  vendedores: LinhaDimensao[];
  categorias: Array<{ nome: string; skus: number; linhas: number }>;
  linhas: Array<{ nome: string; categoria: string; skus: number }>;
  comparouPeriodos: boolean;
  /** false para o perfil externo: equipes e vendedores não compõem a visão dele. */
  estruturaInterna?: boolean;
  avisos: string[];
  fontes: Record<string, string>;
}

export function fetchDimensoes(params: {
  fabricante?: string;
  bInicio: string;
  bFim: string;
  aInicio?: string;
  aFim?: string;
  equipe?: string;
  vendedor?: string;
  precedencia?: Precedencia;
}): Promise<DimensoesResponse> {
  return request<DimensoesResponse>(`/insights/visual/dimensoes${qs(params)}`);
}

// ─── Rankings ───────────────────────────────────────────────────────────────
export interface ItemRanking {
  chave: string;
  nome: string;
  equipe: string;
  valor: number;
  participacao: number | null;
  clientes?: number;
  meta?: number;
  rede?: boolean;
}

export interface RankingsResponse {
  fabricante: string | null;
  inicio: string;
  fim: string;
  precedencia: string;
  /** Quantos a TELA destaca. A exportação leva todos os grupos positivos. */
  destaque: number;
  vendedores: { total: number; indisponivel?: string | null; itens: ItemRanking[] };
  clientes: { total: number; indisponivel: string | null; itens: ItemRanking[] };
  observacao: string;
  fontes: Record<string, string>;
}

export function fetchRankings(params: {
  fabricante?: string;
  inicio: string;
  fim: string;
  equipe?: string;
  vendedor?: string;
  precedencia?: Precedencia;
}): Promise<RankingsResponse> {
  return request<RankingsResponse>(`/insights/visual/rankings${qs(params)}`);
}

// ─── Clientes a recuperar ───────────────────────────────────────────────────
export interface Oportunidade {
  codigo: string;
  nome: string;
  fabricante: string | null;
  vendedorEmA: string;
  equipeEmA: string;
  ultimaCompra: string | null;
  valorEmA: number;
}

export interface SemPositivacao {
  itens: Array<{
    codigo: string;
    nome: string;
    municipio: string;
    vendedor: string;
    equipe: string;
    valor: number;
  }>;
  indisponivel: string | null;
}

export interface RecuperarResponse {
  fabricante: string | null;
  oportunidades: Oportunidade[];
  indisponivel: string | null;
  semPositivacao: SemPositivacao;
  periodoA: PeriodoFiltro;
  periodoB: PeriodoFiltro;
  observacao?: string;
  fontes: Record<string, string>;
}

export function fetchRecuperar(params: {
  fabricante?: string;
  aInicio: string;
  aFim: string;
  bInicio: string;
  bFim: string;
  busca?: string;
}): Promise<RecuperarResponse> {
  return request<RecuperarResponse>(`/insights/visual/recuperar${qs(params)}`);
}

// ─── Produtos foco ──────────────────────────────────────────────────────────
export interface ProdutoFoco {
  id: number;
  fabricante: string;
  codProduto: string;
  descricao: string | null;
  categoria: string | null;
  metaClientes: number;
  clientesAtendidos: number | null;
}

export interface ProdutosFocoResponse {
  fabricante: string | null;
  itens: ProdutoFoco[];
  podeEditar: boolean;
  avisos: string[];
  fontes: Record<string, string>;
}

export function fetchProdutosFoco(fabricante?: string): Promise<ProdutosFocoResponse> {
  return request<ProdutosFocoResponse>(`/insights/visual/produtos-foco${qs({ fabricante })}`);
}

export function salvarProdutoFoco(payload: {
  fabricante: string;
  codProduto: string;
  descricao?: string;
  metaClientes: number;
}): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>('/insights/visual/produtos-foco', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function removerProdutoFoco(id: number): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>(`/insights/visual/produtos-foco/${id}`, { method: 'DELETE' });
}

// ─── Metas ──────────────────────────────────────────────────────────────────
export interface MetaFabricante {
  id: number;
  fabricante: string;
  inicio: string;
  fim: string;
  metaValor: number;
  metaCobertura: number | null;
  observacao: string | null;
  criadoPor: string | null;
  atualizadoEm: string | null;
}

export interface MetasResponse {
  fabricante: string | null;
  metas: MetaFabricante[];
  podeGravar: boolean;
  observacao: string;
}

export function fetchMetas(fabricante?: string): Promise<MetasResponse> {
  return request<MetasResponse>(`/insights/visual/metas${qs({ fabricante })}`);
}

export function gravarMeta(payload: {
  fabricante: string;
  inicio: string;
  fim: string;
  metaValor: number;
  metaCobertura?: number | null;
  observacao?: string;
}): Promise<{ ok: boolean; aviso: string | null }> {
  return request<{ ok: boolean; aviso: string | null }>('/insights/visual/metas', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function removerMeta(id: number): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>(`/insights/visual/metas/${id}`, { method: 'DELETE' });
}

// ─── Margens (exclusivo de quem tem margin.view) ────────────────────────────
export interface LinhaMargem {
  fabricante: string;
  codigo: string;
  nome: string;
  equipe: string;
  valor: number;
  margem: number | null;
  valorComMargem: number;
}

export interface MargensResponse {
  fabricante: string | null;
  inicio: string;
  fim: string;
  precedencia: string;
  pagina: number;
  porPagina: number;
  total: number;
  paginas: number;
  itens: LinhaMargem[];
  margemPonderada: number | null;
  valorComMargem: number;
  observacao: string;
  fontes: Record<string, string>;
}

export function fetchMargens(params: {
  fabricante?: string;
  inicio: string;
  fim: string;
  busca?: string;
  pagina?: number;
}): Promise<MargensResponse> {
  return request<MargensResponse>(`/insights/visual/margens${qs(params)}`);
}

// ─── Histórico de acessos ───────────────────────────────────────────────────
export interface EventoAcesso {
  id: number;
  ocorridoEm: string | null;
  fabricante: string | null;
  usuario: string | null;
  papel: string | null;
  recurso: string | null;
  sucesso: boolean;
  detalhe: string | null;
  origemChave: string | null;
}

export interface AcessosResponse {
  eventos: EventoAcesso[];
  escopoCompleto: boolean;
  observacao: string;
}

export function fetchAcessos(params: { fabricante?: string; limit?: number } = {}): Promise<AcessosResponse> {
  return request<AcessosResponse>(`/insights/visual/acessos${qs(params)}`);
}

/** Registra a consulta aberta. Falha de auditoria não interrompe a tela. */
export function registrarAcesso(payload: {
  fabricante?: string;
  recurso: string;
  detalhe?: string;
}): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>('/insights/visual/acessos', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
