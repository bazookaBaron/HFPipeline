// Polite HTTP: generic User-Agent, per-host rate limit, disk cache, robots.txt gate.
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const UA = 'TopicRadar/0.1 (research script)';
const HERE = dirname(fileURLToPath(import.meta.url));
export const CACHE_DIR = join(HERE, '..', 'out', '.cache');
mkdirSync(CACHE_DIR, { recursive: true });

// Minimum gap between requests to the same host (ms). GDELT asks for 1 req / 5 s.
const HOST_GAP = {
  'api.gdeltproject.org': 6500,
  'en.wikipedia.org': 300,
  'www.wikidata.org': 1000,
  'commons.wikimedia.org': 300,
  'wikimedia.org': 1200,
  'upload.wikimedia.org': 500,
  'suggestqueries.google.com': 1500,
  'www.youtube.com': 4000,
  default: 1200,
};
// Documented, keyed-or-keyless public APIs meant for programmatic use. robots.txt governs
// crawling of web pages; these API endpoints are exempt by their own usage policies
// (Wikimedia API etiquette, GDELT DOC API, HN Algolia API). Everything else is checked.
const API_EXEMPT = [
  /^https:\/\/en\.wikipedia\.org\/w\/api\.php/,
  /^https:\/\/commons\.wikimedia\.org\/w\/api\.php/,
  /^https:\/\/www\.wikidata\.org\/w\/api\.php/,
  /^https:\/\/wikimedia\.org\/api\/rest_v1\//,
  /^https:\/\/en\.wikipedia\.org\/api\/rest_v1\//,
  /^https:\/\/api\.gdeltproject\.org\/api\/v2\//,
  /^https:\/\/hn\.algolia\.com\/api\/v1\//,
  /^https:\/\/upload\.wikimedia\.org\//,
  /^https:\/\/raw\.githubusercontent\.com\/unitedstates\/images\//,
];

const lastHit = new Map();
const blockedHosts = new Set();
let gdelt429 = 0;
const robotsCache = new Map();
export const isBlocked = (ep) => blockedHosts.has(ep);
export const stats = { requests: 0, cacheHits: 0, robotsBlocked: [], errors: [] };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function throttle(host) {
  const gap = HOST_GAP[host] ?? HOST_GAP.default;
  const prev = lastHit.get(host) ?? 0;
  const wait = prev + gap - Date.now();
  lastHit.set(host, Math.max(Date.now(), prev + gap));
  if (wait > 0) await sleep(wait);
}

function parseRobots(txt) {
  // Collect rules for "User-agent: *" and for our own agent token.
  const groups = []; let cur = null; let lastWasUA = false;
  for (const raw of txt.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, '').trim(); if (!line) continue;
    const m = line.match(/^([A-Za-z-]+)\s*:\s*(.*)$/); if (!m) continue;
    const k = m[1].toLowerCase(), v = m[2].trim();
    if (k === 'user-agent') {
      if (!lastWasUA || !cur) { cur = { agents: [], rules: [] }; groups.push(cur); }
      cur.agents.push(v.toLowerCase()); lastWasUA = true;
    } else { lastWasUA = false; if (cur && (k === 'allow' || k === 'disallow')) cur.rules.push({ allow: k === 'allow', path: v }); }
  }
  const mine = groups.filter((g) => g.agents.some((a) => a !== '*' && 'topicradar'.includes(a)));
  const pick = mine.length ? mine : groups.filter((g) => g.agents.includes('*'));
  return pick.flatMap((g) => g.rules);
}
function ruleMatch(path, rule) {
  if (rule.path === '') return false;
  let re = rule.path.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  if (re.endsWith('\\$')) re = re.slice(0, -2) + '$';
  return new RegExp('^' + re).test(path);
}
export async function robotsAllowed(url) {
  if (API_EXEMPT.some((r) => r.test(url))) return true;
  const u = new URL(url);
  let rules = robotsCache.get(u.host);
  if (!rules) {
    try {
      const txt = await getText(`${u.protocol}//${u.host}/robots.txt`, { ttlH: 24, skipRobots: true, quiet: true });
      rules = parseRobots(txt || '');
    } catch { rules = []; }
    robotsCache.set(u.host, rules);
  }
  const path = u.pathname + u.search;
  let best = null;
  for (const r of rules) if (ruleMatch(path, r) && (!best || r.path.length > best.path.length || (r.path.length === best.path.length && r.allow))) best = r;
  return !best || best.allow;
}

