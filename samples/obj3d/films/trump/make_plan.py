# Producer step for the Trump-Russia evidence-trial film (miniature v2): writes plan.json = places (composer specs), MG beats (kinds + data), map spec,
# and a visual for every voiced line. Every fact shown comes from the sourced script header (script.md). Run: python make_plan.py
# Places are generic generated miniatures (no landmark replicas, no faces): "Moscow riverside", "Midtown tower", "a federal courthouse" ...
import json, pathlib
F = pathlib.Path(__file__).parent
S = {}
def setp(id, ground, place, light="morning", ambient=("birds",), **kw): S[id] = {"id": id, "ground": ground, "place": place, "light": {"time": light}, "ambient": list(ambient), **kw}
TOWN = lambda n, w="inland": {"what": "town", "n": n, "where": w}
CITY = lambda n, w="inland", **k: {"what": "city", "n": n, "where": w, **k}
ROAD = lambda a="edge:west", b="edge:east", name="road", **k: {"what": "road", "from": a, "to": b, "name": name, **k}
TREES = lambda n, w="inland", kind="round": {"what": "trees", "n": n, "where": w, "kind": kind}
PEOPLE = lambda n, w, name=None: {"what": "people", "n": n, "where": w, **({"name": name} if name else {})}

# ---------------- places (all generated at runtime from these specs) ----------------
# Washington
setp("dc_dawn", {"kind": "river", "seed": 201, "relief": 0.15, "size": 280, "width": 22, "angle": 10}, [
  {"what": "govHall", "where": "inland", "w": 12, "focus": True, "name": "hall"}, CITY(120, "inland"), ROAD("edge:west", "hall"), {"what": "car", "n": 10, "where": "road"},
  TREES(90, "shore"), {"what": "skiff", "n": 2, "where": "shore"}], light="dawn")
setp("capitol_overhead", {"kind": "plain", "seed": 203, "relief": 0.1, "size": 270, "shore": False}, [
  {"what": "govHall", "where": "center", "w": 13, "focus": True, "name": "hall"}, TREES(110, "near hall"), CITY(90, "edge"), ROAD("edge:west", "edge:east"),
  {"what": "bus", "n": 3, "where": "road"}, {"what": "car", "n": 12, "where": "road"}, PEOPLE(6, "near hall")], light="noon")
setp("dc_night", {"kind": "plain", "seed": 205, "relief": 0.12, "size": 260, "shore": False}, [
  {"what": "govHall", "where": "center", "w": 11, "focus": True, "name": "hall"}, CITY(100, "edge"), ROAD("edge:north", "hall"), {"what": "car", "n": 8, "where": "road"}, TREES(60, "near hall")], light="evening")
setp("dc_mall", {"kind": "river", "seed": 207, "relief": 0.1, "size": 290, "width": 26, "angle": -15}, [
  {"what": "tower", "where": "inland", "floors": 30, "style": "slab", "w": 1.6, "d": 1.6, "focus": True, "name": "obelisk"}, {"what": "govHall", "where": "near obelisk", "gap": 40},
  CITY(110, "inland"), TREES(120, "shore"), ROAD(), {"what": "car", "n": 10, "where": "road"}], light="afternoon")
setp("dc_dusk", {"kind": "plain", "seed": 209, "relief": 0.15, "size": 260, "shore": False}, [
  {"what": "govHall", "where": "center", "w": 10, "focus": True, "name": "hall"}, {"what": "midrise", "n": 14, "where": "near hall"}, CITY(80, "edge"), TREES(70, "edge"),
  ROAD("edge:west", "edge:east"), {"what": "bus", "n": 2, "where": "road"}], light="evening")
setp("potomac_bridge", {"kind": "river", "seed": 211, "relief": 0.2, "size": 280, "width": 30, "angle": 70}, [
  ROAD("edge:west", "edge:east", bridge=True), {"what": "car", "n": 16, "where": "road", "focus": True, "focusIndex": 5, "name": "traffic"}, {"what": "govHall", "where": "inland"},
  CITY(100, "inland"), TREES(90, "shore"), {"what": "ferry", "where": "lane"}], light="evening")
setp("court_square", {"kind": "plain", "seed": 213, "relief": 0.1, "size": 250, "shore": False}, [
  {"what": "govHall", "where": "center", "w": 9, "focus": True, "name": "court"}, {"what": "tower", "n": 8, "where": "near court"}, CITY(90, "edge"), PEOPLE(9, "near court", "crowd"),
  ROAD("edge:west", "edge:east"), {"what": "car", "n": 10, "where": "road"}, {"what": "bus", "where": "road"}], light="morning")
setp("courthouse_steps", {"kind": "plain", "seed": 215, "relief": 0.12, "size": 250, "shore": False}, [
  {"what": "govHall", "where": "center", "w": 8, "focus": True, "name": "court"}, PEOPLE(12, "near court", "press"), {"what": "midrise", "n": 16, "where": "near court"},
  ROAD("edge:south", "court"), {"what": "car", "n": 9, "where": "road"}, TREES(40, "edge")], light="afternoon")
setp("special_counsel", {"kind": "plain", "seed": 217, "relief": 0.1, "size": 240, "shore": False}, [
  {"what": "midrise", "where": "center", "floors": 9, "focus": True, "name": "office"}, {"what": "midrise", "n": 18, "where": "near office"}, CITY(60, "edge"), ROAD(), {"what": "car", "n": 10, "where": "road"}], light="overcast")
setp("senate_building", {"kind": "plain", "seed": 219, "relief": 0.1, "size": 260, "shore": False}, [
  {"what": "govHall", "where": "center", "w": 14, "focus": True, "name": "senate"}, TREES(80, "near senate"), {"what": "midrise", "n": 12, "where": "edge"}, ROAD("edge:west", "senate"),
  {"what": "car", "n": 8, "where": "road"}, PEOPLE(5, "near senate")], light="overcast")
