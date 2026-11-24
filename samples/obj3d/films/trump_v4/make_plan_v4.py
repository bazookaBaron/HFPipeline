# Producer step for Trump v4 (script v4: hook + 7 chapters + payoff). Writes films/trump_v4/plan.json (PLAN.v3 = true) + sound.json + entities.json.
# Rule 0: every set, cast silhouette, layout and MG beat below is designed fresh from the v4 lines of THIS script; seeds come from "trump_v4" + line index.
# Wiring (not content) follows films/nvidia_v4/make_plan_v4.py: titleSign chapter openers with chapterOpen=True, photo cards on 3D lines, page beds/cues.
# Attribution: allegations stay exactly as attributed in script.md; MG stamps use the film's four stamps (PROVEN / ALLEGED / DISPROVEN / UNVERIFIED)
# plus the script's own "no finding" / "not established" wording. No person's photo sits on a line that states an unverified claim.
# Run: python make_plan_v4.py
import json, pathlib, re, zlib
F = pathlib.Path(__file__).parent
FILM = "trump_v4"

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
  c, t = CHOPEN[n]; return {"what": "titleSign", "style": style, "text": t, "kicker": f"Chapter {c}", "scale": kw.pop("scale", 1.4), **kw}

# ---------------- cast: fixed faceless silhouettes (no likeness, no faces) ----------------
CAST = {
  "developer": {"build": 1.34, "hair": "short", "coat": True, "tie": True},                 # Trump: heavy build, long tie
  "son":       {"build": 1.04, "hair": "short", "coat": True, "tie": False},                # Don Jr: open collar
  "fixer":     {"build": 1.0, "hair": "none", "coat": True, "tie": True, "prop": "phone"},  # Cohen
  "counsel":   {"build": 1.02, "hair": "short", "coat": True, "tie": True, "prop": "papers"},  # Mueller
  "chairman":  {"build": 1.12, "hair": "short", "coat": True, "tie": True, "prop": "briefcase"},  # Manafort
  "associate": {"build": 1.06, "hair": "short", "coat": True, "tie": False},              # Kilimnik
  "lawyerR":   {"build": 0.88, "hair": "long", "coat": True, "skirt": True, "prop": "papers"},  # Veselnitskaya
  "publicist": {"build": 1.18, "hair": "none", "coat": False, "tie": False},              # Goldstone
  "leader":    {"build": 0.96, "hair": "none", "coat": True, "tie": True},                # Putin
  "clerk":     {"build": 0.9, "hair": "bun", "coat": False, "skirt": True},              # the film's evidence clerk (recurring)
  "watchdog":  {"build": 0.95, "hair": "none", "coat": True, "tie": True, "prop": "papers"},  # the inspector general
  "senator":   {"build": 1.08, "hair": "none", "coat": True, "tie": True},
  "spokes":    {"build": 1.0, "hair": "short", "coat": True, "tie": True},
}

S = []
def room(id, n, type=None, scale=None, **kw):
  s = {"id": id, "seed": seed(n), **({"type": type} if type else {}), **({"scale": scale} if scale else {}), **kw}
  if scale is None and type is None: s["scale"] = "room"
  S.append(s); return id
def ext(id, n, ground, place, light=None):
  s = {"id": id, "seed": seed(n), "ground": {"seed": seed(n, "g"), **ground}, "place": place}
  if light: s["light"] = {"time": light}
  S.append(s); return id
FRONT = -135   # stand / crate signs: lettering faces +z (the open, camera side of a cut-away room)

# ================= HOOK =================
# L1/L3/L39/L131 June 2016: the son's corner office high in the tower, laptop open on the email (the film's spine object)
room("son_office", 1, room={"w": 8.0, "d": 6.4, "h": 2.9, "floor": "carpet", "windows": 3, "doors": [{"wall": "left", "at": 0.82}]},
     place=[{"what": "desk", "name": "sdesk", "at": "center", "variant": "papers", "off": [0.6, -0.9]}, {"what": "sofa", "at": "left", "w": 1.8},
            {"what": "coffeeTable", "at": "front-of:sofa", "gap": 0.4}, {"what": "shelf", "at": "back", "n": 2, "fill": "mixed"}, {"what": "plant", "at": "corner", "n": 2},
            {"what": "wallArt", "kind": "photo", "at": "back", "n": 2}],
     people=[{"id": "son", "char": "son", "pose": "sit_type", "prop": "laptop", "at": "seat:sdesk:0"},
             {"id": "aide", "pose": "phone", "at": [2.4, 1.6], "face": 200, "o": {"coat": False, "hair": "bun", "skirt": True}}], focus="son", light={"time": "morning"})
# L4 the father outside the tower: a kerbside press scrum on the avenue
room("avenue_scrum", 4, "steps", street={"w": 54, "d": 38, "kind": "plaza", "facades": ["back", "left"], "road": "front"},
     place=[{"what": "newsVan", "n": 2, "at": "kerb"}, {"what": "lampPost", "n": 3, "at": "plaza"}, {"what": "barrier", "n": 1, "len": 8, "at": "plaza"}],
     groups=[{"form": "podium", "at": "steps-foot", "n": 14, "name": "scrum", "speakerChar": "developer"},
             {"form": "crowd", "n": 26, "area": "plaza", "poses": ["stand", "phone", "walk", "stand_arms_crossed"], "name": "passers"}], focus="scrum.speaker", light={"time": "evening"})

# ================= CH1 The Moscow File =================
# L5/L51/L91/L127 the trial's evidence room: a long table of folders, the clerk with the four stamps; the chapter title is the cabinet tab
room("evidence_hall", 5, room={"w": 12.5, "d": 8.5, "h": 3.1, "floor": "tile", "windows": 3, "doors": [{"wall": "left", "at": 0.84}]},
     place=[{"what": "table", "name": "folders", "at": "center", "seats": 6, "len": 4.2, "off": [0.6, -0.5]}, {"what": "shelf", "n": 3, "at": "back", "fill": "boxes", "height": 2.4},
            {"what": "filing", "at": "left", "n": 3, "drawers": 4}, {"what": "docPile", "at": "back"}, {"what": "clock", "at": "back"},
            title(5, "cabinet", at=[-4.4, 2.6], h=FRONT, w=1.7, hh=0.45)],
     people=[{"id": "clerk", "char": "clerk", "pose": "look_down", "prop": "papers", "at": "front-of:folders"}],
     groups=[{"form": "table", "of": "folders", "n": 3, "name": "readers", "poses": ["sit_lean", "sit_type", "sit_listen"]}], focus="clerk")
# L7 the public record: archivists pulling bound reports and court files from tall stacks
room("records_stacks", 7, room={"w": 13, "d": 9, "h": 3.4, "floor": "concrete", "windows": 2, "highWindows": True, "doors": [{"wall": "left", "at": 0.86}]},
     place=[{"what": "shelf", "name": "stacks", "n": 6, "at": "grid", "cols": 3, "rowsN": 2, "gapX": 1.3, "gapZ": 1.8, "h": 0, "fill": "books", "height": 2.6, "off": [1.0, -1.0]},
            {"what": "table", "name": "readTable", "at": "front", "seats": 4, "len": 2.6}, {"what": "boxes", "kind": "card", "n": 3, "at": "left"}],
     groups=[{"form": "crowd", "n": 4, "area": "aisles", "poses": ["carry", "look_down", "carry", "point"], "prop": "papers", "name": "archivists"},
             {"form": "table", "of": "readTable", "n": 2, "name": "readers"}], focus={"id": "archivists", "index": 0})
# L10 the stamps go on the evidence: a clerk's counter with in-trays; the stamp lands on a folder, a figure waits apart behind a rope
room("stamp_counter", 10, room={"w": 9, "d": 7, "h": 3.0, "floor": "wood", "windows": 2, "doors": [{"wall": "left", "at": 0.84}]},
     place=[{"what": "counter", "name": "cnt", "len": 3.6, "at": "back"}, {"what": "ropePosts", "at": [1.8, 1.0], "len": 3.0, "h": 0}, {"what": "filing", "at": "left", "n": 2},
            {"what": "bench", "n": 1, "at": "front"}, {"what": "plant", "at": "corner"}],
     people=[{"id": "stamper", "char": "clerk", "pose": "point", "at": "front-of:cnt", "face": 90},
             {"id": "man", "char": "developer", "pose": "stand_arms_crossed", "at": [3.4, 2.2], "face": 200}], focus="stamper")
# L11 448 pages: a trolley of bound volumes wheeled through a reading room
room("volume_trolley", 11, room={"w": 10, "d": 7.5, "h": 3.2, "floor": "carpet", "windows": 3, "curtains": True, "doors": [{"wall": "left", "at": 0.85}]},
     place=[{"what": "table", "name": "rtable", "at": "center", "seats": 6, "len": 3.0}, {"what": "docPile", "name": "volumes", "at": "front-of:rtable", "gap": 0.9},
            {"what": "shelf", "at": "back", "n": 3, "fill": "books"}, {"what": "rug", "at": "under:rtable", "pad": 0.6}],
     people=[{"id": "porter", "pose": "carry", "prop": "box", "at": [-1.6, 1.8], "face": 0, "o": {"coat": False, "hair": "short"}}],
     groups=[{"form": "table", "of": "rtable", "n": 4, "name": "readers", "poses": ["sit_type", "sit_lean", "sit_listen"]}], focus="porter")
# L12 1987: Moscow, the Kremlin wall and onion domes across a broad square
ext("moscow87", 12, {"kind": "river", "relief": 0.16, "size": 260, "width": 22, "angle": 18},
    [{"what": "kremlin", "where": "center", "focus": True, "name": "kremlin"}, {"what": "onionChurch", "n": 1, "where": "edge"}, {"what": "midrise", "n": 10, "where": "edge"},
     {"what": "trees", "n": 60, "where": "edge"}, {"what": "car", "n": 4, "where": "road"}, {"what": "people", "n": 30, "where": "center"}], light="overcast")
# L13 the invitation: a tour guide leads the visiting developer's party past a hotel entrance and a tour bus
room("intourist_kerb", 13, scale="street", street={"w": 46, "d": 32, "kind": "plaza", "facades": ["back", "left"], "road": "front"},
     place=[{"what": "busStop", "at": "kerb"}, {"what": "car", "n": 2, "at": "kerb"}, {"what": "lampPost", "n": 2, "at": "plaza"}, {"what": "bench", "n": 1, "at": "plaza"}],
     people=[{"id": "guide", "pose": "point", "at": [-0.6, 4.6], "face": 60, "with": "party", "o": {"hair": "bun", "skirt": True, "coat": True}},
             {"id": "dev", "char": "developer", "pose": "walk", "at": [0.5, 5.0], "face": 120, "with": "party"},
             {"id": "p2", "pose": "walk", "prop": "briefcase", "at": [1.2, 5.5], "face": 130, "with": "party", "o": {"coat": True, "tie": True}}],
     groups=[{"form": "crowd", "n": 14, "area": "plaza", "poses": ["walk", "stand", "carry"], "name": "muscovites"}], focus="party", light={"time": "overcast"})
# L14 1996: a press event, a skyscraper model on a plinth beside the lectern
room("announce96", 14, "pressroom", room={"w": 12, "d": 9, "h": 3.4, "floor": "wood", "windows": 2, "curtains": True},
     place=[{"what": "podium", "name": "lect", "at": "back", "riser": 0.25, "mics": 4, "wallGap": 1.4}, {"what": "serverRack", "name": "model", "n": 1, "at": "near:lect"},
            {"what": "chairsRows", "name": "seats", "rows": 2, "cols": 8, "aisle": 1.0, "at": "front-of:lect", "gap": 3.0}, {"what": "tvCamera", "n": 2, "at": "side:seats", "face": "lect"}],
     groups=[{"form": "podium", "of": "lect", "n": 0, "name": "dev", "speakerChar": "developer"}, {"form": "audience", "of": "seats", "n": 12, "name": "press", "poses": ["sit_type", "sit_listen", "raise_hand"]},
             {"form": "workers", "of": "tvCamera", "name": "crew"}], focus="dev.speaker")
