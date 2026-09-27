"use strict";
// Video clips, offline: provider parsing on recorded responses (2026-09-27), window picking on synthetic
// signals and on an ffmpeg-generated test clip (black lead-in, two shots with a hard cut, fade-out),
// the full resolve -> manifest -> compile/media-layer/checkMedia contract, and the still fallback.

const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const V = require("./video");
const commons = require("./providers/commons");
const nasa = require("./providers/nasa");
const { resolveMedia } = require("./resolve");
const { normalizeLicense } = require("./license");
const { runFfmpeg } = require("./image");
const { resolveSlots } = require("../video/v3/compile");
const { buildMediaLayer, checkMedia } = require("../video/v3/media");

const fx = (n) => require(`./fixtures/${n}`);
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "hfvideo-test-"));
const CLIP = path.join(TMP, "synthetic.mp4");
let POSTER;
let STILL;

// 0-1 s black, 1-6 s testsrc2 (moving), hard cut, 6-11 s mandelbrot (zooming), 11-12 s fade to black
test.before(async () => {
  const r = spawnSync("ffmpeg", [
    "-hide_banner", "-loglevel", "error", "-y",
    "-f", "lavfi", "-i", "color=black:s=1280x720:r=30:d=1",
    "-f", "lavfi", "-i", "testsrc2=s=1280x720:r=30:d=5",
    "-f", "lavfi", "-i", "mandelbrot=s=1280x720:r=30,trim=duration=6",
    "-filter_complex", "[2:v]fade=t=out:st=5:d=1[m];[0:v][1:v][m]concat=n=3:v=1:a=0,format=yuv420p[v]",
    "-map", "[v]", "-c:v", "libx264", "-preset", "ultrafast", "-crf", "28", CLIP,
  ], { windowsHide: true });
  assert.strictEqual(r.status, 0, String(r.stderr));
  POSTER = await runFfmpeg(["-f", "lavfi", "-i", "testsrc2=s=960x540", "-frames:v", "1", "-f", "image2", "-c:v", "mjpeg", "pipe:1"]);
  STILL = await runFfmpeg(["-f", "lavfi", "-i", "smptebars=s=1920x1080", "-frames:v", "1", "-f", "image2", "-c:v", "mjpeg", "pipe:1"]);
});
test.after(() => fs.rmSync(TMP, { recursive: true, force: true }));

test("commons video: videoinfo parse, derivative preference, licence, duration", () => {
  const c = commons.parsePages(fx("commons-video-container-ship.json"), "commons:search", "container ship port");
  assert.strictEqual(c.length, 6);
  assert.ok(c.every((x) => x.mediaType === "video" && x.posterUrl));
  const cork = c[0];
  assert.strictEqual(cork.rendition, "1080p.vp9.webm"); // 1080p transcode, not the original
  assert.match(cork.fileUrl, /\/transcoded\/.*\.1080p\.vp9\.webm$/);
  assert.strictEqual(cork.height, 1080);
  assert.strictEqual(Math.round(cork.duration), 136);
  assert.strictEqual(cork.licence.label, "CC BY 3.0");
  assert.strictEqual(cork.licenceReview, true);
  const ogv = c.find((x) => /Port_of_New_Orleans|Port of New Orleans/.test(x.id));
  assert.strictEqual(ogv.rendition, "original"); // 640x640 original, no better transcode
  assert.strictEqual(ogv.licence.id, "pd");
  // legacy MPEG-4 .mov transcodes are never picked
  const r = commons.pickRendition({ url: "https://u/o.webm", width: 3840, height: 2160, derivatives: [{ src: "https://u/a.360p.mpeg4.mov", type: 'video/quicktime; codecs="mp4v"', transcodekey: "360p.mpeg4.mov", width: 640, height: 360 }, { src: "https://u/a.720p.vp9.webm", type: "video/webm", transcodekey: "720p.vp9.webm", width: 1280, height: 720 }] });
  assert.strictEqual(r.label, "720p.vp9.webm");
});

