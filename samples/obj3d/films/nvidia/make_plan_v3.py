# Producer step v3 for the Nvidia film: rooms + streets with posed, faceless figures ("dollhouse documentary"), same voice.
# Writes films/nvidia/plan_v3.json (plan.json, the approved v2 plan, is left untouched) and mirrors it into films/nvidia_v3/
# (plan.json + a copy of lines.json) so film.html?film=nvidia_v3 / render.mjs can run it without any engine change.
# Every line is tagged kind = person | room | street | place | data. Allegations stay "reported" / "alleged" exactly as in script.md.
# Exterior place specs and MG beat data are reused from the v2 plan (same sourced numbers). Run: python make_plan_v3.py
import json, pathlib, shutil, copy
F = pathlib.Path(__file__).parent
V2 = json.loads((F / "plan.json").read_text(encoding="utf8"))
EXT = {s["id"]: s for s in V2["sets"]}
MGV2 = {b["id"]: b for b in V2["mg"]}

# ---------------- cast: fixed silhouettes, no faces, no likeness ----------------
CAST = {
  "jensen":     {"build": 1.05, "hair": "short", "coat": True, "tie": False},                 # dark jacket, no tie
  "alice":      {"build": 0.9, "hair": "long", "coat": True, "skirt": False},
  "kress":      {"build": 0.95, "hair": "bun", "coat": True, "skirt": True},
  "jones":      {"build": 1.2, "hair": "none", "coat": True, "tie": True},
  "president":  {"build": 1.35, "hair": "short", "coat": True, "tie": True},
  "official":   {"build": 1.1, "hair": "none", "coat": True, "tie": True},
  "prosecutor": {"build": 1.0, "hair": "short", "coat": True, "tie": True},
  "spokesman":  {"build": 1.0, "hair": "short", "coat": True, "tie": True, "prop": "papers"},
  "senator":    {"build": 1.25, "hair": "none", "coat": True, "tie": True},
  "lawyer":     {"build": 1.0, "hair": "short", "coat": True, "tie": True, "prop": "briefcase"},
  "reporter":   {"build": 0.95, "hair": "bun", "coat": False, "skirt": False},
  "envoy":      {"build": 1.0, "hair": "short", "coat": True, "tie": True},                  # foreign-ministry spokesperson
}

S = []
def room(id, type=None, seed=1, scale=None, **kw):
  s = {"id": id, "seed": seed, **({"type": type} if type else {}), **({"scale": scale} if scale else {}), **kw}
  if scale is None and type is None: s["scale"] = "room"
  S.append(s); return id
def ext(id, newid=None, **kw):
  s = copy.deepcopy(EXT[id]); s["id"] = newid or id; s.update(kw); S.append(s); return s["id"]
def swap_focus(s_id, what, **extra):
  s = next(x for x in S if x["id"] == s_id)
  for e in s["place"]:
    if e.get("focus"): e["what"] = what; e.update(extra)
  return s_id

# ================= rooms / streets (all generated at runtime from these specs) =================
# 2 walk-out: Jensen carries a box across the HQ forecourt, staff watch
room("walkout", scale="street", seed=31, street={"w": 56, "d": 40, "kind": "plaza", "facades": ["back", "left"], "road": "front"},
     place=[{"what": "car", "n": 3, "at": "kerb"}, {"what": "bench", "n": 2, "at": "plaza"}, {"what": "tree", "n": 3, "at": "plaza"}],
     groups=[{"form": "crowd", "n": 16, "area": "plaza", "poses": ["stand", "phone", "stand_arms_crossed", "look_down"], "name": "staff"}],
     people=[{"id": "jensen", "char": "jensen", "pose": "carry", "prop": "box", "at": [1.5, 4.0], "face": 160}],
     focus="jensen", light={"time": "evening"})
# 3 boardroom: he stands at the head of the table, the board seated
room("board_quit", "boardroom", seed=11, people=[{"id": "jensen", "char": "jensen", "pose": "speak", "at": "end:table:1"}], focus="jensen")
# 4 trading floor: phones up as the stock drops
room("trade_drop", "trading", seed=3, focus={"id": "floor", "index": 1})
# 6 newsroom: editors try to sort out five days
room("news_sort", "newsroom", seed=2, focus="editors")
# 7 the diner booth, 1993: three engineers
room("diner93", "diner", seed=9, people=[
    {"id": "f1", "char": "jensen", "pose": "sit_lean", "at": "seat:booths:4", "with": "founders"},
    {"id": "f2", "pose": "sit_listen", "at": "seat:booths:5", "with": "founders", "o": {"coat": False, "hair": "short"}},
    {"id": "f3", "pose": "sit", "at": "seat:booths:6", "with": "founders", "o": {"coat": True, "build": 1.2, "hair": "none"}},
    {"id": "waitress", "pose": "stand", "at": [1.4, 1.6], "face": "booths", "o": {"hair": "bun", "skirt": True, "coat": False, "prop": "cup"}}],
  addGroups=[{"form": "table", "of": "counter", "n": 2, "name": "regulars"}], focus="founders", light={"time": "afternoon"})
