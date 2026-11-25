"""Assemble final/<reel>.mp4 from selected takes: trim to speech, cutaways, captions, AI label, end card, loudness.

Look decisions (see also timeline.py):
- Output fps comes from config (24, the model's native rate, so unretimed slots pass through 1:1). Retimed slots (speed != 1) and
  b-roll at other rates use nearest-frame selection, not blending or minterpolate: blends ghost, and motion interpolation warps lips,
  teeth and hands on generated faces. Film grain is added after the conversion, so repeated frames still differ.
- Upscale with lanczos, then gentle contrast-adaptive sharpening (cas 0.3).
- Alternating punch-in 1.00 / 1.06 on consecutive clips so every join reads as a jump cut.
- Subtle per-clip exposure and tint match to the reel average (60% of the difference, capped).
- One light luma grain over the whole reel, after the joins.
"""
from __future__ import annotations
import json
import logging
import math
import statistics
import tempfile
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from ..contract import Project, Reel
from . import audit as audit_mod
from . import captions, media, render, timeline
from .errors import EditError, FailedSelectError, LabelError
from .timeline import Cut, Span

log = logging.getLogger("ugc.edit")
IMAGES = {".png", ".jpg", ".jpeg", ".webp", ".bmp"}
PUNCH = (1.00, 1.06)
GRAIN = 3
CAS = 0.3
CRF = 16
FLOOR_RANGE = (-60.0, -45.0)
PINK_MEAN_DB = -23.5      # mean level of anoisesrc pink at a=0.5 after the bed's highpass and lowpass


def _words_for(project: Project, clip_id: str, take: int, given: dict | None) -> list[dict]:
    if given and given.get(clip_id):
        ws = given[clip_id]
    else:
        f = project.path / "checks" / f"{clip_id}_t{take}.words.json"
        if not f.exists():
            raise EditError(f"no word timings for clip {clip_id}: expected {f}; run the checks on this take first")
        ws = json.loads(f.read_text(encoding="utf8"))
    ws = sorted((dict(w=str(x["w"]), s=float(x["s"]), e=float(x["e"])) for x in ws), key=lambda x: x["s"])
    if not ws:
        raise EditError(f"clip {clip_id} has an empty word list; it cannot be trimmed or captioned")
    return ws


def _pull_quote(text: str, max_words: int = 12) -> str:
    w = text.split()
    return " ".join(w) if len(w) <= max_words else " ".join(w[:max_words]).rstrip(",;:") + "..."


def _norm(t: str) -> str:
    return " ".join("".join(ch.lower() if ch.isalnum() else " " for ch in t).split())


def _card_text(reel: Reel, brief: dict, after: int, used: list[str]) -> str:
    """A short line for a text card: the hook, a claim or the title, never what the presenter says next to it."""
    claims = brief.get("claims") or []
    texts = []
    if isinstance(claims, dict):
        texts = [str(v) for k, v in claims.items() if not reel.claims or k in reel.claims]
    else:
        texts = [str(c.get("text", "")) for c in claims if isinstance(c, dict) and (not reel.claims or c.get("id") in reel.claims)]
    pool = [t for t in [reel.hook, *texts, reel.title] if t and t.strip()]
    near = [_norm(l.text) for c in reel.clips[max(after - 1, 0):after + 1] for l in c.lines]
    ok = [t for t in pool if not any(_norm(t) and (_norm(t) in n or n in _norm(t)) for n in near if n)]
    pick = next((t for t in ok if t not in used), None) or next(iter(ok), None) or reel.title or str(brief.get("cta", "")) or "..."
    return _pull_quote(pick)


def _resolve_broll(project: Project, b) -> tuple[dict | None, str]:
    """(info, reason). info is None when the footage is missing or unreadable."""
    if not b.source:
        return None, "no source supplied"
    p = project.path / b.source
    if not p.is_file():
        return None, f"file not found: {p}"
    try:
        m = media.probe(p)
    except EditError as e:
        return None, f"unreadable: {e}"
    return {"path": p, "media": m, "image": p.suffix.lower() in IMAGES}, ""


def _clamp(x: float, lim: float) -> float:
    return max(-lim, min(lim, x))


