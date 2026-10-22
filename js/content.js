import { norm } from "./util.js";
import { S } from "./store.js";
/* Содержимое: курсы (пути a и b), уроки, диагностики. «Текущий урок» (C.lesson) переключается через setCurrent(id). */
export const C = { courses: null, lessons: {}, diag: {}, cur: null, lesson: null, lessonMeta: null, timings: null, idx: { word: {}, grammar: {} } };
const NAMES = ["анна", "руслан"];
async function getJSON(url) { const r = await fetch(url); if (!r.ok) throw new Error("HTTP " + r.status + " " + url); return r.json(); }
export async function loadAll() {
  C.courses = await getJSON("data/courses.json");
  const [da, db] = await Promise.all([getJSON("data/diag.json"), getJSON("data/diag_b.json").catch(() => null)]);
  C.diag = { a: da, b: db };
  const metas = [];
  C.courses.courses.forEach(c => c.lessons.forEach(l => { if (l.path) metas.push(Object.assign({ track: c.id }, l)); }));
  await Promise.all(metas.map(async m => {
    const data = await getJSON(m.path); let timings = null;
    if (m.audio && m.audio.sets) { timings = {}; await Promise.all(Object.entries(m.audio.sets).map(async ([k, path]) => { try { const tj = await getJSON(path); timings[k] = {}; tj.lines.forEach(l => { timings[k][l.id] = l; }); } catch (e) { /* без таймингов: подсветка по оценке */ } })); }
    C.lessons[m.id] = { meta: m, data, timings };
  }));
  setCurrent(nextLessonId() || firstLessonId());
  return C;
}
export const track = () => S.settings.track || "a";
export const courseOf = tr => C.courses.courses.find(c => c.id === (tr || track()));
export const trackLessons = tr => (courseOf(tr) ? courseOf(tr).lessons.filter(l => l.path) : []);
export const firstLessonId = () => { const l = trackLessons()[0] || Object.values(C.lessons)[0].meta; return l.id; };
export const lessonDoneId = id => { const r = S.progress.lessons[id]; return !!r && (r.status === "done" || r.status === "skipped"); };
/* порядок уроков пути: по результату диагностики (S.order[track]) или по порядку курса */
export function orderedLessons(tr) {
  const base = trackLessons(tr), ord = (S.order && S.order[tr || track()]) || [];
  return base.slice().sort((x, y) => { const a = ord.indexOf(x.id), b = ord.indexOf(y.id); return (a < 0 ? 99 : a) - (b < 0 ? 99 : b) || base.indexOf(x) - base.indexOf(y); });
}
export const nextLessonId = tr => { const l = orderedLessons(tr).find(x => !lessonDoneId(x.id)); return l ? l.id : null; };
export function setCurrent(id) {
  const L = C.lessons[id]; if (!L) return false;
  C.cur = id; C.lesson = L.data; C.lessonMeta = L.meta; C.timings = L.timings; buildIndex(); return true;
}
export function buildIndex() {
  const L = C.lesson; C.idx = { word: {}, grammar: {} };
  L.words.forEach(w => { C.idx.word[norm(w.ru)] = w; });
  L.grammar_layer.forEach(g => { grammarTokens(g).forEach(k => { if (!C.idx.grammar[k]) C.idx.grammar[k] = g; }); });
}
export const grammarTokens = g => (g.tokens && g.tokens.length ? g.tokens : [norm(g.word)]).map(norm);
export const isName = n => NAMES.includes(n);
export function findWord(n) {
  if (C.idx.word[n]) return C.idx.word[n];
  for (const k in C.lessons) { const w = C.lessons[k].data.words.find(x => norm(x.ru) === n); if (w) return w; }
  return null;
}
export const lessonOfTopic = tp => { const l = trackLessons("b").find(x => x.topic === tp); return l ? l.id : null; };
/* разбор по слову; если известна строка текста — сначала ищем среди разборов этой строки (контекст предложения) */
export function findGrammar(n, lineIdx) {
  const L = C.lesson;
  if (lineIdx != null && L.text[lineIdx]) { const ids = L.text[lineIdx].grammar || []; for (const id of ids) { const g = L.grammar_layer.find(x => x.id === id); if (g && grammarTokens(g).includes(n)) return g; } }
  if (C.idx.grammar[n]) return C.idx.grammar[n];
  if (isName(n)) return L.grammar_layer.find(g => g.id === "g_anna") || null;
  for (const k in C.lessons) { const g = C.lessons[k].data.grammar_layer.find(x => grammarTokens(x).includes(n)); if (g) return g; }
  return null;
}
export function wordById(id) { for (const k in C.lessons) { const w = C.lessons[k].data.words.find(x => x.id === id); if (w) return w; } return null; }
export function exById(id) {
  const E = C.lesson.exercises;
  for (const k of ["truefalse", "choice", "builder", "dictation", "pictures", "meaning", "gap"]) { const x = (E[k] || []).find(e => e.id === id); if (x) return Object.assign({ type: k }, x); }
  if (E.free && E.free.id === id) return Object.assign({ type: "free" }, E.free);
  return null;
}
export const audioBase = () => (C.lessonMeta && C.lessonMeta.audio ? C.lessonMeta.audio.base : null);
