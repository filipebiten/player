// Rodar: node tests/lib.test.mjs
import assert from "node:assert/strict";
import FP from "../lib.js";

const t = (name, fn) => { fn(); console.log("ok  " + name); };
const d = (y, m, day) => new Date(y, m - 1, day, 12);

t("semana pelo dia do mês", () => {
  const exp = { 1: 0, 7: 0, 8: 1, 14: 1, 15: 2, 21: 2, 22: 3, 28: 3, 29: 3, 31: 3 };
  for (const [day, w] of Object.entries(exp)) assert.equal(FP.weekIndexForDate(d(2026, 8, +day)), w, `dia ${day}`);
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
  assert.equal(FP.relDate(iso(14), now), "há 2 semanas");
  assert.equal(FP.relDate(iso(60), now), "há 2 meses");
  assert.equal(FP.relDate(iso(400), now), "há 1 ano");
});

t("cache de 6h", () => {
  const now = 1e12, h = 3600000;
  assert.equal(FP.isFresh({ t: now - 5 * h }, now), true);
  assert.equal(FP.isFresh({ t: now - 7 * h }, now), false);
  assert.equal(FP.isFresh(undefined, now), false);
});
