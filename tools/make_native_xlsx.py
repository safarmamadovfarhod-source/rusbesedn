#!/usr/bin/env python3
"""Собирает полный файл для носителя таджикского языка (задача 3).
Запуск:  python3 tools/make_native_xlsx.py <куда.xlsx> [файл_с_предложениями.json ...]
Листы: «Как работать», «Предложения», «Уроки A», «Уроки B», «Грамматика», «Термины», «Интерфейс».
Файл только читает данные приложения и ничего в них не меняет."""
import json, sys, glob, os, re
from openpyxl import Workbook
from openpyxl.styles import Font, Alignment, PatternFill, Border, Side
from openpyxl.worksheet.datavalidation import DataValidation
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
J = lambda p: json.load(open(os.path.join(ROOT, p), encoding="utf-8"))
SEC = {"meta": "Название урока", "passport": "Паспорт урока", "words": "Слово", "text": "Диалог", "grammar_layer": "Окно «Почему так?»", "rules": "Правило", "traps": "Ловушка",
       "exercises": "Задание", "scenario": "Диалог-тренажёр", "shadowing": "Повторение вслух", "review": "Повторение", "names": "Имена"}
def pairs(o, path, out):
    """Все пары «русский — таджикский» в данных: {ru, tg} и поля X_ru / X_tg."""
    if isinstance(o, dict):
        if isinstance(o.get("ru"), str) and "tg" in o and isinstance(o.get("tg"), str): out.append((path, o["ru"], o["tg"]))
        for k, v in o.items():
            if k.endswith("_tg") and isinstance(v, str): out.append((path + "/" + k[:-3], o.get(k[:-3] + "_ru", "") if isinstance(o.get(k[:-3] + "_ru", ""), str) else "", v))
            elif isinstance(v, (dict, list)): pairs(v, path + "/" + k, out)
    elif isinstance(o, list):
        for i, v in enumerate(o):
            if isinstance(v, (dict, list)): pairs(v, path + "/" + (str(v["id"]) if isinstance(v, dict) and v.get("id") else str(i + 1)), out)
def place(path):
    a = [x for x in path.split("/") if x]
    return (SEC.get(a[0], a[0]) + (" · " + " / ".join(a[1:]) if len(a) > 1 else "")) if a else ""
F = "Arial"; thin = Side(style="thin", color="BBBBBB"); B = Border(left=thin, right=thin, top=thin, bottom=thin)
HF = PatternFill("solid", fgColor="0F6E6E"); YF = PatternFill("solid", fgColor="FFF8D6"); GF = PatternFill("solid", fgColor="F0EFEC")
def sheet(wb, title, intro, head, widths, rows, fill_cols, example=None):
    ws = wb.create_sheet(title); ws["A1"] = intro[0]; ws["A1"].font = Font(name=F, bold=True, size=13); ws["A2"] = intro[1]; ws["A2"].font = Font(name=F, size=10, color="555555")
    ws.merge_cells(start_row=2, start_column=1, end_row=2, end_column=len(head)); ws["A2"].alignment = Alignment(wrap_text=True, vertical="top"); ws.row_dimensions[2].height = 44
    for c, h in enumerate(head, 1):
        x = ws.cell(row=4, column=c, value=h); x.font = Font(name=F, bold=True, color="FFFFFF", size=10); x.fill = HF; x.alignment = Alignment(wrap_text=True, vertical="center"); x.border = B
        ws.column_dimensions[x.column_letter].width = widths[c - 1]
    r = 5
    if example:
        for c, v in enumerate(example, 1):
            x = ws.cell(row=r, column=c, value=v); x.font = Font(name=F, size=10, italic=True, color="777777"); x.alignment = Alignment(wrap_text=True, vertical="top"); x.border = B; x.fill = GF
        r += 1
    for row in rows:
        for c, v in enumerate(row, 1):
            x = ws.cell(row=r, column=c, value=v); x.font = Font(name=F, size=10); x.alignment = Alignment(wrap_text=True, vertical="top"); x.border = B
            if c in fill_cols: x.fill = YF
        r += 1
    ws.freeze_panes = "A5"; ws.auto_filter.ref = f"A4:{ws.cell(row=4, column=len(head)).column_letter}{max(r - 1, 5)}"
    dv = DataValidation(type="list", formula1='"да,нет"', allow_blank=True); ws.add_data_validation(dv)
    col = ws.cell(row=4, column=min(fill_cols)).column_letter; dv.add(f"{col}5:{col}{max(r, 6)}")
    return ws, len(rows)
