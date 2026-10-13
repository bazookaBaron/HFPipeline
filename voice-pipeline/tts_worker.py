"""Persistent JSON-lines F5-TTS + WhisperX worker.

Protocol: one JSON request per stdin line; one JSON response per stdout line.
Only protocol responses go to stdout. Models are lazy-loaded once per process.
"""

from __future__ import annotations

import json
import math
import os
import faulthandler
import re
import sys
import tempfile
import threading
import types
from contextlib import redirect_stdout
from pathlib import Path

# Numba/librosa compile caches must live in a writable directory. The shared
# TTS virtualenv can be read-only under the app sandbox; tempfile otherwise
# retries denied writes under site-packages thousands of times on Windows.
_numba_cache = Path(__file__).resolve().parent / ".cache" / "numba"
_numba_cache.mkdir(parents=True, exist_ok=True)
os.environ.setdefault("NUMBA_CACHE_DIR", str(_numba_cache))

from synthesize import (
    DEFAULT_REF_TEXT,
    get_default_ref_audio,
    probe_duration_seconds,
    trim_reference_clip,
    words_to_timing_json,
)


def _normalize_word(value: str) -> str:
    return re.sub(r"[^\w]", "", value, flags=re.UNICODE).casefold()


def _sentence_indices(tokens: list[str]) -> list[int]:
    result = []
    sentence = 0
    for token in tokens:
        result.append(sentence)
        if re.search(r"[.!?][\"')\]]*$", token):
            sentence += 1
    return result


def map_aligned_words(gen_text: str, aligned: list[dict]) -> list[dict]:
    """Map aligned words to stable whitespace-token IDs, or fail explicitly.

    WhisperX may split punctuation and compounds differently. We group adjacent
    aligned pieces until their normalized text equals the requested token.
    Missing/ambiguous timings are never fabricated.
    """
    tokens = gen_text.split()
    sentence_ids = _sentence_indices(tokens)
    useful = [w for w in aligned if _normalize_word(str(w.get("word", "")))]
    result = []
    cursor = 0
    for index, token in enumerate(tokens):
        expected = _normalize_word(token)
        if not expected:
            raise ValueError(f"Text token {index} has no alignable characters: {token!r}")
        pieces = []
        built = ""
        while cursor < len(useful) and len(built) < len(expected):
            part = useful[cursor]
            pieces.append(part)
            built += _normalize_word(str(part["word"]))
            cursor += 1
            if not expected.startswith(built):
                raise ValueError(f"Alignment diverged at token {index}: expected {token!r}, got {built!r}")
        if built != expected:
            raise ValueError(f"Alignment missing token {index}: {token!r}")
        start, end = pieces[0].get("start"), pieces[-1].get("end")
        if start is None or end is None or not (math.isfinite(start) and math.isfinite(end) and end > start):
            raise ValueError(f"Missing/invalid aligned time for token {index}: {token!r}")
        if result and start < result[-1]["e"] - 0.015:
            raise ValueError(f"Non-monotonic aligned time at token {index}: {token!r}")
        result.append({"i": index, "w": token, "s": float(start), "e": float(end), "sentenceIndex": sentence_ids[index]})
    if cursor != len(useful):
        raise ValueError(f"Alignment has {len(useful) - cursor} extra words")
    return result


def trim_bounds(duration: float, words: list[dict]) -> tuple[float, float]:
    if not words:
        raise ValueError("Cannot trim audio without aligned words")
    start = max(0.0, words[0]["s"] - 0.06)
    end = min(duration, words[-1]["e"] + 0.10)
    if end <= start or words[0]["s"] < start or words[-1]["e"] > end:
        raise ValueError("Trim would cut an aligned word")
    return start, end


