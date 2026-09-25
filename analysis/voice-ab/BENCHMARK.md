# Persistent voice service and A/B benchmark

2026-09-25. Outputs are local in this directory. No voice setting has been selected; the user must listen to the `*-post.wav` files. `all-results.json`, `acoustic-results.json`, and the timing JSON/WAV files preserve the measurements.

## Method

- Dedicated `C:\Repos\tts-venv\Scripts\python.exe`; one `VoiceWorker` object for all 15 calls in `benchmark.py all`. F5 and WhisperX models loaded on the first call and reused for the other fourteen. The three passages are reconstructed from the old job's `scene-1`, `scene-4`, and `scene-8` word-timing JSONs. Chunk trials concatenate the first 1, 3, or 8 sentences in that job.
- Each call forced-aligns the exact requested text, maps every whitespace token to a stable index, trims to first word minus 60 ms through last word plus 100 ms, and applies 5 ms edge fades. A failed/missing/overlapping alignment is rejected, never filled in with invented timing.
- The listed post-speed is `min(2.0, max(1.0, 200/rawWpm))`. FFmpeg `atempo` creates a pitch-preserved post-speed file. WPM is remeasured from the final file duration. This makes the A/B files comparable at ~200 WPM; it is **not** a recommendation for the production speed.
- ASR is the locally cached faster-whisper `base.en` model on CPU, without a download. WER uses lowercase alphanumeric tokens. It can penalize spelling/tokenization changes such as `lookup` → `look up` or `O(1)` → `O1`; it is not a listening-quality score. F0 is a rough voiced-frame autocorrelation estimate on the first 25 seconds of each isolated post-speed WAV; it does not measure expressiveness.

## Persistent-worker chunk trials

| Case | Cold/warm wall s | Trimmed audio s | Raw WPM | Post × | Final WPM | ASR WER | Lead trim s | Post-speed quiet windows <−60 dB | F0 median Hz |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 sentence | 212.57 cold | 7.77 | 123.5 | 1.62 | 199.3 | 0.316 | 1.06 | 9.58% | 116.5 |
| 3 sentences | 17.24 warm | 22.28 | 118.5 | 1.69 | 200.0 | 0.128 | 1.06 | 15.33% | 127.0 |
| 8 sentences | 37.95 warm | 52.06 | 109.5 | 1.83 | 200.0 | 0.091 | 1.06 | 19.51% | 128.7 |

A separate five-word smoke call took 374.74 s cold and trimmed 0.843 s at the front. Its cold time is not directly comparable with the later batch's 212.57 s because caches and process state differed. The 3- and 8-sentence *warm* calls are strong evidence of reduced repeated-load overhead, not a guaranteed per-job speedup. Internal sentence gaps remained long: chunk-3 raw gaps 1.221/0.901 s; chunk-8 raw gaps 0.900–2.281 s. After post-speed they are still often ~0.5–1.2 s, above the prior reference estimate (~0.2 s median). Chunking alone does not fix prosody/pause policy.

## Three real passages at four F5 speeds

| Passage | F5 × | Post × | Final WPM | WER | Lead trim s | Quiet <−60 dB | F0 median Hz |
|---|---:|---:|---:|---:|---:|---:|---:|
| scene 1, hash-table question | 1.0 | 1.66 | 199.9 | 0.240 | 1.04 | 12.73% | 128.4 |
| scene 1 | 1.2 | 1.41 | 199.9 | 0.320 | 0.66 | 9.70% | 126.3 |
| scene 1 | 1.4 | 1.23 | 199.6 | 0.320 | 0.44 | 6.97% | 139.5 |
| scene 1 | 1.6 | 1.09 | 199.7 | 0.320 | 0.28 | 0.91% | 131.9 |
| scene 4, linked-list explanation | 1.0 | 1.96 | 200.1 | 0.050 | 1.60 | 12.71% | 134.8 |
| scene 4 | 1.2 | 1.75 | 200.0 | 0.050 | 0.64 | 8.00% | 143.7 |
| scene 4 | 1.4 | 1.49 | 199.6 | 0.050 | 0.56 | 4.33% | 131.5 |
| scene 4 | 1.6 | 1.34 | 199.6 | 0.050 | 0.24 | 1.67% | 123.7 |
| scene 8, HashDoS/CPU | 1.0 | 1.83 | 199.6 | 0.150 | 0.54 | 3.33% | 157.9 |
| scene 8 | 1.2 | 1.56 | 199.6 | 0.150 | 0.22 | 0.00% | 140.4 |
| scene 8 | 1.4 | 1.33 | 199.6 | 0.150 | 0.24 | 0.00% | 123.1 |
| scene 8 | 1.6 | 1.17 | 199.7 | 0.100 | 0.20 | 0.67% | 118.2 |

The local ASR repeatedly renders `O(1)` and `O(N)` as `O1`/`ON`, and `HashDoS` as variants of “Hashdas/HashDUS”. This flags a pronunciation check but does not prove the words are unintelligible. The shortest final A/B files have similar final WPM by construction. Subjective pitch, emphasis, phrase endings, and artifacts require listening. No winner is chosen.

## Reproduction and integration status

Commands: `python -B -m unittest -v test_tts_worker.py` from `voice-pipeline`; `node --test orchestrator/lib/video/voiceService.test.js`; `C:\Repos\tts-venv\Scripts\python.exe analysis/voice-ab/benchmark.py smoke`; the same script with `all`; and `C:\Repos\tts-venv\Scripts\python.exe analysis/voice-ab/acoustic_metrics.py`. The real Node→Python integration test is recorded separately in the workstream report once it completes.

`voiceService.js` and `tts_worker.py` are additive. `generate-video.js` and `voiceSynth.js` are deliberately untouched because they belong to the other workstream. The future caller must create one service per job, `await service.synthesize(...)` for its chunks, and `await service.close()` in `finally`; it must use the returned shifted word timings after trimming. The current production path still uses the old per-scene process until Claude wires in the new service.
