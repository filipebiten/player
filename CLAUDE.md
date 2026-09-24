# FlowPlayer — guia para sessões futuras do Claude Code

Leia este arquivo inteiro antes de mexer em qualquer coisa. Ele foi escrito para quem chega sem contexto.

## O que é

App web pessoal do Filipe para acompanhar **canais do YouTube** e **cursos online** em **rodízio semanal**. Ele usa no iPhone (instalado como PWA) e no computador. Repo público: `github.com/filipebiten/player`, publicado no GitHub Pages em `https://filipebiten.github.io/player/`.

Uso: a cada semana real há um grupo de canais. Filipe abre o canal, escolhe um vídeo, assiste no YouTube e marca. Quando termina o canal, marca "concluído nesta semana". Nos cursos, anota "onde parei" e passa a vez para a próxima plataforma.

## Restrições que não mudam

- **Estático, sem build, sem framework, sem dependência paga.** Tem que rodar no GitHub Pages como está. Nada de npm no app (o `node` só roda o teste de `lib.js`).
- **Identidade visual:** fundo `#0B0E14`, destaque âmbar `#F59E0B`, fonte Outfit, ícones `icon-192.png` e `icon-512.png`. Tokens em `:root` de `styles.css`.
- **Nenhuma chave ou token no repo** (ele é público). API Key e token do Gist ficam só no `localStorage` de cada aparelho. Exceção: o **OAuth Client ID** do Google, hardcoded em `oauth.js` — não é segredo, é seguro publicar (é assim que todo exemplo oficial do Google faz); o que é secreto é o token de acesso, que nunca é persistido.
- Sem animações decorativas (o `prefers-reduced-motion` é respeitado).

## Estrutura de arquivos

| Arquivo | Papel |
|---|---|
| `index.html` | Casca: meta tags do PWA, **CSP**, `<div id="app">`, `<dialog id="settings">`, carrega os scripts nesta ordem: `data.js` → `lib.js` → script do GIS (`accounts.google.com/gsi/client`) → `oauth.js` → `app.js`. |
| `data.js` | **Listas `WEEKS` (canais) e `PLATFORMS` (cursos).** Hoje só é semente da migração automática de canais (ver "Onde editar canais") — `PLATFORMS` (cursos) continua editado aqui. |
| `lib.js` | Lógica **pura** (sem DOM nem rede): semana pela data real, chaves de progresso, merge, poda, datas, TTL do cache. Vai para `window.FP` no navegador e `module.exports` no Node. **Tem testes.** |
| `oauth.js` | Wrapper do Google Identity Services (modelo "token", client-side puro, sem backend) — só pra listar as inscrições do YouTube via OAuth. Expõe `window.FPAuth`. O Client ID não é segredo (seguro publicar num repo público); o token de acesso fica só em memória. |
| `app.js` | Estado, chamadas à API do YouTube, cache, progresso, sync do Gist, render (`innerHTML` + delegação de eventos por `data-action`), atalhos. |
| `styles.css` | Tokens, componentes e layout. Mobile primeiro; duas colunas a partir de `min-width: 900px`. |
| `sw.js` | Service worker: o app abre offline. Network-first (ver "Service worker"). |
| `manifest.json`, `icon-*.png` | PWA. Não mexer sem motivo. |
| `tests/lib.test.mjs` | Testes de `lib.js`: `node tests/lib.test.mjs`. |
| `tests/e2e/` | Ambiente e cenários de teste no navegador (ver "Como testar"). |
| `README.md` | Para o Filipe: como configurar chave, token e instalar no iPhone. |
| `CHANGELOG.md` | Histórico. Atualize a cada mudança. |

`app.js` é um arquivo só de propósito. Não quebre em módulos ES nem introduza bundler.

## Regras fechadas

### Semana automática
`FP.weekIndexForDate(date)` = `((FP.weeksSinceEpoch(date) % 4) + 4) % 4`. `weeksSinceEpoch` conta semanas-calendário inteiras (segunda a domingo) desde uma âncora fixa (segunda-feira 1970-01-05) — cresce 1 por semana real, para sempre, sem reset por mês nem descontinuidade em virada de ano (mesmo em anos com 53 semanas ISO). O app **sempre abre no grupo da semana de hoje**; navegar manualmente não é salvo. Navegação entre grupos: setas `.weeknav` na lista de canais e teclas `[` `]` (clamped em 0-3, não dá volta). Se o app voltar ao primeiro plano numa semana diferente, reposiciona (`visibilitychange`). Não há mais rótulo "Semana N" na tela principal — o texto é "Canais desta semana" (grupo de hoje) ou "Outro grupo de canais" (navegou manualmente). A fórmula antiga por bloco de dia-do-mês (`min(3, floor((diaDoMês-1)/7))`, v2.0-2.1) foi removida: não coincidia com semanas-calendário reais quando o mês não começava numa segunda. Não volte a ela.

