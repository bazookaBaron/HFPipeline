# Spoken-script study: five supplied tech explainers

2026-09-26. **Audio/transcript only**; no frames or visual quality were inspected. V2 (`igexport-DdT5wzdsQWV (1).mp4`) is SHA-256-identical to the previously transcribed original, so its existing large-v3 word-timed ASR is reused. V1/V3/V4/V5 use local faster-whisper `small` CPU/int8 with no upload. Raw ASR and reproducible counting scripts are beside this report. A model transcript is not a human-certified verbatim script: obvious errors are flagged below and the phase labels are editorial interpretation, not metadata supplied by the creator.

## Quantitative baseline

| Video | Subject | Spoken span | ASR words | Gross WPM | Median inter-ASR-segment gap | Primary script engine |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| V1 | AI harness / Claude Code | 142.2 s | 516 | 218 | 0.23 s | Correct a common model-only misconception using one task and an action loop. |
| V2 | File upload service | 169.2 s | 551 | 195 | 0.22 s | Iterative architecture: plausible v1 → failure → v2 → new failure → v3 and refinements. |
| V3 | Transformers | 161.5 s | 559 | 208 | 0.20 s | One concrete pronoun example → mechanism → necessary extensions → why it scaled. |
| V4 | Anduril | 168.4 s | 477 | 170 | 0.40 s | Familiar-company comparison → software core → hardware and operator scenario → strategic synthesis. |
| V5 | Duplicate payments | 159.2 s | 511 | 193 | 0.38 s | Naive front-end fix → retry counterexamples → idempotency → atomic storage/webhook edge cases. |

Counts come from `measure_speech.py` and include ASR mistakes. The `small` model sometimes merges several spoken sentences into one ASR segment, especially V5 at 139–155 s; segment gaps are an approximation to rhetorical pauses, **not** true sentence pause statistics. The supplied references are approximately 2.5–3 minutes; the active v3 generator targets 45–55 seconds and about 9–16 sentences. A script-only change should compress the *logic*, not raise video duration or alter Claude's timing/render system.

## Phase maps (word counts are ASR counts in the stated time range)

### V1 — AI harness

| Time | Words | Function and hand-off |
| --- | ---: | --- |
| 0–9 s | 35 | Names the object immediately as a question, then contests the assumption that the model does everything. A two-word contradiction creates the gap to fill. |
| 9–18 s | 35 | Defines harness as surrounding software and anchors the abstraction to a familiar product/model pair. |
| 18–36 s | 70 | Gives a specific repository bug-fix request, then lists the model's missing real-world abilities. The list is not random features; each absence raises the need for a harness. |
| 36–69 s | 119 | Walks a causal tool loop: model asks, harness acts, result returns, model revises. At ~61 s it explicitly names the loop, then divides responsibilities. This is the explanatory center, not a detached definition list. |
| 69–96 s | 96 | Opens a second layer: tool access alone is insufficient; context capacity and selection matter. The same model can feel different in different products. |
| 96–107 s | 36 | Adds permission boundaries as a concrete operational constraint. |
| 107–119 s | 40 | Extends to orchestrated subagents, using a three-part repository task. |
| 119–143 s | 85 | Returns to the original distinction and ends with a memorable “brain in a jar” comparison, then states the capability combination. No new major subsystem is introduced in the final line. |

Key pattern: **misconception → job-to-be-done → causal loop → hidden constraints → compressed metaphor**. The topic is broad, but one repeated concrete task carries the middle.

### V2 — file upload service

