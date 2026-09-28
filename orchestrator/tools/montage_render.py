"""
Cold-open montage picture (lib/longform/montage.js, long-form v2 plan section 2).

    python montage_render.py plan.json out.mp4      -> stdout: one JSON line {frames, shots, blank: [...], seconds}

Deterministic frame-by-frame renderer (PIL + numpy, no randomness, no clock): every frame is a pure function
of (plan, frame index), piped as raw RGB into ffmpeg (H.264 High, yuv420p, 30 fps, CRF 18 -- the chapter
segment parameters). Shot kinds:

  slam       paper background (#f7f6f1, the LF profile), heavy sans (Segoe UI Black, the system-ui face the
             chapters render with on this machine), words POP in on their spoken time (scale 1.35 -> 1 with a
             small overshoot, 2-frame fade), one accent word in the LF red on a marker sweep; the whole card
             pushes in slowly
  photoText  one of our photos full-bleed with a punch-in, ink gradient at the bottom, the line in white
             (accent word in the LF "hot" yellow), credit chip
  frame      a rendered chapter moment (map / big number / chart ...) cropped to its module and punched in:
             an impact snap (1.12 -> 1 over 5 frames) then a steady push
  photo      a photo punched in (cover crop around its focal box), credit chip
  anchor     paper card, the anchor line revealed word by word (fade + 10 px rise), accent on a marker sweep,
             a thin red rule, the quote source when it is a quote; slow push-in across the hold
  flash      (flag on a run shot) white burst decaying over 5 frames

Blank check: the middle frame of every shot must have a luma standard deviation >= 8 (a flat frame fails).
"""
import json
import math
import os
import subprocess
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFont

W, H = 1920, 1080
PAPER = (247, 246, 241)
INK = (22, 32, 42)
MUTED = (98, 103, 106)
RED = (178, 58, 63)
MARKER = (253, 229, 135)
HOT = (255, 201, 60)
FONT_DIRS = [os.path.join(os.environ.get("WINDIR", "C:\\Windows"), "Fonts"), "/usr/share/fonts/truetype/dejavu", "/Library/Fonts"]


def font_path(names):
    for d in FONT_DIRS:
        for n in names:
            p = os.path.join(d, n)
            if os.path.exists(p):
                return p
    return None


F_BLACK = font_path(["seguibl.ttf", "arialbd.ttf", "DejaVuSans-Bold.ttf"])
F_BOLD = font_path(["segoeuib.ttf", "arialbd.ttf", "DejaVuSans-Bold.ttf"])
F_SEMI = font_path(["seguisb.ttf", "segoeuib.ttf", "arial.ttf", "DejaVuSans.ttf"])
F_REG = font_path(["segoeui.ttf", "arial.ttf", "DejaVuSans.ttf"])
_fonts = {}


def font(path, size):
    k = (path, size)
    if k not in _fonts:
        _fonts[k] = ImageFont.truetype(path, size) if path else ImageFont.load_default()
    return _fonts[k]


def ease_out(u):
    u = min(1.0, max(0.0, u))
    return 1 - (1 - u) ** 3


def ease_back(u, s=1.6):
    u = min(1.0, max(0.0, u)) - 1
    return 1 + (s + 1) * u ** 3 + s * u ** 2


# ------------------------------------------------------------------ images

_imgs = {}


def load(path):
    if path not in _imgs:
        im = Image.open(path)
        im = im.convert("RGB")
        _imgs[path] = im
    return _imgs[path]


def cover_box(iw, ih, focal=None):
    """largest 16:9 box inside the image, centred on the focal box centre (normalised [x, y, w, h])"""
    if iw / ih > W / H:
        bw, bh = ih * W / H, ih
    else:
        bw, bh = iw, iw * H / W
    cx, cy = iw / 2, ih / 2
    if focal and len(focal) == 4:
        cx = (focal[0] + focal[2] / 2) * iw
        cy = (focal[1] + focal[3] / 2) * ih
    x0 = min(max(0, cx - bw / 2), iw - bw)
    y0 = min(max(0, cy - bh / 2), ih - bh)
    return [x0, y0, bw, bh]


