import { app } from "../app.js";
import { S, save, today, now } from "../store.js";
import { t, ui, hint } from "../i18n.js";
import { permissionPending } from "../cup.js";
import { C, wordById, setCurrent, track, orderedLessons, nextLessonId, lessonDoneId, courseOf, trackLessons, lessonOfTopic } from "../content.js";
import { esc, diffDays, plain, norm, addDays, weekStart } from "../util.js";
import { band, top, steps, bowl, star, IC, playIcon } from "../ui.js";
import { computeStreak, weekMinutes, weekGoal } from "../progress.js";
import { dueList, review, learnedCount } from "../srs.js";
import { log } from "../analytics.js";
import { mascotImg, wordIcon } from "../pics.js";
import * as audio from "../audio.js";

const R = app.R, ACT = app.ACT;
const goLabel = () => doneCount() ? t("continue") : t("start");
const doneCount = () => trackLessons(track()).filter(l => lessonDoneId(l.id)).length;
const lessonNo = id => orderedLessons(track()).findIndex(l => l.id === id) + 1;

app.startLesson = id => { if (id) setCurrent(id); app.st.lessonStart = now(); app.st.ex = null; app.go("lesson"); };
ACT.startlesson = e => app.startLesson(e && e.dataset ? e.dataset.v : null);
ACT.tohome = () => { app.stack = []; app.go("home", { noPush: true }); };

/* ---------- подсказка установки на iPhone ---------- */
export const isIOS = () => typeof navigator !== "undefined" && (/iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));
export const isStandalone = () => typeof window !== "undefined" && (window.navigator.standalone === true || (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches));
export const iosSteps = () => '<ol class="small" style="margin:6px 0 0 18px;padding:0"><li>' + t("ios_1") + "</li><li>" + t("ios_2") + "</li><li>" + t("ios_3") + "</li><li>" + t("ios_4") + "</li></ol>";
const iosCard = () => (isIOS() && !isStandalone() && !S.iosHintOff) ? '<div class="card" role="note"><b>' + t("ios_h") + "</b>" + iosSteps() + '<button class="btn ghost" data-act="ioshide">' + t("ios_hide") + "</button></div>" : "";
ACT.ioshide = () => { S.iosHintOff = true; save(); app.render(true); };
export const wordsLine = () => { const n = Object.keys(S.srs).length, l = learnedCount(S.srs); return n + (l ? " (" + t("p_learned", { n: l }) + ")" : ""); };
const progressCard = () => { const P = S.progress; return '<button class="card" data-go="progress" style="display:block;text-align:left;width:100%"><b>' + t("p_title") + '</b><span class="small" style="display:block">' + t("p_lessons") + ": " + doneCount() + " · " + t("p_words") + ": " + wordsLine() + " · XP: " + P.xp + "</span></button>"; };

/* карточка «Мои сильные и слабые стороны» (путь «Знаю русский») */
export const topicsView = () => {
  const db = C.diag.b, res = S.diagB; if (!db || !res) return [];
  return db.topics.map(tp => ({ id: tp.id, title: ui(tp.title), lesson: tp.lesson, score: res[tp.id] || 0, strong: (res[tp.id] || 0) >= db.result.strong_min }));
};
const strengthsCard = () => {
  if (track() !== "b") return "";
  const tv = topicsView();
  if (!tv.length) return '<div class="card"><b>' + t("strong_h") + '</b><p class="small">' + t("strong_none") + '</p><button class="btn sec" data-act="startdiagb">' + t("strong_cta") + "</button></div>";
  return '<div class="card"><b>' + t("strong_h") + "</b>" + tv.map(x => '<div class="li"><span class="tick' + (x.strong ? " on" : "") + '">' + (x.strong ? IC.check : "") + '</span><span class="grow">' + esc(x.title) + '</span><span class="badge ' + (x.strong ? "g" : "") + '">' + (x.strong ? t("strong_s") : t("weak_s")) + "</span></div>").join("") + "</div>";
};

