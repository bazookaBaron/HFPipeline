"""Quality gates for generated takes.

Speech uses the macOS on-device SpeechTranscriber (Swift helper). Face uses Apple Vision.

Honesty note on the face gate: Vision finds faces (count per frame), but the identity distance is
VNGenerateImageFeaturePrintRequest, a general image-similarity feature print compared between face crops.
It is NOT face recognition. Measured on real AI faces (360p tutorial clips) against the sheet's close-up:
the same person had mean 0.73-0.77 (range 0.64-0.81, drift up to 0.66); a clearly different person in the
same outfit had mean 0.93 (range 0.92-0.97); a look-alike had mean about 0.73, so the metric cannot tell
look-alikes apart. checks.max_face_distance (0.90) only catches an obviously different person or a smeared
face; a human must confirm identity. Drift is recorded but never fails a take.

Freeze: ffmpeg freezedetect with noise tolerance -60 dB (only near-identical consecutive frames count) over
0.7 s, so a real talking head that holds still while breathing, with sensor or codec noise, is not frozen.
"""
from __future__ import annotations
import json
import tempfile
from pathlib import Path
from typing import Callable

from ugc.checks import align, media, native
from ugc.checks.wer import normalise, wer
from ugc.contract import Check, Clip, Project, Take, write_atomic

LOCALES = {"english": "en-US", "spanish": "es-ES", "french": "fr-FR", "german": "de-DE", "italian": "it-IT", "portuguese": "pt-BR", "japanese": "ja-JP"}
SCENE_CUT = 0.4          # ffmpeg scene score: talking-head frames sit near 0.01, a hard cut is far above this
MAX_FREEZE_S = 0.7
CLIP_PEAK_DB = -0.1
SILENT_LUFS = -50.0
FACE_FPS = 2.0


def _g(ok: bool, value, limit) -> dict:
    return {"pass": bool(ok), "value": value, "limit": limit}


def _find_clip(project: Project, clip: Clip | str) -> Clip:
    if isinstance(clip, Clip):
        return clip
    for r in project.reels():
        for c in r.clips:
            if c.id == clip:
                return c
    raise ValueError(f"clip {clip} is not in {project.path / 'reels.jsonl'}; run the script step first")


def _find_take(project: Project, clip_id: str, take: Take | int) -> Take | None:
    if isinstance(take, Take):
        return take
    return next((t for t in project.takes() if t.clip == clip_id and t.take == take), None)


def locale_for(brief: dict) -> str:
    if brief.get("locale"):
        return brief["locale"]
    lang = brief.get("language", "English")
    if lang.lower() not in LOCALES:
        raise ValueError(f"no speech locale known for language {lang!r}; add \"locale\": \"xx-XX\" to brief.json")
    return LOCALES[lang.lower()]


def gate_file(info: dict, cfg: dict, tier_ids: list[str]) -> dict:
    m = cfg["model"]
    sizes = {(t.width, t.height) for t in cfg["tiers"] if not tier_ids or t.id in tier_ids}
    probs = []
    if info["frames"] != m["frames"]:
        probs.append(f"{info['frames']} frames, need {m['frames']}")
    if abs(info["fps"] - m["fps"]) > 0.01:
        probs.append(f"{info['fps']:.2f} fps, need {m['fps']}")
    if (info["width"], info["height"]) not in sizes:
        probs.append(f"size {info['width']}x{info['height']} is not a configured tier size {sorted(sizes)}")
    if not info["has_audio"]:
        probs.append("no audio stream")
    return _g(not probs, f"{info['frames']}f {info['fps']:.0f}fps {info['width']}x{info['height']}", "; ".join(probs) or f"{m['frames']}f {m['fps']}fps tier size + audio")


def gate_speech(heard: dict, clip: Clip, brief: dict, cfg: dict, words_mode: str = "") -> tuple[dict, float]:
    spoken = " ".join(l.text for l in clip.lines)
    pron = brief.get("pronounce", {})
    respelled = spoken
    for word, like in pron.items():
        respelled = _swap(respelled, word, like)
    w = min(wer(spoken, heard["text"]), wer(respelled, heard["text"]))
    brand = brief.get("brand", "")
    said = set(normalise(heard["text"]))
    brand_in_script = bool(brand) and " ".join(normalise(brand)) in " ".join(normalise(spoken))
    brand_ok = True
    if brand_in_script:
        forms = [normalise(brand)] + ([normalise(pron[brand])] if brand in pron else [])
        brand_ok = any(all(tok in said for tok in f) for f in forms)
    ok = w <= cfg["checks"]["max_wer"] and brand_ok
    return _g(ok, {"wer": round(w, 3), "heard": heard["text"], "brand_heard": brand_ok if brand_in_script else None, "words": words_mode}, {"max_wer": cfg["checks"]["max_wer"], "brand": brand if brand_in_script else None}), w


def _swap(text: str, word: str, like: str) -> str:
    import re
    return re.sub(rf"\b{re.escape(word)}\b", like, text, flags=re.I)


