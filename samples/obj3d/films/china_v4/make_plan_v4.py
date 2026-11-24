# Producer step for China v4 (script v4: hook + 6 chapters + payoff). Writes films/china_v4/plan.json (PLAN.v3 = true).
# Rule 0: every set, cast silhouette, layout and MG beat below is designed fresh from the v4 lines (nothing taken from china_v3 or nvidia_v4);
# seeds come from "china_v4" + line index. Wiring (how lines/sets/MG/photos are emitted) follows films/nvidia_v4/make_plan_v4.py.
# Each chapter opens on an in-world title object (FURN.titleSign: wall plaque / stand board / crate) placed in the chapter's first set; the
# line carries chapterOpen=True so film.html hands the picture to that set right after the previous line (the title holds through chgap).
# Allegations stay attributed exactly as in script.md. Run: python make_plan_v4.py
import json, pathlib, re, zlib
F = pathlib.Path(__file__).parent
FILM = "china_v4"

# ---------------- script -> lines + chapters ({...} tags stripped, same parse as audio/voice.py) ----------------
src = (F / "script.md").read_text(encoding="utf8")
TXT, CHOPEN, pending = {}, {}, None
for raw in src.splitlines():
  s = raw.strip()
  m = re.match(r"#chapter\s+(\d+)\s*\|\s*([^|]+)\|", s)
  if m: pending = (int(m[1]), m[2].strip()); continue
  m = re.match(r"NARR \(([^)]*)\)(?: @[\d.]+)?(?: \[shows: [^\]]+\])?: (.+)", s)
  if m:
    n = len(TXT) + 1; TXT[n] = re.sub(r"\s*\{[^}]*\}", "", m[2]).strip()
    if pending: CHOPEN[n] = pending; pending = None
NL = len(TXT)
LJ = json.loads((F / "lines.json").read_text(encoding="utf8")) if (F / "lines.json").exists() else []
DUR = {l["n"]: l["end"] - l["start"] for l in LJ}
assert not LJ or len(LJ) == NL, (len(LJ), NL)
def seed(n, salt=""): return zlib.crc32(f"{FILM}:{n}{salt}".encode()) % 9973 + 1
def title(n, style, **kw):
  c, t = CHOPEN[n]; return {"what": "titleSign", "style": style, "text": t, "kicker": f"Chapter {c}", **kw}

# ---------------- cast: fixed faceless silhouettes (no likeness) ----------------
CAST = {
  "seller":    {"build": 0.9, "hair": "bun", "coat": False, "skirt": False},           # the counter seller in Huaqiangbei (hook + payoff)
  "shopper":   {"build": 1.08, "hair": "short", "coat": True, "prop": "phone"},        # the buyer at the counter
  "partner":   {"build": 1.14, "hair": "none", "coat": True, "tie": True},             # the Chinese joint-venture manager
  "visitor":   {"build": 1.02, "hair": "short", "coat": True, "tie": True, "prop": "briefcase"},   # the foreign engineer / executive
  "agent":     {"build": 1.1, "hair": "short", "coat": True, "tie": False},            # US investigators
  "engineer":  {"build": 0.96, "hair": "long", "coat": False},
  "slater":    {"build": 0.84, "hair": "short", "coat": False, "hat": "cap"},          # the young mill hand who sails for America
  "merchant":  {"build": 1.2, "hair": "none", "coat": True, "tie": True, "hat": "peak"},  # the Boston businessman touring mills
}

S = []
def room(id, n, type=None, scale=None, **kw):
  s = {"id": id, "seed": seed(n), **({"type": type} if type else {}), **({"scale": scale} if scale else {}), **kw}
  if scale is None and type is None: s["scale"] = "room"
  S.append(s); return id
def ext(id, n, ground, place, time="morning", ambient=None):
  S.append({"id": id, "seed": seed(n), "ground": {**ground, "seed": seed(n, "g")}, "place": place, "light": {"time": time}, "ambient": ambient or []}); return id
FRONT = -135   # stand / crate signs: lettering faces +z (the open, camera side of a cut-away room)
TS = 1.45      # chapter title boards drawn bigger than Nvidia's (LESSONS 15: "small chapter title board")

# ================= HOOK =================
# L1-2 an electronics mall floor in Huaqiangbei: rows of phone counters, one seller hands a handset to a shopper
room("phone_floor", 1, room={"w": 14, "d": 9.5, "h": 3.2, "floor": "tile", "windows": 0, "doors": [{"wall": "left", "at": 0.9, "w": 2.2}]},
     place=[{"what": "stall", "name": "counterA", "goods": "phones", "len": 2.6, "at": [0.6, 1.2], "h": 90, "focusable": True},
            {"what": "stall", "name": "rowB", "goods": "phones", "n": 3, "len": 2.2, "at": "grid", "cols": 3, "gapX": 1.4, "off": [0.4, -2.2]},
            {"what": "shelf", "at": "back", "n": 3, "fill": "boxes"}, {"what": "screenStand", "at": "left"}, {"what": "crates", "kind": "card", "n": 2, "at": "corner"},
            {"what": "wallArt", "kind": "chart", "at": "back", "n": 2}],
     groups=[{"form": "crowd", "n": 7, "area": "aisles", "poses": ["walk", "phone", "look_down", "carry", "stand"], "name": "browsers"},
             {"form": "workers", "of": "rowB", "n": 3, "name": "vendors"}],
     people=[{"id": "seller", "char": "seller", "pose": "speak", "at": [1.45, 1.2], "face": 180, "with": "sale"},
             {"id": "shopper", "char": "shopper", "pose": "look_down", "prop": "phone", "at": [-0.35, 1.3], "face": 0, "with": "sale"}], focus="sale")
# L3 around 2010: a back-street workshop, long benches of people assembling handsets
room("handset_shop", 3, room={"w": 12, "d": 8, "h": 2.9, "floor": "concrete", "windows": 3, "doors": [{"wall": "left", "at": 0.85}]},
     place=[{"what": "assemblyLine", "name": "bench1", "len": 7.0, "product": "box", "at": [0.8, -1.4], "h": 90}, {"what": "assemblyLine", "name": "bench2", "len": 7.0, "product": "part", "at": [0.8, 1.6], "h": 90},
            {"what": "crates", "kind": "card", "n": 4, "at": "back"}, {"what": "shelf", "at": "left", "n": 2, "fill": "boxes"}, {"what": "clock", "at": "back"}],
     groups=[{"form": "workers", "of": "bench1", "name": "line1"}, {"form": "workers", "of": "bench2", "name": "line2"}],
     people=[{"id": "boss", "pose": "stand_arms_crossed", "at": [-4.2, 0.2], "face": 0, "o": {"coat": True, "build": 1.2}}], focus={"id": "line2", "index": 1})
# L4 + L86 Michigan: a new battery plant on flat farmland, car park and lorries (exterior, built fresh)
ext("mich_plant", 4, {"kind": "plain", "relief": 0.08, "size": 240, "shore": False},
    [{"what": "factory", "n": 1, "where": "center", "focus": True, "name": "battery"}, {"what": "warehouse", "n": 2, "where": "near battery"}, {"what": "road", "from": "edge:south", "to": "battery", "name": "drive"},
     {"what": "truck", "n": 3, "where": "road"}, {"what": "car", "n": 18, "where": "near battery"}, {"what": "plantation", "rows": 10, "cols": 16, "where": "edge"}, {"what": "trees", "n": 60, "where": "edge"}], "afternoon")

# ================= CH1 The Bandit Market =================
# L5 1980: the border river, paddy fields and a village of low houses, a rail bridge to the south (exterior)
ext("border_1980", 5, {"kind": "coast", "relief": 0.22, "size": 250, "shore": "south"},
    [{"what": "plantation", "rows": 14, "cols": 12, "where": "inland", "name": "paddy"}, {"what": "hut", "n": 18, "where": "near paddy", "focus": True, "focusIndex": 4, "name": "hamlet"},
     {"what": "rail", "from": "edge:north", "to": "edge:south", "name": "kcr"}, {"what": "train", "where": "kcr", "wagon": "box", "n": 5},
     {"what": "fishingBoat", "n": 4, "where": "shore"}, {"what": "trees", "n": 70, "where": "hills"}, {"what": "people", "n": 4, "where": "near hamlet"}], "morning", ["birds"])
# L6 that August: officials in a plain meeting hall approve the zone; the chapter plaque hangs on the back wall
room("zone_hall", 6, room={"w": 11, "d": 8, "h": 3.4, "floor": "wood", "windows": 4, "curtains": True, "doors": [{"wall": "left", "at": 0.86}]},
     place=[{"what": "table", "name": "longt", "at": "center", "seats": 8, "len": 4.2, "off": [0.6, -0.2]}, {"what": "flag", "at": "back", "n": 1},
            {"what": "wallArt", "kind": "chart", "at": "left", "n": 1}, {"what": "chair", "style": "stack", "at": "left", "n": 4}, {"what": "plant", "at": "corner", "n": 2},
            title(5, "plaque", at="back", w=2.6 * TS, hh=0.9 * TS, y=1.7)],
     groups=[{"form": "table", "of": "longt", "n": 7, "name": "officials", "poses": ["sit_listen", "sit_lean", "sit_type", "sit_listen", "raise_hand"]}],
     people=[{"id": "clerk", "pose": "carry", "prop": "papers", "at": [-3.4, 2.2], "face": 20, "o": {"coat": False, "hair": "short"}}], focus={"id": "officials", "index": 2})
