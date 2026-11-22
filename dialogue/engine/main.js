// Page driver: window.frame({t, layout, shot, ...}) composites scene views + MG/captions for one frame. ?w=&h=&set=<id>&pair=a,b
import { THREE, buildWorld, makeRenderer, makePost } from "/core/world.js";
import { initMGLayer } from "/mg-adapter.js";
const q = new URLSearchParams(location.search); const W = +q.get("w"), H = +q.get("h"); const AR = W / H; const portrait = AR < 1;
const stage = document.getElementById("stage"); stage.width = W; stage.height = H; const ctx = stage.getContext("2d");
const root = document.getElementById("root"); root.style.width = W + "px"; root.style.height = H + "px";
// ?ep=<id>: episode mode, everything from /episodes/<id>/shots.json (dialogue/compiler); otherwise the 8 s legacy test timeline
const EPID = q.get("ep"); const EP = EPID ? await (await fetch(`/episodes/${EPID}/shots.json`)).json() : null;
const set = (await import(`/sets/${q.get("set") || EP?.set || "campfire"}.js`)).default; const pair = q.get("pair") ? q.get("pair").split(",") : EP?.pair ?? set.pair;
const wj = EP ? { words: EP.words } : await (await fetch("/data/words.json")).json();
const mgl = await initMGLayer({ root, ratio: portrait ? "9x16" : "16x9", palette: { accent: set.accent ?? "#F2A03D" }, words: wj, ep: EPID, captions: EP?.captions }); const phrases = null;
const world = await buildWorld({ set, pair, speaker: q.get("speaker") === "B" ? () => "B" : () => "A" }); world.stress.length = 0; wj.words.filter(w => w.stress).forEach(w => world.stress.push((w.s + w.e) / 2));
console.log("set", set.id, "pair", pair.join(","), "seats", JSON.stringify(world.gate.seats), JSON.stringify(world.gate.notes));
world.setWords(wj.words); if (EP) world.setEpisode(EP);
const renderer = makeRenderer(W, H); const cam = new THREE.PerspectiveCamera(40, 1, 0.1, world.camFar);
const posts = {}; const postFor = (w, h) => posts[w + "x" + h] ??= makePost(renderer, world.scene, cam, w, h);
const ALLRIGS = ["wide2", "mcu_A", "mcu_B", "ots_A", "ots_B", "insert", "seat_A", "seat_B", ...(EP ? ["ms_A", "ms_B"] : [])];
await world.prepFG(q.get("rigs") ? q.get("rigs").split(",") : ALLRIGS, [AR]); if (!portrait && !q.get("rigs")) await world.prepFG(["mcu_A", "mcu_B"], [422 / 1080]);

