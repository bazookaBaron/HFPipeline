# Producer step for Nvidia v4 (script v4: hook + 6 chapters + payoff). Writes films/nvidia_v4/plan.json (PLAN.v3 = true).
# Rule 0: every set, cast silhouette, layout and MG beat below is designed fresh from the v4 lines; seeds come from "nvidia_v4" + line index.
# Each chapter opens on an in-world title object (sign board / stencilled crate / cabinet tab, FURN.titleSign) placed beside the chapter's
# focus; the line carries chapterOpen=True so film.html hands the picture to that set right after the previous line (title holds through chgap).
# Allegations stay attributed exactly as in script.md. Run: python make_plan_v4.py
import json, pathlib, re, zlib
F = pathlib.Path(__file__).parent
FILM = "nvidia_v4"

# ---------------- script -> lines + chapters ({...} tags stripped, same parse as audio/voice.py) ----------------
src = (F / "script.md").read_text(encoding="utf8")
TXT, CHOPEN, chn, pending = {}, {}, 0, None
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
  "founder":   {"build": 1.0, "hair": "short", "coat": True, "tie": False},          # the founder: dark jacket, open collar
  "partner":   {"build": 0.86, "hair": "long", "coat": False, "skirt": True},        # the Singapore businesswoman
  "cfo":       {"build": 0.92, "hair": "bun", "coat": True, "skirt": False},         # finance chief, interim boss
  "chairman":  {"build": 1.18, "hair": "none", "coat": True, "tie": True},          # long-serving director, first chair
  "president": {"build": 1.32, "hair": "short", "coat": True, "tie": True},
  "agen":      {"build": 1.06, "hair": "short", "coat": True, "tie": True},          # Attorney General
  "officer":   {"build": 1.1, "hair": "none", "coat": False, "tie": False, "hat": "peak"},
  "lawyer":    {"build": 1.02, "hair": "short", "coat": True, "tie": True, "prop": "briefcase"},
  "senator":   {"build": 1.24, "hair": "none", "coat": True, "tie": True},
  "writer":    {"build": 0.95, "hair": "bun", "coat": False},
  "anchor":    {"build": 0.94, "hair": "long", "coat": True},
  "engineer":  {"build": 1.0, "hair": "short", "coat": False, "tie": False},
}

S = []
def room(id, n, type=None, scale=None, **kw):
  s = {"id": id, "seed": seed(n), **({"type": type} if type else {}), **({"scale": scale} if scale else {}), **kw}
  if scale is None and type is None: s["scale"] = "room"
  S.append(s); return id
FRONT = -90   # stand / crate signs: lettering faces +z (the open, camera side of a cut-away room)

# ================= HOOK =================
# L1-2 Sunday night: the founder at his kitchen table at home, writing to the whole company on a laptop
room("home_kitchen", 1, room={"w": 7.0, "d": 5.6, "h": 2.7, "floor": "wood", "windows": 2, "curtains": True, "doors": [{"wall": "left", "at": 0.8}]},
     place=[{"what": "table", "name": "ktable", "at": "center", "seats": 4, "len": 1.8, "off": [0.6, 0.2]}, {"what": "counter", "name": "kitchen", "len": 3.2, "at": "back"},
            {"what": "shelf", "at": "left", "n": 1, "fill": "books"}, {"what": "tableLamp", "at": "corner"} , {"what": "plant", "at": "corner", "n": 2}, {"what": "rug", "at": "under:ktable", "pad": 0.7}],
     people=[{"id": "founder", "char": "founder", "pose": "sit_type", "prop": "laptop", "at": "seat:ktable:0"}], focus="founder", light={"time": "evening"})
# L4 four days later: he walks out across a dark forecourt to a waiting car, a guard at the door
room("exit_forecourt", 4, scale="street", street={"w": 54, "d": 38, "kind": "plaza", "facades": ["back", "left"], "road": "front"},
     place=[{"what": "car", "n": 2, "at": "kerb"}, {"what": "bollard", "n": 6, "at": "plaza"}, {"what": "tree", "n": 3, "at": "plaza"}],
     groups=[{"form": "crowd", "n": 6, "area": "plaza", "poses": ["stand", "look_down", "phone", "stand_arms_crossed"], "name": "late_staff"}],
     people=[{"id": "founder", "char": "founder", "pose": "walk", "prop": "briefcase", "at": [2.5, 6.0], "face": 30},
             {"id": "guard", "pose": "stand_hips", "at": [-3.5, 1.0], "face": 60, "o": {"hat": "peak", "coat": False}}], focus="founder", light={"time": "evening"})

# ================= CH1 Sunday: the letter =================
# L6-7 the office on a Sunday: a handful of staff at their desks reading the letter; the chapter board stands by the entrance
room("sunday_office", 6, room={"w": 13, "d": 9, "h": 3.0, "floor": "carpet", "windows": 4, "doors": [{"wall": "left", "at": 0.86}]},
     place=[{"what": "cluster", "name": "pods", "n": 4, "at": "grid", "cols": 2, "gapX": 2.2, "gapZ": 1.8, "off": [0.6, 0.2]}, {"what": "whiteboard", "at": "left"},
            {"what": "waterCooler", "at": "left"}, {"what": "plant", "at": "corner", "n": 3}, {"what": "filing", "at": "back", "n": 2},
            title(6, "stand", at=[-4.2, 2.6], h=FRONT)],
     groups=[{"form": "table", "of": "pods", "n": 6, "name": "readers", "poses": ["sit_lean", "sit_type", "sit_listen", "sit_lean"]},
             {"form": "huddle", "n": 2, "at": [1.8, 3.0], "name": "pair", "poses": ["look_down", "phone"]}], focus={"id": "readers", "index": 1})
# L8 the board, that same Sunday: directors on a video call around a small conference table, the screen on the wall
room("board_call", 8, room={"w": 8.5, "d": 6.5, "h": 2.9, "floor": "carpet", "windows": 2, "doors": [{"wall": "left", "at": 0.85}]},
     place=[{"what": "roundTable", "name": "rt", "at": "center", "seats": 5, "off": [0.4, -0.3]}, {"what": "screenWall", "name": "callscreen", "at": "back", "nx": 2, "ny": 1},
            {"what": "credenza", "at": "left"}, {"what": "plant", "at": "corner"}, {"what": "clock", "at": "back"}],
     groups=[{"form": "table", "of": "rt", "n": 4, "name": "directors", "poses": ["sit_lean", "sit_listen", "sit_type", "sit_listen"]}], focus={"id": "directors", "index": 0})
# L10-11 1993: the roadside diner, three engineers in a corner booth
room("diner93", 10, "diner", room={"w": 12, "d": 7.5, "h": 3.0, "floor": "tile", "windows": 4, "doors": [{"wall": "back", "at": 0.9, "w": 1.1}]},
     people=[{"id": "e1", "char": "founder", "pose": "sit_lean", "at": "seat:booths:0", "with": "founders"},
             {"id": "e2", "pose": "sit_listen", "at": "seat:booths:1", "with": "founders", "o": {"coat": False, "hair": "short", "build": 1.1}},
             {"id": "e3", "pose": "sit_type", "prop": "papers", "at": "seat:booths:2", "with": "founders", "o": {"coat": True, "hair": "none", "build": 0.95}},
             {"id": "cook", "pose": "stand", "at": [-4.0, -1.0], "face": 0, "o": {"hat": "cap", "coat": False}}],
     addGroups=[{"form": "table", "of": "counter", "n": 3, "name": "regulars"}], focus="founders", light={"time": "afternoon"})
