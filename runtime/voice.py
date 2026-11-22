"""voice.py <dir> [--engine cb|f5] [--speed 1.12] [--gap 0.10] [--lead 0.12]
         [--pause-before "6,14,25"] [--pause 1.6] [--chapters chapters.json]
Synthesise <dir>/script.txt (one beat per line) with the narrator clone, write <dir>/vo/voice.wav (48k) +
<dir>/words.json [{w,s,e,line}]. Default engine: Chatterbox (`cb`, chatterbox-venv, approved version D) on paragraph
chunks, N prosody-scored takes per chunk (voice_pick.py), sped up by --cb-tempo at assembly. `--engine f5` = legacy
F5-TTS at native --speed; `--legacy` = old single F5 take per line + atempo.
Script markup: every line starting with `#` is a comment (`#hook`, `#part`, `# Chapter <name>`, ...) and is never spoken
or captioned; `line` in words.json indexes the SPOKEN lines only. A `# Chapter` line also adds a breathing pause before
the next spoken line. `{tag}` / `{tag:arg}` in a line are stripped from speech and captions (saytext.split_tags):
  {dry}          own chunk, Chatterbox exaggeration x0.6 (deadpan sarcasm)
  {stress:word}  own chunk, exaggeration x1.25, and a breath (comma) before that word in the say-text only
  {slow} {fast}  that line's audio time-stretched x0.88 / x1.12 at assembly (pitch kept; cache untouched)
  {pause[:sec]}  extra silence (default 0.6 s): before the line if the tag opens it, else after it
  {viz:..} {loop:..} {payoff:..}  storyboard / promise-tracker tags: ignored here
Chapter breathing pause: --pause seconds (real time) of extra silence BEFORE each listed line (--pause-before = spoken-line
indices, --chapters = chapters.json with first_line values, line 0 skipped). Assembly only: the per-line cache stays valid.
Per-line cache (vo/cache/<sha1>.*) keyed by text (+engine, voice, speed), so only changed lines are re-synthesised."""
import argparse, hashlib, json, re, subprocess, sys, os
import numpy as np, soundfile as sf
HERE = os.path.dirname(os.path.abspath(__file__))
ap = argparse.ArgumentParser(); ap.add_argument("dir")
ap.add_argument("--speed", type=float, default=1.12); ap.add_argument("--gap", type=float, default=0.10)
ap.add_argument("--lead", type=float, default=0.12); ap.add_argument("--tail", type=float, default=0.5)
ap.add_argument("--pause-before", default=""); ap.add_argument("--pause", type=float, default=1.6); ap.add_argument("--chapters", default="")
ap.add_argument("--legacy", action="store_true", help="old path: 1 random F5 take per LINE at speed 1.0, then ffmpeg atempo")
ap.add_argument("--engine", default="cb", choices=["f5", "cb"], help="cb = Chatterbox (chatterbox-venv, user-approved 'D'); f5 = F5-TTS (tts-venv)")
ap.add_argument("--voice", default="narrator-explainer", help="voice-pipeline/voices/<name> (reference clip + text)")
ap.add_argument("--takes", type=int, default=2); ap.add_argument("--chunk-chars", type=int, default=190)
ap.add_argument("--max-takes", type=int, default=4); ap.add_argument("--max-prosody", type=float, default=8.0)  # per-chunk scores are noisy: only redo real outliers
ap.add_argument("--cb-tempo", type=float, default=1.15, help="Chatterbox has no speed knob: assembly tempo (1.15 = ~3.3 w/s, the reference reels' pace)")
a = ap.parse_args(); D = os.path.abspath(a.dir); SPEED = a.speed
# Default: paragraph chunks (2-4 lines spoken as ONE utterance, so intonation flows across sentences), N takes per chunk,
# each scored by voice_pick.py (Whisper clarity + delivery vs the reference reels), cut back into lines.
# f5 speaks at --speed natively; cb is sped up by --cb-tempo at assembly (approved version D, 2026-10-08).
TEMPO = SPEED if a.legacy else (a.cb_tempo if a.engine == "cb" else 1.0)
TTS_PY = "C:/Repos/tts-venv/Scripts/python.exe"; CB_PY = "C:/Repos/chatterbox-venv/Scripts/python.exe"
sys.path.insert(0, HERE); from saytext import to_say, split_tags
SLOW, FAST, PAUSE_S = 0.88, 1.12, 0.6
lines, CH = [], set()  # raw spoken lines (may carry {tags}); CH = spoken-line indices right after a `# Chapter` marker
for l in open(f"{D}/script.txt", encoding="utf8").read().split("\n"):
    l = l.strip()
    if l.startswith("#"):
        if re.match(r"#\s*chapter\b", l, re.I):
            CH.add(len(lines))
    elif l:
        lines.append(l)