# 11 lab: scientists at the benches (CUDA)
room("cuda_lab", "lab", seed=4, groups=[{"form": "workers", "of": "labBench", "name": "scientists"}], focus="scientists")
# 13 research office: researchers at screens
room("research", "office", seed=6, groups=[{"form": "table", "of": "desk", "n": 5, "name": "researchers", "poses": ["sit_type", "sit_lean", "sit_type", "sit_listen"]},
                                          {"form": "huddle", "n": 3, "name": "talk"}], focus="researchers")
# 14 warehouse / assembly floor: chips by the warehouse
room("rush", "factory", seed=2, focus="workers")
# 16 data hall: racks and technicians (data centre division)
DATAHALL = {"w": 15, "d": 10, "h": 3.4, "floor": "tile", "windows": 0, "doors": [{"wall": "left", "at": 0.85}]}
def datahall(id, seed, people, groups, focus, cols=4):
  return room(id, seed=seed, room=DATAHALL, place=[{"what": "serverRack", "name": "racks", "n": 2 * cols, "at": "grid", "cols": cols, "rowsN": 2, "gapX": 1.4, "gapZ": 2.2, "h": 0, "off": [0, -0.8]},
               {"what": "filing", "at": "left", "n": 2}, {"what": "crates", "n": 2, "at": "back"}, {"what": "plant", "at": "corner"}], groups=groups, people=people, focus=focus)
datahall("hall_rev", 5, [], [{"form": "crowd", "n": 5, "area": "aisles", "poses": ["look_down", "carry", "phone", "stand", "look_down"], "name": "techs"}], "techs")
# 21 the export ban is signed: an official at a desk, aides
room("ban_sign", seed=7, room={"w": 8, "d": 6.5, "h": 3.1, "floor": "carpet", "windows": 2, "curtains": True, "doors": [{"wall": "left", "at": 0.85}]},
     place=[{"what": "desk", "name": "desk", "at": "back", "variant": "papers"}, {"what": "flag", "at": "back", "n": 2, "near": "desk"}, {"what": "shelf", "at": "left", "n": 2},
            {"what": "wallArt", "kind": "seal", "at": "back", "w": 1.0, "h": 1.0, "y": 2.2}, {"what": "rug", "at": "under:desk", "pad": 1.2}, {"what": "plant", "at": "corner", "n": 2}],
     people=[{"id": "official", "char": "official", "pose": "sit_type", "prop": "papers", "at": "seat:desk:0"}],
     groups=[{"form": "huddle", "n": 3, "at": [1.2, 1.4], "name": "aides"}], focus="official")
# 25 a deal: handshake in a government meeting room (reported 15% arrangement)
room("deal", seed=12, room={"w": 9, "d": 7, "h": 3.1, "floor": "carpet", "windows": 3, "doors": [{"wall": "left", "at": 0.85}]},
     place=[{"what": "roundTable", "name": "rt", "at": "center", "seats": 4, "off": [1.2, -1.0]}, {"what": "flag", "at": "back", "n": 2}, {"what": "credenza", "at": "back"},
            {"what": "plant", "at": "corner", "n": 2}, {"what": "wallArt", "at": "left", "n": 1}],
     people=[{"id": "jensen", "char": "jensen", "pose": "handshake_L", "at": [-1.8, 1.6], "face": 0, "with": "deal"},
             {"id": "officialB", "char": "official", "pose": "handshake_R", "at": [-0.925, 1.6], "face": 180, "with": "deal"}],
     groups=[{"form": "crowd", "n": 4, "area": [-3.6, -2.2, -0.2, 0.2], "poses": ["applaud", "stand", "phone", "applaud"], "name": "aides"}], focus="deal")
# 27 street market: middlemen and boxes of parts
room("middlemen", "market", seed=3, focus={"id": "shoppers", "index": 2})
# 28 Singapore courtroom: three men charged (no jury in Singapore)
room("sg_court", "courtroom", seed=5,
     place=[{"what": "judgeBench", "name": "bench", "at": "back", "focusable": True}, {"what": "flag", "at": "back", "n": 2, "near": "bench"},
            {"what": "wallArt", "kind": "seal", "at": "back", "near": "bench", "w": 1.1, "h": 1.1, "y": 2.5}, {"what": "clock", "at": "left"},
            {"what": "witnessBox", "name": "witnessStand", "at": "front-of:bench", "lat": 2.7, "gap": 0.2, "face": "center"},
            {"what": "witnessTable", "name": "counselA", "seats": 2, "at": "front-of:bench", "lat": 1.2, "gap": 2.4, "face": "bench"},
            {"what": "witnessTable", "name": "dock", "seats": 3, "at": "front-of:bench", "lat": -2.6, "gap": 2.4, "face": "bench"},
            {"what": "pews", "name": "gallery", "rows": 3, "len": 9, "aisle": 1.2, "bar": True, "at": "front", "wallGap": 0.25, "near": [1.0, 0]},
            {"what": "filing", "at": "left", "n": 2, "drawers": 2}],
     groups=[{"form": "table", "of": "bench", "n": 1, "name": "judge"}, {"form": "table", "of": "counselA", "name": "prosecution"},
             {"form": "table", "of": "dock", "n": 3, "name": "accused", "poses": ["sit_listen", "sit", "sit_listen"]},
             {"form": "audience", "of": "gallery", "n": 14, "name": "public"}], focus="accused")
