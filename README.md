# FlowPlayer

Seus canais do YouTube e cursos em um só lugar.

## Como publicar no GitHub Pages

### 1. Crie um repositório no GitHub
- Acesse [github.com/new](https://github.com/new)
- Nome: `flowplayer` (ou o que preferir)
- Marque **Public**
- Clique em **Create repository**

### 2. Suba os arquivos
- Na página do repositório vazio, clique em **"uploading an existing file"**
- Arraste os 4 arquivos desta pasta:
  - `index.html`
  - `manifest.json`
  - `icon-192.png`
  - `icon-512.png`
- Clique em **Commit changes**

### 3. Ative o GitHub Pages
- No repositório, vá em **Settings** → **Pages** (menu lateral)
- Em "Source", selecione **Deploy from a branch**
- Branch: **main** / pasta: **/ (root)**
- Clique **Save**
- Aguarde ~1 minuto. Seu app estará em:
  `https://SEU-USUARIO.github.io/flowplayer/`

### 4. Instale no iPhone
- Abra o link acima no **Safari** do iPhone
- Toque no botão de **compartilhar** (⬆️)
- Escolha **"Adicionar à Tela de Início"**
- Pronto! O FlowPlayer aparece como um app na sua tela

### 5. Crie a YouTube API Key (gratuita)
- Acesse [Google Cloud Console](https://console.cloud.google.com/)
- Crie um projeto (ou use existente)
- Vá em **APIs e Serviços** → **Biblioteca**
- Busque **YouTube Data API v3** e ative
- Vá em **Credenciais** → **Criar credenciais** → **Chave de API**
- Cole a chave no FlowPlayer quando abrir pela primeira vez

## Atalhos de teclado (computador)
- **N** = próximo vídeo
- **P** = vídeo anterior
- **Shift + →** = próximo canal
- **Shift + ←** = canal anterior
