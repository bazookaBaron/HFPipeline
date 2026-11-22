// autocorrect: shot/gesture override applied after autoplan. Usage: node dialogue/compiler/autoplan.mjs autocorrect --plan-md && node dialogue/episodes/autocorrect/gestures.mjs
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
const here = path.dirname(fileURLToPath(import.meta.url)), f = path.join(here, 'shots.json'), E = JSON.parse(fs.readFileSync(f, 'utf8'));
const W = E.words, r2 = x => Math.round(x * 100) / 100;
const at = (line, word, nth = 0) => { const c = W.filter(w => w.line === line && w.w.toLowerCase().replace(/[^a-z0-9]/g, '') === word.replace(/[^a-z0-9]/g, '')); if (!c[nth]) throw new Error(`no word ${word} L${line}`); return c[nth].s; };
const DUR = { open_palm: [.38, .6], palm_up: [.34, .5], two_hand_open: [.4, .75], count: [.42, .5], palm_down: [.36, .55], flick: [.3, .3], hand_chest: [.4, .8], hands_lift: [.3, .75], hand_lift: [.3, .45], nod: [.12, .3], tilt: [.35, .8] };
// the dry button (L18) is a close-up on Walter, as the script's last line asks (autoplan split it with a Leo cut-in; the speaker shots become mcu_A)
// camera variety (gate f R3): the dry line (L18) is one long CU shot; cut away to Leo's reaction on "Almost nobody types Moe", back to Walter for "Nothing personal."
{ const i = E.shots.findIndex(s => s.line === 18 && s.cut === 'speaker'), s = E.shots[i], tB = r2(at(18, 'almost') - 0.15), tC = r2(at(18, 'nothing') - 0.15), t1 = s.t1;
  s.t1 = tB; const B = { ...s, t0: tB, t1: tC, rig: 'ms_B', plan: 'seat_B', move: { type: 'hold', amt: 0 }, subject: 'B', cut: 'cutin', cu: false }, C = { ...s, t0: tC, t1, cut: 'speaker' };
  s.rig = 'arc_A'; s.plan = 'arc_A'; s.cu = false; s.move = { type: 'hold', amt: 0 }; C.cut = 'cutin'; C.rig = 'ms_A'; C.plan = 'seat_A'; C.cu = false; C.move = { type: 'push', amt: 0.04 };
  E.shots.splice(i + 1, 0, B, C); E.shots.forEach((x, k) => { x.n = k + 1; }); }
// gate f R4: Leo's L13 ots_B -> L15 ots_B was the same angle: L13 becomes a close-up (the hinge: how does it know me)
{ const s = E.shots.find(s => s.line === 13 && s.cut === 'speaker'); s.rig = 'mcu_B'; s.plan = 'mcu_B'; s.cu = true; s.move = { type: 'push', amt: 0.04 }; }
const ADD = [[1, 'B', 'hand_chest', 'typed'], [2, 'A', 'open_palm', 'landed'], [4, 'A', 'palm_up', 'guessed'], [6, 'A', 'open_palm', 'thumb'], [6, 'A', 'palm_down', 'knows'],
  [8, 'A', 'open_palm', 'words'], [10, 'A', 'open_palm', 'every'], [10, 'A', 'palm_down', 'wins'], [11, 'B', 'hand_lift', 'many'], [12, 'A', 'two_hand_open', 'thousands'],
  [13, 'B', 'hand_chest', 'me'], [14, 'A', 'palm_up', 'teach'], [14, 'A', 'open_palm', 'list'], [15, 'B', 'hand_lift', 'undo'], [16, 'A', 'palm_down', 'wrong'], [16, 'A', 'flick', 'stops'],
  [17, 'B', 'palm_up', 'still'], [18, 'A', 'open_palm', 'everyone'], [18, 'A', 'palm_down', 'personal']];
const notes = [];
for (const [line, actor, kind, word, nth = 0] of ADD) {
  const rise = DUR[kind][0], t = r2(at(line, word, nth) + 0.12), g = { actor, kind, t, rise, dur: DUR[kind][1], line, word };
  const s = E.shots.find(s => t >= s.t0 && t < s.t1), cl = E.gestures.find(x => x.actor === actor && x.line === line && ['open_palm', 'palm_up', 'hand_lift', 'two_hand_open', 'hands_lift', 'count', 'flick', 'palm_down', 'hand_chest'].includes(x.kind) && t - rise < x.t + x.dur && x.t - x.rise < t + g.dur + .1);
  if (!s || s.line !== line) { notes.push(`skip ${kind} "${word}" (outside its shot)`); continue; } if (cl) { notes.push(`skip ${kind} "${word}" (clash with ${cl.kind})`); continue; }
  E.gestures.push(g);
}
E.gestures.sort((a, b) => a.t - b.t); fs.writeFileSync(f, JSON.stringify(E, null, 1)); console.log('gestures', E.gestures.length, notes.join(' | '));
