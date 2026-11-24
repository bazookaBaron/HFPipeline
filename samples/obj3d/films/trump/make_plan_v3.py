# Producer step v3 for the Trump film ("Is Trump a Russian asset?"): rooms + streets with posed, faceless figures ("dollhouse documentary"),
# SAME voice (voice.wav / words.json / lines.json untouched, no new TTS).
# Writes films/trump/plan_v3.json (plan.json, the approved v2 plan, is left untouched) and mirrors it into films/trump_v3/
# (plan.json + copies of lines.json / voice.wav / script.md, sound.json with video out/trump_v3.mp4) so film.html?film=trump_v3,
# render.mjs and audio/mix.py run it without any engine change (same mechanism as films/nvidia/make_plan_v3.py -> films/nvidia_v3).
# Every line is tagged kind = person | room | street | place | data. Allegations stay "alleged" / "reported" / "claimed" exactly as in script.md;
# the script's balance (proven / alleged / disproven / unverified) is kept. Exterior place specs + MG beat data reuse the v2 plan's sourced data.
# Run: python make_plan_v3.py
import json, pathlib, shutil, copy, sys
F = pathlib.Path(__file__).parent
V2 = json.loads((F / "plan.json").read_text(encoding="utf8"))
EXT = {s["id"]: s for s in V2["sets"]}
MGV2 = {b["id"]: b for b in V2["mg"]}
LINES = json.loads((F / "lines.json").read_text(encoding="utf8"))

# ---------------- cast: fixed faceless silhouettes for recurring people (build / hair block / coat / tie / prop), no likeness ----------------
CAST = {
  "trump":     {"build": 1.35, "hair": "short", "coat": True, "tie": True},
  "putin":     {"build": 0.92, "hair": "none", "coat": True, "tie": True},
  "donjr":     {"build": 1.1, "hair": "short", "coat": True, "tie": False},
  "kushner":   {"build": 0.88, "hair": "short", "coat": True, "tie": False},
  "manafort":  {"build": 1.15, "hair": "short", "coat": True, "tie": True},
  "cohen":     {"build": 1.0, "hair": "none", "coat": True, "tie": True},
  "sater":     {"build": 1.12, "hair": "none", "coat": True, "tie": False},
  "kilimnik":  {"build": 1.05, "hair": "short", "coat": False, "tie": False},
  "vesel":     {"build": 0.9, "hair": "long", "coat": True, "skirt": True},
  "agalarov":  {"build": 1.18, "hair": "none", "coat": True, "tie": True},
  "emin":      {"build": 0.98, "hair": "short", "coat": False, "tie": False},
  "steele":    {"build": 1.0, "hair": "none", "coat": True, "tie": True},
  "mueller":   {"build": 1.05, "hair": "short", "coat": True, "tie": True},
  "horowitz":  {"build": 1.0, "hair": "none", "coat": True, "tie": True},
  "durham":    {"build": 1.08, "hair": "none", "coat": True, "tie": True},
  "mccain":    {"build": 1.0, "hair": "none", "coat": True, "tie": True},
  "senator":   {"build": 1.22, "hair": "none", "coat": True, "tie": True},
  "official":  {"build": 1.1, "hair": "short", "coat": True, "tie": True},
}

S = []
def room(id, type=None, seed=1, scale=None, **kw):
  s = {"id": id, "seed": seed, **({"type": type} if type else {}), **({"scale": scale} if scale else {}), **kw}
  if scale is None and type is None: s["scale"] = "room"
  S.append(s); return id
def ext(src, newid=None, focus_what=None, **kw):
  s = copy.deepcopy(EXT[src]); s["id"] = newid or src
  if focus_what:
    for e in s["place"]:
      if e.get("focus"):
        e["what"] = focus_what[0]; e.update(focus_what[1] if len(focus_what) > 1 else {})
        for k in ("floors", "style", "roof", "d"):
          if k not in (focus_what[1] if len(focus_what) > 1 else {}): e.pop(k, None)
  s.update(kw); S.append(s); return s["id"]

# ================= rooms / streets (generated at runtime from these specs; posed figures, camera-only motion) =================
# 3 two camps: a plaza split by a barrier, two crowds facing each other with placards
room("camps", scale="street", seed=51, street={"w": 58, "d": 40, "kind": "plaza", "facades": ["back", "left"], "road": "front"},
     place=[{"what": "barrier", "n": 1, "len": 12, "at": [2, 4], "h": 90}, {"what": "tree", "n": 3, "at": "plaza"}, {"what": "car", "n": 2, "at": "kerb"}],
     groups=[{"form": "crowd", "n": 22, "area": [-14, -1, -2, 9], "toward": [8, 4], "poses": ["stand", "raise_hand", "stand_arms_crossed", "point"], "signs": 0.3, "name": "campA"},
             {"form": "crowd", "n": 22, "area": [6, -1, 18, 9], "toward": [-6, 4], "poses": ["stand", "raise_hand", "stand_arms_crossed", "point"], "signs": 0.3, "name": "campB"}],
     focus={"id": "campA", "index": 2}, light={"time": "morning"})
