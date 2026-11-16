#!/usr/bin/env python3
"""Проверка экранов в браузере (телефон 360×640): онбординг, урок, подсветка ответа, «Верно/неверно»,
кнопка «назад» телефона, продолжение урока после перезагрузки, диалог, меню «Ещё», «Звуки», «Грамматика», офлайн, ошибки JavaScript.

Нужен Python-пакет playwright и Chromium:  pip install playwright && playwright install chromium
Запуск из папки приложения:
    python3 -m http.server 8765 &
    python3 tests/e2e_smoke.py http://localhost:8765/
Код выхода 0 — всё прошло; 1 — есть ошибки (список печатается)."""
import json
import pathlib
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
    lesson_txt = page.inner_text("#view")
    check("0.3.9: под уроком нет служебных пометок (Piper, черновик)", "Piper" not in lesson_txt and "черновик" not in lesson_txt, lesson_txt[-120:])
    btn(page, "К упражнениям").click(); wait(page)
    page.locator("button.choice", has_text="Спаси́бо, Шаро́ра.").click(); wait(page)
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
    check("диалог: имя в таджикском переводе без ударения", "Номи ман Шаро́ра" not in page.inner_text("body"))

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

    # 0.3.9: панель «Для проверки» выключена в сборке для людей
    page.locator('nav [data-go="settings"]').click(); wait(page)
    check("0.3.9: в «Ещё» нет раздела «Для проверки»", "Для проверки" not in page.inner_text("#view"))
    check("нет ошибок JavaScript", not errors, "; ".join(errors[:3]))

    # 0.3.9: память телефона заполнена — человек видит сообщение на главной
    ctx2 = browser.new_context(viewport={"width": 360, "height": 640}, is_mobile=True, has_touch=True)
    p2 = ctx2.new_page(); onboard(p2, "Память")
    p2.evaluate("() => { Storage.prototype.setItem = function () { throw new DOMException('quota', 'QuotaExceededError'); }; }")
    btn(p2, "Начать").click(); wait(p2, 500)
    btn(p2, "К упражнениям").click(); wait(p2)
    p2.locator("button.choice").first.click(); wait(p2, 300)
    p2.go_back(); wait(p2, 300); p2.go_back(); wait(p2, 500)
    check("0.3.9: при заполненной памяти на главной есть предупреждение", p2.locator(".nostore").count() == 1, p2.inner_text("#view")[:80])
    ctx2.close()

    # 0.3.9: голос телефона молчит — подсказка появляется в самом уроке
    ctx3 = browser.new_context(viewport={"width": 360, "height": 640}, is_mobile=True, has_touch=True)
    ctx3.add_init_script("try { speechSynthesis.speak = function () {}; } catch (e) {}")
    ctx3.route("**/audio/**", lambda r: r.abort())  # 0.4.6: записи есть, поэтому для этой проверки файлы озвучки недоступны
    p3 = ctx3.new_page(); onboard(p3, "Звук")
    btn(p3, "Начать").click(); wait(p3, 500)
    p3.locator('[data-act="playline"]').first.click(); wait(p3, 3400)
    check("0.3.9: если записи недоступны и голос телефона не заговорил, в уроке есть подсказка", p3.locator(".novoice").count() == 1)
    btn(p3, "К упражнениям").click(); wait(p3)
    ctx3.close()

    # 0.3.10: уроки загружаются по требованию
    ctx4 = browser.new_context(viewport={"width": 360, "height": 640}, is_mobile=True, has_touch=True)
    p4 = ctx4.new_page(); reqs = []
    p4.on("request", lambda r: reqs.append(r.url) if "/data/lessons/" in r.url else None)
    onboard(p4, "Уроки")
    boot = sorted(set(u.split("/data/lessons/")[1].split("/")[0] for u in reqs))
    check("0.3.10: при запуске загружены только текущий урок и следующий (из 8)", boot in (["a0_01"], ["a0_01", "a0_02"]), str(boot))
    check("0.3.10: в адресе урока есть версия", all("?v=" in u for u in reqs), str(reqs[:2]))
    wait(p4, 1500)  # сервис-воркер успевает положить урок в кэш
    ctx4.set_offline(True)
    p4.reload(); wait(p4, 1200)
    btn(p4, "Начать").click(); wait(p4, 600)
    check("0.3.10: первый урок открывается без сети сразу после первой загрузки", "Меня зовут" in p4.inner_text("#view").replace("\u0301", ""), p4.inner_text("#view")[:100])
    p4.go_back(); wait(p4, 400)
    p4.locator('nav [data-go="settings"]').click(); wait(p4)
    p4.locator('[data-go="setstudy"]').click(); wait(p4)
    p4.locator('[data-act="settrack"][data-v="b"]').click(); wait(p4, 700)
    check("0.3.10: без сети нескачанный урок даёт понятное сообщение", "ещё не скачан" in p4.inner_text("body"), p4.inner_text("body")[-120:])
    p4.reload(); wait(p4, 1200)
    check("0.3.10: приложение открывается без сети, даже если урок не скачан", p4.locator("#view .scr").count() == 1 and "Не получилось" not in p4.inner_text("body"), p4.inner_text("body")[:120])
    ctx4.set_offline(False)
    p4.reload(); wait(p4, 1500)
    btn(p4, "Начать").click(); wait(p4, 800)
    check("0.3.10: с сетью урок другого пути загружается и открывается", "Ты где" in p4.inner_text("#view").replace("\u0301", ""), p4.inner_text("#view")[:120])
    wait(p4, 1200); ctx4.set_offline(True)
    p4.reload(); wait(p4, 1200)
    p4.get_by_role("button", name=re.compile("Начать|Продолжить")).first.click(); wait(p4, 800)
    check("0.3.10: скачанный урок открывается без сети", "Ты где" in p4.inner_text("#view").replace("\u0301", ""), p4.inner_text("#view")[:120])
    p4.locator('nav [data-go="words"]').click() if p4.locator('nav [data-go="words"]').count() else None
    ctx4.close()

    # 0.4.0: путь A — уроки 2–5 открываются и проходятся до конца, диалог каждого урока проходится
    def run_lesson(pg):
        for _ in range(400):
            body = pg.inner_text("body")
            if "Урок пройден" in body:
                return True
            for name in ["К упражнениям", "Дальше", "Проверить", "Получилось", "Я повторил(а)", "Совпало", "Показать образец"]:
                loc = pg.get_by_role("button", name=name, exact=True)
                if loc.count() and loc.first.is_enabled():
                    if name == "Проверить":
                        chips = pg.locator(".chips button.chip:not([disabled])")
                        while chips.count():
                            chips.first.click(); wait(pg, 40)
                        if pg.locator("#typed").count():
                            pg.fill("#typed", "хлеб")
                    loc.first.click(); wait(pg, 150)
                    break
            else:
                choices = pg.locator("button.choice")
                if not choices.count():
                    return False
                choices.first.click(); wait(pg, 150)
        return False

    ctx5 = browser.new_context(viewport={"width": 360, "height": 640}, is_mobile=True, has_touch=True)
    p5 = ctx5.new_page(); errs5 = []
    p5.on("pageerror", lambda e: errs5.append(str(e)))
    onboard(p5, "Курс")
    titles = ["Знакомство", "Семья", "Магазин", "Транспорт", "Работа"]
    done = []
    for n, title in enumerate(titles):
        p5.goto(URL); wait(p5, 700)
        home_txt = p5.inner_text("#view")
        if title not in home_txt:
            break
        p5.get_by_role("button", name=re.compile("^(Начать|Продолжить)")).first.click(); wait(p5, 700)
        if not run_lesson(p5):
            break
        if n:  # диалог урока: выбираем варианты, пока не дойдём до конца
            btn(p5, "Попробовать диалог").click(); wait(p5, 500)
            lesson = json.loads((pathlib.Path(__file__).resolve().parent.parent / "data" / "lessons" / ("a0_0%d" % (n + 1)) / "lesson.json").read_text(encoding="utf-8"))
            for turn in lesson["scenario"]["turns"]:
                best = next(o["ru"] for o in turn["options"] if o["q"] == "best")
                p5.locator("button.choice", has_text=best).first.click(); wait(p5, 250)
                btn(p5, "Дальше").click(); wait(p5, 700)
            if "Диалог пройден" not in p5.inner_text("body"):
                break
        done.append(title)
    check("0.4.0: уроки 1–5 пути A и их диалоги проходятся до конца", done == titles, "пройдено: " + ", ".join(done) + " | " + p5.inner_text("body")[:160].replace("\n", " / "))
    p5.goto(URL); wait(p5, 700)
    check("0.4.0: после пяти уроков главная сообщает, что путь пройден", "Все уроки этого пути пройдены" in p5.inner_text("#view"), p5.inner_text("#view")[:120])
    p5.locator('nav [data-go="words"]').click(); wait(p5, 900)
    wtxt = p5.inner_text("#view").replace("\u0301", "")
    check("0.4.0: во вкладке «Слова» есть слова новых уроков", all(x in wtxt for x in ["семья", "хлеб", "остановка", "водитель"]), wtxt[:160])
    p5.locator('nav [data-go="talk"]').click(); wait(p5, 400)
    ttxt = p5.inner_text("#view")
    check("0.4.0: во вкладке «Диалоги» пять диалогов и нет заглушек «Скоро»", all(x in ttxt for x in ["Моя семья", "В магазине", "На улице", "О работе"]) and "Скоро" not in ttxt, ttxt[:200])
    p5.locator('nav [data-go="grammar"]').click(); wait(p5, 400)
    check("0.4.0: вкладка «Грамматика» открывается без ошибок", p5.locator("#view .scr").count() == 1)
    check("0.4.0: нет ошибок JavaScript в уроках 2–5", not errs5, "; ".join(errs5[:3]))
    # 0.4.3: темы «Грамматики» для уроков 2–5 и тест-пропуск для урока 2
    p5.evaluate("window.__app.go('grammar')"); wait(p5, 400)
    gtxt = p5.inner_text("#view")
    check("0.4.3: во вкладке «Грамматика» есть темы уроков 2–5", all(x in gtxt.replace("\u0301", "") for x in ["Мой или моя?", "Дайте, пожалуйста", "Этот, эта, это", "Я работаю"]), gtxt[:300].replace("\n", " / "))
    p5.evaluate("() => { const S = window.__S; S.progress.lessons = { a0_01: { status: 'done', ts: '2026-11-01', score: 1 } }; window.__app.go('home'); }"); wait(p5, 500)
    check("0.4.3: на главной перед уроком 2 предлагается тест-пропуск", p5.locator('[data-act="skipstart"]').count() >= 1)
    p5.locator('[data-act="skipstart"]').first.click(); wait(p5, 700)
    sk = p5.evaluate("() => ({ cur: window.__app.cur, id: window.__C.lessonMeta && window.__C.lessonMeta.id, n: (window.__C.lesson.exercises.skip_test || []).length })")
    check("0.4.3: тест-пропуск урока 2 открывается, в нём 8 вопросов", sk["cur"] == "skiptest" and sk["id"] == "a0_02" and sk["n"] == 8, str(sk))
    check("0.4.3: нет ошибок JavaScript в темах и тесте-пропуске", not errs5, "; ".join(errs5[:3]))
    # 0.4.4: переключатели функций — экран «Пробные функции» скрыт, открывается 5 нажатиями на версию
    p5.evaluate("window.__app.go('settings')"); wait(p5, 300)
    check("0.4.4: «Пробные функции» скрыты в меню «Ещё»", "Пробные функции" not in p5.inner_text("#view"))
    p5.evaluate("window.__app.go('about')"); wait(p5, 300)
    for _ in range(5): p5.locator('[data-act="vertap"]').click(); wait(p5, 80)
    p5.evaluate("window.__app.go('settings')"); wait(p5, 300)
    check("0.4.4: после 5 нажатий на версию появляется строка «Пробные функции»", "Пробные функции" in p5.inner_text("#view"))
    p5.locator('[data-go="setlab"]').click(); wait(p5, 300)
    labtxt = p5.inner_text("#view")
    check("0.4.4: Читалка, Запись голоса и Сохранение показаны как «В разработке», включить нельзя", all(x in labtxt for x in ["Читалка", "Запись голоса", "Сохранение"]) and labtxt.count("В разработке") == 3 and p5.locator('[data-act="setflag"]').count() == 0, labtxt[:200].replace("\n", " / "))
    check("0.4.4: нет ошибок JavaScript на экране «Пробные функции»", not errs5, "; ".join(errs5[:3]))
    # 0.4.5: правки удобства Д-1 и Д-2 (отчёт 5)
    p5.evaluate("async () => { const a = window.__app; await a.useLesson('a0_01'); a.go('lesson'); }"); wait(p5, 600)
    p5.locator("button.w").nth(1).click(); wait(p5, 400)
    p5.locator('[data-act="sheettab"][data-v="why"]').click(); wait(p5, 400)
    xb = p5.evaluate("() => { const b = document.querySelector('.sheet-top [data-act=closesheet]'); if (!b) return null; const r = b.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, h: innerHeight, size: Math.min(r.width, r.height) }; }")
    check("0.4.5 (Д-2): в окне «Почему так?» крестик виден без прокрутки и не меньше 44 точек", bool(xb) and xb["top"] >= 0 and xb["bottom"] <= xb["h"] and xb["size"] >= 44, str(xb))
    p5.evaluate("document.querySelector('.sheet').scrollTop = 400"); wait(p5, 200)
    xb2 = p5.evaluate("() => { const r = document.querySelector('.sheet-top [data-act=closesheet]').getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; }")
    check("0.4.5 (Д-2): после прокрутки окна крестик остаётся на экране", xb2)
    p5.locator('.sheet-top [data-act="closesheet"]').click(); wait(p5, 300)
    check("0.4.5 (Д-2): окно закрывается крестиком", p5.locator(".sheet").count() == 0)
    p5.locator(".btn").filter(has_text="упражнен").first.click(); wait(p5, 500)
    bi = p5.evaluate("() => { const a = window.__app, L = window.__C.lesson, i = L.flow.findIndex(id => (L.exercises.builder || []).some(e => e.id === id)); a.st.ex = Object.assign({}, a.st.ex, { i, fb: null, sel: null, built: [], lb: [], typed: '' }); a.render(false); return i; }"); wait(p5, 300)
    dk = p5.evaluate("() => { const all = document.querySelectorAll('#view [data-act=excheck]').length, inDock = document.querySelectorAll('#view .dock [data-act=excheck]').length; const b = document.querySelector('#view .dock [data-act=excheck]'); const r = b ? b.getBoundingClientRect() : null; return { all, inDock, y: r ? (r.top + r.height / 2) / innerHeight : 0, sec: b ? b.classList.contains('sec') : null }; }")
    check("0.4.5 (Д-1): «Проверить» одна, стоит в нижней панели и залита цветом", bi >= 0 and dk["all"] == 1 and dk["inDock"] == 1 and dk["y"] > 0.8 and dk["sec"] is False, str(dk))
    check("0.4.5: нет ошибок JavaScript после правок удобства", not errs5, "; ".join(errs5[:3]))
    ctx5.close()
    browser.close()

failed = [r for r in results if not r[0]]
for ok, name, info in results:
    print(("PASS " if ok else "FAIL ") + name + (" | " + info if info and not ok else ""))
print(f"итого: {len(results) - len(failed)} из {len(results)}")
sys.exit(1 if failed else 0)
