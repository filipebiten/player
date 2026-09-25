// Rodar: node tests/lib.test.mjs
import assert from "node:assert/strict";
import FP from "../lib.js";

const t = (name, fn) => { fn(); console.log("ok  " + name); };
const d = (y, m, day) => new Date(y, m - 1, day, 12);

// weekIndexForDate: semana real (segunda a domingo), rotação contínua sem reset por mês.

// Segunda 2026-09-21 e domingo 2026-09-27 são a MESMA semana-calendário -> mesmo índice.
t("segunda e domingo da mesma semana devem cair no mesmo índice", () => {
  assert.equal(FP.weekIndexForDate(new Date(2026, 8, 21)) === FP.weekIndexForDate(new Date(2026, 8, 27)),
    true);
});

// A semana seguinte (segunda 2026-09-28) tem que ser o índice seguinte (mod 4), nunca repetir.
t("semana seguinte devia ser incremento mod 4", () => {
  const a = FP.weekIndexForDate(new Date(2026, 8, 21));
  const b = FP.weekIndexForDate(new Date(2026, 8, 28));
  assert.equal(b === (a + 1) % 4, true, `semana seguinte devia ser ${(a + 1) % 4}, veio ${b}`);
});

// Mês de 5 semanas-calendário (setembro/2026 tem segundas em 7,14,21,28 -> só 4;
// use um mês real com 5 segundas: outubro/2026 tem segundas em 5,12,19,26 -> 4 também.
// Testa 5 segundas consecutivas quaisquer: os índices têm que ser 0,1,2,3,0 (nunca travar em 3).
t("5 segundas seguidas devem rodar 0..3 e voltar ao início", () => {
  const mondays = [new Date(2026, 8, 7), new Date(2026, 8, 14), new Date(2026, 8, 21),
    new Date(2026, 8, 28), new Date(2026, 9, 5)];
  const idx = mondays.map(FP.weekIndexForDate);
  assert.equal(JSON.stringify(idx) === JSON.stringify([idx[0], (idx[0]+1)%4, (idx[0]+2)%4, (idx[0]+3)%4, idx[0]]),
    true, `5 segundas seguidas devem rodar 0..3 e voltar ao início, veio ${idx}`);
});

// Virada de ano com semana ISO 53 (2026 tem 53 semanas ISO: segunda 2026-12-28 é a última
// semana de 2026, segunda 2027-01-04 é a primeira de 2027). Não pode repetir índice nem pular 2.
t("virada de ano (semana 53) devia dar incremento mod 4", () => {
  const a = FP.weekIndexForDate(new Date(2026, 11, 28));
  const b = FP.weekIndexForDate(new Date(2027, 0, 4));
  assert.equal(b === (a + 1) % 4, true, `virada de ano (semana 53) devia dar ${(a + 1) % 4}, veio ${b}`);
});

// weeksSinceEpoch: mesma semana (qualquer dia dela) dá o mesmo número; semana seguinte é +1 exato.
t("mesma semana-calendário deve dar o mesmo weeksSinceEpoch", () => {
  assert.equal(FP.weeksSinceEpoch(new Date(2026, 8, 21)) === FP.weeksSinceEpoch(new Date(2026, 8, 23)),
    true);
});

t("semana seguinte deve ser weeksSinceEpoch + 1", () => {
  assert.equal(FP.weeksSinceEpoch(new Date(2026, 8, 28)) - FP.weeksSinceEpoch(new Date(2026, 8, 21)),
    1);
});

// done: mapa achatado por channelKey (25/09/2026 — antes era aninhado por semana real e
// resetava sozinho toda semana; agora só reseta no clique explícito de "Resetar semana").
// pruneProgress poda por idade da própria entrada (DONE_TTL, 400 dias), igual watched.
t("prune remove done muito antigo mas mantém recente", () => {
  const now = new Date(2026, 8, 21).getTime();
  const day = 86400000;
  const p = FP.emptyProgress();
  p.done.canalVelho = { t: now - 420 * day, on: true };
  p.done.canalRecente = { t: now - 14 * day, on: true };
  const pruned = FP.pruneProgress(p, now);
  assert(!("canalVelho" in pruned.done), "done de 420 dias atrás devia ter sido podado");
  assert("canalRecente" in pruned.done, "done de 14 dias atrás não devia ser podado");
});

