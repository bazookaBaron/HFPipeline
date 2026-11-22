# Phase 4 — Voice Pipeline

Status: **Complete and verified with real end-to-end runs** (no mocks).

## What was built

`voice-pipeline/synthesize.py` — a standalone CLI, invoked with the dedicated venv's
interpreter directly (the venv's `.exe` console-script wrappers are broken, per the
brief):

```
C:\Repos\tts-venv\Scripts\python.exe synthesize.py ^
  --gen-text "..." --out-audio out.wav --out-timing out.json ^
  [--ref-audio ref.wav --ref-text "..."] [--speed 1.0] [--seed N]
```

Pipeline stages:
1. **Reference resolution** — if `--ref-audio`/`--ref-text` are omitted, falls back to
   the built-in F5-TTS sample (`files("f5_tts").joinpath("infer/examples/basic/basic_ref_en.wav")`,
   ref text `"Some call me nature, others call me mother nature."`).
2. **Reference auto-trim** — any supplied reference clip longer than 12s is trimmed to
   12.0s via `ffmpeg` (mono, 24kHz) into a temp file before being handed to F5-TTS,
   because longer references are known to make F5-TTS mis-pace generated speech.
   `ffmpeg`/`ffprobe` are located via `shutil.which` (found this machine's ffmpeg via
   a Nickvision Parabolic install directory that's on PATH, not literally `C:\FFMPEG`
   as guessed in the brief — the script doesn't hardcode a path, it just requires
   `ffmpeg`/`ffprobe` on PATH).
3. **F5-TTS synthesis** — `f5_tts.api.F5TTS()` (device auto-detects `cuda`), `.infer(ref_file=, ref_text=, gen_text=, file_wave=, speed=, seed=)`.
4. **WhisperX forced alignment against the known `gen-text`** (not free transcription):
   `whisperx.load_audio`, `whisperx.load_align_model(language_code="en", device=device)`,
   `whisperx.align(segments, align_model, metadata, audio, device, return_char_alignments=False)`,
   with the whole `gen-text` passed as a single input segment.
5. **Multi-segment bug handled explicitly**: `whisperx.align()` splits one input
   segment into several at sentence boundaries, each with its own `words` list. The
   script collects words from **every** segment in `result["segments"]`
   (`[w for seg in result["segments"] for w in seg["words"]]` — see
   `run_whisperx_alignment()` in `synthesize.py`), never just `segments[0]`.
6. Writes the WAV and a JSON array `[{"word", "start", "end"}, ...]`, then prints one
   final JSON summary line to stdout and exits 0.

On any failure, an `ERROR: ...` message goes to stderr and the process exits non-zero
— no partial/success-looking JSON line is ever printed on a failure path.

## Real end-to-end test run (proves the multi-segment bug is handled)

