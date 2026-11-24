"""MINIATURE narration voice: Fish REST, single-speaker model (default s2.1-pro; drama-3 is for multi-speaker dialogue),
Stickzy voice (same reference as dialogue's Leo); key never printed. Emotion cues are S2 bracket style: [warm], [dry].
Same engine and settings as dialogue/fish/voice_ep.py, but for one narrator whose lines are anchored to picture times.

Script: samples/obj3d/films/<film>/script.md, lines above "#end":
    NARR (emotion) @12.5 [shows: excavator|everGiven]: text
      @t     = earliest start in the film (s); omit to follow the previous line
      shows  = REQUIRED subject name(s) registered in the page (subjects.js); any one must be readable on screen
               for >= 60% of the spoken line, checked by `node render.mjs lines <page> <film>`
Usage: python -I voice.py <film> tts|reroll N [N..]|build
  tts    : one Fish call per line (cached) -> films/<film>/take/L<n>.mp3
  reroll : redo line N
  build  : trim + 0.85 s gap cap per line, tempo (script header "tempo: 1.3", default 1.3 like dialogue),
           place each line at max(anchor, prev_end + 0.25) -> films/<film>/voice.wav (film length),
           words.json (faster-whisper word times on the final track), lines.json (start/end per line + overrun warnings)
"""
import sys, re, json, subprocess, urllib.request, urllib.error, wave
from pathlib import Path
import numpy as np

ROOT = Path(__file__).resolve().parents[3]
F = Path(__file__).resolve().parents[1] / "films" / sys.argv[1]; cmd = sys.argv[2]
TK = F / "take"; TK.mkdir(parents=True, exist_ok=True)
STICKZY = "55046bd7267d4a618380d1e8f93a056a"
SR = 48000; MAXGAP, TH, GAP = 0.85, 10 ** (-38 / 20), 0.25
src = (F / "script.md").read_text(encoding="utf8")
MODEL = (re.search(r"^model:\s*(\S+)", src, re.M) or [0, "s2.1-pro"])[1]
TEMPO = float((re.search(r"^tempo:\s*([\d.]+)", src, re.M) or [0, "1.3"])[1])
FILM_T = float((re.search(r"^length:\s*([\d.]+)", src, re.M) or [0, "0"])[1])
GAP = float((re.search(r"^gap:\s*([\d.]+)", src, re.M) or [0, GAP])[1])          # pause between lines (default 0.25 s)
CHGAP = float((re.search(r"^chgap:\s*([\d.]+)", src, re.M) or [0, GAP])[1])      # pause before a line that follows a "#ch" marker
L, CH, chnext = [], set(), False
for l in src.split("#end")[0].splitlines():
    if l.strip().startswith("#ch"): chnext = True; continue
    m = re.match(r"NARR \(([^)]*)\)(?: @([\d.]+))?(?: \[shows: ([^\]]+)\])?: (.+)", l.strip())
    if m and chnext: CH.add(len(L) + 1); chnext = False
    if m: L.append((m[1], float(m[2]) if m[2] else None, re.sub(r"\s*\{[^}]*\}", "", m[4]).strip(), [x.strip() for x in (m[3] or "").split("|") if x.strip()]))
assert L, "no NARR lines"


def key():
    for l in (ROOT / ".vendor-assets" / ".env").read_text().splitlines():
        if l.startswith("FISH_API_KEY="): return l.split("=", 1)[1].strip().strip('"')


def tts(txt, path):
    body = {"text": txt, "reference_id": STICKZY, "format": "mp3", "mp3_bitrate": 192, "latency": "normal"}
    req = urllib.request.Request("https://api.fish.audio/v1/tts", data=json.dumps(body).encode(),
                                 headers={"Authorization": "Bearer " + key(), "Content-Type": "application/json", "model": MODEL})
    try: a = urllib.request.urlopen(req, timeout=300).read()
    except urllib.error.HTTPError as e: print("HTTP", e.code, e.read()[:300]); sys.exit(1)
    path.write_bytes(a); print(path.name, MODEL, len(txt.encode()), "B ->", len(a), "B audio")


