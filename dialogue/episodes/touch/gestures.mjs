// touch (copied from touch): gesture override applied after autoplan. Usage: node dialogue/compiler/autoplan.mjs touch --plan-md && node dialogue/episodes/touch/gestures.mjs
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
const here = path.dirname(fileURLToPath(import.meta.url)), f = path.join(here, 'shots.json'), E = JSON.parse(fs.readFileSync(f, 'utf8'));
const W = E.words, r2 = x => Math.round(x * 100) / 100;
const at = (line, word, nth = 0) => { const c = W.filter(w => w.line === line && w.w.toLowerCase().replace(/[^a-z0-9]/g, '') === word.replace(/[^a-z0-9]/g, '')); if (!c[nth]) throw new Error(`no word ${word} L${line}`); return c[nth].s; };
const DUR = { open_palm: [.38, .6], palm_up: [.34, .5], two_hand_open: [.4, .75], count: [.42, .5], palm_down: [.36, .55], flick: [.3, .3], hand_chest: [.4, .8], hands_lift: [.3, .75], hand_lift: [.3, .45], nod: [.12, .3], tilt: [.35, .8] };
// remove autoplan's filler gestures where a key-word gesture goes instead (filled in after the first autoplan run), then add: [line, actor, kind, word, nth]
// the dry button (L20) is a close-up on Walter, as the script marks it [CU] (autoplan gave ms_A)
{ const s = E.shots.find(s => s.line === 20 && s.cut === 'speaker'); s.rig = 'mcu_A'; s.plan = 'mcu_A'; s.cu = true; s.move = { type: 'hold', amt: 0 }; }
// gate f R4: Walter has no rig >= 15 deg from both #16 ms_A and the mcu_A button, so L18 ("People in Korea did") plays on Leo's
// reaction (listener shot, ms_B): Walter's own chain becomes ms_A -> mcu_A (16 deg + size step). Checked offline with gate_variety first.
{ const s = E.shots.find(s => s.line === 18 && s.cut === 'speaker'); s.rig = 'ms_B'; s.plan = 'seat_B'; s.subject = 'B'; s.cu = false; s.move = { type: 'hold', amt: 0 }; }
const drop = g => false;
E.gestures = E.gestures.filter(g => !drop(g));
const ADD = [[1, 'B', 'hand_chest', 'my'], [2, 'A', 'open_palm', 'glove'], [4, 'A', 'palm_up', 'water'], [4, 'A', 'open_palm', 'electricity'],
  [6, 'A', 'palm_down', 'rows'], [6, 'A', 'open_palm', 'columns'], [8, 'A', 'two_hand_open', 'hundreds'], [8, 'A', 'palm_down', 'second'],
  [10, 'A', 'hand_lift', 'steals'], [10, 'A', 'palm_up', 'you'], [11, 'B', 'hand_chest', 'finger\'s'], [12, 'A', 'open_palm', 'middle'],
  [14, 'A', 'flick', 'not'], [14, 'A', 'palm_up', 'water'], [16, 'A', 'palm_down', 'nobody'], [17, 'B', 'hand_chest', 'i']];
const notes = [];
for (const [line, actor, kind, word, nth = 0] of ADD) {
  const rise = DUR[kind][0], t = r2(at(line, word, nth) + 0.12), g = { actor, kind, t, rise, dur: DUR[kind][1], line, word };
  const s = E.shots.find(s => t >= s.t0 && t < s.t1), cl = E.gestures.find(x => x.actor === actor && x.line === line && ['open_palm', 'palm_up', 'hand_lift', 'two_hand_open', 'hands_lift', 'count', 'flick', 'palm_down', 'hand_chest'].includes(x.kind) && t - rise < x.t + x.dur && x.t - x.rise < t + g.dur + .1);
  if (!s || s.line !== line) { notes.push(`skip ${kind} "${word}" (outside its shot)`); continue; } if (cl) { notes.push(`skip ${kind} "${word}" (clash with ${cl.kind})`); continue; }
  E.gestures.push(g);
}
E.gestures.sort((a, b) => a.t - b.t); fs.writeFileSync(f, JSON.stringify(E, null, 1)); console.log('gestures', E.gestures.length, notes.join(' | '));
