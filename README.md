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

---

## Perfis de acesso — a matriz de 10 papéis

Os tipos de usuário anteriores foram substituídos por esta lista. O papel
genérico `GERENTE` **saiu**; `backend/sql/perfis.sql` remapeia quem estava nele
para `GERENTE_COMERCIAL`.

A matriz tem **duas dimensões independentes**, e confundi-las é o erro comum:
o que o perfil **vê** e o que ele **altera**. Um Gerente Comercial enxerga
tudo, margens incluídas, e não muda nada.

| Papel | Vê | Altera |
| --- | --- | --- |
| `SUPERADMIN` | tudo | **livre** — qualquer critério e parâmetro |
| `ADMIN` | tudo | **com confirmação** a cada alteração |
| `GERENTE_COMERCIAL` | tudo, **com margens** | nada |
| `GERENTE_VENDAS` | tudo, **sem margens** | nada |
| `COMPRADOR` | tudo | **após liberação** do admin |
| `SUPERVISOR` | só a própria equipe | nada |
| `ANALISTA` | tudo | **após liberação** do admin |
| `FORNECEDOR` | só a Visual Fabricantes do próprio fabricante | nada |
| `VENDEDOR` | só os próprios dados | nada |
| `SAR` | tudo | **após liberação** do admin |

"Acesso total" aqui é toda a leitura **comercial**. A administração da própria
plataforma — cadastro de usuários, importações, exportações e as liberações —
continua com `SUPERADMIN` e `ADMIN`: é o que separa "ver tudo" de "administrar
tudo".

A matriz que **vale** é `ROLE_PERMISSIONS` + `MODO_ESCRITA` em
`backend/app/security.py`; `src/types.ts` é o espelho que decide apenas o que a
tela oferece. Em TypeScript, `isAdminRole()`, `podeFiltrarEquipe()`,
`podeFiltrarVendedor()` e `modoEscritaDoPapel()` substituíram as comparações
soltas com `'ADMIN'` e `'GERENTE'` espalhadas pelas telas.

### O portão de escrita

Toda rota que altera dado comercial passa por `require_write(permissão)`, que
confere a permissão **e** o modo de escrita do papel. Os dois precisam passar.

| Modo | O que acontece na prática |
| --- | --- |
| `livre` | grava direto |
| `confirmacao` | 1ª tentativa volta **428**; a tela abre o diálogo e repete a requisição com o cabeçalho `x-confirmar-alteracao` |
| `liberacao` | **403 `liberacao_necessaria`** até existir uma liberação ativa |
| `leitura` | **403 `somente_leitura`** |

O código do erro vai no corpo da resposta, numa lista fechada
(`_CODIGOS_PUBLICOS` em `main.py`), para a tela saber **qual caminho oferecer**
em vez de mostrar um erro seco.

A confirmação do ADMIN é resolvida uma vez só, em `src/lib/api.ts`: a camada de
rede chama o diálogo registrado por `ConfirmacaoAlteracao` e repete a mesma
requisição confirmada. Nenhuma tela precisa saber dessa regra. O cabeçalho
**não é credencial** — quem o envia já está autenticado e já tem a permissão;
o que ele evita é a alteração disparada sem querer.

Fora do portão, de propósito: login, 2FA, logout e o que o usuário faz na
própria conta (avatar, senha). Isso é autoatendimento, não alteração de
critério do negócio.

### Liberações (tela `Administração → Liberações de Alteração`)

Comprador, Analista e SAR só alteram enquanto houver liberação ativa. Ela
**expira sozinha** (padrão 8 h, teto 72 h) de propósito: uma permissão de
escrita concedida para resolver uma pendência, se não expirasse, ficaria aberta
por esquecimento e o portão viraria enfeite. Para escrita permanente, mude o
perfil no cadastro em vez de liberar por tempo.

Cada liberação registra quem concedeu, quando, até quando e o motivo. Uma por
usuário: conceder de novo encerra a anterior, para não sobrar uma pilha de
prazos sobrepostos difícil de auditar.

O selo no topo (`SeloEscrita`) diz a cada um o que ele pode fazer agora —
"Somente visualização", "Altera com confirmação", "Liberado · 1 h 40 min".

### O perfil FORNECEDOR

É o único perfil de **fora** da CHOK, e por isso tem travas próprias:

1. **Vínculo obrigatório.** `usuarios.fabricante` define o que ele enxerga. Sem
   vínculo, `scope_filters` devolve uma chave impossível e a consulta volta
   vazia — nunca "tudo". A tela mostra a pendência em vez de dados.