setp("senate_wing", {"kind": "hills", "seed": 221, "relief": 0.15, "size": 260, "shore": False}, [
  {"what": "govHall", "where": "center", "w": 10, "focus": True, "name": "wing"}, {"what": "govHall", "where": "near wing", "w": 7}, CITY(70, "edge"), TREES(90, "hills"), ROAD()], light="afternoon")
setp("treasury", {"kind": "plain", "seed": 223, "relief": 0.08, "size": 240, "shore": False}, [
  {"what": "govHall", "where": "center", "w": 11, "focus": True, "name": "treasury"}, {"what": "midrise", "n": 14, "where": "near treasury"}, TREES(50, "near treasury"), ROAD(),
  {"what": "car", "n": 12, "where": "road"}], light="morning")
setp("oig_office", {"kind": "plain", "seed": 225, "relief": 0.1, "size": 240, "shore": False}, [
  {"what": "midrise", "where": "center", "floors": 7, "w": 4, "d": 3, "focus": True, "name": "office"}, {"what": "tower", "n": 6, "where": "near office"}, CITY(70, "edge"), ROAD(), {"what": "bus", "n": 2, "where": "road"}], light="noon")
setp("doj_building", {"kind": "plain", "seed": 227, "relief": 0.1, "size": 250, "shore": False}, [
  {"what": "govHall", "where": "center", "w": 12, "focus": True, "name": "doj"}, CITY(90, "edge"), TREES(40, "near doj"), ROAD("edge:north", "doj"), {"what": "car", "n": 9, "where": "road"}], light="afternoon")
setp("fbi_hq", {"kind": "plain", "seed": 229, "relief": 0.1, "size": 240, "shore": False}, [
  {"what": "midrise", "where": "center", "floors": 8, "w": 5, "d": 4, "focus": True, "name": "hq"}, {"what": "midrise", "n": 12, "where": "near hq"}, CITY(50, "edge"),
  ROAD(), {"what": "car", "n": 10, "where": "road"}], light="overcast")
# New York
setp("fifth_avenue", {"kind": "city", "seed": 231, "relief": 0.05, "size": 260, "shore": "south", "landFrac": 0.8}, [
  {"what": "tower", "where": "center", "floors": 52, "style": "step", "w": 3.4, "d": 3.4, "focus": True, "name": "tower"}, {"what": "tower", "n": 26, "where": "near tower"}, CITY(120, "inland"),
  ROAD("edge:south", "edge:north", "avenue"), {"what": "car", "n": 16, "where": "avenue"}, {"what": "bus", "n": 3, "where": "avenue"}, PEOPLE(10, "near tower", "crowd")], light="morning")
setp("trump_tower_dusk", {"kind": "city", "seed": 233, "relief": 0.05, "size": 250, "shore": False}, [
  {"what": "tower", "where": "center", "floors": 50, "style": "step", "w": 3.2, "d": 3.2, "focus": True, "name": "tower"}, {"what": "tower", "n": 30, "where": "near tower"},
  ROAD("edge:west", "edge:east", "street"), {"what": "car", "n": 12, "where": "street"}, PEOPLE(4, "near tower", "guests")], light="evening")
setp("midtown_crossing", {"kind": "city", "seed": 235, "relief": 0.05, "size": 250, "shore": False}, [
  {"what": "tower", "where": "center", "floors": 34, "style": "slab", "focus": True, "name": "office"}, {"what": "tower", "n": 24, "where": "near office"}, ROAD("edge:west", "edge:east"),
  ROAD("edge:south", "edge:north", "avenue"), {"what": "car", "n": 14, "where": "avenue"}, {"what": "bus", "n": 2, "where": "road"}], light="noon")
setp("bayrock_office", {"kind": "coast", "seed": 237, "relief": 0.1, "size": 260, "shore": "west", "landFrac": 0.7}, [
  {"what": "tower", "where": "land near shore", "floors": 40, "style": "cyl", "focus": True, "name": "tower"}, {"what": "tower", "n": 18, "where": "near tower"}, CITY(90, "inland"),
  {"what": "pier", "len": 30, "width": 5}, {"what": "ferry", "where": "pier"}, ROAD(), {"what": "car", "n": 10, "where": "road"}], light="afternoon")
setp("manhattan_court", {"kind": "city", "seed": 239, "relief": 0.05, "size": 250, "shore": "east", "landFrac": 0.75}, [
  {"what": "govHall", "where": "center", "w": 10, "focus": True, "name": "court"}, {"what": "tower", "n": 20, "where": "near court"}, PEOPLE(10, "near court", "press"),
  ROAD("edge:north", "court"), {"what": "car", "n": 8, "where": "road"}, {"what": "ferry", "where": "anchorage"}], light="overcast")
setp("cigar_club_night", {"kind": "city", "seed": 241, "relief": 0.05, "size": 240, "shore": False}, [
  {"what": "tower", "where": "center", "floors": 40, "style": "slab", "w": 3.6, "d": 3.0, "focus": True, "name": "club"}, {"what": "tower", "n": 28, "where": "near club"},
  ROAD("edge:south", "edge:north", "avenue"), {"what": "car", "n": 6, "where": "avenue"}, PEOPLE(2, "near club")], light="evening")
