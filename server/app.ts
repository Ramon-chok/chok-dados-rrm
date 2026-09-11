// App Express "puro" (sem .listen() e sem servir arquivos estáticos) —
// reaproveitado tanto pelo servidor Node tradicional (server/index.ts, usado
// em `npm run server:dev` / Cloud Run / qualquer host Node) quanto pela
// função serverless do Vercel (api/index.ts). Mesma lógica de rotas/upsert
// nos dois modelos de deploy — só muda quem chama `.listen()`.
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { importsRouter } from './routes/imports.js';

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

export default app;