def view(im, box, scale):
    """render box (x, y, w, h in image px) zoomed by `scale` about its centre into W x H"""
    x, y, bw, bh = box
    cx, cy = x + bw / 2, y + bh / 2
    vw, vh = bw / scale, bh / scale
    a = vw / W
    e = vh / H
    return im.transform((W, H), Image.AFFINE, (a, 0, cx - vw / 2, 0, e, cy - vh / 2), resample=Image.BILINEAR)


# ------------------------------------------------------------------ text layout

def layout_words(ws, fnt, max_w, space):
    """greedy balanced wrap -> list of lines of word indices"""
    widths = [fnt.getlength(w) for w in ws]
    total = sum(widths) + space * (len(ws) - 1)
    n_lines = max(1, math.ceil(total / max_w))
    target = total / n_lines
    lines, cur, cw = [], [], 0
    for i, w in enumerate(widths):
        add = w + (space if cur else 0)
        if cur and (cw + add > max_w or (cw + add > target * 1.08 and len(lines) < n_lines - 1)):
            lines.append(cur)
            cur, cw = [], 0
            add = w
        cur.append(i)
        cw += add
    if cur:
        lines.append(cur)
    return lines, widths


def fit_text(ws, fpath, max_w, max_lines, sizes):
    for size in sizes:
        f = font(fpath, size)
        lines, widths = layout_words(ws, f, max_w, size * 0.28)
        if len(lines) <= max_lines and all(sum(widths[i] for i in ln) + size * 0.28 * (len(ln) - 1) <= max_w for ln in lines):
            return size, f, lines, widths
    size = sizes[-1]
    f = font(fpath, size)
    lines, widths = layout_words(ws, f, max_w, size * 0.28)
    return size, f, lines, widths


class TextBlock:
    """positions of each word of a line of text, centred (or left-aligned) in a box"""

    def __init__(self, text, fpath, max_w, max_lines, sizes, centre, align="center", leading=1.08, upper=False):
        raw = text.split()
        self.ws = [w.upper() for w in raw] if upper else raw
        self.size, self.f, self.lines, self.widths = fit_text(self.ws, fpath, max_w, max_lines, sizes)
        sp = self.size * 0.28
        lh = self.size * leading
        asc, desc = self.f.getmetrics()
        self.asc = asc
        total_h = lh * (len(self.lines) - 1) + asc + desc * 0.3
        y0 = centre[1] - total_h / 2
        self.pos = [None] * len(self.ws)
        self.line_boxes = []
        block_w = max(sum(self.widths[i] for i in ln) + sp * (len(ln) - 1) for ln in self.lines)
        for li, ln in enumerate(self.lines):
            lw = sum(self.widths[i] for i in ln) + sp * (len(ln) - 1)
            x = centre[0] - lw / 2 if align == "center" else centre[0] - block_w / 2
            y = y0 + li * lh
            for i in ln:
                self.pos[i] = (x, y)
                x += self.widths[i] + sp
        self.box = (centre[0] - block_w / 2, y0, block_w, total_h)


_word_cache = {}


def word_img(text, fpath, size, color):
    k = (text, fpath, size, color)
    if k not in _word_cache:
        f = font(fpath, size)
        l, t, r, b = f.getbbox(text)
        pad = int(size * 0.3)
        im = Image.new("RGBA", (int(r) + 2 * pad, int(b) + 2 * pad), (0, 0, 0, 0))
        ImageDraw.Draw(im).text((pad, pad), text, font=f, fill=color + (255,))
        _word_cache[k] = (im, pad)
    return _word_cache[k]


