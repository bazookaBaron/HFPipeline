"""Cut out the generated presenter, repaint its face-screen features and emit pixel-identical
state sprites (only eyes / mouth differ). Usage: python build_presenter.py src.png outdir"""
import sys, os, json
from collections import deque
import numpy as np
from PIL import Image, ImageDraw

src, outdir = sys.argv[1], sys.argv[2]
os.makedirs(outdir, exist_ok=True)
rgb = np.asarray(Image.open(src).convert("RGB")).astype(np.float32)
H, W, _ = rgb.shape
OUTLINE = np.array([13, 16, 32], np.float32)

# ---------- 1. background: near-white components touching the border, or large pure-white holes
mn = rgb.min(2); mx = rgb.max(2)
cand = (mn >= 236) & ((mx - mn) <= 14)
lab = np.zeros((H, W), np.int32)
bg = np.zeros((H, W), bool)
cid = 0
for y0 in range(H):
    row = cand[y0]
    for x0 in np.nonzero(row & (lab[y0] == 0))[0]:
        if lab[y0, x0]:
            continue
        cid += 1
        q = deque([(y0, x0)]); lab[y0, x0] = cid; pts = []; border = False
        while q:
            y, x = q.popleft(); pts.append((y, x))
            if y == 0 or x == 0 or y == H - 1 or x == W - 1:
                border = True
            for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                ny, nx = y + dy, x + dx
                if 0 <= ny < H and 0 <= nx < W and cand[ny, nx] and not lab[ny, nx]:
                    lab[ny, nx] = cid; q.append((ny, nx))
        ys, xs = zip(*pts)
        ys = np.array(ys); xs = np.array(xs)
        pure = mn[ys, xs].mean() >= 250
        if border or (len(pts) >= 300 and pure):
            bg[ys, xs] = True
print("bg components scanned:", cid)

def dilate(m, n):
    for _ in range(n):
        p = np.pad(m, 1)
        m = p[1:-1, 1:-1] | p[:-2, 1:-1] | p[2:, 1:-1] | p[1:-1, :-2] | p[1:-1, 2:] | p[:-2, :-2] | p[2:, 2:] | p[:-2, 2:] | p[2:, :-2]
    return m

# ---------- 2. alpha: un-premultiply the anti-aliased outline against white
near = dilate(bg, 3) & dilate(~bg, 3)
lum = rgb.mean(2)
a_edge = np.clip((255.0 - lum) / (255.0 - OUTLINE.mean()), 0, 1)
alpha = np.where(bg, 0.0, 1.0)
alpha = np.where(near, a_edge, alpha)
col = rgb.copy()
col[near] = OUTLINE  # edge pixels are pure outline colour at partial alpha -> no white halo

# ---------- 3. face screen: find the cyan features, erase them with the screen colour
cyan = (rgb[..., 1] > 140) & (rgb[..., 2] > 140) & (rgb[..., 0] < 190) & ((rgb[..., 1] - rgb[..., 0]) > 50)
# restrict to the head's screen area (upper 45% of the figure)
fy, fx = np.nonzero(~bg)
top, bot = fy.min(), fy.max()
cyan[int(top + (bot - top) * 0.45):, :] = False
lab2 = np.zeros((H, W), np.int32); comps = []
for y0, x0 in zip(*np.nonzero(cyan)):
    if lab2[y0, x0]:
        continue
    k = len(comps) + 1; q = deque([(y0, x0)]); lab2[y0, x0] = k; pts = []
    while q:
        y, x = q.popleft(); pts.append((y, x))
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                ny, nx = y + dy, x + dx
                if 0 <= ny < H and 0 <= nx < W and cyan[ny, nx] and not lab2[ny, nx]:
                    lab2[ny, nx] = k; q.append((ny, nx))
    ys = [p[0] for p in pts]; xs = [p[1] for p in pts]
    comps.append({"n": len(pts), "box": [min(xs), min(ys), max(xs) + 1, max(ys) + 1]})
def on_screen(c):
    x0, y0, x1, y1 = c["box"]
    ring = rgb[max(0, y0 - 8):y1 + 8, max(0, x0 - 8):x1 + 8].reshape(-1, 3)
    dark = (np.abs(ring - np.array([19, 30, 58])).sum(1) < 40).mean()
    return dark > 0.35
comps = sorted([c for c in comps if c["n"] > 40 and on_screen(c)], key=lambda c: -c["n"])[:3]
print("features:", comps)
eyes = sorted([c["box"] for c in comps[:2]], key=lambda b: b[0])
mouth = comps[2]["box"]
feat = np.zeros((H, W), bool)
for b in eyes + [mouth]:
    x0, y0, x1, y1 = b
    feat[y0 - 6:y1 + 6, x0 - 6:x1 + 6] = True
# screen colour = median of the ring around the features that is not cyan
ring = dilate(feat, 4) & ~feat
SCREEN = np.median(rgb[ring], axis=0)
print("screen colour", SCREEN)
dist = np.abs(rgb - SCREEN).sum(2)
erase = feat & (dist > 12)
erase = dilate(erase, 2) & dilate(feat, 2)
col[erase] = SCREEN

base = Image.fromarray(np.dstack([col, alpha * 255]).clip(0, 255).astype(np.uint8), "RGBA")

