import { app } from "../app.js";
import { S, save, today } from "../store.js";
import { t, ui, hint, lang } from "../i18n.js";
import { C, setCurrent, track, nextLessonId, firstLessonId, trackLessons, lessonOfTopic, orderedLessons } from "../content.js";
import { topicsView } from "./home.js";
import { esc, norm, shuffle, permOf, permIdx } from "../util.js";
import { band, top, steps, bowl, fbCard, playIcon, IC } from "../ui.js";
import { diagLevel } from "../progress.js";
import { log } from "../analytics.js";
import { playText } from "../audio.js";
import { addCard } from "../srs.js";

const R = app.R, ACT = app.ACT;

/* ---- первый запуск: 6 шагов (язык → путь → уровень → оформление → минуты → готово) ---- */
const obTop = (n, title) => top(title, { back: n > 1 }) + steps(6, n - 1);
const opt = (act, v, on, title, sub, pre) => '<button class="choice" data-act="' + act + '" data-v="' + v + '" aria-pressed="' + on + '">' + (pre || "") + '<span style="display:block"><b>' + title + '</b><span class="small" style="display:block;font-weight:400">' + sub + "</span></span></button>";
const nextBtn = (ok, act) => '<div class="grow"></div>' + (ok ? '<button class="btn" data-act="' + (act || "obnext") + '">' + t("ob_next") + "</button>" : "");

/* 1. язык: только два слова, без текста об уроках */
R.lang = () => band() + '<div class="grow"></div><div class="center"><h1>Забон · Язык</h1><p class="sub" style="margin-top:8px">Забони барномаро интихоб кунед<br>Выберите язык приложения</p></div>' +
  '<div style="display:grid;gap:12px;margin-top:8px"><button class="btn" data-act="setlang" data-v="tg" lang="tg">Тоҷикӣ</button><button class="btn" data-act="setlang" data-v="ru" lang="ru">Русский</button></div><div class="grow"></div>';
ACT.setlang = e => { S.settings.uiLang = e.dataset.v; save(); log("lang_set", { lang: e.dataset.v }); if (app.cur === "lang") app.go("path"); else app.render(true); };

/* 2. путь */
R.path = () => {
  const tr = S.settings.track, ok = app.st.ob && app.st.ob.pathSet;
  return obTop(2, t("ob_path_t")) + '<div style="display:grid;gap:10px">' + opt("setpath", "a", ok && tr === "a", t("ob_path_a"), t("ob_path_a_s")) + opt("setpath", "b", ok && tr === "b", t("ob_path_b"), t("ob_path_b_s")) + "</div>" + nextBtn(ok);
};
ACT.setpath = e => { const v = e.dataset.v; S.settings.track = v; S.settings.hintLang = v === "a" ? "tg" : "ru"; S.settings.level = null; app.st.ob = Object.assign(app.st.ob || {}, { pathSet: true }); save(); log("path_set", { path: v }); app.render(true); };

/* 3. уровень */
R.level = () => {
  const a = S.settings.track === "a", lv = S.settings.level;
  const list = a ? opt("setlevel", "zero", lv === "zero", t("ob_lva_zero"), t("ob_lva_zero_s")) + opt("setlevel", "diag", lv === "diag", t("ob_lva_diag"), t("ob_lva_diag_s"))
    : opt("setlevel", "check", lv === "check", t("ob_lvb_check"), t("ob_lvb_check_s")) + opt("setlevel", "b1", lv === "b1", t("ob_lvb_b1"), t("ob_lvb_s")) + opt("setlevel", "b2", lv === "b2", t("ob_lvb_b2"), t("ob_lvb_s"));
  return obTop(3, t(a ? "ob_lva_t" : "ob_lvb_t")) + '<div style="display:grid;gap:10px">' + list + "</div>" + nextBtn(!!lv);
};
ACT.setlevel = e => { S.settings.level = e.dataset.v; save(); app.render(true); };

