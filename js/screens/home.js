import { app } from "../app.js";
import { S, save, today, now } from "../store.js";
import { t, ui, hint } from "../i18n.js";
import { C, wordById } from "../content.js";
import { esc, diffDays, plain } from "../util.js";
import { band, top, steps, bowl, star, IC, playIcon } from "../ui.js";
import { computeStreak, weekMinutes, weekGoal } from "../progress.js";
import { dueList, review, learnedCount } from "../srs.js";
import { log } from "../analytics.js";
import * as audio from "../audio.js";

const R = app.R, ACT = app.ACT, lid = () => C.lessonMeta.id;
const lessonDone = () => { const r = S.progress.lessons[lid()]; return !!r && (r.status === "done" || r.status === "skipped"); };

app.startLesson = () => { app.st.lessonStart = now(); app.st.ex = null; app.go("lesson"); };
ACT.startlesson = () => app.startLesson();
ACT.tohome = () => { app.stack = []; app.go("home", { noPush: true }); };

R.home = () => {
  const P = S.progress, td = today(), total = weekGoal(S.settings.dailyMin), got = weekMinutes(P.minutes, td), pct = Math.min(100, Math.round(got / total * 100));
  const streak = computeStreak(P.days, td), due = dueList(S.srs, td).length, done = lessonDone();
  const all = C.courses.courses[0].lessons.slice(0, 4);
  const stations = all.map(l => { const d = l.id === lid() && done; return '<div class="st">' + (d ? star("#0D7C76", "#14302E", 1.5) : star("#fff", "#0D7C76", 2)) + "<span>" + esc(ui(l.title)) + "</span></div>"; }).join("");
  const meta = C.lesson.meta, can = ui(C.lesson.passport.can_do[0]);
  let card;
  if (!done) card = '<div class="card" style="display:grid;grid-template-columns:44px 1fr;gap:12px"><div style="width:44px;height:44px;color:#0D7C76">' + star("#0D7C76", "#14302E", 1.5) + '</div><div><small class="small">' + t("lesson1") + "</small><h3>" + esc(ui(meta.title)) + '</h3><p class="sub">' + esc(can) + '</p></div><button class="btn warm" style="grid-column:1/-1" data-act="startlesson">' + t("continue") + '</button><button class="btn ghost" style="grid-column:1/-1" data-act="skipstart">' + t("skip_offer") + "</button></div>";
  else card = '<div class="card" style="display:grid;gap:10px"><div><small class="small">' + t("lesson1") + "</small><h3>" + t("lesson_done") + " ✓</h3></div>" + (due ? '<button class="btn warm" data-act="revstart">' + t("rev_btn", { n: due }) + "</button>" : '<p class="sub">' + t("rev_none") + "</p>") + '<button class="btn sec" data-act="startlesson">' + t("lesson_again") + "</button></div>";
  const off = typeof navigator !== "undefined" && navigator.onLine === false ? '<button class="card" data-go="offline" style="display:block;text-align:left"><b>' + t("off_title") + '</b><span class="small" style="display:block">' + t("off_banner") + "</span></button>" : "";
  return band() + '<div class="top" style="margin-top:-2px"><h1 class="grow">' + t("hello") + '</h1><button class="icon-btn" data-go="settings" aria-label="' + t("set_title") + '">' + IC.gear + "</button></div>" + off +
    '<div class="center">' + bowl(pct, t("weekgoal")) + '<p style="margin-top:6px"><b>' + t("min_of", { a: got, b: total }) + '</b></p><p class="small">' + t("weekgoal") + '</p><p class="sub" style="margin-top:4px">' + t("home_sub") + '</p><p style="margin-top:8px"><span class="badge g">' + t("streak", { n: streak }) + '</span></p><p class="small">' + t("streak_note") + "</p></div>" + card + '<div class="stations">' + stations + "</div>";
};

