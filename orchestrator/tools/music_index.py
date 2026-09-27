"""
Music library indexer (long-form v2 plan section 5). Scans the free-music library, analyses every track
locally with librosa and writes <lib>/index.json for orchestrator/lib/longform/musicPlan.js.

  python music_index.py [--lib DIR] [--out FILE] [--force]

  --lib    default video-engine/assets/music-lib (env MUSIC_LIB overrides)
  --out    default <lib>/index.json
  --force  re-analyse every file (default: incremental -- unchanged files, by size+mtime then sha1, keep
           their previous analysis; licence notes are always re-read)

Layout: <lib>/<mood>/<track>.(mp3|wav|ogg|m4a|flac) with a sidecar <track>.<ext>.license.json (or
<track>.license.json), or a LICENSES.md markdown table (| file | title | artist | source | url | license |
credit |) in the track's folder or any parent up to <lib>. <lib>/sfx/[<category>/]*.* are SFX.
A track with no licence note is indexed with licensed=false and never picked by musicPlan.

Per track: duration, usable span (non-silent), bpm, beat grid, downbeats (bar phase from low-band energy),
4-bar phrase starts, an entry point (first full-energy phrase), a loop span between phrase boundaries,
RMS curve (dB, 2 Hz), integrated loudness (pyloudnorm if installed, else ffmpeg ebur128), low-end ratio
(<150 Hz share of spectral energy), onset rate, energy 1-5, and montageOk (95-125 BPM, heavy low end).

The last stdout line is a JSON summary.
"""
import hashlib
import json
import os
import re
import subprocess
import sys
import time
from pathlib import Path

import numpy as np

ANALYSIS_VERSION = 5
SR = 22050
AUDIO_EXT = {".mp3", ".wav", ".ogg", ".m4a", ".flac", ".aac", ".opus"}
MOODS = ["tension", "investigative", "dread", "hopeful", "playful", "calm", "triumphant", "trailer"]
REPO = Path(__file__).resolve().parents[2]
DEFAULT_LIB = REPO / "video-engine" / "assets" / "music-lib"
LICENSE_KEYS = ["title", "artist", "source", "url", "license", "credit"]


# ------------------------------------------------------------------ licence notes (pure, unit-tested)

def parse_licenses_md(text):
    """markdown table -> {file: {title, artist, source, url, license, credit, ...}} (header names are
    matched case-insensitively; extra columns are kept)"""
    rows = [l.strip() for l in text.splitlines() if l.strip().startswith("|")]
    if len(rows) < 2:
        return {}
    cells = lambda l: [c.strip() for c in l.strip().strip("|").split("|")]
    head = [h.lower() for h in cells(rows[0])]
    if "file" not in head:
        return {}
    out = {}
    for l in rows[1:]:
        c = cells(l)
        if all(re.fullmatch(r":?-{2,}:?", x or "--") for x in c):
            continue
        rec = {head[i]: c[i] for i in range(min(len(head), len(c))) if c[i]}
        f = rec.pop("file", "")
        if f and rec:
            out[f] = rec
    return out


def default_credit(lic):
    """credit line when the note has none: 'Music: "Title" by Artist (Source) -- Licence URL'"""
    title, artist = lic.get("title"), lic.get("artist")
    parts = ["Music:"]
    parts.append(f'"{title}"' if title else "untitled track")
    if artist:
        parts.append(f"by {artist}")
    if lic.get("source"):
        parts.append(f"({lic['source']})")
    line = " ".join(parts)
    if lic.get("license"):
        line += f", {lic['license']}"
    if lic.get("url"):
        line += f" {lic['url']}"
    return line


def normalise_license(rec):
    if not rec:
        return None
    lic = {k: str(v).strip() for k, v in rec.items() if v is not None and str(v).strip() != ""}
    lic["licensed"] = bool(lic.get("license")) and bool(lic.get("source") or lic.get("url"))
    if not lic.get("credit"):
        lic["credit"] = default_credit(lic)
    return lic


def find_license(path, lib):
    """sidecar json first, then the nearest LICENSES.md table that lists the file name"""
    for side in (path.with_name(path.name + ".license.json"), path.with_name(path.stem + ".license.json")):
        if side.exists():
            try:
                return normalise_license(json.loads(side.read_text(encoding="utf-8")))
            except Exception as e:  # malformed note: report it, treat as unlicensed
                return {"licensed": False, "error": f"{side.name}: {e}"}
    d = path.parent
    while True:
        md = d / "LICENSES.md"
        if md.exists():
            t = parse_licenses_md(md.read_text(encoding="utf-8"))
            if path.name in t:
                return normalise_license(t[path.name])
        if d == lib or lib not in d.parents:
            break
        d = d.parent
    return None


