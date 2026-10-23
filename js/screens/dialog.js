import { app } from "../app.js";
import { S, save } from "../store.js";
import { t, ui, hint } from "../i18n.js";
import { C, setCurrent } from "../content.js";
import { esc, permIdx, plain } from "../util.js";
import { top, playIcon } from "../ui.js";
import { log } from "../analytics.js";
import * as audio from "../audio.js";
const R = app.R, ACT = app.ACT;
const sample = () => C.lesson.scenario.name_slot.sample;
const fill = s => String(s == null ? "" : s).split("{имя}").join(sample());
/* в таджикском переводе имя без знака ударения (0.3.4, аудит М8) */
const fillTg = s => String(s == null ? "" : s).split("{имя}").join(plain(sample()));
const showTg = o => S.settings.hintLang === "tg" && o && o.tg;
const turns = () => C.lesson.scenario.turns;
ACT.dlgstart = e => { if (e && e.dataset && e.dataset.v) setCurrent(e.dataset.v); const T = turns()[0]; app.st.dlg = { turn: 0, sel: null, done: false, hide: {}, hist: [{ ru: T.bot.ru, tg: T.bot.tg, me: false, aid: T.bot.audio_id }] }; app.go("dialog"); };
R.dialog = () => {
  const d = app.st.dlg, T = turns()[d.turn]; let chat = '<div class="chat" aria-live="polite">';
  d.hist.forEach(L => { chat += '<div class="bubble' + (L.me ? " me" : "") + '"><span lang="ru">' + esc(fill(L.ru)) + "</span>" + (showTg(L) ? '<span class="tr" lang="tg">' + esc(fillTg(L.tg)) + "</span>" : "") + '<button class="icon-btn" style="margin-top:4px" data-act="wsay" data-sp="' + (L.me ? "f" : "m") + '" data-v="' + esc(fill(L.ru)) + '" data-id="' + esc(L.aid || "") + '" aria-label="' + t("listen") + '">' + playIcon(14, "#14302E") + "</button></div>"; });
  chat += "</div>"; const h = top(esc(t("d_title_n", { n: ui(C.lesson.scenario.title) })));
  if (d.done) return h + chat + '<div class="card center"><h2>' + t("d_done") + '</h2><p class="sub">' + t("d_done_s") + '</p></div><button class="btn sec" data-act="dlgstart">' + t("d_again") + '</button><button class="btn" data-act="tohome">' + t("done") + "</button>";
  const hid = (d.hide || {})[d.turn] || [];
  if (d.sel === null) return h + chat + '<h3 style="margin-top:6px">' + (hid.length ? t("d_more") : t("d_pick")) + '</h3><div style="display:grid;gap:8px">' + permIdx(d, "p" + d.turn, T.options.length).filter(k => !hid.includes(k)).map(k => { const o = T.options[k]; return '<button class="choice" data-act="dpick" data-v="' + k + '">' + esc(fill(o.ru)) + (showTg(o) ? '<span class="tr" style="margin-left:6px">' + esc(fillTg(o.tg)) + "</span>" : "") + "</button>"; }).join("") + "</div>";
  const o = T.options[d.sel], good = o.q !== "wrong";
  return h + chat + '<div class="card" role="status" style="background:' + (good ? "var(--tint)" : "var(--warm)") + '"><b>' + (o.q === "best" ? t("d_good") : (o.q === "ok" ? t("d_ok") : t("d_soft"))) + '</b><span class="small" style="display:block;font-weight:400;margin-top:4px">' + esc(hint({ ru: o.fb_ru, tg: o.fb_tg })) + '</span></div><button class="btn" data-act="dnext2">' + t("next") + "</button>";
};
ACT.dpick = e => { const d = app.st.dlg, T = turns()[d.turn], o = T.options[+e.dataset.v]; if (d.sel !== null) return; d.sel = +e.dataset.v; d.hist.push({ ru: o.ru, tg: o.tg, me: true, aid: o.audio_id }); log("scenario_turn", { item: T.id, kind: o.q, ok: o.q !== "wrong" }); app.render(true); };
ACT.dnext2 = () => {
  const d = app.st.dlg, T = turns()[d.turn], o = T.options[d.sel];
  if (o.q === "wrong") { d.hist.pop(); d.sel = null; app.render(true); return; }
  /* «ok» — вежливо, но не ответ на реплику: реплика остаётся в чате, разговор продолжается только после подходящего ответа (иначе следующая реплика собеседника теряет смысл) */
  if (o.q === "ok") { d.hide = d.hide || {}; (d.hide[d.turn] = d.hide[d.turn] || []).push(d.sel); d.sel = null; app.render(true); app.scrollTop(true); return; }
  if (d.turn < turns().length - 1) { d.turn++; d.sel = null; const N = turns()[d.turn]; d.hist.push({ ru: N.bot.ru, tg: N.bot.tg, me: false, aid: N.bot.audio_id }); app.render(true); }
  else { d.done = true; S.badges.dialog = true; save(); app.render(true); }
  app.scrollTop(true);
};
