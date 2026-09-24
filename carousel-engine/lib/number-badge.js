/**
 * number-badge.js — the shared `NumberBadge` component.
 *
 * A small numbered, colored chip used consistently everywhere a slide shows multiple
 * parallel items (compare columns, hub spokes, ranked rows) so they read as "item 2 of 3"
 * rather than an undifferentiated flat-monochrome list. Number + color both come from here so
 * every slide kind numbers and colors items the exact same way.
 *
 * Rendered server-side (Node) into the slide HTML string at generation time — the index of
 * each item is known when we build the page, so there's no need to compute this in-browser.
 */

const { colorForIndex } = require('./colors');
const { escapeHtml } = require('./html');

/**
 * @param {number} index 0-based position of this item among its siblings on the slide.
 * @param {object} [opts]
 * @param {string} [opts.label] override the badge's displayed text (default: index+1).
 * @param {'chip'|'dot'} [opts.variant] 'chip' (numbered circle, default) or 'dot' (no number,
 *   just a colored dot — used where a numeral would be redundant with the item's own rank).
 * @param {string} [opts.size] CSS size for the badge diameter, default '44px'.
 * @returns {string} an HTML fragment.
 */
function numberBadge(index, opts = {}) {
  const color = colorForIndex(index);
  const label = opts.label != null ? opts.label : String(index + 1);
  const size = opts.size || '44px';
  const variant = opts.variant || 'chip';

  if (variant === 'dot') {
    return `<span class="nb nb-dot" style="--nb-color:${color}; width:14px; height:14px;" aria-hidden="true"></span>`;
  }

  return (
    `<span class="nb nb-chip" style="--nb-color:${color}; width:${size}; height:${size};">` +
    `<span class="nb-label">${escapeHtml(label)}</span>` +
    `</span>`
  );
}

/** Shared CSS for the badge — included once in the base stylesheet. */
const NUMBER_BADGE_CSS = `
.nb {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  background: var(--nb-color);
  color: #fff;
}
.nb-chip {
  border-radius: 50%;
  font-weight: 800;
  font-size: 1.05rem;
  box-shadow: 0 2px 0 rgba(0,0,0,0.08);
}
.nb-chip .nb-label { line-height: 1; }
.nb-dot { border-radius: 50%; }
`;

module.exports = { numberBadge, NUMBER_BADGE_CSS };
