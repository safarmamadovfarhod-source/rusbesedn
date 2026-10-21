import { app } from "../app.js";
import { S, save, today, now } from "../store.js";
import { t, ui, hint } from "../i18n.js";
import { C, findWord, findGrammar, isName, exById, wordById } from "../content.js";
import { esc, norm, plain, shuffle } from "../util.js";
import { band, top, steps, bowl, fbCard, playIcon, IC } from "../ui.js";
import { PICS } from "../pics.js";
import { log } from "../analytics.js";
import * as audio from "../audio.js";
import { addCard, review } from "../srs.js";
import { xpForLesson } from "../progress.js";

const R = app.R, ACT = app.ACT;
const lid = () => C.lessonMeta.id;

/* ---------- урок: чтение с подсветкой ---------- */
R.lesson = () => {
  const L = C.lesson, play = '<button class="icon-btn" data-act="playall" aria-label="' + t("play_all") + '">' + playIcon(22, "#14302E") + "</button>";
  let h = top(esc(ui(L.meta.title)), { right: play }) + '<p class="small">' + t("tap_hint") + '</p><div class="row" style="flex:none;align-items:stretch"><div class="seg" style="flex:2;min-width:0" role="group" aria-label="' + t("speed") + '">' +
    '<button data-act="speed" data-v="0.75" aria-pressed="' + ((S.speed || 1) === 0.75) + '">' + t("slow") + '</button><button data-act="speed" data-v="1" aria-pressed="' + ((S.speed || 1) === 1) + '">' + t("normal") + '</button></div><button class="chip" style="flex:1;min-width:0" data-act="tr" aria-pressed="' + (S.showTr !== false) + '">' + t("show_tr") + "</button></div>";
  h += '<div class="card" style="padding:6px 14px">';
  L.text.forEach((l, i) => {
    const ws = l.ru.split(" ").map((w, k) => '<button class="w" data-act="word" data-v="' + norm(w) + '" data-l="' + i + '" data-i="' + k + '">' + esc(w) + "</button>").join(" ");
    h += '<div class="line"><span class="sp ' + l.s + '" aria-hidden="true">' + (l.s === "f" ? "А" : "Р") + '</span><div class="words">' + ws + (S.showTr !== false ? '<span class="tr">' + esc(l.tg) + "</span>" : "") + '</div><button class="play" data-act="playline" data-v="' + i + '" aria-label="' + t("listen") + '">' + IC.play + "</button></div>";
  });
  h += '</div><p class="small" id="vnote">' + voiceNote() + '</p><div class="grow"></div><button class="btn" data-act="exstart">' + t("to_ex") + "</button>";
  return h;
};
const voiceNote = () => (C.lessonMeta.audio ? "" : t("demo_note") + ". ") + t("tg_note");
function highlight(lineIdx, wi) {
  document.querySelectorAll(".w.hot").forEach(e => e.classList.remove("hot"));
  if (wi < 0) return; const el = document.querySelector('.w[data-l="' + lineIdx + '"][data-i="' + wi + '"]'); if (el) el.classList.add("hot");
}
function playLineIdx(i, after) {
  const l = C.lesson.text[i]; log("audio_play_line", { item: l.id });
  audio.playLine({ id: l.audio, text: l.ru, speed: S.speed || 1, onWord: wi => highlight(i, wi), onEnd: after });
}
ACT.playline = e => playLineIdx(+e.dataset.v);
ACT.playall = () => { let i = 0; const nxt = () => { if (i < C.lesson.text.length) { const k = i++; playLineIdx(k, nxt); } }; nxt(); };
ACT.speed = e => { S.speed = +e.dataset.v; save(); app.render(true); };
ACT.tr = () => { S.showTr = !(S.showTr !== false); save(); app.render(true); };

