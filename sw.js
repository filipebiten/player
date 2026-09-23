// Service worker: o app abre offline com a última versão que você viu.
// Network-first (sempre fresco quando há rede, cache só se falhar ou demorar) — assim não precisa
// mudar versão a cada publicação. Só arquivos do próprio site e as fontes; APIs (YouTube, GitHub) nunca passam por aqui.
const SHELL = "fp-shell";
const FONTS = "fp-fonts";
const FILES = ["./", "index.html", "styles.css", "data.js", "lib.js", "oauth.js", "app.js", "manifest.json", "icon-192.png", "icon-512.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(self.clients.claim());
});

// rede primeiro; se falhar ou passar de 3s, usa o cache
function networkFirst(req) {
  return new Promise((resolve) => {
    let settled = false;
    const fromCache = () => caches.match(req, { ignoreSearch: true }).then((hit) => hit || Response.error());
    const timer = setTimeout(() => { if (!settled) fromCache().then((r) => { if (!settled) { settled = true; resolve(r); } }); }, 3000);
    fetch(req).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(SHELL).then((c) => c.put(req, copy)); }
      if (!settled) { settled = true; clearTimeout(timer); resolve(res); }
    }).catch(() => {
      clearTimeout(timer);
      fromCache().then((r) => { if (!settled) { settled = true; resolve(r); } });
    });
  });
}

// fontes mudam raramente: cache primeiro, atualiza por baixo
function fontsCacheFirst(req) {
  return caches.open(FONTS).then((c) => c.match(req).then((hit) => {
    const net = fetch(req).then((res) => { c.put(req, res.clone()); return res; }).catch(() => hit);
    return hit || net;
  }));
}

self.addEventListener("fetch", (e) => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== "GET") return;
  if (url.origin === location.origin) e.respondWith(networkFirst(req));
  else if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") e.respondWith(fontsCacheFirst(req));
});
