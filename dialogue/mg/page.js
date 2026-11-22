// Preview page: MG over a stand-in scene (a real hero render from spike1) so the 9:16 blur and the 16:9 dotted back canvas are visible.
// window.load(name) builds an example, window.frame(t) seeks. The MG draws its own back canvas (16:9) and card backdrop blur (9:16).
import { createMG } from './index.js';
import { examples, chain } from './examples/index.js';
const q = new URLSearchParams(location.search); const W = +q.get('w'), H = +q.get('h'), ratio = W > H ? '16x9' : '9x16';
const root = document.getElementById('root'), bg = document.getElementById('bg'); root.style.width = W + 'px'; root.style.height = H + 'px';
bg.style.background = `#0E1621 url(examples/backdrop/hero_wide_${ratio}.png) center/cover no-repeat`;
let mg = null;
window.load = async (name, opts = {}) => {
  mg?.destroy(); mg = createMG({ root, ratio, base: new URL('./', location.href).href });
  if (name === 'chain') chain(mg, opts); else examples[name].fn(mg, { at: 0, dur: opts.dur ?? 7, k: 1 });
  await mg.build(); window.mg = mg; return mg.lint();
};
// Episode MG (engine contract): import the episode's mg.js, call addCues(mg, {ratio}) before build. Returns lint + cue data for render.mjs.
window.loadEpisode = async url => {
  mg?.destroy(); mg = createMG({ root, ratio, base: new URL('./', location.href).href }); const m = await import(url); m.default(mg, { ratio }); await mg.build(); window.mg = mg; window.__ep = m;
  return { lint: mg.lint(), data: m.DATA, checks: m.CHECKS };
};
// every iso subject's bbox must lie inside its card (margins: 20 px sides, 64 px top below the header, 48 px bottom)
window.isoCheck = () => window.__ep.CHECKS.flatMap(c => { const wd = mg.iso.worlds.find(x => x.cue === c.cue); return c.ids.map(id => { const bb = wd.w.bbox(id, c.t), ok = bb.x0 >= 20 && bb.x1 <= wd.W - 20 && bb.y0 >= 64 && bb.y1 <= wd.H - 48; return { cue: c.cue, t: c.t, id, ok, bbox: Object.fromEntries(Object.entries(bb).map(([k, v]) => [k, Math.round(v)])), card: [wd.W, wd.H] }; }); });
window.frame = t => { mg.seek(t); };
window.__ready = true;
