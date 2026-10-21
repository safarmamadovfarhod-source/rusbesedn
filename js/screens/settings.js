import { app } from "../app.js";
import { S, save, reset, exportJSON, importJSON, isPersistent, today } from "../store.js";
import { t, ui, missing } from "../i18n.js";
import { C } from "../content.js";
import { esc } from "../util.js";
import { top, IC } from "../ui.js";
import { log, counts } from "../analytics.js";
import { buildReport, mailtoUrl } from "../report.js";
import { CONFIG } from "../config.js";
const R = app.R, ACT = app.ACT;

R.settings = () => {
  const mins = [5, 10, 15, 30, 60].map(m => '<button class="chip" data-act="setmin" data-v="' + m + '" aria-pressed="' + (S.settings.dailyMin === m) + '">' + m + "</button>").join("");
  const cnt = counts(), cl = Object.keys(cnt).sort().map(k => "<li>" + esc(k) + ": " + cnt[k] + "</li>").join("") || "<li>—</li>";
  const dev = ["lang", "goal", "start", "diag", "result", "skiptest", "back", "offline"].map(id => '<button class="chip" style="border-radius:12px;min-height:44px;font-size:.95rem" data-act="dev" data-v="' + id + '">' + id + "</button>").join("");
  const confirm = app.st.confirm ? '<div class="card" role="alertdialog" style="background:#FFF5E2"><b>' + t("reset_q") + '</b><div class="row" style="margin-top:8px"><button class="btn warm" data-act="resetyes">' + t("reset_yes") + '</button><button class="btn sec" data-act="resetno">' + t("cancel") + "</button></div></div>" : "";
  return top(t("set_title")) +
    "<h3>" + t("ui_lang") + '</h3><div class="seg"><button data-act="setlang" data-v="tg" aria-pressed="' + (S.settings.uiLang === "tg") + '" lang="tg">Тоҷикӣ</button><button data-act="setlang" data-v="ru" aria-pressed="' + (S.settings.uiLang === "ru") + '" lang="ru">Русский</button></div>' +
    "<h3>" + t("hint_lang") + '</h3><div class="seg"><button data-act="sethint" data-v="tg" aria-pressed="' + (S.settings.hintLang === "tg") + '">' + t("h_tg") + '</button><button data-act="sethint" data-v="ru" aria-pressed="' + (S.settings.hintLang === "ru") + '">' + t("h_ru") + "</button></div>" +
    "<h3>" + t("goal_day") + '</h3><div class="chips">' + mins + "</div>" +
    "<h3>" + t("text_size") + '</h3><div class="seg"><button data-act="setsize" data-v="0" aria-pressed="' + !S.settings.large + '">' + t("sz_n") + '</button><button data-act="setsize" data-v="1" aria-pressed="' + S.settings.large + '">' + t("sz_l") + "</button></div>" +
    "<h3>" + t("offline_h") + '</h3><div class="card"><div class="li"><span class="tick on">' + IC.check + '</span><span class="grow">' + t("off_l1") + '</span></div><p class="small">' + (isPersistent() ? t("store_ok") : t("store_bad")) + "</p></div>" +
    '<button class="btn sec" id="installbtn" data-act="install">' + t("install") + '</button><p class="small" id="installnote">' + t("install_help") + "</p>" +
    '<button class="btn sec" data-go="report">' + t("report") + "</button>" +
    "<h3>" + t("data_h") + '</h3><div class="row" style="flex-wrap:wrap"><button class="btn sec" data-act="export">' + t("export") + '</button><label class="btn sec" style="cursor:pointer">' + t("import") + '<input id="impfile" type="file" accept="application/json,.json" style="display:none" data-act-change="import"></label></div><p class="small">' + t("data_note") + "</p>" + confirm + '<button class="btn ghost" data-act="resetask">' + t("reset") + "</button>" +
    (!CONFIG.DEV_PANEL ? '<p class="small" style="margin-top:12px">' + t("ver") + ": " + CONFIG.APP_VERSION + "</p>" : '<details class="card"><summary><b>' + t("dev_h") + "</b></summary><p class=\"small\">" + t("dev_note") + "</p><ul class=\"small\">" + cl + '</ul><p class="small">' + t("ver") + ": " + CONFIG.APP_VERSION + '</p><div class="chips" style="margin-top:8px">' + dev + "</div></details>");
};
ACT.sethint = e => { S.settings.hintLang = e.dataset.v; save(); app.render(true); };
ACT.setsize = e => { S.settings.large = e.dataset.v === "1"; save(); app.render(true); };
ACT.install = async () => { const p = app.installPrompt; if (!p) { app.toast(t("install_help")); return; } p.prompt(); try { await p.userChoice; } catch (e) { } app.installPrompt = null; app.render(true); };
ACT.export = () => { const blob = new Blob([exportJSON()], { type: "application/json" }), a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "rs-progress-" + today() + ".json"; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500); };
ACT.import = async el => { const f = el.files && el.files[0]; if (!f) return; const txt = await f.text(); if (importJSON(txt)) { app.toast(t("import_ok")); app.stack = []; app.go("home", { noPush: true }); } else app.toast(t("import_bad")); };
ACT.resetask = () => { app.st.confirm = true; app.render(true); };
ACT.resetno = () => { app.st.confirm = false; app.render(true); };
ACT.resetyes = () => { app.st.confirm = false; reset(); app.stack = []; app.go("lang", { noPush: true }); };
ACT.dev = e => { const id = e.dataset.v; app.st.diag = { i: 0, score: 0, n: 0, fb: null, sel: null, built: [], typed: "" }; app.st.skip = { i: 0, score: 0, fb: null, sel: null, built: [], done: false }; app.stack = []; app.go(id, { noPush: true }); };

