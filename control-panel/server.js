"use strict";

/**
 * Phase 6 control panel — plain Node http server, no framework, serving a
 * plain HTML/JS frontend from public/. See PHASE6-REPORT.md for what's real
 * vs. stubbed.
 */

const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");
const querystring = require("querystring");

const store = require("./lib/store");
const jobs = require("./lib/jobs");
const { newId, nowIso, insidePath, isSafeId } = require("./lib/util");
const renderEngine = require("./lib/renderEngine");
const carouselEngine = require("./lib/carouselEngine");
const oauthYoutube = require("./lib/oauthYoutube");
const publish = require("./lib/publish");
const voiceUpload = require("./lib/voiceUpload");
const topics = require("./lib/topics");

const HOST = process.env.HOST || "127.0.0.1";
const PORT = Number(process.env.PORT) || 4600;
const PUBLIC_DIR = path.join(__dirname, "public");
const RENDERS_DIR = path.join(__dirname, "data", "renders");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mp4": "video/mp4",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".wav": "audio/wav",
  ".md": "text/markdown; charset=utf-8",
  ".srt": "text/plain; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
};

function send(res, status, body, headers) {
  res.writeHead(status, { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", ...headers });
  res.end(body);
}

function sendJson(res, status, value) {
  send(res, status, JSON.stringify(value, null, 2), { "Content-Type": "application/json; charset=utf-8" });
}

function sendError(res, err) {
  const status = err.statusCode || 500;
  sendJson(res, status, { error: err.message || "internal error" });
}

function readBody(req, maxBytes) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > maxBytes) {
        req.destroy();
        reject(Object.assign(new Error("request body too large"), { statusCode: 413 }));
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

async function readJsonBody(req, maxBytes = 512 * 1024) {
  const buf = await readBody(req, maxBytes);
  if (!buf.length) return {};
  try {
    return JSON.parse(buf.toString("utf8"));
  } catch (_) {
    throw Object.assign(new Error("invalid JSON body"), { statusCode: 400 });
  }
}

function serveStatic(res, filePath) {
  const ext = path.extname(filePath);
  fs.readFile(filePath, (err, data) => {
    if (err) return sendJson(res, 404, { error: "not found" });
    send(res, 200, data, { "Content-Type": MIME[ext] || "application/octet-stream" });
  });
}

/** Serves a file with basic HTTP Range support, for <video> seeking. */
function serveMedia(req, res, filePath) {
  fs.stat(filePath, (err, stat) => {
    if (err) return sendJson(res, 404, { error: "not found" });
    const ext = path.extname(filePath);
    const contentType = MIME[ext] || "application/octet-stream";
    const range = req.headers.range;
    if (!range) {
      res.writeHead(200, { "Content-Type": contentType, "Content-Length": stat.size, "Accept-Ranges": "bytes" });
      fs.createReadStream(filePath).pipe(res);
      return;
    }
    const match = /bytes=(\d*)-(\d*)/.exec(range);
    const start = match[1] ? parseInt(match[1], 10) : 0;
    const end = match[2] ? parseInt(match[2], 10) : stat.size - 1;
    res.writeHead(206, {
      "Content-Type": contentType,
      "Content-Range": `bytes ${start}-${end}/${stat.size}`,
      "Accept-Ranges": "bytes",
      "Content-Length": end - start + 1,
    });
    fs.createReadStream(filePath, { start, end }).pipe(res);
  });
}

function runSummary(run) {
  const job = jobs.getJob(run.id);
  return {
    ...run,
    liveStatus: job ? job.status : run.status,
  };
}

/**
 * Per-pipeline FIFO queue, concurrency 1 each. Added after real usage showed multiple rapid
 * topic-calendar clicks launching several cs-explainer jobs at once -- each one loads F5-TTS
 * onto the GPU and runs a hardware-accelerated HyperFrames render, and this machine has a single
 * laptop GPU. Stacking those risks CUDA OOM / GPU-context contention, not just slowness. A
 * video run and a carousel run CAN still proceed concurrently (different queues, and the
 * carousel side is a plain Puppeteer/CPU render with no CUDA involvement) -- only two jobs of
 * the *same* pipeline type are serialized against each other.
 */
const pipelineQueues = { "cs-explainer": Promise.resolve(), carousel: Promise.resolve() };
const pipelineQueueDepth = { "cs-explainer": 0, carousel: 0 };

function startPipelineRun(pipeline, config) {
  const id = newId(pipeline === "cs-explainer" ? "cs" : pipeline === "longform" ? "lf" : "car");
  const createdAt = nowIso();
  const run = {
    id,
    pipeline,
    config,
    topic: config.topic || "",
    status: "queued",
    createdAt,
    startedAt: null,
    endedAt: null,
    result: null,
    review: null,
    error: null,
  };
  store.createRun(run);
  jobs.createJob(id, { pipeline, config });

  const finish = () => {
    const job = jobs.getJob(id);
    store.updateRun(id, {
      status: job.status,
      startedAt: job.startedAt ? new Date(job.startedAt).toISOString() : null,
      endedAt: job.endedAt ? new Date(job.endedAt).toISOString() : null,
      result: job.result,
      error: job.error,
    });
  };

  const runner = pipeline === "cs-explainer" ? renderEngine.runCsExplainerRender : pipeline === "longform" ? renderEngine.runLongformRender : carouselEngine.runCarouselRender;
  // long-form runs share the video (GPU) queue: F5-TTS + renders, one video job at a time
  const queueKey = pipelineQueues[pipeline] ? pipeline : "cs-explainer";
  const previous = pipelineQueues[queueKey];

  // Log the real queue position SYNCHRONOUSLY, right now, while the job is genuinely waiting --
  // not inside the .then() below, which only fires the instant it's this job's turn (i.e. right
  // as it's about to start, which would make "waiting" a lie shown for zero real wait time).
  pipelineQueueDepth[queueKey] += 1;
  if (pipelineQueueDepth[queueKey] > 1) {
    jobs.appendLog(
      id,
      "meta",
      `Queued behind ${pipelineQueueDepth[queueKey] - 1} other ${queueKey} job(s) (GPU-safety queue, concurrency 1 per pipeline -- prevents the CUDA out-of-memory failures real concurrent runs hit on this machine).`
    );
  }

  // One single chain: wait for the previous job of this pipeline type to finish, run this one,
  // then always call finish() (success or failure) -- and `pipelineQueues[queueKey]` is set to
  // this exact chain so the *next* queued job waits on this one the same way, regardless of
  // outcome (the .catch below makes the chain resolve, never reject, so it never breaks the
  // queue for subsequent jobs).
  const chain = previous
    .then(() => runner(id, config))
    .then(finish)
    .catch((err) => {
      jobs.appendLog(id, "stderr", `Unhandled runner error: ${err.message}`);
      jobs.setStatus(id, "failed", { error: err.message });
      finish();
    })
    .finally(() => {
      pipelineQueueDepth[queueKey] -= 1;
    });
  pipelineQueues[queueKey] = chain;

  return run;
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const { pathname } = url;
    const method = req.method;

    // ---- static frontend ----
    if (method === "GET" && pathname === "/") return serveStatic(res, path.join(PUBLIC_DIR, "index.html"));
    if (method === "GET" && (pathname === "/app.js" || pathname === "/styles.css")) {
      return serveStatic(res, path.join(PUBLIC_DIR, pathname.slice(1)));
    }

    // ---- run history + creation ----
    if (method === "GET" && pathname === "/api/runs") {
      return sendJson(res, 200, store.listRuns().map(runSummary));
    }
    if (method === "POST" && pathname === "/api/runs") {
      const body = await readJsonBody(req);
      if (!["cs-explainer", "carousel", "longform"].includes(body.pipeline)) {
        return sendJson(res, 400, { error: "pipeline must be 'cs-explainer', 'longform' or 'carousel'" });
      }
      const run = startPipelineRun(body.pipeline, body.config || {});
      return sendJson(res, 202, { ...run, streamUrl: `/api/runs/${run.id}/stream` });
    }

    // ---- 30-day topic calendar ----
    if (method === "GET" && pathname === "/api/topics") {
      // Compute each topic's real status from the actual run records server-side (not just
      // client-side after a browser tab watches both streams to completion) -- otherwise a
      // topic can look stuck on "running" forever after a page refresh/reopen even though both
      // jobs genuinely finished.
      const list = topics.listTopics().map((t) => {
        if (t.status !== "running" || !t.videoRunId || !t.carouselRunId) return t;
        const videoRun = store.getRun(t.videoRunId);
        const carouselRun = store.getRun(t.carouselRunId);
        const videoDone = videoRun && ["succeeded", "failed", "stubbed"].includes(videoRun.status);
        const carouselDone = carouselRun && ["succeeded", "failed", "stubbed"].includes(carouselRun.status);
        if (videoDone && carouselDone) {
          const bothOk = videoRun.status === "succeeded" && carouselRun.status === "succeeded";
          const patched = topics.updateTopic(t.id, { status: bothOk ? "done" : "pending" });
          return patched || t;
        }
        return t;
      });
      return sendJson(res, 200, list);
    }
    if (method === "POST" && pathname === "/api/topics/generate") {
      const body = await readJsonBody(req).catch(() => ({}));
      const count = Number(body.count) || 30;
      try {
        const list = await topics.generateTopicCalendar({ count, log: (m) => console.log(m) });
        return sendJson(res, 200, list);
      } catch (err) {
        return sendError(res, err);
      }
    }
    const topicRunMatch = pathname.match(/^\/api\/topics\/([^/]+)\/run$/);
    if (method === "POST" && topicRunMatch) {
      const topicId = topicRunMatch[1];
      if (!isSafeId(topicId)) return sendJson(res, 400, { error: "invalid topic id" });
      const topic = topics.getTopic(topicId);
      if (!topic) return sendJson(res, 404, { error: "topic not found" });

      const body = await readJsonBody(req).catch(() => ({}));
      const sharedConfig = {
        topic: topic.topic,
        lengthSeconds: Number(body.lengthSeconds) || 45,
        accentColor: body.accentColor || "#6ea8fe",
        brandHandle: body.brandHandle || "@example",
        ttsSpeed: Number(body.ttsSpeed) || 1.0,
        captionsOn: body.captionsOn !== undefined ? !!body.captionsOn : true,
        sfxOn: body.sfxOn !== undefined ? !!body.sfxOn : true,
        profile: ["DH", "LC", "DC", "BR", "BP"].includes(body.profile) ? body.profile : "auto",
      };

      const videoRun = startPipelineRun("cs-explainer", sharedConfig);
      const carouselRun = startPipelineRun("carousel", { topic: topic.topic, accentColor: sharedConfig.accentColor, brandHandle: body.brandHandle || "", profile: sharedConfig.profile });

      topics.updateTopic(topicId, {
        status: "running",
        videoRunId: videoRun.id,
        carouselRunId: carouselRun.id,
      });

      return sendJson(res, 202, {
        topicId,
        videoRun: { ...videoRun, streamUrl: `/api/runs/${videoRun.id}/stream` },
        carouselRun: { ...carouselRun, streamUrl: `/api/runs/${carouselRun.id}/stream` },
      });
    }

    const runMatch = pathname.match(/^\/api\/runs\/([^/]+)(?:\/(.*))?$/);
    if (runMatch) {
      const runId = runMatch[1];
      const sub = runMatch[2] || "";
      if (!isSafeId(runId)) return sendJson(res, 400, { error: "invalid run id" });

      if (method === "GET" && sub === "") {
        const run = store.getRun(runId);
        if (!run) return sendJson(res, 404, { error: "run not found" });
        const job = jobs.getJob(runId);
        return sendJson(res, 200, { ...runSummary(run), recentLogs: job ? job.logs.slice(-200) : [] });
      }
      if (method === "GET" && sub === "stream") {
        const ok = jobs.subscribe(runId, res);
        if (!ok) return sendJson(res, 404, { error: "job not found (server may have restarted)" });
        return;
      }
      if (method === "POST" && sub === "review") {
        const body = await readJsonBody(req);
        const review = {
          title: String(body.title || ""),
          caption: String(body.caption || ""),
          hashtags: String(body.hashtags || ""),
          updatedAt: nowIso(),
        };
        const run = store.updateRun(runId, { review });
        if (!run) return sendJson(res, 404, { error: "run not found" });
        return sendJson(res, 200, run);
      }
      const publishMatch = sub.match(/^publish\/(youtube|instagram)$/);
      if (method === "POST" && publishMatch) {
        const run = store.getRun(runId);
        if (!run) return sendJson(res, 404, { error: "run not found" });
        try {
          const result = publishMatch[1] === "youtube" ? publish.publishYoutube(runId, run.review) : publish.publishInstagram(runId, run.review);
          return sendJson(res, 200, result);
        } catch (err) {
          return sendError(res, err);
        }
      }
    }

    // ---- open a result's output folder in Windows Explorer (local-only tool, scoped to
    // this app's own renders directory so it can't be used to open arbitrary paths) ----
    if (method === "POST" && pathname === "/api/open-folder") {
      const body = await readJsonBody(req).catch(() => ({}));
      try {
        const target = insidePath(String(body.path || ""), RENDERS_DIR);
        if (!fs.existsSync(target)) return sendJson(res, 404, { error: "folder not found" });
        require("child_process").spawn("explorer.exe", [target], { detached: true, stdio: "ignore" }).unref();
        return sendJson(res, 200, { ok: true });
      } catch (err) {
        return sendError(res, err);
      }
    }

    // ---- media (rendered output) ----
    if (method === "GET" && pathname.startsWith("/media/")) {
      const rel = decodeURIComponent(pathname.slice("/media/".length));
      try {
        const filePath = insidePath(path.join(RENDERS_DIR, rel), RENDERS_DIR);
        return serveMedia(req, res, filePath);
      } catch (err) {
        return sendError(res, err);
      }
    }

    // ---- voice upload ----
    if (method === "POST" && pathname === "/api/voice/upload") {
      const filename = req.headers["x-filename"] || "reference.wav";
      const refTextHeader = req.headers["x-ref-text"] || "";
      const refText = refTextHeader ? decodeURIComponent(String(refTextHeader)) : "";
      const buf = await readBody(req, voiceUpload.MAX_UPLOAD_BYTES + 1024);
      try {
        const record = await voiceUpload.handleUpload(String(filename), buf, refText);
        return sendJson(res, 200, record);
      } catch (err) {
        return sendError(res, err);
      }
    }
    if (method === "GET" && pathname === "/api/voice/last") {
      return sendJson(res, 200, voiceUpload.lastUpload());
    }
    if (method === "GET" && pathname === "/api/voice/active-profile") {
      return sendJson(res, 200, voiceUpload.activeVoiceProfile());
    }

    // ---- YouTube OAuth reconnect flow (stubbed exchange, real flow shape) ----
    if (method === "GET" && pathname === "/api/oauth/youtube/status") {
      return sendJson(res, 200, oauthYoutube.status());
    }
    if (method === "GET" && pathname === "/api/oauth/youtube/connect") {
      const redirectTo = oauthYoutube.beginConnect();
      res.writeHead(302, { Location: redirectTo });
      return res.end();
    }
    if (method === "GET" && pathname === "/oauth/youtube/consent") {
      const state = url.searchParams.get("state") || "";
      return serveConsentPage(res, state);
    }
    if (method === "POST" && pathname === "/api/oauth/youtube/callback") {
      const buf = await readBody(req, 8 * 1024);
      const form = querystring.parse(buf.toString("utf8"));
      try {
        oauthYoutube.handleCallback(String(form.state || ""), `stub_code_${newId()}`);
        res.writeHead(302, { Location: "/?oauth=youtube_connected" });
        return res.end();
      } catch (err) {
        return sendError(res, err);
      }
    }
    if (method === "POST" && pathname === "/api/oauth/youtube/expire") {
      return sendJson(res, 200, oauthYoutube.forceExpireForTesting());
    }

    return sendJson(res, 404, { error: "not found" });
  } catch (err) {
    return sendError(res, err);
  }
});

