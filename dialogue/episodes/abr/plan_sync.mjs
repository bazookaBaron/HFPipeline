// Re-writes the shot table of PLAN.md from shots.json (after gestures.mjs) so PLAN.md matches the real shot list. Usage: node plan_sync.mjs
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
const here = path.dirname(fileURLToPath(import.meta.url)), E = JSON.parse(fs.readFileSync(path.join(here, 'shots.json'), 'utf8')), A = fs.readFileSync(path.join(here, 'PLAN.auto.md'), 'utf8').split('\n');
const old = A.filter(l => /^\| \d+ \|/.test(l)).map(l => l.split('|').slice(1, -1).map(s => s.trim())), r2 = x => (Math.round(x * 100) / 100).toFixed(2);
const tOf = r => +r[2].split('-')[0]; const PLANRIG = { ms_A: 'seat_A', ms_B: 'seat_B' };
const rows = E.shots.map(s => { let o = old.reduce((b, r) => Math.abs(tOf(r) - s.t0) < Math.abs(tOf(b) - s.t0) ? r : b); const hasCut = E.shots.some(x => x.line === s.line && x.n !== s.n && x.cut === 'cutin'), cu = /^mcu/.test(s.rig);
  const lab = o[1].replace(/ \*\*CU\*\*/, '').replace(/^L(\d+)[ab]/, 'L$1') + (cu ? ' **CU**' : '');
  const g = E.gestures.filter(x => x.t >= s.t0 && x.t < s.t1).map(x => `${x.kind.replace(/_/g, " ")}${x.word ? ` "${x.word}"` : ""} ${x.t.toFixed(2)}`).join('; ') || '-';
  const mv = s.move?.type === 'push' ? `push ${Math.round((s.move.amt ?? 0) * 100)}%` : 'hold';
  return `| ${s.n} | ${s.cut === 'tail' ? 'tail (no voice)' : lab} | ${r2(s.t0)}-${r2(s.t1)} | ${s.cut === 'tail' ? s.rig : (PLANRIG[s.rig] ?? s.rig)}, ${s.cut === 'tail' ? 'slow push' : mv} | ${o[4]} | ${g} | ${o[6]} |`; });
const P = fs.readFileSync(path.join(here, 'PLAN.md'), 'utf8').split('\n'), i0 = P.findIndex(l => /^\| 1 \|/.test(l)), i1 = P.findIndex((l, i) => i > i0 && !/^\| \d+ \|/.test(l));
P.splice(i0, i1 - i0, ...rows); fs.writeFileSync(path.join(here, 'PLAN.md'), P.join('\n')); console.log('PLAN.md synced', rows.length, 'shots');
