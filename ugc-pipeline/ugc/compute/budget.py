"""Cost projection. Everything is in USD and errs on the high side."""
from __future__ import annotations
from dataclasses import dataclass

from ..contract import Tier

SETUP_H = 0.4                    # boot, image pull, ComfyUI install, model download
INTERRUPT_OVERHEAD = 0.20        # lost work when an interruptible machine is outbid
DEFAULT_DOWN_USD_PER_GB = 0.02   # used only when the real offer price is not known
DEFAULT_STORAGE_GB_MONTH = 0.30
HOURS_PER_MONTH = 730.0


@dataclass(frozen=True)
class Projection:
    hours: float
    usd: float
    fits: bool


def storage_per_hour(disk_gb: float, gb_month: float = DEFAULT_STORAGE_GB_MONTH) -> float:
    return disk_gb * gb_month / HOURS_PER_MONTH


def project(seconds_per_take: float, n_clips: int, dph: float, cfg: dict, spent: float = 0.0,
            interruptible: bool = False, *, download_usd: float | None = None, storage_per_h: float | None = None) -> Projection:
    """Dollars to finish n_clips, setup and download included. `fits` compares spent + projected with the cap."""
    work_h = n_clips * cfg["takes"]["expected"] * seconds_per_take / 3600.0
    if interruptible:
        work_h *= 1.0 + INTERRUPT_OVERHEAD
    hours = SETUP_H + work_h
    if download_usd is None:
        download_usd = cfg["budget"]["download_gb"] * DEFAULT_DOWN_USD_PER_GB
    if storage_per_h is None:
        storage_per_h = storage_per_hour(cfg["compute"]["disk_gb"])
    usd = hours * (dph + storage_per_h) + download_usd
    return Projection(hours=hours, usd=usd, fits=spent + usd <= cfg["budget"]["cap_usd"] + 1e-9)


def best_tier(measured: dict[str, float], n_clips: int, dph: float, cfg: dict, spent: float,
              interruptible: bool, **kw) -> Tier | None:
    """First tier (best quality first) whose measured seconds per take fits the cap."""
    for t in cfg["tiers"]:
        if t.id in measured and project(measured[t.id], n_clips, dph, cfg, spent, interruptible, **kw).fits:
            return t
    return None
