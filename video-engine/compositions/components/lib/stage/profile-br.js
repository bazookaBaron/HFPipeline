/*
 * BR profile (light brutalist product explainer, ref R7 -- analysis/pacing-audit-20260924/design/R7/AUDIT.md
 * §2, §4 B/C, §5.1-5.2). Theme, window-card skin, crop marks and chrome. Mechanics only: no R7
 * assets, characters or logos.
 *
 *   plate      #F1F1EA flat + 3 px #E1E1DA dots @ 40 px, full frame, static                    [§11, #19]
 *   crop marks four 1.5 px #A0A099 L-brackets, 16.5 px arms, x 25.5 / 1053, y 169.5 / 1366.5     [#1]
 *   window     1.5 px #121212 border, radius 0, black 39 px title bar (hollow square glyph + mono
 *              label + 3-line grip), body #FDFDFD, hard shadow +7.5/+7.5 #CCCAC4, no blur       [#13]
 *   brHeader   40.5-1039.5 x 235.5-292.5, 3 px #161611, fill #FDFDFD, shadow +4.5/+4.5 #C4C4BD;
 *              brand block #1B1D1D + magenta dot; mono caps title cell; DECISIONS counter cell
 *              (magenta zero-padded digits): tick = 1-f swap + 1.29x punch over 7 f, right-anchored;
 *              countUp = expo.out, thousands separators, the cell grows leftwards        [§5.1, E7, E14]
 *   tabChips   h 39, gap 12, centred; done / active / future states, 1-f switches          [§5.2]
 * Colour roles: magenta #981878 / #CC60AC = the decider (brand), blue #2044B0 = generator / LLM,
 * red #D04444 = cost / danger, yellow = highlighter, green = success.
 */