/* ---------- повторение слов ---------- */
ACT.revstart = () => { const q = dueList(S.srs, today()); app.st.rev = { q, i: 0, shown: false, know: 0 }; app.go("review"); };
R.review = () => {
  const r = app.st.rev;
  if (!r || r.i >= r.q.length) {
    const n = r ? r.q.length : 0;
    return band() + '<div class="center"><h1>' + t("rev_done") + "</h1>" + bowl(70, t("rev_done")) + '<p style="margin-top:6px">' + t("rev_done_n", { a: r ? r.know : 0, b: n }) + '</p></div><div class="grow"></div><button class="btn" data-act="tohome">' + t("to_home") + "</button>";
  }
  const w = wordById(r.q[r.i]);
  return top(t("rev_title")) + steps(r.q.length, r.i) + '<div class="card center"><h2 style="font-size:2rem">' + esc(w.ru) + '</h2><button class="btn sec" style="margin-top:10px" data-act="wsay" data-v="' + esc(w.ru) + '" data-id="' + esc(w.audio) + '">' + playIcon(18, "#0A5F5A") + t("listen") + "</button></div>" +
    (r.shown ? '<div class="card"><p class="sub"><b>' + esc(hint({ ru: w.gloss_ru, tg: w.tg })) + '</b></p><p class="small">' + esc(hint({ ru: w.tg, tg: w.gloss_ru })) + '</p><p style="margin-top:6px">' + esc(w.ex) + '</p></div><div class="row"><button class="btn" data-act="revknow" data-v="1">' + t("rev_know") + '</button><button class="btn sec" data-act="revknow" data-v="0">' + t("rev_dont") + "</button></div>" : '<button class="btn" data-act="revshow">' + t("rev_show") + "</button>");
};
ACT.revshow = () => { app.st.rev.shown = true; app.render(true); };
ACT.revknow = e => {
  const r = app.st.rev, id = r.q[r.i], know = e.dataset.v === "1", td = today();
  review(S.srs, id, know, td); if (know) r.know++; log("exercise_answer", { item: id, ok: know, kind: "review" });
  r.i++; r.shown = false;
  if (r.i >= r.q.length) { const m = Math.max(1, Math.round(r.q.length * 0.4)); S.progress.minutes[td] = (S.progress.minutes[td] || 0) + m; if (!S.progress.days.includes(td)) S.progress.days.push(td); }
  save(); app.render(false); app.scrollTop();
};

/* ---------- вкладка «Слова» ---------- */
R.words = () => {
  const td = today(), due = dueList(S.srs, td).length, words = C.lesson.words.filter(w => w.type !== "service");
  const list = words.map(w => '<button class="li" style="width:100%;border:0;background:transparent;text-align:left;cursor:pointer" data-act="word" data-v="' + esc(plain(w.ru).toLowerCase()) + '"><span class="grow"><b>' + esc(w.ru) + '</b><span class="small">' + esc(hint({ ru: w.gloss_ru, tg: w.tg })) + '</span></span><span class="badge ' + (S.srs[w.id] ? "g" : "") + '">' + (S.srs[w.id] ? t("w_inrev") : t("w_new")) + "</span></button>").join("");
  return band() + "<h1>" + t("w_title") + '</h1><div class="card" style="display:grid;gap:10px"><h3>' + t("w_today", { n: due }) + "</h3>" + (due ? '<button class="btn warm" data-act="revstart">' + t("start") + "</button>" : '<p class="sub">' + t("rev_none") + "</p>") + "</div><h3>" + t("w_list") + '</h3><div class="card" style="padding:4px 14px">' + list + "</div>";
};

/* ---------- вкладка «Диалоги» ---------- */
R.talk = () => {
  const c = (title, on) => '<button class="card choice" style="display:flex"' + (on ? ' data-act="dlgstart"' : " disabled") + '><span class="grow"><h3>' + esc(title) + "</h3></span>" + (on ? '<span class="badge g">' + t("start") + "</span>" : '<span class="badge">' + t("t_soon") + "</span>") + "</button>";
  return band() + "<h1>" + t("t_title") + '</h1><p class="sub">' + t("t_sub") + "</p>" + c(ui(C.lesson.scenario.title), true) + c(t("t2"), false) + c(t("t3"), false) + '<p class="small">' + t("t_note") + "</p>";
};

