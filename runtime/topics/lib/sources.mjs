// Story gatherers. Each returns an array of stories:
// { title, url, outlet, published (ISO), origin, points?, wikiLinks?, category? }
import { getText, getJSON, robotsAllowed, qs } from './net.mjs';
import { NICHE_QUERIES, GDELT_QUERIES, FEEDS, SUBREDDITS } from './config.mjs';

const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'" };
export function decode(s = '') {
  return s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&(#x?[0-9a-f]+|\w+);/gi, (m, e) => {
      if (e[0] === '#') { const n = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); return Number.isFinite(n) ? String.fromCodePoint(n) : m; }
      return ENT[e.toLowerCase()] ?? m;
    }).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}
const tag = (block, name) => { const m = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'i')); return m ? decode(m[1]) : ''; };

export function parseRSS(xml, fallbackOutlet) {
  if (!xml) return [];
  const items = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) || [];
  return items.map((it) => {
    let title = tag(it, 'title');
    let outlet = tag(it, 'source') || fallbackOutlet;
    let link = tag(it, 'link') || (it.match(/rdf:about="([^"]+)"/) || [])[1] || '';
    const date = tag(it, 'pubDate') || tag(it, 'dc:date') || tag(it, 'published');
    const desc = tag(it, 'description').slice(0, 400);
    const im = it.match(/<media:(?:content|thumbnail)[^>]*url="([^"]+)"/i) || it.match(/<enclosure[^>]*url="([^"]+)"[^>]*type="image/i) || it.match(/<enclosure[^>]*type="image[^>]*url="([^"]+)"/i);
    const credit = tag(it, 'media:credit');
    // Google News titles end with " - Outlet".
    const m = title.match(/^(.*) - ([^-]{2,60})$/);
    if (m && (outlet === m[2].trim() || fallbackOutlet === 'Google News')) { title = m[1].trim(); outlet = m[2].trim(); }
    const t = Date.parse(date);
    return { title, url: link.trim(), outlet, published: Number.isFinite(t) ? new Date(t).toISOString() : null, desc, image: im ? decode(im[1]) : null, imageCredit: credit || null };
  }).filter((s) => s.title);
}

const recent = (days) => (s) => !s.published || Date.now() - Date.parse(s.published) < days * 864e5;

export async function feeds({ days }) {
  const out = [];
  for (const [name, url] of FEEDS) {
    const xml = await getText(url, { ttlH: 1 });
    const items = parseRSS(xml, name).filter(recent(days)).map((s) => ({ ...s, outlet: name.replace(/ (World|Business|Technology|Top)$/, ''), origin: 'feed' }));
    out.push(...items);
  }
  return out;
}

export async function googleNews({ days, enabled, queries = NICHE_QUERIES }) {
  if (!enabled) return { stories: [], note: 'Google News RSS skipped: news.google.com/robots.txt disallows /rss for generic agents (opt in with --gnews).' };
  const out = [];
  for (const { q, cat } of queries) {
    const url = `https://news.google.com/rss/search?${qs({ q: `${q} when:${days}d`, hl: 'en-US', gl: 'US', ceid: 'US:en' })}`;
    const xml = await getText(url, { ttlH: 1, override: true });
    out.push(...parseRSS(xml, 'Google News').filter(recent(days)).slice(0, 25).map((s) => ({ ...s, origin: 'gnews', category: cat })));
  }
  return { stories: out, note: 'Google News RSS used (--gnews): robots.txt override chosen by the operator.' };
}

export async function gdelt({ days, queries = GDELT_QUERIES }) {
  const out = [];
  for (const q of queries) {
    const url = `https://api.gdeltproject.org/api/v2/doc/doc?${qs({ query: `${q} sourcelang:english`, mode: 'artlist', format: 'json', maxrecords: 75, timespan: `${days}d`, sort: 'hybridrel' })}`;
    const j = await getJSON(url, { ttlH: 2, quiet: true });
    for (const a of j?.articles || []) {
      const d = a.seendate?.match(/^(\d{4})(\d\d)(\d\d)T(\d\d)(\d\d)(\d\d)Z$/);
      out.push({ title: decode(a.title), url: a.url, outlet: a.domain, published: d ? `${d[1]}-${d[2]}-${d[3]}T${d[4]}:${d[5]}:${d[6]}Z` : null, origin: 'gdelt', image: a.socialimage || null });
    }
  }
  return out;
}

