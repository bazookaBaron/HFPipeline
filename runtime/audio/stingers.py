"""Stingers, risers and the sonic logo (synthesised; sfx.py merges GEN/TRIM/ROOM/ALIGN).
hit        big reveal impact: sub drop + low drum body + bowed-metal tone + hall tail
hit_soft   chapter-opener accent: felt low drum + short tonal bloom
reveal     shimmer swell resolving into a glassy bell
riser      {t, kind:"riser", dur}: builds for `dur` s and ENDS at t (ALIGN "end") -> cliffhanger / #part cut
logo       ~1.6 s signature: paper flick -> three felt-mallet notes (D-A-F#) over a soft sub, warm tail"""
import numpy as np
from dsp import SR, colored, lpf, hpf, bpf, shape, tvec, dexp, pan, st, reverb


def _fade(x, a=0.004, b=0.05):
    n = x.shape[-1]; e = np.ones(n); ia, ib = int(a * SR), int(b * SR)
    e[:ia] = np.linspace(0, 1, ia); e[n - ib:] *= np.linspace(1, 0, ib); return x * e


def mallet(f, d, r, bright=1.0):
    """Felt-mallet / soft piano-ish note: inharmonic-ish partials, highs decay first, felt thump."""
    n = int(d * SR); t = tvec(n); x = np.zeros(n)
    for k, (q, a) in enumerate([(1, 1), (2.0, .45), (3.01, .22), (4.03, .12), (5.4, .06), (6.8, .03)]):
        tau = 1.6 / (1 + 1.4 * k) * (0.7 + 0.6 * r.random())
        x += np.sin(2 * np.pi * f * q * t * (1 + 0.0004 * k) + r.uniform(0, 6)) * a * bright ** k * np.exp(-t / tau)
    x *= np.minimum(1, t / 0.004)
    m = int(0.03 * SR); x[:m] += lpf(r.standard_normal(m), 900) * dexp(m, 0.006) * 0.25
    return x


def hit(r, dur=None, **p):
    n = int(4.5 * SR); t = tvec(n)
    sub = np.sin(2 * np.pi * np.cumsum(38 + 50 * np.exp(-t / 0.08)) / SR) * dexp(n, 0.9, 0.003)
    body = lpf(r.standard_normal(n), 260) * dexp(n, 0.07) * 1.4 + bpf(r.standard_normal(n), 500, 3000) * dexp(n, 0.012) * 0.25
    tone = sum(np.sin(2 * np.pi * 73.42 * q * t + r.uniform(0, 6)) * a * np.exp(-t / tau)
               for q, a, tau in [(1, .5, 1.6), (1.5, .3, 1.2), (2, .25, 1.0), (2.76, .12, .7), (4.1, .06, .5)])
    tone *= np.minimum(1, t / 0.02)
    x = sub * 0.9 + body + tone * 1.0
    return _fade(reverb(x, 3.2, 0.9, seed=41, bright=2500), 0.002, 0.8)


def hit_soft(r, dur=None, **p):
    n = int(2.6 * SR); t = tvec(n)
    drum = np.sin(2 * np.pi * np.cumsum(48 + 30 * np.exp(-t / 0.05)) / SR) * dexp(n, 0.35, 0.004) + lpf(r.standard_normal(n), 400) * dexp(n, 0.03) * 0.5
    bloom = sum(mallet(f, 2.6, r, 0.6) * a for f, a in [(146.8, .5), (220, .35)])
    return _fade(reverb(drum + bloom * 0.5, 2.2, 0.6, seed=43, bright=3000), 0.002, 0.6)


def reveal(r, dur=None, **p):
    d = dur or 2.8; n = int(d * SR); t = tvec(n); sw = 1.1
    x = colored(n, 0.7, r)
    M = lambda f, tt: np.exp(-0.5 * (np.log2(np.maximum(f, 40) / (600 * 2 ** (3 * np.clip(tt / sw, 0, 1)))) / 0.8) ** 2)
    swell = shape(x, M) * np.clip(t / sw, 0, 1) ** 2 * np.exp(-np.clip(t - sw, 0, None) / 0.15)
    bell = np.zeros(n); i = int(sw * SR); m = n - i; k = tvec(m)
    for q, a, tau in [(1, 1, 1.8), (2.32, .5, 1.1), (4.25, .3, .7), (5.4, .2, .5), (6.8, .1, .35)]:
        bell[i:] += np.sin(2 * np.pi * 880 * q * k) * a * np.exp(-k / tau) * np.minimum(1, k / 0.003)
    return _fade(reverb(pan(swell * 0.5, np.linspace(-.4, .4, n)) + st(bell * 0.25), 2.6, 1.0, seed=47, bright=7000), 0.01, 0.5)


