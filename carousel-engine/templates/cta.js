/**
 * cta — closing call-to-action slide.
 * content: { heading, subtext, buttonText, handle }
 */
const { escapeHtml } = require('../lib/html');

function render(content) {
  const { heading = '', subtext = '', buttonText = '', handle = '' } = content;

  const bodyHtml = `
    <div class="cta-slide">
      <div class="cta-heading fit-box" data-fit data-fit-max="62" data-fit-min="34" data-fit-lines="4">${escapeHtml(heading)}</div>
      ${subtext ? `<div class="cta-subtext fit-box" data-fit data-fit-max="32" data-fit-min="20" data-fit-lines="3">${escapeHtml(subtext)}</div>` : ''}
      ${
        buttonText
          ? `<div class="cta-button"><span class="cta-button-text fit-box" data-fit data-fit-max="30" data-fit-min="20" data-fit-lines="1">${escapeHtml(buttonText)}</span></div>`
          : ''
      }
      ${handle ? `<div class="cta-handle fit-box" data-fit data-fit-max="26" data-fit-min="18" data-fit-lines="1">${escapeHtml(handle)}</div>` : ''}
    </div>
  `;

  const extraCss = `
    .cta-slide { flex: 1; display: flex; flex-direction: column; justify-content: center; align-items: flex-start; gap: 26px; }
    .cta-heading { width: 100%; height: 320px; font-weight: 800; line-height: 1.12; overflow: hidden; }
    .cta-subtext { width: 100%; height: 140px; color: #5B6472; font-weight: 500; line-height: 1.4; overflow: hidden; }
    .cta-button {
      background: #4C6FFF; border-radius: 999px; padding: 22px 40px;
      display: inline-flex; align-items: center; justify-content: center;
      margin-top: 8px; max-width: 820px;
    }
    .cta-button-text {
      height: 40px; max-width: 740px; color: #fff; font-weight: 700; overflow: hidden;
      display: flex; align-items: center; white-space: nowrap;
    }
    .cta-handle { height: 34px; color: #4C6FFF; font-weight: 700; overflow: hidden; margin-top: 4px; }
  `;

  return { bodyHtml, extraCss };
}

module.exports = { render };
