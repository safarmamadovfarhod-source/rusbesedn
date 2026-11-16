#!/usr/bin/env python3
"""Задача 2: звук из файлов и без интернета. Запуск: python3 offline_audio.py http://localhost:8771/"""
import sys, json
from playwright.sync_api import sync_playwright
URL = sys.argv[1]; ok_all = True
def check(name, ok, info=""):
    global ok_all; ok_all = ok_all and bool(ok); print(("  OK   " if ok else "  FAIL ") + name + ((" — " + str(info)) if info and not ok else ""))
INIT = """
window.__alog = [];
const _A = window.Audio;
window.Audio = function (src) { const a = new _A(src); const u = String(src).replace(location.origin, '');
  ['playing', 'ended', 'error'].forEach(ev => a.addEventListener(ev, () => window.__alog.push({ ev, u, rate: a.playbackRate, t: Date.now() }))); return a; };
if (window.speechSynthesis) { const sp = speechSynthesis.speak.bind(speechSynthesis); speechSynthesis.speak = u => { window.__alog.push({ ev: 'tts', u: u.text }); return sp(u); }; }
"""
def btn(page, name): return page.get_by_role("button", name=name, exact=True).first
with sync_playwright() as p:
    b = p.chromium.launch(args=["--autoplay-policy=no-user-gesture-required"]); ctx = b.new_context(viewport={"width": 360, "height": 640}, is_mobile=True, has_touch=True)
    ctx.add_init_script(INIT); page = ctx.new_page(); w = lambda ms=300: page.wait_for_timeout(ms); errs = []
    page.on("pageerror", lambda e: errs.append(str(e)[:200]))
    page.goto(URL); w(2500); btn(page, "Русский").click(); w()
    page.locator("button.choice").first.click(); btn(page, "Дальше").click(); w()
    page.locator("button.choice").first.click(); btn(page, "Дальше").click(); w()
    btn(page, "Дальше").click(); w(); btn(page, "10 мин").click(); btn(page, "Дальше").click(); w(); page.locator("button.btn").first.click(); w(800)
    check("сервис-воркер управляет страницей уже в первом сеансе", page.evaluate("!!navigator.serviceWorker.controller"))
    page.evaluate("async () => { const a = window.__app; await a.useLesson('a0_01'); a.go('lesson'); }"); w(800)
    meta = page.evaluate("() => { const m = window.__C.lessonMeta; return { audio: m.audio, n: Object.keys(window.__C.timings.f_n).length + Object.keys(window.__C.timings.m_n).length }; }")
    check("урок 1 знает про озвучку (4 набора)", meta["audio"] and len(meta["audio"]["sets"]) == 4, meta)
    cached = 0
    for _ in range(40):
        cached = page.evaluate("async () => { const c = await caches.open('rs-lessons-1'); return (await c.keys()).filter(r => /a0_01\\/audio\\/.*\\.mp3/.test(r.url)).length; }")
        if cached >= meta["n"]: break
        w(500)
    check("обычный темп урока 1 сохранён в память телефона целиком", cached >= meta["n"], f"{cached} из {meta['n']}")
    # звук одного следующего урока качается заранее; урока через один — нет
    n2 = 0; c2 = 0
    for _ in range(60):
        r = page.evaluate("async () => { const L = window.__C.lessons['a0_02']; const n = L && L.timings ? Object.keys(L.timings.f_n || {}).length + Object.keys(L.timings.m_n || {}).length : 0; const c = await caches.open('rs-lessons-1'); const k = await c.keys(); return { n, c2: k.filter(r => /a0_02\\/audio\\/[fm]\\/n\\/.*\\.mp3/.test(r.url)).length, c3: k.filter(r => /a0_03\\/audio\\/.*\\.mp3/.test(r.url)).length, s2: k.filter(r => /a0_02\\/audio\\/[fm]\\/s\\//.test(r.url)).length }; }")
        n2, c2 = r["n"], r["c2"]
        if n2 and c2 >= n2: break
        w(500)
    check("звук следующего урока (урок 2, обычный темп) скачан заранее целиком", n2 > 0 and c2 >= n2, f"{c2} из {n2}")
    check("заранее качается только ОДИН следующий урок: звука урока 3 и медленного темпа урока 2 в памяти нет", r["c3"] == 0 and r["s2"] == 0, r)
    # онлайн: реплика играет из файла
    page.evaluate("window.__alog.length = 0"); page.locator('[data-act="playline"]').first.click(); w(3500)
    log = page.evaluate("window.__alog")
    check("онлайн: реплика 1 играет из файла, без голоса телефона", any(x["ev"] == "playing" and "/audio/f/n/l1.mp3" in x["u"] for x in log) and not any(x["ev"] == "tts" for x in log), log[:4])
    page.evaluate("window.__app.go('home')"); w(300)
    ctx.set_offline(True); w(300)
    page.evaluate("async () => { const a = window.__app; await a.useLesson('a0_01'); a.go('lesson'); }"); w(600)
    page.evaluate("window.__alog.length = 0"); page.locator('[data-act="playline"]').nth(1).click(); w(3500)
    log = page.evaluate("window.__alog")
    check("БЕЗ ИНТЕРНЕТА: реплика 2 (мужской голос) играет из файла", any(x["ev"] == "playing" and "/audio/m/n/l2.mp3" in x["u"] for x in log) and not any(x["ev"] == "tts" for x in log), log[:4])
    # слово
    page.evaluate("window.__alog.length = 0"); page.locator("button.w").nth(1).click(); w(400); page.locator('[data-act="wsay"]').first.click(); w(2500)
    log = page.evaluate("window.__alog"); page.keyboard.press("Escape"); w(200)
    check("БЕЗ ИНТЕРНЕТА: слово в окне слова играет из файла", any(x["ev"] == "playing" and "/audio/" in x["u"] for x in log) and not any(x["ev"] == "tts" for x in log), log[:4])
    # медленный темп без интернета: файла «s» в памяти нет — должен сыграть обычный файл с замедлением
    page.evaluate("() => { window.__S.speed = 0.75; window.__alog.length = 0; }"); page.locator('[data-act="playline"]').first.click(); w(5000)
    log = page.evaluate("window.__alog")
    slow_ok = any(x["ev"] == "playing" and "/audio/f/n/l1.mp3" in x["u"] and abs(x["rate"] - 0.75) < 0.01 for x in log) or any(x["ev"] == "playing" and "/audio/f/s/l1.mp3" in x["u"] for x in log)
    check("БЕЗ ИНТЕРНЕТА: медленный темп играет (обычный файл с замедлением), без голоса телефона", slow_ok and not any(x["ev"] == "tts" for x in log), log[:5])
    # перезапуск без интернета
    page.reload(); w(2500)
    opened = page.evaluate("async () => { const a = window.__app; const ok = await a.useLesson('a0_01'); if (ok) a.go('lesson'); return ok; }"); w(600)
    page.evaluate("() => { window.__S.speed = 1; window.__alog.length = 0; }"); page.locator('[data-act="playline"]').first.click(); w(3500)
    log = page.evaluate("window.__alog")
    check("БЕЗ ИНТЕРНЕТА после перезапуска: урок открывается и реплика играет из файла", opened and any(x["ev"] == "playing" and "/audio/f/n/l1.mp3" in x["u"] for x in log) and not any(x["ev"] == "tts" for x in log), log[:4])
    # следующий урок, который ещё ни разу не открывали: без интернета открывается и звучит из файла
    opened2 = page.evaluate("async () => { const a = window.__app; const ok = await a.useLesson('a0_02'); if (ok) a.go('lesson'); return ok; }"); w(600)
    page.evaluate("window.__alog.length = 0"); page.locator('[data-act="playline"]').first.click(); w(3500)
    log = page.evaluate("window.__alog")
    check("БЕЗ ИНТЕРНЕТА: урок 2, который ещё не открывали, открывается и реплика играет из файла", opened2 and any(x["ev"] == "playing" and "a0_02/audio/" in x["u"] for x in log) and not any(x["ev"] == "tts" for x in log), log[:4])
    ctx.set_offline(False); w(300)
    page.evaluate("async () => { const a = window.__app; await a.useLesson('b_02'); a.go('lesson'); }"); w(800)
    page.evaluate("window.__alog.length = 0"); page.locator('[data-act="playline"]').nth(2).click(); w(4500)
    log = page.evaluate("window.__alog")
    check("онлайн: изменённая реплика b_02_l3 играет из файла", any(x["ev"] == "playing" and "b_02_l3.mp3" in x["u"] for x in log), log[:4])
    say = page.evaluate("async () => { await window.__app.useLesson('b_01'); return window.__C.say['b_01_w17']; }")
    check("предлог «в»: для звука записан пример «в магази́не» (а не одна буква)", say == "в магази\u0301не", say)
    check("нет ошибок JavaScript", not errs, errs[:3])
    b.close()
print("ИТОГ:", "всё прошло" if ok_all else "ЕСТЬ ОШИБКИ")
