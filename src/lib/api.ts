// Cliente HTTP fino para a API de importação/histórico (server/). Mantido
// separado dos componentes para que Importacao.tsx e futuras telas de
// histórico não precisem repetir cabeçalhos/tratamento de erro.

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

class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(IMPORT_API_KEY ? { 'x-api-key': IMPORT_API_KEY } : {}),
      ...(options?.headers || {}),
    },
  });

  if (!res.ok) {
    let message = `Erro ${res.status} ao chamar ${path}`;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch {
      // resposta sem corpo JSON, mantém mensagem padrão
    }
    throw new ApiError(message, res.status);
  }

  return res.json() as Promise<T>;
}

export interface SubmitImportParams {
  tipo: string;
  dataReferencia: string; // 'YYYY-MM-DD'
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

export { ApiError };
