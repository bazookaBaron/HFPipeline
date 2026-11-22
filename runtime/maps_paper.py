"""Build step for maps.js skin:"paper" (Doc2D paper-cut collage maps).  Bakes the static world once, so the comp only moves images:

  sea   opaque tiles: depth-tone bands (stacked paper sheets) with a soft shadow under each shallower sheet, painted tonal drift
  land  RGBA tiles:   one cut-paper sheet per country (slight per-sheet tint), seams, lit/shaded cut edge, NE SR_50M relief,
                      fibre grain, and the sheet's soft offset shadow on the sea (alpha)
  shimmer.webp        seamless sea-glint tile (animated by maps.js), globe-sea.webp equirect bands for the globe

    python runtime/maps_paper.py <SR_50M.tif> [ne_10m_admin_0_countries_ind.geojson]
      -> runtime/geo/relief/{pl_*.webp, ps_*.webp, p_lo_land.webp, p_lo_sea.webp, shimmer.webp}
         + window.MAPS_PAPER appended to runtime/geo/relief/relief.js (build.js already ships that folder + file)
Same grid as maps_relief.py (Natural Earth I, 5000 units/rad, y down). Public-domain Natural Earth data only.
"""
import base64, hashlib, io, json, math, os, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy import ndimage

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import maps_relief as MR  # noqa: E402

Image.MAX_IMAGE_PIXELS = None
S = MR.S
HERE = os.path.dirname(os.path.abspath(__file__))
REL = os.path.join(HERE, "geo", "relief")
GEO = os.path.join(HERE, "..", "orchestrator", "output", ".cache", "geo", "ne_10m_admin_0_countries_ind.geojson")
UPP, LO_UPP, TILE, PAD, SS = 2.6, 13.0, 1024, 40, 2
DF_UPP = 3.25  # global distance-field resolution
PAPER = np.array([243, 234, 216], np.float32)
SEAM = np.array([168, 150, 124], np.float32)
NAVY = np.array([19, 34, 59], np.float32)
# depth bands: upper edge in projected units (1 unit ~ 1.27 km) and colour, shallow -> deep
BANDS = [(16, (196, 226, 226)), (45, (170, 212, 218)), (100, (140, 192, 207)), (200, (112, 168, 192)), (1e9, (92, 148, 178))]


def ne1(lon, lat):
    lam = np.radians(lon); phi = np.radians(lat)
    return lam * MR.ne1_xk(phi) * S, -MR.ne1_y(phi) * S


def load_polys(path):
    gj = json.load(open(path, encoding="utf8")); out = []
    for f in gj["features"]:
        p = f["properties"]; k = p.get("ISO_A3_EH")
        if not k or k == "-99": k = p.get("ADM0_A3")
        if k == "ATA": continue
        g = f["geometry"]; polys = g["coordinates"] if g["type"] == "MultiPolygon" else [g["coordinates"]]
        h = int(hashlib.md5(k.encode()).hexdigest()[:8], 16)
        tint = np.array([((h >> s) & 255) / 255 - 0.5 for s in (0, 8, 16)], np.float32)
        col = PAPER * (1 + 0.035 * tint[0]) + np.array([4, 2, -3], np.float32) * tint[1] * 2
        for poly in polys:
            rings = []
            for ring in poly:
                a = np.asarray(ring, np.float64); x, y = ne1(a[:, 0], a[:, 1]); rings.append(np.stack([x, y], 1))
            bb = (rings[0][:, 0].min(), rings[0][:, 1].min(), rings[0][:, 0].max(), rings[0][:, 1].max())
            out.append((k, rings, bb, tuple(int(v) for v in np.clip(col, 0, 255))))
    return out


