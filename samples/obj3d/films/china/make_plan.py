# Producer step for "How China became a copy machine" (miniature v2): writes plan.json = places (composer specs), MG beats (kinds + data),
# map spec, and a visual for every voiced line. Every number shown comes from the sourced script header (script.md / FACTS.md). Run: python make_plan.py
import json, pathlib
F = pathlib.Path(__file__).parent
S = {}
def setp(id, ground, place, light="morning", ambient=("birds",), **kw): S[id] = {"id": id, "ground": ground, "place": place, "light": {"time": light}, "ambient": list(ambient), **kw}
TOWN = lambda n, w="inland": {"what": "town", "n": n, "where": w}
PPL = lambda n, w: {"what": "people", "n": n, "where": w}

# ---------------- places (all generated at runtime from these specs) ----------------
# Shenzhen / Huaqiangbei
setp("hqb_street", {"kind": "city", "seed": 201, "relief": 0.1, "size": 240, "shore": False}, [
  {"what": "road", "from": "edge:west", "to": "edge:east", "name": "street"}, {"what": "stall", "n": 14, "where": "near street", "focus": True, "focusIndex": 4, "name": "counter"},
  {"what": "tower", "n": 5, "where": "center", "floors": 22, "name": "malls"}, {"what": "midrise", "n": 16, "where": "near malls"}, PPL(5, "near counter"), PPL(4, "near street"),
  {"what": "car", "n": 8, "where": "street"}, {"what": "city", "n": 90, "where": "edge"}], light="afternoon", ambient=())
setp("phone_workshops", {"kind": "plain", "seed": 207, "relief": 0.15, "size": 240, "shore": False}, [
  {"what": "factory", "n": 2, "where": "center", "focus": True, "focusIndex": 0, "name": "workshop"}, {"what": "shed", "n": 14, "where": "near workshop"}, {"what": "warehouse", "n": 4, "where": "near workshop"},
  {"what": "road", "from": "edge:south", "to": "workshop", "name": "lane"}, {"what": "truck", "n": 6, "where": "lane"}, PPL(4, "near workshop"), {"what": "midrise", "n": 14, "where": "edge"}], light="morning", ambient=())
setp("export_port", {"kind": "coast", "seed": 211, "relief": 0.15, "size": 280, "shore": "south"}, [
  {"what": "quay", "len": 120, "name": "quay"}, {"what": "gantryCrane", "n": 6, "where": "quay"}, {"what": "containerShip", "n": 2, "where": "quay", "focus": True, "focusIndex": 0, "name": "ship"},
  {"what": "containerYard", "n": 3, "where": "behind quay", "cols": 10, "rows": 6}, {"what": "road", "from": "quay", "to": "edge:north", "name": "road"}, {"what": "truck", "n": 12, "where": "road"},
  {"what": "tug", "n": 2, "where": "water near quay"}, {"what": "city", "n": 70, "where": "inland edge"}], light="noon")
setp("ai_campus", {"kind": "city", "seed": 215, "relief": 0.1, "size": 240, "shore": False}, [
  {"what": "campus", "where": "center", "focus": True, "name": "lab"}, {"what": "datacenter", "n": 2, "where": "near lab", "name": "halls"}, {"what": "tower", "n": 3, "where": "edge"},
  {"what": "road", "from": "edge:west", "to": "lab", "name": "road"}, {"what": "car", "n": 10, "where": "road"}, {"what": "trees", "n": 60, "where": "near lab"}, {"what": "midrise", "n": 20, "where": "edge"}], light="evening", ambient=())
setp("ev_yard", {"kind": "plain", "seed": 219, "relief": 0.15, "size": 260, "shore": False}, [
  {"what": "factory", "n": 2, "where": "center", "name": "plant"}, {"what": "car", "n": 40, "where": "near plant", "focus": True, "focusIndex": 6, "name": "evs"},
  {"what": "solarArray", "n": 2, "rows": 4, "cols": 8, "where": "near plant"}, {"what": "rail", "from": "edge:west", "to": "edge:east", "name": "rail"}, {"what": "train", "where": "rail", "wagon": "box", "n": 9},
  {"what": "drone", "n": 3, "where": "near plant"}, {"what": "trees", "n": 50, "where": "edge"}], light="morning", ambient=())
setp("shenzhen_1980", {"kind": "coast", "seed": 223, "relief": 0.3, "size": 260, "shore": "south"}, [
  {"what": "fishingBoat", "n": 6, "where": "shore", "focus": True, "focusIndex": 2, "name": "boats"}, {"what": "hut", "n": 14, "where": "near boats", "name": "village"}, {"what": "jetty", "len": 24},
  {"what": "plantation", "rows": 12, "cols": 18, "where": "inland"}, {"what": "plantation", "rows": 9, "cols": 14, "where": "inland"}, {"what": "trees", "n": 80, "where": "hills"}, PPL(3, "near village")], light="dawn")
setp("sez_factories", {"kind": "plain", "seed": 227, "relief": 0.15, "size": 260, "shore": False}, [
  {"what": "factory", "n": 4, "where": "center", "focus": True, "focusIndex": 1, "name": "factories"}, {"what": "warehouse", "n": 6, "where": "near factories"}, {"what": "road", "from": "edge:west", "to": "edge:east", "name": "road"},
  {"what": "truck", "n": 10, "where": "road"}, {"what": "midrise", "n": 18, "where": "edge"}, PPL(3, "near factories")], light="noon", ambient=())
