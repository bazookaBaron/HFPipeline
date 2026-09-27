#!/usr/bin/env python3
"""
v3 hard QA gates -- measured on OUR output exactly (spec timeline + delivered mp4), never on a
video detector. Bands come from analysis/pacing-audit-20260924/design/SPEC.md (refs R1/R2 for DH).

  python v3_gates.py --video out.mp4 --timeline out.mp4.timeline.json [--metrics out.mp4.metrics.json]
prints one JSON object {ok, gates:[{name, ok, value, band, hard}], repair:[...]} and exits 1 if a
hard gate fails. `repair` names the stage that must redo work (storyboard / audio / render).
"""
import re
import argparse, json, subprocess, sys, statistics

LC = {
    "beats_per_min": (45, 95),       # R3 69.6, R4 50.9
    "max_visual_gap_s": 4.5,         # R3 4.0; R4 holds to 8.3 s only with a live packet loop
    "scaffold_life_median_s": (2.5, 7.0),  # R3 4.2, R4 5.0
    "wpm": (170, 222),
    "lufs": (-14.4, -13.8),
    "lra_max": 1.6,
    "tp_max": -0.9,
}
DC = {
    "beats_per_min": (55, 100),      # R5 73.5
    "max_visual_gap_s": 3.2,         # R5 2.73 (0 gaps > 3 s)
    "scaffold_life_median_s": (1.6, 5.0),  # R5 sub-states mean 2.6 s, scaffolds median 3.3 s
    "wpm": (170, 222),               # R5 176
    "lufs": (-14.4, -13.8),
    "lra_max": 1.6,
    "tp_max": -0.9,
}
DH = {
    "beats_per_min": (50, 100),      # R1 79.7-93.3, R2 67-72.9 (visual beats incl. cuts/entrances/events)
    "max_visual_gap_s": 3.8,         # R1 3.83 (every longer hold has motion), R2 3.12
    "scaffold_life_median_s": (2.0, 8.4),  # R1 3.4 (scaffold every 3.4 s), R2 layout life median 8.4
    "wpm": (170, 222),               # refs 176-221
    "lufs": (-14.4, -13.8),          # refs -14.1..-14.2
    "lra_max": 1.6,                  # refs 1.0-1.4; AAC re-measure variance allowance
    "tp_max": -0.9,                  # refs -0.5..-1.1 dBTP
}
BR = {
    "beats_per_min": (55, 80),       # R7 62.8 (chrome ticks count as beats)
    "max_visual_gap_s": 3.6,         # R7 longest hold 3.43 s
    "scaffold_life_median_s": (2.5, 5.0),  # R7 3.53 s (host sheet mutates in place)
    "wpm": (170, 222),               # R7 204; pace follows the syllable rate (refs 170-221 wpm)
    "lufs": (-14.4, -13.8),          # R7 -14.1
    "lra_max": 1.6,                  # R7 1.5
    "tp_max": -0.9,
}
BP = {
    "beats_per_min": (45, 65),       # R6 52.1 (48.6 at 0.15 %); chrome (note / tracker / users) counts
    "max_visual_gap_s": 3.8,         # R6 longest content hold 3.73 s (packets run on the blueprint)
    "scaffold_life_median_s": (2.5, 5.0),  # R6 3.67 s (blueprint visits mutate in place)
    "wpm": (170, 222),               # R6 196; pace follows the syllable rate (refs 170-221 wpm)
    "lufs": (-14.4, -13.8),          # R6 -14.1
    "lra_max": 1.6,                  # R6 1.5
    "tp_max": -0.9,
}

LF = {
    # 16:9 long-form chapters (plan §6/§8, provisional until a long-form reference is measured)
    "beats_per_min": (18, 40),
    "max_visual_gap_s": 5.0,
    "scaffold_life_median_s": (5.0, 10.0),
    "wpm": (140, 175),               # pace.js PACE.LF: 160 wpm gross is the primary target
    "syl": (4.2, 5.4),               # guard band only (plain short-word scripts deliver ~4.4-4.7 syl/s)
    "lufs": (-14.4, -13.8),
    "lra_max": 1.6,
    "tp_max": -0.9,
}
LF_MEDIA = {"photo", "photoGrid", "portraitCard", "mapCard", "media"}
LF_CHROME = {"lfHeader", "lfProgress", "lfCredit"}


