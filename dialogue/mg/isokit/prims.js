// ISOKIT primitives: generic reusable iso objects (no episode-specific content). Each takes (sc, spec) and adds SVG fragments to the scene.
// World units: z is up, the ground plane is z=0. Visible box faces: top, left (+y face, mid tone), right (+x face, dark tone).
import { PAL, mix, rgba, tones, poly, line, pt, f1, hull, add3, sub3, mul3, dot3, norm3, len3, rng, clamp01 } from './core.js';

const TAU = Math.PI * 2;
// ---------------------------------------------------------------------------------------------------------------------------------
// box: crisp 3-tone prism with a rim light along the near top edges. returns the svg string; adds to scene unless s.raw
export function boxSvg(V, s) {
  const { x, y, z = 0, w, d, h } = s, T = s.tones || tones(s.color || PAL.cream, s), x1 = x + w, y1 = y + d, z1 = z + h, P = V.P;
  const top = [P(x, y, z1), P(x1, y, z1), P(x1, y1, z1), P(x, y1, z1)], lf = [P(x, y1, z), P(x1, y1, z), P(x1, y1, z1), P(x, y1, z1)], rt = [P(x1, y, z), P(x1, y1, z), P(x1, y1, z1), P(x1, y, z1)];
  const sw = `stroke-width="0.8" stroke-linejoin="round"`, op = s.opacity != null ? ` opacity="${s.opacity}"` : '';
  let o = `<g${op}><path d="${poly(lf)}" fill="${T.mid}" stroke="${T.mid}" ${sw}/><path d="${poly(rt)}" fill="${T.dark}" stroke="${T.dark}" ${sw}/><path d="${poly(top)}" fill="${T.top}" stroke="${T.top}" ${sw}/>`;
  if (s.rim !== false) o += `<path d="${line([P(x, y1, z1), P(x1, y1, z1), P(x1, y, z1)])}" fill="none" stroke="${rgba(PAL.cream, s.rimA ?? .55)}" stroke-width="${f1(1.4 * V.px)}" stroke-linecap="round" stroke-linejoin="round"/>`;
  return o + (s.extra || '') + '</g>';
}
export const box = (sc, s) => sc.add(boxSvg(sc.V, s), s.depth ?? sc.V.dep(s.x + s.w / 2, s.y + s.d / 2, (s.z || 0) + s.h / 2), s.layer);
// points on a box face for decals: face 'left' (+y): (u along x, v along z); 'right' (+x): (u along y, v along z); 'top': (u along x, v along y)
export const facePt = (V, s, face, u, v) => face === 'left' ? V.P(s.x + u, s.y + s.d, (s.z || 0) + v) : face === 'right' ? V.P(s.x + s.w, s.y + s.d - u, (s.z || 0) + v) : V.P(s.x + u, s.y + v, (s.z || 0) + s.h);
export const faceQuad = (V, s, face, u0, v0, u1, v1) => [facePt(V, s, face, u0, v0), facePt(V, s, face, u1, v0), facePt(V, s, face, u1, v1), facePt(V, s, face, u0, v1)];

// rounded-rect footprint (xy) extruded along z, side shading follows the outward normal (mid at +y, dark at +x) -> bevelled look
function rrect(x, y, w, d, r, seg = 7) {
  r = Math.min(r, w / 2, d / 2); const c = [[x + w - r, y + r, -Math.PI / 2], [x + w - r, y + d - r, 0], [x + r, y + d - r, Math.PI / 2], [x + r, y + r, Math.PI]], pts = [];
  for (const [cx, cy, a0] of c) for (let i = 0; i <= seg; i++) { const a = a0 + i / seg * Math.PI / 2; pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); }
  return pts;
}
export function slabSvg(V, s) {
  const { x, y, z = 0, w, d, h, r = .4 } = s, T = s.tones || tones(s.color, s), P = V.P, fp = rrect(x, y, w, d, r), n = fp.length; let o = '';
  const rim = [];
  for (let i = 0; i < n; i++) {
    const a = fp[i], b = fp[(i + 1) % n], nx = b[1] - a[1], ny = -(b[0] - a[0]);   // outward normal for a counter-clockwise loop in screen-handed xy
    if (nx + ny <= 1e-9) continue;
    const phi = Math.atan2(ny, nx), k = clamp01(phi / (Math.PI / 2)), c = s.sideTop ? null : mix(T.dark, T.mid, k);
    o += `<path d="${poly([P(a[0], a[1], z), P(b[0], b[1], z), P(b[0], b[1], z + h), P(a[0], a[1], z + h)])}" fill="${c}" stroke="${c}" stroke-width="0.8"/>`;
    rim.push([a, b]);
  }
  o += `<path d="${poly(fp.map(q => P(q[0], q[1], z + h)))}" fill="${T.top}"/>`;
  if (s.rim !== false) o += rim.map(([a, b]) => `<path d="${line([P(a[0], a[1], z + h), P(b[0], b[1], z + h)])}" stroke="${rgba(PAL.cream, s.rimA ?? .5)}" stroke-width="${f1(1.5 * V.px)}" stroke-linecap="round" fill="none"/>`).join('');
  return o;
}
export const slab = (sc, s) => sc.add(slabSvg(sc.V, s), s.depth ?? sc.V.dep(s.x + s.w / 2, s.y + s.d / 2, (s.z || 0) + s.h / 2), s.layer);