def paste_word(canvas, text, fpath, size, color, xy, scale=1.0, alpha=1.0, dy=0.0):
    im, pad = word_img(text, fpath, size, color)
    if alpha <= 0.01:
        return
    if abs(scale - 1) > 0.005:
        nw, nh = max(1, int(im.width * scale)), max(1, int(im.height * scale))
        cx, cy = xy[0] - pad + im.width / 2, xy[1] - pad + im.height / 2
        im2 = im.resize((nw, nh), Image.BILINEAR)
        ox, oy = cx - nw / 2, cy - nh / 2
    else:
        im2 = im
        ox, oy = xy[0] - pad, xy[1] - pad
    if alpha < 0.999:
        a = np.asarray(im2.getchannel("A"), dtype=np.float32) * alpha
        im2 = im2.copy()
        im2.putalpha(Image.fromarray(a.astype(np.uint8)))
    canvas.alpha_composite(im2, (int(round(ox)), int(round(oy + dy))))


def credit_chip(canvas, text):
    if not text:
        return
    f = font(F_SEMI, 20)
    tw = f.getlength(text)
    d = ImageDraw.Draw(canvas)
    x, y = 28, H - 28 - 34
    d.rounded_rectangle((x, y, x + tw + 24, y + 34), radius=6, fill=(247, 246, 241, 235))
    d.text((x + 12, y + 5), text, font=f, fill=(47, 53, 56, 255))


# ------------------------------------------------------------------ shots