def riser(r, dur=None, **p):
    """Ends abruptly at its last sample (the cut). Noise sweep + Shepard-ish rising cluster + reverse-cymbal air."""
    d = dur or 3.0; n = int(d * SR); t = tvec(n); u = t / d
    x = colored(n, 0.8, r)
    M = lambda f, tt: np.exp(-0.5 * (np.log2(np.maximum(f, 40) / (250 * 2 ** (4.5 * np.clip(tt / d, 0, 1) ** 1.6))) / 1.0) ** 2)
    sweep = shape(x, M)
    tones = np.zeros(n)
    for k in range(5):  # cluster gliding up ~ an octave, outer voices faded (Shepard-like)
        f0 = 110 * 2 ** (k * 0.75); f = f0 * 2 ** (1.0 * u ** 1.3)
        w = np.sin(np.pi * np.clip((k + u * 0.75) / 4.5, 0, 1)) ** 2
        tones += np.sin(2 * np.pi * np.cumsum(f) / SR + k) * w
    tones = lpf(tones, 3000) * (1 + 0.25 * np.sin(2 * np.pi * (3 + 9 * u) * t))  # tremolo accelerating
    air = hpf(r.standard_normal(n), 4000) * u ** 4
    env = (np.exp(4 * u) - 1) / (np.e ** 4 - 1)
    y = pan(sweep * env * 0.8 + tones * env * 0.35, 0) + pan(air * 0.25, np.sin(2 * np.pi * 0.7 * t) * 0.5)
    y = reverb(y, 1.4, 0.35, seed=53)
    y[:, :int(0.05 * SR)] *= np.linspace(0, 1, int(0.05 * SR)); y[:, -48:] *= np.linspace(1, 0, 48)
    return y


def logo(r, dur=None, **p):
    """Signature: soft paper flick -> D4 A4 F#5 felt notes 0.16 s apart over a warm D2 sub, resolves in 1.6 s."""
    r = np.random.default_rng(1701)  # the logo never varies
    n = int(3.2 * SR); out = np.zeros((2, n)); t0 = 0.14
    fl = int(0.16 * SR); k = tvec(fl)
    flick = shape(colored(fl, 0.5, r), lambda f, tt: np.exp(-0.5 * (np.log2(np.maximum(f, 50) / (1500 * 2 ** (1.5 * tt / 0.16))) / 0.9) ** 2))
    out[:, :fl] += pan(flick * np.sin(np.pi * k / k[-1]) ** 2 * 0.35, np.linspace(-0.5, 0.2, fl))
    for i, (f, pp, a) in enumerate([(293.66, -0.25, 1.0), (440.0, 0.1, 0.85), (739.99, 0.3, 0.75)]):
        s = int((t0 + 0.16 * i) * SR); m = n - s; out[:, s:] += pan(mallet(f, m / SR, r, 0.75) * a, pp)
    s = int((t0 + 0.32) * SR); m = n - s; k = tvec(m)
    sub = np.sin(2 * np.pi * 73.4 * k) * np.minimum(1, k / 0.06) * np.exp(-k / 0.9) * 0.6
    out[:, s:] += pan(sub + mallet(146.83, m / SR, r, 0.5) * 0.35, 0)
    return _fade(reverb(out, 1.9, 0.55, seed=59, bright=6000), 0.002, 0.9)


GEN = {'hit': hit, 'hit_soft': hit_soft, 'reveal': reveal, 'riser': riser, 'logo': logo}
TRIM = {'hit': 6, 'hit_soft': 2, 'reveal': 2, 'riser': 3, 'logo': 6}
ROOM = {k: (0, 0) for k in GEN}
ALIGN = {'riser': 'end'}
