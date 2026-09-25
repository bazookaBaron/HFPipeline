/*
 * HFStage carousel chrome -- the static 1080x1350 carousel slides reuse the video card library;
 * these three modules are the only carousel-specific pieces, drawn in each profile's vocabulary:
 *   cHead  : brand handle (status dot) left, "02 / 08" counter right, hairline rule (DH HUD / DC chapter look)
 *   cTitle : eyebrow (caps micro, toned) + title (fit to 2 lines) + optional subtitle
 *   cFoot  : handle / site left, "SWIPE" pill with arrow right (or the site on the last slide)
 */
(function (global) {
  "use strict";
  var HF = (global.HFStage = global.HFStage || { modules: {} });
  var M = HF.modules;
  var SANS = "Inter, ui-sans-serif, system-ui, sans-serif";

  var CSS = [
    "html .st-chead{display:flex;align-items:center;font-family:var(--st-mono);font-size:21px;color:var(--x-8b9098,#8b9098);border-bottom:1.5px solid var(--x-1a2029,#1a2029);white-space:nowrap;}",
    "html .st-chead .dot{width:12px;height:12px;border-radius:50%;background:var(--st-green);margin-right:14px;}",
    "html .st-chead .h{color:var(--x-e6e9ed,#e6e9ed);font-weight:700;}html .st-chead .n{margin-left:auto;letter-spacing:.08em;}",
    "html .st-ctitle .e{font-size:17px;font-weight:700;letter-spacing:.3em;text-transform:uppercase;color:var(--st-blue);white-space:nowrap;height:30px;}",
    "html .st-ctitle .e[data-tone=green]{color:var(--st-green);}html .st-ctitle .e[data-tone=red]{color:var(--st-red);}html .st-ctitle .e[data-tone=amber]{color:var(--st-amber);}html .st-ctitle .e[data-tone=purple]{color:var(--st-purple-txt);}",
    "html .st-ctitle .t{font-weight:800;letter-spacing:-.025em;color:var(--x-ebeef5,#ebeef5);margin-top:10px;}",
    "html .st-ctitle .s{font-size:27px;font-weight:500;color:var(--x-8b9098,#8b9098);margin-top:16px;line-height:1.3;}",
    "html .st-cfoot{display:flex;align-items:center;font-family:var(--st-mono);font-size:21px;color:var(--x-8b9098,#8b9098);white-space:nowrap;border-top:1.5px solid var(--x-1a2029,#1a2029);}",
    "html .st-cfoot .sw{margin-left:auto;height:44px;padding:0 20px;border-radius:22px;border:1.5px solid var(--x-252b33,#252b33);display:flex;align-items:center;gap:10px;font-family:" + SANS + ";font-size:16px;font-weight:800;letter-spacing:.2em;color:var(--x-e6e9ed,#e6e9ed);}",
    "html .st-cfoot .sw i{display:block;width:22px;height:2.5px;background:var(--st-blue);position:relative;}",
    "html .st-cfoot .sw i::after{content:'';position:absolute;right:-1px;top:-5px;width:10px;height:10px;border:solid var(--st-blue);border-width:2.5px 2.5px 0 0;transform:rotate(45deg);}",
    // light paper
    "html [data-profile=LC] .st-chead,html [data-profile=LC] .st-cfoot{border-color:#c9c9c2;color:#474c4d;}",
    "html [data-profile=LC] .st-chead .h,html [data-profile=LC] .st-cfoot .sw{color:#17232b;}html [data-profile=LC] .st-cfoot .sw{border-color:#bcc3c2;background:#fefcf8;}",
    "html [data-profile=LC] .st-ctitle .t{color:#17232b;}html [data-profile=LC] .st-ctitle .s{color:#474c4d;}",
    // chaptered: serif display title like the DC hero
    "html [data-profile=DC] .st-ctitle .t{font-family:'Instrument Serif','Playfair Display',Georgia,serif;font-weight:400;letter-spacing:-.01em;}",
  ].join("\n");

  (function ensureStyle() {
    if (document.getElementById("st-car-style")) return;
    var st = document.createElement("style");
    st.id = "st-car-style";
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

  M.cHead = {
    enter: "none",
    build: function (el, p, c) {
      el.classList.add("st-chead");
      div("dot", el);
      c.entity("handle", div("h", el, p.handle || ""));
      if (p.kicker) div("k", el, "  /  " + p.kicker);
      c.entity("counter", div("n", el, p.counter || ""));
      return {};
    },
  };

  M.cTitle = {
    enter: "rise",
    build: function (el, p, c) {
      el.classList.add("st-ctitle");
      var W = parseFloat(el.style.width) || 960;
      if (p.eyebrow) {
        var e = c.entity("eyebrow", div("e", el, p.eyebrow));
        if (p.tone) e.setAttribute("data-tone", p.tone);
      }
      var t = c.entity("title", div("t", el, p.title || ""));
      var fit = global.HFTextFit
        ? global.HFTextFit.fitFontToBox(String(p.title || ""), { family: HF.profile === "DC" ? "'Playfair Display', Georgia, serif" : SANS, weight: HF.profile === "DC" ? 400 : 800, maxWidth: W, baseSize: p.size || 64, minSize: 38, lineHeightRatio: 1.08, maxLines: 2 })
        : { fontSize: 56 };
      t.style.fontSize = fit.fontSize + "px";
      t.style.lineHeight = "1.08";
      if (p.subtitle) c.entity("subtitle", div("s", el, p.subtitle));
      return {};
    },
  };

  M.cFoot = {
    enter: "none",
    build: function (el, p, c) {
      el.classList.add("st-cfoot");
      c.entity("left", div("l", el, p.left || ""));
      var sw = c.entity("swipe", div("sw", el, p.right || "SWIPE"));
      if (p.arrow !== false) div("", sw).outerHTML = "<i></i>";
      return {};
    },
  };
})(typeof window !== "undefined" ? window : globalThis);
