// Lógica pura (sem DOM, sem rede). Carregada no navegador como script comum
// (window.FP) e no Node pelos testes (tests/lib.test.mjs).
(function (root) {
  const DAY = 86400000;
  const CACHE_TTL = 6 * 3600000; // lista de vídeos por canal
  const WATCHED_TTL = 180 * DAY; // "assistido" mais velho que isso é descartado

  // Segunda-feira 1970-01-05 como âncora (não importa qual segunda, só precisa ser fixa).
  // Usar componentes de data LOCAL (getFullYear/Month/Date) mas aritmética em UTC-ms evita
  // bug de horário de verão contando "dias" com Date.UTC puro.
  const ISO_MONDAY_EPOCH = Date.UTC(1970, 0, 5);
  const mondayUTC = (d) => {
    const dow = (d.getDay() + 6) % 7; // 0=segunda … 6=domingo
    return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate() - dow);
  };
  // Semanas inteiras (segunda a segunda) desde a âncora. Cresce 1 por semana real, para sempre.
  const weeksSinceEpoch = (d) => Math.floor((mondayUTC(d) - ISO_MONDAY_EPOCH) / (7 * DAY));

  // Qual das 4 partes está na vez nesta semana real. Rotação contínua: nunca reseta por mês.
  const weekIndexForDate = (d) => ((weeksSinceEpoch(d) % 4) + 4) % 4;

  // Identidade estável do canal (não depende da posição na lista).
  const channelKey = (ch) => ch.channelId || ch.handle || ch.query;

  const escapeHtml = (s) =>
    String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  // ---- Progresso (é o que sincroniza no Gist) ----
  // watched[videoId] = {t, on}; done[channelKey] = {t, on} (mesmo formato de watched/channels —
  // "concluído" persiste até o clique explícito em "Resetar semana" em app.js, nunca sozinho);
  // courses["Plataforma|Curso"] = {t, lastLesson}; rot = {t, p, c}
  // Desmarcar grava {on:false} (túmulo) para o merge entre aparelhos não ressuscitar a marca.
  const emptyProgress = () => ({ v: 1, watched: {}, done: {}, courses: {}, rot: null, channels: {} });

  const setEntry = (map, key, on, t) => { map[key] = { t, on }; };
  const isOn = (e) => !!(e && e.on);

  const isObj = (x) => x && typeof x === "object" && !Array.isArray(x);
  const newer = (a, b) => (!a ? b : !b ? a : b.t > a.t ? b : a);
  const mergeMaps = (a = {}, b = {}) => {
    const out = {};
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) out[k] = newer(a[k], b[k]);
    return out;
  };

  // Migra o formato antigo de `done` (chave "w<N>" por semana real -> mapa de channelKey,
  // reset automático toda semana) pro formato achatado atual (channelKey -> entry direto,
  // mesmo padrão de watched/channels). Idempotente: entrada já achatada (tem `.on`) passa
  // direto; se a mesma chave aparecer em mais de um balde antigo, fica a mais nova.
  function flattenDone(raw) {
    const out = {};
    const take = (k, e) => { out[k] = newer(out[k], e); };
    for (const [k, v] of Object.entries(raw || {})) {
      if (!isObj(v)) continue;
      if (typeof v.on === "boolean") take(k, v);
      else for (const [ck, e] of Object.entries(v)) if (isObj(e)) take(ck, e);
    }
    return out;
  }

  const norm = (p) => ({
    v: 1,
    watched: isObj(p?.watched) ? p.watched : {},
    done: flattenDone(p?.done),
    courses: isObj(p?.courses) ? p.courses : {},
    rot: isObj(p?.rot) ? p.rot : null,
    channels: isObj(p?.channels) ? p.channels : {},
  });

  function mergeProgress(a, b) {
    a = norm(a); b = norm(b);
    return {
      v: 1,
      watched: mergeMaps(a.watched, b.watched),
      done: mergeMaps(a.done, b.done),
      courses: mergeMaps(a.courses, b.courses),
      rot: newer(a.rot, b.rot) || null,
      channels: mergeMaps(a.channels, b.channels),
    };
  }

  // Grupo com menos canais "on" no momento — empate vai pro de menor índice. Mapa vazio -> 0.
  function assignGroup(channelsMap) {
    const counts = [0, 0, 0, 0];
    for (const c of Object.values(channelsMap)) if (isOn(c)) counts[c.group] = (counts[c.group] || 0) + 1;
    let best = 0;
    for (let g = 1; g < 4; g++) if (counts[g] < counts[best]) best = g;
    return best;
  }

  // Semente única: os canais hoje fixos em WEEKS (data.js) viram entradas de progress.channels,
  // mesma channelKey de sempre (channelId‖handle‖query) — não quebra watched/done existentes.
  // `t` deve ser propositalmente antigo (não Date.now()): assim, se outro aparelho já tiver
  // um progress.channels real vindo do Gist, o merge por timestamp deixa o dado real vencer
  // em vez da semente recém-criada neste aparelho.
  function migrateWeeksChannels(WEEKS, t) {
    const channels = {};
    WEEKS.forEach((w, group) => {
      w.channels.forEach((c) => {
        channels[channelKey(c)] = {
          t, on: true, group, name: c.name, type: c.type,
          channelId: c.channelId, handle: c.handle, query: c.query,
        };
      });
    });
    return channels;
  }

  // Acha a entrada de progress.channels que corresponde a uma inscrição do OAuth (só tem
  // channelId). Prioridade: 1) chave = channelId direto (canal adicionado via OAuth antes,
  // ou migrado com channelId). 2) canal migrado por handle cujo fp-chid[handle] resolveu pra
  // esse mesmo channelId (bridge: só existe depois que o canal foi aberto pelo menos uma vez).
  // chIds é passado como objeto puro (sem ler localStorage aqui). Sem match: [null, null].
  function resolveChannelEntry(channels, chIds, subChannelId) {
    if (channels[subChannelId]) return [subChannelId, channels[subChannelId]];
    for (const [key, entry] of Object.entries(channels || {})) {
      if (entry && entry.handle && chIds[entry.handle] === subChannelId) return [key, entry];
    }
    return [null, null];
  }

  // Extrai o termo de busca de um link "youtube.com/results?search_query=..." colado pelo
  // usuário, ou usa o texto puro digitado. Nome sugerido = termo em Title Case — a UI não
  // tem campo de nome separado (deliberadamente simples); dá pra editar depois em data.js.
  function parseSearchQuery(raw) {
    raw = String(raw || "").trim();
    const m = raw.match(/[?&]search_query=([^&]+)/);
    const query = (m ? decodeURIComponent(m[1].replace(/\+/g, " ")) : raw).trim();
    const name = query.split(/\s+/).map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w)).join(" ");
    return { query, name };
  }

  const DONE_TTL = 400 * DAY; // "concluído" persiste até resetar manualmente, mas não pra sempre

  function pruneProgress(p, now = Date.now()) {
    p = norm(p);
    const watched = {};
    for (const [k, e] of Object.entries(p.watched)) if (now - e.t <= WATCHED_TTL) watched[k] = e;
    const done = {};
    for (const [k, e] of Object.entries(p.done)) if (now - e.t <= DONE_TTL) done[k] = e;
    return { ...p, watched, done };
  }

  // ---- Datas / cache ----
  // Data relativa em pt-BR via Intl ("hoje", "ontem", "há 3 dias", "há 2 semanas"…)
  const rtf = new Intl.RelativeTimeFormat("pt-BR", { numeric: "auto" });
  function relDate(iso, now = Date.now()) {
    const days = Math.max(0, Math.floor((now - new Date(iso).getTime()) / DAY));
    if (days < 7) return rtf.format(-days, "day");
    if (days < 30) return rtf.format(-Math.floor(days / 7), "week");
    if (days < 365) return rtf.format(-Math.floor(days / 30), "month");
    return rtf.format(-Math.floor(days / 365), "year");
  }

  const isFresh = (entry, now = Date.now(), ttl = CACHE_TTL) => !!entry && now - entry.t < ttl;

  const api = {
    CACHE_TTL, weeksSinceEpoch, weekIndexForDate, channelKey, escapeHtml,
    emptyProgress, setEntry, isOn, mergeProgress, pruneProgress, relDate, isFresh,
    assignGroup, migrateWeeksChannels, resolveChannelEntry, parseSearchQuery,
  };
  root.FP = api;
  if (typeof module !== "undefined") module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
