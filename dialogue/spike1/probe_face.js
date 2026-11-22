import { THREE, loadCast } from "/lib.js";
const out = {};
for (const id of ["dadu", "rohan", "arjun", "meera"]) {
  const ch = await loadCast(id); const E = ch.face.E; const eyeY = (E.cl[0].cy + E.cl[1].cy) / 2; const rows = [];
  for (let d = 0.02; d >= -0.14; d -= 0.01) { const y = eyeY + d; const per = {}; for (const m of ch.heads) { const p = m.geometry.attributes.position, ix = m.geometry.index; const n = ix ? ix.count : p.count; let z = -9; for (let i = 0; i < n; i += 3) { const v = [0, 1, 2].map(k => { const j = ix ? ix.array[i + k] : i + k; return [p.getX(j), p.getY(j), p.getZ(j)]; }); const [a, b, c] = v; const dd = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1]); if (Math.abs(dd) < 1e-12) continue; const l0 = ((b[1] - c[1]) * (0 - c[0]) + (c[0] - b[0]) * (y - c[1])) / dd, l1 = ((c[1] - a[1]) * (0 - c[0]) + (a[0] - c[0]) * (y - c[1])) / dd, l2 = 1 - l0 - l1; if (l0 < 0 || l1 < 0 || l2 < 0) continue; z = Math.max(z, l0 * a[2] + l1 * b[2] + l2 * c[2]); } if (z > -9) per[m.material.name] = +z.toFixed(3); } rows.push(`${d.toFixed(2)}: ${JSON.stringify(per)}`); }
  out[id] = { eyeY: +eyeY.toFixed(3), eyeX: [E.cl[0].cx, E.cl[1].cx].map(x => +x.toFixed(3)), eyeW: +E.cl[0].w.toFixed(3), eyeH: +E.cl[0].h.toFixed(3), rows };
}
window.__pf = out;
