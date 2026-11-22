"""Industry / harbour ambience beds for the rare-earths long-form (registered into ambience.GEN by ambience.py):
mine, separation, magnet, assembly, harbour."""
import numpy as np
from dsp import SR, colored, lpf, hpf, bpf, smooth, tvec, dexp, pan, add, reverb


def _veh(r, **o):
    import vehicles
    x = vehicles.engine(r, **o); return x if x.ndim == 2 else pan(x, 0)


def mine(n, r):
    """Open-pit mine: wind across the pit, haul trucks grinding up the ramps, bucket clanks, reversing beeps,
    and one distant blast per loop (low rumble, no crack)."""
    import ambience
    out = ambience.wind(n, r, 0.6); t = r.uniform(0, 3)
    while t < n / SR - 6:
        x = _veh(r, dur=r.uniform(6, 9), veh='truck', motion=str(r.choice(['pass', 'arrive', 'depart'])), dir=int(r.choice([-1, 1])))
        add(out, lpf(x, 2500) * r.uniform(0.25, 0.5), int(t * SR)); t += r.uniform(5, 9)
    for _ in range(int(r.integers(3, 6))):
        m = int(0.8 * SR); k = tvec(m); f0 = r.uniform(140, 260)
        c = sum(np.sin(2 * np.pi * f0 * q * k) * dexp(m, 0.25 / q) / q for q in (1, 2.7, 5.1)) + lpf(r.standard_normal(m), 600) * dexp(m, 0.02)
        add(out, reverb(pan(c * 0.05, r.uniform(-1, 1)), 2.0, 1.2, seed=131), int(r.integers(0, n - m)))
    for _ in range(2):
        m = int(2.4 * SR); k = tvec(m); bp = np.sin(2 * np.pi * 1100 * k) * ((k % 0.9) < 0.4) * 0.006
        add(out, reverb(pan(lpf(bp, 2500), r.uniform(-1, 1)), 1.8, 1.2, seed=133), int(r.integers(0, n - m)))
    m = int(5 * SR); k = tvec(m)
    bl = lpf(colored(m, 2, r), 180) * (1 - np.exp(-k / 0.1)) * np.exp(-k / 1.3) + bpf(colored(m, 1.5, r), 90, 400) * np.exp(-k / 1.0) * 0.4
    add(out, reverb(pan(bl * 0.35, r.uniform(-0.5, 0.5)), 4.0, 1.0, seed=135, bright=600), int(r.uniform(3, n / SR - 6) * SR))
    return out


def separation(n, r):
    """Solvent-extraction / separation hall: pump drones with a slow pulse, bubbling mixer-settler tanks, pipe flow,
    electrical hum, valve hiss, drips; big reflective hall."""
    t = tvec(n); out = np.zeros((2, n))
    for i in range(3):
        f = r.uniform(24, 30); ph = np.cumsum(f * (1 + 0.003 * smooth(n, 0.2, r))) / SR
        hum = sum(np.sin(2 * np.pi * q * ph * 2 + q) * a for q, a in [(1, 1), (2, .5), (3, .3), (5, .15)])
        pulse = 1 + 0.25 * np.sin(2 * np.pi * r.uniform(1.2, 2.0) * t + i)
        out += pan(hum * pulse * 0.03 + bpf(colored(n, 1, r), 150, 1200) * pulse * 0.05, r.uniform(-0.8, 0.8))
    bub = np.zeros(n)
    for _ in range(int(n / SR * 40)):
        m = int(0.03 * SR); k = tvec(m); f0 = r.uniform(250, 900)
        i = int(r.integers(0, n - m)); bub[i:i + m] += np.sin(2 * np.pi * np.cumsum(f0 * (1 + 1.5 * k / 0.03)) / SR) * dexp(m, 0.008) * r.uniform(0.2, 1)
    out += pan(lpf(bub, 3000) * 0.05, -0.3) + pan(bpf(colored(n, 0.8, r), 400, 2500) * 0.04 * (1 + 0.3 * smooth(n, 0.5, r)), 0.4)
    out += pan(np.sin(2 * np.pi * 100 * t) * 0.006 + np.sin(2 * np.pi * 50 * t) * 0.004, 0)
    for _ in range(int(r.integers(2, 4))):
        m = int(r.uniform(0.6, 1.4) * SR); k = tvec(m)
        add(out, pan(bpf(r.standard_normal(m), 2000, 8000) * np.sin(np.pi * k / k[-1]) * 0.02, r.uniform(-1, 1)), int(r.integers(0, n - m)))
    for _ in range(int(n / SR * 0.8)):
        m = int(0.08 * SR); k = tvec(m)
        add(out, pan(np.sin(2 * np.pi * np.cumsum(r.uniform(800, 1600) * (1 + 0.5 * k / 0.08)) / SR) * dexp(m, 0.015) * 0.02, r.uniform(-1, 1)), int(r.integers(0, n - m)))
    return reverb(out, 2.2, 0.6, seed=137)


