"use strict";

/**
 * data.js -- real data series for LF charts and maps (make-longform stage "data", between research
 * and outline). The research dossier asks for series (`dataAsks: [{metric, country?, years, worldBankIndicator?}]`);
 * this module fetches them from the World Bank Indicators API v2 and writes a per-video data.json:
 *
 *   { version: "data.v1", series: [
 *       { id: "S1", kind: "time", metric, country: "PAK", countryName: "Pakistan", unit: "% of GNI",
 *         indicator: "DT.DOD.DECT.GN.ZS", indicatorName: "External debt stocks (% of GNI)",
 *         source: "World Bank, External debt stocks (% of GNI) (DT.DOD.DECT.GN.ZS)",
 *         sourceUrl: "https://data.worldbank.org/indicator/DT.DOD.DECT.GN.ZS?locations=PK",
 *         licence: "CC BY 4.0", decimals: 1, retrieved: "2026-09-27",
 *         points: [{x: 2010, y: 29.8}, ...] },                     // ascending years, nulls dropped
 *       { id: "S2", kind: "map", metric, country: "all", year: 2023, unit, ..., values: {"PAK": 39.4, ...} } ],
 *     skipped: [{ask, reason}] }
 *
 * Values are rounded deterministically (the API's own `decimal` hint, or by magnitude after a
 * US$ -> billion/trillion rescale). Series ids follow the dataAsks order (time series first, then one
 * cross-country "map" series per distinct indicator), so re-runs are stable.
 * dataFacts() turns every time series into dossier facts D1.. (latest value + peak) that the outline and
 * script may speak (numbers gate); the full series stays in data.json for charts (see DATA.md).
 *
 * Politeness (plan §5): descriptive User-Agent, <= 4 requests/s, exponential backoff on 429/5xx,
 * responses cached 24 h under orchestrator/output/.cache/data. No IMF: the World Bank covers every
 * indicator the research prompt asks for; IMF DataMapper can be added behind the same cache later.
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const WB = "https://api.worldbank.org/v2";
const UA = "HFPipeline-longform/1.0 (finance explainer research; contact debopriyo.debnath1999@gmail.com)";
const TTL_MS = 24 * 3600 * 1000;
const DEFAULT_CACHE = path.join(__dirname, "..", "..", "output", ".cache", "data");
const LICENCE = "CC BY 4.0";

// names the research model tends to write -> ISO3 (the World Bank country list covers the rest)
const COUNTRY_TABLE = {
  india: "IND", pakistan: "PAK", china: "CHN", "people's republic of china": "CHN", prc: "CHN", "sri lanka": "LKA",
  bangladesh: "BGD", nepal: "NPL", bhutan: "BTN", maldives: "MDV", afghanistan: "AFG", myanmar: "MMR", burma: "MMR",
  "united states": "USA", "united states of america": "USA", usa: "USA", us: "USA", america: "USA",
  "united kingdom": "GBR", uk: "GBR", britain: "GBR", "great britain": "GBR", england: "GBR",
  japan: "JPN", germany: "DEU", france: "FRA", italy: "ITA", spain: "ESP", greece: "GRC", russia: "RUS", "russian federation": "RUS",
  turkey: "TUR", turkiye: "TUR", "türkiye": "TUR", egypt: "EGY", "saudi arabia": "SAU", uae: "ARE", "united arab emirates": "ARE",
  iran: "IRN", iraq: "IRQ", israel: "ISR", indonesia: "IDN", malaysia: "MYS", singapore: "SGP", thailand: "THA", vietnam: "VNM", "viet nam": "VNM",
  philippines: "PHL", "south korea": "KOR", korea: "KOR", "north korea": "PRK", taiwan: "TWN", "hong kong": "HKG",
  australia: "AUS", "new zealand": "NZL", canada: "CAN", mexico: "MEX", brazil: "BRA", argentina: "ARG", venezuela: "VEN",
  chile: "CHL", colombia: "COL", peru: "PER", "south africa": "ZAF", nigeria: "NGA", kenya: "KEN", ethiopia: "ETH", ghana: "GHA",
  zambia: "ZMB", ukraine: "UKR", poland: "POL", netherlands: "NLD", switzerland: "CHE", sweden: "SWE", norway: "NOR", ireland: "IRL",
  world: "WLD", "the world": "WLD", global: "WLD",
};

const round = (v, d) => {
  const f = Math.pow(10, d);
  return Math.round(v * f + (v >= 0 ? 1e-9 : -1e-9)) / f;
};
const sha = (s) => crypto.createHash("sha1").update(s).digest("hex").slice(0, 20);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Cached, rate-limited JSON GET. opts: {cacheDir, fetch, now: () => ms, ttlMs, log, offline}
 * The cache file stores {url, fetchedAt, body}; a fresh entry (< ttl) is used without a request.
 */
