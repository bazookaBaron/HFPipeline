// compress head-clear check (page expression; run: node runtime/jobq.js --kind render -- node dialogue/engine/render.mjs epeval compress dialogue/episodes/compress/headcheck.js)
// Every 0.1 s while an MG card is up (+ every shot start/end and gesture peak inside a card): project head-top + face box of BOTH actors
// through the shot camera (same framing as the render: rig framed for the layout's scene rect), and FAIL if a visible head/face reaches
// above card bottom + 40 px, or if the active caption box overlaps a face box. Heads outside the frame / behind the camera are not "covered".
(async () => {
  const MARGIN = 40, T = window.THREE, cam = new T.PerspectiveCamera(40, 1, 0.05, 2000), v = new T.Vector3(), W = 1080, H = 1920;
  const cv = document.createElement('canvas').getContext('2d'); cv.font = "600 56px Geist, Arial, sans-serif";
  const ts = new Set(); for (let t = 0; t <= EP.duration; t += 0.1) ts.add(+t.toFixed(2));
  for (const s of EP.shots) { ts.add(+(s.t0 + 0.01).toFixed(2)); ts.add(+(s.t1 - 0.02).toFixed(2)); }
  for (const g of EP.gestures) ts.add(+(g.t + Math.min(0.25, g.dur / 2)).toFixed(2));
  const fails = [], perShot = {}; let n = 0, worst = 1e9, worstAt = null;
  for (const t of [...ts].sort((a, b) => a - b)) {
    const layout = window.epLayoutAt(t); if (layout === 'full') continue; const card = window.mgCardRect(layout); if (!card) continue;
    world.update(t); const shot = window.epShotAt(t), rect = window.epRectOf(layout), ar = rect.w / rect.h, u = Math.min(1, Math.max(0, (t - shot.t0) / (shot.t1 - shot.t0)));
    const rc = world.rigCamera(shot.rig, ar, u, false, shot.move ?? { type: 'hold' }); cam.fov = rc.fov; cam.aspect = ar; cam.updateProjectionMatrix(); cam.position.copy(rc.pos); cam.lookAt(rc.tgt); cam.updateMatrixWorld(true);
    const proj = p => { const c = p.clone().applyMatrix4(cam.matrixWorldInverse); const front = c.z < -0.05; v.copy(p).project(cam); return { x: rect.x + (v.x + 1) / 2 * rect.w, y: rect.y + (1 - v.y) / 2 * rect.h, front }; };
    const capY = 786, cs = 56; const ph = EP.captions.find(c => t >= c.s && t <= c.e); let cap = null;
    if (ph) { const lines = Math.max(1, Math.ceil(cv.measureText(ph.text).width / (W - 140))); const tw = Math.min(W - 140, cv.measureText(ph.text).width); cap = { x0: W / 2 - tw / 2, x1: W / 2 + tw / 2, y0: capY - lines * cs * 1.12 / 2, y1: capY + lines * cs * 1.12 / 2, text: ph.text }; }
    n++;
    for (const sd of ['A', 'B']) {
      const hp = world.actors[sd].head.getWorldPosition(new T.Vector3()); const top = proj(hp.clone().add(new T.Vector3(0, 0.17, 0)));
      const fc = hp.clone().add(new T.Vector3(0, 0.085, 0)); const pts = [[0.1, 0.12, 0], [-0.1, 0.12, 0], [0.1, -0.12, 0], [-0.1, -0.12, 0], [0, 0.12, 0.1], [0, -0.12, -0.1], [0, 0.12, -0.1], [0, -0.12, 0.1]].map(d => proj(fc.clone().add(new T.Vector3(...d))));
      if (!top.front || pts.some(p => !p.front)) continue;
      const fx0 = Math.min(...pts.map(p => p.x)), fx1 = Math.max(...pts.map(p => p.x)), fy0 = Math.min(...pts.map(p => p.y)), fy1 = Math.max(...pts.map(p => p.y));
      if (fx1 < 0 || fx0 > W || fy0 > H) continue;   // head not in frame
      const headTop = Math.min(top.y, fy0), m = headTop - (card.y + card.h); const k = '#' + shot.n + ' ' + shot.rig;
      perShot[k] = Math.min(perShot[k] ?? 1e9, Math.round(m)); if (m < worst) { worst = m; worstAt = { t, shot: shot.n, rig: shot.rig, actor: sd, headTop: Math.round(headTop) }; }
      if (m < MARGIN) fails.push(`t=${t} shot #${shot.n} ${shot.rig} ${sd === 'A' ? 'Walter' : 'Leo'}: head top y ${Math.round(headTop)} < card bottom ${card.y + card.h} + ${MARGIN}`);
      if (cap && !(fx1 < cap.x0 || fx0 > cap.x1 || fy1 < cap.y0 || fy0 > cap.y1)) fails.push(`t=${t} shot #${shot.n} caption "${cap.text}" overlaps ${sd === 'A' ? 'Walter' : 'Leo'}'s face (face y ${Math.round(fy0)}-${Math.round(fy1)}, caption y ${Math.round(cap.y0)}-${Math.round(cap.y1)})`);
    }
  }
  return { result: fails.length ? 'FAIL' : 'PASS', samples: n, margin: MARGIN, worstMarginPx: Math.round(worst), worstAt, perShotMinMarginPx: perShot, fails: fails.slice(0, 40), nFails: fails.length };
})()
