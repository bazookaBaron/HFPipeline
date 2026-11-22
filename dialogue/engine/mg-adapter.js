// MG hook. The engine only talks to this file, and it only uses dialogue/mg (createMG, PLAN 12c): {seek(t), activeLayout(t), layoutInfo(t), captions(), build()}.
// MG draws its own cards + captions inside `root` (layout rects come from mg.layoutRects); the engine just seeks it. No legacy fallback.
// Episode contract (dialogue/episodes/<ep>/mg.js, owned by the MG builder): `export default function (mg, {ratio}) { mg.beat(...) ... }`,
// called right after createMG and before mg.build(). Missing mg.js = the episode runs without cards (captions only).
export function phrasesFrom(wj) { // words -> 2-6 word caption phrases, cut at punctuation
  const out = []; let cur = []; const flush = () => { if (cur.length) { out.push({ text: cur.map(w => w.w).join(" "), s: cur[0].s, e: cur[cur.length - 1].e }); cur = []; } };
  for (const w of wj.words) { cur.push(w); if (/[.!?]$/.test(w.w) || cur.length >= 5) flush(); } flush(); return out;
}
export async function initMGLayer({ root, ratio, palette, fonts, words, ep = null, captions = null }) {
  const m = await import("/mg/index.js"); const mg = m.createMG({ root, ratio, palette: palette ?? {}, fonts, base: new URL("/mg/", location.href).href });
  let epMG = false;
  if (ep) { const url = `/episodes/${ep}/mg.js`; const head = await fetch(url, { method: "HEAD" }).catch(() => null);
    if (head && head.ok) { const em = await import(url); await em.default(mg, { ratio }); epMG = true; console.log("MG: episode cards from", url, "beats", (mg.beats?.length ?? mg.beats?.() ?? "?")); }
    else console.log("MG: no", url, "- running without cards"); }
  if (captions) mg.captions(captions); else if (words) mg.captions(phrasesFrom(words));
  await mg.build();
  return { mg, epMG, hasCards: epMG, update() {}, hide() {}, activeLayout: t => mg.activeLayout(t), layoutInfo: t => mg.layoutInfo(t), caption(_p, t) { mg.seek(t); }, lint: () => mg.lint(), phrasesFrom };
}
