# Thumbnail for Trump v4 (same method as films/nvidia_v4/make_thumb.py: a frame of the film + one number hook + one label tag). Channel-neutral.
# Usage: python make_thumb.py <still.jpg> [subject_x subject_y] -> out/trump_v4_thumb.jpg (1280x720) + out/trump_v4_thumb_1920.png
# Style: monochrome world, the ONE red subject, big black number top-left, a dark label tag, no faces. Neutral wording: a question + the
# record's size, no guilt implied (the film draws no conclusion).
import sys, pathlib
from PIL import Image, ImageDraw, ImageFont, ImageFilter
OUT = pathlib.Path(__file__).resolve().parents[2] / "out"
src = Image.open(sys.argv[1]).convert("RGB").resize((1920, 1080)); cx, cy = (float(v) for v in (sys.argv[2:4] if len(sys.argv) > 3 else (1200, 540)))
x0, y0 = int(cx - 1300 * 0.625), int(cy - 560 * 0.625); x0 = max(0, min(x0, 1920 - 1200)); y0 = max(0, min(y0, 1080 - 675))
im = src.crop((x0, y0, x0 + 1200, y0 + 675)).resize((1920, 1080), Image.LANCZOS)   # 1.6x, subject right of the text block
F = lambda name, size: ImageFont.truetype(f"C:/Windows/Fonts/{name}", size)
big, unit, tag, sub = F("seguibl.ttf", 300), F("seguibl.ttf", 110), F("seguisb.ttf", 60), F("seguisb.ttf", 44)
halo = Image.new("L", im.size, 0); hd = ImageDraw.Draw(halo); hd.rounded_rectangle([40, 60, 1000, 770], 60, fill=170); halo = halo.filter(ImageFilter.GaussianBlur(70))
im = Image.composite(Image.new("RGB", im.size, (246, 242, 233)), im, halo)
d = ImageDraw.Draw(im); ink = (43, 42, 39)
d.text((96, 60), "448", font=big, fill=ink); d.text((640, 222), "PAGES", font=unit, fill=ink)
t = "IS TRUMP A RUSSIAN ASSET?"; tw = d.textlength(t, font=tag); d.rectangle([96, 450, 96 + tw + 56, 450 + 100], fill=ink); d.text((124, 462), t, font=tag, fill=(255, 255, 255))
t2 = "WHAT THE PUBLIC RECORD SHOWS"; tw2 = d.textlength(t2, font=sub); d.rectangle([96, 578, 96 + tw2 + 44, 578 + 74], fill=(200, 38, 29)); d.text((118, 588), t2, font=sub, fill=(255, 255, 255))
im.save(OUT / "trump_v4_thumb_1920.png"); im.resize((1280, 720), Image.LANCZOS).save(OUT / "trump_v4_thumb.jpg", quality=92)
print("wrote", OUT / "trump_v4_thumb.jpg")
