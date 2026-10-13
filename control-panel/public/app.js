const $ = (id) => document.getElementById(id);

let currentRunId = null;
let currentEventSource = null;
let currentPipeline = "cs-explainer";
let currentPhaseMax = 0;
let v3LogTimer = null;
let v3LogLength = 0;
let v3DetailedSse = false;
let v3LastCompletedStage = "";
let lastActivityAt = null;
let currentRunStatus = "idle";
const SELECTED_RUN_KEY = "hf-selected-run-id";

const PHASE_LABELS = {
  "cs-explainer": ["Storyboard", "Voice synthesis", "Compose & layout", "Check", "Render & master", "Final QA"],
  carousel: ["Content (Gemini)", "Write content", "Render slides"],
  longform: ["Research", "Outline", "Script", "Storyboards", "Media", "Render chapters", "Stitch", "Music + master", "Gates", "Package", "Thumbnails"],
};
// make-longform.js prints one machine line per stage event: "@@lf {stage, status, detail}"
const LF_STAGES = ["research", "outline", "script", "storyboards", "media", "render", "stitch", "master", "gates", "package", "thumbnail"];

/** Real progress lines from the orchestrators are deliberately sent on stderr (stdout is
 * reserved for the final machine-readable result line), so stream name alone is NOT a
 * reliable error signal -- classify by content instead: red only for genuine failure text,
 * green for genuine success/completion text, blue for everything else. */
function classifyLogLine(entry) {
  const text = entry.line || "";
  if (/\berror\b|\bfailed\b|\bexception\b|traceback|✗/i.test(text)) return "log-line-error";
  if (/\bsucceeded\b|\bpassed\b|render complete|✓|check passed/i.test(text)) return "log-line-success";
  if (entry.stream === "meta") return "log-line-meta";
  return "log-line-info";
}

function fmtTime(iso) {
  if (!iso) return "-";
  try { return new Date(iso).toLocaleTimeString(); } catch (_) { return iso; }
}

async function api(path, options) {
  const res = await fetch(path, options);
  let data = null;
  try { data = await res.json(); } catch (_) { /* no body */ }
  if (!res.ok) {
    const message = (data && data.error) || `HTTP ${res.status}`;
    const err = new Error(message);
    err.status = res.status;
    throw err;
  }
  return data;
}

function collectConfig(form) {
  const config = {};
  for (const el of form.elements) {
    if (!el.name) continue;
    if (el.type === "checkbox") config[el.name] = el.checked;
    else if (el.type === "radio") { if (el.checked) config[el.name] = el.value; }
    else config[el.name] = el.value;
  }
  return config;
}

function setStatusPill(status) {
  currentRunStatus = status;
  const pill = $("run-status");
  pill.textContent = status;
  pill.className = `status-pill status-${status}`;
  updateRunActivity();
}

function updateRunActivity() {
  const el = $("run-activity");
  if (!["queued", "running"].includes(currentRunStatus)) { el.textContent = ""; return; }
  const labels = PHASE_LABELS[currentPipeline] || PHASE_LABELS["cs-explainer"];
  const stage = currentRunStatus === "queued" ? "Queued" : labels[Math.max(0, currentPhaseMax - 1)] || "Starting";
  const age = lastActivityAt == null ? "waiting for first report" :
    `last reported ${Math.max(0, Math.floor((Date.now() - lastActivityAt) / 60_000))} min ago`;
  el.textContent = `${stage} · ${age}`;
}

function clearLog() {
  $("log-console").textContent = "";
}

function renderPhaseTimeline(activeStep, failed) {
  const labels = PHASE_LABELS[currentPipeline] || PHASE_LABELS["cs-explainer"];
  const el = $("phase-timeline");
  el.innerHTML = "";
  labels.forEach((label, i) => {
    const stepNum = i + 1;
    const div = document.createElement("div");
    div.className = "phase-step";
    if (failed && stepNum === activeStep) div.classList.add("phase-failed");
    else if (stepNum < activeStep || (stepNum === activeStep && failed === "done")) div.classList.add("phase-done");
    else if (stepNum === activeStep) div.classList.add("phase-active");
    div.textContent = `${stepNum}. ${label}`;
    el.appendChild(div);
  });
}

function resetPhaseTimeline(pipeline) {
  currentPipeline = pipeline || "cs-explainer";
  currentPhaseMax = 0;
  renderPhaseTimeline(1, false);
  updateRunActivity();
}

/** Parses the real "Step X/Y: ..." prefixes both orchestrators log at each phase boundary and
 * advances the visible timeline accordingly -- never goes backwards within one run. */
