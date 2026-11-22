#!/usr/bin/env python
"""
synthesize.py - Phase 4 voice pipeline: F5-TTS voice-cloned synthesis + WhisperX
forced alignment against known text, producing a WAV + word-level timing JSON.

Must be invoked with the dedicated venv's python directly (the .exe console-script
wrappers in that venv are broken):

    C:\\Repos\\tts-venv\\Scripts\\python.exe synthesize.py --gen-text "..." \\
        --out-audio out.wav --out-timing out.json \\
        [--ref-audio ref.wav --ref-text "..."] [--speed 1.0] [--seed N]

On success, prints exactly ONE final JSON line to stdout:
    {"audioPath": "...", "timingPath": "...", "wordCount": N, "durationSeconds": D}
and exits 0.

On failure, prints a human-readable error to stderr and exits non-zero. No partial
JSON summary line is printed on failure, so a Node caller can safely treat "last
stdout line parses as JSON" as the success signal.

--- Standalone trim-only mode (Phase 6 follow-up) ---

The <=12s reference-clip auto-trim used to only run as an internal side effect of the
full F5-TTS + WhisperX pipeline above, which means "trim this upload" cost a full model
load + synthesis just to check/shorten a clip. `--trim-only` exposes that same
trim_reference_clip() logic as a standalone, lightweight CLI mode that does no TTS/GPU
work at all:

    python synthesize.py --trim-only --ref-audio <in> --out-audio <trimmed-out>

On success, prints exactly ONE final JSON line to stdout:
    {"trimmed": true|false, "originalDurationSeconds": D0, "outputDurationSeconds": D1, "outputPath": "..."}
and exits 0. If the input clip is already <= 12s, it is copied as-is to --out-audio and
"trimmed" is reported as false (still exits 0 with a valid output file). On failure,
same contract as above: ERROR to stderr, non-zero exit, no JSON line.
"""

import argparse
import json
import shutil
import subprocess
import sys
import tempfile
import wave
from pathlib import Path

# Reference clip longer than this gets trimmed before being handed to F5-TTS;
# longer references are known to make F5-TTS mis-pace the generated speech.
MAX_REF_SECONDS = 12.0

DEFAULT_REF_TEXT = "Some call me nature, others call me mother nature."


def fail(message: str, code: int = 1):
    print(f"ERROR: {message}", file=sys.stderr)
    sys.exit(code)


def get_default_ref_audio() -> Path:
    from importlib.resources import files

    ref = files("f5_tts").joinpath("infer/examples/basic/basic_ref_en.wav")
    return Path(str(ref))


def ffmpeg_available() -> bool:
    return shutil.which("ffmpeg") is not None


def probe_duration_seconds(wav_path: Path) -> float:
    """Get duration of a WAV file using ffprobe if available, else the wave module."""
    ffprobe = shutil.which("ffprobe")
    if ffprobe:
        try:
            out = subprocess.run(
                [
                    ffprobe,
                    "-v",
                    "error",
                    "-show_entries",
                    "format=duration",
                    "-of",
                    "default=noprint_wrappers=1:nokey=1",
                    str(wav_path),
                ],
                capture_output=True,
                text=True,
                check=True,
            )
            return float(out.stdout.strip())
        except Exception:
            pass
    # Fallback: wave module (only handles PCM WAV, which is what we produce/consume here)
    with wave.open(str(wav_path), "rb") as wf:
        frames = wf.getnframes()
        rate = wf.getframerate()
        return frames / float(rate)


