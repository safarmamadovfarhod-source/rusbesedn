import { app } from "../app.js";
import { S, save, today, now } from "../store.js";
import { t, ui, hint } from "../i18n.js";
import { topicFor, moreBtn } from "./grammar.js";
import { C, findWord, findGrammar, isName, exById, wordById, nextLessonId, setCurrent } from "../content.js";
import { esc, norm, plain, shuffle, permOf, permIdx } from "../util.js";
import { band, top, steps, bowl, fbCard, playIcon, IC } from "../ui.js";
import { PICS, wordIcon } from "../pics.js";
import { log } from "../analytics.js";
import * as audio from "../audio.js";
import { addCard, review } from "../srs.js";
import { xpForLesson } from "../progress.js";

const R = app.R, ACT = app.ACT;
const lid = () => C.cur;
const hasTr = () => S.settings.hintLang === "tg" && C.lesson.text.some(l => l.tg);

/* ---------- урок: чтение с подсветкой ---------- */
R.lesson = () => {
  const L = C.lesson, play = '<button class="icon-btn" data-act="playall" aria-label="' + t("play_all") + '">' + playIcon(22, "var(--ink)") + "</button>";
  let h = top(esc(ui(L.meta.title)), { right: play }) + '<p class="small">' + t("tap_hint") + '</p><div class="row" style="flex:none;align-items:stretch"><div class="seg" style="flex:2;min-width:0" role="group" aria-label="' + t("speed") + '">' +
    '<button data-act="speed" data-v="0.75" aria-pressed="' + ((S.speed || 1) === 0.75) + '">' + t("slow") + '</button><button data-act="speed" data-v="1" aria-pressed="' + ((S.speed || 1) === 1) + '">' + t("normal") + '</button></div>' + (hasTr() ? '<button class="chip" style="flex:1;min-width:0" data-act="tr" aria-pressed="' + (S.showTr !== false) + '">' + t("show_tr") + "</button>" : "") + "</div>";
  h += '<div class="card" style="padding:6px 14px">';
  L.text.forEach((l, i) => {
    const ws = l.ru.split(" ").map((w, k) => '<button class="w" data-act="word" data-v="' + norm(w) + '" data-l="' + i + '" data-i="' + k + '">' + esc(w) + "</button>").join(" ");
    h += '<div class="line"><span class="sp ' + l.s + '" aria-hidden="true">' + (l.s === "f" ? "А" : "Р") + '</span><div class="words">' + ws + (S.showTr !== false && hasTr() && l.tg ? '<span class="tr">' + esc(l.tg) + "</span>" : "") + '</div><button class="play" data-act="playline" data-v="' + i + '" aria-label="' + t("listen") + '">' + IC.play + "</button></div>";
  });
  h += '</div><p class="small" id="vnote">' + voiceNote() + '</p><div class="grow"></div>' + (L.rules ? '<button class="btn sec" data-go="rules">' + t("to_rules") + "</button>" : "") + '<button class="btn" data-act="exstart">' + t("to_ex") + "</button>";
  return h;
};
const voiceNote = () => (C.lessonMeta.audio ? "" : t("demo_note") + ". ") + (hasTr() ? t("tg_note") : "");
function highlight(lineIdx, wi) {
  document.querySelectorAll(".w.hot").forEach(e => e.classList.remove("hot"));
  if (wi < 0) return; const el = document.querySelector('.w[data-l="' + lineIdx + '"][data-i="' + wi + '"]'); if (el) el.classList.add("hot");
}
function playLineIdx(i, after) {
  const l = C.lesson.text[i]; log("audio_play_line", { item: l.id });
  audio.playLine({ id: l.audio, text: l.ru, speaker: l.s, speed: S.speed || 1, onWord: wi => highlight(i, wi), onEnd: after });
}
ACT.playline = e => playLineIdx(+e.dataset.v);
ACT.playall = () => { let i = 0; const nxt = () => { if (i < C.lesson.text.length) { const k = i++; playLineIdx(k, nxt); } }; nxt(); };
ACT.speed = e => { S.speed = +e.dataset.v; save(); app.render(true); };
ACT.tr = () => { S.showTr = !(S.showTr !== false); save(); app.render(true); };