function updatePhaseFromLine(text) {
  if (currentPipeline === "cs-explainer") {
    const stage = text.match(/^\[(?:generate-video-v3|make-video)\] stage: (.*)$/);
    if (stage) {
      const name = stage[1];
      const step = /^storyboard/.test(name) ? 1 : /^voice/.test(name) ? 2 :
        /^compose/.test(name) ? 3 : /^hyperframes check/.test(name) ? 4 :
        /^(render|audio\/video master)/.test(name) ? 5 : /^final QA/.test(name) ? 6 : 0;
      if (step > currentPhaseMax) {
        currentPhaseMax = step;
        renderPhaseTimeline(step, false);
      }
      return;
    }
    const v3 = text.match(/^\[generate-video-v3\] (storyboard attempt|voice lock acquired|waiting for the voice lock|reused voice for|pace:|speed |composition ->|true peak )/);
    const step = !v3 ? 0 :
      v3[1] === "storyboard attempt" ? 1 :
      ["voice lock acquired", "waiting for the voice lock", "reused voice for"].includes(v3[1]) ? 2 :
      ["pace:", "speed ", "composition ->"].includes(v3[1]) ? 3 : 5;
    if (step > currentPhaseMax) {
      currentPhaseMax = step;
      renderPhaseTimeline(step, false);
    }
  }
  const lf = text.match(/^@@lf (\{.*\})$/);
  if (lf) {
    let ev = null;
    try { ev = JSON.parse(lf[1]); } catch (_) { return; }
    const idx = LF_STAGES.indexOf(ev.stage) + 1;
    if (ev.status === "fail") { renderPhaseTimeline(Math.max(idx, currentPhaseMax || 1), true); return; }
    if (idx < 1) return;
    const step = ev.status === "done" || ev.status === "skip" ? idx + 1 : idx;
    if (step > currentPhaseMax) {
      currentPhaseMax = Math.min(step, LF_STAGES.length);
      renderPhaseTimeline(currentPhaseMax, ev.stage === "package" && ev.status === "done" ? "done" : false);
    }
    return;
  }
  const m = text.match(/Step (\d+)\/(\d+):/);
  if (!m) return;
  const step = Number(m[1]);
  if (step > currentPhaseMax) {
    currentPhaseMax = step;
    renderPhaseTimeline(step, false);
  }
}

function appendLog(entry) {
  const el = $("log-console");
  const line = document.createElement("div");
  const stamp = entry.t == null ? "saved log" : new Date(entry.t).toLocaleTimeString();
  const lfm = (entry.line || "").match(/^@@lf (\{.*\})$/);
  let shown = entry.line;
  if (lfm) {
    try {
      const ev = JSON.parse(lfm[1]);
      shown = `STAGE ${ev.stage} ${ev.status}${ev.section ? ` [${ev.section}]` : ""}${ev.detail ? `: ${ev.detail}` : ""}`;
    } catch (_) { /* keep raw */ }
  }
  line.textContent = `[${stamp}] ${entry.stream}: ${shown}`;
  const cls = lfm && /"status":"(done|skip)"/.test(entry.line) ? "log-line-success" : classifyLogLine(entry);
  line.className = cls;
  el.appendChild(line);
  el.scrollTop = el.scrollHeight;

  if (entry.t != null && Number.isFinite(Number(entry.t))) {
    lastActivityAt = Math.max(lastActivityAt || 0, Number(entry.t));
    updateRunActivity();
  }

  updatePhaseFromLine(entry.line || "");
  if (cls === "log-line-error") {
    renderPhaseTimeline(currentPhaseMax || 1, true);
  } else if (/\brender complete\b/i.test(entry.line || "")) {
    const totalSteps = (PHASE_LABELS[currentPipeline] || PHASE_LABELS["cs-explainer"]).length;
    currentPhaseMax = totalSteps;
    renderPhaseTimeline(totalSteps, "done");
  }
}

function showOutputFolder(folderPath) {
  const wrap = $("output-folder");
  if (!folderPath) { wrap.hidden = true; return; }
  wrap.hidden = false;
  $("output-folder-path").textContent = folderPath;
  $("output-folder-open").onclick = async () => {
    try {
      await api("/api/open-folder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: folderPath }),
      });
    } catch (err) {
      appendLog({ t: Date.now(), stream: "stderr", line: `Could not open folder: ${err.message}` });
    }
  };
}

