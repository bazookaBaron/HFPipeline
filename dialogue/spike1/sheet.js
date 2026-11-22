// face_sheet: 4 cast x 10 emotion presets + 6-viseme rows for dadu and rohan, head close-ups under campfire light
import { THREE, PAL, loadCast, rng } from "/lib.js";
import { makeFaceLayer, EMO, EMO_NAMES } from "/facelayer.js";
import { FACE_CFG } from "/facecfg.js";
const CW = 300, CH = 340, IDS = ["dadu", "rohan", "arjun", "meera"], VIS = ["rest", "small", "A", "O", "E", "MBP"];
const cols = 10, rows = 4 + 2 + 2; const W = cols * CW, Hh = rows * CH + 40; const q = new URLSearchParams(location.search);
const out = document.createElement("canvas"); out.width = W; out.height = Hh; const ctx = out.getContext("2d"); ctx.fillStyle = "#0E1621"; ctx.fillRect(0, 0, W, Hh);
const R = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true }); R.setSize(CW, CH); R.toneMapping = THREE.NeutralToneMapping; R.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene(); scene.background = new THREE.Color("#16222D");
const key = new THREE.PointLight("#F6C792", 1, 0, 2); scene.add(key); const rim = new THREE.DirectionalLight(PAL.moon, 2.2); rim.position.set(-2, 3, -3); scene.add(rim); scene.add(new THREE.HemisphereLight(0x3d566e, 0x1c2a36, 1.4)); const fill = new THREE.DirectionalLight("#C9D3DC", 0.9); scene.add(fill);
const chars = {}; let ix = 0;
for (const id of IDS) { const ch = await loadCast(id); ch.skel.pose(); scene.add(ch.root); ch.root.position.set(ix * 3, 0, 0); ix++; ch.root.updateMatrixWorld(true);
  ch.root.traverse(o => { if (o.isSkinnedMesh) o.skeleton.update(); });
  const cfg = FACE_CFG[id]; const layer = makeFaceLayer(ch, { skin: ch.cfg.colors.Skin, ...cfg }); chars[id] = { ch, layer }; }
const cam = new THREE.PerspectiveCamera(26, CW / CH, 0.05, 20);
function cell(id, st, col, row, label, far = false) {
  const { ch, layer } = chars[id]; layer.apply(st); ch.root.updateMatrixWorld(true); ch.root.traverse(o => { if (o.isSkinnedMesh) o.skeleton.update(); });
  const hp = ch.bones["Head"].getWorldPosition(new THREE.Vector3()); hp.y += 0.08; const cx = ch.root.position.x;
  if (far) { cam.fov = 13; cam.updateProjectionMatrix(); cam.position.set(cx + 0.9, hp.y - 0.05, 3.1); cam.lookAt(cx, hp.y - 0.12, 0); } else { cam.fov = 26; cam.updateProjectionMatrix(); cam.position.set(cx + 0.33, hp.y + 0.02, 0.78); cam.lookAt(cx, hp.y, 0); } fill.position.set(cam.position.x * 3, cam.position.y * 3, cam.position.z * 3); cam.updateMatrixWorld(true); key.position.set(cx + 1.0, hp.y - 0.45, 1.1); key.intensity = 3.2; rim.target.position.set(cx, hp.y, 0); scene.add(rim.target);
  R.render(scene, cam); ctx.drawImage(R.domElement, col * CW, row * CH + 40, CW, CH);
  ctx.font = "500 22px 'IBM Plex Sans Condensed', sans-serif"; ctx.fillStyle = "#EFE6D4"; ctx.textAlign = "left"; ctx.fillText(label, col * CW + 10, row * CH + 40 + CH - 12);
}
ctx.font = "500 26px Fraunces, serif"; ctx.fillStyle = "#EFE6D4"; ctx.fillText("face layer: 10 emotion presets x 4 cast, then 6 visemes (dadu, rohan)", 12, 28);
IDS.forEach((id, r) => EMO_NAMES.forEach((n, c) => cell(id, { m: EMO[n].m, up: EMO[n].up, lo: EMO[n].lo, tilt: EMO[n].tilt, br: EMO[n].br, bi: EMO[n].bi, bL: EMO[n].bL, bR: EMO[n].bR }, c, r, `${id} ${n}`)));
["dadu", "rohan"].forEach((id, r) => VIS.forEach((v, c) => cell(id, { m: { rest: 1 }, lip: { w: { [v]: 1 }, speak: 1, amp: 1 }, up: 0, lo: 0, tilt: 0, br: 0, bi: 0 }, c, 4 + r, `${id} ${v}`)));
["dadu", "rohan"].forEach((id, r) => EMO_NAMES.forEach((n, c) => cell(id, { m: EMO[n].m, up: EMO[n].up, lo: EMO[n].lo, tilt: EMO[n].tilt, br: EMO[n].br, bi: EMO[n].bi, bL: EMO[n].bL, bR: EMO[n].bR }, c, 6 + r, `${id} ${n} (OTS distance)`, true)));
window.__png = out.toDataURL("image/png");
