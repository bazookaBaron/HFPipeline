// DIALOGUE engine core (refactored from spike1/world.js): set-driven world, seated cast with contact + penetration gates, acting, camera rigs, post.
// Nothing is modelled: assets are loaded, instanced, recoloured, hidden, placed. Effects are allowed. Deterministic: seeded RNG, every frame is a pure function of t.
import { THREE, PAL, D, rng, toon, loadFBX, bbox, loadCast, loadUAL, bakeClip, poseAt, sanit, BLOOM_LAYER, log } from "./lib.js";
import { makeFaceLayer, emotionState, buildLipsync, emoAt, presetAt, emoDist, emoPreset, EMO } from "./facelayer.js";
import { FACE_CFG } from "./facecfg.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { BokehPass } from "three/addons/postprocessing/BokehPass.js";
export { THREE, PAL, rng, BLOOM_LAYER, D, loadFBX, bbox, toon };
export const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
export const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
export const lerp = (a, b, t) => a + (b - a) * t;
export const sineIO = t => 0.5 - 0.5 * Math.cos(Math.PI * Math.min(1, Math.max(0, t)));
export const bump = (x, w) => (x <= 0 || x >= w) ? 0 : Math.pow(Math.sin(Math.PI * x / w), 2);

// ---------------- palette re-tint (phase-0 fix: muddy near-black greens, overlit rocks) ----------------
export const TINT0 = {
  Green: "#2C5149", DarkGreen: "#1F3C3E", Wood: "#4A3A33", LightWood: "#8C6B4C", DarkWood: "#3B2D25", Rock: "#47525D",
  Berry: "#9A3C30", Cyan: "#78B0BE", Yellow: "#E6B65C", Mushroom_Top: "#8C5A44", Mushroom_Bottom: "#B7A38A",
  Black: "#343B43", Grey: "#6C747C", LightGrey: "#7C848C", Yellow2: "#E6B65C", LightGreen: "#C9A26C", Fire: "#F2A03D",
};
export const TENT0 = { Green: "#A9824F", LightGreen: "#D2AA74", DarkWood: "#3B2D25", Black: "#2E343B" };
const tmpHSL = { h: 0, s: 0, l: 0 };
function tintFor(m, kind) {
  const n = m.name; const base = (kind === "tent" && TENT[n]) || TINT[n];
  const c = new THREE.Color(base ?? ("#" + m.color.getHexString()));
  if (!base) { c.getHSL(tmpHSL, THREE.SRGBColorSpace); c.setHSL(tmpHSL.h, tmpHSL.s * 0.35, Math.max(0.16, Math.min(0.5, tmpHSL.l)), THREE.SRGBColorSpace); }
  // keep the dark pine / lighter common-tree variation from the original lightness
  return c;
}
const FIRE_RE = /^(fire|flame)/i;
// raycast hits that count as solid wood (mushroom decoration is ignored for seat tops / penetration)
const solid = hs => hs.filter(h => { const m = h.object.material; const mm = Array.isArray(m) ? m[h.face?.materialIndex ?? 0] : m; return !/mushroom/i.test(mm?.name ?? ""); });
// convert an FBX object's materials to toon (palette tinted); fire materials become bright basic on the bloom layer
function toonifyP(obj, kind) {
  obj.traverse(o => {
    if (!o.isMesh) return; const ms = Array.isArray(o.material) ? o.material : [o.material]; let glow = false;
    const out = ms.map(m => {
      if (FIRE_RE.test(m.name)) { glow = true; const b = new THREE.MeshBasicMaterial({ color: new THREE.Color(PAL.fire).multiplyScalar(1.25) }); b.name = m.name; return b; }
      const t = toon(tintFor(m, kind)); t.name = m.name; if (kind === "tent" && /LightGreen|Green/.test(m.name)) t.emissive = new THREE.Color("#5E3A18"); return t;
    });
    o.material = Array.isArray(o.material) ? out : out[0]; if (glow) o.layers.enable(BLOOM_LAYER);
    if (/mushroom/i.test(ms[0]?.name ?? "")) o.visible = false;
  });
  return obj;
}
// plain placed prop: bottom-centre origin, scaled to target height
function normP(obj, height) {
  const b = bbox(obj), s = b.getSize(V3()); const k = height / s.y; const g = new THREE.Group(); g.add(obj); obj.scale.multiplyScalar(k); obj.updateMatrixWorld(true);
  const b2 = bbox(obj), c = b2.getCenter(V3()); obj.position.x -= c.x; obj.position.z -= c.z; obj.position.y -= b2.min.y; g.userData.size = s.multiplyScalar(k); return g;
}

let TINT = TINT0, TENT = TENT0, TH = (x, z) => 0;

// ---------------- wind sway (vertex shader patch, low amplitude) ----------------
export function addSway(mat, U, ampLocal, hLocal) {
  mat.onBeforeCompile = sh => {
    sh.uniforms.uTime = U.uTime; sh.uniforms.uSwayH = { value: hLocal }; sh.uniforms.uAmp = { value: ampLocal };
    sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nuniform float uTime;uniform float uSwayH;uniform float uAmp;")
      .replace("#include <begin_vertex>", `#include <begin_vertex>
      float sw = clamp(position.y / uSwayH, 0.0, 1.0); sw *= sw;
      #ifdef USE_INSTANCING
        vec3 ip = vec3(instanceMatrix[3]);
      #else
        vec3 ip = vec3(0.0);
      #endif
      float ph = ip.x * 0.37 + ip.z * 0.51;
      transformed.x += uAmp * sw * (sin(uTime * 1.1 + ph + position.y * 0.02) + 0.5 * sin(uTime * 2.3 + ph * 1.7));
      transformed.z += uAmp * sw * 0.6 * cos(uTime * 0.9 + ph * 1.3);`);
  };
  mat.customProgramCacheKey = () => "sway" + ampLocal.toFixed(3);
}

export const SEAT_XZ = { stump: 0.4, log: 0.62 };
export const nat = n => D.nature + n + ".fbx", surv = n => D.survival + n + ".fbx", bld = n => D.build + n + ".fbx";
const cacheObj = new Map();
async function loadTinted(url, kind) { const k = url + "|" + kind; if (!cacheObj.has(k)) { const o = toonifyP(await loadFBX(url), kind); cacheObj.set(k, o); } return cacheObj.get(k); }
// returns {meshes, add(list)} ; list items {x,y,z,yaw,h(target height),tilt?,tint}
export async function scatter(scene, url, items, U, { amp = 0.05, shadow = false } = {}) {
  if (!items.length) return;
  const obj = await loadTinted(url, "nat"); obj.updateMatrixWorld(true); const b = bbox(obj), sz = b.getSize(V3()), c = b.getCenter(V3());
  const subs = []; obj.traverse(m => { if (m.isMesh && m.visible) subs.push(m); });
  const M = new THREE.Matrix4(), Pm = new THREE.Matrix4(), B = new THREE.Matrix4(), Q = new THREE.Quaternion(), Sx = new THREE.Matrix4(), col = new THREE.Color();
  for (const m of subs) {
    const geo = m.geometry.clone().applyMatrix4(m.matrixWorld); const k0 = items[0].h / sz.y; // sway amplitude in local units
    const mats = Array.isArray(m.material) ? m.material.map(x => x.clone()) : m.material.clone();
    for (const mm of [].concat(mats)) if (!(mm instanceof THREE.MeshBasicMaterial)) addSway(mm, U, amp / k0, sz.y);
    const im = new THREE.InstancedMesh(geo, mats, items.length); im.frustumCulled = false; im.userData.src = url; im.castShadow = shadow;
    items.forEach((it, i) => {
      const k = it.h / sz.y; B.makeScale(k, k, k).multiply(new THREE.Matrix4().makeTranslation(-c.x, -b.min.y, -c.z));
      Q.setFromEuler(new THREE.Euler(it.tilt?.[0] ?? 0, it.yaw, it.tilt?.[1] ?? 0, "YXZ")); Pm.compose(V3(it.x, it.y ?? TH(it.x, it.z) - 0.04, it.z), Q, V3(1, 1, 1));
      M.multiplyMatrices(Pm, B); im.setMatrixAt(i, M); const v = it.tint ?? 1; im.setColorAt(i, col.setRGB(v, v, v));
    });
    im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; scene.add(im);
  }
}


// ---------------- characters: bone helpers, contact gate, acting ----------------
const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _v = new THREE.Vector3(), _m = new THREE.Matrix4();
function rotBoneWorld(bone, qWorld) {
  const pq = bone.parent.getWorldQuaternion(_q); const pinv = pq.clone().invert();
  bone.quaternion.premultiply(pinv.multiply(qWorld).multiply(pq)); bone.updateMatrixWorld(true);
}
const axisQ = (axis, ang) => new THREE.Quaternion().setFromAxisAngle(axis, ang);
function skinnedWorld(mesh, idxs, out) {
  const sk = mesh.skeleton, geo = mesh.geometry, P = geo.attributes.position, SI = geo.attributes.skinIndex, SW = geo.attributes.skinWeight;
  mesh.updateMatrixWorld(true); const nb = sk.bones.length; const bm = new Array(nb);
  for (let b = 0; b < nb; b++) bm[b] = new THREE.Matrix4().multiplyMatrices(sk.bones[b].matrixWorld, sk.boneInverses[b]);
  const full = new THREE.Matrix4(), tmp = new THREE.Matrix4(), v = new THREE.Vector3(), acc = new THREE.Vector3(), a4 = new THREE.Vector3();
  const bindInv = mesh.bindMatrixInverse, bind = mesh.bindMatrix; let n = 0;
  for (const i of idxs) {
    v.fromBufferAttribute(P, i).applyMatrix4(bind); acc.set(0, 0, 0);
    for (let k = 0; k < 4; k++) { const w = SW.getComponent(i, k); if (w > 0) { a4.copy(v).applyMatrix4(bm[SI.getComponent(i, k)]); acc.addScaledVector(a4, w); } }
    acc.applyMatrix4(bindInv).applyMatrix4(mesh.matrixWorld); out[n++] = acc.x; out[n++] = acc.y; out[n++] = acc.z;
  }
  return n / 3;
}
const LOCK_RE = /^(Root|Hips|UpperLeg|LowerLeg|Foot|Toe|PT)/;
function lockLower(clip) { // pelvis + legs + feet frozen at frame 0: stable seat/foot contact, upper body keeps the animation
  clip.tracks.forEach(t => { const bn = t.name.split(".")[0]; if (LOCK_RE.test(bn)) { const s = t.getValueSize(), v = t.values; for (let i = s; i < v.length; i++) v[i] = v[i % s]; } });
  return clip;
}
let UALc; const clipMemo = {};
async function bake(ch) { UALc ??= await loadUAL(); const id = ch.cfg.id; const o = {}; for (const n of ["Sitting_Idle_Loop", "Sitting_Talking_Loop"]) o[n] = lockLower(bakeClip(UALc, UALc.animations.find(a => a.name === n), ch)); return clipMemo[id] = o; }

