// DIALOGUE engine effects for the night sets (phase 2): sky dome with Milky Way + crescent moon, shooting star, LOD faceted terrain, drifting mist, water with
// reflected moon/stars/treeline, ridge layers, car light streaks, city (Ultimate Buildings) with window lights, fireflies, elevation profile.
// All effects are allowed by PLAN section 11b; every one is a pure function of uTime (no wall clock, seeded rng, no Math.random).
import { THREE, BLOOM_LAYER, rng } from "./lib.js";
const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const gauss = R => (R() + R() + R() - 1.5) * 0.9;

export const GLSL_NOISE = `
float h3(vec3 p){ p = fract(p*0.3183099+.1); p *= 17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
float n3(vec3 x){ vec3 i=floor(x), f=fract(x); f=f*f*(3.-2.*f);
  return mix(mix(mix(h3(i),h3(i+vec3(1,0,0)),f.x), mix(h3(i+vec3(0,1,0)),h3(i+vec3(1,1,0)),f.x),f.y), mix(mix(h3(i+vec3(0,0,1)),h3(i+vec3(1,0,1)),f.x), mix(h3(i+vec3(0,1,1)),h3(i+vec3(1,1,1)),f.x),f.y), f.z); }
float fbm3(vec3 p){ float a=.5,s=0.; for(int i=0;i<5;i++){ s+=a*n3(p); p*=2.03; a*=.5; } return s; }
`;

