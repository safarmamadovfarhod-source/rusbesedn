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
function ttsSpeak(text, speed) { try { if (typeof speechSynthesis === "undefined" || typeof SpeechSynthesisUtterance === "undefined") return false; const u = new SpeechSynthesisUtterance(plain(text)); u.lang = "ru-RU"; u.rate = 0.9 * speed; speechSynthesis.speak(u); return true; } catch (e) { return false; } }
function estimateHighlight(words, speed, onWord, onEnd, token) {
  let acc = 0;
  words.forEach((w, i) => { state.timers.push(setTimeout(() => { if (token === state.token) onWord(i); }, acc)); acc += estDur(w, speed); });
  state.timers.push(setTimeout(() => { if (token === state.token) { onWord(-1); onEnd && onEnd(); } }, acc + 120));
}
/* playLine({id, text, speed, onWord(i|-1), onEnd}) */
export function playLine(o) {
  stop(); const token = state.token, speed = o.speed || 1, words = plain(o.text).split(/\s+/).filter(Boolean);
  const base = audioBase(), tm = C.timings && C.timings[o.id];
  if (base && o.id) {
    const ext = C.lessonMeta.audio.ext, a = new Audio(base + "/" + o.id + "." + ext); a.playbackRate = speed; state.el = a;
    let started = false;
    const tick = () => {
      if (token !== state.token) return;
      if (tm) { const ct = a.currentTime; let idx = -1; for (let i = 0; i < tm.words.length; i++) if (ct >= tm.words[i].start && ct < tm.words[i].end) { idx = i; break; } o.onWord && o.onWord(idx); }
      state.raf = requestAnimationFrame(tick);
    };
    a.addEventListener("playing", () => { started = true; state.mode = "file"; tick(); });
    a.addEventListener("ended", () => { if (token !== state.token) return; cancelAnimationFrame(state.raf); o.onWord && o.onWord(-1); o.onEnd && o.onEnd(); });
    a.addEventListener("error", () => { if (token !== state.token || started) return; fallback(); });
    a.play().catch(() => { if (token === state.token && !started) fallback(); });
    return;
  }
  fallback();
  function fallback() {
    if (token !== state.token) { return; }
    state.timers.forEach(clearTimeout); state.timers = [];
    const ok = ttsSpeak(o.text, speed); state.mode = ok ? "tts" : "silent";
    estimateHighlight(words, speed, i => o.onWord && o.onWord(i), o.onEnd, token);
  }
}
/* короткая фраза/слово без подсветки (id необязателен) */
export function playText(text, id) { playLine({ id, text, speed: S.speed || 1, onWord: null, onEnd: null }); }
