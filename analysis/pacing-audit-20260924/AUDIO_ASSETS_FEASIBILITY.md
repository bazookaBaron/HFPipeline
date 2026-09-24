# Audio, assets, and production feasibility audit — 2026-09-24

Scope: the five reference reels R1–R5 and `cs-b9d30fa7964c0cf0.mp4` (OURS), as identified in `MOTION_PACING_PLAN.md`. This is a pre-implementation audit. The script/grammar and graphics assessments belong to the other audit streams.

## Executive findings

1. The strongest proven audio difference is the floor between phrases. In the six existing 16 kHz mono extracts, 16.7% of OURS's 20 ms windows are below −60 dBFS; each reference is at 0.1–0.2%. That supports a recommendation to remove scene-head silence and control the background floor. It does **not** establish that the references use music.
2. A limited pitch sample places OURS lower than all five references (median estimated F0 134.5 Hz versus 205–229 Hz). The references are mixed audio, and this estimator can lock to background sound or harmonics; treat this as a direction for auditioning, not a voice-selection specification. Pitch range alone cannot establish perceived energy, expressiveness, or intelligibility.
3. OURS's composition explicitly contains ten narration clips and 25 SFX placements (nine boundary whooshes plus 16 animation cues), with no music clip. The reference files are final mixes only. Their SFX density, music/ambience source, voice/SFX balance, and ducking remain unresolved without listening or separation.
4. The repository contains one embedded-raster `spongebob.svg` mascot, six SFX source files, and code-drawn generic icons. The plan calls the mascot user supplied, but there is no rights or source record for it or for the five copied MP3 cues. Reference logos and cartoon characters are visual examples, not production assets in this repo. Clear provenance and an original mascot are practical prerequisites for autonomous publication; this is an asset-management recommendation, not a legal finding.
5. The audited control-panel run took **12 min 47.060 s** from `startedAt` to `endedAt` for ten scenes and a 70.23 s final video. Stage timings and monetary charges for that particular run are not retained. A 25–40-scene target cannot responsibly be assigned a single time or cost number from this evidence.

## Voice and level evidence

| File | Duration of extracted audio | 20 ms RMS p10 / p50 / p90 (dBFS) | Windows < −60 dBFS | First 25 s voiced-frame F0 p10 / median / p90 (Hz) |
|---|---:|---:|---:|---:|
| R1 DDoS | 176.9 s | −32.0 / −18.8 / −14.5 | 0.1% | 155.7 / 205.1 / 231.9 |
| R2 deployment | 145.6 s | −34.2 / −19.5 / −14.3 | 0.1% | 168.2 / 219.2 / 254.0 |
| R3 worktrees | 134.6 s | −40.7 / −19.9 / −14.3 | 0.2% | 158.4 / 210.5 / 266.7 |
| R4 upload | 169.7 s | −40.4 / −19.9 / −14.1 | 0.2% | 174.7 / 228.6 / 262.3 |
| R5 ontology | 164.9 s | −29.9 / −18.3 / −13.0 | 0.1% | 148.1 / 213.3 / 347.8 |
| OURS | 70.2 s | −68.8 / −24.8 / −14.6 | 16.7% | 110.0 / 134.5 / 185.0 |

The level difference is primarily a discontinuity/floor problem: the loudest tenth of OURS is close to R1–R4 (about −14 to −15 dBFS), while its median and quiet tail are much lower. It would be misleading to turn up the whole mix without first removing the scene-head gaps. `MOTION_PACING_PLAN.md` reports 12 pauses ≥350 ms totaling 5.1 s in OURS, versus 1.1–3.3 s over the longer reference reels. The existing scene timing files and the plan locate leading silence at 0.60–1.66 s per synthesized scene. See `video-engine/assets/generated/cs-b9d30fa7964c0cf0/scene-*.timing.json` and plan §2/§4.

The ASR transcripts and pacing plan indicate reference speech at 175–221 words/min; OURS is roughly 192 words/min only after the 1.8× final speed pass, while its authored F5 output is about 105–115 words/min. This is a timing comparison, not proof that faster synthesis will sound good. In the audited transcript, the first spoken `Why` starts at 0.00 s, followed by long early word durations (e.g. `Why` 0.00–0.64 s), and the synthesized scene audio begins with silence; ASR boundaries therefore should not be treated as ground-truth phoneme onsets. `OURS.transcript.txt` also decodes `O(1)` / `O(N)` inconsistently as `O1`, `ON`, `OSN`; it is a flag for a listening check, not proof of the exact pronunciation.

