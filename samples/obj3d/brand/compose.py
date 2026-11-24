# Channel banners (2560x1440) = an engine still (brand/snap.mjs) + a paper title tag card + an ink leader to the red subject.
# Also writes safe_area_check_<name>.png and the 3 marks in ink only (red stays on the scene's single focus subject).
# python brand/compose.py            (expects out/brand/work/<plate>.png and out/brand/work/mark_<logo>_ink.png)
import os, math, sys
from PIL import Image, ImageDraw, ImageFont, ImageFilter
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from redcrop import red_box
HERE = os.path.dirname(os.path.abspath(__file__)); OUT = os.path.join(HERE, "..", "out", "brand"); WORK = os.path.join(OUT, "work")
FONTS = "C:/Windows/Fonts/"
INK, INK2, MID, PAPER, RED = (43, 42, 39), (74, 72, 67), (139, 134, 123), (251, 248, 241), (200, 38, 29)
W, H = 2560, 1440
SAFE = (507, 508, 2053, 931)

BANNERS = [
 dict(name="partition_banner_1", plate="pl_sq_b", mark="partition_logo_1", title="Partition Lines", tag="WORLD AFFAIRS, IN MINIATURE", side="left", leader="line"),
 dict(name="powder_banner_1", plate="pk_depot_a", mark="powder_logo_1", title="Powder Keg", tag="WHERE THINGS ARE ABOUT TO BLOW", side="right", leader="fuse"),
 dict(name="partition_banner_2", plate="pl_talks_a", mark="partition_logo_2", title="Partition Lines", tag="GEOPOLITICS IN PLAIN ENGLISH", side="right", leader="line"),
]

def font(f, s): return ImageFont.truetype(FONTS + f, s)

def tracked(d, xy, text, fnt, fill, track):
    x, y = xy
    for ch in text:
        d.text((x, y), ch, font=fnt, fill=fill); x += d.textlength(ch, font=fnt) + track
    return x

def tracked_len(d, text, fnt, track): return sum(d.textlength(c, font=fnt) for c in text) + track * (len(text) - 1)

