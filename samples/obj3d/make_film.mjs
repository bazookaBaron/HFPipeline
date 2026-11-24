#!/usr/bin/env node
// samples/obj3d/make_film.mjs - THE TRIGGER for the miniature film pipeline (runbook: CHANNEL-PIPELINE.md, authoritative).
//
//   node samples/obj3d/make_film.mjs <powder|partition> <film-id> [options]        (film id = <topic>_v1, e.g. suez_v1)
//
// Walks the runbook stages in order, prints each stage's status and exact commands, runs the ones that are ready and
// skips (with the reason) the ones whose inputs are missing. Stages that only an agent can do (fact sheet, script, photos,
// make_plan_v4.py, REPORT.md) print the brief to give the producer agent and are NOT run. Heavy jobs go through runtime/jobq.js.
//
//   stages: prereq > factsheet > script > voice > photos > plan > gates > render > mix > variants > thumbnail > report
//
//   --dry-run            print status + every command, run nothing, write nothing (also the default when stdin is not needed: safe to run any time)
//   --from <stage>       start at a stage (earlier stages still get their status computed, but nothing runs)
//   --only <stage>       run one stage
//   --to <stage>         stop after a stage
//   --redo <stage[,..]>  run a stage even if its outputs look up to date
//   --still <path>       thumbnail source still (default: out/<film>_169_s12.jpg, a mid-film shot still)
//   --no-jobq            run commands directly (debugging only; the runbook rule is jobq for every heavy job)
//   --list               list stages and exit            --help   this text
//
// Exit codes: 0 every stage done (or dry-run), 1 a command failed, 2 usage error, 3 finished the walk but stages are waiting (agent work or missing inputs).
// Never printed: API keys (.vendor-assets/.env is only checked for existence). Never done: commits, downloads, publishing.
import fs from "fs"; import path from "path"; import cp from "child_process"; import { fileURLToPath } from "url";
const HERE = path.dirname(fileURLToPath(import.meta.url)), REPO = path.resolve(HERE, "../..");
const A = process.argv.slice(2);
const STAGES = ["prereq", "factsheet", "script", "voice", "photos", "plan", "gates", "render", "mix", "variants", "thumbnail", "report"];
const help = () => console.log(fs.readFileSync(fileURLToPath(import.meta.url), "utf8").split("\n").filter(l => l.startsWith("//")).map(l => l.slice(3)).join("\n"));
if (!A.length || A.includes("--help") || A.includes("-h")) { help(); process.exit(A.length ? 0 : 2); }
if (A.includes("--list")) { console.log(STAGES.join("\n")); process.exit(0); }
const flag = k => A.includes(k), opt = k => { const i = A.indexOf(k); return i >= 0 ? A[i + 1] : undefined; };
const valued = new Set(["--from", "--only", "--to", "--redo", "--still"]);
const pos = A.filter((x, i) => !x.startsWith("--") && !valued.has(A[i - 1]));
const [CH, FILM] = pos;
const DRY = flag("--dry-run"), NOJOBQ = flag("--no-jobq"), REDO = new Set((opt("--redo") || "").split(",").filter(Boolean));
for (const k of ["--from", "--only", "--to"]) if (opt(k) && !STAGES.includes(opt(k))) { console.error(`unknown stage "${opt(k)}" (${STAGES.join(", ")})`); process.exit(2); }
for (const s of REDO) if (!STAGES.includes(s)) { console.error(`unknown stage "${s}" in --redo`); process.exit(2); }
if (!CH || !FILM) { console.error("usage: node samples/obj3d/make_film.mjs <powder|partition> <film-id> [--dry-run] ...   (--help)"); process.exit(2); }