function dirnameOf(p) {
  const norm = p.replace(/\//g, "\\");
  const idx = norm.lastIndexOf("\\");
  return idx === -1 ? norm : norm.slice(0, idx);
}

function showResult(result) {
  const area = $("preview-area");
  const video = $("preview-video");
  const gallery = $("preview-gallery");
  const empty = $("preview-empty");
  area.hidden = false;
  video.hidden = true;
  gallery.hidden = true;
  empty.hidden = true;
  gallery.innerHTML = "";
  gallery.classList.remove("preview-thumbs");
  const links = $("preview-links");
  links.innerHTML = "";
  links.hidden = true;
  if (result && Array.isArray(result.links) && result.links.length) {
    for (const l of result.links) {
      const a = document.createElement("a");
      a.href = l.url;
      a.target = "_blank";
      a.textContent = l.label;
      links.appendChild(a);
    }
    links.hidden = false;
  }
  if (result && result.type === "video" && result.mediaUrl) {
    video.src = result.mediaUrl + `?t=${Date.now()}`;
    video.hidden = false;
    // long-form: the three YouTube thumbnail variants (final/thumbnail-{a,b,c}.png), click to open full size
    if (Array.isArray(result.thumbnails) && result.thumbnails.length) {
      gallery.classList.add("preview-thumbs");
      for (const t of result.thumbnails) {
        const a = document.createElement("a");
        a.href = t.url;
        a.target = "_blank";
        a.title = t.label;
        const img = document.createElement("img");
        img.src = t.url + `?t=${Date.now()}`;
        img.alt = t.label;
        a.appendChild(img);
        const cap = document.createElement("span");
        cap.textContent = t.label;
        a.appendChild(cap);
        gallery.appendChild(a);
      }
      gallery.hidden = false;
    }
    showOutputFolder(result.folder || (result.path ? dirnameOf(result.path) : null));
  } else if (result && result.type === "image-set" && result.images && result.images.length) {
    for (const url of result.images) {
      const img = document.createElement("img");
      img.src = url + `?t=${Date.now()}`;
      img.alt = url;
      gallery.appendChild(img);
    }
    gallery.hidden = false;
    showOutputFolder(result.path || null);
  } else {
    empty.hidden = false;
    showOutputFolder(null);
  }
}

function stopV3LogPolling() {
  if (v3LogTimer) clearInterval(v3LogTimer);
  v3LogTimer = null;
  v3LogLength = 0;
  v3DetailedSse = false;
  v3LastCompletedStage = "";
}

// Older in-flight v3 jobs write detailed progress only to this existing render log.
// New jobs stream the same lines via SSE; stop polling as soon as those arrive.
function pollV3Log(runId) {
  if (v3DetailedSse || currentRunId !== runId) return;
  fetch(`/media/${encodeURIComponent(runId)}.mp4.log`, { cache: "no-store" })
    .then((res) => res.ok ? res.text() : "")
    .then((body) => {
      if (v3DetailedSse || currentRunId !== runId || !body) return;
      if (body.length < v3LogLength) v3LogLength = 0;
      const fresh = body.slice(v3LogLength);
      v3LogLength = body.length;
      for (const line of fresh.split(/\r?\n/)) {
        if (line.trim()) appendLog({ t: null, stream: "generator", line });
      }
    })
    .catch(() => { /* The render log may not exist until the process starts. */ });
  fetch(`/media/${encodeURIComponent(runId)}.mp4.metrics.json`, { cache: "no-store" })
    .then((res) => res.ok ? res.json() : null)
    .then((data) => {
      if (!data || currentRunId !== runId || v3DetailedSse) return;
      const stages = data.stages || [];
      const last = stages[stages.length - 1];
      if (!last || last.stage === v3LastCompletedStage) return;
      v3LastCompletedStage = last.stage;
      const next = { script: 2, voice: 3, compose: 4, check: 5, render: 5, post: 6 }[last.stage];
      if (next && next > currentPhaseMax) {
        currentPhaseMax = next;
        renderPhaseTimeline(next, false);
      }
      const endedAt = new Date(data.startedAt).getTime() + last.startMs + last.wallMs;
      appendLog({ t: endedAt, stream: "meta", line: `${last.stage} completed in ${(last.wallMs / 1000).toFixed(1)}s${next ? "; next stage started or pending" : ""}.` });
    })
    .catch(() => { /* Stage metrics may not exist until the first phase completes. */ });
}

function attachStream(runId, streamUrl, pipeline) {
  if (currentEventSource) currentEventSource.close();
  stopV3LogPolling();
  currentRunId = runId;
  lastActivityAt = null;
  sessionStorage.setItem(SELECTED_RUN_KEY, runId);
  clearLog();
  resetPhaseTimeline(pipeline);
  showOutputFolder(null);
  setStatusPill("running");
  const es = new EventSource(streamUrl);
  currentEventSource = es;
  es.addEventListener("log", (evt) => {
    const entry = JSON.parse(evt.data);
    if (pipeline === "cs-explainer" && /^\[generate-video-v3\]/.test(entry.line || "")) {
      v3DetailedSse = true;
      if (v3LogTimer) clearInterval(v3LogTimer);
      v3LogTimer = null;
    }
    appendLog(entry);
  });
  if (pipeline === "cs-explainer") {
    pollV3Log(runId);
    v3LogTimer = setInterval(() => pollV3Log(runId), 5000);
  }
  es.addEventListener("status", (evt) => {
    const data = JSON.parse(evt.data);
    setStatusPill(data.status);
    if (["succeeded", "failed", "stubbed"].includes(data.status)) {
      es.close();
      stopV3LogPolling();
      const totalSteps = (PHASE_LABELS[currentPipeline] || PHASE_LABELS["cs-explainer"]).length;
      if (data.status === "succeeded") {
        currentPhaseMax = totalSteps;
        renderPhaseTimeline(totalSteps, "done");
      } else if (data.status === "failed") {
        renderPhaseTimeline(currentPhaseMax || 1, true);
      }
    if (data.result) showResult(data.result);
      if (data.status === "succeeded") openReviewPanel(runId, null, data.result);
    loadHistory();
    loadTopics();
    loadLongCalendar();
    }
  });
  es.onerror = () => {
    // EventSource auto-retries; if the job already ended server-side the
    // connection closes cleanly via res.end(), so this only fires on a real
    // drop. Leave status as-is; the browser will keep trying to reconnect.
  };
}

async function submitRun(pipeline, config) {
  currentRunId = null;
  $("preview-area").hidden = true;
  $("review-panel").hidden = true;
  try {
    const run = await api("/api/runs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pipeline, config }),
    });
    currentRunId = run.id;
    attachStream(run.id, run.streamUrl, pipeline);
    loadHistory();
  } catch (err) {
    setStatusPill("failed");
    appendLog({ t: Date.now(), stream: "stderr", line: `Failed to start run: ${err.message}` });
  }
}

