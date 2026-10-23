import test from "node:test";
import assert from "node:assert/strict";
import { norm, plain, addDays, diffDays, weekStart, shuffle, esc, dateStr } from "../js/util.js";
import { addCard, review, dueList, INTERVALS } from "../js/srs.js";
import { computeStreak, weekMinutes, weekGoal, xpForLesson, diagLevel } from "../js/progress.js";
import { S, load, save, reset, exportJSON, importJSON } from "../js/store.js";
import { t, setDict, missing } from "../js/i18n.js";
import { log, counts } from "../js/analytics.js";
import { buildReport, mailtoUrl } from "../js/report.js";
import fs from "node:fs";

test("norm: ударение, регистр, ё, пунктуация, таджикские буквы", () => {
  assert.equal(norm("Спаси́бо,"), "спасибо");
  assert.equal(norm("Хорошо́."), "хорошо");
  assert.equal(norm("ЁЖ"), "еж");
  assert.equal(norm("Ҳамсуҳбат"), "ҳамсуҳбат");
  assert.equal(plain("а́"), "а");
});
test("даты: addDays/diffDays/weekStart", () => {
  assert.equal(addDays("2026-10-31", 1), "2026-11-01");
  assert.equal(addDays("2026-03-01", -1), "2026-02-28");
  assert.equal(diffDays("2026-10-21", "2026-10-18"), 3);
  assert.equal(weekStart("2026-10-21"), "2026-10-19"); /* среда → понедельник */
  assert.equal(weekStart("2026-10-25"), "2026-10-19"); /* воскресенье */
});
test("shuffle: детерминирован и сохраняет элементы", () => {
  const a = [1, 2, 3, 4, 5], b = shuffle(a, 7), c = shuffle(a, 7);
  assert.deepEqual(b, c); assert.deepEqual([...b].sort(), a);
});
test("esc экранирует HTML", () => { assert.equal(esc('<a href="x">&\'</a>'), "&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;"); });

test("SRS: новая карточка, 'знаю' двигает по интервалам, 'не знаю' сбрасывает", () => {
  const s = {}; const T = "2026-10-21";
  assert.equal(addCard(s, "w1", T), true); assert.equal(addCard(s, "w1", T), false);
  assert.equal(s.w1.due, "2026-10-22");
  review(s, "w1", true, "2026-10-22"); assert.equal(s.w1.box, 1); assert.equal(s.w1.due, addDays("2026-10-22", INTERVALS[1]));
  review(s, "w1", true, "2026-10-25"); assert.equal(s.w1.due, addDays("2026-10-25", INTERVALS[2]));
  review(s, "w1", true, "2026-11-01"); assert.equal(s.w1.due, addDays("2026-11-01", INTERVALS[3]));
  review(s, "w1", true, "2026-11-15"); assert.equal(s.w1.box, 4); assert.equal(s.w1.due, addDays("2026-11-15", 30));
  review(s, "w1", false, "2026-12-20"); assert.equal(s.w1.box, 0); assert.equal(s.w1.due, "2026-12-21");
});
test("SRS: очередь на сегодня", () => {
  const s = {}; addCard(s, "a", "2026-10-20"); addCard(s, "b", "2026-10-25");
  assert.deepEqual(dueList(s, "2026-10-21"), ["a"]);
  assert.deepEqual(dueList(s, "2026-10-26"), ["a", "b"]);
  assert.deepEqual(dueList({}, "2026-10-21"), []);
});

test("серия: подряд, сегодня ещё не занимались", () => {
  assert.equal(computeStreak(["2026-10-19", "2026-10-20", "2026-10-21"], "2026-10-21"), 3);
  assert.equal(computeStreak(["2026-10-19", "2026-10-20"], "2026-10-21"), 2); /* вчера занимался, сегодня ещё нет */
  assert.equal(computeStreak([], "2026-10-21"), 0);
});
test("серия: одна пауза в неделю не обрывает", () => {
  /* пн, вт, [ср пропуск], чт; сегодня чт */
  assert.equal(computeStreak(["2026-10-19", "2026-10-20", "2026-10-22"], "2026-10-22"), 3);
  /* два пропуска в одной неделе: цепочка обрывается на втором */
  assert.equal(computeStreak(["2026-10-19", "2026-10-21", "2026-10-23"], "2026-10-23"), 2);
});
test("серия: перерыв из двух дней обрывает, но не штрафует за сегодня", () => {
  assert.equal(computeStreak(["2026-10-15", "2026-10-16"], "2026-10-21"), 0);
  assert.equal(computeStreak(["2026-10-19", "2026-10-20"], "2026-10-22"), 2); /* вчера пауза, сегодня можно продолжить */
});
test("цель недели и минуты", () => {
  assert.equal(weekGoal(15), 90);
  assert.equal(weekMinutes({ "2026-10-19": 10, "2026-10-21": 12.4, "2026-10-12": 99 }, "2026-10-22"), 22);
});
test("XP за урок", () => { assert.equal(xpForLesson(10, 14), 30); });