/* ---------- Сообщить о проблеме (D-26, D-32) ---------- */
R.report = () => {
  const r = app.st.rep || (app.st.rep = { kind: null, sent: false, logs: false, text: "" });
  if (r.sent) return top(t("rep_title")) + '<div class="card center"><h2>' + (CONFIG.REPORT_TO ? t("rep_thanks") : t("rep_copied")) + '</h2></div><p class="small">' + t("rep_after") + '</p><textarea readonly id="repout" aria-label="' + t("rep_title") + '">' + esc(r.out || "") + '</textarea><button class="btn" data-go="settings">' + t("done") + "</button>";
  const ks = ["rk1", "rk2", "rk3", "rk4"].map((k, i) => '<button class="choice" data-act="rk" data-v="' + i + '" aria-pressed="' + (r.kind === i) + '">' + t(k) + "</button>").join("");
  return top(t("rep_title")) + "<h3>" + t("rep_kind") + '</h3><div style="display:grid;gap:8px">' + ks + '</div><textarea id="reptext" placeholder="' + t("rep_ph") + '" aria-label="' + t("rep_ph") + '">' + esc(r.text) + '</textarea><button class="choice" data-act="replog" aria-pressed="' + r.logs + '">' + t("rep_logs") + '</button><p class="small">' + t("rep_auto") + '</p><p class="small">' + t("rep_info") + '</p><div class="grow"></div><button class="btn" data-act="repsend"' + (r.kind === null ? " disabled" : "") + ">" + (CONFIG.REPORT_TO ? t("send") : t("rep_copy")) + "</button>";
};
const keepText = () => { const el = document.getElementById("reptext"); if (el && app.st.rep) app.st.rep.text = el.value; };
ACT.rk = e => { keepText(); app.st.rep.kind = +e.dataset.v; app.render(true); };
ACT.replog = () => { keepText(); app.st.rep.logs = !app.st.rep.logs; app.render(true); };
ACT.repsend = async () => {
  keepText(); const r = app.st.rep; if (r.kind === null) return;
  const out = buildReport(t("rk" + (r.kind + 1)), r.text, r.logs); r.out = out; log("report_open", { kind: String(r.kind) });
  S.reports.push({ kind: r.kind, text: r.text, withLog: r.logs, sent: !!CONFIG.REPORT_TO, ts: today() }); save();
  if (CONFIG.REPORT_TO) { const url = mailtoUrl(CONFIG.REPORT_TO, "Русский собеседник: " + t("rk" + (r.kind + 1)), out); app.lastMailto = url; try { location.href = url; } catch (e) { } }
  else { try { await navigator.clipboard.writeText(out); } catch (e) { /* текст виден в поле для ручного копирования */ } }
  r.sent = true; app.render(false);
};
