import { Router, Request, Response, NextFunction } from 'express';
import type { PoolClient } from 'pg';
import { pool } from '../db.js';
import { IMPORT_TYPE_CONFIGS, getImportTypeConfig } from '../importTypes.js';
import { mapAndValidateRows, upsertRows } from '../upsert.js';
import { parseDateOnly } from '../parse.js';
import { isProduction, safeEqual } from '../security.js';

export const importsRouter = Router();

// Autenticação simples por chave compartilhada. Serve tanto para a automação
// Python quanto para a tela de importação do site (mesma chave, injetada no
// frontend via VITE_IMPORT_API_KEY). Se IMPORT_API_KEY não estiver definida,
// a checagem é pulada (conveniente em desenvolvimento local) — nunca deixe
// isso acontecer em produção.
function requireApiKey(req: Request, res: Response, next: NextFunction) {
  const expected = process.env.IMPORT_API_KEY;
  // Sem chave configurada só é tolerado em desenvolvimento local; em produção
  // a rota fica FECHADA (antes ficava aberta a qualquer um).
  if (!expected) {
    if (isProduction) {
      return res.status(503).json({ error: 'IMPORT_API_KEY não configurada no servidor.' });
    }
    return next();
  }
  const provided = req.header('x-api-key') || '';
  if (!safeEqual(provided, expected)) {
    return res.status(401).json({ error: 'Chave de importação ausente ou inválida.' });
  }
  next();
}

interface ImportRequestBody {
  tipo: string;
  dataReferencia: string; // 'YYYY-MM-DD'
  arquivo?: string;
  usuarioNome?: string;
  usuarioEmail?: string;
  mapping: Record<string, string>;
  rows: Record<string, unknown>[];
  /** Índice 0-based do lote fatiado (opcional — default 0). */
  chunkIndex?: number;
  /** Total de lotes desta planilha/aba (opcional — default 1). */
  totalChunks?: number;
  /** id da importação criado no 1º lote — obrigatório a partir do 2º. */
  importId?: number;
  /** Deslocamento 0-based no arquivo original para numerar erros corretamente. */
  rowOffset?: number;
}

/** Limite duro por POST — o frontend fatia planilhas pesadas abaixo deste teto. */
const MAX_ROWS_PER_REQUEST = 2500;