// ext (layout 'float', 2026-11-11): the rig is framed for `rect` exactly as a sub-viewport would be, but the frustum is extended (setViewOffset)
// so the full W x H frame is rendered: same pixels inside rect, the scene continues above it (the iso card floats over sky/trees there).
function view(rigName, u, rect, { strip = false, seed = 0, dim = 0, move = null, ext = false } = {}) {
  const { x, y, w, h } = rect; const ar = w / h; const rc = world.rigCamera(rigName, ar, u, strip, move);
  world.setShot(rc); cam.fov = rc.fov; cam.aspect = ar; cam.clearViewOffset(); cam.updateProjectionMatrix(); cam.position.copy(rc.pos); cam.lookAt(rc.tgt); cam.updateMatrixWorld(true);
  const focal = h / (2 * Math.tan(rc.fov * Math.PI / 360));
  if (ext) { const yc = y + h / 2, Hv = 2 * Math.max(yc, H - yc), Wv = 2 * Math.max(x + w / 2, W - x - w / 2); cam.fov = 2 * Math.atan(Hv / 2 / focal) * 180 / Math.PI; cam.aspect = Wv / Hv; cam.setViewOffset(Wv, Hv, Wv / 2 - (x + w / 2), Hv / 2 - yc, W, H); cam.updateProjectionMatrix(); }
  const rw = ext ? W : w, rh = ext ? H : h;
  renderer.setSize(rw, rh); world.U.uPx.value = Math.sqrt(rw * rh) / 1300; world.U.uFocal.value = focal;
  world.showFG(rigName, strip ? 422 / 1080 : ar);
  const post = postFor(rw, rh); post.render({ dof: rc.dof ? { focus: rc.focus, ...rc.dof } : null, seed, bloom: rc.bloom });
  if (ext) { ctx.drawImage(renderer.domElement, 0, 0, W, H); cam.clearViewOffset(); cam.fov = rc.fov; cam.aspect = ar; cam.updateProjectionMatrix(); } else
  ctx.drawImage(renderer.domElement, x, y, w, h); if (dim) { ctx.fillStyle = `rgba(8,12,18,${dim})`; ctx.fillRect(x, y, w, h); }
}
const BG = set.bg ?? "#0E1621";
const TL = { // 8 s test timeline (as spike1): shots + layout switch + MG
  shots: portrait ? [{ t0: 0, t1: 2.4, rig: "wide2" }, { t0: 2.4, t1: 4.4, rig: "mcu_A" }, { t0: 4.4, t1: 8.01, rig: "ots_A" }] : [{ t0: 0, t1: 1.6, rig: "wide2" }, { t0: 1.6, t1: 2.9, rig: "mcu_A" }, { t0: 2.9, t1: 3.8, rig: "mcu_B" }, { t0: 3.8, t1: 4.4, rig: "mcu_A" }, { t0: 4.4, t1: 8.01, rig: "mcu_A" }],
  mgStart: 4.4,
};
// ---- episode frame: shot timeline -> rig + move; MG layout from mg.activeLayout(t) ('stack' while a card is up, else 'full') ----
const epShot = t => EP.shots.find(s => t >= s.t0 && t < s.t1) ?? EP.shots[EP.shots.length - 1];
function epLayout(t, spec) { if (spec.layout) return spec.layout; if (spec.mg === false || !mgl.hasCards) return "full"; const l = mgl.activeLayout(t); return l === "stack" || l === "float" ? l : "full"; }
// float: actors framed into the lower rect (y FLOAT_Y0..H), rendered full frame (view ext); the 'float' card (mg layoutRects) sits above it
const FLOAT_Y0 = 860; window.FLOAT_Y0 = FLOAT_Y0;
function epRect(layout) { return layout === "stack" ? { x: 0, y: Math.round(H * 0.5), w: W, h: H - Math.round(H * 0.5) } : layout === "float" ? { x: 0, y: FLOAT_Y0, w: W, h: H - FLOAT_Y0 } : { x: 0, y: 0, w: W, h: H }; }
function epRig(shot, layout) { return shot.rig; } // stack keeps the planned rig: it already shows the shot's subject (STYLE-GUIDE 9: the scene favours the speaker, MS/CU); ots/wide stay ots/wide
async function epFrame(spec) {
  const t = spec.t ?? 0; const fi = Math.round(t * 30);
  world.update(t); world.rim.target.updateMatrixWorld(); renderer.shadowMap.needsUpdate = true;
  const shot = spec.shot ? { ...epShot(t), ...spec.shot } : epShot(t); const u = spec.u ?? (t - shot.t0) / (shot.t1 - shot.t0); const layout = epLayout(t, spec);
  ctx.fillStyle = BG; ctx.fillRect(0, 0, W, H);
  const rig = spec.rig ?? epRig(shot, layout); view(rig, u, epRect(layout), { seed: fi, move: shot.move ?? { type: "hold" }, ext: layout === "float" });
  window.__last = { t, shot: shot.n, rig, layout, u };
  mgl.caption(null, spec.capT ?? t);
}
window.frame = async (spec) => {
  if (EP) return epFrame(spec);
  const t = spec.t ?? 0; const fi = Math.round(t * 30);
  world.update(t); world.rim.target.updateMatrixWorld(); renderer.shadowMap.needsUpdate = true;
  const shot = spec.shot ?? TL.shots.find(s => t >= s.t0 && t < s.t1) ?? TL.shots[TL.shots.length - 1]; const u = spec.u ?? (t - shot.t0) / (shot.t1 - shot.t0);
  const layout = spec.layout ?? (t >= TL.mgStart && spec.mg !== false ? (portrait ? "stack" : "split") : "full");
  ctx.fillStyle = BG; ctx.fillRect(0, 0, W, H);
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
  if (layout === "split") { ctx.fillStyle = BG; ctx.fillRect(Math.round(W * 0.22), 0, W - 2 * Math.round(W * 0.22), H); }
  if (mgRect && spec.mg !== false) mgl.update(spec.mgT ?? (t - TL.mgStart), mgRect); else mgl.hide();
  mgl.caption(phrases, spec.capT ?? t, capY, capSize);
};
window.gateRun = async (T, fps) => { // contact + penetration gate over every frame, no rendering
  const rows = []; for (let i = 0; i < T * fps; i++) { const t = i / fps; world.update(t); const a = world.gateFrame(world.actors.A), b = world.gateFrame(world.actors.B); rows.push([i, t, a.seatGap, a.footGap, b.seatGap, b.footGap, a.seatSamples, b.seatSamples, a.pen, b.pen, a.penN, b.penN]); } return rows;
};
window.world = world; window.THREE = THREE; window.EP = EP;
// episode gates (no rendering): seated + face state per sample, contact/penetration, caption vs face/safe areas
const gf = () => { const a = world.gateFrame(world.actors.A), b = world.gateFrame(world.actors.B); return { A: { seat: a.seatGap, foot: a.footGap, pen: a.pen, penN: a.penN }, B: { seat: b.seatGap, foot: b.footGap, pen: b.pen, penN: b.penN } }; };
// camera data for the variety gate / autoplan angle table: azimuth (deg, around the subject, 0 = +z), elevation (deg), visible half-height at the subject (m)
const camInfo = (rig, move, u) => { const rc = world.rigCamera(rig, AR, u, false, move); const pair = world.PAIR_RIGS.includes(rig); const sp = world.rigNames[rig][1];
  const f = pair ? world.anchors.A.head.clone().add(world.anchors.B.head).multiplyScalar(0.5) : world.anchors[sp].head.clone(); const dx = rc.pos.x - f.x, dz = rc.pos.z - f.z, hd = Math.hypot(dx, dz), dist = rc.pos.distanceTo(f);
  return { rig, pair, sub: pair ? "pair" : sp, az: +(Math.atan2(dx, dz) * 180 / Math.PI).toFixed(2), el: +(Math.atan2(rc.pos.y - f.y, hd) * 180 / Math.PI).toFixed(2), half: +(dist * Math.tan(rc.fov * Math.PI / 360)).toFixed(3), pos: rc.pos.toArray().map(v => +v.toFixed(3)), tgt: rc.tgt.toArray().map(v => +v.toFixed(3)), fov: +rc.fov.toFixed(2), mm: rc.mm }; };
