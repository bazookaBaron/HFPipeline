"""Whole pipeline on fakes: fake Vast API, fake ComfyUI that returns real spoken clips, real speech gate, real edit. No network, no money."""
from __future__ import annotations
import copy
import hashlib
import json
import re
import shutil
import subprocess
import tempfile
import time
import unittest
from pathlib import Path

from tests import test_compute as TC, test_generate as TG
from tests.test_script import BRIEF, good
from ugc import cli
from ugc.checks import gates, media
from ugc.compute.api import Vast
from ugc.compute.ledger import Ledger
from ugc.contract import Project, load_config


class FastClock:
    """Real time, except that sleeping is free."""
    def __init__(self):
        self.skew = 0.0

    def time(self) -> float:
        return time.time() + self.skew

    def sleep(self, s: float) -> None:
        self.skew += s
        time.sleep(min(s, 0.01))


CACHE: dict[str, bytes] = {}


def spoken_clip(graph: dict) -> bytes:
    """What H3 would return: the right size, 243 frames at 24 fps, and the words from the prompt's <d> tags spoken aloud."""
    c = graph["cond"]["inputs"]
    text = " ".join(re.findall(r"<d>\[English\] (.*?)</d>", c["prompt"]))
    k = hashlib.sha256(f"{c['width']}x{c['height']}{text}".encode()).hexdigest()
    if k not in CACHE:
        with tempfile.TemporaryDirectory() as d:
            d = Path(d)
            subprocess.run(["say", "-r", "165", "-o", str(d / "a.aiff"), text], check=True)
            subprocess.run(["ffmpeg", "-v", "error", "-f", "lavfi", "-i", f"gradients=s={c['width']}x{c['height']}:r=24:seed=7:nb_colors=3:c0=0x886655:c1=0x334455:c2=0x99aa77:speed=0.4",
                            "-i", str(d / "a.aiff"), "-af", "adelay=300|300,apad", "-frames:v", str(c["length"]), "-t", f"{c['length'] / 24:.5f}", "-c:v", "libx264", "-preset", "ultrafast",
                            "-crf", "20", "-pix_fmt", "yuv420p", "-c:a", "aac", "-ar", "48000", str(d / "v.mp4")], check=True)
            CACHE[k] = (d / "v.mp4").read_bytes()
    return CACHE[k]


class SpeakingComfy(TG.Fake):
    """Serves the clip that matches the graph behind each finished prompt."""
    def __init__(self):
        super().__init__()
        handler = self.server.RequestHandlerClass
        base_get, fake = handler.do_GET, self

        def do_GET(h):
            if h.path.startswith("/view"):
                pid = re.search(r"filename=([0-9a-f-]{36})", h.path).group(1)
                b = spoken_clip(fake.graphs[pid])
                h.send_response(200); h.send_header("Content-Length", str(len(b))); h.end_headers(); h.wfile.write(b)
                return
            base_get(h)
        handler.do_GET = do_GET


def one_face(sheet, frames):
    return {"sheet_faces": 1, "frames": [{"faces": 1, "distance": 0.7, "drift": 0.1} for _ in frames]}


