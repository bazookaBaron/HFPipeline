/**
 * colors.js — brand palette for carousel slides.
 *
 * Two deliberately separate concepts (a real bug in the old pipeline was conflating them):
 *
 * 1. BRAND_ACCENT: ONE fixed color used for chrome — the wordmark/handle, the page-dot
 *    indicator, the cover kicker, CTA buttons. This is the "this is our brand" color and it
 *    never rotates.
 *
 * 2. ROTATION: a small palette used ONLY to visually distinguish parallel/sibling items
 *    within a single slide (columns in `compare`, spokes in `hub`, rows in `ranked`,
 *    NumberBadge fills generally). Rotates by index so a 3-column compare slide or a 5-item
 *    ranked list doesn't render as a flat wall of one color. Deliberately excludes
 *    BRAND_ACCENT itself so brand chrome always reads as visually distinct from "item N of
 *    many" coloring.
 */

const BRAND_ACCENT = '#4C6FFF'; // indigo-blue — wordmark, page dots, CTA buttons, kickers
const BRAND_INK = '#0B1220'; // near-black text color
const BRAND_PAPER = '#FFFFFF'; // slide background
const BRAND_MUTED = '#5B6472'; // secondary/body text gray

// Rotation table for numbering parallel items — 8 colors, chosen for mutual contrast and to
// stay readable as both a filled chip background (with white text) and a thin accent bar.
const ROTATION = [
  '#FF6B6B', // coral red
  '#12B886', // teal green
  '#FFB020', // amber
  '#8E5CFF', // violet
  '#00A8E8', // sky blue
  '#FF7A45', // orange
  '#2ED47A', // mint
  '#E64980', // magenta
];

function colorForIndex(i) {
  return ROTATION[((i % ROTATION.length) + ROTATION.length) % ROTATION.length];
}

module.exports = {
  BRAND_ACCENT,
  BRAND_INK,
  BRAND_PAPER,
  BRAND_MUTED,
  ROTATION,
  colorForIndex,
};
