"""Seamless ambience loops for Doc2D, synthesised from layered events (not filtered hiss).
get(kind) -> (2, LOOP*SR) float32, normalised to -23 LUFS, cached in runtime/audio/cache/.
CLI: python runtime/audio/ambience.py [kind ...] [--force]   (pre-builds the cache)"""
import os, sys
import numpy as np, soundfile as sf
from dsp import SR, colored, lpf, hpf, bpf, smooth, shape, tvec, dexp, pan, st, add, reverb, loopify, lufs, db

KINDS = ['room', 'city', 'port', 'wind', 'rain', 'crowd', 'office', 'factory', 'trading', 'market', 'sea', 'night', 'server']
ALIAS = {'street': 'city', 'harbor': 'port', 'harbour': 'port', 'hall': 'room', 'bazaar': 'market', 'ocean': 'sea', 'datacenter': 'server',
         'newsroom': 'office', 'exchange': 'trading', 'warehouse': 'factory', 'storm': 'rain', 'desert': 'wind', 'village': 'night'}
LOOP, XF, VER = 24.0, 2.0, 1
CACHE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'cache')
VOW = [(730, 1090, 2440), (270, 2290, 3010), (530, 1840, 2480), (300, 870, 2240), (570, 840, 2410),
       (440, 1020, 2240), (660, 1720, 2410), (490, 1350, 1690), (400, 1600, 2500)]


def babble(n, voices, r, energy=1.0, rt=1.2, wet=0.9, lp=4500):
    """Unintelligible crowd walla: formant-filtered glottal sources with syllable/phrase rhythm."""
    out = np.zeros((2, n)); dur = n / SR
    for _ in range(voices):
        fem = r.random() < 0.45; f0b = r.uniform(170, 240) if fem else r.uniform(92, 140); fs = 1.15 if fem else 1.0
        f0 = f0b * (1 + 0.07 * energy * smooth(n, 3, r)) * (1 + 0.02 * smooth(n, 12, r))
        src = 2 * ((np.cumsum(f0) / SR) % 1) - 1
        env = np.zeros(n); cen, vo, t = [], [], r.uniform(0, 2)
        fric = np.zeros(n)
        while t < dur:
            end = t + r.uniform(0.8, 3.2)
            while t < end and t < dur:
                d = r.uniform(0.12, 0.27) / (0.75 + 0.25 * energy); a = r.uniform(0.45, 1.0)
                i0, m = int(t * SR), int(d * SR); seg = np.sin(np.pi * np.linspace(0, 1, m)) ** 1.5 * a
                b = min(n, i0 + m); env[i0:b] += seg[:b - i0]; cen.append(t + d / 2); vo.append(VOW[r.integers(len(VOW))])
                if r.random() < 0.35:
                    fm = int(r.uniform(0.03, 0.08) * SR); fb = min(n, i0 + fm); fric[i0:fb] += (np.hanning(fm) * a)[:fb - i0]
                t += d * r.uniform(1.0, 1.25)
            t += r.uniform(0.3, 1.6) / energy
        if len(cen) < 2: continue
        cen = np.array(cen); vo = np.array(vo, float) * fs
        def M(f, tt, cen=cen, vo=vo):
            g = 0.02 + 0 * f * tt
            for k, (bw, amp) in enumerate([(90, 1.0), (130, 0.7), (200, 0.4)]):
                Fk = np.interp(tt, cen, vo[:, k]); g = g + amp * np.exp(-0.5 * ((f - Fk) / bw) ** 2)
            return g
        v = shape(src, M) * env + bpf(r.standard_normal(n), 3000, 8000) * fric * 0.05
        dist = r.uniform(0.25, 1.0); v = lpf(v, lp * (1.2 - 0.6 * dist)) * (1.1 - dist) ** 1.5
        out += pan(v, r.uniform(-0.9, 0.9))
    return reverb(out, rt, wet, seed=11)


