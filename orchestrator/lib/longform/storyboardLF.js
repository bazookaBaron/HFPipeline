"use strict";

/**
 * storyboardLF.js (plan §1 / §6 / P6): one script section (cold open, chapter, recap) -> an LF
 * storyboard.v3 at 1920x1080 plus the media INTENTS its slots need (the resolver input).
 *
 *   section.sentences (FIXED narration from script.json -- never rewritten; the model only sees them)
 *     -> Gemini JSON (task "longform.storyboard", standard tier): {scaffolds, events, media, pauses?}
 *     -> assemble: sentences come from the script, sb.chapter from the outline, frame/profile fixed
 *     -> validate: validate()/validateLF (templates, compile on a relaxed synthetic timeline, ops,
 *        beats/min, holds) + chapter rules (chapter card first, no authored lfEnd) + the MIX RULE
 *        (graphics on screen every second, media share, no slideshow runs, every photo annotated,
 *        scene life) + media intents (schema, every slot referenced/declared) + charts (source
 *        line, numbers only from the dossier / years / the section's verified calcs)
 *     -> layout audit (tools/layout_audit.js, real DOM at 1920x1080, synthetic timing)
 *     -> repair loop: problems go back to the model with its previous output; at most 3 attempts,
 *        then the deterministic long-hold filler (storyboardGen.autoFillGaps). Billing/auth errors
 *        (HTTP 402 credits depleted, 401/403) are fatal and never retried.
 *
 * Output storyboard fields beyond storyboard.v3: `chapter` {index, count, title} (lfChrome kicker +
 * progress; index 0 = cold open, no chrome), `section` (script section id), `mediaIntents`
 * [{slot, kind, entity?, intent, era?, size?}] (lib/media/resolve.js input), `lfMeta` {hash, attempts}.
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const { compileStoryboard } = require("../video/v3/compile");
const { MODULES, TEMPLATES: TEMPLATE_DOCS, TONES } = require("../video/v3/catalog");
const { validate, syntheticTimeline, PROFILES } = require("../video/v3/storyboardGen");
const { validateIntents } = require("../media/resolve");
const { claimNumbers, unitScale, evalCalc, close } = require("./numbers");

const FRAME = { w: 1920, h: 1080 };
const PROMPT_VERSION = "lf-sb.4"; // .4: beat-sheet SCENE PLAN (fixed kinds per scene), set-2 modules, static catalog first (implicit cache)
const { CITIES } = require("../video/v3/geo");
const PILOT = path.join(__dirname, "..", "..", "fixtures", "v3", "lf-pilot.json");
const LF_MEDIA = new Set(["photo", "photoGrid", "portraitCard", "mapCard", "media", "splitScreen", "photoStack", "flashBurst"]);
const LF_CHROME = new Set(["lfHeader", "lfProgress", "lfCredit"]);
/** on-screen word limits (the narrator says the sentences; the screen carries short text) */
const TEXT = { title: 8, context: 8, callout: 6, promise: 10, deck: 12, sub: 0 };
/** templates never offered to the model (lfEnd is compiler-added; lfSplit is the deprecated two-column split) */
const LF_HIDDEN = new Set(["lfEnd", "lfSplit"]);
const MIX = { graceS: 1.5, mediaShare: [40, 70], mediaSharePlanned: 15, maxMediaRun: 5, lifeMedian: [5.0, 10.0], bpmSyn: [20, 37] };

/**
 * A highlight label rides the picture: a later zoomTo on the same photo scales and shifts it, and a
 * box outside the zoom region pushes its label off the picture (the layout audit then reports a
 * cut-off label, which reads like "text too long"). Same maths as modules-lf.js photo zoomTo.
 */
function zoomLabelProblems(spec) {
  const out = [];
  spec.scaffolds.forEach((sc) => {
    sc.modules.filter((m) => m.type === "photo").forEach((m) => {
      const [, , w, h] = m.rect;
      const evs = spec.events.filter((e) => String(e.target || "").split(".")[0] === m.id && e.t >= sc.t0 - 1e-6 && e.t < sc.t1).sort((a, b) => a.t - b.t);
      let active = [];
      for (const e of evs) {
        const v = e.value || {};
        active = active.filter((a) => !(a.until !== null && a.until <= e.t));
        if (e.op === "highlight" && v.label) active.push({ box: v.box || [30, 30, 30, 30], label: v.label, until: v.hold ? e.t + v.hold : null });
        else if (e.op === "unhighlight") active.pop();
        else if (e.op === "zoomOut") continue;
        else if (e.op === "zoomTo") {
          const bx = v.box || [25, 25, 50, 50];
          const s = Math.min(2.4, Math.max(1, Math.min(100 / bx[2], 100 / bx[3])));
          const cx = ((bx[0] + bx[2] / 2) / 100) * w;
          const cy = ((bx[1] + bx[3] / 2) / 100) * h;
          const x = Math.max(w - w * s, Math.min(0, w / 2 - cx * s));
          const y = Math.max(h - h * s, Math.min(0, h / 2 - cy * s));
          active.forEach((a) => {
            const left = (a.box[0] / 100) * w * s + x;
            const top = ((a.box[1] / 100) * h - (a.box[1] < 12 ? -(a.box[3] / 100) * h : 44)) * s + y;
            const labelW = String(a.label).length * 13 + 30;
            if (left < 4 || left + labelW > w - 4 || top < 4 || top > h - 40)
              out.push(`zoomTo on ${m.id} (sentence event at ${e.t.toFixed(1)} s, box [${bx.join(",")}]) pushes the highlight label "${a.label}" (box [${a.box.join(",")}]) off the picture: put the highlight box INSIDE the zoom box, give the highlight a "hold" that ends before the zoom, or add an unhighlight before zoomTo (the label text length is not the problem)`);
          });
        }
      }
    });
  });
  return out;
}

/**
 * Deterministic repair (the model keeps putting a fact from another metric on a series line, e.g.
 * "$9.8B" on a months-of-imports point): a lineChart note that quotes a figure other than its point's
 * value is rewritten to "<year>: <value><unit>". Returns the number of notes rewritten.
 */
function fixSeriesNotes(sb) {
  if (!sb.data || !Array.isArray(sb.data.series)) return 0;
  const byId = Object.fromEntries(sb.data.series.map((x) => [x.id, x]));
  const charts = {};
  const walk = (v) => {
    if (Array.isArray(v)) return v.forEach(walk);
    if (!v || typeof v !== "object") return;
    if (v.type === "lineChart" && v.id && v.props && typeof v.props.series === "string") charts[v.id] = v.props;
    Object.values(v).forEach(walk);
  };
  walk(sb.scaffolds);
  let n = 0;
  (sb.events || []).forEach((e) => {
    const p = charts[String(e.target || "").split(".")[0]];
    if (e.op !== "annotate" || !p || !byId[p.series] || !e.value) return;
    let pts = (byId[p.series].points || []).slice();
    if (p.from !== undefined) pts = pts.filter((q) => q.x >= Number(p.from));
    if (p.to !== undefined) pts = pts.filter((q) => q.x <= Number(p.to));
    if (p.last !== undefined) pts = pts.slice(-Number(p.last));
    const i = (Number(e.value.i || e.value.point) || pts.length) - 1;
    const pt = pts[Math.min(Math.max(0, i), pts.length - 1)];
    if (!pt) return;
    if (!(i >= 0 && i < pts.length)) e.value.i = pts.indexOf(pt) + 1;
    const nums = (String(e.value.text || "").match(/\d[\d,]*(?:\.\d+)?/g) || []).map((x) => Number(x.replace(/,/g, ""))).filter((x) => !(Number.isInteger(x) && x >= 1900 && x <= 2100));
    if (!nums.some((x) => Math.abs(x - pt.y) > Math.max(0.051, Math.abs(pt.y) * 0.02)) && i === pts.indexOf(pt)) return;
    const unit = String(p.unit || byId[p.series].unit || "");
    const u = /^%/.test(unit) ? "%" : unit ? " " + unit.split(/\s+/)[0] : "";
    e.value.text = `${pt.x}: ${pt.y}${u}`;
    n++;
  });
  return n;
}

/** a note on a data-series line must quote that point (value in the series unit) or no figure at all */
function seriesNoteProblems(spec) {
  const out = [];
  const byId = {};
  spec.scaffolds.forEach((sc) => sc.modules.forEach((m) => (byId[m.id] = m)));
  spec.events.forEach((e) => {
    const m = byId[String(e.target || "").split(".")[0]];
    if (e.op !== "annotate" || !m || m.type !== "lineChart" || !(m.props || {}).dataSeries) return;
    const v = e.value || {};
    const pts = (m.props.points || ((m.props.series || [])[(Number(v.series) || 1) - 1] || {}).points || []);
    const pt = pts[(Number(v.i || v.point) || pts.length) - 1];
    if (!pt) return out.push(`annotate on ${m.id}: point ${v.i} does not exist (the series has ${pts.length} points, 1-based)`);
    const nums = (String(v.text || "").match(/\d[\d,]*(?:\.\d+)?/g) || []).map((x) => Number(x.replace(/,/g, ""))).filter((x) => !(Number.isInteger(x) && x >= 1900 && x <= 2100));
    nums.forEach((x) => {
      if (Math.abs(x - pt.y) > Math.max(0.051, Math.abs(pt.y) * 0.02)) out.push(`annotate "${v.text}" on ${m.id} (point ${pt.x} = ${pt.y} ${m.props.unit || ""}): a note on a data series shows that point's value (${pt.y}) or only words; ${x} is not it`);
    });
  });
  return out;
}

/**
 * Figures that share a scene with a data-series chart must agree with it: a headline or number card
 * that quotes a year the chart plots, with a value > 20 % away from that point (e.g. a national
 * Dec-to-Dec inflation of 211 % next to the World Bank annual average of 133.5 %), reads as an error.
 */
function seriesConsistencyProblems(spec) {
  const out = [];
  const YEAR = /\b(19[5-9]\d|20[0-4]\d)\b/g;
  const figures = (t) => (String(t || "").match(/\d[\d,]*(?:\.\d+)?/g) || []).map((x) => Number(x.replace(/,/g, ""))).filter((x) => !(Number.isInteger(x) && x >= 1900 && x <= 2100));
  spec.scaffolds.forEach((sc) => {
    const charts = sc.modules.filter((m) => (m.type === "lineChart" || m.type === "barChart") && (m.props || {}).dataSeries);
    if (!charts.length) return;
    const byYear = {};
    charts.forEach((m) => (m.props.points || []).forEach((pt) => (byYear[pt.x] = pt.y)));
    sc.modules.forEach((m) => {
      if (charts.includes(m)) return;
      const p = m.props || {};
      const texts = [];
      if (m.type === "bigNumber") texts.push({ text: [p.eyebrow, p.context].join(" "), nums: [Number(p.value)] });
      [p.text, p.headline, p.title, p.kicker].filter(Boolean).forEach((t) => texts.push({ text: t, nums: figures(t) }));
      texts.forEach(({ text, nums }) => {
        const years = (String(text).match(YEAR) || []).map(Number).filter((y) => byYear[y] !== undefined);
        years.forEach((y) => nums.filter(Number.isFinite).forEach((x) => {
          const ref = byYear[y];
          if (Math.abs(x - ref) > Math.max(1, Math.abs(ref) * 0.2)) out.push(`scaffold ${sc.id}: ${m.id} shows ${x} for ${y} but the chart in the same scene plots ${ref} for ${y}; use the chart's value, or move the other figure to its own scene and name its measure (e.g. "December-to-December")`);
        }));
      });
    });
  });
  return [...new Set(out)];
}