// GDELT article search for one name (optionally one domain): used for news / press-kit photos.
export async function gdeltSearch(phrase, { domain = null, days = 30, max = 40 } = {}) {
  const q = `"${phrase}"${domain ? ` domainis:${domain}` : ''} sourcelang:english`;
  const j = await getJSON(`https://api.gdeltproject.org/api/v2/doc/doc?${qs({ query: q, mode: 'artlist', format: 'json', maxrecords: max, timespan: `${days}d`, sort: 'datedesc' })}`, { ttlH: 6, quiet: true });
  return (j?.articles || []).map((a) => {
    const d = a.seendate?.match(/^(\d{4})(\d\d)(\d\d)T(\d\d)(\d\d)(\d\d)Z$/);
    return { title: decode(a.title), url: a.url, outlet: a.domain, published: d ? `${d[1]}-${d[2]}-${d[3]}T${d[4]}:${d[5]}:${d[6]}Z` : null, image: a.socialimage || null, origin: 'gdelt' };
  });
}

// Fallback when the en.wikipedia action API is rate-limited: Parsoid HTML via the REST API.
async function currentEventsHTML(page, d) {
  const html = await getText(`https://en.wikipedia.org/api/rest_v1/page/html/${encodeURIComponent(page.replace(/ /g, '_'))}`, { ttlH: 2, quiet: true });
  if (!html) return [];
  const out = []; let category = '';
  const body = html.replace(/<style[\s\S]*?<\/style>/g, '');
  const re = /<div[^>]*role="heading"[^>]*>([\s\S]*?)<\/div>|<p[^>]*><b>([\s\S]*?)<\/b><\/p>|<li[^>]*>([\s\S]*?)(?=<li|<\/ul>)/g;
  const ctx = [];
  for (const m of body.matchAll(re)) {
    if (m[1] || m[2]) { category = decode(m[1] || m[2]); ctx.length = 0; continue; }
    const li = m[3];
    const refs = [...li.matchAll(/<a[^>]*rel="mw:ExtLink"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)];
    const links = [...li.matchAll(/<a[^>]*rel="mw:WikiLink"[^>]*title="([^"]+)"/g)].map((x) => decode(x[1])).filter((t) => !/^(File|Category|Portal):/.test(t));
    if (!refs.length) { ctx.splice(0, ctx.length, ...links); continue; }
    const text = decode(li.replace(/<a[^>]*rel="mw:ExtLink"[\s\S]*?<\/a>/g, '')).slice(0, 300);
    out.push({ title: text, url: refs[0][1], outlet: refs.map((r) => decode(r[2]).replace(/[()]/g, '')).join(', '), published: new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 12)).toISOString(), origin: 'wiki-ce', category, wikiLinks: [...new Set([...ctx, ...links])], context: '', refs: refs.map((r) => r[1]) });
  }
  return out;
}