class Actor {
  constructor(ch, clips, id, yaw) { this.ch = ch; this.clips = clips; this.id = id; this.yaw = yaw; this.clip = null; this.blinkT = []; }
  setup(clipName, seedBlink) {
    this.clip = this.clips[clipName]; const R = rng(seedBlink); let t = 1.0 + R() * 2; while (t < 130) { this.blinkT.push(t); t += 2.5 + R() * 2.5; }
    const B = n => this.ch.bones[sanit(n)]; this.B = B; this.head = B("Head"); this.neck = B("Neck");
    // rest head forward (root faces +Z at yaw 0)
    this.ch.root.rotation.set(0, 0, 0); this.ch.root.position.set(0, 0, 0); this.ch.skel.pose(); this.ch.root.updateMatrixWorld(true);
    this.restHeadQ = this.head.getWorldQuaternion(new THREE.Quaternion());
    // skin selections for the gate
    this.contact = []; this.feet = []; this.legs = []; this.ch.root.traverse(o => {
      if (!o.isSkinnedMesh || !o.visible) return; const sk = o.skeleton, SI = o.geometry.attributes.skinIndex, SW = o.geometry.attributes.skinWeight; let part = ""; for (let p = o; p; p = p.parent) { const m = /_(Legs|Feet|Body|Head)$/.exec(p.name); if (m) { part = m[1]; break; } }
      if (part === "Feet") { this.feet.push({ mesh: o, idx: Array.from({ length: o.geometry.attributes.position.count }, (_, i) => i) }); return; }
      if (part === "Legs") this.legs.push({ mesh: o, idx: Array.from({ length: o.geometry.attributes.position.count }, (_, i) => i) });
      if (part === "Head") return; const idx = [];
      for (let i = 0; i < SI.count; i++) { let bi = 0, bw = -1; for (let k = 0; k < 4; k++) { const w = SW.getComponent(i, k); if (w > bw) { bw = w; bi = SI.getComponent(i, k); } } if (/^(Hips|UpperLeg)/.test(sk.bones[bi].name)) idx.push(i); }
      if (idx.length) this.contact.push({ mesh: o, idx });
    });
  }
  place(x, z, yaw) { this.yaw = yaw; this.ch.root.rotation.y = yaw; this.ch.root.position.set(x, this.ch.root.position.y, z); }
  pose(t) { poseAt(this.ch, this.clip, t % this.clip.duration); this.fixFingers(); }
  // cast cfg "fingerScale": {fingers, thumb} uniform scale on each proximal phalanx (<F>2, Thumb2): the finger shrinks about the knuckle, the palm (<F>1) keeps its size.
  // Skeleton.pose() resets bone scale to bind, and clips carry no scale tracks, so this is re-applied after every pose (every frame, every pose).
  fixFingers() {
    const fs_ = this.ch.cfg.fingerScale; if (!fs_ || !this.B) return;
    this._fb ??= ["L", "R"].flatMap(sd => [...["Index", "Middle", "Ring", "Pinky"].map(f => [this.B(f + "2." + sd), fs_.fingers ?? 1]), [this.B("Thumb2." + sd), fs_.thumb ?? 1]]).filter(([b]) => b);
    for (const [b, k] of this._fb) b.scale.setScalar(k); this.ch.root.updateMatrixWorld(true);
  }
  worldVerts(sel) { const out = []; for (const s of sel) { const a = new Float32Array(s.idx.length * 3); skinnedWorld(s.mesh, s.idx, a); out.push(a); } return out; }
  // lateral axis (horizontal, perpendicular to facing) and facing
  facing() { return V3(Math.sin(this.yaw), 0, Math.cos(this.yaw)); }
  lateral() { return V3(Math.cos(this.yaw), 0, -Math.sin(this.yaw)); }
  // sign calibration so that positive angle about lateral axis raises the probe bone (arm lift) / lowers forward gaze (nod)
  calibrate() {
    const lat = this.lateral(); const test = (bone, probe, up) => { const q = axisQ(lat, 0.3); const y0 = probe.getWorldPosition(V3()).y; const save = bone.quaternion.clone(); rotBoneWorld(bone, q); const y1 = probe.getWorldPosition(V3()).y; bone.quaternion.copy(save); bone.updateMatrixWorld(true); return (y1 > y0) === up ? 1 : -1; };
    this.root = this.ch.root; this.root.updateMatrixWorld(true);
    this.armSign = test(this.B("UpperArm.R"), this.B("Wrist.R"), true); this.foreSign = test(this.B("LowerArm.R"), this.B("Wrist.R"), true);
    // nod: positive angle should move the head's forward vector down
    const fwdY = () => { const q = this.head.getWorldQuaternion(new THREE.Quaternion()).multiply(this.restHeadQ.clone().invert()); return V3(0, 0, 1).applyQuaternion(q).y; };
    const y0 = fwdY(), save = this.neck.quaternion.clone(); rotBoneWorld(this.neck, axisQ(lat, 0.3)); const y1 = fwdY(); this.neck.quaternion.copy(save); this.neck.updateMatrixWorld(true); this.nodSign = y1 < y0 ? 1 : -1;
  }
  headFwd() { const q = this.head.getWorldQuaternion(new THREE.Quaternion()).multiply(this.restHeadQ.clone().invert()); return V3(0, 0, 1).applyQuaternion(q); }
  lookAt(target, w = 1, maxYaw = this.maxYawDeg ?? 55, maxPitch = 22) {
    const head = this.head.getWorldPosition(V3()); const want = target.clone().sub(head).normalize();
    for (const [bone, f] of [[this.neck, 0.4], [this.head, 0.6]]) {
      const cur = this.headFwd(); const f0 = this.facing();
      // clamp desired direction relative to body facing
      const wy = Math.atan2(want.x, want.z) - Math.atan2(f0.x, f0.z); const wyc = Math.atan2(Math.sin(wy), Math.cos(wy));
      const cy = THREE.MathUtils.clamp(wyc, -maxYaw * Math.PI / 180, maxYaw * Math.PI / 180), cp = THREE.MathUtils.clamp(Math.asin(want.y), -maxPitch * Math.PI / 180, maxPitch * Math.PI / 180);
      const ang = Math.atan2(f0.x, f0.z) + cy; const dest = V3(Math.sin(ang) * Math.cos(cp), Math.sin(cp), Math.cos(ang) * Math.cos(cp));
      const dq = new THREE.Quaternion().setFromUnitVectors(cur, dest); dq.slerp(new THREE.Quaternion(), 1 - f * w); rotBoneWorld(bone, dq);
    }
  }
  gazeOffset(target) { const hp = this.head.getWorldPosition(V3()); const want = target.clone().sub(hp).normalize(); const q = this.head.getWorldQuaternion(new THREE.Quaternion()).multiply(this.restHeadQ.clone().invert()); const d = want.applyQuaternion(q.invert()); d.applyAxisAngle(V3(0, 1, 0), -this.yaw); return { x: d.x, y: d.y }; }
  roll(ang) { if (ang) rotBoneWorld(this.head, axisQ(this.headFwd(), ang)); }
  nodS(amt) { if (!amt) return; const lat = this.lateral(); rotBoneWorld(this.neck, axisQ(lat, this.nodSign * amt * 0.5)); rotBoneWorld(this.head, axisQ(lat, this.nodSign * amt * 0.5)); }
  yawHead(ang) { if (!ang) return; rotBoneWorld(this.neck, axisQ(V3(0, 1, 0), ang * 0.4)); rotBoneWorld(this.head, axisQ(V3(0, 1, 0), ang * 0.6)); }
  nod(amt) { if (amt <= 0) return; const lat = this.lateral(); rotBoneWorld(this.neck, axisQ(lat, this.nodSign * amt * 0.5)); rotBoneWorld(this.head, axisQ(lat, this.nodSign * amt * 0.5)); }
  blinkAmt(t) { let a = 0; for (const b of (this.blinkAll ?? [...this.blinkT, ...(this.forced ?? [])])) { if (t < b - 0.01) break; const x = t - b; if (x < 0.17) a = Math.max(a, 1 - Math.abs(x / 0.085 - 1)); } return a; }
}