function wireForm(formId) {
  const form = $(formId);
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const config = collectConfig(form);
    // Format switch: "Long 16:9" runs the long-form orchestrator (make-longform.js) instead
    const pipeline = form.dataset.pipeline === "cs-explainer" && config.format === "long" ? "longform" : form.dataset.pipeline;
    submitRun(pipeline, config);
  });
  const sync = () => {
    const long = !!form.querySelector('input[name="format"][value="long"]:checked');
    form.querySelectorAll("[data-format]").forEach((el) => { el.hidden = (el.dataset.format === "long") !== long; });
  };
  form.querySelectorAll('input[name="format"]').forEach((r) => r.addEventListener("change", sync));
  sync();
}

// ---- Review & publish ----
function openReviewPanel(runId, review, result) {
  currentRunId = runId;
  $("review-panel").hidden = false;
  $("review-run-id").textContent = runId;
  $("review-title").value = (review && review.title) || "";
  $("review-caption").value = (review && review.caption) || "";
  $("review-hashtags").value = (review && review.hashtags) || "";
  $("publish-result").textContent = "";
  $("publish-cover").hidden = true;
  $("send-youtube").hidden = true;
  $("send-instagram").hidden = true;
  $("rearm-instagram").hidden = true;
  $("publish-youtube").hidden = result && result.type === "image-set";
}

/** Reopen a past run from history: repopulate preview + review panel from stored state. */
async function openRun(runId) {
  try {
    const run = await api(`/api/runs/${runId}`);
    currentRunId = run.id;
    sessionStorage.setItem(SELECTED_RUN_KEY, run.id);
    if (["queued", "running"].includes(run.liveStatus || run.status)) {
      attachStream(run.id, `/api/runs/${run.id}/stream`, run.pipeline);
      return;
    }
    if (currentEventSource) { currentEventSource.close(); currentEventSource = null; }
    stopV3LogPolling();
    lastActivityAt = null;
    currentPipeline = run.pipeline;
    setStatusPill(run.liveStatus || run.status);
    clearLog();
    for (const entry of run.recentLogs || []) appendLog(entry);
    if (run.result) showResult(run.result);
    else { $("preview-area").hidden = true; }
    if (run.status === "succeeded") {
      openReviewPanel(run.id, run.review, run.result);
    } else {
      $("review-panel").hidden = true;
    }
  } catch (err) {
    appendLog({ t: Date.now(), stream: "stderr", line: `Failed to load run ${runId}: ${err.message}` });
  }
}

