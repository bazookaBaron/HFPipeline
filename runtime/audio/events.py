"""Conflict / disaster event sounds for runtime/doc/fx (synthesised; sfx.py merges GEN/TRIM/ROOM).
Documentary distance and restraint: heard as reported events, never gory or cartoonish.
explosion {size small|medium|large}   debris {dur}   drone {dur}   missile {dur}   siren {dur}
fire {dur, size}   boom_far (the caller already delays it after the flash)   alarm {dur}   crumble {dur}"""
import numpy as np
from dsp import SR, colored, lpf, hpf, bpf, shape, smooth, tvec, dexp, pan, st, reverb

SIZE = {'small': 0.55, 'medium': 0.8, 'large': 1.0}


def _edge(x, a=0.005, b=0.08):
    n = x.shape[-1]; e = np.ones(n); ia, ib = min(n, int(a * SR)), min(n, int(b * SR))
    e[:ia] = np.linspace(0, 1, ia); e[n - ib:] *= np.linspace(1, 0, ib); return x * e


def _crackle(n, rate, r, tau=0.002, lo=900, hi=6000):
    imp = np.zeros(n); k = r.poisson(max(1e-9, rate) * n / SR); idx = r.integers(0, n, k)
    np.add.at(imp, idx, r.lognormal(0, 0.8, k) * r.choice([-1, 1], k))
    m = int(tau * 8 * SR); ker = r.standard_normal(m) * np.exp(-tvec(m) / tau)
    return bpf(np.convolve(imp, ker)[:n], lo, hi)


def explosion(r, dur=None, size='medium', **p):
    """Blast at a few hundred metres: crack, chest thump, rolling body, crackle tail, outdoor slap-back."""
    k = SIZE.get(size, 0.8); n = int((2.0 + 3.0 * k) * SR); t = tvec(n)
    crack = hpf(r.standard_normal(n), 600) * dexp(n, 0.004 + 0.004 * k, 0.0003) * 0.6
    thump = np.sin(2 * np.pi * np.cumsum(28 + 50 * np.exp(-t / (0.05 + 0.05 * k))) / SR) * dexp(n, 0.25 + 0.5 * k, 0.002)
    body = lpf(colored(n, 1.5, r), 300 + 500 * k) * dexp(n, 0.25 + 0.9 * k, 0.004) * 1.4
    roll = lpf(colored(n, 2, r), 140) * np.exp(-np.maximum(t - 0.2, 0) / (0.8 + 1.5 * k)) * np.minimum(1, t / 0.15) * 0.9
    tail = _crackle(n, 120 * k, r) * np.exp(-t / (0.5 + 0.8 * k)) * np.minimum(1, t / 0.05) * 0.5
    chest = bpf(colored(n, 1, r), 150, 700) * dexp(n, 0.12 + 0.3 * k, 0.003) * 0.9      # low-mid weight that survives phone speakers
    x = crack + thump * 1.2 + body + roll + tail + chest
    x = lpf(x, 9000)
    y = reverb(x, 2.4 + 1.6 * k, 0.9, seed=81, bright=1800)
    d = int(0.32 * SR); y[:, d:] += 0.25 * lpf(y[:, :-d], 1200)                       # slap-back off buildings / water
    return _edge(y, 0.001, 0.6)


def debris(r, dur=None, water=None, **p):
    """Fragments raining down after a blast: thinning patter of small impacts, a few heavier thuds, splashes on water."""
    d = dur or 2.0; n = int((d + 0.6) * SR); out = np.zeros((2, n)); t = 0.0
    water = r.random() < 0.5 if water is None else water
    while t < d:
        m = int(0.12 * SR); k = tvec(m); heavy = r.random() < 0.12
        if water and r.random() < 0.4:
            ev = bpf(r.standard_normal(m), 400, 3000) * dexp(m, 0.03, 0.004) + np.sin(2 * np.pi * np.cumsum(r.uniform(500, 1200) * (1 + 2 * k)) / SR) * dexp(m, 0.012) * 0.3
        elif heavy:
            ev = lpf(r.standard_normal(m), 400) * dexp(m, 0.03) * 1.5 + bpf(r.standard_normal(m), 800, 3000) * dexp(m, 0.006) * 0.5
        else:
            f0 = r.uniform(900, 3500)
            ev = bpf(r.standard_normal(m), 1000, 6000) * dexp(m, 0.003) + np.sin(2 * np.pi * f0 * k) * dexp(m, 0.02) * 0.15
        i = int(t * SR); b = min(n, i + m); out[:, i:b] += pan(ev * r.uniform(0.3, 1) * (1 - 0.6 * t / d), r.uniform(-0.8, 0.8))[:, :b - i]
        t += r.exponential(0.035 + 0.25 * (t / d) ** 2)                                  # dense first, then sparse
    return _edge(reverb(out, 1.6, 0.5, seed=83), 0.002, 0.3)


