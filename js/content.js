import { norm } from "./util.js";
import { S } from "./store.js";
/* Содержимое: курсы (пути a и b), уроки, диагностики. «Текущий урок» (C.lesson) переключается через setCurrent(id). */
export const C = { grammar: null, glossary: null, courses: null, lessons: {}, diag: {}, cur: null, lesson: null, lessonMeta: null, timings: null, idx: { word: {}, grammar: {} }, say: {} };
const NAMES = ["шарора", "манучехр"]; /* 0.3.8: герои — Шарора и Манучехр */
async function getJSON(url) { const r = await fetch(url); if (!r.ok) throw new Error("HTTP " + r.status + " " + url); return r.json(); }
export async function loadAll() {
  C.courses = await getJSON("data/courses.json");
  const [da, db] = await Promise.all([getJSON("data/diag.json"), getJSON("data/diag_b.json").catch(() => null)]);
  C.diag = { a: da, b: db };
  [C.grammar, C.glossary] = await Promise.all([getJSON("data/grammar.json").catch(() => null), getJSON("data/glossary.json").catch(() => null)]); /* темы вкладки «Грамматика» (0.3.6) и словарь терминов (0.3.7) */
  /* 0.3.10: уроки загружаются по требованию. При старте — только список (meta из courses.json, с краткой сводкой sum)
     и один урок: тот, что человек откроет следующим. Остальные — ensureLesson(id) перед использованием. */
  C.courses.courses.forEach(c => c.lessons.forEach(l => { if (l.path) C.lessons[l.id] = { meta: Object.assign({ track: c.id }, l), data: null, timings: null }; }));
  const first = nextLessonId() || firstLessonId();
  /* нужный урок может быть ещё не скачан, а сети нет (например, путь сменили без интернета):
     тогда берём любой скачанный, чтобы приложение открылось; сам урок загрузится при нажатии «Начать» */
  let cur = null;
  for (const id of [first].concat(Object.keys(C.lessons).filter(k => k !== first))) { try { await ensureLesson(id); cur = id; break; } catch (e) { /* пробуем следующий */ } }
  if (!cur) throw new Error("нет ни одного урока: нужен интернет");
  setCurrent(cur);
  return C;
}
const ver = m => (m.v ? "?v=" + m.v : "");
const pending = {};
/* Загрузить урок (и тайминги озвучки), если он ещё не в памяти. Повторные вызовы ждут ту же загрузку. */
export function ensureLesson(id) {
  const L = C.lessons[id]; if (!L) return Promise.reject(new Error("нет урока " + id)); if (L.data) return Promise.resolve(L);
  if (!pending[id]) pending[id] = (async () => {
    try {
      const m = L.meta, data = await getJSON(m.path + ver(m)); let timings = null;
      if (m.audio && m.audio.sets) { timings = {}; await Promise.all(Object.entries(m.audio.sets).map(async ([k, path]) => { try { const tj = await getJSON(path + ver(m)); timings[k] = {}; tj.lines.forEach(l => { timings[k][l.id] = l; }); } catch (e) { /* без таймингов: подсветка по оценке */ } })); }
      (data.words || []).forEach(w => { if (w.say && w.audio) C.say[w.audio] = w.say; });  /* 0.4.7: у слова звучит пример (поле say), а не само слово */
      L.timings = timings; L.data = data; return L;
    } finally { delete pending[id]; }
  })();
  return pending[id];
}
/* несколько уроков; недоступные (нет сети и нет в кэше) пропускаются */
export const ensureLessons = ids => Promise.all(ids.map(id => ensureLesson(id).catch(() => null)));
export const isLoaded = id => !!(C.lessons[id] && C.lessons[id].data);
/* загрузить и сделать текущим; ошибка загрузки — исключение (вызывающий показывает сообщение) */
export async function useLesson(id) { await ensureLesson(id); return setCurrent(id); }
/* в каком уроке слово (по сводке из courses.json) и загрузка уроков для списка слов: нужно повторению */
export function lessonOfWord(wid) { for (const k in C.lessons) { const s = C.lessons[k].meta.sum; if (s && s.words && s.words.includes(wid)) return k; } return null; }
export const ensureWords = ids => ensureLessons([...new Set(ids.map(lessonOfWord).filter(Boolean))]);
/* ближайшие непройденные уроки пути — в фоне: откроются сразу и без интернета */
/* 0.4.7: звук скачивается заранее только для одного следующего урока (решение автора 15.11.2026): для ближайшего непройденного,
   а когда урок открыт — ещё и для того, что идёт сразу за ним (см. cacheAudioAhead). */
/* «Экономия трафика» в настройках телефона: звук заранее не качаем (сам урок и звук открытого урока — как обычно) */
const saveData = () => { try { return !!(navigator.connection && navigator.connection.saveData); } catch (e) { return false; } };
export function prefetchNext(n) { try { orderedLessons().filter(l => !lessonDoneId(l.id)).slice(0, n || 2).forEach((l, i) => { ensureLesson(l.id).then(() => { if (i === 0 && !saveData()) cacheAudio(l.id); }).catch(() => { }); }); } catch (e) { } }
export function cacheAudioAhead(id) { try { const list = orderedLessons(), i = list.findIndex(l => l.id === id), nx = i >= 0 ? list[i + 1] : null; if (nx && !saveData()) ensureLesson(nx.id).then(() => cacheAudio(nx.id)).catch(() => { }); } catch (e) { } }
/* Озвучка урока — в фоне в кэш уроков (оба голоса, обычный темп), по 3 файла одновременно: скачанный урок звучит без интернета.
   Медленный темп кэшируется при первом прослушивании. Работает, только когда сервис-воркер уже управляет страницей. */
