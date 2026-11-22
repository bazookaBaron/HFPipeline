# BOARD mode (diagram board: abstract / causal explanations on ONE persistent card)

Crisp vector, poster theme. One paper card (6px ink border, r26, hard shadow) on the hue bg + dot grid; ink strokes drawn on, flat fills, DOM chips. Files:
`runtime/board/board-kit.js` (kit, global `B`), gates `runtime/iso/subjectcheck.js` (auto board mode when `window.B` exists) + `runtime/iso/seektest.js`.
Demo + `tools/make.sh`: `analysis/sketch-iso-modes-20261010/build-board/` (`inflation.js` -> comp-lf 1920x1080, comp-reel 1080x1920, 30 s).

## Set up a comp (copy demo `tools/page.html.tpl`)
- Page loads: `gsap.min.js theme.js board-kit.js puppet.js`. Head `<style>` = @font-face + `#root` size only (kit CSS is injected by JS). `#root` holds only the puppet `#pz` (z 90).
- Scene: `Theme.apply(THEME); const tl = B.timeline(); B.board({tl,W,H,dur}); build parts; verbs; tl.seek(0); B.redraw(); return tl;`
- World coords = card inner area: LF 1408x968 (card x<=1470, puppet zone clear), reel 988x1198 (card y<=1270, lower puppet zone clear). `B.w/B.h`.
- State is a pure function of the clock (records + `B.redraw()`); no part tweens, so any seek order is identical. Never use Math.random/Date/rAF/CSS animation.

## Parts (all return ids; ids are focus subjects; coords = centres)
- `B.node(id,{x,y,w?,h?,shape:'box'|'pill'|'circle',text,fill:'pale'})` auto-size from text ("\n" = lines).
- `B.arrow(id,from,to,{curve,ctrl,head,gap})` from/to = node id or [x,y]. `B.loop(ids,{cx,cy,rx,ry|r,texts,shape,fill,start})` -> `{nodes,arrows,ids}` (arrow ids `a>b`).
- `B.underline(id,target)`, `B.ring(id,target,{pad})`, `B.cross(id,target,{dx,dy,size})` (--alert), `B.check`, `B.label(id,text,{x,y,fill:'marker'|'pale'|'ink'|'alert',card,w})`.
- `B.bracket(id,ids,text,{side:'bottom'|'top'|'left'|'right'})`, `B.axis(id,{x,y,w,h,xl,yl})` (x,y = origin bottom-left), `B.curve(id,pts01,{axis})`, `B.icon(id,'coin'|'person'|'doc'|'gear'|'bulb',{x,y,size})`.

## Verbs (t = absolute seconds; first arg `tl` kept for symmetry)
- `B.draw(tl,ids,t,dur?)` stroke draws on, label/text pops at 85%; icons fill by themselves. `B.fill(tl,id,t,color?)` flat fill + hard shadow pop after the outline. `B.hide(tl,ids,t)` retract (use for rings).
- `B.dim(tl,ids,t)` old parts: thinner `--deep` ink, fill -> pale, no shadow (no opacity).
- `B.focus(tl,ids,t0,t1,{zoom,max,dx,dy,ramp,tier})` camera pans/zooms the CONTENT inside the fixed card (card edge + hue bg always visible); ramps in over 1.2 s BEFORE t0, holds to t1; marker halo on the subject while focused.
  Zoom is chosen to meet the min frame share (small tier 1.5%/2% for node/arrow/ring..., large 6%/8% for groups/axis/bracket/curve/arrays), floor 1.12, cap 2.4 (warns if the cap breaks the share).
- `B.pull(tl,t,{d})` back to the whole board (arrives t+1.2). Be fully drawn by `t0`; one focus per narrated subject, cover every beat.

## Theme rule (HARD, PLAN s2)
Colours only via theme vars `ink paper pale deep bg shadow marker alert`. Strokes ink 6px round; highlights marker; X alert; labels DOM (Anton/Inter). Seeded wobble `B.board({wobble})` (default 1.2 px) on lines only.

## Gates (exit 1 on failure) and render
1. `node runtime/iso/seektest.js <compDir>` determinism; `--shots 3,12,22` PNGs to look at (theme, readable, nothing clipped).
2. `node runtime/iso/subjectcheck.js <compDir>` per focus beat every 0.25 s: inside card view+frame, tier min size, outside puppet zone (LF x<=1560 / reel y<=1360), fully drawn, <=15% covered by other chips.
3. `cd <compDir> && npx --yes hyperframes@0.8.46 check`; 4. `node runtime/strays.js <compDir>`.
Render: `npx --yes hyperframes@0.8.46 render --workers 4 --no-browser-gpu -o out.mp4`.
