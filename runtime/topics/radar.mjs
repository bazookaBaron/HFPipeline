#!/usr/bin/env node
// Topic radar for Blind Luck Time. See README.md.
//   node runtime/topics/radar.mjs                      # today's radar -> out/<date>/radar.{md,json}
//   node runtime/topics/radar.mjs --channel powder|partition   # niche radar -> out/<date>/<channel>/radar.{md,json} (profile: niches.json)
//     + opportunity scoring (demand x competition gap x evergreen) and an evergreen backlog; --yt-search opts in to the YouTube results page (robots.txt disallows it)
//   node runtime/topics/radar.mjs --subject "Tim Cook" --subject "Alice Huang"   # image lookup only
//   node runtime/topics/radar.mjs --download t01-... [--dest DIR] [--max 3]      # licensed photos + photos.json
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stats, getBinary } from './lib/net.mjs';
import { feeds, channelFeeds, googleNews, gdelt, wikiCurrentEvents, wikiTop, articleViews, hackerNews, reddit, YOUTUBE_NOTE } from './lib/sources.mjs';
import { cluster } from './lib/cluster.mjs';
import { scoreTopic, setChannelProfile } from './lib/score.mjs';
import { opportunityFor, loadVidiq, configureApi, apiSummary, health as oppHealth } from './lib/opportunity.mjs';
import { ALIASES } from './lib/config.mjs';
import { resolveTitles, imagesFor, imageNotes, setGdeltBudget } from './lib/images.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const opts = (n) => args.flatMap((a, i) => (a === n && args[i + 1] ? [args[i + 1]] : []));

const DATE = opt('--date', new Date().toISOString().slice(0, 10));
const DAYS = Number(opt('--days', opt('--channel', null) ? 7 : 3)); // niche stories (filings, collapses) move slower than headlines
const CHANNEL = opt('--channel', null);
let CH = null;
if (CHANNEL) {
  const all = JSON.parse(readFileSync(join(HERE, 'niches.json'), 'utf8'));
  CH = all[CHANNEL];
  if (!CH || CHANNEL.startsWith('_')) { console.error(`unknown --channel "${CHANNEL}". choices: ${Object.keys(all).filter((k) => !k.startsWith('_')).join(', ')}`); process.exit(1); }
  setChannelProfile(CH);
}
const TOP = Number(opt('--top', CH ? 10 : 15));
configureApi({ budget: Number(opt('--yt-budget', 4000)) }); // YouTube API units per run (search = 100)
const DROPPED = []; let LOWFIT = 0; // channel mode: topics removed by the niche gate (listed in an appendix)
const MINFIT = CH ? 4 : 3; // channel mode: at least two includeTerms (or one plus a bucket)
const OUT = join(HERE, 'out', DATE, ...(CHANNEL ? [CHANNEL] : []));
setGdeltBudget(Number(opt('--gdelt-photo-budget', 30)));
const day0 = new Date(DATE + 'T00:00:00Z');
const dayN = (n) => new Date(day0.getTime() - n * 864e5);
const log = (...a) => console.error(...a);
const slug = (s) => s.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
const hostOf = (u) => { try { return new URL(u).host.replace(/^www\./, ''); } catch { return ''; } };

if (flag('--help') || flag('-h')) { console.log(readFileSync(join(HERE, 'README.md'), 'utf8').split('\n## ')[1]); process.exit(0); }

async function subjectsOnly(names) {
  const res = await resolveTitles(names);
  const out = [];
  for (const n of names) { log(`image lookup: ${n}`); out.push(slimSubject(await imagesFor(res.get(n) || { name: n, missing: true }, { max: 5, stories: [] }))); }
  mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, 'subjects.json'), JSON.stringify({ date: DATE, notes: imageNotes, subjects: out }, null, 1));
  console.log(out.map(subjectLines).join('\n\n'));
  log(`\nwrote ${join(OUT, 'subjects.json')}`);
}

function subjectLines(s) {
  const l = [`## ${s.subject} (${s.kind}${s.wikiTitle ? `, wiki: ${s.wikiTitle}` : ''})  counts ${JSON.stringify(s.counts)}`];
  if (s.flags.length) l.push('flags: ' + s.flags.join('; '));
  s.images.forEach((i, k) => l.push(`- ${k === s.best ? 'BEST ' : ''}[tier ${i.tier}] ${i.date || i.uploaded || '?'} | ${i.licence} | ${(i.credit || '?').slice(0, 70)} | ${i.source} | img ${i.url.slice(0, 110)} | ${i.contentCheck}${i.avoid ? ' | ' + i.avoid : ''}`));
  if (s.pressKit) l.push(`- [press kit page] ${s.pressKit.url}`);
  if (s.note) l.push(s.note);
  return l.join('\n');
}

// JSON shape for one subject's photos (also what --download reads).
function slimSubject(s) {
  const img = (i) => ({ tier: i.tier, licence: i.licence, licenceDetail: i.licenceDetail || undefined, licenceUrl: i.licenceUrl || null, credit: i.credit || null, author: i.author || null,
    source: i.source, url: i.url, original: i.original, date: i.date || null, uploaded: i.uploaded || null, w: i.w || null, h: i.h || null, kind: i.kind, caption: i.caption || '',
    contentCheck: i.contentCheck, avoid: i.avoid, warNote: i.warNote, relevance: i.relevance, usGov: i.usGov || undefined, shareAlike: i.shareAlike || undefined, file: i.file || undefined, repo: i.repo || i.outlet });
  return { subject: s.subject, kind: s.kind, wikiTitle: s.wikiTitle, description: s.description, flags: s.flags, note: s.note, counts: s.counts, pressKit: s.pressKit,
    best: s.best ? s.images.indexOf(s.best) : null, images: s.images.map(img) };
}

