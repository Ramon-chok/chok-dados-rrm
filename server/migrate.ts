// Aplica server/schema.sql no banco apontado por DATABASE_URL.
// Idempotente (CREATE TABLE/INDEX IF NOT EXISTS) — pode ser rodado quantas
// vezes for preciso, inclusive em produção antes de subir o server.
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function migrate() {
  const schemaPath = path.join(__dirname, 'schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf-8');

  console.log('[migrate] Aplicando server/schema.sql...');
  const client = await pool.connect();
  try {
    await client.query(sql);
    console.log('[migrate] Concluído com sucesso.');
  } finally {
    client.release();
  }
  await pool.end();
}

migrate().catch((err) => {
  console.error('[migrate] Falhou:', err);
  process.exitCode = 1;
});
