"use strict";

/**
 * Machine-readable catalog of the DH stage modules: what each card is for, its props, and the
 * ops (with value fields) that words can trigger. Drives both the LLM prompt and validation, so
 * the generator can only ask for things the renderer implements.
 */

const TONES = ["blue", "green", "red", "amber", "purple", "cyan", "orange", "pink", "white", "grey"];
const ICONS = ["server", "database", "app-window", "laptop", "smartphone", "router", "cloud", "lock", "shield", "key", "file", "folder", "git-branch", "terminal", "users", "user", "rows-3", "database-zap", "globe", "cpu", "triangle-alert", "circle-check", "x", "clock", "zap", "package", "network", "monitor", "upload", "download"];

// generic ops every module/entity accepts (lib/stage/core.js GENERIC)
const GENERIC_OPS = {
  reveal: "entity fades in with a 4.5 px rise (hidden until then)",
  remove: "entity disappears in 1 frame",
  text: "{text} one-frame text swap on a text entity",
  tone: "{tone} one-frame recolour on a text entity that supports data-tone",
  retype: "{text} backspace 1 char/frame then type 2 chars/frame (HUD version, IDs)",
  count: "{to, from?, dur?} numeric count on a text entity",
  dim: "{level?} dim entity to ~45%", undim: "restore dim",
  strike: "{tone?} 167 ms strike line across the entity",
  slam: "entity lands at 1.15x -> 1.0 in 100 ms",
  highlight: "{hold?} blue outline ring on the entity", unhighlight: "remove ring",
  flash: "3-frame alarm flash (env cards)",
};

