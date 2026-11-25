"""Vast.ai REST client. Reads retry; create never does (a retry could rent twice)."""
from __future__ import annotations
import json
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from typing import Callable

from .onstart import IMAGE

MIN_CUDA = 13.0   # the pinned image ships PyTorch cu130, so the host driver must support CUDA 13
HOURS_PER_MONTH = 730.0
DEAD_STATUSES = {"exited", "unknown", "offline"}   # never become running (Vast docs)

Http = Callable[[str, str, dict, "bytes | None", float], "tuple[int, bytes]"]


class VastError(RuntimeError):
    pass


class AmbiguousCreate(VastError):
    """The create request may or may not have rented a machine. Look it up by label."""


@dataclass(frozen=True)
class Offer:
    id: int
    gpu: str
    num_gpus: int
    dph: float                # USD/hour we would pay: dph_total on-demand, our bid when interruptible
    min_bid: float
    geolocation: str
    ram_gb: float
    down_mbps: float
    down_cost_gb: float       # USD per GB downloaded
    reliability: float
    dlperf: float
    storage_gb_month: float
    disk_gb: float
    interruptible: bool = False
    cuda: float = 0.0
    download_usd: float = 0.0
    verified: bool = False

    @property
    def country(self) -> str:
        last = self.geolocation.rsplit(",", 1)[-1].strip().upper()
        return last if re.fullmatch(r"[A-Z]{2}", last) else ""

    def summary(self) -> str:
        return (f"{self.gpu}, {self.country or '??'}, ${self.dph:.3f}/h {'interruptible' if self.interruptible else 'on-demand'}, "
                f"{self.ram_gb:.0f} GB RAM, {self.down_mbps:.0f} Mbps, reliability {self.reliability:.3f}, "
                f"perf {self.dlperf:.0f}, download ${self.download_usd:.2f}")

    def storage_per_h(self, disk_gb: float) -> float:
        return disk_gb * self.storage_gb_month / HOURS_PER_MONTH

    @staticmethod
    def from_raw(r: dict, cfg: dict, interruptible: bool) -> "Offer | None":
        if not r.get("id") or not r.get("gpu_name"):
            return None
        min_bid = float(r.get("min_bid") or 0.0)
        dph = round(min_bid * 1.10 + 0.0005, 4) if interruptible else float(r.get("dph_total") or 0.0)
        down_cost = float(r.get("inet_down_cost") or 0.0)
        return Offer(
            id=int(r["id"]), gpu=str(r["gpu_name"]), num_gpus=int(r.get("num_gpus") or 0), dph=dph, min_bid=min_bid,
            geolocation=str(r.get("geolocation") or ""), ram_gb=float(r.get("cpu_ram") or 0.0) / 1024.0,
            down_mbps=float(r.get("inet_down") or 0.0), down_cost_gb=down_cost,
            reliability=float(r.get("reliability2") or r.get("reliability") or 0.0),
            dlperf=float(r.get("dlperf") or 0.0), storage_gb_month=float(r.get("storage_cost") or 0.0),
            disk_gb=float(r.get("disk_space") or 0.0), interruptible=interruptible,
            cuda=float(r.get("cuda_max_good") or 0.0), download_usd=down_cost * cfg["budget"]["download_gb"],
            verified=r.get("verification") == "verified")


@dataclass(frozen=True)
class Instance:
    id: int
    label: str
    status: str               # actual_status
    cur_state: str
    intended: str
    status_msg: str
    ssh_host: str
    ssh_port: int
    dph: float
    is_bid: bool

    @staticmethod
    def from_raw(r: dict) -> "Instance":
        return Instance(
            id=int(r["id"]), label=str(r.get("label") or ""), status=str(r.get("actual_status") or ""),
            cur_state=str(r.get("cur_state") or ""), intended=str(r.get("intended_status") or ""),
            status_msg=str(r.get("status_msg") or ""), ssh_host=str(r.get("ssh_host") or ""),
            ssh_port=int(r.get("ssh_port") or 0), dph=float(r.get("dph_total") or 0.0), is_bid=bool(r.get("is_bid")))