# L15 mid-2000s: two partners over tower drawings on a drafting table in a small office
room("plans_office", 15, room={"w": 7.5, "d": 6, "h": 2.9, "floor": "wood", "windows": 2, "doors": [{"wall": "left", "at": 0.82}]},
     place=[{"what": "workbench", "name": "drafting", "at": "center", "off": [0.4, -0.3]}, {"what": "filing", "at": "back", "n": 2}, {"what": "whiteboard", "at": "left"},
            {"what": "plant", "at": "corner"}, {"what": "shelf", "at": "back", "n": 1, "fill": "mixed"}],
     people=[{"id": "b1", "pose": "point", "at": "front-of:drafting", "with": "partners", "o": {"coat": True, "tie": True, "hair": "short"}},
             {"id": "b2", "pose": "look_down", "at": [1.6, 0.9], "face": "drafting", "with": "partners", "o": {"coat": False, "hair": "none", "build": 1.1}}], focus="partners")
# L16/L18 Sept 2008: a hotel ballroom conference, the son at a lectern, round tables; a reporter's notebook at the back
room("ballroom08", 16, room={"w": 15, "d": 11, "h": 4.0, "floor": "carpet", "windows": 0, "doors": [{"wall": "left", "at": 0.88, "w": 1.8}]},
     place=[{"what": "podium", "name": "lect", "at": "back", "riser": 0.35, "mics": 1, "wallGap": 1.3}, {"what": "roundTable", "name": "tables", "n": 6, "seats": 5, "at": "grid", "cols": 3, "gapX": 1.8, "gapZ": 1.6, "off": [0.3, 1.0]},
            {"what": "screenWall", "at": "back", "nx": 2, "ny": 1, "near": [-3.5, 0]}, {"what": "plant", "at": "corner", "n": 2}],
     people=[{"id": "reporter", "pose": "look_down", "prop": "papers", "at": [-5.6, 3.6], "face": 300, "o": {"coat": True, "hair": "long", "skirt": True}}],
     groups=[{"form": "podium", "of": "lect", "n": 0, "name": "son", "speakerChar": "son"},
             {"form": "table", "of": "tables", "n": 18, "name": "delegates", "poses": ["sit_listen", "sit_lean", "sit_listen", "sit_type"]}], focus="son.speaker", light={"time": "evening"})
# L19 2008: buyer's agent and seller shake hands at the gate of an oceanfront villa
room("villa_gate", 19, scale="street", street={"w": 52, "d": 36, "kind": "plaza", "facades": ["back"], "road": "front"},
     place=[{"what": "tree", "n": 6, "at": "plaza"}, {"what": "car", "n": 2, "at": "kerb"}, {"what": "bollard", "n": 4, "at": "plaza"}],
     people=[{"id": "seller", "char": "developer", "pose": "handshake_L", "at": [0.2, 5.0], "face": 0, "with": "sale"},
             {"id": "agent", "pose": "handshake_R", "at": [1.1, 5.0], "face": 180, "with": "sale", "o": {"coat": True, "tie": True, "hair": "short", "prop": "briefcase"}}],
     groups=[{"form": "huddle", "n": 2, "at": [3.6, 6.0], "name": "lawyers", "poses": ["look_down", "stand"]}], focus="sale", light={"time": "afternoon"})
# L20 the mansion itself from above: palms, lawn, the sea
ext("palm_villa", 20, {"kind": "plain", "relief": 0.08, "size": 220, "shore": True},
    [{"what": "house", "where": "center", "focus": True, "name": "villa", "floors": 2}, {"what": "trees", "n": 70, "where": "edge"}, {"what": "house", "n": 6, "where": "edge"},
     {"what": "road", "from": "edge:west", "to": "villa", "name": "drive"}, {"what": "car", "n": 2, "where": "road"}], light="afternoon")
# L22 Nov 2013: the pageant hall, a stage, contestants in a line, a seated audience
room("pageant_hall", 22, room={"w": 22, "d": 15, "h": 6.0, "floor": "wood", "windows": 0, "doors": [{"wall": "left", "at": 0.9, "w": 2.2}]},
     place=[{"what": "stage", "name": "stage", "at": "back", "w": 10, "d": 3.6, "wallGap": 0.6}, {"what": "chairsRows", "name": "stalls", "rows": 4, "cols": 12, "aisle": 1.4, "at": "front-of:stage", "gap": 2.4},
            {"what": "tvCamera", "n": 3, "at": "side:stalls", "face": "stage"}, {"what": "flag", "n": 4, "at": "on:stage"}],
     groups=[{"form": "queue", "n": 9, "at": [-4.0, -5.6], "dir": 0, "name": "contestants", "o": {"hair": "long", "skirt": True, "coat": False}},
             {"form": "audience", "of": "stalls", "n": 30, "name": "audience"}, {"form": "workers", "of": "tvCamera", "name": "crew"}], focus={"id": "contestants", "index": 4}, light={"time": "evening"})
# L23 June 2013: the developer at his desk with a phone, the city behind
room("tower_desk13", 23, room={"w": 9, "d": 7, "h": 3.2, "floor": "carpet", "windows": 4, "curtains": True, "doors": [{"wall": "left", "at": 0.86}]},
     place=[{"what": "desk", "name": "tdesk", "at": "center", "variant": "lamp", "off": [0.2, -1.1]}, {"what": "chair", "style": "arm", "n": 2, "at": "front-of:tdesk", "gap": 1.0},
            {"what": "wallArt", "kind": "photo", "at": "back", "n": 4}, {"what": "shelf", "at": "left", "n": 1, "fill": "books"}, {"what": "rug", "at": "center", "pad": 1.2}],
     people=[{"id": "dev", "char": "developer", "pose": "phone", "at": "seat:tdesk:0"}],
     groups=[{"form": "huddle", "n": 2, "at": [2.8, 1.8], "name": "staff", "poses": ["stand", "look_down"]}], focus="dev")
# L24 May 2016: the Kremlin briefing room, the spokesman at a lectern, reporters
room("kremlin_brief", 24, room={"w": 12, "d": 9, "h": 3.8, "floor": "wood", "windows": 3, "curtains": True, "wainscot": True, "doors": [{"wall": "left", "at": 0.86}]},
     place=[{"what": "lectern", "name": "lect", "at": "back"}, {"what": "flag", "at": "back", "n": 1, "near": "lect"}, {"what": "wallArt", "kind": "seal", "at": "back", "w": 1.0, "h": 1.0, "y": 2.4},
            {"what": "chairsRows", "name": "seats", "rows": 3, "cols": 7, "aisle": 1.0, "at": "front-of:lect", "gap": 2.8}, {"what": "tvCamera", "n": 1, "at": "side:seats", "face": "lect"}],
     people=[{"id": "spk", "char": "spokes", "pose": "speak", "at": "front-of:lect"}],
     groups=[{"form": "audience", "of": "seats", "n": 14, "name": "press", "poses": ["sit_type", "raise_hand", "sit_listen"]}], focus="spk")
# L26 business before politics: a campaign rally fills a plaza below the towers
room("rally15", 26, "rally", street={"w": 62, "d": 42, "kind": "plaza", "facades": ["back", "left"], "road": "front"}, focus="speaker.speaker", light={"time": "afternoon"})

# ================= CH2 Tower Talks =================
# L27 a glass office: a scale model of a skyscraper on the desk; the fixer and the developer over it; title plaque on the wall
room("model_office", 27, room={"w": 10, "d": 7.5, "h": 3.2, "floor": "carpet", "windows": 5, "doors": [{"wall": "left", "at": 0.86}]},
     place=[{"what": "table", "name": "mtable", "at": "center", "seats": 4, "len": 2.2, "off": [0.6, -0.4]}, {"what": "serverRack", "name": "model", "n": 1, "at": "near:mtable"},
            {"what": "credenza", "at": "back"}, {"what": "plant", "at": "corner", "n": 2}, title(27, "stand", at=[-3.6, 2.4], h=FRONT)],
     people=[{"id": "dev", "char": "developer", "pose": "stand_hips", "at": [0.4, 1.4], "face": 330, "with": "pair"},
             {"id": "fixer", "char": "fixer", "pose": "point", "at": [1.4, 1.2], "face": 200, "with": "pair"}], focus="pair")
# L28 the letter of intent: two men sign at a small table, witnesses behind
room("loi_table", 28, room={"w": 8, "d": 6.5, "h": 3.0, "floor": "wood", "windows": 2, "curtains": True, "doors": [{"wall": "left", "at": 0.84}]},
     place=[{"what": "table", "name": "sign", "at": "center", "seats": 2, "len": 1.6}, {"what": "flag", "at": "back", "n": 2}, {"what": "shelf", "at": "left", "n": 1, "fill": "books"}, {"what": "plant", "at": "corner"}],
     people=[{"id": "s1", "pose": "sit_type", "prop": "papers", "at": "seat:sign:0", "with": "signers", "o": {"coat": True, "tie": True, "hair": "short"}},
             {"id": "s2", "pose": "sit_type", "prop": "papers", "at": "seat:sign:1", "with": "signers", "o": {"coat": True, "tie": True, "hair": "none", "build": 1.1}}],
     groups=[{"form": "crowd", "n": 3, "area": [-1.5, -2.2, 2.0, -1.2], "poses": ["applaud", "stand", "stand_arms_crossed"], "name": "witnesses"}], focus="signers")
# L30 Jan 2016: the fixer at his desk, typing an email
room("fixer_desk", 30, room={"w": 7, "d": 5.8, "h": 2.9, "floor": "carpet", "windows": 2, "doors": [{"wall": "left", "at": 0.82}]},
     place=[{"what": "desk", "name": "fdesk", "at": "back", "variant": "papers"}, {"what": "filing", "at": "left", "n": 2}, {"what": "wallArt", "kind": "photo", "at": "back", "n": 3},
            {"what": "chair", "style": "arm", "at": "corner"}, {"what": "plant", "at": "corner"}],
     people=[{"id": "fixer", "char": "fixer", "pose": "sit_type", "prop": "laptop", "at": "seat:fdesk:0"}], focus="fixer", light={"time": "evening"})
# L31 the call: an assistant on the phone in a high-ceilinged office in Moscow
room("moscow_phone", 31, room={"w": 8.5, "d": 6.5, "h": 3.8, "floor": "wood", "windows": 3, "curtains": True, "wainscot": True, "doors": [{"wall": "left", "at": 0.84}]},
     place=[{"what": "desk", "name": "adesk", "at": "center", "variant": "lamp", "off": [0.3, -0.6]}, {"what": "filing", "at": "back", "n": 3}, {"what": "flag", "at": "back", "n": 1},
            {"what": "clock", "at": "left"}, {"what": "rug", "at": "center", "pad": 0.9}],
     people=[{"id": "asst", "pose": "phone", "at": "seat:adesk:0", "o": {"coat": True, "hair": "bun", "skirt": True}}], focus="asst")
# L32/L115 the special counsel's office: investigators around a table of binders
room("counsel_office", 32, room={"w": 11, "d": 8, "h": 3.0, "floor": "carpet", "windows": 0, "doors": [{"wall": "left", "at": 0.86}]},
     place=[{"what": "boardroomTable", "name": "btable", "at": "center", "seats": 8}, {"what": "whiteboard", "at": "back"}, {"what": "filing", "at": "left", "n": 4},
            {"what": "docPile", "at": "left"}, {"what": "boxes", "kind": "card", "n": 3, "at": "corner"}],
     people=[{"id": "counsel", "char": "counsel", "pose": "stand", "at": "end:btable:0"}],
     groups=[{"form": "table", "of": "btable", "n": 6, "name": "team", "poses": ["sit_type", "sit_lean", "sit_listen", "sit_type"]}], focus="counsel")
