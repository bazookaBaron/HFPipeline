/* Rigged flat-vector presenter puppet for hand-authored HyperFrames / GSAP reels.
 * Style: bold editorial flat illustration. Thick even black outlines, 100% flat fills, ONE cobalt shadow colour.
 * Seek-safe: every motion is a tween/set on the timeline you pass in. No Math.random, no Date.
 * Joints are nested <g> pairs: a static translate wrapper (pivot) + a GSAP-rotated group (svgOrigin "0 0").
 * API (see video-engine/assets/mascot/puppet/README.md):
 *   const p = Puppet.mount(container, { width: 560, id: "pz", theme: { shadow, skin, shirt }, halftone: false })
 *   Puppet.pose(tl, t, "point_up", { d: 0.2 })
 *   Puppet.talk(tl, [{ w, s, e }, ...])
 *   Puppet.blinks(tl, end), Puppet.look(tl, t, "left"), Puppet.face(tl, t, { brows, eyes, mouth })
 */
(function (root) {
  "use strict";
  const THEME = {
    line: "#111111",   // every outline + brows/pupils/mouth
    shadow: "#3F6FC0", // the ONE shading colour (face side, neck, ears, hands, folds)
    skin: "#F2A07F",
    nose: "#E8553E",   // lit side of the wedge nose
    shirt: "#E94F37",  // crewneck knit
    hair: "#111111",
    eye: "#FFFFFF",
    tongue: "#F3829A",
    dots: "#1E1D1C",   // optional halftone
  };
  const LW = 6.5;  // body outline weight (viewBox units; ~6px at 560px wide)
  const LI = 4;    // interior line weight (ribbing, creases)
  const L1 = 118, L2 = 108; // upper arm, forearm
  const SH = { A: [168, 566], B: [432, 566] }; // shoulder pivots (A = screen-left arm)
  const EYE = { L: [264, 300], R: [336, 300] }; // head-local
  const ER = 33; // eye radius (~30% of face width each)
  const BROW = { L: [262, 241], R: [338, 241] };
  const HEADY = 0;
  const HID = ' style="opacity:0;visibility:hidden"';
  const MOUTH_KEYS = ["closed", "small", "wide", "o", "smile"];
  const HANDS = ["open", "wave", "point", "fist", "thumbs", "palmup", "two", "three"];
  const f1 = (n) => +n.toFixed(2);
  const ln = (C, d, w, extra = "") => `<path d="${d}" fill="none" stroke="${C.line}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"${extra}/>`;

  // ---------- hands (hand-local, fingers point +y; drawn inside scale(1.3)) ----------
  const HS = 1.5; // hand scale
  const HO = 4.2; // hand outline (x HS = ~6.3)
  const PALM = "M-20 -2C-24 12-25 30-21 44C-18 53 18 53 21 44C25 30 24 12 20 -2Z";
  const PALM_SH = "M8 -2L20 -2C24 12 25 30 21 44C19 48 14 50 9 51C14 36 13 14 8 -2Z";
  const knuckRect = (x0, x1) => ({ x: x0, y: 33, w: x1 - x0, h: 23, rx: 10 });
  // spec: { palm, palmSh, fingers:[[x1,y1,x2,y2,w]], knuck:[x0,x1,n], thumbTop:[...], shadeLast, creases:[d] }
  function handSVG(C, s) {
    const out = [], fill = [], shade = [], lines = [], top = [];
    const W = (f) => f[4] || 12;
    const seg = (f, col, w) => `<path d="M${f[0]} ${f[1]}L${f[2]} ${f[3]}" stroke="${col}" stroke-width="${f1(w)}" stroke-linecap="round" fill="none"/>`;
    const fingers = s.fingers || [];
    // pass 1: outline-under (union silhouette)
    fingers.forEach((f) => out.push(seg(f, C.line, W(f) + 2 * HO)));
    if (s.palm) out.push(`<path d="${s.palm}" fill="${C.line}" stroke="${C.line}" stroke-width="${2 * HO}" stroke-linejoin="round"/>`);
    let kr = null;
    if (s.knuck) { kr = knuckRect(s.knuck[0], s.knuck[1]); out.push(`<rect x="${kr.x}" y="${kr.y}" width="${kr.w}" height="${kr.h}" rx="${kr.rx}" fill="${C.line}" stroke="${C.line}" stroke-width="${2 * HO}"/>`); }
    // pass 2: flat fills
    if (s.palm) fill.push(`<path d="${s.palm}" fill="${C.skin}"/>`);
    fingers.forEach((f) => fill.push(seg(f, C.skin, W(f))));
    if (kr) fill.push(`<rect x="${kr.x}" y="${kr.y}" width="${kr.w}" height="${kr.h}" rx="${kr.rx}" fill="${C.skin}"/>`);
    // pass 3: one-colour shadow side
    if (s.palmSh) shade.push(`<path d="${s.palmSh}" fill="${C.shadow}"/>`);
    const sf = s.shadeLast === false ? null : fingers[fingers.length - 1];
    if (sf) {
      const dx = sf[2] - sf[0], dy = sf[3] - sf[1], L = Math.hypot(dx, dy), w = W(sf), o = w * 0.27;
      const ox = (dy / L) * o, oy = (-dx / L) * o;
      shade.push(`<path d="M${f1(sf[0] + ox)} ${f1(sf[1] + oy)}L${f1(sf[2] + ox)} ${f1(sf[3] + oy)}" stroke="${C.shadow}" stroke-width="${f1(w * 0.46)}" stroke-linecap="round" fill="none"/>`);
    }
    if (kr && s.knuck[2] && !sf) shade.push(`<rect x="${kr.x + kr.w - 9}" y="${kr.y + 3}" width="7" height="${kr.h - 6}" rx="3.5" fill="${C.shadow}"/>`);
    // pass 4: separators between merged fingers, knuckle splits, creases
    for (let i = 0; i + 1 < fingers.length; i++) {
      const a = fingers[i], b = fingers[i + 1], w = (W(a) + W(b)) / 2;
      let tEnd = 1;
      for (let t = 0.2; t <= 1.0001; t += 0.02) {
        const ax = a[0] + (a[2] - a[0]) * t, ay = a[1] + (a[3] - a[1]) * t, bx = b[0] + (b[2] - b[0]) * t, by = b[1] + (b[3] - b[1]) * t;
        if (Math.hypot(ax - bx, ay - by) > w + HO * 0.6) { tEnd = t; break; }
      }
      const P = (t) => [((a[0] + b[0]) / 2) + (((a[2] + b[2]) / 2) - ((a[0] + b[0]) / 2)) * t, ((a[1] + b[1]) / 2) + (((a[3] + b[3]) / 2) - ((a[1] + b[1]) / 2)) * t];
      const p0 = P(0.22), p1 = P(Math.min(tEnd, 0.86));
      lines.push(ln(C, `M${f1(p0[0])} ${f1(p0[1])}L${f1(p1[0])} ${f1(p1[1])}`, HO * 0.8));
    }
    if (kr) {
      const n = s.knuck[2];
      for (let i = 1; i < n; i++) { const x = f1(kr.x + (kr.w * i) / n); lines.push(ln(C, `M${x} ${kr.y + 11}L${x} ${kr.y + kr.h}`, HO * 0.8)); }
    }
    (s.creases || []).forEach((d) => lines.push(ln(C, d, HO * 0.75)));
    if (s.thumbTop) {
      const t = s.thumbTop;
      top.push(seg(t, C.line, W(t) + 2 * HO), seg(t, C.skin, W(t)));
      if (s.thumbShade !== false) top.push(`<path d="M${t[0] + 2} ${t[1] + 5}L${t[2] - 1} ${t[3] + 4}" stroke="${C.shadow}" stroke-width="${f1(W(t) * 0.36)}" stroke-linecap="round" fill="none"/>`);
    }
    return out.join("") + fill.join("") + shade.join("") + lines.join("") + top.join("");
  }
  const THUMB_IN = [-21, 17, 2, 35, 15];
  const HAND_SPEC = {
    open: { palm: PALM, palmSh: PALM_SH, fingers: [[-19, 16, -33, 38, 15], [-15, 40, -19, 68, 15], [-5, 43, -6, 75, 15], [6, 43, 7, 74, 15], [16, 40, 20, 64, 13]],
      creases: ["M-13 18Q-8 28-11 37"] },
    wave: { palm: PALM, palmSh: PALM_SH, fingers: [[-19, 14, -37, 30, 15], [-15, 40, -25, 67, 15], [-5, 42, -9, 75, 15], [5, 42, 9, 74, 15], [15, 39, 25, 63, 13]],
      creases: ["M-13 17Q-8 27-11 36"] },
    point: { palm: PALM, palmSh: PALM_SH, fingers: [[-13, 40, -14, 80, 15]], knuck: [-5, 24, 3], thumbTop: THUMB_IN, shadeLast: false },
    fist: { palm: PALM, palmSh: PALM_SH, knuck: [-23, 23, 4], thumbTop: [-21, 17, 6, 33, 14] },
    two: { palm: PALM, palmSh: PALM_SH, fingers: [[-13, 40, -18, 78, 15], [-1, 42, 4, 80, 15]], knuck: [7, 24, 2], thumbTop: THUMB_IN, shadeLast: false },
    three: { palm: PALM, palmSh: PALM_SH, fingers: [[-14, 40, -21, 74, 14], [-3, 42, -3, 79, 14], [9, 42, 14, 75, 14]], knuck: [15, 24, 1], thumbTop: THUMB_IN, shadeLast: false },
    thumbs: { palm: "M-20 15A17 17 0 0 1 -3 -2L5 -2A17 17 0 0 1 22 15L22 37A17 17 0 0 1 5 54L-3 54A17 17 0 0 1 -20 37Z",
      palmSh: "M10 -1A17 17 0 0 1 22 15L22 37A17 17 0 0 1 10 53Z",
      fingers: [[-14, 26, -16, 72, 17], [-2, 10, 16, 10, 13], [-2, 23, 17, 23, 13], [-2, 36, 16, 36, 13], [-2, 48, 13, 48, 12]], shadeLast: false,
      creases: ["M-8 22Q-9 30-7 38"] },
    palmup: { palm: "M-16 -2C-19 12-18 26-14 34C-8 40 8 40 14 33C18 24 18 10 16 -2Z",
      palmSh: "M6 -2L16 -2C18 10 18 24 14 33C12 36 9 38 7 38C10 26 10 10 6 -2Z",
      fingers: [[-15, 10, -29, 28, 14], [-10, 28, -10, 58, 12], [-1, 30, -1, 61, 12], [8, 28, 8, 58, 12]],
      creases: ["M-6 14Q0 18 6 14"] },
  };

  // ---------- arms ----------
  function armArt(C, p, side) {
    const mir = side === "B" ? ` transform="scale(-1 1)"` : "";
    const hands = HANDS.map((h) => `<g id="${p}-h${side}-${h}" data-hand="${h}"${mir}${h === "open" ? "" : HID}><g transform="scale(${HS})">${handSVG(C, HAND_SPEC[h])}</g></g>`).join("");
    const RU = 39, RF = 36, CY = L2 - 38, CH = 34, CW = RF + 3;
    const up = `x="-${RU}" y="-${RU}" width="${2 * RU}" height="${L1 + 2 * RU}" rx="${RU}"`;
    const fo = `x="-${RF}" y="-${RF}" width="${2 * RF}" height="${CY + 10 + RF}" rx="${RF}"`;
    const ribs = Array.from({ length: 11 }, (_, i) => { const x = f1(-30 + i * 6); return `M${x} ${CY + 7}L${x} ${CY + CH - 7}`; }).join("");
    return `<g transform="translate(${SH[side][0]} ${SH[side][1]})"><g id="${p}-arm${side}">
  <g${mir}><clipPath id="${p}-cu${side}"><rect ${up}/></clipPath>
    <rect ${up} fill="${C.shirt}"/>
    <g clip-path="url(#${p}-cu${side})"><rect x="16" y="-50" width="40" height="${L1 + 100}" fill="${C.shadow}"/>
      <path d="M-40 ${L1 - 34}Q-8 ${L1 - 20} 16 ${L1 - 34}L16 ${L1 - 18}Q-10 ${L1 - 4}-40 ${L1 - 18}Z" fill="${C.shadow}"/></g>
    <rect ${up} fill="none" stroke="${C.line}" stroke-width="${LW}"/></g>
  <g transform="translate(0 ${L1})"><g id="${p}-fore${side}">
    <g${mir}><clipPath id="${p}-cf${side}"><rect ${fo}/></clipPath>
      <rect ${fo} fill="${C.shirt}"/>
      <g clip-path="url(#${p}-cf${side})"><rect x="15" y="-50" width="40" height="${L2 + 70}" fill="${C.shadow}"/></g>
      ${ln(C, `M-${RF} 9L-${RF} ${CY + 6}M${RF} 9L${RF} ${CY + 6}`, LW)}
      <rect x="-19" y="${CY + CH - 12}" width="38" height="${L2 - CY - CH + 18}" rx="12" fill="${C.skin}" stroke="${C.line}" stroke-width="${LW}"/></g>
    <g transform="translate(0 ${L2})"><g id="${p}-hand${side}">${hands}</g></g>
    <g${mir}><clipPath id="${p}-cc${side}"><rect x="-${CW}" y="${CY}" width="${2 * CW}" height="${CH}" rx="10"/></clipPath>
      <rect x="-${CW}" y="${CY}" width="${2 * CW}" height="${CH}" rx="10" fill="${C.shirt}"/>
      <g clip-path="url(#${p}-cc${side})"><rect x="${CW - 14}" y="${CY - 2}" width="20" height="${CH + 4}" fill="${C.shadow}"/></g>
      ${ln(C, ribs, LI * 0.8)}
      <rect x="-${CW}" y="${CY}" width="${2 * CW}" height="${CH}" rx="10" fill="none" stroke="${C.line}" stroke-width="${LW}"/></g>
  </g></g>
</g></g>`;
  }

  // ---------- face ----------
  function eyeArt(C, p, k) {
    const [x, y] = EYE[k];
    const ang = [-168, -147, -126, -105, -84, -63, -42, -21];
    const ticks = ang.map((a) => { const r = a * Math.PI / 180, c = Math.cos(r), s = Math.sin(r); return `M${f1(x + c * (ER + 5))} ${f1(y + s * (ER + 5))}L${f1(x + c * (ER + 11))} ${f1(y + s * (ER + 11))}`; }).join("");
    const low = [].filter(Boolean).map((a) => { const r = a * Math.PI / 180, c = Math.cos(r), s = Math.sin(r); return `M${f1(x + c * (ER + 4))} ${f1(y + s * (ER + 4))}L${f1(x + c * (ER + 9))} ${f1(y + s * (ER + 9))}`; }).join("");
    return `<g id="${p}-eye${k}"><g id="${p}-blink${k}">
  <clipPath id="${p}-ec${k}"><circle cx="${x}" cy="${y}" r="${ER}"/></clipPath>
  <circle cx="${x}" cy="${y}" r="${ER}" fill="${C.eye}"/>
  <g clip-path="url(#${p}-ec${k})"><g class="${p}-pupil"><circle cx="${x + (k === "L" ? 6 : -6)}" cy="${y - 6}" r="7.5" fill="${C.line}"/></g></g>
  <circle cx="${x}" cy="${y}" r="${ER}" fill="none" stroke="${C.line}" stroke-width="6.5"/>
  ${ln(C, ticks, 4.6)}
</g></g>`;
  }

  const MOUTHS = (C) => {
    const blk = (d) => `<path d="${d}" fill="${C.line}" stroke="${C.line}" stroke-width="3" stroke-linejoin="round"/>`;
    const tg = (d) => `<path d="${d}" fill="${C.tongue}"/>`;
    return {
      closed: ln(C, "M294 414Q306 417 319 411", 6),
      small: blk("M296 410Q307 406 317 409Q316 420 306 421Q297 420 296 410Z") + tg("M300 418Q307 413 313 417Q310 420 306 420Q302 420 300 418Z"),
      wide: blk("M290 405Q306 400 323 404Q321 429 306 430Q292 429 290 405Z") + tg("M295 423Q306 412 318 422Q313 428 306 428Q299 428 295 423Z"),
      o: blk("M306 403C314 403 317 410 317 416C317 423 312 428 306 428C300 428 295 423 295 416C295 409 298 403 306 403Z") + tg("M299 423Q306 416 313 423Q310 427 306 427Q302 427 299 423Z"),
      smile: blk("M289 405Q306 412 324 404Q319 428 306 429Q293 428 289 405Z") + tg("M296 423Q306 414 317 422Q312 428 306 428Q300 428 296 423Z"),
    };
  };

  const FACE = "M300 148C374 148 416 198 416 290C416 362 412 410 394 440C374 470 340 480 300 480C260 480 226 470 206 440C188 410 184 362 184 290C184 198 226 148 300 148Z";
  const HAIR_C = [[300, 150, 56], [178, 214, 24], [422, 214, 24], [186, 252, 21], [414, 252, 21], [208, 198, 30], [250, 194, 32], [300, 192, 32], [350, 194, 32], [392, 198, 30], [202, 160, 34], [246, 130, 38], [300, 118, 40], [354, 130, 38], [398, 160, 34]];
  const hairCircles = (fill, extra = "") => HAIR_C.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}"${extra}/>`).join("");
  const HAIR_OLD = "M214 292L200 292C192 254 192 206 206 176C222 140 258 116 304 112C352 108 398 120 416 148C428 168 424 194 408 206C404 209 401 210 399 210C403 238 402 266 399 292L389 292C388 268 384 250 373 236C350 247 316 245 291 230C279 242 261 247 245 243C233 241 224 245 219 253C215 266 214 279 214 292Z";
  const EAR = "M194 282C172 266 154 290 158 316C162 342 180 352 197 342Z";
  const EAR_IN = "M189 296C176 292 171 306 174 320C176 330 183 334 190 330C183 324 182 312 189 296Z";
  const STUBBLE = [[252, 440], [259, 448], [248, 451], [262, 458], [254, 462], [278, 462], [286, 456], [292, 465], [322, 463], [331, 456], [338, 464], [350, 450], [358, 442], [356, 455], [222, 418], [229, 427], [219, 431], [380, 416], [384, 426], [375, 428]];

  function build(p, C, opts = {}) {
    const M = MOUTHS(C);
    const head = `<g id="${p}-head" transform="translate(0 ${HEADY})">
  <clipPath id="${p}-fc"><path d="${FACE}"/></clipPath>
  <g>${`<path d="${EAR}" fill="${C.skin}" stroke="${C.line}" stroke-width="${LW}" stroke-linejoin="round"/><path d="${EAR_IN}" fill="${C.shadow}"/>`}</g>
  <g transform="translate(600 0) scale(-1 1)"><path d="${EAR}" fill="${C.skin}" stroke="${C.line}" stroke-width="${LW}" stroke-linejoin="round"/><path d="M196 288C178 278 166 296 168 316C170 334 182 344 196 338Z" fill="${C.shadow}"/></g>
  <path d="${FACE}" fill="${C.skin}"/>
  <g clip-path="url(#${p}-fc)">
    <path d="M350 140C356 200 362 250 360 296C356 330 342 344 336 370C330 398 328 424 322 448C318 464 312 476 304 490L430 490L430 140Z" fill="${C.shadow}"/>
    <g transform="translate(4 13)">${hairCircles(C.shadow)}</g>
  </g>
  <path d="${FACE}" fill="none" stroke="${C.line}" stroke-width="${LW}"/>
  <g fill="${C.line}">${STUBBLE.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2.2"/>`).join("")}</g>
  <g id="${p}-nose"><path d="M302 284L272 370Q276 384 304 386Z" fill="${C.nose}"/><path d="M302 284L332 368Q330 384 304 386Z" fill="${C.shadow}"/>
    <path d="M302 284L272 370Q276 384 304 386Q330 384 332 368Z" fill="none" stroke="${C.line}" stroke-width="6" stroke-linejoin="round"/></g>
  ${eyeArt(C, p, "L")}${eyeArt(C, p, "R")}
  <g id="${p}-browL">${ln(C, "M232 246L292 238", 11)}</g>
  <g id="${p}-browR">${ln(C, "M308 238L368 246", 11)}</g>
  <g id="${p}-mouth">${Object.keys(M).map((k) => `<g id="${p}-m-${k}"${k === "closed" ? "" : HID}><g transform="${k === "closed" ? "translate(0 8)" : "translate(306 424) scale(1.32) translate(-306 -416)"}">${M[k]}</g></g>`).join("")}</g>
  <g>${hairCircles(C.line, ` stroke="${C.line}" stroke-width="${2 * LW}"`)}${hairCircles(C.hair)}</g>
  <path d="M228 156A26 26 0 0 1 264 136M282 112A26 26 0 0 1 320 110M338 140A26 26 0 0 1 374 136M222 196A20 20 0 0 1 248 180M290 190A20 20 0 0 1 318 182M360 192A20 20 0 0 1 386 188" fill="none" stroke="${C.shadow}" stroke-width="4" stroke-linecap="round"/>
