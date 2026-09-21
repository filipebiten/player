# Changelog

Formato: mais recente primeiro. Datas em AAAA-MM-DD.

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
- A API Key passa a ficar em `fp-config` (o app migra sozinho o valor antigo de `fp-state`).
- `resolveChannelId`, `fetchChannelVids` e `searchVids` reaproveitadas; agora tratam erros da API (`error` no JSON), filtram vídeos privados/apagados e trazem 10 vídeos por canal.

### Para testar no iPhone
1. Abrir o PWA (feche por completo e reabra se estiver com a versão antiga): deve entrar direto na semana de hoje.
2. Tocar num vídeo: deve abrir o **app do YouTube** (se abrir no Safari, avisar).
3. Marcar um canal como concluído, abrir o app no computador e recarregar: deve aparecer concluído.
4. Desmarcar no computador, voltar ao iPhone: deve aparecer desmarcado.
5. Polegar: abas embaixo e o botão "Marcar canal concluído" devem ser alcançáveis com uma mão; o topo não pode ficar sob o notch.
6. Editar "onde parei" num curso e conferir no computador.