Os "4 grupos" que giram por semana agora vêm de `progress.channels` (não mais de `WEEKS` direto) — ver "Onde editar canais". Nos Ajustes eles aparecem como "Grupo A/B/C/D"; na tela principal, nunca com número.

### Modelo de dados do progresso

**`localStorage` (por aparelho):**

| Chave | Conteúdo | Sincroniza? |
|---|---|---|
| `fp-config` | `{apiKey, gistToken, gistId}` | **Nunca** |
| `fp-progress` | progresso (formato abaixo) | Sim, via Gist |
| `fp-vidcache` | `{ "<channelKey>": {t, vids:[{id,title,thumb,published,channel}], next, uploads} }` — `next` = pageToken da próxima página (`""` = acabou), `uploads` = playlist de envios. Entradas sem `next` (v2.0) são descartadas no load. | Não |
| `fp-chid` | `{ "<handle>": "<channelId>" }` (não expira) | Não |
| `fp-ui` | `{tab}` | Não |
| `fp-state` | **legado**: a v1 guardava a API Key aqui. Migrado para `fp-config` e apagado no primeiro load. | — |

**`fp-progress` = conteúdo do arquivo `flowplayer-progress.json` no Gist:**

```json
{
  "v": 1,
  "watched": { "<videoId>": { "t": 1789995575282, "on": true } },
  "done":    { "2026-09-3": { "<channelKey>": { "t": 1789995600000, "on": true } } },
  "courses": { "Hotmart|Investidor 33 Dias": { "t": 1789995606223, "lastLesson": "Módulo 7, aula 3" } },
  "rot":     { "t": 1789995606448, "p": 1, "c": 0 },
  "channels": { "thejesuscopy": { "t": 1789995600000, "on": true, "group": 0, "name": "JesusCopy", "type": "channel", "handle": "thejesuscopy" } }
}
```

- `watched`: check por vídeo, indexado por `videoId`.
- `done`: chave `w<N>` (`FP.doneKey`), onde `N` é `weeksSinceEpoch` — uma chave por semana-calendário real. Muda sozinha toda semana, então quando um grupo volta a aparecer (~4 semanas depois) o progresso já nasce zerado. A chave interna é o `channelKey`.
- **`channelKey`** = `channelId` ‖ `handle` ‖ `query` (`FP.channelKey`). **Nunca o índice** na lista. Por isso reordenar `WEEKS` não quebra o progresso, mas **renomear handle/channelId/query zera o progresso daquele canal**.
- `courses`: chave `"<nome da plataforma>|<nome do curso>"`. `lastLesson` no `PLATFORMS` é só o **valor inicial**; depois de editado no app vale o salvo.
- `rot`: rodízio dos cursos (`p` = índice da plataforma da vez, `c` = índice do curso).
- **Desmarcar** grava `{t, on:false}` (túmulo), nunca apaga a chave. Sem isso o merge ressuscitaria a marca vinda do outro aparelho.
- **Merge** (`FP.mergeProgress`): por chave, vence o `t` maior. Comutativo e idempotente (testado). Depois do merge, `FP.pruneProgress` descarta `watched` com mais de 180 dias e `done` com mais de 400 dias.

