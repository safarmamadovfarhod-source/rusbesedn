#!/usr/bin/env python3
"""Проверка файла урока без программирования.
Запуск:  python3 tools/validate_lesson.py data/lessons/a0_01/lesson.json
Выход 0 — ошибок нет; 1 — есть ошибки (список выведен). Предупреждения не блокируют."""
import json, re, sys, pathlib
ERR, WARN = [], []
def e(m): ERR.append(m)
def w(m): WARN.append(m)
def main(path):
    p = pathlib.Path(path)
    try: L = json.loads(p.read_text(encoding="utf-8"))
    except Exception as ex: print("НЕ ЧИТАЕТСЯ JSON:", ex); return 1
    for k in ("meta", "passport", "words", "text", "grammar_layer", "scenario", "exercises", "flow", "shadowing", "review", "access"):
        if k not in L: e("нет раздела: " + k)
    if ERR: return report()
    B = L["meta"].get("track") == "b"  # путь «Знаю русский»: таджикских полей нет
    ids = set()
    def uniq(i, where):
        if i in ids: e("повтор id %s (%s)" % (i, where))
        ids.add(i)
    words = {x["id"]: x for x in L["words"]}
    for x in L["words"]:
        uniq(x["id"], "слово")
        for f in (("ru", "gloss_ru", "audio") if B else ("ru", "tg", "gloss_ru", "audio")):
            if not x.get(f): e("слово %s: пусто поле %s" % (x["id"], f))
        if x.get("type") != "service" and x.get("ru") and re.search(r"[аеёиоуыэюя]", x["ru"].replace("́", ""), re.I):
            syl = len(re.findall(r"[аеёиоуыэюя]", x["ru"], re.I))
            if syl > 1 and "́" not in x["ru"] and "ё" not in x["ru"].lower(): e("слово %s: нет ударения в «%s»" % (x["id"], x["ru"]))
    gids = {g["id"] for g in L["grammar_layer"]}
    for g in L["grammar_layer"]:
        uniq(g["id"], "грамматика")
        for f in (("word", "why_ru") if B else ("word", "why_ru", "why_tg")):
            if not g.get(f): e("разбор %s: пусто %s" % (g["id"], f))
    audio_ids = set()
    for ln in L["text"]:
        uniq(ln["id"], "реплика")
        audio_ids.add(ln.get("audio"))
        if not ln.get("ru") or (not B and not ln.get("tg")): e("реплика %s: нет ru/tg" % ln["id"])
        for g in ln.get("grammar", []):
            if g not in gids: e("реплика %s: неизвестный разбор %s" % (ln["id"], g))
    ex = L["exercises"]; exids = set()
    for kind in ("truefalse", "choice", "builder", "dictation", "pictures", "meaning", "free"):
        items = ex.get(kind, []); items = [items] if isinstance(items, dict) else items
        for q in items:
            if q["id"] in exids: e("повтор упражнения " + q["id"])
            exids.add(q["id"])
            if kind == "choice" and not (0 <= q.get("answer", -1) < len(q.get("options", []))): e("%s: ответ вне вариантов" % q["id"])
            if kind == "builder" and not set(q["answer"].split()) <= set(q.get("ru_tokens", q.get("tokens", []))): e("%s: в ответе есть слова, которых нет среди карточек" % q["id"])
            if kind in ("pictures", "meaning") and (q["word"] not in q.get("options", []) or any(o not in words for o in q.get("options", []))): e("%s: картинка ссылается на неизвестное слово" % q["id"])
            if kind in ("truefalse", "choice") and not (q.get("expl_ru") or q.get("fb_ru")) : w("%s: нет объяснения" % q["id"])
            if q.get("audio_id"): audio_ids.add(q["audio_id"])
    for f in L["flow"]:
        if f not in exids: e("flow: нет упражнения " + f)
    st = ex.get("skip_test", [])
    if not B and len(st) != 8: w("в тесте на пропуск %d вопросов (ожидалось 8)" % len(st))
    for q in st:
        if q["type"] == "choice" and not (0 <= q["answer"] < len(q["options"])): e("skip %s: ответ вне вариантов" % q["id"])
    for s in L["shadowing"]["items"]:
        audio_ids.add(s.get("audio"))
        if not s.get("hint_ru") or (not B and not s.get("hint_tg")): e("shadowing %s: нет подсказки" % s["id"])
    sc = L["scenario"]
    for t in sc["turns"]:
        if not any(o["q"] == "best" for o in t["options"]): e("сценарий %s: нет лучшего ответа" % t["id"])
        if not any(o["q"] == "wrong" for o in t["options"]): w("сценарий %s: нет неверного варианта" % t["id"])
    if B:
        if not L.get("rules"): w("нет раздела rules (правила)")
        if not L.get("traps"): w("нет раздела traps (частые ошибки)")
    for g in L["grammar_layer"]:  # формат «Почему так?» (D-48): форма, почему так, связь, пример
        for f in (("form_ru", "why_ru", "link_ru", "ex_ru") if B else ("form_ru", "why_ru", "link_ru", "ex_ru", "form_tg", "why_tg", "link_tg", "ex_tg")):
            if not g.get(f): e("разбор %s: нет поля %s (новый формат «Почему так?»)" % (g["id"], f))
        toks = g.get("tokens") or [re.sub(r"[^a-zа-я]", "", g["word"].replace("\u0301", "").lower().replace("ё", "е"))]
        alltxt = {re.sub(r"[^a-zа-я]", "", x.replace("\u0301", "").lower().replace("ё", "е")) for ln in L["text"] for x in ln["ru"].split()}
        if not any(tk in alltxt for tk in toks) and not g["id"].startswith("g_anna"): w("разбор %s: ни одно слово-ключ не найдено в тексте (нажатие на слово не откроет разбор)" % g["id"])
    for wid in L["review"]["words"]:
        if wid not in words: e("повторение: нет слова " + wid)
    if not B and L["meta"].get("tg_status") != "reviewed": w("таджикские тексты не проверены носителем (tg_status=%s)" % L["meta"].get("tg_status"))
    if L["meta"].get("ru_status") != "reviewed": w("русские тексты не проверены методистом (ru_status=%s)" % L["meta"].get("ru_status"))
    ad = p.parent / "audio"
    if ad.exists():
        have = {f.stem for f in ad.iterdir() if f.suffix in (".mp3", ".ogg", ".wav")}
        miss = sorted(x for x in audio_ids if x and x not in have)
        if miss: w("нет аудиофайлов для: " + ", ".join(miss))
    else: w("папки audio нет: приложение использует голос устройства («демо-голос»)")
    for t in re.findall(r"[А-Яа-я]+[a-zA-Z]|[a-zA-Z]+[А-Яа-я]", json.dumps(L, ensure_ascii=False)): w("смесь латиницы и кириллицы в слове: " + t)
    return report()
def report():
    for m in ERR: print("ОШИБКА:", m)
    for m in WARN: print("предупреждение:", m)
    print("итого: ошибок %d, предупреждений %d" % (len(ERR), len(WARN)))
    return 1 if ERR else 0
if __name__ == "__main__": sys.exit(main(sys.argv[1] if len(sys.argv) > 1 else "data/lessons/a0_01/lesson.json"))