setp("hqb_markets", {"kind": "city", "seed": 231, "relief": 0.1, "size": 250, "shore": False}, [
  {"what": "tower", "n": 8, "where": "center", "focus": True, "focusIndex": 2, "name": "markets"}, {"what": "midrise", "n": 30, "where": "near markets"}, {"what": "road", "from": "edge:north", "to": "edge:south", "name": "road"},
  {"what": "stall", "n": 10, "where": "near road"}, PPL(5, "near road"), {"what": "bus", "n": 3, "where": "road"}, {"what": "car", "n": 10, "where": "road"}, {"what": "city", "n": 120, "where": "edge"}], light="noon", ambient=())
setp("stronghold", {"kind": "mountains", "seed": 233, "relief": 0.6, "size": 260}, [
  {"what": "watchtower", "n": 2, "where": "hills", "focus": True, "focusIndex": 0, "name": "fort"}, {"what": "hut", "n": 9, "where": "near fort"}, {"what": "fence", "from": "fort", "to": "edge:east"},
  {"what": "trees", "n": 110, "where": "hills"}, PPL(3, "near fort")], light="afternoon")
setp("knockoff_stalls", {"kind": "city", "seed": 237, "relief": 0.1, "size": 220, "shore": False}, [
  {"what": "road", "from": "edge:west", "to": "edge:east", "name": "lane"}, {"what": "stall", "n": 20, "where": "near lane", "focus": True, "focusIndex": 7, "name": "stalls"},
  {"what": "midrise", "n": 22, "where": "edge"}, PPL(6, "near stalls"), PPL(4, "near lane"), {"what": "crates", "n": 4, "where": "near stalls"}], light="afternoon", ambient=())
setp("village_shop", {"kind": "plain", "seed": 241, "relief": 0.35, "size": 250, "shore": False}, [
  TOWN(40, "center"), {"what": "road", "from": "edge:west", "to": "edge:east", "name": "road"}, {"what": "stall", "n": 3, "where": "near road", "focus": True, "focusIndex": 1, "name": "shop"},
  {"what": "bus", "n": 1, "where": "road"}, PPL(4, "near shop"), {"what": "plantation", "rows": 10, "cols": 14, "where": "edge"}, {"what": "trees", "n": 60, "where": "edge"}], light="afternoon")
setp("hqb_night", {"kind": "city", "seed": 245, "relief": 0.1, "size": 230, "shore": False}, [
  {"what": "road", "from": "edge:north", "to": "edge:south", "name": "street"}, {"what": "stall", "n": 12, "where": "near street", "focus": True, "focusIndex": 3, "name": "stalls"},
  {"what": "tower", "n": 4, "where": "center"}, PPL(5, "near stalls"), {"what": "car", "n": 6, "where": "street"}, {"what": "city", "n": 80, "where": "edge"}], light="evening", ambient=())
setp("import_terminal", {"kind": "coast", "seed": 381, "relief": 0.15, "size": 270, "shore": "south"}, [
  {"what": "quay", "len": 100, "name": "quay"}, {"what": "containerShip", "where": "quay", "focus": True, "name": "ship"}, {"what": "car", "n": 50, "where": "behind quay"},
  {"what": "gantryCrane", "n": 3, "where": "quay"}, {"what": "road", "from": "quay", "to": "edge:north", "name": "road"}, {"what": "truck", "n": 6, "where": "road"}, {"what": "city", "n": 80, "where": "inland"}], light="morning")
setp("nvidia_hq", {"kind": "city", "seed": 385, "relief": 0.1, "size": 250, "shore": False}, [
  {"what": "campus", "where": "center", "focus": True, "name": "hq"}, {"what": "road", "from": "edge:west", "to": "edge:east", "name": "road"}, {"what": "car", "n": 12, "where": "road"},
  {"what": "trees", "n": 60, "where": "near hq"}, {"what": "midrise", "n": 20, "where": "edge"}], light="evening", ambient=())
# joint ventures, rules
setp("jv_plant", {"kind": "plain", "seed": 251, "relief": 0.15, "size": 270, "shore": False}, [
  {"what": "factory", "n": 2, "where": "center", "focus": True, "focusIndex": 0, "name": "plant"}, {"what": "car", "n": 30, "where": "near plant"}, {"what": "warehouse", "n": 3, "where": "near plant"},
  {"what": "rail", "from": "edge:west", "to": "edge:east"}, {"what": "train", "where": "rail", "wagon": "box", "n": 10}, {"what": "govHall", "where": "edge", "name": "office"}, {"what": "trees", "n": 50, "where": "edge"}], light="afternoon", ambient=())
setp("car_line", {"kind": "plain", "seed": 255, "relief": 0.2, "size": 250, "shore": False}, [
  {"what": "factory", "where": "center", "name": "line"}, {"what": "road", "from": "line", "to": "edge:east", "name": "exit"}, {"what": "car", "n": 12, "where": "exit", "formation": "queue", "focus": True, "focusIndex": 0, "name": "newcars"},
  PPL(4, "near line"), {"what": "warehouse", "n": 3, "where": "near line"}, {"what": "midrise", "n": 12, "where": "edge"}], light="morning", ambient=())
setp("approvals_office", {"kind": "city", "seed": 259, "relief": 0.1, "size": 240, "shore": False}, [
  {"what": "govHall", "where": "center", "focus": True, "name": "bureau"}, {"what": "road", "from": "edge:west", "to": "edge:east", "name": "road"},
  {"what": "checkpoint", "where": "road", "t": 0.8, "name": "approval"}, {"what": "truck", "n": 6, "where": "road", "formation": "queue", "start": 0.45, "moving": False},
  {"what": "trees", "n": 40, "where": "near bureau"}, {"what": "city", "n": 70, "where": "edge"}, PPL(3, "near bureau")], light="overcast", ambient=())
