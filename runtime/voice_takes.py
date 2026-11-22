"""Best-of-N narrator synthesis with an ASR intelligibility check (replaces voice_synth.js for voice.py).

C:/Repos/tts-venv/Scripts/python.exe runtime/voice_takes.py <jobs.json> [--speed 0.85] [--takes 3] [--nfe 32]
jobs.json = [{text, wav, json}] (same contract as voice_synth.js). Per line:
  1. say-text: ALL-CAPS acronyms are spelled for the voice ("AWS" -> "A W S"), plus runtime/lexicon.json respellings;
     captions keep the original words (aligned say-tokens are merged back per display word).
  2. F5 speaks at `speed` natively (no ffmpeg time-stretch, which smears consonants); the reference gets a 0.5 s
     silent tail so the first/last generated words aren't swallowed.
  3. Up to N seeds; every take is transcribed with Whisper large-v3 and scored (WER vs the line); the clearest
     take wins, stopping early at WER 0. Writes wav + timing json [{word,start,end}] + <json>.take.json {wer,seed,heard}.
Why: single random-seed F5 takes garbled ~25 % of lines ("AWS" -> "a dollar", dropped endings) — voicecheck.py.
"""
import argparse, json, os, re, sys, tempfile, types
from contextlib import redirect_stdout
import numpy as np, soundfile as sf

HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
VP = os.path.join(ROOT, "voice-pipeline"); sys.path.insert(0, VP); sys.path.insert(0, HERE)
ap = argparse.ArgumentParser(); ap.add_argument("jobs")
ap.add_argument("--speed", type=float, default=0.85); ap.add_argument("--takes", type=int, default=3)
ap.add_argument("--nfe", type=int, default=32); ap.add_argument("--max-wer", type=float, default=0.0)
a = ap.parse_args()
jobs = json.load(open(a.jobs, encoding="utf8"))
prof = json.load(open(os.path.join(VP, "voices", "narrator", "profile.json")))
REF = os.path.join(VP, "voices", "narrator", prof["reference_audio"]); REF_TEXT = prof["reference_text"]
LEX_PATH = os.path.join(HERE, "lexicon.json")
LEX = json.load(open(LEX_PATH, encoding="utf8")) if os.path.exists(LEX_PATH) else {}
KEEP = {"I", "OK", "A"}  # all-caps words that are read as words, not letters


def say_tokens(word):
    """Spoken tokens for one display word (punctuation stays on the last token)."""
    m = re.match(r"^([^A-Za-z0-9]*)([A-Za-z0-9'.-]*?)([^A-Za-z0-9]*)$", word)
    pre, core, post = m.groups() if m else ("", word, "")
    key = core.rstrip("'s") if core.endswith("'s") else core
    poss = core[len(key):]
    if key in LEX:
        toks = LEX[key].split()
    elif key.isupper() and 2 <= len(key) <= 5 and key.isalpha() and key not in KEEP:
        toks = list(key)
    else:
        return [word]
    toks[0] = pre + toks[0]; toks[-1] = toks[-1] + poss + post
    return toks


def to_say(text):
    words = text.split(); groups = [say_tokens(w) for w in words]
    return words, groups, " ".join(t for g in groups for t in g)


from asrscore import norm, wer  # noqa: E402


# ---- models (F5 loaded the same way as tts_worker, incl. its transformers stub) ----
import torch
os.add_dll_directory(os.path.join(os.path.dirname(torch.__file__), "lib"))
from tts_worker import VoiceWorker, map_aligned_words  # noqa: E402
from synthesize import words_to_timing_json  # noqa: E402
W = VoiceWorker()
with redirect_stdout(sys.stderr):
    W._load()
import whisperx  # noqa: E402
from faster_whisper import WhisperModel  # noqa: E402
asr = WhisperModel("large-v3", device="cuda", compute_type="int8_float16")


def heard(path):
    segs, _ = asr.transcribe(path, language="en", beam_size=5, condition_on_previous_text=False)
    return " ".join(s.text.strip() for s in segs)


tmp = tempfile.mkdtemp(prefix="vtakes_")
x, sr = sf.read(REF); x = x if x.ndim == 1 else x.mean(1)
ref_pad = os.path.join(tmp, "ref_pad.wav"); sf.write(ref_pad, np.concatenate([x, np.zeros(int(0.5 * sr))]), sr)

for j in jobs:
    words, groups, say = to_say(j["text"])
    best = None
    for k in range(a.takes):
        seed = 1000 + 7919 * k
        out = os.path.join(tmp, f"take{k}.wav")
        with redirect_stdout(sys.stderr):
            W.f5.infer(ref_file=ref_pad, ref_text=REF_TEXT, gen_text=say, file_wave=out, speed=a.speed,
                       nfe_step=a.nfe, seed=seed, remove_silence=False)
        h = heard(out); e = wer(j["text"], h)
        print(f"  take {k} wer {e:.2f} | {h}", file=sys.stderr, flush=True)
        if best is None or e < best[0]:
            best = (e, seed, h, out)
        if e <= a.max_wer:
            break
    e, seed, h, out = best
    os.replace(out, j["wav"])
    audio = whisperx.load_audio(j["wav"]); dur = len(audio) / 16000
    al = whisperx.align([{"text": say, "start": 0.0, "end": dur}], W.aligner, W.align_metadata, audio, W.device,
                        return_char_alignments=False)
    raw = [w for s in al["segments"] for w in s.get("words", [])]
    tim = words_to_timing_json(raw)  # one entry per say-token
    merged, i = [], 0
    for w, g in zip(words, groups):
        chunk = tim[i:i + len(g)]; i += len(g)
        ok = [c for c in chunk if c.get("start") is not None and c.get("end") is not None]
        if ok:
            merged.append({"word": w, "start": ok[0]["start"], "end": ok[-1]["end"]})
        elif merged:  # unaligned token: give it a sliver after the previous word
            merged.append({"word": w, "start": merged[-1]["end"], "end": merged[-1]["end"] + 0.05})
        else:
            merged.append({"word": w, "start": 0.0, "end": 0.05})
    json.dump(merged, open(j["json"], "w"), indent=1)
    json.dump({"wer": round(e, 3), "seed": seed, "heard": h, "say": say, "speed": a.speed}, open(j["json"] + ".take.json", "w"))
    print(f"synth wer {e:.2f} {dur:.2f}s {j['text'][:60]}", flush=True)