function stripWiki(s) {
  return s.replace(/\[https?:\/\/\S+ \(([^)]*)\)\]/g, '')
    .replace(/\[https?:\/\/\S+\s*([^\]]*)\]/g, '')
    .replace(/\[\[(?:[^|\]]*\|)?([^\]]*)\]\]/g, '$1')
    .replace(/'''?/g, '').replace(/\{\{[^}]*\}\}/g, '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}
const linksOf = (s) => [...s.matchAll(/\[\[([^|\]#]+)(?:#[^|\]]*)?(?:\|[^\]]*)?\]\]/g)].map((m) => m[1].trim()).filter((t) => !/^(File|Category|Image):/i.test(t));

export async function wikiCurrentEvents({ dates }) {
  const out = [];
  for (const d of dates) {
    const page = `Portal:Current events/${d.getUTCFullYear()} ${d.toLocaleString('en-US', { month: 'long', timeZone: 'UTC' })} ${d.getUTCDate()}`;
    const j = await getJSON(`https://en.wikipedia.org/w/api.php?${qs({ action: 'parse', page, prop: 'wikitext', format: 'json', formatversion: 2 })}`, { ttlH: 2 });
    const wt = j?.parse?.wikitext;
    if (!wt) { out.push(...(await currentEventsHTML(page, d))); continue; }
    let category = ''; const stack = [];
    for (const line of wt.split('\n')) {
      const h = line.match(/^'''(.+?)'''\s*$/); if (h) { category = h[1]; stack.length = 0; continue; }
      const b = line.match(/^(\*+)\s*(.*)$/); if (!b) continue;
      const depth = b[1].length; stack.length = depth - 1; stack[depth - 1] = b[2];
      const refs = [...b[2].matchAll(/\[(https?:\/\/\S+) \(?([^)\]]*)\)?\]/g)];
      if (!refs.length) continue; // leaf items carry the source links
      const ctx = stack.slice(0, -1).filter(Boolean);
      out.push({
        title: stripWiki(b[2]).slice(0, 300), url: refs[0][1], outlet: refs.map((r) => r[2].replace(/'/g, '')).join(', '),
        published: new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 12)).toISOString(), origin: 'wiki-ce', category,
        wikiLinks: [...new Set([...ctx.flatMap(linksOf), ...linksOf(b[2])])], context: ctx.map(stripWiki).join(' > '), refs: refs.map((r) => r[1]),
      });
    }
  }
  return out;
}

// Wikimedia pageviews: top articles for a given UTC day -> Map(title -> views).
export async function wikiTop(d) {
  const p = (n) => String(n).padStart(2, '0');
  const j = await getJSON(`https://wikimedia.org/api/rest_v1/metrics/pageviews/top/en.wikipedia/all-access/${d.getUTCFullYear()}/${p(d.getUTCMonth() + 1)}/${p(d.getUTCDate())}`, { ttlH: 12, quiet: true });
  const m = new Map();
  for (const a of j?.items?.[0]?.articles || []) m.set(a.article.replace(/_/g, ' '), a.views);
  return m;
}

export async function articleViews(title, end, days = 10) {
  const f = (d) => d.toISOString().slice(0, 10).replace(/-/g, '') + '00';
  const start = new Date(end.getTime() - days * 864e5);
  const j = await getJSON(`https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia/all-access/user/${encodeURIComponent(title.replace(/ /g, '_'))}/daily/${f(start)}/${f(end)}`, { ttlH: 12, quiet: true });
  return (j?.items || []).map((i) => i.views);
}

export async function hackerNews({ days, queries: qList, minPoints = 40 }) {
  const since = Math.floor((Date.now() - days * 864e5) / 1000);
  const out = []; const seen = new Set();
  const queries = qList || ['', 'nvidia', 'china', 'spy', 'trump', 'export controls', 'apple', 'sanctions', 'ceo'];
  for (const q of queries) {
    const j = await getJSON(`https://hn.algolia.com/api/v1/search?${qs({ query: q, tags: 'story', numericFilters: `created_at_i>${since},points>${minPoints}`, hitsPerPage: 40 })}`, { ttlH: 1 });
    for (const h of j?.hits || []) {
      if (seen.has(h.objectID)) continue; seen.add(h.objectID);
      out.push({ title: h.title, url: h.url || `https://news.ycombinator.com/item?id=${h.objectID}`, outlet: 'Hacker News', published: h.created_at, origin: 'hn', points: h.points, comments: h.num_comments, hnUrl: `https://news.ycombinator.com/item?id=${h.objectID}` });
    }
  }
  return out;
}

export async function reddit({ days }) {
  const out = []; const notes = [];
  for (const sub of SUBREDDITS) {
    const url = `https://www.reddit.com/r/${sub}/top.json?${qs({ t: days > 1 ? 'week' : 'day', limit: 50 })}`;
    if (!(await robotsAllowed(url))) { notes.push(`r/${sub}`); continue; }
    const j = await getJSON(url, { ttlH: 1, quiet: true });
    for (const c of j?.data?.children || []) out.push({ title: c.data.title, url: c.data.url, outlet: `r/${sub}`, published: new Date(c.data.created_utc * 1000).toISOString(), origin: 'reddit', points: c.data.score });
  }
  return { stories: out, note: notes.length ? `Reddit skipped (${notes.join(', ')}): reddit.com/robots.txt is "Disallow: /" for all agents and the JSON endpoints return 403 without OAuth.` : '' };
}

export const YOUTUBE_NOTE = 'YouTube search counts skipped: needs a Data API key (and youtube.com search pages are not for bots).';

// Channel-profile RSS feeds (radar.mjs --channel). Same robots/rate-limit/cache rules as the default feeds.
export async function channelFeeds(urls, { days }) {
  const out = [];
  for (const url of urls) {
    const host = new URL(url).host.replace(/^www\./, '');
    const xml = await getText(url, { ttlH: 1 });
    out.push(...parseRSS(xml, host).filter(recent(days)).map((s) => ({ ...s, outlet: host, origin: 'feed', chFeed: true })));
  }
  return out;
}
