# Licensed music-library acquisition plan

Status: awaiting approval and publishing-platform decision. This plan does not authorize downloading tracks with unclear rights or changing the video pipeline.

## Scope and decision

- Target approximately 36-40 music beds across `tension/`, `investigative/`, `dread/`, `hopeful/`, `playful/`, `calm/`, and `trailer/`; optional `triumphant/`; plus approximately 10 SFX in the listed subfolders.
- Confirm whether output is **YouTube-only** or also published on Instagram, TikTok, and other platforms. YouTube Audio Library copyright assurances are YouTube-specific; for multi-platform use, prefer individually cleared CC BY 4.0/Incompetech or Pixabay items and retain evidence. Do not assume an Audio Library item is cleared elsewhere.
- Treat the pasted shopping list as candidate guidance, not proof of musical fit or licensing. Official metadata already contradicts several suggested targets: `Hitman` 76 BPM, `Volatile Reaction` 155 BPM and 7/4, `Investigations` 1:34, `Fluffing a Duck` 1:07, `Impact Prelude` 80 BPM, and `Clash Defiant` 170 BPM/6:16.

## Acquisition and validation

1. Inventory any already-owned audio in `video-engine/assets/music-lib/`; preserve existing files and unrelated repository changes. It is currently empty except placeholders.
2. Select each track through the source's official UI, one by one. No scraping, guessed download endpoints, YouTube ripping, claim that a file is licensed merely because its filename matches, or account/CAPTCHA bypass. If sign-in is required, ask the user to complete it.
3. Record official item URL, title, artist, exact license, download date, required credit, and, for Pixabay, any available license certificate. Retain source evidence for Content ID disputes.
4. Audition each candidate and run local ffprobe/audio analysis: 2-4 minute preference, no vocals, no long silence or midpoint fade, stable musical body, usable tempo/key diversity, and actual mood fit. For trailers, require a strong 4/4 beat and low end; for SFX, verify clean short tails. Reject or reclassify mismatches instead of filling quotas blindly.
5. Copy accepted audio into the correct mood/category directory. Immediately add a `<filename>.license.json` sidecar with accurate metadata and official URL. Use the exact source-required attribution text and verify it reaches published `description.md`/`credits.txt` when used. A local sidecar alone is not the public attribution required by CC BY.
6. Run `python orchestrator/tools/music_index.py`, review `index.json` for licensed/usable status, mood, BPM, energy and `montageOk`, then perform a focused music-selection and credits smoke test. Report accepted, rejected, missing, and account-blocked items. Do not assert 40+10 complete unless files, licenses, and index all check out.

## Exact file scope for execution

- [NEW] `video-engine/assets/music-lib/<mood>/*.<audio extension>` and matching `*.license.json` for accepted tracks.
- [NEW] `video-engine/assets/music-lib/sfx/<category>/*.<audio extension>` and matching `*.license.json` for accepted effects.
- [GENERATED] `video-engine/assets/music-lib/index.json` (git-ignored by repository policy).
- [NEW] `analysis/music-library-20260927/acquisition-report.md` with inventory, source URLs, technical checks, attribution checks, and gaps.
- [UNCHANGED] Pipeline code, existing music README and shopping list, video outputs, and unrelated Claude work.

## Completion gate

Every accepted file must have a verified official source and license note, be audibly and technically appropriate for its slot, appear as licensed/usable in the index, and produce correct public credits in a smoke test. Any unavailable or ambiguous item remains a reported gap, not a fabricated substitution.