# L13 2012: a university lab, two researchers at a desktop tower with gaming cards
room("uni_lab", 13, "lab", room={"w": 10, "d": 7, "h": 3.1, "floor": "tile", "windows": 3},
     place=[{"what": "labBench", "name": "benches", "n": 3, "at": "grid", "cols": 3, "gapX": 1.4, "off": [0.5, -0.6]}, {"what": "desk", "name": "rig", "at": "front-of:benches", "gap": 1.6, "variant": "papers"},
            {"what": "whiteboard", "at": "left"}, {"what": "shelf", "at": "back", "n": 2, "fill": "boxes"}, {"what": "serverRack", "n": 1, "at": "left"}],
     people=[{"id": "r1", "pose": "sit_type", "at": "seat:rig:0", "with": "researchers", "o": {"coat": False, "hair": "long"}},
             {"id": "r2", "pose": "point", "at": "front-of:rig", "with": "researchers", "o": {"coat": False, "hair": "short"}}],
     groups=[{"form": "workers", "of": "benches", "n": 2, "name": "students"}], focus="researchers")
# L17 governments take an interest: officials around a table with a server board laid on it
room("gov_table", 17, room={"w": 9.5, "d": 7, "h": 3.2, "floor": "wood", "windows": 3, "curtains": True, "doors": [{"wall": "left", "at": 0.84}]},
     place=[{"what": "table", "name": "gtable", "at": "center", "seats": 6, "len": 3.2, "off": [0.5, -0.4]}, {"what": "flag", "at": "back", "n": 2}, {"what": "wallArt", "kind": "seal", "at": "back", "w": 1.0, "h": 1.0, "y": 2.0},
            {"what": "shelf", "at": "left", "n": 2, "fill": "books"}, {"what": "serverRack", "name": "sample", "n": 1, "at": "front-of:gtable", "gap": 1.0}],
     groups=[{"form": "table", "of": "gtable", "n": 5, "name": "officials", "poses": ["sit_lean", "sit_listen", "sit_lean"]},
             {"form": "huddle", "n": 2, "at": [2.6, 1.8], "name": "aides", "poses": ["point", "look_down"]}], focus="aides")

# ================= CH2 The line =================
# L19 a customs warehouse: officers stand beside crates of servers at a painted line; the chapter is stencilled on a crate
room("customs_line", 19, "factory", room={"w": 16, "d": 11, "h": 5.5, "floor": "concrete", "windows": 3, "highWindows": True, "doors": [{"wall": "left", "at": 0.8, "w": 3.2, "h": 3.6}]},
     place=[{"what": "crates", "name": "held", "kind": "crate", "n": 4, "at": "back"}, {"what": "crates", "n": 3, "at": "left"}, {"what": "ropePosts", "name": "theline", "at": [0.5, 0.6], "len": 7.0, "h": 0},
            {"what": "workbench", "name": "desk", "at": [3.5, -2.0]}, {"what": "shelf", "n": 2, "at": "back", "fill": "boxes", "height": 2.4, "w": 1.6},
            title(19, "crate", at=[-2.6, 2.8], h=FRONT)],
     groups=[{"form": "huddle", "n": 3, "at": [-1.0, 1.8], "name": "officers", "poses": ["stand_arms_crossed", "point", "stand"], "o": {"hat": "peak"}},
             {"form": "crowd", "n": 2, "area": "aisles", "poses": ["carry", "carry"], "name": "porters"}], focus={"id": "officers", "index": 1})
# L21 Nvidia's answer: engineers at a bench, modifying a chip for China
room("eng_bench", 21, room={"w": 10, "d": 7.5, "h": 3.0, "floor": "tile", "windows": 0, "doors": [{"wall": "left", "at": 0.85}]},
     place=[{"what": "workbench", "name": "bench", "at": "center", "off": [0.4, -0.4]}, {"what": "labBench", "n": 2, "at": "back"}, {"what": "serverRack", "n": 2, "at": "left"},
            {"what": "screenStand", "at": "near:bench"}, {"what": "crates", "n": 2, "at": "corner"}],
     people=[{"id": "en1", "char": "engineer", "pose": "look_down", "at": "front-of:bench", "with": "engineers"},
             {"id": "en2", "pose": "point", "at": [1.6, 1.4], "face": "bench", "with": "engineers", "o": {"coat": False, "hair": "bun"}}],
     groups=[{"form": "workers", "of": "labBench", "n": 2, "name": "techs"}], focus="engineers")
# L24 a deal: in a government reception room an executive and an official shake hands, aides by the sofas
room("deal_room", 24, room={"w": 9, "d": 7.5, "h": 3.3, "floor": "carpet", "windows": 3, "curtains": True, "doors": [{"wall": "left", "at": 0.86}]},
     place=[{"what": "sofa", "name": "sofaA", "at": "left", "w": 2.0}, {"what": "coffeeTable", "name": "coffee", "at": "front-of:sofaA", "gap": 0.45}, {"what": "desk", "name": "desk", "at": "back", "variant": "lamp"},
            {"what": "flag", "at": "back", "n": 2, "near": "desk"}, {"what": "rug", "at": "center", "pad": 1.2}, {"what": "plant", "at": "corner", "n": 2}],
     people=[{"id": "exec", "pose": "handshake_L", "at": [0.8, 1.4], "face": 0, "with": "deal", "o": {"coat": True, "tie": False, "hair": "short"}},
             {"id": "offi", "pose": "handshake_R", "at": [1.675, 1.4], "face": 180, "with": "deal", "o": {"coat": True, "tie": True, "hair": "none", "build": 1.15}}],
     groups=[{"form": "crowd", "n": 3, "area": [2.6, 1.0, 4.0, 3.2], "poses": ["stand", "applaud", "phone"], "name": "aides"}], focus="deal")
# L26 a loading dock: one kind of crate goes onto a truck, the newest stay fenced off
room("loading_dock", 26, scale="street", street={"w": 52, "d": 36, "kind": "plaza", "facades": ["back", "left"], "road": "front"},
     place=[{"what": "car", "name": "truck", "n": 1, "at": "kerb"}, {"what": "crates", "name": "allowed", "kind": "crate", "n": 3, "at": "plaza"}, {"what": "barrier", "name": "fence", "n": 1, "len": 10, "at": "plaza"},
            {"what": "crates", "name": "banned", "kind": "card", "n": 3, "at": "plaza"}, {"what": "lampPost", "n": 2, "at": "plaza"}],
     groups=[{"form": "crowd", "n": 7, "area": "plaza", "poses": ["carry", "carry", "point", "look_down", "carry"], "name": "loaders"}], focus={"id": "loaders", "index": 0}, light={"time": "morning"})
# L27 the back door: at night two men pass boxes through a side door into a van
room("back_alley", 27, scale="street", street={"w": 40, "d": 30, "kind": "plaza", "facades": ["back", "left"], "road": "front"},
     place=[{"what": "newsVan", "name": "van", "n": 1, "at": "kerb"}, {"what": "crates", "kind": "card", "n": 2, "at": "plaza"}, {"what": "bollard", "n": 3, "at": "plaza"}],
     people=[{"id": "m1", "pose": "carry", "prop": "box", "at": [1.0, 5.0], "face": 80, "with": "smugglers", "o": {"coat": True, "hat": "cap"}},
             {"id": "m2", "pose": "look_down", "at": [2.0, 5.6], "face": 200, "with": "smugglers", "o": {"coat": False, "hair": "short"}}], focus="smugglers", light={"time": "evening"})
