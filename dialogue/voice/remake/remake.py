"""omnivoice venv: re-voice a reference dialogue with our cloned voices, matching its expression.

usage: remake.py <dir with lines.json> [--seeds 6]
  gen   : every turn x text variant x seed, duration forced to the ref turn length (OmniVoice `duration`)
  pick  : per turn, the take whose pitch (semitones vs that voice's own median) best matches the ref turn:
          level (st_vs_speaker), range (p10..p90 width) and contour shape (thirds), weighted 1 / 1 / 1.5
  mix   : picked takes placed at the ref start times (same gaps), interrupted turns cut at the next start
Outputs: takes/*.wav, picks.json, remake.wav, abab.wav (ref turn then ours, for judging).
"""
import json, os, sys, wave
import numpy as np

HF = "C:/Repos/HFPipleine"
CB = HF + "/dialogue/voice/clone_bakeoff"
D = sys.argv[1]
SEEDS = int(sys.argv[sys.argv.index("--seeds") + 1]) if "--seeds" in sys.argv else 6
cfg = json.load(open(f"{D}/lines.json", encoding="utf-8"))
REF = json.load(open(cfg["ref_turns"]))
TURN = {t["turn"]: t for t in REF["turns"]}
VD = json.load(open(f"{CB}/voice_defaults.json"))
os.makedirs(f"{D}/takes", exist_ok=True)