# L8 Huaqiangbei today: a dense market street of stalls and shoppers between tall mall facades
room("hqb_street", 8, "market", street={"w": 46, "d": 32, "kind": "market", "facades": ["back", "left"], "road": "front"},
     place=[{"what": "stall", "goods": "phones", "n": 14, "at": "aisle"}, {"what": "lampPost", "n": 2, "at": "plaza"}, {"what": "crates", "kind": "card", "n": 3, "at": "plaza"}],
     addGroups=[{"form": "crowd", "n": 26, "area": "plaza", "poses": ["walk", "carry", "phone"], "mode": "plaza", "name": "porters"}], focus={"id": "shoppers", "index": 3})
# L10 the knock-off counter: a cramped stall corner, phones on easels, a seller showing one to two buyers
room("copy_corner", 10, room={"w": 7.5, "d": 6, "h": 2.8, "floor": "tile", "windows": 0, "doors": [{"wall": "left", "at": 0.82}]},
     place=[{"what": "stall", "name": "copies", "goods": "phones", "len": 3.0, "at": [0.4, 0.2], "h": 90}, {"what": "shelf", "at": "back", "n": 2, "fill": "boxes"},
            {"what": "crates", "kind": "card", "n": 3, "at": "left"}, {"what": "screenStand", "at": "near:copies"}],
     people=[{"id": "v", "pose": "point", "at": [1.3, 0.2], "face": 180, "with": "deal", "o": {"coat": False, "hair": "short"}},
             {"id": "b1", "pose": "look_down", "prop": "phone", "at": [-0.6, 0.5], "face": 0, "with": "deal", "o": {"coat": True}},
             {"id": "b2", "pose": "stand_hips", "at": [-0.9, -0.5], "face": 20, "o": {"hair": "long", "coat": False}}], focus="deal")
# L11 a phone design house: engineers at benches over circuit boards, one holding up a board
room("design_house", 11, "lab", room={"w": 10, "d": 7, "h": 3.0, "floor": "tile", "windows": 3, "doors": [{"wall": "left", "at": 0.85}]},
     place=[{"what": "labBench", "name": "benches", "n": 4, "at": "grid", "cols": 2, "gapX": 1.8, "gapZ": 1.4, "off": [0.6, -0.4]}, {"what": "whiteboard", "at": "left"},
            {"what": "shelf", "at": "back", "n": 2, "fill": "boxes"}, {"what": "crates", "kind": "card", "n": 2, "at": "corner"}],
     groups=[{"form": "workers", "of": "benches", "n": 3, "name": "designers"}],
     people=[{"id": "lead", "char": "engineer", "pose": "point", "at": [-2.6, 2.0], "face": "benches"}], focus="lead")
# L13 + L15 a night-market lane: stalls lit up, a vendor demonstrating a handset, buyers crowding in
room("night_lane", 13, scale="street", street={"w": 40, "d": 28, "kind": "market", "facades": ["back"], "road": "front"},
     place=[{"what": "stall", "goods": "phones", "n": 9, "at": "aisle"}, {"what": "lampPost", "n": 3, "at": "plaza"}, {"what": "bench", "n": 1, "at": "plaza"}],
     groups=[{"form": "crowd", "n": 30, "area": "aisle", "poses": ["walk", "phone", "carry", "stand", "look_down"], "name": "crowd"}, {"form": "workers", "of": "stall", "name": "vendors"}],
     people=[{"id": "demo", "pose": "raise_hand", "prop": "phone", "at": [0.5, 6.0], "face": 90, "with": "pitch", "o": {"coat": False, "hat": "cap"}},
             {"id": "c1", "pose": "look_down", "at": [1.5, 6.6], "face": 240, "with": "pitch", "o": {"coat": True}}], focus="pitch", light={"time": "evening"})
# L16 the front door: a contract signing in a hotel ballroom, two delegations, cameras
room("signing_ball", 16, room={"w": 14, "d": 10, "h": 3.8, "floor": "carpet", "windows": 0, "doors": [{"wall": "left", "at": 0.88, "w": 2.0}]},
     place=[{"what": "table", "name": "sign", "at": "center", "seats": 4, "len": 3.0, "off": [0.8, -1.4]}, {"what": "flag", "at": "back", "n": 4},
            {"what": "chairsRows", "name": "rows", "rows": 2, "cols": 8, "aisle": 1.2, "at": "front", "near": [0.6, 0]}, {"what": "tvCamera", "n": 2, "at": "side:rows", "face": "sign"}],
     groups=[{"form": "table", "of": "sign", "n": 4, "name": "signers", "poses": ["sit_type", "sit_type", "sit_listen", "sit_lean"]},
             {"form": "audience", "of": "rows", "n": 9, "name": "guests"}, {"form": "crowd", "n": 4, "area": [-1.5, 0.0, 3.0, 0.8], "poses": ["applaud", "applaud", "stand", "phone"], "name": "aides"}],
     focus="signers")

# ================= CH2 Half a Factory =================
# L17/19/26 a car plant floor split by a painted line: two crews in different overalls on the two halves; the title board stands at the line
room("split_plant", 17, "factory", room={"w": 22, "d": 14, "h": 6.2, "floor": "concrete", "windows": 5, "highWindows": True, "doors": [{"wall": "left", "at": 0.8, "w": 3.6, "h": 4}]},
     place=[{"what": "assemblyLine", "name": "lineA", "len": 13, "product": "part", "at": [1.2, -2.6], "h": 90}, {"what": "car", "name": "body", "n": 3, "at": [1.0, 0.6], "spacing": 4.6},
            {"what": "ropePosts", "name": "paint", "at": [1.0, 2.4], "len": 13, "h": 90}, {"what": "machineTool", "n": 3, "at": "left"}, {"what": "crates", "n": 3, "at": "back"},
            title(17, "stand", at=[-5.6, 3.6], h=FRONT, scale=TS)],
     groups=[{"form": "workers", "of": "lineA", "name": "crewA", "o": {"hat": "hard", "coat": False}},
             {"form": "crowd", "n": 5, "area": [-3.0, 3.0, 6.0, 5.4], "toward": "body", "poses": ["look_down", "point", "stand_arms_crossed", "look_down", "stand"], "name": "crewB", "o": {"hat": "cap", "coat": True}}],
     people=[{"id": "partner", "char": "partner", "pose": "look_down", "prop": "papers", "at": [-2.6, 2.9], "face": 0, "with": "watchers"},
             {"id": "visitor", "char": "visitor", "pose": "point", "at": [-1.4, 1.6], "face": 270, "with": "watchers"}], focus="watchers")
# L20 Shanghai: two car plants side by side by a river, car parks full (exterior)
ext("shanghai_jv", 20, {"kind": "coast", "relief": 0.06, "size": 260, "shore": "east"},
    [{"what": "factory", "n": 2, "where": "center", "focus": True, "focusIndex": 0, "name": "plants"}, {"what": "car", "n": 46, "where": "near plants"}, {"what": "road", "from": "edge:west", "to": "plants", "name": "road"},
     {"what": "truck", "n": 4, "where": "road"}, {"what": "midrise", "n": 10, "where": "edge"}, {"what": "tanker", "n": 1, "where": "sea"}, {"what": "trees", "n": 40, "where": "edge"}])
# L21 Doha 2001: trade ministers around a round conference table, a chair with a gavel, interpreters' booths behind
room("trade_conf", 21, room={"w": 13, "d": 10, "h": 4.0, "floor": "carpet", "windows": 0, "doors": [{"wall": "left", "at": 0.88, "w": 1.8}]},
     place=[{"what": "roundTable", "name": "ring", "at": "center", "seats": 10, "off": [0.6, -0.6]}, {"what": "flag", "at": "back", "n": 5},
            {"what": "partition", "glass": True, "len": 5, "at": "back"}, {"what": "chairsRows", "name": "obs", "rows": 1, "cols": 8, "at": "front", "near": [0.6, 0]}, {"what": "plant", "at": "corner", "n": 2}],
     groups=[{"form": "table", "of": "ring", "n": 9, "name": "ministers", "poses": ["sit_listen", "sit_lean", "applaud", "sit_listen", "sit_type"]}, {"form": "audience", "of": "obs", "n": 5, "name": "observers"}],
     people=[{"id": "chair", "pose": "speak", "prop": "gavel", "at": [-1.8, -0.6], "face": 30, "o": {"coat": True, "tie": True, "hair": "none"}}], focus={"id": "ministers", "index": 3})