def raster(polys, x0, y0, w, h, upp, ss, mode):
    """mode 'mask' -> L land mask; 'rgb' -> country sheet colours + seams. Supersampled ss x, then box-downsampled."""
    W, H = w * ss, h * ss; k = 1.0 / (upp / ss)
    im = Image.new("L" if mode == "mask" else "RGB", (W, H), 0 if mode == "mask" else tuple(int(v) for v in PAPER))
    dr = ImageDraw.Draw(im); x1, y1 = x0 + w * upp, y0 + h * upp
    sa = 1.0 if upp < 6 else 0.45; seam = tuple(int(v) for v in PAPER * (1 - sa) + SEAM * sa)
    for k_, rings, bb, col in polys:
        if bb[2] < x0 or bb[0] > x1 or bb[3] < y0 or bb[1] > y1: continue
        for i, r in enumerate(rings):
            pts = [((px - x0) * k, (py - y0) * k) for px, py in r]
            if len(pts) < 3: continue
            fill = (255 if i == 0 else 0) if mode == "mask" else (col if i == 0 else tuple(int(v) for v in PAPER))
            dr.polygon(pts, fill=fill)
        if mode == "rgb":
            for r in rings[:1]:
                pts = [((px - x0) * k, (py - y0) * k) for px, py in r]
                if len(pts) >= 3: dr.line(pts + [pts[0]], fill=seam, width=max(1, int(round(1.1 * ss))))
    return im.resize((w, h), Image.BOX)


def grain_tile(n=1024, seed=11):
    rng = np.random.default_rng(seed); z = rng.normal(0, 1, (n, n)).astype(np.float32); big = np.tile(z, (3, 3))
    def blur(r): return ndimage.gaussian_filter(big, r, mode="wrap")[n:2 * n, n:2 * n]
    fib = ndimage.gaussian_filter(big, (0.6, 3.5), mode="wrap")[n:2 * n, n:2 * n]  # horizontal fibres
    g = 0.45 * blur(0.8) / blur(0.8).std() + 0.35 * fib / fib.std() + 0.5 * blur(14) / blur(14).std()
    return g / g.std()


GRAIN = None


