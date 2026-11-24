"""Depth + background layer for a 2.5D set plate.
Usage: depth.py <plate.png>  -> writes <name>_depth.png (16-bit, near=bright), <name>_bg.png (occluder-filled colour),
<name>_bgdepth.png (16-bit). Depth Anything V2 Small (Apache-2.0), offline HF cache. numpy-only inpaint (push-pull)."""
import os, sys, time
os.environ.setdefault("HF_HUB_OFFLINE", "1")
import numpy as np, torch
from PIL import Image
from transformers import AutoImageProcessor, AutoModelForDepthEstimation

t0 = time.time()
src = sys.argv[1]; stem = os.path.splitext(src)[0]
img = Image.open(src).convert("RGB"); W, H = img.size
mid = "depth-anything/Depth-Anything-V2-Small-hf"
proc = AutoImageProcessor.from_pretrained(mid); model = AutoModelForDepthEstimation.from_pretrained(mid).cuda().eval()
with torch.no_grad():
    inp = proc(images=img, return_tensors="pt").to("cuda")
    pred = model(**inp).predicted_depth[None]
    d = torch.nn.functional.interpolate(pred, size=(H, W), mode="bicubic", align_corners=False)[0, 0].float().cpu().numpy()
d = (d - np.percentile(d, 0.5)) / (np.percentile(d, 99.5) - np.percentile(d, 0.5)); d = np.clip(d, 0, 1)  # disparity, 1 = near

def minfilter(a, r):
    out = a.copy()
    for dy in range(-r, r + 1, max(1, r // 6)):
        for dx in range(-r, r + 1, max(1, r // 6)):
            out = np.minimum(out, np.roll(np.roll(a, dy, 0), dx, 1))
    return out

def pushpull(a, valid):
    """fill invalid pixels by multiscale averaging of valid ones"""
    if min(a.shape[:2]) < 4:
        m = valid[..., None] if a.ndim == 3 else valid
        s = (a * m).sum((0, 1)); n = max(m.sum(), 1); return np.where(m, a, s / n)
    h, w = a.shape[:2]; h2, w2 = (h + 1) // 2, (w + 1) // 2
    pa = np.zeros((h2 * 2, w2 * 2) + a.shape[2:], np.float32); pv = np.zeros((h2 * 2, w2 * 2), np.float32)
    pa[:h, :w] = a; pv[:h, :w] = valid
    m = pv[..., None] if a.ndim == 3 else pv
    sa = (pa * m).reshape(h2, 2, w2, 2, *a.shape[2:]).sum((1, 3)); sv = pv.reshape(h2, 2, w2, 2).sum((1, 3))
    small = sa / np.maximum(sv if a.ndim == 2 else sv[..., None], 1e-6)
    small = pushpull(small, sv > 0)
    if a.ndim == 2: up = np.asarray(Image.fromarray(small.astype(np.float32), "F").resize((w, h), Image.BILINEAR))
    else: up = np.stack([np.asarray(Image.fromarray(small[..., c].astype(np.float32), "F").resize((w, h), Image.BILINEAR)) for c in range(a.shape[2])], -1)
    vm = valid if a.ndim == 2 else valid[..., None]
    return np.where(vm, a, up)

# background = farthest depth nearby; where the plate is much nearer than that, the pixel belongs to an occluder edge
bgd = minfilter(d, 18)
occl = (d - bgd) > 0.04
for _ in range(8): occl = occl | np.roll(occl, 1, 0) | np.roll(occl, -1, 0) | np.roll(occl, 1, 1) | np.roll(occl, -1, 1)
col = np.asarray(img, np.float32) / 255
bgcol = pushpull(col, ~occl); bgd2 = np.minimum(pushpull(np.where(occl, 0, d), ~occl), d)  # never in front of the plate

save16 = lambda a, p: Image.fromarray((np.clip(a, 0, 1) * 65535).astype(np.uint16)).save(p)
save16(d, stem + "_depth.png"); save16(bgd2, stem + "_bgdepth.png")
d.astype(np.float32).tofile(stem + "_depth.f32"); bgd2.astype(np.float32).tofile(stem + "_bgdepth.f32")
Image.fromarray((np.clip(bgcol, 0, 1) * 255).astype(np.uint8)).save(stem + "_bg.png")
print(f"depth done {W}x{H} occluder px {occl.mean():.1%} in {time.time()-t0:.1f}s")
