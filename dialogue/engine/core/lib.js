// DIALOGUE spike0 engine: load/assemble modular cast, toon look, campfire light, retarget, face parts, props.
// Nothing is modelled here: only loaded, assembled, recoloured, hidden, placed, lit. Deterministic (seeded).
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { FBXLoader } from "three/addons/loaders/FBXLoader.js";
import * as SU from "three/addons/utils/SkeletonUtils.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

export { THREE };
export const PAL = { sky: "#0E1621", farTrees: "#16242F", mid: "#22343A", fire: "#F2A03D", ember: "#D65F2A", moon: "#8FA9BF", skinHi: "#F6C98B" };
const RAW = "/raw/";
const D = { men: RAW + "drive-download-20261109T120706Z-1-001/Individual Characters/glTF/", women: RAW + "drive-download-20261109T121901Z-1-001/Individual Characters/glTF/",
  nature: RAW + "drive-download-20261109T120814Z-1-001/FBX/", survival: RAW + "drive-download-20261109T121926Z-1-001/FBX/", build: RAW + "drive-download-20261109T122046Z-1-001/Models with Materials/FBX/",
  ual: RAW + "Universal_Animation_Library_Standard_/Universal Animation Library[Standard]/Unreal-Godot/UAL1_Standard.glb" };
export const log = (...a) => console.log(...a);
export function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

const gl = new GLTFLoader(), fbx = new FBXLoader();

// ---------- toon ----------
const ramp = (() => { const d = new Uint8Array([46, 140, 255]); const t = new THREE.DataTexture(d, 3, 1, THREE.RedFormat); t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true; return t; })();
export function toon(color, extra = {}) { const m = new THREE.MeshToonMaterial({ color: new THREE.Color(color), gradientMap: ramp, ...extra }); m.flatShading = true; return m; }

// ---------- renderer / post ----------
export function makeRenderer(w, h) {
  const r = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  r.setPixelRatio(1); r.setSize(w, h); r.toneMapping = THREE.NoToneMapping; r.outputColorSpace = THREE.SRGBColorSpace;
  document.body.appendChild(r.domElement); return r;
}
export const BLOOM_LAYER = 1;
// selective bloom: only objects on BLOOM_LAYER glow (the fire). Everything else is blacked out in the bloom pass.
export function makePost(renderer, scene, camera, w, h, strength = 1.1) {
  const bl = new THREE.Layers(); bl.set(BLOOM_LAYER);
  const black = new THREE.MeshBasicMaterial({ color: 0x000000 }); const stash = new Map();
  const bloomComposer = new EffectComposer(renderer); bloomComposer.renderToScreen = false; bloomComposer.setSize(w, h);
  bloomComposer.addPass(new RenderPass(scene, camera));
  const bloomPass = new UnrealBloomPass(new THREE.Vector2(w, h), strength, 0.55, 0.0); bloomComposer.addPass(bloomPass);
  const mix = new ShaderPass(new THREE.ShaderMaterial({ uniforms: { baseTexture: { value: null }, bloomTexture: { value: bloomComposer.renderTarget2.texture } },
    vertexShader: "varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
    fragmentShader: "uniform sampler2D baseTexture;uniform sampler2D bloomTexture;varying vec2 vUv;void main(){gl_FragColor=texture2D(baseTexture,vUv)+texture2D(bloomTexture,vUv);}" }), "baseTexture");
  const finalComposer = new EffectComposer(renderer); finalComposer.setSize(w, h);
  finalComposer.addPass(new RenderPass(scene, camera)); finalComposer.addPass(mix); finalComposer.addPass(new OutputPass());
  return { setSize(w2, h2) { bloomComposer.setSize(w2, h2); finalComposer.setSize(w2, h2); },
    render() {
      const bg = scene.background, fog = scene.fog; scene.background = new THREE.Color(0x000000); scene.fog = null;
      scene.traverse(o => { if ((o.isMesh || o.isPoints) && !bl.test(o.layers)) { stash.set(o, o.material); o.material = black; } });
      bloomComposer.render();
      stash.forEach((m, o) => { o.material = m; }); stash.clear(); scene.background = bg; scene.fog = fog;
      finalComposer.render();
    } };
}