def save(p, x, sr=24000):
    pcm = (np.clip(x, -1, 1) * 32767).astype("<i2")
    with wave.open(p, "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr); w.writeframes(pcm.tobytes())


def load(p):
    import librosa
    return librosa.load(p, sr=24000)[0]


# ------------------------------------------------------------------ gen
def gen():
    import torch, random
    from omnivoice import OmniVoice
    m = OmniVoice.from_pretrained("k2-fsa/OmniVoice", device_map="cuda:0", dtype=torch.float16)
    prompts = {}
    for role, v in cfg["voices"].items():
        d = VD[v]
        prompts[role] = m.create_voice_clone_prompt(ref_audio=f"{CB}/{d['ref_wav']}",
                                                   ref_text=open(f"{CB}/{d['ref_text']}", encoding="utf-8").read().strip())
    for ln in cfg["lines"]:
        t = TURN[ln["turn"]]
        dur = max(t["dur"], ln.get("min_dur", 0.5))
        for vi, text in enumerate(dict.fromkeys(ln["v"])):
            for s in range(SEEDS):
                out = f"{D}/takes/t{ln['turn']:02d}_v{vi}_s{s}.wav"
                if os.path.exists(out):
                    continue
                seed = 1000 * ln["turn"] + 10 * vi + s
                random.seed(seed); np.random.seed(seed); torch.manual_seed(seed); torch.cuda.manual_seed_all(seed)
                a = m.generate(text=text, voice_clone_prompt=prompts[t["role"]], duration=dur, language="en",
                               num_step=32, guidance_scale=VD[cfg["voices"][t["role"]]]["guidance"])
                a = a[0] if isinstance(a, (list, tuple)) else a
                a = np.asarray(a.detach().float().cpu().numpy() if hasattr(a, "detach") else a, dtype=np.float32).reshape(-1)
                save(out, a)
                print(f"t{ln['turn']:02d} v{vi} s{s} {len(a)/24000:.2f}s (ref {t['dur']:.2f})", flush=True)


# ------------------------------------------------------------------ pick
def f0_of(x):
    import librosa
    f0, vf, _ = librosa.pyin(x, fmin=60, fmax=550, sr=24000, frame_length=1024, hop_length=240)
    return f0[vf & ~np.isnan(f0)]


def feats(f0, med):
    if len(f0) < 5:
        return None
    st = 12 * np.log2(f0 / med)
    thirds = [float(np.median(c)) if len(c) else 0.0 for c in np.array_split(st, 3)]
    return {"level": float(np.median(st)), "p10p90": [float(np.percentile(st, 10)), float(np.percentile(st, 90))], "thirds": thirds}


def score(f, t):
    if f is None:
        return 99.0
    rw = t["st_p10_p90"][1] - t["st_p10_p90"][0]
    fw = f["p10p90"][1] - f["p10p90"][0]
    rc = np.array([c if c is not None else np.nan for c in t["contour_st_thirds"]], dtype=float)
    fc = np.array(f["thirds"])
    ok = ~np.isnan(rc)
    shape = float(np.mean(np.abs((fc[ok] - fc[ok].mean()) - (rc[ok] - rc[ok].mean())))) if ok.sum() >= 2 else 0.0
    return abs(f["level"] - t["st_vs_speaker"]) + abs(fw - rw) + 1.5 * shape


def pick():
    takes = {}
    for ln in cfg["lines"]:
        for p in sorted(os.listdir(f"{D}/takes")):
            if p.startswith(f"t{ln['turn']:02d}_") and p.endswith(".wav"):
                takes.setdefault(ln["turn"], []).append(p)
    f0s = {p: f0_of(load(f"{D}/takes/{p}")) for ps in takes.values() for p in ps}
    med = {}
    for role in cfg["voices"]:
        allf = np.concatenate([f0s[p] for tn, ps in takes.items() if TURN[tn]["role"] == role for p in ps] or [np.array([150.0])])
        med[role] = float(np.median(allf))
    picks = {}
    for tn, ps in takes.items():
        t = TURN[tn]
        ranked = sorted(((score(feats(f0s[p], med[t["role"]]), t), p, feats(f0s[p], med[t["role"]])) for p in ps), key=lambda r: r[0])
        sc, p, f = ranked[0]
        picks[tn] = {"take": p, "score": round(sc, 2), "ours": f, "ref": {k: t[k] for k in ("st_vs_speaker", "st_p10_p90", "contour_st_thirds", "dur")},
                     "runner_up": [r[1] for r in ranked[1:3]]}
        print(f"turn {tn:2d} {t['role']:6s} pick {p}  score {sc:.2f}  ours lvl {f['level'] if f else 'na'}", flush=True)
    json.dump({"voice_median_hz": med, "picks": picks}, open(f"{D}/picks.json", "w"), indent=1)
    return picks


# ------------------------------------------------------------------ mix
def mix(picks):
    import librosa
    sr = 24000
    end = max(t["end"] for t in REF["turns"]) + 1.0
    out = np.zeros(int(end * sr), np.float32)
    lines = {ln["turn"]: ln for ln in cfg["lines"]}
    order = sorted(picks)
    for i, tn in enumerate(order):
        t = TURN[tn]
        x = load(f"{D}/takes/{picks[tn]['take']}")
        idx = np.where(np.abs(x) > 0.01)[0]
        if len(idx):
            x = x[max(0, idx[0] - 240): idx[-1] + 1200]
        x = x / (np.percentile(np.abs(x), 99.5) + 1e-6) * 0.5
        if lines[tn].get("cut_tail") and i + 1 < len(order):
            room = int((TURN[order[i + 1]]["start"] - t["start"]) * sr)
            x = x[:room]; x[-120:] *= np.linspace(1, 0, min(120, len(x)))
        a = int(t["start"] * sr)
        out[a:a + len(x)] += x[: len(out) - a]
    save(f"{D}/remake.wav", out)
    # A/B: ref turn, short beep-free gap, our turn
    ref, _ = librosa.load(cfg["ref_turns"].replace(".turns.json", ".48k.wav"), sr=sr)
    ab = []
    for tn in order:
        t = TURN[tn]
        r = ref[int(t["start"] * sr): int(t["end"] * sr)]
        r = r / (np.percentile(np.abs(r), 99.5) + 1e-6) * 0.5
        o = load(f"{D}/takes/{picks[tn]['take']}")
        o = o / (np.percentile(np.abs(o), 99.5) + 1e-6) * 0.5
        ab += [r, np.zeros(int(0.35 * sr), np.float32), o, np.zeros(int(0.8 * sr), np.float32)]
    save(f"{D}/abab.wav", np.concatenate(ab))
    print("wrote remake.wav, abab.wav", flush=True)


if __name__ == "__main__":
    if "--no-gen" not in sys.argv:
        gen()
    mix(pick())
