/*
 * HFStage LF modules, set 2 (LONGFORM-V2-PLAN §6: visual variety). White/paper plate, channel palette,
 * seek-safe GSAP (every change is a tl.set / finite tween at an explicit time; onUpdate only renders the
 * tween's own progress; no randomness, no clocks, no infinite repeats).
 *
 *   quoteCard      typeset quote (words rise in), marker swipe on the key phrases, source line
 *                  ops highlight {i? (1-based phrase) | phrase?}
 *   timeline       proportional year axis, event pins with stems and cards, a playhead with a year counter
 *                  ops go {i} (1-based: the playhead travels to event i, its pin and card land)
 *   flowDiagram    labelled boxes (icon + label) and money-flow arrows with marching dots
 *                  ops flow {i} (1-based), node {id}
 *   pictogramGrid  1 icon = N units; the filled share lights up in reading order with a counter
 *                  ops fill {to}
 *   barRace        ranking bars that re-order frame by frame (years), value counters, a big frame label
 *                  ops step {i} (1-based frame)
 *   splitScreen    two media halves with a slanted divider, labels, optional VS chip
 *                  ops focus {side: left|right}, unfocus
 *   photoStack     2-3 photo cards popping around a centre element (big number / label)
 *                  ops show {i}, focus {i}
 *   documentStamp  a typeset document on paper; a stamp word slams onto it
 *                  ops stamp {}
 *   flashBurst     6-10 quick frames with white flash cuts, a kicker word lands on the last
 *                  ops burst {}
 * Media items ({slot} -> src/credit/focal/missing, resolved by the compiler) are drawn by the LF `photo` module
 * (modules-lf.js) inside these layouts, so fallbacks / push-ins / credits behave exactly like every other photo.
 */
