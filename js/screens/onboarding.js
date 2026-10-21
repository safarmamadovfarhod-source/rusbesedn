import { app } from "../app.js";
import { S, save, today } from "../store.js";
import { t, ui, hint, lang } from "../i18n.js";
import { C } from "../content.js";
import { esc, norm, shuffle } from "../util.js";
import { band, top, steps, bowl, fbCard, playIcon, IC } from "../ui.js";
import { diagLevel } from "../progress.js";
import { log } from "../analytics.js";
import { playText } from "../audio.js";
import { addCard } from "../srs.js";

const R = app.R, ACT = app.ACT;

R.lang = () => band() + '<div class="grow"></div><div class="center"><h1>Забон · Язык</h1><p class="sub" style="margin-top:8px">' + t("lang_sub") + '</p></div>' +
  '<div style="display:grid;gap:12px;margin-top:8px"><button class="btn" data-act="setlang" data-v="tg" lang="tg">Тоҷикӣ</button><button class="btn" data-act="setlang" data-v="ru" lang="ru">Русский</button></div><div class="grow"></div><p class="small center">' + t("app") + "</p>";
ACT.setlang = e => { S.settings.uiLang = e.dataset.v; save(); log("lang_set", { lang: e.dataset.v }); if (app.cur === "lang") app.go("goal"); else app.render(true); };

R.goal = () => {
  const chips = [5, 10, 15, 30, 60].map(m => '<button class="chip" data-act="setmin" data-v="' + m + '" aria-pressed="' + (S.settings.dailyMin === m) + '">' + m + " " + t("min") + "</button>").join("");
  const rh = [["daily", "r_daily"], ["mixed", "r_mixed"], ["fast", "r_fast"]].map(x => '<button class="choice" data-act="setrh" data-v="' + x[0] + '" aria-pressed="' + (S.settings.rhythm === x[0]) + '">' + t(x[1]) + "</button>").join("");
  return top(t("goal_title"), { back: false }) + '<div class="chips">' + chips + '</div><p class="small">' + t("goal_note") + '</p><h2 style="margin-top:6px">' + t("rhythm_title") + '</h2><div style="display:grid;gap:8px">' + rh + '</div><p class="small">' + t("rh_" + S.settings.rhythm) + '</p><div class="grow"></div><button class="btn" data-go="start">' + t("continue") + "</button>";
};
ACT.setmin = e => { S.settings.dailyMin = +e.dataset.v; save(); app.render(true); };
ACT.setrh = e => { S.settings.rhythm = e.dataset.v; save(); app.render(true); };

R.start = () => top(t("start_title")) +
  '<button class="card choice" data-act="startzero" style="display:block"><h3>' + t("start_zero") + '</h3><p class="sub">' + t("start_zero_s") + "</p></button>" +
  '<button class="card choice" data-act="startdiag" style="display:block"><h3>' + t("start_test") + '</h3><p class="sub">' + t("start_test_s") + "</p></button>";
ACT.startzero = () => { S.diag = null; S.onboarded = true; save(); log("onboarding_complete", { mode: "zero", level: 0 }); app.go("result"); };
ACT.startdiag = () => { app.st.diag = { i: 0, score: 0, n: 0, fb: null, sel: null, built: [], typed: "" }; app.go("diag"); };