importsRouter.post('/', requireApiKey, async (req: Request, res: Response) => {
  const body = req.body as ImportRequestBody;

  if (!body || typeof body !== 'object') {
    return res.status(400).json({ error: 'Corpo da requisição inválido.' });
  }

  const cfg = getImportTypeConfig(body.tipo);
  if (!cfg) {
    console.error('Unknown import tipo received:', {
      tipo: body.tipo,
      available: Object.keys(IMPORT_TYPE_CONFIGS),
    });
    return res.status(400).json({
      error: `Tipo de importação desconhecido: "${body.tipo}". Tipos válidos: ${Object.keys(IMPORT_TYPE_CONFIGS).join(', ')}.`,
    });
  }

  const dataRefParsed = parseDateOnly(body.dataReferencia);
  if (!dataRefParsed.ok || !dataRefParsed.value) {
    return res.status(400).json({ error: 'data_referencia é obrigatória e deve ser uma data válida (regra 10 do processo).' });
  }
  const dataReferencia = dataRefParsed.value;
  const [anoStr, mesStr] = dataReferencia.split('-');
  const mesReferencia = Number(mesStr);
  const anoReferencia = Number(anoStr);

  if (!Array.isArray(body.rows) || body.rows.length === 0) {
    return res.status(400).json({ error: 'Nenhuma linha para importar.' });
  }
  if (body.rows.length > MAX_ROWS_PER_REQUEST) {
    return res.status(413).json({
      error: `Lote com ${body.rows.length} linhas excede o limite de ${MAX_ROWS_PER_REQUEST} por requisição. Envie a planilha fatiada em partes.`,
    });
  }
  if (!body.mapping || typeof body.mapping !== 'object') {
    return res.status(400).json({ error: 'Mapeamento de colunas ausente.' });
  }

  const chunkIndex = body.chunkIndex ?? 0;
  const totalChunks = body.totalChunks ?? 1;
  if (chunkIndex < 0 || totalChunks < 1 || chunkIndex >= totalChunks) {
    return res.status(400).json({ error: 'Metadados de fatiamento inválidos (chunkIndex/totalChunks).' });
  }
  if (chunkIndex > 0 && (body.importId === undefined || body.importId === null)) {
    return res.status(400).json({ error: 'Lotes seguintes exigem importId retornado no primeiro lote.' });
  }

  const rowOffset = body.rowOffset ?? 0;
  const { valid, errors } = mapAndValidateRows(cfg, body.mapping, body.rows, rowOffset);
  const dataImportacao = new Date();
  const totalLinhas = body.rows.length;
  const clearBefore = chunkIndex === 0;
  const isLastChunk = chunkIndex >= totalChunks - 1;

  // client fora do try (para o catch/finally poderem checar se chegou a
  // existir) — se pool.connect() falhar (ex: banco fora do ar, credencial
  // errada), isso agora vira um 500 tratado em vez de travar a requisição
  // para sempre sem nunca enviar resposta.
  let client: PoolClient | undefined;
  try {
    client = await pool.connect();
    await client.query('BEGIN');

    let importacaoId: number;
    if (chunkIndex === 0) {
      // Reserva o id do log de auditoria antes do upsert, para que cada linha
      // gravada já saia com o importacao_id definitivo (evita um UPDATE extra
      // de correção depois).
      const seqResult = await client.query(
        `SELECT nextval(pg_get_serial_sequence('importacoes', 'id')) AS id`
      );
      importacaoId = Number(seqResult.rows[0].id);
    } else {
      importacaoId = Number(body.importId);
      const existing = await client.query(
        `SELECT id, tipo FROM importacoes WHERE id = $1`,
        [importacaoId]
      );
      if (existing.rowCount === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `importId ${importacaoId} não encontrado.` });
      }
      if (String(existing.rows[0].tipo) !== cfg.id) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'importId não corresponde ao tipo desta importação.' });
      }
    }

    const outcome = await upsertRows(
      client,
      cfg,
      valid,
      importacaoId,
      dataImportacao,
      cfg.snapshot ? { dataReferencia, mesReferencia, anoReferencia } : null,
      { clearBefore }
    );

    const status = errors.length === 0 ? 'CONCLUIDO' : valid.length > 0 ? 'CONCLUIDO_COM_AVISOS' : 'FALHA';
    const logStatus =
      !isLastChunk && status !== 'FALHA' ? 'CONCLUIDO_COM_AVISOS' : status;

    if (chunkIndex === 0) {
      await client.query(
        `INSERT INTO importacoes
           (id, tipo, arquivo, usuario_nome, usuario_email, data_referencia, mes_referencia, ano_referencia,
            data_importacao, total_linhas, novos, atualizados, rejeitados, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
        [
          importacaoId,
          cfg.id,
          body.arquivo || null,
          body.usuarioNome || null,
          body.usuarioEmail || null,
          dataReferencia,
          mesReferencia,
          anoReferencia,
          dataImportacao,
          totalLinhas,
          outcome.novos,
          outcome.atualizados,
          errors.length,
          logStatus,
        ]
      );
    } else {
      await client.query(
        `UPDATE importacoes
            SET total_linhas = total_linhas + $1,
                novos = novos + $2,
                atualizados = atualizados + $3,
                rejeitados = rejeitados + $4,
                status = $5,
                data_importacao = $6
          WHERE id = $7`,
        [
          totalLinhas,
          outcome.novos,
          outcome.atualizados,
          errors.length,
          isLastChunk ? logStatus : 'CONCLUIDO_COM_AVISOS',
          dataImportacao,
          importacaoId,
        ]
      );
    }

    if (errors.length > 0) {
      const errParams: unknown[] = [];
      const errTuples: string[] = [];
      errors.forEach((e) => {
        const placeholders = [`$${errParams.length + 1}`, `$${errParams.length + 2}`, `$${errParams.length + 3}`];
        errTuples.push(`(${placeholders.join(', ')})`);
        errParams.push(importacaoId, e.linha, e.motivo);
      });
      await client.query(
        `INSERT INTO importacoes_erros (importacao_id, linha, motivo) VALUES ${errTuples.join(', ')}`,
        errParams
      );
    }

    await client.query('COMMIT');

    return res.status(200).json({
      importId: importacaoId,
      tipo: cfg.id,
      tipoLabel: cfg.label,
      arquivo: body.arquivo || null,
      dataReferencia,
      totalAnalisados: totalLinhas,
      novos: outcome.novos,
      atualizados: outcome.atualizados,
      rejeitados: errors.length,
      status,
      erros: errors,
      chunkIndex,
      totalChunks,
      done: isLastChunk,
    });
  } catch (err) {
    if (client) {
      try {
        await client.query('ROLLBACK');
      } catch {
        // se o rollback falhar (ex: conexão já caiu), não há mais nada a fazer aqui
      }
    }
    const message = err instanceof Error ? err.message : 'Erro desconhecido';

    // Mesmo em falha total, registramos a tentativa para auditoria (regra 26),
    // fora da transação que acabou de sofrer rollback.
    try {
      await pool.query(
        `INSERT INTO importacoes
           (tipo, arquivo, usuario_nome, usuario_email, data_referencia, mes_referencia, ano_referencia,
            data_importacao, total_linhas, novos, atualizados, rejeitados, status, mensagem_erro)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,0,0,$10,'FALHA',$11)`,
        [
          cfg.id,
          body.arquivo || null,
          body.usuarioNome || null,
          body.usuarioEmail || null,
          dataReferencia,
          mesReferencia,
          anoReferencia,
          dataImportacao,
          totalLinhas,
          totalLinhas,
          message,
        ]
      );
    } catch {
      // se nem o log de falha conseguir gravar, não há mais nada a fazer aqui
    }

    // eslint-disable-next-line no-console
    console.error('[imports] Falha na importação:', err);
    return res.status(500).json({ error: 'Falha ao processar a importação. Nenhum dado foi gravado.', detail: message });
  } finally {
    client?.release();
  }
});

importsRouter.get('/', requireApiKey, async (req: Request, res: Response) => {
  try {
    const tipo = typeof req.query.tipo === 'string' ? req.query.tipo : undefined;
    const limit = Math.min(Number(req.query.limit) || 100, 500);

    const params: unknown[] = [];
    let where = '';
    if (tipo) {
      params.push(tipo);
      where = 'WHERE tipo = $1';
    }
    params.push(limit);

    const result = await pool.query(
      `SELECT id, tipo, arquivo, usuario_nome, usuario_email, data_referencia, mes_referencia,
              ano_referencia, data_importacao, total_linhas, novos, atualizados, rejeitados, status, mensagem_erro
       FROM importacoes
       ${where}
       ORDER BY data_importacao DESC
       LIMIT $${params.length}`,
      params
    );

    res.json(result.rows);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[imports] Falha ao consultar histórico:', err);
    res.status(500).json({ error: 'Falha ao consultar o histórico de importações.' });
  }
});

importsRouter.get('/:id/erros', requireApiKey, async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'id inválido' });

    const result = await pool.query(
      'SELECT linha, motivo FROM importacoes_erros WHERE importacao_id = $1 ORDER BY linha',
      [id]
    );
    res.json(result.rows);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[imports] Falha ao consultar erros da importação:', err);
    res.status(500).json({ error: 'Falha ao consultar os erros desta importação.' });
  }
});
