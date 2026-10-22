import { t } from "./i18n.js";
import { IC } from "./ui.js";
export function nav(cur) {
  const items = [["home", "n_home", IC.home], ["words", "n_words", IC.book], ["talk", "n_talk", IC.chat], ["settings", "n_more", IC.more]];
  return '<nav class="nav" aria-label="menu">' + items.map(x => '<button data-go="' + x[0] + '"' + (cur === x[0] ? ' aria-current="page"' : "") + ">" + x[2] + "<span>" + t(x[1]) + "</span></button>").join("") + "</nav>";
}