| Time | Words | Function and hand-off |
| --- | ---: | --- |
| 0–11 s | 43 | Opens with “design a service” and an intentionally simple user→backend→storage story; immediately says that architecture breaks. |
| 11–34 s | 77 | Version 1 puts files in Postgres; describes what is stored and the specific mismatch between queryable records and large binary objects. |
| 34–51 s | 54 | Version 2 separates metadata and object bytes. This solves the *first* bottleneck, not the entire problem. |
| 51–67 s | 49 | Introduces a five-gigabyte upload to expose a **new** backend-bandwidth cost; uses a short accumulating list of consequences. |
| 67–100 s | 109 | Version 3: permission request, checks, temporary signed URL, direct transfer, and status update. The route is restated as an ordered flow after the mechanism. |
| 100–121 s | 64 | Twenty-gigabyte near-complete failure creates the multipart/retry refinement. |
| 121–145 s | 80 | Applies the same control/data-plane separation to downloads and briefly adds CDN for popular public files. |
| 145–170 s | 75 | Enumerates the responsibilities of Postgres, storage and backend, then compresses them into one design principle: control who moves bytes without carrying every byte. |

Key pattern: **plausible implementation → concrete load-induced failure → one correction → next bottleneck → refined end-to-end flow → general design principle**. “Version 1/2/3” is useful for redesign topics, not a universal video template.

### V3 — Transformers

| Time | Words | Function and hand-off |
| --- | ---: | --- |
| 0–12 s | 43 | Answers what family of models is involved, then points to attention as the one idea to unpack. The hook is an orienting question, not a contrarian claim. |
| 12–30 s | 68 | Uses one ambiguous pronoun in a sentence; the viewer can solve it before the technical name appears. The abstract problem has an observable outcome. |
| 30–48 s | 68 | Explains self-attention as evaluating which surrounding tokens matter for the current token; reuses the same pronoun example and introduces relative scores. |
| 48–64 s | 55 | Adds multiple heads as different relationship types: subject/pronoun, grammar, cause/effect, longer dependencies. The extension follows the base mechanism. |
| 64–78 s | 45 | Adds word position using a minimal “same words, different order” contrast. This is a *new necessary ingredient*, not a dramatic failure. |
| 78–100 s | 69 | Zooms out to repeated layers and their components; moves from local operation to system architecture. |
| 100–123 s | 73 | Connects the architecture to next-token training and iterative weight adjustment. |
| 123–145 s | 75 | Explains scaling via training parallelism, then uses a short ascending list for its consequence. |
| 145–163 s | 63 | Restates the entire answer at a higher level: what context matters now, repeated across layers. |

Key pattern: **name concept → solvable example → core mechanism → supporting pieces → broader consequence → simplified answer**. It does not follow a naive-design/failure/redesign arc; forcing one would distort the topic.

### V4 — Anduril company/platform explainer

| Time | Words | Function and hand-off |
| --- | ---: | --- |
| 0–8 s | 21 | Direct “what is it?” question, then familiar-company names to locate the category and promise a distinction. |
| 8–22 s | 38 | Contrasts slow traditional procurement with a software-and-autonomy framing. |
| 22–48 s | 74 | Articulates the proposed build strategy, then supplies founder and valuation context. These historical/financial details are time-sensitive and **must not be generated without verification**. |
| 48–75 s | 82 | Pivots from a product list to the software core (Lattice) and gives it the familiar “operating system” analogy; explains sensor aggregation and operator decisions. |
| 75–108 s | 86 | Names hardware categories and runs an operational monitoring scenario to show the relationship between software, sensors and human supervision. |
| 108–128 s | 58 | Explains why AI enters: too much simultaneous sensor data, then a short list of questions an operator needs answered. |
| 128–145 s | 50 | Adds manufacturing/scale as the second strategic lever. |
| 145–169 s | 68 | Compares with two familiar companies, then resolves the identity as combined hardware, AI, software and manufacturing. |

Key pattern: **category comparison → differentiator → platform mechanism → concrete application → business/operational consequence → identity statement**. This is not a tutorial and should not be forced through a naive-approach failure beat.

### V5 — duplicate payments

