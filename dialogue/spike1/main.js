// Page driver: window.frame({t, layout, shot, ...}) composites scene views + HTML MG/captions for one frame.
import { THREE, buildWorld, makeRenderer, makePost } from "/world.js";
import { initMG, phrasesFrom, setCaption } from "/mg.js";
const q = new URLSearchParams(location.search); const W = +q.get("w"), H = +q.get("h"); const AR = W / H; const portrait = AR < 1;
const stage = document.getElementById("stage"); stage.width = W; stage.height = H; const ctx = stage.getContext("2d");
const root = document.getElementById("root"); root.style.width = W + "px"; root.style.height = H + "px";
const wj = await (await fetch("/data/words.json")).json(); const geo = await (await fetch("/data/countries_sasia.geojson")).json(); const wb = await (await fetch("/data/west_bengal.geojson")).json();
const phrases = phrasesFrom(wj);
const world = await buildWorld(); world.stress.length = 0; wj.words.filter(w => w.stress).forEach(w => world.stress.push((w.s + w.e) / 2)); console.log("stress", world.stress.join(","), "trees", JSON.stringify(world.tcount), "gate-seats", JSON.stringify(world.gate.seats));
world.setWords(wj.words);
const mg = await initMG(root, geo, wb);
const renderer = makeRenderer(W, H); const cam = new THREE.PerspectiveCamera(40, 1, 0.1, 400);
const posts = {}; const postFor = (w, h) => posts[w + "x" + h] ??= makePost(renderer, world.scene, cam, w, h);
await world.prepFG(["wide2", "mcu_A", "mcu_B", "ots_A", "ots_B", "insert_fire", "seat_A", "seat_B"], [AR]); if (!portrait) await world.prepFG(["mcu_A", "mcu_B"], [422 / 1080]);

function view(rigName, u, rect, { strip = false, seed = 0, dim = 0 } = {}) {
  const { x, y, w, h } = rect; const ar = w / h; const rc = world.rigCamera(rigName, ar, u, strip);
  world.setShot(rc); cam.fov = rc.fov; cam.aspect = ar; cam.updateProjectionMatrix(); cam.position.copy(rc.pos); cam.lookAt(rc.tgt); cam.updateMatrixWorld(true);
  renderer.setSize(w, h); world.U.uPx.value = Math.sqrt(w * h) / 1300; world.U.uFocal.value = h / (2 * Math.tan(cam.fov * Math.PI / 360));
  world.showFG(rigName, strip ? 422 / 1080 : ar);
  const post = postFor(w, h); post.render({ dof: rc.dof ? { focus: rc.focus, ...rc.dof } : null, seed });
  ctx.drawImage(renderer.domElement, x, y, w, h); if (dim) { ctx.fillStyle = `rgba(8,12,18,${dim})`; ctx.fillRect(x, y, w, h); }
}
const ease = x => 0.5 - 0.5 * Math.cos(Math.PI * Math.min(1, Math.max(0, x)));
// timeline for the 8 s test (and for stills): shots + layout switch + MG
const TL = {
  shots: portrait ? [{ t0: 0, t1: 2.4, rig: "wide2" }, { t0: 2.4, t1: 4.4, rig: "mcu_A" }, { t0: 4.4, t1: 8.01, rig: "ots_A" }] : [{ t0: 0, t1: 1.6, rig: "wide2" }, { t0: 1.6, t1: 2.9, rig: "mcu_A" }, { t0: 2.9, t1: 3.8, rig: "mcu_B" }, { t0: 3.8, t1: 4.4, rig: "mcu_A" }, { t0: 4.4, t1: 8.01, rig: "mcu_A" }],
  mgStart: 4.4,
};
window.frame = async (spec) => {
  const t = spec.t ?? 0; const fi = Math.round(t * 30);
  world.update(t); world.rim.target.updateMatrixWorld(); renderer.shadowMap.needsUpdate = true;
  const shot = spec.shot ?? TL.shots.find(s => t >= s.t0 && t < s.t1) ?? TL.shots[TL.shots.length - 1]; const u = spec.u ?? (t - shot.t0) / (shot.t1 - shot.t0);
  const layout = spec.layout ?? (t >= TL.mgStart && spec.mg !== false ? (portrait ? "stack" : "split") : "full");
  ctx.fillStyle = "#0E1621"; ctx.fillRect(0, 0, W, H);
  let capY, capSize, mgRect = null;
  if (portrait) {
    if (layout === "stack") { view(spec.rig ?? "ots_A", u, { x: 0, y: Math.round(H * 0.5), w: W, h: H - Math.round(H * 0.5) }, { seed: fi }); mgRect = { x: 54, y: Math.round(H * 0.06), w: W - 108, h: Math.round(H * 0.38) }; capY = H * 0.47; capSize = 60; }
    else { view(spec.rig ?? shot.rig, u, { x: 0, y: 0, w: W, h: H }, { seed: fi }); capY = H * 0.205; capSize = 64; }
  } else {
    if (layout === "split") {
      const sw = Math.round(W * 0.22); view("mcu_A", u, { x: 0, y: 0, w: sw, h: H }, { strip: true, seed: fi, dim: 0 }); view("mcu_B", u, { x: W - sw, y: 0, w: sw, h: H }, { strip: true, seed: fi + 1, dim: 0.15 });
      mgRect = { x: sw + 24, y: Math.round(H * 0.075), w: W - 2 * sw - 48, h: Math.round(H * 0.62) }; capY = H * 0.815; capSize = 58;
    } else { view(spec.rig ?? shot.rig, u, { x: 0, y: 0, w: W, h: H }, { seed: fi }); capY = H * 0.84; capSize = 60; }
  }
  if (layout === "split") { ctx.fillStyle = "#0E1621"; ctx.fillRect(Math.round(W * 0.22), 0, W - 2 * Math.round(W * 0.22), H); }
  if (mgRect && spec.mg !== false) mg.update(spec.mgT ?? (t - TL.mgStart), mgRect); else mg.hide();
  setCaption(mg.cap, phrases, spec.capT ?? t, capY, capSize);
  const gm = spec.gate ? { dadu: world.gateFrame(world.dadu), rohan: world.gateFrame(world.rohan) } : null;
  return gm;
};
window.gateRun = async (T, fps) => { // contact gate over every frame, no rendering
  const rows = []; for (let i = 0; i < T * fps; i++) { const t = i / fps; world.update(t); const d = world.gateFrame(world.dadu), r = world.gateFrame(world.rohan); rows.push([i, t, d.seatGap, d.footGap, r.seatGap, r.footGap, d.seatSamples, r.seatSamples, d.pen, r.pen, d.penN, r.penN]); } return rows; };
window.worldInfo = () => ({ bb: [world.seatObjs.dadu, world.seatObjs.rohan].map(o => { const b = new world.THREE.Box3().setFromObject(o); return [b.min.toArray(), b.max.toArray()]; }), penAt: [world.dadu.penAt, world.rohan.penAt], dY: world.dadu.ch.root.position.toArray(), rY: world.rohan.ch.root.position.toArray(), seatPos: [world.seatObjs.dadu.position.toArray(), world.seatObjs.dadu.scale.toArray(), world.seatObjs.rohan.position.toArray(), world.seatObjs.rohan.scale.toArray()], trees: world.tcount, seats: world.gate.seats });