function makeClient(opts = {}) {
  const cacheDir = opts.cacheDir || DEFAULT_CACHE;
  const doFetch = opts.fetch || ((u, o) => fetch(u, o));
  const now = opts.now || (() => Date.now());
  const ttl = opts.ttlMs === undefined ? TTL_MS : opts.ttlMs;
  const log = opts.log || (() => {});
  const minGap = opts.minGapMs === undefined ? 250 : opts.minGapMs;
  let last = 0;
  async function getJson(url) {
    const file = path.join(cacheDir, `${sha(url)}.json`);
    let cached = null;
    try {
      cached = JSON.parse(fs.readFileSync(file, "utf-8"));
    } catch (_) {}
    if (cached && cached.url === url && (opts.offline || now() - cached.fetchedAt < ttl)) return { body: cached.body, fetchedAt: cached.fetchedAt, cached: true };
    if (opts.offline) throw new Error(`data: offline and no cached response for ${url}`);
    let err;
    for (let attempt = 0; attempt < 4; attempt++) {
      const wait = last + minGap - now();
      if (wait > 0) await sleep(wait);
      last = now();
      try {
        const r = await doFetch(url, { headers: { "User-Agent": UA, Accept: "application/json" }, signal: AbortSignal.timeout(30000) });
        if (r.status === 429 || r.status >= 500) throw Object.assign(new Error(`HTTP ${r.status}`), { retry: true });
        if (!r.ok) throw new Error(`HTTP ${r.status} for ${url}`);
        const body = await r.json();
        const fetchedAt = now();
        fs.mkdirSync(cacheDir, { recursive: true });
        fs.writeFileSync(file, JSON.stringify({ url, fetchedAt, body }));
        return { body, fetchedAt, cached: false };
      } catch (e) {
        err = e;
        if (!e.retry && !/fetch failed|timeout|ECONN|ENOTFOUND|aborted/i.test(String(e.message))) break;
        log(`data: ${e.message} on ${url}; retry ${attempt + 1}`);
        await sleep(minGap * Math.pow(2, attempt + 1));
      }
    }
    if (cached && cached.url === url) {
      log(`data: using a stale cached response for ${url} (${err.message})`);
      return { body: cached.body, fetchedAt: cached.fetchedAt, cached: true, stale: true };
    }
    throw err;
  }
  return { getJson };
}

/** World Bank v2 JSON: [meta, rows] or [{message: [...]}] on error */
function wbRows(body, url) {
  if (!Array.isArray(body)) throw new Error(`data: unexpected World Bank response for ${url}`);
  if (body[0] && body[0].message) throw new Error(`data: World Bank error for ${url}: ${JSON.stringify(body[0].message).slice(0, 200)}`);
  return { meta: body[0] || {}, rows: Array.isArray(body[1]) ? body[1] : [] };
}

async function wbAll(client, url) {
  let page = 1;
  const rows = [];
  let fetchedAt = 0;
  for (;;) {
    const u = `${url}${url.includes("?") ? "&" : "?"}page=${page}`;
    const r = await client.getJson(u);
    const { meta, rows: rs } = wbRows(r.body, u);
    rows.push(...rs);
    fetchedAt = Math.max(fetchedAt, r.fetchedAt || 0);
    if (!meta.pages || page >= meta.pages || page >= 10) break;
    page++;
  }
  return { rows, fetchedAt };
}

/** World Bank country list (id = ISO3, iso2Code, name, region.id "NA" for aggregates) */
async function countryList(client) {
  const { rows } = await wbAll(client, `${WB}/country?format=json&per_page=400`);
  return rows.map((r) => ({ iso3: r.id, iso2: r.iso2Code, name: r.name, aggregate: r.region && r.region.id === "NA" }));
}