/** vector-map pacing and density (lib/longform/MAPS.md) on the compiled spec */
function mapProblems(spec) {
  const out = [];
  const maps = {};
  spec.scaffolds.forEach((sc) => sc.modules.forEach((m) => (m.type === "worldMap" || m.type === "countryMap") && (maps[m.id] = maps[m.id] || { m, scs: [] }).scs.push(sc)));
  Object.values(maps).forEach(({ m, scs }) => {
    const evs = spec.events.filter((e) => String(e.target || "").split(".")[0] === m.id).sort((a, b) => a.t - b.t);
    const p = m.props || {};
    const pins = (p.pins || []).length + evs.filter((e) => e.op === "pin").length;
    const arrows = (p.arrows || []).length + evs.filter((e) => e.op === "arrow").length;
    if (pins > 4) out.push(`map ${m.id}: ${pins} pins (max 4)`);
    const at = [].concat((p.pins || []).map((x) => x.at), evs.filter((e) => e.op === "pin").map((e) => (e.value || {}).at)).filter(Boolean).map((q) => q.join(","));
    if (new Set(at).size < at.length) out.push(`map ${m.id}: two pins on the same spot (a props.pins entry and a pin event, or the same city twice); keep one`);
    if (arrows > 3) out.push(`map ${m.id}: ${arrows} arrows (max 3)`);
    scs.forEach((sc) => {
      const z = evs.filter((e) => e.op === "zoomTo" && e.t >= sc.t0 && e.t < sc.t1);
      if (z.length > 1) out.push(`map ${m.id}: ${z.length} zoomTo events in scaffold ${sc.id} (max 1 per scene)`);
    });
    evs.forEach((e, i) => {
      if (e.op !== "zoomTo") return;
      const nxt = evs[i + 1];
      if (nxt && nxt.t - e.t < 1.4) out.push(`map ${m.id}: ${nxt.op} on "${nxt.word}" lands ${(nxt.t - e.t).toFixed(1)} s after zoomTo on "${e.word}" (the camera needs 1.4 s): anchor it on a later word`);
    });
    [].concat(p.pins || [], p.arrows || [], evs.filter((e) => e.op === "pin" || e.op === "arrow").map((e) => e.value || {}))
      .filter((x) => String(x.label || "").length > 14)
      .forEach((x) => out.push(`map ${m.id}: label "${x.label}" is ${String(x.label).length} characters (max 14)`));
  });
  return out;
}

/** validateLF says only "a hold of N s"; name where, so the repair prompt can fix the right sentence */
function locateHolds(sb) {
  const PR = PROFILES.LF;
  const tl = syntheticTimeline(sb, PR.syn);
  let spec;
  try {
    spec = compileStoryboard(sb, tl, { mascot: false });
  } catch (err) {
    return [err.message];
  }
  const t = [];
  spec.scaffolds.forEach((s) => {
    t.push(s.t0);
    s.modules.forEach((m) => m.at && t.push(s.t0 + m.at));
  });
  spec.events.forEach((e) => t.push(e.t));
  const pts = [0, ...[...new Set(t.map((x) => Math.round(x * 100) / 100))].sort((a, b) => a - b), tl.totalSeconds];
  const out = [];
  for (let i = 1; i < pts.length; i++) {
    const gap = pts[i] - pts[i - 1];
    if (gap <= PR.maxGap) continue;
    const mid = (pts[i] + pts[i - 1]) / 2;
    const w = tl.words.reduce((b, x) => (Math.abs(x.start - mid) < Math.abs(b.start - mid) ? x : b), tl.words[0]);
    const sc = spec.scaffolds.find((s) => s.t0 <= mid && mid < s.t1);
    out.push(`no visual change for ${gap.toFixed(1)} s (max ${PR.maxGap} s) around sentence ${w.sentenceId} near the word "${w.text}"${sc ? ` in scaffold ${sc.id}` : ""}: add a word-anchored event there (highlight / count / draw / callout entrance)`);
  }
  return out.length ? out : [`a hold without a visual change is longer than ${PR.maxGap} s`];
}

/** visual beats per minute exactly as storyboardGen / v3_gates count them (scaffold cuts, entrances, events) */
function beatsPerMin(spec, total) {
  const t = [];
  spec.scaffolds.forEach((s) => {
    t.push(s.t0);
    s.modules.forEach((m) => {
      if (m.at) t.push(s.t0 + m.at);
      ((m.props && m.props.lineAt) || []).forEach((la) => la > 0 && t.push(s.t0 + (m.at || 0) + la));
    });
  });
  spec.events.forEach((e) => t.push(e.t));
  return (new Set(t.map((x) => Math.round(x * 100) / 100)).size / total) * 60;
}
const FATAL = /\b(401|402|403)\b|credits are depleted|API key not valid|PERMISSION_DENIED|GEMINI_API_KEY not set/i;

// ---------------------------------------------------------------------------------------------
// chapter metadata

/** section -> {kind, index, count, title}. Chapters 1..n from the outline, the recap is chapter n+1; the cold open is 0. */
function chapterMeta(script, outline, sectionId) {
  const chapters = (outline && outline.chapters) || script.sections.filter((s) => /^ch/.test(s.id));
  const count = chapters.length + 1; // + recap
  if (sectionId === "cold") return { kind: "cold", index: 0, count, title: "Cold open" };
  if (sectionId === "recap") return { kind: "recap", index: count, count, title: "Recap" };
  const i = chapters.findIndex((c) => c.id === sectionId);
  const sec = script.sections.find((s) => s.id === sectionId);
  return { kind: "chapter", index: i + 1, count, title: (chapters[i] && chapters[i].title) || (sec && sec.title) || sectionId };
}

function outlineSection(outline, sectionId) {
  if (!outline) return {};
  if (sectionId === "cold") return outline.coldOpen || {};
  if (sectionId === "recap") return outline.recap || {};
  return (outline.chapters || []).find((c) => c.id === sectionId) || {};
}

/** content hash of everything that determines a section's storyboard (resume key) */
function sectionHash(section, meta, extra = "") {
  const h = crypto.createHash("sha256");
  h.update(JSON.stringify({ v: PROMPT_VERSION, meta, sentences: section.sentences.map((s) => [s.id, s.text]), extra }));
  return h.digest("hex").slice(0, 16);
}

// ---------------------------------------------------------------------------------------------
// prompt

/**
 * LF-only module catalog. catalogText("LF") in storyboardGen keeps every module WITHOUT an `only`
 * tag too (the 9:16 cards: nodes, panel, kpis, ...), which the LF templates do not lay out; the LF
 * prompt lists only the `only: "LF"` cards (minus chrome and the compiler-added endScreen).
 */
function lfCatalogText() {
  return Object.entries(MODULES)
    .filter(([k, m]) => m.only === "LF" && !m.chrome && k !== "endScreen")
    .map(([k, m]) => `- ${k}: ${m.use}\n    props ${m.props}` + (Object.keys(m.ops || {}).length ? `\n    ops ${Object.entries(m.ops).map(([o, d]) => `${o} ${d}`).join("; ")}` : "") + (m.entities ? `\n    sub-targets ${m.entities}` : ""))
    .join("\n");
}

/** the pilot chapter in the model's output shape (scaffolds, events, media intents) */
function pilotExample() {
  const sb = JSON.parse(fs.readFileSync(PILOT, "utf-8"));
  const media = [
    { slot: "kfLogo", kind: "logo", entity: "Kingfisher Airlines", intent: "Kingfisher Airlines logo", size: "card" },
    { slot: "kfA320", kind: "photo", entity: "Kingfisher Airlines", intent: "Kingfisher Airlines Airbus A320 aircraft on the tarmac", era: "2005-2012", size: "card" },
    { slot: "deccanATR", kind: "photo", entity: "Air Deccan", intent: "Air Deccan ATR aircraft", era: "2003-2008", size: "card" },
    { slot: "mallya", kind: "portrait", entity: "Vijay Mallya", intent: "portrait photo of businessman Vijay Mallya", size: "card" },
    { slot: "kfHyd", kind: "photo", entity: "Kingfisher Airlines", intent: "Kingfisher Red aircraft at Hyderabad airport", era: "2008", size: "full" },
    { slot: "jokeArt", kind: "illustration", intent: "a couple at a wedding where the groom proudly holds up a gym membership card", mood: "comedic", size: "card" },
  ];
  return JSON.stringify({ narration: sb.sentences.map((s) => `${s.id}: ${s.text}`), output: { scaffolds: sb.scaffolds, events: sb.events, media } });
}

