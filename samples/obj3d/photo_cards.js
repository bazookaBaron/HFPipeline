// photo_cards.js - real evidence photos for miniature films ("option A", user approval 2026-11-15, Nvidia v4).
// A plan line may carry `photo: {id, caption}`; films/<id>/photos.json holds {id: {file, page, licence, author, credit, cardCredit, w, h, pos?, doc?}}.
// Each shown photo is drawn AFTER the 3D / MG frame as a small greyscale print on a white matte card (ink hairline, soft shadow,
// one small red pushpin = the only red besides the focus), 24-28% of the frame wide, in the upper or lower third, placed away from the
// line's focus subject screen box (sampled over the whole span the card is up). Motion: drops in with a 2 deg settle, the print zooms
// slowly 1.03 -> 1.07 inside the matte, and the card fades out before the line ends and before any dissolve in the line.
// gate(): every shown photo has licence + credit + page in photos.json, card never overlaps the focus box, credit legible (>= 16 px,
// contrast >= 4.5), caption + credit fit the card, card up >= 2 s, never inside a full-frame MG beat.
// Nothing here touches the 3D focus / materials / dissolves or the MG stages: film.html hooks draw() after renderAt and adds gate() to v3.
export async function installPhotos(api) {
  const { FILM, W, H, LINES, DISS, MG2D, SETS, PAL, V3, THREE, cam, setCam, animate, lineObjs, smooth, clamp } = api;
  const want = LINES.filter(l => l.v.photo && l.v.photo.id);
  const none = { draw() {}, gate: () => ({ lines: 0, ...(V3 ? { pass: true } : { ok: true }) }), lines: [] };
  if (!want.length) return none;
  const META = await (await fetch(`/films/${FILM}/photos.json`)).json();
  const FAM = "'Segoe UI', 'Helvetica Neue', Arial, sans-serif";   // = mg2d F.family (MG caption font)
  const CAP_FONT = `700 24px ${FAM}`, CRED_PX = 17, CRED_FONT = `500 ${CRED_PX}px ${FAM}`, CRED_COL = "#66625a", MATTE = "#ffffff";
  const PAD = 14, CW = Math.round(W * 0.26), IW = CW - 2 * PAD, MX = Math.round(W * 0.04), TOPY = Math.round(H * 0.075), BOTM = Math.round(H * 0.055);
  const GAP = 24, FADE_IN = 0.45, FADE_OUT = 0.35, MIN_UP = 2.0;
  const meas = document.createElement("canvas").getContext("2d");

  // ---- preload + decode every photo once, bake a greyscale print (luma, contrast 1.08) ----
  const IMG = {};
  for (const id of new Set(want.map(l => l.v.photo.id))) {
    const m = META[id]; if (!m || !m.file) continue;
    const buf = await (await fetch(`/films/${FILM}/${m.file}`)).arrayBuffer();
    const bm = await createImageBitmap(new Blob([buf], { type: /\.png$/i.test(m.file) ? "image/png" : "image/jpeg" }));
    const c = document.createElement("canvas"); c.width = bm.width; c.height = bm.height; const g = c.getContext("2d", { willReadFrequently: true });
    g.drawImage(bm, 0, 0); const d = g.getImageData(0, 0, c.width, c.height), p = d.data;
    for (let i = 0; i < p.length; i += 4) { const y = 0.2126 * p[i] + 0.7152 * p[i + 1] + 0.0722 * p[i + 2], v = clamp((y - 128) * 1.08 + 128, 0, 255); p[i] = p[i + 1] = p[i + 2] = v; }
    g.putImageData(d, 0, 0); IMG[id] = c; bm.close && bm.close();
  }

  // ---- card layout (size only; position chosen per line) ----
  const wrap = (txt, font, maxW) => { meas.font = font; const words = String(txt).split(/\s+/), out = []; let cur = "";
    for (const w of words) { const t = cur ? cur + " " + w : w; if (meas.measureText(t).width <= maxW || !cur) cur = t; else { out.push(cur); cur = w; } } if (cur) out.push(cur); return out; };
  const textW = (txt, font, sp = 0) => { meas.font = font; if ("letterSpacing" in meas) meas.letterSpacing = sp + "px"; const w = meas.measureText(txt).width; if ("letterSpacing" in meas) meas.letterSpacing = "0px"; return w; };
  function layout(id, caption) {
    const m = META[id] || {}, c = IMG[id], ar = c ? c.width / c.height : 4 / 3;
    const A = m.doc ? clamp(ar, 1, 1.6) : ar >= 1.15 ? 4 / 3 : 1, cw = A < 1.15 ? Math.round(W * 0.24) : CW, iw = cw - 2 * PAD, ih = Math.round(iw / A);
    const cred = wrap(m.cardCredit || m.credit || "", CRED_FONT, iw), credH = 10 + cred.length * Math.round(CRED_PX * 1.3) + 8;
    const cap = String(caption || "").toUpperCase(), capW = Math.ceil(textW(cap, CAP_FONT, 2)) + 32, capH = 44;
    return { id, m, A, cw, iw, ih, h: PAD + ih + credH, cred, cap, capW, capH };
  }

  // ---- focus subject screen box at time t (sets the camera; renderAt re-sets it for the real frame) ----
  const corner = new THREE.Vector3();
  function focusBox(l, t) {
    const s = SETS[l.v.set]; if (!s) return null; const { reg } = setCam(t); if (!reg || reg !== "set:" + l.v.set) return null; animate(t, reg);
    let objs = lineObjs(s, l); if (!objs.length && s.focus) objs = s.focus.objs || (s.focus.obj ? [s.focus.obj] : []); if (!objs.length) return null;
    const bb = new THREE.Box3(); for (const o of objs) { o.updateMatrixWorld(true); bb.expandByObject(o); } if (bb.isEmpty()) return null;
    cam.updateMatrixWorld(); let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9, n = 0;
    for (let k = 0; k < 8; k++) { corner.set(k & 1 ? bb.max.x : bb.min.x, k & 2 ? bb.max.y : bb.min.y, k & 4 ? bb.max.z : bb.min.z).project(cam); if (corner.z >= 1 || corner.z <= -1) continue;
      const px = (corner.x + 1) / 2 * W, py = (1 - corner.y) / 2 * H; x0 = Math.min(x0, px); x1 = Math.max(x1, px); y0 = Math.min(y0, py); y1 = Math.max(y1, py); n++; }
    if (!n) return null; return [clamp(x0, 0, W), clamp(y0, 0, H), clamp(x1, 0, W), clamp(y1, 0, H)];
  }
  // the card's full footprint: matte + chip above the top edge + pushpin + 2 deg tilt / drop margin
  const foot = (L, x, y) => [x - 16, y - L.capH / 2 - 18, x + L.cw + 16, y + L.h + 16];
  const hit = (a, b, g = 0) => a[0] < b[2] + g && a[2] > b[0] - g && a[1] < b[3] + g && a[3] > b[1] - g;
  const fullAt = t => MG2D.some(b => b.mode === "full" && t >= b.t0 && t <= b.t1);

  // ---- per line: window, layout, position ----
  const PL = [];
  for (const l of want) {
    const L = layout(l.v.photo.id, l.v.photo.caption); let t0 = l.start + 0.3, te = l.end - 0.2;
    for (const d of DISS) { const ds = d.t - d.d / 2, de = d.t + d.d / 2; if (de > t0 - 0.05 && ds < t0) t0 = de + 0.05; if (ds >= t0 && ds < te + 0.1) te = Math.min(te, ds - 0.1); }
    const cands = [["TL", MX, TOPY], ["TR", W - MX - L.cw, TOPY], ["BL", MX, H - BOTM - L.h], ["BR", W - MX - L.cw, H - BOTM - L.h], ["TC", (W - L.cw) / 2, TOPY], ["BC", (W - L.cw) / 2, H - BOTM - L.h]];
    const boxes = []; for (let t = t0; t <= te + 1e-6; t += 0.2) { const b = focusBox(l, t); if (b) boxes.push(b); }
    const cx = boxes.length ? boxes.reduce((a, b) => a + (b[0] + b[2]) / 2, 0) / boxes.length : W / 2, cy = boxes.length ? boxes.reduce((a, b) => a + (b[1] + b[3]) / 2, 0) / boxes.length : H / 2;
    let best = null; for (const [name, x, y] of cands) { const f = foot(L, x, y), n = boxes.filter(b => hit(f, b, GAP)).length, dist = Math.hypot((f[0] + f[2]) / 2 - cx, (f[1] + f[3]) / 2 - cy);
      const sc = n * 1000 - dist / 10 + (name[1] === "C" ? 5 : 0); if (!best || sc < best.sc) best = { name, x: Math.round(x), y: Math.round(y), sc, n }; }
    const rot = (l.n % 2 ? -1 : 1) * 1.2 * Math.PI / 180;
    PL.push({ l, L, t0, te, x: best.x, y: best.y, at: best.name, rot, samples: boxes.length, hits0: best.n });
  }

  function drawCard(g, P, t) {
    const { L, t0, te } = P, u = smooth((t - t0) / FADE_IN), out = smooth((te - t) / FADE_OUT), a = Math.min(u, out); if (a <= 0) return;
    const img = IMG[L.id]; g.save(); g.globalAlpha = a;
    const cx = P.x + L.cw / 2, cy = P.y + L.h / 2; g.translate(cx, cy - 36 * (1 - u)); g.rotate(P.rot + (2 * Math.PI / 180) * (1 - u)); g.translate(-L.cw / 2, -L.h / 2);
    // matte + soft shadow + ink hairline
    g.save(); g.shadowColor = "rgba(60,46,26,.28)"; g.shadowBlur = 22; g.shadowOffsetY = 8; g.fillStyle = MATTE; g.fillRect(0, 0, L.cw, L.h); g.restore();
    g.strokeStyle = "rgba(43,42,39,.55)"; g.lineWidth = 1.5; g.strokeRect(0.75, 0.75, L.cw - 1.5, L.h - 1.5);
    // print: cover-crop at the photo's anchor, slow inner zoom 1.03 -> 1.07
    if (img) { const z = 1.03 + 0.04 * clamp((t - t0) / Math.max(0.1, te - t0), 0, 1), sa = img.width / img.height;
      let sw = sa > L.A ? img.height * L.A : img.width, sh = sa > L.A ? img.height : img.width / L.A; sw /= z; sh /= z;
      const [fx, fy] = L.m.pos || [0.5, 0.5], sx = clamp(fx * img.width - sw / 2, 0, img.width - sw), sy = clamp(fy * img.height - sh / 2, 0, img.height - sh);
      g.imageSmoothingQuality = "high"; g.drawImage(img, sx, sy, sw, sh, PAD, PAD, L.iw, L.ih); g.strokeStyle = "rgba(43,42,39,.25)"; g.lineWidth = 1; g.strokeRect(PAD + 0.5, PAD + 0.5, L.iw - 1, L.ih - 1); }
    // credit (grey, 17 px)
    g.fillStyle = CRED_COL; g.font = CRED_FONT; g.textAlign = "left"; g.textBaseline = "top"; L.cred.forEach((s, i) => g.fillText(s, PAD, PAD + L.ih + 10 + i * Math.round(CRED_PX * 1.3)));
    // caption chip (MG caption font: 700, caps, tracked) straddling the top edge
    if (L.cap) { g.save(); g.shadowColor = "rgba(60,46,26,.18)"; g.shadowBlur = 8; g.shadowOffsetY = 3; g.fillStyle = PAL.paper; g.fillRect(18, -L.capH / 2, L.capW, L.capH); g.restore();
      g.strokeStyle = "rgba(43,42,39,.5)"; g.lineWidth = 1.5; g.strokeRect(18.75, -L.capH / 2 + 0.75, L.capW - 1.5, L.capH - 1.5);
      g.fillStyle = PAL.ink; g.font = CAP_FONT; if ("letterSpacing" in g) g.letterSpacing = "2px"; g.textAlign = "left"; g.textBaseline = "middle"; g.fillText(L.cap, 18 + 16, 1); if ("letterSpacing" in g) g.letterSpacing = "0px"; }
    // small red pushpin, top right
    const px = L.cw - 40, py = 12; g.save(); g.shadowColor = "rgba(40,20,10,.35)"; g.shadowBlur = 5; g.shadowOffsetX = 2; g.shadowOffsetY = 3; g.fillStyle = PAL.red; g.beginPath(); g.arc(px, py, 9, 0, 7); g.fill(); g.restore();
    g.fillStyle = PAL.redInk; g.beginPath(); g.arc(px, py, 4, 0, 7); g.fill(); g.fillStyle = "rgba(255,255,255,.55)"; g.beginPath(); g.arc(px - 3, py - 3, 2.4, 0, 7); g.fill();
    g.restore();
  }
  function draw(g, t) { if (fullAt(t)) return; for (const P of PL) if (t >= P.t0 && t <= P.te) drawCard(g, P, t); }

  // ---- gate ----
  const lum = hex => { const v = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(c => c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; };
  const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  function gate() {
    const bad = [], rows = [];
    for (const P of PL) { const { l, L } = P, m = L.m, why = [];
      if (!IMG[L.id]) why.push("image missing");
      if (!m.licence || !m.credit || !m.page || !(m.cardCredit || m.credit)) why.push("licence/credit missing in photos.json");
      if (l.kind !== "3d") why.push("not a 3D line");
      if (P.te - P.t0 < MIN_UP) why.push("up " + (P.te - P.t0).toFixed(2) + " s < " + MIN_UP);
      if (P.te > l.end - 0.1) why.push("not faded before line end");
      for (const d of DISS) { const ds = d.t - d.d / 2, de = d.t + d.d / 2; if (ds < P.te && de > P.t0) why.push("overlaps dissolve @" + d.t.toFixed(2)); }
      for (let t = P.t0; t <= P.te; t += 0.1) if (fullAt(t)) { why.push("inside full MG @" + t.toFixed(1)); break; }
      let ov = 0, ovAt = null, ns = 0; const f = foot(L, P.x, P.y);
      for (let t = P.t0 + 0.1; t <= P.te; t += 0.25) { const b = focusBox(l, t); if (!b) continue; ns++; if (hit(f, b)) { ov++; ovAt ??= +t.toFixed(2); } }
      if (ov) why.push(`card over focus box (${ov}/${ns} samples, first @${ovAt})`);
      if (!ns) why.push("focus box never sampled");
      const cr = contrast(CRED_COL, MATTE); if (CRED_PX < 16 || cr < 4.5) why.push("credit illegible (" + CRED_PX + " px, contrast " + cr.toFixed(2) + ")");
      if (L.cred.length > 2) why.push("credit wraps to " + L.cred.length + " lines");
      for (const s of L.cred) if (textW(s, CRED_FONT) > L.iw + 0.5) why.push("credit wider than card");
      if (L.cap && L.capW > L.cw - 18 - 64) why.push("caption chip " + L.capW + " px > card room " + (L.cw - 82));
      if (f[0] < 0 || f[2] > W || f[1] < 0 || f[3] > H) why.push("card leaves the frame");
      rows.push({ n: l.n, id: L.id, at: P.at, x: P.x, y: P.y, w: L.cw, h: L.h, t0: +P.t0.toFixed(2), te: +P.te.toFixed(2), samples: ns, overlap: ov });
      if (why.length) bad.push([l.n, L.id, why]); }
    return { lines: PL.length, ids: [...new Set(PL.map(P => P.L.id))].length, rows, bad: bad.slice(0, 16), nBad: bad.length, creditPx: CRED_PX, creditContrast: +contrast(CRED_COL, MATTE).toFixed(2), ...(V3 ? { pass: !bad.length } : { ok: !bad.length }) };
  }
  return { draw, gate, lines: PL.map(P => ({ n: P.l.n, id: P.L.id, at: P.at, x: P.x, y: P.y, w: P.L.cw, h: P.L.h, t0: +P.t0.toFixed(2), te: +P.te.toFixed(2), hits0: P.hits0 })) };
}