# L33 May 2017: the newly appointed counsel walks a corridor of the Justice building with two aides
room("doj_corridor", 33, room={"w": 13, "d": 5.5, "h": 3.6, "floor": "tile", "windows": 4, "wainscot": True, "doors": [{"wall": "left", "at": 0.5, "w": 1.6}]},
     place=[{"what": "bench", "n": 2, "at": "back"}, {"what": "flag", "at": "back", "n": 2}, {"what": "wallArt", "kind": "photo", "at": "back", "n": 4}, {"what": "plant", "at": "corner", "n": 2}],
     people=[{"id": "counsel", "char": "counsel", "pose": "walk", "at": [-0.6, 1.0], "face": 0, "with": "walkers"},
             {"id": "a1", "pose": "walk", "prop": "papers", "at": [-1.6, 1.5], "face": 0, "with": "walkers", "o": {"coat": True, "hair": "bun", "skirt": True}},
             {"id": "a2", "pose": "walk", "prop": "briefcase", "at": [-1.8, 0.4], "face": 0, "with": "walkers", "o": {"coat": True, "tie": True}}], focus="walkers")
# L35 Nov 2018: the fixer climbs federal courthouse steps through cameras
room("court_steps18", 35, "steps", street={"w": 58, "d": 40, "kind": "steps", "facades": ["back", "left"], "road": "front"},
     place=[{"what": "newsVan", "n": 2, "at": "kerb"}, {"what": "tvCamera", "n": 4, "at": "plaza", "face": "steps"}],
     groups=[{"form": "procession", "n": 4, "at": "steps-foot", "name": "arrival", "o": {"coat": True, "tie": True}},
             {"form": "crowd", "n": 24, "area": "plaza", "poses": ["stand", "phone", "stand_arms_crossed"], "name": "press"}], focus={"id": "arrival", "index": 0}, light={"time": "overcast"})
# L36 pleading guilty: the defendant stands before the judge, lawyers at his side
room("plea_court", 36, "courtroom", room={"w": 14, "d": 11, "h": 4.0, "floor": "carpet", "windows": 3, "wainscot": True, "doors": [{"wall": "left", "at": 0.86, "w": 1.6}]},
     place=[{"what": "judgeBench", "name": "bench", "at": "back", "focusable": True}, {"what": "flag", "at": "back", "n": 2, "near": "bench"},
            {"what": "witnessTable", "name": "defence", "seats": 3, "at": "front-of:bench", "lat": 1.8, "gap": 2.4, "face": "bench"},
            {"what": "witnessTable", "name": "gov", "seats": 2, "at": "front-of:bench", "lat": -2.4, "gap": 2.4, "face": "bench"},
            {"what": "pews", "name": "gallery", "rows": 3, "len": 8, "aisle": 1.2, "bar": True, "at": "front"}],
     people=[{"id": "fixer", "char": "fixer", "pose": "stand", "at": "front-of:defence", "face": "bench"}],
     groups=[{"form": "table", "of": "bench", "n": 1, "name": "judge"}, {"form": "table", "of": "gov", "n": 2, "name": "prosecutors"},
             {"form": "audience", "of": "gallery", "n": 14, "name": "public"}], focus="fixer")
# L37 Congress: a House committee room, the witness chair, members' nameplates
room("house_room", 37, "hearing", room={"w": 15, "d": 11, "h": 4.0, "floor": "carpet", "windows": 2, "wainscot": True},
     groups=[{"form": "table", "of": "dais", "n": 9, "name": "members"}, {"form": "audience", "of": "gallery", "n": 12, "name": "public"}],
     people=[{"id": "witness", "char": "fixer", "pose": "sit_lean", "at": "seat:witnessTable:1"}], focus="witness")

# ================= CH3 The Meeting =================
# L40/L42/L44/L46 the meeting room high in the tower: chairs round a table, laptop open; the chapter plaque on the wall
room("tower_meeting", 40, room={"w": 10, "d": 7.5, "h": 3.0, "floor": "carpet", "windows": 5, "doors": [{"wall": "left", "at": 0.86}]},
     place=[{"what": "boardroomTable", "name": "mt", "at": "center", "seats": 8, "off": [0.4, -0.4]}, {"what": "credenza", "at": "back"}, {"what": "plant", "at": "corner", "n": 2},
            {"what": "waterCooler", "at": "left"}, title(40, "plaque", at="back", near=[-3.0, 0])],
     people=[{"id": "son", "char": "son", "pose": "sit_type", "prop": "laptop", "at": "seat:mt:0"},
             {"id": "pub", "char": "publicist", "pose": "stand", "at": [3.2, 1.5], "face": 200},
             {"id": "guest", "char": "lawyerR", "pose": "sit_lean", "at": "seat:mt:5"}],
     groups=[{"form": "table", "of": "mt", "n": 4, "name": "attendees", "poses": ["sit_listen", "sit_lean", "sit_listen", "sit"]}], focus="son")
# L43 June 9: the tower's avenue frontage, taxis and pedestrians, guests at the revolving door
room("fifth_ave", 43, scale="street", street={"w": 56, "d": 36, "kind": "plaza", "facades": ["back", "left"], "road": "front"},
     place=[{"what": "car", "n": 4, "at": "kerb"}, {"what": "lampPost", "n": 3, "at": "plaza"}, {"what": "tree", "n": 3, "at": "plaza"}, {"what": "bollard", "n": 5, "at": "plaza"}],
     people=[{"id": "g1", "char": "lawyerR", "pose": "walk", "at": [0.0, 4.4], "face": 270, "with": "guests"},
             {"id": "g2", "pose": "walk", "prop": "briefcase", "at": [0.9, 4.8], "face": 270, "with": "guests", "o": {"coat": True, "tie": True}}],
     groups=[{"form": "crowd", "n": 30, "area": "plaza", "poses": ["walk", "walk", "phone", "stand", "carry"], "mode": "plaza", "name": "pedestrians"}], focus="guests", light={"time": "afternoon"})
# L45 the Senate intelligence committee: senators of both parties at a curved dais, a closed session
room("intel_dais", 45, "hearing", room={"w": 16, "d": 12, "h": 4.6, "floor": "carpet", "windows": 0, "wainscot": True},
     groups=[{"form": "table", "of": "dais", "n": 11, "name": "senators"}, {"form": "table", "of": "dais", "staff": True, "n": 4, "name": "staff"}], focus={"id": "senators", "index": 5})
# L48 the charge decision: prosecutors at a whiteboard of two hurdles
room("charge_room", 48, room={"w": 8.5, "d": 6.5, "h": 2.9, "floor": "carpet", "windows": 1, "doors": [{"wall": "left", "at": 0.84}]},
     place=[{"what": "whiteboard", "name": "wb", "at": "back"}, {"what": "table", "name": "ct", "at": "center", "seats": 4, "len": 2.0, "off": [0.6, 0.6]}, {"what": "filing", "at": "left", "n": 2}],
     people=[{"id": "lead", "char": "counsel", "pose": "point", "at": "front-of:wb", "face": 270}],
     groups=[{"form": "table", "of": "ct", "n": 3, "name": "deputies", "poses": ["sit_listen", "sit_lean", "sit_type"]}], focus="lead")
# L52 that summer: the campaign headquarters at night, one man at the window
room("campaign_hq", 52, room={"w": 14, "d": 9, "h": 3.0, "floor": "carpet", "windows": 5, "doors": [{"wall": "left", "at": 0.88}]},
     place=[{"what": "deskRow", "name": "rows", "n": 3, "at": "grid", "cols": 3, "rowsN": 1, "per": 4, "gapX": 1.4, "h": 0, "off": [1.0, -0.4]}, {"what": "whiteboard", "at": "left"},
            {"what": "crates", "kind": "card", "n": 2, "at": "corner"}, {"what": "waterCooler", "at": "left"}],
     people=[{"id": "chair", "char": "chairman", "pose": "stand_arms_crossed", "at": [-4.4, 2.6], "face": 270}],
     groups=[{"form": "table", "of": "rows", "n": 3, "name": "late", "poses": ["sit_type", "phone", "sit_lean"]}], focus="chair", light={"time": "evening"})

# ================= CH4 The Polling Data =================
# L53 a Manhattan street at night: two men under a streetlamp, one holding a folder; the chapter on a stand sign by a cafe
room("lamp_street", 53, scale="street", street={"w": 44, "d": 30, "kind": "plaza", "facades": ["back", "left"], "road": "front"},
     place=[{"what": "lampPost", "n": 3, "at": "plaza"}, {"what": "car", "n": 3, "at": "kerb"}, {"what": "bench", "n": 1, "at": "plaza"}, title(53, "stand", at=[-6.0, 3.0], h=FRONT, scale=1.6)],
     people=[{"id": "chair", "char": "chairman", "pose": "speak", "at": [0.0, 4.4], "face": 20, "with": "pair"},
             {"id": "assoc", "char": "associate", "pose": "look_down", "prop": "papers", "at": [0.95, 4.6], "face": 200, "with": "pair"}],
     groups=[{"form": "crowd", "n": 8, "area": "plaza", "poses": ["walk", "phone", "walk"], "name": "late"}], focus="pair", light={"time": "evening"})
# L55 a private back room: the chairman slides a folder across a small table to his associate
room("back_room", 55, room={"w": 7, "d": 6, "h": 2.8, "floor": "wood", "windows": 1, "curtains": True, "doors": [{"wall": "left", "at": 0.8}]},
     place=[{"what": "roundTable", "name": "rt", "at": "center", "seats": 2}, {"what": "sofa", "at": "back", "w": 2.0}, {"what": "shelf", "at": "left", "n": 1, "fill": "books"},
            {"what": "plant", "at": "corner"}, {"what": "rug", "at": "under:rt", "pad": 0.8}],
     people=[{"id": "chair", "char": "chairman", "pose": "sit_lean", "at": "seat:rt:0", "with": "pair"},
             {"id": "assoc", "char": "associate", "pose": "sit_listen", "prop": "papers", "at": "seat:rt:1", "with": "pair"}], focus="pair", light={"time": "evening"})
# L57 the campaign's data room: analysts at screens, a locked cabinet, the chairman walking out with a folder
room("data_room", 57, room={"w": 11, "d": 8, "h": 2.9, "floor": "carpet", "windows": 1, "doors": [{"wall": "left", "at": 0.86}]},
     place=[{"what": "cluster", "name": "pods", "n": 2, "at": "grid", "cols": 2, "gapX": 2.0, "off": [1.0, -0.6]}, {"what": "screenWall", "at": "back", "nx": 3, "ny": 1},
            {"what": "filing", "name": "locked", "at": "left", "n": 3, "drawers": 4}, {"what": "serverRack", "n": 1, "at": "left"}],
     people=[{"id": "chair", "char": "chairman", "pose": "walk", "prop": "papers", "at": [-2.8, 2.4], "face": 180}],
     groups=[{"form": "table", "of": "pods", "n": 5, "name": "analysts", "poses": ["sit_type", "sit_lean", "sit_type"]}], focus="chair")
# L59/L121 the committee's staff room: the report volumes stacked on a long table
room("report_room", 59, room={"w": 12, "d": 8, "h": 3.4, "floor": "carpet", "windows": 3, "curtains": True, "wainscot": True, "doors": [{"wall": "left", "at": 0.86}]},
     place=[{"what": "table", "name": "rt", "at": "center", "seats": 8, "len": 4.4}, {"what": "docPile", "name": "volumes", "at": "front-of:rt", "gap": 0.8}, {"what": "flag", "at": "back", "n": 2},
            {"what": "wallArt", "kind": "seal", "at": "back", "w": 1.0, "h": 1.0, "y": 2.4}, {"what": "shelf", "at": "left", "n": 2, "fill": "books"}],
     groups=[{"form": "table", "of": "rt", "n": 6, "name": "staff", "poses": ["sit_type", "sit_lean", "sit_type", "sit_listen"]},
             {"form": "crowd", "n": 2, "area": [-3.0, 1.6, -1.0, 2.6], "poses": ["carry", "carry"], "prop": "box", "name": "runners"}], focus={"id": "runners", "index": 0})