// ---------------- sky: gradient + horizon glow + Milky Way band + stars + moon (crescent optional) ----------------
// o: {top, hor, glow:{c,a,h,dir}, milky:{n, a, c1, c2, starFrac}, stars, seed, moon:{dir, size, col, crescent, glow}, radius}
export function makeSky2(U, scene, o) {
  const R = rng(o.seed ?? 31), RAD = o.radius ?? 2800; const mw = o.milky; const md = (o.moon?.dir ?? V3(0, 1, 0)).clone().normalize();
  const mwN = (mw?.n ?? V3(0.3, 0.8, 0.5)).clone().normalize();
  const dome = new THREE.Mesh(new THREE.SphereGeometry(RAD, 48, 28), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color(o.top) }, hor: { value: new THREE.Color(o.hor) }, glowC: { value: new THREE.Color(o.glow?.c ?? "#000000") }, glowA: { value: o.glow?.a ?? 0 }, glowH: { value: o.glow?.h ?? 0.25 }, gdir: { value: (o.glow?.dir ?? V3(0, 0, -1)).clone().setY(0).normalize() },
      mwN: { value: mwN }, mwA: { value: mw?.a ?? 0 }, mwC1: { value: new THREE.Color(mw?.c1 ?? "#8FA9BF") }, mwC2: { value: new THREE.Color(mw?.c2 ?? "#A58BB0") }, mwW: { value: mw?.w ?? 0.05 }, moonC: { value: new THREE.Color(o.moon?.col ?? "#8FA9BF") }, md: { value: md }, moonK: { value: o.moon ? (o.moon.glow ?? 1) : 0 } },
    vertexShader: "varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }",
    fragmentShader: `uniform vec3 top,hor,glowC,gdir,mwN,mwC1,mwC2,moonC,md; uniform float glowA,glowH,mwA,mwW,moonK; varying vec3 vD; ${GLSL_NOISE}
    void main(){ vec3 d = normalize(vD); float h = clamp(d.y,0.0,1.0); vec3 c = mix(hor, top, smoothstep(0.0,0.6,h));
      float gw = pow(max(dot(normalize(vec3(d.x,0.0,d.z)+1e-5), gdir),0.0), 3.0); c += glowC*glowA*pow(1.0-smoothstep(0.0,glowH,max(d.y,0.0)),2.0)*mix(0.35,1.0,gw);
      if (mwA > 0.0) { float b = dot(d,mwN); float band = exp(-b*b/(mwW*mwW*2.0)); float cl = fbm3(d*3.4+7.0); float dust = fbm3(d*8.0+3.0); float core = exp(-b*b/(mwW*mwW*0.5));
        float lane = 1.0 - 0.6*smoothstep(0.45,0.72,dust); vec3 m = mix(mwC1,mwC2,smoothstep(0.3,0.8,cl)) * (band*(0.35+0.65*smoothstep(0.25,0.75,cl)) + core*0.55*cl) * lane; c += m*mwA*smoothstep(0.0,0.12,d.y); }
      float g = max(dot(d,md),0.0); c += moonC*moonK*(pow(g,80.0)*0.30 + pow(g,7.0)*0.035);
      gl_FragColor = vec4(c,1.0); }` }));
  dome.renderOrder = -10; dome.name = "sky"; dome.frustumCulled = false; scene.add(dome);
  const N = o.stars ?? 900; const pos = new Float32Array(N * 3), s = new Float32Array(N * 3); const up = Math.abs(mwN.y) > 0.9 ? V3(1, 0, 0) : V3(0, 1, 0); const e1 = mwN.clone().cross(up).normalize(), e2 = mwN.clone().cross(e1).normalize();
  for (let i = 0; i < N; i++) {
    let d; if (mw && R() < (mw.starFrac ?? 0.4)) { const ph = R() * Math.PI * 2; d = e1.clone().multiplyScalar(Math.cos(ph)).addScaledVector(e2, Math.sin(ph)).addScaledVector(mwN, gauss(R) * (mw.w ?? 0.05) * 1.6).normalize(); if (d.y < 0.03) { d.y = Math.abs(d.y) + 0.04; d.normalize(); } }
    else { const th = R() * Math.PI * 2, y = 0.04 + Math.pow(R(), 0.8) * 0.96, rr = Math.sqrt(1 - y * y); d = V3(Math.cos(th) * rr, y, Math.sin(th) * rr); }
    pos.set([d.x * RAD * 0.95, d.y * RAD * 0.95, d.z * RAD * 0.95], i * 3); s.set([R(), R(), R()], i * 3);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(pos, 3)); g.setAttribute("seed", new THREE.BufferAttribute(s, 3));
  const stars = new THREE.Points(g, new THREE.ShaderMaterial({ transparent: true, depthWrite: false, fog: false, uniforms: { uTime: U.uTime, uPx: U.uPx, uBright: { value: o.starBright ?? 1 } },
    vertexShader: "uniform float uTime,uPx; attribute vec3 seed; varying float vA; varying float vT; void main(){ vec4 mv = modelViewMatrix*vec4(position,1.0); gl_Position = projectionMatrix*mv; gl_PointSize = (1.3 + seed.x*seed.x*2.8)*uPx; vA = (0.30 + 0.70*seed.y) * (0.68 + 0.32*sin(uTime*(0.5+seed.z*1.5) + seed.x*40.0)); vT = seed.z; }",
    fragmentShader: "uniform float uBright; varying float vA; varying float vT; void main(){ float d = length(gl_PointCoord-0.5); float a = smoothstep(0.5,0.1,d); gl_FragColor = vec4(mix(vec3(0.80,0.88,1.0), vec3(1.0,0.92,0.80), vT*vT), a*vA*uBright); }" }));
  stars.frustumCulled = false; stars.renderOrder = -9; stars.name = "stars"; scene.add(stars);
  if (o.moon) {
    const rad = RAD * 0.92 * Math.tan(o.moon.size ?? 0.03);
    const moon = new THREE.Mesh(new THREE.CircleGeometry(rad, 40), new THREE.ShaderMaterial({ transparent: true, depthWrite: false, fog: false, uniforms: { col: { value: new THREE.Color(o.moon.col ?? "#C9D6E2").multiplyScalar(1.25) }, cres: { value: o.moon.crescent ?? 0 } },
      vertexShader: "varying vec2 vU; void main(){ vU = uv*2.0-1.0; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }",
      fragmentShader: "uniform vec3 col; uniform float cres; varying vec2 vU; void main(){ float r = length(vU); float disc = smoothstep(1.0,0.94,r); float cut = smoothstep(0.92,1.0,length(vU - vec2(0.52,0.18)*cres*1.5)/(0.96)); float a = cres > 0.0 ? disc*cut : disc; if (a < 0.01) discard; gl_FragColor = vec4(col, a); }" }));
    moon.position.copy(md.clone().multiplyScalar(RAD * 0.92)); moon.lookAt(0, 0, 0); moon.layers.enable(BLOOM_LAYER); moon.name = "moon"; moon.renderOrder = -8; moon.frustumCulled = false; scene.add(moon);
  }
  return { dome, stars, md, RAD };
}

