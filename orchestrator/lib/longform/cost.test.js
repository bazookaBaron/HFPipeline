"use strict";

// Cost controls (LONGFORM-V2-PLAN §9), offline: usage-ledger parsing and pricing (cached input, batch), the budget
// guard (80 % / 100 %, incremental ledger reads, final/cost.json), per-task thinking defaults, the Gemini Batch API
// client (coalescing, polling, resume from disk) and vision vetting limits. Every network call is a fake `fetch`
// or a fake Gemini client; no API key is used.

const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");

const M = require("../ai/models");
const BG = require("./budget");
const B = require("../ai/batch");
const { usageReport } = require("../../tools/gemini-usage");

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "lf-cost-"));
const ledgerAt = (name) => path.join(TMP, `${name}.jsonl`);
const write = (f, rows) => fs.appendFileSync(f, rows.map((r) => (typeof r === "string" ? r : JSON.stringify(r))).join("\n") + "\n");
const gem = (o) => ({ at: "2026-09-27T10:00:00Z", task: "longform.storyboard", model: "gemini-3.6-flash", in: 0, cachedIn: 0, out: 0, ...o });

test.after(() => {
  BG.reset();
  M.setLedger(null);
  fs.rmSync(TMP, { recursive: true, force: true });
});

test("ledger: torn / malformed lines are skipped; rows priced from tokens, cached share and batch discount", () => {
  const rows = M.parseLedger(['{"task":"a","model":"gemini-3.6-flash","in":1000000,"out":0}', "not json", '{"task":"b"', "", "[1,2]", '{"cost":0.03,"provider":"fal","task":"media.image"}'].join("\n"));
  assert.strictEqual(rows.length, 2);
  const std = M.PRICES["gemini-3.6-flash"];
  assert.strictEqual(M.costOf(gem({ in: 1e6 })), std.in);
  assert.strictEqual(M.costOf(gem({ out: 1e6 })), std.out);
  // half the input implicitly cached: that half at CACHED_FACTOR of the input price
  assert.ok(Math.abs(M.costOf(gem({ in: 1e6, cachedIn: 5e5 })) - std.in * (0.5 + 0.5 * M.CACHED_FACTOR)) < 1e-9);
  assert.ok(Math.abs(M.costOf(gem({ in: 1e6, batch: true })) - std.in * 0.5) < 1e-9);
  assert.strictEqual(M.costOf({ cost: 0.03 }), 0.03);
  assert.strictEqual(M.costOf(gem({ model: "gemini-3.1-flash-image" })), 0.067);
  assert.strictEqual(M.costOf(gem({ model: "models/gemini-3.1-pro-preview", in: 1e6 })), 2);
  assert.strictEqual(M.priceOf("some-future-flash-lite").in, M.PRICES[M.DEFAULTS.lite].in, "unknown ids price by tier name");
});

test("ledger: recordUsage writes cachedContentTokenCount, batch and the run / video / stage context", () => {
  const f = ledgerAt("record");
  M.setLedger(f);
  M.setRunContext({ run: "r1", video: "v1", stage: "storyboards" });
  try {
    M.recordUsage({ task: "longform.storyboard", model: "gemini-3.6-flash", usage: { promptTokenCount: 12000, cachedContentTokenCount: 9000, candidatesTokenCount: 3000, thoughtsTokenCount: 500 }, batch: true });
    M.recordCost({ task: "media.image", provider: "fal", model: "flux", cost: 0.003 });
  } finally {
    M.setRunContext({ run: "", video: "", stage: "" });
    M.setLedger(null);
  }
  const [a, b] = M.readLedger(f);
  assert.deepStrictEqual([a.in, a.cachedIn, a.out, a.thoughts, a.batch, a.run, a.video, a.stage], [12000, 9000, 3500, 500, true, "r1", "v1", "storyboards"]);
  assert.deepStrictEqual([b.cost, b.video, b.stage], [0.003, "v1", "storyboards"]);
  const rep = usageReport(M.readLedger(f));
  assert.strictEqual(rep.cachedShare, 0.75);
  assert.strictEqual(rep.gemini[0].batch, 1);
  assert.ok(rep.geminiUsd > 0 && rep.pricedUsd === 0.003);
  assert.strictEqual(usageReport(M.readLedger(f), { video: "other" }).geminiCalls, 0);
});

