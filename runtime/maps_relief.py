"""Build step for maps.js skin:"atlas": Natural Earth SR_50M shaded relief (public domain, naturalearthdata.com)
reprojected into maps.js space (Natural Earth I, 5000 units/rad, y down) and tiled as WebP "shadow" layers (dark tint,
alpha = shadow depth) drawn over paper land; normal compositing of that equals a multiply blend. Flat ground -> clear.

    python runtime/maps_relief.py <SR_50M.tif>     -> runtime/geo/relief/{lo.webp, t_<c>_<r>.webp, relief.json, relief.js}
                                                    + runtime/geo/paper.jpg (paper grain tile)
"""
import json, math, os, sys
import numpy as np
from PIL import Image, ImageFilter

Image.MAX_IMAGE_PIXELS = None
S = 5000.0
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "geo")
UPP = 2.6        # hi tier: projected units per pixel (~source resolution at the equator)
LO_UPP = 13.0    # world tier
TILE = 1024
LAT_MIN, LAT_MAX = -60.0, 84.0
FLAT, GAMMA = 206.0, 1.9  # SR_50M flat/water grey; shadow contrast (tone down at runtime with reliefAmt)


def ne1_y(phi):
    p2 = phi * phi; p4 = p2 * p2
    return phi * (1.007226 + 0.015085 * p2 - 0.044475 * p2 * p4 + 0.028874 * p4 * p4 - 0.005916 * p2 * p4 * p4)


def ne1_xk(phi):
    p2 = phi * phi; p4 = p2 * p2
    return 0.8707 - 0.131979 * p2 - 0.013791 * p4 + 0.003971 * p2 * p4 * p4 - 0.001529 * p4 * p4 * p4


def inv_phi(y):  # Newton on y(phi) = y
    phi = y.copy()
    for _ in range(8):
        h = 1e-6
        f = ne1_y(phi) - y
        d = (ne1_y(phi + h) - ne1_y(phi - h)) / (2 * h)
        phi = phi - f / d
    return phi


def render(src, upp, x0, y0, w, h):
    """Return uint8 (h, w) of src (equirect, 1/30 deg) sampled on the projected grid."""
    xs = (x0 + (np.arange(w) + 0.5) * upp) / S
    ys = -(y0 + (np.arange(h) + 0.5) * upp) / S  # y down -> phi up
    phi = inv_phi(ys)[:, None]
    lam = xs[None, :] / ne1_xk(phi)
    lat = np.degrees(phi); lon = np.degrees(lam)
    ok = (np.abs(lon) <= 180) & (lat <= 90) & (lat >= -90)
    H, W = src.shape
    px = np.clip((lon + 180) / 360 * W - 0.5, 0, W - 1.001)
    py = np.clip((90 - lat) / 180 * H - 0.5, 0, H - 1.001)
    ix = px.astype(np.int64); iy = py.astype(np.int64); fx = px - ix; fy = py - iy
    a = src[iy, ix] * (1 - fx) + src[iy, ix + 1] * fx
    b = src[iy + 1, ix] * (1 - fx) + src[iy + 1, ix + 1] * fx
    v = a * (1 - fy) + b * fy
    v = np.where(ok, v, 255.0)
    return v


SHADE = (74, 58, 44)  # shadow tint (warm umber); alpha = shadow depth, so normal "over" == multiply by tone


def tone(v):
    v = np.clip(v / FLAT, 0, 1)            # flat -> 1, highlights clip to white
    v = v ** GAMMA
    return (v * 255).round().astype(np.uint8)


def save_shadow(t, f, q):
    a = 255 - t
    rgba = np.dstack([np.full_like(a, SHADE[0]), np.full_like(a, SHADE[1]), np.full_like(a, SHADE[2]), a])
    Image.fromarray(rgba, "RGBA").save(f, "WEBP", quality=q, alpha_quality=q, method=6)


def main():
    src = np.asarray(Image.open(sys.argv[1]).convert("L"), dtype=np.float32)
    rel = os.path.join(OUT, "relief"); os.makedirs(rel, exist_ok=True)
    X0 = -math.pi * 0.8707 * S
    Y0 = -ne1_y(math.radians(LAT_MAX)) * S
    Y1 = -ne1_y(math.radians(LAT_MIN)) * S
    TW, TH = -2 * X0, Y1 - Y0
    meta = {"source": "Natural Earth SR_50M shaded relief (public domain)", "projection": "naturalEarth1 5000/rad y-down",
            "lo": None, "tiles": []}
    lw, lh = int(TW / LO_UPP), int(TH / LO_UPP)
    lo = tone(render(src, LO_UPP, X0, Y0, lw, lh))
    save_shadow(lo, os.path.join(rel, "lo.webp"), 80)
    meta["lo"] = {"f": "lo.webp", "x": round(X0, 1), "y": round(Y0, 1), "w": round(lw * LO_UPP, 1), "h": round(lh * LO_UPP, 1)}
    span = TILE * UPP
    nc, nr = math.ceil(TW / span), math.ceil(TH / span)
    total = 0
    for r in range(nr):
        for c in range(nc):
            x0, y0 = X0 + c * span, Y0 + r * span
            t = tone(render(src, UPP, x0, y0, TILE, TILE))
            if t.min() > 246:  # nothing but flat/ocean
                continue
            f = f"t_{c}_{r}.webp"
            save_shadow(t, os.path.join(rel, f), 70)
            total += os.path.getsize(os.path.join(rel, f))
            meta["tiles"].append({"f": f, "x": round(x0, 1), "y": round(y0, 1), "w": round(span, 1), "h": round(span, 1)})
    json.dump(meta, open(os.path.join(rel, "relief.json"), "w"), separators=(",", ":"))
    with open(os.path.join(rel, "relief.js"), "w") as fh:
        fh.write("window.MAPS_RELIEF=" + json.dumps(meta, separators=(",", ":")) + ";\n")
    # paper grain: soft fibrous noise around mid grey-white, tiles seamlessly (wrap-blurred)
    rng = np.random.default_rng(7)
    n = rng.normal(0, 1, (512, 512)).astype(np.float32)
    big = np.tile(n, (3, 3))
    im = Image.fromarray(((big - big.min()) / (big.max() - big.min()) * 255).astype(np.uint8))
    a = np.asarray(im.filter(ImageFilter.GaussianBlur(1.1)), dtype=np.float32)[512:1024, 512:1024]
    b = np.asarray(im.filter(ImageFilter.GaussianBlur(9)), dtype=np.float32)[512:1024, 512:1024]
    g = (a - a.mean()) / a.std() * 0.55 + (b - b.mean()) / b.std() * 0.45
    paper = np.clip(236 + g * 9, 0, 255).astype(np.uint8)
    Image.fromarray(paper).save(os.path.join(OUT, "paper.jpg"), quality=82)
    print("lo", lw, lh, "tiles", len(meta["tiles"]), "of", nc * nr, "hi bytes", total)


if __name__ == "__main__":
    main()