(function (global) {
  "use strict";
  var HF = (global.HFStage = global.HFStage || { modules: {} });
  var M = HF.modules;
  var L = HF.lf;
  if (!L) throw new Error("modules-lf2.js needs profile-lf.js loaded first");
  var T = L.T;
  var div = L.div;
  var svg = L.svg;
  var W = L.W;
  var H = L.H;
  var F = L.F;
  var MONO = L.MONO;

  var P = "html [data-profile=LF] ";
  var CSS = [
    // ---- shared ----
    P + ".l2-card{position:absolute;background:" + T.card + ";border:1.5px solid " + T.line + ";border-radius:18px;box-shadow:0 22px 50px rgba(30,28,20,.10),0 2px 6px rgba(30,28,20,.06);}",
    P + ".l2-mono{font-family:" + MONO + ";font-weight:700;letter-spacing:.14em;text-transform:uppercase;}",
    P + ".l2-src{position:absolute;font-family:" + MONO + ";font-size:15px;font-weight:500;letter-spacing:.02em;color:" + T.muted + ";white-space:nowrap;}",
    // ---- quote ----
    P + ".l2-quote .qm{position:absolute;font-size:300px;font-weight:800;line-height:1;color:var(--qc);opacity:.14;letter-spacing:-.05em;}",
    P + ".l2-quote .bar{position:absolute;left:0;top:28px;bottom:28px;width:8px;border-radius:0 5px 5px 0;background:var(--qc);transform-origin:50% 0;}",
    P + ".l2-quote .qt{position:absolute;font-weight:700;letter-spacing:-.022em;line-height:1.2;color:" + T.ink + ";}",
    P + ".l2-quote .qt .w{display:inline-block;white-space:pre;}",
    P + ".l2-quote .qt .lf-mk{display:inline;}",
    P + ".l2-quote .by{position:absolute;display:flex;align-items:center;gap:18px;white-space:nowrap;}",
    P + ".l2-quote .by .rule{width:56px;height:3px;border-radius:2px;background:var(--qc);transform-origin:0 50%;}",
    P + ".l2-quote .by .nm{font-size:26px;font-weight:800;letter-spacing:-.01em;color:" + T.ink + ";}",
    P + ".l2-quote .by .rl{font-family:" + MONO + ";font-size:16px;font-weight:500;letter-spacing:.08em;text-transform:uppercase;color:" + T.muted + ";}",
    P + ".l2-quote .pt{position:absolute;border-radius:50%;overflow:hidden;border:4px solid " + T.card + ";box-shadow:0 10px 24px rgba(30,28,20,.18);}",
    // ---- timeline ----
    P + ".l2-tl .ax{position:absolute;height:4px;border-radius:2px;background:#d8d5cb;transform-origin:0 50%;}",
    P + ".l2-tl .axp{position:absolute;height:4px;border-radius:2px;background:" + T.ink + ";transform-origin:0 50%;}",
    P + ".l2-tl .tk{position:absolute;width:2px;height:12px;background:#c9c5b9;}",
    P + ".l2-tl .tkl{position:absolute;width:80px;margin-left:-40px;text-align:center;font-family:" + MONO + ";font-size:15px;font-weight:600;color:" + T.muted + ";}",
    P + ".l2-tl .pin{position:absolute;width:20px;height:20px;margin:-10px 0 0 -10px;border-radius:50%;background:" + T.card + ";border:4px solid var(--ec);box-sizing:border-box;box-shadow:0 0 0 5px rgba(247,246,241,.9);}",
    P + ".l2-tl .pin.on{background:var(--ec);}",
    P + ".l2-tl .stem{position:absolute;width:2px;margin-left:-1px;background:var(--ec);opacity:.55;}",
    P + ".l2-tl .ev{position:absolute;padding:14px 18px 15px;border-radius:14px;background:" + T.card + ";border:1.5px solid " + T.line + ";box-shadow:0 14px 34px rgba(30,28,20,.10);}",
    P + ".l2-tl .ev .y{font-size:34px;font-weight:800;letter-spacing:-.03em;line-height:1;color:var(--ec);}",
    P + ".l2-tl .ev .l{font-size:21px;font-weight:650;line-height:1.22;color:" + T.ink + ";margin-top:7px;}",
    P + ".l2-tl .ph{position:absolute;width:2px;margin-left:-1px;background:" + T.ink + ";}",
    P + ".l2-tl .phb{position:absolute;height:36px;line-height:36px;padding:0 12px;border-radius:9px;background:" + T.ink + ";color:#fff;font-family:" + MONO + ";font-size:19px;font-weight:700;letter-spacing:.04em;white-space:nowrap;}",
    // ---- flow ----
    P + ".l2-flow .nd{position:absolute;border-radius:18px;background:" + T.card + ";border:2px solid " + T.line + ";box-shadow:0 16px 38px rgba(30,28,20,.10);display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;}",
    P + ".l2-flow .nd[data-hl='1']{border-color:var(--nc);box-shadow:0 0 0 3px var(--nc),0 16px 38px rgba(30,28,20,.14);}",
    P + ".l2-flow .ic{width:74px;height:74px;border-radius:50%;background:var(--nt);color:var(--nc);display:flex;align-items:center;justify-content:center;margin-bottom:12px;}",
    P + ".l2-flow .nl{font-size:26px;font-weight:800;letter-spacing:-.015em;line-height:1.1;color:" + T.ink + ";padding:0 14px;}",
    P + ".l2-flow .ns{font-family:" + MONO + ";font-size:14px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:" + T.muted + ";margin-top:6px;}",
    P + ".l2-flow .fl{position:absolute;height:36px;line-height:32px;padding:0 13px;border-radius:18px;background:" + T.card + ";border:2px solid var(--fc);font-size:19px;font-weight:750;color:" + T.ink + ";white-space:nowrap;box-shadow:0 8px 18px rgba(30,28,20,.10);}",
    // ---- pictogram ----
    P + ".l2-pic .ic{position:absolute;color:#d9d6cc;}",
    P + ".l2-pic .fig{position:absolute;font-weight:800;letter-spacing:-.045em;line-height:.9;color:var(--pc);white-space:nowrap;}",
    P + ".l2-pic .of{position:absolute;font-size:34px;font-weight:700;color:" + T.ink2 + ";white-space:nowrap;}",
    P + ".l2-pic .lb{position:absolute;font-size:34px;font-weight:800;letter-spacing:-.02em;line-height:1.14;color:" + T.ink + ";}",
    P + ".l2-pic .un{position:absolute;display:flex;align-items:center;gap:10px;font-family:" + MONO + ";font-size:16px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:" + T.muted + ";white-space:nowrap;}",
    // ---- bar race ----
    P + ".l2-race .ttl{position:absolute;left:0;top:0;font-size:32px;font-weight:800;letter-spacing:-.02em;color:" + T.ink + ";white-space:nowrap;}",
    P + ".l2-race .unit{position:absolute;left:0;top:46px;font-family:" + MONO + ";font-size:15px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:" + T.muted + ";white-space:nowrap;}",
    P + ".l2-race .row{position:absolute;left:0;right:0;}",
    P + ".l2-race .nm{position:absolute;left:0;text-align:right;font-size:22px;font-weight:700;color:" + T.ink + ";white-space:nowrap;}",
    P + ".l2-race .bar{position:absolute;border-radius:0 8px 8px 0;background:var(--bc);transform-origin:0 50%;}",
    P + ".l2-race .row[data-top='1'] .bar{box-shadow:0 0 18px rgba(47,125,246,.45);}",
    P + ".l2-race .row[data-top='1'] .nm{color:var(--bc);font-weight:800;}",
    P + ".l2-race .vl{position:absolute;font-size:22px;font-weight:800;color:" + T.ink + ";white-space:nowrap;}",
    P + ".l2-race .yr{position:absolute;right:0;font-weight:800;letter-spacing:-.05em;line-height:.85;color:#d6d2c6;white-space:nowrap;text-align:right;}",
    // ---- split / stack ----
    P + ".l2-split .half{position:absolute;top:0;bottom:0;overflow:hidden;}",
    P + ".l2-split .veil{position:absolute;inset:0;background:" + T.paper + ";opacity:0;}",
    P + ".l2-split .tag{position:absolute;bottom:88px;padding:16px 26px 17px 30px;border-radius:12px;background:" + T.card + ";box-shadow:0 16px 40px rgba(30,28,20,.18);overflow:hidden;white-space:nowrap;}",
    P + ".l2-split .tag .bar{position:absolute;left:0;top:0;bottom:0;width:8px;background:var(--tc);}",
    P + ".l2-split .tag .t{font-size:36px;font-weight:800;letter-spacing:-.02em;color:" + T.ink + ";}",
    P + ".l2-split .tag .s{font-family:" + MONO + ";font-size:16px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:" + T.muted + ";margin-top:4px;}",
    P + ".l2-split .vs{position:absolute;width:92px;height:92px;margin:-46px 0 0 -46px;border-radius:50%;background:" + T.ink + ";color:#fff;display:flex;align-items:center;justify-content:center;font-family:" + MONO + ";font-size:28px;font-weight:800;letter-spacing:.04em;box-shadow:0 0 0 8px " + T.paper + ",0 16px 36px rgba(20,20,20,.3);}",
    P + ".l2-stack .pc{position:absolute;padding:12px 12px 52px;background:#fff;border-radius:6px;box-shadow:0 24px 50px rgba(30,28,20,.22),0 3px 8px rgba(30,28,20,.12);}",
    P + ".l2-stack .pc .cap{position:absolute;left:16px;right:16px;bottom:13px;font-size:20px;font-weight:750;color:" + T.ink + ";white-space:nowrap;}",
    P + ".l2-stack .ctr{position:absolute;padding:22px 34px 24px;border-radius:18px;background:" + T.ink + ";color:#fff;text-align:center;box-shadow:0 24px 54px rgba(12,16,22,.35);white-space:nowrap;}",
    P + ".l2-stack .ctr .v{font-size:84px;font-weight:800;letter-spacing:-.045em;line-height:.95;}",
    P + ".l2-stack .ctr .k{font-family:" + MONO + ";font-size:16px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#c9d3df;margin-top:10px;}",
    P + ".l2-stack .ctr .tx{font-size:42px;font-weight:800;letter-spacing:-.02em;line-height:1.1;}",
    // ---- document + stamp ----
    P + ".l2-doc .paper{position:absolute;border-radius:6px;background-color:#fbf8ef;background-image:linear-gradient(90deg,rgba(120,100,60,.035) 0,rgba(120,100,60,0) 3%,rgba(120,100,60,0) 97%,rgba(120,100,60,.035) 100%),repeating-linear-gradient(0deg,rgba(90,80,50,.018) 0 1px,transparent 1px 3px),repeating-linear-gradient(97deg,rgba(90,80,50,.02) 0 1px,transparent 1px 7px),radial-gradient(ellipse at 30% 20%,rgba(255,255,255,.7),rgba(236,229,210,.35));box-shadow:0 30px 60px rgba(40,34,20,.20),0 3px 8px rgba(40,34,20,.12);overflow:hidden;}",
    P + ".l2-doc .fold{position:absolute;left:0;right:0;height:2px;background:linear-gradient(180deg,rgba(80,70,40,.08),rgba(255,255,255,.6));}",
    P + ".l2-doc .em{position:absolute;border-radius:50%;border:3px solid #3d4750;display:flex;align-items:center;justify-content:center;color:#3d4750;}",
    P + ".l2-doc .hd{position:absolute;font-family:Georgia,'Times New Roman',serif;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:#262d33;white-space:nowrap;}",
    P + ".l2-doc .rf{position:absolute;font-family:" + MONO + ";font-size:16px;font-weight:600;letter-spacing:.12em;color:#5b6166;white-space:nowrap;}",
    P + ".l2-doc .rl{position:absolute;height:2px;background:#2b3238;opacity:.8;}",
    P + ".l2-doc .ln{position:absolute;font-family:Georgia,'Times New Roman',serif;font-size:23px;line-height:1.3;color:#3b4247;white-space:nowrap;overflow:hidden;}",
    P + ".l2-doc .gb{position:absolute;height:9px;border-radius:5px;background:#dcd6c6;}",
    P + ".l2-doc .stp{position:absolute;display:flex;flex-direction:column;align-items:center;justify-content:center;border:7px solid var(--sc);border-radius:14px;color:var(--sc);padding:10px 34px 12px;white-space:nowrap;box-shadow:inset 0 0 0 4px rgba(255,255,255,.0);}",
    P + ".l2-doc .stp .in{position:absolute;inset:7px;border:2.5px solid var(--sc);border-radius:7px;}",
    P + ".l2-doc .stp .w{font-weight:900;letter-spacing:.08em;line-height:1;}",
    P + ".l2-doc .stp .s{font-family:" + MONO + ";font-size:22px;font-weight:700;letter-spacing:.3em;margin-top:8px;}",
    // ---- flash ----
    P + ".l2-flash .fr{position:absolute;inset:0;overflow:hidden;background:#111;}",
    P + ".l2-flash .fr img{position:absolute;left:0;top:0;width:100%;height:100%;object-fit:cover;}",
    P + ".l2-flash .fr .fb{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:#ecebe4;background-image:repeating-linear-gradient(135deg,rgba(22,32,42,.04) 0 2px,transparent 2px 14px);font-size:54px;font-weight:800;color:" + T.ink2 + ";}",
    P + ".l2-flash .fr .cp{position:absolute;left:40px;bottom:40px;padding:8px 14px;border-radius:8px;background:rgba(247,246,241,.94);font-family:" + MONO + ";font-size:18px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:" + T.ink + ";white-space:nowrap;}",
    P + ".l2-flash .wf{position:absolute;inset:0;background:#fff;}",
    P + ".l2-flash .kk{position:absolute;left:50%;top:50%;padding:18px 36px 20px;border-radius:14px;background:" + T.ink + ";color:#fff;font-size:76px;font-weight:900;letter-spacing:-.01em;white-space:nowrap;box-shadow:0 30px 70px rgba(0,0,0,.45);}",
  ].join("\n");
  (function () {
    if (document.getElementById("st-lf2-style")) return;
    var st = document.createElement("style");
    st.id = "st-lf2-style";
    st.textContent = CSS;
    document.head.appendChild(st);
  })();

  // ---------------------------------------------------------------- helpers
  function tone(name, fb) {
    return L.tone(name || "blue", fb || T.blue);
  }
  function tint(name) {
    var t = HF.tint && HF.tint(name || "blue");
    return (t && (Array.isArray(t) ? t[0] : t)) || "#e5eef9";
  }
  function place(el, x, y, w, h) {
    Object.assign(el.style, { position: "absolute", left: Math.round(x) + "px", top: Math.round(y) + "px" });
    if (w !== undefined) el.style.width = Math.round(w) + "px";
    if (h !== undefined) el.style.height = Math.round(h) + "px";
    return el;
  }
  function hideAt0(c, el) {
    c.tl.set(el, { autoAlpha: 0 }, 0);
  }
  function popIn(c, el, t, o) {
    o = o || {};
    hideAt0(c, el);
    c.tl.fromTo(el, Object.assign({ autoAlpha: 0, y: o.y === undefined ? 14 : o.y, scale: o.scale || 1 }, o.from || {}), Object.assign({ autoAlpha: 1, y: 0, scale: 1, duration: o.dur || 0.35, ease: o.ease || "back.out(1.6)", immediateRender: false }, o.to || {}), t);
  }
  function countText(c, node, from, to, t, dur, fmt) {
    var proxy = { v: from };
    c.tl.set(node, { textContent: fmt(from) }, 0);
    c.tl.to(proxy, { v: to, duration: dur, ease: "power2.out", immediateRender: false, onUpdate: function () { node.textContent = fmt(proxy.v); } }, t);
  }
  /** a media item drawn by the LF photo module inside a host box (fallback / push-in / credit rules shared) */
  function media(c, host, item, key, extra) {
    var box = div("", host);
    Object.assign(box.style, { position: "absolute", left: "0", top: "0", width: W(host) + "px", height: H(host) + "px" });
    var sub = Object.create(c);
    sub.entity = function (s, node) {
      return c.entity(key + (s ? "_" + s : ""), node);
    };
    var props = Object.assign({ card: false, creditPos: "frame", pushTo: 1.05 }, item || {}, extra || {});
    if (props.creditPos === "inside") props.creditPos = "frame";
    var api = M.photo ? M.photo.build(box, props, sub) || {} : {};
    return { el: box, api: api };
  }
  function mediaEnter(c, m, t, run) {
    if (m.api.enter) m.api.enter(t, "none", run);
    else c.tl.set(m.el, { autoAlpha: 1 }, t);
  }

  // original solid pictogram silhouettes (24 px viewBox, fill = currentColor) and line icons for boxes
  var SOLID = {
    person: '<circle cx="12" cy="6.2" r="3.9"/><path d="M4.6 21.5c0-4.6 3.2-8.6 7.4-8.6s7.4 4 7.4 8.6z"/>',
    coin: '<circle cx="12" cy="12" r="9.5"/><circle cx="12" cy="12" r="6.2" fill="#fff" fill-opacity=".28"/>',
    house: '<path d="M12 3 2.5 11.2h2.6V21h5.3v-5.6h3.2V21h5.3v-9.8h2.6z"/>',
    barrel: '<path d="M6 3h12l1 3v12l-1 3H6l-1-3V6z"/><rect x="5" y="8" width="14" height="1.6" fill="#fff" fill-opacity=".3"/><rect x="5" y="14.4" width="14" height="1.6" fill="#fff" fill-opacity=".3"/>',
    car: '<path d="M4 16v-4.3L6.3 6.5h11.4l2.3 5.2V16z"/><circle cx="7.6" cy="17" r="2.2"/><circle cx="16.4" cy="17" r="2.2"/>',
    job: '<rect x="3" y="8" width="18" height="12" rx="2"/><path d="M8.5 8V5.5h7V8" fill="none" stroke="currentColor" stroke-width="2"/>',
    wheat: '<path d="M11.2 22V10h1.6v12z"/><ellipse cx="12" cy="5.4" rx="2" ry="3.2"/><ellipse cx="8.6" cy="9.2" rx="1.8" ry="3" transform="rotate(-35 8.6 9.2)"/><ellipse cx="15.4" cy="9.2" rx="1.8" ry="3" transform="rotate(35 15.4 9.2)"/><ellipse cx="8.8" cy="14" rx="1.8" ry="3" transform="rotate(-35 8.8 14)"/><ellipse cx="15.2" cy="14" rx="1.8" ry="3" transform="rotate(35 15.2 14)"/>',
  };
  var LINE = {
    bank: '<path d="M3 9.5 12 4l9 5.5z"/><path d="M5 10.5v7M9.7 10.5v7M14.3 10.5v7M19 10.5v7M3 20.5h18"/>',
    govt: '<path d="M12 3v2.5M8 9.5a4 4 0 0 1 8 0z"/><path d="M5 9.5h14M6.5 9.5v8.5M10 9.5v8.5M14 9.5v8.5M17.5 9.5v8.5M4 20.5h16"/>',
    people: '<circle cx="8.5" cy="8" r="3"/><path d="M3 19.5c0-3.3 2.5-5.8 5.5-5.8s5.5 2.5 5.5 5.8"/><circle cx="16.5" cy="9" r="2.5"/><path d="M15 14.2c.5-.1 1-.2 1.5-.2 2.6 0 4.5 2.2 4.5 5.1"/>',
    factory: '<path d="M3 20.5V10l5 3.2V10l5 3.2V6h3v-2.5h3V20.5z"/><path d="M7 17h2M12 17h2M17 17h1"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.8 2.6 4 5.8 4 9s-1.2 6.4-4 9c-2.8-2.6-4-5.8-4-9s1.2-6.4 4-9z"/>',
    coin: '<circle cx="12" cy="12" r="8.5"/><path d="M14.8 9.2c-.5-1-1.6-1.6-2.8-1.6-1.6 0-2.8.9-2.8 2.2 0 3 5.8 1.6 5.8 4.4 0 1.3-1.3 2.3-3 2.3-1.3 0-2.5-.6-3-1.7M12 5.8v1.8M12 16.5v1.8"/>',
    card: '<rect x="3" y="5.5" width="18" height="13" rx="2.2"/><path d="M3 9.8h18M6.5 14.8h4"/>',
    ship: '<path d="M3 15.5h18l-2.6 4.5H5.6z"/><path d="M6 15.5v-4h5v4M11 11.5V8h5v7.5"/>',
    oil: '<path d="M12 3.5c3.3 4.3 5.5 7.4 5.5 10.2a5.5 5.5 0 0 1-11 0c0-2.8 2.2-5.9 5.5-10.2z"/>',
    house: '<path d="M3.5 11 12 4l8.5 7M6 9.5v10.5h12V9.5M10 20v-5.5h4V20"/>',
    chart: '<path d="M4 4v16h16"/><path d="M7.5 15l3.5-4 3 2.5L19 7.5"/>',
    doc: '<path d="M6 3h8.5L19 7.5V21H6z"/><path d="M14 3v5h5M9 12h7M9 15.5h7"/>',
    person: '<circle cx="12" cy="8" r="3.6"/><path d="M5.5 20c0-3.8 2.9-6.8 6.5-6.8s6.5 3 6.5 6.8"/>',
    plane: '<path d="M21 12.5 3.5 7.5l2.2 5-2.2 5z"/><path d="M5.7 12.5H13"/>',
    wheat: '<path d="M12 21V9"/><path d="M12 9c-2.5-1-3.5-3-3.5-5.5C11 4.4 12 6.3 12 9zM12 9c2.5-1 3.5-3 3.5-5.5C13 4.4 12 6.3 12 9zM12 14c-2.5-1-3.8-2.8-4-5 2.6.4 3.8 2.4 4 5zM12 14c2.5-1 3.8-2.8 4-5-2.6.4-3.8 2.4-4 5z"/>',
    lock: '<rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>',
    scale: '<path d="M12 4v16M6 20h12M4 8h16M7 8l-3 6.5a3.2 3.2 0 0 0 6 0zM17 8l-3 6.5a3.2 3.2 0 0 0 6 0z"/>',
  };
  function icon(set, name, size, color, sw) {
    var s = svg("svg", { viewBox: "0 0 24 24", width: size, height: size });
    if (set === SOLID) {
      s.setAttribute("fill", color || "currentColor");
      s.innerHTML = SOLID[name] || SOLID.person;
    } else {
      s.setAttribute("fill", "none");
      s.setAttribute("stroke", color || "currentColor");
      s.setAttribute("stroke-width", sw || 1.9);
      s.setAttribute("stroke-linecap", "round");
      s.setAttribute("stroke-linejoin", "round");
      s.innerHTML = LINE[name] || LINE.coin;
    }
    return s;
  }
  function qlen(p0, cc, p1) {
    var n = 24;
    var len = 0;
    var prev = p0;
    for (var i = 1; i <= n; i++) {
      var u = i / n;
      var q = [(1 - u) * (1 - u) * p0[0] + 2 * (1 - u) * u * cc[0] + u * u * p1[0], (1 - u) * (1 - u) * p0[1] + 2 * (1 - u) * u * cc[1] + u * u * p1[1]];
      len += Math.sqrt((q[0] - prev[0]) * (q[0] - prev[0]) + (q[1] - prev[1]) * (q[1] - prev[1]));
      prev = q;
    }
    return len;
  }
  function f1(v) {
    return Math.round(v * 10) / 10;
  }
  function runEnd(c, run, t) {
    return Math.max(t + 0.5, (run && run.t1) || c.duration);
  }

  // =============================================================== quoteCard
  // props {quote, source, role?, date?, highlight?: phrase | [phrases], tone?, photo?: {slot}, auto?: true}
  M.quoteCard = {
    enter: "rise",
    build: function (el, p, c) {
      el.classList.add("l2-quote");
      var w = W(el);
      var h = H(el);
      var col = tone(p.tone || "blue");
      el.style.setProperty("--qc", col);
      var card = place(div("l2-card", el), 0, 0, w, h);
      var bar = div("bar", card);
      var qm = div("qm", card, "“");
      qm.setAttribute("data-layout-allow-overlap", "1"); // the decorative quote mark sits behind the text on purpose
      place(qm, 44, -34);
      var photo = p.photo && typeof p.photo === "object" ? p.photo : null;
      var ps = photo ? Math.min(150, Math.round(h * 0.26)) : 0;
      var padL = 110;
      var padR = photo ? 96 + ps : 96;
      var tw = w - padL - padR;
      var byH = 60;
      var avail = h - 96 - byH - 70;
      var text = String(p.quote || "").trim();
      var size = 64;
      for (; size > 32; size -= 2) {
        var n = L.lineCount(text, 700, size, tw);
        if (n * size * 1.2 <= avail && n <= 6) break;
      }
      var qt = c.entity("quote", place(div("qt", card), padL, 0, tw));
      qt.style.fontSize = size + "px";
      var lines = L.lineCount(text, 700, size, tw);
      var top = Math.round(80 + Math.max(0, (avail - lines * size * 1.2) / 2));
      qt.style.top = top + "px";
      // words (for the rise-in) inside marker spans for the highlighted phrases
      var words = text.split(/\s+/).filter(Boolean);
      var norm = function (x) {
        return String(x).toLowerCase().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
      };
      var phrases = [].concat(p.highlight || []).filter(Boolean).map(function (ph) {
        return String(ph).split(/\s+/).map(norm).filter(Boolean);
      });
      var markAt = {};
      phrases.forEach(function (ph, pi) {
        for (var i = 0; i + ph.length <= words.length; i++) {
          var ok = true;
          for (var j = 0; j < ph.length; j++) if (norm(words[i + j]) !== ph[j]) ok = false;
          if (ok && markAt[i] === undefined) {
            markAt[i] = { len: ph.length, pi: pi };
            break;
          }
        }
      });
      var marks = [];
      var wordEls = [];
      var i = 0;
      while (i < words.length) {
        var host = qt;
        var len = 1;
        if (markAt[i]) {
          host = document.createElement("span");
          host.className = "lf-mk";
          qt.appendChild(host);
          marks[markAt[i].pi] = host;
          len = markAt[i].len;
        }
        for (var k = 0; k < len; k++) {
          var sp = document.createElement("span");
          sp.className = "w";
          sp.textContent = words[i + k] + (i + k < words.length - 1 && k < len - 1 ? " " : "");
          host.appendChild(sp);
          wordEls.push(sp);
        }
        if (i + len < words.length) qt.appendChild(document.createTextNode(" "));
        i += len;
      }
      var by = place(div("by", card), padL, h - 48 - byH, tw, byH);
      var rule = div("rule", by);
      var nm = div("nm", by, p.source || "");
      var meta = [p.role, p.date].filter(Boolean).join(" · ");
      if (meta) div("rl", by, meta);
      var pt = null;
      if (photo) {
        pt = place(div("pt", card), w - 64 - ps, h - 48 - ps - 6, ps, ps);
        var m = media(c, pt, photo, "photo", { pushIn: false });
        m.el.style.borderRadius = "50%";
        pt._m = m;
      }
      var marksSwept = {};
      function sweep(pi, t) {
        var mk = marks[pi];
        if (!mk) throw new Error("quoteCard: no highlight phrase " + (pi + 1) + " in the quote");
        if (marksSwept[pi]) return;
        marksSwept[pi] = true;
        L.sweep(c, mk, t, 0.45);
      }
      marks.forEach(function (mk) {
        c.tl.set(mk, { backgroundSize: "0% 86%" }, 0);
      });
      var entered = false;
      return {
        enter: function (t, recipe, run) {
          L.enterRecipe(c, el, t, recipe);
          if (entered) return;
          entered = true;
          c.tl.fromTo(bar, { scaleY: 0 }, { scaleY: 1, duration: 0.45, ease: "power3.out", immediateRender: false }, t + 0.05);
          c.tl.set(bar, { scaleY: 0 }, 0);
          c.tl.fromTo(qm, { autoAlpha: 0, y: -30 }, { autoAlpha: 1, y: 0, duration: 0.5, ease: "power3.out", immediateRender: false }, t + 0.05);
          hideAt0(c, qm);
          var step = Math.min(0.05, 1.3 / Math.max(1, wordEls.length));
          wordEls.forEach(function (sp, wi) {
            hideAt0(c, sp);
            c.tl.fromTo(sp, { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration: 0.3, ease: "power2.out", immediateRender: false }, t + 0.2 + wi * step);
          });
          var tEnd = t + 0.2 + wordEls.length * step + 0.2;
          c.tl.set(rule, { scaleX: 0 }, 0);
          c.tl.to(rule, { scaleX: 1, duration: 0.35, ease: "power2.out" }, tEnd);
          popIn(c, nm, tEnd + 0.1, { y: 8, ease: "power2.out" });
          if (pt) {
            popIn(c, pt, tEnd, { scale: 0.7, y: 0 });
            mediaEnter(c, pt._m, tEnd, run);
          }
          if (p.auto !== false)
            marks.forEach(function (mk, pi) {
              sweep(pi, tEnd + 0.35 + 0.5 * pi);
            });
        },
        ops: {
          highlight: function (e) {
            var v = e.value || {};
            var pi = v.i ? Number(v.i) - 1 : 0;
            if (v.phrase) {
              var idx = [].concat(p.highlight || []).map(String).indexOf(String(v.phrase));
              if (idx >= 0) pi = idx;
            }
            sweep(pi, e.t);
          },
        },
      };
    },
  };

  // =============================================================== timeline
  // props {items: [{year, label, tone?}] (3-7), start?, end?, auto?: true, tone?}
  M.timeline = {
    enter: "fade",
    build: function (el, p, c) {
      el.classList.add("l2-tl");
      var w = W(el);
      var h = H(el);
      var items = (p.items || []).slice(0, 8).map(function (x, i) {
        return { year: Number(x.year), label: String(x.label || ""), tone: x.tone, i: i };
      });
      if (items.length < 2) throw new Error("timeline: needs 2-8 items");
      var ys = items.map(function (x) {
        return x.year;
      });
      var y0 = p.start !== undefined ? Number(p.start) : Math.min.apply(null, ys);
      var y1 = p.end !== undefined ? Number(p.end) : Math.max.apply(null, ys);
      var span = Math.max(1, y1 - y0);
      var padX = 150;
      var ax = { x0: padX, x1: w - padX, y: Math.round(h * 0.54) };
      // spacing: mostly even (dense recent years stay readable), a little proportional (gaps still read)
      var order = items.slice().sort(function (a, b) {
        return a.year - b.year;
      });
      var X = function (yr) {
        var prop = (yr - y0) / span;
        var k = 0;
        while (k < order.length - 1 && order[k + 1].year <= yr) k++;
        var even;
        if (k >= order.length - 1) even = order.length > 1 ? 1 : 0.5;
        else {
          var a = order[k].year;
          var b = order[k + 1].year;
          even = (k + (b > a ? Math.max(0, Math.min(1, (yr - a) / (b - a))) : 0)) / Math.max(1, order.length - 1);
          if (yr < order[0].year) even = 0;
        }
        return ax.x0 + (0.3 * prop + 0.7 * even) * (ax.x1 - ax.x0);
      };
      var axis = place(div("ax", el), ax.x0 - 60, ax.y - 2, ax.x1 - ax.x0 + 120);
      var prog = place(div("axp", el), ax.x0 - 60, ax.y - 2, 0);
      // ticks: a nice step (1, 2, 5, 10, 20, 25, 50, 100 years)
      var steps = [1, 2, 5, 10, 20, 25, 50, 100, 200];
      var st = steps.filter(function (s) {
        return span / s <= 9;
      })[0] || 200;
      var ticks = [];
      for (var yr = Math.ceil(y0 / st) * st; yr <= y1 + 1e-9; yr += st) {
        var tk = place(div("tk", el), X(yr) - 1, ax.y + 8);
        var tl2 = place(div("tkl", el, String(yr)), X(yr), ax.y + 24);
        ticks.push(tk, tl2);
      }
      // cards alternate above / below; a card that would overlap its same-side neighbour rises a tier
      var cardW = Math.min(300, Math.max(210, (ax.x1 - ax.x0) / Math.max(2, Math.ceil(items.length / 2)) - 20));
      var last = { up: [], dn: [] };
      var nodes = items.map(function (it, k) {
        var col = tone(it.tone || p.tone || (k === items.length - 1 ? "red" : "blue"));
        var up = k % 2 === 0;
        var x = X(it.year);
        var lines = L.lineCount(it.label, 650, 21, cardW - 36);
        var ch = 34 + 7 + lines * 26 + 29;
        var side = up ? last.up : last.dn;
        var tier = 0;
        side.forEach(function (o) {
          if (Math.abs(o.x - x) < cardW + 16) tier = Math.max(tier, o.tier + 1);
        });
        side.push({ x: x, tier: tier });
        var gap = 46 + tier * (ch + 18);
        var cx = Math.max(0, Math.min(w - cardW, x - cardW / 2));
        var cy = up ? ax.y - gap - ch : ax.y + gap + (tier ? 0 : 20);
        if (!up && tier === 0) cy = ax.y + 66;
        var stem = place(div("stem", el), x, up ? cy + ch : ax.y, undefined, up ? ax.y - cy - ch : cy - ax.y);
        stem.style.setProperty("--ec", col);
        var card = place(div("ev", el), cx, cy, cardW);
        card.style.setProperty("--ec", col);
        div("y", card, String(it.year));
        div("l", card, it.label);
        var pin = place(div("pin", el), x, ax.y);
        pin.style.setProperty("--ec", col);
        c.entity("e" + (k + 1), card);
        [stem, card, pin].forEach(function (n) {
          hideAt0(c, n);
        });
        return { it: it, x: x, stem: stem, card: card, pin: pin, up: up };
      });
      // the playhead is a dark year pill riding the axis itself
      var ph = place(div("ph", el), ax.x0, ax.y - 16, undefined, 32);
      var phb = place(div("phb", el, String(y0)), ax.x0, ax.y - 18);
      [ph, phb].forEach(function (n) {
        hideAt0(c, n);
      });
      c.tl.set(phb, { xPercent: -50 }, 0);
      phb.style.zIndex = "3";
      var at = { x: ax.x0, year: y0 };
      var shown = {};
      function go(i, t) {
        var n = nodes[i - 1];
        if (!n) throw new Error("timeline: no item " + i);
        if (shown[i]) return;
        shown[i] = true;
        var dur = Math.min(0.9, 0.35 + Math.abs(n.x - at.x) / 1400);
        c.tl.fromTo([ph, phb], { x: at.x - ax.x0 }, { x: n.x - ax.x0, duration: dur, ease: "power2.inOut", immediateRender: false }, t);
        c.tl.to(prog, { width: n.x - ax.x0 + 60, duration: dur, ease: "power2.inOut" }, t);
        var from = at.year;
        var proxy = { v: from };
        c.tl.to(proxy, { v: n.it.year, duration: dur, ease: "power2.inOut", immediateRender: false, onUpdate: function () { phb.textContent = String(Math.round(proxy.v)); } }, t);
        var ta = t + dur - 0.05;
        c.tl.set(n.pin, { autoAlpha: 1 }, ta);
        c.tl.fromTo(n.pin, { scale: 0.2 }, { scale: 1, duration: 0.35, ease: "back.out(3)", immediateRender: false }, ta);
        c.tl.set(n.pin, { attr: { class: "pin on" } }, ta + 0.1);
        c.tl.set(n.stem, { autoAlpha: 1, transformOrigin: n.up ? "50% 100%" : "50% 0%" }, ta);
        c.tl.fromTo(n.stem, { scaleY: 0 }, { scaleY: 1, duration: 0.25, ease: "power2.out", immediateRender: false }, ta + 0.05);
        popIn(c, n.card, ta + 0.18, { y: n.up ? 16 : -16 });
        at = { x: n.x, year: n.it.year };
      }
      var entered = false;
      return {
        enter: function (t, recipe) {
          L.enterRecipe(c, el, t, recipe);
          if (entered) return;
          entered = true;
          c.tl.set(axis, { scaleX: 0 }, 0);
          c.tl.to(axis, { scaleX: 1, duration: 0.6, ease: "power3.out" }, t);
          ticks.forEach(function (n, k) {
            hideAt0(c, n);
            c.tl.to(n, { autoAlpha: 1, duration: 0.2 }, t + 0.3 + 0.03 * k);
          });
          c.tl.to([ph, phb], { autoAlpha: 1, duration: 0.25 }, t + 0.45);
          if (p.auto !== false)
            nodes.forEach(function (n, k) {
              go(k + 1, t + 0.7 + 0.95 * k);
            });
        },
        ops: {
          go: function (e) {
            go(Number((e.value || {}).i) || 1, e.t);
          },
        },
      };
    },
  };

  // =============================================================== flowDiagram
  // props {nodes: [{id, label, sub?, icon?, tone?}] (2-5), flows: [{from, to, label?, tone?}] (1-6), layout?: row|hub|cycle, auto?: true}
  M.flowDiagram = {
    enter: "fade",
    build: function (el, p, c) {
      el.classList.add("l2-flow");
      var w = W(el);
      var h = H(el);
      var nodes = (p.nodes || []).slice(0, 5);
      var flows = (p.flows || []).slice(0, 6);
      if (nodes.length < 2) throw new Error("flowDiagram: needs 2-5 nodes");
      var layout = p.layout || (nodes.length >= 4 ? "hub" : "row");
      var bw = Math.min(290, Math.max(220, (w - 80) / nodes.length - 90));
      var bh = 206;
      var pos = {};
      if (layout === "row") {
        nodes.forEach(function (n, i) {
          var x = nodes.length === 1 ? w / 2 : 40 + bw / 2 + (i * (w - 80 - bw)) / (nodes.length - 1);
          pos[n.id] = [x, h / 2];
        });
      } else {
        var rx = (w - bw) / 2 - 30;
        var ry = (h - bh) / 2 - 10;
        var ring = layout === "hub" ? nodes.slice(1) : nodes;
        if (layout === "hub") pos[nodes[0].id] = [w / 2, h / 2];
        ring.forEach(function (n, i) {
          var a = -Math.PI / 2 + (i * 2 * Math.PI) / ring.length + (layout === "hub" && ring.length === 2 ? Math.PI / 2 : 0);
          pos[n.id] = [w / 2 + rx * Math.cos(a), h / 2 + ry * Math.sin(a)];
        });
      }
      var s = svg("svg", { width: w, height: h, viewBox: "0 0 " + w + " " + h, style: "position:absolute;left:0;top:0;overflow:visible;" }, el);
      var boxes = {};
      nodes.forEach(function (n) {
        var col = tone(n.tone || "blue");
        var q = pos[n.id];
        var nd = place(div("nd", el), q[0] - bw / 2, q[1] - bh / 2, bw, bh);
        nd.style.setProperty("--nc", col);
        var ic = div("ic", nd);
        ic.style.setProperty("--nt", tint(n.tone || "blue"));
        ic.style.setProperty("--nc", col);
        ic.appendChild(icon(LINE, n.icon || "coin", 40, col, 1.9));
        var nl = div("nl", nd, n.label || n.id);
        nl.style.fontSize = L.fit(n.label || n.id, 800, 26, 18, bw - 28, 2) + "px";
        if (n.sub) div("ns", nd, n.sub);
        c.entity("n_" + n.id, nd);
        hideAt0(c, nd);
        boxes[n.id] = { el: nd, q: q, col: col };
      });
      // edge point of a box towards another point (+ a gap)
      function edge(q, to, gap) {
        var dx = to[0] - q[0];
        var dy = to[1] - q[1];
        var sx = dx === 0 ? Infinity : (bw / 2 + gap) / Math.abs(dx);
        var sy = dy === 0 ? Infinity : (bh / 2 + gap) / Math.abs(dy);
        var k = Math.min(sx, sy);
        return [q[0] + dx * k, q[1] + dy * k];
      }
      var pairCount = {};
      var arrows = flows.map(function (f, i) {
        var a = boxes[f.from];
        var b = boxes[f.to];
        if (!a || !b) throw new Error("flowDiagram: flow " + (i + 1) + " names an unknown node");
        var col = tone(f.tone || "green");
        var key = [f.from, f.to].sort().join("|");
        var nth = (pairCount[key] = (pairCount[key] || 0) + 1);
        var bend = (layout === "row" ? 0.28 : 0.18) * (nth % 2 ? 1 : -1) * (f.from < f.to ? 1 : -1);
        var p0 = edge(a.q, b.q, 14);
        var p1 = edge(b.q, a.q, 22);
        var mx = (p0[0] + p1[0]) / 2;
        var my = (p0[1] + p1[1]) / 2;
        var dx = p1[0] - p0[0];
        var dy = p1[1] - p0[1];
        var cc = [mx + dy * bend, my - dx * bend];
        p0 = edge(a.q, cc, 14);
        p1 = edge(b.q, cc, 22);
        var d = "M" + f1(p0[0]) + " " + f1(p0[1]) + " Q" + f1(cc[0]) + " " + f1(cc[1]) + " " + f1(p1[0]) + " " + f1(p1[1]);
        var len = qlen(p0, cc, p1);
        var base = svg("path", { d: d, fill: "none", stroke: col, "stroke-opacity": 0.28, "stroke-width": 10, "stroke-linecap": "round", pathLength: 1, "stroke-dasharray": "1 1", "stroke-dashoffset": 1 }, s);
        var dots = svg("path", { d: d, fill: "none", stroke: col, "stroke-width": 9, "stroke-linecap": "round", "stroke-dasharray": "0.1 26", opacity: 0 }, s);
        var ang = (Math.atan2(p1[1] - cc[1], p1[0] - cc[0]) * 180) / Math.PI;
        var head = svg("g", { transform: "translate(" + f1(p1[0]) + " " + f1(p1[1]) + ") rotate(" + f1(ang) + ")" }, s);
        svg("path", { d: "M-18 -12 L4 0 L-18 12 Z", fill: col, stroke: T.card, "stroke-width": 2, "stroke-linejoin": "round" }, head);
        hideAt0(c, head);
        var lb = null;
        if (f.label) {
          var u = 0.5;
          var mq = [(1 - u) * (1 - u) * p0[0] + 2 * (1 - u) * u * cc[0] + u * u * p1[0], (1 - u) * (1 - u) * p0[1] + 2 * (1 - u) * u * cc[1] + u * u * p1[1]];
          lb = place(div("fl", el, f.label), mq[0], mq[1]);
          lb.style.setProperty("--fc", col);
          hideAt0(c, lb);
          c.tl.set(lb, { xPercent: -50, yPercent: -50 }, 0);
        }
        return { base: base, dots: dots, head: head, lb: lb, len: len, drawn: false };
      });
      var endT = c.duration;
      function flow(i, t) {
        var a = arrows[i - 1];
        if (!a) throw new Error("flowDiagram: no flow " + i);
        if (a.drawn) return;
        a.drawn = true;
        c.tl.fromTo(a.base, { attr: { "stroke-dashoffset": 1 } }, { attr: { "stroke-dashoffset": 0 }, duration: 0.55, ease: "power2.inOut", immediateRender: false }, t);
        c.tl.set(a.head, { autoAlpha: 1 }, t + 0.5);
        c.tl.fromTo(a.head, { scale: 0.3 }, { scale: 1, duration: 0.25, ease: "back.out(2.5)", immediateRender: false, svgOrigin: "0 0" }, t + 0.5);
        if (a.lb) popIn(c, a.lb, t + 0.35, { scale: 0.8, y: 0 });
        // money on the move: round dots march along the curve until the module leaves
        c.tl.set(a.dots, { attr: { opacity: 1 } }, t + 0.55);
        var dur = Math.max(0.5, endT - t - 0.55);
        c.tl.fromTo(a.dots, { attr: { "stroke-dashoffset": 0 } }, { attr: { "stroke-dashoffset": -f1(dur * 70) }, duration: dur, ease: "none", immediateRender: false }, t + 0.55);
      }
      var shown = {};
      function node(id, t) {
        var b = boxes[id];
        if (!b) throw new Error("flowDiagram: no node " + id);
        if (shown[id]) return;
        shown[id] = true;
        popIn(c, b.el, t, { scale: 0.86, y: 10 });
      }
      var entered = false;
      return {
        enter: function (t, recipe, run) {
          L.enterRecipe(c, el, t, recipe);
          endT = runEnd(c, run, t);
          if (entered) return;
          entered = true;
          nodes.forEach(function (n, i) {
            if (!n.hidden) node(n.id, t + 0.1 + 0.14 * i);
          });
          if (p.auto !== false)
            arrows.forEach(function (_, i) {
              flow(i + 1, t + 0.6 + 0.14 * nodes.length + 0.7 * i);
            });
        },
        ops: {
          flow: function (e) {
            flow(Number((e.value || {}).i) || 1, e.t);
          },
          node: function (e) {
            node(String((e.value || {}).id), e.t);
          },
        },
      };
    },
  };

  // =============================================================== pictogramGrid
  // props {total?: 100, filled, icon?: person|coin|house|barrel|car|job|wheat, tone?, label, unit?, auto?: true, figure?}
  M.pictogramGrid = {
    enter: "fade",
    build: function (el, p, c) {
      el.classList.add("l2-pic");
      var w = W(el);
      var h = H(el);
      var total = Math.max(4, Math.min(100, Math.round(Number(p.total) || 100)));
      var filled = Math.max(0, Math.min(total, Math.round(Number(p.filled) || 0)));
      var col = tone(p.tone || "red");
      el.style.setProperty("--pc", col);
      var cols = p.cols || (total <= 10 ? total : total <= 40 ? 10 : 10);
      var rows = Math.ceil(total / cols);
      var gw = Math.round(w * 0.56);
      var cell = Math.min(gw / cols, (h - 20) / rows);
      var sz = Math.floor(cell * 0.82);
      var gx = 0;
      var gy = Math.round((h - rows * cell) / 2);
      var icons = [];
      for (var i = 0; i < total; i++) {
        var r = Math.floor(i / cols);
        var k = i % cols;
        var ic = place(div("ic", el), gx + k * cell + (cell - sz) / 2, gy + r * cell + (cell - sz) / 2, sz, sz);
        ic.appendChild(icon(SOLID, p.icon || "person", sz));
        icons.push(ic);
      }
      var tx = gx + cols * cell + 70;
      var tw = w - tx;
      var fig = p.figure !== undefined ? String(p.figure) : null;
      var figSize = 190;
      var figEl = place(div("fig", el, fig || "0"), tx, 0);
      var fmt = function (x) {
        return String(Math.round(x));
      };
      var figTxt = fig || String(filled);
      while (figSize > 90 && L.measure(figTxt + "  of " + total, 800, figSize) * 0.8 > tw) figSize -= 10;
      figEl.style.fontSize = figSize + "px";
      var of = place(div("of", el, fig ? "" : "of " + total), tx + L.measure(figTxt, 800, figSize) * 0.96 + 18, 0);
      var lbl = place(div("lb", el, p.label || ""), tx, 0, tw);
      var lh = L.lineCount(p.label || "", 800, 34, tw) * 39;
      var unitH = p.unit ? 40 : 0;
      var blockH = figSize * 0.9 + 22 + lh + (unitH ? 24 + unitH : 0);
      var by = Math.round((h - blockH) / 2);
      figEl.style.top = by + "px";
      of.style.top = by + figSize * 0.9 - 44 + "px";
      lbl.style.top = by + figSize * 0.9 + 22 + "px";
      var un = null;
      if (p.unit) {
        un = place(div("un", el), tx, by + figSize * 0.9 + 22 + lh + 24);
        var mini = icon(SOLID, p.icon || "person", 26, col);
        un.appendChild(mini);
        div("", un, "= " + p.unit);
      }
      var cur = 0;
      function fillTo(to, t) {
        to = Math.max(0, Math.min(total, Math.round(to)));
        if (to <= cur) return;
        var step = Math.min(0.03, 1.4 / Math.max(1, to - cur));
        for (var j = cur; j < to; j++) {
          c.tl.to(icons[j], { color: col, duration: 0.18, ease: "power1.out" }, t + (j - cur) * step);
          c.tl.fromTo(icons[j], { scale: 1.3 }, { scale: 1, duration: 0.3, ease: "back.out(2)", immediateRender: false }, t + (j - cur) * step);
        }
        if (!fig) countText(c, figEl, cur, to, t, Math.max(0.4, (to - cur) * step + 0.2), fmt);
        cur = to;
      }
      var entered = false;
      return {
        enter: function (t, recipe) {
          L.enterRecipe(c, el, t, recipe);
          if (entered) return;
          entered = true;
          icons.forEach(function (ic, j) {
            hideAt0(c, ic);
            c.tl.fromTo(ic, { autoAlpha: 0, scale: 0.6 }, { autoAlpha: 1, scale: 1, duration: 0.25, ease: "power2.out", immediateRender: false }, t + 0.1 + (j % cols) * 0.02 + Math.floor(j / cols) * 0.035);
          });
          [figEl, of, lbl].concat(un ? [un] : []).forEach(function (n, k) {
            popIn(c, n, t + 0.25 + 0.1 * k, { ease: "power3.out" });
          });
          if (p.auto !== false) fillTo(filled, t + 0.9);
        },
        ops: {
          fill: function (e) {
            var v = e.value || {};
            fillTo(v.to !== undefined ? Number(v.to) : filled, e.t);
          },
        },
      };
    },
  };

  // =============================================================== barRace
  // props {frames: [{label, bars: [{name, value}]}], top?: 8, highlight?: name, unit?, title?, source?, decimals?,
  //        prefix?, suffix?, per?: 1.1, auto?: true}
  M.barRace = {
    enter: "fade",
    build: function (el, p, c) {
      el.classList.add("l2-race");
      var w = W(el);
      var h = H(el);
      var frames = (p.frames || []).filter(function (f) {
        return f && Array.isArray(f.bars) && f.bars.length;
      });
      if (!frames.length) throw new Error("barRace: needs frames (or a series ref resolved by the compiler)");
      var topN = Math.max(3, Math.min(10, Number(p.top) || 8));
      var single = frames.length === 1;
      var dec = p.decimals || 0;
      var fmt = function (x) {
        return (p.prefix || "") + L.fmtNum(x, dec, "intl") + (p.suffix || "");
      };
      var headH = p.title ? 84 : p.unit ? 40 : 0;
      if (p.title) div("ttl", el, p.title);
      if (p.unit) place(div("unit", el, p.unit), 0, p.title ? 46 : 0);
      var srcH = p.source ? 30 : 0;
      if (p.source) place(div("l2-src", el, "Source: " + p.source), 0, h - 22);
      var plot = { y0: headH + 14, y1: h - srcH - 10 };
      var rowH = (plot.y1 - plot.y0) / topN;
      var barH = Math.min(52, rowH * 0.72);
      var nameW = 230;
      var bx = nameW + 20;
      var bmax = w - bx - 150;
      // every name that ever makes a top list gets one row element
      var names = [];
      frames.forEach(function (f) {
        f.bars.forEach(function (b) {
          if (names.indexOf(b.name) < 0) names.push(b.name);
        });
      });
      var yr = place(div("yr", el, single ? "" : String(frames[0].label)), 0, 0);
      yr.style.fontSize = Math.round(Math.min(170, rowH * 2.2)) + "px";
      yr.style.top = plot.y1 - Math.round(Math.min(170, rowH * 2.2)) * 0.9 - 6 + "px";
      var rows = {};
      names.forEach(function (nm) {
        var r = place(div("row", el), 0, 0, w, rowH);
        r.setAttribute("data-layout-allow-overlap", "1"); // rows pass each other while re-ranking
        var hl = p.highlight && String(p.highlight).toLowerCase() === String(nm).toLowerCase();
        if (hl) r.setAttribute("data-top", "1");
        r.style.setProperty("--bc", hl ? tone(p.tone || "blue") : "#9fb0c4");
        var n = place(div("nm", r, nm), 0, (rowH - 30) / 2, nameW);
        n.style.fontSize = L.fit(String(nm), 700, 22, 14, nameW, 1) + "px";
        var b = place(div("bar", r), bx, (rowH - barH) / 2, bmax, barH);
        var v = place(div("vl", r, ""), bx, (rowH - 30) / 2);
        c.entity("r_" + String(nm).replace(/[^A-Za-z0-9]+/g, "_"), r);
        rows[nm] = { el: r, bar: b, val: v, n: n, w: 0, y: plot.y1 + 20, v: 0, on: false };
        c.tl.set(b, { scaleX: 0 }, 0);
        c.tl.set(r, { autoAlpha: 0, y: plot.y1 + 20 }, 0);
      });
      function ranked(f) {
        return f.bars
          .slice()
          .sort(function (a, b) {
            return b.value - a.value;
          })
          .slice(0, topN);
      }
      var cur = -1;
      function show(fi, t, dur, orderOverride) {
        var f = frames[fi];
        var list = orderOverride || ranked(f);
        var max = Math.max.apply(null, list.map(function (b) {
          return Math.abs(b.value);
        })) || 1;
        var inTop = {};
        list.forEach(function (b, k) {
          inTop[b.name] = true;
          var r = rows[b.name];
          var y = plot.y0 + k * rowH;
          var sc = Math.max(0.004, Math.abs(b.value) / (max * 1.04));
          if (!r.on) {
            c.tl.set(r.el, { autoAlpha: 1 }, t);
            c.tl.fromTo(r.el, { y: y + 24 }, { y: y, duration: dur, ease: "power2.inOut", immediateRender: false }, t);
          } else c.tl.to(r.el, { y: y, duration: dur, ease: "power2.inOut" }, t);
          c.tl.to(r.bar, { scaleX: sc, duration: dur, ease: "power2.inOut" }, t);
          c.tl.to(r.val, { x: sc * bmax + 14, duration: dur, ease: "power2.inOut" }, t);
          var from = r.v;
          var proxy = { v: from };
          (function (node, pr, to) {
            c.tl.to(pr, { v: to, duration: dur, ease: "power2.inOut", immediateRender: false, onUpdate: function () { node.textContent = fmt(pr.v); } }, t);
          })(r.val, proxy, b.value);
          if (!r.on) c.tl.set(r.val, { textContent: fmt(from) }, 0);
          r.v = b.value;
          r.on = true;
        });
        Object.keys(rows).forEach(function (nm) {
          var r = rows[nm];
          if (!inTop[nm] && r.on) {
            c.tl.to(r.el, { y: plot.y1 + 20, autoAlpha: 0, duration: dur, ease: "power2.in" }, t);
            r.on = false;
          }
        });
        if (!single) c.tl.set(yr, { textContent: String(f.label) }, t + dur * 0.5);
        cur = fi;
      }
      var entered = false;
      var per = Number(p.per) || 1.1;
      return {
        enter: function (t, recipe) {
          L.enterRecipe(c, el, t, recipe);
          if (entered) return;
          entered = true;
          hideAt0(c, yr);
          c.tl.to(yr, { autoAlpha: 1, duration: 0.3 }, t + 0.2);
          if (single) {
            // one frame: bars grow in alphabetical order, then race into rank
            var alpha = ranked(frames[0]).slice().sort(function (a, b) {
              return String(a.name) < String(b.name) ? -1 : 1;
            });
            show(0, t + 0.2, 0.6, alpha);
            show(0, t + 1.3, 0.9);
          } else {
            show(0, t + 0.2, 0.6);
            if (p.auto !== false)
              for (var i = 1; i < frames.length; i++) show(i, t + 0.9 + per * (i - 1) + 0.2, Math.min(0.9, per * 0.85));
          }
        },
        ops: {
          step: function (e) {
            var i = Number((e.value || {}).i) || cur + 2;
            show(Math.max(0, Math.min(frames.length - 1, i - 1)), e.t, 0.8);
          },
        },
      };
    },
  };

  // =============================================================== splitScreen
  // props {left: {slot, label, sub?, tone?}, right: {...}, vs?: true, slant?: 7 (deg)}
  M.splitScreen = {
    enter: "none",
    build: function (el, p, c) {
      el.classList.add("l2-split");
      var w = W(el);
      var h = H(el);
      var slant = p.slant === undefined ? 7 : Number(p.slant);
      var off = Math.tan((slant * Math.PI) / 180) * h;
      var mid = w / 2;
      var gap = 7;
      var sides = ["left", "right"].map(function (side, k) {
        var item = p[side] || {};
        var half = place(div("half", el), 0, 0, w, h);
        // slanted clip: left half ends at mid + off/2 at the top and mid - off/2 at the bottom
        var poly = k === 0 ? "polygon(0 0," + f1(mid + off / 2 - gap) + "px 0," + f1(mid - off / 2 - gap) + "px 100%,0 100%)" : "polygon(" + f1(mid + off / 2 + gap) + "px 0,100% 0,100% 100%," + f1(mid - off / 2 + gap) + "px 100%)";
        half.style.clipPath = poly;
        half.style.webkitClipPath = poly;
        var inner = place(div("", half), k === 0 ? 0 : mid - off / 2, 0, mid + off / 2, h);
        var m = media(c, inner, item, side, {});
        var veil = div("veil", half);
        var col = tone(item.tone || (k === 0 ? "blue" : "red"));
        var tag = null;
        if (item.label) {
          tag = div("tag", el);
          tag.style.setProperty("--tc", col);
          div("bar", tag);
          var tt = div("t", tag, item.label);
          if (item.sub) div("s", tag, item.sub);
          var tw = Math.max(L.measure(item.label, 800, 36), item.sub ? L.measure(String(item.sub).toUpperCase(), 600, 16, MONO) * 1.15 : 0) + 60;
          tag.style.width = Math.round(tw) + "px";
          tag.style.left = Math.round(k === 0 ? 96 : w - 96 - tw) + "px";
          hideAt0(c, tag);
          c.entity(side + "_tag", tag);
          void tt;
        }
        return { half: half, inner: inner, m: m, veil: veil, tag: tag, k: k };
      });
      var line = svg("svg", { width: w, height: h, style: "position:absolute;left:0;top:0;overflow:visible;" }, el);
      var dl = svg("line", { x1: f1(mid + off / 2), y1: 0, x2: f1(mid - off / 2), y2: h, stroke: T.paper, "stroke-width": gap * 2, pathLength: 1, "stroke-dasharray": "1 1", "stroke-dashoffset": 1 }, line);
      var vs = null;
      if (p.vs !== false) {
        vs = place(div("vs", el, "VS"), mid, h / 2);
        hideAt0(c, vs);
      }
      var entered = false;
      return {
        enter: function (t, recipe, run) {
          c.tl.set(el, { autoAlpha: 1 }, t);
          if (entered) return;
          entered = true;
          sides.forEach(function (sd) {
            var dx = sd.k === 0 ? -140 : 140;
            c.tl.set(sd.half, { autoAlpha: 0 }, 0);
            c.tl.fromTo(sd.half, { autoAlpha: 0, x: dx }, { autoAlpha: 1, x: 0, duration: 0.55, ease: "power3.out", immediateRender: false }, t + 0.08 * sd.k);
            mediaEnter(c, sd.m, t, run);
            if (sd.tag) popIn(c, sd.tag, t + 0.5 + 0.12 * sd.k, { y: 20, ease: "power3.out" });
          });
          c.tl.fromTo(dl, { attr: { "stroke-dashoffset": 1 } }, { attr: { "stroke-dashoffset": 0 }, duration: 0.45, ease: "power2.out", immediateRender: false }, t + 0.2);
          if (vs) popIn(c, vs, t + 0.55, { scale: 0.4, y: 0, ease: "back.out(2.4)" });
        },
        ops: {
          focus: function (e) {
            var side = String((e.value || {}).side || "left");
            sides.forEach(function (sd) {
              var on = (sd.k === 0) === (side === "left");
              c.tl.to(sd.veil, { opacity: on ? 0 : 0.62, duration: 0.3, ease: "power2.out" }, e.t);
              if (sd.tag) c.tl.to(sd.tag, { scale: on ? 1.06 : 0.96, autoAlpha: on ? 1 : 0.7, duration: 0.3 }, e.t);
            });
          },
          unfocus: function (e) {
            sides.forEach(function (sd) {
              c.tl.to(sd.veil, { opacity: 0, duration: 0.3 }, e.t);
              if (sd.tag) c.tl.to(sd.tag, { scale: 1, autoAlpha: 1, duration: 0.3 }, e.t);
            });
          },
        },
      };
    },
  };

  // =============================================================== photoStack
  // props {items: [{slot, label?}] (2-3), centre?: {value?, prefix?, suffix?, decimals?, label?, text?}, auto?: true}
  M.photoStack = {
    enter: "fade",
    build: function (el, p, c) {
      el.classList.add("l2-stack");
      var w = W(el);
      var h = H(el);
      var items = (p.items || []).slice(0, 3);
      if (items.length < 2) throw new Error("photoStack: needs 2-3 items");
      var cw = Math.round(Math.min(w * 0.36, (h - 64) * 1.25));
      var ch = Math.round(cw * 0.72);
      // original arrangement: two cards flank the centre element, a third rises behind it
      var spots = items.length === 2
        ? [[w * 0.27, h * 0.47, -6], [w * 0.73, h * 0.53, 5]]
        : [[w * 0.24, h * 0.55, -7], [w * 0.76, h * 0.52, 6], [w * 0.5, h * 0.36, -2]];
      var cards = items.map(function (it, i) {
        var sp = spots[i];
        var pc = place(div("pc", el), sp[0] - cw / 2 - 12, sp[1] - ch / 2 - 12, cw + 24, ch + 64);
        pc.style.zIndex = String(i === 2 ? 1 : 2);
        var box = place(div("", pc), 12, 12, cw, ch);
        box.style.overflow = "hidden";
        box.style.borderRadius = "3px";
        var m = media(c, box, it, "p" + (i + 1), {});
        if (it.label) div("cap", pc, it.label).style.fontSize = L.fit(it.label, 750, 20, 14, cw - 8, 1) + "px";
        c.entity("p" + (i + 1), pc);
        hideAt0(c, pc);
        return { el: pc, m: m, rot: sp[2] };
      });
      var ctr = null;
      var ce = p.centre || p.center;
      if (ce) {
        ctr = div("ctr", el);
        ctr.style.zIndex = "4";
        var fmt = function (x) {
          return (ce.prefix || "") + L.fmtNum(x, ce.decimals || 0, "intl") + (ce.suffix || "");
        };
        var v = null;
        if (ce.value !== undefined) v = div("v", ctr, fmt(Number(ce.value)));
        else div("tx", ctr, ce.text || "");
        if (ce.label) div("k", ctr, ce.label);
        var tw = Math.max(ce.value !== undefined ? L.measure(fmt(Number(ce.value)), 800, 84) : L.measure(ce.text || "", 800, 42), L.measure(String(ce.label || "").toUpperCase(), 700, 16, MONO) * 1.3) + 76;
        place(ctr, w / 2 - tw / 2, h * 0.5 - 70, tw);
        c.entity("centre", ctr);
        hideAt0(c, ctr);
        ctr._v = v;
        ctr._fmt = fmt;
        ctr._val = Number(ce.value);
      }
      var shown = {};
      var run0 = null;
      function show(i, t) {
        var cd = cards[i - 1];
        if (!cd) throw new Error("photoStack: no item " + i);
        if (shown[i]) return;
        shown[i] = true;
        c.tl.set(cd.el, { autoAlpha: 1 }, t);
        c.tl.fromTo(cd.el, { scale: 0.55, rotation: 0, y: 60 }, { scale: 1, rotation: cd.rot, y: 0, duration: 0.55, ease: "back.out(1.5)", immediateRender: false }, t);
        mediaEnter(c, cd.m, t, run0);
      }
      var entered = false;
      return {
        enter: function (t, recipe, run) {
          L.enterRecipe(c, el, t, recipe);
          run0 = run;
          if (entered) return;
          entered = true;
          if (p.auto !== false)
            cards.forEach(function (_, i) {
              show(i + 1, t + 0.1 + 0.28 * i);
            });
          if (ctr) {
            var tc = t + 0.2 + 0.28 * cards.length;
            popIn(c, ctr, tc, { scale: 0.6, y: 0, ease: "back.out(2)" });
            if (ctr._v && Number.isFinite(ctr._val)) countText(c, ctr._v, 0, ctr._val, tc + 0.1, 1.0, ctr._fmt);
          }
        },
        ops: {
          show: function (e) {
            show(Number((e.value || {}).i) || 1, e.t);
          },
          focus: function (e) {
            var i = Number((e.value || {}).i) || 1;
            cards.forEach(function (cd, k) {
              var on = k === i - 1;
              c.tl.set(cd.el, { zIndex: on ? 5 : k === 2 ? 1 : 2 }, e.t);
              c.tl.to(cd.el, { scale: on ? 1.1 : 0.94, autoAlpha: on ? 1 : 0.75, duration: 0.35, ease: "power2.out" }, e.t);
            });
          },
        },
      };
    },
  };

  // =============================================================== documentStamp
  // props {title, ref?, lines?: [string] (<= 6), date?, stamp (<= 12 chars), sub?, tone?: red, angle?: -12, auto?: true}
  M.documentStamp = {
    enter: "rise",
    build: function (el, p, c) {
      el.classList.add("l2-doc");
      var w = W(el);
      var h = H(el);
      var pw = Math.min(w, Math.round(h * 1.28));
      var px = Math.round((w - pw) / 2);
      var paper = place(div("paper", el), px, 0, pw, h);
      c.entity("paper", paper);
      place(div("fold", paper), 0, Math.round(h * 0.52), pw);
      var m = 64;
      var em = place(div("em", paper), m, 50, 64, 64);
      em.appendChild(icon(LINE, "govt", 36, "#3d4750", 1.7));
      var hd = place(div("hd", paper, p.title || "OFFICIAL NOTICE"), m + 86, 56);
      hd.style.fontSize = L.fit(String(p.title || "OFFICIAL NOTICE").toUpperCase(), 700, 30, 18, pw - m * 2 - 90, 1, "Georgia, serif") + "px";
      if (p.ref) place(div("rf", paper, p.ref), m + 86, 98);
      place(div("rl", paper), m, 138, pw - 2 * m);
      var y = 172;
      var lines = (p.lines || []).slice(0, 6);
      lines.forEach(function (ln) {
        place(div("ln", paper, ln), m, y, pw - 2 * m);
        y += 38;
      });
      // typeset grey text bars fill the rest of the page (deterministic widths)
      var widths = [0.92, 0.86, 0.95, 0.74, 0.9, 0.82, 0.6, 0.88, 0.93, 0.7];
      for (var k = 0; y < h - 150 && k < 10; k++) {
        place(div("gb", paper), m, y + 8, (pw - 2 * m) * widths[k]);
        y += 30;
      }
      var sig = svg("svg", { width: 260, height: 80, style: "position:absolute;left:" + (pw - m - 260) + "px;top:" + (h - 128) + "px;overflow:visible;" }, paper);
      var sp = svg("path", { d: "M8 52c18-30 30-42 38-34s-14 40-2 38 26-44 40-40-8 36 6 34 18-24 30-22 4 18 16 16 22-14 40-12 30 6 70 2", fill: "none", stroke: "#233a66", "stroke-width": 3, "stroke-linecap": "round", "stroke-linejoin": "round", pathLength: 1, "stroke-dasharray": "1 1", "stroke-dashoffset": 1 }, sig);
      if (p.date) place(div("rf", paper, p.date), m, h - 82);
      var col = tone(p.tone || "red");
      var stp = div("stp", el);
      // the stamp prints over the document text on purpose
      stp.setAttribute("data-layout-allow-overlap", "1");
      Array.prototype.forEach.call(paper.querySelectorAll(".ln,.rf,.hd"), function (n) {
        n.setAttribute("data-layout-allow-overlap", "1");
      });
      stp.style.setProperty("--sc", col);
      div("in", stp);
      var word = String(p.stamp || "DEFAULT").toUpperCase();
      var ws = Math.min(130, Math.max(64, Math.floor((pw * 0.66) / Math.max(4, word.length * 0.72))));
      var sw = div("w", stp, word);
      sw.style.fontSize = ws + "px";
      if (p.sub) div("s", stp, String(p.sub).toUpperCase());
      var sW = L.measure(word, 900, ws) * 1.1 + 80;
      var sH = ws + (p.sub ? 50 : 0) + 34;
      place(stp, w / 2 - sW / 2, h * 0.56 - sH / 2, sW, sH);
      // ink grain: deterministic speckle mask (the stamp never prints perfectly)
      var mask = "radial-gradient(circle at 23% 31%,transparent 0 3px,#000 4px),radial-gradient(circle at 71% 64%,transparent 0 2px,#000 3px),radial-gradient(circle at 48% 82%,transparent 0 2.5px,#000 3.5px),repeating-linear-gradient(115deg,#000 0 7px,rgba(0,0,0,.72) 7px 9px)";
      stp.style.webkitMaskImage = mask;
      stp.style.maskImage = mask;
      stp.style.webkitMaskComposite = "source-in";
      stp.style.maskComposite = "intersect";
      var angle = p.angle === undefined ? -12 : Number(p.angle);
      c.entity("stamp", stp);
      hideAt0(c, stp);
      var stamped = false;
      function stamp(t) {
        if (stamped) return;
        stamped = true;
        c.tl.set(stp, { autoAlpha: 1, rotation: angle }, t);
        c.tl.fromTo(stp, { scale: 2.6, autoAlpha: 0 }, { scale: 1, autoAlpha: 0.93, duration: 0.16, ease: "power4.in", immediateRender: false }, t);
        // impact: the page jolts (deterministic keyframes) and settles
        c.tl.to(paper, { keyframes: [{ x: 6, y: 5, duration: 0.04 }, { x: -5, y: -3, duration: 0.04 }, { x: 3, y: 2, duration: 0.04 }, { x: 0, y: 0, duration: 0.06 }], ease: "none" }, t + 0.16);
        c.tl.to(stp, { keyframes: [{ x: 5, y: 4, duration: 0.04 }, { x: -4, y: -2, duration: 0.04 }, { x: 2, y: 1, duration: 0.04 }, { x: 0, y: 0, duration: 0.06 }], ease: "none" }, t + 0.16);
      }
      var entered = false;
      return {
        enter: function (t, recipe) {
          L.enterRecipe(c, el, t, recipe);
          if (entered) return;
          entered = true;
          c.tl.fromTo(sp, { attr: { "stroke-dashoffset": 1 } }, { attr: { "stroke-dashoffset": 0 }, duration: 0.8, ease: "power1.inOut", immediateRender: false }, t + 0.3);
          if (p.auto !== false) stamp(t + 1.0);
        },
        ops: {
          stamp: function (e) {
            stamp(e.t);
          },
        },
      };
    },
  };

  // =============================================================== flashBurst
  // props {items: [{slot, label?}] (4-10), per?: 0.2, kicker?, auto?: true}
  M.flashBurst = {
    enter: "none",
    build: function (el, p, c) {
      el.classList.add("l2-flash");
      var items = (p.items || []).slice(0, 10);
      if (items.length < 3) throw new Error("flashBurst: needs 3-10 items");
      var per = Math.max(0.12, Math.min(0.4, Number(p.per) || 0.2));
      var frames = items.map(function (it, i) {
        var fr = div("fr", el);
        if (it.src && !it.missing) {
          var img = document.createElement("img");
          img.src = it.kind === "video" ? it.poster || it.src : it.src;
          img.alt = "";
          if (Array.isArray(it.focal) && it.focal.length >= 4) img.style.objectPosition = ((Number(it.focal[0]) + Number(it.focal[2]) / 2) * 100).toFixed(1) + "% " + ((Number(it.focal[1]) + Number(it.focal[3]) / 2) * 100).toFixed(1) + "%";
          fr.appendChild(img);
        } else div("fb", fr, it.label || it.fallbackLabel || "");
        if (it.label) div("cp", fr, it.label);
        c.entity("f" + (i + 1), fr);
        hideAt0(c, fr);
        return fr;
      });
      var wf = div("wf", el);
      hideAt0(c, wf);
      var kk = null;
      if (p.kicker) {
        kk = div("kk", el, p.kicker);
        hideAt0(c, kk);
      }
      var fired = false;
      function burst(t) {
        if (fired) return;
        fired = true;
        frames.forEach(function (fr, i) {
          var ti = t + i * per;
          c.tl.set(fr, { autoAlpha: 1 }, ti);
          c.tl.fromTo(fr, { scale: 1.1 }, { scale: 1, duration: per + 0.1, ease: "power2.out", immediateRender: false }, ti);
          if (i < frames.length - 1) c.tl.set(fr, { autoAlpha: 0 }, ti + per);
          c.tl.fromTo(wf, { autoAlpha: 0.75 }, { autoAlpha: 0, duration: Math.min(0.1, per * 0.6), ease: "power1.out", immediateRender: false }, ti);
        });
        var last = frames[frames.length - 1];
        var tl2 = t + (frames.length - 1) * per;
        c.tl.to(last, { scale: 1.06, duration: 2.5, ease: "none" }, tl2 + per + 0.1);
        if (kk) {
          c.tl.set(kk, { autoAlpha: 1 }, tl2 + 0.15);
          c.tl.fromTo(kk, { scale: 1.5, xPercent: -50, yPercent: -50 }, { scale: 1, xPercent: -50, yPercent: -50, duration: 0.18, ease: "power4.in", immediateRender: false }, tl2 + 0.15);
          c.tl.set(kk, { xPercent: -50, yPercent: -50 }, 0);
        }
      }
      var entered = false;
      return {
        enter: function (t) {
          c.tl.set(el, { autoAlpha: 1 }, t);
          if (entered) return;
          entered = true;
          if (p.auto !== false) burst(t);
        },
        ops: {
          burst: function (e) {
            burst(e.t);
          },
        },
      };
    },
  };
})(typeof window !== "undefined" ? window : globalThis);
