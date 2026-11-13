import { authHeader, clearAuthToken } from './authToken';

// Cliente HTTP único do frontend — só fala com o backend (/api/*).
// Todas as páginas autenticadas enviam Authorization: Bearer <JWT>.

// A chave de importação NÃO pode vir para o frontend (variáveis VITE_* vão para o bundle e
// ficam públicas). A tela de Importação autentica pelo cookie HttpOnly do ADMIN logado.

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
  chunkIndex?: number | null;
  totalChunks?: number | null;
  done?: boolean;
}

/** Tamanho de cada lote enviado ao backend (linhas). */
export const IMPORT_CHUNK_SIZE = 800;

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

export interface FabricanteVendedorRow {
  codVendedor: string;
  nome: string;
  meta: number;
  realizado: number;
  pctR: number;
  metaCobertura: number;
  realizadoCobertura: number;
  pctCob: number;
}

export interface DashboardFilterOptions {
  gerencias: string[];
  equipes: string[];
  vendedores: Array<{ codVendedor: string; nome: string; equipe: string | null }>;
}

export interface Top20ClienteRow {
  dataReferencia: string;
  nivel: string | null;
  gerencia: string | null;
  equipe: string | null;
  codVendedor: string;
  nomeVendedor: string | null;
  pasta: string | null;
  codCliente: string;
  clienteRedes: string | null;
  trimestre25: number;
  trimestre26: number;
  pctCrescTrimestre: number;
  mes25: number;
  mes26: number;
  pctCrescMes: number;
}

export interface FabricanteDetalheResponse {
  fabricante: string;
  equipes: Array<{
    equipe: string;
    meta: number;
    realizado: number;
    pctR: number;
    metaCobertura: number;
    realizadoCobertura: number;
    pctCob: number;
    vendedores: FabricanteVendedorRow[];
  }>;
}

export interface ClienteFabricantesResponse {
  vendedoresConsiderados: string[];
  fabricantes: Array<{
    fabricante: string;
    meta: number;
    realizado: number;
    pctR: number;
    metaCobertura: number;
    realizadoCobertura: number;
    pctCob: number;
    vendedores: FabricanteVendedorRow[];
  }>;
}

/** Meta x realizado de um objetivo (faseamento, desconcentração, desafio). */
export interface ObjetivoClienteBloco {
  meta: number;
  realizado: number;
  pct: number;
}

/**
 * Ficha do cliente (GET /analytics/cliente-detalhe).
 *
 * `fabricantes` traz valor REAL por fabricante (matriz cliente x fabricante
 * da planilha de Não Positivados). Categoria e produto não existem por
 * cliente em nenhuma base — ver `fetchClienteFabricanteItens`.
 */
export interface ClienteDetalheResponse {
  cliente: {
    codigo: string | null;
    nome: string;
    municipio: string | null;
    codVendedor: string | null;
    vendedor: string | null;
    equipe: string | null;
    gerencia: string | null;
    eRede: boolean;
    pontos: number;
  };
  venda: {
    realizado: number;
    mesAnterior: number;
    mesAtual: number;
    pctCrescMes: number;
    trimestreAnterior: number;
    trimestreAtual: number;
    pctCrescTrimestre: number;
    temComparativo: boolean;
  };
  carteira: {
    total: number;
    clientes: number;
    participacao: number;
    posicao: number;
  };
  meta: {
    metaTotal: number;
    realizadoVendedor: number;
    pctAtingimento: number;
    /** Quanto da meta total do vendedor este cliente sozinho cobre (%). */
    contribuicaoNaMeta: number;
    gap: number;
    objetivos: {
      faseamento: ObjetivoClienteBloco;
      faseamentoII: ObjetivoClienteBloco;
      desconcentracao: ObjetivoClienteBloco;
      desafio: ObjetivoClienteBloco;
    };
  };
  fabricantes: Array<{ fabricante: string; valor: number; part: number }>;
  fonteFabricante: string | null;
  avisos: string[];
}

export interface ClienteFabricanteItensResponse {
  fabricante: string;
  categorias: Array<{
    categoria: string;
    skus: number;
    produtos: Array<{ codigo: string; produto: string; linha: string; precoTabela: number }>;
  }>;
  totalSkus: number;
  /** Sempre false hoje: a base não guarda venda por item. */
  temValorPorItem: boolean;
  fonte: string;
}

/** Quantos meses a janela de análise soma. */
export type JanelaCrescimento = 'mes' | 'trimestre' | 'semestre';
/** Com o que a janela é comparada. */
export type BaseCrescimento = 'anterior' | 'ano_anterior';

export interface ClienteCrescimentoRow {
  codigo: string;
  nome: string | null;
  vendedor: string | null;
  codVendedor: string | null;
  equipe: string | null;
  municipio: string | null;
  atual: number;
  anterior: number;
  diferenca: number;
  /** null quando não havia base de comparação (cliente novo na janela). */
  variacao: number | null;
  movimento: 'cresceu' | 'caiu' | 'entrou' | 'estavel';
}

export interface ClientesCrescimentoResponse {
  janela: JanelaCrescimento;
  base: BaseCrescimento;
  /** Competências somadas, em MM/AAAA. */
  periodoAtual: string[];
  periodoBase: string[];
  crescimento: ClienteCrescimentoRow[];
  queda: ClienteCrescimentoRow[];
  resumo: {
    clientes: number;
    cresceram: number;
    cairam: number;
    estaveis: number;
    ganho?: number;
    perda?: number;
  };
}

/**
 * Origem dos valores REALIZADOS devolvidos pelos quadros:
 *  - "api"   → vieram da API externa (ERP/BI) configurada no backend;
 *  - "banco" → ainda saem das tabelas locais (API externa não configurada).
 * As METAS são sempre as importadas pelo ADMIN em "Dados e Exportações".
 */
export type FonteRealizado = 'api' | 'banco';

/** Uma linha do Quadro de Vendas: um vendedor, meta x realizado no período. */
export interface SalesBoardRow {
  codVendedor: string;
  vendedor: string | null;
  equipe: string | null;
  gerencia: string | null;
  meta: number;
  realizado: number;
  gap: number;
  atingimento: number;
  metaCobertura: number;
  realizadoCobertura: number;
  pctCobertura: number;
  positivados: number;
  margem: number;
}

