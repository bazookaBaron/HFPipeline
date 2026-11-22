"""Industrial one-shots (sfx.py merges GEN/TRIM/ROOM): line_stop {dur}, klaxon {dur}, mine_blast."""
import numpy as np
from dsp import SR, colored, lpf, hpf, bpf, smooth, tvec, dexp, pan, reverb
from events import _edge


def klaxon(r, dur=None, **p):
    """Factory line alarm horn: a buzzy two-tone klaxon pulsing on/off, in a big hall."""
    d = dur or 3.0; n = int((d + 1.2) * SR); t = tvec(n); f0 = r.uniform(380, 440)
    ph = np.cumsum(f0 * (1 + 0.01 * np.sin(2 * np.pi * 6 * t))) / SR
    tone = sum(np.sign(np.sin(2 * np.pi * q * ph)) / q for q in (1, 1.5)) * 0.5   # reedy, square-ish
    gate = lpf(((t % 1.0) < 0.6).astype(float) * (t < d), 30)
    return _edge(reverb(pan(lpf(tone * gate, 3000) * 0.6, r.uniform(-0.4, 0.4)), 2.0, 0.8, seed=151, bright=2500), 0.01, 0.6)


def line_stop(r, dur=None, **p):
    """The line halts: e-stop clunk, motors and conveyors winding down in pitch and level, servo whines falling,
    a last chain clank, then the klaxon pulses over the stilled hall."""
    d = dur or 5.0; n = int((d + 1.5) * SR); t = tvec(n); out = np.zeros((2, n)); tw = min(2.5, d * 0.5)
    m = int(0.2 * SR); k = tvec(m)
    out[:, :m] += pan(lpf(r.standard_normal(m), 350) * dexp(m, 0.03) * 1.3 + bpf(r.standard_normal(m), 1500, 6000) * dexp(m, 0.002) * 0.4, 0)
    spin = np.clip(1 - t / tw, 0, 1) ** 1.5
    for _ in range(3):  # motors: harmonic hum falling in pitch
        f = r.uniform(40, 60) * (0.35 + 0.65 * spin); ph = np.cumsum(f) / SR
        out += pan(sum(np.sin(2 * np.pi * q * ph) / q for q in (1, 2, 3, 4)) * spin * 0.12, r.uniform(-0.8, 0.8))
    f = r.uniform(900, 1300) * (0.3 + 0.7 * spin)  # servo whine falling
    out += pan(np.sin(2 * np.pi * np.cumsum(f) / SR) * spin ** 2 * 0.04, 0.3)
    rate = 14 * spin; ph = np.cumsum(rate) / SR; ticks = (np.diff(np.floor(ph), prepend=0) > 0).astype(float)
    out += pan(np.convolve(ticks, bpf(r.standard_normal(600), 800, 3000) * dexp(600, 0.003))[:n] * spin * 0.3, -0.5)  # conveyor slowing
    c = int((tw + 0.1) * SR); cm = int(0.6 * SR); ck = tvec(cm)
    out[:, c:c + cm] += pan(sum(np.sin(2 * np.pi * 180 * q * ck) * dexp(cm, 0.2 / q) / q for q in (1, 2.7, 5.1)) * 0.25, 0)[:, :max(0, n - c)]
    kl = klaxon(r, d - tw - 0.4); i = int((tw + 0.4) * SR); b = min(n, i + kl.shape[1]); out[:, i:b] += kl[:, :b - i] * 0.5
    return _edge(reverb(out, 1.8, 0.5, seed=153), 0.002, 0.5)


def mine_blast(r, dur=None, **p):
    """Open-pit production blast seen from the rim: a muffled thud, ground rumble, and rock slumping down the bench."""
    n = int(6.0 * SR); t = tvec(n)
    thud = np.sin(2 * np.pi * np.cumsum(40 + 25 * np.exp(-t / 0.1)) / SR) * dexp(n, 0.5, 0.01) + lpf(colored(n, 2, r), 250) * dexp(n, 0.8, 0.02) * 1.2
    slump = bpf(colored(n, 1, r), 150, 2500) * np.exp(-((t - 1.6) / 0.9) ** 2) * 0.5
    rocks = np.zeros(n); k = 0.6
    while k < 3.5:
        m = int(0.15 * SR); i = int(k * SR); rocks[i:i + m] += bpf(r.standard_normal(m), 300, 2500) * dexp(m, 0.02) * r.uniform(0.1, 0.4)
        k += r.exponential(0.12)
    return _edge(reverb(pan(thud + slump + rocks, r.uniform(-0.3, 0.3)), 3.5, 0.9, seed=155, bright=1200), 0.005, 0.8)


GEN = {'klaxon': klaxon, 'line_stop': line_stop, 'mine_blast': mine_blast}
TRIM = {'klaxon': -4, 'line_stop': 0, 'mine_blast': 2}
ROOM = {k: (0, 0) for k in GEN}
