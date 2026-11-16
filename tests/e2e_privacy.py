#!/usr/bin/env python3
"""Задача 6: страница политики. Запуск: python3 tests/e2e_privacy.py http://localhost:8771/"""
import sys
from playwright.sync_api import sync_playwright
URL = sys.argv[1]; ok_all = True
def check(name, ok, info=""):
    global ok_all; ok_all = ok_all and bool(ok); print(("  OK   " if ok else "  FAIL ") + name + ((" — " + str(info)) if info and not ok else ""))
def btn(page, name): return page.get_by_role("button", name=name, exact=True).first
with sync_playwright() as p:
    b = p.chromium.launch(); ctx = b.new_context(viewport={"width": 360, "height": 640}, is_mobile=True, has_touch=True)
    page = ctx.new_page(); w = lambda ms=300: page.wait_for_timeout(ms); errs = []
    page.on("pageerror", lambda e: errs.append(str(e)[:200]))
    ext = []; page.on("request", lambda r: ext.append(r.url) if not r.url.startswith(URL) and not r.url.startswith("data:") else None)
    page.goto(URL + "privacy.html"); w(1000)
    check("страница политики открывается по-русски", page.locator("#ru").is_visible() and not page.locator("#tg").is_visible())
    check("в русском тексте 9 разделов и «Коротко»", page.locator("#ru h2").count() == 10, page.locator("#ru h2").count())
    check("в таджикском тексте столько же разделов и пунктов", page.locator("#tg h2").count() == 10 and page.locator("#tg li").count() == page.locator("#ru li").count())
    page.get_by_role("link", name="Тоҷикӣ", exact=True).click(); w()
    check("кнопка «Тоҷикӣ» переключает язык", page.locator("#tg").is_visible() and not page.locator("#ru").is_visible())
    page.goto(URL + "privacy.html?lang=tg"); w(800)
    check("адрес с ?lang=tg открывает таджикский текст", page.locator("#tg").is_visible())
    for wd in (360, 320):
        page.set_viewport_size({"width": wd, "height": 640}); w(200)
        check("на экране %d точек нет прокрутки вбок" % wd, page.evaluate("document.documentElement.scrollWidth - innerWidth") <= 0)
    small = page.evaluate("[...document.querySelectorAll('.langs a, a.back, a.home')].filter(a => a.offsetParent && a.getBoundingClientRect().height < 48).length")
    check("кнопки и ссылки-кнопки не ниже 48 точек", small == 0, small)
    check("страница ничего не запрашивает с чужих адресов", not ext, ext[:3])
    # из приложения: Ещё → О приложении → Политика → Полный текст
    page.set_viewport_size({"width": 360, "height": 640}); page.goto(URL); w(2500); btn(page, "Русский").click(); w()
    page.locator("button.choice").first.click(); btn(page, "Дальше").click(); w()
    page.locator("button.choice").first.click(); btn(page, "Дальше").click(); w()
    btn(page, "Дальше").click(); w(); btn(page, "10 мин").click(); btn(page, "Дальше").click(); w(); page.locator("button.btn").first.click(); w(800)
    page.evaluate("window.__app.go('privacy')"); w(500)
    link = page.get_by_role("link", name="Полный текст политики конфиденциальности", exact=True)
    check("в приложении на экране политики есть ссылка «Полный текст политики конфиденциальности»", link.count() == 1)
    link.click(); w(1000)
    check("ссылка открывает страницу политики на языке приложения", "privacy.html" in page.url and page.locator("#ru").is_visible())
    page.get_by_role("link", name="← Вернуться в приложение", exact=True).click(); w(2500)
    check("«Вернуться в приложение» возвращает в приложение, прогресс на месте", page.evaluate("!!window.__app && !!JSON.parse(localStorage.getItem('rs_state_v1')).settings.uiLang"))
    # без интернета (сервис-воркер уже управляет страницей)
    sw = page.evaluate("!!navigator.serviceWorker.controller"); ctx.set_offline(True); w(300)
    try: page.goto(URL + "privacy.html"); w(800); off = page.locator("#ru h1").is_visible()
    except Exception as e: off = False
    check("без интернета страница политики открывается из памяти телефона", sw and off)
    check("нет ошибок JavaScript", not errs, errs[:3])
    b.close()
print("ИТОГ:", "всё прошло" if ok_all else "ЕСТЬ ОШИБКИ")