export interface SalesBoardResponse {
  fonteRealizado: FonteRealizado;
  kpis: {
    meta: number;
    realizado: number;
    gap: number;
    atingimento: number;
    vendedores: number;
    metaCobertura: number;
    realizadoCobertura: number;
  };
  rows: SalesBoardRow[];
}

/** Uma linha de Categorias: uma categoria/fabricante, meta x realizado. */
export interface CategoryBoardRow {
  categoria: string;
  meta: number;
  realizado: number;
  gap: number;
  atingimento: number;
  metaCobertura: number;
  realizadoCobertura: number;
  pctCobertura: number;
  participacao: number;
  margem: number;
}

export interface CategoryBoardResponse {
  fonteRealizado: FonteRealizado;
  kpis: {
    meta: number;
    realizado: number;
    gap: number;
    atingimento: number;
    categorias: number;
  };
  rows: CategoryBoardRow[];
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

export interface SortimentoRow {
  id?: number;
  codigo: string;
  produto: string | null;
  fabricante: string | null;
  categoria: string | null;
  linha: string | null;
  atualizadoEm: string | null;
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

export type NaoPositivadoNivel = 'vendedor' | 'equipe' | 'total';

export interface NaoPositivadoRow {
  codCliente: string;
  razaoSocial: string | null;
  nomeFantasia: string | null;
  municipio: string | null;
  // Uma chave por fabricante — exatamente como veio da planilha (cada
  // fabricante era uma coluna própria no arquivo original).
  fabricantes: Record<string, number | string>;
  codVendedor?: string;
  vendedor?: string | null;
  equipe?: string | null;
}

export interface NaoPositivadosImportResponse {
  nivel: NaoPositivadoNivel;
  categorias: string[];
  rows: NaoPositivadoRow[];
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

/**
 * Uma linha por vendedor vinda de GET /sar/raiox — já agregada no servidor
 * (SOMA para contagens, MÉDIA para percentuais) quando `mode` é "periodo";
 * valores exatos do dia quando `mode` é "dia" (ver backend/app/routers/catalog.py).
 */
export interface RaioXRow {
  codVendedor: string;
  vendedor: string;
  equipe: string | null;
  /** Quantos dias de dados entraram na agregação desta linha (1 em modo "dia"). */
  diasComDados: number;
  visitasPrevistas: number;
  visitasRealizadas: number;
  visitasForaRota: number;
  percGps: number;
  /** Texto livre da planilha (ex.: "Setor vago"); null se vazio. */
  apontamentosInconsistencia: string | null;
  positivaPrevista: number;
  pedidos: number;
  percPositivacao: number;
  foraRotaPositivacao: number;
  percForaRota: number;
  produtividade: number;
  /** "HH:MM:SS" — só fazem sentido olhar em modo "dia" (ver comentário no componente). */
  horaInicio: string | null;
  horaCheckIn: string | null;
  horaCheckOut: string | null;
  horaFim: string | null;
  tempoCampo: string | null;
  acumuladoPrevista: number;
  acumuladoRealizadas: number;
  acumuladoPorcentagem: number;
  acumuladoForaRota: number;
  percForaRotaAcumulado: number;
  acumuladoPositivacaoVisitas: number;
  acumuladoPositivacaoPedidos: number;
  percPositivacaoAcumulado: number;
  acumuladoPositivacaoForaRota: number;
  percPositivacaoForaRota: number;
}

export interface RaioXResponse {
  mode: 'dia' | 'periodo';
  ano: number;
  mes: number | null;
  dia: string | null;
  /** Anos com dados na tabela raiox (para popular o filtro de Ano). */
  anosDisponiveis: number[];
  rows: RaioXRow[];
}

export interface LoginApiResponse {
  token: string;
  tokenType?: string;
  expiresIn?: number;
  user: import('../types').User;
}

/** Resposta de /auth/login quando 2FA está ativo. */
export interface LoginRequires2FAResponse {
  requires2FA: true;
  tempToken: string;
  method?: 'authenticator' | 'email' | string;
}

export type LoginResult = LoginApiResponse | LoginRequires2FAResponse;

export function isLoginRequires2FA(body: LoginResult): body is LoginRequires2FAResponse {
  return !!(body as LoginRequires2FAResponse)?.requires2FA;
}

export type TwoFAMethodApi = 'authenticator' | 'email';

export interface TwoFAStatusResponse {
  enabled: boolean;
  method?: TwoFAMethodApi | null;
  phone?: string | null;
  email?: string | null;
  requireNextLogin?: boolean;
  activatedAt?: string | null;
}

export interface TwoFAInitResponse {
  ok: boolean;
  method?: TwoFAMethodApi | string;
  secret?: string;
  provisioningUri?: string;
  qrCodeDataUrl?: string;
  delivery?: string;
  delivered?: boolean;
  expiresIn?: number;
  devCode?: string;
}

export interface TwoFAVerifyResponse {
  ok: boolean;
  enabled?: boolean;
  method?: string;
  backupCodes?: string[];
  requireNextLogin?: boolean;
  activatedAt?: string;
}

/**
 * Códigos que o portão de escrita devolve.
 *
 * Eles existem para a tela saber QUAL caminho oferecer, em vez de mostrar um
 * erro seco: abrir o diálogo de confirmação, explicar que falta liberação do
 * administrador, ou dizer que o perfil é de visualização.
 */
export type CodigoErro =
  | 'sem_permissao'
  | 'somente_leitura'
  | 'confirmacao_necessaria'
  | 'liberacao_necessaria';

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public ref?: string,
    /** Presente quando o servidor classificou o erro (ver `CodigoErro`). */
    public codigo?: CodigoErro
  ) {
    super(message);
  }
}

/**
 * Confirmação de alteração.
 *
 * O perfil ADMIN altera dados mediante confirmação: o servidor recusa a
 * escrita com 428 enquanto o cabeçalho de confirmação não vier. Em vez de
 * espalhar essa regra por cada tela que salva algo, a camada de rede resolve
 * sozinha — ela chama o confirmador registrado aqui (um diálogo) e, se a
 * pessoa confirmar, repete a MESMA requisição com o cabeçalho.
 *
 * Quem decide continua sendo o servidor: sem o cabeçalho ele não grava, e o
 * cabeçalho não é credencial — quem o envia já está autenticado e já tem a
 * permissão. O que ele evita é a alteração disparada sem intenção.
 */
export type Confirmador = (contexto: { metodo: string; caminho: string }) => Promise<boolean>;

let confirmador: Confirmador | null = null;

export function setConfirmador(fn: Confirmador | null): void {
  confirmador = fn;
}

/** Cabeçalho combinado com o backend (CABECALHO_CONFIRMACAO em security.py). */
const CABECALHO_CONFIRMACAO = 'x-confirmar-alteracao';

/** Mensagens exibidas quando o servidor não manda um texto próprio para o usuário. */
const STATUS_MESSAGES: Record<number, string> = {
  400: 'Não foi possível processar a solicitação. Revise os dados e tente novamente.',
  401: 'Sua sessão expirou. Faça login novamente.',
  403: 'Você não tem permissão para esta operação.',
  404: 'O recurso solicitado não foi encontrado.',
  408: 'O servidor demorou para responder. Tente novamente.',
  409: 'Os dados foram alterados por outra operação. Atualize a página e tente novamente.',
  413: 'O conteúdo enviado é maior que o permitido.',
  429: 'Muitas requisições em pouco tempo. Aguarde um instante e tente novamente.',
};
const SERVER_ERROR_MESSAGE = 'Não foi possível concluir a operação. Tente novamente em instantes.';
const UNAVAILABLE_MESSAGE = 'Serviço temporariamente indisponível. Tente novamente em instantes.';
const NETWORK_ERROR_MESSAGE = 'Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.';
/** Texto de erro vindo do servidor maior que isso é tratado como técnico e descartado. */
const MAX_SERVER_MESSAGE_LENGTH = 300;

/** Anexa o código de referência (quando houver) para o usuário informar ao suporte. */
function withRef(message: string, ref?: string): string {
  return ref ? `${message} (código: ${ref})` : message;
}

/**
 * Converte a resposta de erro em uma mensagem segura para exibir.
 * - 5xx: sempre texto genérico (o backend já não envia detalhe; aqui é defesa extra,
 *   ex.: proxy/gateway que devolve HTML ou stack).
 * - 4xx: usa o `error` do backend (texto escrito para o usuário) se for uma string curta.
 */
function messageForStatus(status: number, body: unknown): { message: string; ref?: string } {
  const b = (body && typeof body === 'object' ? body : {}) as { error?: unknown; ref?: unknown };
  const ref = typeof b.ref === 'string' && /^[A-Z0-9]{4,16}$/.test(b.ref) ? b.ref : undefined;
  if (status >= 500) {
    // O backend só manda texto próprio em 5xx quando ele foi escrito para o usuário (e com ref).
    const own = ref && typeof b.error === 'string' && b.error.length <= MAX_SERVER_MESSAGE_LENGTH ? b.error : null;
    const fallback = status === 503 || status === 502 || status === 504 ? UNAVAILABLE_MESSAGE : SERVER_ERROR_MESSAGE;
    return { message: withRef(own || fallback, ref), ref };
  }
  const own = typeof b.error === 'string' && b.error.trim() && b.error.length <= MAX_SERVER_MESSAGE_LENGTH ? b.error.trim() : null;
  return { message: own || STATUS_MESSAGES[status] || STATUS_MESSAGES[400], ref };
}

/**
 * Mensagem segura para mostrar na tela a partir de qualquer erro capturado.
 * Só `ApiError` carrega texto destinado ao usuário; qualquer outro erro (bug de
 * código, TypeError, etc.) vira o texto de fallback — nunca `err.message` cru.
 */
export function getErrorMessage(err: unknown, fallback = SERVER_ERROR_MESSAGE): string {
  if (err instanceof ApiError) return err.message;
  return fallback;
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

/** Timeout padrão das APIs de leitura/auth (ms). */
export const DEFAULT_API_TIMEOUT_MS = 45_000;
/** Timeout maior para lotes de importação (ms) — planilhas pesadas. */
export const IMPORT_API_TIMEOUT_MS = 120_000;

async function requestRaw<T>(
  path: string,
  options?: RequestInit & { skipAuth?: boolean; timeoutMs?: number }
): Promise<T> {
  const { skipAuth, timeoutMs = DEFAULT_API_TIMEOUT_MS, ...fetchOpts } = options || {};

  // Rely on backend for session expiration (cookie HttpOnly). Do not check local expiration in client.

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(!skipAuth ? authHeader() : {}),
    ...((fetchOpts.headers as Record<string, string>) || {}),
  };

  const controller = new AbortController();
  const externalSignal = fetchOpts.signal;
  const onExternalAbort = () => controller.abort((externalSignal as AbortSignal | undefined)?.reason);
  if (externalSignal) {
    if (externalSignal.aborted) controller.abort(externalSignal.reason);
    else externalSignal.addEventListener('abort', onExternalAbort, { once: true });
  }

  const timer =
    timeoutMs > 0
      ? setTimeout(() => {
          controller.abort(new DOMException('timeout', 'TimeoutError'));
        }, timeoutMs)
      : null;

  try {
    const res = await fetch(`/api${path}`, {
      ...fetchOpts,
      headers,
      signal: controller.signal,
      // enviar cookies (inclui o cookie HttpOnly setado pelo backend)
      credentials: 'include',
    });

    if (!res.ok) {
      let body: unknown = null;
      try {
        body = await res.json();
      } catch {
        // corpo não-JSON (ex.: página de erro do proxy) — usa a mensagem padrão do status
      }
      const { message, ref } = messageForStatus(res.status, body);
      const bodyObj = (body && typeof body === 'object' ? body : {}) as { codigo?: unknown };
      const codigo =
        typeof bodyObj.codigo === 'string' ? (bodyObj.codigo as CodigoErro) : undefined;

      if (res.status === 401 && !skipAuth) {
        clearAuthToken();
        clearApiCache();
        onUnauthorized?.();
      }

      throw new ApiError(message, res.status, ref, codigo);
    }

    if (res.status === 204) return undefined as T;
    try {
      return (await res.json()) as T;
    } catch {
      throw new ApiError(SERVER_ERROR_MESSAGE, 502);
    }
  } catch (err) {
    if (err instanceof ApiError) throw err;
    if (err instanceof DOMException && (err.name === 'AbortError' || err.name === 'TimeoutError')) {
      const timedOut = err.name === 'TimeoutError' || /timeout/i.test(err.message);
      throw new ApiError(
        timedOut
          ? `O servidor demorou mais de ${Math.round(timeoutMs / 1000)}s para responder. Tente novamente ou envie em partes menores.`
          : 'A requisição foi cancelada.',
        timedOut ? 408 : 499
      );
    }
    // fetch() rejeita com TypeError em falha de rede/CORS: nunca repassa o texto do navegador.
    throw new ApiError(NETWORK_ERROR_MESSAGE, 0);
  } finally {
    if (timer) clearTimeout(timer);
    if (externalSignal) externalSignal.removeEventListener('abort', onExternalAbort);
  }
}

/**
 * Cache de leitura no navegador (só memória — dados de negócio nunca vão para localStorage):
 *  - GETs de dados ficam frescos por CACHE_TTL_MS, então navegar entre telas não refaz a consulta;
 *  - requisições idênticas em andamento são unificadas (1 chamada, N consumidores);
 *  - qualquer escrita (POST/PATCH/DELETE), logout ou 401 limpa tudo, então nada fica velho após importar.
 */
const CACHE_TTL_MS = 60_000;
const CACHE_MAX_ENTRIES = 200;
const NO_CACHE_PREFIXES = ['/auth', '/users', '/2fa', '/twofa', '/imports'];
const responseCache = new Map<string, { at: number; data: unknown }>();
const inflight = new Map<string, Promise<unknown>>();
let cacheEpoch = 0;

/** Descarta o cache de leituras (chamar em logout, troca de usuário ou após importação). */
export function clearApiCache(): void {
  cacheEpoch++;
  responseCache.clear();
  inflight.clear();
}

function isCacheableGet(path: string, options?: RequestInit): boolean {
  const method = (options?.method || 'GET').toUpperCase();
  if (method !== 'GET' || options?.signal) return false;
  return !NO_CACHE_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`) || path.startsWith(`${p}?`));
}

async function request<T>(
  path: string,
  options?: RequestInit & { skipAuth?: boolean; timeoutMs?: number; noCache?: boolean }
): Promise<T> {
  const { noCache, ...rest } = options || {};
  const method = (rest.method || 'GET').toUpperCase();

  if (method !== 'GET') {
    try {
      try {
        return await requestRaw<T>(path, rest);
      } catch (err) {
        // 428 = o servidor exige confirmação desta alteração (perfil ADMIN).
        // Pergunta uma vez e repete a mesma requisição confirmada. Se a
        // pessoa recusar, o erro original sobe para a tela, sem gravar nada.
        const precisaConfirmar =
          err instanceof ApiError && err.codigo === 'confirmacao_necessaria' && !!confirmador;
        if (!precisaConfirmar) throw err;

        const confirmado = await confirmador!({ metodo: method, caminho: path });
        if (!confirmado) throw err;

        return await requestRaw<T>(path, {
          ...rest,
          headers: {
            ...((rest.headers as Record<string, string>) || {}),
            [CABECALHO_CONFIRMACAO]: '1',
          },
        });
      }
    } finally {
      clearApiCache();
    }
  }
  if (noCache || !isCacheableGet(path, rest)) return requestRaw<T>(path, rest);

  const hit = responseCache.get(path);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return structuredClone(hit.data) as T;

  let pending = inflight.get(path) as Promise<T> | undefined;
  if (!pending) {
    const epoch = cacheEpoch;
    pending = requestRaw<T>(path, rest)
      .then((data) => {
        if (epoch === cacheEpoch) {
          responseCache.set(path, { at: Date.now(), data });
          while (responseCache.size > CACHE_MAX_ENTRIES) {
            const oldest = responseCache.keys().next().value;
            if (oldest === undefined) break;
            responseCache.delete(oldest);
          }
        }
        return data;
      })
      .finally(() => {
        if (epoch === cacheEpoch) inflight.delete(path);
      });
    inflight.set(path, pending);
  }
  return structuredClone(await pending) as T;
}

export async function apiLogin(
  email: string,
  password: string,
  rememberMe = true
): Promise<LoginResult> {
  const body = await request<LoginResult>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password, rememberMe }),
    skipAuth: true,
  });

  if (isLoginRequires2FA(body)) {
    if (!body.tempToken) {
      throw new ApiError(SERVER_ERROR_MESSAGE, 500);
    }
    return body;
  }

  if (!(body as LoginApiResponse)?.token) {
    throw new ApiError(SERVER_ERROR_MESSAGE, 500);
  }

  // backend sets HttpOnly cookie; do not persist token in localStorage.
  return body as LoginApiResponse;
}

export async function apiLogin2FA(tempToken: string, code: string): Promise<LoginApiResponse> {
  const body = await request<LoginApiResponse>('/auth/2fa-login', {
    method: 'POST',
    body: JSON.stringify({ tempToken, code }),
    skipAuth: true,
  });
  if (!body?.token) {
    throw new ApiError(SERVER_ERROR_MESSAGE, 500);
  }
  return body;
}

export function apiTwoFAStatus(): Promise<TwoFAStatusResponse> {
  return request<TwoFAStatusResponse>('/2fa/status');
}

export function apiTwoFAInit(payload: {
  method: TwoFAMethodApi;
  email?: string;
}): Promise<TwoFAInitResponse> {
  return request<TwoFAInitResponse>('/2fa/init', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/** 2FA por e-mail já ativo: envia um código para confirmar ações sensíveis (ex.: desativar). */
export function apiTwoFASendCode(): Promise<{ ok: boolean; delivered: boolean; expiresIn: number }> {
  return request('/2fa/send-code', { method: 'POST', body: JSON.stringify({}) });
}

export function apiTwoFAResend(): Promise<TwoFAInitResponse> {
  return request<TwoFAInitResponse>('/2fa/resend', {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export function apiTwoFAVerify(payload: {
  code: string;
  requireNextLogin?: boolean;
}): Promise<TwoFAVerifyResponse> {
  return request<TwoFAVerifyResponse>('/2fa/verify', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function apiTwoFADisable(code?: string): Promise<{ ok: boolean; enabled: boolean }> {
  return request<{ ok: boolean; enabled: boolean }>('/2fa/disable', {
    method: 'POST',
    body: JSON.stringify(code ? { code } : {}),
  });
}

export function apiMe(): Promise<import('../types').User> {
  return request<import('../types').User>('/auth/me');
}

export interface SessionInfoResponse {
  /** ISO — quando o login foi feito (iat do token). */
  startedAt: string;
  /** ISO — quando a sessão expira (exp do token); o backend recusa o token depois disso. */
  expiresAt: string;
  /** ISO — relógio do servidor, para corrigir diferença de horário do navegador. */
  serverTime: string;
  rememberMe: boolean;
  /** Janela de inatividade aplicada pelo servidor (segundos). */
  idleLimitSeconds?: number;
  /** Quanto falta para a desconexão automática por inatividade (segundos). */
  idleRemainingSeconds?: number | null;
}

export function apiSession(): Promise<SessionInfoResponse> {
  return request<SessionInfoResponse>('/auth/session');
}

/** Motivo do fim da sessão, gravado no histórico (`sessoes_log`). */
export type LogoutReason = 'logout' | 'inatividade' | 'expiracao';

export function apiLogout(motivo: LogoutReason = 'logout'): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>(`/auth/logout${qs({ motivo })}`, { method: 'POST' }).catch(() => ({ ok: true }));
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
  /**
   * Número do endereço coletado na tela de Usuários. ATENÇÃO: o backend ainda
   * não tem esse campo (backend/app/schemas.py) e o descarta silenciosamente —
   * o valor não é persistido enquanto a coluna não for criada lá.
   */
  number?: string | null;
  sellerCode?: string | null;
  team?: string | null;
  supervisor?: string | null;
  /**
   * Fabricante representado. Só o perfil FORNECEDOR usa: é o vínculo que
   * define o escopo dele (coluna `usuarios.fabricante`).
   */
  manufacturer?: string | null;
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

export function apiDeleteUser(id: string): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>(`/users/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

export function apiSetUserStatus(id: string, status: 'Ativo' | 'Inativo'): Promise<import('../types').User> {
  return apiUpdateUser(id, { status });
}

export function fetchDashboard(params?: {
  ano?: number;
  mes?: number;
  start?: string;
  end?: string;
  equipe?: string;
  vendedor?: string;
}): Promise<DashboardResponse> {
  return request<DashboardResponse>(`/dashboard${qs(params)}`);
}

export function fetchDashboardFilterOptions(): Promise<DashboardFilterOptions> {
  return request<DashboardFilterOptions>('/analytics/filter-options');
}

export function fetchFabricanteDetalhe(params: {
  fabricante: string;
  ano?: number;
  mes?: number;
  start?: string;
  end?: string;
  equipe?: string;
  vendedor?: string;
}): Promise<FabricanteDetalheResponse> {
  return request<FabricanteDetalheResponse>(`/analytics/fabricante-detalhe${qs(params)}`);
}

export function fetchClienteFabricantes(params: {
  codigo?: string | null;
  nome?: string;
  ano?: number;
  mes?: number;
  start?: string;
  end?: string;
  equipe?: string;
  vendedor?: string;
}): Promise<ClienteFabricantesResponse> {
  return request<ClienteFabricantesResponse>(`/analytics/cliente-fabricantes${qs(params)}`);
}

/**
 * Ficha do cliente — abre ao clicar em um cliente no Dashboard, no TOP
 * Clientes ou nos Não Positivados.
 *
 * `codigo` identifica um ponto de venda; `nome` identifica uma rede (vários
 * códigos sob o mesmo nome comercial) e soma todos eles. O período é o mesmo
 * já escolhido na tela — a ficha nunca inventa um recorte próprio.
 */
export function fetchClienteDetalhe(params: {
  codigo?: string | null;
  nome?: string;
  ano?: number;
  mes?: number;
  start?: string;
  end?: string;
  equipe?: string;
  vendedor?: string;
}): Promise<ClienteDetalheResponse> {
  return request<ClienteDetalheResponse>(`/analytics/cliente-detalhe${qs(params)}`);
}

/**
 * Categorias e produtos de um fabricante, abertos dentro da ficha do cliente.
 *
 * Vem da Lista de Sortimento: é o PORTFÓLIO do fabricante, não a compra
 * daquele cliente item a item — nenhuma base importada registra a venda no
 * nível de produto (a venda é gravada no total do pedido). A resposta declara
 * isso em `temValorPorItem: false` e a tela avisa o usuário.
 */
export function fetchClienteFabricanteItens(params: {
  fabricante: string;
}): Promise<ClienteFabricanteItensResponse> {
  return request<ClienteFabricanteItensResponse>(`/analytics/cliente-fabricante-itens${qs(params)}`);
}

/**
 * Carteira em crescimento x em queda entre duas janelas de tempo.
 *
 * `janela` é quanto se soma (1, 3 ou 6 meses terminando no período escolhido)
 * e `base` é com o que se compara (a janela imediatamente anterior ou a mesma
 * janela há 12 meses).
 */
export function fetchClientesCrescimento(params?: {
  ano?: number;
  mes?: number;
  janela?: JanelaCrescimento;
  base?: BaseCrescimento;
  equipe?: string;
  vendedor?: string;
  limit?: number;
}): Promise<ClientesCrescimentoResponse> {
  return request<ClientesCrescimentoResponse>(`/commercial/clientes-crescimento${qs(params)}`);
}

export interface BoardQueryParams {
  ano?: number;
  mes?: number;
  start?: string;
  end?: string;
  equipe?: string;
  vendedor?: string;
}

/**
 * Quadro de Vendas — meta (importada) x realizado por vendedor.
 * O backend decide a origem do realizado (API externa ou banco) e informa
 * qual foi em `fonteRealizado`; o contrato desta função não muda quando a
 * API externa entrar no ar.
 */
export function fetchSalesBoard(params?: BoardQueryParams): Promise<SalesBoardResponse> {
  return request<SalesBoardResponse>(`/board/sales${qs(params as Record<string, string | number | undefined>)}`);
}

/** Categorias — meta (importada) x realizado por categoria/fabricante. */
export function fetchCategoryBoard(params?: BoardQueryParams): Promise<CategoryBoardResponse> {
  return request<CategoryBoardResponse>(`/board/categories${qs(params as Record<string, string | number | undefined>)}`);
}

export function fetchProducts(params?: {
  q?: string;
  fabricante?: string;
  categoria?: string;
}): Promise<ProductRow[]> {
  return request<ProductRow[]>(`/catalog/products${qs(params)}`);
}

export function fetchSortimento(params?: {
  q?: string;
  fabricante?: string;
  categoria?: string;
  linha?: string;
}): Promise<SortimentoRow[]> {
  return request<SortimentoRow[]>(`/catalog/sortimento${qs(params)}`);
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

export interface ObjetivoBloco {
  meta: number;
  realizado: number;
  pct: number;
}

export interface ObjetivosFaseamentoResponse {
  faseamento: ObjetivoBloco;
  faseamentoII: ObjetivoBloco;
  desconcentracao: ObjetivoBloco;
  desafio: ObjetivoBloco;
}

export function fetchObjetivosFaseamento(params?: {
  ano?: number;
  mes?: number;
  start?: string;
  end?: string;
  equipe?: string;
  vendedor?: string;
}): Promise<ObjetivosFaseamentoResponse> {
  return request<ObjetivosFaseamentoResponse>(`/commercial/objetivos-faseamento${qs(params)}`);
}

export function fetchTop20Customers(params?: {
  ano?: number;
  mes?: number;
  start?: string;
  end?: string;
  gerencia?: string;
  equipe?: string;
  vendedor?: string;
}): Promise<Top20ClienteRow[]> {
  return request<Top20ClienteRow[]>(`/commercial/top-20-customers${qs(params)}`);
}

export function fetchTopCustomers(params?: {
  start?: string;
  end?: string;
  limit?: number;
}): Promise<TopCustomerRow[]> {
  return request<TopCustomerRow[]>(`/commercial/top-customers${qs(params)}`);
}

export function fetchNaoPositivadosImport(params?: {
  ano?: number;
  mes?: number;
  start?: string;
  end?: string;
  nivel?: NaoPositivadoNivel;
  equipe?: string;
  vendedor?: string;
}): Promise<NaoPositivadosImportResponse> {
  return request<NaoPositivadosImportResponse>(`/commercial/nao-positivados-import${qs(params)}`);
}

export function fetchNotPositivated(params?: {
  start?: string;
  end?: string;
}): Promise<NotPositivatedResponse> {
  return request<NotPositivatedResponse>(`/commercial/not-positivated${qs(params)}`);
}

/**
 * Dados da importação Raio-X (tabela `raiox`) para a tela sar/RaioX.tsx.
 * `dia` (YYYY-MM-DD) tem prioridade sobre `mes`/`ano` — quando informado, os
 * demais são ignorados no servidor e a resposta vem com mode: "dia" (valores
 * exatos daquele dia, sem agregação). Sem `dia`, agrega por `ano` (+ `mes`
 * opcional) e a resposta vem com mode: "periodo".
 */
export function fetchRaioX(params?: { ano?: number; mes?: number; dia?: string }): Promise<RaioXResponse> {
  return request<RaioXResponse>(`/sar/raiox${qs(params)}`);
}

export interface SubmitImportParams {
  tipo: string;
  dataReferencia: string;
  arquivo?: string;
  usuarioNome?: string;
  usuarioEmail?: string;
  mapping: Record<string, string>;
  rows: Record<string, unknown>[];
  chunkIndex?: number;
  totalChunks?: number;
  importId?: number;
  rowOffset?: number;
  useMacro?: boolean;
}

export interface SubmitImportChunkedProgress {
  sheetLabel?: string;
  chunkIndex: number;
  totalChunks: number;
  rowsInChunk: number;
  rowsDone: number;
  rowsTotal: number;
  percent: number;
}

export interface SubmitImportChunkedOptions {
  /** Tamanho do lote (default IMPORT_CHUNK_SIZE). */
  chunkSize?: number;
  /** Callback de progresso entre lotes. */
  onProgress?: (p: SubmitImportChunkedProgress) => void;
  /** Rótulo da aba (só para UI de progresso). */
  sheetLabel?: string;
  signal?: AbortSignal;
}

/**
 * Envia a planilha fatiada em lotes sequenciais.
 * O 1º lote cria o importId; os demais reutilizam e NÃO reexecutam o DELETE
 * de replace_* no backend (clear_before só no chunk 0).
 */
export async function submitImportChunked(
  params: SubmitImportParams,
  options?: SubmitImportChunkedOptions
): Promise<ImportResultSummary> {
  const chunkSize = Math.max(50, options?.chunkSize ?? IMPORT_CHUNK_SIZE);
  const allRows = params.rows || [];
  const totalRows = allRows.length;
  if (totalRows === 0) {
    throw new ApiError('Nenhuma linha para importar.', 400);
  }

  const totalChunks = Math.ceil(totalRows / chunkSize);
  let importId: number | undefined;
  let novos = 0;
  let atualizados = 0;
  let rejeitados = 0;
  let totalAnalisados = 0;
  const erros: ImportRowError[] = [];
  let last: ImportResultSummary | null = null;

  for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
    if (options?.signal?.aborted) {
      throw new ApiError('Importação cancelada pelo usuário.', 499);
    }

    const start = chunkIndex * chunkSize;
    const end = Math.min(start + chunkSize, totalRows);
    const chunkRows = allRows.slice(start, end);

    options?.onProgress?.({
      sheetLabel: options.sheetLabel,
      chunkIndex,
      totalChunks,
      rowsInChunk: chunkRows.length,
      rowsDone: start,
      rowsTotal: totalRows,
      // Mostra progresso “em andamento” do lote atual (metade do lote).
      percent: Math.min(99, Math.round(((start + chunkRows.length * 0.35) / totalRows) * 100)),
    });

    const result = await request<ImportResultSummary>('/imports', {
      method: 'POST',
      timeoutMs: IMPORT_API_TIMEOUT_MS,
      signal: options?.signal,
      body: JSON.stringify({
        tipo: params.tipo,
        dataReferencia: params.dataReferencia,
        arquivo: params.arquivo,
        usuarioNome: params.usuarioNome,
        usuarioEmail: params.usuarioEmail,
        useMacro: params.useMacro,
        mapping: params.mapping,
        rows: chunkRows,
        chunkIndex,
        totalChunks,
        importId,
        rowOffset: start,
      } satisfies SubmitImportParams),
    });

    importId = result.importId;
    novos += result.novos;
    atualizados += result.atualizados;
    rejeitados += result.rejeitados;
    totalAnalisados += result.totalAnalisados;
    erros.push(...(result.erros || []));
    last = result;

    options?.onProgress?.({
      sheetLabel: options.sheetLabel,
      chunkIndex,
      totalChunks,
      rowsInChunk: chunkRows.length,
      rowsDone: end,
      rowsTotal: totalRows,
      percent: Math.round((end / totalRows) * 100),
    });
  }

  const status: ImportResultSummary['status'] =
    rejeitados === 0 ? 'CONCLUIDO' : totalAnalisados - rejeitados > 0 ? 'CONCLUIDO_COM_AVISOS' : 'FALHA';

  return {
    importId: importId ?? last!.importId,
    tipo: last!.tipo,
    tipoLabel: last!.tipoLabel,
    arquivo: last!.arquivo,
    dataReferencia: last!.dataReferencia,
    totalAnalisados,
    novos,
    atualizados,
    rejeitados,
    status,
    erros,
    chunkIndex: totalChunks - 1,
    totalChunks,
    done: true,
  };
}

export function submitImport(params: SubmitImportParams): Promise<ImportResultSummary> {
  // Compat: um único POST (ainda respeita timeout de importação).
  return request<ImportResultSummary>('/imports', {
    method: 'POST',
    timeoutMs: IMPORT_API_TIMEOUT_MS,
    body: JSON.stringify(params),
  });
}

export function fetchImportHistory(limit = 50): Promise<ImportLogEntry[]> {
  return request<ImportLogEntry[]>(`/imports?limit=${limit}`);
}

export function clearImportHistory(): Promise<{ ok: boolean; deleted: number; deletedErrors?: number }> {
  return request<{ ok: boolean; deleted: number; deletedErrors?: number }>('/imports/history', {
    method: 'DELETE',
  });
}

export { request, clearAuthToken };

/** Uma visita/ação de GET /sar/raiox/detalhe (tabela vendedor_detalhado) — sem agregação. */
export interface RaioXDetalheRow {
  /** "YYYY-MM-DD" (data da visita) */
  data: string;
  gerencia: string | null;
  supervisao: string | null;
  codigoVendedor: string;
  vendedor: string;
  codigoCliente: string | null;
  nomeCliente: string | null;
  acao: string | null;
  dentroRota: boolean;
  /** "HH:MM:SS" */
  hora: string | null;
  /** Duração "HH:MM:SS" */
  permanencia: string | null;
  venda: boolean;
  valorVenda: number;
  motivoNaoVenda: string | null;
  motivoNaoVisita: string | null;
}

export interface RaioXDetalheResponse {
  mode: 'dia' | 'periodo';
  ano: number;
  mes: number | null;
  dia: string | null;
  /** Vendedores com visitas no período (para o filtro do bloco). */
  vendedores: { codVendedor: string; vendedor: string }[];
  rows: RaioXDetalheRow[];
}

/** Vendedor Detalhado (visita a visita) para sar/RaioX.tsx. */
export function fetchRaioXDetalhe(params?: { ano?: number; mes?: number; dia?: string; codVendedor?: string }): Promise<RaioXDetalheResponse> {
  return request<RaioXDetalheResponse>(
    `/sar/raiox/detalhe${qs({ ano: params?.ano, mes: params?.mes, dia: params?.dia, cod_vendedor: params?.codVendedor })}`
  );
}

/* ------------------------------------------------------------------ *
 * Base de Roteiro (tabela `base_roteiro`) — mapa de sar/BaseRoteiro.tsx
 * ------------------------------------------------------------------ */

/** Um ponto de roteiro: o cliente em um dia/semana de visitação. */
export interface BaseRoteiroPonto {
  codCliente: string | null;
  razaoSocial: string | null;
  nomeFantasia: string | null;
  codVendedor: string | null;
  vendedor: string | null;
  equipe: string | null;
  municipio: string | null;
  bairro: string | null;
  endereco: string | null;
  /** null = cliente sem geocodificação na planilha (não vai para o mapa). */
  latitude: number | null;
  longitude: number | null;
  /** Convenção da planilha: 2=segunda ... 6=sexta. */
  dia: number | null;
  /** Combinação de semanas do mês: "1", "2", "3", "4", "1,3", "2,4", "1234". */
  semana: string | null;
  sequencia: number | null;
  frequencia: string | null;
}

export interface BaseRoteiroResponse {
  /** data_referencia do snapshot devolvido (null = nada importado ainda). */
  data: string | null;
  /** Snapshots disponíveis (importações), mais recente primeiro. */
  datasDisponiveis: string[];
  /** Total de linhas no snapshot, inclusive as sem coordenada. */
  total: number;
  semCoordenada: number;
  /** true = o snapshot passou do teto de pontos e veio cortado. */
  truncado: boolean;
  filtros: {
    vendedores: { codVendedor: string; vendedor: string; pontos: number }[];
    equipes: string[];
    municipios: string[];
    dias: number[];
    semanas: string[];
  };
  rows: BaseRoteiroPonto[];
}

/**
 * Pontos da Base de Roteiro para o mapa. Sem `data`, o servidor devolve a
 * importação mais recente visível para o usuário. Os filtros são opcionais —
 * a tela filtra no cliente para o mapa responder sem ida ao servidor; use-os
 * só para recortar bases muito grandes antes do envio.
 */
export function fetchBaseRoteiro(params?: {
  data?: string;
  equipe?: string;
  codVendedor?: string;
  municipio?: string;
  dia?: number;
  semana?: string;
}): Promise<BaseRoteiroResponse> {
  return request<BaseRoteiroResponse>(
    `/sar/base-roteiro${qs({
      data: params?.data,
      equipe: params?.equipe,
      cod_vendedor: params?.codVendedor,
      municipio: params?.municipio,
      dia: params?.dia,
      semana: params?.semana,
    })}`
  );
}

/* ------------------------------------------------------------------ *
 * Verba Indenizatória (tabela `verba_indenizatoria`)
 * ------------------------------------------------------------------ */

/** Uma linha por vendedor — já somada no servidor quando o modo é "periodo". */
export interface VerbaIndenizatoriaRow {
  codVendedor: string;
  vendedor: string;
  equipe: string | null;
  /** Quantas data_referencia entraram na soma (1 no modo "dia"). */
  periodos: number;
  kmTotal: number;
  verbaIndenizatoria: number;
  desconto: number;
  reembolso: number;
  aPagar: number;
}

export interface VerbaIndenizatoriaResponse {
  mode: 'dia' | 'periodo';
  ano: number;
  mes: number | null;
  dia: string | null;
  anosDisponiveis: number[];
  rows: VerbaIndenizatoriaRow[];
}

/**
 * Verba Indenizatória para sar/VerbaIndenizatoria.tsx. Como em fetchRaioX,
 * `dia` (YYYY-MM-DD) tem prioridade sobre `ano`/`mes`: com `dia` a resposta
 * vem com mode: "dia" (valores exatos do dia); sem ele, soma por vendedor no
 * período e vem com mode: "periodo".
 */
export function fetchVerbaIndenizatoria(params?: {
  ano?: number;
  mes?: number;
  dia?: string;
}): Promise<VerbaIndenizatoriaResponse> {
  return request<VerbaIndenizatoriaResponse>(`/sar/verba-indenizatoria${qs(params)}`);
}

/** Relato enviado pelo botão "Reportar bug" da faixa do topo. */
export interface RelatoBugPayload {
  titulo: string;
  descricao: string;
  gravidade: 'baixa' | 'media' | 'alta';
  /** Preenchidos automaticamente pela tela — ajudam a reproduzir o problema. */
  pagina?: string;
  navegador?: string;
  tela?: string;
}

export function enviarRelatoBug(payload: RelatoBugPayload): Promise<{ ok: boolean; id: number; emailEnviado: boolean }> {
  return request(`/suporte/bugs`, { method: 'POST', body: JSON.stringify(payload) });
}


/**
 * Ficha do produto (Sortimento): clientes que compraram o item.
 *
 * Fonte: API externa do ERP. `fonte` diz de onde veio — "indisponivel" quando
 * a API ainda não foi configurada, "erro" quando ela não respondeu. Cada
 * cliente traz o ÚLTIMO pedido com o produto, mesmo fora do período, marcado
 * por `noPeriodo`.
 */
export interface ProdutoClientesResponse {
  produto: {
    codigo: string;
    produto: string | null;
    fabricante: string | null;
    categoria: string | null;
    linha: string | null;
    precoTabela: number;
  };
  fonte: 'api' | 'indisponivel' | 'erro';
  mensagem: string | null;
  clientes: Array<{
    codigo: string;
    cliente: string | null;
    codVendedor: string | null;
    vendedor: string | null;
    equipe: string | null;
    dataUltimoPedido: string | null;
    numeroPedido: string | null;
    valorUltimoPedido: number;
    quantidadeUltimoPedido: number;
    valorPeriodo: number;
    noPeriodo: boolean;
  }>;
  resumo: { clientes: number; noPeriodo: number; foraPeriodo: number; valorPeriodo: number };
}

export function fetchProdutoClientes(params: {
  cod_produto: string;
  start?: string;
  end?: string;
  equipe?: string;
  vendedor?: string;
}): Promise<ProdutoClientesResponse> {
  return request<ProdutoClientesResponse>(`/catalog/produto-clientes${qs(params)}`);
}


// ─────────────────────────────────────────────────────────────────────────────
// Metas definidas na tela (Administração › Dados, Metas e Exportações)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Meta geral de um vendedor ou de uma equipe numa competência.
 * Campo `null` = não definido na tela; aí vale o valor importado da aba Mês.
 */
export interface MetaGeral {
  anoMes: string;
  nivel: 'vendedor' | 'equipe';
  /** Código do vendedor ou nome da equipe. */
  chave: string;
  nome?: string | null;
  equipe?: string | null;
  metaCobertura: number | null;
  metaSortimento: number | null;
  metaFaseamento: number | null;
  metaFaseamentoII: number | null;
  metaDesconcentracao: number | null;
  metaDesafio: number | null;
  observacao?: string | null;
  atualizadoEm?: string | null;
  criadoPor?: string | null;
}

export function fetchMetasGerais(anoMes: string): Promise<{ anoMes: string; metas: MetaGeral[]; podeGravar: boolean }> {
  return request(`/metas/gerais${qs({ ano_mes: anoMes })}`, { noCache: true });
}

export function salvarMetaGeral(meta: MetaGeral): Promise<{ ok: boolean }> {
  return request(`/metas/gerais`, { method: 'PUT', body: JSON.stringify(meta) });
}

export function removerMetaGeral(params: { ano_mes: string; nivel: 'vendedor' | 'equipe'; chave: string }): Promise<{ ok: boolean }> {
  return request(`/metas/gerais${qs(params)}`, { method: 'DELETE' });
}

/** Meta de faturamento/cobertura por vendedor × fabricante (mesma tabela da planilha). */
export interface MetaFabricantePayload {
  anoMes: string;
  codVendedor: string;
  equipe?: string | null;
  fabricante: string;
  metaFaturamento: number | null;
  metaCobertura: number | null;
}

export function salvarMetaFabricante(meta: MetaFabricantePayload): Promise<{ ok: boolean }> {
  return request(`/metas/fabricante`, { method: 'PUT', body: JSON.stringify(meta) });
}

export function removerMetaFabricante(params: { ano_mes: string; cod_vendedor: string; fabricante: string }): Promise<{ ok: boolean }> {
  return request(`/metas/fabricante${qs(params)}`, { method: 'DELETE' });
}
