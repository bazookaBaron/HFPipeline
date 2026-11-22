// cast_lineup: 4 cast (columns) x 3 expressions (warm, sad, surprised) in the hilltop light: torch key (warm, front-left), moon rim (cool, behind), sky fill; city-light bokeh behind.
import { THREE, loadCast, rng } from "/core/lib.js";
import { makeFaceLayer, EMO } from "/core/facelayer.js";
import { FACE_CFG } from "/core/facecfg.js";
const DISP = { dadu: "Walter", rohan: "Leo", arjun: "Ben", meera: "Nora" }; const CW = 420, CH = 520, IDS = ["dadu", "rohan", "arjun", "meera"], EX = ["warm", "sad", "surprised"]; const W = CW * 4, Hh = CH * 3 + 64;
const out = document.createElement("canvas"); out.width = W; out.height = Hh; const ctx = out.getContext("2d");
const R = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, alpha: true }); R.setSize(CW, CH); R.toneMapping = THREE.NeutralToneMapping; R.outputColorSpace = THREE.SRGBColorSpace; R.setClearColor(0x000000, 0);
const scene = new THREE.Scene();
const key = new THREE.PointLight("#F4C58A", 1, 0, 2); scene.add(key); const rim = new THREE.DirectionalLight("#8FA9BF", 2.4); scene.add(rim); scene.add(new THREE.HemisphereLight(0x3a4468, 0x1b2030, 1.35)); const fill = new THREE.DirectionalLight("#E9B98A", 0.8); scene.add(fill);
const chars = {}; let ix = 0;
for (const id of IDS) { const ch = await loadCast(id); ch.skel.pose(); scene.add(ch.root); ch.root.position.set(ix * 3, 0, 0); ix++; ch.root.updateMatrixWorld(true); ch.root.traverse(o => { if (o.isSkinnedMesh) o.skeleton.update(); });
  chars[id] = { ch, layer: makeFaceLayer(ch, { skin: ch.cfg.colors.Skin, ...FACE_CFG[id] }) }; }
const cam = new THREE.PerspectiveCamera(24, CW / CH, 0.05, 20);
// backdrop: hilltop dusk gradient + warm/cool city-light bokeh
function backdrop(x, y, seed) { const g = ctx.createLinearGradient(0, y, 0, y + CH); g.addColorStop(0, "#111833"); g.addColorStop(0.62, "#2B2F55"); g.addColorStop(1, "#1A2030"); ctx.fillStyle = g; ctx.fillRect(x, y, CW, CH);
  const r = rng(seed); for (let i = 0; i < 46; i++) { const px = x + r() * CW, py = y + CH * (0.55 + r() * 0.38), rad = 5 + r() * 12; ctx.fillStyle = r() < 0.7 ? `rgba(243,191,99,${0.10 + r() * 0.16})` : `rgba(134,198,216,${0.08 + r() * 0.12})`; ctx.beginPath(); ctx.arc(px, py, rad, 0, 7); ctx.fill(); } }
ctx.fillStyle = "#0F1530"; ctx.fillRect(0, 0, W, Hh);
ctx.font = "500 26px Geist, sans-serif"; ctx.fillStyle = "#EFE6D4"; ctx.fillText("cast lineup: 4 cast x warm / sad / surprised, hilltop light (torch key, moon rim, sky fill)", 18, 40);
IDS.forEach((id, c) => EX.forEach((ex, r) => {
  const { ch, layer } = chars[id]; const E = EMO[ex]; layer.apply({ m: E.m, up: E.up, lo: E.lo, tilt: E.tilt, br: E.br, bi: E.bi, bL: E.bL, bR: E.bR }); ch.root.updateMatrixWorld(true); ch.root.traverse(o => { if (o.isSkinnedMesh) o.skeleton.update(); });
  const hp = ch.bones["Head"].getWorldPosition(new THREE.Vector3()); hp.y += 0.04; const cx = ch.root.position.x;
  cam.position.set(cx + 0.30, hp.y + 0.03, 1.12); cam.lookAt(cx, hp.y - 0.06, 0); cam.updateMatrixWorld(true);
  key.position.set(cx - 1.1, hp.y + 0.35, 1.3); key.intensity = 3.2; rim.position.set(cx + 2.2, hp.y + 1.5, -3.0); fill.position.set(cam.position.x * 2, cam.position.y * 2, cam.position.z * 2);
  backdrop(c * CW, 64 + r * CH, 100 + c * 7 + r); R.render(scene, cam); ctx.drawImage(R.domElement, c * CW, 64 + r * CH, CW, CH);
  ctx.font = "500 24px Geist, sans-serif"; ctx.fillStyle = "#EFE6D4"; ctx.shadowColor = "rgba(8,12,18,.9)"; ctx.shadowBlur = 6; ctx.fillText(`${DISP[id]} · ${ex}`, c * CW + 14, 64 + r * CH + CH - 14); ctx.shadowBlur = 0;
}));
window.__png = out.toDataURL("image/png");
