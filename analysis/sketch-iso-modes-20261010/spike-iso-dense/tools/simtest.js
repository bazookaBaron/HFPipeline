// node tools/simtest.js city|lot : run the world generator + traffic sim in node, report collisions by edge kind/turn
const fs = require("fs"), path = require("path"), vm = require("vm");
const ctx = { console, performance: { now: () => Number(process.hrtime.bigint()) / 1e6 }, queueMicrotask, Math, Float32Array, Float64Array, Uint8Array, Int32Array };
ctx.window = ctx; ctx.globalThis = ctx; vm.createContext(ctx);
["vendor/hl-geom.js", "world-kit.js", "worlds.js"].forEach((f) => vm.runInContext(fs.readFileSync(path.join(__dirname, "..", f), "utf8").replace(/^var HLG/m, "window.HLG"), ctx));
const which = process.argv[2] || "city", t0 = Date.now();
const w = which === "city" ? ctx.WORLDS.city(20261010, { blocksX: 5, blocksY: 4, cars: 84, buses: 4, dur: 40, heroBlock: 9, park: 16 }) : ctx.WORLDS.parking(7, { dur: 40, cars: 58, buses: 1, heroAt: -7, leaveAt: 27.6 });
console.log(which, "gen+sim ms", Date.now() - t0, "statics", w.statics, "cars", w.sim.cars.length, "collision pair-frames", w.sim.collisions);
const E = w.net.edges, sim = w.sim;
// re-audit with edge info: find pairs overlapping, report kinds at a few times
const byKind = {};
for (let f = 0; f <= 1200; f += 3) {
  const t = f / 30, P = sim.cars.map((c) => sim.sample(c.id, t));
  for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) {
    const d = Math.hypot(P[i][0] - P[j][0], P[i][1] - P[j][1]); if (d > 7) continue;
    const k = `d<7`; byKind[k] = (byKind[k] || 0) + 1;
    if ((byKind[k]) <= 6) console.log("t", t.toFixed(2), "cars", i, j, "d", d.toFixed(1), P[i].map((v) => v.toFixed(1)).join(","), "|", P[j].map((v) => v.toFixed(1)).join(","));
  }
}
console.log(byKind);
if (w.lot) console.log("events", sim.events.filter((e) => e.t > -1).slice(0, 60).map((e) => `${e.t.toFixed(1)}:${e.type}#${e.id}${sim.cars[e.id].hero ? "H" : ""}`).join(" "));
if (w.lot) console.log("hero", w.lot.hero, "pick", w.lot.heroPick);
if (w.lot) console.log("occ", [0, 10, 20, 30, 39.9].map((t) => sim.occ(t)).join(","));
// stuck cars: never move in last 10 s
const stuck = sim.cars.filter((c) => { const a = sim.sample(c.id, 28), b = sim.sample(c.id, 39.9); return c.state !== "park" && Math.hypot(a[0] - b[0], a[1] - b[1]) < 1; }).map((c) => c.id);
console.log("stationary last 12s (non-parked):", stuck.length, stuck.slice(0, 20).join(","));