const LF_GRAMMAR = `VISUAL GRAMMAR (16:9 long-form, "LF": paper-white #F7F6F1 editorial plate, 12-column grid, Inter heads, mono micro labels, real photos as ONE layer inside motion-graphics layouts)
COMPOSITION (hard, the user's rule -- a produced YouTube documentary frame, never a two-column website):
- CENTRE STAGE: every scene has ONE hero on the frame's centre axis -- a photo / map / chart (lfStage, lfFull, lfMap, lfChart), a big figure (lfNumber), two cards with a VS chip on the centre line (lfCompare), a timeline band (lfTimeline), a retypeset headline (lfHeadline), an art card (lfJoke). The eye stays at the centre from scene to scene.
- SATELLITES orbit the hero in the LEFT and RIGHT rails ("left": [...], "right": [...], 0-2 each, balanced: the two rails differ by at most 1): stat chips (callout {value, text}), mini big-number cards (bigNumber), a portraitCard of the person named, a small photo thumbnail, a short lfText label. Each enters on its word ("anchor"). Never a column of body text beside the picture.
- ON-SCREEN TEXT IS SHORT: the narrator says the sentences; the screen shows kicker, headline (<= ${TEXT.title} words), labels and numbers. No "sub" paragraphs on lfText; bigNumber context <= ${TEXT.context} words; callout text <= ${TEXT.callout} words; lowerThird title / sub <= ${TEXT.title} words each; chapter promise <= ${TEXT.promise} words; headlineCard deck <= ${TEXT.deck} words (or none).
- The headline sits TOP-CENTRE ("title") or as a lower third centred over the hero's bottom edge ("headline") -- one of the two.
- Transitions: at most every third cut, {"out": "zoomThrough", "in": "zoomIn"} pushes through the centre into the next scene (the rest are hard cuts).
MIX RULE (hard, the user's rule -- it is never a slideshow):
- Every scene is a motion-graphics layout. Photos/illustrations appear INSIDE it (the centred hero card, a satellite thumbnail or portrait, a backdrop behind a big number, thumbnails on a timeline, columns in a compare, a full bleed with a lower third).
- Graphics are on screen 100% of the time: within 1.5 s of every cut a non-photo graphic is visible (lfText, bigNumber, callout, lowerThird, chart, headlineCard, compareCols, eraTimeline, recapList, chapterCard).
- EVERY photo gets animated annotations on the words: overlays (callout / lowerThird at [x%, y%] of the photo, with an optional "point" leader) AND/OR events highlight {box,label} / arrow {from,to,label} / zoomTo {box} / dim.
- Real media is visible a good part of the runtime (photo heroes, satellites, thumbnails, backdrops); never more than ${MIX.maxMediaRun} media scenes in a row; never the same layout twice in a row.
- lfFull always carries a lowerThird landing within 1.5 s plus a callout or highlight.
CADENCE (relaxed documentary pace, ~160 words/min):
- A new scaffold every 1-3 sentences, scene life median 5-10 s; a visual change (event, entrance, new scaffold) at least every 5 s; 18-40 visual beats per minute.
- Every sentence gets 1-3 word-anchored events or starts a scaffold; count-ups land on the number word; charts draw bar by bar on the words that name them.
- A photo's highlight box and its label ride the picture: a later zoomTo on that photo must contain the highlight box (or unhighlight first), otherwise the label is pushed off the frame.
- The "highlight" op on lfText / headlineCard sweeps a marker over props.highlight, so any text you highlight MUST carry props.highlight (a phrase copied verbatim from its title).
NUMBERS ON SCREEN:
- bigNumber / barChart / lineChart values come ONLY from the FACTS below (value or a figure stated in the claim, in display units: ₹550 crore -> value 550, unit "crore"), a year, or a calc the narration already makes. Never invent data. Every chart has a "source" line naming where the numbers come from (e.g. "Company filings via Mint, 2012").
- DATA SERIES (listed below when the dossier has them) are real World Bank series. When a chart shows one, reference it instead of typing numbers: lineChart props {"title", "series": "S1", "from"?: 2010} (or "series": ["S1","S2"] for two lines), barChart props {"title", "series": "S1", "last"?: 6}. Points, unit and the source line are filled in by the compiler: do NOT write points / bars / unit / source for a series chart. Annotate points with {"i": <1-based point>, "text"}.
MAPS (vector, exact, animated on the words -- prefer them over mapCard images):
- countryMap {focus: [ISO3 codes, 1-4]} for where-is-it / border / neighbour / trade-route beats; worldMap for global comparisons. Use them as the lfMap hero ("map": {"type": "countryMap", "props": {...}}) or an lfStage hero.
- Events on the words: highlight {iso, tone} on the country's name, pin {city} (or {lonlat: [lon, lat]}) on the city, arrow {from: {city|iso}, to: {city|iso}, label} on the verb of the flow ("lent", "exports", "borrowed"), zoomTo {isos: [...]} when the story moves region.
- A pin sits exactly where its label says: pin {city} only for that named city (label = the city or something IN it); any other place (a plant, a dam, a port town not listed) needs {lonlat: [lon, lat]}. Put each pin EITHER in props.pins (shown on entrance) OR as a pin event (on its word), never both.
- An annotate note on a series chart shows THAT point's value in the series' unit and/or a short event label ("2008: 1.7 months", "IMF deal"); never a figure from another metric (no "$8.6B" on a months-of-imports line).
- When the narration talks about a trend a DATA SERIES covers (reserves, debt, deficits, GDP over years), show it as a series chart (lfChart with a lineChart {"series": "S#"}) rather than retyping figures.
- At most 1 zoomTo per scene, and leave >= 1.4 s after a zoomTo before the next event on that map (the camera takes 1.2 s). At most 3 arrows and 4 pins per map; pin / arrow labels <= 14 characters.
- A world choropleth uses ONLY a DATA SERIES of kind "map": worldMap props {"choropleth": {"series": "S6", "title": "<= 4 words"}} or a choropleth event {"series": "S6"}. Never type map values.
- Country codes are ISO3 (IND, PAK, CHN, LKA, USA ...). Named cities: ${Object.keys(CITIES).join(", ")}; any other place needs lonlat.
- Digits live on screen; narration spells numbers (it is fixed -- do not touch it).
- bigNumber: prefer count "enter" (counts up as the card appears; enter it on the number word with "anchor" when the number is said later). count "op" shows 0 until its count event, so only use it with a count event within ~1 s of the card's entrance.
MEDIA SLOTS:
- Media is referenced ONLY through {"slot": "<name>"} props (photo / backdrop / art / photoGrid items / compareCols cols[].photo / eraTimeline ticks[].photo / portraitCard / mapCard). Never a URL or file.
- Declare every slot you use exactly once in "media": {slot, kind: photo|portrait|logo|map|illustration, entity? (the Wikidata-style name, e.g. "Air Deccan"), intent (concrete nouns + place + era: "Air Deccan ATR aircraft on an Indian airport apron"), era? ("2007"), size?: full (full-bleed lfCold/lfFull/backdrop) | card (centred heroes, satellites, compare, timeline thumbs, logos)}.
- Reuse a slot across scenes when it is the same picture (e.g. the airline's plane in a split, then as a timeline thumb). 4-9 distinct slots per chapter.
- illustration = AI art for jokes/analogies/concepts ONLY (lfJoke art); never real people or real news events, never text in the image. Real people -> portrait; companies -> logo or photo.
- A headline is REBUILT with headlineCard (typeset), never a screenshot; paraphrase and mark it "Paraphrased ... · retypeset" in note.
- documentStamp is an ILLUSTRATION (the page says so): generic wording only ("Suspension of debt payments", a dossier date); never an invented decree / law number, ministry letterhead or official reference -- those only when the exact string is in the FACTS.
COLOUR: red = cost/loss/failure, blue = the neutral subject/money in, green = gains/recovery, amber = warnings. Max 3 hues per scene. TONES ${TONES.join(", ")}.`;

/** scene budget for a section at the LF pace (160 wpm incl. 0.35 s gaps) */
function scenePlan(section) {
  const words = section.sentences.reduce((a, s) => a + String(s.text).split(/\s+/).filter(Boolean).length, 0);
  const seconds = Math.round((words / 160) * 60);
  const scenes = Math.max(3, Math.round(seconds / 7));
  return { words, seconds, scenes, graphic: Math.max(1, Math.ceil(scenes / 3)) };
}

/** the STATIC part of the LF prompt (identical for every section and video): first, so Gemini's implicit cache hits */
let STATIC_PROMPT = null;
function staticPromptLF() {
  if (STATIC_PROMPT) return STATIC_PROMPT;
  STATIC_PROMPT = `You storyboard ONE section of an 8-12 minute 16:9 YouTube deep-dive, narrated (no presenter), in ONE precise house style. Output ONLY a JSON object {"scaffolds": [...], "events": [...], "media": [...], "pauses"?: {"<sentence id>": seconds}}. The SCENE PLAN at the end fixes what every scene shows; you fill it with content.

${LF_GRAMMAR}

TEMPLATES (scaffold = {id, template, from: <first sentence id>, mirror?, slots})
${Object.entries(TEMPLATE_DOCS).filter(([k]) => /^lf[A-Z]/.test(k) && !LF_HIDDEN.has(k)).map(([k, v]) => `- ${k}: ${v}`).join("\n")}
Slot fill = {id, type?, props, anchor?: {text, occurrence?, sentence?} (enters on that word), at?}. Overlays = [{id, type: callout|lowerThird, at: [x%, y%], w, point?: [x%, y%], anchor? | delay?, props}].

MODULES (LF cards: type -> use, props, ops)
${lfCatalogText()}
Generic ops on any module: reveal, remove, text{text}, tone{tone}, highlight{hold?}, dim, undim. NOT in LF: retype, slam.

EVENTS
{ "sentence": "<sentence id>", "anchor": {"text": "<ONE word copied verbatim, incl. punctuation, from that sentence>", "occurrence"?: n}, "op": "<op>", "target": "<module id>[.<sub-target>]", "value"?: {...} }
- The target must be on screen at that sentence (its scaffold spans it). Module ids are unique within the section.

WORKED EXAMPLE (a different chapter of a similar video -- follow its density and annotation habits, not its content or its layouts):
${pilotExample()}`;
  return STATIC_PROMPT;
}

/** a section's scene plan (beat sheet) as fixed prompt lines */
function planLines(plan) {
  const { KINDS } = require("./beatSheet");
  return plan
    .map((sc) => {
      const K = KINDS[sc.kind] || {};
      const span = sc.sentences.length > 1 ? `${sc.sentences[0]}..${sc.sentences[sc.sentences.length - 1]}` : sc.sentences[0];
      return `- scene ${sc.n}: "from": "${sc.from}" (${span}, ~${Math.round(sc.seconds)} s) -> ${sc.kind}: ${K.doc || sc.template}`;
    })
    .join("\n");
}
/** plan identity for the storyboard resume hash ("" without a plan: old storyboards stay valid) */
function planKey(plan) {
  return Array.isArray(plan) && plan.length ? plan.map((s) => `${s.from}:${s.kind}`).join(",") : "";
}

