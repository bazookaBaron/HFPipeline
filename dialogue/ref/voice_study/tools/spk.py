"""ECAPA per ASR segment + 1.2 s sliding windows; 2-way cosine k-means on segments; window labels flag intra-segment changes."""
import json, os, sys
os.environ.setdefault("HF_HOME", "C:/Repos/HFPipleine/.vendor/hf-home")
import numpy as np, torch, soundfile as sf
torch.set_num_threads(4)
from speechbrain.inference.speaker import EncoderClassifier
from speechbrain.utils.fetching import LocalStrategy
SB = "C:/Repos/HFPipleine/.vendor/hf-home/speechbrain/spkrec-ecapa-voxceleb"
ec = EncoderClassifier.from_hparams(source="speechbrain/spkrec-ecapa-voxceleb", savedir=SB, run_opts={"device": "cpu"}, local_strategy=LocalStrategy.COPY)
def emb(x):
    with torch.no_grad():
        e = ec.encode_batch(torch.from_numpy(x).unsqueeze(0)).squeeze().numpy()
    return e / np.linalg.norm(e)
def km2(E):
    S = E @ E.T; i, j = np.unravel_index(np.argmin(S), S.shape)
    C = np.stack([E[i], E[j]])
    for _ in range(50):
        lab = np.argmax(E @ C.T, 1)
        C = np.stack([E[lab == k].mean(0) for k in (0, 1)]); C /= np.linalg.norm(C, axis=1, keepdims=True)
    return lab, C
for v in sys.argv[1:]:
    x, sr = sf.read(f"{v}.16k.wav", dtype="float32")
    segs = json.load(open(f"{v}.asr.json"))
    E = np.stack([emb(x[int(s["start"] * sr):max(int(s["end"] * sr), int(s["start"] * sr) + 8000)]) for s in segs])
    lab, C = km2(E)
    sims = E @ C.T
    wins = []
    for t in np.arange(0, len(x) / sr - 1.2, 0.25):
        e = emb(x[int(t * sr):int((t + 1.2) * sr)]); s = e @ C.T
        wins.append({"t": round(float(t + 0.6), 2), "s0": round(float(s[0]), 3), "s1": round(float(s[1]), 3)})
    out = {"centroid_sim": float(C[0] @ C[1]),
           "segments": [{"i": k, "start": s["start"], "end": s["end"], "text": s["text"], "spk": int(lab[k]),
                         "sim0": round(float(sims[k, 0]), 3), "sim1": round(float(sims[k, 1]), 3)} for k, s in enumerate(segs)],
           "windows": wins}
    json.dump(out, open(f"{v}.spk.json", "w"), indent=1)
    print(v, "centroid cos", round(out["centroid_sim"], 3))
    for s in out["segments"]:
        print(f'{s["start"]:6.2f} S{s["spk"]+1} {s["sim0"]:.2f}/{s["sim1"]:.2f} {s["text"]}')
