"""Soft diegetic SFX for Doc2D, synthesised per cue (seeded -> deterministic, but every hit varies).
make(kind, seed, **params) -> stereo float array, peak-normalised; docmix levels it by loudness."""
import numpy as np
from dsp import SR, colored, lpf, hpf, bpf, smooth, shape, tvec, dexp, pan, st, add, reverb

KINDS = ['paper', 'pencil', 'type', 'page', 'chalk', 'whoosh_soft', 'camera_shutter', 'cash', 'stamp_soft', 'ui_tick']
# per-kind trim (dB) on top of the --soft-db level: quiet textures sit lower than one-shot accents
TRIM = {'paper': -2, 'pencil': -5, 'type': -4, 'page': -1, 'chalk': -4, 'whoosh_soft': -3,
        'camera_shutter': -2, 'cash': -3, 'stamp_soft': 0, 'ui_tick': -6}


def _crackle(n, rate, r, tau=0.0015, lo=900, hi=9000):
    """Dense micro-transients (paper fibres, graphite grain): Poisson impulses through short decays."""
    imp = np.zeros(n); k = r.poisson(rate * n / SR); idx = r.integers(0, n, k)
    np.add.at(imp, idx, r.lognormal(0, 0.7, k) * r.choice([-1, 1], k))
    ker = r.standard_normal(int(tau * 6 * SR)) * np.exp(-tvec(int(tau * 6 * SR)) / tau)
    return bpf(np.convolve(imp, ker)[:n], lo, hi)


def paper(r, dur=None, **p):
    """Paper slide / handling rustle."""
    d = dur or r.uniform(0.45, 0.75); n = int(d * SR); t = tvec(n)
    env = np.sin(np.pi * np.clip(t / d, 0, 1)) ** 1.5 * (0.7 + 0.3 * smooth(n, 12, r).clip(-1, 1))
    slide = bpf(colored(n, 0.5, r), 700, 7000) * env * 0.5
    crk = _crackle(n, 420, r) * env ** 0.7 * 0.35
    return slide + crk


def pencil(r, dur=None, **p):
    """Graphite strokes on paper: grainy, bandlimited, stroke-rate amplitude pattern, tip tap at start."""
    d = dur or r.uniform(0.7, 1.1); n = int(d * SR); t = tvec(n); rate = r.uniform(4.5, 7)
    strokes = np.abs(np.sin(np.pi * rate * t + r.uniform(0, 1))) ** 0.8
    env = strokes * np.minimum(1, t / 0.03) * np.minimum(1, (d - t) / 0.08).clip(0)
    grain = np.abs(lpf(r.standard_normal(n), 380)); grain /= grain.max() + 1e-9
    scratch = bpf(r.standard_normal(n), 2200, 8500) * (0.35 + grain) * env
    # brightness follows stroke direction (push vs pull)
    scratch = scratch + 0.4 * bpf(scratch, 4000, 8000) * (np.sin(np.pi * rate * t) > 0)
    tap = bpf(r.standard_normal(int(0.02 * SR)), 1500, 6000) * dexp(int(0.02 * SR), 0.002)
    out = scratch * 0.5; out[:len(tap)] += tap * 0.6; return out


def chalk(r, dur=None, **p):
    """Chalk on slate: knock on contact, coarse gritty strokes, lower band than pencil."""
    d = dur or r.uniform(0.9, 1.3); n = int(d * SR); t = tvec(n); rate = r.uniform(2.8, 4)
    env = np.abs(np.sin(np.pi * rate * t + 0.3)) ** 0.6 * np.minimum(1, (d - t) / 0.1).clip(0)
    grit = _crackle(n, 1400, r, tau=0.0025, lo=900, hi=5200) * env
    body = bpf(r.standard_normal(n), 1100, 4200) * env * 0.25
    kn = int(0.06 * SR); knock = bpf(r.standard_normal(kn), 250, 1400) * dexp(kn, 0.012) \
        + np.sin(2 * np.pi * r.uniform(380, 520) * tvec(kn)) * dexp(kn, 0.018) * 0.5
    out = (grit * 0.5 + body); out[:kn] += knock * 0.9; return out