// ---------------------------------------------------------------------------------------------------------------------------------
// island: floating ground (mint grass slab on a teal soil slab + tapered underside), grass tufts for life. layer 'ground'.
export function island(sc, s) {
  const V = sc.V, { x, y, w, d } = s, th = s.th ?? 1.1, r = s.r ?? .9, g = s.grass ?? .26, R = rng(s.seed ?? 7); let o = '';
  o += `<ellipse cx="${f1(V.P(x + w / 2, y + d / 2, -th - 2.2)[0])}" cy="${f1(V.P(x + w / 2, y + d / 2, -th - 2.2)[1])}" rx="${f1(w * .42 * V.s)}" ry="${f1(d * .42 * V.s * V.K)}" fill="${rgba(PAL.ink, .35)}"/>`;  // faint far shadow = floating
  o += slabSvg(V, { x: x + .55, y: y + .55, z: -th - .55, w: w - 1.1, d: d - 1.1, h: .6, r: r * .8, tones: { top: PAL.soil, mid: mix(PAL.soil, PAL.violet, .18), dark: mix(PAL.soil, PAL.shade, .35) }, rim: false });
  o += slabSvg(V, { x, y, z: -th, w, d, h: th - g, r, tones: { top: PAL.teal, mid: PAL.teal, dark: PAL.tealDeep }, rim: false });
  o += slabSvg(V, { x: x - .04, y: y - .04, z: -g, w: w + .08, d: d + .08, h: g, r: r + .04, tones: { top: s.top || PAL.mint, mid: mix(PAL.mint, PAL.teal, .35), dark: mix(PAL.mint, PAL.tealDeep, .55) }, rimA: .6 });
  for (let i = 0; i < (s.tufts ?? 16); i++) {   // tiny grass tufts / speckles on the top
    const px = x + r + R() * (w - 2 * r), py = y + r + R() * (d - 2 * r); if (s.avoid && s.avoid(px, py)) continue; const p = V.P(px, py, 0), k = V.s * .09;
    o += `<path d="M${f1(p[0] - k)},${f1(p[1])}l${f1(k * .5)},${f1(-k * 1.6)}l${f1(k * .5)},${f1(k * 1.6)}l${f1(k * .5)},${f1(-k * 1.2)}l${f1(k * .5)},${f1(k * 1.2)}" fill="none" stroke="${PAL.mintLit}" stroke-width="${f1(1.6 * V.px)}" stroke-linecap="round" stroke-linejoin="round"/>`;
  }
  sc.add(o, -1e6, s.layer || 'ground');
}
// flat decal on the ground (roads, pads): polygon of world xy points at z
// clipPath matching an island's grass top (for ground-plane effects that must stay on the island)
export function islandClip(sc, s) { const V = sc.V, id = sc.id('isl'); sc.def(`<clipPath id="${id}"><path d="${poly(rrect(s.x, s.y, s.w, s.d, s.r ?? .9).map(q => V.P(q[0], q[1], 0)))}"/></clipPath>`); return id; }
export function decal(sc, pts, s = {}) { const V = sc.V, z = s.z ?? .002; sc.add(`<path d="${poly(pts.map(q => V.P(q[0], q[1], z)))}" fill="${s.fill || PAL.road}"${s.stroke ? ` stroke="${s.stroke}" stroke-width="${f1((s.sw ?? 1.5) * V.px)}"` : ''}/>`, s.depth ?? -1, s.layer || 'floor'); }
export function road(sc, a, b, wd, s = {}) {   // straight road between world xy points a,b with centre dashes
  const V = sc.V, dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy), nx = -dy / L * wd / 2, ny = dx / L * wd / 2;
  decal(sc, [[a[0] + nx, a[1] + ny], [b[0] + nx, b[1] + ny], [b[0] - nx, b[1] - ny], [a[0] - nx, a[1] - ny]], { fill: s.fill || PAL.road, layer: 'floor', depth: -2 });
  let o = ''; const n = Math.floor(L / .7); for (let i = 0; i < n; i++) { const t0 = (i + .25) / n, t1 = (i + .6) / n; o += `<path d="${line([V.P(a[0] + dx * t0, a[1] + dy * t0, .004), V.P(a[0] + dx * t1, a[1] + dy * t1, .004)])}" stroke="${rgba(PAL.cream, .55)}" stroke-width="${f1(2 * V.px)}" stroke-linecap="round"/>`; }
  sc.add(o, -1, 'floor');
}
// contact shadow: crisp soft-alpha ellipse on the ground
export const shadowSvg = (V, x, y, z, r, a = .3) => { const p = V.P(x, y, z); return `<ellipse cx="${f1(p[0])}" cy="${f1(p[1])}" rx="${f1(r * V.s)}" ry="${f1(r * V.s * V.K)}" fill="${rgba(PAL.shade, a)}"/>`; };
export const shadow = (sc, x, y, z, r, a) => sc.add(shadowSvg(sc.V, x, y, z, r, a), -1, 'floor');

// ---------------------------------------------------------------------------------------------------------------------------------
// tree: 'cone' (split lit/dark triangle) or 'round' (disc + shade crescent), tiny trunk, contact shadow
export function tree(sc, s) {
  const V = sc.V, { x, y, z = 0 } = s, h = s.h ?? 1.2, r = s.r ?? .38, col = s.color || '#3FBF8F', T = tones(col, { lit: .2, dark: .35 }), trunkH = h * .22, sp = V.s;
  let o = shadowSvg(V, x + .12, y + .12, z, r * 1.05, .28);
  const b0 = V.P(x, y, z), b1 = V.P(x, y, z + trunkH); o += `<path d="M${pt(b0)}L${pt(b1)}" stroke="${mix(PAL.saffron, PAL.shade, .55)}" stroke-width="${f1(r * sp * .32)}" stroke-linecap="round"/>`;
  if ((s.kind || 'cone') === 'cone') {
    const ap = V.P(x, y, z + h), rs = r * sp, ry = rs * V.K, c = b1;
    o += `<path d="M${pt(ap)}L${f1(c[0] - rs)},${f1(c[1])}A${f1(rs)},${f1(ry)} 0 0 0 ${f1(c[0])},${f1(c[1] + ry)}Z" fill="${T.mid}"/>`;
    o += `<path d="M${pt(ap)}L${f1(c[0] + rs)},${f1(c[1])}A${f1(rs)},${f1(ry)} 0 0 1 ${f1(c[0])},${f1(c[1] + ry)}Z" fill="${T.dark}"/>`;
    o += `<path d="M${pt(ap)}L${f1(c[0] - rs * .45)},${f1(c[1] - (c[1] - ap[1]) * .45)}" stroke="${rgba(PAL.cream, .45)}" stroke-width="${f1(1.4 * V.px)}" stroke-linecap="round"/>`;
  } else {
    const c = V.P(x, y, z + trunkH + r * .9), rs = r * sp * 1.05;
    o += `<circle cx="${f1(c[0])}" cy="${f1(c[1])}" r="${f1(rs)}" fill="${T.mid}"/>`;
    o += `<path d="M${f1(c[0] + rs * .15)},${f1(c[1] - rs * .99)}A${f1(rs)},${f1(rs)} 0 0 1 ${f1(c[0] - rs * .55)},${f1(c[1] + rs * .84)}A${f1(rs * 1.05)},${f1(rs * 1.05)} 0 0 0 ${f1(c[0] + rs * .15)},${f1(c[1] - rs * .99)}Z" fill="${T.dark}" transform="rotate(-25 ${f1(c[0])} ${f1(c[1])})"/>`;
    o += `<circle cx="${f1(c[0] - rs * .38)}" cy="${f1(c[1] - rs * .4)}" r="${f1(rs * .22)}" fill="${rgba(PAL.cream, .32)}"/>`;
  }
  sc.add(o, V.dep(x, y, z + h * .5), s.layer);
}
// cloud: flat 2-tone puff (shade underside offset), screen-space circles at a world point
export function cloud(sc, s) {
  const V = sc.V, c = V.P(s.x, s.y, s.z), k = (s.size ?? 1) * V.s * .55, bumps = [[-1.1, .1, .62], [-.35, -.35, .9], [.55, -.15, .72], [1.2, .15, .5]];
  const shape = (dy, fill) => bumps.map(([bx, by, br]) => `<circle cx="${f1(c[0] + bx * k)}" cy="${f1(c[1] + by * k + dy)}" r="${f1(br * k)}" fill="${fill}"/>`).join('') + `<rect x="${f1(c[0] - 1.1 * k)}" y="${f1(c[1] + dy)}" width="${f1(2.3 * k)}" height="${f1(.62 * k)}" rx="${f1(.31 * k)}" fill="${fill}"/>`;
  sc.add(`<g opacity="${s.opacity ?? .95}">${shape(k * .16, '#B9B2F2')}${shape(0, PAL.cream)}</g>`, s.depth ?? V.dep(s.x, s.y, s.z), s.layer || 'air');
}

