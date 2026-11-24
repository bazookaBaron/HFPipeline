# Producer step v3 for "How China became a copy machine": rooms + streets with posed, faceless figures ("dollhouse documentary"), SAME voice.
# Writes films/china/plan_v3.json (plan.json, the rendered v2 plan, is left untouched) and mirrors it into films/china_v3/ (plan.json + copies of
# lines.json, voice.wav, script.md, words.json, sound.json with video out/china_v3.mp4) so film.html?film=china_v3 / render.mjs / audio/mix.py run
# it with no engine change. Every line is tagged kind = person | room | street | place | data.
# Facts: exterior place specs and MG beat data are reused from the v2 plan (sourced in script.md / FACTS.md); no new numbers are introduced.
# Allegations stay allegations (OpenAI / Anthropic distillation claims, Beijing's denial; the IP-theft range is a US-wide estimate). Run: python make_plan_v3.py
import json, pathlib, shutil, copy
F = pathlib.Path(__file__).parent
V2 = json.loads((F / "plan.json").read_text(encoding="utf8"))
EXT = {s["id"]: s for s in V2["sets"]}
MGV2 = {b["id"]: b for b in V2["mg"]}
LINES = json.loads((F / "lines.json").read_text(encoding="utf8"))
DUR = {l["n"]: l["end"] - l["start"] for l in LINES}

