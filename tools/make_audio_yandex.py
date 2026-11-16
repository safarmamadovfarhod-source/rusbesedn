#!/usr/bin/env python3
"""
Озвучка уроков через Yandex SpeechKit (API v3, регион Казахстан). Голоса: Лера (женский, «дружелюбный»)
и Кирилл (мужской, «радостный» = good) — выбор автора, 24.10.2026.

Запуск на компьютере автора (нужен только Python 3, без дополнительных библиотек):
    python make_audio_yandex.py --proba            # 4 файла для проверки (стоит ~4 ₸)
    python make_audio_yandex.py                    # все уроки из папки lessons рядом со скриптом

Ключ API: файл kluch.txt рядом со скриптом, переменная YANDEX_API_KEY или ввод при запуске. Скрипт ключ никуда не отправляет, кроме Яндекса.

Результат — та же раскладка, что у tools/make_audio.py (приложение её уже понимает):
    lessons/<урок>/audio/<f|m>/<n|s>/<id>.mp3  и  lessons/<урок>/audio/<урок>_timings_<голос>_<темп>.json
и архив ozvuchka.zip со всеми папками audio — его забирает Claude и кладёт в приложение.

Ударения: знак ударения из текста (а́) превращается в разметку SpeechKit «+а». Тайминги слов для подсветки —
приблизительные: длительность фразы делится между словами по числу гласных.
"""
import argparse, base64, getpass, json, os, re, sys, time, urllib.request, urllib.error, zipfile
from pathlib import Path

URL = "https://tts.api.ml.yandexcloud.kz/tts/v3/utteranceSynthesis"
VOICES = {"f": ("lera", "friendly"), "m": ("kirill", "good")}
TEMPOS = {"n": 1.0, "s": 0.75}
ACUTE = "́"
VOW = "аеёиоуыэюяАЕЁИОУЫЭЮЯ"
HERE = Path(__file__).resolve().parent


class _Tee:
    """Всё, что скрипт пишет в окно, дублируется в log.txt рядом со скриптом (ключ туда не попадает)."""
    def __init__(self, stream, f): self.s, self.f = stream, f
    def write(self, x): self.s.write(x); self.f.write(x); self.f.flush()
    def flush(self): self.s.flush(); self.f.flush()
_LOG = open(HERE / "log.txt", "w", encoding="utf-8")
sys.stdout, sys.stderr = _Tee(sys.stdout, _LOG), _Tee(sys.stderr, _LOG)


def plus_stress(text):
    """«зову́т» → «зов+ут» (SpeechKit: «+» перед ударной гласной)."""
    out = []
    for ch in text:
        if ch == ACUTE and out and out[-1] in VOW:
            out.insert(len(out) - 1, "+")
        elif ch != ACUTE:
            out.append(ch)
    return "".join(out)


def synth(key, text, voice, role, speed, tries=4):
    hints = [{"voice": voice}]
    if role: hints.append({"role": role})
    if speed != 1.0: hints.append({"speed": speed})
    body = json.dumps({"text": text, "hints": hints, "outputAudioSpec": {"containerAudio": {"containerAudioType": "MP3"}}}).encode("utf-8")
    for k in range(tries):
        req = urllib.request.Request(URL, data=body, headers={"Authorization": "Api-Key " + key, "Content-Type": "application/json"})
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                raw = r.read().decode("utf-8")
            audio = b""
            for line in raw.splitlines():
                line = line.strip()
                if not line: continue
                obj = json.loads(line)
                if "error" in obj: raise RuntimeError(json.dumps(obj["error"], ensure_ascii=False))
                ch = (obj.get("result") or {}).get("audioChunk") or {}
                if ch.get("data"): audio += base64.b64decode(ch["data"])
            if not audio: raise RuntimeError("пустой ответ: " + raw[:300])
            return audio
        except urllib.error.HTTPError as e:
            msg = e.read().decode("utf-8", "replace")[:500]
            if e.code in (401, 403): sys.exit("Ключ не подошёл (%d): %s\nПроверьте ключ и роль ai.speechkit-tts.user." % (e.code, msg))
            if e.code == 400: sys.exit("Запрос отклонён (400): %s\nТекст: %s" % (msg, text))
            err = "HTTP %d %s" % (e.code, msg)
        except Exception as e:  # сеть, таймаут
            err = str(e)
        time.sleep(2 * (k + 1))
    sys.exit("Не удалось озвучить «%s»: %s" % (text, err))


# длительность MP3 — по заголовкам кадров (без дополнительных библиотек)
BR = {1: [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320], 2: [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160]}
SR = {3: [44100, 48000, 32000], 2: [22050, 24000, 16000], 0: [11025, 12000, 8000]}
def mp3_duration(b):
    i, dur = 0, 0.0
    if b[:3] == b"ID3": i = 10 + ((b[6] & 0x7f) << 21 | (b[7] & 0x7f) << 14 | (b[8] & 0x7f) << 7 | (b[9] & 0x7f))
    while i + 4 <= len(b):
        if b[i] != 0xFF or (b[i + 1] & 0xE0) != 0xE0: i += 1; continue
        ver = (b[i + 1] >> 3) & 3; br_i = (b[i + 2] >> 4) & 15; sr_i = (b[i + 2] >> 2) & 3; pad = (b[i + 2] >> 1) & 1
        if ver == 1 or br_i in (0, 15) or sr_i == 3: i += 1; continue
        sr = SR[ver][sr_i]; br = BR[1 if ver == 3 else 2][br_i] * 1000
        spf = 1152 if ver == 3 else 576
        size = (144 if ver == 3 else 72) * br // sr + pad
        dur += spf / sr; i += max(size, 1)
    return dur