// shooting star: one every `period` s, 0.9 s long, pure function of t
export function makeShootingStar(U, scene, { period = 57, phase = 31, from = V3(-0.5, 0.55, -0.7), to = V3(0.1, 0.38, -0.95), RAD = 2800, col = "#DCE8F5" } = {}) {
  const N = 14, pos = new Float32Array(N * 2 * 3), uvs = new Float32Array(N * 2 * 2), idx = []; for (let i = 0; i < N; i++) { uvs.set([i / (N - 1), -1, i / (N - 1), 1], i * 4); if (i < N - 1) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } }
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(pos, 3)); g.setAttribute("uvv", new THREE.BufferAttribute(uvs, 2)); g.setIndex(idx);
  const m = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, fog: false, side: THREE.DoubleSide, uniforms: { uTime: U.uTime, a: { value: from.clone().normalize() }, b: { value: to.clone().normalize() }, P: { value: period }, PH: { value: phase }, R: { value: RAD * 0.9 }, c: { value: new THREE.Color(col) } },
    vertexShader: `uniform float uTime,P,PH,R; uniform vec3 a,b; attribute vec2 uvv; varying float vA; varying float vS;
      void main(){ float tt = mod(uTime + PH, P); float k = tt/0.9; float on = step(0.0,k)*step(k,1.0); float head = k; float tail = max(0.0, head - 0.16*uvv.x*(1.0));
        float kk = clamp(head - 0.2*uvv.x, 0.0, 1.0); vec3 d = normalize(mix(a,b,kk)); vec3 d2 = normalize(mix(a,b,min(1.0,kk+0.02))); vec3 tang = normalize(d2-d+1e-6); vec3 side = normalize(cross(tang, d));
        float w = 5.0*(1.0-uvv.x*0.85); vec3 p = d*R + side*uvv.y*w; vec4 mv = modelViewMatrix*vec4(p,1.0); gl_Position = projectionMatrix*mv; vA = on*(1.0-uvv.x)*smoothstep(0.0,0.1,k)*(1.0-smoothstep(0.8,1.0,k)); vS = uvv.y; }`,
    fragmentShader: "uniform vec3 c; varying float vA; varying float vS; void main(){ float e = 1.0-abs(vS); gl_FragColor = vec4(c*1.6, vA*e*e); }" });
  const mesh = new THREE.Mesh(g, m); mesh.frustumCulled = false; mesh.renderOrder = -7; mesh.layers.enable(BLOOM_LAYER); mesh.name = "shootingStar"; scene.add(mesh); return mesh;
}

// ---------------- terrain: 3 LOD rings (watertight), faceted, vertex colours ----------------
// H(x,z) analytic height; color(x,z,h,R) -> THREE.Color ; rings [{half, cell}] with half multiples of the next ring's cell
export function makeTerrainLOD({ H, color, rings = [{ half: 36, cell: 1.5 }, { half: 144, cell: 6 }, { half: 1152, cell: 36 }], R }) {
  const pos = [], col = []; const c = new THREE.Color();
  rings.forEach((rg, ri) => {
    const inner = ri ? rings[ri - 1].half : 0, n = Math.round(2 * rg.half / rg.cell), next = rings[ri + 1]; const cn = next?.cell;
    const hAt = (x, z) => { if (next && (Math.abs(Math.abs(x) - rg.half) < 1e-6 || Math.abs(Math.abs(z) - rg.half) < 1e-6)) { // boundary vertex: follow the coarser ring's straight edge
        if (Math.abs(Math.abs(x) - rg.half) < 1e-6 && Math.abs(Math.abs(z) - rg.half) >= 1e-6) { const z0 = Math.floor(z / cn) * cn, t = (z - z0) / cn; return H(x, z0) * (1 - t) + H(x, z0 + cn) * t; }
        if (Math.abs(Math.abs(z) - rg.half) < 1e-6 && Math.abs(Math.abs(x) - rg.half) >= 1e-6) { const x0 = Math.floor(x / cn) * cn, t = (x - x0) / cn; return H(x0, z) * (1 - t) + H(x0 + cn, z) * t; } } return H(x, z); };
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const x0 = -rg.half + i * rg.cell, z0 = -rg.half + j * rg.cell, x1 = x0 + rg.cell, z1 = z0 + rg.cell;
      if (x0 >= -inner - 1e-6 && x1 <= inner + 1e-6 && z0 >= -inner - 1e-6 && z1 <= inner + 1e-6) continue;
      const q = [[x0, z0], [x1, z0], [x1, z1], [x0, z1]].map(([x, z]) => [x, hAt(x, z), z]);
      const diag = ((i * 7 + j * 13) % 2) === 0; const tris = diag ? [[0, 1, 2], [0, 2, 3]] : [[0, 1, 3], [1, 2, 3]];
      for (const tr of tris) { let cx = 0, cz = 0, ch = 0; tr.forEach(k => { cx += q[k][0]; cz += q[k][2]; ch += q[k][1]; }); cx /= 3; cz /= 3; ch /= 3; color(cx, cz, ch, R, c);
        // winding so that normals point up
        const [a, b, d] = tr.map(k => q[k]); const nx = (b[1] - a[1]) * (d[2] - a[2]) - (b[2] - a[2]) * (d[1] - a[1]), ny = (b[2] - a[2]) * (d[0] - a[0]) - (b[0] - a[0]) * (d[2] - a[2]); const order = ny >= 0 ? [a, b, d] : [a, d, b];
        for (const p of order) { pos.push(p[0], p[1], p[2]); col.push(c.r, c.g, c.b); } }
    }
  });
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3)); g.computeVertexNormals();
  const mesh = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true })); mesh.receiveShadow = true; mesh.name = "terrain"; mesh.frustumCulled = false; return mesh;
}

