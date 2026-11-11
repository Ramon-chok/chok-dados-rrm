/**
 * Camada de API do módulo de Compras (Seção 3 — perfil Comprador).
 * Reaproveita o `request` de `api.ts`: mesmo cookie, 401, cache e timeout.
 */
import { request } from './api';

export interface Fornecedor {
  id: number;
  nome: string;
  cnpj: string | null;
  fabricante: string | null;
  contato: string | null;
  email: string | null;
  telefone: string | null;
  condicaoPagamento: string | null;
  observacoes: string | null;
  status: 'Ativo' | 'Inativo';
}

export type NegociacaoStatus = 'aberta' | 'fechada' | 'cancelada';

export interface Negociacao {
  id: number;
  fornecedorId: number | null;
  fornecedor: string | null;
  fabricante: string | null;
  categoria: string | null;
  descricao: string | null;
  dataNegociacao: string | null;
  valorCompra: number;
  desconto: number;
  bonificacao: number;
  investimento: number;
  /** Valor de compra menos desconto e bonificação. */
  custoLiquido: number;
  status: NegociacaoStatus;
}

export interface NegociacoesResponse {
  resumo: {
    total: number;
    fechadas: number;
    valorCompra: number;
    desconto: number;
    bonificacao: number;
    investimento: number;
    custoLiquido: number;
    pctDesconto: number;
  };
  negociacoes: Negociacao[];
}

function qs(params: object): string {
  const sp = new URLSearchParams();
  Object.entries(params as Record<string, unknown>).forEach(([k, v]) => {
    if (v === undefined || v === null || v === '') return;
    sp.set(k, String(v));
  });
  const s = sp.toString();
  return s ? `?${s}` : '';
}

export function fetchFornecedores(params: { q?: string; status?: string } = {}): Promise<Fornecedor[]> {
  return request<Fornecedor[]>(`/purchasing/suppliers${qs(params)}`);
}

export function salvarFornecedor(payload: Partial<Fornecedor>, id?: number): Promise<Fornecedor> {
  return request<Fornecedor>(id ? `/purchasing/suppliers/${id}` : '/purchasing/suppliers', {
    method: id ? 'PATCH' : 'POST',
    body: JSON.stringify(payload),
  });
}

export function removerFornecedor(id: number): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>(`/purchasing/suppliers/${id}`, { method: 'DELETE' });
}

export function fetchNegociacoes(
  params: { start?: string; end?: string; fornecedor_id?: number; status?: string } = {}
): Promise<NegociacoesResponse> {
  return request<NegociacoesResponse>(`/purchasing/negotiations${qs(params)}`);
}

export function salvarNegociacao(payload: Partial<Negociacao>, id?: number): Promise<{ ok: boolean; id: number }> {
  return request<{ ok: boolean; id: number }>(
    id ? `/purchasing/negotiations/${id}` : '/purchasing/negotiations',
    { method: id ? 'PATCH' : 'POST', body: JSON.stringify(payload) }
  );
}

export function removerNegociacao(id: number): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>(`/purchasing/negotiations/${id}`, { method: 'DELETE' });
}
