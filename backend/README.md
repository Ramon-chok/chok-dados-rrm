# Backend Python — CHOK Dados (RR Mind)

API FastAPI que substitui o servidor Node (`server/`) com o **mesmo contrato** de importação (`POST/GET /api/imports`) e acrescenta autenticação JWT, RBAC e endpoints de leitura analítica.

## Requisitos

- Python 3.11+
- Postgres (Supabase, Neon ou local), mesma `DATABASE_URL` do `.env` da raiz

## Instalação

```bash
cd backend
python -m venv .venv
# Windows:
.venv\Scripts\activate
# Linux/macOS:
# source .venv/bin/activate

pip install -r requirements.txt
```

Variáveis (pode usar o `.env` da raiz do projeto):

| Variável | Uso |
|---|---|
| `DATABASE_URL` | Postgres |
| `IMPORT_API_KEY` | Header `x-api-key` em `POST /api/imports` (vazio = sem checagem, só em dev) |
| `JWT_SECRET` | Segredo dos tokens de login |
| `SEED_PASSWORD` | Senha inicial dos usuários de demonstração (padrão `Chok@2026`) |
| `SERVER_PORT` | Porta (padrão `8787`, igual ao Node, para o proxy do Vite) |

## Migrar o banco e semear usuários

```bash
python migrate.py
```

Idempotente. Cria as tabelas históricas + `usuarios` / `audit_log` e insere:

| E-mail | Perfil | Senha |
|---|---|---|
| ramon21.empresa@gmail.com | ADMIN | `Chok@2026` |
| carlos.mendes@chok.com.br | GERENTE | `Chok@2026` |
| marcos.valerio@chok.com.br | SUPERVISOR | `Chok@2026` |
| joao.vendedor003@chok.com.br | VENDEDOR | `Chok@2026` |

## Rodar

```bash
python run.py
# ou:
uvicorn app.main:app --reload --port 8787
```

Health: `GET http://localhost:8787/api/health` → `{ "ok": true }`

O Vite (`npm run dev`) já faz proxy de `/api` para a porta `8787`. A tela de Importação continua funcionando sem mudança no frontend.

## Endpoints

### Saúde e importação (compatíveis com o Node)

- `GET /api/health`
- `POST /api/imports` — upsert transacional (mesmo JSON do `src/lib/api.ts`)
- `GET /api/imports?limit=&tipo=`
- `GET /api/imports/{id}/erros`

### Auth / usuários

- `POST /api/auth/login` `{ email, password }` → `{ token, user }`
- `GET /api/auth/me` (Bearer)
- `GET/POST /api/users` e `PATCH/DELETE /api/users/{id}` (ADMIN)

### Leitura analítica (Bearer)

- `GET /api/dashboard`
- `GET /api/analytics/tree`
- `GET /api/analytics/history`
- `GET /api/analytics/sales`
- `GET /api/catalog/products|customers|sellers|teams|manufacturers`
- `GET /api/commercial/targets`
- `GET /api/commercial/top-customers`
- `GET /api/commercial/not-positivated`
- `GET /api/sar/positivacao`

Filtros comuns: `ano`, `mes`, `start`, `end`, `equipe`, `vendedor`, `fabricante`. O recorte RBAC (vendedor vê só a própria carteira; supervisor, a equipe) é aplicado no servidor.

## Testes

```bash
cd backend
pytest -q
```

Não exigem Postgres (cobrem parse/validação de importação).
