"use strict";

/**
 * Visual beat sheet (LONGFORM-V2-PLAN §6.1): a cheap stage between `script` and `storyboards` that decides WHAT
 * each scene shows, so the storyboard model only fills content and the video stops repeating the same four
 * layouts.
 *
 *   script sections/sentences (+ WS-F tags: sentence.visual, section mood / energy when present)
 *     -> per-sentence visual hint geo|number|trend|compare|quote|person|event|concept|joke
 *        (tag if present, else deterministic heuristics; optionally ONE lite call per video for the
 *        sentences the heuristics cannot place: task "longform.beats")
 *     -> scenes: sentences grouped into ~6-8 s scenes at the LF pace (chapter card / cold open first)
 *     -> a visual KIND per scene under hard rules:
 *          a map when the scene is about a place / movement, at most ~1 map per 60 s
 *          no kind twice in a row; no kind over ~15 % of the video's scenes
 *          a graphic at least every ~75 s (hard limit 90 s)
 *          mix target: media 30-40 %, graphics 30-40 %, maps 10-20 %, quote / headline cards ~10 %
 *          flashBurst at most once per 2 minutes
 *
 * Output (beats.json): {version: "beats.v1", key, sections: {<id>: {scenes: [{n, from, sentences, seconds, t0,
 * hint, kind, template, hero, category}]}}, stats: {scenes, byCategory, byKind}}. storyboardLF's prompt takes
 * a section's scenes as a fixed SCENE PLAN and its variety gate checks the storyboard against it.
 */

const crypto = require("crypto");

const WPM = 160;
const GAP = 0.35;
const SCENE = { target: 6.5, max: 10, maxSentences: 3 };
const MIX = { media: [0.3, 0.4], graphic: [0.3, 0.4], map: [0.1, 0.2], card: [0.06, 0.12] };
const RULES = { mapGapS: 60, graphicGapS: 75, graphicHardS: 90, flashGapS: 120, maxShare: 0.15 };
const VERSION = "beats.v1";

