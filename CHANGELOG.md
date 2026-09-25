# Changelog

Formato: mais recente primeiro. Datas em AAAA-MM-DD.

## 2.3.3 — 2026-09-25

### Corrigido
- **Tela principal não atualizava sozinha após marcar/desmarcar canal nos Ajustes:** fechar o Ajustes só fechava o `<dialog>`, sem re-renderizar a lista de canais — podia mostrar "Nenhum canal marcado" até a próxima ação. `close-settings` e o fim do sync agora chamam `render()` com `clampSel()` (corrige também `S.sel` apontando pra fora quando o grupo atual encolhe).

### Testes
- `lib.test.mjs`: cobertura pra `pruneProgress` mantendo `channels` intacto, `mergeProgress` comutativo com `channels`, e `migrateWeeksChannels` indexando por `channelId` quando o canal tem `channelId` e `handle` juntos.

## 2.3.2 — 2026-09-24

### Corrigido
- **Relogin silencioso do Google ao reabrir Ajustes:** o token do OAuth só vive em memória (nunca `localStorage`), então recarregar a página sempre pedia clicar "Conectar com Google" de novo, mesmo com o consentimento do Google ainda válido. Agora uma flag local (sem token, sem segredo) registra que o usuário já conectou antes e o Ajustes tenta relogar sem popup automaticamente ao abrir; só mostra o botão "Conectar" se essa tentativa falhar de verdade.

### Adicionado
- Diagnóstico nos Ajustes agora mostra também quantos canais estão marcados no rodízio (além de canais concluídos e vídeos assistidos) — ajuda a comparar aparelhos.

## 2.3.1 — 2026-09-23

### Adicionado
- **Canal por busca, direto nos Ajustes:** em Ajustes → Canais do rodízio, campo "Nome ou link de busca do YouTube" adiciona um canal sem inscrição (ex.: pregador sem canal próprio, como já era "Andrea Vargas"). Aceita link `youtube.com/results?search_query=...` ou o termo puro. Distribuição de grupo automática, igual aos canais via OAuth. Custa 100 unidades de cota por carga (canal normal custa 1) — usar com moderação.

## 2.3.0 — 2026-09-22

### Adicionado
- **Gestão de canais via OAuth do Google:** em Ajustes → Canais do rodízio, conecte sua conta do Google e marque quais canais inscritos entram no rodízio. Distribuição automática entre os 4 grupos (sempre o grupo com menos canais). Login silencioso nas próximas vezes (sem popup), enquanto a conta continuar logada no navegador. A lista de canais passou a ordenar por nome (`localeCompare`) em vez da ordem antiga de `data.js`.
- `data.js` (`WEEKS`) deixa de ser lido em runtime — vira só a semente da migração automática na primeira carga de cada aparelho (os 27 canais atuais nascem pré-marcados, mesmos grupos de hoje).

## 2.2.0 — 2026-09-22

### Alterado
- **Semana real em vez de bloco de dia-do-mês:** a parte da vez agora é calculada por semana-calendário real (segunda a domingo), em rotação contínua entre as 4 partes — nunca reseta por mês, e um mês com 5 semanas-calendário só continua o ciclo em vez de empurrar dias extras pra última parte. `done` (canal concluído) passa a resetar por semana real em vez de mês. Efeito colateral esperado: na primeira sincronização de cada aparelho depois desse update, `pruneProgress` descarta as marcas de "canal concluído" antigas (formato `"AAAA-MM-N"`, que não bate mais com o novo formato `"w<N>"`) — autolimpeza normal, já que "concluído" mesmo no sistema antigo resetava a cada poucas semanas.
- **Sem "Semana N" na tela principal:** o cabeçalho mostra "Canais desta semana" (grupo de hoje) ou "Outro grupo de canais" (ao navegar manualmente). O seletor 1-4 virou duas setas. Teclas `[` `]` continuam navegando entre os 4 grupos.

## 2.1.2 — 2026-09-21

Auditoria `pwa-development`.

### Corrigido
- **Manifest completo:** `id` (igual ao `start_url`, então a identidade do app instalado não muda), `scope` e `lang: pt-BR`; ícones declarados com `purpose` (`any` e `maskable`). O `icon-512.png` já servia de maskable (fundo opaco `#0B0E14`, círculo âmbar dentro da zona segura de 80%), então não há arquivo novo.
- Verificado offline: `index.html` (o `start_url`), `index.html?source=pwa` e a raiz abrem pelo service worker.

## 2.1.1 — 2026-09-21

Achados do `ux-audit` no app publicado (390 e 1440 px, axe 0 violações, console e CLS limpos).

### Corrigido
- **`/favicon.ico` dava 404** em navegador de computador (só existia `apple-touch-icon`). Agora há `<link rel="icon">`.
- **Erro "API Key inválida" era beco sem saída:** só texto. Agora a caixa de erro tem o botão **Abrir Ajustes** (44 px de altura).

## 2.1.0 — 2026-09-21

