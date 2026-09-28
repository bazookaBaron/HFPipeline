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
  headline: { use: "1-2 line huge caps headline (hook, climax, summary); with dim:true it is pre-shown at 22% and lights word by word", props: "{lines: [string | {text, tone}], size?: 107, pitch?: 123, dim?: true}", ops: { light: "{line, word?} dim -> lit (dim headlines)", recolour: "{line, word?, tone} keyword recolour" } },
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
  chapterTabs: { use: "persistent chapter bar: 3-4 equal tabs (icon + caps word), one active per chapter, or a cumulative recap that lights each tab on its noun", props: "{items: [{text (<= 10 chars), icon?, tone?}] (3-4), active? (1-based), mode?: single|cumulative}", ops: { activate: "{i} (single: others off)", light: "{i}" } },
  media: {
    use: "app-style window showing REAL footage or a screenshot (screen recording, product demo, photo) inside the reel; muted, cover fit, trims cut ~100 ms before the phrase they illustrate",
    props: "{kind: video|image, src (library asset), poster?, head? (caps window label e.g. 'VLOOMBOX.IN · JOBS'), dot?: red|amber|green|none, aspect? (default 16/9), trims?: [{in (s), at?: {text: word}}] (video), focus?: [x%, y%] (image)}",
    ops: { highlight: "{box: [x%, y%, w%, h%], tone?} box drawn on the footage", unhighlight: "", head: "{text}", dot: "{tone}", shrink: "{scale?} shrink to a corner thumbnail (433 ms)" },
  },
  connector: { use: "free curve between two absolute frame points", props: "{from:[x,y], to:[x,y], tone?, bend?}", ops: { draw: "{dur?}" } },
  // ---- BR only (light brutalist, R7; lib/stage/modules-br.js + profile-br.js). `only` hides them from other profiles' prompts ----
  decisionSheet: {
    only: "BR",
    use: "THE host card: a decision form -- situation line + 1-3 questions with 2-4 radio options each; focus/pulse/pick/scan/prob/outline mutate it in place across sentences",
    props: "{title (mono window label, e.g. 'router · decision sheet'), situation? (quoted input, <= 48 chars), questions: [{label (caps, <= 14 chars), options: [2-4 short words], answer? (option text, filled by scan), p? (0-100)}] (1-3), compact?: true}",
    ops: { focus: "{q, hold?} row tints pale magenta on the question word", pulse: "{q, opt} option ring pulses on its word", pick: "{q, opt} fills one option", scan: "{} magenta line sweeps down and fills every question's answer (on 'returns' / 'answers')", prob: "{q, p, text?} % slams in + probability bar fills", outline: "{q} magenta box around the row on the spoken value" },
    entities: "q<N>, q<N>.o<M>, situation, title",
  },
  targetForm: {
    only: "BR",
    use: "'your_app' form that receives structured answers: labelled fields + a status row; tokens fly into it from a decisionSheet",
    props: "{title? ('your_app'), fields: [{label (caps, <= 12 chars), value?}] (2-4), status? ('Waiting for answers…' | false)}",
    ops: { ask: "{field} field shows ? in a magenta frame", fill: "{field, text, tone?: uncertain} field fills (uncertain = red, e.g. 'maybe??')", fly: "{from: '<sheetId>.q<N>.o<M>', field, text} magenta chip flies from the picked option into the field (~10 f), stagger by using consecutive words", status: "{text, tone?: ok} status row turns green" },
    entities: "f<N>, status",
  },
  writerWindow: {
    only: "BR",
    use: "blue 'LLM · writing…' window streaming a paragraph of generated prose (the generator side of generate-vs-decide); highlighter marks phrases the code must parse",
    props: "{title? ('LLM · writing…'), text (the prose, 150-320 chars), vendors?: [short names, no logos], tone?: blue|ink, autoStream? (default true: streams from its entrance), lines? (height in text lines)}",
    ops: { stream: "{cps?} stream the text (use with autoStream:false)", mark: "{phrase} amber highlighter sweep over a phrase that is ON screen (2-4 consecutive words copied from text)" },
  },
  toolTiles: {
    only: "BR",
    use: "2x2 (or 3x2) tool tiles that start dim and light on each spoken tool; the chosen one gets a magenta outline",
    props: "{tiles: [{icon, label (<= 14 chars)}] (4-6), cols?: 2|3, lit?: false, tileH?: 150}",
    ops: { light: "{i} tile dim -> lit (4 f)", pick: "{i} magenta outline on the chosen tile" },
    entities: "t<N>",
  },
  appGrid: {
    only: "BR",
    use: "3x2 grid of tiny app windows, each with a one-line yes/no question; radios light one per spoken app (finale / 'everywhere' beats)",
    props: "{apps: [{icon, name (<= 12 chars), q (<= 16 chars), answer? ('yes')}] (3-6), cols?: 3}",
    ops: { light: "{i} the app's radio fills magenta" },
    entities: "a<N>",
  },
  docGrid: {
    only: "BR",
    use: "RAG-style grid of document tiles (dashed empty slots -> named docs -> score rings -> relevant ones selected, the rest removed)",
    props: "{docs: [{name (<= 11 chars), relevant?: true, score? (0-99)}] (6-10), cols?: 5}",
    ops: { fill: "{stagger?} docs fill in a cascade", score: "{} score rings pop", select: "{} relevant docs turn magenta, the others are removed" },
    entities: "d<N>",
  },
  raceBars: {
    only: "BR",
    use: "response-time race chart: a fast magenta bar pops at its value while a slow blue bar crawls in real time",
    props: "{title?, rows: [{label (caps), value (axis units), tone?: magenta|blue, display? ('~0.3 s'), fast?: true}] (2-3), axisMax?: 10, unit?: 's'}",
    ops: { race: "{row, dur?} the row's bar grows (fast rows pop; slow rows crawl linearly)" },
    entities: "r<N>",
  },
  costBar: { only: "BR", use: "single red COST bar that shrinks on 'less cost' / 'cheaper'", props: "{label? ('COST'), value?: 100, display?}", ops: { shrink: "{to (percent), display?} bar shrinks in 9 f" } },
  terminal: {
    only: "BR",
    use: "dark terminal window: an intro line, a big shell command typed at 51 chars/s behind a blinking block cursor, then a grey comment line",
    props: "{title?, intro? (<= 34 chars), prompt? ('$'), command (<= 22 chars), comment? ('= what it does', <= 44 chars), typed?: false (command types on the 'type' op)}",
    ops: { type: "{cps?} types the command (use with typed:false)", blink: "{dur?} cursor blinks" },
  },
  slamStamp: { only: "BR", use: "red verdict stamp that slams in at 2.5x (negation: 'isn't', 'not', 'obsolete'); strike crosses it out", props: "{text (1-2 caps words), tone?: red}", ops: { strike: "black strike across the stamp (4 f)" } },
  keywordHeadline: {
    only: "BR",
    use: "caption-sized headline (56 px, sentence case); its keyword starts grey and recolours to magenta/blue on the spoken word",
    props: "{lines: [string] (1-2, <= 26 chars each), keyword? (word(s) that start grey), tone?: magenta|blue|red, align?: center|left|right, size? (56; hook 80-96), dim?: true (whole line grey until light)}",
    ops: { recolour: "{word?, tone?} keyword grey -> colour", light: "{word?} grey -> ink" },
  },
  displayLine: { only: "BR", use: "right-aligned display kicker at the bottom of a stack ('Less cost.', 'Not obsolete.')", props: "same as keywordHeadline (align right)", ops: { recolour: "{word?, tone?}", light: "{word?}" } },
  eyebrow: { only: "BR", use: "magenta mono caps eyebrow over the host card (swap its text with the generic text op)", props: "{text (<= 36 chars), tone?: magenta|grey}", ops: {} },
  modelTile: { only: "BR", use: "black 'giant model' tile with vendor-name chips and a 2-line white label; a red $$$ tag pops on cost words", props: "{label (<= 24 chars), chips?: [short names], tag? ('$$$')}", ops: { tag: "{text?} red tag pops" } },
  // BR chrome, injected by the compiler (never placed in slots): target "brhead" / "brtabs"
  brHeader: { only: "BR", chrome: true, use: "brand header: chapter title + running counter", props: "(compiler)", ops: { tick: "{by?|to?} counter +N with a 1.29x punch (on each decision that lands)", countUp: "{to, dur?} counter spins up (finale crescendo)", title: "{text} chapter title swap (the compiler does this from `chapter`)" } },
  tabChips: { only: "BR", chrome: true, use: "3-state step chips under the header", props: "(compiler, from scaffold.tabs)", ops: { activate: "{step}" } },
  // ---- BP only (light blueprint, R6; lib/stage/modules-bp.js + profile-bp.js) ----
  blueprint: {
    only: "BP",
    use: "THE persistent architecture blueprint that grows V1->V9. Its graph lives in entities.blueprint (ALL nodes, hidden:true for the ones added later); bpHost scaffolds with the same id ('bp') recall it with every change so far. Also usable in bpScene with props {final:true, h} for the hook (the finished architecture)",
    props: "entities.blueprint = {title ('BLUEPRINT · SOCIAL APP'), version?, nodes: [{id, kind?: node|users|machine, icon, tone? (solid icon tile), label (<= 14 chars), sub? (mono, <= 18 chars), row (0 = top tier), hidden?, rows? (machine: [{icon, label, sub?, badge?}]), badge?}] (<= 20; <= 4 per row), edges: [{from, to, style?: solid|replica|dashed, route?: bus|side}], groups?: [{id, label, nodes: [ids]}]}",
    ops: { add: "{node | nodes: [ids] | group} components pop in, their edges draw, the graph auto-refits (zoom-to-fit)", remove: "{node | nodes} a component is replaced (e.g. the V1 'one machine' box when servers arrive)", alert: "{node, text?} red tint + ring (+ red pill)", crash: "{node, text?} red X over the node", clear: "{node}", light: "{node} purple outline", annotate: "{at: node, text (<= 22 chars), tone?: purple|green|red|blue, side?: below|above|right|left, id?} annotation pill", unannotate: "{id?} removes the last (or that) pill", packet: "{from, to, loops?, tone?} dots travel an edge", version: "{n} version chip Vn", connect: "{from, to} draw a hidden:true edge", refit: "{} re-fit the view" },
    entities: "<nodeId>, <nodeId>.label, <nodeId>.sub, version",
  },
  featureRows: { only: "BP", use: "ghost list: 3-5 rows pre-built dashed/grey, each lights on its spoken item (enumerations)", props: "{items: [{icon, tone?, title (<= 18 chars), sub? (mono), visual?: [chips {text, tone?}] (<= 3 short)}] (3-5), lit?: n lit at start}", ops: { lit: "{i} row ghost -> lit", tumble: "{} cards fall away" }, entities: "r<N>" },
  costCards: { only: "BP", use: "ghost trade-off cards: component name + red consequence caps + a mini-visual, lit per sentence", props: "{items: [{icon, tone?, name, consequence (<= 22 chars), visual?: [chips]}] (2-3)}", ops: { lit: "{i}" }, entities: "c<N>" },
  techCards: { only: "BP", use: "2x2 ghost tech cards lit per named technology; 'tumble' knocks them away on a negation", props: "{items: [{icon, tone?, title (<= 14 chars), sub?}] (2-4)}", ops: { lit: "{i}", tumble: "{} cards rotate + fall down-left (7 f)" }, entities: "c<N>" },
  displayHeadline: { only: "BP", use: "left-aligned huge caps thesis (3-4 short lines) that cuts in DIM grey and lights to ink on its key word; accent words turn red", props: "{lines: [string] (2-4, <= 12 chars each), accent?: [words], accentTone?: red|purple|blue, size?}", ops: { lit: "{line?, word?} dim -> ink (no args = all)", tone: "{line?, word, tone}" } },
  strikeStrips: { only: "BP", use: "'X isn't Y, it's Z' pair: the first strip gets a red strike, the second lights green", props: "{no: {eyebrow ('THE GOAL ISN\\'T'), text (<= 24 chars)}, yes: {eyebrow ('IT\\'S'), text}}", ops: { strike: "{} 333 ms red strike over the first", lit: "{} second strip lights" } },
  verdictStamp: { only: "BP", use: "verdict stamp slammed 1.30 -> 1.0 (-5 deg), for a negative verdict ('NOT GOOD SYSTEM DESIGN')", props: "{lines: [1-2 caps lines <= 16 chars], tone?: red|green|amber, sub?: string, icons?: [icon names]}", ops: {} },
  phone: { only: "BP", use: "phone mockup (330x675) showing the product: feed / new post uploading with a live processing timer", props: "{screen: blank|feed|post, app?, user?, caption?, file?: {name, size}, duration?, progress? (0-100)}", ops: { screen: "{name}", timer: "{to (seconds), from?, dur?} processing timer runs", progress: "{to, dur?}" } },
  reqList: { only: "BP", use: "dashed request / job list beside the phone: each row lights (blue) or turns red on its word; optional total row", props: "{eyebrow, icon?, rows: [{verb, path} | {icon, label, value?}] (3-5), total?: {label, value}}", ops: { rowLit: "{row, tone?: blue|red|green}", total: "{tone?: red, text?}" }, entities: "row<N>, total" },
  dotGrid: { only: "BP", use: "5x20 dot grid (each dot = N requests): raster fill, one dot marked, then a recolour sweep", props: "{rows?: 5, cols?: 20, eyebrow ('EACH DOT = 100 REQUESTS'), tone?}", ops: { fill: "{dur?}", mark: "{i, tone}", sweep: "{tone, skip?: [i], dur?}" } },
  hitCounter: { only: "BP", use: "profile card: avatar + handle + route pill + big request counter", props: "{handle, route ('GET /profile/maya'), count?: 0, label?}", ops: { count: "{to, dur?}" } },
  vsCards: { only: "BP", use: "two dashed compare cards (value + label + footer); the winner lights", props: "{cards: [{icon, tone?, title, sub?, value ('9,999'), label?, foot?}] (2)}", ops: { lit: "{card}" }, entities: "c1, c2" },
  latencyBars: { only: "BP", use: "labelled horizontal bars with big values (180 ms vs 12 ms), filled on their clause", props: "{eyebrow?, bars: [{label, value: 0-100, display ('180 ms'), tone?}] (2-3), footer?}", ops: { fill: "{bar?}" } },
  logoGrid: { only: "BP", use: "grid of component tiles that floods in at an accelerating rate with a red counter ('too much infrastructure')", props: "{label?, tiles: [icon names] (12-36), cols?: 6, start?: shown at start}", ops: { flood: "{to?, dur?}" } },
  imageSlot: { only: "BP", use: "a circle / rounded image (or initials) with a ring and optional play disc", props: "{src?, label?, shape?: circle|rounded, play?}", ops: {} },
  jargonCloud: { only: "BP", use: "tilted cloud of term chips that drop in on their words, then a flood of small ones ('random jargon')", props: "{eyebrow?, big: [{label, icon?, tone?}] (3-6), small: [terms] (8-20), hidden: true}", ops: { drop: "{chip: 1-based big index}", flood: "{}", scatter: "{}" } },
  // BP chrome, injected by the compiler: targets "bphead" / "tracker" / "bpnote"
  bpHeader: { only: "BP", chrome: true, use: "segmented header: brand, chapter, live users counter", props: "(compiler)", ops: { users: "{to, dur?} users counter counts up (compact 1K / 250K / 50M)", chapter: "{n, title} (the compiler does this from `chapter`)" } },
  tracker: { only: "BP", chrome: true, use: "component tracker chips", props: "(compiler, from entities.tracker)", ops: { light: "{chip: name} chip lights on the component noun" } },
  noteCard: { only: "BP", chrome: true, use: "left thesis note card", props: "(compiler, from scaffold.note)", ops: { note: "{kind: rule|problem|fix|goal|cost, text (<= 34 chars)}" } },
  // ---- LF only (16:9 long-form editorial; lib/stage/profile-lf.js + modules-lf.js + modules-chart.js).
  // Media is referenced by slot ({slot: "<id>"}, resolved from media-manifest.json at compile time), never by URL/path.
  photo: { only: "LF", use: "a real photo (or AI illustration) from the media manifest: cover fit on its focal box, slow push-in over its run, card or full-bleed; ALWAYS annotate it on the words", props: "{slot, card?: true, scrim?: left|right|bottom|center, veil?: 0-1, tag? (mono caps label), pushIn?: true, fallbackLabel?}", ops: { highlight: "{box:[x,y,w,h] % of the photo, label?, tone?, hold?} yellow box drawn on the picture", unhighlight: "{}", arrow: "{from:[x,y] %, to:[x,y] %, label?, tone?} curved arrow draws", zoomTo: "{box} push into a region (600 ms)", zoomOut: "{}", dim: "{level?} paper veil over the photo", undim: "{}" } },
  photoGrid: { only: "LF", use: "2-4 photos side by side (people, places, products)", props: "{items: [{slot, label?}] (2-4), cols?, hidden?}", ops: { show: "{item}", focus: "{item} others veil", unfocus: "{}" }, entities: "i<N>" },
  portraitCard: { only: "LF", use: "a person: photo + name + role + years", props: "{slot, name, role?, years?}", ops: {} },
  headlineCard: { only: "LF", use: "a news headline REBUILT as typeset text (publisher, date, headline) -- never a screenshot; the key phrase gets a marker sweep", props: "{publisher, date, headline (<= 90 chars), deck?, highlight? (phrase from the headline)}", ops: { highlight: "{phrase?} yellow marker sweeps the phrase" } },
  bigNumber: { only: "LF", use: "one big figure that counts up (money, %, counts) + unit + a context line; optional 2-3 mini bars", props: "{value (number), prefix? ('₹'), suffix?, unit? ('crore'), decimals?, grouping?: intl|in, eyebrow?, context, count?: enter|op, bars?: [{label, value 0-100, display, tone?}], card? (satellite mini card; rails set it), align?: center}", ops: { count: "{to?, from?, dur?}", fill: "{bar?}" } },
  compareCols: { only: "LF", use: "2-3 columns compared (then vs now, company vs company), each with an optional photo, stats and bars", props: "{cols: [{title, sub?, photo?: {slot}, tone?, stats: [{label, value, bar? 0-100, tone?}]}] (2-3), vs?: true, hidden?, statsHidden?}", ops: { show: "{col}", stat: "{col, row} row reveals + bar fills", win: "{col, text?} winner ring + badge", lose: "{col} dims" }, entities: "c<N>, c<N>r<M>" },
  eraTimeline: { only: "LF", use: "horizontal era timeline, 3-6 ticks with years, labels and optional thumbnails, ticked on the words", props: "{ticks: [{year, label (<= 34 chars), sub?, photo?: {slot}}] (3-6), hidden?: true}", ops: { tick: "{i} tick i appears, the line runs to it", focus: "{i}" }, entities: "t<N>" },
  barChart: { only: "LF", use: "bar chart in plain units; draws on its word; source line mandatory", props: "{title?, unit ('₹ crore'), source (mandatory), bars: [{label, value, display?, tone?}] (2-8), accent? (1-based), hidden?}", ops: { draw: "{bar?}", annotate: "{bar, text, tone?}", tone: "{bar, tone}" }, entities: "b<N>" },
  lineChart: { only: "LF", use: "line chart over time in plain units; draws left to right; source line mandatory", props: "{title?, unit, source (mandatory), points: [{x, y, display?}] | series: [{name, tone?, points}], area?: true, hidden?}", ops: { draw: "{}", annotate: "{i (1-based point), text, tone?, series?}" } },
  chapterCard: { only: "LF", use: "chapter card (the compiler fills index/count/title from sb.chapter)", props: "{promise (one line), eyebrow?}", ops: {} },
  recapList: { only: "LF", use: "3-5 takeaways checked off one by one", props: "{items: [string] (3-5), hidden?}", ops: { check: "{i}" }, entities: "r<N>" },
  endScreen: { only: "LF", use: "the long-form ending (added by the compiler, never authored)", props: "(brand.json longform)", ops: { show: "{part: line2|sub|subscribe|slots}", press: "{}" } },
  lfText: { only: "LF", use: "eyebrow + headline (+ sub); kinetic words on the cold open; marker highlight on a phrase", props: "{eyebrow?, title (<= 8 words), size?: 72, maxLines?, highlight? (phrase), kinetic?, tone?, align?: center, plate? (caption card)}", ops: { highlight: "{} marker sweeps the phrase" } },
  lowerThird: { only: "LF", use: "lower third over a full-bleed photo (who / where / when)", props: "{title, sub?, tag?, tone?}", ops: {} },
  callout: { only: "LF", use: "stat / label chip placed over a photo, with a leader line to the thing it names", props: "{value?, text, tone?} (+ overlay `point` [x,y] % in the template)", ops: {} },
  worldMap: { only: "LF", use: "vector world map on white (Natural Earth, India's official borders), glowing borders that draw on: highlight (the country lifts with a glowing edge, others fade), pin cities, flows as comet arcs, a choropleth of a World Bank series, frosted counters; the camera can open wide (intro) and zoom on a word", props: "{focus?: [ISO3] (fit to these; default whole world), intro?: 'world'|'region' (establishing flight into the view), highlight?: [{iso, tone?, label?: true|text}], pins?: [{city|iso|lonlat:[lon,lat], label?, tone?}], arrows?: [{from, to, label?, tone?}], choropleth?: {series: 'S3', title?}, counters?: [{at: ISO3|city, value, prefix?, suffix?, label?, tone?}], card?: true}", ops: { highlight: "{iso, tone?, label?} the country lifts (gradient, glow edge), the rest fades", dim: "{iso}", pin: "{city|iso|lonlat, label?, tone?} dot + pulsing rings, the label types on", arrow: "{from, to, label?, tone?} a comet travels the arc (1.1 s); from/to = {city}|{iso}|{lonlat}", zoomTo: "{isos: [ISO3] | view: 'world', dur?: 1.2} the camera moves; pins and arcs ride along", choropleth: "{series: 'S3', title?} countries fill west to east, the top class glows, legend + source land", counter: "{at: ISO3|city, value, prefix?, suffix?, label?} frosted card counts up at the place" } },
  countryMap: { only: "LF", use: "vector regional map fitted to 1-4 countries (names labelled), glowing edges, for where-is-it / border / neighbour beats; intro 'world' flies in from the globe", props: "{focus: [ISO3] (1-4, required), intro?: 'world'|'region', highlight?, pins?, arrows?, counters?, labels?: false}", ops: { highlight: "{iso, tone?}", dim: "{iso}", pin: "{city|iso|lonlat, label?, tone?}", arrow: "{from, to, label?, tone?}", zoomTo: "{isos | view: 'world', dur?}", counter: "{at, value, prefix?, suffix?, label?}" } },
  routeMap: { only: "LF", use: "a journey / trade / money route over 2-5 stops: gradient comet arcs leg by leg, stops pulse, labels type on (movement beats: shipped, flew, fled, borrowed from)", props: "{stops: [{city|iso|lonlat, label?}] (2-5), legs?: [{from: 1, to: 2, label?}] (default: chained), mode?: air|sea|land, tone?, focus?: [ISO3], intro?: 'world'|'region', counters?}", ops: { leg: "{i} draws leg i (1-based) on the word", pin: "{city|iso|lonlat, label?}", highlight: "{iso, tone?}", zoomTo: "{isos | view}", counter: "{at, value, ...}" } },
  mapCard: { only: "LF", use: "a locator map image (media manifest) with pins and money/goods flow arrows", props: "{slot, title?, pins: [{at:[x,y] %, label?, tone?}], arrows: [{from, to, label?, tone?}]}", ops: { pin: "{i}", arrow: "{i}", highlight: "{box}" } },
  // ---- LF set 2 (modules-lf2.js; templates-lf2.js lfQuote / lfFeature / lfDuo / lfFlash) ----
  quoteCard: { only: "LF", use: "a real quote typeset on a card (words rise in), marker swipes over its key phrases, source line; never invent a quote", props: "{quote (<= 30 words, verbatim), source (who said it), role?, date?, highlight?: phrase | [phrases] (copied verbatim from the quote), photo?: {slot} (small portrait), tone?}", ops: { highlight: "{i? (1-based phrase)} marker swipes that phrase" } },
  lfYearTimeline: { only: "LF", use: "proportional year axis with event pins, stems and cards; a playhead with a year counter travels event to event", props: "{items: [{year, label (<= 28 chars), tone?}] (3-7), start?, end?}", ops: { go: "{i} the playhead travels to event i (1-based), its pin and card land" }, entities: "e<N>" },
  flowDiagram: { only: "LF", use: "who pays whom: 2-5 labelled boxes with icons and money-flow arrows (dots march along them)", props: "{nodes: [{id, label (<= 16 chars), sub?, icon?: bank|govt|people|person|factory|globe|coin|card|ship|oil|house|chart|doc|plane|wheat|lock|scale, tone?}] (2-5), flows: [{from, to, label? (<= 14 chars), tone?}] (1-6), layout?: row|hub|cycle}", ops: { flow: "{i} flow i (1-based) draws on", node: "{id} box pops" }, entities: "n_<id>" },
  pictogramGrid: { only: "LF", use: "1 icon = N units: a grid (10-100 icons) whose share lights up with a counter (1 in 4 people, 38 of 100 dollars)", props: "{total (10-100), filled, icon?: person|coin|house|barrel|car|job|wheat, label (<= 8 words), unit? ('1 million people'), tone?, figure? (text shown instead of the count)}", ops: { fill: "{to?} icons light up to that count" } },
  barRace: { only: "LF", use: "a ranking that re-orders: bars race frame by frame (years) or grow and sort into rank (one year of a map series)", props: "{series: 'S#' (map series: top countries) | ['S1','S2','S3'] (time series: one bar each) | frames: [{label, bars: [{name, value}]}], top?: 8, highlight? (ISO3 or name), title?, unit?, prefix?, suffix?, decimals?}", ops: { step: "{i} jump to frame i (1-based)" } },
  splitScreen: { only: "LF", use: "two pictures side by side with a slanted divider and labels (then vs now, rich vs poor, A vs B)", props: "{left: {slot, label (<= 4 words), sub?, tone?}, right: {slot, label, sub?, tone?}, vs?: true}", ops: { focus: "{side: left|right} the other side veils", unfocus: "{}" } },
  photoStack: { only: "LF", use: "2-3 photo cards pop around a centre element (a big figure or a short label)", props: "{items: [{slot, label?}] (2-3), centre?: {value?, prefix?, suffix?, label?} | {text, label?}}", ops: { show: "{i}", focus: "{i} that card comes forward" }, entities: "p<N>, centre" },
  documentStamp: { only: "LF", use: "an ILLUSTRATIVE document on paper (tagged Illustration); a stamp word slams onto it (DEFAULT, BANKRUPT, APPROVED, SEIZED). Generic wording only; no invented decree numbers or letterheads", props: "{title (generic, e.g. 'Debt notice'), ref? (only a dossier string), lines?: [short typeset lines] (<= 6), date?, stamp (<= 12 chars), sub?, tone?: red, angle?: -12}", ops: { stamp: "{} the stamp slams on the word" } },
  flashBurst: { only: "LF", use: "6-10 quick frames with white flash cuts (a montage beat; at most one per 2 minutes), a kicker word lands on the last", props: "{items: [{slot, label?}] (6-10), per?: 0.2, kicker? (<= 3 words)}", ops: { burst: "{} the burst fires on the word" } },
  // LF chrome, injected by the compiler: "lfhead" (kicker), "lfprog" (chapter progress), "lfcredit" (media credit line)
  lfHeader: { only: "LF", chrome: true, use: "chapter kicker", props: "(compiler, from sb.chapter)", ops: { chapter: "{index?, title?}" } },
  lfProgress: { only: "LF", chrome: true, use: "chapter progress segments", props: "(compiler)", ops: {} },
  lfCredit: { only: "LF", chrome: true, use: "media credit line", props: "(compiler, from the media manifest)", ops: { credit: "{text}" } },
};

