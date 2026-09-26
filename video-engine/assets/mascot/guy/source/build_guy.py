"""Build the 'guy' presenter sprites from source/character.svg (VTracer trace of Charcters/main_character_2.svg).

  node render_svg.cjs character.svg raw2x.png   (2x raster, white background path dropped)
  python build_guy.py

Outputs (one shared canvas, transparent background) in ../:
  open.png   base pose, raised forearm removed (it lives on arm.png)
  arm.png    forearm + hand only; swings about presenter.json "armPivot" (the elbow)
  blink.png  eyes closed (lid fill + lid line)        -- clipped to "eyes" by the stage
  glance.png pupils shifted toward the content (right) -- clipped to "eyes"
  talk.png   mouth open wide, talk2.png mouth open small -- clipped to "mouth"
All coordinates below are in the 2x raster (1536 x 2752).
"""
import json
import os

import numpy as np
from PIL import Image, ImageDraw

from lab import label

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.dirname(HERE)
SCALE = 0.55  # 2x raster -> sprite canvas
INK = (20, 15, 12, 255)

raw = np.array(Image.open(os.path.join(HERE, "raw2x.png")).convert("RGBA"))
H, W = raw.shape[:2]

# ---- background: drop near-white regions connected to the outside (the gap between the legs);
# the eye whites are enclosed by outlines and stay ----
white = (raw[..., 3] > 0) & (raw[..., :3].min(-1) >= 235)
_, comps = label(white)
transp = raw[..., 3] < 20
for p in comps:
    ys, xs = p[:, 0], p[:, 1]
    touch = 0
    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        touch += transp[np.clip(ys + dy, 0, H - 1), np.clip(xs + dx, 0, W - 1)].sum()
    big_gap = len(p) > 20000  # between the legs: bounded by trace edges, not by the outside
    if touch or big_gap:
        raw[ys, xs, 3] = 0

base = Image.fromarray(raw)

# ---- forearm + hand layer (right of the elbow seam) ----
ARM_POLY = [(1013, 1110), (1013, 860), (1420, 840), (1420, 1460), (1060, 1460), (1003, 1405)]
PIVOT = (1005, 1372)
m = Image.new("L", (W, H), 0)
ImageDraw.Draw(m).polygon(ARM_POLY, fill=255)
# the arm layer overlaps the body by 8 px along the seam so the two resampled edges never leave a
# light hairline at rest (the overlap pixels are identical in both layers)
mo = Image.new("L", (W, H), 0)
ImageDraw.Draw(mo).polygon([(x - 8, y) if x < 1020 else (x, y) for x, y in ARM_POLY], fill=255)
arm = Image.new("RGBA", (W, H), (0, 0, 0, 0))
arm.paste(base, (0, 0), mo)
open_ = base.copy()
open_.paste((0, 0, 0, 0), (0, 0), m)

# ---- eyes ----
LID = tuple(int(v) for v in raw[490, 740, :3]) + (255,)
EYES = [  # white region bbox, pupil bbox (hangs from the lid line)
    {"white": (684, 510, 805, 581), "pupil": (722, 517, 754, 531)},
    {"white": (882, 508, 1005, 580), "pupil": (922, 517, 956, 531)},
]


def eye_mask(img, e):
    a = np.array(img)
    x0, y0, x1, y1 = e["white"]
    sub = a[y0 : y1 + 1, x0 : x1 + 1]
    wm = sub[..., :3].min(-1) >= 215
    px0, py0, px1, py1 = e["pupil"]
    pm = np.zeros_like(wm)
    pm[py0 - y0 : py1 - y0 + 1, px0 - x0 : px1 - x0 + 1] = sub[py0 - y0 : py1 - y0 + 1, px0 - x0 : px1 - x0 + 1, :3].max(-1) < 200
    return wm, pm


