"""films/v3test: 8-line integration test for the v3 engine (rooms, street, landmark exterior, MG). Stub voice timings.
python make_test.py  -> plan.json + lines.json"""
import json, pathlib
H = pathlib.Path(__file__).parent
CAST = {"jensen": {"build": 1.05, "hair": "short", "coat": True, "tie": False},
        "kress": {"build": 0.95, "hair": "long", "coat": True, "skirt": True},
        "senator": {"build": 1.25, "hair": "none", "coat": True, "tie": True}}
sets = [
    {"id": "board", "type": "boardroom", "seed": 3, "people": [{"id": "ceo", "char": "jensen", "pose": "speak", "at": "end:table:1"}], "focus": "ceo"},
    {"id": "senate", "type": "hearing", "seed": 5, "people": [{"id": "witness", "char": "jensen", "pose": "sit_lean", "at": "seat:witnessTable:1"}], "focus": "witness"},
    {"id": "diner", "type": "diner", "seed": 2, "people": [
        {"id": "m1", "pose": "sit_lean", "at": "seat:booths:4", "with": "men", "o": {"coat": True, "hat": "peak"}},
        {"id": "m2", "pose": "sit_listen", "at": "seat:booths:5", "with": "men", "o": {"coat": False}},
        {"id": "m3", "pose": "sit", "at": "seat:booths:6", "with": "men", "o": {"coat": True, "build": 1.3}},
        {"id": "waitress", "pose": "stand", "at": [1.4, 1.6], "face": "booths", "o": {"hair": "bun", "skirt": True, "coat": False, "prop": "cup"}}],
     "addGroups": [{"form": "table", "of": "counter", "n": 2, "name": "regulars"}], "focus": "men"},
    {"id": "presser", "type": "pressroom", "seed": 4, "groups": [{"form": "podium", "of": "podium", "n": 12, "name": "scrum", "speakerChar": "kress"},
                                                               {"form": "audience", "of": "seats", "n": 14, "name": "reporters"}, {"form": "workers", "of": "tvCamera", "name": "camOps"}],
     "focus": "scrum.speaker"},
    {"id": "rally", "type": "rally", "seed": 6, "focus": "speaker"},
    {"id": "floor", "type": "trading", "seed": 7, "focus": {"id": "floor", "index": 1}},
    {"id": "hq", "ground": {"kind": "city", "seed": 41, "relief": 0.06, "size": 240, "shore": False},
     "place": [{"what": "glassHQ", "where": "center", "focus": True, "name": "hq"}, {"what": "city", "n": 120, "where": "edge"},
               {"what": "road", "from": "edge:west", "to": "edge:east"}, {"what": "car", "n": 14, "where": "road"}, {"what": "trees", "n": 90, "where": "near hq"}],
     "light": {"time": "morning"}, "ambient": ["birds"]},
]
mg = [{"id": "drop", "parts": [{"kind": "annotatedDoc", "data": {"head": "Board minutes (test)", "ref": "12 Nov 2026", "cap": "What the board decided",
        "body": [{"t": "Founder steps down as chief executive.", "hi": 2, "note": "after 33 years"}, {"t": "Interim CEO named the same day.", "hi": 1, "note": "also CFO"}]}}]}]
lines = {
    "1": {"set": "board", "subject": "focus", "path": "reveal", "kind": "person"},
    "2": {"set": "senate", "subject": "focus", "path": "reveal", "kind": "person"},
    "3": {"set": "diner", "subject": "focus", "path": "reveal", "kind": "person"},
    "4": {"mg": "drop", "focus": 0},
    "5": {"set": "presser", "subject": "focus", "path": "reveal", "kind": "person"},
    "6": {"set": "rally", "subject": "focus", "path": "reveal", "kind": "person"},
    "7": {"set": "floor", "subject": "traders", "path": "reveal", "kind": "room"},
    "8": {"set": "hq", "subject": "focus", "callout": "Glass HQ (test)", "kind": "place"},
}
text = ["In the boardroom, the founder stands at the head of the table and tells the board he is leaving.",
        "Two weeks later he sits alone at the witness table while the committee asks why.",
        "Across town, three old engineers argue about it over coffee in a corner booth.",
        "The board minutes say it in two short lines.",
        "The interim chief executive steps up to a podium crowded with microphones.",
        "Outside, a crowd fills the square to hear what happens to their jobs.",
        "On the trading floor, phones light up as the shares start to slide.",
        "And at headquarters, the lights stay on late into the night."]
L, t = [], 1.2
for i, tx in enumerate(text):
    d = 4.6 if i != 3 else 5.0
    L.append({"n": i + 1, "shows": [], "anchor": None, "start": round(t, 2), "end": round(t + d, 2), "overrun": 0, "text": tx}); t += d + 1.2
plan = {"film": "v3test", "seed": 13, "v3": True, "cast": CAST, "sets": sets, "mg": mg, "lines": lines}
json.dump(plan, open(H / "plan.json", "w"), indent=1); json.dump(L, open(H / "lines.json", "w"), indent=1)
print("wrote", len(L), "lines, T~", round(t, 1))