// ---------------------------------------------------------------------------------------------------------------------------------
// globe / planet: ocean disc, lat-lon graticule, continents projected on the sphere (hidden half clamped to the limb), terminator crescent, limb rim light
const CONT = [
  [[70, -160], [72, -120], [75, -90], [62, -65], [47, -53], [30, -80], [25, -80], [18, -95], [8, -80], [20, -105], [32, -117], [50, -127], [60, -145]],
  [[12, -72], [8, -60], [-5, -35], [-23, -42], [-35, -57], [-55, -68], [-45, -75], [-18, -71], [-5, -81]],
  [[35, -6], [37, 10], [31, 32], [12, 44], [11, 51], [-3, 40], [-25, 35], [-34, 20], [-29, 15], [-12, 13], [4, 9], [5, -5], [14, -17], [27, -13]],
  [[36, -9], [44, -9], [48, -4], [54, 8], [60, 5], [71, 25], [70, 60], [77, 100], [72, 140], [66, 180], [60, 163], [53, 141], [40, 128], [35, 120], [22, 114], [10, 106], [1, 104], [8, 98], [16, 94], [22, 90], [8, 77], [24, 67], [25, 57], [13, 45], [30, 32], [37, 27], [40, 20], [38, 15], [44, 12], [37, 0]],
  [[-11, 131], [-12, 142], [-25, 153], [-38, 147], [-35, 138], [-32, 115], [-22, 114], [-14, 127]],
  [[60, -44], [76, -70], [83, -35], [70, -22]],
];
export const sphereDir = (lat, lon) => { const a = lat * Math.PI / 180, b = lon * Math.PI / 180; return [Math.cos(a) * Math.cos(b), Math.cos(a) * Math.sin(b), Math.sin(a)]; };
export const globePoint = (g, lat, lon, up = 0) => add3(g.c, mul3(sphereDir(lat, lon + (g.rot || 0)), g.R + up));
export function globe(sc, g) {
  const V = sc.V, c = V.P(g.c), rs = g.R * V.s, D = V.D, id = sc.id('gl'), ocean = g.ocean || '#3E7BFA', land = g.land || PAL.mint; let o = '';
  sc.def(`<clipPath id="${id}"><circle cx="${f1(c[0])}" cy="${f1(c[1])}" r="${f1(rs)}"/></clipPath>`);
  const onS = (dir) => { let v = dir; const dv = dot3(v, D); if (dv < 0) v = norm3(sub3(v, mul3(D, dv))); return V.P(add3(g.c, mul3(v, g.R))); };
  o += `<circle cx="${f1(c[0])}" cy="${f1(c[1])}" r="${f1(rs)}" fill="${ocean}"/><g clip-path="url(#${id})">`;
  // inner ocean band (lighter shallow ring) for depth
  o += `<circle cx="${f1(c[0] - rs * .12)}" cy="${f1(c[1] - rs * .14)}" r="${f1(rs * .8)}" fill="${mix(ocean, PAL.sky, .28)}"/>`;
  const sub = (a, b, n) => Array.from({ length: n }, (_, i) => [a[0] + (b[0] - a[0]) * i / n, a[1] + (b[1] - a[1]) * i / n]);
  for (const C of CONT) { const pts = []; C.forEach((q, i) => pts.push(...sub(q, C[(i + 1) % C.length], 6))); o += `<path d="${poly(pts.map(q => onS(sphereDir(q[0], q[1] + (g.rot || 0)))))}" fill="${land}" stroke="${mix(land, PAL.cream, .4)}" stroke-width="${f1(1.2 * V.px)}" stroke-linejoin="round"/>`; }
  // graticule: front-facing parts only
  const grat = []; const seg = (dirs) => { let cur = []; for (const dv of dirs) { if (dot3(dv, D) > .02) cur.push(V.P(add3(g.c, mul3(dv, g.R)))); else { if (cur.length > 1) grat.push(cur); cur = []; } } if (cur.length > 1) grat.push(cur); };
  for (let la = -60; la <= 60; la += 30) seg(Array.from({ length: 73 }, (_, i) => sphereDir(la, i * 5)));
  for (let lo = 0; lo < 180; lo += 30) seg(Array.from({ length: 73 }, (_, i) => sphereDir(i * 5 - 180, lo + (g.rot || 0))).map(v => v));
  o += grat.map(p => `<path d="${line(p)}" fill="none" stroke="${rgba(PAL.cream, .16)}" stroke-width="${f1(1.2 * V.px)}"/>`).join('');
  // terminator: crisp dark crescent lower-right
  o += `<path d="M${f1(c[0] - rs)},${f1(c[1])}a${f1(rs)},${f1(rs)} 0 1 0 ${f1(2 * rs)},0a${f1(rs)},${f1(rs)} 0 1 0 ${f1(-2 * rs)},0Z M${f1(c[0] - rs * .3 - rs * 1.1)},${f1(c[1] - rs * .36)}a${f1(rs * 1.1)},${f1(rs * 1.1)} 0 1 0 ${f1(2.2 * rs)},0a${f1(rs * 1.1)},${f1(rs * 1.1)} 0 1 0 ${f1(-2.2 * rs)},0Z" fill="${rgba(PAL.shade, .38)}" fill-rule="evenodd"/>`;
  o += `</g>`;
  // limb rim light (upper-left) + thin atmosphere line
  const arc = (a0, a1, r) => { const p0 = [c[0] + r * Math.cos(a0), c[1] + r * Math.sin(a0)], p1 = [c[0] + r * Math.cos(a1), c[1] + r * Math.sin(a1)]; return `M${pt(p0)}A${f1(r)},${f1(r)} 0 0 1 ${pt(p1)}`; };
  o += `<circle cx="${f1(c[0])}" cy="${f1(c[1])}" r="${f1(rs + 5 * V.px)}" fill="none" stroke="${rgba(PAL.sky, .35)}" stroke-width="${f1(2 * V.px)}"/>`;
  o += `<path d="${arc(Math.PI * 1.05, Math.PI * 1.6, rs - 3 * V.px)}" fill="none" stroke="${rgba(PAL.cream, .75)}" stroke-width="${f1(3 * V.px)}" stroke-linecap="round"/>`;
  sc.add(o, V.dep(g.c), g.layer);
}
// orbit ring around a centre: split into short segments, each sorted by its own depth (back half dimmer, passes behind the globe)
export const orbitBasis = (inc, node) => { const i = inc * Math.PI / 180, n = node * Math.PI / 180; return [[Math.cos(n), Math.sin(n), 0], [-Math.sin(n) * Math.cos(i), Math.cos(n) * Math.cos(i), Math.sin(i)]]; };
export const orbitPos = (c, r, inc, node, th) => { const [u, v] = orbitBasis(inc, node); return add3(c, add3(mul3(u, r * Math.cos(th)), mul3(v, r * Math.sin(th)))); };
export function orbit(sc, s) {
  const V = sc.V, N = 120, dc = V.dep(s.c);
  for (let i = 0; i < N; i++) {
    const a = orbitPos(s.c, s.r, s.inc, s.node, i / N * TAU), b = orbitPos(s.c, s.r, s.inc, s.node, (i + 1) / N * TAU), m = mul3(add3(a, b), .5), back = V.dep(m) < dc;
    sc.add(`<path d="${line([V.P(a), V.P(b)])}" stroke="${rgba(s.color, back ? (s.backA ?? .28) : (s.frontA ?? .85))}" stroke-width="${f1((s.width ?? 2.2) * V.px)}" stroke-linecap="round" fill="none"/>`, V.dep(m), s.layer);
  }
}

