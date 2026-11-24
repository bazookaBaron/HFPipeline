// Standalone 2.5D set sample: AI plate + depth -> layered mesh, Quaternius cast, rain, mist, bloom, camera move.
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

const Q = new URLSearchParams(location.search);
const W = +Q.get("w") || 1920, H = +Q.get("h") || 1080;
const PLATE = Q.get("plate") || "cand_11";
const CFG = JSON.parse(Q.get("cfg") || "{}");
const C = Object.assign({
  fov: 50, zn: 2.2, zf: 70, cut: 0.012, crop: 0.88, yaw: 0,
  a: [0.53, 0.745], b: [0.645, 0.745],        // character foot pixels (u,v)
  push: 0.9, orbit: 0.35, crane: 0.12, T: 8,
  look: [0.5, 0.55],                          // look-at pixel
}, CFG);

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setSize(W, H); renderer.setPixelRatio(1);
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x0b1220);
const camera = new THREE.PerspectiveCamera(C.fov * C.crop, W / H, 0.05, 500);

async function f32(url) { return new Float32Array(await (await fetch(url)).arrayBuffer()); }
const tl = new THREE.TextureLoader();
const tex = u => new Promise(r => tl.load(u, t => { t.colorSpace = THREE.SRGBColorSpace; t.minFilter = THREE.LinearFilter; t.generateMipmaps = false; r(t); }));

const plateTex = await tex(`plates/${PLATE}.png`), bgTex = await tex(`plates/${PLATE}_bg.png`);
const PW = plateTex.image.width, PH = plateTex.image.height, PA = PW / PH;
const dArr = await f32(`plates/${PLATE}_depth.f32`), bArr = await f32(`plates/${PLATE}_bgdepth.f32`);
const dtex = a => { const t = new THREE.DataTexture(a, PW, PH, THREE.RedFormat, THREE.FloatType); t.minFilter = t.magFilter = THREE.LinearFilter; t.needsUpdate = true; return t; };
const dTex = dtex(dArr), bTex = dtex(bArr);

// pixel -> camera-space point (camera rest pose at origin looking -z)
const tanH = Math.tan(THREE.MathUtils.degToRad(C.fov) / 2);
const zOf = d => 1 / (d * (1 / C.zn - 1 / C.zf) + 1 / C.zf);
function sampleD(u, v) { const x = Math.min(PW - 1, Math.round(u * (PW - 1))), y = Math.min(PH - 1, Math.round(v * (PH - 1))); return dArr[y * PW + x]; }
function pix3(u, v) { const z = zOf(sampleD(u, v)); return new THREE.Vector3((u - 0.5) * 2 * tanH * PA * z, (0.5 - v) * 2 * tanH * z, -z); }

const vs = /* glsl */`
  uniform sampler2D dmap; uniform float zn, zf, tanH, pa, push, texel; varying vec2 vUv; varying float vStretch; varying float vZ;
  float zof(float d){ return 1.0/(d*(1.0/zn-1.0/zf)+1.0/zf); }
  float D(vec2 uv){ return texture2D(dmap, vec2(uv.x, 1.0-uv.y)).r; }
  void main(){
    vUv = uv; float d = D(uv);
    float s = 0.0; vec2 o = vec2(texel*2.0, texel*2.0*pa);
    s = max(s, abs(d-D(uv+vec2(o.x,0.)))); s = max(s, abs(d-D(uv-vec2(o.x,0.))));
    s = max(s, abs(d-D(uv+vec2(0.,o.y)))); s = max(s, abs(d-D(uv-vec2(0.,o.y))));
    vStretch = s; float z = zof(d)*push; vZ = z;
    vec3 p = vec3((uv.x-0.5)*2.0*tanH*pa*z, (uv.y-0.5)*2.0*tanH*z, -z);
    gl_Position = projectionMatrix*modelViewMatrix*vec4(p,1.0);
  }`;
const fs = /* glsl */`
  uniform sampler2D map, dmap; uniform float t, cut, front, texel, pa; varying vec2 vUv; varying float vStretch; varying float vZ;
  float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
  void main(){
    if (front > 0.5) { vec2 fu = vec2(vUv.x, 1.0-vUv.y); float d0 = texture2D(dmap, fu).r; float o = texel*1.5;
      float s = max(max(abs(d0-texture2D(dmap, fu+vec2(o,0.)).r), abs(d0-texture2D(dmap, fu-vec2(o,0.)).r)),
                    max(abs(d0-texture2D(dmap, fu+vec2(0.,o*pa)).r), abs(d0-texture2D(dmap, fu-vec2(0.,o*pa)).r)));
      if (s > cut*0.6 || vStretch > cut*1.6) discard; }
    vec4 c = texture2D(map, vUv);
    float lum = dot(c.rgb, vec3(0.299,0.587,0.114));
    // lantern / neon flicker: bright warm-ish pixels breathe per 24px cell
    vec2 cell = floor(vUv*vec2(56.0,32.0));
    float ph = h(cell)*6.283, sp = 1.5+h(cell+7.0)*3.0;
    float fl = 0.5+0.5*sin(t*sp+ph) * (0.6+0.4*sin(t*sp*2.7+ph*1.3));
    float glow = smoothstep(0.55, 0.9, lum);
    c.rgb *= 1.0 + glow*(0.10 + 0.22*fl);
    // wet road glints in lower half
    float wet = smoothstep(0.55, 0.85, 1.0-vUv.y) * smoothstep(0.5, 0.8, lum);
    float g = step(0.985, h(floor(vUv*vec2(400.0,220.0)) + floor(t*12.0)));
    c.rgb += wet*g*0.35;
    gl_FragColor = c;
    #include <colorspace_fragment>
  }`;