def trim_reference_clip(ref_audio: Path, work_dir: Path, max_seconds: float = MAX_REF_SECONDS) -> Path:
    """
    Trim a user-supplied reference clip to <= max_seconds using ffmpeg, if needed.
    Returns the path to use for F5-TTS (either the original, if already short enough,
    or a trimmed copy in work_dir).
    """
    if not ffmpeg_available():
        fail(
            "ffmpeg not found on PATH. ffmpeg is required to trim --ref-audio clips "
            "longer than %.0fs. Install ffmpeg and ensure it is on PATH." % max_seconds
        )

    duration = probe_duration_seconds(ref_audio)
    if duration <= max_seconds:
        return ref_audio

    trimmed_path = work_dir / f"ref_trimmed_{ref_audio.stem}.wav"
    cmd = [
        "ffmpeg",
        "-y",
        "-i",
        str(ref_audio),
        "-t",
        str(max_seconds),
        "-ac",
        "1",
        "-ar",
        "24000",
        str(trimmed_path),
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        fail(f"ffmpeg failed to trim reference clip:\n{result.stderr}")

    new_duration = probe_duration_seconds(trimmed_path)
    print(
        f"[synthesize] Reference clip was {duration:.2f}s, trimmed to {new_duration:.2f}s "
        f"({trimmed_path})",
        file=sys.stderr,
    )
    return trimmed_path


def standalone_trim(ref_audio_path: Path, out_audio_path: Path, max_seconds: float = MAX_REF_SECONDS) -> dict:
    """
    `--trim-only` entry point: the same trim decision/ffmpeg logic as trim_reference_clip()
    above, but callable on its own with no F5-TTS/WhisperX/GPU involvement, and writing
    directly to a caller-chosen --out-audio path instead of a throwaway temp dir.

    Always produces a playable file at out_audio_path on success, whether or not trimming
    was actually needed, so a caller can treat out_audio_path as "the clip to use" either way.
    """
    if not ref_audio_path.exists():
        fail(f"--ref-audio file not found: {ref_audio_path}")
    if not ffmpeg_available():
        fail(
            "ffmpeg not found on PATH. ffmpeg is required for --trim-only. "
            "Install ffmpeg and ensure it is on PATH."
        )

    original_duration = probe_duration_seconds(ref_audio_path)
    out_audio_path.parent.mkdir(parents=True, exist_ok=True)

    if original_duration <= max_seconds:
        # Already short enough -- still normalize into out_audio_path (mono/24kHz, matching
        # the trimmed-path format) via ffmpeg -c copy where possible, so callers always get a
        # real file at the requested output path regardless of which branch ran.
        cmd = ["ffmpeg", "-y", "-i", str(ref_audio_path), "-ac", "1", "-ar", "24000", str(out_audio_path)]
        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode != 0:
            fail(f"ffmpeg failed to copy/normalize reference clip:\n{result.stderr}")
        output_duration = probe_duration_seconds(out_audio_path)
        print(
            f"[synthesize] Reference clip is {original_duration:.2f}s (<= {max_seconds:.0f}s) -- no trim needed.",
            file=sys.stderr,
        )
        return {
            "trimmed": False,
            "originalDurationSeconds": round(original_duration, 3),
            "outputDurationSeconds": round(output_duration, 3),
            "outputPath": str(out_audio_path),
        }

    cmd = [
        "ffmpeg",
        "-y",
        "-i",
        str(ref_audio_path),
        "-t",
        str(max_seconds),
        "-ac",
        "1",
        "-ar",
        "24000",
        str(out_audio_path),
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        fail(f"ffmpeg failed to trim reference clip:\n{result.stderr}")

    output_duration = probe_duration_seconds(out_audio_path)
    print(
        f"[synthesize] Reference clip was {original_duration:.2f}s, trimmed to {output_duration:.2f}s "
        f"({out_audio_path})",
        file=sys.stderr,
    )
    return {
        "trimmed": True,
        "originalDurationSeconds": round(original_duration, 3),
        "outputDurationSeconds": round(output_duration, 3),
        "outputPath": str(out_audio_path),
    }


def run_f5_tts(
    ref_audio: Path,
    ref_text: str,
    gen_text: str,
    out_audio: Path,
    speed: float,
    seed: int,
):
    from f5_tts.api import F5TTS

    print("[synthesize] Loading F5-TTS model...", file=sys.stderr)
    f5 = F5TTS()  # device auto-detects cuda

    print("[synthesize] Running voice-cloned synthesis...", file=sys.stderr)
    f5.infer(
        ref_file=str(ref_audio),
        ref_text=ref_text,
        gen_text=gen_text,
        file_wave=str(out_audio),
        speed=speed,
        seed=seed,
    )

    if not out_audio.exists():
        fail(f"F5-TTS did not produce expected output file: {out_audio}")


def run_whisperx_alignment(wav_path: Path, gen_text: str):
    """
    Forced-align gen_text against the synthesized audio using WhisperX.

    IMPORTANT: whisperx.align() can SPLIT a single input segment into multiple
    segments at sentence boundaries. We MUST collect words from ALL resulting
    segments, not just segments[0], or multi-sentence transcripts get silently
    truncated to the first sentence.
    """
    import torch
    import whisperx

    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"[synthesize] Loading audio for alignment (device={device})...", file=sys.stderr)
    audio = whisperx.load_audio(str(wav_path))

    print("[synthesize] Loading WhisperX alignment model...", file=sys.stderr)
    align_model, metadata = whisperx.load_align_model(language_code="en", device=device)

    # One segment covering the whole known narration text -- we already know the
    # exact text (it's what we asked F5-TTS to synthesize), so this is forced
    # alignment, not free transcription.
    segments = [{"text": gen_text, "start": 0.0, "end": probe_duration_seconds(wav_path)}]

    print("[synthesize] Running forced alignment...", file=sys.stderr)
    result = whisperx.align(
        segments, align_model, metadata, audio, device, return_char_alignments=False
    )

    # Collect words from ALL segments -- whisperx.align() splits the single input
    # segment into multiple segments at sentence boundaries. Reading only
    # result["segments"][0]["words"] silently truncates to the first sentence.
    all_words = []
    for seg in result["segments"]:
        for w in seg.get("words", []):
            all_words.append(w)

    return all_words


def words_to_timing_json(words) -> list:
    timing = []
    for w in words:
        entry = {
            "word": w.get("word", "").strip(),
        }
        # WhisperX occasionally omits start/end for a word it couldn't align
        # confidently (e.g. leading/trailing punctuation-only tokens). Keep the
        # word but fall back gracefully rather than crashing the whole run.
        entry["start"] = w.get("start")
        entry["end"] = w.get("end")
        timing.append(entry)
    return timing


def main():
    parser = argparse.ArgumentParser(description="F5-TTS voice-clone synthesis + WhisperX forced alignment")
    parser.add_argument(
        "--trim-only",
        action="store_true",
        help="Standalone mode: trim --ref-audio to <=12s (if needed) and exit -- no TTS/GPU work.",
    )
    parser.add_argument("--gen-text", default=None, help="Text to synthesize (exact narration text). Required unless --trim-only.")
    parser.add_argument("--out-audio", required=True, help="Output WAV path (trimmed clip path, in --trim-only mode)")
    parser.add_argument("--out-timing", default=None, help="Output word-timing JSON path. Required unless --trim-only.")
    parser.add_argument("--ref-audio", default=None, help="Reference voice clip (optional in full mode; required with --trim-only)")
    parser.add_argument("--ref-text", default=None, help="Transcript of --ref-audio (required if --ref-audio is given, full mode only)")
    parser.add_argument("--speed", type=float, default=1.0, help="Speech speed multiplier (default 1.0)")
    parser.add_argument("--seed", type=int, default=-1, help="Random seed for synthesis (default -1 = random)")
    args = parser.parse_args()

    if args.trim_only:
        if not args.ref_audio:
            fail("--ref-audio is required with --trim-only")
        ref_audio_path = Path(args.ref_audio).resolve()
        out_audio_path = Path(args.out_audio).resolve()
        try:
            summary = standalone_trim(ref_audio_path, out_audio_path)
        except SystemExit:
            raise
        except Exception as e:
            fail(f"Failed while trimming reference clip: {e}")
        print(json.dumps(summary))
        sys.exit(0)
        return

    if not args.gen_text:
        fail("--gen-text is required (unless --trim-only)")
    if not args.out_timing:
        fail("--out-timing is required (unless --trim-only)")

    gen_text = args.gen_text.strip()
    if not gen_text:
        fail("--gen-text must not be empty")

    out_audio = Path(args.out_audio).resolve()
    out_timing = Path(args.out_timing).resolve()
    out_audio.parent.mkdir(parents=True, exist_ok=True)
    out_timing.parent.mkdir(parents=True, exist_ok=True)

    # Resolve reference audio/text
    if args.ref_audio:
        if not args.ref_text:
            fail("--ref-text is required when --ref-audio is provided")
        ref_audio_path = Path(args.ref_audio).resolve()
        if not ref_audio_path.exists():
            fail(f"--ref-audio file not found: {ref_audio_path}")
        ref_text = args.ref_text
    else:
        ref_audio_path = get_default_ref_audio()
        ref_text = DEFAULT_REF_TEXT
        print(f"[synthesize] Using built-in default reference voice: {ref_audio_path}", file=sys.stderr)

    with tempfile.TemporaryDirectory(prefix="voice_pipeline_") as tmp:
        tmp_dir = Path(tmp)

        # Auto-trim reference clip to <= MAX_REF_SECONDS if needed
        try:
            ref_audio_for_f5 = trim_reference_clip(ref_audio_path, tmp_dir)
        except SystemExit:
            raise
        except Exception as e:
            fail(f"Failed while trimming reference clip: {e}")

        # Synthesize
        try:
            run_f5_tts(ref_audio_for_f5, ref_text, gen_text, out_audio, args.speed, args.seed)
        except SystemExit:
            raise
        except Exception as e:
            fail(f"F5-TTS synthesis failed: {e}")

        # Forced alignment
        try:
            words = run_whisperx_alignment(out_audio, gen_text)
        except SystemExit:
            raise
        except Exception as e:
            fail(f"WhisperX forced alignment failed: {e}")

    if not words:
        fail("WhisperX alignment produced zero words -- something went wrong")

    timing = words_to_timing_json(words)

    with open(out_timing, "w", encoding="utf-8") as f:
        json.dump(timing, f, indent=2)

    duration_seconds = probe_duration_seconds(out_audio)

    summary = {
        "audioPath": str(out_audio),
        "timingPath": str(out_timing),
        "wordCount": len(timing),
        "durationSeconds": round(duration_seconds, 3),
    }
    # Single final JSON line on stdout, for a Node caller to parse.
    print(json.dumps(summary))
    sys.exit(0)


if __name__ == "__main__":
    main()
