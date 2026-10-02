# Shared context for the runtime-authoring setup agents (read first)

**Project:** C:\Repos\HFPipleine. We hand-author videos per topic as standalone HyperFrames HTML compositions (hyperframes@0.8.46, seek-safe GSAP), with no templates and no Gemini scripting.

**Decisions so far:**
- **Style:** a monochrome poster theme (`runtime/theme.js`: one hue per video, rotated) with a dot-grid background and off-white `--paper` cards. Every shape has a 6 px `--ink` outline and a HARD offset shadow in `--shadow` (10 px, no blur). Accent words get a `--marker`; `--alert` is used only for ✕ marks and stamps. The look is bold, flat and editorial.
- **Character:** a rigged SVG puppet in the poster style (`runtime/puppet.js`; API in video-engine/assets/mascot/puppet/README.md; demo out/puppet-demo/index.html).
- **Motion verbs:** `runtime/verbs.js` (drop, rise, whip, pop, slam, out, pulse, shake, hl, draw, odo, scramble, type, ring, click, burst, cam, glitch, halftone, captions). Endcard: `runtime/endcard.js` + `runtime/append_endcard.py` (reels only).
- **Example reels:**
  - `out/reels/llm-built/` (v2, the user liked it): reel.html, build.js, BRIEF.md, mix.py, sfxdump.js.
  - `out/reels/vibe-users/` (v1).
- **Target grammar:** analysis/runtime-reels/REFERENCE-STUDY.md. Read only what you need.
- **Weekly plan:** analysis/plans/WEEKLY-PRODUCTION-PLAN.md.

**Rules for every agent:**
- **Token discipline:**
  - Never print big files.
  - Use targeted reads and edits, not full-file re-reads.
  - Look at contact sheets only, at most a few times.
  - Tail logs.
- **Seek-safe:**
  - No Math.random, Date, rAF, setTimeout or CSS animations driving visuals.
  - Every tween is on the paused timeline, with a finite repeat.
  - A `fromTo` whose from-state shows an element needs `immediateRender:false`.
  - Elements are hidden until their entrance.
- **Layout:** content never overlaps the captions or the character; `npx --yes hyperframes@0.8.46 check` must reach 0 errors.
- **Commits:** commit only your own new or changed paths (`git add <explicit paths>`, never -A). The message prefix is given in your task; end with "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>". Never commit .env, out/, audio, or control-panel/data.
- **Downloads:** only what your task explicitly allows. Don't publish anything.
- **Secrets:** keys are in scripting-pipeline/.env (GEMINI_API_KEY, FAL_KEY). Never print them.
