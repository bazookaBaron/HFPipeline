"""Give the script's own words (verbatim spelling and punctuation) the timings of the words the recogniser heard."""
from __future__ import annotations
from difflib import SequenceMatcher

from ugc.checks.wer import normalise

MIN_WORD_S = 0.06
MATCH_RATIO = 0.5          # a script word counts as aligned when its heard counterpart is at least this similar
GAP = 0.8                  # cost of leaving a script or heard word unpaired


def _key(tok: str) -> str:
    return "".join(normalise(tok))


def _sim(a: str, b: str) -> float:
    return SequenceMatcher(None, a, b).ratio() if a and b else 0.0


def _align(script: list[str], heard: list[str]) -> list[tuple[list[int], list[int]]]:
    """Edit-distance alignment over normalised tokens; pairs may be 1:1, 1:2 or 2:1. Unpaired tokens are omitted."""
    n, m = len(script), len(heard)
    INF = float("inf")
    cost = [[INF] * (m + 1) for _ in range(n + 1)]
    back: list[list[tuple | None]] = [[None] * (m + 1) for _ in range(n + 1)]
    cost[0][0] = 0.0
    for i in range(n + 1):
        for j in range(m + 1):
            c = cost[i][j]
            if c == INF:
                continue
            moves = []
            if i < n:
                moves.append((i + 1, j, GAP, (i,), ()))
            if j < m:
                moves.append((i, j + 1, GAP, (), (j,)))
            if i < n and j < m:
                moves.append((i + 1, j + 1, 1 - _sim(script[i], heard[j]), (i,), (j,)))
            if i < n and j + 1 < m:
                moves.append((i + 1, j + 2, 1.05 - _sim(script[i], heard[j] + heard[j + 1]), (i,), (j, j + 1)))
            if i + 1 < n and j < m:
                moves.append((i + 2, j + 1, 1.05 - _sim(script[i] + script[i + 1], heard[j]), (i, i + 1), (j,)))
            for ni, nj, d, si, hj in moves:
                if c + d < cost[ni][nj]:
                    cost[ni][nj] = c + d
                    back[ni][nj] = (i, j, si, hj)
    pairs, i, j = [], n, m
    while (i, j) != (0, 0):
        pi, pj, si, hj = back[i][j]
        if si and hj:
            pairs.append((list(si), list(hj)))
        i, j = pi, pj
    return pairs[::-1]


def script_words(text: str, heard_words: list[dict], duration: float) -> tuple[list[dict], str]:
    """Returns ([{w, s, e}], "script" | "heard"). "script" covers every script word once, in order, monotonic, inside [0, duration]."""
    toks = [t for t in text.split() if _key(t)]
    heard = [h for h in heard_words if _key(h["w"])]
    heard_out = [{"w": h["w"], "s": h["s"], "e": h["e"]} for h in heard_words]
    if not toks or not heard:
        return heard_out, "heard"
    pairs = _align([_key(t) for t in toks], [_key(h["w"]) for h in heard])
    good = sum(len(si) for si, hj in pairs if _sim("".join(_key(toks[i]) for i in si), "".join(_key(heard[j]["w"]) for j in hj)) >= MATCH_RATIO)
    if good * 2 < len(toks):
        return heard_out, "heard"
    span: dict[int, tuple[float, float]] = {}
    for si, hj in pairs:
        s, e = heard[hj[0]]["s"], heard[hj[-1]]["e"]
        step = (e - s) / len(si)
        for k, i in enumerate(si):
            span[i] = (s + step * k, s + step * (k + 1))
    t = [None] * len(toks)
    i = 0
    while i < len(toks):
        if i in span:
            t[i] = span[i]
            i += 1
            continue
        j = i
        while j < len(toks) and j not in span:
            j += 1
        lo = span[i - 1][1] if i else 0.0
        hi = span[j][0] if j < len(toks) else duration
        weights = [len(_key(toks[k])) for k in range(i, j)]
        cur = lo
        for k, w in zip(range(i, j), weights):
            nxt = cur + max(hi - lo, 0.0) * w / sum(weights)
            t[k] = (cur, nxt)
            cur = nxt
        i = j
    out, prev = [], 0.0
    for s, e in t:
        s = max(s, prev)
        e = max(e, s + MIN_WORD_S)
        out.append([s, e])
        prev = e
    limit = duration
    for k in range(len(out) - 1, -1, -1):
        out[k][1] = min(out[k][1], limit)
        out[k][0] = min(out[k][0], out[k][1] - MIN_WORD_S)
        limit = out[k][0]
    return [{"w": w, "s": round(s, 3), "e": round(e, 3)} for w, (s, e) in zip(toks, out)], "script"
