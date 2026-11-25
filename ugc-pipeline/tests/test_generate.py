from __future__ import annotations
import json
import re
import socket
import subprocess
import tempfile
import threading
import time
import unittest
from dataclasses import asdict, replace
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

from ugc.contract import Broll, Check, Clip, Line, Project, Reel, Tier, load_config
from ugc.generate import graph as G
from ugc.generate import pilot, queue
from ugc.generate.comfy import Comfy, ComfyError

CFG = load_config()
TIERS = {t.id: t for t in CFG["tiers"]}
_MP4: list[bytes] = []


def sample_mp4() -> bytes:
    if not _MP4:
        with tempfile.TemporaryDirectory() as d:
            out = Path(d) / "s.mp4"
            subprocess.run(["ffmpeg", "-v", "error", "-f", "lavfi", "-i", "testsrc=size=64x112:rate=24:duration=1",
                            "-f", "lavfi", "-i", "sine=frequency=440:duration=1", "-shortest", "-c:v", "libx264",
                            "-pix_fmt", "yuv420p", "-c:a", "aac", str(out)], check=True)
            _MP4.append(out.read_bytes())
    return _MP4[0]


class BudgetStop(Exception):
    pass


class Interrupted(Exception):
    pass


class Fake:
    """A ComfyUI stand-in over real HTTP. Jobs run one at a time on a worker thread."""

    def __init__(self, delay: float = 0.0):
        self.lock = threading.Lock()
        self.uploads: dict[str, bytes] = {}
        self.submitted: list[tuple[str, dict]] = []
        self.queue: list[str] = []
        self.running: str | None = None
        self.history: dict[str, dict] = {}
        self.graphs: dict[str, dict] = {}
        self.delay = delay
        self.max_depth = 0
        self.interrupts: list = []
        self.view_failures = 0
        self.drop_after_enqueue = 0      # reply nothing but keep the job
        self.drop_before_enqueue = 0     # reply nothing and lose the job
        self.fail_when = lambda graph: None   # -> None | "error" | "oom"
        self.cold = 30.0
        self.warm = 10.0
        self.done_jobs = 0
        self.stop = False
        fake = self

        class H(BaseHTTPRequestHandler):
            def log_message(self, *a): pass

            def _send(self, obj, code=200):
                b = json.dumps(obj).encode()
                self.send_response(code)
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(b)))
                self.end_headers()
                self.wfile.write(b)

            def do_GET(self):
                u = urlparse(self.path)
                with fake.lock:
                    if u.path == "/queue":
                        run = [[0, fake.running, {}, {}, []]] if fake.running else []
                        return self._send({"queue_running": run, "queue_pending": [[1, p, {}, {}, []] for p in fake.queue]})
                    if u.path.startswith("/history/"):
                        pid = u.path.split("/")[-1]
                        return self._send({pid: fake.history[pid]} if pid in fake.history else {})
                    if u.path == "/object_info":
                        return self._send(fake.object_info())
                if u.path == "/view":
                    with fake.lock:
                        if fake.view_failures:
                            fake.view_failures -= 1
                            self.connection.close()
                            return
                    b = sample_mp4()
                    self.send_response(200)
                    self.send_header("Content-Length", str(len(b)))
                    self.end_headers()
                    self.wfile.write(b)
                    return
                self._send({}, 404)

            def do_POST(self):
                n = int(self.headers.get("Content-Length", 0))
                body = self.rfile.read(n)
                if self.path == "/upload/image":
                    name = re.search(rb'filename="([^"]+)"', body).group(1).decode()
                    with fake.lock:
                        fake.uploads[name] = body
                    return self._send({"name": name, "subfolder": "", "type": "input"})
                if self.path == "/prompt":
                    d = json.loads(body)
                    if not re.fullmatch(r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}", str(d.get("prompt_id", ""))):
                        return self._send({"error": {"message": "prompt_id must be a UUID string in canonical lowercase hyphenated form"}}, 400)
                    err = fake.validate(d["prompt"])
                    if err:
                        return self._send({"error": {"message": err}, "node_errors": {}}, 400)
                    with fake.lock:
                        if fake.drop_before_enqueue:
                            fake.drop_before_enqueue -= 1
                            self.connection.close()
                            return
                        fake.submitted.append((d["prompt_id"], d["prompt"]))
                        fake.graphs[d["prompt_id"]] = d["prompt"]
                        fake.queue.append(d["prompt_id"])
                        fake.max_depth = max(fake.max_depth, len(fake.queue) + (1 if fake.running else 0))
                        if fake.drop_after_enqueue:
                            fake.drop_after_enqueue -= 1
                            self.connection.close()
                            return
                    return self._send({"prompt_id": d["prompt_id"], "number": 1, "node_errors": {}})
                if self.path == "/queue":
                    with fake.lock:
                        for p in json.loads(body).get("delete", []):
                            if p in fake.queue:
                                fake.queue.remove(p)
                    return self._send({})
                if self.path == "/interrupt":
                    with fake.lock:
                        fake.interrupts.append(json.loads(body or b"{}"))
                self._send({})

        self.server = ThreadingHTTPServer(("127.0.0.1", 0), H)
        self.url = f"http://127.0.0.1:{self.server.server_address[1]}"
        threading.Thread(target=self.server.serve_forever, daemon=True).start()
        threading.Thread(target=self._worker, daemon=True).start()

    def object_info(self) -> dict:
        m = CFG["model"]
        combos = {"UNETLoader": {"unet_name": [m["unet"]]}, "CLIPLoader": {"clip_name": [m["text_encoder"]]},
                  "VAELoader": {"vae_name": [m["video_vae"], m["audio_vae"]]},
                  "LoraLoaderModelOnly": {"lora_name": [m["turbo_lora"], m["skin_lora"]]}}
        classes = ["UNETLoader", "LoraLoaderModelOnly", "CLIPLoader", "VAELoader", "LoadImage", "LoadAudio", "MiniMaxH3ReferenceToVideo",
                   "BasicGuider", "RandomNoise", "KSamplerSelect", "BasicScheduler", "SamplerCustomAdvanced", "VAEDecode",
                   "VAEDecodeAudio", "CreateVideo", "SaveVideo"]
        return {c: {"input": {"required": {k: [v] for k, v in combos.get(c, {}).items()}}} for c in classes if c != getattr(self, "hide", None)}

    def validate(self, g: dict) -> str | None:
        known = set(self.object_info())
        for nid, n in g.items():
            if n["class_type"] not in known:
                return f"unknown class {n['class_type']}"
            for k, v in n["inputs"].items():
                if isinstance(v, list) and (v[0] not in g):
                    return f"{nid}.{k} links to missing node {v[0]}"
        return None

    def _worker(self):
        while not self.stop:
            with self.lock:
                pid = self.queue.pop(0) if self.queue else None
                self.running = pid
            if pid is None:
                time.sleep(0.005)
                continue
            time.sleep(self.delay)
            g = self.graphs[pid]
            how = self.fail_when(g)
            with self.lock:
                self.done_jobs += 1
                secs = self.cold + self.warm if self.done_jobs == 1 else self.warm
                t0 = 1_700_000_000_000 + self.done_jobs * 1_000_000
                if how:
                    msg = "Allocation on device: CUDA out of memory" if how == "oom" else "something broke in the sampler"
                    self.history[pid] = {"status": {"status_str": "error", "completed": False, "messages": [
                        ["execution_start", {"timestamp": t0}],
                        ["execution_error", {"node_type": "SamplerCustomAdvanced", "exception_message": msg, "timestamp": t0 + 5}]]}, "outputs": {}}
                else:
                    self.history[pid] = {"status": {"status_str": "success", "completed": True, "messages": [
                        ["execution_start", {"timestamp": t0}], ["execution_cached", {"nodes": [], "timestamp": t0}],
                        ["execution_success", {"timestamp": t0 + int(secs * 1000)}]]},
                        "outputs": {"save": {"images": [{"filename": f"{pid}.mp4", "subfolder": "video", "type": "output"}], "animated": [True]}}}
                self.running = None

    def prompts_for(self, text: str) -> list[dict]:
        return [g for _, g in self.submitted if g["cond"]["inputs"]["prompt"] == text]

    def close(self):
        self.stop = True
        self.server.shutdown()
        self.server.server_close()


