// url_enter: shot/gesture override applied after autoplan. Usage: node dialogue/compiler/autoplan.mjs url_enter --plan-md && node dialogue/episodes/url_enter/gestures.mjs
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
const here = path.dirname(fileURLToPath(import.meta.url)), f = path.join(here, 'shots.json'), E = JSON.parse(fs.readFileSync(f, 'utf8'));
const W = E.words, r2 = x => Math.round(x * 100) / 100;
const at = (line, word, nth = 0) => { const c = W.filter(w => w.line === line && w.w.toLowerCase().replace(/[^a-z0-9]/g, '') === word.replace(/[^a-z0-9]/g, '')); if (!c[nth]) throw new Error(`no word ${word} L${line}`); return c[nth].s; };
const DUR = { open_palm: [.38, .6], palm_up: [.34, .5], two_hand_open: [.4, .75], count: [.42, .5], palm_down: [.36, .55], flick: [.3, .3], hand_chest: [.4, .8], hands_lift: [.3, .75], hand_lift: [.3, .45], nod: [.12, .3], tilt: [.35, .8] };
// the dry button (L20) is a close-up on Walter, as the script marks it [CU] (autoplan gave arc_A)
{ const s = E.shots.find(s => s.line === 20 && s.cut === 'speaker'); s.rig = 'mcu_A'; s.plan = 'mcu_A'; s.cu = true; s.move = { type: 'hold', amt: 0 }; }
// gate f R4: Leo's #6 ms_B -> #8 ms_B (the L6 cut-in) was the same angle: the cut-in becomes a close-up (size step)
{ const s = E.shots.find(s => s.line === 6 && s.cut === 'cutin'); s.rig = 'mcu_B'; s.plan = 'mcu_B'; s.cu = true; s.move = { type: 'push', amt: 0.04 }; }
const ADD = [[1, 'B', 'hand_chest', 'i'], [2, 'A', 'open_palm', 'lives'], [4, 'A', 'open_palm', 'phone'], [4, 'A', 'palm_down', 'dns'], [6, 'A', 'palm_up', 'address'],
  [8, 'A', 'open_palm', 'hello'], [8, 'A', 'count', 'three'], [10, 'A', 'hand_lift', 'polite'], [12, 'A', 'two_hand_open', 'open'], [12, 'A', 'palm_down', 'worked'],
  [13, 'B', 'hand_chest', 'havent'], [14, 'A', 'flick', 'give'], [14, 'A', 'open_palm', 'skeleton'], [16, 'A', 'open_palm', 'pictures'], [16, 'A', 'palm_down', 'paints'],
  [17, 'B', 'hand_lift', 'half'], [19, 'B', 'palm_up', 'five']];
const notes = [];
for (const [line, actor, kind, word, nth = 0] of ADD) {
  const rise = DUR[kind][0], t = r2(at(line, word, nth) + 0.12), g = { actor, kind, t, rise, dur: DUR[kind][1], line, word };
  const s = E.shots.find(s => t >= s.t0 && t < s.t1), cl = E.gestures.find(x => x.actor === actor && x.line === line && ['open_palm', 'palm_up', 'hand_lift', 'two_hand_open', 'hands_lift', 'count', 'flick', 'palm_down', 'hand_chest'].includes(x.kind) && t - rise < x.t + x.dur && x.t - x.rise < t + g.dur + .1);
  if (!s || s.line !== line) { notes.push(`skip ${kind} "${word}" (outside its shot)`); continue; } if (cl) { notes.push(`skip ${kind} "${word}" (clash with ${cl.kind})`); continue; }
  E.gestures.push(g);
}
E.gestures.sort((a, b) => a.t - b.t); fs.writeFileSync(f, JSON.stringify(E, null, 1)); console.log('gestures', E.gestures.length, notes.join(' | '));
