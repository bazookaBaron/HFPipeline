/* Build step for runtime/doc/globe.js: Natural Earth 10m admin-0 (India POV, same source + ISO keys as geo.js)
 * -> lon/lat rings simplified for an orthographic globe.
 * node runtime/geo/globe_build.js [geojson]  -> runtime/geo/globe-geo.js (window.GLOBE_GEO)
 * Format: { ISO: { n, r: [ring, ...] } }, ring = flat [lon*100, lat*100, ...] ints (delta-free, small enough). */
const fs = require("fs"), path = require("path");
const SRC = process.argv[2] || path.join(__dirname, "..", "..", "orchestrator", "output", ".cache", "geo", "ne_10m_admin_0_countries_ind.geojson");
const TOL = 0.05, MIN_AREA = 0.02; // degrees
function dp(pts, tol) {
  const n = pts.length; if (n < 4) return pts;
  const keep = new Uint8Array(n); keep[0] = keep[n - 1] = 1; const st = [[0, n - 1]];
  while (st.length) {
    const [a, b] = st.pop(); if (b <= a + 1) continue;
    const [ax, ay] = pts[a], [bx, by] = pts[b], dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy);
    let m = -1, md = tol;
    for (let i = a + 1; i < b; i++) { const d = L < 1e-9 ? Math.hypot(pts[i][0] - ax, pts[i][1] - ay) : Math.abs((pts[i][0] - ax) * dy - (pts[i][1] - ay) * dx) / L; if (d > md) { md = d; m = i; } }
    if (m >= 0) { keep[m] = 1; st.push([a, m], [m, b]); }
  }
  return pts.filter((_, i) => keep[i]);
}
const area = (r) => { let s = 0; for (let i = 0; i < r.length; i++) { const j = (i + 1) % r.length; s += r[i][0] * r[j][1] - r[j][0] * r[i][1]; } return Math.abs(s) / 2; };
const gj = JSON.parse(fs.readFileSync(SRC, "utf8")), out = {};
for (const f of gj.features) {
  const p = f.properties; let k = p.ISO_A3_EH; if (!k || k === "-99") k = p.ADM0_A3; if (k === "KOS") k = "XKX";
  if (k === "ATA") continue;
  const g = f.geometry, polys = g.type === "MultiPolygon" ? g.coordinates : [g.coordinates];
  const o = out[k] || (out[k] = { n: p.NAME || p.NAME_EN, r: [] });
  for (const poly of polys) {
    if (area(poly[0]) < MIN_AREA) continue;
    const ring = dp(poly[0], TOL); if (ring.length < 4) continue;
    o.r.push(ring.flatMap(([lo, la]) => [Math.round(lo * 100), Math.round(la * 100)]));
  }
  if (!o.r.length) delete out[k];
}
const js = "window.GLOBE_GEO=" + JSON.stringify(out) + ";\n";
fs.writeFileSync(path.join(__dirname, "globe-geo.js"), js);
console.log("globe-geo.js", Object.keys(out).length, "countries", (js.length / 1024).toFixed(0), "KB");