// ---------------- the world (set-driven) ----------------
// buildWorld({set, pair}) : set = sets/<id>.js data + build(ctx); pair = [idA, idB] (A is screen-left, B screen-right, always).
// set.build(ctx) places scenery in set order and returns {update(t, shotFX), onShot(rc, shotFX)}.
const DEF_EMO = { A: [[0, "neutral"], [1.5, "warm"], [3.4, "thinking"], [5.6, "tender"]], B: [[0, "neutral"], [2.9, "surprised"], [4.6, "warm"]] };
export async function buildWorld({ set, pair, log: lg = log, speaker = () => "A" } = {}) {
  pair = pair ?? set.pair;
  const scene = new THREE.Scene(); const R = rng(set.seed ?? 1109); const U = { uTime: { value: 0 }, uPx: { value: 1 }, uFocal: { value: 1000 } };
  TH = set.terrainH; TINT = { ...TINT0, ...(set.tints ?? {}) }; TENT = { ...TENT0, ...(set.tent ?? {}) };
  const moonDir = set.moonDir.clone();
  scene.fog = new THREE.Fog(...set.fog);
  const skyApi = set.makeSky({ U, scene, moonDir }) ?? {};
  // lights: set.lights {key?, rim, hemi, face}
  const L = set.lights;
  let key = null;
  if (L.key) { const k = L.key; key = new THREE.PointLight(k.color, 1, 0, k.decay ?? 2); key.position.copy(k.pos); key.castShadow = true; key.shadow.mapSize.set(k.shadow?.size ?? 2048, k.shadow?.size ?? 2048); key.shadow.camera.near = k.shadow?.near ?? 0.3; key.shadow.camera.far = k.shadow?.far ?? 9; key.shadow.bias = k.shadow?.bias ?? -0.0015; key.shadow.normalBias = k.shadow?.normalBias ?? 0.02; key.shadow.radius = k.shadow?.radius ?? 4; scene.add(key); }
  const rim = new THREE.DirectionalLight(L.rim.color, L.rim.i); rim.position.copy(moonDir.clone().multiplyScalar(30)); scene.add(rim, rim.target);
  if (L.rim.shadow) { rim.castShadow = true; const s = rim.shadow, e = L.rim.shadow.extent ?? 4.5; s.mapSize.set(2048, 2048); s.camera.left = -e; s.camera.right = e; s.camera.top = e; s.camera.bottom = -e; s.camera.near = 1; s.camera.far = 70; s.bias = -0.0008; s.normalBias = 0.03; s.radius = 3; }
  const fill = new THREE.HemisphereLight(L.hemi.sky, L.hemi.ground, L.hemi.i); scene.add(fill);
  const faceFill = new THREE.DirectionalLight(L.face.color, L.face.i); faceFill.name = "faceFill"; scene.add(faceFill);
  const casters = [];
  const place = async (url, h, x, z, yaw, kind = "nat", y = null) => { const o = normP(toonifyP(await loadFBX(url), kind), h); o.position.set(x, y ?? TH(x, z), z); o.rotation.y = yaw; scene.add(o); casters.push(o); return o; };
  const ctx = { THREE, scene, R, U, rng, PAL, casters, place, scatter: (url, items, o) => scatter(scene, url, items, U, o), loadFBX, loadTinted, toonifyP, normP, TH, V3, sstep, lerp, addSway: (m, a, h) => addSway(m, U, a, h), nat, surv, bld, key, rim, fill, faceFill, moonDir, BLOOM_LAYER, bbox, set, pair };
  const life = (await set.build(ctx)) ?? {};

  // ----- characters, seats, contact -----
  const mk = async (id) => { const ch = await loadCast(id); const clips = await bake(ch); return new Actor(ch, clips, id, 0); };
  const actors = { A: await mk(pair[0]), B: await mk(pair[1]) }; scene.add(actors.A.ch.root, actors.B.ch.root);
  actors.A.setup("Sitting_Idle_Loop", 5); actors.B.setup("Sitting_Idle_Loop", 8); const AB = [actors.A, actors.B];
  const gate = { seats: {}, notes: [] };
  const seatObjs = {};
  const ray2 = new THREE.Raycaster();
  function prePlace(actor, X, Z, yaw) {
    const ch = actor.ch; actor.yaw = yaw; ch.root.rotation.set(0, yaw, 0); ch.root.position.set(X, 0, Z); actor.pose(0); ch.root.updateMatrixWorld(true);
    // feet: sole on the terrain
    let fv = actor.worldVerts(actor.feet); let miny = 1e9; fv.forEach(a => { for (let i = 0; i < a.length; i += 3) miny = Math.min(miny, a[i + 1] - TH(a[i], a[i + 2])); });
    ch.root.position.y = -miny + 0.002; ch.root.updateMatrixWorld(true);
    // contact verts: the lowest of thighs/hips
    const cv = actor.worldVerts(actor.contact); let low = V3(0, 1e9, 0); const all = []; cv.forEach(a => { for (let i = 0; i < a.length; i += 3) { all.push([a[i], a[i + 1], a[i + 2]]); if (a[i + 1] < low.y) low.set(a[i], a[i + 1], a[i + 2]); } });
    all.sort((a, b) => a[1] - b[1]); const lowest = all.slice(0, Math.max(10, Math.floor(all.length * 0.04))); const C = V3(); lowest.forEach(p => C.add(V3(...p))); C.multiplyScalar(1 / lowest.length);
    const nr = all.filter(p => p[1] < low.y + 0.045); const zr = [Math.min(...nr.map(p => p[2])), Math.max(...nr.map(p => p[2]))];
    return { low, C, H: low.y, fwd: actor.facing(), lat: actor.lateral(), zr };
  }
  async function seat(actor, kind, X, Z, yaw, opt = {}) { // per-actor stump / log seat (spike1 fit, unchanged)
    const { low, C, H, fwd, lat } = prePlace(actor, X, Z, yaw);
    let w = null; const cands = opt.cands ?? (kind === "stone" ? [0.7, 0.6, 0.55, 0.5, 0.45, 0.4, 0.35, 0.3] : kind === "log" ? [0.5, 0.42, 0.36, 0.3, 0.26] : [0.36, 0.3, 0.26, 0.22, 0.18]); const ls = opt.lenScale ?? 1; let fitPen = 0, usedFx = 0;
    for (const curFile of (opt.files ?? [null])) { for (const FX of cands) { if (w) scene.remove(w); SEAT_XZ[kind === "log" ? "log" : "stump"] = FX; usedFx = FX;
    const name = kind === "log" ? "WoodLog" : kind === "stone" ? curFile : "TreeStump_Moss"; const obj = toonifyP(await loadFBX(nat(name)), "nat"); if (kind === "stone") obj.traverse(o => { if (o.isMesh) [].concat(o.material).forEach(mm => { if (mm.color) mm.color.multiplyScalar(opt.bright ?? 0.75); }); }); if (kind === "stone") { let ymin = 1e9, ymax = -1e9; obj.updateMatrixWorld(true); obj.traverse(o => { if (o.isMesh) { o.geometry = o.geometry.clone(); o.geometry.computeBoundingBox(); const b = o.geometry.boundingBox; ymin = Math.min(ymin, b.min.y); ymax = Math.max(ymax, b.max.y); } }); const cap = ymin + (ymax - ymin) * (opt.cap ?? 0.8); obj.traverse(o => { if (o.isMesh) { const p = o.geometry.attributes.position; for (let i = 0; i < p.count; i++) if (p.getY(i) > cap) p.setY(i, cap); p.needsUpdate = true; o.geometry.computeVertexNormals(); o.geometry.computeBoundingBox(); o.geometry.computeBoundingSphere(); } }); }
    const g = normP(obj, kind === "log" ? 0.45 : 0.5); w = new THREE.Group(); w.add(g); scene.add(w); w.castShadow = true;
    g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    const ray = new THREE.Raycaster(); const topAt = (x, z) => { ray.set(V3(x, 6, z), V3(0, -1, 0)); const h = solid(ray.intersectObject(w, true)); return h.length ? h[0].point.y : null; };
    if (kind === "log") { // log lies across the facing direction; the ridge passes under the lowest contact point
      w.rotation.y = yaw + Math.PI / 2; w.updateMatrixWorld(true); const cx = low.x - fwd.x * 0.06, cz = low.z - fwd.z * 0.06; w.position.set(cx, 0, cz);
      const ctr = V3(C.x, 0, C.z); const along = ctr.clone().sub(V3(cx, 0, cz)); w.position.add(lat.clone().multiplyScalar(along.dot(lat)));
      for (let it = 0; it < 7; it++) { w.updateMatrixWorld(true); const top = topAt(low.x, low.z) ?? 0.4; const sy = (w.scale.y || 1) * H / top; w.scale.set(SEAT_XZ.log * sy, sy, sy * ls); w.position.y = 0; }
      w.updateMatrixWorld(true);
    } else {
      w.rotation.y = 0; w.position.set(C.x - fwd.x * (opt.back ?? 0.06), 0, C.z - fwd.z * (opt.back ?? 0.06)); w.updateMatrixWorld(true);
      if (kind !== "stone") { const p = V3(), q = V3(); let best = -1e9; w.traverse(o => { if (o.isMesh) { const pa = o.geometry.attributes.position; for (let i = 0; i < pa.count; i++) { q.fromBufferAttribute(pa, i).applyMatrix4(o.matrixWorld); if (q.y > best) { best = q.y; p.copy(q); } } } });
        const a0 = Math.atan2(p.x - C.x, p.z - C.z), a1 = Math.atan2(-fwd.x, -fwd.z); w.rotation.y = a1 - a0; w.updateMatrixWorld(true); }
      const pts = []; for (let i = 0; i < 9; i++) { const a = i / 9 * 6.28; const t = topAt(C.x + Math.cos(a) * 0.14, C.z + Math.sin(a) * 0.14); if (t !== null) pts.push(t); } pts.sort((a, b) => a - b); const med = pts[Math.floor(pts.length / 2)] ?? 0.4;
      const ax = kind === "stone" ? (opt.aspect ?? 2.4) : 1; w.scale.set(SEAT_XZ.stump * ax, 1, SEAT_XZ.stump); w.updateMatrixWorld(true); { const pts2 = []; for (let i = 0; i < 9; i++) { const a = i / 9 * 6.28; const t2 = topAt(C.x + Math.cos(a) * 0.14, C.z + Math.sin(a) * 0.14); if (t2 !== null) pts2.push(t2); } pts2.sort((a, b) => a - b); const m2 = pts2[Math.floor(pts2.length / 2)] ?? med; const sy = H / m2; w.scale.set(SEAT_XZ.stump * sy * ax, sy, SEAT_XZ.stump * sy); } w.updateMatrixWorld(true);
    }
      seatObjs[actor.id] = w; let mm_ = measure(actor); if (isFinite(mm_.seatGap)) { w.position.y += mm_.seatGap - 0.004; w.updateMatrixWorld(true); mm_ = measure(actor); } fitPen = mm_.pen; lg("fit", actor.id, FX, "pen", mm_.pen.toFixed(3), "gap", mm_.seatGap.toFixed(3), "n", mm_.seatSamples, "scale", w.scale.toArray().map(x => +x.toFixed(2)).join(",")); if (mm_.pen <= 0.012) break; }
      if (fitPen <= 0.012) break; }
    if (fitPen > 0.012) lg("SEAT FIT FAILED", actor.id, fitPen); gate.notes.push(`${actor.id} seat fit: xz scale ${usedFx}, residual penetration ${(fitPen * 100).toFixed(2)} cm`);
    return { H, scale: w.scale.x, fx: usedFx, fitPen };
  }
  // shared seat (bench plank or long log) along world x: one object, top height per sitter fitted by a smooth vertical warp, so any pair fits
  async function seatShared(sh, XA, XB, Z, yawA, yawB) {
    const pa = prePlace(actors.A, XA, Z, yawA), pb = prePlace(actors.B, XB, Z, yawB);
    const obj = toonifyP(await loadFBX(nat(sh.file ?? "WoodLog")), "nat"); const g0 = normP(obj, 1); const root = new THREE.Group(); root.add(g0); root.updateMatrixWorld(true);
    { const s = bbox(root).getSize(V3()); root.rotation.y = s.z > s.x ? Math.PI / 2 : 0; root.updateMatrixWorld(true); }
    const parts = []; root.traverse(o => { if (o.isMesh && o.visible) { const geo = o.geometry.clone().applyMatrix4(o.matrixWorld); parts.push({ geo, mat: o.material, p0: geo.attributes.position.array.slice() }); } });
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9, z0 = 1e9, z1 = -1e9; for (const p of parts) { const a = p.p0; for (let i = 0; i < a.length; i += 3) { x0 = Math.min(x0, a[i]); x1 = Math.max(x1, a[i]); y0 = Math.min(y0, a[i + 1]); y1 = Math.max(y1, a[i + 1]); z0 = Math.min(z0, a[i + 2]); z1 = Math.max(z1, a[i + 2]); } }
    const cx0 = (x0 + x1) / 2, cz0 = (z0 + z1) / 2, lenN = x1 - x0, widN = z1 - z0, hN = y1 - y0;
    const xc = (XA + XB) / 2 + (sh.dx ?? 0); let zc0 = (pa.low.z - pa.fwd.z * 0.06 + pb.low.z - pb.fwd.z * 0.06) / 2 + (sh.dz ?? 0), len = sh.length ?? 2.2; const zlo = Math.min(pa.zr[0], pb.zr[0]), zhi = Math.max(pa.zr[1], pb.zr[1]); zc0 = (zlo + zhi) / 2 + (sh.dz ?? 0); const need = zhi - zlo + 0.08; let zc = zc0;
    const style = sh.style ?? "log", thick = sh.thick ?? 0.2; const flat = sh.flat ?? (style === "plank" ? 0.9 : 0.6); const grp = new THREE.Group(); grp.name = "sharedSeat"; grp.userData.slab = true; scene.add(grp); const meshes = parts.map(p => { const dm = [].concat(p.mat).map(mm => { const c = mm.clone(); c.side = THREE.DoubleSide; return c; }); const m = new THREE.Mesh(p.geo, Array.isArray(p.mat) ? dm : dm[0]); m.castShadow = true; m.receiveShadow = true; grp.add(m); return m; });
    const hs = { A: pa.H, B: pb.H }; const topAt = x => { const t = Math.min(1, Math.max(0, (x - XA) / (XB - XA))); return hs.A + (hs.B - hs.A) * t; };
    const supports = []; let supGroup = null;
    function rebuild(width) {
      parts.forEach((p, k) => { const a = p.p0, o = p.geo.attributes.position.array; for (let i = 0; i < a.length; i += 3) { const x = xc + (a[i] - cx0) * (len / lenN), z = zc + (a[i + 2] - cz0) * (width / widN); let f = (a[i + 1] - y0) / hN; if (f > 0.5 && flat > 0) { const u = (a[i + 2] - cz0) / (widN / 2); const ft = 0.5 + 0.5 * Math.sqrt(Math.max(0, 1 - u * u)); const fn = Math.min(1, 0.5 + (f - 0.5) * 0.5 / Math.max(ft - 0.5, 0.14)); f += (fn - f) * flat; } o[i] = x; o[i + 2] = z; o[i + 1] = style === "plank" ? topAt(x) - thick * (1 - f) : f * topAt(x); } p.geo.attributes.position.needsUpdate = true; p.geo.computeVertexNormals(); p.geo.computeBoundingSphere(); p.geo.computeBoundingBox(); });
      grp.updateMatrixWorld(true);
    }
    seatObjs[actors.A.id] = grp; seatObjs[actors.B.id] = grp;
    const cands = style === "plank" ? [Math.max(0.46, need), need + 0.08, need + 0.16] : [0.48, 0.42, 0.36, 0.3, 0.26]; let used = 0, penA = 0, penB = 0, best = null;
    outer: for (const off of [0, -0.04, 0.04, -0.08, 0.08]) { zc = zc0 + off; hs.A = pa.H; hs.B = pb.H; for (const wd of cands) { used = wd; for (let it = 0; it < 5; it++) { rebuild(wd); const ma = measure(actors.A), mb = measure(actors.B); const ga = isFinite(ma.seatGap) ? ma.seatGap : 0, gb = isFinite(mb.seatGap) ? mb.seatGap : 0; penA = ma.pen; penB = mb.pen; if (Math.abs(ga) < 0.0006 && Math.abs(gb) < 0.0006) break; hs.A += ga; hs.B += gb; } lg("fit shared off", off, "w", wd, "pen", penA.toFixed(3), penB.toFixed(3), "H", hs.A.toFixed(3), hs.B.toFixed(3)); const pm = Math.max(penA, penB); if (!best || pm < best.pm) best = { pm, off, wd, A: hs.A, B: hs.B }; if (pm <= 0.012) break outer; } }
    if (best.pm > 0.012 || zc !== zc0 + best.off || used !== best.wd) { zc = zc0 + best.off; hs.A = best.A; hs.B = best.B; rebuild(best.wd); used = best.wd; const ma = measure(actors.A), mb = measure(actors.B); penA = ma.pen; penB = mb.pen; }
    if (style === "plank") { // two rock supports under the plank ends (placement only)
      const xs = [xc - len / 2 + 0.22, xc + len / 2 - 0.22]; supGroup = new THREE.Group(); scene.add(supGroup); let k = 0;
      for (const sx of xs) { const hb = topAt(sx) - thick + 0.03; const o = normP(toonifyP(await loadFBX(nat(sh.support ?? "Rock_3")), "nat"), Math.max(0.1, hb)); o.scale.set(sh.supportW ?? 0.55, 1, sh.supportW ?? 0.55); o.position.set(sx, TH(sx, zc), zc); o.rotation.y = 0.7 + k++ * 1.9; o.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } }); supGroup.add(o); }
    }
    gate.notes.push(`shared ${style} seat: width ${used}, residual penetration A ${(penA * 100).toFixed(2)} cm B ${(penB * 100).toFixed(2)} cm`);
    return { style, width: used, H: { A: pa.H, B: pb.H }, fitted: { ...hs }, penA, penB, len };
  }
  function measure(actor) {
    const seatObj = seatObjs[actor.id]; seatObj.updateMatrixWorld(true); actor.ch.root.updateMatrixWorld(true);
    const cv = actor.worldVerts(actor.contact); let minGap = 1e9, n = 0, minY = 1e9; cv.forEach(a => { for (let i = 0; i < a.length; i += 3) minY = Math.min(minY, a[i + 1]); });
    cv.forEach(a => { for (let i = 0; i < a.length; i += 3) { if (a[i + 1] > minY + 0.1) continue; ray2.set(V3(a[i], 6, a[i + 2]), V3(0, -1, 0)); const h = solid(ray2.intersectObject(seatObj, true)); if (h.length) { minGap = Math.min(minGap, a[i + 1] - h[0].point.y); n++; } } });
    const fv = actor.worldVerts(actor.feet); let fg = 1e9; fv.forEach(a => { for (let i = 0; i < a.length; i += 3) fg = Math.min(fg, a[i + 1] - TH(a[i], a[i + 2])); });
    // penetration gate: any leg / hip / foot vertex inside the seat volume (odd number of surface crossings above it) deeper than 1.5 cm
    let pen = 0, penN = 0; const sel = [...actor.legs, ...actor.contact, ...actor.feet]; const top = minY + 0.55;
    for (const a of actor.worldVerts(sel)) for (let i = 0; i < a.length; i += 3) { const vy = a[i + 1]; if (vy > top) continue; ray2.set(V3(a[i], 4, a[i + 2]), V3(0, -1, 0)); const hs = solid(ray2.intersectObject(seatObj, true)); if (!hs.length) continue; if (seatObj.userData.slab) { let hi = -1e9, lo = 1e9; for (const h of hs) { hi = Math.max(hi, h.point.y); lo = Math.min(lo, h.point.y); } if (vy < hi && vy > lo) { const depth = Math.min(hi - vy, vy - lo); if (depth > 0.015) penN++; if (depth > pen) { pen = depth; actor.penAt = [a[i], vy, a[i + 2], hi, lo]; } } continue; } let above = 1e9, below = -1e9, na = 0; for (const h of hs) { if (h.point.y > vy) { na++; above = Math.min(above, h.point.y); } else below = Math.max(below, h.point.y); } if (na % 2 === 1) { const depth = Math.min(above - vy, vy - below); if (depth > 0.015) penN++; if (depth > pen) { pen = depth; actor.penAt = [a[i], vy, a[i + 2], above, below]; } } }
    return { seatGap: n ? minGap : NaN, seatSamples: n, footGap: fg, pen, penN };
  }
  const SS = set.seats; const sharedInfo = SS.shared ? await seatShared(SS.shared, SS.A.x, SS.B.x, SS.A.z ?? 0, SS.A.yaw, SS.B.yaw) : null;
  if (sharedInfo) gate.seats.shared = sharedInfo;
  else for (const s of ["A", "B"]) gate.seats[actors[s].id] = await seat(actors[s], SS[s].kind, SS[s].x, SS[s].z ?? 0, SS[s].yaw, SS[s]);
  AB.forEach(a => { a.calibrate(); if (set.headYaw) a.maxYawDeg = set.headYaw; });
  const layers = {}; for (const s of ["A", "B"]) { const a = actors[s]; layers[s] = makeFaceLayer(a.ch, { skin: a.ch.cfg.colors.Skin, ...FACE_CFG[a.id] }); }
  const emo = { A: DEF_EMO.A, B: DEF_EMO.B };
  actors.A.forced = emo.A.slice(1).map(e => e[0] - 0.05); actors.B.forced = emo.B.slice(1).map(e => e[0] - 0.05);
  let lipD = () => null; const setWords = w => { lipD = buildLipsync(w); };
  const FS = (em, t, lip, gD) => { const e = emotionState(em, t); return { m: e.m, lip, up: e.up, lo: e.lo, tilt: e.tilt, br: e.br + 0.45 * gD, bi: e.bi, bL: e.bL, bR: e.bR }; };
  AB.forEach(a => a.ch.root.traverse(o => { if (o.isSkinnedMesh) { o.castShadow = true; o.receiveShadow = false; } }));
  casters.forEach(o => o.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } }));
  if (!sharedInfo) for (const a of AB) { a.pose(0); a.ch.root.updateMatrixWorld(true); const m = measure(a); const w = seatObjs[a.id]; if (isFinite(m.seatGap)) { w.position.y += m.seatGap; w.updateMatrixWorld(true); } gate.seats[a.id].trimmed = m.seatGap; }
  if (set.afterSeats) await set.afterSeats(ctx, { seatObjs, actors, sharedInfo });

  // ----- anchors for camera rigs (head bone world position at t=0) -----
  const anchors = {}; for (const s of ["A", "B"]) { const a = actors[s]; a.pose(0); a.ch.root.updateMatrixWorld(true); anchors[s] = { head: a.head.getWorldPosition(V3()), yaw: a.yaw }; anchors[a.id] = anchors[s]; }

  // ----- per-frame update (pure function of t) -----
  const shotFX = { fireScale: 1 };
  function setShot(rc) { shotFX.fireScale = rc.fireScale ?? 1; life.onShot?.(rc, shotFX); faceFill.position.copy(rc.pos).normalize().multiplyScalar(30); faceFill.position.y = Math.max(faceFill.position.y, 6); if (rc.rimDir) { rim.position.copy(rc.rimDir.clone().normalize().multiplyScalar(30)); rim.intensity = rc.rimI ?? 3.2; } else { rim.position.copy(moonDir.clone().multiplyScalar(30)); rim.intensity = L.rim.i; } }
  const stress = [2.45, 5.55]; // seconds: stressed words (from dummy words.json)
  const nods = [3.55, 6.55];
  const glanceT = set.glanceTarget ?? V3(0, 0.7, 0);
  const glance = (g, t) => g.reduce((s, x) => s + bump(t - x, 0.9), 0);
  const GL = { speaker: [0.6, 4.8, 9.5, 14, 19], listener: [3.0, 8.2, 12.5, 17] };
  function actSpeaker(a, o, layer, em, t, gD) { // original dadu block
    const lat = a.lateral(); const gl = glance(GL.speaker, t); const talk = 0.5 + 0.5 * Math.sin(t * 0.9);
    rotBoneWorld(a.B("Torso"), axisQ(lat, a.nodSign * (0.07 + 0.02 * Math.sin(t * 1.3))));
    rotBoneWorld(a.B("Chest"), axisQ(V3(0, 1, 0), 0.04 * Math.sin(t * 0.8 + 1)));
    if (gD > 0) { rotBoneWorld(a.B("UpperArm.R"), axisQ(lat, a.armSign * 0.42 * gD)); rotBoneWorld(a.B("LowerArm.R"), axisQ(lat, a.foreSign * 0.62 * gD)); rotBoneWorld(a.B("Wrist.R"), axisQ(lat, a.foreSign * 0.25 * gD)); rotBoneWorld(a.B("Chest"), axisQ(lat, a.nodSign * 0.06 * gD)); }
    rotBoneWorld(a.B("LowerArm.L"), axisQ(lat, a.foreSign * 0.09 * talk));
    const oh = anchors[o].head; const tgt = oh.clone().lerp(glanceT, 0.5 * gl); const eE = emotionState(em, t); a.lookAt(tgt, 1.0); a.nod(eE.nod); a.roll(eE.roll); a.nod(0.06 * gD + 0.025 * Math.sin(t * 2.1)); a.roll(0.05 * Math.sin(t * 0.55 + 0.7) + 0.04 * gD);
    const g0 = a.gazeOffset(oh), g1 = a.gazeOffset(V3(0, 0.8, 0)); const k = 0.018;
    layer.apply({ ...FS(em, t, lipD(t), gD), blink: a.blinkAmt(t), brow: 0.9 * gD + 0.15 * Math.sin(t * 1.7), gx: THREE.MathUtils.clamp(k * (g0.x * (1 - gl) + g1.x * gl) + 0.003 * Math.sin(t * 1.1), -0.009, 0.009), gy: THREE.MathUtils.clamp(k * (g0.y * (1 - gl) + g1.y * gl) - 0.002 * gl + 0.0015 * Math.sin(t * 0.7), -0.006, 0.006) });
  }
  function actListener(a, o, layer, em, t, gD) { // original rohan block
    const gl = glance(GL.listener, t); const n = nods.reduce((s, tn) => s + bump(t - tn, 0.8), 0); const oh = anchors[o].head;
    const tgt = oh.clone().lerp(glanceT, 0.4 * gl); const eE = emotionState(em, t); a.lookAt(tgt, 1.0); a.nod(eE.nod); a.roll(eE.roll); a.nod(0.2 * n); a.roll(0.04 * Math.sin(t * 0.45 + 2)); rotBoneWorld(a.B("Torso"), axisQ(a.lateral(), a.nodSign * 0.03 * n));
    const g0 = a.gazeOffset(oh), g1 = a.gazeOffset(V3(0, 0.8, 0)); const k = 0.018;
    layer.apply({ ...FS(em, t, null, Math.max(gD, n) * 0.5), blink: a.blinkAmt(t), brow: 0.3 * Math.max(gD, n) + 0.12 * Math.sin(t * 1.3), gx: THREE.MathUtils.clamp(k * (g0.x * (1 - gl) + g1.x * gl) + 0.003 * Math.sin(t * 0.9 + 2), -0.009, 0.009), gy: THREE.MathUtils.clamp(k * (g0.y * (1 - gl) + g1.y * gl) - 0.002 * gl, -0.006, 0.006) });
  }
  function update(t) {
    U.uTime.value = t; life.update?.(t, shotFX);
    for (const a of AB) a.pose(t);
    if (EP) { for (const [s, o] of [["A", "B"], ["B", "A"]]) { if (set.torsoTurn) { const ang = (s === "A" ? -1 : 1) * set.torsoTurn * (0.92 + 0.08 * Math.sin(t * 0.4 + (s === "A" ? 0 : 2))); rotBoneWorld(actors[s].B("Torso"), axisQ(V3(0, 1, 0), ang * 0.45)); rotBoneWorld(actors[s].B("Chest"), axisQ(V3(0, 1, 0), ang * 0.55)); } actEp(s, o, t); } return; }
    const gD = stress.reduce((s, ts) => s + bump(t - (ts - 0.25), 1.0), 0); const sp = speaker(t);
    for (const [s, o] of [["A", "B"], ["B", "A"]]) { if (set.torsoTurn) { const ang = (s === "A" ? -1 : 1) * set.torsoTurn * (0.92 + 0.08 * Math.sin(t * 0.4 + (s === "A" ? 0 : 2))); rotBoneWorld(actors[s].B("Torso"), axisQ(V3(0, 1, 0), ang * 0.45)); rotBoneWorld(actors[s].B("Chest"), axisQ(V3(0, 1, 0), ang * 0.55)); } (s === sp ? actSpeaker : actListener)(actors[s], o, layers[s], emo[s], t, gD); }
  }
  const gateFrame = a => measure(a);
  // ===================== episode acting (driven by dialogue/compiler shots.json) =====================
  // Seated only: hips/legs stay locked (lockLower), roots never move. Gestures land on the word time (eased sine in/out) and return to the knees.
  let EP = null; const lipBy = { A: () => null, B: () => null }; const gBy = { A: [], B: [] }; const gazeBy = { A: [], B: [] }; const HANDS = {};
  const firePt = set.firePoint ?? V3(0, 0.32, 0);
  const NEAR = { A: "R", B: "L" }; // camera-side hand (A faces +x, B faces -x, cameras sit on +z)
  const FING = ["Index", "Middle", "Ring", "Pinky"];
  function handRig(a, side) {
    const B = n => a.B(n + "." + side); const h = { side, ua: B("UpperArm"), la: B("LowerArm"), wr: B("Wrist"), sh: B("Shoulder"), f: FING.map(f => [2, 3, 4].map(k => B(f + k))), tip: FING.map(f => B(f + "4")), th: [1, 2, 3].map(k => B("Thumb" + k)), i1: B("Index1"), p1: B("Pinky1"), m1: B("Middle1") };
    h.ok = [h.ua, h.la, h.wr, h.i1, h.p1, h.m1, ...h.f.flat(), ...h.th].every(Boolean); return h;
  }
  const wp = (b, v = V3()) => b.getWorldPosition(v);
  function palmN(h) { const fd = wp(h.m1).sub(wp(h.wr)), ac = wp(h.i1).sub(wp(h.p1)); return fd.cross(ac).normalize().multiplyScalar(h.nSign); }
  function calibHands(a) {
    a.ch.skel.pose(); a.ch.root.updateMatrixWorld(true); const out = {};
    for (const side of ["L", "R"]) { const h = handRig(a, side); if (!h.ok) { out[side] = h; continue; } h.bindQ = new Map(); for (const b of [...h.f.flat(), ...h.th]) h.bindQ.set(b, b.quaternion.clone()); out[side] = h; }
    a.pose(0); a.ch.root.updateMatrixWorld(true);
    for (const side of ["L", "R"]) { const h = out[side]; if (!h.ok) continue; h.nSign = 1; const n = palmN(h); h.nSign = n.y < 0 ? 1 : -1; // hands rest palm-down on the knees
      // finger curl sign: positive curl moves the fingertip toward the palm side
      const ac = wp(h.i1).sub(wp(h.p1)).normalize(); const n2 = palmN(h); const tip0 = wp(h.tip[0]); const save = h.f[0][0].quaternion.clone(); rotBoneWorld(h.f[0][0], axisQ(ac, 0.4)); const d = wp(h.tip[0]).sub(tip0).dot(n2); h.f[0][0].quaternion.copy(save); h.f[0][0].updateMatrixWorld(true); h.curlSign = d > 0 ? 1 : -1;
      const fd = wp(h.m1).sub(wp(h.wr)).normalize(); const th0 = wp(h.th[2]); const s2 = h.th[0].quaternion.clone(); rotBoneWorld(h.th[0], axisQ(fd, 0.4)); const d2 = wp(h.th[2]).sub(th0).dot(n2); h.th[0].quaternion.copy(s2); h.th[0].updateMatrixWorld(true); h.thSign = d2 > 0 ? 1 : -1;
      // shoulder shrug sign: rotation about the facing axis that raises the upper arm
      const F = a.facing(); const y0 = wp(h.ua).y; const s3 = h.sh.quaternion.clone(); rotBoneWorld(h.sh, axisQ(F, 0.2)); const y1 = wp(h.ua).y; h.sh.quaternion.copy(s3); h.sh.updateMatrixWorld(true); h.shrugSign = y1 > y0 ? 1 : -1; }
    return out;
  }
  function setEpisode(ep) {
    EP = ep;
    for (const s of ["A", "B"]) {
      const a = actors[s]; emo[s] = ep.emotion[s];
      a.blinkAll = [...a.blinkT, ...ep.emotion[s].slice(1).map(e => e[0] + 0.03)].sort((x, y) => x - y); // forced blink on each expression change
      lipBy[s] = buildLipsync(ep.words.filter(w => w.sp === s)); gBy[s] = ep.gestures.filter(g => g.actor === s); gazeBy[s] = (ep.gaze ?? []).filter(g => g.actor === s);
      HANDS[s] = calibHands(a);
    }
    lg("episode", ep.ep, "hands", JSON.stringify(Object.fromEntries(["A", "B"].map(s => [s, Object.fromEntries(["L", "R"].map(sd => [sd, HANDS[s][sd].ok ? { n: HANDS[s][sd].nSign, curl: HANDS[s][sd].curlSign, th: HANDS[s][sd].thSign, shrug: HANDS[s][sd].shrugSign } : "missing bones"]))]))));
  }
  const speakerAt = t => { if (!EP) return "A"; let sp = EP.lines[0].sp; for (const L of EP.lines) { if (t >= L.s - 0.15) sp = L.sp; } return sp; };
  // envelope: sine rise to the word time, hold, sine release
  const envOf = (g, t) => { const a = g.t - g.rise, b = g.t + g.dur, rel = g.rel ?? 0.45; if (t <= a || t >= b + rel) return 0; if (t < g.t) return sineIO((t - a) / g.rise); if (t <= b) return 1; return 1 - sineIO((t - b) / rel); };
  // arm targets in the chest frame (f = toward the facing, u = up, o = outward for that hand), palm direction, finger extension [index, middle, ring, pinky, thumb]
  const OPEN = [1, 1, 1, 1, 1], FIST = [0, 0, 0, 0, 0];
  const ARM = {
    open_palm: { hands: "near", f: 0.34, u: -0.1, o: 0.2, palm: "up", fing: OPEN },
    palm_up: { hands: "near", f: 0.32, u: -0.14, o: 0.15, palm: "up", fing: OPEN, amt: 0.9 },
    hand_lift: { hands: "near", f: 0.34, u: -0.18, o: 0.1, palm: "up", fing: OPEN, amt: 0.8 },
    two_hand_open: { hands: "both", f: 0.3, u: -0.08, o: 0.24, palm: "up", fing: OPEN },
    hands_lift: { hands: "both", f: 0.32, u: -0.12, o: 0.12, palm: "fwd", fing: OPEN },
    count: { hands: "near", f: 0.36, u: -0.04, o: 0.13, palm: "partner", fing: FIST },
    two_fingers: { hands: "near", f: 0.36, u: -0.04, o: 0.13, palm: "partner", fing: [1, 1, 0, 0, 0] },
    flick: { hands: "near", f: 0.4, u: -0.05, o: 0.04, palm: "down", fing: [1, 0, 0, 0, 0] },
    palm_down: { hands: "near", f: 0.38, u: -0.13, o: 0.1, palm: "down", fing: OPEN, press: 0.06 },
    hand_chest: { hands: "near", f: 0.13, u: -0.04, o: -0.07, palm: "back", fing: OPEN },
  };
  function ik2(h, T) { // two-bone IK, keeps the current elbow bend plane
    const S = wp(h.ua), E = wp(h.la), W = wp(h.wr); const l1 = E.distanceTo(S), l2 = W.distanceTo(E);
    const d = T.clone().sub(S); const dist = THREE.MathUtils.clamp(d.length(), Math.abs(l1 - l2) + 1e-3, (l1 + l2) * 0.985); const dn = d.normalize();
    let pole = E.clone().sub(S); pole.addScaledVector(dn, -pole.dot(dn)); if (pole.lengthSq() < 1e-8) pole.set(0, -1, 0); pole.normalize();
    const ca = (l1 * l1 - l2 * l2 + dist * dist) / (2 * dist); const hh = Math.sqrt(Math.max(0, l1 * l1 - ca * ca)); const E2 = S.clone().addScaledVector(dn, ca).addScaledVector(pole, hh);
    rotBoneWorld(h.ua, new THREE.Quaternion().setFromUnitVectors(E.sub(S).normalize(), E2.clone().sub(S).normalize()));
    const E1 = wp(h.la), W1 = wp(h.wr); const Tt = S.clone().addScaledVector(dn, dist); rotBoneWorld(h.la, new THREE.Quaternion().setFromUnitVectors(W1.sub(E1).normalize(), Tt.sub(E1).normalize()));
  }
  function orientPalm(h, want, k) { // twist the hand about the forearm, then a limited wrist swing
    const ax = wp(h.wr).sub(wp(h.la)).normalize(); const n = palmN(h); const np = n.clone().addScaledVector(ax, -n.dot(ax)), wq = want.clone().addScaledVector(ax, -want.dot(ax));
    if (np.lengthSq() > 1e-6 && wq.lengthSq() > 1e-6) { np.normalize(); wq.normalize(); const ang = Math.atan2(ax.dot(np.clone().cross(wq)), np.dot(wq)); rotBoneWorld(h.wr, axisQ(ax, ang * k)); }
    const n2 = palmN(h); const sw = new THREE.Quaternion().setFromUnitVectors(n2, want.clone().normalize()); const angS = 2 * Math.acos(Math.min(1, Math.abs(sw.w))); if (angS > 1e-4) { const lim = Math.min(1, 0.55 / angS); sw.slerp(new THREE.Quaternion(), 1 - lim * k); rotBoneWorld(h.wr, sw); }
  }
  function setFingers(h, ext, k) { // ext[i] 1 = straight (bind), 0 = curled; blended over the animated pose by k
    if (k <= 0.001) return; const ac = wp(h.i1).sub(wp(h.p1)).normalize(), fd = wp(h.m1).sub(wp(h.wr)).normalize(); const CURL = [1.3, 1.4, 0.8];
    h.f.forEach((chain, i) => chain.forEach((b, j) => { const qc = b.quaternion.clone(); b.quaternion.copy(h.bindQ.get(b)); b.updateMatrixWorld(true); rotBoneWorld(b, axisQ(ac, h.curlSign * CURL[j] * (1 - ext[i]) + h.curlSign * 0.08 * ext[i])); const qt = b.quaternion.clone(); b.quaternion.copy(qc).slerp(qt, k); b.updateMatrixWorld(true); }));
    h.th.forEach((b, j) => { const qc = b.quaternion.clone(); b.quaternion.copy(h.bindQ.get(b)); b.updateMatrixWorld(true); rotBoneWorld(b, axisQ(fd, h.thSign * (j === 0 ? 0.5 : 0.6) * (1 - ext[4]))); const qt = b.quaternion.clone(); b.quaternion.copy(qc).slerp(qt, k); b.updateMatrixWorld(true); });
  }
  function actEp(s, o, t) {
    const a = actors[s], layer = layers[s], lat = a.lateral(), F = a.facing(), up = V3(0, 1, 0); const sp = speakerAt(t), isSp = sp === s;
    const lip = lipBy[s](t); const speak = lip ? lip.speak : 0; const G = gBy[s]; const act = G.map(g => [g, envOf(g, t)]).filter(x => x[1] > 0);
    const eE = emotionState(emo[s], t);
    // ---- body: breath, talk sway, lean in/back, shoulder bounce, deflate ----
    let lean = 0, chestB = 0, shrug = 0, headBack = 0;
    for (const [g, e] of act) {
      if (g.kind === "lean_in") lean += 0.13 * e; else if (g.kind === "lean_back") lean -= 0.08 * e; else if (g.kind === "head_back") { lean -= 0.05 * e; headBack += 0.16 * e; }
      else if (g.kind === "deflate") { lean += 0.07 * e; shrug -= 0.5 * e; }
      else if (g.kind === "shoulder_bounce") { const k = Math.abs(Math.sin(2 * Math.PI * 3.0 * (t - g.t + g.rise))); chestB += 0.035 * e * k; shrug += 0.8 * e * k; }
    }
    const breath = 0.012 * Math.sin(t * 1.55 + (s === "A" ? 0 : 1.3));
    rotBoneWorld(a.B("Abdomen") ?? a.B("Torso"), axisQ(lat, a.nodSign * (lean * 0.5)));
    rotBoneWorld(a.B("Torso"), axisQ(lat, a.nodSign * (lean * 0.5 + 0.03 + (isSp ? 0.015 * Math.sin(t * 1.3) : 0.008 * Math.sin(t * 0.7)))));
    rotBoneWorld(a.B("Chest"), axisQ(lat, a.nodSign * (breath - chestB))); if (isSp) rotBoneWorld(a.B("Chest"), axisQ(up, 0.03 * Math.sin(t * 0.8 + 1)));
    const H = HANDS[s]; if (shrug) for (const sd of ["L", "R"]) { const h = H[sd]; if (h?.sh) rotBoneWorld(h.sh, axisQ(F, h.shrugSign * 0.09 * shrug)); }
    // ---- arms: IK to chest-frame targets, palm orientation, fingers ----
    const chest = wp(a.B("Chest")); const toO = anchors[o].head.clone().sub(a.head.getWorldPosition(V3())).setY(0).normalize();
    const per = {}; // side -> [spec, env, g]
    for (const [g, e] of act) { const sp_ = ARM[g.kind]; if (!sp_) continue; const sides = sp_.hands === "both" ? ["L", "R"] : [NEAR[s]]; for (const sd of sides) if (!per[sd] || per[sd][1] < e) per[sd] = [sp_, e * (sp_.amt ?? 1), g]; }
    for (const [sd, [spec, e, g]] of Object.entries(per)) {
      const h = H[sd]; if (!h?.ok || e < 0.002) continue; const out = sd === "L" ? lat.clone() : lat.clone().negate();
      const W0 = wp(h.wr); let T = chest.clone().addScaledVector(F, spec.f).addScaledVector(up, spec.u).addScaledVector(out, spec.o);
      if (spec.press) T.addScaledVector(up, -spec.press * sstep(g.t, g.t + g.dur, t));
      if (g.kind === "flick") T.addScaledVector(toO, 0.05 * bump(t - g.t, 0.35));
      ik2(h, W0.clone().lerp(T, e));
      const want = spec.palm === "up" ? up.clone().addScaledVector(F, 0.3) : spec.palm === "down" ? up.clone().negate().addScaledVector(F, 0.15) : spec.palm === "fwd" ? F.clone().addScaledVector(up, 0.5) : spec.palm === "back" ? F.clone().negate() : toO.clone().addScaledVector(up, 0.15);
      orientPalm(h, want.normalize(), e);
      let ext = spec.fing; if (g.kind === "count") { const n = g.marks.reduce((c, m) => c + sstep(m - 0.1, m + 0.04, t), 0); ext = [Math.min(1, n), Math.min(1, Math.max(0, n - 1)), Math.min(1, Math.max(0, n - 2)), 0, 0]; }
      setFingers(h, ext, e);
    }
    // ---- head: look at the partner (or the fire), emotion head pose, nods / shakes / tilts ----
    let gz = 0; for (const z of gazeBy[s]) gz = Math.max(gz, sstep(z.t0 - 0.2, z.t0 + 0.25, t) * (1 - sstep(z.t1, z.t1 + 0.4, t)));
    const oh = anchors[o].head; const tgt = oh.clone().lerp(firePt, gz); a.lookAt(tgt, 1.0, a.maxYawDeg ?? 55, 30);
    let nodA = eE.nod + (isSp ? 0.022 * Math.sin(t * 2.1) * speak : 0) - headBack, yawA = 0, rollA = eE.roll + 0.035 * Math.sin(t * (isSp ? 0.55 : 0.45) + (s === "A" ? 0.7 : 2)), browAdd = 0;
    for (const [g, e] of act) {
      const x = t - (g.t - g.rise), L = g.rise + g.dur;
      if (g.kind === "nod") nodA += 0.2 * Math.pow(Math.sin(Math.PI * Math.min(1, Math.max(0, x / L))), 2);
      else if (g.kind === "slow_nod") nodA += 0.15 * Math.pow(Math.sin(Math.PI * Math.min(1, Math.max(0, x / L))), 2);
      else if (g.kind === "head_shake") yawA += 0.14 * e * Math.sin(2 * Math.PI * (t - g.t) / 0.4);
      else if (g.kind === "tilt") rollA += 0.13 * e * (s === "A" ? 1 : -1);
      else if (g.kind === "brows_up") browAdd += 0.7 * e;
      else if (ARM[g.kind]) browAdd += 0.25 * e;
    }
    a.nodS(nodA); a.yawHead(yawA); a.roll(rollA);
    // ---- face ----
    const g0 = a.gazeOffset(tgt); const k = 0.018;
    layer.apply({ m: eE.m, lip, up: eE.up, lo: eE.lo, tilt: eE.tilt, br: eE.br + browAdd, bi: eE.bi, bL: eE.bL, bR: eE.bR, blink: a.blinkAmt(t),
      gx: THREE.MathUtils.clamp(k * g0.x + 0.003 * Math.sin(t * (isSp ? 1.1 : 0.9) + (s === "A" ? 0 : 2)), -0.009, 0.009), gy: THREE.MathUtils.clamp(k * g0.y - 0.004 * gz + 0.0015 * Math.sin(t * 0.7), -0.007, 0.006) });
  }
  // engine-side state for the gates: active preset, distance of the live face state to that preset, root/hips positions
  function epState(t) {
    const r = {}; for (const s of ["A", "B"]) { const a = actors[s]; const p = presetAt(emo[s], t); const live = emoAt(emo[s], t); r[s] = { preset: p.name, w: p.w, since: p.since, dist: +emoDist(live, emoPreset(p.name, p.w)).toFixed(4), root: a.ch.root.getWorldPosition(V3()).toArray().map(v => +v.toFixed(5)), hips: wp(a.B("Hips")).toArray().map(v => +v.toFixed(5)), speaker: speakerAt(t) === s }; }
    return r;
  }

  // ----- camera rigs (STYLE-GUIDE 5, PLAN 10d) -----
  const dir = (yawRad) => V3(Math.sin(yawRad), 0, Math.cos(yawRad));
  const lensFov = (mm, ar) => ar >= 1 ? 2 * Math.atan2(18 * (1 / ar), mm) : 2 * Math.atan2(18, mm);
  const RG = set.rig ?? {};
  const RIGS = {
    mcu(sp, ar, strip) { const A = anchors[sp]; let camYaw = sp === "A" ? A.yaw - 0.55 : A.yaw + 0.55; if (RG.mcuPartner) { const P = anchors[sp === "A" ? "B" : "A"].head, h0 = A.head; const py = Math.atan2(P.x - h0.x, P.z - h0.z); camYaw = sp === "A" ? py - RG.mcuPartner : py + RG.mcuPartner; } const mm = strip ? 38 : 45;
      const h = A.head; const fovr = lensFov(mm, ar); const dist = (strip ? 0.46 : ar >= 1 ? 0.42 : 0.56) / Math.tan(fovr / 2); const pos = h.clone().add(dir(camYaw).multiplyScalar(dist)); pos.y = h.y - 0.07; const tgt = h.clone(); tgt.y = h.y + 0.0;
      return { pos, tgt, mm, focusOn: h, dof: { aperture: 0.0045, maxblur: 0.016 } }; },
    ots(sp, ar) { const lis = sp === "A" ? "B" : "A"; const Lh = anchors[lis], S = anchors[sp]; const sgn = lis === "B" ? 1 : -1;
      const span = RG.otsSpan ?? Math.hypot(S.head.x - Lh.head.x, S.head.z - Lh.head.z);
      const mm = RG.otsMM ? (ar >= 1.5 ? RG.otsMM[0] : ar >= 1 ? RG.otsMM[1] : RG.otsMM[2]) : ar >= 1.5 ? 110 : ar >= 1 ? 78 : 65; const vfov = lensFov(mm, ar), ha = Math.atan(Math.tan(vfov / 2) * ar), b = RG.otsBack ?? 1.5;
      let lat = 0.3; for (let i = 0; i < 80; i++) { if (Math.atan2(lat, b) - Math.atan2(lat, b + span) >= 1.2 * ha) break; lat += 0.02; }
      const oc = RG.otsCam; const pos = Lh.head.clone().add(oc ? V3(sgn * oc[0], oc[2], oc[1]) : V3(sgn * b, 0.25, lat)); const dS = S.head.clone().sub(pos).setY(0), d = dS.length(); dS.normalize(); const dL = Lh.head.clone().sub(pos).setY(0).normalize();
      const sg = Math.sign(dS.clone().cross(dL).y) || 1; const aim = dS.clone().applyAxisAngle(V3(0, 1, 0), sg * 0.4 * ha);
      const tgt = pos.clone().add(aim.multiplyScalar(5)); const yAt = S.head.y - 0.3 * Math.tan(vfov / 2) * d; tgt.y = pos.y + (yAt - pos.y) * (5 / d);
      return { pos, tgt, mm, focusOn: S.head, dof: { aperture: 0.0022, maxblur: 0.010 }, ...(set.otsFX ?? {}), rimDir: V3(sgn * 0.7, 0.8, 0.9), rimI: L.rimOTS ?? 3.0 }; },
    wide2(sp, ar) { return set.wide2(ar, anchors); },
    seat(sp, ar) { const h = anchors[sp].head; return { pos: V3(h.x, 0.6, 2.4), tgt: V3(h.x, 0.5, 0), mm: 40, focusOn: null }; },
    // MS (waist up) of the speaker, from the partner's side like mcu, face at ~40 % from the top (clear of the 26 % caption band)
    ms(sp, ar) { const A = anchors[sp], h = A.head; const P = anchors[sp === "A" ? "B" : "A"].head; const py = Math.atan2(P.x - h.x, P.z - h.z); const off = RG.msAngle ?? 0.62; const camYaw = sp === "A" ? py - off : py + off;
      const mm = ar >= 1 ? 35 : 40; const half = ar >= 1 ? 0.5 : 0.58; const fovr = lensFov(mm, ar); const vhalf = ar >= 1 ? Math.tan(fovr / 2) : Math.tan(fovr / 2); const dist = half / vhalf;
      const tgt = h.clone(); tgt.y = h.y + 0.02; const pos = tgt.clone().add(dir(camYaw).multiplyScalar(dist)); pos.y = h.y - 0.08;
      return { pos, tgt, mm, focusOn: h, dof: { aperture: 0.003, maxblur: 0.012 } }; },
    insert(sp, ar) { return set.insert(ar, anchors); },
    // ---- episode-only rigs (used when rigCamera gets a shot move; legacy/hero jobs never reach them) ----
    // OTS: speaker is the subject (35-45 % of frame height, head near the upper third); camera high behind the listener's
    // camera-side shoulder so the fire drops to the lower edge/corner; listener hair = slim left/right edge foreground.
    otsEp(sp, ar) { const lis = sp === "A" ? "B" : "A"; const Lh = anchors[lis].head, S = anchors[sp].head; const P = { back: 0.7, lat: 1.25, up: 0.85, mm: 50, aimY: -0.42, aimLat: 0.0, ...(RG.otsEp ?? {}), ...(globalThis.__otsEp ?? {}) };
      const dS = S.clone().sub(Lh).setY(0).normalize(); const side = V3(-dS.z, 0, dS.x); if (side.z < 0) side.negate(); // toward the camera side (+z)
      const pos = Lh.clone().addScaledVector(dS, -P.back).addScaledVector(side, P.lat); pos.y += P.up; const tgt = S.clone().addScaledVector(side, P.aimLat); tgt.y += P.aimY;
      return { pos, tgt, mm: P.mm, focusOn: S, dof: { aperture: 0.0022, maxblur: 0.010 }, hideFlame: true, fireScale: P.fireScale ?? 0.3, rimDir: V3((lis === "B" ? 1 : -1) * 0.7, 0.8, 0.9), rimI: L.rimOTS ?? 3.0, bloom: P.bloom }; },
    // MCU inside the 9:16 stack panel (landscape-ish): face ~30 % of panel height, eyes at ~1/3 from the top
    mcuEp(sp, ar, strip) { const r = RIGS.mcu(sp, ar, strip); if (ar < 1) return r; const h = anchors[sp].head; const fovr = lensFov(r.mm, ar); const half = 0.36; const eyes = h.y + 0.09;
      const tgt = h.clone(); tgt.y = eyes - (0.5 - 1 / 3) * 2 * half; const d0 = r.pos.clone().sub(r.tgt).setY(0).normalize(); const pos = tgt.clone().addScaledVector(d0, half / Math.tan(fovr / 2)); pos.y = eyes - 0.08; const R = new THREE.Vector3().crossVectors(d0.clone().negate(), new THREE.Vector3(0, 1, 0)).normalize(), sh = RG.mcuEpShift ?? 0.09; tgt.addScaledVector(R, sh); pos.addScaledVector(R, sh); return { ...r, pos, tgt }; },   // pan (not turn) toward the face: the head anchor sits behind the face, so a 3/4 face was cut at the panel edge

    // ================= camera-variety rigs (additive; the rigs above are untouched) =================
    // low_fire_A/B: low camera across the fire (between the fire and the partner), flames soft + out of focus in the foreground, speaker MCU/MS looking up slightly
    lowfire(sp, ar) { const A = anchors[sp], h = A.head, P = anchors[sp === "A" ? "B" : "A"].head; const py = Math.atan2(P.x - h.x, P.z - h.z); const o = RG.lowFire ?? {}; const off = o.off ?? 0.24, d = o.d ?? 2.7, half = o.half ?? (ar >= 1 ? 0.5 : 0.62);
      const mm = (ar >= 1 ? 18 / ar : 18) * d / half; const camYaw = sp === "A" ? py - off : py + off; const pos = h.clone().add(dir(camYaw).multiplyScalar(d)); pos.y = TH(pos.x, pos.z) + (o.cy ?? 0.3); const tgt = h.clone(); tgt.y = h.y - (ar >= 1 ? 0.06 : 0.22);
      return { pos, tgt, mm, focusOn: h, dof: { aperture: 0.006, maxblur: 0.02 }, fireScale: o.fireScale ?? 0.3, bloom: o.bloom ?? 0.4 }; },
    // high34: high three-quarter, both actors from above (pair rig)
    high34(sp, ar) { const c = anchors.A.head.clone().add(anchors.B.head).multiplyScalar(0.5); const o = RG.high34 ?? {}; const mm = ar >= 1 ? 30 : 24; const d = (o.halfW ?? (ar >= 1 ? 2.9 : 2.7)) / (Math.tan(lensFov(mm, ar) / 2) * ar); const az = o.az ?? 0.55, el = o.el ?? 0.50;
      const pos = c.clone().add(V3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)).multiplyScalar(d)); const tgt = c.clone(); tgt.y += o.aimY ?? (ar >= 1 ? -0.25 : -0.9); return { pos, tgt, mm, focusOn: c, dof: { aperture: 0.0022, maxblur: 0.010 } }; },
    // profile2: low side-profile two-shot, long lens, fire between them (pair rig)
    profile2(sp, ar) { const c = anchors.A.head.clone().add(anchors.B.head).multiplyScalar(0.5); const o = RG.profile2 ?? {}; const mm = ar >= 1 ? 42 : 30; const d = (o.halfW ?? (ar >= 1 ? 2.7 : 2.55)) / (Math.tan(lensFov(mm, ar) / 2) * ar); const az = o.az ?? -0.34;
      const pos = c.clone().add(V3(Math.sin(az) * d, 0, Math.cos(az) * d)); pos.y = TH(pos.x, pos.z) + (o.cy ?? 0.6); const tgt = c.clone(); tgt.y += o.aimY ?? (ar >= 1 ? -0.1 : -0.55); return { pos, tgt, mm, focusOn: c, dof: { aperture: 0.0022, maxblur: 0.010 } }; },
    // tent_wide: wide from behind the glowing tent, tent as a dark foreground mass, the pair small around the fire (pair rig)
    tentwide(sp, ar) { const c = anchors.A.head.clone().add(anchors.B.head).multiplyScalar(0.5); const o = RG.tentWide ?? {}; const mm = ar >= 1 ? 30 : 26; const az = o.az ?? -2.05, d = o.d ?? 9.4;
      const pos = c.clone().add(V3(Math.sin(az) * d, 0, Math.cos(az) * d)); pos.y = TH(pos.x, pos.z) + (o.cy ?? 1.9); const tgt = c.clone(); tgt.y += o.aimY ?? (ar >= 1 ? -0.1 : -0.6); return { pos, tgt, mm, focusOn: c, dof: { aperture: 0.0016, maxblur: 0.008 } }; },
    // arc_A/B: speaker MS, the camera sweeps ~12 degrees around the speaker over the shot (u)
    arc(sp, ar, strip, e) { const A = anchors[sp], h = A.head; const P = anchors[sp === "A" ? "B" : "A"].head; const py = Math.atan2(P.x - h.x, P.z - h.z); const o = RG.arc ?? {}; const off = (o.off0 ?? 1.0) + (o.sweep ?? 0.21) * e; const camYaw = sp === "A" ? py - off : py + off;
      const mm = ar >= 1 ? 35 : 40; const half = ar >= 1 ? 0.5 : 0.56; const dist = half / Math.tan(lensFov(mm, ar) / 2); const tgt = h.clone(); tgt.y = h.y + 0.02; const pos = tgt.clone().add(dir(camYaw).multiplyScalar(dist)); pos.y = h.y - 0.04;
      return { pos, tgt, mm, focusOn: h, dof: { aperture: 0.003, maxblur: 0.012 } }; },
    // slow_push_A/B: far (knees/waist up) to close MCU over the shot, for punchlines
    slowpush(sp, ar, strip, e) { const A = anchors[sp], h = A.head; const P = anchors[sp === "A" ? "B" : "A"].head; const py = Math.atan2(P.x - h.x, P.z - h.z); const o = RG.slowPush ?? {}; const off = o.off ?? 0.92; const camYaw = sp === "A" ? py - off : py + off;
      const mm = ar >= 1 ? 35 : 40; const far = o.far ?? (ar >= 1 ? 0.95 : 1.05), near = o.near ?? (ar >= 1 ? 0.30 : 0.40); const half = far * Math.pow(near / far, e); const dist = half / Math.tan(lensFov(mm, ar) / 2);
      const tgt = h.clone(); tgt.y = h.y + (ar >= 1 ? -0.1 * (1 - e) : -0.22 + 0.32 * e); const pos = tgt.clone().add(dir(camYaw).multiplyScalar(dist)); pos.y = h.y - 0.06 - 0.2 * (1 - e); return { pos, tgt, mm, focusOn: h, dof: { aperture: 0.0035, maxblur: 0.014 } }; },
  };
  const rigNames = { mcu_A: ["mcu", "A"], mcu_B: ["mcu", "B"], ots_A: ["ots", "A"], ots_B: ["ots", "B"], wide2: ["wide2", "A"], insert: ["insert", "A"], insert_fire: ["insert", "A"], seat_A: ["seat", "A"], seat_B: ["seat", "B"], ms_A: ["ms", "A"], ms_B: ["ms", "B"],
    low_fire_A: ["lowfire", "A"], low_fire_B: ["lowfire", "B"], high34: ["high34", "A"], profile2: ["profile2", "A"], tent_wide: ["tentwide", "A"], arc_A: ["arc", "A"], arc_B: ["arc", "B"], slow_push_A: ["slowpush", "A"], slow_push_B: ["slowpush", "B"] };
  const PAIR_RIGS = ["wide2", "high34", "profile2", "tent_wide"];
  function rigCamera(name, ar, u = 0, strip = false, move = null) {
    const [k0, sp] = rigNames[name]; const k = move ? (k0 === "ots" ? "otsEp" : k0 === "mcu" ? "mcuEp" : k0) : k0; const e = sineIO(u); const r = RIGS[k](sp, ar, strip, e); const pos = r.pos.clone(), tgt = r.tgt.clone();
    const toT = tgt.clone().sub(pos); const right = V3(0, 1, 0).cross(toT.clone().normalize().multiplyScalar(-1)).normalize();
    if (!move) { pos.addScaledVector(toT, 0.04 * e); pos.addScaledVector(right, 0.03 * (e - 0.5)); } // legacy test timeline: push 4 % + 3 cm drift
    else if (move.type === "push") pos.addScaledVector(toT, (move.amt ?? 0.03) * e);
    return { bloom: r.bloom, hideFlame: r.hideFlame, fireScale: r.fireScale, rimDir: r.rimDir, rimI: r.rimI, pos, tgt, mm: r.mm, fov: THREE.MathUtils.radToDeg(lensFov(r.mm, ar)), focus: r.focusOn ? pos.distanceTo(r.focusOn) : null, dof: r.dof };
  }
  // foreground dressing per rig: out-of-focus props near camera (visible only when that rig is active)
  const fgGroups = {};
  const kindOf = name => name === "wide2" ? "wide2" : name.startsWith("seat") ? "seat" : name.startsWith("ms_") ? "ms" : name.startsWith("ots") ? "ots" : name.startsWith("insert") ? "insert" : "mcu";
  async function fgFor(name, ar) {
    const key2 = name + (ar >= 1 ? "L" : "P"); if (fgGroups[key2]) return fgGroups[key2];
    const g = new THREE.Group(); g.visible = false; scene.add(g); fgGroups[key2] = g; const c = rigCamera(name, ar, 0); const fwd = c.tgt.clone().sub(c.pos).setY(0).normalize(); const right = fwd.clone().cross(V3(0, 1, 0)).normalize();
    const vfov = c.fov * Math.PI / 180; const rr2 = rng(77 + name.length);
    const specs = (set.fg ?? {})[kindOf(name)] ?? [];
    for (const [url, hh, d, lat] of specs) {
      const o = normP(toonifyP((await loadFBX(url)), "nat"), 1); const dd = d; const topY = c.pos.y + (-0.6) * dd * Math.tan(vfov / 2) * (ar >= 1 ? 0.5 : 1); const H = name === "wide2" ? hh : Math.max(0.3, Math.min(hh, topY));
      const sc = H; o.scale.setScalar(sc); const p = c.pos.clone().addScaledVector(fwd, dd).addScaledVector(right, lat * (ar >= 1 ? 1 : 0.35)); o.position.set(p.x, TH(p.x, p.z), p.z); o.rotation.y = rr2() * 6.28; g.add(o); }
    g.traverse(m => { if (m.isMesh) { const mats = [].concat(m.material).map(mm => { const c2 = mm.clone(); if (c2.color) c2.color.multiplyScalar(name === "wide2" ? (set.fgDim?.wide2 ?? 0.9) : (set.fgDim?.other ?? 0.55)); return c2; }); m.material = Array.isArray(m.material) ? mats : mats[0]; mats.forEach(mm => { if (!(mm instanceof THREE.MeshBasicMaterial)) addSway(mm, U, 0.3, 120); }); } });
    return g;
  }
  async function prepFG(names, ars) { for (const n of names) for (const ar of ars) await fgFor(n, ar); }
  function showFG(name, ar) { for (const [k, g] of Object.entries(fgGroups)) g.visible = (k === name + (ar >= 1 ? "L" : "P")); }

  return { THREE, setWords, setEpisode, epState, setShot, scene, U, key, rim, faceFill, actors, pair, anchors, gate, gateFrame, update, rigCamera, prepFG, showFG, RIGS, rigNames, PAIR_RIGS, fgGroups, seatObjs, stress, nods, TH, life, set, setEmotion: (s, tl) => { emo[s] = tl; }, camFar: set.camFar ?? 400, sharedInfo };
}

