/*
 * HFStage LF maps (plan §3, glow upgrade LONGFORM-V2-PLAN §7): worldMap / countryMap / routeMap, vector
 * countries from Natural Earth (public domain, India point of view). The compiler (orchestrator/lib/video/v3/geo.js)
 * does all the geography: it projects every point, fits every view to the module rect and ships only the country
 * paths the module can show (+ a graticule). This file only draws.
 *
 * Look (our own, always on white):
 *   plate      white card, faint dot texture, a hairline graticule; the whole map drifts in slowly (1.00 -> 1.035)
 *   borders    draw on (stroke-dashoffset, pathLength 1) outward from the view centre; two layers per border:
 *              a sharp core line + a blurred accent halo (~35 %, CSS blur on an untransformed layer)
 *   focus      a highlighted country LIFTS: gradient copy scaled 1.00 -> 1.03 about its label point with a soft
 *              drop shadow and a brighter glowing edge; the other countries fade to light grey
 *   routes     gradient arcs (faint at the origin, full at the head) with a glowing comet head that travels the
 *              curve, then a small arrowhead / the stop's rings; route stops pulse (double rings)
 *   labels     pins carry a thin leader line and a label that types on
 *   data       choropleth fills west -> east, the top class gets a soft glow; counters sit on frosted cards
 *   camera     optional establishing flight (introView -> view), zoomTo between regions
 *
 *   props (compiled)  geo: {units, countries: [{iso, n, d, k, c}], grat}, view: [x, y, w, h] (map units),
 *                     introView?: [x, y, w, h], highlight: [{iso, tone, label?: {text, at}}], pins: [{at, label, tone, stop?}],
 *                     arrows: [{from, to, label, tone, bend, route?}], choropleth: {cls, colors, labels, title, unit, source, year} | null,
 *                     counters: [{at, value, prefix, suffix, decimals, label, tone, from}], auto? (routeMap: legs on entrance),
 *                     card?: true, source?: string, glow?: "#hex" (the video's glow accent), push?: false
 *   ops               highlight {iso, tone, label?}  the country lifts (gradient, shadow, glow edge), others fade
 *                     dim {iso}                      back to plain land
 *                     pin {at, label, tone}          dot pops, double rings pulse, leader label types on
 *                     arrow {from, to, label, tone, bend}   comet travels the arc (1.1 s), trail + head land
 *                     leg {i}                        routeMap: draw leg i (1-based) of props.arrows
 *                     zoomTo {view, dur}             the camera moves (power2.inOut); pins/labels/arcs ride along
 *                     choropleth {cls, colors, ...}  countries fill west -> east over 0.8 s, legend + source land
 *                     counter {at, value, ...}       frosted counter card pops at the place and counts up
 * Seek-safe: every change is a tl.set / finite tween at an explicit time (onUpdate only renders the tween's own
 * progress); no randomness, no infinite repeats (ring pulses repeat a computed, finite number of times).
 * Zoom math: screen = s * P + t is linear in (s, t), so overlay items tweened with the same ease and duration as
 * the map group stay glued to their geography at every frame. Dash layers do not use non-scaling strokes (that
 * breaks pathLength dashes), so their group stroke width follows 1 / scale through keyframes.
 */
