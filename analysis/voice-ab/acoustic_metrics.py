"""Read saved A/B WAVs; calculate silence and rough F0 without GPU."""
import json
from pathlib import Path
import numpy as np
import soundfile as sf

root = Path(__file__).resolve().parent
rows = json.loads((root / "all-results.json").read_text(encoding="utf8"))
result = []
for row in rows:
    if "postAudio" not in row:
        continue
    audio, sr = sf.read(row["postAudio"], always_2d=True)
    y = audio.mean(axis=1)
    n20 = round(sr * 0.02)
    blocks = y[:len(y)//n20*n20].reshape(-1, n20)
    quiet = float(np.mean(np.sqrt(np.mean(blocks**2, axis=1)) < .001) * 100)
    n40 = round(sr * .04)
    f0 = []
    for center in range(n40//2, min(len(y)-n40//2, round(25*sr)), n40):
        frame = y[center-n40//2:center+n40//2]
        if np.sqrt(np.mean(frame**2)) < 10**(-32/20):
            continue
        frame = (frame-frame.mean()) * np.hanning(len(frame))
        ac = np.correlate(frame, frame, mode="full")[len(frame)-1:]
        lo, hi = round(sr/400), round(sr/80)
        lag = lo + int(np.argmax(ac[lo:hi]))
        if ac[lag] / (ac[0] + 1e-10) >= .6:
            f0.append(sr/lag)
    duration = len(y)/sr
    result.append({"case":row["case"], "durationSeconds":round(duration,3),
                   "finalWpm":round(row["wordCount"]*60/duration,1),
                   "quietBelow60dBPercent":round(quiet,2),
                   "f0MedianHz":round(float(np.median(f0)),1) if f0 else None,
                   "acceptedF0Frames":len(f0)})
(root / "acoustic-results.json").write_text(json.dumps(result,indent=2),encoding="utf8")
for item in result:
    print(json.dumps(item))
