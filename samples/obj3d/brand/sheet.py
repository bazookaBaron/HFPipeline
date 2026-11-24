# brand_sheet.png: the 3 banner/logo pairs, each banner with its desktop + mobile crops, each logo full size and at 98 px in a circle.
import os
from PIL import Image, ImageDraw, ImageFont
HERE = os.path.dirname(os.path.abspath(__file__)); OUT = os.path.join(HERE, "..", "out", "brand")
F = "C:/Windows/Fonts/"; INK, MID, PAPER, BG = (43, 42, 39), (139, 134, 123), (251, 248, 241), (233, 228, 216)
PAIRS = [("Pair 1  Partition Lines", "partition_banner_1", "partition_logo_1"),
         ("Pair 2  Powder Keg", "powder_banner_1", "powder_logo_1"),
         ("Pair 3  Partition Lines (alternate)", "partition_banner_2", "partition_logo_2")]
W = 2900; rowH = 760; top = 140
S = Image.new("RGB", (W, top + rowH * 3 + 40), BG); d = ImageDraw.Draw(S)
fT, fH, fS = ImageFont.truetype(F + "segoeuib.ttf", 64), ImageFont.truetype(F + "segoeuib.ttf", 40), ImageFont.truetype(F + "seguisb.ttf", 26)
d.text((60, 40), "Channel art  -  3 banner + logo pairs", font=fT, fill=INK)
def circ(im, s):
    sm = im.resize((s, s), Image.LANCZOS); m = Image.new("L", (s * 4, s * 4), 0); ImageDraw.Draw(m).ellipse((0, 0, s * 4 - 1, s * 4 - 1), fill=255)
    return sm, m.resize((s, s), Image.LANCZOS)
for i, (title, bn, lg) in enumerate(PAIRS):
    y = top + i * rowH; d.text((60, y + 10), title, font=fH, fill=INK)
    ban = Image.open(os.path.join(OUT, bn + ".png")).convert("RGB")
    bw, bh = 1120, 630; S.paste(ban.resize((bw, bh), Image.LANCZOS), (60, y + 70)); d.text((60, y + 70 + bh + 8), bn + ".png  (2560x1440, TV)", font=fS, fill=MID)
    # desktop + mobile crops
    dk = ban.crop((0, 508, 2560, 931)).resize((1100, int(423 * 1100 / 2560)), Image.LANCZOS); S.paste(dk, (1220, y + 70)); d.text((1220, y + 70 + dk.height + 6), "desktop crop 2560x423", font=fS, fill=MID)
    mb = ban.crop((507, 508, 2053, 931)).resize((760, int(423 * 760 / 1546)), Image.LANCZOS); my = y + 70 + dk.height + 50; S.paste(mb, (1220, my)); d.text((1220, my + mb.height + 6), "mobile / safe crop 1546x423", font=fS, fill=MID)
    lo = Image.open(os.path.join(OUT, lg + ".png")).convert("RGB")
    S.paste(lo.resize((380, 380), Image.LANCZOS), (2390, y + 70)); d.text((2390, y + 458), lg + ".png", font=fS, fill=MID)
    for k, (bgc, lab) in enumerate([((255, 255, 255), "98 px, light"), ((24, 24, 24), "98 px, dark")]):
        bx, by = 2040 + k * 170, my
        d.rounded_rectangle((bx, by, bx + 150, by + 170), 10, fill=bgc)
        sm, m = circ(lo, 98); S.paste(sm, (bx + 26, by + 18), m); d.text((bx + 8, by + 128), lab, font=ImageFont.truetype(F + "seguisb.ttf", 20), fill=(120, 120, 120))
    sm, m = circ(lo, 98); S.paste(sm, (2390, y + 520), m); d.text((2500, y + 555), "98 px circle", font=fS, fill=MID)
S.save(os.path.join(OUT, "brand_sheet.png")); print("wrote brand_sheet.png", S.size)