def asr(p):
    from faster_whisper import WhisperModel
    m = WhisperModel("small", device="cpu", compute_type="int8")
    x = np.frombuffer(subprocess.run(["ffmpeg", "-v", "error", "-i", str(p), "-ac", "1", "-ar", "16000", "-f", "f32le", "-"], capture_output=True).stdout, dtype="<f4")
    seg, _ = m.transcribe(x, language="en", word_timestamps=True, vad_filter=True)   # VAD on: the film-length track has long silences where whisper hallucinates
    return [(round(w.start, 2), round(w.end, 2), w.word.strip()) for s in seg for w in s.words]


def load(p, af=None):
    a = ["ffmpeg", "-v", "error", "-i", str(p)] + (["-filter:a", af] if af else []) + ["-ac", "1", "-ar", str(SR), "-f", "f32le", "-"]
    return np.frombuffer(subprocess.run(a, capture_output=True, check=True).stdout, dtype="<f4").copy()


def tighten(x):
    win = int(0.01 * SR); n = len(x) // win
    env = np.sqrt((x[:n * win].reshape(n, win) ** 2).mean(1)); sil = env < TH; out = []; i = 0
    while i < n:
        j = i
        while j < n and sil[j] == sil[i]: j += 1
        seg = x[i * win:j * win]
        if sil[i]: seg = seg[:min(len(seg), int(MAXGAP * SR))]
        out.append(seg); i = j
    out.append(x[n * win:]); return np.concatenate(out)


def trim(x):
    idx = np.where(np.abs(x) > TH)[0]; return x[max(0, idx[0] - int(0.02 * SR)):idx[-1] + int(0.06 * SR)]


if cmd == "tts":
    for n, (emo, at, t, shows) in enumerate(L, 1):
        p = TK / f"L{n}.mp3"
        if not p.exists(): tts(f"[{emo}] {t}", p)
elif cmd == "reroll":
    for n in map(int, sys.argv[3:]):
        emo, at, t, shows = L[n - 1]; tts(f"[{emo}] {t}", TK / f"L{n}.mp3")