t("done não reseta sozinho ao virar a semana (só migra formato antigo, não apaga)", () => {
  const p = FP.emptyProgress();
  FP.setEntry(p.done, "canalX", true, 10);
  // simula troca de semana: nada no app chama pruneProgress por virar semana, e o valor
  // permanece marcado indefinidamente até o clique explícito em "Resetar semana".
  assert.equal(FP.isOn(FP.mergeProgress(p, FP.emptyProgress()).done.canalX), true);
});

t("mergeProgress migra done aninhado antigo (\"wN\": {chKey: entry}) pro formato achatado", () => {
  const legado = FP.emptyProgress();
  legado.done["w2926"] = { canalX: { t: 10, on: true } };
  const atual = FP.mergeProgress(FP.emptyProgress(), legado);
  assert.equal(FP.isOn(atual.done.canalX), true);
  assert(!("w2926" in atual.done), "chave de semana antiga não devia sobreviver à migração");
});

t("channelKey usa channelId > handle > query", () => {
  assert.equal(FP.channelKey({ channelId: "UC1", handle: "h" }), "UC1");
  assert.equal(FP.channelKey({ handle: "h" }), "h");
  assert.equal(FP.channelKey({ query: "q" }), "q");
});

t("escapeHtml", () => {
  assert.equal(FP.escapeHtml(`<img src=x onerror="a()">&'`), "&lt;img src=x onerror=&quot;a()&quot;&gt;&amp;&#39;");
});

t("setEntry / isOn com túmulo", () => {
  const m = {};
  FP.setEntry(m, "v1", true, 10);
  assert.equal(FP.isOn(m.v1), true);
  FP.setEntry(m, "v1", false, 20);
  assert.equal(FP.isOn(m.v1), false);
  assert.equal(FP.isOn(undefined), false);
});

t("merge: o mais recente vence por chave, e une chaves", () => {
  const a = FP.emptyProgress(), b = FP.emptyProgress();
  FP.setEntry(a.watched, "v1", true, 10);
  FP.setEntry(b.watched, "v1", false, 20); // desmarcado depois
  FP.setEntry(a.watched, "v2", true, 30);
  FP.setEntry(b.watched, "v3", true, 5);
  FP.setEntry(a.done, "ch", true, 40);
  a.courses["P|C"] = { t: 1, lastLesson: "velha" };
  b.courses["P|C"] = { t: 2, lastLesson: "nova" };
  a.rot = { t: 1, p: 0, c: 0 }; b.rot = { t: 2, p: 1, c: 0 };
  const m = FP.mergeProgress(a, b);
  assert.equal(FP.isOn(m.watched.v1), false);
  assert.equal(FP.isOn(m.watched.v2), true);
  assert.equal(FP.isOn(m.watched.v3), true);
  assert.equal(FP.isOn(m.done.ch), true);
  assert.equal(m.courses["P|C"].lastLesson, "nova");
  assert.equal(m.rot.p, 1);
  assert.deepEqual(FP.mergeProgress(b, a), m); // comutativo
  assert.deepEqual(FP.mergeProgress(m, m), m); // idempotente
});

t("merge tolera dado remoto vazio ou malformado", () => {
  const a = FP.emptyProgress();
  FP.setEntry(a.watched, "v1", true, 10);
  for (const bad of [null, undefined, {}, { watched: "x", done: 3 }])
    assert.equal(FP.isOn(FP.mergeProgress(a, bad).watched.v1), true);
});

