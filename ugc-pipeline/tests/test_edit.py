"""Edit-stage tests. They really assemble reels with ffmpeg and headless Chrome (no network)."""
from __future__ import annotations
import array
import copy
import json
import random
import shutil
import subprocess
import tempfile
import unittest
import wave
from pathlib import Path
from unittest import mock

from ugc.contract import ROOT, Broll, Clip, Line, Project, Reel, load_config
from ugc.edit import assemble, audit, captions, render, timeline
from ugc.edit.errors import EditError, FailedSelectError, OverlayError, TimelineError

VOCAB = "morning coffee changed everything honestly really love simple routine every single day quickly better sleep".split()
TMP: Path
WORDS: dict[str, tuple[array.array, int]] = {}
SIZES = {"c1": (640, 1152), "c2": (928, 1664), "c3": (736, 1312)}


def sh(*cmd: str) -> None:
    subprocess.run(cmd, check=True, capture_output=True, stdin=subprocess.DEVNULL)


def say_word(w: str) -> array.array:
    if w not in WORDS:
        f = TMP / f"w_{w}.wav"
        sh("say", "-r", "230", "-o", str(f), "--data-format=LEI16@48000", w)
        with wave.open(str(f)) as r:
            a = array.array("h")
            a.frombytes(r.readframes(r.getnframes()))
        WORDS[w] = (a, 48000)
    return WORDS[w][0]


def make_audio(path: Path, length: float, lead: float, n_words: int, rng: random.Random) -> list[dict]:
    """Speech from `say`, one word at a time with known timings, on a low noise floor."""
    sr = 48000
    buf = array.array("h", [int(rng.gauss(0, 14)) for _ in range(int(length * sr))])
    t, out = lead, []
    for k in range(n_words):
        w = rng.choice(VOCAB)
        a = say_word(w)
        s0 = int(t * sr)
        if s0 + len(a) >= len(buf):
            break
        for i, x in enumerate(a):
            buf[s0 + i] = max(-32768, min(32767, buf[s0 + i] + x))
        out.append({"w": w + ("." if k % 6 == 5 else ""), "s": round(t, 3), "e": round(t + len(a) / sr, 3)})
        t += len(a) / sr + (0.32 if k % 6 == 5 else 0.07)
    with wave.open(str(path), "wb") as o:
        o.setnchannels(1)
        o.setsampwidth(2)
        o.setframerate(sr)
        o.writeframes(buf.tobytes())
    return out


def make_clip(project: Project, clip: str, take: int, size: tuple[int, int], seconds: float, lead: float, n_words: int, seed: int, hue: int = 0) -> list[dict]:
    rng = random.Random(seed)
    wav = TMP / f"{clip}.wav"
    words = make_audio(wav, seconds, lead, n_words, rng)
    out = project.p("takes", f"{clip}_t{take}.mp4")
    frames = round(seconds * 24)
    sh("ffmpeg", "-y", "-v", "error", "-f", "lavfi", "-i", f"testsrc2=size={size[0]}x{size[1]}:rate=24", "-i", str(wav),
       "-vf", f"hue=h={hue}", "-frames:v", str(frames), "-c:v", "libx264", "-crf", "18", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "128k", "-shortest", str(out))
    project.p("checks", f"{clip}_t{take}.words.json").write_text(json.dumps(words), encoding="utf8")
    return words


def make_broll(project: Project, name: str, size: tuple[int, int], seconds: float) -> str:
    out = project.p("broll", name)
    src = "testsrc2" if size[0] < size[1] else "testsrc"
    sh("ffmpeg", "-y", "-v", "error", "-f", "lavfi", "-i", f"{src}=size={size[0]}x{size[1]}:rate=30", "-t", str(seconds), "-c:v", "libx264", "-pix_fmt", "yuv420p", str(out))
    return f"broll/{name}"


def make_project(name: str, n_clips: int, seconds: float, n_words: int, lead: float = 0.5, selects_passed=True) -> tuple[Project, list[Clip]]:
    p = Project(TMP / name)
    p.p("brief.json").write_text(json.dumps({"brand": "Acme & Co", "url": "acme.example/try?a=1&b=2", "cta": "Try Acme free"}), encoding="utf8")
    clips, sel = [], {}
    for i in range(1, n_clips + 1):
        cid = f"r01c{i}"
        make_clip(p, cid, 1, SIZES[f"c{i}"], seconds, lead + 0.1 * i, n_words, seed=i, hue=40 * i)
        clips.append(Clip(cid, "r01", i, [Line(f'Line {i}: "quoted" & <b>bold</b> {chr(0x1F600)} supercalifragilisticexpialidocious' if i == 1 else f"Spoken line {i} about the product")],
                          "waves", "close", "kitchen", i))
        sel[cid] = {"take": 1, "passed": bool(selects_passed)}
    (p.path / "selects.json").write_text(json.dumps(sel), encoding="utf8")
    return p, clips