# 29 US prosecutors announce charges
room("doj_presser", "pressroom", seed=7, groups=[{"form": "podium", "of": "podium", "n": 10, "name": "scrum", "speakerChar": "prosecutor"},
     {"form": "audience", "of": "seats", "n": 16, "name": "reporters"}, {"form": "workers", "of": "tvCamera", "name": "camOps"}], focus="scrum.speaker")
# 30 the export paperwork office: clerks and piles of forms
room("paperwork", "trollfarm", seed=8, groups=[{"form": "table", "of": "rows", "n": 20, "name": "clerks", "poses": ["sit_type", "sit_lean", "sit_listen", "sit_type"]}],
     addPlace=[{"what": "docPile", "at": "back"}, {"what": "filing", "at": "left", "n": 3}], focus={"id": "clerks", "index": 5})
# 31 Alice Huang crossing a Singapore plaza
room("sg_plaza", scale="street", seed=41, street={"w": 58, "d": 40, "kind": "plaza", "facades": ["back", "left"], "road": "front"},
     place=[{"what": "busStop", "at": "kerb"}, {"what": "tree", "n": 4, "at": "plaza"}, {"what": "bench", "n": 2, "at": "plaza"}],
     groups=[{"form": "crowd", "n": 26, "area": "plaza", "poses": ["walk", "walk", "phone", "stand", "carry"], "mode": "plaza", "name": "commuters"}],
     people=[{"id": "alice", "char": "alice", "pose": "walk", "prop": "phone", "at": [-2.0, 3.0], "face": 20}], focus="alice", light={"time": "morning"})
# 32 Megaspeed's data hall, Alice with the technicians
datahall("hall_alice", 9, [{"id": "alice", "char": "alice", "pose": "point", "at": [0.5, 3.6], "face": 270}],
         [{"form": "crowd", "n": 3, "area": "aisles", "poses": ["look_down", "stand", "phone"], "name": "techs"}], "alice", cols=3)
# 34 partner agreement signed at a long table
room("partner_sign", seed=14, room={"w": 10, "d": 7, "h": 3.2, "floor": "wood", "windows": 3, "doors": [{"wall": "left", "at": 0.86}]},
     place=[{"what": "table", "name": "stable", "at": "center", "seats": 2, "sides": "one", "len": 2.6, "off": [0.4, -0.6]}, {"what": "flag", "at": "back", "n": 2, "near": "stable"},
            {"what": "screenWall", "at": "back", "nx": 2, "ny": 1}, {"what": "plant", "at": "corner", "n": 2}],
     people=[{"id": "s1", "pose": "sit_type", "prop": "papers", "at": "seat:stable:0", "with": "signers", "o": {"coat": True, "tie": True}},
             {"id": "s2", "pose": "sit_type", "prop": "papers", "at": "seat:stable:1", "with": "signers", "o": {"coat": True, "hair": "long"}}],
     groups=[{"form": "crowd", "n": 7, "area": [-3.5, 1.0, 3.5, 3.0], "toward": "stable", "poses": ["applaud", "phone", "stand", "applaud"], "name": "guests"}], focus="signers")
# 37 Commerce investigators over the files (reported probe)
room("probe", "office", seed=8, groups=[{"form": "huddle", "n": 4, "name": "investigators"}, {"form": "table", "of": "desk", "n": 3, "name": "staff"}],
     addPlace=[{"what": "docPile", "at": "back"}, {"what": "whiteboard", "at": "left"}], focus="investigators")
# 38 inspectors walk the racks (Megaspeed says: no violations)
datahall("hall_inspect", 13, [], [{"form": "huddle", "n": 3, "at": [1.0, 3.6], "name": "inspectors"},
         {"form": "crowd", "n": 2, "area": "aisles", "poses": ["look_down", "stand"], "name": "techs"}], "inspectors", cols=5)
# 39 airport gate: she leaves Singapore
room("gate", "airport", seed=2, people=[{"id": "alice", "char": "alice", "pose": "walk", "prop": "briefcase", "at": [-5.6, -1.6], "face": 200}], focus="alice")
# 40 Singapore officials speak on the ministry steps
room("sg_steps", "steps", seed=9, groups=[{"form": "podium", "at": "steps-foot", "n": 14, "name": "scrum", "speakerChar": "official"},
     {"form": "crowd", "n": 30, "area": "plaza", "poses": ["stand", "phone", "stand_arms_crossed"], "name": "onlookers"}], focus="scrum.speaker", light={"time": "afternoon"})
# 41 the pair at an evening event (Reuters-verified photos)
room("pair_event", scale="street", seed=43, street={"w": 52, "d": 38, "kind": "plaza", "facades": ["back", "left"], "road": "front"},
     place=[{"what": "tree", "n": 4, "at": "plaza"}, {"what": "tvCamera", "n": 2, "at": "plaza"}],
     groups=[{"form": "crowd", "n": 34, "area": "plaza", "poses": ["stand", "phone", "stand", "applaud"], "name": "guests"}],
     people=[{"id": "jensen", "char": "jensen", "pose": "speak", "at": [0.0, 4.0], "face": 0, "with": "pair"},
             {"id": "alice", "char": "alice", "pose": "stand", "at": [1.1, 4.0], "face": 180, "with": "pair"}], focus="pair", light={"time": "evening"})
