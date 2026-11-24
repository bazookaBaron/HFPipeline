import json
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path

from ugc.checks import align, gates, media, native
from ugc.checks.wer import normalise, wer
from ugc.contract import Broll, Check, Clip, Line, Project, Reel, Take, load_config

CFG = load_config()
BRIEF = {"brand": "Pebblenook", "language": "English", "pronounce": {"Pebblenook": "pebble nook"}}
TEXT = "Fresh herbs make small kitchens feel alive, and growing them on a sunny windowsill takes very little effort at all."
OTHER = "Quarterly shipping schedules changed across several regions, so every warehouse manager received revised pallet instructions yesterday."
GOOD_FACES = {"sheet_faces": 1, "frames": [{"faces": 1, "distance": 0.3, "drift": 0.1}] * 20}


def ff(*args: str) -> None:
    r = subprocess.run(["ffmpeg", "-v", "error", "-y", *args], capture_output=True, text=True)
    if r.returncode:
        raise RuntimeError(r.stderr)


def make_clip(dst: Path, kind: str, speech: Path | None = None) -> None:
    """A 640x1152 24 fps clip. kind: ok, short, cut, freeze, silent, clipped, mute."""
    w, h = "640x1152", 24
    n = 100 if kind == "short" else 243
    if kind == "cut":
        v = ["-f", "lavfi", "-i", f"testsrc2=s={w}:r={h}:d=5", "-f", "lavfi", "-i", f"color=c=white:s={w}:r={h}:d=6"]
        vf = ["-filter_complex", "[0:v][1:v]concat=n=2:v=1:a=0[v]", "-map", "[v]"]
        idx = 2
    elif kind == "freeze":
        v = ["-f", "lavfi", "-i", f"testsrc2=s={w}:r={h}:d=8"]
        vf = ["-filter_complex", "[0:v]tpad=stop_mode=clone:stop_duration=3[v]", "-map", "[v]"]
        idx = 1
    else:
        v = ["-f", "lavfi", "-i", f"testsrc2=s={w}:r={h}:d=11"]
        vf, idx = ["-map", "0:v"], 1
    cmd = [*v]
    if kind == "mute":
        a: list[str] = []
    elif kind == "silent":
        a = ["-f", "lavfi", "-i", "anullsrc=r=16000:cl=mono"]
    else:
        a = ["-i", str(speech)]
    cmd += a + vf
    if a:
        af = "apad" if kind != "clipped" else "volume=60dB,apad"
        cmd += ["-map", f"{idx}:a", "-af", af, "-c:a", "aac"]
    ff(*cmd, "-frames:v", str(n), "-t", "10.125", "-c:v", "libx264", "-pix_fmt", "yuv420p", str(dst))


def say_wav(dst: Path, text: str) -> None:
    aiff = dst.with_suffix(".aiff")
    subprocess.run(["say", "-o", str(aiff), text], check=True)
    ff("-i", str(aiff), "-ar", "16000", "-ac", "1", str(dst))


