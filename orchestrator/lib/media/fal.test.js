"use strict";

const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const fal = require("./fal");

// 1x1 PNG
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");

function tmp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "fal-test-"));
}

function res(status, body) {
  const text = typeof body === "string" ? body : JSON.stringify(body);
  return { ok: status >= 200 && status < 300, status, text: async () => text, json: async () => JSON.parse(text), arrayBuffer: async () => PNG };
}

/** Fake fal queue: records calls, returns IN_QUEUE once then COMPLETED. */
function fakeFetch({ result, failSubmit } = {}) {
  const calls = [];
  let polls = 0;
  const fn = async (url, init = {}) => {
    calls.push({ url, method: init.method || "GET", headers: init.headers || {}, body: init.body ? JSON.parse(init.body) : null });
    if (init.method === "POST") {
      if (failSubmit) return res(failSubmit, { detail: "bad" });
      return res(200, { request_id: "req1", status_url: "https://queue.fal.run/fal-ai/x/requests/req1/status", response_url: "https://queue.fal.run/fal-ai/x/requests/req1" });
    }
    if (url.endsWith("/status")) return res(200, { status: polls++ === 0 ? "IN_QUEUE" : "COMPLETED" });
    if (url.endsWith("/req1")) return res(200, result || { images: [{ url: "https://v3.fal.media/files/out.png", width: 1, height: 1 }], seed: 1 });
    if (url.startsWith("https://v3.fal.media/")) return res(200, "");
    return res(404, { detail: "not found" });
  };
  fn.calls = calls;
  return fn;
}

test("generateImage runs the queue flow: submit with the key, poll, fetch result, download, ledger", async () => {
  const dir = tmp();
  const f = fakeFetch();
  const ledger = [];
  const r = await fal.generateImage({ prompt: "a harbour at dawn with container cranes", slotId: "s1", outDir: path.join(dir, "out"), model: "fal-ai/flux/dev", cacheDir: path.join(dir, "cache"), fetch: f, key: "test-key", pollMs: 0, record: (x) => ledger.push(x) });
  const submit = f.calls[0];
  assert.strictEqual(submit.url, "https://queue.fal.run/fal-ai/flux/dev");
  assert.strictEqual(submit.method, "POST");
  assert.strictEqual(submit.headers.Authorization, "Key test-key");
  assert.deepStrictEqual(submit.body.image_size, { width: 1280, height: 720 });
  assert.ok(/Documentary editorial photograph/.test(submit.body.prompt));
  assert.ok(Number.isInteger(submit.body.seed));
  assert.strictEqual(f.calls.filter((c) => c.url.endsWith("/status")).length, 2);
  assert.ok(fs.existsSync(r.file));
  assert.strictEqual(path.basename(r.file), "s1.png");
  assert.strictEqual(r.cached, false);
  assert.strictEqual(r.cost, 0.025); // 1x1 px rounds up to 1 MP
  assert.deepStrictEqual(ledger.map((x) => [x.provider, x.model, x.cost, x.cached]), [["fal", "fal-ai/flux/dev", 0.025, false]]);
});

test("generateImage cache hit makes no network call and logs cost 0", async () => {
  const dir = tmp();
  const o = { prompt: "an empty port warehouse", slotId: "s2", model: "fal-ai/flux/schnell", cacheDir: path.join(dir, "cache"), key: "k", pollMs: 0 };
  const ledger = [];
  await fal.generateImage({ ...o, fetch: fakeFetch(), record: (x) => ledger.push(x) });
  const f2 = fakeFetch();
  const r = await fal.generateImage({ ...o, outDir: path.join(dir, "o2"), fetch: f2, record: (x) => ledger.push(x) });
  assert.strictEqual(f2.calls.length, 0);
  assert.strictEqual(r.cached, true);
  assert.strictEqual(r.cost, 0);
  assert.ok(fs.existsSync(r.file));
  assert.deepStrictEqual(ledger.map((x) => x.cached), [false, true]);
  // a different seed is a different image
  const f3 = fakeFetch();
  await fal.generateImage({ ...o, seed: 42, fetch: f3, record: () => {} });
  assert.ok(f3.calls.length > 0);
});

