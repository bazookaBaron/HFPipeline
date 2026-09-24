# Audio: percussive-onset detection (HPSS percussive part) + music-bed / loudness profile.
import sys, json, numpy as np, librosa
key, path = sys.argv[1], sys.argv[2]
y, sr = librosa.load(path, sr=22050, mono=True)
hop = 256
H, P = librosa.effects.hpss(y, margin=2.0)
env_p = librosa.onset.onset_strength(y=P, sr=sr, hop_length=hop)
env_all = librosa.onset.onset_strength(y=y, sr=sr, hop_length=hop)
on_p = librosa.onset.onset_detect(onset_envelope=env_p, sr=sr, hop_length=hop, units="time", backtrack=False, delta=0.25)
on_all = librosa.onset.onset_detect(onset_envelope=env_all, sr=sr, hop_length=hop, units="time", backtrack=False)
# strong percussive transients only: envelope value at onset above the 90th percentile
tp = librosa.times_like(env_p, sr=sr, hop_length=hop)
thr = np.percentile(env_p, 90)
strong = [float(t) for t in on_p if env_p[min(int(round(t * sr / hop)), len(env_p) - 1)] >= thr]
# high-band (>5 kHz) transient energy: pops/clicks/whooshes are broadband, voiced speech is not
S = np.abs(librosa.stft(y, n_fft=1024, hop_length=hop))
freqs = librosa.fft_frequencies(sr=sr, n_fft=1024)
hb = S[freqs > 5000].sum(0); lb = S[(freqs > 80) & (freqs < 4000)].sum(0)
rms = librosa.feature.rms(y=y, hop_length=hop)[0]
json.dump({"dur": len(y) / sr, "onsets_perc": [float(x) for x in on_p], "onsets_perc_strong": strong,
           "onsets_all": [float(x) for x in on_all],
           "rms_db_pct": {q: float(20 * np.log10(np.percentile(rms, q) + 1e-9)) for q in (5, 10, 25, 50, 90)},
           "hb_ratio_median": float(np.median(hb / (lb + 1e-9)))}, open(f"{key}.audio.json", "w"))
np.savez_compressed(f"{key}.audio.npz", env_p=env_p, env_all=env_all, rms=rms, hb=hb, lb=lb, hop=hop, sr=sr)
print(key, "perc onsets", len(on_p), "strong", len(strong))
