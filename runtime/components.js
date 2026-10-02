/* Poster component library (seek-safe GSAP). Needs gsap, theme vars on :root, runtime/verbs.js (window.V), components.css.
 * Catalogue: runtime/COMPONENTS.md.  API:
 *   const el = C.mount(kind, id, props, {x,y,w,h, layout:'9x16'|'16x9', host})   // hidden until landed; el.parts = named sub-parts
 *   C.land(el|id, tl, t, how?, opts?)   C.leave(el|id, tl, t, opts?)
 *   el.p.<perform>(tl, t, ...)  or  C.<alias>.<perform>(tl, t, ...)  (alias targets the LAST mounted of that kind; pass {on:id} as last arg to pick another)
 * Every perform returns the time it ends (chainable). All DOM is created at authoring time; every tween sits on the paused timeline. */
(function () {
  const V = window.V, C = (window.C = { reg: {}, cur: {} });
  const Z = (C.Z = { "9x16": { x: 70, y: 600, w: 940, h: 650, u: 1 }, "16x9": { x: 160, y: 140, w: 1600, h: 800, u: 1.35 } });
  const q = (s) => (typeof s === "string" ? document.querySelector(s) : s);
  const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const div = (cls, html, st) => { const d = document.createElement("div"); if (cls) d.className = cls; if (html != null) d.innerHTML = html; if (st) Object.assign(d.style, st); return d; };
  const rv = (n) => getComputedStyle(document.documentElement).getPropertyValue("--" + n).trim();
  const get = (x) => (typeof x === "string" ? C.reg[x] || document.getElementById(x) : x);
  const rich = (s) => esc(s).replace(/\*([^*]+)\*/g, '<span class="mkw"><i class="mk"></i>$1</span>'); // *word* = marker word
  C.rich = rich;
  C.sweep = (tl, t, root, gap = 0.16) => { const m = Array.from(get(root).querySelectorAll(".mk")); m.forEach((k, i) => { tl.fromTo(k, { scaleX: 0 }, { scaleX: 1, duration: 0.2, ease: "power3.out", immediateRender: false }, t + i * gap); V.cue(t + i * gap, "tick"); }); return t + m.length * gap + 0.2; };
  const pop = (tl, el, t, o = {}) => tl.fromTo(el, { scale: o.s0 ?? 0.4, autoAlpha: 0, y: o.y0 ?? 0 }, { scale: 1, autoAlpha: 1, y: 0, duration: o.d || 0.2, ease: "back.out(2.2)", immediateRender: false }, t);
  const show = (tl, el, t) => tl.set(el, { autoAlpha: 1 }, t);
  function typeInto(tl, t, node, text, d) {
    const a = node.querySelector(".ty"), g = node.querySelector(".gh"), st = { n: 0 };
    a.textContent = ""; if (g) g.textContent = text;
    tl.to(st, { n: text.length, duration: d, ease: "none", onUpdate() { const k = Math.round(st.n); a.textContent = text.slice(0, k); if (g) g.textContent = text.slice(k); } }, t);
    for (let k = 0; k < Math.min(6, Math.ceil(d / 0.08)); k++) V.cue(t + k * 0.08, "key");
    return t + d;
  }

  // ---- icons (24x24 stroke paths) ----
  const IC = {
    book: '<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 19V5M9 7h6"/>',
    code: '<path d="M8 7l-5 5 5 5M16 7l5 5-5 5M14 4l-4 16"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3.5 3.5 3.5 14.500 0 18M12 3c-3.500 3.500-3.500 14.500 0 18"/>',
    gpu: '<rect x="5" y="5" width="14" height="14" rx="2"/><rect x="9" y="9" width="6" height="6"/><path d="M9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3"/>',
    database: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 1.700 3.600 3 8 3s8-1.300 8-3V5M4 12c0 1.700 3.600 3 8 3s8-1.300 8-3"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.400 3.600-7 8-7s8 2.600 8 7"/>',
    dollar: '<path d="M12 2v20M17 6.500C16 5 14 4.500 12 4.500c-2.800 0-5 1.300-5 3.500s2 3 5 3.700 5 1.400 5 3.800-2.200 3.500-5 3.500c-2.200 0-4.200-.7-5.300-2.300"/>',
    lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M16 16l5 5"/>',
    check: '<path d="M4 13l5 5L20 6"/>',
    cross: '<path d="M5 5l14 14M19 5L5 19"/>',
    star: '<path d="M12 2l3 7 7 .6-5.400 4.600 1.800 7.300L12 17.800 5.600 21.500l1.800-7.300L2 9.600 9 9z"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/>',
    rocket: '<path d="M12 2c4 2 6 6 6 11l-3 3H9l-3-3c0-5 2-9 6-11z"/><circle cx="12" cy="10" r="2"/><path d="M9 16l-3 4M15 16l3 4M10 20h4"/>',
    chart: '<path d="M3 3v18h18"/><path d="M7 15l4-5 3 3 5-7"/>',
    play: '<path d="M7 4l13 8-13 8z"/>',
    bolt: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
  };
  const icon = (n, extra = "") => `<svg viewBox="0 0 24 24" ${extra}>${IC[n] || IC.star}</svg>`;
  C.icon = icon; C.ICONS = Object.keys(IC);

  // ================= components =================
  const K = {};

  K.chat = (e, P, b, u) => {
    e.classList.add("card", "chat");
    e.innerHTML = `<div class="bar"><i></i><i></i><i></i><b>${esc(P.title || "Chat")}</b></div><div class="body"></div>`;
    const body = e.querySelector(".body"), bubs = [];
    const mk = (who, text, dots) => { const d = div("bub " + who, (dots ? '<span class="dots"><i></i><i></i><i></i></span>' : "") + '<span class="ty"></span>'); d.querySelector(".ty").textContent = dots ? "" : text; body.appendChild(d); bubs.push(d); return d; };
    return {
      parts: { body, bubbles: bubs },
      ask(tl, t, text, o = {}) { const d = mk("u", text); tl.fromTo(d, { x: 60, scale: 0.7, autoAlpha: 0 }, { x: 0, scale: 1, autoAlpha: 1, duration: 0.2, ease: "back.out(2)", immediateRender: false }, t); V.cue(t, "pop"); if (!o.type) return t + 0.2; d.querySelector(".ty").textContent = ""; return typeInto(tl, t + 0.15, d, text, o.d || text.length / 40); },
      reply(tl, t, text, o = {}) { // typing dots, then the answer types in
        const d = mk("m", text, true), dots = d.querySelector(".dots"), th = o.think ?? 0.55, ty = d.querySelector(".ty");
        d.style.transformOrigin = "0% 100%"; pop(tl, d, t, { y0: 16, s0: 0.6 }); V.cue(t, "pop");
        tl.to(dots.children, { y: -calc(8, u), duration: 0.15, yoyo: true, repeat: Math.max(1, Math.round(th / 0.3)) * 2 - 1, stagger: 0.1, ease: "sine.inOut" }, t + 0.1);
        tl.set(dots, { display: "none" }, t + th);
        return typeInto(tl, t + th, d, text, o.d || Math.max(0.4, text.length / 55));
      },
    };
  };
  const calc = (n, u) => n * u;

  K.browser = (e, P, b, u) => {
    e.classList.add("card");
    const bh = 64 * u, vw = b.w - 12, vh = b.h - 12 - bh, H = vw * (P.aspect || 0.66);
    e.innerHTML = `<div class="bar"><i></i><i></i><i></i><div class="url">${esc(P.url || "example.com")}</div></div><div class="view"><div class="zw" style="width:${vw}px;height:${H}px"></div></div>`;
    const zw = e.querySelector(".zw");
    if (P.src) zw.innerHTML = `<img src="${P.src}">`; else zw.innerHTML = '<div class="fake">' + Array.from({ length: 14 }, (_, i) => `<u style="width:${[90, 60, 100, 75, 40, 95, 55, 80, 100, 65, 85, 50, 70, 90][i]}%"></u>`).join("") + "</div>";
    const move = (tl, t, s, x, y, o) => { tl.to(zw, { scale: s, x, y, duration: o.d || 0.7, ease: o.ease || "power3.inOut" }, t); V.cue(t, "swish"); return t + (o.d || 0.7); };
    const api = {
      parts: { view: e.querySelector(".view"), page: zw, img: zw.querySelector("img"), bar: e.querySelector(".bar") },
      scrollTo(tl, t, fy, o = {}) { return move(tl, t, 1, 0, -Math.min(Math.max(fy, 0), 1) * Math.max(0, H - vh), o); }, // fy 0..1 of the page
      zoomTo(tl, t, bx, o = {}) { // bx = {x,y,w,h} fractions of the page
        const s = Math.min(vw / (bx.w * vw), vh / (bx.h * H), o.max || 3) * (o.pad ?? 0.92), cx = (bx.x + bx.w / 2) * vw * s, cy = (bx.y + bx.h / 2) * H * s;
        return move(tl, t, s, vw / 2 - cx, vh / 2 - cy, o);
      },
      reset(tl, t, o = {}) { return move(tl, t, 1, 0, 0, o); },
      mark(tl, t, bx, o = {}) { // marker sweep over a box (fractions of the page); follows zoom/scroll
        const m = div("bmark", "", { left: bx.x * 100 + "%", top: bx.y * 100 + "%", width: bx.w * 100 + "%", height: bx.h * 100 + "%" }); zw.appendChild(m);
        tl.set(m, { autoAlpha: 1 }, t); tl.fromTo(m, { scaleX: 0 }, { scaleX: 1, duration: o.d || 0.25, ease: "power3.out", immediateRender: false }, t); V.cue(t, "tick"); return t + (o.d || 0.25);
      },
    };
    return api;
  };

  const lineKit = (e, P, u, cls, term) => {
    e.classList.add(term ? "term" : "card", cls);
    e.innerHTML = `<div class="bar"><i></i><i></i><i></i><b>${esc(P.title || (term ? "zsh" : "main.py"))}</b></div><div class="body"></div>`;
    const body = e.querySelector(".body");
    const add = (html, hidden) => { const l = div("ln" + (hidden ? " h" : ""), `<span class="hlb"></span><span class="t">${html}</span>`); body.appendChild(l); return l; };
    return { body, add };
  };
  K.code = (e, P, b, u) => {
    const { body, add } = lineKit(e, P, u, "code"), lines = (P.lines || []).map((s) => { const l = add('<span class="ty"></span><span class="gh"></span>'); const t = l.querySelector(".t"); if (/^\s*(\/\/|#)/.test(s)) t.classList.add("cm"); l.querySelector(".gh").textContent = s; return { el: l, s }; });
    return {
      parts: { lines: lines.map((l) => l.el), body },
      type(tl, t, o = {}) { // types lines o.from..o.to sequentially
        let at = t; for (let i = o.from || 0; i < (o.to ?? lines.length); i++) { const l = lines[i], d = Math.max(0.1, l.s.length / (o.cps || 46)); at = typeInto(tl, at, l.el, l.s, d) + 0.05; } return at;
      },
      hl(tl, t, i, o = {}) { const k = lines[i].el.querySelector(".hlb"); tl.set(k, { autoAlpha: 1 }, t); tl.fromTo(k, { scaleX: 0 }, { scaleX: 1, duration: o.d || 0.2, ease: "power3.out", immediateRender: false }, t); if (o.off) tl.to(k, { autoAlpha: 0, duration: 0.1 }, o.off); V.cue(t, "tick"); return t + 0.2; },
    };
  };
  K.term = (e, P, b, u) => {
    const { body, add } = lineKit(e, P, u, "term", true), ls = [];
    return {
      parts: { body, lines: ls },
      run(tl, t, cmd, out = [], o = {}) { // types a command, then prints output lines
        const l = add('<span class="pr">$ </span><span class="ty"></span><span class="gh"></span>', true); ls.push(l); tl.set(l, { autoAlpha: 1 }, t);
        let at = typeInto(tl, t, l, cmd, Math.max(0.2, cmd.length / (o.cps || 38))) + (o.wait ?? 0.18);
        out.forEach((s, i) => { const r = add(/^(ok|✓|done)/i.test(s) ? `<span class="ok">${esc(s)}</span>` : esc(s), true); ls.push(r); tl.set(r, { autoAlpha: 1 }, at + i * 0.14); V.cue(at + i * 0.14, "tick"); });
        return at + out.length * 0.14;
      },
    };
  };

  K.receipt = (e, P, b, u) => {
    e.classList.add("card", "receipt"); const cur = P.cur ?? "$", dec = P.dec ?? 2;
    e.innerHTML = `<div class="rc-h">${esc(P.title || "RECEIPT")}</div><div class="rows"></div><div class="rc-t"><span>${esc(P.totalLabel || "TOTAL")}</span><span class="tv">${cur}0</span></div>`;
    const rows = e.querySelector(".rows"), tot = e.querySelector(".rc-t"), rs = [];
    const row = (k, v) => { const r = div("rc-r", `<span>${esc(k)}</span><span>${esc(v)}</span>`); rows.appendChild(r); rs.push(r); return r; };
    (P.rows || []).forEach(([k, v]) => row(k, v));
    const fmt = (v) => cur + (dec ? v.toFixed(dec) : Math.round(v).toLocaleString("en-US"));
    e.querySelector(".tv").textContent = fmt(P.from ?? 0);
    return {
      parts: { rows: rs, total: tot },
      land(tl, t) { rs.forEach((r, i) => tl.fromTo(r, { autoAlpha: 0, y: -18 }, { autoAlpha: 1, y: 0, duration: 0.14, ease: "power2.out", immediateRender: false }, t + i * 0.12)); rs.forEach((r, i) => V.cue(t + i * 0.12, "tick")); },
      add(tl, t, k, v) { const r = row(k, v); tl.fromTo(r, { autoAlpha: 0, y: -18 }, { autoAlpha: 1, y: 0, duration: 0.14, immediateRender: false }, t); V.cue(t, "tick"); return t + 0.14; },
      total(tl, t, from, to, o = {}) { tl.set(tot, { autoAlpha: 1 }, t); pop(tl, tot, t, { s0: 0.8, d: 0.14 }); V.odo(e.querySelector(".tv"), t + 0.05, from, to, { fmt, d: o.d || 0.6 }); return t + 0.7; },
    };
  };

  K.rail = (e, P, b, u) => {
    const S = P.steps || ["One", "Two", "Three"], n = S.length, nd = 76 * u, hz = (P.dir || (b.w >= b.h ? "h" : "v")) === "h";
    const pos = (i) => (hz ? { x: nd / 2 + i * ((b.w - nd) / Math.max(1, n - 1)), y: nd / 2 + 4 } : { x: nd / 2 + 4, y: nd / 2 + i * ((b.h - nd) / Math.max(1, n - 1)) });
    const p0 = pos(0), p1 = pos(n - 1), th = 12, trk = div("trk"), fil = div("fil"), trv = div("trv"), nodes = [], labels = [];
    const ts = hz ? { left: p0.x + "px", top: p0.y - th / 2 + "px", width: p1.x - p0.x + "px", height: th + "px", transformOrigin: "left" } : { left: p0.x - th / 2 + "px", top: p0.y + "px", height: p1.y - p0.y + "px", width: th + "px", transformOrigin: "top" }; Object.assign(trk.style, ts); Object.assign(fil.style, ts); fil.style.transform = hz ? "scaleX(0)" : "scaleY(0)"; e.append(trk, fil);
    S.forEach((s, i) => { const p = pos(i), d = div("nd", `<u></u><b>${i + 1}</b>`, { left: p.x - nd / 2 + "px", top: p.y - nd / 2 + "px" }), l = div("nl", esc(s));
      e.append(d); e.append(l); l.style.cssText += hz ? `left:${p.x}px;top:${p.y + nd / 2 + 14}px;transform:translateX(-50%)` : `left:${p.x + nd / 2 + 22}px;top:${p.y}px;transform:translateY(-50%)`; nodes.push(d); labels.push(l); });
    e.append(trv); const tv = 34 * u; Object.assign(trv.style, { left: p0.x - tv / 2 + "px", top: p0.y - tv / 2 + "px" });
    let at = 0;
    return {
      parts: { nodes, labels, track: trk, fill: fil, dot: trv },
      land(tl, t) { show(tl, trk, t); tl.fromTo(trk, hz ? { scaleX: 0 } : { scaleY: 0 }, { [hz ? "scaleX" : "scaleY"]: 1, duration: 0.3, immediateRender: false }, t); nodes.forEach((d, i) => pop(tl, d, t + 0.05 + i * 0.08)); labels.forEach((l, i) => tl.fromTo(l, { autoAlpha: 0, y: 10 }, { autoAlpha: 1, y: 0, duration: 0.15, immediateRender: false }, t + 0.1 + i * 0.08)); show(tl, fil, t); show(tl, trv, t + 0.1); },
      activate(tl, t, i, o = {}) { // travelling dot hops to step i; its node fills with the marker
        const p = pos(i), d = o.d || 0.4, k = hz ? "x" : "y", from = at; at = i;
        tl.to(trv, { x: p.x - p0.x, y: p.y - p0.y, duration: d, ease: "power3.inOut" }, t);
        tl.to(fil, { [hz ? "scaleX" : "scaleY"]: i / Math.max(1, n - 1), duration: d, ease: "power3.inOut" }, t);
        tl.fromTo(nodes[i].firstChild, { scale: 0 }, { scale: 1, duration: 0.18, ease: "back.out(2)", immediateRender: false }, t + d - 0.05);
        tl.fromTo(nodes[i], { scale: 1 }, { scale: 1.16, duration: 0.1, yoyo: true, repeat: 1 }, t + d - 0.05); V.cue(t + d - 0.05, "tick"); return t + d + 0.15;
      },
    };
  };

  K.stat = (e, P, b, u) => {
    e.classList.add("card", "stat");
    const dec = P.dec || 0, fmt = (v) => (P.prefix || "") + (dec ? v.toFixed(dec) : Math.round(v).toLocaleString("en-US")) + (P.suffix || "");
    e.innerHTML = `<div class="lb">${esc(P.label || "")}</div><div class="nm a">${fmt(P.from ?? 0)}</div>${P.sub ? `<div class="sb">${esc(P.sub)}</div>` : ""}`;
    const nm = e.querySelector(".nm");
    if (P.autofit !== false) nm.style.fontSize = Math.min(190 * u, (b.w - 60) / Math.max(3, fmt(P.to ?? 0).length) / 0.5) + "px";
    return {
      parts: { label: e.querySelector(".lb"), num: nm },
      count(tl, t, to, o = {}) { V.odo(nm, t, o.from ?? P.from ?? 0, to ?? P.to ?? 0, { fmt, d: o.d || 0.7 }); V.pulse(nm, t + (o.d || 0.7), { s: 1.06 }); return t + (o.d || 0.7) + 0.2; },
    };
  };

  K.sticker = (e, P, b, u) => {
    e.classList.add("sticker"); e.innerHTML = (P.icon ? `<span style="width:${54 * u}px;height:${54 * u}px;display:inline-block">${icon(P.icon, 'style="fill:none;stroke:currentColor;stroke-width:2.6;stroke-linecap:round;stroke-linejoin:round"')}</span>` : "") + `<span>${esc(P.text || "NEW")}</span>`;
    if (P.fill) e.style.background = `var(--${P.fill})`;
    return { how: "slam", landOpts: { rot: P.rot ?? -5 }, parts: {}, wiggle(tl, t) { tl.to(e, { keyframes: [{ rotation: (P.rot ?? -5) + 5 }, { rotation: (P.rot ?? -5) - 4 }, { rotation: P.rot ?? -5 }], duration: 0.3, ease: "sine.inOut" }, t); return t + 0.3; } };
  };
  K.stamp = (e, P, b, u) => {
    e.classList.add("stamp"); e.textContent = P.text || "DEBUNKED";
    return { how: "slam", landOpts: { rot: P.rot ?? -9, s: 2.2 }, parts: {}, land(tl, t) { V.shake("#cam", t + 0.18, { a: 10 }); V.ring("#fx", t + 0.2, b.x + b.w / 2 - 40, b.y + b.h / 2 - 40, { s: 4 }); } };
  };

  const DD = { // doodle paths; viewBox given per type
    squiggle: { vb: "0 0 200 60", d: ["M5 30 Q 30 -5 55 30 T 105 30 T 155 30 T 195 30"] },
    arrow: { vb: "0 0 200 100", d: ["M10 85 C 60 95 130 70 172 28", "M172 28 L148 34 M172 28 L176 54"] },
    underline: { vb: "0 0 200 40", d: ["M5 24 C 60 10 140 32 195 14", "M25 36 C 80 26 140 38 182 28"] },
    speed: { vb: "0 0 200 100", d: ["M10 18 H130", "M50 50 H196", "M0 82 H110"] },
    circle: { vb: "0 0 200 120", d: ["M104 8 C 165 6 196 34 190 62 C 184 98 130 114 88 110 C 36 106 6 82 12 50 C 18 22 58 8 112 12 C 136 14 152 22 164 32"] },
    sparkle: { vb: "0 0 100 100", d: ["M50 4 C 54 34 66 46 96 50 C 66 54 54 66 50 96 C 46 66 34 54 4 50 C 34 46 46 34 50 4 Z"], fill: true },
  };
  K.doodle = (e, P, b, u) => {
    const D = DD[P.type || "squiggle"], col = `var(--${P.color || "ink"})`, sw = P.stroke || (D.fill ? 6 : 10);
    e.classList.add("doodle");
    e.innerHTML = `<svg viewBox="${D.vb}" preserveAspectRatio="xMidYMid meet"><g transform="${P.flip ? "translate(200,0) scale(-1,1)" : ""}">${D.d.map((d) => `<path d="${d}" stroke="${D.fill ? "var(--ink)" : col}" stroke-width="${sw}" ${D.fill ? 'style="fill:var(--marker)"' : ""}/>`).join("")}</g></svg>`;
    const paths = Array.from(e.querySelectorAll("path"));
    return {
      how: D.fill ? "pop" : "draw", parts: { paths },
      draw(tl, t, o = {}) { show(tl, e, t); V.draw(paths, t, { d: o.d || 0.35, stagger: 0.1 }); return t + (o.d || 0.35); },
      twinkle(tl, t) { tl.fromTo(e, { scale: 1, rotation: 0 }, { scale: 1.3, rotation: 20, duration: 0.14, yoyo: true, repeat: 3, ease: "sine.inOut" }, t); return t + 0.6; },
    };
  };

  K.stack = (e, P, b, u) => {
    const it = P.items || [], n = it.length, cw = Math.min(b.w * 0.42, 440 * u), ch = Math.min(b.h * 0.86, 520 * u), fills = ["paper", "pale", "marker", "paper"], cards = [];
    let order = it.map((_, i) => i), mode = P.mode || "stack";
    it.forEach((c, i) => { const d = div("sc card", `<div class="itile ${c.fill || ""}" style="width:${86 * u}px;height:${86 * u}px;box-shadow:5px 5px 0 var(--shadow);border-radius:16px">${icon(c.icon || "star")}</div><div><h4>${esc(c.t || "")}</h4><p>${esc(c.s || "")}</p></div>`, { width: cw + "px", height: ch + "px", left: (b.w - cw) / 2 + "px", top: (b.h - ch) / 2 + "px", background: `var(--${c.bg || fills[i % 4]})`, transformOrigin: "50% 115%" }); d.setAttribute("data-layout-allow-overlap", ""); d.querySelectorAll("h4,p").forEach((x) => x.setAttribute("data-layout-allow-overlap", "")); e.appendChild(d); cards.push(d); });
    const pose = (k, md) => { const i = order.indexOf(k), s = i - (n - 1) / 2; return md === "fan" ? { x: s * (b.w * 0.5) / Math.max(1, n - 1), y: Math.abs(s) * 14 * u + 10, rotation: s * (40 / Math.max(1, n - 1)), scale: 1, zIndex: i } : { x: (i - (n - 1)) * 12 * u, y: (i - (n - 1)) * -12 * u, rotation: ((i * 7) % 5) - 2, scale: 1, zIndex: i }; };
    cards.forEach((c, k) => gsap.set(c, pose(k, mode)));
    const go = (tl, t, md, o = {}) => { mode = md; cards.forEach((c, k) => tl.to(c, { ...pose(k, md), duration: o.d || 0.45, ease: "back.out(1.5)" }, t + k * 0.04)); V.cue(t, "swish"); return t + (o.d || 0.45) + 0.1; };
    return {
      parts: { cards },
      land(tl, t) { cards.forEach((c, i) => tl.fromTo(c, { autoAlpha: 0, y: "+=60" }, { autoAlpha: 1, y: "-=60", duration: 0.2, ease: "back.out(2)", immediateRender: false }, t + i * 0.07)); },
      fan: (tl, t, o) => go(tl, t, "fan", o), gather: (tl, t, o) => go(tl, t, "stack", o),
      pick(tl, t, k, o = {}) { const c = cards[k], p = pose(k, mode); tl.set(c, { zIndex: 50 }, t); tl.to(c, { y: p.y - 70 * u, scale: 1.1, rotation: 0, duration: 0.25, ease: "back.out(2)" }, t); V.cue(t, "pop"); return t + 0.3; },
      shuffle(tl, t) { const top = order[n - 1], c = cards[top]; tl.to(c, { x: "+=" + cw * 0.75, rotation: 10, duration: 0.18, ease: "power2.out" }, t); tl.set(c, { zIndex: -1 }, t + 0.2); order = [top, ...order.slice(0, -1)]; cards.forEach((cc, k) => { const p = pose(k, mode); tl.to(cc, { ...p, zIndex: k === top ? -1 : p.zIndex, duration: 0.3, ease: "power3.out" }, t + 0.2); }); V.cue(t, "swish"); return t + 0.5; },
    };
  };

  K.ranking = (e, P, b, u) => {
    const it = P.items || [], n = it.length, gap = 14 * u, rh = Math.min(112 * u, (b.h - gap * (n - 1)) / n), rows = [], num = [], val = []; let slots = it.map((_, i) => i);
    it.forEach((c, i) => { const r = div("rk card", `<span class="n">${i + 1}</span><span class="l">${esc(c.l)}</span>${c.v != null ? `<span class="v">${esc(c.v)}</span>` : ""}`, { top: i * (rh + gap) + "px", height: rh + "px", boxShadow: "6px 6px 0 var(--shadow)", borderWidth: "5px" }); e.appendChild(r); rows.push(r); num.push(r.querySelector(".n")); val.push(r.querySelector(".v")); });
    return {
      parts: { rows },
      land(tl, t) { rows.forEach((r, i) => tl.fromTo(r, { x: 900, autoAlpha: 0, skewX: -14 }, { x: 0, autoAlpha: 1, skewX: 0, duration: 0.22, ease: "power4.out", immediateRender: false }, t + i * 0.08)); V.cue(t, "whip"); },
      rank(tl, t, order, o = {}) { // order = item indexes top->bottom; o.vals = new value labels by item index
        order.forEach((it_, slot) => { const from = slots.indexOf(it_); if (from !== slot) { tl.to(rows[it_], { y: slot * (rh + gap) - it_ * (rh + gap), duration: o.d || 0.5, ease: "back.out(1.4)" }, t); tl.to(rows[it_], { scale: 1.05, duration: 0.12, yoyo: true, repeat: 1 }, t); } tl.set(num[it_], { textContent: slot + 1 }, t + 0.25); if (o.vals && o.vals[it_] != null && val[it_]) tl.set(val[it_], { textContent: o.vals[it_] }, t + 0.25); });
        slots = order.slice(); V.cue(t, "swish"); return t + (o.d || 0.5) + 0.1;
      },
    };
  };

  K.checklist = (e, P, b, u) => {
    const it = P.items || [], n = it.length, rh = Math.min(100 * u, b.h / n), rows = [], boxes = [], path = [], st = [], txt = [];
    it.forEach((s, i) => { const r = div("ck", `<div class="bx"><svg viewBox="0 0 56 56"><path d="M12 29 L24 41 L45 14"/></svg></div><div class="tx">${esc(s)}<s></s></div>`, { top: i * rh + "px", height: rh + "px" }); e.appendChild(r); rows.push(r); boxes.push(r.querySelector(".bx")); path.push(r.querySelector("path")); st.push(r.querySelector("s")); txt.push(r.querySelector(".tx")); });
    return {
      parts: { rows, boxes },
      land(tl, t) { rows.forEach((r, i) => tl.fromTo(r, { x: -80, autoAlpha: 0 }, { x: 0, autoAlpha: 1, duration: 0.2, ease: "power3.out", immediateRender: false }, t + i * 0.09)); },
      tick(tl, t, i, o = {}) { // draw the check, fill the box, strike the text
        V.draw(path[i], t, { d: 0.18, sfx: "tick" }); tl.to(boxes[i], { backgroundColor: rv("marker"), duration: 0.1 }, t);
        tl.fromTo(boxes[i], { scale: 1 }, { scale: 1.2, duration: 0.09, yoyo: true, repeat: 1 }, t);
        if (o.strike !== false) { tl.fromTo(st[i], { scaleX: 0 }, { scaleX: 1, duration: 0.2, ease: "power3.out", immediateRender: false }, t + 0.1); tl.to(txt[i], { opacity: 0.5, duration: 0.15 }, t + 0.15); }
        return t + 0.3;
      },
    };
  };

  K.quote = (e, P, b, u) => {
    e.classList.add("card", "quote"); e.innerHTML = `<div class="qm" data-layout-allow-overlap>“</div><div class="qt">${rich(P.text || "")}</div>${P.by ? `<div class="qa">— ${esc(P.by)}</div>` : ""}`;
    return { parts: { text: e.querySelector(".qt") }, hl(tl, t, o = {}) { return C.sweep(tl, t, e, o.gap || 0.2); }, land(tl, t) { /* marks sweep right after landing if props.auto */ if (P.auto) C.sweep(tl, t + 0.1, e); } };
  };

  K.timeline = (e, P, b, u) => {
    const ev = P.events || [], n = ev.length, mid = b.h / 2, x0 = 40, x1 = b.w - 40, px = (i) => (n === 1 ? b.w / 2 : x0 + (i * (x1 - x0)) / (n - 1)), sp = n > 1 ? (x1 - x0) / (n - 1) : 300;
    const ax = div("ax trk", "", { left: x0 + "px", width: x1 - x0 + "px", top: mid - 6 + "px", height: "12px", transformOrigin: "left" }), fil = div("fil", "", { left: x0 + "px", width: x1 - x0 + "px", top: mid - 6 + "px", height: "12px", transformOrigin: "left", transform: "scaleX(0)" });
    e.append(ax, fil); const dots = [], yrs = [], cards = [];
    ev.forEach((c, i) => { const d = div("tp"); d.innerHTML = ""; const dt = div("tp dt", "", { left: px(i) + "px", top: mid + "px" }), yr = div("tp yr", esc(c.y), { left: px(i) + "px", top: mid - 36 * u - 44 * u + "px" }), cd = div("tp ev card", rich(c.t), { left: px(i) + "px", top: mid + 36 * u + "px", width: Math.min(220 * u, sp * 0.94) + "px", boxShadow: "6px 6px 0 var(--shadow)", borderWidth: "5px" });
      if (n > 4 && i % 2) { cd.style.top = mid + 36 * u + 112 * u + "px"; } e.append(dt, yr, cd); dots.push(dt); yrs.push(yr); cards.push(cd); });
    return {
      parts: { axis: ax, fill: fil, dots, years: yrs, cards },
      land(tl, t) { show(tl, ax, t); show(tl, fil, t); tl.fromTo(ax, { scaleX: 0 }, { scaleX: 1, duration: 0.35, ease: "power3.out", immediateRender: false }, t); dots.forEach((d, i) => { pop(tl, d, t + 0.1 + i * 0.07, { s0: 0 }); tl.fromTo(yrs[i], { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration: 0.15, immediateRender: false }, t + 0.15 + i * 0.07); }); },
      reach(tl, t, i, o = {}) { // progress to event i: fill grows, pin lights up, event card pops
        const d = o.d || 0.4; tl.to(fil, { scaleX: (px(i) - x0) / (x1 - x0), duration: d, ease: "power3.inOut" }, t);
        tl.to(dots[i], { backgroundColor: rv("marker"), scale: 1.35, duration: 0.15 }, t + d - 0.1); pop(tl, cards[i], t + d - 0.05, { y0: -14, s0: 0.7 }); V.cue(t + d - 0.05, "pop"); return t + d + 0.15;
      },
    };
  };

  K.compare = (e, P, b, u) => {
    e.classList.add("card"); const R = P.rows || [], n = R.length, hh = 84 * u, rh = (b.h - hh - 24) / n, cw = 120 * u, marks = [], rws = [];
    const hd = div("", `<span style="flex:1"></span><span class="a" style="width:${cw}px;text-align:center;font-size:${44 * u}px">${esc(P.a || "A")}</span><span class="a" style="width:${cw}px;text-align:center;font-size:${44 * u}px">${esc(P.b || "B")}</span>`, { position: "absolute", left: 24 * u + "px", right: 24 * u + "px", top: 18 * u + "px", height: hh - 18 * u + "px", display: "flex", alignItems: "center", borderBottom: "6px solid var(--ink)" });
    e.append(hd);
    R.forEach((r, i) => { const row = div("cr", `<span class="t">${esc(r.t)}</span>${[r.a, r.b].map((v) => `<span class="mkc ${v ? "y" : "n"}" style="margin:0 ${(cw - 58 * u) / 2}px">${icon(v ? "check" : "cross", 'style="fill:none;stroke:currentColor;stroke-width:3.4;stroke-linecap:round;stroke-linejoin:round"')}</span>`).join("")}`, { left: 24 * u + "px", right: 24 * u + "px", top: hh + 12 + i * rh + "px", height: rh + "px" }); e.append(row); rws.push(row); marks.push(Array.from(row.querySelectorAll(".mkc"))); row.querySelector(".t").style.visibility = "hidden"; });
    return {
      parts: { rows: rws, marks },
      land(tl, t) { rws.forEach((r, i) => tl.fromTo(r.querySelector(".t"), { autoAlpha: 0, x: -40 }, { autoAlpha: 1, x: 0, duration: 0.18, ease: "power3.out", immediateRender: false }, t + i * 0.08)); },
      row(tl, t, i) { marks[i].forEach((m, k) => { pop(tl, m, t + k * 0.14, { s0: 0 }); if (m.classList.contains("n")) tl.fromTo(m, { rotation: -20 }, { rotation: 0, duration: 0.2, ease: "back.out(3)", immediateRender: false }, t + k * 0.14); V.cue(t + k * 0.14, m.classList.contains("n") ? "thud" : "tick"); }); return t + 0.35; },
    };
  };

  const plotBox = (e, P, b, u) => { e.classList.add("card", "ch"); const l = 60 * u, r = 36 * u, tp = (P.title ? 86 : 40) * u, bt = 76 * u; if (P.title) e.appendChild(div("a", esc(P.title), { position: "absolute", left: 28 * u + "px", top: 16 * u + "px", fontSize: 44 * u + "px" })); return { l, r, tp, pw: b.w - 12 - l - r, ph: b.h - 12 - tp - bt, bt }; };
  const axes = (e, g) => { e.append(div("ax", "", { left: g.l + "px", top: g.tp + "px", width: "6px", height: g.ph + 6 + "px" }), div("ax", "", { left: g.l + "px", top: g.tp + g.ph + "px", width: g.pw + "px", height: "6px" })); };
  K.bars = (e, P, b, u) => {
    const D = P.data || [], n = D.length, g = plotBox(e, P, b, u), mx = P.max || Math.max(...D.map((d) => d.v)) * 1.25, sl = (g.pw - 20) / n, bw = sl * 0.62, layer = div("", "", { position: "absolute", left: g.l + 6 + "px", top: g.tp + "px", width: g.pw + "px", height: g.ph + "px" }), bars = [], vals = [], fmt = (v) => (P.prefix || "") + (P.dec ? v.toFixed(P.dec) : Math.round(v).toLocaleString("en-US")) + (P.suffix || "");
    axes(e, g); e.appendChild(layer);
    D.forEach((d, i) => { const h = (d.v / mx) * g.ph, x = 10 + sl * i + sl / 2, br = div("bar1" + (i === P.hi ? " hi" : ""), "", { left: x - bw / 2 + "px", width: bw + "px", height: h + "px" }), vl = div("bv", fmt(0), { left: x + "px", top: g.ph - h - 52 * u + "px" }), lb = div("bl", esc(d.l), { left: x + "px", top: g.ph + 14 + "px" }); layer.append(br, vl, lb); bars.push(br); vals.push(vl); });
    return {
      parts: { bars, values: vals },
      grow(tl, t, o = {}) { const gp = o.stagger ?? 0.12, dd = o.d || 0.5; bars.forEach((br, i) => { tl.set(br, { autoAlpha: 1 }, t + i * gp); tl.fromTo(br, { scaleY: 0 }, { scaleY: 1, duration: dd, ease: "back.out(1.3)", immediateRender: false }, t + i * gp); tl.set(vals[i], { autoAlpha: 1 }, t + i * gp + 0.1); V.odo(vals[i], t + i * gp + 0.1, 0, D[i].v, { fmt, d: dd, ticks: 2 }); }); V.cue(t, "whip"); return t + (n - 1) * gp + dd; },
      highlight(tl, t, i) { tl.to(bars[i], { backgroundColor: rv("marker"), duration: 0.1 }, t); tl.fromTo([bars[i], vals[i]], { scale: 1 }, { scale: 1.1, duration: 0.1, yoyo: true, repeat: 1 }, t); V.cue(t, "pop"); return t + 0.25; },
    };
  };
  K.line = (e, P, b, u) => {
    const D = P.data || [], n = D.length, g = plotBox(e, P, b, u), mx = P.max || Math.max(...D.map((d) => d.v)) * 1.25, mn = P.min ?? 0;
    const X = (i) => g.l + 6 + 30 * u + (i * (g.pw - 60 * u)) / Math.max(1, n - 1), Y = (v) => g.tp + g.ph - ((v - mn) / (mx - mn)) * g.ph;
    const d = D.map((p, i) => (i ? "L" : "M") + X(i).toFixed(1) + " " + Y(p.v).toFixed(1)).join(" ");
    axes(e, g); e.insertAdjacentHTML("beforeend", `<svg><path class="ar" d="${d} L${X(n - 1)} ${g.tp + g.ph} L${X(0)} ${g.tp + g.ph}Z"/><path class="ln1" d="${d}"/></svg>`);
    const ln = e.querySelector(".ln1"), ar = e.querySelector(".ar"), pts = [], vls = [];
    D.forEach((p, i) => { const pt = div("pt", "", { left: X(i) + "px", top: Y(p.v) + "px" }), lb = div("bl", esc(p.l), { left: X(i) + "px", top: g.tp + g.ph + 14 + "px" }), vl = div("bv", esc((P.prefix || "") + p.v + (P.suffix || "")), { left: X(i) + "px", top: Y(p.v) - 56 * u + "px" }); e.append(pt, lb, vl); pts.push(pt); vls.push(vl); });
    return {
      parts: { path: ln, area: ar, points: pts, values: vls },
      draw(tl, t, o = {}) { const dd = o.d || 1; V.draw(ln, t, { d: dd, sfx: "scribble" }); pts.forEach((pt, i) => pop(tl, pt, t + (dd * i) / Math.max(1, n - 1), { s0: 0, d: 0.15 })); tl.fromTo(ar, { autoAlpha: 0 }, { autoAlpha: 0.55, duration: 0.3, immediateRender: false }, t + dd); return t + dd + 0.3; },
      highlight(tl, t, i) { tl.to(pts[i], { backgroundColor: rv("marker"), scale: 1.5, duration: 0.15 }, t); pop(tl, vls[i], t, { y0: 10, s0: 0.6 }); V.cue(t, "pop"); return t + 0.3; },
    };
  };

  K.image = (e, P, b, u) => {
    e.classList.add("card", "imgf"); e.innerHTML = `<div class="ph">${P.src ? `<img src="${P.src}" style="${P.pos ? "object-position:" + P.pos : ""}">` : '<div class="placeholder"></div>'}${P.grain === false ? "" : '<div class="gr"></div>'}${P.credit ? `<div class="cr2">${esc(P.credit)}</div>` : ""}</div>${P.caption ? `<div class="cap2">${rich(P.caption)}</div>` : ""}`;
    const im = e.querySelector("img") || e.querySelector(".placeholder"); if (P.ken === "out") gsap.set(im, { scale: 1.16 });
    const push = (tl, t, o = {}) => { const d = o.d || 3, to = o.to ?? (P.ken === "out" ? 1 : 1.14); tl.to(im, { scale: to, x: o.x || 0, y: o.y || 0, duration: d, ease: "none" }, t); return t + d; };
    return { parts: { photo: im, caption: e.querySelector(".cap2") }, push, land(tl, t, o) { if (P.ken) push(tl, t, { d: P.kenD || 3 }); } };
  };

  K.wall = (e, P, b, u) => {
    const T = P.tiles || [], cols = P.cols || 4, rows = P.rows || Math.ceil(T.length / cols), tw = (P.tw || 220) * u, th = (P.th || 150) * u, gp = 22 * u, fills = ["pale", "marker", "paper", "deep"];
    e.classList.add("vw"); const pl = div("pl", "", { width: cols * (tw + gp) + "px", height: rows * (th + gp) + "px" }), inn = div("", "", { position: "absolute", inset: 0 }); pl.appendChild(inn); e.appendChild(pl);
    if (P.scale) pl.style.transform = `translate(-50%,-50%) rotateX(52deg) rotateZ(-28deg) scale(${P.scale})`;
    const tiles = T.map((c, i) => { const r = Math.floor(i / cols), k = i % cols, d = div("vt", c.src ? `<img src="${c.src}">` : `<div class="ic">${icon(c.icon || C.ICONS[i % C.ICONS.length], 'style="fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round"')}</div>`, { left: k * (tw + gp) + "px", top: r * (th + gp) + "px", width: tw + "px", height: th + "px", background: `var(--${c.bg || fills[(i + r) % 4]})`, color: (c.bg || fills[(i + r) % 4]) === "deep" ? "var(--paper)" : "var(--ink)" }); if (c.badge) d.insertAdjacentHTML("beforeend", `<span class="bd">${esc(c.badge)}</span>`); d._c = k; d._r = r; inn.appendChild(d); return d; });
    return {
      parts: { plane: pl, tiles },
      land(tl, t) { tiles.forEach((d) => { tl.fromTo(d, { scale: 0, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: 0.25, ease: "back.out(2)", immediateRender: false }, t + (d._r + d._c) * 0.06); }); V.cue(t, "whip"); },
      drift(tl, t, o = {}) { const dd = o.d || 2, A = (o.dist || 60) * u; tiles.forEach((d) => tl.to(d, { y: (d._c % 2 ? 1 : -1) * A * (1 + d._r * 0.25), duration: dd, ease: "none" }, t)); tl.to(inn, { x: -(o.dx ?? 40) * u, duration: dd, ease: "none" }, t); return t + dd; },
      flash(tl, t, i) { tl.to(tiles[i], { z: 70, scale: 1.12, duration: 0.15, yoyo: true, repeat: 1 }, t); V.cue(t, "pop"); return t + 0.3; },
    };
  };

  K.chips = (e, P, b, u) => {
    e.classList.add("chips"); const chips = (P.chips || []).map((s) => { const c = div("chip pill", `<u></u><span>${esc(s)}</span>`); e.appendChild(c); return c; });
    if (P.center) e.style.justifyContent = "center";
    return {
      parts: { chips },
      land(tl, t) { chips.forEach((c, i) => pop(tl, c, t + i * 0.07, { s0: 0.3, d: 0.18 })); V.cue(t, "pop"); },
      pick(tl, t, i) { const c = chips[i]; tl.fromTo(c.firstChild, { scaleX: 0 }, { scaleX: 1, duration: 0.18, ease: "power3.out", immediateRender: false }, t); tl.fromTo(c, { scale: 1 }, { scale: 1.12, duration: 0.1, yoyo: true, repeat: 1 }, t); V.cue(t, "tick"); return t + 0.25; },
    };
  };

  K.title = (e, P, b, u) => {
    e.classList.add("nbt"); e.innerHTML = `<div class="nm">${esc(P.n || "01")}</div><div class="tt">${esc(P.title || "")}</div>`; const nm = e.querySelector(".nm"), tt = e.querySelector(".tt");
    return { how: "none", parts: { num: nm, title: tt },
      land(tl, t) { V.slam(nm, t, { s: 1.6, rot: -3 }); tl.fromTo(tt, { y: 60, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.25, ease: "power4.out", immediateRender: false }, t + 0.1); },
      swap(tl, t, n, title) { V.scramble(nm, t, n, { d: 0.3 }); tl.set(tt, { textContent: title }, t + 0.15); pop(tl, tt, t + 0.15, { s0: 0.8, d: 0.15 }); return t + 0.4; } };
  };

  K.lower = (e, P, b, u) => {
    e.classList.add("l3"); e.innerHTML = `<div class="ac"></div><div class="tx"><b>${esc(P.name || "Name")}</b><span>${esc(P.role || "")}</span></div>`;
    return { how: "whip", landOpts: { from: "left" }, parts: { accent: e.querySelector(".ac") }, ping(tl, t) { tl.fromTo(e.querySelector(".ac"), { scaleX: 1 }, { scaleX: 1.8, transformOrigin: "left", duration: 0.12, yoyo: true, repeat: 1 }, t); return t + 0.3; } };
  };

  K.icon = (e, P, b, u) => {
    e.classList.add("itile"); if (P.fill) e.classList.add(P.fill); e.innerHTML = icon(P.icon || "star");
    return { how: "pop", parts: {}, flip(tl, t, name) { tl.to(e, { scaleX: 0, duration: 0.08 }, t); tl.set(e, { innerHTML: icon(name) }, t + 0.08); tl.to(e, { scaleX: 1, duration: 0.1, ease: "back.out(2)" }, t + 0.08); return t + 0.2; } };
  };

  // ---- sizing: [w,h] fractions of the content zone for 9x16, then 16x9 ----
  const DEF = { chat: [.88, .95, .5, .96], browser: [1, 1, .8, 1], code: [.92, .8, .6, .9], term: [.92, .7, .6, .8], receipt: [.6, .9, .32, .88], rail: [1, .34, 1, .3], stat: [.64, .58, .4, .6], stack: [.9, .95, .7, .95], ranking: [.95, .95, .6, .95], checklist: [.9, .95, .5, .9], quote: [.95, .8, .7, .7], timeline: [1, .6, 1, .55], compare: [1, .95, .7, .95], bars: [.95, 1, .7, 1], line: [.95, 1, .7, 1], image: [.85, .85, .5, .85], wall: [1, 1, 1, 1], chips: [1, .4, .8, .3], title: [1, .4, .9, .4] };
  const ALIAS = { chatWindow: "chat", browserFrame: "browser", codeCard: "code", terminal: "term", stepRail: "rail", statCounter: "stat", cardStack: "stack", fan: "stack", rankingList: "ranking", quoteCard: "quote", comparison: "compare", barChart: "bars", lineChart: "line", imageFrame: "image", videoWall: "wall", chipRow: "chips", numberedBigTitle: "title", lowerThird: "lower", iconTile: "icon" };

  C.mount = (kind, id, props = {}, box = {}) => {
    kind = ALIAS[kind] || kind; if (!K[kind]) throw new Error("C.mount: unknown kind " + kind);
    const lay = box.layout || "9x16", z = Z[lay], u = z.u, wide = lay === "16x9", f = DEF[kind];
    let w = box.w, h = box.h;
    if (w == null) w = kind === "sticker" ? Math.min(z.w, ((props.text || "NEW").length * 36 + 60 + (props.icon ? 70 : 0)) * u) : kind === "stamp" ? ((props.text || "DEBUNKED").length * 62 + 90) * u : kind === "doodle" ? ((props.type === "sparkle" ? 130 : props.type === "circle" ? 340 : 240) * u) : kind === "icon" ? (props.size || 160) * u : kind === "lower" ? 760 * u : z.w * f[wide ? 2 : 0];
    if (h == null) h = kind === "sticker" ? 96 * u : kind === "stamp" ? 130 * u : kind === "doodle" ? (props.type === "sparkle" ? 130 : props.type === "circle" ? 200 : props.type === "underline" ? 50 : 120) * u : kind === "icon" ? w : kind === "lower" ? 122 * u : z.h * f[wide ? 3 : 1];
    const x = box.x ?? (kind === "lower" ? 80 : z.x + (z.w - w) / 2), y = box.y ?? (kind === "lower" ? 790 : z.y + (z.h - h) / 2), b = { x, y, w, h };
    const e = div("cmp"); e.id = id; if (kind === "stack") e.setAttribute("data-layout-allow-overlap", ""); Object.assign(e.style, { left: x + "px", top: y + "px", width: w + "px" }); if (!["sticker", "stamp", "chips", "title", "lower"].includes(kind)) e.style.height = h + "px"; else if (kind !== "chips" && kind !== "title") e.style.height = "auto"; if (kind === "chips" || kind === "title") e.style.height = h + "px";
    e.style.setProperty("--u", u); e.classList.add("k-" + kind);
    const api = K[kind](e, props, b, u) || {}; api.pulse = api.pulse || ((tl, t, o) => { V.use(tl); V.pulse(e, t, o); return t + 0.2; });
    Object.keys(api).forEach((k) => { const f = api[k]; if (typeof f === "function") api[k] = (...a) => { if (a[0] && a[0].to && a[0].fromTo) V.use(a[0]); return f(...a); }; });
    const root = q(box.host) || q("#cam") || q("#root"); root.appendChild(e);
    e.kind = kind; e.parts = api.parts || {}; e.p = api; e.box = b; C.reg[id] = e; C.cur[kind] = e; return e;
  };

  const HOW = { drop: (e, t, o) => V.drop(e, t, o), rise: (e, t, o) => V.rise(e, t, o), whip: (e, t, o) => V.whip(e, t, o), pop: (e, t, o) => V.pop(e, t, o), slam: (e, t, o) => V.slam(e, t, o), fade: (e, t) => V.fadeIn(e, t), none: (e, t) => V.tl.set(e, { autoAlpha: 1 }, t), draw: (e, t, o) => { V.tl.set(e, { autoAlpha: 1 }, t); V.draw(Array.from(e.querySelectorAll("path")), t, { d: 0.35, stagger: 0.1, ...o }); } };
  C.land = (x, tl, t, how, o = {}) => { const e = get(x); V.use(tl); how = how || e.p.how || "drop"; HOW[how](e, t, { ...(e.p.landOpts || {}), ...o }); if (e.p.land) e.p.land(tl, t + (o.hook ?? 0.2), o); return t + 0.3; };
  C.leave = (x, tl, t, o = {}) => { V.use(tl); V.out(get(x), t, o); return t + (o.d || 0.1); };

  // aliases C.chat.reply(tl,t,...) -> last mounted chat; pass {on:'id'} as last arg to pick another instance
  ["chat", "browser", "code", "term", "receipt", "rail", "stat", "sticker", "stamp", "doodle", "stack", "ranking", "checklist", "quote", "timeline", "compare", "bars", "line", "image", "wall", "chips", "title", "lower", "icon"].forEach((k) => {
    C[k] = new Proxy({}, { get: (_, fn) => (...a) => { const last = a[a.length - 1], t = last && typeof last === "object" && !Array.isArray(last) && last.on ? C.reg[last.on] : C.cur[k]; if (!t) throw new Error("C." + k + "." + String(fn) + ": nothing mounted"); if (a[0] && a[0].on === undefined) V.use(a[0]); else if (a[0]) V.use(a[0]); return t.p[fn](...a); } });
  });
  Object.entries(ALIAS).forEach(([long, k]) => { if (!C[long]) C[long] = C[k]; });
  // wrap every perform so V.use(tl) is set from its first arg when it is a timeline
  C.use = (tl) => V.use(tl);
})();
