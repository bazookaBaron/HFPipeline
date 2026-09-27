#!/usr/bin/env python3
"""
Build the compact vector-map assets (world-110m.json, world-50m.json) from the Natural Earth admin-0
countries India point-of-view GeoJSON at 1:10m (public domain; provenance in README.md). The file names keep
their old "110m" / "50m" names: they mean world detail / regional detail.

    python build_geo.py <ne_10m_admin_0_countries_ind.geojson>

Output per file:
  { "version": "geo.v1", "source": "...", "projection": "naturalEarth1", "scale": S,
    "extent": [x0, y0, x1, y1],                       # whole world, projected units (x right, y DOWN)
    "countries": { "<ISO3>": { "n": name, "a2": iso2, "d": svg path, "b": main bbox, "B": full bbox,
                               "P": [bbox per polygon] (view culling; the US spans the antimeridian), "c": label point } } }
Projected units = Natural Earth I projection (Savric et al. 2011) in radians * S, y flipped (SVG down),
rounded to integers. Paths are relative ("M x y l dx dy ... z") for size. `b` covers only the
polygons with >= 25 % of the country's largest polygon area or centred near it (France without French Guiana, the US
without Hawaii, ...), which is what a map zooms to. Deterministic: same input -> byte-identical output.
"""
import json
import math
import sys

import numpy as np


def ne1(lon, lat):
    """Natural Earth I projection; lon/lat in degrees (arrays) -> x, y in radians-units (y up)."""
    lam = np.radians(lon)
    phi = np.radians(lat)
    p2 = phi * phi
    p4 = p2 * p2
    x = lam * (0.870700 - 0.131979 * p2 - 0.013791 * p4 + 0.003971 * p2 * p4 * p4 - 0.001529 * p4 * p4 * p4)
    y = phi * (1.007226 + 0.015085 * p2 - 0.044475 * p2 * p4 + 0.028874 * p4 * p4 - 0.005916 * p2 * p4 * p4)
    return x, y


def dp(pts, tol):
    """Douglas-Peucker on an (n, 2) int array; keeps first/last."""
    n = len(pts)
    if n < 4 or tol <= 0:
        return pts
    keep = np.zeros(n, dtype=bool)
    keep[0] = keep[-1] = True
    stack = [(0, n - 1)]
    while stack:
        a, b = stack.pop()
        if b <= a + 1:
            continue
        seg = pts[a + 1 : b].astype(float)
        p, q = pts[a].astype(float), pts[b].astype(float)
        d = q - p
        L = math.hypot(d[0], d[1])
        if L == 0:
            dist = np.hypot(seg[:, 0] - p[0], seg[:, 1] - p[1])
        else:
            dist = np.abs(d[0] * (seg[:, 1] - p[1]) - d[1] * (seg[:, 0] - p[0])) / L
        i = int(np.argmax(dist))
        if dist[i] > tol:
            m = a + 1 + i
            keep[m] = True
            stack.append((a, m))
            stack.append((m, b))
    return pts[keep]


def ring_area(pts):
    x = pts[:, 0].astype(float)
    y = pts[:, 1].astype(float)
    return 0.5 * abs(np.dot(x, np.roll(y, -1)) - np.dot(y, np.roll(x, -1)))


def num_join(vals):
    out = ""
    for v in vals:
        s = str(int(v))
        out += s if (not out or s.startswith("-") or out[-1] in "Mlz") else " " + s
    return out


def encode(ring):
    # drop consecutive duplicates after rounding
    keep = np.ones(len(ring), dtype=bool)
    keep[1:] = np.any(ring[1:] != ring[:-1], axis=1)
    ring = ring[keep]
    if len(ring) > 1 and (ring[0] == ring[-1]).all():
        ring = ring[:-1]
    if len(ring) < 3:
        return ""
    s = "M" + num_join(ring[0])
    deltas = np.diff(ring, axis=0).reshape(-1)
    s += "l" + num_join(deltas) + "z"
    return s


def key_of(p):
    k = p.get("ISO_A3_EH")
    if not k or k == "-99":
        k = p.get("ADM0_A3")
    return {"KOS": "XKX"}.get(k, k)  # World Bank code for Kosovo


