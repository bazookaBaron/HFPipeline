"use strict";

/**
 * Piece 2 step 5: wraps the real `npx hyperframes@0.8.46 check` /
 * `... render` CLI (the same pinned version video-engine/package.json and
 * control-panel/lib/renderEngine.js use) against the real video-engine/
 * project.
 *
 * `check`/`lint` in this CLI version only ever validate `<DIR>/index.html`
 * -- there is NO flag to point them at an arbitrary composition file
 * (confirmed empirically: `--composition`/`-c` is accepted by `render` but
 * rejected as "Unknown flag" by `check`, and `check <file>.html` fails with
 * "Not a directory" because its DIR argument must be a directory).
 *
 * REAL BUG FOUND AND FIXED: this used to back up the real index.html, swap
 * the generated composition in over it, run check, then restore the backup
 * in a `finally` block. That's vulnerable to two real failure modes that
 * both actually happened in this project's own history: (1) concurrent
 * checkComposition calls (before the control panel's per-pipeline queue
 * existed) racing on the SAME backup path, each backing up whatever the
 * OTHER one had already swapped in, corrupting the eventual restore; (2) a
 * hard process kill (e.g. an operator restarting the control-panel server
 * mid-render) never reaches the `finally` block at all, since the process
 * dies before any pending JS runs. Both together left the real
 * video-engine/index.html silently swapped to a stale generated
 * composition for an unknown stretch of this project's history -- latent
 * and harmless to actual output (render always used --composition directly
 * against a generated/*.html file and never touched index.html), but a real
 * integrity bug, found by noticing index.html didn't match what Phase 1 had
 * built.
 *
 * FIX: never touch the real index.html at all. Build a per-run scratch
 * directory instead, with the generated composition as ITS index.html and
 * junction-linked (not copied) `compositions/` + `assets/` directories so
 * the exact same shared component library and generated audio the real
 * project has are visible without duplicating megabytes of files per check.
 * Root-relative asset paths inside the composition resolve identically
 * either way, so this is validation-equivalent to the old approach with no
 * shared-mutable-state risk.
 *
 * `render` needs no such trick: its `-c/--composition` flag renders an
 * arbitrary composition file directly against the real project root, and
 * always has.
 */

const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");

const VIDEO_ENGINE_DIR = path.resolve(__dirname, "..", "..", "..", "video-engine");
const HYPERFRAMES_VERSION = "hyperframes@0.8.46"; // matches video-engine/package.json's pinned CLI

/**
 * Windows' `shell: true` spawns via `cmd.exe /c <command>`, joining argv with
 * plain spaces and NO escaping of its own (confirmed empirically -- an
 * unquoted array element containing a space is split into multiple argv
 * entries by cmd.exe, silently corrupting e.g. a composition/output path
 * that contains a space). `shell: true` is still required here because
 * `npx` resolves to `npx.cmd` on Windows, which a bare CreateProcess call
 * (shell: false) cannot execute directly (confirmed: EINVAL). So every
 * argument is manually quoted for cmd.exe before being handed to spawn.
 */
function winQuote(arg) {
  return `"${String(arg).replace(/"/g, '\\"')}"`;
}

function runNpx(args, log) {
  return new Promise((resolve, reject) => {
    log(`$ npx --yes ${args.join(" ")}  (cwd: ${VIDEO_ENGINE_DIR})`);
    const quotedArgs = ["--yes", ...args].map(winQuote);
    const child = spawn("npx", quotedArgs, {
      cwd: VIDEO_ENGINE_DIR,
      shell: true,
      windowsHide: true,
    });

    let stdout = "";
    const pump = (stream, name) => {
      let buffer = "";
      stream.on("data", (chunk) => {
        const text = chunk.toString("utf8");
        if (name === "stdout") stdout += text;
        buffer += text;
        let idx;
        while ((idx = buffer.indexOf("\n")) !== -1) {
          const line = buffer.slice(0, idx).replace(/\r$/, "");
          buffer = buffer.slice(idx + 1);
          if (line.length) log(`[hyperframes:${name}] ${line}`);
        }
      });
      stream.on("end", () => {
        if (buffer.trim().length) log(`[hyperframes:${name}] ${buffer.trim()}`);
      });
    };
    pump(child.stdout, "stdout");
    pump(child.stderr, "stderr");

    child.on("error", reject);
    child.on("close", (code) => resolve({ code, stdout }));
  });
}

