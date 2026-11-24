// Subject registry for the narration-picture gate: every narrated thing is a named subject; the gate asks,
// per narration line, "is the thing this line talks about actually readable on screen right now?"
// A subject is SHOWN at time t when: in front of the camera, every ancestor visible, projected bbox covers >= minArea
// of the frame and >= 50% of that bbox is inside the frame (or it fills >= 30% of the frame), and >= 50% of 5 probe rays reach it unoccluded.
import * as THREE from "three";

export function installSubjects({ scene, camera, setAt, minArea = 0.01 }) {
  const S = new Map(), box = new Box(), ray = new THREE.Raycaster(), v = new THREE.Vector3();
  const reg = (name, objs) => S.set(name, [].concat(objs));   // objs may be { virtual: t => ({ shown, why }) } for 2D MG elements
  const visibleChain = o => { for (let p = o; p; p = p.parent) if (!p.visible) return false; return true; };
  const isIn = (o, objs) => { for (let p = o; p; p = p.parent) if (objs.includes(p)) return true; return false; };
  // a group subject (e.g. the queue = 7 ships) is shown when any member is shown; report the best member
  function measure(objs) {
    const vis = objs.filter(visibleChain); if (!vis.length) return { shown: false, why: "hidden" };
    let best = null; for (const o of vis) { const r = measureOne(o, objs); if (!best || (r.shown && !best.shown) || (r.shown === best.shown && r.area > best.area)) best = r; }
    return best; }
  function measureOne(o, objs) {
    box.b.makeEmpty(); box.b.expandByObject(o);
    const c = box.b.getCenter(new THREE.Vector3()), sz = box.b.getSize(new THREE.Vector3());
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9, front = 0;
    for (let i = 0; i < 8; i++) { v.set(i & 1 ? box.b.max.x : box.b.min.x, i & 2 ? box.b.max.y : box.b.min.y, i & 4 ? box.b.max.z : box.b.min.z);
      const cs = v.clone().applyMatrix4(camera.matrixWorldInverse); if (cs.z >= -camera.near) continue; front++; v.project(camera);   // corners behind the camera would project inverted
      x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x); y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y); }
    if (front < 2) return { shown: false, why: "behind", area: 0 };
    const full = (x1 - x0) * (y1 - y0) / 4, cx0 = Math.max(-1, x0), cx1 = Math.min(1, x1), cy0 = Math.max(-1, y0), cy1 = Math.min(1, y1);
    const clip = Math.max(0, cx1 - cx0) * Math.max(0, cy1 - cy0) / 4, inside = full > 0 ? clip / full : 0;
    let open = 0; const probes = [[0, 0, 0], [0.25, 0.3, 0], [-0.25, 0.3, 0], [0, 0.3, 0.25], [0, 0.3, -0.25]];
    for (const [px, py, pz] of probes) { const p = c.clone().add(new THREE.Vector3(px * sz.x, py * sz.y, pz * sz.z)), d = p.clone().sub(camera.position), L = d.length();
      ray.set(camera.position, d.normalize()); ray.far = L;
      const hit = ray.intersectObject(scene, true).find(h => h.object.isMesh && visibleChain(h.object) && !(h.object.material && h.object.material.transparent && h.object.material.opacity < 0.5));
      if (!hit || isIn(hit.object, objs) || hit.distance > L - 0.05 * sz.length()) open++; }
    const r = { area: +clip.toFixed(4), inside: +inside.toFixed(2), open: open / probes.length };
    r.shown = r.open >= 0.5 && ((r.area >= minArea && r.inside >= 0.5) || r.area >= 0.3);   // big subjects (map, board) may fill the frame
    if (!r.shown) r.why = r.area < minArea ? "small" : r.inside < 0.5 ? "cropped" : "occluded";
    return r; }
  window.subjectNames = () => [...S.keys()];
  window.subjectsAt = (t, names) => { setAt(t); camera.updateMatrixWorld(); scene.updateMatrixWorld(true); const out = {};
    for (const n of names || S.keys()) { const o = S.get(n); out[n] = !o ? { shown: false, why: "unregistered" } : o[0].virtual ? o[0].virtual(t) : measure(o); } return out; };
  return reg;
}
class Box { constructor() { this.b = new THREE.Box3(); } }
