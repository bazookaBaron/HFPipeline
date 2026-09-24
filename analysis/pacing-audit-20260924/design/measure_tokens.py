"""Reproducible RGB census of settled native 720x1280 reference frames.

8-level channel bins reduce AAC/video compression speckle; exact sampled
pixel values are not presented as original design-file tokens.
"""
from collections import Counter
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent / "ref_frames"
FRAMES = (
    "R1_039.68_metrics-dashboard.png", "R2_060.00_router.png",
    "R3_093.00_terminal.png", "R4_109.00_multipart.png",
    "R4_149.00_final-architecture-settled.png",
    "R5_043.00_node-source.png", "R5_015.55_serif-hero.png",
)
SAMPLES = {
    "R1_039.68_metrics-dashboard.png": [("outer", 700, 1100), ("hud_fill", 350, 180), ("metric_card", 350, 575), ("caption_fill", 350, 985)],
    "R2_060.00_router.png": [("outer", 700, 1100), ("hud_fill", 350, 180), ("blue_card", 120, 800), ("green_card", 580, 800)],
    "R3_093.00_terminal.png": [("paper", 700, 1100), ("terminal_card", 450, 390), ("command_row", 350, 450)],
    "R4_149.00_final-architecture-settled.png": [("paper", 700, 1200), ("window_header", 300, 395), ("window_fill", 300, 470), ("api_chip", 560, 478)],
    "R5_043.00_node-source.png": [("outer", 700, 1100), ("object_panel", 500, 650), ("source_card", 350, 250)],
    "R5_015.55_serif-hero.png": [("outer", 700, 1100), ("framing_panel", 500, 500), ("caption_fill", 500, 990)],
}
ACCENT_ROIS = {
    "R1_039.68_metrics-dashboard.png": (210, 345, 680, 780),
    "R2_060.00_router.png": (40, 630, 680, 870),
    "R3_093.00_terminal.png": (210, 360, 670, 690),
    "R4_149.00_final-architecture-settled.png": (210, 380, 670, 840),
    "R5_043.00_node-source.png": (40, 180, 680, 750),
}


def palette(path):
    image = Image.open(path).convert("RGB")
    thumb = np.asarray(image.resize((270, 480), Image.Resampling.BOX))
    bins = ((thumb.astype(np.uint16) + 4) // 8 * 8).clip(0, 255).astype(np.uint8)
    colors = [tuple(row) for row in bins.reshape(-1, 3)]
    counts = Counter(colors)
    bright = lambda c: max(c) - min(c) >= 28 and max(c) >= 65
    fmt = lambda pair: f"#{pair[0][0]:02x}{pair[0][1]:02x}{pair[0][2]:02x}:{pair[1]}"
    return (image.size,
            [fmt(x) for x in counts.most_common(14)],
            [fmt(x) for x in counts.most_common() if bright(x[0])][:12])


for frame in FRAMES:
    size, main, accents = palette(ROOT / frame)
    print(frame, size)
    print("  top:", " ".join(main))
    print("  chromatic:", " ".join(accents))
    image = np.asarray(Image.open(ROOT / frame).convert("RGB"))
    for label, x, y in SAMPLES.get(frame, []):
        patch = image[max(0,y-3):y+4,max(0,x-3):x+4]
        rgb = np.median(patch.reshape(-1,3),axis=0).astype(int)
        print(f"  sample {label}@({x},{y}): #{rgb[0]:02x}{rgb[1]:02x}{rgb[2]:02x}")
    if frame in ACCENT_ROIS:
        x0,y0,x1,y1 = ACCENT_ROIS[frame]
        roi = image[y0:y1,x0:x1]
        reduced = ((roi[::2,::2].astype(np.uint16)+4)//8*8).clip(0,255).astype(np.uint8)
        counts = Counter(map(tuple,reduced.reshape(-1,3)))
        selected = [(c,n) for c,n in counts.most_common()
                    if max(c)-min(c)>=55 and max(c)>=100]
        print("  ROI accents:", " ".join(f"#{c[0]:02x}{c[1]:02x}{c[2]:02x}:{n}" for c,n in selected[:10]))
