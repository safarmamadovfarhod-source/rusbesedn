#!/usr/bin/env python3
"""Собирает sw.js из sw.template.js (версия = хэш файлов, список = все файлы приложения) и
обновляет в data/courses.json сведения об озвучке уроков.
Запуск из папки app:  python3 tools/build_manifest.py"""
import hashlib, json, pathlib, sys
R = pathlib.Path(__file__).resolve().parent.parent
SKIP_DIRS = {"tests", "tools", "node_modules", ".git", "docs", "audit-experiments"}
SKIP_FILES = {"sw.template.js", "README.md", "sw.js"}
def files():
    out = []
    for p in sorted(R.rglob("*")):
        if not p.is_file() or p.name in SKIP_FILES or p.suffix in (".md", ".py", ".mjs"): continue
        if any(part in SKIP_DIRS for part in p.relative_to(R).parts): continue
        if "audio" in p.relative_to(R).parts and p.suffix in (".wav", ".ogg", ".mp3"):  # в кэш — только один формат (mp3 > ogg > wav)
            adir = next(x for x in p.parents if x.name == "audio")
            best = next((e for e in (".mp3", ".ogg", ".wav") if any(adir.rglob("*" + e))), None)
            if p.suffix != best: continue
        out.append(p)
    return out
# 1) озвучка в courses.json
cj = R / "data/courses.json"; courses = json.loads(cj.read_text(encoding="utf-8"))
for c in courses["courses"]:
    for l in c["lessons"]:
        if "path" not in l: continue
        base = pathlib.Path(l["path"]).parent / "audio"; adir = R / base; l["audio"] = None
        # 4 набора (D-46): audio/<f|m>/<n|s>/<id>.<ext> и тайминги <урок>_timings_<f|m>_<n|s>.json
        ext = next((e for e in ("mp3", "ogg", "wav") if adir.exists() and any(adir.rglob("*." + e))), None)
        if ext:
            sets = {v + "_" + t: str(base / (l["id"] + "_timings_" + v + "_" + t + ".json")) for v in "fm" for t in "ns" if (adir / (l["id"] + "_timings_" + v + "_" + t + ".json")).exists()}
            l["audio"] = {"base": str(base), "ext": ext, "sets": sets}
        ldir = R / pathlib.Path(l["path"]).parent
        l["bytes"] = sum(p.stat().st_size for p in ldir.rglob("*") if p.is_file())
        # 0.3.10: уроки грузятся по требованию. В courses.json — краткая сводка урока (без загрузки самого урока)
        # и «версия» v (хэш файлов урока): она стоит в адресе файла, поэтому изменённый урок скачивается заново, а неизменённый — нет.
        d = json.loads((R / l["path"]).read_text(encoding="utf-8"))
        words = [w for w in d.get("words", []) if w.get("type") != "service"]
        l["sum"] = {"can": [{k: c[k] for k in ("ru", "tg") if k in c} for c in d.get("passport", {}).get("can_do", [])],
                    "scenario": d.get("scenario", {}).get("title", {}), "words": [w["id"] for w in d.get("words", [])], "nw": len(words),
                    "skip": bool(d.get("exercises", {}).get("skip_test"))}  # 0.4.3: у урока есть тест-пропуск
        hv = hashlib.sha1()
        for fp in sorted(x for x in ldir.rglob("*") if x.is_file()): hv.update(fp.relative_to(R).as_posix().encode()); hv.update(fp.read_bytes())
        l["v"] = hv.hexdigest()[:8]
cj.write_text(json.dumps(courses, ensure_ascii=False, indent=1), encoding="utf-8")
# 2) sw.js
fl = files(); h = hashlib.sha1()
for p in fl: h.update(p.relative_to(R).as_posix().encode()); h.update(p.read_bytes())
version = h.hexdigest()[:10]
# 0.3.10: в предварительный кэш идёт только оболочка; уроки и их озвучку сервис-воркер кладёт в отдельный кэш при первом обращении
pre = ["./"] + [p.relative_to(R).as_posix() for p in fl if "lessons" not in p.relative_to(R).parts]
tpl = (R / "sw.template.js").read_text(encoding="utf-8")
(R / "sw.js").write_text(tpl.replace("/*VERSION*/", version).replace("/*PRECACHE*/[]", json.dumps(pre, ensure_ascii=False, indent=1)), encoding="utf-8")
total = sum(p.stat().st_size for p in fl)
shell = sum(p.stat().st_size for p in fl if "lessons" not in p.parts)
print(f"версия {version}; файлов {len(fl)}; всего {total/1024:.0f} КБ; оболочка без уроков {shell/1024:.0f} КБ")
