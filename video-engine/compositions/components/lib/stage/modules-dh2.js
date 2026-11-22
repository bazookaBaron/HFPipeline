/*
 * HFStage DH modules, batch 2 -- slot / reframe / bookend modules measured on R2 frames
 * 0.5 (title cards), 3.0 (browser), 41.6 (test console), 59.2 (option row), 64.1 (stat box),
 * 71.78 (chart + hero number), 143.9 (outro). 1080x1920 px. See modules-dh.js for the contract.
 */
(function (global) {
  "use strict";
  var HF = (global.HFStage = global.HFStage || { modules: {} });
  var M = HF.modules;
  var SVG = "http://www.w3.org/2000/svg";

  var CSS = [
    // eyebrow / micro text (R2 "HOW IT WORKS", "BYPASSES THE LOAD BALANCER", "ONE TRAFFIC SWITCH")
    "html .st-micro{display:flex;align-items:center;font-size:15px;font-weight:700;letter-spacing:.3em;color:var(--x-8b8f95,#8b8f95);text-transform:uppercase;white-space:nowrap;}",
    "html .st-micro[data-align=center]{justify-content:center;}html .st-micro[data-align=right]{justify-content:flex-end;}",
    "html .st-micro[data-tone=amber]{color:var(--x-d9a441,#d9a441);letter-spacing:.16em;font-size:13px;}",
    "html .st-micro[data-size=xl]{font-size:34px;font-weight:600;letter-spacing:.42em;color:var(--x-3a3e44,#3a3e44);}",
    // title env cards (M19)
    "html .st-tcard{background:var(--x-090d11,#090d11);border:1.5px solid var(--x-1a2029,#1a2029);border-radius:12px;overflow:hidden;}",
    "html .st-tcard[data-lit=blue]{background:var(--x-0e1932,#0e1932);border-color:var(--x-24406a,#24406a);}html .st-tcard[data-lit=green]{background:var(--x-0a2416,#0a2416);border-color:var(--x-225d40,#225d40);}",
    "html .st-tcard .t-hd{position:absolute;left:0;right:0;top:0;height:50px;border-bottom:1.5px solid var(--x-1a2029,#1a2029);display:flex;align-items:center;padding:0 18px;font-size:12px;font-weight:700;letter-spacing:.2em;color:var(--x-6d737b,#6d737b);}",
    "html .st-tcard .t-word{position:absolute;left:0;right:0;top:165px;text-align:center;font-size:118px;font-weight:800;letter-spacing:-.03em;line-height:1;}",
    "html .st-tcard .t-word[data-tone=blue]{color:var(--x-4b9afb,#4b9afb);}html .st-tcard .t-word[data-tone=green]{color:var(--x-2ad56c,#2ad56c);}",
    "html .st-tcard .t-sk{position:absolute;left:26px;right:26px;height:20px;border-radius:6px;background:var(--x-111823,#111823);}",
    // window chrome shared by browser / console (C2 dark)
    "html .st-win{background:var(--x-0a0e13,#0a0e13);border:1.5px solid var(--x-1c2229,#1c2229);border-radius:9px;overflow:hidden;}",
    "html .st-win .w-bar{position:absolute;left:0;right:0;top:0;height:50px;display:flex;align-items:center;padding:0 14px;gap:9px;}",
    "html .st-win .w-dot{width:12px;height:12px;border-radius:50%;flex:none;}",
    "html .st-win .w-url{flex:1;height:32px;border-radius:8px;background:var(--x-05080b,#05080b);display:flex;align-items:center;padding:0 14px;margin-left:8px;font-family:var(--st-mono);font-size:17px;color:var(--x-d6dbe1,#d6dbe1);white-space:nowrap;overflow:hidden;}",
    "html .st-win .w-chip{height:24px;border-radius:12px;background:var(--x-8a5a12,#8a5a12);color:var(--x-ffe2a8,#ffe2a8);font-size:11px;font-weight:800;letter-spacing:.12em;padding:0 12px;display:flex;align-items:center;margin-left:auto;margin-right:8px;white-space:nowrap;}",
    "html .st-win .w-body{position:absolute;left:0;right:0;top:50px;bottom:0;}",
    // browser product grid
    "html .st-win .b-tool{position:absolute;left:18px;right:18px;top:12px;height:26px;display:flex;align-items:center;gap:14px;}",
    "html .st-win .b-sq{width:22px;height:22px;border-radius:4px;background:var(--x-e8ebef,#e8ebef);}html .st-win .b-bar{height:6px;border-radius:3px;background:var(--x-2a3038,#2a3038);}",
    "html .st-win .b-tile{position:absolute;border-radius:6px;background:linear-gradient(180deg,var(--x-131a23,#131a23),var(--x-0d1218,#0d1218));border:1.5px solid var(--x-151b22,#151b22);}",
    "html .st-win .b-tile .ln{position:absolute;left:10%;height:5px;border-radius:3px;background:var(--x-e9ecf0,#e9ecf0);}",
    "html .st-win .b-tile .ln2{position:absolute;left:10%;height:5px;border-radius:3px;background:var(--x-39414b,#39414b);}",
    "html .st-win .b-tile[data-hl='1']{outline:3px solid var(--st-blue);outline-offset:3px;}",
    "html .st-win .b-err{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;}",
    "html .st-win .b-err .code{font-size:118px;font-weight:800;color:var(--x-f83c64,#f83c64);letter-spacing:-.03em;line-height:1;}",
    "html .st-win .b-err .msg{font-family:var(--st-mono);font-size:20px;color:var(--x-8b9098,#8b9098);}",
    // test console checklist rows (44 px pitch)
    "html .st-win .k-row{position:absolute;left:18px;right:22px;height:40px;display:flex;align-items:center;}",
    "html .st-win .k-box{width:19px;height:19px;border:1.5px solid var(--x-6d737b,#6d737b);border-radius:4px;margin-right:16px;flex:none;position:relative;}",
    "html .st-win .k-row[data-state=pass] .k-box::after{content:'';position:absolute;left:5px;top:1px;width:5px;height:10px;border:solid var(--x-e6e9ed,#e6e9ed);border-width:0 2px 2px 0;transform:rotate(45deg);}",
    "html .st-win .k-path{font-family:var(--st-mono);font-size:19px;color:var(--x-d6dbe1,#d6dbe1);}",
    "html .st-win .k-st{margin-left:auto;font-family:var(--st-mono);font-size:18px;font-weight:700;color:var(--x-e6e9ed,#e6e9ed);}",
    "html .st-win .k-row[data-state=fail] .k-st,html .st-win .k-row[data-state=fail] .k-path{color:var(--x-f83c64,#f83c64);}",
    // option row with strike (M13)
    "html .st-option{display:flex;align-items:center;padding:0 26px;gap:16px;}",
    "html .st-option .o-txt{font-family:var(--st-mono);font-size:30px;color:var(--x-c9d0d6,#c9d0d6);}",
    "html .st-option .o-tag{margin-left:auto;font-size:12px;font-weight:700;letter-spacing:.2em;color:var(--x-6d737b,#6d737b);}",
    "html .st-option .st-strike{left:22px;width:calc(100% - 44px);height:3px;}",
    // stat box (M11)
    "html .st-stat{display:flex;flex-direction:column;justify-content:center;padding:0 22px;gap:6px;}",
    "html .st-stat .s-eye{font-size:14px;font-weight:600;letter-spacing:.2em;color:var(--x-9aa0a7,#9aa0a7);text-transform:uppercase;white-space:nowrap;}",
    "html .st-stat .s-val{font-size:36px;font-weight:700;color:var(--x-f1f5fd,#f1f5fd);letter-spacing:-.01em;white-space:nowrap;font-variant-numeric:tabular-nums;}",
    "html .st-stat .s-val.mono{font-family:var(--st-mono);}",
    "html .st-stat .s-sub{font-size:13px;font-weight:600;letter-spacing:.16em;color:var(--x-8b9098,#8b9098);text-transform:uppercase;white-space:nowrap;}",
    // hero number (R2 "18%": right-aligned, slam 1.15 -> 1)
    "html .st-hero{display:flex;align-items:flex-start;justify-content:flex-end;}",
    "html .st-hero .h-n{font-size:118px;font-weight:800;letter-spacing:-.04em;line-height:.82;color:var(--st-red);transform-origin:100% 0;white-space:nowrap;}",
    "html .st-hero[data-align=center]{justify-content:center;}html .st-hero[data-align=center] .h-n{transform-origin:50% 0;}",
    "html .st-hero .h-n[data-tone=blue]{color:var(--st-blue);}html .st-hero .h-n[data-tone=green]{color:var(--st-green);}html .st-hero .h-n[data-tone=white]{color:var(--x-ebeef5,#ebeef5);}",
    // chart (M12)
    "html .st-chart .c-hd{position:absolute;left:18px;right:18px;top:12px;height:34px;display:flex;align-items:center;}",
    "html .st-chart .c-tile{width:26px;height:26px;border-radius:6px;background:var(--x-d81b6a,#d81b6a);margin-right:12px;display:flex;align-items:center;justify-content:center;}",
    "html .st-chart .c-ti{font-size:15px;font-weight:700;letter-spacing:.14em;color:var(--x-e6e9ed,#e6e9ed);}",
    "html .st-chart .c-max{margin-left:auto;font-family:var(--st-mono);font-size:14px;color:var(--x-8b9098,#8b9098);}",
    "html .st-chart > svg{position:absolute;left:0;top:0;width:100%;height:100%;overflow:visible;}",
    "html .st-chart .c-ax{position:absolute;left:18px;font-family:var(--st-mono);font-size:14px;color:var(--x-8b9098,#8b9098);}",
  ].join("\n");

  (function ensureStyle() {
    if (document.getElementById("st-dh2-style")) return;
    var st = document.createElement("style");
    st.id = "st-dh2-style";
    st.textContent = CSS;
    document.head.appendChild(st);
  })();

  function div(cls, parent, text) {
    var el = document.createElement("div");
    if (cls) el.className = cls;
    if (text !== undefined) el.textContent = text;
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

  // ---------------- micro / eyebrow text ----------------
  M.micro = {
    enter: "fade",
    build: function (el, p, c) {
      el.classList.add("st-micro");
      el.setAttribute("data-align", p.align || "center");
      if (p.tone) el.setAttribute("data-tone", p.tone);
      if (p.size) el.setAttribute("data-size", p.size);
      c.entity("text", div("", el, p.text || ""));
      return {};
    },
  };

  // ---------------- title env card (M19): tint + big word on its spoken word ----------------
  M.titleCard = {
    enter: "fade",
    build: function (el, p, c) {
      el.classList.add("st-tcard");
      div("t-hd", el, p.eyebrow || "ENVIRONMENT");
      var word = c.entity("word", div("t-word", el, p.word || ""));
      word.setAttribute("data-tone", p.tone || "blue");
      var h = H(el);
      [0.53, 0.62, 0.71].forEach(function (f) {
        var sk = div("t-sk", el);
        sk.style.top = Math.round(h * f) + "px";
      });
      if (p.lit) el.setAttribute("data-lit", p.tone || "blue");
      else word.style.opacity = 0;
      return {
        ops: {
          // R2 E11: surface tint 267 ms + word 100 ms, on the colour word
          light: function (e) {
            c.tl.set(el, { attr: { "data-lit": p.tone || "blue" } }, e.t);
            c.tl.fromTo(el, { filter: "brightness(0.7)" }, { filter: "brightness(1)", duration: 0.267, ease: "power2.out", immediateRender: false }, e.t);
            c.tl.to(word, { opacity: 1, duration: 0.1, ease: "power2.out" }, e.t);
          },
        },
      };
    },
  };

  // ---------------- browser window (M8) ----------------
  function windowChrome(el, p) {
    el.classList.add("st-win");
    var bar = div("w-bar", el);
    ["#ff5f57", "#febc2e", "#28c840"].forEach(function (col) {
      div("w-dot", bar).style.background = col;
    });
    div("w-url", bar, p.url || "https://shop.example.com");
    if (p.chip) div("w-chip", bar, p.chip);
    return div("w-body", el);
  }

  M.browser = {
    enter: "settle",
    build: function (el, p, c) {
      var body = windowChrome(el, p);
      var tool = div("b-tool", body);
      div("b-sq", tool);
      div("b-bar", tool).style.width = "70px";
      div("b-bar", tool).style.width = "50px";
      var w = W(el) - 36;
      var bh = H(el) - 50 - 60;
      var cols = p.cols || 3;
      var rows = p.rows || 2;
      var gap = 16;
      var tw = (w - gap * (cols - 1)) / cols;
      var th = (bh - gap * (rows - 1)) / rows;
      var grid = div("", body);
      c.entity("grid", grid);
      for (var r = 0; r < rows; r++) {
        for (var k = 0; k < cols; k++) {
          var t = div("b-tile", grid);
          Object.assign(t.style, { left: 18 + k * (tw + gap) + "px", top: 50 + r * (th + gap) + "px", width: tw + "px", height: th + "px" });
          var l1 = div("ln", t);
          l1.style.bottom = "30px";
          l1.style.width = "38%";
          var l2 = div("ln2", t);
          l2.style.bottom = "44px";
          l2.style.width = "60%";
          c.entity("tile" + (r * cols + k + 1), t);
        }
      }
      var err = c.entity("error", div("b-err", body));
      div("code", err, p.errorCode || "503");
      div("msg", err, p.errorMsg || "Service Unavailable");
      err.style.opacity = 0;
      return {
        ops: {
          // the page fails: grid goes, big error code in (hard 1-frame swap)
          fail: function (e) {
            c.tl.set(grid, { autoAlpha: 0 }, e.t);
            c.tl.set(err, { opacity: 1 }, e.t);
          },
        },
      };
    },
  };

  // ---------------- test console / checklist window (M9) ----------------
  M.console = {
    enter: "settle",
    build: function (el, p, c) {
      var body = windowChrome(el, p);
      (p.rows || []).forEach(function (r, i) {
        var row = div("k-row", body);
        row.style.top = 8 + i * 44 + "px";
        row.setAttribute("data-state", r.state || "pending");
        div("k-box", row);
        div("k-path", row, r.path);
        var st = div("k-st", row, r.status || "");
        c.entity("row" + (i + 1), row);
        c.entity("row" + (i + 1) + ".status", st);
        if (r.hidden !== false) row.style.opacity = r.hidden ? 0 : 1;
      });
      return {
        ops: {
          // value {row, state:"pass"|"fail", status:"200"}: row fades + rises 4.5 px (R2 E15), ticks
          check: function (e) {
            var row = c.entities[c.id + ".row" + e.value.row];
            c.tl.set(row, { attr: { "data-state": e.value.state || "pass" } }, e.t);
            c.tl.set(c.entities[c.id + ".row" + e.value.row + ".status"], { textContent: String(e.value.status || "200") }, e.t);
            c.tl.fromTo(row, { opacity: 0.35, y: 4.5 }, { opacity: 1, y: 0, duration: 0.133, ease: "power2.out", immediateRender: false }, e.t);
          },
        },
      };
    },
  };

  // ---------------- option row with strike (M13) ----------------
  M.option = {
    enter: "rise",
    build: function (el, p, c) {
      el.classList.add("st-panel", "st-option");
      var ico = svgEl("svg", { viewBox: "0 0 24 24", width: 26, height: 26, fill: "none", stroke: HF.col("#8b9098"), "stroke-width": 2 }, el);
      svgEl("path", { d: "M12 3 3 7.5v9L12 21l9-4.5v-9L12 3zM3 7.5 12 12l9-4.5M12 12v9" }, ico);
      c.entity("text", div("o-txt", el, p.text || ""));
      if (p.tag) div("o-tag", el, p.tag);
      return {};
    },
  };

  // ---------------- stat box (M11) ----------------
  M.stat = {
    enter: "fade",
    build: function (el, p, c) {
      el.classList.add("st-panel", "st-stat");
      if (p.eyebrow) c.entity("eyebrow", div("s-eye", el, p.eyebrow));
      c.entity("value", div("s-val" + (p.mono ? " mono" : ""), el, p.value || ""));
      if (p.sub) c.entity("sub", div("s-sub", el, p.sub));
      return {};
    },
  };

  // ---------------- hero number / word (R2 E6 slam) ----------------
  M.hero = {
    enter: "none",
    build: function (el, p, c) {
      el.classList.add("st-hero");
      if (p.align) el.setAttribute("data-align", p.align);
      var n = c.entity("n", div("h-n", el, p.text || ""));
      if (p.size) n.style.fontSize = p.size + "px";
      if (p.tone) n.setAttribute("data-tone", p.tone);
      return {
        enter: function (t) {
          // R2 E6: first frame already at 1.15x / ~70% opacity, then 1.09, 1.02, 1.00 (no rebound)
          c.tl.fromTo(n, { autoAlpha: 0.7, scale: 1.15 }, { autoAlpha: 1, scale: 1, duration: 0.1, ease: "sine.out", immediateRender: false }, t);
        },
      };
    },
  };

  // ---------------- line chart (M12): flat crawl, then a surge that eases in (R2 E8) ----------------
  M.chart = {
    enter: "settle",
    build: function (el, p, c) {
      el.classList.add("st-panel", "st-chart");
      var w = W(el);
      var h = H(el);
      var hd = div("c-hd", el);
      var tile = div("c-tile", hd);
      var ti = svgEl("svg", { viewBox: "0 0 24 24", width: 16, height: 16, fill: "none", stroke: "#fff", "stroke-width": 2.4 }, tile);
      svgEl("path", { d: "M4 18 9 11l4 4 7-9" }, ti);
      div("c-ti", hd, p.title || "5xx ERROR RATE");
      div("c-max", hd, p.maxLabel || "20% max");
      var x0 = 55;
      var x1 = w - 15;
      var yTop = 60;
      var yBot = h - 25;
      var s = svgEl("svg", { viewBox: "0 0 " + w + " " + h }, el);
      (p.ticks || ["20%", "10%", "0%"]).forEach(function (lab, i, arr) {
        var y = yTop + ((yBot - yTop) * i) / (arr.length - 1);
        svgEl("line", { x1: x0, x2: x1, y1: y, y2: y, stroke: HF.col("#1b2025"), "stroke-width": 1.5 }, s);
        var ax = div("c-ax", el, lab);
        ax.style.top = y - 9 + "px";
      });
      var max = p.max || 20;
      var yOf = function (v) {
        return yBot - ((yBot - yTop) * v) / max;
      };
      // baseline series: gentle deterministic wiggle around `base`
      var base = p.base !== undefined ? p.base : 0.4;
      var evX = x0 + (x1 - x0) * (p.eventAt !== undefined ? p.eventAt : 0.6);
      var pts = [];
      for (var i = 0; i <= 40; i++) {
        var x = x0 + ((evX - x0) * i) / 40;
        pts.push(x.toFixed(1) + "," + yOf(base + 0.12 * Math.sin(i * 1.7) + 0.08 * Math.sin(i * 0.61)).toFixed(1));
      }
      svgEl("polyline", { points: pts.join(" "), fill: "none", stroke: HF.col("#e9ecf0"), "stroke-width": 3, "stroke-linejoin": "round" }, s);
      var marker = svgEl("line", { x1: evX, x2: evX, y1: yTop - 10, y2: yBot, stroke: HF.col("#3a3f45"), "stroke-width": 1.5, "stroke-dasharray": "6 6" }, s);
      // surge: path from the event point up to `to`, drawn with an ease-in (accelerating) sweep
      var to = p.to !== undefined ? p.to : 18;
      var sp = [];
      for (var j = 0; j <= 30; j++) {
        var f = j / 30;
        var sx = evX + (x1 - evX) * f;
        var v = base + (to - base) * Math.min(1, f * 1.08) - (f > 0.9 ? (f - 0.9) * 2 : 0);
        sp.push(sx.toFixed(1) + "," + yOf(Math.max(base, v)).toFixed(1));
      }
      var surge = svgEl("polyline", { points: sp.join(" "), fill: "none", stroke: HF.col("#ff375c"), "stroke-width": 3, "stroke-linejoin": "round" }, s);
      var len = 0;
      for (var q = 1; q < sp.length; q++) {
        var a = sp[q - 1].split(",").map(Number);
        var b = sp[q].split(",").map(Number);
        len += Math.hypot(b[0] - a[0], b[1] - a[1]);
      }
      surge.setAttribute("stroke-dasharray", len.toFixed(1));
      surge.setAttribute("stroke-dashoffset", p.surged ? 0 : len.toFixed(1));
      var last = sp[sp.length - 1].split(",").map(Number);
      var dot = svgEl("circle", { cx: last[0], cy: last[1], r: 6.5, fill: HF.col("#ff375c") }, s);
      dot.style.opacity = p.surged ? 1 : 0;
      void marker;
      return {
        ops: {
          surge: function (e) {
            var dur = (e.value && e.value.dur) || 0.633;
            c.tl.to(surge, { attr: { "stroke-dashoffset": 0 }, duration: dur, ease: "power2.in" }, e.t);
            c.tl.set(dot, { opacity: 1 }, e.t + dur);
          },
        },
      };
    },
  };

  // ---------------- connector: dashed curve drawn on its word (G1 "bezier") ----------------
  // props: {from:[x,y], to:[x,y] (absolute frame px), tone, dashed, bend}
  M.connector = {
    enter: "none",
    build: function (el, p, c) {
      var ox = parseFloat(el.style.left);
      var oy = parseFloat(el.style.top);
      var s = svgEl("svg", { viewBox: "0 0 " + W(el) + " " + H(el) }, el);
      s.style.cssText = "position:absolute;left:0;top:0;width:100%;height:100%;overflow:visible";
      var a = [p.from[0] - ox, p.from[1] - oy];
      var b = [p.to[0] - ox, p.to[1] - oy];
      var bend = p.bend !== undefined ? p.bend : 0.6;
      var d = "M" + a[0] + " " + a[1] + " C " + a[0] + " " + (a[1] + (b[1] - a[1]) * bend) + ", " + b[0] + " " + (b[1] - (b[1] - a[1]) * bend) + ", " + b[0] + " " + b[1];
      var colour = { amber: HF.col("#d9a441"), grey: HF.col("#3b4047"), red: HF.col("#ff375c"), purple: HF.col("#a77bfb") }[p.tone || "amber"];
      var path = svgEl("path", { d: d, fill: "none", stroke: colour, "stroke-width": p.width || 2 }, s);
      var len = path.getTotalLength ? path.getTotalLength() : 600;
      path.setAttribute("stroke-dasharray", len);
      path.setAttribute("stroke-dashoffset", p.drawn ? 0 : len);
      c.entity("path", path);
      return {
        ops: {
          // SPEC draw.connector: 300-433 ms, sine.inOut (R3/R5), nearly length-independent
          draw: function (e) {
            c.tl.to(path, { attr: { "stroke-dashoffset": 0 }, duration: (e.value && e.value.dur) || 0.4, ease: "sine.inOut" }, e.t);
          },
        },
      };
    },
  };
})(typeof window !== "undefined" ? window : globalThis);
