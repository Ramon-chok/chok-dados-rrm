// Motor generico de UPSERT em lote (espelho de backend/app/upsert.py).
//
// Regra de importacao: NENHUMA linha valida da planilha e descartada por
// duplicidade de chave antes da gravacao.
import type { PoolClient } from 'pg';
import { ImportTypeConfig } from './importTypes.js';
import { parseBoolean, parseDateOnly, parseInteger, parseNumeric, parseText } from './parse.js';

export interface RowError {
  linha: number;
  motivo: string;
}

export interface MappedRow {
  linha: number;
  values: Record<string, unknown>;
}

const CHUNK_SIZE = 500;

export function mapAndValidateRows(
  cfg: ImportTypeConfig,
  mapping: Record<string, string>,
  rawRows: Record<string, unknown>[],
  rowOffset = 0
): { valid: MappedRow[]; errors: RowError[] } {
  const valid: MappedRow[] = [];
  const errors: RowError[] = [];
  const mappedHeaders = new Set(Object.values(mapping).filter(Boolean));

  rawRows.forEach((raw, idx) => {
    // rowOffset permite lotes fatiados reportarem o nº real da linha no arquivo.
    const linha = rowOffset + idx + 1;
    const values: Record<string, unknown> = {};
    let rowError: string | null = null;

    for (const col of cfg.columns) {
      if (col.kind === 'jsonb' && col.name === cfg.dynamicJsonColumn) {
        const jsonValue: Record<string, unknown> = {};
        for (const [header, cellValue] of Object.entries(raw)) {
          if (mappedHeaders.has(header)) continue;
          if (cellValue === undefined || cellValue === null || cellValue === '') continue;
          const asNumber = parseNumeric(cellValue);
          jsonValue[header] = asNumber.ok && asNumber.value !== null ? asNumber.value : cellValue;
        }
        values[col.name] = jsonValue;
        continue;
      }

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
        rowError = `coluna de chave "${col.name}" esta vazia`;
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
  dataReferencia: string;
  mesReferencia: number;
  anoReferencia: number;
}

export interface UpsertOutcome {
  novos: number;
  atualizados: number;
}

function insertColumns(cfg: ImportTypeConfig): string[] {
  const tracksImport = cfg.tracksImport ?? true;
  const valueColumns = cfg.columns.map((c) => c.name);
  const extraColumns: string[] = [];
  if (cfg.snapshot) extraColumns.push('data_referencia', 'mes_referencia', 'ano_referencia');
  if (tracksImport) extraColumns.push('data_importacao', 'importacao_id');
  return [...valueColumns, ...extraColumns];
}

function rowParams(
  cfg: ImportTypeConfig,
  row: MappedRow,
  importacaoId: number,
  dataImportacao: Date,
  snapshot: SnapshotContext | null
): unknown[] {
  const tracksImport = cfg.tracksImport ?? true;
  const valueColumns = cfg.columns.map((c) => c.name);
  const params: unknown[] = valueColumns.map((c) => {
    const val = row.values[c] ?? null;
    const colCfg = cfg.columns.find((cc) => cc.name === c);
    return colCfg?.kind === 'jsonb' ? JSON.stringify(val ?? {}) : val;
  });
  if (cfg.snapshot && snapshot) {
    params.push(snapshot.dataReferencia, snapshot.mesReferencia, snapshot.anoReferencia);
  }
  if (tracksImport) {
    params.push(dataImportacao, importacaoId);
  }
  return params;
}

async function bulkInsertAll(
  client: PoolClient,
  cfg: ImportTypeConfig,
  rows: MappedRow[],
  importacaoId: number,
  dataImportacao: Date,
  snapshot: SnapshotContext | null
): Promise<UpsertOutcome> {
  const cols = insertColumns(cfg);
  let novos = 0;

  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    const chunk = rows.slice(i, i + CHUNK_SIZE);
    const params: unknown[] = [];
    const tuples: string[] = [];

    for (const row of chunk) {
      const rp = rowParams(cfg, row, importacaoId, dataImportacao, snapshot);
      const placeholders = rp.map((_, j) => `$${params.length + j + 1}`);
      tuples.push(`(${placeholders.join(', ')})`);
      params.push(...rp);
    }

    const sql = `INSERT INTO ${cfg.table} (${cols.join(', ')}) VALUES ${tuples.join(', ')}`;
    await client.query(sql, params);
    novos += chunk.length;
  }

  return { novos, atualizados: 0 };
}

async function replaceSnapshotRows(
  client: PoolClient,
  cfg: ImportTypeConfig,
  rows: MappedRow[],
  importacaoId: number,
  dataImportacao: Date,
  snapshot: SnapshotContext,
  clearBefore = true
): Promise<UpsertOutcome> {
  if (clearBefore) {
    await client.query(`DELETE FROM ${cfg.table} WHERE data_referencia = $1`, [snapshot.dataReferencia]);
  }
  return bulkInsertAll(client, cfg, rows, importacaoId, dataImportacao, snapshot);
}

async function replaceAllRows(
  client: PoolClient,
  cfg: ImportTypeConfig,
  rows: MappedRow[],
  importacaoId: number,
  dataImportacao: Date,
  snapshot: SnapshotContext | null,
  clearBefore = true
): Promise<UpsertOutcome> {
  if (clearBefore) {
    await client.query(`DELETE FROM ${cfg.table}`);
  }
  return bulkInsertAll(client, cfg, rows, importacaoId, dataImportacao, snapshot);
}

export async function upsertRows(
  client: PoolClient,
  cfg: ImportTypeConfig,
  rows: MappedRow[],
  importacaoId: number,
  dataImportacao: Date,
  snapshot: SnapshotContext | null,
  options?: { clearBefore?: boolean }
): Promise<UpsertOutcome> {
  if (rows.length === 0) return { novos: 0, atualizados: 0 };
  const clearBefore = options?.clearBefore ?? true;

  if (cfg.replaceAllRows) {
    return replaceAllRows(client, cfg, rows, importacaoId, dataImportacao, snapshot, clearBefore);
  }

  if (cfg.replaceSnapshotRows) {
    if (!snapshot) throw new Error('replaceSnapshotRows requer snapshot');
    return replaceSnapshotRows(client, cfg, rows, importacaoId, dataImportacao, snapshot, clearBefore);
  }

  const tracksImport = cfg.tracksImport ?? true;
  const cols = insertColumns(cfg);
  const updateParts = cols
    .filter((c) => !cfg.keyColumns.includes(c))
    .map((c) => `${c} = EXCLUDED.${c}`);
  if (!tracksImport) {
    updateParts.push('atualizado_em = now()');
  }
  const updateSet = updateParts.length > 0 ? updateParts.join(', ') : null;

  let novos = 0;
  let atualizados = 0;

  for (const row of rows) {
    const rp = rowParams(cfg, row, importacaoId, dataImportacao, snapshot);
    const placeholders = rp.map((_, j) => `$${j + 1}`).join(', ');
    const sql = updateSet
      ? `
          INSERT INTO ${cfg.table} (${cols.join(', ')})
          VALUES (${placeholders})
          ON CONFLICT (${cfg.keyColumns.join(', ')})
          DO UPDATE SET ${updateSet}
          RETURNING (xmax = 0) AS inserted
        `
      : `
          INSERT INTO ${cfg.table} (${cols.join(', ')})
          VALUES (${placeholders})
          ON CONFLICT (${cfg.keyColumns.join(', ')})
          DO NOTHING
          RETURNING (xmax = 0) AS inserted
        `;
    const result = await client.query(sql, rp);
    const rec = result.rows[0] as { inserted: boolean } | undefined;
    if (!rec) atualizados += 1;
    else if (rec.inserted) novos += 1;
    else atualizados += 1;
  }

  return { novos, atualizados };
}