"""Clarity lint for narration scripts (rules: .claude/skills/reel-writer/SKILL.md §4, long-form: longform-writer/SKILL.md).

python runtime/scriptcheck.py <dir|script.txt> [--profile ref|short|longform|longform-parts] [--allow "base sixty-two,URL"]
       [--min N] [--max N] [--max-numbers N] [--hook-max N]
Profiles: ref = reference-reel style (<= 1.5 min, default; 2-6 `{dry}` sarcastic beats, punching down FAILs); short = retired <= 25 s style; longform = 16-18 min
(cold open, 7-9 chapters, re-hooks <= 90 s apart, sarcasm density, and the PART n Shorts series: `#part` breaks every
60-170 s, each right after a curiosity hook; runtime/shorts/README-shorts.md). longform-parts = alias of longform.
Lines starting with `#` are markers (`#hook`, `#/hook`, `# Chapter <name>`, `#part [title]`), never spoken; retired
`#clip`/`#/clip` blocks only get a WARN to convert them to `#part` breaks;
`{tags}` (saytext.TAGS: dry, slow, fast, pause, stress:word, loop:key, payoff:key, viz:...) are stripped before counting.
ref + longform also run: the promise tracker (every open loop, cold open and boundary question is paid off later),
the drop-off predictor (abstract or idea-free stretches, number runs), big numbers made human (a comparison line +
`{viz:compare ...}`) and a pronunciation check against runtime/lexicon.json; longform adds `#protagonist` / `#thread`
and a counterpoint beat per chapter. Exit 1 on any FAIL. WARN lines are advisory.
"""
import argparse, os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from saytext import LEX, TAGS, split_tags  # noqa: E402

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
# Punching down (longform-writer §3): slurs/ableist insults and jokes at victims. Matched as whole words/phrases.
PUNCH_DOWN = ["retard", "retarded", "spaz", "cripple", "crippled", "midget", "psycho", "lunatic", "lunatics", "tranny",
              "illegals", "savages", "savage natives", "oriental", "gypped", "gyp", "darwin award", "natural selection at work",
              "had it coming", "asked for it", "deserved to die", "deserved it", "got what they deserved", "dumb victims",
              "stupid victims", "those people", "these people", "third-world mentality"]

# min/max words, max_numbers, hook_max (words in line 1); title/signpost/labels = reel structure (reel-writer §2);
# avg/long/long_share/max_sent = sentence lengths (max_sent only for short); jargon: "warn" | "fail".
PROFILES = {
    "ref": dict(min=200, max=270, max_numbers=4, hook_max=10, title=True, signpost=True, labels=2, q_hook_fail=False,
                avg=10, long=15, long_share=0.12, max_sent=25, jargon="warn", longform=False, dry=(2, 6), punch=True,
                story=True, wps=3.3, bignum="warn"),
    "short": dict(min=60, max=80, max_numbers=2, hook_max=6, title=False, signpost=False, labels=0, q_hook_fail=True,
                  avg=None, long=None, long_share=None, max_sent=12, jargon="fail", longform=False),
    "longform": dict(min=2600, max=2950, max_numbers=80, hook_max=20, title=False, signpost=False, labels=0, q_hook_fail=False,
                     avg=12, long=15, long_share=0.15, max_sent=25, jargon="warn", longform=True,
                     story=True, wps=2.75, bignum="fail"),
}
# story checks (ref + longform): promise tracker, drop-off predictor, big numbers, pronunciation
OPEN_LOOP = re.compile(r"\bhold on to\b|\bkeep (that|this) in mind\b|\bwe'll (get|come back) to\b|\bcome back to\b|"
                       r"\bin a (minute|moment)\b|\blater in (this|the) (video|film|story)\b|\bby the end\b|\bmore on (that|this) later\b", re.I)
