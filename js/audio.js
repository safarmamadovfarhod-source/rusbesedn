import { S } from "./store.js";
import { C, audioBase, audioVer } from "./content.js";
import { plain, norm } from "./util.js";
/* Воспроизведение: 1) файл озвучки + тайминги слов (результат make_audio.py); 2) запасной голос устройства;
   3) без звука (только подсветка по приблизительным таймингам). mode показывает, какой путь сработал. */
export const state = { mode: "none", el: null, timers: [], raf: 0, token: 0 };
export const speedGet = () => S.speed || 1;
/* 0.3.9: голос телефона не заговорил (нет русского голоса или синтеза) → подсказка на экране урока, не только в «Звуках» */
export const voice = { missing: false, onMissing: null };
function flagMissing() { if (voice.missing) return; voice.missing = true; try { voice.onMissing && voice.onMissing(); } catch (e) { } }
export const noVoiceHtml = text => '<div class="card novoice" role="status" style="background:var(--warm)"><p class="small" style="margin:0">' + text + "</p></div>";
export function stop() {
  state.token++; state.timers.forEach(clearTimeout); state.timers = []; cancelAnimationFrame(state.raf);
  if (state.el) { try { state.el.pause(); } catch (e) { } state.el = null; }
  try { if (typeof speechSynthesis !== "undefined") speechSynthesis.cancel(); } catch (e) { }
}
const estDur = (w, speed) => (170 + 70 * norm(w).length) / speed;
/* голос телефона: пытаемся подобрать мужской/женский по имени голоса (на разных телефонах имена разные: это не гарантия) */
const MALE = /pavel|yuri|yuriy|dmitri|dmitry|maxim|aleksandr|alexander|ivan|male|муж|павел|юрий|дмитрий|максим/i, FEMALE = /milena|katya|ekaterina|irina|svetlana|anna|elena|olga|tatyana|female|жен|милена|катя|ирина|светлана|анна/i;
export function pickVoice(gender) {
  try {
    const vs = (speechSynthesis.getVoices() || []).filter(v => /^ru/i.test(v.lang)); if (!vs.length) return null;
    const re = gender === "m" ? MALE : FEMALE, other = gender === "m" ? FEMALE : MALE;
    return vs.find(v => re.test(v.name)) || vs.find(v => !other.test(v.name)) || vs[0];
  } catch (e) { return null; }
}
const voiceOf = sp => (sp === "f" || sp === "m") ? sp : (S.settings.voice === "m" ? "m" : "f");
function ttsSpeak(text, speed, sp) { try { if (typeof speechSynthesis === "undefined" || typeof SpeechSynthesisUtterance === "undefined") return false; const u = new SpeechSynthesisUtterance(plain(text)); u.lang = "ru-RU"; const v = pickVoice(voiceOf(sp)); if (v) u.voice = v; u.rate = 0.9 * speed; u.pitch = voiceOf(sp) === "m" && !(v && MALE.test(v.name)) ? 0.8 : 1;
    /* не заговорил за 3 с, ошибка синтеза или в списке голосов нет русского → считаем, что звука нет */
    let started = false; const tk = state.token; u.onstart = u.onend = () => { started = true; };
    u.onerror = ev => { if (ev && (ev.error === "interrupted" || ev.error === "canceled")) return; flagMissing(); };
    try { const all = speechSynthesis.getVoices() || []; if (all.length && !all.some(x => /^ru/i.test(x.lang))) flagMissing(); } catch (e) { }
    speechSynthesis.cancel(); speechSynthesis.speak(u); setTimeout(() => { if (!started && tk === state.token) flagMissing(); }, 3000); return true; } catch (e) { return false; } }
function estimateHighlight(words, speed, onWord, onEnd, token) {
  let acc = 0;
  words.forEach((w, i) => { state.timers.push(setTimeout(() => { if (token === state.token) onWord(i); }, acc)); acc += estDur(w, speed); });
  state.timers.push(setTimeout(() => { if (token === state.token) { onWord(-1); onEnd && onEnd(); } }, acc + 120));
}
/* набор файлов: <base>/<голос f|m>/<темп n|s>/<id>.<ext>; тайминги — C.timings["f_n"] и т.д.
   Медленный темп: сначала файл «s»; если его нет — обычный файл с замедлением плеера; если файлов нет вообще — голос телефона. */
function sources(base, ext, id, sp, speed) {
  const v = voiceOf(sp), q = audioVer(), n = { url: base + "/" + v + "/n/" + id + "." + ext + q, rate: speed < 0.9 ? speed : 1, set: v + "_n" };
  return speed < 0.9 ? [{ url: base + "/" + v + "/s/" + id + "." + ext + q, rate: 1, set: v + "_s" }, n] : [n];
}
/* playLine({id, text, speaker, speed, onWord(i|-1), onEnd}); speaker: "f" | "m" | не задан (голос из настроек) */
export function playLine(o) {
  stop(); const token = state.token, speed = o.speed || 1, words = plain(o.text).split(/\s+/).filter(Boolean);
  const base = audioBase();
  if (base && o.id) {
    const list = sources(base, C.lessonMeta.audio.ext, o.id, o.speaker, speed); let k = 0;
    const tryNext = () => {
      if (token !== state.token) return;
      if (k >= list.length) { fallback(); return; }
      const src = list[k++], tm = C.timings && C.timings[src.set] && C.timings[src.set][o.id], a = new Audio(src.url); a.playbackRate = src.rate; state.el = a; let started = false;
      const tick = () => {
        if (token !== state.token) return;
        if (tm) { const ct = a.currentTime; let idx = -1; for (let i = 0; i < tm.words.length; i++) if (ct >= tm.words[i].start && ct < tm.words[i].end) { idx = i; break; } o.onWord && o.onWord(idx); }
        state.raf = requestAnimationFrame(tick);
      };
      a.addEventListener("playing", () => { started = true; state.mode = "file"; state.src = src.url; tick(); });
      a.addEventListener("ended", () => { if (token !== state.token) return; cancelAnimationFrame(state.raf); o.onWord && o.onWord(-1); o.onEnd && o.onEnd(); });
      /* 0.4.6: отказ файла приходит дважды (событие error и отказ play()). Переходим к следующему источнику один раз,
         иначе без интернета в медленном темпе звучали сразу и файл, и голос телефона. */
      let failed = false; const fail = () => { if (failed || started || token !== state.token) return; failed = true; tryNext(); };
      a.addEventListener("error", fail);
      a.play().catch(fail);
    };
    tryNext(); return;
  }
  fallback();
  function fallback() {
    if (token !== state.token) { return; }
    state.timers.forEach(clearTimeout); state.timers = [];
    const ok = ttsSpeak(o.text, speed, o.speaker); state.mode = ok ? "tts" : "silent"; if (!ok) flagMissing();
    estimateHighlight(words, speed, i => o.onWord && o.onWord(i), o.onEnd, token);
  }
}
/* короткая фраза/слово без подсветки (id необязателен) */
/* 0.4.7: если у слова задан пример для озвучки (C.say), голос телефона и подсветка берут его текст */
export function playText(text, id, speaker) { playLine({ id, text: (id && C.say && C.say[id]) || text, speaker, speed: S.speed || 1, onWord: null, onEnd: null }); }
