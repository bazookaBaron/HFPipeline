"""robust f0: librosa.yin + normalised-autocorrelation clarity gate + energy gate (pyin gave ~no voiced frames: bed/processing)."""
import json, sys, numpy as np, librosa
def track(y, sr, fmin, fmax, hop=160):
    fl = 1024
    f0 = librosa.yin(y, fmin=fmin, fmax=fmax, sr=sr, frame_length=fl, hop_length=hop)
    fr = librosa.util.frame(np.pad(y, fl // 2), frame_length=fl, hop_length=hop)[:, :len(f0)]
    clar = np.zeros(len(f0))
    for i in range(len(f0)):
        x = fr[:, i] - fr[:, i].mean(); lag = int(round(sr / f0[i]))
        if lag >= fl - 10: continue
        a, b = x[:-lag], x[lag:]
        clar[i] = (a @ b) / (np.sqrt((a @ a) * (b @ b)) + 1e-9)
    return f0, clar
for v in sys.argv[1:]:
    y, sr = librosa.load(f"{v}.16k.wav", sr=16000)
    f0, clar = track(y, sr, 60, 500)
    np.save(f"{v}.yin.npy", np.stack([f0, clar]))
    P = json.load(open(f"{v}.prosody.json"))
    for th in (0.5, 0.7):
        for spk in (0, 1):
            hz = []
            for s in P["segments"]:
                if s["spk"] != spk: continue
                a, b = int(s["start"] / .01), int(s["end"] / .01); m = clar[a:b] > th
                hz += list(f0[a:b][m])
            hz = np.array(hz); h, e = np.histogram(hz, bins=[60,80,100,120,140,160,180,200,230,260,300,350,400,500])
            print(v, th, "S%d" % (spk + 1), len(hz), "med", np.median(hz).round(1), dict(zip([int(x) for x in e[:-1]], h.tolist())))
