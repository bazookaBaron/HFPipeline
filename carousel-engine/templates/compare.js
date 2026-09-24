/**
 * compare — 2 or 3 side-by-side columns, each headed by a NumberBadge so the columns read as
 * distinct numbered/colored options rather than an undifferentiated grid.
 * content: { heading, columns: [{ title, points: string[] }] }
 */
const { escapeHtml } = require('../lib/html');
const { numberBadge } = require('../lib/number-badge');
const { colorForIndex } = require('../lib/colors');

function render(content) {
  const { heading = '', columns = [] } = content;
  const n = Math.max(1, columns.length);

  const columnsHtml = columns
    .map((col, i) => {
      const color = colorForIndex(i);
      const points = (col.points || [])
        .map(
          (p) =>
            `<li class="compare-point fit-box" data-fit data-fit-max="24" data-fit-min="16" data-fit-lines="3">${escapeHtml(p)}</li>`
        )
        .join('');
      return `
      <div class="compare-col" style="--col-color:${color}">
        ${numberBadge(i, { size: '48px' })}
        <div class="compare-col-title fit-box" data-fit data-fit-max="28" data-fit-min="18" data-fit-lines="2">${escapeHtml(col.title || '')}</div>
        <ul class="compare-points">${points}</ul>
      </div>`;
    })
    .join('');

  const bodyHtml = `
    <div class="compare-slide">
      <div class="compare-heading fit-box" data-fit data-fit-max="50" data-fit-min="30" data-fit-lines="3">${escapeHtml(heading)}</div>
      <div class="compare-grid compare-grid-${n}">${columnsHtml}</div>
    </div>
  `;

  const extraCss = `
    .compare-slide { display: flex; flex-direction: column; flex: 1; }
    .compare-heading { height: 150px; font-weight: 800; line-height: 1.15; overflow: hidden; margin-bottom: 26px; }
    .compare-grid { flex: 1; display: grid; gap: 20px; }
    .compare-grid-1 { grid-template-columns: 1fr; }
    .compare-grid-2 { grid-template-columns: 1fr 1fr; }
    .compare-grid-3 { grid-template-columns: 1fr 1fr 1fr; }
    .compare-col {
      border-radius: 20px; border: 2px solid var(--col-color);
      padding: 24px 20px; display: flex; flex-direction: column; gap: 14px;
      background: color-mix(in srgb, var(--col-color) 6%, white);
    }
    .compare-col-title { height: 76px; font-weight: 800; line-height: 1.2; overflow: hidden; }
    .compare-points { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 14px; flex: 1; }
    .compare-point {
      height: 90px; font-weight: 450; line-height: 1.3; color: #333C48; overflow: hidden;
      padding-left: 18px; position: relative;
    }
    .compare-point::before {
      content: ""; position: absolute; left: 0; top: 8px; width: 8px; height: 8px;
      border-radius: 50%; background: var(--col-color);
    }
  `;

  return { bodyHtml, extraCss };
}

module.exports = { render };
