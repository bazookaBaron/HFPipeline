"""Overlays as transparent PNGs, rendered from HTML by headless Chrome (this ffmpeg has no drawtext or subtitles filter).

Every PNG is cached by the hash of its spec, so 30 reels share the label, the end card and repeated caption states.
Text is escaped and reduced to printable characters before it reaches the page.
"""
from __future__ import annotations
import glob
import hashlib
import html
import json
import math
import os
import re
import shutil
import subprocess
import tempfile
import unicodedata
from concurrent.futures import ThreadPoolExecutor
from dataclasses import asdict, dataclass
from pathlib import Path

from .errors import OverlayError

TEMPLATE_VERSION = "9"
FONT = '-apple-system, "SF Pro Display", "SF Pro Text", "Helvetica Neue", Helvetica, Arial, "Apple Color Emoji", sans-serif'
GRADIENTS = [("#1c2b4d", "#4a2377"), ("#134e4a", "#1e3a8a"), ("#4c1d6b", "#7c2d5b"), ("#1f3b4d", "#3b6e8f")]


@dataclass(frozen=True)
class Spec:
    kind: str                       # label | caption | card | endcard
    w: int
    h: int
    text: str = ""
    words: tuple[str, ...] = ()
    active: int = -1
    sub: str = ""
    extra: str = ""
    variant: int = 0


@dataclass(frozen=True)
class Geometry:
    w: int
    h: int
    cap_y: int
    cap_h: int
    label_x: int
    label_y: int
    label_w: int
    label_h: int

    @property
    def safe(self) -> tuple[float, float, float, float]:
        """Caption safe area (x0, y0, x1, y1): 8% side margins, 62%-78% of the height."""
        return 0.08 * self.w, 0.62 * self.h, 0.92 * self.w, 0.78 * self.h


def geometry(cfg: dict) -> Geometry:
    w, h = cfg["reel"]["width"], cfg["reel"]["height"]
    y0, y1 = math.ceil(0.62 * h), math.floor(0.78 * h)
    m = round(0.08 * w)
    return Geometry(w, h, y0, y1 - y0, m, round(0.14 * h), w - 2 * m, round(0.045 * h))


def label_spec(cfg: dict) -> Spec:
    g = geometry(cfg)
    return Spec("label", g.label_w, g.label_h, text=cfg["reel"]["label"])


def clean(text: str, limit: int = 400) -> str:
    text = "".join(c if (c.isprintable() or c == " ") else " " for c in unicodedata.normalize("NFC", str(text)))
    return " ".join(text.split())[:limit]


def chrome_path() -> str:
    c = os.environ.get("CHROME")
    if c:
        if not Path(c).exists():
            raise OverlayError(f"CHROME={c} does not exist; unset it or point it at chrome-headless-shell")
        return c
    found = sorted(glob.glob(str(Path.home() / ".cache/hyperframes/chrome/chrome-headless-shell/*/*/chrome-headless-shell")))
    if not found:
        raise OverlayError("headless Chrome not found; run `npx hyperframes browser ensure` or set CHROME to a chrome-headless-shell binary")
    return found[-1]


def _page(w: int, h: int, css: str, body: str, script: str = "") -> str:
    return (f"<!doctype html><html><head><meta charset=utf-8><style>*{{box-sizing:border-box}}"
            f"html,body{{margin:0;width:{w}px;height:{h}px;overflow:hidden;background:transparent;font-family:{FONT}}}{css}</style></head>"
            f"<body>{body}<script>{script}</script></body></html>")


def _esc(t: str) -> str:
    return html.escape(clean(t), quote=True)


