"""Clarity lint for reel scripts (rules: .claude/skills/reel-writer/SKILL.md §4).

python runtime/scriptcheck.py <dir|script.txt> [--allow "base sixty-two,URL"] [--min 60] [--max 80] [--max-numbers 2] [--hook-max 6]
Exit 1 on any FAIL. WARN lines are advisory.
"""
import argparse, os, re, sys

NUM_WORDS = {"zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven",
             "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen", "twenty",
             "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety", "hundred", "thousand", "million",
             "billion", "trillion", "percent", "point"}
# Counted as ONE number per contiguous run ("three hundred eighteen thousand" = 1). Runs of only small step words ("one, two, three") don't count.
STEP_OK = {"one", "two", "three", "four", "five"}
JARGON = {"protocol", "latency", "throughput", "idempotent", "scalability", "scalable", "architecture", "infrastructure",
          "paradigm", "leverage", "utilize", "asynchronous", "synchronous", "distributed", "orchestration", "abstraction",
          "algorithm", "authentication", "authorization", "encryption", "hashing", "hash", "sharding", "shard",
          "replication", "partition", "microservice", "microservices", "endpoint", "payload", "token", "tokens",
          "megawatt", "kilowatt", "gigabyte", "megabyte", "terabyte", "petabyte", "api", "cdn", "dns", "sql", "nosql"}
BANNED = ["let's dive", "in today's video", "did you know", "game-changer", "game changer", "in this video", "smash that"]