function serveConsentPage(res, state) {
  const html = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>YouTube reconnect (stub)</title>
<style>
  body{font-family:system-ui,sans-serif;max-width:560px;margin:64px auto;padding:0 24px;color:#1a1a1a}
  .banner{background:#fff3cd;border:1px solid #ffe69c;border-radius:8px;padding:16px;margin-bottom:24px}
  button{background:#c4302b;color:#fff;border:0;border-radius:6px;padding:12px 20px;font-size:15px;cursor:pointer}
  code{background:#f1f1f1;padding:1px 5px;border-radius:4px}
</style></head>
<body>
  <div class="banner"><strong>PLACEHOLDER SCREEN</strong> — this simulates Google's OAuth consent screen.
  No real Google OAuth call happens here. This exists to prove the click&nbsp;&rarr;&nbsp;redirect&nbsp;&rarr;&nbsp;
  consent&nbsp;&rarr;&nbsp;callback&nbsp;&rarr;&nbsp;"reconnected" flow shape end-to-end, so real credentials can
  drop in later (see <code>lib/oauthYoutube.js</code>, function <code>exchangeCodeForToken</code>).</div>
  <h1>Reconnect YouTube (stub)</h1>
  <p>App: <strong>HyperFrames Control Panel (dev)</strong> is requesting stub access to your stub YouTube channel.</p>
  <form method="POST" action="/api/oauth/youtube/callback">
    <input type="hidden" name="state" value="${state.replace(/"/g, "&quot;")}">
    <button type="submit">Authorize (stub)</button>
  </form>
</body></html>`;
  send(res, 200, html, { "Content-Type": "text/html; charset=utf-8" });
}

server.listen(PORT, HOST, () => {
  console.log(`HyperFrames control panel: http://${HOST}:${PORT}`);
});