### Sincronização (Gist)
- Token **clássico** com escopo **só `gist`**, colado uma vez por aparelho (Ajustes ou tela inicial). Sem token o app funciona só local, sem erro nem aviso.
- Primeiro aparelho: `POST /gists` (`public:false`). Os outros: `GET /gists` procurando o arquivo `flowplayer-progress.json`; se houver mais de um gist com esse arquivo, todos usam o **mais antigo** (`created_at`).
- Quando sincroniza: ao abrir, ao voltar para o app (`visibilitychange`), ao voltar a conexão (`online`), e **2 s depois de cada marcação** (debounce em `scheduleSync`).
- Fluxo de `syncNow`: lê o remoto → **faz o merge e monta o corpo do PATCH sem nenhum `await` no meio** (marcações feitas durante a rede não se perdem) → só faz `PATCH` se o remoto for diferente. Gist apagado (404) → procura/cria de novo. Os `GET` usam `cache: "no-cache"` porque o GitHub serve gist com `max-age=60` e o outro aparelho leria dado velho.
- Limite conhecido: dois aparelhos gravando no mesmo segundo podem sobrescrever um ao outro no Gist; cada um mantém o local e a próxima sincronização repõe. Aceito.
- A API Key **nunca** vai para o Gist.
- **Validação ao salvar o token** (`checkToken`): recusa na hora token fine-grained (`github_pat_…`, que não acessa gists), token inválido (401) e token sem o escopo `gist` (lê o cabeçalho `X-OAuth-Scopes`, exposto pelo CORS do GitHub). A mensagem aparece dentro do formulário. Sem conexão para validar: salva e deixa o sync mostrar o erro depois.
- **Indicador no topo:** nuvem riscada = sync desligado (sem token; toque abre Ajustes); nuvem = ok/sincronizando; alerta vermelho = erro (a mensagem está no `aria-label` e em Ajustes). Ajustes mostra também o id curto do gist e quantas marcações há **neste aparelho**: compare os dois aparelhos para ver se estão no mesmo gist.
- Diagnóstico de campo: `gh api /gists --jq length` (0 = nenhum aparelho conseguiu criar o gist). Foi assim que se descobriu, na v2.0, que a sincronização nunca tinha rodado.

### Cache de vídeos
- Por canal, **6 horas** (`FP.CACHE_TTL`), em `fp-vidcache`. Abrir um canal com cache fresco não gasta cota. Botão **Recarregar** (e tecla `R`) ignora o cache.
- Erro (cota, rede) com cache velho: mostra a lista salva + aviso.
- `channelId` resolvido a partir do handle fica em `fp-chid` para sempre (o fallback por `search` custa 100 unidades de cota).
- Cota do YouTube: 10.000 unidades/dia. `channels` e `playlistItems` custam 1 cada. `search` custa 100 (só usado no canal do tipo `search`, "Andrea Vargas", e no fallback de handle).
- Filtra vídeos "Private video" e "Deleted video". Traz 10 vídeos por canal na primeira carga.
- **"Mostrar mais vídeos"** (`loadMore`): busca a próxima página (mais 10) usando `next` e `uploads` do cache (1 unidade de cota; no canal do tipo `search` custa 100) e **acrescenta** à lista em cache. Recarregar (ou cache vencido) volta para a primeira página.
- **"Próximo não assistido"**: link (`<a>`, abre no app do YouTube) para o vídeo **mais novo ainda não marcado** entre os já carregados (a lista vem do mais novo para o mais antigo). Não marca nada sozinho.

### O que foi removido, e por quê
- **Player embutido (YouTube IFrame API), controle de velocidade, "próximo vídeo" automático:** decisão do Filipe: clicar no vídeo abre o YouTube em nova aba (no iPhone, no app do YouTube). **Não reintroduzir.**
- **Aba "Ao Vivo" (`fetchLiveStreams`):** usava `search?eventType=live`, que custa 100 unidades de cota por canal por chamada (cota gratuita: 10.000/dia). **Não reintroduzir.**
- **Modal de configurações para trocar de semana:** a semana é automática; o seletor agora fica na lista.
- **Zoom bloqueado (`user-scalable=no`):** removido por acessibilidade. Os inputs têm 16 px para o iOS não dar zoom ao focar.

### Layout
- **Celular (<900 px):** uma tela por vez. Lista de canais → toque abre a tela do canal (`data-view="channel"`, com `history.pushState` para o gesto de voltar). Abas Vídeos/Cursos **embaixo** (`.tabs` fixo). Botão principal "Marcar canal concluído" na `.dock`, acima das abas, ao alcance do polegar. Alvos de toque ≥ 44–48 px.
- **Desktop (≥900 px):** duas colunas (`.split`): canais à esquerda, vídeos do canal à direita em grade de cartões. Abas viram navegação do topo. Sem largura máxima de 640 px.
- **Atalhos** (só desktop; a legenda `.legend` some sem mouse): `J`/`K` canal, `Espaço` marcar canal concluído, `[` `]` semana, `R` recarregar, `1`/`2` abas.
- Seleção de canal e tela atual **não** vão para a URL (o app deve abrir sempre na semana de hoje). Decisão consciente.

