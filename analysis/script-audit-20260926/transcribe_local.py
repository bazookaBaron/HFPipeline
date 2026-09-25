"""Offline word-timestamp transcription of four user-supplied references.

Uses an already cached faster-whisper model. No cloud calls, downloads,
frames, or edits to source videos. R4 is byte-identical to the existing audit.
"""
import json
import sys
from pathlib import Path

from faster_whisper import WhisperModel

VIDEOS = {
    "V1": Path(r"C:\Users\debna\Downloads\AQPkRKCDspuOdXQ1rbVzQeATb05U1Z7pdcL8wZtcNCYGdTT41JkWaZf_99cRZahIKr4-k5HhzSsechdY9N9Ysm2bm-d-4QJH67o3IaQ.mp4"),
    "V3": Path(r"C:\Users\debna\Downloads\igexport-DdZAerYMAYa.mp4"),
    "V4": Path(r"C:\Users\debna\Downloads\igexport-Ddb-aswiHnN.mp4"),
    "V5": Path(r"C:\Users\debna\Downloads\igexport-DdWh84AqRWr.mp4"),
}


def main():
    names = sys.argv[1:] or list(VIDEOS)
    for name in names:
        if name not in VIDEOS or not VIDEOS[name].is_file():
            raise SystemExit(f"Missing or unknown input: {name}")
    model = WhisperModel("small", device="cpu", compute_type="int8", local_files_only=True)
    dest = Path(__file__).resolve().parent
    for name in names:
        segments, info = model.transcribe(
            str(VIDEOS[name]), language="en", word_timestamps=True,
            vad_filter=False, beam_size=5, condition_on_previous_text=False,
        )
        rows = []
        for segment in segments:
            rows.append({
                "start": round(segment.start, 3), "end": round(segment.end, 3),
                "text": segment.text.strip(),
                "words": [{"text": w.word.strip(), "start": round(w.start, 3), "end": round(w.end, 3)}
                          for w in (segment.words or [])],
            })
        output = dest / f"{name}.asr.json"
        output.write_text(json.dumps({"source": str(VIDEOS[name]), "model": "small-cpu-int8",
                                      "language": info.language, "segments": rows}, indent=2), encoding="utf-8")
        print(f"{name}: {len(rows)} segments -> {output}", flush=True)


if __name__ == "__main__":
    main()