The F0 method here is a reproducible screening measure: 40 ms Hann-window autocorrelation, sampled every 40 ms within ASR word spans in the first 25 s, candidate 80–400 Hz, accepting a peak only at correlation ≥0.6 and level above −32 dBFS. Accepted frames: R1 137, R2 180, R3 191, R4 185, R5 219, OURS 76. The smaller OURS sample and mixed-reference audio limit comparisons. Need a human listen to compare emphasis on questions, transitions, technical terms, phrase endings, and whether 1.8× is intelligible. No verified perceptual verdict is claimed here.

## Sound mix: what is evidenced and what is open

The exact checked-in composition `video-engine/generated/cs-b9d30fa7964c0cf0.html` contains ten `assets/generated/.../scene-N.wav` narration tags on track 0; nine `assets/sfx/whoosh.wav` scene-boundary tags on track 2; and 16 animation cues on track 3: `pop.mp3` ×4, `click-soft.mp3` ×3, `ping.mp3` ×3, `chime.mp3` ×3, `sparkle.mp3` ×3. These are 25 *scheduled* cues; the exact audible prominence of each in the rendered mix has not been established. The composition has no music/ambient-audio tag, and `composeHtml.js` contains the cue scheduler. The existing transient detector misses most of those known cues (the plan reports only about nine of 25 at its high threshold), so using it to count reference cues would be unsound.

The reference full mixes retain nonzero sound between words, and the earlier spectrum analysis in the plan found tonal gaps. Possibilities include music, room tone, reverberation, encoding noise, or a combination. The five original reference MP4s are not present in this workspace; the available assets are 16 kHz mono extracts, prior ffprobe JSON, frame contact sheets, and visual logs. No isolated reference stems or source projects exist here. The local TTS environment has `torch`/`librosa` but no installed `demucs`, `spleeter`, or `asteroid`; source separation would also be an estimate, not proof. This audit could not listen through a tool or verify by separation, so **reference music bed, SFX density, and their mix hierarchy remain unresolved**. A 20–30 s audition of R2 and R4, including speech gaps and a few diagram reveals, is the cheapest decision gate before setting cue/bed targets. If stems or original edits become available, inspect those instead.

For the next mix test, check narration intelligibility at the final playback speed, cue loudness relative to speech at boundary and in-scene placements, abrupt floor changes at each scene head, true peak/clipping, and whether any proposed ambience masks consonants. The source contains no per-cue gain/ducking/normalization setting in `composeHtml.js`; do not equate the presence of tracks with a balanced mix.

## Asset and provenance inventory

| Category | Current repo evidence | Status for reuse |
|---|---|---|
| Persistent mascot | `video-engine/assets/mascot/spongebob.svg`, 438,296 bytes, is an SVG wrapper around embedded PNG data; `composeHtml.js:206` mounts it. `PLAN.md:14` calls it user supplied. | Source/permission record absent. It depicts a recognizable existing cartoon character according to the current plan and file name. Commission/create an original mascot or document authorization before publication. User supplied does not itself establish rights. |
| SFX | `video-engine/assets/sfx/whoosh.wav` and five MP3s listed above. `PLAN.md:196–197` describes the whoosh as synthesized once with ffmpeg; `VIDEO_AESTHETIC_PLAN.md:132–139` says the other cues were copied into the asset folder. | Preserve the generated whoosh recipe/source. Record source URL, creator, license terms, download date, and attribution requirement for each MP3; currently absent from repo search. |
| Generic icons/diagrams | Component HTML draws labels, shapes, and SVG-style glyphs; e.g. `node-graph-diagram.html:70` supports `doc|db|cube|none`. No separate icon pack or logo files appear in `video-engine/assets`. | Repo-authored implementation is reusable as code subject to normal dependency review; do not infer independent icon provenance solely from being in code. `none` can visibly yield a placeholder (noted in `VIDEO_AESTHETIC_PLAN.md`). |
| Reference marks and characters | Visual logs show Cloudflare/AWS Shield tiles in R1 around 121.25/122.25 s; a Git logo and Rick-style mascot in R3; `VIDEO_AESTHETIC_PLAN.md:583` notes an Amazon S3 logo in R4. | Reference observations only. No logo or character artwork from these reels is in the current asset directory. Any deliberate use in a new production needs source/provenance and a purpose-specific review; a lookalike mascot should not be treated as owned artwork. |
| Music/ambience | No music file in the current composition or `video-engine/assets` media inventory. | Requirement undecided pending listening to references and choosing an original/licensed bed if desired. |
| Fonts | Composition CSS specifies Inter with system fallback (`composeHtml.js:129` and `:723`); no font file appeared in the media inventory. | Verify which font actually renders and document its distribution source if bundling it later. |

