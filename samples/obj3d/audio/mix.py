"""MINIATURE mix: voice + ambience beds + MG/UI + world cues + chapter swells -> master (-14 LUFS, -1 dBTP) -> muxed mp4.
Uses the dialogue SFX library (dialogue/sfx/index.json ids, never hard-coded files), the scene routing in audio/sfxmap.json and
dialogue's level rules: beds ~20 dB under the voice with a 2.5 dB slow duck while speaking that comes UP in pauses (never
muted, never near-silent), one-shots 6-16 dB under the voice, nothing on the final line, no stinger before the ending.

films/<film>/sound.json:
  {"video": "out/suez.mp4",
   "beds": "page" | [...],        "page" = films/<film>/beds.json exported by the film page (window.__beds via render.mjs lines)
   "cues": "page" | [...],        "page" = films/<film>/cues.json (window.__cues)
   "music": {"moods": "auto"|[...], "under": 18, "lift": 3},   OPTIONAL soft music bed (audio/music.py), one mood per #ch chapter
   "bed_under": 20,               OPTIONAL bed bus level, dB under the voice's speaking RMS (null = legacy fixed x0.45 bus)
   "bed_lift": 4,                 OPTIONAL dB the beds come up in pauses > 0.6 s (0 = legacy duck only)
   "chapters": true}              OPTIONAL chapter-break treatment (default true): music swell + riser + whoosh, see below

BEDS: a list mixing two entry forms (crossfades are equal-power over XF = 1.5 s):
  [id, dB, t0, t1]                        legacy: one looped library bed, random start offset, fades at t0/t1
  {"scene": "courtroom", "t0": s, "t1": s, "db": 0, "wide": false}
  {"scene": "courtroom", "line": n}       per line: from 0.3 s before line n starts to 0.3 s before line n+1 starts
  {"scene": "ground:coast", "lines": [a, b]}
      scene = an archetype / alias / "ground:<kind>" in audio/sfxmap.json -> its recipe (layers [id, dB] + sparse one-shots);
      consecutive entries with the same scene are merged so the loop never restarts; a scene change crossfades.
CUES: a list mixing
  [t, id, dB, pan]                        legacy one-shot; id may be an exact id OR a variant prefix ("world.gavel.hit")
  {"t": s, "type": "world", "id": "world.gavel.hit", "db": -6, "x": 0.4}
  {"t": s, "type": "world", "word": "gavel", "x": -0.2}      word -> sfxmap.json words (ids + default dB)
      a prefix rotates through its variants (never the same file twice in a row); x in [-1, 1] = screen position -> pan x*0.8.
CHAPTERS (from script.md #ch markers + lines.json, as music.py): in the gap between the last line of a chapter and the first
  line of the next, the music bed swells (+swell_db, raised cosine), a code-made filtered-noise riser builds into the next line,
  a soft whoosh lands 0.5 s before it, and the beds lift (pause ride). The last chapter break (into the ending) gets no
  whoosh/riser (no stinger before the payoff).
Usage: python mix.py <film> [169] [--out DIR] [--sound F] [--beds F] [--cues F] [--voice F] [--lines F] [--no-video]
  default -> films/<film>/mix.wav and out/<film>_final.mp4; --out DIR writes DIR/mix.wav (+ DIR/<film>_mix.mp4) and never
  touches films/<film>/mix*.wav or out/*_final.mp4 (use it for tests).
"""
import os, sys, json, subprocess
from pathlib import Path
import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, sosfilt, filtfilt

HERE = Path(__file__).resolve().parent; OBJ = HERE.parent; ROOT = OBJ.parents[1]
sys.path.insert(0, str(HERE)); import music as MU  # noqa: E402
SFX = ROOT / "dialogue" / "sfx"; IDX = json.load(open(SFX / "index.json"))["sounds"]
MAP = json.load(open(HERE / "sfxmap.json"))
SR = 48000; XF = 1.5
argv = sys.argv[1:]


def opt(k, d=None):
    if k in argv: i = argv.index(k); v = argv[i + 1]; del argv[i:i + 2]; return v
    return d


