// Transparent virality-fit scoring. Every component reports its points, its max and the evidence.
import { NICHE_TERMS, CONFLICT_TERMS, TWIST_TERMS, VISUAL_TERMS, EVERGREEN_TERMS, UNVERIFIED_TERMS, GRAPHIC_TERMS, OFFNICHE_TERMS } from './config.mjs';

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const reCache = new Map();
function hits(text, terms) {
  const found = [];
  for (const t of terms) {
    let re = reCache.get(t); if (!re) { re = new RegExp(`(^|[^a-z])${esc(t)}([^a-z]|$)`, 'g'); reCache.set(t, re); }
    re.lastIndex = 0; const n = (text.match(re) || []).length; if (n) found.push([t, n]);
  }
  return found;
}
// Channel profile (radar.mjs --channel): when set, nicheFit is measured against that channel's niche.
let CH = null;
export function setChannelProfile(p) { CH = p; }
const BUCKET_CATS = [[/corporate/, ['corporate scandal']], [/money/, ['money/geopolitics']], [/big tech/, ['big tech']], [/china-us/, ['china-us tech/trade']], [/geopolitic/, ['money/geopolitics', 'china-us tech/trade']], [/espionage/, ['espionage']], [/trump-russia/, ['trump/russia']]];
export function channelFit(text, p) {
  const inc = hits(text, [...p.includeTerms, ...(p.radarTerms || [])]).map(([w]) => w);
  const strong = new Set(p.strongTerms || []);
  const exc = hits(text, [...p.excludeTerms, ...(p.radarExclude || [])]).map(([w]) => w);
  const cats = Object.entries(NICHE_TERMS).map(([c, terms]) => [c, hits(text, terms).length]).filter(([, n]) => n).map(([c]) => c);
  const wanted = new Set((p.radarBuckets || []).flatMap((b) => BUCKET_CATS.filter(([re]) => re.test(b.toLowerCase())).flatMap(([, c]) => c)));
  const buckets = cats.filter((c) => wanted.has(c));
  return { include: inc, exclude: exc, buckets, score: cap(inc.reduce((a, w) => a + (strong.has(w) ? 4 : 2), 0) + Math.min(3, buckets.length * 1.5), 10) };
}
const cap = (v, m) => Math.max(0, Math.min(m, Math.round(v * 10) / 10));