// ---------------------------------------------------------------------------------------------------------------------------------
// satellite: body cube in its colour, two solar wings (panel blue with cell lines), dish, emitter dot (glow allowed: it transmits)
export function satellite(sc, s) {
  const V = sc.V, k = s.scale ?? 1, [x, y, z] = s.p, b = .26 * k, col = s.color || PAL.saffron; let o = '';
  const wing = (x0) => { const W = { x: x0, y: y - .2 * k, z: z - .03 * k, w: .78 * k, d: .4 * k, h: .06 * k }; let q = boxSvg(V, { ...W, tones: { top: mix(PAL.panel, PAL.sky, .25), mid: PAL.panel, dark: mix(PAL.panel, PAL.shade, .4) }, rimA: .4 });
    for (let j = 1; j < 4; j++) q += `<path d="${line([V.P(x0 + W.w * j / 4, W.y, W.z + W.h), V.P(x0 + W.w * j / 4, W.y + W.d, W.z + W.h)])}" stroke="${rgba(PAL.sky, .8)}" stroke-width="${f1(1.1 * V.px)}"/>`;
    q += `<path d="${line([V.P(x0, W.y + W.d / 2, W.z + W.h), V.P(x0 + W.w, W.y + W.d / 2, W.z + W.h)])}" stroke="${rgba(PAL.sky, .8)}" stroke-width="${f1(1.1 * V.px)}"/>`; return q; };
  const rod = `<path d="${line([V.P(x - b - .1 * k, y, z), V.P(x + b + .1 * k, y, z)])}" stroke="${PAL.cream}" stroke-width="${f1(2 * V.px)}"/>`;
  o += wing(x - b - .1 * k - .78 * k) + rod + boxSvg(V, { x: x - b, y: y - b, z: z - b, w: 2 * b, d: 2 * b, h: 2 * b, color: col }) + wing(x + b + .1 * k);
  // dish on top
  const dc = V.P(x, y, z + b + .12 * k), dr = .17 * k * V.s; o += `<path d="${line([V.P(x, y, z + b), dc])}" stroke="${PAL.cream}" stroke-width="${f1(1.6 * V.px)}"/><ellipse cx="${f1(dc[0])}" cy="${f1(dc[1])}" rx="${f1(dr)}" ry="${f1(dr * .55)}" fill="${PAL.cream}"/><ellipse cx="${f1(dc[0])}" cy="${f1(dc[1] + dr * .1)}" rx="${f1(dr * .6)}" ry="${f1(dr * .3)}" fill="${mix(PAL.cream, PAL.shade, .25)}"/>`;
  if (s.emit !== false) { const e = V.P(x, y, z + b + .32 * k); o += `<circle cx="${f1(e[0])}" cy="${f1(e[1])}" r="${f1(3.2 * V.px)}" fill="${mix(col, PAL.cream, .5)}" filter="url(#glow)"/>`; }
  sc.add(o, s.depth ?? V.dep(x, y, z), s.layer);
}
// phone: thin upright slab, screen on the +y face with a mini map + location dot (dot glows: it is the receiver's live fix)
export function phone(sc, s) {
  const V = sc.V, k = s.scale ?? 1, [x, y, z] = s.p, w = .62 * k, d = .13 * k, h = 1.12 * k, B = { x: x - w / 2, y: y - d / 2, z, w, d, h, color: s.color || PAL.violet };
  let o = (s.shadow !== false ? shadowSvg(V, x + .1 * k, y + .2 * k, z, .5 * k, .3) : '') + boxSvg(V, B);
  const scr = faceQuad(V, B, 'left', .05 * k, .1 * k, w - .05 * k, h - .08 * k); o += `<path d="${poly(scr)}" fill="${PAL.ink}"/>`;
  const fq = (u, v) => facePt(V, B, 'left', u, v);
  for (const [u0, v0, u1, v1] of [[.05, .45, .57, .52], [.3, .1, .36, 1.04], [.05, .78, .57, .82]]) o += `<path d="${poly([fq(u0 * k, v0 * k), fq(u1 * k, v0 * k), fq(u1 * k, v1 * k), fq(u0 * k, v1 * k)])}" fill="${rgba(PAL.sky, .28)}"/>`;
  const dot = fq(.33 * k, .5 * k); o += `<circle cx="${f1(dot[0])}" cy="${f1(dot[1])}" r="${f1(4.5 * V.px * k)}" fill="${PAL.sky}" filter="url(#glow)"/><circle cx="${f1(dot[0])}" cy="${f1(dot[1])}" r="${f1(9 * V.px * k)}" fill="none" stroke="${rgba(PAL.sky, .7)}" stroke-width="${f1(1.4 * V.px)}"/>`;
  const sp = fq(w / 2, h - .04 * k); o += `<circle cx="${f1(sp[0])}" cy="${f1(sp[1])}" r="${f1(1.6 * V.px)}" fill="${rgba(PAL.cream, .6)}"/>`;
  sc.add(o, s.depth ?? V.dep(x, y, z + h / 2), s.layer);
}
// map pin (screen-space teardrop at a world tip point), 2-tone, cream eye; drop = motion streaks above; shadow on the ground at gz
export function pin(sc, s) {
  const V = sc.V, tip = V.P(s.p), r = (s.size ?? .32) * V.s, col = s.color || PAL.coral, T = tones(col), [tx, ty] = tip, id = sc.id('pin'); let o = '';
  if (s.ground != null) { const g = V.P(s.p[0], s.p[1], s.ground), k = s.shadowK ?? 1; o += `<ellipse cx="${f1(g[0])}" cy="${f1(g[1])}" rx="${f1(r * .8 * k)}" ry="${f1(r * .8 * k * V.K)}" fill="${rgba(PAL.shade, .35)}"/>`; }
  if (s.streak) for (let i = 0; i < 3; i++) { const dx = (i - 1) * r * .55, L = r * (1.5 + (i === 1) * .9) * s.streak; o += `<path d="M${f1(tx + dx)},${f1(ty - r * 3.5)}l0,${f1(-L)}" stroke="${rgba(PAL.cream, .5 - Math.abs(i - 1) * .2)}" stroke-width="${f1(2.2 * V.px)}" stroke-linecap="round"/>`; }
  const d = `M${f1(tx)},${f1(ty)}C${f1(tx - r * .45)},${f1(ty - r * .9)} ${f1(tx - r)},${f1(ty - r * 1.35)} ${f1(tx - r)},${f1(ty - r * 2.15)}A${f1(r)},${f1(r)} 0 1 1 ${f1(tx + r)},${f1(ty - r * 2.15)}C${f1(tx + r)},${f1(ty - r * 1.35)} ${f1(tx + r * .45)},${f1(ty - r * .9)} ${f1(tx)},${f1(ty)}Z`;
  sc.def(`<clipPath id="${id}"><rect x="${f1(tx)}" y="${f1(ty - r * 4)}" width="${f1(r * 2)}" height="${f1(r * 4.2)}"/></clipPath>`);
  o += `<path d="${d}" fill="${T.top}"/><path d="${d}" fill="${T.dark}" clip-path="url(#${id})"/><circle cx="${f1(tx)}" cy="${f1(ty - r * 2.15)}" r="${f1(r * .42)}" fill="${PAL.cream}"/>`;
  o += `<path d="M${f1(tx - r * .62)},${f1(ty - r * 2.6)}A${f1(r * .8)},${f1(r * .8)} 0 0 1 ${f1(tx - r * .1)},${f1(ty - r * 2.95)}" fill="none" stroke="${rgba(PAL.cream, .7)}" stroke-width="${f1(2 * V.px)}" stroke-linecap="round"/>`;
  sc.add(o, s.depth ?? 1e5, s.layer || 'top');
}

