/*
 * LF profile ("long-form editorial", 16:9 finance deep-dives; analysis/plans/LONGFORM-16x9-PLAN.md Â§3).
 * Same design family as the LC / BP shorts, re-scaled for a 1920x1080 landscape frame:
 *   plate   #F7F6F1 paper + static 3 px dots (#E6E4DC, pitch 40, centred) -- always light
 *   grid    12 columns, 96 px margins, 24 px gutter (col 122, pitch 146); title-safe 96 / 54;
 *           nothing critical in the bottom 90 px (YouTube progress bar), end-screen zone clear
 *   type    Inter 800 heads (64-84, -0.025em), Inter body 28-34, JetBrains Mono micro 15-18
 *   cards   #FFFEFB, 1.5 px #DEDBD1, r 14, soft shadow; photo cards: 3 px paper border + shadow
 *   chrome  lfHeader (chapter kicker "CH 02 Â· TITLE", top-left), lfProgress (chapter segments,
 *           top-right), lfCredit (media credit line, bottom-left, only while fetched media shows)
 * Motion: the shorts' grammar, a little calmer (rise 12 px / 233 ms, fade 200 ms). Everything is a
 * tl.set / finite tween at an explicit time (seek-safe). No mascot in LF (the compiler never sends one).
 * Shared helpers for modules-lf.js / modules-chart.js live on HFStage.lf.
 */