function buildPromptLF({ section, meta, dossier, outline, topic, extraNotes, plan: scenePlanIn }) {
  const brief = outlineSection(outline, section.id);
  const facts = (dossier.facts || []).map((f) => `${f.id}: ${f.claim}${f.value !== undefined ? ` [value ${f.value} ${f.unit || ""}${f.year ? `, ${f.year}` : ""}]` : ""}`).join("\n");
  const timeline = (dossier.timeline || []).map((t) => `${t.year}: ${t.event}`).join("\n");
  const entities = (dossier.entities || []).map((e) => `${e.name} (${e.kind})`).join(", ");
  const quotes = (dossier.quotes || []).map((q) => `${q.id || ""}: "${q.text || q.quote}" -- ${q.speaker || q.source || ""}${q.date ? `, ${q.date}` : ""}`).join("\n");
  const calcs = section.sentences.flatMap((s) => (s.calc || []).map((c) => `${s.id}: ${c.expr}`));
  const series = dataSeriesLines(arguments[0]);
  const plan = scenePlan(section);
  const fixed = Array.isArray(scenePlanIn) && scenePlanIn.length;
  const first =
    meta.kind === "cold"
      ? `The FIRST scaffold is an lfCold (full-bleed photo + kinetic headline + overlays); this is the video's hook (~${plan.seconds} s), no chapter chrome.`
      : meta.kind === "recap"
        ? `The FIRST scaffold is an lfChapter card (the compiler fills "CH ${String(meta.index).padStart(2, "0")} · RECAP"; you write props.promise); then an lfRecap that checks off the takeaways on the words. The channel end screen is appended automatically after the last sentence -- never author lfEnd.`
        : `The FIRST scaffold is an lfChapter card for "${meta.title}" (the compiler fills number/title/progress; you write props.promise, one line) with a photo that sets the chapter.`;
  return `${staticPromptLF()}

======== THIS SECTION ========
VIDEO TOPIC: ${topic}
SECTION: ${meta.kind === "cold" ? "COLD OPEN" : meta.kind === "recap" ? `RECAP (chapter ${meta.index} of ${meta.count})` : `CHAPTER ${meta.index} of ${meta.count}: "${meta.title}"`} (${meta.count - 1} chapters in the video)
${brief.question ? `Question: ${brief.question}\n` : ""}${brief.comedicBeat ? `Comedic beat: ${brief.comedicBeat}\n` : ""}${(brief.takeaways || []).length ? `Takeaways: ${brief.takeaways.join(" / ")}\n` : ""}
NARRATION (FIXED -- these exact sentences are voiced; do not rewrite, add, drop or reorder them; anchors copy words from them verbatim):
${section.sentences.map((s) => `${s.id}: ${s.text}`).join("\n")}
${calcs.length ? `Verified calcs in the narration (their results may be shown): ${calcs.join("; ")}\n` : ""}
FACTS (the only source of on-screen numbers):
${facts}

${series ? `DATA SERIES (World Bank; reference them as {"series": "<id>"}; never retype the values):\n${series}\n\n` : ""}${quotes ? `VERIFIED QUOTES (quoteCard text comes ONLY from here, verbatim):\n${quotes}\n\n` : ""}TIMELINE:
${timeline}

ENTITIES (use these names for media "entity"): ${entities}

STRUCTURE
- ${first}
${
  fixed
    ? `- SCENE PLAN (hard, from the visual beat sheet -- variety across the whole video): exactly one scaffold per line below, starting at that "from" sentence, using that template / hero type. Fill it with this section's content; do not swap layouts, merge or split scenes.\n${planLines(scenePlanIn)}`
    : `- This section runs about ${plan.seconds} s: use about ${plan.scenes} scaffolds (a new one every 6-8 s, 1-3 sentences each), at least ${plan.graphic} of them GRAPHIC-ONLY, never the same layout twice in a row.`
}
- "pauses" (optional): a longer breath after a sentence that closes a paragraph, 0.5-0.7 s. Default gaps are 0.35 s.
${extraNotes ? `\n${extraNotes}\n` : ""}
Return the JSON for THIS section now.`;
}

function buildRepairPromptLF(ctx, raw, problems, summary) {
  return `${buildPromptLF(ctx)}

YOUR PREVIOUS OUTPUT:
${JSON.stringify(raw)}

