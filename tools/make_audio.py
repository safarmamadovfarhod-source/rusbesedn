#!/usr/bin/env python3
"""
Озвучка урока через Piper: 4 набора файлов (голос × темп) + тайминги слов для подсветки (D-46).

Запуск (в папке app, на вашем компьютере; Piper в рабочей среде Claude установить нельзя):
    pip install piper-tts
    python -m piper.download_voices ru_RU-irina-medium ru_RU-denis-medium
    python tools/make_audio.py data/lessons/a0_01/lesson.json --mp3
    (так же для b_01, b_02, b_03)

Результат — прямо в папке урока:
    data/lessons/<урок>/audio/f/n/<id>.mp3   женский голос, обычный темп
    data/lessons/<урок>/audio/f/s/<id>.mp3   женский голос, медленно
    data/lessons/<урок>/audio/m/n/<id>.mp3   мужской голос, обычный темп
    data/lessons/<урок>/audio/m/s/<id>.mp3   мужской голос, медленно
    data/lessons/<урок>/audio/<урок>_timings_<голос>_<темп>.json   тайминги слов
Потом: python tools/build_manifest.py (приложение узнает об озвучке и положит её в кэш).

Какой голос у какой фразы:
    реплики диалога — по говорящему (Анна — женский, Руслан — мужской), не зависят от настройки;
    слова, диктанты, Shadowing, реплики пользователя в сценарии — голос, выбранный в настройках.
    Поэтому такие фразы озвучиваются ОБОИМИ голосами; реплики диалога — только своим голосом (оба темпа).

Скрипт не проверялся на реальной установке Piper (в рабочей среде её нет). Параметр замедления
называется --length-scale (1.0 = обычно; больше = медленнее); если ваша версия Piper знает только
--length_scale, скрипт пробует и такое написание. При ошибке пришлите текст ошибки целиком.
Тайминги слов приблизительные (длительность слов считается по отдельному озвучиванию и подгоняется под фразу).
"""
import argparse, json, re, shutil, subprocess, sys, tempfile, wave
from pathlib import Path

ACUTE = "́"
VOICES = {"f": "ru_RU-irina-medium", "m": "ru_RU-denis-medium"}
TEMPOS = {"n": 1.0, "s": 1.35}   # множитель длительности: 1.35 = заметно медленнее


def clean(text):
    return re.sub(r"\s+", " ", text.replace(ACUTE, "")).strip()


def has_letters(tok):
    return re.search(r"[A-Za-zА-Яа-яЁё0-9]", tok) is not None


def collect(lesson):
    """[(id, text, speaker)] speaker: f | m | any. Реплики диалога — по говорящему."""
    items, seen = [], {}
    slot = lesson["scenario"].get("name_slot", {})
    def add(i, text, sp):
        if not i or not text: return
        if slot.get("placeholder"): text = text.replace(slot["placeholder"], slot.get("sample", ""))
        if i in seen:
            if clean(seen[i]) != clean(text): print("ВНИМАНИЕ: id %s повторён с другим текстом: «%s» и «%s»" % (i, seen[i], text))
            return
        seen[i] = text; items.append((i, text, sp))
    for l in lesson["text"]: add(l.get("audio"), l["ru"], l.get("s", "f"))
    for w in lesson["words"]: add(w.get("audio"), w["ru"], "any")
    for s in lesson["scenario"]["turns"]:
        add(s["bot"].get("audio_id"), s["bot"]["ru"], "m")
        for o in s["options"]: add(o.get("audio_id"), o["ru"], "f")      # в сценарии пользователь говорит за Анну
    ex = lesson["exercises"]
    for d in ex.get("dictation", []): add(d.get("audio_id"), d.get("audio"), "any")
    for s in lesson["shadowing"]["items"]: add(s.get("audio"), s["ru"], "any")
    return items


def synth(text, voice, out, data_dir, scale):
    base = [sys.executable, "-m", "piper", "-m", voice, "-f", str(out)]
    if data_dir: base += ["--data-dir", data_dir]
    for flag in ("--length-scale", "--length_scale"):
        cmd = base + ([flag, str(scale)] if scale != 1.0 else []) + ["--", text]
        r = subprocess.run(cmd, capture_output=True, text=True)
        if r.returncode == 0: return
        if scale == 1.0: break
        if "unrecognized" not in (r.stderr or "").lower(): break
    sys.exit("Ошибка Piper:\n" + (r.stderr or r.stdout))


def dur(path):
    with wave.open(str(path), "rb") as w: return w.getnframes() / float(w.getframerate())


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("lesson_json")
    ap.add_argument("--data-dir", default=None)
    ap.add_argument("--mp3", action="store_true", help="сделать mp3 (нужен ffmpeg) и удалить wav")
    ap.add_argument("--only", default="", help="например f_n,m_n — только эти наборы (для проверки)")
    a = ap.parse_args()
    lp = Path(a.lesson_json); lesson = json.loads(lp.read_text(encoding="utf-8")); lid = lesson["meta"]["id"]
    root = lp.parent / "audio"
    if a.mp3 and not shutil.which("ffmpeg"): print("ffmpeg не найден: останутся wav (приложение их тоже понимает)."); a.mp3 = False
    want = set(x for x in a.only.split(",") if x)
    items = collect(lesson); print("фраз в уроке: %d" % len(items))
    with tempfile.TemporaryDirectory() as tmp:
        for v in ("f", "m"):
            for tcode, scale in TEMPOS.items():
                key = v + "_" + tcode
                if want and key not in want: continue
                d = root / v / tcode; d.mkdir(parents=True, exist_ok=True)
                tim = {"lesson_id": lid, "voice": v, "tempo": tcode, "lines": []}
                for i, text, sp in items:
                    if sp in ("f", "m") and sp != v: continue
                    full = d / (i + ".wav"); synth(clean(text), VOICES[v], full, a.data_dir, scale); total = dur(full)
                    disp = text.split(); weights = []
                    for k, w in enumerate(disp):
                        cw = clean(w)
                        if not has_letters(cw): weights.append(0.0); continue
                        wp = Path(tmp) / ("%s_%s_%d.wav" % (key, i, k)); synth(cw, VOICES[v], wp, a.data_dir, scale); weights.append(dur(wp))
                    ws = sum(weights) or 1.0; t0 = 0.0; words = []
                    for dw, wt in zip(disp, weights):
                        dd = wt / ws * total; words.append({"w": dw, "start": round(t0, 3), "end": round(t0 + dd, 3)}); t0 += dd
                    tim["lines"].append({"id": i, "duration": round(total, 3), "words": words})
                    if a.mp3:
                        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(full), "-ac", "1", "-b:a", "64k", str(d / (i + ".mp3"))], check=True); full.unlink()
                    print("готово %s %s (%.2f с)" % (key, i, total))
                (root / ("%s_timings_%s.json" % (lid, key))).write_text(json.dumps(tim, ensure_ascii=False, indent=1), encoding="utf-8")
    print("\nГотово: %s. Дальше: python tools/build_manifest.py" % root)


if __name__ == "__main__":
    main()