window.rigTable = () => { const out = {}; for (const r of Object.keys(world.rigNames)) { if (/^(insert|seat|ots_A)/.test(r) || r === "insert_fire") continue; out[r] = { u0: camInfo(r, { type: "hold" }, 0), u5: camInfo(r, { type: "hold" }, 0.5), u1: camInfo(r, { type: "hold" }, 1) }; } return out; };
window.epGate = async (step = 0.25) => {
  const rows = []; const N = Math.round(EP.duration / step); for (let i = 0; i <= N; i++) { const t = Math.min(EP.duration, i * step); world.update(t); rows.push({ t, st: world.epState(t), ...gf() }); }
  const mids = EP.shots.map(s => { const t = (s.t0 + s.t1) / 2; world.update(t); return { n: s.n, t, ...gf(), st: world.epState(t) }; });
  const peaks = EP.gestures.map(g => { const t = g.t + Math.min(0.2, g.dur / 2); world.update(t); return { kind: g.kind, actor: g.actor, t, ...gf() }; });
  const cams = EP.shots.map(s => ({ n: s.n, ...Object.fromEntries([["u0", 0], ["u5", 0.5], ["u1", 1]].map(([k, u]) => { world.update(s.t0 + u * (s.t1 - s.t0) * 0.98); return [k, camInfo(s.rig, s.move ?? { type: "hold" }, u)]; })) }));
  return { rows, mids, peaks, cams };
};
window.lumaClip = (thr = 250) => { const d = ctx.getImageData(0, 0, W, H).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2] >= thr) n++; return n / (W * H); };
window.mgLint = () => mgl.lint ? mgl.lint() : [];
// head-clear check helpers (episodes/<ep>/headcheck.js via render.mjs epeval): layout + scene rect + MG card rect at t
window.epLayoutAt = t => epLayout(t, {}); window.epRectOf = l => epRect(l); window.mgCardRect = l => (mgl.mg.layoutRects(l) || {}).card || null; window.epShotAt = t => epShot(t);
window.epFaceAt = t => { world.update(t); return world.epState(t); };
window.capCheck = () => { // every caption at its middle: caption box (DOM) vs both faces projected through the shot camera, and the safe areas
  const out = []; const v = new THREE.Vector3();
  for (const c of EP.captions) {
    const t = (c.s + c.e) / 2; world.update(t); const shot = epShot(t); const layout = epLayout(t, {}); const rect = epRect(layout); const rig = epRig(shot, layout); const u = (t - shot.t0) / (shot.t1 - shot.t0);
    const rc = world.rigCamera(rig, rect.w / rect.h, u, false, shot.move); cam.fov = rc.fov; cam.aspect = rect.w / rect.h; cam.updateProjectionMatrix(); cam.position.copy(rc.pos); cam.lookAt(rc.tgt); cam.updateMatrixWorld(true);
    mgl.caption(null, t); const el = [...root.querySelectorAll("*")].find(e => e.children.length === 0 && e.textContent === c.text && getComputedStyle(e).opacity !== "0"); let box = null;
    if (el) { const rg = document.createRange(); rg.selectNodeContents(el); const r = rg.getBoundingClientRect(), hr = root.getBoundingClientRect(); box = { x0: r.left - hr.left, x1: r.right - hr.left, y0: r.top - hr.top, y1: r.bottom - hr.top }; }
    const faces = {}; for (const s of ["A", "B"]) { const a = world.actors[s]; const hp = a.head.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 0.085, 0)); let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9, behind = false;
      for (const d of [[0.1, 0.12, 0], [-0.1, 0.12, 0], [0.1, -0.12, 0], [-0.1, -0.12, 0], [0, 0.12, 0.1], [0, -0.12, -0.1], [0, 0.12, -0.1], [0, -0.12, 0.1]]) { v.copy(hp).add(new THREE.Vector3(d[0], d[1], d[2])); const c2 = v.clone().applyMatrix4(cam.matrixWorldInverse); if (c2.z > -0.05) behind = true; v.project(cam); const px = rect.x + (v.x + 1) / 2 * rect.w, py = rect.y + (1 - v.y) / 2 * rect.h; x0 = Math.min(x0, px); x1 = Math.max(x1, px); y0 = Math.min(y0, py); y1 = Math.max(y1, py); }
      const vis = !behind && x1 > rect.x && x0 < rect.x + rect.w && y1 > rect.y && y0 < rect.y + rect.h; faces[s] = vis ? { x0: Math.max(rect.x, x0), x1: Math.min(rect.x + rect.w, x1), y0: Math.max(rect.y, y0), y1: Math.min(rect.y + rect.h, y1) } : null; }
    out.push({ text: c.text, t, shot: shot.n, rig, layout, box, faces, W, H });
  }
  return out;
};
window.worldInfo = () => { const bb = world.seatObjs[world.actors.A.id]; const b = new THREE.Box3().setFromObject(bb); return { pair: world.pair, seats: world.gate.seats, notes: world.gate.notes, penAt: [world.actors.A.penAt, world.actors.B.penAt], seatBox: [b.min.toArray(), b.max.toArray()], head: [world.anchors.A.head.toArray(), world.anchors.B.head.toArray()] }; };