def _pass_env(n, r):
    t = tvec(n); u = t / t[-1]; c = r.uniform(0.45, 0.6)
    env = np.exp(-((u - c) / 0.22) ** 2); dop = -np.tanh((u - c) / 0.08); return u, env, dop


def drone(r, dur=None, **p):
    """Small propeller drone passing: two-stroke-ish buzz (pulse train at the firing rate) + prop blade pass, doppler + pan."""
    d = dur or 5.0; n = int(d * SR); u, env, dop = _pass_env(n, r)
    f0 = r.uniform(95, 125) * (1 + 0.045 * dop) * (1 + 0.01 * smooth(n, 3, r))
    ph = np.cumsum(f0) / SR; frac = ph % 1
    pulse = np.exp(-frac / 0.06) * (1 + 0.25 * r.standard_normal(n).clip(-2, 2) * 0.3)    # combustion pulses with jitter
    buzz = lpf(pulse - pulse.mean(), 2600) + 0.3 * np.sin(2 * np.pi * 2 * ph)            # prop blade pass at 2x
    whine = np.sin(2 * np.pi * np.cumsum(f0 * 11.3) / SR) * 0.02
    x = (buzz + whine + bpf(r.standard_normal(n), 300, 3000) * 0.08) * env
    x = lpf(x, 2000) * (1 - env) + lpf(x, 6000) * env                                      # air absorption when far
    s = r.choice([-1, 1]); return _edge(reverb(pan(x, s * np.tanh((u - 0.5) * 4) * 0.8), 1.8, 0.5, seed=85), 0.05, 0.2)


def missile(r, dur=None, **p):
    """Jet whoosh overhead: broadband roar that brightens on approach and drops in pitch as it goes, low rumble under."""
    d = dur or 3.0; n = int(d * SR); u, env, dop = _pass_env(n, r)
    tf = tvec(n); E = lambda tt: np.interp(tt, tf, env); Dp = lambda tt: np.interp(tt, tf, dop)
    roar = shape(colored(n, 0.6, r), lambda f, tt: np.exp(-0.5 * (np.log2(np.maximum(f, 30) / (900 * 2 ** (0.6 * Dp(tt)))) / (1.4 + E(tt))) ** 2), 1024)
    rumble = lpf(colored(n, 2, r), 120) * 0.6
    x = (roar + rumble) * env ** 1.3
    s = r.choice([-1, 1]); return _edge(reverb(pan(x, s * np.tanh((u - 0.5) * 5) * 0.9), 2.2, 0.6, seed=87), 0.02, 0.3)


def siren(r, dur=None, **p):
    """Distant air-raid siren: rotor wail rising, holding, falling; rotation AM; heard across a city (lowpassed, slap echo)."""
    d = dur or 8.0; n = int((d + 2.5) * SR); t = tvec(n)
    rise, fall = min(3.0, d * 0.3), min(3.5, d * 0.35)
    f = 280 + 260 * np.clip(t / rise, 0, 1) ** 0.6 - 230 * np.clip((t - (d - fall)) / fall, 0, 1) ** 0.8
    ph = np.cumsum(f) / SR
    wave = sum(np.sin(2 * np.pi * h * ph) / h for h in (1, 3, 5, 7)) + 0.4 * np.sin(2 * np.pi * 2 * ph)   # rotor ports: odd-rich
    am = 0.65 + 0.35 * np.sin(2 * np.pi * 0.11 * t + r.uniform(0, 6))                   # the horn turning towards / away
    env = np.minimum(1, t / 0.8) * np.clip((d + 1.5 - t) / 1.5, 0, 1)
    x = lpf(wave * am * env, 2400)
    y = reverb(x, 3.5, 1.4, seed=89, bright=1500)
    k = int(0.55 * SR); y[:, k:] += 0.3 * y[:, :-k]                                       # echo off far buildings
    return _edge(y, 0.01, 0.4)


