"""Shorts part timestamps from script markers (longform-writer §4). The cutter is runtime/shorts/shorts.js; this is the
lightweight timing dump for tools that want clips.json.

python runtime/lf/clips.py <dir> [--pad 0.25] [--offset 0]
Reads <dir>/script.txt (`#part [title]` comment lines = breaks of the consecutive PART n Shorts series) + <dir>/words.json
[{w,s,e,line}] (voice.py; `line` indexes SPOKEN lines, i.e. script lines that are neither blank nor `#`), writes
<dir>/clips.json [{title, start, end, lines: [first, last]}], one entry per part, covering the whole film. start/end =
first/last word of the part widened by --pad seconds but never into the neighbouring word, so a cut lands in the silence
between words. --offset shifts times (voice start in the video).
Retired `#clip <title>` ... `#/clip` blocks: still read (with a WARN to convert them) when the script has no `#part`.
"""
import argparse, json, os, re, sys

ap = argparse.ArgumentParser(); ap.add_argument("dir")
ap.add_argument("--pad", type=float, default=0.25); ap.add_argument("--offset", type=float, default=0.0)
a = ap.parse_args(); D = os.path.abspath(a.dir)

parts, blocks, cur, n = [], [], None, 0   # parts: (title, first spoken line) breaks; blocks: legacy #clip ranges
for l in open(f"{D}/script.txt", encoding="utf8"):
    l = l.strip()
    if not l:
        continue
    if not l.startswith("#"):
        n += 1
        continue
    m = re.match(r"#\s*(/?)\s*(clip|part)\b\s*:?\s*(.*)", l, re.I)
    if not m:
        continue
    if m.group(2).lower() == "part":
        parts.append((m.group(3).strip(), n))
    elif m.group(1):
        if cur is None:
            sys.exit(f"#/clip before any #clip (spoken line {n})")
        blocks.append((cur[0], cur[1], n - 1)); cur = None
    else:
        if cur is not None:
            sys.exit(f"#clip {m.group(3)!r} opened inside open clip {cur[0]!r}")
        cur = (m.group(3).strip() or f"clip {len(blocks) + 1}", n)

if parts:
    if blocks or cur:
        print("WARN  #clip blocks ignored: the Shorts series uses #part breaks only (delete the #clip/#/clip lines)")
    starts = [(t, s) for t, s in parts if 0 < s < n]
    ranges = [(t or f"Part {k + 1}", s, e - 1) for k, ((t, s), (_, e)) in enumerate(zip([("", 0)] + starts, starts + [("", n)]))]
elif blocks or cur:
    if cur is not None:
        sys.exit(f"clip {cur[0]!r} never closed (#/clip)")
    print("WARN  #clip blocks are retired: convert them to #part breaks (longform-writer §4); writing legacy clip times")
    ranges = blocks
else:
    sys.exit("no #part markers in script.txt (longform-writer §4)")

W = sorted((w for w in json.load(open(f"{D}/words.json", encoding="utf8")) if w.get("line", -1) < n), key=lambda w: w["s"])
out = []
for title, first, last in ranges:
    idx = [k for k, w in enumerate(W) if first <= w["line"] <= last]
    if not idx:
        sys.exit(f"{title!r}: no words for lines {first}-{last} (re-run voice.py?)")
    i, j = idx[0], idx[-1]
    s = max(W[i]["s"] - a.pad, W[i - 1]["e"] if i else 0.0)
    e = min(W[j]["e"] + a.pad, W[j + 1]["s"] if j + 1 < len(W) else W[j]["e"] + a.pad)
    out.append({"title": title, "start": round(s + a.offset, 3), "end": round(e + a.offset, 3), "lines": [first, last]})
json.dump(out, open(f"{D}/clips.json", "w", encoding="utf8"), indent=1)
for c in out:
    print(f"{c['start']:8.2f} {c['end']:8.2f} {c['end'] - c['start']:6.1f}s  {c['title']}")
