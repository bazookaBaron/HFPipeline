#!/usr/bin/env python3
"""
v3 hard QA gates -- measured on OUR output exactly (spec timeline + delivered mp4), never on a
video detector. Bands come from analysis/pacing-audit-20260924/design/SPEC.md (refs R1/R2 for DH).

  python v3_gates.py --video out.mp4 --timeline out.mp4.timeline.json [--metrics out.mp4.metrics.json]
prints one JSON object {ok, gates:[{name, ok, value, band, hard}], repair:[...]} and exits 1 if a
hard gate fails. `repair` names the stage that must redo work (storyboard / audio / render).
"""
import argparse, json, subprocess, sys, statistics

LC = {
    "beats_per_min": (45, 95),       # R3 69.6, R4 50.9
    "max_visual_gap_s": 4.5,         # R3 4.0; R4 holds to 8.3 s only with a live packet loop
    "scaffold_life_median_s": (2.5, 7.0),  # R3 4.2, R4 5.0
    "wpm": (176, 225),
    "lufs": (-14.4, -13.8),
    "lra_max": 1.6,
    "tp_max": -0.9,
}
DC = {
    "beats_per_min": (55, 100),      # R5 73.5
    "max_visual_gap_s": 3.2,         # R5 2.73 (0 gaps > 3 s)
    "scaffold_life_median_s": (1.6, 5.0),  # R5 sub-states mean 2.6 s, scaffolds median 3.3 s
    "wpm": (170, 225),               # R5 176
    "lufs": (-14.4, -13.8),
    "lra_max": 1.6,
    "tp_max": -0.9,
}
DH = {
    "beats_per_min": (50, 100),      # R1 79.7-93.3, R2 67-72.9 (visual beats incl. cuts/entrances/events)
    "max_visual_gap_s": 3.8,         # R1 3.83 (every longer hold has motion), R2 3.12
    "scaffold_life_median_s": (2.0, 8.4),  # R1 3.4 (scaffold every 3.4 s), R2 layout life median 8.4
    "wpm": (176, 225),               # refs 176-221
    "lufs": (-14.4, -13.8),          # refs -14.1..-14.2
    "lra_max": 1.6,                  # refs 1.0-1.4; AAC re-measure variance allowance
    "tp_max": -0.9,                  # refs -0.5..-1.1 dBTP
}


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


def frame(video, t):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-ss", f"{t:.3f}", "-i", video, "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
                         capture_output=True).stdout
    return raw  # 1080*1920*3


def px(raw, x, y):
    i = (y * 1080 + x) * 3
    return raw[i], raw[i + 1], raw[i + 2]


def near(c, ref, tol):
    return all(abs(a - b) <= tol for a, b in zip(c, ref))


