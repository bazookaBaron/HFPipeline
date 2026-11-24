"""Append-only money log (JSONL). Never holds a key.

Rows: intend (before create), open (right after, with the id), close, void (nothing was rented).
A run with an intend row but no id still counts as spending, so a crash between create and the
id write can only over-count, never hide a machine.
`storage_usd` is USD per hour; `extra_usd` is a flat charge (the model download).
"""
from __future__ import annotations
import time
from dataclasses import dataclass
from pathlib import Path

from ..contract import append_jsonl, read_jsonl


def _t(now: float | None) -> float:
    return time.time() if now is None else now


@dataclass
class Run:
    label: str
    id: int | None
    start: float
    dph: float
    storage_usd: float
    extra_usd: float
    end: float | None = None
    void: bool = False

    @property
    def live(self) -> bool:
        return self.end is None and not self.void

    def cost(self, now: float) -> float:
        if self.void:
            return 0.0
        hours = max(0.0, (self.end if self.end is not None else now) - self.start) / 3600.0
        return hours * (self.dph + self.storage_usd) + self.extra_usd


class Ledger:
    def __init__(self, path: Path):
        self.path = Path(path)

    def _add(self, row: dict) -> None:
        if self.path.exists() and self.path.stat().st_size:
            with self.path.open("rb") as f:
                f.seek(-1, 2)
                torn = f.read(1) != b"\n"
            if torn:   # a crash left half a line; do not glue the next row onto it
                with self.path.open("ab") as f:
                    f.write(b"\n")
        append_jsonl(self.path, row)

    def intend(self, label: str, dph: float, storage_usd: float, extra_usd: float = 0.0, now: float | None = None) -> None:
        self._add({"ev": "intend", "t": _t(now), "label": label, "dph": dph, "storage_usd": storage_usd, "extra_usd": extra_usd})

    def open(self, instance_id: int, dph: float, storage_usd: float, label: str = "", extra_usd: float = 0.0, now: float | None = None) -> None:
        self._add({"ev": "open", "t": _t(now), "id": int(instance_id), "label": label, "dph": dph,
                   "storage_usd": storage_usd, "extra_usd": extra_usd})

    def close(self, instance_id: int, now: float | None = None) -> None:
        self._add({"ev": "close", "t": _t(now), "id": int(instance_id)})

    def void(self, label: str, why: str, now: float | None = None) -> None:
        self._add({"ev": "void", "t": _t(now), "label": label, "why": why})

    def runs(self) -> list[Run]:
        runs: dict[str, Run] = {}
        by_id: dict[int, Run] = {}
        for r in read_jsonl(self.path):
            ev, t = r.get("ev"), float(r.get("t", 0))
            if ev == "intend":
                runs[r["label"]] = Run(r["label"], None, t, r["dph"], r["storage_usd"], r.get("extra_usd", 0.0))
            elif ev == "open":
                run = runs.get(r.get("label") or "")
                if run is None:
                    run = runs[r.get("label") or f"id:{r['id']}"] = Run(r.get("label", ""), None, t, r["dph"], r["storage_usd"], r.get("extra_usd", 0.0))
                run.id = r["id"]
                by_id[run.id] = run
            elif ev == "close" and r["id"] in by_id:
                by_id[r["id"]].end = t
            elif ev == "void" and r.get("label") in runs:
                runs[r["label"]].void = True
        return list(runs.values())

    def spent(self, now: float | None = None) -> float:
        now = time.time() if now is None else now
        return sum(r.cost(now) for r in self.runs())

    def open_ids(self) -> list[int]:
        return [r.id for r in self.runs() if r.live and r.id is not None]

    def unresolved(self) -> list[Run]:
        """Runs whose create never got an id written."""
        return [r for r in self.runs() if r.live and r.id is None]
