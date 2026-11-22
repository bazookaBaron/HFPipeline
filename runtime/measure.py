"""measure.py <mp4> [--fps 30] [--zone 600-1250] [--size 1080x1920] [--thr 12]
Motion metrics: moving % of frames, longest still run, content-zone moving % and max hold (s), still spans.
Zone y-range is in source pixels (default 9:16 reels 600-1250). For 16:9 use --size 1920x1080 --zone 200-900."""
import argparse, subprocess, numpy as np
ap = argparse.ArgumentParser(); ap.add_argument("mp4"); ap.add_argument("--fps", type=float, default=30)
ap.add_argument("--zone", default="600-1250"); ap.add_argument("--size", default="1080x1920"); ap.add_argument("--thr", type=int, default=12)
a = ap.parse_args(); W, H = map(int, a.size.split("x")); z0, z1 = map(int, a.zone.split("-"))
w = 320 if W > H else 180; h = round(w * H / W)
raw = subprocess.run(["ffmpeg", "-v", "error", "-i", a.mp4, "-vf", f"fps={a.fps},scale={w}:{h},format=gray", "-f", "rawvideo", "-"], capture_output=True).stdout
x = np.frombuffer(raw, np.uint8); x = x[:len(x) // (w * h) * w * h].reshape(-1, h, w).astype(np.int16)
d = np.abs(np.diff(x, axis=0)); mv = (d > a.thr).mean(axis=(1, 2)) > 0.002
y0, y1 = int(z0 * h / H), int(z1 * h / H); cz = (d[:, y0:y1] > a.thr).mean(axis=(1, 2)) > 0.002
def mr(m):
    r = b = 0
    for v in m: r = 0 if v else r + 1; b = max(b, r)
    return b
print('moving %.1f%% maxstill %d f | content %.1f%% maxhold %.2fs' % (mv.mean() * 100, mr(mv), cz.mean() * 100, mr(cz) / a.fps))
r = 0; st = 0
for i, v in enumerate(list(cz) + [True]):
    if not v:
        if r == 0: st = i
        r += 1
    else:
        if r >= 6: print('still %.2f-%.2f' % (st / a.fps, i / a.fps))
        r = 0
