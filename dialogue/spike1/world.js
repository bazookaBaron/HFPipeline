// DIALOGUE spike1 world: dense campfire set, seated cast with contact gate, acting layer, camera rigs, post.
// Nothing is modelled: assets are loaded, instanced, recoloured, hidden, placed. Effects (terrain displacement, embers, smoke, stars) are allowed.
// Deterministic: seeded RNG, every frame is a pure function of t.
import { THREE, PAL, D, rng, toon, loadFBX, bbox, makeRenderer as _mr, loadCast, loadUAL, bakeClip, poseAt, sanit, BLOOM_LAYER, log } from "./lib.js";
import { makeFaceLayer, emotionState, buildLipsync } from "./facelayer.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { BokehPass } from "three/addons/postprocessing/BokehPass.js";
export { THREE };

const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
const sineIO = t => 0.5 - 0.5 * Math.cos(Math.PI * Math.min(1, Math.max(0, t)));
const bump = (x, w) => (x <= 0 || x >= w) ? 0 : Math.pow(Math.sin(Math.PI * x / w), 2);

// ---------------- palette re-tint (phase-0 fix: muddy near-black greens, overlit rocks) ----------------
const TINT = {
  Green: "#2C5149", DarkGreen: "#1F3C3E", Wood: "#4A3A33", LightWood: "#8C6B4C", DarkWood: "#3B2D25", Rock: "#47525D",
  Berry: "#9A3C30", Cyan: "#78B0BE", Yellow: "#E6B65C", Mushroom_Top: "#8C5A44", Mushroom_Bottom: "#B7A38A",
  Black: "#343B43", Grey: "#6C747C", LightGrey: "#7C848C", Yellow2: "#E6B65C", LightGreen: "#C9A26C", Fire: "#F2A03D",
};
const TENT = { Green: "#A9824F", LightGreen: "#D2AA74", DarkWood: "#3B2D25", Black: "#2E343B" };
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

// ---------------- wind sway (vertex shader patch, low amplitude) ----------------
function addSway(mat, U, ampLocal, hLocal) {
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

// ---------------- terrain (noise-displaced faceted plane; vertex colours; real light falloff via Lambert) ----------------
export const SEAT_XZ = { stump: 0.4, log: 0.62 };
export function terrainH(x, z) {
  const r = Math.hypot(x, z); const amp = sstep(4.6, 14, r) * (0.35 + 0.9 * sstep(14, 45, r));
  const n = Math.sin(x * 0.31 + 1.3) * Math.cos(z * 0.27 - 0.4) + 0.5 * Math.sin(x * 0.73 + z * 0.61) + 0.25 * Math.sin(x * 1.7 - z * 1.3);
  return amp * n * 0.55;
}
function makeTerrain(R) {
  const S = 150, N = 75; const g = new THREE.PlaneGeometry(S, S, N, N); g.rotateX(-Math.PI / 2);
  const p = g.attributes.position; for (let i = 0; i < p.count; i++) p.setY(i, terrainH(p.getX(i), p.getZ(i)));
  const ng = g.toNonIndexed(); const pos = ng.attributes.position; const col = new Float32Array(pos.count * 3);
  const dirt = new THREE.Color("#42352B"), grass = new THREE.Color("#35533F"), floor = new THREE.Color("#1D3033"), dirt2 = new THREE.Color("#3A2F27"), c = new THREE.Color();
  for (let f = 0; f < pos.count; f += 3) {
    const cx = (pos.getX(f) + pos.getX(f + 1) + pos.getX(f + 2)) / 3, cz = (pos.getZ(f) + pos.getZ(f + 1) + pos.getZ(f + 2)) / 3, r = Math.hypot(cx, cz);
    const j = (R() - 0.5) * 0.18;
    c.copy(dirt).lerp(dirt2, Math.min(1, r / 3.2)).lerp(grass, sstep(2.6, 4.8, r) * (0.6 + 0.4 * R())).lerp(floor, sstep(7, 18, r));
    c.multiplyScalar(1 + j);
    for (let k = 0; k < 3; k++) { col[(f + k) * 3] = c.r; col[(f + k) * 3 + 1] = c.g; col[(f + k) * 3 + 2] = c.b; }
  }
  ng.setAttribute("color", new THREE.BufferAttribute(col, 3)); ng.computeVertexNormals();
  const m = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }); const mesh = new THREE.Mesh(ng, m); mesh.receiveShadow = true; mesh.name = "terrain"; return mesh;
}

// ---------------- instanced scatter ----------------
const nat = n => D.nature + n + ".fbx", surv = n => D.survival + n + ".fbx";
const cacheObj = new Map();
async function loadTinted(url, kind) { const k = url + "|" + kind; if (!cacheObj.has(k)) { const o = toonifyP(await loadFBX(url), kind); cacheObj.set(k, o); } return cacheObj.get(k); }
// returns {meshes, add(list)} ; list items {x,y,z,yaw,h(target height),tilt?,tint}
async function scatter(scene, url, items, U, { amp = 0.05, shadow = false } = {}) {
  if (!items.length) return;
  const obj = await loadTinted(url, "nat"); obj.updateMatrixWorld(true); const b = bbox(obj), sz = b.getSize(V3()), c = b.getCenter(V3());
  const subs = []; obj.traverse(m => { if (m.isMesh && m.visible) subs.push(m); });
  const M = new THREE.Matrix4(), Pm = new THREE.Matrix4(), B = new THREE.Matrix4(), Q = new THREE.Quaternion(), Sx = new THREE.Matrix4(), col = new THREE.Color();
  for (const m of subs) {
    const geo = m.geometry.clone().applyMatrix4(m.matrixWorld); const k0 = items[0].h / sz.y; // sway amplitude in local units
    const mats = Array.isArray(m.material) ? m.material.map(x => x.clone()) : m.material.clone();
    for (const mm of [].concat(mats)) if (!(mm instanceof THREE.MeshBasicMaterial)) addSway(mm, U, amp / k0, sz.y);
    const im = new THREE.InstancedMesh(geo, mats, items.length); im.frustumCulled = false; im.castShadow = shadow;
    items.forEach((it, i) => {
      const k = it.h / sz.y; B.makeScale(k, k, k).multiply(new THREE.Matrix4().makeTranslation(-c.x, -b.min.y, -c.z));
      Q.setFromEuler(new THREE.Euler(it.tilt?.[0] ?? 0, it.yaw, it.tilt?.[1] ?? 0, "YXZ")); Pm.compose(V3(it.x, it.y ?? terrainH(it.x, it.z) - 0.04, it.z), Q, V3(1, 1, 1));
      M.multiplyMatrices(Pm, B); im.setMatrixAt(i, M); const v = it.tint ?? 1; im.setColorAt(i, col.setRGB(v, v, v));
    });
    im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; scene.add(im);
  }
}

