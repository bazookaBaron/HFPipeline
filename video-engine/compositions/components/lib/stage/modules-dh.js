/*
 * HFStage DH modules -- dark-HUD-persistent profile (refs R1/R2), measured geometry.
 * Every size below is 1080x1920 px taken from analysis/pacing-audit-20260924/design/R2/AUDIT.md
 * (native 720p x1.5) and full-res crops of R2 13.5 s / 61.48 s. Modules lay themselves out
 * relative to their rect (CSS %/flex), so a hard-cut relayout only changes the rect.
 *
 * Module contract: HFStage.modules[type] = { layer?: "chrome", enter?: recipe,
 *   build(el, props, mctx) -> { ops?: {op(e)}, enter?(t, recipe, run), exit?(t, kind), place?(rect, t, layout, first) } }
 * mctx: { id, tl, F, entity(sub, node), modules, entities, mk }
 */
(function (global) {
  "use strict";
  var HF = (global.HFStage = global.HFStage || { modules: {} });
  var M = HF.modules;
  var SVG = "http://www.w3.org/2000/svg";

  var CSS = [
    // bundled mono (R1/R2 data face; OFL, assets/fonts/jetbrains-mono) -- deterministic on any machine
    "@font-face{font-family:'JetBrains Mono';font-weight:400;font-style:normal;src:url('assets/fonts/jetbrains-mono/JetBrainsMono-Regular.woff2') format('woff2');}",
    "@font-face{font-family:'JetBrains Mono';font-weight:500;font-style:normal;src:url('assets/fonts/jetbrains-mono/JetBrainsMono-Medium.woff2') format('woff2');}",
    "@font-face{font-family:'JetBrains Mono';font-weight:700;font-style:normal;src:url('assets/fonts/jetbrains-mono/JetBrainsMono-Bold.woff2') format('woff2');}",
    "@font-face{font-family:'JetBrains Mono';font-weight:800;font-style:normal;src:url('assets/fonts/jetbrains-mono/JetBrainsMono-ExtraBold.woff2') format('woff2');}",
    // tokens (SPEC 2.1 DH canonical, R2 values)
    // tokens live on the stage root ([data-profile]) so a profile can override the --x-* colours they read
    "html [data-profile]{--st-bg:var(--x-000000,#000000);--st-surface:var(--x-090d11,#090d11);--st-border:var(--x-15191d,#15191d);--st-text:var(--x-f1f5fd,#f1f5fd);--st-text2:var(--x-c9d0d6,#c9d0d6);--st-muted:var(--x-8b9098,#8b9098);--st-micro:var(--x-7e848b,#7e848b);",
    "--st-blue:var(--x-4b9afb,#4b9afb);--st-blue-hd:var(--x-68a1e9,#68a1e9);--st-blue-fill:var(--x-091931,#091931);--st-blue-line:var(--x-29456d,#29456d);--st-blue-txt:var(--x-6ea8ff,#6ea8ff);",
    "--st-green:var(--x-2ad56c,#2ad56c);--st-green-hd:var(--x-4ec57c,#4ec57c);--st-green-fill:var(--x-032815,#032815);--st-green-line:var(--x-225d40,#225d40);",
    "--st-orange:var(--x-f57201,#f57201);--st-purple:var(--x-894bff,#894bff);--st-purple-txt:var(--x-c282fc,#c282fc);--st-red:var(--x-ff375c,#ff375c);--st-amber:var(--x-fcba48,#fcba48);--st-amber-fill:var(--x-3b2600,#3b2600);",
    "--st-sans:Inter,'Inter Display',ui-sans-serif,system-ui,sans-serif;--st-mono:'JetBrains Mono','IBM Plex Mono',ui-monospace,monospace;}",
    "html .st-bg{position:absolute;left:0;top:0;width:1080px;height:1920px;background-color:var(--st-bg);}",
    // static dot grid: 3 px dots, centres at 27+54k (R2 measured), radial mask centred ~ (540,840)
    "html .st-bg::before{content:'';position:absolute;inset:0;background-image:radial-gradient(circle,var(--x-141414,#141414) 0,var(--x-141414,#141414) 1.5px,transparent 1.75px);background-size:54px 54px;background-position:0 0;",
    "-webkit-mask-image:radial-gradient(ellipse 720px 560px at 540px 840px,var(--x-000000,#000000) 30%,transparent 100%);mask-image:radial-gradient(ellipse 720px 560px at 540px 840px,var(--x-000000,#000000) 30%,transparent 100%);}",
    "html .st-content,html .st-chrome,html .st-mascot-layer{position:absolute;left:0;top:0;width:1080px;height:1920px;}",
    "html .st-mod{position:absolute;box-sizing:border-box;font-family:var(--st-sans);color:var(--st-text);}",
    "html .st-mascot{position:absolute;}html .st-mascot-img{position:absolute;left:0;top:0;width:100%;height:100%;object-fit:contain;object-position:50% 100%;}",
    "html .st-mono{font-family:var(--st-mono);}",
    "html .st-caps{text-transform:uppercase;letter-spacing:.14em;font-weight:700;}",
    "html .st-strike{position:absolute;left:-2%;top:50%;width:104%;height:3px;margin-top:-1.5px;background:var(--st-amber);border-radius:2px;}",
    "html .st-strike[data-tone=red]{background:var(--st-red);}",
    "html .st-panel{background:var(--st-surface);border:1.5px solid var(--st-border);border-radius:9px;}",
    // HUD (M1)
    "html .st-hud{display:flex;align-items:center;padding:0 24px;gap:0;}",
    "html .st-hud .h-host{font-family:var(--st-mono);font-size:20px;color:var(--st-text2);margin-right:18px;white-space:nowrap;}",
    "html .st-hud .h-ver{font-family:var(--st-mono);font-size:19px;color:var(--x-8d939a,#8d939a);margin-left:18px;white-space:nowrap;}",
    "html .st-hud .h-sp{flex:1;}",
    "html .st-hud .h-val{font-family:var(--st-mono);font-size:21px;font-weight:700;color:var(--st-text);}",
    "html .st-hud .h-val[data-tone=red]{color:var(--st-red);}",
    "html .st-hud .h-lab{font-size:12px;letter-spacing:.2em;font-weight:700;color:var(--st-micro);margin-left:12px;text-transform:uppercase;}",
    // pill (HUD env pill, floating annotation pills, status chips)
    "html .st-pill{display:inline-flex;align-items:center;gap:8px;height:34px;padding:0 15px;border-radius:17px;border:1.5px solid var(--x-2a4a7a,#2a4a7a);background:var(--x-0b1a36,#0b1a36);color:var(--x-6393d2,#6393d2);",
    "font-size:14px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;white-space:nowrap;}",
    "html .st-pill .dot{width:7px;height:7px;border-radius:50%;background:currentColor;}",
    "html .st-pill[data-tone=green]{background:var(--x-062313,#062313);border-color:var(--x-225d40,#225d40);color:var(--x-4ec57c,#4ec57c);}",
    "html .st-pill[data-tone=red]{background:var(--x-3f0b14,#3f0b14);border-color:var(--x-893c45,#893c45);color:var(--st-red);}",
    "html .st-pill[data-tone=amber]{background:var(--st-amber-fill);border-color:var(--x-513b17,#513b17);color:var(--x-dcae5e,#dcae5e);}",
    "html .st-pill[data-tone=purple]{background:var(--x-201336,#201336);border-color:var(--x-4a3470,#4a3470);color:var(--st-purple-txt);}",
    "html .st-pill[data-tone=grey]{background:var(--x-0b0f14,#0b0f14);border-color:var(--x-2a2f35,#2a2f35);color:var(--st-text2);}",
    "html .st-pill[data-tone=mono]{font-family:var(--st-mono);letter-spacing:0;text-transform:none;font-weight:500;font-size:19px;}",
    // section label (M2)
    "html .st-label{display:flex;align-items:flex-start;justify-content:center;font-weight:800;font-size:45px;line-height:1;letter-spacing:.01em;text-transform:uppercase;color:var(--x-e8eaed,#e8eaed);white-space:nowrap;}",
    "html .st-label[data-tone=orange]{color:var(--st-orange);}html .st-label[data-tone=purple]{color:var(--st-purple-txt);}html .st-label[data-tone=red]{color:var(--st-red);}",
    "html .st-label[data-tone=blue]{color:var(--st-blue);}html .st-label[data-tone=green]{color:var(--st-green);}",
    // router pill (M5)
    "html .st-router{display:flex;align-items:center;padding:0 22px;gap:0;}",
    "html .st-router .r-tile{width:40px;height:40px;border-radius:9px;background:var(--st-purple);display:flex;align-items:center;justify-content:center;flex:none;margin-right:18px;}",
    "html .st-router .r-l{font-family:var(--st-mono);font-size:18.5px;color:var(--x-a3aab3,#a3aab3);white-space:nowrap;}",
    "html .st-router .r-chip{font-family:var(--st-mono);font-size:18.5px;color:var(--x-eef2f7,#eef2f7);border:1.5px solid var(--x-3a4047,#3a4047);border-radius:6px;padding:1px 10px;margin:0 18px;white-space:nowrap;}",
    "html .st-router .r-tg{font-family:var(--st-mono);font-size:18.5px;color:var(--x-a3aab3,#a3aab3);white-space:nowrap;margin-right:8px;}",
    "html .st-router .r-pct{font-family:var(--st-mono);font-size:21px;font-weight:700;white-space:nowrap;margin-right:26px;}",
    "html .st-router .r-pct.b{color:var(--st-blue);}html .st-router .r-pct.g{color:var(--st-green);}",
    "html .st-router .r-body{display:flex;align-items:center;}html .st-router .r-row{display:flex;align-items:center;}",
    "html .st-router[data-rows='1'] .r-micro{display:none;}html .st-router[data-rows='2'] .r-chip{margin:0 0 0 14px;}",
    "html .st-router[data-rows='2']{border-radius:12px;padding:0 24px 0 20px;align-items:center;}",
    "html .st-router[data-rows='2'] .r-tile{width:52px;height:52px;border-radius:11px;}",
    "html .st-router[data-rows='2'] .r-body{flex:1;flex-direction:column;align-items:flex-start;gap:12px;}",
    "html .st-router[data-rows='2'] .r-micro{position:absolute;right:24px;top:32px;}",
    "html .st-router .r-micro{font-size:12px;letter-spacing:.18em;font-weight:700;color:var(--st-micro);text-transform:uppercase;white-space:nowrap;}",
    // lever (M6)
    "html .st-lever svg{position:absolute;left:0;top:0;width:100%;height:100%;overflow:visible;}",
    "html .st-lever .knob{position:absolute;top:21px;width:60px;height:60px;margin:-30px 0 0 -30px;border-radius:50%;background:radial-gradient(circle,var(--x-1c2126,#1c2126) 0,var(--x-15191d,#15191d) 60%,var(--x-101418,#101418) 100%);border:1.5px solid var(--x-262b30,#262b30);}",
    "html .st-lever .knob::after{content:'';position:absolute;left:50%;top:50%;width:16px;height:16px;margin:-8px 0 0 -8px;border-radius:50%;background:var(--x-eef1f4,#eef1f4);}",
    "html .st-lever .stand{position:absolute;top:36px;width:10px;height:62px;margin-left:-5px;background:linear-gradient(90deg,var(--x-b9bec4,#b9bec4),var(--x-f1f3f5,#f1f3f5) 45%,var(--x-aeb3b9,#aeb3b9));}",
    "html .st-lever .base{position:absolute;top:98px;width:51px;height:7px;margin-left:-25.5px;border-radius:3px;background:var(--x-d5d9de,#d5d9de);}",
    "html .st-lever .base.idle{background:var(--x-30353b,#30353b);height:5px;top:99px;}",
    // env card (M7)
    "html .st-card{border-radius:12px;border:1.5px solid var(--c-line);background:var(--c-fill);overflow:hidden;}",
    "html .st-card[data-env=blue]{--c-line:var(--st-blue-line);--c-fill:var(--st-blue-fill);--c-hd:var(--st-blue-hd);--c-acc:var(--st-blue);--c-ver:var(--st-blue-txt);--c-verfill:var(--x-0d2140,#0d2140);}",
    "html .st-card[data-env=green]{--c-line:var(--st-green-line);--c-fill:var(--st-green-fill);--c-hd:var(--st-green-hd);--c-acc:var(--st-green);--c-ver:var(--x-5fd08c,#5fd08c);--c-verfill:var(--x-06301a,#06301a);}",
    "html .st-card[data-flash='1']{--c-fill:var(--x-4f2f2b,#4f2f2b);}",
    "html .st-card .c-hd{position:absolute;left:0;right:0;top:0;height:55px;border-bottom:1.5px solid var(--c-line);display:flex;align-items:center;padding:0 22px;}",
    "html .st-card .c-name{font-size:22px;font-weight:800;letter-spacing:.14em;color:var(--c-hd);}",
    "html .st-card .c-live{margin-left:auto;height:25px;padding:0 12px;border-radius:13px;border:1.5px solid var(--x-c9d0d6,#c9d0d6);background:var(--x-0b0f14,#0b0f14);color:var(--x-f1f5fd,#f1f5fd);font-size:13px;font-weight:700;letter-spacing:.14em;display:flex;align-items:center;}",
    "html .st-card .c-none{margin-left:auto;width:34px;height:30px;border-radius:6px;border:1.5px solid var(--c-line);color:var(--c-hd);display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:700;}",
    "html .st-card .c-sub{position:absolute;left:22px;right:16px;top:72px;height:32px;display:flex;align-items:center;}",
    "html .st-card .c-tg{font-family:var(--st-mono);font-size:19px;color:var(--x-8b98ab,#8b98ab);}",
    "html .st-card .c-ver{margin-left:auto;font-family:var(--st-mono);font-size:19px;color:var(--c-ver);border:1.5px solid var(--c-line);background:var(--c-verfill);border-radius:6px;height:31px;padding:0 10px;display:flex;align-items:center;}",
    "html .st-card .c-row{position:absolute;left:22px;right:11px;height:32px;display:flex;align-items:center;}",
    "html .st-card .c-tile{width:30px;height:30px;border-radius:6px;background:var(--st-orange);flex:none;display:flex;align-items:center;justify-content:center;margin-right:13px;}",
    "html .st-card .c-id{font-family:var(--st-mono);font-size:19px;color:var(--x-d3dcea,#d3dcea);}",
    "html .st-card .c-dot{position:absolute;right:121px;width:9px;height:9px;border-radius:50%;background:var(--x-eef1f4,#eef1f4);flex:none;}",
    "html .st-card .c-st{margin-left:auto;font-size:13px;font-weight:700;letter-spacing:.14em;color:var(--x-dfe6ee,#dfe6ee);text-transform:uppercase;}",
    "html .st-card .c-row[data-status=idle] .c-st{color:var(--x-8b9098,#8b9098);}html .st-card .c-row[data-status=idle] .c-dot{background:var(--x-7e8791,#7e8791);}",
    "html .st-card .c-row[data-status=draining] .c-st{color:var(--st-amber);}html .st-card .c-row[data-status=draining] .c-dot{background:var(--st-amber);}",
    "html .st-card .c-row[data-status=unhealthy] .c-st{color:var(--st-red);}html .st-card .c-row[data-status=unhealthy] .c-dot{background:var(--st-red);}",
    "html .st-card .c-row[data-status=unhealthy] .c-id{color:var(--st-red);}",
    "html .st-card .c-note{position:absolute;left:22px;right:16px;top:264px;font-size:14px;font-weight:700;letter-spacing:.12em;color:var(--x-d9a441,#d9a441);text-transform:uppercase;white-space:nowrap;}",
    "html .st-card .c-note[data-tone=green]{color:var(--st-green-hd);}html .st-card .c-note[data-tone=red]{color:var(--st-red);}",
    "html .st-card .c-foot{position:absolute;left:22px;bottom:30px;display:flex;align-items:baseline;}",
    "html .st-card .c-pct{font-family:var(--st-mono);font-size:30px;font-weight:700;color:var(--x-eef2f7,#eef2f7);font-variant-numeric:tabular-nums;}",
    "html .st-card .c-of{font-size:13px;font-weight:700;letter-spacing:.16em;color:var(--x-878d94,#878d94);margin-left:10px;}",
    // users (M4)
    "html .st-users svg{position:absolute;left:0;top:0;width:100%;height:100%;overflow:visible;}",
    "html .st-users .u-lab{position:absolute;left:0;right:0;text-align:center;font-size:12px;font-weight:700;letter-spacing:.22em;color:var(--st-micro);}",
    // headline (M3)
    "html .st-headline{display:flex;flex-direction:column;align-items:center;justify-content:flex-start;}",
    "html .st-headline .hl{font-weight:800;text-transform:uppercase;letter-spacing:-.03em;line-height:1;white-space:nowrap;color:var(--x-ebeef5,#ebeef5);}",
    "html .st-headline .hl[data-tone=blue]{color:var(--st-blue);}html .st-headline .hl[data-tone=green]{color:var(--st-green);}",
    "html .st-headline .hl[data-tone=red]{color:var(--st-red);}html .st-headline .hl[data-tone=purple]{color:var(--st-purple-txt);}html .st-headline .hl[data-tone=amber]{color:var(--st-amber);}",
    // banner / alert card (M10)
    "html .st-banner{display:flex;flex-direction:column;justify-content:center;padding:0 26px;}",
    "html .st-banner .b-eye{font-size:13px;font-weight:700;letter-spacing:.2em;color:var(--x-898a8e,#898a8e);text-transform:uppercase;}",
    "html .st-banner .b-title{font-size:39px;font-weight:800;color:var(--st-text);margin-top:8px;white-space:nowrap;}",
    "html .st-banner .b-title.mono{font-family:var(--st-mono);font-weight:700;font-size:34px;}",
    "html .st-banner[data-tone=red] .b-title{color:var(--x-f83c64,#f83c64);}html .st-banner[data-tone=purple] .b-title{color:var(--st-purple-txt);}html .st-banner[data-tone=amber] .b-title{color:var(--st-amber);}",
    "html .st-banner .b-sub{font-size:13px;font-weight:600;letter-spacing:.12em;color:var(--x-72767a,#72767a);margin-top:8px;text-transform:uppercase;}",
    "html [data-hl='1']{outline:3px solid var(--st-blue);outline-offset:4px;}",
  ].join("\n");

  function ensureStyle() {
    if (document.getElementById("st-dh-style")) return;
    var s = document.createElement("style");
    s.id = "st-dh-style";
    s.textContent = CSS;
    document.head.appendChild(s);
  }
  ensureStyle();

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

  // Small glyphs (white on a coloured tile), drawn inline so nothing is fetched at render time.
  function glyph(kind, size) {
    var s = svgEl("svg", { viewBox: "0 0 24 24", width: size, height: size, fill: "none", stroke: "#fff", "stroke-width": "2.2", "stroke-linecap": "round", "stroke-linejoin": "round" });
    if (kind === "share") {
      svgEl("circle", { cx: 6, cy: 12, r: 2.6 }, s);
      svgEl("circle", { cx: 18, cy: 6, r: 2.6 }, s);
      svgEl("circle", { cx: 18, cy: 18, r: 2.6 }, s);
      svgEl("path", { d: "M8.4 10.8 15.6 7.2M8.4 13.2l7.2 3.6" }, s);
    } else if (kind === "stack") {
      svgEl("rect", { x: 8, y: 3.5, width: 12.5, height: 12.5, rx: 2 }, s);
      svgEl("path", { d: "M15.5 20.5H6a2.5 2.5 0 0 1-2.5-2.5V8.5" }, s);
    }
    return s;
  }

  // ---------------- HUD (M1) ----------------
  M.hud = {
    layer: "chrome",
    enter: "fade",
    build: function (el, p, c) {
      el.classList.add("st-panel", "st-hud");
      c.entity("host", div("h-host", el, p.host || "shop.example.com"));
      var pill = c.entity("env", div("st-pill", el));
      pill.setAttribute("data-tone", p.envTone || "blue");
      div("dot", pill);
      c.entity("envText", div("", pill, p.env || "PROD"));
      c.entity("version", div("h-ver", el, p.version || ""));
      div("h-sp", el);
      var v = c.entity("value", div("h-val", el, p.value || "0.4%"));
      if (p.valueTone) v.setAttribute("data-tone", p.valueTone);
      c.entity("valueLabel", div("h-lab", el, p.valueLabel || "errors"));
      return {
        ops: {
          // env pill flip: text + tone in one frame (R2 64.517)
          env: function (e) {
            c.tl.set(pill, { attr: { "data-tone": e.value.tone || "blue" } }, e.t);
            c.tl.set(c.entities[c.id + ".envText"], { textContent: String(e.value.text) }, e.t);
          },
        },
      };
    },
  };

  // ---------------- section label (M2) ----------------
  M.label = {
    enter: "fade",
    build: function (el, p, c) {
      el.classList.add("st-label");
      if (p.tone) el.setAttribute("data-tone", p.tone);
      el.textContent = p.text || "";
      return {};
    },
  };

  // ---------------- pill (M17 floating annotation / chips) ----------------
  M.pill = {
    enter: "fade",
    build: function (el, p, c) {
      el.style.display = "flex";
      el.style.alignItems = "center";
      el.style.justifyContent = p.align === "left" ? "flex-start" : "center";
      var pill = div("st-pill", el);
      pill.setAttribute("data-tone", p.tone || "grey");
      if (p.dot) div("dot", pill);
      c.entity("text", div("", pill, p.text || ""));
      return {};
    },
  };

  // ---------------- router pill (M5) ----------------
  M.router = {
    enter: "fade",
    build: function (el, p, c) {
      el.classList.add("st-panel", "st-router");
      el.setAttribute("data-rows", parseFloat(el.style.height) > 90 ? "2" : "1");
      var tile = div("r-tile", el);
      tile.appendChild(glyph("share", 30));
      var body = div("r-body", el);
      var row1 = div("r-row", body);
      var row2 = div("r-row", body);
      div("r-l", row1, p.listener || "listener :443");
      div("r-chip", row1, p.action || "forward");
      div("r-tg", row2, p.leftTg || "blue-tg");
      var lp = c.entity("leftPct", div("r-pct b", row2, (p.left !== undefined ? p.left : 100) + "%"));
      div("r-tg", row2, p.rightTg || "green-tg");
      var rp = c.entity("rightPct", div("r-pct g", row2, (p.right !== undefined ? p.right : 0) + "%"));
      div("r-micro", el, p.micro || "APPLICATION LOAD BALANCER");
      var state = { left: p.left !== undefined ? p.left : 100, right: p.right !== undefined ? p.right : 0 };
      function countTo(node, from, to, t, dur) {
        var o = { v: from };
        c.tl.to(o, { v: to, duration: dur, ease: "power2.inOut", immediateRender: false, onUpdate: function () { node.textContent = Math.round(o.v) + "%"; } }, t);
      }
      return {
        place: function (rect, t) {
          c.tl.set(el, { attr: { "data-rows": rect[3] > 90 ? "2" : "1" } }, t);
        },
        ops: {
          // value {left?, right?, dur?}: counters in lock-step with the lever (R2 E4: lever 600 ms,
          // counters 500 ms, both ease-in-out); the LIVE side follows the majority (single-LIVE invariant).
          traffic: function (e) {
            var v = e.value || {};
            var nl = v.left !== undefined ? v.left : 100 - v.right;
            var nr = v.right !== undefined ? v.right : 100 - nl;
            var dur = v.dur || 0.5;
            countTo(lp, state.left, nl, e.t, dur);
            countTo(rp, state.right, nr, e.t, dur);
            var lever = p.lever && c.modules[p.lever];
            var cards = [p.leftCard && c.modules[p.leftCard], p.rightCard && c.modules[p.rightCard]];
            var wasLeft = state.left >= state.right;
            var nowLeft = nl >= nr;
            if (cards[0] && cards[0].api.setPct) cards[0].api.setPct(state.left, nl, e.t, dur);
            if (cards[1] && cards[1].api.setPct) cards[1].api.setPct(state.right, nr, e.t, dur);
            if (wasLeft !== nowLeft) {
              var travel = v.leverDur || 0.6;
              if (lever && lever.api.moveTo) lever.api.moveTo(nowLeft ? "left" : "right", e.t, travel);
              if (cards[0] && cards[0].api.setLive) cards[0].api.setLive(nowLeft, e.t + travel);
              if (cards[1] && cards[1].api.setLive) cards[1].api.setLive(!nowLeft, e.t + travel);
            }
            state.left = nl;
            state.right = nr;
          },
        },
      };
    },
  };

  // ---------------- traffic lever (M6) ----------------
  M.lever = {
    enter: "fade",
    build: function (el, p, c) {
      el.classList.add("st-lever");
      var L = p.leftAt !== undefined ? p.leftAt : 24.24; // % of width: card centres (R2 T1: 497/850 over 330-1020)
      var R = p.rightAt !== undefined ? p.rightAt : 75.33;
      var side = p.side === "right" ? "right" : "left";
      var s = svgEl("svg", { viewBox: "0 0 100 106", preserveAspectRatio: "none" }, el);
      var track = svgEl("line", { x1: L, y1: 21, x2: R, y2: 21, stroke: HF.col("#3a3f45"), "stroke-width": 1.5, "vector-effect": "non-scaling-stroke" }, s);
      var dash = svgEl("line", { x1: side === "left" ? L : R, y1: 21, x2: side === "left" ? R : L, y2: 99, stroke: HF.col("#30353b"), "stroke-width": 1.5, "stroke-dasharray": "9 7", "vector-effect": "non-scaling-stroke" }, s);
      void track;
      var endDot = div("", el);
      Object.assign(endDot.style, { position: "absolute", top: "21px", width: "11px", height: "11px", margin: "-5.5px 0 0 -5.5px", borderRadius: "50%", background: HF.col("#4a4f55"), left: (side === "left" ? R : L) + "%" });
      var idleBase = div("base idle", el);
      idleBase.style.left = (side === "left" ? R : L) + "%";
      var base = div("base", el);
      var stand = div("stand", el);
      var knob = div("knob", el);
      [base, stand, knob].forEach(function (n) {
        n.style.left = (side === "left" ? L : R) + "%";
      });
      c.entity("knob", knob);
      return {
        moveTo: function (to, t, dur) {
          var x = to === "left" ? L : R;
          var o = to === "left" ? R : L;
          c.tl.to([base, stand, knob], { left: x + "%", duration: dur, ease: "power2.inOut" }, t);
          c.tl.to(dash, { attr: { x1: x }, duration: dur, ease: "power2.inOut" }, t);
          c.tl.set(dash, { attr: { x2: o } }, t);
          c.tl.set([endDot, idleBase], { left: o + "%" }, t);
        },
      };
    },
  };

  // ---------------- env card (M7) ----------------
  M.envCard = {
    enter: "fade",
    build: function (el, p, c) {
      el.classList.add("st-card");
      el.setAttribute("data-env", p.env || "blue");
      var hd = div("c-hd", el);
      div("c-name", hd, (p.name || p.env || "BLUE").toUpperCase());
      // R2: only the LIVE side carries a header chip; the idle header is empty.
      var live = c.entity("live", div("c-live", hd, "LIVE"));
      live.style.opacity = p.live ? 1 : 0;
      live.style.position = "absolute";
      live.style.right = "16px";
      var sub = div("c-sub", el);
      div("c-tg", sub, p.tg || (p.env || "blue") + "-tg");
      c.entity("version", div("c-ver", sub, p.version || "v1.4.2"));
      (p.instances || []).slice(0, 3).forEach(function (inst, i) {
        var row = div("c-row", el);
        row.style.top = 114 + i * 54 + "px"; // rows at 54 px pitch, centres 130/184/238
        row.setAttribute("data-status", inst.status || "healthy");
        var tile = div("c-tile", row);
        tile.appendChild(glyph("stack", 19));
        div("c-id", row, inst.id);
        div("c-dot", row);
        var st = div("c-st", row, (inst.status || "healthy").toUpperCase());
        c.entity("row" + (i + 1), row);
        c.entity("row" + (i + 1) + ".status", st);
      });
      var note = c.entity("note", div("c-note", el, p.note || ""));
      if (p.noteTone) note.setAttribute("data-tone", p.noteTone);
      var foot = div("c-foot", el);
      var pct = c.entity("pct", div("c-pct", foot, (p.pct !== undefined ? p.pct : 0) + "%"));
      div("c-of", foot, "OF TRAFFIC");
      return {
        ops: {
          // row status flip, value {row:1..3, status}
          status: function (e) {
            var row = c.entities[c.id + ".row" + e.value.row];
            if (!row) throw new Error("no row " + e.value.row);
            c.tl.set(row, { attr: { "data-status": e.value.status } }, e.t);
            c.tl.set(c.entities[c.id + ".row" + e.value.row + ".status"], { textContent: String(e.value.status).toUpperCase() }, e.t);
          },
          // all rows in one beat, optional stagger (R2 row cascades ~150 ms)
          statusAll: function (e) {
            (p.instances || []).slice(0, 3).forEach(function (_, i) {
              var t = e.t + i * (e.value.stagger || 0);
              c.tl.set(c.entities[c.id + ".row" + (i + 1)], { attr: { "data-status": e.value.status } }, t);
              c.tl.set(c.entities[c.id + ".row" + (i + 1) + ".status"], { textContent: String(e.value.status).toUpperCase() }, t);
            });
          },
          note: function (e) {
            c.tl.set(note, { textContent: String(e.value.text || ""), attr: { "data-tone": e.value.tone || "" } }, e.t);
          },
          dimCard: function (e) {
            c.tl.to(el, { opacity: e.value && e.value.level !== undefined ? e.value.level : 0.45, duration: 0.133, ease: "power2.out" }, e.t);
          },
          undimCard: function (e) {
            c.tl.to(el, { opacity: 1, duration: 0.133, ease: "power2.out" }, e.t);
          },
        },
        setLive: function (on, t) {
          c.tl.to(live, { opacity: on ? 1 : 0, duration: 0.13, ease: "power2.out" }, t);
        },
        setPct: function (from, to, t, dur) {
          var o = { v: from };
          c.tl.to(o, { v: to, duration: dur, ease: "power2.inOut", immediateRender: false, onUpdate: function () { pct.textContent = Math.round(o.v) + "%"; } }, t);
        },
      };
    },
  };

  // ---------------- users row + fan-out (M4) ----------------
  M.users = {
    enter: "fade",
    build: function (el, p, c) {
      el.classList.add("st-users");
      var n = p.count || 9;
      var pitch = p.pitch || 78;
      var W = parseFloat(el.style.width);
      var H = parseFloat(el.style.height);
      var s = svgEl("svg", { viewBox: "0 0 " + W + " " + H }, el);
      var cx = W / 2;
      var rowW = pitch * (n - 1);
      var x0 = cx - rowW / 2;
      var convY = p.convergeY || 104; // fan meets above the label
      var lines = svgEl("g", { stroke: HF.col("#3b4047"), "stroke-width": 1.5, fill: "none" }, s);
      var people = [];
      for (var i = 0; i < n; i++) {
        var x = x0 + i * pitch;
        svgEl("path", { d: "M" + x + " 44 C " + x + " " + (convY - 20) + ", " + cx + " " + (convY - 44) + ", " + cx + " " + convY }, lines);
        var g = svgEl("g", { transform: "translate(" + (x - 18) + ",0)", fill: HF.col("#dfe3e9") }, s);
        svgEl("circle", { cx: 18, cy: 10, r: 9.5 }, g);
        svgEl("path", { d: "M2 40c0-9.5 7.2-17 16-17s16 7.5 16 17z" }, g);
        g.setAttribute("data-entity", c.id + ".u" + (i + 1));
        c.entities[c.id + ".u" + (i + 1)] = g;
        people.push(g);
      }
      var lab = div("u-lab", el, p.label || "USERS");
      lab.style.top = convY - 30 + "px";
      // dotted stem: 5 dots from the convergence point down to the router
      var stemTop = convY + 8;
      var stemBot = H - 8;
      for (var d = 0; d < 5; d++) {
        svgEl("circle", { cx: cx, cy: stemTop + ((stemBot - stemTop) * d) / 4, r: 4.5, fill: d < 3 ? HF.col("#e6e9ed") : HF.col("#8b9098") }, s);
      }
      return {
        ops: {
          // value {tone:"red"|"white"|"dim", cascade?:true}: R2 E13 random-order, ~54 ms stagger
          tone: function (e) {
            var colour = { red: "#ed3456", white: HF.col("#dfe3e9"), dim: "#555a61" }[e.value.tone] || HF.col("#dfe3e9");
            var order = [3, 7, 2, 6, 1, 5, 9, 4, 8, 11, 10, 12].filter(function (k) { return k <= n; });
            order.forEach(function (k, j) {
              c.tl.set(people[k - 1], { attr: { fill: colour } }, e.t + (e.value.cascade === false ? 0 : j * 0.054));
            });
          },
        },
      };
    },
  };

  // ---------------- headline (M3): per-line rise + fade, 100 ms stagger, grey -> white ----------------
  M.headline = {
    exit: "down",
    build: function (el, p, c) {
      el.classList.add("st-headline");
      var size = p.size || 107; // cap 78 (R2 "SWITCH THE / TRAFFIC")
      var pitch = p.pitch || 123;
      // fit every line inside the module width (a 21-glyph line at 95 px ran off the 1080 frame):
      // canvas-measured Inter 800 caps, minus the -0.03 em tracking, one size for all lines
      var maxW = parseFloat(el.style.width) || 1000;
      (p.lines || []).forEach(function (ln) {
        var txt = String(typeof ln === "string" ? ln : ln.text || "").toUpperCase();
        var wpx = global.HFTextFit ? global.HFTextFit.measure(txt, 800, size, "Inter, ui-sans-serif, system-ui, sans-serif") - 0.03 * size * txt.length : txt.length * 0.68 * size;
        if (wpx > maxW) size = Math.floor((size * maxW) / wpx);
      });
      var wordSpans = [];
      var lines = (p.lines || []).map(function (ln, i) {
        var txt = typeof ln === "string" ? ln : ln.text;
        var d = div("hl", el, p.dim ? undefined : txt);
        if (p.dim) {
          // R8 N7: the headline is pre-shown at ~22% and lights word by word on its words
          wordSpans[i] = String(txt || "").split(/\s+/).map(function (w, wi, arr) {
            var sp = document.createElement("span");
            sp.textContent = w;
            sp.style.opacity = "0.22";
            d.appendChild(sp);
            if (wi < arr.length - 1) d.appendChild(document.createTextNode(" "));
            return sp;
          });
        }
        d.style.fontSize = size + "px";
        d.style.height = pitch + "px";
        if (ln.tone) d.setAttribute("data-tone", ln.tone);
        c.entity("l" + (i + 1), d);
        return d;
      });
      function pickWords(v) {
        var li = Math.max(0, ((v && v.line) || 1) - 1);
        var ws = wordSpans[li] || [];
        if (v && v.word !== undefined) {
          var k = typeof v.word === "number" ? v.word - 1 : ws.findIndex(function (sp) {
            return sp.textContent.toLowerCase().replace(/[^a-z0-9]/g, "") === String(v.word).toLowerCase().replace(/[^a-z0-9]/g, "");
          });
          return ws[k] ? [ws[k]] : [];
        }
        return ws;
      }
      return {
        ops: {
          // dim -> lit in 2-3 frames (R8 29.633 / 30.43)
          light: function (e) {
            var ws = pickWords(e.value);
            if (!ws.length) throw new Error("headline light: no such line/word");
            c.tl.to(ws, { opacity: 1, duration: 0.08, ease: "none" }, e.t);
          },
          // keyword recolour grey -> accent in 1-2 frames (R7 keywordHeadline)
          recolour: function (e) {
            var ws = pickWords(e.value);
            var col = HF.tone((e.value && e.value.tone) || "blue");
            c.tl.to(ws.length ? ws : lines, { color: col, opacity: 1, duration: 0.05, ease: "none" }, e.t);
          },
        },
        enter: function (t) {
          lines.forEach(function (d, i) {
            var at = Array.isArray(p.lineAt) && p.lineAt[i] !== undefined ? p.lineAt[i] : i * 0.1; // R2 E5: 100 ms stagger
            if (at > 0) c.tl.set(d, { autoAlpha: 0 }, t);
            c.tl.fromTo(d, { autoAlpha: 0, y: i === 0 ? 19.5 : 24 }, { autoAlpha: 1, y: 0, duration: 0.133, ease: "power2.out", immediateRender: false }, t + at);
          });
        },
        exit: function (t) {
          // R2 E5: previous row exits down 9 px + fade over 2 f
          c.tl.to(el, { y: 9, autoAlpha: 0, duration: 2 * c.F, ease: "power1.in" }, t - 2 * c.F);
          c.tl.set(el, { y: 0 }, t);
        },
      };
    },
  };

  // ---------------- banner / alert (M10) ----------------
  M.banner = {
    enter: "settle",
    build: function (el, p, c) {
      el.classList.add("st-panel", "st-banner");
      if (p.tone) el.setAttribute("data-tone", p.tone);
      if (p.eyebrow) c.entity("eyebrow", div("b-eye", el, p.eyebrow));
      c.entity("title", div("b-title" + (p.mono ? " mono" : ""), el, p.title || ""));
      if (p.sub) c.entity("sub", div("b-sub", el, p.sub));
      return {};
    },
  };
})(typeof window !== "undefined" ? window : globalThis);