# L22 the US investigation: case officers in an office of file boxes, one pinning findings to a board
room("probe_office", 22, room={"w": 10, "d": 7.5, "h": 2.9, "floor": "carpet", "windows": 2, "doors": [{"wall": "left", "at": 0.84}]},
     place=[{"what": "deskRow", "name": "rows", "n": 2, "at": "grid", "cols": 1, "rowsN": 2, "per": 3, "gapZ": 1.6, "h": 0, "off": [0.8, 0.0]}, {"what": "whiteboard", "name": "board", "at": "left"},
            {"what": "filing", "at": "back", "n": 4}, {"what": "docPile", "at": "back"}, {"what": "crates", "kind": "crate", "n": 2, "at": "corner"}, {"what": "flag", "at": "back", "n": 1}],
     groups=[{"form": "table", "of": "rows", "n": 4, "name": "analysts", "poses": ["sit_type", "sit_lean", "sit_type", "sit_listen"]}],
     people=[{"id": "lead", "char": "agent", "pose": "point", "at": [-3.0, 0.6], "face": "board", "with": "brief"},
             {"id": "aide", "pose": "look_down", "prop": "papers", "at": [-2.6, 1.6], "face": 200, "with": "brief", "o": {"hair": "bun", "skirt": True}}], focus="brief")
# L23 Beijing: a ministry spokesman at a lectern, a small group of reporters with notebooks
room("ministry_brief", 23, room={"w": 10, "d": 8.5, "h": 3.4, "floor": "carpet", "windows": 0, "wainscot": True, "doors": [{"wall": "left", "at": 0.86}]},
     place=[{"what": "lectern", "name": "lectern", "at": "back", "mics": 3}, {"what": "flag", "at": "back", "n": 2, "near": "lectern"}, {"what": "wallArt", "kind": "seal", "at": "back", "w": 1.0, "h": 1.0, "y": 2.3},
            {"what": "chairsRows", "name": "press", "rows": 2, "cols": 6, "aisle": 1.0, "at": "front-of:lectern", "gap": 3.0}, {"what": "tvCamera", "n": 2, "at": "side:press", "face": "lectern"}],
     groups=[{"form": "podium", "of": "lectern", "n": 1, "name": "spokesman"}, {"form": "audience", "of": "press", "n": 8, "name": "reporters"}], focus="spokesman")
# L25 2019: the legislature votes the new law, delegates raising hands in tiered rows
room("vote_hall", 25, room={"w": 18, "d": 13, "h": 5.0, "floor": "carpet", "windows": 0, "doors": [{"wall": "left", "at": 0.88, "w": 2.0}]},
     place=[{"what": "dais", "name": "dais", "seats": 9, "at": "back"}, {"what": "flag", "at": "back", "n": 2, "near": "dais"}, {"what": "wallArt", "kind": "seal", "at": "back", "w": 1.4, "h": 1.4, "y": 3.2},
            {"what": "chairsRows", "name": "floor", "rows": 4, "cols": 12, "aisle": 1.4, "at": "front-of:dais", "gap": 2.6}],
     groups=[{"form": "table", "of": "dais", "n": 8, "name": "presidium"}, {"form": "audience", "of": "floor", "n": 30, "name": "delegates", "poses": ["raise_hand", "raise_hand", "sit_listen", "raise_hand"]}],
     focus={"id": "delegates", "index": 5})
# L27 night: an empty office, one figure copying files from a terminal to a drive
room("night_copy", 27, room={"w": 8, "d": 6.5, "h": 2.8, "floor": "carpet", "windows": 2, "curtains": True, "doors": [{"wall": "left", "at": 0.84}]},
     place=[{"what": "desk", "name": "term", "at": "center", "variant": "lamp", "off": [0.4, -0.4]}, {"what": "serverRack", "n": 2, "at": "back"}, {"what": "filing", "at": "left", "n": 3},
            {"what": "desk", "n": 2, "at": "back"}, {"what": "clock", "at": "back"}],
     people=[{"id": "copier", "pose": "sit_type", "at": "seat:term:0", "o": {"coat": True, "hat": "cap", "hair": "short"}}], focus="copier", light={"time": "evening"})

# ================= CH3 Exhibits =================
# L28 the evidence room: three numbered exhibit tables, investigators bending over them; the title board leans on a crate
room("exhibit_room", 28, room={"w": 14, "d": 9, "h": 3.2, "floor": "tile", "windows": 0, "doors": [{"wall": "left", "at": 0.86}]},
     place=[{"what": "table", "name": "ex", "n": 3, "at": "grid", "cols": 3, "gapX": 2.0, "seats": 0, "len": 2.2, "off": [0.8, -0.4]}, {"what": "docPile", "at": "back"},
            {"what": "shelf", "at": "back", "n": 3, "fill": "boxes"}, {"what": "filing", "at": "left", "n": 2}, {"what": "crates", "kind": "crate", "n": 2, "at": "corner"},
            title(28, "crate", at=[-4.4, 3.0], h=FRONT, scale=TS)],
     groups=[{"form": "huddle", "n": 3, "at": [0.2, 1.6], "name": "team", "poses": ["look_down", "point", "look_down"], "o": {"coat": True}},
             {"form": "crowd", "n": 2, "area": [3.0, 1.2, 5.6, 3.2], "poses": ["carry", "look_down"], "prop": "box", "name": "clerks"}], focus={"id": "team", "index": 1})
# L29 a wind farm on a ridge, turbines in a line, a service truck on the track (exterior)
ext("wind_ridge", 29, {"kind": "hills", "relief": 0.4, "size": 260, "shore": False},
    [{"what": "windTurbine", "n": 9, "where": "hills", "focus": True, "focusIndex": 3, "name": "turbines"}, {"what": "road", "from": "edge:south", "to": "turbines", "name": "track"},
     {"what": "truck", "n": 2, "where": "track"}, {"what": "shed", "n": 2, "where": "near turbines"}, {"what": "trees", "n": 50, "where": "edge"}], "afternoon", ["birds"])
# L31 Austria: a rented flat, an engineer hands a laptop across a kitchen table to a man in a coat
room("vienna_flat", 31, room={"w": 6.8, "d": 5.6, "h": 2.9, "floor": "wood", "windows": 2, "curtains": True, "doors": [{"wall": "left", "at": 0.8}]},
     place=[{"what": "table", "name": "kt", "at": "center", "seats": 2, "len": 1.3}, {"what": "shelf", "at": "back", "n": 1, "fill": "books"}, {"what": "sofa", "at": "left", "w": 1.7},
            {"what": "rug", "at": "under:kt", "pad": 0.6}, {"what": "clock", "at": "back"}],
     people=[{"id": "eng", "char": "engineer", "pose": "sit_type", "prop": "laptop", "at": "seat:kt:0", "with": "handover"},
             {"id": "buyer", "pose": "sit_lean", "at": "seat:kt:1", "with": "handover", "o": {"coat": True, "hair": "none", "build": 1.15}}], focus="handover", light={"time": "evening"})
# L32 Madison, Wisconsin: the jury in its box, a lawyer addressing it
room("madison_court", 32, "courtroom", room={"w": 14, "d": 11, "h": 4.0, "floor": "carpet", "windows": 3, "wainscot": True, "doors": [{"wall": "left", "at": 0.86, "w": 1.6}]},
     people=[{"id": "counsel", "char": "agent", "pose": "speak", "at": [0.4, 0.6], "face": 270}], focus="jurors")
# L33 the American company afterwards: an emptied office floor, staff carrying boxes out
room("emptied_floor", 33, room={"w": 13, "d": 8.5, "h": 3.0, "floor": "carpet", "windows": 4, "doors": [{"wall": "left", "at": 0.86}]},
     place=[{"what": "desk", "name": "desks", "n": 8, "at": "grid", "cols": 4, "gapX": 1.4, "gapZ": 1.4, "off": [0.8, -0.6]}, {"what": "crates", "kind": "card", "n": 4, "at": "left"},
            {"what": "filing", "at": "back", "n": 2}, {"what": "plant", "at": "corner", "n": 1}],
     groups=[{"form": "queue", "n": 6, "at": [-4.6, 2.4], "dir": 180, "name": "leavers", "prop": "box"}],
     people=[{"id": "last", "pose": "look_down", "at": [2.4, 2.6], "face": 200, "o": {"coat": True, "hair": "bun"}}], focus={"id": "leavers", "index": 0})
# L34 a chip plant in Taiwan: engineers in a cleanroom bay; one leaves with a briefcase past the gowning bench
room("fab_bay", 34, room={"w": 14, "d": 9, "h": 3.6, "floor": "tile", "windows": 0, "doors": [{"wall": "left", "at": 0.86, "w": 1.4}]},
     place=[{"what": "labBench", "name": "tools", "n": 6, "at": "grid", "cols": 3, "gapX": 1.6, "gapZ": 1.6, "off": [1.0, -0.8]}, {"what": "serverRack", "n": 3, "at": "back"},
            {"what": "bench", "n": 1, "at": "front"}, {"what": "shelf", "at": "left", "n": 2, "fill": "boxes"}],
     groups=[{"form": "workers", "of": "tools", "n": 4, "name": "techs", "o": {"hat": "hard", "coat": True}}],
     people=[{"id": "leaver", "char": "engineer", "pose": "walk", "prop": "briefcase", "at": [-3.8, 2.6], "face": 180}], focus="leaver")