/**
 * Runs `hyperframes check --json` against an isolated per-run scratch directory (never the
 * real video-engine/index.html -- see this file's header comment for the real corruption
 * bug this replaced).
 *
 * @returns {Promise<{code: number, result: object|null}>}
 */
async function checkComposition(compositionPath, log) {
  const scratchDir = path.join(VIDEO_ENGINE_DIR, `.orchestrator-check-${process.pid}-${Date.now()}`);
  fs.mkdirSync(scratchDir, { recursive: true });

  function junctionOrCopy(name) {
    const src = path.join(VIDEO_ENGINE_DIR, name);
    const dest = path.join(scratchDir, name);
    try {
      fs.symlinkSync(src, dest, "junction");
    } catch (e) {
      // Fallback for environments where junctions aren't permitted -- correctness over
      // speed; this scratch dir is deleted immediately after, so a one-time copy is fine.
      fs.cpSync(src, dest, { recursive: true });
    }
  }

  try {
    fs.copyFileSync(compositionPath, path.join(scratchDir, "index.html"));
    fs.copyFileSync(path.join(VIDEO_ENGINE_DIR, "hyperframes.json"), path.join(scratchDir, "hyperframes.json"));
    junctionOrCopy("compositions");
    junctionOrCopy("assets");

    // --timeout raised from the CLI's 10s default: the script-depth redesign now targets
    // 10-16 real scenes (up from 3-6) plus the persistent mascot/HUD/caption chrome layers,
    // so the assembled composition is heavier and can genuinely take longer than 10s for
    // headless Chrome to load/font-fetch/compile before check's own render-ready poll can
    // start -- confirmed as a real timeout in production, not a broken composition.
    const { code, stdout } = await runNpx(
      [HYPERFRAMES_VERSION, "check", scratchDir, "--json", "--timeout", "45000"],
      log
    );
    let result = null;
    try {
      result = JSON.parse(stdout.trim());
    } catch (e) {
      log(`Could not parse hyperframes check --json stdout: ${e.message}`);
    }
    return { code, result };
  } finally {
    // Best-effort cleanup -- if this process is hard-killed before reaching here, the worst
    // case is an orphaned scratch dir (harmless, nothing else ever reads it), never a
    // corrupted shared file. That's the whole point of this fix.
    try {
      fs.rmSync(scratchDir, { recursive: true, force: true });
    } catch (e) {
      log(`Could not clean up scratch dir ${scratchDir}: ${e.message}`);
    }
  }
}

/**
 * @param {object} opts
 * @param {string} opts.compositionRelPath composition path relative to video-engine/ (forward slashes)
 * @param {string} opts.outputPath absolute output file path
 * @param {string} [opts.quality]
 */
async function renderComposition({ compositionRelPath, outputPath, quality = "draft" }, log) {
  // Explicit generous timeouts for the same reason as checkComposition's --timeout bump:
  // the script-depth redesign's heavier compositions (10-16 scenes + persistent chrome) can
  // genuinely take longer to load/compile than lighter defaults assume.
  const { code } = await runNpx(
    [
      HYPERFRAMES_VERSION,
      "render",
      "--composition",
      compositionRelPath,
      "--output",
      outputPath,
      "--quality",
      quality,
      "--browser-timeout",
      "90",
      "--player-ready-timeout",
      "90000",
    ],
    log
  );
  return { code };
}

module.exports = { checkComposition, renderComposition, VIDEO_ENGINE_DIR, HYPERFRAMES_VERSION };