### Service worker (`sw.js`)
- **Network-first** para os arquivos do próprio site: com rede, sempre busca a versão nova e atualiza o cache; sem rede (ou se passar de 3 s), usa o cache. Por isso **não há versão para incrementar a cada publicação** (cache-first prenderia usuários na versão velha).
- Fontes do Google: cache primeiro. APIs (YouTube, GitHub) **nunca** passam pelo service worker.
- Pré-cache na instalação (`FILES` em `sw.js`): **se criar um arquivo novo na raiz que o app precisa, coloque-o em `FILES` e em `tests/e2e/setup.sh`** (a cópia de teste usa lista fixa).
- A CSP tem `worker-src 'self'`. Registro em `app.js` (evento `load`).
- Só o shell e os textos da lista funcionam offline; as thumbnails do YouTube não são cacheadas.

### Segurança
- **Todo texto vindo de API/dados passa por `FP.escapeHtml` (`esc()`) antes de entrar em `innerHTML`.** Mantenha isso ao adicionar campos.
- **CSP** em `index.html` (meta): `connect-src` inclui `googleapis.com`, `api.github.com`, `gist.githubusercontent.com` e `accounts.google.com/gsi/` (OAuth); `script-src` é `'self'` mais `accounts.google.com/gsi/client` (script do GIS); há também `frame-src https://accounts.google.com/gsi/` pro popup de login. Se adicionar um domínio (fonte, API, imagem), **atualize a CSP** ou o recurso será bloqueado.
- Links externos: `target="_blank" rel="noopener noreferrer"`.
- O token com escopo `gist` lê e escreve todos os gists do Filipe (não existe escopo menor). Fica só em `fp-config`. Nunca logue nem exiba o token.

## Onde editar canais

**Não edite mais `data.js` pra canais do dia a dia.** Ele só serve como semente da migração automática (`FP.migrateWeeksChannels`, chamada uma única vez, na primeira carga de cada aparelho que ainda não tem `progress.channels`). Depois disso, `WEEKS` nunca mais é lido em runtime.

Canais são adicionados/removidos pelo app: **Ajustes → Canais do rodízio → Conectar com Google**, que lista as inscrições do YouTube (via OAuth, `oauth.js`) e deixa marcar quais entram. A distribuição entre os 4 grupos é automática (`FP.assignGroup`: sempre o grupo com menos canais `on`).

O estado fica em `progress.channels` (dentro do mesmo `fp-progress`/Gist de sempre): mapa `channelKey -> {t, on, group, name, type, channelId?, handle?, query?}`, mesmo padrão de merge por timestamp de `watched`/`done`/`courses`. **channelKey dos 27 canais migrados de `data.js` continua sendo `channelId‖handle‖query`, exatamente como antes** — preserva `watched`/`done` de quem já usava o app antes desta mudança. Canais adicionados via OAuth depois disso sempre usam `channelId` puro (é tudo que a API de inscrições devolve).

Cursos (`PLATFORMS`) continuam em `data.js`, sem mudança.

## Como publicar

GitHub Pages serve a branch `main` (pasta raiz). Publicar = `git push origin main`; leva cerca de 1 minuto. Confirme com o Filipe antes de dar push (ele usa o app no dia a dia). Depois de publicar, no iPhone o PWA pode segurar a versão antiga: feche o app por completo e reabra.

## Como testar

1. Lógica pura: `node tests/lib.test.mjs` (tem que imprimir só linhas `ok`).
2. No navegador, em **390 px** (celular) e **1440 px** (desktop), com as skills **`webapp-testing`** e **`agent-browser`**. Não há chave real de API nem token no ambiente de teste: tudo roda contra mocks.

```bash
tests/e2e/setup.sh            # sobe :8765 (site real), :8767 (cópia com CSP liberando o mock), :8766 (mock Gist+YouTube)
cd tests/e2e
bash week-and-a11y.sh         # semana por dia do mês (1,7,8,14,15,21,22,30) + axe em 390/1440
bash tap-targets.sh           # alvos de toque < 44 px (rode logo depois do anterior: reaproveita a sessão "a11y")
bash sync.sh                  # 2 aparelhos (sessões "phone" e "desk"): marca num, aparece no outro
bash sync-errors.sh           # sem token / token inválido / gist apagado / offline
bash api.sh                   # busca YouTube: cache 6h, TTL, cota estourada, canal tipo busca, escape de HTML
bash features.sh              # mostrar mais, próximo não assistido, validação do token, sync desligado, service worker offline
bash setup-flow.sh            # primeira execução: tela inicial com/sem token
./setup.sh stop
```

