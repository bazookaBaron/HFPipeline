/**
 * text-fit.js — shared real text-fit protection for every carousel slide template.
 *
 * This file is executed INSIDE the rendered page (headless Chrome), not in Node. It is
 * embedded verbatim into every slide's HTML by render.js so all ten slide kinds share one
 * copy of this logic instead of each template re-implementing (and re-breaking) it.
 *
 * Why in-browser: the old pipeline's text-fit bugs came from estimating text size by
 * character count. Real text-fit needs the real font metrics for the real characters, which
 * only exist once the page has laid out with its actual fonts loaded — so we measure with an
 * actual canvas 2D context (`measureText`) after the DOM is built, not before.
 *
 * Exposes `window.TextFit` with:
 *   - measureCtx(fontWeight, fontSizePx, fontFamily) -> CanvasRenderingContext2D configured
 *     with that font, for measureText calls.
 *   - countWrappedLines(text, maxWidthPx, ctx) -> integer number of lines a greedy word-wrap
 *     would produce for `text` at `maxWidthPx` using the font already set on `ctx`.
 *   - truncateToWidth(text, maxWidthPx, ctx, ellipsis='…') -> `text` ellipsis-truncated so its
 *     measured width (in `ctx`'s font) is <= maxWidthPx.
 *   - fitFontToBox(el, opts) -> shrinks el's font-size (in 1px steps) until the text wraps
 *     within el's content box (width AND height), falling back to truncation if it still
 *     doesn't fit at the minimum font size. Returns the final { fontSize, lines, truncated }.
 *   - autoFit(root=document) -> scans root for every element carrying `data-fit`, reads its
 *     data-fit-* config, and runs fitFontToBox on it. Call this once, after all slide content
 *     is in the DOM and web fonts (if any) have loaded, right before the screenshot is taken.
 *
 * Per-element configuration (set these as attributes in template HTML):
 *   data-fit                 presence marks the element as a fit target
 *   data-fit-max="64"        starting / maximum font-size in px (default: current computed size)
 *   data-fit-min="18"        smallest font-size we'll shrink to before truncating (default 14)
 *   data-fit-lines="3"       hard cap on number of wrapped lines allowed (default: derived from
 *                            the element's own height / line-height, i.e. "however many
 *                            actually fit")
 *   data-fit-line-height="1.25"  line-height multiplier used for the height math (default 1.25)
 *   data-fit-family          font-family override for measurement (default: computed style)
 *   data-fit-weight          font-weight override for measurement (default: computed style)
 */
