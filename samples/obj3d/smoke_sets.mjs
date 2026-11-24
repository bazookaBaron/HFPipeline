// Headless smoke test for sets/composer.js (buildSet), sets/rooms.js (buildRoom: room + street) and map3d.js (buildMap).
//   node samples/obj3d/smoke_sets.mjs [stillName]      (heavy: run via  node runtime/jobq.js --kind render -- node samples/obj3d/smoke_sets.mjs)
// Builds one room set, one street set, one landscape set and the map from a tiny inline plan, reports errors / contract problems,
// renders ONE still per set (+ map) to samples/obj3d/out/smoke/*.png. Mounts: /three/ -> runtime/vendor/three/, geo = tiny synthetic geojson (no downloads).
import http from "http"; import fs from "fs"; import path from "path"; import { fileURLToPath } from "url"; import { createRequire } from "module";
const here = path.dirname(fileURLToPath(import.meta.url)), REPO = path.resolve(here, "../.."), OUT = path.join(here, "out/smoke"); fs.mkdirSync(OUT, { recursive: true });
const require = createRequire(path.join(REPO, "package.json")); const puppeteer = require("puppeteer-core");
const CHROME = "C:/Users/debna/.cache/puppeteer/chrome-headless-shell/win64-146.0.7680.153/chrome-headless-shell-win64/chrome-headless-shell.exe";
const MOUNTS = { "/three/": path.join(REPO, "runtime/vendor/three/"), "/": here + "/" };
const MIME = { ".js": "text/javascript", ".mjs": "text/javascript", ".html": "text/html", ".json": "application/json", ".png": "image/png" };
const PLAN = {
  cast: { jensen: { build: 1.05, hair: "short", coat: true, tie: false } },
  sets: [
    { id: "board", type: "boardroom", seed: 3, people: [{ id: "ceo", char: "jensen", pose: "speak", at: "end:table:1" }], focus: "ceo" },
    { id: "rally", type: "rally", seed: 6, focus: "speaker" },
    { id: "coast", ground: { kind: "coast", seed: 5, size: 220 }, place: [{ what: "town", where: "shore", focus: true, name: "port" }, { what: "tower", n: 3, where: "near port" }, { what: "trees", n: 40, where: "inland" }, { what: "containerShip", where: "offshore" }], light: { time: "morning" } },
  ],
  map: { bounds: [-10, 40, 30, 60], center: [15, 45], k: 0.5, highlight: ["AAA"], routes: { r1: { pts: [[-5, 40], [10, 50], [30, 55]] } }, pins: { p1: [10, 50] }, signs: [["p1", "POINT", 10, 50, 1.5, 1.2]] },
};
// two blocky fake countries (GeoJSON) so buildMap has geometry without any download
const GEO = { type: "FeatureCollection", features: [
  { type: "Feature", properties: { ISO_A3: "AAA" }, geometry: { type: "Polygon", coordinates: [[[-8, 35], [20, 36], [22, 52], [0, 58], [-9, 48], [-8, 35]]] } },
  { type: "Feature", properties: { ISO_A3: "BBB" }, geometry: { type: "Polygon", coordinates: [[[22, 38], [38, 40], [36, 56], [24, 54], [22, 38]]] } }] };