def build_html(s: Spec) -> str:
    if s.kind == "caption":
        spans = " ".join(f'<span class="w{" a" if j == s.active else ""}">{_esc(w)}</span>' for j, w in enumerate(s.words))
        css = ("body{display:flex;align-items:center;justify-content:center}"
               "#t{width:880px;padding:16px 12px;word-spacing:.14em;text-align:center;font-weight:800;line-height:1.16;color:#fff;-webkit-text-stroke:9px #000;paint-order:stroke fill;"
               "text-shadow:0 5px 16px rgba(0,0,0,.55);overflow:hidden;-webkit-box-orient:vertical;overflow-wrap:anywhere}"
               ".w{display:inline-block}.a{color:#ffd93d}")
        js = ("const t=document.getElementById('t');t.style.display='block';let f=68;"
              "for(;f>=26;f-=2){t.style.fontSize=f+'px';if(t.scrollHeight<=f*1.16*2+34&&t.scrollWidth<=t.clientWidth+1)break}"
              "t.style.display='-webkit-box';t.style.webkitLineClamp='2';t.style.maxHeight=(f*1.16*2+34)+'px'")
        return _page(s.w, s.h, css, f'<div id="t">{spans}</div>', js)
    if s.kind == "label":
        css = (".p{display:inline-block;white-space:nowrap;background:rgba(0,0,0,.74);color:#fff;font-weight:700;font-size:40px;line-height:44px;"
               "padding:8px 22px;border-radius:999px;letter-spacing:.2px}")
        js = ("const p=document.getElementById('p');let f=40;while(p.getBoundingClientRect().width>%d&&f>28){f--;p.style.fontSize=f+'px'}" % s.w)
        return _page(s.w, s.h, css, f'<div class="p" id="p">{_esc(s.text)}</div>', js)
    c1, c2 = GRADIENTS[s.variant % len(GRADIENTS)]
    bg = f"background:linear-gradient(160deg,{c1},{c2})"
    if s.kind == "card":
        top, hh = round(0.22 * s.h), round(0.33 * s.h)        # the whole block stays between 22% and 55% of the height, above the captions
        css = (f"body{{{bg}}}#k{{position:absolute;left:0;width:{s.w}px;top:{top}px;height:{hh}px;overflow:hidden;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:28px}}"
               "#t{width:860px;text-align:center;color:#fff;font-weight:800;line-height:1.14;overflow-wrap:anywhere;text-shadow:0 4px 24px rgba(0,0,0,.35)}"
               ".q{font-size:200px;line-height:.6;height:70px;color:rgba(255,255,255,.2);font-weight:800}"
               ".bar{width:120px;height:8px;border-radius:4px;background:#ffd93d;flex:none}")
        js = (f"const t=document.getElementById('t');const lim={hh}-70-8-56-10;let f=80;"
              "for(;f>=28;f-=2){t.style.fontSize=f+'px';if(t.scrollHeight<=lim&&t.scrollWidth<=860)break}")
        return _page(s.w, s.h, css, f'<div id="k"><div class="q">&ldquo;</div><div id="t">{_esc(s.text)}</div><div class="bar"></div></div>', js)
    if s.kind == "endcard":
        css = (f"body{{{bg};display:flex;flex-direction:column;align-items:center;justify-content:center;gap:56px;text-align:center;color:#fff}}"
               "#b{font-size:44px;font-weight:700;letter-spacing:8px;text-transform:uppercase;opacity:.85;width:860px}"
               "#c{width:860px;max-height:520px;font-weight:800;line-height:1.1;overflow-wrap:anywhere;text-shadow:0 4px 24px rgba(0,0,0,.3)}"
               "#u{font-size:46px;font-weight:700;background:#ffd93d;color:#1b1b1b;padding:18px 40px;border-radius:999px;max-width:900px;overflow-wrap:anywhere}")
        js = ("const c=document.getElementById('c');let f=98;for(;f>=34;f-=2){c.style.fontSize=f+'px';if(c.scrollHeight<=520&&c.scrollWidth<=860)break}"
              "const u=document.getElementById('u');let g=46;while(u.scrollWidth>u.clientWidth+1&&g>24){g--;u.style.fontSize=g+'px'}")
        url = f'<div id="u">{_esc(s.sub)}</div>' if s.sub else ""
        brand = f'<div id="b">{_esc(s.extra)}</div>' if s.extra else ""
        return _page(s.w, s.h, css, f'{brand}<div id="c">{_esc(s.text)}</div>{url}', js)
    raise OverlayError(f"unknown overlay kind {s.kind!r}")


def _key(s: Spec) -> str:
    return hashlib.sha1((TEMPLATE_VERSION + json.dumps(asdict(s), sort_keys=True, ensure_ascii=True)).encode()).hexdigest()[:20]


def _bbox(png: Path) -> list[int] | None:
    r = subprocess.run(["ffmpeg", "-hide_banner", "-nostdin", "-i", str(png), "-vf", "alphaextract,format=gray,cropdetect=limit=8:round=2:skip=0", "-frames:v", "1", "-f", "null", "-"],
                       capture_output=True, text=True)
    m = re.findall(r"x1:(\d+) x2:(\d+) y1:(\d+) y2:(\d+)", r.stderr)
    return [int(v) for v in (m[-1][0], m[-1][2], m[-1][1], m[-1][3])] if m else None


def _png_size(png: Path) -> tuple[int, int]:
    d = png.read_bytes()[:24]
    if d[:8] != b"\x89PNG\r\n\x1a\n":
        raise OverlayError(f"{png} is not a PNG")
    return int.from_bytes(d[16:20], "big"), int.from_bytes(d[20:24], "big")


def _shoot(s: Spec, out: Path, chrome: str) -> None:
    tmp = Path(tempfile.mkdtemp(prefix="ugc-chrome-"))
    try:
        page = tmp / "p.html"
        page.write_text(build_html(s), encoding="utf8")
        shot = tmp / "o.png"
        cmd = [chrome, "--headless", "--disable-gpu", "--hide-scrollbars", "--force-device-scale-factor=1", "--default-background-color=00000000",
               f"--window-size={s.w},{s.h}", f"--user-data-dir={tmp / 'ud'}", f"--screenshot={shot}", page.as_uri()]
        for attempt in (1, 2):
            r = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
            if shot.exists() and shot.stat().st_size > 100:
                break
            if attempt == 2:
                raise OverlayError(f"Chrome made no image for {s.kind} overlay (exit {r.returncode}): {r.stderr[-300:]}")
        if _png_size(shot) != (s.w, s.h):
            raise OverlayError(f"Chrome rendered {_png_size(shot)} for a {s.w}x{s.h} {s.kind} overlay")
        box = _bbox(shot) if s.kind in ("label", "caption") else [0, 0, s.w - 1, s.h - 1]
        if box is None:
            raise OverlayError(f"the {s.kind} overlay for {s.text or s.words!r} came out empty; check the font and the text")
        if s.kind == "label" and box[3] - box[1] + 1 < 28:
            raise OverlayError("the AI label rendered under 28 px tall")
        out.with_suffix(".json").write_text(json.dumps({"w": s.w, "h": s.h, "box": box}), encoding="utf8")
        os.replace(shot, out)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def overlays(specs, out_dir: Path, workers: int = 4) -> dict[Spec, Path]:
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    unique = list(dict.fromkeys(specs))
    paths = {s: out_dir / f"{s.kind}_{_key(s)}.png" for s in unique}
    todo = [s for s in unique if not (paths[s].exists() and paths[s].with_suffix(".json").exists())]
    if todo:
        chrome = chrome_path()
        with ThreadPoolExecutor(max_workers=max(1, min(workers, len(todo)))) as ex:
            list(ex.map(lambda s: _shoot(s, paths[s], chrome), todo))
    return paths


def meta(png: Path) -> dict:
    return json.loads(Path(png).with_suffix(".json").read_text(encoding="utf8"))