def word_timings(text, total):
    disp = text.split()
    w = [max(1, sum(c in VOW for c in t.replace(ACUTE, ""))) if re.search(r"[А-Яа-яЁё0-9A-Za-z]", t) else 0 for t in disp]
    lead, tail = 0.12, 0.15                       # тишина в начале и в конце
    span = max(0.1, total - lead - tail); s = sum(w) or 1; t0 = lead; out = []
    for d, k in zip(disp, w):
        dd = k / s * span; out.append({"w": d, "start": round(t0, 3), "end": round(t0 + dd, 3)}); t0 += dd
    return out


def collect(lesson):
    """[(id, текст, голос f|m|any)] — как в make_audio.py: реплики по говорящему, остальное обоими голосами."""
    items, seen = [], set()
    slot = lesson.get("scenario", {}).get("name_slot", {})
    def add(i, text, sp):
        if not i or not text or i in seen: return
        if slot.get("placeholder"): text = text.replace(slot["placeholder"], slot.get("sample", ""))
        seen.add(i); items.append((i, text, sp))
    for l in lesson["text"]: add(l.get("audio"), l["ru"], l.get("s", "f"))
    for w in lesson["words"]: add(w.get("audio"), w.get("say") or w["ru"], "any")   # say: вместо слова звучит пример (предлог «в» → «в магази́не»)
    for s in lesson["scenario"]["turns"]:
        add(s["bot"].get("audio_id"), s["bot"]["ru"], "m")
        for o in s["options"]: add(o.get("audio_id"), o["ru"], "f")
    for d in lesson["exercises"].get("dictation", []): add(d.get("audio_id"), d.get("audio"), "any")
    for s in lesson["shadowing"]["items"]: add(s.get("audio"), s["ru"], "any")
    return items


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--proba", action="store_true", help="только 4 файла для проверки")
    ap.add_argument("--lessons", default=str(HERE / "lessons"))
    a = ap.parse_args()
    kf = HERE / "kluch.txt"
    key = os.environ.get("YANDEX_API_KEY") or (kf.read_text(encoding="utf-8-sig").strip() if kf.exists() else "")
    if not key:
        print("Вставьте API-ключ: Ctrl+V или правая кнопка мыши, затем Enter.")
        key = input("Ключ: ").strip()
    if not key: sys.exit("Ключ не введён. Можно положить его в файл kluch.txt в этой папке и запустить снова.")
    print("Ключ принят (%d символов)." % len(key))
    if a.proba:
        d = HERE / "proba"; d.mkdir(exist_ok=True)
        texts = {"f": "Здра́вствуйте! Меня́ зову́т Шаро́ра. Вчера́ я прочита́ла всю кни́гу за два часа́.",
                 "m": "Здра́вствуйте! Меня́ зову́т Мануче́хр. О́чень прия́тно. Как ва́ши дела́?"}
        for v, (voice, role) in VOICES.items():
            for t, sp in TEMPOS.items():
                p = d / ("%s_%s.mp3" % (voice, "obychno" if t == "n" else "medlenno"))
                p.write_bytes(synth(key, plus_stress(texts[v]), voice, role, sp)); print("готово:", p.name)
        print("\nПроба готова: папка", d); return
    lroot = Path(a.lessons); files = sorted(lroot.glob("*/lesson.json"))
    if not files: sys.exit("Не найдены уроки в " + str(lroot))
    total_req = 0
    for lp in files:
        lesson = json.loads(lp.read_text(encoding="utf-8")); lid = lesson["meta"]["id"]; root = lp.parent / "audio"
        items = collect(lesson); print("\nУрок %s: фраз %d" % (lid, len(items)))
        for v, (voice, role) in VOICES.items():
            for t, sp in TEMPOS.items():
                d = root / v / t; d.mkdir(parents=True, exist_ok=True)
                tim = {"lesson_id": lid, "voice": v, "tempo": t, "lines": []}
                for i, text, who in items:
                    if who in ("f", "m") and who != v: continue
                    p = d / (i + ".mp3")
                    if p.exists() and p.stat().st_size > 0: audio = p.read_bytes()      # уже озвучено (повторный запуск)
                    else: audio = synth(key, plus_stress(text), voice, role, sp); p.write_bytes(audio); total_req += 1
                    du = mp3_duration(audio)
                    tim["lines"].append({"id": i, "duration": round(du, 3), "words": word_timings(text, du)})
                    print("  %s_%s %s (%.1f с)" % (v, t, i, du))
                (root / ("%s_timings_%s_%s.json" % (lid, v, t))).write_text(json.dumps(tim, ensure_ascii=False, indent=1), encoding="utf-8")
    z = HERE / "ozvuchka.zip"
    with zipfile.ZipFile(z, "w", zipfile.ZIP_STORED) as zf:
        for lp in files:
            for f in (lp.parent / "audio").rglob("*"):
                if f.is_file(): zf.write(f, f.relative_to(lroot.parent))
    print("\nГотово. Новых запросов: %d (≈%d ₸). Архив: %s" % (total_req, round(total_req * 1.08), z))


if __name__ == "__main__":
    try: main()
    finally:
        if os.name == "nt": input("\nНажмите Enter, чтобы закрыть окно...")
