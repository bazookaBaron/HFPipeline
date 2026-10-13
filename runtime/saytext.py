"""Display text -> text the voice should say (pure python, no deps; used by voice.py and the voice engines).

ALL-CAPS acronyms (2-5 letters) are spelled ("EKS" -> "E K S"); runtime/lexicon.json respells tricky ones
("AWS" -> "A double-you S": F5 cannot say a bare W). Captions keep the display words: `groups` maps every display
word to its say-tokens so aligned timings can be merged back per display word.
"""
import json, os, re

LEX_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "lexicon.json")
LEX = json.load(open(LEX_PATH, encoding="utf8")) if os.path.exists(LEX_PATH) else {}
KEEP = {"I", "OK", "A"}  # all-caps words read as words, not letters


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
