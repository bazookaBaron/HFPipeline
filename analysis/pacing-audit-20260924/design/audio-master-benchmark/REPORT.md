# C3 audio mastering benchmark

Source: a byte copy of `C:\Repos\HFPipleine\control-panel\data\renders\cs-b9d30fa7964c0cf0.mp4` to `source-copy.mp4` in this directory. The main checkout's render was read only. All ffmpeg runs used the local CPU; no GPU work was started. Media files in this directory are intentionally ignored by Git.

| File | Speed applied here | Duration (s) | Integrated (LUFS) | LRA (LU) | True peak (dBTP) | 20 ms windows below −60 dBFS |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `source-copy.mp4` | — | 70.233 | −16.0 | 2.9 | −3.1 | 13.25% (3509 windows) |
| `mastered-speed1-v3.mp4` | 1.0 | 70.233 | −14.0 | 1.5 | −1.6 | 9.20% |

The direct comparison is the speed-1 row: the source is an already-delivered render. The corrected reference target is −14 LUFS, LRA ≤1.5 LU, true peak ≤−1 dBTP. The current module reaches all three on this sample by compressing before two-pass loudnorm and requesting −1.5 dBTP before AAC to preserve headroom. Quiet-window percentage remains high; mastering does not repair upstream gaps. The source measurements here differ from the earlier audit's −19 LUFS / 16.7% figures, so these numbers are tied to this exact render copy and measurement procedure. The earlier `mastered-speed1.mp4` and `mastered.mp4` files were produced by an obsolete −17 LUFS revision and must not be used as acceptance artifacts.

## Commands

```powershell
Copy-Item -LiteralPath 'C:\Repos\HFPipleine\control-panel\data\renders\cs-b9d30fa7964c0cf0.mp4' -Destination 'analysis\pacing-audit-20260924\design\audio-master-benchmark\source-copy.mp4'
node -e "const {masterVideo}=require('./orchestrator/lib/video/audioMaster'); masterVideo({inputPath:'analysis/pacing-audit-20260924/design/audio-master-benchmark/source-copy.mp4',outputPath:'analysis/pacing-audit-20260924/design/audio-master-benchmark/mastered-speed1-v3.mp4',speed:1}).then(x=>console.log(JSON.stringify(x))).catch(e=>{console.error(e);process.exitCode=1})"
node --test orchestrator/lib/video/audioMaster.test.js orchestrator/lib/video/audioMaster.integration.test.js
```

The original loudness was measured with `ffmpeg -hide_banner -nostats -i source-copy.mp4 -map 0:a:0 -af ebur128=peak=true -f null NUL`. Quiet windows were measured on mono 16 kHz float PCM decoded by ffmpeg, using nonoverlapping 320-sample windows and RMS below 0.001. This matches the module's quiet-window calculation. The benchmark output stats came from the module's post-encode ebur128 and PCM measurements.

## Integration proposal

`generate-video.js` can call `masterVideo({inputPath: draftPath, outputPath: outPath, speed, log})` in place of `speedUpVideo`. That existing file is outside this workstream's ownership and was not edited here.
