"""Shared ASR scoring for voice_takes.py / voicecheck.py: number words, spelled letters ("a double u s" = AWS)."""
import re

ONES = "zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen".split()
TENS = "_ _ twenty thirty forty fifty sixty seventy eighty ninety".split()


def say(n):  # 0..999999 as spoken words
    if n < 20: return ONES[n]
    if n < 100: return TENS[n // 10] + ("" if n % 10 == 0 else " " + ONES[n % 10])
    if n < 1000: return ONES[n // 100] + " hundred" + ("" if n % 100 == 0 else " " + say(n % 100))
    return say(n // 1000) + " thousand" + ("" if n % 1000 == 0 else " " + say(n % 1000))


def norm(t):  # scoring tokens: lowercase words, numbers as words, spelled letters collapsed ("a double u s" -> "aws")
    t = re.sub(r"\$(\d+)", r"\1 dollars", t.replace(",", ""))
    t = re.sub(r"\d+", lambda m: " " + (say(int(m.group())) if len(m.group()) < 7 else m.group()) + " ", t)
    t = t.lower().replace("-", " ")
    t = re.sub(r"\bdouble\s*(you|us|u)\b", lambda m: " w s " if m.group(1) == "us" else " w ", t)
    t = re.sub(r"\b([a-z])\.", r" \1 ", t)
    toks = re.sub(r"[^a-z0-9' ]+", " ", t).replace("'", "").split()
    # vowel-less 2-3 letter chunks the ASR glued together ("ws") are spelled letters
    toks = [c for w in toks for c in (list(w) if 2 <= len(w) <= 3 and not re.search(r"[aeiouy]", w) else [w])]
    out, i = [], 0
    while i < len(toks):
        j = i
        while j < len(toks) and len(toks[j]) == 1 and (toks[j] not in ("a", "i") or (j + 1 < len(toks) and len(toks[j + 1]) == 1 and toks[j + 1] not in ("a", "i"))):
            j += 1
        if j - i >= 2:
            out.append("".join(toks[i:j])); i = j
        else:
            out.append(toks[i]); i += 1
    return out


def wer(ref, hyp):
    r, h = norm(ref), norm(hyp); dp = list(range(len(h) + 1))
    for i in range(1, len(r) + 1):
        prev, dp[0] = dp[0], i
        for j in range(1, len(h) + 1):
            cur = dp[j]; dp[j] = min(dp[j] + 1, dp[j - 1] + 1, prev + (r[i - 1] != h[j - 1])); prev = cur
    return dp[len(h)] / max(1, len(r))