def keystrokes(n, r, clusters_per_s=0.25, rate=(6, 9), dist=0.6):
    """Distant computer keyboards: clusters of keystrokes."""
    out = np.zeros((2, n)); t = r.uniform(0, 2)
    while t < n / SR:
        p = r.uniform(-0.8, 0.8); g = r.uniform(0.4, 1); end = t + r.uniform(0.6, 3.5)
        while t < end:
            m = int(0.03 * SR); k = tvec(m)
            ks = bpf(r.standard_normal(m), 1500, 6000) * dexp(m, 0.002) + np.sin(2 * np.pi * r.uniform(150, 260) * k) * dexp(m, 0.008) * 0.4
            add(out, pan(ks * g * r.uniform(0.5, 1), p), int(t * SR)); t += 1 / r.uniform(*rate)
        t += r.exponential(1 / clusters_per_s)
    return lpf(reverb(out, 0.6, 0.5, seed=3), 6000 * (1.2 - dist))


def clank(r, f0=None, tau=0.5):
    m = int(1.2 * SR); k = tvec(m); f0 = f0 or r.uniform(160, 420)
    x = sum(np.sin(2 * np.pi * f0 * q * k + r.uniform(0, 6)) * dexp(m, tau / (j + 1) ** 0.6) / (j + 1)
            for j, q in enumerate([1, 2.76, 5.40, 8.93]))
    return x + bpf(r.standard_normal(m), 600, 4000) * dexp(m, 0.004) * 0.6


def room(n, r):
    out = []
    for _ in range(2):
        x = lpf(colored(n, 2, r), 220) * 1.0 + lpf(colored(n, 1, r), 1400) * 0.10 + hpf(colored(n, 1, r), 2500) * 0.012
        out.append(x * (1 + 0.12 * smooth(n, 0.05, r)))
    t = tvec(n); hum = (np.sin(2 * np.pi * 60 * t) * 0.6 + np.sin(2 * np.pi * 120 * t + 1) * 0.4) * 0.012
    return np.vstack(out) + hum


def wind(n, r, amt=1.0):
    gust = np.clip(0.55 + 0.32 * smooth(n, 0.12, r) + 0.12 * smooth(n, 0.7, r), 0.08, 1.4)
    wf = 1100 * 2 ** (0.4 * smooth(n, 0.05, r)); tf = tvec(n)
    out = []
    for c in range(2):
        g = np.roll(gust, int(c * 0.18 * SR)); x = colored(n, 1.0, r)
        G = lambda tt: np.interp(tt, tf, g); W = lambda tt: np.interp(tt, tf, wf)
        def M(f, tt):
            Gt = G(tt); lf = np.log2(np.maximum(f, 20) / (180 + 700 * Gt ** 1.4))
            body = np.exp(-0.5 * (lf / 0.95) ** 2) * Gt ** 1.6
            low = 0.35 * np.exp(-0.5 * (np.log2(np.maximum(f, 20) / 80) / 1.1) ** 2) * Gt
            howl = 1.4 * np.exp(-0.5 * (np.log2(np.maximum(f, 20) / W(tt)) / 0.05) ** 2) * np.clip(Gt - 0.75, 0, None) ** 1.5
            return body + low + howl
        out.append(shape(x, M, 2048))
    return np.vstack(out) * amt


def rain(n, r):
    inten = 1 + 0.18 * smooth(n, 0.06, r); out = []
    for _ in range(2):
        bed = shape(r.standard_normal(n), lambda f, t: 1 / (1 + (900 / np.maximum(f, 1)) ** 2) / (1 + (f / 8000) ** 2), 2048) * 0.22
        drops = np.zeros(n)
        for fk in np.geomspace(1600, 6500, 10):
            m = int(0.02 * SR); k = tvec(m)
            ker = np.sin(2 * np.pi * np.cumsum(fk * (1 + 0.6 * k / 0.02)) / SR) * dexp(m, r.uniform(0.002, 0.005))
            imp = np.zeros(n); c = r.poisson(170 * n / SR); np.add.at(imp, r.integers(0, n, c), r.lognormal(-1, 0.8, c))
            drops += _fconv(imp, ker, n)
        out.append(bed + drops * 0.12)
    out = np.vstack(out) * inten
    for _ in range(int(5 * n / SR)):  # nearby drips on surfaces
        m = int(0.06 * SR); k = tvec(m); f = r.uniform(600, 1700)
        d = np.sin(2 * np.pi * np.cumsum(f * (1 + 0.4 * k / 0.06)) / SR) * dexp(m, 0.012) * r.uniform(0.05, 0.18)
        add(out, pan(d, r.uniform(-0.9, 0.9)), r.integers(0, n))
    out = lpf(out, 10000) + np.vstack([lpf(colored(n, 2, r), 180), lpf(colored(n, 2, r), 180)]) * 0.25
    return reverb(out, 0.9, 0.25, seed=5)


