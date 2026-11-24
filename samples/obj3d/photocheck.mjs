// photocheck.mjs - photo COVERAGE check (MINIATURE-LESSONS item 16). Coverage, not a quota.
// usage: node samples/obj3d/photocheck.mjs <film> [--gap 120]     (exit 0 = pass, 1 = fail)
// Reads films/<film>/lines.json, plan.json (lines[n].photo = a card), photos.json, entities.json, optional photos_missing.txt.
// entities.json (written by the producer): [{"name","kind":"person|org|place|document|product|event","lines":[n,...], "aliases"?:[..], "photo"?:"<id>"}]
// FAIL when an entity's FIRST mention has no photo card on that line or an adjacent line (n-1 / n+1; if "photo" is set, that card id)
// and photos_missing.txt has no line for it with a reason. photos_missing.txt: one entity per line, "Name: reason" (or "Name | reason",
// "Name - reason"); "#" lines are comments. A reason always excuses the entity: the check never demands a card it gives a reason for.
// Also fails on a card whose id is missing from photos.json. Warnings only: a re-mention after a long gap (--gap s) with no card,
// and an entity whose name/alias is not found in its first line's text.
import fs from "fs"; import path from "path"; import { fileURLToPath } from "url";
const here = path.dirname(fileURLToPath(import.meta.url));
const KINDS = new Set(["person", "org", "place", "document", "product", "event"]);
const norm = s => String(s).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

export function photoCoverage(film, { gap = 120 } = {}) {
  const dir = path.join(here, "films", film), rd = (f, d) => { const p = path.join(dir, f); return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, "utf8")) : d; };
  const lines = rd("lines.json", null), plan = rd("plan.json", {}), meta = rd("photos.json", {}), ents = rd("entities.json", null);
  if (!lines) return { film, pass: false, skipped: false, fails: ["lines.json missing"], warns: [] };
  const byN = new Map(lines.map(l => [l.n, l])), PL = plan.lines || {}, planL = n => (Array.isArray(PL) ? PL[n - 1] : PL[String(n)]) || {};
  const cardAt = n => planL(n).photo?.id || null, cards = lines.filter(l => cardAt(l.n)).map(l => ({ n: l.n, id: cardAt(l.n) }));
  const mins = lines.length ? (lines[lines.length - 1].end || 0) / 60 : 0;
  const out = { film, cards: cards.length, cardIds: new Set(cards.map(c => c.id)).size, minutes: +mins.toFixed(2), cardsPerMin: mins ? +(cards.length / mins).toFixed(2) : 0, fails: [], warns: [], uncovered: [], excused: [] };
  for (const c of cards) if (!meta[c.id]) out.fails.push(`L${c.n}: card "${c.id}" not in photos.json`);
  if (!Array.isArray(ents)) { out.skipped = true; out.fails.push("entities.json missing (the producer writes it: [{name, kind, lines}])"); out.pass = false; return out; }
  const missing = new Map(); const mf = path.join(dir, "photos_missing.txt");
  if (fs.existsSync(mf)) for (const raw of fs.readFileSync(mf, "utf8").split(/\r?\n/)) { const s = raw.trim(); if (!s || s.startsWith("#")) continue;
    const m = s.match(/^(.+?)\s*(?::|\||\s-\s|\s—\s|\s–\s)\s*(.*)$/); const name = norm(m ? m[1] : s), why = (m ? m[2] : "").trim();
    missing.set(name, why); }
  for (const e of ents) {
    if (!e || !e.name) { out.fails.push("entities.json: entry without a name"); continue; }
    if (e.kind && !KINDS.has(e.kind)) out.warns.push(`${e.name}: unknown kind "${e.kind}"`);
    const names = [e.name, ...(e.aliases || [])], re = names.map(x => new RegExp("\\b" + x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+") + "\\b"));
    let ns = (e.lines || []).map(Number).filter(n => byN.has(n)).sort((a, b) => a - b);
    if (!ns.length) ns = lines.filter(l => re.some(r => r.test(l.text || ""))).map(l => l.n);   // no "lines": find the mentions in the text
    if (!ns.length) { out.warns.push(`${e.name}: no line mentions it`); continue; }
    const first = ns[0], ok = n => { const id = cardAt(n); return !!id && (!e.photo || id === e.photo); };
    if (!re.some(r => r.test(byN.get(first).text || ""))) out.warns.push(`${e.name}: name not found in L${first} text (add an alias?)`);
    const covered = [first - 1, first, first + 1].some(ok), why = missing.get(norm(e.name)) ?? names.slice(1).map(a => missing.get(norm(a))).find(x => x !== undefined);
    if (covered) { /* ok */ } else if (why) out.excused.push({ name: e.name, line: first, why });
    else if (why === "") { out.uncovered.push({ name: e.name, kind: e.kind, line: first }); out.fails.push(`${e.name} (${e.kind || "?"}) L${first}: listed in photos_missing.txt without a reason`); }
    else { out.uncovered.push({ name: e.name, kind: e.kind, line: first }); out.fails.push(`${e.name} (${e.kind || "?"}) first mention L${first}: no card on L${first - 1}-L${first + 1} and no reason in photos_missing.txt`); }
    for (let i = 1; i < ns.length; i++) { const a = byN.get(ns[i - 1]), b = byN.get(ns[i]); if (b.start - a.end > gap && ![ns[i] - 1, ns[i], ns[i] + 1].some(ok) && !why)
      out.warns.push(`${e.name}: returns at L${ns[i]} after ${Math.round(b.start - a.end)} s with no card (rule: show it again after a long gap)`); }
  }
  out.pass = !out.fails.length; return out;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const film = process.argv[2]; if (!film) { console.log("usage: node photocheck.mjs <film> [--gap 120]"); process.exit(2); }
  const gi = process.argv.indexOf("--gap"), r = photoCoverage(film, { gap: gi > 0 ? +process.argv[gi + 1] : 120 });
  console.log(`photo coverage ${film}: ${r.cards ?? 0} cards (${r.cardIds ?? 0} photos) over ${r.minutes ?? "?"} min = ${r.cardsPerMin ?? 0} cards/min`);
  for (const x of r.excused || []) console.log(`  excused  ${x.name} L${x.line}: ${x.why}`);
  for (const w of r.warns) console.log("  warn     " + w);
  for (const f of r.fails) console.log("  FAIL     " + f);
  console.log(r.pass ? "PHOTO COVERAGE PASS" : `PHOTO COVERAGE FAIL: ${r.uncovered?.length ?? 0} uncovered entit${(r.uncovered?.length ?? 0) === 1 ? "y" : "ies"}${r.uncovered?.length ? " (" + r.uncovered.map(u => u.name).join(", ") + ")" : ""}`);
  process.exit(r.pass ? 0 : 1);
}
