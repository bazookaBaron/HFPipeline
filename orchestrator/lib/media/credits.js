"use strict";
// Credit strings are built from the licence record, never written by the LLM.
// short (on frame, <= 70 chars): "Photo: Jane Doe / Wikimedia Commons · CC BY-SA 4.0"
// full (credits.txt / description): title, author, source page, licence + URL, changes.

const MAX_SHORT = 70;

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", ndash: "–", mdash: "—" };

function decodeEntities(s) {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z]+);/gi, (m, n) => (n.toLowerCase() in ENTITIES ? ENTITIES[n.toLowerCase()] : m));
}

/** Commons `Artist` / `Credit` HTML -> plain text. */
function htmlToText(html) {
  if (!html) return "";
  let s = String(html)
    .replace(/<(br|\/p|\/li|\/div)[^>]*>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return decodeEntities(s).replace(/\s+/g, " ").trim();
}

/** Plain author name suitable for a credit line (cleans Commons boilerplate). */
function cleanAuthor(raw) {
  let s = htmlToText(raw);
  s = s
    .replace(/^((photo(graph)?|author|by|created by|uploaded by|copyright|\(c\)|©)\s*[:\-]?\s*)+/i, "")
    .replace(/\b(own work|self-photographed|unknown author|unknown)\b\.?/gi, "")
    .replace(/\bUser:\s*/gi, "")
    .replace(/\s*\((talk|contribs?)\)\s*/gi, " ")
    .replace(/\s*\|\s*$/, "")
    .replace(/^[\s,;:.\-–]+|[\s,;:\-–]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
  // "Name (https://…)" or trailing URL
  s = s.replace(/\s*\(?https?:\/\/\S+\)?/g, "").trim();
  return s;
}

function truncateAuthor(author, budget) {
  if (author.length <= budget) return author;
  if (budget < 4) return "";
  // prefer cutting at a separator ("A, B and C" -> "A et al.")
  const first = author.split(/\s*(?:,|;| and | & |\/)\s*/)[0];
  if (first && first.length <= budget - 7 && first.length < author.length) return `${first} et al.`;
  const cut = author.slice(0, budget - 1);
  const sp = cut.lastIndexOf(" ");
  return (sp > budget * 0.5 ? cut.slice(0, sp) : cut).replace(/[\s,;:.\-]+$/, "") + "…";
}

const SOURCE_LABEL = {
  commons: "Wikimedia Commons",
  wikidata: "Wikimedia Commons",
  openverse: "Openverse",
  nasa: "NASA",
  illustration: "AI-generated",
  generated: "AI-generated",
};

const KIND_LABEL = { photo: "Photo", portrait: "Photo", logo: "Logo", video: "Video", map: "Map", illustration: "Illustration" };

/**
 * @param {{kind?: string, source: string, author?: string, licence: {label: string, id: string}, provider?: string}} rec
 * provider: Openverse upstream ("flickr", "wikimedia", …) so the line names where it really lives.
 */
function shortCredit(rec) {
  const kindLabel = KIND_LABEL[rec.kind] || "Photo";
  if (rec.source === "illustration") return "Illustration: AI-generated";
  if (rec.source === "generated") return "AI-generated image";
  let src = SOURCE_LABEL[rec.source] || rec.source;
  if (rec.source === "openverse" && rec.provider) src = providerLabel(rec.provider);
  const lic = rec.licence && rec.licence.label ? rec.licence.label : "";
  let author = cleanAuthor(rec.author || "");
  if (rec.source === "nasa") {
    // "Photo: NASA / Carla Thomas · Public domain"
    author = author.replace(/^NASA\s*\/\s*/i, "");
    if (!author || /^nasa$/i.test(author)) return clip(`${kindLabel}: NASA · ${lic}`);
    const fixed = `${kindLabel}: NASA /  · ${lic}`;
    return `${kindLabel}: NASA / ${truncateAuthor(author, MAX_SHORT - fixed.length)} · ${lic}`;
  }
  if (!author) return clip(`${kindLabel}: ${src} · ${lic}`);
  const fixed = `${kindLabel}:  / ${src} · ${lic}`;
  const a = truncateAuthor(author, MAX_SHORT - fixed.length);
  if (!a) return clip(`${kindLabel}: ${src} · ${lic}`);
  return `${kindLabel}: ${a} / ${src} · ${lic}`;
}

function clip(s) {
  return s.length <= MAX_SHORT ? s : s.slice(0, MAX_SHORT - 1) + "…";
}

function providerLabel(p) {
  const m = { flickr: "Flickr", wikimedia: "Wikimedia Commons", smithsonian: "Smithsonian", met: "The Met", nasa: "NASA" };
  return m[String(p).toLowerCase()] || String(p).replace(/(^|_)(\w)/g, (_, a, b) => (a ? " " : "") + b.toUpperCase());
}

/** One line for credits.txt / the description (TASL + changes). */
function fullCredit(rec) {
  if (rec.source === "generated") {
    return `${rec.slot ? `[${rec.slot}] ` : ""}AI-generated image (fal.ai ${rec.model || "image model"}) of a generic scene, made for this video; not a photograph of a real event.`;
  }
  if (rec.source === "illustration") {
    return `${rec.slot ? `[${rec.slot}] ` : ""}Illustration: AI-generated (Gemini ${rec.model || "image model"}) for this video; not a photograph.`;
  }
  const parts = [];
  if (rec.title) parts.push(`"${rec.title}"`);
  const author = cleanAuthor(rec.author || "");
  parts.push(`by ${author || "unknown author"}`);
  let src = SOURCE_LABEL[rec.source] || rec.source;
  if (rec.source === "openverse" && rec.provider) src = `${providerLabel(rec.provider)} (via Openverse)`;
  parts.push(`${src}: ${rec.pageUrl || rec.fileUrl || ""}`.trim());
  const lic = rec.licence || {};
  parts.push(lic.url ? `${lic.label} (${lic.url})` : lic.label || "licence unknown");
  if (lic.id !== "pd" && lic.id !== "cc0") parts.push("cropped/scaled");
  return `${rec.slot ? `[${rec.slot}] ` : ""}${parts.join(" · ")}`;
}

module.exports = { htmlToText, cleanAuthor, shortCredit, fullCredit, truncateAuthor, MAX_SHORT };