/* 4. оформление */
const THEMES = [["a", "#EEF2F6", "#1F4E79"], ["b", "#F4F2FF", "#3A3FD8"], ["c", "#F2F8F6", "#0D7C76"]];
const swatch = (bg, fg) => '<span aria-hidden="true" style="flex:none;width:76px;height:52px;border-radius:12px;background:' + bg + ';border:2px solid ' + fg + ';display:flex;flex-direction:column;gap:6px;justify-content:center;padding:0 10px"><b style="display:block;height:8px;border-radius:4px;background:' + fg + '"></b><b style="display:block;height:8px;width:60%;border-radius:4px;background:' + fg + ';opacity:.4"></b></span>';
export const themePicker = () => THEMES.map(x => opt("settheme", x[0], S.settings.theme === x[0], t("th_" + x[0]), t("th_" + x[0] + "_s"), swatch(x[1], x[2]))).join("");
R.theme = () => obTop(4, t("ob_th_t")) + '<p class="small">' + t("ob_th_s") + '</p><div style="display:grid;gap:10px">' + themePicker() + "</div>" + nextBtn(true);
ACT.settheme = e => { S.settings.theme = e.dataset.v; save(); app.applyTheme && app.applyTheme(); app.render(true); };

/* 5. минуты */
R.goal = () => {
  const chips = [5, 10, 15, 30, 60].map(m => '<button class="chip" data-act="setmin" data-v="' + m + '" aria-pressed="' + (S.settings.dailyMin === m) + '">' + m + " " + t("min") + "</button>").join("");
  return obTop(5, t("ob_min_t")) + '<div class="chips">' + chips + '</div><p class="small">' + t("ob_min_s") + "</p>" + nextBtn(true);
};
ACT.setmin = e => { S.settings.dailyMin = +e.dataset.v; save(); app.render(true); };
ACT.setrh = e => { S.settings.rhythm = e.dataset.v; save(); app.render(true); };

/* 6. готово */
const firstLessonText = () => {
  const lv = S.settings.level, a = S.settings.track === "a";
  return t(a ? (lv === "diag" ? "ob_first_diag" : "ob_first_zero") : (lv === "check" ? "ob_first_check" : "ob_first_b"));
};
R.ready = () => bandless() + '<div class="grow"></div><h1>' + t("ob_done") + '</h1><div class="card"><b>' + firstLessonText() + '</b><p class="small">' + t(S.settings.track === "a" ? "ob_note_a" : "ob_note_b") + '</p><p class="small">' + t("ob_goal", { n: S.settings.dailyMin * 6 }) + '</p><p class="small">' + t("ob_look") + t("th_" + S.settings.theme) + '</p></div><button class="btn" data-act="obstart">' + t("ob_start") + '</button><button class="btn ghost" data-act="obagain">' + t("ob_again") + '</button><div class="grow"></div>';
const bandless = () => steps(6, 5);
ACT.obnext = () => { const nx = { path: "level", level: "theme", theme: "goal", goal: "ready" }[app.cur]; if (nx) app.go(nx); };
ACT.obagain = () => { app.stack = []; S.settings.uiLang = null; S.settings.level = null; app.st.ob = {}; save(); app.go("lang", { noPush: true }); };
ACT.obstart = () => {
  const a = S.settings.track === "a", lv = S.settings.level;
  log("onboarding_choice", { path: S.settings.track, level: lv, theme: S.settings.theme, min: S.settings.dailyMin });
  if (a && lv === "diag") { app.st.diag = freshDiag("a"); app.go("diag"); return; }
  if (!a && lv === "check") { app.st.diag = freshDiag("b"); app.go("diag"); return; }
  S.diag = null; S.order[S.settings.track] = []; S.onboarded = true; save(); setCurrent(nextLessonId() || firstLessonId());
  log("onboarding_complete", { mode: a ? "zero" : lv, level: 0 }); app.stack = []; app.go("home", { noPush: true });
};
ACT.startdiagb = () => { app.st.diag = freshDiag("b"); app.go("diag"); };
const freshDiag = set => ({ set, i: 0, score: 0, n: 0, tp: {}, fb: null, sel: null, built: [], typed: "" });

