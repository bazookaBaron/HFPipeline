"use strict";

/**
 * carousel.v3 -> one stage spec per slide (1080x1350), rendered by the SAME stage renderer and card
 * library as the videos (video-engine/.../lib/stage). Each slide is a single scaffold whose cards
 * are shown in their final state: entrances + any ops fire in the first second, the slide is
 * captured at SHOT_T.
 *
 * carousel.v3:
 *   { version, profile: DH|LC|DC, topic, kicker, slides: [
 *       { id, kind: "cover", eyebrow?, title, subtitle?, visual?: module },
 *       { id, kind: "body",  eyebrow?, tone?, title, subtitle?, modules: [module x1-3], ops?: [{op, target, value}] },
 *       { id, kind: "hero",  eyebrow?, title?, hero: {text, kicker?, tone?}, modules?: [module x0-1] } ] }
 *   module = { id?, type, props, h? }   (types/props/ops from lib/video/v3/catalog.js)
 * A final brand slide (brand.json "carousel") is appended automatically.
 */

const { preferred, fitBlock, place } = require("../video/v3/templates-generic");
const { loadBrand } = require("../video/v3/endcard");

const FRAME = { w: 1080, h: 1350 };
const DUR = 2.0;
const SHOT_T = 1.95;
const X = 60;
const W = 960;
const BAND_BOTTOM = 1196;
const FOOT = [60, 1238, 960, 64];

function titleHeight(t, size, sub) {
  const lines = String(t || "").length * size * 0.56 > W ? 2 : 1;
  return 40 + Math.round(lines * size * 1.08) + (sub ? 16 + (String(sub).length > 52 ? 70 : 36) : 0);
}

function chrome(profile, sb, i, n) {
  const counter = `${String(i + 1).padStart(2, "0")} / ${String(n).padStart(2, "0")}`;
  const brand = loadBrand();
  const handle = (sb.handle || brand.handle || "").trim();
  if (profile === "LC") return [{ id: "lchead", type: "lcHeader", rect: [70, 56, 938, 55], props: { kicker: sb.kicker || "", counter: counter.replace(" / ", " — ") } }];
  if (profile === "DC") return [{ id: "dcchrome", type: "dcChrome", rect: [60, 64, 960, 40], props: { label: sb.kicker || "", index: Math.max(1, Math.min(10, Math.round(((i + 1) / n) * 10))) } }];
  return [{ id: "chead", type: "cHead", rect: [60, 52, 960, 56], props: { handle: handle || (brand.endcard && brand.endcard.site) || "", kicker: "", counter } }];
}

function heroModule(profile, h, y) {
  const p = h || {};
  if (profile === "LC") return { id: "hero", type: "lcDisplay", rect: [X, y, W, 118], props: { text: p.text, tone: p.tone }, h: 118 };
  if (profile === "DC") return { id: "hero", type: "dcHero", rect: [X, y, W, 300], props: { text: p.text, kicker: p.kicker, tone: p.tone }, h: 300 };
  return { id: "hero", type: "hero", rect: [X, y, W, 150], props: { text: p.text, tone: p.tone || "blue", size: 150, align: "center" }, h: 150 };
}

/** stack modules in [y0, BAND_BOTTOM], stretched/shrunk like the video stack, centred */
function stackModules(slide, fills, y0, x = X, w = W) {
  const fl = (fills || []).map((f, k) => ({ ...f, id: f.id || `${slide.id}_m${k + 1}` }));
  const { list, slack } = fitBlock(fl, w, BAND_BOTTOM - y0);
  if (slack < -1) {
    const parts = list.map((f) => `${f.id} (${f.type}) ${Math.round(f.h)} px`).join(", ");
    throw new Error(`slide ${slide.id}: content needs ${Math.round(BAND_BOTTOM - y0 - slack)} px but only ${BAND_BOTTOM - y0} px fit (modules: ${parts}); drop a module or rows`);
  }
  return place({ id: slide.id }, list, x, w, y0 + Math.max(0, Math.round(slack / 2)), "down", "m").mods;
}