# 4 + 90 the trial frame: a courtroom, the bench as focus (bookend: "the gavel is yours")
room("trial", "courtroom", seed=3, focus="bench")
# 8 1987: he arrives at a Moscow airport gate
room("arrive87", "airport", seed=4, people=[{"id": "trump", "char": "trump", "pose": "walk", "prop": "briefcase", "at": [-5.6, -1.6], "face": 200}], focus="trump", light={"time": "overcast"})
# 10 1996: announcing a Moscow tower at a press conference
room("press96", "pressroom", seed=5, groups=[{"form": "podium", "of": "podium", "n": 10, "name": "scrum", "speakerChar": "trump"},
     {"form": "audience", "of": "seats", "n": 18, "name": "reporters"}, {"form": "workers", "of": "tvCamera", "name": "camOps"}], focus="scrum.speaker")
# 11 the partner firm's office: Felix Sater on the phone
room("bayrock", seed=6, room={"w": 8, "d": 6.5, "h": 3, "floor": "wood", "windows": 3, "doors": [{"wall": "left", "at": 0.85}]},
     place=[{"what": "desk", "name": "desk", "at": "back", "variant": "papers"}, {"what": "shelf", "at": "left", "n": 2, "fill": "books"}, {"what": "filing", "at": "left", "n": 2},
            {"what": "coffeeTable", "name": "ct", "at": "center", "off": [1.0, 0.8]}, {"what": "plant", "at": "corner", "n": 2}, {"what": "wallArt", "kind": "photo", "at": "back", "n": 2}],
     people=[{"id": "sater", "char": "sater", "pose": "phone", "at": [0.6, 0.4], "face": 60}],
     groups=[{"form": "huddle", "n": 2, "at": [-1.6, 1.6], "name": "staff"}], focus="sater", light={"time": "afternoon"})
# 12 2008: a real-estate conference, Don Jr at the lectern (reported remark)
room("conf08", seed=7, room={"w": 15, "d": 11, "h": 3.6, "floor": "carpet", "windows": 0, "doors": [{"wall": "left", "at": 0.88}]},
     place=[{"what": "podium", "name": "podium", "at": "back", "riser": 0.3, "mics": 1, "wallGap": 1.2}, {"what": "screenWall", "at": "back", "nx": 2, "ny": 1},
            {"what": "chairsRows", "name": "seats", "rows": 4, "cols": 10, "aisle": 1.2, "at": "front-of:podium", "gap": 3.4}, {"what": "plant", "at": "corner", "n": 2}],
     groups=[{"form": "podium", "of": "podium", "n": 0, "name": "talk", "speakerChar": "donjr"}, {"form": "audience", "of": "seats", "n": 26, "name": "audience"}], focus="talk.speaker")
# 16-17 Crocus City Hall: the pageant, a singer on stage, the co-owner in the front row
room("crocus", seed=8, room={"w": 20, "d": 14, "h": 6, "floor": "wood", "windows": 0, "doors": [{"wall": "left", "at": 0.9, "w": 2.2}]},
     place=[{"what": "stage", "name": "stage", "at": "back", "w": 9, "d": 3.6, "wallGap": 0.6}, {"what": "screenWall", "at": "back", "nx": 3, "ny": 1},
            {"what": "chairsRows", "name": "seats", "rows": 4, "cols": 12, "aisle": 1.4, "at": "front-of:stage", "gap": 2.6}, {"what": "tvCamera", "n": 2, "at": "side:seats", "face": "stage"}],
     people=[{"id": "trump", "char": "trump", "pose": "sit_listen", "at": "seat:seats:5"}],
     groups=[{"form": "podium", "of": "stage", "n": 0, "name": "singer", "speakerChar": "emin"}, {"form": "audience", "of": "seats", "n": 34, "name": "audience"},
             {"form": "workers", "of": "tvCamera", "name": "camOps"}], focus="trump", light={"time": "evening"})
# 18 the 2013 post: at a desk, phone in hand
room("tweet13", seed=9, room={"w": 7.5, "d": 6, "h": 3, "floor": "carpet", "windows": 2, "curtains": True, "doors": [{"wall": "left", "at": 0.85}]},
     place=[{"what": "desk", "name": "desk", "at": "back", "variant": "lamp"}, {"what": "flag", "at": "back", "n": 1, "near": "desk"}, {"what": "sofa", "at": "left", "w": 1.9},
            {"what": "rug", "at": "center", "pad": 0.8}, {"what": "wallArt", "at": "back", "n": 2}, {"what": "plant", "at": "corner"}],
     people=[{"id": "trump", "char": "trump", "pose": "sit_type", "prop": "phone", "at": "seat:desk:0"}], focus="trump", light={"time": "evening"})
# 20 the tower talks over dinner with the Agalarovs
room("dinner13", seed=10, room={"w": 9, "d": 7, "h": 3.2, "floor": "wood", "windows": 3, "curtains": True, "doors": [{"wall": "left", "at": 0.85}]},
     place=[{"what": "roundTable", "name": "rt", "at": "center", "seats": 4, "off": [0.6, -0.4]}, {"what": "roundTable", "n": 2, "seats": 2, "at": "left"}, {"what": "credenza", "at": "back"},
            {"what": "wallArt", "at": "back", "n": 2}, {"what": "plant", "at": "corner", "n": 2}, {"what": "rug", "at": "under:rt", "pad": 0.8}],
     people=[{"id": "trump", "char": "trump", "pose": "sit_lean", "at": "seat:rt:0", "with": "talks"}, {"id": "agalarov", "char": "agalarov", "pose": "sit_listen", "at": "seat:rt:1", "with": "talks"},
             {"id": "emin", "char": "emin", "pose": "sit", "at": "seat:rt:2", "with": "talks"},
             {"id": "waiter", "pose": "stand", "prop": "cup", "at": [2.6, 1.8], "face": "rt", "o": {"coat": False, "tie": True}}], focus="talks", light={"time": "evening"})