setp("washington", {"kind": "city", "seed": 263, "relief": 0.1, "size": 260, "shore": False}, [
  {"what": "govHall", "where": "center", "focus": True, "name": "ustr"}, {"what": "trees", "n": 80, "where": "near ustr"}, {"what": "road", "from": "edge:west", "to": "edge:east", "name": "avenue"},
  {"what": "car", "n": 12, "where": "avenue"}, {"what": "city", "n": 120, "where": "edge"}, PPL(3, "near ustr")], light="morning")
setp("beijing_ministry", {"kind": "city", "seed": 267, "relief": 0.1, "size": 260, "shore": False}, [
  {"what": "govHall", "where": "center", "focus": True, "name": "ministry"}, {"what": "road", "from": "edge:north", "to": "edge:south", "name": "road"}, {"what": "car", "n": 10, "where": "road"},
  {"what": "trees", "n": 60, "where": "near ministry"}, {"what": "tower", "n": 6, "where": "edge"}, {"what": "city", "n": 110, "where": "edge"}], light="afternoon", ambient=())
setp("npc_hall", {"kind": "city", "seed": 271, "relief": 0.1, "size": 260, "shore": False}, [
  {"what": "govHall", "where": "center", "focus": True, "name": "hall"}, {"what": "road", "from": "edge:west", "to": "hall", "name": "road"}, {"what": "bus", "n": 4, "where": "road", "formation": "queue"},
  PPL(6, "near hall"), {"what": "trees", "n": 50, "where": "near hall"}, {"what": "city", "n": 100, "where": "edge"}], light="noon", ambient=())
# the cases
setp("us_court", {"kind": "city", "seed": 275, "relief": 0.1, "size": 240, "shore": False}, [
  {"what": "govHall", "where": "center", "focus": True, "name": "court"}, {"what": "road", "from": "edge:west", "to": "edge:east", "name": "road"}, {"what": "car", "n": 8, "where": "road"},
  PPL(4, "near court"), {"what": "trees", "n": 40, "where": "near court"}, {"what": "midrise", "n": 24, "where": "edge"}], light="overcast", ambient=())
setp("wind_farm", {"kind": "hills", "seed": 279, "relief": 0.45, "size": 270, "shore": False}, [
  {"what": "windTurbine", "n": 10, "where": "hills", "focus": True, "focusIndex": 2, "name": "turbines"}, {"what": "road", "from": "edge:west", "to": "edge:east", "name": "road"},
  {"what": "truck", "n": 3, "where": "road"}, {"what": "shed", "n": 2, "where": "near road"}, {"what": "trees", "n": 50, "where": "hills"}], light="afternoon")
setp("austria", {"kind": "mountains", "seed": 283, "relief": 0.5, "size": 260}, [
  TOWN(36, "center"), {"what": "midrise", "n": 6, "where": "near town", "focus": True, "focusIndex": 2, "name": "office"}, {"what": "road", "from": "edge:west", "to": "edge:east", "name": "road"},
  {"what": "car", "n": 6, "where": "road"}, {"what": "trees", "n": 90, "where": "hills"}], light="morning")
setp("madison_court", {"kind": "plain", "seed": 287, "relief": 0.2, "size": 250, "shore": False}, [
  {"what": "govHall", "where": "center", "focus": True, "name": "court"}, TOWN(50, "edge"), {"what": "road", "from": "edge:north", "to": "court", "name": "road"},
  {"what": "car", "n": 8, "where": "road"}, PPL(3, "near court"), {"what": "trees", "n": 60, "where": "edge"}], light="overcast")
setp("chip_fab", {"kind": "coast", "seed": 291, "relief": 0.3, "size": 260, "shore": "east"}, [
  {"what": "fab", "n": 2, "where": "land near shore", "focus": True, "focusIndex": 0, "name": "fab"}, {"what": "warehouse", "n": 3, "where": "near fab"}, {"what": "pipeRack", "where": "near fab"},
  {"what": "road", "from": "fab", "to": "edge:west", "name": "road"}, {"what": "truck", "n": 4, "where": "road"}, {"what": "midrise", "n": 20, "where": "inland"}, {"what": "trees", "n": 40, "where": "hills"}], light="morning")
setp("sf_court", {"kind": "coast", "seed": 295, "relief": 0.3, "size": 260, "shore": "north"}, [
  {"what": "govHall", "where": "land near shore", "focus": True, "name": "court"}, {"what": "city", "n": 110, "where": "shore"}, {"what": "tower", "n": 6, "where": "near court"},
  {"what": "ferry", "n": 2, "where": "shore"}, {"what": "road", "from": "court", "to": "edge:south", "name": "road"}, {"what": "car", "n": 8, "where": "road"}], light="afternoon")
# the bullet train
setp("rail_depot", {"kind": "plain", "seed": 301, "relief": 0.15, "size": 260, "shore": False}, [
  {"what": "rail", "from": "edge:west", "to": "edge:east", "name": "track1"}, {"what": "train", "where": "track1", "wagon": "hsr", "n": 8, "focus": True, "name": "train", "moving": False},
  {"what": "warehouse", "n": 4, "where": "near track1", "len": 16, "name": "sheds"}, {"what": "govHall", "where": "edge"}, PPL(3, "near sheds"), {"what": "midrise", "n": 14, "where": "edge"}], light="morning", ambient=())
setp("hsr_plain", {"kind": "plain", "seed": 305, "relief": 0.3, "size": 280, "shore": False}, [
  {"what": "rail", "from": "edge:west", "to": "edge:east", "name": "line"}, {"what": "train", "where": "line", "wagon": "hsr", "n": 8, "focus": True, "name": "train"},
  TOWN(40, "center"), {"what": "plantation", "rows": 12, "cols": 18, "where": "edge"}, {"what": "trees", "n": 60, "where": "edge"}], light="noon")