# L35-36 a US federal courtroom: the plea and then a bench trial with an empty jury box
room("sf_court", 35, room={"w": 13, "d": 10, "h": 3.8, "floor": "wood", "windows": 2, "wainscot": True, "doors": [{"wall": "left", "at": 0.86, "w": 1.5}]},
     place=[{"what": "judgeBench", "name": "bench", "at": "back", "focusable": True}, {"what": "flag", "at": "back", "n": 2, "near": "bench"}, {"what": "juryBox", "name": "jury", "at": "left", "near": [0, -1.6]},
            {"what": "witnessTable", "name": "defence", "seats": 3, "at": "front-of:bench", "lat": 1.4, "gap": 2.8, "face": "bench"},
            {"what": "witnessTable", "name": "gov", "seats": 2, "at": "front-of:bench", "lat": -2.2, "gap": 2.8, "face": "bench"},
            {"what": "pews", "name": "gallery", "rows": 2, "len": 7, "aisle": 1.0, "bar": True, "at": "front", "near": [0.8, 0]}, {"what": "clock", "at": "left"}],
     groups=[{"form": "table", "of": "bench", "n": 1, "name": "judge"}, {"form": "table", "of": "defence", "n": 3, "name": "defendants", "poses": ["sit_listen", "sit", "sit_lean"]},
             {"form": "table", "of": "gov", "n": 2, "name": "prosecutors"}, {"form": "audience", "of": "gallery", "n": 7, "name": "public"}], focus="defendants")
# L37 a military office block: rows of operators at screens, officers in peaked caps walking the aisle
room("unit_floor", 37, room={"w": 15, "d": 10, "h": 2.9, "floor": "tile", "windows": 3, "doors": [{"wall": "left", "at": 0.88}]},
     place=[{"what": "deskRow", "name": "rows", "n": 3, "at": "grid", "cols": 3, "rowsN": 1, "per": 5, "gapX": 1.3, "h": 0, "off": [0.8, 0]}, {"what": "screenWall", "at": "back", "nx": 3, "ny": 1},
            {"what": "filing", "at": "left", "n": 2}, {"what": "clock", "at": "back"}],
     groups=[{"form": "table", "of": "rows", "n": 13, "name": "operators", "poses": ["sit_type", "sit_type", "sit_lean"], "o": {"hat": "peak", "coat": True}},
             {"form": "huddle", "n": 5, "at": [-3.4, 3.2], "name": "five", "poses": ["stand", "stand_arms_crossed", "point", "stand", "look_down"], "o": {"hat": "peak", "coat": True}}],
     focus="five")
# L38 never tried: a courtroom defendants' table with five empty chairs, a clerk tidying files
room("empty_dock", 38, room={"w": 10, "d": 8, "h": 3.6, "floor": "carpet", "windows": 2, "wainscot": True, "doors": [{"wall": "left", "at": 0.84}]},
     place=[{"what": "judgeBench", "name": "bench", "at": "back"}, {"what": "flag", "at": "back", "n": 1, "near": "bench"},
            {"what": "witnessTable", "name": "dock", "seats": 5, "at": "front-of:bench", "gap": 3.0, "face": "bench", "focusable": True}, {"what": "filing", "at": "left", "n": 2}],
     people=[{"id": "clerk", "pose": "look_down", "prop": "papers", "at": [-3.0, -0.4], "face": 0, "o": {"coat": False, "hair": "bun", "skirt": True}}],
     focus="dock")
# L40 a commission's hearing room: commissioners at a raised table, a witness reading a report
room("commission", 40, "hearing", room={"w": 15, "d": 11, "h": 4.0, "floor": "carpet", "windows": 0, "wainscot": True, "doors": [{"wall": "left", "at": 0.88, "w": 1.6}]},
     focus={"id": "witnessTable", "index": 0})
# L42 + L44 a rail yard: two bullet trains side by side on parallel tracks under a long shed (exterior)
ext("hsr_yard", 42, {"kind": "plain", "relief": 0.1, "size": 250, "shore": False},
    [{"what": "rail", "from": "edge:west", "to": "edge:east", "name": "trackA"}, {"what": "train", "where": "trackA", "wagon": "hsr", "n": 8, "focus": True, "name": "foreign"},
     {"what": "rail", "from": "edge:west", "to": "edge:east", "name": "trackB", "offset": 6}, {"what": "train", "where": "trackB", "wagon": "hsr", "n": 8, "name": "local"},
     {"what": "warehouse", "n": 3, "where": "near trackA"}, {"what": "midrise", "n": 6, "where": "edge"}, {"what": "trees", "n": 40, "where": "edge"}], "morning")

# ================= CH4 Learn, Then Rebuild =================
# L43 2004 tender hall: bid boxes opened on a long table, foreign delegations seated, title plaque on the wall
room("tender_hall", 43, room={"w": 13, "d": 9, "h": 3.6, "floor": "wood", "windows": 4, "doors": [{"wall": "left", "at": 0.86}]},
     place=[{"what": "table", "name": "bids", "at": "center", "seats": 8, "len": 4.6, "off": [0.6, -0.6]}, {"what": "crates", "kind": "crate", "n": 3, "at": "front-of:bids", "gap": 0.9},
            {"what": "screenWall", "at": "left", "nx": 2, "ny": 1}, {"what": "flag", "at": "back", "n": 3}, {"what": "plant", "at": "corner", "n": 2},
            title(43, "plaque", at="back", w=2.6 * TS, hh=0.9 * TS, y=1.8)],
     groups=[{"form": "table", "of": "bids", "n": 7, "name": "bidders", "poses": ["sit_listen", "sit_lean", "sit_type", "sit_listen"]}],
     people=[{"id": "opener", "pose": "carry", "prop": "box", "at": [-1.8, 1.6], "face": 0, "o": {"coat": True, "tie": True}}], focus="opener")
# L45 a drawing office: Chinese engineers at tables of plans, a foreign engineer pointing at a sheet
room("draw_office", 45, room={"w": 11, "d": 8, "h": 3.2, "floor": "wood", "windows": 4, "doors": [{"wall": "left", "at": 0.86}]},
     place=[{"what": "table", "name": "plans", "n": 2, "at": "grid", "cols": 2, "gapX": 2.0, "seats": 4, "len": 2.6, "off": [0.6, -0.4]}, {"what": "whiteboard", "at": "left"},
            {"what": "filing", "at": "back", "n": 3}, {"what": "docPile", "at": "back"}],
     groups=[{"form": "table", "of": "plans", "n": 6, "name": "learners", "poses": ["sit_lean", "sit_type", "sit_listen"]}],
     people=[{"id": "tutor", "char": "visitor", "pose": "point", "at": [-1.2, 1.4], "face": "plans", "with": "lesson"},
             {"id": "note", "char": "engineer", "pose": "look_down", "prop": "papers", "at": [-0.4, 1.9], "face": 200, "with": "lesson"}], focus="lesson")
# L46 a patent office counter: clerks stamping filings, a queue of applicants with folders
room("patent_counter", 46, room={"w": 12, "d": 8, "h": 3.2, "floor": "tile", "windows": 3, "doors": [{"wall": "left", "at": 0.86}]},
     place=[{"what": "counter", "name": "desk", "len": 6, "stools": 0, "at": "back"}, {"what": "filing", "at": "left", "n": 4}, {"what": "docPile", "at": "back"},
            {"what": "beamSeats", "n": 2, "at": "front"}, {"what": "clock", "at": "back"}],
     groups=[{"form": "workers", "of": "desk", "n": 3, "name": "clerks"}, {"form": "queue", "n": 6, "at": [-3.6, 0.8], "dir": 90, "name": "applicants", "prop": "papers"}],
     focus={"id": "applicants", "index": 0})
# L48 2017: a new bullet train on a viaduct across hills (exterior)
ext("viaduct_hills", 48, {"kind": "hills", "relief": 0.5, "size": 270, "shore": False},
    [{"what": "rail", "from": "edge:south", "to": "edge:north", "name": "line"}, {"what": "train", "where": "line", "wagon": "hsr", "n": 8, "focus": True, "name": "fuxing"},
     {"what": "plantation", "rows": 8, "cols": 12, "where": "center"}, {"what": "town", "n": 16, "where": "edge"}, {"what": "trees", "n": 90, "where": "hills"}], "afternoon", ["birds"])
# L50 a big rail hub: many tracks fanning out, trains at every platform (exterior)
ext("rail_hub", 50, {"kind": "plain", "relief": 0.05, "size": 260, "shore": False},
    [{"what": "rail", "from": "edge:west", "to": "edge:east", "name": "t1"}, {"what": "rail", "from": "edge:west", "to": "edge:east", "name": "t2", "offset": 5},
     {"what": "rail", "from": "edge:west", "to": "edge:east", "name": "t3", "offset": -5}, {"what": "train", "where": "t1", "wagon": "hsr", "n": 8, "focus": True, "name": "hsrA"},
     {"what": "train", "where": "t2", "wagon": "hsr", "n": 8}, {"what": "train", "where": "t3", "wagon": "hsr", "n": 8}, {"what": "govHall", "n": 1, "where": "center", "name": "station"},
     {"what": "tower", "n": 8, "where": "edge"}, {"what": "car", "n": 24, "where": "near station"}], "noon")
