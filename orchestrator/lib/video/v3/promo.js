"use strict";

/**
 * Per-video vloombox.in promo scene (before the follow endcard): one topic-matched sentence + a
 * real screen recording of the site in a full-width media window (our own footage:
 * video-engine/assets/media/vloombox/manifest.json, recorded by tools/record_site.js).
 *
 *   pickPromo(topic, {generate?}) -> {clipId, line, title} (Gemini picks the clip that fits the topic
 *                                     and writes one spoken line; keyword fallback without a model)
 *   promoScaffold(promo) -> {sentence, scaffold, events} appended by endcard.appendEndcard
 */

const fs = require("fs");
const path = require("path");

const VE = path.join(__dirname, "..", "..", "..", "..", "video-engine");
const MANIFEST = path.join(VE, "assets", "media", "vloombox", "manifest.json");
const SENTENCE = "s_promo";

function loadLibrary() {
  if (!fs.existsSync(MANIFEST)) return [];
  const m = JSON.parse(fs.readFileSync(MANIFEST, "utf-8"));
  const list = Array.isArray(m) ? m : m.clips || [];
  return list.filter((c) => c && c.file && fs.existsSync(path.join(path.dirname(MANIFEST), path.basename(c.file))));
}

function rel(c, key) {
  return `assets/media/vloombox/${path.basename(c[key])}`;
}

function keywordPick(topic, lib) {
  const words = String(topic).toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2);
  let best = lib[0];
  let bestScore = -1;
  lib.forEach((c) => {
    const hay = [c.page, c.description, (c.tags || []).join(" "), c.promoLine].join(" ").toLowerCase();
    const score = words.reduce((a, w) => a + (hay.includes(w) ? 1 : 0), 0) + (/jobs|home/.test(c.page || "") ? 0.1 : 0);
    if (score > bestScore) {
      best = c;
      bestScore = score;
    }
  });
  return best;
}

const SPOKEN_SITE = "vloom box dot in";

async function pickPromo(topic, { generate, log = () => {} } = {}) {
  const lib = loadLibrary();
  if (!lib.length) return null;
  let clip = null;
  let line = null;
  let title = null;
  if (generate) {
    try {
      const r = await generate(`A tech explainer short about "${topic}" ends with a 4-5 second plug for our site vloombox.in (live tech job openings refreshed all day, referrals, DSA / LLD / HLD / interview prep, resume optimizer).
Pick the ONE screen recording below that best connects to the topic, and write the spoken line.
RECORDINGS:
${lib.map((c) => `- ${c.id}: ${c.description} (page ${c.page}; tags ${(c.tags || []).join(", ")})`).join("\n")}
Rules for "line": 10-18 words, spoken, one sentence, ties the topic to what the recording shows, must say the site as "${SPOKEN_SITE}", no digits (spell numbers), no URLs.
"title": the window label, caps, <= 26 chars (e.g. "VLOOMBOX.IN · DSA SHEETS").
Answer JSON {"clip": "<id>", "line": "...", "title": "..."}.`);
      clip = lib.find((c) => c.id === (r && r.clip));
      if (clip && r.line && /vloom box dot in/i.test(r.line) && !/\d/.test(r.line) && r.line.split(/\s+/).length <= 22) {
        line = r.line.trim();
        title = String(r.title || "").toUpperCase().slice(0, 28);
      } else clip = null;
    } catch (err) {
      log(`promo pick fell back to keywords: ${err.message}`);
    }
  }
  if (!clip) {
    clip = keywordPick(topic, lib);
    line = clip.promoLine && /vloom box dot in/i.test(clip.promoLine) ? clip.promoLine : `See it for real on ${SPOKEN_SITE}.`;
    title = `VLOOMBOX.IN · ${String(clip.page || "").replace(/^\//, "").toUpperCase() || "JOBS"}`.slice(0, 28);
  }
  return { clipId: clip.id, line, title: title || "VLOOMBOX.IN", src: rel(clip, "file"), poster: clip.poster ? rel(clip, "poster") : undefined, lastFrame: clip.lastFrame ? rel(clip, "lastFrame") : clip.poster ? rel(clip, "poster") : undefined, clipDur: clip.duration, aspect: clip.width && clip.height ? clip.width / clip.height : 16 / 9 };
}

// full-width window, centred between the label and the caption band
function promoTemplate(sc) {
  const p = (sc.slots && sc.slots.promo) || {};
  const w = 960;
  const h = Math.round((w - 3) / (p.aspect || 16 / 9) + 40.5 + 3);
  const y = Math.max(380, Math.round(830 - h / 2));
  return {
    layout: "full",
    modules: [
      { id: "promo_label", type: "micro", rect: [60, y - 58, 960, 26], props: { text: "ON VLOOMBOX.IN", align: "center" } },
      { id: "promo", type: "media", rect: [60, y, w, h], props: { kind: "video", src: p.src, poster: p.poster, lastFrame: p.lastFrame, clipDur: p.clipDur, head: p.title || "VLOOMBOX.IN", dot: "green", aspect: p.aspect } },
    ],
  };
}

function promoParts(promo) {
  return {
    sentence: { id: SENTENCE, text: promo.line },
    scaffold: { id: "promo", template: "promo", from: SENTENCE, slots: { promo } },
    events: [],
  };
}

module.exports = { pickPromo, promoParts, promoTemplate, loadLibrary, SENTENCE };
