"""Reel planning: the LLM instruction, the JSONL parser, and the validator that every reel must pass before any GPU time is spent."""
from __future__ import annotations
import json
import re
from dataclasses import asdict
from difflib import SequenceMatcher

from ugc.checks.wer import normalise, number_words
from ugc.contract import Broll, Clip, Line, Reel

MIN_WORDS, MAX_WORDS = 18, 24
BROLL_TOLERANCE_S = 1.0
HOOK_SIMILARITY = 0.75

_NUM = set(number_words(n) for n in range(2, 20)) | {"twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety", "hundred", "thousand", "million", "billion", "dozen", "double", "triple"}
_NUM = {w for x in _NUM for w in x.split()} - {"zero"}
_FACT = _NUM | {"percent", "dollars", "dollar", "euros", "pounds", "cents", "bucks", "discount", "best", "greatest", "fastest", "cheapest", "easiest", "strongest", "biggest", "smallest",
                "safest", "healthiest", "most", "leading", "unbeatable", "unmatched", "toprated", "studies", "research", "experts", "scientists", "proven", "award", "awardwinning", "ranked"}
_STOP = set("a an the and or but of to in on at for with is are was be it this that you your we our they their as by from so if then than just really very can will".split())

EXPERIENCE = [
    r"\bi(?:'ve| have)?\s+(?:been\s+)?(?:use[ds]?|using)\b(?!\s+to\b)",
    r"\bi(?:'ve| have)?\s+(?:been\s+)?(?:tried|trying|tested|testing|switched|bought|purchased|owned)\b",
    r"\bi\s+(?:swear by|rely on|depend on)\b",
    r"\bi(?:'ve| have)?\s+(?:saved|lost|gained|noticed|seen|found|achieved|cured|healed|fixed|stopped|improved|doubled)\b",
    r"\bi\s+(?:was|had been)\s+(?:struggling|suffering|skeptical|sceptical|tired of)\b",
    r"\bmy\s+(?:skin|hair|acne|results?|body|weight|energy|sleep|pain|savings|business|income|journey)\b",
    r"\b(?:changed|saved|transformed|improved|fixed)\s+my\b",
    r"\b(?:worked|works|working)\s+for\s+me\b", r"\bfor me,?\s+(?:it|this)\b", r"\btrust me\b",
    r"\bi\s+(?:promise|guarantee|swear)\b", r"\bin my experience\b",
    r"\b(?:days?|weeks?|months?|years?)\s+ago,?\s+i\b", r"\bwhen i\s+(?:first|started|tried)\b",
]
GUARANTEE = [r"\bguarantee[ds]?\b", r"\bcures?[ds]?\b", r"\bheals?\b", r"\bdiagnos\w*", r"\bprevents?\b", r"\brisk[- ]free\b", r"\bno risk\b", r"\bclinically\b",
             r"\bdoctor[- ](?:approved|recommended)\b", r"\bfda\b", r"\bdouble your\b", r"\bget rich\b", r"\bpassive income\b", r"\bfinancial freedom\b", r"\b100\s?%", r"\bguaranteed returns?\b"]