def type_(r, dur=None, **p):
    """Typewriter at a little distance: typebar strike + frame ring + platen thud, word gaps, space bar."""
    d = dur or 1.6; n = int((d + 0.3) * SR); out = np.zeros(n); t = 0.0
    ring_f = r.uniform(1300, 1800) * np.array([1, 2.31, 3.67])
    while t < d:
        space = r.random() < 0.16; m = int(0.09 * SR); k = tvec(m)
        strike = bpf(r.standard_normal(m), 1800, 7500) * dexp(m, 0.0022)
        ring = sum(np.sin(2 * np.pi * f * r.uniform(0.98, 1.02) * k + r.uniform(0, 6)) * dexp(m, 0.03 / (j + 1)) * (0.25 / (j + 1))
                   for j, f in enumerate(ring_f))
        thud = lpf(r.standard_normal(m), 520) * dexp(m, 0.012) * 1.6
        ev = (thud * 1.4 + strike * 0.3) if space else (strike + ring + thud * 0.7) * r.uniform(0.7, 1)
        ratchet = bpf(r.standard_normal(m), 2500, 6000) * dexp(m, 0.001) * 0.25
        i = int(t * SR); add_m(out, ev, i); add_m(out, ratchet, i + int(r.uniform(0.012, 0.02) * SR))
        t += r.uniform(0.09, 0.17) + (r.uniform(0.12, 0.35) if space else 0) + (r.uniform(0.3, 0.6) if r.random() < 0.05 else 0)
    return out


def add_m(buf, ev, i):
    b = min(len(buf), i + len(ev))
    if i < len(buf): buf[i:b] += ev[:b - i]


def page(r, dur=None, **p):
    """Page turn: crinkle lift -> rising swish -> soft flap as it lands."""
    d = dur or r.uniform(0.65, 0.85); n = int(d * SR); t = tvec(n); x = colored(n, 0.6, r)
    peak = r.uniform(0.5, 0.62)
    M = lambda f, tt: np.exp(-0.5 * (np.log2(np.maximum(f, 50) / (700 * 2 ** (2.2 * np.clip(tt / d, 0, 1)))) / 1.2) ** 2)
    swish = shape(x, M) * np.exp(-0.5 * ((t / d - peak) / 0.2) ** 2)
    lift = _crackle(n, 300, r) * np.exp(-0.5 * ((t / d - 0.15) / 0.1) ** 2) * 0.6
    fn = int(0.08 * SR); flap = bpf(r.standard_normal(fn), 120, 700) * dexp(fn, 0.018)
    out = swish * 0.8 + lift; add_m(out, flap * 0.9, int((peak + 0.18) * d * SR))
    return pan(out, np.linspace(-0.35, 0.35, n) * r.choice([-1, 1]))


def whoosh_soft(r, dur=None, **p):
    """Soft air pass: band of pink noise gliding up then down, gentle pan sweep."""
    d = dur or r.uniform(0.7, 0.95); n = int(d * SR); t = tvec(n); x = colored(n, 1.0, r)
    M = lambda f, tt: np.exp(-0.5 * (np.log2(np.maximum(f, 40) / (260 * 2 ** (2.3 * np.sin(np.pi * np.clip(tt / d, 0, 1)) ** 1.5))) / 0.9) ** 2)
    y = shape(x, M); env = np.sin(np.pi * np.clip(t / d, 0, 1) ** 0.8) ** 2
    s = r.choice([-1, 1]); return pan(y * env, s * np.linspace(-0.6, 0.6, n))


def camera_shutter(r, dur=None, **p):
    """Mechanical SLR: mirror slap + first curtain, spring buzz, second curtain."""
    n = int(0.22 * SR); out = np.zeros(n); m = int(0.04 * SR); k = tvec(m)
    def clk(g, fr):
        return (bpf(r.standard_normal(m), 2000, 9000) * dexp(m, 0.0012) + np.sin(2 * np.pi * fr * k) * dexp(m, 0.007) * 0.35) * g
    add_m(out, clk(1.0, r.uniform(2900, 3400)) + lpf(r.standard_normal(m), 450) * dexp(m, 0.01) * 0.9, 0)
    b = int(0.03 * SR); buzz = bpf(r.standard_normal(b), 900, 3200) * (0.5 + 0.5 * np.sin(2 * np.pi * 380 * tvec(b))) * dexp(b, 0.012) * 0.3
    add_m(out, buzz, int(0.006 * SR)); add_m(out, clk(0.6, r.uniform(2400, 2800)), int(r.uniform(0.065, 0.085) * SR))
    return out


