"use strict";

/**
 * Gemini -> carousel.v3 (same card catalog, styles and validation discipline as the v3 videos).
 * Validation = schema + card catalog + the real compiler (overflow) + the real renderer (layout
 * audit: overlap, text off-card/clipped, build errors). Failures go back to the model (max 4).
 */

const { MODULES, TONES, ICONS, knownOps } = require("../video/v3/catalog");
const { chooseProfile, loadGemini, catalogText } = require("../video/v3/storyboardGen");
const { compileCarousel } = require("./compileCarousel");
const { renderCarousel } = require("./renderCarousel");

const CARD_TYPES = ["panel", "table", "nodes", "kpis", "code", "compare", "bars", "steps", "chips", "stat", "chart", "timeline", "layers", "tree", "note", "banner", "stamp", "letters", "slot"];
const SLIDES = [5, 8];

const HEIGHTS = "CARD HEIGHTS (px, slide content band is ~800 px under a title, ~560 px on a hero slide): panel = 74 + 58 x rows; table = 46 + 60 x rows; kpis = 124 (150 with a bar); code = 70 + 42 x lines; compare = 78 + 50 x rows; bars = 64 x items - 10; steps 84; note 80; stat 110; banner 117; chart 280; stamp 150; timeline 100 (150 with captions); layers = 84 x layers - 12; letters 260; nodes / chips / tree = their h (defaults 420 / 186 / 380); cards are separated by 19 px.";

const GRAMMAR = {
  DH: "Dark dashboard style: near-black, HUD-like chrome, colour = state (green ok, red failure, blue primary, amber warning, purple the actor). Mechanism slides use nodes (3-4 nodes on one row or an L), panels with status rows, kpis with real numbers.",
  LC: "Light editorial style: warm paper, ivory window cards. Step-by-step building; each slide adds one idea; nodes are window cards (x 0.2-0.8, max 3 per row); tables and code for concrete formats. No strike-through.",
  BP: "Light blueprint style: cool grey line-grid plate, white cards with soft shadows; purple = an added component / the fix, blue = numbers, red = the problem. System-design stories: one architecture growing slide by slide (nodes diagrams with 3-5 components per slide), panels with request / job rows, kpis with real numbers, compare for trade-offs.",
  BR: "Light brutalist style: warm grey dotted plate, square window cards with black title bars and hard offset shadows; magenta = the decider / the product, blue = the generator / LLM, red = cost. Product and AI explainers: concrete forms, choices and answers (panels with status rows, tables, compare, code); one idea per slide.",
  DC: "Dark chaptered documentary style: serif display titles, a framed stage, mostly monochrome with ONE accent per slide (teal = the platform, amber = attention, pink = failure). Hero slides for the named concepts and big numbers.",
};

function buildPrompt(topic, profile, handle) {
  return `You write Instagram carousels (1080x1350 slides) that explain ONE tech topic, in a precise house style built from the same animated cards as our explainer videos. Output ONLY a JSON object of shape carousel.v3.

TOPIC: ${topic}
STYLE (profile "${profile}"): ${GRAMMAR[profile]}

SHAPE
{ "version": "carousel.v3", "profile": "${profile}", "topic": "...", "kicker": "<mono caps breadcrumb, <= 30 chars, e.g. API / RATE LIMITING>",
  "slides": [
    { "id": "cover", "kind": "cover", "eyebrow": "<caps, <= 26 chars>", "title": "<the hook, 3-7 words, <= 42 chars>", "subtitle": "<one sentence, <= 90 chars>", "visual": <ONE card> },
    { "id": "...", "kind": "body", "eyebrow": "<caps section label, <= 26 chars>", "tone": "blue|green|red|amber|purple", "title": "<the point, <= 44 chars>", "subtitle"?: "<<= 90 chars>", "modules": [<1-3 cards>], "ops"?: [ {"op", "target": "<card id or card.sub>", "value"} ] },
    { "id": "...", "kind": "hero", "eyebrow": "...", "title": "<<= 44 chars>", "hero": {"text": "<a big number or 1-2 words, <= 8 chars>", "kicker": "<caps, <= 34 chars>", "tone": "green|blue|red|amber"}, "modules": [<exactly 1 card, <= 300 px>] }
  ] }

RULES
- ${SLIDES[0]}-${SLIDES[1]} slides: first is "cover"; then 3-6 "body" / "hero" slides that teach the topic in order (problem -> mechanism -> numbers -> trade-off / takeaway). Do NOT add a follow / CTA slide (it is appended automatically).
- Every slide shows real, specific content: real numbers, real field names, real commands. No placeholders.
- Cards come ONLY from the catalog below, with the listed props; give every card an "id". The cards show their FINAL state, so write props as the end state (nodes lit, rows filled, statuses set). Use "ops" only for strike-through / highlight moments (e.g. {"op": "rowStrike", "target": "limits", "value": {"row": 2}}).
- Each body slide must be visually full: its cards add up to at least 420 px (see heights) and at most ~780 px.
- Card text is short: panel row text <= 34 chars, values <= 14 chars, node labels <= 14 chars, node subs <= 14 chars, table cells <= 16 chars, steps items <= 12 chars, code lines <= 44 chars.
- Tones: ${TONES.join(", ")}. Icons: ${ICONS.join(", ")}.
- Handle "${handle}" is added by the layout; do not put it in content.

${HEIGHTS}

CARD CATALOG
${catalogText()}

Return only the JSON.`;
}

