// Motor genérico de UPSERT em lote (regra 13 do PRD: INSERT se não existir,
// UPDATE se já existir, nunca duplicar). Funciona para qualquer tipo
// configurado em importTypes.ts — nenhum código novo é necessário para
// adicionar um novo indicador no futuro (regra 29).
import type { PoolClient } from 'pg';
import { ImportTypeConfig } from './importTypes.js';
import { parseBoolean, parseDateOnly, parseInteger, parseNumeric, parseText } from './parse.js';

export interface RowError {
  linha: number; // 1-based, relativo aos dados enviados (sem contar cabeçalho)
  motivo: string;
}

export interface MappedRow {
  linha: number;
  values: Record<string, unknown>;
}

const CHUNK_SIZE = 500;

/**
 * Projeta as linhas brutas (chaveadas pelos cabeçalhos originais da planilha)
 * para os nomes de coluna do sistema, usando o mapeamento definido na tela de
 * importação, valida tipos/obrigatoriedade da chave e separa o que é válido
 * do que deve ser rejeitado.
 */
export function mapAndValidateRows(
  cfg: ImportTypeConfig,
  mapping: Record<string, string>,
  rawRows: Record<string, unknown>[]
): { valid: MappedRow[]; errors: RowError[] } {
  const valid: MappedRow[] = [];
  const errors: RowError[] = [];

  rawRows.forEach((raw, idx) => {
    const linha = idx + 1;
    const values: Record<string, unknown> = {};
    let rowError: string | null = null;

    for (const col of cfg.columns) {
      const sourceHeader = mapping[col.name];
      const rawValue = sourceHeader ? raw[sourceHeader] : undefined;

      let parsed;
      switch (col.kind) {
        case 'numeric':
          parsed = parseNumeric(rawValue);
          break;
        case 'integer':
          parsed = parseInteger(rawValue);
          break;
        case 'date':
          parsed = parseDateOnly(rawValue);
          break;
        case 'boolean':
          parsed = parseBoolean(rawValue);
          break;
        default:
          parsed = parseText(rawValue);
      }

      if (!parsed.ok) {
        rowError = `coluna "${col.name}": ${parsed.error}`;
        break;
      }

      const isKeyColumn = cfg.keyColumns.includes(col.name);
      if (isKeyColumn && (parsed.value === null || parsed.value === '')) {
        rowError = `coluna de chave "${col.name}" está vazia`;
        break;
      }

      values[col.name] = parsed.value;
    }

    if (rowError) {
      errors.push({ linha, motivo: rowError });
    } else {
      valid.push({ linha, values });
    }
  });

  return { valid, errors };
}

export interface SnapshotContext {
  dataReferencia: string; // 'YYYY-MM-DD'
  mesReferencia: number;
  anoReferencia: number;
}

export interface UpsertOutcome {
  novos: number;
  atualizados: number;
}

/**
 * Mantém só a última ocorrência de cada chave. Uma mesma chave repetida
 * dentro do MESMO comando INSERT ... ON CONFLICT faz o Postgres estourar
 * "ON CONFLICT DO UPDATE command cannot affect row a second time" —
 * planilhas reais frequentemente têm linhas duplicadas (reenvio, correção
 * manual etc.), então a última linha da planilha é a versão vigente.
 */
function dedupeByKey(rows: MappedRow[], keyColumns: string[]): MappedRow[] {
  const deduped = new Map<string, MappedRow>();
  for (const row of rows) {
    const key = JSON.stringify(keyColumns.map((k) => row.values[k] ?? null));
    deduped.set(key, row);
  }
  return [...deduped.values()];
}

/**
 * Executa o upsert em lotes dentro de uma transação já aberta pelo chamador.
 * Usa `RETURNING (xmax = 0)` (truque padrão do Postgres) para contar, por
 * linha, se foi INSERT (novo) ou UPDATE (atualizado).
 */
export async function upsertRows(
  client: PoolClient,
  cfg: ImportTypeConfig,
  rows: MappedRow[],
  importacaoId: number,
  dataImportacao: Date,
  snapshot: SnapshotContext | null
): Promise<UpsertOutcome> {
  if (rows.length === 0) return { novos: 0, atualizados: 0 };

  rows = dedupeByKey(rows, cfg.keyColumns);

  const tracksImport = cfg.tracksImport ?? true;
  const valueColumns = cfg.columns.map((c) => c.name);
  const extraColumns: string[] = [];
  if (cfg.snapshot) extraColumns.push('data_referencia', 'mes_referencia', 'ano_referencia');
  if (tracksImport) extraColumns.push('data_importacao', 'importacao_id');
  const insertColumns = [...valueColumns, ...extraColumns];

  const updateParts = insertColumns
    .filter((c) => !cfg.keyColumns.includes(c))
    .map((c) => `${c} = EXCLUDED.${c}`);
  if (!tracksImport) {
    // Tabelas de cadastro não recebem data_importacao/importacao_id (não têm
    // essas colunas) — em vez disso, tocam atualizado_em no UPDATE. No
    // INSERT, o DEFAULT now() da coluna já cobre a linha nova.
    updateParts.push('atualizado_em = now()');
  }
  const updateSet = updateParts.join(', ');

  let novos = 0;
  let atualizados = 0;

  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    const chunk = rows.slice(i, i + CHUNK_SIZE);
    const params: unknown[] = [];
    const tuples: string[] = [];

    for (const row of chunk) {
      const rowParams: unknown[] = valueColumns.map((c) => row.values[c] ?? null);
      if (cfg.snapshot && snapshot) {
        rowParams.push(snapshot.dataReferencia, snapshot.mesReferencia, snapshot.anoReferencia);
      }
      if (tracksImport) {
        rowParams.push(dataImportacao, importacaoId);
      }

      const placeholders = rowParams.map((_, j) => `$${params.length + j + 1}`);
      tuples.push(`(${placeholders.join(', ')})`);
      params.push(...rowParams);
    }

    const sql = `
      INSERT INTO ${cfg.table} (${insertColumns.join(', ')})
      VALUES ${tuples.join(', ')}
      ON CONFLICT (${cfg.keyColumns.join(', ')})
      DO UPDATE SET ${updateSet}
      RETURNING (xmax = 0) AS inserted
    `;

    const result = await client.query(sql, params);
    for (const r of result.rows as { inserted: boolean }[]) {
      if (r.inserted) novos += 1;
      else atualizados += 1;
    }
  }

  return { novos, atualizados };
}
