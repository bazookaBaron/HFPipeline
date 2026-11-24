// Subject resolution (Wikipedia REST + Wikidata) and photo lookup for each subject.
//
// Image rules (user decision 2026-11-15):
//   tier 1  free licence / public domain (Wikimedia, US Gov)      licence = "CC BY 4.0" / "public domain" / ...
//   tier 2  company press kit / official newsroom                 licence = "press kit"
//   tier 3  news photos (article og:image) and fair-use files      licence = "copyrighted, credited"
// Every photo carries a credit + source URL; the film credits it on the card and in the YouTube description.
// Getty Images: kept but marked "avoid if an alternative exists". AI-generated images are excluded.
// Content filter: every image starts as contentCheck "pending" (a human must view it);
// caption/title keyword hits (gore, bodies, killings, sexual content...) become "rejected-keyword".
import { getJSON, getText, qs, UA, isBlocked } from './net.mjs';
import { decode, gdeltSearch } from './sources.mjs';
import { PRESS_KITS } from './config.mjs';

const WP = 'https://en.wikipedia.org/w/api.php';
const WREST = 'https://en.wikipedia.org/api/rest_v1';
const WD = 'https://www.wikidata.org/w/api.php';
const COMMONS = 'https://commons.wikimedia.org/w/api.php';
const chunk = (a, n) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));
const strip = (s = '') => String(s).replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
const hostOf = (u) => { try { return new URL(u).host.replace(/^www\./, ''); } catch { return ''; } };
const BAD_FILE = /(logo|icon|flag[_ ]of|signature|coat[_ ]of[_ ]arms|symbol|seal[_ .]|emblem|wordmark|commons-logo|wiki|edit-clear|question[_ ]book|ambox|padlock|diagram|chart|graph|blank|portal|crystal|nuvola|disambig|increase|decrease|steady|red[_ ]pog|speaker[_ ]icon|loudspeaker)/i;
const MAP_FILE = /(map|locator|location)/i;
export const AI_RE = /\b(ai[- ]generated|generated (by|with|using) ai|midjourney|dall[- ]?e|stable diffusion|ai[- ]image|deepfake|synthetic image|ai art|imagined by ai|flux\.1|ai illustration)\b/i;
export const CONTENT_RE = /\b(body|bodies|corpse|corpses|killed|killing|killings|execution|executed|blood|bloody|bloodied|massacre|victim|victims|dead|gore|gory|torture|tortured|behead\w*|mutilat\w*|child abuse|abused child|naked|nude|nudity|sexual|porn\w*|wounded|injured|casualt\w*|carnage|morgue|funeral|coffin|grave)\b/i;
const GETTY_RE = /getty/i;
const PRESS_HOSTS = { nvidia: ['nvidianews.nvidia.com', 'blogs.nvidia.com', 'nvidia.com'], apple: ['apple.com'], microsoft: ['news.microsoft.com', 'blogs.microsoft.com'], google: ['blog.google'], alphabet: ['blog.google'], meta: ['about.fb.com'], amazon: ['aboutamazon.com', 'press.aboutamazon.com'], tesla: ['tesla.com'], openai: ['openai.com'], intel: ['newsroom.intel.com', 'intel.com'], tsmc: ['pr.tsmc.com'], samsung: ['news.samsung.com'], huawei: ['huawei.com'] };
const GOV_HOSTS = /(^|\.)((whitehouse|state|defense|army|navy|af|congress|senate|house|justice|treasury|commerce|fbi|cia)\.(gov|mil))$/;
let commonsReachable = null;
let gdeltBudget = 30;
export const setGdeltBudget = (n) => { gdeltBudget = n; };
export const imageNotes = [];
const note = (s) => { if (!imageNotes.includes(s)) imageNotes.push(s); };