# 23 June 2015: the campaign launch in a tower atrium
room("launch15", seed=11, room={"w": 16, "d": 12, "h": 6, "floor": "tile", "windows": 2, "doors": [{"wall": "left", "at": 0.86, "w": 2.2}]},
     place=[{"what": "podium", "name": "podium", "at": "back", "riser": 0.3, "mics": 2, "wallGap": 1.4}, {"what": "flag", "at": "back", "n": 4, "near": "podium"},
            {"what": "tvCamera", "n": 3, "at": "front-of:podium", "gap": 6.5, "face": "podium"}, {"what": "plant", "at": "corner", "n": 3}],
     groups=[{"form": "podium", "of": "podium", "n": 0, "name": "launch", "speakerChar": "trump"},
             {"form": "crowd", "n": 34, "area": "front-of:podium", "gap": 1.8, "poses": ["applaud", "stand", "phone", "applaud", "raise_hand"], "name": "supporters"}], focus="launch.speaker")
# 24 autumn 2015: the letter of intent signed at a table
room("loi15", seed=12, room={"w": 9.5, "d": 7, "h": 3.2, "floor": "wood", "windows": 3, "doors": [{"wall": "left", "at": 0.86}]},
     place=[{"what": "table", "name": "stable", "at": "center", "seats": 2, "sides": "one", "len": 2.6, "off": [0.4, -0.6]}, {"what": "flag", "at": "back", "n": 2, "near": "stable"},
            {"what": "credenza", "at": "back"}, {"what": "shelf", "at": "left", "n": 2}, {"what": "plant", "at": "corner", "n": 2}],
     people=[{"id": "trump", "char": "trump", "pose": "sit_type", "prop": "papers", "at": "seat:stable:0"}],
     groups=[{"form": "crowd", "n": 5, "area": [-3.4, 1.0, 3.4, 2.8], "toward": "stable", "poses": ["stand", "applaud", "phone", "stand_arms_crossed"], "name": "aides"}], focus="trump")
# 25 Cohen runs the project, Sater the go-between
room("cohen16", seed=13, room={"w": 7.5, "d": 6, "h": 3, "floor": "carpet", "windows": 2, "doors": [{"wall": "left", "at": 0.85}]},
     place=[{"what": "desk", "name": "desk", "at": "back", "variant": "papers"}, {"what": "filing", "at": "left", "n": 3}, {"what": "shelf", "at": "back", "n": 1}, {"what": "plant", "at": "corner"}],
     people=[{"id": "cohen", "char": "cohen", "pose": "sit_lean", "prop": "phone", "at": "seat:desk:0", "with": "deal"},
             {"id": "sater", "char": "sater", "pose": "speak", "at": "front-of:desk", "with": "deal"}], focus="deal")
# 27 the campaign trail: a rally
room("rally16", "rally", seed=6, groups=[{"form": "podium", "of": "stage", "n": 0, "name": "speaker", "speakerChar": "trump"},
     {"form": "crowd", "n": 150, "area": "front-of:stage", "gap": 2.6, "poses": ["stand", "applaud", "raise_hand", "stand", "phone", "applaud"], "signs": 0.14, "name": "crowd"}], focus="speaker", light={"time": "afternoon"})
# 29 Nov 2018: Cohen's guilty plea before a judge
room("plea18", "courtroom", seed=17, mirror=True, people=[{"id": "cohen", "char": "cohen", "pose": "stand", "at": "front-of:bench", "face": "bench"}], focus="cohen")
# 31 + 34 June 2016: the email lands, the reply goes back
room("jr_office", seed=14, room={"w": 7, "d": 5.5, "h": 3, "floor": "wood", "windows": 2, "doors": [{"wall": "left", "at": 0.85}]},
     place=[{"what": "desk", "name": "desk", "at": "back", "variant": "papers"}, {"what": "shelf", "at": "left", "n": 2, "fill": "mixed"}, {"what": "chair", "style": "arm", "at": "left"},
            {"what": "wallArt", "at": "back", "n": 1}, {"what": "plant", "at": "corner"}],
     people=[{"id": "donjr", "char": "donjr", "pose": "sit_type", "prop": "laptop", "at": "seat:desk:0"}], focus="donjr", light={"time": "morning"})
# 36-37 9 June 2016: the Trump Tower meeting
room("tt_meeting", seed=15, room={"w": 9, "d": 7, "h": 3, "floor": "carpet", "windows": 4, "doors": [{"wall": "left", "at": 0.85}]},
     place=[{"what": "table", "name": "table", "at": "center", "seats": 8}, {"what": "credenza", "at": "back"}, {"what": "plant", "at": "corner", "n": 2}, {"what": "wallArt", "at": "left", "n": 1}],
     people=[{"id": "donjr", "char": "donjr", "pose": "sit_lean", "at": "seat:table:0", "with": "campaign"},
             {"id": "kushner", "char": "kushner", "pose": "sit_type", "prop": "phone", "at": "seat:table:1", "with": "campaign"},
             {"id": "manafort", "char": "manafort", "pose": "sit_listen", "at": "seat:table:2", "with": "campaign"},
             {"id": "vesel", "char": "vesel", "pose": "sit_lean", "prop": "papers", "at": "seat:table:5"},
             {"id": "aide1", "pose": "sit_listen", "at": "seat:table:6", "o": {"coat": True, "hair": "short"}},
             {"id": "aide2", "pose": "sit", "at": "seat:table:4", "o": {"coat": False, "hair": "none"}}], focus="campaign", light={"time": "afternoon"})
