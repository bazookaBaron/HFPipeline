// incognito: shot/gesture override applied after autoplan. Usage: node dialogue/compiler/autoplan.mjs incognito --plan-md && node dialogue/episodes/incognito/gestures.mjs
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
const here = path.dirname(fileURLToPath(import.meta.url)), f = path.join(here, 'shots.json'), E = JSON.parse(fs.readFileSync(f, 'utf8'));
const W = E.words, r2 = x => Math.round(x * 100) / 100;
const at = (line, word, nth = 0) => { const c = W.filter(w => w.line === line && w.w.toLowerCase().replace(/[^a-z0-9]/g, '') === word.replace(/[^a-z0-9]/g, '')); if (!c[nth]) throw new Error(`no word ${word} L${line}`); return c[nth].s; };
const DUR = { open_palm: [.38, .6], palm_up: [.34, .5], two_hand_open: [.4, .75], count: [.42, .5], palm_down: [.36, .55], flick: [.3, .3], hand_chest: [.4, .8], hands_lift: [.3, .75], hand_lift: [.3, .45], nod: [.12, .3], tilt: [.35, .8] };
// gate f R4: #2 and #5 were both ms_A (short Walter shots under cards: autoplan cannot pick another rig), so shot #2 becomes a close-up (size step vs ms_A)
{ const s = E.shots.find(s => s.n === 2); if (s && s.rig === 'ms_A') Object.assign(s, { rig: 'mcu_A', plan: 'mcu_A', cu: true, move: { type: 'hold', amt: 0 } }); }
// (Walter's long fingers: no finger-count gestures for him in this episode)
const drop = g => (g.line === 2 && g.actor === 'A') || (g.line === 10 && g.actor === 'A') || (g.line === 16 && g.actor === 'A') || (g.line === 18 && g.kind === 'head_shake');
E.gestures = E.gestures.filter(g => !drop(g));
const ADD = [[2, 'A', 'palm_down', 'nobody'], [4, 'A', 'palm_up', 'internet'], [6, 'A', 'two_hand_open', 'postman'], [6, 'A', 'flick', 'reads'], [8, 'A', 'palm_down', 'forgets'], [10, 'A', 'palm_down', 'wiping'],
  [10, 'A', 'open_palm', 'waiter'], [12, 'A', 'hand_chest', 'name'], [14, 'A', 'palm_down', 'touch'], [16, 'A', 'palm_up', 'sister'], [3, 'B', 'palm_up', 'who'], [9, 'B', 'palm_up', 'all'], [11, 'B', 'hand_chest', 'wait']];
const notes = [];
for (const [line, actor, kind, word, nth = 0] of ADD) {
  const rise = DUR[kind][0], t = r2(at(line, word, nth) + 0.12), g = { actor, kind, t, rise, dur: DUR[kind][1], line, word };
  const s = E.shots.find(s => t >= s.t0 && t < s.t1), cl = E.gestures.find(x => x.actor === actor && x.line === line && ['open_palm', 'palm_up', 'hand_lift', 'two_hand_open', 'hands_lift', 'count', 'flick', 'palm_down', 'hand_chest'].includes(x.kind) && t - rise < x.t + x.dur && x.t - x.rise < t + g.dur + .1);
  if (!s || s.line !== line) { notes.push(`skip ${kind} "${word}" (outside its shot)`); continue; } if (cl) { notes.push(`skip ${kind} "${word}" (clash with ${cl.kind})`); continue; }
  E.gestures.push(g);
}
E.gestures.sort((a, b) => a.t - b.t); fs.writeFileSync(f, JSON.stringify(E, null, 1)); console.log('gestures', E.gestures.length, notes.join(' | '));
