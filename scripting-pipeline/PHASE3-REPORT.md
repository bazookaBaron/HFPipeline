# Phase 3 Report — Scripting Pipeline (Gemini)

## What was built

A standalone Node.js/TypeScript project at `scripting-pipeline/` implementing the
schema-validated-call + reject-and-repair pattern from `PLAN.md` §6, adjusted for the
placeholder component contract given in the task brief.

```
scripting-pipeline/
  src/
    types.ts          internal Script/Scene/NarrationAnchor shape + zod schema + ValidationConfig
    wireSchema.ts      Gemini-wire zod schema, hand-authored GEMINI_RESPONSE_SCHEMA, wire->internal converter
    validation.ts      the 4 structural checks + orchestrator (runStructuralChecks)
    history.ts         ComponentHistory: reads/writes history.json for the variety check
    promptBuilder.ts   initial prompt + repair prompt (embeds specific failure reasons)
    geminiClient.ts    injectable GenerateFn type + real @google/generative-ai implementation
    pipeline.ts        generateScript(): the reject-and-repair loop itself
    cli.ts             `npm run generate -- --topic "..."` entry point
  test/
    validation.test.ts   fixture-driven tests for all 4 structural checks (15 tests)
    pipeline.test.ts      reject-and-repair loop tests via a fake injected GenerateFn (5 tests)
    wireSchema.test.ts    responseSchema/zod-schema shape consistency + wire->internal decoding (5 tests)
    fixtures/*.json        valid.json, pacingViolation.json, nonLiteralAnchor.json,
                            varietyViolation.json + varietyHistorySeed.json, placeholderViolation.json
  history.json         starts empty ({"categories": {}}), grows as scripts are accepted
  PHASE3-REPORT.md     this file
```

`npm install`, `npx tsc --noEmit`, and `npm test` were all run for real in this environment.
Result: 0 type errors, **25/25 tests passing** across the three test files.

## 1. Schema-validated structured call

`src/wireSchema.ts` defines `WireScriptSchema` (zod) and a hand-authored
`GEMINI_RESPONSE_SCHEMA` (Gemini's OpenAPI-subset `responseSchema` format: lowercase
`type` strings, explicit `properties`/`required`/`items`, no `$ref`/unions). The two are
kept in sync deliberately, and `test/wireSchema.test.ts` asserts structurally that every
top-level and per-scene field name in `GEMINI_RESPONSE_SCHEMA` matches
`WireScriptSchema`'s zod shape, and that every `type` used is one Gemini's structured
output actually supports — so drift between the two would fail a test, not just be
caught in production.

`geminiClient.ts` passes `GEMINI_RESPONSE_SCHEMA` as `generationConfig.responseSchema`
with `responseMimeType: "application/json"` — a real structured-output call, not prompt
instructions asking nicely for a shape.

**One deliberate wire-format adaptation**: Gemini's structured-output schema has no
first-class open string-keyed map (every `object` node needs enumerated `properties`),
but the task's `props: Record<string, unknown>` is intentionally free-form/component-owned.
So on the wire, `props` is encoded as `{key: string, value: string}[]`, and
`toInternalScript()` decodes it back into `Record<string, unknown>` (JSON-parsing each
`value`, e.g. `"42"` → `42`, `"true"` → `true`; anything that isn't valid JSON stays a
plain string) immediately after the Gemini response is parsed and before anything else
touches it. `validation.ts`, `history.ts`, `pipeline.ts`, and the tests all operate on the
internal `Record<string, unknown>` shape — this wire encoding is a private implementation
detail of `wireSchema.ts` only.

## 2. Reject-and-repair loop

`src/pipeline.ts#generateScript()`:
1. Calls the injected `generate(prompt)` function.
2. Parses the raw response with `WireScriptSchema.safeParse` (schema validation). A
   failure here is converted into `StructuralIssue[]` (`check: "schema"`) with the exact
   zod field path + message.
3. On schema success, converts to the internal `Script` shape and runs
   `runStructuralChecks()` — the four checks below.
