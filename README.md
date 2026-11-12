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

---

## Evolução — o que foi acrescentado (padronização GA 360)

Tudo abaixo é **incremental**: nenhuma tela, rota ou tabela anterior foi
removida ou reescrita. As telas antigas continuam usando os mesmos endpoints
de antes.

### Antes de subir: rodar a migration

```bash
python backend/migrate.py
```

Aplica `backend/sql/evolucao.sql`, que só cria coisas novas
(`CREATE TABLE/INDEX IF NOT EXISTS`): `sessoes_log`, `eventos_comerciais`,
`fornecedores` e `negociacoes_compra`. Pode rodar quantas vezes precisar.

### Perfis de acesso

Aos quatro perfis originais (`ADMIN`, `GERENTE`, `SUPERVISOR`, `VENDEDOR`)
somaram-se `GERENTE_COMERCIAL`, `GERENTE_VENDAS`, `COMPRADOR`, `ANALISTA` e
`SAR`. A matriz vive em `backend/app/security.py` (`ROLE_PERMISSIONS`) e é
espelhada em `src/types.ts`.

Duas permissões merecem atenção:

- **`margin.view`** — sem ela o backend devolve `margem: null`. A margem não
  é "escondida na tela": o número não sai do servidor.
- **`comparisons.view` / `purchasing.*`** — as rotas correspondentes respondem
  403 para quem não tem, então digitar a URL na mão não abre nada.

O recorte de dados (`scope_filters`) continua sendo aplicado no SQL: Supervisor
não sai da própria equipe e Vendedor não sai do próprio código, mesmo que a
requisição mande outro valor.

### Sessão e inatividade (40 min)

`backend/app/sessions.py` carimba `ultimo_acesso` a cada requisição autenticada
(no máximo uma gravação por minuto por sessão). Passados 40 minutos sem
nenhuma requisição, `get_current_user` encerra a sessão, revoga o JWT e passa a
responder 401 — **inclusive com "manter conectado" marcado**, como pedido.

O frontend (`src/hooks/useIdleLogout.ts`) espelha a regra para limpar a tela e
avisar no último minuto, mas quem decide é o servidor.

`GET /api/insights/sessoes` lista o histórico (login, logout, duração e motivo:
`logout`, `inatividade` ou `expiracao`). Cada um vê o próprio; o ADMIN vê todos.

### Rotas novas

| Rota | Para quê |
| --- | --- |
| `GET /api/insights/kpis` | Faturamento/Cobertura/Sortimento em DIA e MÊS |
| `GET /api/insights/top-clientes` | TOP N por dia, mês ou período |
| `GET /api/insights/busca` | Pesquisa unificada (cliente, CNPJ, SKU, pedido…) |
| `GET /api/insights/fabricantes` | Lista de fabricantes com indicadores (API, sem tela) |
| `GET /api/insights/fabricante-drill` | Fabricante → Categoria → Produto → Cliente (API, sem tela) |
| `GET /api/insights/comparativo` | Comparativo entre períodos (gerência) |
| `GET/POST/PATCH/DELETE /api/insights/calendario*` | Calendário comercial |
| `GET /api/insights/sessoes` | Histórico de sessões |
| `/api/purchasing/suppliers`, `/api/purchasing/negotiations` | Módulo de Compras |

O bloco **MÊS** de `/insights/kpis` usa exatamente a mesma agregação de
`/api/dashboard` — os dois painéis nunca divergem (conferido com dados reais).

### Semanas do ciclo comercial (SAR)

A semana segue o calendário civil: **domingo a sábado**.

`backend/app/routers/insights.py::semana_comercial` e
`src/lib/semanaComercial.ts` implementam o mesmo ciclo contínuo de 4 semanas,
ancorado na referência combinada: a primeira linha semanal de **janeiro/2026 é
a Semana 3** (linha que começa no domingo 28/12/2025). A sequência 1-2-3-4
**não reinicia** ao virar mês ou ano.

> É o ciclo comercial interno, **não** a numeração ISO das semanas do ano.

### Feriados

`src/lib/feriados.ts` calcula os feriados no próprio navegador — nada de API
externa, então o calendário funciona para qualquer mês/ano e offline. Inclui os
nacionais de data fixa, os derivados da Páscoa (algoritmo de Gauss/Meeus:
Carnaval, Cinzas, Sexta-feira Santa, Corpus Christi) e marca os **pontos
facultativos** à parte, já que em muitas operações se trabalha neles.

Feriados estaduais/municipais variam por cidade e não estão incluídos: para
adicioná-los, preencha `FERIADOS_REGIONAIS` nesse mesmo arquivo.

### Dependências de dados ainda não alimentadas

Nada é preenchido com valor fictício. Hoje faltam cargas para:

- **`clientes`, `produtos` e `vendas` estão vazias.** A busca por cliente usa
  `top_clientes` (4,5 mil nomes carregados) como fonte; a busca por **pedido**
  só passa a devolver resultado quando `vendas` for alimentada.
- **`top_clientes` não tem coluna `fabricante`**, então o nível "clientes que
  compraram" do drill de fabricante volta vazio, com aviso na tela.
- **`indicadores_vendedor` recebe hoje um fechamento mensal regravado em várias
  `data_referencia`** (as datas somam sempre o mesmo valor). O endpoint detecta
  isso e devolve `referencia.avisoCarga = "snapshot_mensal"`; o painel DIA
  mostra o aviso de que aquele número é o retrato do mês naquela data, e não a
  venda do dia. Com carga diária de verdade o aviso some sozinho.

### Ajustes posteriores

- **Troca de tema animada** — `src/lib/themeTransition.ts`. Um círculo nasce no
  botão clicado e abre até cobrir a tela. Usa a View Transitions API onde
  existe e, onde não existe, uma camada temporária com o mesmo efeito. Respeita
  `prefers-reduced-motion`.
- **Menu lateral retrátil por grupo** — cada grupo (Comercial, SAR, Conta,
  Administração) tem uma setinha que oculta e reexibe as telas. O estado fica
  no navegador (`chok_menu_grupos_fechados`) e o grupo da tela ativa abre
  sozinho.
- **Tela "Desempenho por Fabricante" retirada.** Os endpoints
  `/api/insights/fabricantes` e `/fabricante-drill` continuam ativos e
  protegidos por `manufacturers.view`; só a tela saiu. O cliente tipado segue
  em `src/lib/insights.ts` caso ela volte.
- **Dashboard** — a seção "Indicadores de Performance" saiu: repetia
  Faturamento, Cobertura e Sortimento que já aparecem no carrossel DIA/MÊS no
  topo. Os mesmos números continuam na Visão Gráfica, logo abaixo.
- **Comparativos** — reorganizado em blocos (Resultado, Alcance,
  Rentabilidade, Investimento) com card de destaque para faturamento, barras na
  mesma escala e atingimento de meta por período.