This is an inventory, not a legal conclusion. References show useful *design roles* (brand mark to identify a service, persistent narrator character, small device icons), but copying their recognizable assets is unnecessary to reproduce pacing or explanation quality.

## Production time and cost

`control-panel/data/runs.json` records the audited job `cs-b9d30fa7964c0cf0` starting **2026-09-19 15:47:36.257Z** and ending **16:00:23.317Z**, a wall-clock interval of **767.060 s (12 min 47.060 s)**. It succeeded with ten scenes and a 3,531,050-byte output. The local `ffprobe` metadata records final duration **70.233 s**. Its requested length was 45 s; the authored duration is about 126.3 s per the plan, then the pipeline applies 1.8× speed. The control-panel record has no stage breakdown or billing fields. The job logs are held in memory by `control-panel/lib/jobs.js:17–45`, not persisted with `runs.json`, so this specific run cannot be partitioned reliably into script, synthesis/alignment, check, render, and speed-pass time.

Other successful CS-explainer runs in the same `runs.json` range from **3.37 to 14.73 min** for 3–10 scene outputs in the newer pipeline; the two 2026-09-18 ~0.45 min entries appear to be earlier/shorter work and are not comparable. One separate orchestrator log (`orchestrator/output/run6.log`, blue-green deployment, 12 scenes and 157 s authored video) reports HyperFrames render **6 min 39.0 s**, with trace stages including capture **236.873 s**, encode **118.826 s**, and assemble **14.124 s**. That is a real measurement of a different run, not the audited job. The proposed 25–40 scenes would add TTS invocations and likely frames/complexity, while whole-narration synthesis could remove per-scene model startup; neither effect has been measured together. A linear multiple of the 12.78 min audited run would be a weak estimate, especially under GPU/CPU contention (several runs in `runs.json` overlap).

No provider invoice, token usage, GPU power draw, cloud bill, stock-license receipt, or current rate card is stored with these runs. Monetary cost is therefore **unknown**. A useful future per-video calculation is:

`cost = Σ(script input tokens × input rate + script output tokens × output rate, across attempts) + TTS/alignment compute time × effective compute rate + render/encode compute time × effective compute rate + licensed asset fees + storage/egress/publishing fees`.

For local hardware, the effective compute rate must include amortization/electricity or a measured cloud-equivalent rate; it is not automatically zero. Track attempt counts, start/end of each stage, frame count, audio duration, CPU/GPU hardware, and billed units for at least three completed target-length topics before committing to a production throughput or unit-cost promise. One representative 25–40-scene render is the minimum feasibility gate; three different topics expose variance and retry costs.

## Reproduction and limits