# 39 the Senate committee: its finding on the lawyer
room("ssci", "hearing", seed=5, focus={"id": "senators", "index": 5})
# 41 investigators over the files
room("probe", "office", seed=8, groups=[{"form": "huddle", "n": 4, "name": "investigators"}, {"form": "table", "of": "desk", "n": 3, "name": "staff"}],
     addPlace=[{"what": "docPile", "at": "back"}, {"what": "whiteboard", "at": "left"}], focus={"id": "investigators", "index": 0})
# 42 the campaign office: Manafort runs the summer
room("hq16", "office", seed=19, people=[{"id": "manafort", "char": "manafort", "pose": "point", "at": [0.4, 2.4], "face": 300}],
     addPlace=[{"what": "flag", "at": "back", "n": 2}, {"what": "whiteboard", "at": "left"}], focus="manafort")
# 43 2 Aug 2016: the cigar club
room("cigar", seed=16, room={"w": 8, "d": 6.5, "h": 3, "floor": "wood", "windows": 2, "curtains": True, "doors": [{"wall": "left", "at": 0.85}]},
     place=[{"what": "sofa", "name": "sofa", "at": "left", "w": 2.0}, {"what": "coffeeTable", "name": "coffee", "at": "front-of:sofa", "gap": 0.45},
            {"what": "chair", "name": "arm1", "style": "arm", "at": "front-of:coffee", "gap": 0.5}, {"what": "shelf", "at": "back", "n": 3, "fill": "books"}, {"what": "credenza", "at": "back"},
            {"what": "rug", "at": "under:coffee", "pad": 1.0}, {"what": "plant", "at": "corner"}, {"what": "wallArt", "at": "left", "n": 1}],
     people=[{"id": "manafort", "char": "manafort", "pose": "sit_lean", "at": "seat:sofa:0", "with": "meet"},
             {"id": "kilimnik", "char": "kilimnik", "pose": "sit_listen", "at": "seat:arm1:0", "with": "meet"}], focus="meet", light={"time": "evening"})
# 45 the Special Counsel's office
room("sco", seed=18, room={"w": 8, "d": 6.5, "h": 3, "floor": "carpet", "windows": 3, "doors": [{"wall": "left", "at": 0.85}]},
     place=[{"what": "desk", "name": "desk", "at": "back", "variant": "papers"}, {"what": "flag", "at": "back", "n": 1, "near": "desk"}, {"what": "shelf", "at": "left", "n": 3, "fill": "boxes"},
            {"what": "docPile", "at": "left"}, {"what": "plant", "at": "corner"}],
     people=[{"id": "mueller", "char": "mueller", "pose": "sit_lean", "prop": "papers", "at": "seat:desk:0"}], focus="mueller")
# 46 the bipartisan Senate committee at its table
room("ssci_table", seed=20, room={"w": 9, "d": 7, "h": 2.9, "floor": "carpet", "windows": 0, "doors": [{"wall": "left", "at": 0.8}]},
     place=[{"what": "table", "name": "table", "at": "center", "seats": 10}, {"what": "screenWall", "at": "left", "nx": 2, "ny": 1}, {"what": "flag", "at": "back", "n": 2},
            {"what": "clock", "at": "back"}, {"what": "filing", "at": "back", "n": 2}],
     people=[{"id": "chair", "char": "senator", "pose": "speak", "at": "end:table:1"}],
     groups=[{"form": "table", "of": "table", "n": 8, "name": "members"}], focus="chair")
# 49 Manafort and his lawyers on the courthouse steps (conviction, later pardon)
room("steps_pm", "steps", seed=4, people=[],
     groups=[{"form": "procession", "n": 5, "at": "steps-foot", "name": "defence", "o": {"coat": True, "tie": True}},
             {"form": "crowd", "n": 26, "area": "plaza", "poses": ["stand", "phone", "stand_arms_crossed", "phone"], "name": "press"}], focus={"id": "defence", "index": 0}, light={"time": "overcast"})
# 52 2016: Christopher Steele writes the memos
room("steele", seed=21, room={"w": 6.5, "d": 5.5, "h": 2.8, "floor": "wood", "windows": 2, "curtains": True, "doors": [{"wall": "left", "at": 0.85}]},
     place=[{"what": "desk", "name": "desk", "at": "back", "variant": "lamp"}, {"what": "shelf", "at": "left", "n": 2, "fill": "books"}, {"what": "sofa", "at": "left", "w": 1.7},
            {"what": "rug", "at": "center", "pad": 0.6}, {"what": "plant", "at": "corner"}],
     people=[{"id": "steele", "char": "steele", "pose": "sit_type", "prop": "laptop", "at": "seat:desk:0"}], focus="steele", light={"time": "overcast"})
