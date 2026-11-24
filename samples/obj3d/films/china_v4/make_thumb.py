# Thumbnail for China v4 (same method as films/nvidia_v4/make_thumb.py: a frame of the film + one number hook + one label tag).
# Usage: python make_thumb.py <still.jpg> [subject_x subject_y] -> out/china_v4_thumb.jpg (1280x720) + out/china_v4_thumb_1920.png
# Style (memory thumbnail-reference-patterns): monochrome world, the ONE red subject, big black number top-left, a dark label tag. No faces.
# Hook (fresh for this film): "200,000,000" knock-off phones a year (script L14: "more than two hundred million ... in 2010"), tag "THE COPY SHOP".
import sys, pathlib
from PIL import Image, ImageDraw, ImageFont, ImageFilter
OUT = pathlib.Path(__file__).resolve().parents[2] / "out"
src = Image.open(sys.argv[1]).convert("RGB").resize((1920, 1080)); cx, cy = (float(v) for v in (sys.argv[2:4] if len(sys.argv) > 3 else (1200, 560)))
x0, y0 = int(cx - 1300 * 0.625), int(cy - 560 * 0.625); x0 = max(0, min(x0, 1920 - 1200)); y0 = max(0, min(y0, 1080 - 675))
im = src.crop((x0, y0, x0 + 1200, y0 + 675)).resize((1920, 1080), Image.LANCZOS)   # 1.6x, subject right of the text block
F = lambda name, size: ImageFont.truetype(f"C:/Windows/Fonts/{name}", size)
big, unit, tag, sub = F("seguibl.ttf", 250), F("seguibl.ttf", 96), F("seguisb.ttf", 62), F("seguisb.ttf", 44)
halo = Image.new("L", im.size, 0); hd = ImageDraw.Draw(halo); hd.rounded_rectangle([40, 60, 960, 770], 60, fill=170); halo = halo.filter(ImageFilter.GaussianBlur(70))
im = Image.composite(Image.new("RGB", im.size, (246, 242, 233)), im, halo)
d = ImageDraw.Draw(im); ink = (43, 42, 39)
d.text((90, 60), "200M", font=big, fill=ink); d.text((100, 330), "COPIES A YEAR", font=unit, fill=ink)
t = "HOW CHINA COPIED"; tw = d.textlength(t, font=tag); d.rectangle([96, 480, 96 + tw + 56, 480 + 104], fill=ink); d.text((124, 492), t, font=tag, fill=(255, 255, 255))
t2 = "NOW FORD COPIES CHINA"; tw2 = d.textlength(t2, font=sub); d.rectangle([96, 610, 96 + tw2 + 44, 610 + 74], fill=(200, 38, 29)); d.text((118, 620), t2, font=sub, fill=(255, 255, 255))
im.save(OUT / "china_v4_thumb_1920.png"); im.resize((1280, 720), Image.LANCZOS).save(OUT / "china_v4_thumb.jpg", quality=92)
print("wrote", OUT / "china_v4_thumb.jpg")
