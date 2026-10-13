// node tools/prof.js <comp> [every=6]: per-frame seek time + screenshot time (sequential frames, like a render worker), summed per 3 s
const fs = require("fs"), path = require("path");
function fp() { try { return require("puppeteer-core"); } catch (e) {} const b = path.join(process.env.LOCALAPPDATA || "", "npm-cache/_npx"); for (const d of fs.readdirSync(b)) { const p = path.join(b, d, "node_modules/puppeteer-core"); if (fs.existsSync(p)) return require(p); } }
const comp = path.resolve(process.argv[2]), EV = +(process.argv[3] || 6), DUR = 30;
(async () => {
  const b = await fp().launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: "new", args: ["--allow-file-access-from-files"] });
  const p = await b.newPage(); await p.setViewport({ width: 1920, height: 1080 });
  await p.goto("file:///" + comp.split(path.sep).join("/") + "/index.html", { waitUntil: "load" });
  const seg = {};
  for (let f = 0; f < DUR * 30; f += EV) {
    const t = f / 30, a = Date.now();
    const m = await p.evaluate((t) => { const a = performance.now(); window.__timelines.main.seek(t); return [performance.now() - a, ISO.mode]; }, t);
    const b2 = Date.now(); await p.screenshot({ type: "png" }); const c = Date.now();
    const k = Math.floor(t / 3) * 3 + ":" + m[1]; const s = (seg[k] = seg[k] || { n: 0, seek: 0, shot: 0 }); s.n++; s.seek += m[0]; s.shot += c - b2;
  }
  let tot = 0; for (const k in seg) { const s = seg[k]; console.log(k, "n", s.n, "seek/frame", (s.seek / s.n).toFixed(0), "shot/frame", (s.shot / s.n).toFixed(0)); tot += s.seek + s.shot; }
  console.log("est total s", ((tot * EV) / 1000).toFixed(0), "(single worker)");
  await b.close();
})();