/* ---- общий рендер вопроса (диагностика и тест на пропуск) ---- */
function builderHtml(st, tokens, act, unact, avoid) {
  const av = permOf(st, "bp", tokens, avoid); let h = '<div class="card" style="min-height:64px;display:flex;flex-wrap:wrap;gap:8px;align-items:center" aria-live="polite">';
  st.built.forEach((w, i) => { h += '<button class="chip" aria-pressed="true" data-act="' + unact + '" data-v="' + i + '">' + esc(w) + "</button>"; });
  if (!st.built.length) h += '<span class="small">…</span>';
  h += '</div><div class="chips">';
  av.forEach(w => { const used = st.built.includes(w); h += '<button class="chip' + (used ? " used" : "") + '" data-act="' + act + '" data-v="' + esc(w) + '"' + (used ? " disabled" : "") + ">" + esc(w) + "</button>"; });
  return h + "</div>";
}
function questionBody(q, st, p) { /* p = {ans, build, unbuild, check, skip, typed} имена действий */
  let b = "<h2>" + esc(ui(q.q)) + "</h2>";
  if (q.type === "tf") b += '<div class="row"><button class="choice' + (st.sel === "t" ? (st.fb && st.fb.ok ? " good" : " soft") : "") + '" data-act="' + p.ans + '" data-v="t">' + t("true_") + '</button><button class="choice' + (st.sel === "f" ? (st.fb && st.fb.ok ? " good" : " soft") : "") + '" data-act="' + p.ans + '" data-v="f">' + t("false_") + "</button></div>";
  else if (q.type === "choice") b += '<div style="display:grid;gap:8px">' + permIdx(st, "p", q.options.length).map(i => '<button class="choice' + (st.sel === i ? (st.fb && st.fb.ok ? " good" : " soft") : "") + '" data-act="' + p.ans + '" data-v="' + i + '">' + esc(q.options[i]) + "</button>").join("") + "</div>";
  else if (q.type === "builder") b += builderHtml(st, q.tokens, p.build, p.unbuild, String(q.answer).split(" ")) + (st.fb ? "" : '<button class="btn sec" data-act="' + p.check + '">' + t("check") + "</button>");
  else if (q.type === "type") b += '<button class="btn sec" data-act="' + p.say + '" data-v="' + esc(q.audio_text || q.audio) + '" data-id="' + esc(q.audio_id || "") + '">' + playIcon(18, "var(--primary-d)") + t("listen") + "</button>" +
    (st.fb ? "" : '<input id="typed" class="inp" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" lang="ru" placeholder="' + t("dict_ph") + '" aria-label="' + t("dict_ph") + '"><p class="small">' + t("kb_note") + '</p><button class="btn sec" data-act="' + p.check + '">' + t("check") + "</button>" + (q.optional ? '<button class="btn ghost" data-act="' + p.skip + '">' + t("dskip") + "</button>" : ""));
  return b;
}
const correctText = q => q.type === "tf" ? (q.answer ? t("true_") : t("false_")) : q.type === "choice" ? q.options[q.answer] : q.type === "builder" ? q.answer : q.answer;
function judge(q, st, v) {
  if (q.type === "tf") return (v === "t") === q.answer;
  if (q.type === "choice") return +v === q.answer;
  if (q.type === "builder") return norm(st.built.join(" ")) === norm(q.answer);
  return norm(v) === norm(q.answer);
}

