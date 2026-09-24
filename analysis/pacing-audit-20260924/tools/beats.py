# Beat detection + stats. usage: beats.py KEY [excl_row_lo excl_row_hi]  (rows in 16-band grid, inclusive; excludes caption band)
import sys, json, re, numpy as np
key = sys.argv[1]
excl = (int(sys.argv[2]), int(sys.argv[3])) if len(sys.argv) > 3 else None
FPS = 30.0; GC, GR = 4, 16
d = np.load(f"{key}.frames.npz")
cells = d["cells"].reshape(-1, GR, GC)
if excl: cells[:, excl[0]:excl[1] + 1, :] = 0
cells = cells.reshape(len(cells), -1)
cut = d["cut"]; N = len(cells); dur = N / FPS
ON, QUIET = 0.03, 0.008
onsets = []
for t in range(3, N):
    hit = (cells[t] >= ON) & (cells[t - 3:t].max(0) < QUIET)
    if hit.any(): onsets.append((t, np.where(hit)[0]))
cuts = [t for t in range(1, N) if cut[t] > 0.30]
# merge cut frames closer than 3 frames
mc = []
for t in cuts:
    if not mc or t - mc[-1] > 3: mc.append(t)
ev = sorted([(t, c, False) for t, c in onsets] + [(t, np.arange(GC * GR), True) for t in mc], key=lambda x: x[0])
beats = []
for t, c, iscut in ev:
    if beats and t - beats[-1]["f"] <= 3:
        beats[-1]["cells"] = np.union1d(beats[-1]["cells"], c); beats[-1]["cut"] |= iscut
    else:
        beats.append({"f": t, "cells": np.array(c), "cut": iscut})
# settle duration + activity-profile shape per beat
for b in beats:
    f0 = b["f"]; cs = b["cells"]
    act = cells[:, cs].mean(1)
    e = f0
    while e + 1 < N and not (act[e + 1] < 0.004 and (e + 2 >= N or act[e + 2] < 0.004)) and e - f0 < 90: e += 1
    seg = act[f0:e + 1]
    b["settle_ms"] = (e - f0 + 1) / FPS * 1000
    b["peak_pos"] = float(np.argmax(seg) / max(len(seg) - 1, 1)) if len(seg) > 1 else 0.0
    # overshoot proxy: activity dips then re-rises within the settle window
    b["rebound"] = bool(len(seg) > 4 and seg.min() < 0.3 * seg.max() and np.argmin(seg) < len(seg) - 2 and seg[np.argmin(seg):].max() > 0.4 * seg.max())
    b["area"] = float(len(cs) / (GC * GR))
    b["t"] = f0 / FPS
bt = np.array([b["t"] for b in beats]); gaps = np.diff(bt) * 1000
def dist(x):
    x = np.asarray(x)
    return {k: round(float(v), 1) for k, v in zip(["min", "p10", "p25", "median", "p75", "p90", "max", "mean"],
            [x.min(), *np.percentile(x, [10, 25, 50, 75, 90]), x.max(), x.mean()])} if len(x) else {}
# holds
order = np.argsort(-gaps)[:12]
holds = [{"from": round(bt[i], 2), "to": round(bt[i + 1], 2), "ms": round(gaps[i])} for i in sorted(order)]
# per-10s windows beats count (burstiness)
win = np.histogram(bt, bins=np.arange(0, dur + 10, 10))[0].tolist()
# narration
asr = json.load(open(f"{key}.asr.json"))
words = [w for s in asr for w in s["words"]]
wt = np.array([w["s"] for w in words])
sents, cur = [], []
for w in words:
    cur.append(w)
    if re.search(r"[.!?]$", w["w"]): sents.append((cur[0]["s"], cur[-1]["e"], len(cur))); cur = []
if cur: sents.append((cur[0]["s"], cur[-1]["e"], len(cur)))
bps = [int(((bt >= s) & (bt < (sents[i + 1][0] if i + 1 < len(sents) else dur))).sum()) for i, (s, e, n) in enumerate(sents)]
speech = sum(e - s for s, e, n in sents)
def near(ts, ref, lo, hi):
    ref = np.sort(ref)
    if not len(ref): return 0.0
    i = np.searchsorted(ref, ts + lo)
    ok = [(j < len(ref) and ref[j] <= t + hi) for t, j in zip(ts, i)]
    return float(np.mean(ok)) if len(ok) else 0.0
rng = np.random.default_rng(0)
def vs_chance(ref, lo, hi):
    real = near(bt, ref, lo, hi)
    ch = np.mean([near(np.clip(bt + rng.uniform(-3, 3, len(bt)), 0, dur), ref, lo, hi) for _ in range(40)])
    return {"real": round(real, 3), "chance": round(float(ch), 3)}
