// node runtime/iso/subjectcheck.js <compDir> [--noxray] [--step 0.25]
// Subject-visibility gate (PLAN s12). For every ISO.focus beat, at t0 and every 0.25 s to t1, GEOMETRIC check (the world is a canvas, so no DOM hit-testing):
//   on-screen 100% | bbox area >= tier minimum (large 6%/8% reel, small 1.5%/2%) | outside the puppet zone (LF x>1560, reel y>1360)
//   unoccluded >= 85%: <=25 sample points inside the subject polygon; a point is occluded when a polygon of something painted above the subject
//   (ISO.frame.cover: statics/movers whose slot is above it, minus the x-rayed ones) contains it, or a visible label chip covers it.
// --noxray disables x-ray to show what the camera alone would give (expected to FAIL on a hidden subject). Exit 1 on any failure.
const fs = require("fs"), path = require("path");
function findPuppeteer() { try { return require("puppeteer-core"); } catch (e) {} const base = path.join(process.env.LOCALAPPDATA || "", "npm-cache/_npx"); for (const d of fs.readdirSync(base)) { const p = path.join(base, d, "node_modules/puppeteer-core"); if (fs.existsSync(p)) return require(p); } throw new Error("puppeteer-core not found (run npx hyperframes once)"); }
const comp = path.resolve(process.argv[2]), noX = process.argv.includes("--noxray"), si = process.argv.indexOf("--step"), STEP = si > 0 ? +process.argv[si + 1] : 0.25;
(async () => {
  const html = fs.readFileSync(path.join(comp, "index.html"), "utf8"), W = +html.match(/data-width="(\d+)"/)[1], H = +html.match(/data-height="(\d+)"/)[1];
  const b = await findPuppeteer().launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: "new", args: ["--allow-file-access-from-files"] });
  const p = await b.newPage(); await p.setViewport({ width: W, height: H });
  await p.goto("file:///" + comp.split(path.sep).join("/") + "/index.html", { waitUntil: "load" });
  const isBoard = await p.evaluate(() => !!(window.B && window.B.beats && window.B.probe));
  const res = isBoard ? await p.evaluate((noX, STEP) => {
    // BOARD mode: DOM-based. subject fully inside the card view + frame, tier min size, outside puppet zone, fully drawn, <=15% covered by other chips
    const tl = window.__timelines.main, W = innerWidth, H = innerHeight, REEL = H > W, out = [], V = B.view;
    for (const bt of B.beats) for (let t = bt.t0; t <= bt.t1 + 1e-6; t += STEP) {
      tl.seek(t); const r = B.probe(bt.ids), bb = r.bb, fails = [], mf = B.minFrac[bt.tier][REEL ? 1 : 0], size = ((bb[2] - bb[0]) * (bb[3] - bb[1])) / (W * H);
      if (bb[0] < V.x0 - 1 || bb[1] < V.y0 - 1 || bb[2] > V.x1 + 1 || bb[3] > V.y1 + 1) fails.push("offscreen");
      if (size < mf - 1e-4) fails.push("small " + (100 * size).toFixed(2) + "%<" + 100 * mf + "%");
      if (REEL ? bb[3] > 1360 : bb[2] > 1560) fails.push("puppet-zone");
      if (r.prog < 0.98) fails.push("not-drawn " + r.prog.toFixed(2));
      if (r.occl > 0.15) fails.push("occluded " + (100 * r.occl).toFixed(0) + "%");
      out.push({ id: bt.id, t: +t.toFixed(2), tier: bt.tier, size: +(100 * size).toFixed(2), unocc: Math.round(100 * (1 - r.occl)), fail: fails.join(",") });
    }
    return out;
  }, noX, STEP) : await p.evaluate((noX, STEP) => {
    ISO.noXray = noX;
    const tl = window.__timelines.main, W = innerWidth, H = innerHeight, REEL = H > W, out = [];
    for (const bt of ISO.beats) for (let t = bt.t0; t <= bt.t1 + 1e-6; t += STEP) {
      tl.seek(t); const s = ISO.lastSubject, fr = ISO.frame;
      if (!s || s.id !== bt.id) { out.push({ id: bt.id, t, fail: "subject not focused" }); continue; }
      const bb = s.bb, on = s.poly.every((q) => q[0] >= 0 && q[0] <= W && q[1] >= 0 && q[1] <= H), size = ((bb[2] - bb[0]) * (bb[3] - bb[1])) / (W * H);
      const pupOk = REEL ? bb[3] <= 1360 : bb[2] <= 1560;
      const chips = [...document.querySelectorAll(".iso-chip")].filter((e) => getComputedStyle(e).visibility === "visible").map((e) => e.getBoundingClientRect());
      const pts = []; for (let i = 0; i < 12; i++) for (let j = 0; j < 12; j++) { const x = bb[0] + ((i + 0.5) / 12) * (bb[2] - bb[0]), y = bb[1] + ((j + 0.5) / 12) * (bb[3] - bb[1]); if (ISO.inPoly(x, y, s.poly)) pts.push([x, y]); }
      const step = Math.max(1, Math.floor(pts.length / 25)), smp = pts.filter((_, k) => k % step === 0).slice(0, 25);
      let vis = 0;
      for (const [x, y] of smp) {
        if (chips.some((r) => x >= r.left && x <= r.right && y >= r.top && y <= r.bottom)) continue;
        if (fr.cover.some((c) => !c.xr && ISO.inPoly(x, y, c.poly))) continue;
        vis++;
      }
      const unocc = smp.length ? vis / smp.length : 0, fails = [];
      if (!on) fails.push("offscreen");
      if (size < s.minFrac - 1e-4) fails.push("small " + (100 * size).toFixed(2) + "%<" + 100 * s.minFrac + "%");
      if (!pupOk) fails.push("puppet-zone");
      if (unocc < 0.85) fails.push("occluded " + (100 * unocc).toFixed(0) + "%");
      out.push({ id: bt.id, t: +t.toFixed(2), tier: s.tier, size: +(100 * size).toFixed(2), unocc: +(100 * unocc).toFixed(0), mode: fr.mode, fail: fails.join(",") });
    }
    return out;
  }, noX, STEP);
  const bad = res.filter((r) => r.fail), by = {};
  res.forEach((r) => { const q = (by[r.id] = by[r.id] || { n: 0, bad: 0, tier: r.tier, minSize: 1e9, minUnocc: 1e9 }); q.n++; if (r.fail) q.bad++; if (r.size != null) { q.minSize = Math.min(q.minSize, r.size); q.minUnocc = Math.min(q.minUnocc, r.unocc); } });
  console.log(path.basename(comp) + (noX ? " (NO x-ray)" : ""), JSON.stringify(by));
  bad.slice(0, 40).forEach((r) => console.log("  FAIL", r.id, "t=" + r.t, r.fail));
  console.log(bad.length ? `${bad.length}/${res.length} samples FAIL` : `${res.length}/${res.length} samples PASS`);
  await b.close(); process.exit(bad.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
