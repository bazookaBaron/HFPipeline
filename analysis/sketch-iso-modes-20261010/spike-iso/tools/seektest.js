// node tools/seektest.js <compDir> [--shots t1,t2,...] [--out dir]
// Seek determinism: 10 fixed pseudo-random times (LCG seed, not Math.random) in two fresh page loads; load A seeks ascending,
// load B seeks in a shuffled (backwards-jumping) order plus a final re-seek of every time after visiting t=DUR. Screenshots compared byte/pixel-equal.
// --shots: just write PNG screenshots at those times into --out (for eyeballing).
const fs = require("fs"), path = require("path");
function findPuppeteer() {
  try { return require("puppeteer-core"); } catch (e) {}
  const base = path.join(process.env.LOCALAPPDATA || "", "npm-cache/_npx");
  for (const d of fs.readdirSync(base)) { const p = path.join(base, d, "node_modules/puppeteer-core"); if (fs.existsSync(p)) return require(p); }
  throw new Error("puppeteer-core not found");
}
const chrome = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const args = process.argv.slice(2), comp = path.resolve(args.find((a) => !a.startsWith("--")));
const opt = (k) => { const i = args.indexOf("--" + k); return i >= 0 ? args[i + 1] : null; };
(async () => {
  const html = fs.readFileSync(path.join(comp, "index.html"), "utf8");
  const W = +html.match(/data-width="(\d+)"/)[1], H = +html.match(/data-height="(\d+)"/)[1], DUR = +html.match(/data-duration="([\d.]+)"/)[1];
  const b = await findPuppeteer().launch({ executablePath: chrome, headless: "new", args: ["--allow-file-access-from-files", "--force-color-profile=srgb"] });
  const load = async () => {
    const p = await b.newPage(); await p.setViewport({ width: W, height: H });
    const errs = []; p.on("pageerror", (e) => errs.push(e.message)); p.on("console", (m) => m.type() === "error" && errs.push(m.text()));
    await p.goto("file:///" + comp.split(path.sep).join("/") + "/index.html" + (opt("query") || ""), { waitUntil: "load" });
    await p.evaluate(() => document.fonts.ready.then(() => 1));
    return { p, errs };
  };
  const shot = async (p, t) => { await p.evaluate((t) => { window.__timelines.main.seek(t); return 1; }, t); return p.screenshot({ type: "png", clip: { x: 0, y: 0, width: W, height: H } }); };
  const shots = opt("shots");
  if (shots) {
    const out = path.resolve(opt("out") || "frames"); fs.mkdirSync(out, { recursive: true });
    const { p, errs } = await load();
    for (const t of shots.split(",").map(Number)) fs.writeFileSync(path.join(out, `${path.basename(comp)}-${t.toFixed(1)}.png`), await shot(p, t));
    if (errs.length) console.log("PAGE ERRORS:", errs);
    await b.close(); return;
  }
  let s = 12345; const rnd = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);
  const times = Array.from({ length: 10 }, () => +(rnd() * DUR).toFixed(3)).concat([2.41, 8.63, 15.37, 22.95].filter((t) => t < DUR)); // + mid-tween times (rise, explode, collapse)
  const asc = times.slice().sort((a, b) => a - b), shuf = times.slice().sort((a, b) => ((a * 7919) % 13) - ((b * 7919) % 13));
  const ra = {}, rb = {}, rc = {};
  const A = await load(); for (const t of asc) ra[t] = await shot(A.p, t); await A.p.close(); // fresh load #1, ascending
  const Bp = await load(); for (const t of shuf) rb[t] = await shot(Bp.p, t);               // fresh load #2, shuffled
  await shot(Bp.p, DUR);
  for (const t of times.slice().reverse()) rc[t] = await shot(Bp.p, t); // strictly backwards from the end
  let bad = 0;
  for (const t of times) {
    const e1 = Buffer.compare(ra[t], rb[t]) === 0, e2 = Buffer.compare(ra[t], rc[t]) === 0;
    if (!e1 || !e2) { bad++; fs.writeFileSync(path.join(comp, `../frames/diff-${t}-A.png`), ra[t]); fs.writeFileSync(path.join(comp, `../frames/diff-${t}-B.png`), e1 ? rc[t] : rb[t]); }
    console.log(`t=${t.toFixed(3)} shuffled:${e1 ? "EQUAL" : "DIFF"} backwards:${e2 ? "EQUAL" : "DIFF"}`);
  }
  console.log("order A:", asc.join(","), "\norder B:", shuf.join(","));
  if (A.errs.length || Bp.errs.length) console.log("PAGE ERRORS:", A.errs, Bp.errs);
  console.log(bad ? `${bad}/${times.length} times differ` : `${times.length}/${times.length} times pixel-identical across loads, shuffled and backwards seeks`);
  await b.close(); process.exit(bad ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