# 42 an expo floor: chip boss, customer executive
room("expo", seed=15, room={"w": 18, "d": 12, "h": 5, "floor": "concrete", "windows": 0, "doors": [{"wall": "left", "at": 0.85, "w": 2.4}]},
     place=[{"what": "stall", "name": "booths", "n": 6, "at": "grid", "cols": 3, "rowsN": 2, "gapX": 2.6, "gapZ": 2.4, "h": 0, "off": [0.4, -1.2]}, {"what": "screenWall", "at": "back", "nx": 4, "ny": 1}],
     groups=[{"form": "crowd", "n": 18, "area": [-8, -1, 8, 4.5], "poses": ["stand", "walk", "phone", "stand_arms_crossed"], "name": "visitors"}],
     people=[{"id": "jensen", "char": "jensen", "pose": "speak", "at": [-0.6, 4.6], "face": 0, "with": "pair"},
             {"id": "alice", "char": "alice", "pose": "stand", "at": [0.6, 4.6], "face": 180, "with": "pair"}], focus="pair")
# 43 New York Times newsroom: the first report
room("news_nyt", "newsroom", seed=12, mirror=True, focus={"id": "staff", "index": 4})
# 44 Nvidia's spokesman to the press outside HQ
room("hq_scrum", scale="street", seed=45, street={"w": 56, "d": 40, "kind": "plaza", "facades": ["back", "left"], "road": "front"},
     place=[{"what": "newsVan", "n": 3, "at": "kerb"}, {"what": "tree", "n": 2, "at": "plaza"}],
     groups=[{"form": "podium", "at": [0, 1.0], "h": 90, "n": 14, "name": "scrum", "speakerChar": "spokesman"},
             {"form": "crowd", "n": 12, "area": "plaza", "poses": ["stand", "phone", "walk"], "name": "passers"}], focus="scrum.speaker", light={"time": "morning"})
# 47 Sunday: he writes to his staff, alone at a desk
room("study", seed=16, room={"w": 6.5, "d": 5.5, "h": 2.8, "floor": "wood", "windows": 2, "curtains": True, "doors": [{"wall": "left", "at": 0.85}]},
     place=[{"what": "desk", "name": "desk", "at": "back", "variant": "lamp"}, {"what": "shelf", "at": "left", "n": 2}, {"what": "sofa", "at": "left", "w": 1.8},
            {"what": "rug", "at": "center", "pad": 0.6}, {"what": "plant", "at": "corner"}, {"what": "wallArt", "at": "back", "n": 1}],
     people=[{"id": "jensen", "char": "jensen", "pose": "sit_type", "prop": "laptop", "at": "seat:desk:0"}], focus="jensen", light={"time": "evening"})
# 48 the board opens an independent investigation
room("board_probe", "boardroom", seed=21, people=[{"id": "jones", "char": "jones", "pose": "point", "at": "end:table:1"}], focus="jones")
# 49-50 the President takes questions
room("wh_press", "pressroom", seed=13, groups=[{"form": "podium", "of": "podium", "n": 14, "name": "scrum", "speakerChar": "president"},
     {"form": "audience", "of": "seats", "n": 20, "name": "reporters"}, {"form": "workers", "of": "tvCamera", "name": "camOps"}], focus="scrum.speaker")
# 51 shareholders' lawyers carry the class action up the courthouse steps
room("suit_steps", "steps", seed=4, groups=[{"form": "procession", "n": 6, "at": "steps-foot", "name": "lawyers", "o": {"coat": True, "tie": True}},
     {"form": "crowd", "n": 26, "area": "plaza", "poses": ["stand", "phone", "stand_arms_crossed"], "name": "onlookers"}], focus="lawyers", light={"time": "noon"})
# 54 the independent directors hire a law firm
room("lawfirm", seed=17, room={"w": 8.5, "d": 6.5, "h": 3, "floor": "wood", "windows": 3, "doors": [{"wall": "left", "at": 0.85}]},
     place=[{"what": "table", "name": "table", "at": "center", "seats": 8}, {"what": "shelf", "at": "back", "n": 2, "fill": "books"}, {"what": "credenza", "at": "left"},
            {"what": "plant", "at": "corner", "n": 2}],
     people=[{"id": "lead", "char": "lawyer", "pose": "speak", "at": "end:table:1"}],
     groups=[{"form": "table", "of": "table", "n": 6, "name": "directors"}], focus="lead")
# 55 reporters work the phones (second NYT report, unconfirmed)
room("phones", "office", seed=14, groups=[{"form": "table", "of": "desk", "n": 6, "name": "reporters", "poses": ["sit_type", "sit_lean", "sit_type"]},
                                         {"form": "crowd", "n": 3, "area": "aisles", "poses": ["phone", "phone", "stand"], "name": "callers"}], focus={"id": "callers", "index": 0})
# 56 the board accepts the resignation (a show of hands)
room("board_vote", "boardroom", seed=33, groups=[{"form": "table", "of": "table", "n": 9, "name": "board", "poses": ["raise_hand", "sit_listen", "raise_hand", "raise_hand", "sit"]}], focus="board")
# 57 Thursday: TV crews outside headquarters
room("hq_vans", scale="street", seed=47, street={"w": 60, "d": 42, "kind": "plaza", "facades": ["back", "left"], "road": "front"},
     place=[{"what": "newsVan", "n": 4, "at": "kerb"}, {"what": "tvCamera", "n": 4, "at": "plaza"}, {"what": "barrier", "n": 2, "len": 9, "at": "plaza"}],
     groups=[{"form": "crowd", "n": 22, "area": "plaza", "poses": ["phone", "stand", "stand_arms_crossed", "point"], "name": "press"}], focus={"id": "press", "index": 0}, light={"time": "morning"})