def gate_face(res: dict, cfg: dict) -> tuple[dict, float, float, float]:
    rows = res["frames"]
    one = [r for r in rows if r["faces"] == 1]
    frac = len(one) / len(rows) if rows else 0.0
    dists = [r["distance"] for r in one if r.get("distance") is not None]
    drifts = [r["drift"] for r in one if r.get("drift") is not None]
    enough = bool(dists) and len(dists) * 2 >= len(one)          # a few frames without a distance do not matter
    dist = sum(dists) / len(dists) if enough else float("inf")
    drift = max(drifts, default=0.0)
    c = cfg["checks"]
    ok = frac >= c["min_face_fraction"] and enough and dist <= c["max_face_distance"]
    value = {"one_face_fraction": round(frac, 3), "distance": round(dist, 3) if enough else None, "distance_min": round(min(dists), 3) if dists else None,
             "distance_mean": round(dist, 3) if enough else None, "distance_max": round(max(dists), 3) if dists else None, "drift": round(drift, 3), "frames": len(rows)}
    return _g(ok, value, {"min_face_fraction": c["min_face_fraction"], "max_face_distance": c["max_face_distance"]}), frac, dist, drift


def gate_loudness(m: dict | None) -> dict:
    if m is None:
        return _g(False, None, "audio level not measurable (silent or unreadable audio)")
    ok = m["peak_db"] < CLIP_PEAK_DB and m["lufs"] > SILENT_LUFS
    return _g(ok, m, {"peak_db_below": CLIP_PEAK_DB, "lufs_above": SILENT_LUFS})


def judge(project: Project, cfg: dict, clip: Clip | str, take: Take | int, *,
          transcribe: Callable[[Path, str], dict] | None = None,
          faces: Callable[[Path | None, list[Path]], dict] | None = None) -> Check:
    """Run every gate on one take, save checks/<clip>_t<n>.json (and .words.json), return the Check.
    transcribe(wav, locale) and faces(sheet, frames) default to the Swift helpers and can be replaced in tests."""
    clip = _find_clip(project, clip)
    rec = _find_take(project, clip.id, take)
    n = rec.take if rec else int(take)
    path = project.path / rec.file if rec else project.path / "takes" / f"{clip.id}_t{n}.mp4"
    gates: dict = {}
    score = 0.0
    if not path.exists():
        gates["file"] = _g(False, "missing", str(path))
    else:
        info = media.probe(path)
        gates["file"] = gate_file(info, cfg, [rec.tier] if rec else [])
        if info["frames"] > 0:
            score = _analyse(project, cfg, clip, n, path, info, gates, transcribe, faces or native.faces)
    chk = Check(clip=clip.id, take=n, passed=len(gates) == 6 and all(g["pass"] for g in gates.values()), score=score, gates=gates)
    project.save_check(chk)
    return chk


def _native_transcribe(brief: dict) -> Callable[[Path, str], dict]:
    hints = tuple(dict.fromkeys([brief.get("brand", ""), *brief.get("pronounce", {}), *brief.get("pronounce", {}).values()]))
    return lambda wav, locale: native.transcribe(wav, locale, tuple(h for h in hints if h))


def _analyse(project, cfg, clip, n, path, info, gates, transcribe, faces) -> float:
    brief = project.brief()
    transcribe = transcribe or _native_transcribe(brief)
    with tempfile.TemporaryDirectory(prefix="ugc_chk_") as tmp:
        tmp = Path(tmp)
        w = 1.0
        if info["has_audio"]:
            wav = tmp / "a.wav"
            media.wav16k(path, wav)
            heard = transcribe(wav, locale_for(brief))
            seconds = cfg["model"]["frames"] / cfg["model"]["fps"]
            words, mode = align.script_words(" ".join(l.text for l in clip.lines), heard.get("words", []), seconds)
            write_atomic(project.p("checks", f"{clip.id}_t{n}.words.json"), json.dumps(words, indent=1))
            gates["speech"], w = gate_speech(heard, clip, brief, cfg, mode)
        else:
            gates["speech"] = _g(False, "no audio to transcribe", None)
        sheet = project.path / "cast" / "sheet.png"
        if not sheet.exists():
            gates["face"] = _g(False, f"{sheet} is missing; create the character sheet first", None)
            fd = drift = 1.0
            frac = 0.0
        else:
            fdir = tmp / "f"
            fdir.mkdir()
            gates["face"], frac, fd, drift = gate_face(faces(sheet, media.frames(path, fdir, FACE_FPS)), cfg)
            fd = 1.0 if fd == float("inf") else fd
        sc = media.max_scene_score(path)
        gates["cut"] = _g(sc < SCENE_CUT, round(sc, 3), {"scene_score_below": SCENE_CUT})
        fz = media.longest_freeze(path, MAX_FREEZE_S)
        gates["freeze"] = _g(fz == 0.0, round(fz, 2), {"seconds_at_most": MAX_FREEZE_S})
        gates["loudness"] = gate_loudness(media.loudness(path) if info["has_audio"] else None)
    return round(1.0 - w - 0.5 * fd - 0.5 * drift - 0.5 * (1.0 - frac), 4)


def select(project: Project) -> dict:
    """Best passing take per clip (highest score, lowest take number on a tie); if none passes, the best failing
    take with passed=false so a human can decide. Writes selects.json."""
    best: dict[str, tuple] = {}
    for t in project.takes():
        c = project.check(t.clip, t.take)
        if c is None:
            continue
        key = (c.passed, c.score, -c.take)
        if t.clip not in best or key > best[t.clip][0]:
            best[t.clip] = (key, c)
    out = {clip: {"take": c.take, "passed": c.passed} for clip, (_, c) in sorted(best.items())}
    write_atomic(project.p("selects.json"), json.dumps(out, indent=1))
    return out