R.home = () => {
  const P = S.progress, td = today(), total = weekGoal(S.settings.dailyMin), got = weekMinutes(P.minutes, td), pct = Math.min(100, Math.round(got / total * 100));
  const streak = computeStreak(P.days, td), due = dueList(S.srs, td).length, tr = track(), nid = nextLessonId(tr);
  const all = courseOf(tr).lessons.slice(0, 4);
  const stations = all.map(l => { const d = lessonDoneId(l.id); return '<div class="st">' + (d ? star("var(--primary)", "var(--ink)", 1.5) : star("var(--surface)", "var(--primary)", 2)) + "<span>" + esc(ui(l.title)) + "</span></div>"; }).join("");
  let card;
  if (nid) {
    const L = C.lessons[nid], meta = L.meta, can = ui(L.data.passport.can_do[0]);
    card = '<div class="card" style="display:grid;grid-template-columns:44px 1fr;gap:12px"><div style="width:44px;height:44px;color:var(--primary)">' + star("var(--primary)", "var(--ink)", 1.5) + '</div><div><small class="small">' + t("lesson_n", { n: lessonNo(nid) }) + "</small><h3>" + esc(ui(meta.title)) + '</h3><p class="sub">' + esc(can) + '</p></div><button class="btn warm" style="grid-column:1/-1" data-act="startlesson" data-v="' + nid + '">' + goLabel() + "</button>" +
      (tr === "a" && nid === "a0_01" ? '<button class="btn ghost" style="grid-column:1/-1" data-act="skipstart">' + t("skip_offer") + "</button>" : "") + "</div>";
  } else {
    const last = orderedLessons(tr).slice(-1)[0];
    card = '<div class="card" style="display:grid;gap:10px"><div><h3>' + t("lesson_done") + " ✓</h3><p class=\"sub\">" + t("all_done") + "</p></div>" + (due ? '<button class="btn warm" data-act="revstart">' + t("rev_btn", { n: due }) + "</button>" : '<p class="sub">' + t("rev_none") + "</p>") + (last ? '<button class="btn sec" data-act="startlesson" data-v="' + last.id + '">' + t("lesson_again") + "</button>" : "") + "</div>";
  }
  const off = typeof navigator !== "undefined" && navigator.onLine === false ? '<button class="card" data-go="offline" style="display:block;text-align:left"><b>' + t("off_title") + '</b><span class="small" style="display:block">' + t("off_banner") + "</span></button>" : "";
  const th = S.settings.theme || "c", revBtn = nid && due ? '<button class="btn sec" data-act="revstart">' + t("rev_btn", { n: due }) + "</button>" : "";
  const tiltBtn = permissionPending() ? '<button class="btn ghost" data-act="tiltask">' + t("tilt_ask") + '</button><p class="small center">' + t("tilt_note") + "</p>" : "";
  const tail = revBtn + strengthsCard() + progressCard(), pre = off + iosCard();
  const nm0 = (S.settings.name || "").trim(), head = '<div class="top" style="margin-top:-2px"><h1 class="grow">' + esc(nm0 ? t("hello_name", { name: nm0 }) : t("hello")) + "</h1></div>";
  if (th === "a") { /* «Путь»: цель недели строкой, карта пути, карточка урока */
    const route = '<div class="route" aria-label="' + esc(ui(courseOf(tr).title)) + '">' + all.map((l, k) => { const d = lessonDoneId(l.id), cur = nid === l.id; return '<div class="rt' + (d ? " done" : "") + (cur ? " cur" : "") + (l.path ? "" : " soon") + '"><span class="dot">' + (d ? IC.check : k + 1) + '</span><span class="lbl">' + esc(ui(l.title)) + "</span></div>"; }).join("") + "</div>";
    return band() + head + pre + '<div class="card goalrow"><div class="cupsm">' + bowl(pct, t("weekgoal")) + '</div><div class="grow"><b>' + t("min_of", { a: got, b: total }) + '</b><div class="bar" role="img" aria-label="' + pct + '%"><i style="width:' + pct + '%"></i></div><p class="small">' + t("weekgoal") + '</p><span class="badge g">' + t("streak", { n: streak }) + "</span></div></div>" + tiltBtn + route + card + tail;
  }
  if (th === "b") { /* «Ы-талисман» (D-60): шапка с талисманом, дни недели, карточка урока, чаша из кода */
    const ws = weekStart(td), wd = t("wd").split(","), tdMin = P.minutes[td] || 0, dm = S.settings.dailyMin, dpct = Math.min(100, Math.round(tdMin / dm * 100));
    const days = wd.map((x, k) => { const ds = addDays(ws, k), on = P.days.includes(ds), cls = ds === td ? "today" : (on ? "on" : (ds > td ? "fut" : "")); return '<span class="' + cls + '"' + (ds === td ? ' aria-current="date"' : "") + ">" + x + (ds === td ? "<i></i>" : (on ? IC.check.replace("<svg", '<svg role="img" aria-label="' + t("studied") + '"') : "")) + "</span>"; }).join("");
    const nm = (S.settings.name || "").trim(), greet = esc(nm ? t("hello_name", { name: nm }) : t("hello_plain"));
    const hdr = '<div class="hdr"><div class="hrow"><div class="mcirc">' + mascotImg("wave", 104, "") + '</div><div class="grow"><h1>' + greet + '</h1><div class="hsub">' + t("today_min", { a: tdMin, b: dm }) + '</div><div class="hbar" role="img" aria-label="' + dpct + '%"><i style="width:' + dpct + '%"></i></div></div></div><div class="wdh" role="group" aria-label="' + t("weekgoal") + '">' + days + "</div></div>";
    let lcard = card;
    if (nid) {
      const ttl = plain(ui(C.lessons[nid].meta.title)), letter = ttl.charAt(0).toUpperCase(), nTot = trackLessons(tr).length || 1, lp = Math.round(doneCount() / nTot * 100);
      lcard = '<div class="card3"><div class="hrow"><div class="ltile" aria-hidden="true">' + esc(letter) + '</div><div class="grow"><div class="lbl-up">' + t("lesson_n", { n: lessonNo(nid) }) + "</div><h2>" + esc(ttl) + '</h2></div></div><div class="lbar" style="margin-top:14px" role="img" aria-label="' + lp + '%"><i style="width:' + lp + '%"></i></div><button class="btn go" style="margin-top:16px" data-act="startlesson" data-v="' + nid + '">' + goLabel() + "</button>" + (tr === "a" && nid === "a0_01" ? '<button class="btn ghost" data-act="skipstart">' + t("skip_offer") + "</button>" : "") + "</div>";
    }
    return hdr + pre + lcard + '<div class="card3 goalrow"><div class="cupsm">' + bowl(pct, t("weekgoal")) + '</div><div class="grow"><b>' + t("min_of", { a: got, b: total }) + '</b><div class="bar" role="img" aria-label="' + pct + '%"><i style="width:' + pct + '%"></i></div><p class="small">' + t("weekgoal") + "</p></div></div>" + tiltBtn + tail;
  }
  /* «Чаша» (по умолчанию) */
  return band() + head + pre + '<div class="center">' + bowl(pct, t("weekgoal")) + '<p style="margin-top:6px"><b>' + t("min_of", { a: got, b: total }) + '</b></p><p class="small">' + t("weekgoal") + '</p>' + (got ? "" : '<p class="sub" style="margin-top:4px">' + t("home_sub") + "</p>") + '<p style="margin-top:8px"><span class="badge g">' + t("streak", { n: streak }) + '</span></p><p class="small">' + t("streak_note") + "</p></div>" + tiltBtn + card + '<div class="stations">' + stations + "</div>" + tail;
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
  return top(t("rev_title")) + steps(r.q.length, r.i) + '<div class="card center"><h2 style="font-size:2rem">' + esc(w.ru) + '</h2><button class="btn sec" style="margin-top:10px" data-act="wsay" data-v="' + esc(w.ru) + '" data-id="' + esc(w.audio) + '">' + playIcon(18, "var(--primary-d)") + t("listen") + "</button></div>" +
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

/* ---------- вкладка «Слова» (D-54): шапка, плитки с картинками по урокам ---------- */
ACT.revall = () => { const q = Object.keys(S.srs).slice(0, 20); if (!q.length) { app.toast(t("rev_none")); return; } app.st.rev = { q, i: 0, shown: false, know: 0 }; app.go("review"); };
R.words = () => {
  const td = today(), due = dueList(S.srs, td).length, nid = nextLessonId(), vis = orderedLessons().filter(l => lessonDoneId(l.id) || l.id === nid), seen = Object.keys(S.srs).length;
  const cur = nid || (vis.length ? vis[vis.length - 1].id : null), sub = cur ? t("w_sub", { n: lessonNo(cur), title: plain(ui(C.lessons[cur].meta.title)) }) : "";
  const hdr = '<div class="hdr"><div class="hrow"><div class="grow"><h1>' + t("w_title") + "</h1>" + (sub ? '<div class="hsub">' + esc(sub) + "</div>" : "") + '</div><div class="mcirc sm">' + mascotImg("hi", 76, "") + "</div></div></div>";
  let today_;
  if (due) today_ = '<div class="card3" style="display:grid;gap:12px"><h3>' + t("w_today", { n: due }) + '</h3><button class="btn go" data-act="revstart">' + t("start") + "</button></div>";
  else if (seen) today_ = '<div class="card3 empty"><div class="mcirc">' + mascotImg("win", 118, "") + "</div><h2>" + t("empty_h") + '</h2><p class="sub">' + t("empty_s") + "</p>" + (nid ? '<button class="btn go" data-act="startlesson" data-v="' + nid + '">' + t("next_lesson") + "</button>" : "") + '<button class="btn sec" data-act="revall">' + t("empty_again") + "</button></div>";
  else today_ = '<div class="card3"><h3>' + t("w_today", { n: 0 }) + '</h3><p class="sub">' + t("rev_none") + "</p></div>";
  const groups = vis.map(l => {
    const L = C.lessons[l.id], words = L.data.words.filter(w => w.type !== "service"), got = words.filter(w => S.srs[w.id]).length, pc = words.length ? Math.round(got / words.length * 100) : 0;
    return '<div class="lh"><h3>' + esc(ui(L.meta.title)) + '</h3><span class="small">' + t("w_prog", { a: got, b: words.length }) + '</span></div><div class="lbar" role="img" aria-label="' + pc + '%"><i style="width:' + pc + '%"></i></div><div class="wgrid">' + words.map(w => { const rep = !!S.srs[w.id]; return '<button class="wtile" data-act="word" data-v="' + esc(norm(w.ru)) + '"><span class="dot' + (rep ? " rep" : "") + '" role="img" aria-label="' + (rep ? t("w_rep") : t("w_new")) + '"></span><span class="wi">' + wordIcon(w) + "</span><b>" + esc(w.ru) + '</b><span class="small">' + esc(hint({ ru: w.gloss_ru, tg: w.tg })) + "</span></button>"; }).join("") + "</div>";
  }).join("");
  return hdr + today_ + groups;
};

/* ---------- вкладка «Диалоги» ---------- */
R.talk = () => {
  const c = (title, id) => '<button class="card choice" style="display:flex"' + (id ? ' data-act="dlgstart" data-v="' + id + '"' : " disabled") + '><span class="grow"><h3>' + esc(title) + "</h3></span>" + (id ? '<span class="badge g">' + t("start") + "</span>" : '<span class="badge">' + t("t_soon") + "</span>") + "</button>";
  const list = orderedLessons().map(l => c(ui(C.lessons[l.id].data.scenario.title), l.id)).join("");
  return band() + "<h1>" + t("t_title") + '</h1><p class="sub">' + t("t_sub") + "</p>" + list + (track() === "a" ? c(t("t2"), null) + c(t("t3"), null) : "") + '<p class="small">' + t("t_note") + "</p>";
};

/* ---------- экран «Прогресс» (из «Ещё» и с главной) ---------- */
R.progress = () => {
  const P = S.progress, td = today(), total = weekGoal(S.settings.dailyMin), got = weekMinutes(P.minutes, td), pct = Math.min(100, Math.round(got / total * 100)), n = doneCount(), any = n > 0;
  const can = orderedLessons().map(l => C.lessons[l.id]).map(L => { const d = lessonDoneId(L.meta.id); return L.data.passport.can_do.map(c => '<div class="li"><span class="tick' + (d ? " on" : "") + '">' + (d ? IC.check : "") + '</span><span class="grow">' + esc(ui(c)) + "</span></div>").join(""); }).join("");
  const bs = [["b1", any], ["b2", Object.values(S.srs).some(c => c.seen > 0)], ["b3", !!S.badges.dialog]];
  const bd = bs.map(x => '<div class="center" style="flex:1"><div style="width:44px;height:44px;margin:0 auto;opacity:' + (x[1] ? 1 : 0.35) + '">' + star(x[1] ? "var(--tea)" : "var(--surface)", "var(--ink)", 1.5) + '</div><span class="small">' + t(x[0]) + "</span></div>").join("");
  return top(t("p_title")) + '<div class="card center">' + bowl(pct, t("p_week")) + '<p style="margin-top:6px"><b>' + t("min_of", { a: got, b: total }) + '</b></p><p class="small">' + t("p_week") + '</p><p class="small">' + t("p_lessons") + ": " + n + " · " + t("p_words") + ": " + wordsLine() + " · XP: " + P.xp + '</p></div><h3>' + t("p_can") + '</h3><div class="card">' + can + '</div><h3>' + t("p_badges") + '</h3><div class="card row" style="flex:none">' + bd + "</div>" + strengthsCard();
};

/* ---------- нет интернета и возврат после перерыва ---------- */
R.offline = () => band() + '<div class="center"><svg viewBox="0 0 64 64" width="84" height="84" aria-hidden="true"><path d="M8 24c14-12 34-12 48 0M16 33c10-8 22-8 32 0M25 42c5-4 9-4 14 0" fill="none" stroke="#14302E" stroke-width="4" stroke-linecap="round"/><circle cx="32" cy="52" r="4" fill="#14302E"/><path d="M10 10l44 44" stroke="#B3224B" stroke-width="4" stroke-linecap="round"/></svg><h1 style="margin-top:6px">' + t("off_title") + "</h1></div><p>" + t("off_text") + '</p><div class="card">' + ["off_l1", "off_l2", "off_l3"].map(k => '<div class="li"><span class="tick on">' + IC.check + '</span><span class="grow">' + t(k) + "</span></div>").join("") + '</div><div class="grow"></div><button class="btn" data-act="tohome">' + t("off_btn") + "</button>";
R.back = () => {
  const n = app.st.gap || 3, due = dueList(S.srs, today()).length, P = S.progress, nid = nextLessonId();
  const got = weekMinutes(P.minutes, today()), total = weekGoal(S.settings.dailyMin);
  return band() + '<div class="center"><h1>' + t("bk_title") + "</h1>" + bowl(Math.max(8, Math.round(got / total * 100)), t("bk_title")) + '<p class="sub" style="margin-top:8px">' + t("bk_text_n", { n }) + '</p><p style="margin-top:6px"><b>' + t("bk_goal", { n: total }) + '</b></p></div><div class="grow"></div>' +
    (due ? '<button class="btn warm" data-act="revstart">' + t("bk_5") + "</button>" : "") + '<button class="btn' + (due ? " sec" : " warm") + '" data-act="' + (nid ? "startlesson" : "tohome") + '"' + (nid ? ' data-v="' + nid + '"' : "") + ">" + (nid ? t("bk_c") : t("to_home")) + "</button>";
};