test("nasa video: search parse (public domain, poster) and asset manifest rendition", () => {
  const c = nasa.parseVideoResults(fx("nasa-video-earth-night.json"), "earth at night");
  assert.strictEqual(c.length, 5);
  assert.ok(c.every((x) => x.mediaType === "video" && x.licence.id === "pd" && /~large\.jpg$/.test(x.posterUrl) && /collection\.json$/.test(x.assetUrl)));
  const r = nasa.pickVideoRendition(fx("nasa-video-asset-blackmarble.json"));
  assert.strictEqual(r.label, "large");
  assert.match(r.url, /^https:\/\/images-assets\.nasa\.gov\/.*~large\.mp4$/);
  assert.strictEqual(nasa.pickVideoRendition(["http://x/a~small.mp4", "http://x/a~medium.mp4"]).label, "medium");
});

test("pickWindows: no cut inside, no black/fade frames, most active first", () => {
  const fps = 4;
  const times = Array.from({ length: 81 }, (_, i) => i / fps); // 20 s
  const luma = times.map((t) => (t < 1 ? 5 : t > 18 ? 128 * (20 - t) / 2 : 120));
  const diff = times.map((t) => (t >= 12 && t < 18 ? 6 : 1.5));
  const w = V.pickWindows({ duration: 20, times, luma, diff, cuts: [8, 12] }, { len: 6 });
  assert.ok(w.length >= 1);
  assert.ok(w[0].start >= 12 - 1e-6 && w[0].end <= 18.5, JSON.stringify(w[0])); // the active shot
  for (const x of w) {
    assert.ok(![8, 12].some((c) => c > x.start + 0.04 && c < x.end - 0.04), "no cut inside");
    assert.ok(x.start >= 1, "skips the black lead-in");
  }
  // a 3.5 s source still yields a (shorter) window; a 2 s one does not
  const short = (d) => V.pickWindows({ duration: d, times: times.filter((t) => t <= d), luma: times.filter((t) => t <= d).map(() => 100), diff: times.filter((t) => t <= d).map(() => 2), cuts: [] }, { len: 6 });
  assert.ok(short(3.5).length && short(3.5)[0].len >= 3);
  assert.strictEqual(short(2).length, 0);
  // night shot (dark mean, bright city lights) is not "black"; a truly black frame is
  const nt = times.slice(0, 41);
  const night = { duration: 10, times: nt, luma: nt.map(() => 14), diff: nt.map(() => 1), cuts: [] };
  assert.ok(V.pickWindows({ ...night, peak: nt.map(() => 180) }, { len: 6 }).length, "night lights pass");
  assert.strictEqual(V.pickWindows({ ...night, peak: nt.map(() => 20) }, { len: 6 }).length, 0, "uniform dark is black");
  // everything cut into 2 s shots -> nothing
  assert.strictEqual(V.pickWindows({ duration: 10, times: times.slice(0, 41), luma: times.slice(0, 41).map(() => 100), diff: times.slice(0, 41).map(() => 2), cuts: [2, 4, 6, 8] }, { len: 6 }).length, 0);
});

test("targetSize: 1080 when <= 1.5x upscale, 720 from 480p, none below", () => {
  assert.deepStrictEqual(V.targetSize(3840, 2160), { width: 1920, height: 1080 });
  assert.deepStrictEqual(V.targetSize(1280, 720), { width: 1920, height: 1080 });
  assert.deepStrictEqual(V.targetSize(854, 480), { width: 1280, height: 720 });
  assert.deepStrictEqual(V.targetSize(1440, 1080), { width: 1440, height: 1080 }); // 4:3 kept, not stretched
  assert.strictEqual(V.targetSize(640, 360), null);
});

