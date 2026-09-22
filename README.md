# FlowPlayer

Seus canais do YouTube e cursos online em rodízio semanal, num app que roda no celular (PWA no iPhone) e no computador.

- **Vídeos:** os 4 grupos de canais rodam por semana real (segunda a domingo), em rotação contínua — nunca reseta por mês, um mês com 5 semanas só continua o ciclo. O app abre sempre no grupo de hoje.
- **Progresso:** marque cada vídeo como "assistido" e cada canal como "concluído nesta semana". O progresso zera sozinho quando o grupo volta a aparecer (~4 semanas depois).
- **Cursos:** rodízio de plataformas, com "onde parei" editável.
- **Sincronização:** o progresso vai para um Gist secreto do seu GitHub e aparece igual no celular e no computador.

Clicar num vídeo abre o YouTube em outra aba (no iPhone, no app do YouTube). Não há player dentro do app. Cada canal mostra os 10 vídeos mais recentes; **Mostrar mais vídeos** traz mais 10 por vez e **Próximo não assistido** abre o mais novo que você ainda não marcou.

O app funciona offline (abre com a última lista que você viu).

## Endereço

`https://filipebiten.github.io/player/`

## Instalar no iPhone

1. Abra o endereço acima no **Safari**.
2. Toque em **Compartilhar** → **Adicionar à Tela de Início**.

## Configurar (uma vez por aparelho)

Na primeira abertura o app pede a chave do YouTube e, se você quiser sincronizar, o token do Gist. Depois disso, tudo fica em **Ajustes** (ícone de controles no canto superior direito).

### 1. Chave da API do YouTube (obrigatória)

1. Abra o [Google Cloud Console](https://console.cloud.google.com/) e crie um projeto (ou use um existente).
2. Em **APIs e serviços → Biblioteca**, ative a **YouTube Data API v3**.
3. Em **Credenciais → Criar credenciais → Chave de API**, copie a chave.
4. **Recomendado:** clique na chave e, em **Restrições de aplicativo**, escolha **Sites** e adicione `https://filipebiten.github.io/*`. Em **Restrições de API**, escolha só a YouTube Data API v3. Assim a chave não serve em outro site.
5. Cole a chave no FlowPlayer.

A chave fica só no aparelho (`localStorage`) e nunca é enviada para o Gist. Cole em cada aparelho.

### 2. Token do Gist (opcional, para sincronizar)

Sem token o app funciona normalmente, só que o progresso fica em cada aparelho separado. **Cole o token nos dois aparelhos** (celular e computador): a tela inicial só aparece na primeira vez, então depois vai em **Ajustes**.

1. Abra este link (já vem com o escopo certo marcado): <https://github.com/settings/tokens/new?scopes=gist&description=FlowPlayer>
   Ou vá em GitHub → **Settings → Developer settings → Personal access tokens → Tokens (classic) → Generate new token (classic)**.
2. **Note:** `FlowPlayer`.
3. **Expiration:** escolha o prazo que preferir. Quando expirar, o app mostra "Token inválido ou expirado" e você gera outro.
4. Deixe marcado **somente `gist`**. Nada mais.
5. Clique em **Generate token** e copie o token (começa com `ghp_`). O GitHub só mostra uma vez.
6. No FlowPlayer: **Ajustes → Token do GitHub**, cole e toque em **Salvar ajustes**.
7. Repita o passo 6 em cada aparelho, com o mesmo token (ou um token novo por aparelho).

O que acontece:

- No primeiro aparelho, o app cria um Gist secreto chamado "FlowPlayer — progresso (não apague)", com o arquivo `flowplayer-progress.json`.
- Nos outros aparelhos, o app procura esse arquivo na sua conta e usa o que já existe.
- O app sincroniza ao abrir, ao voltar para ele e 2 segundos depois de cada marcação. O ícone de nuvem no topo mostra o estado.

**Não sincronizou?** Abra **Ajustes** nos dois aparelhos:

- A nuvem no topo aparece **riscada** quando não há token neste aparelho. Toque nela e cole o token.
- Ao salvar, o app testa o token e diz o que está errado (fine-grained, expirado, sem o escopo `gist`).
- Compare a linha "Gist: xxxxxxx…" dos dois aparelhos: tem que ser o mesmo código. Ela também mostra quantas marcações há em cada aparelho.
- Em <https://gist.github.com> deve existir um gist secreto "FlowPlayer — progresso (não apague)".

Para revogar: GitHub → Settings → Developer settings → Tokens (classic) → **Delete**.

**Leia antes de usar:**

- O GitHub não tem escopo mais estreito para gists. Um token com escopo `gist` consegue ler e escrever **todos** os seus gists, não só o do FlowPlayer. Ele fica só no `localStorage` do aparelho.
- Gist "secreto" é **não listado**, não privado: quem tiver o link consegue ler. O conteúdo é só progresso (IDs de vídeos e semanas concluídas), sem chave nem token.

## Atalhos de teclado (computador)

| Tecla | Ação |
|---|---|
| `J` / `K` | canal seguinte / anterior |
| `Espaço` | marcar ou desmarcar o canal como concluído |
| `[` / `]` | grupo anterior / próximo |
| `R` | recarregar os vídeos do canal |
| `1` / `2` | aba Vídeos / Cursos |

## Cota da API do YouTube

A cota gratuita é de 10.000 unidades por dia. Cada canal custa cerca de 2 unidades por carga (a busca do canal "Andrea Vargas" custa 100). A lista de cada canal fica em cache por 6 horas e o botão **Recarregar** ignora o cache.

## Publicar

O site é estático (sem build) e roda no GitHub Pages direto da branch `main`, pasta raiz. Para publicar uma mudança: `git push origin main` e aguarde cerca de 1 minuto.

Se precisar criar do zero: **Settings → Pages → Deploy from a branch → `main` / `(root)`**.

## Desenvolvimento

Veja o `CLAUDE.md` (estrutura, regras e como testar) e o `CHANGELOG.md`.

```bash
node tests/lib.test.mjs        # testes da lógica pura
python3 -m http.server 8765    # servir localmente
```
