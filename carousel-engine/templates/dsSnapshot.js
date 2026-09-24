/**
 * dsSnapshot — a labeled visual snapshot of a data structure's state at one moment
 * (e.g. an array/cache with some cells highlighted, optional pointer callouts).
 * content: {
 *   heading, structureType,
 *   cells: [{ value, sub?, highlighted? }],
 *   pointers?: [{ index, label }],
 *   caption
 * }
 */
const { escapeHtml } = require('../lib/html');
const { colorForIndex } = require('../lib/colors');

function render(content) {
  const { heading = '', structureType = '', cells = [], pointers = [], caption = '' } = content;

  const pointerByIndex = {};
  pointers.forEach((p) => {
    pointerByIndex[p.index] = p.label;
  });

  const cellsHtml = cells
    .map((cell, i) => {
      const pointerLabel = pointerByIndex[i];
      const highlightColor = cell.highlighted ? colorForIndex(i) : null;
      return `
      <div class="ds-cell-col">
        ${
          pointerLabel
            ? `<div class="ds-pointer-label fit-box" data-fit data-fit-max="18" data-fit-min="12" data-fit-lines="1">${escapeHtml(pointerLabel)}</div><div class="ds-pointer-arrow">&#8595;</div>`
            : `<div class="ds-pointer-label ds-pointer-label--empty"></div><div class="ds-pointer-arrow ds-pointer-arrow--empty"></div>`
        }
        <div class="ds-cell${cell.highlighted ? ' is-highlighted' : ''}" style="${highlightColor ? `--cell-color:${highlightColor}` : ''}">
          <div class="ds-cell-value fit-box" data-fit data-fit-max="26" data-fit-min="14" data-fit-lines="2">${escapeHtml(cell.value != null ? String(cell.value) : '')}</div>
        </div>
        <div class="ds-cell-index">${i}</div>
      </div>`;
    })
    .join('');

  const bodyHtml = `
    <div class="ds-slide">
      <div class="ds-heading fit-box" data-fit data-fit-max="46" data-fit-min="28" data-fit-lines="3">${escapeHtml(heading)}</div>
      ${structureType ? `<div class="ds-type fit-box" data-fit data-fit-max="24" data-fit-min="16" data-fit-lines="1">${escapeHtml(structureType)}</div>` : ''}
      <div class="ds-cells">${cellsHtml}</div>
      ${caption ? `<div class="ds-caption fit-box" data-fit data-fit-max="26" data-fit-min="17" data-fit-lines="4">${escapeHtml(caption)}</div>` : ''}
    </div>
  `;

  const extraCss = `
    .ds-slide { display: flex; flex-direction: column; flex: 1; }
    .ds-heading { height: 140px; font-weight: 800; line-height: 1.15; overflow: hidden; margin-bottom: 6px; }
    .ds-type { height: 34px; color: #4C6FFF; font-weight: 700; overflow: hidden; margin-bottom: 36px; text-transform: uppercase; letter-spacing: 0.06em; }
    .ds-cells { display: flex; flex-wrap: wrap; gap: 14px; align-items: flex-end; justify-content: flex-start; }
    .ds-cell-col { display: flex; flex-direction: column; align-items: center; width: 118px; }
    .ds-pointer-label {
      height: 26px; font-weight: 700; color: #0B1220; overflow: hidden; text-align: center; width: 100%;
    }
    .ds-pointer-label--empty { visibility: hidden; }
    .ds-pointer-arrow { height: 22px; text-align: center; color: #0B1220; line-height: 1; }
    .ds-pointer-arrow--empty { visibility: hidden; }
    .ds-cell {
      width: 108px; height: 108px; border-radius: 14px;
      border: 2px solid #D9DEE7; background: #F7F8FB;
      display: flex; align-items: center; justify-content: center;
      margin-top: 4px;
    }
    .ds-cell.is-highlighted { border-color: var(--cell-color); background: color-mix(in srgb, var(--cell-color) 14%, white); }
    .ds-cell-value { width: 100%; text-align: center; font-weight: 800; overflow: hidden; display:flex; align-items:center; justify-content:center; }
    .ds-cell-index { margin-top: 8px; font-size: 18px; color: #9AA3B2; font-weight: 600; }
    .ds-caption { height: 100px; margin-top: auto; color: #5B6472; font-weight: 450; line-height: 1.4; overflow: hidden; }
  `;

  return { bodyHtml, extraCss };
}

module.exports = { render };