def _fit_cover(sw: int, sh: int, W: int, H: int, z: float) -> tuple[int, int]:
    k = max(W / sw, H / sh) * z
    return 2 * math.ceil(sw * k / 2), 2 * math.ceil(sh * k / 2)


def _push(W: int, H: int, seconds: float) -> str:
    """Slow 6% push-in so a still (text card, end card, photo) is never a frozen frame."""
    return f"scale=w='2*trunc({W}/2*(1+0.06*t/{seconds:.3f}))':h=-2:eval=frame:flags=bicubic,crop={W}:{H}"


def _quote_path(p: Path) -> str:
    return str(p).replace("'", "'\\''")


def reel(project: Project, cfg: dict, reel: Reel, words: dict[str, list[dict]] | None = None, *,
         allow: set[str] | frozenset[str] = frozenset(), music: Path | None = None) -> Path:
    rc = cfg["reel"]
    W, H, FPS, seconds = rc["width"], rc["height"], rc["fps"], float(rc["seconds"])
    sel = project.selects()
    absent = [c.id for c in reel.clips if c.id not in sel]
    if absent:
        raise EditError(f"reel {reel.id}: no selected take for {', '.join(absent)}; generate and select takes first")
    failed = [c.id for c in reel.clips if not sel[c.id].get("passed") and c.id not in allow]
    if failed:
        raise FailedSelectError(f"reel {reel.id}: the selected take for {', '.join(failed)} failed its checks. "
                                f"Regenerate it, or pass allow={{{', '.join(repr(x) for x in failed)}}} after a human has looked at it.")
    overridden = [c.id for c in reel.clips if not sel[c.id].get("passed")]
    if overridden:
        log.warning("reel %s: using failed takes %s by human override", reel.id, overridden)

    files, wl = {}, {}
    for c in reel.clips:
        f = project.path / "takes" / f"{c.id}_t{sel[c.id]['take']}.mp4"
        if not f.is_file():
            raise EditError(f"reel {reel.id}: take file {f} is missing")
        files[c.id] = f
        wl[c.id] = _words_for(project, c.id, sel[c.id]["take"], words)
    meds = {c.id: media.probe(files[c.id]) for c in reel.clips}
    for c in reel.clips:
        if not meds[c.id].has_audio:
            raise EditError(f"reel {reel.id}: clip {c.id} has no audio track")

    brolls: dict[int, dict | None] = {}
    missing = []
    for b in reel.broll:
        info, why = _resolve_broll(project, b)
        brolls[b.after_clip] = info
        if info is None and b.seconds > 0:
            missing.append({"after_clip": b.after_clip, "seconds": b.seconds, "reason": why, "note": b.note})
            log.warning("reel %s: b-roll after clip %d is missing (%s); holding a text card. Footage wanted: %s", reel.id, b.after_clip, why, b.note or "-")
    spans = [Span(c.id, meds[c.id].seconds, wl[c.id][0]["s"], max(x["e"] for x in wl[c.id])) for c in reel.clips]
    cuts = [Cut(b.after_clip, b.seconds, (None if (brolls[b.after_clip] is None or brolls[b.after_clip]["image"]) else brolls[b.after_clip]["media"].seconds),
                card=brolls[b.after_clip] is None) for b in reel.broll]
    plan = timeline.plan(reel.id, spans, cuts, seconds, FPS)
    for m in missing:
        m["placed"] = any(c.after == m["after_clip"] and c.card for c in plan.cuts)
        if m["after_clip"] in plan.dropped:
            m["reason"] += "; dropped (a footage-less cutaway cannot open the reel or follow the last clip)"
    for k in plan.auto:
        cp = next(c for c in plan.cuts if c.after == k)
        missing.append({"after_clip": k, "seconds": round(cp.frames / FPS, 2), "reason": "text card added to reach the reel length", "note": "", "placed": True})
    if plan.auto:
        log.warning("reel %s: not enough speech and b-roll for %g s; held short text cards after clips %s", reel.id, seconds, plan.auto)
    n_total = plan.total

    # measurements
    def measure(i: int):
        c, sl, sp = reel.clips[i], plan.slots[i], spans[i]
        y, u, v = media.colour(files[c.id], sl.a, sl.b - sl.a)
        lufs, _ = media.loudness(files[c.id], sp.first, sp.last - sp.first, pre="highpass=f=75,")
        floors = []
        for ss, t in ((0.0, sp.first - 0.05), (sp.last + 0.05, sp.length - sp.last - 0.05)):
            if t >= 0.25:
                d = media.mean_db(files[c.id], ss, t)
                if d is not None:
                    floors.append(d)
        return (y, u, v), lufs, (min(floors) if floors else None)
    with ThreadPoolExecutor(max_workers=4) as ex:
        meas = list(ex.map(measure, range(len(reel.clips))))
    ty, tu, tv = (statistics.mean(m[0][k] for m in meas) for k in range(3))
    lufs_ok = [m[1] for m in meas if m[1] is not None]
    tl = statistics.mean(lufs_ok) if lufs_ok else None
    grades = [(_clamp(0.6 * (ty - m[0][0]) / 255, 0.035), _clamp(0.5 * (tu - m[0][1]), 3.0), _clamp(0.5 * (tv - m[0][2]), 3.0)) for m in meas]
    gains = [_clamp(tl - m[1], 6.0) if (tl is not None and m[1] is not None) else 0.0 for m in meas]
    fl = [m[2] for m in meas if m[2] is not None]
    bed_db = max(FLOOR_RANGE[0], min(FLOOR_RANGE[1], (statistics.mean(fl) if fl else -60.0) - 1.5))

    # b-roll and overlays
    g = render.geometry(cfg)
    brief = project.brief()
    brand = brief.get("brand", "")
    brand = brand.get("name", "") if isinstance(brand, dict) else str(brand or "")
    end_spec = render.Spec("endcard", W, H, text=reel.cta or brief.get("cta", ""), sub=str(brief.get("url", "")), extra=brand)
    label = render.label_spec(cfg)
    card_specs: dict[int, render.Spec] = {}
    used_texts: list[str] = []
    for k, cp in enumerate(c for c in plan.cuts if c.card):
        txt = _card_text(reel, brief, cp.after, used_texts)
        used_texts.append(txt)
        card_specs[cp.after] = render.Spec("card", W, H, text=txt, variant=k)
    events: list[tuple[int, int, render.Spec]] = []
    cap_rows = []
    for ci, sl in enumerate(plan.slots):
        for cp in captions.chunks(wl[reel.clips[ci].id]):
            def t(x: float, sl=sl) -> float:
                return sl.start / FPS + (x - sl.a) / sl.speed
            cs, ce = max(t(cp.start), sl.start / FPS), min(t(cp.end), (sl.start + sl.frames) / FPS)
            cap_rows.append((cs, ce, cp, sl))
    for cs, ce, cp, sl in cap_rows:
        for j in range(len(cp.words)):
            a, b = cp.active(j)
            sa, sb = max(sl.start / FPS + (a - sl.a) / sl.speed, sl.start / FPS), min(sl.start / FPS + (b - sl.a) / sl.speed, (sl.start + sl.frames) / FPS)
            events.append((round(sa * FPS), round(sb * FPS), render.Spec("caption", W, g.cap_h, words=cp.words, active=j)))
    events.sort(key=lambda e: e[0])
    pngs = render.overlays([label, end_spec, *card_specs.values(), *(e[2] for e in events)], project.p("cache", "overlays"))
    for k, ev in enumerate(events):          # no overlaps
        if k + 1 < len(events) and ev[1] > events[k + 1][0]:
            events[k] = (ev[0], events[k + 1][0], ev[2])
    events = [e for e in events if e[1] > e[0]]
    if render.meta(pngs[label])["box"] is None:
        raise LabelError(f"reel {reel.id}: the AI label overlay is empty; the reel cannot be published")

    with tempfile.TemporaryDirectory(prefix="ugc-edit-") as tmpd:
        tmp = Path(tmpd)
        blank = tmp / "blank.png"
        media.ff(["-f", "lavfi", "-i", f"color=c=black@0.0:s={W}x{g.cap_h},format=rgba", "-frames:v", "1", str(blank)], "making the blank caption frame")
        lines, pos = ["ffconcat version 1.0"], 0
        def put(png: Path, a: int, b: int) -> None:
            lines.extend([f"file '{_quote_path(png)}'", f"duration {(b - a) / FPS:.6f}"])
        for a, b, spec in events:
            if a > pos:
                put(blank, pos, a)
            put(pngs[spec], a, b)
            pos = b
        put(blank, pos, n_total + FPS)
        lines.append(f"file '{_quote_path(blank)}'")
        (tmp / "cap.txt").write_text("\n".join(lines) + "\n", encoding="utf8")

        mix = tmp / "mix.wav"
        _mix_audio(reel, plan, files, gains, bed_db, music, mix, FPS, n_total)
        ln = _loudnorm_args(mix, rc["loudness_lufs"], reel.id)

        out_dir = project.p("final", "x").parent
        part = out_dir / f"{reel.id}.part.mp4"
        final = out_dir / f"{reel.id}.mp4"
        inputs, chains, labels = [], [], []
        def add(args: list[str]) -> int:
            inputs.append(args)
            return len(inputs) - 1
        cut_by = {c.after: c for c in plan.cuts}
        pres_idx = {}
        for i, sl in enumerate(plan.slots):
            pres_idx[i] = add(["-ss", f"{sl.a:.4f}", "-t", f"{sl.b - sl.a + 0.2:.4f}", "-i", str(files[reel.clips[i].id])])
        seg = 0
        def seg_label() -> str:
            nonlocal seg
            seg += 1
            return f"s{seg}"
        def broll_chain(cp, info) -> str:
            secs = cp.frames / FPS + 0.5
            m = info["media"] if info else None
            if info is None:
                idx = add(["-loop", "1", "-framerate", str(FPS), "-t", f"{secs:.3f}", "-i", str(pngs[card_specs[cp.after]])])
                body = _push(W, H, cp.frames / FPS) + ",setsar=1"
            else:
                if info["image"]:
                    idx = add(["-loop", "1", "-framerate", str(FPS), "-t", f"{secs:.3f}", "-i", str(info["path"])])
                else:
                    idx = add(["-stream_loop", "-1", "-t", f"{secs:.3f}", "-i", str(info["path"])])
                if m.w / m.h < 1.0:
                    body = f"scale={W}:{H}:force_original_aspect_ratio=increase:flags=lanczos,crop={W}:{H}," + (_push(W, H, cp.frames / FPS) + "," if info["image"] else "") + "setsar=1"
                else:   # landscape or square: fit on a blurred fill of itself
                    body = (f"split[bg][fg];[bg]scale=270:480:force_original_aspect_ratio=increase,crop=270:480,gblur=sigma=5,eq=brightness=-0.08,"
                            f"scale={W}:{H}:flags=bicubic[b];[fg]scale={W}:-2:flags=lanczos[f];[b][f]overlay=(W-w)/2:(H-h)/2,setsar=1")
            lab = seg_label()
            chains.append(f"[{idx}:v]fps={FPS}:round=near,tpad=stop_mode=clone:stop=-1,trim=end_frame={cp.frames},setpts=PTS-STARTPTS,{body},format=yuv420p[{lab}]")
            return lab
        def presenter_chain(i: int, off: int, n: int) -> str:
            sl = plan.slots[i]
            sw, sh = meds[reel.clips[i].id].w, meds[reel.clips[i].id].h
            bw, bh = _fit_cover(sw, sh, W, H, PUNCH[i % 2])
            dy, du, dv = grades[i]
            tone = (f",eq=brightness={dy:.4f}" if abs(dy) > 0.002 else "") + \
                   (f",lutyuv=u='clip(val+{du:.2f},16,240)':v='clip(val+{dv:.2f},16,240)'" if max(abs(du), abs(dv)) > 0.3 else "")
            lab = seg_label()
            chains.append(f"[{pres_idx[i]}:v]setpts=(PTS-STARTPTS)/{sl.speed:.6f},fps={FPS}:round=near,tpad=stop_mode=clone:stop=-1,"
                          f"trim=start_frame={off}:end_frame={off + n},setpts=PTS-STARTPTS,scale={bw}:{bh}:flags=lanczos,crop={W}:{H},setsar=1,"
                          f"format=yuv420p,cas=strength={CAS}{tone}[{lab}]")
            return lab
        for i, sl in enumerate(plan.slots):
            c = cut_by.get(i + 1)
            if i == 0 and 0 in cut_by and cut_by[0].frames > 0:
                labels.append(broll_chain(cut_by[0], brolls.get(0)))
            off = sl.cover_head
            labels.append(presenter_chain(i, off, sl.frames - sl.cover_head - sl.cover_tail))
            if c and c.frames > 0:
                labels.append(broll_chain(c, brolls.get(i + 1)))
        e = add(["-loop", "1", "-framerate", str(FPS), "-t", f"{plan.end_frames / FPS + 0.5:.3f}", "-i", str(pngs[end_spec])])
        lab = seg_label()
        chains.append(f"[{e}:v]fps={FPS},trim=end_frame={plan.end_frames},setpts=PTS-STARTPTS,{_push(W, H, plan.end_frames / FPS)},setsar=1,format=yuv420p[{lab}]")
        labels.append(lab)
        cap_i = add(["-f", "concat", "-safe", "0", "-i", str(tmp / "cap.txt")])
        lab_i = add(["-loop", "1", "-framerate", str(FPS), "-t", f"{seconds + 1:.3f}", "-i", str(pngs[label])])
        aud_i = add(["-i", str(mix)])
        chains.append("".join(f"[{x}]" for x in labels) + f"concat=n={len(labels)}:v=1:a=0,noise=c0s={GRAIN}:c0f=t+u[base]")
        chains.append(f"[{cap_i}:v]fps={FPS},format=rgba[cap]")
        chains.append(f"[base][cap]overlay=0:{g.cap_y}:eof_action=pass:format=auto[o1]")
        chains.append(f"[{lab_i}:v]format=rgba[lab]")
        chains.append(f"[o1][lab]overlay={g.label_x}:{g.label_y}:format=auto,format=yuv420p[v]")
        cmd = ["ffmpeg", "-hide_banner", "-nostdin", "-nostats", "-y"]
        for a in inputs:
            cmd += a
        cmd += ["-filter_complex", ";".join(chains), "-map", "[v]", "-map", f"{aud_i}:a", "-af", ln,
                "-c:v", "libx264", "-preset", "slow", "-crf", str(CRF), "-profile:v", "high", "-maxrate", "24M", "-bufsize", "48M", "-pix_fmt", "yuv420p", "-r", str(FPS), "-g", str(FPS * 2),
                "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-frames:v", str(n_total),
                "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-t", f"{seconds:.3f}", "-movflags", "+faststart", "-f", "mp4", str(part)]
        media.run(cmd, f"encoding reel {reel.id}")

    manifest = {
        "reel": reel.id, "seconds": seconds, "fps": FPS, "frames": n_total, "lam": plan.lam, "music": bool(music),
        "label": {"text": label.text, "x": g.label_x, "y": g.label_y, "png": str(pngs[label])},
        "captions": [{"start": cs, "end": ce, "text": " ".join(cp.words), "n_words": len(cp.words)} for cs, ce, cp, _ in cap_rows],
        "caption_states": [{"start": a / FPS, "end": b / FPS, "text": " ".join(sp.words), "png": str(pngs[sp]),
                            "box": [render.meta(pngs[sp])["box"][0], render.meta(pngs[sp])["box"][1] + g.cap_y,
                                    render.meta(pngs[sp])["box"][2], render.meta(pngs[sp])["box"][3] + g.cap_y]} for a, b, sp in events],
        "slots": [{"clip": s.clip, "take": sel[s.clip]["take"], "start": s.start, "frames": s.frames, "speed": round(s.speed, 4), "src": [round(s.a, 3), round(s.b, 3)],
                   "overridden": s.clip in allow and not sel[s.clip].get("passed")} for s in plan.slots],
        "cutaways": [{"after": c.after, "start": c.start, "frames": c.frames, "cover": c.cover, "tail": c.tail} for c in plan.cuts],
        "end_card": {"start": plan.end_start, "frames": plan.end_frames},
        "cards": [{"after": c.after, "start": c.start / FPS, "end": (c.start + c.frames) / FPS, "text": card_specs[c.after].text} for c in plan.cuts if c.card],
        "missing_broll": missing,
        "gains_db": [round(x, 2) for x in gains], "bed_db": round(bed_db, 1),
    }
    mpath = out_dir / f"{reel.id}.edit.json"
    mpath.write_text(json.dumps(manifest, indent=1), encoding="utf8")
    problems = audit_mod.final(part, cfg, manifest=mpath)
    if problems:
        part.unlink(missing_ok=True)
        text = "; ".join(problems)
        if any("label" in p for p in problems):
            raise LabelError(f"reel {reel.id}: the AI label is not on every frame ({text}). Nothing was written.")
        raise EditError(f"reel {reel.id} failed its audit: {text}. Nothing was written.")
    part.replace(final)
    log.info("reel %s assembled: %s", reel.id, final)
    return final


