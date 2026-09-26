/*
 * HFStage LF maps (plan §3): worldMap / countryMap, vector countries from Natural Earth (public domain).
 * The compiler (orchestrator/lib/video/v3/geo.js) does all the geography: it projects every point, fits
 * every view to the module rect and ships only the country paths the module can show. This file only draws.
 *
 *   props (compiled)  geo: {units, countries: [{iso, n, d, k}]}, view: [x, y, w, h] (map units),
 *                     highlight: [{iso, tone, label?: {text, at}}], pins: [{at, label, tone}],
 *                     arrows: [{from, to, label, tone, bend}], choropleth: {cls: {ISO3: i}, colors, labels, title, unit, source, year} | null,
 *                     card?: true (paper card; false = land straight on the plate), source?: string
 *   ops               highlight {iso, tone, label?}  fill tweens to the tone (220 ms)
 *                     dim {iso}                      back to plain land
 *                     pin {at, label, tone}          dot pops, ring pulses once, label chip lands
 *                     arrow {from, to, label, tone, bend}   curved flow line draws on (0.9 s), head + label land
 *                     zoomTo {view, dur}             the camera moves (power2.inOut); pins/labels/arrows ride along
 *                     choropleth {cls, colors, ...}  countries fill west -> east over 0.8 s, legend + source land
 * Seek-safe: every change is a tl.set / finite tween at an explicit time; no randomness, no callbacks.
 * Zoom math: screen = s * P + t is linear in (s, t), so overlay items tweened with the same ease and
 * duration as the map group stay glued to their geography at every frame.
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

  var LAND = "#e2dfd5";
  var LAND_EDGE = "#fbfaf6";
  var SEA = T.card;
  var P = "html [data-profile=LF] ";
  var CSS = [
    P + ".lf-map{overflow:visible;}",
    P + ".lf-map .plate{position:absolute;inset:0;border-radius:14px;overflow:hidden;}",
    P + ".lf-map .plate.card{background:" + SEA + ";border:1.5px solid " + T.line + ";box-shadow:0 10px 30px rgba(30,28,20,.07),0 1px 3px rgba(30,28,20,.05);}",
    P + ".lf-map .ov{position:absolute;left:0;top:0;width:0;height:0;}",
    P + ".lf-map .clab{position:absolute;left:0;top:0;white-space:nowrap;font-size:19px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:" + T.ink + ";text-shadow:0 0 3px " + SEA + ",0 0 3px " + SEA + ",0 0 6px " + SEA + ";}",
    P + ".lf-map .clab.on{color:#fff;text-shadow:0 1px 2px rgba(10,20,30,.45),0 0 8px rgba(10,20,30,.25);}",
    P + ".lf-map .pin{position:absolute;left:0;top:0;width:0;height:0;}",
    P + ".lf-map .pin .dot{position:absolute;left:-9px;top:-9px;width:18px;height:18px;border-radius:50%;background:var(--pc);border:3.5px solid #fff;box-shadow:0 2px 6px rgba(20,20,10,.3);}",
    P + ".lf-map .pin .ring{position:absolute;left:-9px;top:-9px;width:18px;height:18px;border-radius:50%;border:3px solid var(--pc);}",
    P + ".lf-map .chip{position:absolute;top:-19px;height:38px;display:flex;align-items:center;padding:0 13px;border-radius:9px;background:" + T.card + ";border:2px solid var(--pc," + T.ink + ");box-shadow:0 8px 20px rgba(20,20,10,.14);font-size:21px;font-weight:700;color:" + T.ink + ";white-space:nowrap;}",
    P + ".lf-map .legend{position:absolute;left:22px;bottom:50px;padding:12px 14px 10px;border-radius:10px;background:rgba(255,254,251,.94);border:1.5px solid " + T.line + ";}",
    P + ".lf-map .legend .lt{font-size:17px;font-weight:800;color:" + T.ink + ";white-space:nowrap;margin-bottom:2px;}",
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

  function build(el, p, c, kind) {
    el.classList.add("lf-map");
    var w = L.W(el);
    var h = L.H(el);
    var geo = p.geo || { countries: [] };
    var plate = div("plate" + (p.card === false ? "" : " card"), el);
    var s = svg("svg", { width: w, height: h, viewBox: "0 0 " + w + " " + h, style: "position:absolute;left:0;top:0;" }, plate);
    var g = svg("g", {}, s);
    function camera(view) {
      var sc = Math.min(w / view[2], h / view[3]);
      return { s: sc, tx: -view[0] * sc + (w - view[2] * sc) / 2, ty: -view[1] * sc + (h - view[3] * sc) / 2 };
    }
    var cam = camera(p.view || [0, 0, 1, 1]);
    g.setAttribute("transform", tf(cam));
    var paths = {};
    (geo.countries || []).forEach(function (ct) {
      var el2 = svg("path", { d: ct.d, "vector-effect": "non-scaling-stroke", "stroke-width": 1, stroke: LAND_EDGE, "stroke-linejoin": "round" }, g);
      if (ct.k && ct.k !== 1) el2.setAttribute("transform", "scale(" + ct.k + ")");
      el2.style.fill = LAND;
      paths[ct.iso] = el2;
      c.entity(ct.iso, el2);
    });
    // arrows live in screen space above the land, labels / pins in an HTML overlay above that
    var arrowSvg = svg("svg", { width: w, height: h, viewBox: "0 0 " + w + " " + h, style: "position:absolute;left:0;top:0;overflow:hidden;" }, plate);
    var ov = div("ov", el);
    var items = []; // overlay items that ride the camera: {pt: [x,y], el, kind}
    var arrows = [];
    function scr(pt, v) {
      return [pt[0] * v.s + v.tx, pt[1] * v.s + v.ty];
    }
    function inside(q, mx, my) {
      return q[0] >= mx && q[0] <= w - mx && q[1] >= my && q[1] <= h - my;
    }
    function place(it, t) {
      var q = scr(it.pt, cam);
      c.tl.set(it.el, { x: r1(q[0] + (it.dx || 0)), y: r1(q[1] + (it.dy || 0)) }, t);
    }

    function fillTo(iso, color, t, dur) {
      var pe = paths[iso];
      if (!pe) throw new Error(kind + ": country " + iso + " is not in this map's view");
      c.tl.to(pe, { fill: color, duration: dur === undefined ? 0.22 : dur, ease: "power2.out" }, t);
    }
    var labelsByIso = {};
    function label(text, at, t, iso, onTone) {
      if (!at || !text) return;
      var lb = div("clab" + (onTone ? " on" : ""), ov, text);
      if (iso) labelsByIso[iso] = lb;
      var tw = L.measure(String(text).toUpperCase(), 800, 19) * 1.12 + 6;
      var it = { pt: at, el: lb, dx: -tw / 2, dy: -13, w: tw, kind: "label" };
      items.push(it);
      place(it, 0);
      c.tl.set(lb, { autoAlpha: 0 }, 0);
      var q = scr(at, cam);
      if (inside(q, tw / 2 + 8, 24)) c.tl.to(lb, { autoAlpha: 1, duration: 0.2 }, t);
      it.visible = inside(q, tw / 2 + 8, 24);
    }
    // a label sitting on a toned country turns white (class swap at the fill's start: seek-safe)
    function labelTone(iso, on, t) {
      var lb = labelsByIso[iso];
      if (lb) c.tl.set(lb, { attr: { class: on ? "clab on" : "clab" } }, t);
    }
    function highlight(v, t) {
      var col = v.tone === "none" ? null : L.tone(v.tone || "blue", T.blue);
      if (col) {
        fillTo(v.iso, col, t);
        labelTone(v.iso, true, t);
      }
      if (v.label && !labelsByIso[v.iso]) label(v.label.text, v.label.at, t + 0.1, v.iso, !!col);
    }
    function pin(v, t) {
      var col = L.tone(v.tone || "red", T.red);
      var pe = div("pin", ov);
      pe.style.setProperty("--pc", col);
      var ring = div("ring", pe);
      var dot = div("dot", pe);
      var it = { pt: v.at, el: pe, kind: "pin" };
      items.push(it);
      place(it, 0);
      c.tl.set(pe, { autoAlpha: 0 }, 0);
      c.tl.set(pe, { autoAlpha: 1 }, t);
      c.tl.fromTo(dot, { scale: 0 }, { scale: 1, duration: 0.3, ease: "back.out(2.2)", immediateRender: false }, t);
      c.tl.set(ring, { autoAlpha: 0 }, 0);
      c.tl.fromTo(ring, { autoAlpha: 0.9, scale: 1 }, { autoAlpha: 0, scale: 3.2, duration: 0.7, ease: "power2.out", immediateRender: false }, t + 0.12);
      if (v.label) {
        var tw = L.measure(v.label, 700, 21) + 30;
        var q = scr(v.at, cam);
        var chip = div("chip", pe, v.label);
        // the chip goes right of the dot unless that runs off the map
        var left = q[0] + 20 + tw < w - 12 ? 20 : -20 - tw;
        chip.style.left = left + "px";
        c.tl.set(chip, { autoAlpha: 0 }, 0);
        c.tl.fromTo(chip, { autoAlpha: 0, x: left > 0 ? -8 : 8 }, { autoAlpha: 1, x: 0, duration: 0.25, ease: "power2.out", immediateRender: false }, t + 0.18);
      }
    }
    function curve(a, b, bend, v) {
      var p0 = scr(a, v);
      var p1 = scr(b, v);
      var mx = (p0[0] + p1[0]) / 2;
      var my = (p0[1] + p1[1]) / 2;
      var dx = p1[0] - p0[0];
      var dy = p1[1] - p0[1];
      // bend to the left of travel (arcs "up" for a west -> east flow)
      var cx = mx + dy * bend;
      var cy = my - dx * bend;
      return { p0: p0, p1: p1, c: [cx, cy] };
    }
    function dOf(k) {
      return "M" + r1(k.p0[0]) + " " + r1(k.p0[1]) + " Q" + r1(k.c[0]) + " " + r1(k.c[1]) + " " + r1(k.p1[0]) + " " + r1(k.p1[1]);
    }
    function headOf(k) {
      var a = (Math.atan2(k.p1[1] - k.c[1], k.p1[0] - k.c[0]) * 180) / Math.PI;
      return "translate(" + r1(k.p1[0]) + " " + r1(k.p1[1]) + ") rotate(" + r1(a) + ")";
    }
    function qlen(k) {
      var n = 24;
      var len = 0;
      var prev = k.p0;
      for (var i = 1; i <= n; i++) {
        var u = i / n;
        var x = (1 - u) * (1 - u) * k.p0[0] + 2 * (1 - u) * u * k.c[0] + u * u * k.p1[0];
        var y = (1 - u) * (1 - u) * k.p0[1] + 2 * (1 - u) * u * k.c[1] + u * u * k.p1[1];
        len += Math.sqrt((x - prev[0]) * (x - prev[0]) + (y - prev[1]) * (y - prev[1]));
        prev = [x, y];
      }
      return len;
    }
    function arrow(v, t) {
      var col = L.tone(v.tone || "blue", T.blue);
      var k = curve(v.from, v.to, v.bend === undefined ? 0.22 : v.bend, cam);
      var len = qlen(k);
      var halo = svg("path", { d: dOf(k), fill: "none", stroke: SEA, "stroke-width": 11, "stroke-linecap": "round", opacity: 0.85, "stroke-dasharray": r1(len) + " " + r1(len + 20) }, arrowSvg);
      var line = svg("path", { d: dOf(k), fill: "none", stroke: col, "stroke-width": 5, "stroke-linecap": "round", "stroke-dasharray": r1(len) + " " + r1(len + 20) }, arrowSvg);
      var head = svg("path", { d: "M-18 -11 L1 0 L-18 11 Z", fill: col, stroke: SEA, "stroke-width": 2, "stroke-linejoin": "round", transform: headOf(k) }, arrowSvg);
      [halo, line].forEach(function (pe) {
        c.tl.set(pe, { attr: { "stroke-dashoffset": r1(len) } }, 0);
        c.tl.to(pe, { attr: { "stroke-dashoffset": 0 }, duration: 0.9, ease: "power1.inOut" }, t);
        // once drawn the dash pattern goes, so a later zoom can stretch the line freely
        c.tl.set(pe, { attr: { "stroke-dasharray": "none" } }, t + 0.9);
      });
      c.tl.set(head, { autoAlpha: 0 }, 0);
      c.tl.fromTo(head, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.12, immediateRender: false }, t + 0.82);
      var ar = { v: v, k: k, halo: halo, line: line, head: head };
      arrows.push(ar);
      if (v.label) {
        // label chip at the curve's midpoint, above the arc
        var mid = [0.25 * k.p0[0] + 0.5 * k.c[0] + 0.25 * k.p1[0], 0.25 * k.p0[1] + 0.5 * k.c[1] + 0.25 * k.p1[1]];
        var tw = L.measure(v.label, 700, 21) + 30;
        var holder = div("pin", ov);
        holder.style.setProperty("--pc", col);
        var chip = div("chip", holder, v.label);
        chip.style.left = -tw / 2 + "px";
        var geoMid = [(mid[0] - cam.tx) / cam.s, (mid[1] - cam.ty) / cam.s];
        var it = { pt: geoMid, el: holder, dy: -30, kind: "arrowLabel" };
        items.push(it);
        place(it, 0);
        c.tl.set(holder, { autoAlpha: 0 }, 0);
        c.tl.fromTo(holder, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.25, immediateRender: false }, t + 0.6);
      }
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
    function choropleth(v, t) {
      if (!v) return;
      // countries fill west -> east over 0.8 s (ordered by each path's first point: deterministic, no layout reads)
      Object.keys(v.cls)
        .filter(function (k) {
          return paths[k];
        })
        .forEach(function (iso) {
          var x = firstX[iso];
          var f = x === undefined ? 0.5 : Math.max(0, Math.min(1, (x - xmin) / (xmax - xmin || 1)));
          fillTo(iso, v.colors[v.cls[iso]], t + 0.8 * f, 0.3);
        });
      if (!legendEl) {
        legendEl = div("legend", el);
        c.tl.set(legendEl, { autoAlpha: 0 }, 0);
      }
      legendEl.textContent = "";
      if (v.title) div("lt", legendEl, v.title);
      if (v.unit) div("lu", legendEl, v.unit + (v.year ? " · " + v.year : ""));
      var row = div("row", legendEl);
      v.colors.forEach(function (col, i) {
        var sw = div("sw", row);
        var sq = document.createElement("i");
        sq.style.background = col;
        sw.appendChild(sq);
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

    function zoomTo(v, t) {
      var to = camera(v.view);
      var dur = v.dur || 1.2;
      var ease = "power2.inOut";
      c.tl.fromTo(g, { attr: { transform: tf(cam) } }, { attr: { transform: tf(to) }, duration: dur, ease: ease, immediateRender: false }, t);
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
        c.tl.fromTo(ar.head, { attr: { transform: headOf(ar.k) } }, { attr: { transform: headOf(k2) }, duration: dur, ease: ease, immediateRender: false }, t);
        ar.k = k2;
      });
      cam = to;
    }

    var entered = false;
    return {
      enter: function (t, recipe) {
        L.enterRecipe(c, el, t, recipe);
        if (entered) return; // a map persisting across scaffolds sets its initial state once
        entered = true;
        (p.highlight || []).forEach(function (v, i) {
          highlight(v, t + 0.25 + 0.1 * i);
        });
        if (p.choropleth) choropleth(p.choropleth, t + 0.25);
        (p.pins || []).forEach(function (v, i) {
          pin(v, t + 0.45 + 0.15 * i);
        });
        (p.arrows || []).forEach(function (v, i) {
          arrow(v, t + 0.6 + 0.3 * i);
        });
        if (p.source) source(p.source, t + 0.25);
      },
      ops: {
        highlight: function (e) {
          highlight(e.value || {}, e.t);
        },
        dim: function (e) {
          fillTo((e.value || {}).iso, LAND, e.t);
          labelTone((e.value || {}).iso, false, e.t);
        },
        pin: function (e) {
          pin(e.value || {}, e.t);
        },
        arrow: function (e) {
          arrow(e.value || {}, e.t);
        },
        zoomTo: function (e) {
          zoomTo(e.value || {}, e.t);
        },
        choropleth: function (e) {
          choropleth(e.value, e.t);
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
})(typeof window !== "undefined" ? window : globalThis);
