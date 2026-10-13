// node tools/domtest.js <comp> : compare DOM snapshot (world svg + over + labels + puppet) at the same t under different seek histories
const fs = require("fs"), path = require("path");
function findPuppeteer() { try { return require("puppeteer-core"); } catch (e) {} const base = path.join(process.env.LOCALAPPDATA || "", "npm-cache/_npx"); for (const d of fs.readdirSync(base)) { const p = path.join(base, d, "node_modules/puppeteer-core"); if (fs.existsSync(p)) return require(p); } }
const comp = path.resolve(process.argv[2]);
(async () => {
  const b = await findPuppeteer().launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: "new", args: ["--allow-file-access-from-files"] });
  const p = await b.newPage(); await p.setViewport({ width: 1920, height: 1080 });
  await p.goto("file:///" + comp.split(path.sep).join("/") + "/index.html", { waitUntil: "load" });
  const r = await p.evaluate(() => {
    const tl = window.__timelines.main, snap = () => { const w = document.getElementById("wk"); return { tr: w.firstChild.getAttribute("transform"), st: w.firstChild.getAttribute("style"), html: w.innerHTML, over: document.getElementById("wk-over").innerHTML, lab: document.getElementById("labels").innerHTML, pz: document.getElementById("pz").innerHTML }; };
    tl.seek(12.193); const a = snap(); tl.seek(35); tl.seek(26.9); tl.seek(12.193); const b2 = snap();
    const out = {}; for (const k in a) if (a[k] !== b2[k]) { let i = 0; while (a[k][i] === b2[k][i]) i++; out[k] = [a[k].length, b2[k].length, a[k].slice(Math.max(0, i - 80), i + 80), b2[k].slice(Math.max(0, i - 80), i + 80)]; }
    return out;
  });
  console.log(JSON.stringify(r, null, 1).slice(0, 3000));
  await b.close();
})();
