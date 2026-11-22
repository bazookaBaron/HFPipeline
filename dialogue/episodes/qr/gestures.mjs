// qr: shot + gesture overrides applied after autoplan. Usage (repo root): node dialogue/compiler/autoplan.mjs qr --plan-md && node dialogue/episodes/qr/gestures.mjs
// 1) camera-variety fixes autoplan's optimizer can't reach (gate f R3/R4); cut-ins only at real pauses, MS/CU only under cards.
// 2) key-word gestures; no Walter 'count' (his fingers read too long at MS, cloud baseline note).
import fs from 'fs'; import { varietyCheck } from '../../compiler/gate_variety.mjs'; import path from 'path'; import { fileURLToPath } from 'url';
const here = path.dirname(fileURLToPath(import.meta.url)), f = path.join(here, 'shots.json'), E = JSON.parse(fs.readFileSync(f, 'utf8'));
const W = E.words, r2 = x => Math.round(x * 100) / 100, nw = s => s.toLowerCase().replace(/[^a-z0-9]/g, '');
const at = (line, word, nth = 0) => { const c = W.filter(w => w.line === line && nw(w.w) === word); if (!c[nth]) throw new Error(`no word ${word} L${line}`); return c[nth].s; };
const setRig = (s, rig) => { s.rig = rig; s.plan = rig.startsWith('ms_') ? 'seat_' + rig.slice(3) : rig; s.cu = /^(mcu|low_fire|slow_push)/.test(rig); s.move = rig === 'mcu_B' ? { type: 'push', amt: 0.04 } : { type: 'hold', amt: 0 }; };
const byLine = (line, cut = 'speaker') => E.shots.find(s => s.line === line && s.cut === cut);
// R3 45-55 s: split L14 (7.2 s, one mcu_A) at its two pauses: mcu_A | Leo listens ms_B | arc_A
{ const s = byLine(14), i = E.shots.indexOf(s), c1 = r2(at(14, 'extra') - 0.15), c2 = r2(at(14, 'lose') - 0.15), t1 = s.t1; s.t1 = c1;
  const mk = (t0, t1, rig, subject, cut) => { const o = { ...s, t0, t1, subject, cut }; setRig(o, rig); return o; };
  E.shots.splice(i + 1, 0, mk(c1, c2, 'ms_B', 'B', 'cutin'), mk(c2, t1, 'arc_A', 'A', 'cutin')); }
E.shots.forEach((s, i) => s.n = i + 1);
// re-choose speaker rigs (cut times fixed) by coordinate descent on the gate-f rules; MS/CU only (no pair rig moves), arc only on shots >= 2 s, mcu_B only where autoplan put it
{ const ANG = JSON.parse(fs.readFileSync(path.join(here, '../../compiler/rig_angles_campfire_9x16.json'), 'utf8')), PAIR = ['wide2', 'high34', 'profile2', 'tent_wide'];
  const cand = E.shots.map(s => PAIR.includes(s.rig) ? [s.rig] : (s.subject === 'A' ? ['ms_A', 'mcu_A', 'arc_A'] : ['ots_B', 'ms_B', ...(s.rig === 'mcu_B' ? ['mcu_B'] : [])]).filter(r => !r.startsWith('arc') || s.t1 - s.t0 >= 2));
  const pref = E.shots.map(s => s.rig), cost = a => { const r = varietyCheck(E.shots.map((s, i) => ({ ...s, rig: a[i] })), i => { const c = ANG[a[i]].u5; return { sub: PAIR.includes(a[i]) ? 'pair' : c.sub, az: c.az, el: c.el, half: c.half }; }, E.duration);
    return r.total * 100 + a.filter((x, i) => x !== pref[i]).length; };
  let best = E.shots.map((s, i) => cand[i].includes(s.rig) ? s.rig : cand[i][0]), bc = cost(best), seed = 99; const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
  for (let k = 0; k < 80; k++) { const a = k ? cand.map(c => c[Math.floor(rnd() * c.length)]) : best.slice(); let v = cost(a), ch = true;
    while (ch) { ch = false; for (let i = 0; i < a.length; i++) for (const c of cand[i]) { const o = a[i]; a[i] = c; const w = cost(a); if (w < v) { v = w; ch = true; } else a[i] = o; } }
    if (v < bc) { bc = v; best = a.slice(); } }
  E.shots.forEach((s, i) => { if (best[i] !== s.rig) { const mv = s.move; setRig(s, best[i]); if (s.cut === 'tail') s.move = mv; } });
  console.log('variety cost', bc, '(x100 = violations)', best.join(' ')); }