def short_cfg(seconds: float) -> dict:
    c = copy.deepcopy(CFG)
    c["reel"]["seconds"] = seconds
    return c


CFG = load_config()
FPS = CFG["reel"]["fps"]
SHORT: dict = {}
FULL: dict = {}


def setUpModule() -> None:
    global TMP
    TMP = Path(tempfile.mkdtemp(prefix="ugc-edit-test-"))


def tearDownModule() -> None:
    shutil.rmtree(TMP, ignore_errors=True)


def spans_from(words_by_clip: dict[str, list[dict]], length: float) -> list[timeline.Span]:
    return [timeline.Span(k, length, w[0]["s"], max(x["e"] for x in w)) for k, w in words_by_clip.items()]


class TimelineTests(unittest.TestCase):
    def check(self, plan: timeline.Plan, spans, secs=40.0):
        self.assertEqual(plan.total, round(secs * FPS))
        end = 0
        for sl, sp in zip(plan.slots, spans):
            self.assertLessEqual(sl.a, sp.first)
            self.assertGreaterEqual(sl.b, sp.last)             # no word cut
            self.assertGreaterEqual(sl.speed, 0.95)
            self.assertLessEqual(sl.speed, 1.05)
            self.assertGreaterEqual(sl.start, end)
            end = sl.start + sl.frames
            self.assertLess(sl.cover_head + sl.cover_tail, sl.frames)
            if sl.a > 0 and sp.first - sl.a < 0.15 - 1e-9:
                self.fail("lead handle under 0.15 s")
            self.assertGreaterEqual(sl.a, 0.0)
            self.assertLessEqual(sl.b, sp.length + 1e-6)
        self.assertEqual(plan.end_start + plan.end_frames, plan.total)
        self.assertGreaterEqual(plan.end_frames / FPS, 2.0 - 0.05)
        self.assertLessEqual(plan.end_frames / FPS, 4.0 + 0.05)
        for c in plan.cuts:
            self.assertEqual(c.frames, c.cover + c.tail)
            if c.card:
                self.assertEqual(c.cover, 0)
                self.assertLessEqual(c.frames / FPS, 3.0 + 1 / FPS)
            self.assertLessEqual(c.start + c.frames, plan.end_start)

    def spans(self, speech: float, n: int = 3, first: float = 0.5, length: float = 10.125):
        return [timeline.Span(f"c{i}", length, first, first + speech) for i in range(n)]

    def test_typical_reel_fills_exactly(self):
        sp = [timeline.Span("a", 10.125, 0.4, 8.0), timeline.Span("b", 10.125, 0.6, 8.6), timeline.Span("c", 10.125, 0.5, 8.9)]
        p = timeline.plan("r01", sp, [timeline.Cut(1, 3.3), timeline.Cut(2, 3.4), timeline.Cut(3, 3.3)], 40.0, FPS)
        self.check(p, sp)

    def test_short_speech_fills_from_raw_footage(self):
        sp = self.spans(5.0)
        p = timeline.plan("r05", sp, [timeline.Cut(1, 3.3), timeline.Cut(2, 3.4), timeline.Cut(3, 3.3)], 40.0, FPS)
        self.check(p, sp)
        self.assertEqual(p.auto, [])
        self.assertTrue(any(s.b - s.a > 5.0 + 1.2 for s in p.slots))      # handles grew past 0.6 s

    def test_footage_limits_tails_so_nothing_loops(self):
        sp = self.spans(5.0)
        cuts = [timeline.Cut(k, 3.3, avail=3.3) for k in (1, 2, 3)]
        p = timeline.plan("r06", sp, cuts, 40.0, FPS)
        self.check(p, sp)
        for c in p.cuts:
            self.assertLessEqual(c.frames / FPS, 3.3 + 0.6)

    def test_no_broll_uses_text_cards(self):
        sp = self.spans(7.5)
        p = timeline.plan("r07", sp, [], 40.0, FPS)
        self.check(p, sp)
        self.assertTrue(p.auto)
        self.assertEqual({c.after for c in p.cuts}, set(p.auto))
        self.assertTrue(all(c.after < 3 for c in p.cuts))

    def test_missing_footage_cards_are_short_and_never_over_the_voice(self):
        sp = self.spans(8.0)
        cuts = [timeline.Cut(0, 2.0, None, card=True), timeline.Cut(2, 8.0, None, card=True)]
        p = timeline.plan("r11", sp, cuts, 40.0, FPS)
        self.check(p, sp)
        self.assertEqual(p.dropped, [0])
        self.assertTrue(p.cuts and all(c.card and c.cover == 0 for c in p.cuts))
        self.assertTrue(all(c.frames / FPS <= 3.0 + 1 / FPS for c in p.cuts))
        self.assertEqual(len({c.after for c in p.cuts}), len(p.cuts))
        self.assertTrue(all(c.after < 3 for c in p.cuts))                  # none after the last clip: the end card follows it
        self.assertTrue(all(s.cover_head == 0 and s.cover_tail == 0 for s in p.slots))

    def test_three_full_clips_reach_40s_with_short_cards(self):
        sp = [timeline.Span(f"c{i}", 10.125, 0.4, 7.5) for i in range(3)]
        p = timeline.plan("r12", sp, [], 40.0, FPS)
        self.check(p, sp)
        self.assertTrue(all(c.frames / FPS <= 3.0 + 1 / FPS for c in p.cuts))

    def test_too_little_material_says_what_to_add(self):
        with self.assertRaisesRegex(TimelineError, r"reel r13: [\d.]+ s under.*fourth clip"):
            timeline.plan("r13", self.spans(5.0, n=2, length=6.0), [], 40.0, FPS)

    def test_overfull_speech_with_broll_fits(self):
        sp = self.spans(9.6)
        cuts = [timeline.Cut(0, 2.0), timeline.Cut(1, 3.3), timeline.Cut(2, 3.4), timeline.Cut(3, 3.3)]
        p = timeline.plan("r08", sp, cuts, 40.0, FPS)
        self.check(p, sp)
        self.assertEqual(p.auto, [])

    def test_random_layouts_property(self):
        rng = random.Random(7)
        ok = err = 0
        for _ in range(600):
            n = rng.choice([2, 3, 3, 3, 4])
            sp = []
            for k in range(n):
                length = rng.uniform(8.0, 10.5)
                speech = rng.uniform(4.5, 9.8)
                first = rng.uniform(0.05, max(0.06, min(1.5, length - speech - 0.05)))
                sp.append(timeline.Span(f"c{k}", length, first, min(first + speech, length - 0.03)))
            cuts = [timeline.Cut(k, rng.uniform(1.5, 5.0), rng.choice([None, None, 6.0, 12.0]), card=rng.random() < 0.3) for k in rng.sample(range(0, n + 1), rng.randint(0, n + 1))]
            secs = rng.choice([40.0, 40.0, 40.0, 30.0, 25.0, 45.0])
            try:
                p = timeline.plan("rx", sp, cuts, secs, FPS)
            except TimelineError as e:
                err += 1
                self.assertIn("rx", str(e))
                self.assertRegex(str(e), r"[\d.]+ s (over|under)")
                continue
            ok += 1
            self.check(p, sp, secs)
        self.assertGreater(ok, 300)

    def test_error_names_reel_and_seconds(self):
        sp = [timeline.Span("a", 10.0, 0.5, 5.0)]
        with self.assertRaisesRegex(TimelineError, r"reel r09: [\d.]+ s under"):
            timeline.plan("r09", sp, [timeline.Cut(1, 3.0)], 80.0, FPS)
        sp = [timeline.Span(f"c{i}", 10.1, 0.1, 10.0) for i in range(4)]
        with self.assertRaisesRegex(TimelineError, r"reel r10: [\d.]+ s over"):
            timeline.plan("r10", sp, [timeline.Cut(1, 5.0)], 20.0, FPS)