def main():
    out = sys.argv[1]; sugg = []
    for p in sys.argv[2:]: sugg += json.load(open(p, encoding="utf-8"))
    wb = Workbook(); ws0 = wb.active; ws0.title = "Как работать"; counts = {}
    HEAD = ["№", "Урок / файл", "Место", "По-русски", "По-таджикски (сейчас в приложении)", "Верно? (да / нет)", "Как правильно", "Замечание"]; W = [6, 12, 34, 52, 52, 12, 46, 30]
    EX = ["пример", "a0_02", "Слово · a0_02_w01", "семья́", "оила", "да", "", ""]
    def lesson_rows(lids):
        rows = []
        for lid in lids:
            L = J(f"data/lessons/{lid}/lesson.json"); ps = []; pairs(L, "", ps)
            for path, ru, tg in ps: rows.append([len(rows) + 1, lid, place(path), ru, tg, "", "", ""])
        return rows
    S_HEAD = ["№", "Где", "Сейчас в приложении", "Что предлагается", "Почему", "Насколько уверен проверяющий", "Кто предложил", "Согласны? (да / нет)", "Как правильно", "Замечание"]
    S_rows = [[i + 1, s.get("id", ""), s.get("line", ""), (("«" + s["orig"] + "» → «" + s["fix"] + "»") if s.get("orig") and s.get("fix") else (s.get("fix") or s.get("orig") or "")), s.get("why", ""), s.get("conf", ""), s.get("who", ""), "", "", ""] for i, s in enumerate(sugg)]
    _, counts["Предложения"] = sheet(wb, "Предложения", ("Предложения и вопросы по таджикскому тексту", "Здесь собрано то, что заметили проверяющие-программы и авторы черновиков. Ничего из этого в приложение не внесено. В столбце «Согласны?» поставьте «да» или «нет»; если «нет» или есть лучший вариант — напишите его в «Как правильно»."),
        S_HEAD, [6, 30, 50, 50, 50, 16, 14, 12, 44, 30], S_rows, {8, 9, 10}, ["пример", "L/a0_03/gl/g_sto/ex_tg", "Нон сад рубл меистад", "«меистад» → «меарзад»", "«меистад» — «стоит на ногах», а здесь речь о цене", "уверен", "лингвист", "да", "", ""])
    _, counts["Уроки A"] = sheet(wb, "Уроки A", ("Уроки пути A (с нуля): все таджикские тексты", "Таджикский текст ученик видит как перевод и как объяснение. Русские слова в кавычках «…» и знаки ударения менять не нужно. Проверьте каждую строку: «да» — всё верно; «нет» — напишите правильный вариант."), HEAD, W, lesson_rows(["a0_01", "a0_02", "a0_03", "a0_04", "a0_05"]), {6, 7, 8}, EX)
    _, counts["Уроки B"] = sheet(wb, "Уроки B", ("Уроки пути B (продолжающие): таджикские объяснения", "В пути B таджикские объяснения — новые черновики (версия 0.4.3), раньше их не было. Диалоги пути B на таджикский не переводятся."), HEAD, W, lesson_rows(["b_01", "b_02", "b_03"]), {6, 7, 8}, EX)
    g = J("data/grammar.json"); rows = []
    for t in g["topics"]:
        ps = []; pairs(t, "", ps)
        for path, ru, tg in ps: rows.append([len(rows) + 1, "тема " + t["id"] + " (урок " + str(t.get("lesson")) + ")", path.strip("/").replace("/", " / "), ru, tg, "", "", ""])
    _, counts["Грамматика"] = sheet(wb, "Грамматика", ("Вкладка «Грамматика»: темы", "title — заголовок, short — коротко, rule — правило, compare — сравнение с таджикским, examples — примеры, mistakes — типичные ошибки, quiz — вопросы теста."), HEAD, W, rows, {6, 7, 8})
    gl = J("data/glossary.json"); rows = []
    for t in gl["terms"]:
        ps = []; pairs(t, "", ps)
        for path, ru, tg in ps: rows.append([len(rows) + 1, "термин " + t["id"], path.strip("/").replace("/", " / "), ru, tg, "", "", ""])
    ps = []; pairs(gl.get("groups", []), "", ps)
    for path, ru, tg in ps: rows.append([len(rows) + 1, "группа", path.strip("/"), ru, tg, "", "", ""])
    _, counts["Термины"] = sheet(wb, "Термины", ("Словарь терминов", "Названия грамматических терминов должны быть такими, как в таджикской школе. Если термин назван не так — напишите принятое название."), HEAD, W, rows, {6, 7, 8})
    d = J("data/i18n.json"); rows = [[i + 1, "интерфейс", k, d["ru"].get(k, ""), d["tg"].get(k, ""), "", "", ""] for i, k in enumerate(d["ru"].keys())]
    _, counts["Интерфейс"] = sheet(wb, "Интерфейс", ("Надписи приложения: кнопки, заголовки, сообщения", "Слова в фигурных скобках, например {n} или {v}, — это места для чисел и имён; их нужно оставить как есть."), HEAD, W, rows, {6, 7, 8})
    ws0.column_dimensions["A"].width = 110
    info = ["Проверка таджикского текста приложения «Русский собеседник»", "", "Приложение учит русскому языку людей, чей родной язык — таджикский. Таджикский текст в нём написан программой и ещё не проверен человеком. Пожалуйста, проверьте его.",
            "", "Как работать", "1. На каждом листе жёлтые столбцы — для вас. Остальные столбцы менять не нужно.", "2. В столбце «Верно?» (или «Согласны?») выберите «да» или «нет».", "3. Если «нет» — напишите правильный вариант в столбце «Как правильно».",
            "4. Русские слова в кавычках «…» и знаки ударения (чёрточка над гласной: зову́т) оставляйте как есть.", "5. Серая строка сверху на некоторых листах — пример заполнения.", "6. Начать лучше с листа «Предложения»: там собраны места, где проверяющие-программы уже сомневаются.",
            "", "Листы и число строк"] + [f"   {k}: {v}" for k, v in counts.items()] + [f"   Всего: {sum(counts.values())}", "", "Название приложения по-таджикски — «Ҳамсуҳбати русӣ». Оно тоже ждёт вашей проверки (лист «Предложения», первая строка).", "", "Версия приложения: " + re.search(r'APP_VERSION: "([^"]+)"', open(os.path.join(ROOT, "js/config.js"), encoding="utf-8").read()).group(1)]
    for i, tx in enumerate(info, 1):
        c = ws0.cell(row=i, column=1, value=tx); c.font = Font(name=F, size=14 if i == 1 else 11, bold=(i == 1 or tx in ("Как работать", "Листы и число строк"))); c.alignment = Alignment(wrap_text=True, vertical="top")
    wb.save(out); print(json.dumps(counts, ensure_ascii=False), "всего", sum(counts.values()))
if __name__ == "__main__": main()