const diag = JSON.parse(fs.readFileSync(new URL("../data/diag.json", import.meta.url)));
test("диагностика: три уровня плана", () => {
  assert.equal(diagLevel(0, 0, diag.levels), 0);
  assert.equal(diagLevel(1, 4, diag.levels), 0);
  assert.equal(diagLevel(2, 4, diag.levels), 1);
  assert.equal(diagLevel(3, 3, diag.levels) , 2);
  assert.equal(diagLevel(2, 3, diag.levels), 1);
});

test("store: сохранение, экспорт/импорт, повреждённые данные", () => {
  reset(); S.settings.uiLang = "tg"; S.progress.xp = 42; save();
  const j = exportJSON(); S.progress.xp = 0; assert.equal(importJSON(j), true); assert.equal(S.progress.xp, 42);
  assert.equal(importJSON("не json"), false);
  assert.equal(importJSON(JSON.stringify({ state: { v: 2 } })), false);
  assert.equal(S.progress.xp, 42);
});
test("i18n: запасной язык и учёт отсутствующих ключей", () => {
  setDict({ ru: { a: "Привет, {n}", b: "только ru" }, tg: { a: "Салом, {n}" } });
  S.settings.uiLang = "tg"; assert.equal(t("a", { n: "Али" }), "Салом, Али"); assert.equal(t("b"), "только ru");
  assert.equal(t("zzz"), "zzz"); assert.ok(missing.includes("zzz"));
});
test("аналитика: фильтр полей, лимит записей, счётчики", () => {
  reset(); log("word_tap", { item: "w1", name: "Иван", phone: "123", voice: "x" });
  assert.deepEqual(S.events[0].p, { item: "w1" });
  for (let i = 0; i < 600; i++) log("x");
  assert.ok(S.events.length <= 500); assert.ok(counts().x >= 499);
});
test("отчёт: журнал только по согласию, письмо кодируется", () => {
  reset(); log("lesson_start"); 
  const a = buildReport("Звук", "не играет", false), b = buildReport("Звук", "не играет", true);
  assert.ok(!a.includes("технический журнал")); assert.ok(b.includes("технический журнал") && b.includes("lesson_start"));
  assert.ok(!/@|телефон:/i.test(a.replace("mailto", "")));
  assert.ok(mailtoUrl("a@b.c", "Тема", "стр1\nстр2").startsWith("mailto:a%40b.c?subject="));
});

test("store: импорт не портит Object.prototype (0.3.4, аудит М12)", () => {
  const bad = '{"state":{"v":1,"settings":{"name":"x"},"progress":{"lessons":{}},"__proto__":{"polluted":1},"srs":{"constructor":{"prototype":{"p2":1}}}}}';
  importJSON(bad);
  assert.equal({}.polluted, undefined);
  assert.equal({}.p2, undefined);
  assert.equal(S.settings.name, "x");
});

test("грамматика: темы и ссылки на задания (0.3.6)", () => {
  const G = JSON.parse(fs.readFileSync(new URL("../data/grammar.json", import.meta.url), "utf8"));
  const ids = new Set(G.topics.map(x => x.id));
  assert.equal(ids.size, G.topics.length, "повтор id темы");
  for (const tp of G.topics) {
    for (const k of ["title", "short", "rule", "compare"]) { assert.ok(tp[k].ru && tp[k].tg, tp.id + ": нет " + k); }
    assert.ok(tp.quiz.length >= 2, tp.id + ": мало вопросов");
    tp.quiz.forEach(q => assert.ok(q.a >= 0 && q.a < q.opts.length, tp.id + ": неверный ответ в проверке"));
    assert.ok(fs.existsSync(new URL("../data/lessons/" + tp.lesson + "/lesson.json", import.meta.url)), tp.id + ": нет урока");
  }
  for (const [lid, m] of Object.entries(G.links)) {
    const L = JSON.parse(fs.readFileSync(new URL("../data/lessons/" + lid + "/lesson.json", import.meta.url), "utf8"));
    const exIds = new Set(Object.values(L.exercises).flat().filter(e => e && e.id).map(e => e.id));
    const glIds = new Set((L.grammar_layer || []).map(g => g.id)), rIds = new Set((L.rules || []).map(r => r.id));
    for (const [k, v] of Object.entries(m.ex || {})) { assert.ok(exIds.has(k), lid + ": нет задания " + k); assert.ok(ids.has(v)); }
    for (const [k, v] of Object.entries(m.gl || {})) { assert.ok(glIds.has(k), lid + ": нет слова " + k); assert.ok(ids.has(v)); }
    for (const [k, v] of Object.entries(m.rules || {})) { assert.ok(rIds.has(k), lid + ": нет правила " + k); assert.ok(ids.has(v)); }
  }
});
