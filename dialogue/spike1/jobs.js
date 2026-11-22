import { THREE, PAL, D, log, rng, toon, toonify, loadFBX, normProp, bbox, PROP_HEIGHTS, makeRenderer, makePost, campfireRig, groundDisc, loadCast, CAST_IDS,
  loadUAL, bakeClip, poseAt, meshBox, seatContactY, footMinY, BONE_MAP, POS_MAP, sanit, BLOOM_LAYER } from "/lib.js";

const png = c => c.toDataURL("image/png");
const FIRE_RE = /fire|flame/i;

// ---------- generic helpers ----------
function newScene(opts = {}) {
  const scene = new THREE.Scene(); const fireWorld = opts.firePos ?? new THREE.Vector3(1.5, 0.45, 1.8);
  const rig = campfireRig(scene, fireWorld, 0.3, opts); groundDisc(scene, opts.groundR ?? 40); return { scene, rig };
}
function orbitCam(cam, target, az, dist, h = 0.2) { cam.position.set(target.x + Math.sin(az) * dist, target.y + h, target.z + Math.cos(az) * dist); cam.lookAt(target); cam.updateProjectionMatrix(); }
function sheetCanvas(w, h) { const c = document.createElement("canvas"); c.width = w; c.height = h; const x = c.getContext("2d"); x.fillStyle = PAL.sky; x.fillRect(0, 0, w, h); return [c, x]; }
function label(ctx, text, x, y, size = 20, color = "#EFE6D4", align = "left") { ctx.font = `500 ${size}px "IBM Plex Sans Condensed", "Segoe UI", sans-serif`; ctx.fillStyle = "rgba(14,22,33,0.72)"; const w = ctx.measureText(text).width; const ax = align === "center" ? x - w / 2 : x; ctx.fillRect(ax - 6, y - size, w + 12, size + 8); ctx.fillStyle = color; ctx.textAlign = "left"; ctx.fillText(text, ax, y); }

let UAL; const clipCache = {};
async function sitClips(ch) {
  UAL ??= await loadUAL(); if (clipCache[ch.cfg.id]) return clipCache[ch.cfg.id];
  const get = n => UAL.animations.find(a => a.name === n);
  const o = {}; for (const n of ["Sitting_Idle_Loop", "Sitting_Talking_Loop"]) o[n] = bakeClip(UAL, get(n), ch);
  return clipCache[ch.cfg.id] = o;
}
const nativeClip = (ch, n) => ch.nativeClips.find(c => c.name === n);

// place a seated character on a seat prop; returns metrics
function seatChar(ch, clip, t, seat, pos, yaw) {
  ch.root.position.set(0, 0, 0); ch.root.rotation.set(0, 0, 0); poseAt(ch, clip, t);
  ch.root.position.y = -footMinY(ch); ch.root.updateMatrixWorld(true);
  const c = seatContactY(ch); const m = { feetMinY: 0, seatContactY: c.minY, hipsY: c.hips.y, hipsZ: c.hips.z };
  ch.root.rotation.y = yaw; ch.root.position.x = pos.x; ch.root.position.z = pos.z; ch.root.updateMatrixWorld(true);
  const hw = ch.bones[sanit("Hips")].getWorldPosition(new THREE.Vector3());
  // seat: uniform scale so top == contact height, centred under the hips
  const sz = seat.userData.size, base = seat.userData.base; const isLog = seat.userData.kind === "log";
  const topNow = isLog ? sz.y : sz.y; const k = Math.max(0.25, c.minY) / topNow; seat.scale.setScalar(k * base * (isLog ? 1 : 1.25)); // stump bbox includes a tall bark spike; flat moss top is ~0.8 of it
  seat.position.set(hw.x + Math.sin(yaw) * (isLog ? 0.14 : 0.24), 0, hw.z + Math.cos(yaw) * (isLog ? 0.14 : 0.24)); seat.rotation.y = isLog ? yaw + Math.PI / 2 : 0; m.seatScaleVsNative = k;
  return m;
}
async function loadSeat(kind) {
  const name = kind === "log" ? "WoodLog" : "TreeStump_Moss"; const o = toonify(await loadFBX(D.nature + name + ".fbx"));
  const g = normProp(o, { height: kind === "log" ? 0.45 : 0.5 }); g.userData.kind = kind; g.userData.base = 1;
  if (kind === "log") { // lay it along X..: measure which axis is long
    const s = g.userData.size; g.userData.longAxis = s.x > s.z ? "x" : "z"; if (g.userData.longAxis === "x") { g.rotation.y = 0; }
  }
  const w = new THREE.Group(); w.add(g); w.userData = { ...g.userData }; return w;
}

