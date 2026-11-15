/* Сервис-воркер: офлайн-режим. Версия и список файлов подставляются tools/build_manifest.py */
const VERSION = "2566b69a8c";
const CACHE = "rs-" + VERSION;
const PRECACHE = [
 "./",
 "css/app.css",
 "data/courses.json",
 "data/diag.json",
 "data/diag_b.json",
 "data/glossary.json",
 "data/grammar.json",
 "data/i18n.json",
 "fonts/OFL.txt",
 "fonts/PTSans-OFL.txt",
 "fonts/RSSans-Bold.woff",
 "fonts/RSSans-Regular.woff",
 "icons/icon-192.png",
 "icons/icon-512.png",
 "icons/icon-maskable-512.png",
 "icons/icon-maskable.svg",
 "icons/icon.svg",
 "img/ic01.webp",
 "img/ic02.webp",
 "img/ic03.webp",
 "img/ic04.webp",
 "img/ic05.webp",
 "img/ic06.webp",
 "img/ic07.webp",
 "img/ic08.webp",
 "img/ic09.webp",
 "img/ic10.webp",
 "img/ic11.webp",
 "img/ic12.webp",
 "img/ic13.webp",
 "img/ic14.webp",
 "img/ic15.webp",
 "img/ic16.webp",
 "img/ic17.webp",
 "img/ic18.webp",
 "img/ic19.webp",
 "img/ic20.webp",
 "img/ic21.webp",
 "img/ic22.webp",
 "img/ic23.webp",
 "img/ic24.webp",
 "img/learner.webp",
 "img/m01.webp",
 "img/m02.webp",
 "img/m03.webp",
 "img/m04.webp",
 "img/m05.webp",
 "img/m06.webp",
 "img/manuchehr.webp",
 "img/sharora.webp",
 "index.html",
 "js/analytics.js",
 "js/app.js",
 "js/audio.js",
 "js/config.js",
 "js/content.js",
 "js/cup.js",
 "js/i18n.js",
 "js/main.js",
 "js/nav.js",
 "js/pics.js",
 "js/progress.js",
 "js/report.js",
 "js/screens/dialog.js",
 "js/screens/glossary.js",
 "js/screens/grammar.js",
 "js/screens/home.js",
 "js/screens/lesson.js",
 "js/screens/onboarding.js",
 "js/screens/settings.js",
 "js/screens/sounds.js",
 "js/srs.js",
 "js/store.js",
 "js/ui.js",
 "js/util.js",
 "manifest.webmanifest"
];
/* 0.3.10: уроки и озвучка — в отдельном кэше, который переживает обновление оболочки.
   Адрес файла урока содержит версию (?v=хэш из courses.json): файл скачивается один раз и заново — только когда урок изменился. */
const LCACHE = "rs-lessons-1";
const isLesson = url => url.pathname.indexOf("/data/lessons/") >= 0;

/* 0.3.7.1: файлы берём мимо кэша браузера (cache: "reload"). Иначе при обновлении в новый кэш попадали
   старые копии из кэша браузера (GitHub Pages держит их 10 минут): версия новая, а стили и уроки — старые. */
self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(PRECACHE.map(u => new Request(u, { cache: "reload" })))).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith("rs-") && k !== CACHE && k !== LCACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });

/* Медиа запрашивается с заголовком Range: отдаём нужный кусок из кэша */
async function rangeResponse(req, res) {
  const buf = await res.arrayBuffer(), m = /bytes=(\d*)-(\d*)/.exec(req.headers.get("range") || ""), total = buf.byteLength;
  let start = m && m[1] ? parseInt(m[1], 10) : 0, end = m && m[2] ? parseInt(m[2], 10) : total - 1;
  if (start >= total) return new Response(null, { status: 416, headers: { "Content-Range": "bytes */" + total } });
  end = Math.min(end, total - 1);
  return new Response(buf.slice(start, end + 1), { status: 206, headers: { "Content-Type": res.headers.get("Content-Type") || "application/octet-stream", "Content-Range": "bytes " + start + "-" + end + "/" + total, "Content-Length": String(end - start + 1) } });
}
/* Файл урока или озвучки: из кэша уроков; если его там нет — из сети целиком (даже когда плеер просит кусок) и в кэш.
   Старые версии того же файла (другой ?v=) удаляются. Нет сети и нет в кэше → 503, приложение покажет «урок ещё не скачан». */
async function lessonResponse(req, url) {
  const c = await caches.open(LCACHE), range = req.headers.get("range");
  let res = await c.match(url.href, { ignoreVary: true });
  if (!res) {
    try {
      const net = await fetch(url.href); if (!net || !net.ok) return net;
      await c.put(url.href, net.clone());
      const old = await c.keys(); await Promise.all(old.filter(k => { const u = new URL(k.url); return u.pathname === url.pathname && u.search !== url.search; }).map(k => c.delete(k)));
      res = net;
    } catch (err) { return new Response("offline", { status: 503, statusText: "offline" }); }
  }
  return range ? rangeResponse(req, res) : res;
}
self.addEventListener("fetch", e => {
  const req = e.request; if (req.method !== "GET") return;
  const url = new URL(req.url); if (url.origin !== location.origin) return;
  if (isLesson(url)) { e.respondWith(lessonResponse(req, url)); return; }
  e.respondWith((async () => {
    let res = await caches.match(req, { ignoreSearch: true, ignoreVary: true });
    if (!res && req.mode === "navigate") res = await caches.match("./index.html");
    if (!res) {
      try { res = await fetch(req); if (res && res.ok && !req.headers.get("range")) { const c = await caches.open(CACHE); c.put(req, res.clone()); } return res; }
      catch (err) { return new Response("offline", { status: 503, statusText: "offline" }); }
    }
    if (req.headers.get("range")) return rangeResponse(req, res);
    return res;
  })());
});
