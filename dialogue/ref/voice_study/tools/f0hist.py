import json, sys, numpy as np, librosa
for v in sys.argv[1:]:
    y, sr = librosa.load(f"{v}.16k.wav", sr=16000)
    y = librosa.effects.preemphasis(y, coef=0.0)
    f0, vf, vp = librosa.pyin(y, fmin=60, fmax=600, sr=sr, frame_length=2048, hop_length=160)
    np.save(f"{v}.pyin.npy", np.stack([f0, vp]))
    P = json.load(open(f"{v}.prosody.json"))
    for spk in (0, 1):
        hz = []
        for s in P["segments"]:
            if s["spk"] != spk: continue
            a, b = int(s["start"] / .01), int(s["end"] / .01)
            m = vp[a:b] > 0.5
            hz += list(f0[a:b][m])
        hz = np.array(hz); h, e = np.histogram(hz, bins=[60,80,100,120,140,160,180,200,230,260,300,350,400,500,600])
        print(v, "S%d" % (spk + 1), len(hz), "med", np.median(hz).round(1), dict(zip([int(x) for x in e[:-1]], h.tolist())))