const DUR = { open_palm: [.38, .6], palm_up: [.34, .5], two_hand_open: [.4, .75], count: [.42, .5], palm_down: [.36, .55], flick: [.3, .3], hand_chest: [.4, .8], hands_lift: [.3, .75], hand_lift: [.3, .45], nod: [.12, .3], tilt: [.35, .8] };
const HAND = ['open_palm', 'palm_up', 'hand_lift', 'two_hand_open', 'hands_lift', 'count', 'flick', 'palm_down', 'hand_chest'];
E.gestures = E.gestures.filter(g => !(g.actor === 'A' && g.kind === 'count') && !(g.line === 18 && HAND.includes(g.kind)));
const ADD = [[2, 'A', 'open_palm', 'course'], [4, 'A', 'open_palm', 'factories'], [4, 'A', 'palm_down', 'enough'], [6, 'A', 'palm_up', 'yes'], [6, 'A', 'two_hand_open', 'eight'],
  [8, 'A', 'flick', 'zigzag'], [9, 'B', 'palm_up', 'three'], [10, 'A', 'two_hand_open', 'here'], [11, 'B', 'count', 'three'], [12, 'A', 'hand_lift', 'up'], [13, 'B', 'hands_lift', 'gone'],
  [14, 'A', 'palm_down', 'spare'], [14, 'A', 'open_palm', 'rebuilds'], [16, 'A', 'palm_up', 'logo'], [17, 'B', 'palm_up', 'more'], [18, 'A', 'nod', 'plenty']];
const notes = [];
for (const [line, actor, kind, word, nth = 0] of ADD) {
  const rise = DUR[kind][0], t = r2(at(line, word, nth) + 0.12), g = { actor, kind, t, rise, dur: DUR[kind][1], line, word };
  const s = E.shots.find(s => t >= s.t0 && t < s.t1), cl = E.gestures.find(x => x.actor === actor && HAND.includes(kind) && HAND.includes(x.kind) && t - rise < x.t + x.dur && x.t - x.rise < t + g.dur + .1);
  if (!s || s.line !== line) { notes.push(`skip ${kind} "${word}" (outside its shot)`); continue; }
  if (cl) { if (cl.word) { notes.push(`skip ${kind} "${word}" (clash with ${cl.kind})`); continue; } E.gestures.splice(E.gestures.indexOf(cl), 1); notes.push(`replaced autoplan ${cl.kind} L${cl.line} with ${kind} "${word}"`); }
  E.gestures.push(g);
}
E.gestures.sort((a, b) => a.t - b.t); fs.writeFileSync(f, JSON.stringify(E, null, 1));
// PLAN.md = PLAN.auto.md with the final rigs/cuts (gates.mjs gate 0 checks shots.json against this table)
{ const md = fs.readFileSync(path.join(here, 'PLAN.auto.md'), 'utf8').split(/\r?\n/), rows = md.map((l, i) => [l, i]).filter(([l]) => /^\| \d+ \|/.test(l));
  const src = rows.map(([l]) => { const c = l.split('|').map(x => x.trim()); const [a, b] = c[3].split('-').map(Number); return { c, a, b }; });
  const out = E.shots.map(sh => { const m = (sh.t0 + sh.t1) / 2, r = src.find(x => m >= x.a && m < x.b) ?? src[src.length - 1], c = [...r.c]; c[1] = String(sh.n); c[3] = `${sh.t0.toFixed(2)}-${sh.t1.toFixed(2)}`;
    c[4] = sh.cut === 'tail' ? c[4] : `${sh.plan}, ${sh.move.type === 'push' ? 'push ' + Math.round(sh.move.amt * 100) + '%' : 'hold'}`;
    if (sh.cut === 'cutin' && sh.subject !== sh.speaker && !/cut-in/.test(c[2])) { c[2] = `L${sh.line}b reaction cut-in`; c[5] = sh.subject === 'B' ? 'Leo curious' : 'Walter warm'; c[6] = '-'; c[7] = '-'; }
    else if (sh.line === 14 && sh.subject === sh.speaker && sh.t0 > r.a + 0.01) c[2] = c[2].replace(/^L14/, 'L14c');
    return '| ' + c.slice(1, -1).join(' | ') + ' |'; });
  const first = rows[0][1], last = rows[rows.length - 1][1];
  fs.writeFileSync(path.join(here, 'PLAN.md'), [...md.slice(0, first), ...out, ...md.slice(last + 1)].join('\n').replace('AUTO picture plan (autoplan.mjs', 'picture plan (autoplan.mjs + gestures.mjs overrides')); } console.log('shots', E.shots.length, 'gestures', E.gestures.length, notes.join(' | '));
