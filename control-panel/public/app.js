const $ = (id) => document.getElementById(id);

let currentRunId = null;
let currentEventSource = null;
let currentPipeline = "cs-explainer";
let currentPhaseMax = 0;

const PHASE_LABELS = {
  "cs-explainer": ["Script (Gemini)", "Voice synthesis", "Anchor timing", "Compose", "Render"],
  carousel: ["Content (Gemini)", "Write content", "Render slides"],
  longform: ["Research", "Outline", "Script", "Storyboards", "Media", "Render chapters", "Stitch", "Music + master", "Gates", "Package"],
};
// make-longform.js prints one machine line per stage event: "@@lf {stage, status, detail}"
const LF_STAGES = ["research", "outline", "script", "storyboards", "media", "render", "stitch", "master", "gates", "package"];

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
  const pill = $("run-status");
  pill.textContent = status;
  pill.className = `status-pill status-${status}`;
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
}

/** Parses the real "Step X/Y: ..." prefixes both orchestrators log at each phase boundary and
 * advances the visible timeline accordingly -- never goes backwards within one run. */
function updatePhaseFromLine(text) {
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
  const stamp = new Date(entry.t).toLocaleTimeString();
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

function attachStream(runId, streamUrl, pipeline) {
  if (currentEventSource) currentEventSource.close();
  clearLog();
  resetPhaseTimeline(pipeline);
  showOutputFolder(null);
  setStatusPill("running");
  const es = new EventSource(streamUrl);
  currentEventSource = es;
  es.addEventListener("log", (evt) => appendLog(JSON.parse(evt.data)));
  es.addEventListener("status", (evt) => {
    const data = JSON.parse(evt.data);
    setStatusPill(data.status);
    if (["succeeded", "failed", "stubbed"].includes(data.status)) {
      es.close();
      const totalSteps = (PHASE_LABELS[currentPipeline] || PHASE_LABELS["cs-explainer"]).length;
      if (data.status === "succeeded") {
        currentPhaseMax = totalSteps;
        renderPhaseTimeline(totalSteps, "done");
      } else if (data.status === "failed") {
        renderPhaseTimeline(currentPhaseMax || 1, true);
      }
      if (data.result) showResult(data.result);
      if (data.status === "succeeded") openReviewPanel(runId);
      loadHistory();
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
function openReviewPanel(runId, review) {
  currentRunId = runId;
  $("review-panel").hidden = false;
  $("review-run-id").textContent = runId;
  $("review-title").value = (review && review.title) || "";
  $("review-caption").value = (review && review.caption) || "";
  $("review-hashtags").value = (review && review.hashtags) || "";
  $("publish-result").textContent = "";
}

/** Reopen a past run from history: repopulate preview + review panel from stored state. */
async function openRun(runId) {
  try {
    const run = await api(`/api/runs/${runId}`);
    currentRunId = run.id;
    setStatusPill(run.liveStatus || run.status);
    clearLog();
    for (const entry of run.recentLogs || []) appendLog(entry);
    if (run.result) showResult(run.result);
    else { $("preview-area").hidden = true; }
    if (["succeeded", "failed", "stubbed"].includes(run.status)) {
      openReviewPanel(run.id, run.review);
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
  $("publish-result").textContent = `Requesting ${platform} publish…`;
  try {
    const result = await api(`/api/runs/${currentRunId}/publish/${platform}`, { method: "POST" });
    $("publish-result").textContent = `Published: ${JSON.stringify(result)}`;
  } catch (err) {
    $("publish-result").textContent = `${platform}: ${err.message}`;
  }
}

// ---- History ----
async function loadHistory() {
  const body = $("history-body");
  try {
    const runs = await api("/api/runs");
    if (!runs.length) {
      body.innerHTML = `<tr><td colspan="6" class="muted">No runs yet.</td></tr>`;
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
      tr.innerHTML = `<td><code>${run.id}</code></td><td>${run.pipeline}</td><td>${run.topic || ""}</td>` +
        `<td>${run.liveStatus || run.status}</td><td>${fmtTime(run.createdAt)}</td><td>${resultLabel}</td>`;
      tr.style.cursor = "pointer";
      tr.title = "Click to reopen this run's preview and review panel";
      tr.addEventListener("click", (e) => {
        if (e.target.tagName === "A") return; // let result links open normally
        openRun(run.id);
      });
      body.appendChild(tr);
    }
  } catch (err) {
    body.innerHTML = `<tr><td colspan="6" class="muted">Failed to load: ${err.message}</td></tr>`;
  }
}

// ---- YouTube reconnect ----
async function refreshYoutubeStatus() {
  const el = $("youtube-status");
  try {
    const status = await api("/api/oauth/youtube/status");
    if (!status.connected) {
      el.textContent = "Not connected (stub).";
    } else if (status.expired) {
      el.textContent = `Token expired at ${fmtTime(status.expiresAt)} — reconnect needed (stub).`;
    } else {
      el.textContent = `Connected (stub) since ${fmtTime(status.connectedAt)}, expires ${fmtTime(status.expiresAt)}.`;
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
    row.className = `topic-row${t.status === "running" ? " topic-running" : ""}`;
    row.dataset.topicId = t.id;
    row.innerHTML = `
      <div class="topic-day">Day ${t.day}<br>${t.date}</div>
      <div class="topic-main">
        <div class="topic-title">${t.topic}</div>
        <div class="topic-meta">${t.category}${t.videoRunId ? " · video: " + t.videoRunId : ""}${t.carouselRunId ? " · carousel: " + t.carouselRunId : ""}</div>
      </div>
      <div class="topic-status status-${t.status}">${t.status}</div>
    `;
    row.addEventListener("click", () => runTopic(t.id, row));
    el.appendChild(row);
  });
}

async function loadTopics() {
  try {
    const list = await api("/api/topics");
    renderTopics(list);
  } catch (err) {
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

/** Watches a run's status via its own short-lived EventSource just to know when it finishes --
 * used for the carousel half of a topic click so both halves can mark the topic "done"
 * without fighting the single global log console, which stays attached to the video run. */
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

async function runTopic(topicId, rowEl) {
  if (rowEl.classList.contains("topic-running")) return;
  rowEl.classList.add("topic-running");
  rowEl.querySelector(".topic-status").textContent = "running";
  rowEl.querySelector(".topic-status").className = "topic-status status-running";

  try {
    const { videoRun, carouselRun } = await api(`/api/topics/${topicId}/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    // Primary experience: the shared log console + preview follow the video run.
    currentRunId = videoRun.id;
    attachStream(videoRun.id, videoRun.streamUrl, "cs-explainer");
    loadHistory();

    const [videoOutcome, carouselOutcome] = await Promise.all([
      watchRunUntilDone(videoRun.streamUrl),
      watchRunUntilDone(carouselRun.streamUrl),
    ]);
    const bothOk = videoOutcome === "succeeded" && carouselOutcome === "succeeded";
    rowEl.classList.remove("topic-running");
    rowEl.querySelector(".topic-status").textContent = bothOk ? "done" : "failed";
    rowEl.querySelector(".topic-status").className = `topic-status status-${bothOk ? "done" : "pending"}`;
    loadTopics();
    loadHistory();
  } catch (err) {
    rowEl.classList.remove("topic-running");
    rowEl.querySelector(".topic-status").textContent = "failed";
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
$("youtube-connect").addEventListener("click", () => { window.location.href = "/api/oauth/youtube/connect"; });
$("youtube-force-expire").addEventListener("click", async () => { await api("/api/oauth/youtube/expire", { method: "POST" }); refreshYoutubeStatus(); });
$("voice-upload-btn").addEventListener("click", () => {
  const file = $("voice-file").files[0];
  if (!file) { $("voice-status").textContent = "Choose a reference clip first."; return; }
  uploadVoice(file);
});
$("topics-generate-btn").addEventListener("click", generateTopics);
$("lf-cal-generate-btn").addEventListener("click", generateLongCalendar);
$("lf-cal-weeks").addEventListener("change", syncLongGenerateLabel);
loadLongCalendar();

loadHistory();
loadTopics();
refreshYoutubeStatus();
resetPhaseTimeline("cs-explainer");

if (new URLSearchParams(location.search).get("oauth") === "youtube_connected") {
  refreshYoutubeStatus();
}
