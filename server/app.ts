// App Express "puro" (sem .listen() e sem servir arquivos estáticos) —
// reaproveitado tanto pelo servidor Node tradicional (server/index.ts, usado
// em `npm run server:dev` / Cloud Run / qualquer host Node) quanto pela
// função serverless do Vercel (api/index.ts). Mesma lógica de rotas/upsert
// nos dois modelos de deploy — só muda quem chama `.listen()`.
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { importsRouter } from './routes/imports.js';
import { authRouter } from './routes/auth.js';

const app = express();

// Corpo em JSON pode ser grande (planilhas inteiras convertidas em linhas).
// OBS: no Vercel, o próprio gateway limita o corpo da requisição a ~4.5MB
// independente deste valor — planilhas muito grandes podem precisar rodar
// pelo modo Node tradicional (server:dev) em vez do serverless.
app.use(cors());
app.use(express.json({ limit: '30mb' }));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.use('/api/imports', importsRouter);
app.use('/api/auth', authRouter);

// Rede de segurança: qualquer erro que escape de uma rota (ex: JSON malformado
// no corpo da requisição) cai aqui em vez de deixar a requisição sem resposta.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  // eslint-disable-next-line no-console
  console.error('[app] Erro não tratado:', err);
  if (!res.headersSent) {
    res.status(500).json({ error: 'Erro interno inesperado.' });
  }
});

export default app;
