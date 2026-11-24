// node samples/obj3d/style/shoot.mjs frame1_callout frame2_chart ...  -> style/<name>.png (1080x1920)
import path from "path"; import { fileURLToPath, pathToFileURL } from "url"; import { createRequire } from "module";
const here = path.dirname(fileURLToPath(import.meta.url)), REPO = path.resolve(here, "../../..");
const puppeteer = createRequire(path.join(REPO, "paper-studio/package.json"))("puppeteer-core");
const CHROME = "C:/Users/debna/.cache/puppeteer/chrome-headless-shell/win64-146.0.7680.153/chrome-headless-shell-win64/chrome-headless-shell.exe";
const b = await puppeteer.launch({ executablePath: CHROME, headless: "shell", args: ["--allow-file-access-from-files", "--no-sandbox"] });
const p = await b.newPage(); await p.setViewport({ width: 1080, height: 1920 }); p.on("pageerror", e => console.log("PAGEERROR", e.message));
for (const n of process.argv.slice(2)) { await p.goto(pathToFileURL(path.join(here, n + ".html")).href, { waitUntil: "load" }); await p.screenshot({ path: path.join(here, n + ".png") }); console.log("wrote", n + ".png"); }
await b.close();