(function (global) {
  "use strict";
  var HF = (global.HFStage = global.HFStage || { modules: {} });
  var M = HF.modules;
  var F = 1 / 30;

  // ---- theme: every existing card reads --x-<darkhex> vars; BR = the LC light map re-toned ----
  HF.themes = HF.themes || {};
  var LC2BR = {
    "#fefcf8": "#fdfdfd", "#f1f2ec": "#f7f5f1", "#e5e3df": "#ecebe5", "#c6cbc7": "#cbc9c7", "#b9bebd": "#b5b5a8",
    "#17232b": "#1b1d1d", "#474c4d": "#42474e", "#626667": "#6e6e6a",
    "#1766da": "#2044b0", "#e5eef9": "#e8edf9", "#b9cdeb": "#b4c3ea",
    "#187a5b": "#2a8a4a", "#ddf2e7": "#dff2e2", "#a9d3bc": "#a8d5b0",
    "#b23a3f": "#d04444", "#fae4da": "#fbe4e2", "#e3b1a0": "#eab0ab",
    "#6d4ea5": "#981878", "#eae6f2": "#f9edf5", "#c6b9dd": "#e3b3d5",
    "#a33a63": "#cc60ac", "#f6e3ea": "#f9edf5", "#ddb3c3": "#e3b3d5",
    "#b14b30": "#b03030", "#855412": "#9a6414", "#1f6f8b": "#1f6f8b",
  };
  var lc = HF.themes.LC || {};
  var br = {};
  Object.keys(lc).forEach(function (k) {
    var v = String(lc[k]).toLowerCase();
    br[k] = LC2BR[v] || v;
  });
  br["000000"] = "#fdfdfd"; // card body
  br["141414"] = "#e1e1da"; // plate dots (DH token)
  HF.themes.BR = br;

  var INK = "#1b1d1d";
  var MAG = "#981878";
  var MAGUI = "#cc60ac";

  var WIN = "border:1.5px solid #121212;border-radius:0;box-shadow:7.5px 7.5px 0 #cccac4;";
  var P = "html [data-profile=BR] ";
  var CSS = [
    // plate + crop marks
    P + ".st-bg{background-color:#f1f1ea;}",
    P + ".st-bg::before{background-image:radial-gradient(circle,#e1e1da 0,#e1e1da 1.5px,transparent 1.75px);background-size:40px 40px;background-position:0 0;-webkit-mask-image:none;mask-image:none;}",
    P + ".st-bg::after{content:'';position:absolute;left:25.5px;top:169.5px;width:1029px;height:1198.5px;background:" +
      ["left top", "right top", "left bottom", "right bottom"]
        .map(function (pos) {
          return "linear-gradient(#a0a099,#a0a099) " + pos + "/16.5px 1.5px no-repeat,linear-gradient(#a0a099,#a0a099) " + pos + "/1.5px 16.5px no-repeat";
        })
        .join(",") +
      ";}",
    // brutalist window skin on the shared cards
    P + ".st-gpanel," + P + ".st-kpi," + P + ".st-win," + P + ".st-compare .cmp," + P + ".st-tree .tr-box," + P + ".st-letters .lt," + P + ".st-banner," + P + ".st-stat{" + WIN + "background:#fdfdfd;}",
    P + ".st-gpanel[data-tone]{background:var(--p-fill);}",
    P + ".st-gpanel .g-hd{background:#1c1e1e;height:39px;border-bottom:0;padding:0 14px;gap:12px;}",
    P + ".st-gpanel .g-hd::before{content:'';width:12px;height:12px;border:1.5px solid #f1f1ea;flex:none;box-sizing:border-box;}",
    P + ".st-gpanel .g-hd::after{content:'';width:27px;height:7.5px;margin-left:14px;background:repeating-linear-gradient(#cfcfc8 0 1.5px,transparent 1.5px 3px);flex:none;}",
    P + ".st-gpanel .g-tile{display:none;}",
    P + ".st-gpanel .g-title{font-family:var(--st-mono);font-size:17px;font-weight:500;letter-spacing:.01em;text-transform:none;color:#f4f4ee;flex:1;min-width:0;overflow:hidden;}",
    P + ".st-gpanel .g-meta{color:#cfcfc8;}",
    P + ".st-row{border-radius:0;}",
    P + ".st-row[data-tone]{border-width:1.5px;}",
    P + ".st-kpi .k-bar,.st-kpi .k-fill{border-radius:0;}",
    P + ".st-table{background:#fdfdfd;" + WIN + "}",
    // code -> dark terminal body (R7 S20)
    P + ".st-code{" + WIN + "background:#1c1e1e;}",
    P + ".st-code .c-bar{background:#1c1e1e;border-bottom:1.5px solid #34373a;height:39px;}",
    P + ".st-code .c-dot{display:none;}",
    P + ".st-code .c-name{margin-left:0;color:#f4f4ee;font-size:17px;}",
    P + ".st-code .c-ln{color:#e6e6e6;}" + P + ".st-code .c-ln .pr{color:#e06cc0;}" + P + ".st-code .c-ln .cm{color:#9a9a94;}",
    P + ".st-code .c-cur{background:#f4f4ee;}",
    P + ".st-win .w-bar{background:#1c1e1e;height:39px;}" + P + ".st-win .w-dot{display:none;}" + P + ".st-win .w-body{top:39px;}",
    P + ".st-win .w-url{background:#2a2c2e;color:#f4f4ee;border-radius:0;}",
    // media window (R7 §5.6: square corners, black title bar, hard shadow)
    P + ".st-media{" + WIN + "background:#1c1e1e;}",
    P + ".st-media .md-head{background:#1c1e1e;border-bottom:1.5px solid #121212;color:#f4f4ee;font-size:17px;font-weight:500;letter-spacing:.01em;text-transform:none;}",
    P + ".st-media .md-head::before{content:'';width:12px;height:12px;border:1.5px solid #f1f1ea;flex:none;box-sizing:border-box;}",
    P + ".st-media .md-hl{border:3px solid " + MAGUI + ";border-radius:0;}",
    // pills / notes / steps / micro in BR clothing
    P + ".st-pill{border-radius:0;}",
    P + ".st-note{border-radius:0;}",
    P + ".st-micro{font-family:var(--st-mono);}",
    // generic emphasis ring (highlight op) + endcard in BR clothing
    P + ".st-mod[data-hl='1']{outline:3px solid " + MAGUI + ";outline-offset:5px;}",
    P + ".st-endcard .e-site{border:1.5px solid #121212;border-radius:0;box-shadow:7.5px 7.5px 0 #cccac4;background:#fdfdfd;}",
    P + ".st-endcard .e-url{border-radius:0;background:#f1f1ea;}" + P + ".st-endcard .e-txt{color:" + INK + ";}",
    P + ".st-endcard .e-btn," + P + ".st-endcard .e-go{border-radius:0;background:" + MAG + ";box-shadow:6px 6px 0 #cccac4;}",
    P + ".st-endcard .e-tag{border-radius:0;background:#fdfdfd;border-color:#121212;color:" + INK + ";}",
    P + ".st-endcard .e-hl{color:" + INK + ";}" + P + ".st-endcard .e-hl.acc{color:" + MAG + ";}",
    // chrome: brand header
    "html .st-brhead{display:flex;align-items:stretch;background:#fdfdfd;border:3px solid #161611;box-shadow:4.5px 4.5px 0 #c4c4bd;}",
    "html .st-brhead .bh-brand{flex:none;min-width:105px;padding:0 18px;background:" + INK + ";display:flex;align-items:center;gap:10px;font-family:var(--st-sans);font-weight:800;font-size:27px;letter-spacing:-.01em;color:#fdfdfd;white-space:nowrap;}",
    "html .st-brhead .bh-dot{width:15px;height:15px;border-radius:50%;background:#cf5bb6;flex:none;}",
    "html .st-brhead .bh-title{flex:1;min-width:0;display:flex;align-items:center;justify-content:center;font-family:var(--st-mono);font-size:21px;font-weight:500;letter-spacing:.15em;text-transform:uppercase;color:" + INK + ";white-space:nowrap;overflow:hidden;}",
    "html .st-brhead .bh-cnt{flex:none;min-width:216px;border-left:3px solid #161611;display:flex;align-items:center;justify-content:flex-end;gap:16px;padding:0 21px 0 18px;white-space:nowrap;}",
    "html .st-brhead .bh-lab{font-family:var(--st-mono);font-size:16.5px;letter-spacing:.1em;color:#6e6e6a;text-transform:uppercase;}",
    "html .st-brhead .bh-val{font-family:var(--st-mono);font-size:25px;font-weight:500;letter-spacing:.06em;color:#9a5585;display:inline-block;transform-origin:100% 50%;font-variant-numeric:tabular-nums;}",
    // chrome: tab chips (3 states)
    "html .st-tabChips{display:flex;justify-content:center;gap:12px;}",
    "html .st-tabChips .tc{height:39px;display:flex;align-items:center;gap:9px;padding:0 15px;border:1.5px solid #c8c8c0;background:transparent;font-family:var(--st-mono);font-size:18px;letter-spacing:.12em;text-transform:uppercase;color:#a0a099;white-space:nowrap;}",
    "html .st-tabChips .tc i{width:9px;height:9px;border-radius:50%;border:1.5px solid #a0a099;box-sizing:border-box;flex:none;}",
    "html .st-tabChips .tc[data-s=done]{border-color:" + MAGUI + ";color:" + MAG + ";}html .st-tabChips .tc[data-s=done] i{background:" + MAGUI + ";border-color:" + MAGUI + ";}",
    "html .st-tabChips .tc[data-s=now]{border-color:#121212;background:#fdfdfd;color:" + INK + ";}html .st-tabChips .tc[data-s=now] i{background:" + MAGUI + ";border-color:" + MAGUI + ";}",
  ].join("\n");
  (function () {
    if (document.getElementById("st-br-style")) return;
    var st = document.createElement("style");
    st.id = "st-br-style";
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

  function pad(n, k) {
    var s = String(Math.max(0, Math.round(n)));
    while (s.length < k) s = "0" + s;
    return "⁠" + s; // word joiner: keeps GSAP from parsing "0006" as the number 6
  }
  function group(n) {
    return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }

  // ---- brHeader: brand block + chapter title + running counter (R7 §5.1) ----
  // props {brand, title, label?: "DECISIONS", value?: 0, pad?: 4}
  // ops   title {text} (1 f), tick {by?|to?} (1-f swap + punch 1.0->1.29->1.0 over 7 f),
  //       countUp {to, dur?: 0.667, ease?: "expo.out"}
  M.brHeader = {
    layer: "chrome",
    enter: "none",
    build: function (el, p, c) {
      el.classList.add("st-brhead");
      var b = div("bh-brand", el);
      div("bh-dot", b);
      div("", b, p.brand || "");
      var title = c.entity("title", div("bh-title", el, p.title || ""));
      var cell = div("bh-cnt", el);
      div("bh-lab", cell, p.label === undefined ? "DECISIONS" : p.label);
      var k = p.pad || 4;
      var cur = Number(p.value) || 0;
      var val = c.entity("value", div("bh-val", cell, pad(cur, k)));
      function punch(t) {
        // E7: digit h 14,16,18,18,18,16,14 native -- up over 2 f ease-out, hold 3 f, down 2 f
        c.tl.to(val, { scale: 1.29, duration: 2 * F, ease: "power2.out" }, t);
        c.tl.to(val, { scale: 1, duration: 2 * F, ease: "power2.in" }, t + 5 * F);
      }
      return {
        ops: {
          title: function (e) {
            c.tl.set(title, { textContent: String((e.value && e.value.text) || "") }, e.t);
          },
          tick: function (e) {
            var v = e.value || {};
            cur = v.to !== undefined ? Number(v.to) : cur + (v.by !== undefined ? Number(v.by) : 1);
            c.tl.set(val, { textContent: pad(cur, k) }, e.t);
            punch(e.t);
          },
          countUp: function (e) {
            var v = e.value || {};
            var from = cur;
            var to = Number(v.to) || cur;
            var proxy = { v: from };
            c.tl.set(val, { textContent: group(from) }, e.t);
            c.tl.to(
              proxy,
              {
                v: to,
                duration: v.dur || 0.667,
                ease: v.ease || "expo.out",
                immediateRender: false,
                onUpdate: function () {
                  val.textContent = group(proxy.v);
                },
              },
              e.t
            );
            cur = to;
          },
        },
      };
    },
  };

  // ---- tabChips: 3-state sub-step chips under the header (R7 §5.2) ----
  // props {items: [string], active: 1-based}; ops activate {step} (earlier steps become done)
  M.tabChips = {
    layer: "chrome",
    enter: "none",
    build: function (el, p, c) {
      el.classList.add("st-tabChips");
      var act = p.active || 1;
      var chips = (p.items || []).map(function (txt, i) {
        var ch = c.entity("t" + (i + 1), div("tc", el));
        ch.appendChild(document.createElement("i"));
        ch.appendChild(document.createTextNode(i + 1 + " · " + String(txt)));
        ch.setAttribute("data-s", i + 1 < act ? "done" : i + 1 === act ? "now" : "next");
        return ch;
      });
      return {
        ops: {
          activate: function (e) {
            var s = (e.value && (e.value.step || e.value.i)) || 1;
            chips.forEach(function (ch, j) {
              c.tl.set(ch, { attr: { "data-s": j + 1 < s ? "done" : j + 1 === s ? "now" : "next" } }, e.t);
            });
          },
        },
      };
    },
  };
})(typeof window !== "undefined" ? window : globalThis);