# L28 Singapore, 2025: three men charged; a court with no jury, the accused at their table
room("sg_court25", 28, "courtroom", room={"w": 14, "d": 11, "h": 3.6, "floor": "carpet", "windows": 3, "wainscot": True, "doors": [{"wall": "left", "at": 0.86, "w": 1.6}]},
     place=[{"what": "judgeBench", "name": "bench", "at": "back", "focusable": True}, {"what": "flag", "at": "back", "n": 1, "near": "bench"}, {"what": "clock", "at": "left"},
            {"what": "witnessTable", "name": "dock", "seats": 3, "at": "front-of:bench", "lat": 1.6, "gap": 2.6, "face": "bench"},
            {"what": "witnessTable", "name": "crown", "seats": 2, "at": "front-of:bench", "lat": -2.4, "gap": 2.6, "face": "bench"},
            {"what": "chairsRows", "name": "gallery", "rows": 2, "cols": 8, "aisle": 1.0, "at": "front", "near": [0.5, 0]}, {"what": "shelf", "at": "left", "n": 2, "fill": "books"}],
     groups=[{"form": "table", "of": "bench", "n": 1, "name": "judge"}, {"form": "table", "of": "dock", "n": 3, "name": "accused", "poses": ["sit_listen", "sit", "sit_lean"]},
             {"form": "table", "of": "crown", "n": 2, "name": "prosecutors"}, {"form": "audience", "of": "gallery", "n": 9, "name": "public"}], focus="accused")
# L29 remember Singapore: a waterfront promenade at dusk, commuters along the rail
room("sg_promenade", 29, scale="street", street={"w": 58, "d": 36, "kind": "plaza", "facades": ["back", "left"], "road": "front"},
     place=[{"what": "tree", "n": 6, "at": "plaza"}, {"what": "bench", "n": 3, "at": "plaza"}, {"what": "lampPost", "n": 3, "at": "plaza"}, {"what": "busStop", "at": "kerb"}],
     groups=[{"form": "crowd", "n": 30, "area": "plaza", "poses": ["walk", "walk", "phone", "stand", "carry"], "mode": "plaza", "name": "commuters"}], focus={"id": "commuters", "index": 4}, light={"time": "evening"})

# ================= CH3 The Singapore partner =================
# L30 dusk outside a data-centre building: she walks toward the entrance; the company's board sign carries the chapter title
room("dc_entrance", 30, scale="street", street={"w": 50, "d": 36, "kind": "plaza", "facades": ["back", "left"], "road": "front"},
     place=[{"what": "car", "n": 2, "at": "kerb"}, {"what": "tree", "n": 3, "at": "plaza"}, {"what": "bollard", "n": 5, "at": "plaza"},
            title(30, "stand", at=[-1.2, 4.2], h=FRONT, scale=2.2, y=0.6)],
     groups=[{"form": "crowd", "n": 5, "area": "plaza", "poses": ["walk", "phone", "stand"], "name": "passers"}],
     people=[{"id": "partner", "char": "partner", "pose": "walk", "prop": "phone", "at": [2.0, 5.2], "face": 250}], focus="partner", light={"time": "evening"})
# L31 the server hall: technicians between rack rows, she points out a row
room("partner_hall", 31, room={"w": 16, "d": 10, "h": 3.6, "floor": "tile", "windows": 0, "doors": [{"wall": "left", "at": 0.88}]},
     place=[{"what": "serverRack", "name": "racks", "n": 10, "at": "grid", "cols": 5, "rowsN": 2, "gapX": 1.1, "gapZ": 2.6, "h": 0, "off": [0.6, -1.0]},
            {"what": "desk", "name": "noc", "at": "front", "variant": "papers"}, {"what": "crates", "n": 2, "at": "left"}, {"what": "filing", "at": "back", "n": 1}],
     people=[{"id": "partner", "char": "partner", "pose": "point", "at": [-1.0, 2.6], "face": 300}],
     groups=[{"form": "crowd", "n": 4, "area": "aisles", "poses": ["look_down", "carry", "stand", "phone"], "name": "techs"}], focus="partner")
# L33 US officials noticed: Commerce staff gathered at a wall chart of purchases
room("commerce_room", 33, room={"w": 10, "d": 7.5, "h": 3.0, "floor": "carpet", "windows": 2, "doors": [{"wall": "left", "at": 0.85}]},
     place=[{"what": "whiteboard", "name": "chart", "at": "back"}, {"what": "deskRow", "name": "rows", "n": 2, "at": "grid", "cols": 2, "rowsN": 1, "per": 3, "gapX": 1.4, "h": 0, "off": [0.4, 1.0]},
            {"what": "filing", "at": "left", "n": 3}, {"what": "docPile", "at": "left"}, {"what": "flag", "at": "back", "n": 1}],
     groups=[{"form": "crowd", "n": 4, "area": [-2.0, -2.4, 2.0, -1.0], "toward": "chart", "poses": ["point", "stand_arms_crossed", "look_down", "stand"], "name": "analysts"},
             {"form": "table", "of": "rows", "n": 3, "name": "clerks"}], focus={"id": "analysts", "index": 0})
# L35 inspectors with clipboards around opened server crates in a bay (the company says inspections found nothing)
room("inspect_bay", 35, room={"w": 13, "d": 9, "h": 4.6, "floor": "concrete", "windows": 2, "highWindows": True, "doors": [{"wall": "left", "at": 0.8, "w": 3.0, "h": 3.4}]},
     place=[{"what": "crates", "name": "opened", "kind": "crate", "n": 3, "at": "center", "off": [0.6, -0.4]}, {"what": "serverRack", "n": 3, "at": "back"}, {"what": "shelf", "n": 2, "at": "left", "fill": "boxes"},
            {"what": "workbench", "at": "back"}],
     groups=[{"form": "huddle", "n": 3, "at": [0.4, 1.6], "name": "inspectors", "poses": ["look_down", "look_down", "point"], "prop": "papers"},
             {"form": "crowd", "n": 2, "area": "aisles", "poses": ["stand_arms_crossed", "stand"], "name": "staff"}], focus={"id": "inspectors", "index": 0})
# L36 an interview room: an officer holds her passport across a bare table
room("interview", 36, room={"w": 6.5, "d": 5.5, "h": 2.8, "floor": "tile", "windows": 1, "doors": [{"wall": "left", "at": 0.8}]},
     place=[{"what": "table", "name": "itable", "at": "center", "seats": 2, "len": 1.4}, {"what": "filing", "at": "back", "n": 2}, {"what": "clock", "at": "back"}, {"what": "chair", "at": "corner"}],
     people=[{"id": "officer", "char": "officer", "pose": "sit_lean", "prop": "papers", "at": "seat:itable:0", "with": "interview"},
             {"id": "partner", "char": "partner", "pose": "sit_listen", "at": "seat:itable:1", "with": "interview"},
             {"id": "witness", "pose": "stand_arms_crossed", "at": [-2.2, -1.6], "face": 30, "o": {"coat": True, "tie": True}}], focus="interview")
