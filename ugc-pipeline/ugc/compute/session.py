"""A rented GPU session: cap check, confirm, create, tunnel, and a guaranteed destroy on every exit path."""
from __future__ import annotations
import re
import signal
import socket
import subprocess
import sys
import time
import urllib.request
import uuid
from pathlib import Path
from typing import Callable

from ..contract import Project
from . import onstart, pick
from .api import DEAD_STATUSES, AmbiguousCreate, Instance, Offer, Vast, VastError
from .ledger import Ledger

POLL_S = 5
RUNNING_TIMEOUT_S = 900          # create -> container running
READY_TIMEOUT_S = 2700           # create -> ComfyUI answering (image pull + install + 44 GB download)
VERIFY_TIMEOUT_S = 90
DESTROY_ATTEMPTS = 5
MARGIN_S = 600                   # tick keeps this much money in hand: one long take plus the destroy
STATE_POLL_S = 20
ORPHAN_GRACE_S = 300             # a create with no id is only declared void after this long
INSTANCE_URL = "https://cloud.vast.ai/instances/"


class ComputeError(RuntimeError):
    pass


class BudgetStop(ComputeError):
    pass


class Interrupted(ComputeError):
    """The machine was lost (outbid, stopped, vanished). Reopen a session to continue."""


class Declined(ComputeError):
    pass


class DestroyFailed(ComputeError):
    pass


def _stderr(msg: str) -> None:
    print(msg, file=sys.stderr, flush=True)


