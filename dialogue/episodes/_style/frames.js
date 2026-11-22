// Style frames for the colourful iso MG kit (mg/isokit). Three GPS-episode moments, each a pure function of t.
import { PAL, mix, add3, sub3, len3 } from '../../mg/isokit/core.js';
import * as K from '../../mg/isokit/prims.js';
import { orbitAngle } from '../../mg/isokit/motion.js';

const SAT_COLS = [PAL.coral, PAL.saffron, PAL.sky, PAL.violet];

// A) globe, 4 satellites on inclined orbits (GPS-like planes), Leo's phone on the surface, faint time beams down to it
export const A = {
  tag: 'THE SIGNAL', seed: 3,
  fit: () => [[0, 0, 0, 5.75]],
  draw(sc, t) {
    const g = { c: [0, 0, 0], R: 3, rot: 25 }, r = 5.2, planes = [[55, 60], [55, 120], [55, 180], [55, 90]], ph = [1.57 - .6, .3 - .6, 2.36 - .6, 5.2 - .6];   // planes picked so none is edge-on; phases keep all 4 in front at the still
    K.globe(sc, g);
    const base = K.globePoint(g, 46, 2), top = add3(base, [0, 0, 1.45]);
    planes.forEach(([inc, node], i) => {
      K.orbit(sc, { c: g.c, r, inc, node, color: SAT_COLS[i] });
      const p = K.orbitPos(g.c, r, inc, node, orbitAngle(t, ph[i], .3));
      K.satellite(sc, { p, color: SAT_COLS[i], scale: 1.05 });
      if (sc.V.dep(p) > sc.V.dep(g.c) - 1) K.beam(sc, p, top, { color: SAT_COLS[i], alpha: .55, w: 2, dash: '3 9', pk: (t * .6 + i * .27) % 1 });
    });
    K.rings(sc, { p: base, n: 3, r: .95, r0: .25, color: PAL.cream, phase: t * .5, alpha: .8, w: 2 });
    K.phone(sc, { p: base, color: PAL.coral, scale: 1.3, shadow: false, depth: 1e4, layer: 'fx' });
    K.cloud(sc, { x: 4, y: -5, z: 1.2, size: 1.0 });
    K.cloud(sc, { x: -4.8, y: 3, z: -1.4, size: .8, opacity: .85 });
    K.tag(sc, top, "LEO'S PHONE", { color: PAL.coral, dx: -150, dy: -46 });
    K.tag(sc, K.orbitPos(g.c, r, 55, 180, 2.9), '20,200 KM UP', { color: PAL.sky, dx: 120, dy: -30 });
  },
};

// B) four timing pulses as translucent spheres, each exactly reaching the phone; their ground circles cross at the phone; pin drops
export const B = {
  tag: 'FOUR BALLS', seed: 5,
  fit: () => [[-4.6, -3.6, -1.2], [4.6, -3.6, -1.2], [-4.6, 3.6, -1.2], [4.6, 3.6, -1.2], [-3.4, -2.2, 5.6, .6], [2.2, -3.6, 6.2, .6], [5.6, -.6, 7.2, .6], [-3.0, 3.4, 5.6, .6]],
  draw(sc, t) {
    const I = { x: -4.5, y: -3.5, w: 9, d: 7, r: 1, th: 1.2 }, ph = [0, 0, 0];
    K.island(sc, { ...I, seed: 9, tufts: 18, avoid: (x, y) => Math.hypot(x, y) < 1.4 });
    const clip = K.islandClip(sc, I);
    const sats = [[-3.4, -2.2, 5.0], [2.2, -3.6, 5.6], [5.6, -.6, 6.6], [-3.0, 3.4, 5.0]], cols = [PAL.saffron, PAL.sky, PAL.violet, PAL.cream];
    sats.forEach((s, i) => {
      const R = len3(sub3(s, ph)), gr = Math.hypot(s[0], s[1]);
      K.pulseSphere(sc, { c: s, r: R, color: cols[i], fillA: .04, rimA: .75, w: 2.2, depth: i, echo: [[.82, .16]], eqA: .18 });
      K.groundCircle(sc, { c: [s[0], s[1], 0], r: gr, color: cols[i], clip, depth: i, fillA: 0 });
      K.satellite(sc, { p: s, color: cols[i], scale: 1.15, layer: 'top', depth: i });
    });
    for (const [x, y, k, h] of [[-3.6, -2.6, 'cone', 1.3], [-3.0, -2.9, 'round', 1], [3.7, 2.7, 'cone', 1.1], [3.2, 2.9, 'cone', .8], [-3.8, 2.2, 'round', 1.1], [3.8, -2.6, 'cone', 1.2], [-1.2, 2.9, 'round', .8], [1.6, -2.9, 'cone', .9]])
      K.tree(sc, { x, y, kind: k, h, color: k === 'round' ? '#2FBF8A' : '#26A985' });
    K.shadow(sc, 0, 0, 0, .55, .35);
    K.phone(sc, { p: [0, 0, 0], color: PAL.coral, scale: 1.1, shadow: false, layer: 'top', depth: 50 });
    K.pin(sc, { p: [0, 0, 1.35 + .45], color: PAL.coral, size: .34, streak: 1, layer: 'top', depth: 60 });
    K.tag(sc, [0, 0, 1.3], 'YOU ARE HERE', { color: PAL.coral, dx: 170, dy: 40 });
  },
};