def make_project(root: Path, n: int = 3) -> Project:
    p = Project(root / "proj")
    clips = [Clip(f"r01c{i}", "r01", i, [Line(f"line {i}")], "waves", "close-up", "kitchen", 1000 + i) for i in range(1, n + 1)]
    p.save_reels([Reel("r01", "t", "h", clips, [Broll(0, 2.0, "")], "cta")])
    (p.path / "brief.json").write_text("{}")
    p.p("cast", "sheet.png").write_bytes(b"sheet-bytes")
    p.p("voice", "ref.wav").write_bytes(b"voice-bytes")
    return p


def render(clip, brief, cfg):
    return f"prompt {clip.id}"


def ok_judge(clip, take):
    return Check(clip.id, take.take, True, 1.0, {"speech": {"pass": True, "value": 0.0, "limit": 0.1}})


def make_judge(fail_until: dict[str, int] | None = None, log: list | None = None):
    fail_until = fail_until or {}

    def judge(clip, take):
        if log is not None:
            log.append((clip.id, take.take))
        good = take.take > fail_until.get(clip.id, 0)
        return Check(clip.id, take.take, good, 0.5 + take.take / 10,
                     {"speech": {"pass": good, "value": 0.5, "limit": 0.1}})
    return judge


def nolog(*a): pass