# L51 + L61 Hangzhou: a small AI lab, a dozen desks with big screens, whiteboards of equations
room("ai_lab", 51, room={"w": 12, "d": 8, "h": 3.0, "floor": "concrete", "windows": 4, "doors": [{"wall": "left", "at": 0.86}]},
     place=[{"what": "cluster", "name": "pods", "n": 3, "at": "grid", "cols": 3, "gapX": 1.8, "off": [0.8, -0.4]}, {"what": "whiteboard", "name": "wb", "at": "left"}, {"what": "whiteboard", "at": "back"},
            {"what": "plant", "at": "corner", "n": 3}, {"what": "sofa", "at": "back", "w": 1.8}, {"what": "waterCooler", "at": "left"}],
     groups=[{"form": "table", "of": "pods", "n": 8, "name": "coders", "poses": ["sit_type", "sit_type", "sit_lean", "sit_listen"]}],
     people=[{"id": "r1", "char": "engineer", "pose": "point", "at": [-3.6, 0.4], "face": "wb", "with": "duo"},
             {"id": "r2", "pose": "stand_arms_crossed", "at": [-3.0, 1.4], "face": 200, "with": "duo", "o": {"coat": False, "hair": "short"}}], focus="duo")
# L54 the hardware the small number left out: a long hall of server racks, technicians at a cart
room("rack_hall", 54, room={"w": 18, "d": 11, "h": 3.8, "floor": "tile", "windows": 0, "doors": [{"wall": "left", "at": 0.88, "w": 1.6}]},
     place=[{"what": "serverRack", "name": "racks", "n": 12, "at": "grid", "cols": 4, "rowsN": 3, "gapX": 1.3, "gapZ": 1.8, "h": 0, "off": [1.4, -1.0]}, {"what": "crates", "kind": "card", "n": 3, "at": "left"},
            {"what": "desk", "name": "noc", "at": "front", "variant": "papers"}],
     groups=[{"form": "crowd", "n": 5, "area": "aisles", "poses": ["carry", "look_down", "kneel", "stand", "phone"], "prop": "box", "name": "techs"}], focus={"id": "techs", "index": 2})
# L56 an AI company boardroom: an executive on the phone to a newspaper, colleagues around the table
room("call_room", 56, "boardroom", room={"w": 9, "d": 7, "h": 3.0, "floor": "wood", "windows": 3, "doors": [{"wall": "left", "at": 0.84}]},
     people=[{"id": "exec", "pose": "phone", "at": [-2.8, 1.8], "face": 30, "o": {"coat": False, "hair": "short", "build": 1.0}}], focus="exec")
# L58 another AI company: researchers at a screen wall of logs, one tallying on a whiteboard
room("log_room", 58, room={"w": 11, "d": 7.5, "h": 3.0, "floor": "carpet", "windows": 2, "doors": [{"wall": "left", "at": 0.86}]},
     place=[{"what": "screenWall", "name": "logs", "at": "back", "nx": 4, "ny": 2}, {"what": "deskRow", "name": "row", "n": 1, "at": "grid", "cols": 1, "rowsN": 1, "per": 5, "h": 0, "off": [0.6, 0.6]},
            {"what": "whiteboard", "name": "tally", "at": "left"}, {"what": "plant", "at": "corner", "n": 2}],
     groups=[{"form": "table", "of": "row", "n": 4, "name": "analysts"}, {"form": "crowd", "n": 3, "area": [-2.0, -2.2, 2.0, -1.2], "toward": "logs", "poses": ["point", "look_down", "stand_arms_crossed"], "name": "readers"}],
     focus={"id": "readers", "index": 0})
# L62 New York: lawyers wheel boxes of filings up courthouse steps, cameras on the pavement (street)
room("filing_steps", 62, "steps", street={"w": 52, "d": 36, "kind": "steps", "facades": ["back"], "road": "front"},
     place=[{"what": "newsVan", "n": 2, "at": "kerb"}, {"what": "tvCamera", "n": 2, "at": "plaza", "face": "steps"}],
     groups=[{"form": "procession", "n": 5, "at": "steps-foot", "name": "lawyers", "prop": "box", "o": {"coat": True, "tie": True}},
             {"form": "crowd", "n": 16, "area": "plaza", "poses": ["stand", "phone", "walk"], "name": "passers"}], focus="lawyers")
# L63 + L68 an EV assembly hall: car bodies on a long line, workers both sides
room("ev_hall", 63, "factory", room={"w": 24, "d": 14, "h": 6.4, "floor": "concrete", "windows": 4, "highWindows": True, "doors": [{"wall": "left", "at": 0.8, "w": 3.6, "h": 4}]},
     place=[{"what": "assemblyLine", "name": "evline", "len": 16, "product": "part", "at": [1.0, -0.4], "h": 90}, {"what": "car", "name": "evs", "n": 4, "at": [1.0, 3.2], "spacing": 4.4},
            {"what": "machineTool", "n": 4, "at": "back"}, {"what": "crates", "kind": "crate", "n": 4, "at": "left"}],
     groups=[{"form": "workers", "of": "evline", "name": "crew", "o": {"hat": "cap", "coat": False}}], focus={"id": "evs", "index": 1})

# ================= CH5 The Reverse Deal =================
# L64/66 an EV showroom: cars on the floor, buyers and a salesman, the chapter sign board by the door
room("showroom", 64, room={"w": 16, "d": 10, "h": 4.2, "floor": "tile", "windows": 5, "bigWindows": True, "doors": [{"wall": "left", "at": 0.86, "w": 2.2}]},
     place=[{"what": "car", "name": "cars", "n": 4, "at": "grid", "cols": 2, "gapX": 3.0, "gapZ": 2.4, "off": [0.8, -0.6]}, {"what": "counter", "name": "desk", "len": 3.0, "stools": 2, "at": "back"},
            {"what": "screenStand", "at": "left"}, {"what": "plant", "at": "corner", "n": 3}, title(64, "stand", at=[-5.6, 3.4], h=FRONT, scale=TS)],
     groups=[{"form": "crowd", "n": 6, "area": "aisles", "poses": ["look_down", "point", "stand", "phone", "walk"], "name": "buyers"}],
     people=[{"id": "sales", "pose": "speak", "at": [-1.2, 2.4], "face": 0, "with": "pitch", "o": {"coat": True, "tie": False, "hair": "bun", "skirt": True}},
             {"id": "client", "pose": "stand_hips", "at": [-0.4, 2.7], "face": 200, "with": "pitch", "o": {"coat": True, "hair": "short"}}], focus="pitch")
# L65 1995: a small battery workshop, workers at benches filling trays of phone cells
room("cell_shop", 65, room={"w": 11, "d": 7.5, "h": 2.9, "floor": "concrete", "windows": 3, "doors": [{"wall": "left", "at": 0.84}]},
     place=[{"what": "workbench", "name": "wb", "n": 4, "at": "grid", "cols": 2, "gapX": 2.0, "gapZ": 1.6, "off": [0.6, -0.4]}, {"what": "shelf", "at": "back", "n": 3, "fill": "boxes"},
            {"what": "crates", "kind": "card", "n": 3, "at": "left"}, {"what": "clock", "at": "back"}],
     groups=[{"form": "workers", "of": "wb", "n": 6, "name": "fillers", "o": {"hat": "cap", "coat": False}}],
     people=[{"id": "founder", "pose": "look_down", "prop": "papers", "at": [-3.4, 2.0], "face": 0, "o": {"coat": True, "hair": "short", "build": 0.98}}], focus={"id": "fillers", "index": 1})
# L67 a vast car yard at a port: thousands of new cars in rows, car carriers loading (exterior)
ext("car_yard", 67, {"kind": "coast", "relief": 0.05, "size": 260, "shore": "south"},
    [{"what": "car", "n": 90, "where": "center", "focus": True, "focusIndex": 12, "name": "rows"}, {"what": "quay", "where": "shore", "name": "quay"}, {"what": "containerShip", "n": 1, "where": "sea"},
     {"what": "truck", "n": 5, "where": "near rows"}, {"what": "warehouse", "n": 2, "where": "edge"}, {"what": "gantryCrane", "n": 2, "where": "quay"}], "morning")
# L69 a battery cell plant: long coating lines, workers in caps (room)
room("cell_plant", 69, room={"w": 20, "d": 12, "h": 5.0, "floor": "concrete", "windows": 3, "highWindows": True, "doors": [{"wall": "left", "at": 0.82, "w": 3.0, "h": 3.4}]},
     place=[{"what": "conveyorLine", "name": "coat", "len": 12, "at": [1.0, -1.8], "h": 90}, {"what": "conveyorLine", "name": "stack", "len": 12, "at": [1.0, 1.8], "h": 90},
            {"what": "machineTool", "n": 3, "at": "back"}, {"what": "crates", "kind": "crate", "n": 3, "at": "left"}],
     groups=[{"form": "workers", "of": "coat", "name": "lineA", "o": {"hat": "hard"}}, {"form": "workers", "of": "stack", "name": "lineB", "o": {"hat": "hard"}}], focus={"id": "lineB", "index": 2})
