#!/usr/bin/env node
// Global heavy-job queue: renders, bakes, snapshots, voice, ffmpeg passes.
// Usage:  node runtime/jobq.js [--kind render|voice|bake|snap] [--prio 1-9] -- <command ...>
//         node runtime/jobq.js status
// - One job per lane at once (main render/bake, light snap/QA, voice, ff = ffmpeg/mix/finish), each gated by free RAM.
// - A job starts when free RAM >= its lane floor (JOBQ_MIN_FREE_GB, default 3), or after JOBQ_MAX_WAIT_MIN (10)
//   of waiting anyway — never wait all day for the user to close apps. Render and voice never overlap (GPU).
// - Lower --prio number runs first (1 = deliverable the user is waiting on, 5 = default, 9 = background demo).
// - The job runs at below-normal CPU priority; child processes (Chrome, ffmpeg) inherit it.
// - Stale slots/tickets (dead PIDs) are cleaned automatically. Exit code = the job's exit code.
const fs = require("fs"), os = require("os"), path = require("path"), cp = require("child_process");
const DIR = path.join(os.tmpdir(), "hf-jobq");
fs.mkdirSync(DIR, { recursive: true });
const num = (v, d) => (v === undefined || v === "" || isNaN(+v) ? d : +v);
const SLOTS = Math.max(1, num(process.env.JOBQ_SLOTS, 1));
const MIN_FREE = num(process.env.JOBQ_MIN_FREE_GB, 3) * 1024 ** 3;
const alive = (pid) => { try { process.kill(pid, 0); return true; } catch (e) { return e.code === "EPERM"; } };
const read = (f) => { try { return JSON.parse(fs.readFileSync(path.join(DIR, f), "utf8")); } catch { return null; } };
const list = (pre) => fs.readdirSync(DIR).filter((f) => f.startsWith(pre)).map((f) => ({ f, j: read(f) })).filter((x) => {
  if (!x.j || !alive(x.j.pid)) { try { fs.unlinkSync(path.join(DIR, x.f)); } catch {} return false; } return true;
});
const args = process.argv.slice(2);
// hold: while hold.json exists, only jobs with prio <= its max may START (running jobs are untouched)
const HOLD = path.join(DIR, "hold.json");
if (args[0] === "hold") { fs.writeFileSync(HOLD, JSON.stringify({ max: +(args[1] || 2), t: Date.now(), why: args.slice(2).join(" ") })); console.log(`hold on: only prio <= ${+(args[1] || 2)} may start`); process.exit(0); }
if (args[0] === "release") { try { fs.unlinkSync(HOLD); } catch {} console.log("hold released"); process.exit(0); }
const holdMax = () => { try { return JSON.parse(fs.readFileSync(HOLD, "utf8")).max; } catch { return Infinity; } };
if (args[0] === "status") {
  if (holdMax() !== Infinity) console.log(`HOLD: only prio <= ${holdMax()} may start`);
  const run = ["slot-", "lslot-", "vslot-", "fslot-"].flatMap(list), wait = list("ticket-").sort((a, b) => a.j.prio - b.j.prio || a.j.t - b.j.t);
  console.log(`running ${run.length} (1 per lane: main/light/voice/ff) · free RAM ${(os.freemem() / 1024 ** 3).toFixed(1)} GB (need ${MIN_FREE / 1024 ** 3})`);
  run.forEach((x) => console.log(`RUN   p${x.j.prio} ${x.j.kind} pid ${x.j.pid} ${Math.round((Date.now() - x.j.t) / 1000)}s  ${x.j.cmd}`));
  wait.forEach((x) => console.log(`WAIT  p${x.j.prio} ${x.j.kind} pid ${x.j.pid} ${Math.round((Date.now() - x.j.t) / 1000)}s  ${x.j.cmd}`));
  process.exit(0);
}
const sep = args.indexOf("--");
if (sep < 0 || sep === args.length - 1) { console.error("usage: node runtime/jobq.js [--kind k] [--prio n] -- <command>"); process.exit(2); }
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 && i < sep ? args[i + 1] : d; };
// one arg after "--" = a ready shell string; several args = quote each one that needs it
const q = (a) => (/[\s"'&|<>^()]/.test(a) ? `"${a.replace(/"/g, '\\"')}"` : a);
const rest = args.slice(sep + 1);
const kind = opt("--kind", "render"), prio = +opt("--prio", 5), cmd = rest.length === 1 ? rest[0] : rest.map(q).join(" ");
// Nested call: if one of our ancestors already holds a slot (older jobq versions did not set JOBQ_INNER), run now —
// a ticket here would wait on our own parent's slot forever.
const ancestors = () => {
  try {
    if (process.platform !== "win32") {
      const out = []; let p = process.ppid;
      while (p > 1 && !out.includes(p) && out.length < 64) { out.push(p); p = +cp.execSync(`ps -o ppid= -p ${p}`).toString().trim() || 0; }
      return out;
    }
    const rows = cp.execSync('powershell -NoProfile -Command "Get-CimInstance Win32_Process | % { \\"$($_.ProcessId) $($_.ParentProcessId)\\" }"', { stdio: ["ignore", "pipe", "ignore"] }).toString().trim().split(/\r?\n/);
    const par = new Map(rows.map((r) => r.trim().split(/\s+/).map(Number)));
    const out = []; let p = process.ppid;
    while (p && !out.includes(p) && out.length < 64) { out.push(p); p = par.get(p); }
    return out;
  } catch { return []; }
};
{
  const held = new Set(fs.readdirSync(DIR).filter((f) => /^[lvf]?slot-/.test(f)).map((f) => (read(f) || {}).pid).filter(Boolean));
  if (held.size && ancestors().some((p) => held.has(p))) {
    const child = cp.spawn(cmd, { shell: true, stdio: "inherit", env: { ...process.env, JOBQ_INNER: "1" } });
    child.on("exit", (code) => process.exit(code == null ? 1 : code));
    return;
  }
}
// Lanes, one slot each, gated by free RAM: main (render/bake: Chrome, 3 GB), light (snap/QA: Chrome, 3 GB),
// voice (TTS: CPU, 2 GB), ff (ffmpeg/mix/finish/cuts: 1 GB). Low-RAM kinds run beside a render instead of behind it.
const LANES = { snap: ["light", "lslot-", "JOBQ_LIGHT_FREE_GB", 3], voice: ["voice", "vslot-", "JOBQ_VOICE_FREE_GB", 2], ff: ["ff", "fslot-", "JOBQ_FF_FREE_GB", 1] };
const [LANE, PRE, FLOOR_ENV, FLOOR_DEF] = LANES[kind] || ["main", "slot-", "JOBQ_MIN_FREE_GB", 3];
const me = { pid: process.pid, kind, prio, t: Date.now(), cmd: cmd.slice(0, 160), lane: LANE };
const ticket = path.join(DIR, `ticket-${process.pid}.json`);
fs.writeFileSync(ticket, JSON.stringify(me));
let slot = null;
const cleanup = () => { for (const f of [ticket, slot]) if (f) try { fs.unlinkSync(f); } catch {} };
process.on("exit", cleanup); ["SIGINT", "SIGTERM"].forEach((s) => process.on(s, () => process.exit(130)));
const floor = num(process.env[FLOOR_ENV], FLOOR_DEF) * 1024 ** 3; // snaps launch Chrome too; a 1 GB floor let them start beside a render and froze the PC
// No aging: every waiter (old or new code) must agree on one order — raw priority, then arrival time.
// Starvation is handled by the separate light lane instead.
const eff = (j) => j.prio;
// User is often away for hours: a RAM floor alone must never stall the queue all day (2026-10-29).
// After JOBQ_MAX_WAIT_MIN (default 10) a job starts below its floor, but a Chrome lane (main/light) still
// only starts when the other Chrome lane is idle — a render + snap together is what froze the PC.
const MAX_WAIT = num(process.env.JOBQ_MAX_WAIT_MIN, 10) * 60e3, t0 = Date.now();
const CHROME = { main: "lslot-", light: "slot-" };
// VibeVoice needs ~5.4 GB of the 6 GB GPU: a render and a voice take never run together (GPU deadlock 2026-10-24)
const GPU = { main: "vslot-", voice: "slot-" };
const ramOk = () => os.freemem() >= floor || (Date.now() - t0 >= MAX_WAIT && !(CHROME[LANE] && list(CHROME[LANE]).length));
const tryStart = () => {
  const run = list(PRE);
  // tickets from before lanes existed (no .lane) still compete for the main slot only
  const first = list("ticket-").filter((x) => (x.j.lane || "main") === LANE).sort((a, b) => eff(a.j) - eff(b.j) || a.j.t - b.j.t)[0];
  if (prio > holdMax()) return false;
  if (run.length >= SLOTS || !first || first.j.pid !== process.pid || (GPU[LANE] && list(GPU[LANE]).length) || !ramOk()) return false;
  slot = path.join(DIR, `${PRE}${process.pid}.json`);
  fs.writeFileSync(slot, JSON.stringify(me));
  if (list(PRE).length > SLOTS) { fs.unlinkSync(slot); slot = null; return false; } // lost a race
  try { fs.unlinkSync(ticket); } catch {}
  return true;
};
let waited = 0;
const tick = () => {
  if (!tryStart()) { if (waited++ % 30 === 0) console.error(`[jobq] waiting (p${prio} ${kind}) — run 'node runtime/jobq.js status'`); return setTimeout(tick, 2000); }
  console.error(`[jobq] start p${prio} ${kind}${os.freemem() < floor ? ` (below RAM floor after ${Math.round((Date.now() - t0) / 60e3)} min wait)` : ""}: ${cmd}`);
  // JOBQ_INNER: heavy.js tools inside this job run directly instead of re-queueing (a nested ticket waits on our own slot forever)
  const child = cp.spawn(cmd, { shell: true, stdio: "inherit", env: { ...process.env, JOBQ_INNER: "1" } });
  try { os.setPriority(child.pid, os.constants.priority.PRIORITY_BELOW_NORMAL); } catch {}
  child.on("exit", (code) => { cleanup(); process.exit(code == null ? 1 : code); });
};
tick();