/** kind -> template / hero type / category / a one-line fill instruction for the storyboard prompt */
const KINDS = {
  photo: { template: "lfStage", hero: "photo", category: "media", doc: 'lfStage with a centred photo hero ("hero": {"type": "photo", "props": {"slot"}}), annotated on the words, 1-2 satellites' },
  fullBleed: { template: "lfFull", hero: "photo", category: "media", doc: "lfFull: full-bleed photo + lower third + a callout" },
  splitScreen: { template: "lfDuo", hero: "splitScreen", category: "media", doc: 'lfDuo: "split": {"props": {"left": {"slot", "label"}, "right": {"slot", "label"}}} (the two things compared)' },
  photoStack: { template: "lfFeature", hero: "photoStack", category: "media", doc: 'lfFeature hero {"type": "photoStack", "props": {"items": [2-3 {"slot", "label"}], "centre": {"value"|"text", "label"}}}' },
  flashBurst: { template: "lfFlash", hero: "flashBurst", category: "media", doc: 'lfFlash: "burst": {"props": {"items": [6-8 {"slot"}], "kicker": "<= 3 words"}} (reuse slots of this section)' },
  joke: { template: "lfJoke", hero: "photo", category: "media", doc: "lfJoke: AI illustration + punchline plate" },
  bigNumber: { template: "lfNumber", hero: "bigNumber", category: "graphic", doc: "lfNumber: the figure counts up (value from FACTS), 1-2 satellites" },
  lineChart: { template: "lfChart", hero: "lineChart", category: "graphic", doc: 'lfChart with a lineChart of a DATA SERIES ({"series": "S#"}) or dossier years, annotated on the words' },
  barChart: { template: "lfChart", hero: "barChart", category: "graphic", doc: "lfChart with a barChart (fact values only, source line)" },
  compareCols: { template: "lfCompare", hero: "compareCols", category: "graphic", doc: "lfCompare: two columns with stats and a VS chip" },
  barRace: { template: "lfFeature", hero: "barRace", category: "graphic", doc: 'lfFeature hero {"type": "barRace", "props": {"series": "S#" (a map series) | ["S1","S2",...], "highlight": "<ISO3>", "title"}}' },
  timeline: { template: "lfFeature", hero: "timeline", category: "graphic", doc: 'lfFeature hero {"type": "timeline", "props": {"items": [3-7 {"year", "label"}]}} with a "go" event {i} on each year word' },
  eraTimeline: { template: "lfTimeline", hero: "eraTimeline", category: "graphic", doc: "lfTimeline: eraTimeline band ticked on the words" },
  flowDiagram: { template: "lfFeature", hero: "flowDiagram", category: "graphic", doc: 'lfFeature hero {"type": "flowDiagram", "props": {"nodes": [2-4 {"id", "label", "icon"}], "flows": [{"from", "to", "label"}]}} with "flow" events {i} on the verbs' },
  pictogramGrid: { template: "lfFeature", hero: "pictogramGrid", category: "graphic", doc: 'lfFeature hero {"type": "pictogramGrid", "props": {"total", "filled", "icon", "label", "unit"}} (a share: 1 in 4, 38 of 100)' },
  documentStamp: { template: "lfFeature", hero: "documentStamp", category: "card", doc: 'lfFeature hero {"type": "documentStamp", "props": {"title", "lines", "date", "stamp"}} with a "stamp" event on the verb (default, bankrupt, banned)' },
  quoteCard: { template: "lfQuote", hero: "quoteCard", category: "card", doc: 'lfQuote: "quote": {"props": {"quote" (VERBATIM from the dossier quote), "source", "highlight"}}' },
  headlineCard: { template: "lfHeadline", hero: "headlineCard", category: "card", doc: "lfHeadline: a retypeset headline (paraphrased, marked)" },
  countryMap: { template: "lfMap", hero: "countryMap", category: "map", doc: 'lfMap with a countryMap ("map": {"type": "countryMap", "props": {"focus": [ISO3], "intro"?: "world"}}), highlight / pin / counter events on the place words' },
  worldMap: { template: "lfMap", hero: "worldMap", category: "map", doc: 'lfMap with a worldMap (a choropleth of a map DATA SERIES, or pins / comet arcs between places, zoomTo on the word)' },
  routeMap: { template: "lfMap", hero: "routeMap", category: "map", doc: 'lfMap with a routeMap ("map": {"type": "routeMap", "props": {"stops": [2-4 {city|lonlat, label}], "legs"?: [{from, to, label}]}}), "leg" events {i} on the movement verbs' },
  recapList: { template: "lfRecap", hero: "recapList", category: "graphic", doc: "lfRecap: the takeaways checked off on the words" },
  chapter: { template: "lfChapter", hero: "chapterCard", category: "structure", doc: "lfChapter card (promise line + a photo that sets the chapter)" },
  cold: { template: "lfCold", hero: "photo", category: "structure", doc: "lfCold: full-bleed photo + kinetic headline (the hook)" },
};
const HINTS = ["geo", "number", "trend", "compare", "quote", "person", "event", "concept", "joke"];