def _fconv(x, h, n):
    from scipy.signal import fftconvolve
    return fftconvolve(x, h)[:n]


def city(n, r):
    out = np.vstack([lpf(colored(n, 2, r), 260), lpf(colored(n, 2, r), 260)]) * (1 + 0.3 * smooth(n, 0.1, r)) * 0.8
    t = r.uniform(0, 1.5)
    while t < n / SR:
        w = r.uniform(1.6, 3.8); dist = r.uniform(0.2, 1.0); dr = r.choice([-1, 1]); m = int(4 * w * SR); k = tvec(m) - 2 * w
        tire = shape(colored(m, 0.8, r), lambda f, tt: np.exp(-0.5 * (np.log2(np.maximum(f, 30) / (500 * (1.3 - 0.6 * dist))) / 1.3) ** 2), 2048)
        fe = r.uniform(28, 48) * (1 - 0.035 * dr * np.tanh(k / (w / 3)))
        ph = np.cumsum(fe) / SR; eng = sum(np.sin(2 * np.pi * h * ph) / h for h in range(1, 7)) * 0.25
        env = np.exp(-(k / (w / 2)) ** 2) * (1.15 - dist) ** 2
        add(out, pan((tire + eng) * env, dr * np.tanh(k / (w / 2)) * 0.8), int((t - 2 * w) * SR))
        t += r.exponential(2.0)
    for _ in range(r.integers(1, 3)):  # far horn
        m = int(0.6 * SR); k = tvec(m); f = r.uniform(330, 420)
        h = sum(np.sin(2 * np.pi * f * q * k) / q for q in (1, 2, 3, 4)) + sum(np.sin(2 * np.pi * f * 1.26 * q * k) / q for q in (1, 2, 3))
        h *= np.minimum(1, k / 0.04) * np.minimum(1, (k[-1] - k) / 0.08) * r.uniform(0.02, 0.05)
        add(out, reverb(lpf(h, 1800), 1.6, 1.2, seed=9), r.integers(0, n - m))
    out += lpf(babble(n, 8, r, rt=1.6, wet=1.2), 1800) * 0.35 + np.vstack([hpf(colored(n, 1, r), 2000)] * 2) * 0.03
    return reverb(out, 1.4, 0.35, seed=13)


def port(n, r):
    out = np.vstack([lpf(colored(n, 2, r), 380), lpf(colored(n, 2, r), 380)]) * 0.35
    t = r.uniform(0, 1)
    while t < n / SR:  # waves lapping on a hull/quay
        m = int(r.uniform(2.2, 3.4) * SR); k = tvec(m)
        env = (1 - np.exp(-k / 0.45)) * np.exp(-k / 0.9); env /= env.max()
        lap = bpf(colored(m, 1, r), 140, 900) * env + bpf(colored(m, 0.5, r), 500, 2600) * env ** 3 * 0.45
        add(out, pan(lap * r.uniform(0.5, 1), r.uniform(-0.7, 0.7)), int(t * SR)); t += r.uniform(1.2, 3.5)
    out += wind(n, r, 0.25)
    for _ in range(r.integers(2, 5)):
        add(out, reverb(pan(lpf(clank(r, tau=0.8), 2500), r.uniform(-1, 1)), 2.5, 1.5, seed=17) * r.uniform(0.04, 0.09), r.integers(0, n))
    m = int(5 * SR); k = tvec(m); f = r.uniform(68, 82) * (1 + 0.004 * np.sin(2 * np.pi * 4.5 * k))  # ship horn far off
    hn = sum(np.sin(2 * np.pi * h * np.cumsum(f) / SR) / h ** 0.8 for h in range(1, 14))
    hn *= np.minimum(1, k / 0.5) * np.clip((3.2 - k) / 1.2, 0, 1) * 0.06
    add(out, reverb(lpf(hn, 700), 4.0, 2.5, seed=19), int(r.uniform(2, LOOP - 6) * SR))
    return out


