/* Переключатели функций (правило П-4, задача 8).
   Новая функция пишется и проверяется отдельно и остаётся выключенной, пока её выпуск не готов.
   CONFIG.FEATURES[id] = { ready, on }:
     ready:false          — функция в разработке: выключена у всех, включить нельзя;
     ready:true, on:false — готова к проверке: выключена, но её можно включить на экране «Пробные функции»;
     ready:true, on:true  — выпущена: включена у всех (на экране «Пробные функции» её можно выключить).
   Выбор на телефоне хранится в S.settings.flags и на другие телефоны не влияет. */
import { CONFIG } from "./config.js";
import { S, save } from "./store.js";

export const featureIds = (features = CONFIG.FEATURES) => Object.keys(features || {});
export const featureState = (id, features = CONFIG.FEATURES, flags = (S.settings && S.settings.flags) || {}) => {
  const f = features && features[id];
  if (!f) return { known: false, ready: false, on: false };
  const own = flags[id];
  return { known: true, ready: !!f.ready, on: !!f.ready && (typeof own === "boolean" ? own : !!f.on) };
};
export const flag = id => featureState(id).on;
export const setFlag = (id, v) => {
  if (!featureState(id).ready) return false;
  S.settings.flags = Object.assign({}, S.settings.flags, { [id]: !!v }); save(); return true;
};
/* Экран «Пробные функции» виден, если он включён в сборке или открыт на этом телефоне (5 нажатий на версию в «О приложении»). */
export const labOpen = () => !!(CONFIG.LAB_MENU || (S.settings && S.settings.lab));
export const LAB_TAPS = 5;
