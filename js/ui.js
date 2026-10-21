import { t } from "./i18n.js";
import { esc } from "./util.js";
export const IC = {
  home: '<svg viewBox="0 0 24 24"><path d="M3 11l9-7 9 7v9H3z"/></svg>',
  book: '<svg viewBox="0 0 24 24"><path d="M5 4h11a3 3 0 013 3v13H8a3 3 0 01-3-3z"/><path d="M5 17a3 3 0 013-3h11"/></svg>',
  chat: '<svg viewBox="0 0 24 24"><path d="M4 5h16v11H9l-5 4z"/></svg>',
  chart: '<svg viewBox="0 0 24 24"><path d="M4 20V10M10 20V4M16 20v-8M22 20H2"/></svg>',
  gear: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/></svg>',
  back: '<svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg>',
  play: '<svg viewBox="0 0 24 24"><path d="M7 4l13 8-13 8z"/></svg>',
  check: '<svg viewBox="0 0 24 24"><path d="M4 12l5 5L20 6"/></svg>'
};
export const playIcon = (sz, fill) => IC.play.replace("<svg", '<svg style="width:' + (sz || 18) + "px;height:" + (sz || 18) + "px;fill:" + (fill || "currentColor") + ';stroke:none"');
let uid = 0;
export function star(fill, stroke, sw) { return '<svg viewBox="0 0 36 36" aria-hidden="true"><polygon points="18,2 22,10 30,6 26,14 34,18 26,22 30,30 22,26 18,34 14,26 6,30 10,22 2,18 10,14 6,6 14,10" fill="' + fill + '" stroke="' + stroke + '" stroke-width="' + sw + '"/></svg>'; }
export function bowl(pct, label) {
  const id = "bc" + (++uid), y = 116 - Math.round(Math.max(0, Math.min(100, pct)) / 100 * 58);
  return '<svg class="bowl" viewBox="0 0 200 128" role="img" aria-label="' + esc(label) + '"><defs><clipPath id="' + id + '"><path d="M14 38H186C186 90 152 116 100 116C48 116 14 90 14 38Z"/></clipPath></defs>' +
    '<g fill="none" stroke="#7DC6C0" stroke-width="4" stroke-linecap="round"><path d="M72 30C64 22 80 16 72 6"/><path d="M100 30C92 22 108 16 100 6"/><path d="M128 30C120 22 136 16 128 6"/></g>' +
    '<path d="M14 38H186C186 90 152 116 100 116C48 116 14 90 14 38Z" fill="#fff"/>' +
    '<g clip-path="url(#' + id + ')"><rect x="0" y="' + (y - 38) + '" width="200" height="' + (130 - y + 38) + '" fill="#E3A33B" transform="translate(0,38)"/><path d="M0 ' + y + 'Q25 ' + (y - 6) + ' 50 ' + y + 'T100 ' + y + 'T150 ' + y + 'T200 ' + y + '" fill="none" stroke="#B87A1A" stroke-width="3"/></g>' +
    '<path d="M14 38H186C186 90 152 116 100 116C48 116 14 90 14 38Z" fill="none" stroke="#14302E" stroke-width="4" stroke-linejoin="round"/>' +
    '<circle cx="76" cy="58" r="5" fill="#14302E"/><circle cx="124" cy="58" r="5" fill="#14302E"/><path d="M88 66Q100 76 112 66" fill="none" stroke="#14302E" stroke-width="3.5" stroke-linecap="round"/></svg>';
}
export function band() { const id = "tl" + (++uid); return '<div class="band"><svg aria-hidden="true" preserveAspectRatio="xMidYMid slice"><defs><pattern id="' + id + '" width="40" height="40" patternUnits="userSpaceOnUse"><polygon points="20,4 24,14 34,10 30,20 36,24 26,26 28,36 20,30 12,36 14,26 4,24 10,20 6,10 16,14" fill="none" stroke="#7DC6C0" stroke-width="1.4" opacity=".7"/></pattern></defs><rect width="100%" height="100%" fill="url(#' + id + ')"/></svg></div>'; }
export function top(title, opts) {
  opts = opts || {};
  return '<div class="top">' + (opts.back === false ? "" : '<button class="icon-btn" data-back aria-label="' + esc(t("back")) + '">' + IC.back + "</button>") + '<div class="ttl">' + title + "</div>" + (opts.right || "") + "</div>";
}
export const steps = (n, i) => '<div class="steps" aria-hidden="true">' + Array.from({ length: n }, (_, k) => "<i" + (k <= i ? ' class="on"' : "") + "></i>").join("") + "</div>";
export const fbCard = (ok, text) => '<div class="card" role="status" style="background:' + (ok ? "#E4F3F1" : "#FFF5E2") + '"><b>' + text + "</b></div>";