// ---------------------------------------------------------------------------------------------- hints
const RX = {
  movement: /\b(shipp?ed|ships|flew|fled|sailed|exported|exports|imported|imports|route|routes|pipeline|smuggled|flowed|flows|sent|moved|migrat\w*|travel\w*|crossed|across the|from \w+ to)\b/i,
  place: /\b(border|borders|port|ports|capital|city|cities|province|region|continent|coast|island|country|countries|nation|nations|map|north|south|east|west|ocean|sea|desert|river)\b/i,
  number: /\b(million|billion|trillion|thousand|hundred|percent|per cent|dollars?|pesos?|euros?|pounds?|rupees?|times|half|third|quarter|double[ds]?|tripled?)\b/i,
  trend: /\b(rose|risen|rising|fell|fallen|falling|grew|grown|growing|climb\w*|drop\w*|soar\w*|plung\w*|surg\w*|doubl\w*|since|by (nineteen|twenty|two thousand)|over the (years|decade)|decades?|every year|each year|exploded|collaps\w*)\b/i,
  compare: /\b(than|versus|compared|while|whereas|instead|unlike|both|either|bigger|smaller|richer|poorer|more .* than)\b/i,
  quote: /["“”]|\b(said|says|wrote|declared|called it|told|promised|admitted|announced)\b/i,
  event: /\b(in (eighteen|nineteen|twenty|two thousand)[\w-]*|default\w*|crash\w*|crisis|coup|war|election|elected|law|decree|signed|banned|seized|announced|collapsed|protests?|riots?)\b/i,
  joke: /\b(imagine|like a|basically|picture this|our immortal clerk|it'?s like)\b/i,
};

function words(t) {
  return String(t || "").split(/\s+/).filter(Boolean);
}
function seconds(s) {
  return (words(s.text).length / WPM) * 60 + GAP;
}

/** place names the dossier / geo knows (lowercase), for the geo hint */
function placeNames(ctx) {
  const out = new Set();
  try {
    const { CITIES, load } = require("../video/v3/geo");
    Object.keys(CITIES).forEach((c) => out.add(c));
    Object.values(load("50m").countries).forEach((c) => c.n && out.add(String(c.n).toLowerCase()));
  } catch (_) {
    /* geo assets absent: keyword rules only */
  }
  ((ctx && ctx.dossier && ctx.dossier.entities) || []).forEach((e) => /place|country|city|region/i.test(e.kind || "") && out.add(String(e.name).toLowerCase()));
  return out;
}

/** deterministic hint for one sentence (null when nothing matches: concept by default, the lite call may refine) */
function heuristicHint(s, places, ctx) {
  const t = String(s.text || "");
  const low = t.toLowerCase();
  if (s.quoteId) return "quote";
  if (RX.joke.test(t)) return "joke";
  const placeHit = placeIn(low, places);
  if (RX.movement.test(t) && (placeHit || RX.place.test(t))) return "geo";
  if (RX.quote.test(t)) return "quote";
  if (RX.trend.test(t)) return "trend";
  if (RX.compare.test(t) && RX.number.test(t)) return "compare";
  if (RX.number.test(t) || (s.factIds || []).length) return "number";
  if (placeHit || RX.place.test(t)) return "geo";
  if (RX.event.test(t)) return "event";
  if (RX.compare.test(t)) return "compare";
  const persons = ((ctx && ctx.dossier && ctx.dossier.entities) || []).filter((e) => /person|people/i.test(e.kind || ""));
  if (persons.some((p) => low.includes(String(p.name).toLowerCase().split(/\s+/).slice(-1)[0]))) return "person";
  return null;
}

/** whole-word containment without building a regex from data */
function hasWord(low, w) {
  let at = low.indexOf(w);
  const isW = (ch) => !!ch && /[a-z0-9]/.test(ch);
  while (at >= 0) {
    if (!isW(low[at - 1]) && !isW(low[at + w.length])) return true;
    at = low.indexOf(w, at + 1);
  }
  return false;
}

function placeIn(text, places) {
  const low = String(text || "").toLowerCase();
  return [...places].some((p) => p.length > 3 && hasWord(low, p));
}

function hintOf(s, places, ctx) {
  const tag = s.visual ? String(s.visual).toLowerCase() : null;
  if (tag && HINTS.includes(tag)) return { hint: tag, source: "tag" };
  const h = heuristicHint(s, places, ctx);
  return h ? { hint: h, source: "rule" } : { hint: "concept", source: "default" };
}

/**
 * At most ONE lite call per video: the sentences that fell to the default "concept" (no tag, no rule) get a
 * hint from the model. Failure is never fatal (the default stays).
 */
async function refineHints(list, gemini, log) {
  const open = list.filter((x) => x.source === "default");
  if (!gemini || open.length < 3) return 0;
  const prompt = `Classify each narration sentence of a documentary by the ONE visual that best shows it.
Classes: ${HINTS.join(", ")} (geo = a place or movement between places matters; number = one big figure; trend = change over time; compare = two things side by side; quote = someone's words; person = a named person; event = a dated happening; concept = an idea/mechanism; joke = a comic aside).
Return ONLY JSON {"hints": {"<id>": "<class>"}}.
${open.map((x) => `${x.s.id}: ${x.s.text}`).join("\n")}`;
  try {
    const r = await gemini.json(prompt, { task: "longform.beats", temperature: 0.2 });
    let n = 0;
    open.forEach((x) => {
      const h = r && r.hints && String(r.hints[x.s.id] || "").toLowerCase();
      if (HINTS.includes(h)) {
        x.hint = h;
        x.source = "lite";
        n++;
      }
    });
    return n;
  } catch (err) {
    if (log) log(`beat sheet: lite hint call failed (${String(err.message).slice(0, 120)}); keeping the rules`);
    return 0;
  }
}

// ---------------------------------------------------------------------------------------------- scenes
/** sentences -> scenes: a structural opener (chapter card / cold open) then ~6-8 s groups, cut at hint changes */
function segment(section, hints) {
  const sents = section.sentences || [];
  const kind = section.id === "cold" ? "cold" : "chapter";
  const scenes = [];
  let i = 0;
  // opener: 1 sentence, 2 when the first is short (<= 4 s)
  const open = [sents[0]];
  if (sents[1] && seconds(sents[0]) < 4 && seconds(sents[0]) + seconds(sents[1]) <= 8.5) open.push(sents[1]);
  scenes.push({ sentences: open, structural: kind });
  i = open.length;
  if (section.id === "recap" && i < sents.length) {
    // the recap: one checked list for the takeaways (+ a closing photo callback when it runs long)
    const rest = sents.slice(i);
    const tail = rest.length >= 5 ? rest.slice(-1) : [];
    scenes.push({ sentences: rest.slice(0, rest.length - tail.length), fixed: "recapList" });
    if (tail.length) scenes.push({ sentences: tail, fixed: "photo" });
    return scenes;
  }
  let cur = [];
  let dur = 0;
  const flush = () => {
    if (cur.length) scenes.push({ sentences: cur });
    cur = [];
    dur = 0;
  };
  for (; i < sents.length; i++) {
    const s = sents[i];
    const d = seconds(s);
    const h = hints[s.id];
    const prevH = cur.length ? hints[cur[cur.length - 1].id] : null;
    // cut when full, or when a strong new visual idea starts after >= 4 s
    if (cur.length && (dur + d > SCENE.max || cur.length >= SCENE.maxSentences || dur >= SCENE.target || (dur >= 4 && h !== prevH && ["geo", "quote", "joke", "trend"].includes(h)))) flush();
    cur.push(s);
    dur += d;
  }
  flush();
  // a trailing sliver (< 3 s) joins the previous scene when that stays <= max
  const last = scenes[scenes.length - 1];
  const prev = scenes[scenes.length - 2];
  if (scenes.length > 2 && !last.structural && !last.fixed && !prev.structural && !prev.fixed) {
    const dl = last.sentences.reduce((a, s) => a + seconds(s), 0);
    const dp = prev.sentences.reduce((a, s) => a + seconds(s), 0);
    if (dl < 3 && dp + dl <= SCENE.max + 1) {
      prev.sentences.push(...last.sentences);
      scenes.pop();
    }
  }
  return scenes;
}

/** the scene's dominant hint: priority to the rarer, more visual ideas */
const PRIORITY = ["joke", "quote", "geo", "trend", "compare", "event", "number", "person", "concept"];
function sceneHint(sc, hints) {
  const hs = sc.sentences.map((s) => hints[s.id]);
  return PRIORITY.find((p) => hs.includes(p)) || "concept";
}

// ---------------------------------------------------------------------------------------------- assignment
function dataCaps(ctx) {
  const series = (ctx && ctx.data && ctx.data.series) || [];
  const time = series.filter((s) => s.kind === "time");
  const map = series.filter((s) => s.kind === "map");
  const metrics = {};
  time.forEach((s) => (metrics[s.indicator || s.metric] = (metrics[s.indicator || s.metric] || 0) + 1));
  const years = new Set(((ctx && ctx.dossier && ctx.dossier.timeline) || []).map((t) => String(t.year).slice(0, 4)));
  return { timeSeries: time.length > 0, mapSeries: map.length > 0, race: map.length > 0 || Object.values(metrics).some((n) => n >= 3), years: years.size };
}

function candidates(hint, sc, caps) {
  const list = baseCandidates(hint, sc, caps);
  // a scene that names a place can always be told on a map (maps stay rare through the spacing rule)
  if (sc.place && !list.some((k) => KINDS[k].category === "map")) list.splice(Math.min(1, list.length), 0, /\b(world|countries|nations|global)\b/i.test(sc.sentences.map((s) => s.text).join(" ")) && caps.mapSeries ? "worldMap" : "countryMap");
  if (["event", "number", "concept"].includes(hint) && !list.includes("headlineCard")) list.push("headlineCard");
  return list;
}
function baseCandidates(hint, sc, caps) {
  const text = sc.sentences.map((s) => s.text).join(" ");
  const quoted = sc.sentences.some((s) => s.quoteId);
  const move = RX.movement.test(text);
  const world = /\b(world|countries|nations|global|everywhere)\b/i.test(text);
  switch (hint) {
    case "geo":
      return move ? ["routeMap", "countryMap", "worldMap"] : world && caps.mapSeries ? ["worldMap", "countryMap", "routeMap"] : ["countryMap", "worldMap", "routeMap"];
    case "number":
      return ["bigNumber", "pictogramGrid", "photoStack", "barChart", "compareCols"];
    case "trend":
      return [caps.timeSeries ? "lineChart" : null, caps.race ? "barRace" : null, "barChart", caps.years >= 3 ? "timeline" : null, "bigNumber"].filter(Boolean);
    case "compare":
      return ["compareCols", "splitScreen", "barChart", caps.race ? "barRace" : null].filter(Boolean);
    case "quote":
      return quoted ? ["quoteCard", "headlineCard"] : ["headlineCard", "photo", "fullBleed"];
    case "person":
      return ["photo", "photoStack", "fullBleed"];
    case "event":
      return ["headlineCard", "documentStamp", "fullBleed", caps.years >= 3 ? "timeline" : null, "photo", "flashBurst"].filter(Boolean);
    case "joke":
      return ["joke", "photo"];
    default:
      return ["flowDiagram", "photo", "fullBleed", "pictogramGrid", "splitScreen"];
  }
}
// what the planner may fall back to when every hint candidate is blocked (by category)
const POOL = {
  media: ["photo", "fullBleed", "splitScreen", "photoStack"],
  graphic: ["bigNumber", "flowDiagram", "compareCols", "barChart", "pictogramGrid"],
  map: ["countryMap", "worldMap"],
  card: ["headlineCard"],
};

/**
 * Assign kinds across the WHOLE video (sections in order) so the rules hold video-wide.
 * @param {{id: string, scenes: object[]}[]} secs
 */
function assign(secs, caps) {
  const flat = [];
  let t = 0;
  secs.forEach((sec) =>
    sec.scenes.forEach((sc) => {
      sc.seconds = Math.round(sc.sentences.reduce((a, s) => a + seconds(s), 0) * 10) / 10;
      sc.t0 = Math.round(t * 10) / 10;
      t += sc.seconds;
      flat.push(sc);
    })
  );
  const content = flat.filter((sc) => !sc.structural);
  const N = Math.max(1, content.length);
  const cap = Math.max(1, Math.floor(RULES.maxShare * N + 1e-9));
  const count = {};
  const cat = { media: 0, graphic: 0, map: 0, card: 0 };
  let prev = null;
  let lastMap = -1e9;
  let lastFlash = -1e9;
  let lastGraphic = 0;
  let done = 0;
  const blocked = (k, sc) => {
    const K = KINDS[k];
    if (!K) return true;
    if (k === prev) return true;
    if ((count[k] || 0) + 1 > cap && k !== "recapList") return true;
    if (K.category === "map" && sc.t0 - lastMap < RULES.mapGapS) return true;
    if (k === "flashBurst" && sc.t0 - lastFlash < RULES.flashGapS) return true;
    if ((k === "lineChart" && !caps.timeSeries) || (k === "barRace" && !caps.race)) return true;
    return false;
  };
  const score = (k, rank, sc) => {
    const c = KINDS[k].category;
    const [lo, hi] = MIX[c];
    const after = (cat[c] + 1) / (done + 1);
    let s = rank;
    if (after > hi) s += (after - hi) * 30;
    const share = cat[c] / Math.max(1, done);
    if (done >= 2 && share < lo) s -= (lo - share) * 30;
    // a graphic is due: graphics win
    if (sc.t0 - lastGraphic > RULES.graphicGapS && c !== "graphic") s += 20;
    return s;
  };
  flat.forEach((sc) => {
    if (sc.structural) {
      sc.kind = sc.structural;
      prev = sc.kind;
      if (sc.kind === "chapter") lastGraphic = sc.t0; // the chapter card is typeset
      return;
    }
    let kind = sc.fixed && !blocked(sc.fixed, sc) ? sc.fixed : null;
    if (!kind) {
      const hinted = candidates(sc.hint, sc, caps);
      const pool = hinted.concat(...Object.values(POOL).map((l) => l.filter((k) => !hinted.includes(k))));
      const opts = pool.map((k, r) => ({ k, s: score(k, hinted.includes(k) ? r : r + 4, sc) })).filter((o) => !blocked(o.k, sc));
      opts.sort((a, b) => a.s - b.s);
      kind = opts.length ? opts[0].k : pool.find((k) => k !== prev) || "photo";
    }
    sc.kind = kind;
    const K = KINDS[kind];
    count[kind] = (count[kind] || 0) + 1;
    cat[K.category] = (cat[K.category] || 0) + 1;
    done++;
    if (K.category === "map") lastMap = sc.t0;
    if (K.category === "graphic" || K.category === "card" || K.category === "map") lastGraphic = sc.t0;
    if (kind === "flashBurst") lastFlash = sc.t0;
    prev = kind;
  });
  return { flat, count, cat, N };
}

function keyOf(script, caps) {
  const h = crypto.createHash("sha256");
  h.update(JSON.stringify({ v: VERSION, caps, s: (script.sections || []).map((s) => [s.id, s.sentences.map((x) => [x.id, x.text, x.visual || "", x.quoteId || ""])]) }));
  return h.digest("hex").slice(0, 16);
}

/**
 * @param {object} script  script.json ({sections: [{id, sentences: [{id, text, visual?, factIds?, quoteId?}], mood?, energy?}]})
 * @param {{dossier?, data?, gemini?, log?}} ctx  gemini: {json(prompt, {task})} (at most one call)
 */
async function buildBeatSheet(script, ctx = {}) {
  const places = placeNames(ctx);
  const caps = dataCaps(ctx);
  const list = [];
  (script.sections || []).forEach((sec) => sec.sentences.forEach((s) => list.push({ s, sec: sec.id, ...hintOf(s, places, ctx) })));
  const refined = await refineHints(list, ctx.gemini, ctx.log);
  const hints = Object.fromEntries(list.map((x) => [x.s.id, x.hint]));
  const secs = (script.sections || []).map((sec) => {
    const scenes = segment(sec, hints);
    scenes.forEach((sc) => {
      sc.hint = sc.structural ? null : sceneHint(sc, hints);
      sc.place = sc.sentences.some((s) => placeIn(s.text, places));
    });
    return { id: sec.id, scenes };
  });
  const { flat, count, cat, N } = assign(secs, caps);
  const sections = {};
  secs.forEach((sec) => {
    sections[sec.id] = {
      mood: ((script.sections || []).find((s) => s.id === sec.id) || {}).mood || null,
      scenes: sec.scenes.map((sc, i) => ({
        n: i + 1,
        from: sc.sentences[0].id,
        sentences: sc.sentences.map((s) => s.id),
        seconds: sc.seconds,
        t0: sc.t0,
        hint: sc.hint,
        kind: sc.kind,
        template: KINDS[sc.kind].template,
        hero: KINDS[sc.kind].hero,
        category: KINDS[sc.kind].category,
      })),
    };
  });
  const byCategory = Object.fromEntries(Object.entries(cat).map(([k, v]) => [k, Math.round((1000 * v) / N) / 10]));
  return {
    version: VERSION,
    key: keyOf(script, caps),
    sections,
    stats: { scenes: flat.length, contentScenes: N, byCategory, byKind: count, hintSources: list.reduce((a, x) => ((a[x.source] = (a[x.source] || 0) + 1), a), {}), refined },
  };
}

// ---------------------------------------------------------------------------------------------- checks
/** the rules above, checked on a plan (tests; also a guard before writing beats.json) */
function planProblems(beats) {
  const P = [];
  const flat = Object.values(beats.sections).flatMap((s) => s.scenes);
  const content = flat.filter((s) => s.category !== "structure");
  const cap = Math.max(1, Math.floor(RULES.maxShare * content.length + 1e-9));
  const count = {};
  let prev = null;
  let lastMap = -1e9;
  let lastGraphic = 0;
  flat.forEach((s) => {
    if (s.kind === prev) P.push(`${s.from}: ${s.kind} twice in a row`);
    prev = s.kind;
    if (s.category === "structure") return;
    count[s.kind] = (count[s.kind] || 0) + 1;
    if (s.category === "map") {
      if (s.t0 - lastMap < RULES.mapGapS) P.push(`${s.from}: a map ${Math.round(s.t0 - lastMap)} s after the last one (min ${RULES.mapGapS})`);
      lastMap = s.t0;
    }
    if (s.category !== "media") {
      if (s.t0 - lastGraphic > RULES.graphicHardS) P.push(`${s.from}: ${Math.round(s.t0 - lastGraphic)} s without a graphic`);
      lastGraphic = s.t0;
    }
  });
  Object.entries(count).forEach(([k, n]) => n > cap && k !== "recapList" && P.push(`${k} is ${n} of ${content.length} scenes (max ${cap})`));
  return P;
}

module.exports = { buildBeatSheet, planProblems, heuristicHint, hintOf, segment, assign, candidates, KINDS, HINTS, RULES, MIX, VERSION, seconds };