// ---------------------------------------------------------------------------------------------------------------------------------
// building: 3-tone box + window grid on both visible faces (some lit cream, some dark), optional roof unit
export function building(sc, s) {
  const V = sc.V, R = rng(s.seed ?? Math.round(s.x * 31 + s.y * 17 + 5)), B = { ...s, z: s.z ?? 0 }, T = tones(s.color);
  let ex = '';
  const grid = (face, span, wc, dk) => {
    const cols = Math.max(1, Math.floor(span / .42)), rows = Math.max(1, Math.floor((s.h - .3) / .5)), cw = span / cols, rh = (s.h - .3) / rows;
    for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) { const lit = R() < (s.litP ?? .45), fill = lit ? rgba(PAL.cream, face === 'left' ? .9 : .7) : rgba(dk, .55); ex += `<path d="${poly(faceQuad(V, B, face, i * cw + cw * .22, .25 + j * rh + rh * .2, (i + 1) * cw - cw * .22, .25 + (j + 1) * rh - rh * .18))}" fill="${fill}"/>`; }
  };
  if (s.windows !== false) { grid('left', s.w, T.top, mix(T.mid, PAL.shade, .45)); grid('right', s.d, T.top, mix(T.dark, PAL.shade, .45)); }
  let o = shadowSvg(V, s.x + s.w / 2 + .25, s.y + s.d / 2 + .25, B.z, Math.max(s.w, s.d) * .62, .22) + boxSvg(V, { ...B, extra: ex });
  if (s.roof === 'tank') { const c = [s.x + s.w * .35, s.y + s.d * .4, B.z + s.h + .38]; o += cylSvg(V, { c, r: Math.min(s.w, s.d) * .2, h: .38, color: PAL.cream }); }
  else if (s.roof === 'unit') o += boxSvg(V, { x: s.x + s.w * .2, y: s.y + s.d * .2, z: B.z + s.h, w: s.w * .38, d: s.d * .35, h: .2, color: mix(s.color, PAL.cream, .45) });
  else if (s.roof === 'antenna') { const a = V.P(s.x + s.w * .5, s.y + s.d * .5, B.z + s.h), b = V.P(s.x + s.w * .5, s.y + s.d * .5, B.z + s.h + .8); o += `<path d="M${pt(a)}L${pt(b)}" stroke="${PAL.cream}" stroke-width="${f1(2 * V.px)}"/><circle cx="${f1(b[0])}" cy="${f1(b[1])}" r="${f1(3 * V.px)}" fill="${PAL.coral}" filter="url(#glow)"/>`; }
  sc.add(o, s.depth ?? V.dep(s.x + s.w / 2, s.y + s.d / 2, B.z + s.h * .3), s.layer);
  return { top: [s.x + s.w / 2, s.y + s.d / 2, B.z + s.h] };
}
// keep the part of a convex polygon with screen x >= cx (Sutherland-Hodgman against one vertical line)
function clipX(ps, cx) { const o = []; for (let i = 0; i < ps.length; i++) { const a = ps[i], b = ps[(i + 1) % ps.length], ia = a[0] >= cx, ib = b[0] >= cx; if (ia) o.push(a); if (ia !== ib) { const t = (cx - a[0]) / (b[0] - a[0]); o.push([cx, a[1] + (b[1] - a[1]) * t]); } } return o; }
// cylinder / puck with any axis ('z' upright, 'y' facing lower-left, 'x' facing lower-right). hull band + front face. c = centre of FRONT face
export function cylSvg(V, s) {
  const ax = s.axis || 'z', r = s.r, h = s.h, T = s.tones || tones(s.color || PAL.cream, s), N = 40, c = s.c;
  const e = ax === 'z' ? [[1, 0, 0], [0, 1, 0], [0, 0, 1]] : ax === 'y' ? [[1, 0, 0], [0, 0, 1], [0, 1, 0]] : [[0, 1, 0], [0, 0, 1], [1, 0, 0]];
  const ring = off => Array.from({ length: N }, (_, i) => { const a = i / N * TAU; return V.P(add3(c, add3(add3(mul3(e[0], r * Math.cos(a)), mul3(e[1], r * Math.sin(a))), mul3(e[2], off)))); });
  const front = ax === 'z' ? ring(0) : ring(0), back = ax === 'z' ? ring(-h) : ring(-h), hl = hull(front.concat(back)), fc = V.P(c);
  const sideCol = ax === 'x' ? T.dark : T.mid, faceCol = ax === 'z' ? T.top : ax === 'y' ? T.mid : T.dark;
  let o = `<path d="${poly(hl)}" fill="${ax === 'z' ? T.mid : T.dark}"/>`;
  if (ax === 'z') o += `<path d="${poly(clipX(hl, fc[0]))}" fill="${T.dark}"/>`;   // right half of the body darker (3-tone)
  o += `<path d="${poly(front)}" fill="${s.face || (ax === 'z' ? T.top : mix(sideCol, PAL.cream, .1))}"/>`;
  if (s.rim !== false) o += `<path d="${poly(front)}" fill="none" stroke="${rgba(PAL.cream, .45)}" stroke-width="${f1(1.3 * V.px)}"/>`;
  return o;
}
export const cyl = (sc, s) => sc.add(cylSvg(sc.V, s), s.depth ?? sc.V.dep(s.c), s.layer);
// clock: puck facing lower-left (axis y), coloured bezel, cream dial, 12 ticks, hands; ghost hands = earlier positions (drift trail)
export function clock(sc, s) {
  const V = sc.V, c = s.c, r = s.r ?? 1, col = s.color || PAL.sky, T = tones(col), N = 48, ex = [1, 0, 0], ez = [0, 0, 1];
  const at = (rad, a) => V.P(add3(c, add3(mul3(ex, rad * Math.sin(a)), mul3(ez, rad * Math.cos(a)))));
  let o = cylSvg(V, { c, r, h: .32 * r, axis: 'y', tones: { top: T.top, mid: T.mid, dark: T.dark }, face: T.mid });
  o += `<path d="${poly(Array.from({ length: N }, (_, i) => at(r * .8, i / N * TAU)))}" fill="${PAL.cream}"/>`;
  for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; o += `<path d="${line([at(r * (i % 3 ? .7 : .62), a), at(r * .76, a)])}" stroke="${mix(col, PAL.shade, .35)}" stroke-width="${f1((i % 3 ? 2 : 3.4) * V.px)}" stroke-linecap="round"/>`; }
  const hand = (a, L, wd, colr, op = 1) => `<path d="${line([at(r * .06 * -1, a), at(r * L, a)])}" stroke="${colr}" stroke-opacity="${op}" stroke-width="${f1(wd * V.px)}" stroke-linecap="round"/>`;
  for (const [g, op] of (s.ghost || [])) o += hand(g, .66, 4, col, op);
  o += hand(s.hour ?? 0, .42, 6, PAL.ink) + hand(s.min ?? 0, .66, 4, col);
  const cc = V.P(c); o += `<circle cx="${f1(cc[0])}" cy="${f1(cc[1])}" r="${f1(4.5 * V.px)}" fill="${PAL.ink}"/>`;
  // crown + buttons on top
  o += boxSvg(V, { x: c[0] - .12 * r, y: c[1] - .22 * r, z: c[2] + r * .98, w: .24 * r, d: .16 * r, h: .16 * r, color: col });
  sc.add(o, s.depth ?? V.dep(c), s.layer || 'air');
}
// cell tower: tapered lattice (legs + bracing) with antenna panels and a beacon (glow)
export function tower(sc, s) {
  const V = sc.V, [x, y, z] = s.p, h = s.h ?? 3, b = s.base ?? .5, tp = .12, col = s.color || PAL.cream, legs = [[-1, -1], [1, -1], [1, 1], [-1, 1]]; let o = shadowSvg(V, x + .3, y + .3, z, b * 1.2, .22);
  const L = (i, f) => { const w = b + (tp - b) * f; return V.P(x + legs[i][0] * w, y + legs[i][1] * w, z + h * f); };
  for (const i of [0, 1, 3, 2]) o += `<path d="${line([L(i, 0), L(i, 1)])}" stroke="${i === 2 ? col : mix(col, PAL.shade, .25)}" stroke-width="${f1(2.6 * V.px)}" stroke-linecap="round"/>`;
  for (let k = 0; k < 4; k++) { const f0 = k / 4, f1_ = (k + 1) / 4; o += `<path d="${line([L(3, f0), L(2, f1_), L(1, f0)])}" fill="none" stroke="${rgba(col, .7)}" stroke-width="${f1(1.4 * V.px)}"/>`; }
  for (const [dx, dy] of [[0, .14], [.14, 0]]) o += boxSvg(V, { x: x + dx - .08, y: y + dy - .08, z: z + h * .78, w: .16 + dx * .2, d: .16 + dy * .2, h: .4, color: s.panel || PAL.violet });
  const bc = V.P(x, y, z + h + .1); o += `<circle cx="${f1(bc[0])}" cy="${f1(bc[1])}" r="${f1(4 * V.px)}" fill="${PAL.coral}" filter="url(#glow)"/>`;
  sc.add(o, V.dep(x, y, z + h * .4), s.layer);
}
// cable: sagging tube between two world points (dark core + highlight)
export function cable(sc, a, b, s = {}) {
  const V = sc.V, A = V.P(a), B = V.P(b), m = [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2 + (s.sag ?? .5) * V.s], d = `M${pt(A)}Q${pt(m)} ${pt(B)}`;
  sc.add(`<path d="${d}" fill="none" stroke="${mix(s.color || PAL.violet, PAL.shade, .4)}" stroke-width="${f1((s.w ?? 6) * V.px)}" stroke-linecap="round"/><path d="${d}" fill="none" stroke="${mix(s.color || PAL.violet, PAL.cream, .3)}" stroke-width="${f1(1.6 * V.px)}" stroke-linecap="round" transform="translate(0,${f1(-1.5 * V.px)})"/>`, s.depth ?? V.dep(mul3(add3(a, b), .5)), s.layer);
}