def card(b, red):
    """paper tag card: mark | name / rule / tagline. Returns (img RGBA full-size layer, card box)."""
    lay = Image.new("RGBA", (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(lay)
    fN, fT = font("segoeuib.ttf", 124), font("seguisb.ttf", 34); track = 5
    mark = Image.open(os.path.join(WORK, f"mark_{b['mark']}_ink.png")).convert("RGBA"); ms = 178; mark = mark.resize((ms, ms), Image.LANCZOS)
    nameW = d.textlength(b["title"], font=fN); tagW = tracked_len(d, b["tag"], fT, track)
    pad, gap = 54, 40
    textW = max(nameW, tagW); cw = int(pad + ms + gap + textW + pad); ch = 300
    cy = (SAFE[1] + SAFE[3]) // 2
    if b["side"] == "left": x0 = 600
    else: x0 = SAFE[2] - 50 - cw
    y0 = cy - ch // 2; box = (x0, y0, x0 + cw, y0 + ch)
    # soft paper shadow (same treatment as the film's label cards), then the card, then a hairline
    sh = Image.new("RGBA", (W, H), (0, 0, 0, 0)); ImageDraw.Draw(sh).rounded_rectangle((x0 + 4, y0 + 14, x0 + cw + 4, y0 + ch + 14), 14, fill=(60, 46, 26, 70))
    sh = sh.filter(ImageFilter.GaussianBlur(18)); lay = Image.alpha_composite(lay, sh); d = ImageDraw.Draw(lay)
    d.rounded_rectangle(box, 14, fill=PAPER + (255,), outline=(43, 42, 39, 110), width=3)
    lay.alpha_composite(mark, (x0 + pad, cy - ms // 2))
    tx = x0 + pad + ms + gap
    nb = d.textbbox((0, 0), b["title"], font=fN); nh = nb[3] - nb[1]
    ny = cy - 62 - nh // 2 - nb[1]
    d.text((tx, ny), b["title"], font=fN, fill=INK)
    ry = cy + 30; d.line((tx + 2, ry, tx + textW, ry), fill=INK + (255,), width=3)
    tracked(d, (tx + 2, ry + 18), b["tag"], fT, INK2, track)
    return lay, box

def leader(lay, b, box, red):
    d = ImageDraw.Draw(lay); rx, ry, bx0, by0, bx1, by1, _ = red
    sx = box[2] if b["side"] == "left" else box[0]          # start on the card edge facing the subject
    sy = (box[1] + box[3]) // 2
    tx = (bx0 - 34) if b["side"] == "left" else (bx1 + 34); ty = (by0 + by1) // 2
    if b["leader"] == "line":
        d.line((sx, sy, tx, ty), fill=INK + (255,), width=4); r = 7; d.ellipse((tx - r, ty - r, tx + r, ty + r), fill=INK + (255,))
        d.ellipse((sx - 6, sy - 6, sx + 6, sy + 6), fill=PAPER + (255,), outline=INK + (255,), width=3)
    else:   # fuse: a dashed ink cord sagging from the card to the red stack
        pts = []; n = 160; mx, my = (sx + tx) / 2, max(sy, ty) + 90
        for i in range(n + 1):
            u = i / n; x = (1 - u) ** 2 * sx + 2 * (1 - u) * u * mx + u * u * tx; y = (1 - u) ** 2 * sy + 2 * (1 - u) * u * my + u * u * ty; pts.append((x, y))
        acc, on, seg = 0, True, [pts[0]]
        for a, c in zip(pts, pts[1:]):
            acc += math.dist(a, c); seg.append(c)
            if acc >= (26 if on else 14):
                if on: d.line(seg, fill=INK + (255,), width=5, joint="curve")
                on, acc, seg = not on, 0, [c]
        if on and len(seg) > 1: d.line(seg, fill=INK + (255,), width=5)
        d.ellipse((sx - 6, sy - 6, sx + 6, sy + 6), fill=PAPER + (255,), outline=INK + (255,), width=3)
    return lay

def safe_check(img, name):
    o = img.convert("RGBA"); ov = Image.new("RGBA", (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(ov)
    dy0, dy1 = (H - 423) // 2, (H - 423) // 2 + 423
    d.rectangle((0, 0, W, dy0), fill=(0, 0, 0, 110)); d.rectangle((0, dy1, W, H), fill=(0, 0, 0, 110))           # TV only
    d.rectangle((0, dy0, SAFE[0], dy1), fill=(0, 0, 0, 45)); d.rectangle((SAFE[2], dy0, W, dy1), fill=(0, 0, 0, 45))   # desktop only
    d.rectangle(SAFE, outline=(0, 140, 255, 255), width=4); d.rectangle((0, dy0, W - 1, dy1), outline=(255, 170, 0, 255), width=3)
    f = font("segoeuib.ttf", 30)
    d.text((SAFE[0] + 10, SAFE[1] - 40), "SAFE AREA 1546x423 (mobile + all devices)", font=f, fill=(0, 140, 255, 255))
    d.text((12, dy0 + 8), "DESKTOP 2560x423", font=f, fill=(255, 170, 0, 255)); d.text((12, 12), "TV ONLY", font=f, fill=(255, 255, 255, 255))
    Image.alpha_composite(o, ov).convert("RGB").save(os.path.join(OUT, f"safe_area_check_{name}.png"))

def build(b):
    plate = Image.open(os.path.join(WORK, b["plate"] + ".png")).convert("RGBA")
    assert plate.size == (W, H), plate.size
    red = red_box(plate); assert red, "no red subject in " + b["plate"]
    lay, box = card(b, red); lay = leader(lay, b, box, red)
    out = Image.alpha_composite(plate, lay).convert("RGB"); out.save(os.path.join(OUT, b["name"] + ".png"))
    inside = SAFE[0] <= box[0] and box[2] <= SAFE[2] and SAFE[1] <= box[1] and box[3] <= SAFE[3]
    rin = SAFE[0] <= red[2] and red[4] <= SAFE[2] and SAFE[1] <= red[3] and red[5] <= SAFE[3]
    print(b["name"], "card", box, "inside safe:", inside, "| red", red[:6], "inside safe:", rin)
    safe_check(out, b["name"])
    out.crop(SAFE).save(os.path.join(WORK, b["name"] + "_mobile.png")); out.crop((0, (H - 423) // 2, W, (H - 423) // 2 + 423)).save(os.path.join(WORK, b["name"] + "_desktop.png"))

if __name__ == "__main__":
    for b in BANNERS: build(b)