# L70 Michigan: inside the new plant, an American crew learning a licensed process from two visiting engineers
room("mich_floor", 70, room={"w": 18, "d": 11, "h": 5.0, "floor": "concrete", "windows": 3, "highWindows": True, "doors": [{"wall": "left", "at": 0.84, "w": 3.0, "h": 3.4}]},
     place=[{"what": "conveyorLine", "name": "cells", "len": 10, "at": [1.4, -1.2], "h": 90}, {"what": "whiteboard", "name": "wb", "at": "left"},
            {"what": "crates", "kind": "crate", "n": 3, "at": "back"}, {"what": "flag", "at": "back", "n": 1}],
     groups=[{"form": "audience", "n": 6, "at": [-1.8, 2.2], "toward": "wb", "name": "crew", "o": {"hat": "hard", "coat": False}}],
     people=[{"id": "trainer", "char": "visitor", "pose": "point", "at": [-4.2, 1.0], "face": "wb", "o": {"hat": "hard"}}], focus="trainer")

# ================= CH6 The Ladder =================
# L73 1789: a London customs shed, officers opening crates of machine parts at the quay door; the title plaque on the wall
room("customs_shed", 73, room={"w": 14, "d": 9, "h": 4.6, "floor": "wood", "windows": 3, "doors": [{"wall": "left", "at": 0.8, "w": 3.0, "h": 3.2}]},
     place=[{"what": "crates", "name": "held", "kind": "crate", "n": 5, "at": "center", "off": [0.6, -0.4]}, {"what": "spinningFrame", "name": "seized", "len": 3.0, "at": [3.8, 2.4], "h": 0},
            {"what": "table", "name": "ledger", "at": "left", "seats": 1, "len": 1.4}, {"what": "shelf", "at": "back", "n": 2, "fill": "boxes"},
            title(73, "plaque", at="back", w=2.6 * TS, hh=0.9 * TS, y=2.0)],
     groups=[{"form": "huddle", "n": 3, "at": [-1.4, 1.8], "name": "officers", "poses": ["point", "look_down", "stand_arms_crossed"], "o": {"hat": "peak", "coat": True}}],
     focus="officers", light={"time": "morning"})
# L74 a British spinning floor: rows of frames, one young hand watching the machine closely
room("derby_floor", 74, "mill", room={"w": 18, "d": 11, "h": 4.0, "floor": "wood", "windows": 5, "columns": True, "doors": [{"wall": "left", "at": 0.84, "w": 1.4}]},
     people=[{"id": "slater", "char": "slater", "pose": "look_down", "at": [-4.0, 2.6], "face": 0}], focus="slater")
# L75 Rhode Island 1790: a small mill by a river weir, a waterwheel, cottages (exterior)
ext("river_mill", 75, {"kind": "hills", "relief": 0.3, "size": 230, "shore": False},
    [{"what": "mill", "n": 1, "where": "center", "focus": True, "name": "mill"}, {"what": "house", "n": 9, "where": "near mill"}, {"what": "road", "from": "edge:west", "to": "mill", "name": "lane"},
     {"what": "trees", "n": 110, "where": "hills"}, {"what": "people", "n": 4, "where": "near mill"}], "morning", ["birds"])
# L77 a power-loom shed: a visiting merchant in a top coat walks the aisle with the mill owner
room("loom_shed", 77, room={"w": 16, "d": 10, "h": 4.2, "floor": "wood", "windows": 5, "columns": True, "shaft": True, "doors": [{"wall": "left", "at": 0.86}]},
     place=[{"what": "spinningFrame", "name": "looms", "n": 3, "at": "grid", "cols": 3, "len": 6.0, "gapX": 2.4, "h": 0, "off": [1.2, -0.6]}, {"what": "crates", "kind": "crate", "n": 2, "at": "back"}],
     groups=[{"form": "workers", "of": "looms", "n": 6, "name": "weavers", "o": {"coat": False}}],
     people=[{"id": "merchant", "char": "merchant", "pose": "walk", "at": [-3.6, 2.8], "face": 0, "with": "tour"},
             {"id": "owner", "pose": "point", "at": [-2.6, 2.4], "face": 200, "with": "tour", "o": {"coat": True, "hair": "none", "build": 1.25}}], focus="tour")
# L78 an American bookshop, 1840s: shelves of cheap reprints, buyers carrying stacks
room("reprint_shop", 78, room={"w": 10, "d": 7, "h": 3.2, "floor": "wood", "windows": 3, "doors": [{"wall": "left", "at": 0.82}]},
     place=[{"what": "shelf", "at": "back", "n": 4, "fill": "books"}, {"what": "shelf", "at": "left", "n": 2, "fill": "books"}, {"what": "counter", "name": "till", "len": 2.6, "stools": 0, "at": "center", "off": [0.8, -0.6]},
            {"what": "docPile", "at": "near:till"}, {"what": "table", "name": "pile", "seats": 0, "len": 1.6, "at": [-2.0, 1.4]}],
     groups=[{"form": "workers", "of": "till", "n": 1, "name": "bookseller"}, {"form": "crowd", "n": 5, "area": "aisles", "poses": ["carry", "look_down", "walk", "carry", "stand"], "prop": "papers", "name": "readers"}],
     focus={"id": "readers", "index": 0}, light={"time": "afternoon"})
# L79 a British import warehouse, 1887: inspectors checking stamped crates by the door
room("import_shed", 79, room={"w": 15, "d": 10, "h": 5.0, "floor": "concrete", "windows": 2, "highWindows": True, "doors": [{"wall": "left", "at": 0.8, "w": 3.2, "h": 3.6}]},
     place=[{"what": "crates", "name": "goods", "kind": "crate", "n": 6, "at": "center", "off": [0.8, -0.6]}, {"what": "crates", "kind": "crate", "n": 4, "at": "back"},
            {"what": "workbench", "name": "desk", "at": "left"}, {"what": "shelf", "at": "back", "n": 2, "fill": "boxes"}],
     groups=[{"form": "huddle", "n": 2, "at": [-1.6, 2.0], "name": "inspectors", "poses": ["look_down", "point"], "o": {"hat": "peak", "coat": True}},
             {"form": "crowd", "n": 3, "area": "aisles", "poses": ["carry", "carry", "stand"], "prop": "box", "name": "porters"}], focus="inspectors")
# L80 a lecture theatre: an economist at the lectern, students in tiered rows
room("lecture", 80, room={"w": 14, "d": 11, "h": 4.2, "floor": "wood", "windows": 3, "doors": [{"wall": "left", "at": 0.86}]},
     place=[{"what": "lectern", "name": "lectern", "at": "back"}, {"what": "whiteboard", "at": "back"}, {"what": "chairsRows", "name": "seats", "rows": 4, "cols": 10, "aisle": 1.2, "at": "front-of:lectern", "gap": 2.8}],
     groups=[{"form": "podium", "of": "lectern", "n": 1, "name": "economist"}, {"form": "audience", "of": "seats", "n": 24, "name": "students", "poses": ["sit_listen", "sit_type", "sit_lean"]}],
     focus="economist")

# ================= PAYOFF =================
# L87 the end: Shenzhen at dusk from above, towers and the market streets below (exterior, built fresh)
ext("sz_dusk", 87, {"kind": "coast", "relief": 0.12, "size": 260, "shore": "south"},
    [{"what": "tower", "n": 14, "where": "center", "name": "cbd"}, {"what": "electronicsMarket", "n": 1, "where": "near cbd", "focus": True, "name": "hqb"}, {"what": "midrise", "n": 18, "where": "edge"},
     {"what": "road", "from": "edge:west", "to": "edge:east", "name": "avenue"}, {"what": "car", "n": 20, "where": "road"}, {"what": "ferry", "n": 1, "where": "sea"}, {"what": "trees", "n": 50, "where": "edge"}], "evening")

# ================= MG beats: numbers and mechanisms only (all values from script.md / its fact block) =================
MG = []
def beat(id, *parts): MG.append({"id": id, "parts": [{"kind": k, "data": d, **({"role": r} if r else {})} for k, d, r in parts]}); return id
beat("q", ("dominoes", {"chain": [{"label": "Copy phones", "what": "phone"}, {"label": "Phone batteries", "what": "battery"}, {"label": "Electric cars", "what": "car"}, {"label": "Ford licenses it", "what": "documentPage"}],
      "cap": "From copy shop to licensor?", "redIndex": 3, "note": "how?"}, None))
beat("zone", ("insetLocator", {"place": {"n": "Shenzhen", "ll": [114.06, 22.54]}, "detail": [{"n": "Shenzhen", "ll": [114.06, 22.6]}, {"n": "Hong Kong", "ll": [114.17, 22.32]}, {"n": "Huaqiangbei", "ll": [114.085, 22.545]}],
      "span": 0.6, "cap": "Huaqiangbei: about 1.5 km²", "note": "Shenzhen, next to Hong Kong"}, None))
beat("shops", ("objectCounter", {"value": 100000, "unit": "businesses", "per": "in about 1.5 km²", "object": "building", "each": 10000, "cap": "More than 100,000 businesses (approx.)"}, None))
beat("word", ("beforeAfter", {"items": [{"what": "mountain", "before": 3, "after": 0, "label": "Mountain hideouts"}, {"what": "phone", "before": 0, "after": 9, "label": "Knock-off phones"}],
      "beforeLabel": "Old meaning", "afterLabel": "Later meaning", "cap": "Shanzhai: bandit hideout, then knock-offs"}, None))
