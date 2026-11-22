"""Extra ambience beds (registered into ambience.GEN by ambience.py): cleanroom, airport."""
import numpy as np
from dsp import SR, colored, lpf, hpf, bpf, shape, smooth, tvec, dexp, pan, add, reverb


def cleanroom(n, r):
    """Semiconductor fab cleanroom: laminar-flow ceiling (fan filter units) as a smooth air wash, fan blade tones,
    air-handler rumble, an overhead wafer-transport carrier gliding by now and then, rare soft tool chimes."""
    air = np.vstack([shape(colored(n, 0.7, r), lambda f, t: 1 / (1 + (f / 3500) ** 2) / (1 + (150 / np.maximum(f, 1)) ** 2), 2048) for _ in range(2)])
    out = air * (1 + 0.04 * smooth(n, 0.1, r))
    for _ in range(8):  # fan filter units: steady blade-pass tones, slightly detuned
        f = r.uniform(230, 380) * (1 + 0.001 * smooth(n, 0.05, r)); ph = np.cumsum(f) / SR
        out += pan((np.sin(2 * np.pi * ph) + 0.4 * np.sin(4 * np.pi * ph)) * r.uniform(0.003, 0.008), r.uniform(-1, 1))
    out += np.vstack([lpf(colored(n, 2, r), 110)] * 2) * 0.5  # air handlers below the floor
    t = r.uniform(2, 6)
    while t < n / SR - 4:  # overhead hoist transport: servo whine glide + track hum passing across
        m = int(3.2 * SR); k = tvec(m); u = k / k[-1]; f = 700 + 500 * np.sin(np.pi * u)
        car = (np.sin(2 * np.pi * np.cumsum(f) / SR) * 0.15 + bpf(r.standard_normal(m), 300, 2000) * 0.3) * np.sin(np.pi * u) ** 2
        add(out, pan(car * 0.04, np.linspace(-0.9, 0.9, m) * r.choice([-1, 1])), int(t * SR)); t += r.uniform(7, 12)
    for _ in range(r.integers(1, 3)):  # a tool's soft status chime, far off
        m = int(0.8 * SR); k = tvec(m)
        ch = sum(np.sin(2 * np.pi * f * k) * dexp(m, 0.25) for f in (1318.5, 1760.0)) * 0.006
        add(out, reverb(pan(ch, r.uniform(-1, 1)), 1.2, 0.8, seed=121), r.integers(0, n - m))
    return reverb(out, 0.6, 0.25, seed=123)


def airport(n, r):
    """Airport apron: idling jets (roar + turbine whine), an APU drone, a taxiing jet passing, tugs and reversing beeps, wind."""
    t = tvec(n)
    roar = np.vstack([shape(colored(n, 1.0, r), lambda f, tt: np.exp(-0.5 * (np.log2(np.maximum(f, 30) / 350) / 1.6) ** 2), 2048) for _ in range(2)])
    out = roar * 0.5 * (1 + 0.1 * smooth(n, 0.1, r))
    for f0 in (r.uniform(3000, 3800), r.uniform(4300, 5200)):  # turbine whines, far
        out += pan(np.sin(2 * np.pi * np.cumsum(f0 * (1 + 0.002 * smooth(n, 0.2, r))) / SR) * 0.004, r.uniform(-0.8, 0.8))
    out += pan(np.sin(2 * np.pi * 400 * t) * 0.003 + bpf(colored(n, 1, r), 200, 900) * 0.08, -0.5)  # APU
    m = int(10 * SR); k = tvec(m); u = k / k[-1]; env = np.exp(-((u - 0.5) / 0.25) ** 2)  # a jet taxiing past
    taxi = shape(colored(m, 0.8, r), lambda f, tt: np.exp(-0.5 * (np.log2(np.maximum(f, 30) / (600 * (1.15 - 0.3 * np.tanh((tt / 10 - 0.5) * 6)))) / 1.4) ** 2), 2048)
    taxi += np.sin(2 * np.pi * np.cumsum(3500 * (1.03 - 0.06 * np.tanh((u - 0.5) * 6))) / SR) * 0.02
    add(out, pan(taxi * env * 0.9, np.tanh((u - 0.5) * 4) * 0.9), int(r.uniform(4, 10) * SR))
    for _ in range(r.integers(2, 4)):  # ground vehicle reversing beeps, distant
        m = int(2.4 * SR); k = tvec(m); bp = np.sin(2 * np.pi * 1050 * k) * ((k % 0.8) < 0.35) * 0.006
        add(out, reverb(pan(lpf(bp, 3000), r.uniform(-1, 1)), 1.5, 1.0, seed=125), r.integers(0, n - m))
    import ambience
    return reverb(out, 1.6, 0.4, seed=127) + ambience.wind(n, r, 0.3)


EXTRA = {'cleanroom': cleanroom, 'airport': airport}
ALIAS = {'fab': 'cleanroom', 'lab': 'cleanroom', 'apron': 'airport', 'airfield': 'airport', 'runway': 'airport', 'terminal': 'airport'}
