import { addDays, weekStart } from "./util.js";
/* Мягкая серия: дни подряд; один пропущенный день в неделю не обрывает серию (D-25). */
export function computeStreak(days, today) {
  const set = new Set(days); let d = today, n = 0; const paused = new Set();
  if (!set.has(d)) d = addDays(d, -1); /* сегодня ещё не закончился: не штрафуем */
  for (let guard = 0; guard < 4000; guard++) {
    if (set.has(d)) { n++; d = addDays(d, -1); continue; }
    const wk = weekStart(d);
    if (!paused.has(wk) && set.has(addDays(d, -1))) { paused.add(wk); d = addDays(d, -1); continue; }
    break;
  }
  return n;
}
export function weekMinutes(minutes, today) {
  const ws = weekStart(today); let s = 0;
  for (let i = 0; i < 7; i++) s += minutes[addDays(ws, i)] || 0;
  return Math.round(s);
}
export const weekGoal = dailyMin => dailyMin * 6; /* D-23: цель недели = минуты × 6 */
export const xpForLesson = (correct, total) => 10 + 2 * correct;
/* Диагностика: доля верных из отвеченных → уровень плана (diag.json) */
export function diagLevel(score, n, levels) {
  if (!n) return 0;
  const r = score / n;
  for (const l of levels) if (r < l.max_ratio) return l.id;
  return levels[levels.length - 1].id;
}