function cacheFile(url, kind, dir = CACHE_DIR) { return join(dir, createHash('sha1').update(kind + url).digest('hex') + (kind === 'bin' ? '.bin' : '.txt')); }

export async function getText(url, { ttlH = 3, skipRobots = false, quiet = false, override = false, validate = null, cacheDir = null } = {}) {
  if (cacheDir) mkdirSync(cacheDir, { recursive: true });
  const f = cacheFile(url, 'txt', cacheDir || CACHE_DIR);
  if (existsSync(f) && (Date.now() - statSync(f).mtimeMs) / 3.6e6 < ttlH) { stats.cacheHits++; return readFileSync(f, 'utf8'); }
  if (!skipRobots && !override && !(await robotsAllowed(url))) {
    stats.robotsBlocked.push(url); if (!quiet) console.warn(`  robots.txt disallows ${url} - skipped`);
    return null;
  }
  const host = new URL(url).host, ep = host + new URL(url).pathname;
  if (blockedHosts.has(ep)) return null; // endpoint rate-limited this run: callers fall back
  const slow = host.includes('gdelt'); // GDELT: 1 req / 5 s per IP, answers 429 or a text notice when exceeded
  const tries = slow ? 3 : 2;
  for (let attempt = 0; attempt < tries; attempt++) {
    const last = attempt === tries - 1;
    await throttle(host);
    stats.requests++;
    try {
      const res = await fetch(url, { headers: { 'user-agent': UA, accept: '*/*' }, redirect: 'follow', signal: AbortSignal.timeout(30000) });
      if (res.status === 429 || res.status >= 500) {
        if (last) {
          if (res.status === 429) { if (!slow || ++gdelt429 >= 3) blockedHosts.add(ep); stats.errors.push(`429 rate-limited: ${url.slice(0, 120)}`); }
          break;
        }
        await sleep(Math.min(30, Number(res.headers.get('retry-after')) || (slow ? 12 : 4) * (attempt + 1)) * 1000);
        continue;
      }
      if (!res.ok) { if (!quiet) stats.errors.push(`${res.status} ${url}`); return null; }
      const txt = await res.text();
      if (validate && !validate(txt)) {
        if (!last) { await sleep(slow ? 12000 : 6000); continue; }
        if (slow && ++gdelt429 >= 3) { blockedHosts.add(ep); stats.errors.push('GDELT kept refusing (rate-limit notice); GDELT disabled for the rest of this run'); }
        if (!quiet) stats.errors.push(`invalid body ${url}`); return null;
      }
      if (slow) gdelt429 = 0;
      writeFileSync(f, txt);
      return txt;
    } catch (e) { if (last) { if (!quiet) stats.errors.push(`${e.cause?.code || e.message} ${url}`); return null; } }
  }
  if (!quiet) stats.errors.push(`gave up ${url}`);
  return null;
}

const isJSON = (t) => { try { JSON.parse(t); return true; } catch { return false; } };
export async function getJSON(url, opts = {}) {
  const t = await getText(url, { ...opts, validate: isJSON });
  if (!t) return null;
  try { return JSON.parse(t); } catch { if (!opts?.quiet) stats.errors.push(`bad JSON ${url}`); return null; }
}

export async function getBinary(url) {
  if (!(await robotsAllowed(url))) throw new Error('robots.txt disallows ' + url);
  await throttle(new URL(url).host); stats.requests++;
  const res = await fetch(url, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(60000) });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

export function qs(o) { return Object.entries(o).filter(([, v]) => v !== undefined && v !== null).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&'); }
