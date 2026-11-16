#!/usr/bin/env python3
"""Снимки экранов для страницы в Google Play (настоящие экраны приложения, 1080×1920).
Запуск: python3 tools/make_store_shots.py http://localhost:8771/ docs/store/grafika"""
import sys, pathlib
from playwright.sync_api import sync_playwright
from PIL import Image
URL, OUT = sys.argv[1], pathlib.Path(sys.argv[2]); OUT.mkdir(parents=True, exist_ok=True)
def btn(page, name): return page.get_by_role("button", name=name, exact=True).first
with sync_playwright() as p:
    b = p.chromium.launch(); ctx = b.new_context(viewport={"width": 360, "height": 640}, device_scale_factor=3, is_mobile=True, has_touch=True, locale="ru-RU")
    page = ctx.new_page(); w = lambda ms=400: page.wait_for_timeout(ms)
    page.goto(URL); w(2500); btn(page, "Русский").click(); w()
    page.locator("button.choice").first.click(); btn(page, "Дальше").click(); w()
    page.locator("button.choice").first.click(); btn(page, "Дальше").click(); w()
    btn(page, "Дальше").click(); w(); btn(page, "10 мин").click(); btn(page, "Дальше").click(); w(); page.locator("button.btn").first.click(); w(1200)
    def shot(name):
        f = OUT / name; page.screenshot(path=str(f)); im = Image.open(f).convert("RGB"); im.save(f, optimize=True); print(name, im.size)
    page.evaluate("window.__app.go('home')"); w(900); shot("ekran-1-glavnaya.png")
    page.evaluate("async () => { const a = window.__app; await a.useLesson('a0_03'); a.go('lesson'); }"); w(1200); shot("ekran-2-dialog.png")
    page.locator("button.w").nth(2).click(); w(700); shot("ekran-3-slovo.png"); page.keyboard.press("Escape"); w(300)
    page.evaluate("window.__app.go('grammar')"); w(900); shot("ekran-4-grammatika.png")
    b.close()
