/*
 * HFHostEvents -- v2 seek-safe event track for a persistent visual host.
 *
 * A v2 "host" is ONE component mount that lives across several narration sentences and
 * mutates in place at spoken words (the reference grammar: R2 keeps its router/cards
 * scaffold ~125 s and changes it; R5 swaps sub-states inside a scaffold). The host's DOM
 * marks addressable parts with `data-entity="<id>"`; the storyboard supplies typed events:
 *
 *   { id, t, op, target, value?, preset? }      t = seconds, host-local (authored time)
 *
 * Every event becomes tweens/sets on the component's single paused root timeline at an
 * explicit position, so seeking straight to any time reconstructs the same state whether or
 * not earlier frames were visited. No callbacks with side effects, no Date/Math.random, no
 * infinite repeats.
 *
 * Generic ops (work on any data-entity element):
 *   reveal    fade + small rise                     (refs: 66-200 ms ease-out, 2-6 px)
 *   remove    fade out
 *   update    one-frame text swap                    value: "new text"
 *   state     one-frame data-state attribute flip    value: "error" | "live" | ...
 *   highlight accent ring / tint via --hf-hl 0->1     value: optional hold seconds (then back to 0)
 *   strike    strike-through sweep + dim via --hf-strike
 *   draw      SVG stroke draw, or scaleX grow for HTML connectors (refs: 270-430 ms)
 *   count     numeric count     value: {from?, to, decimals?, prefix?, suffix?, dur?}
 *   type      typewriter reveal of the element's text   value: {cps?}  (refs: 15-70 char/s)
 *   pulse     short emphasis punch (scale 1 -> 1.06 -> 1)
 * Components add their own ops (e.g. deployment-dashboard "traffic") via `ops`.
 *
 * Timing: preset durations are in FINAL-VIDEO seconds and multiplied by opts.timeScale (the
 * post-render speed factor, e.g. 1.8) so on-screen motion lands in the reference band no
 * matter what post speed the pipeline uses.
 */
