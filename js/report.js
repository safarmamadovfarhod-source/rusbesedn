import { S } from "./store.js";
import { CONFIG } from "./config.js";
export function buildReport(kind, text, withLog) {
  const nav = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const lines = ["Категория: " + kind, "Сообщение: " + (text || "").trim(), "Версия приложения: " + CONFIG.APP_VERSION, "Система/браузер: " + nav, "Язык интерфейса: " + (S.settings.uiLang || "-")];
  if (withLog) {
    lines.push("--- технический журнал (по согласию) ---");
    S.errors.slice(-10).forEach(e => lines.push("ошибка: " + e.m));
    S.events.slice(-30).forEach(e => lines.push("событие: " + e.e));
  }
  return lines.join("\n");
}
export function mailtoUrl(to, subject, body) { return "mailto:" + encodeURIComponent(to) + "?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(body); }
