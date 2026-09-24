"""Sequential F5/WhisperX benchmark; all output stays in this worktree."""
import argparse
import json
import re
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "voice-pipeline"))
from tts_worker import VoiceWorker  # noqa: E402

SOURCE = Path(r"C:\Repos\HFPipleine\video-engine\assets\generated\cs-b9d30fa7964c0cf0")
OUT = Path(__file__).resolve().parent


def scene_text(number):
    words = json.loads((SOURCE / f"scene-{number}.timing.json").read_text(encoding="utf-8"))
    return " ".join(w["word"] for w in words)


def normalized(text):
    return re.findall(r"[a-z0-9]+", text.lower())


def wer(expected, actual):
    a, b = normalized(expected), normalized(actual)
    row = list(range(len(b) + 1))
    for i, token in enumerate(a, 1):
        next_row = [i]
        for j, candidate in enumerate(b, 1):
            next_row.append(min(next_row[-1] + 1, row[j] + 1, row[j - 1] + (token != candidate)))
        row = next_row
    return row[-1] / max(1, len(a))


def local_asr():
    from faster_whisper import WhisperModel
    cache = Path(r"C:\Users\debna\.cache\huggingface\hub\models--Systran--faster-whisper-base.en\snapshots")
    candidates = sorted(cache.glob("*"))
    return WhisperModel(str(candidates[-1]), device="cpu", compute_type="int8") if candidates else None


def run(mode):
    source_sentences = re.split(r"(?<=[.!?])\s+", " ".join(scene_text(n) for n in range(1, 11)))
    if mode == "smoke":
        cases = [("smoke", "A hash collision slows lookup.", 1.0)]
    else:
        chunks = [(f"chunk-{n}", " ".join(source_sentences[:n]), 1.0) for n in (1, 3, 8)]
        ab = [(f"scene-{n}-speed-{speed}", scene_text(n), speed)
              for n in (1, 4, 8) for speed in (1.0, 1.2, 1.4, 1.6)]
        cases = chunks if mode == "chunks" else ab if mode == "ab" else chunks + ab
    model = local_asr()
    worker = VoiceWorker()
    rows = []
    for name, text, speed in cases:
        wav, timing = OUT / f"{name}.wav", OUT / f"{name}.json"
        start = time.perf_counter()
        try:
            result = worker.synthesize({"genText": text, "outAudio": str(wav),
                                        "outTiming": str(timing), "speed": speed, "trim": True})
            seconds = time.perf_counter() - start
            raw_wpm = len(result["words"]) * 60 / result["durationSeconds"]
            gaps = [max(0.0, right["s"] - left["e"])
                    for left, right in zip(result["words"], result["words"][1:])
                    if right["sentenceIndex"] != left["sentenceIndex"]]
            post = min(2.0, max(1.0, 200 / raw_wpm))
            final = OUT / f"{name}-post.wav"
            subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", str(wav),
                            "-af", f"atempo={post:.6f}", str(final)], check=True)
            spoken = None
            if model:
                segments, _ = model.transcribe(str(final), language="en", vad_filter=False)
                spoken = " ".join(s.text.strip() for s in segments)
            row = {"case": name, "speed": speed, "cold": not rows,
                   "elapsedSeconds": round(seconds, 2), "durationSeconds": result["durationSeconds"],
                   "realTimeFactor": round(seconds / result["durationSeconds"], 2),
                   "leadTrimSeconds": result["leadTrimSeconds"],
                   "tailTrimSeconds": result["tailTrimSeconds"],
                   "wordCount": len(result["words"]), "rawWpm": round(raw_wpm, 1),
                   "interSentenceGaps": [round(gap, 3) for gap in gaps],
                   "postSpeed": round(post, 3), "finalWpmEstimated": round(raw_wpm * post, 1),
                   "asrText": spoken, "wer": round(wer(text, spoken), 3) if spoken else None,
                   "audio": str(wav), "postAudio": str(final), "text": text}
        except Exception as error:
            row = {"case": name, "speed": speed, "text": text,
                   "elapsedSeconds": round(time.perf_counter() - start, 2),
                   "error": f"{type(error).__name__}: {error}"}
        rows.append(row)
        print(json.dumps(row), flush=True)
        (OUT / f"{mode}-results.json").write_text(json.dumps(rows, indent=2), encoding="utf-8")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("mode", choices=("smoke", "chunks", "ab", "all"))
    run(parser.parse_args().mode)
