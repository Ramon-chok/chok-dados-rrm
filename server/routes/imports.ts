import { Router, Request, Response, NextFunction } from 'express';
import type { PoolClient } from 'pg';
import { pool } from '../db.js';
import { getImportTypeConfig } from '../importTypes.js';
import { mapAndValidateRows, upsertRows } from '../upsert.js';
import { parseDateOnly } from '../parse.js';

export const importsRouter = Router();

// Autenticação simples por chave compartilhada. Serve tanto para a automação
// Python quanto para a tela de importação do site (mesma chave, injetada no
// frontend via VITE_IMPORT_API_KEY). Se IMPORT_API_KEY não estiver definida,
// a checagem é pulada (conveniente em desenvolvimento local) — nunca deixe
// isso acontecer em produção.
function requireApiKey(req: Request, res: Response, next: NextFunction) {
  const expected = process.env.IMPORT_API_KEY;
  if (!expected) return next();
  const provided = req.header('x-api-key');
  if (provided !== expected) {
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
}

importsRouter.post('/', requireApiKey, async (req: Request, res: Response) => {
  const body = req.body as ImportRequestBody;

  if (!body || typeof body !== 'object') {
    return res.status(400).json({ error: 'Corpo da requisição inválido.' });
  }

  const cfg = getImportTypeConfig(body.tipo);
  if (!cfg) {
    return res.status(400).json({ error: `Tipo de importação desconhecido: "${body.tipo}".` });
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
  if (!body.mapping || typeof body.mapping !== 'object') {
    return res.status(400).json({ error: 'Mapeamento de colunas ausente.' });
  }

  const { valid, errors } = mapAndValidateRows(cfg, body.mapping, body.rows);
  const dataImportacao = new Date();
  const totalLinhas = body.rows.length;

  // client fora do try (para o catch/finally poderem checar se chegou a
  // existir) — se pool.connect() falhar (ex: banco fora do ar, credencial
  // errada), isso agora vira um 500 tratado em vez de travar a requisição
  // para sempre sem nunca enviar resposta.
  let client: PoolClient | undefined;
  try {
    client = await pool.connect();
    await client.query('BEGIN');

    // Reserva o id do log de auditoria antes do upsert, para que cada linha
    // gravada já saia com o importacao_id definitivo (evita um UPDATE extra
    // de correção depois).
    const seqResult = await client.query(
      `SELECT nextval(pg_get_serial_sequence('importacoes', 'id')) AS id`
    );
    const importacaoId = Number(seqResult.rows[0].id);

    const outcome = await upsertRows(
      client,
      cfg,
      valid,
      importacaoId,
      dataImportacao,
      cfg.snapshot ? { dataReferencia, mesReferencia, anoReferencia } : null
    );

    const status = errors.length === 0 ? 'CONCLUIDO' : valid.length > 0 ? 'CONCLUIDO_COM_AVISOS' : 'FALHA';

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
        status,
      ]
    );

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

importsRouter.get('/', async (req: Request, res: Response) => {
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

importsRouter.get('/:id/erros', async (req: Request, res: Response) => {
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