def lf_visible(spec, t):
    """(scaffold, [modules visible at t]) from the compiled spec"""
    for s in spec["scaffolds"]:
        if s["t0"] - 1e-6 <= t < s["t1"]:
            return s, [m for m in s["modules"] if s["t0"] + (m.get("at") or 0) <= t + 1e-6]
    return None, []


def media_ok(m):
    p = m.get("props") or {}
    return m["type"] in LF_MEDIA and (bool(p.get("src")) or any(isinstance(v, dict) and v.get("src") for v in (p.get("items") or [])))


def cached_without_credit(v, where, out):
    if isinstance(v, list):
        for x in v:
            cached_without_credit(x, where, out)
    elif isinstance(v, dict):
        src = v.get("src")
        if isinstance(src, str) and "assets/media/cache/" in src.replace("\\", "/") and not v.get("missing") and not str(v.get("credit") or "").strip():
            out.append(f"{where}: {src}")
        for k, x in v.items():
            if k != "src":
                cached_without_credit(x, where, out)


def beats_from_spec(spec):
    t = []
    for s in spec["scaffolds"]:
        t.append(s["t0"])
        for m in s["modules"]:
            if m.get("at"):
                t.append(s["t0"] + m["at"])
            for la in (m.get("props") or {}).get("lineAt") or []:
                if la > 0:
                    t.append(s["t0"] + (m.get("at") or 0) + la)
    t += [e["t"] for e in spec["events"]]
    return sorted(set(round(x, 2) for x in t))


# frame size of the delivered video (set in main from ffprobe, else the spec's frame)
W, H = 1080, 1920


def video_size(video):
    try:
        out = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0", video],
                             capture_output=True, text=True).stdout.strip()
        w, h = (int(v) for v in out.split(",")[:2])
        return w, h
    except Exception:
        return None


def frame(video, t):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-ss", f"{t:.3f}", "-i", video, "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
                         capture_output=True).stdout
    return raw  # W*H*3


def px(raw, x, y):
    i = (y * W + x) * 3
    return raw[i], raw[i + 1], raw[i + 2]


def near(c, ref, tol):
    return all(abs(a - b) <= tol for a, b in zip(c, ref))



def syllables(word):
    """Vowel-group syllable estimate (same heuristic as lib/video/v3/pace.js)."""
    t = re.sub(r"[^a-z]", "", str(word).lower())
    if not t:
        return 0
    n = len(re.findall(r"[aeiouy]+", t))
    if t.endswith("e") and n > 1 and not t.endswith("le"):
        n -= 1
    return max(1, n)

def caption_border_rows(raw):
    """rows (y) that contain a >=160 px run of near-white pixels in the caption band 1380-1560 (9:16)"""
    rows = []
    for y in range(1380, 1560):
        run = best = 0
        base = y * W * 3
        for x in range(0, W):
            i = base + x * 3
            if raw[i] > 225 and raw[i + 1] > 225 and raw[i + 2] > 225:
                run += 1
                best = max(best, run)
            else:
                run = 0
        if best >= 160:
            rows.append(y)
    return rows



def caption_rows(raw, match):
    box = []
    for y in range(1400, 1600):
        n = 0
        for x in range(150, 930, 2):
            if match(px(raw, x, y)):
                n += 1
        if n >= 20:
            box.append(y)
    return box


