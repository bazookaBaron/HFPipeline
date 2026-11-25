"""Text normalisation and word error rate (English-oriented; other languages get case and punctuation folding only)."""
from __future__ import annotations
import re

_ONES = "zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen".split()
_TENS = "_ _ twenty thirty forty fifty sixty seventy eighty ninety".split()
_SUBJECT = {"it", "that", "what", "there", "here", "he", "she", "who", "where", "how", "when", "let", "one", "everyone", "someone"}
_IRREGULAR = {"won't": "will not", "can't": "can not", "cannot": "can not", "shan't": "shall not", "ain't": "is not", "gonna": "going to", "wanna": "want to", "gotta": "got to"}
_SUFFIX = (("n't", " not"), ("'re", " are"), ("'ve", " have"), ("'ll", " will"), ("'m", " am"), ("'d", " would"))


def number_words(n: int) -> str:
    if n < 20:
        return _ONES[n]
    if n < 100:
        return _TENS[n // 10] + (" " + _ONES[n % 10] if n % 10 else "")
    if n < 1000:
        return _ONES[n // 100] + " hundred" + (" " + number_words(n % 100) if n % 100 else "")
    if n < 1_000_000:
        return number_words(n // 1000) + " thousand" + (" " + number_words(n % 1000) if n % 1000 else "")
    return " ".join(_ONES[int(d)] for d in str(n))


def _num(m: re.Match) -> str:
    return " " + number_words(int(m.group(0).replace(",", ""))) + " "


def normalise(text: str) -> list[str]:
    t = text.lower().replace("’", "'").replace("‘", "'")
    t = t.replace("%", " percent ").replace("&", " and ").replace("$", " dollars ").replace("£", " pounds ").replace("€", " euros ")
    t = re.sub(r"\d{1,3}(?:,\d{3})+|\d+", _num, t)
    t = re.sub(r"[-–—_/]", " ", t)
    out: list[str] = []
    for w in re.findall(r"[a-z0-9']+", t):
        w = w.strip("'")
        if not w:
            continue
        if w in _IRREGULAR:
            out += _IRREGULAR[w].split()
            continue
        for suf, rep in _SUFFIX:
            if w.endswith(suf) and len(w) > len(suf):
                out += (w[: -len(suf)] + rep).split()
                break
        else:
            if w.endswith("'s"):
                base = w[:-2]
                out += [base, "is"] if base in _SUBJECT else [base]
            else:
                out.append(w.replace("'", ""))
    return out


def edit_distance(a: list[str], b: list[str]) -> int:
    prev = list(range(len(b) + 1))
    for i, x in enumerate(a, 1):
        cur = [i]
        for j, y in enumerate(b, 1):
            cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (x != y)))
        prev = cur
    return prev[-1]


def wer(reference: str, hypothesis: str) -> float:
    ref, hyp = normalise(reference), normalise(hypothesis)
    if not ref:
        return 0.0 if not hyp else 1.0
    return edit_distance(ref, hyp) / len(ref)