// ---------- probe ----------
async function probe() {
  const out = {};
  log("== props native sizes (raw FBX units) ==");
  for (const [pack, names] of [["nature", ["PineTree_1", "CommonTree_1", "Rock_1", "Rock_Moss_1", "TreeStump_Moss", "WoodLog", "Bush_1", "Grass", "Flowers"]], ["survival", ["Bonfire", "Bonfire_Fire", "Tent", "Pot", "WoodenTorch_Fire"]], ["build", ["4Story_Mat"]]]) {
    for (const n of names) {
      const o = await loadFBX(D[pack] + n + ".fbx"); const b = bbox(o), s = b.getSize(new THREE.Vector3()); const mats = new Set(); let tex = 0;
      o.traverse(m => { if (m.isMesh) (Array.isArray(m.material) ? m.material : [m.material]).forEach(mm => { mats.add(mm.name + ":" + (mm.color ? mm.color.getHexString() : "-")); if (mm.map) tex++; }); });
      log(`${n} size ${s.x.toFixed(2)} x ${s.y.toFixed(2)} x ${s.z.toFixed(2)}  scaleProp ${o.scale.x}  tex ${tex}  mats ${[...mats].join(" ")}`);
    }
  }
  log("== cast ==");
  UAL = await loadUAL();
  log("UAL armature", UAL.scene.children.map(c => c.name + " rot " + c.rotation.toArray().slice(0, 3).map(x => x.toFixed(2)) + " scl " + c.scale.toArray().map(x => x.toFixed(2))));
  for (const id of CAST_IDS) {
    const ch = await loadCast(id); const sz = bbox(ch.root).getSize(new THREE.Vector3());
    log(id, JSON.stringify(ch.rep), "height", sz.y.toFixed(2), "face eyes/brows", ch.face.eyes, ch.face.brows);
    const clips = await sitClips(ch); for (const c of Object.values(clips)) log("  bake", JSON.stringify(c.userData));
    const boneNames = Object.keys(ch.bones); log("  bones", boneNames.length, boneNames.slice(0, 8).join(","));
  }
  return out;
}

// ---------- cast sheet ----------
async function cast_sheet() {
  const TW = 400, TH = 520, cols = 4, hdr = 34;
  const [sheet, sx] = sheetCanvas(TW * cols, (TH + hdr) * 4); const R = makeRenderer(TW, TH); const cam = new THREE.PerspectiveCamera(28, TW / TH, 0.1, 80);
  const { scene, rig } = newScene({ groundR: 40 }); const post = makePost(R, scene, cam, TW, TH, 0.6);
  for (let r = 0; r < 4; r++) {
    const id = CAST_IDS[r]; const ch = await loadCast(id); scene.add(ch.root);
    const idle = nativeClip(ch, "Idle_Neutral") ?? ch.nativeClips[0]; poseAt(ch, idle, 0.4);
    ch.root.position.y = -footMinY(ch); ch.root.updateMatrixWorld(true);
    const hb = bbox(ch.root); const hh = hb.max.y;
    const views = [["front", 0, 1.0, 4.7], ["3/4", 0.75, 1.0, 4.7], ["side", Math.PI / 2, 1.0, 4.7], ["head 3/4", 0.6, hh - 0.16, 1.15]];
    for (let c = 0; c < cols; c++) {
      const [nm, az, ty, d] = views[c]; orbitCam(cam, new THREE.Vector3(0, ty * (c === 3 ? 1 : 0.95), 0), az, d, c === 3 ? 0.02 : 0.25);
      if (c === 3) cam.position.y = ty + 0.02; post.render();
      const x = c * TW, y = r * (TH + hdr) + hdr; sx.drawImage(R.domElement, x, y);
      label(sx, `${id} · ${nm}`, x + 12, y + 26 - 0, 20);
    }
    scene.remove(ch.root);
    log(id, "height", (hb.max.y - hb.min.y).toFixed(2));
  }
  sx.fillStyle = PAL.sky; return { cast_sheet: png(sheet) };
}