# ---------- 4. draw the features (4x supersampled)
CY = (102, 241, 238, 255)
DARK = (14, 72, 84, 255)
S = 4
(lx0, ly0, lx1, ly1), (rx0, ry0, rx1, ry1) = eyes
ew = ((lx1 - lx0) + (rx1 - rx0)) / 2; eh = ((ly1 - ly0) + (ry1 - ry0)) / 2
ecs = [((lx0 + lx1) / 2, (ly0 + ly1) / 2), ((rx0 + rx1) / 2, (ry0 + ry1) / 2)]
mx0, my0, mx1, my1 = mouth
mw = mx1 - mx0; mcx = (mx0 + mx1) / 2; mtop = my0
stroke = max(6, round((my1 - my0) * 0.55))

def layer():
    im = Image.new("RGBA", (W * S, H * S), (0, 0, 0, 0))
    return im, ImageDraw.Draw(im)

def E(d, cx, cy, w, h, fill=None, outline=None, width=0):
    d.ellipse([(cx - w / 2) * S, (cy - h / 2) * S, (cx + w / 2) * S, (cy + h / 2) * S], fill=fill, outline=outline, width=width * S)

def eyes_open(d, dx=0, dy=0, sx=1.0):
    for cx, cy in ecs:
        E(d, cx + dx, cy + dy, ew * sx, eh, fill=CY)

def curve(d, p0, c, p1, width, fill=CY, n=60):
    # quadratic curve stroked with round caps (stamped discs)
    r = width / 2
    for i in range(n + 1):
        t = i / n
        x = (1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * c[0] + t * t * p1[0]
        y = (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * c[1] + t * t * p1[1]
        d.ellipse([(x - r) * S, (y - r) * S, (x + r) * S, (y + r) * S], fill=fill)

def eyes_closed(d):
    for cx, cy in ecs:
        w = ew * 1.15; y = cy + eh * 0.08
        curve(d, (cx - w / 2, y), (cx, y + eh * 0.42), (cx + w / 2, y), stroke * 1.15)  # relaxed "u" lids

def mouth_closed(d):
    y = mtop + stroke * 0.5
    curve(d, (mx0 + stroke * 0.5, y), (mcx, y + (my1 - my0) * 1.25), (mx1 - stroke * 0.5, y), stroke)

def mouth_open(d, depth):
    w = mw * 0.92; h = w * depth
    y = mtop + stroke * 0.3
    box = [(mcx - w / 2) * S, (y - h) * S, (mcx + w / 2) * S, (y + h) * S]
    d.pieslice(box, 0, 180, fill=DARK, outline=CY, width=int(stroke * 0.85 * S))

STATES = {
    "open": (lambda d: eyes_open(d), mouth_closed),
    "blink": (eyes_closed, mouth_closed),
    "talk": (lambda d: eyes_open(d), lambda d: mouth_open(d, 0.62)),
    "talk2": (lambda d: eyes_open(d), lambda d: mouth_open(d, 0.34)),
    "glance": (lambda d: eyes_open(d, dx=ew * 0.28, dy=-eh * 0.2, sx=0.84), mouth_closed),
}

# crop box: figure bbox + pad; feet on the bottom edge
ay, ax = np.nonzero(alpha > 0.02)
pad = 6
crop = (max(0, ax.min() - pad), max(0, ay.min() - pad), min(W, ax.max() + 1 + pad), ay.max() + 1)
cw, ch = crop[2] - crop[0], crop[3] - crop[1]
for name, (fe, fm) in STATES.items():
    im, d = layer(); fe(d); fm(d)
    ov = im.resize((W, H), Image.LANCZOS)
    out = Image.alpha_composite(base, ov).crop(crop)
    out.save(os.path.join(outdir, name + ".png"), optimize=True)

# face regions (fractions of the cropped canvas) for per-feature overlays in core.js
def frac(b):
    x0, y0, x1, y1 = b
    return [float(round((x0 - crop[0]) / cw, 4)), float(round((y0 - crop[1]) / ch, 4)), float(round((x1 - x0) / cw, 4)), float(round((y1 - y0) / ch, 4))]
eyes_box = [min(lx0, rx0) - ew * 0.5, min(ly0, ry0) - eh * 0.45, max(lx1, rx1) + ew * 0.6, max(ly1, ry1) + eh * 0.3]
mouth_box = [mx0 - mw * 0.2, mtop - stroke * 1.2, mx1 + mw * 0.2, mtop + mw * 0.62 + stroke * 2]
meta = {"w": int(cw), "h": int(ch), "aspect": float(round(cw / ch, 4)), "eyes": frac(eyes_box), "mouth": frac(mouth_box)}
split = (max(ly1, ry1) + mtop) / 2
eyes_box[3] = split; mouth_box[1] = split
meta = {"w": int(cw), "h": int(ch), "aspect": float(round(cw / ch, 4)), "eyes": frac(eyes_box), "mouth": frac(mouth_box)}
assert eyes_box[3] <= mouth_box[1], ("face regions overlap", eyes_box, mouth_box)
print(json.dumps(meta))
json.dump(meta, open(os.path.join(outdir, "_meta.json"), "w"))
