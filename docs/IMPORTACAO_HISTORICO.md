# Sistema de Upload, Automação e Histórico de Dados

Este documento descreve a implementação do banco histórico e da API de
importação deste projeto — a peça que faltava para o site parar de guardar
apenas "o valor de agora" e passar a guardar **um snapshot por data de
referência**, preservando o Excel + automação Python já usados hoje.

## 1. Visão geral do fluxo

```
Excel (.xlsm) → Automação Python (existente, adaptada) → POST /api/imports
   → validação + upsert transacional → Postgres (histórico) → GET /api/imports
   → tela de Importação (Importacao.tsx)
```

- O Excel continua sendo a etapa de tratamento/fórmulas/filtros manuais — nada
  muda aí.
- A automação Python passa a enviar os **valores já calculados** (nunca
  fórmulas) para `POST /api/imports`, junto com a data de referência dos
  dados.
- O backend faz **upsert** (INSERT se o registro não existir para aquele
  período, UPDATE se já existir) — nunca duplica, nunca perde o histórico de
  dias/meses anteriores.
- Cada chamada gera uma linha de auditoria em `importacoes` (arquivo, tipo,
  contagens, status) — visível na própria tela de Importação.

## 2. O que foi criado

| Arquivo | Função |
|---|---|
| `server/schema.sql` | Todo o esquema do banco histórico (cadastros, indicadores diários, metas, auditoria). |
| `server/importTypes.ts` | Configuração de cada tipo de dado: tabela, chave lógica de upsert, colunas. **Novo tipo de dado no futuro = nova entrada aqui, sem mexer no resto.** |
| `server/upsert.ts` | Motor genérico de upsert em lote (transacional, chunked). |
| `server/parse.ts` | Conversão tolerante de datas/números vindos da planilha. |
| `server/routes/imports.ts` | `POST /api/imports` (grava) e `GET /api/imports` (histórico de cargas). |
| `server/index.ts` | Servidor Express. |
| `server/migrate.ts` | Aplica `schema.sql` no banco (idempotente). |
| `src/lib/api.ts` | Cliente HTTP usado pela tela de Importação. |
| `src/pages/admin/Importacao.tsx` | Tela existente, agora ligada ao backend real (campo de Data de Referência adicionado; layout preservado). |

## 3. Tabelas do banco histórico

**Cadastros** (upsert pelo código natural, sempre o estado atual):
`vendedores`, `equipes`, `supervisores`, `gerencias`, `fabricantes`,
`categorias`, `clientes`, `produtos`.

**Vínculo histórico**: `vendedor_equipe_historico` — para quando um vendedor
troca de equipe sem invalidar a análise do passado (regra 18 do PRD).

**Metas históricas**: `metas_mensais`, chave `(ano_mes, cod_vendedor,
fabricante)` — a meta de setembro nunca é sobrescrita pela de outubro.

**Fatos transacionais** (data própria por linha): `vendas` (chave
`numero_pedido`), `visitas` (chave `cod_cliente + cod_vendedor +
data_visita`).

**Indicadores diários / snapshot** (o núcleo do pedido — regra 5): uma linha
por `data_referencia + chave da entidade`.

- `indicadores_vendedor` — aba "Mês": meta/realizado de faturamento,
  cobertura, sortimento e margem por vendedor. Chave: `data_referencia +
  cod_vendedor`.
- `indicadores_fabricante` — aba "Categorias": mesma ideia, por vendedor x
  fabricante. Chave: `data_referencia + cod_vendedor + fabricante`.
- `indicadores_positivacao` — aba "Positivação": visitas, vendas, fora de
  rota, GPS, pedidos. Chave: `data_referencia + cod_vendedor`.

**Auditoria**: `importacoes` (uma linha por upload) + `importacoes_erros`
(linhas rejeitadas com o motivo).

## 4. Como rodar localmente

