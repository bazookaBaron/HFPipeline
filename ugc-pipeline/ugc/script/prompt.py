"""MiniMax H3 full-reference (Ref2VA) prompt: six fields, one per line, in the official order."""
from __future__ import annotations
import re

from ugc.contract import Clip

MAX_CHARS = 5000
LEAD = "[Shot 1] Create a photorealistic video with an f/16 aperture look and deep depth of field."
SKIN_TRIGGER = "Facial Realism"
OUTDOOR = r"\b(?:outdoor|outdoors|outside|garden|street|park|balcony|terrace|beach|patio|yard|rooftop)\b"


def _stamp(t: float) -> str:
    ms = round(t * 1000)
    return f"{ms // 60000:02d}:{ms // 1000 % 60:02d}.{ms % 1000:03d}"


def clean_dialogue(text: str) -> str:
    """Only letters, digits, in-word apostrophes and , . ? ! survive; the line ends with . ? or !."""
    t = text.replace("’", "'").replace("‘", "'").replace("…", ".").replace("%", " percent ").replace("&", " and ")
    t = re.sub(r"[;:—–]", ",", t)
    t = re.sub(r"[-_/]", " ", t)
    t = re.sub(r"[^\w\s,.?!']", "", t)
    t = re.sub(r"(?<!\w)'|'(?!\w)", "", t)
    t = re.sub(r"\s+([,.?!])", r"\1", t)
    t = re.sub(r"([,.?!])\1+", r"\1", t)
    t = re.sub(r"\s+", " ", t).strip(" ,")
    return t if t and t[-1] in ".?!" else t + "."


def _respell(text: str, pronounce: dict) -> str:
    for word, like in pronounce.items():
        text = re.sub(rf"\b{re.escape(word)}\b", like, text, flags=re.I)
    return text


def _one_line(s: str) -> str:
    return re.sub(r"\s+", " ", s).strip()


def render(clip: Clip, brief: dict, cfg: dict) -> str:
    p = brief.get("presenter", {})
    lang = brief.get("language", "English")
    pron = brief.get("pronounce", {})
    seconds = cfg["model"]["frames"] / cfg["model"]["fps"]
    lines = [(clean_dialogue(_respell(l.text, pron)), _one_line(l.delivery)) for l in clip.lines]
    words = [max(1, len(t.split())) for t, _ in lines]
    total = sum(words)
    beats, t0 = [], 0.0
    gesture_at = len(lines) // 2
    for i, ((text, delivery), w) in enumerate(zip(lines, words)):
        how = f"{delivery}, " if delivery else ""
        act = f" During this beat the presenter does one gesture, once: {_one_line(clip.action).rstrip('.')}." if i == gesture_at else ""
        lead = "The presenter looks into the lens and" if i == 0 else f"At {_stamp(t0)}, the presenter keeps eye contact and"
        beats.append(f"{lead}, {how}(S1) says: <d>[{lang}] {text}</d>{act}")
        t0 += seconds * w / total
    last = clip.index == cfg["reel"]["ai_clips"]
    role = "closing call to action" if last else "opening hook" if clip.index == 1 else "middle explanation"
    room = _one_line(clip.room)
    ambience = "gentle outdoor ambience" if re.search(OUTDOOR, room, re.I) else "quiet indoor room tone"
    fields = [
        ("subject_definitions",
         f"<Subject 1> is the presenter from <Picture 1>, a character sheet: on the right a close-up of the face, on the left the outfit seen from the front and from the back. Use it for identity: exact face, hairstyle, outfit and proportions. "
         f"The video is a single full-frame scene with one person. Outfit: {_one_line(p.get('wardrobe', ''))}. <Audio 1> is reference for voice timbre only ({_one_line(p.get('voice', ''))})."),
        ("summary",
         f"One continuous phone-selfie style take, vertical 9:16, a {role} in which <Subject 1> speaks to the viewer with steady eye contact in {room}, framed as {_one_line(clip.framing).rstrip('.')}."),
        ("retention_analysis",
         "<Subject 1>: fully_preserved (exact face, hairstyle, outfit, body proportions). <Audio 1>: reference (voice timbre only)."),
        ("detailed_description",
         f"{LEAD} {SKIN_TRIGGER}. The camera is a handheld phone at selfie distance with gentle natural sway, {_one_line(clip.framing).rstrip('.')}, in {room}, with soft natural light on the presenter. "
         + " ".join(beats)),
        ("overall_soundscape",
         f"The presenter's voice (S1) sits close and clear, matching the timbre of <Audio 1>, over {ambience}."),
        ("non_diegetic_music", "N/A"),
    ]
    out = "\n".join(f"{k}: {v}" for k, v in fields)
    if len(out) >= MAX_CHARS:
        raise ValueError(f"{clip.id}: prompt is {len(out)} characters, the limit is {MAX_CHARS}. Shorten the clip's room, framing or delivery text.")
    return out
