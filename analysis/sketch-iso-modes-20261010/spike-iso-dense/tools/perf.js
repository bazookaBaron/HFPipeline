// node tools/perf.js <compDir> t0 t1 [shot] : seek every frame (30 fps) in [t0,t1); report redraw ms (kit-internal), seek ms, screenshot ms
const fs = require("fs"), path = require("path");
function findPuppeteer() { try { return require("puppeteer-core"); } catch (e) {} const base = path.join(process.env.LOCALAPPDATA || "", "npm-cache/_npx"); for (const d of fs.readdirSync(base)) { const p = path.join(base, d, "node_modules/puppeteer-core"); if (fs.existsSync(p)) return require(p); } }
const comp = path.resolve(process.argv[2]), t0 = +process.argv[3], t1 = +process.argv[4], shots = process.argv[5] === "shot";
(async () => {
  const html = fs.readFileSync(path.join(comp, "index.html"), "utf8"), W = +html.match(/data-width="(\d+)"/)[1], H = +html.match(/data-height="(\d+)"/)[1];
  const b = await findPuppeteer().launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: "new", args: ["--allow-file-access-from-files"] });
  const p = await b.newPage(); await p.setViewport({ width: W, height: H });
  await p.goto("file:///" + comp.split(path.sep).join("/") + "/index.html", { waitUntil: "load" });
  const res = await p.evaluate(async (t0, t1) => {
    const tl = window.__timelines.main, out = [];
    for (let f = Math.round(t0 * 30); f < t1 * 30; f++) {
      const nb = WK.stats.build.length, a = performance.now(); tl.seek(f / 30); const ms = performance.now() - a;
      out.push([f / 30, +WK.stats.last.toFixed(1), +ms.toFixed(1), WK.stats.build.length > nb ? 1 : 0, WK.stats.movers]);
    }
    return out;
  }, t0, t1);
  const nb = res.filter((r) => !r[3]), bb = res.filter((r) => r[3]), avg = (a, k) => (a.length ? a.reduce((s, r) => s + r[k], 0) / a.length : 0);
  console.log(path.basename(comp), `[${t0},${t1}) frames ${res.length}: no-rebuild redraw avg ${avg(nb, 1).toFixed(1)} ms (seek ${avg(nb, 2).toFixed(1)}), max ${Math.max(0, ...nb.map((r) => r[1]))}; rebuild frames ${bb.length} redraw avg ${avg(bb, 1).toFixed(1)} ms; movers on screen avg ${avg(res, 4).toFixed(0)}`);
  if (shots) { let s = 0; for (let f = Math.round(t0 * 30); f < Math.round(t0 * 30) + 10; f++) { await p.evaluate((t) => { window.__timelines.main.seek(t); }, f / 30); const a = Date.now(); await p.screenshot({ type: "png" }); s += Date.now() - a; } console.log("screenshot ms avg", (s / 10).toFixed(0)); }
  await b.close();
})();