/* ---------- правила и частые ошибки (путь «Знаю русский») ---------- */
R.rules = () => {
  const L = C.lesson, rl = (L.rules || []).map(r => '<div class="card"><h3>' + esc(r.title_ru) + "</h3><p>" + esc(r.body_ru) + '</p><p class="small">' + (r.examples_ru || []).map(esc).join(" · ") + "</p>" + moreBtn(topicFor(lid(), "rules", r.id), false) + "</div>").join("");
  const tr = (L.traps || []).map(x => '<div class="card"><p><span class="badge" style="background:#F8DCE3">' + t("wrong_h") + "</span> " + esc(x.wrong_ru) + '</p><p style="margin-top:6px"><span class="badge g">' + t("right_h") + "</span> <b>" + esc(x.right_ru) + '</b></p><p class="small" style="margin-top:6px">' + esc(x.why_ru) + "</p></div>").join("");
  return top(esc(ui(L.meta.title))) + "<h2>" + t("rules_h") + "</h2>" + rl + (tr ? "<h2>" + t("traps_h") + "</h2>" + tr : "") + '<div class="grow"></div><button class="btn" data-act="exstart">' + t("to_ex") + "</button>";
};

/* ---------- окно слова: «Слово» / «Почему так?» ---------- */
function grammarBody(g, name) {
  const H = (a, b) => hint({ ru: a, tg: b }), sec = (k, v) => v ? '<div class="gr"><b>' + t(k) + "</b><p>" + esc(v) + "</p></div>" : "";
  const head = '<p class="small"><b>' + esc(ui({ ru: g.pos_ru, tg: g.pos_tg })) + "</b>" + (g.base && !name ? " · " + t("base_form") + ": <b>" + esc(g.base) + "</b>" : "") + "</p>";
  const spell = (g.spell_ru || g.spell_tg) ? '<details class="card" style="background:#FFF5E2"><summary><b>' + t("spell_h") + "</b></summary><p>" + esc(H(g.spell_ru, g.spell_tg)) + "</p></details>" : "";
  if (g.form_ru || g.form_tg) return head + sec("gr_form", H(g.form_ru, g.form_tg)) + sec("gr_why", H(g.why_ru, g.why_tg)) + sec("gr_link", H(g.link_ru, g.link_tg)) + sec("gr_ex", H(g.ex_ru, g.ex_tg)) + spell;
  return head + "<p>" + esc(H(g.why_ru, g.why_tg)) + "</p>" + (spell ? spell.replace("<details", "<details open") : "");
}
export function sheetHtml() {
  const sh = app.st.sheet; if (!sh) return "";
  const n = sh.w, w = findWord(n), g = findGrammar(n, sh.l), name = isName(n);
  const title = w ? w.ru : (name ? (n === "анна" ? "А́нна" : "Русла́н") : (sh.txt || n));
  const added = !!S.srs[w ? w.id : ""];
  const tabs = '<div class="seg" role="tablist"><button role="tab" data-act="sheettab" data-v="word" aria-pressed="' + (sh.tab === "word") + '">' + t("tab_word") + '</button><button role="tab" data-act="sheettab" data-v="why" aria-pressed="' + (sh.tab === "why") + '">' + t("tab_why") + "</button></div>";
  let body;
  if (sh.tab === "why") {
    body = g ? grammarBody(g, name) + moreBtn(topicFor(lid(), "gl", g.id), true) : "<p>" + t("no_grammar") + "</p>";
    log("grammar_open", { item: g ? g.id : n });
  } else {
    body = w ? '<p class="sub"><b>' + esc(hint({ ru: w.gloss_ru, tg: w.tg })) + '</b></p>' + (w.tg ? '<p class="small">' + esc(hint({ ru: w.tg, tg: w.gloss_ru })) + "</p>" : "") + '<p class="small">' + esc(ui({ ru: w.pos_ru, tg: w.pos_tg })) + '</p><p style="margin-top:6px">' + esc(w.ex) + "</p>" : '<p class="sub"><b>' + (name ? t("name_word") : t("no_word")) + "</b></p>";
  }
  const wordPlay = '<button class="btn" data-act="wsay" data-v="' + esc(title) + '" data-id="' + esc(w ? w.audio : "") + '">' + playIcon(18) + t("listen") + "</button>";
  const addBtn = w ? '<button class="btn sec" data-act="wadd" data-v="' + w.id + '"' + (added ? ' aria-pressed="true"' : "") + ">" + (added ? t("w_added") : t("w_add")) + "</button>" : "";
  return '<div class="sheet-bg" data-act="closesheet"><div class="sheet" role="dialog" aria-modal="true" aria-label="' + esc(plain(title)) + '" data-stop><div class="row" style="align-items:center;flex:none"><div class="pic" aria-hidden="true">' + wordIcon(w) + '</div><div style="flex:3"><h2 style="font-size:1.6rem">' + esc(title) + "</h2>" + (sh.tab === "word" ? "" : "") + "</div></div>" + tabs + body + '<div class="row">' + wordPlay + addBtn + '</div><button class="btn ghost" data-act="closesheet">' + t("w_close") + "</button></div></div>";
}
ACT.word = e => { app.st.sheet = { w: e.dataset.v, tab: "word", l: e.dataset.l != null ? +e.dataset.l : null, txt: e.classList.contains("w") ? e.textContent.replace(/[.,!?;:]+$/, "") : null }; log("word_tap", { item: e.dataset.v }); app.render(true); };
ACT.sheettab = e => { app.st.sheet.tab = e.dataset.v; app.render(true); };
ACT.closesheet = () => { app.st.sheet = null; app.render(true); };
ACT.wsay = e => audio.playText(e.dataset.v, e.dataset.id || null, e.dataset.sp || null);
ACT.wadd = e => { addCard(S.srs, e.dataset.v, today()); save(); app.render(true); app.toast(t("w_added")); };