OUTD = opt("--out"); SOUND = opt("--sound"); BEDF = opt("--beds"); CUEF = opt("--cues")
VOICEF = opt("--voice"); LINESF = opt("--lines")   # channel variants (variants.mjs): swapped last line voice + lines
NOVID = "--no-video" in argv
if NOVID: argv.remove("--no-video")
film = argv[0]; F = OBJ / "films" / film
S = json.load(open(SOUND or F / "sound.json"))
AR = "_169" if "169" in argv[1:] else ""   # python mix.py <film> 169 -> 16:9 video + suffixed outputs
if AR: S["video"] = S["video"].replace(".mp4", "_169.mp4")
rng = np.random.default_rng(11)
db = lambda d: 10 ** (d / 20)
_cache = {}


def rd(p):
    sr, x = wavfile.read(p); x = x.astype(np.float32) / 32768; assert sr == SR, (p, sr)
    return x if x.ndim == 2 else np.stack([x, x], 1)


def sfx(i):
    if i not in IDX: print("MISSING sfx id (library gap):", i); return None
    if i not in _cache: _cache[i] = rd(SFX / IDX[i]["file"])
    return _cache[i]


_last = {}; _ctr = {}


def resolve(i):
    """exact id, or a variant prefix -> rotate through its variants (shuffled, never the same file twice in a row)"""
    if i in IDX and not any(k.startswith(i + ".") for k in IDX): return i
    vs = sorted(k for k in IDX if k.startswith(i + "."))
    if not vs: return i if i in IDX else None
    _ctr[i] = _ctr.get(i, -1) + 1          # deterministic rotation: same cues -> same files, never the same file twice in a row
    v = vs[_ctr[i] % len(vs)]; _last[i] = v
    return v


def movavg(x, n): return MU.movavg(x, n)


# ---------------- inputs
v = rd(VOICEF or F / "voice.wav")[:, 0]
vid = OBJ / S["video"]
dur = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(vid)], capture_output=True, text=True).stdout or 0)
N = int(max(dur, len(v) / SR) * SR); T = N / SR
voice = np.zeros(N, np.float32); voice[:min(N, len(v))] = v[:N]
voice = sosfilt(butter(2, 70, "high", fs=SR, output="sos"), voice).astype(np.float32)
LINES = json.load(open(LINESF or F / "lines.json")); last_line = LINES[-1]
SCRIPT = (F / "script.md").read_text(encoding="utf8") if (F / "script.md").exists() else ""
e = np.sqrt(movavg(voice ** 2, 0.05 * SR)); speaking = e > 0.02
vrms = float(np.sqrt(np.mean(voice[speaking] ** 2))) if speaking.any() else 0.1
in_pause = movavg(speaking.astype(np.float32), 0.5 * SR) <= 0.02          # pauses longer than ~0.5 s


def on_final_line(at): return last_line["start"] - 0.2 <= at <= last_line["end"] + 0.5


# ---------------- beds
def recipe(scene, wide=False):
    sc = MAP["scenes"].get(scene) or MAP["scenes"].get(MAP["aliases"].get(scene, "")) or \
        MAP["scenes"].get("ground:" + scene) or None
    if sc is None: print("unknown scene (no recipe):", scene); return [], []
    beds = sc.get("wide_beds") if wide and sc.get("wide_beds") else sc["beds"]
    lay = [b for b in beds if b[0] in IDX]
    for b in beds:
        if b[0] not in IDX: print("bed gap:", scene, b[0])
    if not lay: lay = [b for b in sc.get("fallback", []) if b[0] in IDX]
    return lay, [s for s in sc.get("sparse", []) if any(k.startswith(s[0] + ".") for k in IDX)]


def line_span(n):
    by = {l["n"]: l for l in LINES}; l = by[n]; nx = by.get(n + 1)
    return max(0.0, l["start"] - 0.3), (nx["start"] - 0.3) if nx else T