def classify(rel):
    """relative posix path -> (kind, mood, sfxCategory)"""
    parts = rel.split("/")
    top = parts[0].lower()
    if top == "sfx":
        cat = parts[1].lower() if len(parts) > 2 else None
        if not cat:
            n = parts[-1].lower()
            for k, words in (("impact", ("impact", "hit", "boom", "slam")), ("riser", ("riser", "rise", "build")), ("whoosh", ("whoosh", "swoosh", "swish")), ("sub-drop", ("sub", "drop", "downer"))):
                if any(w in n for w in words):
                    cat = k
                    break
        return "sfx", None, cat or "other"
    return "music", top if len(parts) > 1 else None, None


# ------------------------------------------------------------------ analysis

def decode(path, sr=SR):
    r = subprocess.run(["ffmpeg", "-v", "error", "-i", str(path), "-ac", "1", "-ar", str(sr), "-f", "f32le", "-"], capture_output=True)
    if r.returncode != 0:
        raise RuntimeError(f"ffmpeg decode failed: {r.stderr.decode(errors='replace')[-300:]}")
    return np.frombuffer(r.stdout, dtype="<f4").astype(np.float32)


def loudness_lufs(path):
    try:
        import pyloudnorm  # optional
        r = subprocess.run(["ffmpeg", "-v", "error", "-i", str(path), "-ac", "2", "-ar", "48000", "-f", "f32le", "-"], capture_output=True, check=True)
        x = np.frombuffer(r.stdout, dtype="<f4").reshape(-1, 2).astype(np.float64)
        return round(float(pyloudnorm.Meter(48000).integrated_loudness(x)), 2)
    except ImportError:
        pass
    except Exception:
        return None
    r = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", str(path), "-af", "ebur128", "-f", "null", "-"], capture_output=True)
    m = re.findall(r"I:\s+(-?[\d.]+) LUFS", r.stderr.decode(errors="replace"))
    return round(float(m[-1]), 2) if m else None


def rnd(a, k=3):
    return [round(float(v), k) for v in a]


