/* Вкладка «Грамматика» (0.3.6): темы простыми словами — правило, сравнение с таджикским, примеры с озвучкой,
   частые ошибки и короткая проверка. Тема открывается, когда ученик дошёл до её урока.
   Из урока (после ответа, в окне «Чаро чунин?», на странице правил) — кнопка «Подробнее»;
   на странице темы — «Вернуться к уроку»: ровно на то же задание (то же делают стрелка «назад» и кнопка «назад» телефона).
   Тексты — data/grammar.json (правится напрямую с 0.3.7); таджикские — черновик для проверки носителем. */
import { app } from "../app.js";
import { S, save } from "../store.js";
import { t, ui } from "../i18n.js";
import { C, track, orderedLessons, lessonDoneId, nextLessonId } from "../content.js";
import { esc, plain } from "../util.js";
import { top, band, IC, playIcon } from "../ui.js";
import * as audio from "../audio.js";
import { log } from "../analytics.js";
import { tx } from "./glossary.js";

const R = app.R, ACT = app.ACT;
export const topics = () => (C.grammar && C.grammar.topics) || [];
export const topicById = id => topics().find(x => x.id === id) || null;
/* тема для задания (kind "ex"), слова из «Чаро чунин?» ("gl") или правила урока ("rules") */
export const topicFor = (lid, kind, key) => { const m = C.grammar && C.grammar.links && C.grammar.links[lid]; const id = m && m[kind] && m[kind][key]; return id ? topicById(id) : null; };
const reached = lid => lessonDoneId(lid) || !!S.progress.lessons[lid] || nextLessonId(track()) === lid || (S.resume && S.resume.l === lid);
export const isOpen = tp => !!tp && reached(tp.lesson);
const lessonNo = lid => orderedLessons(track()).findIndex(l => l.id === lid) + 1;
const gstate = id => (S.gram && S.gram[id]) || {};

/* кнопка «Подробнее» для урока: strong — после ошибки (заметная), иначе — скромная ссылка */
export const moreBtn = (tp, strong) => tp ? '<button class="gmore' + (strong ? " strong" : "") + '" data-act="gmore" data-v="' + tp.id + '"><span class="gmi" aria-hidden="true">' + GI + '</span><span class="grow"><b>' + t("g_more_btn") + '</b><span class="small" style="display:block">' + esc(plain(ui(tp.title))) + '</span></span><span aria-hidden="true">→</span></button>' : "";
export const GI = '<svg viewBox="0 0 24 24"><path d="M3.5 18.5l4.5-13 4.5 13M5 14h6"/><path d="M15 8.5h5.5M15 12.5h5.5M15 16.5h4"/></svg>';

ACT.gmore = e => {
  const id = e.dataset.v; if (!topicById(id)) return;
  pushRet();
  app.st.gt = id; app.st.gq = null; log("grammar_more", { topic: id, from: app.cur }); app.go("gtopic");
};
/* Возврат (0.3.7): стопка «откуда пришли». «Подробнее» (тема или термин) кладёт запись: экран, открытое окно слова
   или карточку термина и глубину. «Назад» со страницы, открытой так, снимает запись и снова открывает окно,
   из которого пришли (main.js → app.back). Так цепочка урок → тема → термин → назад → назад возвращает ровно на то же задание. */
export function pushRet() {
  const s = (app.st.gs || []).filter(r => r.at <= app.stack.length);
  s.push({ from: app.cur, sheet: app.st.sheet ? Object.assign({}, app.st.sheet) : null, at: app.stack.length + 1 });
  app.st.gs = s;
}
export const curRet = () => { const s = app.st.gs || [], r = s[s.length - 1]; return r && r.at === app.stack.length && app.stack[app.stack.length - 1] === r.from ? r : null; };
app.retTop = curRet;
ACT.gret = () => app.back();
ACT.gopen = e => { const tp = topicById(e.dataset.v); if (!tp) return; if (!isOpen(tp)) { app.st.glock = app.st.glock === tp.id ? null : tp.id; app.render(true); return; } app.st.gt = tp.id; app.st.gq = null; app.go("gtopic"); };
ACT.gsay = e => audio.playText(plain(e.dataset.v));