// ---------------------------------------------------------------------------------------------------------------------------------
// SIGNALS (glow allowed)
// horizontal ring(s) in a plane at z: expanding pulse rings (ph 0..1 per ring), dark underlay for contrast on light grounds
export function rings(sc, s) {
  const V = sc.V, [x, y, z] = s.p, n = s.n ?? 3, R = s.r ?? 1.6, ph = s.phase ?? 0; let o = '';
  for (let i = 0; i < n; i++) {
    const f = ((i / n + ph) % 1), r = (s.r0 ?? .15) + (R - (s.r0 ?? .15)) * f, a = (1 - f) * (s.alpha ?? 1), c = V.P(x, y, z), rx = r * V.s, ry = rx * V.K;
    o += `<ellipse cx="${f1(c[0])}" cy="${f1(c[1])}" rx="${f1(rx)}" ry="${f1(ry)}" fill="none" stroke="${rgba(s.color || PAL.sky, a)}" stroke-width="${f1((s.w ?? 2.6) * V.px)}" filter="url(#glow)"/>`;
  }
  sc.add(o, s.depth ?? V.dep(x, y, z), s.layer || 'fx');
}
// ground circle (sphere x ground plane): strong ring with a dark underlay so it reads on mint
export function groundCircle(sc, s) {
  const V = sc.V, c = V.P(s.c), rx = s.r * V.s, ry = rx * V.K, col = s.color;
  const g = `<ellipse cx="${f1(c[0])}" cy="${f1(c[1])}" rx="${f1(rx)}" ry="${f1(ry)}" fill="${rgba(col, s.fillA ?? .1)}" stroke="${rgba(PAL.shade, .45)}" stroke-width="${f1(7 * V.px)}"/><ellipse cx="${f1(c[0])}" cy="${f1(c[1])}" rx="${f1(rx)}" ry="${f1(ry)}" fill="none" stroke="${col}" stroke-width="${f1((s.w ?? 3.2) * V.px)}" filter="url(#glow)"${s.dash ? ` stroke-dasharray="${s.dash}"` : ''}/>`;
  sc.add(s.clip ? `<g clip-path="url(#${s.clip})">${g}</g>` : g, s.depth ?? 0, s.layer || 'floor');
}
// pulse sphere: translucent disc + glowing limb + equator ellipse + inner echo wavefronts (earlier pulses) for motion
export function pulseSphere(sc, s) {
  const V = sc.V, c = V.P(s.c), rs = s.r * V.s, col = s.color; let o = '';
  o += `<circle cx="${f1(c[0])}" cy="${f1(c[1])}" r="${f1(rs)}" fill="${rgba(col, s.fillA ?? .07)}"/>`;
  for (const [k, a] of (s.echo || [[.72, .22], [.46, .14]])) o += `<circle cx="${f1(c[0])}" cy="${f1(c[1])}" r="${f1(rs * k)}" fill="none" stroke="${rgba(col, a)}" stroke-width="${f1(1.6 * V.px)}"/>`;
  o += `<ellipse cx="${f1(c[0])}" cy="${f1(c[1])}" rx="${f1(rs)}" ry="${f1(rs * V.K)}" fill="none" stroke="${rgba(col, s.eqA ?? .35)}" stroke-width="${f1(1.4 * V.px)}" stroke-dasharray="${f1(6 * V.px)} ${f1(7 * V.px)}"/>`;
  o += `<circle cx="${f1(c[0])}" cy="${f1(c[1])}" r="${f1(rs)}" fill="none" stroke="${rgba(col, s.rimA ?? .85)}" stroke-width="${f1((s.w ?? 2.6) * V.px)}" filter="url(#glow)"/>`;
  sc.add(o, s.depth ?? 0, s.layer || 'fx');
}
// beam: glowing line from a to b, optional travelling packet at fraction pk
export function beam(sc, a, b, s = {}) {
  const V = sc.V, A = V.P(a), B = V.P(b), col = s.color || PAL.sky; let o = `<path d="M${pt(A)}L${pt(B)}" stroke="${rgba(col, s.alpha ?? .8)}" stroke-width="${f1((s.w ?? 2.4) * V.px)}" stroke-linecap="round"${s.dash ? ` stroke-dasharray="${s.dash}"` : ''} filter="url(#glow)"/>`;
  if (s.pk != null) { const p = [A[0] + (B[0] - A[0]) * s.pk, A[1] + (B[1] - A[1]) * s.pk]; o += `<circle cx="${f1(p[0])}" cy="${f1(p[1])}" r="${f1(5 * V.px)}" fill="${mix(col, PAL.cream, .5)}" filter="url(#glow)"/>`; }
  sc.add(o, s.depth ?? 0, s.layer || 'fx');
}
// wifi glyph (screen-space arcs above a world point), glow: it is an emitter
export function wifi(sc, s) {
  const V = sc.V, p = V.P(s.p), k = (s.size ?? .5) * V.s, col = s.color || PAL.sky; let o = `<circle cx="${f1(p[0])}" cy="${f1(p[1])}" r="${f1(k * .11)}" fill="${col}"/>`;
  for (let i = 1; i <= 3; i++) { const r = k * (.28 + i * .26), a = .7; o += `<path d="M${f1(p[0] - r * Math.sin(a))},${f1(p[1] - r * Math.cos(a))}A${f1(r)},${f1(r)} 0 0 1 ${f1(p[0] + r * Math.sin(a))},${f1(p[1] - r * Math.cos(a))}" fill="none" stroke="${rgba(col, 1 - (i - 1) * .2 * (s.fade ?? 1))}" stroke-width="${f1(k * .12)}" stroke-linecap="round"/>`; }
  sc.add(`<g filter="url(#glow)">${o}</g>`, s.depth ?? 0, s.layer || 'fx');
}

