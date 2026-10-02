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
    pants: "#1F2B4D",  // full-body: flat ink-blue trousers (cobalt `shadow` is the shade side)
    belt: "#111111",
    shoe: "#FFFFFF",   // sneakers: white, black outline
    sole: "#E94F37",   // sneaker sole stripe (defaults to the shirt red)
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
    return `<g transform="translate(${SH[side][0]} ${SH[side][1]})"><g id="${p}-sw${side}"><g id="${p}-arm${side}">
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
</g></g></g>`;
  }

  // ---------- legs (full-body mode) ----------
  const FB = { HIP: { A: [222, 900], B: [378, 900] }, ANK: { A: [224, 1194], B: [376, 1194] }, LT: 148, LS: 148, RT: 46, RS: 40, FLOOR: 1235, SOLE: 38, TOE: 84, VB: "0 70 600 1175" };
  const SHOE = "M-42 -24L16 -24C26 -10 50 -6 68 2C90 12 92 38 62 38L-34 38C-54 38 -56 14 -42 -24Z";
  function legArt(C, p, s) {
    const { RT, RS, LT, LS } = FB;
    const mir = s === "B" ? ` transform="scale(-1 1)"` : "";
    const th = (extra) => `class="${p}-th${s}" x="-${RT}" y="-${RT}" width="${2 * RT}" height="${LT + 2 * RT}" rx="${RT}"${extra || ""}`;
    const sh = `x="-${RS}" y="-${RS}" width="${2 * RS}" height="${LS + RS + 12}" rx="${RS}"`;
    return `<g id="${p}-leg${s}"><g${mir}>
    <clipPath id="${p}-tc${s}"><rect ${th()}/></clipPath>
    <rect ${th(` fill="${C.pants}"`)}/>
    <g clip-path="url(#${p}-tc${s})"><rect class="${p}-ths${s}" x="12" y="-70" width="70" height="${LT + 140}" fill="${C.shadow}"/></g>
    <rect ${th(` fill="none" stroke="${C.line}" stroke-width="${LW}"`)}/></g>
  <g id="${p}-shin${s}" transform="translate(0 ${LT})"><g${mir}>
    <clipPath id="${p}-sc${s}"><rect ${sh}/></clipPath>
    <rect ${sh} fill="${C.pants}"/>
    <g clip-path="url(#${p}-sc${s})"><rect x="11" y="-60" width="70" height="${LS + 120}" fill="${C.shadow}"/></g>
    ${ln(C, `M-26 ${LS - 22}Q0 ${LS - 14} 26 ${LS - 22}`, LI)}${ln(C, `M-14 30Q-19 56-13 76`, LI)}
    <rect ${sh} fill="none" stroke="${C.line}" stroke-width="${LW}"/></g>
    <g id="${p}-foot${s}" transform="translate(0 ${LS})"><g id="${p}-toe${s}">
      <clipPath id="${p}-fc${s}"><path d="${SHOE}"/></clipPath>
      <path d="${SHOE}" fill="${C.shoe}"/>
      <g clip-path="url(#${p}-fc${s})">
        <path d="M-70 -30L-18 -30C-26 0-26 26-22 44L-70 44Z" fill="${C.shadow}"/>
        <rect x="-70" y="23" width="170" height="30" fill="${C.sole}"/>${ln(C, "M-70 23L100 23", LI)}</g>
      ${ln(C, "M40 -3C48 8 48 20 44 23", LI)}${ln(C, "M-4 -22L2 -9M12 -21L19 -8", LI)}
      <path d="${SHOE}" fill="none" stroke="${C.line}" stroke-width="${LW}" stroke-linejoin="round"/>
    </g></g>
  </g></g>`;
  }
  function pelvisArt(C, p) { // trouser waist + hips: no wider than the outer thigh edges (x 176..424)
    return `<rect x="178" y="858" width="244" height="94" fill="${C.pants}"/>
  ${ln(C, "M176 862L176 948M424 862L424 948", LW)}
  <rect x="174" y="852" width="252" height="24" rx="5" fill="${C.belt}" stroke="${C.line}" stroke-width="${LW}"/>
  <rect x="278" y="855" width="44" height="18" rx="4" fill="${C.eye}" stroke="${C.line}" stroke-width="${LI}"/>
  <path d="M268 944Q300 972 332 944Z" fill="${C.pants}"/>${ln(C, "M270 947Q300 970 330 947", LW)}`;
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
  <g id="${p}-feat"><g fill="${C.line}">${STUBBLE.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2.2"/>`).join("")}</g>
  <g id="${p}-nose"><path d="M302 284L272 370Q276 384 304 386Z" fill="${C.nose}"/><path d="M302 284L332 368Q330 384 304 386Z" fill="${C.shadow}"/>
    <path d="M302 284L272 370Q276 384 304 386Q330 384 332 368Z" fill="none" stroke="${C.line}" stroke-width="6" stroke-linejoin="round"/></g>
  ${eyeArt(C, p, "L")}${eyeArt(C, p, "R")}
  <g id="${p}-browL">${ln(C, "M232 246L292 238", 11)}</g>
  <g id="${p}-browR">${ln(C, "M308 238L368 246", 11)}</g>
  <g id="${p}-mouth">${Object.keys(M).map((k) => `<g id="${p}-m-${k}"${k === "closed" ? "" : HID}><g transform="${k === "closed" ? "translate(0 8)" : "translate(306 424) scale(1.32) translate(-306 -416)"}">${M[k]}</g></g>`).join("")}</g></g>
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
    const full = opts.mode === "full";
    const BODY = full ? "M150 544C196 528 228 514 248 506L352 506C372 514 404 528 450 544C482 562 498 592 502 640L492 856L108 856L98 640C102 592 118 562 150 544Z"
      : "M40 720C40 620 70 572 150 544C196 528 228 514 248 506L352 506C372 514 404 528 450 544C530 572 560 620 560 720Z";
    const SIDES = full ? "M108 856L98 640C102 592 118 562 150 544C196 528 228 514 248 506M352 506C372 514 404 528 450 544C482 562 498 592 502 640L492 856"
      : "M40 720C40 620 70 572 150 544C196 528 228 514 248 506M352 506C372 514 404 528 450 544C530 572 560 620 560 720";
    const hem = full ? `<g clip-path="url(#${p}-tc)"><rect x="30" y="824" width="540" height="40" fill="${C.shirt}"/><rect x="448" y="824" width="140" height="40" fill="${C.shadow}"/>
    ${ln(C, Array.from({ length: 33 }, (_, i) => { const x = f1(60 + i * 14.5); return `M${x} 832L${x} 852`; }).join(""), LI * 0.8)}${ln(C, "M30 824Q300 836 570 824", LW)}</g>` : "";
    const COLLAR = `M${IA}Q${IC} ${IB}L${OB}Q${OC} ${OA}Z`;
    const torso = `
  <clipPath id="${p}-tc"><path d="${BODY}"/></clipPath>
  <path d="${BODY}" fill="${C.shirt}"/>
  <g clip-path="url(#${p}-tc)">
    <path d="M404 524${full ? "C456 548 490 590 498 650L494 860" : "C466 552 496 620 494 720"}L600 ${full ? 860 : 720}L600 480Z" fill="${C.shadow}"/>
    <path d="M300 602Q350 598 396 508L420 520Q380 610 300 622Z" fill="${C.shadow}"/>
  </g>
  ${hem}
  ${ln(C, SIDES, LW)}${full ? ln(C, "M100 856L500 856", LW) : ""}
  ${ln(C, "M236 630Q250 664 243 716M376 612Q364 652 372 704", LI + 1)}${full ? ln(C, "M158 770Q184 792 178 818M424 760Q410 790 418 812", LI + 1) : ""}
  <path d="M250 400L350 400L350 532L250 532Z" fill="${C.skin}"/>
  <path d="M250 400L350 400L350 532L316 532C314 514 310 502 298 498C282 494 266 496 250 500Z" fill="${C.shadow}"/>
  ${ln(C, "M250 430L250 526M350 430L350 526", LW)}
  <path d="${COLLAR}" fill="${C.shirt}"/>
  <path d="M356 494L396 508Q362 558 316 562Q346 536 356 494Z" fill="${C.shadow}"/>
  ${ln(C, ribs, LI * 0.8)}
  <path d="${COLLAR}" fill="none" stroke="${C.line}" stroke-width="${LW}" stroke-linejoin="round"/>`;
    const ht = !!opts.halftone;
    const neck = `<g id="${p}-hb"><g id="${p}-neck"><g id="${p}-hd">${head}</g></g></g>`;
    const upper = `<g id="${p}-torso">${torso}
  ${neck}
  ${armArt(C, p, "A")}${armArt(C, p, "B")}
</g>`;
    const rigSvg = full ? `<g id="${p}-gsh"><ellipse cx="300" cy="${FB.FLOOR}" rx="190" ry="22" fill="${C.shadow}"/></g>
<g id="${p}-mrig"><g id="${p}-rig">${legArt(C, p, "A")}${legArt(C, p, "B")}
  <g id="${p}-hips"><g id="${p}-pelvis">${pelvisArt(C, p)}</g><g id="${p}-tw">${upper}</g></g>
</g></g>` : `<g id="${p}-rig">${upper}</g>`;
    return `<svg class="pz-svg" viewBox="${full ? FB.VB : "0 0 600 680"}" overflow="visible" xmlns="http://www.w3.org/2000/svg">
${ht ? `<defs>
  <pattern id="${p}-dots" width="11" height="11" patternUnits="userSpaceOnUse"><circle cx="5.5" cy="5.5" r="2.7" fill="${C.dots}"/></pattern>
  <filter id="${p}-white" filterUnits="userSpaceOnUse" x="-600" y="-600" width="1800" height="1900"><feColorMatrix type="matrix" values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 1 0"/></filter>
  <mask id="${p}-sm" maskUnits="userSpaceOnUse" x="-600" y="-600" width="1800" height="1900"><use href="#${p}-rig" filter="url(#${p}-white)"/></mask>
</defs>
<g id="${p}-shadow" transform="translate(24 -16)" opacity=".8"><rect x="-600" y="-600" width="1800" height="1900" fill="url(#${p}-dots)" mask="url(#${p}-sm)"/></g>` : `<g id="${p}-shadow" style="display:none"></g>`}
${rigSvg}
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
    // ---- body states (full mode; in bust mode only the arm/face part applies) ----
    stand: { A: IDLE_A, B: IDLE_B, head: 0, brows: "neutral", look: "center", body: "stand" },
    step_l: { A: IDLE_A, B: IDLE_B, head: -3, brows: "neutral", look: "left", body: "step_l" },
    step_r: { A: IDLE_A, B: IDLE_B, head: 3, brows: "neutral", look: "right", body: "step_r" },
    lean: { A: IDLE_A, B: { ik: [466, 706], ha: -150, h: "fist", bend: -1 }, head: 4, brows: "one", look: "upright", body: "lean" },
    sit: { A: { ang: [12, -24, 8], h: "open" }, B: { ang: [-12, 24, -8], h: "open" }, head: 0, brows: "neutral", look: "center", body: "sit" },
    jump: { A: { ik: [96, 420], ha: 160, h: "open" }, B: { ik: [504, 420], ha: -160, h: "open" }, head: 0, brows: "raised", eyes: "wide", look: "up", mouth: "o", body: "jump" },
    hop: { A: { ik: [118, 410], ha: 176, h: "fist" }, B: { ik: [482, 410], ha: -176, h: "fist" }, head: 0, brows: "raised", look: "up", mouth: "smile", body: "hop" },
    present_left: { A: { ik: [34, 534], ha: 104, h: "palmup" }, B: IDLE_B, head: -6, brows: "raised", look: "left", body: "present_left" },
    present_right: { A: IDLE_A, B: { ik: [566, 534], ha: -104, h: "palmup" }, head: 6, brows: "raised", look: "right", body: "present_right" },
    point_screen_l: { A: { ik: [-30, 430], ha: 124, h: "point" }, B: IDLE_B, head: -7, brows: "raised", look: "upleft", body: "point_screen_l" },
    point_screen_r: { A: IDLE_A, B: { ik: [630, 430], ha: -124, h: "point" }, head: 7, brows: "raised", look: "upright", body: "point_screen_r" },
    tap: { A: IDLE_A, B: IDLE_B, head: 2, brows: "one", look: "down", body: "tap" },
  };
  const BROWS = {
    neutral: { L: { y: 0, rotation: 0 }, R: { y: 0, rotation: 0 } },
    raised: { L: { y: -9, rotation: -3 }, R: { y: -9, rotation: 3 } },
    frown: { L: { y: 4, rotation: 12 }, R: { y: 4, rotation: -12 } },
    one: { L: { y: 2, rotation: 4 }, R: { y: -13, rotation: -2 } },
  };
  const LOOK = { center: [0, 0], left: [-12, 0], right: [12, 0], up: [0, -9], down: [0, 9], upleft: [-9, -8], upright: [9, -8] };

  // ---------- full-body rig: channels (keyframe tracks) -> pure solve -> DOM ----------
  // Every body motion writes keyframes into per-channel tracks (viewBox units, degrees, 0..1 factors). One driver tween
  // (ease none) on your timeline calls apply(time), which evaluates the tracks as a pure function of time and solves
  // the leg IK. Feet are IK targets in the figure frame, so planted feet never slide while the hips move. Seek-safe.
  const CH = { x: 0, y: 0, flip: 1, sq: 0, hx: 0, hy: 0, tilt: 0, lean: 0, twist: 0, sit: 0, fAx: 0, fAy: 0, fAr: 0, fBx: 0, fBy: 0, fBr: 0, toeA: -1, toeB: 1, swA: 0, swB: 0, hbY: 0, hbR: 0 };
  const STEPPED = { toeA: 1, toeB: 1 };
  const EASE = {
    none: (u) => u, in: (u) => u * u, out: (u) => 1 - (1 - u) * (1 - u), io: (u) => (u < 0.5 ? 2 * u * u : 1 - 2 * (1 - u) * (1 - u)),
    sio: (u) => 0.5 - 0.5 * Math.cos(Math.PI * u), in3: (u) => u * u * u, out3: (u) => 1 - Math.pow(1 - u, 3),
    back: (u) => 1 + 2.70158 * Math.pow(u - 1, 3) + 1.70158 * Math.pow(u - 1, 2),
    spring: (u) => (u >= 1 ? 1 : 1 - Math.exp(-7 * u) * Math.cos(15 * u)),
  };
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const sgn = (v) => (v < 0 ? -1 : 1);
  const PEL = { drop: 110, spread: 16, fwd: 20 }; // sit: hips drop, feet spread and come toward the camera

  function newRig() {
    const tr = {}; Object.keys(CH).forEach((c) => (tr[c] = []));
    const R = { tr, idle: [], end: 0, k: 1 };
    R.val = (c, t) => {
      const a = tr[c]; if (!a.length || t < a[0].t) return CH[c];
      let lo = 0, hi = a.length - 1;
      if (t >= a[hi].t) return a[hi].v;
      while (hi - lo > 1) { const m = (lo + hi) >> 1; if (a[m].t <= t) lo = m; else hi = m; }
      const A = a[lo], B = a[hi];
      if (STEPPED[c]) return A.v;
      return A.v + (B.v - A.v) * (EASE[B.e] || EASE.none)((t - A.t) / (B.t - A.t));
    };
    R.key = (c, t, v, e) => {
      const a = tr[c]; R.end = Math.max(R.end, t);
      let i = a.length;
      while (i > 0 && a[i - 1].t > t + 1e-9) i--;
      if (i > 0 && Math.abs(a[i - 1].t - t) < 1e-9) { a[i - 1].v = v; a[i - 1].e = e || "none"; return; }
      a.splice(i, 0, { t, v, e: e || "none" });
    };
    R.hold = (c, t) => { const a = tr[c]; if (!a.some((k) => Math.abs(k.t - t) < 1e-9)) R.key(c, t, R.val(c, t), "none"); };
    R.go = (t0, t1, o, e) => { for (const c in o) { R.hold(c, t0); R.key(c, t1, o[c], e || "io"); } };
    R.vals = (t) => {
      const v = {}; for (const c in CH) v[c] = R.val(c, t);
      R.idle.forEach((L) => {
        const w = clamp((t - L.a) / 0.5, 0, 1) * clamp((L.b - t) / 0.5, 0, 1); if (!w) return;
        const s = L.amt * w * w * (3 - 2 * w), W = 6.2832 * t;
        v.hx += s * 3.4 * Math.sin(W / 4.3); v.hy += s * 1.8 * Math.sin(W / 3.1 + 0.6);
        v.lean += s * 0.9 * Math.sin(W / 5.2 + 1); v.hbR += s * 0.9 * Math.sin(W / 3.7); v.tilt += s * 0.5 * Math.sin(W / 4.9 + 2);
        v.swA += s * 1.4 * Math.sin(W / 3.4); v.swB -= s * 1.4 * Math.sin(W / 3.4 + 0.5);
      });
      return v;
    };
    // ---- motions (pure keyframe writers; author in time order) ----
    R.shift = (t, dir, o = {}) => { // hips over one foot, the other hip drops so that knee relaxes; feet stay planted
      const d = o.d || 0.5, m = dir === "l" ? -1 : dir === "r" ? 1 : 0, a = o.amt ?? 1;
      R.go(t, t + d, { hx: m * 28 * a, tilt: -m * 7 * a, lean: m * 5 * a, hy: m ? 8 * a : 0 }, o.ease || "io");
    };
    R.step = (t, side, o = {}) => { // lift one foot, place it wider, hips follow
      const f = side === "l" ? "A" : "B", sg = side === "l" ? -1 : 1, d = o.d || 0.42, len = o.len ?? 46;
      R.go(t, t + d, { ["f" + f + "x"]: R.val("f" + f + "x", t) + sg * len }, "io");
      R.hold("f" + f + "y", t); R.key("f" + f + "y", t + d * 0.45, -34, "out"); R.key("f" + f + "y", t + d, 0, "in");
      R.hold("f" + f + "r", t); R.key("f" + f + "r", t + d * 0.45, f === "A" ? 12 : -12, "out"); R.key("f" + f + "r", t + d, 0, "in");
      R.go(t, t + d, { hx: R.val("hx", t) + sg * len * 0.45, hy: 6 }, "io");
    };
    R.home = (t, d = 0.5) => { // neutral stance: feet step in with a small arc, hips and torso centre
      if (R.val("sit", t) > 0.3) return R.standUp(t, d);
      ["A", "B"].forEach((f) => {
        if (Math.abs(R.val("f" + f + "x", t)) > 1) {
          R.hold("f" + f + "y", t); R.key("f" + f + "y", t + d * 0.45, -26, "out"); R.key("f" + f + "y", t + d, 0, "in");
          R.go(t, t + d, { ["f" + f + "x"]: 0 }, "io");
        }
      });
      R.go(t, t + d, { hx: 0, hy: 0, tilt: 0, lean: 0, twist: 0 }, "io");
    };
    R.leanWall = (t, dir, d = 0.55) => { // straight diagonal body, ankles crossed
      const m = dir === "l" ? -1 : 1;
      R.go(t, t + d, { lean: m * 10, hx: m * 34, tilt: -m * 2, twist: m * 0.3, hy: 6 }, "out");
      R.go(t, t + d, { ["f" + (m > 0 ? "A" : "B") + "x"]: m * 62 }, "io");
    };
    R.presenting = (t, side, d = 0.5) => { // body turned a quarter toward the content, near foot steps out
      const m = side === "l" ? -1 : 1;
      R.go(t, t + d, { twist: m, lean: m * 3 }, "back");
      R.step(t, side, { d, len: 30 });
    };
    R.pointScreen = (t, side, d = 0.5) => {
      const m = side === "l" ? -1 : 1;
      R.go(t, t + d, { twist: m, lean: m * 6 }, "back");
      R.step(t, side, { d, len: 36 });
    };
    R.turn = (t, to, d = 0.42) => { // turn in place as a 3/4 turn (no mirroring): face features + torso narrow toward the new side, feet shuffle
      const tw = R.val("twist", t), tgt = to === "front" ? 0 : to === "left" ? -1 : to === "right" ? 1 : (tw >= 0 ? -1 : 1);
      const hy0 = R.val("hy", t);
      R.go(t, t + d, { twist: tgt }, "back"); R.hold("hy", t); R.key("hy", t + d * 0.5, hy0 + 8, "out"); R.key("hy", t + d, hy0, "in");
      if (tgt) R.step(t + 0.05, tgt < 0 ? "l" : "r", { d: d * 0.8, len: 14 });
    };
    R.sit = (t, d = 0.55) => {
      R.go(t, t + 0.2, { lean: 5 }, "out"); R.go(t + 0.2, t + d + 0.3, { lean: 0 }, "io");
      R.go(t + 0.05, t + 0.05 + d, { sit: 1, hx: 0, tilt: 0 }, "back");
    };
    R.standUp = (t, d = 0.55) => {
      R.go(t, t + 0.22, { lean: 7 }, "out");
      R.go(t + 0.1, t + 0.1 + d, { sit: 0, hx: 0, tilt: 0, twist: 0 }, "out");
      R.go(t + 0.3, t + 0.1 + d + 0.15, { lean: 0 }, "io");
    };
    R.jump = (t, o = {}) => { // crouch, stretch on take-off, tuck at the apex, squash on landing, spring settle
      const h = o.h ?? 150, a = o.crouch ?? 0.2, up = o.up ?? 0.27, dn = o.down ?? 0.25;
      const t0 = t + a, ta = t0 + up, tt = ta + dn, k = clamp(h / 150, 0.4, 1.4);
      R.go(t, t0, { hy: 36 * k, sq: 0.13 * k }, "out");
      R.go(t0, t0 + 0.09, { hy: -4, sq: -0.11 * k }, "out");
      R.hold("y", t0); R.key("y", ta, -h, "out"); R.key("y", tt, 0, "in");
      R.key("sq", ta, -0.04 * k, "io"); R.key("hy", ta, 0, "io");
      R.key("sq", tt, 0.16 * k, "in"); R.key("hy", tt, 30 * k, "in");
      R.key("sq", tt + 0.32, 0, "spring"); R.key("hy", tt + 0.32, 0, "spring");
      ["fAy", "fBy"].forEach((c) => { R.hold(c, t0); R.key(c, t0 + 0.06, -4, "out"); R.key(c, ta, -h * 0.17, "out"); R.key(c, tt - 0.05, -6, "in"); R.key(c, tt, 0, "none"); });
      return { launch: t0, apex: ta, land: tt, end: tt + 0.32 };
    };
    R.hop = (t, o = {}) => {
      const n = o.n ?? 2; let tt = t, last;
      for (let i = 0; i < n; i++) { last = R.jump(tt, { h: o.h ?? 62, crouch: 0.11, up: 0.17, down: 0.15 }); tt = last.land + 0.12; }
      return { launch: t + 0.11, land: last.land, end: tt };
    };
    R.tap = (t, o = {}) => { // nervous toe tap: the free foot pivots about its toe
      const f = o.foot === "l" ? "A" : "B", hold = o.hold ?? 1, n = Math.max(1, Math.round(hold / 0.22)), per = hold / n, te = t + hold;
      const sg = R.val("toe" + f, t), env = (ts) => clamp((ts - t) / 0.06, 0, 1) * clamp((te - ts) / 0.06, 0, 1);
      R.hold("f" + f + "x", t); R.hold("f" + f + "y", t); R.hold("f" + f + "r", t);
      const bx = R.val("f" + f + "x", t), by = R.val("f" + f + "y", t);
      for (let ts = t; ts <= te + 1e-6; ts += 1 / 60) {
        const th = 24 * Math.pow(Math.sin(Math.PI * (((ts - t) / per) % 1)), 1.3) * env(ts);
        const c = Math.cos(th * D2R), s = Math.sin(th * D2R), x0 = -FB.TOE, y0 = -FB.SOLE;
        R.key("f" + f + "x", ts, bx + sg * ((x0 * c - y0 * s) + FB.TOE), "none");
        R.key("f" + f + "y", ts, by + ((x0 * s + y0 * c) + FB.SOLE), "none");
        R.key("f" + f + "r", ts, sg * th, "none");
      }
      R.key("f" + f + "x", te + 1e-4, bx, "none"); R.key("f" + f + "y", te + 1e-4, by, "none"); R.key("f" + f + "r", te + 1e-4, 0, "none");
    };
    // walk: stance feet are planted in WORLD space (rig offset = world - body x); swing feet arc over; hips bob; arms swing.
    R.walk = (t0, t1, o = {}) => {
      const xs = o.from ?? R.val("x", t0), xe = o.to, D = xe - xs;
      if (Math.abs(D) < 1) return;
      const dir = sgn(D), T = t1 - t0, cl = Math.min(0.2, T * 0.18), TS = T - cl, stride = o.stride ?? 96;
      const n = Math.max(1, o.steps ?? Math.ceil(Math.abs(D) / stride)), tau = TS / n;
      const bx = (ts) => xs + D * EASE.sio(clamp((ts - t0) / T, 0, 1));
      const first = dir > 0 ? "A" : "B", other = (f) => (f === "A" ? "B" : "A");
      const w0 = { A: xs + R.val("fAx", t0), B: xs + R.val("fBx", t0) }, cur = { A: w0.A, B: w0.B }, steps = [];
      for (let i = 0; i <= n; i++) {
        const f = i === n ? other(steps[n - 1].f) : (i % 2 ? other(first) : first);
        const tb = t0 + (i === n ? TS : i * tau), dur = i === n ? cl : tau;
        const to = i < n - 1 ? (bx(t0 + (i + 1) * tau) + bx(t0 + (i + 2) * tau)) / 2 : xe;
        steps.push({ f, from: cur[f], to, tb, dur }); cur[f] = to;
      }
      const B0 = {}; ["hx", "tilt", "lean", "swA", "swB", "hbY", "hbR", "fAy", "fBy", "fAr", "fBr", "hy"].forEach((c) => (B0[c] = R.val(c, t0)));
      R.key("toeA", t0, dir, "none"); R.key("toeB", t0, dir, "none");
      const N = Math.ceil(T * 60);
      for (let q = 0; q <= N; q++) {
        const ts = t0 + (q / N) * T, x = bx(ts);
        const env = clamp((ts - t0) / 0.25, 0, 1) * clamp((t1 - ts) / 0.25, 0, 1), e = env * env * (3 - 2 * env);
        const si = ts >= t0 + TS ? n : Math.min(n - 1, Math.floor((ts - t0) / tau)), S = steps[si], u = clamp((ts - S.tb) / S.dur, 0, 1);
        const w = {}, lift = { A: 0, B: 0 }, rot = { A: 0, B: 0 };
        ["A", "B"].forEach((f) => {
          let pos = w0[f];
          for (let j = 0; j <= si; j++) if (steps[j].f === f && (j < si || u >= 1)) pos = steps[j].to;
          if (S.f === f && u < 1) {
            pos = S.from + (S.to - S.from) * EASE.sio(u);
            lift[f] = -(16 + 0.12 * Math.abs(S.to - S.from)) * Math.sin(Math.PI * u); rot[f] = -dir * 13 * Math.sin(Math.PI * u);
          }
          w[f] = pos;
        });
        const phi = (ts - t0) / (2 * tau), sgA = -Math.sin(6.2832 * phi) * (first === "A" ? 1 : -1), sph = Math.sin(Math.PI * u);
        const relA = w.A - x, relB = w.B - x, mix = (c, val) => B0[c] * (1 - e) + val * e;
        R.key("x", ts, x, "none");
        R.key("fAx", ts, relA, "none"); R.key("fBx", ts, relB, "none");
        R.key("fAy", ts, B0.fAy + lift.A * e, "none"); R.key("fBy", ts, B0.fBy + lift.B * e, "none");
        R.key("fAr", ts, B0.fAr + rot.A * e, "none"); R.key("fBr", ts, B0.fBr + rot.B * e, "none");
        R.key("hy", ts, mix("hy", B0.hy + 16 - 9 * sph), "none");
        R.key("hx", ts, mix("hx", -6 * sgA), "none"); R.key("tilt", ts, mix("tilt", 3.5 * sgA), "none");
        R.key("lean", ts, mix("lean", 2.6 * dir - 1.2 * sgA), "none");
        R.key("swA", ts, mix("swA", 13 * clamp(relA * dir / 55, -1, 1)), "none"); R.key("swB", ts, mix("swB", 13 * clamp(relB * dir / 55, -1, 1)), "none");
        R.key("hbY", ts, mix("hbY", -3 * sph), "none"); R.key("hbR", ts, mix("hbR", -2.5 * sgA), "none");
      }
      ["fAx", "fBx", "fAy", "fBy", "fAr", "fBr", "hx", "tilt", "lean", "swA", "swB", "hbY", "hbR"].forEach((c) => R.key(c, t1 + 1e-4, 0, "none"));
      R.key("hy", t1 + 1e-4, B0.hy, "none"); R.key("x", t1 + 1e-4, xe, "none");
    };
    return R;
  }

  // pure kinematics: channel values -> joint transforms (also returns ankle positions so tests can check planting)
  function solveFull(v) {
    const { HIP, ANK, LT, LS } = FB, o = { v };
    const Le = LT * (1 - 0.5 * v.sit), tl = v.tilt * D2R, ct = Math.cos(tl), st = Math.sin(tl);
    o.hdx = v.hx; o.hdy = v.hy + PEL.drop * v.sit;
    ["A", "B"].forEach((s) => {
      const rx = HIP[s][0] - 300, hx = 300 + rx * ct + o.hdx, hy = 900 + rx * st + o.hdy;
      const tx = ANK[s][0] + v["f" + s + "x"] + (s === "A" ? -1 : 1) * PEL.spread * v.sit, ty = ANK[s][1] + v["f" + s + "y"] + PEL.fwd * v.sit;
      const dx = tx - hx, dy = ty - hy, d = Math.hypot(dx, dy), dc = clamp(d, Math.abs(Le - LS) + 0.5, (Le + LS) * 0.9995);
      const phi = Math.atan2(dy, dx), a = Math.acos(clamp((Le * Le + dc * dc - LS * LS) / (2 * Le * dc), -1, 1));
      const k1 = [hx + Le * Math.cos(phi + a), hy + Le * Math.sin(phi + a)], k2 = [hx + Le * Math.cos(phi - a), hy + Le * Math.sin(phi - a)];
      const knee = s === "A" ? (k1[0] < k2[0] ? k1 : k2) : (k1[0] > k2[0] ? k1 : k2);
      const ank = [hx + dc * Math.cos(phi), hy + dc * Math.sin(phi)];
      const thr = dirToRot(knee[0] - hx, knee[1] - hy), shAbs = dirToRot(ank[0] - knee[0], ank[1] - knee[1]);
      o[s] = { hx, hy, thr: norm(thr), shr: norm(shAbs - thr), fr: norm(-shAbs + v["f" + s + "r"]), Le, ank, target: [tx, ty], reach: dc - d };
    });
    return o;
  }

  // ---------- instance ----------
  function mount(container, opts = {}) {
    const el = typeof container === "string" ? document.querySelector(container) : container;
    const p = opts.id || "pz";
    const C = Object.assign({}, THEME, opts.theme || {});
    el.insertAdjacentHTML("beforeend", build(p, C, opts));
    const svg = el.lastElementChild;
    const full = opts.mode === "full";
    const W = full && opts.height ? (opts.height * 600) / 1175 : opts.width || 560;
    svg.style.width = W + "px";
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
      mouths: {}, state: { pose: "idle" }, full, k: W / 600,
      sw: { A: $("swA"), B: $("swB") }, feat: $("feat"), hb: $("hb"), hd: $("hd"),
    };
    HANDS.forEach((h) => { P.hands.A[h] = $("hA-" + h); P.hands.B[h] = $("hB-" + h); });
    MOUTH_KEYS.forEach((k) => (P.mouths[k] = $("m-" + k)));
    // static pivots (set once; tweens only touch rotation/x/y/scale)
    gsap.set([P.rig, P.torso], { svgOrigin: full ? "300 856" : "300 700" });
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
    if (full) initFull(P, $);
    P.pose = (tl, t, name, o) => pose(P, tl, t, name, o);
    P.talk = (tl, words, o) => talk(P, tl, words, o);
    P.blinks = (tl, end, o) => blinks(P, tl, end, o);
    P.look = (tl, t, dir, o) => look(P, tl, t, dir, o);
    P.face = (tl, t, f, o) => face(P, tl, t, f, o);
    P.mouth = (tl, t, v) => mouth(P, tl, t, v);
    P.breathe = (tl, from, to, o) => breathe(P, tl, from, to, o);
    P.enter = (tl, t, o) => enter(P, tl, t, o);
    ["walk", "moveTo", "place", "idle", "turn", "shift", "step", "jump", "hop", "tap", "sit", "stand", "lean", "present", "pointScreen"].forEach((m) => (P[m] = (tl, ...a) => FULL_API[m](P, tl, ...a)));
    Puppet.current = P;
    return P;
  }

  function initFull(P, $) {
    const R = (P.R = newRig()); R.k = P.k;
    P.el = { mrig: $("mrig"), hips: $("hips"), pelvis: $("pelvis"), tw: $("tw"), gsh: $("gsh"), legs: {}, shins: {}, feet: {}, toes: {}, th: {} };
    ["A", "B"].forEach((s) => {
      P.el.legs[s] = $("leg" + s); P.el.shins[s] = $("shin" + s); P.el.feet[s] = $("foot" + s); P.el.toes[s] = $("toe" + s);
      P.el.th[s] = Array.from(P.svg.querySelectorAll("." + P.p + "-th" + s + ", ." + P.p + "-ths" + s));
    });
    P.apply = (t) => applyFull(P, t);
    P.drv = new Map();
    applyFull(P, 0);
  }
  const F2 = (n) => Math.round(n * 100) / 100;
  function applyFull(P, t) {
    const R = P.R, v = R.vals(t), o = solveFull(v), E = P.el, { FLOOR } = FB;
    const q = clamp(v.sq, -0.06, 0.06), sx = (Math.abs(v.flip) < 0.03 ? 0.03 * sgn(v.flip) : v.flip) * (1 + 0.5 * q), sy = 1 - q;
    E.mrig.setAttribute("transform", `translate(${F2(v.x)} ${F2(v.y)}) translate(300 ${FLOOR}) scale(${F2(sx * 1000) / 1000} ${F2(sy * 1000) / 1000}) translate(-300 -${FLOOR})`);
    E.hips.setAttribute("transform", `translate(${F2(o.hdx)} ${F2(o.hdy)})`);
    E.pelvis.setAttribute("transform", `rotate(${F2(v.tilt)} 300 900)`);
    E.tw.setAttribute("transform", `translate(${F2(v.twist * 7)} 0) translate(300 856) rotate(${F2(v.lean)}) scale(${F2(1 - 0.2 * Math.abs(v.twist))} 1) translate(-300 -856)`);
    P.feat.setAttribute("transform", `translate(${F2(v.twist * 20)} 0)`);
    P.hb.setAttribute("transform", `translate(0 ${F2(v.hbY)}) rotate(${F2(v.hbR)} 300 500)`);
    P.sw.A.setAttribute("transform", `rotate(${F2(v.swA)})`); P.sw.B.setAttribute("transform", `rotate(${F2(v.swB)})`);
    ["A", "B"].forEach((s) => {
      const L = o[s];
      E.legs[s].setAttribute("transform", `translate(${F2(L.hx)} ${F2(L.hy)}) rotate(${F2(L.thr)})`);
      E.shins[s].setAttribute("transform", `translate(0 ${F2(L.Le)}) rotate(${F2(L.shr)})`);
      E.feet[s].setAttribute("transform", `translate(0 ${FB.LS}) rotate(${F2(L.fr)})`);
      E.toes[s].setAttribute("transform", `scale(${v["toe" + s] > 0 ? 1 : -1} 1)`);
      E.th[s].forEach((r) => r.setAttribute("height", r.getAttribute("class").indexOf("ths") > -1 ? F2(L.Le + 140) : F2(L.Le + 2 * FB.RT)));
    });
    E.gsh.setAttribute("transform", `translate(${F2(v.x)} 0) translate(300 ${FLOOR}) scale(${F2(clamp(1 - Math.abs(v.y) / 700, 0.5, 1))} 1) translate(-300 -${FLOOR})`);
  }
  function drive(P, tl, tEnd) {
    let d = P.drv.get(tl);
    if (!d) {
      d = gsap.to({ p: 0 }, { p: 1, duration: Math.max(tEnd, 0.05), ease: "none", onUpdate: () => P.apply(d.time()) });
      tl.add(d, 0);
      P.drv.set(tl, d);
    } else if (d.duration() < tEnd) d.duration(tEnd);
  }
  function bodyPose(P, tl, t, name, o = {}) {
    const R = P.R, d = o.d || 0.45;
    if (name && typeof name === "object") R.go(t, t + d, name, "io");
    else switch (name) {
      case "stand": R.home(t, d); break;
      case "step_l": R.step(t, "l", { d: Math.max(d, 0.35) }); break;
      case "step_r": R.step(t, "r", { d: Math.max(d, 0.35) }); break;
      case "lean": R.leanWall(t, o.dir || "r", d + 0.1); break;
      case "sit": R.sit(t, d + 0.1); break;
      case "present_left": R.presenting(t, "l", d); break;
      case "present_right": R.presenting(t, "r", d); break;
      case "point_screen_l": R.pointScreen(t, "l", d); break;
      case "point_screen_r": R.pointScreen(t, "r", d); break;
      case "tap": R.tap(t, { hold: o.hold ?? 1, foot: o.foot }); break;
      case "jump": { const j = R.jump(t, { h: o.h ? o.h / P.k : undefined }); jumpArms(P, tl, j, o); break; }
      case "hop": { const j = R.hop(t, { n: o.n ?? 2, h: o.h ? o.h / P.k : undefined }); jumpArms(P, tl, j, Object.assign({ name: "hop" }, o)); break; }
    }
    drive(P, tl, R.end + 0.05);
  }
  function jumpArms(P, tl, j, o) {
    if (o.arms === false) return;
    const up = POSES[o.name === "hop" ? "hop" : "jump"];
    pose(P, tl, j.launch - 0.02, { A: up.A, B: up.B, head: up.head, brows: "raised", eyes: "wide", look: "up" }, { d: 0.16, mouth: false });
    pose(P, tl, j.land + 0.05, "idle", { d: 0.25, mouth: false });
  }
  // ---- full-body public API (x positions in px, offsets relative to where the puppet was mounted) ----
  const FULL_API = {
    place: (P, tl, t, x) => { P.R.key("x", t, x / P.k, "none"); drive(P, tl, t + 0.05); },
    walk: (P, tl, t0, t1, o = {}) => {
      P.R.walk(t0, t1, { from: o.from == null ? undefined : o.from / P.k, to: o.to / P.k, stride: o.stride, steps: o.steps });
      drive(P, tl, P.R.end + 0.05);
    },
    moveTo: (P, tl, t, x, o = {}) => {
      const x0 = P.R.val("x", t) * P.k, dist = Math.abs(x - x0);
      if (dist < 1) return;
      P.R.walk(t, t + (o.d || Math.max(0.5, dist / 430)), { to: x / P.k, stride: dist < 90 ? dist / P.k : 96 });
      drive(P, tl, P.R.end + 0.05);
    },
    idle: (P, tl, from, to, o = {}) => { P.R.idle.push({ a: from, b: to, amt: o.amt ?? 1 }); drive(P, tl, to); },
    turn: (P, tl, t, to, o = {}) => { P.R.turn(t, to || "toggle", o.d); drive(P, tl, P.R.end + 0.05); },
    shift: (P, tl, t, dir, o) => { P.R.shift(t, dir, o); drive(P, tl, P.R.end + 0.05); },
    step: (P, tl, t, side, o) => { P.R.step(t, side, o); drive(P, tl, P.R.end + 0.05); },
    jump: (P, tl, t, o = {}) => pose(P, tl, t, "jump", o),
    hop: (P, tl, t, o = {}) => pose(P, tl, t, "hop", o),
    tap: (P, tl, t, o = {}) => pose(P, tl, t, "tap", o),
    sit: (P, tl, t, o = {}) => pose(P, tl, t, "sit", o),
    stand: (P, tl, t, o = {}) => pose(P, tl, t, "stand", o),
    lean: (P, tl, t, o = {}) => pose(P, tl, t, "lean", o),
    present: (P, tl, t, side, o = {}) => pose(P, tl, t, side === "r" || side === "right" ? "present_right" : "present_left", o),
    pointScreen: (P, tl, t, side, o = {}) => pose(P, tl, t, side === "r" || side === "right" ? "point_screen_r" : "point_screen_l", o),
  };

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
    if (P.full) {
      if (def.rig || P.state.lastRig) { P.R.go(t, t + d, { y: def.rig || 0 }, "out"); drive(P, tl, P.R.end + 0.05); }
      P.state.lastRig = !!def.rig;
      tl.to(P.hd, { y: (def.shoulders || 0) * -0.45, duration: d, ease }, t); // shrug: shoulders up, head sinks
    } else tl.to(P.rig, { y: def.rig || 0, duration: d, ease }, t);
    if (def.body && P.full) bodyPose(P, tl, t, def.body, Object.assign({ name: typeof name === "string" ? name : "" }, o));
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
    mount, POSES, HANDS, LOOK, BROWS, ik, solveArm, current: null, newRig, solveFull, FB,
    walk: (tl, t0, t1, o) => FULL_API.walk(cur(o), tl, t0, t1, o || {}),
    moveTo: (tl, t, x, o) => FULL_API.moveTo(cur(o), tl, t, x, o || {}),
    place: (tl, t, x, o) => FULL_API.place(cur(o), tl, t, x),
    idle: (tl, a, b, o) => FULL_API.idle(cur(o), tl, a, b, o || {}),
    turn: (tl, t, to, o) => FULL_API.turn(cur(o), tl, t, to, o || {}),
    shift: (tl, t, dir, o) => FULL_API.shift(cur(o), tl, t, dir, o),
    step: (tl, t, side, o) => FULL_API.step(cur(o), tl, t, side, o),
    jump: (tl, t, o) => FULL_API.jump(cur(o), tl, t, o || {}),
    hop: (tl, t, o) => FULL_API.hop(cur(o), tl, t, o || {}),
    tap: (tl, t, o) => FULL_API.tap(cur(o), tl, t, o || {}),
    sit: (tl, t, o) => FULL_API.sit(cur(o), tl, t, o || {}),
    stand: (tl, t, o) => FULL_API.stand(cur(o), tl, t, o || {}),
    lean: (tl, t, o) => FULL_API.lean(cur(o), tl, t, o || {}),
    present: (tl, t, side, o) => FULL_API.present(cur(o), tl, t, side, o || {}),
    pointScreen: (tl, t, side, o) => FULL_API.pointScreen(cur(o), tl, t, side, o || {}),
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
