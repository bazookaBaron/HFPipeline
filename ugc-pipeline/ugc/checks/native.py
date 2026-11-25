"""Compile and run the two Swift helpers (macOS on-device speech, Vision). Rebuilt only when the source changes."""
from __future__ import annotations
import hashlib
import json
import shutil
import subprocess
from pathlib import Path

from ugc.contract import ROOT

SRC = Path(__file__).parent / "swift"
BUILD = ROOT / "build"


def binary(name: str) -> Path:
    src = SRC / f"{name}.swift"
    out = BUILD / name
    stamp = BUILD / f"{name}.sha"
    digest = hashlib.sha256(src.read_bytes()).hexdigest()
    if out.exists() and stamp.exists() and stamp.read_text() == digest:
        return out
    if not shutil.which("swiftc"):
        raise RuntimeError("swiftc not found. Install the Xcode Command Line Tools: xcode-select --install")
    BUILD.mkdir(exist_ok=True)
    r = subprocess.run(["swiftc", "-parse-as-library", "-O", str(src), "-o", str(out)], capture_output=True, text=True)
    if r.returncode:
        raise RuntimeError(f"swiftc failed for {src.name}:\n{r.stderr[-1500:]}")
    stamp.write_text(digest)
    return out


def run(name: str, *args: str, timeout: float = 300) -> dict:
    p = subprocess.run([str(binary(name)), *args], capture_output=True, text=True, timeout=timeout)
    try:
        out = json.loads(p.stdout.strip().splitlines()[-1])
    except (IndexError, json.JSONDecodeError):
        raise RuntimeError(f"{name} helper gave no JSON (exit {p.returncode}): {(p.stderr or p.stdout)[-500:]}") from None
    if "error" in out:
        raise RuntimeError(out["error"])
    return out


def transcribe(wav: Path, locale: str, hints: tuple[str, ...] = ()) -> dict:
    """hints: contextual strings (brand and respellings) that bias the recogniser; never the whole script."""
    return run("speech", str(wav), locale, *hints)


def faces(sheet: Path | None, frames: list[Path]) -> dict:
    return run("face", str(sheet) if sheet else "-", *map(str, frames))
