import { S } from "./store.js";
let DICT = { ru: {}, tg: {} };
export const missing = [];
export async function loadI18n(url) { const r = await fetch(url); DICT = await r.json(); return DICT; }
export function setDict(d) { DICT = d; }
export const lang = () => S.settings.uiLang || "ru";
export function t(k, vars) {
  let s = DICT[lang()] && DICT[lang()][k];
  if (s === undefined) s = DICT.ru && DICT.ru[k];
  if (s === undefined) { if (!missing.includes(k)) missing.push(k); return k; }
  if (vars) for (const x in vars) s = s.split("{" + x + "}").join(vars[x]);
  return s;
}
/* текст подсказки на выбранном языке подсказок: object {ru,tg} */
export const hint = o => (S.settings.hintLang === "tg" ? (o.tg || o.ru) : (o.ru || o.tg));
export const ui = o => (lang() === "tg" ? (o.tg || o.ru) : (o.ru || o.tg));