class CaptionTests(unittest.TestCase):
    def words(self, n, dur=0.3, gap=0.05):
        t, out = 1.0, []
        for k in range(n):
            out.append({"w": f"w{k}", "s": t, "e": t + dur})
            t += dur + gap
        return out

    def test_chunks_are_2_to_4_words_and_readable(self):
        for n in (2, 5, 7, 10, 21, 22):
            cs = captions.chunks(self.words(n))
            self.assertEqual(sum(len(c.words) for c in cs), n)
            for c in cs:
                self.assertTrue(2 <= len(c.words) <= 4, (n, c.words))
                self.assertGreaterEqual(c.end - c.start, 0.35 - 1e-9)

    def test_no_chunk_spans_a_sentence_end(self):
        w = self.words(9)
        w[2]["w"] = "quickly."
        w[3]["w"] = "sleep,"
        w[4]["w"] = "well?"
        cs = captions.chunks(w)
        for c in cs:
            self.assertFalse(any(x[-1] in ".?!" for x in c.words[:-1]), c.words)
        self.assertEqual(cs[0].words[-1], "quickly.")
        self.assertEqual([c.words for c in cs if "sleep" in c.words][0], ("sleep", "well?"))   # trailing comma dropped
        one = captions.chunks([{"w": "Yes.", "s": 1.0, "e": 1.3}, {"w": "Really", "s": 1.8, "e": 2.1}, {"w": "good", "s": 2.15, "e": 2.4}])
        self.assertEqual([len(c.words) for c in one], [1, 2])
        self.assertGreaterEqual(one[0].end - one[0].start, 0.35 - 1e-9)
        for a, b in zip(one, one[1:]):
            self.assertLessEqual(a.end, b.start + 1e-9)

    def test_fast_speech_stays_readable(self):
        for c in captions.chunks(self.words(8, dur=0.08, gap=0.02)):
            self.assertGreaterEqual(c.end - c.start, 0.35 - 1e-9)


