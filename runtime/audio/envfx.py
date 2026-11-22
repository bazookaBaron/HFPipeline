"""Environment event sounds for runtime/doc/fx/env.js (synthesised; sfx.py merges GEN/TRIM/ROOM). Documentary distance.
thunder {near}   wind {dur, strength soft|medium|strong}   lights_on {dur}   power_cut {dur}
water_rush {dur}   quake {dur}   hiss {dur}"""
import numpy as np
from dsp import SR, colored, lpf, hpf, bpf, shape, smooth, tvec, dexp, pan, reverb
from events import _edge, _crackle


def thunder(r, dur=None, near=False, **p):
    """Near: tearing crack then a long roll. Far: only the low roll (fx.js delays it after the flash)."""
    n = int(7.0 * SR); t = tvec(n); out = np.zeros(n); roll = np.zeros(n)
    for i in range(r.integers(3, 6)):                       # the roll: several overlapping swells
        c = (0.3 if near else 0.6) + i * r.uniform(0.6, 1.3); w = r.uniform(0.5, 1.2)
        roll += np.exp(-((t - c) / w) ** 2) * r.uniform(0.5, 1) * 0.85 ** i
    out += lpf(colored(n, 2, r), 260 if near else 160) * roll * 1.4 + bpf(colored(n, 1.5, r), 80, 500) * roll * 0.5
    if near:
        m = int(0.35 * SR)
        out[:m] += lpf(_crackle(m, 900, r, 0.0015, 300, 5000) * np.exp(-tvec(m) / 0.12) * 1.6 + bpf(r.standard_normal(m), 400, 4000) * dexp(m, 0.02, 0.0005), 6000)
    return _edge(reverb(pan(out, r.uniform(-0.4, 0.4)), 3.5, 1.0, seed=101, bright=2500 if near else 900), 0.003, 1.0)


def wind(r, dur=None, strength='medium', **p):
    """Gusts: a band of pink noise whose centre and level follow a gust envelope; strong adds a whistling howl."""
    d = dur or 6.0; n = int(d * SR); k = {'soft': 0.35, 'medium': 0.65, 'strong': 1.0}.get(strength, 0.65)
    g = np.clip(0.35 + 0.35 * k + (0.2 + 0.25 * k) * smooth(n, 0.35 + 0.4 * k, r), 0.05, 1.6); tf = tvec(n)
    wf = 900 * 2 ** (0.3 * smooth(n, 0.1, r)); out = []
    for c in range(2):
        gg = np.roll(g, int(c * 0.15 * SR))
        def M(f, tt, gg=gg):
            Gt = np.interp(tt, tf, gg); lf = np.log2(np.maximum(f, 20) / (160 + 900 * Gt ** 1.3))
            m = np.exp(-0.5 * (lf / 1.0) ** 2) * Gt ** 1.7 + 0.3 * np.exp(-0.5 * (np.log2(np.maximum(f, 20) / 70) / 1.0) ** 2) * Gt
            if k >= 0.9: m = m + 1.2 * np.exp(-0.5 * (np.log2(np.maximum(f, 20) / np.interp(tt, tf, wf)) / 0.05) ** 2) * np.clip(Gt - 0.8, 0, None) ** 1.3
            return m
        out.append(shape(colored(n, 1.0, r), M, 2048))
    return _edge(np.vstack(out), 0.8, 1.0)


def _hum(n, f=50.0, buzz=0.0):
    t = tvec(n); h = sum(np.sin(2 * np.pi * f * q * t + q) * a for q, a in [(1, .5), (2, 1), (3, .3), (4, .4), (6, .2)])
    if buzz: h = h + buzz * sum(np.sin(2 * np.pi * 100 * q * t) / q ** 0.7 for q in range(3, 22))   # fluorescent ballast buzz
    return h


def _contactor(r, big=1.0):
    m = int(0.18 * SR); k = tvec(m)
    return (lpf(r.standard_normal(m), 350) * dexp(m, 0.02) * 1.2 * big + bpf(r.standard_normal(m), 1500, 6000) * dexp(m, 0.002) * 0.6
            + np.sin(2 * np.pi * r.uniform(700, 1100) * k) * dexp(m, 0.015) * 0.2)


def lights_on(r, dur=None, **p):
    """Block by block: relay / contactor clicks across the city, each adding a little mains hum and ballast buzz."""
    d = dur or 4.0; n = int((d + 1.0) * SR); out = np.zeros((2, n)); level = np.zeros(n)
    steps = int(r.integers(5, 9))
    for tc in np.sort(r.uniform(0, d, steps)):
        j = int(tc * SR); ev = pan(_contactor(r, 0.6) * r.uniform(0.4, 1) * 0.7, r.uniform(-0.9, 0.9))
        b = min(n, j + ev.shape[1]); out[:, j:b] += ev[:, :b - j]; level[j:] += 1.0 / steps
    hum = _hum(n, 50, 0.08) * lpf(level, 8) * 0.05
    return _edge(reverb(out + pan(hum, 0), 1.5, 0.6, seed=103), 0.002, 0.6)


