"""earshot venv: per-segment + per-word prosody (librosa pyin f0, RMS dB), boundary refinement, gaps, noise floor."""
import json, sys
import numpy as np, librosa
HOP = 0.01
for v in sys.argv[1:]:
    y, sr = librosa.load(f"{v}.16k.wav", sr=16000)
    f0, vf, vp = librosa.pyin(y, fmin=65, fmax=550, sr=sr, frame_length=1024, hop_length=160)
    rms = librosa.feature.rms(y=y, frame_length=800, hop_length=160)[0]
    db = 20 * np.log10(rms + 1e-6)
    n = min(len(f0), len(db)); f0, vf, db = f0[:n], vf[:n], db[:n]
    t = np.arange(n) * HOP
    segs = json.load(open(f"{v}.spk.json"))["segments"]
    asr = json.load(open(f"{v}.asr.json"))
    floor = float(np.percentile(db, 5)); speechlvl = float(np.percentile(db, 90))
    thr = floor + 0.45 * (speechlvl - floor)
    act = db > thr
    def fr(a, b): return slice(max(0, int(a / HOP)), min(n, int(b / HOP)))
    def refine(s, e):
        # first/last active frame near ASR bounds
        a = fr(s - 0.25, s + 0.4); ia = np.nonzero(act[a])[0]
        b = fr(e - 0.4, e + 0.35); ib = np.nonzero(act[b])[0]
        rs = (a.start + ia[0]) * HOP if len(ia) else s
        re_ = (b.start + ib[-1]) * HOP if len(ib) else e
        return round(rs, 2), round(re_, 2)
    out = {"noise_floor_db": round(floor, 1), "speech_p90_db": round(speechlvl, 1), "vad_thr_db": round(thr, 1), "segments": []}
    for sg, a in zip(segs, asr):
        s, e = refine(a["words"][0]["s"], a["words"][-1]["e"])
        sl = fr(s, e)
        hz = f0[sl][vf[sl]]; d = db[sl][act[sl]]
        st = 12 * np.log2(hz / 100) if len(hz) else np.array([])
        words = []
        for w in a["words"]:
            ws = fr(w["s"], w["e"]); wh = f0[ws][vf[ws]]
            words.append({"w": w["w"].strip(), "s": round(w["s"], 2), "e": round(w["e"], 2), "p": round(w["p"], 2),
                          "f0": round(float(np.median(wh)), 1) if len(wh) else None,
                          "db": round(float(db[ws].max()), 1) if ws.stop > ws.start else None,
                          "dur": round(w["e"] - w["s"], 2)})
        gaps = [(round(words[i + 1]["s"] - words[i]["e"], 2), words[i]["w"]) for i in range(len(words) - 1)]
        # contour: f0 st median in first/last third
        def third(k):
            m = sl.stop - sl.start; q = slice(sl.start + k * m // 3, sl.start + (k + 1) * m // 3)
            h = f0[q][vf[q]]; return round(float(12 * np.log2(np.median(h) / 100)), 1) if len(h) > 3 else None
        nw = len(a["words"]); dur = max(e - s, 0.1)
        out["segments"].append({**{k: sg[k] for k in ("i", "text", "spk")}, "start": s, "end": e, "dur": round(dur, 2), "words_n": nw,
            "wpm": round(nw / dur * 60, 0), "f0_med": round(float(np.median(hz)), 1) if len(hz) else None,
            "st_p5": round(float(np.percentile(st, 5)), 1) if len(st) else None, "st_p95": round(float(np.percentile(st, 95)), 1) if len(st) else None,
            "st_range": round(float(np.percentile(st, 95) - np.percentile(st, 5)), 1) if len(st) else None,
            "db_med": round(float(np.median(d)), 1) if len(d) else None, "db_max": round(float(db[sl].max()), 1),
            "contour_st": [third(0), third(1), third(2)], "voiced_frac": round(float(vf[sl].mean()), 2),
            "inner_pauses": [g for g in gaps if g[0] >= 0.25], "words": words})
    for k in range(len(out["segments"]) - 1):
        out["segments"][k]["gap_after"] = round(out["segments"][k + 1]["start"] - out["segments"][k]["end"], 2)
    # gap-region level: is there a bed under the gaps?
    gl = []
    for k in range(len(out["segments"]) - 1):
        a, b = out["segments"][k]["end"] + 0.05, out["segments"][k + 1]["start"] - 0.05
        if b - a > 0.15: gl.append(float(np.median(db[fr(a, b)])))
    out["gap_level_db_median"] = round(float(np.median(gl)), 1) if gl else None
    json.dump(out, open(f"{v}.prosody.json", "w"), indent=1)
    print(v, "floor", out["noise_floor_db"], "speech p90", out["speech_p90_db"], "gap level", out["gap_level_db_median"])
    for s in out["segments"]:
        print(f'{s["start"]:6.2f}-{s["end"]:6.2f} S{s["spk"]+1} wpm{s["wpm"]:4.0f} f0 {s["f0_med"]} rng {s["st_range"]} db {s["db_med"]}/{s["db_max"]} c{s["contour_st"]} gap {s.get("gap_after")} | {s["text"]}')