// ---------------- mist: drifting fbm fog layer (horizontal plane, world-space noise, fades near the camera) ----------------
export function makeMist(U, scene, { y, size = 1800, color = "#26354A", alpha = 0.5, speed = [1.4, 0.5], scale = 0.012, fade = [8, 40], center = [0, -300], seed = 0, renderOrder = 4 } = {}) {
  const g = new THREE.PlaneGeometry(size, size, 1, 1); g.rotateX(-Math.PI / 2);
  const m = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, fog: false, uniforms: { uTime: U.uTime, col: { value: new THREE.Color(color) }, alpha: { value: alpha }, sp: { value: new THREE.Vector2(...speed) }, sc: { value: scale }, fd: { value: new THREE.Vector2(...fade) }, ctr: { value: new THREE.Vector2(...center) }, size: { value: size }, seed: { value: seed } },
    vertexShader: "varying vec3 vW; void main(){ vec4 w = modelMatrix*vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }",
    fragmentShader: `uniform float uTime,alpha,sc,size,seed; uniform vec3 col; uniform vec2 sp,fd,ctr; varying vec3 vW; ${GLSL_NOISE}
    void main(){ vec3 p = vec3(vW.x*sc + uTime*sp.x*sc, seed*7.0, vW.z*sc + uTime*sp.y*sc); float n = fbm3(p*vec3(1.0,1.0,1.8)); n = smoothstep(0.34,0.78,n);
      float d = length(vW - cameraPosition); float f = smoothstep(fd.x, fd.y, d) * (1.0 - smoothstep(size*0.30, size*0.5, length(vW.xz-ctr)));
      float a = alpha*n*f; if (a < 0.003) discard; gl_FragColor = vec4(col, a); }` });
  const mesh = new THREE.Mesh(g, m); mesh.position.set(0, y, 0); mesh.renderOrder = renderOrder; mesh.userData.bloomHide = true; mesh.frustumCulled = false; mesh.name = "mist"; scene.add(mesh); return mesh;
}