/** "Pakistan" / "PAK" / "PK" / null -> ISO3 (null = world) */
function resolveCountry(raw, list) {
  if (raw === null || raw === undefined || raw === "" || /^null$/i.test(String(raw))) return null;
  const s = String(raw).trim();
  const low = s.toLowerCase();
  if (COUNTRY_TABLE[low]) return COUNTRY_TABLE[low];
  if (list) {
    const byIso3 = list.find((c) => c.iso3.toLowerCase() === low);
    if (byIso3) return byIso3.iso3;
    const byIso2 = list.find((c) => c.iso2 && c.iso2.toLowerCase() === low);
    if (byIso2) return byIso2.iso3;
    const byName = list.find((c) => c.name.toLowerCase() === low) || list.find((c) => !c.aggregate && c.name.toLowerCase().startsWith(low));
    if (byName) return byName.iso3;
  }
  if (/^[A-Z]{3}$/.test(s)) return s;
  return undefined; // unknown
}

/** "External debt stocks (% of GNI)" -> {metric: "External debt stocks", unit: "% of GNI"} */
function splitIndicatorName(name) {
  const m = String(name || "").match(/^(.*?)\s*\(([^()]*)\)\s*$/);
  if (m) return { metric: m[1].trim(), unit: m[2].trim() };
  // "Total reserves in months of imports" -> unit "months of imports"
  const k = String(name || "").match(/^(.*?)\s+in\s+((?:months|days|years|weeks|percent|number|units)\b.*)$/i);
  return k ? { metric: k[1].trim(), unit: k[2].trim() } : { metric: String(name || "").trim(), unit: "" };
}

/** deterministic rescale + rounding for a list of raw values */
function scaleFor(unit, values, hint, basis) {
  const abs = values.map((v) => Math.abs(v)).sort((a, b) => a - b);
  // time series scale by their largest value; maps by the median country (so small economies keep digits)
  const max = !abs.length ? 0 : basis === "median" ? abs[Math.floor((abs.length - 1) / 2)] : abs[abs.length - 1];
  let div = 1;
  let u = unit;
  if (/US\$|USD/i.test(unit) || /^current LCU$|LCU/i.test(unit)) {
    const cur = /LCU/i.test(unit) ? "LCU" : "US$";
    const tag = /constant/i.test(unit) ? " (constant)" : "";
    if (max >= 1e12) (div = 1e12), (u = `${cur} trillion${tag}`);
    else if (max >= 1e9) (div = 1e9), (u = `${cur} billion${tag}`);
    else if (max >= 1e6) (div = 1e6), (u = `${cur} million${tag}`);
  }
  const m = max / div;
  const byMag = m >= 1000 ? 0 : m >= 10 ? 1 : 2;
  const decimals = div === 1 && Number.isInteger(hint) && hint >= 0 && hint <= 3 ? hint : byMag;
  return { div, unit: u, decimals };
}

const wbSourceUrl = (code, iso2) => `https://data.worldbank.org/indicator/${code}${iso2 ? `?locations=${iso2}` : ""}`;
const isoDate = (ms) => new Date(ms || 0).toISOString().slice(0, 10);

async function timeSeries(client, ask, iso3, list) {
  const code = ask.worldBankIndicator;
  const [y1, y2] = yearsOf(ask);
  const url = `${WB}/country/${iso3}/indicator/${code}?format=json&date=${y1}:${y2}&per_page=100`;
  const { rows, fetchedAt } = await wbAll(client, url);
  const good = rows.filter((r) => r && r.value !== null && r.value !== undefined && /^\d{4}$/.test(String(r.date)));
  if (!good.length) return { error: `no World Bank values for ${code} / ${iso3} in ${y1}-${y2}` };
  const ind = rows[0].indicator || {};
  const { metric, unit: rawUnit } = splitIndicatorName(ind.value);
  const sc = scaleFor(rawUnit, good.map((r) => Number(r.value)), rows[0].decimal);
  const points = good
    .map((r) => ({ x: Number(r.date), y: round(Number(r.value) / sc.div, sc.decimals) }))
    .sort((a, b) => a.x - b.x);
  const c = (list || []).find((x) => x.iso3 === iso3);
  const iso2 = (c && c.iso2) || (rows[0].country && rows[0].country.id) || "";
  return {
    kind: "time",
    metric: ask.metric || metric,
    indicatorMetric: metric,
    country: iso3,
    countryName: (c && c.name) || (rows[0].country && rows[0].country.value) || iso3,
    unit: sc.unit,
    indicator: code,
    indicatorName: ind.value || code,
    source: `World Bank, ${ind.value || code} (${code})`,
    sourceUrl: wbSourceUrl(code, iso3 === "WLD" ? "1W" : iso2),
    licence: LICENCE,
    decimals: sc.decimals,
    retrieved: isoDate(fetchedAt),
    points,
  };
}