| Time | Words | Function and hand-off |
| --- | ---: | --- |
| 0–10 s | 33 | Opens with the desired outcome, proposes a plausible easy fix (disable Pay), then limits its scope to the frontend. |
| 10–24 s | 49 | A chain of refresh/network/mobile retries makes the failure concrete and unavoidable. Each question changes one condition; this is not generic “it doesn't scale.” |
| 24–46 s | 68 | Names and explains the idempotency key using one checkout attempt and repeated requests; same key means return the original result. |
| 46–58 s | 39 | Extends the same key to the payment processor. |
| 58–103 s | 139 | Deepens to server state: persisted key/user/amount/status, already-succeeded vs processing behavior, atomic insertion, unique constraint. This is the longest phase because it carries the real mechanism. |
| 103–136 s | 110 | Adds an independent completion signal (provider webhook) and a second idempotency problem: duplicate events. The refinement is genuinely new but causally linked. |
| 136–160 s | 73 | Replays the entire flow in order, then contrasts duplicate *click* protection with duplicate *payment* protection. |

Key pattern: **obvious fix → counterexample ladder → invariant/key → atomic implementation → downstream repeat event → contrasted takeaway**.

## Cross-video writing grammar actually supported by the five

1. **The subject appears immediately.** Every video names a specific question, task, or object in its first ~2 s. Hooks vary: V1/V3/V4 ask what something is; V2 proposes designing a system; V5 asks how to prevent a failure. A mandatory “shocking statistic” or “you've been doing it wrong” template would be unsupported.
2. **A single explanatory spine connects the sections.** V1 repeatedly returns to a repository task; V3 to token context; V2 to file bytes; V5 to one checkout attempt; V4 to one company's operating model. Each later layer modifies or expands the same mental model.
3. **Concrete before abstract.** V3's pronoun, V5's retry and V2's oversized upload are introduced before/alongside the abstract mechanism. V4 uses well-known company comparisons; V1 uses a familiar coding request.
4. **The middle is causal, not a list of facts.** It says who acts, on what, what changes, and why the next step is needed. Terms such as self-attention, pre-signed URL and idempotency key arrive after their job is apparent.
5. **Complications are earned.** V2/V5 use failures of an earlier solution; V3 uses necessary architectural additions; V1 uses hidden operational constraints; V4 uses product and manufacturing layers. Thus “naive approach → failure” is one *optional* arc, not the master template.
6. **Short transition signals steer depth.** “But”, “now”, “so”, “imagine”, “let's zoom out” announce a problem, extension or synthesis. They are useful because they change the viewer's question; mechanically adding a rhetorical question to every scene would become repetitive.
7. **Endings compress earlier details into one relationship.** The final lines do not bolt on an unrelated fact. The user's follow/share/brand message is not part of these topic scripts and should remain the independently appended `endcard.js`/`brand.json` content.

## Implications for the current 45–55 s generator

The references spend 477–559 words across 7–9 analytical phases. The current generator targets roughly 120–200 words and 9–16 sentences, so a new script must choose **one angle and one central mechanism**. Keep: named hook, concrete viewer model, 2–4 causal mechanism steps, one meaningful caveat or extension, and a callback takeaway. Skip secondary branches (e.g. V2's multipart *and* CDN in one 50 s clip; V3's layers *and* training *and* scaling; V4's founder valuation). Topic selection must reject subjects that cannot be explained at this depth in one short, or frame a narrow sub-question instead.

Do not treat the source clips as a guarantee of virality. No watch-time, shares, audience or controlled experiment data was supplied. The feasible target is **reference-like script architecture and spoken clarity**, measured with output audits and editorial review.

## Transcript cautions

- V1 ASR renders “file system” as “file stem” near 123 s and may render “git” as “JIT”; these words are not trusted quotes.
- V3 ASR splits “ChatGPT” and omits some punctuation. It may also overstate technical generalizations; this report does not independently fact-check the video's content.
- V4 small-model ASR misrenders “Anduril” in its opening and “Palmer Luckey” around 34–40 s; product names and the 2025 valuation are not verified here. Use the script structure, not those unverified claims, as generation exemplars.
- V5 ASR repeatedly renders “webhook” as “webhawk” and collapses the final recap into one long segment; the phase boundary is approximate. The clip speaks a short example key, whereas the current v3 rule avoids speaking IDs; that difference alone does not justify removing a TTS/clarity safeguard.
- Exact verbatim correction would require a careful auditory proofread; this analysis instead preserves raw ASR and avoids building rules on uncertain tokens.