def _urllib_http(method: str, url: str, headers: dict, body: bytes | None, timeout: float) -> tuple[int, bytes]:
    req = urllib.request.Request(url, data=body, method=method, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, r.read()
    except urllib.error.HTTPError as e:
        try:
            return e.code, e.read()
        finally:
            e.close()


def gpu_variants(name: str) -> set[str]:
    spaced = re.sub(r"(\d)D$", r"\1 D", name)
    return {v for n in (name, spaced) for v in (n, n.replace(" ", "_"))}


class Vast:
    def __init__(self, key: str, base: str = "https://console.vast.ai", http: Http | None = None,
                 sleep: Callable[[float], None] = time.sleep, retries: int = 4, timeout: float = 30.0):
        self._key = key
        self.base = base.rstrip("/")
        self._http = http or _urllib_http
        self._sleep = sleep
        self._retries = retries
        self._timeout = timeout

    def _clean(self, s: str) -> str:
        return s.replace(self._key, "***") if self._key else s

    def _send(self, method: str, path: str, body: dict | None = None, retry: bool = True) -> tuple[int, object]:
        headers = {"Authorization": f"Bearer {self._key}", "Accept": "application/json"}
        data = None
        if body is not None:
            data = json.dumps(body).encode()
            headers["Content-Type"] = "application/json"
        status, raw = 0, b""
        for attempt in range(self._retries if retry else 1):
            try:
                status, raw = self._http(method, self.base + path, headers, data, self._timeout)
            except OSError as e:
                status, raw = 0, self._clean(f"{type(e).__name__}: {e}").encode()
            if status and status != 429 and status < 500:
                break
            if retry and attempt < self._retries - 1:
                self._sleep(2 ** attempt)
        text = raw.decode("utf8", "replace")
        try:
            return status, json.loads(text)
        except json.JSONDecodeError:
            return status, {"raw": text[:300]}

    def _fail(self, method: str, path: str, status: int, data: object) -> VastError:
        msg = ""
        if isinstance(data, dict):
            msg = str(data.get("msg") or data.get("error") or data.get("raw") or data.get("detail") or "")
        return VastError(self._clean(f"{method} {path.split('?')[0]} failed: HTTP {status} {msg[:200]}".strip()))

    def search(self, cfg: dict, interruptible: bool) -> list[Offer]:
        c = cfg["compute"]
        q = {"gpu_name": {"in": sorted({v for g in c["gpus"] for v in gpu_variants(g)})}, "num_gpus": {"eq": 1},
             "rentable": {"eq": True}, "rented": {"eq": False}, "verified": {"eq": True}, "disk_space": {"gte": c["disk_gb"]},
             "cuda_max_good": {"gte": MIN_CUDA}, "type": "bid" if interruptible else "ondemand",
             "limit": 500, "order": [["dph_total", "asc"]]}
        path = "/api/v0/bundles/?q=" + urllib.parse.quote(json.dumps(q))
        status, data = self._send("GET", path)
        if status != 200 or not isinstance(data, dict):
            raise self._fail("GET", path, status, data)
        offers = (Offer.from_raw(r, cfg, interruptible) for r in data.get("offers", []))
        return [o for o in offers if o]

    def create(self, offer: Offer, cfg: dict, onstart: str, bid: float | None = None, *, label: str | None = None) -> int:
        image = cfg["compute"]["image"]
        if image.endswith(":latest"):   # never rent an unpinned image
            image = IMAGE
        body: dict = {"image": image, "disk": cfg["compute"]["disk_gb"], "runtype": "ssh",
                      "onstart": onstart, "target_state": "running"}
        if label:
            body["label"] = label
        if offer.interruptible:
            body["price"] = bid or offer.dph
        path = f"/api/v0/asks/{offer.id}"
        status, data = self._send("PUT", path, body, retry=False)
        if status == 200 and isinstance(data, dict) and data.get("success") is False:
            raise self._fail("PUT", path, status, data)
        if status == 200 and isinstance(data, dict) and data.get("new_contract"):
            return int(data["new_contract"])
        if status == 0 or status == 429 or status >= 500 or status == 200:
            raise AmbiguousCreate(self._clean(f"create answered HTTP {status} without an instance id; it may have rented a machine"))
        raise self._fail("PUT", path, status, data)

    def get(self, id: int) -> Instance | None:
        path = f"/api/v0/instances/{id}"
        status, data = self._send("GET", path)
        if status == 404:
            return None
        if status != 200 or not isinstance(data, dict):
            raise self._fail("GET", path, status, data)
        inst = data.get("instances")
        if isinstance(inst, list):
            inst = inst[0] if inst else None
        return Instance.from_raw(inst) if inst else None

    def destroy(self, id: int) -> None:
        path = f"/api/v0/instances/{id}"
        status, data = self._send("DELETE", path)
        if status == 404:
            return
        if status != 200 or (isinstance(data, dict) and data.get("success") is False):
            raise self._fail("DELETE", path, status, data)

    def list_mine(self) -> list[Instance]:
        out: list[Instance] = []
        token = None
        for _ in range(40):
            path = "/api/v1/instances?limit=25" + (f"&after_token={urllib.parse.quote(token)}" if token else "")
            status, data = self._send("GET", path)
            if status != 200 or not isinstance(data, dict):
                raise self._fail("GET", path, status, data)
            out += [Instance.from_raw(r) for r in data.get("instances") or [] if r.get("id")]
            token = data.get("next_token")
            if not token:
                return out
        raise VastError("instance list did not end after 40 pages")

    def balance(self) -> float:
        status, data = self._send("GET", "/api/v0/users/current")
        if status != 200 or not isinstance(data, dict) or "balance" not in data:
            raise self._fail("GET", "/api/v0/users/current", status, data)
        return float(data["balance"])

    def ssh_keys(self) -> list[str]:
        status, data = self._send("GET", "/api/v0/ssh")
        if status == 404:
            return []
        if status != 200 or not isinstance(data, list):
            raise self._fail("GET", "/api/v0/ssh", status, data)
        return [str(k.get("key", "")) for k in data if not k.get("deleted_at")]
