"""ASR self-check for one-take voice A/B files (run with .venvs/whisper python, through jobq).
usage: voice_ab_eval.py <script.txt> <a.wav> [<b.wav> ...]  -> prints + writes <wav>.asr.json
Reports WER (asrscore.norm/wer), duration, words/sec, and long repeated / skipped spans from a word alignment."""
import difflib, json, os, subprocess, sys, wave
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from asrscore import norm, wer  # noqa: E402
from faster_whisper import WhisperModel  # noqa: E402

ref_txt = open(sys.argv[1], encoding="utf-8").read()
try:
    m = WhisperModel("large-v3", device="cuda", compute_type="int8_float16")
    dev = "cuda"
except Exception as e:  # no cuBLAS in this venv -> CPU
    print("[eval] cuda failed:", e); m = WhisperModel("medium", device="cpu", compute_type="int8"); dev = "cpu"
R = norm(ref_txt)


def pcm16k(wav):  # decode via ffmpeg (this venv's PyAV is incompatible with faster-whisper's decode_audio)
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", wav, "-ac", "1", "-ar", "16000", "-f", "s16le", "-"],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.int16).astype(np.float32) / 32768


for wav in sys.argv[2:]:
    try:
        segs, _ = m.transcribe(pcm16k(wav), language="en", beam_size=5, condition_on_previous_text=False, vad_filter=False)
        hyp = " ".join(s.text.strip() for s in segs)
    except RuntimeError as e:
        if dev == "cuda":
            print("[eval] cuda runtime failed, CPU fallback:", e)
            m = WhisperModel("medium", device="cpu", compute_type="int8"); dev = "cpu"
            segs, _ = m.transcribe(pcm16k(wav), language="en", beam_size=5, condition_on_previous_text=False)
            hyp = " ".join(s.text.strip() for s in segs)
        else:
            raise
    H = norm(hyp)
    with wave.open(wav) as w:
        dur = w.getnframes() / w.getframerate()
    ops = difflib.SequenceMatcher(a=R, b=H, autojunk=False).get_opcodes()
    issues = [dict(op=t, ref=" ".join(R[i1:i2]), hyp=" ".join(H[j1:j2])) for t, i1, i2, j1, j2 in ops
              if t != "equal" and max(i2 - i1, j2 - j1) >= 3]
    out = dict(wav=wav, asr_model=("large-v3" if dev == "cuda" else "medium-cpu"), wer=round(wer(ref_txt, hyp), 4),
               duration_s=round(dur, 2), ref_words=len(R), hyp_words=len(H), wps=round(len(R) / dur, 2),
               spans_ge3_words=issues, hyp=hyp)
    json.dump(out, open(wav + ".asr.json", "w", encoding="utf-8"), indent=1)
    print(json.dumps({k: v for k, v in out.items() if k != "hyp"}, ensure_ascii=False))