@unittest.skipUnless(shutil.which("say"), "needs macOS say")
class EndToEnd(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.cfg = copy.deepcopy(load_config())
        self.cfg["tiers"] = [t for t in self.cfg["tiers"] if t.id in ("q3", "q4")]
        self.p = Project(Path(self.tmp.name) / "demo")
        self.p.p("brief.json").write_text(json.dumps(BRIEF))
        self.p.save_reels([good("r01"), good("r02", "Who has an empty windowsill?")])
        self.p.p("cast", "sheet.png").write_bytes(b"sheet")
        self.p.p("voice", "ref.wav").write_bytes(b"voice")
        self.vs = TC.FakeVastServer()
        self.comfy = SpeakingComfy()
        self.addCleanup(self.vs.server.server_close); self.addCleanup(self.vs.server.shutdown); self.addCleanup(self.comfy.close)
        clock = FastClock()
        self.vast = Vast(TC.KEY, self.vs.base, sleep=clock.sleep)
        self.kw = {"clock": clock, "spawn": lambda argv, log: TC.FakeProc(argv), "probe": lambda url: True,
                   "local_port": int(self.comfy.url.rsplit(":", 1)[1]), "log": lambda *_: None}
        self.asked: list[str] = []

    def yes(self, text):
        self.asked.append(text)
        return True

    def judge(self, clip, take):
        return gates.judge(self.p, self.cfg, clip, take, faces=one_face)

    def pilot(self, confirm=None):
        return cli.cmd_pilot(self.p, self.cfg, False, self.vast, confirm or self.yes, self.kw, self.judge)

    def batch(self, confirm=None, tier=None, judge=None, vast=None):
        return cli.cmd_batch(self.p, self.cfg, False, tier, vast or self.vast, confirm or self.yes, self.kw, judge or self.judge)

    def assert_nothing_running(self):
        self.assertEqual(self.vs.instances, {})
        self.assertEqual(Ledger(self.p.p("ledger.jsonl")).open_ids(), [])

    def approve(self):
        self.p.p("pilot.approved").write_text("yes")

    def test_pilot_approve_batch_select_edit(self):
        self.assertEqual(self.batch(), 1, "no batch before a pilot")
        self.assertEqual(self.pilot(), 0)
        self.assert_nothing_running()
        self.assertEqual(self.batch(), 1, "no batch before a person approves the pilot")
        self.assertEqual(self.vs.creates, 1)
        self.approve()
        self.assertEqual(self.batch(), 0)
        self.assert_nothing_running()
        self.assertEqual(len(self.p.takes()), 6)
        self.assertEqual({t.tier for t in self.p.takes()}, {"q3"}, "the best level that fits is used")
        for c in cli.clips_of(self.p):
            chk = self.p.check(c.id, 1)
            self.assertTrue(chk.passed, (c.id, chk.gates))
        self.assertEqual(len(self.asked), 2, "every rental asked first")
        self.assertIn("$", self.asked[0])
        creates = self.vs.creates
        self.assertEqual(self.batch(), 0)
        self.assertEqual(self.vs.creates, creates, "nothing left to do rents nothing")
        sel = gates.select(self.p)
        self.assertTrue(all(v["passed"] for v in sel.values()) and len(sel) == 6)
        self.assertNotIn(TC.KEY, "".join(f.read_text(errors="replace") for f in self.p.path.rglob("*") if f.is_file() and f.suffix in {".json", ".jsonl", ".log"}))
        from ugc.edit import assemble, audit
        for r in self.p.reels():
            f = assemble.reel(self.p, self.cfg, r)
            info = media.probe(f)
            self.assertEqual((info["width"], info["height"]), (1080, 1920))
            self.assertEqual(audit.final(f, self.cfg), [])
        keep = Path(__file__).resolve().parent.parent / "build" / "e2e_r01.mp4"
        keep.parent.mkdir(exist_ok=True)
        shutil.copy(self.p.path / "final" / "r01.mp4", keep)

    def test_declining_rents_nothing(self):
        self.assertEqual(self.pilot(confirm=lambda t: False), 5)
        self.assertEqual(self.vs.creates, 0)
        self.assertEqual(Ledger(self.p.p("ledger.jsonl")).spent(time.time()), 0.0)

    def test_bad_script_rents_nothing(self):
        reels = self.p.reels()
        reels[0].clips[1].lines[0].text = "I used this for a month and it changed my life, so you should really try it at home today as well."
        self.p.save_reels(reels)
        self.assertEqual(self.pilot(), 1)
        self.assertEqual(self.vs.creates, 0)

    def test_machine_lost_mid_batch_then_resumes(self):
        self.assertEqual(self.pilot(), 0)
        self.approve()
        seen = []

        def lose_after_two(clip, take):
            seen.append(clip.id)
            if len(seen) == 2:
                for d in self.vs.instances.values():
                    d["forced"] = "exited"
                self.kw["clock"].skew += 60
            return self.judge(clip, take)
        self.comfy.delay = 0.5
        rc = self.batch(judge=lose_after_two)
        self.assertEqual(rc, 3, "reports the lost machine")
        self.assert_nothing_running()
        first = {t.clip: t.key for t in self.p.takes()}
        self.assertTrue(0 < len(first) < 6, first)
        self.assertEqual(self.batch(), 0)
        self.assert_nothing_running()
        after = {t.clip: t.key for t in self.p.takes()}
        self.assertEqual(len(after), 6)
        self.assertTrue(all(after[c] == k for c, k in first.items()), "finished takes are kept")
        per_clip = [t.clip for t in self.p.takes()]
        self.assertEqual(len(per_clip), len(set(per_clip)), "nothing was generated twice")

    def test_too_expensive_is_refused_before_renting(self):
        self.assertEqual(self.pilot(), 0)
        self.approve()
        d = json.loads((self.p.path / "pilot.json").read_text())
        for v in d.values():
            v["seconds"] = 50_000.0
        (self.p.path / "pilot.json").write_text(json.dumps(d))
        n = self.vs.creates
        self.assertEqual(self.batch(), 1)
        self.assertEqual(self.batch(tier="q4"), 1, "naming a level does not bypass the cap")
        self.assertEqual(self.vs.creates, n)

    def test_slower_card_is_rescaled(self):
        self.assertEqual(self.pilot(), 0)
        self.vs.offers = [TC.raw_offer(gpu_name="RTX 4090", dlperf=98.5, dph_total=0.4)]
        o = cli.best_offer(self.vast, self.cfg, False)
        base = json.loads((self.p.path / "pilot.json").read_text())["q3"]["seconds"]
        self.assertAlmostEqual(cli.measured_for(self.p, o)["q3"], base * 1.15 * 2, 3)

    def test_excluded_country_never_rented(self):
        self.vs.offers = [TC.raw_offer(geolocation=g) for g in ("Texas, US", "Romania, RO", "South Korea, KR", "United Kingdom, GB", "")]
        self.assertEqual(self.pilot(), 1)
        self.assertEqual(self.vs.creates, 0)


if __name__ == "__main__":
    unittest.main()
