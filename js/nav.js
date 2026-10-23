import { t } from "./i18n.js";
/* 0.3.8: значки меню по макету автора. Невыбранная вкладка — контур, выбранная — значок залит (класс f), светлая «таблетка», подпись цветом */
const S = p => '<svg viewBox="0 0 24 24">' + p + "</svg>";
const ICONS = {
  home: S('<path class="f" d="M3 11l9-7 9 7v9h-6v-6H9v6H3z"/>'),
  words: S('<rect x="3.5" y="3.5" width="12" height="13" rx="2" transform="rotate(-6 9.5 10)"/><rect class="f" x="8.5" y="7.5" width="12" height="13" rx="2" transform="rotate(6 14.5 14)"/>'),
  talk: S('<path d="M9 15v1.5h7l4 3v-11h-3"/><path class="f" d="M3 4h13v10H8l-5 4z"/>'),
  grammar: S('<rect class="f" x="3" y="3" width="18" height="18" rx="4"/><text x="12" y="16.3" text-anchor="middle">Аа</text>'),
  settings: S('<circle class="d" cx="5" cy="12" r="1.8"/><circle class="d" cx="12" cy="12" r="1.8"/><circle class="d" cx="19" cy="12" r="1.8"/>')
};
export function nav(cur) {
  const items = [["home", "n_home"], ["words", "n_words"], ["talk", "n_talk"], ["grammar", "n_gram"], ["settings", "n_more"]];
  return '<nav class="nav" aria-label="menu">' + items.map(x => '<button data-go="' + x[0] + '"' + (cur === x[0] ? ' aria-current="page"' : "") + "><i class=\"pill\" aria-hidden=\"true\">" + ICONS[x[0]] + "</i><span>" + t(x[1]) + "</span></button>").join("") + "</nav>";
}