export function scoreTopic(t) {
  const text = t.stories.map((s) => `${s.title} ${s.context || ''}`).join(' \n ').toLowerCase();
  const subj = t.subjects || [];
  const people = subj.filter((s) => s.kind === 'person'), orgs = subj.filter((s) => s.kind === 'organisation/thing'), places = subj.filter((s) => s.kind === 'place');
  const B = {};

  // Momentum
  const outlets = new Set(t.stories.map((s) => (s.outlet || '').toLowerCase().replace(/^www\./, ''))).size;
  const origins = [...new Set(t.stories.map((s) => s.origin))];
  const hn = Math.max(0, ...t.stories.map((s) => (s.origin === 'hn' ? s.points || 0 : 0)));
  const pv = t.pageviews || {};
  const growthPts = pv.growth ? Math.min(6, Math.log2(Math.max(1, pv.growth)) * 2) : 0;
  const volPts = pv.peak ? Math.min(3, Math.log10(Math.max(1, pv.peak / 1000)) * 1.5) : 0;
  B.momentum = { score: cap(Math.min(10, outlets * 1.1) + Math.min(6, origins.length * 1.5) + growthPts + volPts + (hn ? Math.min(3, Math.log10(hn)) : 0), 25), max: 25,
    evidence: { outlets, stories: t.stories.length, origins, hnPoints: hn || null, wikiPageviews: pv.peak ? { article: pv.article, peakDay: pv.peak, growthVsPriorWeek: pv.growth } : null } };

  // Famous person / company
  const famous = [...people, ...orgs].filter((s) => s.wikiTitle);
  const fameViews = Math.max(0, ...famous.map((s) => s.avgViews || 0));
  B.famous = { score: cap(Math.min(8, people.length * 3 + orgs.length * 2) + (fameViews ? Math.min(7, Math.log10(fameViews) * 1.8) : 0), 15), max: 15,
    evidence: { people: people.map((p) => p.subject), organisations: orgs.map((o) => o.subject), topAvgDailyViews: fameViews || null } };

  // Conflict / controversy
  const conf = hits(text, CONFLICT_TERMS);
  B.conflict = { score: cap(conf.length * 2.2, 15), max: 15, evidence: conf.map(([w]) => w) };

  // Story arc with a twist
  const tw = hits(text, TWIST_TERMS);
  const days = new Set(t.stories.map((s) => s.published?.slice(0, 10)).filter(Boolean)).size;
  B.arc = { score: cap(Math.min(8, tw.length * 1.3) + (days >= 2 ? 3 : 0) + (famous.length >= 2 ? 2 : 0) + (t.stories.length >= 6 ? 2 : 0), 15), max: 15,
    evidence: { twistWords: tw.map(([w]) => w), daysCovered: days, actors: famous.length } };

  // Visual potential for miniature scenes
  const vis = hits(text, VISUAL_TERMS);
  B.visual = { score: cap(vis.length * 1.5 + places.length * 1.5, 10), max: 10, evidence: { objects: vis.map(([w]) => w), places: places.map((p) => p.subject) } };

  // Evergreen backstory
  const ev = hits(text + ' ' + subj.map((s) => s.description).join(' ').toLowerCase(), EVERGREEN_TERMS);
  B.evergreen = { score: cap(ev.length * 1.6 + (famous.length ? 2 : 0), 10), max: 10, evidence: ev.map(([w]) => w) };

  // Niche fit (gate, not a virality signal): which niche buckets fire, minus off-niche words.
  const cats = Object.entries(NICHE_TERMS).map(([c, terms]) => [c, hits(text, terms).map(([w]) => w)]).filter(([, w]) => w.length);
  const off = hits(text, OFFNICHE_TERMS);
  const nicheRaw = cats.reduce((a, [, w]) => a + Math.min(4, w.length), 0);
  B.nicheFit = { score: cap(nicheRaw - off.length * 4, 10), max: 10, evidence: { categories: Object.fromEntries(cats), offNiche: off.map(([w]) => w) } };
  if (CH) {
    const f = channelFit(text, CH);
    B.nicheFit = { score: cap(f.score - off.length * 4 - f.exclude.length * 6, 10), max: 10, evidence: { categories: Object.fromEntries(cats), offNiche: [...off.map(([w]) => w), ...f.exclude], channel: CH.channel, includeHits: f.include, buckets: f.buckets } };
  }

  // Risk flags (penalties, listed explicitly)
  const flags = [];
  const unv = hits(text, UNVERIFIED_TERMS), gr = hits(text, GRAPHIC_TERMS);
  if (unv.length) flags.push({ flag: 'unverified claims', detail: `wording: ${unv.map(([w]) => w).join(', ')} - attribute every claim ("X reported...", "alleged")`, penalty: 3 });
  if (unv.length && people.length) flags.push({ flag: 'defamation risk', detail: `allegations involve named living people (${people.map((p) => p.subject).join(', ')}); use "alleged", cite outlets, no invented scenes`, penalty: 2 });
  if (gr.length) flags.push({ flag: 'graphic violence', detail: `wording: ${gr.map(([w]) => w).join(', ')} - keep miniature scenes non-graphic`, penalty: 2 });
  const priv = subj.filter((s) => s.flags?.some((f) => /private individual/.test(f)));
  if (priv.length) flags.push({ flag: 'private individual', detail: `${priv.map((p) => p.subject).join(', ')}: not a public figure; do not show their face, avoid naming beyond what major outlets print`, penalty: 2 });
  if (outlets <= 2) flags.push({ flag: 'thin sourcing', detail: `only ${outlets} outlet(s) so far`, penalty: 2 });
  const penalty = flags.reduce((a, f) => a + f.penalty, 0);

  const virality = B.momentum.score + B.famous.score + B.conflict.score + B.arc.score + B.visual.score + B.evergreen.score; // max 90
  const total = Math.round(Math.max(0, virality * (0.5 + B.nicheFit.score / 20) - penalty) * 10) / 10;
  return { total, formula: 'total = (momentum+famous+conflict+arc+visual+evergreen) x (0.5 + nicheFit/20) - risk penalties', breakdown: B, risk: flags };
}
