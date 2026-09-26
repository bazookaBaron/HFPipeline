"use strict";
// Wikidata entity lookup: name -> QID (wbsearchentities) -> claims (wbgetentities):
// P18 image, P154 logo, P41 flag, P242 locator map, P2716 collage, P373 Commons category.

const API = "https://www.wikidata.org/w/api.php";

const PROPS = { image: "P18", logo: "P154", flag: "P41", locatorMap: "P242", collage: "P2716", commonsCategory: "P373" };

// descriptions that are never the entity a finance video means
const JUNK = /wikimedia (list|disambiguation|category|template)|disambiguation page|family name|given name|scholarly article|tennis tournament|album|single by|song|episode|film|novel|video game|fictional/i;

function words(s) {
  return String(s || "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 2);
}

/** Pick the best search hit: not junk, most overlap between its description and the class/intent hints. */
function pickEntity(hits, { name, classHint, intent } = {}) {
  const hint = new Set([...words(classHint), ...words(intent)]);
  let best = null;
  hits.forEach((h, rank) => {
    const desc = h.description || "";
    if (JUNK.test(desc)) return;
    let score = -rank * 0.5; // search order is a decent prior
    const label = (h.label || (h.display && h.display.label && h.display.label.value) || "").toLowerCase();
    if (name && label === String(name).toLowerCase()) score += 2;
    for (const w of words(desc)) if (hint.has(w)) score += 1.5;
    if (!desc) score -= 1;
    if (!best || score > best.score) best = { id: h.id, label: h.label, description: desc, score };
  });
  return best;
}

function claimValue(entity, prop) {
  const c = entity && entity.claims && entity.claims[prop];
  if (!c || !c.length) return null;
  // prefer "preferred" rank, then first normal
  const sorted = c.slice().sort((a, b) => (b.rank === "preferred") - (a.rank === "preferred"));
  for (const s of sorted) {
    if (s.rank === "deprecated") continue;
    const v = s.mainsnak && s.mainsnak.datavalue && s.mainsnak.datavalue.value;
    if (typeof v === "string") return v;
  }
  return null;
}

function parseEntity(json, qid) {
  const e = json && json.entities && json.entities[qid];
  if (!e) return null;
  const out = { id: qid, label: e.labels && e.labels.en ? e.labels.en.value : qid, description: e.descriptions && e.descriptions.en ? e.descriptions.en.value : "" };
  for (const [k, p] of Object.entries(PROPS)) out[k] = claimValue(e, p);
  return out;
}

async function lookup(http, name, hints = {}) {
  const s = await http.getJson(`${API}?action=wbsearchentities&format=json&language=en&uselang=en&type=item&limit=7&search=${encodeURIComponent(name)}`);
  const pick = pickEntity((s && s.search) || [], { name, ...hints });
  if (!pick) return null;
  const e = await http.getJson(`${API}?action=wbgetentities&format=json&props=labels|descriptions|claims&languages=en&ids=${pick.id}`);
  return parseEntity(e, pick.id);
}

/** Which claim files to try, in order, for a media kind. */
function filesForKind(entity, kind, intentText = "") {
  if (!entity) return [];
  const order = {
    logo: ["logo"], // P18 of an organisation is a photo, never its mark
    map: ["locatorMap", "image"],
    portrait: ["image"],
    photo: ["image", "collage"],
    video: ["image"],
    illustration: [],
  }[kind] || ["image"];
  if (/\bflag\b/i.test(intentText)) order.unshift("flag");
  const seen = new Set();
  return order
    .map((k) => ({ key: k, prop: PROPS[k], file: entity[k] }))
    .filter((x) => x.file && !seen.has(x.file) && seen.add(x.file));
}

module.exports = { lookup, pickEntity, parseEntity, filesForKind, PROPS, API };
