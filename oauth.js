"use strict";
// OAuth do Google (Identity Services, modelo "token", client-side puro — sem backend).
// Só serve pra listar as inscrições do YouTube (subscriptions.list exige login; a API Key
// sozinha só lê dado público). O Client ID NÃO é segredo — é seguro publicar num repo
// público (é assim que todo exemplo oficial do Google faz). O que é secreto é o token de
// acesso, que fica só em memória (nunca em localStorage nem no Gist) e dura ~1h.
//
// Filipe: troque OAUTH_CLIENT_ID pelo Client ID criado no Google Cloud Console
// (ver README.md, seção "Conectar canais do YouTube", e CLAUDE.md, Task 2 deste plano).
const OAUTH_CLIENT_ID = "COLE_SEU_CLIENT_ID_AQUI.apps.googleusercontent.com";
const OAUTH_SCOPE = "https://www.googleapis.com/auth/youtube.readonly";

let tokenClient = null;
let accessToken = "";
let tokenExpiresAt = 0;

function gisReady() {
  return typeof google !== "undefined" && google.accounts && google.accounts.oauth2;
}

function ensureClient() {
  if (!gisReady()) throw new Error("A biblioteca do Google ainda não carregou. Tente de novo em instantes.");
  if (!tokenClient) {
    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: OAUTH_CLIENT_ID,
      scope: OAUTH_SCOPE,
      callback: () => {}, // sobrescrito a cada chamada em requestToken()
    });
  }
  return tokenClient;
}

// silent=true tenta sem popup (prompt:""), usando o consentimento já dado antes — é o caminho
// normal em cada carregamento do app. silent=false (só no clique de "Conectar com Google")
// pode abrir popup de conta/consentimento.
function requestToken(silent) {
  const p = new Promise((resolve, reject) => {
    const client = ensureClient();
    client.callback = (resp) => {
      if (!resp || resp.error) { reject(new Error((resp && resp.error) || "Login com Google cancelado ou recusado.")); return; }
      accessToken = resp.access_token;
      tokenExpiresAt = Date.now() + (resp.expires_in || 3600) * 1000 - 30000; // 30s de folga
      resolve(accessToken);
    };
    client.requestAccessToken(silent ? { prompt: "" } : {});
  });
  // client.callback é o único jeito de resolver/rejeitar; se o Google nunca chamar
  // (ex.: client_id inválido, falha silenciosa), a promise ficaria pendurada pra sempre.
  const timeout = new Promise((_, reject) => {
    const id = setTimeout(() => reject(new Error("Conexão com o Google demorou demais. Tente de novo.")), 20000);
    p.finally(() => clearTimeout(id));
  });
  return Promise.race([p, timeout]);
}

async function getToken() {
  if (accessToken && Date.now() < tokenExpiresAt) return accessToken;
  return requestToken(true);
}

function connect() { return requestToken(false); }

function isConnected() { return !!accessToken && Date.now() < tokenExpiresAt; }

function disconnect() {
  if (accessToken && gisReady()) google.accounts.oauth2.revoke(accessToken, () => {});
  accessToken = ""; tokenExpiresAt = 0;
}

// subscriptions.list paginado (part=snippet, mine=true, até 50 por página — 1 unidade de
// cota por página, bem barato: a lista inteira de inscrições custa poucas unidades).
async function listSubscriptions() {
  const token = await getToken();
  const out = [];
  let pageToken = "";
  do {
    const q = new URLSearchParams({ part: "snippet", mine: "true", maxResults: "50" });
    if (pageToken) q.set("pageToken", pageToken);
    const r = await fetch(`https://www.googleapis.com/youtube/v3/subscriptions?${q}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const d = await r.json().catch(() => ({}));
    if (d.error) throw new Error(d.error.message || "Erro ao listar inscrições do YouTube.");
    for (const item of d.items || [])
      out.push({ channelId: item.snippet.resourceId.channelId, name: item.snippet.title });
    pageToken = d.nextPageToken || "";
  } while (pageToken);
  return out;
}

window.FPAuth = { connect, getToken, isConnected, disconnect, listSubscriptions };
