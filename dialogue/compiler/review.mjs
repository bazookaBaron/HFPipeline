// DIALOGUE review: run the gates, print ONLY failures + the shot ids that need a human look, build one small contact sheet per chapter.
//   node dialogue/compiler/review.mjs <ep> [--run]
//   --run   first queue the engine jobs through runtime/jobq.js (epgate, then the existing `sheet` job); without it the existing out/ artifacts are used.
// Needs: episodes/<ep>/shots.json + PLAN.md (gates parse it; autoplan.mjs --plan-md writes it) + out/gates_engine.json (epgate) + out/sheet/ (sheet job).
// Chapters: `## title` headings between the script lines; if none, ~12 s windows split at line boundaries. Output: out/review/chapter_<k>.png (+ review.txt).
// Flagged shots (gate failures, PLAN.auto.flags.json from autoplan) get a RED border in the chapter sheets.
import fs from "fs"; import path from "path"; import cp from "child_process"; import { fileURLToPath } from "url";
const here = path.dirname(fileURLToPath(import.meta.url)), DLG = path.resolve(here, ".."), REPO = path.resolve(DLG, "..");
const args = process.argv.slice(2); const ep = args.find(a => !a.startsWith("--")) || "cloud"; const EPD = path.join(DLG, "episodes", ep), OUT = path.join(EPD, "out"); fs.mkdirSync(path.join(OUT, "review"), { recursive: true });
const rj = f => JSON.parse(fs.readFileSync(f, "utf8")); const L = []; const say = s => { L.push(s); console.log(s); };
const queue = (...a) => { const r = cp.spawnSync("node", ["runtime/jobq.js", "--kind", "render", "--", "node", "dialogue/engine/render.mjs", ...a], { cwd: REPO, stdio: "inherit" }); return r.status; };
if (args.includes("--run")) { queue("epgate", ep); queue("sheet", ep); }