test("thinking defaults: low for repairs, rewrites, beats and queries; the model default for the outline and the cold open", () => {
  const low = { thinkingLevel: "low" };
  for (const t of ["script.repair", "longform.storyboard.repair", "longform.storyboard.scene", "longform.sceneRewrite", "longform.beats", "media.queries", "longform.edit", "longform.outline.repair", "longform.script"]) assert.deepStrictEqual(M.thinkingConfigFor(t, {}), low, t);
  for (const t of ["longform.outline", "longform.script.cold", "longform.storyboard", "media.vision"]) assert.strictEqual(M.thinkingConfigFor(t, {}), null, t);
  assert.deepStrictEqual(M.thinkingConfigFor("longform.beats", { GEMINI_THINKING_LONGFORM_BEATS: "minimal" }), { thinkingLevel: "minimal" });
  process.env.GEMINI_THINKING_SCRIPT_REPAIR = "default";
  try {
    assert.strictEqual(M.thinkingConfigFor("script.repair", {}), null, "env override");
  } finally {
    delete process.env.GEMINI_THINKING_SCRIPT_REPAIR;
  }
  // the long-form client still exports the same helper (older callers)
  assert.strictEqual(require("./gemini").thinkingConfigFor, M.thinkingConfigFor);
});

test("budget: ~$6 per 12 min scaled by minutes, floor, env overrides, off", () => {
  assert.strictEqual(BG.defaultBudget(12, {}), 6);
  assert.strictEqual(BG.defaultBudget(8, {}), 4);
  assert.strictEqual(BG.defaultBudget(2, {}), BG.FLOOR);
  assert.strictEqual(BG.defaultBudget(12, { LF_BUDGET_USD: "9.5" }), 9.5);
  assert.strictEqual(BG.defaultBudget(10, { LF_BUDGET_USD_PER_MIN: "0.3" }), 3);
  assert.strictEqual(BG.defaultBudget(12, { LF_BUDGET_USD: "off" }), null);
  assert.strictEqual(BG.resolveBudget("4", 12, {}), 4);
  assert.strictEqual(BG.resolveBudget("off", 12, {}), null);
  assert.strictEqual(BG.resolveBudget(undefined, 12, {}), 6);
  assert.throws(() => BG.parseBudget("lots"), /dollar amount/);
});

test("budget guard: this video's spend from the ledger (incremental, torn lines wait), 80 % tight, 100 % over", () => {
  const f = ledgerAt("guard");
  const std = M.PRICES["gemini-3.6-flash"];
  const $in = (usd) => Math.round((usd / std.in) * 1e6); // tokens that cost usd
  write(f, [gem({ video: "vA", run: "old", in: $in(2) }), gem({ video: "vB", in: $in(50) })]);
  const logs = [];
  const g = BG.createGuard({ budgetUsd: 5, video: "vA", run: "new", ledger: f, log: (m) => logs.push(m) });
  assert.strictEqual(g.check("x"), "normal");
  assert.ok(Math.abs(g.spent() - 2) < 1e-3, "another video's rows do not count; an earlier run of this video does");
  write(f, [gem({ video: "vA", run: "new", in: $in(2.2) })]);
  assert.strictEqual(g.check("x"), "tight");
  assert.match(logs.join("\n"), /cheaper tiers/);
  // a half-written line is not parsed until it is complete
  fs.appendFileSync(f, JSON.stringify(gem({ video: "vA", run: "new", in: $in(1) })).slice(0, 30));
  assert.strictEqual(g.check("x"), "tight");
  fs.appendFileSync(f, JSON.stringify(gem({ video: "vA", run: "new", in: $in(1) })).slice(30) + "\n");
  assert.strictEqual(g.check("longform.storyboard.scene"), "over");
  assert.deepStrictEqual([g.stopped().task, g.stopped().spentUsd >= 5], ["longform.storyboard.scene", true]);
  // run scope counts only this invocation
  const r = BG.createGuard({ budgetUsd: 5, video: "vA", run: "new", scope: "run", ledger: f });
  assert.ok(Math.abs(r.spent() - 3.2) < 1e-3);
  // no budget: tracked, never stops
  assert.strictEqual(BG.createGuard({ budgetUsd: null, video: "vB", run: "z", ledger: f }).check("x"), "normal");
});