# L61 senators read the finding at a horseshoe table in a closed briefing room
room("senate_brief", 61, room={"w": 10, "d": 8, "h": 3.2, "floor": "carpet", "windows": 0, "wainscot": True, "doors": [{"wall": "left", "at": 0.86}]},
     place=[{"what": "table", "name": "ht", "at": "center", "seats": 8, "len": 3.6, "off": [0.4, -0.3]}, {"what": "screenWall", "at": "back", "nx": 2, "ny": 1}, {"what": "flag", "at": "back", "n": 1},
            {"what": "clock", "at": "left"}, {"what": "filing", "at": "left", "n": 2}],
     people=[{"id": "chairS", "char": "senator", "pose": "speak", "at": "end:ht:0"}],
     groups=[{"form": "table", "of": "ht", "n": 6, "name": "members", "poses": ["sit_lean", "sit_listen", "sit_type"]}], focus="chairS")
# L63 the Treasury: a columned government hall on a city block (exterior)
ext("treasury_block", 63, {"kind": "plain", "relief": 0.06, "size": 230, "shore": False},
    [{"what": "ministry", "where": "center", "focus": True, "name": "treasury"}, {"what": "govHall", "n": 2, "where": "edge"}, {"what": "midrise", "n": 12, "where": "edge"},
     {"what": "trees", "n": 50, "where": "edge"}, {"what": "car", "n": 5, "where": "road"}, {"what": "people", "n": 24, "where": "center"}], light="morning")
# L64 April 2021: a Treasury official reads the statement at a lectern
room("treasury_lectern", 64, room={"w": 11, "d": 8, "h": 3.6, "floor": "wood", "windows": 2, "curtains": True, "doors": [{"wall": "left", "at": 0.86}]},
     place=[{"what": "podium", "name": "lect", "at": "back", "riser": 0.2, "mics": 3, "wallGap": 1.3}, {"what": "flag", "at": "back", "n": 2, "near": "lect"},
            {"what": "chairsRows", "name": "seats", "rows": 2, "cols": 7, "aisle": 1.0, "at": "front-of:lect", "gap": 2.6}],
     groups=[{"form": "podium", "of": "lect", "n": 0, "name": "official", "speakerChar": "spokes"}, {"form": "audience", "of": "seats", "n": 9, "name": "press", "poses": ["sit_type", "sit_listen"]}], focus="official.speaker")
# L65 Aug 2018: a jury trial, the jury box full, the chairman at the defence table
room("fraud_trial", 65, "courtroom", room={"w": 15, "d": 12, "h": 3.9, "floor": "wood", "windows": 4, "wainscot": True},
     people=[{"id": "chair", "char": "chairman", "pose": "sit", "at": "seat:counselB:0"}], focus="chair")
# L66 Dec 2020: the President signs at his desk, aides waiting
room("pardon_desk", 66, room={"w": 9, "d": 7.5, "h": 3.4, "floor": "carpet", "windows": 3, "curtains": True, "doors": [{"wall": "left", "at": 0.86}]},
     place=[{"what": "desk", "name": "pdesk", "at": "center", "variant": "lamp", "off": [0.3, -1.3]}, {"what": "flag", "at": "back", "n": 2}, {"what": "rug", "at": "center", "pad": 1.3},
            {"what": "sofa", "at": "left", "w": 2.0}, {"what": "coffeeTable", "at": "front-of:sofa", "gap": 0.4}, {"what": "clock", "at": "back"}],
     people=[{"id": "pres", "char": "developer", "pose": "sit_type", "prop": "papers", "at": "seat:pdesk:0"}],
     groups=[{"form": "huddle", "n": 3, "at": [2.6, 1.4], "name": "aides", "poses": ["stand", "look_down", "stand_arms_crossed"]}], focus="pres")
# L68 the most famous exhibit: a desk lamp over a fanned file of memos in an empty office
room("dossier_desk", 68, room={"w": 7, "d": 5.5, "h": 2.8, "floor": "wood", "windows": 1, "curtains": True, "doors": [{"wall": "left", "at": 0.82}]},
     place=[{"what": "desk", "name": "ddesk", "at": "center", "variant": "lamp", "off": [0.2, -0.5]}, {"what": "docPile", "at": "near:ddesk"}, {"what": "shelf", "at": "back", "n": 2, "fill": "books"},
            {"what": "chair", "style": "arm", "at": "corner"}],
     people=[{"id": "author", "pose": "look_down", "prop": "papers", "at": "front-of:ddesk", "o": {"coat": True, "tie": True, "hair": "short", "prop": "briefcase"}}], focus="author", light={"time": "evening"})

# ================= CH5 The Stories =================
# L69/L72 a newsroom at night: memos fanned under desk lamps; the chapter title on a stand by the editor's glass
room("night_newsroom", 69, "newsroom", room={"w": 15, "d": 11, "h": 3.2, "floor": "concrete", "windows": 4},
     addPlace=[title(69, "stand", at=[-5.6, 3.4], h=FRONT)],
     people=[{"id": "editor", "pose": "look_down", "prop": "papers", "at": [-3.6, 3.0], "face": 300, "o": {"coat": False, "hair": "short"}}], focus="editor", light={"time": "evening"})
# L70 a law firm's conference room: the invoice passed across the table
room("law_firm", 70, room={"w": 9.5, "d": 7, "h": 3.1, "floor": "wood", "windows": 4, "doors": [{"wall": "left", "at": 0.86}]},
     place=[{"what": "table", "name": "lt", "at": "center", "seats": 6, "len": 3.2}, {"what": "shelf", "at": "back", "n": 3, "fill": "books"}, {"what": "plant", "at": "corner", "n": 2}],
     people=[{"id": "partner", "pose": "speak", "prop": "papers", "at": "end:lt:0", "o": {"coat": True, "tie": True, "hair": "none"}}],
     groups=[{"form": "table", "of": "lt", "n": 4, "name": "clients", "poses": ["sit_listen", "sit_lean", "sit_type"]}], focus="partner")
# L71 the election regulator: commissioners vote at a dais, a hand raised
room("fec_vote", 71, room={"w": 12, "d": 9, "h": 3.4, "floor": "carpet", "windows": 0, "wainscot": True, "doors": [{"wall": "left", "at": 0.86}]},
     place=[{"what": "dais", "name": "dais", "seats": 6, "at": "back"}, {"what": "flag", "at": "back", "n": 2, "near": "dais"},
            {"what": "chairsRows", "name": "public", "rows": 2, "cols": 8, "aisle": 1.0, "at": "front-of:dais", "gap": 3.0}],
     groups=[{"form": "table", "of": "dais", "n": 6, "name": "commissioners", "poses": ["raise_hand", "raise_hand", "sit_listen", "raise_hand", "sit", "raise_hand"]},
             {"form": "audience", "of": "public", "n": 8, "name": "public"}], focus={"id": "commissioners", "index": 0})
# L73 the FBI: an operations room, analysts under a wall of screens
room("fbi_ops", 73, room={"w": 13, "d": 9, "h": 3.2, "floor": "carpet", "windows": 0, "doors": [{"wall": "left", "at": 0.88}]},
     place=[{"what": "screenWall", "at": "back", "nx": 5, "ny": 2}, {"what": "deskRow", "name": "rows", "n": 2, "at": "grid", "cols": 1, "rowsN": 2, "per": 5, "gapZ": 1.6, "h": 0, "off": [0.8, 0.4]},
            {"what": "filing", "at": "left", "n": 3}],
     people=[{"id": "agentL", "pose": "point", "at": [-2.6, -1.6], "face": 270, "o": {"coat": True, "tie": True, "hair": "short"}}],
     groups=[{"form": "table", "of": "rows", "n": 8, "name": "analysts", "poses": ["sit_type", "sit_lean", "sit_type", "phone"]}], focus="agentL")
# L75 the inspector general's office: the watchdog lays his report on a desk
room("ig_office", 75, room={"w": 8, "d": 6.5, "h": 3.0, "floor": "carpet", "windows": 2, "doors": [{"wall": "left", "at": 0.84}]},
     place=[{"what": "desk", "name": "idesk", "at": "back", "variant": "papers"}, {"what": "shelf", "at": "left", "n": 2, "fill": "books"}, {"what": "flag", "at": "back", "n": 1},
            {"what": "wallArt", "kind": "seal", "at": "back", "w": 0.9, "h": 0.9, "y": 2.0}, {"what": "chair", "style": "arm", "n": 2, "at": "front-of:idesk", "gap": 1.0}],
     people=[{"id": "ig", "char": "watchdog", "pose": "look_down", "at": "front-of:idesk"}], focus="ig")
# L76 the FISA applications: a secure file room, a clerk checks pages against a list
room("fisa_files", 76, room={"w": 9.5, "d": 7, "h": 2.9, "floor": "tile", "windows": 0, "doors": [{"wall": "left", "at": 0.84}]},
     place=[{"what": "filing", "name": "safe", "at": "back", "n": 5, "drawers": 4}, {"what": "table", "name": "ft", "at": "center", "seats": 2, "len": 2.4}, {"what": "docPile", "at": "near:ft"}],
     people=[{"id": "checker", "pose": "sit_type", "prop": "papers", "at": "seat:ft:0", "o": {"coat": False, "hair": "long", "skirt": True}},
             {"id": "sup", "pose": "point", "at": "front-of:ft", "o": {"coat": True, "tie": True}}], focus="checker")
# L77 the special court: a small windowless courtroom, one judge, one government lawyer
room("fisa_court", 77, room={"w": 9, "d": 7.5, "h": 3.4, "floor": "carpet", "windows": 0, "wainscot": True, "doors": [{"wall": "left", "at": 0.84}]},
     place=[{"what": "judgeBench", "name": "bench", "at": "back", "focusable": True}, {"what": "flag", "at": "back", "n": 1, "near": "bench"},
            {"what": "witnessTable", "name": "gov", "seats": 1, "at": "front-of:bench", "gap": 2.2, "face": "bench"}, {"what": "clock", "at": "left"}],
     groups=[{"form": "table", "of": "bench", "n": 1, "name": "judge"}, {"form": "table", "of": "gov", "n": 1, "name": "lawyer"}], focus="judge")
# L80 Oct 2022: the acquittal, the jury foreman standing
room("acquittal", 80, "courtroom", room={"w": 13, "d": 11, "h": 3.7, "floor": "carpet", "windows": 2, "wainscot": True},
     groups=[{"form": "table", "of": "jury", "n": 12, "name": "jurors", "poses": ["sit_listen", "sit", "sit_listen", "stand"]}], focus={"id": "jurors", "index": 3})
# L81 May 2023: the special counsel's report handed over in a wood-panelled office
room("durham_office", 81, room={"w": 8, "d": 6.5, "h": 3.2, "floor": "wood", "windows": 2, "curtains": True, "wainscot": True, "doors": [{"wall": "left", "at": 0.84}]},
     place=[{"what": "desk", "name": "ddesk", "at": "back", "variant": "lamp"}, {"what": "shelf", "at": "left", "n": 3, "fill": "books"}, {"what": "flag", "at": "back", "n": 1}],
     people=[{"id": "d1", "pose": "handshake_L", "prop": "papers", "at": [0.0, 1.2], "face": 0, "with": "handover", "o": {"coat": True, "tie": True, "hair": "short", "build": 1.05}},
             {"id": "d2", "pose": "handshake_R", "at": [0.875, 1.2], "face": 180, "with": "handover", "o": {"coat": True, "tie": True, "hair": "none"}}], focus="handover")
# L83/L86 the claims: a bookshop window across a rainy street, a crowd at the display
room("book_street", 83, "market", street={"w": 46, "d": 32, "kind": "market", "facades": ["back", "left"], "road": "front"},
     place=[{"what": "stall", "name": "display", "n": 3, "at": "aisle"}, {"what": "lampPost", "n": 2, "at": "plaza"}],
     groups=[{"form": "workers", "of": "stall", "name": "sellers"}, {"form": "crowd", "n": 16, "area": "aisle", "poses": ["look_down", "stand", "walk", "look_down"], "prop": "papers", "name": "browsers"}],
     focus={"id": "sellers", "index": 0}, light={"time": "overcast"})