def fire(r, dur=None, size='medium', **p):
    """Burning: low roar breathing, dense small crackles, occasional snaps, faint hiss."""
    d = dur or 6.0; k = 1.0 if size == 'large' else 0.7 if size == 'medium' else 0.5; n = int(d * SR)
    roar = bpf(colored(n, 1.5, r), 90, 500 + 300 * k) * (1 + 0.35 * smooth(n, 0.8, r)) * (0.25 + 0.3 * k)
    cr = _crackle(n, 18 + 30 * k, r, 0.0012, 1200, 7000) * 0.9
    snaps = _crackle(n, 1.5 + 2 * k, r, 0.004, 400, 3000) * 2.0
    hiss = bpf(r.standard_normal(n), 2500, 7000) * 0.05 * k
    x = np.vstack([roar + cr + snaps + hiss, roar + _crackle(n, 18 + 30 * k, r, 0.0012, 1200, 7000) * 0.9 + snaps * 0.8 + hiss])
    return _edge(reverb(x, 0.9, 0.3, seed=91), 0.6, 0.8)


def boom_far(r, dur=None, **p):
    """Distant explosion kilometres away: no crack, just a low rolling rumble that swells and decays."""
    n = int(5.0 * SR); t = tvec(n)
    env = (1 - np.exp(-t / 0.12)) * np.exp(-t / r.uniform(0.9, 1.5)) + 0.25 * np.exp(-np.maximum(t - 0.6, 0) / 1.6) * np.minimum(1, t / 0.6)
    x = lpf(colored(n, 2, r), r.uniform(150, 230)) * env + bpf(colored(n, 1.5, r), 90, 450) * env * 0.45 + np.sin(2 * np.pi * np.cumsum(32 + 14 * np.exp(-t / 0.2)) / SR) * dexp(n, 0.6, 0.03) * 0.5
    return _edge(reverb(pan(x, r.uniform(-0.4, 0.4)), 4.0, 1.0, seed=93, bright=600), 0.02, 0.8)


def alarm(r, dur=None, **p):
    """Ship's general alarm: electric bell rings in a steel hull (bursts of strikes ~16 Hz on an inharmonic bell)."""
    d = dur or 6.0; n = int((d + 1.0) * SR); out = np.zeros(n); f0 = r.uniform(1050, 1250)
    m = int(0.25 * SR); k = tvec(m)
    strike = sum(np.sin(2 * np.pi * f0 * q * k) * a * np.exp(-k / tau) for q, a, tau in [(1, 1, .12), (2.76, .5, .06), (5.4, .25, .03), (8.9, .1, .02)])
    strike += bpf(r.standard_normal(m), 2000, 7000) * dexp(m, 0.001) * 0.4
    t = 0.0
    while t < d:                                                                          # ring ~1.4 s, pause ~0.6 s, repeat
        on = t % 2.0 < 1.4
        if on: i = int(t * SR); b = min(n, i + m); out[i:b] += strike[:b - i] * r.uniform(0.85, 1)
        t += 1 / 16.0 if on else 0.6
    x = lpf(out, 6000)
    return _edge(reverb(x, 1.3, 0.7, seed=95, bright=3500), 0.003, 0.4)


def crumble(r, dur=None, **p):
    """Masonry giving way: cracks, grinding, tumbling chunks, settling dust hiss."""
    d = dur or 2.0; n = int((d + 1.0) * SR); t = tvec(n); out = np.zeros(n)
    for _ in range(r.integers(2, 4)):                                                     # structural cracks
        m = int(0.08 * SR); i = int(r.uniform(0, 0.4 * d) * SR)
        c = bpf(r.standard_normal(m), 600, 5000) * dexp(m, 0.012) + lpf(r.standard_normal(m), 300) * dexp(m, 0.03) * 0.8
        out[i:i + m] += c[:max(0, n - i)][:m]
    grind = bpf(colored(n, 1, r), 150, 1800) * np.exp(-((t / d - 0.45) / 0.3) ** 2) * (0.6 + 0.4 * np.abs(smooth(n, 12, r)).clip(0, 1.5))
    chunks = _crackle(n, 25, r, 0.01, 120, 1500) * np.exp(-((t / d - 0.6) / 0.35) ** 2) * 1.5
    dust = bpf(r.standard_normal(n), 2000, 8000) * np.clip((t / d - 0.5) * 2, 0, 1) * np.exp(-np.maximum(t - d, 0) / 0.5) * 0.06
    x = out + grind * 0.7 + chunks + dust
    return _edge(reverb(pan(x, r.uniform(-0.3, 0.3)), 1.8, 0.6, seed=97), 0.002, 0.5)


GEN = {'explosion': explosion, 'debris': debris, 'drone': drone, 'missile': missile, 'siren': siren,
       'fire': fire, 'boom_far': boom_far, 'alarm': alarm, 'crumble': crumble}
TRIM = {'explosion': 5, 'debris': -2, 'drone': -2, 'missile': 1, 'siren': -4, 'fire': -6, 'boom_far': -2, 'alarm': -5, 'crumble': 0}
ROOM = {k: (0, 0) for k in GEN}
