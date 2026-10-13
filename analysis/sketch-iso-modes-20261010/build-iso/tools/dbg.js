// node tools/dbg.js <comp> <t> <prevTimes comma>: compares ISO state at t after a fresh seek vs after visiting prevTimes first
const fs = require("fs"), path = require("path");
function fp() { try { return require("puppeteer-core"); } catch (e) {} const b = path.join(process.env.LOCALAPPDATA || "", "npm-cache/_npx"); for (const d of fs.readdirSync(b)) { const p = path.join(b, d, "node_modules/puppeteer-core"); if (fs.existsSync(p)) return require(p); } }
const comp = path.resolve(process.argv[2]), T = +process.argv[3], prev = (process.argv[4] || "30").split(",").map(Number);
(async () => {
  const b = await fp().launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: "new", args: ["--allow-file-access-from-files"] });
  const run = async (pre) => {
    const p = await b.newPage(); await p.setViewport({ width: 1920, height: 1080 });
    await p.goto("file:///" + comp.split(path.sep).join("/") + "/index.html", { waitUntil: "load" });
    return p.evaluate((pre, T) => { const tl = window.__timelines.main; pre.forEach((t) => tl.seek(t)); tl.seek(T); const c = ISO.camState(); return JSON.stringify({ cam: ["az","k","S","fx","fy","fz","sx","sy","fw","fid"].map((k) => c[k]), mode: ISO.mode, f: ISO.frame && { S: ISO.frame.S, tx: ISO.frame.tx, ty: ISO.frame.ty }, t: ISO.clockT(), n: ISO.stats.statics }); }, pre, T);
  };
  const a = await run([]), c = await run(prev);
  console.log(a); console.log(c); console.log(a === c ? "SAME" : "DIFF");
  await b.close();
})();
