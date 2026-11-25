"""compute tests: a fake Vast HTTP server on loopback, a fake clock and a fake ssh. No internet, no money."""
from __future__ import annotations
import base64
import dataclasses
import gzip
import json
import signal
import subprocess
import tempfile
import threading
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

from ugc.compute import BudgetStop, Declined, DestroyFailed, Interrupted, Session, budget, onstart, pick, reap
from ugc.compute.api import AmbiguousCreate, Offer, Vast, VastError
from ugc.compute.ledger import Ledger
from ugc.compute.session import ComputeError
from ugc.contract import Project, load_config

KEY = "SECRETKEY-0123456789abcdef"
CFG = load_config()


def raw_offer(**over) -> dict:
    r = {"id": 100, "gpu_name": "RTX 5090D", "num_gpus": 1, "dph_total": 0.52, "min_bid": 0.30, "geolocation": "Japan, JP",
         "cpu_ram": 65000, "inet_down": 900.0, "inet_down_cost": 0.0027, "reliability2": 0.98, "dlperf": 197.0,
         "storage_cost": 0.2, "disk_space": 500.0, "cuda_max_good": 13.2, "verification": "verified"}
    r.update(over)
    return r


def offer(interruptible=False, **over) -> Offer:
    return Offer.from_raw(raw_offer(**over), CFG, interruptible)


class FakeClock:
    def __init__(self):
        self.t = 1_800_000_000.0

    def time(self) -> float:
        return self.t

    def sleep(self, s: float) -> None:
        self.t += s


class FakeVastServer:
    """Just enough of the Vast REST API, with switches for the failure modes."""

    def __init__(self):
        self.instances: dict[int, dict] = {}
        self.offers = [raw_offer()]
        self.balance = 10.0
        self.keys = [{"key": "ssh-ed25519 AAAA", "deleted_at": None}]
        self.creates = 0
        self.create_bodies: list[dict] = []
        self.create_mode = "ok"        # ok | refuse | ambiguous (rents, then 500) | lost (500, rents nothing)
        self.statuses = ["loading", "running"]
        self.fail: dict[str, list[int]] = {}
        self.requests: list[str] = []
        self.refuse_destroy = False
        self.empty_means_null = False
        self.next_id = 7001
        self.last_query: dict = {}
        fake = self

        class H(BaseHTTPRequestHandler):
            def log_message(self, *a):
                pass

            def reply(self, code: int, body):
                data = body if isinstance(body, bytes) else json.dumps(body).encode()
                self.send_response(code)
                self.send_header("Content-Length", str(len(data)))
                self.end_headers()
                self.wfile.write(data)

            def handle_any(self):
                u = urlparse(self.path)
                n = int(self.headers.get("Content-Length") or 0)
                body = json.loads(self.rfile.read(n)) if n else None
                auth = self.headers.get("Authorization", "")
                fake.requests.append(f"{self.command} {u.path}")
                if auth != f"Bearer {KEY}":
                    return self.reply(401, {"success": False, "error": "auth_error", "msg": f"Invalid user key {auth}"})
                route = fake.route(self.command, u.path)
                if fake.fail.get(route):
                    return self.reply(fake.fail[route].pop(0), b"API requests too frequent")
                code, out = fake.handle(self.command, u, body)
                self.reply(code, out)

            do_GET = do_PUT = do_DELETE = handle_any

        self.server = ThreadingHTTPServer(("127.0.0.1", 0), H)
        self.base = f"http://127.0.0.1:{self.server.server_address[1]}"
        threading.Thread(target=self.server.serve_forever, kwargs={"poll_interval": 0.02}, daemon=True).start()

    @staticmethod
    def route(method: str, path: str) -> str:
        for k in ("bundles", "asks", "instances", "users", "ssh"):
            if f"/{k}" in path:
                return f"{method} {k}"
        return f"{method} {path}"

    def rent(self, label: str, body: dict) -> int:
        i = self.next_id
        self.next_id += 1
        self.instances[i] = {"id": i, "label": label, "seq": list(self.statuses), "polls": 0, "forced": None, "status_msg": "",
                             "ssh_host": "ssh9.fake", "ssh_port": 2222 + i, "dph_total": 0.53, "image": body.get("image")}
        return i

    def view(self, d: dict, advance: bool) -> dict:
        if advance:
            d["polls"] += 1
        st = d["forced"] or d["seq"][min(d["polls"] - 1 if advance else d["polls"], len(d["seq"]) - 1)]
        out = {k: d[k] for k in ("id", "label", "ssh_host", "ssh_port", "dph_total", "status_msg")}
        out.update(actual_status=st, cur_state="running" if st == "running" else "stopped" if st == "exited" else "loading",
                   intended_status="running")
        return out

    def handle(self, method: str, u, body):
        p = u.path
        if p.startswith("/api/v0/bundles"):
            self.last_query = json.loads(parse_qs(u.query)["q"][0])
            return 200, {"offers": self.offers, "truncated": False}
        if p == "/api/v0/users/current":
            return 200, {"balance": self.balance}
        if p == "/api/v0/ssh":
            return (200, self.keys) if self.keys else (404, {"msg": "no keys"})
        if p.startswith("/api/v0/asks/") and method == "PUT":
            self.creates += 1
            self.create_bodies.append(body)
            if self.create_mode == "refuse":
                return 400, {"success": False, "error": "invalid_args", "msg": "bad offer"}
            if self.create_mode == "lost":
                return 500, b"oops"
            i = self.rent(body.get("label", ""), body)
            if self.create_mode == "ambiguous":
                return 500, b"gateway timeout"
            return 200, {"success": True, "new_contract": i}
        if p.startswith("/api/v0/instances/"):
            i = int(p.rsplit("/", 1)[1])
            if method == "DELETE":
                if i in self.instances and not self.refuse_destroy:
                    del self.instances[i]
                return 200, {"success": True}
            if i not in self.instances:
                return (200, {"instances": None}) if self.empty_means_null else (404, {"msg": "not found"})
            return 200, {"instances": self.view(self.instances[i], True)}
        if p.startswith("/api/v1/instances"):
            q = parse_qs(u.query)
            start = int(q.get("after_token", ["0"])[0])
            items = [self.view(d, False) for d in self.instances.values()]
            page = items[start:start + 2]
            nxt = str(start + 2) if start + 2 < len(items) else None
            return 200, {"success": True, "instances": page, "next_token": nxt}
        return 404, {"msg": "no route"}


