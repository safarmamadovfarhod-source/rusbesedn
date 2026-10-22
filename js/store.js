import { CONFIG } from "./config.js";
import { dateStr } from "./util.js";
const KEY = "rs_state_v1";
const DEFAULT = () => ({
  v: 1,
  settings: { uiLang: null, hintLang: "tg", dailyMin: 15, rhythm: "daily", large: false, track: "a", theme: "c", level: null, voice: "f", tilt: "on", name: "" },
  onboarded: false, diag: null, diagB: null, order: {},
  progress: { lessons: {}, xp: 0, minutes: {}, days: [] },
  srs: {}, shadow: {}, badges: {}, events: [], errors: [], reports: [],
  lastOpen: null, backShownOn: null
});
let mem = null, storageOk = true;
export const S = DEFAULT();
export const now = () => (typeof window !== "undefined" && window.__now) ? window.__now() : Date.now();
export const today = () => dateStr(now());
function merge(dst, src) { for (const k in src) { if (src[k] && typeof src[k] === "object" && !Array.isArray(src[k]) && dst[k] && typeof dst[k] === "object" && !Array.isArray(dst[k])) merge(dst[k], src[k]); else dst[k] = src[k]; } return dst; }
export function load() {
  let raw = null;
  try { raw = localStorage.getItem(KEY); } catch (e) { storageOk = false; raw = mem; }
  if (raw) { try { const o = JSON.parse(raw); if (o && o.v === 1) merge(S, o); } catch (e) { /* повреждённые данные: начинаем заново */ } }
  return S;
}
export function save() {
  const s = JSON.stringify(S);
  try { localStorage.setItem(KEY, s); storageOk = true; } catch (e) { storageOk = false; mem = s; }
}
export const isPersistent = () => storageOk;
export function reset() { const d = DEFAULT(); for (const k of Object.keys(S)) delete S[k]; Object.assign(S, d); save(); }
export function exportJSON() { return JSON.stringify({ app: "rs", version: CONFIG.APP_VERSION, state: S }, null, 1); }
export function importJSON(text) {
  let o; try { o = JSON.parse(text); } catch (e) { return false; }
  const st = o && o.state; if (!st || st.v !== 1 || !st.settings || !st.progress) return false;
  const d = DEFAULT(); merge(d, st); for (const k of Object.keys(S)) delete S[k]; Object.assign(S, d); save(); return true;
}
