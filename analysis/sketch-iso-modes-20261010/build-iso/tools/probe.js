// quick sanity + timing: node tools/probe.js <comp> -> page errors, per-second seek cost, ISO.stats
const fs = require("fs"), path = require("path");
function fp() { try { return require("puppeteer-core"); } catch (e) {} const b = path.join(process.env.LOCALAPPDATA || "", "npm-cache/_npx"); for (const d of fs.readdirSync(b)) { const p = path.join(b, d, "node_modules/puppeteer-core"); if (fs.existsSync(p)) return require(p); } }
const comp = path.resolve(process.argv[2]), STEP = +(process.argv[3] || 1);
(async () => {
  const b = await fp().launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: "new", args: ["--allow-file-access-from-files"] });
  const p = await b.newPage(); await p.setViewport({ width: 1920, height: 1080 }); const errs = [];
  p.on("pageerror", (e) => errs.push(e.message)); p.on("console", (m) => m.type() === "error" && errs.push(m.text()));
  await p.goto("file:///" + comp.split(path.sep).join("/") + "/index.html", { waitUntil: "load" });
  await new Promise((r) => setTimeout(r, 500)); if (errs.length) { console.log(errs); await b.close(); return; }
  const r = await p.evaluate((STEP) => {
    const tl = window.__timelines.main, D = +document.getElementById("root").dataset.duration, out = [];
    for (let t = 0; t < D; t += STEP) { const a = performance.now(); tl.seek(t); out.push([t, ISO.mode, +(performance.now() - a).toFixed(0)]); }
    return { out, stats: Object.assign({}, ISO.stats, { build: ISO.stats.build.slice(0, 8) }) };
  }, STEP);
  console.log(errs.slice(0, 5)); console.log(r.out.map((x) => x.join(":")).join(" ")); console.log(JSON.stringify(r.stats));
  await b.close();
})();