# L84 Jan 2021: a book talk, the author and a guest at a table before rows of chairs
room("book_talk", 84, room={"w": 11, "d": 8, "h": 3.0, "floor": "wood", "windows": 2, "doors": [{"wall": "left", "at": 0.86}]},
     place=[{"what": "table", "name": "panel", "at": "back", "seats": 2, "sides": "one", "len": 2.2}, {"what": "shelf", "at": "back", "n": 3, "fill": "books"}, {"what": "shelf", "at": "left", "n": 2, "fill": "books"},
            {"what": "chairsRows", "name": "rows", "rows": 2, "cols": 7, "aisle": 1.0, "at": "front-of:panel", "gap": 2.0}],
     groups=[{"form": "table", "of": "panel", "n": 2, "name": "speakers", "poses": ["speak", "sit_listen"]}, {"form": "audience", "of": "rows", "n": 9, "name": "readers"}], focus="speakers")
# L87 Feb 2025: a man types a post on a laptop at a kitchen counter at night
room("post_kitchen", 87, room={"w": 6.5, "d": 5.5, "h": 2.7, "floor": "tile", "windows": 1, "curtains": True, "doors": [{"wall": "left", "at": 0.8}]},
     place=[{"what": "counter", "name": "kc", "len": 2.6, "at": "back"}, {"what": "table", "name": "kt", "at": "center", "seats": 2, "len": 1.2}, {"what": "plant", "at": "corner"}],
     people=[{"id": "poster", "pose": "sit_type", "prop": "laptop", "at": "seat:kt:0", "o": {"coat": False, "hair": "short", "build": 1.1}}], focus="poster", light={"time": "evening"})
# L89 fact checkers at a long desk, phones and papers
room("factcheck_desk", 89, "trollfarm", room={"w": 12, "d": 9, "floor": "concrete", "windows": 4},
     groups=[{"form": "table", "of": "rows", "n": 12, "name": "checkers", "poses": ["phone", "sit_type", "sit_lean", "sit_type"]},
             {"form": "huddle", "n": 2, "at": [-3.6, 2.6], "name": "editors", "poses": ["point", "look_down"]}], focus="editors", light={"time": "afternoon"})

# ================= CH6 Helsinki =================
# L92/L93 a palace hall: two armchairs, interpreters standing behind; the chapter plaque on the panelling
room("palace_hall", 92, room={"w": 13, "d": 9, "h": 4.6, "floor": "wood", "windows": 4, "curtains": True, "wainscot": True, "doors": [{"wall": "left", "at": 0.86, "w": 1.8}]},
     place=[{"what": "chair", "name": "armA", "style": "arm", "at": [-0.9, -0.6]}, {"what": "chair", "name": "armB", "style": "arm", "at": [0.9, -0.6]},
            {"what": "coffeeTable", "at": [0.0, 0.1]}, {"what": "rug", "at": "center", "pad": 1.6}, {"what": "flag", "at": "back", "n": 2}, {"what": "plant", "at": "corner", "n": 2},
            title(92, "plaque", at="back", near=[-4.0, 0])],
     people=[{"id": "dev", "char": "developer", "pose": "sit_listen", "at": [-0.9, -0.6], "face": 60, "with": "leaders"},
             {"id": "lead", "char": "leader", "pose": "sit_lean", "at": [0.9, -0.6], "face": 120, "with": "leaders"},
             {"id": "i1", "pose": "stand", "at": [-1.6, -1.6], "face": 60, "o": {"coat": True, "hair": "bun", "skirt": True}},
             {"id": "i2", "pose": "stand", "at": [1.6, -1.6], "face": 120, "o": {"coat": True, "hair": "short"}}], focus="leaders")
# L94 afterwards: the joint press conference, two lecterns, a bank of cameras
room("summit_press", 94, room={"w": 14, "d": 10, "h": 3.8, "floor": "carpet", "windows": 0, "doors": [{"wall": "left", "at": 0.88}]},
     place=[{"what": "lectern", "name": "lA", "at": [-1.2, -3.4]}, {"what": "lectern", "name": "lB", "at": [1.2, -3.4]}, {"what": "flag", "at": "back", "n": 4},
            {"what": "chairsRows", "name": "seats", "rows": 4, "cols": 9, "aisle": 1.2, "at": "front", "near": [0.4, 0]}, {"what": "tvCamera", "n": 4, "at": "side:seats", "face": "lA"}],
     people=[{"id": "dev", "char": "developer", "pose": "speak", "at": "front-of:lA"}, {"id": "lead", "char": "leader", "pose": "stand", "at": "front-of:lB"}],
     groups=[{"form": "audience", "of": "seats", "n": 22, "name": "press", "poses": ["sit_type", "sit_listen", "raise_hand"]}, {"form": "workers", "of": "tvCamera", "name": "crew"}], focus="dev")
# L96 the Senate corridor: a senator answers reporters
room("senate_hall", 96, room={"w": 12, "d": 6, "h": 4.2, "floor": "tile", "windows": 3, "wainscot": True, "doors": [{"wall": "left", "at": 0.5, "w": 1.8}]},
     place=[{"what": "bench", "n": 2, "at": "back"}, {"what": "flag", "at": "back", "n": 1}, {"what": "plant", "at": "corner", "n": 2}],
     people=[{"id": "sen", "char": "senator", "pose": "speak", "at": [0.0, 0.8], "face": 90}],
     groups=[{"form": "crowd", "n": 7, "area": [-2.6, 1.6, 2.6, 2.6], "toward": "sen", "poses": ["phone", "look_down", "stand", "phone"], "prop": "phone", "name": "reporters"}], focus="sen")
# L97 the counter-evidence table: a second clerk lays out a different set of folders
room("counter_table", 97, room={"w": 10, "d": 7, "h": 3.0, "floor": "wood", "windows": 2, "doors": [{"wall": "left", "at": 0.84}]},
     place=[{"what": "table", "name": "ct", "at": "center", "seats": 4, "len": 3.4}, {"what": "boxes", "kind": "card", "n": 3, "at": "back"}, {"what": "filing", "at": "left", "n": 2}],
     people=[{"id": "clerk", "char": "clerk", "pose": "look_down", "prop": "papers", "at": "front-of:ct"}],
     groups=[{"form": "table", "of": "ct", "n": 2, "name": "readers", "poses": ["sit_lean", "sit_type"]}], focus="clerk")
# L98 March 2018: an army depot, missile crates stacked, soldiers loading a truck
room("javelin_depot", 98, "factory", room={"w": 18, "d": 12, "h": 6.0, "floor": "concrete", "windows": 3, "highWindows": True},
     place=[{"what": "crates", "name": "javelins", "kind": "crate", "n": 5, "at": "center"}, {"what": "crates", "kind": "crate", "n": 4, "at": "back"}, {"what": "shelf", "n": 2, "at": "left", "fill": "boxes"}],
     groups=[{"form": "crowd", "n": 6, "area": "aisles", "poses": ["carry", "carry", "point", "stand"], "prop": "box", "name": "soldiers", "o": {"hat": "cap", "coat": False}}], focus={"id": "soldiers", "index": 2})
# L100 later that month: expelled officials queue at an airport gate
room("expel_gate", 100, "airport", room={"floor": "tile"}, focus="queue", light={"time": "morning"})
# L101 all in 2018: the clerk pins three folders to a board beside the second table
room("pin_board", 101, room={"w": 8.5, "d": 6.5, "h": 3.0, "floor": "carpet", "windows": 1, "doors": [{"wall": "left", "at": 0.84}]},
     place=[{"what": "whiteboard", "name": "board", "at": "back"}, {"what": "table", "name": "pt", "at": "center", "seats": 2, "len": 1.8, "off": [0.6, 0.8]}, {"what": "filing", "at": "left", "n": 2}],
     people=[{"id": "clerk", "char": "clerk", "pose": "point", "at": "front-of:board", "face": 270}], focus="clerk")
# L102 Aug 2025: an air base in Alaska, a jet on the apron, a red carpet line
room("alaska_apron", 102, "airport", room={"w": 22, "d": 13, "floor": "concrete"}, focus="jet", light={"time": "afternoon"})
# L103 the oil companies: a refinery and tank farm by a river
ext("refinery_r", 103, {"kind": "river", "relief": 0.1, "size": 260, "width": 18, "angle": -22},
    [{"what": "refinery", "where": "center", "focus": True, "name": "ref"}, {"what": "tankFarm", "n": 2, "where": "edge"}, {"what": "pipeRack", "n": 2, "where": "edge"},
     {"what": "flareStack", "n": 1, "where": "edge"}, {"what": "trees", "n": 40, "where": "edge"}], light="overcast")
# L105 every entry proven: the clerk stamps a row of folders that split into two piles
room("two_piles", 105, room={"w": 9, "d": 6.5, "h": 3.0, "floor": "tile", "windows": 2, "doors": [{"wall": "left", "at": 0.84}]},
     place=[{"what": "table", "name": "pA", "at": [-1.8, -0.4], "seats": 2, "len": 1.8, "h": 0}, {"what": "table", "name": "pB", "at": [1.9, -0.4], "seats": 2, "len": 1.8, "h": 0},
            {"what": "docPile", "at": "back"}, {"what": "clock", "at": "back"}],
     people=[{"id": "clerk", "char": "clerk", "pose": "point", "at": [0.0, 1.0], "face": 270}], focus="clerk")
# L106 that leaves the investigations: the Justice Department steps at dusk
room("justice_dusk", 106, "steps", street={"w": 60, "d": 42, "kind": "steps", "facades": ["back", "left"], "road": "front"},
     groups=[{"form": "crowd", "n": 14, "area": "plaza", "poses": ["walk", "stand", "phone"], "name": "staff"}, {"form": "procession", "n": 3, "at": "steps-foot", "name": "officials", "o": {"coat": True, "tie": True, "prop": "briefcase"}}],
     focus={"id": "officials", "index": 0}, light={"time": "evening"})

# ================= CH7 The Verdicts =================
# L107/L118/L133 the courtroom whose jury box holds tall stacks of bound reports; title plaque by the bench
room("report_court", 107, room={"w": 15, "d": 12, "h": 4.2, "floor": "wood", "windows": 4, "wainscot": True, "doors": [{"wall": "left", "at": 0.86, "w": 1.6}]},
     place=[{"what": "judgeBench", "name": "bench", "at": "back", "focusable": True}, {"what": "flag", "at": "back", "n": 2, "near": "bench"},
            {"what": "juryBox", "name": "jury", "at": "left", "near": [0, -1.8]}, {"what": "docPile", "name": "reportsA", "at": "near:jury"}, {"what": "boxes", "kind": "card", "n": 4, "at": "near:jury"},
            {"what": "pews", "name": "gallery", "rows": 3, "len": 9, "aisle": 1.2, "bar": True, "at": "front"}, title(107, "plaque", at="back", near=[4.2, 0])],
     groups=[{"form": "audience", "of": "gallery", "n": 12, "name": "public"}],
     people=[{"id": "clerk", "char": "clerk", "pose": "carry", "prop": "box", "at": [-2.0, 1.2], "face": 180}], focus="clerk")
# L109 Feb 2018: a prosecutor announces charges beside an easel of names
room("charges_podium", 109, "pressroom", room={"w": 12, "d": 9, "h": 3.4, "floor": "carpet"},
     place=[{"what": "podium", "name": "podium", "at": "back", "riser": 0.2, "mics": 6, "wallGap": 1.2}, {"what": "whiteboard", "name": "easel", "at": "near:podium"}, {"what": "flag", "at": "back", "n": 2, "near": "podium"},
            {"what": "chairsRows", "name": "seats", "rows": 3, "cols": 9, "aisle": 1.2, "at": "front-of:podium", "gap": 3.4}, {"what": "tvCamera", "n": 3, "at": "side:seats", "face": "podium"}],
     groups=[{"form": "podium", "of": "podium", "n": 0, "name": "pros", "speakerChar": "spokes"}, {"form": "audience", "of": "seats", "n": 18, "name": "reporters"}, {"form": "workers", "of": "tvCamera", "name": "camOps"}],
     focus="pros.speaker")