parsed = [split_tags(l) for l in lines]
text = [t for t, _ in parsed]  # what is spoken and captioned
tg = [{n: (arg, start) for n, arg, start in tags} for _, tags in parsed]
dry = ["dry" in t for t in tg]; stress = [(t.get("stress") or (None,))[0] for t in tg]
rate = [SLOW if "slow" in t else FAST if "fast" in t else 1.0 for t in tg]
extra = [0.0] * (len(lines) + 1)  # extra silence (s) before line i; [len] = before the tail
for i, t in enumerate(tg):
    if "pause" in t:
        arg, at_start = t["pause"]
        extra[i if at_start else i + 1] += float(arg) if arg else PAUSE_S
# cache key text: assembly-only tags removed, so adding {slow}/{pause}/{viz:..} never re-synthesises
ASM = re.compile(r"\s*\{(slow|fast|pause|viz|loop|payoff)(?::[^}]*)?\}", re.I)
gkey = [ASM.sub("", l).strip() for l in lines]


def say_of(i):
    """say-text of line i; {stress:w} puts a breath (comma) before the first w (display text unchanged)."""
    ws = text[i].split()
    if stress[i]:
        k = next((k for k, w in enumerate(ws) if re.sub(r"[^\w']", "", w).lower() == stress[i].lower()), 0)
        if k > 0 and not re.search(r"[,.;:!?]$", ws[k - 1]):
            ws[k - 1] += ","
    return to_say(" ".join(ws))[2]
PB = {int(x) for x in a.pause_before.replace(" ", "").split(",") if x} | CH
if a.chapters:
    ch = json.load(open(a.chapters if os.path.exists(a.chapters) else f"{D}/{a.chapters}", encoding="utf8"))
    PB |= {int(c["first_line"]) for c in (ch.get("chapters", ch) if isinstance(ch, dict) else ch)}
PB.discard(0)
cd = f"{D}/vo/cache"; os.makedirs(cd, exist_ok=True)
sha = lambda t: hashlib.sha1(t.encode()).hexdigest()[:16]
if a.legacy:
    H = [sha(l) for l in text]
    jobs = [{"text": l, "wav": f"{cd}/{h}.wav", "json": f"{cd}/{h}.json"} for l, h in zip(text, H)
            if not (os.path.exists(f"{cd}/{h}.wav") and os.path.exists(f"{cd}/{h}.json"))]
    seen = set(); jobs = [j for j in jobs if not (j["wav"] in seen or seen.add(j["wav"]))]
    print(f"{len(lines)} lines, {len(jobs)} to synthesise")
    if jobs:
        jf = f"{D}/vo/_jobs.json"; json.dump(jobs, open(jf, "w"))
        subprocess.run(["node", f"{HERE}/voice_synth.js", jf], check=True)
