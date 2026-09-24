#!/usr/bin/env node
/**
 * render.js — Phase 5 carousel render path.
 *
 * Takes a JSON payload describing a full carousel (ordered array of `{ kind, content }` slide
 * descriptors) and renders each slide to a numbered PNG via plain Puppeteer, at a fixed
 * Instagram carousel resolution (1080x1350 portrait — see PHASE5-REPORT.md for why).
 *
 * Deliberately does NOT go through HyperFrames' composition/timeline machinery: there is no
 * `data-start`/`data-duration` timing to manage for a static image, and no GSAP timeline to
 * seek. Each slide is just a plain HTML document loaded in headless Chrome and screenshotted
 * once its fonts have settled and the shared text-fit pass has run. See PHASE5-REPORT.md for
 * the full reasoning (and the HyperFrames-snapshot alternative this deliberately skips).
 *
 * Usage:
 *   node render.js <payload.json> <outDir>
 *   (defaults: content/sample-carousel.json -> output/)
 */

const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const { renderShell, PAGE_WIDTH, PAGE_HEIGHT } = require('./lib/layout');
const templates = require('./templates');

async function renderCarousel(payloadPath, outDir) {
  const raw = fs.readFileSync(payloadPath, 'utf8');
  const payload = JSON.parse(raw);
  const slides = payload.slides || [];
  const brandHandle = payload.brandHandle || '@handle';
  const brandAccent = payload.brandAccent || null;

  if (slides.length === 0) {
    throw new Error(`Payload at ${payloadPath} has no slides[]`);
  }

  fs.mkdirSync(outDir, { recursive: true });
  const tmpDir = path.join(outDir, '_html');
  fs.mkdirSync(tmpDir, { recursive: true });

  const browser = await puppeteer.launch({ headless: 'new' });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: PAGE_WIDTH, height: PAGE_HEIGHT, deviceScaleFactor: 1 });

    const results = [];

    for (let i = 0; i < slides.length; i++) {
      const slide = slides[i];
      const template = templates[slide.kind];
      if (!template) {
        throw new Error(
          `Unknown slide kind "${slide.kind}" at index ${i}. Known kinds: ${Object.keys(templates).join(', ')}`
        );
      }

      const content = resolveAssetPaths(slide.content || {}, payloadPath);
      const { bodyHtml, extraCss } = template.render(content);
      const html = renderShell({
        bodyHtml,
        extraCss,
        pageIndex: i,
        totalPages: slides.length,
        brandHandle,
        brandAccent,
      });

      const slideNum = String(i + 1).padStart(2, '0');
      const htmlPath = path.join(tmpDir, `slide-${slideNum}-${slide.kind}.html`);
      fs.writeFileSync(htmlPath, html, 'utf8');

      await page.goto('file://' + htmlPath.replace(/\\/g, '/'), { waitUntil: 'load' });
      await page.waitForFunction(
        () => document.body.getAttribute('data-fit-complete') === 'true',
        { timeout: 5000 }
      );

      const pngPath = path.join(outDir, `slide-${slideNum}-${slide.kind}.png`);
      await page.screenshot({ path: pngPath, clip: { x: 0, y: 0, width: PAGE_WIDTH, height: PAGE_HEIGHT } });

      // Surface any fields that had to be truncated so we can catch overflow at build time,
      // not just by eyeballing images after the fact.
      const truncated = await page.evaluate(() => {
        const flagged = [];
        document.querySelectorAll('[data-fit]').forEach((el) => {
          if (el.style.whiteSpace === 'pre-wrap' && el.hasAttribute('data-fit')) {
            // best-effort marker set by TextFit when it had to truncate
            flagged.push(el.className);
          }
        });
        return flagged;
      });

      results.push({ index: i, kind: slide.kind, pngPath, htmlPath, truncatedFields: truncated });
      console.log(`[${i + 1}/${slides.length}] rendered ${slide.kind} -> ${pngPath}` + (truncated.length ? ` (truncated: ${truncated.join(', ')})` : ''));
    }

    return results;
  } finally {
    await browser.close();
  }
}

/** Resolve any local image path fields (e.g. screenshot's `imagePath`) to a file:// URL the
 * page can load, relative to the payload JSON's own directory. */
function resolveAssetPaths(content, payloadPath) {
  if (!content.imagePath) return content;
  const baseDir = path.dirname(path.resolve(payloadPath));
  const abs = path.resolve(baseDir, content.imagePath);
  return { ...content, imageSrc: 'file://' + abs.replace(/\\/g, '/') };
}

if (require.main === module) {
  const payloadPath = process.argv[2] || path.join(__dirname, 'content', 'sample-carousel.json');
  const outDir = process.argv[3] || path.join(__dirname, 'output');

  renderCarousel(payloadPath, outDir)
    .then((results) => {
      console.log(`\nDone. ${results.length} slides rendered to ${outDir}`);
      const anyTruncated = results.filter((r) => r.truncatedFields.length);
      if (anyTruncated.length) {
        console.log(`NOTE: ${anyTruncated.length} slide(s) had a field truncated by fitFontToBox's fallback — review these:`);
        anyTruncated.forEach((r) => console.log(`  - ${r.pngPath}: ${r.truncatedFields.join(', ')}`));
      }
    })
    .catch((err) => {
      console.error('Render failed:', err);
      process.exit(1);
    });
}

module.exports = { renderCarousel };