# L110 the organisations: a St Petersburg office floor of desks in rows (as charged in the indictment)
room("ira_floor", 110, "trollfarm", room={"w": 15, "d": 11, "floor": "tile", "windows": 4}, focus={"id": "operators", "index": 6}, light={"time": "evening"})
# L111 July 2018: a military intelligence headquarters, officers at a long table (as charged)
room("gru_table", 111, room={"w": 11, "d": 8, "h": 3.4, "floor": "wood", "windows": 0, "wainscot": True, "doors": [{"wall": "left", "at": 0.86}]},
     place=[{"what": "boardroomTable", "name": "gt", "at": "center", "seats": 12}, {"what": "flag", "at": "back", "n": 1}, {"what": "screenWall", "at": "back", "nx": 2, "ny": 1}, {"what": "filing", "at": "left", "n": 2}],
     groups=[{"form": "table", "of": "gt", "n": 12, "name": "officers", "poses": ["sit_type", "sit_lean", "sit_listen"], "o": {"hat": "peak", "coat": True}}], focus={"id": "officers", "index": 0})
# L116 the scale: a basement records hall of subpoena boxes and witness binders
room("subpoena_hall", 116, "factory", room={"w": 18, "d": 12, "h": 4.0, "floor": "concrete", "windows": 2, "highWindows": True},
     place=[{"what": "shelf", "name": "racks", "n": 8, "at": "grid", "cols": 4, "rowsN": 2, "gapX": 1.4, "gapZ": 2.0, "h": 0, "fill": "boxes", "height": 2.6, "off": [1.2, -1.0]},
            {"what": "boxes", "kind": "card", "n": 5, "at": "front"}],
     groups=[{"form": "crowd", "n": 5, "area": "aisles", "poses": ["carry", "look_down", "carry", "carry", "point"], "prop": "box", "name": "clerks"}], focus={"id": "clerks", "index": 1})
# L122/L123 the committee: senators of both parties leave a hearing, splitting into two knots in the corridor
room("senate_split", 122, room={"w": 14, "d": 7, "h": 4.0, "floor": "tile", "windows": 4, "wainscot": True, "doors": [{"wall": "left", "at": 0.5, "w": 1.8}]},
     place=[{"what": "bench", "n": 2, "at": "back"}, {"what": "flag", "at": "back", "n": 2}, {"what": "plant", "at": "corner", "n": 2}],
     groups=[{"form": "huddle", "n": 3, "at": [-3.0, 1.4], "name": "sideA", "poses": ["speak", "stand_arms_crossed", "look_down"], "o": {"coat": True, "tie": True}},
             {"form": "huddle", "n": 3, "at": [3.0, 1.4], "name": "sideB", "poses": ["point", "stand", "stand_arms_crossed"], "o": {"coat": True, "tie": True}}],
     people=[{"id": "chairS", "char": "senator", "pose": "walk", "at": [0.0, 2.2], "face": 90}], focus="chairS")
# L124 the FBI's counterintelligence floor: agents at a corner table, a folder with no name on it
room("ci_office", 124, room={"w": 9, "d": 7, "h": 2.9, "floor": "carpet", "windows": 1, "doors": [{"wall": "left", "at": 0.84}]},
     place=[{"what": "roundTable", "name": "rt", "at": "center", "seats": 4}, {"what": "filing", "at": "back", "n": 4, "drawers": 4}, {"what": "whiteboard", "at": "left"}, {"what": "clock", "at": "back"}],
     groups=[{"form": "table", "of": "rt", "n": 4, "name": "agents", "poses": ["sit_lean", "sit_type", "sit_listen", "sit_lean"]}], focus={"id": "agents", "index": 0})
# L126 Jan 2019: the President speaks to reporters on a lawn by a helicopter pad
room("lawn_gaggle", 126, scale="street", street={"w": 56, "d": 38, "kind": "plaza", "facades": ["back"], "road": "front"},
     place=[{"what": "tree", "n": 5, "at": "plaza"}, {"what": "tvCamera", "n": 3, "at": "plaza"}, {"what": "barrier", "n": 1, "len": 10, "at": "plaza"}],
     groups=[{"form": "podium", "at": [0, 5], "n": 14, "name": "gaggle", "speakerChar": "developer"}], focus="gaggle.speaker", light={"time": "overcast"})
# L129 the clerk's side desk: the stories folder gets its stamp
room("stamp_side", 129, room={"w": 7, "d": 5.5, "h": 2.9, "floor": "wood", "windows": 1, "doors": [{"wall": "left", "at": 0.8}]},
     place=[{"what": "desk", "name": "sd", "at": "back", "variant": "papers"}, {"what": "shelf", "at": "left", "n": 2, "fill": "boxes"}, {"what": "plant", "at": "corner"}],
     people=[{"id": "clerk", "char": "clerk", "pose": "sit_type", "prop": "papers", "at": "seat:sd:0"}], focus="clerk")

# ================= PAYOFF =================
# L132 the Capitol at dusk (exterior)
ext("capitol_dusk", 132, {"kind": "plain", "relief": 0.1, "size": 250, "shore": False},
    [{"what": "parliament", "where": "center", "focus": True, "name": "capitol"}, {"what": "govHall", "n": 3, "where": "edge"}, {"what": "trees", "n": 90, "where": "edge"},
     {"what": "midrise", "n": 8, "where": "edge"}, {"what": "car", "n": 4, "where": "road"}], light="evening")
# L134 the end card over a city at dusk: the tower district by the river (exterior, built fresh)
ext("city_end", 134, {"kind": "river", "relief": 0.12, "size": 260, "width": 26, "angle": 8},
    [{"what": "tower", "where": "center", "focus": True, "name": "tower"}, {"what": "midrise", "n": 16, "where": "edge"}, {"what": "trees", "n": 60, "where": "edge"}, {"what": "car", "n": 5, "where": "road"}],
    light="evening")

# ================= MG beats: numbers and mechanisms only (values and quotes from script.md / its fact block) =================
MG = []
def beat(id, *parts): MG.append({"id": id, "parts": [{"kind": k, "data": d, **({"role": r} if r else {})} for k, d, r in parts]}); return id
beat("email", ("annotatedDoc", {"head": "Email to Don Jr., 3 June 2016", "ref": "as quoted in the Mueller report", "cap": "How the email describes it", "body": [
      {"t": "…part of Russia and its government's support for Mr. Trump…", "hi": 2, "note": "the sender's words"}]}, None))
beat("asset", ("dominoes", {"chain": [{"label": "A foreign spy service", "what": "magnifier"}, {"label": "Recruits someone", "what": "handshake"}, {"label": "Or can lean on them", "what": "padlock"},
      {"label": "= an asset", "what": "person"}], "cap": "What 'asset' means in spy talk", "redIndex": 3}, None))
beat("stamps", ("stampedPermit", {"title": "The four stamps", "no": "Trial rules", "fields": [{"k": "PROVEN", "v": "on the record, or admitted in court"}, {"k": "ALLEGED", "v": "someone claimed it"},
      {"k": "DISPROVEN", "v": "an official finding contradicts it"}, {"k": "UNVERIFIED", "v": "no supporting evidence made public"}], "checks": ["Public record only", "One piece at a time"], "sign": "Clerk", "stamp": "RULES", "cap": "Every exhibit gets one stamp"}, None))
beat("price", ("illustratedBars", {"items": [{"label": "Bought, 2004", "value": 41}, {"label": "Sold, 2008", "value": 95}], "object": "house", "unit": "$ million", "cap": "The Palm Beach mansion", "note": "approx."}, None))
beat("nomeet", ("stampedPermit", {"title": "A Putin meeting, Nov 2013?", "no": "Exhibit 1-D", "fields": [{"k": "Kremlin spokesman, May 2016", "v": "the two had not met"}, {"k": "Special counsel", "v": "no finding either way"}],
      "checks": ["Official finding"], "sign": "Clerk", "stamp": "NOT PROVEN", "cap": "Can't be stamped proven"}, None))
beat("loi", ("splitAvsB", {"a": {"label": "Letter of intent", "object": "documentPage"}, "b": {"label": "Contract", "object": "gavel"}, "rows": [{"label": "Both sides want to keep talking", "a": True, "b": True},
      {"label": "A binding deal", "a": False, "b": True}, {"label": "Signed, Oct 2015 (I.C. Expert)", "a": True, "b": False}], "cap": "A first step, not a deal"}, None))
beat("talks", ("ganttBars", {"tasks": [{"label": "Letter of intent", "start": 0, "end": 1, "what": "documentPage"}, {"label": "Email to the Kremlin office", "start": 3, "end": 3.6, "what": "phone"},
      {"label": "Trump Moscow talks", "start": 0, "end": 8, "what": "tower"}, {"label": "The June email", "start": 8, "end": 8.6, "what": "documentPage"}], "from": 0, "to": 9, "unit": "mo", "cap": "Oct 2015 to June 2016 (Mueller)", "redIndex": 2}, None))
beat("proven2", ("stampedPermit", {"title": "Exhibit 2: Tower talks", "no": "Proven column", "fields": [{"k": "Talks ran to", "v": "June 2016"}, {"k": "Told to Congress", "v": "a false timeline (guilty plea, Nov 2018)"}],
      "checks": ["Special counsel finding", "Guilty plea"], "sign": "Clerk", "stamp": "PROVEN", "cap": "Two entries, both on the record"}, None))
beat("aboutwhat", ("splitAvsB", {"a": {"label": "The email", "object": "documentPage"}, "b": {"label": "The meeting (Mueller)", "object": "chair"}, "rows": [{"label": "Russia's support for Mr. Trump", "a": True, "b": False},
      {"label": "Magnitsky Act sanctions", "a": False, "b": True}, {"label": "Adoptions", "a": False, "b": True}], "cap": "Promised versus discussed"}, None))
beat("cflaw", ("dominoes", {"chain": [{"label": "Help is offered", "what": "documentPage"}, {"label": "Who is offering it?", "what": "person"}, {"label": "May the campaign accept it?", "what": "ballot"},
      {"label": "Campaign finance law decides", "what": "gavel"}], "cap": "What campaign finance law covers", "redIndex": 3}, None))
beat("hurdles", ("stepRail", {"steps": [{"label": "Prove they knew it broke the law", "what": "magnifier"}, {"label": "Put a value on what was promised", "what": "coinStack"}, {"label": "Charge declined", "what": "documentPage"}],
      "cap": "Why no charge (Mueller)", "note": "neither could be shown"}, None))
beat("tenure", ("ganttBars", {"tasks": [{"label": "On the campaign", "start": 3, "end": 8.6, "what": "person"}, {"label": "Campaign chairman", "start": 5.6, "end": 8.6, "what": "chair"}],
      "from": 3, "to": 9, "unit": "mo", "cap": "2016: March to August", "redIndex": 1}, None))
beat("polls", ("feedbackLoop", {"stages": [{"label": "Ask voters", "what": "person"}, {"label": "Private survey numbers", "what": "documentPage"}, {"label": "Steer the campaign", "what": "ballot"}],
      "cap": "Polling data: a campaign's own numbers", "loopLabel": "kept in-house", "sign": "+", "laps": "pass"}, None))
beat("nowhy", ("quoteCard", {"quote": "could not reliably determine", "em": "could not", "by": "Special counsel", "role": "on why the data was shared", "when": "2019", "cap": "The reason, unknown"}, None))
beat("officer", ("sourceCard", {"value": "\"a Russian intelligence officer\"", "unit": "the committee's words for the associate", "source": {"pub": "Senate Intelligence Committee", "title": "Report Vol. 5", "year": "Aug 2020", "page": "bipartisan, Republican-led"}, "cap": "The Senate's finding"}, None))
beat("risk", ("linkBoard", {"items": [{"id": "c", "cap": "Campaign chairman", "what": "person"}, {"id": "a", "cap": "His associate", "what": "person"}, {"id": "s", "cap": "Foreign spy service", "what": "magnifier", "key": True, "sub": "could use him"}],
      "links": [["c", "a"], ["a", "s", True]], "cap": "The risk the committee saw"}, None))