// ---------------- fire life: embers, sparks, smoke (effects; pure functions of uTime) ----------------
function makeEmbers(U, R, scene) {
  const NB = 112, NS = 12 * 16, N = NB + NS; const seed = new Float32Array(N * 4), seed2 = new Float32Array(N * 4), pos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) { seed.set([R(), R(), R(), R()], i * 4); const spark = i >= NB ? 1 : 0; seed2.set([R(), R(), spark ? Math.floor((i - NB) / 16) : 0, spark], i * 4); }
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(pos, 3)); g.setAttribute("seed", new THREE.BufferAttribute(seed, 4)); g.setAttribute("seed2", new THREE.BufferAttribute(seed2, 4));
  const bursts = []; let tb = 3.2 + R() * 3; for (let i = 0; i < 12; i++) { bursts.push(tb); tb += 6 + R() * 6; }
  const m = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    uniforms: { uTime: U.uTime, uPx: U.uPx, uBurst: { value: bursts }, cA: { value: new THREE.Color(PAL.fire) }, cB: { value: new THREE.Color(PAL.ember) }, cC: { value: new THREE.Color("#3A1408") } },
    vertexShader: `uniform float uTime,uPx; uniform float uBurst[12]; attribute vec4 seed; attribute vec4 seed2; varying float vA; varying float vF;
    void main(){
      float life = 3.0 + seed.x*3.0; float age; bool sp = seed2.w > 0.5;
      if(!sp){ age = mod(uTime + seed.y*life, life); } else { life = 1.3 + seed.x*1.0; age = uTime - uBurst[int(seed2.z)] - seed.y*0.3; if(age < 0.0 || age > life){ gl_Position = vec4(2.0,2.0,2.0,1.0); gl_PointSize = 0.0; vA = 0.0; vF = 0.0; return; } }
      float f = age/life; float a0 = seed2.x*6.2831; float r0 = (sp ? 0.1 : 0.05 + seed2.y*0.32);
      float v = sp ? 1.0 + seed.z*1.4 : 0.5 + seed.z*0.75;
      vec3 p = vec3(cos(a0)*r0, 0.55, sin(a0)*r0);
      float k = 0.25 + age*0.22;
      p.x += 0.38*sin(age*1.7 + seed.w*6.2831)*k + 0.035*age*age;
      p.z += 0.32*cos(age*1.35 + seed.z*6.2831)*k;
      p.y += v*age - 0.03*age*age;
      vec4 mv = modelViewMatrix * vec4(p,1.0); gl_Position = projectionMatrix*mv;
      gl_PointSize = (2.0 + seed.x*4.0*(sp?0.6:1.0)) * uPx * (1.0 - 0.45*f);
      vA = smoothstep(0.0,0.06,f) * pow(1.0-f,1.4) * (0.72 + 0.28*sin(age*21.0 + seed.w*40.0)); vF = f;
    }`,
    fragmentShader: `uniform vec3 cA,cB,cC; varying float vA; varying float vF;
    void main(){ float d = length(gl_PointCoord-0.5); float a = smoothstep(0.5,0.12,d); vec3 c = mix(cA,cB,smoothstep(0.0,0.5,vF)); c = mix(c,cC,smoothstep(0.55,1.0,vF)); gl_FragColor = vec4(c*1.8, a*vA); }`,
  });
  const pts = new THREE.Points(g, m); pts.frustumCulled = false; pts.layers.enable(BLOOM_LAYER); pts.name = "embers"; scene.add(pts);
}
function makeSmoke(U, R, scene) {
  const N = 14; const seed = new Float32Array(N * 4), pos = new Float32Array(N * 3); for (let i = 0; i < N * 4; i++) seed[i] = R();
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(pos, 3)); g.setAttribute("seed", new THREE.BufferAttribute(seed, 4));
  const m = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, fog: false, uniforms: { uTime: U.uTime, uFocal: U.uFocal, col: { value: new THREE.Color("#46515C") } },
    vertexShader: `uniform float uTime,uFocal; attribute vec4 seed; varying float vA;
    void main(){ float life = 9.0 + seed.x*5.0; float age = mod(uTime + seed.y*life, life); float f = age/life;
      vec3 p = vec3((seed.z-0.5)*0.4, 1.0 + age*0.42, (seed.w-0.5)*0.4);
      p.x += 0.25*sin(age*0.5+seed.z*6.28)*age*0.25 + 0.06*age; p.z += 0.2*cos(age*0.4+seed.w*6.28)*age*0.2;
      vec4 mv = modelViewMatrix*vec4(p,1.0); gl_Position = projectionMatrix*mv; float sz = 0.5 + f*1.5; gl_PointSize = sz*uFocal/max(0.5,-mv.z);
      vA = smoothstep(0.0,0.15,f)*pow(1.0-f,1.5)*0.07; }`,
    fragmentShader: `uniform vec3 col; varying float vA; void main(){ float d = length(gl_PointCoord-0.5)*2.0; float a = exp(-d*d*3.0); gl_FragColor = vec4(col, a*vA); }`,
  });
  const pts = new THREE.Points(g, m); pts.frustumCulled = false; pts.name = "smoke"; pts.renderOrder = 5; scene.add(pts);
}
function makeSky(U, R, scene, moonDir) {
  const dome = new THREE.Mesh(new THREE.SphereGeometry(170, 32, 20), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color("#0A111B") }, hor: { value: new THREE.Color("#1D2D3C") }, moonC: { value: new THREE.Color(PAL.moon) }, md: { value: moonDir.clone().normalize() } },
    vertexShader: "varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }",
    fragmentShader: "uniform vec3 top,hor,moonC,md; varying vec3 vD; void main(){ float h = clamp(vD.y,0.0,1.0); vec3 c = mix(hor, top, smoothstep(0.0,0.55,h)); float g = max(dot(normalize(vD),md),0.0); c += moonC*(pow(g,60.0)*0.28 + pow(g,6.0)*0.03); gl_FragColor = vec4(c,1.0); }" }));
  dome.renderOrder = -10; dome.name = "sky"; scene.add(dome);
  const N = 520, pos = new Float32Array(N * 3), s = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) { const th = R() * Math.PI * 2, y = 0.08 + Math.pow(R(), 0.8) * 0.92, rr = Math.sqrt(1 - y * y); pos.set([Math.cos(th) * rr * 150, y * 150, Math.sin(th) * rr * 150], i * 3); s.set([R(), R(), R()], i * 3); }
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(pos, 3)); g.setAttribute("seed", new THREE.BufferAttribute(s, 3));
  const stars = new THREE.Points(g, new THREE.ShaderMaterial({ transparent: true, depthWrite: false, fog: false, uniforms: { uTime: U.uTime, uPx: U.uPx },
    vertexShader: "uniform float uTime,uPx; attribute vec3 seed; varying float vA; void main(){ vec4 mv = modelViewMatrix*vec4(position,1.0); gl_Position = projectionMatrix*mv; gl_PointSize = (1.4 + seed.x*2.2)*uPx; vA = (0.35 + 0.65*seed.y) * (0.65 + 0.35*sin(uTime*(0.5+seed.z*1.5) + seed.x*40.0)); }",
    fragmentShader: "varying float vA; void main(){ float d = length(gl_PointCoord-0.5); float a = smoothstep(0.5,0.1,d); gl_FragColor = vec4(vec3(0.82,0.88,0.95), a*vA); }" }));
  stars.frustumCulled = false; stars.renderOrder = -9; stars.name = "stars"; scene.add(stars);
  const moon = new THREE.Mesh(new THREE.CircleGeometry(3.4, 28), new THREE.MeshBasicMaterial({ color: new THREE.Color("#C9D6E2"), fog: false, depthWrite: false }));
  moon.position.copy(moonDir.clone().normalize().multiplyScalar(158)); moon.lookAt(0, 0, 0); moon.layers.enable(BLOOM_LAYER); moon.name = "moon"; moon.renderOrder = -8; scene.add(moon);
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
  pose(t) { poseAt(this.ch, this.clip, t % this.clip.duration); }
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
  lookAt(target, w = 1, maxYaw = 55, maxPitch = 22) {
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
  nod(amt) { if (amt <= 0) return; const lat = this.lateral(); rotBoneWorld(this.neck, axisQ(lat, this.nodSign * amt * 0.5)); rotBoneWorld(this.head, axisQ(lat, this.nodSign * amt * 0.5)); }
  blinkAmt(t) { let a = 0; for (const b of [...this.blinkT, ...(this.forced ?? [])]) { if (t < b - 0.01) break; const x = t - b; if (x < 0.17) a = Math.max(a, 1 - Math.abs(x / 0.085 - 1)); } return a; }
}