class FakeProc:
    def __init__(self, argv):
        self.argv, self.alive = argv, True

    def poll(self):
        return None if self.alive else 255

    def terminate(self):
        self.alive = False

    def kill(self):
        self.alive = False

    def wait(self, timeout=None):
        return 0


class Base(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.fake = FakeVastServer()
        self.addCleanup(self.fake.server.server_close)
        self.addCleanup(self.fake.server.shutdown)
        self.clock = FakeClock()
        self.vast = Vast(KEY, self.fake.base, sleep=self.clock.sleep)
        self.project = Project(Path(self.tmp.name) / "proj")
        self.procs: list[FakeProc] = []
        self.logs: list[str] = []
        self.texts: list[str] = []
        self.ledger = Ledger(self.project.p("ledger.jsonl"))

    def spawn(self, argv, log_path):
        p = FakeProc(argv)
        self.procs.append(p)
        return p

    def session(self, confirm=None, **kw) -> Session:
        def yes(text):
            self.texts.append(text)
            return True
        kw.setdefault("probe", lambda url: True)
        return Session(self.vast, self.project, CFG, confirm or yes, self.clock, spawn=self.spawn, log=self.logs.append, **kw)

    def ledger_text(self) -> str:
        f = self.project.path / "ledger.jsonl"
        return f.read_text() if f.exists() else ""


class TestSession(Base):
    def test_happy_path_destroys(self):
        with self.session() as s:
            self.assertEqual(s.url, f"http://127.0.0.1:{s.local_port}")
            self.assertEqual(len(self.fake.instances), 1)
            self.assertIn(s.id, self.ledger.open_ids())
        self.assertEqual(self.fake.instances, {})
        self.assertEqual(self.ledger.open_ids(), [])
        self.assertLess(self.ledger.spent(self.clock.time()), 1.0)
        self.assertEqual(self.fake.creates, 1)
        body = self.fake.create_bodies[0]
        self.assertTrue(body["label"].startswith("ugc-proj-"))
        self.assertEqual(body["image"], onstart.IMAGE)
        self.assertLessEqual(len(body["onstart"]), 4048)
        argv = self.procs[0].argv
        self.assertEqual(argv[0], "ssh")
        self.assertIn(f"127.0.0.1:{s.local_port}:127.0.0.1:8188", argv)
        self.assertIn("StrictHostKeyChecking=accept-new", argv)
        self.assertIn(f"UserKnownHostsFile={self.project.path / 'known_hosts'}", argv)
        self.assertFalse(self.procs[0].alive)
        self.assertIn("max spend", self.texts[0])
        self.assertIn("Japan, JP", self.texts[0])
        self.assertIn("/hour", self.texts[0])
        self.assertIn("max hours", self.texts[0])
        self.assertIn("reliability", self.texts[0])
        self.assertIn("perf", self.texts[0])
        self.assertIn("$0.12 download", self.texts[0])
        self.assertTrue(self.fake.last_query["verified"]["eq"] if self.fake.last_query else False)

    def test_exception_in_body_destroys(self):
        with self.assertRaises(ValueError):
            with self.session():
                raise ValueError("boom")
        self.assertEqual(self.fake.instances, {})
        self.assertEqual(self.ledger.open_ids(), [])

    def test_create_refused_spends_nothing(self):
        self.fake.create_mode = "refuse"
        with self.assertRaises(VastError):
            with self.session():
                pass
        self.assertEqual(self.fake.instances, {})
        self.assertEqual(self.ledger.spent(self.clock.time()), 0.0)
        self.assertEqual(self.ledger.unresolved(), [])
        self.assertEqual(self.fake.creates, 1)

    def test_never_running_status_destroys(self):
        self.fake.statuses = ["loading", "exited"]
        with self.assertRaises(ComputeError) as cm:
            with self.session():
                pass
        self.assertIn("never run", str(cm.exception))
        self.assertEqual(self.fake.instances, {})
        self.assertEqual(self.ledger.open_ids(), [])

    def test_ready_timeout_destroys(self):
        with self.assertRaises(ComputeError) as cm:
            with self.session(probe=lambda url: False, ready_timeout=120):
                pass
        self.assertIn("did not answer", str(cm.exception))
        self.assertEqual(self.fake.instances, {})

    def test_stuck_loading_times_out_and_destroys(self):
        self.fake.statuses = ["loading"]
        with self.assertRaises(ComputeError):
            with self.session():
                pass
        self.assertEqual(self.fake.instances, {})

    def test_ctrl_c_during_wait_destroys_and_restores_handlers(self):
        before = signal.getsignal(signal.SIGINT)
        hits = []

        def probe(url):
            if not hits:
                hits.append(1)
                signal.raise_signal(signal.SIGINT)
            return True
        with self.assertRaises(KeyboardInterrupt):
            with self.session(probe=probe):
                pass
        self.assertEqual(self.fake.instances, {})
        self.assertEqual(self.ledger.open_ids(), [])
        self.assertIs(signal.getsignal(signal.SIGINT), before)

    def test_sigterm_inside_body_destroys(self):
        with self.assertRaises(KeyboardInterrupt):
            with self.session():
                signal.raise_signal(signal.SIGTERM)
        self.assertEqual(self.fake.instances, {})

    def test_confirm_false_spends_nothing(self):
        with self.assertRaises(Declined):
            with self.session(confirm=lambda t: False):
                self.fail("body must not run")
        self.assertEqual(self.fake.creates, 0)
        self.assertEqual(self.ledger_text(), "")

    def test_cap_check_before_create(self):
        now = self.clock.time()
        self.ledger.intend("old", 0.5, 0.0, 0.0, now - 19 * 3600)
        self.ledger.open(1, 0.5, 0.0, "old", 0.0, now - 19 * 3600)
        self.ledger.close(1, now)
        self.assertGreater(self.ledger.spent(now), 9.4)
        with self.assertRaises(BudgetStop):
            with self.session():
                pass
        self.assertEqual(self.fake.creates, 0)

    def test_balance_must_cover_the_session(self):
        self.fake.balance = 1.0
        with self.assertRaises(ComputeError) as cm:
            with self.session():
                pass
        self.assertIn("balance", str(cm.exception))
        self.assertEqual(self.fake.creates, 0)

    def test_no_ssh_key_registered_refuses(self):
        self.fake.keys = []
        with self.assertRaises(ComputeError):
            with self.session():
                pass
        self.assertEqual(self.fake.creates, 0)

    def test_tick_stops_at_the_cap(self):
        now = self.clock.time()
        self.ledger.intend("old", 1.0, 0.0, 0.0, now - 6 * 3600)
        self.ledger.open(1, 1.0, 0.0, "old", 0.0, now - 6 * 3600)
        self.ledger.close(1, now)
        with self.session() as s:
            s.tick()
            self.clock.sleep(8 * 3600)
            with self.assertRaises(BudgetStop):
                s.tick()
        self.assertEqual(self.fake.instances, {})

    def test_take_seconds_widens_the_margin(self):
        a, b = self.session(), self.session(take_seconds=820)
        self.assertEqual(a.margin_s, 600)
        self.assertEqual(b.margin_s, 1230)
        self.assertEqual(self.session(take_seconds=100).margin_s, 600)

    def test_summary_line(self):
        t = offer().summary()
        for bit in ("RTX 5090D", "JP", "$0.520/h", "on-demand", "RAM", "Mbps", "0.980", "197", "$0.12"):
            self.assertIn(bit, t)
        self.assertIn("interruptible", offer(interruptible=True).summary())

    def test_pilot_limit_is_lower(self):
        with self.session(pilot=True) as s:
            self.assertLessEqual(s.limit, CFG["budget"]["pilot_usd"])
            self.clock.sleep(3 * 3600)
            with self.assertRaises(BudgetStop):
                s.tick()
        self.assertEqual(self.fake.instances, {})

    def test_interruptible_outbid_raises_interrupted_then_cleans_up(self):
        self.fake.offers = [raw_offer()]
        with self.assertRaises(Interrupted):
            with self.session(interruptible=True) as s:
                self.fake.instances[s.id]["forced"] = "exited"
                self.clock.sleep(30)
                s.tick()
        self.assertEqual(self.fake.instances, {})
        self.assertEqual(self.fake.create_bodies[0]["price"], round(0.30 * 1.10 + 0.0005, 4))

    def test_vanished_machine_is_interrupted(self):
        with self.assertRaises(Interrupted):
            with self.session() as s:
                del self.fake.instances[s.id]
                self.clock.sleep(30)
                s.tick()

    def test_ambiguous_create_is_found_by_label_not_retried(self):
        self.fake.create_mode = "ambiguous"
        with self.session() as s:
            self.assertEqual(len(self.fake.instances), 1)
            self.assertEqual(s.id, next(iter(self.fake.instances)))
        self.assertEqual(self.fake.creates, 1)
        self.assertEqual(self.fake.instances, {})
        self.assertEqual(self.ledger.open_ids(), [])

    def test_lost_create_response_keeps_counting_until_reap_settles_it(self):
        self.fake.create_mode = "lost"
        with self.assertRaises(ComputeError):
            with self.session():
                pass
        self.assertEqual(self.fake.creates, 1)
        self.assertEqual(len(self.ledger.unresolved()), 1)
        with self.assertRaises(ComputeError) as cm:          # and no new rental meanwhile
            with self.session():
                pass
        self.assertIn("reap", str(cm.exception))
        self.assertEqual(self.fake.creates, 1)
        self.clock.sleep(600)
        self.assertEqual(reap(self.vast, self.project, lambda t: True, self.clock, self.logs.append), [])
        self.assertEqual(self.ledger.unresolved(), [])

    def test_destroy_not_confirmed_is_loud(self):
        self.fake.refuse_destroy = True
        with self.assertRaises(DestroyFailed) as cm:
            with self.session() as s:
                iid = s.id
        self.assertIn(str(iid), str(cm.exception))
        self.assertTrue(any("!!!" in m and str(iid) in m for m in self.logs))
        self.assertEqual(self.ledger.open_ids(), [iid])      # still counted
        self.fake.refuse_destroy = False
        self.assertEqual(reap(self.vast, self.project, lambda t: True, self.clock, self.logs.append), [iid])
        self.assertEqual(self.fake.instances, {})

    def test_destroy_failure_after_error_chains_original(self):
        self.fake.refuse_destroy = True
        with self.assertRaises(DestroyFailed) as cm:
            with self.session():
                raise ValueError("original")
        self.assertIsInstance(cm.exception.__context__, ValueError)

    def test_key_never_leaks(self):
        with self.session():
            pass
        bad = Vast("BADKEY-zzzzzzzz", self.fake.base, sleep=self.clock.sleep)
        with self.assertRaises(VastError) as cm:
            bad.balance()
        self.assertNotIn("BADKEY-zzzzzzzz", str(cm.exception))
        self.assertIn("***", str(cm.exception))
        everything = self.ledger_text() + "\n".join(self.logs + self.texts) + "".join(" ".join(p.argv) for p in self.procs)
        everything += json.dumps(self.fake.create_bodies)
        self.assertNotIn(KEY, everything)


class TestReap(Base):
    def test_crash_between_create_and_ledger_write(self):
        label = "ugc-proj-deadbeef01"
        self.ledger.intend(label, 0.52, 0.02, 0.1, self.clock.time())
        iid = self.vast.create(offer(), CFG, "echo hi", label=label)       # then the process "dies": no open row
        self.assertEqual(self.ledger.open_ids(), [])
        self.assertEqual(len(self.ledger.unresolved()), 1)
        asked = []
        self.assertEqual(reap(self.vast, self.project, lambda t: asked.append(t) or True, self.clock, self.logs.append), [iid])
        self.assertIn(str(iid), asked[0])
        self.assertEqual(self.fake.instances, {})
        self.assertEqual(self.ledger.unresolved(), [])
        self.assertEqual(self.ledger.open_ids(), [])

    def test_reap_ignores_foreign_instances(self):
        label = "ugc-proj-aaaaaaaaaa"
        self.ledger.intend(label, 0.5, 0.0, 0.0, self.clock.time())
        ours = self.vast.create(offer(), CFG, "x", label=label)
        self.fake.instances[9001] = self.fake.rent("someone-else", {}) and {**self.fake.instances.pop(self.fake.next_id - 1), "id": 9001, "label": "someone-else"}
        self.fake.instances[9002] = {**self.fake.instances[9001], "id": 9002, "label": "ugc-proj-bbbbbbbbbb"}
        self.ledger.open(7777, 0.5, 0.0, "ugc-proj-cccccccccc", 0.0, self.clock.time())
        self.fake.instances[7777] = {**self.fake.instances[9001], "id": 7777, "label": "not-ours"}
        self.assertEqual(reap(self.vast, self.project, lambda t: True, self.clock, self.logs.append), [ours])
        self.assertEqual(sorted(self.fake.instances), [7777, 9001, 9002])
        self.assertTrue(any("7777" in m for m in self.logs))

    def test_reap_declined_destroys_nothing(self):
        with self.session() as s:
            iid = s.id
            self.assertEqual(reap(self.vast, self.project, lambda t: False, self.clock, self.logs.append), [])
            self.assertIn(iid, self.fake.instances)

    def test_reap_closes_runs_whose_machine_is_already_gone(self):
        self.ledger.open(55, 0.5, 0.0, "ugc-proj-gone000000", 0.0, self.clock.time())
        self.assertEqual(reap(self.vast, self.project, lambda t: True, self.clock, self.logs.append), [])
        self.assertEqual(self.ledger.open_ids(), [])

    def test_reap_empty_ledger(self):
        self.assertEqual(reap(self.vast, self.project, lambda t: True, self.clock), [])


class TestApi(Base):
    def test_reads_retry_on_429_and_5xx(self):
        self.fake.fail["GET bundles"] = [429, 500]
        offers = self.vast.search(CFG, False)
        self.assertEqual(len(offers), 1)
        self.assertEqual(self.fake.requests.count("GET /api/v0/bundles/"), 3)

    def test_read_gives_up_with_clear_error(self):
        self.fake.fail["GET users"] = [500] * 10
        with self.assertRaises(VastError) as cm:
            self.vast.balance()
        self.assertIn("500", str(cm.exception))
        self.assertNotIn(KEY, str(cm.exception))

    def test_create_is_never_retried(self):
        self.fake.create_mode = "lost"
        with self.assertRaises(AmbiguousCreate):
            self.vast.create(offer(), CFG, "x", label="l")
        self.assertEqual(self.fake.creates, 1)

    def test_get_handles_404_and_null(self):
        self.assertIsNone(self.vast.get(1))
        self.fake.empty_means_null = True
        self.assertIsNone(self.vast.get(1))

    def test_list_mine_paginates(self):
        for i in range(5):
            self.fake.rent(f"l{i}", {})
        self.assertEqual(len(self.vast.list_mine()), 5)

    def test_destroy_is_idempotent(self):
        self.vast.destroy(424242)

    def test_search_query_is_scoped(self):
        self.vast.search(CFG, True)
        q = self.fake.last_query
        self.assertEqual(q["type"], "bid")
        self.assertEqual(q["num_gpus"], {"eq": 1})
        self.assertIn("RTX 5090D", q["gpu_name"]["in"])
        self.assertIn("RTX 5090 D", q["gpu_name"]["in"])
        self.assertEqual(q["disk_space"], {"gte": CFG["compute"]["disk_gb"]})

    def test_offer_parsing(self):
        o = offer()
        self.assertEqual(o.country, "JP")
        self.assertAlmostEqual(o.download_usd, 0.0027 * 45)
        self.assertAlmostEqual(o.ram_gb, 65000 / 1024)
        self.assertEqual(offer(geolocation=", CN").country, "CN")
        self.assertEqual(offer(geolocation="Somewhere").country, "")
        self.assertAlmostEqual(offer(interruptible=True).dph, round(0.30 * 1.1 + 0.0005, 4))


class TestPick(unittest.TestCase):
    def why(self, **over) -> str:
        o = offer(**over)
        return pick.rejections([o], CFG).get(o.id, "")

    def test_default_offer_is_accepted(self):
        self.assertEqual(self.why(), "")

    def test_rejections(self):
        self.assertIn("unknown country", self.why(geolocation="Somewhere"))
        self.assertIn("unknown country", self.why(geolocation=""))
        self.assertIn("excluded", self.why(geolocation="Germany, DE"))
        self.assertIn("excluded", self.why(geolocation="United States, US"))
        self.assertIn("excluded", self.why(geolocation="London, GB"))
        self.assertIn("avoided", self.why(geolocation=", CN"))
        self.assertIn("max_dph", self.why(dph_total=0.71))
        self.assertIn("RAM", self.why(cpu_ram=40000))
        self.assertIn("reliability", self.why(reliability2=0.9))
        self.assertIn("Mbps", self.why(inet_down=100))
        self.assertIn("disk", self.why(disk_space=50))
        self.assertIn("GPU", self.why(gpu_name="RTX 3090"))
        self.assertIn("GPUs", self.why(num_gpus=2))
        self.assertIn("CUDA", self.why(cuda_max_good=12.4))
        self.assertIn("verified", self.why(verification="deverified"))

    def test_interruptible_is_priced_by_bid(self):
        o = offer(interruptible=True, dph_total=0.9, min_bid=0.30)
        self.assertEqual(pick.rejections([o], CFG), {})
        o = offer(interruptible=True, min_bid=0.70)
        self.assertIn("max_dph", pick.rejections([o], CFG)[o.id])

    def test_gpu_name_normalisation(self):
        for name in ("RTX 5090D", "RTX 5090 D", "RTX_5090D", "RTX_5090_D", "NVIDIA GeForce RTX 5090 D", "rtx 5090d"):
            self.assertEqual(self.why(gpu_name=name), "", name)
        self.assertNotEqual(self.why(gpu_name="RTX 5080"), "")
        self.assertEqual(pick.norm_gpu("RTX 5090"), "RTX5090")
        self.assertNotEqual(pick.norm_gpu("RTX 5090"), pick.norm_gpu("RTX 5090D"))

    def test_ranking_uses_total_cost_per_performance(self):
        cheap_slow = offer(id=1, dph_total=0.40, dlperf=100)
        dear_fast = offer(id=2, dph_total=0.50, dlperf=197)
        ranked = pick.choose([cheap_slow, dear_fast], CFG)
        self.assertEqual([o.id for o in ranked], [2, 1])

    def test_reliability_breaks_ties_and_download_cost_is_carried(self):
        a, b = offer(id=1, reliability2=0.975), offer(id=2, reliability2=0.99)
        ranked = pick.choose([a, b], CFG)
        self.assertEqual([o.id for o in ranked], [2, 1])
        self.assertAlmostEqual(ranked[0].download_usd, 0.0027 * 45)
        pricey_dl = offer(id=3, inet_down_cost=0.05)
        self.assertGreater(pick.job_cost(dataclasses.replace(pricey_dl, download_usd=0.05 * 45), CFG), pick.job_cost(a, CFG))

    def test_choose_drops_rejected(self):
        self.assertEqual(pick.choose([offer(geolocation="Germany, DE"), offer(id=5, geolocation="Japan, JP")], CFG)[0].id, 5)
        self.assertEqual(pick.choose([offer(geolocation="Germany, DE")], CFG), [])


class TestBudget(unittest.TestCase):
    def test_projection_includes_everything(self):
        base = budget.project(205, 90, 0.522, CFG)
        work = 90 * 1.6 * 205 / 3600
        self.assertAlmostEqual(base.hours, 0.4 + work)
        dl = 45 * budget.DEFAULT_DOWN_USD_PER_GB
        st = budget.storage_per_hour(90)
        self.assertAlmostEqual(base.usd, (0.4 + work) * (0.522 + st) + dl)
        self.assertTrue(base.fits)
        self.assertGreater(budget.project(205, 90, 0.522, CFG, interruptible=True).hours, base.hours)
        self.assertAlmostEqual(budget.project(205, 90, 0.522, CFG, interruptible=True).hours, 0.4 + work * 1.2)

    def test_fits_compares_spent_plus_projected_with_cap(self):
        p = budget.project(205, 90, 0.522, CFG)
        self.assertTrue(budget.project(205, 90, 0.522, CFG, spent=9.5 - p.usd - 0.01).fits)
        self.assertFalse(budget.project(205, 90, 0.522, CFG, spent=9.5 - p.usd + 0.01).fits)
        self.assertFalse(budget.project(411, 90, 0.522, CFG).fits)

    def test_explicit_download_and_storage(self):
        p = budget.project(100, 10, 0.5, CFG, download_usd=0.0, storage_per_h=0.0)
        self.assertAlmostEqual(p.usd, p.hours * 0.5)

    def test_best_tier_takes_first_fit_in_config_order(self):
        measured = {"q1": 500.0, "q2": 330.0, "q5": 120.0}
        t = budget.best_tier(measured, 90, 0.522, CFG, 0.0, False)
        self.assertEqual(t.id, "q2" if budget.project(330, 90, 0.522, CFG).fits else "q5")
        self.assertFalse(budget.project(500, 90, 0.522, CFG).fits)
        self.assertIsNone(budget.best_tier({"q1": 900.0}, 90, 0.522, CFG, 0.0, False))
        self.assertIsNone(budget.best_tier({"q5": 120.0}, 90, 0.522, CFG, 9.4, False))
        self.assertIsNone(budget.best_tier({}, 90, 0.522, CFG, 0.0, False))


class TestLedger(Base):
    def test_spent_counts_open_machines_and_survives_torn_line(self):
        t = self.clock.time()
        self.ledger.intend("a", 1.0, 0.1, 0.5, t)
        self.ledger.open(5, 1.0, 0.1, "a", 0.5, t)
        self.assertAlmostEqual(self.ledger.spent(t + 3600), 1.6)
        self.assertEqual(self.ledger.open_ids(), [5])
        with (self.project.path / "ledger.jsonl").open("a") as f:
            f.write('{"ev": "clo')
        self.assertAlmostEqual(self.ledger.spent(t + 7200), 2.7)
        self.ledger.close(5, t + 7200)
        self.assertAlmostEqual(self.ledger.spent(t + 99999), 2.7)
        self.assertEqual(self.ledger.open_ids(), [])

    def test_intend_without_id_counts_and_void_clears(self):
        t = self.clock.time()
        self.ledger.intend("b", 1.0, 0.0, 0.0, t)
        self.assertAlmostEqual(self.ledger.spent(t + 1800), 0.5)
        self.assertEqual(len(self.ledger.unresolved()), 1)
        self.ledger.void("b", "test", t + 1800)
        self.assertEqual(self.ledger.spent(t + 1800), 0.0)


class TestOnstart(unittest.TestCase):
    def body(self) -> str:
        s = onstart.script(CFG, 9.0)
        self.assertLessEqual(len(s), 4048)
        if "base64 -d" in s:
            b64 = s.split("echo ", 1)[1].split("|", 1)[0]
            return gzip.decompress(base64.b64decode(b64)).decode()
        return s

    def test_size_and_decoding(self):
        self.assertEqual(self.body(), onstart.full_script(CFG, 9.0))

    def test_pins_and_safety(self):
        s = self.body()
        self.assertIn(onstart.COMFY_COMMIT, s)
        self.assertIn("--listen 127.0.0.1", s)
        self.assertNotIn("0.0.0.0", s)
        self.assertIn("MAXS=32400", s)
        self.assertIn(f"IDLES={int(CFG['budget']['idle_minutes'] * 60)}", s)
        for needle in ("CONTAINER_API_KEY", "CONTAINER_ID", "DELETE", "stopped", "setsid nohup", "aria2c", "-C -"):
            self.assertIn(needle, s)
        for name, (repo, rev, path, dest, size) in onstart.model_files(CFG):
            self.assertIn(f"{repo} {rev} {path} {dest} {size}", s)
            self.assertEqual(len(rev), 40)
        self.assertNotIn("VAST_API_KEY", s)

    def test_download_size_fits_config(self):
        self.assertLessEqual(onstart.total_bytes(CFG), CFG["budget"]["download_gb"] * 1e9)
        self.assertGreater(onstart.total_bytes(CFG), 44e9)

    def test_unknown_model_file_is_an_error(self):
        cfg = {**CFG, "model": {**CFG["model"], "unet": "mystery.safetensors"}}
        with self.assertRaises(ValueError):
            onstart.script(cfg)

    def decide(self, now=100000, qn="", alive=1, up=1, last=None, maxs=10000) -> tuple[str, int]:
        dm = onstart.DEADMAN
        last = now - 5000 if last is None else last
        prog = (f"DM_TEST=1 T0=95000 MAXS={maxs} IDLES=600 SETUPS=5400 K= ID=\n{dm}\n"
                f"die(){{ echo \"DIE:$1\"; }}\ndate(){{ echo {now}; }}\ncurl(){{ return 0; }}\npython(){{ echo {qn!r}|tr -d \"'\"; }}\n"
                f"pgrep(){{ [ {alive} = 1 ]; }}\nup={up};last={last}\nstep\necho \"LAST:$last\"\n")
        r = subprocess.run(["bash", "-c", prog], capture_output=True, text=True, timeout=20)
        self.assertEqual(r.returncode, 0, r.stderr)
        die = next((x[4:] for x in r.stdout.splitlines() if x.startswith("DIE:")), "")
        return die, int(r.stdout.split("LAST:")[1])

    def test_deadman_decisions(self):
        now = 100000
        self.assertEqual(self.decide(qn="3"), ("", now))                       # busy: refreshed
        self.assertTrue(self.decide(qn="0")[0].startswith("idle"))              # read as empty for 5000 s
        self.assertEqual(self.decide(qn="0", last=now - 100), ("", now - 100))  # empty, not yet 10 min
        self.assertEqual(self.decide(qn="", alive=1), ("", now))                # unreadable, ComfyUI alive: busy
        self.assertTrue(self.decide(qn="", alive=0)[0].startswith("idle"))      # unreadable, process gone
        self.assertTrue(self.decide(maxs=4000, qn="3")[0].startswith("hard limit"))
        self.assertEqual(self.decide(qn="", up=0, alive=0, last=0)[0], "")      # still setting up

    def test_shell_syntax(self):
        with tempfile.TemporaryDirectory() as d:
            f = Path(d) / "s.sh"
            f.write_text(self.body())
            r = subprocess.run(["bash", "-n", str(f)], capture_output=True, text=True)
            self.assertEqual(r.returncode, 0, r.stderr)


if __name__ == "__main__":
    unittest.main()