def cash(r, dur=None, **p):
    """A few coins settling on a counter: inharmonic metal partials, bounces getting closer."""
    n = int(0.9 * SR); out = np.zeros(n); t = 0.0; g = 1.0; gap = r.uniform(0.09, 0.14)
    for _ in range(r.integers(4, 7)):
        m = int(0.5 * SR); k = tvec(m); f0 = r.uniform(2600, 4200)
        coin = sum(np.sin(2 * np.pi * f0 * q * k + r.uniform(0, 6)) * dexp(m, tau) * a
                   for q, tau, a in [(1, 0.18, 1), (1.52, 0.11, 0.5), (2.33, 0.07, 0.35), (3.4, 0.04, 0.2)])
        coin += bpf(r.standard_normal(m), 3000, 9000) * dexp(m, 0.0008) * 0.6
        add_m(out, coin * g * r.uniform(0.6, 1), int(t * SR)); t += gap * r.uniform(0.6, 1.1); gap *= 0.75; g *= 0.7
    return lpf(out, 7500)


def stamp_soft(r, dur=None, **p):
    """Rubber stamp: wooden handle knock + muffled rubber/paper thud, faint tacky lift-off."""
    n = int(0.45 * SR); out = np.zeros(n); m = int(0.12 * SR); k = tvec(m); f = r.uniform(80, 95)
    thud = np.sin(2 * np.pi * f * k * (1 - 0.15 * k / 0.12)) * dexp(m, 0.045, 0.002) + lpf(r.standard_normal(m), 320) * dexp(m, 0.025) * 0.8
    knock = bpf(r.standard_normal(m), 400, 1600) * dexp(m, 0.005) * 0.4 + np.sin(2 * np.pi * r.uniform(650, 780) * k) * dexp(m, 0.012) * 0.25
    add_m(out, thud + knock, 0)
    lm = int(0.05 * SR); add_m(out, bpf(r.standard_normal(lm), 900, 4000) * dexp(lm, 0.006, 0.004) * 0.08, int(r.uniform(0.25, 0.32) * SR))
    return out


def ui_tick(r, dur=None, **p):
    """Tiny, rounded interface tick (felt, not heard)."""
    m = int(0.05 * SR); k = tvec(m)
    return bpf(r.standard_normal(m), 2500, 7000) * dexp(m, 0.0009) * 0.6 + np.sin(2 * np.pi * r.uniform(1700, 2000) * k) * dexp(m, 0.004, 0.0008) * 0.5


GEN = {'paper': paper, 'pencil': pencil, 'type': type_, 'page': page, 'chalk': chalk, 'whoosh_soft': whoosh_soft,
       'camera_shutter': camera_shutter, 'cash': cash, 'stamp_soft': stamp_soft, 'ui_tick': ui_tick}
ROOM = {'whoosh_soft': (0.6, 0.18), 'ui_tick': (0.25, 0.1)}  # (rt, wet); default small room


# plug-in modules add their own GEN / TRIM / ROOM (and optional ALIGN: kind -> "end" when the cue time is the sound's end)
ALIGN = {}
for _m in ('foley', 'vehicles', 'creatures', 'stingers', 'events', 'envfx', 'industryfx'):
    try: _mod = __import__(_m)
    except ModuleNotFoundError as e:
        if e.name != _m: raise
        continue
    GEN.update(_mod.GEN); TRIM.update(getattr(_mod, 'TRIM', {})); ROOM.update(getattr(_mod, 'ROOM', {})); ALIGN.update(getattr(_mod, 'ALIGN', {}))
KINDS = list(GEN)


def make(kind, seed, dur=None, **p):
    """Render one cue -> stereo float, peak 0.5. ROOM[kind] = (rt, wet); (0, 0) skips the room reverb."""
    r = np.random.default_rng(seed); x = GEN[kind](r, dur, **p)
    x = st(x) if x.ndim == 2 else pan(x, p.get('pan', r.uniform(-0.25, 0.25)))
    rt, wet = ROOM.get(kind, (0.35, 0.22))
    if wet > 0: x = reverb(np.pad(x, ((0, 0), (0, int(rt * SR)))), rt, wet, seed=7, bright=5000)
    x = hpf(lpf(x, 14000), 30)
    assert np.isfinite(x).all(), kind
    return x / (np.abs(x).max() + 1e-9) * 0.5
