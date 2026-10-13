/* SK: sketch board kit (spike). Needs gsap, window.BOARD (board/paths.js), theme CSS vars.
 * Seek-safe: every reveal + the pencil are a PURE function of timeline time, driven by one proxy tween's onUpdate.
 *   const S = SK.mount(tl, cardInteriorEl, {dur})       builds <svg> with one masked <image> per baked layer
 *   S.draw(id, t, d) / S.hatch(id, t, d) / S.wash(id, t, d)   schedule a reveal (kind decides mask type)
 *   S.finish()                                           adds the driver tween (call once, after scheduling)
 *   S.end(id) -> end time of that reveal */
(function (root) {
  const NS = "http://www.w3.org/2000/svg";
  const el = (tag, at, par) => { const e = document.createElementNS(NS, tag); for (const k in at) e.setAttribute(k, at[k]); if (par) par.appendChild(e); return e; };
  const ease = (q) => (q <= 0 ? 0 : q >= 1 ? 1 : q < 0.5 ? 2 * q * q : 1 - Math.pow(-2 * q + 2, 2) / 2); // power1-ish inOut
  const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
  const SK = {};
  SK.mount = (tl, host, o) => {
    const B = root.BOARD, W = B.W, H = B.H;
    const svg = el("svg", { width: W, height: H, viewBox: `0 0 ${W} ${H}`, "data-board": "", style: "position:absolute;left:0;top:0;overflow:visible" }, host);
    const defs = el("defs", {}, svg);
    // soft radial for wash bloom
    const rg = el("radialGradient", { id: "sk-soft" }, defs);
    el("stop", { offset: "0.72", "stop-color": "#fff" }, rg); el("stop", { offset: "1", "stop-color": "#000" }, rg);
    const layers = [el("g", {}, svg), el("g", {}, svg), el("g", {}, svg)];
    const items = {}, sched = [];
    B.elements.forEach((E) => {
      if (!E.bbox || !E.bbox[2]) return;
      const m = el("mask", { id: "m-" + E.id, maskUnits: "userSpaceOnUse", x: -50, y: -50, width: W + 100, height: H + 100 }, defs);
      const it = { E, mask: m, parts: [] };
      const R = E.reveal;
      if (R.type === "stroke") {
        R.strokes.forEach((s) => { const p = el("path", { d: s.d, fill: "none", stroke: "#fff", "stroke-width": R.w, "stroke-linecap": "round", "stroke-linejoin": "round", "stroke-dasharray": `${s.len} ${s.len + 40}`, "stroke-dashoffset": s.len, visibility: "hidden" }, m); it.parts.push({ p, len: s.len }); });
        it.total = R.strokes.reduce((a, s) => a + s.len, 0);
      } else if (R.type === "wipe") {
        const [bx, by, bw, bh] = R.bbox, cx = bx + bw / 2, cy = by + bh / 2, D = Math.hypot(bw, bh) / 2 + 30;
        // ragged leading edge (deterministic): zig-zag front at x=0, body extends to -2D
        let d = `M${-2 * D} ${-D}L0 ${-D}`; for (let i = 0; i <= 24; i++) { const y = -D + (2 * D * i) / 24; d += `L${(i % 2 ? 9 : -7) + ((i * 37) % 11) - 5} ${y.toFixed(1)}`; } d += `L0 ${D}L${-2 * D} ${D}Z`;
        const g = el("g", { transform: `translate(${cx} ${cy}) rotate(${R.angle})` }, m);
        const p = el("path", { d, fill: "#fff", transform: `translate(${-D - 12} 0)` }, g);
        Object.assign(it, { wipe: p, D, cx, cy, ang: (R.angle * Math.PI) / 180 });
      } else if (R.type === "bloom") {
        const c = el("circle", { cx: R.cx, cy: R.cy, r: 0, fill: "url(#sk-soft)" }, m);
        Object.assign(it, { bloom: c, r: R.r });
      }
      const [x, y, w, h] = E.bbox;
      it.img = el("image", { href: "board/" + E.png, x, y, width: w, height: h, mask: `url(#m-${E.id})`, preserveAspectRatio: "none" }, layers[Math.min(2, E.layer)]);
      items[E.id] = it;
    });
    // pencil (theme colours only): body paper, ink outline, marker band, ink tip
    const pen = el("g", { opacity: 0 }, svg);
    pen.innerHTML = `<g transform="rotate(32)"><path d="M0 0 L12 -30 L-12 -30 Z" fill="var(--paper)" stroke="var(--ink)" stroke-width="4" stroke-linejoin="round"/><path d="M0 0 L4.5 -11 L-4.5 -11 Z" fill="var(--ink)"/><rect x="-12" y="-150" width="24" height="120" rx="3" fill="var(--marker)" stroke="var(--ink)" stroke-width="4"/><rect x="-12" y="-172" width="24" height="24" rx="5" fill="var(--pale)" stroke="var(--ink)" stroke-width="4"/></g>`;
    const S = { svg, items, pen };
    const add = (id, t, d, kind) => { if (!items[id]) { console.warn("SK: no layer", id); return S; } sched.push({ id, t, d, kind }); return S; };
    S.draw = (id, t, d) => add(id, t, d || 1, "stroke");
    S.hatch = (id, t, d) => add(id, t, d || 1.6, "wipe");
    S.wash = (id, t, d) => add(id, t, d || 1.2, "bloom");
    S.reveal = (id, t, d) => add(id, t, d, items[id] && items[id].E.reveal.type === "stroke" ? "stroke" : items[id] && items[id].E.reveal.type);
    S.end = (id) => { const s = sched.find((q) => q.id === id); return s ? s.t + s.d : 0; };
    let lastPen = null;
    S.render = (t) => {
      let penAt = null, penA = 0;
      for (const s of sched) {
        const it = items[s.id], q = clamp01((t - s.t) / s.d), e = ease(q);
        if (s.kind === "stroke") {
          let L = e * it.total;
          for (const pt of it.parts) {
            const l = Math.max(0, Math.min(pt.len, L)); L -= pt.len;
            pt.p.setAttribute("visibility", l > 0.01 ? "visible" : "hidden");
            pt.p.setAttribute("stroke-dashoffset", (pt.len - l).toFixed(2));
            if (q > 0 && q < 1 && l > 0 && l < pt.len) { const P = pt.p.getPointAtLength(l); penAt = [P.x, P.y]; }
          }
        } else if (s.kind === "wipe") {
          const x = -it.D - 12 + e * (2 * it.D + 24);
          it.wipe.setAttribute("transform", `translate(${x.toFixed(2)} 0)`);
          if (q > 0 && q < 1) { // pencil scrubs along the hatch front
            const along = Math.sin(q * Math.PI * 14) * it.D * 0.55;
            penAt = [it.cx + Math.cos(it.ang) * (x + 4) - Math.sin(it.ang) * along, it.cy + Math.sin(it.ang) * (x + 4) + Math.cos(it.ang) * along];
          }
        } else if (s.kind === "bloom") {
          it.bloom.setAttribute("r", (it.r * (q <= 0 ? 0 : 1 - Math.pow(1 - q, 3))).toFixed(2));
        }
      }
      // pencil: on while drawing; lingers 0.3 s after a stroke then fades (pure function of t)
      if (penAt) { penA = 1; }
      else {
        let best = null; for (const s of sched) if (s.kind !== "bloom" && t >= s.t + s.d && t < s.t + s.d + 0.35 && (!best || s.t > best.t)) best = s;
        if (best) { const it = items[best.id]; penA = 1 - (t - best.t - best.d) / 0.35;
          if (best.kind === "stroke") { const pt = it.parts[it.parts.length - 1]; const P = pt.p.getPointAtLength(pt.len); penAt = [P.x, P.y - 30 * (1 - penA)]; } else penAt = [it.cx + Math.cos(it.ang) * it.D, it.cy + Math.sin(it.ang) * it.D]; }
      }
      if (penAt) pen.setAttribute("transform", `translate(${penAt[0].toFixed(2)} ${penAt[1].toFixed(2)})`);
      pen.setAttribute("opacity", penAt ? penA.toFixed(3) : 0);
    };
    S.finish = () => {
      const px = { t: 0 };
      tl.to(px, { t: o.dur, duration: o.dur, ease: "none", onUpdate: () => S.render(px.t) }, 0);
      S.render(0);
    };
    return S;
  };
  root.SK = SK;
})(window);