def settled_caption(video, t, match, band):
    """The midpoint frame can land on a caption chunk's pop-in (scaled chip); probe +-0.3 s for a settled one."""
    for dt in (0.3, -0.3, 0.6):
        raw = frame(video, t + dt)
        if len(raw) < W * H * 3:
            continue
        box = caption_rows(raw, match)
        if box and band[0] <= box[0] <= band[1] and band[2] <= box[-1] <= band[3]:
            return box
    return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--video", required=True)
    ap.add_argument("--timeline", required=True)
    ap.add_argument("--metrics")
    a = ap.parse_args()
    tl = json.load(open(a.timeline, encoding="utf-8"))
    spec, timeline = tl["spec"], tl["timeline"]
    profile = spec.get("profile", "DH")
    global W, H
    fr = spec.get("frame") or {}
    W, H = video_size(a.video) or (fr.get("w", 1080), fr.get("h", 1920))
    # the geometry bands below (HUD, caption chips, BP header) are measured on 9:16 refs:
    # a landscape frame keeps only the background check until its own profile bands exist
    portrait = H > W
    B = LC if profile == "LC" else DC if profile == "DC" else BR if profile == "BR" else BP if profile == "BP" else LF if profile == "LF" else DH
    total = timeline["totalSeconds"]
    gates = []

    def gate(name, ok, value, band, hard=True, repair=None):
        gates.append({"name": name, "ok": bool(ok), "value": value, "band": band, "hard": hard, "repair": repair})

    # ---- cadence (exact, from the compiled spec) ----
    beats = beats_from_spec(spec)
    bpm = len(beats) / total * 60
    # playing footage (media windows) is continuous motion (R8 measured it that way): it fills
    # holds for the gap gate only, it never counts as extra beats/min
    live = list(beats)
    for m in spec.get("media") or []:
        for it in m.get("items") or []:
            if it.get("kind") == "video":
                k = it["start"]
                while k < it["start"] + it["dur"]:
                    live.append(round(k, 2))
                    k += 1.0
    live = sorted(set(live))
    gaps = [b - a for a, b in zip([0.0] + live, live + [total])]
    lives = [s["t1"] - s["t0"] for s in spec["scaffolds"]]
    bpm_band = B["beats_per_min"]
    if B is LF and total < 35:
        # short LF sections (cold open, recap ticking off takeaways) run denser than a full chapter
        bpm_band = (bpm_band[0], 48)
    gate("beats_per_min", bpm_band[0] <= bpm <= bpm_band[1], round(bpm, 1), bpm_band, repair="storyboard")
    gate("max_visual_gap_s", max(gaps) <= B["max_visual_gap_s"], round(max(gaps), 2), f"<= {B['max_visual_gap_s']}", repair="storyboard")
    med = statistics.median(lives)
    gate("scaffold_life_median_s", B["scaffold_life_median_s"][0] <= med <= B["scaffold_life_median_s"][1], round(med, 2), B["scaffold_life_median_s"], repair="storyboard")
    first = [b for b in beats if b <= 1.0]
    gate("hook_beats_first_1s", len(first) >= 2, len(first), ">= 2 (refs >= 3)", hard=False)

    # ---- pace ----
    wpm = len(timeline["words"]) / total * 60
    gate("delivered_wpm", B["wpm"][0] <= wpm <= B["wpm"][1], round(wpm, 1), B["wpm"], repair="audio")
    # syllable rate over speech time (word gaps > 0.25 s removed): refs 5.39-6.08, median 5.84
    ws = timeline["words"]
    speech_t = sum(w["end"] - w["start"] for w in ws) + sum(max(0.0, b["start"] - a["end"]) for a, b in zip(ws, ws[1:]) if b["start"] - a["end"] <= 0.25)
    syl = sum(syllables(w.get("text", "")) for w in ws)
    rate = syl / speech_t if speech_t else 0
    syl_band = B.get("syl", (5.3, 6.4))
    gate("syllables_per_s", syl_band[0] <= rate <= syl_band[1], round(rate, 2), list(syl_band), repair="audio")

    # ---- loudness (from the master stats recorded in metrics, else measure) ----
    stats = None
    if a.metrics:
        try:
            stats = json.load(open(a.metrics, encoding="utf-8")).get("audio")
        except Exception:
            stats = None
    if stats:
        I, lra, tp = stats.get("integratedLufs"), stats.get("loudnessRangeLu"), stats.get("truePeakDbtp")
        gate("integrated_lufs", I is not None and B["lufs"][0] <= I <= B["lufs"][1], I, B["lufs"], repair="audio")
        gate("loudness_range_lu", lra is not None and lra <= B["lra_max"], lra, f"<= {B['lra_max']}", repair="audio")
        gate("true_peak_dbtp", tp is not None and tp <= B["tp_max"], tp, f"<= {B['tp_max']}", repair="audio")
        gate("silence_below_-60_pct", True, stats.get("silenceBelowMinus60Pct"), "refs 0.1-0.2 (diagnostic: no music bed by decision)", hard=False)
    else:
        gate("loudness_stats_present", False, None, "metrics.audio required", repair="audio")

    # ---- delivered frame size = the compiled frame ----
    want = (fr.get("w", 1080), fr.get("h", 1920))
    gate("frame_size", (W, H) == want, f"{W}x{H}", f"{want[0]}x{want[1]}", repair="render")

    # ---- frame geometry at each scaffold's midpoint ----
    geo_fail = []
    for s in spec["scaffolds"]:
        t = (s["t0"] + s["t1"]) / 2
        raw = frame(a.video, t)
        if len(raw) < W * H * 3:
            geo_fail.append(f"{s['id']}: no frame at {t:.2f}")
            continue
        bgc = (0xF4, 0xF4, 0xED) if profile == "LC" else (0x09, 0x0A, 0x0D) if profile == "DC" else (0xF1, 0xF1, 0xEA) if profile == "BR" else (0xED, 0xF1, 0xF3) if profile == "BP" else (0xF7, 0xF6, 0xF1) if profile == "LF" else (0, 0, 0)

        def covered(x, y):
            # LF full-bleed photos / the end screen cover the plate on purpose
            return profile == "LF" and any(m["type"] not in LF_CHROME and m["rect"][0] <= x <= m["rect"][0] + m["rect"][2] and m["rect"][1] <= y <= m["rect"][1] + m["rect"][3] and m["type"] != "endScreen" for m in s["modules"])
        for (cx, cy) in ((4, 4), (4, H - 5)):
            if not covered(cx, cy) and not near(px(raw, cx, cy), bgc, 6):
                geo_fail.append(f"{s['id']}: background {px(raw, cx, cy)} at ({cx},{cy}), want {bgc}")
        if not portrait:
            continue
        if profile == "BP" and any(m["id"] == "bphead" for m in s["modules"]):
            # R6 header bar: brand block #111923 at x 45-310.5 x y 236-291
            if not near(px(raw, 305, 284), (0x11, 0x19, 0x23), 10):
                geo_fail.append(f"{s['id']}: BP header brand block {px(raw, 305, 284)} at (305,284), want #111923")
        if profile in ("BR", "BP"):
            # R7 marker caption: pure-white chip (the #F1F1EA plate stays < 247) at y 1440-1540
            box = []
            for y in range(1400, 1600):
                n = 0
                for x in range(150, 930, 2):
                    c = px(raw, x, y)
                    if c[0] >= 250 and c[1] >= 250 and c[2] >= 248:
                        n += 1
                if n >= 20:
                    box.append(y)
            if box and not (1435 <= box[0] <= 1446 and 1533 <= box[-1] <= 1546):
                box = settled_caption(a.video, t, lambda c: c[0] >= 250 and c[1] >= 250 and c[2] >= 248, (1435, 1446, 1533, 1546)) or box
            if box and not (1435 <= box[0] <= 1446 and 1533 <= box[-1] <= 1546):
                geo_fail.append(f"{s['id']}: BR caption chip y {box[0]}-{box[-1]}, want 1440-1540")
            continue
        if profile == "DC":
            continue  # quiet chip caption: no bright border to scan; bg checked above
        if profile == "LC":
            # paper caption (R4): box y 1452-1545; find the box edges from the fill vs the page
            # a row belongs to the paper box when >= 40 px across x 150-930 match the #FEFCF8 fill
            # (a single centre column runs through the caption's dark text)
            box = []
            for y in range(1400, 1600):
                n = 0
                for x in range(150, 930, 2):
                    c = px(raw, x, y)
                    # encoded #FEFCF8 lands ~(250,250,245); the #F4F4ED page lands ~(242,242,233)
                    if c[0] >= 247 and c[1] >= 247 and c[2] >= 240:
                        n += 1
                if n >= 20:
                    box.append(y)
            if box and not (1449 <= box[0] <= 1456 and 1540 <= box[-1] <= 1549):
                box = settled_caption(a.video, t, lambda c: c[0] >= 247 and c[1] >= 247 and c[2] >= 240, (1449, 1456, 1540, 1549)) or box
            if box and not (1449 <= box[0] <= 1456 and 1540 <= box[-1] <= 1549):
                geo_fail.append(f"{s['id']}: LC caption box y {box[0]}-{box[-1]}, want 1452-1545")
            continue
        if any(m["id"] == "hud" for m in s["modules"]):
            if not near(px(raw, 72, 270), (9, 13, 17), 8):
                geo_fail.append(f"{s['id']}: HUD fill {px(raw, 72, 270)} at (72,270), want #090d11")
        rows = caption_border_rows(raw)
        if rows:
            top, bot = rows[0], rows[-1]
            if not (1413 <= top <= 1419):
                geo_fail.append(f"{s['id']}: caption top border y {top}, want 1416+-3")
            if not (1526 <= bot <= 1536):
                geo_fail.append(f"{s['id']}: caption bottom border y {bot}, want ~1531")
    gate("frame_geometry", not geo_fail, geo_fail or "all scaffolds", "DH: bg #000, HUD #090d11 @y235-305, caption y1416-1532; LC: bg #F4F4ED, caption y1452-1545" if portrait else f"{W}x{H}: background only (9:16 bands skipped)", repair="render")

    if profile == "LF":
        lf_gates(a.video, spec, total, gate)

    hard_fail = [g for g in gates if g["hard"] and not g["ok"]]
    out = {"ok": not hard_fail, "gates": gates, "repair": sorted(set(g["repair"] for g in hard_fail if g["repair"]))}
    print(json.dumps(out, indent=1))
    sys.exit(0 if out["ok"] else 1)


