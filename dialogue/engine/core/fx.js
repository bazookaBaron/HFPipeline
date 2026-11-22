// Effects ported verbatim from spike1/world.js (campfire embers, smoke, sky dome + stars + moon). Pure functions of uTime.
import { THREE, PAL, BLOOM_LAYER } from "./lib.js";
// ---------------- fire life: embers, sparks, smoke (effects; pure functions of uTime) ----------------
export function makeEmbers(U, R, scene) {
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
export function makeSmoke(U, R, scene) {
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
export function makeSky(U, R, scene, moonDir) {
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