// ---------------- elevation profile (radians, per azimuth bin) of the far world seen from `eye`: terrain H + tree height ----------------
export function elevProfile({ H, treeH = () => 0, eye = V3(0, 1.2, 0), bins = 128, d0 = 25, d1 = 1400 }) {
  const out = new Float32Array(bins);
  for (let b = 0; b < bins; b++) { const az = -Math.PI + (b + 0.5) / bins * Math.PI * 2; const dx = Math.sin(az), dz = -Math.cos(az); let best = -0.5; for (let d = d0; d < d1; d *= 1.05) { const x = eye.x + dx * d, z = eye.z + dz * d; const e = Math.atan2(H(x, z) + treeH(x, z) - eye.y, d); if (e > best) best = e; } out[b] = best; }
  return out;
}
// ---------------- water: reflected sky gradient + procedural stars + moon (broken by ripples) + far treeline silhouette from the elevation profile ----------------
export function makeWater(U, scene, { y = 0, size = 2600, deep = "#0B1620", skyTop, skyHor, bank = "#0A1320", fogCol, fogNear = 20, fogFar = 900, moonDir, moonCol = "#D5E2EE", moonSize = 0.03, profile, ripple = 1, starDensity = 0.985 } = {}) {
  const g = new THREE.PlaneGeometry(size, size, 1, 1); g.rotateX(-Math.PI / 2);
  const prof = new Float32Array(128); if (profile) prof.set(profile);
  const m = new THREE.ShaderMaterial({ fog: false, uniforms: { uTime: U.uTime, deep: { value: new THREE.Color(deep) }, skyTop: { value: new THREE.Color(skyTop) }, skyHor: { value: new THREE.Color(skyHor) }, bank: { value: new THREE.Color(bank) }, fogCol: { value: new THREE.Color(fogCol ?? skyHor) }, fogN: { value: fogNear }, fogF: { value: fogFar }, md: { value: moonDir.clone().normalize() }, moonC: { value: new THREE.Color(moonCol).multiplyScalar(1.4) }, moonCos: { value: Math.cos(moonSize * 0.9) }, rip: { value: ripple }, sd: { value: starDensity }, prof: { value: prof } },
    vertexShader: "varying vec3 vW; void main(){ vec4 w = modelMatrix*vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }",
    fragmentShader: `uniform float uTime,fogN,fogF,moonCos,rip,sd; uniform vec3 deep,skyTop,skyHor,bank,fogCol,md,moonC; uniform float prof[128]; varying vec3 vW; ${GLSL_NOISE}
    float profAt(float az){ float f = (az + 3.14159265)/6.2831853*128.0 - 0.5; float i0 = floor(f); float t = f - i0; int a = int(mod(i0,128.0)); int b = int(mod(i0+1.0,128.0)); return mix(prof[a], prof[b], t); }
    void main(){
      vec3 v = vW - cameraPosition; float dist = length(v); v /= dist; vec2 p = vW.xz; float k = rip*0.045/(1.0+dist*0.012); float t = uTime;
      vec2 gr = vec2(0.0);
      gr += vec2(0.8,0.2)*cos(dot(p,vec2(0.8,0.2))*2.7 + t*0.9) + vec2(-0.3,0.9)*cos(dot(p,vec2(-0.3,0.9))*3.9 - t*1.1)*0.7 + vec2(0.6,-0.7)*cos(dot(p,vec2(0.6,-0.7))*6.3 + t*1.7)*0.45 + vec2(0.1,1.0)*cos(dot(p,vec2(0.1,1.0))*1.3 + t*0.5)*1.2;
      vec3 n = normalize(vec3(-gr.x*k, 1.0, -gr.y*k)); vec3 r = reflect(v, n); r.y = max(r.y, 0.002);
      float h = clamp(r.y,0.0,1.0); vec3 sky = mix(skyHor, skyTop, smoothstep(0.0,0.6,h));
      vec3 q = r*150.0; vec3 ip = floor(q); float hs = h3(ip); float st = step(sd, hs) * smoothstep(0.42,0.0,length(fract(q)-0.5)) * (0.55+0.45*sin(t*(0.6+hs*3.0)+hs*90.0)); sky += vec3(0.8,0.9,1.0)*st*0.9;
      float g = max(dot(r,md),0.0); sky += moonC*(smoothstep(moonCos, moonCos+0.0008, g)*1.0 + pow(g,400.0)*0.5 + pow(g,40.0)*0.04);
      float az = atan(r.x, -r.z); float e = profAt(az); float sil = 1.0 - smoothstep(e-0.006, e+0.003, atan(r.y, length(r.xz))); sky = mix(sky, bank, sil*0.92);
      float F = 0.03 + 0.97*pow(1.0 - max(dot(n,-v),0.0), 5.0); vec3 c = mix(deep, sky, clamp(F*1.15,0.0,1.0));
      c = mix(c, fogCol, smoothstep(fogN, fogF, dist)); gl_FragColor = vec4(c, 1.0); }` });
  const mesh = new THREE.Mesh(g, m); mesh.position.y = y; mesh.name = "water"; mesh.frustumCulled = false; scene.add(mesh); return mesh;
}

// ---------------- ridge layers: faceted silhouette strips across the view + pines along the crest ----------------
export function makeRidgeStrip(scene, { z, hp, x0 = -900, x1 = 900, step = 22, base = -120, color = "#1A2536", R, jitter = 0.04 }) {
  const pos = [], col = []; const c0 = new THREE.Color(color), c = new THREE.Color(); const n = Math.round((x1 - x0) / step);
  for (let i = 0; i < n; i++) { const xa = x0 + i * step, xb = xa + step; const ya = hp(xa), yb = hp(xb); const j = 1 + (R() - 0.5) * jitter * 2;
    const q = [[xa, ya, z], [xb, yb, z], [xb, base, z], [xa, base, z]]; for (const tri of [[0, 1, 2], [0, 2, 3]]) for (const k of tri) { pos.push(...q[k]); const sh = j * (k === 0 || k === 1 ? 1 : 0.82); col.push(c0.r * sh, c0.g * sh, c0.b * sh); } }
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  const mesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide })); mesh.frustumCulled = false; mesh.name = "ridge"; scene.add(mesh); return mesh;
}