def trim_wav(path: Path, words: list[dict]) -> tuple[float, float, float]:
    """Sample-exact trim with 5 ms edge fades; return actual lead/tail/length."""
    import numpy as np
    import soundfile as sf

    info = sf.info(str(path))
    audio, sample_rate = sf.read(str(path), always_2d=True)
    duration = len(audio) / sample_rate
    start, end = trim_bounds(duration, words)
    first = max(0, math.floor(start * sample_rate))
    last = min(len(audio), math.ceil(end * sample_rate))
    segment = audio[first:last].copy()
    if not len(segment):
        raise ValueError("Trim produced empty audio")
    fade_samples = min(int(round(0.005 * sample_rate)), len(segment) // 2)
    if fade_samples:
        ramp = np.linspace(0.0, 1.0, fade_samples, endpoint=True)
        segment[:fade_samples] *= ramp[:, None]
        segment[-fade_samples:] *= ramp[::-1, None]
    with tempfile.NamedTemporaryFile(prefix="tts_trim_", suffix=".wav", dir=path.parent, delete=False) as temp:
        temp_path = Path(temp.name)
    try:
        sf.write(str(temp_path), segment, sample_rate, subtype=info.subtype)
        temp_path.replace(path)
    finally:
        temp_path.unlink(missing_ok=True)
    return first / sample_rate, (len(audio) - last) / sample_rate, len(segment) / sample_rate


class VoiceWorker:
    def __init__(self):
        self.f5 = None
        self.aligner = None
        self.align_metadata = None
        self.device = None

    def _load(self):
        if self.f5 is not None and self.aligner is not None:
            return
        print("[tts_worker] importing torch", file=sys.stderr, flush=True)
        import torch
        print("[tts_worker] importing whisperx", file=sys.stderr, flush=True)
        import whisperx
        print("[tts_worker] importing F5TTS", file=sys.stderr, flush=True)
        faulthandler.dump_traceback_later(30, repeat=False, file=sys.stderr)
        # F5 imports transformers.pipeline at module load even when the caller
        # supplies an exact reference transcript. On this installation that
        # optional ASR import scans hundreds of model modules and stalls for
        # minutes. The worker always supplies reference text, so keep the
        # unused pipeline unavailable while loading F5, then restore imports.
        had_transformers = "transformers" in sys.modules
        if not had_transformers:
            optional_asr = types.ModuleType("transformers")
            def unavailable_pipeline(*args, **kwargs):
                raise RuntimeError("F5 reference ASR is disabled; supply refText")
            optional_asr.pipeline = unavailable_pipeline
            sys.modules["transformers"] = optional_asr
        try:
            from f5_tts.api import F5TTS
        finally:
            if not had_transformers:
                sys.modules.pop("transformers", None)
            faulthandler.cancel_dump_traceback_later()

        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        print(f"[tts_worker] loading models (device={self.device})", file=sys.stderr, flush=True)
        if self.f5 is None:
            self.f5 = F5TTS()
        if self.aligner is None:
            self.aligner, self.align_metadata = whisperx.load_align_model(language_code="en", device=self.device)

    def synthesize(self, request: dict) -> dict:
        text = str(request.get("genText") or "").strip()
        if not text:
            raise ValueError("genText must be non-empty")
        out_audio = Path(request["outAudio"]).resolve()
        out_timing = Path(request["outTiming"]).resolve()
        speed = float(request.get("speed", 1.0))
        if not math.isfinite(speed) or speed <= 0:
            raise ValueError("speed must be positive and finite")
        ref_audio = request.get("refAudio")
        ref_text = request.get("refText")
        if bool(ref_audio) != bool(ref_text):
            raise ValueError("refAudio and refText must be provided together")
        source = Path(ref_audio).resolve() if ref_audio else get_default_ref_audio()
        if not source.is_file():
            raise FileNotFoundError(source)
        ref_text = ref_text if ref_text else DEFAULT_REF_TEXT
        out_audio.parent.mkdir(parents=True, exist_ok=True)
        out_timing.parent.mkdir(parents=True, exist_ok=True)
        self._load()
        import whisperx
        with tempfile.TemporaryDirectory(prefix="voice_worker_") as directory:
            trimmed_ref = trim_reference_clip(source, Path(directory))
            self.f5.infer(ref_file=str(trimmed_ref), ref_text=ref_text, gen_text=text,
                          file_wave=str(out_audio), speed=speed, seed=int(request.get("seed", -1)))
        if not out_audio.is_file():
            raise RuntimeError("F5-TTS did not create the output audio")
        duration = probe_duration_seconds(out_audio)
        audio = whisperx.load_audio(str(out_audio))
        aligned = whisperx.align([{"text": text, "start": 0.0, "end": duration}],
                                 self.aligner, self.align_metadata, audio, self.device,
                                 return_char_alignments=False)
        raw_words = [word for seg in aligned["segments"] for word in seg.get("words", [])]
        if not raw_words:
            raise RuntimeError("WhisperX produced no aligned words")
        indexed = map_aligned_words(text, raw_words)
        lead = tail = 0.0
        if request.get("trim"):
            lead, tail, duration = trim_wav(out_audio, indexed)
            for item in indexed:
                item["s"] = round(item["s"] - lead, 6)
                item["e"] = round(item["e"] - lead, 6)
            for item in raw_words:
                if item.get("start") is not None:
                    item["start"] = round(item["start"] - lead, 6)
                if item.get("end") is not None:
                    item["end"] = round(item["end"] - lead, 6)
        timing = words_to_timing_json(raw_words)
        out_timing.write_text(json.dumps(timing, indent=2), encoding="utf-8")
        return {"audioPath": str(out_audio), "timingPath": str(out_timing),
                "wordCount": len(timing), "durationSeconds": round(duration, 3),
                "leadTrimSeconds": round(lead, 6), "tailTrimSeconds": round(tail, 6),
                "words": indexed}


def main():
    print(f"[tts_worker] pid={os.getpid()}", file=sys.stderr, flush=True)
    worker = VoiceWorker()
    for line in sys.stdin:
        if not line.strip():
            continue
        request_id = None
        try:
            request = json.loads(line)
            request_id = request.get("id")
            if request.get("op") == "shutdown":
                print(json.dumps({"id": request_id, "ok": True, "result": {"shutdown": True}}), flush=True)
                return
            if request.get("op") != "synthesize":
                raise ValueError("Unsupported op")
            watchdog_ms = request.get("watchdogMs", 175000)
            if not isinstance(watchdog_ms, (int, float)) or not 100 <= watchdog_ms <= 600000:
                raise ValueError("watchdogMs must be between 100 and 600000")
            def watchdog_expired():
                print(f"[tts_worker] synthesis watchdog expired after {watchdog_ms}ms", file=sys.stderr, flush=True)
                os._exit(124)
            watchdog = threading.Timer(watchdog_ms / 1000, watchdog_expired)
            watchdog.daemon = True
            watchdog.start()
            # F5-TTS and its dependencies print progress to stdout. Keep the
            # JSON-lines protocol clean by redirecting model chatter to stderr.
            try:
                with redirect_stdout(sys.stderr):
                    result = worker.synthesize(request)
            finally:
                watchdog.cancel()
            response = {"id": request_id, "ok": True, "result": result}
        except Exception as error:
            print(f"[tts_worker] {type(error).__name__}: {error}", file=sys.stderr, flush=True)
            response = {"id": request_id, "ok": False, "error": f"{type(error).__name__}: {error}"}
        print(json.dumps(response), flush=True)


if __name__ == "__main__":
    main()