/** one value per country for the latest year with good coverage (>= 60 % of the best year) */
async function mapSeries(client, ask, list) {
  const code = ask.worldBankIndicator;
  const [, y2] = yearsOf(ask);
  const url = `${WB}/country/all/indicator/${code}?format=json&date=${y2 - 5}:${y2}&per_page=2000`;
  const { rows, fetchedAt } = await wbAll(client, url);
  const real = new Set((list || []).filter((c) => !c.aggregate).map((c) => c.iso3));
  const ok = rows.filter((r) => r && r.value !== null && r.value !== undefined && r.countryiso3code && (!real.size || real.has(r.countryiso3code)));
  if (!ok.length) return { error: `no cross-country values for ${code}` };
  const byYear = {};
  ok.forEach((r) => ((byYear[r.date] = byYear[r.date] || []).push(r)));
  const years = Object.keys(byYear).map(Number).sort((a, b) => b - a);
  const best = Math.max(...years.map((y) => byYear[y].length));
  const year = years.find((y) => byYear[y].length >= 0.6 * best);
  const pick = byYear[year].slice().sort((a, b) => (a.countryiso3code < b.countryiso3code ? -1 : 1));
  const ind = pick[0].indicator || {};
  const { metric, unit: rawUnit } = splitIndicatorName(ind.value);
  const sc = scaleFor(rawUnit, pick.map((r) => Number(r.value)), pick[0].decimal, "median");
  const values = {};
  pick.forEach((r) => (values[r.countryiso3code] = round(Number(r.value) / sc.div, sc.decimals)));
  return {
    kind: "map",
    metric: ask.metric || metric,
    indicatorMetric: metric,
    country: "all",
    year,
    unit: sc.unit,
    indicator: code,
    indicatorName: ind.value || code,
    source: `World Bank, ${ind.value || code} (${code}), ${year}`,
    sourceUrl: wbSourceUrl(code),
    licence: LICENCE,
    decimals: sc.decimals,
    retrieved: isoDate(fetchedAt),
    values,
  };
}

function yearsOf(ask) {
  const ys = (ask.years || []).map(Number).filter((y) => y >= 1960 && y <= 2100);
  const y2 = ys.length > 1 ? Math.max(...ys) : ys[0] && ys[0] > 2000 ? ys[0] : new Date().getUTCFullYear();
  const y1 = ys.length > 1 ? Math.min(...ys) : y2 - 20;
  return [y1, Math.max(y1, y2)];
}

/**
 * dossier.dataAsks -> data.json object. opts: {cacheDir, fetch, now, log, offline, maps: true | false | [indicator codes]}
 */