const MODULES = {
  label: { use: "section label, caps, centred (templates add it from slots.label)", props: "{text, tone?}", ops: {} },
  micro: { use: "tracked caps eyebrow/kicker line", props: "{text, align?: left|center|right, tone?: amber, size?: xl}", ops: {} },
  headline: { use: "1-2 line huge caps headline (hook, climax, summary)", props: "{lines: [string | {text, tone}], size?: 107, pitch?: 123}", ops: {} },
  hero: { use: "hero number/word slam, right-aligned (a spoken number or key word)", props: "{text, tone?, size?: 118-150}", ops: {} },
  pill: { use: "small floating annotation pill", props: "{text, tone?, dot?}", ops: {} },
  banner: { use: "alert / rule card 117 px: eyebrow + big title + sub", props: "{eyebrow?, title, sub?, tone?: red|purple|amber, mono?}", ops: {} },
  stat: { use: "single metric box: eyebrow + value + sub", props: "{eyebrow, value, sub?, mono?}", ops: {} },
  panel: {
    use: "titled panel with rows (lists, logs, requests, items, steps as rows)",
    props: "{title, icon?, iconTone?, tone? (tints whole panel), meta?, rows: [{text, mono?, icon?, iconTone?, sub?, value? | status?, tone?, hidden?}] (<=6)}",
    ops: { rowIn: "{row} row appears (use with hidden:true rows, one per spoken item)", rowTone: "{row, tone} row tint", rowStrike: "{row, tone?} strike + dim", rowText: "{row, text}", rowStatus: "{row, status, tone?}", panelTone: "{tone}" },
    entities: "row<N>, row<N>.text, row<N>.value, row<N>.status, title, meta",
  },
  table: {
    use: "data table (<=6 rows) with a caps header",
    props: "{columns: [{label, num?, w?}], rows: [[cell,...]], hiddenRows?: [1-based]}",
    ops: { rowIn: "{row}", rowTone: "{row, tone}", cell: "{row, col, text, hl?}", rowStrike: "{row, tone?}" },
    entities: "row<N>, r<N>c<M>",
  },
  nodes: {
    use: "diagram of 2-6 nodes (icon tiles) joined by connectors; packets travel along edges",
    props: "{nodes: [{id, icon, label, sub?, x: 0-1, y: 0-1, tone?, lit? (default true), hidden?}], edges: [{from, to, label?, style?: solid|dashed, shape?: curve|elbow|straight, drawn? (default true), tone?}]} (node centres at least 0.25 apart; keep x in 0.14-0.86, y in 0.12-0.82)",
    ops: { light: "{node, tone?} node goes dim -> lit (use lit:false nodes)", nodeIn: "{node} node appears (hidden:true nodes)", draw: "{from, to, dur?} connector draws on (drawn:false edges)", packet: "{from, to, tone?, icon?, loops?, speed?, lightTarget?} packet travels the edge", edgeTone: "{from, to, tone}" },
    entities: "<nodeId>, <from>-><to>",
  },
  kpis: {
    use: "2-3 metric tiles side by side (numbers that count up/down)",
    props: "{items: [{eyebrow, value, sub?, tone?, bar? (0-100), countFrom?}]} (value like '240 ms', '1,240 req/s', '18%')",
    ops: { count: "{item, to?, from?, dur?}", tone: "{item, tone}", fill: "{item, to} bar fill (needs bar)" },
    entities: "k<N>, k<N>.value",
  },
  code: {
    use: "terminal / code window; lines type on their words",
    props: "{name?, eyebrow?, prompt?: '$', lines: [{text, tone?, comment?, hidden?}] (<=6, <=38 chars each)}",
    ops: { type: "{line, text?, cps?} line types out", lineIn: "{line}", lineHl: "{line}", lineTone: "{line, tone}" },
    entities: "l<N>",
  },
  compare: {
    use: "two columns: before/after, bad/good, A vs B",
    props: "{left: {title, tone, rows: [string] (<=4)}, right: {title, tone, rows: [string]}, hidden?: true}",
    ops: { rowIn: "{side: left|right, row}", rowStrike: "{side, row, tone?}", pick: "{side} dims the other side" },
    entities: "left, right, left.row<N>, right.row<N>",
  },
  bars: {
    use: "2-4 labelled horizontal bars (shares, loads, before/after)",
    props: "{items: [{label, value: 0-100, display?, tone?}], filled?: false (start empty, fill on words)}",
    ops: { fill: "{item?, to?, display?} (no item = all)", tone: "{item, tone}" },
    entities: "b<N>",
  },
  steps: {
    use: "3-4 step tabs; one active at a time (processes, phases)",
    props: "{items: [string] (<=4, <=12 chars), active?, tone?}",
    ops: { activate: "{step}" },
    entities: "s<N>",
  },
  chips: {
    use: "grid of small cells (files, shards, requests, servers) that fill/recolour",
    props: "{cols, rows, labels?: [string], tone?, filled?: count}",
    ops: { fill: "{from?, to?, tone?, stagger?}", cellTone: "{cell, tone}" },
    entities: "c<N>",
  },
  stamp: { use: "verdict stamp slammed over the scene (REJECTED, NOT THIS, SAFE)", props: "{text, tone?: red|green|amber}", ops: {} },
  timeline: {
    use: "horizontal timeline with 3-6 ticks; progress runs to a tick",
    props: "{ticks: [{label (e.g. '2019' or 'T+5m'), caption?}], progress?: tick reached at start}",
    ops: { advance: "{to: tick index}" },
    entities: "t<N>, t<N>.caption",
  },
  layers: {
    use: "vertical stack of 3-5 layers/tiers (OSI, app stack, cache levels) that drop in",
    props: "{layers: [{title, desc?, tone?, hidden?}]} top to bottom",
    ops: { dropIn: "{layer}", layerTone: "{layer, tone}" },
    entities: "l<N>",
  },
  tree: {
    use: "one root fanning out to 2-4 children (fan-out, sharding, replicas, a directory)",
    props: "{root: {title, sub?, tone?}, leaves: [{title, sub?, tone?, hidden?}], drawn?: false}",
    ops: { branch: "{leaf?} draw one branch (or all, 100 ms apart) and reveal its child" },
    entities: "root, leaf<N>",
  },
  note: { use: "one-line takeaway strip with a check / cross / bang mark", props: "{text (<=34 chars), tone: green|red|amber, mark?}", ops: {} },
  letters: { use: "acronym tiles: one big letter per tile + its word, lit on the word", props: "{letters: [{letter, word}] (3-4), tone?}", ops: { light: "{i}" }, entities: "t<N>" },
  slot: { use: "dashed placeholder that fills with the answer on a word", props: "{label?, fill: {text, tone}}", ops: { fill: "" } },
  chart: {
    use: "line chart with a flat line then a surge after an event marker",
    props: "{title, maxLabel?, ticks?: [3 labels], to, base, max?, eventAt?: 0-1}",
    ops: { surge: "{dur?}" },
  },
  browser: { use: "browser window with a product grid that can fail to an error page", props: "{url, errorCode?, errorMsg?, cols?, rows?}", ops: { fail: "" }, entities: "tile<N>, grid, error" },
  console: { use: "test console window with checklist rows", props: "{url, chip?, rows: [{path, status?, state?}]}", ops: { check: "{row, state?: pass|fail, status?}" } },
  media: {
    use: "app-style window showing REAL footage or a screenshot (screen recording, product demo, photo) inside the reel; muted, cover fit, trims cut ~100 ms before the phrase they illustrate",
    props: "{kind: video|image, src (library asset), poster?, head? (caps window label e.g. 'VLOOMBOX.IN · JOBS'), dot?: red|amber|green|none, aspect? (default 16/9), trims?: [{in (s), at?: {text: word}}] (video), focus?: [x%, y%] (image)}",
    ops: { highlight: "{box: [x%, y%, w%, h%], tone?} box drawn on the footage", unhighlight: "", head: "{text}", dot: "{tone}", shrink: "{scale?} shrink to a corner thumbnail (433 ms)" },
  },
  connector: { use: "free curve between two absolute frame points", props: "{from:[x,y], to:[x,y], tone?, bend?}", ops: { draw: "{dur?}" } },
};

