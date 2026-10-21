import { S, save, now } from "./store.js";
import { CONFIG } from "./config.js";
/* События без персональных данных и без голоса; только локально (D-33). Разрешены только эти поля. */
const ALLOWED = ["lesson", "step", "ok", "level", "score", "n", "kind", "lang", "rate", "mode", "item"];
export function log(name, props) {
  const p = {}; if (props) for (const k of ALLOWED) if (props[k] !== undefined) p[k] = props[k];
  S.events.push({ e: name, t: now(), p });
  if (S.events.length > CONFIG.EVENTS_MAX) S.events.splice(0, S.events.length - CONFIG.EVENTS_MAX);
  save();
}
export function counts() { const c = {}; for (const ev of S.events) c[ev.e] = (c[ev.e] || 0) + 1; return c; }
export function logError(msg) { S.errors.push({ t: now(), m: String(msg).slice(0, 200) }); if (S.errors.length > CONFIG.ERRORS_MAX) S.errors.shift(); save(); }