BIG = re.compile(r"\b(thousand|million|billion|trillion)\b")
COMPARE = re.compile(r"\bthat's (like|about|roughly|almost|nearly|more than|less than|enough|the same|as)\b|\bas (big|long|tall|heavy|much|many|wide|old|fast) as\b|"
                     r"\b(the )?size of\b|\benough to\b|\bequal to\b|\bthe same as\b|\bimagine\b|\bpicture\b|\bfor every\b|\bper (person|worker|day|second|hour|minute)\b|"
                     r"\b(longer|taller|bigger|heavier|more|larger|faster|smaller) than\b|\btimes (more|the|as)\b|\bevery (single )?(person|second|day|minute)\b|"
                     r"\bit would take\b|\bstacked\b|\bend to end\b|\blike a\b|\bworth of\b|\beach\b|\bcombined\b|\ba (day|week|minute|second)\b|"
                     r"\b(stadium|arena|football (field|pitch)|swimming pool|olympic pool|city|town|country|eiffel tower|aircraft carrier|"
                     r"jumbo jet|bus|buses|school bus|elephant|blue whale|year of (wages|salary|pay))s?\b", re.I)   # familiar yardsticks
COUNTER = re.compile(r"\bto be fair\b|\bin fairness\b|\bin (its|their|his|her) defen[cs]e\b|\bcritics\b|\bdefenders\b|\bsupporters\b|"
                     r"\b(others|some|many) (argue|say|point out|disagree)\b|\bnot everyone (agrees|thinks|buys)\b|\bthe other side\b|"
                     r"\bon the other hand\b|\b(the company|the government|officials|they) (say|said|says|argue|insist|deny|denied)\b|"
                     r"\bargue[sd]?\b|\bcounter\b|\bthe case for\b|\bfair point\b|\bwhich is true\b|\bthat's not the whole\b", re.I)
STOP = set("""a an the and or but so then than that this these those there here it its it's they them their he she his her
him we our you your i me my is are was were be been being have has had do does did not no yes of to in on at by for from
with as into onto over under about after before again also just only very really more most much many some any all each
every one two three what which who whom whose why how when where will would could should can may might must shall let's
like get got make made going go goes went say says said know knew now still even back out up down off""".split())
CONCRETE = set("""box boxes ship ships truck trucks train plane car cars road port ports dock crane cranes container containers
money cash dollar dollars rupee rupees pound pounds euro coin bill bills price prices cost costs pay paid wage salary rent
tax taxes loan bank banks shop shops store stores factory factories warehouse office desk phone phones laptop screen badge
email letter contract paper map island sea ocean river canal strait coast beach city town village street house home room
door wall roof bridge tower building food bread rice oil fuel gas petrol coal steel gold iron water wheat sugar coffee shoe
shoes shirt sofa fridge chip chips battery engine gun guns missile missiles drone tank tanks soldier soldiers army navy
worker workers boss ceo farmer farmers family families kid kids child children mother father driver drivers pilot crew
captain guard police judge court jail prison king queen president minister meeting table chair queue ticket tickets
tent tents sandwich hand hands face eye eyes mouth body day night morning week month year years minute minutes hour hours
mile miles kilometre kilometres metre metres foot feet ton tons tonne tonnes barrel barrels kilo kilos litre litres
camera video photo app website server""".split())
DAYS = {"Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday", "January", "February", "March",
        "April", "May", "June", "July", "August", "September", "October", "November", "December", "I", "OK"}
DROP = dict(abstract_s=(20, 35), stale_s=(20, 35), num_run=(3, 4), loop_window=3)
PROFILES["longform-parts"] = PROFILES["longform"]  # old name, same rules
WPS = 2.75            # long-form estimate (Chatterbox at --cb-tempo 1.15 incl. gaps; recalibrate from the pilot's words.json)
LF = dict(cold_max=20, chapters=(7, 9), chapter_s=(100, 150), rehook_gap=90, dry_every=(30, 90),
          part_s=(60, 170), chapter_pause=2.8)