# 54 the newsroom that published the memos
room("buzz", "newsroom", seed=3, focus={"id": "editors", "index": 0})
# 58 the FBI interview room: the main source
room("interview", seed=22, room={"w": 6, "d": 5, "h": 2.8, "floor": "tile", "windows": 0, "doors": [{"wall": "left", "at": 0.8}]},
     place=[{"what": "table", "name": "table", "at": "center", "seats": 4}, {"what": "filing", "at": "back", "n": 1}, {"what": "clock", "at": "back"}, {"what": "waterCooler", "at": "left"}],
     people=[{"id": "source", "pose": "sit_lean", "at": "seat:table:0", "o": {"coat": False, "hair": "short", "build": 1.0}},
             {"id": "agent1", "pose": "sit_type", "prop": "papers", "at": "seat:table:2", "o": {"coat": True, "tie": True}},
             {"id": "agent2", "pose": "sit_listen", "at": "seat:table:3", "o": {"coat": True, "hair": "bun", "skirt": True}}], focus="source")
# 59 the Inspector General testifies
room("ig_hearing", "hearing", seed=11, mirror=True, people=[{"id": "horowitz", "char": "horowitz", "pose": "sit_lean", "at": "seat:witnessTable:1"}], focus="horowitz")
# 60 Durham's team in the document room
room("durham", seed=24, room={"w": 10, "d": 7, "h": 3, "floor": "carpet", "windows": 2, "doors": [{"wall": "left", "at": 0.85}]},
     place=[{"what": "table", "name": "table", "at": "center", "seats": 6}, {"what": "filing", "at": "left", "n": 4}, {"what": "shelf", "at": "back", "n": 3, "fill": "boxes"},
            {"what": "docPile", "at": "back"}, {"what": "boxes", "n": 3, "at": "left"}],
     people=[{"id": "durham", "char": "durham", "pose": "speak", "at": "end:table:1"}],
     groups=[{"form": "table", "of": "table", "n": 4, "name": "team", "poses": ["sit_type", "sit_lean", "sit_listen"]}], focus="durham")
# 63 the St Petersburg troll factory
room("trolls", "trollfarm", seed=4, focus={"id": "operators", "index": 6})
# 70 Senate Vol. 5: staff stack the 966 pages
room("vol5", seed=25, room={"w": 9, "d": 7, "h": 3, "floor": "carpet", "windows": 2, "doors": [{"wall": "left", "at": 0.85}]},
     place=[{"what": "table", "name": "table", "at": "center", "seats": 6}, {"what": "docPile", "name": "pile", "at": "back"}, {"what": "docPile", "at": "left"},
            {"what": "shelf", "at": "back", "n": 2, "fill": "boxes"}, {"what": "flag", "at": "back", "n": 2}],
     groups=[{"form": "crowd", "n": 5, "area": [-3.4, 0.8, 3.4, 2.8], "poses": ["carry", "look_down", "carry", "stand"], "prop": "papers", "name": "staff"},
             {"form": "table", "of": "table", "n": 3, "name": "readers", "poses": ["sit_lean", "sit_type"]}], focus={"id": "staff", "index": 0})
# 73 Helsinki: two hours, interpreters only
room("helsinki", seed=26, room={"w": 9, "d": 7, "h": 3.6, "floor": "wood", "windows": 3, "curtains": True, "doors": [{"wall": "left", "at": 0.85}]},
     place=[{"what": "roundTable", "name": "rt", "at": "center", "seats": 4, "off": [0.4, -0.3]}, {"what": "flag", "at": "back", "n": 2}, {"what": "rug", "at": "under:rt", "pad": 1.0},
            {"what": "credenza", "at": "back"}, {"what": "plant", "at": "corner", "n": 2}, {"what": "wallArt", "at": "left", "n": 1}],
     people=[{"id": "trump", "char": "trump", "pose": "sit_lean", "at": "seat:rt:0", "with": "summit"}, {"id": "putin", "char": "putin", "pose": "sit_listen", "at": "seat:rt:2", "with": "summit"},
             {"id": "int1", "pose": "sit_type", "prop": "papers", "at": "seat:rt:1", "o": {"coat": True, "hair": "bun", "skirt": True}},
             {"id": "int2", "pose": "sit_type", "prop": "papers", "at": "seat:rt:3", "o": {"coat": True, "hair": "short"}}], focus="summit", light={"time": "afternoon"})
# 74-75 the joint press conference: two lecterns
room("hel_press", seed=27, room={"w": 14, "d": 10, "h": 3.4, "floor": "carpet", "windows": 0, "doors": [{"wall": "left", "at": 0.88}]},
     place=[{"what": "podium", "name": "podA", "at": "back", "riser": 0.2, "mics": 2, "wallGap": 1.2, "off": [-1.6, 0]}, {"what": "podium", "name": "podB", "at": "back", "riser": 0.2, "mics": 2, "wallGap": 1.2, "off": [1.6, 0]},
            {"what": "flag", "at": "back", "n": 4}, {"what": "chairsRows", "name": "seats", "rows": 3, "cols": 10, "aisle": 1.2, "at": "front-of:podA", "gap": 3.8},
            {"what": "tvCamera", "n": 3, "at": "side:seats", "face": "podA"}],
     groups=[{"form": "podium", "of": "podA", "n": 0, "name": "us", "speakerChar": "trump"}, {"form": "podium", "of": "podB", "n": 0, "name": "ru", "speakerChar": "putin"},
             {"form": "audience", "of": "seats", "n": 22, "name": "reporters"}, {"form": "workers", "of": "tvCamera", "name": "camOps"}], focus="us.speaker")
# 76 Senator McCain to the press on the Capitol steps
room("mccain", "steps", seed=12, groups=[{"form": "podium", "at": "steps-foot", "n": 14, "name": "scrum", "speakerChar": "mccain"},
     {"form": "crowd", "n": 30, "area": "plaza", "poses": ["stand", "phone", "stand_arms_crossed"], "name": "onlookers"}], focus="scrum.speaker", light={"time": "afternoon"})