t("prune remove watched antigo e done antigo juntos", () => {
  const now = new Date(2026, 8, 21).getTime();
  const day = 86400000;
  const p = FP.emptyProgress();
  FP.setEntry(p.watched, "velho", true, now - 200 * day);
  FP.setEntry(p.watched, "novo", true, now - 10 * day);
  FP.setEntry(p.done, "x", true, now - 420 * day);
  FP.setEntry(p.done, "y", true, now);
  const r = FP.pruneProgress(p, now);
  assert.deepEqual(Object.keys(r.watched), ["novo"]);
  assert.deepEqual(Object.keys(r.done), ["y"]);
});

t("relDate em pt-BR", () => {
  const now = new Date("2026-09-21T12:00:00Z").getTime(), day = 86400000;
  const iso = (n) => new Date(now - n * day).toISOString();
  assert.equal(FP.relDate(iso(0), now), "hoje");
  assert.equal(FP.relDate(iso(1), now), "ontem");
  assert.equal(FP.relDate(iso(3), now), "há 3 dias");
  assert.equal(FP.relDate(iso(7), now), "semana passada");
  assert.equal(FP.relDate(iso(14), now), "há 2 semanas");
  assert.equal(FP.relDate(iso(60), now), "há 2 meses");
  assert.equal(FP.relDate(iso(400), now), "ano passado");
  assert.equal(FP.relDate(new Date(now + 3600000).toISOString(), now), "hoje"); // relógio adiantado
});

t("cache de 6h", () => {
  const now = 1e12, h = 3600000;
  assert.equal(FP.isFresh({ t: now - 5 * h }, now), true);
  assert.equal(FP.isFresh({ t: now - 7 * h }, now), false);
  assert.equal(FP.isFresh(undefined, now), false);
});

// progress.channels: mapa igual a watched/courses, sobrevive a mergeProgress/pruneProgress.
t("emptyProgress deve ter channels: {}", () => {
  const empty = FP.emptyProgress();
  assert("channels" in empty && Object.keys(empty.channels).length === 0);
});

// pruneProgress só poda watched/done — channels não tem TTL, tem que sobreviver intacto.
t("pruneProgress deve manter channels intacto", () => {
  const p = FP.emptyProgress();
  p.channels.x = { t: 1, on: true, group: 0, name: "X", channelId: "UCxxx" };
  const pruned = FP.pruneProgress(p, Date.now());
  assert.deepEqual(pruned.channels, p.channels);
});

// assignGroup: grupo com menos canais "on" ganha; empate vai pro menor índice.
t("assignGroup deve retornar grupo com menos canais on", () => {
  const chs = {
    a: { t: 1, on: true, group: 0 },
    b: { t: 1, on: true, group: 0 },
    c: { t: 1, on: true, group: 1 },
    d: { t: 1, on: false, group: 2 }, // desmarcado não conta
  };
  assert.equal(FP.assignGroup(chs), 2, `grupo 2 tem 0 canais on, devia ganhar, veio ${FP.assignGroup(chs)}`);
  assert.equal(FP.assignGroup({}), 0, "mapa vazio deve cair no grupo 0");
});

// migrateWeeksChannels: cada canal de WEEKS[i] vira uma entrada no grupo i, "on", com a
// mesma channelKey de FP.channelKey (pra não quebrar watched/done já salvos).
t("migrateWeeksChannels deve converter WEEKS para channels map", () => {
  const WEEKS = [
    { label: "Semana 1", channels: [{ name: "A", handle: "aa", type: "channel" }] },
    { label: "Semana 2", channels: [{ name: "B", channelId: "UCxxx", type: "channel" }] },
  ];
  const out = FP.migrateWeeksChannels(WEEKS, 42);
  assert(out.aa && out.aa.group === 0 && out.aa.on === true && out.aa.name === "A" && out.aa.t === 42,
    `esperava entrada "aa" no grupo 0, veio ${JSON.stringify(out.aa)}`);
  assert(out.UCxxx && out.UCxxx.group === 1 && out.UCxxx.channelId === "UCxxx",
    `esperava entrada "UCxxx" no grupo 1, veio ${JSON.stringify(out.UCxxx)}`);
});