def _slug(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")[:30] or "p"


def destroy_verified(vast: Vast, id: int, clock, log: Callable[[str], None]) -> None:
    """Destroy, then poll until the API no longer shows the instance. Raises DestroyFailed, loudly."""
    last = "still listed"
    for attempt in range(DESTROY_ATTEMPTS):
        try:
            vast.destroy(id)
        except VastError as e:
            last = str(e)
            clock.sleep(2 + 3 * attempt)
            continue
        end = clock.time() + VERIFY_TIMEOUT_S
        while True:
            try:
                if vast.get(id) is None:
                    return
                last = "still listed after destroy"
            except VastError as e:
                last = str(e)
            if clock.time() >= end:
                break
            clock.sleep(3)
    log(f"!!! COULD NOT CONFIRM THAT INSTANCE {id} IS DESTROYED ({last}). IT MAY STILL BE BILLING.\n"
        f"!!! Destroy it now at {INSTANCE_URL} (instance {id}) or run the reap command.")
    raise DestroyFailed(f"instance {id} may still be running ({last}); destroy it at {INSTANCE_URL}")


def _free_port() -> int:
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def _probe(url: str) -> bool:
    try:
        with urllib.request.urlopen(url + "/system_stats", timeout=5) as r:
            return r.status == 200
    except OSError:
        return False


def _ssh_spawn(argv: list[str], log_path: Path):
    return subprocess.Popen(argv, stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=log_path.open("ab"))


class Session:
    def __init__(self, vast: Vast, project: Project, cfg: dict, confirm: Callable[[str], bool], clock=time, *,
                 interruptible: bool = False, pilot: bool = False, offer: Offer | None = None,
                 expected_usd: float | None = None, max_hours: float | None = None, ssh_key: str | None = None,
                 spawn: Callable = _ssh_spawn, probe: Callable[[str], bool] = _probe, local_port: int | None = None,
                 log: Callable[[str], None] = _stderr, ready_timeout: float = READY_TIMEOUT_S, take_seconds: float | None = None):
        self.margin_s = max(MARGIN_S, 1.5 * take_seconds) if take_seconds else MARGIN_S
        self.vast, self.project, self.cfg, self.confirm, self.clock = vast, project, cfg, confirm, clock
        self.interruptible, self.pilot, self._offer, self.expected_usd = interruptible, pilot, offer, expected_usd
        self.max_hours, self.ssh_key, self._spawn, self._probe, self.log = max_hours, ssh_key, spawn, probe, log
        self.ready_timeout = ready_timeout
        self.ledger = Ledger(project.p("ledger.jsonl"))
        self.known_hosts = project.p("known_hosts")
        self.local_port = local_port
        self.id: int | None = None
        self.label = f"ugc-{_slug(project.path.name)}-{uuid.uuid4().hex[:10]}"
        self.url = ""
        self.offer: Offer | None = None
        self.limit = min(cfg["budget"]["pilot_usd"], cfg["budget"]["cap_usd"]) if pilot else cfg["budget"]["cap_usd"]
        self._tunnel = None
        self._closing = False
        self._done = False
        self._searched = False
        self._intent = False
        self._opened = False
        self._last_state = 0.0
        self._old_handlers: dict = {}

    # ---- context manager
    def __enter__(self) -> "Session":
        self._install_signals()
        try:
            self._start()
        except BaseException as exc:
            try:
                self._teardown()
            except DestroyFailed as d:
                raise d from exc
            finally:
                self._restore_signals()
            raise
        return self

    def __exit__(self, *exc) -> bool:
        try:
            self._teardown()
        finally:
            self._restore_signals()
        return False

    def _install_signals(self) -> None:
        for s in (signal.SIGINT, signal.SIGTERM):
            try:
                self._old_handlers[s] = signal.signal(s, self._on_signal)
            except ValueError:      # not the main thread: the with-block still destroys on exceptions
                return

    def _restore_signals(self) -> None:
        for s, h in self._old_handlers.items():
            signal.signal(s, h)
        self._old_handlers = {}

    def _on_signal(self, signum, frame) -> None:
        if self._closing:
            self.log("Cleaning up the rented machine; please wait.")
            return
        raise KeyboardInterrupt(f"signal {signum}")

    # ---- money
    def _margin(self) -> float:
        o = self.offer
        return ((o.dph + o.storage_per_h(self.cfg["compute"]["disk_gb"])) if o else 1.0) * self.margin_s / 3600.0

    def _check_budget(self) -> None:
        spent = self.ledger.spent(self.clock.time())
        if spent + self._margin() >= self.limit:
            raise BudgetStop(f"spent ${spent:.2f} of ${self.limit:.2f}"
                             f"{' (pilot)' if self.pilot else ''}; stopping before the cap is passed")

    def tick(self) -> None:
        """Call before every job. BudgetStop near the cap; Interrupted if the machine is gone."""
        self._check_budget()
        if self._tunnel is not None and self._tunnel.poll() is not None:
            self._start_tunnel()
        now = self.clock.time()
        if self.id is not None and now - self._last_state >= STATE_POLL_S:
            self._last_state = now
            try:
                inst = self.vast.get(self.id)
            except VastError as e:
                self.log(f"Could not read the machine state ({e}); will retry.")
                return
            self._check_alive(inst)

    def _check_alive(self, inst: Instance | None) -> None:
        kind = "interruptible machine was outbid or stopped" if self.interruptible else "machine was lost"
        if inst is None:
            raise Interrupted(f"instance {self.id} has disappeared ({kind}, or its dead-man switch fired)")
        if inst.status in DEAD_STATUSES or inst.status == "stopped" or inst.cur_state == "stopped" or inst.intended == "stopped":
            raise Interrupted(f"instance {self.id} is {inst.status or inst.cur_state}: {kind}. {inst.status_msg}".strip())

    # ---- start
    def _start(self) -> None:
        now = self.clock.time()
        stale = self.ledger.runs()
        if any(r.live for r in stale):
            raise ComputeError("the ledger shows a machine that is not closed; run reap first so nothing is rented twice")
        spent = self.ledger.spent(now)
        remaining = self.limit - spent
        if remaining <= 0:
            raise BudgetStop(f"spent ${spent:.2f} of ${self.limit:.2f}{' (pilot)' if self.pilot else ''}; nothing left to rent with")
        offer = self._pick_offer()
        self.offer = offer
        disk = self.cfg["compute"]["disk_gb"]
        per_h = offer.dph + offer.storage_per_h(disk)
        hours = (remaining - offer.download_usd - self._margin()) / per_h
        if hours < 1.0:
            raise BudgetStop(f"${remaining:.2f} left buys {max(hours, 0):.1f} h of this machine; not enough to be useful")
        if self.max_hours:
            hours = min(hours, self.max_hours)
        max_spend = min(remaining, hours * per_h + offer.download_usd)
        need = self.expected_usd if self.expected_usd is not None else max_spend
        balance = self.vast.balance()
        if balance < need:
            raise ComputeError(f"account balance ${balance:.2f} is below the ${need:.2f} this session may spend; top up at https://cloud.vast.ai/billing/")
        if not self.vast.ssh_keys():
            raise ComputeError("no SSH key is registered on the Vast account; add one at https://cloud.vast.ai/manage-keys/ before renting")
        text = (f"Rent GPU machine #{offer.id}: {offer.summary()}\n"
                f"  price: ${offer.dph:.3f}/hour (+ about ${offer.storage_per_h(disk):.3f}/hour disk, ${offer.download_usd:.2f} download), machine in {offer.geolocation}\n"
                f"  max spend: ${max_spend:.2f} (limit ${self.limit:.2f}{', pilot' if self.pilot else ''}, already spent ${spent:.2f})\n"
                f"  max hours: {hours:.1f} (the machine destroys itself at that wall-clock limit)")
        if not self.confirm(text):
            raise Declined("not confirmed; nothing was rented")
        self._create(offer, hours)
        self._wait_ready()

    def _pick_offer(self) -> Offer:
        if self._offer is not None:
            ranked = pick.choose([self._offer], self.cfg)
            if not ranked:
                raise ComputeError(f"offer {self._offer.id} is not allowed: {pick.rejections([self._offer], self.cfg).get(self._offer.id)}")
            return ranked[0]
        offers = self.vast.search(self.cfg, self.interruptible)
        ranked = pick.choose(offers, self.cfg)
        if not ranked:
            why = sorted(set(pick.rejections(offers, self.cfg).values()))[:6]
            raise ComputeError(f"no machine passes the rules ({len(offers)} offers seen). Reasons: " + "; ".join(why or ["none listed"]))
        return ranked[0]

    def _create(self, offer: Offer, hours: float) -> None:
        disk = self.cfg["compute"]["disk_gb"]
        storage = offer.storage_per_h(disk)
        script = onstart.script(self.cfg, max(0.5, hours - 0.25))
        self.ledger.intend(self.label, offer.dph, storage, offer.download_usd, self.clock.time())
        self._intent = True
        try:
            self.id = self.vast.create(offer, self.cfg, script, label=self.label)
        except AmbiguousCreate as e:
            self.log(f"Create gave no clear answer ({e}); looking for the machine by label {self.label}.")
            self.id = self._find_by_label()
            if self.id is None:
                raise ComputeError(f"could not tell whether the rental happened (label {self.label}); the ledger keeps counting it; run reap in a few minutes") from e
        except VastError:
            self.ledger.void(self.label, "create refused", self.clock.time())
            self._intent = False
            raise
        self._record_open()

    def _record_open(self) -> None:
        o = self.offer
        self.ledger.open(self.id, o.dph, o.storage_per_h(self.cfg["compute"]["disk_gb"]), self.label, o.download_usd, self.clock.time())
        self._opened = True

    def _find_by_label(self) -> int | None:
        self._searched = True
        for i in range(4):
            self.clock.sleep(3 + 4 * i)
            for inst in self.vast.list_mine():
                if inst.label.startswith(self.label):
                    return inst.id
        return None

    def _wait_ready(self) -> None:
        t0 = self.clock.time()
        inst = None
        while True:
            self._check_budget()
            inst = self.vast.get(self.id)
            if inst is None and self.clock.time() - t0 > 60:
                raise ComputeError(f"instance {self.id} vanished while starting (the host may have dropped it); retry")
            if inst is not None:
                if inst.status in DEAD_STATUSES:
                    raise ComputeError(f"instance {self.id} went {inst.status} and will never run ({inst.status_msg}); it is being destroyed, try again or pick another machine")
                if inst.status == "running" and inst.ssh_host and inst.ssh_port:
                    break
            if self.clock.time() - t0 > RUNNING_TIMEOUT_S:
                raise ComputeError(f"instance {self.id} did not start within {RUNNING_TIMEOUT_S // 60} min (status {inst.status if inst else 'none'}); destroying it")
            self.clock.sleep(POLL_S)
        limit = self.cfg["budget"]["max_dph"] + self.offer.storage_per_h(self.cfg["compute"]["disk_gb"]) + 0.05
        if inst.dph and inst.dph > limit:
            raise ComputeError(f"instance {self.id} is billed ${inst.dph:.3f}/h, above the allowed ${limit:.3f}/h; destroying it")
        self.local_port = self.local_port or _free_port()
        self.url = f"http://127.0.0.1:{self.local_port}"
        self._start_tunnel(inst)
        last_spawn = self.clock.time()
        while not self._probe(self.url):
            self._check_budget()
            if self.clock.time() - t0 > self.ready_timeout:
                raise ComputeError(f"ComfyUI did not answer within {int(self.ready_timeout // 60)} min; destroying the machine. See /workspace/setup.log on it (not kept)")
            self.clock.sleep(POLL_S)
            inst = self.vast.get(self.id)
            if inst is not None and inst.status in DEAD_STATUSES:
                raise ComputeError(f"instance {self.id} went {inst.status} before ComfyUI was ready")
            if self._tunnel.poll() is not None and self.clock.time() - last_spawn >= 10:
                last_spawn = self.clock.time()
                self._start_tunnel(inst)

    def _start_tunnel(self, inst: Instance | None = None) -> None:
        inst = inst or self.vast.get(self.id)
        if inst is None or not inst.ssh_host:
            raise Interrupted(f"instance {self.id} has no SSH endpoint any more")
        self._stop_tunnel()
        self._forget_host(inst.ssh_host, inst.ssh_port)
        argv = ["ssh", "-N", "-L", f"127.0.0.1:{self.local_port}:127.0.0.1:8188", "-p", str(inst.ssh_port),
                "-o", "StrictHostKeyChecking=accept-new", "-o", f"UserKnownHostsFile={self.known_hosts}",
                "-o", "ExitOnForwardFailure=yes", "-o", "ServerAliveInterval=15", "-o", "ServerAliveCountMax=3",
                "-o", "BatchMode=yes", "-o", "ConnectTimeout=15"]
        if self.ssh_key:
            argv += ["-i", self.ssh_key, "-o", "IdentitiesOnly=yes"]
        self._tunnel = self._spawn(argv + [f"root@{inst.ssh_host}"], self.project.p("tunnel.log"))

    def _forget_host(self, host: str, port: int) -> None:
        """A recycled host:port may carry an old key; drop only that entry so accept-new can record the new one."""
        if not self.known_hosts.exists():
            return
        prefix = f"[{host}]:{port} "
        lines = self.known_hosts.read_text(encoding="utf8").splitlines(keepends=True)
        self.known_hosts.write_text("".join(x for x in lines if not x.startswith(prefix)), encoding="utf8")

    def _stop_tunnel(self) -> None:
        t, self._tunnel = self._tunnel, None
        if t is None:
            return
        if t.poll() is None:
            t.terminate()
            try:
                t.wait(timeout=5)
            except subprocess.TimeoutExpired:
                t.kill()

    # ---- end
    def _teardown(self) -> None:
        if self._done:
            return
        self._closing = True
        try:
            self._teardown_inner()
        except DestroyFailed:
            self._closing = False
            raise

    def _teardown_inner(self) -> None:
        self._stop_tunnel()
        if self.id is None and self._intent and not self._searched:
            self.id = self._find_by_label()
        if self.id is not None and not self._opened:
            self._record_open()
        if self.id is not None:
            destroy_verified(self.vast, self.id, self.clock, self.log)
            self.ledger.close(self.id, self.clock.time())
            self.log(f"Machine {self.id} destroyed and verified gone. Spent so far ${self.ledger.spent(self.clock.time()):.2f}.")
        elif self._intent:
            self.log(f"Could not find a machine for label {self.label}; run reap to settle it.")
        self._done = True


def reap(vast: Vast, project: Project, confirm: Callable[[str], bool], clock=time, log: Callable[[str], None] = _stderr) -> list[int]:
    """Destroy machines this project's ledger says are still alive, including ones whose id was never written.
    Matches by the ledger's own labels and ids only; anything else on the account is left alone."""
    led = Ledger(project.p("ledger.jsonl"))
    live = [r for r in led.runs() if r.live]
    if not live:
        return []
    mine = vast.list_mine()
    now = clock.time()
    targets: list[tuple] = []
    for r in live:
        inst = None
        if r.id is not None:
            inst = next((i for i in mine if i.id == r.id), None) or vast.get(r.id)
            if inst is None:
                led.close(r.id, now)
                continue
            if inst.label and r.label and not inst.label.startswith(r.label):
                log(f"Skipping instance {r.id}: its label {inst.label!r} is not the ledger's {r.label!r}.")
                continue
        else:
            inst = next((i for i in mine if r.label and i.label.startswith(r.label)), None)
            if inst is None:
                if now - r.start >= ORPHAN_GRACE_S:
                    led.void(r.label, "no instance found", now)
                continue
        targets.append((r, inst))
    if not targets:
        return []
    text = "Destroy these machines from the ledger:\n" + "\n".join(f"  #{i.id} label {i.label or '-'} status {i.status or '?'}" for _, i in targets)
    if not confirm(text):
        return []
    done: list[int] = []
    for r, inst in targets:
        if r.id is None:
            led.open(inst.id, r.dph, r.storage_usd, r.label, r.extra_usd, now)
        destroy_verified(vast, inst.id, clock, log)
        led.close(inst.id, clock.time())
        done.append(inst.id)
    return done
