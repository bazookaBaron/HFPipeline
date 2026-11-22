/*
 * LC profile (light scene-cut, refs R3/R4) -- anatomy + chrome modules. Colours come from the
 * --x-* overrides in theme-lc.js; this file adds what differs structurally (SPEC.md 2.2, 4.2, 4.4):
 *   bg #F4F4ED + static 3 px #E7E7E0 dots, pitch 38, origin (19,19), no mask          [R4]
 *   cards/windows #FEFCF8, border 1.5 #BCC3C2, r 16, shadow 0 6 24 rgba(20,20,10,.07)  [R3,R4]
 *   window title bar #E6EDE9, 48 px, 3 grey dots 10.5 px @ 19 px pitch                 [R4]
 *   header: mono caps kicker 22 px @ x 70 cap-top 230 #3A4446; counter right-aligned to 1004; rule y 279
 *   title 72/800 @ x 70 cap-top 301 (<= 2 lines, leading 76.5); subtitle 29/400 #474C4D @ y 471
 *   footnote: blue dash 64.5x4.5 @ (320,1299) + bold 27 #151B1E @ y 1326                [R4]
 * Motion: every entrance is riseFade 22 px / 233 ms power2.out (R3 E1; R4 title 10 px).
 */
(function (global) {
  "use strict";
  var HF = (global.HFStage = global.HFStage || { modules: {} });
  var M = HF.modules;

  var CSS = [
    // background plate
    "html [data-profile=LC] .st-bg{background-color:#f4f4ed;}",
    "html [data-profile=LC] .st-bg::before{background-image:radial-gradient(circle,#e7e7e0 0,#e7e7e0 1.5px,transparent 1.75px);background-size:38px 38px;background-position:0 0;-webkit-mask-image:none;mask-image:none;}",
    // card anatomy
    "html [data-profile=LC] .st-panel,html [data-profile=LC] .st-gpanel,html [data-profile=LC] .st-kpi,html [data-profile=LC] .st-code,html [data-profile=LC] .st-win,html [data-profile=LC] .st-compare .cmp,html [data-profile=LC] .st-tree .tr-box,html [data-profile=LC] .st-letters .lt,html [data-profile=LC] .st-node .n-tile{border-radius:16px;box-shadow:0 6px 24px rgba(20,20,10,.07);}",
    "html [data-profile=LC] .st-gpanel .g-hd{background:#e6ede9;border-bottom:1.5px solid #b9bebd;height:48px;}",
    "html [data-profile=LC] .st-gpanel .g-title{font-family:var(--st-mono);letter-spacing:.04em;text-transform:none;font-size:18px;color:#3a4446;}",
    "html [data-profile=LC] .st-code .c-bar,html [data-profile=LC] .st-win .w-bar{background:#e6ede9;border-bottom:1.5px solid #b9bebd;}",
    "html [data-profile=LC] .st-code .c-dot,html [data-profile=LC] .st-win .w-dot{background:#8f989d !important;width:10.5px;height:10.5px;}",
    "html [data-profile=LC] .st-row{border-radius:9px;}",
    "html [data-profile=LC] .st-label{justify-content:flex-start;padding-left:10px;}",
    // R4 diagram node as a window card
    "html [data-profile=LC] .st-node.lcw{width:250px;height:150px;display:block;background:#fefcf8;border:1.5px solid #bcc3c2;border-radius:16px;box-shadow:0 6px 24px rgba(20,20,10,.07);overflow:hidden;gap:0;}",
    "html [data-profile=LC] .st-node.lcw .w-b{height:40px;background:#e6ede9;border-bottom:1.5px solid #b9bebd;display:flex;align-items:center;gap:7px;padding:0 14px;}",
    "html [data-profile=LC] .st-node.lcw .w-d{width:9px;height:9px;border-radius:50%;background:#8f989d;flex:none;}",
    "html [data-profile=LC] .st-node.lcw .w-l{margin-left:8px;font-family:var(--st-mono);font-size:15px;color:#3a4446;white-space:nowrap;overflow:hidden;text-transform:none;}",
    "html [data-profile=LC] .st-node.lcw .w-body{display:flex;align-items:center;gap:14px;padding:0 18px;height:108px;}",
    "html [data-profile=LC] .st-node.lcw .n-tile{width:48px;height:48px;border-radius:12px;box-shadow:none;flex:none;}",
    "html [data-profile=LC] .st-node.lcw .n-lab{font-family:var(--st-sans);font-size:26px;font-weight:800;color:#17232b;white-space:nowrap;}",
    "html [data-profile=LC] .st-node.lcw:not([data-lit]){opacity:.55;}",
    // chrome
    "html .st-lchead{display:flex;align-items:flex-start;font-family:var(--st-mono);font-size:22px;letter-spacing:.08em;color:#3a4446;text-transform:uppercase;white-space:nowrap;border-bottom:1.5px solid #c9c9c2;}",
    "html .st-lchead .k{flex:1;}html .st-lchead .n{text-align:right;}",
    "html .st-lctitle .t{font-size:72px;font-weight:800;letter-spacing:-.02em;line-height:76.5px;color:#17232b;}",
    "html .st-lctitle .s{position:absolute;left:0;top:183px;font-size:29px;font-weight:400;color:#474c4d;white-space:nowrap;}",
    "html .st-lcfoot .d{position:absolute;left:0;top:0;width:64.5px;height:4.5px;background:#206ac2;border-radius:2px;}",
    "html .st-lcfoot .x{position:absolute;left:0;top:22px;font-size:27px;font-weight:700;color:#151b1e;white-space:nowrap;}",
    "html .st-lcdisplay{font-size:105px;font-weight:800;letter-spacing:-.03em;line-height:1;color:#1766da;white-space:nowrap;}",
    "html .st-lcdisplay[data-tone=red]{color:#b23a3f;}html .st-lcdisplay[data-tone=green]{color:#187a5b;}html .st-lcdisplay[data-tone=ink]{color:#17232b;}",
  ].join("\n");
  (function () {
    if (document.getElementById("st-lc-style")) return;
    var st = document.createElement("style");
    st.id = "st-lc-style";
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

  // header: kicker left, scene counter right, rule under -- persists; counter steps in 1 frame per cut
  M.lcHeader = {
    layer: "chrome",
    enter: "none",
    build: function (el, p, c) {
      el.classList.add("st-lchead");
      div("k", el, p.kicker || "");
      var n = c.entity("counter", div("n", el, p.counter || ""));
      return {
        ops: {
          counter: function (e) {
            c.tl.set(n, { textContent: String(e.value.text) }, e.t);
          },
        },
      };
    },
  };

  // per-scene title + subtitle (R4: fade + rise 10 px over 233 ms; content group follows)
  M.lcTitle = {
    enter: "none",
    build: function (el, p, c) {
      el.classList.add("st-lctitle");
      var t = c.entity("title", div("t", el, p.title || ""));
      var s = p.subtitle ? c.entity("subtitle", div("s", el, p.subtitle)) : null;
      return {
        enter: function (at) {
          c.tl.fromTo(t, { autoAlpha: 0, y: 10 }, { autoAlpha: 1, y: 0, duration: 0.233, ease: "power2.out", immediateRender: false }, at);
          if (s) c.tl.fromTo(s, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.233, ease: "power2.out", immediateRender: false }, at);
        },
      };
    },
  };

  // footnote: blue dash + bold line (every R4 scene; R3 last-beat takeaway)
  M.lcFoot = {
    enter: "none",
    build: function (el, p, c) {
      el.classList.add("st-lcfoot");
      div("d", el);
      c.entity("text", div("x", el, p.text || ""));
      return {
        enter: function (at) {
          c.tl.fromTo(el, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.133, ease: "power2.out", immediateRender: false }, at);
        },
      };
    },
  };

  // display word / number (R4 105/800, blue by default)
  M.lcDisplay = {
    enter: "none",
    build: function (el, p, c) {
      el.classList.add("st-lcdisplay");
      if (p.tone) el.setAttribute("data-tone", p.tone);
      el.textContent = p.text || "";
      // fit to the column: Inter 800 caps average ~0.64 em per glyph at -0.03 em tracking
      var w = parseFloat(el.style.width) || 690;
      el.style.fontSize = Math.min(105, Math.floor(w / Math.max(1, String(p.text || "").length * 0.64))) + "px";
      return {
        enter: function (at) {
          c.tl.fromTo(el, { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: 0.2, ease: "back.out(1.4)", immediateRender: false }, at);
        },
      };
    },
  };
})(typeof window !== "undefined" ? window : globalThis);
