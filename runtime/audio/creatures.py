"""Synthesised animals, crowd reactions, footsteps and cloth/rigging/door foley for Doc2D (numpy/scipy only).
Contract (see sfx.py): fn(r, dur=None, **p) -> mono (n,) or stereo (2,n); GEN / TRIM / ROOM exported."""
import numpy as np
from dsp import SR, colored, lpf, hpf, bpf, smooth, shape, tvec, dexp, pan, st, add
from ambience import babble, VOW

TWO_PI = 2 * np.pi


# ------------------------------------------------------------------ helpers
def N(r, n): return r.standard_normal(n)
def sig(x): return 1 / (1 + np.exp(-x))


def fin(x, ms=15):
    """Remove DC, fade both edges (mono or stereo)."""
    x = x - x.mean(axis=-1, keepdims=True); m = min(int(ms / 1000 * SR), x.shape[-1] // 2)
    if m > 1:
        w = np.sin(np.linspace(0, np.pi / 2, m)) ** 2; x = x.copy(); x[..., :m] *= w; x[..., -m:] *= w[::-1]
    return x


def sput(buf, ev, i):
    """Add mono event into mono buffer at sample i (clipped)."""
    n = len(buf)
    if i >= n or i + len(ev) <= 0: return
    a = max(0, i); b = min(n, i + len(ev)); buf[a:b] += ev[a - i:b - i]


def env_ar(m, a, rel, curve=1.0):
    """Smooth attack/release envelope over m samples (attack a s, release rel s)."""
    t = tvec(m); ea = np.sin(np.clip(t / max(a, 1e-4), 0, 1) * np.pi / 2) ** 2
    er = np.sin(np.clip((m / SR - t) / max(rel, 1e-4), 0, 1) * np.pi / 2) ** 2
    return (ea * er) ** curve


def contour(m, knots, vals):
    """Piecewise-smooth contour over m samples; knots in 0..1."""
    x = np.interp(np.linspace(0, 1, m), knots, vals)
    k = max(3, int(m / 60)); return np.convolve(np.pad(x, k, mode='edge'), np.hanning(2 * k + 1) / np.hanning(2 * k + 1).sum(), 'same')[k:-k]


def hsrc(f0, formants, nh=40, tilt=1.0, floor=0.01, maxf=7000):
    """Additive harmonic source: harmonics of f0(t) weighted by gaussian formants [(F, bw, amp)] (F scalar or array)."""
    n = len(f0); H = 128; idx = np.arange(0, n, H); f0c = f0[idx]; ph = np.cumsum(TWO_PI * f0 / SR); out = np.zeros(n)
    kmax = int(max(1, min(nh, maxf / max(f0.min(), 20)))); ar = np.arange(n)
    Fc = [(F if np.isscalar(F) else np.asarray(F)[idx], bw, a) for F, bw, a in formants]
    for k in range(1, kmax + 1):
        fk = k * f0c; g = np.full(len(idx), floor)
        for F, bw, a in Fc: g = g + a * np.exp(-0.5 * ((fk - F) / bw) ** 2)
        g = g * k ** -tilt; g[fk > maxf] = 0
        out += np.interp(ar, idx, g) * np.sin(k * ph)
    return out / (out.std() + 1e-9)


def vox(r, m, f0, vow, fem=False, breath=0.12, vow2=None, bw=(90, 130, 200), amps=(1.0, 0.7, 0.4)):
    """Voiced segment: harmonic source through vowel formants (optionally gliding vow -> vow2)."""
    s = 1.15 if fem else 1.0; v1 = np.array(vow, float) * s
    v2 = v1 if vow2 is None else np.array(vow2, float) * s
    ramp = np.linspace(0, 1, m)
    fm = [(v1[k] + (v2[k] - v1[k]) * ramp, bw[k], amps[k]) for k in range(3)]
    y = hsrc(f0, fm, nh=20, maxf=5000)
    if breath > 0: y = y + breath * bpf(N(r, m), 1200, 5000) * 0.7
    return y


def vcontrol(r, m, base, rise=0.0, fall=0.0, vib=0.015, jit=0.012):
    """f0 contour: base * (1 + rise.. then fall) with vibrato/jitter."""
    x = np.linspace(0, 1, m); c = 1 + rise * np.sin(np.pi * np.clip(x * 2, 0, 1) / 2) - fall * x
    return base * c * (1 + vib * np.sin(TWO_PI * r.uniform(4.5, 6.5) * tvec(m) + r.uniform(0, 6))) * (1 + jit * smooth(m, 25, r))


def burst(r, m, tau, lo, hi, at=0.0004):
    return bpf(N(r, m), lo, hi) * dexp(m, tau, at)


def tone(f, tau, m, at=0.0008, ph=0.0):
    return np.sin(TWO_PI * f * tvec(m) + ph) * dexp(m, tau, at)


def modes(f0, ratios, taus, amps, m, r=None):
    y = np.zeros(m)
    for fr, ta, a in zip(ratios, taus, amps): y += a * tone(f0 * fr, ta, m, ph=0 if r is None else r.uniform(0, 6.28))
    return y


def sizeof(p, small, medium, large):
    return {'small': small, 'medium': medium, 'large': large}.get(p.get('size', 'medium'), medium)


# ------------------------------------------------------------------ animals
def bird(r, dur=None, **p):
    dur = dur or 3.0; n = int(dur * SR); out = np.zeros(n); t = r.uniform(0.05, 0.4)
    base = r.uniform(2400, 4300)
    while t < dur - 0.25:
        fb = base * r.uniform(0.85, 1.2); kind0 = r.integers(0, 3)
        for _ in range(int(r.integers(3, 9))):
            ty = r.choice(['chirp', 'trill', 'whistle', 'sweep']) if kind0 else r.choice(['chirp', 'chirp', 'trill'])
            d = r.uniform(0.03, 0.09) if ty in ('chirp', 'sweep') else (r.uniform(0.15, 0.38) if ty == 'trill' else r.uniform(0.08, 0.2))
            m = int(d * SR); x = np.linspace(0, 1, m); f0 = fb * r.uniform(0.8, 1.25)
            if ty == 'chirp': f = f0 * (1 + r.uniform(-0.3, 0.4) * x) + 400 * np.sin(TWO_PI * r.uniform(60, 140) * tvec(m)) * r.uniform(0.2, 1)
            elif ty == 'sweep': f = f0 * np.exp(r.choice([-1, 1]) * r.uniform(0.25, 0.6) * x)
            elif ty == 'trill':
                tr = r.uniform(18, 36); f = f0 * (1 + r.uniform(0.12, 0.3) * (1 - ((x * d * tr) % 1))) + 150 * np.sin(TWO_PI * 8 * tvec(m))
            else: f = f0 * (1 + 0.1 * np.sin(TWO_PI * r.uniform(8, 20) * tvec(m))) * (1 + r.uniform(-0.2, 0.25) * x)
            ph = np.cumsum(TWO_PI * np.clip(f, 1500, 8500) / SR)
            y = np.sin(ph) + 0.18 * np.sin(2 * ph + 0.5) + 0.05 * np.sin(3 * ph)
            e = np.sin(np.pi * x) ** 0.7
            if ty == 'trill': e = e * (0.55 + 0.45 * np.sin(TWO_PI * tr * tvec(m) - np.pi / 2)) ** 1.2
            sput(out, y * e * r.uniform(0.5, 1) * 0.3, int(t * SR)); t += d + r.uniform(0.015, 0.09)
        t += r.uniform(0.5, 1.6)
    out = lpf(out, 9000) + 0.003 * lpf(N(r, n), 3000)
    return fin(out)


def _gull_call(r, d, f0, rasp=1.0):
    m = int(d * SR)
    f = f0 * contour(m, [0, .12, .35, .7, 1], [0.55, 1.5 * r.uniform(.95, 1.15), 1.2, 0.95, 0.62]) * (1 + 0.012 * smooth(m, 40, r))
    f = f * (1 + 0.03 * np.sin(TWO_PI * r.uniform(18, 30) * tvec(m)) * np.linspace(.2, 1, m))
    fm = [(1300 + 500 * contour(m, [0, .4, 1], [0.7, 1.1, .8]), 280, 1.0), (2600, 450, 0.8), (4000, 600, 0.35), (700, 200, 0.4)]
    y = hsrc(f, fm, tilt=0.6)
    y = y * (1 + 0.35 * rasp * smooth(m, 90, r)) + 0.25 * rasp * bpf(N(r, m), 1500, 5000) * np.sin(np.pi * np.linspace(0, 1, m))
    return y * env_ar(m, 0.025, d * 0.45, 0.8)


def gull(r, dur=None, **p):
    dur = dur or 3.0; n = int(dur * SR) + int(0.4 * SR); out = np.zeros(n); t = r.uniform(0.05, 0.3); f0 = r.uniform(700, 950); g = 1.0
    while t < dur - 0.3:
        for k in range(int(r.integers(2, 5))):
            d = r.uniform(0.28, 0.55) * (1 - 0.1 * k); sput(out, _gull_call(r, d, f0 * r.uniform(.93, 1.08)) * g, int(t * SR))
            t += d + r.uniform(0.07, 0.25); g *= 0.88
        t += r.uniform(0.6, 1.4); g = r.uniform(0.6, 1.0)
    return fin(lpf(out, 9500))


def _caw(r, d, f0):
    m = int(d * SR); x = np.linspace(0, 1, m)
    f = f0 * contour(m, [0, .25, 1], [1.05, 1.1, 0.78]) * (1 + 0.03 * smooth(m, 50, r))
    y = hsrc(f, [(1000, 260, 1.0), (1900, 400, 0.7), (3000, 600, 0.35)], tilt=0.5)
    pr = r.uniform(70, 110); y = y * (1 - 0.75 * (0.5 + 0.5 * np.sin(TWO_PI * pr * tvec(m)))) + 0.5 * bpf(N(r, m), 700, 4500) * np.sin(np.pi * x) ** 0.7
    return y * env_ar(m, 0.012, d * 0.5, 0.7)


def crow(r, dur=None, **p):
    dur = dur or 2.0; n = int(dur * SR) + int(0.4 * SR); out = np.zeros(n); t = r.uniform(0.05, 0.25); f0 = r.uniform(380, 520)
    while t < dur - 0.2:
        for _ in range(int(r.integers(2, 5))):
            d = r.uniform(0.2, 0.38); sput(out, _caw(r, d, f0 * r.uniform(.92, 1.08)) * r.uniform(.7, 1), int(t * SR)); t += d + r.uniform(0.12, 0.3)
        t += r.uniform(0.7, 1.5)
    return fin(lpf(out, 8000))


def dog(r, dur=None, **p):
    nb = int(r.integers(1, 4)); out = np.zeros(int(((dur or 0) + 1.8) * SR)); t = 0.05; f0 = r.uniform(430, 680); big = r.uniform(.85, 1.15)
    for k in range(nb):
        d = r.uniform(0.15, 0.27); m = int(d * SR); x = np.linspace(0, 1, m)
        f = f0 * big * contour(m, [0, .12, 1], [1.2, 1.0, 0.62]) * (1 + 0.02 * smooth(m, 40, r))
        y = hsrc(f, [(1050 * r.uniform(.9, 1.1), 230, 1.0), (2000, 350, 0.6), (3300, 500, 0.25)], tilt=0.8)
        y = y * (1 + 0.3 * smooth(m, 80, r)) + 0.6 * bpf(N(r, m), 600, 3500) * np.exp(-x * 5)
        y = y * np.minimum(1, tvec(m) / 0.006) * np.exp(-tvec(m) / (d * 0.5)); y = lpf(y, 3500)
        sput(out, y * r.uniform(.8, 1), int(t * SR)); t += d + r.uniform(0.2, 0.42)
    return fin(out[:int((t + 0.5) * SR)])


def cow(r, dur=None, **p):
    d = dur or r.uniform(1.1, 1.6); m = int(d * SR); f0 = r.uniform(105, 150)
    f = f0 * contour(m, [0, .18, .55, 1], [0.85, 1.12, 1.0, 0.8]) * (1 + 0.012 * np.sin(TWO_PI * 5.5 * tvec(m))) * (1 + 0.01 * smooth(m, 15, r))
    ramp = contour(m, [0, .3, .65, 1], [0.0, 0.2, 1.0, 0.8])  # mouth opening: 'm-oo-ah-m'
    fm = [(330 + 280 * ramp, 90, 1.0), (750 + 500 * ramp, 130, 0.8), (2300, 300, 0.2), (160, 50, 0.7)]
    y = hsrc(f, fm, nh=45, tilt=0.7)
    y = y * (1 + 0.1 * smooth(m, 30, r)) + 0.1 * bpf(N(r, m), 300, 2500) * ramp
    return fin(y * env_ar(m, 0.18, 0.3, 0.9))


def rooster(r, dur=None, **p):
    f0 = r.uniform(520, 700); out = np.zeros(int(2.4 * SR)); t = 0.05
    notes = [(0.16, [.9, 1.15]), (0.15, [1.2, 1.0]), (0.2, [1.35, 1.55]), (0.85, [1.5, 1.8, 1.45, 0.8])]
    for d, kv in notes:
        m = int(d * SR); f = f0 * contour(m, np.linspace(0, 1, len(kv)), kv) * (1 + 0.02 * smooth(m, 30, r))
        y = hsrc(f, [(1500, 400, 1.0), (3100, 600, 0.6), (900, 250, 0.5)], tilt=0.5)
        y = y * (1 - 0.3 * (0.5 + 0.5 * np.sin(TWO_PI * r.uniform(60, 90) * tvec(m)))) + 0.2 * bpf(N(r, m), 800, 5000)
        sput(out, y * env_ar(m, 0.02, d * 0.35, 0.8), int(t * SR)); t += d + 0.04
    return fin(lpf(out[:int((t + 0.1) * SR)], 9000))


def hooves(r, dur=None, **p):
    dur = dur or 3.0; gait = p.get('gait', 'walk'); n = int((dur + 0.5) * SR); out = np.zeros(n)
    # (offset-in-cycle seconds) per gait; hind lands just before fore on the same side
    G = {'walk': (1.05, [0.0, 0.26, 0.52, 0.78]), 'trot': (0.72, [0.0, 0.02, 0.36, 0.38]),
         'canter': (0.58, [0.0, 0.17, 0.2, 0.36])}[gait if gait in ('walk', 'trot', 'canter') else 'walk']
    cyc, offs = G; hp = r.uniform(0.9, 1.1) * np.array([1, 0.94, 1.07, 1.02]); t0 = r.uniform(0, 0.2); c = 0
    while t0 + c * cyc < dur:
        for i, o in enumerate(offs):
            t = t0 + c * cyc + o + r.normal(0, 0.006)
            if t >= dur: continue
            m = int(0.3 * SR); f = hp[i] * r.uniform(.95, 1.05)
            y = burst(r, m, 0.005, 1500, 5000) * 0.9 + tone(900 * f, 0.016, m) * 0.5 + tone(1450 * f, 0.01, m) * 0.25 + tone(240 * f, 0.045, m) * 0.7 + burst(r, m, 0.03, 150, 500) * 0.4
            sput(out, y * r.uniform(0.75, 1) * (0.85 if gait == 'canter' and i == 0 else 1), int(t * SR))
        c += 1; cyc_j = cyc * r.uniform(0.97, 1.03); t0 += cyc_j - cyc
    return fin(out[:int((dur + 0.3) * SR)])


# ------------------------------------------------------------------ crowd
def _claps(r, dur, people, rise=None, taper=None):
    """Individual clappers: each clap = short noise burst through a random hand-cavity resonance."""
    n = int(dur * SR); out = np.zeros((2, n)); rise = dur * 0.22 if rise is None else rise; taper = dur * 0.35 if taper is None else taper
    bank = []
    for _ in range(64):
        m = int(0.03 * SR); tau = r.uniform(0.0018, 0.0045); fc = r.uniform(800, 2500)
        y = bpf(N(r, m), fc / 1.3, fc * 1.3) * dexp(m, tau, 0.0002) + 0.35 * hpf(N(r, m), 3000) * dexp(m, tau * 0.6, 0.0002)
        bank.append(y / (np.abs(y).max() + 1e-9))
    amp = 1 / np.sqrt(people) * 2.2
    for _ in range(people):
        st0 = r.uniform(0, rise); en = dur - r.uniform(0, taper) * r.uniform(0.3, 1); rate = r.uniform(3.5, 5.0); t = st0 + r.uniform(0, 1 / rate)
        pn = r.uniform(-0.9, 0.9); g0 = r.uniform(0.5, 1.0)
        while t < en:
            e = min(1, (t - st0) / 0.3) * min(1, (en - t) / 0.4)
            if r.random() < e:
                i = int(t * SR); y = bank[r.integers(64)] * g0 * r.uniform(0.55, 1) * amp
                a = (pn + 1) * np.pi / 4; add(out, np.vstack([y * np.cos(a), y * np.sin(a)]), i)
            t += (1 / rate) * (1 + 0.1 * r.standard_normal()); rate *= 1 + 0.002 * r.standard_normal()
    return out


def applause(r, dur=None, **p):
    dur = dur or r.uniform(2.2, 3.0); P = sizeof(p, 8, 26, 70); y = _claps(r, dur, P)
    d = bpf(colored(y.shape[1], 0.3, r), 900, 4500) * np.sin(np.pi * np.linspace(0, 1, y.shape[1])) ** 1.5 * 0.02 * np.sqrt(P / 20)
    return fin(y + d[None, :] * np.array([[1], [0.9]]))


def _swell(n, peak=0.35):
    x = np.linspace(0, 1, n); return np.where(x < peak, np.sin(np.pi / 2 * x / peak) ** 2, np.cos(np.pi / 2 * (x - peak) / (1 - peak)) ** 2)


def _shout_voices(r, dur, V, base_m=(150, 210), base_f=(260, 420), lo=0.7, hi=1.6, onset=0.45, pitch=1.0, vow=((730, 1090, 2440), (530, 1840, 2480)), gain=1.0):
    n = int(dur * SR); out = np.zeros((2, n))
    for _ in range(V):
        fem = r.random() < 0.4; f0 = r.uniform(*(base_f if fem else base_m)) * pitch; d = r.uniform(lo, hi); d = min(d, dur * 0.95); m = int(d * SR)
        f = vcontrol(r, m, f0, rise=0.12, fall=0.07, vib=0.012, jit=0.02)
        y = vox(r, m, f, vow[0], fem, breath=0.2, vow2=vow[1]) * env_ar(m, 0.09, d * 0.45, 0.9) * r.uniform(.5, 1)
        y = lpf(y, r.uniform(4500, 7500)); t = r.uniform(0, max(0.01, dur * onset)); pp = r.uniform(-.9, .9)
        add(out, pan(y * gain, pp), int(t * SR))
    return out


def cheer(r, dur=None, **p):
    dur = dur or r.uniform(2.4, 3.2); n = int(dur * SR); V = sizeof(p, 3, 6, 10)
    v = _shout_voices(r, dur, V, pitch=1.15, vow=((730, 1090, 2440), (590, 1700, 2480)), gain=0.35)
    b = babble(n, 2, r, energy=2.5, rt=0.5, wet=0.3, lp=6000) * 0.5
    a = _claps(r, dur, sizeof(p, 8, 28, 70), rise=dur * 0.2, taper=dur * 0.25) * 0.6
    y = (v + b) * _swell(n, 0.3)[None, :] ** 0.6 + a
    if p.get('whistle', r.random() < 0.5):
        m = int(r.uniform(0.4, 0.8) * SR); f = r.uniform(2400, 3400) * contour(m, [0, .3, 1], [0.9, 1.1, 1.0]) * (1 + 0.01 * np.sin(TWO_PI * 6 * tvec(m)))
        w = np.sin(np.cumsum(TWO_PI * f / SR)) * env_ar(m, 0.05, 0.15) * 0.06; add(y, pan(w, r.uniform(-.7, .7)), int(r.uniform(0.2, dur * 0.5) * SR))
    return fin(y)


def murmur(r, dur=None, **p):
    dur = dur or r.uniform(2.5, 3.5); n = int(dur * SR); V = sizeof(p, 3, 5, 8)
    y = babble(n, V, r, energy=0.8, rt=0.6, wet=0.4, lp=4000)
    return fin(y * _swell(n, 0.35)[None, :] ** 1.3)


def gasp(r, dur=None, **p):
    dur = dur or 1.2; n = int(dur * SR); V = sizeof(p, 3, 8, 16); out = np.zeros((2, n)); fr = np.fft.rfftfreq(int(0.7 * SR), 1 / SR)
    for _ in range(V):
        d = r.uniform(0.45, 0.7); m = int(d * SR); fem = r.random() < 0.5; s = (1.15 if fem else 1.0) * r.uniform(.93, 1.07)
        mf = np.fft.rfftfreq(m, 1 / SR)
        G = 0.03 + sum(a * np.exp(-0.5 * ((mf - F * s) / bw) ** 2) for F, bw, a in [(700, 140, 1.0), (1150, 200, 0.7), (2500, 300, 0.35)])
        G = G + 0.08 * (mf > 3000) * np.exp(-(mf - 3000) / 4000)
        y = np.fft.irfft(np.fft.rfft(N(r, m)) * G, m); y /= y.std() + 1e-9
        pk = r.uniform(0.35, 0.45) * d / 0.6; x = tvec(m)
        e = np.where(x < pk, np.sin(np.pi / 2 * x / pk) ** 2, np.exp(-(x - pk) / 0.09)) * (1 + 0.15 * smooth(m, 20, r))
        add(out, pan(y * e * r.uniform(.5, 1) * 0.4, r.uniform(-.9, .9)), int(r.uniform(0, 0.2 * dur) * SR))
    return fin(out)


def laugh(r, dur=None, **p):
    dur = dur or r.uniform(2.5, 3.5); n = int(dur * SR); V = sizeof(p, 4, 8, 14); out = np.zeros((2, n))
    for _ in range(V):
        fem = r.random() < 0.5; f0 = r.uniform(300, 430) if fem else r.uniform(170, 260); rate = r.uniform(4.3, 5.8)
        t = r.uniform(0, dur * 0.3); nh = int(r.integers(4, 10)); pn = r.uniform(-.9, .9); g = r.uniform(.6, 1); inhale = r.random() < 0.4
        for k in range(nh):
            if t >= dur - 0.1: break
            d = r.uniform(0.08, 0.12); m = int(d * SR); f = vcontrol(r, m, f0 * (1 - 0.03 * k), rise=0.08, fall=0.1, jit=0.03)
            y = vox(r, m, f, (730, 1090, 2440), fem, breath=0.5, vow2=(660, 1500, 2410)) * env_ar(m, 0.012, d * 0.7, 1.0)
            add(out, pan(y * g * 0.25, pn), int(t * SR)); g *= r.uniform(0.84, 0.95); t += d + 1 / rate - 0.1 + r.normal(0, 0.012)
    return fin(out * _swell(n, 0.3)[None, :] ** 0.5)


def boo(r, dur=None, **p):
    dur = dur or r.uniform(2.2, 3.0); n = int(dur * SR); V = sizeof(p, 3, 6, 10); out = np.zeros((2, n))
    for _ in range(V):
        f0 = r.uniform(95, 140) if r.random() < 0.8 else r.uniform(190, 230); d = r.uniform(0.9, min(1.8, dur * .9)); m = int(d * SR)
        f = vcontrol(r, m, f0, rise=0.05, fall=0.22, jit=0.03)
        y = vox(r, m, f, (300, 870, 2240), False, breath=0.2, vow2=(350, 800, 2200), bw=(80, 100, 200)) * env_ar(m, 0.14, d * 0.45, 0.9)
        add(out, pan(lpf(y, 3500) * r.uniform(.5, 1) * 0.3, r.uniform(-.9, .9)), int(r.uniform(0, dur * 0.4) * SR))
    return fin(out * _swell(n, 0.4)[None, :] ** 0.6)


PHRASES = [  # (vowel index, rel. duration, accent)
    [(4, 1.0, 1), (5, 1.0, 0), (2, 1.5, 1)],
    [(0, 0.7, 1), (0, 0.7, 1), (1, 1.2, 1)],
    [(4, 1.0, 1), (4, 1.0, 1), (6, 1.0, 1), (6, 1.0, 1)],
]


def chant(r, dur=None, **p):
    dur = dur or r.uniform(3.5, 5.0); n = int(dur * SR); V = sizeof(p, 4, 8, 12); out = np.zeros((2, n))
    ph = PHRASES[int(p.get('phrase', r.integers(len(PHRASES)))) % len(PHRASES)]; sd = r.uniform(0.2, 0.28); gap = r.uniform(0.35, 0.55)
    period = sum(d for _, d, _ in ph) * sd + gap
    for _ in range(V):
        fem = r.random() < 0.4; f0 = r.uniform(240, 300) if fem else r.uniform(130, 180); fs = r.uniform(.95, 1.05); pn = r.uniform(-.9, .9); g = r.uniform(.6, 1) * 0.3
        jt = r.normal(0, 0.02); t = r.uniform(0.05, 0.25)
        while t < dur - 0.1:
            tt = t + jt
            for vi, rd, ac in ph:
                d = rd * sd; m = int(d * SR)
                if tt >= 0 and tt + d < dur:
                    f = f0 * fs * (1.12 if ac else 1.0) * contour(m, [0, 0.3, 1], [1.08, 1.0, 0.88]) * (1 + 0.012 * smooth(m, 20, r))
                    y = vox(r, m, f, VOW[vi], fem, breath=0.3) * env_ar(m, 0.02, 0.07, 1.0)
                    y = y + 0.4 * hpf(N(r, m), 2500) * dexp(m, 0.012, 0.002) * 0.3
                    add(out, pan(lpf(y, 6000) * g, pn), int(tt * SR))
                tt += d * 1.02
            t += period * r.uniform(0.985, 1.015)
    return fin(out * (0.3 + 0.7 * _swell(n, 0.12)[None, :] ** 0.2))


# ------------------------------------------------------------------ footsteps
def _step(r, surf, run, k):
    """One footfall (heel + toe/scuff) as a mono event; k alternates feet."""
    s = r.uniform(0.92, 1.08) * (1.0 if k % 2 == 0 else 1.06); L = int((0.7 if surf == 'metal' else 0.5) * SR); y = np.zeros(L)
    dly = int((0.045 if run else 0.075) * SR * r.uniform(0.85, 1.15)); gh, gt = r.uniform(.8, 1), r.uniform(.4, .65)
    def heel_toe(heel, toe): sput(y, heel * gh, 0); sput(y, toe * gt, dly)
    m = L
    if surf == 'concrete':
        heel_toe(burst(r, m, 0.011, 600, 3500) + 0.8 * tone(115 * s, 0.03, m), burst(r, m, 0.007, 1200, 5000) * 0.7)
        sput(y, hpf(N(r, int(0.06 * SR)), 2000) * np.hanning(int(0.06 * SR)) * 0.08, dly + int(0.02 * SR))
    elif surf == 'wood':
        md = lambda: modes(170 * s, [1, 1.38, 2.05], [0.07, 0.05, 0.035], [1, 0.7, 0.4], m, r)
        heel_toe(burst(r, m, 0.009, 500, 2500) * 0.6 + md() * 0.9 + tone(85 * s, 0.05, m) * 0.5, burst(r, m, 0.006, 800, 3000) * 0.4 + md() * 0.4)
    elif surf in ('gravel', 'sand'):
        g = surf == 'gravel'; dens = 0.06 if g else 0.12
        def crunch(d, amp):
            mm = int(d * SR); sp = (r.random(mm) < dens * np.linspace(1, 0.3, mm)) * N(r, mm); e = np.exp(-tvec(mm) / (d * 0.45)) * np.minimum(1, tvec(mm) / 0.004)
            c = bpf(sp, 1500, 7000) * 3 if g else lpf(sp, 3500) * 2
            c = (c + 0.15 * bpf(N(r, mm), 2000, 6000) * np.hanning(mm)) * e
            return np.pad(c, (0, max(0, m - mm)))[:m] * amp
        heel_toe(crunch(r.uniform(0.09, 0.15) if g else r.uniform(0.15, 0.25), 1.0) + 0.35 * tone(90 * s, 0.025, m), crunch(0.08 if g else 0.12, 0.8))
    elif surf == 'metal':
        base = r.uniform(380, 900) * s; rt = [1, 2.32, 4.1, 6.8, 9.3]
        mm = lambda a: modes(base, rt, [0.3, 0.2, 0.13, 0.08, 0.05], [1, 0.6, 0.45, 0.3, 0.2], m, r) * a
        heel_toe(burst(r, m, 0.002, 1500, 6000) * 0.8 + mm(0.7) + 0.4 * tone(140 * s, 0.05, m), burst(r, m, 0.002, 2000, 7000) * 0.4 + mm(0.35))
    elif surf == 'carpet':
        heel_toe(lpf(burst(r, m, 0.02, 100, 700), 700) * 1.0 + 0.6 * tone(80 * s, 0.03, m, 0.003), lpf(burst(r, m, 0.012, 200, 900), 900) * 0.6)
    elif surf == 'tile':
        heel_toe(burst(r, m, 0.003, 2000, 8000) + 0.6 * tone(3000 * s, 0.006, m) + 0.35 * tone(350 * s, 0.03, m), burst(r, m, 0.002, 2500, 9000) * 0.6)
    elif surf == 'grass':
        mm = int(r.uniform(0.12, 0.2) * SR); sw = bpf(N(r, mm), 800, 4500) * np.sin(np.pi * np.linspace(0, 1, mm) ** 0.6) ** 2 * 0.5
        cr = (r.random(mm) < 0.01) * N(r, mm); sw = sw + bpf(cr, 2000, 8000) * 1.5
        heel_toe(np.pad(sw, (0, m - mm)) + 0.3 * tone(70 * s, 0.04, m, 0.004), np.pad(sw[:mm // 2], (0, m - mm // 2)) * 0.5)
    else: return _step(r, 'concrete', run, k)
    return y


def steps(r, dur=None, **p):
    dur = dur or 2.0; surf = p.get('surface', 'concrete'); rate = float(p.get('rate', 1.9)); people = max(1, int(p.get('people', 1)))
    run = rate > 2.8; n = int((dur + 0.7) * SR); out = np.zeros((2, n))
    for w in range(people):
        rw = rate * r.uniform(0.9, 1.1) if people > 1 else rate; t = r.uniform(0, 1 / rw); k = int(r.integers(2)); g = r.uniform(.6, 1) / np.sqrt(people) ** 0.6
        pn = r.uniform(-.8, .8) if people > 1 else r.uniform(-.2, .2); drift = r.uniform(-0.3, 0.3) / dur
        while t < dur:
            y = _step(r, surf, run, k) * g * (1 if k % 2 == 0 else 0.9) * r.uniform(0.85, 1.1)
            add(out, pan(y, np.clip(pn + drift * t + 0.05 * (1 if k % 2 else -1), -1, 1)), int(t * SR)); k += 1
            t += (1 / rw) * (1 + 0.045 * r.standard_normal())
    return fin(out)


# ------------------------------------------------------------------ cloth / rigging / door
def _creak(r, n, lo, hi, gate_rate=2.0, bright=1.0, sweep=None):
    """Stick-slip friction: irregular slip-pulse train through narrow wood/fibre resonances, gated in phrases."""
    gate = np.clip(0.5 + 0.9 * smooth(n, gate_rate, r), 0, 1) ** 1.5
    c = sig(1.5 * smooth(n, 1.5, r)) if sweep is None else sweep
    rate = (lo + (hi - lo) * c) * (1 + 0.15 * smooth(n, 30, r)); ph = np.cumsum(rate / SR)
    wr = np.nonzero(np.diff(np.floor(ph)) > 0)[0]; imp = np.zeros(n); imp[wr] = r.uniform(0.4, 1, len(wr)) * (1 + 0.3 * r.standard_normal(len(wr)))
    imp += 0.01 * N(r, n); y = np.zeros(n)
    for fc, a in [(r.uniform(500, 900), 1.0), (r.uniform(1300, 1900), 0.7 * bright), (r.uniform(2600, 3600), 0.35 * bright)]:
        y += a * bpf(imp, fc * 0.92, fc * 1.08)
    y += 0.8 * lpf(imp, 300) * 0.6 + 0.12 * bright * bpf(N(r, n), 800, 3000) * gate
    return y / (np.abs(y).max() + 1e-9) * gate


def rope(r, dur=None, **p):
    dur = dur or 3.0; n = int(dur * SR); y = _creak(r, n, 50, 190, 1.8)
    groan = lpf(_creak(r, n, 25, 60, 1.2), 500) * 0.4
    return fin(y + groan, 40)


def flag(r, dur=None, **p):
    dur = dur or 3.0; n = int(dur * SR); gust = sig(2.2 * smooth(n, 0.7, r) + 0.3); f = 3.5 + 5.5 * gust * (0.8 + 0.2 * smooth(n, 3, r) / 2)
    ph = np.cumsum(TWO_PI * np.clip(f, 3, 10) / SR); fl = np.clip(np.sin(ph) + 0.35 * np.sin(2.3 * ph + 1) + 0.15 * smooth(n, 8, r), 0, 1.5) ** 1.5
    car = bpf(N(r, n), 350, 3500) + 0.6 * hpf(N(r, n) * (r.random(n) < 0.2), 1500) * 3
    y = car * fl * gust ** 1.3 * 0.5 + 0.35 * lpf(colored(n, 1.3, r), 350) * gust
    # snaps where the cloth cracks taut at flutter peaks in strong gusts
    pk = np.nonzero((np.diff(ph % TWO_PI) < 0))[0]
    for i in pk:
        if r.random() < 0.25 * gust[min(i, n - 1)] ** 2:
            m = int(0.06 * SR); s = burst(r, m, 0.004, 1000, 6000) + 0.5 * tone(180, 0.012, m); sput(y, s * r.uniform(.6, 1.2), int(i))
    return fin(y, 40)


def door(r, dur=None, **p):
    act = p.get('action', 'open'); n = int(2.4 * SR); y = np.zeros(n)
    def latch(t, g=1.0):
        m = int(0.15 * SR); c = burst(r, m, 0.0015, 2000, 7000) + 0.5 * tone(r.uniform(2400, 3400), 0.012, m) + 0.3 * tone(r.uniform(900, 1300), 0.03, m); sput(y, c * g, int(t * SR))
    if act == 'close':
        m = int(0.4 * SR); sw = bpf(N(r, m), 250, 1400) * np.sin(np.pi * np.linspace(0, 1, m)) ** 2 * 0.2; sput(y, sw, int(0.0 * SR))
        cl = _creak(r, int(0.5 * SR), 70, 150, 3) * 0.2 * env_ar(int(0.5 * SR), 0.1, 0.2); sput(y, cl, int(0.05 * SR))
        t = 0.3; m = int(0.6 * SR)
        th = tone(r.uniform(70, 105), 0.09, m, 0.003) * 1.2 + lpf(burst(r, m, 0.035, 100, 900), 900) * 0.9 + modes(r.uniform(140, 200), [1, 1.7, 2.6], [0.06, 0.04, 0.03], [.6, .4, .3], m, r) * 0.6
        sput(y, th, int(t * SR)); latch(t + 0.03, 0.55)
    else:
        latch(0.0, 0.8); latch(0.05, 0.5)
        d = r.uniform(0.7, 1.1); m = int(d * SR); sw = contour(m, [0, 1], [0.0, 1.0]); cr = _creak(r, m, 70, 210, 2.5, sweep=sw) * env_ar(m, 0.08, 0.15) * 0.8
        sput(y, cr, int(0.15 * SR)); sput(y, tone(95, 0.05, int(0.3 * SR)) * 0.2 + lpf(burst(r, int(0.3 * SR), 0.03, 100, 600), 600) * 0.2, int((0.15 + d) * SR))
    return fin(y[:int((1.6 if act == 'open' else 1.0) * SR) + int(0.6 * SR)], 20)


GEN = {'bird': bird, 'gull': gull, 'crow': crow, 'dog': dog, 'cow': cow, 'rooster': rooster, 'hooves': hooves,
       'applause': applause, 'cheer': cheer, 'murmur': murmur, 'gasp': gasp, 'laugh': laugh, 'chant': chant, 'boo': boo,
       'steps': steps, 'flag': flag, 'rope': rope, 'door': door}
TRIM = {'bird': -3, 'gull': -2, 'crow': -2, 'dog': -4, 'cow': -3, 'rooster': -3, 'hooves': -2,
        'applause': -2, 'cheer': 0, 'murmur': -4, 'gasp': -2, 'laugh': -1, 'chant': 0, 'boo': -2,
        'steps': -3, 'flag': -4, 'rope': -4, 'door': 0}
ROOM = {'bird': (1.0, 0.18), 'gull': (1.0, 0.2), 'crow': (1.0, 0.2), 'dog': (1.2, 0.3), 'cow': (1.2, 0.25), 'rooster': (1.2, 0.25),
        'hooves': (0.7, 0.2), 'applause': (0.9, 0.3), 'cheer': (0.9, 0.3), 'murmur': (0, 0), 'gasp': (0.6, 0.2), 'laugh': (0.8, 0.25),
        'chant': (1.0, 0.3), 'boo': (0.9, 0.25), 'steps': (0.4, 0.15), 'flag': (0.5, 0.1), 'rope': (0.4, 0.12), 'door': (0.5, 0.25)}
