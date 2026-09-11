// Conexão única com o Postgres (Supabase, Neon ou qualquer Postgres compatível
// via DATABASE_URL). Um único Pool é reaproveitado por toda a API para não
// abrir conexão nova a cada requisição — é a peça central de "não sobrecarregar
// o banco" no lado do backend.
import pkg from 'pg';
const { Pool } = pkg;

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  // eslint-disable-next-line no-console
  console.warn(
    '[db] DATABASE_URL não configurada. Defina-a em um .env (veja env.example) antes de usar as rotas de importação.'
  );
}

export const pool = new Pool({
  connectionString,
  // Supabase/Neon exigem TLS; em ambientes locais sem SSL isso é ignorado.
  ssl: connectionString && !connectionString.includes('localhost') ? { rejectUnauthorized: false } : undefined,
  // No Vercel cada função serverless roda em sua própria instância, cada uma
  // com seu próprio pool — um max alto multiplicaria pelo número de
  // instâncias simultâneas e poderia esgotar o pooler do Supabase.
  max: process.env.VERCEL ? 3 : 10,
  // Sem isso, uma DATABASE_URL ausente/errada ou uma rede que não responde
  // trava a requisição para sempre em vez de falhar com um erro claro.
  connectionTimeoutMillis: 8000,
  idleTimeoutMillis: 30000,
});

pool.on('error', (err) => {
  // eslint-disable-next-line no-console
  console.error('[db] Erro inesperado no pool de conexões:', err);
});