ONSCREEN = r"\b(?:text|captions?|subtitles?|logos?|screens?|monitor|laptop|tablet|tv|television|website|webpage|browser|app|apps|url|qr|signs?|signage|poster|banner|billboard|label|labels|slogan|watermark|overlay|title card|written|lettering|typography|brand name|packaging)\b"
MINOR = r"\b(?:child|children|kid|kids|boy|girl|teen|teens|teenager|teenage|minor|toddler|baby|infant|schoolgirl|schoolboy|student in school|preteen|tween|juvenile)\b"
REALPERSON = r"\b(?:looks? like|resembl\w+|lookalike|look-alike|celebrity|famous|real person|based on|impersonat\w+|(?:named|called)\s+[A-Z][a-z]+)"
SKIN = r"\b(?:smooth|flawless|glowing|dewy|poreless|radiant|youthful|silky|porcelain|perfect skin|airbrushed|velvety|glossy|plump|luminous|clear skin|soft skin|baby)\b"
GESTURE_VERBS = r"\b(?:wave[sd]?|waving|point(?:s|ing)?|nod(?:s|ding)?|shrug(?:s|ging)?|hold(?:s|ing)? up|rais(?:e|es|ing)|lift(?:s|ing)?|tap(?:s|ping)?|touch(?:es|ing)?|tilt(?:s|ing)?|lean(?:s|ing)?|clap(?:s|ping)?|snap(?:s|ping)?|thumbs?[- ]up|shak(?:e|es|ing)|rub(?:s|bing)?|spread(?:s|ing)?|cross(?:es|ing)?|adjust(?:s|ing)?|push(?:es|ing)?|pull(?:s|ing)?|turn(?:s|ing)?|hold(?:s|ing)?|pick(?:s|ing)? up|put(?:s|ting)?|gesture[sd]?)\b"
GESTURE_SPLIT = r"\b(?:then|and then|after that|afterwards|twice|again|repeatedly|back and forth|several times|while)\b|;"
FORBIDDEN_MARKUP = r"[<>\"“”«»`*{}\[\]\\|]"


def spoken(clip: Clip) -> str:
    return " ".join(l.text.strip() for l in clip.lines)


def count_words(text: str) -> int:
    return sum(1 for t in text.split() if re.search(r"\w", t))


def _sentences(text: str) -> list[str]:
    return [s.strip() for s in re.split(r"(?<=[.?!])\s+", text) if s.strip()]


SMALL = {"two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"}
UNITS = set("minute minutes second seconds hour hours day days week weeks month months year years percent pound pounds kg grams gram calories people customers users times x ml litres liters inches cm mm dollars euros cents bucks".split())
COMPARE = r"\b(?:times|more than|less than|fewer than|faster|slower|better|cheaper|bigger|smaller|twice as|as much as)\b"


def _facts(sentence: str, brand: str, cta: str) -> set[str]:
    """Factual-looking tokens. Plain small counts ('two steps') only count with a unit, percent, 'times' or a comparison."""
    s = sentence.lower().replace("’", "'")
    for drop in (brand, cta):
        if drop:
            s = s.replace(drop.lower(), " ")
    toks = re.findall(r"\d[\d,]*|[a-z']+|[%$£€]", s)
    compare = bool(re.search(COMPARE, s))
    found: set[str] = set()
    for i, t in enumerate(toks):
        nxt = toks[i + 1] if i + 1 < len(toks) else ""
        if t[0] in "%$£€":
            found |= set(normalise(t))
        elif t[0].isdigit() or t in _NUM:
            small = (1 <= int(t.replace(",", "")) <= 10) if t[0].isdigit() else t in SMALL
            if not small or nxt in UNITS or nxt in "%$£€" or compare:
                found |= set(normalise(t))
        elif t in _FACT and t not in _NUM:
            found.add(t)
    if re.search(r"number one|#\s?1\b|\bno\.\s?1\b", s):
        found.add("number one")
    return found


def _cites(sentence: str, facts: set[str], claims: list[str]) -> bool:
    words = set(normalise(sentence))
    for c in claims:
        ctoks = set(normalise(c))
        if all(f in ctoks or f == "number one" and "number one" in c.lower() for f in facts) and (words & ctoks) - _STOP - _FACT:
            return True
    return False


def _near(a: str, b: str) -> bool:
    x, y = normalise(a), normalise(b)
    return bool(x) and bool(y) and (x == y or SequenceMatcher(None, x, y).ratio() >= HOOK_SIMILARITY)


