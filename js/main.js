import { app } from "./app.js";
import { S, load, save, today, now } from "./store.js";
import { loadI18n, t, lang, missing } from "./i18n.js";
import { loadAll, C } from "./content.js";
import { diffDays } from "./util.js";
import { log, logError } from "./analytics.js";
import * as audio from "./audio.js";
import { nav } from "./nav.js";
import "./screens/onboarding.js";
import "./screens/home.js";
import "./screens/lesson.js";
import "./screens/dialog.js";
import "./screens/settings.js";
import { sheetHtml } from "./screens/lesson.js";

const TABS = ["home", "words", "talk", "progress"];
const $ = s => document.querySelector(s);
const isTab = id => TABS.includes(id);
app.scrollTop = bottom => { const v = $("#view"); if (v) v.scrollTop = bottom ? v.scrollHeight : 0; };
app.toast = msg => { const old = $(".toast"); if (old) old.remove(); const d = document.createElement("div"); d.className = "toast"; d.setAttribute("role", "status"); d.textContent = msg; $("#phone").appendChild(d); setTimeout(() => d.remove(), 2400); };

app.render = keep => {
  audio.stop();
  const view = $("#view"), prev = keep ? view.scrollTop : 0, fn = app.R[app.cur];
  if (!fn) { app.cur = "home"; return app.render(false); }
  view.innerHTML = '<div class="scr" tabindex="-1" data-screen="' + app.cur + '">' + fn() + "</div>" + sheetHtml();
  view.scrollTop = prev;
  $("#navhost").innerHTML = isTab(app.cur) ? nav(app.cur) : "";
  const root = document.documentElement; root.lang = lang(); root.className = S.settings.large ? "large" : "";
  document.title = t("app");
};
app.go = (id, o) => {
  o = o || {}; app.st.sheet = null;
  if (!o.noPush && app.cur !== id) { if (isTab(id)) app.stack = []; else app.stack.push(app.cur); }
  app.cur = id; app.view = id; app.render(false); const v = $("#view"); v.scrollTop = 0;
  if (!o.keepFocus) { const s = v.querySelector(".scr"); if (s) s.focus({ preventScroll: true }); }
};
app.back = () => { const p = app.stack.pop(); if (p) { app.cur = p; app.st.sheet = null; app.render(false); const s = $("#view .scr"); if (s) s.focus({ preventScroll: true }); } else app.go("home", { noPush: true }); };

document.addEventListener("click", ev => {
  const a = ev.target.closest("[data-act]"), g = ev.target.closest("[data-go]"), b = ev.target.closest("[data-back]");
  if (a && app.ACT[a.dataset.act]) {
    if (a.dataset.act === "closesheet" && ev.target.closest("[data-stop]") && a.classList.contains("sheet-bg")) return;
    try { app.ACT[a.dataset.act](a); } catch (e) { logError(e && e.message); console.error(e); } return;
  }
  if (g) { app.st.rep = null; app.go(g.dataset.go); return; }
  if (b) { app.back(); }
});
document.addEventListener("change", ev => { const el = ev.target.closest("[data-act-change]"); if (el && app.ACT[el.dataset.actChange]) app.ACT[el.dataset.actChange](el); });
document.addEventListener("keydown", ev => { if (ev.key === "Escape" && app.st.sheet) { app.st.sheet = null; app.render(true); } });
window.addEventListener("error", e => logError(e.message));
window.addEventListener("unhandledrejection", e => logError(e.reason && e.reason.message));
window.addEventListener("online", () => { if (app.cur === "home") app.render(true); });
window.addEventListener("offline", () => { if (app.cur === "home") app.render(true); });
window.addEventListener("beforeinstallprompt", e => { e.preventDefault(); app.installPrompt = e; if (app.cur === "settings") app.render(true); });

async function boot() {
  load();
  try {
    const I = await loadI18n("data/i18n.json"); await loadAll();
    window.__app = app; window.__S = S; window.__missing = missing; window.__C = C;
    const td = today(), first = !S.onboarded;
    log("app_open");
    if (first) { app.cur = "lang"; }
    else {
      const gap = S.lastOpen ? diffDays(td, S.lastOpen) : 0;
      if (gap >= 3 && S.backShownOn !== td) { S.backShownOn = td; app.st.gap = gap; log("return_after_break"); app.cur = "back"; } else app.cur = "home";
    }
    S.lastOpen = td; save();
    app.render(false);
    document.body.classList.add("ready");
  } catch (e) {
    logError(e && e.message);
    $("#view").innerHTML = '<div class="scr"><h2>Ошибка загрузки / Хатои боргирӣ</h2><p>' + String(e && e.message).replace(/[<>&]/g, "") + '</p><button class="btn" onclick="location.reload()">OK</button></div>';
  }
  if ("serviceWorker" in navigator) { try { await navigator.serviceWorker.register("sw.js"); } catch (e) { /* офлайн-режим недоступен (например, не HTTPS) */ } }
}
boot();
