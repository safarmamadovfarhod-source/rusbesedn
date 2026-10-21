import { norm } from "./util.js";
export const C = { courses: null, lesson: null, lessonMeta: null, timings: null, diag: null, idx: { word: {}, grammar: {} } };
const NAMES = ["анна", "руслан"];
async function getJSON(url) { const r = await fetch(url); if (!r.ok) throw new Error("HTTP " + r.status + " " + url); return r.json(); }
export async function loadAll() {
  C.courses = await getJSON("data/courses.json");
  C.diag = await getJSON("data/diag.json");
  const first = C.courses.courses[0].lessons.find(l => l.path);
  C.lessonMeta = first;
  C.lesson = await getJSON(first.path);
  C.timings = null;
  if (first.audio && first.audio.timings) { try { const tj = await getJSON(first.audio.timings); C.timings = {}; tj.lines.forEach(l => C.timings[l.id] = l); } catch (e) { C.timings = null; } }
  buildIndex();
  return C;
}
export function buildIndex() {
  const L = C.lesson; C.idx = { word: {}, grammar: {} };
  L.words.forEach(w => { C.idx.word[norm(w.ru)] = w; });
  L.grammar_layer.forEach(g => { if (g.id === "g_a_uvas") ["а", "у", "вас"].forEach(k => { C.idx.grammar[k] = g; }); else C.idx.grammar[norm(g.word)] = g; });
}
export const isName = n => NAMES.includes(n);
export function findWord(n) { return C.idx.word[n] || null; }
export function findGrammar(n) { return C.idx.grammar[n] || (isName(n) ? C.lesson.grammar_layer.find(g => g.id === "g_anna") : null); }
export const wordById = id => C.lesson.words.find(w => w.id === id);
export function exById(id) {
  const E = C.lesson.exercises;
  for (const k of ["truefalse", "choice", "builder", "dictation", "pictures"]) { const x = E[k].find(e => e.id === id); if (x) return Object.assign({ type: k }, x); }
  if (E.free && E.free.id === id) return Object.assign({ type: "free" }, E.free);
  return null;
}
export const audioBase = () => (C.lessonMeta && C.lessonMeta.audio ? C.lessonMeta.audio.base : null);
