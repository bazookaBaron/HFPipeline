// node tools/subjectcheck.js <compDir> [--noxray]
// For every WK.focus beat, at t0 and every 0.25 s to t1: project the subject and assert
//   on-screen 100% | bbox area >= 6% (LF) / 8% (reel) of the frame | outside the puppet zone (LF x>1560, reel y>1360)
//   unoccluded >= 85%: ~25 points inside the subject polygon, topmost element (shadowRoot.elementsFromPoint) must be the subject
//   ([data-sub]), an x-rayed element (.xr), only points where the subject is in the hit stack count; no visible label chip may cover the point.
// --noxray disables x-ray to show what the camera alone would give. Exit 1 on any failure.
const fs = require("fs"), path = require("path");
function findPuppeteer() { try { return require("puppeteer-core"); } catch (e) {} const base = path.join(process.env.LOCALAPPDATA || "", "npm-cache/_npx"); for (const d of fs.readdirSync(base)) { const p = path.join(base, d, "node_modules/puppeteer-core"); if (fs.existsSync(p)) return require(p); } }
const comp = path.resolve(process.argv[2]), noX = process.argv.includes("--noxray");
(async () => {
  const html = fs.readFileSync(path.join(comp, "index.html"), "utf8"), W = +html.match(/data-width="(\d+)"/)[1], H = +html.match(/data-height="(\d+)"/)[1];
  const b = await findPuppeteer().launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: "new", args: ["--allow-file-access-from-files"] });
  const p = await b.newPage(); await p.setViewport({ width: W, height: H });
  await p.goto("file:///" + comp.split(path.sep).join("/") + "/index.html", { waitUntil: "load" });
  const res = await p.evaluate((noX) => {
    WK.noXray = noX;
    const tl = window.__timelines.main, root = document.getElementById("wk").shadowRoot, W = innerWidth, H = innerHeight, REEL = H > W, out = [];
    const inPoly = (x, y, P) => { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) if ((P[i][1] > y) !== (P[j][1] > y) && x < ((P[j][0] - P[i][0]) * (y - P[i][1])) / (P[j][1] - P[i][1]) + P[i][0]) c = !c; return c; };
    for (const bt of WK.beats) for (let t = bt.t0; t <= bt.t1 + 1e-6; t += 0.25) {
      tl.seek(t); const s = WK.lastSubject;
      if (!s || s.id !== bt.id) { out.push({ id: bt.id, t, fail: "subject not focused" }); continue; }
      const bb = s.bb, on = s.poly.every((q) => q[0] >= 0 && q[0] <= W && q[1] >= 0 && q[1] <= H), size = ((bb[2] - bb[0]) * (bb[3] - bb[1])) / (W * H);
      const pupOk = REEL ? bb[3] <= 1360 : bb[2] <= 1560;
      const chips = [...document.querySelectorAll("#labels .wk-chip")].filter((e) => getComputedStyle(e).visibility === "visible").map((e) => e.getBoundingClientRect());
      const pts = []; for (let i = 0; i < 12; i++) for (let j = 0; j < 12; j++) { const x = bb[0] + ((i + 0.5) / 12) * (bb[2] - bb[0]), y = bb[1] + ((j + 0.5) / 12) * (bb[3] - bb[1]); if (inPoly(x, y, s.poly)) pts.push([x, y]); }
      const step = Math.max(1, Math.floor(pts.length / 25)), smp = pts.filter((_, k) => k % step === 0).slice(0, 25);
      // a sample counts only where the subject actually paints (it is in the hit stack); it is occluded when any
      // element above it in the stack is not x-rayed, or a visible label chip covers the point
      let vis = 0, cnt = 0;
      for (const [x, y] of smp) {
        const st = root.elementsFromPoint(x, y), k = st.findIndex((e) => e.closest("[data-sub]"));
        if (k < 0) continue; cnt++;
        if (chips.some((r) => x >= r.left && x <= r.right && y >= r.top && y <= r.bottom)) continue;
        if (st.slice(0, k).every((e) => e.closest(".xr"))) vis++;
      }
      const unocc = cnt ? vis / cnt : 0, minF = REEL ? 0.08 : 0.06;
      const fails = []; if (!on) fails.push("offscreen"); if (size < minF) fails.push("small " + (100 * size).toFixed(1) + "%"); if (!pupOk) fails.push("puppet-zone"); if (unocc < 0.85) fails.push("occluded " + (100 * unocc).toFixed(0) + "%");
      out.push({ id: bt.id, t: +t.toFixed(2), size: +(100 * size).toFixed(1), unocc: +(100 * unocc).toFixed(0), n: cnt, fail: fails.join(",") });
    }
    return out;
  }, noX);
  const bad = res.filter((r) => r.fail);
  const by = {}; res.forEach((r) => { const k = r.id; by[k] = by[k] || { n: 0, bad: 0, minSize: 1e9, minUnocc: 1e9 }; by[k].n++; if (r.fail) by[k].bad++; if (r.size != null) { by[k].minSize = Math.min(by[k].minSize, r.size); by[k].minUnocc = Math.min(by[k].minUnocc, r.unocc); } });
  console.log(path.basename(comp) + (noX ? " (NO x-ray)" : ""), JSON.stringify(by));
  bad.slice(0, 8).forEach((r) => console.log("  FAIL", r.id, "t=" + r.t, r.fail));
  console.log(bad.length ? `${bad.length}/${res.length} samples FAIL` : `${res.length}/${res.length} samples PASS`);
  await b.close(); process.exit(bad.length ? 1 : 0);
})();
