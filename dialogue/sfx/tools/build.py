"""Select, process and index the DIALOGUE SFX library.
  .vendor/earshot/.venv/Scripts/python.exe -I dialogue/sfx/tools/build.py
Reads  dialogue/sfx/tools/needs.json, dialogue/sfx/_work/{candidates,vet}.json
Writes dialogue/sfx/{amb,foley,ui}/..., index.json, credits.json, CREDITS.md

Selection rule (fixed before listening): a candidate is eligible when earshot match on its chosen section is
'strong' or 'plausible' (z >= 2.5) AND realness says 'real or pro-produced'. Among eligible ones the highest z wins,
except a cc0 file is preferred when its z is within 0.5 of the best CC-BY one. Weak / no-match picks are rejected
(the need is reported as a gap instead).

Section mode (added for the miniature "world" section, 2026-11-14):
  .vendor/earshot/.venv/Scripts/python.exe -I dialogue/sfx/tools/build.py --section world
builds ONLY the needs whose needs.json entry has "section": "world" and MERGES them into the existing index.json /
credits.json: every other id, file, set recipe and credit is kept untouched (the dialogue pipeline depends on them), and the
UI bank is not re-rendered. Extra need keys used there: "variants" (one-shot variants, default 3; at most 2 per source file
when > 3), "len_s" (minimum one-shot length, the moment is widened around its centre), "crowd" (crowd gate, see
human-voice gate below and tools/speech_gate.py)."""
import json, os, re, sys
sys.stdout.reconfigure(encoding="utf-8", errors="replace")  # titles can hold non-cp1252 chars (-I ignores PYTHONIOENCODING)
import numpy as np, soundfile as sf, pyloudnorm as pyln
from scipy import signal
from earshot import api

ROOT = "C:/Repos/HFPipleine/dialogue/sfx"
W = f"{ROOT}/_work"
SR = 48000
AMB_LUFS, ONESHOT_PEAK = -30.0, -6.0
XF = 2.5          # loop crossfade, s
LOOP_MAX = 45.0   # longest loop kept, s
OK_V = ("strong", "plausible")
REAL = "real or pro-produced"

needs = json.load(open(f"{ROOT}/tools/needs.json", encoding="utf-8"))
SECTION = sys.argv[sys.argv.index("--section") + 1] if "--section" in sys.argv else None
if SECTION: needs = {k: v for k, v in needs.items() if v.get("section") == SECTION}
SPEECH = json.load(open(f"{W}/speech.json", encoding="utf-8")) if os.path.exists(f"{W}/speech.json") else {}
cands = json.load(open(f"{W}/candidates.json", encoding="utf-8"))
vet = json.load(open(f"{W}/vet.json"))
meter = pyln.Meter(SR)
index, credits, gaps, verdict_log, human_log = {}, [], [], [], []


def db(x): return 20 * np.log10(max(x, 1e-12))


def hp(x, f=25):
    sos = signal.butter(2, f, btype="high", fs=SR, output="sos")
    return signal.sosfiltfilt(sos, x, axis=0)


def lufs(x): return float(meter.integrated_loudness(x if x.ndim == 1 else x[:, :2]))


def write(rel, x):
    p = f"{ROOT}/{rel}"; os.makedirs(os.path.dirname(p), exist_ok=True)
    sf.write(p, np.clip(x, -1, 1), SR, subtype="PCM_16")
    return p


def make_loop(x, s0, s1):
    """equal-power crossfade of the section's tail into its head: the file wraps seamlessly"""
    a, b = int(s0 * SR), int(s1 * SR)
    seg = x[a:b]
    if seg.ndim == 1: seg = np.stack([seg, seg], 1)
    X = int(XF * SR)
    L = min(len(seg) - X, int(LOOP_MAX * SR))
    seg = hp(seg[:L + X])
    t = np.linspace(0, np.pi / 2, X)[:, None]
    out = seg[:L].copy()
    out[:X] = seg[:X] * np.sin(t) + seg[L:L + X] * np.cos(t)
    g = 10 ** ((AMB_LUFS - lufs(out)) / 20); out *= g
    pk = np.abs(out).max()
    if pk > 10 ** (-1 / 20): out *= 10 ** (-1 / 20) / pk  # never clip a bed
    return out