/* ---------- список тем ---------- */
R.grammar = () => {
  const tr = track(), ls = orderedLessons(tr), all = topics().filter(x => x.track === tr);
  const groups = ls.map(l => {
    const tps = all.filter(x => x.lesson === l.id); if (!tps.length) return "";
    const L = C.lessons[l.id], ttl = L ? ui(L.meta.title) : "";
    return '<h3 class="glh">' + t("g_lesson", { n: lessonNo(l.id), t: esc(ttl) }) + '</h3><div class="mlist">' + tps.map(tp => {
      const open = isOpen(tp), st = gstate(tp.id), done = open && st.best != null && st.best >= tp.quiz.length;
      return '<button class="mrow gtile' + (open ? "" : " locked") + '" data-act="gopen" data-v="' + tp.id + '"' + (open ? "" : ' aria-expanded="' + (app.st.glock === tp.id) + '"') + '><span class="micon' + (done ? " ok" : "") + '" aria-hidden="true">' + (done ? IC.check : open ? GI : LOCK) + '</span><span class="grow"><b>' + esc(ui(tp.title)) + '</b><span class="small" style="display:block">' + (open ? esc(ui(tp.short)) : t("g_locked", { n: lessonNo(tp.lesson) })) + "</span></span>" + CHEV + "</button>" + (!open && app.st.glock === tp.id ? lockCard(tp) : "");
    }).join("") + "</div>";
  }).join("");
  const gl = C.glossary ? '<button class="mrow gloss-entry" data-act="glossopen"><span class="micon" aria-hidden="true">' + GI + '</span><span class="grow"><b>' + t("gl_title") + '</b><span class="small" style="display:block">' + t("gl_entry", { n: C.glossary.terms.length }) + "</span></span>" + CHEV + "</button>" : "";
  return band() + "<h1>" + t("g_title") + '</h1><p class="sub">' + t("g_sub") + "</p>" + gl + (groups || '<p class="sub">' + t("g_none") + "</p>");
};
/* закрытая тема (аудит 2.3): одна строка правила и путь к уроку, где она откроется */
const lockCard = tp => { const L = C.lessons[tp.lesson], ttl = L ? ui(L.meta.title) : ""; return '<div class="card glock" role="note"><p style="margin:0 0 6px">' + esc(ui(tp.short)) + '</p><p class="small" style="margin:0 0 10px">' + t("g_lock_how", { n: lessonNo(tp.lesson) || 1, t: esc(ttl) }) + '</p><button class="btn sec" data-go="home">' + t("g_lock_go") + "</button></div>"; };
const CHEV = '<svg class="mchev" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>';
const LOCK = '<svg viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/></svg>';