/* ---- общий рендер вопроса (диагностика и тест на пропуск) ---- */
function builderHtml(st, tokens, act, unact, seed) {
  const av = shuffle(tokens, seed || 3); let h = '<div class="card" style="min-height:64px;display:flex;flex-wrap:wrap;gap:8px;align-items:center" aria-live="polite">';
  st.built.forEach((w, i) => { h += '<button class="chip" aria-pressed="true" data-act="' + unact + '" data-v="' + i + '">' + esc(w) + "</button>"; });
  if (!st.built.length) h += '<span class="small">…</span>';
  h += '</div><div class="chips">';
  av.forEach(w => { const used = st.built.includes(w); h += '<button class="chip' + (used ? " used" : "") + '" data-act="' + act + '" data-v="' + esc(w) + '"' + (used ? " disabled" : "") + ">" + esc(w) + "</button>"; });
  return h + "</div>";
}
function questionBody(q, st, p) { /* p = {ans, build, unbuild, check, skip, typed} имена действий */
  let b = "<h2>" + esc(ui(q.q)) + "</h2>";
  if (q.type === "tf") b += '<div class="row"><button class="choice' + (st.sel === "t" ? (st.fb && st.fb.ok ? " good" : " soft") : "") + '" data-act="' + p.ans + '" data-v="t">' + t("true_") + '</button><button class="choice' + (st.sel === "f" ? (st.fb && st.fb.ok ? " good" : " soft") : "") + '" data-act="' + p.ans + '" data-v="f">' + t("false_") + "</button></div>";
  else if (q.type === "choice") b += '<div style="display:grid;gap:8px">' + q.options.map((o, i) => '<button class="choice' + (st.sel === i ? (st.fb && st.fb.ok ? " good" : " soft") : "") + '" data-act="' + p.ans + '" data-v="' + i + '">' + esc(o) + "</button>").join("") + "</div>";
  else if (q.type === "builder") b += builderHtml(st, q.tokens, p.build, p.unbuild, 3) + (st.fb ? "" : '<button class="btn sec" data-act="' + p.check + '">' + t("check") + "</button>");
  else if (q.type === "type") b += '<button class="btn sec" data-act="' + p.say + '" data-v="' + esc(q.audio_text || q.audio) + '" data-id="' + esc(q.audio_id || "") + '">' + playIcon(18, "#0A5F5A") + t("listen") + "</button>" +
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

/* ---- диагностика ---- */
R.diag = () => {
  const d = app.st.diag, qs = C.diag.questions, q = qs[d.i];
  const body = questionBody(q, d, { ans: "dans", build: "dbuild", unbuild: "dunbuild", check: "dcheck", skip: "dskip", say: "dsay" });
  const fb = d.fb ? fbCard(d.fb.ok, d.fb.ok ? t("fb_ok") : t("fb_soft") + esc(d.fb.right)) + '<button class="btn" data-act="dnext">' + t("next") + "</button>" : "";
  return top(t("diag_title")) + steps(qs.length, d.i) + body + fb;
};
function dAnswer(v) {
  const d = app.st.diag, q = C.diag.questions[d.i]; if (d.fb) return;
  const ok = judge(q, d, v); d.sel = (q.type === "choice" ? +v : v); d.n++; if (ok) d.score++;
  d.fb = { ok, right: correctText(q) }; log("exercise_answer", { item: q.id, ok, kind: "diag" }); app.render(true);
}
ACT.dans = e => { if (!app.st.diag.fb) dAnswer(e.dataset.v); };
ACT.dbuild = e => { const d = app.st.diag; if (d.fb) return; if (!d.built.includes(e.dataset.v)) d.built.push(e.dataset.v); app.render(true); };
ACT.dunbuild = e => { const d = app.st.diag; if (d.fb) return; d.built.splice(+e.dataset.v, 1); app.render(true); };
ACT.dcheck = () => { const d = app.st.diag, q = C.diag.questions[d.i]; if (d.fb) return; if (q.type === "builder") dAnswer(""); else { const el = document.getElementById("typed"); dAnswer(el ? el.value : ""); } };
ACT.dskip = () => { diagFinish(); };
ACT.dsay = e => playText(e.dataset.v, e.dataset.id || null);
ACT.dnext = () => { const d = app.st.diag; if (d.i < C.diag.questions.length - 1) { app.st.diag = { i: d.i + 1, score: d.score, n: d.n, fb: null, sel: null, built: [], typed: "" }; app.render(false); app.scrollTop(); } else diagFinish(); };
function diagFinish() {
  const d = app.st.diag, level = diagLevel(d.score, d.n, C.diag.levels);
  S.diag = { score: d.score, n: d.n, level, ts: today() }; S.onboarded = true; save();
  log("onboarding_complete", { mode: "diag", level, score: d.score, n: d.n }); app.go("result");
}

/* ---- результат и план ---- */
R.result = () => {
  const L = S.diag ? S.diag.level : 0, title = L === 0 ? t("res_level") : t("res_l1");
  const can = C.lesson.passport.can_do.slice(0, 3).map(c => '<div class="li"><span class="tick"></span><span class="grow">' + esc(ui(c)) + "</span></div>").join("");
  return band() + "<h1>" + t("res_title") + '</h1><div class="card center">' + bowl(15, title) + '<h2 style="margin-top:8px">' + title + '</h2><p class="small" style="margin-top:6px"><b>' + t("res_plan") + "</b> " + t("plan" + L) + "</p></div>" +
    "<p>" + t("res_pace", { m: S.settings.dailyMin }) + "</p><h3>" + t("res_can") + '</h3><div class="card">' + can + '</div><div class="grow"></div>' +
    (L === 2 ? '<button class="btn warm" data-act="skipstart">' + t("skip_offer") + "</button>" : "") + '<button class="btn" data-act="tohome">' + t("continue") + "</button>";
};

/* ---- тест на пропуск урока (8 вопросов из lesson.json) ---- */
function skipQ(k) { /* приводим к общему виду вопроса */
  const q = { id: k.id, type: k.type === "type" ? "type" : k.type, answer: k.answer, options: k.options, tokens: k.tokens, audio_text: k.audio, audio_id: k.audio_id };
  q.q = { ru: k.q_ru || (k.type === "builder" ? "Составьте фразу" : "Послушайте и напишите слово"), tg: k.q_tg || (k.type === "builder" ? "Ҷумларо созед" : "Гӯш кунед ва калимаро нависед") };
  return q;
}
ACT.skipstart = () => { app.st.skip = { i: 0, score: 0, fb: null, sel: null, built: [], done: false }; app.go("skiptest"); };
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
ACT.skiptolesson = () => { app.st.skip = null; app.startLesson(); };