# 61 a second trading floor, under $4 trillion
room("trade_open", "trading", seed=17, focus={"id": "traders", "index": 6})
# 62 Colette Kress addresses the staff (town hall)
room("townhall", seed=18, room={"w": 16, "d": 11, "h": 3.4, "floor": "carpet", "windows": 4, "doors": [{"wall": "left", "at": 0.88}]},
     place=[{"what": "podium", "name": "podium", "at": "back", "riser": 0.25, "mics": 1, "wallGap": 1.0}, {"what": "screenWall", "at": "back", "nx": 3, "ny": 1},
            {"what": "deskRow", "name": "rows", "n": 2, "at": "left", "per": 6}, {"what": "plant", "at": "corner", "n": 3}],
     groups=[{"form": "podium", "of": "podium", "n": 0, "name": "kress", "speakerChar": "kress"},
             {"form": "crowd", "n": 28, "area": "front-of:podium", "gap": 1.8, "poses": ["stand", "applaud", "stand_arms_crossed", "stand", "phone"], "name": "staff"}], focus="kress.speaker")
# 63 Harvey Jones, first chairman
room("board_chair", "boardroom", seed=41, mirror=True, people=[{"id": "jones", "char": "jones", "pose": "speak", "at": "end:table:1"}], focus="jones")
# 64 the President on the phone in his office
room("pres_office", seed=19, room={"w": 8, "d": 7, "h": 3.2, "floor": "carpet", "windows": 3, "curtains": True, "doors": [{"wall": "left", "at": 0.85}]},
     place=[{"what": "desk", "name": "desk", "at": "back", "variant": "lamp"}, {"what": "flag", "at": "back", "n": 2, "near": "desk"}, {"what": "sofa", "name": "sofa", "at": "left", "w": 1.9},
            {"what": "coffeeTable", "name": "coffee", "at": "front-of:sofa", "gap": 0.45}, {"what": "rug", "at": "center", "pad": 1.0}, {"what": "plant", "at": "corner", "n": 2}],
     people=[{"id": "president", "char": "president", "pose": "phone", "at": "front-of:desk"}], focus="president")
# 65 Senate Banking: the chairman summons
room("senate", "hearing", seed=3, people=[{"id": "chair", "char": "senator", "pose": "speak", "at": "seat:dais:5"}], focus="chair")
# 66 House: a closed-door briefing room
room("briefing", seed=20, room={"w": 9, "d": 7, "h": 2.9, "floor": "carpet", "windows": 0, "doors": [{"wall": "left", "at": 0.8}]},
     place=[{"what": "table", "name": "table", "at": "center", "seats": 10}, {"what": "screenWall", "at": "left", "nx": 2, "ny": 1}, {"what": "flag", "at": "back", "n": 2},
            {"what": "clock", "at": "back"}, {"what": "filing", "at": "back", "n": 2}],
     people=[{"id": "chairH", "char": "senator", "pose": "speak", "at": "end:table:1"}],
     groups=[{"form": "table", "of": "table", "n": 8, "name": "members"}], focus="chairH")
# 67 two Democrats write to the Commerce Secretary
room("letter", seed=21, room={"w": 7, "d": 5.5, "h": 2.9, "floor": "carpet", "windows": 2, "doors": [{"wall": "left", "at": 0.85}]},
     place=[{"what": "desk", "name": "desk", "at": "back", "variant": "papers"}, {"what": "shelf", "at": "left", "n": 2}, {"what": "flag", "at": "back", "n": 1}, {"what": "plant", "at": "corner"}],
     people=[{"id": "d1", "char": "senator", "pose": "sit_type", "prop": "papers", "at": "seat:desk:0", "with": "writers"},
             {"id": "d2", "pose": "look_down", "at": "front-of:desk", "with": "writers", "o": {"hair": "bun", "coat": True, "skirt": True}}], focus="writers")
# 68 China's foreign ministry briefing
room("mfa", "pressroom", seed=19, mirror=True, groups=[{"form": "podium", "of": "podium", "n": 6, "name": "scrum", "speakerChar": "envoy"},
     {"form": "audience", "of": "seats", "n": 24, "name": "reporters"}, {"form": "workers", "of": "tvCamera", "name": "camOps"}], focus="scrum.speaker")
# 69-70 the Attorney General on the Justice Department steps
room("doj_steps", "steps", seed=15, groups=[{"form": "podium", "at": "steps-foot", "n": 18, "name": "scrum", "speakerChar": "official"},
     {"form": "crowd", "n": 36, "area": "plaza", "poses": ["stand", "phone", "stand_arms_crossed"], "name": "onlookers"}], focus="scrum.speaker", light={"time": "overcast"})