def caption_rows(raw):
    """rows (y) that contain a >=160 px run of near-white pixels in the caption band 1380-1560"""
    rows = []
    for y in range(1380, 1560):
        run = best = 0
        base = y * 1080 * 3
        for x in range(0, 1080):
            i = base + x * 3
            if raw[i] > 225 and raw[i + 1] > 225 and raw[i + 2] > 225:
                run += 1
                best = max(best, run)
            else:
                run = 0
        if best >= 160:
            rows.append(y)
    return rows


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--video", required=True)
    ap.add_argument("--timeline", required=True)
    ap.add_argument("--metrics")
    a = ap.parse_args()
    tl = json.load(open(a.timeline, encoding="utf-8"))
    spec, timeline = tl["spec"], tl["timeline"]
    profile = spec.get("profile", "DH")
    B = LC if profile == "LC" else DC if profile == "DC" else DH
    total = timeline["totalSeconds"]
    gates = []

    def gate(name, ok, value, band, hard=True, repair=None):
        gates.append({"name": name, "ok": bool(ok), "value": value, "band": band, "hard": hard, "repair": repair})

    # ---- cadence (exact, from the compiled spec) ----
    beats = beats_from_spec(spec)
    bpm = len(beats) / total * 60
    gaps = [b - a for a, b in zip([0.0] + beats, beats + [total])]
    lives = [s["t1"] - s["t0"] for s in spec["scaffolds"]]
    gate("beats_per_min", B["beats_per_min"][0] <= bpm <= B["beats_per_min"][1], round(bpm, 1), B["beats_per_min"], repair="storyboard")
    gate("max_visual_gap_s", max(gaps) <= B["max_visual_gap_s"], round(max(gaps), 2), f"<= {B['max_visual_gap_s']}", repair="storyboard")
    med = statistics.median(lives)
    gate("scaffold_life_median_s", B["scaffold_life_median_s"][0] <= med <= B["scaffold_life_median_s"][1], round(med, 2), B["scaffold_life_median_s"], repair="storyboard")
    first = [b for b in beats if b <= 1.0]
    gate("hook_beats_first_1s", len(first) >= 2, len(first), ">= 2 (refs >= 3)", hard=False)

    # ---- pace ----
    wpm = len(timeline["words"]) / total * 60
    gate("delivered_wpm", B["wpm"][0] <= wpm <= B["wpm"][1], round(wpm, 1), B["wpm"], repair="audio")

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

    # ---- frame geometry at each scaffold's midpoint ----
    geo_fail = []
    for s in spec["scaffolds"]:
        t = (s["t0"] + s["t1"]) / 2
        raw = frame(a.video, t)
        if len(raw) < 1080 * 1920 * 3:
            geo_fail.append(f"{s['id']}: no frame at {t:.2f}")
            continue
        bgc = (0xF4, 0xF4, 0xED) if profile == "LC" else (0x09, 0x0A, 0x0D) if profile == "DC" else (0, 0, 0)
        if not near(px(raw, 4, 4), bgc, 6) or not near(px(raw, 4, 1915), bgc, 6):
            geo_fail.append(f"{s['id']}: background {px(raw, 4, 4)} at corners, want {bgc}")
        if profile == "DC":
            continue  # quiet chip caption: no bright border to scan; bg checked above
        if profile == "LC":
            # paper caption (R4): box y 1452-1545; find the box edges from the fill vs the page
            col = [px(raw, 540, y) for y in range(1400, 1600)]
            box = [1400 + i for i, c in enumerate(col) if c[0] > 0xFB and c[1] > 0xF9 and c[2] > 0xF4]
            if box and not (1449 <= box[0] <= 1456 and 1540 <= box[-1] <= 1549):
                geo_fail.append(f"{s['id']}: LC caption box y {box[0]}-{box[-1]}, want 1452-1545")
            continue
        if any(m["id"] == "hud" for m in s["modules"]):
            if not near(px(raw, 72, 270), (9, 13, 17), 8):
                geo_fail.append(f"{s['id']}: HUD fill {px(raw, 72, 270)} at (72,270), want #090d11")
        rows = caption_rows(raw)
        if rows:
            top, bot = rows[0], rows[-1]
            if not (1413 <= top <= 1419):
                geo_fail.append(f"{s['id']}: caption top border y {top}, want 1416+-3")
            if not (1526 <= bot <= 1536):
                geo_fail.append(f"{s['id']}: caption bottom border y {bot}, want ~1531")
    gate("frame_geometry", not geo_fail, geo_fail or "all scaffolds", "DH: bg #000, HUD #090d11 @y235-305, caption y1416-1532; LC: bg #F4F4ED, caption y1452-1545", repair="render")

    hard_fail = [g for g in gates if g["hard"] and not g["ok"]]
    out = {"ok": not hard_fail, "gates": gates, "repair": sorted(set(g["repair"] for g in hard_fail if g["repair"]))}
    print(json.dumps(out, indent=1))
    sys.exit(0 if out["ok"] else 1)


if __name__ == "__main__":
    main()
