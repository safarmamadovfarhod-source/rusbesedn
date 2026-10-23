/* «Звуки» (0.3.5): сетка звуков русского языка, как в Duolingo, — буква, пример, полоска прогресса.
   Касание плитки — страница звука с примерами; «Начать» — тренировка на слух по парам слов (+10 очков).
   Звук — голос устройства (записей пока нет). Подсказки на таджикском — черновик для проверки носителем. */
import { app } from "../app.js";
import { S, save } from "../store.js";
import { t, ui } from "../i18n.js";
import { esc } from "../util.js";
import { top, IC, playIcon } from "../ui.js";
import { mascotImg } from "../pics.js";
import * as audio from "../audio.js";
import { log } from "../analytics.js";

const R = app.R, ACT = app.ACT;
const PAIR = { ru: "Пара: звонкий — глухой", tg: "Ҷуфт: бо овоз — бе овоз" };
/* [буква, примеры, подсказка] */
export const SOUNDS = {
  vow: [
    ["а", ["ма́ма", "да"], null],
    ["о", ["дом", "молоко́"], { ru: "Под ударением — «о», без ударения звучит как «а»: молоко́.", tg: "Бо зада — «о», бе зада ба «а» монанд: молоко́." }],
    ["у", ["у́тро", "суп"], { ru: "Как таджикское «у», не «ӯ».", tg: "Мисли «у»-и тоҷикӣ, на «ӯ»." }],
    ["э", ["э́то", "мэр"], null],
    ["ы", ["сыр", "мы"], { ru: "Как «и», но язык отодвинут назад. В таджикском такого звука нет.", tg: "Монанди «и», вале забонро ба қафо кашед. Дар тоҷикӣ чунин овоз нест." }],
    ["и", ["и́мя", "мир"], null],
    ["я", ["я́блоко", "моя́"], { ru: "В начале слова и после гласной — «йа».", tg: "Дар аввали калима ва баъди садонок — «йа»." }],
    ["ё", ["ёлка", "мёд"], { ru: "Всегда под ударением: «йо».", tg: "Ҳамеша зада дорад: «йо»." }],
    ["ю", ["юг", "люблю́"], null],
    ["е", ["есть", "нет"], null]
  ],
  cons: [
    ["б", ["брат", "ба́бушка"], PAIR], ["п", ["па́па", "суп"], PAIR],
    ["в", ["вода́", "вы"], PAIR], ["ф", ["фо́то", "ко́фе"], PAIR],
    ["г", ["го́род", "где"], { ru: "Как «г», не «ғ».", tg: "Мисли «г», на «ғ»." }], ["к", ["кот", "рука́"], { ru: "Как «к», не «қ».", tg: "Мисли «к», на «қ»." }],
    ["д", ["дом", "да"], PAIR], ["т", ["торт", "ты"], PAIR],
    ["ж", ["жена́", "журна́л"], PAIR], ["ш", ["шко́ла", "шар"], PAIR],
    ["з", ["зу́бы", "зима́"], PAIR], ["с", ["сок", "сын"], PAIR],
    ["л", ["ла́мпа", "стол"], null], ["м", ["мо́ре", "ма́ма"], null], ["н", ["нос", "но́чь"], null],
    ["р", ["ры́ба", "рука́"], { ru: "Дрожащий «р», как в таджикском.", tg: "«Р»-и ларзон, мисли тоҷикӣ." }],
    ["й", ["май", "мой"], null],
    ["х", ["хлеб", "хорошо́"], { ru: "Как таджикское «х», не «ҳ».", tg: "Мисли «х»-и тоҷикӣ, на «ҳ»." }],
    ["ц", ["цирк", "у́лица"], { ru: "«т» и «с» вместе и быстро. В таджикском такого звука нет.", tg: "«Т» ва «с» якҷоя ва тез. Дар тоҷикӣ чунин овоз нест." }],
    ["ч", ["чай", "врач"], { ru: "Всегда мягкий.", tg: "Ҳамеша нарм." }],
    ["щ", ["щётка", "борщ"], { ru: "Долгое мягкое «ш». В таджикском такого звука нет.", tg: "«Ш»-и дароз ва нарм. Дар тоҷикӣ чунин овоз нест." }]
  ],
  signs: [
    ["ь", ["брать", "мать"], { ru: "Не звук: делает согласный перед ним мягким. брат — брать.", tg: "Овоз нест: ҳамсадои пеш аз худро нарм мекунад. брат — брать." }],
    ["ъ", ["подъе́зд", "съесть"], { ru: "Не звук: короткая пауза перед я, е, ё, ю.", tg: "Овоз нест: пеш аз я, е, ё, ю таваққуфи кӯтоҳ." }]
  ]
};
/* пары слов для тренировки на слух: [слово 1, слово 2, буквы, которые тренируются] */
export const PAIRS = [
  ["был", "бил", "ыи"], ["мыл", "мил", "ыи"], ["брат", "брать", "ь"], ["мат", "мать", "ь"], ["у́гол", "у́голь", "ь"],
  ["дом", "том", "дт"], ["год", "кот", "гк"], ["зуб", "суп", "зс"], ["жар", "шар", "жш"], ["цвет", "свет", "цс"],
  ["пить", "бить", "пб"], ["ваш", "наш", "вн"], ["сок", "сук", "оу"], ["мэр", "мир", "эи"]
];
const ROUNDS = 8, MAXP = 5;
const plain = w => w.replace(/́/g, "");
const all = () => SOUNDS.vow.concat(SOUNDS.cons, SOUNDS.signs);
const find = l => all().find(x => x[0] === l);
const got = l => Math.min(MAXP, (S.sounds && S.sounds[l]) || 0);
const bump = (l, n) => { S.sounds = S.sounds || {}; S.sounds[l] = Math.min(MAXP, (S.sounds[l] || 0) + (n || 1)); };
/* что звучит по кнопке «Послушать» (0.3.6): гласная — сам звук; согласная — в слоге с «а»
   (голос телефона читает одну согласную как название буквы: «бэ», «эс»); ь и ъ — пара слов */