else:
    groups, cur, n = [], [], 0
    for i, l in enumerate(lines):
        c = len(to_say(text[i])[2])
        # a {dry}/{stress} line is its own chunk (its own exaggeration); untagged scripts chunk exactly as before (cache stays valid)
        solo = lambda k: dry[k] or bool(stress[k])
        if cur and (n + c > a.chunk_chars or i in PB or solo(i) or solo(cur[-1])):
            groups.append(cur); cur, n = [], 0
        cur.append(i); n += c + 1
    groups.append(cur)
    H = [None] * len(lines); chunks = []
    td = f"{cd}/takes"; os.makedirs(td, exist_ok=True)
    for g in groups:
        ck = sha(f"{a.engine}|{a.voice}|{SPEED}|" + "\n".join(gkey[i] for i in g))
        for j, i in enumerate(g):
            H[i] = sha(f"{ck}|{j}|{gkey[i]}")
        cached = all(os.path.exists(f"{cd}/{H[i]}.wav") and os.path.exists(f"{cd}/{H[i]}.json") for i in g)
        if cached and os.path.exists(f"{cd}/{H[g[0]]}.json.take.json"):  # cached but below the bar and not yet maxed out
            t = json.load(open(f"{cd}/{H[g[0]]}.json.take.json"))
            n_takes = len([f for f in os.listdir(td) if f.startswith(ck + "_t")])
            if (t["chunk_wer"] > 0 or t["prosody"] > a.max_prosody) and n_takes < a.max_takes:
                cached = False; retry = min(a.max_takes, n_takes + 2)
            else:
                retry = 0
        else:
            retry = 0
        if not cached:
            chunks.append({"id": ck, "dir": td, "say": " ".join(say_of(i) for i in g),
                           "lines": [{"text": text[i], "wav": f"{cd}/{H[i]}.wav", "json": f"{cd}/{H[i]}.json"} for i in g],
                           "min_takes": retry, "dry": dry[g[0]], "stress": bool(stress[g[0]])})
    print(f"{len(lines)} lines in {len(groups)} chunks, {len(chunks)} to synthesise ({a.engine}, voice {a.voice}, {a.takes} takes)")
    # Adaptive takes: start with --takes per chunk; chunks whose best take misses the bar (any Whisper error, or
    # delivery penalty > --max-prosody) get 2 more takes, up to --max-takes. Most chunks finish in the first round.
    gen = [TTS_PY, f"{HERE}/voice_gen_f5.py"] if a.engine == "f5" else [CB_PY, f"{HERE}/voice_gen_cb.py"]
    takes = a.takes
    while chunks:
        takes = max([takes] + [c.get("min_takes", 0) for c in chunks])
        cf = f"{D}/vo/_chunks.json"; json.dump(chunks, open(cf, "w"))
        subprocess.run(gen + [cf, "--voice", a.voice, "--takes", str(takes), "--speed", str(SPEED)], check=True)
        subprocess.run([TTS_PY, f"{HERE}/voice_pick.py", cf], check=True)
        if takes >= a.max_takes:
            break
        weak = []
        for c in chunks:
            t = json.load(open(c["lines"][0]["json"] + ".take.json"))
            if t["chunk_wer"] > 0 or t["prosody"] > a.max_prosody:
                weak.append(c)
                for ln in c["lines"]:
                    os.remove(ln["wav"]); os.remove(ln["json"])
        takes = min(a.max_takes, takes + 2); chunks = weak
        if weak:
            print(f"{len(weak)} chunk(s) below the bar -> {takes} takes", flush=True)
def stretch(seg, sr, f):
    """time-stretch seg by tempo f (pitch kept) via ffmpeg atempo; f > 1 = faster/shorter."""
    src, dst = f"{D}/vo/_st_in.wav", f"{D}/vo/_st_out.wav"
    sf.write(src, seg, sr)
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", src, "-af", f"atempo={f}", "-ar", str(sr), "-ac", "1", dst], check=True)
    y, _ = sf.read(dst); os.remove(src); os.remove(dst)
    return y


out = []; words = []; sr = None
for i, h in enumerate(H):
    x, sr = sf.read(f"{cd}/{h}.wav"); x = x if x.ndim == 1 else x.mean(1)
    w = json.load(open(f"{cd}/{h}.json"))
    s0 = max(0, w[0]["start"] - 0.04); e0 = min(len(x) / sr, w[-1]["end"] + 0.08)
    out.append(np.zeros(int(((a.gap if i else a.lead) + (a.pause if i in PB else 0) + extra[i]) * TEMPO * sr)))
    base = sum(len(z) for z in out) / sr; f = rate[i]
    for t in w: words.append({"w": t["word"], "s": (base + (t["start"] - s0) / f) / TEMPO, "e": (base + (t["end"] - s0) / f) / TEMPO, "line": i})
    seg = x[int(s0 * sr):int(e0 * sr)]
    out.append(seg if f == 1.0 else stretch(seg, sr, f))
out.append(np.zeros(int((a.tail + extra[len(lines)] * TEMPO) * sr)))
sf.write(f"{D}/vo/raw.wav", np.concatenate(out), sr)
subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", f"{D}/vo/raw.wav", "-af", f"atempo={TEMPO}", "-ar", "48000", f"{D}/vo/voice.wav"], check=True)
json.dump(words, open(f"{D}/words.json", "w"))
d = float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f"{D}/vo/voice.wav"]))
print(f"voice.wav {d:.2f}s, {len(words)} words, {len(words)/(words[-1]['e']-words[0]['s']):.2f} w/s")
