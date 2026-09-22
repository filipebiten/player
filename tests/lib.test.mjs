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

t("chave ano-mês-semana zera no mês seguinte", () => {
  assert.equal(FP.doneKey(d(2026, 9, 21), 2), "2026-09-3");
  assert.notEqual(FP.doneKey(d(2026, 9, 21), 2), FP.doneKey(d(2026, 10, 21), 2));
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
  FP.setEntry(a.done["2026-09-3"] = {}, "ch", true, 40);
  a.courses["P|C"] = { t: 1, lastLesson: "velha" };
  b.courses["P|C"] = { t: 2, lastLesson: "nova" };
  a.rot = { t: 1, p: 0, c: 0 }; b.rot = { t: 2, p: 1, c: 0 };
  const m = FP.mergeProgress(a, b);
  assert.equal(FP.isOn(m.watched.v1), false);
  assert.equal(FP.isOn(m.watched.v2), true);
  assert.equal(FP.isOn(m.watched.v3), true);
  assert.equal(FP.isOn(m.done["2026-09-3"].ch), true);
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

t("prune remove watched antigo e meses muito antigos", () => {
  const now = Date.UTC(2026, 8, 21), day = 86400000;
  const p = FP.emptyProgress();
  FP.setEntry(p.watched, "velho", true, now - 200 * day);
  FP.setEntry(p.watched, "novo", true, now - 10 * day);
  p.done["2024-01-1"] = { x: { t: 1, on: true } };
  p.done["2026-09-3"] = { y: { t: now, on: true } };
  const r = FP.pruneProgress(p, now);
  assert.deepEqual(Object.keys(r.watched), ["novo"]);
  assert.deepEqual(Object.keys(r.done), ["2026-09-3"]);
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
