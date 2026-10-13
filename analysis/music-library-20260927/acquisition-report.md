# Music-library acquisition report — in progress

Date: 2026-09-27. Publishing scope: YouTube only. This is a partial intake, not the requested 40-track/10-SFX completion claim.

## Imported and indexed

All eight files below were downloaded through Incompetech's official catalogue UI, copied into the mood folder, paired with a CC BY 4.0 attribution sidecar containing the official ISRC page URL, decoded by ffprobe, and successfully indexed. The repository intentionally ignores audio binaries and the generated index; the sidecars remain visible in Git.

| Mood | Track | Duration (ffprobe) | BPM (local index) | Notes |
|---|---|---:|---:|---|
| calm | Wallpaper | 3:40 | 92.3 | Synth/kit/guitar; site describes a clean, non-intrusive mix. |
| dread | Oppressive Gloom | 3:19 | 123.0 | Site calls it a death-march-like dark score at 58 BPM; local beat tracker appears to use a faster subdivision. Its last seconds fade/trim; index usable end 3:17. |
| hopeful | Dream Culture | 3:34 | 69.8 | Piano/percussion; near the low edge of target. |
| investigative | Unanswered Questions | 2:46 | 117.5 | Site lists 84 BPM, local beat tracker a different pulse; documentary tension description. |
| playful | Sneaky Snitch | 2:17 | 86.1 | Named shopping-list exception below target 95–125 BPM; recognizable and should be used sparingly. |
| tension | I Can Feel it Coming | 3:35 | 95.7 | Site calls it a tension filler with guitar/synth/percussion. |
| tension | Satiate | 3:12 | 89.1 | Intense strings/percussion; reserve for high-energy tension, not neutral narration. |
| trailer | Industrial Cinematic | 4:04 | 112.3 | Percussion/synth; index `montageOk=true`, but the actual 4/4 feel and cut grid still need listening verification. |

The indexer returned `tracks=8`, `analysed=8`, `unlicensed=0`, `errors=[]`. A plan-level smoke test selected the trailer, calm, tension, and hopeful tracks for corresponding sections and emitted each exact CC BY attribution string in `credits`. This verifies plan data, **not** a finished video's `description.md`/`credits.txt` output or subjective listening quality.

## Access and source blockers

- YouTube Studio sign-in succeeded and the Audio Library offers filters and individual license labels. The browser's security policy blocked the actual file-transfer endpoint. No alternative browser/URL/download method will be used to bypass that decision. The user must manually download YouTube Audio Library files into a local folder before they can be imported and checked here.
- Pixabay lists SFX and the item's Content License, but the attempted page download did not leave a local file. The site states that downloading agrees to its license. Additional Pixabay downloads await the user's explicit choice.
- The indexer initially stalled because Numba's JIT cache tried to initialize outside the writable workspace. Running it with `NUMBA_CACHE_DIR=C:\Repos\HFPipleine\analysis\music-library-20260927\.numba-cache` completed eight tracks in under one minute after one-time compilation. The cache is ignored by the scoped `.gitignore`. This is an execution workaround, not a pipeline-code change. The button-click process still uses its configured Python and may need environment setup to refresh the index automatically.

## Rejected / not imported from the suggested names

- `Hitman` was downloaded as a candidate into Downloads but not imported: site lists 76 BPM versus the requested 85–110 and describes a very produced action cue.
- `Investigations` is only 1:34; `Fluffing a Duck` only 1:07; `Heroic Age` 1:37. `Volatile Reaction` is 155 BPM in 7/4. `Clash Defiant` is 6:16 at 170 BPM. These conflict with the supplied use cases.
- `Darkest Child` is 3:59 but its page describes a creepy dream/fantasy cue at 128 BPM, not the requested heavy, slow collapse bed.
- `Invariance` changes tempo within one file. `Angel Share` builds to a large climax. Both conflict with the steady, unobtrusive-bed rule.

## Remaining work

Source and validate roughly 28–32 more music tracks across the still-sparse mood folders and 10 SFX, complete subjective listening/voice-underlay checks, rerun the index, then verify emitted description/credits on an actual pipeline output. Do not claim completion or turn off synthesized fallback before the library passes those checks.