class RenderTests(unittest.TestCase):
    def test_hostile_text_is_escaped_and_inside_safe_area(self):
        g = render.geometry(CFG)
        texts = [('say "hi" & <b>bye</b>', "it's", "x" * 60, f"{chr(0x1F600)} ok", "AT&T", "</script>"),
                 tuple(["supercalifragilisticexpialidocious"] * 2) + ("a", "b"),
                 ("Ünïcödé", "日本語", "mixed", "\x00ctrl\x07")]
        specs = [render.Spec("caption", g.w, g.cap_h, words=t, active=min(1, len(t) - 1)) for t in texts]
        out = render.overlays(specs, TMP / "ov_hostile")
        x0, y0, x1, y1 = g.safe
        for s, png in out.items():
            b = render.meta(png)["box"]
            self.assertGreaterEqual(b[0], x0 - 1, s.words)
            self.assertLessEqual(b[2], x1 + 1, s.words)
            self.assertGreaterEqual(b[1] + g.cap_y, y0 - 1)
            self.assertLessEqual(b[3] + g.cap_y, y1 + 1)
        html = render.build_html(specs[0])
        self.assertNotIn("<b>bye</b>", html)
        self.assertIn("&lt;b&gt;bye&lt;/b&gt;", html)
        self.assertNotIn("\x00", render.build_html(specs[2]))

    def test_cache_by_content(self):
        g = render.geometry(CFG)
        s = render.label_spec(CFG)
        d = TMP / "ov_cache"
        a = render.overlays([s], d)[s]
        m = a.stat().st_mtime_ns
        b = render.overlays([s, s], d)[s]
        self.assertEqual((a, m), (b, b.stat().st_mtime_ns))
        self.assertEqual(g.label_y, round(0.14 * 1920))

    def test_empty_label_is_an_error(self):
        s = render.Spec("label", 908, 86, text="")
        with self.assertRaises(OverlayError):
            render.overlays([s], TMP / "ov_empty")


