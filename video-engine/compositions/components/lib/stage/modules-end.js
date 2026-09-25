/*
 * HFStage endcard -- the fixed channel ending appended to EVERY video (not part of the topic):
 * "Follow for more daily videos" + the site card. Built from the same measured vocabulary as the
 * cards (headline caps, window/url bar, micro caps) and themed per profile through the --x-* tokens.
 *
 * props {eyebrow, lines:[l1, l2], follow, site, cta}
 * ops   show {part: "follow" | "line2" | "site" | "type" | "click"}
 */
(function (global) {
  "use strict";
  var HF = (global.HFStage = global.HFStage || { modules: {} });
  var M = HF.modules;

  var CSS = [
    "html .st-endcard{display:flex;flex-direction:column;align-items:center;}",
    "html .st-endcard .e-eye{height:30px;font-size:17px;font-weight:700;letter-spacing:.34em;color:var(--x-8b8f95,#8b8f95);text-transform:uppercase;white-space:nowrap;}",
    "html .st-endcard .e-hl{font-weight:800;text-transform:uppercase;letter-spacing:-.03em;line-height:1;white-space:nowrap;color:var(--x-ebeef5,#ebeef5);margin-top:26px;}",
    "html .st-endcard .e-hl.acc{color:var(--st-blue);margin-top:10px;}",
    "html .st-endcard .e-btn{margin-top:44px;height:84px;padding:0 44px 0 34px;border-radius:42px;background:var(--st-blue);display:flex;align-items:center;gap:16px;font-size:36px;font-weight:800;color:#fff;white-space:nowrap;}",
    "html .st-endcard .e-btn .plus{width:38px;height:38px;position:relative;flex:none;}",
    "html .st-endcard .e-btn .plus::before,html .st-endcard .e-btn .plus::after{content:'';position:absolute;background:#fff;border-radius:3px;}",
    "html .st-endcard .e-btn .plus::before{left:16px;top:3px;width:6px;height:32px;}html .st-endcard .e-btn .plus::after{left:3px;top:16px;width:32px;height:6px;}",
    "html .st-endcard .e-site{margin-top:48px;width:860px;height:132px;border-radius:16px;background:var(--x-0a0e13,#0a0e13);border:1.5px solid var(--x-1c2229,#1c2229);position:relative;overflow:hidden;}",
    "html .st-endcard .e-bar{position:absolute;left:0;right:0;top:0;height:44px;display:flex;align-items:center;gap:9px;padding:0 18px;}",
    "html .st-endcard .e-dot{width:12px;height:12px;border-radius:50%;background:var(--x-3a3e44,#3a3e44);}",
    "html .st-endcard .e-url{position:absolute;left:18px;right:18px;top:48px;height:68px;border-radius:12px;background:var(--x-05080b,#05080b);display:flex;align-items:center;padding:0 20px;gap:16px;}",
    "html .st-endcard .e-glob{width:34px;height:34px;flex:none;color:var(--st-blue);}",
    "html .st-endcard .e-txt{font-family:var(--st-mono);font-size:44px;font-weight:700;color:var(--x-e6e9ed,#e6e9ed);white-space:nowrap;}",
    "html .st-endcard .e-caret{width:4px;height:44px;background:var(--st-blue);margin-left:-10px;}",
    "html .st-endcard .e-go{margin-left:auto;height:48px;padding:0 22px;border-radius:24px;background:var(--st-blue);color:#fff;font-size:20px;font-weight:800;letter-spacing:.14em;display:flex;align-items:center;}",
    "html .st-endcard .e-ptr{position:absolute;width:44px;height:52px;pointer-events:none;}",
    "html .st-endcard .e-tags{margin-top:30px;display:flex;gap:14px;}",
    "html .st-endcard .e-tag{height:56px;padding:0 24px;border-radius:28px;border:1.5px solid var(--x-252b33,#252b33);background:var(--x-0a0e13,#0a0e13);display:flex;align-items:center;font-size:24px;font-weight:700;color:var(--x-e6e9ed,#e6e9ed);white-space:nowrap;}",
    "html .st-endcard .e-tag::before{content:'';width:10px;height:10px;border-radius:50%;background:var(--st-green);margin-right:12px;}",
    "html [data-profile=LC] .st-endcard .e-tag{background:#fefcf8;border-color:#bcc3c2;color:#17232b;}",
    // chaptered profile: its accent is a light teal, so button text goes dark (AA contrast)
    "html [data-profile=DC] .st-endcard .e-btn,html [data-profile=DC] .st-endcard .e-go{color:#0b1016;}",
    "html [data-profile=DC] .st-endcard .e-btn .plus::before,html [data-profile=DC] .st-endcard .e-btn .plus::after{background:#0b1016;}",
    // light profile: paper card instead of a dark window
    "html [data-profile=LC] .st-endcard .e-site{background:#fefcf8;border-color:#bcc3c2;box-shadow:0 6px 24px rgba(20,20,10,.07);}",
    "html [data-profile=LC] .st-endcard .e-url{background:#eef1ec;}html [data-profile=LC] .st-endcard .e-txt{color:#17232b;}",
    "html [data-profile=LC] .st-endcard .e-hl{color:#17232b;}html [data-profile=LC] .st-endcard .e-hl.acc{color:var(--st-blue);}",
  ].join("\n");

  (function ensureStyle() {
    if (document.getElementById("st-end-style")) return;
    var st = document.createElement("style");
    st.id = "st-end-style";
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
  function fitSize(txt, size, maxW) {
    var t = String(txt || "").toUpperCase();
    var w = global.HFTextFit ? global.HFTextFit.measure(t, 800, size, "Inter, ui-sans-serif, system-ui, sans-serif") - 0.03 * size * t.length : t.length * 0.68 * size;
    return w > maxW ? Math.floor((size * maxW) / w) : size;
  }

  M.endcard = {
    enter: "none",
    exit: "cut",
    build: function (el, p, c) {
      el.classList.add("st-endcard");
      var W = parseFloat(el.style.width) || 960;
      var lines = p.lines || ["Follow for more", "daily videos"];
      var size = Math.min(fitSize(lines[0], 104, W), fitSize(lines[1], 104, W));
      var eye = c.entity("eyebrow", div("e-eye", el, p.eyebrow || "Thanks for watching"));
      var l1 = c.entity("l1", div("e-hl", el, lines[0]));
      var l2 = c.entity("l2", div("e-hl acc", el, lines[1]));
      l1.style.fontSize = l2.style.fontSize = size + "px";
      var btn = c.entity("follow", div("e-btn", el));
      div("plus", btn);
      div("", btn, p.follow || "Follow");
      var site = c.entity("site", div("e-site", el));
      var bar = div("e-bar", site);
      div("e-dot", bar);
      div("e-dot", bar);
      div("e-dot", bar);
      var url = div("e-url", site);
      var glob = div("e-glob", url);
      glob.innerHTML = '<svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20"/></svg>';
      var siteText = String(p.site || "vloombox.in");
      var txt = c.entity("url", div("e-txt", url, ""));
      var caret = div("e-caret", url);
      var go = c.entity("go", div("e-go", url, p.cta || "VISIT"));
      var tagRow = (p.tags || []).length ? div("e-tags", el) : null;
      var tags = (p.tags || []).map(function (tx, i) {
        return c.entity("tag" + (i + 1), div("e-tag", tagRow, tx));
      });
      var ptr = div("e-ptr", el);
      ptr.innerHTML = '<svg viewBox="0 0 22 26" width="44" height="52"><path d="M2 2 L2 21 L7 16 L11 24 L14.5 22.5 L10.5 14.6 L17.5 14.6 Z" fill="#fff" stroke="#111" stroke-width="1.6" stroke-linejoin="round"/></svg>';
      // pointer rests off to the lower right, then glides onto VISIT
      var siteTop = 30 + 26 + 2 * size + 10 + 44 + 84 + 48; // eyebrow + lines + button + gaps
      var goX = W / 2 + 860 / 2 - 18 - 60;
      var goY = siteTop + 48 + 34;
      Object.assign(ptr.style, { left: goX + 120 + "px", top: goY + 150 + "px" });
      var parts = { eyebrow: eye, l1: l1, l2: l2, follow: btn, site: site };
      Object.keys(parts).forEach(function (k) {
        c.tl.set(parts[k], { autoAlpha: 0 }, 0);
      });
      c.tl.set([ptr, caret], { autoAlpha: 0 }, 0);
      tags.forEach(function (tg) {
        c.tl.set(tg, { autoAlpha: 0 }, 0);
      });
      function rise(elm, t, dy) {
        c.tl.fromTo(elm, { autoAlpha: 0, y: dy || 19.5 }, { autoAlpha: 1, y: 0, duration: 0.133, ease: "power2.out", immediateRender: false }, t);
      }
      return {
        enter: function (t) {
          rise(eye, t, 10);
          rise(l1, t + 0.1, 19.5);
        },
        ops: {
          show: function (e) {
            var part = e.value && e.value.part;
            var t = e.t;
            if (/^tag\d$/.test(part || "")) {
              var tg = tags[Number(part.slice(3)) - 1];
              if (tg) c.tl.fromTo(tg, { autoAlpha: 0, y: 12, scale: 0.94 }, { autoAlpha: 1, y: 0, scale: 1, duration: 0.167, ease: "power2.out", immediateRender: false }, t);
            } else if (part === "line2") rise(l2, t, 24);
            else if (part === "follow") {
              // slam like the hero number (R2 E6): 1.15 -> 1 in 100 ms
              c.tl.fromTo(btn, { autoAlpha: 0.7, scale: 1.15 }, { autoAlpha: 1, scale: 1, duration: 0.1, ease: "sine.out", immediateRender: false }, t);
            } else if (part === "site") {
              // settle (-7.5 px, 3-frame gap recipe)
              c.tl.fromTo(site, { autoAlpha: 0, y: -7.5 }, { autoAlpha: 1, y: 0, duration: 0.133, ease: "power2.out", immediateRender: false }, t);
              c.tl.set(caret, { autoAlpha: 1 }, t);
            } else if (part === "type") {
              // 2 chars / frame, like retype
              var F = c.F || 1 / 30;
              for (var i = 1; i <= siteText.length; i += 2) c.tl.set(txt, { textContent: siteText.slice(0, i + 1) }, t + ((i - 1) / 2) * F);
              c.tl.set(caret, { autoAlpha: 0 }, t + (siteText.length / 2 + 2) * F);
            } else if (part === "click") {
              c.tl.fromTo(ptr, { autoAlpha: 0, x: 0, y: 0 }, { autoAlpha: 1, x: -120, y: -150, duration: 0.35, ease: "power2.inOut", immediateRender: false }, t - 0.35);
              c.tl.fromTo(ptr, { scale: 1 }, { scale: 0.85, duration: 0.08, yoyo: true, repeat: 1, ease: "sine.inOut", immediateRender: false }, t);
              c.tl.fromTo(go, { scale: 1 }, { scale: 0.92, duration: 0.08, yoyo: true, repeat: 1, ease: "sine.inOut", immediateRender: false }, t);
            }
          },
        },
      };
    },
  };
})(typeof window !== "undefined" ? window : globalThis);