setp("newsroom_city", {"kind": "city", "seed": 243, "relief": 0.05, "size": 250, "shore": "south", "landFrac": 0.7}, [
  {"what": "midrise", "where": "land near shore", "floors": 8, "w": 4.5, "d": 3.5, "focus": True, "name": "newsroom"}, {"what": "tower", "n": 16, "where": "near newsroom"}, CITY(100, "inland"),
  {"what": "quay", "len": 70}, {"what": "ferry", "n": 2, "where": "quay"}, ROAD(), {"what": "truck", "n": 4, "where": "road"}], light="morning")
setp("campaign_rally", {"kind": "plain", "seed": 245, "relief": 0.2, "size": 260, "shore": False}, [
  {"what": "warehouse", "where": "center", "len": 16, "wid": 9, "focus": True, "name": "arena"}, PEOPLE(14, "near arena", "crowd"), PEOPLE(10, "near arena"), {"what": "bus", "n": 6, "where": "near arena"},
  {"what": "car", "n": 40, "where": "near arena"}, ROAD("edge:west", "arena"), TOWN(40, "edge"), TREES(60, "edge")], light="afternoon")
setp("palm_beach", {"kind": "coast", "seed": 247, "relief": 0.1, "size": 260, "shore": "east", "landFrac": 0.55}, [
  {"what": "house", "where": "land near shore", "w": 6, "d": 4.5, "floors": 2, "roof": "hip", "focus": True, "name": "mansion"}, {"what": "house", "n": 14, "where": "shore"},
  TREES(110, "shore", "palm"), {"what": "jetty", "len": 20}, {"what": "skiff", "n": 3, "where": "shore"}, ROAD("edge:north", "edge:south"), {"what": "car", "n": 6, "where": "road"}], light="noon")
# Moscow and Russia (generic generated Russian cities, no landmark replicas)
setp("kremlin_river", {"kind": "river", "seed": 251, "relief": 0.2, "size": 280, "width": 24, "angle": 25}, [
  {"what": "govHall", "where": "inland", "w": 12, "focus": True, "name": "hall"}, {"what": "watchtower", "n": 6, "where": "near hall"}, CITY(130, "inland"),
  ROAD("edge:west", "edge:east", bridge=True), {"what": "car", "n": 10, "where": "road"}, TREES(60, "shore", "pine")], light="overcast")
setp("kremlin_evening", {"kind": "river", "seed": 253, "relief": 0.2, "size": 270, "width": 20, "angle": -30}, [
  {"what": "govHall", "where": "inland", "w": 11, "focus": True, "name": "hall"}, {"what": "watchtower", "n": 5, "where": "near hall"}, CITY(110, "inland"), TREES(70, "shore", "pine"),
  {"what": "ferry", "where": "lane"}], light="evening")
setp("kremlin_winter", {"kind": "plain", "seed": 255, "relief": 0.2, "size": 260, "shore": False}, [
  {"what": "govHall", "where": "center", "w": 13, "focus": True, "name": "hall"}, {"what": "watchtower", "n": 8, "where": "near hall"}, CITY(100, "edge"),
  TREES(90, "edge", "pine"), ROAD("edge:south", "hall"), {"what": "car", "n": 6, "where": "road"}], light="dawn")
setp("moscow_river_bend", {"kind": "river", "seed": 257, "relief": 0.25, "size": 300, "width": 28, "meander": 30}, [
  {"what": "govHall", "where": "inland", "w": 10, "focus": True, "name": "hall"}, CITY(160, "inland"), {"what": "tower", "n": 8, "where": "inland"}, TREES(100, "shore", "pine"),
  ROAD("edge:west", "edge:east", bridge=True), {"what": "car", "n": 12, "where": "road"}], light="evening")
setp("red_square_1987", {"kind": "river", "seed": 259, "relief": 0.15, "size": 260, "width": 22, "angle": 5}, [
  {"what": "excavator", "where": "inland", "focus": True, "name": "site", "moving": False}, {"what": "crates", "n": 3, "where": "near site"}, {"what": "barrier", "n": 4, "where": "near site"},
  {"what": "govHall", "where": "inland"}, TOWN(60, "inland"), {"what": "bus", "n": 3, "where": "road"}, ROAD(), TREES(60, "shore", "pine")], light="dawn")
setp("moscow_1996", {"kind": "river", "seed": 261, "relief": 0.2, "size": 270, "width": 26, "angle": 60}, [
  {"what": "midrise", "where": "inland", "floors": 3, "w": 4, "d": 4, "focus": True, "name": "plot"}, {"what": "excavator", "where": "near plot", "moving": False}, {"what": "barrier", "n": 5, "where": "near plot"}, {"what": "midrise", "n": 20, "where": "inland"}, CITY(130, "inland"),
  ROAD(), {"what": "truck", "n": 5, "where": "road"}, TREES(50, "shore", "pine")], light="overcast")
setp("moscow_city", {"kind": "river", "seed": 263, "relief": 0.15, "size": 280, "width": 30, "meander": 22}, [
  {"what": "tower", "where": "inland", "floors": 60, "style": "cyl", "focus": True, "name": "tower"}, {"what": "tower", "n": 14, "where": "near tower", "floors": 40}, CITY(120, "inland"),
  ROAD("edge:west", "edge:east", bridge=True), {"what": "car", "n": 14, "where": "road"}, {"what": "ferry", "where": "lane"}], light="afternoon")
setp("crocus_hall", {"kind": "plain", "seed": 265, "relief": 0.15, "size": 270, "shore": False}, [
  {"what": "warehouse", "where": "center", "len": 20, "wid": 10, "focus": True, "name": "hall"}, {"what": "tower", "n": 3, "where": "near hall"}, PEOPLE(16, "near hall", "crowd"),
  {"what": "bus", "n": 7, "where": "near hall"}, {"what": "car", "n": 50, "where": "near hall"}, ROAD("edge:west", "hall"), TOWN(40, "edge"), TREES(60, "edge", "pine")], light="evening")