/* ---------- упражнения по lesson.flow ---------- */
/* класс варианта: выбранный — good/soft; после ошибки правильный вариант тоже подсвечивается зелёным */
/* образец «Меня зовут …» с именем человека, если он его указал (0.3.4, аудит М6) */
const refFor = r => { const nm = (S.settings.name || "").trim(); return nm ? String(r).replace("А́нна", nm) : r; };
const lowFirst = x => { const s = String(x || ""); return s.charAt(0).toLowerCase() + s.slice(1); };
const optCls = (E, v, isRight) => E.sel === v ? (E.fb && E.fb.ok ? " good" : " soft") : (E.fb && isRight ? " good right" : "");
const newEx = i => ({ i, fb: null, sel: null, built: [], lb: [], typed: "", shown: false });
/* место в уроке сохраняется после каждого ответа (0.3.4, аудит В7): звонок или перезагрузка не сбрасывают урок */
const saveSpot = i => { S.resume = { l: lid(), i, res: app.st.ex ? app.st.ex.res : {}, d: today() }; save(); };
export const resumeOf = id => (S.resume && S.resume.l === id && !(S.progress.lessons[id] && S.progress.lessons[id].status === "done")) ? S.resume : null;
ACT.exstart = () => {
  const r = resumeOf(lid()), n = C.lesson.flow.length;
  if (r && r.i > 0) { app.st.ex = Object.assign(newEx(Math.min(r.i, n - 1)), { res: r.res || {} }); log("lesson_resume", { lesson: lid(), item: String(r.i) }); if (r.i >= n) { app.st.shadow = { i: 0, step: 0 }; app.go("shadow"); return; } app.go("exer"); return; }
  app.st.ex = Object.assign(newEx(0), { res: {} }); log("lesson_start", { lesson: lid() }); app.go("exer");
};
ACT.resume = e => { setCurrent(e.dataset.v); app.st.lessonStart = now(); ACT.exstart(); };
const relatedWords = ex => {
  const src = ex.type === "builder" ? ex.answer : ex.type === "choice" ? ex.options[ex.answer] : ex.type === "dictation" ? ex.answer : ex.type === "pictures" ? "" : "";
  const ids = new Set(); plain(src).split(/\s+/).forEach(x => { const w = findWord(norm(x)); if (w) ids.add(w.id); }); if (ex.type === "pictures" || ex.type === "meaning") ids.add(ex.word); return [...ids];
};
R.exer = () => {
  const E = app.st.ex, flow = C.lesson.flow, ex = exById(flow[E.i]);
  let body = "";
  const q = o => "<h2>" + esc(ui(o)) + "</h2>";
  if (ex.type === "choice") body = q({ ru: ex.q_ru, tg: ex.q_tg }) + '<div style="display:grid;gap:8px">' + permIdx(E, "p", ex.options.length).map(i => '<button class="choice' + optCls(E, i, i === ex.answer) + '" data-act="exans" data-v="' + i + '">' + esc(ex.options[i]) + (S.settings.hintLang === "tg" && ex.options_tg && ex.options_tg[i] ? '<span class="tr" style="display:block">' + esc(ex.options_tg[i]) + "</span>" : "") + "</button>").join("") + "</div>";
  else if (ex.type === "truefalse") body = "<h2>" + t("tf_title") + '</h2><div class="card"><p style="font-size:1.25rem;font-weight:700" lang="ru">' + esc(ex.ru) + "</p>" + (S.settings.hintLang === "tg" && ex.tg ? '<p class="tr" style="margin-top:4px">' + esc(ex.tg) + "</p>" : "") + '</div><div class="row"><button class="choice' + optCls(E, "t", ex.answer === true) + '" data-act="exans" data-v="t">' + t("true_") + '</button><button class="choice' + optCls(E, "f", ex.answer === false) + '" data-act="exans" data-v="f">' + t("false_") + "</button></div>";
  else if (ex.type === "builder") {
    const av = permOf(E, "p", ex.ru_tokens, ex.answer.split(" ")); body = "<h2>" + t("ex_build") + '</h2><p class="small">' + esc(hint({ ru: ex.hint_ru, tg: ex.hint_tg }) || "") + '</p><div class="card" style="min-height:64px;display:flex;flex-wrap:wrap;gap:8px;align-items:center" aria-live="polite">' + (E.built.map((w, i) => '<button class="chip" aria-pressed="true" data-act="unbuild" data-v="' + i + '">' + esc(w) + "</button>").join("") || '<span class="small">…</span>') + '</div><div class="chips">' + av.map(w => { const u = E.built.includes(w); return '<button class="chip' + (u ? " used" : "") + '" data-act="build" data-v="' + esc(w) + '"' + (u ? " disabled" : "") + ">" + esc(w) + "</button>"; }).join("") + "</div>" + (E.fb ? "" : '<button class="btn sec" data-act="excheck">' + t("check") + "</button>");
  } else if (ex.type === "dictation") {
    const say = '<button class="btn sec" data-act="exsay" data-v="' + esc(ex.audio) + '" data-id="' + esc(ex.audio_id) + '">' + playIcon(18, "var(--primary-d)") + t("listen") + "</button>";
    if (ex.kind === "letters") { const letters = plain(ex.answer).split(""), av = permOf(E, "p", letters.map((_, i) => i), letters.map((_, i) => i)); body = "<h2>" + t("ex_letters") + "</h2>" + say + '<div class="card" style="min-height:64px;display:flex;flex-wrap:wrap;gap:8px;align-items:center" aria-live="polite">' + (E.lb.map((k, i) => '<button class="chip" aria-pressed="true" data-act="unlb" data-v="' + i + '">' + letters[k] + "</button>").join("") || '<span class="small">…</span>') + '</div><div class="chips">' + av.map(k => { const u = E.lb.includes(k); return '<button class="chip' + (u ? " used" : "") + '" data-act="lb" data-v="' + k + '"' + (u ? " disabled" : "") + ">" + letters[k] + "</button>"; }).join("") + "</div>" + (E.fb ? "" : '<button class="btn sec" data-act="excheck">' + t("check") + "</button>"); }
    else body = "<h2>" + t("ex_type") + "</h2>" + say + (E.fb ? "" : '<input id="typed" class="inp" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" lang="ru" placeholder="' + t("dict_ph") + '" aria-label="' + t("dict_ph") + '"><p class="small">' + t("kb_note") + '</p><button class="btn sec" data-act="excheck">' + t("check") + "</button>");
  } else if (ex.type === "meaning") {
    const mw = wordById(ex.word), opts = permOf(E, "p", ex.options).map(id => wordById(id));
    body = "<h2>" + t("ex_mean") + '</h2><div class="card center"><h2 style="font-size:2rem">' + esc(mw.ru) + '</h2><button class="btn sec" style="margin-top:10px" data-act="exsay" data-v="' + esc(mw.ru) + '" data-id="' + esc(mw.audio) + '">' + playIcon(18, "var(--primary-d)") + t("listen") + '</button></div><div style="display:grid;gap:8px">' + opts.map(w => '<button class="choice' + optCls(E, w.id, w.id === ex.word) + '" data-act="exans" data-v="' + w.id + '">' + esc(hint({ ru: w.gloss_ru, tg: w.tg })) + "</button>").join("") + "</div>";
  } else if (ex.type === "pictures") {
    const opts = permOf(E, "p", ex.options).map(id => wordById(id));
    body = "<h2>" + t("ex_pic") + '</h2><div class="pic" style="width:100%;height:150px;border-radius:18px" role="img" aria-label="' + t("ex_pic") + '">' + PICS[ex.id] + '</div><div style="display:grid;gap:8px">' + opts.map(w => '<button class="choice' + optCls(E, w.id, w.id === ex.word) + '" data-act="exans" data-v="' + w.id + '">' + esc(lowFirst(w.ru)) + "</button>").join("") + "</div>";
  } else { /* free */
    body = "<h2>" + esc(ui({ ru: ex.q_ru, tg: ex.q_tg })) + '</h2><textarea id="free" placeholder="' + t("dict_ph") + '" aria-label="' + esc(ui({ ru: ex.q_ru, tg: ex.q_tg })) + '" lang="ru"></textarea><p class="small">' + t("kb_note") + '</p><p class="small">' + esc(hint({ ru: ex.note_ru, tg: ex.note_tg })) + "</p>" +
      (E.shown ? '<div class="card" style="background:var(--tint)"><p class="small"><b>' + t("ex_ref_h") + '</b></p><h3 style="margin-top:4px">' + esc(refFor(ex.reference)) + "</h3></div>" + (E.fb ? "" : "<h3>" + t("ex_self") + '</h3><div class="row"><button class="btn" data-act="exself" data-v="1">' + t("ex_same") + '</button><button class="btn sec" data-act="exself" data-v="0">' + t("ex_redo") + "</button></div>") : '<button class="btn sec" data-act="exref">' + t("ex_ref") + "</button>");
  }
  let fb = "";
  if (E.fb) {
    const expl = ex.expl_ru ? esc(hint({ ru: ex.expl_ru, tg: ex.expl_tg })) : "";
    /* 0.3.6: после ошибки — «Неверно» (без «Почти»); в «Верно/неверно» правильный ответ и так подсвечен */
    const head = E.fb.ok ? t("fb_ok") : (ex.type === "truefalse" || !E.fb.right ? t("fb_bad") : t("fb_soft") + esc(E.fb.right));
    fb = fbCard(E.fb.ok, head + (expl ? '<span class="small" style="display:block;font-weight:400;margin-top:4px">' + expl + "</span>" : "")) + moreBtn(topicFor(lid(), "ex", ex.id), !E.fb.ok) + '<button class="btn" data-act="exnext">' + t("next") + "</button>";
  }
  const errBtn = '<button class="btn ghost small" data-act="exerr">' + t("ex_err") + "</button>";
  return top(t("ex_title")) + steps(flow.length, E.i) + body + fb + errBtn;
};
function exFinish(ex, ok, right) {
  const E = app.st.ex; if (E.fb) return; E.fb = { ok, right: right || "" }; E.res[ex.id] = ok;
  log("exercise_answer", { item: ex.id, ok, kind: ex.type }); if (ex.type === "dictation") log("dictation_submit", { item: ex.id, ok });
  if (!ok) relatedWords(ex).forEach(id => { if (S.srs[id]) review(S.srs, id, false, today()); else addCard(S.srs, id, today()); });
  saveSpot(E.i + 1); app.render(true);
}
const curEx = () => exById(C.lesson.flow[app.st.ex.i]);
ACT.exans = e => { const ex = curEx(), E = app.st.ex; if (E.fb) return; const v = e.dataset.v; E.sel = ex.type === "choice" ? +v : v;
  if (ex.type === "choice") exFinish(ex, +v === ex.answer, ex.options[ex.answer]);
  else if (ex.type === "truefalse") exFinish(ex, (v === "t") === ex.answer, ex.answer ? t("true_") : t("false_"));
  else if (ex.type === "pictures") exFinish(ex, v === ex.word, wordById(ex.word).ru);
  else if (ex.type === "meaning") { const w = wordById(ex.word); exFinish(ex, v === ex.word, hint({ ru: w.gloss_ru, tg: w.tg })); } };
