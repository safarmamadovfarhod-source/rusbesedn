/* Чаша: уровень = цель недели; жидкость колышется при наклоне телефона (D-45).
   Данные датчиков используются только здесь, на телефоне, и никуда не отправляются.
   Анимация останавливается, когда чаша «успокоилась», когда экран скрыт, и отключена при «уменьшить движение». */
import { S, save } from "./store.js";
const K = 38, DAMP = 5.2;
let target = 0, th = 0, om = 0, raf = 0, last = 0, ph = 0, listening = false, granted = false;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const reduced = () => typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
export const needsPermission = () => typeof DeviceOrientationEvent !== "undefined" && typeof DeviceOrientationEvent.requestPermission === "function";
export const enabled = () => S.settings.tilt !== "off" && !reduced();
export const permissionPending = () => needsPermission() && !granted && S.settings.tilt !== "off";

/* поверхность жидкости: волна вокруг уровня y; x выходит за края чаши, чтобы при повороте не было щелей */
export function wavePath(y, a, p, closed) {
  let d = "";
  for (let x = -80, i = 0; x <= 280; x += 12, i++) d += (i ? "L" : "M") + x + " " + (y + a * Math.sin(x / 16 + p)).toFixed(2) + " ";
  return closed ? d + "L280 " + (y + 160) + " L-80 " + (y + 160) + "Z" : d;
}
function draw() {
  const els = typeof document !== "undefined" ? document.querySelectorAll(".cup-liq") : [];
  if (!els.length) return false;
  const a = clamp(Math.abs(om) * 0.12 + 2, 2, 7);
  els.forEach(g => {
    const y = +g.dataset.y;
    g.setAttribute("transform", "rotate(" + th.toFixed(2) + " 100 " + y + ")");
    g.firstChild.setAttribute("d", wavePath(y, a, ph, true)); g.lastChild.setAttribute("d", wavePath(y, a, ph, false));
  });
  return true;
}
function step(t) {
  raf = 0; if (document.hidden) return;
  const dt = clamp((t - last) / 1000, 0.001, 0.05); last = t;
  om += (-K * (th - target) - DAMP * om) * dt; th = clamp(th + om * dt, -40, 40); ph += dt * (2 + Math.abs(om) * 0.15);
  if (!draw()) return;
  if (Math.abs(om) > 0.05 || Math.abs(th - target) > 0.05) raf = requestAnimationFrame(step);
}
function kick() { if (!raf && typeof document !== "undefined" && !document.hidden) { last = performance.now(); raf = requestAnimationFrame(step); } }
function onOrient(e) { if (!enabled() || e.gamma == null) return; target = -clamp(e.gamma, -45, 45) * 0.8; kick(); }
function onMotion(e) { if (!enabled()) return; const a = e.acceleration; if (!a || a.x == null || Math.abs(a.x) < 1.5) return; om += clamp(-a.x, -12, 12) * 6; kick(); }
export function startTilt() {
  if (listening || typeof window === "undefined") return;
  window.addEventListener("deviceorientation", onOrient); window.addEventListener("devicemotion", onMotion);
  document.addEventListener("visibilitychange", () => { if (document.hidden) { if (raf) cancelAnimationFrame(raf); raf = 0; } else if (Math.abs(om) > 0.05 || Math.abs(th - target) > 0.05) kick(); });
  listening = true; if (!needsPermission()) granted = true;
}
/* iPhone: система спрашивает разрешение один раз, только по нажатию кнопки */
export async function askTilt() {
  try { const r = await DeviceOrientationEvent.requestPermission(); granted = r === "granted"; } catch (e) { granted = false; }
  if (granted) { S.settings.tilt = "on"; save(); startTilt(); }
  return granted;
}
export function setTilt(on) { S.settings.tilt = on ? "on" : "off"; save(); if (on) startTilt(); else { target = 0; kick(); } }
/* вызывается после каждой перерисовки экрана: новая чаша сразу принимает текущий наклон */
export function syncCup() { if (typeof document !== "undefined" && document.querySelector(".cup-liq") && (Math.abs(th) > 0.05 || Math.abs(target) > 0.05)) { draw(); kick(); } }