// ---------- sit strip ----------
async function sit_strip() {
  const TW = 320, TH = 400, N = 6, [sheet, sx] = sheetCanvas(TW * N, TH * 4); const R = makeRenderer(TW, TH); const cam = new THREE.PerspectiveCamera(30, TW / TH, 0.1, 80);
  const { scene } = newScene({ groundR: 12, firePos: new THREE.Vector3(1.8, 0.45, 1.4) }); const post = makePost(R, scene, cam, TW, TH, 0.6);
  for (let r = 0; r < 4; r++) {
    const id = CAST_IDS[r]; const ch = await loadCast(id); scene.add(ch.root); const clips = await sitClips(ch); const clip = clips.Sitting_Talking_Loop;
    const seat = await loadSeat(r % 2 === 0 ? "stump" : "log"); scene.add(seat);
    const m0 = seatChar(ch, clip, 0, seat, new THREE.Vector3(0, 0, 0), 0);
    log(id, "seat", seat.userData.kind, JSON.stringify(m0));
    for (let i = 0; i < N; i++) {
      const t = (i / N) * clip.duration; const m = seatChar(ch, clip, t, seat, new THREE.Vector3(0, 0, 0), 0);
      // keep the seat fixed to frame 0 geometry (only the pose moves)
      orbitCam(cam, new THREE.Vector3(0, 0.8, 0), r % 2 ? 1.2 : Math.PI / 2, 4.6, 0.3); post.render();
      sx.drawImage(R.domElement, i * TW, r * TH); label(sx, `${id} · ${seat.userData.kind} · t=${t.toFixed(2)}s`, i * TW + 8, r * TH + 24, 16);
      if (i === 0 || i === 3) log(id, `t=${t.toFixed(2)}`, "contactY", m.seatContactY.toFixed(3), "hipsY", m.hipsY.toFixed(3));
    }
    scene.remove(ch.root); scene.remove(seat);
  }
  return { sit_strip: png(sheet) };
}

