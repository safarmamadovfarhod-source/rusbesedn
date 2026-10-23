import { t } from "./i18n.js";
import { IC } from "./ui.js";
const GR = '<svg viewBox="0 0 24 24"><path d="M3.5 18.5l4.5-13 4.5 13M5 14h6"/><path d="M15 8.5h5.5M15 12.5h5.5M15 16.5h4"/></svg>';
export function nav(cur) {
  const items = [["home", "n_home", IC.home], ["words", "n_words", IC.book], ["talk", "n_talk", IC.chat], ["grammar", "n_gram", GR], ["settings", "n_more", IC.more]];
  return '<nav class="nav" aria-label="menu">' + items.map(x => '<button data-go="' + x[0] + '"' + (cur === x[0] ? ' aria-current="page"' : "") + "><i class=\"pill\">" + x[2] + "</i><span>" + t(x[1]) + "</span></button>").join("") + "</nav>";
}