def lf_gates(video, spec, total, gate):
    """LF-only gates (plan §6/§8): credits, graphics density, media share, photo holds."""
    # ---- credits (spec): every fetched (cached) image on screen carries a credit ----
    missing = []
    for s in spec["scaffolds"]:
        for m in s["modules"]:
            cached_without_credit(m.get("props") or {}, f"{s['id']}/{m['id']}", missing)
    gate("credits_present", not missing, missing or "every cached image has a credit", "credit on every fetched image", repair="storyboard")

    # ---- credits (pixels): the credit chip / line is drawn while its image shows ----
    # region = the chip rect the compiler recorded; a drawn credit has dark mono text on a light chip
    fails, checked = [], 0
    for c in spec.get("credits") or []:
        t = min(c["t1"] - 0.2, max(c["t0"] + 0.8, (c["t0"] + c["t1"]) / 2))
        raw = frame(video, t)
        if len(raw) < W * H * 3:
            fails.append(f"{c['module']}: no frame at {t:.2f}")
            continue
        x0, y0, w, h = (int(round(v)) for v in c["rect"])
        w = min(w, 360)
        dark = light = n = 0
        for y in range(max(0, y0 + 3), min(H, y0 + h - 3)):
            for x in range(max(0, x0 + 4), min(W, x0 + w - 4), 2):
                r, g, b = px(raw, x, y)
                lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
                n += 1
                dark += lum < 120
                light += lum > 215
        checked += 1
        if not n or dark / n < 0.015 or light / n < 0.25:
            fails.append(f"{c['module']} @{t:.1f}s: credit strip not drawn (dark {dark}/{n}, light {light}/{n})")
    gate("credits_visible", not fails, fails or f"{checked} credit runs drawn", "credit chip/line visible mid-run for every fetched image", repair="render")

    # ---- graphics coverage: a non-media graphic is on screen at every second (1.5 s grace after a cut) ----
    bad, cov, media_s, n = [], 0, 0, 0
    k = 0.5
    while k < total - 0.3:
        s, vis = lf_visible(spec, k)
        n += 1
        if s is not None:
            graphic = [m for m in vis if m["type"] not in LF_MEDIA and m["type"] not in LF_CHROME]
            if graphic or s.get("template") == "lfEnd":
                cov += 1
            elif k - s["t0"] > 1.5:
                bad.append(f"{s['id']} @{k:.1f}s")
            else:
                cov += 1
            if any(media_ok(m) for m in vis):
                media_s += 1
        k += 1.0
    gate("graphics_coverage", not bad, f"{100 * cov / max(1, n):.0f}% of sampled seconds" if not bad else bad[:6], "a non-media graphic on screen every second (<= 1.5 s after a cut)", repair="storyboard")
    gate("media_share_pct", 40 <= 100 * media_s / max(1, n) <= 70, round(100 * media_s / max(1, n), 1), "40-70 (real media visible ~50-65 %)", hard=False)

    # ---- each photo run >= 2.5 s ----
    short = []
    runs = {}
    for s in spec["scaffolds"]:
        for m in s["modules"]:
            if media_ok(m):
                r = runs.get(m["id"])
                if r and abs(r[1] - s["t0"]) < 1e-6:
                    r[1] = s["t1"]
                else:
                    runs[m["id"]] = [s["t0"] + (m.get("at") or 0), s["t1"]]
                    if r and r[1] - r[0] < 2.5:
                        short.append(f"{m['id']} {r[1] - r[0]:.1f}s")
    short += [f"{k2} {r[1] - r[0]:.1f}s" for k2, r in runs.items() if r[1] - r[0] < 2.5]
    gate("photo_hold_min_s", not short, short or "all >= 2.5 s", ">= 2.5 s per photo run", hard=False)

    # ---- no empty frames (plan §3): no placeholder media on screen, no flat media rect ----
    ph = placeholders(spec)
    gate("no_placeholders", not ph, ph[:6] or "no placeholder media", "no module draws the grey no-image placeholder (media gate must rewrite the scene)", repair="storyboard")
    blank = blank_media(video, spec)
    gate("blank_media", not blank, blank[:6] or "every media rect has content", f"media rect <= {int(BLANK_FLAT * 100)}% one flat colour at each scene's mid-time", repair="storyboard")