// HUD fields (optional persistent status bar, set once in entities.hud)
const HUD = { props: "{host (mono, e.g. api.shop.io), env (pill text), envTone, version, value (right metric), valueLabel}", ops: { env: "{text, tone} pill flip", retype: "target hud.version {text}", text: "target hud.value {text}", tone: "target hud.value {tone}" } };

const TEMPLATES = {
  opener: "no HUD, no mascot. slots: eyebrow? {props:{text}}, headline {props:{lines, size?}}, top? [modules], footer? {props:{text, size?:xl}}. Use for the hook (first scaffold) and the summary (last).",
  stack: "HUD + optional label + a block of 1-3 modules (slots.top: [...], slots.bottom?: [...]). layout: 'column' (mascot beside, width 690) or 'full' (mascot hidden, width 960; use for climaxes, wide diagrams, compare). Heights are automatic; everything must fit 890 px (column) / 960 px (full).",
  sub: "DC only. One sub-state (usually ONE sentence, ~2.6 s): chapter (string, 1-3 words; consecutive sub-states share it), slots.sub (caps breadcrumb for the stage, <= 28 chars), slots.hero? {props:{text (1-2 caps words or a number), kicker (mono caps line), tone?: teal|amber, size?}} OR slots.stage: [1 module, 300-494 px tall, width 912], slots.panel {type: panel, props:{title, rows:[{text, value}] (2-3 rows)}} beside the mascot.",
  scene: "LC only. slots: title (string, <= 22 chars, sentence case), subtitle (string, <= 44 chars, lower case), display? {props:{text, tone}, anchor} (one big number/word), top: [1-3 modules, total 360-700 px], footnote? {text, anchor} (the takeaway, on the scene's last beat). Every scene is rebuilt from empty; nothing persists.",
  hero: "HUD + optional label + slots.hero {id?, props:{text, tone, size?}, anchor} + slots.kicker? {props:{text}, anchor?} + slots.top? [1 small module]. For one spoken number/word that must land big.",
};

function knownOps(type) {
  const m = MODULES[type];
  return Object.assign({}, GENERIC_OPS, m ? m.ops : {});
}

module.exports = { MODULES, GENERIC_OPS, HUD, TEMPLATES, TONES, ICONS, knownOps };
