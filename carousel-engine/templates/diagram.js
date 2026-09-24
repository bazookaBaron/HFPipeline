/**
 * diagram — a simple vertical flow of labeled steps connected by arrows.
 * content: { heading, steps: [{ label, detail }] }
 */
const { escapeHtml } = require('../lib/html');

function render(content) {
  const { heading = '', steps = [] } = content;

  const stepHtml = steps
    .map((s, i) => {
      const isLast = i === steps.length - 1;
      return `
      <div class="diagram-step">
        <div class="diagram-node">
          <div class="diagram-node-label fit-box" data-fit data-fit-max="28" data-fit-min="18" data-fit-lines="2">${escapeHtml(s.label || '')}</div>
          ${s.detail ? `<div class="diagram-node-detail fit-box" data-fit data-fit-max="22" data-fit-min="15" data-fit-lines="2">${escapeHtml(s.detail)}</div>` : ''}
        </div>
        ${isLast ? '' : '<div class="diagram-arrow">&#8595;</div>'}
      </div>`;
    })
    .join('');

  const bodyHtml = `
    <div class="diagram-slide">
      <div class="diagram-heading fit-box" data-fit data-fit-max="50" data-fit-min="30" data-fit-lines="3">${escapeHtml(heading)}</div>
      <div class="diagram-flow">${stepHtml}</div>
    </div>
  `;

  const extraCss = `
    .diagram-slide { display: flex; flex-direction: column; flex: 1; }
    .diagram-heading { height: 150px; font-weight: 800; line-height: 1.15; overflow: hidden; margin-bottom: 20px; }
    .diagram-flow { flex: 1; display: flex; flex-direction: column; justify-content: center; gap: 0; }
    .diagram-step { display: flex; flex-direction: column; align-items: stretch; }
    .diagram-node {
      background: #F3F5FA; border: 2px solid #E1E6EF; border-radius: 18px;
      padding: 22px 26px; min-height: 118px;
      display: flex; flex-direction: column; justify-content: center; gap: 8px;
    }
    .diagram-node-label { height: 66px; font-weight: 700; line-height: 1.2; color: #0B1220; overflow: hidden; display: flex; align-items: center; }
    .diagram-node-detail { height: 44px; font-weight: 450; line-height: 1.25; color: #5B6472; overflow: hidden; }
    .diagram-arrow { text-align: center; font-size: 34px; color: #4C6FFF; padding: 6px 0; line-height: 1; }
  `;

  return { bodyHtml, extraCss };
}

module.exports = { render };