- Inputs: `analysis/reference-audit-20260919/audio/{ref1,ref2,ref3,ref4,ref5,ours}/audio.16k.mono.wav`; adjacent `source.ffprobe.json`; `analysis/pacing-audit-20260924/evidence/{R1_*,R2_*,R3_*,R4_*,R5_*,OURS}.asr.json`, transcript and visual-log files; `control-panel/data/runs.json`; current generated composition HTML. The extracted WAVs are mono/downsampled from AAC stereo sources, so spatial mix and fine high-frequency cues are unavailable.
- Level calculation: Python `wave`/NumPy read int16 PCM, split into nonoverlapping 320-sample windows at 16 kHz, `20*log10(sqrt(mean(x*x))+1e-10)`, report p10/p50/p90 and fraction below −60 dBFS. No gain normalization was applied. These are waveform levels, not LUFS or a subjective loudness score.
- Pitch calculation: the autocorrelation method and acceptance threshold are specified above. Word spans came from existing Whisper ASR, which can misalign and mis-transcribe. Results describe the extracted mixes, not isolated speakers.
- Exact read-only PowerShell/Python command used for the level table (run from repository root; this prints duration, p10/p50/p90, and percentage below −60 dBFS in the order R1–R5/OURS):

  ```powershell
  $code = @'
  import wave, pathlib, numpy as np
  root=pathlib.Path('analysis/reference-audit-20260919/audio')
  for key in ('ref1','ref2','ref3','ref4','ref5','ours'):
      with wave.open(str(root/key/'audio.16k.mono.wav'),'rb') as f:
          y=np.frombuffer(f.readframes(f.getnframes()),dtype='<i2').astype('float32')/32768
          sr=f.getframerate()
      n=len(y)//320
      q=y[:n*320].reshape(n,320)
      db=20*np.log10(np.sqrt(np.mean(q*q,axis=1))+1e-10)
      print(key,round(len(y)/sr,1),np.round(np.percentile(db,[10,50,90]),1).tolist(),round(float(np.mean(db < -60))*100,1))
  '@
  & 'C:\Repos\tts-venv\Scripts\python.exe' -c $code
  ```

- Exact pitch screening command (same root; sampled timestamp range is **0.04–25.00 s** for each file, with 40 ms steps):

  ```powershell
  $code = @'
  import wave, json, pathlib, numpy as np
  root=pathlib.Path('analysis/reference-audit-20260919/audio')
  ev=pathlib.Path('analysis/pacing-audit-20260924/evidence')
  pairs=[('ref1','R1_DdEedoQM6j3'),('ref2','R2_DdG-RuwsDRc'),('ref3','R3_DdSc-I9IqNC'),('ref4','R4_DdT5wzdsQWV'),('ref5','R5_DdIM0QoiZre'),('ours','OURS')]
  for key,tag in pairs:
      with wave.open(str(root/key/'audio.16k.mono.wav'),'rb') as f:
          y=np.frombuffer(f.readframes(f.getnframes()),dtype='<i2').astype('float32')/32768
          sr=f.getframerate()
      seg=json.loads((ev/(tag+'.asr.json')).read_text(encoding='utf8'))
      spans=[(w['s'],w['e']) for s in seg for w in s.get('words',[]) if 's' in w and 'e' in w]
      pitches=[]
      n=640
      for t in np.arange(0.04,min(25,len(y)/sr)-0.04,0.04):
          if not any(a+0.04<t<b-0.04 for a,b in spans): continue
          x=y[int(t*sr)-n//2:int(t*sr)+n//2]
          if len(x)!=n or 20*np.log10(np.sqrt(np.mean(x*x))+1e-10)<-32: continue
          x=(x-x.mean())*np.hanning(n)
          ac=np.correlate(x,x,mode='full')[n-1:]
          lag=40+np.argmax(ac[40:200])
          if ac[lag]/(ac[0]+1e-10)>=0.6: pitches.append(sr/lag)
      print(key,np.round(np.percentile(pitches,[10,50,90]),1).tolist(),len(pitches))
  '@
  & 'C:\Repos\tts-venv\Scripts\python.exe' -c $code
  ```

- Composition inventory: PowerShell `[regex]::Matches($html,'<audio[\s\S]*?src="([^"]+)"')` grouped by source on `video-engine/generated/cs-b9d30fa7964c0cf0.html`; source-code cross-check in `orchestrator/lib/video/composeHtml.js:278–376,616–636`.
- Timing: `([datetime]endedAt-[datetime]startedAt).TotalSeconds` on the exact `runs.json` job; `source.ffprobe.json` for media duration. Compare other jobs only as observed history, not as a predictive model.
- Visual asset observations are from prior frame contact sheets/visual logs, not a fresh viewing of the original reference MP4s. The local source videos and any editing projects are unavailable here. No listening was possible through the available audit tools. This prevents a confident claim about reference music, audible SFX count, vocal quality, or the subjective success of 1.8×.
