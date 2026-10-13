#!/usr/bin/env node
"use strict";
/* runtime/carousel_lint.js <slides.json>: copy + structure gate for v2 carousels (runtime/CAROUSEL.md).
 * Errors (exit 1): > 7 slides, missing cover/end, overlong headline/body/why, missing image file, paper without link,
 * repo without name, rate carousel where vloombox is not the strictly highest score / not the pick, duplicate images.
 * Warnings: numbers on a slide with no source, body under 15 words (fragments), visual + image on one slide. */
const fs = require("fs");
const path = require("path");

function lint(spec, dir) {
  const E = [], W = [], S = spec.slides || [];
  const words = (t) => String(t || "").replace(/\[\[|\]\]|\*\*/g, "").split(/\s+/).filter(Boolean).length;
  const v2 = S.some((s) => ["point", "paper", "repo", "rate", "board", "takeaway", "end"].includes(s.type));
  if (!v2) return { E, W: ["legacy slides (content/recap): v2 rules skipped"] };
  if (S.length > 7) E.push(`${S.length} slides: max 7`);
  if (S.length < 5) W.push(`${S.length} slides: aim for 6-7`);
  if (!S[0] || S[0].type !== "cover") E.push("slide 1 must be type cover");
  const last = S[S.length - 1] || {};
  if (!(last.type === "end" || (last.type === "board" && last.cta))) E.push("last slide must be type end (or a board with cta)");
  const seen = new Set();
  S.forEach((s, i) => {
    const n = `slide ${i + 1} (${s.type || "content"})`;
    const hw = words(s.title);
    if (hw > (s.type === "cover" ? 14 : 13)) E.push(`${n}: headline ${hw} words (max ${s.type === "cover" ? 14 : 13})`);
    if (["point", "paper", "repo"].includes(s.type)) {
      const bw = words(s.body);
      const max = s.type === "point" && !s.image ? 55 : 30; // image slides: the picture carries it
      if (bw > max) E.push(`${n}: body ${bw} words (max ${max})`);
      else if (bw < 15) W.push(`${n}: body ${bw} words: write sentences, not fragments`);
      if (!s.why) W.push(`${n}: no "why it matters" line`);
    }
    if (s.why && words(s.why) > 22) E.push(`${n}: why ${words(s.why)} words (max 22)`);
    if (s.sub && words(s.sub) > 16) E.push(`${n}: sub ${words(s.sub)} words (max 16)`);
    if (s.visual && s.image) W.push(`${n}: visual + image: pick one`);
    const imgs = [s.image && s.image.src].filter(Boolean);
    for (const im of imgs) {
      if (!/^https?:/.test(im) && !fs.existsSync(path.join(dir, im))) E.push(`${n}: image not found ${im}`);
      if (seen.has(im)) E.push(`${n}: image reused ${im}`); seen.add(im);
      if (!s.image.credit) W.push(`${n}: image without credit`);
    }
    if (s.type === "paper" && !(s.paper && s.paper.link)) E.push(`${n}: paper.link required`);
    if (s.type === "repo" && !(s.repo && s.repo.name)) E.push(`${n}: repo.name required`);
    const txt = [s.title, s.body, s.why].join(" ");
    if (s.type !== "cover" && s.type !== "end" && s.type !== "rate" && s.type !== "board" && /\d[\d,.]*\s?(%|x|×|k|m|b|t\b|million|billion)/i.test(txt) && !s.source && !s.paper && !s.repo)
      W.push(`${n}: number without source`);
  });
  const rated = S.filter((s) => s.type === "rate");
  if (rated.length) {
    const vb = rated.find((s) => /vloombox/i.test(s.name));
    if (!vb) E.push("rate carousel without a vloombox rate slide");
    else {
      if (rated.some((s) => s !== vb && Number(s.score) >= Number(vb.score))) E.push("vloombox must have the strictly highest score");
      if (!vb.pick || rated.some((s) => s !== vb && s.pick)) E.push("vloombox (only) must have pick:true");
      if (rated.indexOf(vb) !== rated.length - 1) W.push("put the vloombox rate slide last (climax)");
    }
    for (const r of rated) if (r.criteria && r.criteria.length) {
      const avg = r.criteria.reduce((a, c) => a + Number(c.score), 0) / r.criteria.length;
      if (Math.abs(avg - Number(r.score)) > 0.1) W.push(`${r.name}: score ${r.score} != criteria average ${avg.toFixed(2)}`);
    } else W.push(`${r.name}: add criteria[] so the score is explained`);
    const b = S.find((s) => s.type === "board");
    if (b) for (const r of b.rows) { const m = rated.find((s) => s.name.toLowerCase() === String(r.name).toLowerCase()); if (m && String(m.score) !== String(r.score)) E.push(`board score for ${r.name} != its rate slide`); }
  }
  return { E, W };
}

module.exports = { lint };
if (require.main === module) {
  const f = process.argv[2]; if (!f) { console.log("usage: node runtime/carousel_lint.js <slides.json>"); process.exit(2); }
  const { E, W } = lint(JSON.parse(fs.readFileSync(f, "utf8")), path.dirname(path.resolve(f)));
  W.forEach((w) => console.log("WARN ", w)); E.forEach((e) => console.log("ERROR", e));
  console.log(E.length ? `lint: ${E.length} error(s)` : "lint: ok"); process.exit(E.length ? 1 : 0);
}
