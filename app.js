"use strict";
// FlowPlayer — estado, API do YouTube, progresso e render.
// Dados (WEEKS/PLATFORMS) vêm de data.js; lógica pura testada vem de lib.js (window.FP).

const esc = FP.escapeHtml;
const YT_API = "https://www.googleapis.com/youtube/v3";
const now = () => Date.now();

// ============================================================
// STORAGE (localStorage é o cache local; funciona offline)
// ============================================================
const store = {
  get(k, fallback) { try { const r = localStorage.getItem(k); return r ? JSON.parse(r) : fallback; } catch { return fallback; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};

// fp-config: só neste aparelho, NUNCA sincroniza (chaves e tokens)
let config = store.get("fp-config", null);
if (!config) {
  // migração da versão antiga: a API Key ficava em fp-state
  const old = store.get("fp-state", {});
  config = { apiKey: old.apiKey || "" };
  if (config.apiKey) store.set("fp-config", config);
  try { localStorage.removeItem("fp-state"); } catch {}
}
let progress = FP.mergeProgress(FP.emptyProgress(), store.get("fp-progress", null)); // sincroniza
let vidCache = store.get("fp-vidcache", {}); // {channelKey: {t, vids}} — 6h
let chIds = store.get("fp-chid", {});        // handle → channelId (não expira)
let ui = store.get("fp-ui", { tab: "videos" });

// ============================================================
// ESTADO
// ============================================================
const S = {
  tab: ui.tab === "courses" ? "courses" : "videos",
  week: FP.weekIndexForDate(new Date()),
  sel: 0,            // canal selecionado dentro da semana
  view: "list",      // celular: "list" | "channel" (no desktop as duas colunas aparecem sempre)
  loadingKey: "",
  error: "", errorKey: "",
  listScroll: 0,
};
let todayWeek = S.week;

const narrow = () => !matchMedia("(min-width: 900px)").matches;
const week = () => WEEKS[S.week];
const curCh = () => week().channels[S.sel];
const doneKey = () => FP.doneKey(new Date(), S.week);
const isDone = (ch) => FP.isOn(progress.done[doneKey()]?.[FP.channelKey(ch)]);
const isWatched = (id) => FP.isOn(progress.watched[id]);
const firstOpen = () => { const i = week().channels.findIndex((c) => !isDone(c)); return i < 0 ? 0 : i; };

// ============================================================
// YT API — resolveChannelId / fetchChannelVids / searchVids reaproveitadas
// ============================================================
async function ytGet(path, params) {
  const q = new URLSearchParams({ ...params, key: config.apiKey });
  const r = await fetch(`${YT_API}/${path}?${q}`);
  const d = await r.json().catch(() => ({}));
  if (d.error) {
    const e = new Error(d.error.message || "Erro da API do YouTube");
    e.reason = d.error.errors?.[0]?.reason;
    throw e;
  }
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return d;
}

async function resolveChannelId(ch) {
  if (ch.channelId) return ch.channelId;
  if (!ch.handle) return null;
  const h = ch.handle.replace("@", "");
  if (chIds[h]) return chIds[h];

  let d = await ytGet("channels", { part: "contentDetails,snippet", forHandle: h });
  let id = d.items?.length ? d.items[0].id : null;
  if (!id) {
    d = await ytGet("channels", { part: "contentDetails,snippet", forUsername: h });
    id = d.items?.length ? d.items[0].id : null;
  }
  if (!id) { // fallback: busca (100 unidades de cota — por isso o cache do id)
    d = await ytGet("search", { part: "snippet", q: h, type: "channel", maxResults: 1 });
    id = d.items?.length ? d.items[0].snippet.channelId : null;
  }
  if (id) { chIds[h] = id; store.set("fp-chid", chIds); }
  return id;
}

const isPlayable = (i) => !/^(Private|Deleted) video$/.test(i.snippet.title);

async function fetchChannelVids(channelId, max = 10) {
  const cd = await ytGet("channels", { part: "contentDetails", id: channelId });
  if (!cd.items?.length) return [];
  const uploads = cd.items[0].contentDetails.relatedPlaylists.uploads;

  const pd = await ytGet("playlistItems", { part: "snippet", playlistId: uploads, maxResults: max });
  if (!pd.items) return [];

  return pd.items.filter(isPlayable).map((i) => ({
    id: i.snippet.resourceId.videoId,
    title: i.snippet.title,
    thumb: i.snippet.thumbnails?.medium?.url || i.snippet.thumbnails?.default?.url,
    published: i.snippet.publishedAt,
    channel: i.snippet.channelTitle,
  }));
}

async function searchVids(query, max = 10) {
  const d = await ytGet("search", { part: "snippet", q: query, type: "video", maxResults: max, order: "date" });
  if (!d.items) return [];
  return d.items.map((i) => ({
    id: i.id.videoId,
    title: i.snippet.title,
    thumb: i.snippet.thumbnails?.medium?.url,
    published: i.snippet.publishedAt,
    channel: i.snippet.channelTitle,
  }));
}

function errMsg(e) {
  if (e.reason === "quotaExceeded" || e.reason === "rateLimitExceeded")
    return "A cota diária da API do YouTube acabou. Volta amanhã; o que está em cache continua aparecendo.";
  if (e.reason === "keyInvalid" || /API key/i.test(e.message)) return "API Key inválida. Confira em Ajustes.";
  if (e instanceof TypeError) return "Sem conexão com o YouTube.";
  return e.message;
}

// Lista por canal em cache por 6h (FP.CACHE_TTL). force=true ignora o cache (botão recarregar).
async function loadChannel(ch, force = false) {
  const k = FP.channelKey(ch), cached = vidCache[k];
  if (!force && FP.isFresh(cached)) return;
  if (S.loadingKey === k) return;
  S.loadingKey = k; S.error = ""; render();
  try {
    let vids;
    if (ch.type === "search") vids = await searchVids(ch.query);
    else {
      const id = await resolveChannelId(ch);
      if (!id) throw new Error(`Canal não encontrado: ${ch.name}`);
      vids = await fetchChannelVids(id);
    }
    vidCache[k] = { t: now(), vids };
    store.set("fp-vidcache", vidCache);
  } catch (e) {
    S.error = errMsg(e) + (cached ? " Mostrando a última lista salva." : "");
    S.errorKey = k;
  }
  S.loadingKey = "";
  render();
}

// ============================================================
// PROGRESSO
// ============================================================
function commit(rerender = true) {
  store.set("fp-progress", progress);
  scheduleSync();
  if (rerender) render();
}

function toggleDone(ch) {
  const k = doneKey();
  const m = (progress.done[k] ||= {});
  FP.setEntry(m, FP.channelKey(ch), !isDone(ch), now());
  commit();
}

function toggleWatched(id) {
  FP.setEntry(progress.watched, id, !isWatched(id), now());
  commit();
}

const courseKey = (p, c) => `${p.name}|${c.name}`;
const lessonOf = (p, c) => progress.courses[courseKey(p, c)]?.lastLesson ?? c.lastLesson ?? "";
function setLesson(key, text) {
  progress.courses[key] = { t: now(), lastLesson: text.trim() };
  commit(false); // sem re-render: o campo já mostra o valor e não podemos roubar o clique seguinte
}

const rotation = () => progress.rot || { p: 0, c: 0 };
function setRotation(p, c) { progress.rot = { t: now(), p, c }; commit(); }

// ============================================================
// NAVEGAÇÃO
// ============================================================
function setTab(tab) {
  S.tab = tab; ui.tab = tab; store.set("fp-ui", ui);
  render();
}

function setWeek(i) {
  S.week = i; S.sel = firstOpen(); S.view = "list"; S.error = "";
  render();
  loadChannel(curCh());
}

function selectChannel(i) {
  S.sel = i; S.error = "";
  if (narrow() && S.view !== "channel") {
    S.listScroll = window.scrollY;
    history.pushState({ v: "channel" }, "");
  }
  S.view = "channel";
  render();
  if (narrow()) window.scrollTo(0, 0);
  loadChannel(curCh());
}

function backToList() {
  if (history.state?.v === "channel") { history.back(); return; }
  S.view = "list"; render(); window.scrollTo(0, S.listScroll);
}
window.addEventListener("popstate", () => { S.view = "list"; render(); window.scrollTo(0, S.listScroll); });

// J/K: muda o canal selecionado sem trocar de tela
function moveSel(delta) {
  const n = week().channels.length, i = Math.max(0, Math.min(n - 1, S.sel + delta));
  if (i === S.sel) return;
  S.sel = i; S.error = "";
  render();
  document.querySelector(".ch.is-selected")?.scrollIntoView({ block: "nearest" });
  loadChannel(curCh());
}

function nextPlatform() { setRotation((rotation().p + 1) % PLATFORMS.length, 0); }
function nextCourse() {
  const r = rotation(), n = PLATFORMS[r.p].courses.length;
  if (n > 1) setRotation(r.p, (r.c + 1) % n);
}

// ============================================================
// ÍCONES (SVG inline, traço)
// ============================================================
const svg = (d, extra = "") => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${d}</svg>`;
const I = {
  check: svg('<path d="M5 12.5l4.5 4.5L19 7.5" stroke-width="3"/>'),
  back: svg('<path d="M15 5l-7 7 7 7"/>'),
  go: svg('<path d="M9 5l7 7-7 7"/>'),
  play: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>',
  videos: svg('<circle cx="12" cy="12" r="9"/><path d="M10 8.5v7l6-3.5z" fill="currentColor"/>'),
  courses: svg('<path d="M4 19.5V5a2 2 0 0 1 2-2h13v15H6a2 2 0 0 0-2 2zm0 0a2 2 0 0 0 2 2h13"/>'),
  settings: svg('<path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/>'),
  refresh: svg('<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/>'),
  external: svg('<path d="M14 4h6v6"/><path d="M20 4l-9 9"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>'),
  next: svg('<path d="M5 5l7 7-7 7"/><path d="M13 5l7 7-7 7"/>'),
  cloud: svg('<path d="M7 18a4 4 0 0 1-.5-7.97A5.5 5.5 0 0 1 17 8.5a4.75 4.75 0 0 1 .5 9.5z"/>'),
  alert: svg('<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18v.01"/>'),
};

const checkBtn = (attrs, pressed, label) =>
  `<button class="check" ${attrs} aria-pressed="${pressed}" aria-label="${esc(label)}"><span class="check__box">${I.check}</span></button>`;

// ============================================================
// RENDER
// ============================================================
function render() {
  const app = document.getElementById("app");
  const scroll = [...app.querySelectorAll(".pane-list,.pane-detail")].map((el) => el.scrollTop);
  const a = document.activeElement;
  let focusSel = "";
  if (a && app.contains(a) && a.dataset.action) {
    focusSel = `[data-action="${a.dataset.action}"]`;
    for (const k of ["id", "i", "tab"]) if (a.dataset[k] !== undefined) focusSel += `[data-${k}="${CSS.escape(a.dataset[k])}"]`;
  }

  app.innerHTML = config.apiKey ? renderApp() : renderSetup();

  app.querySelectorAll(".pane-list,.pane-detail").forEach((el, i) => { el.scrollTop = scroll[i] || 0; });
  if (focusSel) app.querySelector(focusSel)?.focus({ preventScroll: true });
}

function renderSetup() {
  return `
    <div class="setup">
      <form class="setup__card" data-form="setup" autocomplete="off">
        <h1 class="setup__title"><span class="brand__logo">${I.play}</span>FlowPlayer</h1>
        <p class="hint">Seus canais e cursos em um só lugar.</p>
        <section class="setup__section">
          <h2>YouTube API Key</h2>
          <ol class="steps">
            <li>Acesse o <a href="https://console.cloud.google.com/" target="_blank" rel="noopener">Google Cloud Console</a></li>
            <li>Crie um projeto (ou use um existente)</li>
            <li>Ative a <strong>YouTube Data API v3</strong></li>
            <li>Crie uma credencial → "Chave de API"</li>
            <li>Cole a chave abaixo</li>
          </ol>
          <label class="field"><span class="field__label">API Key</span>
            <input class="input" id="apiKey" name="apiKey" type="text" placeholder="Cole sua API Key aqui" autocapitalize="off" autocorrect="off" spellcheck="false" required />
          </label>
        </section>
        <section class="setup__section">
          <h2>Sincronizar entre aparelhos <span class="hint">(opcional)</span></h2>
          <p class="hint">O progresso fica num Gist secreto da sua conta do GitHub. Sem token, o app funciona só neste aparelho.</p>
          <ol class="steps">
            <li>Abra <a href="${TOKEN_URL}" target="_blank" rel="noopener">github.com → novo token (classic)</a></li>
            <li>Deixe marcado só o escopo <strong>gist</strong> e gere o token</li>
            <li>Cole abaixo (em cada aparelho)</li>
          </ol>
          <label class="field"><span class="field__label">Token do GitHub</span>
            <input class="input" id="gistToken" type="password" placeholder="ghp_…" autocapitalize="off" autocorrect="off" spellcheck="false" />
          </label>
        </section>
        <button class="btn btn--primary btn--block" type="submit">Começar</button>
      </form>
    </div>`;
}

function renderTop() {
  const ch = curCh();
  return `
    <header class="top">
      <button class="icon-btn back" data-action="back" aria-label="Voltar para os canais">${I.back}</button>
      <h1 class="brand"><span class="brand__logo">${I.play}</span>FlowPlayer</h1>
      <h1 class="top__title">${esc(ch?.name || "")}</h1>
      <nav class="tabs" aria-label="Seções">
        <button class="tab" data-action="tab" data-tab="videos" ${S.tab === "videos" ? 'aria-current="page"' : ""}>${I.videos}<span>Vídeos</span></button>
        <button class="tab" data-action="tab" data-tab="courses" ${S.tab === "courses" ? 'aria-current="page"' : ""}>${I.courses}<span>Cursos</span></button>
      </nav>
      <div class="top__spacer"></div>
      <div class="top__actions">${actionsHtml()}</div>
    </header>`;
}

const actionsHtml = () =>
  `${syncIndicator()}<button class="icon-btn" data-action="settings" aria-label="Ajustes">${I.settings}</button>`;

function renderApp() {
  const view = S.tab === "courses" ? "courses" : S.view;
  const dock = S.tab === "videos" && S.view === "channel"
    ? `<div class="dock">${doneButton("btn--block")}</div>` : "";
  return `
    <div class="app" data-view="${view}">
      ${renderTop()}
      <main class="main">${S.tab === "videos" ? renderVideosTab() : renderCourses()}</main>
      ${dock}
    </div>`;
}

const doneButton = (extra = "") => {
  const done = isDone(curCh());
  return `<button class="btn btn--primary ${extra}" data-action="toggle-done-cur" aria-pressed="${done}">${I.check}${done ? "Canal concluído" : "Marcar canal concluído"}</button>`;
};

function renderVideosTab() {
  const w = week(), total = w.channels.length, done = w.channels.filter(isDone).length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  return `
    <div class="split">
      <section class="pane-list" aria-label="Canais da ${esc(w.label)}">
        <div class="weekbar">
          <div class="weekbar__head">
            <h2 class="weekbar__title">${esc(w.label)}</h2>
            ${S.week === todayWeek ? '<span class="pill">Atual</span>' : ""}
            <span class="weekbar__count">${done} de ${total} concluídos</span>
          </div>
          <div class="seg" role="group" aria-label="Escolher semana">
            ${WEEKS.map((_, i) => `<button class="seg__btn ${i === todayWeek ? "is-today" : ""}" data-action="week" data-i="${i}" aria-pressed="${i === S.week}" aria-label="Semana ${i + 1}${i === todayWeek ? " (atual)" : ""}">${i + 1}</button>`).join("")}
          </div>
          <div class="bar" role="progressbar" aria-label="Canais concluídos nesta semana" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${done}"><span style="width:${pct}%"></span></div>
        </div>
        <ul class="chlist">${w.channels.map(renderChannelRow).join("")}</ul>
        <p class="legend"><kbd>J</kbd> <kbd>K</kbd> canal · <kbd>Espaço</kbd> marcar canal concluído · <kbd>[</kbd> <kbd>]</kbd> semana · <kbd>R</kbd> recarregar · <kbd>1</kbd> <kbd>2</kbd> abas</p>
      </section>
      <section class="pane-detail" aria-label="Vídeos do canal">${renderDetail()}</section>
    </div>`;
}

function channelSub(c, done) {
  if (done) return "Concluído nesta semana";
  const cache = vidCache[FP.channelKey(c)];
  const unseen = cache ? cache.vids.filter((v) => !isWatched(v.id)).length : null;
  const tag = c.type === "search" ? "busca · " : "";
  if (unseen === null) return `${tag}Ver vídeos`;
  return `${tag}${unseen === 0 ? "Tudo assistido" : `${unseen} por ver`}`;
}

function renderChannelRow(c, i) {
  const done = isDone(c), sel = i === S.sel;
  return `
    <li class="ch ${done ? "is-done" : ""} ${sel ? "is-selected" : ""}">
      ${checkBtn(`data-action="toggle-done" data-i="${i}"`, done, `Canal concluído nesta semana: ${c.name}`)}
      <button class="ch__main" data-action="select" data-i="${i}" ${sel ? 'aria-current="true"' : ""}>
        <span class="ch__name">${esc(c.name)}</span>
        <span class="ch__sub">${esc(channelSub(c, done))}</span>
      </button>
      <span class="ch__go">${I.go}</span>
    </li>`;
}

const chUrl = (ch) => ch.channelId ? `https://www.youtube.com/channel/${encodeURIComponent(ch.channelId)}`
  : ch.handle ? `https://www.youtube.com/@${encodeURIComponent(ch.handle)}`
  : `https://www.youtube.com/results?search_query=${encodeURIComponent(ch.query)}`;

function ago(t) {
  const m = Math.round((now() - t) / 60000);
  return m < 1 ? "agora" : m < 60 ? `há ${m} min` : `há ${Math.floor(m / 60)} h`;
}

function renderDetail() {
  const ch = curCh(), k = FP.channelKey(ch), cached = vidCache[k], vids = cached?.vids || [];
  const loading = S.loadingKey === k;
  let body;
  if (loading && !cached) body = `<p class="empty" role="status">Buscando vídeos de ${esc(ch.name)}…</p>`;
  else if (!vids.length) body = `<p class="empty empty--lg">${cached ? "Nenhum vídeo encontrado." : "Vídeos ainda não carregados."}</p>`;
  else body = `<ul class="videos">${vids.map(renderVideo).join("")}</ul>`;

  return `
    <div class="detail__head">
      <h2 class="detail__name">${esc(ch.name)}</h2>
      <div class="detail__actions">
        ${doneButton()}
        <button class="btn" data-action="refresh" ${loading ? "disabled" : ""}>${I.refresh}Recarregar</button>
        <a class="btn" href="${chUrl(ch)}" target="_blank" rel="noopener noreferrer">${I.external}Abrir canal</a>
      </div>
    </div>
    ${cached ? `<p class="notice notice--info">Atualizado ${ago(cached.t)} · cache de 6 h</p>` : ""}
    ${S.error && S.errorKey === k ? `<p class="notice notice--error" role="alert">${esc(S.error)}</p>` : ""}
    ${body}`;
}

function renderVideo(v) {
  const w = isWatched(v.id);
  return `
    <li class="video ${w ? "is-watched" : ""}">
      <a class="video__link" href="https://www.youtube.com/watch?v=${encodeURIComponent(v.id)}" target="_blank" rel="noopener noreferrer">
        <span class="video__thumb">${v.thumb ? `<img src="${esc(v.thumb)}" alt="" loading="lazy" />` : ""}</span>
        <span class="video__body">
          <span class="video__title">${esc(v.title)}</span>
          <span class="video__meta"><time datetime="${esc(v.published)}">${FP.relDate(v.published)}</time>${curCh().type === "search" ? ` · ${esc(v.channel)}` : ""}</span>
        </span>
      </a>
      ${checkBtn(`data-action="toggle-video" data-id="${esc(v.id)}"`, w, `Marcar como assistido: ${v.title}`)}
    </li>`;
}

function renderCourses() {
  const r = rotation();
  return `
    <div class="courses">
      ${PLATFORMS.map((p, pi) => {
        const cur = pi === r.p;
        return `
        <section class="plat" style="--plat:${esc(p.color)}" aria-label="${esc(p.name)}">
          <div class="plat__head">
            <h2 class="plat__name">${esc(p.name)}</h2>
            ${cur ? '<span class="pill">Vez agora</span>' : ""}
          </div>
          ${p.courses.map((c, ci) => `
            <div class="course">
              <div class="course__name">${esc(c.name)}${cur && p.courses.length > 1 && ci === r.c ? " · atual" : ""}</div>
              <label class="field"><span class="field__label">Onde parei</span>
                <input class="input" type="text" data-course="${esc(courseKey(p, c))}" value="${esc(lessonOf(p, c))}" placeholder="Ex.: Módulo 3, aula 2" autocomplete="off" />
              </label>
            </div>`).join("")}
          <div class="plat__actions">
            <a class="btn ${cur ? "btn--primary" : ""}" href="${esc(p.url)}" target="_blank" rel="noopener noreferrer">${I.external}Abrir plataforma</a>
            ${cur && p.courses.length > 1 ? `<button class="btn" data-action="next-course">Próximo curso</button>` : ""}
            ${cur ? `<button class="btn" data-action="next-platform">${I.next}Passar a vez</button>` : ""}
          </div>
        </section>`;
      }).join("")}
    </div>
    <p class="rotation-note"><strong>Rodízio:</strong> finalize o curso atual → passe a vez → quando voltar à plataforma, comece o próximo curso dela.</p>`;
}

// ============================================================
// AJUSTES (<dialog>)
// ============================================================
const dlg = () => document.getElementById("settings");

function openSettings() {
  dlg().innerHTML = `
    <form class="sheet__body" data-form="settings" autocomplete="off">
      <div class="sheet__head">
        <h2 id="settings-title">Ajustes</h2>
        <button class="icon-btn" type="button" data-action="close-settings" aria-label="Fechar">${svg('<path d="M6 6l12 12M18 6L6 18"/>')}</button>
      </div>
      <label class="field"><span class="field__label">YouTube API Key</span>
        <input class="input" id="apiKey" type="text" value="${esc(config.apiKey)}" autocapitalize="off" autocorrect="off" spellcheck="false" required />
      </label>
      <label class="field"><span class="field__label">Token do GitHub (sincronização)</span>
        <input class="input" id="gistToken" type="password" value="${esc(config.gistToken || "")}" placeholder="ghp_… (vazio = só neste aparelho)" autocapitalize="off" autocorrect="off" spellcheck="false" />
      </label>
      <p class="hint">Token clássico só com o escopo <strong>gist</strong> — <a class="link" href="${TOKEN_URL}" target="_blank" rel="noopener">criar token</a>. Fica só neste aparelho.</p>
      <p class="status-line" id="sync-status" data-state="${sync.state}" role="status">${esc(syncStatusText())}</p>
      <div class="sheet__actions">
        <button class="btn btn--primary" type="submit">Salvar</button>
        <button class="btn" type="button" data-action="sync-now" ${config.gistToken ? "" : "disabled"}>Sincronizar agora</button>
        <button class="btn" type="button" data-action="close-settings">Fechar</button>
      </div>
    </form>`;
  dlg().showModal();
}

// ============================================================
// SYNC — Gist secreto (progresso). Token clássico, escopo "gist".
// Merge por chave com timestamp (lib.js): dois aparelhos nunca se sobrescrevem.
// ============================================================
const GH = "https://api.github.com";
const GIST_FILE = "flowplayer-progress.json";
const TOKEN_URL = "https://github.com/settings/tokens/new?scopes=gist&description=FlowPlayer";
const sync = { state: config.gistToken ? "idle" : "off", msg: "", at: 0, timer: 0, running: false, again: false };

async function gh(path, opts = {}) {
  const headers = { Accept: "application/vnd.github+json", Authorization: `Bearer ${config.gistToken}` };
  if (opts.body) headers["Content-Type"] = "application/json";
  // no-cache: o GitHub serve GET de gist com max-age=60; sem isso o outro aparelho lê dado velho
  const r = await fetch(GH + path, { cache: "no-cache", ...opts, headers });
  if (!r.ok) { const e = new Error(`GitHub ${r.status}`); e.status = r.status; throw e; }
  return r.json();
}

// Vários gists com o mesmo arquivo (dois aparelhos criaram juntos): todos escolhem o mais antigo.
async function findGist() {
  let best = null;
  for (let page = 1; page <= 5; page++) {
    const list = await gh(`/gists?per_page=100&page=${page}`);
    for (const g of list) if (g.files?.[GIST_FILE] && (!best || g.created_at < best.created_at)) best = g;
    if (list.length < 100) break;
  }
  return best?.id || "";
}

async function readRemote(id) {
  const f = (await gh(`/gists/${id}`)).files?.[GIST_FILE];
  if (!f) return null;
  const text = f.truncated ? await (await fetch(f.raw_url)).text() : f.content;
  try { return JSON.parse(text); } catch { return null; }
}

const saveConfig = () => store.set("fp-config", config);

async function syncNow() {
  if (!config.gistToken) return;
  if (sync.running) { sync.again = true; return; }
  sync.running = true; setSync("syncing");
  try {
    for (let attempt = 0; ; attempt++) {
      try {
        if (!config.gistId) { config.gistId = await findGist(); saveConfig(); }
        const remote = config.gistId ? await readRemote(config.gistId) : null;

        // do merge ao corpo do PATCH não há await: marcações feitas durante a rede não se perdem
        const before = JSON.stringify(progress);
        progress = FP.pruneProgress(FP.mergeProgress(progress, remote), now());
        const body = JSON.stringify(progress);
        store.set("fp-progress", progress);
        const changed = body !== before;

        if (!remote || JSON.stringify(FP.mergeProgress(remote, null)) !== body) {
          const files = { [GIST_FILE]: { content: body } };
          if (config.gistId) await gh(`/gists/${config.gistId}`, { method: "PATCH", body: JSON.stringify({ files }) });
          else {
            const g = await gh("/gists", { method: "POST", body: JSON.stringify({ description: "FlowPlayer — progresso (não apague)", public: false, files }) });
            config.gistId = g.id; saveConfig();
          }
        }
        sync.at = now(); setSync("ok");
        if (changed && !document.activeElement?.matches("#app input")) render();
        break;
      } catch (e) {
        if (e.status === 404 && config.gistId && attempt === 0) { config.gistId = ""; saveConfig(); continue; } // gist apagado
        throw e;
      }
    }
  } catch (e) {
    setSync("error",
      e.status === 401 ? "Token inválido ou expirado."
      : e.status === 403 ? "GitHub recusou: o token precisa do escopo gist (ou limite de requisições)."
      : e instanceof TypeError ? "Sem conexão. Sincroniza quando voltar."
      : e.message);
  }
  sync.running = false;
  if (sync.again) { sync.again = false; syncNow(); }
}

// Depois de cada marcação: espera 2s de sossego e sincroniza
function scheduleSync() {
  if (!config.gistToken) return;
  clearTimeout(sync.timer);
  sync.timer = setTimeout(syncNow, 2000);
}

function setSync(state, msg = "") {
  sync.state = state; sync.msg = msg;
  const bar = document.querySelector(".top__actions");
  if (bar) bar.innerHTML = actionsHtml();
  const line = document.getElementById("sync-status");
  if (line) { line.dataset.state = state; line.textContent = syncStatusText(); }
}

function syncStatusText() {
  if (!config.gistToken) return "Sem token: o progresso fica só neste aparelho.";
  if (sync.state === "syncing") return "Sincronizando…";
  if (sync.state === "error") return sync.msg;
  if (sync.state === "ok") return `Sincronizado às ${new Date(sync.at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}.`;
  return "Token salvo. Ainda não sincronizou.";
}

function syncIndicator() {
  if (!config.gistToken) return "";
  const label = { idle: "Sincronização", syncing: "Sincronizando…", ok: "Sincronizado", error: "Erro de sincronização" }[sync.state];
  return `<button class="sync" data-action="settings" data-state="${sync.state}" aria-label="${esc(label + (sync.msg ? ": " + sync.msg : ""))}">${sync.state === "error" ? I.alert : I.cloud}<span>${label}</span></button>`;
}

// ============================================================
// EVENTOS
// ============================================================
document.addEventListener("click", (e) => {
  const el = e.target.closest("[data-action]");
  if (!el) { if (e.target === dlg()) dlg().close(); return; }
  const { action, i, id, tab } = el.dataset;
  switch (action) {
    case "tab": setTab(tab); break;
    case "week": setWeek(+i); break;
    case "select": selectChannel(+i); break;
    case "back": backToList(); break;
    case "toggle-done": toggleDone(week().channels[+i]); break;
    case "toggle-done-cur": toggleDone(curCh()); break;
    case "toggle-video": toggleWatched(id); break;
    case "refresh": loadChannel(curCh(), true); break;
    case "next-platform": nextPlatform(); break;
    case "next-course": nextCourse(); break;
    case "settings": openSettings(); break;
    case "close-settings": dlg().close(); break;
    case "sync-now": saveSettingsFields(el.closest("form")); syncNow(); break;
  }
});

document.addEventListener("submit", (e) => {
  const form = e.target.closest("[data-form]");
  if (!form) return;
  e.preventDefault();
  const first = !config.apiKey;
  if (!saveSettingsFields(form)) return;
  if (form.dataset.form === "settings") dlg().close();
  S.sel = firstOpen();
  render();
  if (first || form.dataset.form === "settings") loadChannel(curCh());
  syncNow();
});

// Lê API Key + token do formulário (setup ou ajustes). Trocar o token zera o gistId (pode ser outra conta).
function saveSettingsFields(form) {
  const apiKey = form.querySelector("#apiKey").value.trim();
  const gistToken = form.querySelector("#gistToken").value.trim();
  if (!apiKey) return false;
  if (gistToken !== (config.gistToken || "")) config.gistId = "";
  config = { ...config, apiKey, gistToken };
  saveConfig();
  sync.state = gistToken ? "idle" : "off";
  return true;
}

document.addEventListener("change", (e) => {
  const key = e.target.dataset?.course;
  if (key !== undefined) setLesson(key, e.target.value);
});

// Atalhos (desktop). Só valem com o app aberto e sem foco em campo de texto.
document.addEventListener("keydown", (e) => {
  if (!config.apiKey || e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
  if (document.querySelector("dialog[open]") || e.target.matches("input,textarea,select,[contenteditable]")) return;
  const k = e.key.toLowerCase();
  if (k === "1") setTab("videos");
  else if (k === "2") setTab("courses");
  else if (S.tab !== "videos") return;
  else if (k === "j") moveSel(1);
  else if (k === "k") moveSel(-1);
  else if (k === "]") setWeek(Math.min(3, S.week + 1));
  else if (k === "[") setWeek(Math.max(0, S.week - 1));
  else if (k === "r") loadChannel(curCh(), true);
  else if (e.key === " ") toggleDone(curCh());
  else return;
  e.preventDefault();
});
// Espaço em <button> ativa no keyup; impede que o botão focado dispare junto
document.addEventListener("keyup", (e) => {
  if (e.key === " " && config.apiKey && !e.target.matches("input,textarea,select") && !document.querySelector("dialog[open]")) e.preventDefault();
});

// Voltou pro app em outro dia/semana: reposiciona na semana de hoje
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState !== "visible" || !config.apiKey) return;
  const w = FP.weekIndexForDate(new Date());
  if (w !== todayWeek) { todayWeek = w; setWeek(w); }
  syncNow(); // voltou pro app: puxa o que foi marcado no outro aparelho
});
window.addEventListener("online", syncNow);

// ============================================================
// INIT
// ============================================================
S.sel = firstOpen();
render();
if (config.apiKey && S.tab === "videos") loadChannel(curCh());
syncNow();
