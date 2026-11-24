# Thumbnail for the Trump-Russia evidence-trial film (same method as Malacca / Nvidia: a frame of the film itself + one number hook + label tags).
# Usage: python make_thumb.py <still.jpg> [subject_x subject_y]  -> out/trump_thumb.jpg (1280x720) + out/trump_thumb_1920.png
# Style (memory thumbnail-reference-patterns): monochrome world, the ONE red subject, big black number, dark label tag. No faces.
# Wording is a question + "the evidence", never a statement of fact about a person.
import sys, pathlib
from PIL import Image, ImageDraw, ImageFont, ImageFilter
OUT = pathlib.Path(__file__).resolve().parents[2] / "out"
src = Image.open(sys.argv[1]).convert("RGB").resize((1920, 1080)); cx, cy = (float(v) for v in (sys.argv[2:4] if len(sys.argv) > 3 else (960, 560)))
x0, y0 = int(cx - 1300 * 0.625), int(cy - 620 * 0.625)
x0, y0 = max(0, min(1920 - 1200, x0)), max(0, min(1080 - 675, y0))
im = src.crop((x0, y0, x0 + 1200, y0 + 675)).resize((1920, 1080), Image.LANCZOS)   # 1.6x, subject lands right of the text block
F = lambda name, size: ImageFont.truetype(f"C:/Windows/Fonts/{name}", size)
big, unit, tag, tag2 = F("seguibl.ttf", 330), F("seguibl.ttf", 120), F("seguisb.ttf", 62), F("seguisb.ttf", 44)
halo = Image.new("L", im.size, 0); hd = ImageDraw.Draw(halo); hd.rounded_rectangle([40, 70, 1010, 760], 60, fill=150); halo = halo.filter(ImageFilter.GaussianBlur(70))
im = Image.composite(Image.new("RGB", im.size, (246, 242, 233)), im, halo)
d = ImageDraw.Draw(im); ink = (43, 42, 39)
d.text((96, 70), "448", font=big, fill=ink); d.text((650, 270), "PAGES", font=unit, fill=ink)
t = "IS TRUMP A RUSSIAN ASSET?"; tw = d.textlength(t, font=tag); d.rectangle([96, 470, 96 + tw + 56, 470 + 104], fill=ink); d.text((124, 482), t, font=tag, fill=(255, 255, 255))
t2 = "THE EVIDENCE, STAMPED"; tw2 = d.textlength(t2, font=tag2); d.rectangle([96, 600, 96 + tw2 + 44, 600 + 74], fill=(200, 38, 29)); d.text((118, 610), t2, font=tag2, fill=(255, 255, 255))
im.save(OUT / "trump_thumb_1920.png"); im.resize((1280, 720), Image.LANCZOS).save(OUT / "trump_thumb.jpg", quality=92)
print("wrote", OUT / "trump_thumb.jpg")