# 74 customs inspectors open a crate in a port warehouse (alleged diversion)
room("customs", "factory", seed=23, place=[{"what": "crates", "name": "crates", "n": 8, "at": "grid", "cols": 4, "rowsN": 2, "gapX": 1.8, "gapZ": 2.2, "h": 0},
     {"what": "shelf", "n": 3, "at": "back", "fill": "boxes", "height": 2.4, "w": 1.6}, {"what": "workbench", "at": "left"}],
     groups=[{"form": "huddle", "n": 3, "at": [2.0, 4.6], "name": "inspectors"}, {"form": "crowd", "n": 3, "area": "aisles", "poses": ["carry", "carry", "look_down"], "name": "porters"}], focus="inspectors")
# 78 the earnings call: Kress and the finance team
room("earnings", seed=22, room={"w": 9, "d": 7, "h": 3, "floor": "carpet", "windows": 2, "doors": [{"wall": "left", "at": 0.85}]},
     place=[{"what": "table", "name": "table", "at": "center", "seats": 6}, {"what": "screenWall", "at": "back", "nx": 2, "ny": 1}, {"what": "credenza", "at": "left"}, {"what": "plant", "at": "corner"}],
     people=[{"id": "kress", "char": "kress", "pose": "sit_lean", "at": "seat:table:0"}],
     groups=[{"form": "table", "of": "table", "n": 4, "name": "execs", "poses": ["sit_type", "sit_listen", "sit_type"]}], focus="kress")
# 79 behind closed doors: Huang at the witness table, no public
room("closed_hearing", "hearing", seed=9, people=[{"id": "jensen", "char": "jensen", "pose": "sit_lean", "at": "seat:witnessTable:1"}],
     groups=[{"form": "table", "of": "dais", "n": 9, "name": "members"}, {"form": "table", "of": "dais", "staff": True, "n": 3, "name": "staff"}], focus="jensen")
# 81 the law firm's document room
room("docroom", seed=24, room={"w": 10, "d": 7, "h": 3, "floor": "carpet", "windows": 2, "doors": [{"wall": "left", "at": 0.85}]},
     place=[{"what": "table", "name": "table", "at": "center", "seats": 6}, {"what": "filing", "at": "left", "n": 4}, {"what": "shelf", "at": "back", "n": 3, "fill": "boxes"},
            {"what": "docPile", "at": "back"}, {"what": "boxes", "n": 3, "at": "left"}],
     groups=[{"form": "table", "of": "table", "n": 4, "name": "lawyers", "poses": ["sit_type", "sit_lean", "sit_listen"]}], focus="lawyers")

# ================= places: geography + scale only (exterior specs reused from the v2 plan, landmarks varied) =================
ext("hq_night"); ext("tainan"); ext("hq_day"); ext("fab_taiwan"); ext("megaspeed_dc"); ext("dc_hum"); ext("chip_port"); ext("hq_end"); ext("fab_hills"); ext("hq_last")
ext("washington", "capitol"); swap_focus("capitol", "parliament")
ext("commerce", "commerce_hq"); swap_focus("commerce_hq", "ministry")

# ================= MG beats: numbers and mechanisms only (data from the v2 plan, sourced in script.md) =================
MG_IDS = ["gpu", "cpugpu", "rise", "share", "mcap", "why", "rules", "h20rule", "h200", "owner", "bought", "memo", "disputed", "information",
          "dayswing", "lost", "verdict", "spyclaim", "trumpq", "layers", "loop", "arc"]
mg = [copy.deepcopy(MGV2[b]) for b in MG_IDS]
MB = {b["id"]: b for b in mg}
def part(kind, data, role="secondary"): return {"kind": kind, "data": data, "role": role}
# v3 MG: at least two parts per beat where one part alone left the frame under-filled (st.check fill gate) or one stop per line (4 s gap gate).
# Every added value is from script.md / the v2 plan (no new numbers).
MB["gpu"]["parts"].append(part("splitFlapDate", {"text": "1999", "groups": ["YEAR"], "what": "gpu", "label": "sold as the first GPU", "cap": ""}))
MB["cpugpu"]["parts"].append(part("conveyor", {"input": "documentPage", "stations": [{"label": "Split into small sums", "what": "gpu"}, {"label": "Thousands at once", "what": "gpu"},
                                   {"label": "A game world, drawn", "what": "laptop"}], "cap": "How a GPU draws a frame", "unit": "frames", "red": 1}))
MB["rise"]["parts"].append(part("splitFlapDate", {"text": "2012", "groups": ["YEAR"], "what": "gpu", "label": "AlexNet, on 2 Nvidia cards", "cap": ""}))
MB["share"]["parts"] = [{"kind": "waffleGrid", "data": {"parts": [{"label": "Nvidia", "value": 85}, {"label": "Everyone else", "value": 15}], "total": 100, "unit": "of AI training chips (approx.)",
                         "cap": "Analyst estimates: 80-90%", "object": "gpu", "redIndex": 0, "note": "roughly 80 to 90%"}}]
MB["rules"]["parts"][0]["data"]["steps"] = [{"label": "2022: top chips banned", "what": "stamp"}, {"label": "Slower versions", "what": "gpu"}, {"label": "2023: line moved", "what": "documentPage"},
                                            {"label": "H20 fits under", "what": "chip"}, {"label": "2025: H20 licence", "what": "padlock"}, {"label": "H200: 25% cut", "what": "coinStack"}]
