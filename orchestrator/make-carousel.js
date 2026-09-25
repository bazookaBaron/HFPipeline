#!/usr/bin/env node
"use strict";

/**
 * make-carousel.js -- topic -> finished Instagram carousel (1080x1350 PNGs) in the SAME card
 * library and styles (DH / LC / DC) as the v3 videos, ending with the brand slide
 * (brand.json: follow + site). Gemini writes carousel.v3, validated by the real compiler and a
 * rendered layout audit (repair loop), then every slide is rendered by the stage renderer.
 *
 *   node make-carousel.js --topic "..." --out-dir dir [--profile auto|DH|LC|DC] [--handle @x] [--run-id id]
 *
 * Contract (control panel): progress on stderr; ONE final JSON line on stdout on success
 * {ok, outDir, slideCount, images}; non-zero exit and no JSON on failure.
 */

const fs = require("fs");
const path = require("path");
const { generateCarousel } = require("./lib/carousel3/carouselGen");
const { compileCarousel } = require("./lib/carousel3/compileCarousel");
const { renderCarousel } = require("./lib/carousel3/renderCarousel");

function arg(name, def) {
  const i = process.argv.indexOf("--" + name);
  return i >= 0 && process.argv[i + 1] !== undefined && !process.argv[i + 1].startsWith("--") ? process.argv[i + 1] : def;
}
const log = (m) => process.stderr.write(`[make-carousel] ${m}\n`);

async function main() {
  const topic = String(arg("topic", "")).trim();
  const outDir = path.resolve(arg("out-dir", path.join("output", "carousel-" + Date.now().toString(36))));
  const profile = ["DH", "LC", "DC"].includes(arg("profile")) ? arg("profile") : "auto";
  const handle = arg("handle", "");
  const content = arg("content"); // re-render an existing carousel.v3 without the model
  if (!topic && !content) throw new Error("--topic is required");
  fs.mkdirSync(outDir, { recursive: true });

  let cb;
  if (content) cb = JSON.parse(fs.readFileSync(path.resolve(content), "utf-8"));
  else {
    log(`topic "${topic}" (style ${profile})`);
    try {
      cb = (await generateCarousel(topic, { profile, handle, log })).carousel;
    } catch (err) {
      if (err.last) fs.writeFileSync(path.join(outDir, "content.failed.json"), JSON.stringify(err.last, null, 1));
      throw err;
    }
  }
  if (handle) cb.handle = handle;
  fs.writeFileSync(path.join(outDir, "content.json"), JSON.stringify(cb, null, 1));

  const slides = compileCarousel(cb);
  const r = await renderCarousel(slides, outDir, { log });
  if (r.problems.length) throw new Error(`layout audit failed: ${r.problems.join(" | ")}`);
  process.stdout.write(JSON.stringify({ ok: true, outDir, slideCount: r.images.length, images: r.images, profile: cb.profile }) + "\n");
}

main().catch((err) => {
  process.stderr.write(`make-carousel failed: ${err.message}\n`);
  process.exit(1);
});