setp("kawasaki_works", {"kind": "coast", "seed": 309, "relief": 0.3, "size": 260, "shore": "south"}, [
  {"what": "factory", "n": 2, "where": "land near shore", "focus": True, "focusIndex": 0, "name": "works"}, {"what": "quay", "len": 70}, {"what": "gantryCrane", "n": 2, "where": "quay"},
  {"what": "rail", "from": "edge:west", "to": "works", "name": "siding"}, {"what": "train", "where": "siding", "wagon": "hsr", "n": 6, "moving": False}, {"what": "midrise", "n": 16, "where": "inland"}], light="overcast")
setp("fuxing_mountains", {"kind": "mountains", "seed": 313, "relief": 0.55, "size": 280}, [
  {"what": "rail", "from": "edge:west", "to": "edge:east", "name": "line"}, {"what": "train", "where": "line", "wagon": "hsr", "n": 8, "focus": True, "name": "fuxing"},
  {"what": "trees", "n": 120, "where": "hills"}, TOWN(20, "center")], light="morning")
# AI
setp("hangzhou_lab", {"kind": "river", "seed": 317, "relief": 0.2, "size": 260, "width": 16}, [
  {"what": "tower", "n": 4, "where": "shore", "focus": True, "focusIndex": 0, "name": "lab"}, {"what": "midrise", "n": 24, "where": "near lab"}, {"what": "road", "from": "edge:west", "to": "edge:east", "bridge": True, "name": "road"},
  {"what": "car", "n": 8, "where": "road"}, {"what": "trees", "n": 70, "where": "shore"}], light="morning")
setp("openai_sf", {"kind": "coast", "seed": 321, "relief": 0.3, "size": 260, "shore": "east"}, [
  {"what": "tower", "n": 5, "where": "land near shore", "focus": True, "focusIndex": 1, "name": "hq"}, {"what": "city", "n": 120, "where": "shore"}, {"what": "road", "from": "edge:west", "to": "hq", "name": "road"},
  {"what": "car", "n": 10, "where": "road"}, {"what": "ferry", "where": "shore"}, {"what": "trees", "n": 40, "where": "hills"}], light="afternoon")
setp("nyc_court", {"kind": "coast", "seed": 325, "relief": 0.15, "size": 260, "shore": "west"}, [
  {"what": "govHall", "where": "center", "focus": True, "name": "court"}, {"what": "tower", "n": 18, "where": "near court"}, {"what": "road", "from": "edge:north", "to": "edge:south", "name": "road"},
  {"what": "car", "n": 10, "where": "road"}, {"what": "ferry", "n": 2, "where": "shore"}, PPL(3, "near court")], light="overcast", ambient=())
setp("server_farm", {"kind": "plain", "seed": 329, "relief": 0.15, "size": 260, "shore": False}, [
  {"what": "datacenter", "n": 4, "where": "center", "focus": True, "focusIndex": 1, "name": "halls"}, {"what": "pipeRack", "n": 2, "where": "near halls"}, {"what": "solarArray", "n": 3, "rows": 5, "cols": 9, "where": "edge"},
  {"what": "road", "from": "edge:south", "to": "halls", "name": "road"}, {"what": "truck", "n": 3, "where": "road"}, {"what": "fence", "from": "edge:west", "to": "edge:east"}], light="evening", ambient=())
# the turn
setp("shenzhen_today", {"kind": "coast", "seed": 333, "relief": 0.2, "size": 290, "shore": "south"}, [
  {"what": "tower", "n": 26, "where": "shore", "focus": True, "focusIndex": 5, "name": "skyline"}, {"what": "city", "n": 150, "where": "inland"}, {"what": "quay", "len": 70},
  {"what": "ferry", "n": 2, "where": "quay"}, {"what": "road", "from": "edge:west", "to": "edge:east", "name": "road"}, {"what": "car", "n": 14, "where": "road"}, {"what": "trees", "n": 50, "where": "shore"}], light="afternoon")
setp("byd_1995", {"kind": "plain", "seed": 337, "relief": 0.2, "size": 240, "shore": False}, [
  {"what": "factory", "where": "center", "focus": True, "name": "works"}, {"what": "shed", "n": 8, "where": "near works"}, {"what": "road", "from": "works", "to": "edge:south", "name": "road"},
  {"what": "truck", "n": 3, "where": "road"}, PPL(4, "near works"), {"what": "trees", "n": 40, "where": "edge"}, TOWN(16, "edge")], light="morning")
setp("ev_export", {"kind": "coast", "seed": 341, "relief": 0.15, "size": 280, "shore": "south"}, [
  {"what": "quay", "len": 110, "name": "quay"}, {"what": "car", "n": 60, "where": "behind quay", "focus": True, "focusIndex": 11, "name": "evs"}, {"what": "containerShip", "where": "quay"},
  {"what": "gantryCrane", "n": 2, "where": "quay"}, {"what": "road", "from": "quay", "to": "edge:north", "name": "road"}, {"what": "truck", "n": 8, "where": "road"}, {"what": "warehouse", "n": 4, "where": "inland"}], light="noon")
setp("catl_plant", {"kind": "plain", "seed": 345, "relief": 0.15, "size": 270, "shore": False}, [
  {"what": "factory", "n": 3, "where": "center", "focus": True, "focusIndex": 1, "name": "plant"}, {"what": "warehouse", "n": 4, "where": "near plant"}, {"what": "solarArray", "n": 2, "rows": 5, "cols": 10, "where": "near plant"},
  {"what": "road", "from": "plant", "to": "edge:east", "name": "road"}, {"what": "truck", "n": 8, "where": "road"}, {"what": "midrise", "n": 14, "where": "edge"}], light="afternoon", ambient=())
