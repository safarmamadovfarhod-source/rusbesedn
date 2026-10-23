/* Простые оригинальные иллюстрации (SVG, стиль «Пиёла»): без флагов, брендов и национальной одежды. */
const S = (inner) => '<svg viewBox="0 0 120 90" width="100%" height="100%" aria-hidden="true">' + inner + '</svg>';
const person = (x, face) => '<circle cx="' + x + '" cy="30" r="12" fill="#fff" stroke="#14302E" stroke-width="3"/><path d="M' + (x - 16) + ' 74Q' + x + ' 42 ' + (x + 16) + ' 74Z" style="fill:var(--primary)" stroke="#14302E" stroke-width="3" stroke-linejoin="round"/>' + face;
const smile = x => '<path d="M' + (x - 6) + ' 32Q' + x + ' 38 ' + (x + 6) + ' 32" fill="none" stroke="#14302E" stroke-width="2.5" stroke-linecap="round"/><circle cx="' + (x - 4) + '" cy="27" r="1.8" fill="#14302E"/><circle cx="' + (x + 4) + '" cy="27" r="1.8" fill="#14302E"/>';
export const PICS = {
  p1: S(person(36, smile(36)) + person(84, smile(84)) + '<path d="M50 52L62 36" stroke="#14302E" stroke-width="3" stroke-linecap="round"/><path d="M58 30l4 6 6-4" fill="none" stroke="#B3224B" stroke-width="3" stroke-linecap="round"/>'),
  /* «спасибо» (0.3.4, аудит В3): рука у груди и пиала чая — без сердечка, чтобы не путать с «приятно» */
  p2: S(person(44, smile(44)) + '<path d="M30 64Q40 54 47 57" fill="none" stroke="#14302E" stroke-width="3" stroke-linecap="round"/><circle cx="48" cy="57" r="4.5" fill="#fff" stroke="#14302E" stroke-width="2.5"/><path d="M76 56h30q-2 15-15 15t-15-15z" fill="#fff" stroke="#14302E" stroke-width="3" stroke-linejoin="round"/><path d="M79 61h24" style="stroke:var(--primary)" stroke-width="3"/><path d="M84 76h14" stroke="#14302E" stroke-width="3" stroke-linecap="round"/><path d="M86 49q-4-5 0-10M95 49q-4-5 0-10" fill="none" style="stroke:var(--steam)" stroke-width="2.5" stroke-linecap="round"/>'),
  p3: S('<rect x="20" y="42" width="20" height="36" rx="5" style="fill:var(--primary)" stroke="#14302E" stroke-width="3"/><path d="M46 46L58 20c5-6 14-1 11 9l-4 11h23c6 0 10 5 8 11l-5 20c-1 5-5 8-10 8H46z" fill="#fff" stroke="#14302E" stroke-width="3" stroke-linejoin="round"/><path d="M52 56h30M52 66h26" stroke="#14302E" stroke-width="2.5" stroke-linecap="round" opacity=".35"/>'),
  p4: S(person(36, smile(36)) + person(84, smile(84)) + '<path d="M52 58H68" stroke="#14302E" stroke-width="4" stroke-linecap="round"/><path d="M60 22c-6-8-14 2-6 8l6 5 6-5c8-6 0-16-6-8z" fill="#B3224B" stroke="#14302E" stroke-width="2"/>'),
  p5: S(person(60, '<circle cx="56" cy="27" r="1.8" fill="#14302E"/><circle cx="64" cy="27" r="1.8" fill="#14302E"/><path d="M55 35h10" stroke="#14302E" stroke-width="2.5" stroke-linecap="round"/>') + '<path d="M82 24c0-10 16-10 16 0 0 7-8 6-8 14" fill="none" stroke="#B3224B" stroke-width="5" stroke-linecap="round"/><circle cx="90" cy="46" r="3.2" fill="#B3224B"/>')
};

/* Значок слова: картинка (WebP в img/) для слов, которые можно нарисовать; для остальных — буква на плитке (свой знак, не эмодзи). */
const WORD_IMG = {
  w01: "ic01", w10: "ic02", w11: "ic03", w05: "ic04",
  b_01_w01: "ic05", b_01_w02: "ic06", b_01_w03: "ic07", b_01_w04: "ic08", b_01_w05: "ic09", b_01_w06: "ic09", b_01_w07: "ic10", b_01_w08: "ic11", b_01_w11: "ic24", b_01_w12: "ic19", b_01_w13: "ic19",
  b_02_w11: "ic22", b_02_w12: "ic22", b_02_w13: "ic21", b_02_w14: "ic12",
  b_03_w01: "ic18", b_03_w02: "ic05", b_03_w03: "ic13", b_03_w04: "ic13", b_03_w05: "ic14", b_03_w06: "ic14", b_03_w07: "ic15", b_03_w08: "ic15", b_03_w09: "ic23", b_03_w10: "ic22", b_03_w11: "ic16", b_03_w12: "ic17", b_03_w13: "ic20", b_03_w14: "ic16"
};
export const wordImgSrc = w => { const k = w && WORD_IMG[w.id]; return k ? "img/" + k + ".webp" : null; };
export const MASCOT = { hi: "m01", wave: "m02", up: "m03", think: "m04", win: "m05", sleep: "m06" };
export const mascotImg = (pose, size, alt) => '<img class="mascot-img" src="img/' + MASCOT[pose || "hi"] + '.webp" width="' + (size || 96) + '" height="' + (size || 96) + '" alt="' + (alt || "") + '"' + (alt ? "" : ' aria-hidden="true"') + ' decoding="async">';
export const letterTile = w => {
  const ch = w && w.ru ? String(w.ru).replace(/\u0301/g, "").trim().charAt(0).toUpperCase() : "?";
  return '<svg viewBox="0 0 64 64" width="100%" height="100%" aria-hidden="true"><rect x="6" y="6" width="52" height="52" rx="14" fill="#fff" style="stroke:var(--primary)" stroke-width="3"/><text x="32" y="43" text-anchor="middle" font-size="30" font-weight="700" style="fill:var(--primary)" font-family="RS Sans, PT Sans, sans-serif">' + ch + "</text></svg>";
};
/* 0.3.8: портреты героев (f — Шарора, m — Манучехр) */
export const avatar = (sp, size) => '<img class="ava" src="img/' + (sp === "f" ? "sharora" : "manuchehr") + '.webp" width="' + (size || 36) + '" height="' + (size || 36) + '" alt="" aria-hidden="true">';
export function wordIcon(w) {
  const src = wordImgSrc(w);
  if (src) return '<img src="' + src + '" alt="" aria-hidden="true" style="width:100%;height:100%;object-fit:contain" decoding="async">';
  return letterTile(w);
}
