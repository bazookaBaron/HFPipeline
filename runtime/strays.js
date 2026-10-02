// node runtime/strays.js <compDir> [--step 0.25] [--max 48]
// Stray-element gate: seeks the paused timeline every --step seconds in headless Chrome and lists small visible
// parked "orphan" elements (unchanged for 3 consecutive samples) (bbox <= --max px on both sides) that are not inside a larger visible card/puppet/map.
// These are the stray dots/blocks (burst bits, rings, dots created visible before their entrance).
// Intentional small decorations: mark them (or a wrapper) data-deco. Exit 1 when any stray is found; prints time, size, position, class. Run before the full render.
const fs = require("fs"), path = require("path");
function findPuppeteer() {
  try { return require("puppeteer-core"); } catch (e) {}
  const base = path.join(process.env.LOCALAPPDATA || "", "npm-cache/_npx");
  if (fs.existsSync(base)) for (const d of fs.readdirSync(base)) {
    const p = path.join(base, d, "node_modules/puppeteer-core"); if (fs.existsSync(p)) return require(p);
  }
  throw new Error("puppeteer-core not found (npx cache)");
}
const chrome = ["C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe"].find(fs.existsSync);
const args = process.argv.slice(2), comp = path.resolve(args.find((a) => !a.startsWith("--")) || ".");
const opt = (k, d) => { const i = args.indexOf("--" + k); return i >= 0 ? +args[i + 1] : d; };
const STEP = opt("step", 0.25), MAX = opt("max", 48);
(async () => {
  const b = await findPuppeteer().launch({ executablePath: chrome, headless: "new", args: ["--allow-file-access-from-files"] });
  const p = await b.newPage();
  const html = fs.readFileSync(path.join(comp, "index.html"), "utf8");
  const W = +(html.match(/data-width="(\d+)"/) || [0, 1920])[1], H = +(html.match(/data-height="(\d+)"/) || [0, 1080])[1];
  await p.setViewport({ width: W, height: H });
  await p.goto("file:///" + comp.split(path.sep).join("/") + "/index.html", { waitUntil: "networkidle0" });
  const res = await p.evaluate(async (STEP, MAX) => {
    const tl = Object.values(window.__timelines || {})[0]; if (!tl) return { err: "no timeline" };
    const dur = tl.duration(), hits = [], seen = new Set();
    const vis = (e) => { const cs = getComputedStyle(e); return cs.visibility !== "hidden" && cs.display !== "none" && +cs.opacity > 0.05; };
    const shown = (e) => { for (let n = e; n && n !== document.body; n = n.parentElement) if (!vis(n)) return false; return true; };
    let prev = {}, run = {};
    for (let t = 0; t <= dur; t += STEP) {
      tl.seek(t, false); prev = run; run = {};
      for (const e of document.body.querySelectorAll("div,span,i,b,em")) {
        if (e.closest("svg,[data-deco]") || !shown(e)) continue;
        const r = e.getBoundingClientRect();
        if (r.width < 3 || r.height < 3 || r.width > MAX || r.height > MAX) continue;
        if (r.right < 0 || r.bottom < 0 || r.left > innerWidth || r.top > innerHeight) continue;
        if (e.textContent.trim()) continue; // text chips/labels are content, not strays
        // orphan = no visible ancestor that is a real card (>= 120px both sides) and not the full-frame root
        let host = null;
        for (let n = e.parentElement; n && n !== document.body; n = n.parentElement) {
          const q = n.getBoundingClientRect();
          if (q.width >= 120 && q.height >= 120 && !(q.width >= innerWidth * 0.95 && q.height >= innerHeight * 0.95)) { host = n; break; }
        }
        if (host) continue;
        const key = (e.id || e.className || e.tagName) + "@" + Math.round(r.left / 8) + "," + Math.round(r.top / 8) + ":" + Math.round(r.width / 4);
        run[key] = (prev[key] || 0) + 1; // same element, same place, same size on consecutive samples = parked, not animating
        if (run[key] !== 3 || seen.has(key)) continue; seen.add(key);
        hits.push({ t: +t.toFixed(2), w: Math.round(r.width), h: Math.round(r.height), x: Math.round(r.left), y: Math.round(r.top), id: e.id, cls: String(e.className).slice(0, 40) });
      }
    }
    return { dur, hits };
  }, STEP, MAX);
  await b.close();
  if (res.err) { console.error(res.err); process.exit(2); }
  for (const h of res.hits.slice(0, 40)) console.log(`STRAY t=${h.t}s ${h.w}x${h.h} at (${h.x},${h.y}) #${h.id || "-"} .${h.cls || "-"}`);
  console.log(res.hits.length ? `${res.hits.length} stray element(s) over ${res.dur.toFixed(1)} s: hide them until their entrance (visibility:hidden + tl.set at t), or remove.` : `no strays over ${res.dur.toFixed(1)} s`);
  process.exit(res.hits.length ? 1 : 0);
})().catch((e) => { console.error(e.message); process.exit(2); });