// Channel mode: drop out-of-scope topics (any excludeTerm hit) and weak fits; default mode keeps the old gate.
function inNiche(t) {
  const nf = t.breakdown.nicheFit;
  if (CH && (nf.evidence.offNiche || []).length) { DROPPED.push({ title: t.headline, reason: `excluded term: ${nf.evidence.offNiche.join(', ')}` }); return false; }
  if (nf.score < MINFIT) { LOWFIT++; return false; }
  return true;
}

// Draft working title from the channel's titlePatterns. The script writer rewrites it.
function suggestTitle(t) {
  const text = (t._text || '') + ' ' + t.stories.map((s) => `${s.title} ${s.context || ''}`).join(' ').toLowerCase();
  const subs = t._subjects || [];
  const ent = (kind) => subs.find((r) => r.kind === kind && (r.title || r.name) && !/^\d/.test(r.title || r.name));
  const nm = (r) => (r.title || r.name).replace(/ \(.*\)$/, '');
  const raw = t.stories.map((x) => x.title).join(' ');
  const GENERIC = /^(year|corruption|deception|restraining|ftc|sec|doj|sues|state|states|federal|national|chinese|man|woman|court|judge|trump|white house|us|usa|uk|eu|china|russia|italian|italy|hungary|the|fbi|congress|senate)\b/i;
  const good = (e) => /^[A-Z]/.test(e) && e.length > 2 && !GENERIC.test(e) && !new RegExp('\\b' + e.split(' ')[0].toLowerCase() + '\\b').test(raw.replace(/[A-Z]\w*/g, ''));
  const topEnt = t.entities.find((e) => e.mentions >= 1 && good(e.name))?.name;
  const P = CH.titlePatterns;
  const fill = (pat, m) => pat.replace(/\[([^\]]+)\]/g, (x, k) => m[k] ?? x);
  let title;
  if (CHANNEL === 'powder') {
    const orgOk = subs.find((r) => r.kind === 'organisation/thing' && (r.title || r.name) && good(nm(r)));
    const co = orgOk ? nm(orgOk) : topEnt || '[Company]';
    const amt = text.match(/\$\s?(\d[\d.,]*)\s?(billion|bn|million)\b/);
    if (/auditor|audit\b/.test(text)) title = fill(P[4], { Role: 'Auditor', 'Signed/Ignored/Hid': 'Signed Off On' }).replace('Everything', co);
    else if (amt && /bankrupt|chapter 11|collapse|liquidat|insolven/.test(text)) title = fill(P[2], { Company: co, N: `${amt[1]} ${/^b/.test(amt[2]) ? 'Billion' : 'Million'}` }).replace('$' + amt[1], '$' + amt[1]);
    else title = fill(P[5], { Company: co, 'Fraud/Collapse': /fraud|ponzi|scam|embezzl/.test(text) ? 'Fraud' : /bankrupt|collapse|liquidat|insolven|resign|ousted|steps down|plunge|plummet/.test(text) ? 'Collapse' : 'Scandal' });
  } else {
    const places = ['strait of hormuz', 'taiwan strait', 'bab-el-mandeb', 'red sea', 'suez canal', 'panama canal', 'strait of malacca', 'bosphorus', 'black sea', 'south china sea', 'arctic', 'baltic'];
    const hit = places.find((p) => text.includes(p)) || (text.match(/\b(hormuz|suez|panama|malacca)\b/) || [])[1];
    const placeR = subs.find((r) => r.kind === 'place' && (r.title || r.name) && good(nm(r)));
    const place = placeR ? nm(placeR) : t.kind === 'backlog' ? t.topName : '[Place]';
    const cap = (x) => x.replace(/\b\w/g, (c) => c.toUpperCase());
    const move = text.includes('tariff') ? 'Tariffs Change' : /sanction|blacklist/.test(text) ? 'Sanctions Tighten' : /freight|shipping rate|container/.test(text) ? 'Freight Rates Jump' : /waiver|ship tax|port fee|export control/.test(text) ? 'the Rule Changes' : null;
    if (hit) title = fill(P[5], { Chokepoint: cap(hit), N: '10' });
    else if (move) title = fill(P[2], { 'Ship/Price/Factory': /ship|freight|container|tanker/.test(text) ? 'Ship' : 'Price', 'Line Closes': move });
    else if (/border|disputed|territor/.test(text)) title = fill(P[3], { Place: place });
    else title = fill(P[1], { Place: place, 'Everyone / Your Wallet': 'Your Wallet' });
  }
  return { suggestedTitle: title, titleNote: 'draft; the script writer rewrites it' };
}


const GATE_WAR = ['missile', 'troops', 'offensive', 'airstrike', 'air strike', 'invasion', 'shelling', 'frontline', 'drone strike', 'ceasefire'];
const FILING = /charged|indicted|\bsec\b|\bdoj\b|\bftc\b|lawsuit|sued|settle|fined|\bfines?\b|bankrupt|resign|sentenced|pleads|ruling|ruled|court|liquidat|steps down|ousted/;
const textOfT = (t) => t.stories.map((s) => `${s.title} ${s.context || ''}`).join(' ').toLowerCase();

// Hard niche gate for news topics. Returns a reason string when the topic must not appear.
function gateReason(t) {
  const nf = t.breakdown.nicheFit, text = textOfT(t);
  if ((nf.evidence.offNiche || []).length) return `excluded term: ${nf.evidence.offNiche.join(', ')}`;
  if (nf.score < 6) return `niche fit ${nf.score}/10 (< 6)`;
  if ((CH.gateAny || []).length && !new RegExp('\\b(' + CH.gateAny.join('|') + ')').test(text)) return `no ${CHANNEL === 'powder' ? 'company / finance' : 'trade / route'} signal in the headlines`;
  if (CHANNEL === 'partition') {
    if (t.risk.some((f) => f.flag === 'graphic violence')) return 'casualty / graphic wording';
    const w = GATE_WAR.filter((x) => text.includes(x)); if (w.length) return `war-tactics wording: ${w.join(', ')}`;
  }
  if (CHANNEL === 'powder') {
    if (t.risk.some((f) => f.flag === 'private individual')) return 'private individual (no public record)';
    if (t.risk.some((f) => f.flag === 'unverified claims') && !FILING.test(text)) return 'allegation-only: no filing, charge or ruling in the headlines';
  }
  return null;
}