elif cmd == "build":
    # pronunciation check per take: every long script word must appear (fuzzy) in that take's ASR; else re-roll / respell
    import difflib
    bad = []
    for n, (emo, at, t, shows) in enumerate(L, 1):
        raw = asr(TK / f"L{n}.mp3"); heard = [re.sub(r"[^a-z]", "", w[2].lower()) for w in raw]
        NUM = set("three seven eight hundred thousand million twenty thirty forty fifty sixty seventy eighty ninety twelve eleven fifteen first second third ninth percent fourth fifth sixth seventh eighth tenth eleventh twelfth thirteenth fourteenth fifteenth sixteenth seventeenth eighteenth nineteenth twentieth thirtieth".split())   # number words ASR writes as digits (8th)
        if any(re.search(r"[\d$%]", w[2]) for w in raw):   # ASR wrote numbers as digits ("$9.6", "1992"): number words count as heard
            NUM |= set("thirteen fourteen sixteen seventeen eighteen nineteen point dollar dollars billion".split())
        SOUNDALIKE = {"queue": "q", "chauk": "choc", "khunjerab": "conjurab", "junior": "jr", "saint": "st", "sater": "seder"}   # ASR writes these differently even when spoken right
        miss = [w for w in re.findall(r"[a-z]{5,}", t.lower()) if w not in NUM and SOUNDALIKE.get(w) not in heard and not difflib.get_close_matches(w, heard, 1, 0.7)]
        if miss: bad.append(n); print(f"PRONUNCIATION? L{n}: {miss} | heard: {' '.join(heard)}")
    if bad and "--force" not in sys.argv: sys.exit(f"stop: lines {bad} may be mispronounced -> respell in script.md or `reroll`, or add --force")
    segs, info, cur = [], [], 0.0
    for n, (emo, at, t, shows) in enumerate(L, 1):
        x = trim(tighten(load(TK / f"L{n}.mp3")))
        tmp = TK / f"_l{n}.f32"; x.astype("<f4").tofile(tmp)
        y = np.frombuffer(subprocess.run(["ffmpeg", "-v", "error", "-f", "f32le", "-ar", str(SR), "-ac", "1", "-i", str(tmp), "-filter:a", f"atempo={TEMPO}",
                                          "-f", "f32le", "-"], capture_output=True, check=True).stdout, dtype="<f4").copy(); tmp.unlink()
        start = max(at if at is not None else 0.0, cur + ((CHGAP if n in CH else GAP) if n > 1 else 0.0))
        over = round(start - at, 2) if at is not None and start - at > 0.3 else 0
        segs.append((start, y)); cur = start + len(y) / SR
        info.append(dict(n=n, shows=shows, anchor=at, start=round(start, 2), end=round(cur, 2), overrun=over, text=t))
        print(f"L{n:2d} @{start:6.2f}-{cur:6.2f}{'  OVERRUN +%.2fs past anchor' % over if over else ''} | {t}")
    T = max(FILM_T, cur + 0.5); v = np.zeros(int(T * SR), np.float32)
    for s, y in segs: a = int(s * SR); v[a:a + len(y)] += y[:len(v) - a]
    v = v / np.max(np.abs(v)) * 0.89
    with wave.open(str(F / "voice.wav"), "wb") as wv:
        wv.setnchannels(1); wv.setsampwidth(2); wv.setframerate(SR); wv.writeframes((v * 32767).astype("<i2").tobytes())
    json.dump(info, open(F / "lines.json", "w"), indent=1)
    w = asr(F / "voice.wav"); json.dump(w, open(F / "words.json", "w"))
    sp = sum(i["end"] - i["start"] for i in info); nw = sum(len(i["text"].split()) for i in info)
    print(f"voice.wav {T:.1f} s | speech {sp:.1f} s, {nw} words, {nw / sp * 60:.0f} wpm | tempo {TEMPO} | asr words {len(w)} | overruns {[i['n'] for i in info if i['overrun']]}")