2. **Lista de permissão por rota.** `FORNECEDOR_PERMITIDO`, em `security.py`,
   libera apenas `/api/auth/`, `/api/twofa/`, `/api/insights/visual/` e o
   próprio estado de escrita. A regra é invertida: para ele tudo é negado,
   menos o que a lista libera. Boa parte das rotas internas usa só
   `get_current_user`, então conferir permissão uma a uma deixaria uma pendente
   no primeiro endpoint novo — e a falha seria silenciosa.
3. **Margem nunca.** Ele não tem `margin.view` em combinação alguma, e o campo
   não sai do servidor.

Por padrão ele também não recebe o ranking por vendedor nem a comparação por
equipe: isso é estrutura interna da CHOK.

### Antes de subir: rodar a migration

```bash
python backend/migrate.py
```

`backend/sql/perfis.sql` é aditivo e idempotente: cria `metas_fabricante`,
`produtos_foco`, `acessos_fabricante` e `liberacoes_escrita`, acrescenta
`usuarios.fabricante` e remapeia o papel `GERENTE`. **É obrigatório**: as
consultas de usuário já leem a coluna nova.

---

## Identidade visual do Grupo Arantes

O padrão sai do Manual de Identidade Visual do grupo. Onde o manual se
contradiz — o hex **escrito** no texto não bate com a cor **desenhada** nas
amostras e no logo — vale o desenhado, porque é o que aparece ao lado da
interface:

| | Escrito no manual | Desenhado e no logo |
| --- | --- | --- |
| Azul (Pantone 307C) | #31729B (não usar) | **#2A4C7F** |
| Turquesa (Pantone 638C) | #00B9CF (não usar) | **#44ABAA** |

### Cores

A paleta vive em `src/context/ThemeContext.tsx`, nos dois temas: claro (fundos
neutros quentes) e **Noite Arantes** (`#0A0E14`). Três regras que ela carrega:

- **Todo par texto/fundo passa de 4,5:1 nos dois temas.** A turquesa pura
  (`brandTurquesa`) é decorativa no claro — sobre branco dá 2,7:1; para texto e
  botão existe `accentTeal`, que é a versão legível.
- **Cor de status nunca é cor de marca.** `success`, `warning`, `danger` e
  `info` são vivas e separadas do azul institucional, que é sóbrio. O azul de
  informação é céu; o da marca é marinho.
- **O degradê é só da marca** — login, faixa do topo e ícone de app. Nunca em
  fundo de card, de seção ou em texto.

O token `primaryForeground` existe porque no tema escuro a cor principal é um
azul clareado (`#809CC6`): texto branco sobre ele não alcança 4,5:1, então lá o
texto sobre a cor principal é quase preto.

### Tipografia

O manual pede Gotham (paga) e Segoe UI (não pode ser embutida em site). Nas
telas fica assim:

| Fonte | Papel |
| --- | --- |
| **Montserrat** | títulos e destaques, no lugar da Gotham |
| **Segoe UI** | texto e números de negócio (nativa no Windows, Android e Mac) |
| **JetBrains Mono** | só carimbo de máquina: NF, chave, placa, hora, código |

As duas embutíveis vêm por `@fontsource-variable` em `src/main.tsx`, **nunca por
link do Google Fonts**: assim funcionam sem internet externa e nenhum dado de
navegação sai para um terceiro só para carregar uma fonte. Números de indicador
ficam na Segoe UI com algarismos tabulares — a Montserrat perde o alinhamento
tabular em alguns pesos e desalinha as colunas.

Saíram do projeto: Inter e Space Grotesk.

### Marca

Os SVGs oficiais estão em `public/img/marca/` e são usados **como imagem**,
nunca colados dentro do HTML: o SVG do Illustrator tem classes internas
(`.cls-1`, `.cls-2`…) que colidem quando dois logos entram inline na mesma
página.

- **Login** (`LoginView`): duas colunas — o painel da marca no degradê oficial,
  com logo, chamada e selo "uso interno", e o acesso sobre o fundo neutro. No
  celular a coluna da marca vira uma faixa curta no topo, para o formulário não
  sair da primeira dobra.
