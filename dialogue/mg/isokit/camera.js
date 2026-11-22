// ISOKIT camera: one continuous iso world, the camera moves between subjects. Fixed iso angle (K); a key = a framing of world points.
// keys: [{t, pts:[[x,y,z,r?]...], zoom?, dur?}]  ->  viewAt(rig, t) = makeView whose scale/centre ease (p2io, default 0.6 s) from the previous
// key to the next, starting at key.t; after the move the camera keeps a slow drift (zoom + pan) so it never stops dead.
// Interpolation is in raw iso space (S geometric, centre linear) so a move is a straight dolly + zoom. Pure: no DOM, no clock.
import { makeView } from './core.js';
import { ease, prog } from './motion.js';

// framing of a point set inside box: S (px per world unit) + raw-space centre u (the raw point that sits at the box centre)
export function framing(pts, box, K = .55, zoom = 1) {
  const v = makeView({ W: 1, H: 1, S: 1, K, cx: 0, cy: 0 }); let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  for (const q of pts) { const p = v.P(q[0], q[1], q[2]), r = q[3] || 0; x0 = Math.min(x0, p[0] - r); x1 = Math.max(x1, p[0] + r); y0 = Math.min(y0, p[1] - r); y1 = Math.max(y1, p[1] + r); }
  return { S: Math.min(box.w / (x1 - x0), box.h / (y1 - y0)) * zoom, u: [(x0 + x1) / 2, (y0 + y1) / 2] };
}
// rig = {W, H, box, K, keys(with .f framings)}; build once, then viewAt(rig, t) per frame
export function camRig({ W, H, box, keys, K = .55, dur = .6, drift = .012, pan = .06 }) {
  const ks = keys.slice().sort((a, b) => a.t - b.t).map(k => ({ ...k, f: k.f || framing(k.pts, box, K, k.zoom ?? 1) }));
  return { W, H, box, K, keys: ks, dur, drift, pan, px: W < 1200 ? .85 : 1 };
}
export function camAt(rig, t) {
  const ks = rig.keys; let i = 0; while (i + 1 < ks.length && ks[i + 1].t <= t) i++;
  const cur = ks[i], prev = ks[Math.max(0, i - 1)], p = i === 0 ? 1 : ease.p2io(prog(t, cur.t, cur.t + (cur.dur ?? rig.dur)));
  let S = prev.f.S * Math.pow(cur.f.S / prev.f.S, p), u = [prev.f.u[0] + (cur.f.u[0] - prev.f.u[0]) * p, prev.f.u[1] + (cur.f.u[1] - prev.f.u[1]) * p];
  const st = Math.max(0, t - cur.t); S *= 1 + rig.drift * Math.min(1, st / 4);                          // slow push-in drift
  u = [u[0] + rig.pan * Math.sin(st * .35) , u[1] + rig.pan * .5 * Math.sin(st * .27)];                 // slight lateral float (world-raw units)
  return { S, u, i, settled: p >= 1 };
}
export function viewAt(rig, t) {
  const c = camAt(rig, t), b = rig.box;
  return makeView({ W: rig.W, H: rig.H, S: c.S, K: rig.K, cx: b.x + b.w / 2 - c.S * c.u[0], cy: b.y + b.h / 2 - c.S * c.u[1], px: rig.px });
}