def build(src, scale, tol, min_area, label):
    gj = json.load(open(src, encoding="utf-8"))
    rows = {}
    for f in gj["features"]:
        p = f["properties"]
        k = key_of(p)
        g = f["geometry"]
        polys = g["coordinates"] if g["type"] == "MultiPolygon" else [g["coordinates"]]
        r = rows.setdefault(k, {"n": p.get("NAME") or p.get("NAME_EN"), "a2": (p.get("ISO_A2_EH") if p.get("ISO_A2_EH") not in (None, "-99") else ""), "polys": [], "label": None})
        if r["label"] is None and p.get("LABEL_X") is not None:
            r["label"] = (p["LABEL_X"], p["LABEL_Y"])
        for poly in polys:
            rings = []
            for ring in poly:
                a = np.asarray(ring, dtype=float)
                x, y = ne1(a[:, 0], a[:, 1])
                q = np.stack([np.round(x * scale), np.round(-y * scale)], axis=1).astype(np.int64)
                q = dp(q, tol)
                rings.append(q)
            if rings and len(rings[0]) >= 3:
                r["polys"].append(rings)
    countries = {}
    allx, ally = [], []
    for k in sorted(rows):
        r = rows[k]
        areas = [ring_area(pl[0]) for pl in r["polys"]]
        if not areas:
            continue
        big = max(areas)
        lg = r["polys"][areas.index(big)][0]
        gx0, gy0, gx1, gy1 = lg[:, 0].min(), lg[:, 1].min(), lg[:, 0].max(), lg[:, 1].max()
        mx, my = 0.25 * (gx1 - gx0), 0.25 * (gy1 - gy0)

        def near(ring):
            cx, cy = 0.5 * (ring[:, 0].min() + ring[:, 0].max()), 0.5 * (ring[:, 1].min() + ring[:, 1].max())
            return gx0 - mx <= cx <= gx1 + mx and gy0 - my <= cy <= gy1 + my
        parts = []
        main = []
        full = []
        pbs = []
        for pl, ar in zip(r["polys"], areas):
            if ar < min_area and ar < big:  # specks (keep a country's largest polygon whatever its size)
                continue
            for ri, ring in enumerate(pl):
                if ri > 0 and ring_area(ring) < min_area:
                    continue
                e = encode(ring)
                if e:
                    parts.append(e)
            full.append(pl[0])
            pbs.append([int(pl[0][:, 0].min()), int(pl[0][:, 1].min()), int(pl[0][:, 0].max()), int(pl[0][:, 1].max())])
            if ar >= 0.25 * big or near(pl[0]):
                main.append(pl[0])
        bb = lambda rs: [int(min(q[:, 0].min() for q in rs)), int(min(q[:, 1].min() for q in rs)), int(max(q[:, 0].max() for q in rs)), int(max(q[:, 1].max() for q in rs))]
        rec = {"n": r["n"], "a2": r["a2"], "d": "".join(parts), "b": bb(main), "B": bb(full), "P": pbs}
        if r["label"]:
            lx, ly = ne1(np.array([r["label"][0]]), np.array([r["label"][1]]))
            rec["c"] = [int(round(lx[0] * scale)), int(round(-ly[0] * scale))]
        countries[k] = rec
        allx += [rec["B"][0], rec["B"][2]]
        ally += [rec["B"][1], rec["B"][3]]
    return {
        "version": "geo.v1",
        "source": label,
        "projection": "naturalEarth1",
        "scale": scale,
        "extent": [min(allx), min(ally), max(allx), max(ally)],
        "countries": countries,
    }


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(2)
    import os

    here = os.path.dirname(os.path.abspath(__file__))
    src = sys.argv[1]
    # both files come from the 1:10m India point-of-view layer (India's official boundary: all of J&K and
    # Ladakh incl. Gilgit-Baltistan and Aksai Chin), simplified to world / regional detail
    label = "Natural Earth 5.1.1 admin-0 countries, India point of view (ne_10m_admin_0_countries_ind), public domain; simplified to {}"
    jobs = [
        ("world-110m.json", 1000, 1.2, 6, label.format("world detail")),
        ("world-50m.json", 5000, 3.0, 60, label.format("regional detail")),
    ]
    for name, scale, tol, min_area, lab in jobs:
        out = build(src, scale, tol, min_area, lab)
        p = os.path.join(here, name)
        with open(p, "w", encoding="utf-8", newline="\n") as fh:
            json.dump(out, fh, ensure_ascii=False, separators=(",", ":"), sort_keys=True)
        print(f"{name}: {len(out['countries'])} countries, {os.path.getsize(p)} bytes")


if __name__ == "__main__":
    main()
