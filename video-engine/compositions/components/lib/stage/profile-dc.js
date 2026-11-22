/*
 * DC profile (dark chaptered, ref R5) -- colours, anatomy and chrome (SPEC.md 1.3, 2.1, 3.3 L11, 4.3):
 *   bg #090A0D + 1.5 px line grid @ 60 px (x = 60k, y = 28.5 + 60k), invisible below ~88% H
 *   chapter label (60, cap-top 204) cap 15 caps #A6AAAF; 10 progress segments 26x3 @ 34 px pitch,
 *   x 687-1019, y 207: past #3C424A, CURRENT #91D2E8, future #2A2E34; hairline 1.5 #191A1D @ y 237
 *   stage frame 1.5 #1F2023, 960x573 @ (60,267), subheader (72,288) cap 15 caps #AAAEB4
 *   info panel #10141A, header band #151B23 34.5 px, rows pitch 73.5, key left / value right
 *   hero: condensed serif caps, cap 72-112, left @ x 78; mono kicker +0.5-1.5 s later
 * Sub-states hard-swap in 1 frame; items light dim(~30%) -> lit in 100-167 ms, one per noun.
 */
(function (global) {
  "use strict";
  var HF = (global.HFStage = global.HFStage || { modules: {} });
  var M = HF.modules;
  HF.themes = HF.themes || {};
  // dark -> R5 surfaces / borders (everything else keeps the dark value)
  HF.themes.DC = {
    "000000": "#090a0d", "090d11": "#10141a", "0b0f14": "#10141a", "10161e": "#151b23", "1f2527": "#21252b",
    "15191d": "#15191c", "1a2024": "#1f2023", "20262d": "#252b35", "252b33": "#252b35", "4b9afb": "#8fd0e6",
    "68a1e9": "#8fd0e6", "50dbf2": "#8fd0e6", "2ad56c": "#8fd0e6", "fcba48": "#eec684", "ff375c": "#c88696",
  };

  var CSS = [
    "html [data-profile=DC] .st-bg{background-color:#090a0d;}",
    "html [data-profile=DC] .st-bg::before{background-image:linear-gradient(#131418 1.5px,transparent 1.5px),linear-gradient(90deg,#131418 1.5px,transparent 1.5px);background-size:60px 60px;background-position:-0.75px 27.75px;",
    "-webkit-mask-image:linear-gradient(#000 0%,#000 78%,transparent 88%);mask-image:linear-gradient(#000 0%,#000 78%,transparent 88%);}",
    "html [data-profile=DC] .st-gpanel{background:#10141a;border-color:#21252b;border-radius:6px;}",
    "html [data-profile=DC] .st-gpanel .g-hd{background:#151b23;height:34.5px;border-bottom:1.5px solid #21252b;padding:0 16px;}",
    "html [data-profile=DC] .st-gpanel .g-title{font-size:12px;letter-spacing:.2em;color:#90959c;}",
    "html [data-profile=DC] .st-gpanel .g-tile{width:22px;height:22px;border-radius:5px;}",
    "html [data-profile=DC] .st-row{border-radius:4px;}",
    "html [data-profile=DC] .st-row .r-tx{font-family:var(--st-mono);font-size:17px;font-weight:500;letter-spacing:.04em;text-transform:uppercase;color:#c6cacf;}",
    "html [data-profile=DC] .st-node .n-tile{width:105px;height:105px;border-radius:9px;background:#151b23;}",
    "html [data-profile=DC] .st-node:not([data-lit]){opacity:.3;}",
    // chrome
    "html .st-dcchrome .lab{position:absolute;left:0;top:-3px;font-size:21px;font-weight:600;letter-spacing:.2em;color:#a6aaaf;text-transform:uppercase;white-space:nowrap;}",
    "html .st-dcchrome .seg{position:absolute;top:3px;width:26px;height:3px;background:#2a2e34;}",
    "html .st-dcchrome .seg[data-s=past]{background:#3c424a;}html .st-dcchrome .seg[data-s=now]{background:#91d2e8;}",
    "html .st-dcchrome .rule{position:absolute;left:0;right:0;top:33px;height:1.5px;background:#191a1d;}",
    "html .st-dcstage{border:1.5px solid #1f2023;}",
    "html .st-dcstage .sub{position:absolute;left:12px;top:17px;font-size:20px;font-weight:600;letter-spacing:.2em;color:#aaaeb4;text-transform:uppercase;white-space:nowrap;}",
    "html .st-dchero .h{position:absolute;left:0;top:0;font-family:'Instrument Serif','Playfair Display',Georgia,serif;font-weight:400;font-size:150px;line-height:.92;color:#f1f3f5;text-transform:uppercase;white-space:nowrap;transform:scaleX(.82);transform-origin:0 0;letter-spacing:-.02em;}",
    "html .st-dchero .h[data-tone=teal]{color:#b3e8f7;}html .st-dchero .h[data-tone=amber]{color:#f2cf99;}",
    "html .st-dchero .k{position:absolute;left:4px;font-family:var(--st-mono);font-size:22px;letter-spacing:.14em;color:#90959c;text-transform:uppercase;white-space:nowrap;}",
    "html .st-dcpara{font-size:27px;line-height:1.35;color:#d6dadf;font-weight:500;}",
  ].join("\n");
  (function () {
    if (document.getElementById("st-dc-style")) return;
    var st = document.createElement("style");
    st.id = "st-dc-style";
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

  // chapter label + 10-seg progress + hairline; `chapter` op swaps label + lit segment in 1 frame
  M.dcChrome = {
    layer: "chrome",
    enter: "none",
    build: function (el, p, c) {
      el.classList.add("st-dcchrome");
      var lab = c.entity("label", div("lab", el, p.label || ""));
      var segs = [];
      for (var i = 0; i < 10; i++) {
        var sg = div("seg", el);
        sg.style.left = 627 + i * 34 + "px"; // module rect starts at x 60: segments at x 687-1019
        sg.setAttribute("data-s", i + 1 < (p.index || 1) ? "past" : i + 1 === (p.index || 1) ? "now" : "next");
        segs.push(sg);
      }
      div("rule", el);
      return {
        ops: {
          chapter: function (e) {
            c.tl.set(lab, { textContent: String(e.value.label) }, e.t);
            segs.forEach(function (sg, j) {
              var st = j + 1 < e.value.index ? "past" : j + 1 === e.value.index ? "now" : "next";
              c.tl.set(sg, { attr: { "data-s": st } }, e.t);
            });
          },
        },
      };
    },
  };

  // stage frame with its subheader (breadcrumb, changes on every sub-state)
  M.dcStage = {
    enter: "none",
    build: function (el, p, c) {
      el.classList.add("st-dcstage");
      var sub = c.entity("sub", div("sub", el, p.sub || ""));
      return {
        ops: {
          sub: function (e) {
            c.tl.set(sub, { textContent: String(e.value.text) }, e.t);
          },
        },
      };
    },
  };

  // serif hero line + mono kicker (R5 E12: opacity + tracking in 133 ms; kicker 0.5-1.5 s later)
  M.dcHero = {
    enter: "none",
    build: function (el, p, c) {
      el.classList.add("st-dchero");
      var h = c.entity("text", div("h", el, p.text || ""));
      if (p.tone) h.setAttribute("data-tone", p.tone);
      // fit: serif caps ~0.62 em per glyph, drawn at scaleX .82, inside the stage width
      var size = Math.min(p.size || 150, Math.floor((parseFloat(el.style.width) || 912) / Math.max(1, String(p.text || "").length * 0.62 * 0.82)));
      h.style.fontSize = size + "px";
      h.style.height = Math.round(size * 0.95) + "px"; // explicit line box so the kicker never overlaps it
      var k = p.kicker ? c.entity("kicker", div("k", el, p.kicker)) : null;
      if (k) k.style.top = Math.round(size * 0.95) + 34 + "px";
      return {
        enter: function (at) {
          c.tl.fromTo(h, { autoAlpha: 0, letterSpacing: "0.02em" }, { autoAlpha: 1, letterSpacing: "-0.02em", duration: 0.133, ease: "power2.out", immediateRender: false }, at);
          if (k) c.tl.fromTo(k, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.133, ease: "power2.out", immediateRender: false }, at + (p.kickerDelay || 0.8));
        },
      };
    },
  };

  // short paragraph beside the mascot / under a hero (R5 "The data an organisation already has...")
  M.dcPara = {
    enter: "fade",
    build: function (el, p, c) {
      el.classList.add("st-dcpara");
      c.entity("text", div("", el, p.text || ""));
      return {};
    },
  };
})(typeof window !== "undefined" ? window : globalThis);
