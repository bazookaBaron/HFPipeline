// cold_battery: shot/gesture override applied after autoplan. Usage: node dialogue/compiler/autoplan.mjs cold_battery --plan-md && node dialogue/episodes/cold_battery/gestures.mjs
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url'; import { varietyCheck } from '../../compiler/gate_variety.mjs';
const here = path.dirname(fileURLToPath(import.meta.url)), f = path.join(here, 'shots.json'), E = JSON.parse(fs.readFileSync(f, 'utf8'));
const W = E.words, r2 = x => Math.round(x * 100) / 100;
const at = (line, word, nth = 0) => { const c = W.filter(w => w.line === line && w.w.toLowerCase().replace(/[^a-z0-9]/g, '') === word.replace(/[^a-z0-9]/g, '')); if (!c[nth]) throw new Error(`no word ${word} L${line}`); return c[nth].s; };
const DUR = { open_palm: [.38, .6], palm_up: [.34, .5], two_hand_open: [.4, .75], palm_down: [.36, .55], flick: [.3, .3], hand_chest: [.4, .8], hands_lift: [.3, .75], hand_lift: [.3, .45], nod: [.12, .3], tilt: [.35, .8] };
const shotAt = t => E.shots.find(s => t >= s.t0 && t < s.t1);
const setRig = (s, rig, move = { type: 'hold', amt: 0 }, cu = false) => { s.rig = rig; s.plan = rig; s.cu = cu; s.move = move; };
const mk = (src, o) => ({ ...src, ...o });
// Walter's consecutive shots must differ >= 15 deg (az: arc_A 27, mcu_A 38, ms_A 54): mcu<->arc is only 11 deg, so ms_A sits between them. Leo: mcu_B 38, ms_B 54, ots_B 74.
// cutin(line, tA, tB, rigA, rigC, rigB): Walter's long line gets Leo's reaction cut-in between tA and tB (tB = null: to the end of the line), Walter resumes on rigB (camera variety R3)
const lineShot = ln => E.shots.findIndex(s => s.line === ln && s.cut === 'speaker');
function cutin(ln, tA, tB, rigA, rigC, rigB) { const i = lineShot(ln), s = E.shots[i], end = s.t1, A1 = mk(s, { t1: tA }), C = mk(s, { t0: tA, t1: tB ?? end, speaker: 'A', subject: 'B', cut: 'cutin' }); setRig(A1, rigA, { type: 'hold', amt: 0 }, rigA.startsWith('mcu')); setRig(C, rigC); const out = [A1, C];
  if (tB != null) { const A3 = mk(s, { t0: tB }); setRig(A3, rigB, { type: 'hold', amt: 0 }, rigB.startsWith('mcu')); out.push(A3); } E.shots.splice(i, 1, ...out); }
const gapMid = (ln, w1, w2) => { const a = W.find(w => w.line === ln && w.w.toLowerCase().replace(/[^a-z0-9]/g, '') === w1), b = W.find(w => w.line === ln && w.w.toLowerCase().replace(/[^a-z0-9]/g, '') === w2); return r2(((a.e ?? a.s + .4) + b.s) / 2 - .02); };
const keepL6 = E.shots.find(s => s.line === 6 && s.cut === 'cutin');   // autoplan already split L6 at its pause
cutin(4, gapMid(4, 'it', 'that'), null, 'ms_A', 'ms_B');
cutin(8, gapMid(8, 'slowly', 'the'), null, 'ms_A', 'ms_B');
cutin(12, gapMid(12, 'weakly', 'the'), null, 'ms_A', 'ms_B');
// single-rig lines
for (const [ln, rig] of [[1, 'mcu_B'], [2, 'arc_A'], [3, 'ots_B'], [5, 'ots_B'], [6, 'mcu_A'], [7, 'ots_B'], [9, 'mcu_B'], [10, 'arc_A'], [11, 'ots_B'], [13, 'mcu_B'], [14, 'mcu_A'], [15, 'ots_B'], [16, 'ms_A'], [17, 'mcu_B']]) { const s = E.shots.find(s => s.line === ln && s.cut === 'speaker'); setRig(s, rig, { type: 'hold', amt: 0 }, rig.startsWith('mcu')); }
// the L6 cut-in (Leo) stays ms_B from autoplan
void keepL6;
// the dry button (L18) is a close-up on Walter; Leo's reaction cut-in only covers "breakfast" and the pause after
{ const a = E.shots.find(s => s.line === 18 && s.cut === 'speaker'), c = E.shots.find(s => s.line === 18 && s.cut === 'cutin'), t = r2(at(18, 'breakfast')); a.t1 = t; c.t0 = t; setRig(a, 'mcu_A', { type: 'hold', amt: 0 }, true); setRig(c, 'ms_B'); }
E.shots.forEach((s, i) => s.n = i + 1);
const ADD = [[1, 'B', 'hand_lift', 'died'], [2, 'A', 'palm_down', 'dead'], [4, 'A', 'open_palm', 'liquid'], [4, 'A', 'two_hand_open', 'power'], [6, 'A', 'open_palm', 'freeze'], [6, 'A', 'palm_down', 'thick'],
  [8, 'A', 'palm_up', 'slowly'], [8, 'A', 'open_palm', 'wants'], [10, 'A', 'palm_down', 'nowhere'], [12, 'A', 'open_palm', 'voltage'], [12, 'A', 'palm_down', 'sags'], [13, 'B', 'hand_chest', 'thirty'],
  [14, 'A', 'palm_up', 'warm'], [14, 'A', 'open_palm', 'back'], [16, 'A', 'hand_chest', 'coat'], [18, 'A', 'palm_down', 'slow']];