/* ---- диагностика (путь A: 4 вопроса о знакомстве; путь B: 9 вопросов, по 3 на тему) ---- */
const dset = () => C.diag[app.st.diag.set || "a"];
R.diag = () => {
  const d = app.st.diag, qs = dset().questions, q = qs[d.i];
  const body = questionBody(q, d, { ans: "dans", build: "dbuild", unbuild: "dunbuild", check: "dcheck", skip: "dskip", say: "dsay" });
  const fb = d.fb ? fbCard(d.fb.ok, d.fb.ok ? t("fb_ok") : t("fb_soft") + esc(d.fb.right)) + '<button class="btn" data-act="dnext">' + t("next") + "</button>" : "";
  return top(t(d.set === "b" ? "diagb_title" : "diag_title")) + steps(qs.length, d.i) + body + fb + (d.set === "b" && !d.fb ? '<button class="btn ghost" data-act="dquit">' + t("diag_skip") + "</button>" : "");
};
function dAnswer(v) {
  const d = app.st.diag, q = dset().questions[d.i]; if (d.fb) return;
  const ok = judge(q, d, v); d.sel = (q.type === "choice" ? +v : v); d.n++; if (ok) { d.score++; if (q.topic) d.tp[q.topic] = (d.tp[q.topic] || 0) + 1; }
  d.fb = { ok, right: correctText(q) }; log("exercise_answer", { item: q.id, ok, kind: "diag" }); app.render(true);
}
ACT.dans = e => { if (!app.st.diag.fb) dAnswer(e.dataset.v); };
ACT.dbuild = e => { const d = app.st.diag; if (d.fb) return; if (!d.built.includes(e.dataset.v)) d.built.push(e.dataset.v); app.render(true); };
ACT.dunbuild = e => { const d = app.st.diag; if (d.fb) return; d.built.splice(+e.dataset.v, 1); app.render(true); };
ACT.dcheck = () => { const d = app.st.diag, q = dset().questions[d.i]; if (d.fb) return; if (q.type === "builder") dAnswer(""); else { const el = document.getElementById("typed"); dAnswer(el ? el.value : ""); } };
ACT.dskip = () => { diagFinish(); };
ACT.dquit = () => { const d = app.st.diag; d.n = 0; d.tp = {}; diagFinish(); };
ACT.dsay = e => playText(e.dataset.v, e.dataset.id || null);
ACT.dnext = () => { const d = app.st.diag; if (d.i < dset().questions.length - 1) { app.st.diag = { set: d.set, i: d.i + 1, score: d.score, n: d.n, tp: d.tp, fb: null, sel: null, built: [], typed: "" }; app.render(false); app.scrollTop(); } else diagFinish(); };
function diagFinish() {
  const d = app.st.diag;
  if (d.set === "b") {
    const db = C.diag.b, base = trackLessons("b").map(l => l.id);
    if (d.n > 0) { S.diagB = {}; db.topics.forEach(tp => { S.diagB[tp.id] = d.tp[tp.id] || 0; }); S.diagB.ts = today(); }
    const ord = db.topics.slice().sort((x, y) => (d.n > 0 ? (d.tp[x.id] || 0) - (d.tp[y.id] || 0) : 0) || base.indexOf(x.lesson) - base.indexOf(y.lesson)).map(tp => tp.lesson);
    S.order.b = ord; S.onboarded = true; save(); setCurrent(nextLessonId("b") || firstLessonId());
    log("onboarding_complete", { mode: "check", n: d.n }); app.stack = []; app.go(d.n > 0 ? "resultb" : "home", { noPush: true }); return;
  }
  const level = diagLevel(d.score, d.n, C.diag.a.levels);
  S.diag = { score: d.score, n: d.n, level, ts: today() }; S.onboarded = true; save(); setCurrent(nextLessonId("a") || firstLessonId());
  log("onboarding_complete", { mode: "diag", level, score: d.score, n: d.n }); app.go("result");
}

/* ---- результат: путь A ---- */
R.result = () => {
  const L = S.diag ? S.diag.level : 0, title = L === 0 ? t("res_level") : t("res_l1");
  const can = C.lesson.passport.can_do.slice(0, 3).map(c => '<div class="li"><span class="tick"></span><span class="grow">' + esc(ui(c)) + "</span></div>").join("");
  return band() + "<h1>" + t("res_title") + '</h1><div class="card center">' + bowl(15, title) + '<h2 style="margin-top:8px">' + title + '</h2><p class="small" style="margin-top:6px"><b>' + t("res_plan") + "</b> " + t("plan" + L) + "</p></div>" +
    "<p>" + t("res_pace", { m: S.settings.dailyMin }) + "</p><h3>" + t("res_can") + '</h3><div class="card">' + can + '</div><div class="grow"></div>' +
    (L === 2 ? '<button class="btn warm" data-act="skipstart">' + t("skip_offer") + "</button>" : "") + '<button class="btn" data-act="tohome">' + t("continue") + "</button>";
};
/* ---- результат: путь B, мягко: сильные и слабые стороны ---- */
R.resultb = () => {
  const tv = topicsView(), nid = nextLessonId("b"), first = nid ? ui(C.lessons[nid].meta.title) : "";
  const rows = tv.map(x => '<div class="li"><span class="tick' + (x.strong ? " on" : "") + '">' + (x.strong ? IC.check : "") + '</span><span class="grow">' + esc(x.title) + '</span><span class="badge ' + (x.strong ? "g" : "") + '">' + (x.strong ? t("strong_s") : t("weak_s")) + "</span></div>").join("");
  return band() + "<h1>" + t("res_b_title") + '</h1><div class="card">' + rows + '</div><p class="sub">' + t("res_b_text") + "</p>" + (first ? "<p><b>" + t("res_b_first", { t: esc(first) }) + "</b></p>" : "") + "<p>" + t("res_b_pace", { n: S.settings.dailyMin * 6 }) + '</p><div class="grow"></div><button class="btn" data-act="tohome">' + t("continue") + "</button>";
};