const HTML = `<!doctype html><html><head><meta charset=utf-8><script type="importmap">{"imports":{"three":"/three/build/three.module.js","three/addons/":"/three/jsm/"}}</script></head><body style="margin:0"><script type="module">
import * as THREE from "three";
import { buildSet } from "/sets/composer.js"; import { buildRoom, ARCH } from "/sets/rooms.js"; import { buildMap } from "/map3d.js";
const PLAN = ${JSON.stringify(PLAN)}, GEO = ${JSON.stringify(GEO)}, W = 1280, H = 720, errs = [], rep = {};
window.addEventListener("error", e => errs.push("window: " + e.message)); window.addEventListener("unhandledrejection", e => errs.push("promise: " + e.reason));
const r = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true }); r.setSize(W, H); r.shadowMap.enabled = true; r.toneMapping = THREE.ACESFilmicToneMapping; r.outputColorSpace = THREE.SRGBColorSpace; document.body.appendChild(r.domElement);
const WHITE = new THREE.MeshStandardMaterial({ color: 0xf0eee9, roughness: 0.85 }), GREY = new THREE.MeshStandardMaterial({ color: 0xd6d5d1, roughness: 0.9 }), SAND = new THREE.MeshStandardMaterial({ color: 0xf2ede2, roughness: 0.95 }), DARK = new THREE.MeshStandardMaterial({ color: 0xb9b8b4, roughness: 0.8 }), RED = new THREE.MeshStandardMaterial({ color: 0xcf2219, roughness: 0.5 });
const KM = { white: WHITE, grey: new THREE.MeshStandardMaterial({ color: 0xc9c8c4, roughness: 0.6 }), dark: new THREE.MeshStandardMaterial({ color: 0x9a9995, roughness: 0.8 }) };
const KMR = { white: RED, grey: new THREE.MeshStandardMaterial({ color: 0xa81c14, roughness: 0.55 }), dark: new THREE.MeshStandardMaterial({ color: 0x8c1710, roughness: 0.7 }) };
const ctx = { M: { WHITE, GREY, SAND, DARK, RED }, KM, KMR, texts: [], figs: [], proxy: () => {} };
const sc = new THREE.Scene(); sc.background = new THREE.Color(0xdfe4e8); sc.add(new THREE.HemisphereLight(0xeef3ff, 0xb9b2a6, 1.15));
const sun = new THREE.DirectionalLight(0xfff0d8, 3.0); sun.castShadow = true; sun.position.set(40, 80, 30); Object.assign(sun.shadow.camera, { left: -60, right: 60, top: 60, bottom: -60, near: 1, far: 400 }); sc.add(sun, sun.target);
const cam = new THREE.PerspectiveCamera(40, W / H, 0.1, 2000);
const SETS = {}; const need = (c, m) => { if (!c) errs.push(m); };
function shot(id, look, az, el, d) { const a = az * Math.PI / 180, e = el * Math.PI / 180; cam.position.set(look.x + Math.cos(e) * Math.cos(a) * d, look.y + Math.sin(e) * d, look.z + Math.cos(e) * Math.sin(a) * d); cam.lookAt(look); cam.updateMatrixWorld(); r.render(sc, cam); return r.domElement.toDataURL("image/png"); }
window.run = async () => { const out = {};
  const isRoomSpec = sp => sp.scale === "room" || sp.scale === "street" || !!ARCH[sp.type];
  PLAN.sets.forEach((spec0, i) => { try { const room = isRoomSpec(spec0), spec = room ? { ...spec0, cast: { ...PLAN.cast, ...(spec0.cast || {}) } } : spec0, t0 = performance.now(); const s = room ? buildRoom(spec, ctx) : buildSet(spec, ctx);
      for (const k of ["group", "subjects", "proxies", "framings", "update", "setFocus", "light", "info", "field"]) need(s[k] !== undefined, spec.id + ": missing " + k);
      need(s.framings.length > 0, spec.id + ": no framings"); if (room) { need(Array.isArray(s.figures) && s.figures.length > 0, spec.id + ": no figures"); need(!!s.paths, spec.id + ": no paths"); need(Array.isArray(s.info.azRange), spec.id + ": info.azRange"); }
      s.group.position.set(i * 2200, 0, 2200); sc.add(s.group); s.group.visible = false; s.group.updateMatrixWorld(true); s.update(0); s.setFocus("focus"); SETS[spec.id] = { s, room, spec };
      rep[spec.id] = { ms: Math.round(performance.now() - t0), framings: s.framings.map(f => f.name), subjects: Object.keys(s.subjects), figures: (s.figures || []).length, items: (s.items || []).length, warns: (s.info.warns || []).slice(0, 5), unit: s.info.unit, azRange: s.info.azRange, hasFocus: !!s.focus };
    } catch (e) { errs.push(spec0.id + " build: " + (e.stack || e)); } });
  for (const [id, { s, room }] of Object.entries(SETS)) { try { for (const q of Object.values(SETS)) q.s.group.visible = false; s.group.visible = true; s.group.updateMatrixWorld(true);
      const fr = s.framings.find(f => ["threeQuarter", "highCorner", "highOblique", "wide"].includes(f.name)) || s.framings[0], look = fr.look.clone().add(s.group.position), az = room ? ((s.info.azRange || [0, 90]).reduce((a, b) => a + b) / 2) : fr.az, el = Math.min(room ? fr.el : 38, 60), d = fr.d;
      const sp = s.light; sun.position.copy(look).add(new THREE.Vector3(Math.cos((sp?.sunAz ?? 120) * Math.PI / 180) * 60, 70, Math.sin((sp?.sunAz ?? 120) * Math.PI / 180) * 60)); sun.target.position.copy(look); sun.target.updateMatrixWorld();
      out[id] = shot(id, look, az, el, d); s.group.visible = false; } catch (e) { errs.push(id + " render: " + (e.stack || e)); } }
  try { const m = buildMap(ctx, GEO, new THREE.Vector3(-3000, 0, 0), PLAN.map); sc.add(m.group); for (const k of ["update", "setSignWin", "routes", "pins", "signs", "intro", "focusWin", "finalize", "center"]) need(m[k] !== undefined, "map: missing " + k);
    m.intro("r1", 0); m.intro("p1", 0.2); m.setSignWin("p1", 0, 9); m.finalize(9); m.focusWin["route:r1"] = [[0, 9]]; for (const q of Object.values(SETS)) q.s.group.visible = false; m.update(5, cam.position);
    const c = m.center.clone().add(new THREE.Vector3(-3000, 0, 0)); out.map = shot("map", c, 90, 58, 40); rep.map = { routes: Object.keys(m.routes), pins: Object.keys(m.pins), signs: m.signs.length };
  } catch (e) { errs.push("map: " + (e.stack || e)); }
  return { out, rep, errs }; };
</script></body></html>`;
const server = http.createServer((req, res) => { const u = decodeURIComponent(req.url.split("?")[0]);
  if (u === "/" || u === "/smoke.html") { res.writeHead(200, { "content-type": "text/html" }); return res.end(HTML); }
  for (const [pre, dir] of Object.entries(MOUNTS).sort((a, b) => b[0].length - a[0].length)) if (u.startsWith(pre)) { const f = path.join(dir, u.slice(pre.length)); if (fs.existsSync(f) && fs.statSync(f).isFile()) { res.writeHead(200, { "content-type": MIME[path.extname(f)] || "application/octet-stream" }); return fs.createReadStream(f).pipe(res); } }
  res.writeHead(404); res.end("nf"); });