- `seed.js` injeta `fp-config` e um `fp-vidcache` fictício (27 canais × 6 vídeos) via `agent-browser eval`, para testar a interface sem rede.
- `redirect.js` (`--init-script`) redireciona `api.github.com` e `googleapis.com` para o mock local; `fakedate.js` simula uma data completa (`__fakeDate`, `"YYYY-MM-DD"`) — `__fakeDay` (dia do mês, set/2026 fixo) é mantido só por compatibilidade.
- Os scripts são **bash** (em zsh, `$A` com espaços não separa em palavras: rode com `bash arquivo.sh`).
- Para falar com o mock a partir do shell, use Python `urllib` (o `curl` pode ser bloqueado por hooks do Claude Code).
- Depois de mudar `app.js`, `styles.css` ou `index.html`, rode `setup.sh` de novo (ele recopia a cópia de teste).

**Teste que só o Filipe consegue fazer (dispositivo real):** ver o final do `CHANGELOG.md` da versão 2.0.0 (abrir vídeo no app do YouTube pelo PWA no iPhone, sync com token real, área segura/notch).

## Skills recomendadas para mexer no visual

Use as que o Filipe já tem instaladas, nesta ordem de utilidade:
- **`frontend-design`** e **`impeccable`**: direção visual e layout responsivo.
- **`minimalist-ui`** e **`anti-ui-slop`**: manter o visual editorial e sem cara de template.
- **`ui-styling`** e **`design-system`**: tokens de cor, espaçamento e tipografia (fica em `:root` de `styles.css`).
- **`mobile-app-ui-design`**: uso com uma mão, alvos de toque, navegação inferior (princípios, é PWA em HTML e não app nativo).
- **`web-design-guidelines`**: rodar no fim de qualquer mudança de UI (regras de acessibilidade, foco, formulários).
- **`webapp-testing`** e **`agent-browser`**: testar em 390 e 1440 px antes de dar por pronto.
- **`ux-audit`** e **`pwa-development`**: ver o Roadmap (prioridade).
- `ui-ux-pro-max` também está instalada (banco de estilos/paletas/guidelines de UX).
- Não usar `gsap`, `threejs` nem animação decorativa.

## Roadmap e estado atual (retomar daqui)

Atualizado em 2026-09-24.

