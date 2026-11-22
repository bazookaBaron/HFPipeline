// ISOKIT motion: pure functions of t for the generic moves (orbit, expanding pulse, exploded view, camera dolly / zoom-through).
export const clamp01 = x => Math.min(1, Math.max(0, x));
export const prog = (t, a, b) => clamp01((t - a) / (b - a || 1e-9));
export const ease = {
  linear: x => clamp01(x), p2io: x => { x = clamp01(x); return x < .5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2; },
  p3out: x => 1 - Math.pow(1 - clamp01(x), 3), p2in: x => clamp01(x) ** 2, expoOut: x => { x = clamp01(x); return x >= 1 ? 1 : 1 - Math.pow(2, -10 * x); },
};
// orbit angle at t: uniform angular speed (rad/s) from a phase
export const orbitAngle = (t, phase = 0, speed = .35) => phase + t * speed;
// expanding pulse: radius grows at `speed` world units/s from t0, capped at rMax (null before t0)
export const pulseR = (t, t0, speed, rMax = Infinity) => t < t0 ? null : Math.min(rMax, (t - t0) * speed);
// exploded view: offset vector scaled by eased progress (k: 0 = assembled, 1 = exploded)
export const explode = (p, dir, k) => [p[0] + dir[0] * k, p[1] + dir[1] * k, p[2] + dir[2] * k];
// camera keyframes [{t, x,y,z,zoom}] -> camera at t (eased p2io between keys, slow 1.5 % drift after the last key: the camera never stops dead)
export function camAt(keys, t, drift = .015) {
  if (t <= keys[0].t) return { ...keys[0] };
  for (let i = 0; i < keys.length - 1; i++) { const a = keys[i], b = keys[i + 1]; if (t < b.t) { const p = ease.p2io(prog(t, a.t, b.t)); return { x: a.x + (b.x - a.x) * p, y: a.y + (b.y - a.y) * p, z: a.z + (b.z - a.z) * p, zoom: a.zoom + (b.zoom - a.zoom) * p }; } }
  const L = keys[keys.length - 1]; return { ...L, zoom: L.zoom * (1 + drift * clamp01((t - L.t) / 4)) };
}
// zoom-through: zoom ramps exponentially towards a target point (use with camAt keys whose last zoom is large)
export const zoomThrough = (t, t0, dur, z0 = 1, z1 = 6) => z0 * Math.pow(z1 / z0, ease.p2io(prog(t, t0, t0 + dur)));