// C) city island: blocks, roads, wifi rings from rooftops, a cell tower; above it two clocks drifting apart
export const C = {
  tag: 'IN THE CITY', seed: 8,
  fit: () => [[-5.5, -4, -1.2], [5.5, -4, -1.2], [-5.5, 4, -1.2], [5.5, 4, -1.2], [-6.2, 0, 7.4, .4], [0, -6.2, 7.4, .4], [-2.4, -2.6, 4.4]],
  draw(sc, t) {
    const I = { x: -5.5, y: -4, w: 11, d: 8, r: 1.1, th: 1.2 };
    K.island(sc, { ...I, seed: 4, tufts: 10, avoid: (x, y) => Math.abs(y - .55) < 1 || Math.abs(x + .9) < 1 || (y < 0 && x > -4.6) });
    K.road(sc, [-5.2, .55], [5.2, .55], 1.15); K.road(sc, [-.9, -3.7], [-.9, 3.7], 1.15);
    const B = [
      [-4.7, -3.4, 1.3, 1.3, 2.6, PAL.violet, 'unit'], [-3.1, -3.4, 1.4, 1.2, 4.0, PAL.sky, 'antenna'], [-4.7, -1.7, 1.3, 1.4, 1.6, PAL.saffron, 'tank'], [-3.0, -1.7, 1.3, 1.3, 2.2, PAL.coral, 'unit'],
      [.0, -3.4, 1.5, 1.4, 2.4, PAL.cream, 'tank'], [1.9, -3.5, 1.3, 1.3, 4.8, PAL.coral, 'antenna'], [3.6, -3.3, 1.3, 1.2, 3.0, PAL.violet, 'unit'], [.1, -1.6, 1.4, 1.2, 1.5, PAL.saffron, 'unit'], [2.1, -1.6, 1.4, 1.3, 2.8, PAL.sky, 'tank'],
      [-4.7, 1.5, 1.3, 1.3, 2.0, PAL.saffron, 'tank'], [.1, 1.5, 1.6, 1.3, 1.8, PAL.violet, 'unit'], [2.4, 1.6, 1.3, 1.3, 2.6, PAL.coral, 'unit'],
    ];
    const tops = B.map(([x, y, w, d, h, color, roof]) => K.building(sc, { x, y, w, d, h, color, roof, litP: .5 }).top);
    for (const [x, y, k, h] of [[-2.7, 1.9, 'round', .9], [-2.0, 2.9, 'cone', 1.1], [-3.2, 3.1, 'cone', .9], [4.4, 2.0, 'round', .9], [1.0, 3.3, 'round', .7], [3.6, 3.3, 'cone', .9]]) K.tree(sc, { x, y, kind: k, h });
    K.tower(sc, { p: [4.65, 3.0, 0], h: 2.4, base: .32, color: PAL.cream });
    [[1, PAL.sky], [5, PAL.sky], [4, PAL.saffron]].forEach(([i, col], j) => { const p = add3(tops[i], [0, 0, .05]); K.rings(sc, { p, n: 3, r: 1.8, r0: .3, color: col, phase: t * .45 + j * .3, w: 2.4 }); K.wifi(sc, { p: add3(p, [0, 0, i === 1 ? 1.15 : .55]), color: col, size: .55 }); });
    // phone in the street + fix circle from maps/wifi (dashed: estimate)
    K.groundCircle(sc, { c: [-1.0, 3.35, .01], r: .9, color: PAL.coral, dash: '6 6', w: 2.4, fillA: .12 });
    K.phone(sc, { p: [-1.0, 3.35, 0], color: PAL.coral, scale: .8 });
    K.tag(sc, [-1.0, 3.35, .9], 'MAPS + WIFI', { color: PAL.coral, dx: -150, dy: 70 });
    // two clocks drifting apart (satellite clock vs ground clock); ghost hands = where they agreed
    const drift = .5 + .2 * Math.sin(t * .4);
    K.clock(sc, { c: [-6.2, -.1, 6.2], r: 1.25, color: PAL.sky, hour: 10.1 / 12 * Math.PI * 2, min: (0.1 - drift * .05) * Math.PI * 2, ghost: [[.1 * Math.PI * 2, .35]] });
    K.clock(sc, { c: [-.1, -6.2, 6.2], r: 1.25, color: PAL.saffron, hour: 10.2 / 12 * Math.PI * 2, min: (0.1 + drift * .09) * Math.PI * 2, ghost: [[.1 * Math.PI * 2, .35], [(0.1 + drift * .045) * Math.PI * 2, .55]] });
    K.arrow(sc, [-3.6, -2.4, 6.4], [-4.9, -1.1, 6.4], { color: PAL.cream, w: 2.4 }); K.arrow(sc, [-2.4, -3.6, 6.4], [-1.1, -4.9, 6.4], { color: PAL.cream, w: 2.4 });
    K.tag(sc, [-3, -3, 6.4], '+38 µs / DAY', { color: PAL.saffron, dy: -26 });
    K.cloud(sc, { x: 5.4, y: -6.5, z: 3.2, size: .9 }); K.cloud(sc, { x: -7, y: 4, z: 1.5, size: .7, opacity: .85 });
  },
};
export const FRAMES = { A, B, C };