```bash
npm install

# 1) Configure o .env (copie de env.example) com:
#    DATABASE_URL, IMPORT_API_KEY, VITE_IMPORT_API_KEY, SERVER_PORT

# 2) Crie as tabelas no Postgres (Supabase/Neon/etc.)
npm run db:migrate

# 3) Em um terminal, o backend:
npm run server:dev

# 4) Em outro terminal, o frontend (já com proxy de /api para o backend):
npm run dev
```

Em produção, `npm run server:build` gera `server.js` (bundle único), que serve
tanto a API quanto o `dist/` do frontend já buildado — mesmo modelo de deploy
que o projeto já usava (o script `clean` já esperava um `server.js`).

## 5. Como a automação Python deve chamar a API

O Python continua responsável por abrir a planilha, atualizar fórmulas e
extrair os valores finais (nunca fórmulas). A única mudança é o destino do
envio: em vez de escrever direto no site antigo, ele faz um `POST` para esta
API.

```python
import requests
from datetime import date

API_URL = "https://SEU-DOMINIO/api/imports"
API_KEY = "mesma chave de IMPORT_API_KEY"

payload = {
    "tipo": "indicadores_vendedor",       # ver server/importTypes.ts
    "dataReferencia": "2026-09-11",       # data que os dados REPRESENTAM
    "arquivo": "dados_app_11_09_2026.xlsm",
    "usuarioNome": "Automação Python",
    "usuarioEmail": "automacao@chok.com.br",
    "mapping": {
        # coluna do sistema -> cabeçalho da planilha/DataFrame já extraído
        "cod_vendedor": "cod_vendedor",
        "gerencia": "gerencia",
        "nome_vendedor": "nome_vendedor",
        "meta_faturamento": "meta_faturamento",
        "realizado_faturamento": "realizado_faturamento",
        "meta_cobertura": "meta_cobertura",
        "realizado_cobertura": "realizado_cobertura",
        "meta_sortimento": "meta_sortimento",
        "realizado_sortimento": "realizado_sortimento",
        "pct_margem": "pct_margem",
    },
    "rows": [
        {"cod_vendedor": "1250", "gerencia": "TRAD", "nome_vendedor": "...",
         "meta_faturamento": 90000, "realizado_faturamento": 84424.24,
         "meta_cobertura": 12, "realizado_cobertura": 10,
         "meta_sortimento": 40, "realizado_sortimento": 35, "pct_margem": 9.56},
        # ... uma linha por vendedor
    ],
}

resp = requests.post(API_URL, json=payload, headers={"x-api-key": API_KEY}, timeout=60)
resp.raise_for_status()
print(resp.json())  # {"importId":..., "novos":..., "atualizados":..., "rejeitados":..., "status": "CONCLUIDO", ...}
```

Rodar o mesmo arquivo de novo com a mesma `dataReferencia` **atualiza** o
snapshot daquele dia (regra 12/13 — não duplica). Mudar a `dataReferencia`
cria um snapshot novo, sem tocar nos dias anteriores. Reenviar um arquivo
corrigido (regra 28) funciona exatamente da mesma forma — é só reprocessar
com a mesma data.

Isso pode continuar rodando em segundo plano (agendador do Windows, cron,
etc.) exatamente como a automação atual — a única mudança é o destino do
`POST`.

## 6. Escopo desta etapa e próximos passos

Esta etapa entregou o **esquema completo do banco** e a **importação real**
(o que a tela de Importação já fazia de forma simulada, agora grava de
verdade, com histórico e auditoria).

**Deliberadamente fora desta etapa**: a tela de [Historico.tsx](../src/pages/analytics/Historico.tsx)
continua consumindo dados de demonstração gerados em memória — ela não foi
tocada. Rewire-á-la para consumir o histórico real é o próximo passo natural,
mas só faz sentido depois que houver dados reais importados (hoje o banco
está vazio até a primeira carga). Quando quiser seguir para essa etapa, é
questão de criar endpoints `GET` de leitura agregada (por período, vendedor,
equipe, fabricante) sobre as tabelas `indicadores_*` já existentes e trocar a
fonte de dados desse componente — o motor de upsert e o esquema já dão
suporte total às comparações descritas nas seções 20-22 do pedido original
(evolução diária/mensal, comparação entre períodos, etc.).
