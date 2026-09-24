/**
 * ranked — a ranked list (1..N), each row numbered/colored via the shared NumberBadge.
 * content: { heading, items: [{ title, detail }] }
 */
const { escapeHtml } = require('../lib/html');
const { numberBadge } = require('../lib/number-badge');
const { colorForIndex } = require('../lib/colors');

function render(content) {
  const { heading = '', items = [] } = content;

  const rowsHtml = items
    .map((item, i) => {
      const color = colorForIndex(i);
      return `
      <li class="ranked-row" style="--row-color:${color}">
        ${numberBadge(i, { size: '52px' })}
        <div class="ranked-row-text">
          <div class="ranked-row-title fit-box" data-fit data-fit-max="30" data-fit-min="19" data-fit-lines="2">${escapeHtml(item.title || '')}</div>
          ${item.detail ? `<div class="ranked-row-detail fit-box" data-fit data-fit-max="22" data-fit-min="15" data-fit-lines="2">${escapeHtml(item.detail)}</div>` : ''}
        </div>
      </li>`;
    })
    .join('');

  const bodyHtml = `
    <div class="ranked-slide">
      <div class="ranked-heading fit-box" data-fit data-fit-max="50" data-fit-min="30" data-fit-lines="3">${escapeHtml(heading)}</div>
      <ul class="ranked-list">${rowsHtml}</ul>
    </div>
  `;

  const extraCss = `
    .ranked-slide { display: flex; flex-direction: column; flex: 1; }
    .ranked-heading { height: 140px; font-weight: 800; line-height: 1.15; overflow: hidden; margin-bottom: 20px; }
    .ranked-list { list-style: none; margin: 0; padding: 0; flex: 1; display: flex; flex-direction: column; gap: 18px; }
    .ranked-row {
      display: flex; align-items: center; gap: 22px;
      background: color-mix(in srgb, var(--row-color) 6%, white);
      border-left: 6px solid var(--row-color);
      border-radius: 14px; padding: 18px 22px;
    }
    .ranked-row-text { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px; }
    .ranked-row-title { height: 74px; font-weight: 700; line-height: 1.2; overflow: hidden; display:flex; align-items:center; }
    .ranked-row-detail { height: 56px; color: #5B6472; font-weight: 450; line-height: 1.25; overflow: hidden; }
  `;

  return { bodyHtml, extraCss };
}

module.exports = { render };