class Shot:
    def __init__(self, s, plan):
        self.s = s
        self.kind = s["kind"]
        self.t0, self.t1 = s["t0"], s["t1"]
        self.dur = max(1e-3, self.t1 - self.t0)
        if self.kind in ("frame", "photo", "photoText"):
            self.im = load(s["image"])
            if self.kind == "frame":
                sx, sy = self.im.width / W, self.im.height / H
                c = s["crop"]
                self.box = [c[0] * sx, c[1] * sy, c[2] * sx, c[3] * sy]
            else:
                self.box = cover_box(self.im.width, self.im.height, s.get("focal"))
        if self.kind in ("slam", "photoText", "anchor"):
            text = s["text"]
            if self.kind == "slam":
                self.tb = TextBlock(text, F_BLACK, 1680, 4, [200, 184, 168, 156, 144, 132, 120, 110, 100], (W / 2, H / 2), upper=True, leading=0.98)
                self.fp = F_BLACK
            elif self.kind == "photoText":
                self.tb = TextBlock(text, F_BLACK, 1700, 3, [136, 124, 112, 104, 96, 88, 80], (W / 2, H - 270), upper=True, leading=0.98)
                self.fp = F_BLACK
            else:
                self.tb = TextBlock(text, F_BLACK, 1640, 4, [132, 124, 116, 108, 100, 92, 84, 76], (W / 2, H / 2), align="left", leading=1.1)
                self.fp = F_BLACK
            self.words = s.get("words") or []
            self.accent = s.get("accent", -1)
            # word appear times (plan words come from the voice timing; fall back to an even spread)
            n = len(self.tb.ws)
            ts = [w["t"] for w in self.words][:n]
            while len(ts) < n:
                ts.append(self.t0 + 0.1 + (len(ts) / max(1, n)) * self.dur * 0.6)
            self.wt = [min(t, self.t1 - 0.25) for t in ts]
            if self.kind != "anchor":
                self.wt = [t - 0.04 for t in self.wt]

    # ---- per kind
    def render(self, t, f_in_shot):
        u = (t - self.t0) / self.dur
        if self.kind == "frame":
            snap = 0.12 * max(0.0, 1 - f_in_shot / 5.0) ** 2
            p = self.s.get("punch") or [1.0, 1.06]
            sc = p[0] + 0.07 * ease_out(u) + snap
            out = view(self.im, self.box, sc)
            return out.convert("RGBA")
        if self.kind == "photo":
            snap = 0.06 * max(0.0, 1 - f_in_shot / 5.0) ** 2
            sc = 1.0 + 0.09 * ease_out(u) + snap
            out = view(self.im, self.box, sc).convert("RGBA")
            credit_chip(out, self.s.get("credit"))
            return out
        if self.kind == "photoText":
            sc = 1.02 + 0.08 * u
            out = view(self.im, self.box, sc).convert("RGBA")
            out.alpha_composite(GRADIENT)
            self.draw_words(out, t, color=(255, 255, 255), accent_color=HOT, marker=False)
            credit_chip(out, self.s.get("credit"))
            return out
        if self.kind == "slam":
            layer = Image.new("RGBA", (W, H), PAPER + (255,))
            self.draw_words(layer, t, color=INK, accent_color=RED, marker=True)
            sc = 1.0 + 0.035 * u
            return layer if sc < 1.002 else layer.transform((W, H), Image.AFFINE, (1 / sc, 0, W / 2 - W / (2 * sc), 0, 1 / sc, H / 2 - H / (2 * sc)), resample=Image.BILINEAR)
        if self.kind == "anchor":
            layer = Image.new("RGBA", (W, H), PAPER + (255,))
            d = ImageDraw.Draw(layer)
            bx, by, bw, bh = self.tb.box
            # red rule + quote mark / source
            ru = ease_out((t - self.t0) / 0.5)
            d.rectangle((bx, by - 70, bx + 140 * ru, by - 62), fill=RED + (255,))
            q = self.s.get("quote") or None
            self.draw_words(layer, t, color=INK, accent_color=RED, marker=True, rise=True)
            if q and (q.get("speaker") or q.get("source")):
                src = " \u2014 " + ", ".join(x for x in [q.get("speaker"), q.get("source")] if x)
                a = ease_out((t - (self.wt[-1] + 0.3)) / 0.4)
                if a > 0:
                    f = font(F_SEMI, 34)
                    img = Image.new("RGBA", (W, 60), (0, 0, 0, 0))
                    ImageDraw.Draw(img).text((0, 0), src.strip(), font=f, fill=MUTED + (int(255 * a),))
                    layer.alpha_composite(img, (int(bx), int(by + bh + 40)))
            sc = 1.0 + 0.05 * ease_out(u)
            return layer.transform((W, H), Image.AFFINE, (1 / sc, 0, W / 2 - W / (2 * sc), 0, 1 / sc, H / 2 - H / (2 * sc)), resample=Image.BILINEAR)
        raise ValueError(self.kind)

    def draw_words(self, canvas, t, color, accent_color, marker, rise=False):
        tb = self.tb
        size = tb.size
        # marker sweep behind the accent word (drawn first)
        if marker and 0 <= self.accent < len(tb.ws):
            ta = self.wt[self.accent]
            m = ease_out((t - ta) / 0.22)
            if m > 0:
                x, y = tb.pos[self.accent]
                w = tb.widths[self.accent]
                d = ImageDraw.Draw(canvas)
                top = y + tb.asc * 0.30
                bot = y + tb.asc * 1.08
                d.rectangle((x - 10, top, x - 10 + (w + 20) * m, bot), fill=MARKER + (255,))
        for i, w in enumerate(tb.ws):
            ti = self.wt[i]
            if t < ti:
                continue
            k = (t - ti) * 30.0  # frames since appear
            col = accent_color if i == self.accent else color
            if rise:
                a = ease_out(k / 6.0)
                paste_word(canvas, w, self.fp, size, col, tb.pos[i], 1.0, a, dy=10 * (1 - a))
            else:
                sc = 1.22 - 0.22 * ease_back(k / 4.0) if k < 4 else 1.0
                a = min(1.0, (k + 1) / 2.0)
                paste_word(canvas, w, self.fp, size, col, tb.pos[i], sc, a)


