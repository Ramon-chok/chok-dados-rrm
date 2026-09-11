// Entrypoint para rodar como processo Node "normal" — usado localmente
// (`npm run server:dev`) e em hospedagens que executam um servidor de longa
// duração (Cloud Run, VPS, etc.). No Vercel, quem atende as requisições é
// api/index.ts (função serverless), que reaproveita o mesmo server/app.ts.
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import app from './app.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Em produção "tradicional" (não-Vercel), este processo também serve o
// frontend já buildado (dist/), para caber em um único deploy — sem mexer em
// como o projeto já era publicado antes desta mudança.
if (process.env.NODE_ENV === 'production') {
  const distDir = path.resolve(__dirname, '..', 'dist');
  app.use(express.static(distDir));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(distDir, 'index.html'));
  });
}

// PORT é o que o Cloud Run/hospedagem injeta em produção; SERVER_PORT é a
// convenção usada localmente para não colidir com a porta do Vite.
const port = Number(process.env.PORT) || Number(process.env.SERVER_PORT) || 8787;
app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`[server] API de importação escutando em http://localhost:${port}`);
});
