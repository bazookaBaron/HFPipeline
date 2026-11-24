// node mg2d/kindgate.mjs [kind,...]  : loads every registered kind x example case in kinds.html (16:9), records errors, caption cap height at each
// narrated hold (>= 0.02*H = 21.6 px), and writes one still per hold -> out/kg/<kind>_c<case>_<i>.jpg + out/kg/report.json
// Gate per case: no page error, min caption >= 21.6 px, no text overlaps. Prints "PASS|FAIL <kind> c<case> minCap=.." and "kinds N, cases N, pass N". Exit 1 if any case fails.
// With kind names, only those are run and the report goes to out/kg/report_partial.json. Run through the queue: node runtime/jobq.js --kind snap -- "node samples/obj3d/mg2d/kindgate.mjs orgChart"
import http from "http"; import fs from "fs"; import path from "path"; import { fileURLToPath } from "url"; import { createRequire } from "module";
const here = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."), REPO = path.resolve(here, "../..");
if (["--help", "-h"].includes(process.argv[2])) { console.log(fs.readFileSync(fileURLToPath(import.meta.url), "utf8").split("\n").filter(l => l.startsWith("//")).map(l => l.slice(3)).join("\n")); process.exit(0); }
const puppeteer = createRequire(path.join(REPO, "package.json"))("puppeteer-core");
const CHROME = process.env.CHROME || "C:/Users/debna/.cache/puppeteer/chrome-headless-shell/win64-146.0.7680.153/chrome-headless-shell-win64/chrome-headless-shell.exe";
const MIME = { ".js": "text/javascript", ".html": "text/html", ".json": "application/json", ".geojson": "application/json" };
const server = http.createServer((req, res) => { const f = path.join(here, decodeURIComponent(req.url.split("?")[0])); fs.readFile(f, (e, d) => { if (e) { res.writeHead(404); return res.end(); } res.writeHead(200, { "content-type": MIME[path.extname(f)] || "application/octet-stream" }); res.end(d); }); });
await new Promise(r => server.listen(0, "127.0.0.1", r)); const base = `http://127.0.0.1:${server.address().port}`;
const b = await puppeteer.launch({ executablePath: CHROME, headless: "shell", args: ["--no-sandbox"] }); const p = await b.newPage(); await p.setViewport({ width: 1920, height: 1080 });
let errs = []; p.on("pageerror", e => errs.push(e.message)); const OUT = path.join(here, "out", "kg"); fs.mkdirSync(OUT, { recursive: true });
await p.goto(`${base}/kinds.html?ar=16x9`); await p.waitForFunction("window.__ready===true", { timeout: 60000 }).catch(() => {});
const all = await p.evaluate(`import("./mg2d/kinds/index.js").then(m => Object.entries(m.KINDS).map(([k, v]) => [k, v.family, Array.isArray(v.example) ? v.example.length : 1]))`);
const only = process.argv[2] ? process.argv[2].split(",") : null; const rep = [];
for (const [k, fam, nc] of all) { if (only && !only.includes(k)) continue;
  for (let c = 0; c < nc; c++) { errs = []; const r = { kind: k, family: fam, case: c };
    try { await p.goto(`${base}/kinds.html?ar=16x9&kind=${k}&case=${c}`); await p.waitForFunction("window.__ready===true", { timeout: 60000 });
      const info = await p.evaluate("window.__info"); r.caps = info.capAtHolds; r.minCap = Math.min(...info.capAtHolds.filter(x => isFinite(x)), 1e9); r.overlaps = info.overlaps;
      for (let i = 0; i < info.holds.length; i++) { await p.evaluate(`window.renderAt(${info.holds[i]})`); const b64 = await p.evaluate(`document.querySelector("canvas").toDataURL("image/jpeg",0.9).split(",")[1]`); fs.writeFileSync(path.join(OUT, `${k}_c${c}_${i}.jpg`), Buffer.from(b64, "base64")); }
    } catch (e) { r.error = e.message.slice(0, 200); }
    if (errs.length) r.pageErrors = errs.slice(0, 3); r.pass = !r.error && !r.pageErrors && r.minCap >= 21.6 && !(r.overlaps || []).length; rep.push(r);
    console.log(`${r.pass ? "PASS" : "FAIL"} ${k} c${c} minCap=${r.minCap?.toFixed?.(1)} ${(r.overlaps || []).length ? "OVERLAP " + JSON.stringify(r.overlaps.slice(0, 2)) : ""} ${r.error || ""} ${r.pageErrors ? r.pageErrors[0] : ""}`); } }
fs.writeFileSync(path.join(OUT, only ? "report_partial.json" : "report.json"), JSON.stringify(rep, null, 1)); console.log(`kinds ${new Set(rep.map(r => r.kind)).size}, cases ${rep.length}, pass ${rep.filter(r => r.pass).length}`);
await b.close(); server.close(); process.exit(rep.every(r => r.pass) ? 0 : 1);
