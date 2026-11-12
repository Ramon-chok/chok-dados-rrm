/**
 * Liberações de alteração — o portão de escrita dos perfis de apoio.
 *
 * Comprador, Analista e SAR têm acesso total de leitura, mas só alteram dados
 * enquanto houver uma liberação ativa concedida por um administrador. Estes
 * são os endpoints que administram isso (`/api/acessos/*`).
 *
 * Espelho de `backend/app/routers/liberacoes.py`.
 */
import { request } from './api';
import { EstadoEscrita, Role } from '../types';

export interface Liberacao {
  id: number;
  usuarioId: string;
  usuario: string | null;
  papel: Role | null;
  concedidoPor: string | null;
  concedidoEm: string | null;
  expiraEm: string | null;
  motivo: string | null;
  revogadoEm: string | null;
  revogadoPor: string | null;
  /** false quando já expirou ou foi revogada. */
  ativa: boolean;
}

export interface CandidatoLiberacao {
  id: string;
  nome: string;
  email: string;
  papel: Role;
}

export interface LiberacoesResponse {
  liberacoes: Liberacao[];
  /** Só os usuários cujo perfil realmente depende de liberação. */
  candidatos: CandidatoLiberacao[];
  horasPadrao: number;
  maxHoras: number;
}

/** Como ESTE usuário altera dados agora. */
export function fetchMeuEstadoEscrita(): Promise<EstadoEscrita> {
  return request<EstadoEscrita>('/acessos/meu-estado');
}

export function fetchLiberacoes(incluirEncerradas = false): Promise<LiberacoesResponse> {
  return request<LiberacoesResponse>(
    `/acessos/liberacoes${incluirEncerradas ? '?incluir_encerradas=true' : ''}`
  );
}

export function concederLiberacao(payload: {
  usuarioId: string;
  horas: number;
  motivo?: string;
}): Promise<{ ok: boolean; usuario: string; horas: number }> {
  return request('/acessos/liberacoes', { method: 'POST', body: JSON.stringify(payload) });
}

export function revogarLiberacao(id: number): Promise<{ ok: boolean }> {
  return request(`/acessos/liberacoes/${id}`, { method: 'DELETE' });
}