test("synthetic clip: scene cut + black/fade detection, trimmed H.264 clip, poster and last frame", async () => {
  const s = await V.sampleFrames(CLIP);
  const cuts = await V.sceneCuts(CLIP);
  assert.ok(cuts.some((c) => Math.abs(c - 6) < 0.1), `cut at 6 s found (${cuts})`);
  const info = await V.probe(CLIP);
  const wins = V.pickWindows({ duration: info.duration, ...s, cuts }, { len: 6 });
  assert.ok(wins.length);
  for (const w of wins) {
    assert.ok(w.start >= 1 - 1e-6 && w.end <= 11 + 1e-6, `window ${w.start}-${w.end} avoids black and fade`);
    assert.ok(!(w.start < 6 - 0.04 && w.end > 6 + 0.04), `window ${w.start}-${w.end} does not cross the cut`);
  }
  const cacheDir = path.join(TMP, "cache1");
  const r = await V.processVideo({ id: "synthetic", fileUrl: CLIP }, { kind: "video", intent: "test pattern", duration: 5 }, { cacheDir, useVision: false });
  assert.ok(r.ok, JSON.stringify(r.why));
  const out = path.join(TMP, "out.mp4");
  fs.writeFileSync(out, r.mp4);
  const pr = spawnSync("ffprobe", ["-v", "error", "-show_entries", "stream=codec_type,codec_name,pix_fmt,width,height,r_frame_rate", "-show_entries", "format=duration", "-of", "json", out], { encoding: "utf8" });
  const j = JSON.parse(pr.stdout);
  assert.strictEqual(j.streams.length, 1, "video only, no audio");
  assert.deepStrictEqual([j.streams[0].codec_name, j.streams[0].pix_fmt, j.streams[0].width, j.streams[0].height, j.streams[0].r_frame_rate], ["h264", "yuv420p", 1920, 1080, "30/1"]);
  assert.ok(Math.abs(Number(j.format.duration) - r.meta.clipDur) < 0.05);
  assert.ok(r.meta.clipDur >= 3 && r.meta.clipDur <= 5.05);
  assert.ok(r.meta.trimIn >= 1 && r.meta.trimOut <= 11.01);
  assert.strictEqual(r.poster.subarray(0, 2).toString("hex"), "ffd8");
  assert.strictEqual(r.last.subarray(0, 2).toString("hex"), "ffd8");
  // second call is served from the processing cache
  const again = await V.processVideo({ id: "synthetic", fileUrl: CLIP }, { kind: "video", intent: "test pattern", duration: 5 }, { cacheDir, useVision: false });
  assert.strictEqual(again.hash, r.hash);
});

// ---------------------------------------------------------------- resolver + renderer contract
function fakeHttp() {
  return {
    stats: { requests: 0, cacheHits: 0 },
    getJson: async () => {
      throw new Error("no network in tests");
    },
    getBuffer: async (url) => {
      if (/poster/.test(url)) return POSTER;
      if (/still/.test(url)) return STILL;
      throw new Error(`no fixture for ${url}`);
    },
  };
}
function providers(order) {
  const vid = { source: "commons", via: "commons:search", id: "File:Synthetic.webm", title: "Synthetic", pageUrl: "https://commons.wikimedia.org/wiki/File:Synthetic.webm", fileUrl: CLIP, posterUrl: "https://files.example/poster.jpg", width: 1280, height: 720, duration: 12, mediaType: "video", author: "Jane Doe", licence: normalizeLicense("CC BY 4.0") };
  const still = { source: "commons", via: "commons:search", id: "File:Still.jpg", title: "Still", pageUrl: "https://commons.wikimedia.org/wiki/File:Still.jpg", fileUrl: "https://files.example/still.jpg", width: 1920, height: 1080, origWidth: 1920, origHeight: 1080, mediaType: "image", author: "Jane Doe", licence: normalizeLicense("CC BY-SA 4.0") };
  return {
    wikidata: { lookup: async () => null, filesForKind: () => [] },
    commons: {
      search: async (_h, q, o) => {
        order.push(`commons:${o.filetype}`);
        return o.filetype === "video" ? [vid] : [still];
      },
      files: async () => [],
      category: async () => [],
    },
    openverse: { search: async () => [] },
    nasa: { search: async () => [], searchVideo: async () => [] },
    illustrate: { illustrate: async () => null },
  };
}
function fakeGemini(framePass) {
  return {
    json: async (prompt, o = {}) => {
      if (/You write image search queries/.test(prompt)) return { queries: ["q1"], rubric: "shows it", nasaRelevant: false };
      const frames = /frames sampled from ONE video clip/.test(prompt);
      return { results: (o.images || []).map((_, k) => ({ i: k + 1, matches: true, confidence: 0.9, heavyText: frames && !framePass, focal: [0.1, 0.2, 0.6, 0.6], depicts: frames ? "test pattern frame" : "poster" })) };
    },
  };
}

