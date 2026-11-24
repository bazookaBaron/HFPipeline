// YouTube opportunity scoring for the channel radar: demand x competition-gap x evergreen/growth (each 0-10).
// Any source that fails or is blocked gives null for that sub-score (never an invented number) and lowers confidence.
// Responses are cached under runtime/topics/cache/. Rate limits and robots.txt come from net.mjs.
import { readFileSync, writeFileSync, existsSync, statSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getText, getJSON, qs, stats } from './net.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
export const CACHE = join(HERE, '..', 'cache');
const VIDIQ_DIR = join(HERE, '..', 'vidiq');
const clamp = (v, lo = 0, hi = 10) => Math.max(lo, Math.min(hi, v));
const r1 = (v) => (v == null ? null : Math.round(v * 10) / 10);
const median = (a) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);

// Source health, reported in radar.md / radar.json.
export const health = { ytApi: { units: 0, budget: 4000, searches: 0, cached: 0, stopped: null, note: '' }, ytSearch: { ok: 0, fail: 0, note: '' }, autocomplete: { ok: 0, fail: 0 }, pageviews: { ok: 0, fail: 0 }, vidiq: { file: null, matched: 0 } };

// ---------- phrases ----------
export function phrasesFor(channelKey, entity) {
  const E = entity.replace(/\s*\(.*\)$/, '');
  return channelKey === 'powder'
    ? [`${E} explained`, `how ${E} collapsed`, `${E} fraud documentary`]
    : [`${E} explained`, `why ${E} matters`, `${E} trade economics`];
}

