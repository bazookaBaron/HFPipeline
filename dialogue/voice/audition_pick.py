"""whisper venv: pick best audition take per (char,opt,line) -> casting/<char>_<opt>.wav; embeddings; report.md.
Pick: reject any take with a wrong/missing word (WER>0 after normalisation; falls back to lowest WER), then
highest pitch variance (std of f0 in semitones). Keeps only the pick."""
import json
import os
import subprocess
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(__file__))
from common import *

items = json.load(open(CAST / "audition_manifest.json"))
groups = {}
for it in items:
    if not os.path.exists(it["out"]):
        continue
    x, sr = read_wav(it["out"])
    hyp = transcribe(it["out"])
    f0 = pitch_track(x, sr)
    it.update(whisper=hyp, wer=round(wer(it["text"], hyp), 3), dur=len(x) / sr,
              pitch_std_st=float(np.std(12 * np.log2(f0 / np.median(f0)))) if len(f0) > 20 else 0.0,
              f0_med=float(np.median(f0)) if len(f0) else 0.0)
    groups.setdefault((it["char"], it["opt"], it["line"]), []).append(it)
    print(it["char"], it["opt"], it["line"], it["seed"], "wer", it["wer"], "pstd", round(it["pitch_std_st"], 2), flush=True)

picks, rows = {}, {}
for (c, o, li), cands in sorted(groups.items()):
    ok = [t for t in cands if t["wer"] == 0] or [min(cands, key=lambda t: t["wer"])]
    best = max(ok, key=lambda t: t["pitch_std_st"])
    best["rejected"] = len(cands) - len(ok)
    best["all_clean"] = best["wer"] == 0
    picks.setdefault((c, o), []).append(best)

REPORT = {"picks": {}}
for (c, o), ps in picks.items():
    segs = []
    for p in sorted(ps, key=lambda t: t["line"]):
        x, sr = read_wav(p["out"])
        segs += [x, np.zeros(int(0.6 * sr), np.float32)]
    write_wav(CAST / f"{c}_{o}.wav", np.concatenate(segs[:-1]), 24000)
    REPORT["picks"][f"{c}_{o}"] = [{k: p[k] for k in ("line", "text", "tag", "seed", "whisper", "wer", "dur", "gen_s",
                                    "pitch_std_st", "f0_med", "rejected", "all_clean") if k in p} for p in ps]

# embeddings: reference clips + the concatenated auditions
wavs = [str(REFS / f"{c}_{o}.wav") for c in CHARS for o in OPTS] + [str(CAST / f"{c}_{o}.wav") for c in CHARS for o in OPTS]
json.dump(wavs, open(CAND / "emb_in.json", "w"))
subprocess.run([VENV_COSY, "-I", str(ROOT / "embed.py"), str(CAND / "emb_in.json"), str(CAND / "emb_out.json")], check=True)
E = json.load(open(CAND / "emb_out.json"))


def cos(a, b):
    return float(np.dot(E[a], E[b]))


def stats(kind):
    keys = [(c, o) for c in CHARS for o in OPTS]
    f = lambda c, o: str((REFS if kind == "ref" else CAST) / f"{c}_{o}.wav")
    within, cross, worst = [], [], []
    for i, (c1, o1) in enumerate(keys):
        for (c2, o2) in keys[i + 1:]:
            v = cos(f(c1, o1), f(c2, o2))
            (within if c1 == c2 else cross).append(v)
            if c1 != c2:
                worst.append((v, f"{c1}_{o1}", f"{c2}_{o2}"))
    return within, cross, sorted(worst, reverse=True)


md = ["# Voice casting report", "", "Parler-TTS Mini v1.1 designs (text description + fixed seed) -> CosyVoice 3 instruct2 auditions.",
      "Cosine = CosyVoice campplus.onnx speaker embedding. Cross-character threshold: >0.75 flagged.", ""]
prov = json.load(open(CAST / "provenance.json"))
md += ["## Options", "", "| option | description | ref seed | ref dur | ref WER | audition WER (clean takes) | f0 median Hz | pitch std (st) | gen s/line |", "|---|---|---|---|---|---|---|---|---|"]
for c in CHARS:
    for o in OPTS:
        k = f"{c}_{o}"
        P, ps = prov[k], REPORT["picks"].get(k, [])
        wers = ", ".join(f"{p['wer']:.2f}" + ("" if p["all_clean"] else "!") for p in ps)
        f0 = np.mean([p["f0_med"] for p in ps]) if ps else 0
        st = np.mean([p["pitch_std_st"] for p in ps]) if ps else 0
        gs = np.mean([p["gen_s"] for p in ps if "gen_s" in p]) if ps else 0
        md.append(f"| {k} | {P['description'].replace(' Very close-sounding recording, no background noise, very clear audio.', '')} | {P['seed']} | {P['duration_s']} s | {P['wer']} | {wers} | {f0:.0f} | {st:.2f} | {gs:.1f} |")
flag = False
for kind, title in (("ref", "Reference clips (Parler)"), ("aud", "Audition renders (CosyVoice instruct2)")):
    w, x, worst = stats(kind)
    md += ["", f"## Distinctness: {title}", "", f"- within-character option pairs: mean {np.mean(w):.2f}, max {np.max(w):.2f}",
           f"- cross-character pairs: mean {np.mean(x):.2f}, max {np.max(x):.2f}", "- most similar cross-character pairs:"]
    md += [f"  - {a} / {b}: {v:.2f}" + ("  **FLAG >0.75**" if v > 0.75 else "") for v, a, b in worst[:5]]
    flag |= any(v > 0.75 for v, _, _ in worst)
md += ["", "## Per-line picks", ""]
for k, ps in REPORT["picks"].items():
    for p in ps:
        md.append(f"- {k} line {p['line']} [{p['tag']}] seed {p['seed']} wer {p['wer']} ({p['rejected']} rejected) dur {p['dur']:.1f}s gen {p.get('gen_s','?')}s: \"{p['whisper']}\"")
md += ["", "FLAGGED: " + ("yes, see above" if flag else "none")]
open(CAST / "report.md", "w").write("\n".join(md))
json.dump({"picks": REPORT["picks"]}, open(CAST / "audition_picks.json", "w"), indent=1)
print("report written")