setp("moscow_govt_quarter", {"kind": "plain", "seed": 267, "relief": 0.1, "size": 250, "shore": False}, [
  {"what": "govHall", "where": "center", "w": 9, "focus": True, "name": "office"}, {"what": "midrise", "n": 20, "where": "near office"}, CITY(70, "edge"), ROAD("edge:north", "office"),
  {"what": "car", "n": 8, "where": "road"}, TREES(40, "edge", "pine")], light="overcast")
setp("moscow_ministry_snow", {"kind": "hills", "seed": 269, "relief": 0.25, "size": 260, "shore": False}, [
  {"what": "govHall", "where": "center", "w": 10, "focus": True, "name": "ministry"}, {"what": "midrise", "n": 12, "where": "near ministry"}, TREES(120, "hills", "pine"), TOWN(40, "edge"),
  ROAD("edge:west", "ministry"), {"what": "car", "n": 5, "where": "road"}], light="dawn")
setp("moscow_hotel_night", {"kind": "river", "seed": 271, "relief": 0.15, "size": 260, "width": 24, "angle": -40}, [
  {"what": "tower", "where": "inland", "floors": 22, "style": "slab", "w": 4.5, "d": 3, "focus": True, "name": "hotel"}, CITY(120, "inland"), {"what": "govHall", "where": "inland"},
  ROAD(), {"what": "car", "n": 6, "where": "road"}, TREES(40, "shore", "pine")], light="evening")
setp("kgb_building", {"kind": "plain", "seed": 273, "relief": 0.1, "size": 250, "shore": False}, [
  {"what": "midrise", "where": "center", "floors": 7, "w": 6, "d": 5, "focus": True, "name": "hq"}, {"what": "midrise", "n": 16, "where": "near hq"}, CITY(70, "edge"), ROAD("edge:south", "hq"),
  {"what": "car", "n": 5, "where": "road"}, TREES(30, "edge", "pine")], light="evening")
setp("st_petersburg", {"kind": "coast", "seed": 275, "relief": 0.1, "size": 270, "shore": "west", "landFrac": 0.6}, [
  {"what": "midrise", "where": "land near shore", "floors": 4, "w": 5, "d": 3.5, "focus": True, "name": "office"}, CITY(130, "inland"), {"what": "quay", "len": 70},
  {"what": "containerShip", "where": "quay"}, {"what": "tug", "n": 2, "where": "near quay"}, ROAD(), {"what": "car", "n": 8, "where": "road"}], light="overcast")
# Europe
setp("london_thames", {"kind": "river", "seed": 281, "relief": 0.15, "size": 280, "width": 26, "meander": 26}, [
  {"what": "midrise", "where": "inland", "floors": 6, "focus": True, "name": "office"}, {"what": "tower", "n": 10, "where": "inland"}, CITY(150, "inland"), ROAD("edge:west", "edge:east", bridge=True),
  {"what": "bus", "n": 4, "where": "road"}, {"what": "car", "n": 10, "where": "road"}, {"what": "ferry", "where": "lane"}, TREES(60, "shore")], light="overcast")
setp("prague_river", {"kind": "river", "seed": 283, "relief": 0.35, "size": 270, "width": 24, "angle": 80}, [
  ROAD("edge:west", "edge:east", "bridge", bridge=True), PEOPLE(3, "bridge", "walkers"), TOWN(90, "inland"), {"what": "govHall", "where": "hills", "focus": True, "name": "castle"},
  TREES(110, "hills"), {"what": "ferry", "where": "lane"}, {"what": "skiff", "n": 3, "where": "shore"}], light="morning")
setp("helsinki_harbour", {"kind": "coast", "seed": 285, "relief": 0.12, "size": 280, "shore": "south", "landFrac": 0.55}, [
  {"what": "quay", "len": 100, "name": "quay"}, {"what": "govHall", "where": "behind quay", "w": 10, "focus": True, "name": "palace"}, CITY(110, "behind quay"), {"what": "ferry", "n": 3, "where": "quay"},
  {"what": "car", "n": 12, "where": "behind quay", "formation": "queue"}, PEOPLE(6, "quay"), {"what": "skiff", "n": 4, "where": "shore"}, TREES(40, "inland", "pine")], light="morning")
setp("seattle_consulate", {"kind": "coast", "seed": 287, "relief": 0.4, "size": 270, "shore": "west", "landFrac": 0.6}, [
  {"what": "midrise", "where": "land near shore", "floors": 6, "focus": True, "name": "consulate"}, {"what": "tower", "n": 14, "where": "near consulate"},
  CITY(100, "inland"), {"what": "mountain", "n": 1, "where": "inland edge", "snow": True, "radius": 26, "h": 22}, {"what": "ferry", "n": 2, "where": "anchorage"}, TREES(80, "hills", "pine")], light="afternoon")
setp("alaska_base", {"kind": "mountains", "seed": 289, "relief": 0.6, "size": 290, "shore": "south", "landFrac": 0.75}, [
  {"what": "helipad", "where": "near shore", "focus": True, "name": "pad"}, {"what": "warehouse", "n": 5, "where": "near pad"}, {"what": "radarMast", "n": 2, "where": "near pad"},
  {"what": "car", "n": 10, "where": "near pad", "formation": "queue"}, PEOPLE(6, "near pad"), {"what": "mountain", "n": 3, "where": "inland edge", "snow": True, "radius": 30, "h": 30}, TREES(90, "inland", "pine")], light="morning")