async function saveReview() {
  if (!currentRunId) return;
  const payload = {
    title: $("review-title").value,
    caption: $("review-caption").value,
    hashtags: $("review-hashtags").value,
  };
  try {
    await api(`/api/runs/${currentRunId}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    $("publish-result").textContent = "Saved.";
  } catch (err) {
    $("publish-result").textContent = `Save failed: ${err.message}`;
  }
}

async function doPublish(platform) {
  if (!currentRunId) return;
  const runId = currentRunId;
  $("publish-result").textContent = `Preparing ${platform} description and tags…`;
  try {
    const prepared = await api(`/api/runs/${runId}/prepare/${platform}`, { method: "POST" });
    if (currentRunId !== runId) return;
    if (!$("review-title").value.trim()) $("review-title").value = prepared.metadata.title;
    if (!$("review-caption").value.trim()) $("review-caption").value = prepared.metadata.description;
    if (!$("review-hashtags").value.trim()) $("review-hashtags").value = prepared.metadata.tags.map((tag) => `#${tag.replace(/\s+/g, "")}`).join(" ");
    // Covers are generated for package audit but are not sent to either platform.
    $("publish-cover").hidden = true;
    const uncertain = prepared.publication?.state === "share-unknown" || prepared.publication?.state === "uploading-unknown";
    const complete = prepared.publication?.state === "complete";
    $("send-youtube").hidden = platform !== "youtube" || uncertain || complete;
    $("send-instagram").hidden = platform !== "instagram" || uncertain || complete;
    $("rearm-instagram").hidden = platform !== "instagram" || prepared.publication?.state !== "share-unknown";
    $("publish-result").textContent = uncertain
      ? "Previous upload outcome is uncertain. Check the account first. If you removed the post, use the explicit retry button."
      : prepared.publication?.state === "complete" ? `Already published: ${prepared.publication.url || prepared.publication.message || platform}`
      : "Review the description and tags, then choose the separate upload/publish button. No custom thumbnail is sent.";
  } catch (err) {
    if (currentRunId === runId) $("publish-result").textContent = err.status === 404 && err.message === "not found"
      ? "The running control-panel server is older than this page. Restart the server to enable publishing preparation."
      : `${platform}: ${err.message}`;
  }
}

async function restoreSelectedRun() {
  try {
    const runs = await api("/api/runs");
    const saved = sessionStorage.getItem(SELECTED_RUN_KEY);
    const selected = runs.find((run) => run.id === saved);
    const active = runs.find((run) => ["queued", "running"].includes(run.liveStatus || run.status));
    const target = selected || active;
    if (target && !currentRunId) await openRun(target.id);
  } catch (_) { /* History still exposes runs when restoration is unavailable. */ }
}

async function sendPrepared(platform) {
  if (!currentRunId) return;
  const runId = currentRunId;
  const button = $(platform === "youtube" ? "send-youtube" : "send-instagram");
  button.disabled = true;
  let stageTicker = null;
  try {
    let expectedAccount = "";
    if (platform === "instagram") {
      const session = await api("/api/instagram/session");
      if (!session.signedIn || !session.username) throw new Error("Sign in via Connect Instagram first");
      expectedAccount = session.username;
    }
    const warning = platform === "youtube"
      ? "Upload this video as PRIVATE to your connected YouTube channel, without a custom thumbnail?"
      : `Publish this as a regular PUBLIC 9:16 Reel on @${expectedAccount}, without a custom cover? This is not a Trial Reel.`;
    if (!window.confirm(warning)) return;
    $("publish-result").textContent = `Sending to ${platform}… Do not retry if the connection drops; check the account first.`;
    if (platform === "instagram") {
      stageTicker = setInterval(async () => {
        try {
          const progress = await api(`/api/runs/${runId}/publish/instagram/status`);
          if (currentRunId === runId && progress.stage !== "prepared") $("publish-result").textContent = `Instagram: ${progress.stage.replace(/-/g, " ")}…`;
        } catch (_) { /* the publish request reports actionable errors */ }
      }, 2000);
    }
    await api(`/api/runs/${runId}/review`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: $("review-title").value, caption: $("review-caption").value, hashtags: $("review-hashtags").value }) });
    const result = await api(`/api/runs/${runId}/publish/${platform}`, { method: "POST", headers: { "X-HF-Action": "publish", "Content-Type": "application/json" }, body: JSON.stringify({ expectedAccount }) });
    if (currentRunId !== runId) return;
    $("publish-result").textContent = result.url ? `Uploaded privately: ${result.url}` : result.message || `Instagram reported Share; verify the profile.`;
    button.hidden = true;
  } catch (err) {
    if (currentRunId === runId) $("publish-result").textContent = `${platform} publishing failed or is uncertain: ${err.message}`;
  } finally { if (stageTicker) clearInterval(stageTicker); button.disabled = false; }
}

async function rearmInstagram() {
  if (!currentRunId) return;
  const runId = currentRunId;
  if (!window.confirm("Only continue if you checked the Instagram account and removed the previous upload. Clear the duplicate-prevention guard and try again?")) return;
  const button = $("rearm-instagram");
  button.disabled = true;
  try {
    await api(`/api/runs/${runId}/publish/instagram/rearm`, { method: "POST", headers: { "X-HF-Action": "rearm", "Content-Type": "application/json" }, body: JSON.stringify({ confirmedRemoved: true }) });
    if (currentRunId === runId) await doPublish("instagram");
  } catch (err) {
    if (currentRunId === runId) $("publish-result").textContent = `Instagram retry not enabled: ${err.message}`;
  } finally { button.disabled = false; }
}