const PLACE_TYPES = new Set(['Q6256', 'Q515', 'Q1549591', 'Q5119', 'Q3624078', 'Q35657', 'Q1637706', 'Q200250', 'Q486972', 'Q23442', 'Q82794', 'Q3957', 'Q1093829', 'Q7275', 'Q107390', 'Q15284', 'Q1221156', 'Q41176', 'Q811979']);

export async function resolveTitles(names) {
  const out = new Map();
  for (const name of [...new Set(names)].filter((n) => n && n.length < 120)) {
    const j = await getJSON(`${WREST}/page/summary/${encodeURIComponent(name.replace(/ /g, '_'))}?redirect=true`, { ttlH: 72, quiet: true });
    if (!j || !j.title || j.type === 'no-extract' && !j.wikibase_item) { out.set(name, { name, missing: true }); continue; }
    const src = j.originalimage?.source || '';
    const file = src ? decodeURIComponent(src.split('/').pop()).replace(/_/g, ' ') : null;
    out.set(name, { name, title: j.title, desc: j.description || '', extract: j.extract || '', qid: j.wikibase_item, disambig: j.type === 'disambiguation', pageImage: file });
  }
  const qids = [...new Set([...out.values()].map((r) => r.qid).filter(Boolean))];
  const wd = new Map();
  for (const part of chunk(qids, 12)) {
    const j = await getJSON(`${WD}?${qs({ action: 'wbgetentities', ids: part.join('|'), props: 'claims', format: 'json' })}`, { ttlH: 168 });
    for (const [id, e] of Object.entries(j?.entities || {})) {
      const c = e.claims || {};
      const vals = (p) => (c[p] || []).map((x) => x.mainsnak?.datavalue?.value).filter(Boolean);
      wd.set(id, { p31: vals('P31').map((v) => v.id), p18: vals('P18'), bioguide: vals('P1157')[0] || null, coords: !!c.P625, website: vals('P856')[0] || null });
    }
  }
  for (const r of out.values()) {
    const w = r.qid && wd.get(r.qid);
    if (!w) { // Wikidata unavailable (rate limit): classify from the Wikipedia short description
      const d = (r.desc || '') + ' ' + (r.extract || '').slice(0, 160);
      r.kind = r.missing ? 'unresolved' : /\((born )?(c\. )?\d{4}|\b(born|politician|businessman|businesswoman|executive|entrepreneur|president of|prime minister|minister|actor|actress|journalist|general|officer|diplomat|lawyer|singer|monarch|king|queen|leader)\b/i.test(r.desc || '') ? 'person'
        : /\b(country|city|capital|state in|province|region|island|town|village|mountain|river|sea|strait|building|residence|district)\b/i.test(d) ? 'place' : 'organisation/thing';
      r.isCountry = /\bcountry\b/i.test(r.desc || ''); r.kindFrom = 'description';
      continue;
    }
    r.kind = w.p31.includes('Q5') ? 'person' : (w.coords || w.p31.some((x) => PLACE_TYPES.has(x))) ? 'place' : 'organisation/thing';
    r.isCountry = w.p31.includes('Q6256') || w.p31.includes('Q3624078');
    r.p18 = w.p18; r.bioguide = w.bioguide; r.website = w.website;
  }
  return out;
}

async function checkCommons() {
  if (commonsReachable !== null) return commonsReachable;
  const j = await getJSON(`${COMMONS}?action=query&meta=siteinfo&format=json`, { ttlH: 6, quiet: true });
  commonsReachable = !!j?.query;
  note(commonsReachable ? 'commons.wikimedia.org API reachable on this run: used for newest-first name search of Commons files.'
    : 'commons.wikimedia.org unreachable: Wikimedia photos limited to files on the en.wikipedia article + Wikidata P18.');
  return commonsReachable;
}

async function commonsSearch(name, limit = 30) {
  if (!(await checkCommons())) return [];
  const j = await getJSON(`${COMMONS}?${qs({ action: 'query', list: 'search', srsearch: `"${name}" filetype:bitmap`, srnamespace: 6, srlimit: limit, srsort: 'create_timestamp_desc', format: 'json', formatversion: 2 })}`, { ttlH: 24, quiet: true });
  return (j?.query?.search || []).map((s) => s.title);
}

async function articleFiles(title) {
  const j = await getJSON(`${WREST}/page/media-list/${encodeURIComponent(title.replace(/ /g, '_'))}`, { ttlH: 72, quiet: true });
  return (j?.items || []).filter((i) => i.type === 'image').map((i) => i.title);
}

function wikiLicence(m) {
  const lic = strip(m.LicenseShortName?.value), url = strip(m.LicenseUrl?.value);
  const credit = strip(m.Credit?.value), artist = strip(m.Artist?.value), terms = strip(m.UsageTerms?.value);
  const nonFree = String(m.NonFree?.value || '').toLowerCase() === 'true' || /fair use|non-free/i.test(lic + terms);
  const usGov = /PD-USGov|United States (federal )?government|White House|whitehouse\.gov|DVIDS|U\.S\. (Army|Navy|Air Force|Marine|Department|Senate|House)|Department of (State|Defense)|official (portrait|photo)/i.test(lic + ' ' + credit + ' ' + artist + ' ' + strip(m.ImageDescription?.value));
  let tier, licence;
  if (nonFree) { tier = 3; licence = 'copyrighted, credited'; }
  else if (/public domain|^pd|cc0|cc-zero|no restrictions/i.test(lic)) { tier = 1; licence = /cc0|zero/i.test(lic) ? 'public domain (CC0)' : 'public domain'; }
  else if (/cc[- ]by|gfdl|free art|ogl|open government/i.test(lic)) { tier = 1; licence = lic; }
  else if (/creativecommons\.org\/licenses\/by(-sa)?\/(\d\.\d)/i.test(url)) { const m = url.match(/licenses\/(by(?:-sa)?)\/(\d\.\d)/i); tier = 1; licence = `CC ${m[1].toUpperCase()} ${m[2]}${lic ? ` (${lic})` : ''}`; }
  else { tier = 3; licence = 'copyrighted, credited'; }
  return { tier, licence, licenceDetail: lic || null, licenceUrl: url || null, author: artist || null, credit: artist || credit || null, usGov: tier === 1 && usGov, shareAlike: /SA/.test(lic), personalityRights: /personality/i.test(strip(m.Restrictions?.value) + terms), fairUse: nonFree };
}

async function fileInfo(files) {
  const out = [];
  const params = (part) => qs({ action: 'query', titles: part.join('|'), prop: 'imageinfo|categories', cllimit: 50, iiprop: 'url|extmetadata|size|timestamp|mime', iiurlwidth: 1600, iiextmetadatafilter: 'LicenseShortName|LicenseUrl|Artist|Credit|DateTimeOriginal|NonFree|UsageTerms|ImageDescription|Restrictions|ObjectName', format: 'json', formatversion: 2 });
  for (const part of chunk([...new Set(files)], 40)) {
    let j = await getJSON(`${WP}?${params(part)}`, { ttlH: 72, quiet: true });
    if (!j?.query && (await checkCommons())) { j = await getJSON(`${COMMONS}?${params(part)}`, { ttlH: 72, quiet: true }); if (j) note('en.wikipedia action API rate-limited (429) on this run: file metadata read from the Commons API instead (fair-use files hosted only on en.wikipedia are missed).'); }
    for (const p of j?.query?.pages || []) {
      const ii = p.imageinfo?.[0]; if (!ii) continue;
      const m = ii.extmetadata || {};
      const cats = (p.categories || []).map((c) => c.title).join(' ');
      const name = p.title.replace(/^File:/, '');
      const desc = strip(m.ImageDescription?.value).slice(0, 240);
      if (AI_RE.test(name + ' ' + desc + ' ' + cats) || /AI-generated|Midjourney|DALL-E/i.test(cats)) continue; // never AI images
      const mimeOk = /^image\/(jpeg|png|tiff|webp)/.test(ii.mime || '') || (/^image\/svg/.test(ii.mime || '') && MAP_FILE.test(name));
      if (!mimeOk) continue;
      const dto = strip(m.DateTimeOriginal?.value).match(/(\d{4})(?:[-:](\d\d))?(?:[-:](\d\d))?/);
      const repo = /commons\.wikimedia/.test(ii.descriptionurl || '') || p.imagerepository === 'shared' ? 'Wikimedia Commons' : 'Wikipedia';
      out.push({
        source: ii.descriptionurl || `https://commons.wikimedia.org/wiki/${encodeURIComponent(p.title.replace(/ /g, '_'))}`, file: p.title, name, repo,
        url: ii.thumburl || ii.url, original: ii.url, w: ii.thumbwidth || ii.width, h: ii.thumbheight || ii.height,
        date: dto ? [dto[1], dto[2], dto[3]].filter(Boolean).join('-') : null, uploaded: ii.timestamp?.slice(0, 10) || null, caption: desc, kind: MAP_FILE.test(name) ? 'map' : 'photo',
        ...wikiLicence(m),
      });
    }
  }
  return out;
}

function creditFrom(html, imgUrl) {
  if (!html) return null;
  const m = html.match(/"creditText"\s*:\s*"([^"]{2,120})"/) || html.match(/"copyrightHolder"\s*:\s*\{[^}]*?"name"\s*:\s*"([^"]{2,80})"/)
    || html.match(/data-(?:photo-)?credit="([^"]{2,120})"/) || html.match(/<(?:span|div|p|small)[^>]*class="[^"]*(?:photo-credit|image-credit|caption-credit|credit)[^"]*"[^>]*>([\s\S]{2,200}?)<\/(?:span|div|p|small)>/i);
  if (m) { const c = decode(m[1]); if (c && c.length < 150) return c; }
  const fn = (imgUrl || '').split('/').pop().split('?')[0].slice(0, 28);
  const i = fn.length > 6 ? html.indexOf(fn) : -1;
  const win = i >= 0 ? html.slice(Math.max(0, i - 2000), i + 2000) : '';
  const a = win.match(/(Getty Images|Reuters|AP Photo|Associated Press|AFP|Bloomberg|EPA|Shutterstock|Pool photo|Xinhua|Sputnik|TASS)/i);
  return a ? a[1] : null;
}
const metaTag = (html, prop) => { const m = html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]*content=["']([^"']+)["']`, 'i')) || html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["']${prop}["']`, 'i')); return m ? decode(m[1]) : null; };