setp("steppe_town", {"kind": "plain", "seed": 291, "relief": 0.3, "size": 270, "shore": False}, [
  {"what": "radarMast", "where": "center", "focus": True, "name": "mast"}, TOWN(70, "near mast"), ROAD("edge:west", "edge:east"), {"what": "truck", "n": 4, "where": "road"},
  {"what": "mountain", "n": 2, "where": "edge", "snow": True, "radius": 28, "h": 24}, TREES(30, "edge", "pine")], light="afternoon")

setp("alexandria_court", {"kind": "river", "seed": 293, "relief": 0.15, "size": 260, "width": 34, "angle": 15}, [
  {"what": "govHall", "where": "inland", "w": 9, "focus": True, "name": "court"}, PEOPLE(8, "near court", "press"), TOWN(80, "inland"), TREES(70, "shore"),
  ROAD("edge:west", "court"), {"what": "car", "n": 8, "where": "road"}, {"what": "skiff", "n": 3, "where": "shore"}], light="afternoon")
setp("crocus_concert", {"kind": "plain", "seed": 295, "relief": 0.1, "size": 250, "shore": False}, [
  {"what": "warehouse", "where": "center", "len": 18, "wid": 11, "name": "hall"}, {"what": "radarMast", "n": 2, "where": "near hall", "focus": True, "name": "lights"}, PEOPLE(18, "near hall", "crowd"),
  {"what": "bus", "n": 5, "where": "near hall"}, {"what": "car", "n": 30, "where": "near hall"}, TREES(50, "edge", "pine")], light="evening")