def make_oneshot(x, s0, s1, pre=0.02, post=0.25, fo_s=0.03):
    if x.ndim > 1: x = x.mean(1)
    a, b = max(0, int((s0 - pre) * SR)), min(len(x), int((s1 + post) * SR))
    y = hp(x[a:b], 40)
    # trim silence: frames below peak-45 dB at either end
    w = int(0.005 * SR); n = len(y) // w
    env = np.array([np.sqrt(np.mean(y[i * w:(i + 1) * w] ** 2)) for i in range(n)]) + 1e-12
    thr = env.max() * 10 ** (-45 / 20); on = np.where(env > thr)[0]
    if len(on): y = y[max(0, (on[0] - 1) * w): min(len(y), (on[-1] + 2) * w)]
    fi, fo = int(0.003 * SR), min(int(fo_s * SR), len(y) // 3)
    y[:fi] *= np.linspace(0, 1, fi); y[-fo:] *= np.linspace(1, 0, fo)
    return y * (10 ** (ONESHOT_PEAK / 20) / np.abs(y).max())


def measure(p):
    y, _ = sf.read(p)
    return {"duration_s": round(len(y) / SR, 3), "lufs": round(lufs(y), 1) if len(y) > 0.4 * SR else None,
            "peak_dbfs": round(db(np.abs(y).max()), 1), "channels": 1 if y.ndim == 1 else y.shape[1]}


HUMAN_Q = ["a man speaking", "a woman speaking", "people talking in the background", "singing vocals", "people laughing"]
HUMAN_MAX_Z = 2.5  # 'plausible' or stronger anywhere in the kept section -> reject (no voices in this library)


def human_z(path, s0, s1, bed, stored=None):
    """worst human-voice reading (one multi-query match) on the kept section / moment; vet_fast stores it already"""
    if stored is not None: return round(float(stored), 2)
    return round(float(api.match(path, HUMAN_Q, start=s0, end=max(s1, s0 + 0.3)).get("z") or -9), 2)


SING_Q = ["singing vocals"]
SPEECH_GATE = "crowd needs: Earshot singing z < 2.5 AND faster-whisper intelligible words below max (tools/speech_gate.py)"


def crowd_gate(nid, cid, path, s0, s1, key):
    """crowd needs: murmur is the sound itself, so the gate is 'no intelligible words, no singing' instead of 'no people'.
    Returns (ok, record). A candidate the speech gate has not seen is rejected (fail closed)."""
    sz = round(float(api.match(path, SING_Q, start=s0, end=max(s1, s0 + 0.3)).get("z") or -9), 2)
    sg = SPEECH.get(nid, {}).get(cid, {}).get(key)
    ok = sz < HUMAN_MAX_Z and bool(sg and sg.get("pass"))
    return ok, {"singing_z": sz, "intelligible_words": sg and sg.get("words"), "words_max": sg and sg.get("max"),
                "text": sg and sg.get("text"), "gate": SPEECH_GATE}


def widen(n, s0, s1):
    L = n.get("len_s", 0)
    if L and s1 - s0 < L:
        c = (s0 + s1) / 2; s0, s1 = max(0.0, c - L / 2), c + L / 2
    return s0, s1


def src(d, cid):
    for ext in (".flac", ".wav"):
        if os.path.exists(f"{d}/{cid}{ext}"): return f"{d}/{cid}{ext}"
    raise FileNotFoundError(cid)


def pick(nid):
    v = vet.get(nid)
    if not v: return [], "no candidates downloaded / vetted"
    meta = {r["id"]: r for r in cands.get(nid, [])}
    rows = []
    for fn, fr in v["files"].items():
        cid = fn; m = fr.get("match", {}); rl = fr.get("realness", {})
        ok = m.get("verdict") in OK_V and rl.get("verdict") == REAL
        rank_pos = next((i + 1 for i, r in enumerate(v["rank"]) if os.path.splitext(r[0])[0] == fn), None)
        verdict_log.append({"need": nid, "candidate": cid, "title": meta.get(cid, {}).get("title"), "license": meta.get(cid, {}).get("license"),
                            "z": m.get("z"), "match": m.get("verdict"), "realness": rl.get("verdict"), "p_real": rl.get("p_real"),
                            "rank": rank_pos, "accepted_by_rule": ok})
        if ok and cid in meta: rows.append((m["z"], cid, fr, rank_pos))
    if not rows: return [], "no eligible candidate (all weak / no match or not real)"
    rows.sort(key=lambda r: -(r[0] + (0.5 if meta[r[1]]["license"] == "cc0" else 0)))
    return [(z, cid, fr, rp, meta[cid]) for z, cid, fr, rp in rows], None


def credit(sem, rel, m, n, fr, z, rp, extra=None):
    mt = fr.get("match", {})
    c = {"id": sem, "file": rel, "title": m["title"], "creator": m["creator"], "source": f"openverse/{m['source']}",
         "source_url": m["landing"], "file_url": m["url"], "openverse_id": m["id"], "license": m["license"],
         "license_version": m["license_version"], "license_url": m["license_url"],
         "attribution": f"\"{m['title']}\" by {m['creator']} ({m['landing']}), {('CC0 ' if m['license'] == 'cc0' else 'CC BY ')}{m['license_version']} ({m['license_url']})",
         "earshot": {"brief": n["brief"], "alts": n["alts"], "match_z": z, "match_verdict": mt.get("verdict"),
                     "p_vs_alts": mt.get("p_vs_alts"), "closest_vocab": mt.get("closest_vocab"),
                     "realness": fr.get("realness"), "rank_among_candidates": rp, "n_candidates": len(vet[n["_id"]]["files"])}}
    if extra: c.update(extra)
    return c


for nid, n in needs.items():
    n["_id"] = nid
    picks, why = pick(nid)
    if not picks:
        gaps.append({"id": nid, "why": why}); continue
    src_dir = f"{W}/wav/{nid}"
    if n["kind"] == "amb":
        k = 0
        for z, cid, fr, rp, m in picks:
            if k >= 2: break
            s0, s1 = fr["section"]
            if s1 - s0 < 20: continue
            if n.get("crowd"):
                ok, g = crowd_gate(nid, cid, src(src_dir, cid), s0, s1, "section"); hz = g
                human_log.append({"need": nid, "candidate": cid, **g, "rejected": not ok})
                if not ok: continue
            else:
                hz = human_z(src(src_dir, cid), s0, s1, True, fr.get("human_voice_z"))
                human_log.append({"need": nid, "candidate": cid, "human_voice_z": hz, "rejected": hz >= HUMAN_MAX_Z})
                if hz >= HUMAN_MAX_Z: continue
            x, _ = sf.read(src(src_dir, cid))
            sem = nid if k == 0 else f"{nid}.alt"; k += 1
            rel = f"{n['dir']}/{sem.split('.', 1)[1].replace('.', '_')}.wav"
            write(rel, make_loop(x, s0, s1))
            ms = measure(f"{ROOT}/{rel}")
            index[sem] = {"file": rel, "kind": "bed", "loop": True, **ms, "license": m["license"], "source": "openverse"}
            credits.append(credit(sem, rel, m, n, fr, z, rp, {"section_s": [s0, s1], "human_voice_z": hz}))
        if not k: gaps.append({"id": nid, "why": "eligible files all failed the human-voice gate or were too short"})
    else:  # foley and sparse one-shots: up to 3 variants from eligible moments
        got, lim = 0, n.get("variants", 4 if n["kind"] == "sparse" else 3)
        per_file = 2 if lim > 3 else lim
        for z, cid, fr, rp, m in picks:
            x, _ = sf.read(src(src_dir, cid)); here, used = 0, []
            moms = fr.get("moments", [])
            if SECTION: moms = sorted(moms, key=lambda q: -(q.get("z") or 0))
            for mo in moms:
                if got >= lim or here >= per_file: break
                if mo.get("verdict") not in OK_V: continue
                w0, w1 = widen(n, mo["start"], mo["end"])
                if any(w0 < b and a < w1 for a, b in used): continue   # overlapping moments would make near-identical variants
                if n.get("crowd"):
                    ok, g = crowd_gate(nid, cid, src(src_dir, cid), w0, w1, f"{mo['start']:.3f}"); hz = g
                    human_log.append({"need": nid, "candidate": cid, "moment": [w0, w1], **g, "rejected": not ok})
                    if not ok: continue
                else:
                    same = (w0, w1) == (mo["start"], mo["end"])
                    hz = human_z(src(src_dir, cid), w0, w1, False, mo.get("human_voice_z") if same else None)
                    human_log.append({"need": nid, "candidate": cid, "moment": [w0, w1], "human_voice_z": hz, "rejected": hz >= HUMAN_MAX_Z})
                    if hz >= HUMAN_MAX_Z: continue
                used.append((w0, w1)); here += 1
                got += 1
                sem = f"{nid}.{got:02d}"
                rel = f"{n['dir']}/{nid.split('.', 1)[1].replace('.', '_')}_{got:02d}.wav"
                write(rel, make_oneshot(x, w0, w1, fo_s=0.3 if n.get("len_s") else 0.03))
                ms = measure(f"{ROOT}/{rel}")
                index[sem] = {"file": rel, "kind": "oneshot", "loop": False, **ms, "license": m["license"], "source": "openverse"}
                credits.append(credit(sem, rel, m, n, fr, mo.get("z"), rp, {"moment_s": [round(w0, 3), round(w1, 3)], "moment_verdict": mo.get("verdict"), "human_voice_z": hz}))
            if got >= lim: break
        if not got: gaps.append({"id": nid, "why": "eligible files but no strong/plausible moment"})

# ---------------- UI (Earshot bank, code-made): role -> (bank id, brief, alts, render kwargs), chosen from ui_vet/ui_probe
UI = {
    "ui.pop.soft":     ("pro_pop/bloop", "a bubble pop", ["a cork pop", "a water drop", "a mouse click"], {}),
    "ui.pop.wood":     ("pop/4", "a wooden block hit", ["a knock on a door", "a snare hit", "a cork pop"], {}),
    "ui.pop.tiny":     ("pro_pop/tink", "a wooden block hit", ["a glass ting", "a mouse click", "a snare hit"], {}),
    "ui.card.slide":   ("swipe/glide", "a fast whoosh", ["a deep cinematic whoosh", "a gust of wind rushing past", "a punchy impact hit"], {}),
    "ui.line.tick":    ("pro_hover_tick/soft", "a soft key release click", ["a mouse click", "a clock ticking", "a snare hit"], {}),
    "ui.line.draw":    ("pro_typing_run/soft", "a ratchet clicking", ["a keyboard typing fast", "paper rustling", "crisp hi-hats"], {"dur": 0.8}),
    "ui.whoosh.soft":  ("fit/whoosh.short/bamboo_swish", "a fast whoosh", ["a deep cinematic whoosh", "a gust of wind rushing past", "a punchy impact hit"], {}),
    "ui.whoosh.air":   ("swish/soft", "a fast whoosh", ["a deep cinematic whoosh", "a gust of wind rushing past", "a snare hit"], {}),
    "ui.ding.number":  ("notify/mid_wood", "a success chime", ["an alarm clock beeping", "a doorbell", "a glass ting"], {}),
    "ui.ding.celesta": ("mallet/celesta", "a success chime", ["an alarm clock beeping", "a triangle hit", "a glass ting"], {}),
    "ui.pin.drop":     ("knock/wood", "a wooden block hit", ["a knock on a door", "a snare hit", "a punchy impact hit"], {}),
}
os.makedirs(f"{W}/ui_final", exist_ok=True)
for sem, (bid, brief, alts, kw) in ({} if SECTION else UI).items():
    tmp = f"{W}/ui_final/{sem}.wav"
    api.sfx_render(bid, tmp, seed=1, sr=SR, **kw)
    m = api.match(tmp, brief, alts=alts)
    x, _ = sf.read(tmp)
    x = x.mean(1) if x.ndim > 1 else x
    y = make_oneshot(x, 0.0, len(x) / SR, pre=0, post=0)
    rel = f"ui/{sem.split('.', 1)[1].replace('.', '_')}.wav"
    write(rel, y)
    ms = measure(f"{ROOT}/{rel}")
    mt = {"z": m.get("z"), "match_verdict": m.get("verdict"), "p_vs_alts": m.get("p_vs_alts"),
          "closest_vocab": [(t["term"], round(t["z"], 2)) for t in m.get("closest_vocab", [])[:3]]}
    index[sem] = {"file": rel, "kind": "oneshot", "loop": False, **ms, "license": "earshot-bank (MIT, code-made)", "source": "earshot",
                  "bank_id": bid, "seed": 1, "render": kw}
    credits.append({"id": sem, "file": rel, "title": bid, "creator": "earshot sound bank (code-made, no recording)",
                    "source": "earshot v0.4.0 bank", "source_url": "https://github.com/Leonxlnx/earshot", "license": "MIT (code); output is our render",
                    "license_url": "https://github.com/Leonxlnx/earshot/blob/main/LICENSE",
                    "earshot": {"brief": brief, "alts": alts, **mt, "note": "designed sound: judged by its closest vocabulary reading, realness not required"}})
    verdict_log.append({"need": sem, "candidate": bid, "z": mt["z"], "match": mt["match_verdict"], "source": "earshot"})

if SECTION:   # merge: keep every existing id / credit / set; replace only this section's ids
    mine = lambda i: any(i == k or i.startswith(k + ".") for k in needs)
    old_i = json.load(open(f"{ROOT}/index.json")); old_c = json.load(open(f"{ROOT}/credits.json", encoding="utf-8"))
    index = {**{k: v for k, v in old_i["sounds"].items() if not mine(k)}, **index}
    credits = [c for c in old_c["files"] if not mine(c["id"])] + credits
    gaps = [g for g in old_c.get("gaps", []) if g["id"] not in needs] + gaps
    verdict_log = [r for r in old_c.get("vetting_log", []) if r.get("need") not in needs] + verdict_log
    human_log = [r for r in old_c.get("human_voice_gate", []) if r.get("need") not in needs] + human_log
index = dict(sorted(index.items()))
# per-set bed recipes: layer gains are dB relative to the -30 LUFS normalised beds; ids missing from the library are dropped
SETS = {
    "campfire_forest": {"beds": [["amb.campfire.close", 0], ["amb.forest.crickets", -6], ["amb.wind.pines", -12]],
                        "wide_beds": [["amb.campfire.distant", 0], ["amb.forest.crickets", -4], ["amb.wind.pines", -10]],
                        "sparse": [["amb.birds.owl", -14, 25, 60]], "foley": ["foley.fire.ember_pop", "foley.fire.log_shift", "foley.cloth.rustle", "foley.mug.set_wood"]},
    "hilltop_city":    {"beds": [["amb.city.distant", 0], ["amb.breeze.night", -4], ["amb.forest.crickets", -14]],
                        "sparse": [], "foley": ["foley.cloth.rustle", "foley.step.gravel", "foley.mug.set_wood"]},
    "pine_ridge":      {"beds": [["amb.wind.pines", 0], ["amb.breeze.night", -6], ["amb.forest.crickets", -10]],
                        "sparse": [["amb.birds.owl", -12, 20, 50]], "foley": ["foley.cloth.rustle", "foley.step.leaves", "foley.step.gravel"]},
    "lake_shore":      {"beds": [["amb.lake.lapping", 0], ["amb.forest.crickets", -6], ["amb.breeze.night", -8]],
                        "sparse": [["amb.birds.owl", -16, 30, 70]], "foley": ["foley.cloth.rustle", "foley.step.gravel", "foley.mug.set_wood"]},
}
have = set(index) | {k.rsplit(".", 1)[0] for k in index}
for st in SETS.values():
    for key in ("beds", "wide_beds", "sparse"):
        if key in st: st[key] = [b for b in st[key] if b[0] in have]
    st["foley"] = [f for f in st["foley"] if f in have]
if SECTION: SETS = old_i["sets"]
json.dump({"version": 1, "sets": SETS, "sample_rate": SR, "bit_depth": 16, "beds_lufs_target": AMB_LUFS, "oneshot_peak_target_dbfs": ONESHOT_PEAK,
           "sounds": index}, open(f"{ROOT}/index.json", "w"), indent=1)
json.dump({"files": credits, "gaps": gaps, "vetting_log": verdict_log, "human_voice_gate": human_log}, open(f"{ROOT}/credits.json", "w", encoding="utf-8"), indent=1)

# ---------------- CREDITS.md
L = ["# SFX credits (DIALOGUE library + miniature world section)", "",
     "Recordings come from Openverse (api.openverse.org, Freesound / Wikimedia sources), licence CC0 or CC BY only.",
     "CC BY files **must** be credited in the video description; the line to paste is given per file.",
     "UI sounds are rendered in code from the Earshot v0.4.0 bank (MIT, no recordings). Full data: `credits.json`.", ""]
for lic, head in (("by", "## CC BY (attribution required)"), ("cc0", "## CC0 (no attribution required, credited anyway)")):
    rows = [c for c in credits if c.get("license") == lic]
    if not rows: continue
    L += [head, "", "| id | file | title | creator | source | licence |", "|---|---|---|---|---|---|"]
    for c in rows:
        t = c["title"].replace("|", "/")
        L.append(f"| `{c['id']}` | `{c['file']}` | {t} | {c['creator']} | [{c['source_url']}]({c['source_url']}) | [{c['license'].upper()} {c['license_version']}]({c['license_url']}) |")
    L.append("")
by = [c for c in credits if c.get("license") == "by"]
if by:
    L += ["### Attribution lines (paste into the description)", ""]
    seen = set()
    for c in by:
        if c["source_url"] in seen: continue
        seen.add(c["source_url"]); L.append(f"- {c['attribution']}")
    L.append("")
L += ["## Earshot bank (code-made)", "", "| id | file | bank id |", "|---|---|---|"]
for c in credits:
    if c["source"].startswith("earshot"): L.append(f"| `{c['id']}` | `{c['file']}` | `{c['title']}` |")
open(f"{ROOT}/CREDITS.md", "w", encoding="utf-8").write("\n".join(L) + "\n")

print("files:", len(index), "gaps:", gaps)
for k, v in index.items(): print(k, v["file"], v["duration_s"], v["lufs"], v["peak_dbfs"], v["license"])
