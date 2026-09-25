"use strict";

/**
 * The fixed channel ending (brand.json "endcard"): one extra sentence + one scaffold + word-anchored
 * beats, appended AFTER the topic storyboard is generated/validated. It is never shown to the model,
 * never counted in the topic's LC scene counter / DC chapters, and styled per profile by the
 * `endcard` stage module (video-engine/.../lib/stage/modules-end.js).
 */

const fs = require("fs");
const path = require("path");

const { promoParts, promoTemplate, SENTENCE: PROMO_SENTENCE } = require("./promo");

const BRAND_PATH = path.join(__dirname, "..", "..", "..", "brand.json");
const END_SENTENCE = "s_end";
const RECT = [60, 500, 960, 700];

function loadBrand() {
  return JSON.parse(fs.readFileSync(BRAND_PATH, "utf-8"));
}

function appendEndcard(sb, brand = loadBrand(), promo = null) {
  const ec = brand.endcard || {};
  if (!ec.enabled || sb.sentences.some((s) => s.id === END_SENTENCE)) return sb;
  const out = JSON.parse(JSON.stringify(sb));
  // optional topic-matched vloombox.in promo scene first (lib/video/v3/promo.js)
  if (promo) {
    const pp = promoParts(promo);
    out.sentences.push(pp.sentence);
    out.scaffolds.push(pp.scaffold);
    out.events = (out.events || []).concat(pp.events);
  }
  out.sentences.push({ id: END_SENTENCE, text: ec.spoken });
  out.scaffolds.push({ id: "endcard", template: "endcard", from: END_SENTENCE, slots: { props: { eyebrow: ec.eyebrow, lines: ec.lines, follow: ec.follow, site: ec.site, cta: ec.cta, tags: ec.tags } } });
  out.events = (out.events || []).concat((ec.beats || []).map((b) => ({ sentence: END_SENTENCE, anchor: { text: b.word }, op: "show", target: "endcard", value: { part: b.part } })));
  return out;
}

/** strip the ending (e.g. before a storyboard goes back to the model for repair) */
function stripEndcard(sb) {
  const out = JSON.parse(JSON.stringify(sb));
  out.sentences = out.sentences.filter((s) => s.id !== END_SENTENCE && s.id !== PROMO_SENTENCE);
  out.scaffolds = out.scaffolds.filter((s) => s.template !== "endcard" && s.template !== "promo");
  out.events = (out.events || []).filter((e) => e.sentence !== END_SENTENCE && e.sentence !== PROMO_SENTENCE);
  return out;
}

/** caption words: show the spoken site ("vloom box dot in.") as the written one ("vloombox.in") */
function captionWords(words, brand = loadBrand()) {
  const map = (brand.endcard && brand.endcard.captionAs) || {};
  const out = [];
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    let merged = null;
    if (w.sentenceId === END_SENTENCE || w.sentenceId === PROMO_SENTENCE) {
      for (const [spoken, shown] of Object.entries(map)) {
        const toks = spoken.split(/\s+/);
        const seg = words.slice(i, i + toks.length);
        if (seg.length === toks.length && seg.every((x, k) => x.text.toLowerCase().replace(/[^a-z0-9]/g, "") === toks[k].toLowerCase().replace(/[^a-z0-9]/g, ""))) {
          // keep the last token's trailing punctuation so caption chunks still break at the sentence end
          merged = { ...w, text: shown + (String(seg[seg.length - 1].text).match(/[.,!?;:]+$/) || [""])[0], end: seg[seg.length - 1].end };
          i += toks.length - 1;
          break;
        }
      }
    }
    out.push(merged || w);
  }
  return out;
}

const ENDCARD_TEMPLATES = {
  promo: promoTemplate,
  endcard(sc) {
    return { layout: "title", modules: [{ id: "endcard", type: "endcard", rect: RECT, props: (sc.slots && sc.slots.props) || {} }] };
  },
};

module.exports = { appendEndcard, stripEndcard, captionWords, loadBrand, ENDCARD_TEMPLATES, END_SENTENCE };
