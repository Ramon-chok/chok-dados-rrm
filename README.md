<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/7a3c8fc3-89fc-49c3-8260-fb3b0f449caf

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Production notes

- Use an HttpOnly cookie for authentication (already implemented). Set the following env vars in production:
   - `JWT_SECRET` — altere para um valor forte e mantenha em segredo.
   - `CORS_ORIGINS` — defina apenas as origens do frontend (ex.: https://app.suaempresa.com).
   - `JWT_COOKIE_SECURE=true` — exige HTTPS; mantenha `true` em produção.
   - `JWT_COOKIE_SAME_SITE=Lax` — recomendado para compatibilidade com links externos.
   - `JWT_COOKIE_DOMAIN` — opcional, defina para o domínio principal (ex.: `.suaempresa.com`).

- No frontend é usado `fetch(..., { credentials: 'include' })` para enviar o cookie HttpOnly.

- Para testes locais (HTTP) você pode temporariamente definir `JWT_COOKIE_SECURE=false` no `.env`.
