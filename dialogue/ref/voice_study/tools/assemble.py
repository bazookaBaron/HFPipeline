"""earshot venv: merge segments into turns, robust gaps, f0 (yin+clarity), loudness, emphasis words, fillers; writes <v>.turns.json/.csv"""
import json, sys, csv, re, numpy as np, librosa
OVR = {"A": {7: 1}}   # seg 7 "12 million." -> speaker index 1 (Claude): content + f0 band; ECAPA weak (0.26/0.11)
ROLE = {"A": {0: "USER", 1: "CLAUDE"}, "B": {1: "USER", 0: "CLAUDE"}}
FILLERS = re.compile(r"^(um+|uh+|like|so|okay|ok|wait|well|i mean|you know|literally|actually|god)$", re.I)
for v in sys.argv[1:]:
    y, sr = librosa.load(f"{v}.16k.wav", sr=16000)
    db = 20 * np.log10(librosa.feature.rms(y=y, frame_length=800, hop_length=160)[0] + 1e-6)
    f0, clar = np.load(f"{v}.yin.npy"); n = min(len(f0), len(db)); f0, clar, db = f0[:n], clar[:n], db[:n]
    P = json.load(open(f"{v}.prosody.json")); A = json.load(open(f"{v}.asr.json"))
    E = json.load(open(f"{v}.earshot.json")) if __import__("os").path.exists(f"{v}.earshot.json") else {"segments": []}
    es = {s["i"]: s for s in E["segments"]}
    segs = []
    for s, a in zip(P["segments"], A):
        spk = OVR.get(v, {}).get(s["i"], s["spk"])
        segs.append({"i": s["i"], "spk": spk, "text": a["text"], "s": a["words"][0]["s"], "e": a["words"][-1]["e"], "words": a["words"]})
    F = lambda t: int(round(t / 0.01))
    def gap_between(e_prev, s_next, ws_prev, we_next):
        lo, hi = F(min(e_prev, s_next) - 0.25), F(max(e_prev, s_next) + 0.25)
        lo = max(lo, F(ws_prev)); hi = min(hi, F(we_next))
        seg = db[lo:hi]
        if len(seg) < 3: return round(s_next - e_prev, 2), "asr"
        k = int(np.argmin(seg)); thr = seg[k] + 6
        a = k
        while a > 0 and seg[a - 1] < thr: a -= 1
        b = k
        while b < len(seg) - 1 and seg[b + 1] < thr: b += 1
        dip = (b - a + 1) * 0.01
        return (round(dip, 2), "energy") if dip >= 0.05 else (0.0, "no dip (latched/overlap)")
    # speaker f0 median on confident frames
    spk_med = {}
    for sp in (0, 1):
        hz = np.concatenate([f0[F(g["s"]):F(g["e"])][clar[F(g["s"]):F(g["e"])] > 0.75] for g in segs if g["spk"] == sp])
        spk_med[sp] = float(np.median(hz))
    def fold(h, M):
        h = h.copy(); h[h > 1.75 * M] /= 2; h[h < M / 1.75] *= 2; return h
    turns = []
    for g in segs:
        if turns and turns[-1]["spk"] == g["spk"]:
            t = turns[-1]; t["segs"].append(g)
        else:
            turns.append({"spk": g["spk"], "segs": [g]})
    rows = []
    for k, t in enumerate(turns):
        words = [w for g in t["segs"] for w in g["words"]]
        s, e = words[0]["s"], words[-1]["e"]
        sl = slice(F(s), F(e)); M = spk_med[t["spk"]]
        m = clar[sl] > 0.6; raw = f0[sl][m]; fh = fold(raw, M) if len(raw) else raw
        st = 12 * np.log2(fh / M) if len(fh) else np.array([0.0])
        lvl = db[sl]; spk_lvl = lvl[lvl > np.percentile(lvl, 30)]
        inner = []
        for i in range(len(words) - 1):
            gp = words[i + 1]["s"] - words[i]["e"]
            if gp >= 0.4: inner.append({"after": words[i]["w"].strip(), "ms": int(gp * 1000)})
        # emphasis: words whose peak dB or folded f0 is >1 SD above the turn mean
        wf = []
        for w in words:
            ws = slice(F(w["s"]), max(F(w["e"]), F(w["s"]) + 1)); mm = clar[ws] > 0.6
            hz = fold(f0[ws][mm], M) if mm.any() else np.array([])
            wf.append((w["w"].strip(), float(db[ws].max()), float(12 * np.log2(np.median(hz) / M)) if len(hz) else np.nan, w["e"] - w["s"]))
        pk = np.array([x[1] for x in wf]); ps = np.array([x[2] for x in wf]); du = np.array([x[3] for x in wf])
        emph = [x[0] for j, x in enumerate(wf) if (pk[j] > pk.mean() + pk.std() * 0.9 and len(wf) > 2) or
                (not np.isnan(ps[j]) and np.nanstd(ps) > 0 and ps[j] > np.nanmean(ps) + 1.0 * np.nanstd(ps) and len(wf) > 2)]
        long_w = [x[0] for j, x in enumerate(wf) if du[j] > 0.45 and len(x[0]) <= 8]
        third = lambda q: (lambda h: round(float(np.median(12 * np.log2(fold(h, M) / M))), 1) if len(h) > 4 else None)(
            f0[F(s) + q * (F(e) - F(s)) // 3:F(s) + (q + 1) * (F(e) - F(s)) // 3][clar[F(s) + q * (F(e) - F(s)) // 3:F(s) + (q + 1) * (F(e) - F(s)) // 3] > 0.6])
        nxt = turns[k + 1] if k + 1 < len(turns) else None
        gap = gap_between(e, nxt["segs"][0]["words"][0]["s"], words[-1]["s"], nxt["segs"][0]["words"][0]["e"]) if nxt else (None, None)
        fill = [w[0] for w in wf if FILLERS.match(re.sub(r"[^\w' ]", "", w[0]))]
        er = [es.get(g["i"], {}) for g in t["segs"]]
        rows.append({"turn": k + 1, "speaker": f"SPEAKER {1 if t['spk'] == (0 if v == 'A' else 1) else 2}", "role": ROLE[v][t["spk"]],
                     "start": round(s, 2), "end": round(e, 2), "text": " ".join(g["text"] for g in t["segs"]),
                     "words": len(words), "dur": round(e - s, 2), "wpm": round(len(words) / max(e - s, .1) * 60),
                     "f0_med_hz": round(float(M * 2 ** (np.median(st) / 12)), 1), "f0_raw_med_hz": round(float(np.median(raw)), 1) if len(raw) else None,
                     "st_vs_speaker": round(float(np.median(st)), 1), "st_p10_p90": [round(float(np.percentile(st, 10)), 1), round(float(np.percentile(st, 90)), 1)],
                     "contour_st_thirds": [third(0), third(1), third(2)], "voiced_frames": int(m.sum()),
                     "db_p50": round(float(np.median(spk_lvl)), 1), "db_peak": round(float(lvl.max()), 1),
                     "inner_pauses": inner, "emphasis_words": emph, "lengthened_words": long_w, "fillers": fill,
                     "gap_to_next_ms": None if gap[0] is None else int(gap[0] * 1000), "gap_method": gap[1],
                     "asr_gap_to_next_ms": int((nxt["segs"][0]["words"][0]["s"] - e) * 1000) if nxt else None,
                     "earshot_tone": [x.get("tone") for x in er], "earshot_gender": [x.get("gender", [None])[0] for x in er],
                     "earshot_laugh": [x.get("laugh") for x in er]})
    json.dump({"speaker_f0_median_hz": {ROLE[v][k]: round(x, 1) for k, x in spk_med.items()}, "turns": rows}, open(f"{v}.turns.json", "w"), indent=1)
    with open(f"{v}.turns.csv", "w", newline="", encoding="utf-8") as fh:
        wr = csv.writer(fh); keys = ["turn", "speaker", "role", "start", "end", "words", "wpm", "f0_med_hz", "st_vs_speaker", "st_p10_p90", "contour_st_thirds", "db_p50", "db_peak", "gap_to_next_ms", "gap_method", "emphasis_words", "inner_pauses", "text"]
        wr.writerow(keys)
        for r in rows: wr.writerow([json.dumps(r[x]) if isinstance(r[x], (list, dict)) else r[x] for x in keys])
    print(v, "speaker f0 medians", {ROLE[v][k]: round(x, 1) for k, x in spk_med.items()})
    for r in rows:
        tn = r["earshot_tone"][0][:2] if r["earshot_tone"] and r["earshot_tone"][0] else None
        print(f'{r["turn"]:2d} {r["start"]:6.2f} {r["role"]:6s} w{r["words"]:2d} {r["wpm"]:3d}wpm f0 {r["f0_med_hz"]}({r["f0_raw_med_hz"]}) st{r["st_vs_speaker"]:+} [{r["st_p10_p90"][0]},{r["st_p10_p90"][1]}] c{r["contour_st_thirds"]} dB {r["db_p50"]}/{r["db_peak"]} gap {r["gap_to_next_ms"]}({r["asr_gap_to_next_ms"]}) emph{r["emphasis_words"]} long{r["lengthened_words"]} pau{[p["ms"] for p in r["inner_pauses"]]} | {r["text"]} || {tn} {r["earshot_gender"][0]}')
