// screenshot cost by layer: node tools/floor.js <comp> <t>
const fs = require("fs"), path = require("path");
function fp() { try { return require("puppeteer-core"); } catch (e) {} const b = path.join(process.env.LOCALAPPDATA || "", "npm-cache/_npx"); for (const d of fs.readdirSync(b)) { const p = path.join(b, d, "node_modules/puppeteer-core"); if (fs.existsSync(p)) return require(p); } }
const comp = path.resolve(process.argv[2]), T = +(process.argv[3] || 3);
(async () => {
  const b = await fp().launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: "new", args: ["--allow-file-access-from-files"] });
  const p = await b.newPage(); await p.setViewport({ width: 1920, height: 1080 });
  await p.goto("file:///" + comp.split(path.sep).join("/") + "/index.html", { waitUntil: "load" });
  await p.evaluate((T) => { window.__timelines.main.seek(T); }, T);
  const time = async (label, fmt) => { const a = Date.now(); for (let i = 0; i < 6; i++) await p.screenshot(fmt); console.log(label, ((Date.now() - a) / 6).toFixed(0), "ms"); };
  await time("all png", { type: "png" }); await time("all jpeg", { type: "jpeg", quality: 90 });
  await p.evaluate(() => { document.getElementById("iso").style.display = "none"; });
  await time("no canvas png", { type: "png" });
  await p.evaluate(() => { document.getElementById("pz").style.display = "none"; document.getElementById("labels").style.display = "none"; });
  await time("bg only png", { type: "png" });
  await b.close();
})();