# Shorts-series breaks (`#part`): the last sentence before each break must make the viewer want the next part
# (open question, teased reveal, stakes raised, reversal coming).
PART_HOOK = re.compile(r"\?\s*$|\bbut that's not\b|\bthat's not (all|even|the end|where|how|what)\b|\bwhat happen(ed|s) next\b|"
                       r"\bwhat (came|comes) next\b|\bhere's the (thing|catch|twist|problem)\b|\bit gets worse\b|\bturns out\b|"
                       r"\bplot twist\b|\b(nobody|no one) (expected|saw|knew|noticed|guessed|asked)\b|\buntil\b|\bone (small |big )?problem\b|"
                       r"\b(wasn't|isn't|is not|was not) (finished|over|done|the end)\b|\babout to\b|"
                       r"\bthe real (problem|reason|story|winner|cost|bill|answer)\b|\bwe'll get to\b|\bin a (minute|moment)\b|"
                       r"\bhold on to\b|\bkeep (that|this) in mind\b|\bcome back to\b|\bthat's when\b|\band then\b|"
                       r"\bthe (worst|strangest|biggest|real) (part|twist)\b|\bquestion\b|\bsurpris|\bsecret\b|\bmystery\b|"
                       r"\bnot for long\b|\bwhat nobody\b|\bthe catch\b|\bwould (soon|never)\b|\b(only|just) the (start|beginning)\b", re.I)
# Each part after the first opens on a 1-line recap/bridge (it also reads naturally in the full film).
RECAP = re.compile(r"^(so|remember|by now|so far|we've|we have|after|now|last time|that|which|with|once|meanwhile|back)\b|"
                   r"\bso far\b|\bremember\b|\bwe've seen\b|\bwe saw\b", re.I)
SIGNPOST = re.compile(r"\blet's (walk|break|start|follow|look|go|rewind|see|zoom)|\bhere's (how|what|why|the)\b", re.I)
LABEL = re.compile(r"(?:^|[.?!]\s)(step \w+[.,]|layer \w+[.,]|part \w+[.,]|now comes \w+|now, the|first,|next,|finally,)", re.I)
# Re-hook cues (longform-writer §2): open loop, reversal, stakes jump, direct question, callback. Chapter and part
# starts also count (each opens with its own mini-hook).
REHOOK = re.compile(r"\?|\bhold on to\b|\bremember\b|\bkeep (that|this) in mind\b|\bcome back to\b|\bwe'll get to\b|"
                    r"\bin a (minute|moment)\b|\bhere's the (thing|catch|twist|problem)\b|\bthat was the good\b|"
                    r"\bit gets worse\b|\bturns out\b|\bplot twist\b|\bspoiler\b|\bthat's not even\b|\band then\b|"
                    r"\bwhat could possibly go wrong\b|\bbut that's not\b|\bthe real (problem|reason|story)\b|"
                    r"^(but|except|then|worse|and it worked|it didn't)\b", re.I)
LEAD_PRONOUN = re.compile(r"^(this|that|these|those|he|she|it|they|him|her|his|its|their|them|"
                          r"it's|that's|they're|he's|she's|there's)\b", re.I)
W = lambda s: re.findall(r"[A-Za-z0-9']+", s)


def syllables(w):
    w = re.sub(r"[^a-z]", "", w.lower())
    if not w:
        return 0
    if len(w) <= 3:
        return 1
    w = re.sub(r"(?:[^laeiouy]es|ed|[^laeiouy]e)$", "", w)
    w = re.sub(r"^y", "", w)
    return max(1, len(re.findall(r"[aeiouy]{1,2}", w)))


def parse(path):
    """-> spoken lines (tag-free), dry flags, markers [(kind, arg, spoken_index_of_next_line)], tags per line."""
    lines, dry, marks, tags = [], [], [], []
    for raw in open(path, encoding="utf-8"):
        l = raw.strip()
        if not l:
            continue
        if l.startswith("#"):
            m = re.match(r"#\s*(/?)\s*(hook|clip|chapter|part|protagonist|thread)\b\s*:?\s*(.*)", l, re.I)
            if m:
                marks.append(((m.group(1) + m.group(2)).lower(), m.group(3).strip(), len(lines)))
            continue
        text, tg = split_tags(l)
        dry.append(any(n == "dry" for n, _, _ in tg))
        lines.append(text); tags.append(tg)
    return lines, dry, marks, tags


def sentences(l):
    return [s for s in re.split(r"(?<=[.!?])\s+", l.strip()) if s]


def content(s):
    return {w.lower().rstrip("s") for w in W(s) if len(w) >= 4 and w.lower() not in STOP and not w.isdigit()}