test("budget guard via models.beforeCall: tight lowers repair tiers; over refuses the call as a fatal budget error", () => {
  let level = "normal";
  M.setSpendGuard({ check: () => level, describe: () => "$5 of $5" });
  try {
    M.beforeCall("longform.storyboard");
    assert.strictEqual(M.costMode(), "normal");
    level = "tight";
    M.beforeCall("longform.storyboard");
    assert.strictEqual(M.costMode(), "tight");
    assert.strictEqual(M.modelFor("longform.storyboard.repair"), M.DEFAULTS.lite);
    assert.strictEqual(M.modelFor("longform.outline.repair"), M.DEFAULTS.standard);
    assert.strictEqual(M.modelFor("longform.script"), M.DEFAULTS.pro, "first-pass writing keeps its tier");
    level = "over";
    assert.throws(() => M.beforeCall("script.repair"), (e) => e.budget && e.fatal && /budget exhausted/.test(e.message));
    assert.strictEqual(require("./storyboardLF").isFatal(Object.assign(new Error("x"), { budget: true })), true);
  } finally {
    M.setSpendGuard(null);
  }
  assert.strictEqual(M.costMode(), "normal");
});

test("budget run: start stamps run / video ids, finish writes final/cost.json with per-stage $ and a resume hint", () => {
  const f = ledgerAt("run");
  const out = path.join(TMP, "video");
  M.setLedger(f);
  const logs = [];
  try {
    BG.start({ out, minutes: 3, flag: "1", log: (m) => logs.push(m), ledger: f });
    assert.match(logs[0], /\$1\.00 for this video/);
    const video = BG.videoKey(out);
    assert.strictEqual(process.env.LF_VIDEO_ID, video);
    BG.stage("research");
    M.recordUsage({ task: "research.grounded", model: "gemini-3.6-flash", usage: { promptTokenCount: 200000, candidatesTokenCount: 20000 }, grounded: true });
    BG.stage("storyboards");
    M.recordUsage({ task: "longform.storyboard", model: "gemini-3.6-flash", usage: { promptTokenCount: 800000, cachedContentTokenCount: 600000, candidatesTokenCount: 200000 } });
    M.recordCost({ task: "media.image", provider: "fal", model: "flux", cost: 0.03 });
    assert.strictEqual(BG.optional(), true);
    M.beforeCall("longform.storyboard.scene"); // spend is now over $1
    assert.fail("expected a budget stop");
  } catch (err) {
    assert.ok(err.budget, err.message);
  } finally {
    M.setLedger(null);
  }
  assert.ok(BG.stopped());
  const rep = BG.finish("budget-stop");
  const disk = JSON.parse(fs.readFileSync(path.join(out, "final", "cost.json"), "utf-8"));
  assert.deepStrictEqual(disk.status, "budget-stop");
  assert.strictEqual(rep.video, BG.videoKey(out));
  assert.deepStrictEqual(Object.keys(disk.stages).sort(), ["research", "storyboards"]);
  assert.strictEqual(disk.stages.storyboards.pricedCalls, 1);
  assert.strictEqual(disk.stages.storyboards.cachedShare, 0.75);
  assert.ok(disk.spentUsd > 1 && disk.thisRunUsd === disk.spentUsd);
  assert.strictEqual(disk.stoppedAt.stage, "storyboards");
  assert.match(disk.resume, /--budget-usd 1\.5/);
  assert.ok(logs.some((l) => /^cost: \$/.test(l)) && logs.some((l) => /storyboards/.test(l)), "per-stage summary printed");
  BG.reset();
});

// ------------------------------------------------------------------------------------------ batch
/** a fake Batch API: records requests; the job is PENDING for `pendingPolls` polls, then SUCCEEDED */
function fakeBatchApi({ pendingPolls = 1, fail = false } = {}) {
  const calls = [];
  const jobs = {};
  let n = 0;
  const fetch = async (url, init = {}) => {
    calls.push({ url, method: init.method, body: init.body ? JSON.parse(init.body) : null, key: init.headers && init.headers["x-goog-api-key"] });
    const ok = (v) => ({ ok: true, status: 200, text: async () => JSON.stringify(v) });
    if (/:batchGenerateContent$/.test(url)) {
      const name = `batches/b${++n}`;
      jobs[name] = { reqs: calls[calls.length - 1].body.batch.input_config.requests.requests, polls: 0 };
      return ok({ name, metadata: { state: "BATCH_STATE_PENDING" } });
    }
    const name = url.split("/v1beta/")[1];
    const j = jobs[name];
    if (!j) return { ok: false, status: 404, text: async () => "no such batch" };
    if (j.polls++ < pendingPolls) return ok({ name, metadata: { state: "BATCH_STATE_RUNNING" } });
    if (fail) return ok({ name, done: true, metadata: { state: "BATCH_STATE_FAILED" }, error: { message: "boom" } });
    return ok({
      name,
      done: true,
      metadata: { state: "BATCH_STATE_SUCCEEDED" },
      response: {
        inlinedResponses: {
          inlinedResponses: j.reqs.map((r) => ({
            metadata: r.metadata,
            response: { candidates: [{ content: { parts: [{ text: JSON.stringify({ echo: r.request.contents[0].parts[0].text }) }] } }], usageMetadata: { promptTokenCount: 1000, cachedContentTokenCount: 400, candidatesTokenCount: 100 } },
          })),
        },
      },
    });
  };
  return { fetch, calls, jobs };
}