# 77 Russian officials expelled: they carry boxes out to the cars
room("expel", scale="street", seed=53, street={"w": 56, "d": 40, "kind": "plaza", "facades": ["back", "left"], "road": "front"},
     place=[{"what": "car", "n": 4, "at": "kerb"}, {"what": "newsVan", "n": 1, "at": "kerb"}, {"what": "tree", "n": 3, "at": "plaza"}],
     groups=[{"form": "procession", "n": 6, "at": [0, 3], "h": 90, "name": "diplomats", "poses": ["carry", "carry", "walk", "carry"], "prop": "box", "o": {"coat": True}},
             {"form": "crowd", "n": 14, "area": "plaza", "poses": ["stand", "phone", "stand_arms_crossed"], "name": "onlookers"}], focus={"id": "diplomats", "index": 0}, light={"time": "overcast"})
# 79 Alaska, Aug 2025: the handshake in a hangar
room("alaska", seed=28, room={"w": 18, "d": 12, "h": 6, "floor": "concrete", "windows": 3, "highWindows": True, "doors": [{"wall": "left", "at": 0.8, "w": 3.5, "h": 4}]},
     place=[{"what": "flag", "at": "back", "n": 4}, {"what": "tvCamera", "n": 3, "at": "left"}, {"what": "crates", "n": 3, "at": "back"}, {"what": "ropePosts", "at": [0.5, 3.2], "len": 6, "h": 0}],
     people=[{"id": "trump", "char": "trump", "pose": "handshake_L", "at": [-0.9, 0.6], "face": 0, "with": "summit"},
             {"id": "putin", "char": "putin", "pose": "handshake_R", "at": [-0.025, 0.6], "face": 180, "with": "summit"}],
     groups=[{"form": "crowd", "n": 9, "area": [-6, 3.8, 6, 5.4], "toward": [-0.4, 0.6], "poses": ["kneel", "stand", "phone", "stand"], "prop": "camera", "name": "press"},
             {"form": "huddle", "n": 3, "at": [-5, -2.5], "name": "aides"}], focus="summit", light={"time": "noon"})
# 81 2021: the ex-KGB major's claim, on a TV interview set
room("shvets", seed=29, room={"w": 10, "d": 8, "h": 3.4, "floor": "concrete", "windows": 0, "doors": [{"wall": "left", "at": 0.85}]},
     place=[{"what": "screenWall", "at": "back", "nx": 3, "ny": 2}, {"what": "table", "name": "set", "at": "center", "seats": 2, "sides": "one", "len": 2.2, "off": [0.0, -1.0]},
            {"what": "tvCamera", "n": 3, "at": "front-of:set", "gap": 2.4, "face": "set"}, {"what": "plant", "at": "corner", "n": 2}, {"what": "filing", "at": "left", "n": 2}],
     people=[{"id": "shvets", "pose": "sit_lean", "at": "seat:set:0", "o": {"coat": True, "tie": False, "hair": "none", "build": 1.1}},
             {"id": "host", "pose": "sit_listen", "prop": "papers", "at": "seat:set:1", "o": {"coat": True, "hair": "long", "skirt": True}}],
     groups=[{"form": "workers", "of": "tvCamera", "name": "crew"}], focus="shvets")
# 82 2025: a Facebook post typed at home
room("krasnov", seed=30, room={"w": 6.5, "d": 5.5, "h": 2.7, "floor": "wood", "windows": 2, "curtains": True, "doors": [{"wall": "left", "at": 0.85}]},
     place=[{"what": "desk", "name": "desk", "at": "back", "variant": "lamp"}, {"what": "sofa", "at": "left", "w": 1.8}, {"what": "coffeeTable", "at": "center", "off": [0.4, 0.6]},
            {"what": "shelf", "at": "left", "n": 1, "fill": "books"}, {"what": "rug", "at": "center", "pad": 0.5}, {"what": "plant", "at": "corner"}],
     people=[{"id": "poster", "pose": "sit_type", "prop": "laptop", "at": "seat:desk:0", "o": {"coat": False, "hair": "none", "build": 1.15}}], focus="poster", light={"time": "evening"})

# ================= places: geography and scale only (v2 exterior specs, landmark generators varied; no govHall) =================
ext("dc_dawn", "dc_dawn3", ("parliament", {"variant": "glassdome"}))                 # 1 Washington
ext("kremlin_river", "kremlin3", ("kremlin", {}))                                       # 2 Moscow
ext("red_square_1987", "redsq87", ("onionChurch", {}))                                  # 9 hotel site near Red Square
ext("palm_beach")                                                                       # 13 Florida mansion
ext("moscow_city")                                                                      # 15 Moscow keeps coming back (subject set)
ext("kremlin_evening", "kremlin_eve3", ("kremlin", {}))                                 # 19 Kremlin: no meeting
ext("fifth_avenue")                                                                     # 22 Trump Tower
ext("moscow_govt_quarter", "kremlin_office", ("kremlin", {}))                           # 26 Peskov's office (Kremlin)
ext("trump_tower_dusk")                                                                 # 35 June ninth, Trump Tower
ext("treasury", "treasury3", ("bankHQ", {}))                                            # 48 US Treasury
ext("london_thames", "london3", ("parliament", {"variant": "gothic"}))                  # 51 London
ext("prague_river", "prague3", ("tvTower", {}))                                         # 55 Prague
ext("moscow_hotel_night", "moscow_hotel3", ("hotelTower", {}))                          # 56 the tape claim
ext("capitol_overhead", "capitol3", ("parliament", {"variant": "glassdome"}))           # 62 interference finding
ext("moscow_river_bend", "moscow_bend3", ("onionChurch", {}))                           # 65 Russia expected to benefit
ext("court_square", "court3", ("courthouse", {}))                                       # 68 not enough evidence to charge
ext("fbi_hq", "fbi3", ("ministry", {"variant": "slab"}))                                # 84 FBI inquiry
ext("dc_dusk")                                                                          # 85 (subject set)
ext("potomac_bridge")                                                                   # 88 (subject set)
ext("kremlin_winter")                                                                   # 89 (subject set)
ext("dc_mall")                                                                          # 91 end card (subject set)
MAP = copy.deepcopy(V2["map"])

