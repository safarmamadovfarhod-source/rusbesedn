#!/usr/bin/env python3
"""Проверка экранов в браузере (телефон 360×640): онбординг, урок, подсветка ответа, «Верно/неверно»,
кнопка «назад» телефона, продолжение урока после перезагрузки, диалог, офлайн, ошибки JavaScript.

Нужен Python-пакет playwright и Chromium:  pip install playwright && playwright install chromium
Запуск из папки приложения:
    python3 -m http.server 8765 &
    python3 tests/e2e_smoke.py http://localhost:8765/
Код выхода 0 — всё прошло; 1 — есть ошибки (список печатается)."""
import re
import sys

from playwright.sync_api import sync_playwright

URL = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8765/"
results = []


def check(name, cond, info=""):
    results.append((bool(cond), name, info))


def btn(page, name):
    return page.get_by_role("button", name=name, exact=True).first


def wait(page, ms=300):
    page.wait_for_timeout(ms)


def onboard(page, name="Тест"):
    page.goto(URL); wait(page, 800)
    btn(page, "Русский").click(); wait(page)
    page.locator("button.choice").first.click(); btn(page, "Дальше").click(); wait(page)
    page.locator("button.choice").first.click(); btn(page, "Дальше").click(); wait(page)
    btn(page, "Дальше").click(); wait(page)
    btn(page, "10 мин").click(); page.fill("input[type=text]", name); btn(page, "Дальше").click(); wait(page)
    page.locator("button.btn").first.click(); wait(page, 500)


with sync_playwright() as p:
    browser = p.chromium.launch()
    ctx = browser.new_context(viewport={"width": 360, "height": 640}, is_mobile=True, has_touch=True)
    page = ctx.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)

    onboard(page, "Фарход")
    home = page.inner_text("body")
    check("приветствие с именем", "Фарход" in home)
    box = btn(page, "Начать").bounding_box()
    check("кнопка урока видна на первом экране 360×640", box and box["y"] + box["height"] <= 640, str(box))

    btn(page, "Начать").click(); wait(page, 500)
    btn(page, "К упражнениям").click(); wait(page)
    page.locator("button.choice", has_text="Спаси́бо, А́нна.").click(); wait(page)
    check("после ошибки подсвечен правильный ответ", page.locator("button.choice.good.right").count() == 1)

    # продолжение после перезагрузки (звонок, закрытие вкладки)
    btn(page, "Дальше").click(); wait(page)
    page.reload(); wait(page, 900)
    cont = page.get_by_role("button", name=re.compile("Продолжить с задания"))
    check("после перезагрузки предлагается продолжить урок", cont.count() == 1, page.inner_text("body")[:80])
    if cont.count():
        cont.first.click(); wait(page, 500)
    body = page.inner_text("body")
    check("урок продолжается со второго задания", "Верно или неверно?" in body, body[:80])
    check("«Верно/неверно»: русская фраза на экране", "Руслан говорит" in body)

    # кнопка «назад» телефона: из упражнения — не выход из приложения
    page.go_back(); wait(page, 600)
    check("«назад» телефона остаётся в приложении", page.url.startswith(URL.rstrip("/")) and page.locator("#view .scr").count() == 1, page.url)

    # проходим урок до конца
    page.goto(URL); wait(page, 700)
    page.get_by_role("button", name=re.compile("Продолжить с задания|Начать")).first.click(); wait(page, 500)
    if page.get_by_role("button", name="К упражнениям", exact=True).count():
        btn(page, "К упражнениям").click(); wait(page)
    for _ in range(90):
        body = page.inner_text("body")
        if "Урок пройден" in body:
            break
        for name in ["Дальше", "Проверить", "Получилось", "Я повторил(а)", "Совпало", "Показать эталон"]:
            loc = page.get_by_role("button", name=name, exact=True)
            if loc.count() and loc.first.is_enabled():
                if name == "Проверить":
                    chips = page.locator(".chips button.chip:not([disabled])")
                    while chips.count():
                        chips.first.click(); wait(page, 60)
                    if page.locator("#typed").count():
                        page.fill("#typed", "спасибо")
                loc.first.click(); wait(page, 250)
                break
        else:
            choices = page.locator("button.choice")
            if not choices.count():
                break
            choices.first.click(); wait(page, 250)
    check("урок проходится до конца", "Урок пройден" in page.inner_text("body"))
    state = page.evaluate("JSON.parse(localStorage.rs_state_v1)")
    check("после урока сохранённое место очищено", not state.get("resume"))

    # диалог: вежливый, но неподходящий ответ
    btn(page, "Попробовать диалог").click(); wait(page, 400)
    for start in ["Здра́вствуйте", "Меня́ зову́т"]:
        page.locator("button.choice", has_text=start).first.click(); wait(page)
        btn(page, "Дальше").click(); wait(page, 800)
    page.locator("button.choice", has_text="Мне то́же").first.click(); wait(page)
    btn(page, "Дальше").click(); wait(page, 500)
    check("диалог: после ответа «ok» нужно выбрать подходящий", "подходит лучше" in page.inner_text("body"))
    check("диалог: имя в таджикском переводе без ударения", "Номи ман А́нна" not in page.inner_text("body"))

    # офлайн после первой загрузки
    page.goto(URL); wait(page, 1500)
    ctx.set_offline(True)
    page.reload(); wait(page, 1200)
    check("работает без интернета", "Ещё" in page.inner_text("body"))
    ctx.set_offline(False)

    check("нет ошибок JavaScript", not errors, "; ".join(errors[:3]))
    browser.close()

failed = [r for r in results if not r[0]]
for ok, name, info in results:
    print(("PASS " if ok else "FAIL ") + name + (" | " + info if info and not ok else ""))
print(f"итого: {len(results) - len(failed)} из {len(results)}")
sys.exit(1 if failed else 0)