(function (global) {
  "use strict";

  var PRESETS = {
    arrive: { dur: 0.15, rise: 0.6 }, // rise in cqmin
    remove: { dur: 0.12 },
    highlight: { dur: 0.12 },
    strike: { dur: 0.25 },
    draw: { dur: 0.33 },
    count: { dur: 0.9 },
    pulse: { dur: 0.2 },
  };

  function findEntity(root, id) {
    if (!id) return null;
    var esc = String(id).replace(/(["\\])/g, "\\$1");
    return root.querySelector('[data-entity="' + esc + '"]');
  }

  function formatNumber(v, spec) {
    var d = spec.decimals || 0;
    var s = d > 0 ? v.toFixed(d) : String(Math.round(v));
    if (spec.grouping !== false && d === 0) s = s.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return (spec.prefix || "") + s + (spec.suffix || "");
  }

  function parseNumber(text) {
    var m = String(text || "").replace(/,/g, "").match(/-?\d+(\.\d+)?/);
    return m ? parseFloat(m[0]) : 0;
  }

  /**
   * Normalize + validate an events list. Returns {events, problems}. Invalid events are
   * dropped (never guessed at) and reported so the orchestrator QA can surface them.
   */
  function normalize(rawEvents, root, extraOps, duration) {
    var ops = Object.assign({}, GENERIC_OPS, extraOps || {});
    var out = [];
    var problems = [];
    (Array.isArray(rawEvents) ? rawEvents : []).forEach(function (ev, i) {
      if (!ev || typeof ev !== "object") return problems.push("event[" + i + "] is not an object");
      var t = Number(ev.t);
      if (!isFinite(t) || t < 0) return problems.push("event[" + i + "] has no valid t");
      if (!ops[ev.op]) return problems.push("event[" + i + "] unknown op '" + ev.op + "'");
      var needsTarget = !(ops[ev.op].noTarget);
      var el = needsTarget ? findEntity(root, ev.target) : null;
      if (needsTarget && !el) return problems.push("event[" + i + "] target '" + ev.target + "' not found");
      out.push({ id: ev.id || "e" + i, t: Math.min(t, Math.max(0, duration - 0.05)), op: ev.op, target: ev.target, el: el, value: ev.value, order: i });
    });
    // Deterministic order: time, then authored order.
    out.sort(function (a, b) {
      return a.t - b.t || a.order - b.order;
    });
    return { events: out, problems: problems, ops: ops };
  }

  var GENERIC_OPS = {
    reveal: {
      initial: function (ctx, ev) {
        ctx.tl.set(ev.el, { opacity: 0 }, 0);
      },
      apply: function (ctx, ev) {
        var p = PRESETS.arrive;
        ctx.tl.fromTo(
          ev.el,
          { opacity: 0, y: p.rise * ctx.cq },
          { opacity: 1, y: 0, duration: p.dur * ctx.ts, ease: "power2.out", immediateRender: false },
          ev.t
        );
      },
    },
    remove: {
      apply: function (ctx, ev) {
        ctx.tl.to(ev.el, { opacity: 0, duration: PRESETS.remove.dur * ctx.ts, ease: "power1.in" }, ev.t);
      },
    },
    update: {
      apply: function (ctx, ev) {
        var vars = { textContent: String(ev.value == null ? "" : ev.value) };
        // A corrected value replaces a struck one: clear the strike + dim in the same frame.
        if (ctx.struck.has(ev.el)) {
          vars["--hf-strike"] = 0;
          vars.opacity = 1;
          ctx.struck.delete(ev.el);
        }
        ctx.tl.set(ev.el, vars, ev.t);
      },
    },
    state: {
      apply: function (ctx, ev) {
        ctx.tl.set(ev.el, { attr: { "data-state": String(ev.value || "") } }, ev.t);
      },
    },
    highlight: {
      apply: function (ctx, ev) {
        var d = PRESETS.highlight.dur * ctx.ts;
        ctx.tl.fromTo(ev.el, { "--hf-hl": 0 }, { "--hf-hl": 1, duration: d, ease: "power2.out", immediateRender: false }, ev.t);
        var hold = Number(ev.value);
        if (isFinite(hold) && hold > 0) {
          ctx.tl.to(ev.el, { "--hf-hl": 0, duration: d, ease: "power1.in" }, ev.t + hold);
        }
      },
    },
    strike: {
      apply: function (ctx, ev) {
        ctx.struck.add(ev.el);
        ctx.tl.fromTo(
          ev.el,
          { "--hf-strike": 0, opacity: 1 },
          { "--hf-strike": 1, opacity: 0.55, duration: PRESETS.strike.dur * ctx.ts, ease: "power2.out", immediateRender: false },
          ev.t
        );
      },
    },
    draw: {
      initial: function (ctx, ev) {
        var el = ev.el;
        if (typeof el.getTotalLength === "function") {
          var len = el.getTotalLength() || 1;
          el.style.strokeDasharray = len;
          ctx.tl.set(el, { strokeDashoffset: len }, 0);
        } else {
          ctx.tl.set(el, { scaleX: 0, transformOrigin: "left center" }, 0);
        }
      },
      apply: function (ctx, ev) {
        var el = ev.el;
        var d = PRESETS.draw.dur * ctx.ts;
        if (typeof el.getTotalLength === "function") {
          ctx.tl.to(el, { strokeDashoffset: 0, duration: d, ease: "power1.inOut" }, ev.t);
        } else {
          ctx.tl.to(el, { scaleX: 1, duration: d, ease: "power1.inOut" }, ev.t);
        }
      },
    },
    count: {
      apply: function (ctx, ev) {
        var spec = ev.value && typeof ev.value === "object" ? ev.value : { to: Number(ev.value) };
        var el = ev.el;
        var from = spec.from != null ? Number(spec.from) : parseNumber(ctx.lastText(el));
        var to = Number(spec.to);
        if (!isFinite(from) || !isFinite(to)) return;
        var proxy = { v: from };
        var dur = (spec.dur != null ? Number(spec.dur) : PRESETS.count.dur) * ctx.ts;
        ctx.tl.set(el, { textContent: formatNumber(from, spec) }, ev.t);
        ctx.tl.to(
          proxy,
          {
            v: to,
            duration: dur,
            ease: "power2.out",
            immediateRender: false,
            onUpdate: function () {
              el.textContent = formatNumber(proxy.v, spec);
            },
          },
          ev.t
        );
        ctx.setLastText(el, formatNumber(to, spec));
      },
    },
    type: {
      initial: function (ctx, ev) {
        ctx.tl.set(ev.el, { textContent: "" }, 0);
      },
      apply: function (ctx, ev) {
        var el = ev.el;
        var full = el.getAttribute("data-full-text") || ctx.lastText(el);
        var cps = (ev.value && ev.value.cps) || 40;
        var proxy = { n: 0 };
        var dur = Math.max(0.1, full.length / cps) * ctx.ts;
        ctx.tl.to(
          proxy,
          {
            n: full.length,
            duration: dur,
            ease: "none",
            immediateRender: false,
            onUpdate: function () {
              el.textContent = full.slice(0, Math.round(proxy.n));
            },
          },
          ev.t
        );
      },
    },
    pulse: {
      apply: function (ctx, ev) {
        var d = PRESETS.pulse.dur * ctx.ts;
        ctx.tl.to(ev.el, { scale: 1.06, duration: d / 2, ease: "power1.out" }, ev.t);
        ctx.tl.to(ev.el, { scale: 1, duration: d / 2, ease: "power1.in" }, ev.t + d / 2);
      },
    },
  };

  /**
   * Install an event track on `tl`.
   * @param {object} opts
   *   tl        the component's paused root timeline
   *   root      the component root element (entities are looked up inside it)
   *   events    raw events (array or JSON string)
   *   duration  host duration in authored seconds
   *   timeScale post-render speed factor (default 1)
   *   ops       component-specific ops {name: {initial?, apply, noTarget?}}
   * @returns {{count:number, problems:string[]}}
   */
  // Generic entity styling for highlight/strike, injected once per document. Both are driven by
  // custom properties the timeline tweens (--hf-hl, --hf-strike), so they are seek-reversible and
  // never change layout (outline + background-image only).
  function ensureStyle() {
    if (typeof document === "undefined" || document.getElementById("hf-host-events-style")) return;
    var st = document.createElement("style");
    st.id = "hf-host-events-style";
    // @property with inherits:false is essential: a plain custom property inherits, so
    // highlighting a card would ring every nested entity too (seen in the one-host proof).
    // `html [data-entity]` outranks component-level single-class rules that use the
    // `background` shorthand, which would otherwise wipe the strike gradient.
    st.textContent =
      "@property --hf-hl{syntax:'<number>';inherits:false;initial-value:0}" +
      "@property --hf-strike{syntax:'<number>';inherits:false;initial-value:0}" +
      "html [data-entity]{outline:calc(var(--hf-hl,0)*0.45cqmin) solid var(--hf-hl-color,var(--hf-brand,#6ea8fe));" +
      "outline-offset:calc(var(--hf-hl,0)*0.35cqmin);" +
      "background-image:linear-gradient(var(--hf-strike-color,#ff6e6e),var(--hf-strike-color,#ff6e6e));" +
      "background-size:calc(var(--hf-strike,0)*100%) 0.35cqmin;background-position:0 55%;background-repeat:no-repeat;}";
    document.head.appendChild(st);
  }

  function install(opts) {
    ensureStyle();
    var raw = opts.events;
    if (typeof raw === "string") {
      try {
        raw = JSON.parse(raw);
      } catch (e) {
        return { count: 0, problems: ["events is not valid JSON"] };
      }
    }
    var norm = normalize(raw, opts.root, opts.ops, opts.duration);
    var textState = new Map();
    var ctx = {
      tl: opts.tl,
      root: opts.root,
      ts: opts.timeScale > 0 ? opts.timeScale : 1,
      cq: Math.min(opts.root.clientWidth, opts.root.clientHeight) / 100,
      struck: new Set(),
      // Tracks the text an element will show just before the event being built, so a
      // count/type that follows an update starts from the right value.
      lastText: function (el) {
        return textState.has(el) ? textState.get(el) : el.textContent;
      },
      setLastText: function (el, s) {
        textState.set(el, s);
      },
    };
    // Initial states first (at t=0), once per entity+op, so the first frame is complete.
    var seenInitial = {};
    norm.events.forEach(function (ev) {
      var op = norm.ops[ev.op];
      var key = ev.op + "|" + ev.target;
      if (op.initial && !seenInitial[key]) {
        seenInitial[key] = true;
        op.initial(ctx, ev);
      }
    });
    norm.events.forEach(function (ev) {
      if (ev.op === "update") ctx.setLastText(ev.el, String(ev.value == null ? "" : ev.value));
      norm.ops[ev.op].apply(ctx, ev);
    });
    if (norm.problems.length && global.console) {
      global.console.warn("HFHostEvents: " + norm.problems.join("; "));
    }
    return { count: norm.events.length, problems: norm.problems };
  }

  global.HFHostEvents = { install: install, PRESETS: PRESETS, _normalize: normalize, _format: formatNumber };
})(typeof window !== "undefined" ? window : globalThis);