- **Faixa do topo** (`.faixa-marca` no `index.css`): degradê azul sereno, brilho
  à esquerda, símbolo apagado entrando pela direita e fio turquesa embaixo.
  Dentro dela os controles são claros sobre azul (`naFaixa` em `GlobalSearch` e
  `SessionTimer`); popover e diálogo abertos dali saem da faixa e voltam ao tema
  normal, e é assim que deve ser.
- **Menu lateral e rodapé**: nome próprio do produto em Montserrat 700 mais o
  endosso "Grupo Arantes". As palavras do logotipo nunca são trocadas pelo nome
  do produto.
- **Ícone e favicon**: símbolo branco sobre o degradê (`favicon.svg`), com
  `theme-color` por tema (`#f8f8f7` claro, `#0a0e14` escuro).

## Visual Fabricantes

Tela nova (`Comercial → Visual Fabricantes`), construída a partir do PRD da
Plataforma CHOK de Desenvolvimento de Fabricantes. Reúne, por fabricante e por
período, o que antes exigia consolidar planilhas na mão.

**Arquivos:** `backend/app/routers/visual_fabricantes.py`,
`src/lib/visualFabricantes.ts`, `src/pages/manufacturers/VisualFabricantes.tsx`
e `src/pages/manufacturers/visualShared.tsx`.

| Aba | O que entrega |
| --- | --- |
| Visão geral | Valor, meta, atingimento, falta para a meta, clientes, ticket, margem e evolução mensal com acumulado |
| Comparação | Equipes e vendedores A/B por chave, com movimento (entrou/saiu/cresceu/caiu) + categorias e linhas do sortimento |
| Rankings | Vendedores e clientes/redes, com participação sobre o total filtrado e exportação para Excel |
| Clientes a recuperar | Compra em A sem recompra em B + clientes sem positivação no fabricante |
| Produtos foco | Itens acompanhados e a referência de clientes de cada um |
| Metas | Meta financeira por fabricante e datas exatas, gravada no servidor |
| Margens | Margem ponderada pelo valor, com busca e paginação de 100 (só com `margin.view`) |
| Acessos | Histórico de consultas: quem, qual fabricante, quando e resultado |

### Três regras que valem para a tela inteira

**Ausência não é zero.** Indicador sem base aparece como traço **com o motivo ao
lado**, nunca como `0`. Sem meta cadastrada, o atingimento é *indisponível* — não
0%, que afirmaria um desempenho que ninguém mediu. Sem percentual na origem, a
margem é um traço — não 0%.

**Margem ponderada, não média simples.** `Soma(percentual × valor) ÷ soma dos
valores elegíveis`. R$ 100 a 10% e R$ 900 a 20% dão 19%, não 15%. Denominador
zero devolve indisponível.

**Precedência da carga.** `indicadores_fabricante` às vezes recebe o mesmo
fechamento regravado em várias `data_referencia` — somá-las duplicaria o valor.
O servidor detecta (várias datas no mês somando exatamente o mesmo total), passa
a usar só a carga mais recente de cada mês e **diz na tela** que fez isso. O
seletor "Precedência da carga" permite forçar `soma` ou `ultima_carga`.

### O que a base de hoje não sustenta

Nada é preenchido com valor fictício; cada bloco diz de onde veio e o que falta:

- **`top_clientes` não tem coluna `fabricante`.** Sem ela não dá para afirmar
  que um cliente deixou de comprar *daquele* fabricante: o ranking de clientes e
  o cruzamento de recuperação voltam indisponíveis, com o motivo escrito. O
  bloco "clientes sem positivação", que vem de `nao_positivados_vendedor`, não
  depende disso e continua respondendo.
- **Cobertura por produto foco** exige venda no nível do item, que ainda não é
  carregada: a referência de clientes aparece, o atendido fica indisponível.
- **Pedidos distintos** não existem nesta base, então o ticket é por cliente
  atendido — e a tela diz isso embaixo do número.

### Clientes a recuperar

A recompra é conferida em **toda a base do fabricante** no período B, não só na
carteira do vendedor de A: cliente que voltou a comprar com outro vendedor não
aparece como perdido. Os períodos precisam ser cronológicos e sem sobreposição —
fora disso a rota responde 400 em vez de devolver uma lista que parece válida.
Vendedor, equipe e última compra referem-se a A e não representam a
responsabilidade atual.

### Rankings e exportação

A tela destaca 20 grupos; o Excel leva **todos** os grupos com valor positivo. A
participação usa o valor total do recorte, não o dos destacados — por isso somar
o Top 20 pode dar menos de 100%, e a tela avisa.
