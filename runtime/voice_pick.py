"""Stage B: score every take of every paragraph chunk, keep the best, align it, cut it back into script lines.

C:/Repos/tts-venv/Scripts/python.exe runtime/voice_pick.py <chunks.json>
chunks.json = [{"id", "dir", "say", "lines": [{"text", "wav", "json"}]}]
Score per take = prosody.score (distance to the user's reference reels: level sentence ends, no high restarts, 4–8 st
range, breaths at commas, loudness variation) + 20 x Whisper WER (intelligibility first). The winner is force-aligned
(WhisperX) on the say-text, cut at the middle of each between-line pause, and written per line as wav + timing json
[{word,start,end}] with DISPLAY words (say-tokens merged back), plus <json>.take.json with the scores.
"""
import glob, json, os, sys
import numpy as np, soundfile as sf, librosa

HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import torch
os.add_dll_directory(os.path.join(os.path.dirname(torch.__file__), "lib"))
import whisperx
from faster_whisper import WhisperModel
from asrscore import wer
from saytext import to_say
import prosody

dev = "cuda" if torch.cuda.is_available() else "cpu"
asr = WhisperModel("large-v3", device=dev, compute_type="int8_float16")
aligner, meta = whisperx.load_align_model(language_code="en", device=dev)
summary = []
for c in json.load(open(sys.argv[1], encoding="utf8")):
    display = " ".join(l["text"] for l in c["lines"])
    best = None
    for p in sorted(glob.glob(os.path.join(c["dir"], f"{c['id']}_t*.wav"))):
        y, _ = librosa.load(p, sr=16000, mono=True)
        segs, _ = asr.transcribe(y, language="en", word_timestamps=True, beam_size=5, condition_on_previous_text=False); segs = list(segs)
        words = [{"w": w.word.strip(), "s": w.start, "e": w.end} for s in segs for w in s.words]
        heard = " ".join(s.text.strip() for s in segs)
        e = wer(display, heard); pen, why = prosody.score(prosody.analyze(y, words)) if words else (99, ["no words"])
        total = pen + 20 * e
        print(f"  {os.path.basename(p)} wer {e:.2f} prosody {pen:.2f} total {total:.2f} | {'; '.join(why)}", file=sys.stderr, flush=True)
        if best is None or total < best[0]:
            best = (total, p, e, pen, heard)
    total, p, e, pen, heard = best
    x, sr = sf.read(p); x = x if x.ndim == 1 else x.mean(1)
    a16 = whisperx.load_audio(p)
    al = whisperx.align([{"text": c["say"], "start": 0.0, "end": len(a16) / 16000}], aligner, meta, a16, dev,
                        return_char_alignments=False)
    toks = [w for s in al["segments"] for w in s.get("words", [])]
    # display words per line, with their say-token groups -> merged timings
    i, per_line = 0, []
    for ln in c["lines"]:
        words, groups, _ = to_say(ln["text"]); out = []
        for w, g in zip(words, groups):
            ch = [t for t in toks[i:i + len(g)] if t.get("start") is not None and t.get("end") is not None]; i += len(g)
            if ch:
                out.append({"word": w, "start": ch[0]["start"], "end": ch[-1]["end"]})
            else:
                prev = out[-1]["end"] if out else (per_line[-1][-1]["end"] if per_line else 0.0)
                out.append({"word": w, "start": prev, "end": prev + 0.05})
        per_line.append(out)
    # cut at the middle of each between-line pause
    cuts = [0.0] + [(per_line[k][-1]["end"] + per_line[k + 1][0]["start"]) / 2 for k in range(len(per_line) - 1)] + [len(x) / sr]
    for k, (ln, W) in enumerate(zip(c["lines"], per_line)):
        a0, a1 = cuts[k], cuts[k + 1]
        sf.write(ln["wav"], x[int(a0 * sr):int(a1 * sr)], sr)
        json.dump([{"word": w["word"], "start": round(w["start"] - a0, 3), "end": round(w["end"] - a0, 3)} for w in W],
                  open(ln["json"], "w"), indent=1)
        json.dump({"chunk": c["id"], "take": os.path.basename(p), "chunk_wer": round(e, 3), "prosody": round(pen, 2),
                   "heard": heard}, open(ln["json"] + ".take.json", "w"))
    summary.append({"chunk": c["id"], "wer": round(e, 3), "prosody": round(pen, 2)})
    print(f"pick {c['id']} {os.path.basename(p)} wer {e:.2f} prosody {pen:.2f} | {display[:60]}", flush=True)
print("mean wer", round(float(np.mean([s["wer"] for s in summary])), 3), "mean prosody", round(float(np.mean([s["prosody"] for s in summary])), 2))
