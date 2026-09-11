// Função serverless do Vercel — qualquer requisição a /api/* (ver
// vercel.json) cai aqui. Reaproveita o mesmo app Express de server/app.ts,
// então as rotas (POST/GET /api/imports) se comportam de forma idêntica ao
// modo Node tradicional.
import app from '../server/app.js';

export default app;