// ---------------- roads + car light streaks (cylindrical billboards along a polyline) ----------------
export function makeRoadCars(U, scene, { pts, width = 12, color = "#12181F", n = 18, speed = [14, 24], laneW = 2.6, height = 0.9, len = 14, seed = 5, head = "#FFE0A8", tail = "#D65F2A", emissiveRoad = null } = {}) {
  const R = rng(seed); const P = pts.map(p => V3(...p)); const cum = [0]; for (let i = 1; i < P.length; i++) cum.push(cum[i - 1] + P[i].distanceTo(P[i - 1])); const total = cum[cum.length - 1];
  { const pos = [], idx = []; for (let i = 0; i < P.length; i++) { const t = (P[Math.min(P.length - 1, i + 1)].clone().sub(P[Math.max(0, i - 1)])).setY(0).normalize(); const s = V3(-t.z, 0, t.x).multiplyScalar(width / 2); pos.push(P[i].x - s.x, P[i].y + 0.05, P[i].z - s.z, P[i].x + s.x, P[i].y + 0.05, P[i].z + s.z); if (i < P.length - 1) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); const road = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: new THREE.Color(color), side: THREE.DoubleSide })); road.frustumCulled = false; road.name = "road"; scene.add(road); }
  const NP = P.length; const seeds = new Float32Array(n * 4 * 4), corners = new Float32Array(n * 4 * 2), pos = new Float32Array(n * 4 * 3), idx = [];
  for (let i = 0; i < n; i++) { const s = [R(), speed[0] + R() * (speed[1] - speed[0]), R() < 0.5 ? 1 : -1, R()]; for (let k = 0; k < 4; k++) { seeds.set(s, (i * 4 + k) * 4); corners.set([k & 1, k < 2 ? -1 : 1], (i * 4 + k) * 2); } idx.push(i * 4, i * 4 + 1, i * 4 + 2, i * 4 + 1, i * 4 + 3, i * 4 + 2); }
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(pos, 3)); g.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 4)); g.setAttribute("aCorner", new THREE.BufferAttribute(corners, 2)); g.setIndex(idx);
  const padP = Array.from({ length: 16 }, (_, i) => P[Math.min(i, NP - 1)]), padC = Array.from({ length: 16 }, (_, i) => cum[Math.min(i, NP - 1)]);
  const m = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, side: THREE.DoubleSide, uniforms: { uTime: U.uTime, uP: { value: padP }, uC: { value: padC }, uN: { value: NP }, uTot: { value: total }, uLane: { value: laneW }, uH: { value: height }, uLen: { value: len }, cH: { value: new THREE.Color(head).multiplyScalar(1.5) }, cT: { value: new THREE.Color(tail).multiplyScalar(1.5) } },
    vertexShader: `uniform float uTime,uTot,uLane,uH,uLen; uniform vec3 uP[16]; uniform float uC[16]; uniform int uN; attribute vec4 aSeed; attribute vec2 aCorner; varying vec2 vUV; varying float vDir;
      vec3 along(float s, out vec3 T){ vec3 p = uP[0]; T = vec3(1.0,0.0,0.0); for(int i=0;i<15;i++){ if(i+1>=uN) break; if(s>=uC[i] && s<=uC[i+1]){ float t=(s-uC[i])/max(1e-3,uC[i+1]-uC[i]); p = mix(uP[i],uP[i+1],t); T = normalize(uP[i+1]-uP[i]); } } return p; }
      void main(){ float dir = aSeed.z; float s = mod(aSeed.x*uTot + dir*uTime*aSeed.y, uTot); if(s<0.0) s+=uTot; vec3 T; vec3 c = along(s, T); vec3 sd = vec3(-T.z,0.0,T.x); c += sd*uLane*0.5*dir + vec3(0.0,uH,0.0); vec3 Td = T*dir;
        float L = uLen*(0.6+0.8*aSeed.w); vec3 e = c + Td*L*(aCorner.x-0.5)*2.0*0.5; vec3 vdir = normalize(cameraPosition - e); vec3 side = normalize(cross(T, vdir)); vec3 pw = e + side*aCorner.y*0.9; gl_Position = projectionMatrix*viewMatrix*vec4(pw,1.0); vUV = aCorner; vDir = dir; }`,
    fragmentShader: "uniform vec3 cH,cT; varying vec2 vUV; varying float vDir; void main(){ float along = vDir>0.0 ? vUV.x : 1.0-vUV.x; float a = pow(1.0-abs(vUV.y),1.6) * (0.15 + 0.85*pow(along,1.5)); vec3 c = vDir>0.0 ? cH : cT; gl_FragColor = vec4(c, a); }" });
  const mesh = new THREE.Mesh(g, m); mesh.frustumCulled = false; mesh.layers.enable(BLOOM_LAYER); mesh.name = "cars"; scene.add(mesh); return mesh;
}