(function (global) {
  "use strict";
  var HF = (global.HFStage = global.HFStage || { modules: {} });
  var M = HF.modules;
  var L = HF.lf;
  if (!L) throw new Error("modules-map.js needs profile-lf.js loaded first");
  var T = L.T;
  var div = L.div;
  var svg = L.svg;
  var MONO = L.MONO;

  var SEA = "#ffffff";
  var LAND = "#e6eaef"; // cool light grey land on white
  var LAND_FADE = "#f1f3f5"; // the neighbours once a country lifts
  var NET = "#a9b8c9"; // border core
  var GRAT = "#e7ecf2";
  var GLOW = "#2f7df6"; // default glow accent (one per video: props.glow)
  var INK = T.ink;
  var P = "html [data-profile=LF] ";
  var CSS = [
    P + ".lf-map{overflow:visible;}",
    P + ".lf-map .plate{position:absolute;inset:0;border-radius:16px;overflow:hidden;background:" + SEA + ";}",
    P + ".lf-map .plate.card{border:1.5px solid #e2e5e9;box-shadow:0 18px 44px rgba(22,34,52,.09),0 2px 5px rgba(22,34,52,.05);}",
    P + ".lf-map .tex{position:absolute;inset:0;background-image:radial-gradient(circle,#dde3ea 0,#dde3ea 1px,transparent 1.4px);background-size:22px 22px;background-position:11px 11px;opacity:.55;}",
    P + ".lf-map .vig{position:absolute;inset:0;background:radial-gradient(ellipse 75% 70% at 50% 48%,rgba(255,255,255,0) 55%,rgba(255,255,255,.85) 100%);pointer-events:none;}",
    P + ".lf-map .cam{position:absolute;inset:0;}",
    P + ".lf-map svg.lay{position:absolute;left:0;top:0;overflow:visible;}",
    P + ".lf-map svg.glow{filter:blur(4px);}",
    P + ".lf-map svg.aglow{filter:blur(5px);}",
    P + ".lf-map svg.lift{filter:drop-shadow(0 12px 14px rgba(16,36,70,.26)) drop-shadow(0 2px 3px rgba(16,36,70,.18));}",
    P + ".lf-map .ov{position:absolute;left:0;top:0;width:0;height:0;}",
    P + ".lf-map .clab{position:absolute;left:0;top:0;white-space:nowrap;font-size:19px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:#3a4654;text-shadow:0 0 3px #fff,0 0 3px #fff,0 0 7px #fff;}",
    P + ".lf-map .clab.on{color:#fff;text-shadow:0 1px 2px rgba(8,24,52,.5),0 0 10px rgba(8,24,52,.3);}",
    P + ".lf-map .pin{position:absolute;left:0;top:0;width:0;height:0;}",
    P + ".lf-map .pin .dot{position:absolute;left:-8px;top:-8px;width:16px;height:16px;border-radius:50%;background:var(--pc);border:3px solid #fff;box-sizing:border-box;box-shadow:0 0 0 1px rgba(20,30,45,.12),0 0 14px 2px var(--pg);}",
    P + ".lf-map .pin .ring{position:absolute;left:-9px;top:-9px;width:18px;height:18px;border-radius:50%;border:2px solid var(--pc);box-sizing:border-box;}",
    P + ".lf-map .pin svg{position:absolute;left:0;top:0;overflow:visible;}",
    P + ".lf-map .pin .lbl{position:absolute;top:-58px;height:34px;line-height:34px;padding:0 2px;font-size:22px;font-weight:800;letter-spacing:-.005em;color:" + INK + ";white-space:nowrap;text-shadow:0 0 3px #fff,0 0 3px #fff,0 0 8px #fff,0 0 12px #fff;}",
    P + ".lf-map .chip{position:absolute;top:-19px;height:38px;display:flex;align-items:center;padding:0 14px;border-radius:19px;background:rgba(255,255,255,.86);border:1.5px solid var(--pc," + INK + ");box-shadow:0 8px 22px rgba(20,34,60,.14),0 0 16px var(--pg,rgba(0,0,0,0));font-size:20px;font-weight:750;color:" + INK + ";white-space:nowrap;}",
    P + ".lf-map .ctr{position:absolute;left:0;top:0;padding:12px 18px 13px;border-radius:14px;background:rgba(255,255,255,.72);-webkit-backdrop-filter:blur(10px) saturate(1.3);backdrop-filter:blur(10px) saturate(1.3);border:1.5px solid rgba(255,255,255,.95);box-shadow:0 14px 34px rgba(18,34,62,.16),0 0 0 1px rgba(30,60,110,.08),0 0 22px var(--pg);white-space:nowrap;}",
    P + ".lf-map .ctr .k{font-family:" + MONO + ";font-size:14px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#56606b;}",
    P + ".lf-map .ctr .v{font-size:44px;font-weight:800;letter-spacing:-.035em;line-height:1.02;color:var(--pc);margin-top:3px;}",
    P + ".lf-map .legend{position:absolute;left:22px;bottom:50px;padding:12px 14px 10px;border-radius:12px;background:rgba(255,255,255,.8);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);border:1.5px solid #e3e7ec;box-shadow:0 8px 22px rgba(18,34,62,.08);}",
    P + ".lf-map .legend .lt{font-size:17px;font-weight:800;color:" + INK + ";white-space:nowrap;margin-bottom:2px;}",
    P + ".lf-map .legend .lu{font-family:" + MONO + ";font-size:14px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:" + T.muted + ";white-space:nowrap;margin-bottom:8px;}",
    P + ".lf-map .legend .row{display:flex;gap:3px;}",
    P + ".lf-map .legend .sw{width:64px;}",
    P + ".lf-map .legend .sw i{display:block;height:12px;border-radius:2px;}",
    P + ".lf-map .legend .sw span{display:block;margin-top:5px;font-family:" + MONO + ";font-size:14px;font-weight:500;color:" + T.ink2 + ";white-space:nowrap;}",
    P + ".lf-map .src{position:absolute;left:22px;bottom:16px;font-family:" + MONO + ";font-size:15px;font-weight:500;letter-spacing:.02em;color:" + T.muted + ";white-space:nowrap;}",
  ].join("\n");
  (function () {
    if (document.getElementById("st-lf-map-style")) return;
    var st = document.createElement("style");
    st.id = "st-lf-map-style";
    st.textContent = CSS;
    document.head.appendChild(st);
  })();

  function r1(v) {
    return Math.round(v * 100) / 100;
  }
  function r6(v) {
    return Math.round(v * 1e6) / 1e6;
  }
  function tf(v) {
    // the scale needs 6 decimals: 0.2453 vs 0.25 would drift the land 2 % away from the pins
    return "matrix(" + r6(v.s) + " 0 0 " + r6(v.s) + " " + r1(v.tx) + " " + r1(v.ty) + ")";
  }
  function hex(c) {
    var m = /^#?([0-9a-f]{6})$/i.exec(String(c || ""));
    if (!m) return [29, 94, 189];
    var n = parseInt(m[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function mix(a, b, k) {
    var x = hex(a);
    var y = hex(b);
    return "#" + [0, 1, 2].map(function (i) {
      var v = Math.round(x[i] + (y[i] - x[i]) * k);
      return (v < 16 ? "0" : "") + v.toString(16);
    }).join("");
  }
  function rgba(c, a) {
    var x = hex(c);
    return "rgba(" + x[0] + "," + x[1] + "," + x[2] + "," + a + ")";
  }
  // eased progress helpers (GSAP's power2.inOut / power1.inOut, for keyframed stroke widths)
  function p2io(u) {
    return u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
  }

  var uid = 0;

  function build(el, p, c, kind) {
    el.classList.add("lf-map");
    var id = "m" + ++uid;
    var w = L.W(el);
    var h = L.H(el);
    var geo = p.geo || { countries: [] };
    var glow = p.glow || GLOW;
    var plate = div("plate" + (p.card === false ? "" : " card"), el);
    div("tex", plate);
    var cam3 = div("cam", plate); // slow drift (the whole map, overlays included)
    function lay(cls) {
      return svg("svg", { class: "lay " + cls, width: w, height: h, viewBox: "0 0 " + w + " " + h }, cam3);
    }
    var sBase = lay("base");
    var sGlow = lay("glow");
    var sNet = lay("net");
    var sLift = lay("lift");
    var sAGlow = lay("aglow");
    var sArc = lay("arc");
    var defs = svg("defs", {}, sArc);
    var gBase = svg("g", {}, sBase);
    var gGlow = svg("g", { fill: "none", stroke: glow, "stroke-linejoin": "round", "stroke-linecap": "round" }, sGlow);
    var gNet = svg("g", { fill: "none", stroke: NET, "stroke-linejoin": "round", "stroke-linecap": "round" }, sNet);
    var gLift = svg("g", {}, sLift);
    // focus edges / choropleth heat: a second glow group above the network halos
    var gTop = svg("g", {}, sGlow);
    var cams = [gBase, gGlow, gTop, gNet, gLift];

    function camera(view) {
      var sc = Math.min(w / view[2], h / view[3]);
      return { s: sc, tx: -view[0] * sc + (w - view[2] * sc) / 2, ty: -view[1] * sc + (h - view[3] * sc) / 2 };
    }
    var home = camera(p.view || [0, 0, 1, 1]);
    var cam = p.introView ? camera(p.introView) : home;
    cams.forEach(function (g) {
      g.setAttribute("transform", tf(cam));
    });

    // graticule (non-scaling hairline) under the land
    if (geo.grat) svg("path", { d: geo.grat, fill: "none", stroke: GRAT, "stroke-width": 1, "vector-effect": "non-scaling-stroke" }, gBase);

    // ---- countries: land fill (base), border core (net), border halo (glow) ----
    var SW = { net: 1.1, glow: 4 };
    var paths = {};
    var nets = [];
    var halos = [];
    var byIso = {};
    var cx = w / 2;
    var cy = h / 2;
    // dash layers: one sub-group per path resolution k (scale(k) + its own stroke width: an inherited width
    // is in the path's own units, so a 110m path (k = 5) needs 1/5 of it)
    var subs = [];
    var subBy = {};
    function sub(layer, name, k, px) {
      var key = name + k;
      if (!subBy[key]) {
        subBy[key] = svg("g", k !== 1 ? { transform: "scale(" + k + ")" } : {}, layer);
        subs.push({ g: subBy[key], k: k, px: px });
      }
      return subBy[key];
    }
    (geo.countries || []).forEach(function (ct) {
      var kk = ct.k || 1;
      var tr = kk !== 1 ? "scale(" + kk + ")" : null;
      var a = { d: ct.d, "stroke-linejoin": "round" };
      if (tr) a.transform = tr;
      var land = svg("path", a, gBase);
      land.style.fill = LAND;
      paths[ct.iso] = land;
      c.entity(ct.iso, land);
      var dash = { d: ct.d, pathLength: 1, "stroke-dasharray": "1 1", "stroke-dashoffset": 1 };
      var core = svg("path", dash, sub(gNet, "n", kk, SW.net));
      var halo = svg("path", Object.assign({}, dash), sub(gGlow, "g", kk, SW.glow));
      nets.push(core);
      halos.push(halo);
      // draw order: distance of the label point from the view centre (outward sweep)
      var q = ct.c ? scr(ct.c, cam) : [cx, cy];
      var dd = Math.sqrt((q[0] - cx) * (q[0] - cx) + (q[1] - cy) * (q[1] - cy)) / Math.sqrt(cx * cx + cy * cy);
      byIso[ct.iso] = { ct: ct, land: land, core: core, halo: halo, dist: Math.min(1.6, dd), c: ct.c };
    });
    gGlow.setAttribute("opacity", "0.3");

    // stroke widths in map units follow 1 / scale (dash layers cannot use non-scaling strokes)
    function setSW(v, t) {
      subs.forEach(function (x) {
        c.tl.set(x.g, { attr: { "stroke-width": r6(x.px / (v.s * x.k)) } }, t);
      });
    }
    function tweenSW(a, b, t, dur, ease) {
      var N = 10;
      subs.forEach(function (x) {
        var kf = [];
        for (var i = 1; i <= N; i++) {
          var u = ease(i / N);
          var s = a.s + (b.s - a.s) * u;
          kf.push({ attr: { "stroke-width": r6(x.px / (s * x.k)) }, duration: dur / N, ease: "none" });
        }
        c.tl.to(x.g, { keyframes: kf, immediateRender: false }, t);
      });
    }
    setSW(cam, 0);

    // arcs live in screen space above the land; labels / pins / counters in an HTML overlay above that
    div("vig", cam3);
    var ov = div("ov", cam3);
    var items = []; // overlay items that ride the camera: {pt: [x,y], el, kind}
    var arrows = [];
    function scr(pt, v) {
      return [pt[0] * v.s + v.tx, pt[1] * v.s + v.ty];
    }
    function inside(q, mx, my) {
      return q[0] >= mx && q[0] <= w - mx && q[1] >= my && q[1] <= h - my;
    }
    function place(it, t, v) {
      var q = scr(it.pt, v || cam);
      c.tl.set(it.el, { x: r1(q[0] + (it.dx || 0)), y: r1(q[1] + (it.dy || 0)) }, t);
    }
    function typeOn(node, text, t, cps) {
      text = String(text || "");
      var proxy = { n: 0 };
      c.tl.set(node, { textContent: "" }, 0);
      c.tl.to(
        proxy,
        {
          n: text.length,
          duration: Math.max(0.2, text.length / (cps || 38)),
          ease: "none",
          immediateRender: false,
          onUpdate: function () {
            node.textContent = text.slice(0, Math.round(proxy.n));
          },
        },
        t
      );
    }

    // ---- deterministic label layout: every label / chip / card claims its screen rect (at the camera it
    // appears under); a new one takes the first candidate spot that overlaps nothing already claimed ----
    var claimed = [];
    function hits(r) {
      return claimed.some(function (o) {
        return r[0] < o[0] + o[2] && o[0] < r[0] + r[2] && r[1] < o[1] + o[3] && o[1] < r[1] + r[3];
      });
    }
    function fits(r) {
      return r[0] >= 8 && r[1] >= 8 && r[0] + r[2] <= w - 8 && r[1] + r[3] <= h - 8;
    }
    /** candidates: [[dx, dy, extra...]] relative to origin q, box size bw x bh; returns the chosen candidate */
    function choose(q, bw, bh, cands) {
      var pick = null;
      for (var i = 0; i < cands.length && !pick; i++) {
        var r = [q[0] + cands[i][0], q[1] + cands[i][1], bw, bh];
        if (fits(r) && !hits(r)) pick = cands[i];
      }
      if (!pick) {
        // nothing is free: the fitting spot with the least overlap
        var best = Infinity;
        cands.forEach(function (cd) {
          var r = [q[0] + cd[0], q[1] + cd[1], bw, bh];
          if (!fits(r)) return;
          var ov = 0;
          claimed.forEach(function (o) {
            ov += Math.max(0, Math.min(r[0] + r[2], o[0] + o[2]) - Math.max(r[0], o[0])) * Math.max(0, Math.min(r[1] + r[3], o[1] + o[3]) - Math.max(r[1], o[1]));
          });
          if (ov < best) {
            best = ov;
            pick = cd;
          }
        });
        pick = pick || cands[0];
      }
      claimed.push([q[0] + pick[0], q[1] + pick[1], bw, bh]);
      return pick;
    }
    function claimDot(q, r) {
      claimed.push([q[0] - r, q[1] - r, 2 * r, 2 * r]);
    }

    // ---- the network draws on (and the land materialises) outward from the centre ----
    var drawn = false;
    function drawNetwork(t) {
      if (drawn) return;
      drawn = true;
      var list = Object.keys(byIso).map(function (k) {
        return byIso[k];
      });
      list.forEach(function (b) {
        var at = t + 0.55 * b.dist;
        b.drawEnd = at + 0.85;
        c.tl.fromTo([b.core, b.halo], { attr: { "stroke-dashoffset": 1 } }, { attr: { "stroke-dashoffset": 0 }, duration: 1.1, ease: "power2.inOut", immediateRender: false }, at);
        c.tl.fromTo(b.land, { fill: SEA }, { fill: LAND, duration: 0.7, ease: "power1.out", immediateRender: false }, at + 0.15);
      });
    }
    // before the entrance everything is blank paper
    Object.keys(byIso).forEach(function (k) {
      c.tl.set(byIso[k].land, { fill: SEA }, 0);
    });

    // a fill never starts before that country's materialise tween ends (a later-starting tween would lose)
    function after(iso, t) {
      var b = byIso[iso];
      return b && b.drawEnd ? Math.max(t, b.drawEnd) : t;
    }
    function fillTo(iso, color, t, dur) {
      var pe = paths[iso];
      if (!pe) throw new Error(kind + ": country " + iso + " is not in this map's view");
      c.tl.to(pe, { fill: color, duration: dur === undefined ? 0.3 : dur, ease: "power2.out" }, after(iso, t));
    }
    var labelsByIso = {};
    function label(text, at, t, iso, onTone) {
      if (!at || !text) return;
      var lb = div("clab" + (onTone ? " on" : ""), ov, text);
      if (iso) labelsByIso[iso] = lb;
      var tw = L.measure(String(text).toUpperCase(), 800, 19) * 1.14 + 6;
      var q = scr(at, cam);
      // nudge off anything already claimed (another label, a pin); give up (hide) when nothing fits
      var dy = null;
      [0, -30, 30, -58, 58].forEach(function (d) {
        if (dy === null && !hits([q[0] - tw / 2, q[1] - 13 + d, tw, 26])) dy = d;
      });
      var it = { pt: at, el: lb, dx: -tw / 2, dy: -13 + (dy || 0), w: tw, kind: "label" };
      items.push(it);
      place(it, 0);
      c.tl.set(lb, { autoAlpha: 0 }, 0);
      var ok = dy !== null && inside([q[0], q[1] + dy], tw / 2 + 8, 24);
      if (ok) claimed.push([q[0] - tw / 2, q[1] - 13 + dy, tw, 26]);
      if (ok) c.tl.fromTo(lb, { autoAlpha: 0, y: "+=6" }, { autoAlpha: 1, y: "-=6", duration: 0.3, ease: "power2.out", immediateRender: false }, t);
      it.visible = ok;
    }
    // a label sitting on a toned country turns white (class swap at the fill's start: seek-safe)
    function labelTone(iso, on, t) {
      var lb = labelsByIso[iso];
      if (lb) c.tl.set(lb, { attr: { class: on ? "clab on" : "clab" } }, t);
    }

    // ---- focus: lift + gradient + glowing edge; the rest fades ----
    var lifted = {};
    var faded = false;
    function fadeOthers(t) {
      if (faded) return;
      faded = true;
      Object.keys(byIso).forEach(function (k) {
        if (!lifted[k]) c.tl.to(byIso[k].land, { fill: LAND_FADE, duration: 0.5, ease: "power2.out" }, after(k, t));
      });
      c.tl.to(gNet, { opacity: 0.6, duration: 0.5 }, t);
      c.tl.to(gGlow, { opacity: 0.2, duration: 0.5 }, t);
    }
    function lift(iso, col, t) {
      var b = byIso[iso];
      if (!b) throw new Error(kind + ": country " + iso + " is not in this map's view");
      if (lifted[iso]) {
        c.tl.to(lifted[iso].g, { autoAlpha: 1, duration: 0.3 }, t);
        return;
      }
      var gid = id + "g" + iso;
      var gr = svg("linearGradient", { id: gid, x1: "0", y1: "0", x2: "0.35", y2: "1" }, defs);
      svg("stop", { offset: "0", "stop-color": mix(col, "#ffffff", 0.28) }, gr);
      svg("stop", { offset: "1", "stop-color": mix(col, "#08162e", 0.12) }, gr);
      var o = b.c || [0, 0];
      var og = "translate(" + r1(o[0]) + " " + r1(o[1]) + ")";
      var g = svg("g", { transform: og + " scale(1) translate(" + r1(-o[0]) + " " + r1(-o[1]) + ")" }, gLift);
      var a = { d: b.ct.d, fill: "url(#" + gid + ")", stroke: mix(col, "#ffffff", 0.55), "stroke-width": 1.6, "vector-effect": "non-scaling-stroke", "stroke-linejoin": "round" };
      if (b.ct.k && b.ct.k !== 1) a.transform = "scale(" + b.ct.k + ")";
      svg("path", a, g);
      // the brighter glowing edge (halo layer, own width: non-scaling, no dashes)
      var ha = { d: b.ct.d, fill: "none", stroke: glow, "stroke-width": 11, "vector-effect": "non-scaling-stroke", "stroke-linejoin": "round", opacity: 0 };
      if (b.ct.k && b.ct.k !== 1) ha.transform = "scale(" + b.ct.k + ")";
      var edge = svg("path", ha, gTop);
      lifted[iso] = { g: g, edge: edge };
      c.tl.set(g, { autoAlpha: 0 }, 0);
      c.tl.fromTo(g, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.35, ease: "power2.out", immediateRender: false }, t);
      c.tl.fromTo(g, { attr: { transform: og + " scale(1) translate(" + r1(-o[0]) + " " + r1(-o[1]) + ")" } }, { attr: { transform: og + " scale(1.03) translate(" + r1(-o[0]) + " " + r1(-o[1]) + ")" }, duration: 0.7, ease: "back.out(1.6)", immediateRender: false }, t);
      c.tl.fromTo(edge, { attr: { opacity: 0 } }, { attr: { opacity: 1 }, duration: 0.45, ease: "power2.out", immediateRender: false }, t + 0.1);
      c.tl.to(edge, { attr: { opacity: 0.62 }, duration: 0.8, ease: "sine.inOut" }, t + 0.6);
      c.tl.set(b.land, { fill: LAND_FADE }, after(iso, t + 0.2));
    }

    function highlight(v, t) {
      var col = v.tone === "none" ? null : L.tone(v.tone || "blue", T.blue);
      if (col) {
        fadeOthers(t);
        lift(v.iso, col, t);
        labelTone(v.iso, true, t);
      }
      if (v.label && !labelsByIso[v.iso]) label(v.label.text, v.label.at, t + 0.25, v.iso, !!col);
    }
    function unlift(iso, t) {
      var lf = lifted[iso];
      if (lf) {
        c.tl.to(lf.g, { autoAlpha: 0, duration: 0.3 }, t);
        c.tl.to(lf.edge, { attr: { opacity: 0 }, duration: 0.3 }, t);
      }
      fillTo(iso, faded ? LAND_FADE : LAND, t);
      labelTone(iso, false, t);
    }

    // ---- pins: dot + double pulsing rings + leader line with a typed label ----
    function pin(v, t) {
      var col = L.tone(v.tone || "red", T.red);
      var pe = div("pin", ov);
      pe.style.setProperty("--pc", col);
      pe.style.setProperty("--pg", rgba(col, 0.55));
      var r1e = div("ring", pe);
      var r2e = div("ring", pe);
      var dot = div("dot", pe);
      var it = { pt: v.at, el: pe, kind: "pin" };
      items.push(it);
      place(it, 0);
      c.tl.set(pe, { autoAlpha: 0 }, 0);
      c.tl.set(pe, { autoAlpha: 1 }, t);
      c.tl.fromTo(dot, { scale: 0 }, { scale: 1, duration: 0.35, ease: "back.out(2.4)", immediateRender: false }, t);
      // finite pulse: until the end of the composition (hidden once the module leaves)
      var period = 1.8;
      var reps = Math.max(0, Math.min(40, Math.floor((c.duration - t - 0.2) / period) - 1));
      [r1e, r2e].forEach(function (rg, k) {
        c.tl.set(rg, { autoAlpha: 0 }, 0);
        c.tl.fromTo(rg, { autoAlpha: 0.85, scale: 1 }, { autoAlpha: 0, scale: 3.4, duration: period, ease: "power1.out", repeat: reps, immediateRender: false }, t + 0.1 + (k * period) / 2);
      });
      var q0 = scr(v.at, cam);
      claimDot(q0, 12);
      if (v.label) {
        var q = q0;
        var tw = L.measure(v.label, 800, 22) + 8;
        // leader up-right, up-left, down-right, down-left (sx, sy)
        var cand = choose(q, tw, 34, [
          [44, -47, 1, -1],
          [-44 - tw, -47, -1, -1],
          [44, 13, 1, 1],
          [-44 - tw, 13, -1, 1],
          [60, -80, 1, -2],
          [-60 - tw, -80, -1, -2],
        ]);
        var sx = cand[2];
        var sy = cand[3];
        var ln = svg("svg", { width: 1, height: 1 }, pe);
        var ly = sy === -2 ? -63 : 30 * sy;
        var lx = sy === -2 ? 46 : 30;
        var leader = svg("path", { d: "M" + 6 * sx + " " + 6 * Math.sign(sy) + " L" + lx * sx + " " + ly + " L" + (lx + 10) * sx + " " + ly, fill: "none", stroke: INK, "stroke-width": 1.5, "stroke-linecap": "round", "stroke-linejoin": "round", pathLength: 1, "stroke-dasharray": "1 1", "stroke-dashoffset": 1 }, ln);
        var lbl = div("lbl", pe, "");
        lbl.style.left = cand[0] + (sy === -2 ? (sx > 0 ? -2 : 2) : 0) + "px";
        if (sx < 0) lbl.style.textAlign = "right";
        lbl.style.width = tw + "px";
        lbl.style.top = ly - 17 + "px";
        c.tl.fromTo(leader, { attr: { "stroke-dashoffset": 1 } }, { attr: { "stroke-dashoffset": 0 }, duration: 0.25, ease: "power2.out", immediateRender: false }, t + 0.18);
        typeOn(lbl, v.label, t + 0.36);
      }
    }

    // ---- arcs: gradient trail + glow + comet head ----
    function curve(a, b, bend, v) {
      var p0 = scr(a, v);
      var p1 = scr(b, v);
      var mx = (p0[0] + p1[0]) / 2;
      var my = (p0[1] + p1[1]) / 2;
      var dx = p1[0] - p0[0];
      var dy = p1[1] - p0[1];
      // bend to the left of travel (arcs "up" for a west -> east flow)
      return { p0: p0, p1: p1, c: [mx + dy * bend, my - dx * bend] };
    }
    function dOf(k) {
      return "M" + r1(k.p0[0]) + " " + r1(k.p0[1]) + " Q" + r1(k.c[0]) + " " + r1(k.c[1]) + " " + r1(k.p1[0]) + " " + r1(k.p1[1]);
    }
    function at(k, u) {
      return [(1 - u) * (1 - u) * k.p0[0] + 2 * (1 - u) * u * k.c[0] + u * u * k.p1[0], (1 - u) * (1 - u) * k.p0[1] + 2 * (1 - u) * u * k.c[1] + u * u * k.p1[1]];
    }
    function headOf(k) {
      var a = (Math.atan2(k.p1[1] - k.c[1], k.p1[0] - k.c[0]) * 180) / Math.PI;
      return "translate(" + r1(k.p1[0]) + " " + r1(k.p1[1]) + ") rotate(" + r1(a) + ")";
    }
    function gradOf(gr, k) {
      return { x1: r1(k.p0[0]), y1: r1(k.p0[1]), x2: r1(k.p1[0]), y2: r1(k.p1[1]) };
    }
    function arrow(v, t) {
      var col = L.tone(v.tone || "blue", T.blue);
      var k = curve(v.from, v.to, v.bend === undefined ? 0.22 : v.bend, cam);
      var gid = id + "a" + arrows.length;
      var gr = svg("linearGradient", Object.assign({ id: gid, gradientUnits: "userSpaceOnUse" }, gradOf(null, k)), defs);
      svg("stop", { offset: "0", "stop-color": col, "stop-opacity": 0.12 }, gr);
      svg("stop", { offset: "0.55", "stop-color": col, "stop-opacity": 0.6 }, gr);
      svg("stop", { offset: "1", "stop-color": mix(col, glow, 0.35), "stop-opacity": 1 }, gr);
      var halo = svg("path", { d: dOf(k), fill: "none", stroke: glow, "stroke-width": 9, "stroke-linecap": "round", opacity: 0.55, pathLength: 1, "stroke-dasharray": "1 1", "stroke-dashoffset": 1 }, sAGlow);
      var line = svg("path", { d: dOf(k), fill: "none", stroke: "url(#" + gid + ")", "stroke-width": 4, "stroke-linecap": "round", pathLength: 1, "stroke-dasharray": "1 1", "stroke-dashoffset": 1 }, sArc);
      var head = svg("g", { transform: headOf(k) }, sArc);
      var headP = svg("path", { d: "M-15 -9 L2 0 L-15 9 L-11 0 Z", fill: col, stroke: "#fff", "stroke-width": 1.5, "stroke-linejoin": "round" }, head);
      var cg = svg("circle", { r: 15, fill: glow, opacity: 0.9, cx: 0, cy: 0 }, sAGlow);
      var comet = svg("g", {}, sArc);
      svg("circle", { r: 6.5, fill: "#fff", stroke: mix(col, glow, 0.4), "stroke-width": 3.5 }, comet);
      var DUR = 1.1;
      [halo, line].forEach(function (pe) {
        c.tl.fromTo(pe, { attr: { "stroke-dashoffset": 1 } }, { attr: { "stroke-dashoffset": 0 }, duration: DUR, ease: "power1.inOut", immediateRender: false }, t);
      });
      var ar = { v: v, k: k, halo: halo, line: line, head: head, grad: gr, comet: comet, cg: cg };
      // the comet rides the curve (onUpdate renders only this tween's progress: seek-safe)
      var proxy = { u: 0 };
      var k0 = k; // the travel follows the curve as drawn (a later zoomTo re-targets ar.k)
      var put = function () {
        var q = at(k0, proxy.u);
        comet.setAttribute("transform", "translate(" + r1(q[0]) + " " + r1(q[1]) + ")");
        cg.setAttribute("transform", "translate(" + r1(q[0]) + " " + r1(q[1]) + ")");
      };
      put();
      [comet, cg].forEach(function (n) {
        c.tl.set(n, { autoAlpha: 0 }, 0);
        c.tl.set(n, { autoAlpha: 1 }, t);
      });
      c.tl.to(proxy, { u: 1, duration: DUR, ease: "power1.inOut", immediateRender: false, onUpdate: put }, t);
      c.tl.to(comet, { autoAlpha: 0, duration: 0.25 }, t + DUR);
      c.tl.to(cg, { autoAlpha: 0, duration: 0.5 }, t + DUR);
      c.tl.set(head, { autoAlpha: 0 }, 0);
      if (!v.route) {
        c.tl.set(head, { autoAlpha: 1 }, t + DUR - 0.08);
        c.tl.fromTo(headP, { attr: { transform: "scale(0.3)" } }, { attr: { transform: "scale(1)" }, duration: 0.3, ease: "back.out(2.2)", immediateRender: false }, t + DUR - 0.08);
      }
      // the destination flashes a ring as the comet lands
      var land = svg("circle", { r: 8, fill: "none", stroke: glow, "stroke-width": 3, cx: r1(k.p1[0]), cy: r1(k.p1[1]) }, sArc);
      c.tl.set(land, { autoAlpha: 0 }, 0);
      c.tl.fromTo(land, { autoAlpha: 0.9, attr: { r: 8 } }, { autoAlpha: 0, attr: { r: 40 }, duration: 0.7, ease: "power2.out", immediateRender: false }, t + DUR - 0.05);
      ar.land = land;
      arrows.push(ar);
      if (v.label) {
        var tw = L.measure(v.label, 750, 20) + 32;
        var best = [0.5, 0.38, 0.62, 0.28, 0.72];
        var mid = at(k, 0.5);
        for (var bi = 0; bi < best.length; bi++) {
          var mq = at(k, best[bi]);
          if (!hits([mq[0] - tw / 2, mq[1] - 49, tw, 38]) && fits([mq[0] - tw / 2, mq[1] - 49, tw, 38])) {
            mid = mq;
            break;
          }
        }
        claimed.push([mid[0] - tw / 2, mid[1] - 49, tw, 38]);
        var holder = div("pin", ov);
        holder.style.setProperty("--pc", col);
        holder.style.setProperty("--pg", rgba(glow, 0.25));
        var chip = div("chip", holder, "");
        chip.style.left = -tw / 2 + "px";
        chip.style.width = tw + "px";
        var geoMid = [(mid[0] - cam.tx) / cam.s, (mid[1] - cam.ty) / cam.s];
        var it = { pt: geoMid, el: holder, dy: -30, kind: "arrowLabel" };
        items.push(it);
        place(it, 0);
        c.tl.set(holder, { autoAlpha: 0 }, 0);
        c.tl.fromTo(holder, { autoAlpha: 0, scale: 0.85 }, { autoAlpha: 1, scale: 1, duration: 0.25, ease: "back.out(1.8)", immediateRender: false }, t + 0.5);
        typeOn(chip, v.label, t + 0.6);
      }
    }

    // ---- frosted counters ----
    function counter(v, t) {
      var col = L.tone(v.tone || "blue", T.blue);
      var holder = div("pin", ov);
      var card = div("ctr", holder);
      card.style.setProperty("--pc", col);
      card.style.setProperty("--pg", rgba(glow, 0.18));
      if (v.label) div("k", card, v.label);
      var val = div("v", card, "");
      var fmt = function (x) {
        return (v.prefix || "") + L.fmtNum(x, v.decimals || 0, "intl") + (v.suffix || "");
      };
      var tw = Math.max(L.measure(fmt(v.value), 800, 44), L.measure(String(v.label || "").toUpperCase(), 700, 14, MONO) * 1.2) + 40;
      var q = scr(v.at, cam);
      var bh = v.label ? 92 : 70;
      var cd = choose(q, tw, bh, [
        [26, -bh - 20],
        [-26 - tw, -bh - 20],
        [26, 22],
        [-26 - tw, 22],
        [60, -bh / 2],
        [-60 - tw, -bh / 2],
        [-tw / 2, -bh - 70],
        [-tw / 2, 70],
      ]);
      card.style.left = cd[0] + "px";
      card.style.top = cd[1] + "px";
      var it = { pt: v.at, el: holder, kind: "counter" };
      items.push(it);
      place(it, 0);
      c.tl.set(holder, { autoAlpha: 0 }, 0);
      c.tl.fromTo(holder, { autoAlpha: 0, y: "+=10" }, { autoAlpha: 1, y: "-=10", duration: 0.35, ease: "power3.out", immediateRender: false }, t);
      var proxy = { x: v.from || 0 };
      c.tl.set(val, { textContent: fmt(v.from || 0) }, 0);
      c.tl.to(proxy, { x: v.value, duration: 1.2, ease: "power2.out", immediateRender: false, onUpdate: function () { val.textContent = fmt(proxy.x); } }, t + 0.15);
    }

    var legendEl = null;
    var srcEl = null;
    function source(text, t) {
      if (!text) return;
      if (!srcEl) {
        srcEl = div("src", el, "");
        c.tl.set(srcEl, { autoAlpha: 0 }, 0);
      }
      c.tl.set(srcEl, { textContent: "Source: " + text }, t);
      c.tl.to(srcEl, { autoAlpha: 1, duration: 0.2 }, t);
    }
    // west -> east order from the paths' own first move-to (deterministic, no layout reads)
    var firstX = {};
    var xmin = Infinity;
    var xmax = -Infinity;
    (geo.countries || []).forEach(function (ct) {
      var m = /^M(-?\d+)/.exec(ct.d || "");
      if (!m) return;
      var x = Number(m[1]) * (ct.k || 1);
      firstX[ct.iso] = x;
      xmin = Math.min(xmin, x);
      xmax = Math.max(xmax, x);
    });
    function choropleth(v, t) {
      if (!v) return;
      var top = v.colors.length - 1;
      Object.keys(v.cls)
        .filter(function (k) {
          return paths[k];
        })
        .forEach(function (iso) {
          var x = firstX[iso];
          var f = x === undefined ? 0.5 : Math.max(0, Math.min(1, (x - xmin) / (xmax - xmin || 1)));
          var tt = t + 0.8 * f;
          fillTo(iso, v.colors[v.cls[iso]], tt, 0.35);
          // the highest class glows softly
          if (v.cls[iso] === top) {
            var b = byIso[iso];
            var ha = { d: b.ct.d, fill: "none", stroke: glow, "stroke-width": 5, "vector-effect": "non-scaling-stroke", opacity: 0 };
            if (b.ct.k && b.ct.k !== 1) ha.transform = "scale(" + b.ct.k + ")";
            var hot = svg("path", ha, gTop);
            c.tl.to(hot, { attr: { opacity: 0.9 }, duration: 0.5, ease: "power2.out" }, tt + 0.25);
          }
        });
      if (!legendEl) {
        legendEl = div("legend", el);
        c.tl.set(legendEl, { autoAlpha: 0 }, 0);
      }
      legendEl.textContent = "";
      if (v.title) div("lt", legendEl, v.title);
      if (v.unit) div("lu", legendEl, v.unit + (v.year ? " · " + v.year : ""));
      var row = div("row", legendEl);
      v.colors.forEach(function (col) {
        var sw = div("sw", row);
        var sq = document.createElement("i");
        sq.style.background = col;
        sw.appendChild(sq);
      });
      Array.prototype.forEach.call(row.children, function (sw, i) {
        div("", sw, v.labels[i]);
      });
      var nd = div("sw", row);
      var sq2 = document.createElement("i");
      sq2.style.background = LAND;
      nd.appendChild(sq2);
      div("", nd, "no data");
      c.tl.fromTo(legendEl, { autoAlpha: 0, y: 8 }, { autoAlpha: 1, y: 0, duration: 0.25, immediateRender: false }, t + 0.3);
      source(v.source, t + 0.3);
    }

    function zoomTo(v, t) {
      var to = camera(v.view);
      var dur = v.dur || 1.2;
      var ease = "power2.inOut";
      cams.forEach(function (g) {
        c.tl.fromTo(g, { attr: { transform: tf(cam) } }, { attr: { transform: tf(to) }, duration: dur, ease: ease, immediateRender: false }, t);
      });
      tweenSW(cam, to, t, dur, p2io);
      items.forEach(function (it) {
        var a = scr(it.pt, cam);
        var b = scr(it.pt, to);
        c.tl.fromTo(it.el, { x: r1(a[0] + (it.dx || 0)), y: r1(a[1] + (it.dy || 0)) }, { x: r1(b[0] + (it.dx || 0)), y: r1(b[1] + (it.dy || 0)), duration: dur, ease: ease, immediateRender: false }, t);
        // anything the new view pushes off the map fades out; labels that come into view fade in
        var inNow = it.kind === "label" ? inside(b, it.w / 2 + 8, 24) : inside(b, 20, 20);
        if (!inNow) c.tl.to(it.el, { autoAlpha: 0, duration: Math.min(0.3, dur / 3) }, t);
        else if (it.kind === "label" && !it.visible) c.tl.to(it.el, { autoAlpha: 1, duration: 0.25 }, t + dur - 0.25);
        if (it.kind === "label") it.visible = inNow;
      });
      arrows.forEach(function (ar) {
        var k2 = curve(ar.v.from, ar.v.to, ar.v.bend === undefined ? 0.22 : ar.v.bend, to);
        [ar.halo, ar.line].forEach(function (pe) {
          c.tl.fromTo(pe, { attr: { d: dOf(ar.k) } }, { attr: { d: dOf(k2) }, duration: dur, ease: ease, immediateRender: false }, t);
        });
        c.tl.fromTo(ar.grad, { attr: gradOf(null, ar.k) }, { attr: gradOf(null, k2), duration: dur, ease: ease, immediateRender: false }, t);
        c.tl.fromTo(ar.head, { attr: { transform: headOf(ar.k) } }, { attr: { transform: headOf(k2) }, duration: dur, ease: ease, immediateRender: false }, t);
        c.tl.fromTo(ar.land, { attr: { cx: r1(ar.k.p1[0]), cy: r1(ar.k.p1[1]) } }, { attr: { cx: r1(k2.p1[0]), cy: r1(k2.p1[1]) }, duration: dur, ease: ease, immediateRender: false }, t);
        ar.k = k2;
      });
      cam = to;
    }

    var entered = false;
    var legs = (p.arrows || []).filter(function (a) {
      return a.route;
    });
    var flows = (p.arrows || []).filter(function (a) {
      return !a.route;
    });
    function drawLeg(i, t) {
      var a = legs[i - 1];
      if (!a) throw new Error(kind + ": no leg " + i + " (" + legs.length + " legs)");
      if (a.drawn) return;
      a.drawn = true;
      arrow(a, t);
    }
    return {
      enter: function (t, recipe, run) {
        L.enterRecipe(c, el, t, recipe);
        if (entered) return; // a map persisting across scaffolds sets its initial state once
        entered = true;
        // slow push-in over the run (the whole map + overlays, about the view centre)
        if (p.push !== false) {
          var end = Math.max(t + 1, (run && run.t1) || c.duration);
          c.tl.set(cam3, { scale: 1, transformOrigin: "50% 50%" }, 0);
          c.tl.fromTo(cam3, { scale: 1 }, { scale: 1.035, duration: end - t, ease: "none", immediateRender: false }, t);
        }
        drawNetwork(t);
        var t0 = t + 0.35;
        if (p.introView) zoomTo({ view: p.view, dur: 1.9 }, t + 0.45);
        // pin dots are fixed points: claim them before any label is placed
        (p.pins || []).forEach(function (v) {
          claimDot(scr(v.at, cam), 12);
        });
        if (p.introView) {
          // the establishing flight: wide -> the view, while the borders draw
          t0 = t + 2.35;
        }
        (p.highlight || []).forEach(function (v, i) {
          highlight(v, t0 + 0.1 * i);
        });
        if (p.choropleth) choropleth(p.choropleth, t0);
        var pins = p.pins || [];
        pins.forEach(function (v, i) {
          pin(v, t0 + 0.25 + (v.stop ? 0.9 * i : 0.15 * i));
        });
        flows.forEach(function (v, i) {
          arrow(v, t0 + 0.5 + 0.35 * i);
        });
        if (p.auto !== false)
          legs.forEach(function (v, i) {
            drawLeg(i + 1, t0 + 0.55 + 0.9 * i);
          });
        (p.counters || []).forEach(function (v, i) {
          counter(v, t0 + 0.7 + 0.2 * i);
        });
        if (p.source) source(p.source, t0);
      },
      ops: {
        highlight: function (e) {
          highlight(e.value || {}, e.t);
        },
        dim: function (e) {
          unlift((e.value || {}).iso, e.t);
        },
        pin: function (e) {
          pin(e.value || {}, e.t);
        },
        arrow: function (e) {
          arrow(e.value || {}, e.t);
        },
        leg: function (e) {
          drawLeg(Number((e.value || {}).i) || 1, e.t);
        },
        zoomTo: function (e) {
          zoomTo(e.value || {}, e.t);
        },
        choropleth: function (e) {
          choropleth(e.value, e.t);
        },
        counter: function (e) {
          counter(e.value || {}, e.t);
        },
      },
    };
  }

  M.worldMap = {
    enter: "fade",
    build: function (el, p, c) {
      return build(el, p, c, "worldMap");
    },
  };
  M.countryMap = {
    enter: "fade",
    build: function (el, p, c) {
      return build(el, p, c, "countryMap");
    },
  };
  M.routeMap = {
    enter: "fade",
    build: function (el, p, c) {
      return build(el, p, c, "routeMap");
    },
  };
})(typeof window !== "undefined" ? window : globalThis);
