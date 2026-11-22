/*
 * BR cards (light brutalist, ref R7 -- analysis/pacing-audit-20260924/design/R7/AUDIT.md §5.3-5.8).
 * Every card is a brutalist window (1.5 px #121212, r 0, 39 px black/blue title bar with a hollow
 * square glyph + mono label + 3-line grip, hard shadow +7.5/+7.5 #CCCAC4) unless noted.
 * Entrances use the BR profile recipe (opaque pop + 25.5 px drift, 8 f power2.out, core PROFILE_RECIPES.BR).
 * Measured motion used here (E-numbers from the audit):
 *   row focus tint on 1 f / off 6 f (E9)       scan line 5 f ease-in, radios fill as it passes (E10)
 *   % slam 1.36 -> 1.0 over 4 f, right-anchored (E11)   token fly ~10 f sine.inOut, field flash 1 f (E12)
 *   keyword recolour 1-2 f (E13)               stamp slam 2.5x -> 1.0 in 6 f ease-in (E15), strike 4 f (E16)
 *   cost bar shrink 9 f power2.inOut (E17)     race bar linear 7 px/f (E18)
 *   terminal typing 51 cps linear, cursor blink 8 f on / 7 f off (E19)   tile dim -> lit 4 f (E20)
 * All state changes are tweens/sets on the one paused timeline at explicit times (seek-safe).
 *
 * decisionSheet {title, situation?, questions:[{label, options:[..], answer?, p?}], compact?, showBars?}
 *   ops focus{q,hold?} unfocus{q} pulse{q,opt} pick{q,opt} scan{dur?} prob{q,p,text?} outline{q,hold?}
 * targetForm {title?, fields:[{label, value?}], status?}   ops ask{field} fill{field,text,tone?} fly{from,field,text} status{text,tone?}
 * writerWindow {title?, text, vendors?, tone?: blue|ink, cps?, autoStream?}   ops stream{cps?} mark{phrase}
 * toolTiles {tiles:[{icon,label}], cols?, lit?}      ops light{i} pick{i}
 * raceBars {title?, rows:[{label, value, tone?, display?, fast?}], axisMax?, unit?}   ops race{row,dur?}
 * costBar {label?, value?, display?, tone?}          ops shrink{to, display?}
 * terminal {title?, intro?, prompt?, command, comment?, typed?}   ops type{cps?} blink{dur?}
 * slamStamp {text, tone?}                            ops strike
 * pinkBand {} (full-bleed plate)   docGrid {docs:[{name, relevant?, score?}], cols?}  ops fill score select
 * appGrid {apps:[{icon, name, q, answer?}], cols?}   ops light{i}
 * keywordHeadline / displayLine {lines, keyword?, tone?, align?, size?, dim?}   ops recolour{word?,tone?} light{word?}
 * eyebrow {text, tone?, align?}   modelTile {label, chips?, tag?}  ops tag{text?}
 */