/* ---------- окно слова: «Слово» / «Почему так?» ---------- */
export function sheetHtml() {
  const sh = app.st.sheet; if (!sh) return "";
  const n = sh.w, w = findWord(n), g = findGrammar(n), name = isName(n);
  if (!w && !g && !name) return "";
  const title = w ? w.ru : (name ? (n === "анна" ? "А́нна" : "Русла́н") : esc(n));
  const added = !!S.srs[w ? w.id : ""];
  const tabs = '<div class="seg" role="tablist"><button role="tab" data-act="sheettab" data-v="word" aria-pressed="' + (sh.tab === "word") + '">' + t("tab_word") + '</button><button role="tab" data-act="sheettab" data-v="why" aria-pressed="' + (sh.tab === "why") + '">' + t("tab_why") + "</button></div>";
  let body;
  if (sh.tab === "why") {
    body = g ? '<p class="small"><b>' + esc(ui({ ru: g.pos_ru, tg: g.pos_tg })) + '</b>' + (g.base && !name ? " · " + t("base_form") + ": <b>" + esc(g.base) + "</b>" : "") + "</p><p>" + esc(hint({ ru: g.why_ru, tg: g.why_tg })) + '</p><div class="card" style="background:#FFF5E2"><p class="small"><b>' + t("spell_h") + "</b></p><p>" + esc(hint({ ru: g.spell_ru, tg: g.spell_tg })) + "</p></div>" : "<p>" + t("no_grammar") + "</p>";
    log("grammar_open", { item: g ? g.id : n });
  } else {
    body = w ? '<p class="sub"><b>' + esc(hint({ ru: w.gloss_ru, tg: w.tg })) + '</b></p><p class="small">' + esc(hint({ ru: w.tg, tg: w.gloss_ru })) + '</p><p class="small">' + esc(ui({ ru: w.pos_ru, tg: w.pos_tg })) + '</p><p style="margin-top:6px">' + esc(w.ex) + "</p>" : '<p class="sub"><b>' + t("name_word") + "</b></p>";
  }
  const wordPlay = '<button class="btn" data-act="wsay" data-v="' + esc(title) + '" data-id="' + esc(w ? w.audio : "") + '">' + playIcon(18) + t("listen") + "</button>";
  const addBtn = w ? '<button class="btn sec" data-act="wadd" data-v="' + w.id + '"' + (added ? ' aria-pressed="true"' : "") + ">" + (added ? t("w_added") : t("w_add")) + "</button>" : "";
  return '<div class="sheet-bg" data-act="closesheet"><div class="sheet" role="dialog" aria-modal="true" aria-label="' + esc(plain(title)) + '" data-stop><div class="row" style="align-items:center;flex:none"><div class="pic" aria-hidden="true"><svg viewBox="0 0 40 40" width="46" height="46"><rect x="6" y="8" width="28" height="24" rx="6" fill="#fff" stroke="#0D7C76" stroke-width="2.5"/><circle cx="15" cy="17" r="3" fill="#0D7C76"/><path d="M8 29l8-7 6 5 4-3 6 5" fill="none" stroke="#0D7C76" stroke-width="2.5" stroke-linejoin="round"/></svg></div><div style="flex:3"><h2 style="font-size:1.6rem">' + esc(title) + "</h2>" + (sh.tab === "word" ? "" : "") + "</div></div>" + tabs + body + '<div class="row">' + wordPlay + addBtn + '</div><button class="btn ghost" data-act="closesheet">' + t("w_close") + "</button></div></div>";
}
ACT.word = e => { app.st.sheet = { w: e.dataset.v, tab: "word" }; log("word_tap", { item: e.dataset.v }); app.render(true); };
ACT.sheettab = e => { app.st.sheet.tab = e.dataset.v; app.render(true); };
ACT.closesheet = () => { app.st.sheet = null; app.render(true); };
ACT.wsay = e => audio.playText(e.dataset.v, e.dataset.id || null);
ACT.wadd = e => { addCard(S.srs, e.dataset.v, today()); save(); app.render(true); app.toast(t("w_added")); };

