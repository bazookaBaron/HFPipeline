"""Contact sheet for a media manifest: one tile per slot with its status and credit line.

usage: python contact_sheet.py <out-dir-with-media-manifest.json> [sheet.png]
"""
import json
import os
import sys
import textwrap

from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
VIDEO_ENGINE = os.path.normpath(os.path.join(HERE, "..", "..", "..", "video-engine"))
COLORS = {"ok": (20, 150, 110), "illustration": (60, 110, 200), "fallback": (200, 70, 60)}


def font(size):
    for f in ("arial.ttf", "DejaVuSans.ttf", "segoeui.ttf"):
        try:
            return ImageFont.truetype(f, size)
        except OSError:
            pass
    return ImageFont.load_default()


def main():
    out = sys.argv[1]
    dest = sys.argv[2] if len(sys.argv) > 2 else os.path.join(out, "contact-sheet.png")
    man = json.load(open(os.path.join(out, "media-manifest.json"), encoding="utf8"))["slots"]
    rep_path = os.path.join(out, "media-report.json")
    rep = json.load(open(rep_path, encoding="utf8")) if os.path.exists(rep_path) else {"slots": {}}
    cols, tw, th, cap = 4, 480, 270, 118
    rows = (len(man) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * (tw + 16) + 16, rows * (th + cap + 16) + 16), (247, 246, 241))
    d = ImageDraw.Draw(sheet)
    f_b, f_s = font(17), font(13)
    for n, (slot, e) in enumerate(man.items()):
        x = 16 + (n % cols) * (tw + 16)
        y = 16 + (n // cols) * (th + cap + 16)
        d.rectangle([x, y, x + tw, y + th], fill=(225, 225, 220))
        if e.get("file"):
            p = e["file"] if os.path.isabs(e["file"]) else os.path.join(VIDEO_ENGINE, e["file"])
            try:
                im = Image.open(p).convert("RGB")
                im.thumbnail((tw, th))
                sheet.paste(im, (x + (tw - im.width) // 2, y + (th - im.height) // 2))
                fx, fy, fw, fh = e.get("focal") or [0, 0, 1, 1]
                ox, oy = x + (tw - im.width) // 2, y + (th - im.height) // 2
                d.rectangle([ox + fx * im.width, oy + fy * im.height, ox + (fx + fw) * im.width, oy + (fy + fh) * im.height], outline=(255, 200, 0), width=2)
            except Exception as ex:  # noqa: BLE001
                d.text((x + 8, y + 8), f"cannot open: {ex}", fill=(200, 0, 0), font=f_s)
        st = e["status"]
        d.rectangle([x, y + th, x + tw, y + th + 24], fill=COLORS.get(st, (90, 90, 90)))
        info = rep.get("slots", {}).get(slot, {})
        dims = f"  {e.get('width')}x{e.get('height')}" if e.get("width") else ""
        stage = info.get("stage", "")
        d.text((x + 6, y + th + 3), f"{st.upper()}  {slot}{dims}  {stage}", fill="white", font=f_b)
        intent = info.get("intent", {}).get("intent", "")
        lines = [e.get("credit", "")] if st != "fallback" else []
        lines += textwrap.wrap("want: " + intent, 70)[:2]
        if e.get("depicts"):
            lines += textwrap.wrap("sees: " + e["depicts"], 70)[:1]
        if st == "fallback":
            lines += textwrap.wrap(e.get("reason", ""), 70)[:3]
        for k, line in enumerate(lines[:5]):
            d.text((x + 4, y + th + 28 + k * 17), line, fill=(30, 30, 30) if k or st == "fallback" else (0, 0, 0), font=f_s)
    sheet.save(dest)
    print(dest)


if __name__ == "__main__":
    main()