def validate(reels: list[Reel], brief: dict, cfg: dict) -> list[str]:
    """Every problem found, each saying reel, clip and how to fix it. An empty list means the reels may go to the GPU."""
    out: list[str] = []
    r_cfg = cfg["reel"]
    n_clips = r_cfg["ai_clips"]
    claims = {c["id"]: c["text"] for c in brief.get("claims", [])}
    forbidden = [f for f in brief.get("forbidden", []) if f.strip()]
    brand, bcta = brief.get("brand", ""), brief.get("cta", "")
    out += _validate_brief(brief)
    seen_ids: set[str] = set()
    for r in reels:
        if r.id in seen_ids:
            out.append(f"{r.id}: reel id is used twice. Fix: give every reel a unique id like r01..r30.")
        seen_ids.add(r.id)
        if len(r.clips) != n_clips:
            out.append(f"{r.id}: has {len(r.clips)} clips, the config needs exactly {n_clips}. Fix: write {n_clips} clips (hook, middle, call to action).")
        bt = sum(b.seconds for b in r.broll)
        if abs(bt - r_cfg["broll_seconds"]) > BROLL_TOLERANCE_S:
            out.append(f"{r.id}: B-roll adds up to {bt:.1f} s, the plan needs {r_cfg['broll_seconds']:.0f} s (+/- {BROLL_TOLERANCE_S:.0f}). Fix: change the broll seconds so they total {r_cfg['broll_seconds']:.0f}.")
        for b in r.broll:
            if not 0 <= b.after_clip <= len(r.clips) or b.seconds <= 0:
                out.append(f"{r.id}: B-roll after_clip={b.after_clip}, seconds={b.seconds} is out of range. Fix: after_clip 0..{len(r.clips)}, seconds above 0.")
        unknown = [c for c in r.claims if c not in claims]
        if unknown:
            out.append(f"{r.id}: unknown claim id(s) {unknown}. Fix: use only ids from brief.json ({', '.join(claims) or 'none defined'}).")
        used = [claims[c] for c in r.claims if c in claims]
        if not r.cta.strip():
            out.append(f"{r.id}: cta is empty. Fix: set cta to the call to action spoken in the last clip.")
        elif r.clips and normalise(r.cta) and " ".join(normalise(r.cta)) not in " ".join(normalise(spoken(r.clips[-1]))):
            out.append(f"{r.id} {r.clips[-1].id}: the last clip does not speak the cta \"{r.cta}\". Fix: end the last clip with the cta wording.")
        if r.clips and r.hook.strip() and " ".join(normalise(r.hook)) not in " ".join(normalise(spoken(r.clips[0]))):
            out.append(f"{r.id} {r.clips[0].id}: the hook \"{r.hook}\" is not in the first clip. Fix: open clip 1 with the hook sentence.")
        for i, c in enumerate(r.clips, 1):
            out += _validate_clip(r, c, i, used, forbidden, brand, bcta)
        for field in ("title", "hook", "cta"):
            for f in forbidden:
                if re.search(rf"\b{re.escape(f)}\b", getattr(r, field), re.I):
                    out.append(f"{r.id}: forbidden word \"{f}\" in {field}. Fix: reword.")
    for i, a in enumerate(reels):
        for b in reels[i + 1:]:
            if _near(a.hook, b.hook):
                out.append(f"{b.id}: hook \"{b.hook}\" duplicates or nearly duplicates {a.id}'s \"{a.hook}\". Fix: write a different opening (change the angle, not just a word).")
    return out


def _validate_brief(brief: dict) -> list[str]:
    out = []
    p = brief.get("presenter", {})
    text = " ".join(str(p.get(k, "")) for k in ("description", "wardrobe", "room"))
    if re.search(MINOR, text, re.I) or _minor_age(text):
        out.append("brief presenter: described as a minor. Fix: the presenter must be an adult (state an adult age).")
    elif not _states_adult(str(p.get("description", ""))):
        out.append("brief presenter.description does not state an adult age. Fix: add the word \"adult\" or an age such as \"in her early thirties\".")
    if re.search(REALPERSON, text):
        out.append("brief presenter: described as a named or real person. Fix: describe a fictional adult by appearance only.")
    if re.search(SKIN, text, re.I):
        out.append("brief presenter: skin adjectives (smooth, glowing, flawless...) cause plastic skin. Fix: describe hair, eyes, build and clothing only.")
    if re.search(ONSCREEN, str(p.get("wardrobe", "")) + " " + str(p.get("room", "")), re.I):
        out.append("brief presenter: wardrobe or room mentions text, logos, screens or signs, which H3 draws badly. Fix: use plain clothing and a plain room.")
    return out


