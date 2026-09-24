# Per-frame (every frame, 30fps) metrics for one video.
# Decodes at 144x256 RGB, computes per-cell change activity (4 cols x 16 rows grid),
# cut score (colour-histogram distance), saturated-hue census, content occupancy per row.
import sys, subprocess, json
import numpy as np

W, H = 144, 256
GC, GR = 4, 16
key, path = sys.argv[1], sys.argv[2]
cmd = ["ffmpeg", "-v", "error", "-i", path, "-vf", f"scale={W}:{H}:flags=area", "-pix_fmt", "rgb24", "-f", "rawvideo", "-"]
p = subprocess.Popen(cmd, stdout=subprocess.PIPE)
fsz = W * H * 3

def rgb2hsv(f):
    f = f.astype(np.float32) / 255.0
    r, g, b = f[..., 0], f[..., 1], f[..., 2]
    mx = f.max(-1); mn = f.min(-1); d = mx - mn
    s = np.where(mx > 0, d / np.maximum(mx, 1e-6), 0)
    h = np.zeros_like(mx)
    m = d > 1e-6
    rm = m & (mx == r); gm = m & (mx == g) & ~rm; bm = m & ~rm & ~gm
    h[rm] = ((g - b)[rm] / d[rm]) % 6
    h[gm] = ((b - r)[gm] / d[gm]) + 2
    h[bm] = ((r - g)[bm] / d[bm]) + 4
    return h * 60.0, s, mx

prev = None; prevhist = None
cells, cut, hues, huefrac, lum, bgcorner = [], [], [], [], [], []
row_content = np.zeros(H); row_change = np.zeros(H); n = 0
huebins_all = []
while True:
    buf = p.stdout.read(fsz)
    if len(buf) < fsz: break
    f = np.frombuffer(buf, np.uint8).reshape(H, W, 3)
    L = (0.299 * f[..., 0] + 0.587 * f[..., 1] + 0.114 * f[..., 2]).astype(np.float32)
    h, s, v = rgb2hsv(f)
    # colour histogram for cut detection (4x4x4)
    q = (f // 64).astype(np.int32)
    hist = np.bincount((q[..., 0] * 16 + q[..., 1] * 4 + q[..., 2]).ravel(), minlength=64).astype(np.float32)
    hist /= hist.sum()
    if prev is None:
        cells.append(np.zeros(GC * GR)); cut.append(0.0)
    else:
        ch = (np.abs(L - prev) > 12).astype(np.float32)
        c = ch.reshape(GR, H // GR, GC, W // GC).mean(axis=(1, 3)).ravel()
        cells.append(c)
        cut.append(float(0.5 * np.abs(hist - prevhist).sum()))
        row_change += ch.mean(1)
    # saturated-hue census: 12 x 30deg bins, count bins holding >=0.3% of frame pixels
    sat = (s > 0.35) & (v > 0.30)
    hb = np.bincount((h[sat] // 30).astype(np.int32) % 12, minlength=12) / (H * W)
    huebins_all.append(hb)
    hues.append(int((hb >= 0.003).sum())); huefrac.append(float(sat.mean()))
    # content occupancy: pixels that differ from the frame's modal background luminance
    bgL = float(np.median(L))
    row_content += (np.abs(L - bgL) > 18).mean(1)
    lum.append(float(L.mean())); bgcorner.append(float(L[:12, :12].mean()))
    prev = L; prevhist = hist; n += 1
p.wait()
np.savez_compressed(f"{key}.frames.npz", cells=np.array(cells, np.float32), cut=np.array(cut, np.float32),
                    hues=np.array(hues), huefrac=np.array(huefrac, np.float32), huebins=np.array(huebins_all, np.float32),
                    lum=np.array(lum, np.float32), bgcorner=np.array(bgcorner, np.float32),
                    row_content=row_content / n, row_change=row_change / max(n - 1, 1))
print(key, n, "frames")
