/* Словарь терминов (0.3.7). Слова вроде «существительное», «падеж», «совершенный вид» в объяснениях
   подсвечены (цвет, пунктир, «?»). Нажатие открывает карточку снизу: простое определение, вопрос, примеры
   с озвучкой, сравнение с таджикским и «Подробнее» (полная страница термина). Все термины — в разделе
   «Словарь терминов» вкладки «Грамматика». Тексты — data/glossary.json; таджикские — черновик для носителя. */
import { app } from "../app.js";
import { t, ui, lang } from "../i18n.js";
import { C } from "../content.js";
import { esc, plain } from "../util.js";
import { top, IC } from "../ui.js";
import { topicById, isOpen, GI, pushRet, curRet } from "./grammar.js";
import { log } from "../analytics.js";

const R = app.R, ACT = app.ACT;
export const gterms = () => (C.glossary && C.glossary.terms) || [];
export const termById = id => gterms().find(x => x.id === id) || null;

/* одна регулярка на все термины: группа на термин; составные образцы («родительный падеж») — раньше простых («падеж») */
let RX = null, IDS = [], RXL = "";
function rx() {
  const L = lang();
  if (RX !== null && RXL === L) return RX;
  RXL = L; RX = false; IDS = [];
  const list = gterms().map(x => ({ id: x.id, pats: [].concat((x.match && x.match.ru) || [], (x.match && x.match.tg) || []) })).filter(x => x.pats.length);
  list.sort((a, b) => Math.max(...b.pats.map(p => p.split(" ").length)) - Math.max(...a.pats.map(p => p.split(" ").length)));
  if (!list.length) return RX;
  try {
    RX = new RegExp("(?<![\\p{L}\\u0301-])(?:" + list.map(x => "(" + x.pats.join("|") + ")").join("|") + ")(?![\\p{L}\\u0301])", "giu");
    IDS = list.map(x => x.id);
  } catch (e) { RX = false; /* старый браузер без lookbehind: текст без подсветки */ }
  return RX;
}
/* html — уже экранированный текст без тегов. Подсвечивается первое упоминание каждого термина на экране
   (экран рисуется за один синхронный проход, после него список сбрасывается). skip — термин, который сейчас объясняется */
const PAGE = new Set(); let pending = false;
export function terms(html, skip) {
  const r = rx(); if (!r || !html) return html;
  if (!pending) { pending = true; queueMicrotask(() => { PAGE.clear(); pending = false; }); }
  const used = PAGE;
  r.lastIndex = 0;
  return html.replace(r, (m, ...g) => {
    const i = g.slice(0, IDS.length).findIndex(x => x !== undefined), id = IDS[i];
    if (!id || id === skip || used.has(id)) return m;
    used.add(id);
    return '<button type="button" class="term" data-act="term" data-v="' + id + '" aria-haspopup="dialog">' + m + '<sup aria-hidden="true">?</sup><span class="sr"> (' + t("gl_what") + ")</span></button>";
  });
}
/* esc + подсветка — короткая запись для экранов */
export const tx = (s, skip) => terms(esc(s), skip);

const q2 = tm => tm.q ? '<p class="tq"><span>' + t("gl_q") + '</span> <b lang="ru">' + esc(ui(tm.q)) + "</b></p>" : "";
const head = tm => '<h2 class="th" lang="ru">' + esc(tm.term.ru) + '</h2><p class="small" lang="tg">' + esc(tm.term.tg) + "</p>";
const exs = (tm, n) => (tm.ex || []).slice(0, n || 99).map(x => '<div class="gexr"><button class="play" data-act="gsay" data-v="' + esc(x.ru) + '" aria-label="' + t("listen") + ": " + esc(plain(x.ru)) + '">' + IC.play + '</button><div><b lang="ru">' + esc(x.ru) + '</b><span class="tr" lang="tg">' + esc(x.tg) + "</span></div></div>").join("");