/* ---------- вкладка «Прогресс» ---------- */
R.progress = () => {
  const P = S.progress, td = today(), total = weekGoal(S.settings.dailyMin), got = weekMinutes(P.minutes, td), pct = Math.min(100, Math.round(got / total * 100)), done = lessonDone();
  const can = C.lesson.passport.can_do.map(c => '<div class="li"><span class="tick' + (done ? " on" : "") + '">' + (done ? IC.check : "") + '</span><span class="grow">' + esc(ui(c)) + "</span></div>").join("");
  const bs = [["b1", done], ["b2", Object.values(S.srs).some(c => c.seen > 0)], ["b3", !!S.badges.dialog]];
  const bd = bs.map(x => '<div class="center" style="flex:1"><div style="width:44px;height:44px;margin:0 auto;opacity:' + (x[1] ? 1 : 0.35) + '">' + star(x[1] ? "#E3A33B" : "#fff", "#14302E", 1.5) + '</div><span class="small">' + t(x[0]) + "</span></div>").join("");
  return band() + "<h1>" + t("p_title") + '</h1><div class="card center">' + bowl(pct, t("p_week")) + '<p style="margin-top:6px"><b>' + t("min_of", { a: got, b: total }) + '</b></p><p class="small">' + t("p_week") + '</p><p class="small">' + t("p_lessons") + ": " + (done ? 1 : 0) + " · " + t("p_words") + ": " + learnedCount(S.srs) + " · XP: " + P.xp + '</p><p style="margin-top:6px"><span class="badge g">' + t("streak", { n: computeStreak(P.days, td) }) + '</span></p><p class="small">' + t("streak_note") + "</p></div><h3>" + t("p_can") + '</h3><div class="card" style="padding:4px 14px">' + can + "</div><h3>" + t("p_badges") + '</h3><div class="card" style="display:flex;gap:6px">' + bd + "</div>";
};

/* ---------- нет интернета и возврат после перерыва ---------- */
R.offline = () => band() + '<div class="center"><svg viewBox="0 0 64 64" width="84" height="84" aria-hidden="true"><path d="M8 24c14-12 34-12 48 0M16 33c10-8 22-8 32 0M25 42c5-4 9-4 14 0" fill="none" stroke="#14302E" stroke-width="4" stroke-linecap="round"/><circle cx="32" cy="52" r="4" fill="#14302E"/><path d="M10 10l44 44" stroke="#B3224B" stroke-width="4" stroke-linecap="round"/></svg><h1 style="margin-top:6px">' + t("off_title") + "</h1></div><p>" + t("off_text") + '</p><div class="card">' + ["off_l1", "off_l2", "off_l3"].map(k => '<div class="li"><span class="tick on">' + IC.check + '</span><span class="grow">' + t(k) + "</span></div>").join("") + '</div><div class="grow"></div><button class="btn" data-act="tohome">' + t("off_btn") + "</button>";
R.back = () => {
  const n = app.st.gap || 3, due = dueList(S.srs, today()).length, P = S.progress;
  const got = weekMinutes(P.minutes, today()), total = weekGoal(S.settings.dailyMin);
  return band() + '<div class="center"><h1>' + t("bk_title") + "</h1>" + bowl(Math.max(8, Math.round(got / total * 100)), t("bk_title")) + '<p class="sub" style="margin-top:8px">' + t("bk_text_n", { n }) + '</p><p style="margin-top:6px"><b>' + t("bk_goal", { n: total }) + '</b></p></div><div class="grow"></div>' +
    (due ? '<button class="btn warm" data-act="revstart">' + t("bk_5") + "</button>" : "") + '<button class="btn' + (due ? " sec" : " warm") + '" data-act="' + (lessonDone() ? "tohome" : "startlesson") + '">' + (lessonDone() ? t("to_home") : t("bk_c")) + "</button>";
};