class AssembleTests(unittest.TestCase):
    def build_short(self):
        if "p" not in SHORT:
            p, clips = make_project("short", 2, 5.0, 8)
            br = make_broll(p, "land.mp4", (1280, 720), 4.0)
            reel = Reel("r01", "Short", 'Hook "quoted" & more', clips, [Broll(1, 3.0, br, "landscape")], 'Try it "now" & <save>')
            SHORT.update(p=p, reel=reel, cfg=short_cfg(12.0))
        return SHORT["p"], SHORT["reel"], SHORT["cfg"]

    def test_short_reel_with_failed_select_refused_then_allowed(self):
        p, reel, cfg = self.build_short()
        (p.path / "final" / "r01.mp4").unlink(missing_ok=True)
        sel = json.loads((p.path / "selects.json").read_text())
        sel["r01c2"]["passed"] = False
        (p.path / "selects.json").write_text(json.dumps(sel))
        with self.assertRaises(FailedSelectError) as cm:
            assemble.reel(p, cfg, reel)
        self.assertIn("r01c2", str(cm.exception))
        self.assertFalse((p.path / "final" / "r01.mp4").exists())
        out = assemble.reel(p, cfg, reel, allow={"r01c2"})
        self.assertEqual(audit.final(out, cfg), [])
        man = json.loads((p.path / "final" / "r01.edit.json").read_text())
        self.assertTrue(man["slots"][1]["overridden"])
        self.assertEqual(man["missing_broll"], [])
        self.assertEqual(man["frames"], round(12 * FPS))

    def test_missing_broll_holds_a_card_and_is_reported(self):
        p, clips = make_project("missing", 2, 5.0, 8)
        reel = Reel("r02", "Missing", "Hook line", clips, [Broll(1, 3.0, "", "screen recording of the dashboard"), Broll(2, 2.0, "broll/nope.mp4", "")], "Buy now")
        cfg = short_cfg(14.0)
        with self.assertLogs("ugc.edit", level="WARNING") as lg:
            out = assemble.reel(p, cfg, reel)
        self.assertEqual(audit.final(out, cfg), [])
        man = json.loads((p.path / "final" / "r02.edit.json").read_text())
        self.assertEqual([m["after_clip"] for m in man["missing_broll"]], [1, 2])
        self.assertEqual(man["missing_broll"][0]["note"], "screen recording of the dashboard")
        self.assertTrue(any("missing" in m for m in lg.output))

    def test_no_broll_at_all_fills_with_text_cards(self):
        p, clips = make_project("nobroll", 2, 5.0, 8)
        reel = Reel("r03", "Plain", "Hook line", clips, [], "Buy now")
        cfg = short_cfg(16.0)
        with self.assertLogs("ugc.edit", level="WARNING") as lg:
            out = assemble.reel(p, cfg, reel)
        self.assertEqual(audit.final(out, cfg), [])
        man = json.loads((p.path / "final" / "r03.edit.json").read_text())
        self.assertTrue(man["cards"])
        self.assertEqual(man["frames"], round(16 * FPS))
        self.assertTrue(any("text cards" in m for m in lg.output))

    def test_label_failure_stops_assembly(self):
        p, reel, cfg = self.build_short()
        bad = copy.deepcopy(cfg)
        bad["reel"]["label"] = ""
        with self.assertRaises(EditError):
            assemble.reel(p, bad, reel, allow={"r01c2"})

    def test_audit_catches_missing_label(self):
        p, reel, cfg = self.build_short()
        good = assemble.reel(p, cfg, reel, allow={"r01c2"})
        g = render.geometry(cfg)
        bare = TMP / "nolabel.mp4"
        sh("ffmpeg", "-y", "-v", "error", "-i", str(good), "-vf", f"drawbox=x={g.label_x - 4}:y={g.label_y - 4}:w={g.label_w}:h={g.label_h + 8}:color=0x335577:t=fill",
           "-c:v", "libx264", "-preset", "veryfast", "-crf", "16", "-profile:v", "high", "-pix_fmt", "yuv420p", "-c:a", "copy", "-movflags", "+faststart", str(bare))
        shutil.copy(p.path / "final" / "r01.edit.json", TMP / "nolabel.edit.json")
        problems = audit.final(bare, cfg)
        self.assertTrue(any("label" in x for x in problems), problems)

    def test_audit_catches_wrong_format(self):
        p, reel, cfg = self.build_short()
        bad = TMP / "bad.mp4"
        sh("ffmpeg", "-y", "-v", "error", "-f", "lavfi", "-i", "testsrc2=size=640x360:rate=25:duration=3", "-an", "-c:v", "libx264", str(bad))
        problems = " | ".join(audit.final(bad, cfg))
        for word in ("size", "fps", "duration", "no audio"):
            self.assertIn(word, problems)

    def gray(self, f: Path, t: float) -> bytes:
        r = subprocess.run(["ffmpeg", "-v", "error", "-nostdin", "-ss", f"{max(t, 0):.3f}", "-i", str(f), "-frames:v", "1", "-vf", "scale=270:480", "-f", "rawvideo", "-pix_fmt", "gray", "-"],
                           capture_output=True, check=True)
        return r.stdout

    def test_missing_footage_layout_is_a_watchable_video(self):
        p, clips = make_project("nofoot", 3, 243 / 24, 20)
        reel = Reel("r04", "Tidy worktop", "Hook about a tidy worktop", clips, [Broll(0, 2.0, "", "opening"), Broll(2, 8.0, "", "demo")], "Try Acme free today",
                    claims=["c1"])
        (p.path / "brief.json").write_text(json.dumps({"brand": "Acme", "url": "acme.example", "cta": "Try", "claims": [{"id": "c1", "text": "Wipes clean in one pass, every single time"}]}))
        out = assemble.reel(p, CFG, reel)
        self.assertEqual(audit.final(out, CFG), [])
        man = json.loads((p.path / "final" / "r04.edit.json").read_text())
        self.assertEqual(man["frames"], round(40 * FPS))
        self.assertTrue(man["cards"])
        for c in man["cards"]:
            self.assertLessEqual(c["end"] - c["start"], 3.2)
            self.assertLessEqual(len(c["text"].split()), 13)
            for sx in man["caption_states"]:                      # captions never overlap a card
                self.assertFalse(sx["start"] < c["end"] - 0.05 and sx["end"] > c["start"] + 0.05, (c, sx["text"]))
        self.assertEqual(len({c["text"] for c in man["cards"]}), len(man["cards"]))
        self.assertEqual(sorted(m["after_clip"] for m in man["missing_broll"] if "added" not in m["reason"]), [0, 2])
        # decoded pixels: the first second is the presenter (busy picture), the card is a quiet gradient with text above 55% of the height
        import statistics
        first = self.gray(out, 0.5)
        c0 = man["cards"][0]
        card = self.gray(out, (c0["start"] + c0["end"]) / 2)
        self.assertGreater(statistics.pstdev(first), 40)
        self.assertLess(statistics.pstdev(card), 35)
        w, h = 270, 480
        lower = [card[y * w + x] for y in range(int(h * 0.57), h) for x in range(w)]
        self.assertLess(sum(1 for v in lower if v > 200), 20)       # no text in the caption band or below
        upper = [card[y * w + x] for y in range(int(h * 0.2), int(h * 0.55)) for x in range(w)]
        self.assertGreater(sum(1 for v in upper if v > 200), 50)      # the card does carry text up there

    def test_audit_flags_long_cards_and_captions_over_cards(self):
        p, reel, cfg = self.build_short()
        good = assemble.reel(p, cfg, reel, allow={"r01c2"})
        man = json.loads((p.path / "final" / "r01.edit.json").read_text())
        st = man["caption_states"][0]
        man["cards"] = [{"after": 1, "start": 1.0, "end": 5.0, "text": "x"}, {"after": 1, "start": st["start"], "end": st["end"], "text": "y"}]
        bad = TMP / "cards.edit.json"
        bad.write_text(json.dumps(man))
        problems = " | ".join(audit.final(good, cfg, manifest=bad))
        self.assertIn("text card after clip 1 is on screen 4.0 s", problems)
        self.assertIn("shown over a card", problems)

    def test_full_40s_reel(self):
        p, clips = make_project("full", 3, 243 / 24, 20)
        b1 = make_broll(p, "portrait.mp4", (720, 1280), 3.0)
        b2 = make_broll(p, "screen.mp4", (1920, 1080), 3.0)
        reel = Reel("r01", "Full", 'Hook with "quotes" & <tags>', clips, [Broll(0, 2.0, b1), Broll(1, 3.4, b2), Broll(3, 3.3, "")], "Try Acme free today")
        import time
        t0 = time.time()
        out = assemble.reel(p, CFG, reel)
        took = time.time() - t0
        print(f"\nfull 40 s reel assembled in {took:.1f} s")
        self.assertEqual(audit.final(out, CFG), [])
        man = json.loads((p.path / "final" / "r01.edit.json").read_text())
        self.assertEqual(man["frames"], round(40 * FPS))
        self.assertEqual([m["after_clip"] for m in man["missing_broll"] if "added" not in m["reason"]], [3])
        for s in man["slots"]:
            self.assertTrue(0.95 <= s["speed"] <= 1.05)
        sheet = ROOT / "build" / "edit_sheet.png"
        sheet.parent.mkdir(exist_ok=True)
        sh("ffmpeg", "-y", "-v", "error", "-i", str(out), "-vf", "fps=1/2.2,scale=270:480,tile=10x2:padding=4:color=0x222222", "-frames:v", "1", "-update", "1", str(sheet))
        self.assertTrue(sheet.exists())


if __name__ == "__main__":
    unittest.main()
