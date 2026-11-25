"""Word-synced caption chunks: 2-4 words, shown for at least 0.35 s, active word known per instant."""
from __future__ import annotations
from dataclasses import dataclass

MIN_SHOW = 0.35
MAX_WORDS = 4
MAX_CHARS = 30
HOLD = 0.15


@dataclass(frozen=True)
class Caption:
    words: tuple[str, ...]
    starts: tuple[float, ...]     # per word, seconds
    ends: tuple[float, ...]
    start: float                  # when the chunk appears
    end: float                    # when it goes away

    def active(self, j: int) -> tuple[float, float]:
        """Interval during which word j is the highlighted one."""
        a = self.start if j == 0 else self.starts[j]
        b = self.end if j == len(self.words) - 1 else self.starts[j + 1]
        return a, b


def _clean(words: list[dict]) -> list[tuple[str, float, float]]:
    out = []
    for x in words:
        w = " ".join(str(x["w"]).split()).rstrip(",")
        if w:
            out.append((w, float(x["s"]), float(x["e"])))
    out.sort(key=lambda t: t[1])
    return out


def _sentences(toks: list[tuple[str, float, float]]) -> list[list[tuple[str, float, float]]]:
    out, cur = [], []
    for t in toks:
        cur.append(t)
        if t[0][-1] in ".?!":
            out.append(cur)
            cur = []
    if cur:
        out.append(cur)
    return out


def _chunk_sentence(sent: list[tuple[str, float, float]]) -> list[list[tuple[str, float, float]]]:
    """Even split into the fewest chunks of at most 4 words (about 3 each), never across the sentence end."""
    n = len(sent)
    m = max(-(-n // MAX_WORDS), round(n / 3))
    m = max(-(-n // MAX_WORDS), min(m, int((sent[-1][2] - sent[0][1]) / (MIN_SHOW + 0.02))))   # dense speech: fewer, longer chunks
    if m == 1 and n > 1 and sum(len(t[0]) for t in sent) > MAX_CHARS:
        m = 2
    m = min(m, n)
    sizes = [n // m + (1 if k < n % m else 0) for k in range(m)]
    out, i = [], 0
    for z in sizes:
        out.append(sent[i:i + z])
        i += z
    return out


def chunks(words: list[dict]) -> list[Caption]:
    toks = _clean(words)
    groups = [g for s in _sentences(toks) for g in _chunk_sentence(s)]
    caps: list[Caption] = []
    prev_end = 0.0
    for k, g in enumerate(groups):
        start = g[0][1]
        end = max(g[-1][2] + HOLD, start + MIN_SHOW)
        if k + 1 < len(groups):
            end = min(end, groups[k + 1][0][1])
        if end - start < MIN_SHOW:                      # dense speech: borrow time before the chunk instead of merging across sentences
            start = max(prev_end, end - MIN_SHOW, 0.0)
        caps.append(Caption(tuple(x[0] for x in g), tuple(x[1] for x in g), tuple(x[2] for x in g), min(start, g[0][1]), end))
        prev_end = end
    return caps