// ---------------------------------------------------------------------------------------------------------------------------------
// HUD: small mono-caps tag pinned to a world point (secondary: small, thin border in the subject's colour)
export function tag(sc, anchor, text, s = {}) {
  const V = sc.V, a = Array.isArray(anchor) ? V.P(anchor) : anchor, fs = (s.size ?? 20) * V.px, cw = fs * .62, w = text.length * cw + fs * 1.3, h = fs * 1.9, col = s.color || PAL.cream;
  const dx = (s.dx ?? 0) * V.px, dy = (s.dy ?? -60) * V.px, cx = Math.min(V.W - w / 2 - 12, Math.max(w / 2 + 12, a[0] + dx)), top = a[1] + dy - (dy < 0 ? h : 0);
  let o = `<path d="M${pt(a)}L${f1(cx)},${f1(dy < 0 ? top + h : top)}" stroke="${rgba(col, .8)}" stroke-width="${f1(1.3 * V.px)}"/><circle cx="${f1(a[0])}" cy="${f1(a[1])}" r="${f1(3.6 * V.px)}" fill="${col}"/>`;
  o += `<rect x="${f1(cx - w / 2)}" y="${f1(top)}" width="${f1(w)}" height="${f1(h)}" rx="${f1(4 * V.px)}" fill="${rgba(PAL.ink, .88)}" stroke="${rgba(col, .9)}" stroke-width="${f1(1.3 * V.px)}"/>`;
  o += `<text x="${f1(cx)}" y="${f1(top + h * .66)}" text-anchor="middle" font-family="Geist Mono, monospace" font-weight="500" font-size="${f1(fs)}" letter-spacing="${f1(fs * .06)}" fill="${PAL.cream}">${text}</text>`;
  sc.add(o, 0, 'hud');
}
// motion arrow in screen space between two world points (for drift / separation)
export function arrow(sc, a, b, s = {}) {
  const V = sc.V, A = V.P(a), B = V.P(b), ang = Math.atan2(B[1] - A[1], B[0] - A[0]), L = 12 * V.px, col = s.color || PAL.cream;
  sc.add(`<path d="M${pt(A)}L${pt(B)}M${f1(B[0] - L * Math.cos(ang - .5))},${f1(B[1] - L * Math.sin(ang - .5))}L${pt(B)}L${f1(B[0] - L * Math.cos(ang + .5))},${f1(B[1] - L * Math.sin(ang + .5))}" fill="none" stroke="${rgba(col, s.alpha ?? .8)}" stroke-width="${f1((s.w ?? 2.2) * V.px)}" stroke-linecap="round" stroke-linejoin="round"${s.dash ? ` stroke-dasharray="${s.dash}"` : ''}/>`, 0, s.layer || 'hud');
}

