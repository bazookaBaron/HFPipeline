# 30fps frame strip for a time window: python strip.py KEY T0 T1  -> KEY_strip_T0.jpg (every frame, labelled, 5 per row)
import sys, subprocess, os, glob, tempfile
from PIL import Image, ImageDraw, ImageFont
V = {"R1_DdEedoQM6j3": "C:/Users/debna/Downloads/igexport-DdEedoQM6j3.mp4", "R2_DdG-RuwsDRc": "C:/Users/debna/Downloads/igexport-DdG-RuwsDRc.mp4",
     "R3_DdSc-I9IqNC": "C:/Users/debna/Downloads/igexport-DdSc-I9IqNC.mp4", "R4_DdT5wzdsQWV": "C:/Users/debna/Downloads/igexport-DdT5wzdsQWV.mp4",
     "R5_DdIM0QoiZre": "C:/Users/debna/Downloads/igexport-DdIM0QoiZre.mp4", "OURS": "C:/Repos/HFPipleine/control-panel/data/renders/cs-b9d30fa7964c0cf0.mp4"}
key, t0, t1 = sys.argv[1], float(sys.argv[2]), float(sys.argv[3])
crop = sys.argv[4] if len(sys.argv) > 4 else None  # optional ffmpeg crop in fractions "x,y,w,h"
d = tempfile.mkdtemp()
vf = "scale=270:480"
if crop:
    x, y, w, h = map(float, crop.split(",")); vf = f"crop=iw*{w}:ih*{h}:iw*{x}:ih*{y},scale=270:-2"
subprocess.run(["ffmpeg", "-v", "error", "-ss", f"{t0}", "-i", V[key], "-t", f"{t1 - t0}", "-vf", vf, "-q:v", "3", f"{d}/%04d.jpg"], check=True)
fr = sorted(glob.glob(f"{d}/*.jpg")); im0 = Image.open(fr[0]); cw, ch = im0.size; cols = 5
rows = (len(fr) + cols - 1) // cols
sheet = Image.new("RGB", (cols * cw, rows * (ch + 18)), (255, 0, 255)); dr = ImageDraw.Draw(sheet); font = ImageFont.truetype("arial.ttf", 14)
for i, f in enumerate(fr):
    x = (i % cols) * cw; y = (i // cols) * (ch + 18)
    sheet.paste(Image.open(f), (x, y + 18)); dr.rectangle([x, y, x + cw - 1, y + 17], fill=(0, 0, 0))
    dr.text((x + 3, y + 1), f"{t0 + i / 30:.3f}s f{i}", fill=(255, 255, 0), font=font)
out = f"{key}_strip_{t0:07.3f}.jpg"; sheet.save(out, quality=85); print(out, len(fr), "frames")