const body = (text) => ({ contents: [{ parts: [{ text }] }], generationConfig: { responseMimeType: "application/json" } });

test("batch: parallel requests coalesce into ONE job, polled to completion, usage recorded at batch price, answers kept on disk", async () => {
  const dir = path.join(TMP, "batch1");
  const api = fakeBatchApi({ pendingPolls: 2 });
  const f = ledgerAt("batch1");
  M.setLedger(f);
  const sleeps = [];
  const b = B.createBatcher({ apiKey: "test-key", stateDir: dir, fetch: api.fetch, windowMs: 5, sleep: async (ms) => sleeps.push(ms), pollMs: [10, 40] });
  let r;
  try {
    r = await Promise.all([b.submit({ model: "gemini-3.6-flash", request: body("a"), task: "research.grounded" }), b.submit({ model: "gemini-3.6-flash", request: body("b"), task: "research.distil" })]);
  } finally {
    M.setLedger(null);
  }
  const posts = api.calls.filter((c) => c.method === "POST");
  assert.strictEqual(posts.length, 1);
  assert.strictEqual(posts[0].body.batch.input_config.requests.requests.length, 2);
  assert.ok(api.calls.every((c) => c.key === "test-key" && !c.url.includes("test-key")), "key only in the header");
  assert.deepStrictEqual(r.map((x) => JSON.parse(x.candidates[0].content.parts[0].text).echo), ["a", "b"]);
  assert.deepStrictEqual(sleeps, [10, 15], "backs off between polls");
  const rows = M.readLedger(f);
  assert.deepStrictEqual(rows.map((x) => [x.task, x.batch, x.cachedIn]), [["research.grounded", true, 400], ["research.distil", true, 400]]);
  assert.strictEqual(fs.readdirSync(path.join(dir, "jobs")).length, 0, "finished job state removed");
  // a re-run is answered from disk: no network at all
  const quiet = B.createBatcher({ apiKey: "k", stateDir: dir, fetch: async () => assert.fail("no fetch expected"), windowMs: 1 });
  const again = await quiet.submit({ model: "gemini-3.6-flash", request: body("a"), task: "research.grounded" });
  assert.deepStrictEqual(again, r[0]);
});

test("batch: a killed run resumes polling its pending job instead of submitting (and paying) again", async (t) => {
  const dir = path.join(TMP, "batch2");
  const api = fakeBatchApi({ pendingPolls: 99 });
  M.setLedger(ledgerAt("batch2"));
  t.after(() => M.setLedger(null));
  const first = B.createBatcher({ apiKey: "k", stateDir: dir, fetch: api.fetch, windowMs: 1, sleep: () => new Promise(() => {}), pollMs: [10, 10] });
  first.submit({ model: "gemini-3.6-flash", request: body("slow"), task: "longform.script" });
  await new Promise((r) => setTimeout(r, 30)); // submitted, now "killed" mid-poll
  assert.strictEqual(fs.readdirSync(path.join(dir, "jobs")).length, 1);
  api.jobs["batches/b1"].polls = 99; // the job finishes while nobody is watching
  const second = B.createBatcher({ apiKey: "k", stateDir: dir, fetch: api.fetch, windowMs: 1, sleep: async () => {}, pollMs: [10, 10] });
  const res = await second.submit({ model: "gemini-3.6-flash", request: body("slow"), task: "longform.script" });
  assert.strictEqual(JSON.parse(res.candidates[0].content.parts[0].text).echo, "slow");
  assert.strictEqual(api.calls.filter((c) => c.method === "POST").length, 1, "submitted once across both runs");
});

