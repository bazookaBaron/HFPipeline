/*
 * HFStage DH design cards, batch 4 -- remaining catalog modules (SPEC.md 5.1-5.4), measured
 * recipes only:
 *   stamp     R1 E: 420x114, 3 px border, -3 deg, 1.01 -> 0.91 -> 1.0 in 200 ms (the one spring);
 *             R5: 1.2 -> 1.0 + 3 deg -> 0 in 133 ms
 *   timeline  R5 D7: hairline axis, mono ticks, 3 px progress #72c5de, amber end-dot 12 px
 *   layers    R5 G7 / R1 layer stack: tiers drop in -50 px -> 0, 220 ms power2.out (R5 E7)
 *   tree      R4 T6 / R1 fan: origin card, bus, leaves; branches draw 100 ms apart (R1 fan)
 *   note      R3 C7: 630x80 strip, r 8, check/cross + mono 25/700, ok/danger tints
 *   letters   R5 X9: 3-4 tiles, one big letter each, lit on its spoken word
 *   slot      R5 C9: dashed placeholder (9 on / 6 off, r 9) filled in 4 frames
 */
(function (global) {
  "use strict";
  var HF = (global.HFStage = global.HFStage || { modules: {} });
  var M = HF.modules;
  var SVG = "http://www.w3.org/2000/svg";
  var F = 1 / 30;
  var TONES = { blue: "#4b9afb", green: "#2ad56c", red: "#ff375c", amber: "#fcba48", purple: "#a77bfb", cyan: "#50dbf2", orange: "#f57201", pink: "#e0457b", white: "#f1f5fd", grey: "#8b9098" };
  var TINT = { blue: ["#091931", "#29456d"], green: ["#032815", "#225d40"], red: ["#3f0b14", "#893c45"], amber: ["#3b2600", "#513b17"], purple: ["#201336", "#4a3470"], cyan: ["#0a3a49", "#517c8a"], orange: ["#3a1c02", "#6b3a12"], pink: ["#3a0d1f", "#7a2c4b"], grey: ["#0b0f14", "#2a2f35"] };

  var CSS = [
    "html .st-stamp{display:flex;align-items:center;justify-content:center;}",
    "html .st-stamp .sp{border:3px solid var(--sp);color:var(--sp);font-size:52px;font-weight:900;letter-spacing:.08em;padding:10px 34px;border-radius:6px;text-transform:uppercase;white-space:nowrap;transform:rotate(-3deg);}",
    "html .st-timeline .tl-ax{position:absolute;left:0;right:0;height:1.5px;background:#2a2f35;}",
    "html .st-timeline .tl-pr{position:absolute;left:0;height:3px;background:#72c5de;transform-origin:0 50%;}",
    "html .st-timeline .tl-t{position:absolute;width:1.5px;height:14px;background:#4a5058;}",
    "html .st-timeline .tl-l{position:absolute;transform:translateX(-50%);font-family:var(--st-mono);font-size:17px;color:#8b9098;white-space:nowrap;}",
    "html .st-timeline .tl-c{position:absolute;transform:translateX(-50%);font-size:15px;font-weight:700;letter-spacing:.12em;color:#c9d0d6;white-space:nowrap;text-transform:uppercase;text-align:center;}",
    "html .st-timeline .tl-d{position:absolute;width:12px;height:12px;margin:-6px 0 0 -6px;border-radius:50%;background:#eec684;}",
    "html .st-layers .ly{position:absolute;left:0;right:0;border-radius:9px;border:1.5px solid var(--ly-line);background:var(--ly-fill);display:flex;align-items:center;padding:0 22px;gap:16px;}",
    "html .st-layers .ly .n{font-family:var(--st-mono);font-size:17px;color:#6f757c;width:28px;}",
    "html .st-layers .ly .t{font-size:22px;font-weight:800;letter-spacing:.06em;color:var(--ly-acc);text-transform:uppercase;white-space:nowrap;}",
    "html .st-layers .ly .d{margin-left:auto;font-family:var(--st-mono);font-size:17px;color:#aab1b9;white-space:nowrap;}",
    "html .st-tree > svg{position:absolute;left:0;top:0;width:100%;height:100%;overflow:visible;}",
    "html .st-tree .tr-box{position:absolute;border-radius:9px;background:#090d11;border:1.5px solid #1f2527;display:flex;flex-direction:column;justify-content:center;align-items:center;gap:6px;}",
    "html .st-tree .tr-box[data-tone]{background:var(--tb-fill);border-color:var(--tb-line);}",
    "html .st-tree .tr-t{font-size:18px;font-weight:800;letter-spacing:.08em;color:#e6e9ed;text-transform:uppercase;white-space:nowrap;}",
    "html .st-tree .tr-s{font-family:var(--st-mono);font-size:15px;color:#8b9098;white-space:nowrap;}",
    "html .st-tree .tr-box[data-tone] .tr-t{color:var(--tb-acc);}",
    "html .st-note{display:flex;align-items:center;gap:16px;padding:0 24px;border-radius:8px;border:1.5px solid var(--nt-line);background:var(--nt-fill);}",
    "html .st-note .mk{width:30px;height:30px;border-radius:50%;background:var(--nt-acc);display:flex;align-items:center;justify-content:center;color:#05080b;font-weight:900;font-size:19px;flex:none;}",
    "html .st-note .tx{font-family:var(--st-mono);font-size:24px;font-weight:700;color:var(--nt-acc);white-space:nowrap;overflow:hidden;}",
    "html .st-letters{display:flex;gap:18px;}",
    "html .st-letters .lt{flex:1;border-radius:9px;background:#10141a;border:1.5px solid #21252b;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;}",
    "html .st-letters .lt .L{font-size:120px;font-weight:900;line-height:.9;color:#2a2e34;}",
    "html .st-letters .lt .w{font-size:16px;font-weight:700;letter-spacing:.16em;color:#4a5058;text-transform:uppercase;white-space:nowrap;}",
    "html .st-letters .lt[data-lit='1']{background:var(--lt-fill);border-color:var(--lt-line);}",
    "html .st-letters .lt[data-lit='1'] .L{color:var(--lt-acc);}html .st-letters .lt[data-lit='1'] .w{color:#e6e9ed;}",
    "html .st-slot{border-radius:9px;display:flex;align-items:center;justify-content:center;}",
    "html .st-slot > svg{position:absolute;left:0;top:0;width:100%;height:100%;overflow:visible;}",
    "html .st-slot .q{font-size:15px;font-weight:700;letter-spacing:.2em;color:#4a5058;text-transform:uppercase;}",
    "html .st-slot .fill{position:absolute;inset:0;border-radius:9px;background:var(--sl-fill);border:1.5px solid var(--sl-line);display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:800;color:var(--sl-acc);letter-spacing:.06em;text-transform:uppercase;}",
  ].join("\n");
  (function () {
    if (document.getElementById("st-dh4-style")) return;
    var st = document.createElement("style");
    st.id = "st-dh4-style";
    st.textContent = CSS;
    document.head.appendChild(st);
  })();

  function div(cls, parent, text) {
    var el = document.createElement("div");
    if (cls) el.className = cls;
    if (text !== undefined && text !== null) el.textContent = text;
    if (parent) parent.appendChild(el);
    return el;
  }
  function svgEl(tag, attrs, parent) {
    var el = document.createElementNS(SVG, tag);
    Object.keys(attrs || {}).forEach(function (k) {
      el.setAttribute(k, attrs[k]);
    });
    if (parent) parent.appendChild(el);
    return el;
  }
  function W(el) {
    return parseFloat(el.style.width);
  }
  function H(el) {
    return parseFloat(el.style.height);
  }
  function tint(el, prefix, tone) {
    var t = TINT[tone] || TINT.grey;
    el.style.setProperty("--" + prefix + "-fill", t[0]);
    el.style.setProperty("--" + prefix + "-line", t[1]);
    el.style.setProperty("--" + prefix + "-acc", TONES[tone] || TONES.white);
  }

  // =============== stamp (X6) ===============
  // props {text, tone?: red} ; enters as the stamp (use at scaffold start or with anchor)
  M.stamp = {
    enter: "none",
    build: function (el, p, c) {
      el.classList.add("st-stamp");
      var sp = c.entity("text", div("sp", el, p.text || "REJECTED"));
      sp.style.setProperty("--sp", TONES[p.tone || "red"]);
      return {
        enter: function (t) {
          // R1: 1.01 -> 0.91 -> 1.0 over 200 ms (6 f) -- the only spring in the refs
          c.tl.fromTo(sp, { autoAlpha: 0, scale: 1.01 }, { autoAlpha: 1, scale: 0.91, duration: 3 * F, ease: "power2.in", immediateRender: false }, t);
          c.tl.to(sp, { scale: 1, duration: 3 * F, ease: "power2.out" }, t + 3 * F);
        },
      };
    },
  };

  // =============== timeline (D7) ===============
  // props {ticks:[{label, caption?}], progress?: index reached at start (0 = none)}
  M.timeline = {
    enter: "fade",
    build: function (el, p, c) {
      el.classList.add("st-timeline");
      var w = W(el);
      var ticks = p.ticks || [];
      var n = ticks.length;
      var y = 60;
      var ax = div("tl-ax", el);
      ax.style.top = y + "px";
      var pr = div("tl-pr", el);
      Object.assign(pr.style, { top: y - 0.75 + "px", width: w + "px" });
      var xs = ticks.map(function (_, i) {
        return n > 1 ? 30 + ((w - 60) * i) / (n - 1) : w / 2;
      });
      var start = p.progress ? xs[Math.min(n - 1, p.progress - 1)] : 0;
      pr.style.transform = "scaleX(" + start / w + ")";
      var dot = div("tl-d", el);
      dot.style.left = start + "px";
      dot.style.top = y + "px";
      ticks.forEach(function (tk, i) {
        var t = div("tl-t", el);
        Object.assign(t.style, { left: xs[i] - 0.75 + "px", top: y - 7 + "px" });
        var l = div("tl-l", el, tk.label);
        Object.assign(l.style, { left: xs[i] + "px", top: y - 44 + "px" });
        if (tk.caption) {
          var cp = div("tl-c", el, tk.caption);
          Object.assign(cp.style, { left: xs[i] + "px", top: y + 22 + "px", maxWidth: (w / Math.max(1, n)) * 1.1 + "px", whiteSpace: "normal" });
          c.entity("t" + (i + 1) + ".caption", cp);
        }
        c.entity("t" + (i + 1), l);
      });
      return {
        ops: {
          // value {to: tick index}: progress + end-dot run to the tick (R5: 400 ms power2.inOut + dot)
          advance: function (e) {
            var x = xs[Math.max(0, Math.min(n - 1, e.value.to - 1))];
            c.tl.to(pr, { scaleX: x / w, duration: 0.4, ease: "power2.inOut" }, e.t);
            c.tl.to(dot, { left: x + "px", duration: 0.4, ease: "power2.inOut" }, e.t);
          },
        },
      };
    },
  };

  // =============== layer stack (G7) ===============
  // props {layers:[{title, desc?, tone?, hidden?}]} top -> bottom
  M.layers = {
    enter: "fade",
    build: function (el, p, c) {
      el.classList.add("st-layers");
      var list = p.layers || [];
      var gap = 12;
      var h = (H(el) - gap * (list.length - 1)) / Math.max(1, list.length);
      var tiers = list.map(function (ly, i) {
        var d = div("ly", el);
        Object.assign(d.style, { top: i * (h + gap) + "px", height: h + "px" });
        tint(d, "ly", ly.tone || "grey");
        div("n", d, String(list.length - i).padStart(2, "0"));
        div("t", d, ly.title);
        if (ly.desc) div("d", d, ly.desc);
        if (ly.hidden) c.tl.set(d, { autoAlpha: 0 }, 0);
        c.entity("l" + (i + 1), d);
        return d;
      });
      return {
        ops: {
          // R5 E7: drop -50 px -> 0 over 220 ms easeOutCubic
          dropIn: function (e) {
            c.tl.fromTo(tiers[e.value.layer - 1], { autoAlpha: 0, y: -50 }, { autoAlpha: 1, y: 0, duration: 0.22, ease: "power2.out", immediateRender: false }, e.t);
          },
          layerTone: function (e) {
            var d = tiers[e.value.layer - 1];
            var tt = TINT[e.value.tone] || TINT.grey;
            c.tl.set(d, { "--ly-fill": tt[0], "--ly-line": tt[1], "--ly-acc": TONES[e.value.tone] }, e.t);
          },
        },
      };
    },
  };

  // =============== tree / fan-out (G6, U7) ===============
  // props {root:{title, sub?, tone?}, leaves:[{title, sub?, tone?}] (2-4), drawn?: bool}
  M.tree = {
    enter: "fade",
    build: function (el, p, c) {
      el.classList.add("st-tree");
      var w = W(el);
      var h = H(el);
      var leaves = p.leaves || [];
      var n = Math.max(1, leaves.length);
      var rw = Math.min(360, w * 0.5);
      var rh = 110;
      var lw = Math.min(260, (w - 24 * (n - 1)) / n);
      var lh = 130;
      var s = svgEl("svg", { viewBox: "0 0 " + w + " " + h }, el);
      var busY = rh + (h - rh - lh) / 2;
      function box(spec, x, y, bw, bh, id) {
        var b = div("tr-box", el);
        Object.assign(b.style, { left: x + "px", top: y + "px", width: bw + "px", height: bh + "px" });
        if (spec.tone) {
          b.setAttribute("data-tone", spec.tone);
          tint(b, "tb", spec.tone);
        }
        div("tr-t", b, spec.title);
        if (spec.sub) div("tr-s", b, spec.sub);
        c.entity(id, b);
        return b;
      }
      box(p.root || { title: "ROOT" }, (w - rw) / 2, 0, rw, rh, "root");
      var paths = [];
      leaves.forEach(function (lf, i) {
        var x = n > 1 ? (i * (w - lw)) / (n - 1) : (w - lw) / 2;
        var b = box(lf, x, h - lh, lw, lh, "leaf" + (i + 1));
        if (lf.hidden || p.drawn === false) c.tl.set(b, { autoAlpha: 0 }, 0);
        var cx = x + lw / 2;
        var d = "M" + w / 2 + " " + rh + " V " + busY + " H " + cx + " V " + (h - lh);
        var path = svgEl("path", { d: d, fill: "none", stroke: TONES[lf.tone] || "#4a5058", "stroke-width": 3 }, s);
        var len = path.getTotalLength ? path.getTotalLength() : 400;
        path.setAttribute("stroke-dasharray", len + " " + len);
        path.setAttribute("stroke-dashoffset", p.drawn === false ? len : 0);
        paths.push({ path: path, box: b });
        c.entity("edge" + (i + 1), path);
      });
      return {
        ops: {
          // value {leaf?}: one branch, or all branches 100 ms apart (R1 fan curves)
          branch: function (e) {
            var list = e.value && e.value.leaf ? [paths[e.value.leaf - 1]] : paths;
            list.forEach(function (x, j) {
              var t = e.t + j * 0.1;
              c.tl.to(x.path, { attr: { "stroke-dashoffset": 0 }, duration: 0.35, ease: "sine.inOut" }, t);
              c.tl.fromTo(x.box, { autoAlpha: 0, y: 6 }, { autoAlpha: 1, y: 0, duration: 0.133, ease: "power2.out", immediateRender: false }, t + 0.3);
            });
          },
        },
      };
    },
  };

  // =============== note strip (C7) ===============
  // props {text, tone?: green|red|amber, mark?: "check"|"cross"|"bang"}
  M.note = {
    enter: "rise",
    build: function (el, p, c) {
      el.classList.add("st-note");
      tint(el, "nt", p.tone || "green");
      div("mk", el, { check: "✓", cross: "✕", bang: "!" }[p.mark || (p.tone === "red" ? "cross" : p.tone === "amber" ? "bang" : "check")]);
      c.entity("text", div("tx", el, p.text || ""));
      return {};
    },
  };

  // =============== acronym / letter tiles (X9) ===============
  // props {letters:[{letter, word}], tone?} ; op light {i}
  M.letters = {
    enter: "fade",
    build: function (el, p, c) {
      el.classList.add("st-letters");
      var tone = p.tone || "amber";
      var tiles = (p.letters || []).map(function (lt, i) {
        var d = div("lt", el);
        tint(d, "lt", tone);
        div("L", d, lt.letter);
        div("w", d, lt.word || "");
        c.entity("t" + (i + 1), d);
        return d;
      });
      return {
        ops: {
          light: function (e) {
            var d = tiles[e.value.i - 1];
            c.tl.set(d, { attr: { "data-lit": "1" } }, e.t);
            c.tl.fromTo(d, { opacity: 0.5 }, { opacity: 1, duration: 0.133, ease: "none", immediateRender: false }, e.t);
          },
        },
      };
    },
  };

  // =============== dashed placeholder slot (C9) ===============
  // props {label?: "?", fill: {text, tone}} ; op fill (4 frames)
  M.slot = {
    enter: "fade",
    build: function (el, p, c) {
      el.classList.add("st-slot");
      var w = W(el);
      var h = H(el);
      var s = svgEl("svg", { viewBox: "0 0 " + w + " " + h }, el);
      svgEl("rect", { x: 0.75, y: 0.75, width: w - 1.5, height: h - 1.5, rx: 9, fill: "none", stroke: "#3a3f45", "stroke-width": 1.5, "stroke-dasharray": "9 6" }, s);
      var q = div("q", el, p.label || "?");
      var f = div("fill", el, (p.fill && p.fill.text) || "");
      tint(f, "sl", (p.fill && p.fill.tone) || "cyan");
      c.tl.set(f, { autoAlpha: 0 }, 0);
      c.entity("fill", f);
      return {
        ops: {
          fill: function (e) {
            c.tl.fromTo(f, { autoAlpha: 0, scale: 0.97 }, { autoAlpha: 1, scale: 1, duration: 4 * F, ease: "power2.out", immediateRender: false }, e.t);
            c.tl.set(q, { autoAlpha: 0 }, e.t);
          },
        },
      };
    },
  };
})(typeof window !== "undefined" ? window : globalThis);