// ---------- campfire lighting (STYLE-GUIDE §1-2) ----------
// warm fire key from low front-side, cool moon rim from behind, one tiny sky fill so shadows are never pure black, fog to sky colour.
export function campfireRig(scene, firePos = new THREE.Vector3(0, 0.55, 0), t = 0, o = {}) {
  scene.background = new THREE.Color(PAL.sky);
  scene.fog = new THREE.Fog(PAL.sky, o.fogNear ?? 7, o.fogFar ?? 34);
  const key = new THREE.PointLight(PAL.fire, 1, 0, 1.6); key.position.copy(firePos); key.name = "fireKey"; scene.add(key);
  const rim = new THREE.DirectionalLight(PAL.moon, 2.4); rim.position.copy(o.moonDir ?? new THREE.Vector3(-3, 6, -7)); rim.name = "moonRim"; scene.add(rim); scene.add(rim.target);
  const fill = new THREE.HemisphereLight(0x2a3b4d, 0x15202a, 0.55); fill.name = "skyFill"; scene.add(fill);
  const r = rng(7); const ph = [r() * 6.28, r() * 6.28, r() * 6.28];
  const flick = tt => 1 + 0.07 * Math.sin(tt * 9 + ph[0]) + 0.05 * Math.sin(tt * 17 + ph[1]) + 0.035 * Math.sin(tt * 31 + ph[2]);
  const base = o.keyIntensity ?? 17;
  const api = { key, rim, fill, update(tt) { const f = flick(tt); key.intensity = base * f; key.color.set(PAL.fire).lerp(new THREE.Color(PAL.ember), Math.max(0, 1 - f) * 2.2); } };
  api.update(t); return api;
}
export function groundDisc(scene, radius = 40, color = PAL.mid) {
  const g = new THREE.Mesh(new THREE.CircleGeometry(radius, 24), toon(color)); g.rotation.x = -Math.PI / 2; g.name = "ground"; scene.add(g); return g;
}

// ---------- props ----------
const propCache = new Map();
export async function loadFBX(url) { if (!propCache.has(url)) propCache.set(url, await fbx.loadAsync(url)); return SU.clone(propCache.get(url)); }
const FIRE_MATS = /^(fire|flame)/i;
export function toonify(obj, { recolor = {} } = {}) {
  obj.traverse(o => {
    if (!o.isMesh) return;
    const ms = Array.isArray(o.material) ? o.material : [o.material]; let glow = false;
    const out = ms.map(m => {
      const c = new THREE.Color(recolor[m.name] ?? (m.color ? "#" + m.color.getHexString() : "#888888"));
      if (FIRE_MATS.test(m.name)) { glow = true; const b = new THREE.MeshBasicMaterial({ color: new THREE.Color(PAL.fire).multiplyScalar(1.7) }); b.name = m.name; return b; }
      const t = toon(c); t.name = m.name; return t;
    });
    o.material = Array.isArray(o.material) ? out : out[0]; if (glow) o.layers.enable(BLOOM_LAYER);
  });
  return obj;
}
export function bbox(o) { o.updateMatrixWorld(true); return new THREE.Box3().setFromObject(o); }
// wrap: re-origin to bottom-centre, scale to target height (or uniform scale), returns Group
export function normProp(obj, { height, scale, lengthAxis } = {}) {
  const b = bbox(obj); const s = new THREE.Vector3(); b.getSize(s);
  const k = scale ?? (height ? height / s.y : 1); const g = new THREE.Group(); g.add(obj); obj.scale.multiplyScalar(k); obj.updateMatrixWorld(true);
  const b2 = bbox(obj), c = new THREE.Vector3(); b2.getCenter(c); obj.position.x -= c.x; obj.position.z -= c.z; obj.position.y -= b2.min.y; g.userData.size = s.multiplyScalar(k); g.userData.k = k; return g;
}
export const PROP_HEIGHTS = { PineTree: 9, CommonTree: 7.5, Rock: 0.7, Rock_Moss: 0.8, TreeStump_Moss: 0.5, WoodLog: 0.45, WoodLog_Moss: 0.45, Bush: 0.9, Grass: 0.45, Flowers: 0.4, Tent: 1.7, Pot: 0.3, WoodenTorch_Fire: 1.6, Bonfire: 0.35 };

// ---------- characters ----------
const sanit = n => THREE.PropertyBinding.sanitizeNodeName(n);
function partNodes(root, suffixes) { const out = []; root.traverse(o => { if (suffixes.some(s => o.name.endsWith("_" + s))) out.push(o); }); return out; }
function skinned(o) { const a = []; o.traverse(m => { if (m.isSkinnedMesh) a.push(m); }); return a; }