IT FAILED VALIDATION:
${problems.map((p) => "- " + p).join("\n")}
${summary ? `\n${summary}\n` : ""}
Return the corrected full JSON {"scaffolds","events","media","pauses"?}. Keep everything that was valid; fix exactly these problems. The narration stays as given.`;
}

// ---------------------------------------------------------------------------------------------
// assembly + validation

/** model output -> storyboard.v3 (narration always from the script) */
/** "S1 time PAK Pakistan: External debt stocks (% of GNI) [% of GNI], 1990-2023 ..." lines for the prompt */
function dataSeriesLines(ctx) {
  const list = (ctx.data && ctx.data.series) || [];
  return list
    .map((x) =>
      x.kind === "map"
        ? `${x.id} map (all countries, ${x.year}): ${x.indicatorName || x.metric} [${x.unit}] -- for worldMap choropleths`
        : `${x.id} time ${x.country} ${x.countryName || ""}: ${x.indicatorName || x.metric} [${x.unit}], ${x.points[0].x}-${x.points[x.points.length - 1].x} (${x.points.length} points), latest ${x.points[x.points.length - 1].y} (${x.points[x.points.length - 1].x})`
    )
    .join("\n");
}

/** every {series: "<id>"} referenced in scaffolds / events */
function referencedSeries(sb) {
  const out = new Set();
  const walk = (v) => {
    if (Array.isArray(v)) return v.forEach(walk);
    if (!v || typeof v !== "object") return;
    [].concat(v.series || []).forEach((x) => typeof x === "string" && out.add(x));
    Object.values(v).forEach(walk);
  };
  walk(sb.scaffolds);
  walk(sb.events);
  return out;
}

function assemble(raw, { section, meta, topic, data }) {
  const r = raw && typeof raw === "object" ? raw : {};
  const pauses = r.pauses && typeof r.pauses === "object" ? r.pauses : {};
  const sentences = section.sentences.map((s) => {
    const out = { id: s.id, text: s.text };
    const p = Number(pauses[s.id]);
    if (Number.isFinite(p)) out.pauseAfter = Math.min(0.9, Math.max(0.35, p));
    return out;
  });
  const sb = {
    version: "storyboard.v3",
    profile: "LF",
    frame: { ...FRAME },
    topic,
    chapter: { index: meta.index, count: meta.count, title: meta.title },
    section: section.id,
    entities: {},
    sentences,
    scaffolds: Array.isArray(r.scaffolds) ? r.scaffolds : [],
    events: Array.isArray(r.events) ? r.events : [],
    mediaIntents: Array.isArray(r.media) ? r.media : Array.isArray(r.mediaIntents) ? r.mediaIntents : [],
  };
  // the referenced data series travel WITH the storyboard (sb.data, read by compile): the chapter
  // renders the exact numbers it was validated against, whatever data.json does later
  const refs = referencedSeries(sb);
  if (refs.size && data && Array.isArray(data.series)) sb.data = { version: data.version || "data.v1", series: data.series.filter((x) => refs.has(x.id)) };
  return sb;
}

/** every props.slot referenced anywhere in the scaffolds */
function referencedSlots(sb) {
  const out = new Set();
  const walk = (v) => {
    if (Array.isArray(v)) return v.forEach(walk);
    if (!v || typeof v !== "object") return;
    if (typeof v.slot === "string") out.add(v.slot);
    Object.values(v).forEach(walk);
  };
  walk(sb.scaffolds);
  return out;
}

/** a stand-in manifest where every declared slot resolved, so the mix metrics see the media */
function syntheticManifest(sb) {
  const slots = {};
  for (const it of sb.mediaIntents || []) {
    if (!it || !it.slot) continue;
    const illu = it.kind === "illustration";
    slots[it.slot] = { status: illu ? "illustration" : "ok", kind: "image", source: illu ? "illustration" : "commons", file: `assets/media/cache/00/synthetic-${it.slot}.jpg`, credit: illu ? "Illustration: AI-generated" : "Photo: synthetic / Wikimedia Commons · CC BY-SA 4.0", focal: [0.1, 0.1, 0.8, 0.8], width: 1920, height: 1280 };
  }
  return { version: "media-manifest.v1", slots };
}

let libIndex = null;
/** manifest for the synthetic layout audit: exact library hits, else a stand-in cached image */
function layoutManifest(sb) {
  const { indexLibrary, matchLibrary, entryFromSidecar } = require("../media/library");
  try {
    libIndex = libIndex || indexLibrary();
  } catch (_) {
    libIndex = new Map();
  }
  const intents = (sb.mediaIntents || []).filter((it) => it && it.slot);
  const { hits } = matchLibrary(intents, { index: libIndex });
  let stand = null;
  for (const list of libIndex.values()) {
    const r = list.find((x) => x.kind === "image" && x.source !== "illustration" && Number(x.width) >= 1280);
    if (r) {
      stand = entryFromSidecar(r);
      break;
    }
  }
  const slots = {};
  intents.forEach((it) => {
    if (hits[it.slot]) slots[it.slot] = hits[it.slot];
    else if (stand) slots[it.slot] = { ...stand, status: it.kind === "illustration" ? "illustration" : "ok" };
  });
  return { version: "media-manifest.v1", slots };
}

function mediaOk(m) {
  const p = m.props || {};
  return LF_MEDIA.has(m.type) && (!!p.src || (p.items || []).some((x) => x && typeof x === "object" && x.src) || [p.left, p.right].some((x) => x && x.src));
}

/** the v3_gates LF metrics, computed on a compiled spec (synthetic or real timing) */
function mixReport(spec, total, events = []) {
  const at = (t) => {
    const s = spec.scaffolds.find((x) => x.t0 - 1e-6 <= t && t < x.t1);
    return s ? [s, s.modules.filter((m) => s.t0 + (m.at || 0) <= t + 1e-6)] : [null, []];
  };
  const bare = [];
  let n = 0;
  let media = 0;
  for (let k = 0.5; k < total - 0.3; k += 1) {
    const [s, vis] = at(k);
    n++;
    if (!s) continue;
    const graphic = vis.some((m) => !LF_MEDIA.has(m.type) && !LF_CHROME.has(m.type));
    if (!graphic && s.template !== "lfEnd" && k - s.t0 > MIX.graceS) bare.push(`${s.id} @${k.toFixed(1)}s`);
    if (vis.some(mediaOk)) media++;
  }
  const mediaScenes = spec.scaffolds.map((s) => s.modules.some(mediaOk));
  let run = 0;
  let maxRun = 0;
  mediaScenes.forEach((x) => {
    run = x ? run + 1 : 0;
    maxRun = Math.max(maxRun, run);
  });
  const targeted = new Set(events.map((e) => String(e.target || "").split(".")[0]));
  const unannotated = [];
  spec.scaffolds.forEach((s) => {
    const hasOverlay = s.modules.some((m) => m.type === "callout" || m.type === "lowerThird");
    s.modules.filter((m) => m.type === "photo" && m.props && m.props.src).forEach((m) => {
      if (!hasOverlay && !targeted.has(m.id)) unannotated.push(`${s.id}/${m.id}`);
    });
  });
  const lives = spec.scaffolds.map((s) => s.t1 - s.t0).sort((a, b) => a - b);
  return {
    bareSeconds: bare,
    mediaSharePct: Math.round((1000 * media) / Math.max(1, n)) / 10,
    maxMediaRun: maxRun,
    graphicOnlyScenes: mediaScenes.filter((x) => !x).length,
    unannotated,
    lifeMedian: lives.length ? lives[Math.floor(lives.length / 2)] : 0,
  };
}

/** numbers a chart / big number may show: fact values (base and display units), claim figures, years, section calcs */
function allowedNumbers(dossier, section) {
  const vals = [];
  const years = new Set();
  const facts = dossier.facts || [];
  const factValues = {};
  for (const f of facts) {
    if (f.year) years.add(Number(String(f.year).slice(0, 4)));
    const v = Number(f.value);
    if (Number.isFinite(v)) {
      vals.push(v, v * unitScale(f.unit));
      factValues[f.id] = v * unitScale(f.unit);
    }
    claimNumbers(f).forEach((c) => vals.push(c.value));
    // percentages / plain figures in the claim text as written ("26%", "46%", "20 aircraft")
    (String(f.claim || "").match(/\d[\d,]*(?:\.\d+)?/g) || []).forEach((d) => vals.push(Number(d.replace(/,/g, ""))));
  }
  (dossier.timeline || []).forEach((t) => t.year && years.add(Number(String(t.year).slice(0, 4))));
  for (const s of (section && section.sentences) || []) {
    for (const c of s.calc || []) {
      try {
        vals.push(evalCalc(c.expr, factValues));
      } catch (_) {
        /* the script gate already reported it */
      }
    }
  }
  const scaled = [];
  for (const v of vals) for (const d of [1, 1e3, 1e5, 1e6, 1e7, 1e9, 1e12]) scaled.push(v / d);
  return { values: scaled.filter((x) => Number.isFinite(x) && x !== 0), years };
}

function numberOk(v, allowed) {
  if (!Number.isFinite(v)) return false;
  if (v === 0 || v === 100) return true;
  if (Number.isInteger(v) && allowed.years.has(v)) return true;
  return allowed.values.some((c) => close(v, c));
}

/** on-screen figures in the storyboard: [{where, value}] */
function screenNumbers(sb) {
  const out = [];
  const visit = (fill, where) => {
    if (!fill || typeof fill !== "object") return;
    const p = fill.props || {};
    const type = fill.type;
    if ((type === "bigNumber" || where.endsWith("number")) && p.value !== undefined) out.push({ where, value: Number(p.value) });
    if (type === "barChart" || (where.endsWith("chart") && Array.isArray(p.bars))) (p.bars || []).forEach((b, i) => out.push({ where: `${where}.bars[${i}]`, value: Number(b.value) }));
    if (type === "lineChart" || (where.endsWith("chart") && (p.points || p.series))) {
      (p.points || []).forEach((pt, i) => out.push({ where: `${where}.points[${i}]`, value: Number(pt.y) }));
      // a data-series ref ({series: "S1"} / ["S1","S2"]) carries no typed numbers: the compiler fills them from data.json
      [].concat(p.series || []).filter((se) => se && typeof se === "object").forEach((se, j) => (se.points || []).forEach((pt, i) => out.push({ where: `${where}.series[${j}].points[${i}]`, value: Number(pt.y) })));
    }
  };
  (sb.scaffolds || []).forEach((sc) => {
    const s = sc.slots || {};
    Object.entries(s).forEach(([k, v]) => {
      if (Array.isArray(v)) v.forEach((f, i) => visit(f, `${sc.id}.${k}[${i}]${f && f.type ? ":" + f.type : ""}`));
      else visit(v, `${sc.id}.${k}`);
    });
  });
  return out;
}

function chartFills(sb) {
  const out = [];
  (sb.scaffolds || []).forEach((sc) => {
    Object.entries(sc.slots || {}).forEach(([k, v]) => {
      [].concat(v || []).forEach((f) => {
        if (f && typeof f === "object" && (f.type === "barChart" || f.type === "lineChart" || (k === "chart" && sc.template === "lfChart"))) out.push({ sc, f });
      });
    });
  });
  return out;
}

/**
 * Full LF chapter validation (no network). Returns {problems, report}.
 * opts.layoutAudit: false skips the headless-Chrome audit (unit tests).
 */
async function validateChapter(sb, ctx, opts = {}) {
  const { section, meta, dossier } = ctx;
  const log = opts.log || (() => {});
  const P = [];
  // narration is fixed: the assembled storyboard must carry exactly the script sentences
  const want = section.sentences.map((s) => `${s.id}\u0000${s.text}`).join("\n");
  const got = (sb.sentences || []).map((s) => `${s.id}\u0000${s.text}`).join("\n");
  if (want !== got) P.push("narration differs from the script (sentences are fixed)");
  if (!Array.isArray(sb.scaffolds) || !sb.scaffolds.length) return { problems: P.concat(["scaffolds[] missing"]), report: null };
  const first = sb.scaffolds[0].template;
  if (meta.kind === "cold" && first !== "lfCold") P.push(`the cold open starts with an lfCold scaffold (got ${first})`);
  if (meta.kind !== "cold" && first !== "lfChapter") P.push(`a chapter starts with an lfChapter card (got ${first})`);
  if (sb.scaffolds.some((s) => s.template === "lfEnd")) P.push("never author lfEnd; the end screen is appended after the recap automatically");
  if (sb.scaffolds.some((s, i) => i > 0 && s.template === "lfChapter")) P.push("only the first scaffold may be an lfChapter card");
  P.push(...compositionProblems(sb));
  P.push(...varietyProblems(sb, ctx.plan));
  // set-2 module props (quoteCard, lfYearTimeline, flowDiagram, ..., routeMap): authoring schema
  {
    const { lf2Problems, docStampProblems, dossierText } = require("../video/v3/lf2");
    const dtext = dossierText(dossier);
    (sb.scaffolds || []).forEach((sc) => Object.entries(sc.slots || {}).forEach(([k, v]) => [].concat(v || []).forEach((f) => {
      const type = f && (f.type || { quote: "quoteCard", split: "splitScreen", burst: "flashBurst" }[k]);
      if (type) P.push(...lf2Problems(type, f.props, `${sc.id}.${k}`));
      if (type === "documentStamp") P.push(...docStampProblems(f.props || {}, dtext, `${sc.id}.${k}`));
    })));
  }
  // media intents
  const intents = sb.mediaIntents || [];
  try {
    validateIntents(intents);
  } catch (err) {
    P.push(`media: ${err.message}`);
  }
  intents.forEach((it) => {
    if (it && it.slot && !/^[A-Za-z][A-Za-z0-9_-]{1,40}$/.test(it.slot)) P.push(`media slot "${it.slot}": use letters, digits, - or _ (2-41 chars)`);
    if (it && /https?:\/\//i.test(String(it.intent || ""))) P.push(`media slot "${it.slot}": intents describe a picture; never a URL`);
    if (it && it.size && !["full", "card", "portrait", "logo", "map"].includes(it.size)) P.push(`media slot "${it.slot}": size must be full|card|portrait|logo|map`);
  });
  const declared = new Set(intents.map((it) => it && it.slot));
  const used = referencedSlots(sb);
  used.forEach((s) => !declared.has(s) && P.push(`slot "${s}" is used in a scaffold but not declared in "media"`));
  declared.forEach((s) => s && !used.has(s) && P.push(`media slot "${s}" is declared but never used; drop it (every slot costs a lookup)`));
  // charts: mandatory source line, numbers from the dossier only
  chartFills(sb).forEach(({ sc, f }) => {
    if (!String((f.props || {}).source || "").trim() && !(f.props || {}).series) P.push(`scaffold ${sc.id}: chart ${f.id || ""} needs props.source (where the numbers come from)`);
  });
  const allowed = allowedNumbers(dossier, section);
  screenNumbers(sb).forEach(({ where, value }) => {
    if (!numberOk(value, allowed)) P.push(`${where}: on-screen number ${value} matches no dossier fact, year or narration calc; show only fact figures`);
  });
  // the shared LF validator: templates, digits, compile on the relaxed synthetic timeline, ops, beats/min, holds
  const base = validate(sb);
  P.push(...base.flatMap((p) => (/^a hold of/.test(p) ? locateHolds(sb) : [p])));
  // cadence-only findings (holds / beats per minute) still get the mix metrics, so one repair
  // round sees every problem at once instead of oscillating between them
  const cadenceOnly = (p) => isHoldProblem(p) || /visual beats\/min on the synthetic LF timeline/.test(p);
  if (P.some((p) => !cadenceOnly(p))) return { problems: P, report: null };

  // mix rule on the compiled spec (every declared slot treated as resolved)
  const tl = syntheticTimeline(sb, PROFILES.LF.syn);
  let spec;
  try {
    spec = compileStoryboard(sb, tl, { mascot: false, media: syntheticManifest(sb) });
  } catch (err) {
    return { problems: [err.message], report: null };
  }
  const report = mixReport(spec, tl.totalSeconds, sb.events || []);
  report.seconds = tl.totalSeconds;
  report.scaffolds = spec.scaffolds.length;
  // the render gate band is 18-40 beats/min on the REAL timing; keep a margin on the synthetic one
  report.beatsPerMin = Math.round(10 * beatsPerMin(spec, tl.totalSeconds)) / 10;
  if (report.beatsPerMin > MIX.bpmSyn[1]) P.push(`${report.beatsPerMin} visual beats/min is at the top of the LF band (keep <= ${MIX.bpmSyn[1]} so the real voice timing stays under 40): drop an event or merge two scenes`);
  if (report.beatsPerMin < MIX.bpmSyn[0]) P.push(`only ${report.beatsPerMin} visual beats/min (keep >= ${MIX.bpmSyn[0]}): add word-anchored events`);
  if (report.bareSeconds.length) P.push(`no graphic over the photo for more than ${MIX.graceS} s at ${report.bareSeconds.slice(0, 4).join(", ")}: add a callout / lowerThird overlay or a text/number module to those scenes`);
  // with a beat-sheet plan the section's media share is planned video-wide (maps / graphics / cards take
  // their share), so only a near-empty section is flagged
  const mediaLo = Array.isArray(ctx.plan) && ctx.plan.length ? MIX.mediaSharePlanned : MIX.mediaShare[0];
  if (report.mediaSharePct < mediaLo) P.push(`real media visible only ${report.mediaSharePct}% of the section (target ${MIX.mediaShare.join("-")} %): add photo cards / backdrops to more scenes`);
  if (report.mediaSharePct > MIX.mediaShare[1]) P.push(`real media visible ${report.mediaSharePct}% of the section (target ${MIX.mediaShare.join("-")} %): add graphic-only scenes (lfChart, lfNumber without backdrop, lfCompare)`);
  if (report.maxMediaRun > MIX.maxMediaRun) P.push(`${report.maxMediaRun} media scenes in a row; put a graphic-only scene between them (max ${MIX.maxMediaRun} in a row)`);
  if (spec.scaffolds.length >= 5 && report.graphicOnlyScenes < 1) P.push("no graphic-only scene in this chapter; add an lfChart / lfNumber / lfCompare between the photo scenes");
  // renderer contract: a marker highlight on lfText / headlineCard sweeps props.highlight
  const byId = {};
  spec.scaffolds.forEach((sc) => sc.modules.forEach((m) => (byId[m.id] = m)));
  (sb.events || []).forEach((e, i) => {
    const m = byId[String(e.target || "").split(".")[0]];
    if (e.op === "highlight" && m && (m.type === "lfText" || m.type === "headlineCard") && !(m.props || {}).highlight && !(e.value && e.value.phrase))
      P.push(`event[${i}] highlight on ${m.id}: ${m.type} needs props.highlight (a phrase copied from its title) to sweep; add one or target another module`);
  });
  P.push(...zoomLabelProblems(spec));
  P.push(...mapProblems(spec));
  P.push(...seriesNoteProblems(spec));
  P.push(...seriesConsistencyProblems(spec));
  // a bigNumber with count "op" shows 0 until its count event: that must follow its entrance closely
  spec.scaffolds.forEach((sc) =>
    sc.modules
      .filter((m) => m.type === "bigNumber" && (m.props || {}).count === "op")
      .forEach((m) => {
        const shown = sc.t0 + (m.at || 0);
        const c = spec.events.filter((e) => e.op === "count" && String(e.target).split(".")[0] === m.id).sort((a, b) => a.t - b.t)[0];
        if (!c || c.t - shown > 1.2)
          P.push(`bigNumber ${m.id} (count "op") shows 0 for ${c ? (c.t - shown).toFixed(1) + " s" : "its whole run"} before its count event: use count "enter" (counts up as it appears), or enter it on the number word with "anchor"`);
      })
  );
  report.unannotated.forEach((id) => P.push(`photo ${id} has no annotation: add an overlay (callout / lowerThird) or a highlight / arrow / zoomTo event on its words`));
  if (spec.scaffolds.length >= 3 && (report.lifeMedian < MIX.lifeMedian[0] - 1 || report.lifeMedian > MIX.lifeMedian[1])) P.push(`scene life median ${report.lifeMedian.toFixed(1)} s (target ${MIX.lifeMedian.join("-")} s): ${report.lifeMedian > MIX.lifeMedian[1] ? "start new scaffolds more often" : "merge short scenes"}`);
  if (P.length || opts.layoutAudit === false) return { problems: P, report };

  // real-DOM layout audit at 1920x1080 on the synthetic timing, with REAL pictures in the photo
  // modules (annotation labels / zooms only lay out on a loaded image): cached library matches for
  // the declared intents, else any cached image as a stand-in, else the fallback state
  try {
    const { auditLayout, describe } = require("../../tools/layout_audit");
    const spec0 = compileStoryboard(sb, tl, { mascot: false, media: opts.layoutMedia || layoutManifest(sb) });
    const la = await auditLayout({ spec: spec0, duration: tl.totalSeconds, log });
    P.push(...la.problems.map((p) => "layout " + describe(p)), ...la.buildProblems.map((p) => "renderer: " + p));
  } catch (err) {
    log(`  (layout audit skipped: ${err.message})`);
  }
  return { problems: P, report };
}

const words = (t) => String(t || "").split(/\s+/).filter(Boolean).length;

/**
 * The visual kind a scaffold shows (the beat-sheet vocabulary, lib/longform/beatSheet.js KINDS): the hero
 * module for hero templates, else the template's own layout.
 */
function sceneKind(sc) {
  const s = sc.slots || {};
  const heroType = (f, d) => (f && f.type) || d;
  switch (sc.template) {
    case "lfChapter":
      return "chapter";
    case "lfCold":
      return "cold";
    case "lfStage":
    case "lfSplit": {
      const t = heroType(s.hero || s.photo, "photo");
      return t === "photo" && s.size === "full" ? "fullBleed" : t;
    }
    case "lfMap":
      return heroType(s.map, "countryMap");
    case "lfChart":
      return heroType(s.chart, "barChart");
    case "lfFull":
      return "fullBleed";
    case "lfNumber":
      return "bigNumber";
    case "lfCompare":
      return "compareCols";
    case "lfTimeline":
      return "eraTimeline";
    case "lfHeadline":
      return "headlineCard";
    case "lfJoke":
      return "joke";
    case "lfRecap":
      return "recapList";
    case "lfQuote":
      return "quoteCard";
    case "lfFeature":
      return heroType(s.hero, "feature");
    case "lfDuo":
      return "splitScreen";
    case "lfFlash":
      return "flashBurst";
    default:
      return sc.template;
  }
}

/**
 * Variety gate (LONGFORM-V2-PLAN §6.3, deterministic): the storyboard follows its beat-sheet SCENE PLAN (each
 * planned scene starts at its sentence with its kind), never shows the same kind twice in a row, no kind takes
 * over the section, maps stay >= 60 s apart and a graphic lands at least every 90 s. Messages name the exact
 * scaffold and the fix, for the repair loop.
 */
function varietyProblems(sb, plan) {
  const P = [];
  const { KINDS, RULES, seconds } = require("./beatSheet");
  const scs = sb.scaffolds || [];
  const byFrom = new Map(scs.map((sc) => [sc.from, sc]));
  const planned = Array.isArray(plan) && plan.length;
  if (planned) {
    plan.forEach((ps) => {
      const sc = byFrom.get(ps.from);
      const K = KINDS[ps.kind] || {};
      if (!sc) {
        P.push(`scene plan: scene ${ps.n} (${ps.kind}) must be a scaffold starting at sentence ${ps.from} ("from": "${ps.from}", template ${K.template}${K.hero && K.template !== "lf" + K.hero ? `, hero ${K.hero}` : ""}); keep one scaffold per planned scene`);
        return;
      }
      const got = sceneKind(sc);
      const ok = got === ps.kind || (ps.kind === "photo" && got === "fullBleed") || (ps.kind === "fullBleed" && got === "photo");
      if (!ok) P.push(`scaffold ${sc.id}: the scene plan assigns ${ps.kind} to the scene from ${ps.from} (${K.doc || K.template}); you used ${got}. Use the planned layout and fill it with this content`);
    });
    const starts = new Set(plan.map((ps) => ps.from));
    scs.forEach((sc) => !starts.has(sc.from) && P.push(`scaffold ${sc.id} starts at ${sc.from}, which is not a planned scene start (${[...starts].join(", ")}); merge it into the planned scene it falls in`));
  }
  // universal rules (with or without a plan)
  const kinds = scs.map(sceneKind);
  const structural = (k) => k === "chapter" || k === "cold";
  for (let i = 1; i < kinds.length; i++) {
    if (kinds[i] === kinds[i - 1] && !structural(kinds[i]) && (planned || kinds[i] !== "photo")) P.push(`scaffolds ${scs[i - 1].id} and ${scs[i].id} are both ${kinds[i]}: never the same layout twice in a row; change ${scs[i].id} (a different template / hero)`);
  }
  const content = kinds.filter((k) => !structural(k));
  const cap = Math.max(2, Math.ceil(0.4 * content.length));
  const count = {};
  content.forEach((k) => (count[k] = (count[k] || 0) + 1));
  Object.entries(count).forEach(([k, n]) => content.length >= 4 && n > cap && P.push(`${k} is ${n} of the section's ${content.length} scenes (max ${cap}); give some of them another layout`));
  // spacing on the narration clock (~160 wpm)
  const ids = (sb.sentences || []).map((s) => s.id);
  const t0 = {};
  let t = 0;
  (sb.sentences || []).forEach((s) => {
    t0[s.id] = t;
    t += seconds(s);
  });
  let lastMap = null;
  let lastGraphic = 0;
  scs.forEach((sc, i) => {
    const k = kinds[i];
    const at = t0[sc.from] !== undefined ? t0[sc.from] : 0;
    const cat = (KINDS[k] || {}).category || (/Map$/.test(k) ? "map" : "graphic");
    if (cat === "map") {
      if (lastMap !== null && at - lastMap.t < RULES.mapGapS) P.push(`scaffold ${sc.id}: a second map only ${Math.round(at - lastMap.t)} s after ${lastMap.id} (maps >= ${RULES.mapGapS} s apart); use another layout or fold it into that map with a zoomTo event`);
      lastMap = { t: at, id: sc.id };
    }
    if (cat !== "media") {
      if (at - lastGraphic > RULES.graphicHardS) P.push(`scaffold ${sc.id}: ${Math.round(at - lastGraphic)} s without a graphic scene (max ${RULES.graphicHardS} s); make a scene before it a chart / number / map / timeline`);
      lastGraphic = at;
    }
  });
  void ids;
  return P;
}