/* ---------- упражнения по lesson.flow ---------- */
const newEx = i => ({ i, fb: null, sel: null, built: [], lb: [], typed: "", shown: false });
ACT.exstart = () => { app.st.ex = Object.assign(newEx(0), { res: {} }); log("lesson_start", { lesson: lid() }); app.go("exer"); };
const relatedWords = ex => {
  const src = ex.type === "builder" ? ex.answer : ex.type === "choice" ? ex.options[ex.answer] : ex.type === "dictation" ? ex.answer : ex.type === "pictures" ? "" : "";
  const ids = new Set(); plain(src).split(/\s+/).forEach(x => { const w = findWord(norm(x)); if (w) ids.add(w.id); }); if (ex.type === "pictures") ids.add(ex.word); return [...ids];
};
R.exer = () => {
  const E = app.st.ex, flow = C.lesson.flow, ex = exById(flow[E.i]);
  let body = "";
  const q = o => "<h2>" + esc(ui(o)) + "</h2>";
  if (ex.type === "choice") body = q({ ru: ex.q_ru, tg: ex.q_tg }) + '<div style="display:grid;gap:8px">' + ex.options.map((o, i) => '<button class="choice' + (E.sel === i ? (E.fb && E.fb.ok ? " good" : " soft") : "") + '" data-act="exans" data-v="' + i + '">' + esc(o) + "</button>").join("") + "</div>";
  else if (ex.type === "truefalse") body = "<h2>" + t("tf_title") + '</h2><div class="card"><p style="font-size:1.15rem">' + esc(hint({ ru: ex.ru, tg: ex.tg })) + '</p></div><div class="row"><button class="choice' + (E.sel === "t" ? (E.fb && E.fb.ok ? " good" : " soft") : "") + '" data-act="exans" data-v="t">' + t("true_") + '</button><button class="choice' + (E.sel === "f" ? (E.fb && E.fb.ok ? " good" : " soft") : "") + '" data-act="exans" data-v="f">' + t("false_") + "</button></div>";
  else if (ex.type === "builder") {
    const av = shuffle(ex.ru_tokens, 5); body = "<h2>" + t("ex_build") + '</h2><p class="small">' + esc(ex.hint_tg) + '</p><div class="card" style="min-height:64px;display:flex;flex-wrap:wrap;gap:8px;align-items:center" aria-live="polite">' + (E.built.map((w, i) => '<button class="chip" aria-pressed="true" data-act="unbuild" data-v="' + i + '">' + esc(w) + "</button>").join("") || '<span class="small">…</span>') + '</div><div class="chips">' + av.map(w => { const u = E.built.includes(w); return '<button class="chip' + (u ? " used" : "") + '" data-act="build" data-v="' + esc(w) + '"' + (u ? " disabled" : "") + ">" + esc(w) + "</button>"; }).join("") + "</div>" + (E.fb ? "" : '<button class="btn sec" data-act="excheck">' + t("check") + "</button>");
  } else if (ex.type === "dictation") {
    const say = '<button class="btn sec" data-act="exsay" data-v="' + esc(ex.audio) + '" data-id="' + esc(ex.audio_id) + '">' + playIcon(18, "#0A5F5A") + t("listen") + "</button>";
    if (ex.kind === "letters") { const letters = plain(ex.answer).split(""), av = shuffle(letters.map((_, i) => i), 7); body = "<h2>" + t("ex_letters") + "</h2>" + say + '<div class="card" style="min-height:64px;display:flex;flex-wrap:wrap;gap:8px;align-items:center" aria-live="polite">' + (E.lb.map((k, i) => '<button class="chip" aria-pressed="true" data-act="unlb" data-v="' + i + '">' + letters[k] + "</button>").join("") || '<span class="small">…</span>') + '</div><div class="chips">' + av.map(k => { const u = E.lb.includes(k); return '<button class="chip' + (u ? " used" : "") + '" data-act="lb" data-v="' + k + '"' + (u ? " disabled" : "") + ">" + letters[k] + "</button>"; }).join("") + "</div>" + (E.fb ? "" : '<button class="btn sec" data-act="excheck">' + t("check") + "</button>"); }
    else body = "<h2>" + t("ex_type") + "</h2>" + say + (E.fb ? "" : '<input id="typed" class="inp" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" lang="ru" placeholder="' + t("dict_ph") + '" aria-label="' + t("dict_ph") + '"><p class="small">' + t("kb_note") + '</p><button class="btn sec" data-act="excheck">' + t("check") + "</button>");
  } else if (ex.type === "pictures") {
    const opts = shuffle(ex.options, 11).map(id => wordById(id));
    body = "<h2>" + t("ex_pic") + '</h2><div class="pic" style="width:100%;height:150px;border-radius:18px" role="img" aria-label="' + t("ex_pic") + '">' + PICS[ex.id] + '</div><div style="display:grid;gap:8px">' + opts.map(w => '<button class="choice' + (E.sel === w.id ? (E.fb && E.fb.ok ? " good" : " soft") : "") + '" data-act="exans" data-v="' + w.id + '">' + esc(w.ru) + "</button>").join("") + "</div>";
  } else { /* free */
    body = "<h2>" + esc(ui({ ru: ex.q_ru, tg: ex.q_tg })) + '</h2><textarea id="free" placeholder="' + t("dict_ph") + '" aria-label="' + esc(ui({ ru: ex.q_ru, tg: ex.q_tg })) + '" lang="ru"></textarea><p class="small">' + t("kb_note") + '</p><p class="small">' + esc(hint({ ru: ex.note_ru, tg: ex.note_tg })) + "</p>" +
      (E.shown ? '<div class="card" style="background:#E4F3F1"><p class="small"><b>' + t("ex_ref_h") + '</b></p><h3 style="margin-top:4px">' + esc(ex.reference) + "</h3></div>" + (E.fb ? "" : "<h3>" + t("ex_self") + '</h3><div class="row"><button class="btn" data-act="exself" data-v="1">' + t("ex_same") + '</button><button class="btn sec" data-act="exself" data-v="0">' + t("ex_redo") + "</button></div>") : '<button class="btn sec" data-act="exref">' + t("ex_ref") + "</button>");
  }
  let fb = "";
  if (E.fb) { const expl = ex.expl_ru ? esc(hint({ ru: ex.expl_ru, tg: ex.expl_tg })) : ""; fb = fbCard(E.fb.ok, (E.fb.ok ? t("fb_ok") : (E.fb.right ? t("fb_soft") + esc(E.fb.right) : t("ex_redo"))) + (expl ? '<span class="small" style="display:block;font-weight:400;margin-top:4px">' + expl + "</span>" : "")) + '<button class="btn" data-act="exnext">' + t("next") + "</button>"; }
  return top(t("ex_title")) + steps(flow.length, E.i) + body + fb;
};
function exFinish(ex, ok, right) {
  const E = app.st.ex; if (E.fb) return; E.fb = { ok, right: right || "" }; E.res[ex.id] = ok;
  log("exercise_answer", { item: ex.id, ok, kind: ex.type }); if (ex.type === "dictation") log("dictation_submit", { item: ex.id, ok });
  if (!ok) relatedWords(ex).forEach(id => { if (S.srs[id]) review(S.srs, id, false, today()); else addCard(S.srs, id, today()); });
  save(); app.render(true);
}
const curEx = () => exById(C.lesson.flow[app.st.ex.i]);
ACT.exans = e => { const ex = curEx(), E = app.st.ex; if (E.fb) return; const v = e.dataset.v; E.sel = ex.type === "choice" ? +v : v;
  if (ex.type === "choice") exFinish(ex, +v === ex.answer, ex.options[ex.answer]);
  else if (ex.type === "truefalse") exFinish(ex, (v === "t") === ex.answer, ex.answer ? t("true_") : t("false_"));
  else if (ex.type === "pictures") exFinish(ex, v === ex.word, wordById(ex.word).ru); };