(function (global) {
  'use strict';

  var _measureCanvas = null;
  function getMeasureCanvas() {
    if (!_measureCanvas) {
      _measureCanvas = document.createElement('canvas');
    }
    return _measureCanvas;
  }

  function measureCtx(fontWeight, fontSizePx, fontFamily) {
    var canvas = getMeasureCanvas();
    var ctx = canvas.getContext('2d');
    ctx.font = (fontWeight ? fontWeight + ' ' : '') + fontSizePx + 'px ' + fontFamily;
    return ctx;
  }

  /**
   * Greedy word-wrap simulation: count how many lines `text` would occupy at `maxWidthPx`
   * using the font currently set on `ctx`. Mirrors normal CSS white-space wrapping (breaks on
   * whitespace; a single word longer than the box still counts as one line — it will be
   * handled by overflow-wrap/truncation, not by this counter).
   */
  function countWrappedLines(text, maxWidthPx, ctx) {
    text = String(text == null ? '' : text);
    var paragraphs = text.split('\n');
    var totalLines = 0;

    paragraphs.forEach(function (para) {
      var words = para.split(/\s+/).filter(Boolean);
      if (words.length === 0) {
        totalLines += 1; // blank line still takes vertical space
        return;
      }
      var line = '';
      var lineCount = 0;
      for (var i = 0; i < words.length; i++) {
        var candidate = line ? line + ' ' + words[i] : words[i];
        var w = ctx.measureText(candidate).width;
        if (w > maxWidthPx && line) {
          lineCount += 1;
          line = words[i];
        } else {
          line = candidate;
        }
      }
      lineCount += 1; // final line
      totalLines += lineCount;
    });

    return totalLines;
  }

  /**
   * Ellipsis-truncate `text` so its measured width (single line, in ctx's current font) is
   * <= maxWidthPx. Uses a binary search over string length rather than a fixed char-count
   * guess, since average glyph width varies a lot by font and by what characters are actually
   * present (the exact bug class this whole module exists to avoid).
   */
  function truncateToWidth(text, maxWidthPx, ctx, ellipsis) {
    ellipsis = ellipsis == null ? '…' : ellipsis;
    text = String(text == null ? '' : text).trim();
    if (ctx.measureText(text).width <= maxWidthPx) return text;

    var lo = 0;
    var hi = text.length;
    var best = '';
    while (lo <= hi) {
      var mid = Math.floor((lo + hi) / 2);
      var candidate = text.slice(0, mid).trimEnd() + ellipsis;
      if (ctx.measureText(candidate).width <= maxWidthPx) {
        best = candidate;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }
    return best || ellipsis;
  }

  function getPaddingBoxSize(el) {
    var cs = getComputedStyle(el);
    var paddingX = parseFloat(cs.paddingLeft || 0) + parseFloat(cs.paddingRight || 0);
    var paddingY = parseFloat(cs.paddingTop || 0) + parseFloat(cs.paddingBottom || 0);
    return {
      width: el.clientWidth - paddingX,
      height: el.clientHeight - paddingY,
      family: cs.fontFamily,
      weight: cs.fontWeight,
    };
  }

  /**
   * Shrinks el's font-size until its (already-set) text content wraps within the element's
   * content box, both width and a line-count/height budget. Falls back to ellipsis truncation
   * at the minimum font size if it still won't fit (e.g. pathologically long single word or
   * absurdly long string) so we NEVER silently overflow a box.
   */
  function fitFontToBox(el, opts) {
    opts = opts || {};
    var family = opts.family || el.getAttribute('data-fit-family') || getComputedStyle(el).fontFamily;
    var weight = opts.weight || el.getAttribute('data-fit-weight') || getComputedStyle(el).fontWeight;

    // Derive the line-height ratio from the element's OWN declared CSS rather than assuming
    // a fixed default. Real templates set line-height per field (1.08 for a tight display
    // headline, 1.4-1.5 for a readable paragraph, etc.) — hardcoding one ratio for every field
    // was itself a text-fit bug: the height budget silently disagreed with what the browser
    // actually renders, so a field could pass this function's "it fits" check and still get
    // visually clipped by its own `overflow: hidden`. Read BEFORE any font-size mutation below,
    // since CSS line-height here is always the unitless-multiplier form, so the ratio
    // (computed line-height px / computed font-size px) stays constant as font-size changes.
    var explicitLineHeight = opts.lineHeight || el.getAttribute('data-fit-line-height');
    var lineHeightRatio;
    if (explicitLineHeight) {
      lineHeightRatio = parseFloat(explicitLineHeight);
    } else {
      var preMutationFontSize = parseFloat(getComputedStyle(el).fontSize) || 32;
      var cssLineHeight = getComputedStyle(el).lineHeight;
      if (cssLineHeight === 'normal') {
        lineHeightRatio = 1.2; // CSS spec's suggested approximation for 'normal'
      } else {
        lineHeightRatio = parseFloat(cssLineHeight) / preMutationFontSize;
      }
      if (!lineHeightRatio || isNaN(lineHeightRatio)) lineHeightRatio = 1.25;
    }

    var computedSize = parseFloat(getComputedStyle(el).fontSize) || 32;
    var maxSize = parseFloat(opts.max || el.getAttribute('data-fit-max') || computedSize);
    var minSize = parseFloat(opts.min || el.getAttribute('data-fit-min') || '14');
    var explicitMaxLines = opts.maxLines || el.getAttribute('data-fit-lines');
    var text = opts.text != null ? opts.text : el.textContent;

    var fontSize = maxSize;
    var lines = 0;
    var fits = false;
    var box = null;

    // IMPORTANT: box size is measured AFTER setting the element to each candidate font-size,
    // not once upfront. Most template fields sit in a box with an explicit fixed CSS width/
    // height, where this makes no difference. But some fields (e.g. a pill button label) sit
    // in a box that hugs its own content — there, the box's width IS a function of the
    // current font-size, so measuring it once at the element's pre-fit (unshrunk) size would
    // compare "text at 30px" against "box sized for text at the browser default ~16px" and
    // report a false overflow. Re-measuring per candidate keeps the comparison honest for
    // both fixed-box and content-hugging fields.
    while (fontSize >= minSize) {
      el.style.fontSize = fontSize + 'px';
      box = getPaddingBoxSize(el);
      var ctx = measureCtx(weight, fontSize, family);
      lines = countWrappedLines(text, box.width, ctx);
      var lineHeightPx = fontSize * lineHeightRatio;
      var maxLinesForHeight = Math.max(1, Math.floor(box.height / lineHeightPx));
      var maxLines = explicitMaxLines ? Math.min(parseInt(explicitMaxLines, 10), maxLinesForHeight) : maxLinesForHeight;

      if (lines <= maxLines) {
        fits = true;
        break;
      }
      fontSize -= 1;
    }

    if (!fits) {
      fontSize = minSize;
      el.style.fontSize = fontSize + 'px';
      box = getPaddingBoxSize(el);
      var minCtx = measureCtx(weight, fontSize, family);
      var lineHeightPx2 = fontSize * lineHeightRatio;
      var maxLinesForHeight2 = Math.max(1, Math.floor(box.height / lineHeightPx2));
      var maxLines2 = explicitMaxLines
        ? Math.min(parseInt(explicitMaxLines, 10), maxLinesForHeight2)
        : maxLinesForHeight2;

      // Truncate to the last permitted line: greedily lay out words up to (maxLines2 - 1)
      // full lines, then ellipsis-truncate the remainder into the final line's width budget.
      var words = String(text).split(/\s+/).filter(Boolean);
      var builtLines = [];
      var current = '';
      for (var i = 0; i < words.length && builtLines.length < maxLines2 - 1; i++) {
        var candidate = current ? current + ' ' + words[i] : words[i];
        if (minCtx.measureText(candidate).width > box.width && current) {
          builtLines.push(current);
          current = words[i];
        } else {
          current = candidate;
        }
      }
      var remainder = words.slice(0).join(' ');
      // Recompute remainder as whatever wasn't consumed into builtLines
      var consumedWords = builtLines.join(' ').split(/\s+/).filter(Boolean).length;
      remainder = words.slice(consumedWords).join(' ');
      var lastLine = truncateToWidth(remainder || current, box.width, minCtx);
      builtLines.push(lastLine);

      el.textContent = builtLines.join('\n');
      el.style.whiteSpace = 'pre-wrap';
      fontSize = minSize;
      lines = builtLines.length;
      el.style.fontSize = fontSize + 'px';
      return { fontSize: fontSize, lines: lines, truncated: true };
    }

    el.style.fontSize = fontSize + 'px';
    return { fontSize: fontSize, lines: lines, truncated: false };
  }

  function autoFit(root) {
    root = root || document;
    var targets = root.querySelectorAll('[data-fit]');
    var results = [];
    targets.forEach(function (el) {
      results.push({ el: el, result: fitFontToBox(el) });
    });
    return results;
  }

  global.TextFit = {
    measureCtx: measureCtx,
    countWrappedLines: countWrappedLines,
    truncateToWidth: truncateToWidth,
    fitFontToBox: fitFontToBox,
    autoFit: autoFit,
  };
})(typeof window !== 'undefined' ? window : globalThis);