/**
 * Centre-stage composition (user, 2026-09-26): one centred hero, satellites balanced in the left /
 * right rails, short on-screen text only (the narrator says the sentences), no two-column splits.
 */
function compositionProblems(sb) {
  const P = [];
  const each = (sc, fn) =>
    Object.entries(sc.slots || {}).forEach(([k, v]) => [].concat(v || []).forEach((f, i) => f && typeof f === "object" && fn(f, Array.isArray(v) ? `${sc.id}.${k}[${i}]` : `${sc.id}.${k}`, k)));
  (sb.scaffolds || []).forEach((sc) => {
    const s = sc.slots || {};
    if (sc.template === "lfSplit") P.push(`scaffold ${sc.id}: lfSplit (image in one column, text in the other) is retired; use lfStage: the photo as the centred hero, the figures as left / right satellites, a top-centre title`);
    if (s.stack || s.side) P.push(`scaffold ${sc.id}: "${s.stack ? "stack" : "side"}" is a side column; put those modules in the "left" / "right" rails (0-2 each, balanced)`);
    const L = [].concat(s.left || []).length;
    const Rr = [].concat(s.right || []).length;
    if (L > 2 || Rr > 2) P.push(`scaffold ${sc.id}: at most 2 satellites per rail (left ${L}, right ${Rr})`);
    if (Math.abs(L - Rr) > 1) P.push(`scaffold ${sc.id}: satellites unbalanced (left ${L}, right ${Rr}); the rails may differ by at most 1`);
    if (s.title && s.headline && sc.template === "lfStage") P.push(`scaffold ${sc.id}: use a top-centre "title" OR a lower-third "headline", not both`);
    each(sc, (f, where, key) => {
      const p = f.props || {};
      const type = f.type || (key === "overlays" ? "callout" : key === "headline" || key === "title" || key === "punchline" ? (sc.template === "lfStage" && key === "headline" ? "lowerThird" : sc.template === "lfHeadline" ? "headlineCard" : "lfText") : key === "lowerThird" ? "lowerThird" : key === "card" ? "chapterCard" : key === "number" ? "bigNumber" : "");
      const over = (field, max, what) => words(p[field]) > max && P.push(`${where}: ${what} "${String(p[field]).slice(0, 60)}" is ${words(p[field])} words (max ${max}); the narrator says the sentence, the screen shows a short label`);
      if (type === "lfText") {
        over("title", TEXT.title, "on-screen headline");
        if (p.sub) P.push(`${where}: drop "sub" ("${String(p.sub).slice(0, 50)}..."); body sentences are narrated, not printed`);
      }
      if (type === "bigNumber") over("context", TEXT.context, "bigNumber context");
      if (type === "callout") over("text", TEXT.callout, "callout text");
      if (type === "lowerThird") {
        over("title", TEXT.title, "lower third title");
        over("sub", TEXT.title, "lower third sub");
      }
      if (type === "chapterCard") over("promise", TEXT.promise, "chapter promise");
      if (type === "headlineCard") over("deck", TEXT.deck, "headline deck");
    });
  });
  // transitions: centre push only, not on consecutive cuts
  let last = -9;
  (sb.scaffolds || []).forEach((sc, i) => {
    if (!sc.transition) return;
    if (i - last < 2) P.push(`scaffold ${sc.id}: two centre-push transitions in a row; keep a hard cut between them`);
    last = i;
  });
  return P;
}

