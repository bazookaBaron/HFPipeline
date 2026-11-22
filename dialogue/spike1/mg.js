// Field-notebook MG: map card (India -> West Bengal region -> Kolkata pin) + captions. HTML/SVG, pure function of time.
// STYLE-GUIDE section 6/6b: ink panel #121820 92%, 1.5px paper-line border, 10px radius, label tag, Fraunces / Plex, paper-line draw-on.
const INK = "#121820", PAPER = "#EFE6D4", MUTED = "#8E9AA6", ACC = "#F2A03D";
const C = Math.cos(23 * Math.PI / 180);
const pow3out = x => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3), p2io = x => { x = Math.min(1, Math.max(0, x)); return x < .5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2; }, clamp01 = x => Math.min(1, Math.max(0, x));
const prog = (t, a, b) => clamp01((t - a) / (b - a));

export async function initMG(root, geo, wb) {
  const css = document.createElement("style");
  css.textContent = `
  #card{position:absolute;box-sizing:border-box;background:rgba(18,24,32,.92);border:1.5px solid rgba(239,230,212,.82);border-radius:10px;overflow:hidden;opacity:0;will-change:transform}
  #card .grain{position:absolute;inset:0;opacity:.07;background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='220' height='220'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='2' seed='4'/><feColorMatrix values='0 0 0 0 .94  0 0 0 0 .9  0 0 0 0 .83  0 0 0 .9 0'/></filter><rect width='220' height='220' filter='url(%23n)'/></svg>")}
  #card .vig{position:absolute;inset:0;background:radial-gradient(ellipse at center,rgba(0,0,0,0) 55%,rgba(0,0,0,.26) 100%)}
  #card svg{position:absolute;inset:0;width:100%;height:100%}
  #card .tag{position:absolute;left:22px;top:18px;font:400 19px/1 'Geist',sans-serif;letter-spacing:.16em;text-transform:uppercase;color:${MUTED}}
  #pinwrap{position:absolute;left:0;top:0;width:100%;height:100%}
  #pin{position:absolute;width:0;height:0}
  #pin .dot{position:absolute;left:-9px;top:-9px;width:18px;height:18px;border-radius:50%;background:${ACC}}
  #pin .ring{position:absolute;left:-9px;top:-9px;width:18px;height:18px;border-radius:50%;border:1.5px solid ${PAPER};box-sizing:border-box}
  #lbl{position:absolute;white-space:nowrap;background:${INK};border:1.5px solid ${PAPER};border-radius:10px;padding:9px 16px 10px;font:500 36px/1 'Geist',sans-serif;color:${PAPER}}
  #lbl span{font:500 30px/1 'Geist Mono',monospace;color:${PAPER};margin-left:2px}
  #cap{position:absolute;left:0;width:100%;text-align:center;font:600 60px/1.12 'Geist',sans-serif;letter-spacing:-0.012em;color:#EFE6D4;text-shadow:0 2px 14px rgba(8,12,18,.9),0 0 3px rgba(8,12,18,.7);opacity:0;padding:0 70px;box-sizing:border-box}
  `;
  document.head.appendChild(css);
  const card = document.createElement("div"); card.id = "card";
  card.innerHTML = `<div class="grain"></div><svg id="map" xmlns="http://www.w3.org/2000/svg"></svg><div class="vig"></div><div class="tag">West Bengal</div><div id="pinwrap"><svg id="leader" style="position:absolute;inset:0;width:100%;height:100%"><line id="ld" stroke="${PAPER}" stroke-width="1.5"/></svg><div id="pin"><div class="ring"></div><div class="dot"></div></div><div id="lbl">Kolkata <span>· 1947</span></div></div>`;
  root.appendChild(card);
  const cap = document.createElement("div"); cap.id = "cap"; root.appendChild(cap);
  const svg = card.querySelector("#map"), NS = "http://www.w3.org/2000/svg";
  const ring2d = r => "M" + r.map(([x, y]) => `${(x * C).toFixed(3)},${(-y).toFixed(3)}`).join("L") + "Z";
  const paths = []; const mk = (d, stroke, sw, op, cls) => { const p = document.createElementNS(NS, "path"); p.setAttribute("d", d); p.setAttribute("pathLength", "1"); p.setAttribute("fill", "none"); p.setAttribute("stroke", stroke); p.setAttribute("stroke-linejoin", "round"); p.setAttribute("stroke-linecap", "round"); p.style.strokeDasharray = "1 1"; p.dataset.sw = sw; p.dataset.op = op; p.dataset.cls = cls; svg.appendChild(p); paths.push(p); return p; };
  // graticule (every 5 deg), muted
  let gd = ""; for (let lon = 60; lon <= 105; lon += 5) gd += `M${(lon * C).toFixed(2)},${-45}L${(lon * C).toFixed(2)},${5}`; for (let lat = 0; lat <= 45; lat += 5) gd += `M${(55 * C).toFixed(2)},${-lat}L${(110 * C).toFixed(2)},${-lat}`;
  mk(gd, MUTED, 0.8, 0.22, "grat");
  for (const f of geo.features) { const rings = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates; const d = rings.map(poly => poly.map(ring2d).join("")).join(""); const isIn = f.properties.name === "India"; mk(d, isIn ? PAPER : MUTED, isIn ? 2.2 : 1.3, isIn ? 1 : 0.62, isIn ? "india" : "nb"); }
  { const f = wb.features[0]; const rings = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates; const d = rings.map(poly => poly.map(ring2d).join("")).join("");
    const fill = document.createElementNS(NS, "path"); fill.setAttribute("d", d); fill.setAttribute("fill", ACC); fill.setAttribute("fill-opacity", "0"); fill.setAttribute("stroke", "none"); fill.id = "wbfill"; svg.appendChild(fill);
    mk(d, PAPER, 2.4, 1, "wb"); }
  const wbfill = svg.querySelector("#wbfill");
  const KOL = [88.36, 22.57];
  const pin = card.querySelector("#pin"), ring = pin.querySelector(".ring"), dot = pin.querySelector(".dot"), lbl = card.querySelector("#lbl"), ld = card.querySelector("#ld");
  // view states: [centre lon, centre lat, view height in lat degrees]
  const V0 = [83, 21.5, 35], V1 = [88.6, 24.2, 8.4];
  return {
    card, cap,
    // tm: seconds since the MG began; rect {x,y,w,h} in page px
    update(tm, rect) {
      const { x, y, w, h } = rect; card.style.left = x + "px"; card.style.top = y + "px"; card.style.width = w + "px"; card.style.height = h + "px";
      const enter = pow3out(prog(tm, 0, 0.7)); const slide = -(y + h + 20) * (1 - enter); card.style.transform = `translateY(${slide}px) scale(${1 + 0.012 * clamp01(tm / 4)})`; card.style.opacity = tm < 0 ? 0 : Math.min(1, enter * 1.6);
      const zp = p2io(prog(tm, 1.15, 2.2)); const vh = Math.exp(Math.log(V0[2]) * (1 - zp) + Math.log(V1[2]) * zp); const cx = V0[0] + (V1[0] - V0[0]) * zp, cy = V0[1] + (V1[1] - V0[1]) * zp;
      const iw = w - 3, ih = h - 3; const vw = vh * iw / ih; svg.setAttribute("viewBox", `${(cx * C - vw / 2).toFixed(3)} ${(-cy - vh / 2).toFixed(3)} ${vw.toFixed(3)} ${vh.toFixed(3)}`);
      const pxPerUnit = ih / vh; const drawWb = p2io(prog(tm, 1.5, 2.4)); wbfill.setAttribute("fill-opacity", (0.2 * p2io(prog(tm, 1.9, 2.6))).toFixed(3)); const drawNb = p2io(prog(tm, 0.25, 1.35)), drawIn = p2io(prog(tm, 0.35, 1.2)), drawGr = p2io(prog(tm, 0.1, 1.0));
      for (const p of paths) { const c = p.dataset.cls, pp = c === "india" ? drawIn : c === "nb" ? drawNb : c === "wb" ? drawWb : drawGr; p.style.strokeDashoffset = String(1 - pp); p.setAttribute("stroke-width", (+p.dataset.sw / pxPerUnit).toFixed(4)); p.setAttribute("stroke-opacity", p.dataset.op); p.style.display = pp <= 0 ? "none" : ""; }
      const sx = ((KOL[0] * C - (cx * C - vw / 2)) / vw) * iw, sy = ((-KOL[1] - (-cy - vh / 2)) / vh) * ih;
      const pp = pow3out(prog(tm, 2.15, 2.65)); pin.style.left = sx + "px"; pin.style.top = (sy - 14 * (1 - pp)) + "px"; pin.style.opacity = pp; dot.style.transform = `scale(${0.6 + 0.4 * pp})`;
      const rp = prog(tm, 2.2, 2.95); ring.style.transform = `scale(${1 + 2.2 * pow3out(rp)})`; ring.style.opacity = rp <= 0 ? 0 : 1 - rp;
      const lp = pow3out(prog(tm, 2.5, 3.1)); const lw = lbl.offsetWidth || 230, lh = lbl.offsetHeight || 56; let lx = sx + 70, ly = sy - 110; if (lx + lw > iw - 20) lx = sx - 70 - lw; if (ly < 70) ly = sy + 60;
      lbl.style.left = lx + "px"; lbl.style.top = (ly + 10 * (1 - lp)) + "px"; lbl.style.opacity = lp;
      const ex = lx + (lx > sx ? 0 : lw), ey = ly + lh / 2; ld.setAttribute("x1", sx); ld.setAttribute("y1", sy - 11); ld.setAttribute("x2", sx + (ex - sx) * lp); ld.setAttribute("y2", (sy - 11) + (ey - (sy - 11)) * lp); ld.setAttribute("opacity", lp > 0 ? 1 : 0);
    },
    hide() { card.style.opacity = 0; },
  };
}

// captions: phrases of 2-6 words from words.json at breaks, 120 ms fade in, 100 ms fade out, no karaoke
export function phrasesFrom(wj) {
  const out = []; let cur = [];
  wj.words.forEach((w, i) => { cur.push(w); if (/[.?!]$/.test(w.w) || wj.breaks.includes(i + 1) || cur.length >= 6) { out.push({ text: cur.map(x => x.w).join(" "), s: cur[0].s, e: cur[cur.length - 1].e + 0.12 }); cur = []; } });
  if (cur.length) out.push({ text: cur.map(x => x.w).join(" "), s: cur[0].s, e: cur[cur.length - 1].e + 0.12 });
  return out;
}
export function setCaption(cap, phrases, t, yPx, sizePx) {
  const p = phrases.find(q => t >= q.s - 0.0 && t <= q.e); cap.style.top = yPx + "px"; cap.style.fontSize = sizePx + "px"; cap.style.transform = "translateY(-50%)";
  if (!p) { cap.style.opacity = 0; return; } cap.textContent = p.text; cap.style.opacity = Math.min(1, (t - p.s) / 0.12, (p.e - t) / 0.10);
}
