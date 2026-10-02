/* Build step for runtime/maps.js: Natural Earth 10m admin-0 (India POV) -> compact projected paths.
 * node runtime/maps_build.js [geojson]   (default: orchestrator/output/.cache/geo/ne_10m_admin_0_countries_ind.geojson)
 * Writes runtime/geo/geo.json + runtime/geo/geo.js (window.MAPS_GEO). Natural Earth I, 5000 units/rad, y down,
 * relative integer SVG paths (Douglas-Peucker 1.2 units). Keys = ISO3. Fields: n name, d path, c label pt, b main bbox, B full bbox. */
const fs = require("fs"), path = require("path");
const SRC = process.argv[2] || path.join(__dirname, "..", "orchestrator", "output", ".cache", "geo", "ne_10m_admin_0_countries_ind.geojson");
const S = 5000, TOL = 1.2, MIN_AREA = 20;
function ne1(lon, lat) {
  const lam = lon * Math.PI / 180, phi = lat * Math.PI / 180, p2 = phi * phi, p4 = p2 * p2;
  const x = lam * (0.8707 - 0.131979 * p2 - 0.013791 * p4 + 0.003971 * p2 * p4 * p4 - 0.001529 * p4 * p4 * p4);
  const y = phi * (1.007226 + 0.015085 * p2 - 0.044475 * p2 * p4 + 0.028874 * p4 * p4 - 0.005916 * p2 * p4 * p4);
  return [x * S, -y * S];
}
function dp(pts, tol) {
  const f = pts[0], l = pts[pts.length - 1];
  if (f[0] === l[0] && f[1] === l[1] && pts.length > 3) { // closed ring: split at the farthest vertex
    let m = 1, md = 0; pts.forEach((p, i) => { const d = Math.hypot(p[0] - f[0], p[1] - f[1]); if (d > md) { md = d; m = i; } });
    const a = dp(pts.slice(0, m + 1), tol), b = dp(pts.slice(m), tol); return a.concat(b.slice(1));
  }
  const n = pts.length, keep = new Uint8Array(n); keep[0] = keep[n - 1] = 1;
  const st = [[0, n - 1]];
  while (st.length) {
    const [a, b] = st.pop(); if (b <= a + 1) continue;
    const [ax, ay] = pts[a], [bx, by] = pts[b], dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy) || 1e-9;
    let m = -1, md = tol;
    for (let i = a + 1; i < b; i++) { const d = Math.abs((pts[i][0] - ax) * dy - (pts[i][1] - ay) * dx) / L; if (d > md) { md = d; m = i; } }
    if (m >= 0) { keep[m] = 1; st.push([a, m], [m, b]); }
  }
  return pts.filter((_, i) => keep[i]);
}
const area = (r) => { let s = 0; for (let i = 0; i < r.length; i++) { const j = (i + 1) % r.length; s += r[i][0] * r[j][1] - r[j][0] * r[i][1]; } return Math.abs(s) / 2; };
function enc(ring) {
  let q = ring.map((p) => [Math.round(p[0]), Math.round(p[1])]).filter((p, i, a) => i === 0 || p[0] !== a[i - 1][0] || p[1] !== a[i - 1][1]);
  if (q.length > 1 && q[0][0] === q[q.length - 1][0] && q[0][1] === q[q.length - 1][1]) q.pop();
  if (q.length < 3) return "";
  let s = "M" + q[0][0] + " " + q[0][1] + "l"; let prev = "";
  for (let i = 1; i < q.length; i++) { const a = q[i][0] - q[i - 1][0], b = q[i][1] - q[i - 1][1]; s += (i > 1 && a >= 0 ? " " : "") + a + (b >= 0 ? " " : "") + b; }
  return s.replace(/l /, "l") + "z";
}
const bbox = (rs) => { let a = 1e9, b = 1e9, c = -1e9, d = -1e9; rs.forEach((r) => r.forEach((p) => { a = Math.min(a, p[0]); b = Math.min(b, p[1]); c = Math.max(c, p[0]); d = Math.max(d, p[1]); })); return [a, b, c, d].map(Math.round); };
const gj = JSON.parse(fs.readFileSync(SRC, "utf8")), rows = {};
for (const f of gj.features) {
  const p = f.properties; let k = p.ISO_A3_EH; if (!k || k === "-99") k = p.ADM0_A3; if (k === "KOS") k = "XKX";
  const g = f.geometry, polys = g.type === "MultiPolygon" ? g.coordinates : [g.coordinates];
  const r = rows[k] || (rows[k] = { n: p.NAME || p.NAME_EN, polys: [], label: null });
  if (!r.label && p.LABEL_X != null) r.label = ne1(p.LABEL_X, p.LABEL_Y).map(Math.round);
  for (const poly of polys) {
    const rings = poly.map((ring) => dp(ring.map(([lo, la]) => ne1(lo, la)), TOL));
    if (rings[0].length >= 4) r.polys.push(rings);
  }
}
const out = { countries: {}, scale: S, projection: "naturalEarth1 (y down)", source: "Natural Earth 5.1.1 admin-0 India POV (ne_10m_admin_0_countries_ind), public domain" };
for (const k of Object.keys(rows).sort()) {
  const r = rows[k]; if (k === "ATA") continue;
  const ar = r.polys.map((p) => area(p[0])), big = Math.max(...ar), keepP = r.polys.filter((p, i) => ar[i] >= MIN_AREA || ar[i] === big);
  if (!keepP.length) continue;
  const bi = ar.indexOf(big), bb = bbox([r.polys[bi][0]]), mx = (bb[2] - bb[0]) * .25, my = (bb[3] - bb[1]) * .25;
  const main = r.polys.filter((p) => { const b = bbox([p[0]]), cx = (b[0] + b[2]) / 2, cy = (b[1] + b[3]) / 2; return cx > bb[0] - mx && cx < bb[2] + mx && cy > bb[1] - my && cy < bb[3] + my; });
  const B = bbox(keepP.map((p) => p[0]));
  out.countries[k] = { n: r.n, d: keepP.map((p) => p.map(enc).join("")).join(""), c: r.label || [(B[0] + B[2]) / 2, (B[1] + B[3]) / 2].map(Math.round), b: bbox(main.map((p) => p[0])), B };
}
const dir = path.join(__dirname, "geo"); fs.mkdirSync(dir, { recursive: true });
const js = JSON.stringify(out);
fs.writeFileSync(path.join(dir, "geo.json"), js);
fs.writeFileSync(path.join(dir, "geo.js"), "window.MAPS_GEO=" + js + ";");
console.log("countries", Object.keys(out.countries).length, "bytes", js.length);