beat("kit", ("explodedView", {"object": "phone", "parts": [{"label": "Ready-made chip", "what": "chip"}, {"label": "Software", "what": "documentPage"}, {"label": "Screen + case", "what": "phone"}, {"label": "Battery", "what": "battery"}],
      "cap": "Almost a whole phone on one board (~2006)", "focusPart": 0}, None))
beat("output", ("illustratedBars", {"items": [{"label": "2009", "value": 145}, {"label": "2010", "value": 228}], "object": "phone", "each": 25, "unit": "million phones (estimates)",
      "cap": "Knock-off phones made per year", "note": "analysts' estimates"}, None))
beat("half", ("shareRing", {"slices": [{"label": "Foreign carmaker", "value": 50}, {"label": "Chinese partner", "value": 50}], "object": "car", "unit": "of the factory", "cap": "From 1994: at most half"}, None))
beat("rules", ("timelineStrip", {"events": [{"year": 1994, "label": "Foreign share capped at 50%", "what": "padlock"}, {"year": 2018, "label": "Electric car makers: 100% allowed", "what": "battery"},
      {"year": 2022, "label": "Every carmaker: 100% allowed", "what": "car"}], "cap": "Then the rules changed"}, None))
beat("unpaid", ("receipt", {"items": [{"n": "Turbine software orders", "v": 800000000, "qty": "unpaid from 2011"}], "currency": "$", "head": "What went unpaid", "total": "UNPAID (approx.)", "cap": "About $800 million of orders"}, None))
beat("estimate", ("rangeBand", {"min": 0, "max": 700, "unit": " bn", "sources": [{"label": "Low guess", "value": 225, "text": "$225 bn"}, {"label": "High guess", "value": 600, "text": "$600 bn"}],
      "consensus": {"from": 225, "to": 600, "label": "$225–600 bn a year"}, "cap": "What theft of US ideas costs (estimate)", "note": "all countries, very rough"}, None))
beat("gap", ("sizeCircles", {"items": [{"label": "Bottom guess", "value": 225, "object": "coinStack"}, {"label": "Top guess", "value": 600, "object": "coinStack"}], "unit": "$ bn a year", "cap": "Almost three times apart", "redIndex": 1}, None))
beat("indep", ("quoteCard", {"quote": "Developed independently.", "em": "independently", "by": "China's position", "role": "on its fast trains", "cap": "China's answer; no court case followed"}, None))
beat("share_hsr", ("shareRing", {"slices": [{"label": "China", "value": 67}, {"label": "Rest of the world", "value": 33}], "object": "bulletTrain", "unit": "of all high-speed rail", "cap": "More than two thirds"}, None))
beat("run", ("sourceCard", {"value": "≈ $5.6 m", "unit": "the last big training run, in computer time", "source": {"pub": "DeepSeek", "title": "V3 technical report", "year": "2024", "page": "final run only"}, "cap": "The lab's own number"}, None))
beat("measures", ("dumbbellGap", {"rows": [{"label": "Training run (lab)", "a": 0.0056, "b": 0.0056}, {"label": "Computers (research firm guess)", "a": 0.0056, "b": 1.6}], "aLabel": "Lab's figure", "bLabel": "Hardware guess",
      "unit": " bn $", "cap": "Two different measures", "redRow": 1, "note": "approx."}, None))
beat("crash", ("lineEvent", {"values": [100, 99, 92, 86, 84, 83], "labels": ["Fri", "", "", "", "", "Mon close"], "events": [{"at": 5, "label": "−17%: ≈$590 bn gone"}], "unit": "Nvidia value (index)",
      "cap": "27 Jan 2025: one day", "redEvent": 0}, None))
beat("distil", ("feedbackLoop", {"stages": [{"label": "Ask their AI", "what": "laptop"}, {"label": "Save the answer", "what": "documentPage"}, {"label": "Train your own AI", "what": "chip"}],
      "cap": "Distillation", "loopLabel": "question after question", "sign": "+", "laps": "question"}, None))
beat("accounts", ("objectCounter", {"value": 24000, "unit": "fake accounts", "per": "> 16 million exchanges", "object": "laptop", "each": 1000, "cap": "Anthropic's claim, Feb 2026"}, None))
beat("split", ("pictogramRow", {"rows": [{"label": "DeepSeek (≈150,000)", "value": 0.15}, {"label": "Two other labs (the rest)", "value": 15.85}], "object": "documentPage", "each": 1, "unit": "million exchanges (claimed)",
      "cap": "Who it blamed, by its count", "redRow": 0, "note": "a claim, not a finding"}, None))
beat("ev_race", ("rankingSwap", {"rows": [{"label": "Tesla", "v1": 1.79, "v2": 1.64, "object": "car"}, {"label": "BYD", "v1": 1.76, "v2": 2.26, "object": "car"}], "phases": ["2024", "2025"], "unit": "million fully electric cars",
      "cap": "BYD passes Tesla", "redRow": 1}, None))
beat("ev_share", ("shareRing", {"slices": [{"label": "China", "value": 70}, {"label": "Everyone else", "value": 30}], "object": "car", "unit": "of electric cars made", "cap": "About seven in ten"}, None))
beat("pattern2", ("splitAvsB", {"a": {"label": "2004: China", "object": "bulletTrain"}, "b": {"label": "2023: Ford", "object": "battery"}, "rows": [{"label": "Buys the know-how", "a": "from Japan, Germany", "b": "from China"},
      {"label": "Builds its own version", "a": True, "b": "in Michigan"}, {"label": "Who is learning", "a": "China", "b": "America"}], "cap": "The same pattern, reversed"}, None))
beat("britain", ("paperMap", {"region": [-80, 30, 5, 58], "cap": "Ask Britain", "places": [{"n": "Britain", "ll": [-1.5, 52.5], "red": True}, {"n": "America", "ll": [-71.4, 41.8]}],
      "routes": [{"from": "Britain", "to": "America", "mode": "ship", "label": "1789"}], "note": "the first copy shop?"}, None))
beat("copyshop", ("splitAvsB", {"a": {"label": "Shenzhen, 2010", "object": "phone"}, "b": {"label": "America, 1790", "object": "spinningFrame"}, "rows": [{"label": "Copies a rich rival's machines", "a": True, "b": True},
      {"label": "Beyond the rival's law", "a": True, "b": True}, {"label": "Called a copy shop", "a": "by the West", "b": "by Britain"}], "cap": "Who was the copy shop?"}, None))
beat("ladder", ("stepRail", {"steps": [{"label": "Copy the leader", "what": "magnifier"}, {"label": "Build your own", "what": "building"}, {"label": "Get rich", "what": "coinStack"}, {"label": "Tell others not to copy", "what": "padlock"}],
      "cap": "Kicking away the ladder", "note": "his critics disagree"}, None))
beat("law", ("balanceScale", {"left": {"label": "History of copying", "what": "documentPage", "n": 4, "weight": 1}, {"right": None} if False else "right": {"label": "Hacking + stolen code", "what": "padlock", "n": 3, "weight": 2},
      "cap": "Still illegal: courts punished it"}, None))
beat("sum", ("stepRail", {"steps": [{"label": "Bought know-how", "what": "documentPage"}, {"label": "A jury found it stole some", "what": "padlock"}, {"label": "Builds most EVs", "what": "car"}, {"label": "Licenses to Ford", "what": "battery"}],
      "cap": "How the copy shop got here"}, None))

# ================= a visual for every voiced line =================
def W(set, kind, callout=None, subject="focus", **kw):
  v = {"set": set, "subject": subject, "kind": kind}
  if callout: v["callout"] = callout
  v.update(kw); return v