function layer(map, dmap, front, push) {
  const g = new THREE.PlaneGeometry(1, 1, 900, Math.round(900 / PA)); g.translate(0.5, 0.5, 0);
  const m = new THREE.ShaderMaterial({ vertexShader: vs, fragmentShader: fs,
    uniforms: { map: { value: map }, dmap: { value: dmap }, zn: { value: C.zn }, zf: { value: C.zf }, tanH: { value: tanH }, pa: { value: PA },
      push: { value: push }, texel: { value: 1 / PW }, t: { value: 0 }, cut: { value: C.cut }, front: { value: front } } });
  const mesh = new THREE.Mesh(g, m); mesh.frustumCulled = false; scene.add(mesh); return m;
}
const mats = [layer(bgTex, bTex, 0, 1.03), layer(plateTex, dTex, 1, 1.0)];

// ---------- cast ----------
const RAW = "/raw/";
const castDef = [
  { url: RAW + "drive-download-20261109T120752Z-1-001/glTF/Casual_Male.gltf", clip: "Idle", h: 1.74, at: C.a, face: C.b, off: 0.0 },
  { url: RAW + "drive-download-20261109T120752Z-1-001/glTF/Casual_Female.gltf", clip: "Idle", h: 1.64, at: C.b, face: C.a, off: 0.7 },
];
const loader = new GLTFLoader(); const mixers = []; const heads = [];
const blobTex = (() => { const c = document.createElement("canvas"); c.width = c.height = 128; const x = c.getContext("2d");
  const g = x.createRadialGradient(64, 64, 2, 64, 64, 62); g.addColorStop(0, "rgba(0,0,0,0.85)"); g.addColorStop(1, "rgba(0,0,0,0)"); x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c); })();
for (const cd of castDef) {
  const gl = await new Promise((r, j) => loader.load(cd.url, r, undefined, j));
  const o = gl.scene; const bb = new THREE.Box3().setFromObject(o); const s = cd.h / (bb.max.y - bb.min.y);
  o.scale.setScalar(s); const p = pix3(...cd.at); o.position.copy(p); o.position.y -= bb.min.y * s;
  const q = pix3(...cd.face); const dir = new THREE.Vector3(q.x - p.x, 0, q.z - p.z).normalize();
  // face partner, turned 35 deg toward camera
  const ang = Math.atan2(dir.x, dir.z); const toCam = Math.atan2(-p.x, -p.z);
  o.rotation.y = ang + (toCam - ang) * 0.35 + C.yaw;
  o.traverse(n => { if (n.isMesh) { n.castShadow = false; n.frustumCulled = false; if (n.material) { n.material.roughness = 0.75; n.material.metalness = 0; } }
    if (n.isBone && /^head$/i.test(n.name)) heads.push({ bone: n, base: n.quaternion.clone(), off: cd.off }); });
  scene.add(o);
  const mx = new THREE.AnimationMixer(o); const clip = gl.animations.find(a => a.name === cd.clip) || gl.animations[0];
  mx.clipAction(clip).play(); mixers.push({ mx, off: cd.off });
  const blob = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.55), new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false }));
  blob.rotation.x = -Math.PI / 2; blob.position.set(p.x, p.y + 0.01, p.z); scene.add(blob);
}
// lights tuned to a warm-lantern / cool-fog plate
scene.add(new THREE.HemisphereLight(0x8fb8d8, 0x5a3a24, 1.6));
const fill = new THREE.DirectionalLight(0xffc89a, 1.4); fill.position.set(0.5, 1.5, 2); scene.add(fill);
const key = new THREE.PointLight(0xffa860, 30, 12, 1.6); const mid = pix3(...C.a).add(pix3(...C.b)).multiplyScalar(0.5);
key.position.copy(mid).add(new THREE.Vector3(-1.2, 2.6, 1.0)); scene.add(key);
const rim = new THREE.DirectionalLight(0x8fd0ff, 1.6); rim.position.copy(mid).add(new THREE.Vector3(1, 3, -6)); rim.target.position.copy(mid); scene.add(rim, rim.target);
const neon = new THREE.PointLight(0xff3d7a, 10, 8, 1.8); neon.position.copy(mid).add(new THREE.Vector3(2.2, 1.8, -1.5)); scene.add(neon);

