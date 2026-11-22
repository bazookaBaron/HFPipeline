/*
 * BP profile ("light blueprint", ref R6, analysis/pacing-audit-20260924/design/R6/AUDIT.md) --
 * colours, plate, card anatomy and the persistent chrome. Mechanics and measurements only.
 *   plate  #EDF1F3 + static 1.5 px line grid: minor every 40 px (#EAEEF0), major every 200 px
 *          (#E3E8EA), centred on x = 540 (majors at 139.5 / 339 / 540 / 739.5 / 939)      [§1, §C19]
 *   cards  white, 1.5 px #DBDFE1, r 12, soft shadow (~20 px below, ~6 % black), pad 24      [§C13]
 *   bpHeader  994x55 @ (44,236): brand block 265.5 w #111923 (4-square icon + heavy caps),
 *          chapter "NN TITLE" mono caps #4A4F55 centred, users segment right (divider 1.5 px,
 *          user icon + mono bold #1F4DBD, grey #5A6269 at 0, USERS micro caps); the segment
 *          grows left as the number widens. Count-up power2.out, compact K/M format        [§5.1]
 *   tracker   <=9 chips, h 37.5, gap 9, centred on x 540 @ y 303: ghost dashed #C5C9CB, hollow
 *          dot, #64686C -> lit white, solid, dot #7643FF, #2C3030, 8 f pop (1.05 -> 1)     [§5.2]
 *   noteCard  225x151.5 @ (60,384): 6 px kind bar, eyebrow icon + caps in the kind colour,
 *          Inter 600 body <= 3 lines; swap = 1-f text swap + 1.02 pulse over 6 f           [§5.3]
 * Everything is a tl.set / finite tween at an explicit time (seek-safe).
 */
