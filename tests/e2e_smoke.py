#!/usr/bin/env python3
"""Проверка экранов в браузере (телефон 360×640): онбординг, урок, подсветка ответа, «Верно/неверно»,
кнопка «назад» телефона, продолжение урока после перезагрузки, диалог, меню «Ещё», «Звуки», «Грамматика», офлайн, ошибки JavaScript.

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
    page.locator("button.choice", has_text="Спаси́бо, Шарора́.").click(); wait(page)
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
    check("«Верно/неверно»: русская фраза на экране", "Манучехр говорит" in body.replace("\u0301", ""))

    # кнопка «назад» телефона: из упражнения — не выход из приложения
    page.go_back(); wait(page, 600)
    check("«назад» телефона остаётся в приложении", page.url.startswith(URL.rstrip("/")) and page.locator("#view .scr").count() == 1, page.url)

    # проходим урок до конца
    page.goto(URL); wait(page, 700)
    page.get_by_role("button", name=re.compile("Продолжить с задания|Начать")).first.click(); wait(page, 500)
    if page.get_by_role("button", name="К упражнениям", exact=True).count():
        btn(page, "К упражнениям").click(); wait(page)
    seen_fix = False
    for _ in range(300):
        body = page.inner_text("body")
        if "Исправляем ошибки" in body:
            seen_fix = True
        if "Урок пройден" in body:
            break
        for name in ["Дальше", "Проверить", "Получилось", "Я повторил(а)", "Совпало", "Показать образец"]:
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
    check("задания с ошибками повторяются в конце", seen_fix)
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
    check("диалог: имя в таджикском переводе без ударения", "Номи ман Шарора́" not in page.inner_text("body"))

    # «Ещё» — меню разделов, «Звуки» и тренировка на слух (0.3.5)
    page.goto(URL); wait(page, 700)
    page.locator(".nav button").last.click(); wait(page)
    check("«Ещё» — меню разделов", page.locator(".mrow").count() >= 8)
    page.locator(".mrow", has_text="Вид и звук").click(); wait(page)
    check("оформления показаны картинками", page.locator(".thprev svg").count() == 3)
    page.locator("[data-back]").first.click(); wait(page)
    page.locator(".mrow", has_text="Звуки").click(); wait(page)
    check("«Звуки»: сетка из 33 звуков", page.locator(".sndtile").count() == 33)
    page.locator("button[data-act=sndstart]").click(); wait(page)
    for _ in range(8):
        page.locator("button[data-act=sndpick]").first.click(); wait(page, 120)
        page.locator("button[data-act=sndnext]").click(); wait(page, 150)
    check("тренировка звуков завершается", page.locator("button[data-act=sndexit]").count() == 1)

    # «Грамматика» (0.3.6): вкладка, тема, проверка
    page.goto(URL); wait(page, 700)
    check("в нижнем меню 5 вкладок", page.locator(".nav button").count() == 5)
    page.locator(".nav button[data-go=grammar]").click(); wait(page)
    check("«Грамматика»: есть открытые темы", page.locator(".gtile:not(.locked)").count() > 0)
    page.locator(".gtile:not(.locked)").first.click(); wait(page)
    check("тема: правило, примеры, проверка", page.locator(".grule").count() == 1 and page.locator(".gexr").count() > 0 and page.locator("button[data-act=gans]").count() > 0)

    # словарь терминов (0.3.7)
    page.goto(URL); wait(page, 700)
    btn(page, "Грамматика").click(); wait(page)
    page.locator(".gloss-entry").click(); wait(page)
    check("«Словарь терминов»: не меньше 20 терминов", page.locator("[data-act=gtermopen]").count() >= 20)
    page.locator("[data-act=gtermopen][data-v=case]").click(); wait(page)
    terms = page.locator("#view button.term")
    ok = terms.count() > 0
    if ok:
        terms.first.click(); wait(page)
        ok = page.locator(".tsheet").count() == 1 and page.locator(".tsheet [data-act=termmore]").count() == 1
    check("термин подсвечен, по нажатию открывается карточка", ok)

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