### Adicionado
- **Mostrar mais vídeos:** botão no fim da lista do canal busca mais 10 vídeos por vez (1 unidade de cota cada; canal de busca custa 100). A lista estendida fica no cache.
- **Próximo não assistido:** botão que abre no YouTube o vídeo mais novo que você ainda não marcou.
- **Service worker:** o app abre offline (interface e última lista de vídeos). Network-first: sempre pega a versão nova quando há rede.
- **Validação do token do Gist ao salvar:** mensagem clara para token fine-grained, inválido/expirado ou sem o escopo `gist`.
- **Indicador de sincronização sempre visível:** nuvem riscada quando desligada (toque abre Ajustes). Em Ajustes: id curto do gist e contagem de marcações neste aparelho, para comparar os dois dispositivos.

### Corrigido
- Sincronização: na v2.0 nenhum aparelho chegou a criar o gist (a conta tinha 0 gists) e o app não dava nenhuma pista, porque quem já tinha a API Key nunca via a tela inicial com o campo do token. CORS e CSP de produção foram verificados e estão corretos; a causa exata nos aparelhos do Filipe dependia do que o Ajustes mostrava, e agora o app mostra.
- Botão de sincronização com 34 px de largura no celular (agora 44 px).

## 2.0.0 — 2026-09-21

Reformulação focada em usabilidade no celular (iPhone, PWA) e no computador.

### Adicionado
- **Semana automática pelo dia do mês** (1–7 → Semana 1, 8–14 → 2, 15–21 → 3, 22+ → 4). O app abre sempre na semana de hoje; o seletor 1–4 fica na lista de canais (sem modal).
- **Progresso persistente:** check "assistido" por vídeo (indexado por `videoId`) e "concluído nesta semana" por canal (indexado por `ano-mês-semana`, zera sozinho no mês seguinte). Vídeo assistido fica esmaecido; canal concluído aparece marcado na lista; barra de progresso da semana.
- **Cache de 6 horas** da lista de vídeos por canal, botão **Recarregar** e cache permanente do `channelId` resolvido. Em caso de erro (cota, rede) mostra a última lista salva.
- **Cursos:** "onde parei" editável dentro do app e rodízio salvo ("Vez agora" / "Passar a vez").
- **Sincronização entre aparelhos** via Gist secreto (token clássico com escopo `gist`, opcional). Merge por timestamp: desmarcar em um aparelho vale no outro. Sem token, funciona só local.
- **Layout responsivo:** celular em coluna única com abas embaixo e botão de concluir ao alcance do polegar; desktop em duas colunas (canais à esquerda, vídeos à direita).
- **Atalhos de teclado (desktop):** `J`/`K`, `Espaço`, `[` `]`, `R`, `1`/`2`, com legenda visível só onde há mouse.
- **Segurança:** Content-Security-Policy restringindo destinos de rede; escape de HTML em todo texto vindo de API.
- **Acessibilidade:** link "Pular para o conteúdo", foco visível, `<dialog>` nativo nos Ajustes, contraste do texto secundário corrigido (`#6B7280` → `#9CA3AF`), zoom liberado.
- Testes: `tests/lib.test.mjs` (lógica pura) e `tests/e2e/` (cenários de navegador contra mocks).
- Documentação: `CLAUDE.md` (guia para sessões futuras), README com o passo a passo do token do Gist.

### Removido
- Player embutido (YouTube IFrame API), controle de velocidade e avanço automático de vídeo: agora clicar no vídeo abre o YouTube em nova aba.
- Aba **Ao Vivo** (`fetchLiveStreams`): a busca de lives custava 100 unidades de cota por canal.
- Modal de configurações para escolher a semana.

### Alterado
- Código separado em `index.html` + `styles.css` + `data.js` + `lib.js` + `app.js`. Listas `WEEKS` e `PLATFORMS` movidas para `data.js` **sem alteração** (conferido com `diff`).
- Visual: a cor de cada plataforma nos cursos virou um ponto ao lado do nome (era uma borda grossa no lado do cartão), e o canal selecionado na lista usa um anel fino em vez de barra lateral.
- A API Key passa a ficar em `fp-config` (o app migra sozinho o valor antigo de `fp-state`).
- `resolveChannelId`, `fetchChannelVids` e `searchVids` reaproveitadas; agora tratam erros da API (`error` no JSON), filtram vídeos privados/apagados e trazem 10 vídeos por canal.

### Para testar no iPhone
1. Abrir o PWA (feche por completo e reabra se estiver com a versão antiga): deve entrar direto na semana de hoje.
2. Tocar num vídeo: deve abrir o **app do YouTube** (se abrir no Safari, avisar).
3. Marcar um canal como concluído, abrir o app no computador e recarregar: deve aparecer concluído.
4. Desmarcar no computador, voltar ao iPhone: deve aparecer desmarcado.
5. Polegar: abas embaixo e o botão "Marcar canal concluído" devem ser alcançáveis com uma mão; o topo não pode ficar sob o notch.
6. Editar "onde parei" num curso e conferir no computador.