def D(b, f=0): return {"mg": b, "focus": f, "kind": "data"}
LV = {
  1: W("phone_floor", "person", "Huaqiangbei, Shenzhen"), 2: W("phone_floor", "person", "Not made by the brand", subject="counterA"),
  3: W("handset_shop", "person", "Around 2010"), 4: W("mich_plant", "place", "Ford, Michigan"),
  5: W("border_1980", "place", "Shenzhen, 1980"), 6: W("zone_hall", "person", "Aug 1980: special economic zone"), 7: D("zone"), 8: W("hqb_street", "street", "100,000+ businesses"),
  9: D("word"), 10: W("copy_corner", "person", "Shanzhai"), 11: W("design_house", "person", "A Taiwanese chip firm, ~2006"), 12: D("kit"),
  13: W("night_lane", "street", "Two SIMs, torch, TV tuner"), 14: D("output"), 15: W("night_lane", "street", subject="crowd"), 16: W("signing_ball", "person", "Signed contracts"),
  17: W("split_plant", "person", "Half a Factory"), 18: D("half"), 19: W("split_plant", "person", "The partner watches", subject="crewB"), 20: W("shanghai_jv", "place", "Shanghai: VW and GM partners"),
  21: W("trade_conf", "person", "2001: China joins the WTO"), 22: W("probe_office", "person", "2018: US investigation"), 23: W("ministry_brief", "person", "Rejected by China"),
  24: D("rules"), 25: W("vote_hall", "person", "In force 2020: no forced transfer"), 26: W("split_plant", "person", "Decades of watching", subject="watchers"), 27: W("night_copy", "person"),
  28: W("exhibit_room", "person", "Three cases"), 29: W("wind_ridge", "place", "Case 1: a wind turbine"), 30: D("unpaid"), 31: W("vienna_flat", "person", "Austria: an engineer paid"),
  32: W("madison_court", "person", "2018: guilty (US jury)"), 33: W("emptied_floor", "person", "−$1 bn value, ~700 jobs (DOJ)"), 34: W("fab_bay", "person", "Case 2: a memory chip"),
  35: W("sf_court", "person", "Guilty plea: $60m fine", subject="defendants"), 36: W("sf_court", "person", "2024: not guilty", subject="judge"),
  37: W("unit_floor", "person", "Case 3: five officers charged"), 38: W("empty_dock", "person", "Never tried"), 39: D("estimate"), 40: W("commission", "person", "A rough guess"),
  41: D("gap"), 42: W("hsr_yard", "place"),
  43: W("tender_hall", "person", "2004: a tender"), 44: W("hsr_yard", "place", "Kawasaki, then Siemens", subject="local"), 45: W("draw_office", "person", "Share how it's built"),
  46: W("patent_counter", "person", "Chinese patents on fast trains"), 47: D("indep"), 48: W("viaduct_hills", "place", "2017: a new bullet train"), 49: D("share_hsr"),
  50: W("rail_hub", "place", "Buy, then build your own"), 51: W("ai_lab", "person", "Jan 2025: DeepSeek"), 52: D("run"), 53: D("measures"), 54: W("rack_hall", "person", "Hardware not counted"),
  55: D("crash"), 56: W("call_room", "person", "OpenAI to the FT (claim)"), 57: D("distil"), 58: W("log_room", "person", "Anthropic, Feb 2026 (claim)"), 59: D("accounts"),
  60: D("split"), 61: W("ai_lab", "person", "No response", subject="coders"), 62: W("filing_steps", "street", "NYT sues OpenAI, 2023"), 63: W("ev_hall", "person"),
  64: W("showroom", "person", "The Reverse Deal"), 65: W("cell_shop", "person", "1995: phone batteries"), 66: D("ev_race"), 67: W("car_yard", "place", "2 million+ in 2025"),
  68: D("ev_share"), 69: W("cell_plant", "person", "More than a third of EV batteries"), 70: W("mich_floor", "person", "Under licence"), 71: D("pattern2"), 72: D("britain"),
  73: W("customs_shed", "person", "1789: export banned"), 74: W("derby_floor", "person", "A young mill hand"), 75: W("river_mill", "place", "Slater the Traitor"), 76: D("copyshop"),
  77: W("loom_shed", "person", "A Boston merchant, 1810s"), 78: W("reprint_shop", "person", "No US copyright for foreigners until 1891"), 79: W("import_shed", "person", "1887: Made in Germany"),
  80: W("lecture", "person", "Kicking away the ladder"), 81: D("law"), 82: W("night_lane", "street", subject="pitch"),
  83: W("phone_floor", "person", "Huaqiangbei, today", subject="counterA"), 84: D("sum"), 85: W("phone_floor", "person", subject="browsers"), 86: W("mich_plant", "place", "Michigan"),
  87: W("sz_dusk", "place", "Shenzhen", endcard=True),
}
# real evidence photo cards: greyscale matte cards drawn by photo_cards.js; licences + credits in photos.json / credits.txt.
# At most one per line, only on 3D lines (never on MG lines). Captions stay attributed like the narration.
PHOTOS = json.loads((F / "photos.json").read_text(encoding="utf8"))
PHOTO_LINES = {
  1: ("sz_skyline", "Shenzhen today"), 2: ("seg_market", "Inside an electronics market"), 3: ("sz_factory", "Electronics factory, Shenzhen"), 4: ("ford_hq", "Ford HQ, Dearborn, Michigan"),
  5: ("lowu_1982", "Lo Wu border station, 1982"), 6: ("deng_board", "Deng Xiaoping billboard, Shenzhen"), 8: ("hqb_street", "Huaqiangbei, Shenzhen"),
  10: ("fake_phone", "A knock-off phone, 2009"), 11: ("mtk_chip", "A MediaTek phone chip"), 13: ("tv_phone", "Phone with a TV tuner"),
  16: ("santana", "1983 VW Santana, Shanghai"), 20: ("saic_vw", "SAIC Volkswagen HQ, Shanghai"), 21: ("wto_geneva", "WTO headquarters, Geneva"),
  22: ("ustr301", "US trade report, 22 Mar 2018"), 23: ("mofcom", "China's commerce ministry"), 25: ("fil_art22", "Foreign Investment Law, Art. 22"),
  29: ("sinovel", "A Sinovel wind turbine"), 32: ("madison_ct", "US courthouse, Madison"), 33: ("doj", "US Justice Department"),
  34: ("micron_sj", "Micron, San Jose"), 35: ("umc_tower", "UMC building, Hsinchu"), 36: ("sf_court", "US federal court, San Francisco"),
  37: ("fbi_pla", "FBI: five officers charged, 2014"), 38: ("us_steel", "U.S. Steel Tower, Pittsburgh"),
  43: ("crh2", "CRH2, from the 2004 deals"), 44: ("e2_shinkansen", "Japan's E2 Shinkansen"), 45: ("crh3", "CRH3, built on Siemens' Velaro"), 46: ("kawasaki_hq", "Kawasaki HQ, Kobe"),
  48: ("cr400", "CR400 Fuxing trains"), 50: ("hsr_map", "Rail network 2017 (World Bank)"), 54: ("nvidia_hq", "Nvidia HQ, Santa Clara"),
  56: ("openai_sf", "OpenAI's former HQ, San Francisco"), 58: ("ft_london", "Financial Times, London"), 62: ("nyt", "The New York Times"),
  65: ("byd_battery", "A BYD rechargeable battery"), 63: ("tesla_fremont", "New Teslas, Fremont factory"), 67: ("byd_plant", "BYD's Kengzi plant, Shenzhen"),
  69: ("catl_plant", "CATL battery plant"), 70: ("catl_cell", "A CATL LFP battery cell"),
  73: ("water_frame", "Model of a water frame"), 74: ("slater", "Samuel Slater"), 75: ("slater_mill", "Slater Mill, Pawtucket"), 77: ("lowell", "Francis Cabot Lowell"),
  78: ("dickens", "Charles Dickens, 1842"), 79: ("made_in_de", "Made in Germany"), 80: ("chang", "Economist Ha-Joon Chang"), 83: ("hqb_payoff", "Huaqiang Electronics World"),
  86: ("bmc_waltham", None),
}
PHOTO_LINES.pop(86)   # placeholder slot removed: no card on the closing Michigan shot (keeps the end clean)
for n, (pid, cap) in PHOTO_LINES.items():
  assert pid in PHOTOS and PHOTOS[pid].get("licence") and PHOTOS[pid].get("credit"), pid
  assert "set" in LV[n], (n, "photo cards only on 3D lines"); LV[n]["photo"] = {"id": pid, "caption": cap}
assert sorted(LV) == list(range(1, NL + 1)), (NL, sorted(set(range(1, NL + 1)) ^ set(LV)))
for n, v in LV.items():
  if "set" in v and v.get("callout") and DUR.get(n, 0) >= 4.0: v["calloutT"] = round(DUR[n] * 0.5, 2)
# chapter openers: the set's title sign holds through the chgap pause
for n in CHOPEN: assert "set" in LV[n], n; LV[n]["chapterOpen"] = True; LV[n]["title"] = CHOPEN[n][1]
# camera: lines >= 4.45 s get the 2-3 stop reveal (film.html drops stops whose hops break the caps); shorter lines hold one eased move
for n, v in LV.items():
  if "set" in v and v.get("kind") != "place" and v.get("subject") == "focus" and not v.pop("nopath", False) and DUR.get(n, 0) >= 4.45: v["path"] = "reveal"
  v.pop("nopath", None)
plan = {"film": FILM, "seed": seed(0), "v3": True, "endcard": {"name": "Blind Luck Time"}, "cast": CAST, "sets": S, "mg": MG, "lines": {str(k): v for k, v in LV.items()}}
(F / "plan.json").write_text(json.dumps(plan, indent=1, ensure_ascii=False), encoding="utf8")
(F / "sound.json").write_text(json.dumps({"video": f"out/{FILM}.mp4", "beds": "page", "cues": "page", "music": {"moods": "auto", "under": 18, "lift": 3}}), encoding="utf8")
used = {v["set"] for v in LV.values() if "set" in v}; tags = {}
for v in LV.values(): tags[v["kind"]] = tags.get(v["kind"], 0) + 1
print("lines", NL, "sets", len(S), "unused", sorted({s["id"] for s in S} - used), "mg beats", len(MG), "tags", tags, "chapters", {n: c[1] for n, c in CHOPEN.items()}, "photos", len(PHOTO_LINES))
if DUR:
  T = LJ[-1]["end"]; mg = sum(DUR[n] for n, v in LV.items() if "mg" in v); room_t = sum(DUR[n] for n, v in LV.items() if "set" in v and v["kind"] != "place"); world = sum(DUR[n] for n, v in LV.items() if "set" in v)
  print(f"runtime {T:.1f}s  MG {mg / T:.0%}  room+street of world {room_t / world:.0%}  short MG lines", [(n, round(DUR[n], 1)) for n, v in LV.items() if "mg" in v and DUR[n] < 3.5])