MB["owner"]["parts"].append(part("sourceCard", {"value": "controlling", "unit": "shareholder (as reported)", "source": {"pub": "C4ADS", "title": "research cited by Reuters", "year": "2026", "page": "as reported"}, "cap": ""}))
MB["h200"]["parts"].append(part("waffleGrid", {"parts": [{"label": "To the US government", "value": 25}, {"label": "To Nvidia", "value": 75}], "total": 100, "unit": "of H200 China revenue",
                                "cap": "December 2025 terms", "object": "gpu", "redIndex": 0}))
MB["bought"]["parts"].append(part("receipt", {"items": [{"n": "Nvidia hardware (Megaspeed + affiliate)", "v": 4800000000, "qty": "2-3 years"}], "currency": "$", "head": "Purchases (approx., as reported)", "cap": ""}))
MB["memo"]["parts"].append(part("sourceCard", {"value": "6 Nov 2026", "unit": "report on a classified memo", "source": {"pub": "The New York Times", "title": "memo report", "year": "2026", "page": "as reported"}, "cap": ""}))
MB["information"]["parts"] = [{"kind": "stampedPermit", "data": {"title": "One report", "no": "The Information, 9 Nov", "cap": "Not independently verified", "stamp": "UNVERIFIED", "sign": "-",
                               "fields": [{"k": "Claim", "v": "≈$7.5 bn sales"}, {"k": "Tied to", "v": "the relationship"}, {"k": "Confirmed", "v": "no"}], "checks": ["Second source", "Documents"]}},
                              part("sourceCard", {"value": "≈$7.5 bn", "unit": "claimed chip sales to China", "source": {"pub": "The Information", "title": "report", "year": "9 Nov 2026", "page": "unverified"}, "cap": ""})]
MB["lost"]["parts"] = [{"kind": "objectCounter", "data": {"value": 1.4, "unit": "trillion dollars", "per": "lost in a month", "object": "coinStack", "each": 0.1, "cap": "About a quarter of the company", "note": "on paper, ≈-24%", "redIndex": 0}},
                       part("gauge", {"value": 3.6, "min": 0, "max": 100, "unit": "% of Nvidia", "label": "Huang's own stake", "zones": [{"to": 5, "label": "Huang"}, {"to": 100, "label": "Other shareholders"}], "cap": "", "note": "about 3.6%"})]
MB["verdict"]["parts"].append(part("sourceCard", {"value": "Confirmed", "unit": "by filings and statements", "source": {"pub": "Nvidia", "title": "Form 8-K, letter to staff", "year": "2026", "page": "public record"}, "cap": ""}))
MB["trumpq"]["parts"].append(part("splitFlapDate", {"text": "9 NOV", "groups": ["DAY", "MONTH"], "what": "podium", "label": "FBI has not confirmed", "cap": ""}))

# ================= a visual for every voiced line =================
def W(set, kind, path=None, callout=None, subject="focus", **kw):
  v = {"set": set, "subject": subject, "kind": kind}
  if path: v["path"] = path
  if callout: v["callout"] = callout
  v.update(kw); return v
