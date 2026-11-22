// node runtime/sfxdump.js <compDir> [out=<compDir>/../sfx.json]  -- dump window.__sfx via headless Chrome
const fs = require("fs"), path = require("path"), os = require("os");
function findPuppeteer() {
  try { return require("puppeteer-core"); } catch (e) {}
  const base = path.join(process.env.LOCALAPPDATA || "", "npm-cache/_npx");
  if (fs.existsSync(base)) for (const d of fs.readdirSync(base)) {
    const p = path.join(base, d, "node_modules/puppeteer-core"); if (fs.existsSync(p)) return require(p);
  }
  throw new Error("puppeteer-core not found (npx cache)");
}
const chrome = ["C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"].find(fs.existsSync);
const comp = path.resolve(process.argv[2] || "."); const out = path.resolve(process.argv[3] || path.join(comp, "..", "sfx.json"));
(async () => {
  const b = await findPuppeteer().launch({ executablePath: chrome, headless: "new", args: ["--allow-file-access-from-files"] });
  const p = await b.newPage(); let errs = 0;
  await p.evaluateOnNewDocument(() => { window.__timelines = {}; });
  p.on("pageerror", e => { errs++; console.log("PAGEERR", e.message); });
  p.on("console", m => { if (m.type() === "error") console.log("CONSOLE.error", m.text()); });
  await p.goto("file:///" + comp.split(path.sep).join("/") + "/index.html", { waitUntil: "networkidle0", timeout: 180000 });
  const s = await p.evaluate(() => JSON.stringify(window.__sfx || null));
  fs.writeFileSync(out, s); console.log("sfx cues:", JSON.parse(s || "[]").length, "->", out, errs ? `(${errs} page errors)` : "");
  await b.close();
})().catch(e => { console.error(e.message); process.exit(1); });