// channelKey prioriza channelId — canal migrado com channelId E handle juntos (canal que já
// tinha sido resolvido antes da migração) tem que indexar pelo channelId, não pelo handle.
t("migrateWeeksChannels deve indexar por channelId quando canal tem channelId e handle juntos", () => {
  const WEEKS = [{ label: "Semana 1", channels: [{ name: "C", channelId: "UCyyy", handle: "cc", type: "channel" }] }];
  const out = FP.migrateWeeksChannels(WEEKS, 1);
  assert(out.UCyyy && out.UCyyy.channelId === "UCyyy" && out.UCyyy.handle === "cc",
    `esperava entrada indexada por "UCyyy" com handle preservado, veio ${JSON.stringify(out)}`);
  assert(!("cc" in out), "não devia haver entrada separada indexada por handle");
});

// resolveChannelEntry: casa inscrição OAuth (só tem channelId) com canal migrado por
// handle, via a ponte fp-chid (handle -> channelId, só existe se o canal já foi aberto).
t("resolveChannelEntry deve casar por channelId direto", () => {
  const channels = { UCxxx: { t: 1, on: true, group: 0, name: "B", channelId: "UCxxx" } };
  const [key, entry] = FP.resolveChannelEntry(channels, {}, "UCxxx");
  assert.equal(key, "UCxxx");
  assert.equal(entry.name, "B");
});

t("resolveChannelEntry deve casar canal migrado por handle via fp-chid", () => {
  const channels = { aa: { t: 1, on: true, group: 0, name: "A", handle: "aa" } };
  const chIds = { aa: "UCresolved" };
  const [key, entry] = FP.resolveChannelEntry(channels, chIds, "UCresolved");
  assert.equal(key, "aa");
  assert.equal(entry.handle, "aa");
});

t("resolveChannelEntry deve retornar [null,null] sem nenhum match", () => {
  const channels = { aa: { t: 1, on: true, group: 0, name: "A", handle: "aa" } };
  const [key, entry] = FP.resolveChannelEntry(channels, {}, "UCnovo");
  assert.equal(key, null);
  assert.equal(entry, null);
});

// mergeProgress: channels merge por timestamp igual watched (o mais novo vence).
t("mergeProgress deve fazer merge de channels por timestamp", () => {
  const a = FP.emptyProgress(); a.channels.x = { t: 1, on: true, group: 0, name: "X" };
  const b = FP.emptyProgress(); b.channels.x = { t: 2, on: false, group: 0, name: "X" };
  const merged = FP.mergeProgress(a, b);
  assert.equal(merged.channels.x.on, false, "merge de channels deve preferir o timestamp maior (t:2, on:false)");
  assert.deepEqual(FP.mergeProgress(b, a), merged, "merge de channels tem que ser comutativo");
});

// parseSearchQuery: extrai o termo de um link de busca do YouTube, ou usa texto puro.
t("parseSearchQuery deve extrair termo de um link de busca do YouTube", () => {
  const { query, name } = FP.parseSearchQuery("https://www.youtube.com/results?search_query=d+a+carson");
  assert.equal(query, "d a carson");
  assert.equal(name, "D A Carson");
});

t("parseSearchQuery deve decodificar acentos no link", () => {
  const { query } = FP.parseSearchQuery("https://www.youtube.com/results?search_query=serm%C3%B5es+de+billy+graham");
  assert.equal(query, "sermões de billy graham");
});

t("parseSearchQuery deve usar texto puro quando não é link", () => {
  const { query, name } = FP.parseSearchQuery("  andrea vargas  ");
  assert.equal(query, "andrea vargas");
  assert.equal(name, "Andrea Vargas");
});
