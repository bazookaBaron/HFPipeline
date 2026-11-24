// Greedy IDF-weighted clustering of headlines into topics. No ML, fully inspectable.
const STOP = new Set(('a an the and or but if of to in on at by for with from as is are was were be been being it its this that these those he she they his her their them we you i not no new news says say said over after before into about up down out more than amid will would could can may might has have had do does did just also what who how why when where which while live update updates latest report reports video watch first last year years day days week weeks one two three us u.s. per via vs against under still back amid around set get gets got make makes made take takes could top big now here there s mr ms former own all any some most many much very again off near way news.')
  .split(/\s+/));
const NOT_ENT = new Set(['The', 'A', 'An', 'In', 'On', 'At', 'For', 'With', 'After', 'How', 'Why', 'What', 'When', 'Who', 'As', 'From', 'By', 'To', 'Of', 'And', 'But', 'Is', 'It', 'Live', 'Watch', 'Exclusive', 'Breaking', 'Analysis', 'Opinion', 'Update', 'Video', 'Here', 'This', 'That', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December', 'CEO', 'US', 'UK', 'EU', 'New', 'Says', 'Will', 'Can', 'Could', 'Former']);

export function stem(w) {
  w = w.toLowerCase().replace(/['’]s$/, '').replace(/[^a-z0-9.-]/g, '').replace(/^[.-]+|[.-]+$/g, '');
  if (w.length > 4 && w.endsWith('ies')) return w.slice(0, -3) + 'y';
  if (w.length > 4 && w.endsWith('s') && !w.endsWith('ss')) return w.slice(0, -1);
  return w;
}
export function tokens(text) {
  return (text.match(/[A-Za-z][A-Za-z0-9.'’-]*/g) || []).map(stem).filter((w) => w.length > 2 && !STOP.has(w));
}
export function entities(title) {
  const out = []; const words = title.replace(/[“”"‘’:;,()?!|]/g, (c) => (c === '’' ? "'" : ' | ')).split(/\s+/);
  let cur = [];
  const flush = () => { if (cur.length) { const e = cur.join(' ').replace(/['’]s$/, ''); if (e.length > 2 && !(cur.length === 1 && NOT_ENT.has(cur[0]))) out.push(e); } cur = []; };
  for (const w of words) {
    if (/^[A-Z][a-zA-Z.'-]+$/.test(w) || /^[A-Z]{2,}$/.test(w)) { if (!(cur.length === 0 && NOT_ENT.has(w))) cur.push(w.replace(/['’]s$/, '')); else flush(); }
    else if (cur.length && /^(of|de|al|bin|von|van)$/.test(w)) cur.push(w);
    else flush();
  }
  flush();
  // Title-case headlines glue verbs onto names ("Jensen Huang Resigns As"): also emit the 2-word sub-names.
  const extra = [];
  for (const e of out) { const w = e.split(' '); if (w.length >= 3) for (let i = 0; i + 1 < w.length; i++) if (!NOT_ENT.has(w[i]) && !NOT_ENT.has(w[i + 1])) extra.push(`${w[i]} ${w[i + 1]}`); }
  return [...out, ...extra].map((e) => e.replace(/\s+(of|de|al|bin|von|van)$/, ''));
}

export function cluster(stories, { minSim = 0.42 } = {}) {
  // Term sets: tokens + entity phrases (entities weighted x2).
  for (const s of stories) {
    const ents = [...entities(s.title), ...(s.wikiLinks || [])];
    s._ents = [...new Set(ents)];
    s._terms = new Set([...tokens(s.title), ...s._ents.map((e) => 'E:' + e.toLowerCase())]);
  }
  const df = new Map();
  for (const s of stories) for (const t of s._terms) df.set(t, (df.get(t) || 0) + 1);
  const N = stories.length || 1;
  const idf = (t) => Math.log((N + 1) / ((df.get(t) || 0) + 1)) * (t.startsWith('E:') ? 1.6 : 1);

  const clusters = [];
  const order = [...stories].sort((a, b) => (b.origin === 'wiki-ce') - (a.origin === 'wiki-ce') || b._terms.size - a._terms.size);
  for (const s of order) {
    const sTerms = [...s._terms].filter((t) => idf(t) > 0.9);
    const sSum = sTerms.reduce((a, t) => a + idf(t), 0) || 1;
    let best = null, bestSim = 0;
    for (const c of clusters) {
      let shared = 0, sharedN = 0, strong = 0;
      for (const t of sTerms) if (c.tf.has(t)) { shared += idf(t); sharedN++; if (idf(t) > 2.2) strong++; }
      if (sharedN < 2 || !strong) continue;
      const sim = shared / Math.min(sSum, c.topSum());
      if (sim > bestSim) { bestSim = sim; best = c; }
    }
    if (best && bestSim >= minSim) best.add(s, sTerms);
    else { const c = newCluster(idf); c.add(s, sTerms); clusters.push(c); }
  }
  // Merge pass: clusters whose top terms overlap strongly.
  let merged = true;
  while (merged) {
    merged = false;
    for (let i = 0; i < clusters.length && !merged; i++) for (let j = i + 1; j < clusters.length && !merged; j++) {
      const a = clusters[i], b = clusters[j];
      const ta = a.top(8), tb = new Set(b.top(8));
      const sh = ta.filter((t) => tb.has(t));
      const w = sh.reduce((x, t) => x + idf(t), 0);
      // Storyline rule: the same lead actors (2 shared top names, or one shared multi-word name).
      const ea = a.topEnts(4), eb = new Set(b.topEnts(4));
      const se = ea.filter((t) => eb.has(t));
      const rare = (t) => idf(t) / 1.6 > 2.8; // entity named in fewer than ~6% of all stories
      const storyline = se.filter(rare).length >= 2 || se.some((t) => t.includes(' ') && rare(t));
      if (storyline || (sh.length >= 3 && w / Math.min(a.topSum(8), b.topSum(8)) > 0.5)) { for (const s of b.stories) a.add(s, [...s._terms].filter((t) => idf(t) > 0.9)); clusters.splice(j, 1); merged = true; }
    }
  }
  return clusters.map((c) => c.finish());
}

function newCluster(idf) {
  const c = {
    stories: [], tf: new Map(),
    add(s, terms) { this.stories.push(s); for (const t of terms) this.tf.set(t, (this.tf.get(t) || 0) + 1); },
    top(n = 12) { return [...this.tf.entries()].sort((a, b) => b[1] * idf(b[0]) - a[1] * idf(a[0])).slice(0, n).map(([t]) => t); },
    // Entity terms named by at least a third of the cluster's stories (min 1), most frequent first.
    topEnts(n = 4) {
      const min = Math.max(1, Math.ceil(this.stories.length / 3));
      return [...this.tf.entries()].filter(([t, c]) => t.startsWith('E:') && c >= min).sort((a, b) => b[1] - a[1] || idf(b[0]) - idf(a[0])).slice(0, n).map(([t]) => t);
    },
    topSum(n = 12) { return this.top(n).reduce((a, t) => a + idf(t), 0) || 1; },
    finish() {
      const top = this.top(14);
      const entCount = new Map();
      for (const s of this.stories) for (const e of s._ents) entCount.set(e, (entCount.get(e) || 0) + 1);
      const ents = [...entCount.entries()].sort((a, b) => b[1] - a[1]);
      // Representative headline: most central news headline (not HN/wiki), mid-length.
      const score = (s) => [...s._terms].reduce((a, t) => a + (this.tf.get(t) || 0) * idf(t), 0) / Math.sqrt(s._terms.size + 3)
        + (s.origin === 'feed' || s.origin === 'gnews' || s.origin === 'gdelt' ? 2 : 0) - (s.title.length > 140 ? 3 : 0);
      const rep = [...this.stories].sort((a, b) => score(b) - score(a))[0];
      return { stories: this.stories, topTerms: top.map((t) => t.replace(/^E:/, '')), entities: ents.map(([e, n]) => ({ name: e, mentions: n })), headline: rep.title, rep };
    },
  };
  return c;
}