// ---- History ----
async function loadHistory() {
  const body = $("history-body");
  try {
    const allRuns = await api("/api/runs");
    $("history-updated").textContent = `Updated ${new Date().toLocaleTimeString()}`;
    const filter = $("history-filter").value;
    const runs = allRuns.filter((run) => {
      const status = run.liveStatus || run.status;
      if (filter === "active") return status === "queued" || status === "running";
      if (filter === "completed") return status === "succeeded";
      if (filter === "failed") return ["failed", "interrupted", "stubbed"].includes(status);
      return true;
    });
    if (!runs.length) {
      body.innerHTML = `<tr><td colspan="7" class="muted">No matching jobs.</td></tr>`;
      return;
    }
    body.innerHTML = "";
    for (const run of runs) {
      const tr = document.createElement("tr");
      const resultLabel = run.result && run.result.mediaUrl
        ? `<a href="${run.result.mediaUrl}" target="_blank">view</a>`
        : run.result && run.result.images && run.result.images.length
        ? `<a href="${run.result.images[0]}" target="_blank">${run.result.images.length} slides</a>`
        : run.result && run.result.stubbed ? "stubbed" : "-";
      const publicationLabel = Object.entries(run.publications || {}).map(([platform, item]) => item.url
        ? `<a href="${esc(item.url)}" target="_blank" rel="noopener">${esc(platform)} uploaded</a>`
        : `${esc(platform)}: ${esc(item.state || "unknown")}`).join(" · ");
      const folderPath = run.result && run.result.path
        ? (run.result.type === "video" ? dirnameOf(run.result.path) : run.result.path) : null;
      const ready = run.status === "succeeded" && !!folderPath;
      tr.innerHTML = `<td><code>${esc(run.id)}</code></td><td>${esc(run.pipeline)}</td><td>${esc(run.topic || "")}</td>` +
        `<td>${esc(run.liveStatus || run.status)}</td><td>${fmtTime(run.createdAt)}</td><td>${resultLabel}${publicationLabel ? `<br>${publicationLabel}` : ""}</td>` +
        `<td class="history-actions"><button type="button" data-act="open">Preview</button>` +
        `${folderPath ? '<button type="button" data-act="folder">Open folder</button>' : ""}` +
        `${ready && run.result.type === "video" ? '<button type="button" data-act="youtube">Prepare YT post</button>' : ""}` +
        `${ready ? '<button type="button" data-act="instagram">Prepare IG post</button>' : ""}</td>`;
      tr.style.cursor = "pointer";
      tr.title = "Click to reopen this run's preview and review panel";
      tr.addEventListener("click", (e) => {
        if (e.target.tagName === "A" || e.target.tagName === "BUTTON") return;
        openRun(run.id);
      });
      tr.querySelectorAll("button[data-act]").forEach((button) => button.addEventListener("click", async () => {
        const action = button.dataset.act;
        if (action === "open") return openRun(run.id);
        if (action === "folder") {
          try {
            await api("/api/open-folder", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ path: folderPath }) });
          } catch (err) { appendLog({ t: Date.now(), stream: "stderr", line: `Could not open folder: ${err.message}` }); }
          return;
        }
        await openRun(run.id);
        $("review-panel").scrollIntoView({ behavior: "smooth", block: "start" });
        doPublish(action);
      }));
      body.appendChild(tr);
    }
  } catch (err) {
    body.innerHTML = `<tr><td colspan="7" class="muted">Failed to load: ${esc(err.message)}</td></tr>`;
  }
}

// ---- YouTube reconnect ----
async function refreshYoutubeStatus() {
  const el = $("youtube-status");
  try {
    const status = await api("/api/oauth/youtube/status");
    if (status.stub) {
      el.textContent = "Not connected: the running server only has a simulated YouTube token. Restart the server, configure real OAuth, then reconnect.";
    } else if (!status.connected) {
      el.textContent = status.configured ? "YouTube not connected." : "YouTube credentials not configured locally.";
    } else if (status.expired) {
      el.textContent = `YouTube token expired at ${fmtTime(status.expiresAt)}; refresh will run on upload.`;
    } else {
      el.textContent = `YouTube connected since ${fmtTime(status.connectedAt)}.`;
    }
  } catch (err) {
    el.textContent = `Status check failed: ${err.message}`;
  }
}