const notes = [];
for (const [line, actor, kind, word, nth = 0] of ADD) {
  const rise = DUR[kind][0], t = r2(at(line, word, nth) + 0.12), g = { actor, kind, t, rise, dur: DUR[kind][1], line, word };
  const s = shotAt(t), cl = E.gestures.find(x => x.actor === actor && x.line === line && ['open_palm', 'palm_up', 'hand_lift', 'two_hand_open', 'hands_lift', 'count', 'flick', 'palm_down', 'hand_chest'].includes(x.kind) && t - rise < x.t + x.dur && x.t - x.rise < t + g.dur + .1);
  if (!s || s.line !== line) { notes.push(`skip ${kind} "${word}" (outside its shot)`); continue; } if (cl) { notes.push(`skip ${kind} "${word}" (clash with ${cl.kind})`); continue; }
  E.gestures.push(g);
}
E.gestures.sort((a, b) => a.t - b.t); fs.writeFileSync(f, JSON.stringify(E, null, 1)); console.log('gestures', E.gestures.length, notes.join(' | '));
// offline camera-variety check (the engine gate f is the real one)
const RA = JSON.parse(fs.readFileSync(path.join(here, '../../compiler/rig_angles_campfire_9x16.json'), 'utf8'));
const r = varietyCheck(E.shots.map(s => ({ n: s.n, t0: s.t0, t1: s.t1, rig: s.rig })), i => RA[E.shots[i].rig].u5, E.duration);
console.log('variety fails', JSON.stringify(r.fails), 'minWindowAngles', r.stats.minWindowAngles);
// no wide2 / high34 / profile2 / tent_wide / low_fire under a card
const cues = JSON.parse(fs.readFileSync(path.join(here, 'mg.beats.json'), 'utf8')).cues, ban = ['wide2', 'high34', 'profile2', 'tent_wide', 'low_fire'];
for (const c of cues) for (const s of E.shots) if (s.t1 > c.at && s.t0 < c.end && ban.includes(s.rig)) console.log('BANNED RIG UNDER CARD', c.name, '#' + s.n, s.rig);

// PLAN.md = the table gates.mjs checks, regenerated from the final shots.json (autoplan's PLAN.auto.md predates the overrides above)
{ const auto = fs.readFileSync(path.join(here, 'PLAN.auto.md'), 'utf8').split(String.fromCharCode(10)), old = auto.filter(l => /^\| \d+ \|/.test(l)).map(l => l.split('|').slice(1, -1).map(x => x.trim()));
  const f2s = x => x.toFixed(2), rows = E.shots.map(s => {
    const lineNo = s.line, kind = s.cut, o = old.filter(r => (kind === 'tail' ? /tail/.test(r[1]) : r[1].startsWith('L' + lineNo + ' ') || r[1].startsWith('L' + lineNo + 'a') ) && !/cut-in/.test(r[1]))[0] || old.find(r => kind === 'tail' && /tail/.test(r[1]));
    const oc = old.filter(r => r[1].startsWith('L' + lineNo + 'b') || (r[1].startsWith('L' + lineNo + ' ') && false))[0];
    const mv = s.move.type === 'push' ? `push ${Math.round((s.move.amt ?? 0) * 100)}%` : 'hold', gs = E.gestures.filter(g => g.t >= s.t0 && g.t < s.t1).map(g => `${g.kind} "${g.word}" ${f2s(g.t)}`).join('; ') || '-';
    let face, label, listener;
    if (kind === 'cutin') { const sp = old.find(r => r[1].startsWith('L' + lineNo + ' ') || r[1].startsWith('L' + lineNo + 'a')); label = `L${lineNo}b reaction cut-in`; face = oc ? oc[4] : 'Leo ' + (sp ? sp[6].split('->')[0].trim() : 'curious'); listener = '-'; }
    else { face = o ? o[4] : '-'; label = o ? o[1] : 'L' + lineNo; listener = o ? o[6] : '-'; }
    return `| ${s.n} | ${label} | ${f2s(s.t0)}-${f2s(s.t1)} | ${s.plan}, ${mv} | ${face} | ${gs} | ${listener} |`; });
  const head = auto.slice(0, auto.findIndex(l => /^\| # \|/.test(l)) + 2), tail = auto.slice(auto.findIndex(l => l.startsWith('## MG cues')));
  fs.writeFileSync(path.join(here, 'PLAN.md'), [...head, ...rows, '', ...tail].join('\n')); console.log('PLAN.md regenerated', rows.length, 'rows'); }
