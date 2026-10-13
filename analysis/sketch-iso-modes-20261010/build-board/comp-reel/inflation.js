/* inflation.js: BOARD demo, "how inflation loops", 30 s. LF 1920x1080 and reel 1080x1920 from the same script. */
window.SCENE = function () {
  const THEME = (window.THEME = Theme.get("teal")); Theme.apply(THEME);
  const root = document.getElementById("root"), W = +root.dataset.width, H = +root.dataset.height, DUR = +root.dataset.duration, REEL = H > W;
  const tl = B.timeline();
  B.board({ tl, W, H, dur: DUR });
  // ---- parts (world coords; LF world 1408x968, reel 988x1198)
  const C = REEL ? { cx: 494, cy: 470, rx: 250, ry: 270 } : { cx: 520, cy: 490, rx: 340, ry: 255 };
  B.label("title", "HOW INFLATION LOOPS", { x: REEL ? 300 : 270, y: REEL ? 52 : 44, fill: "marker" });
  const ids = ["prices", "wages", "spend", "costs"], lp = B.loop(ids, { cx: C.cx, cy: C.cy, rx: C.rx, ry: C.ry, texts: ["PRICES UP", "WAGES UP", "SPENDING UP", "COSTS UP"], shape: "box" });
  const [a1, a2, a3, a4] = lp.arrows;
  B.icon("coin", "coin", REEL ? { x: 700, y: 120, size: 90 } : { x: 650, y: 130, size: 92 });
  B.icon("person", "person", REEL ? { x: 880, y: 340, size: 100 } : { x: 990, y: 360, size: 100 });
  B.ring("r1", "prices"); B.ring("r2", "wages"); B.ring("r3", "spend"); B.underline("ul", "costs");
  const AX = REEL ? { x: 120, y: 1100, w: 740, h: 230 } : { x: 1090, y: 770, w: 290, h: 430 };
  B.axis("axis", Object.assign({ xl: "TIME", yl: "PRICES" }, AX));
  B.curve("curve", [[0, 0.1], [0.3, 0.16], [0.55, 0.3], [0.78, 0.58], [1, 0.95]], { axis: "axis" });
  if (!REEL) B.bracket("br", ids, "THE LOOP", { side: "bottom" });
  // ---- script
  const D = (id, t, d) => B.draw(tl, id, t, d);
  D("title", 0.3);
  D("prices", 0.8); B.fill(tl, "prices", 1.9); D("coin", 2.2); D("r1", 3.0);
  B.focus(tl, "prices", 1.5, 4.5);
  B.hide(tl, "r1", 4.7); D(a1, 4.7); D("wages", 5.3); B.fill(tl, "wages", 6.1); D("person", 6.6); D("r2", 7.2);
  B.focus(tl, "wages", 6.0, 9.0);
  B.hide(tl, "r2", 9.1); D(a2, 9.1); D("spend", 9.7); B.fill(tl, "spend", 10.5); D("r3", 11.1);
  B.dim(tl, ["prices", "coin", a1], 9.1);
  B.focus(tl, "spend", 10.4, 13.2);
  B.hide(tl, "r3", 13.3); D(a3, 13.3); D("costs", 13.9); B.fill(tl, "costs", 14.7); D("ul", 15.5);
  B.dim(tl, ["wages", "person", a2], 13.3);
  B.focus(tl, "costs", 14.6, 17.2);
  B.dim(tl, ["spend", a3], 17.3);
  D(a4, 17.3, 0.9);
  B.focus(tl, a4, 18.3, 21.3);
  B.pull(tl, 21.6);
  if (!REEL) D("br", 22.9);
  B.dim(tl, ["costs", "ul", a4], 23.2);
  D("axis", 23.4, 0.9); D("curve", 24.4, 1.4);
  B.focus(tl, ["axis", "curve"], 26.0, 28.4);
  B.pull(tl, 28.6);
  // ---- puppet (outside the board card)
  const ph = REEL ? 540 : 640, pcx = REEL ? 540 : 1665, pfloor = REEL ? 1895 : 1045, wd = Math.round((318 * ph) / 620);
  const host = document.getElementById("pz"); Object.assign(host.style, { left: pcx - wd / 2 + "px", top: pfloor - ph + 12 + "px", width: wd + "px" });
  const P = Puppet.mount("#pz", { mode: "full", height: ph, id: "pzp", theme: { shadow: THEME.shadow } });
  if (!REEL) [1.0, 5.4, 9.8, 13.8, 18.0].forEach((t) => { P.pointScreen(tl, t, "l"); P.pose(tl, t + 1.9, "stand", { d: 0.4 }); });
  P.pose(tl, 22.0, "present_left", { hold: 1.8 }); P.pose(tl, 24.0, "stand", { d: 0.4 });
  P.blinks(tl, DUR, { seed: 5 }); P.idle(tl, 0, DUR);
  tl.to({}, { duration: DUR }, 0);
  tl.seek(0); B.redraw();
  return tl;
};