def make_gradient():
    g = np.zeros((H, W, 4), dtype=np.uint8)
    ys = np.arange(H, dtype=np.float32)
    a = np.clip((ys - H * 0.38) / (H * 0.62), 0, 1) ** 1.3 * 0.86
    g[..., 0], g[..., 1], g[..., 2] = 12, 16, 22
    g[..., 3] = (a * 255).astype(np.uint8)[:, None]
    return Image.fromarray(g, "RGBA")


GRADIENT = make_gradient()


def score_crops(list_path):
    """--score list.json: [{id, image, crop}] -> stdout JSON {id: {ink, edges, std}}.
    ink = share of the crop that is not paper (|pixel - paper| > 28), edges = mean gradient magnitude; a
    chart caught before its bars draw (mostly empty paper) scores low and is dropped by montage.js."""
    items = json.load(open(list_path, encoding="utf-8"))
    paper = np.array(PAPER, dtype=np.float32)
    out = {}
    for it in items:
        try:
            im = load(it["image"])
            sx, sy = im.width / W, im.height / H
            c = it["crop"]
            box = (int(c[0] * sx), int(c[1] * sy), int((c[0] + c[2]) * sx), int((c[1] + c[3]) * sy))
            a = np.asarray(im.crop(box).resize((480, 270), Image.BILINEAR), dtype=np.float32)
            inkm = np.abs(a - paper).max(axis=2) > 28
            ink = float(inkm.mean())
            # lopsided: one half of the crop (left/right/top/bottom) almost all paper
            halves = [inkm[:, :240], inkm[:, 240:], inkm[:135], inkm[135:]]
            half_paper = float(max(1 - h.mean() for h in halves))
            g = a.mean(axis=2)
            edges = float(np.abs(np.diff(g, axis=0)).mean() + np.abs(np.diff(g, axis=1)).mean())
            out[it["id"]] = {"ink": round(ink, 3), "edges": round(edges, 2), "std": round(float(g.std()), 2), "halfPaper": round(half_paper, 3)}
        except Exception as e:  # noqa: BLE001
            out[it["id"]] = {"error": str(e)[:200]}
    print(json.dumps(out))


def main():
    if sys.argv[1] == "--score":
        return score_crops(sys.argv[2])
    plan_path, out = sys.argv[1], sys.argv[2]
    plan = json.load(open(plan_path, encoding="utf-8"))
    fps = int(plan.get("fps", 30))
    n = int(round(plan["duration"] * fps))
    shots = [Shot(s, plan) for s in plan["shots"]]
    starts = [int(round(s.t0 * fps)) for s in shots]
    ff = subprocess.Popen(["ffmpeg", "-y", "-v", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(fps), "-i", "-",
                           "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-profile:v", "high", "-pix_fmt", "yuv420p", "-r", str(fps), "-g", "60", "-bf", "2",
                           "-movflags", "+faststart", out], stdin=subprocess.PIPE)
    blank = []
    mids = {i: int(round((s.t0 + s.t1) / 2 * fps)) for i, s in enumerate(shots)}
    k = 0
    for f in range(n):
        while k + 1 < len(shots) and f >= starts[k + 1]:
            k += 1
        sh = shots[k]
        t = f / fps
        img = sh.render(t, f - starts[k])
        if sh.s.get("flash"):
            fa = max(0.0, 1 - (f - starts[k]) / 5.0)
            if fa > 0:
                img = Image.blend(img, Image.new("RGBA", (W, H), (255, 255, 255, 255)), fa * 0.92)
        rgb = np.asarray(img.convert("RGB"))
        if f == mids[k]:
            std = float(np.asarray(img.convert("L"), dtype=np.float32).std())
            if std < 8:
                blank.append({"shot": k, "std": round(std, 2)})
        ff.stdin.write(rgb.tobytes())
    ff.stdin.close()
    if ff.wait() != 0:
        raise SystemExit("ffmpeg failed")
    print(json.dumps({"frames": n, "shots": len(shots), "blank": blank, "seconds": round(n / fps, 3)}))


if __name__ == "__main__":
    main()