const VOW = "аоуэыияёюе", SIGN = { "ь": "брат — брать", "ъ": "сел — съел" };
export const soundOf = l => SIGN[l] || (VOW.includes(l) ? l : l === "й" ? "ай" : l + "а");
const say = w => { audio.playText(plain(w)); setTimeout(() => { if (audio.state.mode === "silent" && !app.st.noVoice) { app.st.noVoice = true; app.render(true); } }, 120); };

const tile = x => {
  const p = got(x[0]);
  return '<button class="sndtile" data-act="sndopen" data-v="' + x[0] + '" aria-label="' + esc(t("snd_tile", { l: x[0].toUpperCase() + x[0], w: plain(x[1][0]) })) + '"><b lang="ru">' + x[0].toUpperCase() + x[0] + '</b><span lang="ru">' + esc(x[1][0]) + '</span><i aria-hidden="true"><i style="width:' + Math.round(p / MAXP * 100) + '%"></i></i></button>';
};
const grid = (key, list) => "<h3>" + t(key) + '</h3><div class="sndgrid">' + list.map(tile).join("") + "</div>";
const noVoice = () => app.st.noVoice ? '<div class="card" role="status" style="background:var(--warm)"><p class="small" style="margin:0">' + t("snd_novoice") + "</p></div>" : "";

R.sounds = () => top(t("snd_title")) +
  '<div class="sndhead">' + mascotImg("wave", 84, "") + '<div><b style="font-size:1.15rem">' + t("snd_h") + '</b><p class="small" style="margin:4px 0 0">' + t("snd_s") + "</p></div></div>" +
  '<button class="btn" data-act="sndstart">' + t("snd_start") + "</button>" + noVoice() +
  grid("snd_vow", SOUNDS.vow) + grid("snd_cons", SOUNDS.cons) + grid("snd_signs", SOUNDS.signs);

/* страница одного звука */
R.sound = () => {
  const x = find(app.st.snd) || SOUNDS.vow[0], l = x[0];
  const ex = x[1].map((w, i) => '<button class="choice" data-act="sndsay" data-v="' + i + '"><span class="play" aria-hidden="true">' + IC.play + '</span><b lang="ru" style="font-size:1.3rem">' + esc(w) + "</b></button>").join("");
  return top(t("snd_title")) + '<div class="center"><div class="sndbig" lang="ru">' + l.toUpperCase() + l + '</div><button class="btn sec" data-act="sndletter" style="max-width:240px;margin:0 auto">' + playIcon(18, "var(--primary)") + " " + t("snd_listen") + '</button><p class="small" style="margin-top:6px">' + t("snd_heard") + ' <b lang="ru">«' + soundOf(l) + "»</b></p></div>" +
    (x[2] ? '<div class="card" style="margin-top:14px"><p style="margin:0">' + esc(ui(x[2])) + "</p></div>" : "") + noVoice() +
    "<h3>" + t("snd_ex") + '</h3><div style="display:grid;gap:8px">' + ex + "</div>" +
    '<p class="small" style="margin-top:12px">' + t("snd_prog", { a: got(l), b: MAXP }) + "</p>";
};
ACT.sndopen = e => { app.st.snd = e.dataset.v; app.go("sound"); say(soundOf(e.dataset.v)); };
ACT.sndsay = e => { const x = find(app.st.snd); if (!x) return; say(x[1][+e.dataset.v]); bump(x[0]); save(); };
ACT.sndletter = () => { const x = find(app.st.snd); if (!x) return; say(soundOf(x[0])); bump(x[0]); save(); };