def D(beat, f=0): return {"mg": beat, "focus": f, "kind": "data"}
P2 = ["highOblique", "threeQuarter"]; P2b = ["wide", "threeQuarter"]; P2c = ["orbitBack", "lateralLow"]
LV = {
  1: W("hq_night", "place", P2, "Nvidia HQ, Santa Clara"),
  2: W("walkout", "person", "reveal", "33 years"),
  3: W("board_quit", "person", "push", "Resigned: CEO and director"),
  4: W("trade_drop", "room", "reveal", "Down 13% intraday"),
  5: W("capitol", "place", P2b, "Washington"),
  6: W("news_sort", "room", "reveal", "Five days"),
  7: W("diner93", "person", "reveal", "A Denny's, East San Jose, 1993"),
  8: W("tainan", "place", P2, "Born in Tainan, Taiwan, 1963"),
  9: D("gpu"), 10: D("cpugpu"),
  11: W("cuda_lab", "person", "reveal", "CUDA, 2006"),
  12: D("rise", 3),
  13: W("research", "person", "reveal", "The same sums, billions of times"),
  14: W("rush", "room", "reveal", "Late 2022: everyone wants chips"),
  15: D("share"),
  16: W("hall_rev", "room", "reveal", "Data centers: ≈$194 bn a year"),
  17: D("mcap"),
  18: W("hq_day", "place", P2c, "Santa Clara"),
  19: W("commerce_hq", "place", None, "US Commerce Department"),
  20: D("why"),
  21: W("ban_sign", "person", "reveal", "Oct 2022: export ban"),
  22: W("fab_taiwan", "place", None, "Slower chips, just under the line"),
  23: D("rules", 2), 24: D("h20rule"),
  25: W("deal", "person", "reveal", "Deal: 15% to the US government"),
  26: D("h200"),
  27: W("middlemen", "street", "reveal", "Middlemen: Singapore, Malaysia"),
  28: W("sg_court", "person", "reveal", "Singapore charges, 2025 (≈US$390m)"),
  29: W("doj_presser", "person", "reveal", "US charges, 2025"),
  30: W("paperwork", "room", None, "The weak link: paperwork"),
  31: W("sg_plaza", "person", "reveal", "Alice Huang: no relation"),
  32: W("hall_alice", "person", None, "Megaspeed, Singapore"),
  33: D("owner"),
  34: W("partner_sign", "person", None, "Oct 2023: Nvidia cloud partner"),
  35: W("megaspeed_dc", "place", P2b, "Cloud partner: rents out Nvidia computing"),
  36: D("bought"),
  37: W("probe", "person", "reveal", "Commerce probe (reported)"),
  38: W("hall_inspect", "person", "reveal", "Megaspeed: no violations found"),
  39: W("gate", "person", "reveal", "Passport seized; barred from returning"),
  40: W("sg_steps", "person", None, "Singapore: US help 'limited'"),
  41: W("pair_event", "person", "reveal", "Photos since Dec 2023 (Reuters)"),
  42: W("expo", "person", "reveal", "A market under export watch"),
  43: W("news_nyt", "person", "reveal", "NYT, 29 Oct: espionage effort (reported)"),
  44: W("hq_scrum", "person", "reveal", "Nvidia: 'not unusual or unexpected'"),
  45: D("memo"), 46: D("disputed"),
  47: W("study", "person", "reveal", "Sun 8 Nov: letter to staff"),
  48: W("board_probe", "person", "reveal", "Independent investigation"),
  49: W("wh_press", "person", "reveal", "Trump: 'FBI is looking into it'"),
  50: W("wh_press", "person", None, "FBI has not confirmed"),
  51: W("suit_steps", "person", None, "Mon 9 Nov: class action filed"),
  52: D("information"), 53: D("information", 1),
  54: W("lawfirm", "person", "reveal", "Tue: outside lawyers hired"),
  55: W("phones", "person", "reveal", "NYT: another affair alleged (unconfirmed)"),
  56: W("board_vote", "person", None, "Wed 11 Nov: resignation accepted"),
  57: W("hq_vans", "street", "reveal", "Out as CEO and director"),
  58: D("dayswing"), 59: D("lost"), 60: D("lost", 9),
  61: W("trade_open", "room", "reveal", "Under $4 trillion at the open"),
  62: W("townhall", "person", "reveal", "Colette Kress: interim CEO"),
  63: W("board_chair", "person", "reveal", "Harvey Jones: first chair"),
  64: W("pres_office", "person", None, "Trump suggests Tim Cook"),
  65: W("senate", "person", "reveal", "Senate Banking: Huang + Commerce Secretary summoned"),
  66: W("briefing", "person", "reveal", "House: closed-door briefing"),
  67: W("letter", "person", None, "Democrats write to Commerce"),
  68: W("mfa", "person", None, "Beijing: stop 'fabricating' spy stories"),
  69: W("doj_steps", "person", None, "Justice Dept: no conclusion"),
  70: W("doj_steps", "street", None, None, subject="set"),
  71: D("verdict"), 72: D("verdict", 1), 73: D("spyclaim"),
  74: W("customs", "room", "reveal", "Alleged: chips reached China (Megaspeed denies)"),
  75: D("trumpq"),
  76: W("board_probe", "person", "descend", "Board: 'no reason to believe'", subject="board"),
  77: D("layers"),
  78: W("earnings", "person", "reveal", "17 Nov: first earnings without Huang"),
  79: W("closed_hearing", "person", None, "Closed-door testimony (expected)"),
  80: D("loop"),
  81: W("docroom", "person", None, "What the board knew, and when"),
  82: W("dc_hum", "place", P2b),
  83: W("chip_port", "place", P2, "Who checks the route?"),
  84: W("hq_end", "place", P2c),
  85: D("arc"),
  86: W("fab_hills", "place", P2b),
  87: W("hq_last", "place", None, endcard=True),
}
# lines under ~3.9 s need no reveal path (the event-gap gate is 4 s); drop paths that are None
for v in LV.values():
  if "path" in v and v["path"] is None: del v["path"]
assert sorted(LV) == list(range(1, 88)), sorted(set(range(1, 88)) - set(LV))
plan = {"film": "nvidia", "seed": 23, "v3": True, "endcard": V2.get("endcard", {"name": "Blind Luck Time"}), "cast": CAST, "sets": S, "mg": mg, "lines": {str(k): v for k, v in LV.items()}}
txt = json.dumps(plan, indent=1, ensure_ascii=False)
(F / "plan_v3.json").write_text(txt, encoding="utf8")
# film id nvidia_v3 reuses this film's voice timings: plan.json = plan_v3, lines.json copied (render.mjs lines rewrites shows there, not here)
D3 = F.parent / "nvidia_v3"; D3.mkdir(exist_ok=True)
(D3 / "plan.json").write_text(txt, encoding="utf8")
if not (D3 / "lines.json").exists(): shutil.copy(F / "lines.json", D3 / "lines.json")
snd = json.loads((F / "sound.json").read_text(encoding="utf8")); snd["video"] = "out/nvidia_v3.mp4"
(D3 / "sound.json").write_text(json.dumps(snd), encoding="utf8")
used = {v["set"] for v in LV.values() if "set" in v}
tags = {}
for v in LV.values(): tags[v["kind"]] = tags.get(v["kind"], 0) + 1
print("sets", len(S), "unused", sorted({s["id"] for s in S} - used), "mg beats", len(mg), "tags", tags)