export async function assemble(cfg, opts = {}) {
  const dir = D[cfg.pack];
  const bodyG = await gl.loadAsync(dir + cfg.body + ".gltf");
  const headG = cfg.head === cfg.body ? bodyG : await gl.loadAsync(dir + cfg.head + ".gltf");
  const root = bodyG.scene; const rep = { id: cfg.id, notes: [] };
  const bodyHeadNode = partNodes(root, ["Head"])[0];
  const refMesh = skinned(root)[0]; const skel = refMesh.skeleton;
  let headNode = bodyHeadNode;
  if (cfg.head !== cfg.body) {
    headNode = partNodes(headG.scene, ["Head"])[0];
    const hm = skinned(headNode)[0];
    let md = 0; for (let i = 0; i < skel.bones.length; i++) { const a = skel.boneInverses[i].elements, b = hm.skeleton.boneInverses[i].elements; for (let k = 0; k < 16; k++) md = Math.max(md, Math.abs(a[k] - b[k])); }
    rep.rigMaxInverseDiff = md; rep.notes.push(`head ${cfg.head} onto ${cfg.body} skeleton, max boneInverse diff ${md.toExponential(2)}`);
    const parent = bodyHeadNode.parent; parent.remove(bodyHeadNode);
    for (const m of skinned(headNode)) m.bind(skel, refMesh.bindMatrix.clone());
    headNode.parent?.remove(headNode); parent.add(headNode);
  }
  headNode.name = "HEAD_PART";
  // hide parts
  for (const n of cfg.hideNodes ?? []) root.traverse(o => { if (o.name === n) o.visible = false; });
  const heads = skinned(headNode);
  const hidden = [];
  for (const h of cfg.hide ?? []) for (const m of skinned(root)) if (m.material.name === h.material && (h.part !== "head" || heads.includes(m))) { m.visible = false; hidden.push(m); }
  // carve brows out of hair if the head has no brow primitive
  if (cfg.faceParts.browsCarve) {
    const c = cfg.faceParts.browsCarve; const hair = heads.find(m => m.material.name === c.fromMaterial);
    const g = hair.geometry, pos = g.attributes.position, idx = g.index.array; const keep = [], take = [];
    const inb = i => { const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i); return Math.abs(x) <= c.x && y >= c.y[0] && y <= c.y[1] && z >= c.z; };
    for (let i = 0; i < idx.length; i += 3) (inb(idx[i]) && inb(idx[i + 1]) && inb(idx[i + 2]) ? take : keep).push(idx[i], idx[i + 1], idx[i + 2]);
    rep.notes.push(`brow carve from ${c.fromMaterial}: ${take.length / 3} tris taken, ${keep.length / 3} kept`);
    if (take.length) {
      const bg = g.clone(); bg.setIndex(take); g.setIndex(keep);
      const bm = new THREE.SkinnedMesh(bg, hair.material.clone()); bm.material.name = "BrowsCarved"; bm.bind(skel, refMesh.bindMatrix.clone()); bm.frustumCulled = false; bm.name = "BrowsCarved";
      hair.parent.add(bm); heads.push(bm);
    }
  }
  // materials -> toon + palette overrides
  for (const m of skinned(root)) {
    m.frustumCulled = false; const nm = m.material.name; const col = cfg.colors[nm] ?? "#" + m.material.color.getHexString();
    const t = toon(col); t.name = nm; m.material = t;
  }
  // face parts
  const fp = cfg.faceParts; const eyes = heads.find(m => m.material.name === fp.eyes); const brows = heads.find(m => m.material.name === (fp.browsCarve ? "BrowsCarved" : fp.brows));
  rep.eyesSeparable = !!eyes; rep.browsSeparable = !!brows; rep.hiddenCount = hidden.length;
  const face = makeFace(eyes, brows);
  // bones
  const bones = {}; root.traverse(o => { if (o.isBone) bones[o.name] = o; });
  return { cfg, root, skel, bones, face, nativeClips: bodyG.animations, rep, heads, hidden };
}