def syllables(w):
    w = re.sub(r"[^a-z]", "", w.lower())
    if not w:
        return 0
    if len(w) <= 3:
        return 1
    w = re.sub(r"(?:[^laeiouy]es|ed|[^laeiouy]e)$", "", w)
    w = re.sub(r"^y", "", w)
    return max(1, len(re.findall(r"[aeiouy]{1,2}", w)))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("path")
    ap.add_argument("--allow", default="")
    ap.add_argument("--profile", default="ref", choices=["ref", "short"],
                    help="ref = reference-reel style (reel-writer, <= 1.5 min); short = retired <= 25 s style")
    ap.add_argument("--min", type=int)
    ap.add_argument("--max", type=int)
    ap.add_argument("--max-numbers", type=int)
    ap.add_argument("--hook-max", type=int)
    a = ap.parse_args()
    REF = a.profile == "ref"
    for k, ref_v, short_v in (("min", 200, 60), ("max", 270, 80), ("max_numbers", 4, 2), ("hook_max", 10, 6)):
        if getattr(a, k) is None:
            setattr(a, k, ref_v if REF else short_v)
    p = a.path if a.path.endswith(".txt") else os.path.join(a.path, "script.txt")
    lines = [l.strip() for l in open(p, encoding="utf-8") if l.strip() and not l.startswith("#")]
    allow = {t.strip().lower() for t in a.allow.split(",") if t.strip()}
    allow_words = {w for t in allow for w in re.findall(r"[a-z]+", t)}
    fails, warns = [], []

    words = [w for l in lines for w in re.findall(r"[A-Za-z0-9']+", l)]
    n = len(words)
    if n > a.max:
        fails.append(f"{n} words > {a.max} (cut whole ideas, not adjectives)")
    elif n < a.min:
        warns.append(f"{n} words < {a.min}")

    hook = re.findall(r"[A-Za-z0-9']+", lines[0]) if lines else []
    if len(hook) > a.hook_max:
        fails.append(f"hook is {len(hook)} words > {a.hook_max}: {lines[0]!r}")

    if REF:  # structure of the 5 reference reels (reel-writer §2)
        if not re.search(r"(explained|^how |^what (is|exactly)|^why )", lines[0], re.I):
            warns.append(f"title opener: refs start '<Topic> explained.' / 'How X works.' / 'What is X?': {lines[0]!r}")
        if not re.search(r"\blet's (walk|break|start|follow|look)", " ".join(lines), re.I):
            fails.append("no spoken signpost (Let's walk through it. / Let's break that down. / Let's start with X.)")
        labels = re.findall(r"(?:^|[.?!]\s)(step \w+[.,]|layer \w+[.,]|part \w+[.,]|now comes \w+|now, the|first,|next,|finally,)", " ".join(lines), re.I)
        if len(labels) < 2:
            fails.append(f"only {len(labels)} step labels: refs label every step (Step 1. Data. / Now comes CD.)")
    elif lines and lines[0].rstrip().endswith("?"):
        fails.append(f"hook is a question: state the most surprising claim instead: {lines[0]!r}")
    cta = re.compile(r"\b(like this|like and|smash|share (this|it|with)|send this (to|reel|video)|save (this|it|for)|follow (me|us|for)|subscribe|comment (below|down))\b", re.I)
    for l in lines:
        if cta.search(l):
            fails.append(f"asks for engagement (earn it instead): {l!r}")

    sents = [s.strip() for l in lines for s in re.split(r"(?<=[.!?])\s+", l) if s.strip()]
    lens = [len(re.findall(r"[A-Za-z0-9']+", s)) for s in sents]
    if REF:
        avg, over = n / max(1, len(sents)), [s for s, k in zip(sents, lens) if k > 15]
        if avg > 10:
            fails.append(f"average sentence {avg:.1f} words > 10")
        if len(over) > max(2, round(0.12 * len(sents))):
            fails.append(f"{len(over)} sentences over 15 words (max ~12 %, keep them comma lists): {over}")
        for s, k in zip(sents, lens):
            if k > 25:
                fails.append(f"sentence {k} words > 25: {s!r}")
    else:
        for s, k in zip(sents, lens):
            if k > 12:
                fails.append(f"sentence {k} words > 12: {s!r}")

    syl = sum(syllables(w) for w in words)
    fk = 0.39 * n / max(1, len(sents)) + 11.8 * syl / max(1, n) - 15.59
    if fk > 8:
        fails.append(f"reading grade {fk:.1f} > 8 (target <= 6)")
    elif fk > 6:
        warns.append(f"reading grade {fk:.1f} (target <= 6)")
    long_w = sorted({w for w in words if syllables(w) >= 4 and w.lower() not in allow_words})
    if len(long_w) > 3:
        warns.append(f"{len(long_w)} long words: {', '.join(long_w)}")

    runs, cur = [], []
    for w in words:
        lw = w.lower()
        isnum = lw in NUM_WORDS or lw.isdigit() or bool(re.match(r"^\w+-(one|two|three|four|five|six|seven|eight|nine)$", lw))
        if isnum or (cur and lw == "and"):
            cur.append(lw)
        else:
            if cur:
                runs.append(" ".join(cur).removesuffix(" and"))
            cur = []
    if cur:
        runs.append(" ".join(cur))
    nums = [r for r in runs if not set(r.split()) <= STEP_OK and " ".join(r.split()) not in allow]
    if len(nums) > a.max_numbers:
        fails.append(f"{len(nums)} numbers > {a.max_numbers}: {nums}")
    unlabelled = re.sub(r"\b(step|layer|part) \d+\.", "", " ".join(lines), flags=re.I)
    if re.search(r"\d", unlabelled):
        fails.append("digits in script: write numbers as spoken words (only 'Step 1.' style labels may use digits)")
    if re.search(r"[()\"%$/&]", " ".join(lines)):
        fails.append("symbols/quotes/parentheses in script: write them as words")

    for l in lines:
        for w in re.findall(r"[A-Za-z][A-Za-z'-]*", l):
            lw = w.lower()
            if lw in allow_words:
                continue
            acronym = len(w) >= 2 and w not in {"I", "OK"} and (w.isupper() or re.match(r"^[A-Z]{2}|.[a-z][A-Z]", w))
            if acronym or lw in JARGON:
                (warns if REF else fails).append(f"jargon/acronym {w!r} (explain it in plain words, or --allow it AND explain it): {l!r}")
    for b in BANNED:
        if b in " ".join(lines).lower():
            fails.append(f"banned phrase {b!r}")

    secs = n / 2.7
    print(f"{p}: {len(lines)} lines, {n} words, ~{secs:.0f}s at speed 1.0, grade {fk:.1f}, numbers {nums}")
    for w in warns:
        print("WARN ", w)
    for f in dict.fromkeys(fails):
        print("FAIL ", f)
    print("PASS" if not fails else f"{len(set(fails))} FAIL")
    sys.exit(1 if fails else 0)


if __name__ == "__main__":
    main()