</g>`;
    // collar band (ribbed crewneck): inner + outer quadratic curves, ribs between
    const q = (a, c, b, t) => [(1 - t) * (1 - t) * a[0] + 2 * (1 - t) * t * c[0] + t * t * b[0], (1 - t) * (1 - t) * a[1] + 2 * (1 - t) * t * c[1] + t * t * b[1]];
    const IA = [244, 494], IC = [300, 534], IB = [356, 494], OA = [204, 508], OC = [300, 602], OB = [396, 508];
    const ribs = Array.from({ length: 29 }, (_, i) => {
      const t = 0.04 + (i * 0.92) / 28, a = q(IA, IC, IB, t), b = q(OA, OC, OB, t);
      const s = [a[0] + (b[0] - a[0]) * 0.14, a[1] + (b[1] - a[1]) * 0.14], e = [a[0] + (b[0] - a[0]) * 0.86, a[1] + (b[1] - a[1]) * 0.86];
      return `M${f1(s[0])} ${f1(s[1])}L${f1(e[0])} ${f1(e[1])}`;
    }).join("");
    const BODY = "M40 720C40 620 70 572 150 544C196 528 228 514 248 506L352 506C372 514 404 528 450 544C530 572 560 620 560 720Z";
    const COLLAR = `M${IA}Q${IC} ${IB}L${OB}Q${OC} ${OA}Z`;
    const torso = `
  <clipPath id="${p}-tc"><path d="${BODY}"/></clipPath>
  <path d="${BODY}" fill="${C.shirt}"/>
  <g clip-path="url(#${p}-tc)">
    <path d="M404 524C466 552 496 620 494 720L600 720L600 480Z" fill="${C.shadow}"/>
    <path d="M300 602Q350 598 396 508L420 520Q380 610 300 622Z" fill="${C.shadow}"/>
  </g>
  ${ln(C, "M40 720C40 620 70 572 150 544C196 528 228 514 248 506M352 506C372 514 404 528 450 544C530 572 560 620 560 720", LW)}
  ${ln(C, "M236 630Q250 664 243 716M376 612Q364 652 372 704", LI + 1)}
  <path d="M250 400L350 400L350 532L250 532Z" fill="${C.skin}"/>
  <path d="M250 400L350 400L350 532L316 532C314 514 310 502 298 498C282 494 266 496 250 500Z" fill="${C.shadow}"/>
  ${ln(C, "M250 430L250 526M350 430L350 526", LW)}
  <path d="${COLLAR}" fill="${C.shirt}"/>
  <path d="M356 494L396 508Q362 558 316 562Q346 536 356 494Z" fill="${C.shadow}"/>
  ${ln(C, ribs, LI * 0.8)}
  <path d="${COLLAR}" fill="none" stroke="${C.line}" stroke-width="${LW}" stroke-linejoin="round"/>`;
    const ht = !!opts.halftone;
    return `<svg class="pz-svg" viewBox="0 0 600 680" overflow="visible" xmlns="http://www.w3.org/2000/svg">