// ---------- props ----------
async function loadProp(spec) {
  const { name, pack, file, h, s } = spec; const o = toonify(await loadFBX(D[pack] + (file ?? name) + ".fbx")); return normProp(o, { height: h, scale: s });
}
async function props_sheet() {
  const TW = 384, TH = 384, cols = 5, rows = 3; const [sheet, sx] = sheetCanvas(TW * cols, TH * rows); const R = makeRenderer(TW, TH); const cam = new THREE.PerspectiveCamera(32, 1, 0.05, 200);
  const list = [["Bonfire+Bonfire_Fire", "survival", "Bonfire", 0.5], ["Tent", "survival", "Tent", 1.7], ["Pot", "survival", "Pot", 0.3], ["WoodenTorch_Fire", "survival", "WoodenTorch_Fire", 1.6], ["PineTree_1", "nature", "PineTree_1", 9],
    ["CommonTree_1", "nature", "CommonTree_1", 7.5], ["Rock_1", "nature", "Rock_1", 0.8], ["Rock_Moss_1", "nature", "Rock_Moss_1", 0.8], ["TreeStump_Moss", "nature", "TreeStump_Moss", 0.5], ["WoodLog", "nature", "WoodLog", 0.45],
    ["Bush_1", "nature", "Bush_1", 1.0], ["Grass", "nature", "Grass", 0.5], ["4Story_Mat", "build", "4Story_Mat", 12], ["Flowers", "nature", "Flowers", 0.4], ["Grass_2", "nature", "Grass_2", 0.5]];
  for (let i = 0; i < list.length; i++) {
    const [label_, pack, file, h] = list[i]; const { scene } = newScene({ groundR: 30 }); const post = makePost(R, scene, cam, TW, TH, 0.9);
    const g = new THREE.Group(); scene.add(g);
    const p = await loadProp({ pack, file, h: file === "Bonfire" ? undefined : h, s: file === "Bonfire" ? 0.0045 : undefined }); g.add(p);
    if (file === "Bonfire") { p.position.x = -0.65; const f = await loadProp({ pack, file: "Bonfire_Fire", s: 0.0045 }); f.position.x = 0.65; g.add(f); }
    const b = bbox(g), c = b.getCenter(new THREE.Vector3()), s = b.getSize(new THREE.Vector3()); const rad = Math.max(s.x, s.y, s.z) * 0.62 + 0.05; const dist = rad / Math.tan(THREE.MathUtils.degToRad(16));
    const fire = scene.getObjectByName("fireKey"); fire.position.set(c.x + rad * 1.1, Math.max(0.3, b.min.y + rad * 0.45), c.z + rad * 1.3); fire.intensity = 1; fire.userData.k = 1;
    // scale key intensity with distance so the prop reads the same as the cast
    const rig = scene.children.find(o => o.name === "fireKey"); rig.intensity = 17 * Math.pow(Math.max(rad, 0.6) * 1.9 / 2.3, 1.6);
    scene.getObjectByName("moonRim").position.set(c.x - 3, c.y + 6, c.z - 7);
    cam.position.set(c.x + Math.sin(0.7) * dist, c.y + rad * 0.25, c.z + Math.cos(0.7) * dist); cam.lookAt(c); cam.far = 400; cam.updateProjectionMatrix();
    scene.fog.near = dist * 2.2; scene.fog.far = dist * 6;
    post.render(); const x = (i % cols) * TW, y = Math.floor(i / cols) * TH; sx.drawImage(R.domElement, x, y);
    label(sx, `${label_}  (${s.x.toFixed(1)}x${s.y.toFixed(1)}x${s.z.toFixed(1)} m)`, x + 8, y + 24, 16);
  }
  return { props_sheet: png(sheet) };
}

// ---------- face test ----------
async function face_test() {
  const TW = 640, TH = 720; const [sheet, sx] = sheetCanvas(TW * 3, TH); const R = makeRenderer(TW, TH); const cam = new THREE.PerspectiveCamera(22, TW / TH, 0.05, 50);
  const { scene } = newScene({ groundR: 6, firePos: new THREE.Vector3(1.0, 1.4, 1.6) }); const post = makePost(R, scene, cam, TW, TH, 0.5);
  const ch = await loadCast("dadu"); scene.add(ch.root); poseAt(ch, nativeClip(ch, "Idle_Neutral"), 0.4);
  scene.getObjectByName("fireKey").intensity = 8; const hp = ch.bones[sanit("Head")].getWorldPosition(new THREE.Vector3());
  const states = [["neutral", { blink: 0, brow: 0 }], ["blink (eyes Y scale 10%)", { blink: 1, brow: 0 }], ["brow raise (+16 mm)", { blink: 0, brow: 1 }]];
  states.forEach(([nm, st], i) => { ch.face.set(st); orbitCam(cam, new THREE.Vector3(0, hp.y + 0.06, 0), 0.35, 1.5, 0); scene.getObjectByName("fireKey").intensity = 8; post.render(); sx.drawImage(R.domElement, i * TW, 0); label(sx, `dadu · ${nm}`, i * TW + 12, 30, 22); });
  return { face_test: png(sheet) };
}