export function cacheAudio(id) {
  const L = C.lessons[id]; if (!L || !L.data || !L.meta.audio || !L.timings || L.audioQueued) return;
  if (typeof navigator === "undefined" || !navigator.serviceWorker || !navigator.serviceWorker.controller) return;
  L.audioQueued = true; const a = L.meta.audio, urls = [];
  ["f_n", "m_n"].forEach(set => { const tm = L.timings[set]; if (!tm) return; const [v, tp] = set.split("_"); Object.keys(tm).forEach(k => urls.push(a.base + "/" + v + "/" + tp + "/" + k + "." + a.ext + ver(L.meta))); });
  let i = 0; const next = () => { if (i >= urls.length) return; fetch(urls[i++]).catch(() => { }).then(next); }; next(); next(); next();
}
/* При самом первом открытии сервис-воркер ещё не управляет страницей, и загруженный урок проходит мимо его кэша.
   Когда он начинает управлять, запрашиваем уже загруженные уроки ещё раз (браузер отдаёт их из своего кэша, без трафика):
   так первый урок остаётся доступным без интернета сразу после первой загрузки. */
export function recacheLoaded() { Object.values(C.lessons).filter(L => L.data).forEach(L => { try { fetch(L.meta.path + ver(L.meta)).catch(() => { }); if (L.meta.audio && L.meta.audio.sets) Object.values(L.meta.audio.sets).forEach(p => fetch(p + ver(L.meta)).catch(() => { })); } catch (e) { } }); if (C.cur) cacheAudio(C.cur); }
/* сводка урока из courses.json (заголовок диалога, «Я могу…», id слов) — доступна без загрузки урока */
export const sumOf = id => (C.lessons[id] && C.lessons[id].meta.sum) || { can: [], scenario: {}, words: [], nw: 0 };
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
  const L = C.lessons[id]; if (!L || !L.data) return false;
  C.cur = id; C.lesson = L.data; C.lessonMeta = L.meta; C.timings = L.timings; buildIndex(); return true;
}
export function buildIndex() {
  const L = C.lesson; C.idx = { word: {}, grammar: {} };
  L.words.forEach(w => { C.idx.word[norm(w.ru)] = w; });
  L.grammar_layer.forEach(g => { grammarTokens(g).forEach(k => { if (!C.idx.grammar[k]) C.idx.grammar[k] = g; }); });
}
export const grammarTokens = g => (g.tokens && g.tokens.length ? g.tokens : [norm(g.word)]).map(norm);
/* 0.4.0: имена героев + имена из самого урока (поле names в lesson.json) */
export const isName = n => NAMES.includes(n) || !!(C.lesson && C.lesson.names && C.lesson.names.includes(n));
export function findWord(n) {
  if (C.idx.word[n]) return C.idx.word[n];
  for (const k in C.lessons) { if (!C.lessons[k].data) continue; const w = C.lessons[k].data.words.find(x => norm(x.ru) === n); if (w) return w; }
  return null;
}
export const lessonOfTopic = tp => { const l = trackLessons("b").find(x => x.topic === tp); return l ? l.id : null; };
/* разбор по слову; если известна строка текста — сначала ищем среди разборов этой строки (контекст предложения) */
export function findGrammar(n, lineIdx) {
  const L = C.lesson;
  if (lineIdx != null && L.text[lineIdx]) { const ids = L.text[lineIdx].grammar || []; for (const id of ids) { const g = L.grammar_layer.find(x => x.id === id); if (g && grammarTokens(g).includes(n)) return g; } }
  if (C.idx.grammar[n]) return C.idx.grammar[n];
  if (isName(n)) return L.grammar_layer.find(g => g.id === "g_anna") || null;
  for (const k in C.lessons) { if (!C.lessons[k].data) continue; const g = C.lessons[k].data.grammar_layer.find(x => grammarTokens(x).includes(n)); if (g) return g; }
  return null;
}
export function wordById(id) { for (const k in C.lessons) { if (!C.lessons[k].data) continue; const w = C.lessons[k].data.words.find(x => x.id === id); if (w) return w; } return null; }
export function exById(id) {
  const E = C.lesson.exercises;
  for (const k of ["truefalse", "choice", "builder", "dictation", "pictures", "meaning", "gap"]) { const x = (E[k] || []).find(e => e.id === id); if (x) return Object.assign({ type: k }, x); }
  if (E.free && E.free.id === id) return Object.assign({ type: "free" }, E.free);
  return null;
}
export const audioBase = () => (C.lessonMeta && C.lessonMeta.audio ? C.lessonMeta.audio.base : null);
export const audioVer = () => (C.lessonMeta ? ver(C.lessonMeta) : "");
