"use strict";

/**
 * Source quality tiers for the research dossier (finance channel: numbers must rest on reputable
 * sources). Grounded search happily returns forums, slide dumps and blogs; those may support
 * colour but never a figure on their own, and they never appear in the video description.
 *
 *   official  - governments, central banks, regulators, multilaterals, stock exchanges, filings
 *   press     - established news / business press
 *   reference - encyclopaedias, academic hosts, universities
 *   other     - unknown sites (kept, ranked last)
 *   ugc       - user-generated / document dumps / social: never the only support for a fact
 */

const OFFICIAL = [
  /\.gov(\.[a-z]{2})?$/, /\.gov\.in$/, /\.nic\.in$/, /\.gov\.pk$/, /(^|\.)europa\.eu$/, /(^|\.)ecb\.europa\.eu$/,
  /(^|\.)rbi\.org\.in$/, /(^|\.)sebi\.gov\.in$/, /(^|\.)sbp\.org\.pk$/, /(^|\.)imf\.org$/, /(^|\.)worldbank\.org$/,
  /(^|\.)oecd\.org$/, /(^|\.)un\.org$/, /(^|\.)bis\.org$/, /(^|\.)federalreserve\.gov$/, /(^|\.)bseindia\.com$/,
  /(^|\.)nseindia\.com$/, /(^|\.)sec\.gov$/, /(^|\.)mca\.gov\.in$/, /(^|\.)pib\.gov\.in$/, /(^|\.)amul\.com$/,
];
const PRESS = [
  "reuters.com", "bloomberg.com", "ft.com", "wsj.com", "economist.com", "bbc.com", "bbc.co.uk", "cnbc.com", "nytimes.com",
  "theguardian.com", "apnews.com", "forbes.com", "fortune.com", "thehindu.com", "thehindubusinessline.com", "livemint.com",
  "business-standard.com", "economictimes.indiatimes.com", "timesofindia.indiatimes.com", "indiatimes.com", "hindustantimes.com",
  "moneycontrol.com", "ndtv.com", "ndtvprofit.com", "indianexpress.com", "financialexpress.com", "thewire.in", "scroll.in",
  "theprint.in", "businesstoday.in", "indiatoday.in", "dawn.com", "tribune.com.pk", "thenews.com.pk", "aljazeera.com",
  "dw.com", "politico.eu", "cnn.com", "washingtonpost.com", "npr.org", "caravanmagazine.in", "fortuneindia.com",
];
const REFERENCE = [/(^|\.)wikipedia\.org$/, /(^|\.)britannica\.com$/, /\.edu$/, /\.ac\.[a-z]{2}$/, /(^|\.)jstor\.org$/, /(^|\.)ssrn\.com$/, /(^|\.)nber\.org$/, /(^|\.)brookings\.edu$/, /(^|\.)researchgate\.net$/];
const UGC = [
  "quora.com", "medium.com", "slideshare.net", "scribd.com", "reddit.com", "youtube.com", "facebook.com", "instagram.com",
  "linkedin.com", "x.com", "twitter.com", "blogspot.com", "wordpress.com", "studocu.com", "coursehero.com", "brainly.in",
  "pinterest.com", "tumblr.com", "substack.com", "cloudfront.net", "prezi.com", "issuu.com", "academia.edu",
];

const RANK = { official: 0, press: 1, reference: 2, other: 3, ugc: 4 };

function hostOf(url) {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch (_) {
    return "";
  }
}

const endsWith = (host, d) => host === d || host.endsWith("." + d);

/** Tier of a source URL (title is a fallback when the grounding link was not resolved). */
function tierOf(url, title = "") {
  const host = hostOf(url) || String(title).toLowerCase().replace(/^www\./, "");
  if (!host) return "other";
  if (UGC.some((d) => endsWith(host, d))) return "ugc";
  if (OFFICIAL.some((re) => re.test(host))) return "official";
  if (PRESS.some((d) => endsWith(host, d))) return "press";
  if (REFERENCE.some((re) => re.test(host))) return "reference";
  return "other";
}

function rank(s) {
  return RANK[tierOf(s.url, s.title)];
}

/**
 * Apply the policy to one fact's sources. Returns the kept (non-UGC, best first) sources and
 * whether the fact survives: a figure needs at least one non-UGC source; a qualitative claim
 * backed only by UGC survives with confidence forced to "low".
 */
function vetFactSources(sources, hasValue) {
  const sorted = [...sources].sort((a, b) => rank(a) - rank(b));
  const kept = sorted.filter((s) => tierOf(s.url, s.title) !== "ugc");
  if (kept.length) return { keep: true, sources: kept, ugcOnly: false };
  if (hasValue) return { keep: false, sources: [], ugcOnly: true };
  return { keep: true, sources: sorted, ugcOnly: true };
}

module.exports = { tierOf, vetFactSources, rank, hostOf };