ACT.build = e => { const E = app.st.ex; if (E.fb) return; if (!E.built.includes(e.dataset.v)) E.built.push(e.dataset.v); app.render(true); };
ACT.unbuild = e => { const E = app.st.ex; if (E.fb) return; E.built.splice(+e.dataset.v, 1); app.render(true); };
ACT.lb = e => { const E = app.st.ex; if (E.fb) return; const k = +e.dataset.v; if (!E.lb.includes(k)) E.lb.push(k); app.render(true); };
ACT.unlb = e => { const E = app.st.ex; if (E.fb) return; E.lb.splice(+e.dataset.v, 1); app.render(true); };
ACT.excheck = () => { const ex = curEx(), E = app.st.ex; if (E.fb) return;
  if (ex.type === "builder") exFinish(ex, norm(E.built.join(" ")) === norm(ex.answer), ex.answer);
  else if (ex.type === "dictation") { if (ex.kind === "letters") { const L = plain(ex.answer).split(""); exFinish(ex, E.lb.map(k => L[k]).join("") === L.join(""), plain(ex.answer)); } else { const el = document.getElementById("typed"); const ans = plain(ex.answer); exFinish(ex, norm(el ? el.value : "") === norm(ex.answer), isName(norm(ans)) ? ans.charAt(0).toUpperCase() + ans.slice(1) : ans); } } };