def power_cut(r, dur=None, **p):
    """A heavy breaker clunk with a spit of arc, the running hum spinning down and out, then silence."""
    d = dur or 3.0; n = int(max(d, 2.5) * SR); t = tvec(n); t0 = 0.4; i0 = int(t0 * SR)
    f = np.where(t < t0, 50.0, 50.0 - 32.0 * np.clip((t - t0) / 1.4, 0, 1) ** 0.7)   # transformers / motors spin down
    ph = np.cumsum(f) / SR; hum = sum(np.sin(2 * np.pi * q * ph) * a for q, a in [(1, .6), (2, 1), (3, .3), (4, .3)])
    out = hum * np.where(t < t0, 1.0, np.exp(-(t - t0) / 0.45)) * 0.06
    ev = _contactor(r, 1.6) * 1.2; out[i0:i0 + len(ev)] += ev
    m = int(0.12 * SR); out[i0:i0 + m] += _crackle(m, 900, r, 0.0008, 1500, 7000) * 0.2 * np.exp(-tvec(m) / 0.03)
    return _edge(reverb(pan(out, 0), 1.2, 0.5, seed=105), 0.1, 0.3)


def water_rush(r, dur=None, **p):
    """Flood surge: rushing water rising in level and brightness, churning, gurgles."""
    d = dur or 4.0; n = int(d * SR); t = tvec(n)
    rise = np.clip(t / (0.65 * d), 0, 1) ** 1.5; churn = 1 + 0.25 * smooth(n, 4, r)
    M = lambda f, tt: np.exp(-0.5 * (np.log2(np.maximum(f, 30) / (250 + 700 * np.interp(tt, t, rise))) / 1.4) ** 2)
    body = np.vstack([shape(colored(n, 0.8, r), M, 2048) for _ in range(2)])
    out = body * (0.1 + rise) * churn + np.vstack([lpf(colored(n, 2, r), 120)] * 2) * rise * 0.6
    for _ in range(int(d * 6)):                              # gurgles / bubbles
        m = int(0.05 * SR); k = tvec(m)
        g = np.sin(2 * np.pi * np.cumsum(r.uniform(300, 1200) * (1 + 3 * k / 0.05)) / SR) * dexp(m, 0.012) * 0.08
        i = int(r.integers(int(0.2 * n), n - m)); out[:, i:i + m] += pan(g, r.uniform(-1, 1)) * rise[i]
    return _edge(reverb(out, 1.2, 0.4, seed=107), 0.2, 0.5)


def quake(r, dur=None, **p):
    """Deep rumble swelling, everything rattling, then glass and objects settling as it fades."""
    d = dur or 5.0; n = int((d + 1.5) * SR); t = tvec(n); u = np.clip(t / d, 0, 1)
    env = np.sin(np.pi * u) ** 0.8 * np.minimum(1, t / 0.4)
    sub = np.sin(2 * np.pi * np.cumsum(18 + 6 * smooth(n, 1.5, r)) / SR) * 0.6
    rumble = (lpf(colored(n, 2, r), 90) * 1.4 + bpf(colored(n, 1.5, r), 80, 400) * 0.6 + sub) * env * (1 + 0.3 * smooth(n, 6, r))
    out = np.vstack([rumble + _crackle(n, 160, r, 0.003, 600, 4000) * env ** 1.5 * 0.2, rumble + _crackle(n, 160, r, 0.003, 600, 4000) * env ** 1.5 * 0.2])
    for _ in range(int(r.integers(5, 9))):                   # glass tinkle + settling objects at the end
        m = int(0.6 * SR); k = tvec(m); i = int(r.uniform(0.75, 1.05) * d * SR)
        if r.random() < 0.6:
            f0 = r.uniform(2500, 5500); ev = sum(np.sin(2 * np.pi * f0 * q * k) * dexp(m, 0.15 / q) / q for q in (1, 2.4, 3.9)) * 0.08
        else: ev = lpf(r.standard_normal(m), 600) * dexp(m, 0.03) * 0.3
        b = min(n, i + m); out[:, i:b] += pan(ev, r.uniform(-0.8, 0.8))[:, :b - i]
    return _edge(reverb(out, 1.4, 0.4, seed=109), 0.3, 0.8)


def hiss(r, dur=None, **p):
    """Hose on fire: steam hiss sputtering, water spray, sizzle crackles, dying away."""
    d = dur or 3.0; n = int(d * SR); t = tvec(n); env = np.minimum(1, t / 0.15) * np.exp(-t / (0.6 * d))
    sput = np.clip(1 + 0.5 * smooth(n, 9, r), 0.2, None)
    spray = bpf(colored(n, 0.5, r), 700, 4000) * np.minimum(1, t / 0.1) * 0.35 * np.exp(-t / (1.2 * d))
    ch = lambda: bpf(r.standard_normal(n), 2500, 11000) * sput * env + spray + _crackle(n, 80, r, 0.0008, 3000, 10000) * env * 0.4
    return _edge(reverb(np.vstack([ch(), ch()]), 0.8, 0.3, seed=111), 0.05, 0.4)


GEN = {'thunder': thunder, 'wind': wind, 'lights_on': lights_on, 'power_cut': power_cut, 'water_rush': water_rush, 'quake': quake, 'hiss': hiss}
TRIM = {'thunder': 3, 'wind': -6, 'lights_on': -6, 'power_cut': -2, 'water_rush': -2, 'quake': 2, 'hiss': -5}
ROOM = {k: (0, 0) for k in GEN}