beat("proven4", ("tallyBoard", {"items": [{"label": "Data shared with the associate (Mueller)", "count": 1, "object": "documentPage"}, {"label": "Passed to Russian intelligence (Treasury)", "count": 1, "object": "documentPage"},
      {"label": "Reason found", "count": 0, "object": "magnifier"}], "unit": "findings", "cap": "Stamped proven; the why unknown", "redIndex": 2}, None))
beat("opened", ("splitFlapDate", {"text": "31 JUL 2016", "groups": ["DAY", "MONTH", "YEAR"], "what": "magnifier", "label": "FBI inquiry opened, after an Australian diplomat's tip", "cap": "Crossfire Hurricane"}, None))
beat("igfind", ("splitAvsB", {"a": {"label": "Surveillance requests", "object": "documentPage"}, "b": {"label": "Opening the inquiry", "object": "magnifier"}, "rows": [{"label": "Significant errors or omissions", "a": "17", "b": "-"},
      {"label": "Documentary evidence of political bias", "a": "-", "b": "none found"}], "cap": "Inspector general, Dec 2019"}, None))
beat("hearsay", ("quoteCard", {"quote": "word of mouth and hearsay", "em": "hearsay", "by": "The dossier's main source", "role": "describing his own information", "cap": "In his own words"}, None))
beat("bar", ("balanceScale", {"left": {"label": "Durham: opened on raw intelligence", "what": "documentPage", "n": 1, "weight": 1}, "right": {"label": "Inspector general: bar was met", "what": "documentPage", "n": 1, "weight": 1},
      "cap": "Was the bar to open it met?", "note": "they disagree"}, None))
beat("claim40", ("quoteCard", {"quote": "cultivated as an asset for 40 years", "by": "A former KGB major (claim)", "role": "via an author's book", "when": "Jan 2021", "cap": "A claim: no evidence made public"}, None))
beat("krasnov", ("stampedPermit", {"title": "Claim: 'Krasnov', 1987", "no": "Facebook post, Feb 2025", "fields": [{"k": "Said by", "v": "a former Kazakh security official"}, {"k": "Evidence offered", "v": "none"},
      {"k": "Fact checkers", "v": "found none"}], "checks": ["Evidence made public"], "sign": "Clerk", "stamp": "UNVERIFIED", "cap": "A claim, not a finding"}, None))
beat("bothclaims", ("splitAvsB", {"a": {"label": "Former KGB major", "object": "documentPage"}, "b": {"label": "Former Kazakh official", "object": "phone"}, "rows": [{"label": "Evidence made public", "a": False, "b": False},
      {"label": "Stamp", "a": "UNVERIFIED", "b": "UNVERIFIED"}], "cap": "Two stories, one stamp"}, None))
beat("wouldnt", ("splitAvsB", {"a": {"label": "16 July", "object": "mic"}, "b": {"label": "17 July", "object": "documentPage"}, "rows": [{"label": "The word he used", "a": "would", "b": "wouldn't"},
      {"label": "Where", "a": "Helsinki, beside Putin", "b": "back in Washington"}], "cap": "One word, a day apart"}, None))
beat("javelins", ("objectCounter", {"value": 210, "unit": "Javelin anti-tank missiles", "per": "approved for Ukraine", "object": "missile", "each": 10, "cap": "March 2018: about $47 million"}, None))
beat("same_file", ("balanceScale", {"left": {"label": "McCain's verdict", "what": "documentPage", "n": 1, "weight": 1}, "right": {"label": "Oil sanctions, Oct 2025", "what": "oilTank", "n": 1, "weight": 1},
      "cap": "Same file, neither cancels the other"}, None))
beat("sweeping", ("quoteCard", {"quote": "in sweeping and systematic fashion", "em": "sweeping", "by": "Special counsel", "role": "on Russia's interference", "when": "18 Apr 2019", "cap": "Mueller report, Vol. I"}, None))
beat("interf", ("stampedPermit", {"title": "Exhibit 7: Interference", "no": "Charges, 2018", "fields": [{"k": "Russian nationals", "v": "13"}, {"k": "Russian organisations", "v": "3"}, {"k": "GRU officers", "v": "12"}],
      "checks": ["Indictments", "Special counsel finding"], "sign": "Clerk", "stamp": "PROVEN", "cap": "The easiest stamp in the trial"}, None))
beat("benefit", ("annotatedDoc", {"head": "Mueller report, Vol. I", "ref": "April 2019", "cap": "Both sides expected to gain", "body": [
      {"t": "Russia \"perceived it would benefit from a Trump presidency\"", "hi": 1, "note": "Russia"},
      {"t": "the Campaign \"expected it would benefit electorally from information stolen and released through Russian efforts\"", "hi": 2, "note": "the campaign"}]}, None))
beat("charged", ("tallyBoard", {"items": [{"label": "People charged", "count": 34, "object": "person"}, {"label": "Companies charged", "count": 3, "object": "documentPage"},
      {"label": "Charged with conspiring with Russia", "count": 0, "object": "person"}], "unit": "charged", "cap": "Thirty-four people, none for conspiracy", "redIndex": 2}, None))
beat("exonerate", ("quoteCard", {"quote": "while this report does not conclude that the President committed a crime, it also does not exonerate him", "em": "does not exonerate him",
      "by": "Special counsel", "role": "on obstruction", "when": "Mueller report, Vol. II", "cap": "Exonerate = clear him"}, None))
beat("ci", ("dominoes", {"chain": [{"label": "A foreign power", "what": "magnifier"}, {"label": "Influence over someone?", "what": "person"}, {"label": "The FBI checks", "what": "documentPage"},
      {"label": "A counterintelligence inquiry", "what": "padlock"}], "cap": "What a counterintelligence inquiry is", "redIndex": 3}, None))
beat("tally_proven", ("stampedPermit", {"title": "The tally: proven", "no": "Exhibits 1-7", "fields": [{"k": "1", "v": "Russian interference"}, {"k": "2", "v": "Moscow talks to June 2016"}, {"k": "3", "v": "The June meeting"},
      {"k": "4", "v": "Polling data shared with Kilimnik"}], "checks": ["Public record"], "sign": "Clerk", "stamp": "PROVEN", "cap": "Proven"}, None))
beat("tally_ne", ("stampedPermit", {"title": "The tally: not established", "no": "Special counsel", "fields": [{"k": "Claim", "v": "a conspiracy between the campaign and the Russian government"}, {"k": "Finding", "v": "not established"}],
      "checks": ["Public record"], "sign": "Clerk", "stamp": "NOT ESTABLISHED", "cap": "Not established"}, None))

# ================= a visual for every voiced line =================
def W(set, kind, callout=None, subject="focus", **kw):
  v = {"set": set, "subject": subject, "kind": kind}
  if callout: v["callout"] = callout
  v.update(kw); return v