function clusterSetup(mesh) {
  const pos = mesh.geometry.attributes.position; const orig = pos.array.slice(); const cl = [{ idx: [], cy: 0 }, { idx: [], cy: 0 }];
  for (let i = 0; i < pos.count; i++) cl[orig[i * 3] >= 0 ? 0 : 1].idx.push(i);
  for (const c of cl) { let mn = 1e9, mx = -1e9, x0 = 1e9, x1 = -1e9, zm = -1e9; for (const i of c.idx) { mn = Math.min(mn, orig[i * 3 + 1]); mx = Math.max(mx, orig[i * 3 + 1]); x0 = Math.min(x0, orig[i * 3]); x1 = Math.max(x1, orig[i * 3]); zm = Math.max(zm, orig[i * 3 + 2]); } c.cy = (mn + mx) / 2; c.h = mx - mn; c.cx = (x0 + x1) / 2; c.w = x1 - x0; c.zf = zm; c.y0 = mn; c.y1 = mx; }
  return { pos, orig, cl };
}
function makeFace(eyes, brows) {
  const E = eyes && clusterSetup(eyes), B = brows && clusterSetup(brows);
  const apply = (S, fn) => { for (const c of S.cl) for (const i of c.idx) { fn(S.orig, S.pos.array, i, c); } S.pos.needsUpdate = true; };
  return {
    eyes: !!E, brows: !!B, E, B, eyeMesh: eyes, browMesh: brows,
    // blink 0..1 (eye Y scaled about its centre), gx/gy eye translation, brow = both raise (m/0.016), bL/bR = extra raise per brow, bInner = inner-end up (+) / down (-) rotation
    set({ blink = 0, brow = 0, gx = 0, gy = 0, bL = 0, bR = 0, bInner = 0 } = {}) {
      if (E) { const s = 1 - 0.9 * blink; apply(E, (o, p, i, c) => { p[i * 3] = o[i * 3] + gx; p[i * 3 + 1] = c.cy + (o[i * 3 + 1] - c.cy) * s + gy; }); }
      if (B) { apply(B, (o, p, i, c) => { const side = c.cx >= 0 ? 1 : -1; const th = -side * bInner * 0.5; const dx = o[i * 3] - c.cx, dy = o[i * 3 + 1] - c.cy; const cs = Math.cos(th), sn = Math.sin(th); p[i * 3] = c.cx + dx * cs - dy * sn; p[i * 3 + 1] = c.cy + dx * sn + dy * cs + 0.016 * (brow + (side > 0 ? bL : bR)); }); }
    },
  };
}

// ---------- retarget UAL (UE mannequin) -> modular rig ----------
// [ual bone, modular bone, ual tip bone (for direction), modular tip bone]
export const BONE_MAP = (() => {
  const m = [["pelvis", "Hips", "spine_01", "Abdomen"], ["spine_01", "Abdomen", "spine_02", "Torso"], ["spine_02", "Torso", "spine_03", "Chest"], ["spine_03", "Chest", "neck_01", "Neck"],
    ["neck_01", "Neck", "Head", "Head"], ["Head", "Head", null, null],
    ["thigh_l", "UpperLeg.L", "calf_l", "LowerLeg.L"], ["calf_l", "LowerLeg.L", "foot_l", "Foot.L"], ["thigh_r", "UpperLeg.R", "calf_r", "LowerLeg.R"], ["calf_r", "LowerLeg.R", "foot_r", "Foot.R"],
    ["foot_l", "Foot.L", null, null], ["foot_r", "Foot.R", null, null]];
  for (const [s, S] of [["l", "L"], ["r", "R"]]) {
    m.push([`clavicle_${s}`, `Shoulder.${S}`, `upperarm_${s}`, `UpperArm.${S}`], [`upperarm_${s}`, `UpperArm.${S}`, `lowerarm_${s}`, `LowerArm.${S}`], [`lowerarm_${s}`, `LowerArm.${S}`, `hand_${s}`, `Wrist.${S}`],
      [`hand_${s}`, `Wrist.${S}`, `middle_01_${s}`, `Middle1.${S}`]);
    for (const [f, F] of [["index", "Index"], ["middle", "Middle"], ["ring", "Ring"], ["pinky", "Pinky"]]) {
      // modular rig: <F>1 = metacarpal (wrist -> knuckle, 12 cm, inside the palm), <F>2..4 = the three phalanges. The UE mannequin's <f>_01 is the
      // PROXIMAL PHALANX, so it drives <F>2 (not <F>1): mapping it onto the metacarpal bent each palm strand on its own and the hand read as
      // long stick fingers (cloud episode, 2026-11-10). <F>1 is left unmapped = stays at its rest pose (a rigid palm).
      m.push([`${f}_01_${s}`, `${F}2.${S}`, `${f}_02_${s}`, `${F}3.${S}`], [`${f}_02_${s}`, `${F}3.${S}`, `${f}_03_${s}`, `${F}4.${S}`], [`${f}_03_${s}`, `${F}4.${S}`, null, null]);
    }
    m.push([`thumb_01_${s}`, `Thumb1.${S}`, `thumb_02_${s}`, `Thumb2.${S}`], [`thumb_02_${s}`, `Thumb2.${S}`, `thumb_03_${s}`, `Thumb3.${S}`], [`thumb_03_${s}`, `Thumb3.${S}`, null, null]);
  }
  return m;
})();
// bones that sit under Root (not under Hips: legs + IK foot) follow the source position as well
export const POS_MAP = [["pelvis", "Hips"], ["thigh_l", "UpperLeg.L"], ["thigh_r", "UpperLeg.R"], ["foot_l", "Foot.L"], ["foot_r", "Foot.R"]]; // PT.* are knee pole targets (unskinned): left alone