(function (global) {
  "use strict";
  var HF = (global.HFStage = global.HFStage || { modules: {} });
  var M = HF.modules;
  var F = 1 / 30;
  var SVGNS = "http://www.w3.org/2000/svg";

  var INK = "#1b1d1d";
  var GREY = "#8a8a86";
  var MAG = "#981878";
  var MAGUI = "#cc60ac";
  var TINT = "#f9edf5";
  var BLUE = "#2044b0";
  var RED = "#d04444";
  var TONE = { magenta: MAG, pink: MAG, purple: MAG, blue: "#1d3fa8", red: RED, green: "#2a8a4a", ink: INK, amber: "#9a6414", grey: GREY };
  function tone(name, fb) {
    return TONE[name] || (HF.tone && HF.tone(name)) || fb || MAG;
  }

  var WIN = "background:#fdfdfd;border:1.5px solid #121212;border-radius:0;box-shadow:7.5px 7.5px 0 #cccac4;";
  var CSS = [
    "html .br-win{" + WIN + "}",
    "html .br-win .bw-bar{position:absolute;left:0;right:0;top:0;height:39px;background:#1c1e1e;display:flex;align-items:center;gap:12px;padding:0 14px;}",
    "html .br-win[data-bar=blue] .bw-bar{background:" + BLUE + ";}",
    "html .br-win .bw-sq{width:12px;height:12px;border:1.5px solid #f1f1ea;flex:none;box-sizing:border-box;}",
    "html .br-win .bw-l{flex:1;min-width:0;font-family:var(--st-mono);font-size:17px;color:#f4f4ee;white-space:nowrap;overflow:hidden;}",
    "html .br-win .bw-grip{width:27px;height:7.5px;background:repeating-linear-gradient(#cfcfc8 0 1.5px,transparent 1.5px 3px);flex:none;}",
    "html .br-win .bw-body{position:absolute;left:0;right:0;top:39px;bottom:0;overflow:hidden;}",
    "html .br-win[data-dark='1']{background:#1c1e1e;}",
    // decision sheet
    "html .ds-sit{position:absolute;left:0;right:0;top:0;height:86px;background:#f7f5f1;border-bottom:1.5px solid #cbc9c7;}",
    "html .ds-cap{position:absolute;left:22.5px;top:13px;font-family:var(--st-mono);font-size:14px;letter-spacing:.14em;color:#6e6e6a;}",
    "html .ds-q{position:absolute;left:22.5px;right:22.5px;top:38px;font-size:23px;font-weight:500;color:" + INK + ";white-space:nowrap;overflow:hidden;}",
    "html .ds-row{position:absolute;left:0;right:0;}",
    "html .ds-lab{position:absolute;left:22.5px;top:14px;font-family:var(--st-mono);font-size:15px;letter-spacing:.12em;text-transform:uppercase;color:#42474e;white-space:nowrap;}",
    "html .ds-opts{position:absolute;left:22.5px;top:40px;height:36px;display:flex;align-items:center;gap:26px;white-space:nowrap;}",
    "html .ds-o{display:flex;align-items:center;gap:10px;}",
    "html .ds-r{position:relative;width:27px;height:27px;border-radius:50%;border:2px solid #6e6e6a;box-sizing:border-box;flex:none;background:#fdfdfd;}",
    "html .ds-dot{position:absolute;left:3.5px;top:3.5px;width:16px;height:16px;border-radius:50%;background:" + MAGUI + ";}",
    "html .ds-t{font-size:24px;font-weight:500;color:" + INK + ";}",
    "html .ds-tr{position:absolute;left:22.5px;right:22.5px;bottom:12px;height:6px;background:#e0e0e0;}",
    "html .ds-fill{position:absolute;left:0;top:0;bottom:0;width:100%;background:" + MAGUI + ";transform-origin:0 50%;}",
    "html .ds-p{position:absolute;right:22.5px;top:34px;font-family:var(--st-mono);font-size:32px;font-weight:700;color:" + MAG + ";transform-origin:100% 50%;white-space:nowrap;}",
    "html .ds-ol{position:absolute;left:4px;right:4px;top:3px;bottom:3px;border:2.5px solid " + MAGUI + ";}",
    "html .ds-scan{position:absolute;left:0;right:0;height:2px;background:" + MAGUI + ";}",
    // target form
    "html .tf-row{position:absolute;left:0;right:0;height:57px;}",
    "html .tf-lab{position:absolute;left:22.5px;top:0;line-height:57px;font-family:var(--st-mono);font-size:16px;letter-spacing:.12em;text-transform:uppercase;color:#42474e;white-space:nowrap;}",
    "html .tf-f{position:absolute;left:48%;right:22.5px;top:0;height:57px;border:1.5px dashed #b5b5a8;box-sizing:border-box;overflow:hidden;}",
    "html .tf-f[data-s=ask]{border:2.5px solid " + MAGUI + ";}html .tf-f[data-s=ask] .tf-v{color:" + MAG + ";}",
    "html .tf-f[data-s=filled],html .tf-f[data-s=unsure]{border:1.5px solid #121212;}",
    "html .tf-f[data-s=unsure] .tf-v{color:" + RED + ";}",
    "html .tf-v{position:absolute;left:16px;right:8px;top:0;line-height:54px;font-size:26px;font-weight:600;color:" + INK + ";white-space:nowrap;overflow:hidden;}",
    "html .tf-st{position:absolute;left:16px;right:16px;height:57px;border:1.5px dashed #b5b5a8;box-sizing:border-box;display:flex;align-items:center;gap:14px;padding:0 14px;}",
    "html .tf-ck{position:relative;width:27px;height:27px;background:#a0a099;flex:none;}",
    "html .tf-ck::after{content:'';position:absolute;left:9px;top:4px;width:7px;height:13px;border:solid #fdfdfd;border-width:0 3px 3px 0;transform:rotate(45deg);}",
    "html .tf-sx{font-size:24px;font-weight:500;color:#42474e;white-space:nowrap;overflow:hidden;}",
    "html .tf-st[data-s=ok]{background:#dff2e2;border:1.5px solid #2a8a4a;}html .tf-st[data-s=ok] .tf-ck{background:#2a8a4a;}html .tf-st[data-s=ok] .tf-sx{color:" + INK + ";font-weight:600;}",
    "html .tf-chip{position:absolute;left:0;top:0;height:32px;padding:0 13px;background:" + MAGUI + ";color:#fff;font-size:21px;font-weight:700;line-height:32px;white-space:nowrap;z-index:60;}",
    // writer window
    "html .ww-ven{position:absolute;left:72px;right:22px;top:0;height:46px;display:flex;align-items:center;gap:12px;border-bottom:1.5px solid #dfe5f3;}",
    "html .ww-vc{height:28px;padding:0 10px;border:1.5px solid #cbc9c7;font-family:var(--st-mono);font-size:15px;line-height:25px;color:#42474e;white-space:nowrap;}",
    "html .ww-rules{position:absolute;left:0;right:0;bottom:0;background:repeating-linear-gradient(transparent 0 37.5px,#dfe5f3 37.5px 39px);}",
    "html .ww-margin{position:absolute;left:58px;top:0;bottom:0;width:1.5px;background:#f0c0c0;}",
    "html .ww-ln{position:absolute;left:72px;right:18px;height:39px;line-height:38px;font-size:24px;font-weight:500;color:#2d4aa0;white-space:nowrap;}",
    "html .ww-ln[data-tone=ink]{color:" + INK + ";}",
    "html .ww-ln span{position:relative;z-index:1;}",
    "html .ww-ln.tail{opacity:.45;}",
    "html .ww-mk{position:absolute;top:4px;height:31px;background:#f8a400;transform-origin:0 50%;z-index:0;}",
    // tool tiles / app grid
    "html .br-tiles .tt{position:absolute;" + WIN + "display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;box-sizing:border-box;}",
    "html .br-tiles .tt-l{font-size:26px;font-weight:700;letter-spacing:-.01em;white-space:nowrap;}",
    "html .br-apps .ap{position:absolute;" + WIN + "box-sizing:border-box;overflow:hidden;}",
    "html .br-apps .ap-b{position:absolute;left:0;right:0;top:0;height:33px;background:#1c1e1e;display:flex;align-items:center;gap:9px;padding:0 11px;font-family:var(--st-mono);font-size:15px;color:#f4f4ee;white-space:nowrap;overflow:hidden;}",
    "html .br-apps .ap-b i{width:10px;height:10px;border:1.5px solid #f1f1ea;box-sizing:border-box;flex:none;}",
    "html .br-apps .ap-ic{position:absolute;left:14px;top:48px;color:" + INK + ";}",
    "html .br-apps .ap-q{position:absolute;left:14px;right:10px;top:92px;font-size:22px;font-weight:700;color:" + INK + ";white-space:nowrap;overflow:hidden;}",
    "html .br-apps .ap-o{position:absolute;left:14px;bottom:14px;display:flex;align-items:center;gap:9px;font-size:20px;color:#42474e;white-space:nowrap;}",
    // race bars / cost bar
    "html .rb-row{position:absolute;left:0;right:0;height:84px;}",
    "html .rb-lab{position:absolute;left:22.5px;top:8px;font-family:var(--st-mono);font-size:16px;letter-spacing:.12em;text-transform:uppercase;color:#42474e;white-space:nowrap;}",
    "html .rb-bar{position:absolute;left:22.5px;top:36px;height:30px;transform-origin:0 50%;}",
    "html .rb-d{position:absolute;top:36px;line-height:30px;font-family:var(--st-mono);font-size:18px;font-weight:700;color:" + INK + ";white-space:nowrap;}",
    "html .rb-ax{position:absolute;left:22.5px;right:22.5px;height:30px;border-top:1.5px solid #121212;}",
    "html .rb-tk{position:absolute;top:0;width:1.5px;height:7px;background:#121212;}",
    "html .rb-tl{position:absolute;top:9px;font-family:var(--st-mono);font-size:13px;color:#6e6e6a;transform:translateX(-50%);white-space:nowrap;}",
    "html .br-cost .cb-lab{position:absolute;left:0;top:0;font-family:var(--st-mono);font-size:16.5px;letter-spacing:.14em;color:#6e6e6a;white-space:nowrap;}",
    "html .br-cost .cb-bar{position:absolute;left:0;top:30px;height:46.5px;min-width:170px;background:" + RED + ";}",
    "html .br-cost .cb-d{position:absolute;right:14px;top:0;line-height:46.5px;font-family:var(--st-mono);font-size:22px;font-weight:700;color:#fff;white-space:nowrap;}",
    // terminal
    "html .tm-intro{position:absolute;left:24px;right:24px;font-size:22px;color:#a8a8a0;white-space:nowrap;}",
    "html .tm-cmd{position:absolute;left:24px;right:24px;height:60px;display:flex;align-items:center;font-family:var(--st-mono);font-size:40px;color:#f4f4ee;white-space:pre;}",
    "html .tm-pr{color:#e06cc0;margin-right:14px;font-weight:700;}",
    "html .tm-cur{display:inline-block;width:20px;height:42px;background:#f4f4ee;margin-left:6px;}",
    "html .tm-cm{position:absolute;left:24px;right:24px;font-size:23px;color:#a8a8a0;white-space:nowrap;}",
    // stamp
    "html .br-stamp{display:flex;align-items:center;justify-content:center;}",
    "html .br-stamp .bs-s{position:relative;padding:4px 30px;border:7px double #b03030;color:#b03030;font-family:var(--st-mono);font-weight:800;letter-spacing:.06em;text-transform:uppercase;white-space:nowrap;line-height:1.1;background:rgba(253,253,253,.55);}",
    "html .br-stamp .bs-k{position:absolute;left:-6%;right:-6%;top:50%;height:14px;margin-top:-7px;background:" + INK + ";transform-origin:0 50%;}",
    // pink band
    "html .br-band{background-color:#ef8a9e;background-image:radial-gradient(circle,#f5a7b8 0,#f5a7b8 1.5px,transparent 1.9px);background-size:13.5px 13.5px;}",
    // doc grid
    "html .br-docs .dg{position:absolute;box-sizing:border-box;border:1.5px dashed #b5b5a8;}",
    "html .br-docs .dg[data-s=empty] > *{visibility:hidden;}",
    "html .br-docs .dg[data-s=full],html .br-docs .dg[data-s=rel]{border:1.5px solid #121212;background:#fdfdfd;box-shadow:4.5px 4.5px 0 #cccac4;}",
    "html .br-docs .dg[data-s=rel]{background:" + TINT + ";border:2.5px solid " + MAGUI + ";}",
    "html .br-docs .dg-pg{position:absolute;left:14px;right:14px;top:16px;height:44px;background:repeating-linear-gradient(#c8c8c0 0 4.5px,transparent 4.5px 13.5px);}",
    "html .br-docs .dg-n{position:absolute;left:0;right:0;bottom:0;height:34px;border-top:1.5px solid #121212;font-family:var(--st-mono);font-size:14px;line-height:32px;text-align:center;color:" + INK + ";white-space:nowrap;overflow:hidden;}",
    "html .br-docs .dg-s{position:absolute;right:-11px;top:-11px;width:34px;height:34px;border-radius:50%;background:#fdfdfd;border:2.5px solid " + MAGUI + ";box-sizing:border-box;font-family:var(--st-mono);font-size:13px;font-weight:700;line-height:29px;text-align:center;color:" + MAG + ";}",
    "html .br-docs .dg[data-s=rel] .dg-s{background:" + MAGUI + ";color:#fff;}",
    // headline / display line / eyebrow
    "html .br-hl{display:flex;flex-direction:column;justify-content:flex-start;}",
    "html .br-hl .hl-l{font-weight:800;letter-spacing:-.03em;line-height:1.12;white-space:nowrap;color:" + INK + ";}",
    "html .br-eb{font-family:var(--st-mono);font-size:22px;font-weight:500;letter-spacing:.2em;text-transform:uppercase;white-space:nowrap;line-height:30px;}",
    // model tile
    "html .br-model{background-color:#1b1d1d;background-image:linear-gradient(#2a2c2c 1.5px,transparent 1.5px),linear-gradient(90deg,#2a2c2c 1.5px,transparent 1.5px);background-size:24px 24px;border:1.5px solid #121212;box-shadow:7.5px 7.5px 0 #cccac4;}",
    "html .br-model .mt-cs{position:absolute;left:22px;right:22px;top:22px;display:flex;flex-wrap:wrap;gap:9px;}",
    "html .br-model .mt-c{height:30px;padding:0 11px;background:#fdfdfd;font-family:var(--st-mono);font-size:15px;line-height:30px;color:" + INK + ";white-space:nowrap;}",
    "html .br-model .mt-l{position:absolute;left:22px;right:22px;bottom:22px;font-size:36px;font-weight:800;letter-spacing:-.02em;line-height:1.05;color:#fdfdfd;}",
    "html .br-model .mt-tag{position:absolute;right:-12px;top:-14px;height:36px;padding:0 12px;background:" + RED + ";color:#fff;font-family:var(--st-mono);font-size:20px;font-weight:700;line-height:36px;white-space:nowrap;}",
  ].join("\n");

  (function ensureStyle() {
    if (document.getElementById("st-br-cards")) return;
    var st = document.createElement("style");
    st.id = "st-br-cards";
    st.textContent = CSS;
    document.head.appendChild(st);
  })();

  // ---- helpers ----
  function div(cls, parent, text) {
    var el = document.createElement("div");
    if (cls) el.className = cls;
    if (text !== undefined && text !== null) el.textContent = text;
    if (parent) parent.appendChild(el);
    return el;
  }
  function span(cls, parent, text) {
    var el = document.createElement("span");
    if (cls) el.className = cls;
    if (text !== undefined && text !== null) el.textContent = text;
    if (parent) parent.appendChild(el);
    return el;
  }
  function W(el) {
    return (parseFloat(el.style.width) || 700) - 3;
  }
  function H(el) {
    return (parseFloat(el.style.height) || 400) - 3;
  }
  function norm(s) {
    return String(s || "")
      .toLowerCase()
      .replace(/[^\p{L}\p{N}%$]+/gu, "");
  }
  function win(el, p, c, opt) {
    el.classList.add("br-win");
    if (opt.bar) el.setAttribute("data-bar", opt.bar);
    if (opt.dark) el.setAttribute("data-dark", "1");
    if (p.overlay) el.setAttribute("data-overlay", "1"); // drawn over media on purpose (T4)
    var bar = div("bw-bar", el);
    div("bw-sq", bar);
    var lab = c.entity("title", div("bw-l", bar, p.title !== undefined ? p.title : opt.title || ""));
    div("bw-grip", bar);
    var body = div("bw-body", el);
    return { bar: bar, body: body, label: lab };
  }
  // the element's recipe entrance (profile recipe: BR = opaque pop + drift), for cards that hook enter
  function recipeEnter(c, el, t, name) {
    if (name === "none") return;
    var r = c.recipes[name];
    if (r === undefined) r = c.recipes.fade;
    if (!r) return;
    var from = { autoAlpha: r.from || 0 };
    var to = { autoAlpha: 1, duration: r.dur, ease: r.ease, immediateRender: false };
    if (r.y) {
      from.y = r.y;
      to.y = 0;
    }
    if (r.scale) {
      from.scale = r.scale;
      to.scale = 1;
    }
    c.tl.fromTo(el, from, to, t);
  }
  // stage-space box of any node inside a module (layout offsets; transforms ignored on purpose)
  function stageBox(node) {
    var x = 0;
    var y = 0;
    var n = node;
    while (n && !(n.classList && n.classList.contains("st-mod"))) {
      x += n.offsetLeft || 0;
      y += n.offsetTop || 0;
      n = n.offsetParent;
    }
    if (!n) return null;
    x += (parseFloat(n.style.left) || 0) + (n.clientLeft || 0);
    y += (parseFloat(n.style.top) || 0) + (n.clientTop || 0);
    return { x: x, y: y, w: node.offsetWidth, h: node.offsetHeight };
  }

  // small line icons: the shared lucide subset first, then BR glyphs drawn here
  var GLYPH = {
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
    calculator: '<rect x="5" y="2" width="14" height="20" rx="2"/><path d="M8 6h8M8 11h.01M12 11h.01M16 11h.01M8 15h.01M12 15h.01M16 15h.01M8 19h.01M12 19h4"/>',
    code: '<path d="m16 18 6-6-6-6M8 6l-6 6 6 6"/>',
    mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/>',
    message: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
    dollar: '<path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
    "file-text": '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h8M8 9h2"/>',
    play: '<rect x="2" y="5" width="20" height="14" rx="3"/><path d="m10 9 5 3-5 3z"/>',
    home: '<path d="m3 10 9-7 9 7v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/>',
    grid: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>',
    gamepad: '<rect x="2" y="6" width="20" height="12" rx="4"/><path d="M6 12h4M8 10v4M15 13h.01M18 11h.01"/>',
    sparkles: '<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/>',
    bot: '<rect x="4" y="8" width="16" height="12" rx="2"/><path d="M12 8V4M9 13h.01M15 13h.01"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
    tag: '<path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L2 12V2h10l8.6 8.6a2 2 0 0 1 0 2.8z"/><path d="M7 7h.01"/>',
    route: '<circle cx="6" cy="19" r="3"/><circle cx="18" cy="5" r="3"/><path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15"/>',
  };
  function icon(name, size) {
    var H0 = global.HFIcons;
    if (H0 && H0.names && H0.names.indexOf(name) >= 0) return H0.create(name, { size: size });
    var svg = document.createElementNS(SVGNS, "svg");
    svg.setAttribute("width", size);
    svg.setAttribute("height", size);
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "2");
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");
    svg.innerHTML = GLYPH[name] || '<rect x="4" y="4" width="16" height="16"/>';
    return svg;
  }

  // =============== decisionSheet (R7 §5.3, the host) ===============
  M.decisionSheet = {
    enter: "fade",
    build: function (el, p, c) {
      var w = win(el, p, c, { title: "decision sheet" });
      var y0 = 0;
      if (p.situation) {
        var sit = c.entity("situation", div("ds-sit", w.body));
        div("ds-cap", sit, p.situationLabel || "SITUATION");
        div("ds-q", sit, "“" + p.situation + "”");
        y0 = 86;
      }
      var pitch = p.compact ? 92 : 104;
      var TINT0 = "rgba(249,237,245,0)";
      var qs = (p.questions || []).map(function (q, i) {
        var row = c.entity("q" + (i + 1), div("ds-row", w.body));
        row.style.top = y0 + i * pitch + "px";
        row.style.height = pitch + "px";
        row.style.backgroundColor = TINT0;
        div("ds-lab", row, q.label || "");
        var box = div("ds-opts", row);
        if (p.compact) box.style.top = "36px";
        var os = (q.options || []).map(function (o, j) {
          var op = c.entity("q" + (i + 1) + ".o" + (j + 1), div("ds-o", box));
          var r = div("ds-r", op);
          var dot = div("ds-dot", r);
          div("ds-t", op, o);
          return { op: op, r: r, dot: dot, text: String(o) };
        });
        var fill = null;
        if (p.showBars !== false) {
          var tr = div("ds-tr", row);
          fill = div("ds-fill", tr);
        }
        var pct = div("ds-p", row, "");
        var ol = div("ds-ol", row);
        var pre = q.picked !== undefined ? optIndex(os, q.picked) : -1;
        os.forEach(function (o, j) {
          c.tl.set(o.dot, { scale: j === pre ? 1 : 0 }, 0);
          if (j === pre) o.r.style.borderColor = MAGUI;
        });
        if (fill) c.tl.set(fill, { scaleX: q.pFilled ? (Number(q.p) || 0) / 100 : 0 }, 0);
        c.tl.set(pct, { autoAlpha: 0 }, 0);
        c.tl.set(ol, { autoAlpha: 0 }, 0);
        return { row: row, os: os, fill: fill, pct: pct, ol: ol, q: q, top: y0 + i * pitch };
      });
      var scanLine = div("ds-scan", w.body);
      c.tl.set(scanLine, { autoAlpha: 0 }, 0);

      function optIndex(os, v) {
        if (typeof v === "number") return v - 1;
        var k = norm(v);
        for (var j = 0; j < os.length; j++) if (norm(os[j].text) === k) return j;
        return -1;
      }
      function Q(v) {
        var q = qs[((v && v.q) || 1) - 1];
        if (!q) throw new Error("decisionSheet: no question " + (v && v.q));
        return q;
      }
      function pick(q, j, t) {
        q.os.forEach(function (o, k) {
          if (k === j) return;
          c.tl.set(o.dot, { scale: 0 }, t);
          c.tl.set(o.r, { borderColor: "#6e6e6a" }, t);
        });
        var o = q.os[j];
        if (!o) throw new Error("decisionSheet: no option " + (j + 1));
        c.tl.set(o.r, { borderColor: MAGUI }, t);
        // E10: the radio fill pops (ring +20% for 2 f)
        c.tl.fromTo(o.dot, { scale: 0 }, { scale: 1, duration: 2 * F, ease: "power2.out", immediateRender: false }, t);
        c.tl.fromTo(o.r, { scale: 1.2 }, { scale: 1, duration: 2 * F, ease: "power2.out", immediateRender: false }, t + 2 * F);
      }
      return {
        ops: {
          // E9: tint on in 1 f at the question word, off with a 6 f fade
          focus: function (e) {
            var q = Q(e.value);
            var hold = e.value && e.value.hold !== undefined ? e.value.hold : 0.5;
            c.tl.set(q.row, { backgroundColor: TINT }, e.t);
            if (hold > 0) c.tl.to(q.row, { backgroundColor: TINT0, duration: 6 * F, ease: "none" }, e.t + hold);
          },
          unfocus: function (e) {
            c.tl.to(Q(e.value).row, { backgroundColor: TINT0, duration: 6 * F, ease: "none" }, e.t);
          },
          // option pulse on its word: ring 1.25 -> 1 over 4 f in magenta, back to grey
          pulse: function (e) {
            var q = Q(e.value);
            var o = q.os[optIndex(q.os, (e.value && e.value.opt) || 1)];
            if (!o) throw new Error("decisionSheet pulse: no such option");
            c.tl.fromTo(o.r, { scale: 1.25, borderColor: MAGUI }, { scale: 1, duration: 4 * F, ease: "power2.out", immediateRender: false }, e.t);
            c.tl.to(o.r, { borderColor: "#6e6e6a", duration: 3 * F, ease: "none" }, e.t + 6 * F);
          },
          pick: function (e) {
            var q = Q(e.value);
            pick(q, optIndex(q.os, (e.value && e.value.opt) || 1), e.t);
          },
          // E10: a magenta line sweeps down the rows in 5 f (ease-in); each answer fills as it passes
          scan: function (e) {
            var d = (e.value && e.value.dur) || 5 * F;
            var ya = qs.length ? qs[0].top : 0;
            var yb = qs.length ? qs[qs.length - 1].top + pitch : 0;
            c.tl.set(scanLine, { autoAlpha: 1, top: ya }, e.t);
            c.tl.to(scanLine, { top: yb, duration: d, ease: "power2.in" }, e.t);
            c.tl.set(scanLine, { autoAlpha: 0 }, e.t + d + F);
            qs.forEach(function (q) {
              if (q.q.answer === undefined) return;
              var frac = Math.max(0, Math.min(1, (q.top + 58 - ya) / Math.max(1, yb - ya)));
              pick(q, optIndex(q.os, q.q.answer), e.t + d * Math.sqrt(frac));
            });
          },
          // E11: % slam 1.36 -> 1.0 over 4 f, right-anchored; the probability bar fills with it
          prob: function (e) {
            var q = Q(e.value);
            var pv = e.value && e.value.p !== undefined ? Number(e.value.p) : Number(q.q.p) || 0;
            c.tl.set(q.pct, { textContent: (e.value && e.value.text) || Math.round(pv) + "%", autoAlpha: 1 }, e.t);
            c.tl.fromTo(q.pct, { scale: 1.36 }, { scale: 1, duration: 4 * F, ease: "power2.out", immediateRender: false }, e.t);
            if (q.fill) c.tl.to(q.fill, { scaleX: pv / 100, duration: 0.3, ease: "power2.out" }, e.t);
          },
          outline: function (e) {
            var q = Q(e.value);
            c.tl.set(q.ol, { autoAlpha: 1 }, e.t);
            if (e.value && e.value.hold) c.tl.set(q.ol, { autoAlpha: 0 }, e.t + e.value.hold);
          },
        },
      };
    },
  };

  // =============== targetForm + fly (R7 §5.4) ===============
  M.targetForm = {
    enter: "fade",
    build: function (el, p, c) {
      var w = win(el, p, c, { title: "your_app" });
      var fields = (p.fields || []).map(function (f, i) {
        var row = div("tf-row", w.body);
        row.style.top = 12 + i * 78 + "px";
        div("tf-lab", row, f.label || "");
        var box = c.entity("f" + (i + 1), div("tf-f", row));
        var v = div("tf-v", box, f.value || "");
        if (f.value) {
          box.setAttribute("data-s", f.tone === "uncertain" ? "unsure" : "filled");
          box.style.backgroundColor = "#fdfdfd";
        }
        return { box: box, v: v, label: f.label };
      });
      var st = null;
      var stx = null;
      if (p.status !== false) {
        st = c.entity("status", div("tf-st", w.body));
        st.style.top = 12 + fields.length * 78 + 6 + "px";
        div("tf-ck", st);
        stx = div("tf-sx", st, typeof p.status === "string" ? p.status : "Waiting for answers…");
      }
      function fld(v) {
        var k = v && v.field;
        var f = typeof k === "number" ? fields[k - 1] : fields.find(function (x) {
          return norm(x.label) === norm(k);
        });
        if (!f) throw new Error("targetForm: no field " + k);
        return f;
      }
      function fill(f, text, tn, t) {
        c.tl.set(f.v, { textContent: text }, t);
        c.tl.set(f.box, { attr: { "data-s": tn === "uncertain" ? "unsure" : "filled" }, backgroundColor: "#d9d9d2" }, t);
        c.tl.set(f.box, { backgroundColor: "#fdfdfd" }, t + F); // E12: grey flash 1 f, settles
      }
      var layer = el.parentNode;
      return {
        ops: {
          ask: function (e) {
            var f = fld(e.value);
            c.tl.set(f.v, { textContent: "?" }, e.t);
            c.tl.set(f.box, { attr: { "data-s": "ask" } }, e.t);
          },
          fill: function (e) {
            fill(fld(e.value), String((e.value && e.value.text) || ""), e.value && e.value.tone, e.t);
          },
          // E12: a magenta token lifts off the source entity and flies into the field (~10 f)
          fly: function (e) {
            var v = e.value || {};
            var f = fld(v);
            var text = String(v.text || "");
            var dst = stageBox(f.box);
            var srcNode = v.from ? c.entities[v.from] : null;
            var src = srcNode ? stageBox(srcNode) : null;
            var dx = dst.x + dst.w / 2;
            var dy = dst.y + dst.h / 2;
            var sx = src ? src.x + src.w / 2 : dx - 300;
            var sy = src ? src.y + src.h / 2 : dy - 420;
            var chip = div("tf-chip", layer, text);
            var d = v.dur || 10 * F;
            c.tl.set(chip, { xPercent: -50, yPercent: -50, x: sx, y: sy, autoAlpha: 0 }, 0);
            c.tl.set(chip, { autoAlpha: 1 }, e.t);
            c.tl.to(chip, { x: dx, y: dy, duration: d, ease: "sine.inOut" }, e.t);
            c.tl.set(chip, { autoAlpha: 0 }, e.t + d);
            fill(f, text, v.tone, e.t + d);
          },
          status: function (e) {
            if (!st) throw new Error("targetForm: no status row");
            c.tl.set(stx, { textContent: String((e.value && e.value.text) || "") }, e.t);
            c.tl.set(st, { attr: { "data-s": (e.value && e.value.tone) === "wait" ? "" : "ok" } }, e.t);
          },
        },
      };
    },
  };

  // =============== writerWindow: streaming LLM text + highlighter (R7 §5.5) ===============
  M.writerWindow = {
    enter: "fade",
    build: function (el, p, c) {
      var tn = p.tone || "blue";
      var w = win(el, p, c, { title: "LLM · writing…", bar: tn === "blue" ? "blue" : null });
      var Wd = W(el);
      var top = 0;
      if (p.vendors && p.vendors.length) {
        var vr = div("ww-ven", w.body);
        p.vendors.forEach(function (v) {
          div("ww-vc", vr, v);
        });
        top = 46;
      }
      var rules = div("ww-rules", w.body);
      rules.style.top = top + "px";
      div("ww-margin", w.body).style.top = top + "px";
      // wrap the text at the line width (canvas-measured Inter 500 24 px)
      var maxW = Wd - 72 - 22;
      var fam = "Inter, ui-sans-serif, system-ui, sans-serif";
      var meas = function (s) {
        return global.HFTextFit ? global.HFTextFit.measure(s, 500, 24, fam) : s.length * 12.6;
      };
      var words = String(p.text || "").split(/\s+/).filter(Boolean);
      var lines = [];
      var cur = [];
      words.forEach(function (wd) {
        var trial = cur.concat([wd]).join(" ");
        if (cur.length && meas(trial) > maxW) {
          lines.push(cur);
          cur = [wd];
        } else cur.push(wd);
      });
      if (cur.length) lines.push(cur);
      var cap = Math.max(1, Math.floor((H(el) - 39 - top - 6) / 39));
      var cut = lines.length > cap;
      lines = lines.slice(0, cap);
      var ls = lines.map(function (ws, i) {
        var ln = div("ww-ln", w.body);
        ln.style.top = top + i * 39 + "px";
        if (tn !== "blue") ln.setAttribute("data-tone", "ink");
        if (cut && i === lines.length - 1) ln.classList.add("tail");
        var spans = ws.map(function (wd, k) {
          return span("", ln, wd + (k < ws.length - 1 ? " " : ""));
        });
        c.entity("l" + (i + 1), ln);
        return { ln: ln, spans: spans, n: ws.join(" ").length };
      });
      var live = p.streamed !== true;
      if (live)
        ls.forEach(function (l) {
          c.tl.set(l.ln, { clipPath: "inset(0% 100% 0% 0%)" }, 0);
        });
      function stream(t, cps) {
        var tt = t;
        ls.forEach(function (l) {
          var d = Math.max(F, l.n / cps);
          c.tl.fromTo(l.ln, { clipPath: "inset(0% 100% 0% 0%)" }, { clipPath: "inset(0% 0% 0% 0%)", duration: d, ease: "none", immediateRender: false }, tt);
          tt += d;
        });
      }
      var streamedByOp = false;
      return {
        enter: function (t, name) {
          recipeEnter(c, el, t, name);
          // stream from the entrance unless the storyboard anchors it (autoStream:false + stream op)
          if (live && p.autoStream !== false) {
            streamedByOp = true;
            stream(t + 0.2, p.cps || 160);
          }
        },
        ops: {
          // ~6 lines in 1.5 s (R7 S11): 160 chars/s by default
          stream: function (e) {
            if (streamedByOp) return;
            streamedByOp = true;
            stream(e.t, (e.value && e.value.cps) || p.cps || 160);
          },
          // amber highlighter sweeps L->R over a phrase in 5 f; the phrase turns ink
          mark: function (e) {
            var ph = String((e.value && e.value.phrase) || "").split(/\s+/).map(norm).filter(Boolean);
            if (!ph.length) throw new Error("writerWindow mark: empty phrase");
            var hit = null;
            ls.some(function (l) {
              for (var a = 0; a < l.spans.length; a++) {
                if (norm(l.spans[a].textContent) !== ph[0]) continue;
                var b = a;
                while (b + 1 < l.spans.length && b - a + 1 < ph.length && norm(l.spans[b + 1].textContent) === ph[b - a + 1]) b++;
                hit = { l: l, a: a, b: b };
                return true;
              }
              return false;
            });
            if (!hit) throw new Error('writerWindow mark: phrase "' + e.value.phrase + '" not on screen');
            var sa = hit.l.spans[hit.a];
            var sb = hit.l.spans[hit.b];
            var trail = / $/.test(sb.textContent) ? meas(" ") : 0;
            var mk = div("ww-mk", hit.l.ln);
            mk.style.left = sa.offsetLeft - 4 + "px";
            mk.style.width = sb.offsetLeft + sb.offsetWidth - trail - sa.offsetLeft + 8 + "px";
            c.tl.set(mk, { scaleX: 0, autoAlpha: 0 }, 0);
            c.tl.set(mk, { autoAlpha: 1 }, e.t);
            c.tl.to(mk, { scaleX: 1, duration: 5 * F, ease: "none" }, e.t);
            c.tl.set(hit.l.spans.slice(hit.a, hit.b + 1), { color: INK }, e.t + 2 * F);
          },
        },
      };
    },
  };

  // =============== toolTiles (R7 S19) ===============
  M.toolTiles = {
    enter: "fade",
    build: function (el, p, c) {
      el.classList.add("br-tiles");
      var tiles = p.tiles || [];
      var cols = p.cols || 2;
      var rows = Math.max(1, Math.ceil(tiles.length / cols));
      var gap = 18;
      var tw = (W(el) + 3 - 8 - (cols - 1) * gap) / cols; // 8 px for the hard shadow
      var th = (H(el) + 3 - 8 - (rows - 1) * gap) / rows;
      var lit = p.lit === true;
      var items = tiles.map(function (it, i) {
        var t = c.entity("t" + (i + 1), div("tt", el));
        Object.assign(t.style, { left: (i % cols) * (tw + gap) + "px", top: Math.floor(i / cols) * (th + gap) + "px", width: tw + "px", height: th + "px" });
        t.appendChild(icon(it.icon || "sparkles", Math.min(48, th * 0.3)));
        div("tt-l", t, it.label || "");
        t.style.color = lit ? INK : "#b0b0aa";
        t.style.borderColor = lit ? "#121212" : "#c8c8c0";
        return t;
      });
      function T(v) {
        var t = items[((v && v.i) || 1) - 1];
        if (!t) throw new Error("toolTiles: no tile " + (v && v.i));
        return t;
      }
      return {
        ops: {
          light: function (e) {
            c.tl.to(T(e.value), { color: INK, borderColor: "#121212", duration: 4 * F, ease: "none" }, e.t);
          },
          pick: function (e) {
            var t = T(e.value);
            c.tl.set(t, { color: INK, borderColor: MAGUI, boxShadow: "0 0 0 3px " + MAGUI + ", 7.5px 7.5px 0 #cccac4" }, e.t);
          },
        },
      };
    },
  };

  // =============== appGrid (R7 S33) ===============
  M.appGrid = {
    enter: "fade",
    build: function (el, p, c) {
      el.classList.add("br-apps");
      var apps = p.apps || [];
      var cols = p.cols || 3;
      var rows = Math.max(1, Math.ceil(apps.length / cols));
      var gap = 18;
      var tw = (W(el) + 3 - 8 - (cols - 1) * gap) / cols;
      var th = (H(el) + 3 - 8 - (rows - 1) * gap) / rows;
      var items = apps.map(function (a, i) {
        var t = c.entity("a" + (i + 1), div("ap", el));
        Object.assign(t.style, { left: (i % cols) * (tw + gap) + "px", top: Math.floor(i / cols) * (th + gap) + "px", width: tw + "px", height: th + "px" });
        var b = div("ap-b", t);
        b.appendChild(document.createElement("i"));
        span("", b, a.name || "");
        var ic = div("ap-ic", t);
        ic.appendChild(icon(a.icon || "app-window", 32));
        div("ap-q", t, a.q || "");
        var o = div("ap-o", t);
        var r = div("ds-r", o);
        var dot = div("ds-dot", r);
        span("", o, a.answer || "yes");
        c.tl.set(dot, { scale: 0 }, 0);
        return { t: t, r: r, dot: dot };
      });
      return {
        ops: {
          light: function (e) {
            var x = items[((e.value && e.value.i) || 1) - 1];
            if (!x) throw new Error("appGrid: no app " + (e.value && e.value.i));
            c.tl.set(x.r, { borderColor: MAGUI }, e.t);
            c.tl.fromTo(x.dot, { scale: 0 }, { scale: 1, duration: 3 * F, ease: "back.out(2)", immediateRender: false }, e.t);
            c.tl.set(x.t, { borderColor: MAGUI }, e.t);
          },
        },
      };
    },
  };

  // =============== raceBars (R7 S26, E18) ===============
  M.raceBars = {
    enter: "fade",
    build: function (el, p, c) {
      var w = win(el, p, c, { title: "response time" });
      var Wd = W(el);
      var tw = Wd - 45;
      var max = Number(p.axisMax) || 10;
      var unit = p.unit === undefined ? "s" : p.unit;
      var rows = (p.rows || []).map(function (r, i) {
        var row = div("rb-row", w.body);
        row.style.top = 14 + i * 84 + "px";
        div("rb-lab", row, r.label || "");
        var bw = Math.max(6, Math.min(1, (Number(r.value) || 0) / max) * tw);
        var bar = c.entity("r" + (i + 1), div("rb-bar", row));
        bar.style.width = bw + "px";
        bar.style.background = r.tone === "blue" ? "#2d5bd0" : r.tone ? tone(r.tone) : MAGUI;
        var dsp = div("rb-d", row, r.display || "");
        var inside = bw > tw - 140;
        if (inside) {
          dsp.style.right = Wd - 22.5 - bw + 12 + "px";
          dsp.style.color = "#fff";
        } else dsp.style.left = 22.5 + bw + 12 + "px";
        if (!p.filled) {
          c.tl.set(bar, { scaleX: 0 }, 0);
          c.tl.set(dsp, { autoAlpha: 0 }, 0);
        }
        return { bar: bar, dsp: dsp, bw: bw, r: r };
      });
      var ax = div("rb-ax", w.body);
      ax.style.top = 14 + rows.length * 84 + 4 + "px";
      var step = max <= 10 ? 1 : max <= 20 ? 2 : max <= 50 ? 5 : Math.ceil(max / 10);
      for (var k = 0; k <= max + 1e-9; k += step) {
        var x = (k / max) * tw;
        var tk = div("rb-tk", ax);
        tk.style.left = x + "px";
        var lb = div("rb-tl", ax, k + unit);
        lb.style.left = x + "px";
        if (k === 0) lb.style.transform = "none";
        if (k + step > max + 1e-9 && k > 0) lb.style.transform = "translateX(-100%)";
      }
      return {
        ops: {
          // the slow bar crawls LINEARLY at 7 px/f (real time); a short/fast bar pops at its value
          race: function (e) {
            var x = rows[((e.value && e.value.row) || 1) - 1];
            if (!x) throw new Error("raceBars: no row " + (e.value && e.value.row));
            var d = x.r.fast || x.bw < 90 ? 3 * F : Math.min((e.value && e.value.dur) || 99, x.bw / 210);
            c.tl.fromTo(x.bar, { scaleX: 0 }, { scaleX: 1, duration: d, ease: d <= 3 * F ? "power2.out" : "none", immediateRender: false }, e.t);
            c.tl.set(x.dsp, { autoAlpha: 1 }, e.t + d);
          },
        },
      };
    },
  };

  // =============== costBar (R7 S22, E17) ===============
  M.costBar = {
    enter: "fade",
    build: function (el, p, c) {
      el.classList.add("br-cost");
      div("cb-lab", el, p.label || "COST");
      var bar = c.entity("bar", div("cb-bar", el));
      bar.style.width = (p.value === undefined ? 100 : Number(p.value)) + "%";
      if (p.tone) bar.style.background = tone(p.tone, RED);
      var d = div("cb-d", bar, p.display || "");
      return {
        ops: {
          shrink: function (e) {
            var v = e.value || {};
            c.tl.to(bar, { width: (v.to === undefined ? 30 : Number(v.to)) + "%", duration: 9 * F, ease: "power2.inOut" }, e.t);
            if (v.display !== undefined) c.tl.set(d, { textContent: String(v.display) }, e.t + 9 * F);
          },
        },
      };
    },
  };

  // =============== terminal (R7 S20, E19) ===============
  M.terminal = {
    enter: "fade",
    build: function (el, p, c) {
      var w = win(el, p, c, { title: "terminal", dark: true });
      var y = 24;
      if (p.intro) {
        div("tm-intro", w.body, p.intro).style.top = y + "px";
        y += 40;
      }
      var ln = div("tm-cmd", w.body);
      ln.style.top = y + "px";
      if (p.prompt !== "") span("tm-pr", ln, p.prompt || "$");
      var typed = p.typed === false;
      var tx = c.entity("command", span("", ln, typed ? "" : p.command || ""));
      var cur = span("tm-cur", ln);
      y += 70;
      var cm = p.comment ? c.entity("comment", div("tm-cm", w.body, p.comment)) : null;
      if (cm) {
        cm.style.top = y + "px";
        if (typed) c.tl.set(cm, { autoAlpha: 0 }, 0);
      }
      var enterT = null;
      function blink(a, b) {
        for (var t = a; t < b - 1e-6; t += 15 * F) {
          c.tl.set(cur, { autoAlpha: 1 }, t);
          if (t + 8 * F < b) c.tl.set(cur, { autoAlpha: 0 }, t + 8 * F);
        }
        c.tl.set(cur, { autoAlpha: 1 }, b);
      }
      return {
        enter: function (t, name) {
          recipeEnter(c, el, t, name);
          enterT = t;
        },
        ops: {
          // 51 cps linear (1.7 chars/f), the cursor blinks 8 f on / 7 f off until typing starts
          type: function (e) {
            var v = e.value || {};
            var full = String(v.text || p.command || "");
            var cps = v.cps || 51;
            if (enterT !== null && e.t - enterT > 0.3) blink(enterT, e.t);
            c.tl.set(tx, { textContent: "" }, e.t);
            var n = full.length;
            var k = 0;
            var shown = 0;
            while (shown < n) {
              k++;
              shown = Math.min(n, Math.floor((k * cps) / 30));
              if (shown > 0) c.tl.set(tx, { textContent: full.slice(0, shown) }, e.t + k * F);
            }
            if (cm) c.tl.fromTo(cm, { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration: 6 * F, ease: "power2.out", immediateRender: false }, e.t + k * F + 0.2);
          },
          blink: function (e) {
            blink(e.t, e.t + ((e.value && e.value.dur) || 1));
          },
        },
      };
    },
  };

  // =============== slamStamp (R7 S29, E15/E16) ===============
  M.slamStamp = {
    enter: "none",
    build: function (el, p, c) {
      el.classList.add("br-stamp");
      var s = c.entity("text", div("bs-s", el, p.text || "NOT THIS"));
      var txt = String(p.text || "NOT THIS");
      var size = Math.min(H(el) * 0.5, (W(el) - 90) / Math.max(1, txt.length * 0.66));
      s.style.fontSize = Math.round(size) + "px";
      if (p.tone && p.tone !== "red") {
        s.style.color = tone(p.tone);
        s.style.borderColor = tone(p.tone);
      }
      var k = div("bs-k", s);
      c.tl.set(s, { rotation: -8 }, 0);
      c.tl.set(k, { autoAlpha: 0, scaleX: 0 }, 0);
      return {
        enter: function (t) {
          c.tl.fromTo(s, { autoAlpha: 1, scale: 2.5 }, { scale: 1, duration: 6 * F, ease: "power2.in", immediateRender: false }, t);
        },
        ops: {
          strike: function (e) {
            c.tl.set(k, { autoAlpha: 1 }, e.t);
            c.tl.to(k, { scaleX: 1, duration: 4 * F, ease: "none" }, e.t);
          },
        },
      };
    },
  };

  // =============== pinkBand (R7 §5.7): full-bleed showcase plate ===============
  M.pinkBand = {
    enter: "none",
    build: function (el) {
      el.classList.add("br-band");
      el.setAttribute("data-overlay", "1");
      return {};
    },
  };

  // =============== docGrid (R7 S21) ===============
  M.docGrid = {
    enter: "fade",
    build: function (el, p, c) {
      el.classList.add("br-docs");
      var docs = p.docs || [];
      var cols = p.cols || 5;
      var rows = Math.max(1, Math.ceil(docs.length / cols));
      var gap = 16;
      var pad = 12;
      var tw = (W(el) + 3 - pad - 6 - (cols - 1) * gap) / cols;
      var th = (H(el) + 3 - pad - 6 - (rows - 1) * gap) / rows;
      var filled = p.filled === true;
      var items = docs.map(function (d, i) {
        var t = c.entity("d" + (i + 1), div("dg", el));
        Object.assign(t.style, { left: (i % cols) * (tw + gap) + "px", top: pad + Math.floor(i / cols) * (th + gap) + "px", width: tw + "px", height: th + "px" });
        t.setAttribute("data-s", filled ? "full" : "empty");
        div("dg-pg", t);
        div("dg-n", t, d.name || "");
        var s = div("dg-s", t, d.score !== undefined ? String(d.score) : "");
        c.tl.set(s, { autoAlpha: 0 }, 0);
        return { t: t, s: s, d: d };
      });
      return {
        ops: {
          fill: function (e) {
            var st = (e.value && e.value.stagger) || 0.07;
            items.forEach(function (x, i) {
              var t = e.t + i * st;
              c.tl.set(x.t, { attr: { "data-s": "full" } }, t);
              c.tl.fromTo(x.t, { y: 10 }, { y: 0, duration: 4 * F, ease: "power2.out", immediateRender: false }, t);
            });
          },
          score: function (e) {
            items.forEach(function (x, i) {
              if (x.d.score === undefined) return;
              var t = e.t + i * 0.03;
              c.tl.set(x.s, { autoAlpha: 1 }, t);
              c.tl.fromTo(x.s, { scale: 0.5 }, { scale: 1, duration: 3 * F, ease: "power2.out", immediateRender: false }, t);
            });
          },
          select: function (e) {
            items.forEach(function (x) {
              if (x.d.relevant) c.tl.set(x.t, { attr: { "data-s": "rel" } }, e.t);
              else c.tl.to(x.t, { autoAlpha: 0.12, duration: 6 * F, ease: "none" }, e.t + 0.1);
            });
          },
        },
      };
    },
  };

  // =============== keywordHeadline / displayLine (R7 §5.8, E13) ===============
  function headlineBuilder(def) {
    return function (el, p, c) {
      el.classList.add("br-hl");
      var align = p.align || def.align;
      el.style.alignItems = align === "right" ? "flex-end" : align === "left" ? "flex-start" : "center";
      var lines = Array.isArray(p.lines) ? p.lines : [p.text || ""];
      lines = lines.map(function (l) {
        return typeof l === "string" ? l : (l && l.text) || "";
      });
      var size = p.size || def.size;
      var maxW = W(el) + 3;
      var fam = "Inter, ui-sans-serif, system-ui, sans-serif";
      lines.forEach(function (ln) {
        var wpx = global.HFTextFit ? global.HFTextFit.measure(ln, 800, size, fam) - 0.03 * size * ln.length : ln.length * 0.55 * size;
        if (wpx > maxW) size = Math.floor((size * maxW) / wpx);
      });
      var kw = [].concat(p.keyword || []).join(" ").split(/\s+/).map(norm).filter(Boolean);
      var dim = p.dim === true;
      var keySpans = [];
      var all = [];
      lines.forEach(function (txt, i) {
        var d = c.entity("l" + (i + 1), div("hl-l", el));
        d.style.fontSize = size + "px";
        String(txt)
          .split(/\s+/)
          .filter(Boolean)
          .forEach(function (wd, k, arr) {
            var sp = span("", d, wd);
            if (k < arr.length - 1) d.appendChild(document.createTextNode(" "));
            var isKey = kw.indexOf(norm(wd)) >= 0;
            sp.style.color = isKey && p.keywordLit ? tone(p.tone || def.tone) : isKey || dim ? GREY : INK;
            if (isKey) keySpans.push(sp);
            all.push(sp);
          });
      });
      function pick(v) {
        if (v && v.word !== undefined) {
          var k = norm(v.word);
          var hits = all.filter(function (sp) {
            return norm(sp.textContent) === k;
          });
          if (!hits.length) throw new Error('headline: no word "' + v.word + '"');
          return hits;
        }
        return null;
      }
      return {
        ops: {
          recolour: function (e) {
            var sp = pick(e.value) || (keySpans.length ? keySpans : all);
            c.tl.to(sp, { color: tone((e.value && e.value.tone) || p.tone || def.tone), duration: 0.05, ease: "none" }, e.t);
          },
          light: function (e) {
            var sp = pick(e.value) || all.filter(function (s) {
              return keySpans.indexOf(s) < 0;
            });
            c.tl.to(sp, { color: INK, duration: 0.05, ease: "none" }, e.t);
          },
        },
      };
    };
  }
  M.keywordHeadline = { enter: "fade", build: headlineBuilder({ align: "center", size: 56, tone: "magenta" }) };
  M.displayLine = { enter: "fade", build: headlineBuilder({ align: "right", size: 56, tone: "magenta" }) };

  // =============== eyebrow: magenta mono caps line above the host (R7 #8c) ===============
  M.eyebrow = {
    enter: "fade",
    build: function (el, p) {
      el.classList.add("br-eb");
      el.textContent = p.text || "";
      el.style.color = tone(p.tone || "magenta");
      el.style.textAlign = p.align || "left";
      return {};
    },
  };

  // =============== modelTile: black "giant model" tile (R7 S9/S21/S24) ===============
  M.modelTile = {
    enter: "fade",
    build: function (el, p, c) {
      el.classList.add("br-model");
      if (p.overlay) el.setAttribute("data-overlay", "1");
      var cs = div("mt-cs", el);
      (p.chips || []).forEach(function (x) {
        div("mt-c", cs, x);
      });
      c.entity("label", div("mt-l", el, p.label || "Large language model"));
      var tag = c.entity("tag", div("mt-tag", el, p.tag || "$$$"));
      if (!p.tagOn) c.tl.set(tag, { autoAlpha: 0 }, 0);
      return {
        ops: {
          tag: function (e) {
            if (e.value && e.value.text) c.tl.set(tag, { textContent: String(e.value.text) }, e.t);
            c.tl.set(tag, { autoAlpha: 1 }, e.t);
            c.tl.fromTo(tag, { scale: 1.3 }, { scale: 1, duration: 3 * F, ease: "power2.out", immediateRender: false }, e.t);
          },
        },
      };
    },
  };
})(typeof window !== "undefined" ? window : globalThis);