YEAR = re.compile(r"^(nineteen|twenty) (oh |ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|"
                  r"twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)\b(?!.*\b(hundred|thousand|million|billion|percent)\b)")


def num_runs(s):
    """number runs in a sentence (same counting as the main check; small step words alone don't count)."""
    runs, cur = [], []
    for w in W(s) + [""]:
        lw = w.lower()
        if lw and (lw in NUM_WORDS or lw.isdigit() or re.match(r"^\w+-(one|two|three|four|five|six|seven|eight|nine)$", lw) or (cur and lw == "and")):
            cur.append(lw)
        elif cur:
            r = " ".join(cur).removesuffix(" and")
            if not set(r.split()) <= STEP_OK and not YEAR.match(r):
                runs.append(r)
            cur = []
    return runs


def story_checks(lines, marks, tags, P, allow_words, fails, warns):
    """Promise tracker, drop-off predictor, big numbers made human, pronunciation (ref + longform)."""
    LFm = P["longform"]
    wps = P["wps"]
    cum = [0]
    for l in lines:
        cum.append(cum[-1] + len(W(l)))
    t = lambda i: cum[i] / wps
    fmt = lambda s: f"{int(s // 60)}:{int(s % 60):02d}"
    tag = lambda i, name: [a for n, a, _ in tags[i] if n == name]

    # --- unknown tags / stress targets
    for i, l in enumerate(lines):
        for n, a, _ in tags[i]:
            if n not in TAGS:
                warns.append(f"unknown tag {{{n}}} on line {i} (known: {', '.join(sorted(TAGS))}): {l!r}")
            if n == "stress" and (not a or a.lower() not in {w.lower() for w in W(l)}):
                fails.append(f"{{stress:{a}}}: word not in the line: {l!r}")

    # --- promise tracker
    loops, pays = {}, {}
    for i in range(len(lines)):
        for k in tag(i, "loop"):
            if not k:
                fails.append(f"{{loop}} needs a key, e.g. {{loop:runway}}: {lines[i]!r}")
            elif k in loops:
                fails.append(f"{{loop:{k}}} opened twice (lines {loops[k]} and {i})")
            else:
                loops[k] = i
        for k in tag(i, "payoff"):
            pays.setdefault(k, i)
    if any(k == "hook" for k, _, i in marks):
        loops.setdefault("hook", 0)   # the cold open is a promise: close it with {payoff:hook}
    for k, i in loops.items():
        if k not in pays:
            fails.append(f"unpaid promise {{loop:{k}}} (line {i}, {fmt(t(i))}): pay it off later and tag that line {{payoff:{k}}}"
                         + (" (the cold open must come back, explained)" if k == "hook" else ""))
        elif pays[k] <= i and k != "hook":
            fails.append(f"{{payoff:{k}}} (line {pays[k]}) comes before its {{loop:{k}}} (line {i})")
    for k, i in pays.items():
        if k not in loops:
            fails.append(f"{{payoff:{k}}} on line {i} without a matching {{loop:{k}}}")
    for i, l in enumerate(lines):
        if OPEN_LOOP.search(l) and not tag(i, "loop"):
            fails.append(f"open loop not tracked: tag it {{loop:<key>}} and its payoff {{payoff:<key>}}: {l!r}")
    # a question right before a #/hook, # Chapter, #part or the end must be answered later
    edges = {i for k, _, i in marks if k in ("/hook", "chapter", "part")} | {len(lines)}
    for i, l in enumerate(lines):
        if not l.rstrip().endswith("?") or i + 1 not in edges or tag(i, "loop"):
            continue
        q = content(sentences(l)[-1])
        if not any(len(q & content(m)) >= 2 and not m.rstrip().endswith("?") for m in lines[i + 1:]):
            fails.append(f"question left open at a break (line {i}): answer it later, or tag {{loop:<key>}} ... {{payoff:<key>}}: {l!r}")

    # --- drop-off predictor
    def stretches(flag, limits, what):
        start = None
        for i in range(len(lines) + 1):
            if i < len(lines) and not flag(i):
                start = i if start is None else start
                continue
            if start is not None:
                d = t(i) - t(start)
                if d > limits[1]:
                    fails.append(f"drop-off: ~{d:.0f}s {what} ({fmt(t(start))}, lines {start}-{i - 1}): {lines[start]!r}")
                elif d > limits[0]:
                    warns.append(f"drop-off: ~{d:.0f}s {what} ({fmt(t(start))}, lines {start}-{i - 1}): {lines[start]!r}")
                start = None
    def concrete(i):
        l = lines[i]
        if tag(i, "viz") or num_runs(l) or re.search(r"\b(says|said|asks|asked|writes|wrote),", l):
            return True
        for s in sentences(l):
            ws = W(s)
            if any(w[0].isupper() and w not in DAYS for w in ws[1:]):   # a name or place mid-sentence
                return True
        return any(w.lower() in CONCRETE for w in W(l))
    stretches(concrete, DROP["abstract_s"], "abstract stretch with no concrete image (a thing, place, person, number or {viz:})")
    seen = set()
    fresh = []
    for l in lines:
        c = content(l)
        fresh.append(len(c - seen) >= 2 or bool(num_runs(l)))
        seen |= c
    stretches(lambda i: fresh[i], DROP["stale_s"], "with no new idea (same words again; move on or cut)")
    sents = [s for l in lines for s in sentences(l)]
    run = 0
    for s in sents:
        n = len(num_runs(s))
        if n >= DROP["num_run"][0]:
            fails.append(f"drop-off: {n} numbers in one sentence (split it, keep one number per sentence): {s!r}")
        run = run + 1 if n else 0
        if run == DROP["num_run"][0]:
            warns.append(f"drop-off: {run} sentences in a row with numbers (give the viewer a picture between them): {s!r}")
        if run == DROP["num_run"][1]:
            fails.append(f"drop-off: {run} sentences in a row with numbers: {s!r}")

    # --- big numbers made human: first mention gets a comparison line + {viz:compare ...} (same or next line)
    done = set()
    for i, l in enumerate(lines):
        for r in num_runs(l):
            if not BIG.search(r) or r in done:
                continue
            done.add(r)
            near = range(i, min(i + 2, len(lines)))
            has_cmp = any(COMPARE.search(lines[j]) for j in near)
            has_viz = any(a and a.lower().startswith("compare") for j in near for a in tag(j, "viz"))
            if not (has_cmp and has_viz):
                miss = " and ".join(x for x, ok in (("a comparison line", has_cmp), ("a {viz:compare ...} hint", has_viz)) if not ok)
                (fails if P["bignum"] == "fail" else warns).append(f"big number {r!r} needs {miss} (same or next line): {l!r}")

    # --- pronunciation: names the lexicon does not know yet
    known = {k.lower() for k in LEX} | {w for l in lines for w in re.findall(r"\b[a-z][a-z'-]*", l)}  # lowercase elsewhere = common word
    unknown = set()
    for l in lines:
        for s in sentences(l):
            for k, w in enumerate(re.findall(r"[A-Za-z][A-Za-z'-]*", s)):
                core = re.sub(r"'s$", "", w)
                mixed = bool(re.search(r"[a-z][A-Z]", core))
                if core in DAYS or core.lower() in known or core.lower() in allow_words:
                    continue
                if (core.isupper() and len(core) <= 5) or not core[0].isupper():
                    continue
                if k > 0 or mixed:
                    unknown.add(core)
    if unknown:
        warns.append(f"{len(unknown)} names not in runtime/lexicon.json (check how the voice says them; add a respelling, "
                     f"or map the name to itself once it sounds right): {', '.join(sorted(unknown))}")

    if not LFm:
        return
    # --- long-form story spine: protagonist + follow-one-object thread, counterpoint per chapter
    prot = [a for k, a, _ in marks if k == "protagonist"]
    thread = [a for k, a, _ in marks if k == "thread"]
    if not prot:
        fails.append("no `#protagonist <name | role>` line (one everyperson carried through the film)")
    if not thread:
        fails.append("no `#thread <object | alias>` line (the one object we follow: a container, a barrel, a payment)")
    names = lambda v: [x.strip().lower() for a in v for x in a.split("|") if x.strip()]
    pn, tn = names(prot), names(thread)
    chs = [(a, i) for k, a, i in marks if k == "chapter"]
    bounds = [i for _, i in chs] + [len(lines)]
    for (name, s), e in zip(chs, bounds[1:]):
        body = " ".join(lines[s:e]).lower()
        has = lambda ns: any(re.search(rf"\b{re.escape(n)}", body) for n in ns)
        if pn and tn and not has(pn) and not has(tn):
            warns.append(f"chapter {name!r}: neither the protagonist ({' / '.join(pn)}) nor the thread ({' / '.join(tn)}) appears")
        if not COUNTER.search(body):
            warns.append(f"chapter {name!r}: no counterpoint beat (To be fair, ... / Critics say ... / The company says ...)")