# L37 the photos: an evening reception on a terrace, the founder and the businesswoman standing together, photographers
room("terrace_gala", 37, scale="street", street={"w": 48, "d": 34, "kind": "plaza", "facades": ["back", "left"], "road": "front"},
     place=[{"what": "tree", "n": 4, "at": "plaza"}, {"what": "tvCamera", "n": 1, "at": "plaza"}, {"what": "lampPost", "n": 2, "at": "plaza"}],
     groups=[{"form": "crowd", "n": 22, "area": "plaza", "poses": ["stand", "stand", "phone", "applaud"], "name": "guests"},
             {"form": "crowd", "n": 3, "area": [-3, 6.5, 3, 8.0], "poses": ["kneel", "kneel", "look_down"], "prop": "camera", "name": "photographers"}],
     people=[{"id": "founder", "char": "founder", "pose": "stand", "at": [-0.5, 4.2], "face": 90, "with": "pair"},
             {"id": "partner", "char": "partner", "pose": "stand", "at": [0.55, 4.2], "face": 90, "with": "pair"}], focus="pair", light={"time": "evening"})
# L38 the Times newsroom, 29 October: reporters at pods, an editor with a printout
room("times_newsroom", 38, "newsroom", room={"w": 15, "d": 11, "h": 3.2, "floor": "concrete", "windows": 5, "doors": [{"wall": "left", "at": 0.9}]},
     people=[{"id": "editor", "char": "writer", "pose": "look_down", "prop": "papers", "at": [3.0, 2.6], "face": 200}], focus="editor")
# L40 the secret memo: in a secure office an official slides a folder across the desk to a colleague
room("memo_office", 40, room={"w": 7.5, "d": 6, "h": 2.9, "floor": "carpet", "windows": 0, "doors": [{"wall": "left", "at": 0.84}]},
     place=[{"what": "desk", "name": "mdesk", "at": "back", "variant": "papers"}, {"what": "filing", "name": "safe", "at": "left", "n": 3, "drawers": 4}, {"what": "flag", "at": "back", "n": 1},
            {"what": "wallArt", "kind": "seal", "at": "back", "w": 0.9, "h": 0.9, "y": 1.9}, {"what": "docPile", "at": "left"}],
     people=[{"id": "o1", "pose": "sit_type", "prop": "papers", "at": "seat:mdesk:0", "with": "memo", "o": {"coat": True, "tie": True, "hair": "none"}},
             {"id": "o2", "pose": "look_down", "at": "front-of:mdesk", "with": "memo", "o": {"coat": True, "hair": "bun", "skirt": True}}], focus="memo")

# ================= CH4 Monday to Wednesday =================
# L43 / L45 Monday: the President with reporters on a lawn driveway; the press-area sign carries the chapter title
room("lawn_scrum", 43, scale="street", street={"w": 56, "d": 40, "kind": "plaza", "facades": ["back"], "road": "front"},
     place=[{"what": "tree", "n": 5, "at": "plaza"}, {"what": "car", "n": 3, "at": "kerb"}, {"what": "tvCamera", "n": 3, "at": "plaza"},
            title(43, "stand", at=[-5.0, 5.2], h=FRONT, scale=2.2, y=0.6)],
     groups=[{"form": "podium", "at": [0, 3.0], "h": 90, "n": 14, "name": "scrum", "speakerChar": "president"},
             {"form": "crowd", "n": 6, "area": "plaza", "poses": ["stand", "phone", "stand_arms_crossed"], "name": "staffers"}], focus="scrum.speaker", light={"time": "noon"})
# L46 the class action: shareholders' lawyers carry file boxes up the courthouse steps
room("suit_steps4", 46, "steps", street={"w": 58, "d": 40, "kind": "steps", "facades": ["back", "left"], "road": "front"},
     groups=[{"form": "procession", "n": 5, "at": "steps-foot", "name": "plaintiffs", "o": {"coat": True, "tie": True, "prop": "box"}},
             {"form": "crowd", "n": 18, "area": "plaza", "poses": ["stand", "phone", "walk"], "name": "onlookers"}], focus={"id": "plaintiffs", "index": 0}, light={"time": "morning"})
# L47 a tech news site: a writer types the $7.5 bn claim, two colleagues read over her shoulder
room("tech_site", 47, room={"w": 8, "d": 6.5, "h": 2.8, "floor": "concrete", "windows": 3, "doors": [{"wall": "left", "at": 0.85}]},
     place=[{"what": "desk", "name": "wdesk", "at": "center", "variant": "papers", "off": [0.4, -0.2]}, {"what": "sofa", "at": "left", "w": 1.8}, {"what": "shelf", "at": "back", "n": 2, "fill": "mixed"},
            {"what": "plant", "at": "corner", "n": 2}, {"what": "wallArt", "kind": "chart", "at": "back", "n": 1}],
     people=[{"id": "writer", "char": "writer", "pose": "sit_type", "prop": "laptop", "at": "seat:wdesk:0"}],
     groups=[{"form": "huddle", "n": 2, "at": [1.4, 1.2], "name": "colleagues", "poses": ["look_down", "stand_arms_crossed"]}], focus="writer")
# L49 Tuesday: the board's outside lawyers, a former prosecutor at the head of a library table
room("law_library", 49, room={"w": 9.5, "d": 7, "h": 3.2, "floor": "wood", "windows": 3, "doors": [{"wall": "left", "at": 0.86}]},
     place=[{"what": "table", "name": "ltable", "at": "center", "seats": 8, "len": 3.6}, {"what": "shelf", "at": "back", "n": 3, "fill": "books"}, {"what": "shelf", "at": "left", "n": 2, "fill": "books"},
            {"what": "rug", "at": "under:ltable", "pad": 0.6}, {"what": "plant", "at": "corner"}],
     people=[{"id": "lead", "char": "lawyer", "pose": "speak", "at": "end:ltable:1"}],
     groups=[{"form": "table", "of": "ltable", "n": 5, "name": "associates", "poses": ["sit_type", "sit_listen", "sit_lean"]}], focus="lead")
# L50 a bad week: associates wheel in boxes of files and stack them in a records room
room("records_room", 50, room={"w": 10, "d": 7, "h": 2.9, "floor": "carpet", "windows": 1, "doors": [{"wall": "left", "at": 0.84}]},
     place=[{"what": "shelf", "n": 4, "at": "back", "fill": "boxes", "height": 2.4}, {"what": "boxes", "kind": "card", "n": 4, "at": "center", "off": [0.4, 0.4]}, {"what": "filing", "at": "left", "n": 4},
            {"what": "docPile", "at": "left"}],
     groups=[{"form": "crowd", "n": 4, "area": [-2.5, 0.5, 3.0, 2.6], "poses": ["carry", "carry", "look_down", "carry"], "prop": "box", "name": "associates"}], focus={"id": "associates", "index": 0})
# L52 nobody confirms: reporters on phones at a row of desks
room("phone_bank", 52, "trollfarm", room={"w": 12, "d": 8.5, "h": 2.8, "floor": "tile", "windows": 3, "doors": [{"wall": "left", "at": 0.9}]},
     groups=[{"form": "table", "of": "rows", "n": 14, "name": "callers", "poses": ["phone", "phone", "sit_type", "phone"]},
             {"form": "crowd", "n": 2, "area": "aisles", "poses": ["phone", "stand_arms_crossed"], "name": "deskeds"}], focus={"id": "callers", "index": 2})
