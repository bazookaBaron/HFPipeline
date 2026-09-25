/*
 * HFStage core -- the v3 "stage" renderer (reference parity, analysis/.../design/SPEC.md).
 *
 * One full-frame (1080x1920) sub-composition renders a whole video's visuals from a compiled
 * spec: background plate, chrome (HUD), mascot and a sequence of SCAFFOLDS, each a set of
 * modules at exact pixel rects. A module id that appears in consecutive scaffolds is the SAME
 * element (the reference "carrier" persists and mutates in place); a rect change between
 * scaffolds is a hard-cut relayout (R2 full-width reframe). Typed events mutate modules at
 * their spoken words.
 *
 *   spec = {
 *     profile: "DH",
 *     scaffolds: [{ id, t0, t1, layout: "column"|"full"|"title",
 *                   modules: [{ id, type, rect:[x,y,w,h], props, enter?, at?, slot?, z? }] }],
 *     events:    [{ t, op, target, value? }],          target = "<moduleId>[.<entity>]"
 *     mascot:    { open, blink } | null
 *   }
 *
 * Every visual change is a tween/set on ONE paused timeline at an explicit time: seeking to
 * any t reconstructs the same frame. No callbacks with side effects, no Date/Math.random, no
 * infinite repeats. Durations below are final-video seconds (the v3 pipeline renders at final
 * speed; there is no post speed-up).
 */
