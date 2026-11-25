"""Minimal ComfyUI HTTP client (standard library). Never resubmits a prompt whose outcome is unknown."""
from __future__ import annotations
import hashlib
import http.client
import json
import socket
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
from dataclasses import dataclass
from pathlib import Path

OOM_MARKERS = ("out of memory", "outofmemory", "cuda error: out of memory", "allocation on device")


class ComfyError(Exception):
    """infra: the machine or connection is the problem (stop after 3 in a row). permanent: this graph will never work."""

    def __init__(self, msg: str, *, infra: bool = False, oom: bool = False, permanent: bool = False):
        super().__init__(msg)
        self.infra, self.oom, self.permanent = infra, oom, permanent


@dataclass
class Job:
    prompt_id: str
    graph: dict
    submitted: float


def _is_infra(e: BaseException) -> bool:
    if isinstance(e, urllib.error.HTTPError):
        return e.code >= 500
    return isinstance(e, (urllib.error.URLError, ConnectionError, socket.timeout, TimeoutError, http.client.HTTPException, OSError))


def _refused(e: BaseException) -> bool:
    r = e.reason if isinstance(e, urllib.error.URLError) else e
    return isinstance(r, ConnectionRefusedError)


class Comfy:
    def __init__(self, url: str, timeout: float = 30.0, poll: float = 1.0, wait_limit: float = 3600.0, settle: float = 2.0, retry_delay: float = 1.0):
        self.url = url.rstrip("/")
        self.timeout, self.poll, self.wait_limit, self.settle, self.retry_delay = timeout, poll, wait_limit, settle, retry_delay
        self.client_id = uuid.uuid4().hex
        self._opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
        self._info: dict | None = None

    def _req(self, path: str, data: bytes | None = None, headers: dict | None = None) -> bytes:
        r = urllib.request.Request(self.url + path, data=data, headers=headers or {})
        with self._opener.open(r, timeout=self.timeout) as f:
            return f.read()

    def _json(self, path: str, body: dict | None = None) -> dict:
        data = json.dumps(body).encode() if body is not None else None
        return json.loads(self._req(path, data, {"Content-Type": "application/json"} if body is not None else None))

    def upload(self, path: Path) -> str:
        """Upload under a name that carries the content hash, so a changed file is never confused with an old one."""
        path = Path(path)
        raw = path.read_bytes()
        name = f"{hashlib.sha256(raw).hexdigest()[:10]}_{path.name}"
        b = uuid.uuid4().hex
        head = (f'--{b}\r\nContent-Disposition: form-data; name="image"; filename="{name}"\r\n'
                "Content-Type: application/octet-stream\r\n\r\n").encode()
        tail = (f'\r\n--{b}\r\nContent-Disposition: form-data; name="overwrite"\r\n\r\ntrue\r\n'
                f'--{b}\r\nContent-Disposition: form-data; name="type"\r\n\r\ninput\r\n--{b}--\r\n').encode()
        try:
            res = json.loads(self._req("/upload/image", head + raw + tail, {"Content-Type": f"multipart/form-data; boundary={b}"}))
        except (urllib.error.URLError, OSError) as e:
            raise ComfyError(f"Upload of {path.name} failed ({e}). Check the ComfyUI tunnel.", infra=True) from e
        sub = res.get("subfolder") or ""
        return f"{sub}/{res['name']}" if sub else res["name"]

    def object_info(self) -> dict:
        if self._info is None:
            self._info = self._json("/object_info")
        return self._info

    def missing(self, graph: dict) -> list[str]:
        """Node classes and combo values (model files) the server does not know. Empty means it should run."""
        info = self.object_info()
        out: list[str] = []
        for nid, node in graph.items():
            cls = node["class_type"]
            if cls not in info:
                out.append(f"node {cls} (install or update ComfyUI)")
                continue
            spec = {**info[cls].get("input", {}).get("required", {}), **info[cls].get("input", {}).get("optional", {})}
            for name, val in node["inputs"].items():
                if isinstance(val, list) or cls in ("LoadImage", "LoadAudio") or name not in spec:
                    continue
                t = spec[name]
                opts = t[0] if t and isinstance(t[0], list) else (t[1].get("options") if len(t) > 1 and isinstance(t[1], dict) else None)
                if opts is not None and val not in opts:
                    out.append(f"{cls}.{name} = {val!r} not among the server's choices")
        return out

    def _where(self, pid: str) -> dict | None:
        """History entry if finished, {} if queued or running, None if unknown. Queue first: a job moves queue to history atomically."""
        q = self._json("/queue")
        for item in list(q.get("queue_running", [])) + list(q.get("queue_pending", [])):
            if len(item) > 1 and item[1] == pid:
                return {}
        return self._json(f"/history/{pid}").get(pid)

    def submit(self, graph: dict) -> Job:
        pid = str(uuid.uuid4())      # server.py insists on canonical lowercase hyphenated form
        body = {"prompt": graph, "client_id": self.client_id, "prompt_id": pid}
        for attempt in (1, 2):
            try:
                self._json("/prompt", body)
                break
            except urllib.error.HTTPError as e:
                if e.code < 500:
                    raise self._rejected(e) from e
                cause: BaseException = e
            except (urllib.error.URLError, OSError, http.client.HTTPException) as e:
                if _refused(e):
                    raise ComfyError("ComfyUI refused the connection. Is the machine up and the tunnel open?", infra=True) from e
                cause = e
            if self._reconcile(pid, cause):      # it landed after all: never send it twice
                break
            if attempt == 2:
                raise ComfyError(f"ComfyUI would not take the job twice ({cause}).", infra=True) from cause
        return Job(pid, graph, time.time())

    def _rejected(self, e: urllib.error.HTTPError) -> ComfyError:
        try:
            d = json.loads(e.read())
        except (ValueError, OSError):
            d = {}
        err = d.get("error", {}) if isinstance(d, dict) else {}
        detail = err.get("message") or str(d)[:300] or str(e)
        return ComfyError(f"ComfyUI rejected the graph: {detail}", permanent=True)

    def _reconcile(self, pid: str, cause: BaseException) -> bool:
        """The POST may or may not have landed. True if the job is in /queue or /history; False only when provably absent."""
        time.sleep(self.settle)
        try:
            return self._where(pid) is not None
        except (urllib.error.URLError, OSError, http.client.HTTPException, ValueError) as e:
            raise ComfyError(f"Lost contact with ComfyUI while submitting ({cause}); could not check whether the job was queued ({e}). "
                             "Nothing was resubmitted.", infra=True) from e

    def wait(self, job: Job, out: Path) -> float:
        """Block until the job finishes; save the video to `out` via a .part file; return GPU seconds from ComfyUI's timestamps."""
        deadline = time.time() + self.wait_limit
        errors = absent = 0
        while True:
            try:
                h = self._where(job.prompt_id)
                errors = 0
            except (urllib.error.URLError, OSError, http.client.HTTPException, ValueError) as e:
                errors += 1
                if errors >= 5:
                    raise ComfyError(f"Lost contact with ComfyUI while waiting for a take ({e}).", infra=True) from e
                time.sleep(self.poll)
                continue
            if h:
                absent = 0
                st = h.get("status", {})
                if st.get("status_str") == "error":
                    raise self._failed(h)
                if st.get("completed", True):
                    return self._fetch(job, h, out)
            elif h is None:
                absent += 1
                if absent >= 3:
                    raise ComfyError("ComfyUI lost the job (restarted?). Not resubmitted automatically.", infra=True)
            else:
                absent = 0
            if time.time() > deadline:
                raise ComfyError(f"Take did not finish within {self.wait_limit:.0f} s.", infra=True)
            time.sleep(self.poll)

    def run(self, graph: dict, out: Path) -> float:
        return self.wait(self.submit(graph), out)

    def recover(self, prompt_id: str, out: Path) -> float | None:
        """Fetch a job submitted earlier (same server) if ComfyUI still knows it; None if not."""
        job = Job(prompt_id, {}, time.time())
        try:
            if self._where(prompt_id) is None:
                return None
            return self.wait(job, out)
        except ComfyError as e:
            if e.infra:
                raise
            return None
        except (urllib.error.URLError, OSError, http.client.HTTPException, ValueError):
            return None

    def cancel(self, job: Job) -> None:
        """Best effort: drop a queued job and interrupt a running one. Used when stopping early."""
        try:
            self._json("/queue", {"delete": [job.prompt_id]})
            self._json("/interrupt", {"prompt_id": job.prompt_id})     # only acts if this prompt is the running one
        except (urllib.error.URLError, OSError, http.client.HTTPException, ValueError):
            pass

    def _failed(self, h: dict) -> ComfyError:
        text = "execution failed"
        for kind, data in h.get("status", {}).get("messages", []):
            if kind == "execution_error":
                text = f"{data.get('node_type', '?')}: {data.get('exception_message', '').strip()}"
        oom = any(k in text.lower() for k in OOM_MARKERS)
        return ComfyError(text, infra=oom, oom=oom)

    def _fetch(self, job: Job, h: dict, out: Path) -> float:
        files = [f for o in h.get("outputs", {}).values() for k in ("images", "videos", "gifs") for f in o.get(k, []) if f.get("filename")]
        if not files:
            raise ComfyError("ComfyUI finished but produced no video file.")
        f = files[-1]
        q = urllib.parse.urlencode({"filename": f["filename"], "subfolder": f.get("subfolder", ""), "type": f.get("type", "output")})
        data = None
        for attempt in range(5):
            try:
                data = self._req("/view?" + q)
                break
            except (urllib.error.URLError, OSError, http.client.HTTPException) as e:
                err = e
                time.sleep(self.retry_delay * (2 ** attempt))
        if data is None:
            raise ComfyError(f"Could not download the finished take ({err}). It stays on the server; the next run fetches it.", infra=True) from err
        out = Path(out)
        out.parent.mkdir(parents=True, exist_ok=True)
        part = out.with_suffix(out.suffix + ".part")
        part.write_bytes(data)
        part.replace(out)
        ts = {k: d.get("timestamp") for k, d in h.get("status", {}).get("messages", []) if isinstance(d, dict)}
        if ts.get("execution_start") and ts.get("execution_success"):
            return max(0.0, (ts["execution_success"] - ts["execution_start"]) / 1000.0)
        return time.time() - job.submitted