function summaryLine(report) {
  if (!report) return "";
  return `Measured on your storyboard (synthetic ~160 wpm timing, ${report.seconds.toFixed(1)} s): ${report.scaffolds} scaffolds, scene life median ${report.lifeMedian.toFixed(1)} s, media visible ${report.mediaSharePct}%, longest media run ${report.maxMediaRun}. Make the smallest change that fixes the problems.`;
}

// ---------------------------------------------------------------------------------------------
// generation

/** live generator: Gemini REST JSON mode, task longform.storyboard (standard tier) */
function liveGenerate(opts = {}) {
  const { loadGeminiRest } = require("./gemini");
  const g = loadGeminiRest({ log: opts.log, maxAttempts: opts.maxAttempts || 3 });
  return (prompt) => g.json(prompt, { task: "longform.storyboard", temperature: 0.6 });
}

/**
 * LF hold filler (the storyboardGen autoFillGaps works on the 9:16 synthetic pace, where these holds
 * do not exist): for every hold longer than maxGap - 0.3 s on the relaxed LF timeline, add one
 * emphasis beat on the word in the middle of the hold, on the best module on screen (text / number /
 * headline first, then a photo highlight box). Returns the number of beats added.
 */
function fillHolds(sb) {
  const PR = PROFILES.LF;
  const tl = syntheticTimeline(sb, PR.syn);
  let spec;
  try {
    spec = compileStoryboard(sb, tl, { mascot: false });
  } catch (_) {
    return 0;
  }
  const t = [];
  spec.scaffolds.forEach((s) => {
    t.push(s.t0);
    s.modules.forEach((m) => m.at && t.push(s.t0 + m.at));
  });
  spec.events.forEach((e) => t.push(e.t));
  const pts = [0, ...[...new Set(t.map((x) => Math.round(x * 100) / 100))].sort((a, b) => a - b), tl.totalSeconds];
  const PREF = ["lfText", "bigNumber", "headlineCard", "barChart", "lineChart", "compareCols", "photo"];
  const norm = (x) => String(x).toLowerCase().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
  let added = 0;
  sb.events = sb.events || [];
  for (let i = 1; i < pts.length; i++) {
    if (pts[i] - pts[i - 1] <= PR.maxGap - 0.3) continue;
    const mid = (pts[i] + pts[i - 1]) / 2;
    const w = tl.words.reduce((b, x) => (Math.abs(x.start - mid) < Math.abs(b.start - mid) ? x : b), tl.words[0]);
    const sc = spec.scaffolds.find((s) => w.start >= s.t0 && w.start < s.t1);
    if (!sc) continue;
    // a marker highlight on text needs a phrase to sweep (props.highlight); skip text without one
    const vis = sc.modules.filter((m) => sc.t0 + (m.at || 0) <= w.start && !LF_CHROME.has(m.type) && !((m.type === "lfText" || m.type === "headlineCard") && !(m.props || {}).highlight));
    const mod = PREF.map((ty) => vis.find((m) => m.type === ty)).find(Boolean);
    if (!mod) continue;
    const toks = sb.sentences.find((s) => s.id === w.sentenceId).text.split(/\s+/).filter(Boolean);
    const occurrence = toks.slice(0, w.wi + 1).filter((x) => norm(x) === norm(toks[w.wi])).length;
    const ev = { sentence: w.sentenceId, anchor: { text: toks[w.wi], occurrence }, op: "highlight", target: mod.id };
    if (mod.type === "photo") ev.value = { box: [24, 26, 52, 48] };
    else ev.value = { hold: 0.6 };
    sb.events.push(ev);
    added++;
  }
  return added;
}

const isHoldProblem = (p) => /^a hold (of|without)|^no visual change for/.test(p);

function isFatal(err) {
  return !!(err && (err.fatal && /\b(401|402|403)\b/.test(err.message) || FATAL.test(String(err.message || err))));
}

/**
 * @param {{section, meta, dossier, outline, topic}} ctx
 * @param {{generate?: (prompt)=>Promise<object>, maxAttempts?: number, log?: Function, layoutAudit?: boolean, extraProblems?: string[], previous?: object}} opts
 * @returns {Promise<{storyboard, attempts: {problems: string[]}[]}>}
 */
async function generateChapterStoryboard(ctx, opts = {}) {
  const generate = opts.generate || liveGenerate({ log: opts.log });
  const log = opts.log || (() => {});
  const max = opts.maxAttempts || 5;
  const attempts = [];
  let raw = opts.previous || null;
  let problems = opts.extraProblems || [];
  let report = null;
  let sb = null;
  for (let i = 0; i < max; i++) {
    const prompt = raw ? buildRepairPromptLF(ctx, raw, problems, summaryLine(report)) : buildPromptLF(ctx);
    log(`[${ctx.section.id}] storyboard attempt ${i + 1}/${max}${raw ? ` (repairing ${problems.length} problem(s))` : ""}`);
    try {
      raw = await generate(prompt, { section: ctx.section.id, attempt: i + 1 });
    } catch (err) {
      problems = [`model call failed: ${err.message}`];
      attempts.push({ problems });
      if (isFatal(err)) {
        const fatal = new Error(`model unavailable (not retried): ${err.message}`);
        fatal.fatal = true;
        fatal.attempts = attempts;
        throw fatal;
      }
      continue;
    }
    sb = assemble(raw, ctx);
    const fixed = fixSeriesNotes(sb);
    if (fixed) log(`[${ctx.section.id}] rewrote ${fixed} data-series note(s) to quote their point`);
    let v = await validateChapter(sb, ctx, { log, layoutAudit: opts.layoutAudit });
    // long holds are the one near-miss the model oscillates on (fixing a hold, it restructures and
    // breaks the mix): fill them deterministically before spending another model call
    if (v.problems.some(isHoldProblem)) {
      const n = fillHolds(sb);
      if (n) {
        log(`[${ctx.section.id}] filled ${n} long hold(s) with emphasis beats`);
        v = await validateChapter(sb, ctx, { log, layoutAudit: opts.layoutAudit });
      }
    }
    problems = v.problems;
    report = v.report;
    attempts.push({ problems, report });
    problems.forEach((p) => log(`  - ${p}`));
    if (!problems.length) return finish(sb, ctx, attempts);
  }
  const err = new Error(`[${ctx.section.id}] storyboard still invalid after ${max} attempts: ${problems.join(" | ")}`);
  err.attempts = attempts;
  err.last = sb;
  throw err;
}

function finish(sb, ctx, attempts) {
  sb.lfMeta = { hash: sectionHash(ctx.section, ctx.meta, planKey(ctx.plan)), plan: planKey(ctx.plan) || undefined, promptVersion: PROMPT_VERSION, attempts: attempts.length, report: attempts[attempts.length - 1].report };
  return { storyboard: sb, attempts };
}

// ---------------------------------------------------------------------------------------------
// cross-chapter media merge

const key = (it) => [it.kind, it.entity || "", it.intent].map((x) => String(x).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()).join("|");
const SIZE_RANK = { full: 3, card: 2, portrait: 1, logo: 1, map: 1 };

/** rewrite props.slot values in place */
function renameSlots(sb, map) {
  const walk = (v) => {
    if (Array.isArray(v)) return v.forEach(walk);
    if (!v || typeof v !== "object") return;
    if (typeof v.slot === "string" && map[v.slot]) v.slot = map[v.slot];
    Object.values(v).forEach(walk);
  };
  walk(sb.scaffolds);
  (sb.mediaIntents || []).forEach((it) => map[it.slot] && (it.slot = map[it.slot]));
}

/**
 * One media request for the whole video: identical intents across chapters share a slot; a slot
 * name reused for a DIFFERENT picture is renamed "<section>-<slot>". Mutates the storyboards.
 * @param {{id: string, sb: object}[]} chapters (in video order)
 * @returns {{intents: object[], renames: {[section]: {[old]: string}}}}
 */
function mergeIntents(chapters) {
  const byKey = new Map();
  const bySlot = new Map();
  const intents = [];
  const renames = {};
  for (const { id, sb } of chapters) {
    const map = {};
    for (const it of sb.mediaIntents || []) {
      const k = key(it);
      if (byKey.has(k)) {
        const prev = byKey.get(k);
        if ((SIZE_RANK[it.size] || 0) > (SIZE_RANK[prev.size] || 0)) prev.size = it.size;
        if (prev.slot !== it.slot) map[it.slot] = prev.slot;
        continue;
      }
      let slot = it.slot;
      if (bySlot.has(slot)) {
        slot = `${id}-${it.slot}`;
        map[it.slot] = slot;
      }
      const merged = { ...it, slot };
      byKey.set(k, merged);
      bySlot.set(slot, merged);
      intents.push(merged);
    }
    if (Object.keys(map).length) {
      renameSlots(sb, map);
      renames[id] = map;
    }
    // drop duplicates created by the rename (two local slots that mapped onto one global slot)
    const seen = new Set();
    sb.mediaIntents = (sb.mediaIntents || []).filter((it) => (seen.has(it.slot) ? false : seen.add(it.slot)));
  }
  return { intents, renames };
}

// ---------------------------------------------------------------------------------------------
// media gate (plan §3): between media and render, a scene whose slot has no usable media is
// rewritten graphics-only. ONLY the scaffolds that reference the slot change; the rest stays.

/** a manifest entry the renderer cannot draw as designed media (a name card counts as designed) */
function unusableEntry(e) {
  return !e || e.status === "fallback" || (!e.file && e.status !== "namecard");
}

function slotsIn(v, out = new Set()) {
  if (Array.isArray(v)) v.forEach((x) => slotsIn(x, out));
  else if (v && typeof v === "object") {
    if (typeof v.slot === "string") out.add(v.slot);
    Object.values(v).forEach((x) => slotsIn(x, out));
  }
  return out;
}

