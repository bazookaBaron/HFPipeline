/* Channel endcard for hand-authored reels (poster theme). Endcard.build(tl, V, W) with W = words incl.
 * line 99 (from append_endcard.py). Returns key times {start, follow, site, click, end} for puppet poses.
 * Needs #cam in the page and theme CSS vars. */
(function () {
  const css = `
#endc{position:absolute;left:70px;top:600px;width:940px;height:640px;visibility:hidden}
#endc .ep{position:absolute;inset:0;background:var(--paper);border:6px solid var(--ink);border-radius:34px;box-shadow:12px 12px 0 var(--shadow)}
#endc .eye{position:absolute;left:0;right:0;top:46px;text-align:center;font-family:Mono,monospace;font-weight:700;font-size:26px;letter-spacing:.3em;visibility:hidden}
#endc .hl{position:absolute;left:0;right:0;text-align:center;font-family:Anton;font-size:104px;line-height:1;visibility:hidden}
#endc .hl b{font-weight:400;background:var(--marker);padding:0 14px}
#endc .fb{position:absolute;left:325px;top:330px;height:84px;padding:0 40px;border-radius:44px;background:var(--ink);color:#fff;font:800 36px Inter;display:flex;align-items:center;gap:14px;visibility:hidden}
#endc .site{position:absolute;left:60px;top:450px;width:820px;height:104px;border:6px solid var(--ink);border-radius:20px;background:#fff;display:flex;align-items:center;padding:0 16px 0 26px;box-sizing:border-box;gap:16px;visibility:hidden}
#endc .url{font-family:Mono,monospace;font-weight:700;font-size:46px}
#endc .go{margin-left:auto;height:62px;padding:0 26px;border-radius:31px;background:var(--alert);color:#fff;font:800 24px Inter;letter-spacing:.14em;display:flex;align-items:center}
#endc .tags{position:absolute;left:0;right:0;top:584px;display:flex;justify-content:center;gap:16px}
#endc .tag{padding:12px 24px;border:5px solid var(--ink);border-radius:30px;background:var(--marker);font:800 28px Inter;visibility:hidden;white-space:nowrap}`;
  const html = `<div id="endc"><div class="ep"></div><div class="eye" id="ec-eye">THANKS FOR WATCHING</div>
<div class="hl" id="ec-l1" style="top:110px">FOLLOW FOR MORE</div><div class="hl" id="ec-l2" style="top:222px"><b>DAILY VIDEOS</b></div>
<div class="fb" id="ec-fb"><span style="font-size:44px;line-height:1">+</span> Follow</div>
<div class="site" id="ec-site"><span style="font-size:40px">🌐</span><span class="url" id="ec-url"></span><span class="go" id="ec-go">VISIT</span></div>
<div class="tags"><span class="tag" id="ec-t1">Daily tech jobs</span><span class="tag" id="ec-t2">Referrals</span><span class="tag" id="ec-t3">Much more</span></div></div>`;
  window.Endcard = {
    build(tl, V, W, o = {}) {
      const st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);
      const host = document.querySelector(o.host || "#cam"); host.insertAdjacentHTML("beforeend", html);
      const E = W.filter((w) => w.line === 99), at = (w, n = 0) => { const m = E.filter((x) => x.w.toLowerCase().replace(/[^a-z.]/g, "") === w); return m[n] ? m[n].s : null; };
      const t0 = E[0].s - 0.25;
      V.drop("#endc", t0, { rot: -4 });
      V.fadeIn("#ec-eye", t0 + 0.15);
      V.slam("#ec-l1", at("follow"), { shake: false });
      V.slam("#ec-l2", at("daily"), { rot: -2 });
      V.pop("#ec-fb", at("videos"));
      V.whip("#ec-site", at("check"), { from: "left" });
      const vb = E.find((x) => x.w === "vloombox.in");
      V.type("#ec-url", vb.s, "vloombox.in", { d: Math.max(0.45, vb.e - vb.s - 0.05) });
      V.click(o.cursor || "#cursor", vb.e + 0.05, 870, 1110, {});
      V.pulse("#ec-go", vb.e + 0.05, { s: 0.9 });
      V.pop("#ec-t1", at("openings"), { rot: -3 }); V.pop("#ec-t2", at("referrals"), { rot: 2 }); V.pop("#ec-t3", at("much"), { rot: -2 });
      return { start: t0, follow: at("follow"), site: at("check"), click: vb.e, end: E[E.length - 1].e };
    },
  };
})();