_AGE_WORDS = "zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen".split()
_AGE = "|".join(_AGE_WORDS)
MINOR_STRICT = r"\b(?:teen|teens|teenager|teenagers|teenage|schoolgirl|schoolboy|minor|underage|preteen|tween)\b"


def _minor_age(text: str) -> bool:
    """Numeric or written-out ages under 18: '15 year old', 'sixteen-year-old', 'aged fifteen', '16yo'."""
    t = text.lower()
    nums = re.findall(rf"\b(\d{{1,2}}|{_AGE})[- ]?(?:years?|yrs?)[- ]?old\b", t) + re.findall(rf"\baged?\s+(\d{{1,2}}|{_AGE})\b", t) + re.findall(r"\b(\d{1,2})\s?yo\b", t)
    return any((int(n) if n.isdigit() else 0) < 18 for n in nums)


def _states_adult(description: str) -> bool:
    d = description.lower()
    if re.search(r"\badult\b|\b(?:twenties|thirties|forties|fifties|sixties|seventies)\b", d):
        return True
    ages = re.findall(r"\b(\d{2})[- ]?(?:years?|yrs?)[- ]?old\b", d) + re.findall(r"\baged?\s+(\d{2})\b", d)
    return any(int(n) >= 18 for n in ages)


def _validate_clip(r: Reel, c: Clip, i: int, claims_used: list[str], forbidden: list[str], brand: str, bcta: str) -> list[str]:
    out: list[str] = []
    w = f"{r.id} {c.id}"
    text = spoken(c)
    n = count_words(text)
    if not MIN_WORDS <= n <= MAX_WORDS:
        out.append(f"{w}: {n} spoken words, need {MIN_WORDS}-{MAX_WORDS} so the line fits 10.1 s. Fix: {'cut' if n > MAX_WORDS else 'add'} about {abs(n - (MAX_WORDS if n > MAX_WORDS else MIN_WORDS))} words.")
    if c.id != f"{r.id}c{i}" or c.reel != r.id or c.index != i:
        out.append(f"{w}: id/reel/index do not match (expected id {r.id}c{i}, reel {r.id}, index {i}). Fix: correct the fields.")
    for line in c.lines:
        t = line.text.strip()
        if re.search(FORBIDDEN_MARKUP, t) or re.search(FORBIDDEN_MARKUP, line.delivery):
            out.append(f"{w}: quotes or markup in \"{t[:40]}\" would break the <d> tag. Fix: use plain words with only , . ? ! as punctuation.")
        if t and t[-1] not in ".?!":
            out.append(f"{w}: line \"{t[:40]}\" does not end with . ? or !. Fix: end each line with one of them.")
        if not t:
            out.append(f"{w}: an empty line. Fix: remove it or write the words.")
    scene = " ".join([c.action, c.framing, c.room] + [l.delivery for l in c.lines])
    allv = " ".join([text, scene, r.title])
    for f in forbidden:
        if re.search(rf"\b{re.escape(f)}\b", allv, re.I):
            out.append(f"{w}: forbidden word \"{f}\". Fix: reword the line or scene.")
    for pat in EXPERIENCE:
        m = re.search(pat, text.lower().replace("’", "'"))
        if m:
            out.append(f"{w}: personal experience \"{m.group(0)}\" is a fake testimonial (an AI presenter has no experience). Fix: talk about the product or the viewer (\"you\"), never what the presenter did or got.")
            break
    for pat in GUARANTEE:
        m = re.search(pat, text, re.I)
        if m:
            out.append(f"{w}: medical or financial promise \"{m.group(0)}\". Fix: remove guarantees, cures, risk-free or earnings talk.")
    if re.search(r"\bmy name is\b|\bcall me\b|\bi'?m\s+[A-Z][a-z]+\b|\bi am\s+[A-Z][a-z]+\b", text.replace("’", "'")):
        out.append(f"{w}: the presenter gives a personal name, which reads as a real person. Fix: do not name the presenter.")
    for s in _sentences(text):
        facts = _facts(s, brand, bcta)
        if facts and not _cites(s, facts, claims_used):
            out.append(f"{w}: \"{s}\" looks factual ({', '.join(sorted(facts))}) but matches none of the claims in this reel's claims {r.claims}. Fix: reword without numbers or superlatives, or add the claim to brief.json and list its id in the reel's claims.")
    if not c.action.strip():
        out.append(f"{w}: action is empty. Fix: describe one gesture.")
    else:
        verbs = {re.sub(r"(?:s|es|ing|ed|d)$", "", m.group(0).split()[0]) for m in re.finditer(GESTURE_VERBS, c.action, re.I)}
        if len(verbs) > 1 or re.search(GESTURE_SPLIT, c.action, re.I):
            out.append(f"{w}: action \"{c.action}\" has more than one gesture. Fix: keep a single gesture performed once.")
    if re.search(ONSCREEN, scene, re.I):
        out.append(f"{w}: the scene asks for on-screen text, a screen, a logo or a website; H3 must never draw them. Fix: remove it from action/framing/room (captions and the end card are added in the edit).")
    if re.search(MINOR, scene, re.I) or _minor_age(scene) or re.search(MINOR_STRICT, text, re.I) or _minor_age(text):
        out.append(f"{w}: a minor appears in the scene. Fix: show only the adult presenter.")
    if re.search(REALPERSON, scene):
        out.append(f"{w}: the scene refers to a named or real person. Fix: remove it.")
    if re.search(SKIN, scene, re.I):
        out.append(f"{w}: skin adjectives in the scene cause plastic skin. Fix: remove them.")
    return out


