/**
 * content — a heading plus either a paragraph or a short bullet list.
 * content: { eyebrow, heading, body: string | string[] }
 */
const { escapeHtml } = require('../lib/html');

function render(content) {
  const { eyebrow = '', heading = '', body = '' } = content;
  const bullets = Array.isArray(body) ? body : null;

  let bodySection;
  if (bullets) {
    const items = bullets
      .map(
        (b, i) => `
        <li class="content-bullet">
          <span class="content-bullet-mark"></span>
          <span class="content-bullet-text fit-box" data-fit data-fit-max="34" data-fit-min="22" data-fit-lines="3">${escapeHtml(b)}</span>
        </li>`
      )
      .join('');
    bodySection = `<ul class="content-bullets">${items}</ul>`;
  } else {
    bodySection = `<div class="content-body fit-box" data-fit data-fit-max="38" data-fit-min="24" data-fit-lines="9">${escapeHtml(body)}</div>`;
  }

  const bodyHtml = `
    <div class="content-slide">
      ${eyebrow ? `<div class="kicker">${escapeHtml(eyebrow)}</div>` : ''}
      <div class="content-heading fit-box" data-fit data-fit-max="58" data-fit-min="32" data-fit-lines="3">${escapeHtml(heading)}</div>
      ${bodySection}
    </div>
  `;

  const extraCss = `
    .content-slide { display: flex; flex-direction: column; flex: 1; padding-top: 20px; }
    .content-heading {
      height: 210px; font-weight: 800; line-height: 1.12; letter-spacing: -0.005em;
      overflow: hidden; margin-bottom: 28px;
    }
    .content-body {
      height: 640px; font-weight: 450; line-height: 1.5; color: #333C48;
      overflow: hidden; white-space: pre-wrap;
    }
    .content-bullets { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 22px; }
    .content-bullet { display: flex; align-items: flex-start; gap: 18px; }
    .content-bullet-mark {
      flex-shrink: 0; width: 14px; height: 14px; margin-top: 10px; border-radius: 4px;
      background: #4C6FFF;
    }
    .content-bullet-text {
      height: 130px; flex: 1; font-weight: 500; line-height: 1.4; color: #1B2330;
      overflow: hidden;
    }
  `;

  return { bodyHtml, extraCss };
}

module.exports = { render };