test("submit errors surface fal's message and are logged as failed", async () => {
  const dir = tmp();
  const ledger = [];
  await assert.rejects(
    fal.generateImage({ prompt: "a field", model: "fal-ai/flux/dev", cacheDir: dir, fetch: fakeFetch({ failSubmit: 422 }), key: "k", pollMs: 0, record: (x) => ledger.push(x) }),
    /fal submit 422: bad/
  );
  assert.strictEqual(ledger[0].ok, false);
  await assert.rejects(fal.runQueue("fal-ai/flux/dev", {}, { fetch: fakeFetch(), key: null, pollMs: 0 }), /FAL_KEY not set/);
});

test("removeBackground sends a data URI to BiRefNet and returns the cut-out PNG", async () => {
  const dir = tmp();
  const src = path.join(dir, "face.png");
  fs.writeFileSync(src, PNG);
  const f = fakeFetch({ result: { image: { url: "https://v3.fal.media/files/cut.png" } } });
  const ledger = [];
  const r = await fal.removeBackground({ file: src, outDir: path.join(dir, "o"), cacheDir: path.join(dir, "c"), fetch: f, key: "k", pollMs: 0, record: (x) => ledger.push(x) });
  assert.strictEqual(f.calls[0].url, "https://queue.fal.run/fal-ai/birefnet/v2");
  assert.ok(f.calls[0].body.image_url.startsWith("data:image/png;base64,"));
  assert.ok(fs.existsSync(r.file));
  assert.strictEqual(ledger[0].task, "media.cutout");
});

test("prices: per-megapixel models round up, Seedream is flat", () => {
  assert.strictEqual(fal.costOf("fal-ai/flux/dev", 1280, 720), 0.025);
  assert.strictEqual(fal.costOf("fal-ai/flux/dev", 1920, 1080), 0.075);
  assert.strictEqual(fal.costOf("fal-ai/flux/schnell", 1280, 720), 0.003);
  assert.strictEqual(fal.costOf("fal-ai/bytedance/seedream/v4/text-to-image", 1920, 1080), 0.03);
});

test("tiers pick the quality or the fast model", () => {
  assert.strictEqual(fal.modelForTier("quality"), process.env.FAL_IMAGE_MODEL || fal.DEFAULT_MODEL);
  assert.strictEqual(fal.modelForTier("montage"), process.env.FAL_IMAGE_MODEL_FAST || fal.DEFAULT_FAST_MODEL);
  assert.strictEqual(fal.modelForTier("draft"), fal.modelForTier("montage"));
});

test("photo prompt: documentary language, no text/logos/cartoons, anonymous people, generic scene", () => {
  const p = fal.buildPhotoPrompt({ scene: 'a bank branch with a sign reading "CLOSED"', mood: "tense" });
  assert.ok(/35mm lens/.test(p));
  assert.ok(/low-key light/.test(p));
  assert.ok(/No text of any kind/.test(p));
  assert.ok(/logos/.test(p));
  assert.ok(/Not an illustration, not a cartoon/.test(p));
  assert.ok(/no likeness of any real or famous person/.test(p));
  assert.ok(/not a record of a specific real news event/.test(p));
  assert.ok(!/"CLOSED"/.test(p), "quoted strings are unquoted so they are not rendered as lettering");
  assert.throws(() => fal.buildPhotoPrompt({ scene: "a portrait of the president" }), /forbidden/);
  assert.throws(() => fal.buildPhotoPrompt({ scene: "the central bank logo on a wall" }), /forbidden/);
  assert.throws(() => fal.buildPhotoPrompt({ scene: "" }), /needs a scene/);
  assert.ok(/uncanny/.test(fal.photoRubric("a harbour")));
});