// ---------------- renderer + post (bloom on emissive, DOF, grain, vignette) ----------------
export function makeRenderer(w, h) {
  const r = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true }); r.setPixelRatio(1); r.setSize(w, h);
  r.toneMapping = THREE.NeutralToneMapping; r.toneMappingExposure = 1.0; r.outputColorSpace = THREE.SRGBColorSpace;
  r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap; r.shadowMap.autoUpdate = false; return r;
}
export function makePost(renderer, scene, camera, w, h) {
  const bl = new THREE.Layers(); bl.set(BLOOM_LAYER); const black = new THREE.MeshBasicMaterial({ color: 0x000000 }); const blackPts = new THREE.PointsMaterial({ color: 0x000000, size: 0 }); const stash = new Map(); const hid = [];
  const bloomComposer = new EffectComposer(renderer); bloomComposer.renderToScreen = false; bloomComposer.setSize(w, h);
  bloomComposer.addPass(new RenderPass(scene, camera)); const bloomPass = new UnrealBloomPass(new THREE.Vector2(w, h), 0.95, 0.6, 0.0); bloomComposer.addPass(bloomPass);
  const mix = new ShaderPass(new THREE.ShaderMaterial({ uniforms: { baseTexture: { value: null }, bloomTexture: { value: bloomComposer.renderTarget2.texture } },
    vertexShader: "varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
    fragmentShader: "uniform sampler2D baseTexture;uniform sampler2D bloomTexture;varying vec2 vUv;void main(){gl_FragColor=texture2D(baseTexture,vUv)+texture2D(bloomTexture,vUv);}" }), "baseTexture");
  const fin = new EffectComposer(renderer); fin.setSize(w, h); fin.addPass(new RenderPass(scene, camera));
  const bokeh = new BokehPass(scene, camera, { focus: 2, aperture: 0.004, maxblur: 0.015 }); fin.addPass(bokeh); fin.addPass(mix); fin.addPass(new OutputPass());
  const grain = new ShaderPass(new THREE.ShaderMaterial({ uniforms: { tDiffuse: { value: null }, uSeed: { value: 0 }, uAmt: { value: 0.022 }, uVig: { value: 0.32 } },
    vertexShader: "varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
    fragmentShader: `uniform sampler2D tDiffuse;uniform float uSeed,uAmt,uVig;varying vec2 vUv;
    float hash(vec2 p){ p = fract(p*vec2(443.897,441.423)+uSeed*0.137); p += dot(p,p.yx+19.19); return fract((p.x+p.y)*p.x); }
    void main(){ vec4 c = texture2D(tDiffuse,vUv); float g = hash(vUv*vec2(1731.0,977.0))-0.5; c.rgb += g*uAmt; vec2 d = vUv-0.5; float v = smoothstep(0.35,0.95,length(d*vec2(1.0,1.15))); c.rgb *= 1.0 - uVig*v; gl_FragColor = c; }` }));
  fin.addPass(grain);
  return { w, h, bokeh, grain,
    render({ dof = null, seed = 0, bloom = null } = {}) {
      bloomPass.strength = bloom ?? 0.95; bokeh.enabled = !!dof; if (dof) { bokeh.uniforms.focus.value = dof.focus; bokeh.uniforms.aperture.value = dof.aperture; bokeh.uniforms.maxblur.value = dof.maxblur; }
      grain.uniforms.uSeed.value = seed % 997;
      const bg = scene.background, fog = scene.fog; scene.background = new THREE.Color(0x000000); scene.fog = null;
      scene.traverse(o => { if (o.userData.bloomHide) { hid.push(o); o.visible = false; return; } if ((o.isMesh || o.isPoints) && !bl.test(o.layers)) { stash.set(o, o.material); o.material = o.isPoints ? blackPts : black; } });
      bloomComposer.render(); stash.forEach((m, o) => { o.material = m; }); stash.clear(); hid.forEach(o => { o.visible = true; }); hid.length = 0; scene.background = bg; scene.fog = fog; fin.render();
    } };
}