au = json.load(open(f"{key}.audio.json"))
an = np.load(f"{key}.audio.npz"); env = an["env_p"]; hop = int(an["hop"]); sr = int(an["sr"])
def prominent(r):
    out = []
    for t in au["onsets_perc"]:
        i = min(int(round(t * sr / hop)), len(env) - 1); w = int(sr / hop * 0.75)
        loc = np.median(env[max(0, i - w):i + w])
        if env[i] >= r * max(loc, 1e-6) and env[i] >= np.percentile(env, 95): out.append(t)
    return np.array(out)
sfx = prominent(4.0)
res = {
 "key": key, "dur_s": round(dur, 2), "frames": N, "excluded_rows_16grid": excl,
 "beats": len(beats), "beats_per_min": round(len(beats) / dur * 60, 1),
 "cuts": len(mc), "cuts_per_min": round(len(mc) / dur * 60, 1),
 "gap_ms": dist(gaps), "gap_hist_ms": dict(zip(["<200", "200-400", "400-700", "700-1000", "1-2s", "2-3s", "3-5s", ">5s"],
     np.histogram(gaps, bins=[0, 200, 400, 700, 1000, 2000, 3000, 5000, 1e9])[0].tolist())),
 "time_in_holds_over_1s_pct": round(float(gaps[gaps > 1000].sum() / 1000 / dur * 100), 1),
 "time_in_holds_over_2s_pct": round(float(gaps[gaps > 2000].sum() / 1000 / dur * 100), 1),
 "longest_holds": holds, "beats_per_10s_window": win,
 "settle_ms": dist([b["settle_ms"] for b in beats]), "peak_pos": dist([b["peak_pos"] for b in beats]),
 "rebound_frac": round(float(np.mean([b["rebound"] for b in beats])), 3),
 "beat_area_frac": dist([b["area"] for b in beats]),
 "words": len(words), "wpm": round(len(words) / dur * 60, 1), "sentences": len(sents),
 "speech_s": round(speech, 1), "words_per_sentence": dist([n for _, _, n in sents]),
 "beats_per_sentence": dist(bps),
 "beat_on_word_onset_pm80ms": vs_chance(wt, -0.08, 0.08),
 "beat_to_prominent_transient_-50_+80": vs_chance(sfx, -0.05, 0.08),
 "prominent_transients_per_min": round(len(sfx) / dur * 60, 1),
 "prominent_transients_near_a_beat_frac": round(near(sfx, bt, -0.08, 0.05), 3),
 "hues_per_frame": dist(d["hues"]), "hue_count_frac": {str(k): round(float((d["hues"] == k).mean()), 3) for k in range(0, 7)},
 "saturated_px_frac": dist(d["huefrac"] * 100),
 "mean_lum": dist(d["lum"]), "corner_lum": dist(d["bgcorner"]),
 "audio": {k: au[k] for k in ("rms_db_pct", "hb_ratio_median")},
}
rc = d["row_content"]; rch = d["row_change"]; Hh = len(rc)
def edge(prof, thr):
    idx = np.where(prof > thr)[0]
    return (int(idx[0] * 1920 / Hh), int((Hh - 1 - idx[-1]) * 1920 / Hh)) if len(idx) else None
res["content_margin_px_top_bottom(1920)"] = {"content>5%": edge(rc, 0.05), "content>15%": edge(rc, 0.15), "change>0.5%": edge(rch, 0.005)}
res["row_content_profile_16"] = [round(float(x), 3) for x in rc.reshape(16, -1).mean(1)]
res["row_change_profile_16"] = [round(float(x), 4) for x in rch.reshape(16, -1).mean(1)]
json.dump(res, open(f"{key}.stats{'_excl' if excl else ''}.json", "w"), indent=1)
with open(f"{key}.beats{'_excl' if excl else ''}.tsv", "w") as fh:
    fh.write("t_s\tgap_ms_to_next\tcut\tarea\tsettle_ms\tpeak_pos\trebound\trows16\n")
    for i, b in enumerate(beats):
        rows = sorted(set(int(c) // GC for c in b["cells"]))
        fh.write(f"{b['t']:.3f}\t{(gaps[i] if i < len(gaps) else 0):.0f}\t{int(b['cut'])}\t{b['area']:.2f}\t{b['settle_ms']:.0f}\t{b['peak_pos']:.2f}\t{int(b['rebound'])}\t{rows[0]}-{rows[-1]}\n")
print(json.dumps({k: res[k] for k in ("key", "beats", "beats_per_min", "cuts_per_min", "gap_ms")}))