let _ual;
export async function loadUAL() { return _ual ??= await gl.loadAsync(D.ual); }
const tmpQ = new THREE.Quaternion(), tmpV = new THREE.Vector3();
function restOf(root, find) { root.updateMatrixWorld(true); const r = {}; root.traverse(o => { if (o.isBone || o.name === "Armature") r[o.name] = { q: o.getWorldQuaternion(new THREE.Quaternion()), p: o.getWorldPosition(new THREE.Vector3()) }; }); return r; }

export function bakeClip(ual, srcClip, ch, fps = 30) {
  const src = SU.clone(ual.scene); const rep = { clip: srcClip.name, missing: [] };
  // glTF node transforms are NOT the bind pose in these files: reset both skeletons to bind (inverse of boneInverses)
  src.traverse(m => { if (m.isSkinnedMesh) m.skeleton.pose(); }); ch.skel.pose(); ch.root.updateMatrixWorld(true);
  const sRest = restOf(src); const tRoot = ch.root; const tRest = restOf(tRoot);
  const tb = {}; tRoot.traverse(o => { if (o.isBone) tb[o.name] = o; });
  const T = n => tb[sanit(n)]; const tname = n => sanit(n);
  // frame correction (yaw) so source forward == target forward
  const fwd = (R, a, b) => new THREE.Vector3().subVectors(R[b].p, R[a].p).setY(0).normalize();
  // frame correction from the left->right hip axis (feet axes are unreliable: mannequin toes point out)
  const sF = fwd(sRest, "thigh_l", "thigh_r"), tF = fwd(tRest, tname("UpperLeg.L"), tname("UpperLeg.R"));
  const dy = Math.atan2(tF.x, tF.z) - Math.atan2(sF.x, sF.z);
  const C = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), dy);
  rep.yawCorrDeg = THREE.MathUtils.radToDeg(dy);
  const k = tRest[tname("Hips")].p.y / sRest.pelvis.p.y; rep.hipScale = k;
  const mixer = new THREE.AnimationMixer(src); mixer.clipAction(srcClip).play();
  const n = Math.round(srcClip.duration * fps) + 1; const times = Array.from({ length: n }, (_, i) => i / fps);
  const order = []; tRoot.traverse(o => { if (o.isBone) order.push(o); });
  const mapBy = {}; for (const e of BONE_MAP) { if (!T(e[1])) { rep.missing.push(e[1]); continue; } mapBy[tname(e[1])] = e; }
  const posBy = {}; for (const e of POS_MAP) if (T(e[1])) posBy[tname(e[1])] = e[0];
  const qv = {}, pv = {}; for (const b of order) { if (mapBy[b.name]) qv[b.name] = []; if (posBy[b.name]) pv[b.name] = []; }
  const sBones = {}; src.traverse(o => { if (o.isBone) sBones[o.name] = o; });
  const sW = (name) => sBones[name].getWorldQuaternion(new THREE.Quaternion()).premultiply(C);
  const sP = (name) => sBones[name].getWorldPosition(new THREE.Vector3()).applyQuaternion(C);
  const sRq = n => sRest[n].q.clone().premultiply(C), sRp = n => sRest[n].p.clone().applyQuaternion(C);
  const prev = {};
  for (const t of times) {
    mixer.setTime(t); src.updateMatrixWorld(true);
    const nw = new Map();
    for (const b of order) {
      const par = b.parent && b.parent.isBone ? nw.get(b.parent) : b.parent.getWorldQuaternion(new THREE.Quaternion());
      const restLocal = b.quaternion.clone(); // target rest local (bone untouched so far)
      const e = mapBy[b.name];
      if (!e) { nw.set(b, par.clone().multiply(b.userData._rl ??= restLocal)); }
      else {
        const [sN, , sTip, tTipN] = e; const sAnimQ = sW(sN), sRestQ = sRq(sN); let Qw;
        if (sTip) {
          const sRestDir = sRp(sTip).sub(sRp(sN)).normalize(), sAnimDir = sP(sTip).sub(sP(sN)).normalize();
          const tRestDir = new THREE.Vector3().subVectors(tRest[tname(tTipN)].p, tRest[b.name].p).normalize();
          const sSwing = new THREE.Quaternion().setFromUnitVectors(sRestDir, sAnimDir).multiply(sRestQ);
          const residual = sSwing.clone().invert().multiply(sAnimQ);
          Qw = new THREE.Quaternion().setFromUnitVectors(tRestDir, sAnimDir).multiply(tRest[b.name].q).multiply(residual);
        } else Qw = sAnimQ.clone().multiply(sRestQ.clone().invert()).multiply(tRest[b.name].q);
        const loc = par.clone().invert().multiply(Qw);
        if (prev[b.name] && prev[b.name].dot(loc) < 0) { loc.x *= -1; loc.y *= -1; loc.z *= -1; loc.w *= -1; }
        prev[b.name] = loc.clone(); qv[b.name].push(loc.x, loc.y, loc.z, loc.w); nw.set(b, par.clone().multiply(loc));
      }
      if (posBy[b.name]) {
        const sN = posBy[b.name]; const wp = tRest[b.name].p.clone().add(sP(sN).sub(sRp(sN)).multiplyScalar(k));
        const par = b.parent; const pq = b.parent.isBone ? nw.get(b.parent) : new THREE.Quaternion(); const pp = tRest[par.name]?.p ?? new THREE.Vector3();
        const loc = wp.sub(pp).applyQuaternion(pq.clone().invert()); pv[b.name].push(loc.x, loc.y, loc.z);
      }
    }
  }
  const tracks = [];
  for (const [nm, v] of Object.entries(qv)) tracks.push(new THREE.QuaternionKeyframeTrack(nm + ".quaternion", times, v));
  for (const [nm, v] of Object.entries(pv)) tracks.push(new THREE.VectorKeyframeTrack(nm + ".position", times, v));
  rep.tracks = tracks.length;
  const clip = new THREE.AnimationClip(srcClip.name, srcClip.duration, tracks); clip.userData = rep; return clip;
}

