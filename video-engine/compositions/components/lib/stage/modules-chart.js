/*
 * HFStage LF charts (plan §3): barChart / lineChart, drawn on words, axis in plain units, a
 * MANDATORY source line (a chart without `source` is a build problem, so the layout audit fails).
 *
 *   barChart  props {title?, unit ("₹ crore"), source, bars:[{label, value, display?, tone?}] (2-8),
 *                    accent?: 1-based bar in blue, yMax?, decimals?, grouping?: intl|in, hidden?: false}
 *             ops   draw {bar?} (bars grow 500 ms power3.out, value labels land), annotate {bar, text, tone?},
 *                   tone {bar, tone}
 *   lineChart props {title?, unit, source, points:[{x, y, display?}] | series:[{name, tone?, points}],
 *                    yMin?, yMax?, decimals?, grouping?, area?: true, hidden?: false, drawDur?: 1.2}
 *             ops   draw {} (line draws left -> right, dots land as it passes), annotate {i, text, tone?, series?}
 * Without hidden:true the chart draws itself on entrance (+250 ms). Seek-safe: finite tweens only.
 */
(function (global) {
  "use strict";
  var HF = (global.HFStage = global.HFStage || { modules: {} });
  var M = HF.modules;
  var L = HF.lf;
  if (!L) throw new Error("modules-chart.js needs profile-lf.js loaded first");
  var T = L.T;
  var div = L.div;
  var svg = L.svg;
  var MONO = L.MONO;

  var P = "html [data-profile=LF] ";
  var CSS = [
    P + ".lf-chart{overflow:visible;}",
    P + ".lf-chart .ttl{position:absolute;left:0;top:0;font-size:30px;font-weight:800;letter-spacing:-.02em;color:" + T.ink + ";white-space:nowrap;}",
    P + ".lf-chart .unit{position:absolute;left:0;font-family:" + MONO + ";font-size:15px;font-weight:700;letter-spacing:.12em;color:" + T.muted + ";text-transform:uppercase;white-space:nowrap;}",
    P + ".lf-chart .gl{position:absolute;height:0;border-top:1.5px dashed #dcd9cf;}",
    P + ".lf-chart .base{position:absolute;height:2.5px;background:" + T.ink + ";border-radius:2px;}",
    P + ".lf-chart .yl{position:absolute;width:74px;text-align:right;font-family:" + MONO + ";font-size:16px;font-weight:500;color:" + T.muted + ";white-space:nowrap;}",
    P + ".lf-chart .xl{position:absolute;text-align:center;font-size:21px;font-weight:600;line-height:1.2;color:" + T.ink2 + ";}",
    P + ".lf-chart .bar{position:absolute;border-radius:7px 7px 2px 2px;transform-origin:50% 100%;}",
    P + ".lf-chart .val{position:absolute;text-align:center;font-size:28px;font-weight:800;letter-spacing:-.02em;color:" + T.ink + ";white-space:nowrap;}",
    P + ".lf-chart .src{position:absolute;left:0;bottom:0;font-family:" + MONO + ";font-size:15px;font-weight:500;letter-spacing:.02em;color:" + T.muted + ";white-space:nowrap;}",
    P + ".lf-chart .src[data-missing='1']{color:" + T.red + ";}",
    P + ".lf-chart .note{position:absolute;padding:7px 13px;border-radius:9px;background:" + T.card + ";border:2.5px solid var(--nc," + T.blue + ");box-shadow:0 10px 24px rgba(20,20,10,.14);font-size:21px;font-weight:700;color:" + T.ink + ";white-space:nowrap;}",
    P + ".lf-chart .lg{position:absolute;right:0;top:4px;display:flex;gap:18px;font-family:" + MONO + ";font-size:15px;font-weight:600;letter-spacing:.06em;color:" + T.ink2 + ";text-transform:uppercase;}",
    P + ".lf-chart .lg i{display:inline-block;width:18px;height:5px;border-radius:3px;margin-right:8px;vertical-align:middle;}",
  ].join("\n");
  (function () {
    if (document.getElementById("st-lf-chart-style")) return;
    var st = document.createElement("style");
    st.id = "st-lf-chart-style";
    st.textContent = CSS;
    document.head.appendChild(st);
  })();

  function niceStep(span) {
    var raw = span / 4;
    var mag = Math.pow(10, Math.floor(Math.log10(raw || 1)));
    var r = raw / mag;
    var s = r <= 1 ? 1 : r <= 2 ? 2 : r <= 2.5 ? 2.5 : r <= 5 ? 5 : 10;
    return s * mag;
  }

  /** shared frame: title, unit, gridlines, y labels, source; returns the plot box */
  function frame(el, p, c, lo, hi) {
    el.classList.add("lf-chart");
    var w = L.W(el);
    var h = L.H(el);
    var y = 0;
    if (p.title) {
      div("ttl", el, p.title);
      y += 44;
    }
    var unit = div("unit", el, p.unit || "");
    unit.style.top = y + "px";
    y += 30;
    var src = div("src", el, p.source ? "Source: " + p.source : "Source: MISSING");
    if (!p.source) {
      src.setAttribute("data-missing", "1");
      c.problems.push("chart '" + c.id + "': the source line is mandatory (props.source)");
    }
    var box = { x0: 84, x1: w - 16, y0: y + 44, y1: h - 28 - 18 - 54 };
    var step = niceStep(hi - lo);
    var top = Math.ceil(hi / step - 1e-9) * step;
    var bot = Math.min(0, Math.floor(lo / step) * step);
    if (p.yMax !== undefined) top = Number(p.yMax);
    if (p.yMin !== undefined) bot = Number(p.yMin);
    var sy = function (v) {
      return box.y1 - ((v - bot) / (top - bot || 1)) * (box.y1 - box.y0);
    };
    var dec = step < 1 ? 1 : 0;
    for (var v = bot; v <= top + 1e-9; v += step) {
      var yy = sy(v);
      if (v !== bot) {
        var gl = div("gl", el);
        Object.assign(gl.style, { left: box.x0 + "px", width: box.x1 - box.x0 + "px", top: yy + "px" });
      }
      var yl = div("yl", el, L.fmtNum(v, dec, p.grouping || "intl"));
      Object.assign(yl.style, { left: "0", top: yy - 11 + "px" });
    }
    var base = div("base", el);
    Object.assign(base.style, { left: box.x0 + "px", width: box.x1 - box.x0 + "px", top: sy(bot) - 1 + "px" });
    return { box: box, sy: sy, w: w, h: h };
  }

  function note(c, el, x, y, text, toneName, t, lineTo) {
    var col = L.tone(toneName || "blue", T.blue);
    var n = div("note", el, text);
    n.style.setProperty("--nc", col);
    var tw = L.measure(text, 700, 21) + 32;
    Object.assign(n.style, { left: Math.max(0, x - tw / 2) + "px", top: y + "px" });
    c.tl.set(n, { autoAlpha: 0 }, 0);
    c.tl.fromTo(n, { autoAlpha: 0, y: 8 }, { autoAlpha: 1, y: 0, duration: 0.25, ease: "back.out(1.7)", immediateRender: false }, t);
    if (lineTo !== undefined) {
      var ln = div("", el);
      Object.assign(ln.style, { position: "absolute", left: x - 1.5 + "px", top: y + 44 + "px", width: "3px", height: Math.max(0, lineTo - y - 44) + "px", background: col, transformOrigin: "50% 0" });
      c.tl.set(ln, { scaleY: 0 }, 0);
      c.tl.to(ln, { scaleY: 1, duration: 0.2, ease: "power2.out" }, t + 0.12);
    }
    return n;
  }

  // ================================================================== barChart
  M.barChart = {
    enter: "fade",
    build: function (el, p, c) {
      var bars = (p.bars || []).slice(0, 10);
      var vals = bars.map(function (b) {
        return Number(b.value) || 0;
      });
      var fr = frame(el, p, c, Math.min.apply(null, vals.concat([0])), Math.max.apply(null, vals.concat([1])));
      var box = fr.box;
      var n = bars.length || 1;
      var slot = (box.x1 - box.x0) / n;
      var bw = Math.min(150, slot * 0.58);
      var dec = p.decimals || 0;
      var y0 = fr.sy(0);
      var items = bars.map(function (b, i) {
        var cx = box.x0 + slot * (i + 0.5);
        var top = fr.sy(Number(b.value) || 0);
        var bar = div("bar", el);
        var accent = p.accent === i + 1;
        bar.style.background = L.tone(b.tone || (accent ? "blue" : null), accent ? T.blue : "#34404a");
        Object.assign(bar.style, { left: cx - bw / 2 + "px", width: bw + "px", top: top + "px", height: Math.max(2, y0 - top) + "px" });
        var val = div("val", el, b.display || L.fmtNum(Number(b.value) || 0, dec, p.grouping || "intl"));
        Object.assign(val.style, { left: cx - slot / 2 + "px", width: slot + "px", top: top - 42 + "px" });
        var xl = div("xl", el, b.label || "");
        Object.assign(xl.style, { left: cx - slot / 2 + 4 + "px", width: slot - 8 + "px", top: box.y1 + 12 + "px" });
        xl.style.fontSize = L.fit(b.label || "", 600, 21, 15, slot - 8, 2) + "px";
        c.entity("b" + (i + 1), bar);
        c.tl.set(bar, { scaleY: 0 }, 0);
        c.tl.set(val, { autoAlpha: 0 }, 0);
        return { bar: bar, val: val, cx: cx, top: top };
      });
      function grow(i, t) {
        var it = items[i];
        c.tl.to(it.bar, { scaleY: 1, duration: 0.5, ease: "power3.out" }, t);
        c.tl.fromTo(it.val, { autoAlpha: 0, y: 8 }, { autoAlpha: 1, y: 0, duration: 0.2, ease: "power2.out", immediateRender: false }, t + 0.38);
      }
      function idx(v) {
        var i = (typeof v === "number" ? v : Number(v && (v.bar || v.i))) - 1;
        if (!items[i]) throw new Error("barChart has no bar " + JSON.stringify(v));
        return i;
      }
      return {
        enter: function (t, recipe) {
          L.enterRecipe(c, el, t, recipe);
          if (!p.hidden) items.forEach(function (_, i) { grow(i, t + 0.25 + 0.12 * i); });
        },
        ops: {
          draw: function (e) {
            if (e.value && (e.value.bar || e.value.i)) return grow(idx(e.value), e.t);
            items.forEach(function (_, i) { grow(i, e.t + 0.12 * i); });
          },
          annotate: function (e) {
            var i = idx(e.value);
            var it = items[i];
            note(c, el, it.cx, Math.max(0, it.top - 42 - 64), e.value.text || "", e.value.tone, e.t);
          },
          tone: function (e) {
            var it = items[idx(e.value)];
            c.tl.to(it.bar, { backgroundColor: L.tone(e.value.tone || "blue", T.blue), duration: 0.2 }, e.t);
          },
        },
      };
    },
  };

  // ================================================================== lineChart
  M.lineChart = {
    enter: "fade",
    build: function (el, p, c) {
      var series = Array.isArray(p.series) && p.series.length ? p.series : [{ name: "", tone: p.tone || "blue", points: p.points || [] }];
      var labels = (series[0].points || []).map(function (pt) {
        return pt && typeof pt === "object" ? pt.x : "";
      });
      var all = [];
      series.forEach(function (s) {
        (s.points || []).forEach(function (pt) {
          all.push(Number(pt && typeof pt === "object" ? pt.y : pt) || 0);
        });
      });
      var lo = Math.min.apply(null, all.concat([0]));
      var hi = Math.max.apply(null, all.concat([1]));
      var fr = frame(el, p, c, lo, hi);
      var box = fr.box;
      var n = labels.length || 1;
      var sx = function (i) {
        return n > 1 ? box.x0 + 24 + (i / (n - 1)) * (box.x1 - box.x0 - 48) : (box.x0 + box.x1) / 2;
      };
      var every = Math.max(1, Math.ceil(n / 9));
      labels.forEach(function (lb, i) {
        if (i % every && i !== n - 1) return;
        var xl = div("xl", el, String(lb));
        Object.assign(xl.style, { left: sx(i) - 70 + "px", width: "140px", top: box.y1 + 12 + "px" });
      });
      if (series.length > 1) {
        var lg = div("lg", el);
        series.forEach(function (s) {
          var it = div("", lg);
          var sw = document.createElement("i");
          sw.style.background = L.tone(s.tone || "blue", T.blue);
          it.appendChild(sw);
          it.appendChild(document.createTextNode(s.name || ""));
        });
      }
      var W2 = fr.w;
      var H2 = fr.h;
      var s = svg("svg", { width: W2, height: H2, viewBox: "0 0 " + W2 + " " + H2, style: "position:absolute;left:0;top:0;overflow:visible;" }, el);
      var drawn = series.map(function (se, si) {
        var col = L.tone(se.tone || (si === 0 ? "blue" : "grey"), T.blue);
        var pts = (se.points || []).map(function (pt, i) {
          var v = Number(pt && typeof pt === "object" ? pt.y : pt) || 0;
          return [sx(i), fr.sy(v), pt];
        });
        var d = pts.map(function (q, i) {
          return (i ? "L" : "M") + q[0].toFixed(1) + " " + q[1].toFixed(1);
        }).join(" ");
        var len = 0;
        for (var i = 1; i < pts.length; i++) len += Math.sqrt(Math.pow(pts[i][0] - pts[i - 1][0], 2) + Math.pow(pts[i][1] - pts[i - 1][1], 2));
        var area = null;
        if (p.area !== false && si === 0 && pts.length > 1) {
          area = svg("path", { d: d + " L" + pts[pts.length - 1][0].toFixed(1) + " " + fr.sy(Math.max(lo, 0)).toFixed(1) + " L" + pts[0][0].toFixed(1) + " " + fr.sy(Math.max(lo, 0)).toFixed(1) + " Z", fill: col, opacity: 0 }, s);
        }
        var path = svg("path", { d: d, fill: "none", stroke: col, "stroke-width": 5, "stroke-linecap": "round", "stroke-linejoin": "round", "stroke-dasharray": len.toFixed(1) + " " + (len + 10).toFixed(1) }, s);
        c.tl.set(path, { attr: { "stroke-dashoffset": len } }, 0);
        var dots = pts.map(function (q) {
          var ci = svg("circle", { cx: q[0].toFixed(1), cy: q[1].toFixed(1), r: 7, fill: T.card, stroke: col, "stroke-width": 4 }, s);
          c.tl.set(ci, { autoAlpha: 0 }, 0);
          return ci;
        });
        var last = pts[pts.length - 1];
        var val = null;
        if (last && last[2] && last[2].display) {
          val = div("val", el, last[2].display);
          Object.assign(val.style, { left: last[0] - 100 + "px", width: "200px", top: last[1] - 50 + "px", color: col });
          c.tl.set(val, { autoAlpha: 0 }, 0);
        }
        return { path: path, area: area, dots: dots, pts: pts, len: len, val: val, col: col };
      });
      var dur = p.drawDur || 1.2;
      function draw(t) {
        drawn.forEach(function (x, si) {
          var t0 = t + si * 0.25;
          c.tl.to(x.path, { attr: { "stroke-dashoffset": 0 }, duration: dur, ease: "power1.inOut" }, t0);
          x.dots.forEach(function (d, i) {
            var f = x.pts.length > 1 ? i / (x.pts.length - 1) : 1;
            c.tl.fromTo(d, { autoAlpha: 0, scale: 0.3, transformOrigin: "50% 50%" }, { autoAlpha: 1, scale: 1, duration: 0.18, ease: "back.out(2)", immediateRender: false }, t0 + dur * f * 0.95);
          });
          if (x.area) c.tl.to(x.area, { opacity: 0.12, duration: 0.4 }, t0 + dur * 0.8);
          if (x.val) c.tl.fromTo(x.val, { autoAlpha: 0, y: 8 }, { autoAlpha: 1, y: 0, duration: 0.25, immediateRender: false }, t0 + dur);
        });
      }
      return {
        enter: function (t, recipe) {
          L.enterRecipe(c, el, t, recipe);
          if (!p.hidden) draw(t + 0.25);
        },
        ops: {
          draw: function (e) {
            draw(e.t);
          },
          annotate: function (e) {
            var v = e.value || {};
            var x = drawn[(Number(v.series) || 1) - 1];
            var i = (Number(v.i || v.point) || x.pts.length) - 1;
            var q = x.pts[i];
            if (!q) throw new Error("lineChart has no point " + v.i);
            var ring = svg("circle", { cx: q[0], cy: q[1], r: 16, fill: "none", stroke: L.tone(v.tone || "blue", T.blue), "stroke-width": 3.5 }, s);
            c.tl.set(ring, { autoAlpha: 0 }, 0);
            c.tl.fromTo(ring, { autoAlpha: 0, scale: 1.8, transformOrigin: "50% 50%" }, { autoAlpha: 1, scale: 1, duration: 0.25, ease: "power2.out", immediateRender: false }, e.t);
            var ny = q[1] - 130 < 0 ? q[1] + 40 : q[1] - 130;
            note(c, el, q[0], ny, v.text || "", v.tone, e.t + 0.1, ny < q[1] ? q[1] - 16 : undefined);
          },
        },
      };
    },
  };
})(typeof window !== "undefined" ? window : globalThis);