// ---------------- window lights: emissive points on building facades, rare on/off ----------------
export function makeWindows(U, scene, wins, { warm = "#F3BF63", cool = "#86C6D8", size = 2.4, period = [40, 140], pOn = 0.38, atten = 0, gain = 1 } = {}) {
  const N = wins.length / 4; const pos = new Float32Array(N * 3), sd = new Float32Array(N * 4); const R = rng(404);
  for (let i = 0; i < N; i++) { pos.set([wins[i * 4], wins[i * 4 + 1], wins[i * 4 + 2]], i * 3); sd.set([R(), R(), R(), wins[i * 4 + 3]], i * 4); }
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(pos, 3)); g.setAttribute("seed", new THREE.BufferAttribute(sd, 4));
  const m = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, uniforms: { uTime: U.uTime, uPx: U.uPx, warm: { value: new THREE.Color(warm).multiplyScalar(1.6 * gain) }, cool: { value: new THREE.Color(cool).multiplyScalar(1.5 * gain) }, per: { value: new THREE.Vector2(...period) }, pOn: { value: pOn }, size: { value: size }, ref: { value: atten } },
    vertexShader: `uniform float uTime,uPx,size,pOn,ref; uniform vec2 per; attribute vec4 seed; varying float vA; varying float vW; float hh(float a){ return fract(sin(a*127.1)*43758.5453); }
      void main(){ vec4 mv = modelViewMatrix*vec4(position,1.0); gl_Position = projectionMatrix*mv; float P = mix(per.x, per.y, seed.x); float ph = uTime/P + seed.z*100.0; float slot = floor(ph); float f = fract(ph);
        float on0 = step(hh(seed.y*91.0+slot), pOn); float on1 = step(hh(seed.y*91.0+slot+1.0), pOn); float k = smoothstep(0.97,1.0,f); float on = mix(on0,on1,k);
        gl_PointSize = (size*(0.8+0.6*seed.y))*uPx*(ref>0.0 ? clamp(ref/max(1.0,-mv.z),0.55,2.6) : 1.0); vA = on*(0.55+0.45*seed.x); vW = seed.w; }`,
    fragmentShader: "uniform vec3 warm,cool; varying float vA; varying float vW; void main(){ float d = length(gl_PointCoord-0.5); float a = smoothstep(0.5,0.15,d); if (vA*a < 0.01) discard; gl_FragColor = vec4(mix(warm,cool,vW), a*vA); }" });
  const pts = new THREE.Points(g, m); pts.frustumCulled = false; pts.layers.enable(BLOOM_LAYER); pts.name = "windows"; scene.add(pts); return pts;
}

// ---------------- fireflies (<= 12): lissajous paths around anchor points, blinking ----------------
export function makeFireflies(U, scene, { anchors, color = "#E6D26C", size = 5.5, spread = [1.4, 0.5, 1.2], seed = 12 } = {}) {
  const R = rng(seed), N = anchors.length; const pos = new Float32Array(N * 3), sd = new Float32Array(N * 4), an = new Float32Array(N * 3);
  anchors.forEach((a, i) => { an.set(a, i * 3); sd.set([R(), R(), R(), R()], i * 4); });
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(pos, 3)); g.setAttribute("seed", new THREE.BufferAttribute(sd, 4)); g.setAttribute("anchor", new THREE.BufferAttribute(an, 3));
  const m = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, uniforms: { uTime: U.uTime, uPx: U.uPx, col: { value: new THREE.Color(color).multiplyScalar(1.7) }, sz: { value: size }, sp: { value: new THREE.Vector3(...spread) } },
    vertexShader: `uniform float uTime,uPx,sz; uniform vec3 sp; attribute vec4 seed; attribute vec3 anchor; varying float vA;
      void main(){ float t = uTime*(0.25+seed.x*0.2); vec3 p = anchor + vec3(sin(t*1.3+seed.y*6.28)*sp.x*seed.z, sin(t*0.9+seed.w*6.28)*sp.y + 0.2*sin(t*2.1), cos(t*1.1+seed.x*6.28)*sp.z*seed.w);
        vec4 mv = modelViewMatrix*vec4(p,1.0); gl_Position = projectionMatrix*mv; gl_PointSize = sz*uPx*(0.7+0.5*seed.y); float b = sin(uTime*(0.9+seed.z*0.8)+seed.x*30.0); vA = smoothstep(0.1,0.9,b*0.5+0.5)*(0.6+0.4*seed.w); }`,
    fragmentShader: "uniform vec3 col; varying float vA; void main(){ float d = length(gl_PointCoord-0.5); float a = smoothstep(0.5,0.0,d); gl_FragColor = vec4(col, a*a*vA); }" });
  const pts = new THREE.Points(g, m); pts.frustumCulled = false; pts.layers.enable(BLOOM_LAYER); pts.name = "fireflies"; scene.add(pts); return pts;
}

