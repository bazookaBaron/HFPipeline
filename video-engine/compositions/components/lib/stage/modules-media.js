/*
 * HFStage media window -- real footage / screenshots / photos inside the reel (refs R7/R8,
 * analysis/pacing-audit-20260924/design/R8/AUDIT.md §2): an app-style window, a 40.5 px header
 * (label + status dot), 1.5 px border, r 9, clipped corners, no padding, cover fit, no Ken Burns.
 *
 * kind "image": the <img> lives here (static, seek-safe).
 * kind "video": HyperFrames only plays framework-timed <video> elements from the root
 *   composition, so composeStage.js puts the timed trims in a root media layer exactly over this
 *   window's body (spec.media). This module draws the chrome + the poster frame underneath (so the
 *   body is never black, even on a trim's first frame) + overlays that sit on the header.
 *
 * props {kind, src, poster?, head?, dot?: red|amber|green|none, fit?: cover|contain, focus?: [x%, y%]}
 * ops   head {text}, dot {tone}, highlight {box:[x%,y%,w%,h%], tone?}, unhighlight, shrink {to:"thumb"}
 */
(function (global) {
  "use strict";
  var HF = (global.HFStage = global.HFStage || { modules: {} });
  var M = HF.modules;
  var HEAD = 40.5;

  var CSS = [
    "html .st-media{border:1.5px solid var(--x-2a2d33,#2a2d33);border-radius:9px;overflow:hidden;background:#000;}",
    "html .st-media .md-head{position:absolute;left:0;right:0;top:0;height:39px;background:var(--x-11181e,#11181e);border-bottom:1.5px solid var(--x-1c2229,#1c2229);display:flex;align-items:center;padding:0 14px;gap:10px;font-family:var(--st-mono);font-size:14px;font-weight:600;letter-spacing:.16em;color:var(--x-c9cdd3,#c9cdd3);text-transform:uppercase;white-space:nowrap;}",
    "html .st-media .md-dot{margin-left:auto;width:10px;height:10px;border-radius:50%;background:#c53363;}",
    "html .st-media .md-dot[data-tone=amber]{background:#d9aa46;}html .st-media .md-dot[data-tone=green]{background:#2ad56c;}html .st-media .md-dot[data-tone=none]{display:none;}",
    "html .st-media .md-body{position:absolute;left:0;right:0;top:40.5px;bottom:0;background:#000;overflow:hidden;}",
    "html .st-media .md-body img{position:absolute;left:0;top:0;width:100%;height:100%;object-fit:cover;}",
    "html .st-media .md-hl{position:absolute;border:3px solid var(--st-amber);border-radius:6px;box-shadow:0 0 0 9999px rgba(0,0,0,0);}",
    // light paper skin (LC): ivory title bar with traffic dots look
    "html [data-profile=LC] .st-media{border-color:#bcc3c2;border-radius:16px;box-shadow:0 6px 24px rgba(20,20,10,.07);}",
    "html [data-profile=LC] .st-media .md-head{background:#e6ede9;border-bottom-color:#b9bebd;color:#3a4446;}",
  ].join("\n");

  (function ensureStyle() {
    if (document.getElementById("st-media-style")) return;
    var st = document.createElement("style");
    st.id = "st-media-style";
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

  M.media = {
    enter: "none", // R8: the window hard-cuts in with its scene (1 f)
    build: function (el, p, c) {
      el.classList.add("st-media");
      var head = div("md-head", el);
      var label = c.entity("head", div("md-l", head, p.head || ""));
      var dot = c.entity("dot", div("md-dot", head));
      if (p.dot) dot.setAttribute("data-tone", p.dot);
      if (!p.head && !p.dot) head.style.display = "none";
      var body = c.entity("body", div("md-body", el));
      if (!p.head && !p.dot) body.style.top = "0px";
      var still = p.kind === "image" ? p.src : p.poster;
      if (still) {
        var img = document.createElement("img");
        img.src = still;
        img.alt = "";
        if (p.fit === "contain") img.style.objectFit = "contain";
        if (Array.isArray(p.focus)) img.style.objectPosition = p.focus[0] + "% " + p.focus[1] + "%";
        body.appendChild(img);
      }
      var hls = [];
      return {
        ops: {
          head: function (e) {
            c.tl.set(label, { textContent: (e.value && e.value.text) || "" }, e.t);
          },
          dot: function (e) {
            c.tl.set(dot, { attr: { "data-tone": (e.value && e.value.tone) || "red" } }, e.t);
          },
          // a highlight box over a region of the footage (R7 58.6: 1.5-3 px box drawn in 1 f)
          highlight: function (e) {
            var b = (e.value && e.value.box) || [10, 10, 30, 20];
            var h = div("md-hl", body);
            Object.assign(h.style, { left: b[0] + "%", top: b[1] + "%", width: b[2] + "%", height: b[3] + "%" });
            if (e.value && e.value.tone) h.style.borderColor = HF.tone(e.value.tone) || "";
            c.tl.set(h, { autoAlpha: 0 }, 0);
            c.tl.fromTo(h, { autoAlpha: 0, scale: 1.08 }, { autoAlpha: 1, scale: 1, duration: 0.133, ease: "power2.out", immediateRender: false }, e.t);
            hls.push(h);
          },
          unhighlight: function (e) {
            if (hls.length) c.tl.set(hls[hls.length - 1], { autoAlpha: 0 }, e.t);
          },
          // R8 118.57: shrink to a 0.40x thumbnail anchored at the top-right corner, 433 ms inOut
          // (the root media layer runs the same tween on the footage, see composeStage.js)
          shrink: function (e) {
            var k = (e.value && e.value.scale) || 0.403;
            c.tl.to(el, { scale: k, transformOrigin: "100% 0%", duration: 0.433, ease: "power2.inOut" }, e.t);
          },
        },
      };
    },
  };
  M.media.HEAD = HEAD;
})(typeof window !== "undefined" ? window : globalThis);
