// mg2d/art.js - illustration library for 2D element MG cards. Each art(g, k, p, PAL): k = 0..1 reveal progress,
// p = params from the film spec. Drawn in card space: centre (0,0), art area about x -300..300, y -250..190.
// Style: soft two-tone fills, rounded ink outlines (4-5 px), one red accent at most, gentle overshoot reveals.
const ease = u => u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u), clamp = (x, a, b) => Math.max(a, Math.min(b, x)), lerp = (a, b, u) => a + (b - a) * u;
const back = u => { if (u <= 0) return 0; if (u >= 1) return 1; const k = u - 1; return 1 + 2.2 * k * k * k + 1.2 * k * k; };
const seg = (k, a, b) => clamp((k - a) / (b - a), 0, 1);
function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
const ink = (g, P, w = 4.5) => { g.strokeStyle = P.ink; g.lineWidth = w; g.lineJoin = "round"; g.lineCap = "round"; g.stroke(); };
function popIn(g, u, x, y, f) { const s = back(u); if (s <= 0) return; g.save(); g.translate(x, y); g.scale(s, s); f(); g.restore(); }
function topShip(g, x, y, L, wd, ang, fill, deck, P, outline = true) {
  g.save(); g.translate(x, y); g.rotate(ang); g.beginPath(); g.moveTo(-L / 2, -wd / 2); g.lineTo(L / 2 - wd * 0.7, -wd / 2); g.quadraticCurveTo(L / 2 + wd * 0.35, 0, L / 2 - wd * 0.7, wd / 2); g.lineTo(-L / 2, wd / 2); g.closePath();
  g.fillStyle = fill; g.fill(); if (outline) ink(g, P, 3.5);
  if (deck) { g.fillStyle = deck; for (let i = 0; i < 7; i++) { rr(g, -L / 2 + L * 0.17 + i * L * 0.093, -wd * 0.3, L * 0.075, wd * 0.6, 2); g.fill(); } rr(g, -L / 2 + L * 0.03, -wd * 0.36, L * 0.09, wd * 0.72, 3); g.fill(); }
  g.restore(); }