# ---------------- MG beats (kinds + data; nothing prebuilt) ----------------
MG = [
 ("sides", [("splitAvsB", {"a": {"label": "Sure he's an asset", "object": "padlock"}, "b": {"label": "Sure it's a hoax", "object": "documentPage"}, "rows": [{"label": "Points to", "a": "the contacts", "b": "the dossier's flaws"}, {"label": "Whole story?", "a": False, "b": False}], "cap": "Two camps, one question", "note": "this film: the record only"})]),
 ("stamps", [("stampedPermit", {"title": "Rules of evidence", "no": "exhibits A-G", "cap": "Four stamps", "stamp": "PUBLIC RECORD", "sign": "the record",
   "fields": [{"k": "Proven", "v": "official finding or plea"}, {"k": "Alleged", "v": "claimed, not established"}, {"k": "Disproven", "v": "contradicted by a finding"}, {"k": "Unverified", "v": "no evidence made public"}], "checks": ["Sourced", "Attributed"]})]),
 ("pages", [("objectCounter", {"value": 448, "unit": "pages", "per": "Mueller report, 2019", "object": "documentPage", "each": 16, "cap": "The record", "note": "two volumes", "redIndex": 0})]),
 ("y1987", [("splitFlapDate", {"text": "1987", "groups": ["YEAR"], "what": "plane", "label": "first trip to Moscow", "cap": "Exhibit A"})]),
 ("quote2008", [("quoteCard", {"quote": "Russians make up a pretty disproportionate cross-section of a lot of our assets.", "em": "disproportionate cross-section", "by": "Donald Trump Jr. (reported)",
   "role": "real-estate conference", "when": "September 2008", "cap": "Exhibit A"})]),
 ("stampA", [("stampedPermit", {"title": "Exhibit A", "no": "Moscow business", "cap": "Stamp check", "stamp": "PROVEN", "sign": "record",
   "fields": [{"k": "Russian buyers", "v": "proven"}, {"k": "Russian partners", "v": "proven"}, {"k": "Moscow tower", "v": "never built"}, {"k": "A crime", "v": "none alleged"}], "checks": ["Deeds", "Reports"]})]),
 ("tweet", [("annotatedDoc", {"head": "Post on Twitter", "ref": "June 2013", "cap": "Before the pageant",
   "body": [{"t": "Do you think Putin will be going to The Miss Universe Pageant in November in Moscow", "hi": 1}, {"t": "if so, will he become my new best friend?", "hi": 2, "note": "he didn't come"}]})]),
 ("agalarov", [("allianceWeb", {"actors": [{"id": "t", "n": "Trump", "what": "building"}, {"id": "a", "n": "Aras Agalarov", "what": "crane"}, {"id": "e", "n": "Emin Agalarov", "what": "podium"},
   {"id": "g", "n": "Rob Goldstone", "what": "phone"}, {"id": "m", "n": "Moscow tower idea", "what": "documentPage"}],
   "links": [{"a": "t", "b": "a", "type": "trade", "label": "pageant partners"}, {"a": "a", "b": "e", "type": "ally", "label": "father, son"}, {"a": "e", "b": "g", "type": "dependent", "label": "publicist"},
   {"a": "t", "b": "m", "type": "trade", "label": "talks", "red": True}], "cap": "Exhibit B: who knew whom"})]),
 ("loi", [("contractClauses", {"cap": "Exhibit C: letter of intent", "clauses": [{"no": "1", "t": "Project: a Trump-branded tower in Moscow."}, {"no": "2", "t": "Developer: I.C. Expert Investment Company."},
   {"no": "3", "t": "Signed by Trump around late October 2015, during the campaign.", "key": True, "em": "during the campaign"}, {"no": "4", "t": "Non-binding. The tower was never built."}]})]),
 ("gantt", [("ganttBars", {"tasks": [{"label": "Presidential campaign", "start": 0, "end": 17, "what": "podium"}, {"label": "Letter of intent", "start": 4, "end": 5, "what": "documentPage"}, {"label": "Moscow tower talks", "start": 3, "end": 12, "what": "building"}, {"label": "Presumptive nominee", "start": 11, "end": 17, "what": "shield"}], "from": 0, "to": 18, "unit": " mo", "cap": "Months from June 2015 (Mueller)", "redIndex": 2})]),
 ("claimvsrecord", [("splitAvsB", {"a": {"label": "Told Congress", "object": "documentPage"}, "b": {"label": "Mueller found", "object": "magnifier"},
   "rows": [{"label": "Talks ended", "a": "Jan 2016", "b": "June 2016"}, {"label": "True", "a": False, "b": True}, {"label": "Guilty plea", "a": "-", "b": "Nov 2018"}], "cap": "Stamp check: proven", "note": "by Cohen's own plea"})]),
 ("date", [("splitFlapDate", {"text": "03 JUN 2016", "groups": ["DAY", "MONTH", "YEAR"], "what": "laptop", "label": "an email arrives", "cap": "Exhibit D"})]),
 ("email", [("annotatedDoc", {"head": "Email: R. Goldstone to D. Trump Jr.", "ref": "3 June 2016", "cap": "Exhibit D",
   "body": [{"t": "offered to provide the Trump campaign with some official documents and information that would incriminate Hillary", "hi": 1, "note": "the offer"}, {"t": "part of Russia and its government's support for Mr. Trump", "hi": 2, "note": "the key line"}]})]),
 ("reply", [("quoteCard", {"quote": "If it's what you say I love it", "em": "I love it", "by": "Donald Trump Jr.", "role": "email reply", "when": "3 June 2016", "cap": "Exhibit D"})]),
 ("attendees", [("allianceWeb", {"actors": [{"id": "v", "n": "Natalia Veselnitskaya", "what": "documentPage"}, {"id": "d", "n": "Donald Trump Jr.", "what": "mannequin"}, {"id": "k", "n": "Jared Kushner", "what": "mannequin"}, {"id": "p", "n": "Paul Manafort", "what": "mannequin"}], "links": [{"a": "d", "b": "v", "type": "dependent", "label": "the meeting", "red": True}, {"a": "k", "b": "v", "type": "dependent"}, {"a": "p", "b": "v", "type": "dependent"}], "cap": "Trump Tower, 9 June 2016"})]),
 ("charge", [("branchTree", {"root": {"label": "Campaign finance charge?", "what": "stamp", "kids": [{"label": "Knew it was illegal?", "what": "magnifier", "kids": [{"label": "Can't prove", "what": "warningSign", "red": True}]},
   {"label": "Value of the dirt?", "what": "coinStack", "kids": [{"label": "Can't put one", "what": "warningSign"}]}]}, "cap": "Mueller declined", "note": "not charged"})]),
 ("stampD", [("contractClauses", {"cap": "Stamp check: Exhibit D", "clauses": [{"no": "D1", "t": "Willing to take help from Moscow: in their own emails.", "key": True, "em": "in their own emails"},
   {"no": "D2", "t": "Dirt delivered at the meeting: none, by attendees' accounts."}, {"no": "D3", "t": "Crime charged: none."}]})]),
 ("polls", [("conveyor", {"input": "documentPage", "stations": [{"label": "Campaign pollsters", "what": "laptop", "out": "documentPage"}, {"label": "Paul Manafort", "what": "building", "out": "documentPage"},
   {"label": "Konstantin Kilimnik", "what": "phone", "out": "documentPage"}], "cap": "Internal polling data, 2016", "unit": "", "red": 2})]),
 ("grave", [("quoteCard", {"quote": "a grave counterintelligence threat", "em": "grave", "by": "Senate Intelligence Committee", "role": "bipartisan report, Vol. 5", "when": "August 2020", "cap": "Exhibit E"})]),
 ("chainE", [("stepRail", {"steps": [{"label": "Polling data", "what": "documentPage"}, {"label": "Paul Manafort", "what": "building"}, {"label": "Konstantin Kilimnik", "what": "phone"}, {"label": "Russian intelligence", "what": "padlock"}], "cap": "Stamp check: proven chain, unknown motive", "note": "Treasury, 2021"})]),
 ("money", [("dominoes", {"chain": [{"label": "Clinton campaign and DNC", "what": "podium"}, {"label": "Law firm", "what": "documentPage"}, {"label": "Research firm", "what": "magnifier"}, {"label": "Christopher Steele", "what": "laptop"}, {"label": "The memos", "what": "documentPage"}], "cap": "Who paid for the dossier", "redIndex": 0, "note": "paid political research"})]),
 ("errors", [("objectCounter", {"value": 17, "unit": "errors and omissions", "per": "significant, in 4 applications", "object": "warningSign", "each": 1, "cap": "DOJ Inspector General, Dec 2019", "note": "seventeen", "redIndex": 0})]),
 ("venn", [("vennOverlap", {"sets": [{"label": "Dossier claims"}, {"label": "Rest of the record"}],
   "items": [{"what": "documentPage", "in": [0], "label": "Prague trip"}, {"what": "padlock", "in": [0], "label": "Tape"}, {"what": "phone", "in": [1], "label": "June meeting"},
   {"what": "laptop", "in": [1], "label": "Polling data"}, {"what": "building", "in": [1], "label": "Moscow talks"}], "cap": "Stamp check: the case without the dossier"})]),
 ("indicted", [("tallyBoard", {"items": [{"label": "Troll factory staff", "count": 13, "object": "phone"}, {"label": "Military intelligence officers", "count": 12, "object": "laptop"}], "unit": "Russians indicted, 2018", "cap": "Interference: proven", "redIndex": 1, "note": "twelve officers"})]),
 ("finding", [("annotatedDoc", {"head": "Mueller report, Vol. I", "ref": "April 2019", "cap": "The central finding",
   "body": [{"t": "the investigation did not establish that members of the Trump Campaign conspired or coordinated with the Russian government", "hi": 2, "note": "not established"}]})]),
 ("charged", [("illustratedBars", {"items": [{"label": "People charged", "value": 34}, {"label": "Charged with conspiring with Russia", "value": 0}], "object": "mannequin", "each": 2, "unit": "people", "cap": "The inquiry's charges", "redIndex": 1, "note": "none"})]),
 ("obstruction", [("quoteCard", {"quote": "while this report does not conclude that the President committed a crime, it also does not exonerate him", "em": "does not exonerate", "by": "Special Counsel Robert Mueller",
   "role": "Report, Vol. II", "when": "April 2019", "cap": "On obstruction"})]),
 ("readings", [("splitAvsB", {"a": {"label": "Republicans", "object": "documentPage"}, "b": {"label": "Democrats", "object": "documentPage"}, "rows": [{"label": "Same 966 pages", "a": True, "b": True}, {"label": "Shows collusion?", "a": "no", "b": "yes"}], "cap": "Senate Vol. 5: same facts", "note": "two readings"})]),
 ("transcript", [("annotatedDoc", {"head": "Press conference transcript", "ref": "Helsinki, 16 July 2018", "cap": "Exhibit G",
   "body": [{"t": "I don't see any reason why it would be", "hi": 2, "note": "next day: 'wouldn't'"}, {"t": "President Putin says it's not Russia.", "hi": 1}]})]),
 ("javelin", [("manifest", {"vessel": "Foreign military sale", "route": "United States to Ukraine", "lines": [{"what": "crates", "n": "Javelin anti-tank missiles", "q": "210"}], "total": "≈$47 million", "totalLabel": "Approved March 2018", "ship": "plane", "cap": "The defence's exhibit"})]),
 ("scale", [("vennOverlap", {"sets": [{"label": "Deference in public"}, {"label": "Tough measures"}], "items": [{"what": "podium", "in": [0], "label": "Helsinki remarks"}, {"what": "globe", "in": [0], "label": "Alaska summit"}, {"what": "documentPage", "in": [1], "label": "60 expelled"}, {"what": "shield", "in": [1], "label": "Javelins"}, {"what": "oilTank", "in": [1], "label": "Oil sanctions"}], "cap": "Stamp check: mixed"})]),
 ("stampU", [("stampedPermit", {"title": "Exhibit H: later claims", "no": "2021 and 2025", "cap": "Stamp check", "stamp": "UNVERIFIED", "sign": "fact-checkers",
   "fields": [{"k": "2021 claim", "v": "ex-KGB major"}, {"k": "2025 claim", "v": "'Krasnov' post"}, {"k": "Documents", "v": "none"}, {"k": "Evidence found", "v": "none"}], "checks": ["Claims logged", "Fact-checked"]})]),
 ("proven", [("layerStack", {"layers": [{"label": "Russia interfered", "what": "laptop"}, {"label": "Moscow talks ran into the campaign", "what": "building"}, {"label": "Campaign took the meeting", "what": "phone"},
   {"label": "Manafort shared polling data", "what": "documentPage"}], "cap": "Proven", "redIndex": 3})]),
 ("unproven", [("branchTree", {"root": {"label": "Not proven", "what": "magnifier", "kids": [{"label": "Prague trip: disproven", "what": "plane", "red": True}, {"label": "Tape: uncorroborated", "what": "padlock"},
   {"label": "KGB recruitment: unverified", "what": "documentPage"}, {"label": "'Krasnov': unverified", "what": "stamp"}]}, "cap": "Disproven or unverified", "note": "disproven by Mueller"})]),
]
mg = [{"id": b, "parts": [{"kind": k, "data": d} for k, d in parts]} for b, parts in MG]