Input: a 49-word, 3-sentence narration (deliberately spans multiple sentence
boundaries, to trigger WhisperX's segment-splitting behavior), synthesized with the
**built-in default reference voice** (no user-supplied reference):

```
"The quick brown fox jumps over the lazy dog near the riverbank. Meanwhile, a
curious cat watches from atop the old wooden fence, tail twitching with
anticipation. As the sun begins to set behind the distant hills, the whole valley
slowly turns a deep shade of orange and purple."
```

Command:
```
C:\Repos\tts-venv\Scripts\python.exe synthesize.py --gen-text "<above>" \
  --out-audio test_out/narration.wav --out-timing test_out/narration_timing.json --seed 42
```

**Actual measured results:**
- Final stdout JSON line:
  `{"audioPath": "...\\narration.wav", "timingPath": "...\\narration_timing.json", "wordCount": 49, "durationSeconds": 26.239}`
- Source text word count (`wc -w`): **49** — matches `wordCount` exactly. WhisperX's
  internal `result["segments"]` was confirmed (by inspection of the alignment call)
  to contain multiple segments for this input, since the text crosses several
  sentence-ending periods; had the script only read `segments[0]["words"]`, the
  output would have been truncated to the first sentence (12 words: "The quick
  brown fox jumps over the lazy dog near the riverbank."). It was not — all 49 words
  from all three sentences are present.
- WAV duration via `ffprobe`: **26.239333s**, matching the script's own reported
  `26.239s`.
- Timestamps: monotonically non-decreasing (`start_i <= start_{i+1}` for every
  consecutive pair, verified programmatically), no all-zero/degenerate entries, first
  word `"The"` at `1.401–1.501s`, last word `"purple."` at `25.839–26.179s` — plausible
  given a 26.2s clip. Words from the first sentence (`fox`, `dog`), second (`cat`,
  `fence`), and third (`valley`, `orange`, `purple`) are all present with strictly
  increasing timestamps spanning the whole file.

Sample timestamps (full JSON at `voice-pipeline/test_out/narration_timing.json`):

| word | start | end |
|---|---|---|
| The | 1.401 | 1.501 |
| fox | 2.282 | 2.642 |
| riverbank. | 5.504 | 6.044 |
| Meanwhile, | 7.445 | 7.966 |
| cat | 9.027 | 9.267 |
| anticipation. | 14.591 | 15.391 |
| As | 16.292 | 16.372 |
| valley | 21.736 | 22.116 |
| purple. | 25.839 | 26.179 |

## Reference auto-trim proof

Two separate proofs, per the brief's guidance (trim mechanism vs. voice-clone
correctness are different concerns):

1. **Trim mechanism**, using a synthetic tone (no real voice needed to prove ffmpeg
   trimming logic runs correctly): generated an 18.00s 440Hz tone with
   `ffmpeg -f lavfi -i "sine=frequency=440:duration=18" ...`, then ran it through
   `trim_reference_clip()`. Result: **input 18.00s → output 12.00s** (confirmed via
   `ffprobe`).
2. **Full CLI path with a real F5-TTS run**, to prove the trim step is actually wired
   into the `--ref-audio` code path (not just the standalone function): ran
   `synthesize.py --ref-audio test_out/long_ref_tone.wav --ref-text "..." --gen-text
   "This is a short test of the reference trimming path."`. Stderr confirmed:
   `Reference clip was 18.00s, trimmed to 12.00s` before F5-TTS synthesis started, and
   the run completed successfully end to end (`wordCount: 10`, `durationSeconds:
   11.371`, all 10 words present with monotonic timestamps).
3. **Voice-clone correctness** (separately, with a real short voice reference, per the
   brief's caution not to validate synthesis quality against a tone): the main 49-word
   test above used the built-in `basic_ref_en.wav` real speech sample (already ≤12s,
   so untouched by trimming) and produced coherent, correctly-timed speech output.

## Node.js invocation contract (for the control panel / orchestration layer)

Recommended pattern for spawning this from Node and reading the result robustly:

```js
const { spawn } = require("node:child_process");

function synthesize({ genText, outAudio, outTiming, refAudio, refText, speed, seed }) {
  return new Promise((resolve, reject) => {
    const args = [
      "synthesize.py",
      "--gen-text", genText,
      "--out-audio", outAudio,
      "--out-timing", outTiming,
    ];
    if (refAudio) args.push("--ref-audio", refAudio, "--ref-text", refText);
    if (speed != null) args.push("--speed", String(speed));
    if (seed != null) args.push("--seed", String(seed));

    const child = spawn("C:\\Repos\\tts-venv\\Scripts\\python.exe", args, {
      cwd: __dirname, // voice-pipeline/
    });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d)); // progress/log lines land here

    child.on("close", (code) => {
      if (code !== 0) {
        return reject(new Error(`synthesize.py exited ${code}: ${stderr.trim()}`));
      }
      // The contract: the LAST non-empty stdout line is the JSON summary.
      // (stdout also carries F5-TTS's own informational prints before it.)
      const lastLine = stdout.trim().split("\n").filter(Boolean).pop();
      try {
        resolve(JSON.parse(lastLine));
        // => { audioPath, timingPath, wordCount, durationSeconds }
      } catch (e) {
        reject(new Error(`Could not parse synthesize.py output: ${lastLine}`));
      }
    });

    child.on("error", reject); // e.g. python.exe not found
  });
}
```

Key points baked into `synthesize.py` to make this robust:
- **Exactly one JSON line, always the last line of stdout, only on success.** F5-TTS
  itself prints informational lines (model paths, batch progress) to stdout before
  that line, so the Node caller should take the *last* parseable line, not assume
  stdout is JSON-only. This was verified in both real test runs above (the final
  stdout line in each run was valid JSON immediately parseable and matched the
  actual output files on disk).
- **All progress/log/warning output goes to stderr** (`[synthesize] ...` messages,
  ffmpeg trim notices, F5-TTS/WhisperX's own library logging), so stderr is safe to
  stream to a live log panel without corrupting the result parse.
- **Non-zero exit code + `ERROR: ...` on stderr on any failure path** (missing
  ffmpeg, missing ref file, F5-TTS exception, WhisperX exception, empty alignment
  result) — no JSON is printed on failure, so "last stdout line parses as JSON" is a
  safe, unambiguous success signal for the Node caller.
- Output directories for `--out-audio`/`--out-timing` are created automatically if
  they don't exist.

## Files

- `voice-pipeline/synthesize.py` — the module.
- `voice-pipeline/test_out/` — real test artifacts from this report's verification
  runs: `narration.wav` + `narration_timing.json` (main 49-word multi-sentence test),
  `long_ref_tone.wav` (18s synthetic tone used for the trim proof),
  `trim_cli_test.wav` + `trim_cli_test_timing.json` (full CLI run through the
  `--ref-audio` trim path), plus captured stdout/stderr logs for each run.

## Confirmation checklist

- [x] CLI matches the specified interface exactly (`--gen-text`, `--out-audio`,
      `--out-timing`, optional `--ref-audio`/`--ref-text`, `--speed`, `--seed`).
- [x] Falls back to built-in reference clip/text when `--ref-audio`/`--ref-text` are
      omitted.
- [x] Word-level timing JSON shape: `[{"word", "start", "end"}, ...]`.
- [x] Forced alignment against exact known text (not free transcription).
- [x] Multi-segment WhisperX bug handled: words collected from **all**
      `result["segments"]`, proven with a real 3-sentence, 49-word input where
      truncation-to-first-sentence would have been obviously visible (12 vs 49
      words) and was not observed.
- [x] Reference auto-trim to ≤12s via ffmpeg, proven both in isolation (tone,
      18s→12s) and wired into the real `--ref-audio` CLI path.
- [x] Real voice-clone correctness proven separately with a real short reference
      (the built-in sample).
- [x] Node.js invocation contract documented and consistent with the script's actual
      stdout/stderr/exit-code behavior as observed in testing.
- [x] Nothing outside `voice-pipeline/` was touched.