/** scaffold id -> the sentence ids it spans (from its "from" up to the next scaffold's) */
function scaffoldSentences(sb) {
  const ids = (sb.sentences || []).map((s) => s.id);
  const starts = (sb.scaffolds || []).map((sc) => Math.max(0, ids.indexOf(sc.from)));
  const out = {};
  (sb.scaffolds || []).forEach((sc, i) => {
    const end = i + 1 < starts.length ? starts[i + 1] : ids.length;
    out[sc.id] = ids.slice(starts[i], Math.max(starts[i] + 1, end));
  });
  return out;
}

function pruneIntents(sb) {
  const used = referencedSlots(sb);
  sb.mediaIntents = (sb.mediaIntents || []).filter((it) => it && used.has(it.slot));
  return sb;
}

function buildSceneRewritePrompt(ctx, sb, ids, sentences, slots) {
  return `${buildPromptLF(ctx)}

CURRENT STORYBOARD FOR THIS SECTION (it passed validation; keep it):
${JSON.stringify({ scaffolds: sb.scaffolds, events: sb.events, media: sb.mediaIntents })}

MEDIA GATE: there is no usable picture for media slot(s) ${slots.join(", ")}. Rewrite ONLY scaffold(s) ${ids.join(", ")} as GRAPHIC-ONLY scenes: no props.slot anywhere in them and no photo / photoGrid / portraitCard / mapCard modules. Use lfText, bigNumber, callout, lowerThird, charts, eraTimeline, compareCols without photos, headlineCard without photo, countryMap / worldMap. Keep each rewritten scaffold's "id" and "from". Every other scaffold stays exactly as it is.
Return ONLY {"scaffolds": [<the ${ids.length} rewritten scaffold(s)>], "events": [<ALL events on sentences ${sentences.join(", ")}; they replace the old events on those sentences>]}.`;
}

function applySceneRewrite(sb, raw, ids, sentences) {
  const out = JSON.parse(JSON.stringify(sb));
  const repl = new Map(((raw && raw.scaffolds) || []).filter((s) => s && ids.includes(s.id)).map((s) => [s.id, s]));
  const missing = ids.filter((id) => !repl.has(id));
  if (missing.length) throw new Error(`rewrite did not return scaffold(s) ${missing.join(", ")}`);
  out.scaffolds = out.scaffolds.map((s) => (repl.has(s.id) ? { ...repl.get(s.id), id: s.id, from: s.from } : s));
  const set = new Set(sentences);
  out.events = (out.events || []).filter((e) => !set.has(e.sentence)).concat(((raw && raw.events) || []).filter((e) => e && set.has(e.sentence)));
  return pruneIntents(out);
}

/**
 * Deterministic graphics-only variant (no model): a media fill on a bad slot becomes an lfText plate
 * (eyebrow = its tag, title = the subject), grid items on a bad slot are dropped, and picture ops
 * aimed at a replaced module go.
 */
function deterministicGraphicsOnly(sb, ids, badSlots) {
  const out = JSON.parse(JSON.stringify(sb));
  const bad = new Set(badSlots);
  const intentOf = (slot) => (out.mediaIntents || []).find((it) => it && it.slot === slot) || {};
  const replaced = new Set();
  const fix = (v) => {
    if (Array.isArray(v)) {
      for (let i = v.length - 1; i >= 0; i--) {
        const x = v[i];
        // a grid item / timeline thumbnail on a bad slot: drop it
        if (x && typeof x === "object" && typeof x.slot === "string" && bad.has(x.slot) && !x.props) v.splice(i, 1);
        else fix(x);
      }
      return;
    }
    if (!v || typeof v !== "object") return;
    const p = v.props;
    if (p && typeof p === "object" && typeof p.slot === "string" && bad.has(p.slot)) {
      const it = intentOf(p.slot);
      const title = String(p.fallbackLabel || it.entity || p.tag || p.name || it.intent || "").slice(0, 60);
      v.type = "lfText";
      v.props = { eyebrow: p.tag && p.tag !== title ? String(p.tag).slice(0, 40) : it.era ? String(it.era) : "", title, plate: true };
      if (v.id) replaced.add(v.id);
      return;
    }
    Object.values(v).forEach(fix);
  };
  out.scaffolds.forEach((sc) => ids.includes(sc.id) && fix(sc.slots));
  const keep = new Set(["reveal", "remove", "text", "tone", "dim", "undim"]);
  out.events = (out.events || []).filter((e) => !replaced.has(String(e.target || "").split(".")[0]) || keep.has(e.op));
  return pruneIntents(out);
}

/** live rewrite call on the cheap tier (task longform.sceneRewrite) */
function liveSceneGenerate(opts = {}) {
  const { loadGeminiRest } = require("./gemini");
  const g = loadGeminiRest({ log: opts.log, maxAttempts: opts.maxAttempts || 2 });
  return (prompt) => g.json(prompt, { task: "longform.sceneRewrite", temperature: 0.4 });
}

/**
 * Rewrite the scaffolds that reference `badSlots` graphics-only; re-validated with validateChapter.
 * Model first (<= 2 tries, cheap tier), deterministic variant second.
 * @returns {Promise<{storyboard, scaffolds: string[], how: "model"|"rules"}>}
 */
async function rewriteScenesGraphicsOnly(sb, badSlots, ctx, opts = {}) {
  const log = opts.log || (() => {});
  const bad = new Set(badSlots);
  const ids = (sb.scaffolds || []).filter((sc) => [...slotsIn(sc.slots)].some((s) => bad.has(s))).map((sc) => sc.id);
  if (!ids.length) return { storyboard: sb, scaffolds: [], how: "none" };
  const spans = scaffoldSentences(sb);
  const sentences = [...new Set(ids.flatMap((id) => spans[id] || []))];
  const tried = [];
  const check = async (cand) => {
    let v = await validateChapter(cand, ctx, { log, layoutAudit: opts.layoutAudit });
    if (v.problems.some(isHoldProblem) && fillHolds(cand)) v = await validateChapter(cand, ctx, { log, layoutAudit: opts.layoutAudit });
    return v;
  };
  const done = (cand, how) => {
    cand.lfMeta = { ...(sb.lfMeta || {}), mediaGate: { slots: [...bad], scaffolds: ids, how } };
    return { storyboard: cand, scaffolds: ids, how };
  };
  if (opts.generate) {
    let problems = [];
    for (let attempt = 1; attempt <= 2; attempt++) {
      let prompt = buildSceneRewritePrompt(ctx, sb, ids, sentences, [...bad]);
      if (problems.length) prompt += `\n\nYOUR PREVIOUS REWRITE FAILED VALIDATION:\n${problems.map((p) => "- " + p).join("\n")}\nFix exactly these.`;
      try {
        const raw = await opts.generate(prompt, { section: ctx.section.id, attempt, kind: "sceneRewrite" });
        const cand = applySceneRewrite(sb, raw, ids, sentences);
        const left = [...slotsIn(cand.scaffolds.filter((s) => ids.includes(s.id)).map((s) => s.slots))].filter((s) => bad.has(s));
        const v = left.length ? { problems: [`rewritten scaffolds still use slot(s) ${left.join(", ")}`] } : await check(cand);
        if (!v.problems.length) return done(cand, "model");
        problems = v.problems;
      } catch (err) {
        if (isFatal(err)) throw err;
        problems = [`rewrite failed: ${err.message}`];
      }
      tried.push(...problems.map((p) => `model ${attempt}: ${p}`));
      log(`[${ctx.section.id}] media gate rewrite ${attempt}/2: ${problems.slice(0, 3).join(" | ")}`);
    }
  }
  const cand = deterministicGraphicsOnly(sb, ids, [...bad]);
  const v = await check(cand);
  if (!v.problems.length) return done(cand, "rules");
  tried.push(...v.problems.map((p) => `rules: ${p}`));
  const err = new Error(`[${ctx.section.id}] media gate: scaffold(s) ${ids.join(", ")} could not be rewritten graphics-only: ${tried.slice(0, 6).join(" | ")}`);
  err.problems = tried;
  throw err;
}

/**
 * The media gate over every rendered section. `manifest` uses the merged (renamed) slot names, so the
 * merge is replayed on copies to map them back to each storyboard's own names. Mutates `storyboards`.
 * @returns {Promise<{changed: {id, slots, scaffolds, how}[], failed: {id, slots, error}[]}>}
 */
async function mediaGate({ sections, storyboards, manifest, ctxFor, generate = null, log = () => {}, layoutAudit, onChange }) {
  const slots = (manifest && (manifest.slots || manifest)) || {};
  const chapters = sections.map((id) => ({ id, sb: JSON.parse(JSON.stringify(storyboards[id])) }));
  const { renames } = mergeIntents(chapters);
  const changed = [];
  const failed = [];
  for (const { id, sb } of chapters) {
    const bad = [...referencedSlots(sb)].filter((s) => unusableEntry(slots[s]));
    if (!bad.length) continue;
    const own = referencedSlots(storyboards[id]);
    const back = (s) => {
      const olds = Object.entries(renames[id] || {}).filter(([, n]) => n === s).map(([o]) => o);
      return olds.find((o) => own.has(o)) || s;
    };
    const local = [...new Set(bad.map(back))];
    log(`media gate ${id}: no usable media for ${local.join(", ")}; rewriting those scenes graphics-only`);
    try {
      const r = await rewriteScenesGraphicsOnly(storyboards[id], local, ctxFor(id), { generate, log, layoutAudit });
      storyboards[id] = r.storyboard;
      if (onChange) onChange(id, r.storyboard);
      changed.push({ id, slots: local, scaffolds: r.scaffolds, how: r.how });
      log(`media gate ${id}: rewrote ${r.scaffolds.join(", ")} (${r.how})`);
    } catch (err) {
      if (err.fatal || isFatal(err)) throw err;
      failed.push({ id, slots: local, error: err.message });
      log(`media gate ${id}: ${err.message}`);
    }
  }
  return { changed, failed };
}

module.exports = { seriesConsistencyProblems,
  varietyProblems,
  sceneKind,
  planKey,
  staticPromptLF,
  mediaGate,
  rewriteScenesGraphicsOnly,
  deterministicGraphicsOnly,
  applySceneRewrite,
  scaffoldSentences,
  unusableEntry,
  liveSceneGenerate,
  compositionProblems,
  FRAME,
  MIX,
  PROMPT_VERSION,
  chapterMeta,
  sectionHash,
  buildPromptLF,
  buildRepairPromptLF,
  lfCatalogText,
  assemble,
  validateChapter,
  mixReport,
  syntheticManifest,
  allowedNumbers,
  screenNumbers,
  numberOk,
  generateChapterStoryboard,
  liveGenerate,
  isFatal,
  mergeIntents,
  referencedSlots,
  fillHolds,
  zoomLabelProblems,
  mapProblems,
  seriesNoteProblems,
  fixSeriesNotes,
  referencedSeries,
  dataSeriesLines,
};
