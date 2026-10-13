/* LF: shared long-form kit (1920x1080). Needs gsap, verbs.js (V), puppet.js, theme CSS vars on :root. Seek-safe: all DOM at authoring time.
 * Every helper takes (tl, ..., t) with chapter-local seconds; elements are hidden until their entrance and return the element (or end time).
 * LF.init(tl)                      V.use(tl), inject css. Call first.
 * LF.stage(W,H,{ch,title})         dot-grid bgs (bg/deep/pale), #cam>#maps+#fx, header chip top-left, year chip top-right. Returns {cam,maps,fx}.
 * LF.bg(tl,"bg|deep|pale",t)       hard-cut background swap.   LF.year(tl,"1971",t) / LF.yearOff(tl,t)   running year chip (scramble).
 * LF.chapterCard(tl,n,title,t,after="pale",{firstWord,lead=2.3,hold=2.6})  READABLE card, ~3.5 s: number slams (0.05), title types fast (0.3-0.75), then HOLDS >= 2.6 s with
 *      micro-motion only (scale 1.0->1.03), then exits; bg swaps deep->pale. Pass t=null + {firstWord: chapter-local time of the chapter's first word} to start it
 *      `lead` s before that word, i.e. inside the silent chapter pause made by `voice.py --chapters chapters.json --pause 2.8`. Returns the end time. (puppet sits above it)
 * LF.photo(tl,id,media,{x,y,w,h,t,dur,kb,rot,pos,cap,out,z=50})  (z above stage boards; a photo under another board is a build failure, see strays.js occlusion) paper frame, Ken Burns 1.04->1.10, grain if media[id].grain, credit strip.
 * LF.badge(tl,id,media,name,role,{x,y,t,size})   circle person badge + name chip (+role chip).
 * LF.stamp(tl,text,{x,y,t,rot,size})  slams with shake+ring.   LF.counter(tl,label,from,to,{x,y,t,prefix,suffix,d,fmt,w})
 * LF.quote(tl,text,by,{x,y,w,t,hl:[t..],size})  *marked* words get a marker sweep at hl times (default t+0.6, +0.35 each).
 * LF.chip(tl,text,{x,y,t,fill,size,rot,how})  fill paper|marker|ink|pale|alert; how pop|drop|whip|slam.  LF.card(tl,html,{x,y,w,h,t,how,fill})
 * LF.out(tl,els,t,to)              exit (shrink|left|up|down).  LF.shift(tl,els,dx,t,d)  slide elements.  LF.pulse(tl,el,t)
 * LF.mapXY(M,view,place,{x,y,w,h}) -> [sx,sy] screen point of a place once the map camera sits on `view`.  puppet opt x0 = absolute start x.
 * LF.svgLayer(z) / LF.sp(svg,tag,attrs) hidden svg parts; LF.show/hide(tl,e,t); LF.draw(tl,pathEl,t,d); LF.tick(tl,svg,x,y,t,scale,bad) check/cross mark.
 * LF.fly(tl,el,{x,y},t,d)          move an element (absolute left/top) with a whoosh ease.
 * LF.at(words,line,"word",nth)     time of that word in that line (punctuation-insensitive; falls back to the line start, then 0; never null).
 *   LF.line(words,i) -> {s,e}      LF.WORDS(all,lines,t0) -> chapter-local word list.
 * LF.puppet(tl,{words,dur,cx:1640,h:620,floor:1010,start:"right"|"stand"}) -> pz. Queue actions in any order, then pz.run():
 *   pz.walk(t,d,toX) pz.pose(t,name,{hold}) pz.shift(t,"l|r|c") pz.step(t,"l|r") pz.jump(t) pz.hop(t) pz.sit(t) pz.up(t) pz.lean(t,dir)
 *   pz.tap(t) pz.turn(t,m) pz.point(t,"l|r") pz.look(t,dir) pz.face(t,{...}) pz.talk(t0,t1) (restrict) ; run() sorts, auto-fills a weight shift / look /
 *   small gesture every ~2.4 s wherever nothing is queued, returns arms to stand after a gesture, adds talk+blinks+idle. pz.x(t) = centre x at t.
 *   o.quiet = [[t0,t1],...] chapter-local windows (iso/board blocks) with NO auto-fill: queue explicit point/present tied to build steps there.
 */
