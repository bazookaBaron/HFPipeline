// node tools/probe.js <compDir> [t1,t2,...] : load once, print errors + WK.stats, write screenshots to frames/dev/
const fs = require("fs"), path = require("path");
function findPuppeteer() { try { return require("puppeteer-core"); } catch (e) {} const base = path.join(process.env.LOCALAPPDATA || "", "npm-cache/_npx"); for (const d of fs.readdirSync(base)) { const p = path.join(base, d, "node_modules/puppeteer-core"); if (fs.existsSync(p)) return require(p); } throw new Error("no puppeteer"); }
const comp = path.resolve(process.argv[2]), times = (process.argv[3] || "0").split(",").map(Number), out = path.join(__dirname, "../frames/dev");
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const html = fs.readFileSync(path.join(comp, "index.html"), "utf8"), W = +html.match(/data-width="(\d+)"/)[1], H = +html.match(/data-height="(\d+)"/)[1];
  const b = await findPuppeteer().launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: "new", args: ["--allow-file-access-from-files", "--force-color-profile=srgb"] });
  const p = await b.newPage(); await p.setViewport({ width: W, height: H });
  const errs = []; p.on("pageerror", (e) => errs.push(e.message)); p.on("console", (m) => (m.type() === "error" || m.type() === "warning" || m.type() === "log") && errs.push(m.type() + ": " + m.text()));
  const tl0 = Date.now();
  await p.goto("file:///" + comp.split(path.sep).join("/") + "/index.html", { waitUntil: "load" });
  await p.evaluate(() => document.fonts.ready.then(() => 1));
  console.log("load ms", Date.now() - tl0);
  console.log("ERRS", errs.slice(0,5).join(" | "));
  for (const t of times) {
    await p.evaluate((t) => { window.__timelines.main.seek(t); return 1; }, t);
    await p.screenshot({ path: path.join(out, `${path.basename(comp)}-${t.toFixed(1)}.png`), clip: { x: 0, y: 0, width: W, height: H } });
  }
  const st = await p.evaluate(() => window.WK && JSON.stringify(Object.assign({}, WK.stats, { avg: WK.stats.sum / WK.stats.frames })));
  console.log(errs.slice(0, 20).join("\n")); console.log(st);
  await b.close();
})().catch((e) => { console.error(e); process.exit(2); });
