/*
 * HFStage LF modules (16:9 long-form editorial; plan §3). Media is always ONE layer inside a
 * motion-graphics layout: photos carry animated annotations (highlight boxes, arrows, callouts,
 * lower thirds), numbers count up, timelines tick, lists check off.
 *
 *   photo        a real image (object-fit cover, focal box) with a slow linear push-in 1.00 -> 1.06 over
 *                its visible run toward the focal centre; card (3 px paper border + shadow) or bleed;
 *                scrim (left|right|bottom paper gradient) / veil; credit chip; typeset fallback state.
 *                ops highlight {box:[x,y,w,h]%, label?, tone?}, unhighlight, arrow {from:[x,y]%, to, label?, tone?},
 *                zoomTo {box}, zoomOut, dim {level?}, undim
 *   photoGrid    2-4 photos; ops show {item}, focus {item}, unfocus
 *   portraitCard photo + name + role + years
 *   headlineCard rebuilt news headline (publisher, date, headline, deck); op highlight {phrase?}
 *   bigNumber    count-up figure + unit + context (+ mini bars); ops count {to?, from?, dur?}, fill {bar?}
 *   compareCols  2-3 columns (photo?, title, stats with bars); ops show {col}, stat {col,row}, win {col}, lose {col}
 *   eraTimeline  horizontal era line with thumbnails; ops tick {i}, focus {i}
 *   chapterCard  chapter number, title, promise, chapter progress
 *   recapList    takeaways checked off one by one; op check {i}
 *   endScreen    subscribe CTA + two YouTube end-screen slot outlines (right 45 %); ops show {part}, press
 *   lfText       eyebrow + headline (+ kinetic words, marker highlight) + sub; op highlight {phrase?}
 *   lowerThird   paper lower third with accent bar (slides in); op text via generic
 *   callout      stat / label chip with a leader line to a point; drawn on entrance
 *   mapCard      a locator-map image (media manifest) with pins and flow arrows in % coords;
 *                ops pin {i}, arrow {i}, highlight {box}
 * Media props come from the compiler's slot resolution ({slot} -> src, credit, focal, kind, missing).
 * Everything is seek-safe: tl.set / finite tweens at explicit times only.
 */
