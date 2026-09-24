/**
 * html.js — tiny shared HTML-safety helpers used by every template (Node side).
 *
 * Real content (as opposed to lorem ipsum) routinely contains characters that break naive
 * string-interpolated HTML: ampersands ("Q&A", "R&D"), angle brackets in code snippets
 * ("<script>", "a < b"), quotes inside attributes. Every template must escape user-provided
 * text through this before interpolating it into markup.
 */

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Escape + preserve intentional newlines as <br> for short multi-line fields. */
function escapeHtmlMultiline(value) {
  return escapeHtml(value).replace(/\n/g, '<br>');
}

module.exports = { escapeHtml, escapeHtmlMultiline };