raw = json.load(open(BEDF)) if BEDF else (json.load(open(F / "beds.json")) if S["beds"] == "page" else S["beds"])
legacy, scenes = [], []
for b in raw:
    if isinstance(b, dict):
        if "line" in b: t0, t1 = line_span(b["line"])
        elif "lines" in b: t0, t1 = line_span(b["lines"][0])[0], line_span(b["lines"][1])[1]
        else: t0, t1 = b["t0"], b["t1"]
        scenes.append({"scene": b["scene"], "t0": float(t0), "t1": float(t1), "db": b.get("db", 0), "wide": b.get("wide", False)})
    else: legacy.append(b)
scenes.sort(key=lambda s: s["t0"]); spans = []
for s in scenes:   # merge same-scene neighbours so the loop never restarts mid-scene
    if spans and spans[-1]["scene"] == s["scene"] and spans[-1]["wide"] == s["wide"] and s["t0"] - spans[-1]["t1"] < 1.0:
        spans[-1]["t1"] = max(spans[-1]["t1"], s["t1"])
    else: spans.append(dict(s))

amb = np.zeros((N, 2), np.float32)


def place_loop(x, d, t0, t1, fin=True, fout=True):
    """loop x from a random offset over [t0, t1]; equal-power XF fades (a scene change = overlapping fades)"""
    a = max(0, int(t0 * SR)); n = min(N, int(t1 * SR)) - a
    if n <= 0: return
    off = rng.integers(0, len(x)); y = np.tile(np.roll(x, -off, 0), (n // len(x) + 2, 1))[:n]
    tt = np.arange(n) / SR; env = np.ones(n, np.float32)
    if fin: env *= np.sin(np.pi / 2 * np.clip(tt / XF, 0, 1))
    if fout: env *= np.sin(np.pi / 2 * np.clip((n / SR - tt) / XF, 0, 1))
    amb[a:a + n] += y * env[:, None] * db(d)


for bid, d, t0, t1 in legacy:   # legacy entries: exactly as before (1.5 s fades; overlap two entries to crossfade)
    x = sfx(bid)
    if x is not None: place_loop(x, d, t0, t1)
sparse_cues = []
for i, s in enumerate(spans):
    lay, sparse = recipe(s["scene"], s["wide"])
    t0 = s["t0"] - (XF / 2 if i else 0); t1 = s["t1"] + (XF / 2 if i < len(spans) - 1 else 0)
    for bid, d in lay: place_loop(sfx(bid), d + s["db"], max(0, t0), min(T, t1), fin=True, fout=True)
    for pre, d, g0, g1 in sparse:   # sparse world one-shots through the scene
        t = s["t0"] + rng.uniform(1.0, g0)
        while t < s["t1"] - 1.0:
            sparse_cues.append({"t": round(t, 3), "type": "world", "id": pre, "db": d + s["db"], "x": float(rng.uniform(-0.6, 0.6)), "sparse": True})
            t += rng.uniform(g0, g1)

# level: the bed bus sits bed_under dB under the voice's speaking RMS (legacy: fixed x0.45)
BU = S.get("bed_under", 20); LIFT = S.get("bed_lift", 4)
present = np.abs(amb).max(1) > 1e-5
if BU is not None and present.any():
    brms = float(np.sqrt(np.mean(amb[present] ** 2))) or 1e-6
    amb *= vrms * db(-BU) / brms
else: amb *= 0.45
# ride: -2.5 dB while speaking, +LIFT dB in pauses (> 0.5 s), smooth ~0.25 s both ways (zero-phase) (no pumping, never muted)
g = np.where(speaking, db(-2.5), 1.0).astype(np.float32)
g = np.where(in_pause, db(LIFT), g).astype(np.float32)
a1 = np.exp(-1 / (0.25 * SR)); ride = filtfilt([1 - a1], [1, -a1], g, padlen=0).astype(np.float32)

# ---------------- chapters (from #ch markers, like music.py)
def chapter_breaks():
    if not SCRIPT or S.get("chapters", True) is False: return []
    starts, n, chn = [], 0, False
    import re
    for l in SCRIPT.split("#end")[0].splitlines():
        s = l.strip()
        if s.startswith("#ch"): chn = True; continue
        if re.match(r"NARR \(", s):
            n += 1
            if chn: starts.append(n); chn = False
    by = {l["n"]: l for l in LINES}; out = []
    for k in starts:
        if k in by and k - 1 in by: out.append((by[k - 1]["end"], by[k]["start"], k))
    return out


CH = MAP.get("chapter", {}); BRK = chapter_breaks()
chap_env = np.zeros(N, np.float32)          # 0..1 raised cosine over each chapter gap (music swell + bed lift)
ch_cues, riser = [], np.zeros((N, 2), np.float32)
for j, (pe, ns, k) in enumerate(BRK):
    w = max(CH.get("swell_s", 3.0), ns - pe + 1.0); c = (pe + ns) / 2
    a, b = max(0, int((c - w / 2) * SR)), min(N, int((c + w / 2) * SR))
    if b <= a: continue
    u = np.linspace(0, 1, b - a); chap_env[a:b] = np.maximum(chap_env[a:b], 0.5 - 0.5 * np.cos(2 * np.pi * u))
    if j == len(BRK) - 1: continue           # into the ending: no whoosh / riser (no stinger before the payoff)
    ch_cues.append({"t": max(pe, ns - 0.5 - 0.3), "type": "world", "id": CH.get("whoosh", ["ui.whoosh.air"])[j % len(CH.get("whoosh", [1]))], "db": CH.get("whoosh_db", -12), "x": 0, "chapter": True})
    ra, rb = max(0, int((pe + 0.1) * SR)), min(N, int((ns - 0.05) * SR))   # riser: band-passed noise, exp build, quick tail
    if rb - ra > int(0.4 * SR):
        nz = np.random.default_rng(200 + j).standard_normal((rb - ra, 2)).astype(np.float32)
        nz = sosfilt(butter(2, [300, 4000], "band", fs=SR, output="sos"), nz, axis=0)
        tt = np.linspace(0, 1, rb - ra)[:, None]; env = tt ** 2.5 * np.clip((1 - tt) / 0.04, 0, 1)
        nz *= env / (np.sqrt(np.mean(nz ** 2)) or 1)
        riser[ra:rb] += nz * vrms * db(CH.get("riser_db", -24))
ride *= (1 + (db(CH.get("bed_lift_db", 4)) - 1) * chap_env)
amb *= ride[:, None]

# ---------------- music bed (opt-in): procedural, per-chapter mood, ducked under the voice (audio/music.py)
mus = np.zeros((N, 2), np.float32)
if S.get("music"):
    MS = S["music"] if isinstance(S["music"], dict) else {}
    secs = MU.sections_for(LINES, SCRIPT, N / SR, MS.get("moods", "auto"))
    print("music sections:", [(round(a, 1), round(b, 1), m) for a, b, m in secs])
    mus = MU.bed(N, voice, secs, MS.get("under", 18.0), MS.get("lift", 3.0))
    mus *= (1 + (db(CH.get("swell_db", 6)) - 1) * chap_env)[:, None]

# ---------------- cues: legacy UI/foley arrays + world objects + scene sparse + chapter whooshes, 2 frames after the visual
fol = np.zeros((N, 2), np.float32)
CUES = json.load(open(CUEF)) if CUEF else (json.load(open(F / "cues.json")) if S["cues"] == "page" else S["cues"])
norm = []
for c in CUES:
    if isinstance(c, dict):
        cid, d = c.get("id"), c.get("db")
        if c.get("word"):
            wv = MAP["words"].get(c["word"])
            if not wv: print("unknown cue word:", c["word"]); continue
            cid = wv["ids"][int(round(float(c["t"]) * 10)) % len(wv["ids"])]; d = wv["db"] if d is None else d   # deterministic: by cue time
        norm.append((float(c["t"]), cid, -10 if d is None else d, float(np.clip(c.get("x", 0), -1, 1)) * 0.8, c))
    else:
        at, cid, d, pan = c; norm.append((float(at), cid, d, float(pan), {}))
hard = sorted(n[0] for n in norm)
for c in (sparse_cues if S.get("sparse", False) else []):   # sparse one-shots are OFF by default (set-driven design: cues only on visible events); sparse never lands on a picture cue (+-0.6 s)
    if not any(abs(c["t"] - h) < 0.6 for h in hard): norm.append((c["t"], c["id"], c["db"], c["x"] * 0.8, c))
for c in ch_cues: norm.append((c["t"], c["id"], c["db"], 0.0, c))
nworld = 0
for at, cid, d, pan, c in sorted(norm, key=lambda q: q[0]):
    if on_final_line(at): print("skip cue on final line:", round(at, 2), cid); continue
    rid = resolve(cid) if cid else None
    x = sfx(rid) if rid else None
    if x is None:
        if cid: print("MISSING sfx id/prefix (library gap):", cid)
        continue
    nworld += c.get("type") == "world"
    m = x.mean(1); a = int((at + 2 / 30) * SR); n = min(len(m), N - a)
    if n <= 0: continue
    fol[a:a + n, 0] += m[:n] * db(d) * np.sqrt(0.5 - pan / 2) * 1.414; fol[a:a + n, 1] += m[:n] * db(d) * np.sqrt(0.5 + pan / 2) * 1.414
print(f"beds: {len(legacy)} legacy + {len(spans)} scene spans | cues: {len(norm)} ({nworld} world, {len(sparse_cues)} sparse offered) | chapter breaks: {len(BRK)}")

# levels as in dialogue/fish/mix_ep.py: voice peak 0.89 (~-16 LUFS), one-shots (peak -6 dBFS) x0.8
mix = np.stack([voice, voice], 1) + amb + fol * 0.8 + mus + riser
mix = mix / np.abs(mix).max() * 0.89
od = Path(OUTD) if OUTD else F; od.mkdir(parents=True, exist_ok=True)
pre = od / f"mix_pre{AR}.wav"; out = od / f"mix{AR}.wav"
wavfile.write(pre, SR, (mix * 32767).astype("<i2"))
# two-pass loudnorm to -14 LUFS / -1 dBTP
TPT = float(os.environ.get("MIX_TP", "-2"))   # loudnorm true-peak target. Default -2 since 2026-11-15: at -1 the AAC encode overshot to -0.3..-0.7 dBTP on nvidia/trump/china v4; -2 lands the mp4 at about -1.3 dBTP
r = subprocess.run(["ffmpeg", "-hide_banner", "-i", str(pre), "-af", f"loudnorm=I=-14:TP={TPT}:LRA=11:print_format=json", "-f", "null", "-"], capture_output=True, text=True).stderr
m = json.loads(r[r.rindex("{"):r.rindex("}") + 1])
af = f"loudnorm=I=-14:TP={TPT}:LRA=11:measured_I={m['input_i']}:measured_TP={m['input_tp']}:measured_LRA={m['input_lra']}:measured_thresh={m['input_thresh']}:offset={m['target_offset']}:linear=true"
subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", str(pre), "-af", af, "-ar", str(SR), str(out)], check=True); pre.unlink()
fin = None
if not NOVID:
    fin = (od / f"{film}{AR}_mix.mp4") if OUTD else (OBJ / "out" / f"{film}{AR}_final.mp4")
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", str(vid), "-i", str(out), "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-shortest", str(fin)], check=True)
r = subprocess.run(["ffmpeg", "-hide_banner", "-i", str(out), "-af", "ebur128=peak=true", "-f", "null", "-"], capture_output=True, text=True).stderr
print("mix", round(N / SR, 1), "s |", " ".join(l.strip() for l in r.splitlines()[-12:] if "I:" in l or "Peak:" in l), "|", out, fin or "")
# a film is not done without its thumbnail (MINIATURE-LESSONS 20): warn only, never fail
if fin is not None and not (OBJ / "out" / f"{film}_thumb.jpg").exists(): print(f"WARNING: out/{film}_thumb.jpg missing - run films/{film}/make_thumb.py (a film is not done without its thumbnail)")