/* ---------- страница темы ---------- */
R.gtopic = () => {
  const tp = topicById(app.st.gt); if (!tp) return R.grammar();
  if (!gstate(tp.id).seen) { S.gram = S.gram || {}; S.gram[tp.id] = Object.assign({}, gstate(tp.id), { seen: true }); save(); }
  const ret = curRet(), fromLesson = !!ret;
  const table = (tp.table || []).length ? '<div class="gtable" role="table">' + tp.table.map(r => '<div class="gtr" role="row"><span role="cell" lang="ru">' + esc(r[0]) + '</span><span class="garr" aria-hidden="true">→</span><b role="cell" lang="ru">' + esc(r[1]) + "</b></div>").join("") + "</div>" : "";
  const exs = (tp.examples || []).map(x => '<div class="gexr"><button class="play" data-act="gsay" data-v="' + esc(x.ru) + '" aria-label="' + t("listen") + ": " + esc(plain(x.ru)) + '">' + IC.play + '</button><div><b lang="ru">' + esc(x.ru) + '</b><span class="tr" lang="tg">' + esc(x.tg) + "</span></div></div>").join("");
  const errs = (tp.mistakes || []).map(m => '<div class="gerr"><p class="gw"><span class="gx" aria-hidden="true">✕</span><s lang="ru">' + esc(m.wrong) + '</s><span class="sr">' + t("wrong_h") + '</span></p><p class="gr2"><span class="gv" aria-hidden="true">✓</span><b lang="ru">' + esc(m.right) + '</b><span class="sr">' + t("right_h") + '</span></p><p class="small">' + tx(ui(m.why)) + "</p></div>").join("");
  const gq = app.st.gq && app.st.gq.id === tp.id ? app.st.gq : { id: tp.id, ans: {} };
  const quiz = tp.quiz.map((x, qi) => {
    const a = gq.ans[qi];
    const opts = x.opts.map((o, oi) => { let cls = "choice"; if (a != null) { if (oi === x.a) cls += " good right"; else if (oi === a) cls += " soft"; } return '<button class="' + cls + '" data-act="gans" data-q="' + qi + '" data-v="' + oi + '"' + (a != null ? " disabled" : "") + ' lang="ru">' + esc(o) + "</button>"; }).join("");
    const fb = a != null ? '<p class="small" role="status" style="margin:6px 0 0"><b>' + (a === x.a ? t("fb_ok") : t("fb_bad")) + "</b> " + tx(ui(x.expl)) + "</p>" : "";
    return '<div class="card gq"><p style="margin:0 0 8px"><b>' + (qi + 1) + ". " + esc(ui(x.q)) + '</b></p><div style="display:grid;gap:8px">' + opts + "</div>" + fb + "</div>";
  }).join("");
  const answered = Object.keys(gq.ans).length, okN = tp.quiz.filter((x, i) => gq.ans[i] === x.a).length;
  const res = answered === tp.quiz.length ? '<p class="center"><span class="badge g">' + t("g_res", { a: gq.first != null ? gq.first : okN, b: tp.quiz.length }) + "</span></p>" + (okN < tp.quiz.length ? '<button class="btn sec" data-act="gfix">' + t("fix_title") + "</button>" : "") : "";
  const bl = fromLesson && ["exer", "lesson", "rules"].includes(ret.from) ? t("g_back_lesson") : t("g_back");
  const foot = fromLesson ? '<button class="btn" data-act="gret">' + bl + "</button>" : '<button class="btn sec" data-back>' + t("g_all") + "</button>";
  return top(t("g_title")) + "<h1 class=\"gh\">" + esc(ui(tp.title)) + "</h1>" +
    (fromLesson ? '<button class="gbackl" data-act="gret">← ' + bl + "</button>" : "") +
    '<div class="card grule"><p class="gshort">' + tx(ui(tp.short)) + "</p><p>" + tx(ui(tp.rule)) + "</p></div>" + table +
    '<div class="card gcmp"><b>' + t("g_cmp") + "</b><p>" + tx(ui(tp.compare)) + "</p></div>" +
    "<h3>" + t("g_ex") + '</h3><div class="gexs">' + exs + "</div>" +
    (errs ? "<h3>" + t("g_err") + "</h3>" + errs : "") +
    "<h3>" + t("g_quiz") + "</h3>" + quiz + res + foot;
};
ACT.gans = e => {
  const tp = topicById(app.st.gt); if (!tp) return;
  const gq = app.st.gq && app.st.gq.id === tp.id ? app.st.gq : (app.st.gq = { id: tp.id, ans: {} });
  const qi = +e.dataset.q; if (gq.ans[qi] != null) return; gq.ans[qi] = +e.dataset.v;
  if (Object.keys(gq.ans).length === tp.quiz.length && gq.first == null) {
    const okN = tp.quiz.filter((x, i) => gq.ans[i] === x.a).length, st = gstate(tp.id);
    S.gram = S.gram || {}; S.gram[tp.id] = Object.assign({}, st, { seen: true, best: Math.max(st.best || 0, okN) }); save(); gq.first = okN;
    log("grammar_quiz", { topic: tp.id, ok: okN, n: tp.quiz.length });
  }
  app.render(true);
};
/* 0.3.8: «Исправляем ошибки» — неверно отвеченные вопросы открываются снова (оценка остаётся по первой попытке) */
ACT.gfix = () => { const tp = topicById(app.st.gt), gq = app.st.gq; if (!tp || !gq) return; tp.quiz.forEach((x, i) => { if (gq.ans[i] !== x.a) delete gq.ans[i]; }); app.render(true); const q = document.querySelector(".gq button.choice:not([disabled])"); if (q) q.scrollIntoView({ block: "center" }); };