BLANK_FLAT = 0.85


def has_placeholder(v):
    if isinstance(v, list):
        return any(has_placeholder(x) for x in v)
    if isinstance(v, dict):
        return bool(v.get("placeholder")) or any(has_placeholder(x) for k, x in v.items() if isinstance(x, (dict, list)))
    return False


def placeholders(spec):
    """modules whose props (or nested media objects) compile marked as placeholder (no usable file)"""
    out = []
    for s in spec["scaffolds"]:
        if s["t1"] - s["t0"] <= 0:
            continue
        for m in s["modules"]:
            if has_placeholder(m.get("props") or {}):
                out.append(f"{s['id']}/{m['id']} @{s['t0']:.1f}s")
    return out


def flat_fraction(raw, rect, step=4):
    """share of sampled pixels in the rect's most common colour (16 levels per channel)"""
    x0, y0, w, h = (int(round(v)) for v in rect)
    bins, n = {}, 0
    for y in range(max(0, y0 + 4), min(H, y0 + h - 4), step):
        for x in range(max(0, x0 + 4), min(W, x0 + w - 4), step):
            r, g, b = px(raw, x, y)
            k = (r >> 4, g >> 4, b >> 4)
            bins[k] = bins.get(k, 0) + 1
            n += 1
    return (max(bins.values()) / n) if n else 0.0


def blank_media(video, spec):
    """one frame per scene at mid-time: a media module whose rect is > BLANK_FLAT one flat colour fails"""
    out = []
    for s in spec["scaffolds"]:
        mods = [m for m in s["modules"] if m["type"] in LF_MEDIA and m["type"] != "mapCard" and (media_ok(m) or (m.get("props") or {}).get("namecard"))
                and (m.get("props") or {}).get("kind") != "map" and m.get("rect") and m["rect"][2] >= 120 and m["rect"][3] >= 120]
        if not mods or s["t1"] - s["t0"] < 0.5:
            continue
        raw = None
        for m in mods:
            t = min(s["t1"] - 0.1, max((s["t0"] + s["t1"]) / 2, s["t0"] + (m.get("at") or 0) + 0.8))
            raw = frame(video, t)
            if len(raw) < W * H * 3:
                out.append(f"{s['id']}/{m['id']}: no frame at {t:.2f}")
                continue
            f = flat_fraction(raw, m["rect"])
            if f > BLANK_FLAT:
                out.append(f"{s['id']}/{m['id']} @{t:.1f}s: media rect {100 * f:.0f}% one flat colour")
    return out


if __name__ == "__main__":
    main()