4. If either step produces issues, `buildRepairPrompt()` re-prompts Gemini with the
   original brief **plus** a numbered list of the specific failure reasons **plus** the
   previous invalid JSON response, and retries.
5. Bounded by `config.maxRetries` (default **2**, i.e. 3 attempts total). Exhausting
   retries throws `ScriptGenerationError` carrying the full per-attempt log — it never
   silently accepts a structurally-broken script.
6. On acceptance, the script's `componentType` choices are recorded to `history.json` via
   `ComponentHistory.recordScript()`.

`test/pipeline.test.ts` proves this end-to-end using a fake `GenerateFn` (no network, no
API key) that:
- returns a good response on attempt 1 → 1 attempt, no retry.
- returns a **pacing-broken** response on attempt 1, then a good one on attempt 2 →
  confirms the loop retries, and that the second prompt sent to the fake Gemini literally
  contains the specific failure text ("under-paced") and the previous bad narration text.
- returns a **schema-broken** response (missing required field) on attempt 1, then good →
  confirms schema failures also trigger a targeted repair prompt (mentions the missing
  field name).
- always returns the broken response → confirms it gives up after `maxRetries + 1`
  attempts and throws `ScriptGenerationError` with every attempt's issues attached.
- confirms an accepted script's `componentType`s land in `history.json`.

### The four structural checks (`src/validation.ts`)

All four are deliberately generic over `componentType`/prop names (see reconciliation
note below) and each has a dedicated fixture proving it actually catches its failure mode
(`test/validation.test.ts`, 15 tests):

- **Pacing budget** (`checkPacing`): `idealWords = durationSeconds * (wordsPerMinute/60)`
  (default 150wpm), tolerance band ±25% (`pacingTolerance`, configurable). Flags both
  under-paced (would run short/dead air) and over-paced (would run long) scenes.
  Fixture: `pacingViolation.json` — a 10s scene with a 5-word narration.
- **Narration-anchor correctness** (`checkAnchors`): `anchorText` must be a literal
  (`String.includes`) substring of that scene's `narration` — case-sensitive, no
  paraphrase tolerance. Also checks `propPath` starts with `"props."` and references a
  key that actually exists in that scene's `props`. Fixture: `nonLiteralAnchor.json` —
  anchor text `"IP address"` when the narration only says `"numeric address"`.
- **Content variety** (`checkVariety`): reads the last N (`varietyHistoryWindow`, default
  15) componentType usages recorded for the script's `topicCategory` in `history.json`;
  flags a componentType reused in the new script if it already makes up
  ≥`varietyRepeatThreshold` (default 50%) of that recent window. Also independently flags
  a script where every one of ≥3 scenes uses the same componentType, regardless of
  history. Fixtures: `varietyViolation.json` + `varietyHistorySeed.json` (7/10 recent
  = `browserWindow`, then the new script reuses `browserWindow`).
- **Placeholder-content detection** (`checkPlaceholders`): rejects empty narration, empty
  `props`, empty string prop values, a denylist of boilerplate patterns (Lorem ipsum,
  "your headline here", "TBD", "coming soon", "example.com", etc. — case-insensitive
  regex), and any prop string that normalizes (lowercased, non-alphanumeric stripped) to
  the same thing as the `componentType` name. Fixture: `placeholderViolation.json` —
  one scene with literal Lorem-ipsum narration, another with a prop value equal to its
  own `componentType`.

## Was a real Gemini call exercised?

**No.** `GEMINI_API_KEY` was checked in this environment via both the shell's `process.env`
and PowerShell's `[Environment]::GetEnvironmentVariable` at User and Machine scope — it is
not set anywhere. Per the task instructions, I did not fabricate a "successful" real API
call.

`src/cli.ts` checks for the key at startup and, when absent, prints plainly:

```
GEMINI_API_KEY is not set in the environment (checked process.env and .env). No real
Gemini call will be made. Set GEMINI_API_KEY and re-run `npm run generate -- --topic
"..."` to exercise the real API + reject-and-repair loop end to end. In the meantime,
`npm test` exercises the full validation/reject-repair logic against fixtures.
```