// ---- Voice upload ----
async function uploadVoice(file) {
  const el = $("voice-status");
  const refText = $("voice-ref-text").value.trim();
  if (!refText) {
    el.textContent = "Upload failed: enter the reference transcript first (the exact words spoken in the clip).";
    return;
  }
  el.textContent = "Uploading…";
  try {
    const res = await fetch("/api/voice/upload", {
      method: "POST",
      headers: {
        "Content-Type": file.type || "application/octet-stream",
        "X-Filename": file.name,
        "X-Ref-Text": encodeURIComponent(refText),
      },
      body: file,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    const duration = data.durationSeconds != null ? `${data.durationSeconds.toFixed(1)}s` : "unknown length";
    el.textContent = `Active voice: ${data.filename} (${duration}) — ${data.trimMessage} Every new CS-explainer video now uses this voice.`;
  } catch (err) {
    el.textContent = `Upload failed: ${err.message}`;
  }
}

// ---- 30-day topic calendar ----
function renderTopics(list) {
  const el = $("topics-list");
  if (!list || !list.length) {
    el.innerHTML = '<p class="muted">No topic calendar yet -- click "Generate 30 topics".</p>';
    return;
  }
  el.innerHTML = "";
  list.forEach((t) => {
    const row = document.createElement("div");
    row.className = "topic-row";
    row.dataset.topicId = t.id;
    const videoStatus = t.videoStatus || "not-started";
    const carouselStatus = t.carouselStatus || "not-started";
    const videoBusy = videoStatus === "queued" || videoStatus === "running";
    const carouselBusy = carouselStatus === "queued" || carouselStatus === "running";
    row.innerHTML = `
      <div class="topic-day">Day ${esc(t.day)}<br>${esc(t.date)}</div>
      <div class="topic-main">
        <div class="topic-title">${esc(t.topic)}</div>
        <div class="topic-meta">${esc(t.category)} · Reel: ${esc(videoStatus)} · Carousel: ${esc(carouselStatus)}</div>
        <div class="topic-actions">
          <button type="button" data-pipeline="cs-explainer" ${videoBusy ? "disabled" : ""}>${t.videoRunId ? "Rerun reel" : "Make reel"}</button>
          <button type="button" data-pipeline="carousel" ${carouselBusy ? "disabled" : ""}>${t.carouselRunId ? "Rerun carousel" : "Make carousel"}</button>
        </div>
      </div>
      <div class="topic-status status-${esc(t.status)}">${esc(t.status)}</div>
    `;
    row.querySelectorAll("button[data-pipeline]").forEach((button) => button.addEventListener("click", () => runTopic(t.id, button.dataset.pipeline, button)));
    el.appendChild(row);
  });
}

async function loadTopics() {
  try {
    const list = await api("/api/topics");
    renderTopics(list);
    $("topics-updated").textContent = `Updated ${new Date().toLocaleTimeString()}`;
  } catch (err) {
    $("topics-updated").textContent = "Refresh failed";
    $("topics-list").innerHTML = `<p class="muted">Could not load topics: ${err.message}</p>`;
  }
}

async function generateTopics() {
  const btn = $("topics-generate-btn");
  const status = $("topics-generate-status");
  btn.disabled = true;
  status.textContent = "Calling Gemini for a real 30-topic calendar (a few seconds)...";
  try {
    const list = await api("/api/topics/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ count: 30 }),
    });
    status.textContent = `Generated ${list.length} topics.`;
    renderTopics(list);
  } catch (err) {
    status.textContent = `Failed: ${err.message}`;
  } finally {
    btn.disabled = false;
  }
}

/** Watches a run's status via its own short-lived EventSource. */
function watchRunUntilDone(streamUrl) {
  return new Promise((resolve) => {
    const es = new EventSource(streamUrl);
    let finished = false;
    es.addEventListener("status", (evt) => {
      const data = JSON.parse(evt.data);
      if (["succeeded", "failed", "stubbed"].includes(data.status) && !finished) {
        finished = true;
        es.close();
        resolve(data.status);
      }
    });
    es.onerror = () => {
      if (!finished) {
        finished = true;
        es.close();
        resolve("failed");
      }
    };
  });
}

async function runTopic(topicId, pipeline, button) {
  button.disabled = true;
  try {
    const { run } = await api(`/api/topics/${topicId}/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pipeline }),
    });
    currentRunId = run.id;
    attachStream(run.id, run.streamUrl, pipeline);
    loadTopics();
    loadHistory();
  } catch (err) {
    $("history-updated").textContent = "Refresh failed";
    button.disabled = false;
    appendLog({ t: Date.now(), stream: "stderr", line: `Failed to start topic run: ${err.message}` });
  }
}

// ---- long-form (16:9) finance calendar ----
const LF_CAT_LABELS = {
  "business-model": "Business model",
  "collapse-turnaround": "Collapse / turnaround",
  "country-economics": "Country economics",
  "sectors-commodities": "Sectors & commodities",
  "money-systems": "Money systems",
};

function esc(value) {
  return String(value == null ? "" : value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function lfWeekday(iso) {
  try { return new Date(`${iso}T00:00:00Z`).toLocaleDateString(undefined, { weekday: "short", timeZone: "UTC" }); } catch (_) { return ""; }
}

function renderLongCalendar(cal) {
  const el = $("lf-cal-list");
  const schedule = (cal && cal.schedule) || [];
  if (!schedule.length) {
    el.innerHTML = '<p class="muted">No long-form calendar yet -- click "Generate calendar".</p>';
    return;
  }
  el.innerHTML = "";
  schedule.forEach((t) => {
    const row = document.createElement("div");
    const muted = t.status === "done" || t.status === "skipped";
    row.className = `topic-row lf-row${t.status === "running" ? " topic-running" : ""}${muted ? " lf-muted" : ""}`;
    row.dataset.itemId = t.id;
    const busy = t.status === "running";
    row.innerHTML = `
      <div class="topic-day">${esc(lfWeekday(t.date))}<br>${esc(t.date)}</div>
      <div class="topic-main">
        <div class="topic-title">${esc(t.topic)}</div>
        <div class="lf-angle">${esc(t.angle)}</div>
        <div class="topic-meta">${esc(LF_CAT_LABELS[t.category] || t.category)}${t.region ? " · " + esc(t.region) : ""}${t.entities && t.entities.length ? " · " + esc(t.entities.join(", ")) : ""}${t.whyNow ? " · why now: " + esc(t.whyNow) : ""}${t.runId ? " · run: " + esc(t.runId) : ""}</div>
        <div class="lf-actions">
          <button type="button" data-act="run" ${busy ? "disabled" : ""}>Make video</button>
          ${t.status === "done" ? '<button type="button" class="quiet" data-act="planned">Reopen</button>' : `<button type="button" class="quiet" data-act="done" ${busy ? "disabled" : ""}>Mark done</button>`}
          ${t.status === "skipped" ? '<button type="button" class="quiet" data-act="planned">Unskip</button>' : `<button type="button" class="quiet" data-act="skipped" ${busy ? "disabled" : ""}>Skip</button>`}
          <button type="button" class="quiet" data-act="regenerate" ${busy ? "disabled" : ""}>Regenerate</button>
        </div>
      </div>
      <div class="topic-status status-${esc(t.status)}">${esc(t.status)}</div>
    `;
    row.querySelectorAll("button[data-act]").forEach((btn) => btn.addEventListener("click", () => longItemAction(t, btn.dataset.act, btn)));
    el.appendChild(row);
  });
}

async function loadLongCalendar() {
  try {
    renderLongCalendar(await api("/api/topics-long"));
  } catch (err) {
    $("lf-cal-list").innerHTML = `<p class="muted">Could not load the long-form calendar: ${esc(err.message)}</p>`;
  }
}

function syncLongGenerateLabel() {
  const weeks = $("lf-cal-weeks").value;
  $("lf-cal-generate-btn").textContent = `Generate calendar (${weeks} week${weeks === "1" ? "" : "s"})`;
}

async function generateLongCalendar() {
  const btn = $("lf-cal-generate-btn");
  const status = $("lf-cal-status");
  const weeks = Number($("lf-cal-weeks").value) || 4;
  const days = [...document.querySelectorAll(".lf-cal-days input:checked")].map((i) => i.value);
  if (!days.length) { status.textContent = "Pick at least one publish day."; return; }
  btn.disabled = true;
  status.textContent = `Calling Gemini for ${weeks * days.length} long-form topics (can take up to a minute)...`;
  try {
    const cal = await api("/api/topics-long/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ weeks, days }),
    });
    status.textContent = `Planned ${cal.schedule.filter((t) => t.status === "planned").length} topics.`;
    renderLongCalendar(cal);
  } catch (err) {
    status.textContent = `Failed: ${err.message}`;
  } finally {
    btn.disabled = false;
  }
}

async function longItemAction(item, act, btn) {
  const status = $("lf-cal-status");
  btn.disabled = true;
  try {
    if (act === "run") {
      const minutes = Number($("lf-cal-minutes").value) || 10;
      const { run } = await api(`/api/topics-long/${item.id}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ minutes, musicBed: true }),
      });
      // reuse the Long 16:9 run flow: live log + per-stage progress in the Live run panel
      currentRunId = run.id;
      $("preview-area").hidden = true;
      $("review-panel").hidden = true;
      attachStream(run.id, run.streamUrl, "longform");
      loadHistory();
      loadLongCalendar();
      watchRunUntilDone(run.streamUrl).then(() => loadLongCalendar());
      return;
    }
    if (act === "regenerate") {
      status.textContent = `Regenerating the ${item.date} topic...`;
      await api(`/api/topics-long/${item.id}/regenerate`, { method: "POST" });
      status.textContent = `Replaced the ${item.date} topic.`;
    } else {
      await api(`/api/topics-long/${item.id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: act }),
      });
    }
    loadLongCalendar();
  } catch (err) {
    status.textContent = `Failed: ${err.message}`;
    btn.disabled = false;
  }
}

// ---- wire everything up ----
wireForm("form-cs-explainer");
wireForm("form-carousel");
$("save-review").addEventListener("click", saveReview);
$("publish-youtube").addEventListener("click", () => doPublish("youtube"));
$("publish-instagram").addEventListener("click", () => doPublish("instagram"));
$("send-youtube").addEventListener("click", () => sendPrepared("youtube"));
$("send-instagram").addEventListener("click", () => sendPrepared("instagram"));
$("rearm-instagram").addEventListener("click", rearmInstagram);
$("youtube-connect").addEventListener("click", () => { window.location.href = "/api/oauth/youtube/connect"; });
$("instagram-connect").addEventListener("click", async () => { try { const result = await api("/api/instagram/connect", { method: "POST", headers: { "X-HF-Action": "connect" } }); alert(result.message); } catch (err) { alert(err.message); } });
$("voice-upload-btn").addEventListener("click", () => {
  const file = $("voice-file").files[0];
  if (!file) { $("voice-status").textContent = "Choose a reference clip first."; return; }
  uploadVoice(file);
});
$("topics-generate-btn").addEventListener("click", generateTopics);
$("history-filter").addEventListener("change", loadHistory);
$("history-refresh").addEventListener("click", () => { loadHistory(); loadTopics(); loadLongCalendar(); });
$("lf-cal-generate-btn").addEventListener("click", generateLongCalendar);
$("lf-cal-weeks").addEventListener("change", syncLongGenerateLabel);
loadLongCalendar();

loadHistory();
restoreSelectedRun();
loadTopics();
refreshYoutubeStatus();
resetPhaseTimeline("cs-explainer");

// SSE gives immediate updates for the selected run; polling keeps every other row
// accurate across page changes, dropped connections, and server restarts.
setInterval(() => {
  if (document.visibilityState !== "visible") return;
  updateRunActivity();
  loadHistory();
  loadTopics();
  loadLongCalendar();
}, 8000);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") { loadHistory(); loadTopics(); loadLongCalendar(); }
});

if (new URLSearchParams(location.search).get("oauth") === "youtube_connected") {
  refreshYoutubeStatus();
}