test("batch: a failed job rejects its callers; the long-form client then asks interactively. Repairs never go to the batch", async () => {
  const dir = path.join(TMP, "batch3");
  const api = fakeBatchApi({ pendingPolls: 0, fail: true });
  const b = B.createBatcher({ apiKey: "k", stateDir: dir, fetch: api.fetch, windowMs: 1, sleep: async () => {} });
  await assert.rejects(b.submit({ model: "m", request: body("x"), task: "longform.outline" }), (e) => e.batchFailed);

  process.env.GEMINI_API_KEY = "fake-key-for-tests";
  const interactive = [];
  const fetch = async (url, init) => {
    if (/:generateContent$/.test(url)) {
      interactive.push(url);
      return { ok: true, status: 200, text: async () => JSON.stringify({ candidates: [{ content: { parts: [{ text: '{"ok":1}' }] } }], usageMetadata: { promptTokenCount: 10 } }) };
    }
    return api.fetch(url, init);
  };
  M.setLedger(ledgerAt("client"));
  try {
    const g = require("./gemini").loadGeminiRest({ batch: true, batchDir: path.join(TMP, "batch4"), fetch, maxAttempts: 1 });
    assert.deepStrictEqual(await g.json("outline please", { task: "longform.outline" }), { ok: 1 });
    assert.strictEqual(interactive.length, 1, "fell back to an interactive call after the batch failed");
    assert.deepStrictEqual(await g.json("fix it", { task: "script.repair" }), { ok: 1 });
    assert.strictEqual(api.calls.filter((c) => c.method === "POST").length, 2, "only the outline was submitted as a batch");
    assert.strictEqual(interactive.length, 2);
    // over budget: refused before any request
    M.setSpendGuard({ check: () => "over" });
    const before = interactive.length;
    await assert.rejects(g.json("more", { task: "script.repair" }), (e) => e.budget);
    assert.strictEqual(interactive.length, before);
  } finally {
    M.setSpendGuard(null);
    M.setLedger(null);
    delete process.env.GEMINI_API_KEY;
  }
  assert.ok(B.batchTasks().has("longform.storyboard") && !B.batchTasks().has("longform.storyboard.repair"));
});

// ------------------------------------------------------------------------------------------ vision
test("vision: static rules first (slot last); metadata / size pre-filter before any call; at most 3 calls per slot", async () => {
  const V = require("../media/vision");
  const p = V.buildVisionPrompt({ kind: "portrait", entity: "Vijay Mallya", intent: "portrait photo" }, "r", 2);
  assert.ok(p.startsWith(V.VISION_STATIC));
  assert.match(p.slice(V.VISION_STATIC.length), /Slot kind: portrait[\s\S]*face is clearly visible[\s\S]*There are 2 images/);

  const intent = { slot: "hero", kind: "photo", intent: "Air Deccan aircraft", size: "card" };
  assert.deepStrictEqual(V.preVisionProblems({ width: 1600, height: 1000, title: "Air Deccan ATR at Bangalore.jpg" }, intent), []);
  assert.match(V.preVisionProblems({ width: 400, height: 300, title: "x.jpg" }, intent).join(), /width 400/);
  assert.match(V.preVisionProblems({ width: 1600, height: 1000, title: "Air Deccan logo.svg" }, intent).join(), /title says "logo"/);
  assert.deepStrictEqual(V.preVisionProblems({ width: 1600, height: 1000, title: "Flag of India.svg" }, { ...intent, intent: "the flag of India waving" }), [], "wanted by the intent");

  let calls = 0;
  const gemini = { json: async (prompt, o) => (calls++, { results: o.images.map((_, k) => ({ i: k + 1, matches: true, confidence: 0.9, focal: [0, 0, 1, 1] })) }) };
  const item = (i, extra = {}) => ({ hash: `h${i}-${Math.random()}`, thumb: Buffer.from("x"), cand: { width: 1600, height: 1000, title: `photo ${i}.jpg`, ...extra } });
  // everything pre-filtered: no call
  const pre = await V.vet([item(0, { width: 200, height: 100 }), item(1, { title: "Air Deccan logo.png" })], intent, "r", { gemini });
  assert.strictEqual(calls, 0);
  assert.ok(pre.every((v) => v.preFiltered && V.verdictProblems(v, "photo").length));
  // a mixed batch: only the eligible one is sent
  const mixed = await V.vet([item(2), item(3, { width: 100, height: 100 })], intent, "r", { gemini });
  assert.strictEqual(calls, 1);
  assert.deepStrictEqual(mixed.map((v) => !!v.preFiltered), [false, true]);
  await V.vet([item(4)], intent, "r", { gemini });
  await V.vet([item(5)], intent, "r", { gemini });
  await assert.rejects(V.vet([item(6)], intent, "r", { gemini }), (e) => e.visionCap && /max 3/.test(e.message));
  assert.strictEqual(calls, 3);
  await V.vet([item(7)], { ...intent, slot: "other" }, "r", { gemini });
  await V.vet([item(8)], { ...intent, kind: "video" }, "r", { gemini });
  assert.strictEqual(calls, 5, "another slot, or the same slot's other media kind, has its own budget");
});