ACT.build = e => { const E = app.st.ex; if (E.fb) return; if (!E.built.includes(e.dataset.v)) E.built.push(e.dataset.v); app.render(true); };
ACT.unbuild = e => { const E = app.st.ex; if (E.fb) return; E.built.splice(+e.dataset.v, 1); app.render(true); };
ACT.lb = e => { const E = app.st.ex; if (E.fb) return; const k = +e.dataset.v; if (!E.lb.includes(k)) E.lb.push(k); app.render(true); };
ACT.unlb = e => { const E = app.st.ex; if (E.fb) return; E.lb.splice(+e.dataset.v, 1); app.render(true); };
ACT.excheck = () => { const ex = curEx(), E = app.st.ex; if (E.fb) return;
  if (ex.type === "builder") exFinish(ex, norm(E.built.join(" ")) === norm(ex.answer), ex.answer);
  else if (ex.type === "dictation") { if (ex.kind === "letters") { const L = plain(ex.answer).split(""); exFinish(ex, E.lb.map(k => L[k]).join("") === L.join(""), plain(ex.answer)); } else { const el = document.getElementById("typed"); exFinish(ex, norm(el ? el.value : "") === norm(ex.answer), plain(ex.answer)); } } };
ACT.exsay = e => audio.playText(e.dataset.v, e.dataset.id || null);
ACT.exref = () => { app.st.ex.shown = true; app.render(true); };
ACT.exself = e => { const ex = curEx(); exFinish(ex, e.dataset.v === "1", ""); };
ACT.exnext = () => { const E = app.st.ex, n = C.lesson.flow.length; if (E.i < n - 1) { const res = E.res; app.st.ex = Object.assign(newEx(E.i + 1), { res }); app.render(false); app.scrollTop(); } else { app.st.shadow = { i: 0, step: 0 }; app.go("shadow"); } };

