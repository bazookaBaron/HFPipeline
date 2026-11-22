"""Mix QA gate. check(...) is called by docmix; CLI works on any finished mix:
  python runtime/audio/qa.py <mix.wav> [--voice vo/voice.wav --bed amb.wav,pad.wav --sfx sfx.wav] [--lufs -14]
Gates: integrated loudness within 0.7 LU of target, true peak <= -1.0 dBTP, zero clipped samples, and (with stems)
voice >= MIN_MARGIN dB over the bed (ambience + music) in 95 % of speech windows, silence beats really silent."""
import sys, json, argparse
import numpy as np, soundfile as sf
from scipy.signal import resample_poly
from dsp import SR, lufs, _kpow, st

MIN_MARGIN = 12.0      # dB, voice over ambience+music while speaking (5th percentile of 400 ms windows)
SFX_MASK = 4.0         # dB, an SFX louder than (voice - SFX_MASK) while speaking is flagged


def _win(x, B=int(0.4 * SR), H=int(0.1 * SR)):
    """Momentary (400 ms) K-weighted loudness every 100 ms."""
    p = _kpow(x); cs = np.concatenate([[0], np.cumsum(p)])
    idx = np.arange(0, max(1, len(p) - B), H); return -0.691 + 10 * np.log10((cs[idx + B] - cs[idx]) / B + 1e-15), idx / SR


def true_peak(x):
    """4x-oversampled peak; only 1 s blocks within 3 dB of the sample peak are oversampled (fast on full films)."""
    m = 0.0
    for c in st(x):
        B = SR; n = len(c) // B * B; pk = np.abs(c[:n]).reshape(-1, B).max(1) if n else np.array([np.abs(c).max()])
        for i in np.nonzero(pk >= pk.max() * 0.7)[0]:
            seg = c[max(0, i * B - 64):(i + 1) * B + 64].astype(np.float64); m = max(m, float(np.abs(resample_poly(seg, 4, 1)).max()))
        m = max(m, float(np.abs(c[n:]).max()) if len(c) > n else 0.0)
    return 20 * np.log10(m + 1e-12)


def check(mix, target=-14.0, voice=None, bed=None, sfx=None, silences=(), out=None):
    """mix/voice/bed/sfx: arrays at SR (stems in the same gain domain as each other). Returns (ok, report)."""
    R, fails = {}, []
    R['lufs'] = round(float(lufs(mix)), 2); R['true_peak'] = round(float(true_peak(mix)), 2)
    R['clipped'] = int((np.abs(mix) >= 0.999).sum())
    if abs(R['lufs'] - target) > 0.7: fails.append(f"loudness {R['lufs']} LUFS (target {target})")
    if R['true_peak'] > -1.0: fails.append(f"true peak {R['true_peak']} dBTP > -1.0")
    if R['clipped']: fails.append(f"{R['clipped']} clipped samples")
    if voice is not None and bed is not None:
        n = min(st(voice).shape[1], st(bed).shape[1]); Lv, tt = _win(st(voice)[:, :n]); Lb, _ = _win(st(bed)[:, :n])
        sp = Lv > lufs(voice) - 10
        if sp.any():
            m = Lv[sp] - Lb[sp]; R['voice_over_bed_p5'] = round(float(np.percentile(m, 5)), 1); R['voice_over_bed_median'] = round(float(np.median(m)), 1)
            worst = np.argsort(m)[:3]; R['worst_at'] = [round(float(tt[sp][i]), 1) for i in worst]
            if R['voice_over_bed_p5'] < MIN_MARGIN: fails.append(f"voice only {R['voice_over_bed_p5']} dB over bed (need {MIN_MARGIN}) near {R['worst_at']} s")
        if sfx is not None:
            Ls, _ = _win(st(sfx)[:, :n]); bad = sp & (Ls > Lv - SFX_MASK)
            R['sfx_masking_s'] = round(float(bad.sum() * 0.1), 1)
            if R['sfx_masking_s'] > 1.0: fails.append(f"SFX within {SFX_MASK} dB of the voice for {R['sfx_masking_s']} s")
        for t, d in silences:
            i0, i1 = int((t + 0.1) * SR), int((t + d) * SR)
            if i1 - i0 > int(0.2 * SR):
                lb = lufs(st(bed)[:, i0:i1] + (st(sfx)[:, i0:i1] if sfx is not None else 0), gated=False)
                if lb > lufs(voice) - 40: fails.append(f"silence beat at {t}s not silent ({lb - lufs(voice):.0f} dB rel voice)")
    R['pass'] = not fails; R['fails'] = fails
    print('QA', 'PASS' if not fails else 'FAIL', json.dumps({k: v for k, v in R.items() if k not in ('fails', 'pass')}))
    for f in fails: print('  QA FAIL:', f)
    if out: json.dump(R, open(out, 'w'), indent=1)
    return not fails, R


if __name__ == '__main__':
    ap = argparse.ArgumentParser(); ap.add_argument('mix'); ap.add_argument('--voice'); ap.add_argument('--bed'); ap.add_argument('--sfx')
    ap.add_argument('--lufs', type=float, default=-14); a = ap.parse_args()
    rd = lambda p: sf.read(p, dtype='float32')[0].T
    bed = None
    if a.bed:
        bs = [rd(p) for p in a.bed.split(',')]; n = min(st(b).shape[1] for b in bs); bed = sum(st(b)[:, :n] for b in bs)
    ok, _ = check(rd(a.mix), a.lufs, rd(a.voice) if a.voice else None, bed, rd(a.sfx) if a.sfx else None)
    sys.exit(0 if ok else 1)
