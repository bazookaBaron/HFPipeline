// node runtime/iso/seektest.js <compDir> [--shots t1,t2,...] [--out dir] [--query ?x]
// Seek determinism gate: 10 pseudo-random times (+ mid-tween times) in fresh page loads; load A seeks ascending, load B shuffled, then strictly
// backwards after visiting t=DUR. Screenshots must match: byte-equal, or (raster noise) <= 0.02% of pixels differing by > 24/255. Exit 1 on mismatch.
// --shots: just write PNG screenshots at those times into --out (default <compDir>/../frames) for eyeballing.
const fs = require("fs"), path = require("path");
function findPuppeteer() { try { return require("puppeteer-core"); } catch (e) {} const base = path.join(process.env.LOCALAPPDATA || "", "npm-cache/_npx"); for (const d of fs.readdirSync(base)) { const p = path.join(base, d, "node_modules/puppeteer-core"); if (fs.existsSync(p)) return require(p); } throw new Error("puppeteer-core not found (run npx hyperframes once)"); }
const args = process.argv.slice(2), comp = path.resolve(args.find((a) => !a.startsWith("--")));
const opt = (k) => { const i = args.indexOf("--" + k); return i >= 0 ? args[i + 1] : null; };
(async () => {
  const html = fs.readFileSync(path.join(comp, "index.html"), "utf8");
  const W = +html.match(/data-width="(\d+)"/)[1], H = +html.match(/data-height="(\d+)"/)[1], DUR = +html.match(/data-duration="([\d.]+)"/)[1];
  const b = await findPuppeteer().launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: "new", args: ["--allow-file-access-from-files", "--force-color-profile=srgb"] });
  const load = async () => {
    const p = await b.newPage(); await p.setViewport({ width: W, height: H });
    const errs = []; p.on("pageerror", (e) => errs.push(e.message)); p.on("console", (m) => m.type() === "error" && errs.push(m.text()));
    await p.goto("file:///" + comp.split(path.sep).join("/") + "/index.html" + (opt("query") || ""), { waitUntil: "load" });
    await p.evaluate(() => document.fonts.ready.then(() => 1));
    return { p, errs };
  };
  const shot = async (p, t) => { await p.evaluate((t) => { window.__timelines.main.seek(t); return 1; }, t); return p.screenshot({ type: "png", clip: { x: 0, y: 0, width: W, height: H } }); };
  const framesDir = path.resolve(opt("out") || path.join(comp, "..", "frames")); fs.mkdirSync(framesDir, { recursive: true });
  const shots = opt("shots");
  if (shots) {
    const { p, errs } = await load();
    for (const t of shots.split(",").map(Number)) fs.writeFileSync(path.join(framesDir, `${path.basename(comp)}-${t.toFixed(1)}.png`), await shot(p, t));
    if (errs.length) console.log("PAGE ERRORS:", errs);
    await b.close(); return;
  }
  let s = 12345; const rnd = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);
  const times = Array.from({ length: 10 }, () => +(rnd() * DUR).toFixed(3)).concat([2.41, 8.63, 15.37, 22.95].filter((t) => t < DUR));
  const asc = times.slice().sort((a, b) => a - b), shuf = times.slice().sort((a, b) => ((a * 7919) % 13) - ((b * 7919) % 13));
  const ra = {}, rb = {}, rc = {};
  const A = await load(); for (const t of asc) ra[t] = await shot(A.p, t); await A.p.close();
  const Bp = await load(); for (const t of shuf) rb[t] = await shot(Bp.p, t);
  await shot(Bp.p, DUR);
  for (const t of times.slice().reverse()) rc[t] = await shot(Bp.p, t);
  const cmp = await b.newPage();
  const diff = async (x, y) => {
    if (Buffer.compare(x, y) === 0) return 0;
    return cmp.evaluate(async (a, c) => {
      const dec = async (s) => { const bm = await createImageBitmap(await (await fetch("data:image/png;base64," + s)).blob()); const cv = new OffscreenCanvas(bm.width, bm.height), g = cv.getContext("2d"); g.drawImage(bm, 0, 0); return g.getImageData(0, 0, bm.width, bm.height).data; };
      const A = await dec(a), B = await dec(c); let n = 0;
      for (let i = 0; i < A.length; i += 4) if (Math.abs(A[i] - B[i]) > 24 || Math.abs(A[i + 1] - B[i + 1]) > 24 || Math.abs(A[i + 2] - B[i + 2]) > 24) n++;
      return n / (A.length / 4);
    }, x.toString("base64"), y.toString("base64"));
  };
  let bad = 0;
  for (const t of times) {
    const d1 = await diff(ra[t], rb[t]), d2 = await diff(ra[t], rc[t]), ok = d1 <= 2e-4 && d2 <= 2e-4;
    if (!ok) { bad++; fs.writeFileSync(path.join(framesDir, `diff-${t}-A.png`), ra[t]); fs.writeFileSync(path.join(framesDir, `diff-${t}-B.png`), d1 > 2e-4 ? rb[t] : rc[t]); }
    console.log(`t=${t.toFixed(3)} shuffled:${d1 ? (100 * d1).toFixed(4) + "%" : "EQUAL"} backwards:${d2 ? (100 * d2).toFixed(4) + "%" : "EQUAL"}${ok ? "" : "  <-- MISMATCH"}`);
  }
  if (A.errs.length || Bp.errs.length) console.log("PAGE ERRORS:", A.errs, Bp.errs);
  console.log(bad ? `${bad}/${times.length} times differ` : `${times.length}/${times.length} times match across loads, shuffled and backwards seeks`);
  await b.close(); process.exit(bad || A.errs.length || Bp.errs.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