// ---------- vidIQ export (optional, offline) ----------
const LEVEL = { 'very low': 10, low: 30, medium: 50, moderate: 50, high: 70, 'very high': 90 };
function num(v) { if (v == null || v === '') return null; const s = String(v).trim().toLowerCase(); if (LEVEL[s] != null) return LEVEL[s]; const n = Number(s.replace(/[, %]/g, '')); return Number.isFinite(n) ? n : null; }
function csvRows(txt) {
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < txt.length; i++) {
    const c = txt[i];
    if (q) { if (c === '"') { if (txt[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
    else if (c === '"') q = true; else if (c === ',') { row.push(cell); cell = ''; } else if (c === '\n' || c === '\r') { if (c === '\r' && txt[i + 1] === '\n') i++; row.push(cell); cell = ''; if (row.some((x) => x.trim())) rows.push(row); row = []; } else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}
export function loadVidiq(channelKey) {
  for (const ext of ['json', 'csv']) {
    const f = join(VIDIQ_DIR, `${channelKey}.${ext}`);
    if (!existsSync(f)) continue;
    try {
      const txt = readFileSync(f, 'utf8').replace(/^﻿/, '');
      let list;
      if (ext === 'json') list = JSON.parse(txt);
      else { const [head, ...body] = csvRows(txt); const h = head.map((x) => x.trim().toLowerCase()); list = body.map((r) => Object.fromEntries(h.map((k, i) => [k, r[i]]))); }
      const pick = (o, names) => { for (const n of names) if (o[n] != null && o[n] !== '') return o[n]; return null; };
      const rows = list.map((o) => { const l = Object.fromEntries(Object.entries(o).map(([k, v]) => [k.trim().toLowerCase(), v]));
        return { keyword: String(pick(l, ['keyword', 'keywords', 'search term']) || '').trim().toLowerCase(), volume: num(pick(l, ['search volume', 'volume', 'searchvolume'])), competition: num(pick(l, ['competition', 'competition score'])), overall: num(pick(l, ['overall', 'overall score', 'score'])) }; }).filter((r) => r.keyword);
      health.vidiq.file = f;
      return rows;
    } catch (e) { health.vidiq.file = `${f} (unreadable: ${e.message})`; return []; }
  }
  return [];
}
function vidiqMatch(rows, phrases, entity) {
  if (!rows.length) return null;
  const e = entity.toLowerCase(), ps = phrases.map((p) => p.toLowerCase());
  const hit = rows.filter((r) => ps.includes(r.keyword) || ps.some((p) => p.includes(r.keyword) && r.keyword.length > 3) || (r.keyword.includes(e) && e.length > 3));
  if (!hit.length) return null;
  return hit.sort((a, b) => (b.volume || 0) - (a.volume || 0))[0];
}
const volScore = (v) => (v == null ? null : v <= 100 ? clamp(v / 10) : clamp((Math.log10(v / 100) / 3) * 10)); // 0-100 index, or absolute monthly searches
const compGap = (c) => (c == null ? null : clamp(10 - (c <= 100 ? c / 10 : 10)));

// ---------- autocomplete depth ----------
async function autocomplete(q) {
  const url = `https://suggestqueries.google.com/complete/search?${qs({ client: 'youtube', ds: 'yt', q })}`;
  const txt = await getText(url, { ttlH: 24, quiet: true, cacheDir: CACHE });
  if (!txt) { health.autocomplete.fail++; return null; }
  let arr = [];
  try { const body = txt.slice(txt.indexOf('(') + 1, txt.lastIndexOf(')')); arr = (JSON.parse(body)[1] || []).map((x) => (Array.isArray(x) ? x[0] : x)); } catch { health.autocomplete.fail++; return null; }
  health.autocomplete.ok++;
  return arr.filter((x) => typeof x === 'string');
}

// ---------- YouTube search results page (opt-in: robots.txt disallows /results for generic agents) ----------
const AGE_UNIT = { second: 1 / 86400, minute: 1 / 1440, hour: 1 / 24, day: 1, week: 7, month: 30.4, year: 365 };
const ageDays = (t) => { const m = /(\d+)\s+(second|minute|hour|day|week|month|year)/i.exec(t || ''); return m ? Number(m[1]) * AGE_UNIT[m[2].toLowerCase()] : null; };
const viewsOf = (t) => { const m = /([\d,.]+)\s*([KMB])?\s+views?/i.exec(t || ''); if (!m) return null; return Number(m[1].replace(/,/g, '')) * ({ K: 1e3, M: 1e6, B: 1e9 }[(m[2] || '').toUpperCase()] || 1); };
const lenMin = (t) => { const p = (t || '').split(':').map(Number); if (p.some((x) => !Number.isFinite(x))) return null; return p.length === 3 ? p[0] * 60 + p[1] + p[2] / 60 : p[0] + (p[1] || 0) / 60; };
function walk(o, f) { if (Array.isArray(o)) o.forEach((x) => walk(x, f)); else if (o && typeof o === 'object') { if (o.videoRenderer) f(o.videoRenderer); for (const v of Object.values(o)) walk(v, f); } }
export async function ytSearch(phrase, { override }) {
  const url = `https://www.youtube.com/results?${qs({ search_query: phrase })}`;
  const html = await getText(url, { ttlH: 12, quiet: true, cacheDir: CACHE, override });
  if (!html) { health.ytSearch.fail++; health.ytSearch.note = override ? 'request failed' : 'blocked: youtube.com/robots.txt disallows /results for generic agents (opt in with --yt-search)'; return null; }
  const m = html.match(/var ytInitialData\s*=\s*(\{[\s\S]*?\});\s*<\/script>/);
  if (!m) { health.ytSearch.fail++; health.ytSearch.note = 'results page had no ytInitialData (consent wall or changed layout)'; return null; }
  let data; try { data = JSON.parse(m[1]); } catch { health.ytSearch.fail++; return null; }
  const out = [];
  walk(data, (v) => out.push({ title: v.title?.runs?.[0]?.text || '', views: viewsOf(v.viewCountText?.simpleText), age: v.publishedTimeText?.simpleText || '', ageDays: ageDays(v.publishedTimeText?.simpleText), minutes: lenMin(v.lengthText?.simpleText), channel: v.ownerText?.runs?.[0]?.text || '', subs: null }));
  health.ytSearch.ok++;
  return out.slice(0, 20);
}
function fromSearch(results, entity) {
  const e = entity.toLowerCase().split(/\s+/)[0];
  const vpd = results.filter((r) => r.views != null && r.ageDays > 1).map((r) => r.views / r.ageDays);
  const recentStrong = results.filter((r) => r.ageDays != null && r.ageDays < 365 && (r.views || 0) > 1e5).length;
  const sameAngleLong = results.filter((r) => (r.minutes || 0) >= 8 && r.title.toLowerCase().includes(e)).length;
  const med = median(vpd);
  return { demand: med == null ? null : clamp((Math.log10(Math.max(med, 1) / 50) / Math.log10(20000 / 50)) * 10), medianViewsPerDay: med == null ? null : Math.round(med), gap: clamp(10 - recentStrong * 0.9 - sameAngleLong * 0.4), recentStrong, sameAngleLong,
    top: results.slice(0, 5).map((r) => `${r.title.slice(0, 60)} | ${r.views ?? '?'} views | ${r.age || '?'}${r.channel ? ' | ' + r.channel : ''}`) };
}

// ---------- Wikipedia pageviews: durable baseline + trend ----------
export async function pageviewSeries(article) {
  const now = new Date(); const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)); end.setUTCMonth(end.getUTCMonth() - 1); // last full month
  const start = new Date(end); start.setUTCMonth(start.getUTCMonth() - 23);
  const f = (d) => `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}0100`;
  const url = `https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia/all-access/user/${encodeURIComponent(article.replace(/ /g, '_'))}/monthly/${f(start)}/${f(end)}`;
  const j = await getJSON(url, { ttlH: 72, quiet: true, cacheDir: CACHE });
  const v = (j?.items || []).map((i) => i.views);
  if (v.length < 12) { health.pageviews.fail++; return null; }
  health.pageviews.ok++;
  return v;
}
function evergreenFrom(v) {
  const med = median(v), last6 = mean(v.slice(-6)), prior = v.slice(0, -6).slice(-12), prior12 = mean(prior), mx = Math.max(...v);
  const ratio = prior12 ? last6 / prior12 : null, spike = med ? mx / med : null;
  const base = clamp((Math.log10(Math.max(med, 1) / 1000) / Math.log10(300)) * 10);     // 1k views/month = 0, 300k = 10
  const trend = ratio == null ? 5 : clamp(5 + 5 * Math.log2(Math.max(ratio, 0.05)) / 1.5); // flat = 5, x1.5 = ~8, x0.5 = ~0
  let score = 0.65 * base + 0.35 * trend;
  if (spike > 6) score *= 0.7; // one-off spike with no durable baseline
  return { score: clamp(score), medianMonthly: Math.round(med), last6Mean: Math.round(last6), prior12Mean: Math.round(prior12 || 0), trendRatio: ratio == null ? null : Math.round(ratio * 100) / 100, maxOverMedian: Math.round(spike * 10) / 10, baseScore: r1(base), trendScore: r1(trend), spikePenalty: spike > 6, months: v.length };
}


// ---------- YouTube Data API v3 (key from .vendor-assets/.env, never printed, logged or written to disk) ----------
const ENV_FILE = join(HERE, '..', '..', '..', '.vendor-assets', '.env');
let API_KEY;
function apiKey() {
  if (API_KEY !== undefined) return API_KEY;
  API_KEY = null;
  try { const m = /^YOUTUBE_API_KEY=(.*)$/m.exec(readFileSync(ENV_FILE, 'utf8')); if (m) API_KEY = m[1].trim().replace(/^["']|["']$/g, '') || null; } catch { /* no env file */ }
  return API_KEY;
}
export function configureApi({ budget }) { if (budget != null) health.ytApi.budget = budget; }
export const apiAvailable = () => !!apiKey(); // cache still serves after a stop; only network calls are refused
const COST = { search: 100, videos: 1, channels: 1 };
let lastApi = 0;
// The cache key and every message use the URL WITHOUT the key.
async function apiGet(endpoint, params) {
  const key = apiKey();
  if (!key) return null;
  const clean = `https://www.googleapis.com/youtube/v3/${endpoint}?${qs(params)}`;
  mkdirSync(CACHE, { recursive: true });
  const f = join(CACHE, 'ytapi-' + createHash('sha1').update(clean).digest('hex') + '.json');
  if (existsSync(f) && (Date.now() - statSync(f).mtimeMs) / 3.6e6 < 24 * 7) { health.ytApi.cached++; try { return JSON.parse(readFileSync(f, 'utf8')); } catch { /* fall through */ } }
  if (health.ytApi.stopped) return null;
  if (health.ytApi.units + COST[endpoint] > health.ytApi.budget) { health.ytApi.stopped = `unit budget ${health.ytApi.budget} reached`; return null; }
  const wait = lastApi + 300 - Date.now(); if (wait > 0) await new Promise((r) => setTimeout(r, wait)); lastApi = Date.now();
  let res, j;
  try { res = await fetch(`${clean}&key=${encodeURIComponent(key)}`, { headers: { 'user-agent': 'TopicRadar/0.1 (research script)' }, signal: AbortSignal.timeout(30000) }); j = await res.json().catch(() => null); }
  catch (e) { health.ytApi.note = `network error (${e.cause?.code || e.name})`; return null; }
  if (!res.ok) {
    const reason = j?.error?.errors?.[0]?.reason || String(res.status);
    if (res.status === 403 || res.status === 429 || /quota|rateLimit|dailyLimit/i.test(reason)) health.ytApi.stopped = `API refused (${res.status} ${reason}); remaining sub-scores left null`;
    else health.ytApi.note = `API error ${res.status} ${reason}`;
    return null;
  }
  health.ytApi.units += COST[endpoint];
  writeFileSync(f, JSON.stringify(j));
  return j;
}
const isoMin = (d) => { const m = /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(d || ''); return m ? (Number(m[1] || 0) * 1440) + Number(m[2] || 0) * 60 + Number(m[3] || 0) + Number(m[4] || 0) / 60 : null; };
export async function ytApiPhrase(phrase) {
  const s1 = await apiGet('search', { part: 'snippet', q: phrase, type: 'video', maxResults: 25, relevanceLanguage: 'en', order: 'relevance' });
  if (!s1) return null;
  health.ytApi.searches++;
  const ids = (s1.items || []).map((i) => i.id?.videoId).filter(Boolean);
  if (!ids.length) return [];
  const v = await apiGet('videos', { part: 'snippet,contentDetails,statistics', id: ids.join(',') });
  if (!v) return null;
  const chIds = [...new Set((v.items || []).map((i) => i.snippet?.channelId).filter(Boolean))];
  const c = chIds.length ? await apiGet('channels', { part: 'statistics', id: chIds.join(',') }) : { items: [] };
  const subs = new Map((c?.items || []).map((i) => [i.id, i.statistics?.hiddenSubscriberCount ? null : Number(i.statistics?.subscriberCount)]));
  const byId = new Map((v.items || []).map((i) => [i.id, i]));
  return ids.map((id) => byId.get(id)).filter(Boolean).map((i) => ({
    title: i.snippet?.title || '', channel: i.snippet?.channelTitle || '', views: i.statistics?.viewCount != null ? Number(i.statistics.viewCount) : null,
    ageDays: i.snippet?.publishedAt ? (Date.now() - Date.parse(i.snippet.publishedAt)) / 864e5 : null, minutes: isoMin(i.contentDetails?.duration), subs: subs.get(i.snippet?.channelId) ?? null, published: (i.snippet?.publishedAt || '').slice(0, 10) }));
}
function fromApi(results, entity, channelKey) {
  const tok = entity.toLowerCase().replace(/\s*\(.*\)$/, '').split(/\s+/).find((w) => w.length >= 3) || entity.toLowerCase();
  const vpd = results.filter((r) => r.views != null && r.ageDays > 1).map((r) => r.views / r.ageDays);
  const med = median(vpd);
  const top5v = [...vpd].sort((a, b) => b - a).slice(0, 5); const topMean = top5v.length ? mean(top5v) : null;
  const ANGLE = channelKey === 'powder' ? /collaps|fraud|scandal|bankrupt|explained|rise and fall|story|documentary|accounting|ponzi|fail|how|why|truth|what happened|downfall|crash/i : /explained|why|how|route|trade|shipping|canal|strait|oil|econom|map|port|blockade|crisis|history|chokepoint|supply|cargo|pipeline|border/i;
  const same = results.filter((r) => r.title.toLowerCase().includes(tok) && ANGLE.test(r.title));
  const isStrong = (r) => (r.minutes || 0) > 6 && r.ageDays != null && r.ageDays <= 730 && ((r.views || 0) > 1e5 || (r.subs || 0) > 5e5);
  const strong = same.filter(isStrong);
  const medium = same.filter((r) => !isStrong(r) && (r.minutes || 0) > 6 && r.ageDays != null && r.ageDays <= 730 && (r.views || 0) >= 10000);
  const top5 = results.slice(0, 5);
  const top5Big = top5.length >= 5 && top5.every((r) => (r.subs || 0) > 5e5);
  const oldHigh = same.filter((r) => r.ageDays > 730 && r.views != null && r.views / r.ageDays > (med || 0));
  let gap = 10 - strong.length * 0.8 - medium.length * 0.25 - (top5Big ? 1.5 : 0);
  const oldCredit = strong.length <= 2 && oldHigh.length >= 2 ? 1.5 : 0; // proven demand, but only old videos
  gap = gap >= 9 ? gap : Math.min(9, gap + oldCredit); // the old-only bonus cannot push a gap past 9
  const age = (d) => (d == null ? '?' : d < 60 ? `${Math.round(d)}d` : d < 730 ? `${Math.round(d / 30)}mo` : `${(d / 365).toFixed(1)}y`);
  return { demand: topMean == null ? null : clamp((Math.log10(Math.max(topMean, 1) / 50) / Math.log10(20000 / 50)) * 10), medianViewsPerDay: med == null ? null : Math.round(med), top5MeanViewsPerDay: topMean == null ? null : Math.round(topMean), gap: clamp(gap), strongCount: strong.length, mediumCount: medium.length, sameAngleCount: same.length, top5AllBig: top5Big, oldOnlyCredit: oldCredit, results: results.length,
    top: results.slice(0, 5).map((r) => `${r.title.slice(0, 70)} | ${r.channel} (${r.subs == null ? '? subs' : Math.round(r.subs / 1000) + 'k subs'}) | ${r.views ?? '?'} views | ${age(r.ageDays)} | ${r.minutes == null ? '?' : Math.round(r.minutes)} min`) };
}
export const apiSummary = () => { const h = health.ytApi; return `${h.units} / ${h.budget} units used, ${h.searches} searches (${h.cached} cache hits)${h.stopped ? '; STOPPED: ' + h.stopped : ''}${!apiKey() ? '; no YOUTUBE_API_KEY found' : ''}${h.note ? '; ' + h.note : ''}`; };

// ---------- main entry ----------
export async function opportunityFor({ channelKey, entity, wiki, vidiqRows = [], ytOverride = false, ytEnabled = false, apiPhrases = 1, queryName = null }) {
  const phrases = phrasesFor(channelKey, queryName || entity);
  const notes = [];
  const vq = vidiqMatch(vidiqRows, phrases, entity);
  let demand = null, gap = null, dSrc = null, gSrc = null, dEv = {}, gEv = {};

  if (vq) {
    health.vidiq.matched++;
    demand = r1(volScore(vq.volume)); gap = r1(compGap(vq.competition)); dSrc = gSrc = 'vidiq';
    dEv = { keyword: vq.keyword, volume: vq.volume, overall: vq.overall }; gEv = { competition: vq.competition };
  }
  // YouTube Data API (default); the scraped results page is opt-in only (--yt-search)
  let yt = null;
  if ((demand == null || gap == null) && apiAvailable()) {
    const rs = []; let any = false;
    for (const p of phrases.slice(0, apiPhrases)) { const r = await ytApiPhrase(p); if (r) { any = true; rs.push(...r); } }
    if (any && rs.length) { yt = fromApi(rs, entity, channelKey); yt.src = 'yt-api'; } else notes.push(health.ytApi.stopped ? `YouTube API stopped: ${health.ytApi.stopped}` : 'YouTube API returned nothing');
  } else if ((demand == null || gap == null) && !apiKey()) notes.push('no YOUTUBE_API_KEY');
  else if (health.ytApi.stopped && (demand == null || gap == null)) notes.push(`YouTube API stopped: ${health.ytApi.stopped}`);
  if (yt) {
    if (demand == null && yt.demand != null) { demand = r1(yt.demand); dSrc = 'yt-api'; dEv = { top5MeanViewsPerDay: yt.top5MeanViewsPerDay, medianViewsPerDay: yt.medianViewsPerDay, results: yt.results, top: yt.top }; }
    if (gap == null) { gap = r1(yt.gap); gSrc = 'yt-api'; gEv = { strongSameAngle: yt.strongCount, mediumSameAngle: yt.mediumCount, sameAngleTotal: yt.sameAngleCount, top5AllBigChannels: yt.top5AllBig, oldOnlyCredit: yt.oldOnlyCredit, rule: 'strong = title has the entity AND an angle word, >6 min, <=24 months, >100k views or >500k subs', top: yt.top }; }
  }
  // scraped results page (opt-in, robots override)
  if (ytEnabled && !yt && (demand == null || gap == null)) {
    const rs = [];
    for (const p of phrases.slice(0, 2)) { const r = await ytSearch(p, { override: ytOverride }); if (r) rs.push(...r); }
    if (rs.length) yt = fromSearch(rs, entity);
    else notes.push('YouTube search results unavailable');
  }
  if (yt && yt.src !== 'yt-api') {
    if (demand == null && yt.demand != null) { demand = r1(yt.demand); dSrc = 'youtube-search'; dEv = { medianViewsPerDay: yt.medianViewsPerDay, top: yt.top }; }
    if (gap == null) { gap = r1(yt.gap); gSrc = 'youtube-search'; gEv = { recentStrong: yt.recentStrong, sameAngleLong: yt.sameAngleLong, bigChannels: null, note: 'subscriber counts are not shown in results; big-channel count not measured' }; }
  }
  // Autocomplete depth (used for demand only when nothing better exists, or blended 30% with search views)
  let ac = null;
  { const lists = []; for (const p of [queryName || entity, phrases[0]]) { const l = await autocomplete(p); if (l) lists.push(l); }
    if (lists.length) { const e = entity.toLowerCase().split(/\s+/)[0]; const n = lists.map((l) => l.filter((s) => s.toLowerCase().includes(e)).length); ac = { score: clamp((mean(n) / 14) * 10), suggestions: lists.map((l) => l.slice(0, 5)), containing: n }; } }
  if (ac) {
    if (demand == null) { demand = r1(ac.score); dSrc = 'autocomplete-only'; dEv = { containing: ac.containing, sample: ac.suggestions[0] }; }
    else if (dSrc === 'youtube-search' || dSrc === 'yt-api') { demand = r1((dSrc === 'yt-api' ? 0.8 : 0.7) * demand + (dSrc === 'yt-api' ? 0.2 : 0.3) * ac.score); dEv.autocompleteContaining = ac.containing; dEv.blend = dSrc === 'yt-api' ? '80% API views/day + 20% autocomplete' : '70/30'; }
  } else notes.push('autocomplete unavailable');

  // Evergreen / growth
  let evergreen = null, eEv = null;
  if (wiki) { const v = await pageviewSeries(wiki); if (v) { eEv = evergreenFrom(v); evergreen = r1(eEv.score); } else notes.push(`no Wikipedia pageview series for "${wiki}"`); }
  else notes.push('no Wikipedia article for the main entity (evergreen unknown)');

  const w = (dSrc === 'vidiq' || dSrc === 'youtube-search' || dSrc === 'yt-api' ? 0.35 : dSrc ? 0.2 : 0) + (gap != null ? 0.35 : 0) + (evergreen != null ? 0.3 : 0);
  const confidence = w >= 0.75 ? 'high' : w >= 0.5 ? 'medium' : 'low';
  // Combined: geometric mean of demand, demand-weighted gap and evergreen; an unknown part counts as a low 2.
  const d = demand ?? 2, g = gap ?? 2, e = evergreen ?? 2;
  const gapEff = g * Math.min(1, d / 4); // an open gap is worth little when nobody searches for the topic
  const score = r1(10 * Math.cbrt((d * gapEff * e) / 1000));
  return { entity, wikiArticle: wiki || null, phrases, score, gapEffective: r1(gapEff), confidence, confidenceWeight: Math.round(w * 100) / 100,
    demand: { score: demand, source: dSrc, evidence: dEv }, competitionGap: { score: gap, source: gSrc, evidence: gEv }, evergreen: { score: evergreen, source: eEv ? 'wikipedia-pageviews' : null, evidence: eEv }, notes };
}