/* ---------- карточка снизу (через окно слова: app.st.sheet = { term, prev }) ---------- */
export function termSheet(sh) {
  const tm = termById(sh.term); if (!tm) return "";
  log("term_open", { term: tm.id });
  const backBtn = sh.prev ? '<button class="btn ghost" data-act="termback">← ' + t("gl_back") + "</button>" : "";
  return '<div class="sheet-bg" data-act="closesheet"><div class="sheet tsheet" role="dialog" aria-modal="true" aria-label="' + esc(plain(tm.term.ru)) + '" data-stop>' +
    head(tm) + q2(tm) + '<p class="tshort">' + tx(ui(tm.short), tm.id) + "</p>" +
    '<div class="gexs">' + exs(tm, 2) + "</div>" +
    '<button class="btn" data-act="termmore" data-v="' + tm.id + '">' + t("gl_more") + "</button>" + backBtn +
    '<button class="btn ghost" data-act="closesheet">' + t("w_close") + "</button></div></div>";
}
ACT.term = e => {
  const id = e.dataset.v; if (!termById(id)) return;
  const cur = app.st.sheet;
  app.st.sheet = { term: id, prev: cur || null };
  app.render(true);
};
ACT.termback = () => { const sh = app.st.sheet; app.st.sheet = sh && sh.prev ? sh.prev : null; app.render(true); };
ACT.termmore = e => {
  const id = e.dataset.v; if (!termById(id)) return;
  pushRet();
  app.st.gtm = id; log("term_more", { term: id, from: app.cur }); app.go("gterm");
};
ACT.gtermopen = e => { if (!termById(e.dataset.v)) return; app.st.gtm = e.dataset.v; app.go("gterm"); };

/* ---------- список терминов ---------- */
R.gloss = () => {
  const G = C.glossary; if (!G) return top(t("gl_title")) + '<p class="sub">' + t("g_none") + "</p>";
  const CHEV = '<svg class="mchev" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>';
  const groups = G.groups.map(g => {
    const ts = G.terms.filter(x => x.group === g.id); if (!ts.length) return "";
    return '<h3 class="glh">' + esc(ui(g.title)) + '</h3><div class="mlist">' + ts.map(x => '<button class="mrow" data-act="gtermopen" data-v="' + x.id + '"><span class="grow"><b lang="ru">' + esc(x.term.ru) + '</b> <span class="small" lang="tg">· ' + esc(x.term.tg) + '</span><span class="small" style="display:block">' + esc(ui(x.short)) + "</span></span>" + CHEV + "</button>").join("") + "</div>";
  }).join("");
  return top(t("gl_title")) + "<h1>" + t("gl_title") + '</h1><p class="sub">' + t("gl_sub") + "</p>" + groups;
};

/* ---------- страница термина ---------- */
R.gterm = () => {
  const tm = termById(app.st.gtm); if (!tm) return R.gloss();
  const ret = curRet(), fromLesson = !!ret;
  const tp = tm.topic ? topicById(tm.topic) : null;
  const topicBtn = tp && isOpen(tp) ? '<button class="gmore" data-act="gopen" data-v="' + tp.id + '"><span class="gmi" aria-hidden="true">' + GI + '</span><span class="grow"><b>' + t("gl_topic") + '</b><span class="small" style="display:block">' + esc(plain(ui(tp.title))) + '</span></span><span aria-hidden="true">→</span></button>' : "";
  const see = (tm.see || []).map(termById).filter(Boolean);
  const seeH = see.length ? "<h3>" + t("gl_see") + '</h3><div class="chips">' + see.map(x => '<button class="chip" data-act="gtermopen" data-v="' + x.id + '" lang="ru">' + esc(x.term.ru) + "</button>").join("") + "</div>" : "";
  const bl = fromLesson && ["exer", "lesson", "rules"].includes(ret.from) ? t("g_back_lesson") : t("g_back");
  const foot = fromLesson ? '<button class="btn" data-act="gret">' + bl + "</button>" : '<button class="btn sec" data-act="glossall">' + t("gl_all") + "</button>";
  return top(t("gl_title")) + '<div class="thead">' + head(tm) + "</div>" +
    (fromLesson ? '<button class="gbackl" data-act="gret">← ' + bl + "</button>" : "") +
    '<div class="card grule">' + q2(tm) + '<p class="gshort">' + tx(ui(tm.short), tm.id) + "</p><p>" + tx(ui(tm.more), tm.id) + "</p></div>" +
    "<h3>" + t("g_ex") + '</h3><div class="gexs">' + exs(tm) + "</div>" +
    (tm.cmp ? '<div class="card gcmp"><b>' + t("g_cmp") + "</b><p>" + tx(ui(tm.cmp), tm.id) + "</p></div>" : "") +
    topicBtn + seeH + foot;
};
ACT.glossall = () => { if (app.stack[app.stack.length - 1] === "gloss") app.back(); else app.go("gloss"); };
ACT.glossopen = () => app.go("gloss");