test("resolve kind video: manifest entry satisfies compile + media layer + checkMedia", async () => {
  const cacheDir = path.join(TMP, "cache2");
  const order = [];
  const { manifest, report } = await resolveMedia([{ slot: "clip", kind: "video", intent: "test pattern moving", duration: 5 }], { cacheDir, http: fakeHttp(), providers: providers(order), gemini: fakeGemini(true) });
  const e = manifest.clip;
  assert.strictEqual(e.status, "ok");
  assert.strictEqual(e.kind, "video");
  assert.match(e.file, /\.mp4$/);
  for (const k of ["poster", "lastFrame"]) assert.ok(fs.existsSync(e[k]), `${k} exists`);
  assert.ok(e.clipDur >= 3 && e.clipDur <= 5.05);
  assert.deepStrictEqual([e.width, e.height], [1920, 1080]);
  assert.strictEqual(e.credit, "Video: Jane Doe / Wikimedia Commons · CC BY 4.0");
  assert.match(e.creditFull, /CC BY 4\.0/);
  assert.deepStrictEqual(e.focal, [0.1, 0.2, 0.6, 0.6]);
  assert.strictEqual(e.licence, "CC BY 4.0");
  assert.deepStrictEqual(order, ["commons:video"]);
  const side = JSON.parse(fs.readFileSync(path.join(cacheDir, e.sha.slice(0, 2), `${e.sha}.json`), "utf8"));
  for (const k of ["source", "pageUrl", "fileUrl", "author", "licence", "credit", "creditFull", "width", "height", "duration", "trimIn", "trimOut", "fps", "fetchedAt", "focal", "poster", "lastFrame"]) assert.ok(side[k] !== undefined && side[k] !== null, `sidecar.${k}`);
  assert.strictEqual(report.slots.clip.kind, "video");

  // renderer contract: slot props -> root media layer (LF photo, full-bleed) -> hard media gate
  const props = resolveSlots({ slot: "clip", card: false }, { clip: e }, new Set());
  assert.strictEqual(props.kind, "video");
  assert.strictEqual(props.clipDur, e.clipDur);
  assert.strictEqual(props.lastFrame, e.lastFrame);
  const scaffolds = [{ id: "a", t0: 0, t1: 8, modules: [{ id: "full", type: "photo", rect: [0, 0, 1920, 1080], props }] }];
  const media = buildMediaLayer({ scaffolds, events: [], sbScaffolds: [{}], wordTime: () => ({ start: 0 }) });
  assert.strictEqual(media.length, 1);
  const items = media[0].items;
  assert.strictEqual(items[0].kind, "video");
  assert.ok(items[0].dur <= e.clipDur && items[0].dur > e.clipDur - 0.1, "plays the whole clip");
  assert.strictEqual(items[1].kind, "img");
  assert.strictEqual(items[1].src, e.lastFrame, "then holds the last frame");
  assert.deepStrictEqual(checkMedia(media, ""), []);
});

test("resolve kind video: frames with burned-in text -> still fallback flagged fallbackFrom video", async () => {
  const order = [];
  const { manifest, report } = await resolveMedia([{ slot: "clip", kind: "video", intent: "test pattern moving" }], { cacheDir: path.join(TMP, "cache3"), http: fakeHttp(), providers: providers(order), gemini: fakeGemini(false) });
  const e = manifest.clip;
  assert.strictEqual(e.status, "ok");
  assert.strictEqual(e.kind, "image");
  assert.strictEqual(e.fallbackFrom, "video");
  assert.match(e.file, /\.jpg$/);
  assert.match(e.credit, /^Photo: /);
  assert.deepStrictEqual(order, ["commons:video", "commons:bitmap"]);
  const v = report.slots.clip.trace.find((t) => t.stage === "commons:video");
  assert.match(v.clipRejects[0].why.join(" "), /heavy text/);
  // compile: the manifest's kind wins over a storyboard that asked for video
  const props = resolveSlots({ slot: "clip", kind: "video" }, { clip: e }, new Set());
  assert.strictEqual(props.kind, "image");
  assert.strictEqual(props.fallbackFrom, "video");
});