class Fixture(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = Path(tempfile.mkdtemp(prefix="ugc_test_checks_"))
        cls.clips: dict[str, Path] = {}
        tone = cls.tmp / "tone.wav"
        ff("-f", "lavfi", "-i", "sine=f=220:d=6", "-af", "volume=-12dB", "-ar", "16000", str(tone))
        cls.tone = tone
        for kind in ("ok", "short", "cut", "freeze", "silent", "clipped", "mute"):
            cls.clips[kind] = cls.tmp / f"{kind}.mp4"
            make_clip(cls.clips[kind], kind, tone)

    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(cls.tmp, ignore_errors=True)

    def project(self, kind: str = "ok", clip_file: Path | None = None, sheet: bool = True) -> Project:
        d = Path(tempfile.mkdtemp(dir=self.tmp))
        p = Project(d)
        (d / "brief.json").write_text(json.dumps(BRIEF))
        c = Clip("r01c1", "r01", 1, [Line(TEXT, "warmly")], "nods", "close", "kitchen", 1)
        p.save_reels([Reel("r01", "t", "h", [c], [Broll(0, 10.0, "")], "cta")])
        shutil.copy(clip_file or self.clips[kind], p.p("takes", "r01c1_t1.mp4"))
        p.add_take(Take("r01c1", 1, "q4", 1, "takes/r01c1_t1.mp4", 1.0, "k"))
        if sheet:
            ff("-f", "lavfi", "-i", "testsrc2=s=300x200", "-frames:v", "1", str(p.p("cast", "sheet.png")))
        return p

    def judge(self, p: Project, heard=TEXT, faces=GOOD_FACES, take=1) -> Check:
        t = lambda wav, loc: {"text": heard, "words": [{"w": x, "s": i * 0.4, "e": i * 0.4 + 0.3} for i, x in enumerate(heard.split())]}
        return gates.judge(p, CFG, "r01c1", take, transcribe=t, faces=lambda s, f: faces)


class Align(unittest.TestCase):
    SCRIPT = "Small kitchens often miss fresh herbs. Pebblenook arrives as a complete kit with seed pods, soil and a small tray, ready for your counter."
    HEARD = "Small kitchens often miss fresh hugs, pebble nook arrives as a complete kit with seed pods, soil, and a small tray, ready for your card tub."

    def heard(self, text, lo=0.3, hi=9.36):
        toks = text.split()
        step = (hi - lo) / len(toks)
        return [{"w": t, "s": lo + i * step, "e": lo + (i + 1) * step - 0.01} for i, t in enumerate(toks)]

    def check_invariants(self, words, dur=10.125):
        prev = 0.0
        for w in words:
            self.assertGreaterEqual(w["s"], prev - 1e-9)
            self.assertGreaterEqual(w["e"] - w["s"], 0.06 - 1e-3)
            prev = w["e"]
        self.assertLessEqual(prev, dur + 1e-9)

    def test_real_example_keeps_script_words(self):
        words, mode = align.script_words(self.SCRIPT, self.heard(self.HEARD), 10.125)
        self.assertEqual(mode, "script")
        self.assertEqual([w["w"] for w in words], self.SCRIPT.split())
        self.check_invariants(words)
        h = self.heard(self.HEARD)
        by = {w["w"]: w for w in words}
        self.assertAlmostEqual(by["Pebblenook"]["s"], h[6]["s"], places=2)         # pebble + nook
        self.assertAlmostEqual(by["Pebblenook"]["e"], h[7]["e"], places=2)
        self.assertAlmostEqual(by["counter."]["s"], h[-2]["s"], places=2)          # card + tub
        self.assertAlmostEqual(by["counter."]["e"], h[-1]["e"], places=2)

    def test_numbers_and_missing_words_are_interpolated(self):
        words, mode = align.script_words("Setup takes ten minutes, honestly.", self.heard("setup takes 10 minutes", 0.5, 3.0), 10.125)
        self.assertEqual(mode, "script")
        self.assertEqual([w["w"] for w in words], ["Setup", "takes", "ten", "minutes,", "honestly."])
        self.check_invariants(words)
        self.assertGreaterEqual(words[4]["s"], words[3]["e"] - 1e-9)

    def test_extra_heard_words_are_dropped(self):
        words, mode = align.script_words("Hello there friend.", self.heard("um hello uh there my friend"), 10.125)
        self.assertEqual(mode, "script")
        self.assertEqual([w["w"] for w in words], ["Hello", "there", "friend."])
        self.check_invariants(words)

    def test_unmatched_tail_stays_inside_the_clip(self):
        words, _ = align.script_words("One two three four five six.", self.heard("one two three", 0.2, 10.1), 10.125)
        self.check_invariants(words)
        self.assertEqual(len(words), 6)

    def test_bad_recognition_keeps_heard_words(self):
        words, mode = align.script_words(self.SCRIPT, self.heard("quarterly shipping schedules changed across regions"), 10.125)
        self.assertEqual(mode, "heard")
        self.assertEqual(words[0]["w"], "quarterly")


class WerTests(unittest.TestCase):
    def test_normalisation(self):
        self.assertEqual(normalise("It's 25% off, don't wait!"), ["it", "is", "twenty", "five", "percent", "off", "do", "not", "wait"])
        self.assertEqual(wer("Twenty-five people can't wait.", "25 people cannot wait"), 0.0)
        self.assertEqual(wer("Hello World", "hello, world!"), 0.0)

    def test_errors_counted(self):
        self.assertAlmostEqual(wer("one two three four", "one two five four"), 0.25)
        self.assertEqual(wer("a b", ""), 1.0)


class Injected(Fixture):
    def test_all_pass(self):
        p = self.project()
        c = self.judge(p)
        self.assertTrue(c.passed, c.gates)
        self.assertEqual(set(c.gates), {"file", "speech", "face", "cut", "freeze", "loudness"})
        self.assertEqual(p.check("r01c1", 1).passed, True)
        words = json.loads((p.path / "checks" / "r01c1_t1.words.json").read_text())
        self.assertEqual(set(words[0]), {"w", "s", "e"})
        self.assertGreater(c.score, 0.5)

    def test_speech_fails_on_wrong_words(self):
        c = self.judge(self.project(), heard=OTHER)
        self.assertFalse(c.gates["speech"]["pass"])
        self.assertFalse(c.passed)

    def test_gate_saves_script_words_and_marks_mode(self):
        p = self.project()
        c = self.judge(p, heard=TEXT.lower().replace(",", "").replace(".", ""))
        self.assertEqual(c.gates["speech"]["value"]["words"], "script")
        saved = json.loads((p.path / "checks" / "r01c1_t1.words.json").read_text())
        self.assertEqual([w["w"] for w in saved], TEXT.split())
        bad = self.judge(self.project(), heard=OTHER)
        self.assertEqual(bad.gates["speech"]["value"]["words"], "heard")

    def test_wer_tolerates_numbers_and_case(self):
        self.assertTrue(self.judge(self.project(), heard=TEXT.upper().replace("A SUNNY", "A SUNNY,")).gates["speech"]["pass"])

    def test_brand_must_be_heard_when_scripted(self):
        p = self.project()
        c = Clip("r01c1", "r01", 1, [Line("Pebblenook " + TEXT, "")], "nods", "close", "kitchen", 1)
        p.save_reels([Reel("r01", "t", "h", [c], [], "cta")])
        miss = self.judge(p, heard="Pebble " + TEXT.replace("Fresh", "Fresh"))
        self.assertFalse(miss.gates["speech"]["pass"])
        self.assertIs(miss.gates["speech"]["value"]["brand_heard"], False)
        self.assertTrue(self.judge(p, heard="pebble nook " + TEXT).gates["speech"]["pass"])

    def test_face_gates(self):
        two = {"frames": [{"faces": 2, "distance": None, "drift": None}] * 20}
        self.assertFalse(self.judge(self.project(), faces=two).gates["face"]["pass"])
        far = {"frames": [{"faces": 1, "distance": 1.0, "drift": 0.0}] * 20}
        c = self.judge(self.project(), faces=far)
        self.assertFalse(c.gates["face"]["pass"])
        some = {"frames": [{"faces": 1, "distance": 0.2, "drift": 0.0}] * 17 + [{"faces": 0, "distance": None, "drift": None}] * 3}
        self.assertFalse(self.judge(self.project(), faces=some).gates["face"]["pass"])
        okf = {"frames": [{"faces": 1, "distance": 0.2, "drift": 0.0}] * 19 + [{"faces": 0, "distance": None, "drift": None}]}
        self.assertTrue(self.judge(self.project(), faces=okf).gates["face"]["pass"])

    def test_distance_stats_and_missing_distances(self):
        rows = [{"faces": 1, "distance": d, "drift": 0.9} for d in (0.6, 0.7, 0.8, 0.8)] + [{"faces": 1, "distance": None, "drift": None}] * 2
        rows += [{"faces": 1, "distance": 0.7, "drift": 0.1}] * 14
        c = self.judge(self.project(), faces={"frames": rows})
        v = c.gates["face"]["value"]
        self.assertTrue(c.gates["face"]["pass"], v)          # high drift never fails; 2 missing distances are ignored
        self.assertEqual((v["distance_min"], v["distance_max"]), (0.6, 0.8))
        self.assertAlmostEqual(v["distance_mean"], 0.7, places=1)
        mostly_missing = {"frames": [{"faces": 1, "distance": 0.5, "drift": 0.0}] * 4 + [{"faces": 1, "distance": None, "drift": None}] * 16}
        g = self.judge(self.project(), faces=mostly_missing).gates["face"]
        self.assertFalse(g["pass"])
        self.assertIsNone(g["value"]["distance_mean"])

    def test_drift_lowers_score(self):
        a = self.judge(self.project(), faces={"frames": [{"faces": 1, "distance": 0.3, "drift": 0.0}] * 20})
        b = self.judge(self.project(), faces={"frames": [{"faces": 1, "distance": 0.3, "drift": 0.5}] * 20})
        self.assertGreater(a.score, b.score)
        self.assertEqual(b.gates["face"]["value"]["drift"], 0.5)

    def test_missing_sheet_fails_face_gate_with_advice(self):
        c = self.judge(self.project(sheet=False))
        self.assertFalse(c.gates["face"]["pass"])
        self.assertIn("sheet.png", c.gates["face"]["value"])

    def test_wrong_length_fails_file_gate(self):
        c = self.judge(self.project("short"))
        self.assertFalse(c.gates["file"]["pass"])
        self.assertIn("100 frames", c.gates["file"]["limit"])

    def test_wrong_size_fails_file_gate(self):
        p = self.project()
        p.add_take(Take("r01c1", 2, "q1", 1, "takes/r01c1_t1.mp4", 1.0, "k2"))
        shutil.copy(self.clips["ok"], p.p("takes", "r01c1_t2.mp4"))
        self.assertIn("not a configured tier size", self.judge(p, take=2).gates["file"]["limit"])

    def test_hard_cut_fails(self):
        c = self.judge(self.project("cut"))
        self.assertFalse(c.gates["cut"]["pass"], c.gates["cut"])
        self.assertTrue(self.judge(self.project()).gates["cut"]["pass"])

    def test_freeze_fails(self):
        c = self.judge(self.project("freeze"))
        self.assertFalse(c.gates["freeze"]["pass"], c.gates["freeze"])
        self.assertTrue(self.judge(self.project()).gates["freeze"]["pass"])

    def test_near_still_talking_head_is_not_frozen(self):
        still = self.tmp / "still.png"
        ff("-f", "lavfi", "-i", "testsrc2=s=640x1152", "-frames:v", "1", str(still))
        f = self.tmp / "still.mp4"       # a still scene where one 300 px patch drifts 1 px per frame: tiny motion, like breathing
        ff("-loop", "1", "-framerate", "24", "-i", str(still), "-f", "lavfi", "-i", "color=c=black:s=300x300:r=24", "-i", str(self.tone),
           "-filter_complex", "[0][1]overlay=x='100+n':y=300:eval=frame[v]", "-map", "[v]", "-map", "2:a", "-af", "apad", "-frames:v", "243", "-t", "10.125",
           "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", str(f))
        self.assertEqual(media.longest_freeze(f), 0.0)
        self.assertTrue(self.judge(self.project(clip_file=f)).gates["freeze"]["pass"])

    def test_silent_fails_loudness(self):
        self.assertFalse(self.judge(self.project("silent")).gates["loudness"]["pass"])

    def test_clipping_fails_loudness(self):
        g = self.judge(self.project("clipped")).gates["loudness"]
        self.assertFalse(g["pass"], g)

    def test_no_audio_fails(self):
        c = self.judge(self.project("mute"))
        self.assertFalse(c.gates["file"]["pass"])
        self.assertFalse(c.gates["speech"]["pass"])
        self.assertFalse(c.gates["loudness"]["pass"])

    def test_missing_file(self):
        p = self.project()
        (p.path / "takes" / "r01c1_t1.mp4").unlink()
        c = self.judge(p)
        self.assertFalse(c.passed)
        self.assertEqual(c.gates["file"]["value"], "missing")


class Select(Fixture):
    def save(self, p, clip, take, passed, score):
        p.add_take(Take(clip, take, "q4", 1, f"takes/{clip}_t{take}.mp4", 1.0, f"{clip}{take}"))
        p.save_check(Check(clip, take, passed, score, {}))

    def test_best_passing_then_fallback(self):
        p = Project(Path(tempfile.mkdtemp(dir=self.tmp)))
        self.save(p, "r01c1", 1, True, 0.7)
        self.save(p, "r01c1", 2, True, 0.9)
        self.save(p, "r01c1", 3, False, 0.99)
        self.save(p, "r01c2", 1, False, 0.2)
        self.save(p, "r01c2", 2, False, 0.5)
        self.save(p, "r01c3", 1, True, 0.5)
        p.add_take(Take("r01c3", 2, "q4", 1, "x", 1.0, "unchecked"))
        out = gates.select(p)
        self.assertEqual(out, {"r01c1": {"take": 2, "passed": True}, "r01c2": {"take": 2, "passed": False}, "r01c3": {"take": 1, "passed": True}})
        self.assertEqual(p.selects(), out)

    def test_tie_prefers_earlier_take(self):
        p = Project(Path(tempfile.mkdtemp(dir=self.tmp)))
        self.save(p, "r01c1", 1, True, 0.8)
        self.save(p, "r01c1", 2, True, 0.8)
        self.assertEqual(gates.select(p)["r01c1"]["take"], 1)


@unittest.skipUnless(shutil.which("say"), "macOS `say` is not available; real speech test skipped")
class RealSpeech(Fixture):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.skip_reason = None
        try:
            wav = cls.tmp / "probe.wav"
            say_wav(wav, "hello there")
            native.transcribe(wav, "en-US")
        except (RuntimeError, subprocess.SubprocessError, OSError) as e:
            cls.skip_reason = f"on-device speech unavailable: {e}"
            return
        cls.good, cls.bad = cls.tmp / "good.mp4", cls.tmp / "bad.mp4"
        for f, text in ((cls.good, TEXT), (cls.bad, OTHER)):
            wav = cls.tmp / (f.stem + ".wav")
            say_wav(wav, text)
            make_clip(f, "ok", wav)

    def setUp(self):
        if self.skip_reason:
            self.skipTest(self.skip_reason)

    def real(self, p):
        return gates.judge(p, CFG, "r01c1", 1, faces=lambda s, f: GOOD_FACES)

    def test_matching_speech_passes_with_word_times(self):
        p = self.project(clip_file=self.good)
        c = self.real(p)
        self.assertTrue(c.gates["speech"]["pass"], c.gates["speech"])
        words = json.loads((p.path / "checks" / "r01c1_t1.words.json").read_text())
        self.assertGreater(len(words), 10)
        self.assertTrue(all(w["e"] >= w["s"] >= 0 for w in words))

    def test_different_speech_fails(self):
        c = self.real(self.project(clip_file=self.bad))
        self.assertFalse(c.gates["speech"]["pass"])
        self.assertGreater(c.gates["speech"]["value"]["wer"], 0.5)

    def test_missing_locale_has_clear_error(self):
        with self.assertRaises(RuntimeError) as cm:
            native.transcribe(self.tmp / "good.wav", "xx-XX")
        self.assertIn("not installed", str(cm.exception))


class RealVision(Fixture):
    def test_no_face_path_runs_on_device(self):
        frames = media.frames(self.clips["ok"], self.tmp, 1.0)[:3]
        res = native.faces(None, frames)
        self.assertEqual([r["faces"] for r in res["frames"]], [0, 0, 0])
        self.assertTrue(all(r["distance"] is None for r in res["frames"]))

    def test_sheet_without_face_is_a_clear_error(self):
        p = self.project()
        with self.assertRaises(RuntimeError) as cm:
            gates.judge(p, CFG, "r01c1", 1, transcribe=lambda w, l: {"text": TEXT, "words": []})
        self.assertIn("no face found in the character sheet", str(cm.exception))


if __name__ == "__main__":
    unittest.main()
