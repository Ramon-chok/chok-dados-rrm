// App Express "puro" (sem .listen() e sem servir arquivos estáticos) —
// reaproveitado tanto pelo servidor Node tradicional (server/index.ts, usado
// em `npm run server:dev` / Cloud Run / qualquer host Node) quanto pela
// função serverless do Vercel (api/index.ts). Mesma lógica de rotas/upsert
// nos dois modelos de deploy — só muda quem chama `.listen()`.
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { randomBytes } from 'crypto';
import { importsRouter } from './routes/imports.js';
import { allowedOrigins, rateLimit, securityHeaders } from './security.js';

const app = express();

// Corpo em JSON pode ser grande (planilhas inteiras convertidas em linhas).
// OBS: no Vercel, o próprio gateway limita o corpo da requisição a ~4.5MB
// independente deste valor — planilhas muito grandes podem precisar rodar
// pelo modo Node tradicional (server:dev) em vez do serverless.
app.disable('x-powered-by');
// Atrás de proxy (Vercel/Cloud Run) o IP real vem no X-Forwarded-For.
app.set('trust proxy', 1);
app.use(securityHeaders);
app.use(rateLimit(600));
// CORS restrito às origens configuradas (nada de "*" com credenciais).
app.use(
  cors({
    origin: (origin, cb) => cb(null, !origin || allowedOrigins().includes(origin)),
    credentials: true,
    methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'x-api-key'],
  })
);
app.use(express.json({ limit: '30mb' }));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.use('/api/imports', rateLimit(60, 60_000, 'imports'), importsRouter);

// Este servidor legado NÃO autentica usuários (o stub de login foi removido):
// a autenticação real está no backend Python (backend/app/routers/auth.py).

// Rede de segurança: qualquer erro que escape de uma rota (ex: JSON malformado
// no corpo da requisição) cai aqui em vez de deixar a requisição sem resposta.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: unknown, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  // Código de referência também aqui: sem ele a tela mostrava só o texto
  // genérico "Não foi possível concluir a operação", sem nada que ligasse a
  // resposta ao log do servidor — e o backend Python já responde com `ref`
  // em todo 5xx, então a ausência dele era a única pista de que o erro tinha
  // vindo deste middleware. Agora os dois são rastreáveis do mesmo jeito.
  const ref = randomBytes(4).toString('hex').toUpperCase();
  // eslint-disable-next-line no-console
  console.error(`[app] [ref=${ref}] Erro não tratado em ${req.method} ${req.path}:`, err);
  if (!res.headersSent) {
    // Corpo grande demais tem status próprio (413) — devolver 500 faria o
    // usuário tentar de novo um envio que nunca vai caber.
    const status = (err as { status?: number; statusCode?: number } | null)?.status
      ?? (err as { statusCode?: number } | null)?.statusCode;
    if (status === 413) {
      res.status(413).json({ error: 'O conteúdo enviado é maior que o permitido.', ref });
      return;
    }
    res.status(500).json({ error: 'Erro interno inesperado.', ref });
  }
});

export default app;