def grain_at(w, h, ox, oy):
    reps = np.tile(GRAIN, (h // GRAIN.shape[0] + 2, w // GRAIN.shape[1] + 2))
    ox %= GRAIN.shape[1]; oy %= GRAIN.shape[0]
    return reps[oy:oy + h, ox:ox + w]


def sea_rgb(d, upp, grain, lowf):
    """d: distance to land in projected units (float array)."""
    out = np.zeros(d.shape + (3,), np.float32); lo = 0.0
    for i, (hi, col) in enumerate(BANDS):
        m = (d >= lo) & (d < hi)
        c = np.array(col, np.float32)
        shade = 1.0
        if i > 0:  # shadow cast by the shallower sheet onto this one
            dd = (d - lo) / max(upp, 1.2)
            shade = 1 - 0.13 * np.exp(-dd / 2.6) - 0.05 * np.exp(-dd / 9)
        hl = 0.0
        if i < len(BANDS) - 1:  # lit cut edge of this sheet
            ee = np.minimum((hi - d) / max(upp, 1.2), 60); hl = 0.10 * np.exp(-ee / 1.1)
        v = c[None, :] * (shade if np.isscalar(shade) else shade[..., None])
        v = v + (255 - v) * (hl if np.isscalar(hl) else hl[..., None])
        out[m] = v[m] if v.ndim == 3 else v
        lo = hi
    out *= (1 + 0.035 * lowf[..., None] + 0.012 * grain[..., None])
    return np.clip(out, 0, 255).astype(np.uint8)


def land_rgba(rgb, mask, relief, grain, upp):
    m = mask.astype(np.float32) / 255
    col = rgb.astype(np.float32)
    # relief (tone: 255 flat .. darker in shadow) -> warm umber multiply
    r = 1 - (1 - relief / 255.0) * (0.5 if upp < 6 else 0.3)
    col = col * r[..., None] + np.array([74, 58, 44], np.float32) * (1 - r[..., None]) * 0.25
    col *= (1 + 0.035 * grain[..., None])
    # cut edge: light top-left rim, darker bottom-right paper thickness
    px = max(1, int(round(1.6)))
    up = np.roll(np.roll(m, px, 0), px, 1); dn = np.roll(np.roll(m, -px, 0), -px, 1)
    lit = np.clip(m - up, 0, 1); dark = np.clip(m - dn, 0, 1)
    col = col + (255 - col) * (0.55 * lit)[..., None]; col = col * (1 - 0.28 * dark)[..., None]
    # sheet shadow on the sea: offset + soft
    sh = ndimage.shift(m, (5.0, 3.0), order=1, mode="constant")
    sh = ndimage.gaussian_filter(sh, 3.2) * 0.36 + ndimage.gaussian_filter(ndimage.shift(m, (2.0, 1.2), order=1), 1.0) * 0.22
    sa = np.clip(sh, 0, 0.5) * (1 - m)
    a = m + sa
    rgbo = (col * m[..., None] + NAVY * sa[..., None]) / np.maximum(a, 1e-4)[..., None]
    return np.dstack([np.clip(rgbo, 0, 255), np.clip(a * 255, 0, 255)]).astype(np.uint8)


def main():
    global GRAIN
    src = np.asarray(Image.open(sys.argv[1]).convert("L"), dtype=np.float32)
    polys = load_polys(sys.argv[2] if len(sys.argv) > 2 else GEO)
    GRAIN = grain_tile()
    X0 = -math.pi * 0.8707 * S; Y0 = -MR.ne1_y(math.radians(MR.LAT_MAX)) * S; Y1 = -MR.ne1_y(math.radians(MR.LAT_MIN)) * S
    TW, TH = -2 * X0, Y1 - Y0
    # global distance field (projected units) at DF_UPP, padded so tiles near the edges sample cleanly
    dw, dh = int(TW / DF_UPP), int(TH / DF_UPP)
    mask_g = np.asarray(raster(polys, X0, Y0, dw, dh, DF_UPP, 1, "mask"), np.float32) > 127
    dist = ndimage.gaussian_filter(ndimage.distance_transform_edt(~mask_g) * DF_UPP, 2.2)  # smoothed: band edges stay round, no EDT stair-steps
    lowf_g = ndimage.gaussian_filter(np.random.default_rng(3).normal(0, 1, (dh // 8 + 2, dw // 8 + 2)), 2.5)
    lowf_g /= lowf_g.std()

    def field(x0, y0, w, h, upp):
        gx = (x0 + (np.arange(w) + 0.5) * upp - X0) / DF_UPP - 0.5
        gy = (y0 + (np.arange(h) + 0.5) * upp - Y0) / DF_UPP - 0.5
        GX, GY = np.meshgrid(gx, gy)
        d = ndimage.map_coordinates(dist, [GY, GX], order=1, mode="nearest")
        lf = ndimage.map_coordinates(lowf_g, [GY / 8, GX / 8], order=1, mode="nearest")
        return d, lf

    meta = {"source": "Natural Earth 10m admin-0 (India POV) + SR_50M relief, public domain", "lo": None, "tiles": []}

    def bake(x0, y0, w, h, upp, name_l, name_s, pad):
        bx, by, bw, bh = x0 - pad * upp, y0 - pad * upp, w + 2 * pad, h + 2 * pad
        mask = np.asarray(raster(polys, bx, by, bw, bh, upp, SS, "mask"))
        rgb = np.asarray(raster(polys, bx, by, bw, bh, upp, SS, "rgb"))
        rel = MR.tone(MR.render(src, upp, bx, by, bw, bh)).astype(np.float32)
        gr = grain_at(bw, bh, int(bx / upp), int(by / upp))
        d, lf = field(bx, by, bw, bh, upp)
        sea = sea_rgb(d, upp, gr, lf)[pad:pad + h, pad:pad + w]
        land = land_rgba(rgb, mask, rel, gr, upp)[pad:pad + h, pad:pad + w]
        Image.fromarray(sea, "RGB").save(os.path.join(REL, name_s), "WEBP", quality=82, method=6)
        has = land[..., 3].max() > 4
        if has: Image.fromarray(land, "RGBA").save(os.path.join(REL, name_l), "WEBP", quality=80, alpha_quality=85, method=6)
        return has

    lw, lh = int(TW / LO_UPP), int(TH / LO_UPP)
    GONLY = os.environ.get("PAPER_GLOBE_ONLY")  # re-bake only the globe textures; keep the tiles + their manifest
    if GONLY:
        old = json.loads(open(os.path.join(REL, "relief.js")).read().split("window.MAPS_PAPER=")[1].rstrip().rstrip(";"))
        meta["lo"], meta["tiles"] = old["lo"], old["tiles"]
    if not GONLY: bake(X0, Y0, lw, lh, LO_UPP, "p_lo_land.webp", "p_lo_sea.webp", PAD)
    meta["lo"] = {"l": "p_lo_land.webp", "s": "p_lo_sea.webp", "x": round(X0, 1), "y": round(Y0, 1), "w": round(lw * LO_UPP, 1), "h": round(lh * LO_UPP, 1)}
    span = TILE * UPP; nc, nr = math.ceil(TW / span), math.ceil(TH / span)
    TEST = os.environ.get("PAPER_TEST")  # "c,r": bake only that hi tile (look test)
    for r in range(nr):
        for c in range(nc):
            if GONLY or (TEST and TEST != f"{c},{r}"): continue
            x0, y0 = X0 + c * span, Y0 + r * span
            has = bake(x0, y0, TILE, TILE, UPP, f"pl_{c}_{r}.webp", f"ps_{c}_{r}.webp", PAD)
            meta["tiles"].append({"l": f"pl_{c}_{r}.webp" if has else None, "s": f"ps_{c}_{r}.webp", "x": round(x0, 1), "y": round(y0, 1), "w": round(span, 1), "h": round(span, 1)})
            print("tile", c, r, has, flush=True)
    # shimmer: seamless soft glints (white, alpha), 512 px
    n = 512; rng = np.random.default_rng(21); z = rng.normal(0, 1, (n, n)); big = np.tile(z, (3, 3))
    a = ndimage.gaussian_filter(big, (1.6, 7.0), mode="wrap")[n:2 * n, n:2 * n]; a = (a - a.mean()) / a.std()
    gl = np.clip((a - 1.7) / 1.3, 0, 1) ** 1.5 * 150
    Image.fromarray(np.dstack([np.full((n, n), 255), np.full((n, n), 255), np.full((n, n), 252), gl]).astype(np.uint8), "RGBA").save(os.path.join(REL, "shimmer.webp"), "WEBP", quality=80, alpha_quality=80)
    # globe sea: equirect 2048x1024 bands (data URI, so the globe canvas can read it without tainting)
    gw, gh = 2048, 1024
    lon = -180 + (np.arange(gw) + 0.5) * 360 / gw; lat = 90 - (np.arange(gh) + 0.5) * 180 / gh
    LON, LAT = np.meshgrid(lon, np.clip(lat, -85, 84)); px, py = ne1(LON, LAT)
    d = ndimage.map_coordinates(dist, [(py - Y0) / DF_UPP - 0.5, (px - X0) / DF_UPP - 0.5], order=1, mode="nearest")
    d[LAT < MR.LAT_MIN] = 1e6
    gsea = sea_rgb(d, 360 / gw * 87, np.zeros_like(d), np.zeros_like(d))
    buf = io.BytesIO(); Image.fromarray(gsea, "RGB").save(buf, "WEBP", quality=80); meta["globeSea"] = "data:image/webp;base64," + base64.b64encode(buf.getvalue()).decode()
    # globe distance texture: sqrt-encoded distance-to-land (0..400 units), so the globe colours its depth bands per pixel and the
    # band edges stay smooth at any zoom (the colour texture above stair-steps when magnified)
    gw2, gh2 = 4096, 2048
    lon = -180 + (np.arange(gw2) + 0.5) * 360 / gw2; lat = 90 - (np.arange(gh2) + 0.5) * 180 / gh2
    LON, LAT = np.meshgrid(lon, np.clip(lat, -85, 84)); px, py = ne1(LON, LAT)
    d2 = ndimage.map_coordinates(dist, [(py - Y0) / DF_UPP - 0.5, (px - X0) / DF_UPP - 0.5], order=1, mode="nearest"); d2[LAT < MR.LAT_MIN] = 400
    v = (np.sqrt(np.clip(d2, 0, 400) / 400) * 255).round().astype(np.uint8)
    buf = io.BytesIO(); Image.fromarray(v, "L").save(buf, "PNG", optimize=True); meta["globeDist"] = "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()
    meta["bands"] = [[b[0] if b[0] < 1e8 else 1e6, list(b[1])] for b in BANDS]
    meta["shimmer"] = "shimmer.webp"
    js = os.path.join(REL, "relief.js"); cur = open(js).read().split("\nwindow.MAPS_PAPER=")[0].rstrip("\n")
    open(js, "w").write(cur + "\nwindow.MAPS_PAPER=" + json.dumps(meta, separators=(",", ":")) + ";\n")
    tot = sum(os.path.getsize(os.path.join(REL, f)) for f in os.listdir(REL) if f.startswith(("pl_", "ps_", "p_lo", "shimmer")))
    print("paper tiles", len(meta["tiles"]), "bytes", tot, "globeSea", len(meta["globeSea"]), "globeDist", len(meta["globeDist"]))


if __name__ == "__main__":
    main()
