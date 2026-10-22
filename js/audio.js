import { S } from "./store.js";
import { C, audioBase } from "./content.js";
import { plain, norm } from "./util.js";
/* Воспроизведение: 1) файл озвучки + тайминги слов (результат make_audio.py); 2) запасной голос устройства;
   3) без звука (только подсветка по приблизительным таймингам). mode показывает, какой путь сработал. */
export const state = { mode: "none", el: null, timers: [], raf: 0, token: 0 };
export const speedGet = () => S.speed || 1;
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
function ttsSpeak(text, speed, sp) { try { if (typeof speechSynthesis === "undefined" || typeof SpeechSynthesisUtterance === "undefined") return false; const u = new SpeechSynthesisUtterance(plain(text)); u.lang = "ru-RU"; const v = pickVoice(voiceOf(sp)); if (v) u.voice = v; u.rate = 0.9 * speed; u.pitch = voiceOf(sp) === "m" && !(v && MALE.test(v.name)) ? 0.8 : 1; speechSynthesis.cancel(); speechSynthesis.speak(u); return true; } catch (e) { return false; } }
function estimateHighlight(words, speed, onWord, onEnd, token) {
  let acc = 0;
  words.forEach((w, i) => { state.timers.push(setTimeout(() => { if (token === state.token) onWord(i); }, acc)); acc += estDur(w, speed); });
  state.timers.push(setTimeout(() => { if (token === state.token) { onWord(-1); onEnd && onEnd(); } }, acc + 120));
}
/* набор файлов: <base>/<голос f|m>/<темп n|s>/<id>.<ext>; тайминги — C.timings["f_n"] и т.д.
   Медленный темп: сначала файл «s»; если его нет — обычный файл с замедлением плеера; если файлов нет вообще — голос телефона. */
function sources(base, ext, id, sp, speed) {
  const v = voiceOf(sp), n = { url: base + "/" + v + "/n/" + id + "." + ext, rate: speed < 0.9 ? speed : 1, set: v + "_n" };
  return speed < 0.9 ? [{ url: base + "/" + v + "/s/" + id + "." + ext, rate: 1, set: v + "_s" }, n] : [n];
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
      a.addEventListener("error", () => { if (token !== state.token || started) return; tryNext(); });
      a.play().catch(() => { if (token === state.token && !started) tryNext(); });
    };
    tryNext(); return;
  }
  fallback();
  function fallback() {
    if (token !== state.token) { return; }
    state.timers.forEach(clearTimeout); state.timers = [];
    const ok = ttsSpeak(o.text, speed, o.speaker); state.mode = ok ? "tts" : "silent";
    estimateHighlight(words, speed, i => o.onWord && o.onWord(i), o.onEnd, token);
  }
}
/* короткая фраза/слово без подсветки (id необязателен) */
export function playText(text, id, speaker) { playLine({ id, text, speaker, speed: S.speed || 1, onWord: null, onEnd: null }); }
