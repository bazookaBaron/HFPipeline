/*
 * HFStage DH generic design cards -- topic-agnostic modules in the measured R1/R2 dark style
 * (SPEC.md 5.1-5.6, tokens 2.1/2.4-2.6). Only measured motion recipes are used:
 *   row/item enter   rise 4.5-9 px + fade, 133 ms power2.out        (R2 E15, R1 rows)
 *   recolour/light   133-167 ms linear, dim -> lit                    (SPEC state.recolor)
 *   state flip       1 frame                                          (SPEC state.flip)
 *   count            500-1400 ms power2.out                           (R1/R2 counters)
 *   connector draw   300-433 ms sine.inOut, no arrowheads             (R3/R4/R5)
 *   packet travel    linear 337-468 px/s; token travel 433-733 ms power2.inOut
 *   bar fill         667 ms power2.out                                (R1)
 *   strike           167 ms linear                                    (R2 E7)
 * Every module lays out from its rect (px); data comes from props, words drive ops.
 */
(function (global) {
  "use strict";
  var HF = (global.HFStage = global.HFStage || { modules: {} });
  var M = HF.modules;
  var SVG = "http://www.w3.org/2000/svg";
  var F = 1 / 30;

  var TONES = {
    blue: "#4b9afb",
    green: "#2ad56c",
    red: "#ff375c",
    amber: "#fcba48",
    purple: "#a77bfb",
    cyan: "#50dbf2",
    orange: "#f57201",
    pink: "#e0457b",
    white: "#f1f5fd",
    grey: "#8b9098",
  };
  // role fills/borders at ~20-25% on black (SPEC 2.1 tint fills / tint borders)
  var TINT = {
    blue: ["#091931", "#29456d"],
    green: ["#032815", "#225d40"],
    red: ["#3f0b14", "#893c45"],
    amber: ["#3b2600", "#513b17"],
    purple: ["#201336", "#4a3470"],
    cyan: ["#0a3a49", "#517c8a"],
    orange: ["#3a1c02", "#6b3a12"],
    pink: ["#3a0d1f", "#7a2c4b"],
    grey: ["#0b0f14", "#2a2f35"],
  };

  var CSS = [
    // panel (C1) + rows (D3)
    "html .st-gpanel{background:#090d11;border:1.5px solid #1f2527;border-radius:9px;overflow:hidden;}",
    "html .st-gpanel[data-tone]{background:var(--p-fill);border-color:var(--p-line);}",
    "html .st-gpanel .g-hd{position:absolute;left:0;right:0;top:0;height:54px;display:flex;align-items:center;padding:0 20px;gap:12px;}",
    "html .st-gpanel .g-hd.rule{border-bottom:1.5px solid #1a2024;}",
    "html .st-gpanel .g-tile{width:32px;height:32px;border-radius:8px;display:flex;align-items:center;justify-content:center;flex:none;color:#fff;}",
    "html .st-gpanel .g-title{font-size:15px;font-weight:700;letter-spacing:.18em;color:#c9d0d6;text-transform:uppercase;white-space:nowrap;}",
    "html .st-gpanel .g-meta{margin-left:auto;font-family:var(--st-mono);font-size:16px;color:#8b9098;white-space:nowrap;}",
    "html .st-row{position:absolute;left:14px;right:14px;height:48px;border-radius:6px;display:flex;align-items:center;padding:0 14px;gap:14px;}",
    "html .st-row[data-tone]{background:var(--r-fill);border:1.5px solid var(--r-line);}",
    "html .st-row .r-ic{width:28px;height:28px;border-radius:6px;display:flex;align-items:center;justify-content:center;flex:none;color:#fff;}",
    "html .st-row .r-tx{font-size:21px;font-weight:600;color:#e6e9ed;white-space:nowrap;overflow:hidden;text-overflow:clip;}",
    "html .st-row .r-tx.mono{font-family:var(--st-mono);font-weight:500;font-size:19px;color:#d3dcea;}",
    "html .st-row .r-sub{font-family:var(--st-mono);font-size:16px;color:#8b9098;white-space:nowrap;}",
    "html .st-row .r-val{margin-left:auto;font-family:var(--st-mono);font-size:19px;font-weight:700;color:#f1f5fd;white-space:nowrap;}",
    "html .st-row .r-st{margin-left:auto;font-size:13px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;white-space:nowrap;color:var(--r-acc,#dfe6ee);}",
    "html .st-row .r-dot{width:9px;height:9px;border-radius:50%;background:var(--r-acc,#eef1f4);flex:none;}",
    // table (D2)
    "html .st-table .t-row{position:absolute;left:0;right:0;height:60px;display:flex;align-items:center;border-bottom:1.5px solid #161b20;}",
    "html .st-table .t-row.head{height:46px;border-bottom:1.5px solid #262c33;}",
    "html .st-table .t-c{padding:0 16px;white-space:nowrap;overflow:hidden;font-family:var(--st-mono);font-size:19px;color:#d3dcea;}",
    "html .st-table .t-row.head .t-c{font-family:var(--st-sans);font-size:13px;font-weight:700;letter-spacing:.18em;color:#85898f;text-transform:uppercase;}",
    "html .st-table .t-c.num{text-align:right;}",
    "html .st-table .t-row[data-tone]{background:var(--r-fill);}html .st-table .t-row[data-tone] .t-c{color:var(--r-acc);}",
    "html .st-table .t-c[data-hl='1']{outline:3px solid #fcba48;outline-offset:-3px;}",
    // node diagram (G1/G2/G3)
    "html .st-nodes > svg{position:absolute;left:0;top:0;width:100%;height:100%;overflow:visible;}",
    "html .st-node{position:absolute;display:flex;flex-direction:column;align-items:center;gap:10px;}",
    "html .st-node .n-tile{width:96px;height:96px;border-radius:14px;background:#10161e;border:1.5px solid #252b33;display:flex;align-items:center;justify-content:center;color:#6f7780;}",
    "html .st-node .n-lab{font-family:var(--st-mono);font-size:18px;color:#8b9098;white-space:nowrap;text-align:center;}",
    "html .st-node .n-sub{font-size:12px;font-weight:700;letter-spacing:.16em;color:#72787f;text-transform:uppercase;white-space:nowrap;margin-top:-6px;}",
    "html .st-node[data-lit] .n-tile{background:var(--n-fill);border-color:var(--n-line);color:var(--n-acc);}",
    "html .st-node[data-lit] .n-lab{color:#e6e9ed;}",
    "html .st-elabel{position:absolute;transform:translate(-50%,-50%);font-family:var(--st-mono);font-size:15px;color:#aab1b9;background:#07090c;border:1.5px solid #20262d;border-radius:6px;padding:2px 8px;white-space:nowrap;}",
    "html .st-packet{position:absolute;width:30px;height:30px;margin:-15px 0 0 -15px;border-radius:7px;display:flex;align-items:center;justify-content:center;color:#fff;}",
    // kpi tiles (C8 / D1)
    "html .st-kpis{display:flex;gap:19px;}",
    "html .st-kpi{flex:1;position:relative;background:#090d11;border:1.5px solid #1f2527;border-radius:9px;padding:18px 20px;display:flex;flex-direction:column;gap:8px;overflow:hidden;}",
    "html .st-kpi .k-eye{font-size:13px;font-weight:700;letter-spacing:.2em;color:#85898f;text-transform:uppercase;white-space:nowrap;}",
    "html .st-kpi .k-val{font-family:var(--st-mono);font-size:40px;font-weight:700;color:#f1f5fd;white-space:nowrap;line-height:1;}",
    "html .st-kpi .k-val[data-tone]{color:var(--k-acc);}",
    "html .st-kpi .k-sub{font-size:13px;font-weight:600;letter-spacing:.14em;color:#787e85;text-transform:uppercase;white-space:nowrap;}",
    "html .st-kpi .k-bar{position:absolute;left:20px;right:20px;bottom:16px;height:8px;border-radius:4px;background:#10161e;overflow:hidden;}",
    "html .st-kpi .k-fill{position:absolute;left:0;top:0;bottom:0;border-radius:4px;transform-origin:0 50%;}",
    // code / terminal (X8 / U2)
    "html .st-code{background:#07080b;border:1.5px solid #1c2229;border-radius:9px;overflow:hidden;}",
    "html .st-code .c-bar{position:absolute;left:0;right:0;top:0;height:46px;display:flex;align-items:center;padding:0 16px;gap:9px;border-bottom:1.5px solid #13181d;}",
    "html .st-code .c-dot{width:11px;height:11px;border-radius:50%;}",
    "html .st-code .c-name{margin-left:10px;font-family:var(--st-mono);font-size:15px;color:#7e848b;}",
    "html .st-code .c-eye{margin-left:auto;font-size:12px;font-weight:700;letter-spacing:.18em;color:#a77bfb;text-transform:uppercase;}",
    "html .st-code .c-ln{position:absolute;left:22px;right:22px;height:40px;display:flex;align-items:center;font-family:var(--st-mono);font-size:20px;color:#d6dbe1;white-space:pre;overflow:hidden;}",
    "html .st-code .c-ln .pr{color:#a77bfb;margin-right:12px;}html .st-code .c-ln .cm{color:#72787f;}",
    "html .st-code .c-ln[data-tone]{color:var(--l-acc);}",
    "html .st-code .c-ln[data-hl='1']{background:#1a1407;box-shadow:inset 3px 0 0 #fcba48;}",
    "html .st-code .c-cur{display:inline-block;width:11px;height:24px;background:#d6dbe1;margin-left:4px;vertical-align:middle;}",
    // compare (U4)
    "html .st-compare{display:flex;gap:19px;}",
    "html .st-compare .cmp{flex:1;position:relative;border-radius:9px;border:1.5px solid var(--c-line);background:var(--c-fill);overflow:hidden;}",
    "html .st-compare .cmp-hd{height:54px;display:flex;align-items:center;padding:0 18px;border-bottom:1.5px solid var(--c-line);font-family:var(--st-mono);font-size:18px;font-weight:700;color:var(--c-acc);letter-spacing:.06em;white-space:nowrap;}",
    "html .st-compare .cmp-row{position:absolute;left:18px;right:14px;height:44px;display:flex;align-items:center;gap:10px;font-size:18px;color:#d6dbe1;white-space:nowrap;overflow:hidden;}",
    "html .st-compare .cmp-row .b{width:7px;height:7px;border-radius:50%;background:var(--c-acc);flex:none;}",
    // bars (D5)
    "html .st-bars .b-row{position:absolute;left:0;right:0;height:52px;}",
    "html .st-bars .b-lab{position:absolute;left:0;top:0;font-size:15px;font-weight:700;letter-spacing:.14em;color:#aab1b9;text-transform:uppercase;white-space:nowrap;}",
    "html .st-bars .b-val{position:absolute;right:0;top:-2px;font-family:var(--st-mono);font-size:19px;font-weight:700;color:#f1f5fd;}",
    "html .st-bars .b-trk{position:absolute;left:0;right:0;top:26px;height:14px;border-radius:7px;background:#10161e;overflow:hidden;}",
    "html .st-bars .b-fill{position:absolute;left:0;top:0;bottom:0;border-radius:7px;transform-origin:0 50%;}",
    // steps / tab strip (X7)
    "html .st-steps{display:flex;gap:12px;}",
    "html .st-steps .s-tab{flex:1;border-radius:9px;background:#060c0e;border:1.5px solid #1a2024;display:flex;align-items:center;gap:12px;padding:0 16px;overflow:hidden;}",
    "html .st-steps .s-n{font-family:var(--st-mono);font-size:22px;font-weight:700;color:#787e85;}",
    "html .st-steps .s-l{font-size:15px;font-weight:700;letter-spacing:.14em;color:#787e85;text-transform:uppercase;white-space:nowrap;}",
    "html .st-steps .s-tab[data-on='1']{background:var(--s-fill);border-color:var(--s-line);}",
    "html .st-steps .s-tab[data-on='1'] .s-n,html .st-steps .s-tab[data-on='1'] .s-l{color:var(--s-acc);}",
    "html .st-steps .s-tab[data-done='1'] .s-n{color:#8b9098;}",
    // chips grid (D6)
    "html .st-chips .ch{position:absolute;border-radius:6px;border:1.5px solid #20262d;background:#0b0f14;display:flex;align-items:center;justify-content:center;font-family:var(--st-mono);font-size:16px;color:#787e85;overflow:hidden;white-space:nowrap;}",
    "html .st-chips .ch[data-tone]{background:var(--ch-fill);border-color:var(--ch-line);color:var(--ch-acc);}",
  ].join("\n");

  (function ensureStyle() {
    if (document.getElementById("st-dh3-style")) return;
    var st = document.createElement("style");
    st.id = "st-dh3-style";
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
  function svgEl(tag, attrs, parent) {
    var el = document.createElementNS(SVG, tag);
    Object.keys(attrs || {}).forEach(function (k) {
      el.setAttribute(k, attrs[k]);
    });
    if (parent) parent.appendChild(el);
    return el;
  }
  function W(el) {
    return parseFloat(el.style.width);
  }
  function H(el) {
    return parseFloat(el.style.height);
  }
  function icon(name, size) {
    if (global.HFIcons && name && global.HFIcons.names.indexOf(name) >= 0) {
      var s = global.HFIcons.create(name, { size: size });
      s.setAttribute("stroke-width", "2.2");
      return s;
    }
    return null;
  }
  function tile(parent, cls, name, tone, size) {
    var t = div(cls, parent);
    t.style.background = TONES[tone] || TONES.purple;
    var ic = icon(name, size || 18);
    if (ic) t.appendChild(ic);
    return t;
  }
  function tint(el, prefix, tone) {
    var t = TINT[tone] || TINT.grey;
    el.style.setProperty("--" + prefix + "-fill", t[0]);
    el.style.setProperty("--" + prefix + "-line", t[1]);
    el.style.setProperty("--" + prefix + "-acc", TONES[tone] || TONES.white);
  }
  // seek-safe tint change: set the three custom properties in one frame
  function tintAt(tl, el, prefix, tone, t) {
    var tt = TINT[tone] || TINT.grey;
    var v = {};
    v["--" + prefix + "-fill"] = tt[0];
    v["--" + prefix + "-line"] = tt[1];
    v["--" + prefix + "-acc"] = TONES[tone] || TONES.white;
    tl.set(el, v, t);
    tl.set(el, { attr: { "data-tone": tone } }, t);
  }
  function rowEnter(tl, el, t, dx) {
    // R2 E15: 4.5 px rise + fade 133 ms; R1 list rows slide 9 px from the right
    var from = dx ? { autoAlpha: 0, x: dx } : { autoAlpha: 0, y: 4.5 };
    var to = dx ? { autoAlpha: 1, x: 0 } : { autoAlpha: 1, y: 0 };
    to.duration = 0.133;
    to.ease = "power2.out";
    to.immediateRender = false;
    tl.fromTo(el, from, to, t);
  }
  function hideAtZero(tl, el) {
    tl.set(el, { autoAlpha: 0 }, 0);
  }
  function strikeOver(tl, parent, t, tone) {
    var line = div("st-strike", parent);
    if (tone) line.setAttribute("data-tone", tone);
    tl.set(line, { scaleX: 0, transformOrigin: "0% 50%" }, 0);
    tl.to(line, { scaleX: 1, duration: 0.167, ease: "none" }, t);
    return line;
  }
  function countText(tl, node, from, to, t, dur, fmt, ease) {
    var o = { v: from };
    tl.set(node, { textContent: fmt(from) }, t);
    tl.to(o, { v: to, duration: dur, ease: ease || "power2.out", immediateRender: false, onUpdate: function () { node.textContent = fmt(o.v); } }, t);
  }
  function numFormatter(template) {
    // template like "1,240 req/s" or "18%": keep prefix/suffix and decimals of the target
    var m = String(template).match(/^([^0-9\-]*)(-?[0-9][0-9,]*\.?[0-9]*)(.*)$/);
    if (!m) return { target: 0, fmt: function () { return String(template); } };
    var dec = (m[2].split(".")[1] || "").length;
    var grouped = m[2].indexOf(",") >= 0;
    return {
      target: parseFloat(m[2].replace(/,/g, "")),
      fmt: function (v) {
        var s = v.toFixed(dec);
        if (grouped) s = s.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
        return m[1] + s + m[3];
      },
    };
  }

  // =============== panel: header + rows (C1 + D3) ===============
  // props {title, icon?, tone? (whole-panel tint), meta?, rows:[{text, mono?, icon?, iconTone?, sub?, value?, status?, tone?, hidden?}], pitch?}
  M.panel = {
    enter: "fade",
    build: function (el, p, c) {
      el.classList.add("st-gpanel");
      if (p.tone) {
        el.setAttribute("data-tone", p.tone);
        tint(el, "p", p.tone);
      }
      var top = 0;
      if (p.title) {
        var hd = div("g-hd" + ((p.rows || []).length ? " rule" : ""), el);
        if (p.icon) tile(hd, "g-tile", p.icon, p.iconTone || p.tone || "purple", 18);
        c.entity("title", div("g-title", hd, p.title));
        if (p.meta) c.entity("meta", div("g-meta", hd, p.meta));
        top = 54;
      }
      var pitch = p.pitch || 58;
      var rows = (p.rows || []).map(function (r, i) {
        var row = div("st-row", el);
        row.style.top = top + 12 + i * pitch + "px";
        if (r.tone) {
          row.setAttribute("data-tone", r.tone);
          tint(row, "r", r.tone);
        }
        if (r.icon) tile(row, "r-ic", r.icon, r.iconTone || r.tone || "orange", 17);
        var tx = div("r-tx" + (r.mono ? " mono" : ""), row, r.text);
        if (r.sub) div("r-sub", row, r.sub);
        var val = r.value !== undefined ? div("r-val", row, r.value) : null;
        var st = null;
        if (r.status) {
          if (!val) {
            st = div("r-st", row, r.status);
          } else {
            div("r-dot", row);
          }
        }
        c.entity("row" + (i + 1), row);
        c.entity("row" + (i + 1) + ".text", tx);
        if (val) c.entity("row" + (i + 1) + ".value", val);
        if (st) c.entity("row" + (i + 1) + ".status", st);
        if (r.hidden) hideAtZero(c.tl, row);
        return row;
      });
      function row(e) {
        var n = e.value && e.value.row;
        if (!rows[n - 1]) throw new Error("panel " + c.id + " has no row " + n);
        return rows[n - 1];
      }
      return {
        ops: {
          // value {row, from?:"right"}: row appears on its word
          rowIn: function (e) {
            rowEnter(c.tl, row(e), e.t, e.value.from === "right" ? 9 : 0);
          },
          // value {row, tone}: whole-row recolour (tint fill + stronger border), 1 frame
          rowTone: function (e) {
            tintAt(c.tl, row(e), "r", e.value.tone, e.t);
          },
          rowStrike: function (e) {
            strikeOver(c.tl, row(e), e.t, e.value.tone || "red");
            c.tl.to(row(e), { opacity: 0.55, duration: 0.133 }, e.t + 0.167);
          },
          rowText: function (e) {
            c.tl.set(c.entities[c.id + ".row" + e.value.row + ".text"], { textContent: String(e.value.text) }, e.t);
          },
          rowStatus: function (e) {
            var st = c.entities[c.id + ".row" + e.value.row + ".status"];
            if (!st) throw new Error("row " + e.value.row + " has no status");
            c.tl.set(st, { textContent: String(e.value.status) }, e.t);
            if (e.value.tone) tintAt(c.tl, row(e), "r", e.value.tone, e.t);
          },
          panelTone: function (e) {
            tintAt(c.tl, el, "p", e.value.tone, e.t);
          },
        },
      };
    },
  };

  // =============== table (D2) ===============
  // props {columns:[{label, num?, w?}], rows:[[cells]], hiddenRows?:[indices 1-based], title?}
  M.table = {
    enter: "fade",
    build: function (el, p, c) {
      el.classList.add("st-table");
      var cols = p.columns || [];
      var total = cols.reduce(function (a, col) {
        return a + (col.w || 1);
      }, 0);
      function mkRow(cells, cls, top) {
        var r = div("t-row " + (cls || ""), el);
        r.style.top = top + "px";
        cols.forEach(function (col, i) {
          var cell = div("t-c" + (col.num ? " num" : ""), r, cells[i] !== undefined ? String(cells[i]) : "");
          cell.style.width = ((col.w || 1) / total) * 100 + "%";
        });
        return r;
      }
      mkRow(cols.map(function (col) { return col.label; }), "head", 0);
      var hidden = p.hiddenRows || [];
      var rows = (p.rows || []).map(function (cells, i) {
        var r = mkRow(cells, "", 46 + i * 60);
        c.entity("row" + (i + 1), r);
        Array.prototype.forEach.call(r.children, function (cell, j) {
          c.entity("r" + (i + 1) + "c" + (j + 1), cell);
        });
        if (hidden.indexOf(i + 1) >= 0) hideAtZero(c.tl, r);
        return r;
      });
      return {
        ops: {
          rowIn: function (e) {
            // R2 105.77: row insert into a reserved slot, 100 ms fade
            var r = rows[e.value.row - 1];
            c.tl.fromTo(r, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.1, ease: "power2.out", immediateRender: false }, e.t);
          },
          rowTone: function (e) {
            tintAt(c.tl, rows[e.value.row - 1], "r", e.value.tone, e.t);
          },
          cell: function (e) {
            var cell = c.entities[c.id + ".r" + e.value.row + "c" + e.value.col];
            c.tl.set(cell, { textContent: String(e.value.text) }, e.t);
            if (e.value.hl) c.tl.set(cell, { attr: { "data-hl": "1" } }, e.t);
          },
          rowStrike: function (e) {
            strikeOver(c.tl, rows[e.value.row - 1], e.t, e.value.tone || "red");
          },
        },
      };
    },
  };

  // =============== node diagram (G1 + G2 + G3) ===============
  // props {nodes:[{id, icon, label, sub?, x, y (0-1 of rect, node centre), tone?, lit?, hidden?}],
  //        edges:[{from, to, label?, style?: "solid"|"dashed", shape?: "curve"|"elbow"|"straight", drawn?}]}
  M.nodes = {
    enter: "fade",
    build: function (el, p, c) {
      el.classList.add("st-nodes");
      var w = W(el);
      var h = H(el);
      var s = svgEl("svg", { viewBox: "0 0 " + w + " " + h }, el);
      var byId = {};
      (p.nodes || []).forEach(function (n) {
        byId[n.id] = { x: n.x * w, y: n.y * h, n: n };
      });
      var edges = {};
      (p.edges || []).forEach(function (e) {
        var a = byId[e.from];
        var b = byId[e.to];
        if (!a || !b) return;
        // start/end outside the 96 px tiles (9 px gap, R5), tangents per shape
        var ax = a.x, ay = a.y, bx = b.x, by = b.y;
        var dx = bx - ax, dy = by - ay;
        var horiz = Math.abs(dx) >= Math.abs(dy);
        var pad = 57;
        if (horiz) {
          ax += Math.sign(dx) * pad;
          bx -= Math.sign(dx) * pad;
        } else {
          ay += Math.sign(dy) * (pad + (dy > 0 ? 22 : 0));
          by -= Math.sign(dy) * (pad + (dy > 0 ? 0 : 22));
        }
        var d;
        var shape = e.shape || "curve";
        if (shape === "straight") d = "M" + ax + " " + ay + " L " + bx + " " + by;
        else if (shape === "elbow") d = horiz ? "M" + ax + " " + ay + " H " + (ax + bx) / 2 + " V " + by + " H " + bx : "M" + ax + " " + ay + " V " + (ay + by) / 2 + " H " + bx + " V " + by;
        else d = horiz ? "M" + ax + " " + ay + " C " + (ax + bx) / 2 + " " + ay + ", " + (ax + bx) / 2 + " " + by + ", " + bx + " " + by : "M" + ax + " " + ay + " C " + ax + " " + (ay + by) / 2 + ", " + bx + " " + (ay + by) / 2 + ", " + bx + " " + by;
        var ghost = svgEl("path", { d: d, fill: "none", stroke: "#1d232a", "stroke-width": 3 }, s);
        var path = svgEl("path", { d: d, fill: "none", stroke: TONES[e.tone] || "#6a7179", "stroke-width": 3 }, s);
        if (e.style === "dashed") path.setAttribute("stroke-dasharray", "15 10.5");
        var len = path.getTotalLength ? path.getTotalLength() : Math.hypot(bx - ax, by - ay);
        var key = e.from + "->" + e.to;
        var drawn = e.drawn !== false;
        if (e.style !== "dashed") {
          path.setAttribute("stroke-dasharray", len + " " + len);
          path.setAttribute("stroke-dashoffset", drawn ? 0 : len);
        } else if (!drawn) path.style.opacity = 0;
        var lab = null;
        if (e.label) {
          var mid = path.getPointAtLength ? path.getPointAtLength(len / 2) : { x: (ax + bx) / 2, y: (ay + by) / 2 };
          lab = div("st-elabel", el, e.label);
          lab.style.left = mid.x + "px";
          lab.style.top = mid.y + "px";
          if (!drawn) lab.style.opacity = 0;
          c.entity(key + ".label", lab);
        }
        void ghost;
        edges[key] = { path: path, len: len, lab: lab, dashed: e.style === "dashed", e: e };
        c.entity(key, path);
      });
      var nodeEls = {};
      (p.nodes || []).forEach(function (n) {
        var ne = div("st-node", el);
        ne.style.left = byId[n.id].x - 80 + "px";
        ne.style.top = byId[n.id].y - 48 + "px";
        ne.style.width = "160px";
        var t = div("n-tile", ne);
        var ic = icon(n.icon || "server", 44);
        if (ic) t.appendChild(ic);
        div("n-lab", ne, n.label || n.id);
        if (n.sub) div("n-sub", ne, n.sub);
        tint(ne, "n", n.tone || "cyan");
        if (n.lit !== false) ne.setAttribute("data-lit", "1");
        if (n.hidden) hideAtZero(c.tl, ne);
        nodeEls[n.id] = ne;
        c.entity(n.id, ne);
      });
      function edge(e) {
        var k = e.value && (e.value.edge || (e.value.from + "->" + e.value.to));
        if (!edges[k]) throw new Error("no edge " + k);
        return edges[k];
      }
      return {
        ops: {
          // dim (~30%) -> lit in 100-167 ms, one per spoken noun (R5 E4)
          light: function (e) {
            var ne = nodeEls[e.value.node];
            if (!ne) throw new Error("no node " + e.value.node);
            if (e.value.tone) {
              var tt = TINT[e.value.tone] || TINT.cyan;
              var v = { "--n-fill": tt[0], "--n-line": tt[1], "--n-acc": TONES[e.value.tone] };
              c.tl.set(ne, v, e.t);
            }
            c.tl.set(ne, { attr: { "data-lit": "1" } }, e.t);
            c.tl.fromTo(ne, { opacity: 0.45 }, { opacity: 1, duration: 0.133, ease: "none", immediateRender: false }, e.t);
          },
          nodeIn: function (e) {
            var ne = nodeEls[e.value.node];
            c.tl.fromTo(ne, { autoAlpha: 0, y: 6 }, { autoAlpha: 1, y: 0, duration: 0.133, ease: "power2.out", immediateRender: false }, e.t);
          },
          // connector draw-on (SPEC draw.connector 300-433 ms sine.inOut)
          draw: function (e) {
            var g = edge(e);
            var dur = e.value.dur || 0.4;
            if (g.dashed) c.tl.fromTo(g.path, { opacity: 0 }, { opacity: 1, duration: 0.25, ease: "none", immediateRender: false }, e.t);
            else c.tl.to(g.path, { attr: { "stroke-dashoffset": 0 }, duration: dur, ease: "sine.inOut" }, e.t);
            if (g.lab) c.tl.to(g.lab, { opacity: 1, duration: 0.133, ease: "power2.out" }, e.t + dur * 0.8);
          },
          // packet along an edge: linear ~400 px/s (R4), repeated `loops` times (finite, seek-safe)
          packet: function (e) {
            var g = edge(e);
            var v = e.value;
            var speed = v.speed || 400;
            var dur = Math.max(0.3, g.len / speed);
            var loops = Math.max(1, v.loops || 1);
            var pk = div("st-packet", el);
            pk.style.background = TONES[v.tone] || TONES.blue;
            var ic = icon(v.icon || "file", 16);
            if (ic) pk.appendChild(ic);
            hideAtZero(c.tl, pk);
            var proxy = { k: 0 };
            var place = function () {
              var d = proxy.k % 1;
              var pt = g.path.getPointAtLength(g.len * (proxy.k >= loops ? 1 : d));
              pk.style.left = pt.x + "px";
              pk.style.top = pt.y + "px";
            };
            var p0 = g.path.getPointAtLength(0);
            c.tl.set(pk, { autoAlpha: 1, left: p0.x + "px", top: p0.y + "px" }, e.t);
            c.tl.to(proxy, { k: loops, duration: dur * loops, ease: "none", immediateRender: false, onUpdate: place }, e.t);
            if (v.park === false) c.tl.set(pk, { autoAlpha: 0 }, e.t + dur * loops);
            if (v.lightTarget) {
              var tgt = nodeEls[g.e.to];
              if (tgt) {
                c.tl.set(tgt, { attr: { "data-lit": "1" } }, e.t + dur);
                c.tl.fromTo(tgt, { opacity: 0.45 }, { opacity: 1, duration: 0.133, ease: "none", immediateRender: false }, e.t + dur);
              }
            }
          },
          edgeTone: function (e) {
            var g = edge(e);
            c.tl.set(g.path, { attr: { stroke: TONES[e.value.tone] || "#6a7179" } }, e.t);
          },
        },
      };
    },
  };

  // =============== KPI tiles (C8 / D1 counters) ===============
  // props {items:[{eyebrow, value, sub?, tone?, bar? (0-100), countFrom?}]}
  M.kpis = {
    enter: "fade",
    build: function (el, p, c) {
      el.classList.add("st-kpis");
      var items = (p.items || []).map(function (it, i) {
        var k = div("st-kpi", el);
        div("k-eye", k, it.eyebrow || "");
        var val = div("k-val", k, it.countFrom !== undefined ? numFormatter(it.value).fmt(it.countFrom) : it.value);
        if (it.tone) {
          val.setAttribute("data-tone", it.tone);
          val.style.setProperty("--k-acc", TONES[it.tone]);
        }
        if (it.sub) div("k-sub", k, it.sub);
        var fill = null;
        if (it.bar !== undefined) {
          var bar = div("k-bar", k);
          fill = div("k-fill", bar);
          fill.style.width = "100%";
          fill.style.background = TONES[it.tone] || TONES.cyan;
          fill.style.transform = "scaleX(" + it.bar / 100 + ")";
        }
        c.entity("k" + (i + 1), k);
        c.entity("k" + (i + 1) + ".value", val);
        return { k: k, val: val, fill: fill, it: it };
      });
      return {
        ops: {
          // value {item, to?, dur?, ease?}: count to the item's value (or `to` template)
          count: function (e) {
            var x = items[e.value.item - 1];
            var target = e.value.to !== undefined ? String(e.value.to) : String(x.it.value);
            var nf = numFormatter(target);
            var from = e.value.from !== undefined ? Number(e.value.from) : x.it.countFrom || 0;
            countText(c.tl, x.val, from, nf.target, e.t, e.value.dur || 0.9, nf.fmt, e.value.ease);
          },
          tone: function (e) {
            var x = items[e.value.item - 1];
            c.tl.set(x.val, { "--k-acc": TONES[e.value.tone], attr: { "data-tone": e.value.tone } }, e.t);
          },
          fill: function (e) {
            var x = items[e.value.item - 1];
            if (!x.fill) throw new Error("kpi item " + e.value.item + " has no bar");
            c.tl.to(x.fill, { scaleX: e.value.to / 100, duration: 0.667, ease: "power2.out" }, e.t);
          },
        },
      };
    },
  };

  // =============== code / terminal (X8 / U2) ===============
  // props {name?, eyebrow?, prompt? (e.g. "$"), lines:[{text, tone?, comment?, hidden?}]}
  M.code = {
    enter: "settle",
    build: function (el, p, c) {
      el.classList.add("st-code");
      var bar = div("c-bar", el);
      ["#ff645a", "#f9c745", "#4dc561"].forEach(function (col) {
        div("c-dot", bar).style.background = col;
      });
      if (p.name) div("c-name", bar, p.name);
      if (p.eyebrow) div("c-eye", bar, p.eyebrow);
      var lines = (p.lines || []).map(function (ln, i) {
        var l = div("c-ln", el);
        l.style.top = 58 + i * 42 + "px";
        if (p.prompt && !ln.comment) div("pr", l, p.prompt);
        var tx = div(ln.comment ? "cm" : "", l, ln.text);
        tx.style.display = "inline";
        if (ln.tone) {
          l.setAttribute("data-tone", ln.tone);
          l.style.setProperty("--l-acc", TONES[ln.tone]);
        }
        if (ln.hidden) hideAtZero(c.tl, l);
        c.entity("l" + (i + 1), l);
        c.entity("l" + (i + 1) + ".text", tx);
        return { l: l, tx: tx, text: ln.text };
      });
      return {
        ops: {
          // typewriter: 2 chars/frame (R2 SQL) unless cps given (R3 18 cps, R1 ~24 cps)
          type: function (e) {
            var x = lines[e.value.line - 1];
            var full = String(e.value.text || x.text);
            var cps = e.value.cps || 60;
            c.tl.set(x.l, { autoAlpha: 1 }, e.t);
            c.tl.set(x.tx, { textContent: "" }, e.t);
            var n = full.length;
            var step = Math.max(1, Math.round(cps * F));
            var k = 0;
            for (var i = step; i < n + step; i += step) {
              c.tl.set(x.tx, { textContent: full.slice(0, Math.min(i, n)) }, e.t + ++k * F);
            }
          },
          lineIn: function (e) {
            rowEnter(c.tl, lines[e.value.line - 1].l, e.t, 0);
          },
          lineHl: function (e) {
            c.tl.set(lines[e.value.line - 1].l, { attr: { "data-hl": "1" } }, e.t);
          },
          lineTone: function (e) {
            var l = lines[e.value.line - 1].l;
            c.tl.set(l, { "--l-acc": TONES[e.value.tone], attr: { "data-tone": e.value.tone } }, e.t);
          },
        },
      };
    },
  };

  // =============== compare (U4): two columns ===============
  // props {left:{title, tone, rows:[...]}, right:{title, tone, rows:[...]}, hidden?: true (rows start hidden)}
  M.compare = {
    enter: "fade",
    build: function (el, p, c) {
      el.classList.add("st-compare");
      var sides = {};
      ["left", "right"].forEach(function (side) {
        var sp = p[side] || {};
        var col = div("cmp", el);
        tint(col, "c", sp.tone || (side === "left" ? "red" : "green"));
        c.entity(side, col);
        div("cmp-hd", col, sp.title || side.toUpperCase());
        sides[side] = (sp.rows || []).map(function (r, i) {
          var row = div("cmp-row", col);
          row.style.top = 66 + i * 50 + "px";
          div("b", row);
          div("", row, r);
          if (p.hidden) hideAtZero(c.tl, row);
          c.entity(side + ".row" + (i + 1), row);
          return row;
        });
      });
      return {
        ops: {
          rowIn: function (e) {
            rowEnter(c.tl, sides[e.value.side][e.value.row - 1], e.t, 0);
          },
          rowStrike: function (e) {
            strikeOver(c.tl, sides[e.value.side][e.value.row - 1], e.t, e.value.tone || "red");
          },
          // dim the losing side (SPEC state.dimOthers)
          pick: function (e) {
            var other = e.value.side === "left" ? "right" : "left";
            c.tl.to(c.entities[c.id + "." + other], { opacity: 0.45, duration: 0.133, ease: "power2.out" }, e.t);
          },
        },
      };
    },
  };

  // =============== bars (D5) ===============
  // props {items:[{label, value (0-100), display?, tone?}], filled?: bool}
  M.bars = {
    enter: "fade",
    build: function (el, p, c) {
      el.classList.add("st-bars");
      var items = (p.items || []).map(function (it, i) {
        var r = div("b-row", el);
        r.style.top = i * 64 + "px";
        div("b-lab", r, it.label);
        var val = div("b-val", r, it.display || it.value + "%");
        var trk = div("b-trk", r);
        var fill = div("b-fill", trk);
        fill.style.width = "100%";
        fill.style.background = TONES[it.tone] || TONES.cyan;
        fill.style.transform = "scaleX(" + (p.filled === false ? 0 : it.value / 100) + ")";
        c.entity("b" + (i + 1), r);
        c.entity("b" + (i + 1) + ".value", val);
        return { fill: fill, val: val, it: it };
      });
      return {
        ops: {
          // R1: bars fill in 667 ms power2.out, 67 ms apart when several fill together
          fill: function (e) {
            var list = e.value && e.value.item ? [items[e.value.item - 1]] : items;
            list.forEach(function (x, j) {
              var to = e.value && e.value.to !== undefined ? e.value.to : x.it.value;
              c.tl.to(x.fill, { scaleX: to / 100, duration: 0.667, ease: "power2.out" }, e.t + j * 0.067);
              if (e.value && e.value.display) c.tl.set(x.val, { textContent: e.value.display }, e.t);
            });
          },
          tone: function (e) {
            var x = items[e.value.item - 1];
            c.tl.set(x.fill, { background: TONES[e.value.tone] }, e.t);
          },
        },
      };
    },
  };

  // =============== steps / tab strip (X7) ===============
  // props {items:["ADD","RUN BOTH",...], active?: 1-based, tone?}
  M.steps = {
    enter: "fade",
    build: function (el, p, c) {
      el.classList.add("st-steps");
      var tone = p.tone || "purple";
      var tabs = (p.items || []).map(function (label, i) {
        var t = div("s-tab", el);
        tint(t, "s", tone);
        div("s-n", t, String(i + 1));
        div("s-l", t, label);
        if (p.active === i + 1) t.setAttribute("data-on", "1");
        c.entity("s" + (i + 1), t);
        return t;
      });
      return {
        ops: {
          // one active step at a time, 1-frame switch (R2 S13 / R4 stepper)
          activate: function (e) {
            tabs.forEach(function (t, i) {
              c.tl.set(t, { attr: { "data-on": i + 1 === e.value.step ? "1" : "0", "data-done": i + 1 < e.value.step ? "1" : "0" } }, e.t);
            });
          },
        },
      };
    },
  };

  // =============== chips / cell grid (D6) ===============
  // props {cols, rows, labels?:[...], tone?, filled?: count initially filled}
  M.chips = {
    enter: "fade",
    build: function (el, p, c) {
      el.classList.add("st-chips");
      var cols = p.cols || 6;
      var rows = p.rows || 3;
      var gap = p.gap || 15;
      var cw = (W(el) - gap * (cols - 1)) / cols;
      var ch = (H(el) - gap * (rows - 1)) / rows;
      var cells = [];
      for (var r = 0; r < rows; r++) {
        for (var k = 0; k < cols; k++) {
          var i = r * cols + k;
          var cell = div("ch", el, p.labels && p.labels[i] !== undefined ? p.labels[i] : "");
          Object.assign(cell.style, { left: k * (cw + gap) + "px", top: r * (ch + gap) + "px", width: cw + "px", height: ch + "px" });
          if (p.filled && i < p.filled) tint(cell, "ch", p.tone || "cyan"), cell.setAttribute("data-tone", p.tone || "cyan");
          c.entity("c" + (i + 1), cell);
          cells.push(cell);
        }
      }
      return {
        ops: {
          // value {from?, to?, tone?, stagger?}: fill cascade (R1 cells ~60 ms apart)
          fill: function (e) {
            var v = e.value || {};
            var a = (v.from || 1) - 1;
            var b = Math.min(cells.length, v.to || cells.length);
            for (var i = a; i < b; i++) tintAt(c.tl, cells[i], "ch", v.tone || p.tone || "cyan", e.t + (i - a) * (v.stagger !== undefined ? v.stagger : 0.06));
          },
          cellTone: function (e) {
            tintAt(c.tl, cells[e.value.cell - 1], "ch", e.value.tone, e.t);
          },
        },
      };
    },
  };
})(typeof window !== "undefined" ? window : globalThis);