// ---------- campfire rough ----------
async function buildCampfire() {
  const scene = new THREE.Scene(); const rig = campfireRig(scene, new THREE.Vector3(0, 0.6, 0), 0.4, { keyIntensity: 20, fogNear: 9, fogFar: 40, moonDir: new THREE.Vector3(-4, 7, -9) }); groundDisc(scene, 60);
  const rnd = rng(1109);
  // fire: bonfire + flame (flame on bloom layer), pit ring of rocks
  const fl = normProp(toonify(await loadFBX(D.survival + "Bonfire_Fire.fbx")), { scale: 0.0042 }); scene.add(fl);  // logs + flames (flames glow, bloom layer)
  const rocks = []; for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2 + rnd() * 0.2; const r = normProp(toonify(await loadFBX(D.nature + `Rock_${1 + (i % 7)}.fbx`)), { height: 0.28 + rnd() * 0.12 }); r.position.set(Math.cos(a) * 0.8, 0, Math.sin(a) * 0.8); r.rotation.y = rnd() * 6.28; scene.add(r); }
  // trees: 3 rings behind
  const treeSpecs = [[14, 9, 13], [20, 14, 20], [26, 22, 32]];
  for (const [n, r0, r1] of treeSpecs) for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rnd() * 0.25, r = r0 + rnd() * (r1 - r0); const x = Math.cos(a) * r, z = Math.sin(a) * r; if (z > 2) continue;
    const pine = rnd() < 0.6; const nm = pine ? `PineTree_${1 + Math.floor(rnd() * 5)}` : `CommonTree_${1 + Math.floor(rnd() * 5)}`;
    const t = normProp(toonify(await loadFBX(D.nature + nm + ".fbx")), { height: (pine ? 8.5 : 7) * (0.85 + rnd() * 0.35) }); t.position.set(x, 0, z); t.rotation.y = rnd() * 6.28; scene.add(t);
  }
  for (let i = 0; i < 12; i++) { const a = rnd() * Math.PI * 2, r = 3 + rnd() * 5; const nm = ["Bush_1", "Bush_2", "Grass", "Grass_2", "Flowers"][i % 5]; const o = normProp(toonify(await loadFBX(D.nature + nm + ".fbx")), { height: nm.startsWith("Bush") ? 0.9 : 0.45 }); o.position.set(Math.cos(a) * r, 0, Math.sin(a) * r - 1); if (o.position.z > -1.8 && Math.abs(o.position.x) < 3.4) o.position.z = -2.2 - rnd() * 3; if (o.position.z > 2) o.position.z = -2.5 - rnd() * 3; o.rotation.y = rnd() * 6.28; scene.add(o); }
  const tent = normProp(toonify(await loadFBX(D.survival + "Tent.fbx")), { height: 1.7 }); tent.position.set(-5.5, 0, -5.5); tent.rotation.y = 0.6; scene.add(tent);
  // characters
  const dadu = await loadCast("dadu"), rohan = await loadCast("rohan"); scene.add(dadu.root, rohan.root);
  const sd = await loadSeat("stump"), sl = await loadSeat("log"); scene.add(sd, sl);
  const cd = (await sitClips(dadu)).Sitting_Talking_Loop, cr = (await sitClips(rohan)).Sitting_Idle_Loop;
  const X = 1.75;
  const md = seatChar(dadu, cd, 0.3, sd, new THREE.Vector3(-X, 0, 0.0), Math.PI / 2 - 0.3);
  const mr = seatChar(rohan, cr, 0.3, sl, new THREE.Vector3(X, 0, 0.0), -Math.PI / 2 + 0.3);
  log("campfire seat metrics dadu", JSON.stringify(md), "rohan", JSON.stringify(mr));
  return { scene, rig, dadu, rohan, cd, cr, fl, sd, sl };
}
async function campfire_rough() {
  const S = await buildCampfire(); const outs = {};
  for (const [name, W, H, cp, tg, fov] of [["campfire_rough", 1920, 1080, [0.2, 1.45, 6.6], [0, 1.0, 0], 38], ["campfire_rough_9x16", 1080, 1920, [0.0, 2.0, 12.5], [0, 0.9, 0], 38]]) {
    const R = makeRenderer(W, H); const cam = new THREE.PerspectiveCamera(fov, W / H, 0.1, 150); cam.position.set(...cp); cam.lookAt(...tg); const post = makePost(R, S.scene, cam, W, H, 1.0);
    S.rig.update(0.4); poseAt(S.dadu, S.cd, 0.3); poseAt(S.rohan, S.cr, 0.3);
    post.render(); outs[name] = png(R.domElement); R.domElement.remove(); R.dispose();
  }
  return outs;
}