# L53 Wednesday: the board accepts the resignation by a show of hands
room("board_hands", 53, "boardroom", room={"w": 10, "d": 7.5, "h": 3.1, "floor": "wood", "windows": 4, "doors": [{"wall": "left", "at": 0.82}]},
     groups=[{"form": "table", "of": "table", "n": 9, "name": "board", "poses": ["raise_hand", "raise_hand", "sit_listen", "raise_hand", "sit"]}], focus={"id": "board", "index": 0})
# L54 Thursday morning: commuters stop under a big public screen on a city square
room("screen_square", 54, scale="street", street={"w": 56, "d": 38, "kind": "plaza", "facades": ["back", "left"], "road": "front"},
     place=[{"what": "screenWall", "name": "bigscreen", "at": [0, 1.5], "nx": 4, "ny": 3, "h": 0}, {"what": "busStop", "at": "kerb"}, {"what": "tree", "n": 3, "at": "plaza"}],
     groups=[{"form": "crowd", "n": 24, "area": "plaza", "toward": "bigscreen", "poses": ["stand", "phone", "stand", "look_down", "walk"], "name": "watchers"}], focus={"id": "watchers", "index": 3}, light={"time": "morning"})

# ================= CH5 Thursday: the bill =================
# L55 the trading floor under the price board; the chapter plaque hangs by the board
room("trade_floor4", 55, "trading", room={"w": 17, "d": 12, "h": 3.4, "floor": "carpet", "windows": 2, "doors": [{"wall": "left", "at": 0.9}]},
     addPlace=[title(55, "stand", at=[-5.4, 3.4], h=FRONT)],
     groups=[{"form": "table", "of": "desks", "n": 30, "name": "traders", "poses": ["phone", "sit_type", "phone", "sit_lean", "sit"]}, {"form": "crowd", "n": 4, "area": "aisles", "poses": ["point", "phone", "stand_arms_crossed"], "name": "floor"}],
     focus={"id": "floor", "index": 0})
# L57 priced live: a TV business desk, the anchor in front of a wall of market screens
room("biz_studio", 57, room={"w": 10, "d": 7.5, "h": 3.4, "floor": "concrete", "windows": 0, "doors": [{"wall": "left", "at": 0.85}]},
     place=[{"what": "screenWall", "at": "back", "nx": 4, "ny": 2}, {"what": "newsDesk", "name": "adesk", "at": "center", "off": [0.2, -0.8]}, {"what": "tvCamera", "n": 2, "at": "front-of:adesk", "gap": 2.4, "face": "adesk"},
            {"what": "plant", "at": "corner"}],
     people=[{"id": "anchor", "char": "anchor", "pose": "sit_lean", "prop": "papers", "at": "seat:adesk:0"}],
     groups=[{"form": "workers", "of": "tvCamera", "name": "crew"}], focus="anchor")
# L59 the finance chief, now also interim boss, addresses staff in an atrium
room("atrium_hall", 59, room={"w": 15, "d": 10, "h": 4.2, "floor": "wood", "windows": 5, "doors": [{"wall": "left", "at": 0.9}]},
     place=[{"what": "podium", "name": "podium", "at": "back", "riser": 0.2, "mics": 1, "wallGap": 1.2}, {"what": "plant", "at": "corner", "n": 3}, {"what": "bench", "n": 2, "at": "left"}],
     groups=[{"form": "podium", "of": "podium", "n": 0, "name": "cfo", "speakerChar": "cfo"},
             {"form": "crowd", "n": 24, "area": "front-of:podium", "gap": 2.0, "poses": ["stand", "stand_arms_crossed", "applaud", "phone", "stand"], "name": "staff"}], focus="cfo.speaker")
# L60 the first chairman: a long-serving director greeted by colleagues in the executive corridor
room("chair_corridor", 60, room={"w": 11, "d": 6, "h": 3.0, "floor": "carpet", "windows": 3, "doors": [{"wall": "left", "at": 0.86}]},
     place=[{"what": "wallArt", "kind": "photo", "at": "back", "n": 3}, {"what": "credenza", "at": "back"}, {"what": "plant", "at": "corner", "n": 2}, {"what": "sofa", "at": "left", "w": 1.8}],
     people=[{"id": "chair", "char": "chairman", "pose": "handshake_L", "at": [0.4, 1.0], "face": 0, "with": "greet"},
             {"id": "dir2", "pose": "handshake_R", "at": [1.275, 1.0], "face": 180, "with": "greet", "o": {"coat": True, "hair": "bun", "skirt": True}}],
     groups=[{"form": "crowd", "n": 3, "area": [2.2, 0.0, 4.2, 2.2], "poses": ["applaud", "stand", "applaud"], "name": "colleagues"}], focus="greet")
# L62 the President posts from his desk, aides waiting
room("pres_desk", 62, room={"w": 8.5, "d": 7, "h": 3.3, "floor": "carpet", "windows": 3, "curtains": True, "doors": [{"wall": "left", "at": 0.86}]},
     place=[{"what": "desk", "name": "pdesk", "at": "center", "variant": "lamp", "off": [0.2, -1.2]}, {"what": "flag", "at": "back", "n": 2}, {"what": "rug", "at": "center", "pad": 1.0},
            {"what": "chair", "style": "arm", "n": 2, "at": "front-of:pdesk", "gap": 1.0}, {"what": "shelf", "at": "left", "n": 1, "fill": "books"}],
     people=[{"id": "president", "char": "president", "pose": "sit_type", "prop": "phone", "at": "seat:pdesk:0"}],
     groups=[{"form": "huddle", "n": 2, "at": [2.6, 1.6], "name": "aides", "poses": ["stand", "look_down"]}], focus="president")
# L63 headlines: a corner newsstand, people reading the papers
room("newsstand", 63, scale="street", street={"w": 46, "d": 32, "kind": "market", "facades": ["back", "left"], "road": "front"},
     place=[{"what": "stall", "name": "kiosk", "n": 2, "at": "aisle"}, {"what": "bench", "n": 1, "at": "plaza"}, {"what": "lampPost", "n": 2, "at": "plaza"}],
     groups=[{"form": "workers", "of": "stall", "name": "vendor"}, {"form": "crowd", "n": 10, "area": "aisle", "poses": ["look_down", "stand", "walk", "look_down"], "prop": "papers", "name": "readers"}],
     focus={"id": "readers", "index": 1}, light={"time": "afternoon"})

# ================= CH6 Proven versus alleged =================
# L64 / L67 the evidence room: clerks sort folders onto two long tables; the chapter title is the tab on the cabinet
room("evidence_room", 64, room={"w": 12, "d": 8, "h": 3.0, "floor": "tile", "windows": 2, "doors": [{"wall": "left", "at": 0.86}]},
     place=[{"what": "table", "name": "proven", "at": [-2.4, -0.4], "seats": 4, "len": 3.0, "h": 0}, {"what": "table", "name": "alleged", "at": [2.6, -0.4], "seats": 4, "len": 3.0, "h": 0},
            {"what": "tableLamp", "n": 0, "at": "corner"}, {"what": "shelf", "n": 2, "at": "back", "fill": "boxes"}, {"what": "docPile", "at": "back"},
            title(64, "cabinet", at="left", w=1.6, hh=0.42)],
     groups=[{"form": "table", "of": "proven", "n": 3, "name": "clerksA", "poses": ["sit_type", "sit_lean", "sit_type"]},
             {"form": "table", "of": "alleged", "n": 3, "name": "clerksB", "poses": ["sit_listen", "sit_type", "sit_lean"]},
             {"form": "crowd", "n": 1, "area": [-0.6, 1.2, 0.6, 2.0], "poses": ["carry"], "prop": "papers", "name": "runner"}], focus={"id": "clerksA", "index": 0})