def probe(path: Path) -> set[str]:
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "stream=codec_type", "-of", "json", str(path)], capture_output=True, text=True).stdout
    return {s["codec_type"] for s in json.loads(out)["streams"]}


class Base(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.fake = Fake()
        self.addCleanup(self.fake.close)
        self.comfy = Comfy(self.fake.url, poll=0.01, settle=0.0)
        self.project = make_project(Path(self.tmp.name))
        self.tier = TIERS["q2"]

    def run_q(self, **kw):
        args = dict(project=self.project, cfg=CFG, tier=self.tier, comfy=self.comfy, judge=ok_judge, tick=lambda: None, log=nolog, render=render)
        args.update(kw)
        return queue.run(**args)


class GraphTests(unittest.TestCase):
    clip = Clip("r01c1", "r01", 1, [Line("x")], "a", "f", "r", 77)

    def check_links(self, g):
        for nid, n in g.items():
            for k, v in n["inputs"].items():
                if isinstance(v, list):
                    self.assertIn(v[0], g, f"{nid}.{k}")
                    self.assertIsInstance(v[1], int)

    def test_every_tier(self):
        for t in CFG["tiers"]:
            g = G.build(self.clip, t, CFG, "P", "sheet.png", "ref.wav")
            self.check_links(g)
            loras = [n for n in g.values() if n["class_type"] == "LoraLoaderModelOnly"]
            self.assertEqual(len(loras), (t.turbo > 0) + (t.skin > 0), t.id)
            self.assertEqual({n["inputs"]["strength_model"] for n in loras}, {x for x in (t.turbo, t.skin) if x > 0})
            c = g["cond"]["inputs"]
            self.assertEqual((c["width"], c["height"], c["length"]), (t.width, t.height, 243))
            self.assertEqual(c["ref_image_size"], "match")
            self.assertEqual(c["ref_images.ref_image_0"], ["sheet", 0])
            self.assertEqual(c["ref_audios.ref_audio_0"], ["voice", 0])
            self.assertEqual(g["sigmas"]["inputs"]["steps"], t.steps)
            self.assertEqual(g["sigmas"]["inputs"]["scheduler"], "beta")
            self.assertEqual(g["sigmas"]["inputs"]["denoise"], 1)
            self.assertEqual(g["sampler"]["inputs"]["sampler_name"], "euler")
            self.assertEqual(g["noise"]["inputs"]["noise_seed"], 77)
            self.assertEqual(g["clip"]["inputs"]["type"], "minimax")
            self.assertEqual(g["video"]["inputs"]["fps"], 24)
            self.assertEqual(g["video"]["inputs"]["audio"], ["decode_audio", 0])
            self.assertEqual(g["cond"]["inputs"]["prompt"], "P")
            self.assertEqual(g["sample"]["inputs"]["latent_image"], ["cond", 1])
            self.assertEqual(g["guider"]["inputs"]["conditioning"], ["cond", 0])
            self.assertEqual(g["save"]["class_type"], "SaveVideo")
            vaes = [n for n in g.values() if n["class_type"] == "VAELoader"]
            self.assertEqual(len(vaes), 2)

    def test_lora_chain_order_and_omission(self):
        g = G.build(self.clip, TIERS["q2"], CFG, "P", "s", "v")
        self.assertEqual(g["lora_turbo"]["inputs"]["model"], ["unet", 0])
        self.assertEqual(g["lora_skin"]["inputs"]["model"], ["lora_turbo", 0])
        self.assertEqual(g["guider"]["inputs"]["model"], ["lora_skin", 0])
        g1 = G.build(self.clip, TIERS["q1"], CFG, "P", "s", "v")
        self.assertNotIn("lora_turbo", g1)
        self.assertEqual(g1["lora_skin"]["inputs"]["model"], ["unet", 0])
        none = G.build(self.clip, Tier("x", 640, 1152, 10, 0.0, 0.0), CFG, "P", "s", "v")
        self.assertFalse([n for n in none.values() if n["class_type"] == "LoraLoaderModelOnly"])
        self.assertEqual(none["guider"]["inputs"]["model"], ["unet", 0])
        self.assertEqual(none["sigmas"]["inputs"]["model"], ["unet", 0])

    def test_seed_per_take(self):
        s = [G.take_seed(5, n) for n in (1, 2, 3)]
        self.assertEqual(len(set(s)), 3)
        self.assertEqual(s, [G.take_seed(5, n) for n in (1, 2, 3)])
        self.assertNotEqual(G.take_seed(6, 1), s[0])

    def test_example_workflow_matches_builder(self):
        f = Path(__file__).resolve().parent.parent / "workflows" / "h3_ref2va_q2.api.json"
        g = G.build(self.clip, TIERS["q2"], CFG, "<Picture 1> speaks to camera.", "sheet.png", "ref.wav")
        self.assertEqual(json.loads(f.read_text()), g)


class ComfyTests(Base):
    def test_upload_and_missing(self):
        n = self.comfy.upload(self.project.p("cast", "sheet.png"))
        self.assertTrue(n.endswith("_sheet.png"))
        self.assertIn(n, self.fake.uploads)
        g = G.build(self.project.reels()[0].clips[0], self.tier, CFG, "P", n, "v")
        self.assertEqual(self.comfy.missing(g), [])
        g["unet"]["inputs"]["unet_name"] = "nope.safetensors"
        self.assertTrue(any("nope" in m for m in self.comfy.missing(g)))
        self.fake.hide = "KSamplerSelect"
        self.comfy._info = None
        self.assertTrue(any("KSamplerSelect" in m for m in self.comfy.missing(g)))

    def test_run_round_trip_keeps_audio_and_gpu_seconds(self):
        g = G.build(self.project.reels()[0].clips[0], self.tier, CFG, "prompt r01c1", "a", "b")
        out = Path(self.tmp.name) / "x" / "o.mp4"
        secs = self.comfy.run(g, out)
        self.assertEqual(secs, 40.0)             # from execution_start / execution_success, not wall time
        self.assertEqual(probe(out), {"video", "audio"})
        self.assertFalse(out.with_suffix(".mp4.part").exists())

    def test_rejected_graph_is_permanent(self):
        g = G.build(self.project.reels()[0].clips[0], self.tier, CFG, "P", "a", "b")
        g["guider"]["inputs"]["model"] = ["ghost", 0]
        with self.assertRaises(ComfyError) as cm:
            self.comfy.run(g, Path(self.tmp.name) / "o.mp4")
        self.assertTrue(cm.exception.permanent)


class QueueTests(Base):
    def test_round_trip(self):
        r = self.run_q()
        self.assertEqual(r["failed"], [])
        self.assertEqual(r["passed"], {"r01c1": 1, "r01c2": 1, "r01c3": 1})
        takes = self.project.takes()
        self.assertEqual(len(takes), 3)
        for t in takes:
            self.assertEqual(probe(self.project.path / t.file), {"video", "audio"})
            self.assertEqual((t.tier, t.take, len(t.key)), ("q2", 1, 32))
            self.assertEqual(t.seconds, 40.0 if t.clip == "r01c1" else 10.0)
            self.assertTrue(self.project.check(t.clip, 1).passed)
        self.assertFalse(list((self.project.path / "takes").glob("*.part")))
        sheet = [n for n in self.fake.uploads if n.endswith("sheet.png")]
        self.assertEqual(len(sheet), 1)

    def test_resume_skips_and_changed_prompt_regenerates(self):
        self.run_q()
        n = len(self.fake.submitted)
        r = self.run_q()
        self.assertEqual(len(self.fake.submitted), n)
        self.assertEqual(r["takes"], [])
        self.run_q(render=lambda c, b, cfg: render(c, b, cfg) + " changed")
        self.assertEqual(len(self.fake.submitted), n + 3)
        rows = self.project.takes()
        self.assertEqual(len(rows), 3)           # superseded rows are replaced, not piled up
        self.assertEqual(len({t.key for t in rows}), 3)

    def test_changed_voice_or_tier_changes_key(self):
        self.run_q()
        keys = {t.key for t in self.project.takes()}
        self.project.p("voice", "ref.wav").write_bytes(b"other voice")
        self.run_q(clips=["r01c1"])
        self.assertNotIn([t for t in self.project.takes() if t.clip == 'r01c1'][0].key, keys)

    def test_corrupt_take_is_regenerated(self):
        self.run_q()
        (self.project.path / "takes" / "r01c2_t1.mp4").write_bytes(b"junk")
        n = len(self.fake.submitted)
        self.run_q()
        self.assertEqual(len(self.fake.submitted), n + 1)

    def test_one_take_per_clip_first_then_retries_only_failures(self):
        log: list = []
        r = self.run_q(judge=make_judge({"r01c2": 1, "r01c3": 99}, log))
        self.assertEqual([x for x in log[:3]], [("r01c1", 1), ("r01c2", 1), ("r01c3", 1)])
        self.assertEqual(r["passed"], {"r01c1": 1, "r01c2": 2})
        self.assertEqual(r["failed"], ["r01c3"])
        per = {c: sum(1 for k, _ in [(t.clip, 0) for t in self.project.takes()] if k == c) for c in ("r01c1", "r01c2", "r01c3")}
        self.assertEqual(per, {"r01c1": 1, "r01c2": 2, "r01c3": 3})     # max_per_clip = 3, never more
        self.assertEqual(len(self.fake.submitted), 6)
        seeds = [t.seed for t in self.project.takes() if t.clip == "r01c3"]
        self.assertEqual(len(set(seeds)), 3)
        noise = {g["noise"]["inputs"]["noise_seed"] for g in self.fake.graphs.values()}
        self.assertEqual(len(noise), 6)

    def test_one_bad_clip_does_not_stop_others(self):
        self.fake.fail_when = lambda g: "error" if g["cond"]["inputs"]["prompt"] == "prompt r01c2" else None
        r = self.run_q()
        self.assertEqual(set(r["passed"]), {"r01c1", "r01c3"})
        self.assertEqual(r["failed"], ["r01c2"])
        self.assertIn("sampler", r["errors"]["r01c2"])
        self.assertEqual(len(self.fake.prompts_for("prompt r01c2")), 3)     # retried up to the max, then given up

    def test_budget_stop_saves_everything_and_resumes(self):
        calls = []

        def tick():
            calls.append(1)
            if len(calls) == 3:
                raise BudgetStop("cap")
        with self.assertRaises(BudgetStop):
            self.run_q(tick=tick)
        self.assertEqual(len(calls), 3)
        self.assertEqual(len(self.project.takes()), 2)
        self.assertTrue(all(self.project.check(t.clip, 1) for t in self.project.takes()))
        n = len(self.fake.submitted)
        r = self.run_q()
        self.assertEqual(len(self.fake.submitted), n + 1)
        self.assertEqual(len(r["passed"]), 3)

    def test_interrupted_is_reraised_and_resumable(self):
        calls = []

        def tick():
            calls.append(1)
            if len(calls) == 2:
                raise Interrupted("ctrl-c")
        with self.assertRaises(Interrupted):
            self.run_q(tick=tick)
        done = len(self.project.takes())
        self.assertGreaterEqual(done, 0)
        self.run_q()
        self.assertEqual(len(self.project.takes()), 3)
        self.assertEqual(len({t.clip for t in self.project.takes()}), 3)

    def test_unknown_outcome_after_enqueue_is_not_resubmitted(self):
        self.fake.drop_after_enqueue = 1
        r = self.run_q(clips=["r01c1"])
        self.assertEqual(r["passed"], {"r01c1": 1})
        self.assertEqual(len(self.fake.submitted), 1)

    def test_unknown_outcome_when_job_was_lost_is_resubmitted_once(self):
        self.fake.drop_before_enqueue = 1
        r = self.run_q(clips=["r01c1"])
        self.assertEqual(r["passed"], {"r01c1": 1})
        self.assertEqual(len(self.fake.submitted), 1)

    def test_budget_stop_cancels_job_queued_behind(self):
        self.fake.delay = 0.3
        calls = []

        def tick():
            calls.append(1)
            if len(calls) == 3:
                raise BudgetStop("cap")
        with self.assertRaises(BudgetStop):
            self.run_q(tick=tick, depth=3)
        self.assertEqual([t.clip for t in self.project.takes()], ["r01c1"])     # the running one was saved
        time.sleep(0.5)
        self.assertEqual(self.fake.done_jobs, 1)                                # the queued one never ran
        self.assertEqual(self.fake.queue, [])
        self.assertTrue(all("prompt_id" in i for i in self.fake.interrupts))     # never a global interrupt

    def test_failed_download_is_recovered_next_run(self):
        self.comfy.retry_delay = 0.0
        self.fake.view_failures = 15
        with self.assertRaises(queue.InfraStop):
            self.run_q(clips=["r01c1"])
        self.assertEqual(self.project.takes(), [])
        self.assertTrue(json.loads((self.project.path / "inflight.json").read_text()))
        n = len(self.fake.submitted)
        r = self.run_q(clips=["r01c1"])
        self.assertEqual(len(self.fake.submitted), n)          # fetched from history, not regenerated
        self.assertEqual(r["passed"], {"r01c1": 1})
        self.assertEqual(len(json.loads((self.project.path / "inflight.json").read_text())), 2)   # take 1 cleared; rounds 2 and 3 still unfetched

    def test_download_retries_then_succeeds(self):
        self.comfy.retry_delay = 0.0
        self.fake.view_failures = 2
        self.assertEqual(self.run_q(clips=["r01c1"])["passed"], {"r01c1": 1})
        self.assertEqual(len(self.fake.submitted), 1)

    def test_oom_is_reported_with_tier_and_stops_after_three(self):
        self.fake.fail_when = lambda g: "oom"
        self.project = make_project(Path(self.tmp.name) / "b", 5)
        lines: list = []
        with self.assertRaises(queue.InfraStop) as cm:
            self.run_q(log=lines.append, tier=TIERS["q1"])
        self.assertIn("q1", str(cm.exception))
        self.assertIn("memory", str(cm.exception).lower())
        self.assertLessEqual(len(self.fake.submitted), 5)
        self.assertTrue(any("OUT OF GPU MEMORY" in x for x in lines))

    def test_connection_refused_stops_after_three(self):
        with socket.socket() as s:
            s.bind(("127.0.0.1", 0))
            port = s.getsockname()[1]
        self.project = make_project(Path(self.tmp.name) / "c", 5)
        dead = Comfy(f"http://127.0.0.1:{port}", settle=0.0)
        dead.upload = lambda p: "x"
        dead.missing = lambda g: []
        with self.assertRaises(queue.InfraStop) as cm:
            self.run_q(comfy=dead)
        self.assertIn("3 infrastructure failures", str(cm.exception))

    def test_missing_model_file_is_reported_before_any_job(self):
        self.fake.hide = "LoadAudio"
        with self.assertRaises(queue.InfraStop) as cm:
            self.run_q()
        self.assertIn("LoadAudio", str(cm.exception))
        self.assertEqual(self.fake.submitted, [])

    def test_log_has_running_average(self):
        lines: list = []
        self.run_q(log=lines.append)
        gen = [x for x in lines if "s on GPU" in x]
        self.assertEqual(len(gen), 3)
        self.assertIn("average 40 s over 1 takes", gen[0])
        self.assertIn("average 25 s over 2 takes", gen[1])

    def test_depth_two_keeps_gpu_fed(self):
        self.fake.delay = 0.15
        self.project = make_project(Path(self.tmp.name) / "d", 4)
        self.run_q()
        self.assertEqual(self.fake.max_depth, 2)

    def test_judge_runs_in_background(self):
        starts: list[float] = []

        def slow(clip, take):
            starts.append(time.time())
            time.sleep(0.4)
            return ok_judge(clip, take)
        t0 = time.time()
        self.fake.delay = 0.1
        self.run_q(judge=slow, judge_workers=3)
        self.assertLess(time.time() - t0, 0.4 * 3)     # three judges overlapped each other and the GPU
        self.assertEqual(len(starts), 3)

    def test_judge_crash_keeps_take(self):
        def boom(clip, take):
            raise RuntimeError("whisper missing")
        r = self.run_q(judge=boom, log=nolog)
        self.assertEqual(len(self.project.takes()), 3)
        self.assertEqual(r["passed"], {})
        self.assertEqual(r["unjudged"], ["r01c1", "r01c2", "r01c3"])
        self.assertEqual(r["failed"], [])
        self.assertIsNone(self.project.check("r01c1", 1))     # not saved: judged again next time


class PilotTests(Base):
    def test_measures_warm_seconds_per_tier(self):
        log: list = []
        r = pilot.run(self.project, CFG, self.comfy, ok_judge, lambda: None, render=render, log=log.append)
        self.assertEqual(set(r), {t.id for t in CFG["tiers"]})
        self.assertTrue(all(v == 10.0 for v in r.values()))        # the 40 s cold start is not in any median
        data = json.loads((self.project.path / "pilot.json").read_text())
        self.assertEqual(data["q1"]["takes"][0]["seconds"], 40.0)
        self.assertEqual(data["q1"]["passed"], 2)
        self.assertEqual(len(data["q5"]["takes"]), 2)
        self.assertEqual(len({t["clip"] for t in data["q1"]["takes"]}), 2)
        self.assertEqual(len(self.fake.submitted), 10)

    def test_survives_budget_stop_and_resumes(self):
        calls = []

        def tick():
            calls.append(1)
            if len(calls) == 6:
                raise BudgetStop("pilot cap")
        part = pilot.run(self.project, CFG, self.comfy, ok_judge, tick, render=render, log=nolog)
        self.assertEqual(part, {"q1": 10.0, "q2": 10.0})
        data = json.loads((self.project.path / "pilot.json").read_text())
        self.assertNotIn("seconds", data["q3"])
        self.assertEqual(len(data["q1"]["takes"]), 2)
        self.assertEqual(len(data["q2"]["takes"]), 2)
        self.assertEqual(len(data["q3"]["takes"]), 1)
        self.assertEqual(data["q1"]["seconds"], 10.0)
        self.assertEqual(len(self.fake.submitted), 5)
        r = pilot.run(self.project, CFG, self.comfy, ok_judge, lambda: None, render=render, log=nolog)
        self.assertEqual(len(self.fake.submitted), 10)
        self.assertEqual(len(r), 5)

    def test_tier_with_one_take_has_no_measurement(self):
        calls = []

        def tick():
            calls.append(1)
            if len(calls) == 2:
                raise BudgetStop("x")
        self.assertEqual(pilot.run(self.project, CFG, self.comfy, ok_judge, tick, render=render, log=nolog), {})
        self.assertNotIn("seconds", json.loads((self.project.path / "pilot.json").read_text())["q1"])


if __name__ == "__main__":
    unittest.main()