elif cmd == "alt":
    # channel alternate of the film's LAST line (variants.mjs): python voice.py <film> alt <channel> [--reroll]
    #   reads films/<film>/channels.json {"<channel>": {"name", "line": "NARR (emo): text"}}; one Fish call (cached as take/alt_<channel>.mp3),
    #   ASR check that the channel name is heard as its separate words in order, then the same trim/tighten/tempo as build and the
    #   gain voice.wav applied to the main last line -> take/alt_<channel>.wav (48 kHz mono, ready to drop in) + take/alt_<channel>.json
    import difflib
    tag = sys.argv[3]; CHJ = json.load(open(F / "channels.json", encoding="utf8")); ent = CHJ[tag]
    m = re.match(r"NARR \(([^)]*)\)(?: @([\d.]+))?(?: \[shows: ([^\]]+)\])?: (.+)", ent["line"].strip()); assert m, "bad channel line: " + ent["line"]
    emo, txt = m[1], re.sub(r"\s*\{[^}]*\}", "", m[4]).strip(); p = TK / f"alt_{tag}.mp3"
    pt = TK / f"alt_{tag}.txt"  # the cached take is only valid for the exact text it was made from
    stale = not pt.exists() or pt.read_text(encoding="utf8") != f"[{emo}] {txt}"
    if not p.exists() or stale or "--reroll" in sys.argv:
        tts(f"[{emo}] {txt}", p); pt.write_text(f"[{emo}] {txt}", encoding="utf8")
    raw = asr(p); heard = [re.sub(r"[^a-z]", "", w[2].lower()) for w in raw]
    name = [re.sub(r"[^a-z]", "", w.lower()) for w in ent["name"].split()]
    miss = [w for w in re.findall(r"[a-z]{5,}", txt.lower()) if not difflib.get_close_matches(w, heard, 1, 0.7)]
    proc = lambda q: np.frombuffer(subprocess.run(["ffmpeg", "-v", "error", "-f", "f32le", "-ar", str(SR), "-ac", "1", "-i", "-", "-filter:a", f"atempo={TEMPO}", "-f", "f32le", "-"],
                                                 input=trim(tighten(load(q))).astype("<f4").tobytes(), capture_output=True, check=True).stdout, dtype="<f4").copy()
    y, y0 = proc(p), proc(TK / f"L{len(L)}.mp3")
    last = json.load(open(F / "lines.json"))[-1]; vv = load(F / "voice.wav"); a0 = int(last["start"] * SR); best = (0, 0)
    for lag in range(-int(0.03 * SR), int(0.03 * SR) + 1, 8):   # lines.json start is rounded to 10 ms: find the exact placement, then the gain
        s = vv[a0 + lag:a0 + lag + len(y0)]
        if len(s) == len(y0): c = float(np.dot(s, y0)); best = max(best, (c, lag))
    for lag in range(best[1] - 8, best[1] + 9):   # refine to the sample
        s = vv[a0 + lag:a0 + lag + len(y0)]
        if len(s) == len(y0): c = float(np.dot(s, y0)); best = max(best, (c, lag))
    s = vv[a0 + best[1]:a0 + best[1] + len(y0)]; g = float(np.dot(s, y0) / np.dot(y0, y0)); resid = float(np.sqrt(np.mean((s - g * y0) ** 2)) / (np.sqrt(np.mean(s ** 2)) or 1))
    yo = np.clip(y * g, -1, 1)
    with wave.open(str(TK / f"alt_{tag}.wav"), "wb") as wv:
        wv.setnchannels(1); wv.setsampwidth(2); wv.setframerate(SR); wv.writeframes((yo * 32767).astype("<i2").tobytes())
    # name check + word times on large-v3, run on the processed take (times are take-relative) (the most accurate local model): the build ASR (small) writes a two-word name it hears as one token
    # ("PowderKeg") whatever the delivery; large-v3 splits words on the audio. The name must be heard as its separate words, in order.
    from faster_whisper import WhisperModel
    xa = np.frombuffer(subprocess.run(["ffmpeg", "-v", "error", "-i", str(TK / f"alt_{tag}.wav"), "-ac", "1", "-ar", "16000", "-f", "f32le", "-"], capture_output=True).stdout, dtype="<f4")
    segL, _ = WhisperModel("large-v3", device="cpu", compute_type="int8").transcribe(xa, language="en", word_timestamps=True)
    rawL = [(round(w.start, 2), round(w.end, 2), w.word.strip()) for s_ in segL for w in s_.words]; heardL = [re.sub(r"[^a-z]", "", w[2].lower()) for w in rawL]
    nameok = any(heardL[i:i + len(name)] == name for i in range(len(heardL)))
    rep = dict(channel=tag, name=ent["name"], text=txt, heard=" ".join(w[2] for w in raw), heard_large=" ".join(w[2] for w in rawL), name_heard=nameok, missing=miss, dur=round(len(y) / SR, 3),
               main_dur=round(len(y0) / SR, 3), main_start=round((a0 + best[1]) / SR, 4), gain=round(g, 5), gain_resid=round(resid, 4), model=MODEL, tempo=TEMPO, words=rawL)
    json.dump(rep, open(TK / f"alt_{tag}.json", "w"), indent=1); print(json.dumps(rep))
    if not nameok: print(f"NAME NOT HEARD: '{ent['name']}' not transcribed as separate words -> reroll once (--reroll), else use the fallback form"); sys.exit(4)