# L70 the Attorney General on the Justice Department steps: no conclusion
room("doj_steps4", 70, "steps", street={"w": 60, "d": 42, "kind": "steps", "facades": ["back", "left"], "road": "front"},
     groups=[{"form": "podium", "at": "steps-foot", "n": 12, "name": "scrum", "speakerChar": "agen"},
             {"form": "crowd", "n": 20, "area": "plaza", "poses": ["stand", "phone", "stand_arms_crossed"], "name": "onlookers"}], focus="scrum.speaker", light={"time": "overcast"})
# L71 the board's statement: a spokesperson reads it to staff at a small lectern in the lobby
room("lobby_statement", 71, room={"w": 12, "d": 8, "h": 4.0, "floor": "tile", "windows": 4, "doors": [{"wall": "left", "at": 0.88, "w": 1.8}]},
     place=[{"what": "podium", "name": "lect", "at": "back", "riser": 0, "mics": 2, "wallGap": 1.6}, {"what": "counter", "name": "reception", "len": 3.0, "at": "left"}, {"what": "plant", "at": "corner", "n": 3},
            {"what": "bench", "n": 1, "at": "front"}],
     groups=[{"form": "podium", "of": "lect", "n": 0, "name": "spokes", "speakerChar": "lawyer"},
             {"form": "crowd", "n": 12, "area": "front-of:lect", "gap": 1.8, "poses": ["stand", "stand_arms_crossed", "phone", "look_down"], "name": "staff"}], focus="spokes.speaker")
# L73 the Senate banking committee: the chair speaks, the two witness chairs wait empty
room("senate_bank", 73, "hearing", room={"w": 16, "d": 12, "h": 4.2, "floor": "carpet", "windows": 0, "wainscot": True, "doors": [{"wall": "left", "at": 0.88, "w": 1.6}]},
     place=[{"what": "dais", "name": "dais", "seats": 9, "at": "back"}, {"what": "flag", "at": "back", "n": 2, "near": "dais"},
            {"what": "witnessTable", "name": "witnessTable", "seats": 2, "at": "front-of:dais", "gap": -2.4},
            {"what": "chairsRows", "name": "gallery", "rows": 2, "cols": 9, "aisle": 1.2, "at": "behind:witnessTable", "gap": 1.4, "alt": "front"}],
     people=[{"id": "chairS", "char": "senator", "pose": "speak", "at": "seat:dais:4"}],
     groups=[{"form": "table", "of": "dais", "n": 6, "name": "members"}, {"form": "audience", "of": "gallery", "n": 10, "name": "public"}], focus="chairS")
# L74 the earnings call: the interim boss and the finance team at a table under the call screen
room("earnings4", 74, room={"w": 9, "d": 7, "h": 3.0, "floor": "wood", "windows": 2, "doors": [{"wall": "left", "at": 0.85}]},
     place=[{"what": "boardroomTable", "name": "etable", "at": "center", "seats": 6}, {"what": "screenWall", "at": "back", "nx": 3, "ny": 1}, {"what": "plant", "at": "corner", "n": 2}, {"what": "credenza", "at": "left"}],
     people=[{"id": "cfo", "char": "cfo", "pose": "sit_lean", "at": "seat:etable:0"}],
     groups=[{"form": "table", "of": "etable", "n": 4, "name": "finance", "poses": ["sit_type", "sit_listen", "sit_type"]}], focus="cfo")
# L75 someone has to check: a port container yard, an inspector with a clipboard at an opened container
room("port_check", 75, scale="street", street={"w": 54, "d": 38, "kind": "plaza", "facades": ["back"], "road": "front"},
     place=[{"what": "crates", "name": "stack", "kind": "crate", "n": 4, "at": "plaza"}, {"what": "car", "name": "truck", "n": 2, "at": "kerb"}, {"what": "barrier", "n": 1, "len": 8, "at": "plaza"}],
     people=[{"id": "insp", "char": "officer", "pose": "look_down", "prop": "papers", "at": [0.5, 4.5], "face": 120}],
     groups=[{"form": "crowd", "n": 4, "area": "plaza", "poses": ["carry", "point", "stand"], "name": "dockers"}], focus="insp", light={"time": "afternoon"})

# ================= PAYOFF =================
# L76 Santa Clara at night: the headquarters forecourt, a few late workers, a guard
room("hq_late", 76, scale="street", street={"w": 58, "d": 40, "kind": "plaza", "facades": ["back", "left"], "road": "front"},
     place=[{"what": "tree", "n": 6, "at": "plaza"}, {"what": "bench", "n": 2, "at": "plaza"}, {"what": "lampPost", "n": 3, "at": "plaza"}],
     groups=[{"form": "crowd", "n": 4, "area": "plaza", "poses": ["walk", "phone", "walk", "carry"], "name": "late"}],
     people=[{"id": "guard", "pose": "stand", "at": [-2.0, 3.0], "face": 80, "o": {"hat": "peak", "coat": True}}], focus="guard", light={"time": "evening"})
# L78 final: the campus from above at dusk, the endcard row over it (exterior composer set, built fresh)
S.append({"id": "campus_dusk", "seed": seed(78), "ground": {"kind": "plain", "seed": seed(78, "g"), "relief": 0.14, "size": 250, "shore": False},
          "place": [{"what": "campus", "where": "center", "focus": True, "name": "hq"}, {"what": "road", "from": "edge:south", "to": "hq", "name": "drive"}, {"what": "car", "n": 6, "where": "road"},
                    {"what": "trees", "n": 120, "where": "edge"}, {"what": "midrise", "n": 9, "where": "edge"}, {"what": "town", "n": 30, "where": "edge"}],
          "light": {"time": "evening"}})

# ================= MG beats: numbers and mechanisms only (all values from script.md / its fact block) =================
MG = []
def beat(id, *parts): MG.append({"id": id, "parts": [{"kind": k, "data": d, **({"role": r} if r else {})} for k, d, r in parts]}); return id
beat("letter", ("annotatedDoc", {"head": "A Message to Our Company", "ref": "Letter to staff, Sun 8 Nov", "cap": "What the letter says", "body": [
      {"t": "An admission: he was unfaithful to his wife.", "hi": 1, "note": "personal"}, {"t": "A mention of national security concerns, not explained.", "hi": 2, "note": "unexplained"}]}, None))
beat("fivedays", ("calendarCountdown", {"days": 5, "startDay": 8, "month": "NOV", "label": "days in charge", "what": "building", "cap": "Sunday letter to Thursday exit", "tally": True}, None))
beat("folders", ("vennOverlap", {"sets": [{"label": "Personal apology"}, {"label": "Security warning"}], "items": [{"what": "documentPage", "in": [0], "label": "Infidelity"},
      {"what": "padlock", "in": [1], "label": "Security"}, {"what": "documentPage", "in": [0, 1], "label": "This letter"}], "cap": "Two folders, one letter"}, None))
