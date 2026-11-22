// Usage: node dialogue/mg/beats-from-script.mjs <episode> [words.json]    (words.json default: fish/words6.json style [[s,e,"word"],...], relative to dialogue/)
// Reads episodes/<ep>/script.md, finds inline `[mg: tpl ...]` tags in the dialogue lines and writes episodes/<ep>/mg.beats.json (input for mg/templates.js addBeats).
// A tag lands on the NEXT spoken word after it (or the last word of the line if it ends the line). Times come from the word-times json by word order.
// Tag syntax (positional + key=value, `>` or `,` or `|` separates list items; quote strings with spaces):
//   [mg: flow PHONE > TOWER > CABLE > DATA CENTRE > FRIEND step=.8]        [mg: counter 40 41 PHOTOS]            [mg: tags GOOGLE, APPLE, AMAZON]
//   [mg: map INDIA > USA undersea]   [mg: image /mg/examples/x.png "CAPTION" credit="CC0 ..."]   [mg: check "YOUR SPACE" on=t1_i3]   [mg: broken OFFLINE]
//   any tag: id=<key> dur=<s> dt=<offset s> title="CARD HEADER"
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
const here = path.dirname(fileURLToPath(import.meta.url)), D = path.resolve(here, '..');
const [ep, wordsArg] = process.argv.slice(2); if (!ep) { console.error('usage: beats-from-script.mjs <episode> [words.json]'); process.exit(2); }
const epDir = path.join(D, 'episodes', ep), script = fs.readFileSync(path.join(epDir, 'script.md'), 'utf8');
const wordsFile = path.resolve(D, wordsArg || 'fish/words6.json'), asr = JSON.parse(fs.readFileSync(wordsFile, 'utf8')).map(w => Array.isArray(w) ? { s: w[0], e: w[1], w: w[2] } : w);
const norm = s => s.toLowerCase().replace(/[^a-z0-9]/g, ''), warns = [], notes = [];

// 1. tokens: spoken words (in order) and the tags that sit before a given token
const toks = [], tags = [];   // tags: {after: index of the next token, raw}
for (const line of script.split(/\r?\n/)) {
  if (/^#end\b/.test(line)) break;
  const m = line.match(/^[A-Z][A-Z0-9 ]*(?:\([^)]*\))?\s*(?:\[[A-Z0-9]+\])?\s*:\s*(.*)$/); if (!m) continue;
  const parts = m[1].split(/(\[mg:[^\]]*\])/);
  for (const p of parts) { const t = p.match(/^\[mg:\s*(.*)\]$/); if (t) { tags.push({ at: toks.length, raw: t[1].trim(), lineStart: toks.length }); continue; } for (const w of p.split(/\s+/)) if (norm(w)) toks.push(w); }
}
// 2. align script tokens to ASR words by order (like compiler/compile.mjs: exact, joins either way, number words; plus a +-4 word resync after a mismatch)
const NUM = { zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };
const nn = s => { const parts = s.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean); if (parts.length && parts.every(p => p in NUM)) return String(parts.reduce((a, p) => a + NUM[p], 0)); return norm(s); };
const eq = (k, i) => asr[i] && toks[k] != null && nn(toks[k]) === nn(asr[i].w);
const map = []; let ai = 0;
for (let k = 0; k < toks.length;) {
  if (!asr[ai]) { warns.push(`ran out of ASR words at script token ${k} "${toks[k]}"`); break; }
  if (eq(k, ai)) { map[k] = ai; k++; ai++; continue; }
  let done = false;
  for (let j = 2; j <= 4 && !done; j++) if (norm(toks.slice(k, k + j).join('')) === norm(asr[ai].w)) { for (let q = 0; q < j; q++) map[k + q] = ai; k += j; ai++; done = true; }
  for (let j = 2; j <= 4 && !done; j++) if (norm(toks[k]) === norm(asr.slice(ai, ai + j).map(x => x.w).join(''))) { map[k] = ai; k++; ai += j; done = true; }
  for (let d = 1; d <= 6 && !done; d++) for (let dk = 0; dk <= d && !done; dk++) { const da = d - dk; if (eq(k + dk, ai + da) && eq(k + dk + 1, ai + da + 1)) { for (let q = 0; q < dk; q++) map[k + q] = ai; notes.push(`resync at script "${toks[k]}" (ASR "${asr[ai].w}"): skipped ${dk} script / ${da} ASR words`); k += dk; ai += da; done = true; } }
  if (!done) { warns.push(`token ${k} "${toks[k]}" vs ASR #${ai} "${asr[ai].w}": no match, advanced both`); map[k] = ai; k++; ai++; }
}
// 3. parse tags
const parseTag = raw => {
  const kv = {}; let rest = raw.replace(/(\w+)=("([^"]*)"|\S+)/g, (_, k, v, q) => { kv[k] = q ?? v; return ' '; }).trim();
  const q = []; rest = rest.replace(/"([^"]*)"/g, (_, s) => { q.push(s); return ' '; }).trim();
  const tpl = rest.split(/\s+/)[0], tail = rest.slice(tpl.length).trim(), list = tail.split(/\s*[>,|]\s*/).map(s => s.trim()).filter(Boolean), num = v => (v != null && v !== '' && !isNaN(+v) ? +v : v);
  const b = { tpl };
  if (tpl === 'flow') b.nodes = list; else if (tpl === 'tags') b.items = list;
  else if (tpl === 'counter') { const w = tail.split(/\s+/); b.from = +w[0]; if (w[1] != null && !isNaN(+w[1])) { b.to = +w[1]; b.label = w.slice(2).join(' '); } else b.label = w.slice(1).join(' '); }
  else if (tpl === 'map') { const parts = tail.split(/\s*>\s*/); b.from = parts[0]; const r = (parts[1] || '').split(/\s+/); b.to = r.shift(); if (r.length) b.route = r.join(' '); }
  else if (tpl === 'image') { b.src = tail.split(/\s+/)[0]; if (q[0]) b.caption = q[0]; }
  else if (tpl === 'check' || tpl === 'broken') { b.target = q[0] ?? (tail || undefined); }
  else warns.push(`unknown template "${tpl}" in [mg: ${raw}]`);
  for (const k in kv) { if (k === 'dt') continue; b[k] = num(kv[k]); } b._dt = +(kv.dt ?? 0); if (!b.target && (tpl === 'check' || tpl === 'broken')) delete b.target; return b;
};
const out = tags.map((g, n) => {
  const b = parseTag(g.raw), ti = Math.min(g.at, toks.length - 1), a = asr[map[ti]]; if (!a) { warns.push(`tag "${g.raw}": no word time`); return null; }
  const dt = b._dt; delete b._dt; return { t: +(a.s + dt).toFixed(3), ...b, word: toks[ti].replace(/[^\p{L}\p{N}'-]/gu, '') };
}).filter(Boolean);
const file = path.join(epDir, 'mg.beats.json'); fs.writeFileSync(file, JSON.stringify(out, null, 1));
console.log(`[beats-from-script] ${ep}: ${out.length} beats -> ${path.relative(D, file)}; ${toks.length} script words, ${asr.length} ASR words`); warns.forEach(w => console.log('  warn:', w)); notes.forEach(w => console.log('  note:', w)); out.forEach(b => console.log(`  t=${b.t}  ${b.tpl}  (word "${b.word}")`));
if (warns.length) process.exitCode = 1;