def D(b, f=0): return {"mg": b, "focus": f, "kind": "data"}
LV = {
  1: W("son_office", "person", "3 June 2016"), 2: D("email"), 3: W("son_office", "person", "The reply", framing="detail"), 4: W("avenue_scrum", "person", "The question"),
  5: W("evidence_hall", "person", "The trial: public record only"), 6: D("asset"), 7: W("records_stacks", "person", "Official reports, court cases"),
  8: D("stamps"), 9: D("stamps"), 10: W("stamp_counter", "person", "Stamps on evidence, not the man"), 11: W("volume_trolley", "person", "448 pages"),
  12: W("moscow87", "place", "Moscow, 1987"), 13: W("intourist_kerb", "person", "Invited by Intourist"), 14: W("announce96", "person", "1996: ≈$250m, never built"),
  15: W("plans_office", "person", "Mid-2000s: Bayrock"), 16: W("ballroom08", "person", "Sept 2008"), 17: W("ballroom08", "person", "Reported, not recorded", subject="delegates"),
  18: W("ballroom08", "person", "No recording", subject="reporter"), 19: W("villa_gate", "person", "2008: $95 million"), 20: W("palm_villa", "place", "Bought 2004: ≈$41 million"), 21: D("price"),
  22: W("pageant_hall", "person", "Miss Universe, Nov 2013"), 23: W("tower_desk13", "person", "A tweet, June 2013"), 24: W("kremlin_brief", "person", "Kremlin, May 2016: no meeting"), 25: D("nomeet"),
  26: W("rally15", "street", "Then: a campaign"),
  27: W("model_office", "person", "Autumn 2015"), 28: W("loi_table", "person", "Letter of intent"), 29: D("loi"), 30: W("fixer_desk", "person", "Jan 2016: an email"),
  31: W("moscow_phone", "person", "≈20-minute call"), 32: W("counsel_office", "person", "The special counsel"), 33: W("doj_corridor", "person", "Appointed May 2017"), 34: D("talks"),
  35: W("court_steps18", "person", "Nov 2018: guilty plea"), 36: W("plea_court", "person", "Admitting it before a judge"), 37: W("house_room", "person", "Congress: the wrong timeline"), 38: D("proven2"),
  39: W("son_office", "person", "June 2016", framing="threeQuarter"),
  40: W("tower_meeting", "person", "From Rob Goldstone"), 41: D("email"), 42: W("tower_meeting", "person", "One line long", framing="detail"), 43: W("fifth_ave", "person", "9 June 2016, Trump Tower"),
  44: W("tower_meeting", "person", "The guest", subject="guest"), 45: W("intel_dais", "person", "Senate intelligence committee"), 46: W("tower_meeting", "person", "Magnitsky Act; adoptions", subject="guest", framing="threeQuarter"),
  47: D("aboutwhat"), 48: W("charge_room", "person", "Charge considered, declined"), 49: D("cflaw"), 50: D("hurdles"), 51: W("evidence_hall", "person", "On the record; no charge"),
  52: W("campaign_hq", "person", "The campaign chairman"),
  53: W("lamp_street", "person", "Joined March 2016"), 54: D("tenure"), 55: W("back_room", "person", "Polling data shared"), 56: D("polls"),
  57: W("data_room", "person", "Usually guarded"), 58: D("nowhy"), 59: W("report_room", "person", "Senate report, Aug 2020"), 60: D("officer"),
  61: W("senate_brief", "person", "'A grave counterintelligence threat'"), 62: D("risk"), 63: W("treasury_block", "place", "US Treasury, April 2021"), 64: W("treasury_lectern", "person", "Data passed to Russian intelligence"),
  65: W("fraud_trial", "person", "Aug 2018: 8 counts, fraud"), 66: W("pardon_desk", "person", "Dec 2020: pardoned"), 67: D("proven4"), 68: W("dossier_desk", "person", "The Steele dossier"),
  69: W("night_newsroom", "person", "Memos for Fusion GPS"), 70: W("law_firm", "person", "Paid via a law firm"), 71: W("fec_vote", "person", "2022: fined"), 72: W("night_newsroom", "person", "10 Jan 2017: published", subject="staff"),
  73: W("fbi_ops", "person", "Crossfire Hurricane"), 74: D("opened"), 75: W("ig_office", "person", "Inspector general, Dec 2019"), 76: W("fisa_files", "person", "Requests to watch a campaign adviser"),
  77: W("fisa_court", "person", "A special court"), 78: D("igfind"), 79: D("hearsay"), 80: W("acquittal", "person", "Oct 2022: not guilty"),
  81: W("durham_office", "person", "Durham report, May 2023"), 82: D("bar"), 83: W("book_street", "street", "Two claims"), 84: W("book_talk", "person", "A claim, Jan 2021"),
  85: D("claim40"), 86: W("book_street", "street", "No evidence made public", subject="browsers"), 87: W("post_kitchen", "person", "A post, Feb 2025"), 88: D("krasnov"),
  89: W("factcheck_desk", "person", "Fact checkers: none found"), 90: D("bothclaims"), 91: W("evidence_hall", "person", "In office?", framing="threeQuarter"),
  92: W("palace_hall", "person", "Helsinki, 16 July 2018"), 93: W("palace_hall", "person", "≈2 hours, interpreters only", subject="set"), 94: W("summit_press", "person", "'I don't see any reason why it would be'"),
  95: D("wouldnt"), 96: W("senate_hall", "person", "'One of the most disgraceful'"), 97: W("counter_table", "person", "Also on the record"), 98: W("javelin_depot", "person", "March 2018: Javelins to Ukraine"),
  99: D("javelins"), 100: W("expel_gate", "person", "60 Russian officials expelled"), 101: W("pin_board", "person", "All in 2018"), 102: W("alaska_apron", "person", "Alaska, Aug 2025"),
  103: W("refinery_r", "place", "Oct 2025: sanctions"), 104: D("same_file"), 105: W("two_piles", "person", "Proven, pointing both ways"), 106: W("justice_dusk", "person", "The official investigations"),
  107: W("report_court", "person", "18 April 2019"), 108: D("sweeping"), 109: W("charges_podium", "person", "Feb 2018: 13 charged"), 110: W("ira_floor", "person", "3 organisations (as charged)"),
  111: W("gru_table", "person", "July 2018: 12 GRU officers charged"), 112: D("interf"), 113: D("benefit"), 114: D("benefit"),
  115: W("counsel_office", "person", "Conspiracy: not established", framing="threeQuarter"), 116: W("subpoena_hall", "person", "≈500 witnesses, 2,800+ subpoenas"), 117: D("charged"),
  118: W("report_court", "person", "Not proof either way", subject="set"), 119: D("exonerate"), 120: D("exonerate"), 121: W("report_room", "person", "966 pages", framing="threeQuarter"),
  122: W("senate_split", "person", "Burr led; Rubio acting chair"), 123: W("senate_split", "person", "Opposite conclusions", subject="sideB"), 124: W("ci_office", "person", "FBI counterintelligence inquiry"),
  125: D("ci"), 126: W("lawn_gaggle", "person", "'I never worked for Russia'"), 127: W("evidence_hall", "person", "The tally", subject="readers"), 128: D("tally_proven"),
  129: W("stamp_side", "person", "Unverified: the stories"), 130: D("tally_ne"),
  131: W("son_office", "person", "The June email", subject="son"), 132: W("capitol_dusk", "place", "No official conclusion"), 133: W("report_court", "person", "The gavel is yours", subject="bench"),
  134: W("city_end", "place", endcard=True),
}
# real evidence photo cards: small greyscale matte cards (photo_cards.js); licences + credits in photos.json / credits.txt.
# One per line, only on 3D lines. Captions attributed like the narration; no person's photo on a line that states an unverified claim.
PHOTOS = json.loads((F / "photos.json").read_text(encoding="utf8"))
PHOTO_LINES = {
  1: ("donjr", "Donald Trump Jr."), 3: ("doc_email", "The emails, June 2016"), 4: ("trump", "Donald Trump"),
  11: ("doc_mueller", "Mueller report, 2019"), 12: ("moscow87", "Moscow, 1980s"), 13: ("intourist", "Intourist"),
  19: ("rybolovlev", "Dmitry Rybolovlev"), 20: ("palmbeach", "The Palm Beach mansion"), 22: ("crocus", "Crocus City Hall"), 23: ("putin", "Vladimir Putin"),
  24: ("peskov", "Peskov, Kremlin aide"), 30: ("cohen", "Michael Cohen"), 31: ("kremlin", "The Kremlin"), 32: ("mueller", "Robert Mueller"),
  33: ("comey", "James Comey"), 35: ("sdny", "Federal court, NYC"), 37: ("capitol", "US Congress"),
  40: ("goldstone", "Rob Goldstone"), 43: ("trumptower", "Trump Tower, NYC"), 44: ("veselnitskaya", "N. Veselnitskaya"), 45: ("senate_intel", "Senate hearing room"),
  46: ("doc_magnitsky", "Magnitsky Act, 2012"), 53: ("manafort", "Paul Manafort"), 55: ("kilimnik", "Konstantin Kilimnik"), 63: ("treasury", "US Treasury"),
  64: ("doc_treasury21", "Treasury, Apr 2021"), 66: ("trump", "Donald Trump"), 68: ("steele", "Christopher Steele"), 70: ("hclinton", "Hillary Clinton, 2016"),
  71: ("fec", "Election Commission"), 72: ("buzzfeed", "BuzzFeed"), 73: ("fbihq", "FBI headquarters"), 75: ("horowitz", "Inspector general"),
  76: ("carterpage", "Carter Page"), 77: ("fisc", "The FISA court"), 81: ("durham", "John Durham"), 84: ("lubyanka", "KGB HQ, Moscow"),
  87: ("facebook", "Facebook"), 92: ("helsinki_palace", "Helsinki palace"), 93: ("helsinki_summit", "Helsinki, July 2018"), 96: ("mccain", "John McCain"),
  98: ("javelin", "Javelin missile"), 100: ("ruembassy", "Russian Embassy, DC"), 102: ("alaska_summit", "Alaska, Aug 2025"), 103: ("doc_sanctions25", "Treasury, Oct 2025"),
  107: ("doc_mueller", "Released 18 Apr 2019"), 110: ("ira", "IRA building (charged)"), 111: ("gru", "GRU headquarters"), 115: ("mueller", "Robert Mueller"),
  122: ("burr", "Sen. Richard Burr"), 123: ("rubio", "Sen. Marco Rubio"), 124: ("comey", "James Comey"), 126: ("whitehouse", "The White House"), 131: ("doc_email", "The emails, June 2016"),
}
for n, (pid, cap) in PHOTO_LINES.items():
  assert pid in PHOTOS and PHOTOS[pid].get("licence") and PHOTOS[pid].get("credit"), pid
  assert "set" in LV[n], (n, "photo cards only on 3D lines"); LV[n]["photo"] = {"id": pid, "caption": cap}
assert sorted(LV) == list(range(1, NL + 1)), (NL, sorted(set(range(1, NL + 1)) ^ set(LV)))
for n, v in LV.items():
  if "set" in v and v.get("callout") and DUR.get(n, 0) >= 4.0: v["calloutT"] = round(DUR[n] * 0.5, 2)
for n in CHOPEN: assert "set" in LV[n], n; LV[n]["chapterOpen"] = True; LV[n]["title"] = CHOPEN[n][1]
for n, v in LV.items():
  if "set" in v and v.get("kind") != "place" and v.get("subject") == "focus" and not v.get("framing") and not v.pop("nopath", False) and DUR.get(n, 0) >= 4.45: v["path"] = "reveal"
  v.pop("nopath", None)
plan = {"film": FILM, "seed": seed(0), "v3": True, "endcard": {"name": "Blind Luck Time"}, "cast": CAST, "sets": S, "mg": MG, "lines": {str(k): v for k, v in LV.items()}}
(F / "plan.json").write_text(json.dumps(plan, indent=1, ensure_ascii=False), encoding="utf8")
(F / "sound.json").write_text(json.dumps({"video": f"out/{FILM}.mp4", "beds": "page", "cues": "page", "music": {"moods": "auto", "under": 18, "lift": 3}}), encoding="utf8")

# ---------------- entities.json for photocheck (every named person / org / place / document / event; first mention must carry a card or a reason) ----------------
ENT = [
  ("Don Junior", "person", ["Don Jr", "Donald Trump Jr"], "donjr"), ("Donald Trump", "person", ["Trump"], "trump"), ("Intourist", "org", [], "intourist"),
  ("Moscow", "place", [], "moscow87"), ("Bayrock", "org", [], None), ("Dmitry Rybolovlev", "person", ["Rybolovlev"], "rybolovlev"), ("Palm Beach", "place", ["Palm Beach mansion"], "palmbeach"),
  ("Crocus City Hall", "place", [], "crocus"), ("Miss Universe", "event", [], "crocus"), ("Putin", "person", ["Vladimir Putin"], "putin"), ("Dmitry Peskov", "person", ["Peskov"], "peskov"),
  ("Trump's 2013 tweet", "document", ["tweeted"], None), ("Special counsel's report", "document", ["special counsel's report", "Mueller report"], "doc_mueller"),
  ("I.C. Expert", "org", [], None), ("Michael Cohen", "person", ["Cohen"], "cohen"), ("The Kremlin", "org", ["Peskov's office"], "kremlin"), ("Robert Mueller", "person", ["Mueller"], "mueller"),
  ("James Comey", "person", ["Comey"], "comey"), ("Cohen's guilty plea", "document", ["pleaded guilty"], None), ("Federal court, Manhattan", "place", ["pleaded guilty"], "sdny"),
  ("Congress", "org", [], "capitol"), ("Rob Goldstone", "person", ["Goldstone"], "goldstone"), ("The Goldstone email", "document", ["email"], "doc_email"),
  ("Trump Tower", "place", [], "trumptower"), ("Natalia Veselnitskaya", "person", ["Veselnitskaya"], "veselnitskaya"),
  ("Senate intelligence committee", "org", ["Senate committee", "Senate's intelligence committee"], "senate_intel"), ("Magnitsky Act", "document", [], "doc_magnitsky"),
  ("Paul Manafort", "person", ["Manafort"], "manafort"), ("Konstantin Kilimnik", "person", ["Kilimnik"], "kilimnik"), ("Senate intelligence report", "document", ["its report of August twenty twenty"], None),
  ("US Treasury", "org", ["Treasury"], "treasury"), ("Treasury statement, April 2021", "document", ["The Treasury said"], "doc_treasury21"),
  ("Christopher Steele", "person", ["Steele dossier", "Steele"], "steele"), ("Fusion GPS", "org", [], None), ("Clinton campaign", "org", ["Clinton"], "hclinton"),
  ("Federal Election Commission", "org", [], "fec"), ("BuzzFeed", "org", [], "buzzfeed"), ("FBI", "org", ["Crossfire Hurricane"], "fbihq"),
  ("Inspector general", "person", ["inspector general"], "horowitz"), ("Carter Page", "person", [], "carterpage"), ("FISA court", "place", ["special court"], "fisc"),
  ("John Durham", "person", ["Durham"], "durham"), ("KGB", "org", [], "lubyanka"), ("Facebook", "org", [], "facebook"),
  ("Helsinki", "place", [], "helsinki_palace"), ("John McCain", "person", ["McCain"], "mccain"), ("Javelin missiles", "product", ["Javelin"], "javelin"),
  ("Russian officials expelled", "event", ["expelled sixty Russian officials"], "ruembassy"), ("Alaska summit", "event", ["Alaska"], "alaska_summit"),
  ("Rosneft", "org", [], "doc_sanctions25"), ("Lukoil", "org", [], "doc_sanctions25"), ("Three Russian organisations (IRA)", "org", ["Three Russian organisations"], "ira"),
  ("IRA indictment", "document", ["charged thirteen Russian nationals"], None), ("GRU", "org", [], "gru"), ("GRU indictment", "document", ["twelve officers of the GRU"], None),
  ("Richard Burr", "person", ["Burr"], "burr"), ("Marco Rubio", "person", ["Rubio"], "rubio"), ("The White House", "place", ["I never worked for Russia"], "whitehouse"),
]
ents = []
for name, kind, al, pid, *frm in ENT:   # optional 5th field: count mentions from this line on (L1 "Donald Trump's son" names the son, not the father)
  pats = [name] + al
  ls = [n for n, t in TXT.items() if n >= (frm[0] if frm else 0) and any(re.search(r"\b" + re.escape(p) + r"\b", t, re.I) for p in pats)]
  e = {"name": name, "kind": kind, "lines": ls, **({"aliases": al} if al else {}), **({"photo": pid} if pid else {})}
  ents.append(e)
(F / "entities.json").write_text(json.dumps(ents, indent=1, ensure_ascii=False), encoding="utf8")
used = {v["set"] for v in LV.values() if "set" in v}; tags = {}
for v in LV.values(): tags[v["kind"]] = tags.get(v["kind"], 0) + 1
print("lines", NL, "sets", len(S), "unused", sorted({s["id"] for s in S} - used), "mg beats", len(MG), "unused mg", sorted({b["id"] for b in MG} - {v["mg"] for v in LV.values() if "mg" in v}),
      "tags", tags, "chapters", {n: c[1] for n, c in CHOPEN.items()}, "photos", len(PHOTO_LINES), "entities", len(ents), "no-line", [e["name"] for e in ents if not e["lines"]])