// models often write card props flat ({type, rows}) instead of {type, props: {rows}}
function normalize(cb) {
  (cb && cb.slides || []).forEach((s) => {
    const fix = (c) => {
      if (!c || typeof c !== "object") return c;
      if (!c.type) c.type = c.card || c.module || c.cardType || c.kind; // key aliases seen from the model
      ["card", "module", "cardType", "kind"].forEach((k) => delete c[k]);
      if (!c.props) {
        const { id, type, h, ...rest } = c;
        return { id, type, h, props: rest };
      }
      return c;
    };
    if (s.visual) s.visual = fix(s.visual);
    if (Array.isArray(s.modules)) s.modules = s.modules.map(fix);
  });
  return cb;
}

function validate(cb, profile) {
  const P = [];
  if (!cb || !Array.isArray(cb.slides)) return ["missing slides[]"];
  const slides = cb.slides.filter((s) => s.kind !== "end");
  if (slides.length < SLIDES[0] || slides.length > SLIDES[1]) P.push(`${slides.length} slides; need ${SLIDES[0]}-${SLIDES[1]}`);
  if (!slides[0] || slides[0].kind !== "cover") P.push('the first slide must be kind "cover"');
  const ids = new Set();
  slides.forEach((s, i) => {
    const tag = `slide ${i + 1} (${s.id || s.kind})`;
    if (!["cover", "body", "hero"].includes(s.kind)) P.push(`${tag}: kind must be cover, body or hero`);
    if (ids.has(s.id)) P.push(`${tag}: duplicate slide id`);
    ids.add(s.id);
    if (!s.title) P.push(`${tag}: needs a title`);
    if (String(s.title || "").length > 48) P.push(`${tag}: title is ${String(s.title).length} chars (max 44)`);
    if (String(s.subtitle || "").length > 110) P.push(`${tag}: subtitle too long (max 90 chars)`);
    const cards = s.kind === "cover" ? (s.visual ? [s.visual] : []) : s.modules || [];
    if (s.kind === "cover" && !s.visual) P.push(`${tag}: the cover needs one "visual" card`);
    if (s.kind === "body" && (cards.length < 1 || cards.length > 3)) P.push(`${tag}: body slides need 1-3 cards`);
    if (s.kind === "hero" && (!s.hero || !s.hero.text)) P.push(`${tag}: hero slides need hero.text`);
    if (s.kind === "hero" && cards.length !== 1) P.push(`${tag}: hero slides need exactly 1 card under the number`);
    const cardIds = new Set();
    cards.forEach((c) => {
      if (!CARD_TYPES.includes(c.type)) P.push(`${tag}: unknown card type "${c.type}" (use: ${CARD_TYPES.join(", ")})`);
      if (c.id) cardIds.add(c.id);
    });
    if (s.kind === "body") {
      const h = cards.reduce((a, c) => a + (require("../video/v3/templates-generic").preferred(c, 960) || 0), 0) + Math.max(0, cards.length - 1) * 19;
      if (h < 380) P.push(`${tag}: only ${h} px of cards; the slide reads empty -- add a card or rows (>= 420 px)`);
    }
    (s.ops || []).forEach((o, k) => {
      const mod = String(o.target || "").split(".")[0];
      const card = cards.find((c) => c.id === mod);
      if (!card) return P.push(`${tag}: ops[${k}] targets "${o.target}", not a card on this slide`);
      if (!knownOps(card.type)[o.op]) P.push(`${tag}: ops[${k}] "${o.op}" is not an op of ${card.type}`);
      if (profile === "LC" && /strike/i.test(o.op)) P.push(`${tag}: no strike-through in the light style`);
    });
  });
  if (P.length) return P;
  try {
    compileCarousel({ ...cb, profile });
  } catch (err) {
    P.push(err.message);
  }
  return P;
}

async function generateCarousel(topic, { profile = "auto", handle = "", log = () => {}, maxAttempts = 4, generate } = {}) {
  generate = generate || loadGemini();
  const prof = profile === "auto" ? await chooseProfile(topic, generate) : profile;
  log(`carousel style: ${prof}`);
  let raw = null;
  let problems = [];
  for (let i = 0; i < maxAttempts; i++) {
    const prompt = raw
      ? `${buildPrompt(topic, prof, handle)}\n\nYOUR PREVIOUS OUTPUT:\n${JSON.stringify(raw)}\n\nIT FAILED VALIDATION:\n${problems.map((p) => "- " + p).join("\n")}\n\nReturn the corrected full carousel.v3 JSON. Keep what was valid; fix exactly these problems.`
      : buildPrompt(topic, prof, handle);
    log(`carousel attempt ${i + 1}/${maxAttempts}${raw ? ` (repairing ${problems.length})` : ""}`);
    try {
      raw = await generate(prompt);
    } catch (err) {
      if (/\b(401|402|403)\b|credits are depleted|API key not valid|PERMISSION_DENIED/i.test(err.message)) throw new Error(`model unavailable: ${err.message}`);
      problems = [`model call failed: ${err.message}`];
      continue;
    }
    normalize(raw);
    raw.profile = prof;
    raw.version = "carousel.v3";
    raw.handle = handle;
    problems = validate(raw, prof);
    if (!problems.length) {
      // the real renderer: layout audit on every slide (no screenshots yet)
      const r = await renderCarousel(compileCarousel(raw), require("os").tmpdir(), { shots: false });
      problems = r.problems.map((p) => "layout " + p);
    }
    problems.forEach((p) => log(`  - ${p}`));
    if (!problems.length) return { carousel: raw, attempts: i + 1 };
  }
  const err = new Error(`carousel still invalid after ${maxAttempts} attempts: ${problems.join(" | ")}`);
  err.last = raw;
  throw err;
}

module.exports = { generateCarousel, validate, buildPrompt, normalize, CARD_TYPES };