def magnet(n, r):
    """Magnet factory: heavy hydraulic presses thunking in a slow rhythm with an exhaust hiss on each return,
    sintering-furnace roar, hydraulic pump whine."""
    import ambience
    out = ambience.factory(n, r) * 0.25 + np.vstack([lpf(colored(n, 2, r), 250)] * 2) * 0.35 * (1 + 0.1 * smooth(n, 0.1, r))
    T = r.uniform(2.6, 3.4); tt = r.uniform(0, T); pp = r.uniform(-0.5, 0.5)
    while tt < n / SR:
        m = int(1.2 * SR); k = tvec(m)
        hit = np.sin(2 * np.pi * np.cumsum(58 - 18 * k / 1.2) / SR) * dexp(m, 0.18, 0.003) + lpf(r.standard_normal(m), 500) * dexp(m, 0.05) * 0.9
        hit += bpf(r.standard_normal(m), 600, 2500) * dexp(m, 0.006) * 0.25
        hl = int(0.45 * SR); i0 = int(0.55 * SR); hk = tvec(hl)
        hit[i0:i0 + hl] += bpf(r.standard_normal(hl), 1500, 7000) * np.sin(np.pi * hk / hk[-1]) * 0.12
        add(out, pan(hit * 0.35, pp), int(tt * SR)); tt += T * r.uniform(0.97, 1.03)
    out += pan(np.sin(2 * np.pi * np.cumsum(r.uniform(380, 460) * (1 + 0.004 * smooth(n, 0.4, r))) / SR) * 0.004, -0.4)
    return reverb(out, 2.0, 0.5, seed=139)


def assembly(n, r):
    """Car assembly line: welding robots (servo glides + spot-weld zaps), pneumatic nut-runners, conveyor,
    a fixture clunk as each body indexes forward."""
    import ambience
    out = ambience.factory(n, r) * 0.2; t = r.uniform(0, 1)
    while t < n / SR - 2:
        m = int(2.2 * SR); k = tvec(m); u = k / k[-1]; f = 600 + 900 * np.sin(np.pi * np.clip(u * 1.6, 0, 1)) ** 2
        servo = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * u) ** 2 * 0.03 + bpf(r.standard_normal(m), 800, 3000) * np.sin(np.pi * u) ** 2 * 0.02
        for j in range(int(r.integers(2, 5))):
            i = int((0.6 + 0.25 * j) * SR); w = int(0.12 * SR)
            if i + w < m: servo[i:i + w] += bpf(r.standard_normal(w), 1500, 9000) * dexp(w, 0.04) * 0.12
        add(out, pan(servo, r.uniform(-0.9, 0.9)), int(t * SR)); t += r.uniform(1.2, 2.5)
    for _ in range(int(n / SR * 0.5)):
        m = int(r.uniform(0.4, 0.9) * SR); k = tvec(m)
        nr = (bpf(r.standard_normal(m), 1000, 6000) * 0.5 + np.sin(2 * np.pi * r.uniform(1800, 2600) * k) * 0.3) * np.sin(np.pi * k / k[-1]) ** 0.5 * 0.05
        add(out, pan(nr, r.uniform(-1, 1)), int(r.integers(0, n - m)))
    T = r.uniform(6, 9); tt = r.uniform(1, T)
    while tt < n / SR:
        m = int(0.5 * SR); add(out, pan(lpf(r.standard_normal(m), 400) * dexp(m, 0.05) * 0.2, 0.2), int(tt * SR)); tt += T
    return reverb(out, 1.8, 0.5, seed=141)


def harbour(n, r):
    """Small fishing harbour: water lapping on hulls, small boat engines puttering past, gulls, rope and fender creaks,
    a little distant talk on the quay."""
    import ambience, creatures
    out = ambience.port(n, r) * 0.5; t = r.uniform(1, 4)
    while t < n / SR - 6:
        m = int(r.uniform(6, 9) * SR); k = tvec(m); u = k / k[-1]
        ph = np.cumsum(r.uniform(9, 14) * (1 + 0.04 * np.sin(np.pi * u))) / SR; frac = ph % 1
        put = lpf(np.exp(-frac / 0.08) - 0.12, 900) + 0.2 * bpf(r.standard_normal(m), 300, 1500)
        add(out, pan(put * np.sin(np.pi * u) ** 2 * 0.08, np.linspace(-0.8, 0.8, m) * r.choice([-1, 1])), int(t * SR)); t += r.uniform(8, 14)
    for _ in range(int(r.integers(2, 4))):
        g = creatures.gull(r, dur=r.uniform(1.5, 3)); g = g if g.ndim == 2 else pan(g, r.uniform(-1, 1))
        add(out, reverb(lpf(g, 5000), 1.5, 0.8, seed=143) * 0.15 / (np.abs(g).max() + 1e-9), int(r.integers(0, n - g.shape[-1])))
    for _ in range(int(r.integers(3, 6))):
        c = creatures.rope(r, dur=r.uniform(0.8, 1.6)); c = c if c.ndim == 2 else pan(c, r.uniform(-1, 1))
        add(out, c * 0.06 / (np.abs(c).max() + 1e-9), int(r.integers(0, n - c.shape[-1])))
    return out + lpf(ambience.babble(n, 5, r, energy=0.9, rt=1.5, wet=1.2), 2000) * 0.2


EXTRA = {'mine': mine, 'separation': separation, 'magnet': magnet, 'assembly': assembly, 'harbour': harbour}
ALIAS = {'quarry': 'mine', 'pit': 'mine', 'chemical': 'separation', 'refining': 'separation', 'smelter': 'separation',
         'sintering': 'magnet', 'carplant': 'assembly', 'fishing': 'harbour', 'marina': 'harbour', 'harbor_fishing': 'harbour'}
