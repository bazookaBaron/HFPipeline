/**
 * cover — the first slide of a carousel: kicker + big title + subtitle.
 * content: { kicker, title, subtitle }
 */
const { escapeHtml } = require('../lib/html');

function render(content) {
  const { kicker = '', title = '', subtitle = '' } = content;

  const bodyHtml = `
    <div class="cover">
      ${kicker ? `<div class="kicker">${escapeHtml(kicker)}</div>` : ''}
      <div class="cover-accent-bar"></div>
      <div class="cover-title fit-box" data-fit data-fit-max="84" data-fit-min="40" data-fit-lines="5">${escapeHtml(title)}</div>
      ${subtitle ? `<div class="cover-subtitle fit-box" data-fit data-fit-max="36" data-fit-min="22" data-fit-lines="4">${escapeHtml(subtitle)}</div>` : ''}
      <div class="cover-swipe">Swipe to see how &rarr;</div>
    </div>
  `;

  const extraCss = `
    .cover { display: flex; flex-direction: column; justify-content: center; flex: 1; }
    .cover-accent-bar { width: 96px; height: 8px; border-radius: 4px; background: var(--brand-accent, #4C6FFF); margin-bottom: 28px; }
    .cover-title {
      height: 460px;
      font-weight: 800; line-height: 1.08; letter-spacing: -0.01em;
      display: flex; align-items: flex-start;
      overflow: hidden;
    }
    .cover-subtitle {
      height: 190px;
      margin-top: 24px;
      font-weight: 500; line-height: 1.35; color: #5B6472;
      overflow: hidden;
    }
    .cover-swipe {
      position: absolute; left: 76px; bottom: 118px;
      font-size: 22px; font-weight: 700; color: #4C6FFF;
    }
  `;

  return { bodyHtml, extraCss };
}

module.exports = { render };