def longform_checks(lines, dry, marks, fails, warns):
    cum = [0]
    for l in lines:
        cum.append(cum[-1] + len(W(l)))
    t = lambda i: cum[i] / WPS  # estimated start time (s) of spoken line i
    total = t(len(lines))
    fmt = lambda s: f"{int(s // 60)}:{int(s % 60):02d}"

    hooks = [i for k, _, i in marks if k == "hook"]
    if not hooks or hooks[0] != 0:
        fails.append("no `#hook` marker before line 1 (cold open in medias res, <= 20 s)")
    else:
        end = next((i for k, _, i in marks if i > 0 and k in ("/hook", "chapter", "part")), len(lines))
        if t(end) > LF["cold_max"]:
            fails.append(f"cold open ~{t(end):.0f}s > {LF['cold_max']}s (end it with `#/hook`)")

    chs = [(a, i) for k, a, i in marks if k == "chapter"]
    if not LF["chapters"][0] <= len(chs) <= LF["chapters"][1]:
        fails.append(f"{len(chs)} chapters (want {LF['chapters'][0]}-{LF['chapters'][1]} `# Chapter <name>` lines)")
    bounds = [i for _, i in chs] + [len(lines)]
    for (name, s), e in zip(chs, bounds[1:]):
        d = t(e) - t(s)
        body = " ".join(lines[s:e])
        if not SIGNPOST.search(body) and not LABEL.search(body):
            fails.append(f"chapter {name!r}: no spoken signpost or label (Let's start with X. / Step 1. / First,)")
        if not LF["chapter_s"][0] <= d <= LF["chapter_s"][1]:
            warns.append(f"chapter {name!r} ~{d:.0f}s (target {LF['chapter_s'][0]}-{LF['chapter_s'][1]}s)")
        if not any(dry[s:e]):
            warns.append(f"chapter {name!r}: no {{dry}} sarcastic beat")

    # retired #clip blocks (Shorts are now the consecutive `#part` series): advise, never fail
    if any(k in ("clip", "/clip") for k, _, _ in marks):
        warns.append("`#clip` ... `#/clip` blocks are retired: delete them and mark the Shorts series with `#part` lines instead "
                     "(a break every 60-170 s, right after a curiosity hook; longform-writer §4)")

    # re-hook gaps
    pts = sorted({0, *(i for k, _, i in marks if k in ("chapter", "part"))} |
                 {i for i, l in enumerate(lines) if any(REHOOK.search(s) for s in re.split(r"(?<=[.!?])\s+", l))})
    pts = [p for p in pts if p < len(lines)] + [len(lines)]
    for a, b in zip(pts, pts[1:]):
        if t(b) - t(a) > LF["rehook_gap"]:
            fails.append(f"no re-hook for ~{t(b) - t(a):.0f}s ({fmt(t(a))}-{fmt(t(b))}, lines {a}-{b - 1}): add an open loop, "
                         f"reversal, stakes jump, question or callback (max {LF['rehook_gap']}s)")

    # sarcasm density (~1 {dry} per 45-60 s)
    nd = sum(dry)
    lo, hi = total / LF["dry_every"][1], total / LF["dry_every"][0]
    if not lo <= nd <= hi:
        warns.append(f"{nd} {{dry}} sarcastic beats for ~{total / 60:.1f} min (target ~1 per 45-60 s: {lo:.0f}-{hi:.0f})")


