// compress: shot/gesture override applied after autoplan. Usage: node dialogue/compiler/autoplan.mjs compress --plan-md && node dialogue/episodes/compress/gestures.mjs
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url'; import { varietyCheck } from '../../compiler/gate_variety.mjs';
const here = path.dirname(fileURLToPath(import.meta.url)), f = path.join(here, 'shots.json'), E = JSON.parse(fs.readFileSync(f, 'utf8'));
const W = E.words, r2 = x => Math.round(x * 100) / 100;
const at = (line, word, nth = 0) => { const c = W.filter(w => w.line === line && w.w.toLowerCase().replace(/[^a-z0-9]/g, '') === word.replace(/[^a-z0-9]/g, '')); if (!c[nth]) throw new Error(`no word ${word} L${line}`); return c[nth].s; };
const DUR = { open_palm: [.38, .6], palm_up: [.34, .5], two_hand_open: [.4, .75], palm_down: [.36, .55], flick: [.3, .3], hand_chest: [.4, .8], hands_lift: [.3, .75], hand_lift: [.3, .45], nod: [.12, .3], tilt: [.35, .8] };
const shotAt = t => E.shots.find(s => t >= s.t0 && t < s.t1);
const setRig = (s, rig, move = { type: 'hold', amt: 0 }, cu = false) => { s.rig = rig; s.plan = rig; s.cu = cu; s.move = move; };
const mk = (src, o) => ({ ...src, ...o });
// L1 is the hook, a close-up on Leo (script marks [CU]); autoplan already gave mcu_B push.
// L10 is 8.5 s of Walter: Leo's reaction cut-in starts in the pause after "blurrily" and runs to the end of the line (camera variety R3: >= 3 angles per 10 s)
{ const i = E.shots.findIndex(s => s.line === 10 && s.cut === 'speaker'), s = E.shots[i], wd = W.filter(w => w.line === 10), bl = wd.find(w => /blurrily/.test(w.w)), so = wd.find(w => w.w.toLowerCase().startsWith('so')), t = r2(((bl.e ?? bl.s + .5) + so.s) / 2 - .02);
  const A1 = mk(s, { t1: t }), C = mk(s, { t0: t, speaker: 'A', subject: 'B', cut: 'cutin' }); setRig(C, 'ms_B'); E.shots.splice(i, 1, A1, C); }
// Walter's consecutive shots must differ >= 15 deg (az: arc_A 27, mcu_A 38, ms_A 54): ms_A / (mcu_A | arc_A) alternate, the dry button L18 is mcu_A
for (const [ln, rig] of [[2, 'mcu_A'], [4, 'ms_A'], [6, 'arc_A'], [8, 'ms_A'], [10, 'mcu_A'], [12, 'ms_A'], [14, 'arc_A'], [16, 'ms_A']]) { const s = E.shots.find(s => s.line === ln && s.cut === 'speaker'); setRig(s, rig, { type: 'hold', amt: 0 }, rig.startsWith('mcu')); }
// the dry button (L18) is a close-up on Walter; Leo's reaction cut-in only covers "sit on it" and the pause after
{ const a = E.shots.find(s => s.line === 18 && s.cut === 'speaker'), c = E.shots.find(s => s.line === 18 && s.cut === 'cutin'), t = r2(at(18, 'sit') - 0.1); a.t1 = t; c.t0 = t; setRig(a, 'mcu_A', { type: 'hold', amt: 0 }, true); }
E.shots.forEach((s, i) => s.n = i + 1);
const ADD = [[1, 'B', 'palm_up', 'eight'], [2, 'A', 'palm_down', 'nowhere'], [4, 'A', 'open_palm', 'take'], [4, 'A', 'palm_up', 'six'], [6, 'A', 'open_palm', 'unzip'], [8, 'A', 'two_hand_open', 'away'],
  [10, 'A', 'open_palm', 'eyes'], [12, 'A', 'palm_up', 'drum'], [12, 'A', 'palm_down', 'never'], [14, 'A', 'open_palm', 'smaller'], [15, 'B', 'hand_chest', 'wait'], [16, 'A', 'open_palm', 'enough'], [17, 'B', 'two_hand_open', 'whole']];
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