setp("solar_farm", {"kind": "desert", "seed": 349, "relief": 0.2, "size": 280, "shore": False}, [
  {"what": "solarArray", "n": 9, "rows": 6, "cols": 11, "where": "center", "focus": True, "focusIndex": 4, "name": "solar"}, {"what": "factory", "where": "edge", "name": "polysilicon"},
  {"what": "road", "from": "edge:west", "to": "edge:east", "name": "road"}, {"what": "truck", "n": 4, "where": "road"}, {"what": "windTurbine", "n": 4, "where": "edge"}], light="noon", ambient=())
setp("dji_drones", {"kind": "city", "seed": 353, "relief": 0.1, "size": 230, "shore": False}, [
  {"what": "tower", "n": 2, "where": "center", "name": "hq"}, {"what": "drone", "n": 8, "scale": 2.5, "where": "near hq", "focus": True, "focusIndex": 3, "name": "drones"}, PPL(5, "near hq"),
  {"what": "midrise", "n": 18, "where": "edge"}, {"what": "road", "from": "edge:west", "to": "edge:east", "name": "road"}, {"what": "car", "n": 6, "where": "road"}, {"what": "trees", "n": 40, "where": "near hq"}], light="evening", ambient=())
setp("ford_michigan", {"kind": "coast", "seed": 357, "relief": 0.2, "size": 270, "shore": "north", "landFrac": 0.7}, [
  {"what": "factory", "n": 2, "where": "land near shore", "focus": True, "focusIndex": 0, "name": "plant"}, {"what": "car", "n": 20, "where": "near plant"}, {"what": "warehouse", "n": 3, "where": "near plant"},
  {"what": "road", "from": "plant", "to": "edge:south", "name": "road"}, {"what": "truck", "n": 5, "where": "road"}, {"what": "trees", "n": 80, "where": "inland"}, TOWN(20)], light="overcast")
# the ladder
setp("cromford_mill", {"kind": "river", "seed": 361, "relief": 0.5, "size": 250, "width": 13}, [
  {"what": "mill", "where": "shore", "focus": True, "name": "mill"}, TOWN(22, "near mill"), {"what": "trees", "n": 110, "where": "hills"}, PPL(3, "near mill")], light="dawn")
setp("pawtucket", {"kind": "river", "seed": 365, "relief": 0.3, "size": 250, "width": 15}, [
  {"what": "mill", "where": "shore", "focus": True, "name": "mill", "floors": 3}, {"what": "road", "from": "edge:north", "to": "edge:south", "bridge": True, "name": "road"},
  TOWN(30, "inland"), {"what": "trees", "n": 80, "where": "hills"}, {"what": "fishingBoat", "n": 2, "where": "shore"}], light="morning")
setp("waltham", {"kind": "river", "seed": 369, "relief": 0.35, "size": 260, "width": 14}, [
  {"what": "mill", "n": 2, "where": "shore", "focus": True, "focusIndex": 1, "name": "mills"}, TOWN(26, "near mills"), {"what": "trees", "n": 90, "where": "hills"}, PPL(3, "near mills")], light="afternoon")
setp("philadelphia_1791", {"kind": "coast", "seed": 373, "relief": 0.2, "size": 250, "shore": "east"}, [
  {"what": "govHall", "where": "land near shore", "focus": True, "name": "treasury"}, {"what": "house", "n": 40, "where": "near treasury"}, {"what": "jetty", "len": 26},
  {"what": "fishingBoat", "n": 4, "where": "shore"}, {"what": "trees", "n": 70, "where": "inland"}], light="evening")
setp("new_china", {"kind": "plain", "seed": 377, "relief": 0.3, "size": 290, "shore": False}, [
  {"what": "rail", "from": "edge:west", "to": "edge:east", "name": "line"}, {"what": "train", "where": "line", "wagon": "hsr", "n": 8, "focus": True, "name": "train"},
  {"what": "solarArray", "n": 3, "rows": 5, "cols": 9, "where": "edge"}, {"what": "windTurbine", "n": 6, "where": "edge"}, {"what": "tower", "n": 10, "where": "center"}, TOWN(30, "center")], light="evening")