function compileSlide(sb, slide, i, n) {
  const profile = sb.profile || "DH";
  const mods = chrome(profile, sb, i, n);
  const events = [];
  const last = i === n - 1;
  if (slide.kind === "end") {
    const brand = loadBrand();
    const c = brand.carousel || {};
    const ec = brand.endcard || {};
    mods.push({ id: "endcard", type: "endcard", rect: [60, 250, 960, 760], props: { eyebrow: c.eyebrow || ec.eyebrow, lines: c.lines || ec.lines, follow: ec.follow, site: ec.site, cta: ec.cta } });
    ["line2", "follow", "site", "type"].forEach((part, k) => events.push({ t: 0.1 + k * 0.12, op: "show", target: "endcard", value: { part } }));
    events.push({ t: 1.0, op: "show", target: "endcard", value: { part: "click" } });
  } else {
    let y = 150;
    const size = slide.kind === "cover" ? 84 : 60;
    const th = titleHeight(slide.title, size, slide.subtitle);
    if (slide.kind === "cover" && profile === "DH") {
      const words = String(slide.title || "").toUpperCase().split(/\s+/);
      const cut = Math.ceil(words.length / 2);
      const lines = [{ text: words.slice(0, cut).join(" ") }, { text: words.slice(cut).join(" "), tone: "blue" }].filter((l) => l.text);
      if (slide.eyebrow) mods.push({ id: "cover_eyebrow", type: "micro", rect: [X, 190, W, 26], props: { text: slide.eyebrow, align: "left" } });
      mods.push({ id: "cover_headline", type: "headline", rect: [X, 236, W, lines.length * 112], props: { lines, size: 96, pitch: 112 } });
      y = 236 + lines.length * 112 + 20;
      if (slide.subtitle) {
        mods.push({ id: "cover_sub", type: "cTitle", rect: [X, y, W, 90], props: { title: "", subtitle: slide.subtitle } });
        y += 100;
      }
    } else if (slide.title || slide.eyebrow) {
      mods.push({ id: `${slide.id}_title`, type: "cTitle", rect: [X, y, W, th], props: { eyebrow: slide.eyebrow, tone: slide.tone, title: slide.title, subtitle: slide.subtitle, size } });
      y += th + 34;
    }
    let body = slide.kind === "cover" ? (slide.visual ? [slide.visual] : []) : slide.modules || [];
    if (slide.kind === "hero") {
      const hm = heroModule(profile, slide.hero, y);
      mods.push(hm);
      y += hm.h + 30;
      if (profile === "DH" && slide.hero && slide.hero.kicker) {
        mods.push({ id: "hero_kicker", type: "micro", rect: [X, y - 10, W, 26], props: { text: slide.hero.kicker, align: "center" } });
        y += 40;
      }
    }
    if (profile === "DC" && body.length) {
      // the chaptered stage frame around the slide's cards (R5 stage)
      mods.push({ id: "dcstage", type: "dcStage", rect: [X, y - 8, W, BAND_BOTTOM - y + 20], props: { sub: "" }, enter: "none" });
      mods.push(...stackModules(slide, body, y + 36, 84, 912));
    } else if (body.length) mods.push(...stackModules(slide, body, y));
    (slide.ops || []).forEach((o, k) => events.push({ t: 0.3 + k * 0.06, op: o.op, target: o.target, value: o.value }));
  }
  const brand = loadBrand();
  const site = (brand.endcard && brand.endcard.site) || "";
  mods.push({ id: "cfoot", type: "cFoot", rect: FOOT, props: last ? { left: sb.handle || brand.handle || "", right: site, arrow: false } : { left: sb.handle || brand.handle || site, right: "SWIPE" } });
  const modules = mods.map((m) => {
    const { h, ...rest } = m;
    return { ...rest, at: 0, enter: m.enter || (m.type === "cHead" || m.type === "cFoot" || m.type === "lcHeader" || m.type === "dcChrome" ? "none" : undefined) };
  });
  return {
    frame: FRAME,
    duration: DUR,
    shotT: SHOT_T,
    spec: { profile, mascot: null, scaffolds: [{ id: slide.id, template: "carousel", t0: 0, t1: DUR, layout: "column", modules }], events },
  };
}

function withEndSlide(sb) {
  if (sb.slides.some((s) => s.kind === "end")) return sb;
  return { ...sb, slides: sb.slides.concat([{ id: "end", kind: "end" }]) };
}

function compileCarousel(sb) {
  const full = withEndSlide(sb);
  return full.slides.map((s, i) => ({ id: s.id || `s${i + 1}`, kind: s.kind, ...compileSlide(full, { ...s, id: s.id || `s${i + 1}` }, i, full.slides.length) }));
}

module.exports = { compileCarousel, FRAME, SHOT_T, preferred };