def example_reel() -> Reel:
    def clip(i: int) -> Clip:
        return Clip(id=f"r01c{i}", reel="r01", index=i, lines=[Line("Twenty words of plain spoken text go here, ending with a full stop.", "warmly")],
                    action="one gesture, performed once", framing="close selfie framing, head and shoulders", room="the presenter's room, a different corner", seed=1000 + i)
    return Reel(id="r01", title="short working title", hook="the first sentence of clip 1", clips=[clip(1), clip(2), clip(3)],
                broll=[Broll(0, 2.0, "", "what real footage to show"), Broll(2, 8.0, "", "what real footage to show")], cta="the call to action, spoken in clip 3", claims=["c1"])


def template(brief: dict, cfg: dict, n: int = 30) -> str:
    """The instruction an LLM follows to write n reels as JSONL (one JSON object per line, no fences, no commentary)."""
    r = cfg["reel"]
    p = brief.get("presenter", {})
    claims = "\n".join(f"  {c['id']}: {c['text']}  (source: {c.get('source', '')})" for c in brief.get("claims", [])) or "  (none)"
    pron = ", ".join(f"{k} is said like \"{v}\"" for k, v in brief.get("pronounce", {}).items()) or "none"
    example = json.dumps(asdict(example_reel()), ensure_ascii=False)
    return f"""Write {n} short UGC-style video reels for {brief['brand']} ({brief.get('url', '')}) about: {brief['topic']}.
Language: {brief.get('language', 'English')}. Audience: {brief.get('audience', '')}.
Output exactly {n} lines of JSON (JSONL): one reel per line, ids r01..r{n:02d}. No code fences, no commentary, no blank lines.

Each reel is {r['seconds']:.0f} s: {r['ai_clips']} AI presenter clips of 10.1 s each, plus about {r['broll_seconds']:.0f} s of real B-roll the owner films later.
Each line must have exactly this shape (the values are placeholders; write your own):
{example}

Rules (a validator rejects the file if any is broken; every problem is reported by reel and clip):
1. Clip lines: each clip speaks {MIN_WORDS}-{MAX_WORDS} words in total across its lines. Each line ends with . ? or ! and uses only letters, digits, apostrophes and , . ? ! as punctuation (no quotes, brackets, colons, dashes, markup).
2. Clip 1 opens with the reel's hook (reel.hook is its first sentence, repeated exactly). Clip {r['ai_clips']} ends with reel.cta repeated exactly. The brief's call to action: "{brief.get('cta', '')}".
3. Facts: say no number, percentage, price, ranking, superlative (best, fastest, most...) or proof claim unless it is in one of these claims, and list that claim's id in reel.claims. Use the claim wording.
{claims}
4. The presenter is an AI-generated person with no past. Never write "I used", "I've been using", "I tried", "my skin", "changed my life", "I saved", "trust me", "it worked for me" or any result or story the presenter lived. Speak about the product and to the viewer ("you"). No medical, health or money promises, no guarantees, no cures.
5. Forbidden words: {', '.join(brief.get('forbidden', [])) or 'none'}. Pronunciation: {pron}. Write brand names normally.
6. Each clip has exactly ONE physical gesture performed once (action, one short sentence, e.g. "holds up one open palm"). Never combine gestures, never say "then", "again" or "twice".
7. Never ask a clip to show text, captions, logos, screens, phones or laptops with content, websites, signs, posters or packaging labels. The presenter holds nothing that carries writing. Captions, the AI label and the end card are added later.
8. Presenter: {p.get('description', '')}; wardrobe: {p.get('wardrobe', '')}; voice: {p.get('voice', '')}. Keep this person an adult and never name them or compare them to a real person. Never describe skin.
9. Room: the base room is "{p.get('room', '')}". Vary the corner, light and time of day per reel (for example window side, desk, doorway, sofa arm); keep it the same room type.
10. framing: one short phrase per clip (close selfie, chest-up, slightly wide selfie). Keep the face large in frame.
11. Variety across the {n} reels: no two hooks alike (rotate question, bold statement of a claim, relatable problem, curiosity, myth-bust, quick tip, challenge to the viewer, before-you-buy thought); vary energy (calm, upbeat, deadpan, excited, thoughtful), rooms and openings. Every clip's delivery is a short direction like "warmly", "with a small laugh", "calm and clear".
12. broll: a list whose seconds add up to {r['broll_seconds']:.0f} (+/- {BROLL_TOLERANCE_S:.0f}); after_clip 0..{r['ai_clips']} says where the cutaway starts (0 = before the first clip); source stays ""; note says what real footage to film.
13. clip ids are r01c1, r01c2, ...; clip.reel is the reel id; clip.index is 1..{r['ai_clips']}; every seed is a different integer.
"""


def parse(text: str, cfg: dict) -> list[Reel]:
    """JSONL to Reels. Ignores code fences and blank lines. Every bad line is reported with its line number."""
    reels, errors = [], []
    for no, raw in enumerate(text.splitlines(), 1):
        line = raw.strip()
        if not line or line.startswith("```"):
            continue
        try:
            reels.append(Reel.from_dict(json.loads(line)))
        except json.JSONDecodeError as e:
            errors.append(f"line {no}: not valid JSON ({e.msg} at column {e.colno}). Fix: one complete JSON object per line.")
        except (KeyError, TypeError, AttributeError) as e:
            errors.append(f"line {no}: wrong reel shape ({type(e).__name__}: {e}). Fix: follow the example object exactly.")
    if errors:
        raise ValueError("\n".join(errors))
    return reels