beat("gpu99", ("splitAvsB", {"a": {"label": "Ordinary chip", "object": "laptop"}, "b": {"label": "GPU, 1999", "object": "gpu"}, "rows": [{"label": "Small sums at once", "a": "a few", "b": "thousands"},
      {"label": "Draws a game frame fast", "a": False, "b": True}], "cap": "GeForce 256: sold as the first GPU", "note": "parallel sums"}, None))
beat("training", ("feedbackLoop", {"stages": [{"label": "Guess", "what": "ai"}, {"label": "Check the answer", "what": "magnifier"}, {"label": "Adjust", "what": "gpu"}], "cap": "Teaching an AI: the same small sums",
      "loopLabel": "billions of times", "sign": "+", "laps": "pass"}, None))
beat("share", ("rangeBand", {"min": 0, "max": 100, "unit": "%", "sources": [{"label": "Analysts, low", "value": 80, "text": "80%"}, {"label": "Analysts, high", "value": 90, "text": "90%"}],
      "consensus": {"from": 80, "to": 90, "label": "80 to 90%"}, "cap": "Nvidia's share of AI chips (estimates)", "note": "estimates, not filings"}, None))
beat("worth", ("odometer", {"value": 5, "from": 0, "unit": "trillion dollars", "per": "market value, Oct 2025", "object": "coinStack", "cap": "From a diner booth", "note": "first company past $5 tn"}, None))
beat("line22", ("paperMap", {"region": [70, 0, 150, 50], "cap": "October 2022: a line on the map", "places": [{"n": "China", "ll": [110, 33], "red": True}, {"n": "Taiwan", "ll": [121, 23.7]},
      {"n": "Singapore", "ll": [103.8, 1.35]}], "routes": [{"from": "Taiwan", "to": "China", "mode": "plane", "red": True, "label": "advanced AI chips: banned"}], "note": "top chips can't cross"}, None))
beat("why22", ("dominoes", {"chain": [{"label": "Advanced AI chips", "what": "gpu"}, {"label": "Military computers", "what": "server"}, {"label": "Weapons design", "what": "warship"}, {"label": "Mass surveillance", "what": "magnifier"}],
      "cap": "The US government's stated reason", "redIndex": 0, "note": "as stated in 2022"}, None))
beat("linemoved", ("thermoScale", {"value": 35, "min": 0, "max": 100, "unit": "", "markers": [{"at": 70, "label": "2022 limit"}, {"at": 45, "label": "2023 limit"}], "cap": "The line moves; the China chip shrinks",
      "object": "gpu", "note": "China-only version"}, None))
beat("licence", ("stampedPermit", {"title": "Export licence", "no": "April 2025", "fields": [{"k": "Item", "v": "China-only chip"}, {"k": "Destination", "v": "China"}, {"k": "Possible cost", "v": "up to $5.5 bn"}],
      "checks": ["Special permission", "US Commerce review"], "sign": "-", "stamp": "LICENCE REQUIRED", "cap": "Even the weaker chip needs permission"}, None))
beat("cut15", ("receipt", {"head": "One China chip sale", "currency": "$", "items": [{"n": "Sale price", "v": 100}, {"n": "Cut to the US government", "v": -15}], "total": "NVIDIA KEEPS", "cap": "The deal: 15% to the government"}, None))
beat("dec25", ("splitAvsB", {"a": {"label": "Stronger chip", "object": "gpu"}, "b": {"label": "Newest chips", "object": "server"}, "rows": [{"label": "Sale to China", "a": True, "b": False},
      {"label": "Cut to the government", "a": "bigger", "b": "-"}], "cap": "December 2025", "note": "newest stay banned"}, None))
beat("gear", ("manifest", {"vessel": "Partner orders", "route": "Nvidia to Singapore + Malaysia", "lines": [{"what": "gpu", "n": "Nvidia chips and servers", "q": "2-3 years"}, {"what": "server", "n": "Singapore company", "q": "reported"},
      {"what": "server", "n": "Malaysian sister company", "q": "reported"}], "total": "≈ $4.8 bn", "totalLabel": "Reported total", "ship": "cargoJet", "cap": "What the partner reportedly bought"}, None))
beat("probes", ("timelineStrip", {"events": [{"year": 2023, "label": "Becomes Nvidia partner", "what": "server"}, {"year": 2024, "label": "Commerce looks (reported)", "what": "magnifier"},
      {"year": 2026, "label": "Criminal probe (NYT report)", "what": "documentPage"}], "cap": "Who started looking, and when"}, None))
beat("spokes", ("quoteCard", {"quote": "Their interactions were not unusual or unexpected.", "em": "not unusual", "by": "Nvidia spokesman", "role": "to reporters", "when": "late October 2026", "cap": "The company's answer"}, None))
beat("disputed", ("tugOfWar", {"left": {"n": "Memo: recruited (reported)", "what": "documentPage", "force": 55}, "right": {"n": "Officials doubt; China: baseless", "what": "magnifier", "force": 55},
      "unit": "", "cap": "The claim is disputed", "note": "no public evidence"}, None))
beat("monday", ("splitFlapDate", {"text": "MON 9 NOV", "groups": ["DAY", "DATE", "MONTH"], "what": "documentPage", "label": "the day after the letter", "cap": "Then came Monday"}, None))
beat("fbi", ("stampedPermit", {"title": "An FBI case?", "no": "Mon 9 Nov", "fields": [{"k": "Claim", "v": "FBI is looking into it"}, {"k": "Said by", "v": "the President"}, {"k": "FBI / Justice Dept", "v": "not confirmed"}],
      "checks": ["FBI statement", "Justice Dept statement"], "sign": "-", "stamp": "UNCONFIRMED", "cap": "One sentence, no confirmation", "layout": 1}, None))
beat("onereport", ("sourceCard", {"value": "≈ $7.5 bn", "unit": "claimed chip sales tied to the relationship", "source": {"pub": "a tech news site", "title": "single report", "year": "9 Nov 2026", "page": "not backed up by Reuters"}, "cap": "One report, unverified"}, None))
beat("fivealleged", ("pictogramRow", {"rows": [{"label": "Former staff who alleged it", "value": 5}, {"label": "Confirmed by Nvidia, him or AP", "value": 0}], "object": "person", "each": 1, "unit": "people",
      "cap": "A second allegation (NYT, unconfirmed)", "redRow": 0}, None))
beat("intraday", ("lineEvent", {"values": [0, -3, -8, -13, -10, -7, -5, -4.3], "labels": ["open", "", "", "low", "", "", "", "close"], "events": [{"at": 3, "label": "-13% at the low"}, {"at": 7, "label": "closed about -4%"}],
      "unit": "% on the day", "cap": "Thursday 12 Nov: Nvidia shares", "redEvent": 0}, None))
beat("month", ("shareRing", {"slices": [{"label": "Lost in a month", "value": 24}, {"label": "Still there", "value": 76}], "object": "coinStack", "unit": "≈ $1.4 tn on paper", "cap": "About a quarter of the value, in a month", "redIndex": 0}, None))
beat("stake", ("waffleGrid", {"parts": [{"label": "Still his", "value": 3.6}, {"label": "Everyone else", "value": 96.4}], "total": 100, "unit": "of Nvidia's shares", "cap": "What the founder still owns", "object": "coinStack", "redIndex": 0, "note": "about 3.5%"}, None))
beat("knownpile", ("annotatedDoc", {"head": "Pile one: confirmed", "ref": "filings + statements", "cap": "What we know for sure", "layout": 1, "body": [
      {"t": "He admitted being unfaithful, and resigned.", "hi": 2, "note": "confirmed"}, {"t": "The board is investigating; the stock fell hard.", "hi": 1, "note": "confirmed"},
      {"t": "The Singapore company was an Nvidia partner.", "hi": 1, "note": "confirmed"}]}, None))