// HUD fields (optional persistent status bar, set once in entities.hud)
const HUD = { props: "{host (mono, e.g. api.shop.io), env (pill text), envTone, version, value (right metric), valueLabel}", ops: { env: "{text, tone} pill flip", retype: "target hud.version {text}", text: "target hud.value {text}", tone: "target hud.value {tone}" } };

const TEMPLATES = {
  opener: "no HUD, no mascot. slots: eyebrow? {props:{text}}, headline {props:{lines, size?}}, top? [modules], footer? {props:{text, size?:xl}}. Use for the hook (first scaffold) and the summary (last).",
  stack: "HUD + optional label + a block of 1-3 modules (slots.top: [...], slots.bottom?: [...]). layout: 'column' (mascot beside, width 690) or 'full' (mascot hidden, width 960; use for climaxes, wide diagrams, compare). Heights are automatic; everything must fit 890 px (column) / 960 px (full).",
  sub: "DC only. One sub-state (usually ONE sentence, ~2.6 s): chapter (string, 1-3 words; consecutive sub-states share it), slots.sub (caps breadcrumb for the stage, <= 28 chars), slots.hero? {props:{text (1-2 caps words or a number), kicker (mono caps line), tone?: teal|amber, size?}} OR slots.stage: [1 module, 300-494 px tall, width 912], slots.panel {type: panel, props:{title, rows:[{text, value}] (2-3 rows)}} beside the mascot.",
  scene: "LC only. slots: title (string, <= 22 chars, sentence case), subtitle (string, <= 44 chars, lower case), display? {props:{text, tone}, anchor} (one big number/word), top: [1-3 modules, total 360-700 px], footnote? {text, anchor} (the takeaway, on the scene's last beat). Every scene is rebuilt from empty; nothing persists.",
  hero: "HUD + optional label + slots.hero {id?, props:{text, tone, size?}, anchor} + slots.kicker? {props:{text}, anchor?} + slots.top? [1 small module]. For one spoken number/word that must land big.",
  // ---- BR only (templates-br.js, R7 §5.9). Every BR scaffold may also carry `chapter` (header title) and `tabs` ----
  brStack: "BR only (T1/T2/T3). slots: eyebrow? {props:{text}, anchor?}, headline? {props:{lines, keyword?, tone?, size?}, anchor?}, top: [1-2 window cards stacked with 40 px gaps, total 380-900 px], display? {props:{lines, keyword?, tone?}, anchor} (right-aligned kicker at the bottom). layout 'column' (presenter at the left, width 700) or 'full' (presenter hidden, width 978). A card keeps its state across consecutive scaffolds when it keeps its id (the host sheet mutates in place).",
  brGrid: "BR only (T7). Same slots as brStack; the object is a grid card (toolTiles / docGrid / appGrid). Default layout 'full'.",
  brMedia: "BR only (T4). slots: media {props:{kind, src, head, ...}} (full-width window 862 px), overlay? {type (a BR window card), props} (overlaps the media's bottom-right), display? {props:{lines}, anchor} (words at the bottom left).",
  brSummary: "BR only (T8, the recap). slots: a {headline {props:{lines, keyword, tone:'blue'}}, module {type, props}}, b {headline {props:{lines, keyword, tone:'magenta'}}, module {type, props}}. Full width; both parts together <= 950 px.",
  brBand: "BR only (T5, proof moment). slots: lockup {props:{lines, keyword?}} (big line above), top: [ONE card shown on a full-bleed pink band, <= 660 px].",
  // ---- BP only (templates-bp.js, R6). Every BP scaffold carries `note` {kind, text} and may carry `chapter` and `transition` {out, in} ----
  bpScene: "BP only (explainer). slots.top: [1-3 modules, total 640-928 px, column 717 px wide from y 402]; two consecutive fills with \"half\": true share a row (348 px each, e.g. phone + reqList).",
  // ---- LF only (templates-lf.js, 16:9 long-form, CENTRE-STAGE). One hero on the frame's centre axis; satellites orbit it in the left/right rails (`left` / `right`: [0-2 fills each, balanced], types callout | bigNumber (mini card) | portraitCard | photo (thumbnail) | lfText (short label plate)); media fills take props.slot; `overlays` [{type: callout|lowerThird, at: [x,y] %, point?: [x,y] %, props, anchor}] sit on the hero; any scaffold may carry `transition`: {out: "zoomThrough", in: "zoomIn"} (the cut pushes through the centre) ----
  lfCold: "LF only (cold open). slots: photo {props:{slot}} (full bleed, bottom scrim), headline {props:{eyebrow?, title <= 8 words}} (kinetic, centred low), left? / right? satellites (upper rails), overlays?.",
  lfStage: "LF only (the workhorse). slots: hero {type?: photo (default) | countryMap | worldMap | barChart | lineChart | mapCard, props} centred (card 1152x648, size: 'photo' 972x648 3:2 or 'full' bleed), title? {props:{eyebrow?, title <= 8 words, highlight?}} (top centre) OR headline? {props:{tag?, title <= 8 words, sub? <= 8 words}} (lower third centred over the hero's bottom edge), left? / right? [0-2 satellites each; photo heroes: they overlap its edge], overlays?.",
  lfFull: "LF only. slots: photo (full bleed), lowerThird {props:{title, sub?, tag?}} (centred at the bottom, lands <= 1.5 s), left? / right? satellites, overlays? (callouts).",
  lfChart: "LF only. slots: title? {props:{eyebrow?, title}} (top centre), chart {type: barChart|lineChart, props} centred, left? / right? satellites (mini bigNumber cards / callouts beside it).",
  lfNumber: "LF only. slots: number {props bigNumber} centred as the hero (count-up, size 220), left? / right? satellites orbiting it (portraitCard of the person, callout chips, photo thumbnail), backdrop? {props:{slot}} (full bleed under a centre scrim), overlays?.",
  lfCompare: "LF only. slots: title? (top centre), compare {props compareCols} centred (2 cols + vs: the VS chip sits on the centre line).",
  lfTimeline: "LF only. slots: title? (top centre), timeline {props eraTimeline} (a band across the centre).",
  lfMap: "LF only. slots: map {type?: countryMap (default) | worldMap | mapCard, props} centred hero, left? / right? satellites. Prefer countryMap / worldMap: vector, exact, animated on the words (highlight / pin / arrow / zoomTo events).",
  lfHeadline: "LF only. slots: headline {props headlineCard; deck? <= 12 words} centred, photo? (centred above it, the card overlaps its bottom edge), left? / right? satellites, overlays?.",
  lfChapter: "LF only. First scaffold of a chapter: a centred poster. slots: card {props:{promise <= 10 words}}, photo? (centred card above the number/title), overlays? (chips hanging off the photo's edge).",
  lfJoke: "LF only (comedic beat). slots: art {props:{slot}} (AI illustration / photo, centred card), punchline {props:{title <= 8 words, highlight?}} (caption plate over its bottom edge), tag? {props:{text}} (sticker on its top-right corner), left? / right?.",
  lfRecap: "LF only. slots: title? (top centre), list {props recapList} centred, photo? (a rail thumbnail).",
  lfEnd: "LF only; added by the compiler from brand.json longform (never authored).",
  lfQuote: "LF only. slots: quote {props quoteCard} centred card, left? / right? satellites (a portraitCard of the speaker).",
  lfFeature: "LF only. slots: hero {type: timeline | flowDiagram | pictogramGrid | barRace | documentStamp | photoStack, props} centred, title? {props:{eyebrow?, title <= 8 words}} (top centre), left? / right? satellites.",
  lfDuo: "LF only. slots: split {props splitScreen} full bleed (two media halves), overlays? (callouts).",
  lfFlash: "LF only. slots: burst {props flashBurst} full bleed (quick montage frames).",
  bpHost: "BP only. The persistent blueprint (slots.blueprint {id: 'bp'}), graph from entities.blueprint; every later bpHost with the same id recalls it with its accumulated state (add / alert / annotate / version ops mutate it).",
};

function knownOps(type) {
  const m = MODULES[type];
  return Object.assign({}, GENERIC_OPS, m ? m.ops : {});
}

module.exports = { MODULES, GENERIC_OPS, HUD, TEMPLATES, TONES, ICONS, knownOps };