(function (global) {
  "use strict";
  var HF = (global.HFStage = global.HFStage || { modules: {} });
  var M = HF.modules;
  var L = HF.lf;
  if (!L) throw new Error("modules-lf.js needs profile-lf.js loaded first");
  var T = L.T;
  var div = L.div;
  var svg = L.svg;
  var W = L.W;
  var H = L.H;
  var F = L.F;
  var MONO = L.MONO;

  var P = "html [data-profile=LF] ";
  var CSS = [
    // ---- photo ----
    P + ".lf-photo .ph-frame{position:absolute;inset:0;overflow:hidden;background:#e9e7df;}",
    P + ".lf-photo.card{border:3px solid " + T.card + ";border-radius:12px;background:" + T.card + ";box-shadow:0 18px 44px rgba(30,28,20,.17),0 2px 6px rgba(30,28,20,.09);}",
    P + ".lf-photo.card .ph-frame{border-radius:9px;}",
    P + ".ph-push,.ph-zoom,.ph-ovl{position:absolute;left:0;top:0;width:100%;height:100%;}",
    P + ".ph-zoom img{position:absolute;left:0;top:0;width:100%;height:100%;object-fit:cover;display:block;}",
    P + ".ph-scrim{position:absolute;inset:0;pointer-events:none;}",
    P + ".ph-scrim.s-left{background:linear-gradient(90deg,rgba(247,246,241,.97) 0%,rgba(247,246,241,.93) 30%,rgba(247,246,241,.6) 47%,rgba(247,246,241,0) 66%);}",
    P + ".ph-scrim.s-right{background:linear-gradient(270deg,rgba(247,246,241,.97) 0%,rgba(247,246,241,.93) 30%,rgba(247,246,241,.6) 47%,rgba(247,246,241,0) 66%);}",
    P + ".ph-scrim.s-bottom{background:linear-gradient(0deg,rgba(247,246,241,.96) 0%,rgba(247,246,241,.8) 22%,rgba(247,246,241,0) 48%);}",
    P + ".ph-scrim.s-center{background:radial-gradient(ellipse 62% 70% at 50% 50%,rgba(247,246,241,.95) 0%,rgba(247,246,241,.9) 45%,rgba(247,246,241,.55) 75%,rgba(247,246,241,.25) 100%);}",
    P + ".ph-scrim.s-top{background:linear-gradient(180deg,rgba(247,246,241,.9) 0%,rgba(247,246,241,0) 22%);}",
    P + ".ph-veil{position:absolute;inset:0;background:" + T.paper + ";opacity:0;}",
    P + ".ph-credit{position:absolute;left:12px;bottom:12px;max-width:calc(100% - 24px);padding:3px 9px;border-radius:5px;background:rgba(247,246,241,.94);font-family:" + MONO + ";font-size:15px;font-weight:500;line-height:20px;color:#2f3538;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}",
    P + ".ph-tag{position:absolute;left:14px;top:14px;padding:6px 11px;border-radius:7px;background:" + T.ink + ";color:#fff;font-family:" + MONO + ";font-size:15px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;white-space:nowrap;}",
    P + ".ph-hl{position:absolute;border:4px solid " + T.hot + ";border-radius:9px;box-shadow:0 0 0 1.5px rgba(10,12,14,.45),inset 0 0 0 1.5px rgba(10,12,14,.3);}",
    P + ".ph-hl .lb,.ph-arl{position:absolute;padding:6px 12px;border-radius:7px;background:" + T.ink + ";color:#fff;font-size:21px;font-weight:700;letter-spacing:-.005em;white-space:nowrap;}",
    P + ".ph-hl .lb{left:-4px;bottom:calc(100% + 10px);}",
    P + ".ph-fb{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;background-color:#ecebe4;background-image:repeating-linear-gradient(135deg,rgba(22,32,42,.035) 0 2px,transparent 2px 14px);color:#8b8f8c;text-align:center;padding:24px;}",
    P + ".ph-fb .l{font-size:26px;font-weight:700;color:" + T.ink2 + ";max-width:90%;}",
    P + ".ph-fb .s{font-family:" + MONO + ";font-size:15px;letter-spacing:.12em;color:" + T.muted + ";text-transform:uppercase;}",
    // ---- name card (media ladder rung d: no usable picture) ----
    P + ".ph-nc{position:absolute;inset:0;background:#fff;overflow:hidden;}",
    P + ".ph-nc .nc-side{position:absolute;top:0;bottom:0;right:0;background:" + T.ink + ";background-image:repeating-linear-gradient(135deg,rgba(255,255,255,.045) 0 2px,transparent 2px 18px);}",
    P + ".ph-nc .nc-side:before{content:'';position:absolute;left:0;top:0;bottom:0;width:8px;background:" + T.red + ";}",
    P + ".ph-nc .nc-disc{position:absolute;border-radius:50%;background:#fff;display:flex;align-items:center;justify-content:center;box-shadow:0 0 0 10px rgba(255,255,255,.14),0 14px 34px rgba(0,0,0,.28);color:" + T.ink + ";font-weight:800;letter-spacing:-.02em;}",
    P + ".ph-nc .nc-body{position:absolute;top:0;bottom:0;left:0;display:flex;flex-direction:column;justify-content:center;}",
    P + ".ph-nc .nc-eb{font-family:" + MONO + ";font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:" + T.muted + ";}",
    P + ".ph-nc .nc-nm{font-weight:800;letter-spacing:-.02em;line-height:1.02;color:" + T.ink + ";}",
    P + ".ph-nc .nc-rl{font-weight:650;color:" + T.blue + ";line-height:1.2;}",
    P + ".ph-nc .nc-rule{height:5px;width:72px;background:" + T.red + ";border-radius:3px;}",
    P + ".ph-nc .nc-cx{font-weight:500;color:" + T.ink2 + ";line-height:1.3;}",
    // ---- photoGrid / portrait ----
    P + ".pg-cell{position:absolute;}",
    P + ".pg-cell .ph-cap{position:absolute;left:12px;bottom:12px;padding:5px 10px;border-radius:6px;background:rgba(247,246,241,.95);font-size:19px;font-weight:700;color:" + T.ink + ";white-space:nowrap;}",
    P + ".lf-portrait .nm{font-size:34px;font-weight:800;letter-spacing:-.02em;line-height:1.08;color:" + T.ink + ";}",
    P + ".lf-portrait .rl{font-size:22px;font-weight:500;color:" + T.ink2 + ";margin-top:6px;}",
    P + ".lf-portrait .yr{font-family:" + MONO + ";font-size:17px;font-weight:600;letter-spacing:.06em;color:" + T.muted + ";margin-top:10px;}",
    // ---- headline card ----
    P + ".lf-news{background:" + T.card + ";border:1.5px solid #d9d6cc;border-radius:6px;box-shadow:0 22px 50px rgba(30,28,20,.14),0 2px 5px rgba(30,28,20,.08);}",
    P + ".lf-news .pub{position:absolute;left:40px;top:30px;font-size:22px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:" + T.ink + ";white-space:nowrap;}",
    P + ".lf-news .dt{position:absolute;right:40px;top:33px;font-family:" + MONO + ";font-size:16px;font-weight:500;letter-spacing:.06em;color:" + T.muted + ";white-space:nowrap;}",
    P + ".lf-news .rl{position:absolute;left:40px;right:40px;top:74px;height:3px;background:" + T.ink + ";}",
    P + ".lf-news .rl2{position:absolute;left:40px;right:40px;top:81px;height:1px;background:" + T.ink + ";}",
    P + ".lf-news .hd{position:absolute;left:40px;right:40px;top:112px;font-weight:800;letter-spacing:-.02em;line-height:1.12;color:#111518;}",
    P + ".lf-news .dk{position:absolute;left:40px;right:40px;font-size:25px;font-weight:450;line-height:1.35;color:" + T.ink2 + ";}",
    P + ".lf-news .nt{position:absolute;left:40px;bottom:24px;font-family:" + MONO + ";font-size:15px;letter-spacing:.08em;color:" + T.muted + ";text-transform:uppercase;white-space:nowrap;}",
    // ---- big number ----
    P + ".lf-num{display:flex;flex-direction:column;justify-content:center;}",
    P + ".lf-num .v{font-weight:800;letter-spacing:-.045em;line-height:.95;white-space:nowrap;color:" + T.ink + ";}",
    P + ".lf-num .u{font-weight:700;letter-spacing:-.02em;color:" + T.ink2 + ";margin-left:.18em;}",
    P + ".lf-num .cx{font-weight:500;line-height:1.28;color:" + T.ink2 + ";margin-top:22px;}",
    P + ".lf-num .ey{margin-bottom:16px;}",
    P + ".lf-numcard .lf-num{display:flex;flex-direction:column;justify-content:center;}",
    P + ".lf-numcard .lf-num .cx{margin-top:10px;}",
    P + ".lf-numcard .lf-num .ey{margin-bottom:10px;white-space:normal;line-height:1.3;}",
    P + ".lf-numcard .lf-bars{margin-top:14px;}",
    P + ".lf-bars{margin-top:30px;display:flex;flex-direction:column;gap:14px;}",
    P + ".lf-bars .r{display:flex;align-items:center;gap:16px;height:36px;}",
    P + ".lf-bars .lb{flex:none;width:30%;font-family:" + MONO + ";font-size:16px;font-weight:600;letter-spacing:.06em;color:" + T.ink2 + ";text-transform:uppercase;white-space:nowrap;overflow:hidden;}",
    P + ".lf-bars .tr{flex:1;height:14px;border-radius:7px;background:#e7e4dc;position:relative;overflow:hidden;}",
    P + ".lf-bars .fl{position:absolute;left:0;top:0;bottom:0;border-radius:7px;transform-origin:0 50%;}",
    P + ".lf-bars .dv{flex:none;min-width:92px;text-align:right;font-size:24px;font-weight:800;color:" + T.ink + ";white-space:nowrap;}",
    // ---- compare ----
    P + ".lf-cmp .col{position:absolute;overflow:hidden;}",
    P + ".lf-cmp .col[data-win='1']{border-color:" + T.blue + ";box-shadow:0 0 0 2px " + T.blue + ",0 16px 40px rgba(29,94,189,.16);}",
    P + ".lf-cmp .ttl{font-size:34px;font-weight:800;letter-spacing:-.02em;line-height:1.1;color:" + T.ink + ";white-space:nowrap;}",
    P + ".lf-cmp .sub{font-size:20px;font-weight:500;color:" + T.ink2 + ";margin-top:4px;white-space:nowrap;}",
    P + ".lf-cmp .st{margin-top:18px;}",
    P + ".lf-cmp .st .k{font-family:" + MONO + ";font-size:15px;font-weight:600;letter-spacing:.08em;color:" + T.muted + ";text-transform:uppercase;white-space:nowrap;}",
    P + ".lf-cmp .st .v{font-size:32px;font-weight:800;letter-spacing:-.02em;color:" + T.ink + ";margin-top:2px;white-space:nowrap;}",
    P + ".lf-cmp .st .tr{height:10px;border-radius:5px;background:#e7e4dc;margin-top:8px;position:relative;overflow:hidden;}",
    P + ".lf-cmp .st .fl{position:absolute;left:0;top:0;bottom:0;border-radius:5px;transform-origin:0 50%;}",
    P + ".lf-cmp .badge{position:absolute;right:16px;top:16px;padding:6px 12px;border-radius:7px;background:" + T.blue + ";color:#fff;font-family:" + MONO + ";font-size:15px;font-weight:700;letter-spacing:.1em;z-index:3;}",
    P + ".lf-cmp .vs{position:absolute;width:64px;height:64px;border-radius:50%;background:" + T.ink + ";color:#fff;display:flex;align-items:center;justify-content:center;font-family:" + MONO + ";font-size:20px;font-weight:800;letter-spacing:.04em;z-index:4;box-shadow:0 0 0 6px " + T.paper + ";}",
    // ---- era timeline ----
    P + ".lf-tl .base{position:absolute;height:4px;border-radius:2px;background:#d6d3c9;}",
    P + ".lf-tl .prog{position:absolute;height:4px;border-radius:2px;background:" + T.ink + ";transform-origin:0 50%;}",
    P + ".lf-tl .yr{position:absolute;font-size:30px;font-weight:800;letter-spacing:-.02em;color:" + T.ink + ";text-align:center;white-space:nowrap;}",
    P + ".lf-tl .dot{position:absolute;width:22px;height:22px;margin:-11px 0 0 -11px;border-radius:50%;background:" + T.card + ";border:4px solid " + T.ink + ";box-sizing:border-box;}",
    P + ".lf-tl .dot[data-f='1']{background:" + T.blue + ";border-color:" + T.blue + ";box-shadow:0 0 0 6px rgba(29,94,189,.18);}",
    P + ".lf-tl .cd{position:absolute;padding:12px;border-radius:12px;overflow:hidden;}",
    P + ".lf-tl .cd[data-f='1']{box-shadow:0 0 0 2.5px " + T.blue + ",0 14px 34px rgba(29,94,189,.16);}",
    P + ".lf-tl .th{position:relative;border-radius:8px;overflow:hidden;margin-bottom:12px;}",
    P + ".lf-tl .lb{font-weight:700;line-height:1.18;color:" + T.ink + ";}",
    P + ".lf-tl .sb{font-size:18px;font-weight:500;line-height:1.3;color:" + T.ink2 + ";margin-top:6px;}",
    // ---- chapter card ----
    P + ".lf-chap .ey{position:absolute;left:0;}",
    P + ".lf-chap .no{position:absolute;left:-6px;font-weight:800;letter-spacing:-.06em;line-height:.82;color:" + T.ink + ";}",
    P + ".lf-chap .no b{color:" + T.blue + ";font-weight:800;}",
    P + ".lf-chap .tt{position:absolute;left:0;font-weight:800;letter-spacing:-.03em;line-height:1.04;color:" + T.ink + ";}",
    P + ".lf-chap .pr{position:absolute;left:0;font-weight:500;line-height:1.3;color:" + T.ink2 + ";}",
    P + ".lf-chap .sg{position:absolute;height:8px;border-radius:4px;background:#d6d3c9;overflow:hidden;}",
    P + ".lf-chap .sg .f{position:absolute;inset:0;background:" + T.ink + ";transform-origin:0 50%;}",
    P + ".lf-chap .sg[data-s=cur] .f{background:" + T.blue + ";}",
    // ---- recap ----
    P + ".lf-recap .rw{position:absolute;left:0;right:0;display:flex;align-items:center;gap:26px;}",
    P + ".lf-recap .bx{flex:none;width:44px;height:44px;border-radius:10px;border:3px solid " + T.ink + ";box-sizing:border-box;position:relative;background:" + T.card + ";}",
    P + ".lf-recap .bx .on{position:absolute;inset:-3px;border-radius:10px;background:" + T.blue + ";opacity:0;}",
    P + ".lf-recap .bx svg{position:absolute;left:3px;top:3px;}",
    P + ".lf-recap .tx{font-weight:700;letter-spacing:-.015em;line-height:1.2;color:" + T.ink + ";}",
    P + ".lf-recap .rw[data-c='0'] .tx{color:#8e918d;}",
    // ---- end screen ----
    P + ".lf-end .ey{position:absolute;left:96px;top:190px;}",
    P + ".lf-end .ln{position:absolute;left:96px;font-size:76px;font-weight:800;letter-spacing:-.03em;line-height:1.05;color:" + T.ink + ";white-space:nowrap;}",
    P + ".lf-end .ln b{color:" + T.blue + ";font-weight:800;}",
    P + ".lf-end .sb{position:absolute;left:96px;width:860px;font-size:30px;font-weight:500;line-height:1.35;color:" + T.ink2 + ";}",
    P + ".lf-end .btn{position:absolute;left:96px;height:84px;display:flex;align-items:center;gap:16px;padding:0 34px 0 26px;border-radius:42px;background:#cc0000;color:#fff;font-size:30px;font-weight:800;letter-spacing:.04em;box-shadow:0 14px 30px rgba(204,0,0,.25);white-space:nowrap;}",
    P + ".lf-end .btn[data-on='1']{background:#2b3035;box-shadow:0 10px 24px rgba(20,20,20,.18);}",
    P + ".lf-end .slot{position:absolute;border:3px dashed #bdb9ad;border-radius:16px;background:rgba(255,254,251,.55);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;color:" + T.muted + ";}",
    P + ".lf-end .slot .k{font-family:" + MONO + ";font-size:17px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;}",
    // ---- lfText / lowerThird / callout ----
    P + ".lf-text .ey{margin-bottom:16px;}",
    P + ".lf-plate{box-shadow:0 18px 44px rgba(30,28,20,.16),0 2px 6px rgba(30,28,20,.08);}",
    P + ".lf-plate .ey{margin-bottom:10px;}",
    P + ".lf-text .tt{font-weight:800;letter-spacing:-.028em;line-height:1.06;color:" + T.ink + ";}",
    P + ".lf-text .tt .w{display:inline-block;}",
    P + ".lf-text .sb{font-weight:500;line-height:1.34;color:" + T.ink2 + ";margin-top:18px;}",
    P + ".lf-lt{background:" + T.card + ";border-radius:12px;box-shadow:0 16px 40px rgba(30,28,20,.16),0 2px 5px rgba(30,28,20,.08);overflow:hidden;}",
    P + ".lf-lt .bar{position:absolute;left:0;top:0;bottom:0;width:10px;background:" + T.blue + ";transform-origin:50% 100%;}",
    P + ".lf-lt .in{position:absolute;left:38px;right:28px;top:0;bottom:0;display:flex;flex-direction:column;justify-content:center;}",
    P + ".lf-lt .tg{margin-bottom:8px;}",
    P + ".lf-lt .tt{font-weight:800;letter-spacing:-.02em;line-height:1.08;color:" + T.ink + ";white-space:nowrap;}",
    P + ".lf-lt .sb{font-size:25px;font-weight:500;color:" + T.ink2 + ";margin-top:6px;white-space:nowrap;}",
    P + ".lf-co .chip{position:absolute;left:0;top:0;right:0;bottom:0;border-radius:12px;background:" + T.card + ";border:2.5px solid var(--co," + T.blue + ");box-shadow:0 14px 34px rgba(20,20,10,.2);display:flex;flex-direction:column;justify-content:center;padding:0 20px;}",
    P + ".lf-co .v{font-size:40px;font-weight:800;letter-spacing:-.03em;line-height:1;color:var(--co," + T.blue + ");white-space:nowrap;}",
    P + ".lf-co .t{font-size:21px;font-weight:650;line-height:1.2;color:" + T.ink + ";margin-top:4px;}",
    P + ".lf-co .t.solo{font-size:24px;font-weight:750;margin-top:0;}",
    P + ".lf-co svg.ld{position:absolute;left:0;top:0;overflow:visible;pointer-events:none;}",
    // ---- map ----
    P + ".lf-map .ph-frame{background:#eef0ea;}",
    P + ".lf-map .ph-zoom img{object-fit:contain;}",
    P + ".lf-map .pin{position:absolute;width:0;height:0;}",
    P + ".lf-map .pin .d{position:absolute;left:-11px;top:-11px;width:22px;height:22px;border-radius:50%;background:var(--pc," + T.red + ");border:4px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.35);box-sizing:border-box;}",
    P + ".lf-map .pin .p{position:absolute;left:-26px;top:-26px;width:52px;height:52px;border-radius:50%;border:3px solid var(--pc," + T.red + ");opacity:0;box-sizing:border-box;}",
    P + ".lf-map .pin .lb{position:absolute;left:18px;top:-19px;padding:5px 11px;border-radius:7px;background:" + T.ink + ";color:#fff;font-size:20px;font-weight:700;white-space:nowrap;}",
    P + ".lf-map .mfb{position:absolute;inset:0;background-color:#eef0ea;background-image:linear-gradient(rgba(22,32,42,.06) 1.5px,transparent 1.5px),linear-gradient(90deg,rgba(22,32,42,.06) 1.5px,transparent 1.5px);background-size:80px 80px;}",
  ].join("\n");
  (function () {
    if (document.getElementById("st-lf-mod-style")) return;
    var st = document.createElement("style");
    st.id = "st-lf-mod-style";
    st.textContent = CSS;
    document.head.appendChild(st);
  })();

  // ---------------------------------------------------------------- media body (shared)
  function focalCentre(f) {
    if (!Array.isArray(f) || f.length < 4) return [0.5, 0.5];
    var cx = Number(f[0]) + Number(f[2]) / 2;
    var cy = Number(f[1]) + Number(f[3]) / 2;
    return [Math.max(0, Math.min(1, cx)), Math.max(0, Math.min(1, cy))];
  }
  function isMissing(p) {
    return !!(p && (p.missing || p.mediaStatus === "fallback" || (!p.src && !(p.kind === "video" && p.poster))));
  }
  /** frame (clip) > push (push-in) > zoom (zoomTo) > img | fallback, ovl (annotations ride the image) */
  function mediaBody(parent, p, opts) {
    opts = opts || {};
    var frame = div("ph-frame", parent);
    if (p.bg) frame.style.background = p.bg; // letterbox colour for fit: contain (logos)
    var push = div("ph-push", frame);
    var zoom = div("ph-zoom", push);
    var missing = isMissing(p);
    var fc = focalCentre(p.focal);
    if (!missing) {
      var img = document.createElement("img");
      img.src = p.kind === "video" ? p.poster : p.src;
      img.alt = "";
      if (p.fit === "contain" || opts.contain) img.style.objectFit = "contain";
      img.style.objectPosition = (fc[0] * 100).toFixed(1) + "% " + (fc[1] * 100).toFixed(1) + "%";
      zoom.appendChild(img);
    } else if (p.namecard && opts.fallback !== false) {
      // on the frame, not the zoom layer: zoomTo / push-in never scale the typeset card past its edges
      var ncCard = nameCard(frame, p.namecard, W(parent), H(parent), opts);
    } else if (opts.fallback !== false) {
      var fb = div(opts.fbClass || "ph-fb", zoom);
      // compile marks media without a usable file (props.placeholder); v3_gates fails a chapter that shows one
      fb.setAttribute("data-placeholder", String(p.slot || "missing"));
      if (!opts.fbClass) {
        fb.appendChild(L.glyph(opts.icon || "camera", opts.small ? 40 : 64, "#8b8f8c", 1.6));
        var lbl = p.fallbackLabel || p.alt || p.label || "";
        if (lbl && !opts.small) div("l", fb, lbl);
        // a designed typeset card (icon + label), never an apology on screen
      }
    }
    push.style.transformOrigin = (fc[0] * 100).toFixed(1) + "% " + (fc[1] * 100).toFixed(1) + "%";
    var ovl = div("ph-ovl", zoom);
    // a name card is designed content: it gets the push-in like a photo (no credit, no scrim: no src)
    var nc = missing && !!p.namecard && opts.fallback !== false;
    // picture annotations (highlight boxes, arrows) mean nothing on a name card: they stay hidden
    if (nc) ovl.style.display = "none";
    return { frame: frame, push: push, zoom: zoom, ovl: ovl, missing: missing && !nc, namecard: nc, ncDisc: nc && ncCard ? ncCard.querySelector(".nc-disc") : null };
  }

  /**
   * Name card (media ladder rung d): white card, navy monogram panel on the right (red edge), name /
   * role / year / one-line context typeset on the left. Small or tall frames: panel on top, name below.
   * nc = {name, initials, role?, year?, context?}
   */
  function nameCard(host, nc, w, h, opts) {
    w = w || 600;
    h = h || 400;
    var card = div("ph-nc", host);
    card.setAttribute("data-namecard", "1");
    var wide = w >= 520 && w >= h * 1.2 && !opts.small;
    var side = div("nc-side", card);
    var disc = div("nc-disc", side, String(nc.initials || "?").slice(0, 3));
    var d;
    if (wide) {
      var sw = Math.round(w * 0.36);
      side.style.width = sw + "px";
      d = Math.round(Math.min(sw * 0.62, h * 0.5));
      Object.assign(disc.style, { width: d + "px", height: d + "px", left: Math.round((sw - d) / 2 + 4) + "px", top: Math.round((h - d) / 2) + "px" });
    } else {
      var sh = opts.small ? h : Math.round(h * 0.52);
      Object.assign(side.style, { left: "0", width: "auto", bottom: "auto", height: sh + "px" });
      d = Math.round(Math.min(w * 0.5, sh * 0.62));
      Object.assign(disc.style, { width: d + "px", height: d + "px", left: Math.round((w - d) / 2) + "px", top: Math.round((sh - d) / 2) + "px" });
    }
    disc.style.fontSize = Math.round(d * (String(nc.initials || "").length > 2 ? 0.3 : 0.38)) + "px";
    if (opts.small && !wide) return card;
    var body = div("nc-body", card);
    var pad = Math.round(Math.max(28, Math.min(64, w * 0.055)));
    var bw;
    if (wide) {
      bw = w - Math.round(w * 0.36) - 2 * pad;
      Object.assign(body.style, { left: pad + "px", width: bw + "px", gap: Math.round(h * 0.028) + "px" });
    } else {
      bw = w - 2 * pad;
      Object.assign(body.style, { left: pad + "px", width: bw + "px", top: Math.round(h * 0.52) + "px", gap: Math.round(h * 0.02) + "px" });
    }
    var scale = wide ? Math.min(1, h / 560) : Math.min(1, (h * 0.48) / 300);
    var eb = [nc.year, nc.person === false ? "" : "Profile"].filter(Boolean).join("  ·  ");
    if (eb) {
      var e = div("nc-eb", body, eb);
      e.style.fontSize = Math.round(Math.max(13, 18 * scale)) + "px";
    }
    var nm = div("nc-nm", body, nc.name || "");
    nm.style.fontSize = L.fit(nc.name || "", 800, Math.round(Math.max(26, 68 * scale)), Math.round(Math.max(20, 30 * scale)), bw, 2) + "px";
    if (nc.role) {
      var rl = div("nc-rl", body, nc.role);
      rl.style.fontSize = Math.round(Math.max(17, 30 * scale)) + "px";
    }
    if (nc.context && (wide || h >= 360)) {
      var rule = div("nc-rule", body);
      rule.style.margin = Math.round(6 * scale) + "px 0";
      var cx = div("nc-cx", body, nc.context);
      cx.style.fontSize = Math.round(Math.max(16, 25 * scale)) + "px";
    }
    return card;
  }

  // quadratic arrow path (px) with a numeric length; bend > 0 curves to the left of from->to
  function arrowGeom(a, b, bend) {
    var dx = b[0] - a[0];
    var dy = b[1] - a[1];
    var len = Math.sqrt(dx * dx + dy * dy) || 1;
    var k = bend === undefined ? 0.18 : bend;
    var cx = (a[0] + b[0]) / 2 - (dy / len) * len * k;
    var cy = (a[1] + b[1]) / 2 + (dx / len) * len * k;
    var n = 24;
    var L2 = 0;
    var px = a[0];
    var py = a[1];
    for (var i = 1; i <= n; i++) {
      var t = i / n;
      var x = (1 - t) * (1 - t) * a[0] + 2 * (1 - t) * t * cx + t * t * b[0];
      var y = (1 - t) * (1 - t) * a[1] + 2 * (1 - t) * t * cy + t * t * b[1];
      L2 += Math.sqrt((x - px) * (x - px) + (y - py) * (y - py));
      px = x;
      py = y;
    }
    var ang = Math.atan2(b[1] - cy, b[0] - cx);
    return { d: "M" + a[0].toFixed(1) + " " + a[1].toFixed(1) + " Q" + cx.toFixed(1) + " " + cy.toFixed(1) + " " + b[0].toFixed(1) + " " + b[1].toFixed(1), len: L2, ang: ang };
  }
  /** draw an arrow into `host` (an absolutely positioned overlay box of size w x h); returns nodes */
  function drawArrow(c, host, w, h, from, to, t, o) {
    o = o || {};
    var col = o.color || T.hot;
    var s = svg("svg", { width: w, height: h, viewBox: "0 0 " + w + " " + h, style: "position:absolute;left:0;top:0;overflow:visible;pointer-events:none;" }, host);
    var g = arrowGeom(from, to, o.bend);
    var under = svg("path", { d: g.d, fill: "none", stroke: "rgba(10,12,14,.38)", "stroke-width": (o.width || 6) + 4, "stroke-linecap": "round" }, s);
    var line = svg("path", { d: g.d, fill: "none", stroke: col, "stroke-width": o.width || 6, "stroke-linecap": "round" }, s);
    var hs = (o.width || 6) * 3.2;
    var head = svg("path", { d: "M0 0 L" + -hs + " " + -hs * 0.62 + " L" + -hs + " " + hs * 0.62 + " Z", fill: col, stroke: "rgba(10,12,14,.38)", "stroke-width": 1.5, "stroke-linejoin": "round", transform: "translate(" + to[0].toFixed(1) + " " + to[1].toFixed(1) + ") rotate(" + ((g.ang * 180) / Math.PI).toFixed(1) + ")" }, s);
    var dur = o.dur || 0.35;
    [under, line].forEach(function (pth) {
      pth.setAttribute("stroke-dasharray", g.len.toFixed(1) + " " + (g.len + 10).toFixed(1));
      c.tl.set(pth, { attr: { "stroke-dashoffset": g.len } }, 0);
      c.tl.to(pth, { attr: { "stroke-dashoffset": 0 }, duration: dur, ease: "power2.out" }, t);
    });
    c.tl.set(head, { autoAlpha: 0 }, 0);
    c.tl.set(head, { autoAlpha: 1 }, t + dur * 0.85);
    return { svg: s, head: head };
  }

  // =============================================================== photo
  // props {src, kind?: image|video, poster?, credit?, focal?:[x,y,w,h] fractions, fit?, pushIn?: true,
  //        pushTo?: 1.06, card?: true, scrim?: left|right|bottom|top, veil?: 0-1, creditPos?: inside|frame|none,
  //        tag?, backdrop?, missing?, fallbackLabel?}
  M.photo = {
    enter: "rise",
    build: function (el, p, c) {
      el.classList.add("lf-photo");
      if (p.card !== false) el.classList.add("card");
      if (p.backdrop || p.overlay) el.setAttribute("data-overlay", "1");
      // footage plays in the root media layer UNDER the (transparent) stage: this body is a window
      var video = p.kind === "video" && !!p.src && !p.missing;
      var b = mediaBody(el, video ? { focal: p.focal } : p, { fallback: !video });
      if (video) {
        el.style.background = "transparent";
        b.frame.style.background = "transparent";
      }
      var frame = b.frame;
      // no scrim over the no-image fallback card (it would cover its label)
      if (p.scrim && p.src && !p.missing) div("ph-scrim s-" + p.scrim, frame);
      var veil = div("ph-veil", frame);
      if (p.veil) veil.style.opacity = String(p.veil);
      var w = W(el) - (p.card !== false ? 6 : 0);
      var h = H(el) - (p.card !== false ? 6 : 0);
      if (p.tag) c.entity("tag", div("ph-tag", frame, p.tag));
      if (p.credit && (p.creditPos || "inside") === "inside" && (video || !b.missing)) c.entity("credit", div("ph-credit", frame, p.credit));
      c.tl.set(b.push, { scale: 1 }, 0);
      var hls = [];
      var pct = function (v, d) {
        return [(Number(v[0]) / 100) * w, (Number(v[1]) / 100) * h, d];
      };
      return {
        enter: function (t, recipe, run) {
          L.enterRecipe(c, el, t, recipe);
          if (p.pushIn === false || b.missing || p.kind === "video") return;
          var dur = Math.max(0.6, (run && run.t1 ? run.t1 : c.duration) - t);
          c.tl.fromTo(b.push, { scale: 1 }, { scale: p.pushTo || 1.06, duration: dur, ease: "none", immediateRender: false }, t);
        },
        ops: {
          // box drawn on the picture (4 px hot yellow, dark hairline for contrast) + optional label
          highlight: function (e) {
            var v = e.value || {};
            // a name card has no picture to box: the beat lands as a monogram pulse (compile turns
            // subject highlights on a name card into {pulse: true})
            if (b.namecard) {
              if (b.ncDisc) c.tl.fromTo(b.ncDisc, { scale: 1 }, { scale: 1.08, duration: 0.18, ease: "power2.out", yoyo: true, repeat: 1, immediateRender: false }, e.t);
              return;
            }
            var bx = v.box || [30, 30, 30, 30];
            var hl = div("ph-hl", b.ovl);
            Object.assign(hl.style, { left: bx[0] + "%", top: bx[1] + "%", width: bx[2] + "%", height: bx[3] + "%" });
            if (v.tone) hl.style.borderColor = L.tone(v.tone, T.hot);
            if (v.label) {
              var lb = div("lb", hl, v.label);
              // above the box needs ~62 px of picture; with a tag chip (top-left, ~50 px) above-left
              // would collide with it: then the label sits inside the box's top-left corner
              var above = (bx[1] / 100) * h;
              var tagClash = !!p.tag && above < 110 && (bx[0] / 100) * w < 420;
              if (tagClash) {
                Object.assign(lb.style, { bottom: "auto", top: "10px", left: "10px" });
              } else if (bx[1] < 12 || above < 62) {
                lb.style.bottom = "auto";
                lb.style.top = "calc(100% + 10px)";
              }
            }
            c.tl.set(hl, { autoAlpha: 0 }, 0);
            c.tl.fromTo(hl, { autoAlpha: 0, scale: 1.08 }, { autoAlpha: 1, scale: 1, duration: 0.2, ease: "power2.out", immediateRender: false }, e.t);
            if (v.hold) c.tl.set(hl, { autoAlpha: 0 }, e.t + v.hold);
            hls.push(hl);
          },
          unhighlight: function (e) {
            if (hls.length) c.tl.set(hls[hls.length - 1], { autoAlpha: 0 }, e.t);
          },
          // curved callout arrow from -> to (percent of the photo), drawn in 350 ms, head lands last
          arrow: function (e) {
            var v = e.value || {};
            var a = pct(v.from || [20, 20]);
            var z = pct(v.to || [50, 50]);
            var box = div("", b.ovl);
            Object.assign(box.style, { position: "absolute", left: "0", top: "0", width: w + "px", height: h + "px" });
            drawArrow(c, box, w, h, a, z, e.t, { color: v.tone ? L.tone(v.tone, T.hot) : T.hot, bend: v.bend });
            if (v.label) {
              var lb = div("ph-arl", box, v.label);
              lb.style.left = Math.max(8, Math.min(w - 260, a[0] - 20)) + "px";
              lb.style.top = Math.max(8, a[1] - 54) + "px";
              c.tl.set(lb, { autoAlpha: 0 }, 0);
              c.tl.fromTo(lb, { autoAlpha: 0, y: 8 }, { autoAlpha: 1, y: 0, duration: 0.2, ease: "power2.out", immediateRender: false }, e.t);
            }
            if (v.hold) c.tl.set(box, { autoAlpha: 0 }, e.t + v.hold);
          },
          // push into a region of the picture (percent box), 600 ms inOut; zoomOut returns
          zoomTo: function (e) {
            var v = e.value || {};
            var bx = v.box || [25, 25, 50, 50];
            var s = Math.min(2.4, Math.max(1, Math.min(100 / bx[2], 100 / bx[3])));
            var cx = ((bx[0] + bx[2] / 2) / 100) * w;
            var cy = ((bx[1] + bx[3] / 2) / 100) * h;
            var x = Math.max(w - w * s, Math.min(0, w / 2 - cx * s));
            var y = Math.max(h - h * s, Math.min(0, h / 2 - cy * s));
            c.tl.set(b.zoom, { transformOrigin: "0 0" }, 0);
            c.tl.to(b.zoom, { scale: s, x: x, y: y, duration: v.dur || 0.6, ease: "power2.inOut" }, e.t);
          },
          zoomOut: function (e) {
            c.tl.to(b.zoom, { scale: 1, x: 0, y: 0, duration: (e.value && e.value.dur) || 0.5, ease: "power2.inOut" }, e.t);
          },
          // the picture recedes behind a paper veil (overlays stay crisp); undim restores
          dim: function (e) {
            c.tl.to(veil, { opacity: (e.value && e.value.level) || 0.6, duration: 0.25, ease: "power2.out" }, e.t);
          },
          undim: function (e) {
            c.tl.to(veil, { opacity: p.veil || 0, duration: 0.25, ease: "power2.out" }, e.t);
          },
        },
      };
    },
  };

  // =============================================================== photoGrid
  // props {items:[{src, credit, focal, label?, missing?}] (2-4), cols?, gap?: 18, hidden?: true}
  M.photoGrid = {
    enter: "fade",
    build: function (el, p, c) {
      var items = (p.items || []).slice(0, 4);
      var n = items.length || 1;
      var cols = p.cols || (n === 4 ? 2 : n);
      var rows = Math.ceil(n / cols);
      var gap = p.gap || 18;
      var w = W(el);
      var h = H(el);
      var cw = (w - gap * (cols - 1)) / cols;
      var ch = (h - gap * (rows - 1)) / rows;
      var cells = items.map(function (it, i) {
        var cell = div("pg-cell lf-photo card", el);
        var r = Math.floor(i / cols);
        var k = i % cols;
        // the last row centres when it is short (3 items in 2 cols)
        var inRow = Math.min(cols, n - r * cols);
        var off = ((cols - inRow) * (cw + gap)) / 2;
        Object.assign(cell.style, { left: off + k * (cw + gap) + "px", top: r * (ch + gap) + "px", width: cw + "px", height: ch + "px" });
        var b = mediaBody(cell, it, { small: cw < 420 });
        var veil = div("ph-veil", b.frame);
        if (it.label) div("ph-cap", b.frame, it.label);
        c.entity("i" + (i + 1), cell);
        return { cell: cell, veil: veil, b: b };
      });
      function find(v) {
        var i = (typeof v === "number" ? v : Number(v && (v.item || v.i))) - 1;
        if (!cells[i]) throw new Error("photoGrid has no item " + JSON.stringify(v));
        return i;
      }
      return {
        enter: function (t, recipe) {
          L.enterRecipe(c, el, t, recipe);
          cells.forEach(function (x, i) {
            if (p.hidden) return c.tl.set(x.cell, { autoAlpha: 0 }, 0);
            c.tl.fromTo(x.cell, { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: 0.3, ease: "power2.out", immediateRender: false }, t + 0.09 * i);
            c.tl.fromTo(x.b.push, { scale: 1 }, { scale: 1.04, duration: 6, ease: "none", immediateRender: false }, t);
          });
        },
        ops: {
          show: function (e) {
            var x = cells[find(e.value)];
            c.tl.set(x.cell, { autoAlpha: 0 }, 0);
            c.tl.fromTo(x.cell, { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: 0.3, ease: "power2.out", immediateRender: false }, e.t);
          },
          focus: function (e) {
            var k = find(e.value);
            cells.forEach(function (x, i) {
              c.tl.to(x.veil, { opacity: i === k ? 0 : 0.62, duration: 0.25 }, e.t);
            });
            c.tl.fromTo(cells[k].cell, { scale: 1 }, { scale: 1.025, duration: 0.25, ease: "power2.out", immediateRender: false }, e.t);
          },
          unfocus: function (e) {
            cells.forEach(function (x) {
              c.tl.to(x.veil, { opacity: 0, duration: 0.25 }, e.t);
              c.tl.to(x.cell, { scale: 1, duration: 0.25 }, e.t);
            });
          },
        },
      };
    },
  };

  // =============================================================== portraitCard
  // props {src..., name, role?, years?}
  M.portraitCard = {
    enter: "rise",
    build: function (el, p, c) {
      el.classList.add("lf-card", "lf-portrait");
      if (p.overlay) el.setAttribute("data-overlay", "1");
      var w = W(el);
      var h = H(el);
      var horiz = w > h * 1.05;
      var ph = div("lf-photo", el);
      var pad = 14;
      var textH = 150;
      if (horiz) Object.assign(ph.style, { position: "absolute", left: pad + "px", top: pad + "px", width: h - 2 * pad + "px", height: h - 2 * pad + "px" });
      else Object.assign(ph.style, { position: "absolute", left: pad + "px", top: pad + "px", width: w - 2 * pad + "px", height: h - textH - pad + "px" });
      ph.style.borderRadius = "9px";
      ph.style.overflow = "hidden";
      var b = mediaBody(ph, p, { icon: "camera", small: true });
      b.frame.style.borderRadius = "9px";
      var tx = div("", el);
      if (horiz) Object.assign(tx.style, { position: "absolute", left: h + 12 + "px", right: "24px", top: "0", bottom: "0", display: "flex", flexDirection: "column", justifyContent: "center" });
      else Object.assign(tx.style, { position: "absolute", left: "24px", right: "24px", bottom: "22px" });
      var nm = c.entity("name", div("nm", tx, p.name || ""));
      nm.style.fontSize = L.fit(p.name || "", 800, 34, 24, (horiz ? w - h - 36 : w - 48), 2) + "px";
      if (p.role) c.entity("role", div("rl", tx, p.role));
      if (p.years) c.entity("years", div("yr", tx, p.years));
      return {
        enter: function (t, recipe, run) {
          L.enterRecipe(c, el, t, recipe);
          if (!b.missing) c.tl.fromTo(b.push, { scale: 1 }, { scale: 1.05, duration: Math.max(0.6, run.t1 - t), ease: "none", immediateRender: false }, t);
        },
        ops: {},
      };
    },
  };

  // =============================================================== headlineCard
  // props {publisher, date, headline, deck?, highlight?: phrase, note?: string|false}
  M.headlineCard = {
    enter: "rise",
    build: function (el, p, c) {
      el.classList.add("lf-news");
      var w = W(el);
      var h = H(el);
      div("pub", el, p.publisher || "");
      div("dt", el, p.date || "");
      div("rl", el);
      div("rl2", el);
      var hd = c.entity("headline", div("hd", el));
      var noteH = p.note === false ? 0 : 40;
      var deckH = p.deck ? 80 : 0;
      var avail = h - 112 - 30 - noteH - deckH;
      var size = 60;
      for (; size > 34; size -= 2) {
        var lines = L.lineCount(p.headline || "", 800, size, w - 80);
        if (lines * size * 1.12 <= avail) break;
      }
      hd.style.fontSize = size + "px";
      var mk = L.markPhrase(hd, p.headline || "", p.highlight || "");
      if (p.deck) {
        var dk = div("dk", el, p.deck);
        var used = L.lineCount(p.headline || "", 800, size, w - 80) * size * 1.12;
        dk.style.top = Math.round(112 + used + 22) + "px";
      }
      if (p.note !== false) div("nt", el, p.note || "Headline as reported · retypeset");
      if (p.overlay) el.setAttribute("data-overlay", "1");
      return {
        ops: {
          highlight: function (e) {
            var v = e.value || {};
            var target = mk;
            if (v.phrase && v.phrase !== p.highlight) target = L.markPhrase(hd, p.headline || "", v.phrase);
            if (!target) throw new Error('headlineCard: phrase "' + (v.phrase || p.highlight) + '" not in the headline');
            L.sweep(c, target, e.t, 0.4);
          },
        },
      };
    },
  };

  // =============================================================== bigNumber
  // props {value, from?: 0, prefix?, suffix?, unit?, decimals?, grouping?: intl|in|none, eyebrow?, context?,
  //        tone?, size?, count?: enter|op|false, dur?, bars?: [{label, value (0-100), display, tone?}], barsHidden?}
  M.bigNumber = {
    enter: "rise",
    build: function (el, p, c) {
      // card: true -> a satellite mini-card (paper card, padded); align: center -> centred hero figure
      var host = el;
      if (p.card) {
        el.classList.add("lf-card", "lf-numcard");
        host = div("", el);
        Object.assign(host.style, { position: "absolute", left: "26px", top: "18px", width: W(el) - 52 + "px", height: H(el) - 36 + "px" });
      }
      if (p.overlay || p.card) el.setAttribute("data-overlay", "1");
      host.classList.add("lf-num");
      if (p.align === "center") {
        host.style.alignItems = "center";
        host.style.textAlign = "center";
      }
      var w = W(host);
      // decimals: compile sets them (standIn.js fixNumberDisplay); uncompiled props keep the value's own
      // digits (<= 2) so 1.33 never renders as "1"
      var ownDec = function (x) {
        var m = String(Number(x)).match(/\.(\d+)$/);
        return m ? Math.min(2, m[1].length) : 0;
      };
      var dec = p.decimals !== undefined ? p.decimals : ownDec(p.value);
      var fmt = function (x) {
        return (p.prefix || "") + L.fmtNum(x, dec, p.grouping || "intl") + (p.suffix || "");
      };
      var val = Number(p.value) || 0;
      var from = p.from !== undefined ? Number(p.from) : 0;
      var counting = p.count === "enter" || p.count === "op";
      if (p.eyebrow) div("lf-eyebrow ey", host, p.eyebrow);
      var row = div("", host);
      row.style.whiteSpace = "nowrap";
      var v = c.entity("value", document.createElement("span"));
      v.className = "v";
      row.appendChild(v);
      var widest = fmt(Math.max(Math.abs(val), Math.abs(from)));
      var unitTxt = p.unit || "";
      var size = p.size || 200;
      var rowW = function (sz) {
        // measure the widest string actually shown (count-up start or final value) with a safety margin:
        // canvas metrics run a few % under the rendered heavy digits
        var fig = Math.max(L.measure(fmt(val), 800, sz), L.measure(fmt(from), 800, sz), L.measure(widest, 800, sz));
        return fig * 1.04 + (unitTxt ? L.measure(unitTxt, 700, sz * 0.3) * 1.06 + sz * 0.2 : 0);
      };
      var minSize = p.card ? 56 : 72;
      while (size > minSize && rowW(size) > w) size -= 4;
      // a long unit ("of total exports") that still does not fit beside the figure goes on its own line
      var unitBelow = !!unitTxt && rowW(size) > w;
      v.style.fontSize = size + "px";
      if (p.tone) v.style.color = L.tone(p.tone, T.ink);
      v.textContent = fmt(counting ? from : val);
      if (unitTxt) {
        var u = c.entity("unit", document.createElement("span"));
        u.className = "u";
        u.textContent = unitTxt;
        u.style.fontSize = Math.round(size * 0.3) + "px";
        if (unitBelow) {
          u.style.display = "block";
          u.style.marginLeft = "0";
          u.style.whiteSpace = "normal";
          u.style.fontSize = L.fit(unitTxt, 700, Math.round(size * 0.3), 16, w, 2) + "px";
        }
        row.appendChild(u);
      }
      if (p.context) {
        var cx = c.entity("context", div("cx", host, p.context));
        cx.style.fontSize = (p.card ? L.fit(p.context, 500, 24, 19, w, 2) : L.fit(p.context, 500, 34, 26, w, 2)) + "px";
      }
      var bars = [];
      if (Array.isArray(p.bars) && p.bars.length) {
        var bl = div("lf-bars", host);
        if (p.align === "center") bl.style.alignSelf = "stretch";
        p.bars.slice(0, 3).forEach(function (b, i) {
          var r = div("r", bl);
          div("lb", r, b.label || "");
          var tr = div("tr", r);
          var fl = div("fl", tr);
          fl.style.width = Math.max(1, Math.min(100, Number(b.value) || 0)) + "%";
          fl.style.background = L.tone(b.tone || (i === 0 ? "blue" : "grey"), T.blue);
          var dv = div("dv", r, b.display || "");
          c.entity("b" + (i + 1), r);
          bars.push({ fl: fl, dv: dv });
        });
      }
      var cur = counting ? from : val;
      function countTo(t, to, f, dur) {
        var o = { x: f };
        c.tl.set(v, { textContent: fmt(f) }, t);
        c.tl.to(o, { x: to, duration: dur, ease: "power2.out", immediateRender: false, onUpdate: function () { v.textContent = fmt(o.x); } }, t);
        c.tl.set(v, { textContent: fmt(to) }, t + dur);
        cur = to;
      }
      function fillBar(i, t) {
        var b = bars[i];
        c.tl.fromTo(b.fl, { scaleX: 0 }, { scaleX: 1, duration: 0.5, ease: "power3.out", immediateRender: false }, t);
        c.tl.fromTo(b.dv, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.2, immediateRender: false }, t + 0.35);
      }
      bars.forEach(function (b) {
        c.tl.set(b.fl, { scaleX: 0 }, 0);
        c.tl.set(b.dv, { autoAlpha: 0 }, 0);
      });
      return {
        enter: function (t, recipe) {
          L.enterRecipe(c, el, t, recipe);
          if (p.count === "enter") countTo(t + 0.15, val, from, p.dur || 1.2);
          if (!p.barsHidden) bars.forEach(function (b, i) { fillBar(i, t + 0.5 + 0.18 * i); });
        },
        ops: {
          count: function (e) {
            var x = e.value || {};
            countTo(e.t, x.to !== undefined ? Number(x.to) : val, x.from !== undefined ? Number(x.from) : cur, x.dur || p.dur || 1.2);
          },
          fill: function (e) {
            var x = e.value || {};
            if (x.bar) return fillBar(Number(x.bar) - 1, e.t);
            bars.forEach(function (b, i) { fillBar(i, e.t + 0.15 * i); });
          },
        },
      };
    },
  };

  // =============================================================== compareCols
  // props {cols:[{title, sub?, photo?: {src...|slot}, tone?, stats:[{label, value, bar? (0-100), tone?}]}] (2-3),
  //        vs?: true, hidden?: false (cols wait for show), statsHidden?: false (rows wait for stat), photoH?}
  M.compareCols = {
    enter: "fade",
    build: function (el, p, c) {
      el.classList.add("lf-cmp");
      var cols = (p.cols || []).slice(0, 3);
      var n = cols.length || 1;
      var gap = n === 2 && p.vs ? 72 : 28;
      var w = W(el);
      var h = H(el);
      var cw = (w - gap * (n - 1)) / n;
      var out = cols.map(function (col, i) {
        var card = div("col lf-card", el);
        Object.assign(card.style, { left: i * (cw + gap) + "px", top: "0", width: cw + "px", height: h + "px" });
        var y = 0;
        var ph = null;
        if (col.photo) {
          var phH = p.photoH || Math.round(Math.min(h * 0.42, cw * 0.5));
          var box = div("lf-photo", card);
          Object.assign(box.style, { position: "absolute", left: "12px", top: "12px", width: cw - 24 - 3 + "px", height: phH + "px", borderRadius: "9px", overflow: "hidden" });
          ph = mediaBody(box, col.photo, { small: true });
          y = phH + 12;
        }
        var body = div("", card);
        Object.assign(body.style, { position: "absolute", left: "26px", right: "26px", top: y + 22 + "px" });
        var tt = div("ttl", body, col.title || "");
        tt.style.fontSize = L.fit(col.title || "", 800, 34, 22, cw - 52, 1) + "px";
        if (col.sub) {
          var sb = div("sub", body, col.sub);
          sb.style.fontSize = L.fit(col.sub, 500, 20, 15, cw - 52, 1) + "px";
        }
        var rows = (col.stats || []).map(function (s, ri) {
          var st = div("st", body);
          div("k", st, s.label || "");
          var v = div("v", st, s.value || "");
          if (s.tone) v.style.color = L.tone(s.tone, T.ink);
          var fl = null;
          if (s.bar !== undefined) {
            var tr = div("tr", st);
            fl = div("fl", tr);
            fl.style.width = Math.max(1, Math.min(100, Number(s.bar))) + "%";
            fl.style.background = L.tone(s.tone || col.tone || "blue", T.blue);
          }
          c.entity("c" + (i + 1) + "r" + (ri + 1), st);
          return { st: st, fl: fl };
        });
        c.entity("c" + (i + 1), card);
        return { card: card, rows: rows, ph: ph };
      });
      if (n === 2 && p.vs) {
        var vs = div("vs", el, "VS");
        vs.style.left = cw + gap / 2 - 32 + "px";
        vs.style.top = h / 2 - 32 + "px";
        c.entity("vs", vs);
      }
      function col(v) {
        var i = (typeof v === "number" ? v : Number(v && (v.col || v.i))) - 1;
        if (!out[i]) throw new Error("compareCols has no col " + JSON.stringify(v));
        return out[i];
      }
      function showRow(r, t) {
        c.tl.fromTo(r.st, { autoAlpha: 0, y: 10 }, { autoAlpha: 1, y: 0, duration: 0.233, ease: "power2.out", immediateRender: false }, t);
        if (r.fl) c.tl.fromTo(r.fl, { scaleX: 0 }, { scaleX: 1, duration: 0.5, ease: "power3.out", immediateRender: false }, t + 0.1);
      }
      out.forEach(function (o) {
        if (p.hidden) c.tl.set(o.card, { autoAlpha: 0 }, 0);
        o.rows.forEach(function (r) {
          if (p.statsHidden) c.tl.set(r.st, { autoAlpha: 0 }, 0);
          if (r.fl) c.tl.set(r.fl, { scaleX: p.statsHidden ? 0 : 1 }, 0);
        });
      });
      return {
        enter: function (t, recipe, run) {
          L.enterRecipe(c, el, t, recipe);
          out.forEach(function (o, i) {
            if (!p.hidden) c.tl.fromTo(o.card, { autoAlpha: 0, y: 16 }, { autoAlpha: 1, y: 0, duration: 0.3, ease: "power2.out", immediateRender: false }, t + 0.1 * i);
            if (o.ph && !o.ph.missing) c.tl.fromTo(o.ph.push, { scale: 1 }, { scale: 1.05, duration: Math.max(0.6, run.t1 - t), ease: "none", immediateRender: false }, t);
            if (!p.statsHidden)
              o.rows.forEach(function (r, ri) {
                if (r.fl) c.tl.fromTo(r.fl, { scaleX: 0 }, { scaleX: 1, duration: 0.5, ease: "power3.out", immediateRender: false }, t + 0.35 + 0.1 * i + 0.12 * ri);
              });
          });
        },
        ops: {
          show: function (e) {
            var o = col(e.value);
            c.tl.fromTo(o.card, { autoAlpha: 0, y: 16 }, { autoAlpha: 1, y: 0, duration: 0.3, ease: "power2.out", immediateRender: false }, e.t);
          },
          stat: function (e) {
            var o = col(e.value);
            var r = o.rows[(Number(e.value.row) || 1) - 1];
            if (!r) throw new Error("compareCols: no row " + e.value.row);
            showRow(r, e.t);
          },
          win: function (e) {
            var o = col(e.value);
            c.tl.set(o.card, { attr: { "data-win": "1" } }, e.t);
            var bd = div("badge", o.card, (e.value && e.value.text) || "WINNER");
            c.tl.set(bd, { autoAlpha: 0 }, 0);
            c.tl.fromTo(bd, { autoAlpha: 0, scale: 1.3 }, { autoAlpha: 1, scale: 1, duration: 0.2, ease: "back.out(2)", immediateRender: false }, e.t);
          },
          lose: function (e) {
            c.tl.to(col(e.value).card, { opacity: 0.45, duration: 0.25 }, e.t);
          },
        },
      };
    },
  };

  // =============================================================== eraTimeline
  // props {ticks:[{year, label, sub?, photo?: {src...|slot}}] (3-6), hidden?: true (ticks wait for tick ops)}
  M.eraTimeline = {
    enter: "fade",
    build: function (el, p, c) {
      el.classList.add("lf-tl");
      var ticks = (p.ticks || []).slice(0, 6);
      var n = ticks.length || 1;
      var w = W(el);
      var h = H(el);
      var slot = w / n;
      var ly = 70;
      var x0 = slot / 2;
      var x1 = w - slot / 2;
      var inner = div("", el);
      Object.assign(inner.style, { position: "absolute", left: "0", top: "0", width: w + "px", height: h + "px" });
      var base = div("base", inner);
      Object.assign(base.style, { left: x0 + "px", width: x1 - x0 + "px", top: ly - 2 + "px" });
      var prog = div("prog", inner);
      Object.assign(prog.style, { left: x0 + "px", width: x1 - x0 + "px", top: ly - 2 + "px" });
      var hidden = p.hidden !== false;
      c.tl.set(prog, { scaleX: hidden ? 0 : 1 }, 0);
      var cardW = Math.min(slot - 28, 400);
      var items = ticks.map(function (tk, i) {
        var cx = x0 + i * slot;
        var yr = div("yr", inner, String(tk.year || ""));
        Object.assign(yr.style, { left: cx - slot / 2 + "px", width: slot + "px", top: "0" });
        var dot = div("dot", inner);
        Object.assign(dot.style, { left: cx + "px", top: ly + "px" });
        var cd = div("cd lf-card", inner);
        Object.assign(cd.style, { left: cx - cardW / 2 + "px", top: ly + 34 + "px", width: cardW + "px" });
        var th = null;
        if (tk.photo) {
          var thH = Math.max(90, Math.min(Math.round((cardW - 24) * 0.66), h - ly - 34 - 24 - 150));
          var tb = div("th", cd);
          tb.style.height = thH + "px";
          th = mediaBody(tb, tk.photo, { small: true });
        }
        var lb = div("lb", cd, tk.label || "");
        lb.style.fontSize = L.fit(tk.label || "", 700, 25, 19, cardW - 24, 2) + "px";
        if (tk.sub) div("sb", cd, tk.sub);
        c.entity("t" + (i + 1), cd);
        if (hidden) [yr, dot, cd].forEach(function (x) { c.tl.set(x, { autoAlpha: 0 }, 0); });
        return { yr: yr, dot: dot, cd: cd, cx: cx, th: th };
      });
      // the group (years, line, cards) is centred vertically in the rect
      var maxH = h - ly - 34;
      var tallest = 0;
      items.forEach(function (it) {
        tallest = Math.max(tallest, it.cd.offsetHeight);
        if (it.cd.offsetHeight > maxH + 2) c.problems.push("eraTimeline '" + c.id + "': tick card " + it.cd.offsetHeight + " px tall exceeds " + Math.round(maxH) + " px");
      });
      inner.style.top = Math.max(0, Math.round((h - (ly + 34 + tallest)) / 2)) + "px";
      function show(i, t) {
        var it = items[i];
        c.tl.fromTo(it.dot, { autoAlpha: 0, scale: 0.2 }, { autoAlpha: 1, scale: 1, duration: 0.25, ease: "back.out(2.2)", immediateRender: false }, t);
        c.tl.fromTo(it.yr, { autoAlpha: 0, y: 10 }, { autoAlpha: 1, y: 0, duration: 0.233, ease: "power2.out", immediateRender: false }, t);
        c.tl.fromTo(it.cd, { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: 0.3, ease: "power2.out", immediateRender: false }, t + 0.08);
        var frac = n > 1 ? (it.cx - x0) / (x1 - x0) : 1;
        c.tl.to(prog, { scaleX: frac, duration: 0.4, ease: "power2.inOut" }, t);
        if (it.th && !it.th.missing) c.tl.fromTo(it.th.push, { scale: 1 }, { scale: 1.06, duration: 5, ease: "none", immediateRender: false }, t);
      }
      function idx(v) {
        var i = (typeof v === "number" ? v : Number(v && (v.i || v.tick))) - 1;
        if (!items[i]) throw new Error("eraTimeline has no tick " + JSON.stringify(v));
        return i;
      }
      var focused = null;
      return {
        ops: {
          tick: function (e) {
            show(idx(e.value), e.t);
          },
          focus: function (e) {
            var i = idx(e.value);
            if (focused !== null) {
              c.tl.set(items[focused].cd, { attr: { "data-f": "0" } }, e.t);
              c.tl.set(items[focused].dot, { attr: { "data-f": "0" } }, e.t);
            }
            c.tl.set(items[i].cd, { attr: { "data-f": "1" } }, e.t);
            c.tl.set(items[i].dot, { attr: { "data-f": "1" } }, e.t);
            c.tl.fromTo(items[i].cd, { scale: 1 }, { scale: 1.03, duration: 0.2, ease: "power2.out", immediateRender: false }, e.t);
            focused = i;
          },
        },
      };
    },
  };

  // =============================================================== chapterCard
  // props {index, count, title, promise?, eyebrow?}
  M.chapterCard = {
    enter: "none",
    build: function (el, p, c) {
      el.classList.add("lf-chap");
      var w = W(el);
      var h = H(el);
      var n = Math.max(1, Math.min(12, Number(p.count) || 1));
      var k = Math.max(1, Math.min(n, Number(p.index) || 1));
      var ey = div("lf-eyebrow ey", el, p.eyebrow || "Chapter " + k + " of " + n);
      var noSize = Math.min(280, Math.round(h * 0.34));
      var no = div("no", el);
      no.innerHTML = "";
      no.appendChild(document.createTextNode(String(k).padStart(2, "0")));
      var dotB = document.createElement("b");
      dotB.textContent = ".";
      no.appendChild(dotB);
      no.style.fontSize = noSize + "px";
      var ts = L.fit(p.title || "", 800, 84, 52, w, 2);
      var tt = c.entity("title", div("tt", el, p.title || ""));
      tt.style.fontSize = ts + "px";
      tt.style.width = w + "px";
      var tLines = L.lineCount(p.title || "", 800, ts, w);
      var pr = null;
      var ps = 32;
      if (p.promise) {
        ps = L.fit(p.promise, 500, 34, 26, w * 0.92, 2);
        pr = c.entity("promise", div("pr", el, p.promise));
        pr.style.fontSize = ps + "px";
        pr.style.width = w * 0.92 + "px";
      }
      var pLines = p.promise ? L.lineCount(p.promise, 500, ps, w * 0.92) : 0;
      // vertical rhythm: eyebrow, number, title, promise, segments -- centred in the rect
      var hs = [22, noSize * 0.82, tLines * ts * 1.04, pLines ? pLines * ps * 1.3 : 0, 8];
      var mid = p.align === "center";
      var gaps = mid ? [20, 24, pLines ? 20 : 0, 36] : [30, 34, pLines ? 26 : 0, 56];
      if (mid) {
        // centred poster: every line on the frame's centre axis
        [ey, no, tt].forEach(function (x) {
          Object.assign(x.style, { left: "0", width: w + "px", textAlign: "center" });
        });
        if (pr) Object.assign(pr.style, { left: w * 0.04 + "px", textAlign: "center" });
      }
      var total = hs.reduce(function (a, b) { return a + b; }, 0) + gaps.reduce(function (a, b) { return a + b; }, 0);
      var y = Math.max(0, (h - total) / 2);
      ey.style.top = y + "px";
      y += hs[0] + gaps[0];
      no.style.top = y + "px";
      y += hs[1] + gaps[1];
      tt.style.top = y + "px";
      y += hs[2] + gaps[2];
      if (pr) pr.style.top = y + "px";
      y += hs[3] + gaps[3];
      var segW = Math.min(90, (w * 0.7 - 10 * (n - 1)) / n);
      var segX = mid ? (w - (n * segW + (n - 1) * 10)) / 2 : 0;
      var segs = [];
      for (var i = 1; i <= n; i++) {
        var sg = div("sg", el);
        Object.assign(sg.style, { left: segX + (i - 1) * (segW + 10) + "px", top: y + "px", width: segW + "px" });
        sg.setAttribute("data-s", i < k ? "done" : i === k ? "cur" : "todo");
        var f = div("f", sg);
        if (i > k) f.style.display = "none";
        segs.push(f);
      }
      c.tl.set(segs[k - 1], { scaleX: 0 }, 0);
      return {
        enter: function (t) {
          c.tl.set(el, { autoAlpha: 1 }, t);
          c.tl.fromTo(ey, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.2, immediateRender: false }, t);
          c.tl.fromTo(no, { autoAlpha: 0, y: 40 }, { autoAlpha: 1, y: 0, duration: 0.5, ease: "power3.out", immediateRender: false }, t);
          c.tl.fromTo(tt, { autoAlpha: 0, y: 18 }, { autoAlpha: 1, y: 0, duration: 0.4, ease: "power3.out", immediateRender: false }, t + 0.18);
          if (pr) c.tl.fromTo(pr, { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration: 0.35, ease: "power2.out", immediateRender: false }, t + 0.45);
          c.tl.to(segs[k - 1], { scaleX: 1, duration: 0.6, ease: "power2.inOut" }, t + 0.6);
        },
        ops: {},
      };
    },
  };

  // =============================================================== recapList
  // props {items:[text] (3-5), hidden?: false (rows wait for check), size?}
  M.recapList = {
    enter: "fade",
    build: function (el, p, c) {
      el.classList.add("lf-recap");
      var items = (p.items || []).slice(0, 6);
      var w = W(el);
      var h = H(el);
      var pitch = Math.min(118, h / Math.max(1, items.length));
      var size = p.size || 36;
      items.forEach(function (t) {
        size = Math.min(size, L.fit(t, 700, 36, 26, w - 72, 2));
      });
      var rows = items.map(function (t, i) {
        var rw = div("rw", el);
        rw.style.top = i * pitch + "px";
        rw.style.height = pitch - 16 + "px";
        rw.setAttribute("data-c", "0");
        var bx = div("bx", rw);
        var on = div("on", bx);
        var s = svg("svg", { width: 32, height: 32, viewBox: "0 0 24 24", fill: "none", stroke: "#fff", "stroke-width": 3.2, "stroke-linecap": "round", "stroke-linejoin": "round" }, bx);
        var ck = svg("path", { d: "M5 12.5l4.5 4.5L19 7.5", "stroke-dasharray": "24 30" }, s);
        c.tl.set(ck, { attr: { "stroke-dashoffset": 24 } }, 0);
        var tx = div("tx", rw, t);
        tx.style.fontSize = size + "px";
        c.entity("r" + (i + 1), rw);
        if (p.hidden) c.tl.set(rw, { autoAlpha: 0 }, 0);
        return { rw: rw, on: on, ck: ck };
      });
      return {
        ops: {
          check: function (e) {
            var i = (typeof e.value === "number" ? e.value : Number(e.value && (e.value.i || e.value.item))) - 1;
            var r = rows[i];
            if (!r) throw new Error("recapList has no item " + JSON.stringify(e.value));
            if (p.hidden) c.tl.fromTo(r.rw, { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration: 0.233, ease: "power2.out", immediateRender: false }, e.t);
            c.tl.set(r.rw, { attr: { "data-c": "1" } }, e.t);
            c.tl.to(r.on, { opacity: 1, duration: 0.12 }, e.t + 0.05);
            c.tl.to(r.ck, { attr: { "stroke-dashoffset": 0 }, duration: 0.25, ease: "power2.out" }, e.t + 0.1);
          },
        },
      };
    },
  };

  // =============================================================== endScreen (full frame, rect [0,0,1920,1080])
  // props {eyebrow?, lines: [2 lines] (accent word via {text, accent}), sub?, cta?: "SUBSCRIBE", slots?: [2 labels], hidden?: true}
  // The right 45 % (x >= 1056) and bottom 30 % (y >= 756) stay free for YouTube's end-screen elements;
  // the two dashed outlines mark where the video slots go (the user places them in YouTube Studio).
  M.endScreen = {
    enter: "fade",
    build: function (el, p, c) {
      el.classList.add("lf-end");
      var ey = div("lf-eyebrow ey", el, p.eyebrow || "Thanks for watching");
      var lines = (p.lines || ["Thanks for watching."]).slice(0, 2).map(function (ln, i) {
        var d = div("ln", el);
        d.style.top = 236 + i * 84 + "px";
        var txt = typeof ln === "string" ? ln : ln.text;
        var acc = typeof ln === "string" ? null : ln.accent;
        if (acc && txt.indexOf(acc) >= 0) {
          d.appendChild(document.createTextNode(txt.slice(0, txt.indexOf(acc))));
          var b = document.createElement("b");
          b.textContent = acc;
          d.appendChild(b);
          d.appendChild(document.createTextNode(txt.slice(txt.indexOf(acc) + acc.length)));
        } else d.textContent = txt;
        var fs = 76;
        while (fs > 48 && L.measure(txt, 800, fs) > 900) fs -= 2;
        d.style.fontSize = fs + "px";
        c.entity("line" + (i + 1), d);
        return d;
      });
      var sub = null;
      if (p.sub) {
        sub = c.entity("sub", div("sb", el, p.sub));
        sub.style.top = 236 + lines.length * 84 + 26 + "px";
      }
      var btn = c.entity("subscribe", div("btn", el));
      btn.style.top = 236 + lines.length * 84 + (p.sub ? 140 : 44) + "px";
      btn.appendChild(L.glyph("bell", 34, "#fff", 2.2));
      var bt = div("", btn, p.cta || "SUBSCRIBE");
      var slots = (p.slots || ["Next deep dive", "More like this"]).slice(0, 2).map(function (s, i) {
        var o = div("slot", el);
        Object.assign(o.style, { left: "1100px", top: 150 + i * 424 + "px", width: "700px", height: "394px" });
        o.appendChild(L.glyph("play", 44, "#a9a598", 1.8));
        div("k", o, s);
        c.entity("slot" + (i + 1), o);
        return o;
      });
      var parts = { eyebrow: [ey], line1: [lines[0]], line2: lines[1] ? [lines[1]] : [], sub: sub ? [sub] : [], subscribe: [btn], slots: slots };
      if (p.hidden !== false)
        Object.keys(parts).forEach(function (k) {
          if (k === "eyebrow" || k === "line1") return;
          parts[k].forEach(function (x) { c.tl.set(x, { autoAlpha: 0 }, 0); });
        });
      function show(part, t) {
        (parts[part] || []).forEach(function (x, i) {
          c.tl.fromTo(x, { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: 0.3, ease: "power2.out", immediateRender: false }, t + 0.08 * i);
        });
      }
      return {
        enter: function (t, recipe) {
          L.enterRecipe(c, el, t, recipe);
          c.tl.fromTo(lines[0], { autoAlpha: 0, y: 18 }, { autoAlpha: 1, y: 0, duration: 0.35, ease: "power3.out", immediateRender: false }, t + 0.1);
        },
        ops: {
          show: function (e) {
            var part = (e.value && e.value.part) || "subscribe";
            if (!parts[part]) throw new Error("endScreen: unknown part " + part);
            show(part, e.t);
          },
          press: function (e) {
            c.tl.to(btn, { scale: 0.93, duration: 0.1, ease: "power2.in" }, e.t);
            c.tl.to(btn, { scale: 1, duration: 0.25, ease: "back.out(2)" }, e.t + 0.1);
            c.tl.set(btn, { attr: { "data-on": "1" } }, e.t + 0.1);
            c.tl.set(bt, { textContent: "SUBSCRIBED" }, e.t + 0.1);
          },
        },
      };
    },
  };

  // =============================================================== lfText
  // props {eyebrow?, title, sub?, size?: 72, subSize?: 30, maxLines?: 3, tone? (title colour), highlight?: phrase,
  //        kinetic?: false (words rise one by one on entrance), align?: left|center}
  M.lfText = {
    enter: "rise",
    build: function (el, p, c) {
      el.classList.add("lf-text");
      // plate: true -> a centred caption card (punchline / headline over a hero's bottom edge)
      var host = el;
      if (p.plate) {
        el.classList.add("lf-card", "lf-plate");
        el.setAttribute("data-overlay", "1");
        host = div("", el);
        Object.assign(host.style, { position: "absolute", left: "36px", top: "0", width: W(el) - 72 + "px", height: H(el) + "px", display: "flex", flexDirection: "column", justifyContent: "center" });
      }
      var w = W(host);
      if (p.align === "center" || p.plate) host.style.textAlign = "center";
      if (p.eyebrow) c.entity("eyebrow", div("lf-eyebrow ey", host, p.eyebrow));
      var size = L.fit(p.title || "", 800, p.size || 72, Math.round((p.size || 72) * 0.66), w, p.maxLines || 3);
      var tt = c.entity("title", div("tt", host));
      tt.style.fontSize = size + "px";
      if (p.tone) tt.style.color = L.tone(p.tone, T.ink);
      var words = String(p.title || "").split(/\s+/).filter(Boolean);
      var norm = function (x) {
        return String(x).toLowerCase().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
      };
      var need = String(p.highlight || "").split(/\s+/).map(norm).filter(Boolean);
      var at = -1;
      for (var i = 0; need.length && i + need.length <= words.length && at < 0; i++) {
        var ok = true;
        for (var j = 0; j < need.length; j++) if (norm(words[i + j]) !== need[j]) ok = false;
        if (ok) at = i;
      }
      var mk = null;
      var spans = [];
      var host = tt;
      words.forEach(function (wd, i) {
        if (i === at) {
          mk = document.createElement("span");
          mk.className = "lf-mk";
          tt.appendChild(mk);
          host = mk;
        }
        var s = document.createElement("span");
        s.className = "w";
        s.textContent = wd;
        host.appendChild(s);
        spans.push(s);
        if (at >= 0 && i === at + need.length - 1) host = tt;
        if (i < words.length - 1) (i >= at && at >= 0 && i < at + need.length - 1 ? mk : tt).appendChild(document.createTextNode(" "));
      });
      var sb = null;
      if (p.sub) {
        sb = c.entity("sub", div("sb", host, p.sub));
        sb.style.fontSize = L.fit(p.sub, 500, p.subSize || 30, 24, w, 3) + "px";
      }
      if (p.overlay) el.setAttribute("data-overlay", "1");
      return {
        enter: function (t, recipe) {
          if (!p.kinetic) return L.enterRecipe(c, el, t, recipe);
          c.tl.set(el, { autoAlpha: 1 }, t);
          spans.forEach(function (s, i) {
            c.tl.fromTo(s, { autoAlpha: 0, y: 26 }, { autoAlpha: 1, y: 0, duration: 0.3, ease: "power3.out", immediateRender: false }, t + 0.055 * i);
          });
          if (sb) c.tl.fromTo(sb, { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration: 0.3, ease: "power2.out", immediateRender: false }, t + 0.055 * spans.length + 0.15);
        },
        ops: {
          highlight: function (e) {
            if (!mk) throw new Error("lfText '" + c.id + "': no highlight phrase in the title");
            L.sweep(c, mk, e.t, 0.4);
          },
        },
      };
    },
  };

  // =============================================================== lowerThird
  // props {title, sub?, tag?, tone?}  -- slides in from the left (300 ms), accent bar grows
  M.lowerThird = {
    enter: "slide",
    build: function (el, p, c) {
      el.classList.add("lf-lt");
      el.setAttribute("data-overlay", "1");
      var w = W(el);
      var bar = div("bar", el);
      if (p.tone) bar.style.background = L.tone(p.tone, T.blue);
      var inn = div("in", el);
      if (p.tag) c.entity("tag", div("lf-eyebrow tg", inn, p.tag));
      var tt = c.entity("title", div("tt", inn, p.title || ""));
      tt.style.fontSize = L.fit(p.title || "", 800, 46, 28, w - 70, 1) + "px";
      if (p.sub) {
        var sb = c.entity("sub", div("sb", inn, p.sub));
        sb.style.fontSize = L.fit(p.sub, 500, 25, 18, w - 70, 1) + "px";
      }
      return {
        enter: function (t) {
          c.tl.fromTo(el, { autoAlpha: 0, x: -36 }, { autoAlpha: 1, x: 0, duration: 0.3, ease: "power3.out", immediateRender: false }, t);
          c.tl.fromTo(bar, { scaleY: 0 }, { scaleY: 1, duration: 0.3, ease: "power2.out", immediateRender: false }, t + 0.08);
        },
        exit: function (t) {
          c.tl.to(el, { autoAlpha: 0, x: -24, duration: 0.2, ease: "power2.in" }, Math.max(0, t - 0.2));
        },
        ops: {},
      };
    },
  };

  // =============================================================== callout
  // props {value?, text, tone?, to?: [dx, dy] px from the chip's top-left to the point it names}
  M.callout = {
    enter: "pop",
    build: function (el, p, c) {
      el.classList.add("lf-co");
      el.setAttribute("data-overlay", "1");
      el.style.overflow = "visible";
      var w = W(el);
      var h = H(el);
      var col = L.tone(p.tone || "blue", T.blue);
      el.style.setProperty("--co", col);
      var ld = null;
      var dot = null;
      if (Array.isArray(p.to)) {
        var s = svg("svg", { class: "ld", width: w, height: h, viewBox: "0 0 " + w + " " + h }, el);
        var tx = p.to[0];
        var ty = p.to[1];
        var dx = tx - w / 2;
        var dy = ty - h / 2;
        var sx, sy;
        if (Math.abs(dy) * w > Math.abs(dx) * h) {
          sx = w / 2;
          sy = dy > 0 ? h : 0;
        } else {
          sx = dx > 0 ? w : 0;
          sy = h / 2;
        }
        var len = Math.sqrt((tx - sx) * (tx - sx) + (ty - sy) * (ty - sy));
        var dash = len + " " + (len + 10);
        var under = svg("path", { d: "M" + sx + " " + sy + " L" + tx + " " + ty, stroke: "rgba(10,12,14,.35)", "stroke-width": 7, "stroke-linecap": "round", fill: "none", "stroke-dasharray": dash }, s);
        ld = svg("path", { d: "M" + sx + " " + sy + " L" + tx + " " + ty, stroke: col, "stroke-width": 4, "stroke-linecap": "round", fill: "none", "stroke-dasharray": dash }, s);
        dot = svg("circle", { cx: tx, cy: ty, r: 9, fill: col, stroke: "#fff", "stroke-width": 3.5 }, s);
        ld = [ld, under];
        c.tl.set(ld, { attr: { "stroke-dashoffset": len } }, 0);
        c.tl.set(dot, { autoAlpha: 0 }, 0);
      }
      var chip = div("chip", el);
      if (p.value !== undefined && p.value !== "") {
        var v = c.entity("value", div("v", chip, String(p.value)));
        v.style.fontSize = L.fit(String(p.value), 800, 40, 26, w - 40, 1) + "px";
      }
      var t = c.entity("text", div("t" + (p.value !== undefined && p.value !== "" ? "" : " solo"), chip, p.text || ""));
      if (p.rotate) el.style.transform = "rotate(" + p.rotate + "deg)";
      return {
        enter: function (t0) {
          c.tl.fromTo(chip, { autoAlpha: 0, scale: 0.88 }, { autoAlpha: 1, scale: 1, duration: 0.28, ease: "back.out(1.8)", immediateRender: false }, t0);
          c.tl.set(el, { autoAlpha: 1 }, t0);
          if (ld) {
            c.tl.to(ld, { attr: { "stroke-dashoffset": 0 }, duration: 0.3, ease: "power2.out" }, t0 + 0.12);
            c.tl.fromTo(dot, { autoAlpha: 0, scale: 0.3, transformOrigin: "50% 50%" }, { autoAlpha: 1, scale: 1, duration: 0.2, ease: "back.out(2)", immediateRender: false }, t0 + 0.38);
          }
        },
        ops: {},
      };
    },
  };

  // =============================================================== mapCard
  // props {src..., title?, pins:[{at:[x,y]%, label?, tone?, hidden?: true}], arrows:[{from, to, label?, tone?}],
  //        card?: true}. Pins drop on pin {i}; arrows draw on arrow {i}; highlight {box} rings a region.
  M.mapCard = {
    enter: "rise",
    build: function (el, p, c) {
      el.classList.add("lf-photo", "lf-map");
      if (p.card !== false) el.classList.add("card");
      var b = mediaBody(el, p, { contain: true, fbClass: "mfb" });
      if (p.title) div("ph-tag", b.frame, p.title);
      if (p.credit && !b.missing && (p.creditPos || "inside") === "inside") c.entity("credit", div("ph-credit", b.frame, p.credit));
      var w = W(el) - 6;
      var h = H(el) - 6;
      var pins = (p.pins || []).map(function (pn, i) {
        var d = div("pin", b.ovl);
        d.style.left = pn.at[0] + "%";
        d.style.top = pn.at[1] + "%";
        d.style.setProperty("--pc", L.tone(pn.tone || "red", T.red));
        var pulse = div("p", d);
        var dd = div("d", d);
        var lb = pn.label ? div("lb", d, pn.label) : null;
        c.entity("pin" + (i + 1), d);
        if (pn.hidden !== false) c.tl.set(d, { autoAlpha: 0 }, 0);
        return { d: d, dd: dd, pulse: pulse, lb: lb };
      });
      var arrows = (p.arrows || []).map(function (a) {
        return a;
      });
      function idx(v, list, name) {
        var i = (typeof v === "number" ? v : Number(v && v.i)) - 1;
        if (!list[i]) throw new Error("mapCard has no " + name + " " + JSON.stringify(v));
        return i;
      }
      return {
        ops: {
          pin: function (e) {
            var x = pins[idx(e.value, pins, "pin")];
            c.tl.set(x.d, { autoAlpha: 1 }, e.t);
            c.tl.fromTo(x.dd, { y: -40, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.3, ease: "bounce.out", immediateRender: false }, e.t);
            c.tl.fromTo(x.pulse, { scale: 0.4, opacity: 0.9 }, { scale: 1.6, opacity: 0, duration: 0.7, ease: "power2.out", immediateRender: false }, e.t + 0.25);
            if (x.lb) c.tl.fromTo(x.lb, { autoAlpha: 0, x: -8 }, { autoAlpha: 1, x: 0, duration: 0.2, immediateRender: false }, e.t + 0.2);
          },
          arrow: function (e) {
            var a = arrows[idx(e.value, arrows, "arrow")];
            var box = div("", b.ovl);
            Object.assign(box.style, { position: "absolute", left: "0", top: "0", width: w + "px", height: h + "px" });
            drawArrow(c, box, w, h, [(a.from[0] / 100) * w, (a.from[1] / 100) * h], [(a.to[0] / 100) * w, (a.to[1] / 100) * h], e.t, { color: L.tone(a.tone || "blue", T.blue), bend: a.bend, dur: 0.6, width: 5 });
            if (a.label) {
              var lb = div("ph-arl", box, a.label);
              lb.style.left = ((a.from[0] + a.to[0]) / 200) * w - 60 + "px";
              lb.style.top = ((a.from[1] + a.to[1]) / 200) * h - 60 + "px";
              c.tl.set(lb, { autoAlpha: 0 }, 0);
              c.tl.set(lb, { autoAlpha: 1 }, e.t + 0.45);
            }
          },
          highlight: function (e) {
            var bx = (e.value && e.value.box) || [30, 30, 30, 30];
            var hl = div("ph-hl", b.ovl);
            Object.assign(hl.style, { left: bx[0] + "%", top: bx[1] + "%", width: bx[2] + "%", height: bx[3] + "%" });
            c.tl.set(hl, { autoAlpha: 0 }, 0);
            c.tl.fromTo(hl, { autoAlpha: 0, scale: 1.08 }, { autoAlpha: 1, scale: 1, duration: 0.2, immediateRender: false }, e.t);
          },
        },
      };
    },
  };

  HF.lf.mediaBody = mediaBody;
  HF.lf.drawArrow = drawArrow;
})(typeof window !== "undefined" ? window : globalThis);