const rd = f => { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch { return null; } };
const CHANNELS = rd(path.join(HERE, "channels.json")) || {}, NICHES = rd(path.join(REPO, "runtime/topics/niches.json")) || {};
if (!CHANNELS[CH] || CH.startsWith("_")) { console.error(`unknown channel "${CH}": use ${Object.keys(CHANNELS).filter(k => !k.startsWith("_")).join(" | ")}  (samples/obj3d/channels.json)`); process.exit(2); }
if (!/^[a-z0-9]+(_[a-z0-9]+)*$/.test(FILM)) { console.error(`film id "${FILM}" must be lowercase words joined by _ (e.g. suez_v1)`); process.exit(2); }
const CHAN = CHANNELS[CH], F = path.join(HERE, "films", FILM), OUT = path.join(HERE, "out");
const fp = (...p) => path.join(F, ...p), op = f => path.join(OUT, f), rel = p => path.relative(REPO, p).replace(/\\/g, "/");
const ex = p => fs.existsSync(p), mt = p => ex(p) ? fs.statSync(p).mtimeMs : 0;
const newest = ps => Math.max(0, ...ps.map(mt)), oldest = ps => Math.min(...ps.map(mt));
const QS = `ar=16x9&film=${FILM}`, ENVQS = { QS };
const py = (script, ...args) => `python ${[`samples/obj3d/${script}`, ...args].join(" ")}`;
const nodeS = (script, ...args) => `node ${[`samples/obj3d/${script}`, ...args].join(" ")}`;
const q = s => /[\s&"]/.test(s) ? `"${s.replace(/"/g, '\\"')}"` : s;
const WORDS = { min: 1450, max: 1650 };

// ---------------- in-process checks ----------------
function scriptCheck() {
  const f = fp("script.md"); if (!ex(f)) return { ok: false, msg: "script.md missing" };
  const src = fs.readFileSync(f, "utf8"), body = src.split(/^#end\b/m)[0], lines = [], issues = [], notes = [];
  for (const raw of body.split(/\r?\n/)) { const m = raw.trim().match(/^NARR \(([^)]*)\)(?: @[\d.]+)?(?: \[shows: [^\]]+\])?: (.+)/); if (m) lines.push(m[2].replace(/\s*\{[^}]*\}/g, "").trim()); }
  const words = lines.join(" ").split(/\s+/).filter(Boolean).length;
  if (!lines.length) issues.push("no NARR lines found (format: NARR (emotion) @t [shows: x]: text)");
  if (words < WORDS.min || words > WORDS.max) issues.push(`${words} spoken words, need ${WORDS.min}-${WORDS.max} (MINIATURE-LESSONS 22)`);
  const head = src.split(/\r?\n/).slice(0, 40).join("\n");
  if (!/^\s*model\s*:/mi.test(head)) notes.push("header has no `model:` (voice.py default s2.1-pro applies)");
  if (!/^\s*tempo\s*:/mi.test(head)) notes.push("header has no `tempo:` (voice.py default 1.3 applies)");
  if (!/^#end\b/m.test(src)) issues.push("no #end marker");
  if (!/^#hook\b/m.test(src)) notes.push("no #hook marker");
  const ch = (src.match(/^#chapter\b/gm) || []).length; if (ch < 5 || ch > 7) notes.push(`${ch} #chapter markers (runbook: 5-7)`);
  if (!ex(fp("factsheet.md"))) notes.push("no factsheet.md to diff the header against (lesson 4)");
  return { ok: !issues.length, msg: `${lines.length} lines, ${words} words` + (issues.length ? "; FAIL: " + issues.join("; ") : ""), notes };
}
function endLineCheck() {
  const j = rd(fp("channels.json")); if (!j) return { ok: false, msg: "films/" + FILM + "/channels.json missing" };
  const e = j[CH]; if (!e) return { ok: false, msg: `films/${FILM}/channels.json has no "${CH}" entry` };
  const issues = [];
  if (e.name !== CHAN.name) issues.push(`name "${e.name}" != "${CHAN.name}"`);
  const m = String(e.line || "").match(/^NARR \(([^)]*)\)(?: @[\d.]+)?(?: \[shows: [^\]]+\])?: (.+)/); if (!m) issues.push('line must look like "NARR (plain, dry): ..." and come from the script-writer agent');
  else { const t = m[2].replace(/\s*\{[^}]*\}/g, "").trim();
    if (!t.includes(CHAN.name)) issues.push(`line does not contain "${CHAN.name}"`);
    if (!/\blike\b/i.test(t)) issues.push('no word starting "like" (the Like pill presses on it, film.html end card)');
    if (!/subscribe/i.test(t)) issues.push('no "subscribe"');
    if (CHAN.endLine?.nameMustCloseOwnSentence) { const sent = t.split(/(?<=[.!?])\s+/).filter(Boolean), last = sent[sent.length - 1] || "";
      if (!(last.replace(/[.!?]+$/, "").endsWith(CHAN.name) && last.split(/\s+/).length <= 8)) issues.push(`name must close its own short sentence, e.g. "${CHAN.endLine.nameSentence}" (lesson 23)`); } }
  const others = Object.keys(j).filter(k => k !== CH && !k.startsWith("_")); if (others.length) issues.push(`extra channel entries (${others.join(", ")}) would build extra variants: remove them (one channel per film)`);
  return { ok: !issues.length, msg: issues.length ? issues.join("; ") : "end line ok" };
}
function gatesState() {
  const g = rd(op(`${FILM}_169_gates.json`)), l = rd(fp("linecheck_169.json")), why = [];
  if (!g) why.push("shots gate never ran"); else if (!g.pass) why.push("v3 gates FAIL: " + (g.fails || []).join(", "));
  else if (g.at < newest([fp("plan.json"), fp("lines.json"), fp("entities.json"), fp("photos.json"), fp("photos_missing.txt"), path.join(HERE, "film.html")])) why.push("v3 gate record is stale (plan/lines/photos/film.html changed since)");
  if (!l) why.push("lines gate never ran"); else if (!l.pass) why.push(`LINE GATE FAIL (${l.fails} line(s))`);
  return { ok: !why.length, msg: why.join("; ") || "v3 gates + line gate pass" };
}
function kindsUsed() {
  const plan = rd(fp("plan.json")); if (!plan) return []; const reg = new Set(fs.readdirSync(path.join(HERE, "mg2d/kinds")).filter(f => f.endsWith(".js") && !f.startsWith("_") && f !== "index.js").map(f => f.slice(0, -3))), got = new Set();
  const walk = o => { if (Array.isArray(o)) o.forEach(walk); else if (o && typeof o === "object") { if (typeof o.kind === "string" && reg.has(o.kind)) got.add(o.kind); Object.values(o).forEach(walk); } }; walk(plan.mg || []); return [...got].sort();
}
function loudness(file) {
  const r = cp.spawnSync("ffmpeg", ["-hide_banner", "-i", file, "-map", "0:a", "-af", "ebur128=peak=true", "-f", "null", "-"], { encoding: "utf8" }).stderr || "";
  const I = [...r.matchAll(/I:\s+(-?[\d.]+) LUFS/g)].pop(), P = [...r.matchAll(/Peak:\s+(-?[\d.]+) dBFS/g)].pop(); if (!I) return { ok: false, msg: "ffmpeg could not measure loudness" };
  const lufs = +I[1], tp = P ? +P[1] : null, ok = Math.abs(lufs + 14) <= 0.5 && (tp === null || tp <= -1); return { ok, msg: `${lufs} LUFS (want -14 +-0.5), true peak ${tp} dBTP (want <= -1)` };
}

// ---------------- engine files film.html needs (some may be mid-rebuild) ----------------
const ENGINE = ["film.html", "sets/composer.js", "sets/rooms.js", "map3d.js", "subjects.js", "photo_cards.js", "mg2d/core.js", "mg2d/kinds/index.js", "render.mjs", "keycheck.mjs"].map(f => path.join(HERE, f));
const engineMissing = () => ENGINE.filter(f => !ex(f)).map(f => path.relative(HERE, f).replace(/\\/g, "/"));
const needsMap = () => { const p = rd(fp("plan.json")); return !!(p && p.map); };
const geoMissing = () => needsMap() && ![path.join(HERE, "data/ne_110m_admin_0_countries.geojson"), path.join(REPO, "runtime/geo/ne_110m_admin_0_countries.geojson"), path.join(REPO, ".vendor-assets/geo/ne_110m_admin_0_countries.geojson")].some(ex);

// ---------------- the stages ----------------
// a stage: { id, title, inputs:[files], outputs:[files], agent?:string, steps:[{cmd, kind?, env?, fn?, label}], blocked?():string|null, done?():{ok,msg}|null }
const brief = {
  factsheet: `Research agent -> films/${FILM}/factsheet.md: dated claims, each with a source URL and a tag filed / ruled / reported / alleged. ${CH === "powder" ? "Name living people only with charges, filings or rulings." : "Separate measured facts (tonnage, share, price, date) from analyst opinion."} Topic pick comes from the radar (node runtime/topics/radar.mjs --channel ${CH}) and the user.`,
  script: `Script-writer agent (longform-writer skill; NEVER write lines yourself) -> films/${FILM}/script.md in the SCRIPT-REVIEW-2026-11-15.md format: header (title from niches.json ${CH}.titlePatterns, fact block diffed against the fact sheet, model:, tempo:), #hook, 5-7 #chapter, {loop}/{payoff}, {dry}, #part, #payoff, ${WORDS.min}-${WORDS.max} spoken words, channel voice: ${CHAN.voice}. The same agent writes the end line (see variants stage).`,
  photos: `Photo agent -> films/${FILM}/photos.json (every entry contentCheck: "ok - <what you saw>"), entities.json ([{name, kind, lines}]), photos_missing.txt ("Name: reason"), credits.txt, and the image files named in photos.json. Credited copyrighted/news photos allowed (lessons 17, 27); view every photo; 4.5-5 cards/min by coverage, not quota. No AI images of real people. Needs lines.json (run the voice stage first).`,
  plan: `Producer agent -> films/${FILM}/make_plan_v4.py (copy the WIRING, not the content, from films/trump_v4/make_plan_v4.py: all-new sets for THIS script, >= 85% room+street time, MG for numbers 25-35%, in-world chapter titles, photo cards on 3D lines, page beds/cues, endcard). Run it to write plan.json (PLAN.v3 = true) + sound.json. Rule 0: no asset/scene reuse across films.`,
  report: `Main thread -> films/${FILM}/REPORT.md: files, length, loudness (-14 +-0.5 LUFS, <= -1 dBTP), photo count + missing list, voice flags, gates, weak spots, time per stage, the logged human review line (date, who, what: facts vs fact sheet, names, ad-safety), upload description (CHANNEL-PIPELINE step 8; footer: "${CHAN.uploadFooter}"), tags from niches.json ${CH}.seoKeywords. Also look at the end-card frame + thumbnail yourself; then Shorts per niches.json ${CH}.shorts (3 x 35-55 s, own hook lines from the script writer).`,
};
const STILL = opt("--still") ? path.resolve(opt("--still")) : op(`${FILM}_169_s12.jpg`);
const S = {
  prereq: { title: "prerequisites (tools, channel, niche block, engine files)", inputs: [], outputs: [], steps: [{ label: "check", fn: () => {
    const bad = [], warn = [], tools = [["node", ["--version"]], ["python", ["--version"]], ["ffmpeg", ["-version"]], ["ffprobe", ["-version"]]];
    for (const [t, a] of tools) { const r = cp.spawnSync(t, a, { encoding: "utf8" }); if (r.error || r.status !== 0) bad.push(`${t} not runnable`); }
    if (!ex(path.join(REPO, "runtime/jobq.js"))) bad.push("runtime/jobq.js missing");
    const chrome = process.env.CHROME || "C:/Users/debna/.cache/puppeteer/chrome-headless-shell/win64-146.0.7680.153/chrome-headless-shell-win64/chrome-headless-shell.exe"; if (!ex(chrome)) bad.push("chrome-headless-shell missing: " + chrome + " (set CHROME=)");
    if (!ex(path.join(REPO, "node_modules/puppeteer-core/package.json"))) bad.push("node_modules/puppeteer-core missing (npm install)");
    if (!ex(path.join(REPO, "runtime/vendor/three/build/three.module.js"))) bad.push("runtime/vendor/three/build/three.module.js missing");
    const nb = NICHES[CH]; if (!nb) bad.push(`runtime/topics/niches.json has no "${CH}" block`); else { if (nb.channel !== CHAN.name) warn.push(`niches.json channel "${nb.channel}" != channels.json "${CHAN.name}"`); if (nb.tagline !== CHAN.tagline) warn.push(`niches.json tagline "${nb.tagline}" differs from channels.json "${CHAN.tagline}"`); }
    if (!ex(path.join(REPO, ".vendor-assets/.env"))) warn.push(".vendor-assets/.env missing: voice (Fish) will fail; key is never printed");
    const em = engineMissing(); if (em.length) warn.push("engine files missing (gates/render are blocked until restored): " + em.join(", "));
    for (const d of ["MINIATURE-LESSONS.md", "MINIATURE-PLAN.md", "SCRIPT-REVIEW-2026-11-15.md", "CHANNEL-PIPELINE.md"]) if (!ex(path.join(HERE, d))) warn.push(d + " missing");
    if (!/_v\d+$/.test(FILM)) warn.push(`film id "${FILM}" does not end in _v<N> (runbook: <topic>_v1)`);
    return { ok: !bad.length, msg: (bad.length ? "FAIL: " + bad.join("; ") : `channel ${CHAN.name} (${CHAN.tagline}), niche block ok`) + (warn.length ? "\n      warn: " + warn.join("\n      warn: ") : "") };
  } }] },
  factsheet: { title: "fact sheet (research agent)", inputs: [], outputs: [fp("factsheet.md")], agent: brief.factsheet, steps: [] },
  script: { title: "script (script-writer agent) + word-count gate", inputs: [fp("factsheet.md")], outputs: [fp("script.md")], agent: brief.script, steps: [{ label: `script check (${WORDS.min}-${WORDS.max} words)`, fn: scriptCheck }],
    note: "factsheet is an input only so the header can be diffed; the script itself is the stage output" , softInputs: true },
  voice: { title: "voice (Fish, one call per line) -> voice.wav + lines.json + words.json", inputs: [fp("script.md"), path.join(REPO, ".vendor-assets/.env")], outputs: [fp("voice.wav"), fp("lines.json"), fp("words.json")], pre: () => scriptCheck(),
    steps: [{ cmd: py("audio/voice.py", FILM, "tts"), kind: "voice", label: "tts (cached takes in take/)" }, { cmd: py("audio/voice.py", FILM, "build"), kind: "voice", label: "build (trim, tempo, place, ASR word times; stops on mispronounced words: reroll once, --force only for near-homophones, list them in the report)" }] },
  photos: { title: "photos + entities (photo agent)", inputs: [fp("lines.json")], outputs: [fp("photos.json"), fp("entities.json")], agent: brief.photos, steps: [] },
  plan: { title: "plan (producer agent writes make_plan_v4.py; then it runs)", inputs: [fp("lines.json"), fp("script.md"), fp("make_plan_v4.py")], outputs: [fp("plan.json")], agent: brief.plan,
    steps: [{ cmd: `python samples/obj3d/films/${FILM}/make_plan_v4.py`, label: "write plan.json + sound.json" }] },
  gates: { title: "gates (keycheck, shots/v3, lines, photocheck, kindgate, contact sheets)", inputs: [fp("plan.json"), fp("lines.json"), fp("words.json")], outputs: [],
    blocked: () => { const em = engineMissing(); return em.length ? "engine files missing: " + em.join(", ") : geoMissing() ? "plan uses a map but data/ne_110m_admin_0_countries.geojson is missing (download needs the user's OK; Natural Earth 110m, public domain)" : null; },
    done: () => { const g = gatesState(); return g.ok && ex(op(`${FILM}_169_sheet.jpg`)) ? g : { ok: false, msg: g.ok ? "gates pass but no contact sheet yet" : g.msg }; },
    steps: [{ cmd: nodeS("keycheck.mjs", FILM, "ar=16x9"), kind: "snap", label: "keycheck (camera key list)" },
      { cmd: nodeS("render.mjs", "shots", "film"), kind: "snap", env: ENVQS, label: "shots = every v3 gate + photo coverage -> out/<film>_169_gates.json" },
      { cmd: nodeS("render.mjs", "lines", "film", FILM), kind: "snap", env: ENVQS, label: "lines gate (narration/subjects) -> LINE GATE PASS" },
      { cmd: nodeS("photocheck.mjs", FILM), label: "photo coverage" },
      { cmd: () => { const k = kindsUsed(); return k.length ? nodeS("mg2d/kindgate.mjs", k.join(",")) : null; }, kind: "snap", label: "kindgate for the MG kinds this plan uses" },
      { cmd: nodeS("render.mjs", "sheet", "film", "shots"), env: ENVQS, label: "contact sheet of the shot stills (review 3 rounds)" },
      { cmd: nodeS("render.mjs", "sheet", "film", "lines"), env: ENVQS, label: "contact sheet of the line stills" },
      { fn: gatesState, label: "gate summary (a failing gate is fixed at the cause, never loosened)" }] },
  render: { title: "render (frame by frame, 30 fps, 1920x1080)", inputs: [fp("plan.json"), op(`${FILM}_169_gates.json`)], outputs: [op(`${FILM}_169.mp4`)], pre: gatesState,
    blocked: () => engineMissing().length ? "engine files missing: " + engineMissing().join(", ") : null,
    steps: [{ cmd: nodeS("render.mjs", "video", "film", "30"), kind: "render", env: { ...ENVQS, VW: "1920", VH: "1080" }, label: "render.mjs refuses a failing/stale v3 record by itself (exit 3)" }] },
  mix: { title: "mix (voice + beds + cues + music, -14 LUFS / <= -1 dBTP)", inputs: [op(`${FILM}_169.mp4`), fp("voice.wav"), fp("sound.json"), fp("cues.json")], outputs: [op(`${FILM}_169_final.mp4`)],
    steps: [{ cmd: py("audio/mix.py", FILM, "169"), kind: "ff", label: "mix.py (MIX_TP default -2)" }, { fn: () => ex(op(`${FILM}_169_final.mp4`)) ? loudness(op(`${FILM}_169_final.mp4`)) : { ok: false, msg: "no final mp4 to measure (dry run)" }, label: "ebur128 on the mp4" }] },
  variants: { title: `end line + end card for ${CHAN.name} only (variants.py)`, inputs: [fp("channels.json"), op(`${FILM}_169.mp4`), fp("voice.wav"), fp("beds.json")], outputs: [op(`${FILM}_169_final_${CH}.mp4`)],
    agent: `Script-writer agent writes films/${FILM}/channels.json = {"${CH}": {"name": "${CHAN.name}", "line": "NARR (plain, dry): <last fact line>. Like the video, and subscribe. ${CHAN.endLine?.nameSentence || CHAN.name + "."}"}} (ONE entry, this channel only).`,
    pre: endLineCheck, steps: [{ cmd: py("variants.py", FILM, "--ch", CH), label: "voice > prep > gate > render tail > splice > mix > check (resume with --from <stage>)" }] },
  thumbnail: { title: "thumbnail (1280x720, white miniature + one red subject + number + label tag)", inputs: [fp("make_thumb.py"), STILL], outputs: [op(`${FILM}_thumb.jpg`)],
    agent: `Producer writes films/${FILM}/make_thumb.py (follow films/trump_v4/make_thumb.py + niches.json ${CH}.thumbnailPatterns; no faces). Usage there: python make_thumb.py <still.jpg> [x y] -> out/${FILM}_thumb.jpg. A film is not done without it; look at it.`,
    steps: [{ cmd: `python samples/obj3d/films/${FILM}/make_thumb.py ${rel(STILL)}`, label: "thumbnail from a shot still (pick one from the contact sheet; --still <path>)" }] },
  report: { title: "report + upload description + Shorts (main thread)", inputs: [op(`${FILM}_169_final_${CH}.mp4`), op(`${FILM}_thumb.jpg`)], outputs: [fp("REPORT.md")], agent: brief.report, steps: [] },
};

// ---------------- walk ----------------
const log = [], st = { done: [], ran: [], waiting: [], failed: null };
const from = opt("--only") || opt("--from") || STAGES[0], to = opt("--only") || opt("--to") || STAGES[STAGES.length - 1], i0 = STAGES.indexOf(from), i1 = STAGES.indexOf(to);
const stepCmd = s => typeof s.cmd === "function" ? s.cmd() : s.cmd;
const shell = (s) => { const c = stepCmd(s); if (!c) return null; const env = Object.entries(s.env || {}).map(([k, v]) => `${k}=${q(v)}`).join(" "); const base = (s.kind && !NOJOBQ) ? `node runtime/jobq.js --kind ${s.kind} --prio 1 -- ${q(c)}` : c; return (env ? env + " " : "") + base; };
function run(s) {
  const c = stepCmd(s); const args = (s.kind && !NOJOBQ) ? ["runtime/jobq.js", "--kind", s.kind, "--prio", "1", "--", c] : null;
  const r = args ? cp.spawnSync("node", args, { cwd: REPO, stdio: "inherit", env: { ...process.env, ...(s.env || {}) } }) : cp.spawnSync(c, { cwd: REPO, stdio: "inherit", shell: true, env: { ...process.env, ...(s.env || {}) } });
  return r.status ?? 1;
}
console.log(`make_film  channel=${CH} (${CHAN.name} | ${CHAN.tagline})  film=${FILM}  ${DRY ? "[DRY RUN: nothing runs, nothing is written]" : ""}\nfilm dir: ${rel(F)}${ex(F) ? "" : "  (does not exist yet; the agent stages create it)"}\n`);
for (let i = 0; i < STAGES.length; i++) {
  const id = STAGES[i], s = S[id], active = i >= i0 && i <= i1, t0 = Date.now();
  const miss = s.inputs.filter(f => !ex(f)).filter(f => !(s.softInputs && f.endsWith("factsheet.md"))), outs = s.outputs, outsOk = outs.length > 0 && outs.every(ex);
  let fresh = outsOk && (!s.inputs.length || newest(outs) >= newest(s.inputs.filter(ex)) - 1), extra = s.done ? s.done() : null;
  if (s.done) fresh = !!extra?.ok; else if (id === "script" && outsOk) { const c = scriptCheck(); fresh = c.ok; extra = c; }
  const blocked = s.blocked ? s.blocked() : null;
  const head = `[${String(i).padStart(2, "0")} ${id}] ${s.title}`;
  if (!active) { if (opt("--only")) continue; console.log(head + `\n      (outside --from/--to range: ${fresh ? "outputs present" : "not checked"})\n`); if (fresh) st.done.push(id); continue; }
  if (fresh && !REDO.has(id) && id !== "prereq") { console.log(head + `\n      DONE: ${outs.map(rel).join(", ") || "-"}${extra?.msg ? " (" + extra.msg + ")" : ""}\n`); st.done.push(id); if (!DRY || true) { /* nothing to run */ } continue; }
  const missing = miss.map(f => rel(f) + (f.endsWith(".env") ? " (key file: only its existence is checked)" : ""));
  const why = blocked ? [blocked] : missing.length ? [`inputs missing: ${missing.join(", ")}`] : [];
  // in-stage precondition (e.g. script word count before voice, gates before render)
  if (!why.length && s.pre) { const p = s.pre(); if (!p.ok) why.push(p.msg); }
  console.log(head + `\n      status: ${s.agent && !outsOk ? "WAITING (agent work)" : why.length ? "SKIPPED" : "READY"}`);
  if (why.length) console.log("      skip reason: " + why.join("; "));
  if (s.agent && (!outsOk || REDO.has(id))) console.log("      brief: " + s.agent);
  for (const stp of s.steps) { const c = stp.fn ? null : shell(stp); console.log(`      ${stp.fn ? "check" : "$"} ${c || "(" + stp.label + ")"}${stp.label && c ? "    # " + stp.label : ""}`); }
  if (s.note) console.log("      note: " + s.note);
  if (id === "prereq") { const r = s.steps[0].fn(); console.log("      " + (r.ok ? "ok: " : "FAIL: ") + r.msg); if (!r.ok && !DRY) { console.log("\nprerequisites failed: fix the above first"); process.exit(1); } console.log(); st.done.push(id); continue; }
  if (why.length || (s.agent && !outsOk)) { st.waiting.push(id + (s.agent && !outsOk ? " (agent)" : ` (${why[0].slice(0, 90)})`)); console.log(); continue; }
  if (DRY) { console.log(); continue; }
  let ok = true;
  for (const stp of s.steps) {
    if (stp.fn) { const r = stp.fn(); console.log(`      ${r.ok ? "ok" : "FAIL"}: ${r.msg}`); if (r.notes) r.notes.forEach(n => console.log("      note: " + n)); if (!r.ok) { ok = false; break; } continue; }
    const c = stepCmd(stp); if (!c) { console.log(`      (skipped: ${stp.label}: nothing to run)`); continue; }
    console.log(`      > ${shell(stp)}`); const rc = run(stp);
    if (rc) { console.log(`      step failed (exit ${rc}): ${stp.label || c}`); ok = false; break; } }
  log.push({ stage: id, ok, seconds: Math.round((Date.now() - t0) / 1000) }); console.log(`      ${ok ? "stage ok" : "STAGE FAILED"} (${Math.round((Date.now() - t0) / 1000)} s)\n`);
  if (!ok) { st.failed = id; break; } st.ran.push(id);
}
if (!DRY && log.length) { fs.mkdirSync(F, { recursive: true }); const lf = fp("make_film.log.json"), prev = rd(lf) || []; fs.writeFileSync(lf, JSON.stringify([...prev, { at: new Date().toISOString(), channel: CH, stages: log }], null, 1)); }
console.log("summary: done " + (st.done.join(", ") || "-") + (st.ran.length ? " | ran " + st.ran.join(", ") : "") + (st.waiting.length ? "\n         waiting: " + st.waiting.join("; ") : "") + (st.failed ? `\n         FAILED at ${st.failed}` : ""));
const next = st.waiting[0]; if (next && !DRY) console.log(`next: ${next.split(" ")[0]} - give the brief above to the producer/agent, then rerun the same command (finished stages are skipped).`);
process.exit(st.failed ? 1 : DRY ? 0 : st.waiting.length ? 3 : 0);
