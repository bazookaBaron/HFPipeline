// gps2 (copied from gps): gesture override applied after autoplan. Usage: node dialogue/compiler/autoplan.mjs gps2 --plan-md && node dialogue/episodes/gps2/gestures.mjs
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
const here = path.dirname(fileURLToPath(import.meta.url)), f = path.join(here, 'shots.json'), E = JSON.parse(fs.readFileSync(f, 'utf8'));
const W = E.words, r2 = x => Math.round(x * 100) / 100;
const at = (line, word, nth = 0) => { const c = W.filter(w => w.line === line && w.w.toLowerCase().replace(/[^a-z0-9]/g, '') === word); if (!c[nth]) throw new Error(`no word ${word} L${line}`); return c[nth].s; };
const DUR = { open_palm: [.38, .6], palm_up: [.34, .5], two_hand_open: [.4, .75], count: [.42, .5], palm_down: [.36, .55], flick: [.3, .3], hand_chest: [.4, .8], hands_lift: [.3, .75], hand_lift: [.3, .45], nod: [.12, .3], tilt: [.35, .8] };
// remove autoplan's filler gestures on these lines, then add the key-word ones: [line, actor, kind, word, nth]
const drop = g => (g.line === 14 && (g.kind === 'shoulder_bounce' || g.kind === 'nod')) || (g.line === 16 && (g.kind === 'shoulder_bounce' || g.kind === 'nod')) || (g.line === 4 && g.kind === 'shoulder_bounce') || (g.line === 13 && g.kind === 'two_hand_open');
E.gestures = E.gestures.filter(g => !drop(g));
const ADD = [[6, 'A', 'open_palm', 'distance'], [8, 'A', 'two_hand_open', 'ball'], [7, 'B', 'palm_up', 'satellite'], [12, 'A', 'open_palm', 'einstein'], [12, 'A', 'palm_down', 'day'],
  [13, 'B', 'hand_chest', 'my'], [14, 'A', 'flick', 'skip'], [16, 'A', 'open_palm', 'maps'], [4, 'A', 'palm_down', 'late'], [2, 'A', 'hand_lift', 'up'], [18, 'A', 'palm_up', 'lost']];
const notes = [];
for (const [line, actor, kind, word, nth = 0] of ADD) {
  const rise = DUR[kind][0], t = r2(at(line, word, nth) + 0.12), g = { actor, kind, t, rise, dur: DUR[kind][1], line, word };
  const s = E.shots.find(s => t >= s.t0 && t < s.t1), cl = E.gestures.find(x => x.actor === actor && x.line === line && ['open_palm', 'palm_up', 'hand_lift', 'two_hand_open', 'hands_lift', 'count', 'flick', 'palm_down', 'hand_chest'].includes(x.kind) && t - rise < x.t + x.dur && x.t - x.rise < t + g.dur + .1);
  if (!s || s.line !== line) { notes.push(`skip ${kind} "${word}" (outside its shot)`); continue; } if (cl) { notes.push(`skip ${kind} "${word}" (clash with ${cl.kind})`); continue; }
  E.gestures.push(g);
}
E.gestures.sort((a, b) => a.t - b.t); fs.writeFileSync(f, JSON.stringify(E, null, 1)); console.log('gestures', E.gestures.length, notes.join(' | '));
