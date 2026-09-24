/**
 * templates/index.js — registry mapping a slide `kind` string to its render module.
 * Every module exports render(content) => { bodyHtml, extraCss }.
 */
module.exports = {
  cover: require('./cover'),
  content: require('./content'),
  diagram: require('./diagram'),
  screenshot: require('./screenshot'),
  cta: require('./cta'),
  compare: require('./compare'),
  hub: require('./hub'),
  ranked: require('./ranked'),
  stat: require('./stat'),
  dsSnapshot: require('./dsSnapshot'),
};
