/*
 * HFTextFit -- shared, self-contained canvas-measureText text-fit protection.
 *
 * Every component in this library must route dynamic text through this file
 * instead of hand-rolling a character-count heuristic ("if text.length > 40
 * shrink font"). Character counts lie: "iiiiiiiiii" and "WWWWWWWWWW" are the
 * same length and wildly different widths. This is a hard requirement from
 * a real production bug in the old (Remotion) pipeline -- see PLAN.md Sec 4,
 * which names the exact three functions ported here: fitFontToBox,
 * truncateToWidth, countWrappedLines.
 *
 * Deterministic: pure canvas measurement, no layout reflow, no randomness,
 * no clock. Safe to call at composition-build time (before the timeline is
 * registered) and safe in a plain browser tab with no HyperFrames runtime
 * present, so the same file works both inside a real render and inside a
 * standalone demo.html preview.
 *
 * Usage:
 *   HFTextFit.fitOrTruncate(el, text, {
 *     family: "Inter, ui-sans-serif, sans-serif",
 *     weight: 600,
 *     maxWidth: 480,        // px available for the text
 *     maxHeight: 96,        // px available (omit for single-line fields)
 *     baseSize: 32,
 *     minSize: 16,
 *     lineHeightRatio: 1.25,
 *     maxLines: 2,          // omit/Infinity for unlimited wrap
 *   });
 * Sets el.style.fontSize and el.textContent itself; returns the report
 * object ({ fontSize, lines, truncated }) in case the caller wants it.
 */
(function (global) {
  "use strict";

  var canvas = null;
  var ctx = null;
  function getCtx() {
    if (!ctx) {
      canvas = document.createElement("canvas");
      ctx = canvas.getContext("2d");
    }
    return ctx;
  }

  function fontString(weight, size, family) {
    return weight + " " + size + "px " + family;
  }

  /** Real canvas measureText width for a string at a given font. */
  function measure(text, weight, size, family) {
    var c = getCtx();
    c.font = fontString(weight, size, family);
    return c.measureText(text || "").width;
  }

  /**
   * Binary-search the longest prefix of `text` (plus an ellipsis) that fits
   * within `maxWidth` at the given font. Never a character-count guess.
   */
  function truncateToWidth(text, weight, size, family, maxWidth) {
    text = String(text == null ? "" : text);
    if (measure(text, weight, size, family) <= maxWidth) return text;
    var ELLIPSIS = "…";
    if (measure(ELLIPSIS, weight, size, family) > maxWidth) return ELLIPSIS;
    var lo = 0;
    var hi = text.length;
    while (lo < hi) {
      var mid = (lo + hi + 1) >> 1;
      var candidate = text.slice(0, mid).replace(/\s+$/, "") + ELLIPSIS;
      if (measure(candidate, weight, size, family) <= maxWidth) {
        lo = mid;
      } else {
        hi = mid - 1;
      }
    }
    return text.slice(0, lo).replace(/\s+$/, "") + ELLIPSIS;
  }

  /**
   * Simulate greedy word-wrap at a given width/font and report how many
   * lines the text would actually occupy -- the real number, not an
   * estimate from character count / average-char-width.
   */
  function countWrappedLines(text, weight, size, family, maxWidth) {
    text = String(text == null ? "" : text).trim();
    if (!text) return 1;
    var words = text.split(/\s+/);
    var lines = 1;
    var current = "";
    for (var i = 0; i < words.length; i++) {
      var word = words[i];
      var test = current ? current + " " + word : word;
      if (current && measure(test, weight, size, family) > maxWidth) {
        lines += 1;
        current = word;
      } else {
        current = test;
      }
    }
    return lines;
  }

  /**
   * Shrink-to-fit: find the largest font size in [minSize, baseSize] at
   * which `text` wraps into at most `maxLines` lines of at most `maxWidth`
   * and a total block height of at most `maxHeight`. Returns whether it
   * actually fit at minSize (caller should truncate if not).
   */
  function fitFontToBox(text, opts) {
    opts = opts || {};
    var family = opts.family || "Inter, ui-sans-serif, system-ui, sans-serif";
    var weight = opts.weight || 400;
    var maxWidth = opts.maxWidth || 400;
    var maxHeight = opts.maxHeight == null ? Infinity : opts.maxHeight;
    var baseSize = opts.baseSize || 32;
    var minSize = opts.minSize || 14;
    var lineHeightRatio = opts.lineHeightRatio || 1.25;
    var maxLines = opts.maxLines == null ? Infinity : opts.maxLines;

    var size = baseSize;
    var lines = countWrappedLines(text, weight, size, family, maxWidth);
    var height = lines * size * lineHeightRatio;

    while (size > minSize && (lines > maxLines || height > maxHeight)) {
      size -= 1;
      lines = countWrappedLines(text, weight, size, family, maxWidth);
      height = lines * size * lineHeightRatio;
    }

    var fits = lines <= maxLines && height <= maxHeight;
    return { fontSize: size, lines: Math.min(lines, maxLines), fits: fits };
  }

  /**
   * The one call most components need: shrink the element's font to fit
   * the box; if it still doesn't fit at minSize, truncate the LAST visible
   * line with an ellipsis (never silently overflow, never clip mid-glyph).
   * Mutates `el` (fontSize + textContent) and returns the fit report.
   */
  function fitOrTruncate(el, text, opts) {
    opts = opts || {};
    text = String(text == null ? "" : text);
    var report = fitFontToBox(text, opts);
    el.style.fontSize = report.fontSize + "px";
    el.style.lineHeight = (opts.lineHeightRatio || 1.25).toString();

    if (report.fits) {
      el.textContent = text;
      return Object.assign({ truncated: false }, report);
    }

    // Still doesn't fit at minSize: truncate to the last allowed line.
    var family = opts.family || "Inter, ui-sans-serif, system-ui, sans-serif";
    var weight = opts.weight || 400;
    var maxWidth = opts.maxWidth || 400;
    var maxLines = opts.maxLines == null ? 1 : opts.maxLines;

    if (maxLines <= 1) {
      el.textContent = truncateToWidth(text, weight, report.fontSize, family, maxWidth);
      return { fontSize: report.fontSize, lines: 1, fits: false, truncated: true };
    }

    // Multi-line truncation: greedily fill maxLines-1 full lines by real
    // wrap simulation, tracking a word INDEX (never re-diffing strings),
    // then truncate everything left over into one final ellipsized line.
    var words = text.split(/\s+/).filter(Boolean);
    var linesOut = [];
    var current = "";
    var idx = 0;
    while (idx < words.length && linesOut.length < maxLines - 1) {
      var test = current ? current + " " + words[idx] : words[idx];
      if (current && measure(test, weight, report.fontSize, family) > maxWidth) {
        linesOut.push(current);
        current = "";
        // do not advance idx: retry this word as the start of the next line
      } else {
        current = test;
        idx += 1;
      }
    }
    if (current) {
      linesOut.push(current);
    }
    var remainder = words.slice(idx).join(" ");
    if (remainder) {
      linesOut.push(truncateToWidth(remainder, weight, report.fontSize, family, maxWidth));
    }

    el.textContent = linesOut.join(" ");
    return { fontSize: report.fontSize, lines: linesOut.length, fits: false, truncated: true };
  }

  global.HFTextFit = {
    measure: measure,
    truncateToWidth: truncateToWidth,
    countWrappedLines: countWrappedLines,
    fitFontToBox: fitFontToBox,
    fitOrTruncate: fitOrTruncate,
  };
})(window);