const mainEntity = (t) => {
  const order = CHANNEL === 'powder' ? ['organisation/thing', 'person', 'place'] : ['place', 'organisation/thing', 'person'];
  const ok = (t._subjects || []).filter((r) => r.title && !r.isCountry && !r.missing && !r.disambig && !/^(List of|Portal:|\d{4})/.test(r.title) && !JUNK_ENT.test(r.title) && !/\b(scandal|corruption|crime|law|fraud)\b/i.test(r.title.split(' (')[0]) );
  for (const k of order) { const r = ok.find((x) => x.kind === k); if (r) return r; }
  return null;
};
const JUNK_ENT = /^(year|corruption|deception|restraining|ftc|sec|doj|sues|state|states|federal|national|chinese|man|woman|court|judge|trump|white house|us|usa|uk|eu|china|russia|italian|italy|hungary|the|fbi|congress|senate|day|week|today|money|cash|market|economy|inflation|stock|bank|company|government|president|united states)\b/i;
const plainName = (r) => (r.title || r.name).replace(/\s*\(.*\)$/, '');

let WATCH = [];
async function channelRank(newsAll) {
  const vq = loadVidiq(CHANNEL);
  // 1. gate the news topics
  const news = [];
  for (const t of newsAll) { const why = gateReason(t); if (why) DROPPED.push({ title: t.headline, reason: why }); else news.push(t); }
  // 2. attach news to backlog cases (the "news peg"); the rest stay news-only and are de-duplicated by main entity
  const backlog = CH.backlog || [];
  const subj = await resolveTitles(backlog.map((b) => b.wiki));
  const used = new Set(); const cands = [];
  for (const it of backlog) {
    const hits = news.filter((t) => it.match.some((m) => textOfT(t).includes(m)));
    hits.forEach((h) => used.add(h));
    cands.push({ kind: 'backlog', it, hits });
  }
  const byEnt = new Map();
  const loose = news.filter((x) => !used.has(x) && !mainEntity(x));
  const guess = (t) => t.entities.slice(0, 5).map((x) => x.name.replace(/\u2019/g, "'")).filter((n) => n.length > 3 && !JUNK_ENT.test(n));
  const resolvedGuess = loose.length ? await resolveTitles([...new Set(loose.flatMap(guess))]) : new Map();
  const fromHeadline = (t) => { for (const n of guess(t)) { const r = resolvedGuess.get(n); if (r && !r.missing && !r.disambig && r.title && !r.isCountry && !JUNK_ENT.test(r.title) && ['organisation/thing', 'place'].includes(r.kind)) return r; } return null; };
  for (const t of news.filter((x) => !used.has(x)).sort((a, b) => b.total - a.total)) {
    const e = mainEntity(t) || fromHeadline(t); const key = e ? e.title : `~${t.id || t.headline}`;
    if (byEnt.has(key)) { const host = byEnt.get(key).hits[0]; host.angles = [...(host.angles || []), t.headline]; host.stories.push(...t.stories); continue; }
    byEnt.set(key, { kind: 'news', hits: [t], ent: e });
  }
  cands.push(...byEnt.values());
  log(`- opportunity scoring: ${cands.length} candidates (${backlog.length} backlog, ${byEnt.size} news-only)${flag('--yt-search') ? ', YouTube search ON' : ''}`);

  let out = [];
  for (const c of cands) {
    let t;
    if (c.kind === 'backlog') {
      const r = subj.get(c.it.wiki);
      const sj = r && !r.missing ? [r] : [];
      t = c.hits[0] || { stories: [], entities: [], topTerms: [], headline: '', risk: [] };
      for (const h of c.hits.slice(1)) { t.angles = [...(t.angles || []), h.headline]; t.stories.push(...h.stories); }
      t.kind = 'backlog'; t.backlog = c.it; t._text = `${c.it.name} ${c.it.angle}`.toLowerCase();
      t.entities = [{ name: c.it.name, mentions: 1 }, ...(t.entities || [])];
      if (!c.hits.length) t.headline = `${c.it.name}: ${c.it.angle}`;
      t._subjects = sj.length ? sj : (t._subjects || []);
      t.subjects = sj.length ? [{ subject: r.title, kind: r.kind, wikiTitle: r.title, description: r.desc || '', flags: [] }] : (t.subjects || []);
      // backlog entries are curated for the niche, but must still clear the same text gate
      const synth = scoreTopic({ stories: [...t.stories, { title: t._text, origin: 'backlog', outlet: 'backlog' }], subjects: t.subjects });
      if ((synth.breakdown.nicheFit.evidence.offNiche || []).length) { DROPPED.push({ title: c.it.name, reason: `backlog item hits an exclude term: ${synth.breakdown.nicheFit.evidence.offNiche.join(', ')}` }); continue; }
      const real = c.hits.length ? scoreTopic(t) : null;
      t.breakdown = real ? { ...synth.breakdown, momentum: real.breakdown.momentum, conflict: real.breakdown.conflict } : { ...synth.breakdown, momentum: { score: 0, max: 25, evidence: { outlets: 0, stories: 0, origins: [], hnPoints: null, wikiPageviews: null } } };
      t.formula = synth.formula; t.risk = (real || synth).risk.filter((f) => !(f.flag === 'thin sourcing' && !c.hits.length));
      t.topName = c.it.name; t.angleLine = c.it.angle; t.peg = c.hits.length > 0;
      t.opp = await opportunityFor({ channelKey: CHANNEL, entity: c.it.name, queryName: c.it.q, wiki: c.it.wiki, vidiqRows: vq, ytEnabled: flag('--yt-search'), ytOverride: flag('--yt-search') });
    } else {
      t = c.hits[0]; t.kind = 'news'; t.peg = false;
      const e = c.ent; t.topName = e ? plainName(e) : shortHook(t.headline);
      t.angleLine = shortHook(t.headline);
      Object.assign(t, scoreTopic(t));
      if (e) t.opp = await opportunityFor({ channelKey: CHANNEL, entity: plainName(e), wiki: e.title, vidiqRows: vq, ytEnabled: flag('--yt-search'), ytOverride: flag('--yt-search') });
      else t.opp = { entity: null, score: 5, confidence: 'low', confidenceWeight: 0, demand: { score: null }, competitionGap: { score: null }, evergreen: { score: null }, notes: ['no resolvable main entity: demand, gap and evergreen unknown'] };
    }
    const b = t.breakdown;
    t.timeliness = c.kind === 'backlog' && !c.hits.length ? 0 : Math.round(Math.min(10, (b.momentum.score / 25) * 10 + (t.peg ? 2 : 0)) * 10) / 10;
    t.visualArc = Math.round(((b.visual.score + b.arc.score + b.famous.score) / 40) * 100) / 10;
    t.finalScore = Math.round((0.55 * t.opp.score * 10 + 0.30 * t.timeliness * 10 + 0.15 * t.visualArc * 10) * 10) / 10;
    out.push(t);
  }
  out.sort((a, b) => b.finalScore - a.finalScore);
  // second search phrase only for the current top 15 (first-phrase API responses are cached, so this costs one search each)
  for (const t of out.slice(0, 15)) {
    const ent = t.kind === 'backlog' ? [t.backlog.name, t.backlog.wiki] : t.opp.entity ? [t.opp.entity, t.opp.wikiArticle] : null;
    if (!ent || t.opp.demand.source === 'vidiq') continue;
    t.opp = await opportunityFor({ channelKey: CHANNEL, entity: ent[0], queryName: t.kind === 'backlog' ? t.backlog.q : undefined, wiki: ent[1], vidiqRows: vq, ytEnabled: flag('--yt-search'), ytOverride: flag('--yt-search'), apiPhrases: 2 });
    t.finalScore = Math.round((0.55 * t.opp.score * 10 + 0.30 * t.timeliness * 10 + 0.15 * t.visualArc * 10) * 10) / 10;
  }
  out.sort((a, b) => b.finalScore - a.finalScore);
  // Top 10 = medium/high confidence with a measured competition gap. Other news goes to a separate unscored list.
  const eligible = (t) => t.kind === 'backlog' || (t.opp.confidence !== 'low' && t.opp.competitionGap.score != null);
  WATCH = out.filter((t) => !eligible(t)).map((t) => ({ headline: shortHook(t.headline), entity: t.opp.entity || null, timeliness: t.timeliness, why: t.opp.entity ? `entity "${t.opp.entity}" resolved, but demand/competition gap could not be measured (${(t.opp.notes || []).slice(-1)[0] || 'no data'})` : 'no company or route could be resolved from the headline', sources: pickSources(t).slice(0, 2).map((x) => `${x.outlet}: ${x.url}`) }));
  out = out.filter(eligible);
  log(`- YouTube API: ${apiSummary()}`);
  return out.slice(0, TOP);
}