// ---------------------------------------------------------------------------------------------------------------------------------
// (added 2026-11-11, generic) orbit trail: only the arc behind a satellite (th-span .. th), alpha ramps up towards the satellite.
// Reads cleaner than full rings when several orbits cross. Depth-sorted per segment like orbit().
export function orbitArc(sc, s) {
  const V = sc.V, N = s.n ?? 40, span = s.span ?? 2.2, dc = V.dep(s.c), a0 = s.a ?? 1;
  for (let i = 0; i < N; i++) {
    const f0 = i / N, f1_ = (i + 1) / N, ta = s.th - span * (1 - f0), tb = s.th - span * (1 - f1_);
    const a = orbitPos(s.c, s.r, s.inc, s.node, ta), b = orbitPos(s.c, s.r, s.inc, s.node, tb), m = mul3(add3(a, b), .5), back = V.dep(m) < dc;
    sc.add(`<path d="${line([V.P(a), V.P(b)])}" stroke="${rgba(s.color, a0 * f1_ * f1_ * (back ? .35 : .9))}" stroke-width="${f1((s.width ?? 2.6) * V.px)}" stroke-linecap="round" fill="none"/>`, V.dep(m), s.layer);
  }
}
// HUD readout: mono text on a dark pill at a screen point or world anchor (no leader). s: {size, color, dx, dy, align:'c'|'l'|'r', alpha, bold}
export function hud(sc, anchor, text, s = {}) {
  const V = sc.V, a = Array.isArray(anchor) && anchor.length === 3 ? V.P(anchor) : anchor, fs = (s.size ?? 22) * V.px, w = String(text).length * fs * .62 + fs * 1.2, h = fs * 1.75, col = s.color || PAL.cream;
  const x = a[0] + (s.dx ?? 0) * V.px, y = a[1] + (s.dy ?? 0) * V.px, al = s.align || 'c', left = al === 'l' ? x : al === 'r' ? x - w : x - w / 2, cx = Math.min(V.W - w - 10, Math.max(10, left));
  sc.add(`<g opacity="${(s.alpha ?? 1).toFixed(3)}"><rect x="${f1(cx)}" y="${f1(y - h / 2)}" width="${f1(w)}" height="${f1(h)}" rx="${f1(5 * V.px)}" fill="${rgba(PAL.ink, .9)}" stroke="${rgba(col, .85)}" stroke-width="${f1(1.4 * V.px)}"/>`
    + `<text x="${f1(cx + w / 2)}" y="${f1(y + fs * .36)}" text-anchor="middle" font-family="Geist Mono, monospace" font-weight="500" font-size="${f1(fs)}" letter-spacing="${f1(fs * .04)}" fill="${s.textColor || col}">${text}</text></g>`, 0, s.layer || 'hud');
}
// dimension line (ruler) between two world points: line + end ticks perpendicular on screen, optional HUD label at the middle; k = draw progress 0..1
export function dim(sc, a, b, s = {}) {
  const V = sc.V, A = V.P(a), B0 = V.P(b), k = s.k ?? 1, B = [A[0] + (B0[0] - A[0]) * k, A[1] + (B0[1] - A[1]) * k], L = Math.hypot(B[0] - A[0], B[1] - A[1]) || 1, nx = -(B[1] - A[1]) / L * 9 * V.px, ny = (B[0] - A[0]) / L * 9 * V.px, col = s.color || PAL.cream;
  let o = `<path d="M${pt(A)}L${pt(B)}M${f1(A[0] - nx)},${f1(A[1] - ny)}L${f1(A[0] + nx)},${f1(A[1] + ny)}" stroke="${rgba(col, .9)}" stroke-width="${f1((s.w ?? 2) * V.px)}" stroke-linecap="round"${s.dash ? ` stroke-dasharray="${s.dash}"` : ''}/>`;
  if (k >= .999) o += `<path d="M${f1(B[0] - nx)},${f1(B[1] - ny)}L${f1(B[0] + nx)},${f1(B[1] + ny)}" stroke="${rgba(col, .9)}" stroke-width="${f1((s.w ?? 2) * V.px)}" stroke-linecap="round"/>`;
  sc.add(o, s.depth ?? 0, s.layer || 'air');
  if (s.label) hud(sc, [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2], s.label, { color: col, size: s.size ?? 20, dx: s.ldx ?? 0, dy: s.ldy ?? 0, alpha: s.labelA ?? 1 });
}
// packet: a glowing dot travelling from world a to b at fraction k (0..1), with a short fading tail (emitter -> glow allowed)
export function packet(sc, a, b, k, s = {}) {
  const V = sc.V, A = V.P(a), B = V.P(b), col = s.color || PAL.sky, at = q => [A[0] + (B[0] - A[0]) * q, A[1] + (B[1] - A[1]) * q], p = at(k), tl = at(Math.max(0, k - (s.tail ?? .12)));
  sc.add(`<path d="M${pt(tl)}L${pt(p)}" stroke="${rgba(col, .7)}" stroke-width="${f1(5 * V.px)}" stroke-linecap="round" filter="url(#glow)"/><circle cx="${f1(p[0])}" cy="${f1(p[1])}" r="${f1((s.r ?? 7) * V.px)}" fill="${mix(col, PAL.cream, .55)}" filter="url(#glow2)"/>`, s.depth ?? 0, s.layer || 'fx');
}
