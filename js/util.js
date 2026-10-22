export const ACUTE = "́";
export const plain = s => String(s == null ? "" : s).replace(/́/g, "");
/* сравнение слов: без ударения, регистра, знаков; ё = е */
export const norm = s => plain(s).toLowerCase().replace(/ё/g, "е").replace(/[^a-zа-яғӣқӯҳҷ]/g, "");
export const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export function shuffle(a, seed) {
  const r = a.slice(); let s = seed || 1;
  for (let i = r.length - 1; i > 0; i--) { s = (s * 9301 + 49297) % 233280; const j = Math.floor(s / 233280 * (i + 1)); const x = r[i]; r[i] = r[j]; r[j] = x; }
  return r;
}
/* даты как строки YYYY-MM-DD в локальном времени */
export const pad = n => (n < 10 ? "0" : "") + n;
export function dateStr(ms) { const d = new Date(ms); return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
export function addDays(ds, n) { const [y, m, d] = ds.split("-").map(Number); const t = new Date(Date.UTC(y, m - 1, d + n)); return t.getUTCFullYear() + "-" + pad(t.getUTCMonth() + 1) + "-" + pad(t.getUTCDate()); }
export function diffDays(a, b) { const f = s => { const [y, m, d] = s.split("-").map(Number); return Date.UTC(y, m - 1, d); }; return Math.round((f(a) - f(b)) / 86400000); }
export function weekStart(ds) { const [y, m, d] = ds.split("-").map(Number); const dow = (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7; return addDays(ds, -dow); }

/* случайный порядок (Math.random), запоминается в объекте состояния st под ключом key: порядок не меняется при перерисовке экрана.
   avoid — порядок, который нельзя выдавать (например, готовый правильный ответ). */
export function permOf(st, key, arr, avoid) {
  if (st[key]) return st[key].map(i => arr[i]);
  const n = arr.length; let p;
  for (let tries = 0; tries < 20; tries++) {
    p = [...Array(n).keys()];
    for (let i = n - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const x = p[i]; p[i] = p[j]; p[j] = x; }
    if (!avoid || n < 2 || p.map(i => arr[i]).join("\u0001") !== avoid.join("\u0001")) break;
  }
  st[key] = p; return p.map(i => arr[i]);
}
export const permIdx = (st, key, n) => permOf(st, key, [...Array(n).keys()]);