def analyse_sfx(path):
    """SFX: duration, peak time (the hit), attack; no beat grid"""
    y = decode(path)
    dur = len(y) / SR
    a = np.abs(y)
    hop = 256
    nf = max(1, len(a) // hop)
    env = np.sqrt(np.mean(y[: nf * hop].reshape(nf, hop) ** 2, axis=1) + 1e-12)
    pk = int(np.argmax(env))
    return {"duration": round(dur, 3), "peakAt": round(pk * hop / SR, 3), "peakDb": round(float(20 * np.log10(a.max() + 1e-9)), 1)}


def analyse(path):
    import librosa

    y = decode(path)
    dur = len(y) / SR
    if dur < 2:
        raise RuntimeError("shorter than 2 s")
    hop = 512
    rms = librosa.feature.rms(y=y, frame_length=2048, hop_length=hop)[0]
    rms_db = 20 * np.log10(rms + 1e-9)
    t_rms = librosa.frames_to_time(np.arange(len(rms)), sr=SR, hop_length=hop)
    peak_db = float(np.percentile(rms_db, 99))
    loud = np.where(rms_db > peak_db - 40)[0]
    usable = [float(t_rms[loud[0]]), float(min(dur, t_rms[loud[-1]] + hop / SR))] if len(loud) else [0.0, dur]

    S = np.abs(librosa.stft(y, n_fft=2048, hop_length=hop))
    freqs = librosa.fft_frequencies(sr=SR, n_fft=2048)
    pw = S ** 2
    low = pw[freqs < 150].sum(axis=0)
    low_ratio = float(low.sum() / (pw.sum() + 1e-12))

    onset_env = librosa.onset.onset_strength(S=librosa.amplitude_to_db(S, ref=np.max), sr=SR, hop_length=hop)
    tempo, beat_frames = librosa.beat.beat_track(onset_envelope=onset_env, sr=SR, hop_length=hop)
    bpm = float(np.atleast_1d(tempo)[0])
    beats = librosa.frames_to_time(beat_frames, sr=SR, hop_length=hop)
    if len(beats) >= 8:
        # the tracker can lock onto off-beat hats: if the half-beat-shifted grid carries more low-band
        # (kick/bass) attack energy, shift the grid by half a beat
        half = float(np.median(np.diff(beats))) / 2
        t_s = librosa.frames_to_time(np.arange(S.shape[1]), sr=SR, hop_length=hop)
        low_att = np.maximum(0, np.diff(np.log(pw[freqs < 150].sum(axis=0) + 1e-9), prepend=0))

        def att(ts):
            idx = np.clip(np.searchsorted(t_s, ts), 0, len(low_att) - 3)
            return float(np.mean([low_att[i:i + 3].max() for i in idx]))

        shifted = beats + half
        shifted = shifted[shifted < dur]
        if att(shifted) > 1.25 * att(beats):
            beats = shifted
            beat_frames = librosa.time_to_frames(beats, sr=SR, hop_length=hop)
    onsets = librosa.onset.onset_detect(onset_envelope=onset_env, sr=SR, hop_length=hop, units="time")
    span = max(1.0, usable[1] - usable[0])
    onset_rate = len(onsets) / span

    beat_stable = False
    downbeats, phrases = [], []
    if len(beats) >= 16:
        ibi = np.diff(beats)
        beat_stable = bool(np.std(ibi) / (np.mean(ibi) + 1e-9) < 0.12)
        # bar phase: the beat phase (of 4) whose beats carry the most low-band energy + onset strength
        low_n = low / (low.max() + 1e-12)
        on_n = onset_env / (onset_env.max() + 1e-12)
        strength = 0.6 * low_n[np.minimum(beat_frames, len(low_n) - 1)] + 0.4 * on_n[np.minimum(beat_frames, len(on_n) - 1)]
        phase = int(np.argmax([strength[p::4].mean() if len(strength[p::4]) else 0 for p in range(4)]))
        downbeats = beats[phase::4]
        # phrase phase (of 4 bars): the downbeat offset with the biggest mean energy step across it
        if len(downbeats) >= 8:
            def step(tq):
                i = np.searchsorted(t_rms, tq)
                a, b = rms_db[max(0, i - 40):i], rms_db[i:i + 40]
                return float(b.mean() - a.mean()) if len(a) and len(b) else 0.0

            steps = [np.mean([abs(step(t)) for t in downbeats[q::4]]) for q in range(4)]
            q = int(np.argmax(steps))
            phrases = downbeats[q::4]
            if q and downbeats[0] < phrases[0]:
                phrases = np.concatenate([[downbeats[0]], phrases])  # the first bar also works as a cut
        else:
            phrases = downbeats
    if not len(phrases):  # no stable beat (ambient/drone): cut every 8 s
        phrases = np.arange(usable[0], usable[1] - 4, 8.0)

    # entry: first phrase whose next 4 s sit within 4 dB of the track's median body level
    body_med = float(np.median(rms_db[(t_rms >= usable[0]) & (t_rms <= usable[1])]))

    def level(t0, t1):
        m = (t_rms >= t0) & (t_rms < t1)
        return float(rms_db[m].mean()) if m.any() else -120.0

    entry = float(phrases[0])
    for p in phrases:
        if p > usable[0] + 0.4 * span:
            break
        if level(p, p + 4) >= body_med - 4:
            entry = float(p)
            break
    # loop end: the last phrase boundary before the outro (the phrase before it is still full level)
    loop = None
    grid = phrases
    if len(downbeats) >= 8:  # whole 4-bar multiples from the entry (a denser grid than the phrase phase)
        k0 = int(np.argmin(np.abs(np.asarray(downbeats) - entry)))
        grid = downbeats[k0::4]
    ends = [float(p) for p in grid if p > entry + 8 and level(p - 4, p) >= body_med - 5 and p <= usable[1] - 0.5]
    if ends:
        loop = {"start": round(entry, 3), "end": round(ends[-1], 3)}
    usable_len = (loop["end"] if loop else usable[1]) - entry

    energy_score = 0.35 * np.clip((bpm - 60) / 70, 0, 1) + 0.4 * np.clip(onset_rate / 5, 0, 1) + 0.25 * np.clip(low_ratio / 0.45, 0, 1)
    if not beat_stable:
        energy_score *= 0.8
    rms2 = [round(level(t, t + 0.5), 1) for t in np.arange(0, dur, 0.5)]
    return {
        "duration": round(dur, 3),
        "usable": rnd(usable),
        "bpm": round(bpm, 1),
        "beatStable": beat_stable,
        "beats": rnd(beats),
        "downbeats": rnd(downbeats),
        "beatsPerBar": 4,
        "phrases": rnd(phrases),
        "entry": round(entry, 3),
        "loop": loop,
        "usableFromEntry": round(float(usable_len), 3),
        "rms": {"hop": 0.5, "db": rms2},
        "bodyRmsDb": round(body_med, 1),
        "lowRatio": round(low_ratio, 3),
        "onsetRate": round(float(onset_rate), 2),
        "energyScore": round(float(energy_score), 3),
        "energy": int(1 + round(4 * float(energy_score))),
    }


def sha1(path):
    h = hashlib.sha1()
    with open(path, "rb") as f:
        for b in iter(lambda: f.read(1 << 20), b""):
            h.update(b)
    return h.hexdigest()


def build_index(lib, out, force=False, log=lambda m: None):
    lib = Path(lib).resolve()
    prev = {}
    if out.exists() and not force:
        try:
            prev = {t["id"]: t for t in json.loads(out.read_text(encoding="utf-8")).get("tracks", [])}
        except Exception:
            prev = {}
    by_hash = {t.get("hash"): t for t in prev.values() if t.get("hash")}
    tracks, errors = [], []
    counts = {"analysed": 0}
    files = sorted(p for p in lib.rglob("*") if p.is_file() and p.suffix.lower() in AUDIO_EXT)
    for p in files:
        rel = p.relative_to(lib).as_posix()
        kind, mood, cat = classify(rel)
        st = p.stat()
        old = prev.get(rel)
        rec = None
        if old and old.get("v") == ANALYSIS_VERSION and old.get("size") == st.st_size and abs(old.get("mtime", 0) - st.st_mtime) < 1e-3:
            rec = dict(old)
        else:
            h = sha1(p)
            same = by_hash.get(h)
            if same and same.get("v") == ANALYSIS_VERSION:
                rec = dict(same)
            else:
                try:
                    log(f"analysing {rel}")
                    rec = analyse_sfx(p) if kind == "sfx" else analyse(p)
                    counts["analysed"] += 1
                except Exception as e:
                    errors.append({"id": rel, "error": str(e)[:300]})
                    continue
                rec["lufs"] = loudness_lufs(p)
            rec["hash"] = h
        rec.update({"id": rel, "v": ANALYSIS_VERSION, "file": rel, "kind": kind, "mood": mood, "size": st.st_size, "mtime": st.st_mtime})
        if cat:
            rec["sfxCategory"] = cat
        lic = find_license(p, lib)
        rec["license"] = lic
        rec["licensed"] = bool(lic and lic.get("licensed"))
        rec["credit"] = lic.get("credit") if lic else None
        if lic and lic.get("energy"):
            try:
                rec["energy"] = max(1, min(5, int(float(lic["energy"]))))
                rec["energyFromNote"] = True
            except ValueError:
                pass
        if kind == "music" and mood not in MOODS:
            rec["warning"] = f"folder '{mood}' is not a known mood ({', '.join(MOODS)})"
        bpm = rec.get("bpm") or 0
        rec["montageOk"] = kind == "music" and any(95 <= b <= 125 for b in (bpm, bpm * 2, bpm / 2)) and (rec.get("lowRatio") or 0) >= 0.2
        tracks.append(rec)
    index = {
        "version": 1,
        "analysisVersion": ANALYSIS_VERSION,
        "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "moods": MOODS,
        "tracks": tracks,
        "errors": errors,
    }
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(index, indent=1), encoding="utf-8")
    by_mood = {}
    for t in tracks:
        k = t["mood"] if t["kind"] == "music" else "sfx"
        by_mood[k] = by_mood.get(k, 0) + 1
    return {"index": str(out), "tracks": len(tracks), "analysed": counts["analysed"], "reused": len(tracks) - counts["analysed"], "unlicensed": sum(1 for t in tracks if not t["licensed"]), "byMood": by_mood, "errors": errors}


def main():
    opt = lambda k: sys.argv[sys.argv.index(k) + 1] if k in sys.argv else None
    lib = Path(opt("--lib") or os.environ.get("MUSIC_LIB") or DEFAULT_LIB)
    out = Path(opt("--out") or (lib / "index.json"))
    if not lib.exists():
        print(json.dumps({"index": None, "tracks": 0, "error": f"no library at {lib}"}))
        return
    summary = build_index(lib, out, force="--force" in sys.argv, log=lambda m: print(m, file=sys.stderr))
    print(json.dumps(summary))


if __name__ == "__main__":
    main()
