/* Сервис-воркер: офлайн-режим. Версия и список файлов подставляются tools/build_manifest.py */
const VERSION = "/*VERSION*/";
const CACHE = "rs-" + VERSION;
const PRECACHE = /*PRECACHE*/[];

/* 0.3.7.1: файлы берём мимо кэша браузера (cache: "reload"). Иначе при обновлении в новый кэш попадали
   старые копии из кэша браузера (GitHub Pages держит их 10 минут): версия новая, а стили и уроки — старые. */
self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(PRECACHE.map(u => new Request(u, { cache: "reload" })))).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith("rs-") && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });

/* Медиа запрашивается с заголовком Range: отдаём нужный кусок из кэша */
async function rangeResponse(req, res) {
  const buf = await res.arrayBuffer(), m = /bytes=(\d*)-(\d*)/.exec(req.headers.get("range") || ""), total = buf.byteLength;
  let start = m && m[1] ? parseInt(m[1], 10) : 0, end = m && m[2] ? parseInt(m[2], 10) : total - 1;
  if (start >= total) return new Response(null, { status: 416, headers: { "Content-Range": "bytes */" + total } });
  end = Math.min(end, total - 1);
  return new Response(buf.slice(start, end + 1), { status: 206, headers: { "Content-Type": res.headers.get("Content-Type") || "application/octet-stream", "Content-Range": "bytes " + start + "-" + end + "/" + total, "Content-Length": String(end - start + 1) } });
}
self.addEventListener("fetch", e => {
  const req = e.request; if (req.method !== "GET") return;
  const url = new URL(req.url); if (url.origin !== location.origin) return;
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