# ================= MG beats: numbers and mechanisms only (sourced data from the v2 plan; people get person icons) =================
MG_IDS = ["stamps", "pages", "stampA", "agalarov", "gantt", "claimvsrecord", "email", "charge", "stampD", "polls", "grave", "chainE", "money", "errors",
          "venn", "indicted", "finding", "charged", "obstruction", "readings", "javelin", "scale", "stampU", "proven", "unproven"]
mg = [copy.deepcopy(MGV2[b]) for b in MG_IDS]
MB = {b["id"]: b for b in mg}
def who_person(o, keys):
  for a in o:
    if a.get("n") in keys or a.get("label") in keys: a["who"] = "person"
who_person(MB["agalarov"]["parts"][0]["data"]["actors"], {"Trump", "Aras Agalarov", "Emin Agalarov", "Rob Goldstone"})
who_person(MB["polls"]["parts"][0]["data"]["stations"], {"Paul Manafort", "Konstantin Kilimnik"})
who_person(MB["chainE"]["parts"][0]["data"]["steps"], {"Paul Manafort", "Konstantin Kilimnik"})
who_person(MB["money"]["parts"][0]["data"]["chain"], {"Christopher Steele"})

# ================= a visual for every voiced line =================
def W(set, kind, path=None, callout=None, subject="focus", **kw):
  v = {"set": set, "subject": subject, "kind": kind}
  if path: v["path"] = path
  if callout: v["callout"] = callout
  v.update(kw); return v
def D(beat, f=0): return {"mg": beat, "focus": f, "kind": "data"}
def M(subject): return {"map": True, "subject": subject, "kind": "place"}
P2 = ["highOblique", "threeQuarter"]; P2b = ["wide", "threeQuarter"]; P2c = ["orbitBack", "lateralLow"]; P2d = ["lateralLow", "threeQuarter"]
LV = {
  1: W("dc_dawn3", "place", P2b, "Washington"),
  2: W("kremlin3", "place", P2c, "Moscow"),
  3: W("camps", "street", "push"),
  4: W("trial", "room", "descend", "Evidence: the public record"),
  5: D("stamps"), 6: D("pages"),
  7: M("route:trip1987"),
  8: W("arrive87", "person", "reveal", "1987: invited by Intourist"),
  9: W("redsq87", "place", None, "Hotel site, 1987: never built"),
  10: W("press96", "person", "push", "1996 plan: ≈$250M, never built"),
  11: W("bayrock", "person", "reveal", "Felix Sater, partner firm"),
  12: W("conf08", "person", "reveal", "2008 conference (reported)"),
  13: W("palm_beach", "place", P2, "$41M (2004) → $95M (2008)"),
  14: D("stampA"),
  15: W("moscow_city", "place", P2d, None, subject="set"),
  16: W("crocus", "person", "push", "Miss Universe, Moscow, Nov 2013"),
  17: W("crocus", "person", "reveal", "Crocus City Hall (Agalarov)", subject="singer.speaker"),
  18: W("tweet13", "person", "push", "June 2013 post: 'new best friend?'"),
  19: W("kremlin_eve3", "place", None, "Kremlin: they never met"),
  20: W("dinner13", "person", "reveal", "Talks: a Moscow tower"),
  21: D("agalarov"),
  22: W("fifth_avenue", "place", None, "Trump Tower, New York"),
  23: W("launch15", "person", None, "June 2015: campaign launch"),
  24: W("loi15", "person", "push", "Letter of intent, Oct 2015"),
  25: W("cohen16", "person", None, "Michael Cohen, Felix Sater"),
  26: W("kremlin_office", "place", P2, "Peskov's office, Jan 2016"),
  27: W("rally16", "person", None, "Publicly: no Russia deals"),
  28: D("gantt"),
  29: W("plea18", "person", "push", "Cohen pleads guilty, Nov 2018"),
  30: D("claimvsrecord"),
  31: W("jr_office", "person", "push", "3 June 2016: an email"),
  32: D("email"), 33: D("email", 1),
  34: W("jr_office", "person", None, "Reply: 'I love it'"),
  35: W("trump_tower_dusk", "place", None, "9 June 2016"),
  36: W("tt_meeting", "person", "reveal", "Jr., Kushner, Manafort + a Russian lawyer"),
  37: W("tt_meeting", "person", None, "Sanctions law, adoptions", subject="vesel"),
  38: D("charge"),
  39: W("ssci", "room", None, "Senate: 'significant ties'"),
  40: D("stampD"),
  41: W("probe", "room", None),
  42: W("hq16", "person", "push", "Campaign chairman, 2016"),
  43: W("cigar", "person", "reveal", "2 Aug 2016, Manhattan"),
  44: D("polls"),
  45: W("sco", "person", None, "'Could not reliably determine' why"),
  46: W("ssci_table", "person", "push", "Senate Intelligence, Vol. 5"),
  47: D("grave"),
  48: W("treasury3", "place", P2b, "US Treasury, April 2021"),
  49: W("steps_pm", "person", "push", "Convicted 2018, pardoned 2020"),
  50: D("chainE"),
  51: W("london3", "place", None, "London"),
  52: W("steele", "person", "reveal", "Christopher Steele, ex-MI6"),
  53: D("money"),
  54: W("buzz", "room", "reveal", "Published Jan 2017"),
  55: W("prague3", "place", P2c, "Cohen never went (Mueller)"),
  56: W("moscow_hotel3", "place", None),
  57: D("errors"),
  58: W("interview", "person", None, "'Word of mouth and hearsay'"),
  59: W("ig_hearing", "person", "push", "IG: no political bias found"),
  60: W("durham", "person", "reveal", "Durham report, May 2023"),
  61: D("venn"),
  62: W("capitol3", "place", P2, "'Sweeping and systematic' (Mueller)"),
  63: W("trolls", "room", "reveal", "Troll factory, St Petersburg"),
  64: D("indicted"),
  65: W("moscow_bend3", "place", P2b, "Expected to benefit (Mueller)"),
  66: D("finding"), 67: D("charged"),
  68: W("court3", "place", P2d),
  69: D("obstruction"),
  70: W("vol5", "room", "push", "966 pages, Aug 2020"),
  71: D("readings"),
  72: M("pin:helsinki"),
  73: W("helsinki", "person", None, "≈2 hours, interpreters only"),
  74: W("hel_press", "person", "push", "'I don't see any reason why it would be'"),
  75: W("hel_press", "person", None, "Next day: 'wouldn't'"),
  76: W("mccain", "person", "push", "Sen. McCain: 'disgraceful'"),
  77: W("expel", "person", "reveal", "60 officials expelled, Mar 2018"),
  78: D("javelin"),
  79: W("alaska", "person", "reveal", "Alaska summit, Aug 2025"),
  80: D("scale"),
  81: W("shvets", "person", "push", "Claim, 2021: no documents"),
  82: W("krasnov", "person", "reveal", "Facebook claim, 2025"),
  83: D("stampU"),
  84: W("fbi3", "place", P2, "FBI inquiry, 2017"),
  85: W("dc_dusk", "place", None, None, subject="set"),
  86: D("proven"), 87: D("unproven"),
  88: W("potomac_bridge", "place", P2b, None, subject="set"),
  89: W("kremlin_winter", "place", P2c, None, subject="set"),
  90: W("trial", "room", None),
  91: W("dc_mall", "place", None, None, subject="set", endcard=True),
}
for v in LV.values():
  if "path" in v and v["path"] is None: del v["path"]