(function (global) {
  "use strict";

  var F = 1 / 30; // one frame

  // Motion recipes measured in the references (SPEC.md section 6; R2 AUDIT E1-E17).
  var RECIPES = {
    none: null,
    fade: { dur: 0.133, y: 0, ease: "power2.out" }, // enter.fade
    rise: { dur: 0.133, y: 4.5, ease: "power2.out" }, // enter.rise (labels, rows) R2 E15
    riseMid: { dur: 0.133, y: 12, ease: "power2.out" },
    settle: { dur: 0.133, y: -7.5, ease: "power2.out", gap: 3 * F }, // top-slot swap R2 E14
    slam: { dur: 0.1, scale: 1.15, ease: "sine.out", from: 0.7 }, // R2 E6: 1.15/1.09/1.02/1.00 per frame, opacity 70%->100%
  };

  var MASCOT = {
    enterDur: 0.367, // R2 E1: 11 f ease-out
    exitDur: 0.3, // R2 E2/E2c: 7-10 f ease-in
    blinkDur: 0.133, // R2: 133 ms
    // Deterministic free-running blink intervals (s); R3/R4 median 4.6-5.0 s, R5 3.2 s.
    blinkGaps: [4.3, 3.7, 5.1, 4.6, 3.9, 4.9, 4.2, 5.3],
  };

  function mk(tag, cls, parent) {
    var el = document.createElement(tag);
    if (cls) el.className = cls;
    if (parent) parent.appendChild(el);
    return el;
  }

  function rectStyle(r) {
    return { left: r[0] + "px", top: r[1] + "px", width: r[2] + "px", height: r[3] + "px" };
  }

  function sameRect(a, b) {
    return a && b && a[0] === b[0] && a[1] === b[1] && a[2] === b[2] && a[3] === b[3];
  }

  /** Collapse scaffold placements into per-module visibility runs. */
  function collectRuns(scaffolds) {
    var mods = {};
    var order = [];
    scaffolds.forEach(function (s, si) {
      (s.modules || []).forEach(function (m, mi) {
        var rec = mods[m.id];
        if (!rec) {
          rec = mods[m.id] = { id: m.id, type: m.type, props: m.props || {}, z: m.z || 0, runs: [] };
          order.push(m.id);
        }
        var last = rec.runs[rec.runs.length - 1];
        var rect = m.rect;
        if (last && Math.abs(last.t1 - s.t0) < 1e-4) {
          last.t1 = s.t1;
          if (!sameRect(last.rects[last.rects.length - 1].rect, rect)) last.rects.push({ t: s.t0, rect: rect, layout: s.layout });
        } else {
          rec.runs.push({
            t0: s.t0 + (m.at || 0),
            cut: s.t0,
            t1: s.t1,
            rects: [{ t: s.t0, rect: rect, layout: s.layout }],
            enter: m.enter,
            slot: m.slot || null,
            exit: m.exit || "cut",
            scaffold: si,
            index: mi,
          });
        }
      });
    });
    return { mods: mods, order: order };
  }

  function build(opts) {
    var root = opts.root;
    var tl = opts.tl;
    var spec = opts.spec || {};
    var duration = opts.duration;
    var registry = global.HFStage.modules;
    var problems = [];
    var scaffolds = (spec.scaffolds || []).slice().sort(function (a, b) {
      return a.t0 - b.t0;
    });

    var bg = mk("div", "st-bg", root);
    var content = mk("div", "st-content", root);
    var mascotLayer = mk("div", "st-mascot-layer", root);
    var chrome = mk("div", "st-chrome", root);
    bg.setAttribute("data-profile", spec.profile || "DH");

    var ctx = {
      tl: tl,
      F: F,
      duration: duration,
      root: root,
      modules: {},
      entities: {},
      recipes: RECIPES,
      problems: problems,
      mk: mk,
    };

    var collected = collectRuns(scaffolds);

    // ---- build every module once ----
    collected.order.forEach(function (id) {
      var rec = collected.mods[id];
      var impl = registry[rec.type];
      if (!impl) {
        problems.push("module '" + id + "': unknown type '" + rec.type + "'");
        return;
      }
      var layer = impl.layer === "chrome" ? chrome : content;
      var el = mk("div", "st-mod st-" + rec.type, layer);
      el.setAttribute("data-module", id);
      el.style.zIndex = String(rec.z || 0);
      var first = rec.runs[0].rects[0].rect;
      Object.assign(el.style, rectStyle(first));
      var mctx = Object.create(ctx);
      mctx.id = id;
      mctx.el = el;
      mctx.entity = function (sub, node) {
        ctx.entities[sub ? id + "." + sub : id] = node;
        node.setAttribute("data-entity", sub ? id + "." + sub : id);
        return node;
      };
      mctx.entity("", el);
      var api = impl.build(el, rec.props, mctx) || {};
      ctx.modules[id] = { id: id, type: rec.type, el: el, api: api, rec: rec, impl: impl };
    });

    // ---- visibility runs, entrances, relayouts, exits ----
    Object.keys(ctx.modules).forEach(function (id) {
      var m = ctx.modules[id];
      var el = m.el;
      tl.set(el, { autoAlpha: 0 }, 0);
      m.rec.runs.forEach(function (run) {
        // A new module entering a slot another module just vacated waits a few blank frames
        // (R2 E14: old out in 1 f, 1-4 blank frames, then the new one fades in).
        var recipeName = run.enter || (m.impl.enter || "fade");
        var recipe = RECIPES[recipeName] !== undefined ? RECIPES[recipeName] : RECIPES.fade;
        var t0 = run.t0 + (recipe && recipe.gap ? recipe.gap : 0);
        run.rects.forEach(function (r, ri) {
          if (ri > 0) tl.set(el, rectStyle(r.rect), r.t);
          if (m.api.place) m.api.place(r.rect, r.t, r.layout, ri === 0);
        });
        if (run.rects.length && m.rec.runs.indexOf(run) > 0) tl.set(el, rectStyle(run.rects[0].rect), run.cut);
        if (m.api.enter && run.enter !== "none") {
          tl.set(el, { autoAlpha: 1 }, t0);
          m.api.enter(t0, recipeName, run);
        } else if (!recipe) {
          tl.set(el, { autoAlpha: 1 }, t0);
        } else {
          var from = { autoAlpha: recipe.from || 0 };
          var to = { autoAlpha: 1, duration: recipe.dur, ease: recipe.ease, immediateRender: false };
          if (recipe.y) {
            from.y = recipe.y;
            to.y = 0;
          }
          if (recipe.scale) {
            from.scale = recipe.scale;
            to.scale = 1;
          }
          tl.fromTo(el, from, to, t0);
        }
        if (run.t1 < duration - 1e-3) {
          var exitKind = run.exit !== "cut" ? run.exit : m.impl.exit || "cut";
          if (m.api.exit && exitKind !== "cut") m.api.exit(run.t1, exitKind);
          else tl.set(el, { autoAlpha: 0 }, run.t1);
        }
      });
    });

    buildMascot(ctx, mascotLayer, spec.mascot, scaffolds);

    // ---- events ----
    var events = (spec.events || []).slice().sort(function (a, b) {
      return a.t - b.t;
    });
    events.forEach(function (ev, i) {
      var target = String(ev.target || "");
      var modId = target.split(".")[0];
      var sub = target.indexOf(".") >= 0 ? target.slice(target.indexOf(".") + 1) : "";
      var m = ctx.modules[modId];
      var t = Math.max(0, Math.min(Number(ev.t) || 0, duration - F));
      var e = { t: t, op: ev.op, target: target, sub: sub, value: ev.value, index: i };
      if (m && m.api.ops && m.api.ops[ev.op]) {
        try {
          m.api.ops[ev.op](e);
        } catch (err) {
          problems.push("event[" + i + "] " + ev.op + " on " + target + ": " + err.message);
        }
        return;
      }
      var gen = GENERIC[ev.op];
      if (!gen) return problems.push("event[" + i + "] unknown op '" + ev.op + "' for " + target);
      var el = ctx.entities[target];
      if (!el && !gen.noTarget) return problems.push("event[" + i + "] target '" + target + "' not found");
      gen.apply(ctx, e, el);
    });

    root.setAttribute("data-stage-modules", String(Object.keys(ctx.modules).length));
    root.setAttribute("data-stage-events", String(events.length));
    if (problems.length) root.setAttribute("data-stage-problems", problems.join(" | "));
    return { problems: problems, ctx: ctx };
  }

  // ---- mascot: slide in on first column scaffold, ease-in exit before full-width, hard-cut
  // re-entry, deterministic blinks (SPEC 4.5) ----
  function buildMascot(ctx, layer, cfg, scaffolds) {
    if (!cfg || !cfg.open) return;
    var tl = ctx.tl;
    var box = cfg.rect || [20, 903, 290, 417]; // placeholder art fitted to the mascot column, feet y 1320
    var wrap = mk("div", "st-mascot", layer);
    Object.assign(wrap.style, rectStyle(box));
    var open = mk("img", "st-mascot-img", wrap);
    open.src = cfg.open;
    var blink = mk("img", "st-mascot-img st-mascot-blink", wrap);
    blink.src = cfg.blink || cfg.open;
    tl.set(wrap, { autoAlpha: 0, x: 0 }, 0);
    tl.set(blink, { autoAlpha: 0 }, 0);

    var shown = false;
    var everShown = false;
    var slideFrom = -(box[0] + box[2]);
    var visibleSpans = [];
    scaffolds.forEach(function (s, i) {
      var want = s.layout === "column";
      if (want && !shown) {
        if (!everShown) {
          tl.fromTo(wrap, { autoAlpha: 1, x: slideFrom }, { x: 0, duration: MASCOT.enterDur, ease: "power2.out", immediateRender: false }, s.t0);
          tl.set(wrap, { autoAlpha: 1 }, s.t0);
        } else {
          tl.set(wrap, { autoAlpha: 1, x: 0 }, s.t0); // R2 E2b: re-entries are hard cuts
        }
        everShown = true;
        shown = true;
        visibleSpans.push([s.t0, s.t1]);
      } else if (want && shown) {
        visibleSpans[visibleSpans.length - 1][1] = s.t1;
      } else if (!want && shown) {
        var start = Math.max(0, s.t0 - MASCOT.exitDur);
        tl.fromTo(wrap, { x: 0 }, { x: slideFrom, duration: s.t0 - start, ease: "power2.in", immediateRender: false }, start);
        tl.set(wrap, { autoAlpha: 0 }, s.t0);
        shown = false;
      }
    });

    // blinks, free-running from the first appearance
    var t = (visibleSpans.length ? visibleSpans[0][0] : 0) + 2.1;
    var k = 0;
    while (t < ctx.duration - MASCOT.blinkDur) {
      tl.set(blink, { autoAlpha: 1 }, t);
      tl.set(open, { autoAlpha: 0 }, t);
      tl.set(blink, { autoAlpha: 0 }, t + MASCOT.blinkDur);
      tl.set(open, { autoAlpha: 1 }, t + MASCOT.blinkDur);
      t += MASCOT.blinkGaps[k++ % MASCOT.blinkGaps.length];
    }

    // punch: scale about the feet (R1 slam beats), requested by events targeting "mascot"
    ctx.modules.mascot = {
      id: "mascot",
      el: wrap,
      api: {
        ops: {
          punch: function (e) {
            var s = e.value && e.value.scale ? e.value.scale : 1.19;
            tl.set(wrap, { transformOrigin: "50% 100%", scale: s }, e.t);
            tl.to(wrap, { scale: 1, duration: 0.3, ease: "power2.out" }, e.t + F);
          },
        },
      },
    };
  }

  // ---- generic ops on any registered entity ----
  function setText(tl, el, text, t) {
    tl.set(el, { textContent: text }, t);
  }

  var GENERIC = {
    reveal: {
      apply: function (ctx, e, el) {
        var r = RECIPES[(e.value && e.value.recipe) || "rise"] || RECIPES.rise;
        ctx.tl.set(el, { autoAlpha: 0 }, 0);
        var from = { autoAlpha: 0 };
        var to = { autoAlpha: 1, duration: r.dur, ease: r.ease, immediateRender: false };
        if (r.y) {
          from.y = r.y;
          to.y = 0;
        }
        if (r.scale) {
          from.scale = r.scale;
          to.scale = 1;
        }
        ctx.tl.fromTo(el, from, to, e.t);
      },
    },
    hide: {
      apply: function (ctx, e, el) {
        ctx.tl.set(el, { autoAlpha: 0 }, 0);
      },
    },
    remove: {
      apply: function (ctx, e, el) {
        ctx.tl.set(el, { autoAlpha: 0 }, e.t);
      },
    },
    text: {
      // one-frame text swap (SPEC state.flip)
      apply: function (ctx, e, el) {
        setText(ctx.tl, el, String(e.value && e.value.text !== undefined ? e.value.text : e.value), e.t);
      },
    },
    tone: {
      // one-frame semantic recolour via data-tone (CSS owns the colours)
      apply: function (ctx, e, el) {
        ctx.tl.set(el, { attr: { "data-tone": String(e.value && e.value.tone ? e.value.tone : e.value) } }, e.t);
      },
    },
    retype: {
      // R2 E16: backspace 1 char/frame, then type 2 chars/frame
      apply: function (ctx, e, el) {
        var from = String((e.value && e.value.from) || el.textContent || "");
        var to = String(e.value && e.value.text !== undefined ? e.value.text : e.value);
        var t = e.t;
        for (var i = from.length - 1; i >= 0; i--) {
          t += F;
          setText(ctx.tl, el, from.slice(0, i), t);
        }
        for (var j = 2; j < to.length + 2; j += 2) {
          t += F;
          setText(ctx.tl, el, to.slice(0, Math.min(j, to.length)), t);
        }
      },
    },
    count: {
      // numeric count on a text entity. value: {to, from?, dur?, decimals?, prefix?, suffix?, ease?}
      apply: function (ctx, e, el) {
        var v = e.value || {};
        var from = v.from !== undefined ? Number(v.from) : parseFloat(String(el.textContent).replace(/[^0-9.\-]/g, "")) || 0;
        var to = Number(v.to);
        var dec = v.decimals || 0;
        var proxy = { v: from };
        var fmt = function (x) {
          var s = dec ? x.toFixed(dec) : String(Math.round(x));
          if (!dec && v.grouping !== false) s = s.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
          return (v.prefix || "") + s + (v.suffix || "");
        };
        ctx.tl.set(el, { textContent: fmt(from) }, e.t);
        ctx.tl.to(
          proxy,
          {
            v: to,
            duration: v.dur || 0.6,
            ease: v.ease || "power2.out",
            immediateRender: false,
            onUpdate: function () {
              el.textContent = fmt(proxy.v);
            },
          },
          e.t
        );
      },
    },
    dim: {
      // SPEC state.dimOthers: value {level?} dims this entity; "undim" restores
      apply: function (ctx, e, el) {
        ctx.tl.to(el, { opacity: (e.value && e.value.level) || 0.45, duration: 0.133, ease: "power2.out" }, e.t);
      },
    },
    undim: {
      apply: function (ctx, e, el) {
        ctx.tl.to(el, { opacity: 1, duration: 0.133, ease: "power2.out" }, e.t);
      },
    },
    strike: {
      // L->R strike line over the entity (R2 E7: 167 ms). value: {tone?}
      apply: function (ctx, e, el) {
        var line = mk("div", "st-strike", el);
        if (e.value && e.value.tone) line.setAttribute("data-tone", e.value.tone);
        ctx.tl.set(line, { scaleX: 0, transformOrigin: "0% 50%" }, 0);
        ctx.tl.to(line, { scaleX: 1, duration: 0.167, ease: "none" }, e.t);
        if (e.value && e.value.dim) ctx.tl.to(el, { opacity: 0.55, duration: 0.133 }, e.t + 0.167);
      },
    },
    slam: {
      apply: function (ctx, e, el) {
        ctx.tl.fromTo(el, { autoAlpha: 0.7, scale: 1.15 }, { autoAlpha: 1, scale: 1, duration: 0.1, ease: "sine.out", immediateRender: false }, e.t);
        ctx.tl.set(el, { autoAlpha: 0 }, 0);
      },
    },
    flash: {
      // R2 140.48: hard on/off 3 frames
      apply: function (ctx, e, el) {
        ctx.tl.set(el, { attr: { "data-flash": "1" } }, e.t);
        ctx.tl.set(el, { attr: { "data-flash": "0" } }, e.t + 3 * F);
      },
    },
    highlight: {
      apply: function (ctx, e, el) {
        ctx.tl.set(el, { attr: { "data-hl": "1" } }, e.t);
        if (e.value && e.value.hold) ctx.tl.set(el, { attr: { "data-hl": "0" } }, e.t + e.value.hold);
      },
    },
    unhighlight: {
      apply: function (ctx, e, el) {
        ctx.tl.set(el, { attr: { "data-hl": "0" } }, e.t);
      },
    },
  };

  global.HFStage = global.HFStage || { modules: {} };
  global.HFStage.build = build;
  global.HFStage.RECIPES = RECIPES;
  global.HFStage.F = F;
  global.HFStage._collectRuns = collectRuns;
})(typeof window !== "undefined" ? window : globalThis);
