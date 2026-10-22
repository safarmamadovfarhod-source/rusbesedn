/* Простые оригинальные иллюстрации (SVG, стиль «Пиёла»): без флагов, брендов и национальной одежды. */
const S = (inner) => '<svg viewBox="0 0 120 90" width="100%" height="100%" aria-hidden="true">' + inner + '</svg>';
const person = (x, face) => '<circle cx="' + x + '" cy="30" r="12" fill="#fff" stroke="#14302E" stroke-width="3"/><path d="M' + (x - 16) + ' 74Q' + x + ' 42 ' + (x + 16) + ' 74Z" fill="#0D7C76" stroke="#14302E" stroke-width="3" stroke-linejoin="round"/>' + face;
const smile = x => '<path d="M' + (x - 6) + ' 32Q' + x + ' 38 ' + (x + 6) + ' 32" fill="none" stroke="#14302E" stroke-width="2.5" stroke-linecap="round"/><circle cx="' + (x - 4) + '" cy="27" r="1.8" fill="#14302E"/><circle cx="' + (x + 4) + '" cy="27" r="1.8" fill="#14302E"/>';
export const PICS = {
  p1: S(person(36, smile(36)) + person(84, smile(84)) + '<path d="M50 52L62 36" stroke="#14302E" stroke-width="3" stroke-linecap="round"/><path d="M58 30l4 6 6-4" fill="none" stroke="#B3224B" stroke-width="3" stroke-linecap="round"/>'),
  p2: S(person(50, smile(50)) + '<path d="M44 58h12" stroke="#14302E" stroke-width="3" stroke-linecap="round"/><path d="M92 36c-5-9-17 0-8 9l8 8 8-8c9-9-3-18-8-9z" fill="#B3224B" stroke="#14302E" stroke-width="2.5" stroke-linejoin="round"/><path d="M66 50l14-4" stroke="#14302E" stroke-width="3" stroke-linecap="round"/>'),
  p3: S('<rect x="20" y="42" width="20" height="36" rx="5" fill="#0D7C76" stroke="#14302E" stroke-width="3"/><path d="M46 46L58 20c5-6 14-1 11 9l-4 11h23c6 0 10 5 8 11l-5 20c-1 5-5 8-10 8H46z" fill="#fff" stroke="#14302E" stroke-width="3" stroke-linejoin="round"/><path d="M52 56h30M52 66h26" stroke="#14302E" stroke-width="2.5" stroke-linecap="round" opacity=".35"/>'),
  p4: S(person(36, smile(36)) + person(84, smile(84)) + '<path d="M52 58H68" stroke="#14302E" stroke-width="4" stroke-linecap="round"/><path d="M60 22c-6-8-14 2-6 8l6 5 6-5c8-6 0-16-6-8z" fill="#B3224B" stroke="#14302E" stroke-width="2"/>'),
  p5: S(person(60, '<circle cx="56" cy="27" r="1.8" fill="#14302E"/><circle cx="64" cy="27" r="1.8" fill="#14302E"/><path d="M55 35h10" stroke="#14302E" stroke-width="2.5" stroke-linecap="round"/>') + '<path d="M82 24c0-10 16-10 16 0 0 7-8 6-8 14" fill="none" stroke="#B3224B" stroke-width="5" stroke-linecap="round"/><circle cx="90" cy="46" r="3.2" fill="#B3224B"/>')
};

/* Значок слова для окна слова: для слов, которые можно нарисовать, — рисунок; для остальных — буква на плитке (свой знак, не эмодзи). */
const WORD_PIC = { w01: "p1", w10: "p2", w11: "p3", w05: "p4", w08: "p5" };
export function wordIcon(w) {
  const k = w && WORD_PIC[w.id];
  if (k && PICS[k]) return PICS[k];
  const ch = w && w.ru ? String(w.ru).replace(/\u0301/g, "").trim().charAt(0).toUpperCase() : "?";
  return '<svg viewBox="0 0 64 64" width="100%" height="100%" aria-hidden="true"><rect x="6" y="6" width="52" height="52" rx="14" fill="#fff" stroke="#0D7C76" stroke-width="3"/><text x="32" y="43" text-anchor="middle" font-size="30" font-weight="700" fill="#0D7C76" font-family="PT Sans, sans-serif">' + ch + "</text></svg>";
}