${ht ? `<defs>
  <pattern id="${p}-dots" width="11" height="11" patternUnits="userSpaceOnUse"><circle cx="5.5" cy="5.5" r="2.7" fill="${C.dots}"/></pattern>
  <filter id="${p}-white" filterUnits="userSpaceOnUse" x="-600" y="-600" width="1800" height="1900"><feColorMatrix type="matrix" values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 1 0"/></filter>
  <mask id="${p}-sm" maskUnits="userSpaceOnUse" x="-600" y="-600" width="1800" height="1900"><use href="#${p}-rig" filter="url(#${p}-white)"/></mask>
</defs>
<g id="${p}-shadow" transform="translate(24 -16)" opacity=".8"><rect x="-600" y="-600" width="1800" height="1900" fill="url(#${p}-dots)" mask="url(#${p}-sm)"/></g>` : `<g id="${p}-shadow" style="display:none"></g>`}
<g id="${p}-rig"><g id="${p}-torso">${torso}
  <g id="${p}-neck">${head}</g>
  ${armArt(C, p, "A")}${armArt(C, p, "B")}
</g></g>
</svg>`;
  }

  // ---------- kinematics ----------
  const D2R = Math.PI / 180;
  const norm = (a) => { a = ((a + 180) % 360 + 360) % 360 - 180; return a === -180 ? 180 : a; };
  // rotation r points a bone (drawn along +y) in direction (-sin r, cos r)
  const dirToRot = (dx, dy) => Math.atan2(dy, dx) / D2R - 90;
  function ik(side, tx, ty, bend) {
    const [sx, sy] = SH[side];
    let dx = tx - sx, dy = ty - sy, d = Math.hypot(dx, dy);
    d = Math.min(Math.max(d, Math.abs(L1 - L2) + 1), (L1 + L2) * 0.999);
    const phi = Math.atan2(dy, dx);
    const a = Math.acos((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d));
    const pick = (s) => { const th = phi + s * a; return [sx + L1 * Math.cos(th), sy + L1 * Math.sin(th)]; };
    let s = bend || 0;
    if (!s) { const e1 = pick(1), e2 = pick(-1); s = e1[1] >= e2[1] ? 1 : -1; } // elbow below by default
    const [ex, ey] = pick(s);
    const ux = sx + (dx / Math.hypot(dx, dy)) * d, uy = sy + (dy / Math.hypot(dx, dy)) * d;
    const u = dirToRot(ex - sx, ey - sy), fa = dirToRot(ux - ex, uy - ey);
    return [norm(u), norm(fa - u), fa];
  }
  // arm spec: { ik:[x,y], bend, ha (absolute hand angle: 0 fingers down, 180 up, 90 left, -90 right), h } or { ang:[u,f,h], h }
  function solveArm(side, a) {
    if (a.ang) return { u: a.ang[0], f: a.ang[1], h: a.ang[2] || 0, hand: a.h || "open" };
    const [u, f, fa] = ik(side, a.ik[0], a.ik[1], a.bend);
    return { u, f, h: norm((a.ha ?? fa) - fa), hand: a.h || "open" };
  }

  const IDLE_A = { ang: [7, -5, 2], h: "open" }, IDLE_B = { ang: [-7, 5, -2], h: "open" };
  const POSES = {
    idle: { A: IDLE_A, B: IDLE_B, head: 0, brows: "neutral", eyes: "open", look: "center" },
    point_up: { A: { ik: [118, 372], ha: 176, h: "point" }, B: IDLE_B, head: -4, brows: "raised", look: "up" },
    point_left: { A: { ik: [62, 420], ha: 128, h: "point" }, B: IDLE_B, head: -6, brows: "raised", look: "upleft" },
    wave: { A: IDLE_A, B: { ik: [498, 372], ha: -172, h: "wave" }, head: 5, brows: "raised", look: "center", wiggle: true },
    thumbs_up: { A: { ik: [138, 446], ha: 172, h: "thumbs" }, B: IDLE_B, head: -3, brows: "raised", look: "center" },
    shrug: { A: { ik: [86, 524], ha: 96, h: "palmup" }, B: { ik: [514, 524], ha: -96, h: "palmup" }, head: 7, brows: "one", look: "upright", shoulders: -12 },
    both_open: { A: { ik: [96, 452], ha: 150, h: "open" }, B: { ik: [504, 452], ha: -150, h: "open" }, head: 0, brows: "raised", look: "center" },
    oops: { A: { ik: [300, 474], ha: 178, h: "open", bend: 1 }, B: IDLE_B, head: -5, brows: "raised", eyes: "wide", look: "right", mouth: "o" },
    thinking: { A: { ik: [298, 508], ha: 168, h: "fist", bend: 1 }, B: IDLE_B, head: 6, brows: "one", look: "upright", mouth: "closed" },
    shocked: { A: { ik: [124, 392], ha: 168, h: "open" }, B: { ik: [476, 392], ha: -168, h: "open" }, head: 0, brows: "raised", eyes: "wide", look: "center", mouth: "o", rig: -10 },
    present: { A: { ik: [58, 478], ha: 112, h: "palmup" }, B: IDLE_B, head: -6, brows: "raised", look: "left" },
    count_1: { A: IDLE_A, B: { ik: [476, 380], ha: -176, h: "point" }, head: 4, brows: "raised", look: "center" },
    count_2: { A: IDLE_A, B: { ik: [476, 380], ha: -176, h: "two" }, head: 4, brows: "raised", look: "center" },
    count_3: { A: IDLE_A, B: { ik: [476, 380], ha: -176, h: "three" }, head: 4, brows: "raised", look: "center" },
  };
  const BROWS = {
    neutral: { L: { y: 0, rotation: 0 }, R: { y: 0, rotation: 0 } },
    raised: { L: { y: -9, rotation: -3 }, R: { y: -9, rotation: 3 } },
    frown: { L: { y: 4, rotation: 12 }, R: { y: 4, rotation: -12 } },
    one: { L: { y: 2, rotation: 4 }, R: { y: -13, rotation: -2 } },
  };
  const LOOK = { center: [0, 0], left: [-12, 0], right: [12, 0], up: [0, -9], down: [0, 9], upleft: [-9, -8], upright: [9, -8] };

  // ---------- instance ----------
  function mount(container, opts = {}) {
    const el = typeof container === "string" ? document.querySelector(container) : container;
    const p = opts.id || "pz";
    const C = Object.assign({}, THEME, opts.theme || {});
    el.insertAdjacentHTML("beforeend", build(p, C, opts));
    const svg = el.lastElementChild;
    svg.style.width = (opts.width || 560) + "px";
    svg.style.height = "auto";
    svg.style.display = "block";
    const $ = (id) => svg.querySelector("#" + p + "-" + id);
    const P = {
      svg, p, theme: C,
      rig: $("rig"), torso: $("torso"), neck: $("neck"),
      arm: { A: $("armA"), B: $("armB") }, fore: { A: $("foreA"), B: $("foreB") }, hand: { A: $("handA"), B: $("handB") },
      hands: { A: {}, B: {} },
      eye: { L: $("eyeL"), R: $("eyeR") }, blink: { L: $("blinkL"), R: $("blinkR") },
      brow: { L: $("browL"), R: $("browR") },
      pupils: Array.from(svg.querySelectorAll("." + p + "-pupil")),
      mouths: {}, state: { pose: "idle" },
    };
    HANDS.forEach((h) => { P.hands.A[h] = $("hA-" + h); P.hands.B[h] = $("hB-" + h); });
    MOUTH_KEYS.forEach((k) => (P.mouths[k] = $("m-" + k)));
    // static pivots (set once; tweens only touch rotation/x/y/scale)
    gsap.set([P.rig, P.torso], { svgOrigin: "300 700" });
    gsap.set(P.neck, { svgOrigin: "300 500" });
    ["A", "B"].forEach((s) => gsap.set([P.arm[s], P.fore[s], P.hand[s]], { svgOrigin: "0 0" }));
    gsap.set([P.eye.L, P.blink.L], { svgOrigin: EYE.L.join(" ") });
    gsap.set([P.eye.R, P.blink.R], { svgOrigin: EYE.R.join(" ") });
    gsap.set(P.brow.L, { svgOrigin: BROW.L.join(" ") }); gsap.set(P.brow.R, { svgOrigin: BROW.R.join(" ") });
    // rest state
    const idle = POSES.idle;
    ["A", "B"].forEach((s) => {
      const a = solveArm(s, idle[s]);
      gsap.set(P.arm[s], { rotation: a.u }); gsap.set(P.fore[s], { rotation: a.f }); gsap.set(P.hand[s], { rotation: a.h });
      HANDS.forEach((h) => gsap.set(P.hands[s][h], { autoAlpha: h === a.hand ? 1 : 0 }));
    });
    MOUTH_KEYS.forEach((k) => gsap.set(P.mouths[k], { autoAlpha: k === "closed" ? 1 : 0 }));
    P.pose = (tl, t, name, o) => pose(P, tl, t, name, o);
    P.talk = (tl, words, o) => talk(P, tl, words, o);
    P.blinks = (tl, end, o) => blinks(P, tl, end, o);
    P.look = (tl, t, dir, o) => look(P, tl, t, dir, o);
    P.face = (tl, t, f, o) => face(P, tl, t, f, o);
    P.mouth = (tl, t, v) => mouth(P, tl, t, v);
    P.breathe = (tl, from, to, o) => breathe(P, tl, from, to, o);
    P.enter = (tl, t, o) => enter(P, tl, t, o);
    Puppet.current = P;
    return P;
  }

  function mouth(P, tl, t, v) {
    if (!P.mouths[v]) return;
    tl.set(Object.values(P.mouths), { autoAlpha: 0 }, t);
    tl.set(P.mouths[v], { autoAlpha: 1 }, t);
  }
  function look(P, tl, t, dir = "center", o = {}) {
    const [x, y] = Array.isArray(dir) ? dir : LOOK[dir] || LOOK.center;
    tl.to(P.pupils, { x, y, duration: o.d || 0.12, ease: "power2.out" }, t);
  }
  function face(P, tl, t, f = {}, o = {}) {
    const d = o.d || 0.18;
    if (f.brows && BROWS[f.brows]) {
      tl.to(P.brow.L, { ...BROWS[f.brows].L, duration: d, ease: "back.out(2)" }, t);
      tl.to(P.brow.R, { ...BROWS[f.brows].R, duration: d, ease: "back.out(2)" }, t);
    }
    if (f.eyes) {
      const s = f.eyes === "wide" ? 1.2 : 1;
      tl.to([P.eye.L, P.eye.R], { scale: s, duration: d * 0.8, ease: "back.out(2.5)" }, t);
      if (f.eyes === "blink") blinkAt(P, tl, t);
    }
    if (f.look) look(P, tl, t, f.look, o);
    if (f.mouth) mouth(P, tl, t + d * 0.3, f.mouth);
  }
  function blinkAt(P, tl, t) {
    const b = [P.blink.L, P.blink.R];
    tl.to(b, { scaleY: 0.08, duration: 0.05, ease: "power2.in" }, t);
    tl.to(b, { scaleY: 1, duration: 0.08, ease: "power2.out" }, t + 0.07);
  }
  function blinks(P, tl, end, o = {}) {
    let seed = o.seed || 11;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
    let t = o.from ?? 0.8;
    while (t < end - 0.2) {
      blinkAt(P, tl, t);
      if (rnd() < 0.18 && t + 0.32 < end) { blinkAt(P, tl, t + 0.22); t += 0.22; }
      t += 2.3 + rnd() * 2.1;
    }
  }

  function pose(P, tl, t, name, o = {}) {
    const def = typeof name === "string" ? POSES[name] : name;
    if (!def) throw new Error("Puppet: unknown pose " + name);
    const d = o.d || 0.2, ease = o.ease || "back.out(1.7)";
    ["A", "B"].forEach((s) => {
      const a = solveArm(s, def[s] || (s === "A" ? IDLE_A : IDLE_B));
      tl.to(P.arm[s], { rotation: a.u, y: s === "A" || s === "B" ? def.shoulders || 0 : 0, duration: d, ease }, t);
      tl.to(P.fore[s], { rotation: a.f, duration: d, ease }, t + 0.02);
      tl.to(P.hand[s], { rotation: a.h, duration: d, ease }, t + 0.04);
      tl.set(Object.values(P.hands[s]), { autoAlpha: 0 }, t + d / 2);
      tl.set(P.hands[s][a.hand], { autoAlpha: 1 }, t + d / 2);
      if (def.wiggle && def[s] && def[s].h === "wave") {
        const hold = o.hold ?? 0.9, n = Math.max(1, Math.floor(hold / 0.3));
        let tt = t + d;
        for (let i = 0; i < n; i++) {
          tl.to(P.hand[s], { rotation: a.h + (s === "B" ? -18 : 18), duration: 0.14, ease: "sine.inOut" }, tt);
          tl.to(P.hand[s], { rotation: a.h + (s === "B" ? 8 : -8), duration: 0.14, ease: "sine.inOut" }, tt + 0.14);
          tt += 0.28;
        }
        tl.to(P.hand[s], { rotation: a.h, duration: 0.1, ease: "sine.out" }, tt);
      }
    });
    tl.to(P.neck, { rotation: def.head || 0, duration: d * 1.2, ease: "back.out(1.4)" }, t);
    tl.to(P.rig, { y: def.rig || 0, duration: d, ease }, t);
    face(P, tl, t, { brows: def.brows || "neutral", eyes: def.eyes || "open", look: def.look || "center", mouth: o.mouth === false ? null : def.mouth }, { d });
    if (!def.mouth && o.mouth !== false && P.state.lastMouthPose) mouth(P, tl, t + d * 0.3, "closed");
    P.state.lastMouthPose = !!def.mouth;
  }

  // ---------- lip flap ----------
  function visFor(cluster) {
    const c = cluster[0];
    if (c === "o" || c === "u" || cluster === "ow" || cluster.includes("oo")) return "o";
    if (c === "a") return "wide";
    if (cluster === "ee" || cluster === "ea") return "smile";
    return c === "e" || c === "i" || c === "y" ? "small" : "small";
  }
  function talk(P, tl, words, o = {}) {
    const W = words.filter((w) => w && w.e > w.s);
    W.forEach((w, i) => {
      const txt = String(w.w || "").toLowerCase().replace(/[^a-z]/g, "") || "a";
      let cl = txt.match(/[aeiouy]+/g) || ["a"];
      if (cl.length > 1 && txt.endsWith("e") && !txt.endsWith("ee") && cl[cl.length - 1] === "e") cl = cl.slice(0, -1);
      const n = cl.length, dur = (w.e - w.s) / n;
      let t = w.s;
      if (/^[mbp]/.test(txt) && w.e - w.s > 0.1) { mouth(P, tl, t, "closed"); t += 0.04; }
      cl.forEach((c, k) => {
        const ts = w.s + k * dur + (k === 0 ? t - w.s : 0);
        const v = n === 1 && w.e - w.s > 0.3 && c[0] === "a" ? "wide" : visFor(c);
        mouth(P, tl, ts, v);
        if (dur > 0.16) mouth(P, tl, ts + dur * 0.62, v === "wide" || v === "o" ? "small" : "closed");
      });
      const nx = W[i + 1];
      if (!nx || nx.s - w.e > 0.09) mouth(P, tl, w.e, "closed");
    });
  }

  function breathe(P, tl, from, to, o = {}) {
    const per = o.period || 3.2, amt = o.amt || 0.012;
    for (let t = from; t + per <= to; t += per) {
      tl.to(P.torso, { scaleY: 1 + amt, duration: per / 2, ease: "sine.inOut" }, t);
      tl.to(P.torso, { scaleY: 1, duration: per / 2, ease: "sine.inOut" }, t + per / 2);
    }
  }
  function enter(P, tl, t, o = {}) {
    tl.fromTo(P.rig, { y: 700 }, { y: 0, duration: o.d || 0.32, ease: "back.out(1.3)", immediateRender: false }, t);
  }

  const cur = (o) => (o && o.puppet) || Puppet.current;
  const Puppet = {
    mount, POSES, HANDS, LOOK, BROWS, ik, solveArm, current: null,
    pose: (tl, t, name, o) => pose(cur(o), tl, t, name, o),
    talk: (tl, words, o) => talk(cur(o), tl, words, o),
    blinks: (tl, end, o) => blinks(cur(o), tl, end, o),
    look: (tl, t, dir, o) => look(cur(o), tl, t, dir, o),
    face: (tl, t, f, o) => face(cur(o), tl, t, f, o),
    mouth: (tl, t, v, o) => mouth(cur(o), tl, t, v),
    breathe: (tl, a, b, o) => breathe(cur(o), tl, a, b, o),
    enter: (tl, t, o) => enter(cur(o), tl, t, o),
    svg: (id, o = {}) => build(id || "pz", Object.assign({}, THEME, o.theme || {}), o),
    THEME,
    poseNames: () => Object.keys(POSES),
  };
  root.Puppet = Puppet;
  if (typeof module !== "undefined") module.exports = Puppet;
})(typeof window !== "undefined" ? window : globalThis);