# Every mix input is padded to the full reel length: amix with inputs of unequal length drops the rest of the mix at random (seen with ffmpeg 9.0.2).
def _mix_audio(reel_: Reel, plan, files, gains, bed_db, music, out: Path, FPS: int, n_total: int) -> None:
    dur = n_total / FPS
    inputs, ch, names = [], [], []
    for i, sl in enumerate(plan.slots):
        inputs += ["-ss", f"{sl.a:.4f}", "-t", f"{sl.b - sl.a:.4f}", "-i", str(files[sl.clip])]
        d = sl.frames / FPS
        tempo = f"atempo={sl.speed:.6f}," if abs(sl.speed - 1) > 1e-4 else ""
        samples = sl.start * (48000 // FPS)
        ch.append(f"[{i}:a]asetpts=PTS-STARTPTS,aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo,highpass=f=75,{tempo}"
                  f"volume={gains[i]:.2f}dB,atrim=duration={d:.6f},afade=t=in:d=0.01,afade=t=out:st={d - 0.01:.6f}:d=0.01,adelay={samples}S|{samples}S,apad=whole_dur={dur:.6f}[a{i}]")
        names.append(f"[a{i}]")
    n = len(plan.slots)
    inputs += ["-f", "lavfi", "-i", f"anoisesrc=c=pink:a=0.5:r=48000:d={dur + 1:.3f}"]
    ch.append(f"[{n}:a]highpass=f=70,lowpass=f=5000,volume={bed_db - PINK_MEAN_DB:.2f}dB,aformat=sample_fmts=fltp:channel_layouts=stereo[bed]")
    voice = "".join(names)
    if music:
        inputs += ["-stream_loop", "-1", "-i", str(music)]
        ch.append(f"{voice}amix=inputs={n}:normalize=0:duration=first,asplit=2[vm][vs]")
        ch.append(f"[{n + 1}:a]aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo,volume=-20dB[mu]")
        ch.append("[mu][vs]sidechaincompress=threshold=0.02:ratio=10:attack=30:release=400[md]")
        ch.append(f"[vm][md][bed]amix=inputs=3:normalize=0:duration=first,atrim=duration={dur:.6f},afade=t=in:d=0.01,afade=t=out:st={dur - 0.4:.6f}:d=0.4[m]")
    else:
        ch.append(f"{voice}[bed]amix=inputs={n + 1}:normalize=0:duration=first,atrim=duration={dur:.6f},afade=t=in:d=0.01,afade=t=out:st={dur - 0.4:.6f}:d=0.4[m]")
    media.ff([*inputs, "-filter_complex", ";".join(ch), "-map", "[m]", "-c:a", "pcm_f32le", "-ar", "48000", str(out)], f"mixing audio for reel {reel_.id}")


def _loudnorm_args(mix: Path, target: float, reel_id: str) -> str:
    """Second pass of two-pass loudnorm, as a filter string using the first pass's measurements."""
    tp = -1.5
    r = media.ff(["-i", str(mix), "-af", f"loudnorm=I={target}:TP={tp}:LRA=20:print_format=json", "-f", "null", "-"], "loudness analysis")
    blob = r.stderr[r.stderr.rindex("{"):r.stderr.rindex("}") + 1]
    m = json.loads(blob)
    if m["input_i"] in ("-inf", "inf"):
        raise EditError(f"reel {reel_id}: the mixed audio is silent; check the takes")
    return (f"loudnorm=I={target}:TP={tp}:LRA=20:measured_I={m['input_i']}:measured_TP={m['input_tp']}:measured_LRA={m['input_lra']}:"
            f"measured_thresh={m['input_thresh']}:offset={m['target_offset']}:linear=true,alimiter=limit=0.84:level=disabled,aresample=48000,"
            f"aformat=sample_fmts=fltp:channel_layouts=stereo")
