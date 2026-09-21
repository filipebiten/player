// Lógica pura (sem DOM, sem rede). Carregada no navegador como script comum
// (window.FP) e no Node pelos testes (tests/lib.test.mjs).
(function (root) {
  const DAY = 86400000;
  const CACHE_TTL = 6 * 3600000; // lista de vídeos por canal
  const WATCHED_TTL = 180 * DAY; // "assistido" mais velho que isso é descartado

  // Dia 1–7 = semana 0, 8–14 = 1, 15–21 = 2, 22+ = 3.
  const weekIndexForDate = (d) => Math.min(3, Math.floor((d.getDate() - 1) / 7));

  // Chave do "canal concluído": ano-mês-semana(1..4). Muda sozinha no mês seguinte.
  const doneKey = (d, weekIndex) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${weekIndex + 1}`;

  // Identidade estável do canal (não depende da posição na lista).
  const channelKey = (ch) => ch.channelId || ch.handle || ch.query;

  const escapeHtml = (s) =>
    String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  // ---- Progresso (é o que sincroniza no Gist) ----
  // watched[videoId] = {t, on}; done["2026-09-3"][channelKey] = {t, on};
  // courses["Plataforma|Curso"] = {t, lastLesson}; rot = {t, p, c}
  // Desmarcar grava {on:false} (túmulo) para o merge entre aparelhos não ressuscitar a marca.
  const emptyProgress = () => ({ v: 1, watched: {}, done: {}, courses: {}, rot: null });

  const setEntry = (map, key, on, t) => { map[key] = { t, on }; };
  const isOn = (e) => !!(e && e.on);

  const isObj = (x) => x && typeof x === "object" && !Array.isArray(x);
  const norm = (p) => ({
    v: 1,
    watched: isObj(p?.watched) ? p.watched : {},
    done: isObj(p?.done) ? p.done : {},
    courses: isObj(p?.courses) ? p.courses : {},
    rot: isObj(p?.rot) ? p.rot : null,
  });

  const newer = (a, b) => (!a ? b : !b ? a : b.t > a.t ? b : a);
  const mergeMaps = (a = {}, b = {}) => {
    const out = {};
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) out[k] = newer(a[k], b[k]);
    return out;
  };

  function mergeProgress(a, b) {
    a = norm(a); b = norm(b);
    const done = {};
    for (const k of new Set([...Object.keys(a.done), ...Object.keys(b.done)]))
      done[k] = mergeMaps(a.done[k], b.done[k]);
    return {
      v: 1,
      watched: mergeMaps(a.watched, b.watched),
      done,
      courses: mergeMaps(a.courses, b.courses),
      rot: newer(a.rot, b.rot) || null,
    };
  }

  function pruneProgress(p, now = Date.now()) {
    p = norm(p);
    const watched = {};
    for (const [k, e] of Object.entries(p.watched)) if (now - e.t <= WATCHED_TTL) watched[k] = e;
    const done = {};
    for (const [k, v] of Object.entries(p.done)) {
      const [y, m] = k.split("-").map(Number);
      if (now - new Date(y, m - 1, 1).getTime() <= 400 * DAY) done[k] = v;
    }
    return { ...p, watched, done };
  }

  // ---- Datas / cache ----
  function relDate(iso, now = Date.now()) {
    const days = Math.floor((now - new Date(iso).getTime()) / DAY);
    if (days < 1) return "hoje";
    if (days === 1) return "ontem";
    if (days < 7) return `há ${days} dias`;
    const plural = (n, one, many) => `há ${n} ${n === 1 ? one : many}`;
    if (days < 30) return plural(Math.floor(days / 7), "semana", "semanas");
    if (days < 365) return plural(Math.floor(days / 30), "mês", "meses");
    return plural(Math.floor(days / 365), "ano", "anos");
  }

  const isFresh = (entry, now = Date.now(), ttl = CACHE_TTL) => !!entry && now - entry.t < ttl;

  const api = {
    CACHE_TTL, weekIndexForDate, doneKey, channelKey, escapeHtml,
    emptyProgress, setEntry, isOn, mergeProgress, pruneProgress, relDate, isFresh,
  };
  root.FP = api;
  if (typeof module !== "undefined") module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