// ---- gates (static gates.mjs reads PLAN.md + shots.json + out/gates_engine.json) ----
cp.spawnSync("node", [path.join(here, "gates.mjs"), ep], { cwd: REPO, stdio: "ignore" });
const gt = fs.readFileSync(path.join(OUT, "gates.txt"), "utf8").split(/\r?\n/); const failed = []; const notRun = []; let cur = null; const failShots = new Set();
for (const ln of gt) { if (/^RESULT/.test(ln)) { cur = null; if (/: FAIL/.test(ln)) { cur = ln; failed.push([ln]); } else if (/NOT RUN/.test(ln)) notRun.push(ln.split(":")[0].replace("RESULT ", "")); } else if (cur && /^\s+x /.test(ln)) { failed[failed.length - 1].push(ln); for (const m of ln.matchAll(/(?:shot )?#(\d+)/g)) failShots.add(+m[1]); } }
const E = rj(path.join(EPD, "shots.json"));
say(`# review ${ep}: ${E.shots.length} shots, ${E.duration} s, plan by ${E.generated.split(" ")[0]}`);
if (!failed.length && !notRun.length) say("GATES: all PASS"); else {
  if (notRun.length) say(`GATES NOT RUN: ${notRun.join(", ")} (engine data missing: run with --run, or: node runtime/jobq.js --kind render -- node dialogue/engine/render.mjs epgate ${ep})`);
  for (const f of failed) f.forEach((x, i) => say(i ? x : "FAIL " + x.replace(/^RESULT /, ""))); }
// ---- shots for a human look ----
const ff = path.join(EPD, "PLAN.auto.flags.json"); const flags = fs.existsSync(ff) ? rj(ff) : { shotsToLook: [], byLine: {} }; const look = new Map();
for (const n of failShots) look.set(n, ["gate failure"]);
for (const n of flags.shotsToLook ?? []) { const s = E.shots[n - 1]; if (!s) continue; const why = s.cut === "tail" ? ["tail (no voice)"] : (flags.byLine?.[s.line] ?? []); if (!look.has(n)) look.set(n, []); look.get(n).push(...why); }
if (look.size) { say(`LOOK AT shots: ${[...look.keys()].sort((a, b) => a - b).join(", ")}`); for (const [n, why] of [...look].sort((a, b) => a[0] - b[0])) say(`  #${n} ${E.shots[n - 1].t0.toFixed(2)}-${E.shots[n - 1].t1.toFixed(2)} ${E.shots[n - 1].plan}: ${[...new Set(why)].join("; ")}`); } else say("LOOK AT shots: none");
if (E.warnings?.length) say("plan warnings: " + E.warnings.join(" | "));

// ---- chapter sheets from the existing sheet job's tiles ----
const idxF = path.join(OUT, "sheet_index.json"); const sheetDir = path.join(OUT, "sheet");
if (!fs.existsSync(idxF)) say(`SHEETS: none (sheet job not run: node runtime/jobq.js --kind render -- node dialogue/engine/render.mjs sheet ${ep}, or re-run review with --run)`);
else {
  const idx = rj(idxF).tiles; const mids = idx.filter(t => !/\| peak /.test(t.label)).map(t => ({ ...t, n: +/^#(\d+)/.exec(t.label)[1], t: +/t=([\d.]+)/.exec(t.label)[1] }));
  // chapters: '## heading' groups in script.md (before #end), else ~12 s windows
  const sm = fs.readFileSync(path.join(EPD, "script.md"), "utf8").split(/\r?\n/); const heads = []; let ln = 0; for (const r of sm) { if (/^#end/.test(r)) break; if (/^## /.test(r)) heads.push({ line: ln + 1, title: r.slice(3).trim() }); else if (/^[A-Z]+ \(/.test(r.trim())) ln++; }
  const chapters = []; if (heads.length) { heads.forEach((h, i) => { const l0 = h.line, l1 = i + 1 < heads.length ? heads[i + 1].line - 1 : 1e9; chapters.push({ title: h.title, shots: E.shots.filter(s => s.line >= l0 && s.line <= l1 && !(s.cut === "tail" && i + 1 < heads.length)).map(s => s.n) }); }); }
  else { let c = []; let t0 = 0; for (const s of E.shots) { if (c.length && s.t0 - t0 >= 12 && s.cut !== "cutin") { chapters.push({ title: `${t0.toFixed(0)}-${s.t0.toFixed(0)} s`, shots: c }); c = []; t0 = s.t0; } c.push(s.n); } if (c.length) chapters.push({ title: `${t0.toFixed(0)}-${E.duration.toFixed(0)} s`, shots: c }); }
  chapters.forEach((ch, k) => { const tiles = ch.shots.map(n => mids.find(m => m.n === n)).filter(Boolean); if (!tiles.length) return; const f = path.join(OUT, "review", `chapter_${k + 1}.png`); const ins = tiles.flatMap(t => ["-i", path.join(sheetDir, t.file)]);
    const fl = tiles.map((t, i) => `[${i}:v]scale=216:384,pad=224:392:4:4:color=${look.has(t.n) ? "red" : "0x1b2430"}[v${i}]`).join(";") + ";" + tiles.map((_, i) => `[v${i}]`).join("") + `xstack=inputs=${tiles.length}:layout=${tiles.map((_, i) => `${(i % 6) * 224}_${Math.floor(i / 6) * 392}`).join("|")}[o]`;
    const r = cp.spawnSync("ffmpeg", ["-y", "-loglevel", "error", ...ins, "-filter_complex", fl, "-map", "[o]", "-frames:v", "1", f]); say(r.status === 0 ? `SHEET chapter ${k + 1} "${ch.title}": shots ${ch.shots.map(n => "#" + n + (look.has(n) ? "*" : "")).join(" ")} -> ${path.relative(REPO, f)}` : `SHEET chapter ${k + 1} failed: ${r.stderr}`); });
  say("(* = needs a look, red border in the sheet; open only these sheets, not every still)");
}
fs.writeFileSync(path.join(OUT, "review", "review.txt"), L.join("\n") + "\n");