(function (root) {
  const LF = {}; let V, tl0, ZI = 1;
  const css = `
.lf{position:absolute;box-sizing:border-box;visibility:hidden;opacity:0}
.lf-bg{position:absolute;inset:0;background-image:radial-gradient(circle at center,var(--dot) 0 2px,transparent 2.6px);background-size:40px 40px}
.lf-chip{font:400 44px/1 Anton,sans-serif;letter-spacing:.04em;color:var(--ink);background:var(--paper);border:6px solid var(--ink);border-radius:16px;box-shadow:8px 8px 0 var(--shadow);padding:12px 24px 8px;white-space:nowrap;text-transform:uppercase}
.lf-chip.marker{background:var(--marker)}.lf-chip.ink{background:var(--ink);color:var(--paper);box-shadow:8px 8px 0 var(--shadow)}.lf-chip.pale{background:var(--pale)}.lf-chip.alert{background:var(--alert);color:var(--paper)}
.lf-card{background:var(--paper);border:6px solid var(--ink);border-radius:26px;box-shadow:10px 10px 0 var(--shadow);padding:28px 36px;font:800 44px/1.15 Inter,sans-serif;color:var(--ink)}
.lf-card.marker{background:var(--marker)}.lf-card.pale{background:var(--pale)}
.lf-photo{background:var(--paper);border:6px solid var(--ink);box-shadow:10px 10px 0 var(--shadow);padding:12px;border-radius:10px}
.lf-photo .in{position:relative;width:100%;height:100%;overflow:hidden;border:4px solid var(--ink)}
.lf-photo img{position:absolute;left:0;top:0;width:100%;height:100%;object-fit:cover}
.lf-grain{position:absolute;inset:-40px;mix-blend-mode:multiply;opacity:.55;background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='220' height='220'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 .1  0 0 0 0 .1  0 0 0 0 .1  0 0 0 1.1 -.3'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>")}
.lf-credit{position:absolute;left:-6px;bottom:-34px;font:700 17px/1 Inter,sans-serif;background:var(--ink);color:var(--paper);padding:7px 12px;border-radius:6px;white-space:nowrap;max-width:98%;overflow:hidden}
.lf-badge{width:var(--s);height:var(--s);border-radius:50%;border:6px solid var(--ink);box-shadow:8px 8px 0 var(--shadow);overflow:hidden;background:var(--paper);position:relative}
.lf-badge img{width:100%;height:100%;object-fit:cover}
.lf-stamp{font:400 96px/1 Anton,sans-serif;letter-spacing:.05em;color:var(--alert);border:8px solid var(--alert);outline:4px solid var(--alert);outline-offset:6px;border-radius:14px;padding:14px 30px 8px;background:var(--paper);text-transform:uppercase;white-space:nowrap}
.lf-big{font:400 130px/1 Anton,sans-serif;color:var(--ink)}.lf-lab{font:800 28px/1.1 Inter,sans-serif;letter-spacing:.06em;text-transform:uppercase;color:var(--ink)}
.lf-m{background:linear-gradient(var(--marker),var(--marker)) 0 88%/0% 70% no-repeat;padding:0 4px}
.fx-ring{opacity:0;position:absolute;width:80px;height:80px;border:8px solid var(--ink);border-radius:50%;pointer-events:none}.fx-bit{position:absolute;pointer-events:none}`;
  LF.init = (tl) => { tl0 = tl; V = root.V; V.use(tl); const s = document.createElement("style"); s.textContent = css; document.head.appendChild(s); };
  const rootEl = () => document.getElementById("root");
  const mk = (cls, html, st, par, tag) => { const e = document.createElement(tag || "div"); e.className = "lf " + cls; e.setAttribute("data-layout-allow-overlap", ""); e.setAttribute("data-layout-allow-occlusion", ""); e.setAttribute("data-layout-allow-overflow", ""); if (html != null) e.innerHTML = html; Object.assign(e.style, st || {}); (par || LF.cam || rootEl()).appendChild(e); if (par && par.classList && par.classList.contains("lf") && !par.classList.contains("lfh")) { e.style.visibility = "visible"; e.style.opacity = 1; } return e; };
  const px = (v) => (typeof v === "number" ? v + "px" : v);
  const place = (e, o) => { if (o.x != null) e.style.left = px(o.x); if (o.y != null) e.style.top = px(o.y); if (o.w != null) e.style.width = px(o.w); if (o.h != null) e.style.height = px(o.h); if (o.z != null) e.style.zIndex = o.z; return e; };
  const enter = (e, t, how, o) => {
    o = o || {}; how = how || "pop";
    if (how === "pop") { gsap.set(e, { visibility: "visible" }); V.pop(e, t, { rot: o.rot || 0, d: o.d || 0.22 }); }
    else if (how === "slam") { gsap.set(e, { visibility: "visible" }); V.slam(e, t, { rot: o.rot || 0, s: o.s || 1.4, shake: o.shake !== false }); }
    else if (how === "drop") { e.style.visibility = "visible"; V.drop(e, t, { y: o.y0 || -900, rot: o.rot0 ?? -6, d: o.d || 0.22 }); tl0.fromTo(e, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.01 }, t); if (o.rot) tl0.to(e, { rotation: o.rot, duration: 0.1 }, t + 0.22); }
    else if (how === "whip") { e.style.visibility = "visible"; V.whip(e, t, { from: o.from || "left" }); tl0.fromTo(e, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.01 }, t); }
    else { tl0.fromTo(e, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.15 }, t); }
    return e;
  };
  LF.set = (tl, el, v, t) => tl.set(el, Object.assign({ immediateRender: false }, v), t);
  LF.mapXY = (M, view, place, b, pad) => { const c = M.fit(view, pad), p = M.pt(place), w = c.w, k = b.w / w, h = w / (b.w / b.h); return [b.x + (p[0] - (c.cx - w / 2)) * k, b.y + (p[1] - (c.cy - h / 2)) * k]; };
  const NS = "http://www.w3.org/2000/svg";
  LF.svgLayer = (z) => { const s = document.createElementNS(NS, "svg"); s.setAttribute("width", 1920); s.setAttribute("height", 1080); s.style.cssText = `position:absolute;left:0;top:0;z-index:${z || 8};overflow:visible;pointer-events:none`; (LF.cam || rootEl()).appendChild(s); return s; };
  LF.sp = (svg, tag, at) => { const e = document.createElementNS(NS, tag); for (const k in at) e.setAttribute(k, at[k]); e.style.opacity = 0; svg.appendChild(e); return e; };
  LF.show = (tl, e, t) => tl.fromTo(e, { opacity: 0 }, { opacity: 1, duration: 0.01, immediateRender: false }, t);
  LF.hide = (tl, e, t) => tl.to(e, { opacity: 0, duration: 0.01 }, t);
  LF.draw = (tl, e, t, d) => { const L = e.getTotalLength ? e.getTotalLength() : 600; tl.fromTo(e, { opacity: 1, strokeDasharray: L, strokeDashoffset: L }, { strokeDashoffset: 0, duration: d || 0.35, ease: "power2.inOut", immediateRender: false }, t); tl.set(e, { strokeDasharray: "none" }, t + (d || 0.35) + 0.01); };
  LF.tick = (tl, svg, x, y, t, s, bad) => { s = s || 1; const p = LF.sp(svg, "path", { d: bad ? `M${x} ${y} L${x + 50 * s} ${y + 50 * s} M${x + 50 * s} ${y} L${x} ${y + 50 * s}` : `M${x} ${y + 28 * s} L${x + 20 * s} ${y + 52 * s} L${x + 62 * s} ${y - 6 * s}`, fill: "none", stroke: "var(--ink)", "stroke-width": 12 * s, "stroke-linecap": "round", "stroke-linejoin": "round" }); LF.draw(tl, p, t, 0.25); return p; };
  LF.mk = mk; LF.enter = enter; LF.px = px;
  LF.stage = (W, H, o) => {
    o = o || {}; const r = rootEl();
    ["bg", "deep", "pale"].forEach((k, i) => { const b = mk("lf-bg", "", { background: `var(--${k})`, visibility: "visible", opacity: i ? 0 : 1, zIndex: 0 }, r); b.id = "lf-bg-" + k; b.classList.add("lf-bgl"); });
    const cam = mk("lfh", "", { inset: 0, visibility: "visible", opacity: 1, zIndex: 2 }, r); cam.id = "cam";
    const maps = mk("lfh", "", { inset: 0, visibility: "visible", opacity: 1 }, cam); maps.id = "lf-maps";
    const fx = mk("lfh", "", { inset: 0, visibility: "visible", opacity: 1, pointerEvents: "none", zIndex: 40 }, cam); fx.id = "fx";
    LF.cam = cam; LF.fx = fx; LF.maps = maps;
    const hd = mk("lf-chip ink", (o.ch != null ? "CH " + o.ch + " · " : "") + (o.title || ""), { left: "48px", top: "40px", fontSize: "34px", zIndex: 60, padding: "10px 20px 6px" }, r);
    hd.id = "lf-head"; enter(hd, o.headT ?? 0.05, "whip");
    const yr = mk("lf-chip marker", "", { right: "48px", top: "40px", fontSize: "56px", zIndex: 60 }, r); yr.id = "lf-year"; LF.yearEl = yr;
    return { cam, maps, fx };
  };
  LF.bg = (tl, which, t) => ["bg", "deep", "pale"].forEach((k) => LF.set(tl, "#lf-bg-" + k, { opacity: k === which ? 1 : 0 }, t));
  LF.year = (tl, txt, t) => {
    const e = LF.yearEl; LF.set(tl, e, { textContent: txt, visibility: "visible" }, t); V.slam(e, t, { s: 1.5, shake: false, sfx: "tick" }); return e;
  };
  LF.yearOff = (tl, t) => LF.set(tl, LF.yearEl, { autoAlpha: 0 }, t);
  LF.chapterCard = (tl, n, title, t, after, o) => {
    o = o || {};
    if (t == null) t = Math.max(0, (o.firstWord || 0) - (o.lead == null ? 2.3 : o.lead)); // default: start inside the silent pause, before the chapter's first word
    const r = rootEl(), z = 80, hold = Math.max(2.6, o.hold || 2.6), tEnd = t + 0.75 + hold; // slam 0.05, title types 0.3-0.75, then HOLD >= 1.8 s readable
    const ov = mk("", "", { inset: 0, background: "var(--deep)", zIndex: z, visibility: "visible", opacity: 0 }, r); ov.appendChild(Object.assign(document.createElement("div"), { className: "lf-bg" }));
    const num = mk("", String(n).padStart(2, "0"), { left: "70px", top: "170px", font: "400 560px/1 Anton,sans-serif", color: "var(--marker)", webkitTextStroke: "10px var(--ink)", textShadow: "14px 14px 0 var(--ink)", zIndex: z + 1 }, r);
    const ttl = mk("", "", { left: "80px", top: "770px", font: "400 96px/1 Anton,sans-serif", color: "var(--paper)", textShadow: "6px 6px 0 var(--ink)", textTransform: "uppercase", whiteSpace: "nowrap", zIndex: z + 1 }, r);
    LF.set(tl, ov, { opacity: 1 }, t); LF.bg(tl, "deep", t); V.slam(num, t + 0.05, { s: 1.6, shake: false }); V.type(ttl, t + 0.3, title.toUpperCase(), { d: 0.45 });
    LF.set(tl, ttl, { visibility: "visible", opacity: 1 }, t + 0.3);
    tl.fromTo([num, ttl], { scale: 1 }, { scale: 1.03, duration: tEnd - (t + 0.75), ease: "none", immediateRender: false, transformOrigin: "0% 50%" }, t + 0.75); // micro-motion only: calm stage
    tl.to(ov, { opacity: 0, duration: 0.14 }, tEnd); tl.to([num, ttl], { x: -300, autoAlpha: 0, duration: 0.14 }, tEnd); LF.bg(tl, after || "pale", tEnd + 0.14);
    return tEnd + 0.14;
  };
  const fixCredit = (s) => String(s || "").replace(/Â·/g, "·").replace(/â€¦/g, "").replace(/Ã©/g, "e").replace(/\s+/g, " ").trim();
  LF.photo = (tl, id, media, o) => {
    const m = media[id] || {}, w = o.w || 640, h = o.h || 440, t = o.t || 0, dur = o.dur || 6;
    const e = mk("lf-photo", "", { left: px(o.x || 0), top: px(o.y || 0), width: px(w), height: px(h), zIndex: o.z || 50 });
    const inn = mk("in", "", {}, e); inn.style.position = "relative";
    const img = document.createElement("img"); img.src = m.file || ("images/" + id + ".jpg"); img.style.objectPosition = o.pos || "50% 50%"; inn.appendChild(img);
    if (m.grain) { const g = mk("lf-grain", "", { visibility: "visible", opacity: 0.55 }, inn); tl.fromTo(g, { x: 0, y: 0 }, { x: -40, y: -30, duration: dur + 1, ease: "none" }, t); }
    mk("lf-credit", fixCredit(m.credit), { visibility: "visible", opacity: 1 }, e);
    if (o.cap) mk("lf-chip marker", o.cap, { visibility: "visible", opacity: 1, left: "18px", top: "-26px", fontSize: "34px", padding: "8px 18px 4px" }, e);
    enter(e, t, o.how || "drop", { rot: o.rot || 0 });
    if (o.kb !== false) tl.fromTo(img, { scale: 1.04, x: 0, y: 0 }, { scale: 1.1, x: o.kx ?? -14, y: o.ky ?? -8, duration: dur, ease: "none", immediateRender: false }, t + 0.1);
    if (o.out) LF.out(tl, e, t + dur, o.out === true ? "shrink" : o.out);
    return e;
  };
  LF.badge = (tl, id, media, name, role, o) => {
    const m = media[id] || {}, s = o.size || 230, wrap = mk("", "", { left: px(o.x || 0), top: px(o.y || 0), width: px(s + 20), zIndex: o.z || 52, textAlign: "center" });
    const b = mk("lf-badge", "", { visibility: "visible", opacity: 1, margin: "0 auto", "--s": s + "px" }, wrap); b.style.setProperty("--s", s + "px");
    const img = document.createElement("img"); img.src = m.file || ("images/" + id + ".jpg"); b.appendChild(img);
    if (m.grain) mk("lf-grain", "", { visibility: "visible", opacity: 0.4 }, b);
    mk("lf-chip", name, { visibility: "visible", opacity: 1, position: "relative", marginTop: "14px", fontSize: "30px", display: "inline-block", padding: "8px 16px 4px" }, wrap);
    if (role) mk("lf-chip marker", role, { visibility: "visible", opacity: 1, position: "relative", marginTop: "10px", fontSize: "22px", display: "inline-block", padding: "6px 12px 3px" }, wrap);
    enter(wrap, o.t || 0, o.how || "pop"); return wrap;
  };
  LF.chip = (tl, text, o) => { const e = mk("lf-chip " + (o.fill || ""), text, { left: px(o.x || 0), top: px(o.y || 0), fontSize: px(o.size || 44), zIndex: o.z || 14 }); return enter(e, o.t || 0, o.how || "pop", { rot: o.rot || 0 }); };
  LF.card = (tl, html, o) => { const e = mk("lf-card " + (o.fill || ""), html, { left: px(o.x || 0), top: px(o.y || 0), width: px(o.w || 600), height: o.h ? px(o.h) : "auto", zIndex: o.z || 10 }); return enter(e, o.t || 0, o.how || "drop", { rot: o.rot || 0 }); };
  LF.stamp = (tl, text, o) => {
    const e = mk("lf-stamp", text, { left: px(o.x || 0), top: px(o.y || 0), fontSize: px(o.size || 96), zIndex: o.z || 30 }); enter(e, o.t || 0, "slam", { rot: o.rot ?? -6, s: 1.7 });
    V.ring("#fx", (o.t || 0) + 0.12, (o.x || 0) + e.scrollWidth / 2, (o.y || 0) + 60, { color: "var(--ink)", s: 4 }); return e;
  };
  LF.counter = (tl, label, from, to, o) => {
    const e = mk("lf-card", "", { left: px(o.x || 0), top: px(o.y || 0), width: px(o.w || 560), textAlign: "center", zIndex: o.z || 12, padding: "20px 26px 16px" });
    const n = mk("lf-big", "", { visibility: "visible", opacity: 1, position: "relative", fontSize: px(o.size || 130) }, e); const sf = o.suffix || "", pf = o.prefix || "";
    mk("lf-lab", label, { visibility: "visible", opacity: 1, position: "relative", marginTop: "6px" }, e);
    const fmt = o.fmt || ((v) => (to % 1 ? v.toFixed(1) : Math.round(v).toLocaleString("en-US")));
    n.textContent = pf + fmt(from) + sf; enter(e, o.t || 0, o.how || "pop"); V.odo(n, (o.t || 0) + 0.15, from, to, { d: o.d || 0.9, fmt: (v) => pf + fmt(v) + sf }); return e;
  };
  LF.quote = (tl, text, by, o) => {
    const html = text.replace(/\*([^*]+)\*/g, '<span class="lf-m">$1</span>');
    const e = mk("lf-card", html + (by ? `<div class="lf-lab" style="margin-top:18px;opacity:.7">— ${by}</div>` : ""), { left: px(o.x || 0), top: px(o.y || 0), width: px(o.w || 900), fontSize: px(o.size || 56), zIndex: o.z || 12 });
    enter(e, o.t || 0, o.how || "drop", { rot: o.rot || 0 });
    const ms = e.querySelectorAll(".lf-m"); ms.forEach((m, i) => { const at = (o.hl && o.hl[i] != null) ? o.hl[i] : (o.t || 0) + 0.6 + i * 0.35; tl.fromTo(m, { backgroundSize: "0% 70%" }, { backgroundSize: "100% 70%", duration: 0.25, ease: "power3.out", immediateRender: false }, at); });
    return e;
  };
  LF.out = (tl, els, t, to) => { V.out(els, t, { to: to || "shrink", d: 0.12 }); };
  LF.shift = (tl, els, dx, t, d) => { tl.to(els, { x: "+=" + dx, duration: d || 0.5, ease: "power3.inOut" }, t); };
  LF.fly = (tl, el, p, t, d) => { tl.to(el, { left: p.x, top: p.y, duration: d || 0.5, ease: "power3.inOut" }, t); };
  LF.pulse = (tl, el, t) => V.pulse(el, t);
  // ---------- timing ----------
  const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  LF.line = (words, i) => { const a = words.filter((w) => w.line === i); return a.length ? { s: a[0].s, e: a[a.length - 1].e } : null; };
  LF.at = (words, line, word, nth) => {
    const a = words.filter((w) => w.line === line); let k = nth || 0;
    if (a.length && word != null) { const p = String(word).split(/\s+/).map(norm).filter(Boolean);
      for (let i = 0; i < a.length; i++) { if (p.every((q, j) => a[i + j] && norm(a[i + j].w) === q)) { if (k-- === 0) return a[i].s; } }
      for (let i = 0; i < a.length; i++) { if (norm(a[i].w).indexOf(p[0] || "~") === 0 && k <= 0) return a[i].s; } }
    if (a.length) return a[0].s;
    const nx = words.find((w) => w.line > line); if (nx) return nx.s; return words.length ? words[words.length - 1].e : 0;
  };
  LF.WORDS = (all, lines, t0) => all.filter((w) => w.line >= lines[0] && w.line <= lines[1]).map((w) => ({ w: w.w, s: +(w.s - t0).toFixed(3), e: +(w.e - t0).toFixed(3), line: w.line }));
  // ---------- puppet ----------
  LF.puppet = (tl, o) => {
    const h = o.h || 620, cx = o.cx || 1640, floor = o.floor || 1010, wd = Math.round(318 * h / 620), P0 = root.Puppet, dur = o.dur;
    const host = mk("", "", { left: px(cx - wd / 2), top: px(floor - h + 12), width: px(wd), zIndex: 90, visibility: "visible", opacity: 1 }, rootEl()); host.id = o.id || "pz";
    const theme = Object.assign({}, o.theme || {}, root.THEME ? { shadow: root.THEME.shadow } : {});
    const P = P0.mount("#" + host.id, { mode: "full", height: h, id: host.id + "p", theme });
    const Q = [], B = []; let curX = o.x0 != null ? o.x0 - cx : (o.start === "right" ? 640 : 0); const startX = curX;
    const off = (sx) => sx - cx; if (curX) P0.place(tl, 0, curX);
    const add = (t, k, a, d) => { Q.push({ t, k, a: a || {}, d: d || 0.6 }); B.push([t, t + (d || 0.6)]); return pz; };
    const pz = {
      P, host, cx,
      walk: (t, d, to) => add(t, "walk", { d, to }, d), pose: (t, n, a) => add(t, "pose", Object.assign({ n }, a), (a && a.hold) || 1.4),
      shift: (t, s) => add(t, "shift", { s }, 0.7), step: (t, s, a) => add(t, "step", Object.assign({ s }, a), 0.6), jump: (t, a) => add(t, "jump", a, 0.9),
      hop: (t, a) => add(t, "hop", a, 1.1), sit: (t) => add(t, "sit", {}, 1.2), up: (t) => add(t, "up", {}, 0.9), lean: (t, dir, a) => add(t, "lean", Object.assign({ dir }, a), 1.2),
      tap: (t, a) => add(t, "tap", a, (a && a.hold) || 1.2), turn: (t, m) => add(t, "turn", { m }, 0.8), point: (t, s) => add(t, "point", { s }, 1.6),
      look: (t, dir) => add(t, "look", { dir }, 0.5), face: (t, f) => add(t, "face", { f }, 0.8),
      x: (t) => { let x = startX; Q.slice().sort((a, b) => a.t - b.t).forEach((q) => { if (q.k === "walk" && q.t + q.d <= t) x = off(q.a.to); }); return cx + x; },
      run: () => {
        const quiet = o.quiet || [], busy = (t) => B.some((b) => t > b[0] - 0.7 && t < b[1] + 0.5) || quiet.some((w) => t >= w[0] - 0.3 && t <= w[1]);
        const autos = [["shift", "l"], ["look", "left"], ["shift", "r"], ["g", "both_open"], ["look", "right"], ["shift", "c"], ["look", "up"], ["g", "present_left"], ["shift", "l"], ["look", "left"], ["shift", "r"], ["g", "thinking"]];
        let ai = 0; for (let t = 0.8; t < dur - 0.8; t += 2.4) { if (busy(t)) continue; const a = autos[ai++ % autos.length]; if (a[0] === "g") { Q.push({ t, k: "pose", a: { n: a[1], hold: 1.0 }, d: 1 }); B.push([t, t + 1.1]); } else { Q.push({ t, k: a[0], a: { s: a[1], dir: a[1] }, d: 0.6 }); B.push([t, t + 0.6]); } }
        Q.sort((a, b) => a.t - b.t);
        Q.forEach((q, i) => {
          const a = q.a;
          switch (q.k) {
            case "walk": P0.walk(tl, q.t, q.t + a.d, { from: curX, to: off(a.to) }); curX = off(a.to); break;
            case "pose": P0.pose(tl, q.t, a.n, { d: a.d || 0.3, hold: a.hold }); { const nx = Q[i + 1]; if (!nx || nx.t > q.t + (a.hold || 1.4) + 0.2) if (!/^(stand|idle)$/.test(a.n)) P0.pose(tl, q.t + (a.hold || 1.4), "stand", { d: 0.4 }); } break;
            case "shift": P0.shift(tl, q.t, a.s, { d: 0.45 }); break; case "step": P0.step(tl, q.t, a.s, { len: a.len || 40 }); break;
            case "jump": P0.jump(tl, q.t, a); break; case "hop": P0.hop(tl, q.t, a); break; case "sit": P0.sit(tl, q.t); break; case "up": P0.stand(tl, q.t); break;
            case "lean": P0.lean(tl, q.t, { dir: a.dir || "r" }); break; case "tap": P0.tap(tl, q.t, a); break; case "turn": P0.turn(tl, q.t, a.m || "toggle"); break;
            case "point": P0.pointScreen(tl, q.t, a.s || "l"); { const nx = Q[i + 1]; if (!nx || nx.t > q.t + 1.8) P0.pose(tl, q.t + 1.6, "stand", { d: 0.4 }); } break;
            case "look": P0.look(tl, q.t, a.dir); break; case "face": P0.face(tl, q.t, a.f); break;
          }
        });
        P0.talk(tl, o.words || []); P0.blinks(tl, dur, { seed: o.seed || 5 }); P0.idle(tl, 0, dur);
      },
    };
    return pz;
  };
  root.LF = LF;
})(typeof window !== "undefined" ? window : globalThis);
