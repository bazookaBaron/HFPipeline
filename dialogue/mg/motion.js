// Motion helpers. Everything is a pure function of time t (seconds). No wall clock, no randomness.
// Easing set is the STYLE-GUIDE section 6 set only: power3.out / expo.out (enter), power2.inOut (draw), power2.in (exit).
export const clamp01 = x => Math.min(1, Math.max(0, x));
export const prog = (t, a, b) => clamp01((t - a) / (b - a || 1e-9));
export const lerp = (a, b, p) => a + (b - a) * p;
export const ease = {
  linear: x => clamp01(x),
  p2in: x => { x = clamp01(x); return x * x; },
  p2out: x => { x = clamp01(x); return 1 - (1 - x) * (1 - x); },
  p2io: x => { x = clamp01(x); return x < .5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2; },
  p3out: x => 1 - Math.pow(1 - clamp01(x), 3),
  p3io: x => { x = clamp01(x); return x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; },
  expoOut: x => { x = clamp01(x); return x >= 1 ? 1 : 1 - Math.pow(2, -10 * x); },
};
// stagger: start time of the i-th item in a group (80-120 ms apart by default)
export const stagger = (i, at = 0, step = 0.1) => at + i * step;
// hold-drift: slow push of `pct` (1-2 %) over `dur` seconds, never overshoots
export const drift = (t, pct = 0.012, dur = 4) => 1 + pct * ease.linear(t / dur);
// enter/exit pair: 0 -> 1 on enter (`inDur`), 1 -> 0 on exit starting at `out` (`outDur`)
export const pair = (t, inAt, out, inDur = .7, outDur = .4) => ease.p3out(prog(t, inAt, inAt + inDur)) * (1 - ease.p2in(prog(t, out, out + outDur)));
// colour helpers (palette values only ever pass through these)
const h2r = h => { h = h.replace('#', ''); return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)); };
export const hexA = (hex, a) => { const [r, g, b] = h2r(hex); return `rgba(${r},${g},${b},${a})`; };
export const mixHex = (a, b, p) => { const A = h2r(a), B = h2r(b); return '#' + A.map((v, i) => Math.round(lerp(v, B[i], p)).toString(16).padStart(2, '0')).join(''); };
export const fmtNum = (n, dec = 0) => { const s = Math.abs(n).toFixed(dec); const [i, d] = s.split('.'); return (n < 0 ? '-' : '') + i.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (d ? '.' + d : ''); };
