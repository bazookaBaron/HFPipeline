# Thumbnail for the Nvidia film (same method as Malacca: a frame of the film itself + one number hook + one label tag).
# Usage: python make_thumb.py <still.jpg> [subject_x subject_y]  -> out/nvidia_thumb.jpg (1280x720) + out/nvidia_thumb_1920.png
# Style (memory thumbnail-reference-patterns): monochrome world, the ONE red subject, big black number top-left, a dark label tag. No faces.
import sys, pathlib
from PIL import Image, ImageDraw, ImageFont, ImageFilter
OUT = pathlib.Path(__file__).resolve().parents[2] / "out"
src = Image.open(sys.argv[1]).convert("RGB").resize((1920, 1080)); cx, cy = (float(v) for v in (sys.argv[2:4] if len(sys.argv) > 3 else (930, 560)))   # subject centre in the still
im = src.crop((int(cx - 1300 * 0.625), int(cy - 620 * 0.625), int(cx - 1300 * 0.625) + 1200, int(cy - 620 * 0.625) + 675)).resize((1920, 1080), Image.LANCZOS)   # 1.6x, subject lands right of the text block
F = lambda name, size: ImageFont.truetype(f"C:/Windows/Fonts/{name}", size)
big, unit, tag = F("seguibl.ttf", 330), F("seguibl.ttf", 120), F("seguisb.ttf", 62)
# soft paper halo behind the text block so the number reads at phone size (no glow on the number itself)
halo = Image.new("L", im.size, 0); hd = ImageDraw.Draw(halo); hd.rounded_rectangle([40, 70, 880, 760], 60, fill=150); halo = halo.filter(ImageFilter.GaussianBlur(70))
im = Image.composite(Image.new("RGB", im.size, (246, 242, 233)), im, halo)
d = ImageDraw.Draw(im); ink = (43, 42, 39)
d.text((96, 70), "5", font=big, fill=ink); d.text((330, 270), "DAYS", font=unit, fill=ink)
t = "NVIDIA'S FOUNDER: OUT"; tw = d.textlength(t, font=tag); d.rectangle([96, 470, 96 + tw + 56, 470 + 104], fill=ink); d.text((124, 482), t, font=tag, fill=(255, 255, 255))
t2 = "ALLEGED SPY · EXPORT CHIPS"; tw2 = d.textlength(t2, font=F("seguisb.ttf", 44)); d.rectangle([96, 600, 96 + tw2 + 44, 600 + 74], fill=(200, 38, 29)); d.text((118, 610), t2, font=F("seguisb.ttf", 44), fill=(255, 255, 255))
im.save(OUT / "nvidia_thumb_1920.png"); im.resize((1280, 720), Image.LANCZOS).save(OUT / "nvidia_thumb.jpg", quality=92)
print("wrote", OUT / "nvidia_thumb.jpg")
