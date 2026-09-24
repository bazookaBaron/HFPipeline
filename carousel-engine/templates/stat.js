/**
 * stat — a single big-number stat highlight.
 * content: { eyebrow, statValue, statLabel, context }
 */
const { escapeHtml } = require('../lib/html');

function render(content) {
  const { eyebrow = '', statValue = '', statLabel = '', context = '' } = content;

  const bodyHtml = `
    <div class="stat-slide">
      ${eyebrow ? `<div class="kicker">${escapeHtml(eyebrow)}</div>` : ''}
      <div class="stat-value fit-box" data-fit data-fit-max="220" data-fit-min="80" data-fit-lines="1">${escapeHtml(statValue)}</div>
      <div class="stat-label fit-box" data-fit data-fit-max="40" data-fit-min="24" data-fit-lines="2">${escapeHtml(statLabel)}</div>
      ${context ? `<div class="stat-context fit-box" data-fit data-fit-max="28" data-fit-min="18" data-fit-lines="4">${escapeHtml(context)}</div>` : ''}
    </div>
  `;

  const extraCss = `
    .stat-slide { flex: 1; display: flex; flex-direction: column; justify-content: center; gap: 8px; }
    .stat-value {
      height: 260px; font-weight: 900; letter-spacing: -0.02em; color: #4C6FFF;
      display: flex; align-items: center; overflow: hidden; line-height: 1;
    }
    .stat-label { height: 100px; font-weight: 800; line-height: 1.2; overflow: hidden; margin-top: 10px; }
    .stat-context { height: 190px; color: #5B6472; font-weight: 450; line-height: 1.45; overflow: hidden; margin-top: 22px; }
  `;

  return { bodyHtml, extraCss };
}

module.exports = { render };