beat("claimroute", ("pinChain", {"region": [95, -2, 125, 36], "stops": [{"n": "Nvidia chips", "ll": [121, 24], "what": "gpu"}, {"n": "Singapore partner", "ll": [103.8, 1.35], "what": "server"}, {"n": "China?", "ll": [113, 30], "what": "magnifier"}],
      "cap": "The claimed route: one report, denied", "mode": "ship"}, None))
beat("onlyword", ("quoteCard", {"quote": "The FBI is looking into it.", "em": "looking into it", "by": "The President", "role": "the only source so far", "when": "9 Nov 2026", "cap": "The only word of an FBI case", "layout": 2}, None))
beat("twopiles", ("splitAvsB", {"a": {"label": "Personal scandal", "object": "documentPage"}, "b": {"label": "Security story", "object": "padlock"}, "rows": [{"label": "Admitted", "a": True, "b": False},
      {"label": "Proven", "a": True, "b": False}, {"label": "Still claims", "a": False, "b": True}], "cap": "Where it stands now", "note": "claims, not findings"}, None))
beat("chainq", ("dominoes", {"chain": [{"label": "Chip made", "what": "gpu"}, {"label": "Sold to a partner", "what": "server"}, {"label": "Resold?", "what": "container"}, {"label": "Where now?", "what": "magnifier"}],
      "cap": "Nobody has proven the route, either way", "redIndex": 3, "note": "unproven"}, None))

# ================= a visual for every voiced line =================
def W(set, kind, callout=None, subject="focus", **kw):
  v = {"set": set, "subject": subject, "kind": kind}
  if callout: v["callout"] = callout
  v.update(kw); return v
def D(b, f=0): return {"mg": b, "focus": f, "kind": "data"}
LV = {
  1: W("home_kitchen", "person", "Sunday 8 November"), 2: W("home_kitchen", "person", "The founder, since 1993"),
  3: D("letter"), 4: W("exit_forecourt", "person", "Four days later"), 5: D("fivedays"),
  6: W("sunday_office", "person", "A Message to Our Company"), 7: W("sunday_office", "person", subject="pair"),
  8: W("board_call", "person", "Independent investigation"), 9: D("folders"),
  10: W("diner93", "room", "A Denny's, East San Jose, 1993", subject="set"), 11: W("diner93", "person", "Three engineers"),
  12: D("gpu99"), 13: W("uni_lab", "person", "2012: two gaming cards"), 14: D("training"), 15: D("share"), 16: D("worth"),
  17: W("gov_table", "person"), 18: D("line22"),
  19: W("customs_line", "person", "October 2022: ban"), 20: D("why22"), 21: W("eng_bench", "person", "A modified chip for China"),
  22: D("linemoved"), 23: D("licence"), 24: W("deal_room", "person", "Deal: 15% to the US government"), 25: D("cut15"), 26: W("loading_dock", "person", "Dec 2025: stronger chip allowed"),
  27: W("back_alley", "person"), 28: W("sg_court25", "person", "Singapore, 2025: ≈US$390m"), 29: W("sg_promenade", "street", "Singapore"),
  30: W("dc_entrance", "person"), 31: W("partner_hall", "person", "Late 2023: Nvidia partner"), 32: D("gear"), 33: W("commerce_room", "person", "US officials (reported)"),
  34: D("probes"), 35: W("inspect_bay", "person", "The company: nothing wrong found"), 36: W("interview", "person", "Passport taken; a warning"),
  37: W("terrace_gala", "person", "Photos since Dec 2023 (Reuters)"), 38: W("times_newsroom", "person", "NYT, 29 Oct (reported)"), 39: D("spokes"),
  40: W("memo_office", "person", "A secret memo (reported)"), 41: D("disputed"), 42: D("monday"),
  43: W("lawn_scrum", "person", "Mon 9 Nov"), 44: D("fbi"), 45: W("lawn_scrum", "person", subject="staffers"), 46: W("suit_steps4", "person", "Class action filed"),
  47: W("tech_site", "person", "One report: ≈$7.5 bn"), 48: D("onereport"), 49: W("law_library", "person", "Tue: outside law firm"), 50: W("records_room", "person"),
  51: D("fivealleged"), 52: W("phone_bank", "person", "Not confirmed"), 53: W("board_hands", "person", "Wed 11 Nov: resignation accepted"), 54: W("screen_square", "person", "Thu 12 Nov"),
  55: W("trade_floor4", "person", "Out as CEO and director"), 56: D("intraday"), 57: W("biz_studio", "person"), 58: D("month"),
  59: W("atrium_hall", "person", "Finance chief: interim CEO"), 60: W("chair_corridor", "person", "First chairman, on board since 1993"), 61: D("stake"),
  62: W("pres_desk", "person", "'Very honourable'"), 63: W("newsstand", "person"),
  64: W("evidence_room", "person", "Pile one: confirmed"), 65: D("knownpile", 0), 66: D("knownpile", 2), 67: W("evidence_room", "person", "Pile two: claims", subject="clerksB"),
  68: D("claimroute"), 69: D("onlyword"), 70: W("doj_steps4", "person", "Justice Dept: no conclusion"), 71: W("lobby_statement", "person", "Board: 'no reason to believe'"),
  72: D("twopiles"), 73: W("senate_bank", "person", "Senate Banking: summoned"), 74: W("earnings4", "person", "17 Nov: earnings"), 75: W("port_check", "person"),
  76: W("hq_late", "person", "Santa Clara"), 77: D("chainq"), 78: W("campus_dusk", "place", subject="set", endcard=True),
}
assert sorted(LV) == list(range(1, NL + 1)), (NL, sorted(set(range(1, NL + 1)) ^ set(LV)))
# chapter openers: the set's title sign holds through the chgap pause
for n in CHOPEN: assert "set" in LV[n], n; LV[n]["chapterOpen"] = True; LV[n]["title"] = CHOPEN[n][1]
# camera: lines >= 4.45 s get the 2-3 stop reveal (film.html drops stops whose hops break the caps); shorter lines hold one eased move
for n, v in LV.items():
  if "set" in v and v.get("kind") != "place" and DUR.get(n, 0) >= 4.45: v["path"] = "reveal"
plan = {"film": FILM, "seed": seed(0), "v3": True, "endcard": {"name": "Blind Luck Time"}, "cast": CAST, "sets": S, "mg": MG, "lines": {str(k): v for k, v in LV.items()}}
(F / "plan.json").write_text(json.dumps(plan, indent=1, ensure_ascii=False), encoding="utf8")
(F / "sound.json").write_text(json.dumps({"video": f"out/{FILM}.mp4", "beds": "page", "cues": "page", "music": {"moods": "auto", "under": 18, "lift": 3}}), encoding="utf8")
used = {v["set"] for v in LV.values() if "set" in v}; tags = {}
for v in LV.values(): tags[v["kind"]] = tags.get(v["kind"], 0) + 1
print("lines", NL, "sets", len(S), "unused", sorted({s["id"] for s in S} - used), "mg beats", len(MG), "tags", tags, "chapters", {n: c[1] for n, c in CHOPEN.items()})