// pose helper
export function poseAt(ch, clip, t) {
  ch._mixer ??= new THREE.AnimationMixer(ch.root); ch._mixer.stopAllAction(); ch._mixer.uncacheRoot(ch.root);
  const a = ch._mixer.clipAction(clip); a.reset().play(); ch._mixer.setTime(t); ch.root.updateMatrixWorld(true);
  ch.root.traverse(o => { if (o.isSkinnedMesh) o.skeleton.update(); }); // each skinned mesh has its own Skeleton instance: refresh all
}
const inPart = (o, re) => { for (let p = o; p; p = p.parent) if (re.test(p.name)) return true; return false; };
export function meshBox(ch, which = "Feet") { const b = new THREE.Box3(); ch.root.traverse(o => { if (o.isSkinnedMesh && o.visible && inPart(o, new RegExp("_" + which + "$"))) { o.computeBoundingBox(); b.union(o.boundingBox.clone().applyMatrix4(o.matrixWorld)); } }); return b; }
// lowest bum height: min y of body/legs vertices behind the hips (seat contact)
// CPU skin queries (getVertexPosition) did not match the GPU result here, so seat/feet heights come from bones:
// sole = Foot.* bone y - 0.023 (rest offset), seat top = Hips y - 0.11 (butt bottom).
export function footMinY(ch) { return Math.min(...["Foot.L", "Foot.R"].map(n => ch.bones[sanit(n)].getWorldPosition(new THREE.Vector3()).y)) - 0.023; }
export function seatContactY(ch) { const hips = ch.bones[sanit("Hips")].getWorldPosition(new THREE.Vector3()); return { minY: hips.y - 0.11, hips }; }
export async function loadCast(id) { const cfg = await (await fetch(`/cast/${id}.json`)).json(); return assemble(cfg); }
export const CAST_IDS = ["dadu", "rohan", "arjun", "meera"];
export { gl, fbx, D, sanit };
