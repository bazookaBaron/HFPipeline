/**
 * screenshot — a framed "app/code screenshot" slide.
 * content: { heading, caption, imageSrc? (resolved file:// or data: URL), codeLines? (string[]) }
 *
 * Two supported sub-cases:
 *  - a real screenshot image (content.imageSrc, already resolved to a loadable URL by
 *    render.js) shown inside a browser-chrome frame, OR
 *  - no image supplied: renders a code/terminal mock frame from content.codeLines so the
 *    slide kind is still usable without sourcing a binary screenshot asset.
 */
const { escapeHtml } = require('../lib/html');

function render(content) {
  const { heading = '', caption = '', imageSrc = '', codeLines = [] } = content;

  const frameInner = imageSrc
    ? `<img class="screenshot-img" src="${escapeHtml(imageSrc)}" alt="">`
    : `<div class="screenshot-code">
        ${codeLines
          .map(
            (line) =>
              `<div class="screenshot-code-line"><span class="screenshot-code-text">${escapeHtml(line)}</span></div>`
          )
          .join('')}
      </div>`;

  const bodyHtml = `
    <div class="screenshot-slide">
      <div class="screenshot-heading fit-box" data-fit data-fit-max="46" data-fit-min="28" data-fit-lines="3">${escapeHtml(heading)}</div>
      <div class="screenshot-frame">
        <div class="screenshot-frame-bar">
          <span class="dot" style="background:#FF6B6B"></span>
          <span class="dot" style="background:#FFB020"></span>
          <span class="dot" style="background:#12B886"></span>
        </div>
        <div class="screenshot-frame-body">${frameInner}</div>
      </div>
      ${caption ? `<div class="screenshot-caption fit-box" data-fit data-fit-max="26" data-fit-min="18" data-fit-lines="2">${escapeHtml(caption)}</div>` : ''}
    </div>
  `;

  const extraCss = `
    .screenshot-slide { display: flex; flex-direction: column; flex: 1; }
    .screenshot-heading { height: 130px; font-weight: 800; line-height: 1.15; overflow: hidden; margin-bottom: 22px; }
    .screenshot-frame {
      flex: 1; border-radius: 20px; overflow: hidden;
      border: 1px solid #E1E6EF; box-shadow: 0 18px 40px rgba(11,18,32,0.10);
      display: flex; flex-direction: column;
    }
    .screenshot-frame-bar { background: #EDEFF4; padding: 14px 18px; display: flex; gap: 8px; }
    .screenshot-frame-bar .dot { width: 12px; height: 12px; border-radius: 50%; }
    .screenshot-frame-body { flex: 1; background: #0F1420; overflow: hidden; }
    .screenshot-img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .screenshot-code { padding: 28px 30px; font-family: "Cascadia Code", Consolas, "Courier New", monospace; }
    .screenshot-code-line { padding: 5px 0; }
    .screenshot-code-text { color: #B9E4C9; font-size: 24px; white-space: pre; }
    .screenshot-caption { height: 60px; margin-top: 18px; color: #5B6472; font-weight: 500; overflow: hidden; }
  `;

  return { bodyHtml, extraCss };
}

module.exports = { render };
