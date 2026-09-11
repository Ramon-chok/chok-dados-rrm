import { Router, Request, Response } from 'express';
import { pool } from '../db.js';

export const authRouter = Router();

// Development-friendly auth: accepts seeded password (SEED_PASSWORD) or
// matches a plain `password` column in legacy `login` table. Returns a
// simple bearer token and a minimal user object for the frontend.
authRouter.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body as { email?: string; password?: string };
    if (!email || !password) return res.status(400).json({ error: 'email and password required' });

    const normalized = String(email).trim().toLowerCase();

    // Try usuarios (newer backend schema)
    const userResult = await pool.query(
      'SELECT id, name, email, role, status, last_login_at FROM usuarios WHERE lower(email) = $1',
      [normalized]
    );

    const seed = process.env.SEED_PASSWORD || 'Chok@2026';

    if (userResult.rowCount > 0) {
      const user = userResult.rows[0];
      if (password === seed) {
        await pool.query('UPDATE usuarios SET last_login_at = now() WHERE id = $1', [user.id]);
        return res.json({ token: `devtoken-${user.id}`, user });
      }
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Fallback to legacy `login` table
    const legacy = await pool.query('SELECT id, cod, nome, password, role FROM login WHERE lower(cod) = $1 OR lower(nome) = $1', [normalized]);
    if (legacy.rowCount > 0) {
      const row = legacy.rows[0];
      if (password === row.password || password === seed) {
        const user = {
          id: String(row.id),
          name: row.nome || row.cod,
          email: normalized,
          role: (row.role || 'ADMIN').toUpperCase(),
          status: 'Ativo',
        };
        return res.json({ token: `devtoken-${row.id}`, user });
      }
    }

    return res.status(401).json({ error: 'E-mail ou credenciais corporativas não encontradas no sistema.' });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[auth] error', err);
    return res.status(500).json({ error: 'Erro interno ao autenticar.' });
  }
});