def crowd(n, r):
    out = babble(n, 30, r, energy=1.0, rt=1.3, wet=0.8)
    return out + np.vstack([lpf(colored(n, 2, r), 200)] * 2) * 0.05 + np.vstack([hpf(colored(n, 1, r), 3000)] * 2) * 0.004


def office(n, r):
    out = room(n, r) * 0.6 + np.vstack([bpf(colored(n, 1, r), 180, 1600), bpf(colored(n, 1, r), 180, 1600)]) * 0.1
    out += keystrokes(n, r, 0.3) * 0.35 + lpf(babble(n, 6, r, energy=0.8, rt=0.9, wet=1.0), 2200) * 0.5
    for _ in range(r.integers(3, 7)):  # mouse clicks
        m = int(0.02 * SR); add(out, pan(bpf(r.standard_normal(m), 2000, 7000) * dexp(m, 0.001) * 0.05, r.uniform(-.8, .8)), r.integers(0, n))
    return out


def factory(n, r):
    t = tvec(n); f0 = 49.7 * (1 + 0.002 * smooth(n, 0.2, r))
    ph = np.cumsum(f0) / SR; hum = sum(np.sin(2 * np.pi * h * ph + h) * a for h, a in [(1, 1), (2, .6), (3, .45), (4, .3), (6, .2), (8, .12)])
    hum = hum * (1 + 0.15 * np.sin(2 * np.pi * 0.31 * t)) * 0.08 + np.sin(2 * np.pi * 742 * t + 3 * smooth(n, 0.3, r)) * 0.0008
    out = np.vstack([lpf(colored(n, 2, r), 200), lpf(colored(n, 2, r), 200)]) * 0.5 + pan(hum, 0.2)
    T = r.uniform(1.7, 2.1); tt = r.uniform(0, T); pp = r.uniform(-0.6, 0.6)
    while tt < n / SR:  # rhythmic press
        m = int(0.6 * SR); k = tvec(m)
        hit = np.sin(2 * np.pi * np.cumsum(70 - 25 * k / 0.6) / SR) * dexp(m, 0.12, 0.002) + lpf(r.standard_normal(m), 700) * dexp(m, 0.03) * 0.8
        hit += lpf(clank(r, r.uniform(180, 260), 0.3)[:m], 2000) * 0.15
        add(out, pan(hit * r.uniform(0.25, 0.35), pp), int(tt * SR)); tt += T * r.uniform(0.97, 1.03)
    m = int(0.025 * SR); rat = np.zeros(n); tt = 0.0  # conveyor rattle
    while tt < n / SR: add_m1(rat, bpf(r.standard_normal(m), 1000, 3200) * dexp(m, 0.003) * r.uniform(0.3, 1), int(tt * SR)); tt += 1 / 17 * r.uniform(0.8, 1.2)
    out += pan(rat * 0.05 * (1 + 0.4 * smooth(n, 0.2, r)), -0.5)
    for _ in range(int(n / SR / 6)):  # pneumatic hiss
        m = int(r.uniform(0.5, 1.1) * SR); k = tvec(m)
        add(out, pan(bpf(r.standard_normal(m), 1500, 8000) * np.clip(np.sin(np.pi * k / k[-1]), 0, None) ** 0.5 * 0.05, r.uniform(-1, 1)), r.integers(0, n))
    for _ in range(r.integers(3, 6)):
        add(out, pan(lpf(clank(r), 3000), r.uniform(-1, 1)) * r.uniform(0.03, 0.07), r.integers(0, n))
    return reverb(out, 2.4, 0.7, seed=23)


def add_m1(buf, ev, i):
    b = min(len(buf), i + len(ev))
    if i < len(buf): buf[i:b] += ev[:b - i]


