"""Shared formats. Only the orchestrator edits this file. Standard library only."""
from __future__ import annotations
import json
import os
import tomllib
from dataclasses import asdict, dataclass, field
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


@dataclass(frozen=True)
class Tier:
    id: str
    width: int
    height: int
    steps: int
    turbo: float
    skin: float


@dataclass
class Line:
    text: str                 # spoken words, verbatim
    delivery: str = ""        # "warmly", "with a small laugh"


@dataclass
class Clip:
    id: str                   # r01c1
    reel: str                 # r01
    index: int                # 1..n
    lines: list[Line]
    action: str               # one physical gesture
    framing: str
    room: str
    seed: int


@dataclass
class Broll:
    after_clip: int           # cutaway starts over the end of this clip's slot (0 = before the first clip)
    seconds: float
    source: str               # path relative to the project folder; "" = not supplied yet
    note: str = ""


@dataclass
class Reel:
    id: str
    title: str
    hook: str
    clips: list[Clip]
    broll: list[Broll]
    cta: str
    claims: list[str] = field(default_factory=list)   # brief claim ids used

    @staticmethod
    def from_dict(d: dict) -> "Reel":
        d = dict(d)
        d["clips"] = [Clip(**{**c, "lines": [Line(**x) for x in c["lines"]]}) for c in d["clips"]]
        d["broll"] = [Broll(**b) for b in d["broll"]]
        return Reel(**d)


@dataclass
class Take:
    clip: str
    take: int                 # 1..n
    tier: str
    seed: int
    file: str                 # takes/<clip>_t<take>.mp4
    seconds: float            # wall seconds the GPU spent
    key: str                  # content hash of everything that affects the pixels


@dataclass
class Check:
    clip: str
    take: int
    passed: bool
    score: float              # higher is better, for ranking passing takes
    gates: dict               # name -> {"pass": bool, "value": ..., "limit": ...}


class Project:
    """projects/<name>/: brief.json, reels.jsonl, cast/sheet.png, voice/ref.wav, takes/, checks/, selects.json, final/, ledger.jsonl"""

    def __init__(self, path: Path):
        self.path = Path(path)

    def p(self, *parts: str) -> Path:
        f = self.path.joinpath(*parts)
        f.parent.mkdir(parents=True, exist_ok=True)
        return f

    def brief(self) -> dict:
        return json.loads((self.path / "brief.json").read_text(encoding="utf8"))

    def reels(self) -> list[Reel]:
        return [Reel.from_dict(json.loads(x)) for x in (self.path / "reels.jsonl").read_text(encoding="utf8").splitlines() if x.strip()]

    def save_reels(self, reels: list[Reel]) -> None:
        write_atomic(self.p("reels.jsonl"), "".join(json.dumps(asdict(r), ensure_ascii=False) + "\n" for r in reels))

    def takes(self) -> list[Take]:
        return [Take(**x) for x in read_jsonl(self.path / "takes.jsonl")]

    def add_take(self, t: Take) -> None:
        append_jsonl(self.p("takes.jsonl"), asdict(t))

    def check(self, clip: str, take: int) -> Check | None:
        f = self.path / "checks" / f"{clip}_t{take}.json"
        return Check(**json.loads(f.read_text(encoding="utf8"))) if f.exists() else None

    def save_check(self, c: Check) -> None:
        write_atomic(self.p("checks", f"{c.clip}_t{c.take}.json"), json.dumps(asdict(c), indent=1))

    def selects(self) -> dict:
        f = self.path / "selects.json"
        return json.loads(f.read_text(encoding="utf8")) if f.exists() else {}


def load_config(path: Path | None = None) -> dict:
    c = tomllib.loads((path or ROOT / "config.toml").read_text(encoding="utf8"))
    c["tiers"] = [Tier(**t) for t in c.pop("tier")]
    if (c["model"]["frames"] - 5) % 17:
        raise ValueError("model.frames must be 17n+5")
    for t in c["tiers"]:
        if t.width % 32 or t.height % 32:
            raise ValueError(f"tier {t.id}: size must be a multiple of 32")
    return c


def env(name: str) -> str:
    """Environment first, then .env. Values are never printed."""
    if os.environ.get(name):
        return os.environ[name]
    f = ROOT / ".env"
    if f.exists():
        for line in f.read_text(encoding="utf8").splitlines():
            k, _, v = line.partition("=")
            if k.strip() == name and v.strip():
                return v.strip().strip("'\"")
    raise SystemExit(f"{name} is not set. Put it in {f} (see .env.example).")


def write_atomic(path: Path, text: str) -> None:
    tmp = path.with_suffix(path.suffix + ".part")
    tmp.write_text(text, encoding="utf8")
    tmp.replace(path)


def append_jsonl(path: Path, row: dict) -> None:
    with path.open("a", encoding="utf8") as f:
        f.write(json.dumps(row, ensure_ascii=False) + "\n")
        f.flush()
        os.fsync(f.fileno())


def read_jsonl(path: Path) -> list[dict]:
    if not path.exists():
        return []
    out = []
    for x in path.read_text(encoding="utf8").splitlines():
        try:
            out.append(json.loads(x))
        except json.JSONDecodeError:
            continue          # a torn last line after a crash
    return out