async function buildData(dossier, opts = {}) {
  const log = opts.log || (() => {});
  const client = opts.client || makeClient(opts);
  const asks = (dossier.dataAsks || []).filter((a) => a && a.worldBankIndicator);
  const skipped = (dossier.dataAsks || []).filter((a) => a && !a.worldBankIndicator).map((ask) => ({ ask, reason: "no World Bank indicator (company / non-WDI data)" }));
  const out = { version: "data.v1", series: [], skipped };
  if (!asks.length) return out;
  let list = [];
  try {
    list = await countryList(client);
  } catch (e) {
    log(`data: country list unavailable (${e.message}); using the built-in table only`);
  }
  const seen = new Set();
  let n = 0;
  for (const ask of asks) {
    const iso3 = resolveCountry(ask.country, list);
    if (iso3 === undefined) {
      skipped.push({ ask, reason: `unknown country "${ask.country}"` });
      continue;
    }
    const key = `${ask.worldBankIndicator}|${iso3 || "WLD"}|${yearsOf(ask).join("-")}`;
    if (seen.has(key)) continue;
    seen.add(key);
    try {
      const s = await timeSeries(client, ask, iso3 || "WLD", list);
      if (s.error) skipped.push({ ask, reason: s.error });
      else out.series.push({ id: `S${++n}`, ...s });
    } catch (e) {
      skipped.push({ ask, reason: e.message });
    }
  }
  if (opts.maps !== false) {
    const codes = [];
    asks.forEach((a) => codes.indexOf(a.worldBankIndicator) < 0 && (!Array.isArray(opts.maps) || opts.maps.includes(a.worldBankIndicator)) && codes.push(a.worldBankIndicator));
    for (const code of codes) {
      const ask = asks.find((a) => a.worldBankIndicator === code);
      try {
        const s = await mapSeries(client, ask, list);
        if (s.error) skipped.push({ ask, reason: s.error });
        else out.series.push({ id: `S${++n}`, ...s });
      } catch (e) {
        skipped.push({ ask, reason: `map: ${e.message}` });
      }
    }
  }
  log(`data: ${out.series.length} series (${out.series.filter((s) => s.kind === "time").length} time, ${out.series.filter((s) => s.kind === "map").length} map), ${skipped.length} skipped`);
  return out;
}

function fmt(v, d) {
  return Number(v).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
}
/** 39.4 "% of GNI" -> "39.4% of GNI"; 3.5 "US$ trillion" -> "US$3.50 trillion"; 12 "years" -> "12 years" */
function withUnit(v, unit, d) {
  const n = fmt(v, d);
  const u = String(unit || "");
  if (/^%/.test(u)) return n + u;
  const cur = u.match(/^(US\$|LCU)\s*(.*)$/);
  if (cur) return `${cur[1] === "US$" ? "US$" : ""}${n}${cur[2] ? " " + cur[2] : ""}${cur[1] === "LCU" ? " (local currency)" : ""}`;
  return u ? `${n} ${u}` : n;
}

// "GDP" stays, "External debt stocks" -> "external debt stocks"
const lc = (m) => (/^[A-Z][a-z]/.test(m) ? m.charAt(0).toLowerCase() + m.slice(1) : m);

/** time series -> dossier facts D1..: the latest value, and the peak when it is a different year */
function dataFacts(data) {
  const facts = [];
  let n = 0;
  (data.series || [])
    .filter((s) => s.kind === "time" && s.points && s.points.length)
    .forEach((s) => {
      const src = [{ title: s.source, url: s.sourceUrl }];
      const where = s.country === "WLD" ? "The world's" : `${s.countryName}'s`;
      const last = s.points[s.points.length - 1];
      const mk = (pt, what) => ({
        id: `D${++n}`,
        claim: `${where} ${lc(s.indicatorMetric)} ${what} ${withUnit(pt.y, s.unit, s.decimals)} in ${pt.x} (World Bank).`,
        value: pt.y,
        unit: s.unit,
        year: pt.x,
        sources: src,
        confidence: "high",
        series: s.id,
      });
      facts.push(mk(last, "stood at"));
      const peak = s.points.reduce((a, b) => (b.y > a.y ? b : a), s.points[0]);
      if (peak.x !== last.x) facts.push(mk(peak, `peaked at`));
    });
  return facts;
}

/** idempotent: replaces earlier D* facts and the data summary on the dossier */
function mergeDataFacts(dossier, data) {
  const facts = (dossier.facts || []).filter((f) => !/^D\d+$/.test(String(f.id)));
  const d = { ...dossier, facts: facts.concat(dataFacts(data)) };
  d.dataSeries = (data.series || []).map((s) => ({ id: s.id, kind: s.kind, metric: s.metric, country: s.country, unit: s.unit, ...(s.kind === "time" ? { years: [s.points[0].x, s.points[s.points.length - 1].x] } : { year: s.year }) }));
  const srcs = d.sources || [];
  (data.series || []).forEach((s) => {
    if (!srcs.some((x) => x.url === s.sourceUrl)) srcs.push({ id: `W${srcs.length + 1}`, title: s.source, url: s.sourceUrl });
  });
  d.sources = srcs;
  return d;
}

module.exports = { buildData, dataFacts, withUnit, mergeDataFacts, makeClient, resolveCountry, splitIndicatorName, scaleFor, yearsOf, countryList, COUNTRY_TABLE, DEFAULT_CACHE, UA };