(function (global) {
  "use strict";
  var HF = (global.HFStage = global.HFStage || { modules: {} });
  var M = HF.modules;
  var F = 1 / 30;
  HF.themes = HF.themes || {};

  // ---- theme: every DH colour -> BP. Built from the LC map (same light semantics), with the
  // warm LC values swapped for the measured R6 cool values ----
  var SWAP = {
    "#fefcf8": "#ffffff", "#f1f2ec": "#f5f7f8", "#e5e3df": "#e3e7e9", "#c6cbc7": "#dbdfe1", "#b9bebd": "#c5c9cb",
    "#17232b": "#141920", "#474c4d": "#565a60", "#626667": "#64686c", "#1766da": "#1f4dbd", "#6d4ea5": "#7643ff",
    "#187a5b": "#1d7a4f", "#b23a3f": "#ae2435", "#855412": "#a15c00", "#b14b30": "#c2521c", "#a33a63": "#b0306a",
    "#ddf2e7": "#e0f3e6", "#e5eef9": "#e3ebf9", "#fae4da": "#fbe6e6", "#eae6f2": "#efeafb", "#f7f1e7": "#fcf3e3",
    "#a9d3bc": "#a7d5b6", "#b9cdeb": "#b3c6ee", "#e3b1a0": "#eeb4b9", "#dcc7a0": "#e6c98f",
  };
  var BP = {};
  var LC = HF.themes.LC || {};
  Object.keys(LC).forEach(function (k) {
    var v = String(LC[k]).toLowerCase();
    BP[k] = SWAP[v] || v;
  });
  // panels / surfaces are white cards in R6 (LC keeps them sunken ivory)
  BP["090d11"] = "#ffffff";
  BP["060c0e"] = "#ffffff";
  BP["07080b"] = "#ffffff";
  BP["0b0f14"] = "#f5f7f8";
  BP["10161e"] = "#f5f7f8";
  HF.themes.BP = BP;

  var CSS = [
    // plate + static line grid (major lines drawn over the minor ones)
    "html [data-profile=BP] .st-bg{background-color:#edf1f3;}",
    "html [data-profile=BP] .st-bg::before{background-image:linear-gradient(90deg,#e3e8ea 1.5px,transparent 1.5px),linear-gradient(#e3e8ea 1.5px,transparent 1.5px),linear-gradient(90deg,#e9edef 1.5px,transparent 1.5px),linear-gradient(#e9edef 1.5px,transparent 1.5px);",
    "background-size:200px 200px,200px 200px,40px 40px,40px 40px;background-position:139.25px 159.25px,139.25px 159.25px,19.25px 19.25px,19.25px 19.25px;-webkit-mask-image:none;mask-image:none;}",
    // card anatomy for the shared cards
    "html [data-profile=BP] .st-gpanel,html [data-profile=BP] .st-kpi,html [data-profile=BP] .st-code,html [data-profile=BP] .st-win,html [data-profile=BP] .st-compare .cmp,html [data-profile=BP] .st-tree .tr-box,html [data-profile=BP] .st-letters .lt,html [data-profile=BP] .st-panel,html [data-profile=BP] .st-node .n-tile,html [data-profile=BP] .st-layers .ly{border-radius:12px;box-shadow:0 8px 20px rgba(24,34,44,.06);}",
    "html [data-profile=BP] .st-gpanel{background:#fff;border-color:#dbdfe1;}",
    "html [data-profile=BP] .st-gpanel .g-hd{height:54px;}html [data-profile=BP] .st-gpanel .g-title{font-family:var(--st-mono);font-size:17px;letter-spacing:.1em;color:#4a4f55;}",
    "html [data-profile=BP] .st-code .c-bar{background:#f5f7f8;border-bottom:1.5px solid #dbdfe1;}html [data-profile=BP] .st-code .c-dot{background:#c5c9cb !important;}",
    "html [data-profile=BP] .st-row{border-radius:9px;}",
    "html [data-profile=BP] .st-pill{font-family:var(--st-mono);letter-spacing:.06em;border-radius:9px;}",
    "html [data-profile=BP] .st-headline .hl{letter-spacing:-.02em;}",
    "html [data-profile=BP] .st-node:not([data-lit]){opacity:.5;}",
    // channel endcard / promo on the light plate
    "html [data-profile=BP] .st-endcard .e-tag{background:#fff;border-color:#dbdfe1;color:#141920;}",
    "html [data-profile=BP] .st-endcard .e-site{background:#fff;border-color:#dbdfe1;box-shadow:0 8px 20px rgba(24,34,44,.08);}",
    "html [data-profile=BP] .st-endcard .e-url{background:#f1f4f5;}html [data-profile=BP] .st-endcard .e-txt{color:#141920;}",
    "html [data-profile=BP] .st-endcard .e-hl{color:#141920;}html [data-profile=BP] .st-endcard .e-hl.acc{color:#7643ff;}",
    "html [data-profile=BP] .st-media{border-color:#dbdfe1;border-radius:12px;box-shadow:0 8px 20px rgba(24,34,44,.08);}",
    "html [data-profile=BP] .st-media .md-head{background:#fff;border-bottom-color:#dee0e0;color:#6b7075;}",
    // ---- chrome: segmented header ----
    "html .st-bphead{display:flex;background:#fff;border:1.5px solid #dbdfe1;border-radius:12px;box-shadow:0 6px 18px rgba(24,34,44,.08);overflow:hidden;}",
    "html .st-bphead .b{flex:none;width:265.5px;height:100%;background:#111923;color:#fff;display:flex;align-items:center;gap:12px;padding:0 18px;font-weight:800;letter-spacing:.01em;text-transform:uppercase;white-space:nowrap;overflow:hidden;}",
    "html .st-bphead .b svg{flex:none;}",
    "html .st-bphead .c{flex:1;min-width:0;display:flex;align-items:center;justify-content:center;font-family:var(--st-mono);font-size:20.5px;font-weight:500;letter-spacing:.08em;color:#4a4f55;text-transform:uppercase;white-space:nowrap;overflow:hidden;}",
    "html .st-bphead .u{flex:none;height:100%;display:flex;align-items:center;gap:9px;padding:0 20px 0 18px;border-left:1.5px solid #dbdfe1;color:#1f4dbd;}",
    "html .st-bphead .u .n{font-family:var(--st-mono);font-size:31px;font-weight:800;letter-spacing:-.01em;white-space:nowrap;}",
    "html .st-bphead .u .l{font-family:var(--st-mono);font-size:13.5px;font-weight:600;letter-spacing:.1em;color:#5f656c;text-transform:uppercase;white-space:nowrap;}",
    "html .st-bphead .u[data-z='1']{color:#5a6269;}",
    // ---- chrome: component tracker ----
    "html .st-tracker{display:flex;justify-content:center;align-items:center;gap:9px;}",
    "html .st-tracker .tk{flex:none;height:37.5px;border-radius:9px;border:1.5px dashed #c5c9cb;display:flex;align-items:center;gap:8px;padding:0 12px;font-family:var(--st-mono);font-weight:600;letter-spacing:.05em;color:#64686c;text-transform:uppercase;white-space:nowrap;}",
    "html .st-tracker .tk .d{width:8px;height:8px;border-radius:50%;border:1.5px solid #aeb3b8;flex:none;box-sizing:border-box;}",
    "html .st-tracker .tk[data-lit='1']{background:#fff;border-style:solid;border-color:#dbdfe1;color:#2c3030;box-shadow:0 2px 6px rgba(24,34,44,.06);}",
    "html .st-tracker .tk[data-lit='1'] .d{background:#7643ff;border-color:#7643ff;}",
    // ---- chrome: note card ----
    "html .st-bpnote{background:#fff;border:1.5px solid #b9bdc3;border-radius:12px;overflow:hidden;box-shadow:0 6px 16px rgba(24,34,44,.07);--k:#5a6068;--kt:#4a4f55;}",
    "html .st-bpnote[data-kind=problem]{--k:#e2464b;--kt:#ae2435;}html .st-bpnote[data-kind=fix]{--k:#7643ff;--kt:#5b32d6;}",
    "html .st-bpnote[data-kind=goal]{--k:#1f4dbd;--kt:#1f4dbd;}html .st-bpnote[data-kind=cost]{--k:#e2464b;--kt:#ae2435;}",
    "html .st-bpnote .bar{position:absolute;left:0;top:0;bottom:0;width:6px;background:var(--k);}",
    "html .st-bpnote .eye{position:absolute;left:22px;top:17px;display:flex;align-items:center;gap:7px;font-family:var(--st-mono);font-size:16px;font-weight:700;letter-spacing:.1em;color:var(--kt);text-transform:uppercase;white-space:nowrap;}",
    "html .st-bpnote .eye svg{display:none;flex:none;}",
    "html .st-bpnote[data-kind=rule] .eye .i-rule,html .st-bpnote[data-kind=problem] .eye .i-problem,html .st-bpnote[data-kind=fix] .eye .i-fix,html .st-bpnote[data-kind=goal] .eye .i-goal,html .st-bpnote[data-kind=cost] .eye .i-cost{display:block;}",
    "html .st-bpnote .tx{position:absolute;left:22px;right:12px;top:50px;font-weight:600;line-height:1.2;color:#111418;overflow:hidden;}",
  ].join("\n");
  (function () {
    if (document.getElementById("st-bp-style")) return;
    var st = document.createElement("style");
    st.id = "st-bp-style";
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

  // small original line glyphs for the BP chrome (24 px viewBox, stroke = currentColor)
  var GLYPH = {
    grid4: '<rect x="3" y="3" width="7.5" height="7.5" rx="1.5"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5"/>',
    rule: '<path d="M3.5 16.5 16.5 3.5l4 4-13 13z"/><path d="M8 12l2 2M11 9l2 2M14 6l2 2"/>',
    problem: '<path d="M12 3.5 21.5 20h-19z"/><path d="M12 10v4.5M12 17.2v.3"/>',
    fix: '<path d="M14.5 5.5a4.5 4.5 0 0 0 5.6 5.6l-9 9a2.1 2.1 0 0 1-3-3l9-9a4.5 4.5 0 0 1-2.6-2.6z"/><path d="M17 3l4 4"/>',
    goal: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.2"/>',
    cost: '<path d="M12 4v16M6 7h12M8 20h8"/><path d="M3 14l3-6.5 3 6.5a3 3 0 0 1-6 0zM15 14l3-6.5 3 6.5a3 3 0 0 1-6 0z"/>',
    users: '<path d="M16 20v-1.5a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4V20"/><circle cx="9.5" cy="7.5" r="3.8"/><path d="M21 20v-1.5a4 4 0 0 0-3-3.8M16 3.8a3.8 3.8 0 0 1 0 7.4"/>',
  };
  function glyph(name, size, cls) {
    var s = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    s.setAttribute("viewBox", "0 0 24 24");
    s.setAttribute("width", size);
    s.setAttribute("height", size);
    s.setAttribute("fill", "none");
    s.setAttribute("stroke", "currentColor");
    s.setAttribute("stroke-width", "2");
    s.setAttribute("stroke-linecap", "round");
    s.setAttribute("stroke-linejoin", "round");
    if (cls) s.setAttribute("class", cls);
    s.innerHTML = GLYPH[name] || "";
    return s;
  }
  HF.bpGlyph = glyph;

  function measure(text, weight, size, family) {
    if (global.HFTextFit) return global.HFTextFit.measure(String(text), weight, size, family || "Inter, ui-sans-serif, system-ui, sans-serif");
    return String(text).length * size * 0.62;
  }
  var MONO = "'JetBrains Mono', ui-monospace, monospace";

  /** compact users format (R6 E12): 0, 1, 606, 1,000, 22K, 192K, 250K, 1M, 1.9M, 5M, 8.4M, 20M, 50M */
  function compact(v) {
    v = Math.max(0, v);
    var unit = function (x, u) {
      return (x < 10 ? String(Math.round(x * 10) / 10) : String(Math.round(x))) + u;
    };
    if (v >= 1e9) return unit(v / 1e9, "B");
    if (v >= 1e6) return unit(v / 1e6, "M");
    if (v >= 1e4) return unit(v / 1e3, "K");
    return String(Math.round(v)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }
  HF.bpCompact = compact;

  // =============== bpHeader (N1) ===============
  // props {brand, chapter: {n, title} | "NN TITLE", users?: number, label?: "USERS"}
  // ops   chapter {n, title} (1-f swap), users {to, dur?} (count-up power2.out, compact format)
  M.bpHeader = {
    layer: "chrome",
    enter: "none",
    build: function (el, p, c) {
      el.classList.add("st-bphead");
      var b = div("b", el);
      b.appendChild(glyph("grid4", 22));
      var brand = String(p.brand || "SYSTEM DESIGN").toUpperCase();
      var bt = c.entity("brand", div("", b, brand));
      var bs = 23;
      while (bs > 15 && measure(brand, 800, bs) > 265.5 - 36 - 22 - 12) bs -= 1;
      bt.style.fontSize = bs + "px";
      function chapText(v) {
        if (!v) return "";
        if (typeof v === "string") return v.toUpperCase();
        return (v.n !== undefined ? String(v.n).padStart(2, "0") + " " : "") + String(v.title || "").toUpperCase();
      }
      var ch = c.entity("chapter", div("c", el, chapText(p.chapter)));
      var u = div("u", el);
      u.appendChild(glyph("users", 26));
      var cur = Number(p.users) || 0;
      var n = c.entity("users", div("n", u, compact(cur)));
      div("l", u, p.label || "USERS");
      u.setAttribute("data-z", cur > 0 ? "0" : "1");
      return {
        ops: {
          chapter: function (e) {
            c.tl.set(ch, { textContent: chapText(e.value) }, e.t);
          },
          // R6 E11/E12: 0 -> 1,000 in 17 f ... -> 1M in 29 f; 1.2 s power2.out for the big jumps
          users: function (e) {
            var to = Number(e.value && e.value.to);
            if (!isFinite(to)) throw new Error("bpHeader users: value.to must be a number");
            var from = e.value.from !== undefined ? Number(e.value.from) : cur;
            var dur = e.value.dur || (to <= 2000 ? 0.567 : 1.2);
            var o = { v: from };
            c.tl.set(n, { textContent: compact(from) }, e.t);
            c.tl.set(u, { attr: { "data-z": to > 0 ? "0" : "1" } }, e.t);
            c.tl.to(o, { v: to, duration: dur, ease: "power2.out", immediateRender: false, onUpdate: function () { n.textContent = compact(o.v); } }, e.t);
            c.tl.set(n, { textContent: compact(to) }, e.t + dur);
            cur = to;
          },
        },
      };
    },
  };
  // =============== tracker (N2) ===============
  // props {items: [string] (<= 9), lit?: [names already lit]}
  // ops   light {chip: name | 1-based index}
  M.tracker = {
    layer: "chrome",
    enter: "none",
    build: function (el, p, c) {
      el.classList.add("st-tracker");
      var items = (p.items || []).slice(0, 9).map(function (s) {
        return String(s).toUpperCase();
      });
      // one font size for the row so all chips fit the bar (R6: 9 chips span 927 px)
      var W = parseFloat(el.style.width) || 994;
      var fs = 14.5;
      var rowW = function (f) {
        return items.reduce(function (a, s) {
          return a + measure(s, 600, f, MONO) * 1.05 + 24 + 8 + 8 + 3;
        }, 0) + 9 * Math.max(0, items.length - 1);
      };
      while (fs > 10 && rowW(fs) > W - 8) fs -= 0.5;
      var litAt0 = (p.lit || []).map(function (s) {
        return String(s).toUpperCase();
      });
      var chips = items.map(function (s, i) {
        var tk = div("tk", el);
        tk.style.fontSize = fs + "px";
        div("d", tk);
        div("", tk, s);
        if (litAt0.indexOf(s) >= 0) tk.setAttribute("data-lit", "1");
        c.entity("c" + (i + 1), tk);
        return tk;
      });
      function find(v) {
        var k = typeof v === "number" ? v - 1 : items.indexOf(String(v || "").toUpperCase());
        if (!chips[k]) throw new Error("tracker has no chip " + v + " (have " + items.join(", ") + ")");
        return chips[k];
      }
      return {
        ops: {
          // R6 E19: 7-9 f -- dashed -> solid white + purple dot with a small pop; never un-lights
          light: function (e) {
            var tk = find(e.value && (e.value.chip !== undefined ? e.value.chip : e.value.i));
            c.tl.set(tk, { attr: { "data-lit": "1" } }, e.t);
            c.tl.fromTo(tk, { scale: 1.08 }, { scale: 1, duration: 8 * F, ease: "power2.out", immediateRender: false }, e.t);
          },
        },
      };
    },
  };

  // =============== noteCard (N3) ===============
  // props {kind: rule|problem|fix|goal|cost, text (<= ~34 chars)}
  // ops   note {kind, text}
  var KINDS = ["rule", "problem", "fix", "goal", "cost"];
  M.noteCard = {
    layer: "chrome",
    enter: "none",
    build: function (el, p, c) {
      el.classList.add("st-bpnote");
      div("bar", el);
      var eye = div("eye", el);
      KINDS.forEach(function (k) {
        eye.appendChild(glyph(k === "problem" ? "problem" : k, 17, "i-" + k));
      });
      var eyeT = div("", eye, "");
      var tx = c.entity("text", div("tx", el, ""));
      var W = (parseFloat(el.style.width) || 225) - 34;
      var H = (parseFloat(el.style.height) || 151.5) - 58;
      // fit <= 3 lines: greedy word wrap at the candidate size
      function size(text) {
        for (var fs = 24; fs >= 16; fs -= 1) {
          var lines = 1;
          var line = "";
          String(text).split(/\s+/).forEach(function (w) {
            var t = line ? line + " " + w : w;
            if (measure(t, 600, fs) > W && line) {
              lines += 1;
              line = w;
            } else line = t;
          });
          if (lines * fs * 1.2 <= H + 1) return fs;
        }
        return 16;
      }
      function kind(k) {
        k = String(k || "rule").toLowerCase();
        return KINDS.indexOf(k) >= 0 ? k : "rule";
      }
      var k0 = kind(p.kind);
      el.setAttribute("data-kind", k0);
      eyeT.textContent = k0.toUpperCase();
      tx.textContent = p.text || "";
      tx.style.fontSize = size(p.text || "") + "px";
      return {
        ops: {
          // R6 E17: 1-f content swap + 1.02 pulse over 6 f
          note: function (e) {
            var v = e.value || {};
            var k = kind(v.kind);
            c.tl.set(el, { attr: { "data-kind": k } }, e.t);
            c.tl.set(eyeT, { textContent: k.toUpperCase() }, e.t);
            c.tl.set(tx, { textContent: String(v.text || ""), fontSize: size(v.text || "") + "px" }, e.t);
            c.tl.fromTo(el, { scale: 1 }, { scale: 1.02, duration: 2 * F, ease: "power2.out", immediateRender: false }, e.t);
            c.tl.to(el, { scale: 1, duration: 4 * F, ease: "power2.out" }, e.t + 2 * F);
          },
        },
      };
    },
  };
})(typeof window !== "undefined" ? window : globalThis);