# ---------------- MG beats (kinds + data; nothing prebuilt) ----------------
MG = [
 ("preview", [("linkBoard", {"items": [{"id": "a", "cap": "Joint ventures", "what": "factory"}, {"id": "b", "cap": "Stolen code", "what": "laptop", "key": True}, {"id": "c", "cap": "Bullet trains", "what": "bulletTrain"}], "cap": "The case against"})]),
 ("turnkey", [("explodedView", {"object": "phone", "parts": [{"label": "MediaTek chip + software", "what": "chip"}, {"label": "Screen", "what": "documentPage"}, {"label": "Battery", "what": "battery"}, {"label": "Case", "what": "container"}], "cap": "The turnkey kit", "focusPart": 0})]),
 ("fastphone", [("stepRail", {"steps": [{"label": "Buy the chip kit", "what": "chip"}, {"label": "Design the case", "what": "laptop"}, {"label": "Parts, a few streets away", "what": "pallet"}, {"label": "Assemble", "what": "factory"}, {"label": "On the counter", "what": "phone"}], "cap": "A shanzhai phone", "note": "small workshops"})]),
 ("features", [("splitAvsB", {"a": {"label": "Big brand", "object": "phone"}, "b": {"label": "Shanzhai", "object": "phone"}, "rows": [{"label": "Two SIM slots", "a": False, "b": True}, {"label": "Huge speaker", "a": False, "b": True}, {"label": "Built-in torch", "a": False, "b": True}, {"label": "TV antenna", "a": False, "b": True}], "cap": "Not only copies", "note": "common features (2009)"})]),
 ("output", [("illustratedBars", {"items": [{"label": "2009", "value": 145}, {"label": "2010", "value": 228}], "object": "phone", "each": 25, "unit": "million shanzhai phones (iSuppli est.)", "cap": "Shanzhai output", "redIndex": 1, "note": "estimates"})]),
 ("jv", [("orgChart", {"cap": "A car joint venture, from 1994", "root": {"n": "Joint-venture factory", "what": "factory", "children": [{"n": "State partner", "what": "building", "stake": "50%+", "red": True}, {"n": "Foreign firm", "what": "car", "stake": "max 50%"}]}})]),
 ("wto", [("annotatedDoc", {"head": "WTO Accession Protocol", "ref": "11 December 2001", "cap": "China joins the WTO", "body": [{"t": "Investment approval will not be conditioned on technology transfer.", "hi": 1, "note": "the promise (paraphrased)"}, {"t": "Applies to all foreign investors in China.", "hi": 0, "note": ""}]})]),
 ("rules", [("timelineStrip", {"events": [{"year": 1994, "label": "50% cap", "what": "car"}, {"year": 2018, "label": "EVs: cap off", "what": "battery"}, {"year": 2020, "label": "Transfer law", "what": "documentPage"}, {"year": 2022, "label": "All cars: cap off", "what": "car"}], "cap": "Then the rules changed"})]),
 ("amsc", [("linkBoard", {"items": [{"id": "a", "cap": "AMSC software", "what": "laptop"}, {"id": "b", "cap": "Sinovel turbines", "what": "windTurbine"}, {"id": "c", "cap": "Stopped paying, 2011", "what": "banknoteBundle"}, {"id": "d", "cap": "Its code, in the turbines", "what": "documentPage", "key": True}], "cap": "Case one"})]),
 ("damage", [("objectCounter", {"value": 1, "unit": "billion dollars+", "per": "shareholder value lost (DOJ)", "object": "banknoteBundle", "each": 0.1, "cap": "What AMSC lost", "note": "and almost 700 jobs", "redIndex": 0})]),
 ("settle", [("receipt", {"head": "Sinovel, July 2018", "currency": "$", "cap": "The bill", "items": [{"n": "AMSC deal", "v": 57500000}, {"n": "Max fine", "v": 1500000}]})]),
 ("umc", [("stampedPermit", {"title": "Plea agreement", "no": "US v. UMC", "cap": "Case two", "stamp": "GUILTY PLEA", "sign": "UMC", "fields": [{"k": "Company", "v": "UMC (Taiwan)"}, {"k": "Year", "v": "2020"}, {"k": "Fine", "v": "$60 million"}, {"k": "Jinhua", "v": "acquitted, 2024"}], "checks": ["Plea", "Fine"]})]),
 ("pla", [("hubSpoke", {"cap": "Case three: charged in 2014", "hub": {"n": "5 officers", "what": "laptop"}, "unit": "", "spokes": [{"n": "Westinghouse", "v": 1, "what": "factory"}, {"n": "US Steel", "v": 1, "what": "factory"}, {"n": "Alcoa", "v": 1, "what": "factory"}, {"n": "SolarWorld", "v": 1, "what": "solarPanel"}, {"n": "ATI", "v": 1, "what": "factory"}, {"n": "Steelworkers", "v": 1, "what": "building"}]})]),
 ("cost", [("rangeBand", {"min": 0, "max": 700, "ticks": [{"v": 0, "label": "$0"}, {"v": 225, "label": "$225bn"}, {"v": 600, "label": "$600bn"}, {"v": 700, "label": ""}],
   "sources": [{"label": "Low", "value": 225}, {"label": "High", "value": 600}], "consensus": {"from": 225, "to": 600, "label": "$225-600bn a year"}, "cap": "Cost of IP theft to the US (estimate)", "note": "all countries, not only China"})]),
 ("fakes", [("waffleGrid", {"parts": [{"label": "China + Hong Kong", "value": 87}, {"label": "Rest of world", "value": 13}], "total": 100, "unit": "of seized counterfeits", "cap": "US seizures of fakes (IP Commission)", "object": "container", "redIndex": 0, "note": "principal infringer"})]),
 ("fbi", [("clockDial", {"hours": 24, "marks": [{"from": 0, "to": 1, "label": "New case", "what": "magnifier"}, {"from": 10, "to": 11, "label": "New case", "what": "magnifier"}, {"from": 20, "to": 21, "label": "New case", "what": "magnifier"}], "cap": "About every 10 hours (FBI, 2020)", "redIndex": 1})]),
 ("tender", [("branchTree", {"root": {"label": "2004 tender", "what": "bulletTrain", "kids": [{"label": "Kawasaki", "what": "bulletTrain"}, {"label": "Alstom", "what": "bulletTrain"}, {"label": "Bombardier", "what": "bulletTrain"}, {"label": "Siemens (2005)", "what": "bulletTrain"}, {"label": "Build in China, share know-how", "what": "documentPage", "red": True}]}, "cap": "The deal", "note": "condition of the contracts"})]),
 ("based", [("splitAvsB", {"a": {"label": "CRH2", "object": "bulletTrain"}, "b": {"label": "CRH3", "object": "bulletTrain"}, "rows": [{"label": "Based on", "a": "Kawasaki Shinkansen", "b": "Siemens Velaro"}, {"label": "Licensed", "a": True, "b": True}], "cap": "China's first bullet trains"})]),
 ("network", [("shareRing", {"slices": [{"label": "China", "value": 67}, {"label": "Rest of world", "value": 33}], "object": "bulletTrain", "unit": "of world high-speed rail", "cap": "High-speed rail (UIC)", "redIndex": 0, "note": "≈48,000 km, end 2024"})]),
 ("pattern", [("layerStack", {"layers": [{"label": "Licensed", "what": "documentPage"}, {"label": "Absorbed", "what": "magnifier"}, {"label": "Rebuilt", "what": "factory"}, {"label": "Scaled", "what": "bulletTrain"}], "cap": "The pattern", "redIndex": 3})]),
 ("trainingcost", [("sizeCircles", {"items": [{"label": "Final run", "value": 5.6, "object": "chip"}, {"label": "All servers (est.)", "value": 1600, "object": "chip"}], "unit": "million dollars (approx.)", "cap": "DeepSeek vs SemiAnalysis estimate", "redIndex": 0, "note": "two different measures"})]),
 ("distil", [("conveyor", {"input": "documentPage", "stations": [{"label": "Ask millions of questions", "what": "documentPage", "out": "documentPage"}, {"label": "Big model answers", "what": "laptop", "out": "documentPage"}, {"label": "Smaller model learns", "what": "chip", "out": "chip"}], "cap": "Distillation", "unit": "", "red": 2})]),
 ("accounts", [("pictogramRow", {"rows": [{"label": "Fake accounts (Anthropic, 2026)", "value": 24000}], "object": "laptop", "each": 2000, "unit": "accounts (approx.)", "cap": "Over 16 million exchanges", "redRow": 0, "note": "an allegation"})]),
 ("leak", [("vennOverlap", {"sets": [{"label": "Training data"}, {"label": "Benchmark tests"}], "items": [{"what": "documentPage", "in": [0]}, {"what": "laptop", "in": [0]}, {"what": "phone", "in": [0]}, {"what": "magnifier", "in": [1]}, {"what": "calendarPage", "in": [1]}, {"what": "documentPage", "in": [0, 1]}], "cap": "Signs of benchmark leakage", "note": "a leak, not proof of cheating"})]),
 ("bydtesla", [("groupedBars", {"categories": ["2024", "2025"], "series": [{"name": "BYD", "values": [1.76, 2.26]}, {"name": "Tesla", "values": [1.79, 1.64]}], "unit": "million battery-electric cars", "cap": "BYD vs Tesla", "note": "BYD ahead in 2025", "redSeries": 0})]),
 ("patents", [("balanceScale", {"left": {"label": "China (≈1.64 m)", "what": "documentPage", "n": 4, "weight": 1.64}, "right": {"label": "Rest of world (≈1.91 m)", "what": "documentPage", "n": 4, "weight": 1.91}, "cap": "Patent applications, 2023 (WIPO)", "note": "China ≈46%"})]),
 ("tracker", [("tallyBoard", {"items": [{"label": "China leads", "count": 57, "object": "magnifier"}, {"label": "Others lead", "count": 7, "object": "magnifier"}], "unit": "of 64 technologies (ASPI, research output)", "cap": "Critical technology tracker, 2024", "redIndex": 0, "note": "research, not products"})]),
 ("ladder", [("ganttBars", {"tasks": [{"label": "Britain: textiles", "start": 1770, "end": 1850, "what": "spinningFrame"}, {"label": "USA: mills", "start": 1790, "end": 1890, "what": "factory"}, {"label": "Germany", "start": 1870, "end": 1914, "what": "chimney"}, {"label": "Japan", "start": 1950, "end": 1990, "what": "car"}, {"label": "China", "start": 1980, "end": 2025, "what": "phone"}], "unit": "yrs", "cap": "Catch-up eras (approx.)", "redIndex": 4})]),
 ("copyright", [("splitFlapDate", {"text": "1891", "groups": ["YEAR"], "what": "documentPage", "label": "first US copyright for foreign authors", "cap": "Until then, free to copy"})]),
 ("germany", [("stampedPermit", {"title": "Merchandise Marks Act", "no": "UK, 1887", "cap": "A warning label", "stamp": "MADE IN GERMANY", "sign": "Parliament", "fields": [{"k": "Rule", "v": "foreign goods must say so"}, {"k": "Aimed at", "v": "goods passing as British"}, {"k": "Later", "v": "a badge of quality"}], "checks": ["Label", "Origin"]})]),
 ("kick", [("dominoes", {"chain": [{"label": "Copy the machines", "what": "spinningFrame"}, {"label": "Build industry", "what": "factory"}, {"label": "Get rich", "what": "coinStack"}, {"label": "Ban copying", "what": "padlock"}], "cap": "Kicking away the ladder (Chang, 2002)", "redIndex": 3, "note": "an argument, disputed"})]),
 ("slater", [("pinChain", {"cap": "Slater sails for America, 1789", "region": [-80, 30, 5, 60], "mode": "ship", "stops": [{"n": "Britain", "ll": [-1.5, 53], "what": "spinningFrame"}, {"n": "Rhode Island", "ll": [-71.4, 41.9], "what": "factory"}]})]),
 ("climbers", [("timelineStrip", {"events": [{"year": 1789, "label": "Slater copies British mills", "what": "spinningFrame"}, {"year": 1814, "label": "Lowell's power loom", "what": "factory"}, {"year": 1887, "label": "Made in Germany label", "what": "stamp"}, {"year": 1959, "label": "Japan curbs design copying", "what": "car"}, {"year": 1980, "label": "Shenzhen zone opens", "what": "phone"}], "cap": "Every industrial power climbed"})]),
]
mg = [{"id": b, "parts": [{"kind": k, "data": d} for k, d in parts]} for b, parts in MG]

