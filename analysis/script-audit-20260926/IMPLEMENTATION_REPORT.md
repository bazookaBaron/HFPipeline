# Script/topic implementation report

## What changed

- `orchestrator/lib/video/v3/narrativeGuide.js` is new. It translates the five reference phase maps into a compact 45–55 s narration brief: immediate named angle, early concrete mental model, causal middle, an earned complication/extension and a callback takeaway. It explicitly permits different arcs for system redesign, concept teaching and company/platform explainers. Its validator only rejects a generic meta-intro, an in-topic-script follow/share CTA and consecutive identical sentences. Other qualitative judgments remain prompt/editorial concerns.
- `orchestrator/lib/video/v3/storyboardGen.js` imports that guide in DH, LC and DC prompt construction and adds the validator. Its existing scene counts, word bands, compiler, layouts, profile choice, visual prompts, render path and Claude's uncommitted BR changes were preserved. The fixed failure/redesign and mandatory numeric-payoff wording was softened because V3/V4 do not use that arc and exact numbers can be invented.
- `orchestrator/generate-topics.js` now asks Gemini for a concrete question/tension, one explainable technical mechanism and a consequence that fit the actual 45–55 s v3 format. It explicitly allows AI/platform/company-tech engineering mechanisms while requiring category variety, not company news or generic listicles. It keeps the CLI's exact `[{topic,category}]` output; cleans/filters malformed entries, removes lexical near-duplicates against current/prior topics and retries incomplete batches up to three times. It fails cleanly rather than handing the control panel a short calendar.
- New offline tests: `orchestrator/lib/video/v3/narrativeGuide.test.js` and `orchestrator/tests/generate-topics.test.js`.
- The five supplied videos were not copied or modified. V2 is byte-identical to the previous R4 reference (SHA-256 `75490FEE40AEB84607C87D5EEA7B9E4ABB6E2E0D0589742C7290AF17B592BCCA`). V1/V3/V4/V5 local ASR JSON, measurement scripts, timestamped phase maps and uncertainty notes are under this folder. No cloud transcription, frame extraction or Obsidian export was performed.

## Verification actually run

```powershell
C:\Repos\tts-venv\Scripts\python.exe analysis\script-audit-20260926\transcribe_local.py
C:\Repos\tts-venv\Scripts\python.exe analysis\script-audit-20260926\measure_speech.py
C:\Repos\tts-venv\Scripts\python.exe analysis\script-audit-20260926\phase_metrics.py
node --test lib/video/v3/narrativeGuide.test.js lib/video/v3/compile.test.js lib/video/v3/timeline.test.js tests/generate-topics.test.js
node -e "const fs=require('fs'),p=require('./lib/video/v3/storyboardGen'); for(const n of ['cdn-dh','oauth-lc','k8s-dc']){const x=JSON.parse(fs.readFileSync('fixtures/v3/'+n+'.json')); console.log(n,p.validate(x,{lengthSeconds:45}))}"
```

The Node suite passed **18/18** after correcting a test expectation (the initial test run was 11/12 before the topic tests were added). The three existing DH/LC/DC storyboard fixtures each returned zero validator problems at their 45 s duration. The topic agent separately ran its five offline tests and `node --check`; the combined suite includes those five. `git diff --check` showed no whitespace errors; only Git's existing LF→CRLF notices. The subsequent read-only live dry runs are documented below.

## 2026-09-26 live dry-run follow-up

- Ran `node generate-topics.js --count 30` directly twice, parsing stdout in memory. Both returned 30 items; **neither wrote `topics.json` nor called the control-panel endpoint**. The first set had very long colon-separated technical claims. After prompt refinement, the second set was shorter and more intelligible, but still included potentially misleading claims (for example, wording that a TCP handshake establishes “trust”) and one category mismatch (Git labelled `company-tech`). The prompt now also asks for concise 6–14-word viewer-facing topics, cautious claims, and company-tech reserved for actual companies. This last category adjustment was not followed by a third live generation.
- Ran `generateStoryboard('Why can a cache serve stale data after an update?', {profile:'DH',lengthSeconds:50,layoutAudit:false,maxAttempts:3})` with live Gemini. All three attempts had a coherent topic spine but failed the existing **visual** storyboard validator on layout density, an off-screen event, then beat/scaffold cadence. This did not render a video and the visual constraints were not changed, per scope. The last narration also overpromised that invalidation “always” serves current truth.
- Ran one separate raw Gemini prompt for the same cache topic after strengthening the narration guide. It returned 11 sentences with a clear example and causal explanation, but still said a technique would “eliminate stale reads”. The new deterministic narration check flags absolute outcome words (`eliminate`, `guarantee`, `ensure`, `will always`, selected `never ...`) for repair. This check can produce a false positive when an absolute is genuinely provable; it is a guardrail, **not** technical fact verification. No further live generation was run after adding this check.
- The final combined offline test suite remains 18/18 passing. Live generated-script quality and end-to-end acceptance are **not proven**; the topic examples still need fact-checking and the v3 storyboard visual gate can fail independently of narration quality.

## Scope and remaining limits

The reference scripts are 142–170 s, substantially longer than the current 45–55 s topic slot. We preserved duration and compressed their *narrative relationships*. A single short must pick one angle, not copy a three-minute inventory. ASR mistakes (especially V4 names, V5 “webhook”) are explicitly flagged in the analysis; no hard rule relies on them. Topic deduplication is lexical and cannot reliably catch semantic paraphrases. Category balance is prompted but not hard-enforced. Live model outputs still need editorial review for factual precision, pronunciation and perceived interest; five references alone cannot prove “viral” performance.

The existing `orchestrator/brand.json` ending says “Follow for more daily videos” and promotes `vloombox.in`; it does **not** currently say “share.” We did not change it because the request was to work only on script and topic generation, and `endcard.js` appends it outside the topic script. The separate promo/endcard remains untouched, and the new validator prevents a duplicate channel CTA from appearing inside the topic narration.

Pre-existing dirty files in the main checkout (Claude's BR/other visual work, `control-panel/data/topics.json`, `control-panel/data/_topics-avoid.json`, and `scripting-pipeline/history.json`) were not reset, staged or overwritten. The only modified pre-existing files for this work are `orchestrator/lib/video/v3/storyboardGen.js` (script-only lines) and `orchestrator/generate-topics.js`. No commit was made so Claude's uncommitted changes are not accidentally included.
