// ytrec: shot/gesture override applied after autoplan. Usage: node dialogue/compiler/autoplan.mjs ytrec --plan-md && node dialogue/episodes/ytrec/gestures.mjs
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
const here = path.dirname(fileURLToPath(import.meta.url)), f = path.join(here, 'shots.json'), E = JSON.parse(fs.readFileSync(f, 'utf8'));
const W = E.words, r2 = x => Math.round(x * 100) / 100;
const at = (line, word, nth = 0) => { const c = W.filter(w => w.line === line && w.w.toLowerCase().replace(/[^a-z0-9]/g, '') === word.replace(/[^a-z0-9]/g, '')); if (!c[nth]) throw new Error(`no word ${word} L${line}`); return c[nth].s; };
const DUR = { open_palm: [.38, .6], palm_up: [.34, .5], two_hand_open: [.4, .75], count: [.42, .5], palm_down: [.36, .55], flick: [.3, .3], hand_chest: [.4, .8], hands_lift: [.3, .75], hand_lift: [.3, .45], nod: [.12, .3], tilt: [.35, .8] };
// 1) the dry button stays on Walter: drop the listener cut-in of L16 (autoplan splits the 5.5 s line) and hold one Walter shot to the tail
{ const i = E.shots.findIndex(s => s.line === 16 && s.cut === 'cutin'); if (i > 0) { E.shots[i - 1].t1 = E.shots[i].t1; E.shots.splice(i, 1); E.shots.forEach((s, k) => (s.n = k + 1)); E.gestures = E.gestures.filter(g => !(g.actor === 'B' && g.line === 16)); } }
// 2) gate f R4: Walter's consecutive shots alternate ms_A (54 deg) with arc_A / mcu_A (33-38 deg, 16-22 deg apart); the tail keeps wide2.
const PLAN = { ms_A: 'seat_A', ms_B: 'seat_B' }, ASSIGN = { 4: 'arc_A', 6: 'ms_A', 8: 'mcu_A', 9: 'ms_A', 11: 'arc_A', 13: 'ms_A', 15: 'mcu_A', 17: 'ms_A' };
for (const [n, rig] of Object.entries(ASSIGN)) { const s = E.shots.find(s => s.n === +n); Object.assign(s, { rig, plan: PLAN[rig] ?? rig, move: { type: 'hold', amt: 0 } }); }
// (Walter's long fingers: no finger-count gestures for him)
E.gestures = E.gestures.filter(g => !(g.actor === 'A' && g.kind === 'count'));
const ADD = [[4, 'A', 'palm_down', 'counts'], [4, 'A', 'flick', 'skip'], [6, 'A', 'two_hand_open', 'millions'], [8, 'A', 'palm_up', 'scores'], [8, 'A', 'open_palm', 'best'], [10, 'A', 'palm_down', 'cheap'], [10, 'A', 'open_palm', 'prize'],
  [12, 'A', 'hand_lift', 'leave'], [14, 'A', 'hands_lift', 'round'], [14, 'A', 'two_hand_open', 'loop'], [16, 'A', 'palm_down', 'guess'], [9, 'B', 'palm_up', 'click'], [13, 'B', 'hand_lift', 'watch'], [15, 'B', 'hand_chest', 'myself'], [7, 'B', 'two_hand_open', 'millions']];
const notes = [];
for (const [line, actor, kind, word, nth = 0] of ADD) {
  const rise = DUR[kind][0], t = r2(at(line, word, nth) + 0.12), g = { actor, kind, t, rise, dur: DUR[kind][1], line, word };
  const s = E.shots.find(s => t >= s.t0 && t < s.t1), cl = E.gestures.find(x => x.actor === actor && x.line === line && ['open_palm', 'palm_up', 'hand_lift', 'two_hand_open', 'hands_lift', 'count', 'flick', 'palm_down', 'hand_chest'].includes(x.kind) && t - rise < x.t + x.dur && x.t - x.rise < t + g.dur + .1);
  if (!s || s.line !== line) { notes.push(`skip ${kind} "${word}" (outside its shot)`); continue; } if (cl) { notes.push(`skip ${kind} "${word}" (clash with ${cl.kind})`); continue; }
  E.gestures.push(g);
}
E.gestures.sort((a, b) => a.t - b.t); fs.writeFileSync(f, JSON.stringify(E, null, 1)); console.log('gestures', E.gestures.length, 'shots', E.shots.length, notes.join(' | '));
