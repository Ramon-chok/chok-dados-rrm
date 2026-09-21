// Endurecimento do backend Node legado (server/app.ts): cabeçalhos de
// segurança, rate limit por IP, CORS restrito e comparação de chave em tempo
// constante. Sem dependências novas de propósito.
import crypto from 'crypto';
import type { NextFunction, Request, Response } from 'express';

export const isProduction = process.env.NODE_ENV === 'production';

export function securityHeaders(_req: Request, res: Response, next: NextFunction) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
  res.setHeader('Cache-Control', 'no-store');
  if (isProduction) res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.removeHeader('X-Powered-By');
  next();
}

const hits = new Map<string, number[]>();

/** Janela deslizante em memória (por processo). DDoS volumétrico precisa de WAF/CDN na borda. */
export function rateLimit(limit: number, windowMs = 60_000, scope = 'g') {
  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    const key = `${scope}:${req.ip}`;
    const recent = (hits.get(key) || []).filter((t) => now - t < windowMs);
    if (recent.length >= limit) {
      res.setHeader('Retry-After', String(Math.ceil(windowMs / 1000)));
      return res.status(429).json({ error: 'Muitas requisições. Aguarde um instante e tente novamente.' });
    }
    recent.push(now);
    hits.set(key, recent);
    if (hits.size > 50_000) {
      for (const k of Array.from(hits.keys()).slice(0, 10_000)) hits.delete(k);
    }
    next();
  };
}

export function safeEqual(a: string, b: string): boolean {
  const ha = crypto.createHash('sha256').update(a).digest();
  const hb = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(ha, hb);
}

/** Origens liberadas no CORS (CORS_ORIGINS separado por vírgula). */
export function allowedOrigins(): string[] {
  return (process.env.CORS_ORIGINS || 'http://localhost:3000,http://localhost:5173')
    .split(',')
    .map((o) => o.trim().replace(/\/$/, ''))
    .filter(Boolean);
}
