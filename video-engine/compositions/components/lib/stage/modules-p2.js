/*
 * HFStage phase-2 cards from reels R6-R8 (analysis/pacing-audit-20260924/design/PLAN_R6-R8.md).
 *
 * chapterTabs (R8 N3): 4 equal tabs, h 55.5, gap 10, r 6, line icon + tracked caps 13 px; single
 *   active chapter (1-f relight) or cumulative recap (each tab lights on its noun).
 *   props {items:[{text, icon?, tone?}], active? (1-based), mode?: "single"|"cumulative"}
 *   ops   activate {i}, light {i}
 */
(function (global) {
  "use strict";
  var HF = (global.HFStage = global.HFStage || { modules: {} });
  var M = HF.modules;

  var CSS = [
    "html .st-ctabs{display:flex;gap:10px;}",
    "html .st-ctabs .tb{flex:1;height:100%;border-radius:6px;border:1.5px solid var(--x-1c2229,#1c2229);background:var(--x-090d11,#090d11);display:flex;align-items:center;justify-content:center;gap:10px;font-size:15px;font-weight:700;letter-spacing:.18em;color:var(--x-6d737b,#6d737b);text-transform:uppercase;white-space:nowrap;}",
    "html .st-ctabs .tb svg{flex:none;}",
    "html .st-ctabs .tb[data-on='1']{background:var(--t-fill);border-color:var(--t-line);color:var(--t-acc);}",
    "html [data-profile=LC] .st-ctabs .tb{background:#fefcf8;border-color:#bcc3c2;color:#5d6668;}",
  ].join("\n");

  (function ensureStyle() {
    if (document.getElementById("st-p2-style")) return;
    var st = document.createElement("style");
    st.id = "st-p2-style";
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

  M.chapterTabs = {
    enter: "fade",
    build: function (el, p, c) {
      el.classList.add("st-ctabs");
      var tabs = (p.items || []).map(function (it, i) {
        var tb = c.entity("t" + (i + 1), div("tb", el));
        if (it.icon && global.HFIcons && global.HFIcons.create) {
          var ic = global.HFIcons.create(it.icon, { size: 18 });
          if (ic) tb.appendChild(ic);
        }
        div("", tb, it.text || "");
        var tt = HF.tint(it.tone || "blue") || [];
        tb.style.setProperty("--t-fill", tt[0] || "#0b1c36");
        tb.style.setProperty("--t-line", tt[1] || "#29456d");
        tb.style.setProperty("--t-acc", HF.tone(it.tone || "blue") || "#4b9afb");
        tb.setAttribute("data-on", p.active === i + 1 ? "1" : "0");
        return tb;
      });
      function set(i, on, t) {
        var tb = tabs[i - 1];
        if (!tb) throw new Error("chapterTabs: no tab " + i);
        c.tl.set(tb, { attr: { "data-on": on ? "1" : "0" } }, t);
      }
      return {
        ops: {
          activate: function (e) {
            var i = (e.value && e.value.i) || 1;
            if (p.mode !== "cumulative") tabs.forEach(function (_, k) {
              if (k + 1 !== i) set(k + 1, false, e.t);
            });
            set(i, true, e.t);
          },
          light: function (e) {
            set((e.value && e.value.i) || 1, true, e.t);
          },
        },
      };
    },
  };
})(typeof window !== "undefined" ? window : globalThis);
