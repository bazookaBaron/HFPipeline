"""Offer filtering and ranking. Pure functions, no network."""
from __future__ import annotations
import dataclasses
import re

from . import budget
from .api import MIN_CUDA, Offer

REF_WORK = 10.0 * 197.0   # a 10 h job on a machine scoring 197 (dlperf), so ranking sees setup and download as real costs


def norm_gpu(name: str) -> str:
    s = re.sub(r"[\s_\-]+", " ", name.upper())
    s = re.sub(r"\b(NVIDIA|GEFORCE)\b", "", s)
    return re.sub(r"\s+", "", s)


def job_cost(o: Offer, cfg: dict) -> float:
    hours = budget.SETUP_H + REF_WORK / max(o.dlperf, 1e-9)
    return o.dph * hours + o.storage_per_h(cfg["compute"]["disk_gb"]) * hours + o.download_usd


def _with_download(o: Offer, cfg: dict) -> Offer:
    return dataclasses.replace(o, download_usd=o.down_cost_gb * cfg["budget"]["download_gb"])


def _reason(o: Offer, cfg: dict) -> str | None:
    c = cfg["compute"]
    cc = o.country
    if not cc:
        return f"unknown country ({o.geolocation!r}); the licence needs a known, permitted country"
    if cc in c["excluded"]:
        return f"country {cc} is excluded by the model licence"
    if cc in c["avoid"]:
        return f"country {cc} is avoided (Hugging Face may be unreachable)"
    if norm_gpu(o.gpu) not in {norm_gpu(g) for g in c["gpus"]}:
        return f"GPU {o.gpu} is not in the allowed list"
    if o.num_gpus != 1:
        return f"{o.num_gpus} GPUs; only single-GPU machines are used"
    if o.dph > cfg["budget"]["max_dph"]:
        return f"${o.dph:.3f}/h is above max_dph ${cfg['budget']['max_dph']:.2f}"
    if o.ram_gb < c["min_ram_gb"]:
        return f"{o.ram_gb:.0f} GB RAM is below {c['min_ram_gb']}"
    if o.reliability < c["min_reliability"]:
        return f"reliability {o.reliability:.3f} is below {c['min_reliability']}"
    if o.down_mbps < c["min_down_mbps"]:
        return f"download {o.down_mbps:.0f} Mbps is below {c['min_down_mbps']}"
    if o.disk_gb < c["disk_gb"]:
        return f"disk {o.disk_gb:.0f} GB is below {c['disk_gb']}"
    if o.cuda and o.cuda < MIN_CUDA:
        return f"driver supports CUDA {o.cuda}, the image needs {MIN_CUDA}"
    if not o.verified:
        return "host is not verified"
    if o.dlperf <= 0:
        return "no performance score"
    return None


def rejections(offers: list[Offer], cfg: dict) -> dict[int, str]:
    return {o.id: r for o in offers if (r := _reason(o, cfg))}


def choose(offers: list[Offer], cfg: dict) -> list[Offer]:
    ok = [_with_download(o, cfg) for o in offers if _reason(o, cfg) is None]
    return sorted(ok, key=lambda o: (job_cost(o, cfg) , -o.reliability))