ACT.exsay = e => audio.playText(e.dataset.v, e.dataset.id || null);
/* сообщение об ошибке в конкретном задании: категория «Ошибка в тексте или переводе», номер урока и задания подставляются сами */
ACT.exerr = () => { const ex = curEx(); app.st.rep = { kind: 1, sent: false, logs: false, text: t("ex_err_pre", { l: lid(), e: ex.id }) + " ", back: true }; log("exercise_report", { item: ex.id }); app.go("report"); };
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
  return top(t("sh_title")) + steps(items.length, sh.i) + '<div class="card center"><h2 style="font-size:1.5rem">' + esc(it.ru) + '</h2>' + (S.settings.hintLang === "tg" && it.tg ? '<p class="tr" style="margin-top:6px">' + esc(it.tg) + "</p>" : "") + '</div><div>' + list + '</div><div style="display:grid;gap:10px">' + act + '</div><div class="card" style="background:#FFF5E2"><p class="small"><b>' + t("sh_hint_h") + "</b></p><p>" + esc(hint({ ru: it.hint_ru, tg: it.hint_tg })) + '</p></div><p class="small">' + t("sh_priv") + "</p>";
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
  P.lessons[id] = { status: "done", ts: td, score: correct, total: vals.length, xp, rating: null }; if (S.resume && S.resume.l === id) S.resume = null;
  P.xp += xp; P.minutes[td] = (P.minutes[td] || 0) + mins; if (!P.days.includes(td)) P.days.push(td);
  (C.lesson.review.words || []).forEach(w => addCard(S.srs, w, td));
  log("lesson_complete", { lesson: id, score: correct, n: vals.length }); save();
  return P.lessons[id];
}
R.summary = () => {
  const r = completeLesson(), q = ["fb1", "fb2", "fb3", "fb4"].map((k, i) => '<button class="chip" data-act="fb" data-v="' + i + '" aria-pressed="' + (r.rating === i) + '">' + t(k) + "</button>").join("");
  return band() + '<div class="center"><h1>' + t("sum_title") + "</h1>" + bowl(63, t("sum_title")) + '<p style="margin-top:6px"><b>' + t("xp_n", { n: r.xp }) + "</b> · " + t("sum_correct", { a: r.score, b: r.total }) + "</p></div><h3>" + t("sum_q") + '</h3><div class="chips">' + q + "</div>" + (r.rating != null ? '<p class="sub">' + t("fb_thanks") + "</p>" : "") + '<div class="grow"></div><button class="btn warm" data-act="dlgstart" data-v="' + lid() + '">' + t("try_dialog") + "</button>" + (nextLessonId() ? '<button class="btn" data-act="startlesson" data-v="' + nextLessonId() + '">' + t("next_lesson") + '</button><button class="btn sec" data-act="tohome">' + t("to_home") + "</button>" : '<button class="btn" data-act="tohome">' + t("to_home") + "</button>");
};
ACT.fb = e => { const r = S.progress.lessons[lid()]; r.rating = +e.dataset.v; log("lesson_rating", { lesson: lid(), rate: r.rating }); save(); app.render(true); };