/* тренировка на слух */
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
function newRound(sp) {
  const p = sp.pairs[sp.i], k = Math.random() < .5 ? 0 : 1;
  sp.word = p[k]; sp.opts = Math.random() < .5 ? [p[0], p[1]] : [p[1], p[0]]; sp.pick = null;
}
ACT.sndstart = () => {
  const sp = { pairs: shuffle(PAIRS.slice()).slice(0, ROUNDS), i: 0, ok: 0, done: false };
  newRound(sp); app.st.sp = sp; log("sounds_start"); app.go("sndpractice"); say(sp.word);
};
R.sndpractice = () => {
  const sp = app.st.sp; if (!sp) return R.sounds();
  if (sp.done) {
    return top(t("snd_title")) + '<div class="center" style="margin-top:12px">' + mascotImg("win", 140, "") + "<h2>" + t("snd_done") + '</h2><p><b>' + t("snd_res", { a: sp.ok, b: sp.pairs.length }) + '</b></p><span class="badge g">' + t("snd_xp") + "</span></div>" +
      '<button class="btn" data-act="sndstart" style="margin-top:16px">' + t("snd_more") + '</button><button class="btn sec" data-act="sndexit">' + t("snd_back") + "</button>";
  }
  const steps = '<div class="steps" aria-hidden="true">' + sp.pairs.map((_, k) => "<i" + (k < sp.i || (k === sp.i && sp.pick) ? ' class="on"' : "") + "></i>").join("") + "</div>";
  const opts = sp.opts.map(w => {
    let cls = "choice"; if (sp.pick) { if (w === sp.word) cls += " good right"; else if (w === sp.pick) cls += " soft"; }
    return '<button class="' + cls + '" data-act="sndpick" data-v="' + esc(w) + '"' + (sp.pick ? " disabled" : "") + ' style="justify-content:center"><b lang="ru" style="font-size:1.5rem">' + esc(w) + "</b></button>";
  }).join("");
  const fb = sp.pick ? '<div class="card" role="status" style="background:' + (sp.pick === sp.word ? "var(--tint)" : "var(--warm)") + '"><b>' + (sp.pick === sp.word ? t("snd_ok") : t("snd_bad", { w: sp.word })) + "</b></div>" +
    '<button class="btn" data-act="sndnext">' + t("next") + "</button>" : "";
  return top(t("snd_title")) + steps + "<h2>" + t("snd_q") + "</h2>" +
    '<button class="sndplay" data-act="sndagain" aria-label="' + t("snd_again") + '">' + playIcon(40, "#fff") + "</button>" + '<p class="center small">' + t("snd_again") + "</p>" + noVoice() +
    '<div style="display:grid;gap:10px">' + opts + "</div>" + fb;
};
ACT.sndagain = () => { const sp = app.st.sp; if (sp) say(sp.word); };
ACT.sndpick = e => {
  const sp = app.st.sp; if (!sp || sp.pick) return;
  sp.pick = e.dataset.v;
  if (sp.pick === sp.word) { sp.ok++; for (const l of sp.pairs[sp.i][2]) bump(l); save(); }
  app.render(true);
};
ACT.sndnext = () => {
  const sp = app.st.sp; if (!sp) return;
  sp.i++;
  if (sp.i >= sp.pairs.length) {
    sp.done = true; S.progress.xp = (S.progress.xp || 0) + 10; save(); log("sounds_done");
    app.render(false); return;
  }
  newRound(sp); app.render(false); say(sp.word); /* сначала экран, потом звук: перерисовка останавливает звук */
};
ACT.sndexit = () => { app.st.sp = null; app.back(); };