def blink(img):
    out = img.copy()
    a = np.array(out)
    d = ImageDraw.Draw(out)
    for e in EYES:
        x0, y0, x1, y1 = e["white"]
        wm, pm = eye_mask(img, e)
        region = a[y0 : y1 + 1, x0 : x1 + 1]
        region[wm | pm] = LID
        a[y0 : y1 + 1, x0 : x1 + 1] = region
    out = Image.fromarray(a)
    d = ImageDraw.Draw(out)
    for e in EYES:
        x0, y0, x1, y1 = e["white"]
        cx = (x0 + x1) / 2
        # closed lid: a soft downward curve across the middle of the eye
        xs = np.linspace(x0 - 2, x1 + 2, 24)
        pts = [(x, y0 + 0.5 * (y1 - y0) + 10 * (1 - ((x - cx) / ((x1 - x0) / 2)) ** 2)) for x in xs]
        d.line(pts, fill=INK, width=9, joint="curve")
    return out


def glance(img, dx=20, dy=4):
    a = np.array(img)
    for e in EYES:
        x0, y0, x1, y1 = e["white"]
        wm, pm = eye_mask(img, e)
        region = a[y0 : y1 + 1, x0 : x1 + 1].copy()
        pupil_px = region.copy()
        region[pm] = (250, 250, 250, 255)
        ys, xs = np.nonzero(pm)
        for y, x in zip(ys, xs):
            ny, nx = y + dy, x + dx
            if 0 <= ny < region.shape[0] and 0 <= nx < region.shape[1] and wm[ny, nx] | pm[ny, nx]:
                region[ny, nx] = pupil_px[y, x]
        a[y0 : y1 + 1, x0 : x1 + 1] = region
    return Image.fromarray(a)


def mouth(img, w, h):
    """Open mouth hanging from the flat run of the smirk (y ~703, x 775-905): dark cavity + tongue,
    ink outline; the smirk's left curl and right hook stay as the corners."""
    out = img.copy()
    d = ImageDraw.Draw(out)
    cx, top = 840, 703
    box = (cx - w / 2, top - h, cx + w / 2, top + h)
    d.chord(box, 0, 180, fill=(74, 30, 26, 255))
    tw = w * 0.55
    d.chord((cx - tw / 2, top + h * 0.35, cx + tw / 2, top + h * 1.6), 180, 360, fill=(196, 92, 84, 255))
    # re-clip the tongue to the cavity: repaint outside the lower half-ellipse
    a = np.array(out)
    b = np.array(img)
    yy, xx = np.mgrid[0 : a.shape[0], 0 : a.shape[1]]
    inside = (((xx - cx) / (w / 2)) ** 2 + ((yy - top) / h) ** 2 <= 1) & (yy >= top)
    zone = (xx >= cx - w / 2 - 2) & (xx <= cx + w / 2 + 2) & (yy >= top) & (yy <= top + h * 1.7)
    a[zone & ~inside] = b[zone & ~inside]
    out = Image.fromarray(a)
    d = ImageDraw.Draw(out)
    d.arc(box, 0, 180, fill=INK, width=8)
    d.line([(cx - w / 2 - 2, top), (cx + w / 2 + 2, top)], fill=INK, width=10)
    return out


def crop(img):
    a = np.array(img)
    ys, xs = np.nonzero(a[..., 3] > 10)
    return (int(xs.min()) - 16, int(ys.min()) - 16, int(xs.max()) + 16, int(ys.max()) + 16)


BOX = crop(base)
cw, ch = BOX[2] - BOX[0], BOX[3] - BOX[1]
size = (round(cw * SCALE), round(ch * SCALE))


def save(img, name):
    img.crop(BOX).resize(size, Image.LANCZOS).save(os.path.join(OUT, name), optimize=True)


save(open_, "open.png")
save(arm, "arm.png")
save(blink(base), "blink.png")
save(glance(base), "glance.png")
save(mouth(base, 128, 40), "talk.png")
save(mouth(base, 92, 22), "talk2.png")


def frac(r):
    x0, y0, x1, y1 = r
    return [round((x0 - BOX[0]) / cw, 4), round((y0 - BOX[1]) / ch, 4), round((x1 - x0) / cw, 4), round((y1 - y0) / ch, 4)]


meta = {
    "w": size[0],
    "h": size[1],
    "aspect": round(cw / ch, 4),
    "eyes": frac((672, 455, 1012, 596)),
    "mouth": frac((700, 660, 930, 760)),
    "armPivot": [round((PIVOT[0] - BOX[0]) / cw, 4), round((PIVOT[1] - BOX[1]) / ch, 4)],
}
json.dump(meta, open(os.path.join(OUT, "presenter.json"), "w"))
print(json.dumps(meta))