async function radar() {
  const t0 = Date.now();
  const notes = [YOUTUBE_NOTE];
  log(`radar ${DATE}, window ${DAYS} days`);
  log('- publisher feeds'); const F = await feeds({ days: DAYS });
  let CF = [];
  if (CH) { log(`- ${CH.channel} feeds`); CF = await channelFeeds([...(CH.sources.rss || []), ...(CH.sources.rssExtra || [])], { days: DAYS }); }
  const q = CH?.searchQueries || [];
  const gq = []; for (let i = 0; i < q.length; i += 4) gq.push('(' + q.slice(i, i + 4).map((x) => `"${x}"`).join(' OR ') + ')');
  log('- Google News'); const G = await googleNews({ days: DAYS, enabled: flag('--gnews'), ...(CH ? { queries: q.map((x) => ({ q: x, cat: CH.channel })) } : {}) }); notes.push(G.note);
  log('- GDELT (5 s between calls)'); const D = flag('--no-gdelt') ? [] : await gdelt({ days: DAYS, ...(CH ? { queries: gq } : {}) });
  if (!flag('--no-gdelt') && !D.length) notes.push('GDELT returned nothing (rate limit or outage).');
  log('- Wikipedia current events'); const W = await wikiCurrentEvents({ dates: [0, 1, 2].map(dayN) });
  log('- Hacker News'); const H = await hackerNews({ days: DAYS, ...(CH ? { queries: q, minPoints: 10 } : {}) });
  log('- Reddit'); const R = await reddit({ days: DAYS }); if (R.note) notes.push(R.note);
  log('- Wikipedia most-read'); const tops = [await wikiTop(dayN(1)), await wikiTop(dayN(2))];

  // Dedupe by normalised title.
  const seen = new Set();
  const stories = [...W, ...F, ...CF, ...G.stories, ...D, ...H, ...R.stories].filter((s) => {
    const k = s.title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().slice(0, 90);
    if (!k || seen.has(k)) return false; seen.add(k); return true;
  });
  const counts = Object.fromEntries(['feed', 'gnews', 'gdelt', 'wiki-ce', 'hn', 'reddit'].map((o) => [o, stories.filter((s) => s.origin === o).length]));
  if (CH) counts.channelFeed = stories.filter((s) => s.chFeed).length;
  log(`  ${stories.length} unique stories`, counts);

  let topics = cluster(stories).filter((c) => c.stories.length >= 2 || c.stories[0].origin === 'wiki-ce' || (CH && c.stories[0].chFeed));
  topics.forEach((t) => Object.assign(t, scoreTopic(t)));
  if (flag('--debug') && CH) for (const t of [...topics].sort((x, y) => y.breakdown.nicheFit.score - x.breakdown.nicheFit.score).slice(0, 40)) log(`   fit ${t.breakdown.nicheFit.score} x${t.stories.length} ${t.headline.slice(0, 90)} | ${(t.breakdown.nicheFit.evidence.includeHits || []).join(',')} | OFF ${(t.breakdown.nicheFit.evidence.offNiche || []).join(',')}`);
  if (flag('--debug-only')) process.exit(0);
  topics = topics.filter(inNiche).sort((a, b) => b.total - a.total).slice(0, 40);
  log(`  ${topics.length} in-niche candidate topics`);

  // Subjects: Wikipedia links from Current events + recurring headline entities.
  const cand = new Map();
  for (const t of topics) {
    const c = new Map();
    for (const s of t.stories) for (const l of s.wikiLinks || []) c.set(l, (c.get(l) || 0) + 2);
    for (const e of t.entities) if (e.mentions >= 2 || t.stories.length <= 3) c.set(e.name, (c.get(e.name) || 0) + e.mentions);
    t._cand = [...c.entries()].sort((a, b) => b[1] - a[1]).slice(0, 14);
    t._cand = t._cand.map(([n, w]) => [ALIASES[n] || n, w]);
    for (const [n] of t._cand) cand.set(n, 1);
  }
  const lowerWords = new Set(stories.flatMap((s) => `${s.title} ${s.desc || ''}`.match(/(?<![.!?:] )\b[a-z][a-z'-]+\b/g) || []));
  log(`- resolving ${cand.size} names on Wikipedia/Wikidata`);
  const R2 = await resolveTitles([...cand.keys()]);
  for (const t of topics) {
    const picked = []; const titles = new Set(); let countries = 0;
    for (const [n, w] of t._cand) {
      const r = R2.get(n); if (!r) continue;
      if (r.missing || r.disambig) {
        // Unresolved names: keep only if no word is an ordinary word seen in lower case elsewhere (drops 'Resigns Amid').
        if (w >= 2 && /^[A-Z][a-z]+( [A-Z][a-z'-]+){1,2}$/.test(n) && !n.split(' ').some((x) => lowerWords.has(x.toLowerCase()))) picked.push({ r, w });
        continue;
      }
      if (titles.has(r.title) || /^(List of|Portal:|\d{4})/.test(r.title) || /\b(war|crisis|election|protests|relations|conflict|attack|campaign|invasion)\b/i.test(r.title) && r.kind !== 'place' && r.kind !== 'person') { if (!titles.has(r.title)) t.storyArticle ??= r.title; continue; }
      if (r.isCountry) { if (countries++ >= 1) continue; }
      titles.add(r.title); picked.push({ r, w });
    }
    const rank = { person: 0, 'organisation/thing': 1, place: 2, unresolved: 3, other: 4 };
    t._subjects = picked.sort((a, b) => rank[a.r.kind] - rank[b.r.kind] || b.w - a.w).slice(0, 5).map((p) => p.r);
    t.subjects = t._subjects.map((r) => ({ subject: r.title || r.name, kind: r.missing || r.disambig ? 'unresolved' : r.kind, wikiTitle: r.title || null, description: r.desc || '',
      flags: r.missing || r.disambig ? ['no Wikipedia article', 'if this is a person: likely a private individual'] : [] }));
  }

  // Pageview momentum for the lead subject / story article of each topic.
  log('- pageviews');
  for (const t of topics.slice(0, 25)) {
    const arts = [t.storyArticle, ...t._subjects.filter((r) => r.title && !r.isCountry).slice(0, 2).map((r) => r.title)].filter(Boolean);
    let best = null;
    for (const a of arts) {
      const v = await articleViews(a, dayN(1), 10);
      if (v.length < 4) continue;
      const recentPeak = Math.max(...v.slice(-2)), prior = v.slice(0, -2), base = prior.reduce((x, y) => x + y, 0) / prior.length || 1;
      const rec = { article: a, peak: recentPeak, base: Math.round(base), growth: Math.round((recentPeak / base) * 10) / 10 };
      const sj = t.subjects.find((s) => s.wikiTitle === a); if (sj) sj.avgViews = Math.round(base);
      if (!best || rec.growth * Math.log10(rec.peak + 10) > best.growth * Math.log10(best.peak + 10)) best = rec;
    }
    for (const m of tops) for (const a of arts) if (m.has(a)) t.inMostRead = [...new Set([...(t.inMostRead || []), a])];
    t.pageviews = best || {};
    Object.assign(t, scoreTopic(t));
  }
  // One topic per lead person: clusters about the same person (e.g. 4 Nvidia/Huang angles) merge into
  // the strongest one; the absorbed headlines are kept as "angles".
  topics.sort((a, b) => b.total - a.total);
  const byLead = new Map();
  for (const t of [...topics]) {
    const lead = t._subjects.find((r) => r.kind === 'person' && r.title)?.title;
    const host = lead && byLead.get(lead);
    if (!host) { if (lead) byLead.set(lead, t); continue; }
    host.angles = [...(host.angles || []), t.headline];
    host.stories.push(...t.stories);
    for (const r of t._subjects) if (host._subjects.length < 5 && !host._subjects.some((x) => (x.title || x.name) === (r.title || r.name))) host._subjects.push(r);
    for (const sj of t.subjects) if (host.subjects.length < 5 && !host.subjects.some((x) => x.subject === sj.subject)) host.subjects.push(sj);
    if ((t.pageviews?.peak || 0) > (host.pageviews?.peak || 0)) host.pageviews = t.pageviews;
    host.inMostRead = [...new Set([...(host.inMostRead || []), ...(t.inMostRead || [])])];
    topics.splice(topics.indexOf(t), 1);
  }
  for (const t of byLead.values()) Object.assign(t, scoreTopic(t));
  topics = topics.filter(inNiche).sort((a, b) => b.total - a.total);
  topics = CH ? await channelRank(topics) : topics.slice(0, TOP);

  log('- licensed images');
  for (const [i, t] of topics.entries()) {
    t.id = `t${String(i + 1).padStart(2, '0')}-${slug(t.subjects.slice(0, 2).map((s) => s.subject).join(' ') || t.topTerms.slice(0, 3).join(' ') || t.topName || 'topic')}`;
    const imgs = [];
    const war = !!t.breakdown.nicheFit.evidence.categories.war || t.risk.some((f) => f.flag === 'graphic violence');
    if (CH && !t._subjects.length) { /* no resolvable entity photo */ }
    for (const r of t._subjects) imgs.push(await imagesFor(r, { max: 3, stories: t.stories, topicStories: true, war }));
    if (!CH) Object.assign(t, scoreTopic({ ...t, subjects: imgs.map((s) => ({ ...s, avgViews: t.subjects.find((x) => x.subject === s.subject)?.avgViews })) }));
    else t.total = t.finalScore;
    t.images = imgs.map(slimSubject); t.war = war;
  }
  topics.sort((a, b) => b.total - a.total);
  if (CH) for (const t of topics) Object.assign(t, suggestTitle(t));
  topics.forEach((t, i) => { t.rank = i + 1; t.id = t.id.replace(/^t\d\d/, 't' + String(i + 1).padStart(2, '0')); });

  const result = {
    date: DATE, channel: CH ? { key: CHANNEL, name: CH.channel, niche: CH.niche } : undefined, generated: new Date().toISOString(), windowDays: DAYS, storyCounts: counts, notes: [...notes.filter(Boolean), ...imageNotes],
    http: { requests: stats.requests, cacheHits: stats.cacheHits, robotsBlocked: stats.robotsBlocked.length, errors: stats.errors.slice(0, 30) },
    ...(CH ? { opportunitySources: { youtubeApi: { ...oppHealth.ytApi, note: apiSummary() }, youtubeSearch: flag('--yt-search') ? oppHealth.ytSearch : { used: false, note: 'scraped results page not used (robots.txt disallows /results; opt in with --yt-search)' }, autocomplete: oppHealth.autocomplete, wikipediaPageviews: oppHealth.pageviews, vidiq: oppHealth.vidiq }, dropped: DROPPED.slice(0, 60), lowFitCount: LOWFIT, newsToWatch: WATCH } : {}),
    topics: topics.map(toJSON),
  };
  mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, 'radar.json'), JSON.stringify(result, null, 1));
  writeFileSync(join(OUT, 'radar.md'), toMarkdown(result));
  log(`done in ${Math.round((Date.now() - t0) / 1000)} s -> ${join(OUT, 'radar.md')}`);
  for (const t of result.topics) console.log(`${String(t.rank).padStart(2)}. [${t.score.total}] ${t.id}: ${t.hook}`);
}

function shortHook(h) {
  h = h.replace(/\s+/g, ' ').trim();
  if (h.length <= 140) return h;
  const first = h.match(/^(.{40,140}?[.;])\s/);
  return first ? first[1] : h.slice(0, 137).replace(/\s+\S*$/, '') + '...';
}

function pickSources(t) {
  const pref = { 'wiki-ce': 0, feed: 1, gnews: 1, gdelt: 2, hn: 3, reddit: 4 };
  const out = []; const used = new Set();
  for (const s of [...t.stories].sort((a, b) => pref[a.origin] - pref[b.origin] || (b.published || '').localeCompare(a.published || ''))) {
    const urls = s.origin === 'wiki-ce' ? s.refs : [s.url];
    for (const u of urls || []) { const h = hostOf(u); if (!h || used.has(h)) continue; used.add(h); out.push({ title: s.title.slice(0, 140), outlet: s.origin === 'wiki-ce' ? h : s.outlet, url: u, published: s.published, via: s.origin }); }
    if (s.hnUrl && !used.has('news.ycombinator.com')) { used.add('news.ycombinator.com'); out.push({ title: `HN discussion (${s.points} points)`, outlet: 'Hacker News', url: s.hnUrl, via: 'hn' }); }
    if (out.length >= 5) break;
  }
  return out.slice(0, 5);
}

function toJSON(t) {
  const sources = pickSources(t);
  const latest = t.stories.map((s) => s.published).filter(Boolean).sort().pop();
  const outlets = t.breakdown.momentum.evidence.outlets;
  const pv = t.pageviews?.peak ? `; Wikipedia "${t.pageviews.article}" ${t.pageviews.peak.toLocaleString('en-US')} views/day (x${t.pageviews.growth} vs prior week)` : '';
  const hn = t.breakdown.momentum.evidence.hnPoints ? `; HN ${t.breakdown.momentum.evidence.hnPoints} points` : '';
  const ce = t.stories.some((s) => s.origin === 'wiki-ce') ? '; on Wikipedia Current events' : '';
  return {
    id: t.id, rank: t.rank, ...(CH ? { suggestedTitle: t.suggestedTitle, titleNote: t.titleNote, channelFit: t.breakdown.nicheFit.evidence.includeHits } : {}), hook: shortHook(t.headline), hookNote: 'draft hook = most central headline; rewrite via the script-writer agent',
    whyNow: CH && t.kind === 'backlog' && !t.stories.length ? `evergreen backlog case; no matching news in the last ${DAYS} days${pv}` : `${t.kind === 'backlog' ? 'NEWS PEG on an evergreen case: ' : ''}${outlets} outlets / ${t.stories.length} stories in the last ${DAYS} days (latest ${latest?.slice(0, 16).replace('T', ' ') || '?'} UTC)${pv}${hn}${ce}${t.inMostRead ? `; in Wikipedia top-1000 most-read: ${t.inMostRead.join(', ')}` : ''}.`,
    angles: (t.angles || []).map(shortHook), keyTerms: t.topTerms.slice(0, 8), score: { total: t.total, formula: t.formula, breakdown: t.breakdown }, risk: t.risk, sources,
    warTopic: !!t.war, images: t.images || [],
    storyCount: t.stories.length,
    ...(CH ? { kind: t.kind, topic: t.topName, angle: t.angleLine, newsPeg: t.peg, timeliness: t.timeliness, visualArc: t.visualArc, finalScore: t.finalScore, opportunity: t.opp } : {}),
  };
}

const md = (s) => String(s ?? '').replace(/\|/g, '/').replace(/\n/g, ' ');
function toMarkdown(r) {
  const L = [`# Topic radar - ${r.date}${r.channel ? ` - ${r.channel.name} (${r.channel.niche})` : ''}`, '', `Window: last ${r.windowDays} days. Stories: ${Object.entries(r.storyCounts).map(([k, v]) => `${k} ${v}`).join(', ')}. Generated ${r.generated}.`, '',
    'Score = (momentum 25 + famous 15 + conflict 15 + arc 15 + visual 10 + evergreen 10) x (0.5 + nicheFit/20) - risk penalties. Photos: tier 1 = free licence / public domain, tier 2 = press kit, tier 3 = news photo (copyrighted, credited). Credit every photo on its card and in the YouTube description. Every photo stays `contentCheck: pending` until the producer views it and sets "ok - <what it shows>".', ''];
  if (r.notes.length) L.push('**Source notes**', ...r.notes.map((n) => `- ${n}`), '');
  if (r.channel) {
    const n = (x) => (x == null ? 'n/a' : x);
    L.push('**Ranking:** final = 55% opportunity (demand x competition gap x evergreen, geometric mean, unknown part = neutral 5) + 30% timeliness (news momentum, +2 with a news peg) + 15% visual/arc. 0-10 sub-scores; competition gap: higher = less crowded.', '',
      '| # | topic | angle | demand | competition gap | evergreen/growth | timeliness | confidence | why now |', '|---|---|---|---|---|---|---|---|---|',
      ...r.topics.map((t) => `| ${t.rank} | **${md(t.topic)}** (${t.kind}) | ${md(t.angle).slice(0, 110)} | ${n(t.opportunity.demand.score)} | ${n(t.opportunity.competitionGap.score)} | ${n(t.opportunity.evergreen.score)} | ${t.timeliness} | ${t.opportunity.confidence} | ${md(t.whyNow).slice(0, 100)} |`), '',
      '**Opportunity sources:** ' + Object.entries(r.opportunitySources).map(([k, v]) => `${k}: ${v.note || (v.file ? 'file ' + v.file + ', matched ' + v.matched : `ok ${v.ok ?? 0} / failed ${v.fail ?? 0}`)}`).join('; '), '');
  } else L.push('| # | score | topic | hook |', '|---|---|---|---|', ...r.topics.map((t) => `| ${t.rank} | ${t.score.total} | \`${t.id}\` | ${md(t.hook)} |`), '');
  if (r.channel) L.push('**Draft working titles** (draft; the script writer rewrites it)', '', ...r.topics.map((t) => `- ${t.rank}. ${t.suggestedTitle}`), '');
  for (const t of r.topics) {
    const b = t.score.breakdown;
    L.push(`## ${t.rank}. ${md(t.hook)}`, '', `- **id:** \`${t.id}\`  - **score ${t.score.total}**`, ...(t.opportunity ? [`- **opportunity ${t.opportunity.score}/10, confidence ${t.opportunity.confidence}:** demand ${t.opportunity.demand.score ?? 'n/a'} (${t.opportunity.demand.source || 'no source'}), competition gap ${t.opportunity.competitionGap.score ?? 'n/a'} (${t.opportunity.competitionGap.source || 'no source'}), evergreen ${t.opportunity.evergreen.score ?? 'n/a'}${t.opportunity.evergreen.evidence ? ` (median ${t.opportunity.evergreen.evidence.medianMonthly}/month, last 6 months x${t.opportunity.evergreen.evidence.trendRatio} vs prior 12, peak/median ${t.opportunity.evergreen.evidence.maxOverMedian}${t.opportunity.evergreen.evidence.spikePenalty ? ', spike penalty' : ''})` : ''}; phrases: ${(t.opportunity.phrases || []).join(' / ')}; ${(t.opportunity.notes || []).join('; ')}`] : []), ...(t.suggestedTitle ? [`- **working title:** ${md(t.suggestedTitle)} _(${t.titleNote})_`, `- **niche terms hit:** ${t.channelFit.join(', ')}`] : []), `- **why now:** ${t.whyNow}`, ...(t.angles.length ? [`- **other angles:** ${t.angles.map(md).join(' / ')}`] : []), `- **key terms:** ${t.keyTerms.join(', ')}`,
      `- **breakdown:** momentum ${b.momentum.score}/25, famous ${b.famous.score}/15, conflict ${b.conflict.score}/15, arc ${b.arc.score}/15, visual ${b.visual.score}/10, evergreen ${b.evergreen.score}/10, niche fit ${b.nicheFit.score}/10`,
      `  - conflict words: ${b.conflict.evidence.join(', ') || '-'}; twist words: ${b.arc.evidence.twistWords.join(', ') || '-'}; visual: ${[...b.visual.evidence.objects, ...b.visual.evidence.places].join(', ') || '-'}`,
      `- **risk flags:** ${t.risk.length ? t.risk.map((f) => `**${f.flag}** (-${f.penalty}): ${f.detail}`).join('; ') : 'none detected'}`, '', '**Sources**', ...t.sources.map((s) => `- ${md(s.outlet)}: [${md(s.title)}](${s.url})`), '');
    L.push(`**Photos**${t.warTopic ? ' (war/attack topic: prefer places, maps, leaders, documents over scene photos)' : ''}`, '', '| subject | photo | licence | credit | date | notes |', '|---|---|---|---|---|---|');
    for (const s of t.images) {
      const fl = s.flags.length ? md(s.flags.join('; ')) : '';
      if (!s.images.length) L.push(`| ${md(s.subject)} (${s.kind}) | none found | - | - | - | ${md(s.note)} ${fl} |`);
      s.images.slice(0, 4).forEach((i, k) => L.push(`| ${k === 0 ? `**${md(s.subject)}** (${s.kind})` : ''} | ${k === s.best ? '**best** ' : ''}[photo](${i.url}) / [source](${i.source}) | ${md(i.licence)}${i.usGov ? ' (US Gov)' : ''} | ${md((i.credit || '?').slice(0, 70))} | ${i.date || i.uploaded || '?'} | ${[i.contentCheck, i.avoid, i.warNote, i.relevance, k === 0 ? fl : ''].filter(Boolean).map(md).join('; ')} |`));
      if (s.pressKit) L.push(`| | [newsroom](${s.pressKit.url}) | press kit | company | - | ${md(s.pressKit.note)} |`);
    }
    L.push('');
  }
  if (r.newsToWatch?.length) L.push('## News to watch (not scored)', '', 'In-niche news with no resolvable company/route or no measurable demand and competition gap. Not part of the top 10.', '', ...r.newsToWatch.map((w) => `- ${md(w.headline)} - ${md(w.why)}${w.sources.length ? ' (' + w.sources.map(md).join('; ') + ')' : ''}`), '');
  if (r.dropped?.length || r.lowFitCount) L.push('## Appendix: dropped by the niche gate (not part of the ranking)', '', `Also ${r.lowFitCount || 0} weak-fit clusters below the first niche threshold were discarded silently.`, '', ...r.dropped.map((d) => `- ${md(d.title).slice(0, 110)} - ${md(d.reason)}`), '');
  return L.join('\n');
}

async function download(id) {
  const file = join(OUT, 'radar.json');
  if (!existsSync(file)) { log(`no ${file}; run the radar first (or pass --date)`); process.exit(1); }
  const r = JSON.parse(readFileSync(file, 'utf8'));
  const t = r.topics.find((x) => x.id === id || x.id.startsWith(id + '-') || x.id.startsWith(id));
  if (!t) { log(`topic ${id} not found. ids: ${r.topics.map((x) => x.id).join(', ')}`); process.exit(1); }
  const dest = resolve(opt('--dest', join(OUT, t.id)));
  const max = Number(opt('--max', 99)), perSubject = Number(opt('--per-subject', 1));
  if (!t.images) { log('topic has no images'); process.exit(1); }
  mkdirSync(join(dest, 'photos'), { recursive: true });
  const manifest = {}; const credits = [`Photo credits - ${t.hook}`, `Topic ${t.id}, radar ${r.date}. Tier 1 free licence / PD, tier 2 press kit, tier 3 news photo (copyrighted, credited).`, ''];
  let n = 0;
  const desc = [];
  for (const s of t.images) {
    let k = 0;
    const order = s.best != null ? [s.images[s.best], ...s.images.filter((_, j) => j !== s.best)] : s.images;
    for (const i of order.filter((x) => x.contentCheck !== 'rejected-keyword')) {
      if (n >= max || k >= perSubject) break;
      const key = slug(s.subject).replace(/-/g, '_').slice(0, 24) + (k ? `_${k + 1}` : '');
      let buf;
      try { buf = await getBinary(i.url); } catch (e) { log(`  failed ${i.url}: ${e.message}`); continue; }
      const ext = buf[0] === 0x89 ? 'png' : buf[0] === 0x52 ? 'webp' : 'jpg';
      writeFileSync(join(dest, 'photos', `${key}.${ext}`), buf);
      const who = (i.author || i.credit || 'Unknown').slice(0, 120);
      const repo = i.repo || 'source';
      const credit = i.tier === 1 ? `Photo: ${who} / ${repo} · ${i.licence}` : i.tier === 2 ? `Photo: ${i.credit} (press kit)` : `Photo: ${i.credit}`;
      manifest[key] = {
        file: `photos/${key}.${ext}`, page: i.source, licence: i.licence, licenceUrl: i.licenceUrl || null, author: who,
        credit, w: i.w, h: i.h, modified: false, source: i.file ? i.file.replace(/^File:/, '') : i.url,
        cardCredit: credit.replace(/^Photo: /, ''), checked: `${new Date().toISOString().slice(0, 10)} via topic radar (${i.tier === 1 ? 'Wikimedia file metadata' : 'article og:image'})`,
        contentCheck: i.contentCheck, ...(i.avoid ? { avoid: i.avoid } : {}),
      };
      credits.push(`${key}.${ext}: ${s.subject} - ${credit.replace(/^Photo: /, '')} - ${i.source}${i.date ? ` - ${i.date}` : ''} - contentCheck: ${i.contentCheck}${i.avoid ? ' - ' + i.avoid : ''}`);
      desc.push(`${s.subject}: ${credit.replace(/^Photo: /, '')} (${i.source})`);
      n++; k++; log(`  saved ${key}.${ext}`);
    }
    if (!k) credits.push(`(${s.subject}: no photo${s.flags?.length ? ' - ' + s.flags.join('; ') : ''})`);
  }
  credits.push('', 'YouTube description source note:', 'Photos: ' + desc.join('; '), '', 'Before use: view every photo and set "contentCheck" in photos.json to "ok - <what it shows>" (no gore, bodies, killings, torture, children in distress or sexual content).');
  credits.push('', 'If you crop/greyscale a photo, set "modified": true in photos.json and add "(modified: ...)" to the credit, as in nvidia_v4.');
  writeFileSync(join(dest, 'photos.json'), JSON.stringify(manifest, null, 1));
  writeFileSync(join(dest, 'credits.txt'), credits.join('\n'));
  log(`${n} images -> ${dest}`);
}

// Dispatch last, so every const above is initialised.
if (opt('--download')) await download(opt('--download'));
else if (opts('--subject').length) await subjectsOnly(opts('--subject'));
else await radar();