// Find a photo inside an article whose caption / alt text names the subject.
function photoInArticle(html, base, name) {
  const n = name.toLowerCase();
  const abs = (u) => { try { return new URL(decode(u), base).href; } catch { return null; } };
  const srcOf = (tagHtml) => { const m = tagHtml.match(/\s(?:data-src|src)=["']([^"']+)["']/i) || tagHtml.match(/\ssrcset=["']([^"'\s,]+)/i); return m && !/^data:/.test(m[1]) ? abs(m[1]) : null; };
  for (const f of html.match(/<figure[\s\S]{0,6000}?<\/figure>/gi) || []) {
    const cap = decode((f.match(/<figcaption[\s\S]*?<\/figcaption>/i) || [''])[0]);
    const img = f.match(/<img[^>]+>/i); if (!img) continue;
    const alt = decode((img[0].match(/\salt=["']([^"']*)["']/i) || [])[1] || '');
    if ((cap + ' ' + alt).toLowerCase().includes(n)) { const src = srcOf(img[0]); if (src) return { src, caption: (cap || alt).slice(0, 240) }; }
  }
  for (const img of html.match(/<img[^>]+>/gi) || []) {
    const alt = decode((img.match(/\salt=["']([^"']*)["']/i) || [])[1] || '');
    if (alt.toLowerCase().includes(n)) { const src = srcOf(img); if (src) return { src, caption: alt.slice(0, 240) }; }
  }
  return null;
}
const AGENCY_IN = /(Getty Images|Reuters|AP Photo|Associated Press|AFP|Bloomberg|EPA|Shutterstock|Xinhua|Sputnik|TASS|Pool)/i;

// News / press-kit / official-site photos for a subject (caption-matched photo, else og:image).
async function newsPhotos(r, ctx) {
  const name = (r.title || r.name).replace(/\s*\(.*\)$/, '');
  const parts = name.split(' ');
  const surname = parts.length > 1 ? parts[parts.length - 1] : null;
  const isPersonish = r.kind === 'person' || r.kind === 'unresolved';
  const inTitle = (t) => { const l = t.toLowerCase(); return l.includes(name.toLowerCase()) || (isPersonish && ctx.topicStories && surname && surname.length > 3 && r.kind === 'person' && l.includes(surname.toLowerCase())); };
  let cands = (ctx.stories || []).filter((s) => s.url && inTitle(s.title)).map((s) => ({ ...s, titleHit: true }));
  const companyKey = Object.keys(PRESS_HOSTS).find((k) => new RegExp(`\\b${k}\\b`, 'i').test(`${r.title || ''} ${r.desc || ''} ${(r.extract || '').slice(0, 400)}`));
  if (gdeltBudget > 0 && r.kind !== 'place') {
    gdeltBudget--; // GDELT matches the phrase anywhere in the article, not just the headline
    cands.push(...(await gdeltSearch(name, { days: 30 })).map((s) => ({ ...s, titleHit: inTitle(s.title) })));
    if (companyKey && r.kind === 'person' && gdeltBudget > 0) { gdeltBudget--; cands.push(...(await gdeltSearch(name, { domain: PRESS_HOSTS[companyKey][0], days: 365 })).map((s) => ({ ...s, titleHit: true, pressDomain: true }))); }
  } else if (gdeltBudget <= 0) note('GDELT photo-search budget used up for this run: later subjects only use photos from the stories already gathered.');
  const seen = new Set();
  cands = cands.filter((s) => { if (seen.has(s.url)) return false; seen.add(s.url); return true; })
    .sort((a, b) => !!b.pressDomain - !!a.pressDomain || !!b.titleHit - !!a.titleHit || (b.published || '').localeCompare(a.published || ''));
  const out = []; const imgSeen = new Set(); let fetched = 0;
  for (const s of cands.slice(0, 12)) {
    if (out.length >= 4) break;
    if (AI_RE.test(s.title)) continue;
    const host = hostOf(s.url);
    const press = !!companyKey && PRESS_HOSTS[companyKey].some((h) => host === h || host.endsWith('.' + h));
    const gov = GOV_HOSTS.test(host);
    let img = null, caption = '', credit = s.imageCredit || null, relevance = null;
    if (fetched < (r.kind === 'unresolved' ? 8 : 5)) {
      fetched++;
      const html = await getText(s.url, { ttlH: 24, quiet: true }); // robots.txt checked inside
      if (html) {
        const hit = photoInArticle(html, s.url, name) || (surname && r.kind === 'person' ? photoInArticle(html, s.url, surname) : null);
        if (hit) { img = hit.src; caption = hit.caption; relevance = 'caption names the subject'; credit = credit || (caption.match(AGENCY_IN) || [])[1] || null; }
        else if (s.titleHit) { img = metaTag(html, 'og:image') || s.image; caption = metaTag(html, 'og:image:alt') || ''; relevance = 'headline names the subject; lead image not verified to show them'; }
        if (img) credit = credit || creditFrom(html, img);
      }
    }
    if (!img && s.titleHit && s.image) { img = s.image; relevance = 'headline names the subject; lead image not verified to show them'; }
    if (!img) continue;
    if (/\.svg($|\?)|logo|placeholder|default[-_]?(share|og|social)|\/icons?\//i.test(img) || AI_RE.test(caption)) continue;
    const k = img.split('?')[0]; if (imgSeen.has(k)) continue; imgSeen.add(k);
    const outlet = s.outlet || host;
    out.push({
      tier: gov ? 1 : press ? 2 : 3, licence: gov ? 'public domain (US Gov site; verify)' : press ? 'press kit' : 'copyrighted, credited',
      credit: credit ? `${credit} via ${outlet}` : `${outlet} (photographer not stated)`, author: credit || null, outlet,
      source: s.url, url: img, original: img, date: s.published?.slice(0, 10) || null, uploaded: null, caption: (caption || s.title).slice(0, 240),
      headline: s.title, kind: 'news-photo', getty: GETTY_RE.test((credit || '') + ' ' + caption + ' ' + img), relevance,
    });
  }
  return out;
}

// Look up photos for one subject. `r` is a resolved record from resolveTitles (or {name, missing}).
// ctx: { stories: [...topic stories with .image], war: bool, max }
export async function imagesFor(r, ctx = {}) {
  const max = ctx.max ?? 4;
  const res = { subject: r.title || r.name, wikiTitle: r.title || null, kind: r.kind || 'unresolved', description: r.desc || '', flags: [], images: [], best: null, newest: null, pressKit: null, note: '' };
  if (r.missing || r.disambig) {
    res.kind = 'unresolved'; res.subject = r.name;
    res.flags.push(r.disambig ? 'ambiguous name (Wikipedia disambiguation page)' : 'no Wikipedia article');
    if (/^[A-Z][a-z]+( [A-Z][a-z'-]+){1,2}$/.test(r.name)) res.flags.push('PRIVATE INDIVIDUAL? not a public figure on Wikipedia: showing their face may be inappropriate and defamation-sensitive; prefer a silhouette / no face unless major outlets publish it and the film needs it');
  }
  let wiki = [];
  if (!(r.missing || r.disambig)) {
    const surname = r.kind === 'person' ? r.title.replace(/\s*\(.*\)$/, '').split(' ').pop().toLowerCase() : null;
    const cand = new Set();
    for (const f of await articleFiles(r.title)) if (!BAD_FILE.test(f) && (r.kind === 'place' || !MAP_FILE.test(f))) cand.add(f);
    for (const f of r.p18 || []) cand.add('File:' + f);
    if (r.pageImage) cand.add('File:' + r.pageImage);
    const fromArticle = new Set(cand);
    // Newest-first Commons search only for people, and only files whose NAME carries the surname
    // (for places/orgs it returns random files that merely mention the name).
    const searched = new Set();
    if (surname) for (const f of await commonsSearch(r.title.replace(/\s*\(.*\)$/, ''))) if (!BAD_FILE.test(f) && f.toLowerCase().includes(surname)) { cand.add(f); searched.add(f); }
    wiki = await fileInfo([...cand]);
    const lead = r.pageImage ? 'File:' + r.pageImage : null, p18 = new Set((r.p18 || []).map((f) => 'File:' + f));
    if (surname) wiki = wiki.filter((i) => i.file === lead || p18.has(i.file) || (i.name + ' ' + i.caption).toLowerCase().includes(surname));
    // Origin rank: lead image / Wikidata P18 (curated) > article image > search hit.
    wiki.forEach((i) => { i.origin = i.file === lead || p18.has(i.file) ? 0 : searched.has(i.file) && !fromArticle.has(i.file) ? 2 : 1; });
    if (r.kind === 'person') res.flags.push('living person: stick to verified, attributed facts (BLP)');
    if (wiki.some((i) => i.personalityRights)) res.flags.push('personality rights apply (no endorsement / advert use)');
    if (r.bioguide) {
      const url = `https://raw.githubusercontent.com/unitedstates/images/gh-pages/congress/450x550/${r.bioguide}.jpg`;
      try {
        const h = await fetch(url, { method: 'HEAD', headers: { 'user-agent': UA }, signal: AbortSignal.timeout(15000) });
        if (h.ok) wiki.push({ tier: 1, source: `https://bioguide.congress.gov/search/bio/${r.bioguide}`, file: `bioguide ${r.bioguide}`, name: `${r.bioguide}.jpg`, url, original: url, w: 450, h: 550, date: null, uploaded: null, licence: 'public domain', licenceDetail: 'US Congress official photo (GPO via unitedstates/images)', author: 'U.S. Congress / GPO', credit: 'U.S. Congress / GPO', usGov: true, kind: 'photo', caption: 'official congressional portrait' });
      } catch { /* ignore */ }
    }
  }
  const news = await newsPhotos(r, ctx);
  let all = [...wiki, ...news].map((i) => ({ ...i, contentCheck: CONTENT_RE.test(`${i.caption || ''} ${i.headline || ''} ${i.name || ''}`) ? 'rejected-keyword' : 'pending', avoid: i.getty ? 'Getty Images: avoid if an alternative exists' : undefined }));
  if (ctx.war) all.forEach((i) => { if (i.kind === 'news-photo' && r.kind !== 'person') i.warNote = 'war/attack topic: prefer places, maps, leaders and documents over scene photos'; });
  const d = (i) => i.date || i.uploaded || '0000';
  const notPortrait = (i) => r.kind === 'person' && /\b(banners?|posters?|murals?|graffiti|signs?|statue|effigy|cartoon|caricature|billboards?|waxwork|impersonator|masks?)\b/i.test(`${i.name || ''} ${i.caption || ''}`);
  all.sort((a, b) => (a.contentCheck === 'rejected-keyword') - (b.contentCheck === 'rejected-keyword') || a.tier - b.tier || !!a.getty - !!b.getty || notPortrait(a) - notPortrait(b)
    || (ctx.war ? !!a.warNote - !!b.warNote : 0)
    || (r.kind !== 'person' && a.tier === 1 && b.tier === 1 ? (a.origin ?? 1) - (b.origin ?? 1) : 0) // places/orgs: curated first
    || d(b).localeCompare(d(a)));
  const ok = all.filter((i) => i.contentCheck !== 'rejected-keyword');
  res.best = ok[0] || null;
  res.newest = [...ok].sort((a, b) => (b.date || b.uploaded || '').localeCompare(a.date || a.uploaded || ''))[0] || null;
  const yrs = (i) => (Date.now() - Date.parse((i?.date || i?.uploaded || '1900') + (String(i?.date || '').length === 4 ? '-06-01' : ''))) / 3.15e10;
  if (res.best && res.newest && res.best !== res.newest && yrs(res.best) > 2) res.flags.push(`best licensed photo is from ${res.best.date || res.best.uploaded}; a newer ${res.newest.licence} photo exists (${res.newest.date})`);
  const t1 = ok.filter((i) => i.tier === 1), t2 = ok.filter((i) => i.tier === 2), t3 = ok.filter((i) => i.tier === 3);
  res.images = [...t1.slice(0, max), ...t2.slice(0, 2), ...t3.slice(0, 3), ...all.filter((i) => i.contentCheck === 'rejected-keyword').slice(0, 2)];
  res.counts = { licensed: t1.length, pressKit: t2.length, news: t3.length, rejectedKeyword: all.length - ok.length };
  if (!ok.length) res.note = 'no photo found';
  else if (!t1.length) res.note = 'no licensed photo; using press-kit/news photo with credit';
  const pk = Object.keys(PRESS_KITS).find((k) => new RegExp(`\\b${k}\\b`, 'i').test(`${r.title || r.name} ${r.desc || ''} ${(r.extract || '').slice(0, 300)}`));
  if (pk) res.pressKit = { url: PRESS_KITS[pk], licence: 'press kit', note: 'company newsroom: browse for newer official photos (editorial use; credit the company)' };
  return res;
}
