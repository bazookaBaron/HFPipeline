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
 *     mascot:    { open, blink, talk2?, glance?, talkSprite?, talk?: [[s,e],...], aspect?, face? } | null
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

  // Scene transitions between content stacks, measured on R6 (design/R6/AUDIT.md §5.5):
  // outgoing cards leave over the mascot (content layer raised), incoming cards enter.
  var TRANS_OUT = {
    pushLeft: { dur: 0.2, ease: "power3.in", stagger: 0.05, to: { x: -900 } },
    dropOut: { dur: 0.233, ease: "power2.in", to: { y: 700 } },
    exitRight: { dur: 0.2, ease: "power2.in", to: { x: 600, autoAlpha: 0 } },
    driftLeft: { dur: 0.267, ease: "power2.out", to: { x: -60, autoAlpha: 0.6 } },
    tumble: {
      dur: 0.233,
      ease: "power2.in",
      stagger: 0.033,
      to: function (k) {
        return { rotation: k % 2 ? 16 : -14, x: -140 - 40 * k, y: 620 };
      },
    },
  };
  var TRANS_IN = {
    riseIn: { dur: 0.333, ease: "power3.out", stagger: 0.033, from: { y: 700 }, to: { y: 0 } },
    slideInRight: { dur: 0.3, ease: "expo.out", stagger: 0.05, from: { x: 540, autoAlpha: 0 }, to: { x: 0, autoAlpha: 1 } },
    cover: { dur: 0.267, ease: "power3.out", from: { x: 1080 }, to: { x: 0 } },
    popRise: { dur: 0.3, ease: "power2.out", stagger: 0.05, from: { y: 28, autoAlpha: 0 }, to: { y: 0, autoAlpha: 1 } },
    afterPush: { dur: 0.3, ease: "power3.out", gap: F, stagger: 0.05, from: { x: 480, autoAlpha: 0 }, to: { x: 0, autoAlpha: 1 } },
  };

  // per-profile entrance overrides (SPEC 6: LC riseFade 22 px / 233 ms, R3 E1)
  var PROFILE_RECIPES = {
    LC: {
      fade: { dur: 0.233, y: 22, ease: "power2.out" },
      rise: { dur: 0.233, y: 22, ease: "power2.out" },
      settle: { dur: 0.233, y: 22, ease: "power2.out" },
      riseMid: { dur: 0.233, y: 22, ease: "power2.out" },
    },
  };
  // per-profile mascot (SPEC 4.5): DH slides + hides on full width; LC never hides, blinks 200 ms
  // every ~4.6-5.0 s and sways (R4: 3.6 s period, ~1.7 px at the head, pivot at the feet)
  var MASCOT_PROFILE = {
    DH: { rect: [20, 903, 290, 417], blinkDur: 0.133, hideOnFull: true, sway: 0 },
    LC: { rect: [36, 969, 260, 374], blinkDur: 0.2, hideOnFull: false, sway: 0.35, swayPeriod: 3.6 },
    // R5: 447x594 flush left at (0,783); blink 100-133 ms on a ~3.2 s loop; hidden on photo cards
    DC: { rect: [0, 783, 447, 594], blinkDur: 0.12, hideOnFull: true, sway: 0, blinkGaps: [3.2, 3.1, 3.3, 3.2, 3.0, 3.4], alignX: 0.25, maxH: 525 }, // presenter clears the stage frame (bottom 840)
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
            // scene transition INTO this scaffold (R6 §5.5): its entrance kind
            tin: s.transition && s.transition["in"] && si > 0 ? s.transition["in"] : null,
          });
        }
      });
    });
    // a run that ends where the next scaffold starts with a transition leaves with its exit kind
    order.forEach(function (id) {
      mods[id].runs.forEach(function (run) {
        var next = scaffolds.find(function (s) {
          return Math.abs(s.t0 - run.t1) < 1e-4;
        });
        run.tout = next && next.transition && next.transition.out ? next.transition.out : null;
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

    var profile = spec.profile || "DH";
    root.setAttribute("data-profile", profile);
    var saved = {};
    Object.keys(RECIPES).forEach(function (k) {
      saved[k] = RECIPES[k];
    });
    var ov = PROFILE_RECIPES[profile] || {};
    Object.keys(ov).forEach(function (k) {
      RECIPES[k] = ov[k];
    });
    global.HFStage.profile = profile;
    applyTheme(profile);
    var bg = mk("div", "st-bg", root);
    var content = mk("div", "st-content", root);
    var mascotLayer = mk("div", "st-mascot-layer", root);
    var chrome = mk("div", "st-chrome", root);
    content.style.zIndex = "1";
    mascotLayer.style.zIndex = "2";
    chrome.style.zIndex = "3";
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
        var TI = run.tin && TRANS_IN[run.tin];
        if (TI && m.impl.layer !== "chrome" && m.type !== "media") {
          // scene transition entrance replaces the element recipe (children may still animate)
          var tt = run.cut + (TI.gap || 0) + (TI.stagger || 0) * (run.index || 0);
          tl.set(el, { autoAlpha: 1 }, tt);
          tl.fromTo(el, TI.from, Object.assign({ duration: TI.dur, ease: TI.ease, immediateRender: false }, TI.to), tt);
          if (m.api.enter && run.enter !== "none") m.api.enter(tt, "none", run);
        } else if (m.api.enter && run.enter !== "none") {
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
          var TO = run.tout && TRANS_OUT[run.tout];
          if (TO && m.impl.layer !== "chrome" && m.type !== "media") {
            // scene transition exit: the whole card moves (over the mascot), then is hidden
            var k = run.index || 0;
            var ts = run.t1 - TO.dur - (TO.stagger || 0) * k;
            tl.to(el, Object.assign({ duration: TO.dur, ease: TO.ease }, typeof TO.to === "function" ? TO.to(k) : TO.to), Math.max(run.t0, ts));
            tl.set(el, { autoAlpha: 0 }, run.t1);
            tl.set(el, { x: 0, y: 0, rotation: 0 }, run.t1 + F);
            tl.set(content, { zIndex: 4 }, Math.max(0, ts));
            tl.set(content, { zIndex: 1 }, run.t1 + 0.4);
          } else if (m.api.exit && exitKind !== "cut") m.api.exit(run.t1, exitKind);
          else tl.set(el, { autoAlpha: 0 }, run.t1);
        }
      });
    });

    buildMascot(ctx, mascotLayer, spec.mascot, scaffolds, MASCOT_PROFILE[profile] || MASCOT_PROFILE.DH);

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

    Object.keys(saved).forEach(function (k) {
      RECIPES[k] = saved[k];
    });
    root.setAttribute("data-stage-modules", String(Object.keys(ctx.modules).length));
    root.setAttribute("data-stage-events", String(events.length));
    if (problems.length) root.setAttribute("data-stage-problems", problems.join(" | "));
    return { problems: problems, ctx: ctx };
  }

  /** profile colour overrides: HF.themes[profile] maps dark hex -> profile hex for --x-<hex> */
  function applyTheme(profile) {
    var map = global.HFStage.themes && global.HFStage.themes[profile];
    var id = "st-theme-" + profile;
    if (!map || document.getElementById(id)) return;
    var decl = Object.keys(map)
      .map(function (k) {
        return "--x-" + k + ":" + map[k] + ";";
      })
      .join("");
    var st = document.createElement("style");
    st.id = id;
    st.textContent = "html [data-profile=" + profile + "]{" + decl + "}";
    document.head.appendChild(st);
  }

  // ---- mascot: slide in on first column scaffold, ease-in exit before full-width, hard-cut
  // re-entry, deterministic blinks (SPEC 4.5) ----
  // Presenter contract: cfg = { open, blink, talk2?, glance?, talkSprite?, talk?: [[start,end],...]
  // (narration word intervals), aspect? (art w/h), face?: { eyes:[x,y,w,h], mouth:[x,y,w,h] }
  // (fractions of the canvas) }. All sprites share one canvas and differ only on the face, so
  // eye states (blink/glance) and mouth states (talk/talk2) are independent clipped overlays
  // over `open`. Legacy art without `face` swaps whole frames (blink only).
  function fitMascotBox(rect, aspect, alignX, maxH) {
    if (!aspect) return rect;
    var h = Math.min(rect[3], maxH || rect[3]);
    var w = h * aspect;
    if (w > rect[2]) {
      w = rect[2];
      h = w / aspect;
    }
    var x = rect[0] + (rect[2] - w) * (alignX === undefined ? 0.5 : alignX);
    return [Math.round(x), Math.round(rect[1] + rect[3] - h), Math.round(w), Math.round(h)]; // feet on the rect bottom
  }

  function faceClip(r) {
    // inset(top right bottom left) from a fractional [x, y, w, h] region
    var pc = function (v) {
      return (Math.max(0, v) * 100).toFixed(2) + "%";
    };
    return "inset(" + pc(r[1]) + " " + pc(1 - r[0] - r[2]) + " " + pc(1 - r[1] - r[3]) + " " + pc(r[0]) + ")";
  }

  /** Mouth flap from word intervals: talk 3 f / talk2 2 f alternating inside a word, closed in
   * the gaps (>= 2 f) and for the last 2 f of a word that runs straight into the next one. */
  function mouthStates(words, duration) {
    var q = function (x) {
      return Math.round(x / F) * F;
    };
    var ws = (words || [])
      .filter(function (w) {
        return w && isFinite(w[0]) && isFinite(w[1]) && w[1] > w[0];
      })
      .map(function (w) {
        return [q(w[0]), q(w[1])];
      })
      .sort(function (a, b) {
        return a[0] - b[0];
      });
    var out = [];
    var closed = true;
    var last = "c";
    ws.forEach(function (w, i) {
      var s = w[0];
      var e = Math.min(w[1], duration);
      var ns = i + 1 < ws.length ? ws[i + 1][0] : Infinity;
      if (e - s < F - 1e-6) return;
      var end = Math.min(e, ns);
      var closeAt = end;
      if (ns - e < 2 * F - 1e-6) closeAt = e - 2 * F >= s + 3 * F - 1e-6 ? e - 2 * F : null; // run-on word
      // a run-on word starts on the other mouth shape so every word onset is a visible change
      var st = closed || last !== "a" ? "a" : "b";
      var t = s;
      var stop = closeAt !== null ? closeAt : end;
      while (t < stop - 1e-6) {
        out.push([t, st]);
        last = st;
        t += st === "a" ? 3 * F : 2 * F;
        st = st === "a" ? "b" : "a";
      }
      if (closeAt !== null) {
        out.push([closeAt, "c"]);
        closed = true;
      } else closed = false;
    });
    return out;
  }

  function buildMascot(ctx, layer, cfg, scaffolds, mp) {
    if (!cfg || !cfg.open) return;
    var tl = ctx.tl;
    var box = fitMascotBox(cfg.rect || mp.rect, cfg.aspect, mp.alignX, mp.maxH);
    var face = cfg.face || null;
    var wrap = mk("div", "st-mascot", layer);
    Object.assign(wrap.style, rectStyle(box));
    function sprite(src, cls, region) {
      var im = mk("img", "st-mascot-img " + cls, wrap);
      im.src = src;
      if (region) im.style.clipPath = faceClip(region);
      tl.set(im, { autoAlpha: 0 }, 0);
      return im;
    }
    var open = mk("img", "st-mascot-img", wrap);
    open.src = cfg.open;
    var talkSrc = typeof cfg.talk === "string" ? cfg.talk : cfg.talkSprite;
    var talkWords = Array.isArray(cfg.talk) ? cfg.talk : cfg.words;
    var talk2 = face && cfg.talk2 ? sprite(cfg.talk2, "st-mascot-talk2", face.mouth) : null;
    var talk = face && talkSrc ? sprite(talkSrc, "st-mascot-talk", face.mouth) : null;
    var glanceImg = face && cfg.glance ? sprite(cfg.glance, "st-mascot-glance", face.eyes) : null;
    var blink = sprite(cfg.blink || cfg.open, "st-mascot-blink", face ? face.eyes : null);
    tl.set(wrap, { autoAlpha: 0, x: 0 }, 0);

    var shown = false;
    var everShown = false;
    var slideFrom = -(box[0] + box[2]);
    var visibleSpans = [];
    scaffolds.forEach(function (s, i) {
      var want = s.layout === "column" || (!mp.hideOnFull && s.layout !== "title");
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
    while (t < ctx.duration - mp.blinkDur) {
      tl.set(blink, { autoAlpha: 1 }, t);
      tl.set(blink, { autoAlpha: 0 }, t + mp.blinkDur);
      var gaps = mp.blinkGaps || MASCOT.blinkGaps;
      t += gaps[k++ % gaps.length];
    }

    // mouth flap on the narration's word intervals (tl.set only: seek-safe)
    if (talk && talkWords && talkWords.length) {
      var cur = "c";
      mouthStates(talkWords, ctx.duration).forEach(function (m) {
        if (m[1] === cur) return;
        cur = m[1];
        tl.set(talk, { autoAlpha: cur === "a" ? 1 : 0 }, m[0]);
        if (talk2) tl.set(talk2, { autoAlpha: cur === "b" ? 1 : 0 }, m[0]);
      });
    }
    var glanceUntil = -1;

    // idle sway (LC-b / R4 only): finite yoyo repeats computed from the duration -- seek-safe
    if (mp.sway && visibleSpans.length) {
      var t0s = visibleSpans[0][0];
      var half = mp.swayPeriod / 2;
      var reps = Math.max(0, Math.floor((ctx.duration - t0s) / half) - 1);
      tl.set(wrap, { transformOrigin: "50% 100%", rotation: -mp.sway / 2 }, t0s);
      tl.to(wrap, { rotation: mp.sway / 2, duration: half, ease: "sine.inOut", repeat: reps, yoyo: true, immediateRender: false }, t0s);
    }

    // punch: scale about the feet (R1 slam beats), requested by events targeting "mascot"
    ctx.modules.mascot = {
      id: "mascot",
      el: wrap,
      api: {
        ops: {
          // R5: head-glance 21-27 px sideways and back, 433 ms ease-in-out, on hero / key-noun beats
          // presenter art: eyes swap to the glance sprite (look up/right at the content);
          // overlapping glances extend the hold instead of cutting it short
          glance: function (e) {
            if (glanceImg) {
              var hold = e.value && e.value.dur ? e.value.dur : 0.6;
              var end = Math.min(ctx.duration, e.t + hold);
              if (end <= glanceUntil) return;
              // overlap: re-show at the instant the previous hold ends (later set wins at a tie)
              tl.set(glanceImg, { autoAlpha: 1 }, e.t <= glanceUntil ? glanceUntil : e.t);
              tl.set(glanceImg, { autoAlpha: 0 }, end);
              glanceUntil = end;
              return;
            }
            var dx = e.value && e.value.dx ? e.value.dx : 24;
            tl.to(wrap, { x: dx, duration: 0.2165, ease: "sine.inOut" }, e.t);
            tl.to(wrap, { x: 0, duration: 0.2165, ease: "sine.inOut" }, e.t + 0.2165);
          },
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

  // ---- profile palettes (SPEC 2.1 dark R1/R2, 2.2 light R3/R4) ----
  var PALETTE = {
    DH: {
      tone: { blue: "#4b9afb", green: "#2ad56c", red: "#ff375c", amber: "#fcba48", purple: "#a77bfb", cyan: "#50dbf2", orange: "#f57201", pink: "#e0457b", white: "#f1f5fd", grey: "#8b9098" },
      tint: { blue: ["#091931", "#29456d"], green: ["#032815", "#225d40"], red: ["#3f0b14", "#893c45"], amber: ["#3b2600", "#513b17"], purple: ["#201336", "#4a3470"], cyan: ["#0a3a49", "#517c8a"], orange: ["#3a1c02", "#6b3a12"], pink: ["#3a0d1f", "#7a2c4b"], grey: ["#0b0f14", "#2a2f35"] },
    },
    // DC (R5): teal = platform/connected, amber = AI/question, pink = entities; no green/red state system
    DC: {
      tone: { blue: "#8fd0e6", green: "#8fd0e6", red: "#c88696", amber: "#eec684", purple: "#c88696", cyan: "#8fd0e6", orange: "#eec684", pink: "#c88696", white: "#ffffff", grey: "#90959c" },
      tint: { blue: ["#0a2632", "#254850"], green: ["#0a2632", "#254850"], red: ["#2a1519", "#513539"], amber: ["#281f12", "#5a4a30"], purple: ["#2a1519", "#513539"], cyan: ["#0a2632", "#2f5c6c"], orange: ["#281f12", "#5a4a30"], pink: ["#2a1519", "#513539"], grey: ["#10141a", "#21252b"] },
    },
    LC: {
      tone: { blue: "#1766da", green: "#187a5b", red: "#b23a3f", amber: "#9a6414", purple: "#6d4ea5", cyan: "#1f6f8b", orange: "#b14b30", pink: "#a33a63", white: "#17232b", grey: "#626667" },
      tint: { blue: ["#e5eef9", "#b9cdeb"], green: ["#ddf2e7", "#a9d3bc"], red: ["#fae4da", "#e3b1a0"], amber: ["#f7f1e7", "#dcc7a0"], purple: ["#eae6f2", "#c6b9dd"], cyan: ["#e0eef3", "#a8cbd8"], orange: ["#fae4da", "#e3b1a0"], pink: ["#f6e3ea", "#ddb3c3"], grey: ["#f1f2ec", "#d2d6d3"] },
    },
  };
  function pal() {
    return PALETTE[global.HFStage.profile] || PALETTE.DH;
  }

  global.HFStage = global.HFStage || { modules: {} };
  global.HFStage.PALETTE = PALETTE;
  // unknown / missing tone -> undefined, so callers keep their own fallback
  global.HFStage.tone = function (name) {
    return pal().tone[name];
  };
  global.HFStage.tint = function (name) {
    return pal().tint[name] || pal().tint.grey;
  };
  // literal colour -> the current profile's equivalent (HF.themes[profile] map), else unchanged
  global.HFStage.col = function (hex) {
    var th = global.HFStage.themes && global.HFStage.themes[global.HFStage.profile];
    var k = String(hex).replace("#", "").toLowerCase();
    if (k.length === 3) k = k[0] + k[0] + k[1] + k[1] + k[2] + k[2];
    return (th && th[k]) || hex;
  };
  global.HFStage.build = build;
  global.HFStage.RECIPES = RECIPES;
  global.HFStage.F = F;
  global.HFStage._collectRuns = collectRuns;
})(typeof window !== "undefined" ? window : globalThis);
