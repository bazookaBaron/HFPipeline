"use strict";
// Licence gate (plan §5, decision D1).
// allow: Public domain / PD-* / PDM / CC0 / CC BY x / CC BY-SA x
// reject: NC, ND, GFDL-only, anything unknown or missing (never guess).

const CC_URL = "https://creativecommons.org/licenses/";

/**
 * @param {string} shortName  e.g. "CC BY-SA 4.0", "Public domain", "GFDL 1.2", "cc0", "by-sa"
 * @param {{url?: string, version?: string, categories?: string[]}} [extra]
 * @returns {{id: string, label: string, allowed: boolean, reason?: string, sa: boolean, attribution: boolean, url: string}}
 */
function normalizeLicense(shortName, extra = {}) {
  let s = String(shortName || "").trim();
  const url = extra.url || "";
  let res = classify(s, extra.version, url);
  // Commons: extmetadata names only one licence of a dual-licensed file ("GFDL 1.2" + CC BY-SA 3.0).
  // The file's licence categories list all of them, so a CC/PD category rescues a GFDL/unknown first pick.
  if (!res.allowed && extra.categories && extra.categories.length && !/\bNC\b|non-?commercial|\bND\b|no-?deriv/i.test(s)) {
    const alt = fromCategories(extra.categories);
    if (alt) return { ...alt, via: "category" };
  }
  return res;
}

function classify(s, version, url) {
  const low = s.toLowerCase().replace(/_/g, " ");
  const urlLow = String(url).toLowerCase();
  const base = { sa: false, attribution: false, url: url || "" };
  if (!low && !urlLow) return { ...base, id: "unknown", label: "unknown", allowed: false, reason: "missing licence" };

  // non-commercial / no-derivatives: hard reject (checked first: "CC BY-NC-SA" contains "BY-SA")
  if (/(^|[\s-])nc([\s-]|$)|non-?commercial/.test(low) || /\/by-nc/.test(urlLow)) {
    return { ...base, id: "nc", label: s || "NC", allowed: false, reason: "non-commercial" };
  }
  if (/(^|[\s-])nd([\s-]|$)|no-?deriv/.test(low) || /-nd\//.test(urlLow)) {
    return { ...base, id: "nd", label: s || "ND", allowed: false, reason: "no-derivatives" };
  }
  // public domain family
  if (/^(cc0|cc-0|cc zero|cc-zero)\b/.test(low) || low === "cc0 1.0" || /publicdomain\/zero/.test(urlLow)) {
    return { ...base, id: "cc0", label: "CC0", allowed: true, url: url || "https://creativecommons.org/publicdomain/zero/1.0/" };
  }
  if (/^(public domain|pd\b|pd-|pdm\b|public domain mark)/.test(low) || /publicdomain\/mark/.test(urlLow)) {
    return { ...base, id: "pd", label: "Public domain", allowed: true };
  }
  // Openverse-style bare codes: by, by-sa, cc0, pdm
  const bare = low.match(/^(by|by-sa)$/);
  if (bare) return cc(bare[1], version, url);
  // "CC BY-SA 4.0", "CC-BY-SA-3.0-DE", "CC BY 2.0", "cc-by-sa-4.0"
  const m = low.match(/^cc[\s-]*(by(?:[\s-]*sa)?)(?:[\s-]*(\d(?:\.\d)?))?(?:[\s-]+([a-z]{2}))?/);
  if (m) return cc(m[1].replace(/\s+/g, "-").replace(/--+/g, "-"), m[2] || version, url, m[3]);
  // licence only in the URL
  const um = urlLow.match(/creativecommons\.org\/licenses\/(by(?:-sa)?)\/(\d\.\d)/);
  if (um && !low) return cc(um[1], um[2], url);
  // Government Open Data License - India: commercial use + adaptation allowed, attribution required
  if (/^godl([\s-]*india)?\b|government open data licen[cs]e/.test(low) || /government-open-data-licen[cs]e|data\.gov\.in\/godl/.test(urlLow)) {
    return { ...base, id: "godl-india", label: "GODL-India", allowed: true, attribution: true, url: url || "https://www.data.gov.in/Godl" };
  }
  if (/gfdl|gnu free documentation/.test(low)) {
    return { ...base, id: "gfdl", label: s, allowed: false, reason: "GFDL-only" };
  }
  return { ...base, id: "unknown", label: s, allowed: false, reason: `unrecognised licence "${s}"` };
}

function cc(code, version, url, port) {
  const sa = /sa/.test(code);
  const v = version ? String(version) : "";
  const label = `CC ${sa ? "BY-SA" : "BY"}${v ? " " + v : ""}`;
  return {
    id: sa ? "cc-by-sa" : "cc-by",
    label,
    version: v,
    port: port || undefined,
    allowed: true,
    sa,
    attribution: true,
    url: url || (v ? `${CC_URL}${sa ? "by-sa" : "by"}/${v}/` : ""),
  };
}

// Commons licence categories: "Category:CC-BY-SA-4.0", "Category:CC-BY-2.0", "Category:CC-Zero", "Category:PD-self", "Category:Public domain"
function fromCategories(cats) {
  const names = cats.map((c) => String(c).replace(/^Category:/, ""));
  let best = null;
  const rank = { cc0: 0, pd: 0, "cc-by": 1, "godl-india": 1, "cc-by-sa": 2 };
  for (const n of names) {
    let r = null;
    let m;
    if (/^CC-Zero$/i.test(n)) r = classify("CC0");
    else if (/^(PD-|Public domain)/i.test(n)) r = classify("Public domain");
    else if (/^GODL-India/i.test(n)) r = classify("GODL-India");
    else if ((m = n.match(/^CC-(BY(?:-SA)?)-(\d\.\d)(?:-([A-Z]{2}))?$/i))) r = cc(m[1].toLowerCase(), m[2], "", m[3] && m[3].toLowerCase());
    if (r && r.allowed && (!best || rank[r.id] < rank[best.id])) best = r;
  }
  return best;
}

module.exports = { normalizeLicense, fromCategories };
