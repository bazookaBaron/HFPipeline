/* Runtime motion verbs for hand-authored HyperFrames reels (seek-safe GSAP).
 * Timing defaults come from analysis/runtime-reels/REFERENCE-STUDY.md:
 * entrances 4-8 f, exits 2-4 f, slams 1.35->1 in 6 f, drops tilt + blur and straighten on landing.
 * Every verb: V.x(target, t, opts). V.sfx collects {t, k} cues for the audio mix (window.__sfx). */
(function () {
  const V = { sfx: [], tl: null };
  let seed = 7;
  V.rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  V.reseed = (s) => (seed = s);
  V.use = (tl) => (V.tl = tl);
  const q = (s) => (typeof s === "string" ? document.querySelector(s) : s);
  const qa = (s) => (typeof s === "string" ? Array.from(document.querySelectorAll(s)) : [].concat(s));
  const cue = (t, k) => k && V.sfx.push({ t: +t.toFixed(3), k });
  V.cue = cue;
  V.q = q;
  V.qa = qa;
  V.set = (el, p, t = 0) => V.tl.set(q(el), p, t);

  // ---- entrances ----
  V.drop = (el, t, o = {}) => {
    const d = o.d || 0.2, e = q(el);
    V.tl.fromTo(e, { y: o.y ?? -1000, rotation: o.rot ?? -11, filter: "blur(12px)" }, { y: 0, rotation: 0, filter: "blur(0px)", duration: d, ease: "power4.out" }, t);
    V.tl.set(e, { autoAlpha: 1 }, t);
    V.tl.fromTo(e, { scaleY: 0.93, scaleX: 1.04 }, { scaleY: 1, scaleX: 1, duration: 0.2, ease: "back.out(3)" }, t + d * 0.75);
    cue(t, o.sfx ?? "whoosh");
  };
  V.rise = (el, t, o = {}) => V.drop(el, t, { y: 1000, rot: o.rot ?? 9, ...o });
  V.whip = (el, t, o = {}) => {
    const dir = o.from === "left" ? -1 : 1, d = o.d || 0.18;
    V.tl.fromTo(q(el), { x: dir * 1100, skewX: -dir * 18, rotation: dir * 6, filter: "blur(10px)" }, { x: 0, skewX: 0, rotation: 0, filter: "blur(0px)", duration: d, ease: "power4.out" }, t);
    V.tl.set(q(el), { autoAlpha: 1 }, t);
    cue(t, o.sfx ?? "whoosh");
  };
  V.pop = (el, t, o = {}) => {
    V.tl.fromTo(qa(el), { scale: 0, autoAlpha: 0, rotation: o.rot0 ?? 0 }, { scale: 1, autoAlpha: 1, rotation: o.rot ?? 0, duration: o.d || 0.2, ease: "back.out(2.4)", stagger: o.stagger || 0 }, t);
    cue(t, o.sfx ?? "pop");
  };
  V.slam = (el, t, o = {}) => {
    const e = qa(el);
    V.tl.fromTo(e, { scale: o.s ?? 1.4, autoAlpha: 0, rotation: o.rot0 ?? (o.rot || 0) * 1.6 }, { scale: 1, autoAlpha: 1, rotation: o.rot || 0, duration: 0.2, ease: "power4.out", stagger: o.stagger || 0 }, t);
    V.tl.fromTo(e, { textShadow: "7px 0 rgba(255,40,110,.85), -7px 0 rgba(30,220,255,.85)" }, { textShadow: "0px 0 rgba(255,40,110,0), 0px 0 rgba(30,220,255,0)", duration: 0.12, ease: "none" }, t + 0.03);
    if (o.shake !== false) V.shake(o.shakeEl || "#cam", t + 0.04, { a: o.amp || 7 });
    cue(t, o.sfx ?? "slam");
  };
  V.fadeIn = (el, t, d = 0.15) => V.tl.fromTo(qa(el), { autoAlpha: 0 }, { autoAlpha: 1, duration: d }, t);

  // ---- exits (2-4 f) ----
  V.out = (el, t, o = {}) => {
    const to = o.to || "left", d = o.d || 0.1, e = qa(el);
    const p = to === "shrink" ? { scale: 0, autoAlpha: 0 } : to === "up" ? { y: -900, filter: "blur(10px)" } : to === "down" ? { y: 900, filter: "blur(10px)" } : { x: (to === "left" ? -1 : 1) * 1100, filter: "blur(10px)" };
    V.tl.to(e, { ...p, duration: d, ease: "power3.in" }, t);
    V.tl.set(e, { autoAlpha: 0 }, t + d);
    if (o.sfx !== null) cue(t, o.sfx ?? "swish");
  };

  // ---- in-place performance ----
  V.pulse = (el, t, o = {}) => V.tl.fromTo(qa(el), { scale: 1 }, { scale: o.s || 1.08, duration: 0.09, yoyo: true, repeat: 1, ease: "power2.out" }, t);
  V.shake = (el, t, o = {}) => {
    const a = o.a || 8, e = q(el);
    V.tl.to(e, { keyframes: [{ x: a, y: -a * 0.4 }, { x: -a * 0.8, y: a * 0.5 }, { x: a * 0.5, y: 0 }, { x: 0, y: 0 }], duration: o.d || 0.16, ease: "none" }, t);
  };
  V.hl = (el, t, o = {}) => {
    V.tl.fromTo(q(el), { scaleX: 0 }, { scaleX: 1, duration: o.d || 0.18, ease: "power3.out", transformOrigin: "left center" }, t);
    cue(t, o.sfx ?? "tick");
  };
  V.draw = (el, t, o = {}) => {
    qa(el).forEach((p, i) => {
      const L = p.getTotalLength ? p.getTotalLength() : 1000;
      V.tl.fromTo(p, { strokeDasharray: L, strokeDashoffset: L, autoAlpha: 1 }, { strokeDashoffset: 0, duration: o.d || 0.22, ease: "power2.inOut", immediateRender: false }, t + i * (o.stagger || 0));
    });
    cue(t, o.sfx ?? "scribble");
  };
  V.odo = (el, t, from, to, o = {}) => {
    const e = q(el), st = { v: from }, fmt = o.fmt || ((v) => Math.round(v).toLocaleString("en-US"));
    V.tl.set(e, { textContent: fmt(from) }, t - 0.001);
    V.tl.to(st, { v: to, duration: o.d || 0.5, ease: o.ease || "power2.out", onUpdate: () => (e.textContent = fmt(st.v)) }, t);
    if (o.sfx !== null) for (let k = 0; k < (o.ticks || 4); k++) cue(t + k * ((o.d || 0.5) / (o.ticks || 4)), "tick");
  };
  V.scramble = (el, t, final, o = {}) => {
    const e = q(el), st = { p: 0 }, chars = "0123456789", n = String(final).length;
    V.tl.to(st, { p: 1, duration: o.d || 0.45, ease: "none", onUpdate: () => {
      if (st.p >= 1) return (e.textContent = final);
      let s = "", k = Math.floor(st.p * 40);
      for (let i = 0; i < Math.max(n, 3); i++) s += chars[(k * 7 + i * 13 + k * i) % 10];
      e.textContent = s;
    } }, t);
    cue(t, "tick"); cue(t + (o.d || 0.45) * 0.5, "tick"); cue(t + (o.d || 0.45), "tick");
  };
  V.type = (el, t, text, o = {}) => {
    const e = q(el), st = { n: 0 };
    V.tl.set(e, { textContent: "" }, t - 0.001);
    V.tl.to(st, { n: text.length, duration: o.d || text.length * 0.03, ease: "none", onUpdate: () => (e.textContent = text.slice(0, Math.round(st.n)) + (o.caret === false || st.n >= text.length ? "" : "|")) }, t);
    if (o.sfx !== null) for (let k = 0; k < Math.min(6, Math.ceil((o.d || text.length * 0.03) / 0.08)); k++) cue(t + k * 0.08, "key");
  };
  V.ring = (host, t, x, y, o = {}) => {
    const r = document.createElement("div");
    r.className = "fx-ring";
    Object.assign(r.style, { left: x - 40 + "px", top: y - 40 + "px", borderColor: o.color || "#EA4B2A", visibility: "hidden", opacity: 0 }); // hidden until t: never a stray dot before its moment
    q(host).appendChild(r);
    V.tl.fromTo(r, { scale: 0.2, autoAlpha: 1 }, { scale: o.s || 2.4, autoAlpha: 0, duration: 0.4, ease: "power2.out", immediateRender: false }, t);
  };
  V.click = (cursor, t, x, y, o = {}) => {
    const c = q(cursor);
    V.tl.to(c, { x, y, autoAlpha: 1, duration: o.move || 0.2, ease: "power3.out" }, t - (o.move || 0.2));
    V.tl.fromTo(c, { scale: 1 }, { scale: 0.8, duration: 0.05, yoyo: true, repeat: 1 }, t);
    V.ring(o.host || "#fx", t, x + 8, y + 8, o);
    cue(t, "click");
  };
  V.burst = (host, t, n, x, y, o = {}) => {
    const cols = o.colors || ["#EA4B2A", "#141414", "#D9ED24", "#FC2F6A", "#2A7BEA"];
    for (let i = 0; i < n; i++) {
      const p = document.createElement("div");
      p.className = "fx-bit";
      const s = 10 + V.rand() * 18;
      Object.assign(p.style, { left: x + "px", top: y + "px", width: s + "px", height: s * (0.4 + V.rand()) + "px", background: cols[i % cols.length], visibility: "hidden", opacity: 0 }); // hidden until t
      q(host).appendChild(p);
      const a = V.rand() * Math.PI * 2, r = 160 + V.rand() * (o.r || 420);
      V.tl.fromTo(p, { x: 0, y: 0, rotation: 0, autoAlpha: 1 }, { x: Math.cos(a) * r, y: Math.sin(a) * r + 220, rotation: (V.rand() - 0.5) * 720, autoAlpha: 0, duration: 0.7 + V.rand() * 0.3, ease: "power2.out", immediateRender: false }, t + V.rand() * 0.05);
    }
    cue(t, o.sfx ?? "burst");
  };
  V.cam = (t, o = {}) => V.tl.to("#cam", { scale: o.s ?? 1, x: o.x ?? 0, y: o.y ?? 0, rotation: o.r ?? 0, duration: o.d || 0.35, ease: o.ease || "power3.inOut" }, t);

  // ---- theme swaps (dressed hard cuts) ----
  V.glitch = (t, o = {}) => {
    const g = q("#glitch");
    V.tl.set(g, { autoAlpha: 1 }, t);
    g.querySelectorAll("i").forEach((s, i) => V.tl.fromTo(s, { x: (i % 2 ? -1 : 1) * (40 + i * 9), scaleY: 1 }, { x: 0, duration: 0.13, ease: "steps(3)" }, t));
    V.tl.set(g, { autoAlpha: 0 }, t + 0.14);
    if (o.swap) V.tl.call(o.swap, null, t + 0.07), o.swap.reverse && V.tl.call(o.swap.reverse, null, t + 0.0699);
    cue(t, "glitch");
  };
  V.halftone = (t, o = {}) => {
    const dots = qa("#halftone b");
    V.tl.fromTo(dots, { scale: 0 }, { scale: 1.6, duration: 0.17, ease: "power2.in", stagger: { each: 0.004, from: o.from || "start", grid: "auto" } }, t);
    V.tl.to(dots, { scale: 0, duration: 0.17, ease: "power2.out", stagger: { each: 0.004, from: o.from || "start", grid: "auto" } }, t + 0.24);
    cue(t, "whoosh");
  };

  // ---- word-synced captions (top-left, blur-to-ink, phrase blocks) ----
  V.captions = (host, words, o = {}) => {
    const box = q(host), accents = o.accents || {}, maxChars = o.maxChars || 46;
    const phrases = [];
    let cur = [];
    words.forEach((w, i) => {
      cur.push(i);
      const len = cur.reduce((n, k) => n + words[k].w.length + 1, 0);
      if (/[.!?]$/.test(w.w) || (/,$/.test(w.w) && len > 18) || len > maxChars) phrases.push(cur), (cur = []);
    });
    if (cur.length) phrases.push(cur);
    phrases.forEach((ph, pi) => {
      const blk = document.createElement("div");
      blk.className = "cap-block";
      box.appendChild(blk);
      ph.forEach((k) => {
        const sp = document.createElement("span");
        sp.className = "cap-w" + (accents[k] ? " cap-acc " + accents[k] : "");
        sp.textContent = words[k].w + " ";
        blk.appendChild(sp);
        V.tl.fromTo(sp, { autoAlpha: 0.22, filter: "blur(5px)", y: 8 }, { autoAlpha: 1, filter: "blur(0px)", y: 0, duration: 0.1, ease: "power2.out" }, words[k].s);
      });
      const start = words[ph[0]].s, next = phrases[pi + 1] ? words[phrases[pi + 1][0]].s : o.end || start + 3;
      V.tl.set(blk, { autoAlpha: 1 }, start - 0.001);
      V.tl.set(blk, { autoAlpha: 0 }, next - 0.002);
      V.tl.set(blk, { autoAlpha: 0 }, 0);
    });
  };

  // ---- presenter: mouth from words, blinks, arm + body poses from a pose list ----
  V.presenter = (o) => {
    const { words, poses, end } = o, open = q("#g-open"), t1 = q("#g-talk"), t2 = q("#g-talk2"), bl = q("#g-blink");
    const blinks = [];
    for (let t = 1.1; t < end; t += 2.6 + ((t * 7) % 1.3)) blinks.push(t);
    const st = { t: 0 };
    V.tl.to(st, { t: end, duration: end, ease: "none", onUpdate: () => {
      const t = st.t;
      let m = 0;
      for (const w of words) if (t >= w.s - 0.02 && t < w.e) { m = Math.floor((t - w.s) / 0.085) % 2 ? 1 : 2; break; }
      const b = blinks.some((x) => t >= x && t < x + 0.11);
      open.style.opacity = !m && !b ? 1 : 0;
      t1.style.opacity = m === 1 && !b ? 1 : 0;
      t2.style.opacity = m === 2 && !b ? 1 : 0;
      bl.style.opacity = b ? 1 : 0;
    } }, 0);
    poses.forEach((p) => {
      if (p.arm != null) V.tl.to("#g-arm", { rotation: p.arm, duration: p.ad || 0.16, ease: "back.out(2)" }, p.t);
      if (p.wave) V.tl.to("#g-arm", { keyframes: [{ rotation: -14 }, { rotation: 10 }, { rotation: -12 }, { rotation: 6 }, { rotation: 0 }], duration: 0.7, ease: "sine.inOut" }, p.t);
      if (p.body) V.tl.to("#guy", { ...p.body, duration: p.d || 0.22, ease: p.ease || "power3.out" }, p.t);
      if (p.bob) V.tl.fromTo("#g-body", { y: 0 }, { y: -p.bob, duration: 0.09, yoyo: true, repeat: 1, ease: "power2.out" }, p.t);
      if (p.lean != null) V.tl.to("#g-body", { rotation: p.lean, duration: 0.2, ease: "power2.out" }, p.t);
      if (p.shake) V.tl.to("#g-body", { keyframes: [{ rotation: -3 }, { rotation: 3 }, { rotation: -2 }, { rotation: 0 }], duration: 0.3 }, p.t);
    });
  };

  window.V = V;
})();
