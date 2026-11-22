// faceid: shot/gesture override applied after autoplan. Usage: node dialogue/compiler/autoplan.mjs faceid --plan-md && node dialogue/episodes/faceid/gestures.mjs
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
const here = path.dirname(fileURLToPath(import.meta.url)), f = path.join(here, 'shots.json'), E = JSON.parse(fs.readFileSync(f, 'utf8'));
const W = E.words, r2 = x => Math.round(x * 100) / 100;
const at = (line, word, nth = 0) => { const c = W.filter(w => w.line === line && w.w.toLowerCase().replace(/[^a-z0-9]/g, '') === word.replace(/[^a-z0-9]/g, '')); if (!c[nth]) throw new Error(`no word ${word} L${line}`); return c[nth].s; };
const DUR = { open_palm: [.38, .6], palm_up: [.34, .5], two_hand_open: [.4, .75], count: [.42, .5], palm_down: [.36, .55], flick: [.3, .3], hand_chest: [.4, .8], hands_lift: [.3, .75], hand_lift: [.3, .45], nod: [.12, .3], tilt: [.35, .8] };
// gate f R4: #14 and #16 were both ms_A, and mcu_A/arc_A are only 11.8 deg apart: #16 becomes arc_A, the final button #19 becomes ms_A
for (const [n, from, to] of [[16, 'ms_A', 'arc_A'], [19, 'arc_A', 'ms_A']]) { const s = E.shots.find(s => s.n === n); if (s && s.rig === from) Object.assign(s, { rig: to, plan: to, move: { type: 'hold', amt: 0 } }); }
// (Walter's long fingers: no finger-count gestures for him in this episode)
E.gestures = E.gestures.filter(g => !(g.actor === 'A' && g.kind === 'count'));
const ADD = [[4, 'A', 'flick', 'throws'], [4, 'A', 'two_hand_open', 'dots'], [6, 'A', 'palm_down', 'bend'], [8, 'A', 'two_hand_open', 'valleys'], [8, 'A', 'hand_chest', 'yours'], [10, 'A', 'palm_down', 'flat'],
  [12, 'A', 'open_palm', 'hard'], [14, 'A', 'palm_up', 'million'], [16, 'A', 'palm_up', 'fool'], [18, 'A', 'palm_down', 'passcode'], [9, 'B', 'palm_up', 'photo'], [13, 'B', 'hand_chest', 'twin'], [17, 'B', 'hand_lift', 'twin']];
const notes = [];
for (const [line, actor, kind, word, nth = 0] of ADD) {
  const rise = DUR[kind][0], t = r2(at(line, word, nth) + 0.12), g = { actor, kind, t, rise, dur: DUR[kind][1], line, word };
  const s = E.shots.find(s => t >= s.t0 && t < s.t1), cl = E.gestures.find(x => x.actor === actor && x.line === line && ['open_palm', 'palm_up', 'hand_lift', 'two_hand_open', 'hands_lift', 'count', 'flick', 'palm_down', 'hand_chest'].includes(x.kind) && t - rise < x.t + x.dur && x.t - x.rise < t + g.dur + .1);
  if (!s || s.line !== line) { notes.push(`skip ${kind} "${word}" (outside its shot)`); continue; } if (cl) { notes.push(`skip ${kind} "${word}" (clash with ${cl.kind})`); continue; }
  E.gestures.push(g);
}
E.gestures.sort((a, b) => a.t - b.t); fs.writeFileSync(f, JSON.stringify(E, null, 1)); console.log('gestures', E.gestures.length, notes.join(' | '));