function cfgSkin(id, skin) { return skin; }

// ---------------- the world ----------------
export async function buildWorld({ log: lg = log } = {}) {
  const scene = new THREE.Scene(); const R = rng(1109); const U = { uTime: { value: 0 }, uPx: { value: 1 }, uFocal: { value: 1000 } };
  const moonDir = V3(0.22, 0.52, -0.82);
  scene.fog = new THREE.Fog("#17242F", 5, 64);
  makeSky(U, rng(31), scene, moonDir);
  // lights: warm fire key (shadowed), cool moon rim, faint sky fill, tent glow
  const fireP = V3(0, 0.62, 0);
  const key = new THREE.PointLight("#F6C792", 1, 0, 2.0); key.position.copy(fireP); key.castShadow = true; key.shadow.mapSize.set(2048, 2048); key.shadow.camera.near = 0.3; key.shadow.camera.far = 9; key.shadow.bias = -0.0015; key.shadow.normalBias = 0.02; key.shadow.radius = 4; scene.add(key);
  const rim = new THREE.DirectionalLight(PAL.moon, 2.0); rim.position.copy(moonDir.clone().multiplyScalar(30)); scene.add(rim, rim.target);
  const fill = new THREE.HemisphereLight(0x3d566e, 0x1c2a36, 1.5); scene.add(fill); const faceFill = new THREE.DirectionalLight('#C9D3DC', 0.8); faceFill.name = 'faceFill'; scene.add(faceFill);
  const tentGlow = { intensity: 0 };
  const base = 20, rr = rng(7), ph = [rr() * 6.28, rr() * 6.28, rr() * 6.28];
  const flick = tt => 1 + 0.07 * Math.sin(tt * 9 + ph[0]) + 0.05 * Math.sin(tt * 17 + ph[1]) + 0.035 * Math.sin(tt * 31 + ph[2]);
  const cK = new THREE.Color("#F6C792"), cE = new THREE.Color(PAL.ember);

  // terrain
  const terrain = makeTerrain(R); scene.add(terrain);
  // fire: logs + flames; pit rocks
  const fire = normP(toonifyP(await loadFBX(surv("Bonfire_Fire")), "nat"), 1.0); fire.scale.multiplyScalar(1); scene.add(fire);
  const flames = []; fire.traverse(o => { if (o.isMesh && /fire/i.test([].concat(o.material)[0].name)) flames.push(o); });
  flames.forEach(f => { f.userData.s0 = f.scale.clone(); });
  const casters = [];
  const pitRocks = []; for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2 + R() * 0.2; const o = normP(toonifyP(await loadFBX(nat(`Rock_${1 + (i % 7)}`)), "nat"), 0.26 + R() * 0.12); o.position.set(Math.cos(a) * 0.78, 0, Math.sin(a) * 0.78); o.rotation.y = R() * 6.28; scene.add(o); casters.push(o); }
  // clearing props
  const place = async (url, h, x, z, yaw, kind = "nat", y = null) => { const o = normP(toonifyP(await loadFBX(url), kind), h); o.position.set(x, y ?? terrainH(x, z), z); o.rotation.y = yaw; scene.add(o); casters.push(o); return o; };
  for (let i = 0; i < 4; i++) { const stack = [[-2.35, -1.1, 0.0], [-2.35, -1.38, 0.35], [-2.5, -1.24, 0.1], [-2.4, -1.25, 0.6]]; const [x, z, y] = [stack[i][0], stack[i][1], i === 3 ? 0.17 : 0]; await place(surv("WoodLog"), 0.17, x, z, 0.35 + i * 0.1, "nat", y); }
  await place(nat("Rock_3"), 0.16, 0.82, -0.98, 1.0); await place(nat("Rock_5"), 0.16, 1.12, -0.86, 2.0); await place(surv("Pot"), 0.28, 0.97, -0.92, 0.5, "nat", 0.15);
  const axe = await place(surv("Axe"), 0.85, -2.52, 0.62, 2.2); axe.rotation.z = 0.28; axe.position.y = 0.06;
  await place(surv("Backpack"), 0.5, 2.75, 0.75, -0.6); await place(surv("WaterBottle_1"), 0.26, 2.3, 0.9, 0.3);
  const tent = await place(surv("Tent"), 1.9, -5.0, -4.2, 0.95, "tent"); // tent glow inside the fabric
  // ground cover + trees (ring plan 10c)
  const ring = (n, r0, r1, f) => { for (let i = 0; i < n; i++) { const a = R() * Math.PI * 2, r = r0 + R() * (r1 - r0); f(Math.cos(a) * r, Math.sin(a) * r, i, a); } };
  const camGap = (x, z, rmax) => { const r = Math.hypot(x, z); return r < rmax && z > 1.5 && Math.abs(x) < 0.55 * z + 2.2; }; // keep the wide-camera wedge free of trunks
  const trees = { Pine: [], Common: [], Birch: [], Willow: [] }; const tcount = { r1: 0, r2: 0, r3: 0 };
  const addTree = (x, z, ringId, hb, pPine) => { if (camGap(x, z, 16)) return; const u = R(); const type = u < pPine ? "Pine" : u < pPine + (1 - pPine) * 0.6 ? "Common" : "Birch";
    trees[type].push({ n: 1 + Math.floor(R() * 5), x, z, yaw: R() * 6.28, h: hb * (type === "Pine" ? 1.0 : 0.82) * (0.85 + R() * 0.45), tint: 0.82 + R() * 0.3 }); tcount[ringId]++; };
  let guard = 0; while (tcount.r1 < 18 && guard++ < 999) { const a = R() * 6.28, r = 8 + R() * 4; addTree(Math.cos(a) * r, Math.sin(a) * r, "r1", 6.4, 0.45); }
  guard = 0; while (tcount.r2 < 40 && guard++ < 999) { const a = R() * 6.28, r = 12.5 + R() * 10; addTree(Math.cos(a) * r, Math.sin(a) * r, "r2", 8.2, 0.62); }
  guard = 0; while (tcount.r3 < 74 && guard++ < 999) { const a = R() * 6.28, r = 22.5 + R() * 27; addTree(Math.cos(a) * r, Math.sin(a) * r, "r3", 10.5, 0.7); }
  for (const [x, z, h, n] of [[0.9, -5.2, 6.8, 2], [3.9, -4.4, 6.2, 4], [-2.9, -5.9, 6.5, 3]]) (trees.Pine ??= []).push({ n, x, z, yaw: R() * 6.28, h, tint: 1.25 });
  const byFile = {}; for (const [type, arr] of Object.entries(trees)) for (const it of arr) { const f = type === "Pine" ? `PineTree_${it.n}` : type === "Common" ? `CommonTree_${it.n}` : type === "Birch" ? `BirchTree_${it.n}` : `Willow_${it.n}`; (byFile[f] ??= []).push(it); }
  for (const [f, items] of Object.entries(byFile)) await scatter(scene, nat(f), items, U, { amp: 0.09 });
  // undergrowth
  const cover = { }; const add = (f, x, z, h, extra = {}) => (cover[f] ??= []).push({ x, z, h, yaw: R() * 6.28, tint: 0.85 + R() * 0.3, ...extra });
  ring(110, 2.8, 6.2, (x, z) => add(R() < 0.5 ? "Grass_Short" : "Grass", x, z, 0.22 + R() * 0.2));
  ring(14, 4, 6.5, (x, z) => add("Flowers", x, z, 0.3 + R() * 0.15));
  ring(10, 6.2, 10.5, (x, z) => { if (!camGap(x, z, 12)) add(["Bush_1", "Bush_2", "BushBerries_1", "BushBerries_2"][Math.floor(R() * 4)], x, z, 0.8 + R() * 0.5); });
  ring(26, 5.5, 11, (x, z) => add(`Plant_${1 + Math.floor(R() * 5)}`, x, z, 0.45 + R() * 0.45));
  ring(7, 5.5, 10.5, (x, z) => add(`Rock_Moss_${1 + Math.floor(R() * 7)}`, x, z, 0.5 + R() * 0.6, {}));
  ring(2, 6, 9, (x, z) => { if (!camGap(x, z, 12)) add("WoodLog_Moss", x, z, 0.45); }); ring(2, 6, 9, (x, z) => { if (!camGap(x, z, 12)) add("TreeStump", x, z, 0.5); });
  ring(90, 2.2, 4.6, (x, z) => { if (z > -0.8) add(R() < 0.5 ? "Grass" : "Grass_Short", x, z, 0.22 + R() * 0.28, { tint: 1.1 }); });
  ring(14, 2.6, 4.8, (x, z) => { if (z > 0) add(`Plant_${1 + Math.floor(R() * 5)}`, x, z, 0.4 + R() * 0.3); });
  ring(7, 2.8, 4.6, (x, z) => { if (z > 0.5) add(`Rock_${1 + Math.floor(R() * 7)}`, x, z, 0.22 + R() * 0.25); });
  ring(110, 6, 22, (x, z) => add(R() < 0.6 ? "Grass" : "Grass_2", x, z, 0.4 + R() * 0.4));
  ring(32, 11, 24, (x, z) => add(["Bush_1", "Bush_2", "BushBerries_1"][Math.floor(R() * 3)], x, z, 0.9 + R() * 0.7));
  ring(34, 11, 24, (x, z) => add(`Plant_${1 + Math.floor(R() * 5)}`, x, z, 0.5 + R() * 0.5));
  ring(8, 10, 22, (x, z) => add(`Rock_${1 + Math.floor(R() * 7)}`, x, z, 0.5 + R() * 0.9));
  for (const [f, items] of Object.entries(cover)) await scatter(scene, nat(f), items, U, { amp: /Grass|Plant|Flowers/.test(f) ? 0.045 : 0.03 });
  makeEmbers(U, rng(91), scene); makeSmoke(U, rng(92), scene);

  // ----- characters, seats, contact -----
  const mk = async (id) => { const ch = await loadCast(id); const clips = await bake(ch); return new Actor(ch, clips, id, 0); };
  const dadu = await mk("dadu"), rohan = await mk("rohan"); scene.add(dadu.ch.root, rohan.ch.root);
  dadu.setup("Sitting_Idle_Loop", 5); rohan.setup("Sitting_Idle_Loop", 8);
  const gate = { seats: {}, notes: [] };
  const seatObjs = {};
  async function seat(actor, kind, X, yaw) {
    const ch = actor.ch; actor.yaw = yaw; ch.root.rotation.set(0, yaw, 0); ch.root.position.set(X, 0, 0); actor.pose(0); ch.root.updateMatrixWorld(true);
    // feet: sole on the terrain
    let fv = actor.worldVerts(actor.feet); let miny = 1e9; fv.forEach(a => { for (let i = 0; i < a.length; i += 3) miny = Math.min(miny, a[i + 1] - terrainH(a[i], a[i + 2])); });
    ch.root.position.y = -miny + 0.002; ch.root.updateMatrixWorld(true);
    // contact verts: the lowest of thighs/hips
    const cv = actor.worldVerts(actor.contact); let low = V3(0, 1e9, 0); const all = []; cv.forEach(a => { for (let i = 0; i < a.length; i += 3) { all.push([a[i], a[i + 1], a[i + 2]]); if (a[i + 1] < low.y) low.set(a[i], a[i + 1], a[i + 2]); } });
    all.sort((a, b) => a[1] - b[1]); const lowest = all.slice(0, Math.max(10, Math.floor(all.length * 0.04))); const C = V3(); lowest.forEach(p => C.add(V3(...p))); C.multiplyScalar(1 / lowest.length);
    const H = low.y; const fwd = actor.facing(), lat = actor.lateral();
    let w = null; const cands = kind === "log" ? [0.5, 0.42, 0.36, 0.3, 0.26] : [0.36, 0.3, 0.26, 0.22, 0.18]; let fitPen = 0, usedFx = 0;
    for (const FX of cands) { if (w) scene.remove(w); SEAT_XZ[kind === "log" ? "log" : "stump"] = FX; usedFx = FX;
    const name = kind === "log" ? "WoodLog" : "TreeStump_Moss"; const obj = toonifyP(await loadFBX(nat(name)), "nat"); const g = normP(obj, kind === "log" ? 0.45 : 0.5); w = new THREE.Group(); w.add(g); scene.add(w); w.castShadow = true;
    g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    const ray = new THREE.Raycaster(); const topAt = (x, z) => { ray.set(V3(x, 6, z), V3(0, -1, 0)); const h = solid(ray.intersectObject(w, true)); return h.length ? h[0].point.y : null; };
    const rel = V3(C.x - low.x, 0, C.z - low.z); const latC = rel.dot(lat); const lowFwd = V3(low.x, 0, low.z).dot(fwd), lowLat = V3(low.x, 0, low.z).dot(lat);
    if (kind === "log") { // log lies across the facing direction; the ridge passes under the lowest contact point
      w.rotation.y = yaw + Math.PI / 2; w.updateMatrixWorld(true); const cx = low.x - fwd.x * 0.06, cz = low.z - fwd.z * 0.06; w.position.set(cx, 0, cz);
      // lateral centring: log centre under the contact centre
      const ctr = V3(C.x, 0, C.z); const along = ctr.clone().sub(V3(cx, 0, cz)); w.position.add(lat.clone().multiplyScalar(along.dot(lat)));
      for (let it = 0; it < 7; it++) { w.updateMatrixWorld(true); const top = topAt(low.x, low.z) ?? 0.4; const ref = top / (w.scale.x || 1); const sy = (w.scale.y || 1) * H / top; w.scale.set(SEAT_XZ.log * sy, sy, sy); w.position.y = 0; }
      w.updateMatrixWorld(true);
    } else {
      w.rotation.y = 0; w.position.set(C.x - fwd.x * 0.06, 0, C.z - fwd.z * 0.06); w.updateMatrixWorld(true);
      { // turn the stump so its tall bark spike sits behind the sitter (away from the fire and the camera side)
        const p = V3(), q = V3(); let best = -1e9; w.traverse(o => { if (o.isMesh) { const pa = o.geometry.attributes.position; for (let i = 0; i < pa.count; i++) { q.fromBufferAttribute(pa, i).applyMatrix4(o.matrixWorld); if (q.y > best) { best = q.y; p.copy(q); } } } });
        const a0 = Math.atan2(p.x - C.x, p.z - C.z), a1 = Math.atan2(-fwd.x, -fwd.z); w.rotation.y = a1 - a0; w.updateMatrixWorld(true); }
      const pts = []; for (let i = 0; i < 9; i++) { const a = i / 9 * 6.28; const t = topAt(C.x + Math.cos(a) * 0.14, C.z + Math.sin(a) * 0.14); if (t !== null) pts.push(t); } pts.sort((a, b) => a - b); const med = pts[Math.floor(pts.length / 2)] ?? 0.4;
      w.scale.set(SEAT_XZ.stump, 1, SEAT_XZ.stump); w.updateMatrixWorld(true); { const pts2 = []; for (let i = 0; i < 9; i++) { const a = i / 9 * 6.28; const t2 = topAt(C.x + Math.cos(a) * 0.14, C.z + Math.sin(a) * 0.14); if (t2 !== null) pts2.push(t2); } pts2.sort((a, b) => a - b); const m2 = pts2[Math.floor(pts2.length / 2)] ?? med; const sy = H / m2; w.scale.set(SEAT_XZ.stump * sy, sy, SEAT_XZ.stump * sy); } w.updateMatrixWorld(true);
    }
      seatObjs[actor.id] = w; let mm_ = measure(actor); if (isFinite(mm_.seatGap)) { w.position.y += mm_.seatGap - 0.004; w.updateMatrixWorld(true); mm_ = measure(actor); } fitPen = mm_.pen; console.log("fit", actor.id, FX, "pen", mm_.pen.toFixed(3), "gap", mm_.seatGap.toFixed(3), "n", mm_.seatSamples, "scale", w.scale.toArray().map(x => +x.toFixed(2)).join(",")); if (mm_.pen <= 0.012) break; }
    gate.notes.push(`${actor.id} seat fit: xz scale ${usedFx}, residual penetration ${(fitPen * 100).toFixed(2)} cm`);
    return { H, scale: w.scale.x, fx: usedFx, fitPen };
  }
  const ray2 = new THREE.Raycaster();
  const X = 1.7, yawD = Math.PI / 2 - 0.35, yawR = -Math.PI / 2 + 0.35;
  gate.seats.dadu = await seat(dadu, "stump", -X, yawD); gate.seats.rohan = await seat(rohan, "log", X, yawR);
  dadu.calibrate(); rohan.calibrate();
  const layerD = makeFaceLayer(dadu.ch, { skin: dadu.ch.cfg.colors.Skin, beard: true, mouthDrop: 0.084 }), layerR = makeFaceLayer(rohan.ch, { skin: rohan.ch.cfg.colors.Skin, mouthDrop: 0.074 });
  // emotion timelines for the 8 s test: dadu warm -> thinking -> tender while talking; rohan neutral -> surprised -> warm
  const emoD = [[0, "neutral"], [1.5, "warm"], [3.4, "thinking"], [5.6, "tender"]], emoR = [[0, "neutral"], [2.9, "surprised"], [4.6, "warm"]];
  dadu.forced = emoD.slice(1).map(e => e[0] - 0.05); rohan.forced = emoR.slice(1).map(e => e[0] - 0.05);
  let lipD = () => null; const setWords = w => { lipD = buildLipsync(w); };
  const FS = (emo, t, lip, gD) => { const e = emotionState(emo, t); return { m: e.m, lip, up: e.up, lo: e.lo, tilt: e.tilt, br: e.br + 0.45 * gD, bi: e.bi, bL: e.bL, bR: e.bR }; };
  [dadu, rohan].forEach(a => a.ch.root.traverse(o => { if (o.isSkinnedMesh) { o.castShadow = true; o.receiveShadow = false; } }));
  casters.forEach(o => o.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } }));
  function measure(actor) {
    const seatObj = seatObjs[actor.id]; seatObj.updateMatrixWorld(true); actor.ch.root.updateMatrixWorld(true);
    const cv = actor.worldVerts(actor.contact); let minGap = 1e9, n = 0, minY = 1e9; cv.forEach(a => { for (let i = 0; i < a.length; i += 3) minY = Math.min(minY, a[i + 1]); });
    cv.forEach(a => { for (let i = 0; i < a.length; i += 3) { if (a[i + 1] > minY + 0.1) continue; ray2.set(V3(a[i], 6, a[i + 2]), V3(0, -1, 0)); const h = solid(ray2.intersectObject(seatObj, true)); if (h.length) { minGap = Math.min(minGap, a[i + 1] - h[0].point.y); n++; } } });
    const fv = actor.worldVerts(actor.feet); let fg = 1e9; fv.forEach(a => { for (let i = 0; i < a.length; i += 3) fg = Math.min(fg, a[i + 1] - terrainH(a[i], a[i + 2])); });
    // penetration gate: any leg / hip / foot vertex inside the seat volume (odd number of surface crossings above it) deeper than 1.5 cm
    let pen = 0, penN = 0; const sel = [...actor.legs, ...actor.contact, ...actor.feet]; const top = minY + 0.55;
    for (const a of actor.worldVerts(sel)) for (let i = 0; i < a.length; i += 3) { const vy = a[i + 1]; if (vy > top) continue; ray2.set(V3(a[i], 4, a[i + 2]), V3(0, -1, 0)); const hs = solid(ray2.intersectObject(seatObj, true)); if (!hs.length) continue; let above = 1e9, below = -1e9, na = 0; for (const h of hs) { if (h.point.y > vy) { na++; above = Math.min(above, h.point.y); } else below = Math.max(below, h.point.y); } if (na % 2 === 1) { const depth = Math.min(above - vy, vy - below); if (depth > 0.015) penN++; if (depth > pen) { pen = depth; actor.penAt = [a[i], vy, a[i + 2], above, below]; } } }
    return { seatGap: n ? minGap : NaN, seatSamples: n, footGap: fg, pen, penN };
  }
  // final per-actor vertical trim so min seat gap is zero (the stump / log top is then exactly under the lowest thigh/hip vertex)
  for (const a of [dadu, rohan]) { a.pose(0); a.ch.root.updateMatrixWorld(true); const m = measure(a); const w = seatObjs[a.id]; if (isFinite(m.seatGap)) { w.position.y += m.seatGap; w.updateMatrixWorld(true); } gate.seats[a.id].trimmed = m.seatGap; }

  // ----- anchors for camera rigs (head bone world position at t=0) -----
  const anchors = {}; for (const a of [dadu, rohan]) { a.pose(0); a.ch.root.updateMatrixWorld(true); anchors[a.id] = { head: a.head.getWorldPosition(V3()), yaw: a.yaw }; }
  const cuesPrev = {};

  // ----- per-frame update (pure function of t) -----
  const shotFX = { fireScale: 1 };
  function setShot(rc) { shotFX.fireScale = rc.fireScale ?? 1; flames.forEach(m => { m.visible = !rc.hideFlame; }); faceFill.position.copy(rc.pos).normalize().multiplyScalar(30); faceFill.position.y = Math.max(faceFill.position.y, 6); if (rc.rimDir) { rim.position.copy(rc.rimDir.clone().normalize().multiplyScalar(30)); rim.intensity = rc.rimI ?? 3.2; } else { rim.position.copy(moonDir.clone().multiplyScalar(30)); rim.intensity = 2.0; } }
  const stress = [2.45, 5.55]; // seconds: stressed words (from dummy words.json)
  const nods = [3.55, 6.55];
  function update(t, { otherLook = true } = {}) {
    U.uTime.value = t; const f = flick(t); key.intensity = base * f; key.color.copy(cK).lerp(cE, Math.max(0, 1 - f) * 1.2);
    const fl = 1 + 0.08 * Math.sin(t * 11 + 1) + 0.05 * Math.sin(t * 19 + 2) + 0.03 * Math.sin(t * 5.3);
    const fs_ = shotFX.fireScale; flames.forEach(m => { m.scale.set(m.userData.s0.x * fs_ * (0.98 + 0.03 * Math.sin(t * 7.1)), m.userData.s0.y * fs_ * fl, m.userData.s0.z * fs_ * (0.98 + 0.03 * Math.cos(t * 6.3))); });
    tentGlow.intensity = 6 * (0.93 + 0.07 * Math.sin(t * 1.7));
    for (const a of [dadu, rohan]) { a.pose(t); }
    const gD = stress.reduce((s, ts) => s + bump(t - (ts - 0.25), 1.0), 0);
    const glance = (a, t) => a.glances.reduce((s, g) => s + bump(t - g, 0.9), 0);
    { const a = dadu; const lat = a.lateral(); a.glances ??= [0.6, 4.8, 9.5, 14, 19]; const gl = glance(a, t);
      const talk = 0.5 + 0.5 * Math.sin(t * 0.9);
      rotBoneWorld(a.B("Torso"), axisQ(lat, a.nodSign * (0.07 + 0.02 * Math.sin(t * 1.3))));
      rotBoneWorld(a.B("Chest"), axisQ(V3(0, 1, 0), 0.04 * Math.sin(t * 0.8 + 1)));
      if (gD > 0) { rotBoneWorld(a.B("UpperArm.R"), axisQ(lat, a.armSign * 0.42 * gD)); rotBoneWorld(a.B("LowerArm.R"), axisQ(lat, a.foreSign * 0.62 * gD)); rotBoneWorld(a.B("Wrist.R"), axisQ(lat, a.foreSign * 0.25 * gD)); rotBoneWorld(a.B("Chest"), axisQ(lat, a.nodSign * 0.06 * gD)); }
      rotBoneWorld(a.B("LowerArm.L"), axisQ(lat, a.foreSign * 0.09 * talk));
      const tgt = anchors.rohan.head.clone().lerp(V3(0, 0.7, 0), 0.5 * gl); const eE = emotionState(emoD, t); a.lookAt(tgt, 1.0); a.nod(eE.nod); a.roll(eE.roll); a.nod(0.06 * gD + 0.025 * Math.sin(t * 2.1)); a.roll(0.05 * Math.sin(t * 0.55 + 0.7) + 0.04 * gD);
      const g0 = a.gazeOffset(anchors.rohan.head), g1 = a.gazeOffset(V3(0, 0.8, 0)); const k = 0.018;
      layerD.apply({ ...FS(emoD, t, lipD(t), gD), blink: a.blinkAmt(t), brow: 0.9 * gD + 0.15 * Math.sin(t * 1.7), gx: THREE.MathUtils.clamp(k * (g0.x * (1 - gl) + g1.x * gl) + 0.003 * Math.sin(t * 1.1), -0.009, 0.009), gy: THREE.MathUtils.clamp(k * (g0.y * (1 - gl) + g1.y * gl) - 0.002 * gl + 0.0015 * Math.sin(t * 0.7), -0.006, 0.006) }); }
    { const a = rohan; a.glances ??= [3.0, 8.2, 12.5, 17]; const gl = glance(a, t); const n = nods.reduce((s, tn) => s + bump(t - tn, 0.8), 0);
      const tgt = anchors.dadu.head.clone().lerp(V3(0, 0.7, 0), 0.4 * gl); const eE = emotionState(emoR, t); a.lookAt(tgt, 1.0); a.nod(eE.nod); a.roll(eE.roll); a.nod(0.2 * n); a.roll(0.04 * Math.sin(t * 0.45 + 2)); rotBoneWorld(a.B("Torso"), axisQ(a.lateral(), a.nodSign * 0.03 * n));
      const g0 = a.gazeOffset(anchors.dadu.head), g1 = a.gazeOffset(V3(0, 0.8, 0)); const k = 0.018;
      layerR.apply({ ...FS(emoR, t, null, Math.max(gD, n) * 0.5), blink: a.blinkAmt(t), brow: 0.3 * Math.max(gD, n) + 0.12 * Math.sin(t * 1.3), gx: THREE.MathUtils.clamp(k * (g0.x * (1 - gl) + g1.x * gl) + 0.003 * Math.sin(t * 0.9 + 2), -0.009, 0.009), gy: THREE.MathUtils.clamp(k * (g0.y * (1 - gl) + g1.y * gl) - 0.002 * gl, -0.006, 0.006) }); }
  }
  const gateFrame = a => measure(a);

  // ----- camera rigs (10d) -----
  const dir = (yawRad) => V3(Math.sin(yawRad), 0, Math.cos(yawRad));
  const lensFov = (mm, ar) => ar >= 1 ? 2 * Math.atan2(18 * (1 / ar), mm) : 2 * Math.atan2(18, mm); // width-based 36mm sensor for landscape/square, height-based 36mm for portrait
  const RIGS = {
    // speaker head+chest ~60% of frame height, 3/4 view, camera beside the listener, ~10-20 cm below eye level
    mcu(sp, ar, strip) { const A = anchors[sp]; const camYaw = sp === "dadu" ? A.yaw - 0.55 : A.yaw + 0.55; const mm = strip ? 38 : 45;
      const h = A.head; const fovr = lensFov(mm, ar); const dist = (strip ? 0.46 : ar >= 1 ? 0.42 : 0.56) / Math.tan(fovr / 2); const pos = h.clone().add(dir(camYaw).multiplyScalar(dist)); pos.y = h.y - 0.07; const tgt = h.clone(); tgt.y = h.y + 0.0;
      return { pos, tgt, mm, focusOn: h, dof: { aperture: 0.0045, maxblur: 0.016 } }; },
    // over the shoulder: listener's back/shoulder dark in the near corner, speaker mid-frame
    ots(sp, ar) { const lis = sp === "dadu" ? "rohan" : "dadu"; const L = anchors[lis], S = anchors[sp]; const sgn = lis === "rohan" ? 1 : -1;
      const mm = ar >= 1.5 ? 110 : ar >= 1 ? 78 : 65; const vfov = lensFov(mm, ar), ha = Math.atan(Math.tan(vfov / 2) * ar), b = 1.5;
      // lateral offset (camera arcs around the listener toward +z) chosen so the speaker lands at ~30 % and the listener's head at ~90 % of frame width
      let lat = 0.3; for (let i = 0; i < 80; i++) { if (Math.atan2(lat, b) - Math.atan2(lat, b + 3.4) >= 1.2 * ha) break; lat += 0.02; }
      const pos = L.head.clone().add(V3(sgn * b, 0.25, lat)); const dS = S.head.clone().sub(pos).setY(0), d = dS.length(); dS.normalize(); const dL = L.head.clone().sub(pos).setY(0).normalize();
      const sg = Math.sign(dS.clone().cross(dL).y) || 1; const aim = dS.clone().applyAxisAngle(V3(0, 1, 0), sg * 0.4 * ha);
      const tgt = pos.clone().add(aim.multiplyScalar(5)); const yAt = S.head.y - 0.3 * Math.tan(vfov / 2) * d; tgt.y = pos.y + (yAt - pos.y) * (5 / d);
      return { pos, tgt, mm, focusOn: S.head, dof: { aperture: 0.0022, maxblur: 0.010 }, hideFlame: true, fireScale: 0.3, rimDir: V3(sgn * 0.7, 0.8, 0.9), rimI: 3.0 }; },
    wide2(sp, ar) { const dof = { aperture: 0.0022, maxblur: 0.010 }; return ar < 1 ? { pos: V3(0.2, 1.45, 5.0), tgt: V3(0, 1.0, 0), mm: 22, focusOn: V3(0, 0.8, 0), dof } : { pos: V3(0.3, 1.2, 3.8), tgt: V3(0, 0.95, 0), mm: 26, focusOn: V3(0, 0.8, 0), dof }; },
    seat(sp, ar) { const h = anchors[sp].head; return { pos: V3(h.x, 0.6, 2.4), tgt: V3(h.x, 0.5, 0), mm: 40, focusOn: null }; },
    insert_fire(sp, ar) { return { pos: V3(0.45, 0.95, 2.1), tgt: V3(0, 0.85, 0), mm: 50, focusOn: V3(0, 0.8, 0), dof: { aperture: 0.006, maxblur: 0.02 } }; },
  };
  const rigNames = { mcu_A: ["mcu", "dadu"], mcu_B: ["mcu", "rohan"], ots_A: ["ots", "dadu"], ots_B: ["ots", "rohan"], wide2: ["wide2", "dadu"], insert_fire: ["insert_fire", "dadu"], seat_A: ["seat", "dadu"], seat_B: ["seat", "rohan"] };
  // camera for a rig at shot progress u (push 4% + 3 cm drift, sine.inOut)
  function rigCamera(name, ar, u = 0, strip = false) {
    const [k, sp] = rigNames[name]; const r = RIGS[k](sp, ar, strip); const e = sineIO(u); const pos = r.pos.clone(), tgt = r.tgt.clone();
    const toT = tgt.clone().sub(pos); pos.addScaledVector(toT, 0.04 * e); const right = V3(0, 1, 0).cross(toT.clone().normalize().multiplyScalar(-1)).normalize(); pos.addScaledVector(right, 0.03 * (e - 0.5));
    return { hideFlame: r.hideFlame, fireScale: r.fireScale, rimDir: r.rimDir, rimI: r.rimI, pos, tgt, mm: r.mm, fov: THREE.MathUtils.radToDeg(lensFov(r.mm, ar)), focus: r.focusOn ? pos.distanceTo(r.focusOn) : null, dof: r.dof };
  }
  // foreground dressing per rig: out-of-focus bushes/grass near camera (visible only when that rig is active)
  const fgGroups = {};
  async function fgFor(name, ar) {
    const key = name + (ar >= 1 ? "L" : "P"); if (fgGroups[key]) return fgGroups[key];
    const g = new THREE.Group(); g.visible = false; scene.add(g); fgGroups[key] = g; const c = rigCamera(name, ar, 0); const fwd = c.tgt.clone().sub(c.pos).setY(0).normalize(); const right = fwd.clone().cross(V3(0, 1, 0)).normalize();
    const vfov = c.fov * Math.PI / 180; const rr2 = rng(77 + name.length);
    const specs = name === "wide2" ? [[nat("Grass"), 0.7, 1.3, -1.0], [nat("Plant_2"), 0.75, 1.7, 1.15], [nat("Rock_3"), 0.3, 1.5, 0.35], [nat("Grass_2"), 0.55, 1.1, -0.35], [nat("Grass"), 0.6, 1.2, 0.8], [nat("Plant_4"), 0.6, 2.0, -1.5]]
      : name.startsWith("seat") ? [] : name.startsWith("ots") ? [[nat("Grass"), 0.55, 1.0, 0.0]] : name === "insert_fire" ? [[nat("Rock_2"), 0.35, 0.8, -0.35], [nat("Grass_Short"), 0.4, 0.9, 0.3]] : [[nat("Bush_2"), 1, 1.05, -0.2], [nat("Plant_3"), 1, 1.1, 0.22]];
    for (const [url, hh, d, lat] of specs) {
      const o = normP(toonifyP((await loadFBX(url)), "nat"), 1); const dd = d; const topY = c.pos.y + (-0.6) * dd * Math.tan(vfov / 2) * (ar >= 1 ? 0.5 : 1) ; const H = name === "wide2" ? hh : Math.max(0.3, Math.min(hh, topY));
      const sc = H; o.scale.setScalar(sc); const p = c.pos.clone().addScaledVector(fwd, dd).addScaledVector(right, lat * (ar >= 1 ? 1 : 0.35)); o.position.set(p.x, terrainH(p.x, p.z), p.z); o.rotation.y = rr2() * 6.28; g.add(o); }
    g.traverse(m => { if (m.isMesh) { const mats = [].concat(m.material).map(mm => { const c = mm.clone(); if (c.color) c.color.multiplyScalar(name === "wide2" ? 0.9 : 0.55); return c; }); m.material = Array.isArray(m.material) ? mats : mats[0]; mats.forEach(mm => { if (!(mm instanceof THREE.MeshBasicMaterial)) addSway(mm, U, 0.3, 120); }); } });
    return g;
  }
  async function prepFG(names, ars) { for (const n of names) for (const ar of ars) await fgFor(n, ar); }
  function showFG(name, ar) { for (const [k, g] of Object.entries(fgGroups)) g.visible = (k === name + (ar >= 1 ? "L" : "P")); }

  return { THREE, setWords, setShot, scene, U, key, rim, dadu, rohan, anchors, gate, gateFrame, update, rigCamera, prepFG, showFG, RIGS, rigNames, tcount, fgGroups, seatObjs, flames, stress, nods, terrainH };
}