/* ---- тест на пропуск урока (8 вопросов из lesson.json) ---- */
function skipQ(k) { /* приводим к общему виду вопроса */
  const q = { id: k.id, type: k.type === "type" ? "type" : k.type, answer: k.answer, options: k.options, tokens: k.tokens, audio_text: k.audio, audio_id: k.audio_id };
  q.q = { ru: k.q_ru || (k.type === "builder" ? "Составьте фразу" : "Послушайте и напишите слово"), tg: k.q_tg || (k.type === "builder" ? "Ҷумларо созед" : "Гӯш кунед ва калимаро нависед") };
  return q;
}
ACT.skipstart = () => { setCurrent(nextLessonId("a") || firstLessonId()); app.st.skip = { i: 0, score: 0, fb: null, sel: null, built: [], done: false }; app.go("skiptest"); };
R.skiptest = () => {
  const s = app.st.skip, ks = C.lesson.exercises.skip_test;
  if (s.done) { const pass = s.score >= 7; return band() + "<h1>" + t("skip_title") + '</h1><div class="card center"><h2>' + s.score + " / " + ks.length + "</h2><p>" + (pass ? t("skip_pass") : t("skip_fail")) + '</p></div><div class="grow"></div>' + (pass ? "" : '<button class="btn warm" data-act="skiptolesson">' + t("to_lesson") + "</button>") + '<button class="btn' + (pass ? "" : " sec") + '" data-act="tohome">' + t("to_home") + "</button>"; }
  const q = skipQ(ks[s.i]);
  const body = questionBody(q, s, { ans: "sans", build: "sbuild", unbuild: "sunbuild", check: "scheck", skip: "scheck", say: "dsay" });
  const fb = s.fb ? fbCard(s.fb.ok, s.fb.ok ? t("fb_ok") : t("fb_soft") + esc(s.fb.right)) + '<button class="btn" data-act="snext">' + t("next") + "</button>" : "";
  return top(t("skip_title")) + steps(ks.length, s.i) + body + fb;
};
function sAnswer(v) { const s = app.st.skip, q = skipQ(C.lesson.exercises.skip_test[s.i]); if (s.fb) return; const ok = judge(q, s, v); s.sel = (q.type === "choice" ? +v : v); if (ok) s.score++; s.fb = { ok, right: correctText(q) }; app.render(true); }
ACT.sans = e => { if (!app.st.skip.fb) sAnswer(e.dataset.v); };
ACT.sbuild = e => { const s = app.st.skip; if (s.fb) return; if (!s.built.includes(e.dataset.v)) s.built.push(e.dataset.v); app.render(true); };
ACT.sunbuild = e => { const s = app.st.skip; if (s.fb) return; s.built.splice(+e.dataset.v, 1); app.render(true); };
ACT.scheck = () => { const s = app.st.skip, q = skipQ(C.lesson.exercises.skip_test[s.i]); if (s.fb) return; if (q.type === "builder") sAnswer(""); else { const el = document.getElementById("typed"); sAnswer(el ? el.value : ""); } };
ACT.snext = () => {
  const s = app.st.skip, ks = C.lesson.exercises.skip_test;
  if (s.i < ks.length - 1) { app.st.skip = { i: s.i + 1, score: s.score, fb: null, sel: null, built: [], done: false }; app.render(false); app.scrollTop(); return; }
  s.done = true; s.fb = null; const pass = s.score >= 7; log("skip_test_result", { score: s.score, n: ks.length, ok: pass });
  if (pass) { const id = C.lessonMeta.id; S.progress.lessons[id] = Object.assign(S.progress.lessons[id] || {}, { status: "skipped", ts: today() }); (C.lesson.review.words || []).forEach(w => addCard(S.srs, w, today())); save(); }
  app.render(false); app.scrollTop();
};
ACT.skiptolesson = () => { app.st.skip = null; app.startLesson(C.cur); };
