"""Fast earshot vetting on 15 s trims (resumable; low RAM). For each need not yet in vet.json:
  - pre-rank downloaded candidates by Openverse metadata (cc0 first, search order, duration fit), keep <= 4;
  - ffmpeg cuts the loudest / most active 15 s window of each file to <work>/trim/<need>/<id>.wav;
  - earshot rank (all trims), match (brief vs confusions) + human-voice check (one multi-query match) + realness on
    the trim; for one-shots, find (best moments inside the trim) and a human-voice check per moment;
  - vet.json is written after every need, so a stopped run resumes where it left off.
  .vendor/earshot/.venv/Scripts/python.exe -I dialogue/sfx/tools/vet_fast.py <needs.json> <work dir>"""
import glob, json, os, subprocess, sys
sys.stdout.reconfigure(encoding="utf-8", errors="replace")  # titles can hold non-cp1252 chars (-I ignores PYTHONIOENCODING)
import numpy as np

needs = json.load(open(sys.argv[1], encoding="utf-8"))
W = sys.argv[2]
cands = json.load(open(os.path.join(W, "candidates.json"), encoding="utf-8"))
vp = os.path.join(W, "vet.json")
out = json.load(open(vp)) if os.path.exists(vp) else {}
TRIM, PER = 15.0, 4
BED_SECTION = 50.0  # the bed is later cut from a 50 s section centred on the vetted trim
HUMAN_Q = ["a man speaking", "a woman speaking", "people talking in the background", "singing vocals", "people laughing"]


def env_8k(path):
    raw = subprocess.run(["ffmpeg", "-nostdin", "-v", "error", "-i", path, "-ac", "1", "-ar", "8000", "-f", "s16le", "-"],
                         capture_output=True, check=True, timeout=300).stdout
    x = np.frombuffer(raw, np.int16).astype(np.float32) / 32768
    hop = 800  # 0.1 s
    n = len(x) // hop
    return np.sqrt((x[:n * hop].reshape(n, hop) ** 2).mean(1) + 1e-12), len(x) / 8000


def loudest_window(path):
    e, dur = env_8k(path)
    w = int(TRIM * 10)
    if len(e) <= w: return 0.0, dur
    c = np.convolve(e ** 2, np.ones(w), "valid")
    return float(np.argmax(c)) / 10, dur


def prerank(nid, files):
    order = {r["id"]: (i, r) for i, r in enumerate(cands.get(nid, []))}
    kind = needs[nid]["kind"]

    def key(f):
        cid = os.path.splitext(os.path.basename(f))[0]
        i, r = order.get(cid, (999, {"license": "by", "duration_s": 0}))
        d = r.get("duration_s", 0)
        fit = (0 if 60 <= d <= 900 else 1) if kind == "amb" else (0 if d <= 30 else 1)
        return (r["license"] != "cc0", fit, i)
    return sorted(files, key=key)[:PER]


def slim(m):
    return {"z": m.get("z"), "verdict": m.get("verdict"), "p_vs_alts": m.get("p_vs_alts"),
            "closest_vocab": [(x["term"], round(x["z"], 2)) for x in m.get("closest_vocab", [])[:3]]}


from earshot import api  # noqa: E402  (models load lazily on first use)

for nid, n in needs.items():
    if nid in out: continue
    files = sorted(glob.glob(os.path.join(W, "wav", nid, "*.flac")) + glob.glob(os.path.join(W, "wav", nid, "*.wav")))
    if not files: continue
    files = prerank(nid, files)
    td = os.path.join(W, "trim", nid); os.makedirs(td, exist_ok=True)
    trims = {}
    for f in files:
        cid = os.path.splitext(os.path.basename(f))[0]
        off, dur = loudest_window(f)
        t = os.path.join(td, cid + ".wav")
        subprocess.run(["ffmpeg", "-nostdin", "-v", "error", "-y", "-ss", f"{off:.2f}", "-t", f"{TRIM}", "-i", f,
                        "-ar", "48000", "-c:a", "pcm_s16le", t], check=True, timeout=120)
        trims[cid] = (t, off, dur)
    brief, alts, kind = n["brief"], n["alts"], n["kind"]
    rk = api.rank([v[0] for v in trims.values()], brief)
    rec = {"brief": brief, "alts": alts, "method": f"15 s loudest-window trims, <= {PER} candidates",
           "rank_summary": rk["summary"], "rank": [(r["name"], r["z"], r["verdict"]) for r in rk["results"]], "files": {}}
    for cid, (t, off, dur) in trims.items():
        fr = {"dur": round(dur, 2), "trim_s": [round(off, 2), round(min(dur, off + TRIM), 2)]}
        try:
            fr["match"] = slim(api.match(t, brief, alts=alts))
            fr["human_voice_z"] = api.match(t, HUMAN_Q).get("z")
            rl = api.realness(t)
            fr["realness"] = {"p_real": rl.get("p_real"), "verdict": rl.get("verdict")}
            if kind == "amb":
                c = off + TRIM / 2
                s0 = max(0.0, min(c - BED_SECTION / 2, dur - BED_SECTION)); s1 = min(dur, s0 + BED_SECTION)
                fr["section"] = [round(s0, 2), round(s1, 2)]
            else:
                fd = api.find(t, brief, top=4)
                fr["moments"] = []
                for s in fd.get("segments", []):
                    hz = api.match(t, HUMAN_Q, start=s["start"], end=max(s["end"], s["start"] + 0.3)).get("z")
                    fr["moments"].append({"start": round(off + s["start"], 3), "end": round(off + s["end"], 3),
                                          "z": s.get("z"), "verdict": s.get("verdict"), "human_voice_z": hz})
        except Exception as e:
            fr["error"] = str(e)
        rec["files"][cid] = fr
        m = fr.get("match", {})
        print(nid, cid[:12], m.get("z"), m.get("verdict"), fr.get("realness", {}).get("verdict"), "voice", fr.get("human_voice_z"), flush=True)
    out[nid] = rec
    json.dump(out, open(vp, "w"), indent=1, default=str)
    print("saved", nid, flush=True)