(function (global) {
  "use strict";
  var HF = (global.HFStage = global.HFStage || { modules: {} });
  var M = HF.modules;
  var F = 1 / 30;
  HF.themes = HF.themes || {};

  // ---- tokens ----
  var T = {
    paper: "#f7f6f1",
    card: "#fffefb",
    line: "#dedbd1",
    rule: "#cfccc2",
    ink: "#16202a",
    ink2: "#3f4648",
    muted: "#62676a",
    blue: "#1d5ebd",
    red: "#b23a3f",
    green: "#187a5b",
    amber: "#9a6414",
    purple: "#6d4ea5",
    marker: "#fde587",
    hot: "#ffc93c", // highlight boxes drawn ON photos (needs to read over any picture)
  };
  var MONO = "'JetBrains Mono', ui-monospace, monospace";
  var SANS = "Inter, ui-sans-serif, system-ui, sans-serif";

  // shared DH/LC modules used inside LF read the LC light theme
  HF.themes.LF = Object.assign({}, HF.themes.LC || {});

  // palette for HF.tone()/HF.tint() (core reads HFStage.PALETTE[profile])
  if (HF.PALETTE) {
    HF.PALETTE.LF = {
      tone: { blue: T.blue, green: T.green, red: T.red, amber: T.amber, purple: T.purple, cyan: "#1f6f8b", orange: "#b14b30", pink: "#a33a63", white: T.ink, grey: T.muted, ink: T.ink, hot: T.hot },
      tint: { blue: ["#e5eef9", "#b9cdeb"], green: ["#ddf2e7", "#a9d3bc"], red: ["#fae4da", "#e3b1a0"], amber: ["#f7f1e7", "#dcc7a0"], purple: ["#eae6f2", "#c6b9dd"], cyan: ["#e0eef3", "#a8cbd8"], orange: ["#fae4da", "#e3b1a0"], pink: ["#f6e3ea", "#ddb3c3"], grey: ["#f1f0ea", "#d6d3c9"] },
    };
  }

  var P = "html [data-profile=LF] ";
  var CSS = [
    // plate + dots (centred on the frame: 1920/40 and 1080/40 leave 0 / 20 px -> offset 20)
    P + ".st-bg{background-color:" + T.paper + ";}",
    P + ".st-bg::before{background-image:radial-gradient(circle,#e6e4dc 0,#e6e4dc 1.5px,transparent 1.75px);background-size:40px 40px;background-position:0 0;-webkit-mask-image:none;mask-image:none;}",
    P + ".st-mod{font-family:" + SANS + ";color:" + T.ink + ";}",
    // ---- chrome ----
    P + ".lf-chip{display:inline-flex;align-items:center;gap:12px;height:40px;padding:0 14px 0 6px;border-radius:10px;background:rgba(247,246,241,.94);box-shadow:0 1px 0 rgba(22,32,42,.04);white-space:nowrap;}",
    P + ".lf-head .tag{height:28px;display:flex;align-items:center;padding:0 10px;border-radius:7px;background:" + T.ink + ";color:#fff;font-family:" + MONO + ";font-size:16px;font-weight:700;letter-spacing:.08em;}",
    P + ".lf-head .ttl{font-family:" + MONO + ";font-size:17px;font-weight:500;letter-spacing:.12em;color:" + T.ink2 + ";text-transform:uppercase;}",
    P + ".lf-prog{justify-content:flex-end;width:100%;}",
    P + ".lf-prog .lf-chip{gap:6px;padding:0 14px;margin-left:auto;}",
    P + ".lf-prog .n{font-family:" + MONO + ";font-size:15px;font-weight:700;letter-spacing:.06em;color:" + T.ink2 + ";margin-right:10px;}",
    P + ".lf-prog .sg{width:34px;height:5px;border-radius:3px;background:#d6d3c9;overflow:hidden;position:relative;}",
    P + ".lf-prog .sg .f{position:absolute;left:0;top:0;bottom:0;width:100%;background:" + T.ink + ";transform-origin:0 50%;}",
    P + ".lf-prog .sg[data-s=cur] .f{background:" + T.blue + ";}",
    P + ".lf-prog .sg[data-s=todo] .f{display:none;}",
    P + ".lf-credit{display:flex;align-items:flex-end;}",
    P + ".lf-credit .c{max-width:100%;padding:3px 9px;border-radius:5px;background:rgba(247,246,241,.95);font-family:" + MONO + ";font-size:15px;font-weight:500;line-height:20px;color:#2f3538;white-space:normal;}",
    // ---- shared card anatomy ----
    P + ".lf-card{background:" + T.card + ";border:1.5px solid " + T.line + ";border-radius:14px;box-shadow:0 10px 30px rgba(30,28,20,.07),0 1px 3px rgba(30,28,20,.05);}",
    P + ".lf-eyebrow{font-family:" + MONO + ";font-size:17px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:" + T.blue + ";white-space:nowrap;}",
    P + ".lf-micro{font-family:" + MONO + ";font-size:15px;font-weight:500;letter-spacing:.06em;color:" + T.muted + ";}",
    P + ".lf-mk{background-image:linear-gradient(" + T.marker + "," + T.marker + ");background-repeat:no-repeat;background-size:0% 86%;background-position:0 70%;-webkit-box-decoration-break:clone;box-decoration-break:clone;padding:0 .06em;margin:0 -.06em;}",
  ].join("\n");
  (function () {
    if (document.getElementById("st-lf-style")) return;
    var st = document.createElement("style");
    st.id = "st-lf-style";
    st.textContent = CSS;
    document.head.appendChild(st);
  })();

  // ---------------------------------------------------------------- helpers (HFStage.lf)
  function div(cls, parent, text) {
    var el = document.createElement("div");
    if (cls) el.className = cls;
    if (text !== undefined && text !== null) el.textContent = text;
    if (parent) parent.appendChild(el);
    return el;
  }
  var SVGNS = "http://www.w3.org/2000/svg";
  function svg(tag, attrs, parent) {
    var el = document.createElementNS(SVGNS, tag);
    Object.keys(attrs || {}).forEach(function (k) {
      el.setAttribute(k, attrs[k]);
    });
    if (parent) parent.appendChild(el);
    return el;
  }
  function measure(text, weight, size, family) {
    if (global.HFTextFit) return global.HFTextFit.measure(String(text), weight, size, family || SANS);
    return String(text).length * size * 0.58;
  }
  /** greedy word wrap -> number of lines at this size */
  function lineCount(text, weight, size, width, family) {
    var lines = 1;
    var line = "";
    String(text || "")
      .split(/\s+/)
      .filter(Boolean)
      .forEach(function (w) {
        var t = line ? line + " " + w : w;
        if (measure(t, weight, size, family) > width && line) {
          lines += 1;
          line = w;
        } else line = t;
      });
    return lines;
  }
  /** largest size in [min, max] (step 2) whose wrap fits maxLines at this width; also no word wider than width */
  function fit(text, weight, max, min, width, maxLines, family) {
    var words = String(text || "").split(/\s+/);
    for (var s = max; s > min; s -= 2) {
      var wide = words.some(function (w) {
        return measure(w, weight, s, family) > width;
      });
      if (!wide && lineCount(text, weight, s, width, family) <= maxLines) return s;
    }
    return min;
  }
  function W(el) {
    return parseFloat(el.style.width) || el.offsetWidth || 0;
  }
  function H(el) {
    return parseFloat(el.style.height) || el.offsetHeight || 0;
  }
  function tone(name, fb) {
    return (HF.tone && HF.tone(name)) || fb || T.ink;
  }
  /** the core's default entrance for a recipe, for modules that also run their own enter() */
  function enterRecipe(c, el, t, name) {
    var R = c.recipes[name] !== undefined ? c.recipes[name] : c.recipes.fade;
    if (!R) return c.tl.set(el, { autoAlpha: 1 }, t);
    var from = { autoAlpha: R.from || 0 };
    var to = { autoAlpha: 1, duration: R.dur, ease: R.ease, immediateRender: false };
    if (R.y) {
      from.y = R.y;
      to.y = 0;
    }
    if (R.scale) {
      from.scale = R.scale;
      to.scale = 1;
    }
    c.tl.fromTo(el, from, to, t);
  }
  /** number formatting: grouping "in" (Indian lakh/crore commas), "intl" (thousands) or false */
  function fmtNum(x, dec, grouping) {
    var neg = x < 0;
    var s = dec ? Math.abs(x).toFixed(dec) : String(Math.round(Math.abs(x)));
    var parts = s.split(".");
    var ip = parts[0];
    if (grouping === "in" && ip.length > 3) ip = ip.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," + ip.slice(-3);
    else if (grouping !== false && grouping !== "none") ip = ip.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return (neg ? "-" : "") + ip + (parts[1] ? "." + parts[1] : "");
  }
  /** a highlighter marker span over a phrase inside a text node (words wrapped); returns the span or null */
  function markPhrase(el, text, phrase) {
    var norm = function (w) {
      return String(w).toLowerCase().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
    };
    var words = String(text || "").split(/\s+/).filter(Boolean);
    var need = String(phrase || "").split(/\s+/).map(norm).filter(Boolean);
    var at = -1;
    if (need.length) {
      for (var i = 0; i + need.length <= words.length && at < 0; i++) {
        var ok = true;
        for (var j = 0; j < need.length; j++) if (norm(words[i + j]) !== need[j]) ok = false;
        if (ok) at = i;
      }
    }
    el.textContent = "";
    if (at < 0) {
      el.textContent = words.join(" ");
      return null;
    }
    var pre = words.slice(0, at).join(" ");
    var mid = words.slice(at, at + need.length).join(" ");
    var post = words.slice(at + need.length).join(" ");
    if (pre) el.appendChild(document.createTextNode(pre + " "));
    var mk = document.createElement("span");
    mk.className = "lf-mk";
    mk.textContent = mid;
    el.appendChild(mk);
    if (post) el.appendChild(document.createTextNode(" " + post));
    return mk;
  }
  function sweep(c, mk, t, dur) {
    c.tl.set(mk, { backgroundSize: "0% 86%" }, 0);
    c.tl.to(mk, { backgroundSize: "100% 86%", duration: dur || 0.35, ease: "power2.out" }, t);
  }

  // small original line glyphs (24 px viewBox, stroke = currentColor)
  var GLYPH = {
    camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.6"/>',
    image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 17l-5.5-5.5L6 20"/>',
    map: '<path d="M9 4 3 6.5v13.5L9 17.5l6 2.5 6-2.5V4l-6 2.5z"/><path d="M9 4v13.5M15 6.5V20"/>',
    bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
    play: '<path d="M8 5.5v13l11-6.5z"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    news: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 8h10M7 12h10M7 16h6"/>',
  };
  function glyph(name, size, color, sw) {
    var s = svg("svg", { viewBox: "0 0 24 24", width: size, height: size, fill: "none", stroke: color || "currentColor", "stroke-width": sw || 2, "stroke-linecap": "round", "stroke-linejoin": "round" });
    s.innerHTML = GLYPH[name] || "";
    return s;
  }

  HF.lf = { T: T, MONO: MONO, SANS: SANS, F: F, div: div, svg: svg, measure: measure, lineCount: lineCount, fit: fit, W: W, H: H, tone: tone, enterRecipe: enterRecipe, fmtNum: fmtNum, markPhrase: markPhrase, sweep: sweep, glyph: glyph };

  // ================================================================== chrome
  function pad2(n) {
    return String(n).padStart(2, "0");
  }
  // lfHeader: chapter kicker "CH 02 Â· THE AIR DECCAN DEAL" (top-left, 96 / 48)
  // props {index, count, title}   ops chapter {index, title} (1-f swap)
  M.lfHeader = {
    layer: "chrome",
    enter: "none",
    build: function (el, p, c) {
      el.classList.add("lf-head");
      var chip = div("lf-chip", el);
      var tag = c.entity("tag", div("tag", chip, "CH " + pad2(p.index || 1)));
      var ttl = c.entity("title", div("ttl", chip, String(p.title || "").toUpperCase()));
      return {
        ops: {
          chapter: function (e) {
            var v = e.value || {};
            if (v.index !== undefined) c.tl.set(tag, { textContent: "CH " + pad2(v.index) }, e.t);
            if (v.title !== undefined) c.tl.set(ttl, { textContent: String(v.title).toUpperCase() }, e.t);
          },
        },
      };
    },
  };

  // lfProgress: "02 / 07" + one segment per chapter (done ink, current blue, todo grey), top-right
  // props {index, count}   ops advance {} (the current segment fills over 400 ms)
  M.lfProgress = {
    layer: "chrome",
    enter: "none",
    build: function (el, p, c) {
      el.classList.add("lf-prog");
      el.style.display = "flex";
      el.style.alignItems = "center";
      var chip = div("lf-chip", el);
      var n = Math.max(1, Math.min(12, Number(p.count) || 1));
      var k = Math.max(1, Math.min(n, Number(p.index) || 1));
      div("n", chip, pad2(k) + " / " + pad2(n));
      var segs = [];
      for (var i = 1; i <= n; i++) {
        var sg = div("sg", chip);
        sg.setAttribute("data-s", i < k ? "done" : i === k ? "cur" : "todo");
        segs.push(div("f", sg));
        segs[i - 1].style.display = "block";
        c.entity("s" + i, sg);
      }
      var cur = segs[k - 1];
      return {
        enter: function (t) {
          c.tl.set(el, { autoAlpha: 1 }, t);
          // the current chapter's segment fills when the chrome first appears
          c.tl.fromTo(cur, { scaleX: 0 }, { scaleX: 1, duration: 0.4, ease: "power2.out", immediateRender: false }, t + 0.1);
          c.tl.set(cur, { scaleX: 0 }, 0);
        },
        ops: {},
      };
    },
  };

  // lfCredit: the media credit line, bottom-left (96 / 1016, 15 px mono, contrast >= 7:1 on its chip).
  // Filled by the compiler from the media manifest (never by the LLM); swapped with op credit {text}.
  M.lfCredit = {
    layer: "chrome",
    enter: "none",
    build: function (el, p, c) {
      el.classList.add("lf-credit");
      var tx = c.entity("text", div("c", el, p.text || ""));
      return {
        ops: {
          credit: function (e) {
            c.tl.set(tx, { textContent: String((e.value && e.value.text) || "") }, e.t);
          },
        },
      };
    },
  };
})(typeof window !== "undefined" ? window : globalThis);
