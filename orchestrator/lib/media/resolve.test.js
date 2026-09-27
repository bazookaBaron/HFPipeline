"use strict";
// Offline: fake providers + generated images (ffmpeg lavfi). Covers the fallback chain order,
// licence/quality screening, vision rejection, dHash duplicate handling, cache + manifest output.

const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { runFfmpeg, dhashFromGray, hamming, isDuplicate, sniffImage, dhash } = require("./image");
const { resolveMedia } = require("./resolve");
const { normalizeLicense } = require("./license");

const SOURCES = ["testsrc2", "mandelbrot", "smptebars", "rgbtestsrc", "cellauto=rule=110", "life=s=320x240:mold=10:r=1:ratio=0.1:death_color=#C83232"];
let IMGS = {};

async function makeImg(src, w = 640, h = 360) {
  return runFfmpeg(["-f", "lavfi", "-i", src, "-frames:v", "1", "-vf", `scale=${w}:${h}`, "-f", "image2", "-c:v", "mjpeg", "pipe:1"]);
}

test.before(async () => {
  for (let i = 0; i < SOURCES.length; i++) IMGS[`img${i}`] = await makeImg(SOURCES[i]);
  IMGS.img0copy = await makeImg(SOURCES[0], 480, 270); // same picture, different size -> near-duplicate
});

function tmpCache() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "hfmedia-test-"));
}

function cand(source, key, extra = {}) {
  return {
    source,
    via: `${source}:search`,
    id: `${source}:${key}`,
    title: key,
    pageUrl: `https://example.org/${source}/${key}`,
    fileUrl: `https://files.example/${key}.jpg`,
    width: 1920,
    height: 1080,
    origWidth: 1920,
    origHeight: 1080,
    mediaType: "image",
    author: "Jane Doe",
    licence: normalizeLicense("CC BY-SA 4.0"),
    provider: source === "openverse" ? "flickr" : undefined,
    ...extra,
  };
}