// ---------------- city of Ultimate Buildings: instanced dark silhouettes + window light points ----------------
// ctx: engine ctx; opts: {files:[...], cells:[{x,z,y,h,yaw,file}], tint}
export async function makeCity(ctx, { cells, tint = "#1B2438", roof = "#232C42", scene = ctx.scene } = {}) {
  const { THREE: T, loadFBX, bld } = ctx; const byFile = {}; cells.forEach(c => (byFile[c.file] ??= []).push(c)); const wins = []; const R = rng(77);
  const M = new T.Matrix4(), Q = new T.Quaternion(), S = new T.Vector3(), col = new T.Color();
  for (const [file, items] of Object.entries(byFile)) {
    const obj = await loadFBX(bld(file)); obj.updateMatrixWorld(true); const b = new T.Box3().setFromObject(obj), sz = b.getSize(new T.Vector3()), ct = b.getCenter(new T.Vector3());
    const subs = []; obj.traverse(m => { if (m.isMesh) subs.push(m); });
    for (const m of subs) {
      const geo = m.geometry.clone().applyMatrix4(m.matrixWorld); const ms = [].concat(m.material).map(mm => { const c = new T.Color(); mm.color ? c.copy(mm.color) : c.set("#888888"); const hsl = {}; c.getHSL(hsl); const isRoof = /roof|dark|black/i.test(mm.name) || hsl.l < 0.25; const base = new T.Color(isRoof ? roof : tint); return new T.MeshLambertMaterial({ color: base, flatShading: true }); });
      const im = new T.InstancedMesh(geo, Array.isArray(m.material) ? ms : ms[0], items.length); im.frustumCulled = false;
      items.forEach((it, i) => { const k = it.h / sz.y, kx = k * (it.sx ?? 1); Q.setFromEuler(new T.Euler(0, it.yaw, 0)); S.set(kx, k, kx); const Pm = new T.Matrix4().compose(new T.Vector3(it.x, it.y, it.z), Q, new T.Vector3(1, 1, 1)); const B = new T.Matrix4().makeScale(kx, k, kx).multiply(new T.Matrix4().makeTranslation(-ct.x, -b.min.y, -ct.z)); M.multiplyMatrices(Pm, B); im.setMatrixAt(i, M); const v = it.tint ?? 1; im.setColorAt(i, col.setRGB(v, v, v)); });
      im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; im.name = "city_" + file; scene.add(im);
    }
    // window points on the +z facade and both sides, from the scaled footprint
    for (const it of items) { const k = it.h / sz.y, w = sz.x * k * (it.sx ?? 1), d = sz.z * k * (it.sx ?? 1), hh = it.h; const cols = Math.max(1, Math.floor(w / 3.4)), floors = Math.max(1, Math.floor(hh / 3.6)); const cs = Math.cos(it.yaw), sn = Math.sin(it.yaw);
      const faces = [[0, d / 2 + 0.2, 1, 0, cols], [w / 2 + 0.2, 0, 0, 1, Math.max(1, Math.floor(d / 3.4))]]; if (R() < 0.5) faces.push([-w / 2 - 0.2, 0, 0, 1, Math.max(1, Math.floor(d / 3.4))]);
      for (const [ox, oz, ax, az, nc] of faces) for (let f = 0; f < floors; f++) for (let cI = 0; cI < nc; cI++) { if (R() > 0.7) continue; const u = (cI + 0.5) / nc - 0.5; const lx = ox + ax * u * w * 0.86, lz = oz + az * u * d * 0.86; const wx = it.x + lx * cs + lz * sn, wz = it.z - lx * sn + lz * cs; wins.push(wx, it.y + 2.0 + f * (hh - 3.5) / Math.max(1, floors), wz, R() < 0.3 ? 1 : 0); } }
  }
  return { windows: wins };
}
