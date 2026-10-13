/* snap.js — seek the paused timeline and screenshot. usage: node snap.js <compDir> <outDir> t1,t2,... [--gl mode]
 * also: --det N  -> determinism test: N random (seeded) times, two fresh page loads, compare PNG bytes + pixels */
const fs = require("fs"), path = require("path"), crypto = require("crypto");
function findPuppeteer() { try { return require("puppeteer-core"); } catch (e) {} const base = path.join(process.env.LOCALAPPDATA || "", "npm-cache/_npx"); for (const d of fs.readdirSync(base)) { const p = path.join(base, d, "node_modules/puppeteer-core"); if (fs.existsSync(p)) return require(p); } }
const chrome = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const a = process.argv.slice(2), comp = path.resolve(a[0]), out = path.resolve(a[1] || "frames"); fs.mkdirSync(out, { recursive: true });
const det = a.indexOf("--det") >= 0 ? +a[a.indexOf("--det") + 1] : 0;
async function load(b) {
  const p = await b.newPage(); p.on("pageerror", (e) => console.error("[page]", e.message)); p.on("console", (m) => m.type() === "warning" || m.type() === "error" ? console.error("[console]", m.text()) : 0);
  await p.setViewport({ width: 1920, height: 1080 });
  await p.goto("file:///" + comp.split(path.sep).join("/") + "/index.html", { waitUntil: "networkidle0" });
  await p.evaluate(() => document.fonts.ready); return p;
}
async function shot(p, t) { await p.evaluate((t) => { window.__timelines.main.seek(t, false); }, t); await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))); return p.screenshot({ type: "png" }); }
(async () => {
  const b = await findPuppeteer().launch({ executablePath: chrome, headless: "new", args: ["--allow-file-access-from-files"] });
  if (det) {
    let s = 12345; const rnd = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);
    const ts = Array.from({ length: det }, () => +(rnd() * 45).toFixed(3));
    const A = await load(b), shotsA = []; for (const t of ts) shotsA.push(await shot(A, t)); await A.close();
    const B = await load(b), order = process.env.FWD ? ts.map((t, i) => i) : ts.map((t, i) => i).reverse(), shotsB = []; // second load seeks in REVERSE order
    for (const i of order) shotsB[i] = await shot(B, ts[i]);
    let same = 0; const rep = [];
    for (let i = 0; i < ts.length; i++) { const eq = Buffer.compare(shotsA[i], shotsB[i]) === 0; if (eq) same++; rep.push(`${ts[i]}s ${eq ? "IDENTICAL" : "DIFF"}`); if (!eq) { fs.writeFileSync(path.join(out, `det_${ts[i]}_A.png`), shotsA[i]); fs.writeFileSync(path.join(out, `det_${ts[i]}_B.png`), shotsB[i]); } }
    console.log(rep.join("\n")); console.log(`determinism: ${same}/${ts.length} byte-identical`);
  } else {
    const p = await load(b);
    for (const t of (a[2] || "1,5,10").split(",").map(Number)) { const buf = await shot(p, t); fs.writeFileSync(path.join(out, `snap_${String(t).replace(".", "_")}.png`), buf); }
  }
  await b.close();
})();
