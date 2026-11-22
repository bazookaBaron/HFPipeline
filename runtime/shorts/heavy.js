// Heavy-job gate for the Doc2D tools: every render, snapshot, bake, voice synthesis and ffmpeg finish pass goes through the
// machine-wide queue runtime/jobq.js (1 slot, starts only with >= 3 GB free RAM, below-normal CPU priority).
//   run(cmd, { kind, prio, cwd })   a shell command through the queue (make.js)
//   selfQueue(module, kind, prio)   at the top of a heavy CLI script: re-runs this script once inside a queue slot
// Inside a slot JOBQ_INNER=1 is set, so nested heavy steps run directly (no deadlock on the single slot).
// JOBQ=0 bypasses the queue (debugging). JOBQ_PRIO sets the default priority (1 = the user is waiting, 5 = default, 9 = demo).
const cp = require("child_process"), path = require("path");
const JOBQ = path.resolve(__dirname, "..", "jobq.js");
const off = () => process.env.JOBQ === "0" || !!process.env.JOBQ_INNER;
const prioOf = (p) => String(p != null ? p : process.env.JOBQ_PRIO || 5);
const env = () => Object.assign({}, process.env, { JOBQ_INNER: "1" });

function run(cmd, o = {}) {
  if (off()) return cp.execSync(cmd, { cwd: o.cwd, stdio: "inherit", shell: true });
  const r = cp.spawnSync(process.execPath, [JOBQ, "--kind", o.kind || "render", "--prio", prioOf(o.prio), "--", cmd], { cwd: o.cwd, stdio: "inherit", env: env() });
  if (r.status !== 0) { const e = new Error(`jobq job failed (exit ${r.status}): ${cmd}`); e.status = r.status; throw e; }
}

function selfQueue(mod, kind, prio) {
  if (off() || require.main !== mod) return;
  const r = cp.spawnSync(process.execPath, [JOBQ, "--kind", kind || "render", "--prio", prioOf(prio), "--", process.execPath, ...process.argv.slice(1)], { stdio: "inherit", env: env() });
  process.exit(r.status == null ? 1 : r.status);
}

// which make.js commands are heavy, and their queue kind
function kindOf(cmd) {
  if (/hyperframes@[\d.]+ (render|snapshot)/.test(cmd)) return /snapshot/.test(cmd) ? "snap" : "render";
  if (/bake[\\/](bake|lookdev|tex)\.js/.test(cmd)) return "bake";
  if (/voice\.py|append_endcard|voice_/.test(cmd)) return "voice";
  if (/bake[\\/]finish\.js|mix\.py|^ffmpeg|\bffmpeg /.test(cmd)) return "ff"; // ffmpeg-only steps: own low-RAM lane, run beside renders
  return null;
}

module.exports = { run, selfQueue, kindOf, JOBQ };