function fakeHttp(calls) {
  return {
    stats: { requests: 0, cacheHits: 0 },
    getJson: async () => {
      throw new Error("no network in tests");
    },
    getBuffer: async (url) => {
      calls.push(url);
      const key = url.replace(/^.*\//, "").replace(/\.jpg$/, "");
      if (!IMGS[key]) throw new Error(`no fixture image ${key}`);
      return IMGS[key];
    },
  };
}

function fakeProviders({ commons = [], openverse = [], nasa = [], order }) {
  const hit = (name, list) => async (_http, q) => {
    order.push(`${name}:${q}`);
    return list.map((c) => ({ ...c, query: q }));
  };
  return {
    wikidata: { lookup: async () => null, filesForKind: () => [] },
    commons: { search: hit("commons", commons), files: async () => [], category: async () => [] },
    openverse: { search: hit("openverse", openverse) },
    nasa: { search: hit("nasa", nasa) },
    illustrate: {
      illustrate: async () => {
        order.push("illustrate");
        return { data: IMGS.img5, mime: "image/jpeg", prompt: "p", model: "fake-image" };
      },
    },
  };
}

// gemini fake: query plans from a map; vision verdicts from a function of the prompt
function fakeGemini({ plan = {}, visionPass = () => true } = {}) {
  const log = [];
  return {
    imageModel: "fake-image",
    log,
    json: async (prompt, o = {}) => {
      if (/You write image search queries/.test(prompt)) {
        log.push("plan");
        return { queries: ["q1", "q2"], rubric: "must show it", nasaRelevant: false, ...plan };
      }
      const n = (o.images || []).length;
      log.push(`vision:${n}`);
      return { results: Array.from({ length: n }, (_, k) => ({ i: k + 1, matches: visionPass(log.length, k), confidence: 0.9, focal: [0.2, 0.2, 0.5, 0.5], depicts: "thing" })) };
    },
  };
}

test("image: dHash, hamming, sniff", async () => {
  const flat = Buffer.alloc(72, 128);
  assert.strictEqual(dhashFromGray(flat), "0000000000000000");
  const ramp = Buffer.from(Array.from({ length: 72 }, (_, i) => 255 - (i % 9) * 20));
  assert.strictEqual(dhashFromGray(ramp), "ffffffffffffffff");
  assert.strictEqual(hamming("ffffffffffffffff", "0000000000000000"), 64);
  assert.ok(isDuplicate("00000000000000ff", ["0000000000000000"]));
  assert.ok(!isDuplicate("0000000000ffffff", ["0000000000000000"]));
  assert.deepStrictEqual(sniffImage(IMGS.img0), { type: "jpeg", ext: "jpg", width: 640, height: 360 });
  const [a, b, c] = [await dhash(IMGS.img0), await dhash(IMGS.img0copy), await dhash(IMGS.img1)];
  assert.ok(hamming(a, b) <= 10, `resized copy is a near-duplicate (${hamming(a, b)})`);
  assert.ok(hamming(a, c) > 10, `different pictures differ (${hamming(a, c)})`);
});

test("chain: Commons licence/size rejects fall through to Openverse; manifest, sidecar, credits", async () => {
  const order = [];
  const calls = [];
  const cacheDir = tmpCache();
  const outDir = path.join(cacheDir, "out");
  const providers = fakeProviders({
    order,
    commons: [cand("commons", "img0", { licence: normalizeLicense("CC BY-NC-SA 2.0") }), cand("commons", "img1", { width: 1000, height: 700 })],
    openverse: [cand("openverse", "img2", { author: "markhillary", licence: normalizeLicense("by", { version: "2.0" }) })],
  });
  const { manifest, report } = await resolveMedia([{ slot: "s1", kind: "photo", intent: "Mumbai airport" }], {
    cacheDir,
    outDir,
    http: fakeHttp(calls),
    providers,
    gemini: fakeGemini(),
  });
  assert.deepStrictEqual(order, ["commons:q1", "commons:q2", "openverse:q1", "openverse:q2"]);
  const e = manifest.s1;
  assert.strictEqual(e.status, "ok");
  assert.strictEqual(e.source, "openverse");
  assert.strictEqual(e.credit, "Photo: markhillary / Flickr · CC BY 2.0");
  assert.deepStrictEqual(e.focal, [0.2, 0.2, 0.5, 0.5]);
  assert.ok(fs.existsSync(path.join(cacheDir, e.sha.slice(0, 2), `${e.sha}.jpg`)));
  const side = JSON.parse(fs.readFileSync(path.join(cacheDir, e.sha.slice(0, 2), `${e.sha}.json`), "utf8"));
  assert.strictEqual(side.licence, "CC BY 2.0");
  assert.strictEqual(side.pageUrl, "https://example.org/openverse/img2");
  assert.ok(side.fetchedAt);
  const rejects = report.slots.s1.trace[0].rejects.map((r) => r.why.join(","));
  assert.ok(rejects.some((w) => /non-commercial/.test(w)));
  assert.ok(rejects.some((w) => /width 1000 < 1280/.test(w)));
  assert.ok(fs.existsSync(path.join(outDir, "media-manifest.json")));
  assert.match(fs.readFileSync(path.join(outDir, "credits.txt"), "utf8"), /\[s1\] "img2" · by markhillary · Flickr \(via Openverse\)/);
  assert.ok(fs.existsSync(path.join(cacheDir, ".gitignore")));
});

test("chain: vision rejects Commons, NASA only when relevant, then illustration only when allowed", async () => {
  const order = [];
  const providers = fakeProviders({ order, commons: [cand("commons", "img0")], openverse: [], nasa: [cand("nasa", "img1", { licence: normalizeLicense("Public domain"), author: "" })] });
  const gemini = fakeGemini({ plan: { nasaRelevant: true }, visionPass: () => false });
  const { manifest } = await resolveMedia(
    [
      { slot: "a", kind: "photo", intent: "jet fuel truck", allowIllustration: false },
      { slot: "b", kind: "photo", intent: "jet fuel truck at night", allowIllustration: true },
    ],
    { cacheDir: tmpCache(), http: fakeHttp([]), providers, gemini, concurrency: 1 }
  );
  assert.strictEqual(manifest.a.status, "fallback");
  assert.match(manifest.a.reason, /commons: 1 found, 1 eligible, 1 vetted, 0 passed/);
  assert.match(manifest.a.reason, /nasa/);
  // b: every photo stage fails vision, then an illustration is made (its own vision check also fails here -> retried, then fallback)
  assert.strictEqual(order.filter((o) => o === "illustrate").length, 3);
  assert.strictEqual(manifest.b.status, "fallback");
  const firstA = order.indexOf("commons:q1");
  assert.ok(order.indexOf("openverse:q1") > firstA && order.indexOf("nasa:q1") > order.indexOf("openverse:q1"));
});

test("kind illustration skips photo providers and is credited as AI", async () => {
  const order = [];
  const { manifest } = await resolveMedia([{ slot: "joke", kind: "illustration", intent: "a plane made of unpaid bills" }], {
    cacheDir: tmpCache(),
    http: fakeHttp([]),
    providers: fakeProviders({ order, commons: [cand("commons", "img0")] }),
    gemini: fakeGemini(),
  });
  assert.deepStrictEqual(order, ["illustrate"]);
  assert.strictEqual(manifest.joke.status, "illustration");
  assert.strictEqual(manifest.joke.credit, "Illustration: AI-generated");
  assert.strictEqual(manifest.joke.licence, "AI-generated");
});

test("dHash: a near-duplicate of an earlier slot's pick is skipped for the next best", async () => {
  const order = [];
  const providers = fakeProviders({ order, commons: [cand("commons", "img0"), cand("commons", "img0copy"), cand("commons", "img3")] });
  // slot 2 sees img0copy ranked first (vision prefers index 0 of its batch) but it duplicates slot 1's img0
  providers.commons.search = async (_h, q) => (q === "q1" ? [cand("commons", "img0")] : [cand("commons", "img0copy"), cand("commons", "img3")]);
  const gemini = fakeGemini({ plan: { queries: ["q1"] } });
  gemini.json = ((orig) => async (prompt, o) => (/You write image search queries/.test(prompt) ? { queries: [/second/.test(prompt) ? "q2" : "q1"], rubric: "r" } : orig(prompt, o)))(gemini.json);
  const { manifest } = await resolveMedia(
    [
      { slot: "first", kind: "photo", intent: "first picture" },
      { slot: "second", kind: "photo", intent: "second picture" },
    ],
    { cacheDir: tmpCache(), http: fakeHttp([]), providers, gemini, concurrency: 2 }
  );
  assert.strictEqual(manifest.first.status, "ok");
  assert.strictEqual(manifest.second.status, "ok");
  assert.notStrictEqual(manifest.first.sha, manifest.second.sha);
  const side = (e) => e.file;
  assert.ok(side(manifest.second));
  assert.ok(hamming(await dhash(IMGS.img0), await dhash(IMGS.img3)) > 10);
});

test("intent validation", async () => {
  await assert.rejects(resolveMedia([{ slot: "x", kind: "gif", intent: "y" }], { cacheDir: tmpCache(), http: fakeHttp([]) }), /kind must be/);
  await assert.rejects(resolveMedia([{ slot: "x", kind: "photo", intent: "y" }, { slot: "x", kind: "photo", intent: "z" }], { cacheDir: tmpCache(), http: fakeHttp([]) }), /duplicate slot/);
});

test("full-bleed slot with only portrait-orientation pictures degrades to a card (size recorded)", async () => {
  const order = [];
  const providers = fakeProviders({ order, commons: [cand("commons", "img4", { width: 1080, height: 1440 })] });
  const { manifest, report } = await resolveMedia([{ slot: "hq", kind: "photo", intent: "bank headquarters tower" }], {
    cacheDir: tmpCache(),
    http: fakeHttp([]),
    providers,
    gemini: fakeGemini(),
  });
  assert.strictEqual(manifest.hq.status, "ok");
  assert.strictEqual(manifest.hq.size, "card");
  assert.ok(report.slots.hq.trace.some((t) => t.stage === "commons:card" && t.passed === 1));
  const strict = await resolveMedia([{ slot: "hq", kind: "photo", intent: "bank headquarters tower", allowCard: false, allowIllustration: false }], {
    cacheDir: tmpCache(),
    http: fakeHttp([]),
    providers,
    gemini: fakeGemini(),
  });
  assert.strictEqual(strict.manifest.hq.status, "fallback");
});

test("illustration with text is regenerated up to 2 more times", async () => {
  const order = [];
  const gemini = fakeGemini();
  let n = 0;
  gemini.json = async (prompt, o) => ({ results: (o.images || []).map((_, k) => ({ i: k + 1, matches: true, confidence: 0.9, heavyText: ++n < 3 })) });
  const providers = fakeProviders({ order });
  const pics = [IMGS.img3, IMGS.img4, IMGS.img5];
  providers.illustrate.illustrate = async () => {
    order.push("illustrate");
    return { data: pics[order.length - 1], mime: "image/jpeg", prompt: "p", model: "fake-image" };
  };
  const { manifest, report } = await resolveMedia([{ slot: "ill", kind: "illustration", intent: "a banker with a giant note" }], {
    cacheDir: tmpCache(),
    http: fakeHttp([]),
    providers,
    gemini,
  });
  assert.strictEqual(order.filter((o) => o === "illustrate").length, 3);
  assert.strictEqual(manifest.ill.status, "illustration");
  assert.strictEqual(report.slots.ill.trace[0].rejects.length, 2);
});