# ---------------- map (plan data) ----------------
MAP = {"bounds": [70, 150, 0, 55], "center": [108, 30], "k": 0.42, "highlight": ["CHN"],
  "routes": {}, "pins": {"shenzhen": [114.1, 22.55]},
  "signs": [["shenzhen", "SHENZHEN", 114.1, 22.55, 2.6, 1.4], ["china", "CHINA", 104, 35, 0, -1.6]]}

# ---------------- a visual for every voiced line ----------------
st = lambda s, subject="focus", **kw: {"set": s, "subject": subject, **kw}
mgv = lambda b, f=0: {"mg": b, "focus": f}
mp = lambda s="map": {"map": True, "subject": s}
LV = {1: st("hqb_street", callout="Huaqiangbei, Shenzhen"), 2: st("hqb_street", framing="threeQuarter", callout="A fraction of the price"), 3: st("phone_workshops", callout="Shanzhai workshops"),
  4: st("export_port", callout="The copy machine?"), 5: mgv("preview", 0), 6: st("ai_campus", callout="Artificial intelligence"), 7: st("ev_yard", "set", callout="EVs, batteries, solar, drones"), 8: mp(),
  9: st("shenzhen_1980", callout="Shenzhen, 1980"), 10: mp("pin:shenzhen"), 11: st("sez_factories", callout="Factories for foreign brands"), 12: st("shenzhen_today", "set", framing="highOblique", callout="17.6 million people (2020)"),
  13: st("hqb_markets", callout="≈115,000 businesses, ≈1.45 km²"), 14: st("stronghold", callout="Shanzhai: mountain stronghold"), 15: st("knockoff_stalls", callout="Very familiar logos"),
  16: mgv("turnkey"), 17: mgv("fastphone"), 18: mgv("features"), 19: st("village_shop", callout="Customers the brands ignored"), 20: mgv("output"), 21: st("hqb_night"),
  22: st("import_terminal", callout="A billion customers"), 23: mgv("jv"), 24: st("jv_plant", callout="VW and GM, with Shanghai's SAIC"), 25: st("car_line", callout="Jobs, profits, know-how"), 26: mgv("wto"),
  27: st("approvals_office", callout="Licences and approvals"), 28: st("washington", callout="USTR Section 301 report, 2018"), 29: st("beijing_ministry", callout="Beijing: voluntary deals"),
  30: mgv("rules", 1), 31: st("npc_hall", framing="lateralLow", callout="Foreign Investment Law, 2020"), 32: st("jv_plant", framing="orbitBack", callout="1994 to 2022"),
  33: st("us_court", framing="lateralLow", callout="Courts found theft"), 34: st("wind_farm", callout="Sinovel wind turbines"), 35: mgv("amsc", 2), 36: st("austria", callout="Austria: engineer paid for the code"),
  37: st("madison_court", framing="highOblique", callout="Sinovel: guilty, 2018"), 38: mgv("damage", 0), 39: mgv("settle"), 40: st("chip_fab", callout="Micron's Taiwan unit"), 41: mgv("umc"),
  42: st("sf_court", framing="highOblique", callout="Fujian Jinhua: acquitted, 2024"), 43: mgv("pla"), 44: mgv("cost"), 45: mgv("fakes"), 46: mgv("fbi"),
  47: st("rail_depot", callout="2004: the tender"), 48: mgv("tender"), 49: mgv("based"), 50: st("hsr_plain", callout="Chinese-built bullet trains"), 51: st("kawasaki_works", callout="Kawasaki objected"),
  52: st("fuxing_mountains", callout="Fuxing, 2017"), 53: mgv("network"), 54: mgv("pattern"),
  55: st("hangzhou_lab", callout="DeepSeek R1, January 2025"), 56: mgv("trainingcost"), 57: st("nvidia_hq", callout="Nvidia: about -$590bn in one day"), 58: st("openai_sf", callout="OpenAI: distillation claim (allegation)"),
  59: mgv("distil"), 60: mgv("accounts"), 61: st("beijing_ministry", framing="orbitBack", callout="Beijing: \"groundless\""), 62: mgv("leak"), 63: st("nyc_court", callout="NYT v. OpenAI, 2023"), 64: st("server_farm", callout="No court ruling"),
  65: st("shenzhen_today", callout="Shenzhen today"), 66: st("byd_1995", callout="BYD, 1995: phone batteries"), 67: mgv("bydtesla"), 68: st("ev_export", "set", callout="≈7 in 10 EVs made in China"),
  69: st("catl_plant", callout="CATL: 37.9% of EV batteries"), 70: st("solar_farm", callout="80%+ of every solar step"), 71: st("dji_drones", callout="DJI: most consumer drones (est.)"),
  72: mgv("patents"), 73: mgv("tracker"), 74: st("ford_michigan", callout="Ford, Michigan: CATL tech, licensed"), 75: st("ford_michigan", framing="orbitBack", callout="The deal, in reverse"),
  76: mgv("ladder"), 77: st("cromford_mill", callout="Britain, 1789: machines may not leave"), 78: mgv("slater"), 79: st("pawtucket", callout="Slater Mill, Pawtucket, 1790"),
  80: st("waltham", callout="Lowell's mill, Waltham, 1814"), 81: st("philadelphia_1791", callout="Hamilton's report, 1791"), 82: mgv("copyright"), 83: mgv("germany"), 84: mgv("kick"),
  85: st("us_court", framing="orbitBack", callout="Theft is theft"), 86: mgv("climbers"),
  87: st("hqb_street", framing="orbitBack"), 88: st("shenzhen_today", framing="orbitBack"), 89: st("new_china"), 90: st("new_china", framing="highOblique", endcard=True)}
plan = {"film": "china", "seed": 23, "sets": list(S.values()), "mg": mg, "map": MAP, "lines": {str(k): v for k, v in LV.items()}}
(F / "plan.json").write_text(json.dumps(plan, indent=1, ensure_ascii=False), encoding="utf8")
print("sets", len(S), "mg beats", len(mg), "lines", len(LV))