# ---------------- cast: fixed faceless silhouettes for recurring / named people (no likeness) ----------------
CAST = {
  "seller":    {"build": 1.0, "hair": "short", "coat": False, "tie": False, "prop": "phone"},      # the Huaqiangbei counter seller (lines 1, 2, 87)
  "official":  {"build": 1.15, "hair": "none", "coat": True, "tie": True},                       # Beijing officials (1980 zone, 2004 tender)
  "exec":      {"build": 1.1, "hair": "short", "coat": True, "tie": True, "prop": "briefcase"},  # foreign executives
  "ustr":      {"build": 1.0, "hair": "short", "coat": True, "tie": True},                       # US trade representative's office
  "mfa":       {"build": 0.95, "hair": "short", "coat": True, "tie": True, "prop": "papers"},    # China's foreign-ministry spokesperson (29, 61)
  "engineer":  {"build": 0.95, "hair": "short", "coat": False, "tie": False},                     # engineers (Austria, Micron)
  "judge":     {"build": 1.1, "hair": "none", "coat": True, "tie": False},
  "fbi":       {"build": 1.15, "hair": "short", "coat": True, "tie": True},
  "slater":    {"build": 0.9, "hair": "short", "coat": True, "tie": False, "hat": "peak"},
  "lowell":    {"build": 1.05, "hair": "short", "coat": True, "tie": True, "hat": "peak"},
  "hamilton":  {"build": 0.95, "hair": "short", "coat": True, "tie": True},
  "dickens":   {"build": 1.0, "hair": "long", "coat": True, "tie": True},
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
    if e.get("focus"): e["what"] = what; e.pop("n", None); e.pop("focusIndex", None); e.pop("floors", None); e.update(extra)
  return s_id

DATAHALL = lambda w, d: {"w": w, "d": d, "h": 3.4, "floor": "tile", "windows": 0, "doors": [{"wall": "left", "at": 0.85}]}

# ================= rooms / streets (all generated at runtime from these specs) =================
# 1, 2, 87 Huaqiangbei: a market aisle; the seller on the phone behind his counter
room("hqb_mkt", "market", seed=5, people=[{"id": "seller", "char": "seller", "pose": "phone", "prop": "phone", "at": "stand:stall:3"}], focus="seller", light={"time": "afternoon"})
# 3 a phone workshop around 2010: assemblers at long benches
room("workshop", seed=21, room={"w": 12, "d": 8, "h": 3.2, "floor": "concrete", "windows": 3, "doors": [{"wall": "left", "at": 0.85}]},
     place=[{"what": "table", "name": "benches", "n": 3, "at": "grid", "cols": 1, "rowsN": 3, "seats": 8, "gapZ": 1.3, "h": 0}, {"what": "crates", "n": 3, "at": "back"},
            {"what": "shelf", "n": 2, "at": "left", "fill": "boxes"}, {"what": "docPile", "at": "back"}],
     groups=[{"form": "table", "of": "benches", "n": 18, "name": "assemblers", "poses": ["sit_type", "sit_type", "sit_lean", "sit_type"]}], focus={"id": "assemblers", "index": 4})
# 6 AI: a data hall, technicians among the racks
def datahall(id, seed, w, d, cols, groups, focus, people=None, **kw):
  return room(id, seed=seed, room=DATAHALL(w, d), place=[{"what": "serverRack", "name": "racks", "n": 2 * cols, "at": "grid", "cols": cols, "rowsN": 2, "gapX": 1.4, "gapZ": 2.2, "h": 0, "off": [0, -0.8]},
              {"what": "filing", "at": "left", "n": 2}, {"what": "crates", "n": 2, "at": "back"}, {"what": "plant", "at": "corner"}], groups=groups, people=people or [], focus=focus, **kw)
datahall("dc_ai", 5, 15, 10, 4, [{"form": "crowd", "n": 5, "area": "aisles", "poses": ["look_down", "carry", "phone", "stand", "look_down"], "name": "techs"}], {"id": "techs", "index": 1}, light={"time": "evening"})
# 10 1980: Beijing officials declare the special economic zone (round table, an official points at the wall map)
room("sez_decide", seed=12, room={"w": 9, "d": 7, "h": 3.2, "floor": "wood", "windows": 3, "curtains": True, "doors": [{"wall": "left", "at": 0.85}]},
     place=[{"what": "roundTable", "name": "rt", "at": "center", "seats": 6, "off": [0.6, 0.2]}, {"what": "wallArt", "kind": "chart", "at": "back", "w": 2.2, "h": 1.3, "y": 1.7},
            {"what": "flag", "at": "back", "n": 1}, {"what": "shelf", "at": "left", "n": 1, "fill": "books"}, {"what": "plant", "at": "corner", "n": 2}],
     people=[{"id": "official", "char": "official", "pose": "point", "at": [-1.6, -1.6], "face": 270}],
     groups=[{"form": "table", "of": "rt", "n": 5, "name": "cadres", "poses": ["sit_listen", "sit_lean", "sit_listen", "sit"]}], focus="official", light={"time": "morning"})
# 11 toys, shoes, then electronics: an assembly floor
room("toy_line", "factory", seed=4, focus={"id": "workers", "index": 2})
# 17 a small workshop designs a phone around the chip
room("design_ws", seed=23, room={"w": 9, "d": 7, "h": 3, "floor": "concrete", "windows": 2, "doors": [{"wall": "left", "at": 0.85}]},
     place=[{"what": "desk", "name": "desks", "n": 4, "at": "grid", "cols": 2, "gapX": 1.6, "gapZ": 1.5, "variant": "papers"}, {"what": "workbench", "name": "bench", "at": "back"},
            {"what": "shelf", "at": "left", "n": 2, "fill": "boxes"}, {"what": "crates", "n": 2, "at": "left"}, {"what": "whiteboard", "at": "back"}],
     groups=[{"form": "table", "of": "desks", "n": 3, "name": "designers", "poses": ["sit_type", "sit_lean", "sit_type"]}, {"form": "huddle", "n": 3, "name": "team"}],
     focus={"id": "team", "index": 0})
# 19 a small-town street: a customer buys a phone at a stall
room("town_st", scale="street", seed=33, street={"w": 46, "d": 32, "kind": "plaza", "facades": ["back", "left"], "road": "front"},
     place=[{"what": "stall", "name": "shop", "n": 3, "at": "plaza"}, {"what": "tree", "n": 3, "at": "plaza"}, {"what": "bench", "n": 1, "at": "plaza"}],
     groups=[{"form": "crowd", "n": 12, "area": "plaza", "poses": ["walk", "stand", "carry", "phone"], "mode": "plaza", "name": "townsfolk"}],
     people=[{"id": "buyer", "pose": "phone", "prop": "phone", "at": [1.0, 3.6], "face": 200, "with": "sale", "o": {"coat": False, "hair": "short"}},
             {"id": "vendor", "pose": "speak", "at": [0.0, 3.6], "face": 20, "with": "sale", "o": {"coat": False, "hair": "bun"}}], focus="sale", light={"time": "afternoon"})
# 21 the market at night
room("hqb_eve", "market", seed=9, focus={"id": "shoppers", "index": 4}, light={"time": "evening"})
# 22 a foreign boardroom: an executive points at the China opportunity on the screen
room("foreign_board", "boardroom", seed=7, people=[{"id": "exec", "char": "exec", "pose": "point", "at": "end:table:1"}], focus="exec")
# 24 VW / GM sign with Shanghai's state carmaker
room("jv_sign", seed=14, room={"w": 10, "d": 7, "h": 3.2, "floor": "wood", "windows": 3, "doors": [{"wall": "left", "at": 0.86}]},
     place=[{"what": "table", "name": "stable", "at": "center", "seats": 2, "sides": "one", "len": 2.6, "off": [0.4, -0.6]}, {"what": "flag", "at": "back", "n": 2, "near": "stable"},
            {"what": "screenWall", "at": "back", "nx": 2, "ny": 1}, {"what": "plant", "at": "corner", "n": 2}],
     people=[{"id": "s1", "char": "exec", "pose": "sit_type", "prop": "papers", "at": "seat:stable:0", "with": "signers"},
             {"id": "s2", "char": "official", "pose": "sit_type", "prop": "papers", "at": "seat:stable:1", "with": "signers"}],
     groups=[{"form": "crowd", "n": 7, "area": [-3.5, 1.0, 3.5, 3.0], "toward": "stable", "poses": ["applaud", "phone", "stand", "applaud"], "name": "guests"}], focus="signers")
# 25 the car line, the partner's officials watching
room("car_line", "factory", seed=12, addGroups=[{"form": "huddle", "n": 3, "name": "partners", "poses": ["look_down", "point", "stand_arms_crossed"], "o": {"coat": True, "tie": True}}],
     focus={"id": "partners", "index": 1})
# 26 WTO accession, 11 Dec 2001: a signing at the hall
room("wto_hall", "hearing", seed=6, people=[{"id": "signer", "char": "official", "pose": "sit_type", "prop": "papers", "at": "seat:witnessTable:1"}], focus="signer")
# 27 licences and approvals: a clerk stamps, applicants wait
room("approvals", seed=17, room={"w": 9, "d": 7, "h": 3, "floor": "tile", "windows": 2, "doors": [{"wall": "left", "at": 0.85}]},
     place=[{"what": "desk", "name": "desk", "at": "back", "variant": "papers"}, {"what": "filing", "at": "back", "n": 3}, {"what": "shelf", "at": "left", "n": 2, "fill": "boxes"},
            {"what": "beamSeats", "name": "waiting", "n": 2, "at": "left"}, {"what": "clock", "at": "back"}, {"what": "docPile", "at": "left"}],
     people=[{"id": "clerk", "pose": "sit_type", "prop": "papers", "at": "seat:desk:0", "o": {"coat": True, "tie": False}},
             {"id": "a1", "char": "exec", "pose": "stand", "at": "front-of:desk", "dx": -0.45, "face": "desk", "with": "applicants"},
             {"id": "a2", "pose": "phone", "prop": "briefcase", "at": "front-of:desk", "dx": 0.45, "face": "desk", "with": "applicants", "o": {"coat": True, "tie": True}}],
     groups=[{"form": "table", "of": "waiting", "n": 4, "name": "waiting_ppl"}], focus="applicants")
# 28 2018: US trade report press conference
room("ustr_press", "pressroom", seed=7, groups=[{"form": "podium", "of": "podium", "n": 10, "name": "scrum", "speakerChar": "ustr"},
     {"form": "audience", "of": "seats", "n": 16, "name": "reporters"}, {"form": "workers", "of": "tvCamera", "name": "camOps"}], focus="scrum.speaker")
# 29, 61 China's foreign ministry briefing
room("mfa", "pressroom", seed=19, mirror=True, groups=[{"form": "podium", "of": "podium", "n": 6, "name": "scrum", "speakerChar": "mfa"},
     {"form": "audience", "of": "seats", "n": 24, "name": "reporters"}, {"form": "workers", "of": "tvCamera", "name": "camOps"}], focus="scrum.speaker")
# 31 the foreign investment law: deputies vote by a show of hands
room("npc_vote", seed=31, room={"w": 18, "d": 13, "h": 5, "floor": "carpet", "windows": 0, "wainscot": True, "doors": [{"wall": "left", "at": 0.88, "w": 1.6}]},
     place=[{"what": "dais", "name": "dais", "seats": 9, "at": "back"}, {"what": "flag", "at": "back", "n": 2, "near": "dais"}, {"what": "wallArt", "kind": "seal", "at": "back", "near": "dais", "w": 1.3, "h": 1.3, "y": 3.2},
            {"what": "chairsRows", "name": "floorSeats", "rows": 5, "cols": 12, "aisle": 1.4, "at": "front-of:dais", "gap": 2.6}],
     groups=[{"form": "table", "of": "dais", "n": 9, "name": "presidium"}, {"form": "audience", "of": "floorSeats", "n": 44, "name": "deputies", "poses": ["raise_hand", "raise_hand", "sit", "raise_hand"]}],
     focus={"id": "deputies", "index": 3})
# 32 partners taking notes for thirty years: engineers with clipboards among the machines
room("notes_floor", seed=27, room={"w": 16, "d": 11, "h": 5, "floor": "concrete", "windows": 4, "highWindows": True, "doors": [{"wall": "left", "at": 0.8, "w": 3.0, "h": 3.4}]},
     place=[{"what": "machineTool", "name": "machines", "n": 6, "at": "grid", "cols": 3, "rowsN": 2, "gapX": 2.0, "gapZ": 2.4, "h": 0}, {"what": "crates", "n": 3, "at": "back"},
            {"what": "shelf", "n": 2, "at": "left", "fill": "boxes", "height": 2.4}],
     groups=[{"form": "workers", "of": "machines", "name": "machinists"}, {"form": "huddle", "n": 3, "at": [2.0, 3.4], "name": "notetakers", "poses": ["look_down", "look_down", "point"], "o": {"coat": True}}],
     focus={"id": "notetakers", "index": 0})
# 33, 85 a US courtroom
room("court_us", "courtroom", seed=5, focus={"id": "judge", "index": 0})
# 34 AMSC's software runs Sinovel's turbines: a turbine control room
room("turbine_ctrl", seed=29, room={"w": 11, "d": 8, "h": 3.2, "floor": "tile", "windows": 2, "doors": [{"wall": "left", "at": 0.85}]},
     place=[{"what": "screenWall", "name": "screens", "at": "back", "nx": 4, "ny": 2}, {"what": "deskRow", "name": "consoles", "n": 2, "at": "grid", "cols": 1, "rowsN": 2, "per": 5, "gapZ": 1.6, "h": 0, "off": [0.6, 0.4]},
            {"what": "filing", "at": "left", "n": 2}, {"what": "plant", "at": "corner"}],
     people=[{"id": "eng", "char": "engineer", "pose": "point", "at": [3.0, -1.4], "face": 270}],
     groups=[{"form": "table", "of": "consoles", "n": 7, "name": "operators", "poses": ["sit_type", "sit_lean", "sit_type"]}], focus="eng")
# 36 Austria: the engineer in the dock
room("austria_court", "courtroom", seed=13, mirror=True, room={"floor": "carpet"},
     people=[{"id": "accused", "char": "engineer", "pose": "sit_listen", "at": "seat:counselB:1"}], focus="accused")
# 37 2018: the US jury convicts Sinovel
room("jury_court", "courtroom", seed=21, room={"floor": "wood"}, focus="jurors")
# 40 Micron's Taiwan unit: an engineer walks out of the chip lab with a box
room("micron_lab", seed=35, room={"w": 14, "d": 9, "h": 3.2, "floor": "tile", "windows": 3, "doors": [{"wall": "left", "at": 0.82}]},
     place=[{"what": "labBench", "name": "benches", "n": 6, "at": "grid", "cols": 3, "rowsN": 2, "gapX": 1.6, "gapZ": 1.4, "off": [0.8, -0.4]}, {"what": "shelf", "at": "back", "n": 3, "fill": "boxes"},
            {"what": "filing", "at": "left", "n": 2}],
     groups=[{"form": "workers", "of": "benches", "n": 5, "name": "staff"}],
     people=[{"id": "leaver", "char": "engineer", "pose": "carry", "prop": "box", "at": [-4.6, 2.6], "face": 180}], focus="leaver")
# 42 Fujian Jinhua's bench trial: the judge alone decides
room("jinhua_court", seed=37, room={"w": 13, "d": 10, "h": 3.6, "floor": "wood", "windows": 3, "wainscot": True, "doors": [{"wall": "left", "at": 0.85, "w": 1.6}]},
     place=[{"what": "judgeBench", "name": "bench", "at": "back", "focusable": True}, {"what": "flag", "at": "back", "n": 1, "near": "bench"},
            {"what": "wallArt", "kind": "seal", "at": "back", "near": "bench", "w": 1.1, "h": 1.1, "y": 2.5}, {"what": "clock", "at": "left"},
            {"what": "witnessTable", "name": "counselA", "seats": 2, "at": "front-of:bench", "lat": 1.6, "gap": 2.4, "face": "bench"},
            {"what": "witnessTable", "name": "counselB", "seats": 3, "at": "front-of:bench", "lat": -2.2, "gap": 2.4, "face": "bench"},
            {"what": "pews", "name": "gallery", "rows": 2, "len": 8, "aisle": 1.2, "bar": True, "at": "front", "wallGap": 0.25, "near": [1.0, 0]}],
     people=[{"id": "judge", "char": "judge", "pose": "sit_lean", "at": "seat:bench:0"}],
     groups=[{"form": "table", "of": "counselA", "name": "prosecution"}, {"form": "table", "of": "counselB", "n": 3, "name": "defence", "poses": ["sit_listen", "sit", "sit_listen"]},
             {"form": "audience", "of": "gallery", "n": 9, "name": "public"}], focus="judge")
# 43 five military officers charged with hacking: five operators at a row of screens
room("pla_unit", "trollfarm", seed=3, groups=[{"form": "table", "of": "rows", "n": 5, "name": "officers", "poses": ["sit_type", "sit_type", "sit_lean", "sit_type", "sit_type"], "o": {"coat": True, "tie": False, "hair": "short"}}],
     focus="officers", light={"time": "evening"})
# 46 the FBI director's speech: a new China case about every ten hours
room("fbi_speech", seed=18, room={"w": 15, "d": 11, "h": 3.4, "floor": "carpet", "windows": 0, "doors": [{"wall": "left", "at": 0.88}]},
     place=[{"what": "podium", "name": "podium", "at": "back", "riser": 0.25, "mics": 1, "wallGap": 1.0}, {"what": "screenWall", "at": "back", "nx": 3, "ny": 1}, {"what": "flag", "at": "back", "n": 2, "near": "podium"},
            {"what": "chairsRows", "name": "seats", "rows": 4, "cols": 10, "aisle": 1.2, "at": "front-of:podium", "gap": 3.4}, {"what": "tvCamera", "n": 2, "at": "side:seats", "gap": 0.5, "face": "podium"}],
     groups=[{"form": "podium", "of": "podium", "n": 0, "name": "director", "speakerChar": "fbi"}, {"form": "audience", "of": "seats", "n": 26, "name": "audience"}, {"form": "workers", "of": "tvCamera", "name": "camOps"}],
     focus="director.speaker")
# 47 2004: the railway ministry asks the world's train makers to bid
room("tender_room", seed=41, room={"w": 11, "d": 8, "h": 3.2, "floor": "carpet", "windows": 3, "curtains": True, "doors": [{"wall": "left", "at": 0.85}]},
     place=[{"what": "table", "name": "table", "at": "center", "seats": 10}, {"what": "flag", "at": "back", "n": 2}, {"what": "screenWall", "at": "back", "nx": 2, "ny": 1},
            {"what": "credenza", "at": "left"}, {"what": "plant", "at": "corner", "n": 2}],
     people=[{"id": "chair", "char": "official", "pose": "speak", "at": "end:table:1"}],
     groups=[{"form": "table", "of": "table", "n": 8, "name": "bidders", "o": {"coat": True, "tie": True}, "poses": ["sit_listen", "sit_type", "sit_listen", "sit_lean"]}], focus="chair")
# 50 a trade-show floor: a Chinese rail maker pitches a buyer
room("expo", seed=15, room={"w": 18, "d": 12, "h": 5, "floor": "concrete", "windows": 0, "doors": [{"wall": "left", "at": 0.85, "w": 2.4}]},
     place=[{"what": "stall", "name": "booths", "n": 6, "at": "grid", "cols": 3, "rowsN": 2, "gapX": 2.6, "gapZ": 2.4, "h": 0, "off": [0.4, -1.2]}, {"what": "screenWall", "at": "back", "nx": 4, "ny": 1}],
     groups=[{"form": "crowd", "n": 18, "area": [-8, -1, 8, 4.5], "poses": ["stand", "walk", "phone", "stand_arms_crossed"], "name": "visitors"}],
     people=[{"id": "rep", "pose": "speak", "prop": "papers", "at": [-0.6, 4.6], "face": 0, "with": "pitch", "o": {"coat": True, "tie": True}},
             {"id": "buyer", "char": "exec", "pose": "stand", "at": [0.6, 4.6], "face": 180, "with": "pitch"}], focus="pitch")
# 51 Kawasaki executives object
room("kawasaki_board", "boardroom", seed=33, mirror=True, room={"floor": "wood"}, people=[{"id": "kexec", "char": "exec", "pose": "speak", "at": "end:table:1"}], focus="kexec")
# 55 DeepSeek's lab: researchers at their screens
room("deepseek_lab", seed=43, room={"w": 12, "d": 9, "h": 3.1, "floor": "concrete", "windows": 4, "doors": [{"wall": "left", "at": 0.86}]},
     place=[{"what": "desk", "name": "desks", "n": 8, "at": "grid", "cols": 4, "gapX": 1.4, "gapZ": 1.6, "variant": "papers"}, {"what": "screenWall", "at": "back", "nx": 3, "ny": 1},
            {"what": "whiteboard", "at": "left"}, {"what": "plant", "at": "corner", "n": 2}],
     groups=[{"form": "table", "of": "desks", "n": 7, "name": "researchers", "poses": ["sit_type", "sit_lean", "sit_type", "sit_listen"]}, {"form": "huddle", "n": 3, "at": [3.6, 2.6], "name": "leads"}],
     focus={"id": "leads", "index": 0}, light={"time": "dawn"})
# 57 27 Jan: Nvidia loses about $590bn in one day (a trading floor)
room("trade_floor", "trading", seed=3, focus={"id": "floor", "index": 1})
# 58 OpenAI says it has seen evidence (glass meeting room)
room("openai_room", seed=45, room={"w": 9, "d": 7, "h": 3, "floor": "wood", "windows": 3, "doors": [{"wall": "left", "at": 0.85}]},
     place=[{"what": "table", "name": "table", "at": "center", "seats": 6}, {"what": "screenWall", "name": "screen", "at": "back", "nx": 2, "ny": 1}, {"what": "partition", "glass": True, "len": 3, "at": "left"},
            {"what": "plant", "at": "corner", "n": 2}],
     people=[{"id": "presenter", "pose": "point", "at": "end:table:1", "o": {"coat": False, "hair": "long", "skirt": False}}],
     groups=[{"form": "table", "of": "table", "n": 5, "name": "team", "poses": ["sit_listen", "sit_lean", "sit_type"]}], focus="presenter")
# 60 Anthropic's analysts trace the fake accounts (newsroom-style pods and screens)
room("trace_room", "newsroom", seed=8, focus={"id": "editors", "index": 0})
# 63 the New York Times v. OpenAI: lawyers carry the suit up the courthouse steps
room("nyt_steps", "steps", seed=4, groups=[{"form": "procession", "n": 6, "at": "steps-foot", "name": "lawyers", "o": {"coat": True, "tie": True}, "prop": "briefcase"},
     {"form": "crowd", "n": 26, "area": "plaza", "poses": ["stand", "phone", "stand_arms_crossed"], "name": "onlookers"}], focus={"id": "lawyers", "index": 0}, light={"time": "overcast"})
# 64 the thing being copied is a mind: a quiet data hall
datahall("dc_mind", 21, 18, 11, 5, [{"form": "huddle", "n": 2, "at": [1.0, 3.8], "name": "pair"}], {"id": "pair", "index": 0}, light={"time": "morning"})
# 66 BYD, 1995: battery workbenches
room("byd_shop", seed=47, room={"w": 10, "d": 7, "h": 3.4, "floor": "concrete", "windows": 3, "highWindows": True, "doors": [{"wall": "left", "at": 0.8, "w": 2.2}]},
     place=[{"what": "workbench", "name": "benches", "n": 4, "at": "grid", "cols": 2, "rowsN": 2, "gapX": 1.8, "gapZ": 1.6}, {"what": "crates", "n": 4, "at": "back"},
            {"what": "shelf", "n": 2, "at": "left", "fill": "boxes"}],
     groups=[{"form": "workers", "of": "benches", "name": "workers"}], focus={"id": "workers", "index": 1}, light={"time": "morning"})
# 69 CATL: a battery line
room("catl_line", "factory", seed=8, room={"w": 26, "d": 14}, focus={"id": "workers", "index": 5})
# 72 patent filings: clerks among the paper
room("patent_office", seed=49, room={"w": 12, "d": 9, "h": 3, "floor": "carpet", "windows": 3, "doors": [{"wall": "left", "at": 0.86}]},
     place=[{"what": "deskRow", "name": "rows", "n": 3, "at": "grid", "cols": 3, "rowsN": 1, "per": 4, "gapX": 1.2, "h": 90, "off": [0.6, 0.2]}, {"what": "filing", "at": "back", "n": 4},
            {"what": "shelf", "at": "left", "n": 3, "fill": "boxes"}, {"what": "docPile", "at": "back"}, {"what": "clock", "at": "back"}],
     groups=[{"form": "table", "of": "rows", "n": 10, "name": "examiners", "poses": ["sit_type", "sit_lean", "sit_type", "sit_listen"]}], focus={"id": "examiners", "index": 3})
# 77 Britain, 1789: customs officers guard the textile machines at the docks
room("customs_1789", "factory", seed=23, room={"w": 14, "d": 10, "h": 5, "floor": "wood", "windows": 3, "highWindows": True, "doors": [{"wall": "left", "at": 0.8, "w": 3.2, "h": 3.6}]},
     place=[{"what": "crates", "name": "crates", "n": 6, "at": "back"}, {"what": "crates", "n": 4, "at": "left"}, {"what": "spinningFrame", "name": "frame", "len": 4.5, "at": [1.0, 0.6], "h": 0},
            {"what": "workbench", "at": "left"}, {"what": "docPile", "at": "back"}],
     groups=[{"form": "huddle", "n": 3, "at": [1.0, 2.8], "name": "officers", "poses": ["point", "stand_arms_crossed", "look_down"], "o": {"coat": True, "hat": "peak"}},
             {"form": "crowd", "n": 3, "area": "aisles", "poses": ["carry", "carry", "stand"], "name": "porters", "o": {"coat": False}}], focus={"id": "officers", "index": 0}, light={"time": "dawn"})
# 79 Rhode Island: Slater rebuilds the machines from memory
room("slater_mill", "mill", seed=7, room={"w": 15, "d": 10}, people=[{"id": "slater", "char": "slater", "pose": "point", "at": [-4.6, 3.2], "face": 0}], focus="slater", light={"time": "morning"})
# 80 Lowell tours a British mill
room("lowell_mill", "mill", seed=11, people=[{"id": "lowell", "char": "lowell", "pose": "walk", "at": [-5.6, 4.0], "face": 10}], focus="lowell", light={"time": "afternoon"})
# 81 Hamilton's report: rewards for bringing foreign inventions
room("hamilton_study", seed=51, room={"w": 6.5, "d": 5.5, "h": 2.9, "floor": "wood", "windows": 2, "curtains": True, "doors": [{"wall": "left", "at": 0.85}]},
     place=[{"what": "desk", "name": "desk", "at": "back", "variant": "lamp"}, {"what": "shelf", "at": "left", "n": 2, "fill": "books"}, {"what": "rug", "at": "center", "pad": 0.6},
            {"what": "chair", "style": "arm", "at": "left"}, {"what": "wallArt", "at": "back", "n": 1}, {"what": "plant", "at": "corner"}],
     people=[{"id": "hamilton", "char": "hamilton", "pose": "sit_type", "prop": "papers", "at": "seat:desk:0"}], focus="hamilton", light={"time": "evening"})
# 82 Dickens on tour, complaining about pirated books (a lecture hall)
room("dickens_hall", seed=53, room={"w": 14, "d": 11, "h": 4.2, "floor": "wood", "windows": 4, "curtains": True, "wainscot": True, "doors": [{"wall": "left", "at": 0.88}]},
     place=[{"what": "podium", "name": "lectern", "at": "back", "riser": 0.35, "mics": 0, "wallGap": 1.2}, {"what": "pews", "name": "pews", "rows": 4, "len": 9, "aisle": 1.2, "at": "front", "wallGap": 0.6},
            {"what": "wallArt", "at": "back", "n": 2}, {"what": "plant", "at": "corner", "n": 2}],
     groups=[{"form": "podium", "of": "lectern", "n": 0, "name": "dickens", "speakerChar": "dickens"}, {"form": "audience", "of": "pews", "n": 28, "name": "audience"}],
     focus="dickens.speaker", light={"time": "evening"})
# 88 the rest of the world taking notes: a foreign delegation in a Chinese lab
room("delegation", seed=55, room={"w": 13, "d": 9, "h": 3.4, "floor": "tile", "windows": 4, "doors": [{"wall": "left", "at": 0.84}]},
     place=[{"what": "labBench", "name": "benches", "n": 4, "at": "grid", "cols": 2, "rowsN": 2, "gapX": 2.0, "gapZ": 1.6, "off": [-1.0, -0.6]}, {"what": "screenWall", "at": "back", "nx": 3, "ny": 1},
            {"what": "shelf", "at": "left", "n": 2, "fill": "boxes"}, {"what": "plant", "at": "corner"}],
     people=[{"id": "host", "pose": "point", "at": [2.6, 1.6], "face": 180, "o": {"coat": False, "hair": "short"}}],
     groups=[{"form": "huddle", "n": 4, "at": [3.6, 3.2], "name": "visitors", "poses": ["look_down", "look_down", "stand", "look_down"], "o": {"coat": True, "tie": True}, "prop": "papers"},
             {"form": "workers", "of": "benches", "n": 3, "name": "staff"}], focus="visitors")

# ================= places: geography + scale only (exterior specs reused from the v2 plan, landmarks varied) =================
ext("export_port"); ext("ev_yard"); ext("sez_factories"); ext("shenzhen_1980", light={"time": "morning"}); ext("shenzhen_today"); ext("hqb_markets"); swap_focus("hqb_markets", "electronicsMarket")
ext("stronghold", light={"time": "noon"}); ext("fuxing_mountains"); ext("ev_export"); ext("solar_farm"); ext("dji_drones"); ext("ford_michigan"); ext("cromford_mill"); ext("new_china")

# ================= MG beats: numbers and mechanisms only (data from the v2 plan, sourced in script.md) =================
MG_IDS = ["preview", "turnkey", "features", "output", "jv", "rules", "amsc", "damage", "settle", "umc", "cost", "fakes", "tender", "based", "network", "pattern",
          "trainingcost", "distil", "leak", "bydtesla", "tracker", "slater", "germany", "kick", "climbers"]
mg = [copy.deepcopy(MGV2[b]) for b in MG_IDS]
MB = {b["id"]: b for b in mg}
# people inside MG get a person generator (who:"person")
for st in MB["slater"]["parts"][0]["data"]["stops"]: st["who"] = "person"
MB["jv"]["parts"][0]["data"]["root"]["children"][0]["who"] = "official"

# ================= a visual for every voiced line =================
def W(set, kind, path=None, callout=None, subject="focus", **kw):
  v = {"set": set, "subject": subject, "kind": kind}
  if path: v["path"] = path
  if callout: v["callout"] = callout
  v.update(kw); return v
def D(beat, f=0): return {"mg": beat, "focus": f, "kind": "data"}
P2 = ["highOblique", "threeQuarter"]; P2b = ["wide", "threeQuarter"]; P2c = ["orbitBack", "lateralLow"]; P2d = ["threeQuarter", "lateralLow"]
LV = {
  1: W("hqb_mkt", "street", None, "Huaqiangbei, Shenzhen"),
  2: W("hqb_mkt", "person", "push", "A fraction of the price"),
  3: W("workshop", "person", "push", "Shanzhai workshops, ~2010"),
  4: W("export_port", "place", None, "The copy machine?"),
  5: D("preview"),
  6: W("dc_ai", "room", None, "Artificial intelligence"),
  7: W("ev_yard", "place", P2b, "EVs, batteries, solar, drones", subject="set"),
  8: W("sez_factories", "place", P2c, "The factory everyone wants to copy"),
  9: W("shenzhen_1980", "place", P2d, "Shenzhen, 1980"),
  10: W("sez_decide", "person", "descend", "1980: special economic zone"),
  11: W("toy_line", "person", "push", "Factories for foreign brands"),
  12: W("shenzhen_today", "place", None, "17.6 million people (2020)", subject="set"),
  13: W("hqb_markets", "place", P2, "≈115,000 businesses, ≈1.45 km²"),
  14: W("stronghold", "place", ["wide", "threeQuarter"], "Shanzhai: mountain stronghold"),
  15: W("hqb_mkt", "street", "reveal", "Very familiar logos", subject="vendors"),
  16: D("turnkey"),
  17: W("design_ws", "person", None, "Design around the chip"),
  18: D("features"),
  19: W("town_st", "person", None, "Customers the brands ignored"),
  20: D("output"),
  21: W("hqb_eve", "street", None, "Legally questionable"),
  22: W("foreign_board", "person", "slide", "A billion customers"),
  23: D("jv"),
  24: W("jv_sign", "person", None, "VW and GM, with Shanghai's SAIC"),
  25: W("car_line", "person", None, "A front-row seat"),
  26: W("wto_hall", "person", "push", "WTO accession, 11 Dec 2001"),
  27: W("approvals", "person", "push", "Licences and approvals"),
  28: W("ustr_press", "person", "reveal", "USTR Section 301 report, 2018"),
  29: W("mfa", "person", None, "Beijing: voluntary deals"),
  30: D("rules", 1),
  31: W("npc_vote", "person", "push", "Foreign Investment Law, 2020"),
  32: W("notes_floor", "person", None, "1994 to 2022"),
  33: W("court_us", "person", None, "Courts found theft"),
  34: W("turbine_ctrl", "person", "push", "AMSC software, Sinovel turbines"),
  35: D("amsc", 2),
  36: W("austria_court", "person", "push", "Austria: engineer convicted"),
  37: W("jury_court", "person", None, "Sinovel: guilty, 2018"),
  38: D("damage"), 39: D("settle"),
  40: W("micron_lab", "person", "reveal", "Micron's Taiwan unit"),
  41: D("umc"),
  42: W("jinhua_court", "person", "descend", "Fujian Jinhua: acquitted, 2024"),
  43: W("pla_unit", "person", "push", "2014: five officers charged"),
  44: D("cost"), 45: D("fakes"),
  46: W("fbi_speech", "person", "push", "FBI, 2020: a new case about every 10 hours"),
  47: W("tender_room", "person", "slide", "2004: the tender"),
  48: D("tender"), 49: D("based"),
  50: W("expo", "person", "push", "Chinese-built bullet trains, offered abroad"),
  51: W("kawasaki_board", "person", "slide", "Kawasaki objected"),
  52: W("fuxing_mountains", "place", P2d, "Fuxing, 2017"),
  53: D("network"), 54: D("pattern"),
  55: W("deepseek_lab", "person", "push", "DeepSeek R1, January 2025"),
  56: D("trainingcost"),
  57: W("trade_floor", "room", "reveal", "Nvidia: about -$590bn in one day"),
  58: W("openai_room", "person", "slide", "OpenAI: distillation claim (allegation)"),
  59: D("distil"),
  60: W("trace_room", "person", "push", "Anthropic: ≈16M exchanges, ≈24,000 fake accounts (allegation)"),
  61: W("mfa", "person", "push", "Beijing: \"groundless\""),
  62: D("leak"),
  63: W("nyt_steps", "street", "push", "NYT v. OpenAI, 2023"),
  64: W("dc_mind", "room", "push", "No court ruling"),
  65: W("shenzhen_today", "place", None, "Shenzhen today", subject="set"),
  66: W("byd_shop", "person", None, "BYD, 1995: phone batteries"),
  67: D("bydtesla"),
  68: W("ev_export", "place", None, "≈7 in 10 EVs made in China"),
  69: W("catl_line", "room", None, "CATL: 37.9% of EV batteries"),
  70: W("solar_farm", "place", P2, "80%+ of every solar step"),
  71: W("dji_drones", "place", P2b, "DJI: most consumer drones (est.)"),
  72: W("patent_office", "room", None, "≈46% of patent applications"),
  73: D("tracker"),
  74: W("ford_michigan", "place", None, "Ford, Michigan: CATL tech, licensed"),
  75: W("ford_michigan", "place", None, "The deal, in reverse"),
  76: W("cromford_mill", "place", None, "Every rising power?"),
  77: W("customs_1789", "person", "push", "Britain, 1789: machines may not leave"),
  78: D("slater"),
  79: W("slater_mill", "person", "push", "Slater Mill, Pawtucket, 1790"),
  80: W("lowell_mill", "person", "push", "Lowell's mill, Waltham, 1814"),
  81: W("hamilton_study", "person", "push", "Hamilton's report, 1791"),
  82: W("dickens_hall", "person", "push", "US copyright for foreign authors: 1891"),
  83: D("germany"), 84: D("kick"),
  85: W("court_us", "person", "push", "Theft is theft", subject="defence"),
  86: D("climbers"),
  87: W("hqb_mkt", "street", "push", "Knock-offs next to China's own brands"),
  88: W("delegation", "person", None, "Now the world takes notes"),
  89: W("new_china", "place", None),
  90: W("new_china", "place", None, endcard=True, framing="highOblique"),
}
for v in LV.values():
  if "path" in v and v["path"] is None: del v["path"]
assert sorted(LV) == list(range(1, 91)), sorted(set(range(1, 91)) - set(LV))
plan = {"film": "china", "seed": 23, "v3": True, "cast": CAST, "sets": S, "mg": mg, "lines": {str(k): v for k, v in LV.items()}}
txt = json.dumps(plan, indent=1, ensure_ascii=False)
(F / "plan_v3.json").write_text(txt, encoding="utf8")
# film id china_v3 reuses this film's voice: plan.json = plan_v3, lines/voice/words/script copied (render.mjs lines rewrites shows/cues/beds there, not here)
D3 = F.parent / "china_v3"; D3.mkdir(exist_ok=True)
(D3 / "plan.json").write_text(txt, encoding="utf8")
for f in ["lines.json", "voice.wav", "words.json", "script.md"]:
  if not (D3 / f).exists(): shutil.copy(F / f, D3 / f)
snd = json.loads((F / "sound.json").read_text(encoding="utf8")); snd["video"] = "out/china_v3.mp4"
(D3 / "sound.json").write_text(json.dumps(snd, indent=1), encoding="utf8")
# report: tags, MG share estimate, archetypes
used = {v["set"] for v in LV.values() if "set" in v}
tags = {}; tagT = {}
for n, v in LV.items(): tags[v["kind"]] = tags.get(v["kind"], 0) + 1; tagT[v["kind"]] = tagT.get(v["kind"], 0) + DUR[n]
arche = {}
for s in S:
  k = s.get("type") or (s.get("scale") or "place")
  arche[k] = arche.get(k, 0) + 1
long_nopath = [n for n, v in LV.items() if "set" in v and "path" not in v and DUR[n] > (4.4 if v.get("callout") else 4.0)]
print("sets", len(S), "unused", sorted({s["id"] for s in S} - used), "mg beats", len(mg), "tags", tags, "secs", {k: round(x, 1) for k, x in tagT.items()})
print("archetypes", arche); print("long lines without a path (event-gap risk):", long_nopath)