assert sorted(LV) == [l["n"] for l in LINES], sorted(set(l["n"] for l in LINES) ^ set(LV))

plan = {"film": "trump", "seed": 23, "v3": True, "endcard": V2.get("endcard", {"name": "Blind Luck Time"}), "cast": CAST, "sets": S, "mg": mg, "map": MAP,
        "lines": {str(k): v for k, v in LV.items()}}
txt = json.dumps(plan, indent=1, ensure_ascii=False)
(F / "plan_v3.json").write_text(txt, encoding="utf8")
# film id trump_v3 reuses this film's voice: plan.json = plan_v3, lines.json / voice.wav / script.md copied (render.mjs lines rewrites shows there, not here)
D3 = F.parent / "trump_v3"; D3.mkdir(exist_ok=True)
(D3 / "plan.json").write_text(txt, encoding="utf8")
for f in ("lines.json", "voice.wav", "script.md", "words.json"):
  if not (D3 / f).exists(): shutil.copy(F / f, D3 / f)
snd = json.loads((F / "sound.json").read_text(encoding="utf8")); snd["video"] = "out/trump_v3.mp4"
(D3 / "sound.json").write_text(json.dumps(snd, indent=1), encoding="utf8")

# ---------------- report: tags + rough shares (the page gates are the truth; this is a planning estimate) ----------------
used = {v["set"] for v in LV.values() if "set" in v}
tags = {}
for v in LV.values(): tags[v["kind"]] = tags.get(v["kind"], 0) + 1
T = LINES[-1]["end"] + 3.6
nxt = {l["n"]: (LINES[i + 1]["start"] if i + 1 < len(LINES) else T) for i, l in enumerate(LINES)}
mgT = sum(nxt[l["n"]] - l["start"] for l in LINES if "mg" in LV[l["n"]])
wl = [l for l in LINES if "mg" not in LV[l["n"]]]; wt = sum(l["end"] - l["start"] for l in wl)
isroom = lambda v: "set" in v and any(s["id"] == v["set"] and (s.get("scale") in ("room", "street") or s.get("type")) for s in S)
rt = sum(l["end"] - l["start"] for l in wl if isroom(LV[l["n"]]))
print("sets", len(S), "unused", sorted({s["id"] for s in S} - used), "| mg beats", len(mg), "| tags", tags)
print(f"est. MG share {mgT / T:.3f} (gate <= 0.35) | room/street share of world {rt / wt:.3f} (gate >= 0.5)")