def trading(n, r):
    out = babble(n, 42, r, energy=1.6, rt=1.4, wet=0.8, lp=5500)
    for _ in range(r.integers(3, 6)):  # a raised voice cuts through now and then
        m = int(r.uniform(0.8, 1.6) * SR); add(out, babble(m, 1, r, energy=2.2, rt=1.4, wet=0.6) * 2.0, r.integers(0, n - m))
    out += keystrokes(n, r, 0.6, (8, 11), 0.4) * 0.4
    for _ in range(r.integers(1, 3)):  # distant desk phone trill
        m = int(1.4 * SR); k = tvec(m); f = np.where((k * 22).astype(int) % 2, 1180, 1460)
        ph = np.sin(2 * np.pi * np.cumsum(f) / SR) * ((k % 0.7) < 0.45) * 0.03
        add(out, reverb(lpf(ph, 2500), 1.2, 1.4, seed=29), r.integers(0, n - m))
    return out + room(n, r) * 0.3


def market(n, r):
    """Open-air market / bazaar: busy close walla, vendor calls, crockery and cart clatter, a scooter now and then."""
    out = babble(n, 26, r, energy=1.4, rt=0.7, wet=0.4, lp=6000)
    for _ in range(r.integers(5, 9)):  # a vendor calling out, closer and drier
        m = int(r.uniform(0.7, 1.4) * SR); add(out, babble(m, 1, r, energy=2.4, rt=0.6, wet=0.3) * 2.2, r.integers(0, n - m))
    for _ in range(int(n / SR * 1.2)):  # crockery / produce / coins clinks
        m = int(0.25 * SR); k = tvec(m); f0 = r.uniform(900, 2600)
        c = sum(np.sin(2 * np.pi * f0 * q * k) * dexp(m, 0.05 / q) / q for q in (1, 2.7, 4.2)) + bpf(r.standard_normal(m), 2000, 7000) * dexp(m, 0.002)
        add(out, pan(c * r.uniform(0.01, 0.04), r.uniform(-1, 1)), r.integers(0, n))
    t = r.uniform(2, 8)
    while t < n / SR - 3:  # cart wheels rattling past
        m = int(2.5 * SR); k = tvec(m); imp = np.zeros(m); i = 0
        while i < m: imp[i] = r.uniform(0.3, 1); i += int(SR / r.uniform(9, 14))
        rat = _fconv(imp, bpf(r.standard_normal(600), 300, 2500) * dexp(600, 0.003), m) * np.sin(np.pi * k / k[-1]) ** 2
        add(out, pan(rat * 0.05, np.linspace(-0.8, 0.8, m) * r.choice([-1, 1])), int(t * SR)); t += r.uniform(6, 12)
    out += city(n, r) * 0.25
    return out


def sea(n, r):
    """Open sea from a ship's deck: deep swell wash, hull hiss, steady wind, a far engine drone."""
    sw = 0.6 + 0.4 * np.sin(2 * np.pi * np.cumsum(0.11 + 0.02 * smooth(n, 0.05, r)) / SR) + 0.15 * smooth(n, 0.2, r)
    wash = np.vstack([shape(colored(n, 1.2, r), lambda f, t: np.exp(-0.5 * (np.log2(np.maximum(f, 20) / 350) / 1.4) ** 2), 2048) for _ in range(2)])
    hiss = np.vstack([bpf(colored(n, 0.5, r), 1500, 7000) for _ in range(2)]) * 0.12
    out = wash * np.clip(sw, 0.1, None) ** 1.5 + hiss * np.clip(sw, 0.1, None) ** 3
    t = tvec(n); ph = np.cumsum(9.5 * (1 + 0.003 * smooth(n, 0.3, r))) / SR
    drone = sum(np.sin(2 * np.pi * h * ph) / h for h in range(4, 16)) * 0.03
    return out + wind(n, r, 0.5) + pan(lpf(drone, 300), 0)


