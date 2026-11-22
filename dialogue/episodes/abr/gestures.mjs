// abr: shot/gesture override applied after autoplan. Usage: node dialogue/compiler/autoplan.mjs abr --plan-md && node dialogue/episodes/abr/gestures.mjs
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
const here = path.dirname(fileURLToPath(import.meta.url)), f = path.join(here, 'shots.json'), E = JSON.parse(fs.readFileSync(f, 'utf8'));
const W = E.words, r2 = x => Math.round(x * 100) / 100;
const at = (line, word, nth = 0) => { const c = W.filter(w => w.line === line && w.w.toLowerCase().replace(/[^a-z0-9]/g, '') === word.replace(/[^a-z0-9]/g, '')); if (!c[nth]) throw new Error(`no word ${word} L${line}`); return c[nth].s; };
const DUR = { open_palm: [.38, .6], palm_up: [.34, .5], two_hand_open: [.4, .75], count: [.42, .5], palm_down: [.36, .55], flick: [.3, .3], hand_chest: [.4, .8], hands_lift: [.3, .75], hand_lift: [.3, .45], nod: [.12, .3], tilt: [.35, .8] };
// gate f R4: Walter's #2 and #5 were both ms_A, and arc_A (#5) next to mcu_A (#7) is only 12 deg apart -> #2 becomes arc_A. The dry button (L18) must stay on Walter's face for the whole line: the auto cut-in on Leo
// ("Which was never great.") is merged into it, and the button becomes a CU (mcu_A) so Walter alternates ms_A / non-ms_A.
const setRig = (n, to) => { const s = E.shots.find(s => s.n === n); if (s) Object.assign(s, { rig: to, plan: to, move: { type: 'hold', amt: 0 } }); };
setRig(2, 'arc_A');
{ const last = E.shots.filter(s => s.line === 18 && s.cut !== 'tail'), first = last[0];
  if (last.length > 1) { first.t1 = last[last.length - 1].t1; for (const x of last.slice(1)) E.shots.splice(E.shots.indexOf(x), 1); E.shots.forEach((s, i) => { s.n = i + 1; }); }
  setRig(first.n, 'mcu_A'); }
// (Walter's long fingers: no finger-count gestures for him in this episode)
E.gestures = E.gestures.filter(g => !(g.actor === 'A' && g.kind === 'count'));
const ADD = [[2, 'A', 'open_palm', 'movie'], [4, 'A', 'two_hand_open', 'several'], [4, 'A', 'palm_down', 'small'], [4, 'A', 'two_hand_open', 'big'], [6, 'A', 'open_palm', 'player'], [6, 'A', 'palm_up', 'fast'],
  [8, 'A', 'open_palm', 'small'], [8, 'A', 'hand_lift', 'carry'], [8, 'A', 'palm_up', 'time'], [10, 'A', 'palm_down', 'freezes'], [10, 'A', 'open_palm', 'forgive'], [12, 'A', 'two_hand_open', 'cushion'], [12, 'A', 'palm_up', 'ahead'],
  [14, 'A', 'two_hand_open', 'fat'], [14, 'A', 'palm_up', 'risks'], [14, 'A', 'palm_down', 'thin'], [16, 'A', 'palm_up', 'piece'], [18, 'A', 'palm_down', 'patience'],
  [5, 'B', 'palm_up', 'decides'], [9, 'B', 'palm_up', 'sharp'], [13, 'B', 'hand_chest', 'fat'], [15, 'B', 'hand_lift', 'sharp'], [11, 'B', 'palm_up', 'guesses']];
const notes = [];
for (const [line, actor, kind, word, nth = 0] of ADD) {
  const rise = DUR[kind][0], t = r2(at(line, word, nth) + 0.12), g = { actor, kind, t, rise, dur: DUR[kind][1], line, word };
  const s = E.shots.find(s => t >= s.t0 && t < s.t1), cl = E.gestures.find(x => x.actor === actor && x.line === line && ['open_palm', 'palm_up', 'hand_lift', 'two_hand_open', 'hands_lift', 'count', 'flick', 'palm_down', 'hand_chest'].includes(x.kind) && t - rise < x.t + x.dur && x.t - x.rise < t + g.dur + .1);
  if (!s || s.line !== line) { notes.push(`skip ${kind} "${word}" (outside its shot)`); continue; } if (cl) { notes.push(`skip ${kind} "${word}" (clash with ${cl.kind})`); continue; }
  E.gestures.push(g);
}
E.gestures.sort((a, b) => a.t - b.t); fs.writeFileSync(f, JSON.stringify(E, null, 1)); console.log('gestures', E.gestures.length, notes.join(' | '));