// ---- automatic framing / background checks (read by render.mjs) ----
window.framing = () => {
  cam.updateMatrixWorld(true); const res = {}; let ux0 = 9, ux1 = -9, uy0 = 9, uy1 = -9; const v = new THREE.Vector3();
  for (const s of ["A", "B"]) { const a = world.actors[s]; let x0 = 9, x1 = -9, y0 = 9, y1 = -9; const pts = []; a.ch.root.traverse(o => { if (o.isBone) pts.push(o.getWorldPosition(new THREE.Vector3())); }); pts.push(a.head.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 0.17, 0)));
    for (const p of pts) for (const d of [[0.1, 0], [-0.1, 0]]) { v.copy(p); v.x += d[0]; v.project(cam); const x = (v.x + 1) / 2, y = (1 - v.y) / 2; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    res[s] = { x0, x1, y0, y1 }; ux0 = Math.min(ux0, x0); ux1 = Math.max(ux1, x1); uy0 = Math.min(uy0, y0); uy1 = Math.max(uy1, y1); }
  res.union = { x0: ux0, x1: ux1, y0: uy0, y1: uy1, w: ux1 - ux0, cx: (ux0 + ux1) / 2 }; v.set(0, 330, -3900).project(cam); res.peakY = (1 - v.y) / 2;
  const rc = new THREE.Raycaster(); let n = 0, tree = 0, sky = 0; for (let i = 0; i < 11; i++) for (let j = 0; j < 11; j++) { const nx = -0.6 + 1.2 * i / 10, ny = -0.6 + 1.2 * j / 10; rc.setFromCamera(new THREE.Vector2(nx, ny), cam); const hit = rc.intersectObjects(world.scene.children, true).find(h => !h.object.isPoints && h.object.name !== "sky" && h.object.name !== "mist" && !(h.object.material && h.object.material.transparent)); n++; const src = hit?.object?.userData?.src ?? ""; if (/Tree/.test(src)) tree++; else if (!hit || hit.object.name === "farRange" || hit.distance > 60) sky++; }
  res.treeFrac = tree / n; res.farFrac = sky / n; return res; };

window.cityFrac = () => { const d = ctx.getImageData(0, 0, W, H).data; const B = 24, nx = Math.ceil(W / B), ny = Math.ceil(H / B); const cnt = new Uint16Array(nx * ny); let ytop = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = (y * W + x) * 4, r = d[i], g = d[i + 1], b = d[i + 2]; if (r > 190 && g > 140 && r > b + 40 && b < 200) cnt[Math.floor(y / B) * nx + Math.floor(x / B)]++; }
  let lit = 0; for (const c of cnt) if (c >= 2) lit++; return lit / (nx * ny); };