async function dbg() {
  UAL = await loadUAL(); const U = UAL.scene; U.updateMatrixWorld(true); const P = n => U.getObjectByName(n).getWorldPosition(new THREE.Vector3()).toArray().map(x => +x.toFixed(3));
  log("UAL", ["pelvis", "thigh_l", "thigh_r", "foot_l", "ball_l", "upperarm_l", "upperarm_r", "Head"].map(n => n + JSON.stringify(P(n))).join(" "));
  const ch = await loadCast("rohan"); ch.skel.pose(); ch.root.updateMatrixWorld(true); UAL.scene.traverse(m => { if (m.isSkinnedMesh) m.skeleton.pose(); }); U.updateMatrixWorld(true); const Q = n => ch.bones[sanit(n)].getWorldPosition(new THREE.Vector3()).toArray().map(x => +x.toFixed(3));
  log("MOD", ["Hips", "UpperLeg.L", "UpperLeg.R", "Foot.L", "PT.L", "UpperArm.L", "UpperArm.R", "Head"].map(n => n + JSON.stringify(Q(n))).join(" "));
  const clips = await sitClips(ch); poseAt(ch, clips.Sitting_Idle_Loop, 0.3);
  const names = []; ch.root.traverse(o => { if (o.isSkinnedMesh) names.push(o.name + "<" + o.parent.name + ">"); }); log(names.join(" "));
  const f = x => x.toArray().map(v => +v.toFixed(2)); const S = new THREE.AnimationMixer(UAL.scene); S.clipAction(UAL.animations.find(a => a.name === "Sitting_Idle_Loop")).play(); S.setTime(0.3); UAL.scene.updateMatrixWorld(true);
  const sp = n => f(UAL.scene.getObjectByName(n).getWorldPosition(new THREE.Vector3()));
  log("SRC", ["pelvis", "thigh_l", "calf_l", "foot_l", "ball_l", "spine_03", "Head"].map(n => n + JSON.stringify(sp(n))).join(" "));
  log("TGT", ["Hips", "UpperLeg.L", "LowerLeg.L", "Foot.L", "Chest", "Head"].map(n => n + JSON.stringify(f(ch.bones[sanit(n)].getWorldPosition(new THREE.Vector3())))).join(" "));
  log("yaw", clips.Sitting_Idle_Loop.userData.yawCorrDeg);
  return {};
}
async function bonemap() {
  UAL = await loadUAL(); const ch = await loadCast("rohan"); const c = bakeClip(UAL, UAL.animations.find(a => a.name === "Sitting_Idle_Loop"), ch);
  const o = { note: "UAL1 (UE mannequin) -> Quaternius Modular rig. [ual, modular, ualTip, modularTip]: rotation = swing of bone->tip direction + residual twist (world-space, bind-pose based). Position-followed bones (they sit under Root, not Hips): pelvis->Hips, thigh_*->UpperLeg.*, foot_*->Foot.*, scaled by hip height ratio. PT.* (knee pole targets) untouched.",
    boneMap: BONE_MAP, positionMap: POS_MAP, hipScale: c.userData.hipScale, yawCorrDeg: c.userData.yawCorrDeg };
  return { bonemap_ual_to_modular: "data:application/json," + encodeURIComponent(JSON.stringify(o, null, 1)) };
}
export async function run(job) {
  const J = { bonemap, dbg, probe, cast_sheet, sit_strip, props_sheet, face_test, campfire_rough }; if (!J[job]) throw new Error("unknown job " + job);
  return await J[job]();
}