/* ---------- Shadowing: без записи голоса и без оценки произношения ---------- */
R.shadow = () => {
  const sh = app.st.shadow, items = C.lesson.shadowing.items, it = items[sh.i], s = sh.step;
  const names = ["s1", "s2", "s3", "s4"], list = names.map((k, i) => '<div class="step' + (i === s ? " on" : "") + '"><span class="n">' + (i + 1) + "</span><span>" + t(k) + "</span></div>").join("");
  let act;
  if (s === 0 || s === 2) act = '<button class="btn" data-act="shsay">' + playIcon(18) + t("listen") + '</button><button class="btn sec" data-act="shnext">' + t("next") + "</button>";
  else if (s === 1) act = '<button class="btn" data-act="shnext">' + t("i_said") + "</button>";
  else act = '<div class="row"><button class="btn" data-act="shrate" data-v="got">' + t("got") + '</button><button class="btn sec" data-act="shrate" data-v="again">' + t("almost") + '</button></div><button class="btn ghost" data-act="shagain">' + t("again") + "</button>";
  return top(t("sh_title")) + steps(items.length, sh.i) + '<div class="card center"><h2 style="font-size:1.5rem">' + esc(it.ru) + '</h2><p class="tr" style="margin-top:6px">' + esc(it.tg) + "</p></div><div>" + list + '</div><div style="display:grid;gap:10px">' + act + '</div><div class="card" style="background:#FFF5E2"><p class="small"><b>' + t("sh_hint_h") + "</b></p><p>" + esc(hint({ ru: it.hint_ru, tg: it.hint_tg })) + '</p></div><p class="small">' + t("sh_priv") + "</p>";
};
ACT.shsay = () => { const it = C.lesson.shadowing.items[app.st.shadow.i]; audio.playText(it.ru, it.audio); };
ACT.shnext = () => { app.st.shadow.step = Math.min(3, app.st.shadow.step + 1); app.render(true); };
ACT.shagain = () => { app.st.shadow.step = 0; app.render(true); };
ACT.shrate = e => {
  const sh = app.st.shadow, items = C.lesson.shadowing.items, it = items[sh.i];
  S.shadow[it.id] = e.dataset.v; log("shadowing_self_rate", { item: it.id, rate: e.dataset.v }); save();
  if (sh.i < items.length - 1) { app.st.shadow = { i: sh.i + 1, step: 0 }; app.render(false); app.scrollTop(); } else app.go("summary");
};

/* ---------- итог урока ---------- */
export function completeLesson() {
  const id = lid(), P = S.progress, cur = P.lessons[id] || {};
  if (cur.status === "done") return cur;
  const res = (app.st.ex && app.st.ex.res) || {}, vals = Object.values(res), correct = vals.filter(Boolean).length;
  const started = app.st.lessonStart || now(), mins = Math.max(1, Math.min(30, Math.round((now() - started) / 60000)));
  const xp = xpForLesson(correct, vals.length), td = today();
  P.lessons[id] = { status: "done", ts: td, score: correct, total: vals.length, xp, rating: null };
  P.xp += xp; P.minutes[td] = (P.minutes[td] || 0) + mins; if (!P.days.includes(td)) P.days.push(td);
  (C.lesson.review.words || []).forEach(w => addCard(S.srs, w, td));
  log("lesson_complete", { lesson: id, score: correct, n: vals.length }); save();
  return P.lessons[id];
}
R.summary = () => {
  const r = completeLesson(), q = ["fb1", "fb2", "fb3", "fb4"].map((k, i) => '<button class="chip" data-act="fb" data-v="' + i + '" aria-pressed="' + (r.rating === i) + '">' + t(k) + "</button>").join("");
  return band() + '<div class="center"><h1>' + t("sum_title") + "</h1>" + bowl(63, t("sum_title")) + '<p style="margin-top:6px"><b>' + t("xp_n", { n: r.xp }) + "</b> · " + t("sum_correct", { a: r.score, b: r.total }) + "</p></div><h3>" + t("sum_q") + '</h3><div class="chips">' + q + "</div>" + (r.rating != null ? '<p class="sub">' + t("fb_thanks") + "</p>" : "") + '<div class="grow"></div><button class="btn warm" data-act="dlgstart">' + t("try_dialog") + '</button><button class="btn" data-act="tohome">' + t("to_home") + "</button>";
};
ACT.fb = e => { const r = S.progress.lessons[lid()]; r.rating = +e.dataset.v; log("lesson_rating", { lesson: lid(), rate: r.rating }); save(); app.render(true); };
