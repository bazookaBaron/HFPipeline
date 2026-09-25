"use strict";

/**
 * Render compiled carousel slides to PNG with the stage renderer (headless Chrome via the layout
 * audit harness): every slide is audited (overlap / overflow / clipped text / build errors) at the
 * capture time and screenshotted. Returns { images, problems }.
 */

const path = require("path");
const fs = require("fs");
const { auditLayout, describe, launchBrowser } = require("../../tools/layout_audit");

async function renderCarousel(slides, outDir, { log = () => {}, shots = true } = {}) {
  fs.mkdirSync(outDir, { recursive: true });
  const images = [];
  const problems = [];
  const browser = await launchBrowser();
  try {
  for (let i = 0; i < slides.length; i++) {
    const s = slides[i];
    const name = `slide-${String(i + 1).padStart(2, "0")}-${s.kind}.png`;
    const r = await auditLayout({ spec: s.spec, duration: s.duration, frame: s.frame, times: [s.shotT], shots: shots ? [{ t: s.shotT, path: path.join(outDir, name) }] : [], log: () => {}, browser });
    r.problems.forEach((p) => problems.push(`slide ${i + 1} (${s.id}): ${describe(p).replace(/^at [\d.]+ s: /, "")}`));
    r.buildProblems.forEach((p) => problems.push(`slide ${i + 1} (${s.id}): renderer: ${p}`));
    if (shots) images.push(name);
    log(`slide ${i + 1}/${slides.length} ${s.kind}: ${r.problems.length + r.buildProblems.length} defect(s)`);
  }
  } finally {
    await browser.close();
  }
  return { images, problems };
}

module.exports = { renderCarousel };