// ---------- rain (deterministic) ----------
const N = 5000, rp = new Float32Array(N * 6), seeds = [];
let sd = 1234567; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
for (let i = 0; i < N; i++) seeds.push([rnd() * 14 - 7, rnd() * 9, -1.5 - rnd() * 28, 0.6 + rnd() * 0.5]);
const rg = new THREE.BufferGeometry(); rg.setAttribute("position", new THREE.BufferAttribute(rp, 3));
const rain = new THREE.LineSegments(rg, new THREE.LineBasicMaterial({ color: 0xbfd8ff, transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, depthWrite: false }));
rain.frustumCulled = false; scene.add(rain);
function updRain(t) {
  for (let i = 0; i < N; i++) { const [x, y0, z, sp] = seeds[i]; const fall = 11 * sp; let y = ((y0 - t * fall) % 9 + 9) % 9 - 1.2;
    const dx = 0.25 * sp, L = 0.32 * sp; const k = i * 6; rp[k] = x; rp[k + 1] = y; rp[k + 2] = z; rp[k + 3] = x + dx * 0.03; rp[k + 4] = y + L; rp[k + 5] = z; }
  rg.attributes.position.needsUpdate = true;
}

// ---------- drifting mist planes ----------
const mistMat = z => new THREE.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: { t: { value: 0 }, z: { value: z } },
  vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);} `,
  fragmentShader: `uniform float t,z; varying vec2 vUv;
    float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
    float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}
    void main(){ vec2 p=vUv*vec2(3.0,1.5)+vec2(t*0.03+z,0.0); float f=n(p)*0.6+n(p*2.3)*0.3+n(p*5.1)*0.1;
      float a=smoothstep(0.45,0.85,f)*smoothstep(0.0,0.35,vUv.y)*smoothstep(1.0,0.5,vUv.y)*smoothstep(0.0,0.25,vUv.x)*smoothstep(1.0,0.75,vUv.x)*0.22; gl_FragColor=vec4(vec3(0.62,0.74,0.86),a);} ` });
const mists = [];
for (const [z, y] of [[-5, 0.4], [-11, 0.8], [-18, 1.4]]) { const m = new THREE.Mesh(new THREE.PlaneGeometry(z * -3.2, 3.5), mistMat(-z * 0.13)); m.position.set(0, y, z); scene.add(m); mists.push(m); }

// ---------- post ----------
const composer = new EffectComposer(renderer); composer.setSize(W, H);
composer.addPass(new RenderPass(scene, camera));
composer.addPass(new UnrealBloomPass(new THREE.Vector2(W, H), 0.55, 0.65, 0.86));
composer.addPass(new OutputPass());
const grade = new ShaderPass({ uniforms: { tDiffuse: { value: null }, t: { value: 0 } },
  vertexShader: `varying vec2 vUv; void main(){vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
  fragmentShader: `uniform sampler2D tDiffuse; uniform float t; varying vec2 vUv;
    float h(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}
    void main(){ vec2 c=vUv-0.5; float r=dot(c,c);
      vec3 col=vec3(texture2D(tDiffuse,vUv+c*0.0025).r, texture2D(tDiffuse,vUv).g, texture2D(tDiffuse,vUv-c*0.0025).b);
      col*=1.0-r*0.9; col+= (h(vUv*vec2(1920.,1080.)+t)-0.5)*0.035; gl_FragColor=vec4(col,1.0);} ` });
composer.addPass(grade);

// ---------- camera move ----------
const ease = x => x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
const look = pix3(...C.look); const tgt = mid.clone().lerp(look, 0.35);
function camAt(t) {
  const e = ease(Math.min(1, Math.max(0, t / C.T)));
  const dirTo = tgt.clone().normalize();
  camera.position.set(-C.orbit + 2 * C.orbit * e, C.crane * (1 - e), 0).addScaledVector(dirTo, C.push * e);
  const yawT = Math.atan2(-(tgt.x - camera.position.x), -(tgt.z - camera.position.z));
  camera.rotation.set(0, yawT * 0.6, 0); camera.updateMatrixWorld();
}

window.renderAt = t => {
  camAt(t); updRain(t);
  for (const m of mats) m.uniforms.t.value = t;
  for (const m of mists) m.material.uniforms.t.value = t;
  for (const { mx, off } of mixers) mx.setTime(t + off);
  for (const hd of heads) { const a = Math.sin((t + hd.off) * 1.7) * 0.06, b = Math.sin((t + hd.off) * 0.9 + 1) * 0.08;
    hd.bone.quaternion.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(a, b, 0))); }
  key.intensity = 30 * (0.92 + 0.08 * Math.sin(t * 7.3) * Math.sin(t * 3.1));
  grade.uniforms.t.value = t; composer.render();
};
window.renderAt(0);
window.__info = { PW, PH, castFeet: castDef.map(c => pix3(...c.at).toArray().map(v => +v.toFixed(2))) };
window.__ready = true;
