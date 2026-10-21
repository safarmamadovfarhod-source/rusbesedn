import { addDays } from "./util.js";
/* Интервальное повторение: коробки 1, 3, 7, 14 дней (допущение, уточняется в пилоте). */
export const INTERVALS = [1, 3, 7, 14];
export function addCard(srs, id, today, force) {
  if (srs[id] && !force) return false;
  srs[id] = { box: 0, due: addDays(today, 1), seen: 0 };
  return true;
}
export function review(srs, id, know, today) {
  const c = srs[id] || (srs[id] = { box: 0, due: today, seen: 0 });
  c.seen++;
  if (know) { c.box = Math.min(c.box + 1, INTERVALS.length); c.due = addDays(today, c.box >= INTERVALS.length ? 30 : INTERVALS[c.box]); }
  else { c.box = 0; c.due = addDays(today, 1); }
  return c;
}
export const dueList = (srs, today) => Object.keys(srs).filter(k => srs[k].due <= today).sort((a, b) => srs[a].due < srs[b].due ? -1 : srs[a].due > srs[b].due ? 1 : a < b ? -1 : 1);
export const learnedCount = srs => Object.values(srs).filter(c => c.box >= 2).length;
