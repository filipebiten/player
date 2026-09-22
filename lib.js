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

  // Chave do "canal concluído": uma por semana real (segunda a domingo). Muda sozinha
  // toda semana, então quando a parte volta a aparecer (~4 semanas depois) o progresso já
  // está zerado — não precisa de lógica de reset separada.
  const doneKey = (d) => `w${weeksSinceEpoch(d)}`;

  // Identidade estável do canal (não depende da posição na lista).
  const channelKey = (ch) => ch.channelId || ch.handle || ch.query;

  const escapeHtml = (s) =>
    String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  // ---- Progresso (é o que sincroniza no Gist) ----
  // watched[videoId] = {t, on}; done["w2926"][channelKey] = {t, on};
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
    const curWeek = weeksSinceEpoch(new Date(now));
    for (const [k, v] of Object.entries(p.done)) {
      const n = Number(k.slice(1)); // "w2926" -> 2926
      if (Number.isFinite(n) && curWeek - n <= 57) done[k] = v; // ~400 dias / 7
    }
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
    CACHE_TTL, weeksSinceEpoch, weekIndexForDate, doneKey, channelKey, escapeHtml,
    emptyProgress, setEntry, isOn, mergeProgress, pruneProgress, relDate, isFresh,
  };
  root.FP = api;
  if (typeof module !== "undefined") module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