### Já feito
- **v2.0.0 / v2.1.x (21/09):** reformulação completa + "Mostrar mais vídeos", "Próximo não assistido", service worker offline, validação de token, diagnóstico nos Ajustes. Publicado em `main`, no ar.
- **`ux-audit` e `pwa-development` no FlowPlayer publicado (21/09):** Conditional Pass, corrigido em v2.1.1/v2.1.2 (favicon, botão de erro de API Key, manifest com id/scope/lang/maskable).
- **App treino (treino-hibrido) e app financeiro (Bolso · Bittencourt) (21/09, noite):** `ux-audit` + `mobile-app-ui-design` + `pwa-development` + `harmonize` + `comprehensive-test` + `verify` já rodados nos dois. Treino: `c6a9dd4`. Bolso: `4b47e89` (achou bug real de Histórico negativo). Pendências próprias de cada um, não deste roadmap.
- **Semana real (22/09, `f673568`):** `FP.weekIndexForDate` passa a usar semana-calendário real (segunda-domingo) em vez de bloco de dia do mês; navegação vira setas sem número "Semana N" na tela principal.
- **Canais via OAuth do Google (22/09, `26666aa`..`0576626`):** nos Ajustes → "Canais do rodízio", conecta a conta do Google, lista inscrições do YouTube, marca quais entram no rodízio — a distribuição entre os 4 grupos é automática. `data.js`/`WEEKS` vira só semente de migração (não é mais editado pra canais do dia a dia). Estado em `progress.channels`, sincroniza pelo Gist como sempre. Revisão final (Opus) achou 1 Critical (canais migrados por handle não casavam com assinaturas OAuth por channelId — duplicava, não desmarcava) + 4 Important (docs desatualizadas, passo do Client ID só no plano, unhandled rejection no OAuth, popup fechado travava 20s) — todos corrigidos e reverificados em `0576626`, sem regressão. 25 testes de lógica pura `ok`; e2e completo (semana real, a11y/axe 0 violações, alvos de toque, sync, canais/OAuth mockado) passando.
- **Client ID real do OAuth colado e testado em aparelho real (22/09, `21f4405`):** Filipe conectou a conta do Google de verdade — 111 canais inscritos listados, marcar/desmarcar funcionou (grupo automático), sync com Gist real ok.
- **Canal por busca direto nos Ajustes (23/09, `d9a2770`):** em vez de converter "Andrea Vargas" pra canal real (ideia original), o Filipe preferiu poder adicionar canais por busca (sem inscrição no YouTube) direto pela UI — campo "Nome ou link de busca do YouTube" em Ajustes → Canais do rodízio, aceita link `youtube.com/results?search_query=...` ou termo puro (`FP.parseSearchQuery` em `lib.js`, testado). Usado ao vivo pra adicionar 9 pregadores/canais sem inscrição (Pedro Dulci, D. A. Carson, Dane Ortlund, Michael Reeves, Bryan Chapell, John Piper, Tim Keller, sermões de Billy Graham, Rev. Emilio Garofalo) — "andrea vargas" já existia e só foi reativada, sem duplicar (dedupe por `channelKey`). **Nota:** "Pedro Dulci" ficou com 2 entradas de propósito (canal real inscrito + a busca nova) — o Filipe decidiu deixar assim, não é bug.
- **Relogin silencioso ao reabrir Ajustes (24/09, `77484cd`):** o token do OAuth só vivia em memória, então todo reload forçava clicar "Conectar" de novo mesmo com consentimento do Google ainda válido — pendência da revisão do plano canais-oauth. Corrigido com flag device-local (`fp-config.oauthConnected`, sem token/segredo) que faz `openSettings()` tentar `prompt:""` automaticamente; só mostra o botão "Conectar" se a tentativa silenciosa falhar de verdade. `diagnostics()` também ganhou contagem de canais no rodízio (`5b668f9`). `CHANGELOG.md` atualizado com nota retroativa da ordem alfabética da lista (decisão do plano canais-oauth, nunca documentada).

### Pendências, em ordem
1. Achados menores da revisão final do plano canais-oauth, ainda deferidos (não bloqueiam, sem prazo):
   - A tela principal não re-renderiza sozinha depois de marcar/desmarcar um canal nos Ajustes (nem depois de um sync que encolhe um grupo) — pode mostrar "Nenhum canal marcado" até a próxima ação do usuário. Fix: re-render + clamp de `S.sel` ao fechar Ajustes e depois de sync.
   - `tests/lib.test.mjs` não cobre: `pruneProgress` mantendo `channels`, comutatividade do merge com `channels`, uma entrada de `migrateWeeksChannels` com `channelId` e `handle` juntos.

### Ideias em aberto (só se o Filipe pedir)
- **Segurança:** todos os apps de `filipebiten.github.io` compartilham o mesmo `localStorage`. Um XSS em qualquer app lê o token do gist daqui e vice-versa. Saída real: origem separada por app (domínio próprio). Rodar `claude-security` se ele quiser tratar.
- Mensagem de erro que separe `keyInvalid` de referrer bloqueado (API Key do YouTube).
- "Próximo não assistido" pelo **mais antigo** em vez do mais novo.
- Cachear thumbnails no service worker.
- Splash do iOS (`apple-touch-startup-image`) e instalar no Mac pelo Chrome — não verificado.

### Não fazer (decisões fechadas)
Player embutido, aba Ao Vivo, semana escolhida salva, estado na URL, `data-testid` em massa, framework/build.

### Como retomar numa sessão nova
1. Leia este arquivo inteiro e o `CHANGELOG.md`.
2. `git log --oneline | head` pra ver onde parou; `node tests/lib.test.mjs`.
3. Pendência 1 (canal "Andrea Vargas" de `search` pra `channel`) é a prioridade combinada com o Filipe. As demais são achados menores, sem prazo.
4. Próximo item da fila geral (fora deste app): nada — treino e Bolso já foram auditados em 21/09; ver os `CLAUDE.md`/handoff de cada um pras pendências próprias deles.
