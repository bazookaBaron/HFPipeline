/**
 * hub — a hub/spoke layout: one central concept with N radiating items, connected by lines.
 * content: { heading, hubLabel, spokes: [{ label, detail }] } (spokes: recommended 3-6)
 *
 * Positions are computed server-side (Node) since the spoke count is known at generation
 * time — evenly distributed around a circle, connecting lines drawn as an SVG underlay.
 */
const { escapeHtml } = require('../lib/html');
const { numberBadge } = require('../lib/number-badge');
const { colorForIndex } = require('../lib/colors');

const AREA_W = 928; // slide content width (1080 - 2*76 padding)
const AREA_H = 860;
const CX = AREA_W / 2;
const CY = AREA_H / 2 + 20;
const RADIUS = 330;
const HUB_R = 110;
const SPOKE_W = 230;
const SPOKE_H = 170;

function render(content) {
  const { heading = '', hubLabel = '', spokes = [] } = content;
  const n = Math.max(1, spokes.length);

  const lines = [];
  const spokeBoxes = [];

  spokes.forEach((spoke, i) => {
    const angle = (2 * Math.PI * i) / n - Math.PI / 2; // start at top, clockwise
    const sx = CX + RADIUS * Math.cos(angle);
    const sy = CY + RADIUS * Math.sin(angle);
    const hubEdgeX = CX + HUB_R * Math.cos(angle);
    const hubEdgeY = CY + HUB_R * Math.sin(angle);
    const color = colorForIndex(i);

    lines.push(
      `<line x1="${hubEdgeX.toFixed(1)}" y1="${hubEdgeY.toFixed(1)}" x2="${sx.toFixed(1)}" y2="${sy.toFixed(1)}" stroke="${color}" stroke-width="3" stroke-dasharray="2,8" stroke-linecap="round" />`
    );

    spokeBoxes.push(`
      <div class="hub-spoke" style="--spoke-color:${color}; left:${(sx - SPOKE_W / 2).toFixed(1)}px; top:${(sy - SPOKE_H / 2).toFixed(1)}px;">
        ${numberBadge(i, { size: '38px' })}
        <div class="hub-spoke-label fit-box" data-fit data-fit-max="22" data-fit-min="14" data-fit-lines="2">${escapeHtml(spoke.label || '')}</div>
        ${spoke.detail ? `<div class="hub-spoke-detail fit-box" data-fit data-fit-max="17" data-fit-min="12" data-fit-lines="2">${escapeHtml(spoke.detail)}</div>` : ''}
      </div>`);
  });

  const bodyHtml = `
    <div class="hub-slide">
      <div class="hub-heading fit-box" data-fit data-fit-max="46" data-fit-min="28" data-fit-lines="3">${escapeHtml(heading)}</div>
      <div class="hub-area" style="width:${AREA_W}px; height:${AREA_H}px;">
        <svg class="hub-lines" width="${AREA_W}" height="${AREA_H}" viewBox="0 0 ${AREA_W} ${AREA_H}">
          ${lines.join('')}
        </svg>
        <div class="hub-center" style="width:${HUB_R * 2}px; height:${HUB_R * 2}px; left:${(CX - HUB_R).toFixed(1)}px; top:${(CY - HUB_R).toFixed(1)}px;">
          <div class="hub-center-label fit-box" data-fit data-fit-max="26" data-fit-min="16" data-fit-lines="3">${escapeHtml(hubLabel)}</div>
        </div>
        ${spokeBoxes.join('')}
      </div>
    </div>
  `;

  const extraCss = `
    .hub-slide { display: flex; flex-direction: column; flex: 1; }
    .hub-heading { height: 140px; font-weight: 800; line-height: 1.15; overflow: hidden; margin-bottom: 8px; }
    .hub-area { position: relative; margin: 0 auto; }
    .hub-lines { position: absolute; left: 0; top: 0; }
    .hub-center {
      position: absolute; border-radius: 50%; background: #4C6FFF; color: #fff;
      display: flex; align-items: center; justify-content: center; text-align: center;
      padding: 14px; box-shadow: 0 12px 30px rgba(76,111,255,0.35);
    }
    .hub-center-label { width: 100%; font-weight: 800; line-height: 1.2; overflow: hidden; display:flex; align-items:center; justify-content:center; text-align:center; }
    .hub-spoke {
      position: absolute; width: ${SPOKE_W}px; height: ${SPOKE_H}px;
      background: #fff; border: 2px solid var(--spoke-color); border-radius: 16px;
      padding: 14px; display: flex; flex-direction: column; align-items: center; gap: 6px;
      text-align: center; box-shadow: 0 8px 18px rgba(11,18,32,0.08);
    }
    .hub-spoke-label { width: 100%; font-weight: 700; line-height: 1.2; overflow: hidden; }
    .hub-spoke-detail { width: 100%; color: #5B6472; font-weight: 450; line-height: 1.2; overflow: hidden; }
  `;

  return { bodyHtml, extraCss };
}

module.exports = { render };
