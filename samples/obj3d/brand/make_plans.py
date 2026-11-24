# Writes brand/plans/<id>/{plan,lines}.json: label-free scenes for channel art (no callouts, no real people, no named characters).
# Each set gets 2 lines (one "set" framing, one "focus" framing); brand/snap.mjs re-aims the camera per banner from shots_*.json.
import json, os
HERE = os.path.dirname(os.path.abspath(__file__))
T = True

def write(pid, sets, lines_v, seed):
    d = os.path.join(HERE, "plans", pid); os.makedirs(d, exist_ok=True)
    lines, plines, t = [], {}, 0.5
    for i, v in enumerate(lines_v, 1):
        lines.append({"n": i, "shows": [], "anchor": None, "start": t, "end": t + 6.0, "overrun": 0, "text": "A quiet scene in the miniature world."})
        plines[str(i)] = v; t += 7.0
    plan = {"film": pid, "seed": seed, "endcard": {"name": "x"}, "cast": {}, "sets": sets, "mg": [], "lines": plines}
    json.dump(plan, open(os.path.join(d, "plan.json"), "w"), indent=1)
    json.dump(lines, open(os.path.join(d, "lines.json"), "w"), indent=1)

def two(sid, room=False):
    return [{"set": sid, "subject": "set", "kind": "place", **({"framing": "wide"} if room else {})}, {"set": sid, "subject": "focus", "kind": "person"}]

# ---------------- Partition Lines ----------------
# square: one long barrier splits a public square in two; people on both sides; one red figure at the line
square = {"id": "square", "seed": 52011, "scale": "street", "street": {"w": 66.0, "d": 44.0, "kind": "plaza", "facades": ["back", "left"], "road": "front"},
  "place": [{"what": "barrier", "name": "line", "n": 1, "len": 26.0, "at": [1.5, 3.0], "h": 90},
            {"what": "bollard", "n": 6, "at": "plaza"}, {"what": "flag", "n": 4, "at": "plaza"},
            {"what": "car", "n": 5, "at": "kerb"}, {"what": "newsVan", "n": 1, "at": "kerb"}, {"what": "tvCamera", "n": 2, "at": "plaza"}],
  "people": [{"id": "crosser", "pose": "walk", "prop": "briefcase", "at": [1.5, 17.5], "face": 0, "o": {"coat": T}}],
  "groups": [{"form": "crowd", "n": 46, "area": [-20, -4, -1.2, 14], "toward": [8, 4], "poses": ["stand", "stand_arms_crossed", "phone", "point", "stand"], "signs": 0.12, "name": "west"},
             {"form": "crowd", "n": 44, "area": [4.2, -4, 24, 14], "toward": [-6, 4], "poses": ["stand", "phone", "stand_arms_crossed", "point", "stand"], "signs": 0.12, "name": "east"},
             {"form": "procession", "n": 6, "at": [1.5, -6.0], "h": 90, "name": "guards", "poses": ["stand", "stand_arms_crossed"], "o": {"coat": T, "hat": "peak"}}],
  "focus": "crosser", "light": {"time": "morning"}}
# talks: a long negotiation table, two delegations, aides, press pool; one red delegate
talks = {"id": "talks", "seed": 5521, "room": {"w": 17.5, "d": 11.5, "h": 3.8, "floor": "carpet", "windows": 5, "curtains": T, "wainscot": T, "doors": [{"wall": "left", "at": 0.88}]},
  "place": [{"what": "boardroomTable", "name": "talks", "at": "center", "seats": 14, "off": [0.4, 0.2]},
            {"what": "flag", "at": "back", "n": 6}, {"what": "credenza", "at": "back", "n": 2}, {"what": "docPile", "at": "back"},
            {"what": "chairsRows", "name": "press", "rows": 2, "cols": 8, "aisle": 1.2, "at": "front", "wallGap": 0.4},
            {"what": "tvCamera", "n": 4, "at": "side:talks", "face": "talks"}, {"what": "plant", "at": "corner", "n": 3}],
  "groups": [{"form": "table", "of": "talks", "n": 14, "name": "delegates", "poses": ["sit_lean", "sit_listen", "sit_type", "sit"]},
             {"form": "workers", "of": "tvCamera", "name": "camOps"},
             {"form": "audience", "of": "press", "n": 12, "name": "press"},
             {"form": "crowd", "n": 8, "area": "aisles", "poses": ["stand", "stand_arms_crossed", "phone", "kneel"], "name": "aides"}],
  "focus": {"id": "delegates", "index": 4}, "scale": "room"}
write("brand_pl", [square, talks], two("square") + two("talks", True), 4101)

# ---------------- Powder Keg ----------------
# depot: a high warehouse hall packed with crate stacks, workers carrying boxes; one red crate stack
depot = {"id": "depot", "seed": 81919, "room": {"w": 26, "d": 16, "h": 6.5, "floor": "concrete", "windows": 6, "highWindows": T, "doors": [{"wall": "left", "at": 0.8, "w": 3.5, "h": 4}]},
  "place": [{"what": "crates", "name": "keg", "n": 1, "at": "center", "off": [1.0, 0.6]},
            {"what": "crates", "name": "stacks", "n": 12, "at": "grid", "cols": 6, "rowsN": 2, "gapX": 2.6, "gapZ": 4.2, "off": [0.2, -0.8]},
            {"what": "crates", "n": 8, "at": "back"}, {"what": "crates", "n": 4, "at": "left"},
            {"what": "shelf", "n": 3, "at": "back", "fill": "boxes"}, {"what": "workbench", "at": "left"}],
  "groups": [{"form": "crowd", "n": 16, "area": "aisles", "poses": ["carry", "carry", "walk", "point", "stand_arms_crossed", "look_down"], "name": "crew"}],
  "focus": "keg", "scale": "room"}
# standoff: a crowd faces a guard line across barriers in a square
standoff = {"id": "standoff", "seed": 77123, "scale": "street", "street": {"w": 66.0, "d": 44.0, "kind": "plaza", "facades": ["back", "left"], "road": "front"},
  "place": [{"what": "barrier", "n": 1, "len": 24.0, "at": [3.0, 3.0], "h": 90}, {"what": "car", "n": 5, "at": "kerb"}, {"what": "newsVan", "n": 2, "at": "kerb"},
            {"what": "tvCamera", "n": 3, "at": "plaza"}],
  "groups": [{"form": "crowd", "n": 90, "area": [-24, -5, 0.8, 14], "toward": [9, 3], "poses": ["raise_hand", "stand", "point", "stand_arms_crossed", "phone"], "signs": 0.22, "name": "crowd"},
             {"form": "procession", "n": 12, "at": [5.6, 3.0], "h": 0, "gap": 1.6, "name": "line", "poses": ["stand_arms_crossed", "stand"], "o": {"coat": T, "hat": "peak"}}],
  "focus": {"id": "crowd", "index": 6}, "light": {"time": "afternoon"}}
write("brand_pk", [depot, standoff], two("depot", True) + two("standoff"), 4202)
print("ok")
