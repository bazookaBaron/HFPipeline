"use strict";
// Metadata-level quality gate: minimum width by slot size, aspect sanity, no upscale > 1.5x
// at the requested slot size (cover fit for full-bleed, contain for cards).

const MAX_UPSCALE = 1.5;

// slot geometry at 1920x1080. minW is the floor on the delivered image width.
const SIZES = {
  full: { w: 1920, h: 1080, fit: "cover", minW: 1280, aspect: [1.2, 2.6] },
  card: { w: 1100, h: 0, fit: "contain", minW: 800, aspect: [0.6, 2.6] },
  portrait: { w: 640, h: 0, fit: "contain", minW: 480, aspect: [0.5, 1.6] },
  logo: { w: 480, h: 0, fit: "contain", minW: 320, aspect: [0.15, 8] },
  map: { w: 1100, h: 0, fit: "contain", minW: 800, aspect: [0.45, 2.8] },
};

const DEFAULT_SIZE = { photo: "full", video: "full", illustration: "full", portrait: "portrait", logo: "logo", map: "map" };

function slotSize(intent) {
  const name = intent.size && SIZES[intent.size] ? intent.size : DEFAULT_SIZE[intent.kind] || "full";
  const s = { name, ...SIZES[name] };
  if (intent.minWidth) s.minW = Number(intent.minWidth);
  return s;
}

/** @returns {string[]} problems (empty = pass) */
function qualityProblems(c, intent) {
  const s = slotSize(intent);
  const p = [];
  const w = c.width || 0;
  const h = c.height || 0;
  if (!w || !h) return ["unknown size"];
  if (c.vector) return []; // SVG rasterised at the requested width: any size is fine
  const a = w / h;
  if (a < s.aspect[0] || a > s.aspect[1]) p.push(`aspect ${a.toFixed(2)} outside ${s.aspect[0]}-${s.aspect[1]} for ${s.name}`);
  if (w < s.minW) p.push(`width ${w} < ${s.minW} (${s.name})`);
  const scale = upscale(c, s);
  if (scale > MAX_UPSCALE) p.push(`upscale ${scale.toFixed(2)}x > ${MAX_UPSCALE}x`);
  return p;
}

function upscale(c, s) {
  if (s.fit === "cover" && s.h) return Math.max(s.w / c.width, s.h / c.height);
  return s.w / c.width;
}

module.exports = { qualityProblems, slotSize, upscale, SIZES, MAX_UPSCALE };