# ---------------- map (plan data) ----------------
MAP = {"bounds": [-95, 60, 22, 72], "center": [-18, 48], "k": 0.4, "highlight": ["RUS", "USA"],
  "routes": {"trip1987": {"pts": [[-74, 40.7], [-62, 45.5], [-45, 51], [-28, 55], [-12, 57], [2, 57.5], [16, 57.2], [28, 56.5], [37.6, 55.75]]},
    "email": {"pts": [[37.6, 55.75], [28, 57], [14, 58.4], [-2, 58.2], [-18, 56.4], [-34, 53], [-50, 48.5], [-63, 44.4], [-74, 40.7]]}},
  "pins": {"newyork": [-74, 40.7], "moscow": [37.6, 55.75], "kyiv": [30.5, 50.45], "london": [-0.1, 51.5], "helsinki": [24.9, 60.2], "washington": [-77, 38.9]},
  "signs": [["newyork", "NEW YORK", -74, 40.7, -2.6, 1.6], ["moscow", "MOSCOW", 37.6, 55.75, 2.4, 1.4], ["kyiv", "KYIV", 30.5, 50.45, 0, 1.9], ["london", "LONDON", -0.1, 51.5, -2.6, 1.4],
    ["helsinki", "HELSINKI", 24.9, 60.2, -2.8, -1.2], ["washington", "WASHINGTON", -77, 38.9, -1.0, 1.9]],
  "introWith": {"newyork": "route:trip1987", "moscow": "route:trip1987"}}

