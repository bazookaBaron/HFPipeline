"""Shared DSP helpers for the Doc2D audio layer (48 kHz, numpy/scipy only)."""
import numpy as np
from scipy.signal import butter, sosfilt, stft, istft, fftconvolve, lfilter
from scipy.interpolate import CubicSpline

SR = 48000


def colored(n, alpha, r):
    """Unit-variance noise with a 1/f^alpha power spectrum (0 white, 1 pink, 2 brown)."""
    X = np.fft.rfft(r.standard_normal(n)); f = np.fft.rfftfreq(n, 1 / SR); f[0] = f[1]
    y = np.fft.irfft(X * f ** (-alpha / 2), n); return y / (np.std(y) + 1e-12)


def _sos(kind, f, order):
    f = np.clip(f, 10, SR / 2 - 100); return butter(order, f, kind, fs=SR, output='sos')
def lpf(x, f, order=2): return sosfilt(_sos('low', f, order), x, axis=-1)
def hpf(x, f, order=2): return sosfilt(_sos('high', f, order), x, axis=-1)
def bpf(x, lo, hi, order=2): return sosfilt(_sos('band', [lo, hi], order), x, axis=-1)


def smooth(n, rate, r):
    """Smooth random control signal (~unit std) whose features change at about `rate` Hz."""
    k = max(4, int(n / SR * rate) + 4); pts = r.standard_normal(k)
    return CubicSpline(np.arange(k), pts)(np.linspace(1, k - 2, n))


def shape(x, M, nper=1024):
    """Time-varying spectral shaping. M(f[:,None], t[None,:]) -> gain matrix (bins x frames)."""
    f, t, Z = stft(x, SR, nperseg=nper)
    _, y = istft(Z * M(f[:, None], t[None, :]), SR, nperseg=nper)
    y = y[:len(x)]; return np.pad(y, (0, len(x) - len(y)))


def tvec(n): return np.arange(n) / SR


def dexp(n, tau, at=0.0005):
    """Fast-attack exponential decay envelope."""
    t = tvec(n); return np.minimum(1, t / max(at, 1e-6)) * np.exp(-t / tau)


def pan(x, p):
    """Equal-power pan of a mono signal; p in [-1,1] scalar or per-sample array -> (2,n)."""
    a = (np.clip(p, -1, 1) + 1) * np.pi / 4; return np.vstack([x * np.cos(a), x * np.sin(a)])


def st(x): return x if x.ndim == 2 else np.vstack([x, x])


def add(buf, ev, i):
    """Mix stereo/mono event into stereo buffer at sample i (clipped to buffer)."""
    ev = st(ev); n = buf.shape[1]
    if i >= n or i + ev.shape[1] <= 0: return
    a = max(0, i); b = min(n, i + ev.shape[1]); buf[:, a:b] += ev[:, a - i:b - i]


def impulse_response(rt, seed=0, bright=4000, pre=0.008):
    """Stereo, decorrelated, frequency-dependent decaying noise IR (highs die first)."""
    r = np.random.default_rng(seed); L = int((rt * 1.1 + pre) * SR); out = []
    for _ in range(2):
        x = r.standard_normal(L)
        y = shape(x, lambda f, t: np.exp(-6.9 * t / (rt / (1 + (f / bright) ** 1.2) + 0.02)), 512)
        y *= np.minimum(1, tvec(L) / 0.006); y = np.concatenate([np.zeros(int(pre * SR)), y])[:L]
        out.append(y / np.sqrt(np.sum(y ** 2)))
    return np.vstack(out)


_IR = {}
def reverb(x, rt, wet, seed=0, bright=4000):
    """Dry + wet (wet is linear gain of the energy-normalised tail). Mono or stereo in -> stereo out."""
    key = (round(rt, 2), seed, bright)
    if key not in _IR: _IR[key] = impulse_response(rt, seed, bright)
    h = _IR[key]; x = st(x); n = x.shape[1]
    w = np.vstack([fftconvolve(x[c], h[c])[:n] for c in range(2)])
    return x + wet * w


def loopify(y, L, X):
    """y has L+X samples; crossfade the overrun into the head so out[L-1] -> out[0] is continuous."""
    y = st(y); out = y[:, :L].copy(); k = np.linspace(0, np.pi / 2, X)
    out[:, :X] = y[:, :X] * np.sin(k) + y[:, L:L + X] * np.cos(k); return out


# --- ITU-R BS.1770 loudness ---------------------------------------------------------------
_K1 = ([1.53512485958697, -2.69169618940638, 1.19839281085285], [1, -1.69065929318241, 0.73248077421585])
_K2 = ([1.0, -2.0, 1.0], [1, -1.99004745483398, 0.99007225036621])
def _kpow(x):
    """K-weighted power summed over channels (1-D), one channel at a time to keep long films in memory."""
    x = st(x); out = None
    for c in x:
        y = lfilter(*_K2, lfilter(*_K1, c.astype(np.float64)))
        out = y * y if out is None else out + y * y
    return out


def lufs(x, gated=True):
    """Integrated loudness (LUFS). Mono is treated as dual-mono (centre-panned) like ffmpeg does."""
    p = _kpow(x); B = int(0.4 * SR); H = B // 4
    if len(p) < B: return -70.0
    cs = np.concatenate([[0.0], np.cumsum(p)])
    idx = np.arange(0, len(p) - B + 1, H)
    z = (cs[idx + B] - cs[idx]) / B; l = -0.691 + 10 * np.log10(z + 1e-15)
    if not gated: return float(-0.691 + 10 * np.log10(z.mean() + 1e-15))
    z = z[l > -70]
    if not len(z): return -70.0
    rel = -0.691 + 10 * np.log10(z.mean()) - 10; z = z[-0.691 + 10 * np.log10(z) > rel]
    return float(-0.691 + 10 * np.log10(z.mean() + 1e-15))


def momentary_max(x):
    """Loudest 400 ms window (LUFS) -- used to level short SFX."""
    p = _kpow(x); B = int(0.4 * SR)
    if len(p) <= B: return float(-0.691 + 10 * np.log10(p.sum() / B + 1e-15))
    cs = np.concatenate([[0], np.cumsum(p)]); z = (cs[B:] - cs[:-B]) / B
    return float(-0.691 + 10 * np.log10(z.max() + 1e-15))


def db(g): return 10 ** (g / 20)