def night(n, r):
    """Night exterior: cricket chorus, a tree frog or two, faint wind, one distant dog."""
    out = np.zeros((2, n)); t = tvec(n)
    for _ in range(14):  # crickets: pulsed 4-5 kHz chirps, each insect its own rhythm
        f = r.uniform(3900, 5200); rate = r.uniform(1.2, 3.0); pul = r.integers(2, 5); g = r.uniform(0.2, 1) ** 2
        gate = ((t * rate + r.random()) % 1) < pul * 0.035
        pulses = (np.sin(2 * np.pi * 30 * t) > 0) & gate
        c = np.sin(2 * np.pi * f * t) * lpf(pulses.astype(float), 400) * g
        out += pan(c, r.uniform(-1, 1))
    for _ in range(2):  # frogs
        f = r.uniform(900, 1400); rate = r.uniform(0.6, 1.1); gate = ((t * rate + r.random()) % 1) < 0.08
        out += pan(np.sin(2 * np.pi * f * t) * (np.sin(2 * np.pi * 60 * t) > 0) * lpf(gate.astype(float), 200) * 0.3, r.uniform(-1, 1))
    out = reverb(out * 0.15, 1.2, 0.6, seed=61)
    m = int(1.2 * SR); k = tvec(m); bark = np.zeros(m)
    for j in range(2):
        s = int(j * 0.45 * SR); bl = int(0.16 * SR); kb = tvec(bl); f = 520 * (1 - 0.3 * kb / 0.16)
        bark[s:s + bl] += sum(np.sin(2 * np.pi * h * np.cumsum(f) / SR) / h for h in range(1, 8)) * np.sin(np.pi * kb / kb[-1])
    add(out, reverb(lpf(bark, 1500) * 0.02, 2.5, 2.0, seed=67), r.integers(0, n - m))
    return out + wind(n, r, 0.12) + room(n, r) * 0.15


def server(n, r):
    """Server hall: wall of fans (blade-pass tones + airflow), CRAC hum, relay/drive ticks."""
    t = tvec(n); out = np.vstack([shape(colored(n, 0.6, r), lambda f, tt: 1 / (1 + (f / 2500) ** 2) / (1 + (120 / np.maximum(f, 1)) ** 2), 2048) for _ in range(2)]) * 0.5
    for _ in range(10):  # fan banks: blade-pass tone with slight drift and beating
        f = r.uniform(180, 420) * (1 + 0.002 * smooth(n, 0.1, r)); ph = np.cumsum(f) / SR
        fan = sum(np.sin(2 * np.pi * h * ph + r.uniform(0, 6)) / h ** 1.5 for h in (1, 2, 3)) * (1 + 0.2 * smooth(n, 0.5, r))
        out += pan(fan * r.uniform(0.004, 0.012), r.uniform(-1, 1))
    out += pan((np.sin(2 * np.pi * 50 * t) + 0.5 * np.sin(2 * np.pi * 100 * t)) * 0.02, 0)
    for _ in range(int(n / SR * 2)):
        m = int(0.01 * SR); add(out, pan(bpf(r.standard_normal(m), 2000, 8000) * dexp(m, 0.0008) * r.uniform(0.005, 0.02), r.uniform(-1, 1)), r.integers(0, n))
    return reverb(out, 0.8, 0.4, seed=71)


GEN = {k: globals()[k] for k in KINDS}
import amb_extra  # noqa: E402  (cleanroom, airport)
GEN.update(amb_extra.EXTRA); KINDS += list(amb_extra.EXTRA); ALIAS.update(amb_extra.ALIAS)
import amb_industry  # noqa: E402  (mine, separation, magnet, assembly, harbour)
GEN.update(amb_industry.EXTRA); KINDS += list(amb_industry.EXTRA); ALIAS.update(amb_industry.ALIAS)


def build(kind, seed=None):
    r = np.random.default_rng(seed if seed is not None else 1000 + KINDS.index(kind))
    n = int((LOOP + XF) * SR); y = st(GEN[kind](n, r))
    y = hpf(y, 35); y = loopify(y, int(LOOP * SR), int(XF * SR)); assert np.isfinite(y).all(), kind
    return (y * db(-23 - lufs(y))).astype(np.float32)


def get(kind, force=False):
    kind = ALIAS.get(kind, kind)
    os.makedirs(CACHE, exist_ok=True); p = os.path.join(CACHE, f'amb_{kind}_v{VER}.wav')
    if os.path.exists(p) and not force: return sf.read(p, dtype='float32')[0].T
    y = build(kind); sf.write(p, y.T, SR, subtype='FLOAT'); return y


if __name__ == '__main__':
    import time
    ks = [a for a in sys.argv[1:] if not a.startswith('--')] or KINDS
    for k in ks:
        t0 = time.time(); y = get(k, '--force' in sys.argv)
        print(f'{k:8s} {lufs(y):6.1f} LUFS  peak {20 * np.log10(np.abs(y).max()):5.1f} dBFS  {time.time() - t0:5.1f}s')
