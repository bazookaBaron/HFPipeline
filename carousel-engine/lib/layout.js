/**
 * layout.js — the shared page shell every slide kind renders into.
 *
 * Owns: fixed canvas size, base typography/reset, the tiny bit of cross-slide "chrome"
 * (wordmark + page-position dots, both in BRAND_ACCENT — never the item-rotation colors), and
 * wiring in the shared text-fit + NumberBadge CSS/JS so individual templates don't each have
 * to remember to include them.
 */

const fs = require('fs');
const path = require('path');
const { BRAND_ACCENT, BRAND_INK, BRAND_PAPER, BRAND_MUTED } = require('./colors');
const { NUMBER_BADGE_CSS } = require('./number-badge');
const { escapeHtml } = require('./html');

const PAGE_WIDTH = 1080;
const PAGE_HEIGHT = 1350;

const TEXT_FIT_SRC = fs.readFileSync(path.join(__dirname, 'text-fit.js'), 'utf8');

const BASE_CSS = `
  * { box-sizing: border-box; }
  html {
    /* Single overridable brand-accent hook. cover.js already reads this var (with a hardcoded
       fallback) for its accent bar, but nothing ever actually SET the variable, so a caller had
       no way to change the accent color short of editing colors.js -- a real gap, fixed here by
       defining it once at the root and letting renderShell's brandAccent option override it per
       render. Kept separate from colors.js's ROTATION table on purpose: this only controls the
       single fixed "brand chrome" accent, never the per-item rotation colors. */
    --brand-accent: ${BRAND_ACCENT};
  }
  html, body {
    margin: 0; padding: 0;
    width: ${PAGE_WIDTH}px; height: ${PAGE_HEIGHT}px;
    background: ${BRAND_PAPER};
    color: ${BRAND_INK};
    font-family: -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    -webkit-font-smoothing: antialiased;
    overflow: hidden;
  }
  .slide {
    position: relative;
    width: ${PAGE_WIDTH}px; height: ${PAGE_HEIGHT}px;
    display: flex;
    flex-direction: column;
    padding: 84px 76px 64px;
  }
  .muted { color: ${BRAND_MUTED}; }
  .brand-accent { color: ${BRAND_ACCENT}; }
  .kicker {
    text-transform: uppercase;
    letter-spacing: 0.14em;
    font-weight: 700;
    font-size: 22px;
    color: var(--brand-accent, ${BRAND_ACCENT});
    margin: 0 0 18px 0;
  }
  .slide-body {
    /* Fills all space between the top padding and the footer chrome, and nothing more.
       min-height: 0 is required for a flex child to actually be allowed to shrink to this
       constraint instead of growing to its content's natural size (the flexbox default is
       min-height: auto, which would let a template's own flex:1 inner content push this
       taller than the slide and shove the footer down/off — the exact overflow bug this
       fixes: the footer chrome used to be position:absolute and so reserved no space at all,
       letting normal-flow content grow underneath and visually collide with it). */
    flex: 1 1 auto;
    min-height: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  .chrome-footer {
    flex: 0 0 auto;
    margin-top: 28px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 20px;
    color: ${BRAND_MUTED};
  }
  .chrome-wordmark { font-weight: 700; color: ${BRAND_INK}; }
  .chrome-dots { display: flex; gap: 8px; align-items: center; }
  .chrome-dot { width: 8px; height: 8px; border-radius: 50%; background: #D9DEE7; }
  .chrome-dot.is-active { background: var(--brand-accent, ${BRAND_ACCENT}); width: 20px; border-radius: 4px; }
  ${NUMBER_BADGE_CSS}
`;

/**
 * @param {object} opts
 * @param {string} opts.bodyHtml the slide-kind-specific markup (already text-fit-annotated).
 * @param {string} [opts.extraCss] additional CSS scoped to this slide kind.
 * @param {number} opts.pageIndex 0-based slide position.
 * @param {number} opts.totalPages total slide count in the carousel.
 * @param {string} [opts.brandHandle] wordmark/handle text shown bottom-left (chrome, fixed).
 * @param {string} [opts.brandAccent] optional override for the single brand-accent color (CSS
 *   color string, e.g. "#6ea8fe"). Affects only brand chrome (kicker, active page dot, and any
 *   template that itself reads var(--brand-accent), e.g. cover.js's accent bar) -- never the
 *   per-item ROTATION colors used to distinguish parallel items within a slide.
 * @param {boolean} [opts.showChrome] whether to render the footer chrome (default true).
 */
function renderShell(opts) {
  const {
    bodyHtml,
    extraCss = '',
    pageIndex = 0,
    totalPages = 1,
    brandHandle = '@handle',
    brandAccent = null,
    showChrome = true,
  } = opts;

  const dots = Array.from({ length: totalPages })
    .map((_, i) => `<span class="chrome-dot${i === pageIndex ? ' is-active' : ''}"></span>`)
    .join('');

  const chrome = showChrome
    ? `<div class="chrome-footer">
         <span class="chrome-wordmark">${escapeHtml(brandHandle)}</span>
         <span class="chrome-dots">${dots}</span>
       </div>`
    : '';

  // Only accept a plausible CSS color token (hex, rgb()/rgba(), or a bare color keyword) --
  // never interpolate arbitrary caller-supplied text directly into a <style> block.
  const safeAccent = brandAccent && /^(#[0-9a-fA-F]{3,8}|[a-zA-Z]+|rgba?\([0-9.,%\s]+\))$/.test(brandAccent.trim())
    ? brandAccent.trim()
    : null;
  const accentOverrideCss = safeAccent ? `html { --brand-accent: ${safeAccent}; }` : '';

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>Carousel slide ${pageIndex + 1}/${totalPages}</title>
<style>${BASE_CSS}\n${extraCss}\n${accentOverrideCss}</style>
</head>
<body>
  <div class="slide" id="slide-root">
    <div class="slide-body">${bodyHtml}</div>
    ${chrome}
  </div>
  <script>${TEXT_FIT_SRC}</script>
  <script>
    (function () {
      function run() {
        try { window.TextFit.autoFit(document); } finally {
          document.body.setAttribute('data-fit-complete', 'true');
        }
      }
      if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(run).catch(run);
      } else {
        run();
      }
    })();
  </script>
</body>
</html>`;
}

module.exports = { renderShell, PAGE_WIDTH, PAGE_HEIGHT, BASE_CSS };
