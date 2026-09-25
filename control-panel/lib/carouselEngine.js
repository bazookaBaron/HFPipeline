"use strict";

/**
 * Carousel pipeline runner.
 *
 * Previously this always rendered the fixed carousel-engine/content/sample-carousel.json,
 * ignoring config.topic (see git history / PHASE6-REPORT.md for why: at the time, neither the
 * orchestrator nor a real Gemini key existed). Both now exist:
 *   - orchestrator/generate-carousel.js does the real "topic in -> finished carousel out" flow
 *     (real Gemini call with reject-and-repair validation, then carousel-engine/render.js).
 *   - scripting-pipeline/.env holds a real, live GEMINI_API_KEY the orchestrator reads.
 *
 * This file now spawns that orchestrator CLI for real, mapping this job's config
 * (topic/accentColor/brandHandle) onto its --topic/--accent/--handle args, and keeps the same
 * job-log-streaming/status-setting contract this module already had (real stdout/stderr pumped
 * into jobs.appendLog, status set from the child's real exit code AND its final JSON line, same
 * image-list-from-directory-scan behavior for populating the result). Function signature is
 * unchanged so server.js/jobs.js don't need to change.
 */

const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");
const jobs = require("./jobs");

const CAROUSEL_ENGINE_DIR = path.resolve(__dirname, "..", "..", "carousel-engine");
const ORCHESTRATOR_DIR = path.resolve(__dirname, "..", "..", "orchestrator");
const ORCHESTRATOR_ENTRY = path.join(ORCHESTRATOR_DIR, "make-carousel.js");
const RENDERS_DIR = path.join(__dirname, "..", "data", "renders");

function carouselEngineReady() {
  return (
    fs.existsSync(ORCHESTRATOR_ENTRY) &&
    fs.existsSync(path.join(CAROUSEL_ENGINE_DIR, "render.js")) &&
    fs.existsSync(path.join(CAROUSEL_ENGINE_DIR, "node_modules"))
  );
}

function runCarouselRender(jobId, config) {
  jobs.setStatus(jobId, "running");

  if (!carouselEngineReady()) {
    jobs.appendLog(
      jobId,
      "meta",
      `Orchestrator or carousel-engine not fully present yet (checked ${ORCHESTRATOR_ENTRY} and ${CAROUSEL_ENGINE_DIR}).`
    );
    jobs.appendLog(jobId, "meta", "Stubbing this run: no image was generated. Nothing here is faked as a success.");
    jobs.setStatus(jobId, "stubbed", {
      result: { type: "none", stubbed: true, reason: "orchestrator/carousel-engine not present yet" },
    });
    return Promise.resolve({ ok: false, stubbed: true });
  }

  const topic = (config && config.topic ? String(config.topic) : "").trim();
  if (!topic) {
    jobs.appendLog(jobId, "meta", "No topic provided in config -- cannot generate real carousel content.");
    jobs.setStatus(jobId, "failed", { error: "config.topic is required for carousel generation" });
    return Promise.resolve({ ok: false });
  }

  fs.mkdirSync(RENDERS_DIR, { recursive: true });
  const outDir = path.join(RENDERS_DIR, jobId);
  fs.mkdirSync(outDir, { recursive: true });

  const accentColor = (config && config.accentColor) || undefined;
  const brandHandle = (config && config.brandHandle) || undefined;

  // v3: same card library + styles as the videos, brand end slide (orchestrator/make-carousel.js)
  const args = ["make-carousel.js", "--topic", topic, "--run-id", jobId, "--out-dir", outDir];
  const profile = config && ["DH", "LC", "DC", "BR", "BP"].includes(config.profile) ? config.profile : "auto";
  args.push("--profile", profile);
  if (accentColor) args.push("--accent", accentColor);
  if (brandHandle) args.push("--handle", brandHandle);

  jobs.appendLog(jobId, "meta", `$ node ${args.map((a) => (/\s/.test(a) ? JSON.stringify(a) : a)).join(" ")}`);
  jobs.appendLog(jobId, "meta", `cwd: ${ORCHESTRATOR_DIR}`);

  return new Promise((resolve) => {
    // no shell: a multi-word --topic must stay one argv entry (shell:true split it on Windows)
    const child = spawn("node", args, { cwd: ORCHESTRATOR_DIR, windowsHide: true });

    let stdoutTail = ""; // last non-empty stdout line seen so far -- the orchestrator's contract
    // is exactly one final JSON line on stdout, on success only.
    const pump = (stream, name) => {
      let buffer = "";
      stream.on("data", (chunk) => {
        buffer += chunk.toString("utf8");
        let idx;
        while ((idx = buffer.indexOf("\n")) !== -1) {
          const line = buffer.slice(0, idx).replace(/\r$/, "");
          buffer = buffer.slice(idx + 1);
          if (line.length) {
            jobs.appendLog(jobId, name, line);
            if (name === "stdout") stdoutTail = line;
          }
        }
      });
    };
    pump(child.stdout, "stdout");
    pump(child.stderr, "stderr");

    child.on("error", (err) => {
      jobs.appendLog(jobId, "stderr", `Failed to spawn orchestrator: ${err.message}`);
      jobs.setStatus(jobId, "failed", { error: err.message });
      resolve({ ok: false });
    });

    child.on("close", (code) => {
      if (code !== 0) {
        jobs.setStatus(jobId, "failed", { error: `orchestrator exited with code ${code}` });
        resolve({ ok: false, code });
        return;
      }

      // Cross-check the child's own final JSON line against reality, per the same
      // "real exit code AND final JSON line" contract voice-pipeline/synthesize.py uses.
      let finalJson = null;
      try {
        finalJson = JSON.parse(stdoutTail);
      } catch (_) {
        finalJson = null;
      }

      const images = fs
        .readdirSync(outDir)
        .filter((name) => /\.png$/i.test(name))
        .sort()
        .map((name) => `/media/${jobId}/${name}`);

      if (!finalJson || finalJson.ok !== true || images.length === 0) {
        jobs.appendLog(
          jobId,
          "meta",
          `Orchestrator exited 0 but did not report a valid success result (parsed: ${finalJson ? JSON.stringify(finalJson) : "none"}, images found: ${images.length}).`
        );
        jobs.setStatus(jobId, "failed", { error: "orchestrator did not report a valid success result" });
        resolve({ ok: false });
        return;
      }

      jobs.setStatus(jobId, "succeeded", {
        result: { type: "image-set", path: outDir, images, slideCount: finalJson.slideCount },
      });
      resolve({ ok: true, outDir, images });
    });
  });
}

module.exports = { runCarouselRender, carouselEngineReady, CAROUSEL_ENGINE_DIR, ORCHESTRATOR_DIR };
