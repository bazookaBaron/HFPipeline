"""Display text -> text the voice should say (pure python, no deps; used by voice.py and the voice engines).

ALL-CAPS acronyms (2-5 letters) are spelled ("EKS" -> "E K S"); runtime/lexicon.json respells tricky ones
("AWS" -> "A double-you S": F5 cannot say a bare W) and is the pronunciation dictionary for brands, places and names
("BookMyShow" -> "Book My Show"); an entry mapped to itself marks a name as checked (scriptcheck stops warning on it).
Captions keep the display words: `groups` maps every display word to its say-tokens so aligned timings can be merged
back per display word.

Line tags (longform-writer §5, reel-writer §3): `{name}` or `{name:arg}` anywhere in a script line, never spoken or
captioned. split_tags() strips them; TAGS lists the known ones.
"""
import json, os, re

LEX_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "lexicon.json")
LEX = json.load(open(LEX_PATH, encoding="utf8")) if os.path.exists(LEX_PATH) else {}
KEEP = {"I", "OK", "A"}  # all-caps words read as words, not letters
TAG = re.compile(r"\s*\{(\w+)(?::([^}]*))?\}\s*")
# delivery: dry (deadpan), slow/fast (line tempo), pause[:sec] (silence before if the tag opens the line, else after),
# stress:word (light emphasis); tracking: loop:key / payoff:key (promise tracker); storyboard: viz:<kind …>.
TAGS = {"dry", "slow", "fast", "pause", "stress", "loop", "payoff", "viz"}


def split_tags(line):
    """-> (clean text, [(name, arg_or_None, at_start)]) for one script line."""
    tags = [(m.group(1).lower(), (m.group(2) or "").strip() or None, m.start() == 0) for m in TAG.finditer(line)]
    return (" ".join(TAG.sub(" ", line).split()) if tags else line.strip()), tags


def say_tokens(word):
    m = re.match(r"^([^A-Za-z0-9]*)([A-Za-z0-9'.-]*?)([^A-Za-z0-9]*)$", word)
    pre, core, post = m.groups() if m else ("", word, "")
    key = core[:-2] if core.endswith("'s") else core
    poss = core[len(key):]
    if key in LEX:
        toks = LEX[key].split()
    elif key.isupper() and 2 <= len(key) <= 5 and key.isalpha() and key not in KEEP:
        toks = list(key)
    else:
        return [word]
    toks[0] = pre + toks[0]; toks[-1] = toks[-1] + poss + post
    return toks


def to_say(text):
    """-> (display_words, groups, say_text)"""
    words = text.split(); groups = [say_tokens(w) for w in words]
    return words, groups, " ".join(t for g in groups for t in g)
