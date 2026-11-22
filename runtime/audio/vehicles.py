"""Synthesised vehicle / harbour sound effects for Doc2D (48 kHz, numpy/scipy only, deterministic per rng).

Kinds: engine (veh x motion), horn, door_car, brakes, reverse_beep, container, chain, crane, splash, rail_clack.
sfx.py merges GEN / TRIM / ROOM. Generators return mono (1-D) or stereo (2,n); sfx.make() normalises + pans mono.
"""
import numpy as np
from dsp import SR, colored, lpf, hpf, bpf, smooth, shape, tvec, dexp, pan, st, add, reverb

CSND = 343.0


# ---------------------------------------------------------------- helpers
def _fade(x, a=0.04, b=0.10):
    n = x.shape[-1]; g = np.ones(n); na = min(int(a * SR), n // 2); nb = min(int(b * SR), n // 2)
    if na: g[:na] = 0.5 - 0.5 * np.cos(np.pi * np.arange(na) / na)
    if nb: g[n - nb:] = 0.5 + 0.5 * np.cos(np.pi * np.arange(nb) / nb)
    return x * g


def _fin(x, a=0.04, b=0.12):
    """kill NaN/DC, fade edges."""
    return _fade(hpf(np.nan_to_num(x), 22), a, b)


def _air(x, rt, wet, bright=3500, seed=21, tail=0.5):
    """own outdoor reverb (mono/stereo in -> stereo out, tail appended)."""
    x = np.pad(st(x), ((0, 0), (0, int(rt * SR * tail)))); return reverb(x, rt, wet, seed=seed, bright=bright)


def _ss(x): x = np.clip(x, 0, 1); return x * x * (3 - 2 * x)
def _nrm(x): return x / (np.std(x) + 1e-12)
def _pe(ph, sh, at=35):
    fr = ph % 1; return np.exp(-fr * sh) * (1 - np.exp(-fr * at))  # per-cycle pulse envelope, soft attack (no wrap click)


def _cyc(ph, r, lo, hi): idx = np.floor(ph).astype(int); return r.uniform(lo, hi, idx[-1] + 2)[idx]


def _put(buf, ev, i):
    a = max(0, i); b = min(len(buf), i + len(ev))
    if b > a: buf[a:b] += ev[a - i:b - i]


def _modal(r, n, freqs, taus, amps, jit=0.02):
    k = tvec(n)[None, :]; f = np.asarray(freqs, float)[:, None] * (1 + jit * r.standard_normal((len(freqs), 1)))
    tau = np.asarray(taus, float)[:, None]; a = np.asarray(amps, float)[:, None]
    return (a * np.sin(2 * np.pi * f * k + r.uniform(0, 6.28, (len(freqs), 1))) * np.exp(-k / tau)).sum(0)


def _harm(ph, f, nh, slope, bumps, r, hi=4500):
    """harmonic stack of phase `ph` (cycles), fundamental `f` (Hz array); amplitude follows formant bumps (fc, bw octaves, w).
    Amplitudes are evaluated on a coarse grid (f varies slowly) and interpolated."""
    n = len(ph); y = np.zeros(n); D = 128; ic = np.unique(np.r_[np.arange(0, n, D), n - 1]); fc_ = f[ic]; ix = np.arange(n)
    for h in range(1, nh + 1):
        fh = h * fc_
        if fh.min() > 2.5 * hi or fh.min() > SR / 2.2: break
        g = 0.3 + sum(w * np.exp(-0.5 * (np.log2(np.maximum(fh, 1) / fc) / bw) ** 2) for fc, bw, w in bumps)
        a = np.interp(ix, ic, h ** -slope * g / (1 + (fh / hi) ** 4))
        y += a * np.sin(2 * np.pi * h * (ph % 1.0) + r.uniform(0, 6.28))
    return y


def _combust(r, n, f, u, q):
    """jittered firing pulse train through body/exhaust resonances (harmonic stack + noise burst per cycle)."""
    jit = 1 + q.get('jit', 0.012) * smooth(n, 9, r) + 0.025 * (1 - u) * smooth(n, 3, r)
    fj = f * jit; ph = np.cumsum(fj) / SR
    h = _nrm(_harm(ph, fj, q['nh'], q['slope'], q['bumps'], r))
    lo, hi, sh, lv = q['burst']
    b = _nrm(bpf(colored(n, 0.5, r), lo, hi) * _pe(ph, sh) * _cyc(ph, r, 0.55, 1.35))
    y = h + lv * b
    return y * (0.6 + 0.4 * u) * (1 + 0.08 * smooth(n, 5, r))


def _tyre(r, n, spd, lo, hi, lv):
    t = _nrm(bpf(colored(n, 0.7, r), lo, hi)) * 0.8 + _nrm(lpf(colored(n, 1.5, r), 220)) * 0.5
    return t * lv * np.clip(spd, 0, 1) ** 1.3 * (1 + 0.2 * smooth(n, 2, r))


_CLK = {}
def _clack_tmpl(r):
    m = int(0.32 * SR); k = tvec(m)
    th = np.sin(2 * np.pi * r.uniform(70, 110) * k) * np.exp(-k / 0.05) * 0.8
    ring = _modal(r, m, r.uniform(450, 1200, 3), [0.03, 0.05, 0.02], [0.5, 0.35, 0.3])
    tick = bpf(r.standard_normal(m), 1500, 4800) * np.exp(-k / 0.006)
    return (th + ring + 0.8 * tick) * np.minimum(1, k / 0.0008)


def _clacks(r, n, v, spd=None, lv=1.0, cars=4):
    """wheels over rail joints: every axle of a `cars`-long train hits every 12 m joint -> ta-tak pairs."""
    out = np.zeros(n); dur = n / SR; JL = 12.0
    tm = [_clack_tmpl(r) for _ in range(6)]; L = 24.7 + r.uniform(-.4, .4); t0 = r.uniform(0, JL / v)
    for c in range(cars):
        for xa in c * L + np.array([0, 2.5, 18, 20.5]):
            for j in range(-int(xa / JL) - 3, int(dur * v / JL) + 4):
                t = (JL * j + xa) / v - t0 + 0.2
                if not 0 <= t < dur: continue
                g = lv * r.uniform(0.55, 1.3) * (spd[min(n - 1, int(t * SR))] if spd is not None else 1)
                _put(out, tm[r.integers(6)] * g, int(t * SR))
    return out


# ---------------------------------------------------------------- engine sources: (r, n, f, u, spd, dop) -> mono
def _s_car(r, n, f, u, spd, dop):
    e = _combust(r, n, f, u, dict(nh=22, slope=1.1, bumps=[(160, .8, 1.5), (520, .7, .8)], burst=(150, 1200, 5, .45)))
    return e + _tyre(r, n, spd, 350, 1800, .55) + 0.05 * _nrm(hpf(colored(n, 1, r), 2500)) * (0.3 + u)


def _s_truck(r, n, f, u, spd, dop):
    e = _combust(r, n, f, u, dict(nh=24, slope=.9, jit=.02, bumps=[(110, .8, 1.6), (340, .7, .8)], burst=(200, 1500, 5, .5)))
    clat = _nrm(bpf(colored(n, 0.3, r), 900, 4500) * _pe(np.cumsum(f) / SR, 14)) * 0.35 * (0.5 + 0.5 * u)  # diesel knock
    return e + clat + _tyre(r, n, spd, 200, 1100, .8) + 0.25 * _nrm(lpf(colored(n, 2, r), 90))


def _s_bus(r, n, f, u, spd, dop):
    y = _s_truck(r, n, f, u, spd, dop)
    ph = np.cumsum(f * 5.2 * dop) / SR; return y + 0.05 * np.sin(2 * np.pi * ph) * (0.2 + u)  # gearbox whine


def _s_moto(r, n, f, u, spd, dop):
    e = _combust(r, n, f, u, dict(nh=26, slope=.8, jit=.015, bumps=[(250, .7, 1.3), (900, .6, 1.0)], burst=(300, 2500, 8, .6)))
    return e + _tyre(r, n, spd, 500, 2500, .4) + 0.1 * _nrm(bpf(colored(n, 0.8, r), 1500, 6000)) * u


def _s_ship(r, n, f, u, spd, dop):
    ph = np.cumsum(f) / SR
    thud = _nrm(bpf(colored(n, 1, r), 30, 170) * _pe(ph, 6) * _cyc(ph, r, .7, 1.2))
    h = _nrm(_harm(ph, f, 16, .7, [(60, .6, 2), (115, .6, 1.3)], r, hi=800))
    sw = 1 + 0.5 * smooth(n, 0.35, r)
    wash = _nrm(bpf(colored(n, 1, r), 120, 900)) * np.clip(sw, 0.2, None) * (0.3 + 0.6 * spd)
    return 0.8 * thud + 0.9 * h + wash * 0.7 + 0.6 * _nrm(lpf(colored(n, 2, r), 110))


def _s_train(r, n, f, u, spd, dop):
    ph = np.cumsum(f) / SR
    h = _nrm(_harm(ph, f, 18, 1.0, [(80, .8, 1.5), (240, .7, .8)], r, hi=1200))
    rum = _nrm(lpf(colored(n, 2, r), 120)) * 0.9 + _nrm(bpf(colored(n, 1, r), 150, 600)) * 0.3
    wheel = _nrm(bpf(colored(n, 0.5, r), 600, 3500)) * 0.25 * np.clip(spd, 0, 1) ** 1.2
    v = 25 * max(0.2, float(np.mean(spd)))
    clk = _clacks(r, n, v, spd, 0.55) if spd.max() > 0.05 else 0
    return 0.7 * h * (0.5 + 0.5 * u) + rum + wheel + clk


def _s_plane(r, n, f, u, spd, dop):
    w = colored(n, 0.4, r)
    roar = shape(w, lambda fr, t: 0.1 + np.exp(-0.5 * (np.log2(np.maximum(fr, 20) / 300) / 1.3) ** 2)
                 + 0.7 * np.exp(-0.5 * (np.log2(np.maximum(fr, 20) / 1100) / 1.0) ** 2), 1024)
    roar = lpf(_nrm(roar), 6000) * (0.55 + 0.45 * u) * (1 + 0.1 * smooth(n, 1.5, r))
    ph = np.cumsum(f) / SR
    whine = (np.sin(2 * np.pi * 14 * ph) + 0.5 * np.sin(2 * np.pi * 21 * ph)) * 0.05 * (0.4 + u) * (1 + 0.3 * smooth(n, .8, r))
    return roar + whine + 0.7 * _nrm(lpf(colored(n, 2, r), 130))


def _s_heli(r, n, f, u, spd, dop):
    ph = np.cumsum(f) / SR; fr = ph % 1
    slap = _nrm(bpf(colored(n, 0.3, r), 90, 1400) * _pe(ph, 9, 90) * _cyc(ph, r, .75, 1.25))
    h = _nrm(_harm(ph, f, 18, 1.2, [(70, .8, 1.5), (300, .7, .6)], r, hi=1500))
    tail = _nrm(_harm(ph * 5.1, f * 5.1, 6, 1.0, [(250, .8, 1)], r)) * (0.5 + 0.5 * np.sin(2 * np.pi * ph))
    tph = np.cumsum(2400 * dop) / SR
    turb = 0.06 * np.sin(2 * np.pi * tph) + 0.14 * _nrm(bpf(colored(n, 0.5, r), 1800, 3800))
    return 1.0 * slap + 0.5 * h + 0.18 * tail + turb + 0.5 * _nrm(lpf(colored(n, 2, r), 120))


def _s_fork(r, n, f, u, spd, dop):
    ph = np.cumsum(f) / SR; act = 0.25 + 0.75 * np.clip(spd + 0.3 * u, 0, 1)
    whine = _nrm(_harm(ph, f, 5, 1.2, [(900, 1, 1)], r, hi=5000)) * act
    whine *= 1 + 0.03 * smooth(n, 6, r)
    hum = np.sin(2 * np.pi * 100 * tvec(n) + 0.3) * 0.5 + _nrm(lpf(colored(n, 1.5, r), 300)) * 0.4
    return 0.35 * whine + 0.3 * hum + _tyre(r, n, spd, 150, 900, .7) + 0.03 * _nrm(hpf(colored(n, 1, r), 2000)) * act


# veh: (src, idle Hz, max Hz, cruise u, distance m, speed m/s, reverb (rt, wet), geared shifts)
VEH = {
    'car':       (_s_car,   27, 180, .45, 11, (15, 20), (.8, .12), 3),
    'truck':     (_s_truck, 30, 90,  .50, 13, (12, 17), (.9, .14), 4),
    'bus':       (_s_bus,   28, 95,  .50, 13, (11, 15), (.9, .14), 4),
    'motorbike': (_s_moto,  25, 200, .50, 9,  (18, 25), (.7, .10), 3),
    'ship':      (_s_ship,  7,  13,  .45, 40, (8, 8),   (2.0, .5), 0),
    'train':     (_s_train, 14, 45,  .50, 25, (22, 28), (1.4, .25), 0),
    'plane':     (_s_plane, 90, 180, .50, 150, (110, 110), (1.8, .3), 0),
    'heli':      (_s_heli,  20, 23,  .50, 90, (45, 50), (1.4, .25), 0),
    'forklift':  (_s_fork,  300, 900, .40, 6, (2.5, 3.5), (.6, .12), 0),
}


_LP = {'car': 2600, 'truck': 2400, 'bus': 2400, 'motorbike': 3500, 'train': 3200, 'ship': 1500, 'forklift': 5000, 'heli': 4500, 'plane': 6000}


def _profile(r, n, veh, motion):
    t = np.linspace(0, 1, n); cru, G = VEH[veh][3], VEH[veh][7]
    if motion == 'idle': return np.full(n, 0.01) + 0.01 * smooth(n, 1, r), np.zeros(n)
    if motion == 'pass': return cru + 0.06 * smooth(n, .8, r), 0.75 + 0.05 * smooth(n, .5, r)
    if motion == 'arrive':
        s = 1 - _ss((t - 0.05) / 0.8); u = cru * s
        if G:
            for ts in np.linspace(0.3, 0.7, G - 1)[::-1] if G > 1 else []:
                u += 0.1 * np.exp(-np.clip(t - ts, 0, None) / 0.07) * (t >= ts)
        if veh in ('plane', 'heli'): u = 0.2 + 0.6 * s
        return np.clip(u, 0.01, 1), s * 0.8
    s = _ss((t - 0.12) / 0.8)  # depart
    if G:
        x = s * G; fr = x - np.floor(np.minimum(x, G - 1e-6)); u = 0.25 + 0.55 * fr + 0.1 * s
        u = np.where(s <= 0, 0.01, u)
    else: u = 0.25 + 0.7 * s
    if veh in ('plane', 'heli'): u = 0.2 + 0.8 * s
    return np.clip(u, 0.01, 1), s * 0.8


def engine(r, dur=None, veh='car', motion='pass', dir=1, **p):
    veh = veh if veh in VEH else 'car'; motion = motion if motion in ('pass', 'idle', 'arrive', 'depart') else 'pass'
    src, fi, fm, cru, d, vr_, (rt, wet), G = VEH[veh]
    dur = float(dur or (4 if motion == 'pass' else 5)); n = int(dur * SR); t = np.linspace(0, 1, n)
    u, spd = _profile(r, n, veh, motion); dop = np.ones(n); dr = 1 if dir >= 0 else -1
    if motion == 'pass':
        v = r.uniform(*vr_); L = v * dur / 2; x = np.linspace(-L, L, n); rr = np.sqrt(x ** 2 + d ** 2)
        dop = CSND / (CSND + v * x / rr); env = (d / rr) ** 1.2; c = (d / rr) ** 2
        pn = dr * 0.85 * np.tanh(1.6 * x / d * (1 if d < 100 else 0.6))
    elif motion == 'arrive':
        env = 0.2 + 0.8 * _ss(t / 0.6); c = env; pn = dr * 0.7 * (1 - _ss(t / 0.8))
        dop = 1 + 0.03 * (1 - _ss(t / 0.8)) * (veh not in ('ship',))
    elif motion == 'depart':
        env = 1 - 0.85 * _ss((t - 0.3) / 0.7); c = env; pn = dr * 0.7 * _ss(t)
        dop = 1 - 0.03 * _ss(t)
    else: env = np.ones(n); c = np.ones(n); pn = np.zeros(n)
    f = fi * (fm / fi) ** u * dop
    y = lpf(src(r, n, f, u, spd, dop), _LP[veh], 3)
    if motion == 'idle': y = y * (1 + 0.04 * smooth(n, 2.5, r))
    dull = lpf(y, 700 if d > 30 else 1100)
    y = (dull * (1 - c) + y * c) * env
    y = _fin(y, .08, .15 if motion != 'depart' else .4)
    return _fin(_air(pan(y, pn), rt, wet, tail=0.4), .01, .12)


# ---------------------------------------------------------------- horns
def _hornvoice(r, k, f, nh, slope, bell, hi, noise=0.02):
    n = len(k); ph = np.cumsum(f) / SR; y = np.zeros(n); fm = float(np.mean(f))
    for h in range(1, nh + 1):
        g = h ** -slope * (0.4 + np.exp(-0.5 * (np.log2(h * fm / bell)) ** 2)) / (1 + (h * fm / hi) ** 4)
        y += g * np.sin(2 * np.pi * h * ph + r.uniform(0, 6.28))
    return _nrm(y) * (1 + noise * _nrm(lpf(colored(n, 0.5, r), 200)))  # reed buzz


def horn(r, dur=None, veh='car', **p):
    spec = {'car': (.6, [420, 525], 10, 1.0, 1400, 2800, 1.1, .4, .03, .09),
            'truck': (1.4, [330, 415, 494], 12, .9, 800, 3200, 1.4, .5, .06, .15),
            'ship': (3.5, [72, 90], 22, .75, 300, 1400, 3.6, 1.7, .30, .60),
            'train': (2.5, [369, 440, 554], 14, .85, 900, 3000, 1.8, .7, .05, .25)}
    d0, fs, nh, sl, bell, hi, rt, wet, at, rl = spec.get(veh, spec['car'])
    n = int((dur or d0) * SR); k = tvec(n); y = np.zeros(n)
    for fq in fs:
        f = fq * (1 + 0.004 * smooth(n, 1.5, r)) * (1 - 0.12 * np.exp(-k / 0.05) if veh in ('train', 'truck') else 1)
        y += _hornvoice(r, k, f, nh, sl, bell, hi)
    if veh == 'truck': y += 0.25 * _nrm(bpf(colored(n, 0.3, r), 1000, 5000)) * np.exp(-k / 0.12)  # air chuff
    y *= np.minimum(1, k / at) ** 1.5 * np.clip((k[-1] - k) / rl, 0, 1) ** 1.5
    y = lpf(y, 900 if veh == 'ship' else 2600)
    return _fin(_air(y, rt, wet, bright=2500, seed=31), .01, .1)


# ---------------------------------------------------------------- short sfx
def door_car(r, dur=None, **p):
    n = int((dur or 0.9) * SR); k = tvec(n); y = np.zeros(n)
    y += lpf(r.standard_normal(n), 320) * dexp(n, 0.05, 0.001) * 1.6
    y += np.sin(2 * np.pi * np.cumsum(55 + 60 * np.exp(-k / 0.04)) / SR) * dexp(n, 0.09, 0.002) * 0.9
    y += _modal(r, n, [190, 330, 560, 810], [.14, .10, .07, .05], [.5, .35, .25, .15]) * np.minimum(1, k / 0.002)
    y += lpf(colored(n, 1, r), 900) * dexp(n, 0.03, 0.001) * 0.4
    for t0, g in ((0.02, 1.0), (0.062, 0.45)):  # latch: strike then catch
        m = int(0.12 * SR); kk = tvec(m)
        c = (_modal(r, m, r.uniform(2200, 3800, 3), [.014, .01, .008], [.5, .4, .3]) + bpf(r.standard_normal(m), 1500, 5000) * np.exp(-kk / 0.004)) * np.minimum(1, kk / 0.0004)
        _put(y, c * g * 0.55, int(t0 * SR))
    return _fin(lpf(y, 7000), .0005, .12)


def brakes(r, dur=None, **p):
    n = int((dur or 1.8) * SR); k = tvec(n)
    hiss = bpf(colored(n, 0.2, r), 2200, 9000) * (np.minimum(1, k / 0.02) * np.exp(-k / 0.55) + 0.3 * np.exp(-((k - 0.9) / 0.3) ** 2))
    hiss *= 1 + 0.12 * smooth(n, 12, r)
    fc = r.uniform(1800, 3400) * (1 - 0.25 * k / k[-1] + 0.03 * smooth(n, 6, r))
    m = shape(colored(n, 0.3, r), lambda f, t: 0.02 + np.exp(-0.5 * (np.log2(np.maximum(f, 30) / np.interp(t, k, fc)) / 0.06) ** 2), 1024)
    sq = _nrm(m) * np.clip(0.5 + 0.5 * smooth(n, 5, r), 0, 1) * (np.exp(-((k - 0.35) / 0.5) ** 2)) * 0.6
    thump = lpf(colored(n, 1.5, r), 180) * dexp(n, 0.1, 0.01) * 0.3
    return _fin(lpf(_nrm(hiss) * 0.7 + sq + thump, 9000), .02, .25)


def reverse_beep(r, dur=None, veh='truck', **p):
    n = int((dur or 3.0) * SR); k = tvec(n); f0 = 1000 if veh != 'forklift' else 1250; f0 *= r.uniform(.97, 1.03)
    per = 1.0 if veh != 'forklift' else 0.8; on = per * 0.5; ph = (k + r.uniform(0, per)) % per
    gate = np.clip(ph / 0.006, 0, 1) * np.clip((on - ph) / 0.012, 0, 1) * (ph < on)
    tone = sum(np.sin(2 * np.pi * h * f0 * k) / h ** 1.3 for h in (1, 3, 5, 7)) + 0.03 * _nrm(bpf(colored(n, .5, r), 800, 2500))
    y = bpf(tone, 600, 4200) * gate
    return _fin(_air(lpf(y, 3800), .7, .3, seed=41), .02, .1)


def container(r, dur=None, **p):
    n = int((dur or 2.5) * SR); k = tvec(n); y = np.zeros(n); hard = r.uniform(.8, 1.2)
    y += _modal(r, n, [58, 86, 123, 161, 214, 347, 610, 1020], [1.1, .9, .75, .6, .5, .3, .2, .12], [1, .8, .8, .55, .5, .35, .3, .15]) * np.minimum(1, k / 0.002) * hard
    y += lpf(r.standard_normal(n), 140) * dexp(n, .06, .001) * 1.2
    y += bpf(r.standard_normal(n), 1200, 5500) * dexp(n, .035, .0005) * 0.6 + bpf(r.standard_normal(n), 400, 1500) * dexp(n, .12, .001) * .4
    for _ in range(r.integers(3, 7)):  # loose lashings / twist-lock rattle after the hit
        t0 = r.uniform(.08, .9); m = int(.25 * SR)
        c = _modal(r, m, r.uniform(500, 3000, 3), [.05, .04, .03], [.4, .3, .2]) * np.minimum(1, tvec(m) / .0005) * r.uniform(.1, .35) * np.exp(-t0 * 2)
        _put(y, c, int(t0 * SR))
    return _fin(lpf(y, 8000), .0005, .3)


def chain(r, dur=None, **p):
    n = int((dur or 2.5) * SR); y = np.zeros(n); dd = n / SR; sw = np.clip(0.6 + 0.5 * smooth(n, 1.5, r), 0.05, 1.5)
    t = r.uniform(0, .1)
    while t < dd:
        m = int(.09 * SR); kk = tvec(m); a = sw[min(n - 1, int(t * SR))] * r.uniform(.3, 1)
        c = (_modal(r, m, r.uniform(1800, 4200, 3), r.uniform(.01, .035, 3), [.5, .35, .25], jit=.05) + 0.5 * bpf(r.standard_normal(m), 1500, 6000) * np.exp(-kk / .004)) * np.minimum(1, kk / .0004)
        _put(y, c * a, int(t * SR)); t += r.uniform(.012, .06) * (1.6 - np.clip(sw[min(n - 1, int(t * SR))], 0, 1))
    y += 0.35 * _nrm(bpf(colored(n, 0.8, r), 500, 3000)) * np.clip(sw, 0, 1) * 0.2
    return _fin(lpf(y, 9000), .05, .2)


def crane(r, dur=None, **p):
    n = int((dur or 4.0) * SR); k = tvec(n); t = np.linspace(0, 1, n)
    run = _ss(t / .12) * (1 - _ss((t - .88) / .12)); f = 280 + 260 * run + 15 * smooth(n, .7, r) + 6 * smooth(n, 9, r)
    ph = np.cumsum(f) / SR
    whine = _nrm(_harm(ph, f, 8, 1.3, [(900, 1, 1)], r, hi=4000)) * (1 + .08 * smooth(n, 4, r))
    gear = _nrm(np.sin(2 * np.pi * np.cumsum(f * 3.7) / SR)) * .3
    hum = np.sin(2 * np.pi * 50 * k) * .35 + np.sin(2 * np.pi * 100 * k) * .2 + _nrm(lpf(colored(n, 1.5, r), 250)) * .4
    creak = np.zeros(n)
    for _ in range(r.integers(2, 5)):  # cable slip-stick creaks
        d = r.uniform(.25, .7); m = int(d * SR); kk = tvec(m); f0 = r.uniform(70, 160) * (1 + .25 * kk / d)
        saw = (np.cumsum(f0) / SR) % 1; env = np.sin(np.pi * kk / d) ** 2
        _put(creak, bpf(saw - .5, 500, 1800) * env * r.uniform(.15, .3), int(r.uniform(0, max(.1, n / SR - d)) * SR))
    y = (0.18 * whine + 0.15 * gear + 0.08 * _nrm(bpf(colored(n, 1, r), 300, 2500)) + hum * .25 + creak * 1.5 + .03 * _nrm(hpf(colored(n, 1, r), 1500))) * (0.15 + 0.85 * run)
    return _fin(lpf(y, 7000), .1, .25)


def splash(r, dur=None, size=1.0, **p):
    n = int((dur or 2.0) * SR); k = tvec(n); s = {'small': 0.5, 'medium': 1.0, 'large': 1.6}.get(size, size) if isinstance(size, str) else size; s = float(s)
    y = bpf(r.standard_normal(n), 300, 3500) * dexp(n, .05 * s, .001) * 1.0
    y += _nrm(bpf(colored(n, .8, r), 150, 1800)) * (1 - np.exp(-k / .02)) * np.exp(-k / (.6 * s)) * .55
    y += lpf(r.standard_normal(n), 220 / s) * dexp(n, .09 * s, .002) * 1.1
    for _ in range(r.integers(4, 9)):  # trapped bubbles (Minnaert chirps)
        t0 = r.uniform(.01, .35 * s + .1); m = int(.12 * SR); kk = tvec(m); f0 = r.uniform(350, 1500) / s ** .5
        b = np.sin(2 * np.pi * np.cumsum(f0 * (1 + 4 * kk)) / SR) * np.exp(-kk / r.uniform(.02, .05)) * np.minimum(1, kk / .002)
        _put(y, b * r.uniform(.1, .35), int(t0 * SR))
    y += 0.2 * hpf(r.standard_normal(n), 3000) * dexp(n, .25, .005)
    return _fin(lpf(y, 9000), .0005, .3)


def rail_clack(r, dur=None, speed=None, **p):
    n = int((dur or 4.0) * SR); v = float(speed or r.uniform(18, 28)); k = tvec(n)
    y = _clacks(r, n, v, None, 1.0) + .3 * _nrm(lpf(colored(n, 2, r), 150)) + .12 * _nrm(bpf(colored(n, .6, r), 600, 3000))
    return _fin(_air(lpf(y, 6000), .9, .15, seed=51), .05, .2)


GEN = {'engine': engine, 'horn': horn, 'door_car': door_car, 'brakes': brakes, 'reverse_beep': reverse_beep,
       'container': container, 'chain': chain, 'crane': crane, 'splash': splash, 'rail_clack': rail_clack}
TRIM = {'engine': -4, 'horn': -3, 'door_car': -2, 'brakes': -5, 'reverse_beep': -5, 'container': -1,
        'chain': -4, 'crane': -5, 'splash': -2, 'rail_clack': -5}
ROOM = {'engine': (0, 0), 'horn': (0, 0), 'rail_clack': (0, 0), 'door_car': (.5, .25), 'brakes': (.6, .2),
        'reverse_beep': (0, 0), 'container': (1.2, .5), 'chain': (.6, .25), 'crane': (1.0, .3), 'splash': (.8, .3)}
