const fs = require("fs"), path = require("path");
function findPuppeteer() { try { return require("puppeteer-core"); } catch (e) {} const base = path.join(process.env.LOCALAPPDATA || "", "npm-cache/_npx"); for (const d of fs.readdirSync(base)) { const p = path.join(base, d, "node_modules/puppeteer-core"); if (fs.existsSync(p)) return require(p); } }
(async () => { const b = await findPuppeteer().launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: "new", args: ["--allow-file-access-from-files"] });
  for (const c of process.argv.slice(2)) { const p = await b.newPage(); await p.goto("file:///" + path.resolve(c).split(path.sep).join("/") + "/index.html", { waitUntil: "load" });
    console.log(c, await p.evaluate(() => JSON.stringify({ all: document.querySelectorAll("*").length, wk: document.getElementById("wk").shadowRoot.querySelectorAll("*").length, bytes: document.getElementById("wk").shadowRoot.innerHTML.length, pz: document.querySelectorAll("#pz *").length }))); }
  await b.close(); })();