# ---------------- a visual for every voiced line ----------------
st = lambda s, subject="focus", **kw: {"set": s, "subject": subject, **kw}
mgv = lambda b, f=0: {"mg": b, "focus": f}
mp = lambda s="map": {"map": True, "subject": s}
LV = {
  # ch1 the question
  1: st("dc_dawn", "set"), 2: st("kremlin_river", callout="Moscow"), 3: mgv("sides"), 4: st("court_square", callout="Evidence: the public record"), 5: mgv("stamps"), 6: mgv("pages"),
  7: st("capitol_overhead", "set"),
  # ch2 exhibit A
  8: mgv("y1987"), 9: mp("route:trip1987"), 10: st("red_square_1987", callout="Hotel site, 1987: never built"), 11: st("moscow_1996", callout="1996 plan: ≈$250M, never built"),
  12: st("bayrock_office", callout="Trump-branded Moscow deal, 2000s"), 13: mgv("quote2008"), 14: st("palm_beach", callout="$41M (2004) → $95M (2008)"), 15: mgv("stampA"), 16: st("moscow_city", "set"),
  # ch3 exhibit B
  17: st("crocus_hall", callout="Miss Universe, Moscow, Nov 2013"), 18: st("crocus_concert", "crowd", callout="Crocus City Hall"), 19: mgv("tweet"), 20: st("kremlin_evening", callout="No meeting (Kremlin, 2016)"),
  21: mgv("agalarov"), 22: mp("route:email"),
  # ch4 exhibit C
  23: st("fifth_avenue", callout="Trump Tower, New York"), 24: st("fifth_avenue", "crowd", callout="June 2015: campaign launch"), 25: mgv("loi"), 26: st("midtown_crossing", callout="Cohen runs the project"),
  27: st("moscow_govt_quarter", callout="Peskov's office, Jan 2016"), 28: st("moscow_govt_quarter", "set", callout="≈20-minute call (Mueller)"), 29: st("campaign_rally", callout="Publicly: no Russia deals"),
  30: mgv("gantt"), 31: st("manhattan_court", callout="Cohen pleads guilty, Nov 2018"), 32: mgv("claimvsrecord"),
  # ch5 exhibit D
  33: mgv("date"), 34: mgv("email", 0), 35: mgv("email", 1), 36: mgv("reply"), 37: st("trump_tower_dusk", callout="9 June 2016"), 38: mgv("attendees", "web"),
  39: st("trump_tower_dusk", "guests", callout="Sanctions law, adoptions"), 40: mgv("charge"), 41: st("moscow_ministry_snow", callout="Ties to the Russian government (Senate)"), 42: mgv("stampD"),
  # ch6 exhibit E
  43: st("dc_night", "set"), 44: mp("pin:kyiv"), 45: st("cigar_club_night", callout="2 Aug 2016, Manhattan"), 46: mgv("polls"), 47: st("special_counsel", callout="'Could not reliably determine' why"), 48: st("senate_building", callout="Senate Intelligence, Vol. 5"),
  49: mgv("grave"), 50: st("treasury", callout="US Treasury, April 2021"), 51: st("alexandria_court", "press", callout="Convicted 2018, pardoned 2020"), 52: mgv("chainE"),
  # ch7 exhibit F
  53: st("london_thames", "set"), 54: st("london_thames", callout="Christopher Steele, ex-MI6"), 55: mgv("money"), 56: st("newsroom_city", callout="Published Jan 2017"),
  57: st("prague_river", callout="Cohen never went (Mueller)"), 58: st("moscow_hotel_night", "set"), 59: mgv("errors"), 60: st("oig_office", callout="'Word of mouth and hearsay'"),
  61: mp("pin:london"), 62: st("doj_building", callout="Durham report, May 2023"), 63: mgv("venn"),
  # ch8 the verdicts
  64: st("capitol_overhead", callout="The official verdicts"), 65: st("capitol_overhead", callout="'Sweeping and systematic' (Mueller)"), 66: st("st_petersburg", callout="Troll factory, St Petersburg"), 67: mgv("indicted"),
  68: st("kremlin_winter", callout="Expected to benefit (Mueller)"), 69: mgv("finding"), 70: mgv("charged"), 71: st("courthouse_steps", "press"), 72: mgv("obstruction"),
  73: st("senate_wing", callout="966 pages, Aug 2020"), 74: mgv("readings"),
  # ch9 exhibit G
  75: mp("pin:helsinki"), 76: st("helsinki_harbour", callout="≈2 hours, interpreters only"), 77: mgv("transcript", 0), 78: mgv("transcript", 1), 79: st("senate_building", callout="Sen. McCain: 'disgraceful'"),
  80: st("seattle_consulate", callout="60 officials expelled, Mar 2018"), 81: mgv("javelin"), 82: st("alaska_base", callout="Alaska summit, Aug 2025"), 83: mgv("scale"),
  # ch10 unverified
  84: st("kgb_building", "set"), 85: st("kgb_building", callout="Claim, 2021: no documents"), 86: st("steppe_town", callout="Facebook claim, 2025"), 87: mgv("stampU"), 88: st("fbi_hq", callout="FBI inquiry, 2017"), 89: st("dc_dusk", "set"),
  # ch11 the gavel
  90: st("courthouse_steps", callout="The exhibits"), 91: mgv("proven"), 92: mgv("unproven"), 93: st("potomac_bridge", "set"), 94: st("moscow_river_bend", "set"), 95: st("dc_dawn", "hall"),
  96: st("dc_mall", "set", endcard=True),
}
# v2 voice cut old lines 7 and 28 (script trimmed to ~9 min): renumber the visual map
DROPPED = (7, 28, 64, 84, 90)
LV = {n - sum(1 for d in DROPPED if d < n): v for n, v in LV.items() if n not in DROPPED}
plan = {"film": "trump", "seed": 23, "sets": list(S.values()), "mg": mg, "map": MAP, "lines": {str(k): v for k, v in LV.items()}}
(F / "plan.json").write_text(json.dumps(plan, indent=1, ensure_ascii=False), encoding="utf8")
used = {v["set"] for v in LV.values() if "set" in v}
print("sets", len(S), "used", len(used), "unused", sorted(set(S) - used), "mg beats", len(mg), "lines", len(LV),
      "mg lines", sum(1 for v in LV.values() if "mg" in v), "map lines", sum(1 for v in LV.values() if "map" in v))