def part_times(lines, marks):
    """-> estimated start time (s) of each spoken line + 1 (end), incl. the chapter breathing pauses voice.py adds."""
    chs = [i for k, _, i in marks if k == "chapter" and i > 0]
    out, acc = [], 0
    for i in range(len(lines) + 1):
        out.append(acc / WPS + LF["chapter_pause"] * sum(1 for c in chs if c <= i))
        acc += len(W(lines[i])) if i < len(lines) else 0
    return out


def part_checks(lines, marks, fails, warns):
    """Shorts series: `#part [title]` lines split the film into consecutive 60-170 s parts (< 3 min Shorts limit)."""
    brk = [i for k, _, i in marks if k == "part"]
    if not brk:
        fails.append("no `#part` markers (every long-form is also cut into a Shorts series: "
                                              "put `#part` after a curiosity-hook line every 60-170 s)")
        return
    if len(set(brk)) != len(brk) or any(i <= 0 or i >= len(lines) for i in brk):
        fails.append("`#part` markers must sit between spoken lines (not before the first or after the last, never two in a row)")
        brk = sorted({i for i in brk if 0 < i < len(lines)})
    t = part_times(lines, marks)
    bounds = [0] + brk + [len(lines)]
    lo, hi = LF["part_s"]
    lens = []
    for n, (a, b) in enumerate(zip(bounds, bounds[1:]), 1):
        d = t[b] - t[a]
        lens.append(d)
        if not lo <= d <= hi:
            fails.append(f"part {n} ~{d:.0f}s (lines {a}-{b - 1}; must be {lo}-{hi}s, Shorts max 3 min)")
        if b < len(lines):
            last = [s for s in re.split(r"(?<=[.!?])\s+", lines[b - 1].strip()) if s][-1]
            if not PART_HOOK.search(last):
                fails.append(f"part {n} ends without a curiosity hook (open question, teased reveal, stakes raised, "
                             f"'but that's not what happened next'): {last!r}")
        if n > 1 and not RECAP.search(lines[a]):
            warns.append(f"part {n} should open with a 1-line recap/bridge (So..., Remember..., By now...): {lines[a]!r}")
    print(f"parts: {len(lens)} (" + ", ".join(f"{d:.0f}s" for d in lens) + ")")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("path")
    ap.add_argument("--allow", default="")
    ap.add_argument("--profile", default="ref", choices=list(PROFILES),
                    help="ref = reference-reel style (reel-writer, <= 1.5 min); short = retired <= 25 s style; "
                         "longform = 16-18 min (longform-writer)")
    ap.add_argument("--min", type=int)
    ap.add_argument("--max", type=int)
    ap.add_argument("--max-numbers", type=int)
    ap.add_argument("--hook-max", type=int)
    a = ap.parse_args()
    P = PROFILES[a.profile]
    for k in ("min", "max", "max_numbers", "hook_max"):
        if getattr(a, k) is None:
            setattr(a, k, P[k])
    p = a.path if a.path.endswith(".txt") else os.path.join(a.path, "script.txt")
    lines, dry, marks, tags = parse(p)
    allow = {t.strip().lower() for t in a.allow.split(",") if t.strip()}
    allow_words = {w for t in allow for w in re.findall(r"[a-z]+", t)}
    fails, warns = [], []
    text = " ".join(lines)

    words = W(text)
    n = len(words)
    if n > a.max:
        fails.append(f"{n} words > {a.max} (cut whole ideas, not adjectives)")
    elif n < a.min:
        (fails if P["longform"] else warns).append(f"{n} words < {a.min}")

    hook = W(lines[0]) if lines else []
    if len(hook) > a.hook_max:
        fails.append(f"hook is {len(hook)} words > {a.hook_max}: {lines[0]!r}")

    if P["title"] and not re.search(r"(explained|^how |^what (is|exactly)|^why )", lines[0], re.I):
        warns.append(f"title opener: refs start '<Topic> explained.' / 'How X works.' / 'What is X?': {lines[0]!r}")
    if P["signpost"] and not re.search(r"\blet's (walk|break|start|follow|look)", text, re.I):
        fails.append("no spoken signpost (Let's walk through it. / Let's break that down. / Let's start with X.)")
    if P["labels"]:
        labels = LABEL.findall(text)
        if len(labels) < P["labels"]:
            fails.append(f"only {len(labels)} step labels: refs label every step (Step 1. Data. / Now comes CD.)")
    if P["q_hook_fail"] and lines and lines[0].rstrip().endswith("?"):
        fails.append(f"hook is a question: state the most surprising claim instead: {lines[0]!r}")
    cta = re.compile(r"\b(like this|like and|smash|share (this|it|with)|send this (to|reel|video)|save (this|it|for)|follow (me|us|for)|subscribe|comment (below|down))\b", re.I)
    for l in lines:
        if cta.search(l):
            fails.append(f"asks for engagement (earn it instead): {l!r}")

    sents = [s.strip() for l in lines for s in re.split(r"(?<=[.!?])\s+", l) if s.strip()]
    lens = [len(W(s)) for s in sents]
    if P["avg"]:
        avg, over = n / max(1, len(sents)), [s for s, k in zip(sents, lens) if k > P["long"]]
        if avg > P["avg"]:
            fails.append(f"average sentence {avg:.1f} words > {P['avg']}")
        if len(over) > max(2, round(P["long_share"] * len(sents))):
            fails.append(f"{len(over)} sentences over {P['long']} words (max ~{P['long_share'] * 100:.0f} %, keep them comma lists): {over}")
    for s, k in zip(sents, lens):
        if k > P["max_sent"]:
            fails.append(f"sentence {k} words > {P['max_sent']}: {s!r}")

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
    unlabelled = re.sub(r"\b(step|layer|part) \d+\.", "", text, flags=re.I)
    if re.search(r"\d", unlabelled):
        fails.append("digits in script: write numbers as spoken words (only 'Step 1.' style labels may use digits)")
    if re.search(r"[()\"%$/&{}]", text):
        fails.append("symbols/quotes/parentheses in script: write them as words")

    for l in lines:
        for w in re.findall(r"[A-Za-z][A-Za-z'-]*", l):
            lw = w.lower()
            if lw in allow_words:
                continue
            acronym = len(w) >= 2 and w not in {"I", "OK"} and (w.isupper() or re.match(r"^[A-Z]{2}|.[a-z][A-Z]", w))
            if acronym or lw in JARGON:
                (warns if P["jargon"] == "warn" else fails).append(f"jargon/acronym {w!r} (explain it in plain words, or --allow it AND explain it): {l!r}")
    low = text.lower()
    for b in BANNED:
        if b in low:
            fails.append(f"banned phrase {b!r}")
    if P["longform"] or P.get("punch"):   # punching-down terms FAIL on long-form and reference reels (sarcasm punches UP)
        for b in PUNCH_DOWN:
            if re.search(rf"\b{re.escape(b)}\b", low):
                fails.append(f"punching down {b!r}: aim the joke at the institution, plan or greed, never at victims or groups")
    if P.get("dry"):   # reel sarcasm density (reel-writer §3b): ~1 {dry} beat per 15-20 s
        lo, hi = P["dry"]
        if not lo <= sum(dry) <= hi:
            warns.append(f"{sum(dry)} {{dry}} sarcastic beats (reel target {lo}-{hi}, ~1 per 15-20 s; tag the line end with {{dry}})")
    if P.get("story"):
        story_checks(lines, marks, tags, P, allow_words, fails, warns)
    if P["longform"]:
        longform_checks(lines, dry, marks, fails, warns)
        part_checks(lines, marks, fails, warns)

    if P["longform"]:
        print(f"{p}: {len(lines)} lines, {n} words, ~{n / WPS / 60:.1f} min at {WPS} w/s, grade {fk:.1f}, {len(nums)} numbers, {sum(dry)} dry")
    else:
        print(f"{p}: {len(lines)} lines, {n} words, ~{n / 2.7:.0f}s at speed 1.0, grade {fk:.1f}, numbers {nums}" + (f", {sum(dry)} dry" if P.get("dry") else ""))
    for w in warns:
        print("WARN ", w)
    for f in dict.fromkeys(fails):
        print("FAIL ", f)
    print("PASS" if not fails else f"{len(set(fails))} FAIL")
    sys.exit(1 if fails else 0)


if __name__ == "__main__":
    main()
