# Contact sheets: 8 fps frames, 6 cols x 4 rows per sheet (3.0 s per sheet), timestamp burned in.
import sys, subprocess, os, glob
from PIL import Image, ImageDraw, ImageFont
key, path = sys.argv[1], sys.argv[2]
fps = 8; cw, chh = 180, 320; cols, rows = 6, 4
d = f"{key}_f8"; os.makedirs(d, exist_ok=True)
subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", path, "-vf", f"fps={fps},scale={cw}:{chh}", "-q:v", "3", f"{d}/%05d.jpg"], check=True)
frames = sorted(glob.glob(f"{d}/*.jpg"))
os.makedirs(f"{key}_sheets", exist_ok=True)
font = ImageFont.truetype("arial.ttf", 16)
per = cols * rows
for si in range(0, len(frames), per):
    sheet = Image.new("RGB", (cols * cw, rows * (chh + 20)), (255, 0, 255))
    dr = ImageDraw.Draw(sheet)
    for j, fp in enumerate(frames[si:si + per]):
        idx = si + j; t = idx / fps  # fps filter emits frame i at t=i/fps
        x = (j % cols) * cw; y = (j // cols) * (chh + 20)
        sheet.paste(Image.open(fp), (x, y + 20))
        dr.rectangle([x, y, x + cw - 1, y + 19], fill=(0, 0, 0))
        dr.text((x + 4, y + 1), f"{t:6.3f}s", fill=(255, 255, 0), font=font)
    t0 = si / fps
    sheet.save(f"{key}_sheets/sheet_{t0:07.2f}.jpg", quality=85)
print(key, len(frames), "frames ->", len(range(0, len(frames), per)), "sheets")