await new Promise(r => server.listen(0, r)); const port = server.address().port;
const browser = await puppeteer.launch({ executablePath: CHROME, headless: "shell", protocolTimeout: 600000, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--no-sandbox"] });
let code = 0;
try { const page = await browser.newPage(); const logs = []; page.on("console", m => logs.push(m.type() + ": " + m.text())); page.on("pageerror", e => logs.push("pageerror: " + e.message)); page.on("requestfailed", q => logs.push("requestfailed: " + q.url()));
  await page.setViewport({ width: 1280, height: 720 }); await page.goto(`http://localhost:${port}/smoke.html`, { waitUntil: "load" });
  await page.waitForFunction("typeof window.run === 'function'", { timeout: 60000 }).catch(() => { logs.push("module failed to load (import error)"); });
  const res = await page.evaluate("window.run()").catch(e => ({ errs: ["run: " + e.message], rep: {}, out: {} }));
  for (const [id, url] of Object.entries(res.out || {})) { const f = path.join(OUT, process.argv[2] ? process.argv[2] + "_" + id + ".png" : id + ".png"); fs.writeFileSync(f, Buffer.from(url.split(",")[1], "base64")); console.log("still", f); }
  console.log(JSON.stringify(res.rep, null, 1)); const errs = res.errs || []; if (logs.length) console.log("console:\n" + logs.slice(0, 25).join("\n"));
  console.log(errs.length ? "ERRORS:\n" + errs.join("\n") : "NO ERRORS"); code = errs.length || logs.some(l => /pageerror|import error/.test(l)) ? 1 : 0;
} finally { await browser.close(); server.close(); } process.exit(code);