// ---------------- renderer + post (bloom on emissive, DOF, grain, vignette) ----------------
export function makeRenderer(w, h) {
  const r = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true }); r.setPixelRatio(1); r.setSize(w, h);
  r.toneMapping = THREE.NeutralToneMapping; r.toneMappingExposure = 1.0; r.outputColorSpace = THREE.SRGBColorSpace;
  r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap; r.shadowMap.autoUpdate = false; return r;
}
export function makePost(renderer, scene, camera, w, h) {
  const bl = new THREE.Layers(); bl.set(BLOOM_LAYER); const black = new THREE.MeshBasicMaterial({ color: 0x000000 }); const blackPts = new THREE.PointsMaterial({ color: 0x000000, size: 0 }); const stash = new Map();
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
    render({ dof = null, seed = 0 } = {}) {
      bokeh.enabled = !!dof; if (dof) { bokeh.uniforms.focus.value = dof.focus; bokeh.uniforms.aperture.value = dof.aperture; bokeh.uniforms.maxblur.value = dof.maxblur; }
      grain.uniforms.uSeed.value = seed % 997;
      const bg = scene.background, fog = scene.fog; scene.background = new THREE.Color(0x000000); scene.fog = null;
      scene.traverse(o => { if ((o.isMesh || o.isPoints) && !bl.test(o.layers)) { stash.set(o, o.material); o.material = o.isPoints ? blackPts : black; } });
      bloomComposer.render(); stash.forEach((m, o) => { o.material = m; }); stash.clear(); scene.background = bg; scene.fog = fog; fin.render();
    } };
}
