#!/usr/bin/env node
/* Post-run cleanup for ANY pipeline (puppet long-form/reels/shorts, dialogue episodes).
 * Keeps only: final videos, thumbnails, and small text sources (scripts, json, html, md, ...).
 * Deletes every other generated asset: intermediate/silent/test videos, audio, frames, stills,
 * photos, snapshot/render/cache dirs.
 *   node runtime/cleanup_run.js <run-dir> [--dry]      env KEEP_ASSETS=1 skips (for re-finishing a run)
 */
const fs = require("fs"), path = require("path");
const TEXT = new Set([".md", ".txt", ".json", ".js", ".mjs", ".cjs", ".html", ".css", ".py", ".sh", ".csv", ".yaml", ".yml", ".srt", ".vtt", ".svg"]);
const IMG = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif"]);
const DROP_DIRS = /^(frames?|snapshots?|renders?|sheets?|stills?.*|tmp|temp|_work|cache|\.cache|layers|media|vo|audio|sfx|music|clips?|_probe.*)$/i;
const FINAL_VIDEO = /^(final.*|.*_final.*|.*_(9x16|16x9|169)(_v\d+)?|part-\d+|short.*)\.(mp4|mov|webm)$/i;
const BAD_VIDEO = /(silent|rough|test|probe|outro|main|_tmp|_work|pad)/i;
const THUMB = /thumb|cover/i;

function clean(dir, dry) {
  let freed = 0, n = 0;
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) {
        if (e.name === "node_modules") continue;
        if (DROP_DIRS.test(e.name)) { freed += size(p); n++; if (!dry) fs.rmSync(p, { recursive: true, force: true }); }
        else { walk(p); }
        continue;
      }
      const ext = path.extname(e.name).toLowerCase();
      const isFinal = FINAL_VIDEO.test(e.name) && !(BAD_VIDEO.test(e.name) && !/^final/i.test(e.name) && !/_final/i.test(e.name));
      const keep = TEXT.has(ext) || isFinal || (IMG.has(ext) && THUMB.test(e.name)) || /^final.*(720p)?\.mp4$/i.test(e.name);
      if (!keep) { freed += fs.statSync(p).size; n++; if (!dry) fs.rmSync(p, { force: true }); }
    }
  };
  const size = (p) => { let s = 0; for (const e of fs.readdirSync(p, { withFileTypes: true })) { const q = path.join(p, e.name); s += e.isDirectory() ? size(q) : fs.statSync(q).size; } return s; };
  walk(dir);
  console.log(`[cleanup] ${dry ? "would remove" : "removed"} ${n} items, ${(freed / 1e6).toFixed(0)} MB from ${dir}`);
}
module.exports = { clean };
if (require.main === module) {
  const dir = process.argv[2];
  if (!dir || !fs.existsSync(dir)) { console.error("usage: node runtime/cleanup_run.js <run-dir> [--dry]"); process.exit(1); }
  if (process.env.KEEP_ASSETS === "1") { console.log("[cleanup] skipped (KEEP_ASSETS=1)"); process.exit(0); }
  clean(path.resolve(dir), process.argv.includes("--dry"));
}