(Verified by actually running `npx tsx src/cli.ts --topic "How DNS resolution works"` in
this environment with no key set — this exact message printed, exit code 0, no network
call attempted.)

Everything else was proven for real: `npm install`, `npx tsc --noEmit` (0 errors), and
`npm test` (25/25 passing) were all actually executed in this environment, not just
written. The real call path (`geminiClient.ts#createGeminiGenerateFn`) is wired against
`@google/generative-ai` with `responseSchema`/`responseMimeType: "application/json"` and
is exercised by the exact same `generateScript()` orchestration the fixture tests cover —
only the `GenerateFn` implementation differs (real HTTP call vs. fake in-memory function),
so once a key is available, `npm run generate -- --topic "..."` exercises the identical
reject-and-repair code path against a live response with no code changes needed.

**Model id note**: `geminiClient.ts` defaults to `gemini-2.0-flash` (overridable via
`GEMINI_MODEL` env var). Gemini model names change over time; confirm the current
generally-available model id before relying on this in production.

## Reconciliation needed once Phase 2's component contract lands

Everything here is built against the placeholder shape from the task brief. Once
`video-engine/compositions/components/README.md` publishes the real catalog, the
reconciliation is a **naming/mapping exercise**, not a redesign:

1. **`componentType` values**: right now Gemini is prompted to invent a "descriptive
   name" (`browserWindow`, `terminalSession`, `kpiCluster`, etc. — see
   `promptBuilder.ts`'s example list and the fixtures). Replace that free-text prompting
   with an explicit enum/allow-list once Phase 2's real component names are known —
   either as a zod `.enum([...])` (tightens `WireSceneSchema.componentType` and the
   matching `GEMINI_RESPONSE_SCHEMA` node to `enum: [...]`) or as a validated allow-list
   checked in `validation.ts` (a 5th structural check: "componentType must be one of the
   registered components"). Nothing else needs to change — `checkVariety`,
   `checkPlaceholders`, etc. never branch on specific componentType strings.
2. **`props` shape per component**: currently free-form key/value text pairs, decoded
   into `Record<string, unknown>`. Once Phase 2 publishes per-component prop schemas
   (e.g. `browserWindow` needs `{ urlText, screenshotSrc }`), either (a) keep the
   generic wire encoding and validate per-componentType prop shape as an additional
   structural check keyed off a lookup table imported from Phase 2's contract, or
   (b) if Gemini's structured output should enforce it directly, extend
   `GEMINI_RESPONSE_SCHEMA` with a `oneOf`-style per-componentType discriminated schema
   (Gemini's schema subset support for this should be re-verified when it's attempted —
   it's more constrained than full JSON Schema).
3. **`propPath` targets**: `checkAnchors` already validates that `propPath` (e.g.
   `"props.urlText"`) references a real top-level key in that scene's `props`; once
   Phase 2 defines which specific props are timing-relevant per component (their
   `swap_at`/`draw_at`-style timestamp variables per PLAN.md §5), tighten this to check
   against that component's known timeable prop names specifically, not just "exists".
4. **Timestamp emission**: PLAN.md §5 describes a downstream preprocessing step that
   converts `narrationAnchors` + WhisperX word timestamps into concrete
   `data-start`/`cues` values for HyperFrames. That conversion is out of scope for this
   phase and is not implemented here — this pipeline's job ends at producing a validated
   script with anchors that are guaranteed to be literal substrings of their scene's
   narration, which is exactly what that downstream step needs as an input contract.

## How to run

```bash
cd scripting-pipeline
npm install
npx tsc --noEmit          # type-check
npm test                  # runs all 25 unit tests (vitest) against fixtures, no API key needed

# To exercise a real Gemini call:
cp .env.example .env      # then fill in GEMINI_API_KEY
npm run generate -- --topic "How DNS resolution works" --category cs-fundamentals
```