export const ART = {
  // top-down canal: banks, water, a queue of grey ships drifting in, the red ship swinging into the wedge
  canal(g, k, p, P) { const aw = 560, ah = 380, x0 = -aw / 2, y0 = -ah / 2 - 10; g.save(); rr(g, x0, y0, aw, ah, 16); g.clip();
    g.fillStyle = P.sand; g.fillRect(x0, y0, aw, ah); g.fillStyle = "rgba(160,140,100,.10)"; for (let i = 0; i < 26; i++) { g.beginPath(); g.arc(x0 + (i * 97) % aw, y0 + (i * 53) % ah, 6 + (i % 4) * 3, 0, 7); g.fill(); }
    const cy = y0 + ah * 0.52, cw = ah * 0.32; g.fillStyle = P.water; g.fillRect(x0, cy - cw / 2, aw, cw);
    g.strokeStyle = "rgba(255,255,255,.55)"; g.lineWidth = 3; for (let i = 0; i < 6; i++) { const wx = x0 + ((i * 110 + k * 40) % aw); g.beginPath(); g.moveTo(wx, cy - 14 + (i % 3) * 14); g.lineTo(wx + 34, cy - 14 + (i % 3) * 14); g.stroke(); }
    g.strokeStyle = P.ink; g.lineWidth = 4; for (const s of [-1, 1]) { g.beginPath(); g.moveTo(x0, cy + s * cw / 2); g.lineTo(x0 + aw, cy + s * cw / 2); g.stroke(); }
    const nq = p.queue ?? 5; for (let i = 0; i < nq; i++) { const q = seg(k, 0.05 + i * 0.07, 0.3 + i * 0.07); if (q <= 0) continue; g.globalAlpha = q;
      topShip(g, x0 + 54 + i * 52 - (1 - ease(q)) * 40, cy + (i % 2 ? 11 : -11), 44, 18, 0, "#c9c3b6", "#dcd7cc", P, false); }
    g.globalAlpha = 1; const ang = -lerp(3, 31, ease(seg(k, 0.15, 0.85))) * Math.PI / 180; topShip(g, aw * 0.14, cy, ah * 0.66, ah * 0.12, ang, P.red, "#e8675e", P);
    g.restore(); g.strokeStyle = P.ink; g.lineWidth = 4.5; rr(g, x0, y0, aw, ah, 16); g.stroke(); },

  // globe with a shipping route drawing through a chokepoint + share badge (p.share = 0..1)
  globe(g, k, p, P) { const R = 200; g.save(); g.translate(-10, -20);
    const gg = g.createRadialGradient(-60, -70, 20, 0, 0, R); gg.addColorStop(0, "#f2f6f7"); gg.addColorStop(1, "#d9e5e9"); g.fillStyle = gg; g.beginPath(); g.arc(0, 0, R, 0, 7); g.fill();
    g.save(); g.clip(); g.fillStyle = "#e3ddcf"; for (const [x, y, rx, ry, a] of [[-70, -70, 100, 62, .3], [-28, 50, 58, 100, -.2], [110, -45, 115, 72, .1], [150, 85, 48, 36, 0]]) { g.beginPath(); g.ellipse(x, y, rx, ry, a, 0, 7); g.fill(); g.strokeStyle = "rgba(43,42,39,.25)"; g.lineWidth = 2; g.stroke(); }
    g.strokeStyle = "rgba(43,42,39,.12)"; g.lineWidth = 2; for (let i = -2; i <= 2; i++) { g.beginPath(); g.ellipse(0, 0, Math.abs(i) * 48 + 6, R, 0, 0, 7); g.stroke(); g.beginPath(); g.moveTo(-R, i * 70); g.lineTo(R, i * 70); g.stroke(); }
    g.restore(); g.beginPath(); g.arc(0, 0, R, 0, 7); ink(g, P, 5);
    const pts = [[180, 30], [100, 12], [32, -4], [-8, -40], [-80, -96], [-150, -112]], u = ease(seg(k, 0.05, 0.75)), n = u * (pts.length - 1), j = Math.floor(n), f = n - j;
    g.strokeStyle = P.red; g.lineWidth = 9; g.lineCap = "round"; g.beginPath(); g.moveTo(...pts[0]); for (let i = 1; i <= j; i++) g.lineTo(...pts[i]); if (j < pts.length - 1) g.lineTo(lerp(pts[j][0], pts[j + 1][0], f), lerp(pts[j][1], pts[j + 1][1], f)); g.stroke();
    popIn(g, seg(k, 0.35, 0.6), 32, -4, () => { g.fillStyle = P.paper; g.beginPath(); g.arc(0, 0, 17, 0, 7); g.fill(); g.strokeStyle = P.red; g.lineWidth = 6; g.stroke(); });
    popIn(g, seg(k, 0.6, 0.9), R * 0.8, R * 0.78, () => { g.fillStyle = P.paper; g.beginPath(); g.arc(0, 0, 64, 0, 7); g.fill(); ink(g, P, 4.5);
      g.fillStyle = P.red; g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, 52, -Math.PI / 2, -Math.PI / 2 + (p.share ?? 0.12) * Math.PI * 2 * ease(seg(k, 0.7, 1))); g.closePath(); g.fill(); });
    g.restore(); },

  // a count made visible: n small ship icons filling row by row; first one red (p.n, p.cols)
  grid(g, k, p, P) { const N = p.n ?? 369, cols = p.cols ?? 23, rows = Math.ceil(N / cols), sx = 24, sy = Math.min(22, 400 / rows), x0 = -cols * sx / 2 + 3, y0 = -rows * sy / 2 - 20, m = Math.floor(ease(seg(k, 0.02, 0.85)) * N);
    for (let i = 0; i < N; i++) { const x = x0 + (i % cols) * sx, y = y0 + Math.floor(i / cols) * sy, on = i < m, pop = on ? back(clamp((m - i) / 12, 0, 1)) : 1;
      g.save(); g.translate(x + 9, y + 4); g.scale(pop, pop); g.fillStyle = i === 0 ? P.red : on ? P.ink : "rgba(43,42,39,.08)";
      g.beginPath(); g.moveTo(-9, -1); g.lineTo(9, -1); g.lineTo(6, 5); g.lineTo(-6, 5); g.closePath(); g.fill(); if (on) g.fillRect(-5, -6, 8, 5); g.restore(); } },

  // car parts: meshing gears turning + a car rolling in
  car(g, k, p, P) { const gear = (x, y, R, t, rot, fill) => { g.save(); g.translate(x, y); g.rotate(rot); g.beginPath(); for (let i = 0; i < t * 2; i++) { const a = i / (t * 2) * Math.PI * 2, r = i % 2 ? R : R * 0.8; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } g.closePath();
      g.fillStyle = fill; g.fill(); ink(g, P, 4); g.fillStyle = P.paper; g.beginPath(); g.arc(0, 0, R * 0.3, 0, 7); g.fill(); ink(g, P, 4); g.restore(); };
    const s1 = back(seg(k, 0, 0.35)), s2 = back(seg(k, 0.12, 0.45)); if (s1 > 0) gear(-130, -90, 92 * s1, 12, k * 1.6, "#d9d3c5"); if (s2 > 0) gear(-10, -150, 56 * s2, 8, -k * 1.6 * 12 / 8 + 0.2, P.lite);
    const cu = ease(seg(k, 0.3, 0.8)); if (cu <= 0) return; g.save(); g.translate((1 - cu) * 120, 40); g.globalAlpha = cu;
    g.beginPath(); g.moveTo(-60, 100); g.lineTo(-30, 40); g.lineTo(110, 40); g.lineTo(158, 82); g.lineTo(200, 88); g.lineTo(200, 118); g.lineTo(-60, 118); g.closePath(); g.fillStyle = "#e9e4d8"; g.fill(); ink(g, P, 4.5);
    g.fillStyle = "#cfdee3"; rr(g, -14, 50, 52, 28, 4); g.fill(); ink(g, P, 3); rr(g, 50, 50, 56, 28, 4); g.fill(); ink(g, P, 3);
    for (const wx of [-4, 152]) { g.fillStyle = P.ink; g.beginPath(); g.arc(wx, 120, 26, 0, 7); g.fill(); g.fillStyle = P.lite; g.beginPath(); g.arc(wx, 120, 10, 0, 7); g.fill(); }
    g.restore(); },

  // oil: tanker on water, barrels dropping on deck, a drop
  oil(g, k, p, P) { g.save(); g.translate(0, 30); g.fillStyle = P.water; rr(g, -270, 70, 540, 80, 12); g.fill();
    const s = ease(seg(k, 0, 0.4)); g.save(); g.translate((1 - s) * -90, 0); g.beginPath(); g.moveTo(-200, 30); g.lineTo(210, 30); g.lineTo(180, 86); g.lineTo(-170, 86); g.closePath(); g.fillStyle = P.ink; g.fill();
    rr(g, -186, -32, 52, 62, 6); g.fillStyle = "#e9e4d8"; g.fill(); ink(g, P, 4); g.restore();
    for (let i = 0; i < 4; i++) { const q = seg(k, 0.3 + i * 0.1, 0.55 + i * 0.1); if (q <= 0) continue; const y = lerp(-140, 0, back(q)); g.save(); g.translate(-90 + i * 74, y);
      rr(g, -28, -78, 56, 78, 8); g.fillStyle = i % 2 ? "#cfc9bb" : "#e2ddd1"; g.fill(); ink(g, P, 4); g.strokeStyle = "rgba(43,42,39,.35)"; g.lineWidth = 3; for (const yy of [-55, -25]) { g.beginPath(); g.moveTo(-28, yy); g.lineTo(28, yy); g.stroke(); } g.restore(); }
    popIn(g, seg(k, 0.75, 1), 190, -150, () => { g.beginPath(); g.moveTo(0, -56); g.bezierCurveTo(-22, -20, -38, 0, -38, 18); g.arc(0, 18, 38, Math.PI, 0, true); g.bezierCurveTo(38, 0, 22, -20, 0, -56); g.fillStyle = P.ink; g.fill();
      g.fillStyle = "rgba(255,255,255,.35)"; g.beginPath(); g.ellipse(-12, 12, 7, 12, 0.4, 0, 7); g.fill(); });
    g.restore(); },

  // generic: a stack of containers landing (fallback)
  box(g, k, p, P) { for (let i = 0; i < 6; i++) { const q = seg(k, i * 0.1, 0.4 + i * 0.1); if (q <= 0) continue; const col = i % 3, row = Math.floor(i / 3), y = lerp(-260, 60 - row * 92, back(q));
    g.save(); g.translate(-150 + col * 150, y); rr(g, -68, -44, 136, 88, 6); g.fillStyle = (i === 4 && p.red) ? P.red : i % 2 ? "#d9d3c5" : "#ece7dc"; g.fill(); ink(g, P, 4);
    g.strokeStyle = "rgba(43,42,39,.3)"; g.lineWidth = 3; for (let j = -2; j <= 2; j++) { g.beginPath(); g.moveTo(j * 24, -34); g.lineTo(j * 24, 34); g.stroke(); } g.restore(); } },
};
