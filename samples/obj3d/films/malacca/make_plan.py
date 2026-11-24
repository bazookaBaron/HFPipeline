# Producer step for the Malacca film (miniature v2): writes plan.json = places (composer specs), MG beats (kinds + data), map spec,
# and a visual for every voiced line. Every number shown comes from the sourced script header (script.md). Run: python make_plan.py
import json, pathlib
F = pathlib.Path(__file__).parent
TOWN = lambda n, w="inland": {"what": "town", "n": n, "where": w}
S = {}
def setp(id, ground, place, light="morning", ambient=("birds",), **kw): S[id] = {"id": id, "ground": ground, "place": place, "light": {"time": light}, "ambient": list(ambient), **kw}

# ---------------- places (all generated at runtime from these specs) ----------------
setp("strait_queue", {"kind": "strait", "seed": 2, "relief": 0.35, "size": 300, "width": 64}, [
  {"what": "city", "n": 70, "where": "shore", "name": "city"}, TOWN(36, "shore"), {"what": "lighthouse", "where": "shore"},
  {"what": "tanker", "n": 11, "where": "lane queue", "formation": "queue", "focus": True, "focusIndex": 2, "name": "queue"},
  {"what": "containerShip", "n": 4, "where": "lane", "lane": 1}, {"what": "tug", "n": 3, "where": "lane"}, {"what": "trees", "n": 60, "where": "inland"}], autoLand=False)
setp("phillip_morning", {"kind": "strait", "seed": 31, "relief": 0.25, "size": 280, "width": 48, "meander": 6}, [
  {"what": "lighthouse", "where": "shore", "focus": True, "name": "lighthouse"}, {"what": "city", "n": 90, "where": "shore"}, TOWN(30, "shore"),
  {"what": "tanker", "n": 3, "where": "lane", "lane": 0}, {"what": "containerShip", "n": 3, "where": "lane", "lane": 1}, {"what": "buoy", "n": 10, "where": "lane"}, {"what": "skiff", "n": 4, "where": "shore"}], autoLand=False)
setp("phillip_dusk", {"kind": "strait", "seed": 47, "relief": 0.3, "size": 280, "width": 46, "meander": 9}, [
  {"what": "tanker", "n": 2, "where": "lane", "lane": 0, "focus": True, "name": "tanker"}, {"what": "bulkCarrier", "n": 2, "where": "lane", "lane": 1}, {"what": "city", "n": 60, "where": "shore"},
  {"what": "radarMast", "n": 2, "where": "shore"}, {"what": "buoy", "n": 8, "where": "lane"}, {"what": "fishingBoat", "n": 3, "where": "shore"}], light="evening", autoLand=False)
setp("anchorage", {"kind": "coast", "seed": 13, "relief": 0.2, "size": 300, "shore": "north", "landFrac": 0.35}, [
  {"what": "city", "n": 110, "where": "shore", "name": "skyline"}, {"what": "tanker", "n": 9, "where": "anchorage", "focus": True, "focusIndex": 3, "name": "anchored"},
  {"what": "bulkCarrier", "n": 6, "where": "anchorage"}, {"what": "containerShip", "n": 4, "where": "anchorage"}, {"what": "tug", "n": 3, "where": "anchorage"}, {"what": "buoy", "n": 8, "where": "anchorage"}], light="afternoon")
setp("beijing", {"kind": "city", "seed": 23, "relief": 0.1, "size": 260, "shore": False}, [
  {"what": "govHall", "where": "center", "focus": True, "name": "hall"}, {"what": "city", "n": 160, "where": "edge"}, {"what": "road", "from": "edge:west", "to": "edge:east"},
  {"what": "car", "n": 14, "where": "road"}, {"what": "trees", "n": 70, "where": "near hall"}, {"what": "people", "n": 4, "where": "near hall"}], light="evening")
setp("singapore_waterfront", {"kind": "city", "seed": 17, "relief": 0.1, "size": 280, "shore": "south"}, [
  {"what": "quay", "len": 130, "name": "quay"}, {"what": "city", "n": 190, "where": "behind quay", "name": "downtown"}, {"what": "govHall", "where": "near downtown", "focus": True},
  {"what": "lighthouse", "where": "shore"}, {"what": "ferry", "n": 2, "where": "quay"}, {"what": "skiff", "n": 5, "where": "shore"}, {"what": "trees", "n": 80, "where": "shore"}, {"what": "car", "n": 12, "where": "behind quay"}], light="afternoon")
setp("container_port", {"kind": "coast", "seed": 5, "relief": 0.15, "size": 280, "shore": "south"}, [
  {"what": "quay", "len": 120, "name": "quay"}, {"what": "gantryCrane", "n": 7, "where": "quay"}, {"what": "containerShip", "n": 2, "where": "quay", "focus": True, "focusIndex": 0},
  {"what": "containerYard", "n": 3, "where": "behind quay", "cols": 11, "rows": 6}, {"what": "warehouse", "n": 7, "where": "near containerYard"}, {"what": "road", "from": "quay", "to": "edge:north", "name": "road"},
  {"what": "rail", "from": "edge:west", "to": "edge:east"}, {"what": "train", "where": "rail", "wagon": "container", "n": 9}, {"what": "truck", "n": 14, "where": "road"}, {"what": "tug", "n": 2, "where": "water near quay"},
  {"what": "people", "n": 3, "where": "quay"}], light="afternoon")
setp("tanker_lane", {"kind": "sea", "seed": 41, "size": 300, "islets": 2}, [
  {"what": "tanker", "n": 4, "where": "lane", "formation": "queue", "focus": True, "focusIndex": 1, "name": "tankers"}, {"what": "containerShip", "n": 2, "where": "lane"}, {"what": "buoy", "n": 6, "where": "lane"}], light="noon")
setp("chip_port", {"kind": "coast", "seed": 57, "relief": 0.25, "size": 270, "shore": "south"}, [
  {"what": "factory", "n": 3, "where": "land near shore", "name": "fabs"}, {"what": "quay", "len": 80, "name": "quay"}, {"what": "containerShip", "where": "quay", "focus": True, "name": "ship"},
  {"what": "gantryCrane", "n": 3, "where": "quay"}, {"what": "containerYard", "where": "behind quay", "cols": 7, "rows": 4}, {"what": "midrise", "n": 20, "where": "inland"},
  {"what": "road", "from": "quay", "to": "edge:north", "name": "road"}, {"what": "truck", "n": 8, "where": "road"}])
setp("palm_plantation", {"kind": "hills", "seed": 19, "relief": 0.22, "size": 280, "shore": "south", "landFrac": 0.72}, [
  {"what": "jetty", "len": 30, "name": "jetty"}, {"what": "factory", "where": "near jetty", "name": "mill", "focus": True}, {"what": "silo", "n": 3, "where": "near mill"},
  {"what": "plantation", "rows": 15, "cols": 20, "where": "inland"}, {"what": "plantation", "rows": 13, "cols": 18, "where": "inland"}, {"what": "plantation", "rows": 10, "cols": 14, "where": "near mill"},
  {"what": "fishingBoat", "where": "jetty"}, {"what": "road", "from": "jetty", "to": "edge:north", "name": "road"}, {"what": "truck", "n": 8, "where": "road", "type": "flat"}, TOWN(20, "near mill")])
setp("bulk_terminal", {"kind": "coast", "seed": 61, "relief": 0.2, "size": 270, "shore": "south"}, [
  {"what": "quay", "len": 110, "name": "quay"}, {"what": "bulkCarrier", "where": "quay", "focus": True, "name": "bulker"}, {"what": "spoil", "n": 8, "where": "behind quay"}, {"what": "conveyor", "where": "near quay"},
  {"what": "car", "n": 40, "where": "behind quay"}, {"what": "gantryCrane", "n": 2, "where": "quay"}, {"what": "warehouse", "n": 5, "where": "inland"}, {"what": "rail", "from": "edge:west", "to": "edge:east"},
  {"what": "train", "where": "rail", "wagon": "hopper", "n": 10}], light="noon")
setp("navy_at_sea", {"kind": "sea", "seed": 71, "size": 300}, [
  {"what": "warship", "n": 4, "where": "lane", "formation": "queue", "focus": True, "focusIndex": 0, "name": "warships"}, {"what": "carrier", "where": "lane", "len": 22}, {"what": "tanker", "n": 2, "where": "lane"}], light="overcast")
setp("distant_base", {"kind": "coast", "seed": 77, "relief": 0.4, "size": 270, "shore": "east"}, [
  {"what": "pier", "len": 44, "width": 7, "name": "pier"}, {"what": "warship", "n": 5, "where": "pier", "focus": True, "focusIndex": 2, "name": "warships"}, {"what": "breakwater", "len": 70},
  {"what": "warehouse", "n": 6, "where": "near pier"}, {"what": "radarMast", "n": 2, "where": "shore"}, {"what": "mountain", "n": 2, "where": "inland edge", "snow": False, "radius": 24, "h": 16}, TOWN(20)], light="dawn")
setp("changi", {"kind": "coast", "seed": 21, "relief": 0.2, "size": 280, "shore": "east"}, [
  {"what": "pier", "len": 44, "width": 7, "name": "pier1"}, {"what": "pier", "len": 40, "width": 7, "name": "pier2"}, {"what": "carrier", "where": "pier1", "len": 24, "name": "carrier"},
  {"what": "warship", "n": 3, "where": "pier2"}, {"what": "warehouse", "n": 8, "where": "near pier1", "name": "logistics", "focus": True, "focusIndex": 2}, {"what": "tug", "n": 3, "where": "near pier1"},
  {"what": "radarMast", "n": 2, "where": "shore"}, {"what": "road", "from": "edge:west", "to": "pier1"}, {"what": "truck", "n": 6, "where": "road"}, TOWN(25)], light="overcast")
setp("andaman_island", {"kind": "island", "seed": 6, "relief": 0.5, "size": 260, "radius": 70, "islets": 3}, [
  {"what": "radarMast", "where": "summit", "focus": True, "name": "radar"}, {"what": "lighthouse", "where": "shore"}, {"what": "jetty", "len": 26, "name": "jetty"}, {"what": "warship", "n": 2, "where": "jetty"},
  {"what": "helipad", "where": "near jetty"}, {"what": "trees", "n": 90, "where": "hills"}, {"what": "hut", "n": 6, "where": "near jetty"}, {"what": "skiff", "n": 3, "where": "anchorage"}], light="evening")
setp("blockade", {"kind": "strait", "seed": 83, "relief": 0.3, "size": 280, "width": 70}, [
  {"what": "warship", "n": 4, "where": "lane", "formation": "queue", "focus": True, "focusIndex": 1, "name": "line"}, {"what": "tanker", "n": 5, "where": "lane queue", "formation": "queue", "lane": 1},
  {"what": "city", "n": 40, "where": "shore"}, {"what": "radarMast", "n": 2, "where": "shore"}], light="overcast", autoLand=False)
setp("skiff_dusk", {"kind": "sea", "seed": 89, "size": 280, "islets": 3}, [
  {"what": "tanker", "where": "lane", "focus": True, "name": "tanker"}, {"what": "skiff", "n": 3, "where": "near tanker", "name": "skiffs"}, {"what": "fishingBoat", "n": 4, "where": "anchorage"}], light="evening")
setp("joint_patrol", {"kind": "coast", "seed": 97, "relief": 0.35, "size": 270, "shore": "south"}, [
  {"what": "warship", "n": 3, "where": "offshore", "focus": True, "focusIndex": 0, "name": "patrol"}, {"what": "jetty", "len": 30}, {"what": "fishingBoat", "n": 6, "where": "shore"},
  {"what": "lighthouse", "where": "shore"}, TOWN(30, "shore"), {"what": "trees", "n": 70, "where": "inland"}])
setp("suez", {"kind": "canal", "seed": 3, "relief": 0.35, "size": 300, "width": 16}, [
  {"what": "containerShip", "where": "canal lane", "len": 18, "heading": 32, "focus": True, "name": "stuck", "moving": False}, {"what": "containerShip", "n": 5, "where": "canal lane", "formation": "queue", "name": "queue", "moving": False},
  {"what": "tug", "n": 3, "where": "canal lane"}, {"what": "excavator", "n": 2, "where": "near canal"}, {"what": "hut", "n": 6, "where": "inland"}], light="noon", ambient=(), autoLand=False)
setp("kyaukphyu", {"kind": "coast", "seed": 8, "relief": 0.3, "size": 260, "shore": "south"}, [
  {"what": "jetty", "len": 54, "name": "jetty"}, {"what": "tanker", "where": "jetty", "len": 17, "name": "tanker"}, {"what": "tankFarm", "n": 9, "where": "land near shore", "name": "tanks", "focus": True},
  {"what": "pumpStation", "where": "near tanks"}, {"what": "pipeline", "from": "tanks", "to": "jetty", "pipes": 3}, {"what": "trees", "n": 80, "where": "inland"}, {"what": "tug", "n": 2, "where": "near jetty"},
  {"what": "people", "n": 3, "where": "jetty"}])
setp("pipeline_hills", {"kind": "hills", "seed": 11, "relief": 0.75, "size": 280, "shore": "south", "landFrac": 0.8}, [
  {"what": "pumpStation", "where": "shore", "name": "stationA"}, {"what": "pumpStation", "where": "inland hills", "name": "stationB"},
  {"what": "pipeline", "from": "stationA", "to": "stationB", "over": "hills", "pipes": 2, "focus": True, "name": "pipeline"}, {"what": "road", "from": "stationA", "to": "stationB", "name": "road"},
  {"what": "truck", "n": 4, "where": "road"}, {"what": "trees", "n": 90, "where": "hills"}, {"what": "hut", "n": 5, "where": "near stationA"}], light="evening")
setp("gwadar", {"kind": "desert", "seed": 14, "relief": 0.35, "size": 260, "shore": "north"}, [
  {"what": "quay", "len": 54, "name": "quay"}, {"what": "containerShip", "where": "quay", "len": 11}, {"what": "gantryCrane", "n": 3, "where": "quay", "name": "cranes", "focus": True, "focusIndex": 1},
  {"what": "containerYard", "where": "behind quay", "cols": 6, "rows": 3}, {"what": "road", "from": "quay", "to": "edge:south", "name": "road"}, {"what": "truck", "n": 3, "where": "road"},
  {"what": "mountain", "n": 3, "where": "inland edge", "snow": False, "radius": 20, "h": 14}, {"what": "fishingBoat", "n": 3, "where": "shore"}, TOWN(14)], light="noon")
setp("kra_isthmus", {"kind": "river", "seed": 101, "relief": 0.5, "size": 270, "width": 12, "angle": 20}, [
  {"what": "radarMast", "where": "hills", "name": "survey", "focus": True}, {"what": "plantation", "rows": 10, "cols": 16, "where": "inland"}, TOWN(26, "shore"),
  {"what": "road", "from": "edge:west", "to": "edge:east", "bridge": True}, {"what": "truck", "n": 4, "where": "road"}, {"what": "fishingBoat", "n": 3, "where": "shore"}, {"what": "trees", "n": 110, "where": "hills"}])
setp("ice_convoy", {"kind": "ice", "seed": 7, "size": 300, "laneW": 24, "plate": 30, "meander": 16}, [
  {"what": "icebreaker", "where": "lane", "focus": True, "len": 13, "start": 0.5, "formation": "convoy", "speed": 0.15, "name": "icebreaker"},
  {"what": "tanker", "where": "lane", "formation": "convoy", "start": 0.36, "len": 12, "speed": 0.5, "name": "convoy"},
  {"what": "containerShip", "where": "lane", "formation": "convoy", "start": 0.24, "len": 10, "speed": 0.5},
  {"what": "bulkCarrier", "where": "lane", "formation": "convoy", "start": 0.13, "len": 11, "speed": 0.5}, {"what": "floes", "n": 70, "maxR": 3.4, "laneW": 8}, {"what": "iceberg", "n": 6, "where": "water", "r": 2.2}], light="dawn")
setp("myanmar_checkpoint", {"kind": "hills", "seed": 113, "relief": 0.6, "size": 260, "shore": False}, [
  {"what": "road", "from": "edge:west", "to": "edge:east", "name": "road"}, {"what": "checkpoint", "where": "road", "t": 0.4, "focus": True, "name": "checkpoint"},
  {"what": "pipeline", "from": "edge:west", "to": "edge:east", "over": "hills", "pipes": 2, "name": "pipeline"}, {"what": "watchtower", "n": 3, "where": "near checkpoint"},
  {"what": "truck", "n": 6, "where": "road", "formation": "queue", "start": 0.1, "moving": False}, {"what": "trees", "n": 120, "where": "hills"}, {"what": "hut", "n": 6, "where": "near checkpoint"}], light="overcast")
setp("ocean_crossing", {"kind": "sea", "seed": 127, "size": 300}, [
  {"what": "tanker", "where": "lane", "focus": True, "name": "tanker"}, {"what": "warship", "n": 2, "where": "lane", "name": "navy"}, {"what": "buoy", "n": 2, "where": "lane"}], light="afternoon")
setp("strait_blocked", {"kind": "strait", "seed": 131, "relief": 0.3, "size": 300, "width": 52}, [
  {"what": "tanker", "where": "lane", "heading": 70, "len": 18, "focus": True, "name": "stuck", "moving": False}, {"what": "tanker", "n": 7, "where": "lane queue", "formation": "queue", "name": "queue", "moving": False},
  {"what": "tug", "n": 3, "where": "lane"}, {"what": "city", "n": 60, "where": "shore"}, TOWN(30, "shore")], light="overcast", autoLand=False)

setp("china_refinery", {"kind": "plain", "seed": 9, "relief": 0.2, "size": 260, "shore": "south", "landFrac": 0.78}, [
  {"what": "refinery", "n": 1, "radius": 20, "where": "center", "focus": True, "name": "refinery"}, {"what": "refinery", "radius": 14, "where": "near refinery", "gap": 14}, {"what": "tankFarm", "n": 12, "where": "near refinery"},
  {"what": "flareStack", "n": 2, "where": "near refinery"}, {"what": "jetty", "len": 40}, {"what": "tanker", "where": "jetty", "len": 16}, {"what": "rail", "from": "edge:west", "to": "edge:east"}, {"what": "train", "where": "rail", "wagon": "tank", "n": 10},
  {"what": "road", "from": "edge:north", "to": "refinery", "name": "road"}, {"what": "truck", "n": 7, "where": "road", "type": "tank"}], light="morning")
setp("far_town", {"kind": "plain", "seed": 141, "relief": 0.3, "size": 260, "shore": False}, [
  {"what": "town", "n": 60, "where": "center", "name": "town"}, {"what": "road", "from": "edge:west", "to": "edge:east", "name": "road"}, {"what": "car", "n": 18, "where": "road", "focus": True, "focusIndex": 4},
  {"what": "truck", "n": 6, "where": "road", "type": "tank"}, {"what": "trees", "n": 80, "where": "edge"}, {"what": "silo", "n": 2, "where": "edge"}], light="afternoon")

# ---------------- MG beats (kinds + data; nothing prebuilt) ----------------
MG = [
 ("gap", [("distanceRuler", {"a": {"n": "Singapore", "ll": [103.83, 1.22], "what": "building"}, "b": {"n": "Indonesian islands", "ll": [103.83, 1.195], "what": "lighthouse"}, "km": 2.8, "cap": "Phillip Channel, Singapore Strait", "note": "narrowest point (approx.)"})]),
 ("ships", [("odometer", {"value": 100000, "unit": "ships", "per": "a year", "object": "tanker", "cap": "Through the strait", "note": "about one every 5 minutes"})]),
 ("killswitch", [("valveSwitch", {"flow": {"label": "Oil via Malacca", "what": "tanker"}, "valve": {"label": "The strait"}, "stages": [{"label": "Refineries", "what": "refineryColumn"}, {"label": "Factories", "what": "factory"}, {"label": "Fuel pumps", "what": "fuelPump"}], "cap": "One valve", "closedNote": "if it closes"})]),
 ("history", [("timelineStrip", {"events": [{"year": 1511, "label": "Portuguese take Malacca", "what": "warship"}, {"year": 1641, "label": "Dutch take Malacca", "what": "warship"}, {"year": 1819, "label": "British found Singapore", "what": "building"}], "cap": "Who held the gap"})]),
 ("detour", [("splitAvsB", {"a": {"label": "Malacca", "object": "tanker"}, "b": {"label": "Lombok detour", "object": "tanker"}, "rows": [{"label": "Extra sailing", "a": "0 days", "b": "+3 to 5 days"}, {"label": "Shortest road", "a": True, "b": False}], "cap": "The other doors", "note": "analyst estimates"})]),
 ("ports", [("illustratedBars", {"items": [{"label": "Shanghai", "value": 51.5}, {"label": "Singapore", "value": 41.1}, {"label": "Ningbo-Zhoushan", "value": 39.3}], "object": "container", "each": 10, "unit": "million container units, 2024", "cap": "Busiest container ports", "redIndex": 1, "note": "second busiest"})]),
 ("oil", [("objectCounter", {"value": 23, "unit": "million barrels", "per": "a day (approx.)", "object": "barrel", "each": 1, "cap": "Oil through Malacca, 2023", "note": "most of any strait", "redIndex": 0}),
          ("sourceCard", {"value": "≈23.7 million", "unit": "barrels a day", "cap": "Where the number comes from", "source": {"pub": "US EIA", "title": "World Oil Transit Chokepoints", "year": "2024 update", "page": "2023 data"}})]),
 ("share", [("shareRing", {"slices": [{"label": "Malacca", "value": 21}, {"label": "Rest", "value": 79}], "object": "containerShip", "unit": "of sea trade", "cap": "World seaborne trade (CSIS, 2024)", "redIndex": 0, "note": "a fifth to a quarter"})]),
 ("phone", [("explodedView", {"object": "phone", "parts": [{"label": "Chip", "what": "chip"}, {"label": "Screen glass", "what": "documentPage"}, {"label": "Battery", "what": "barrel"}, {"label": "Case", "what": "container"}], "cap": "Inside one phone", "focusPart": 0})]),
 ("chinaimports", [("pictogramRow", {"rows": [{"label": "China's crude imports, 2024", "value": 11}], "object": "barrel", "each": 1, "unit": "million barrels a day (approx.)", "cap": "The world's biggest importer", "redRow": 0, "note": "biggest in the world"})]),
 ("viamalacca", [("rangeBand", {"min": 0, "max": 1, "ticks": [{"v": 0, "label": "0"}, {"v": 0.5, "label": "1/2"}, {"v": 0.6667, "label": "2/3"}, {"v": 0.8, "label": "4/5"}, {"v": 1, "label": "all"}],
   "sources": [{"label": "Chinese Academy of Sciences (2018)", "value": 0.6}, {"label": "EIA-based (CEPA)", "value": 0.69}, {"label": "Common press figure", "value": 0.8}],
   "consensus": {"from": 0.6667, "to": 0.8, "label": "2/3 to 4/5"}, "cap": "Share of China's oil imports via Malacca", "note": "depends who is counting"})]),
 ("dilemma", [("annotatedDoc", {"head": "The Malacca Dilemma", "ref": "late 2003 (reported)", "cap": "The worry gets a name", "body": [{"t": "Attributed to President Hu Jintao, speaking to party officials.", "hi": 1, "note": "no published transcript"}, {"t": "Concern: other powers could control the strait.", "hi": 2, "note": "the dilemma"}]})]),
 ("navies", [("illustratedBars", {"items": [{"label": "China's navy", "value": 370}, {"label": "US Navy", "value": 290}], "object": "warship", "each": 50, "unit": "ships (approx., US DoD 2023)", "cap": "Biggest navy by ship count", "redIndex": 0, "note": "by number of ships"})]),
 ("exits", [("timelineStrip", {"events": [{"year": 2013, "label": "Gas pipeline, Myanmar", "what": "pipe"}, {"year": 2015, "label": "Corridor, Pakistan", "what": "truck"}, {"year": 2017, "label": "Oil pipeline, Myanmar", "what": "barrel"}], "cap": "Buying exits"})]),
 ("deterrence", [("balanceScale", {"left": {"label": "A blockade", "what": "warship", "n": 2, "weight": 1}, "right": {"label": "Everyone's trade", "what": "containerShip", "n": 5, "weight": 3}, "cap": "Why nobody tries", "note": "it hurts everyone"})]),
 ("piracy", [("tallyBoard", {"items": [{"label": "Malacca & Singapore straits", "count": 62, "object": "skiff"}, {"label": "Rest of Asia", "count": 45, "object": "skiff"}], "unit": "incidents, 2024 (ReCAAP, approx.)", "cap": "Piracy and armed robbery", "redIndex": 0, "note": "mostly petty theft"})]),
 ("accident", [("branchTree", {"root": {"label": "Accident", "what": "warningSign", "kids": [{"label": "Collision", "what": "containerShip"}, {"label": "Grounding", "what": "rock"}, {"label": "Fire", "what": "gasFlare", "red": True}]}, "cap": "Option three", "note": "any one blocks the lane"})]),
 ("suezcost", [("pictogramRow", {"rows": [{"label": "Ships stuck behind the Ever Given", "value": 369}], "object": "containerShip", "each": 25, "unit": "ships (approx.)", "cap": "Suez, March 2021", "redRow": 0, "note": "six days"}),
               ("objectCounter", {"value": 9.6, "unit": "billion dollars of trade", "per": "held up each day", "object": "banknoteBundle", "each": 1, "cap": "One estimate", "note": "per day", "redIndex": 0})]),
 ("pipes", [("splitAvsB", {"a": {"label": "Oil line", "object": "barrel"}, "b": {"label": "Gas line", "object": "gasFlare"}, "rows": [{"label": "Design capacity", "a": "≈22 Mt / year", "b": "≈12 bcm / year"}, {"label": "Per day", "a": "≈440,000 bbl", "b": "-"}], "cap": "Myanmar-China pipelines", "note": "design figures"})]),
 ("karakoram", [("elevationProfile", {"route": "Karakoram Highway", "cap": "Gwadar's corridor north (approx.)", "unit": "m", "vehicle": "truck", "points": [{"km": 0, "alt": 540, "n": "Islamabad"}, {"km": 600, "alt": 1500, "n": "Gilgit"}, {"km": 870, "alt": 4693, "n": "Khunjerab Pass"}, {"km": 995, "alt": 3100, "n": "Tashkurgan"}, {"km": 1290, "alt": 1290, "n": "Kashgar"}]})]),
 ("kracanal", [("distanceRuler", {"a": {"n": "Andaman Sea", "ll": [98.6, 8.5], "what": "fishingBoat"}, "b": {"n": "Gulf of Thailand", "ll": [99.9, 8.3], "what": "fishingBoat"}, "km": 100, "cap": "Kra canal (proposed)", "note": "about 100 km of digging"})]),
 ("pipeshare", [("gauge", {"value": 4, "min": 0, "max": 100, "unit": "% of imports", "label": "Myanmar oil pipe, full", "zones": [{"to": 25, "label": "Pipe"}, {"to": 100, "label": "By sea"}], "cap": "What the pipe can cover (approx.)", "note": "2019: about half that", "object": "barrel"})]),
 ("gwadarport", [("sizeCircles", {"items": [{"label": "Singapore", "value": 41.1, "object": "crane"}, {"label": "Gwadar", "value": 0.0083, "object": "crane"}], "unit": "million container units a year (approx.)", "cap": "Port traffic", "redIndex": 1, "note": "a tiny fraction"})]),
 ("krastatus", [("stampedPermit", {"title": "Kra Canal", "no": "proposal", "cap": "Still a drawing", "stamp": "NOT BUILT", "sign": "pending", "fields": [{"k": "Length", "v": "≈100-120 km"}, {"k": "Status", "v": "studied, shelved"}, {"k": "Instead", "v": "a land bridge"}, {"k": "Land bridge", "v": "≈$28 bn"}], "checks": ["Funding", "Politics"]})]),
 ("arcticvsmalacca", [("balanceScale", {"left": {"label": "Arctic transit, all 2024 (≈3 Mt)", "what": "icebreaker", "n": 3, "weight": 3}, "right": {"label": "Malacca oil, one day (≈3.2 Mt)", "what": "tanker", "n": 3, "weight": 3.2}, "cap": "A record year vs one day", "note": "about the same (approx.)"})]),
 ("moretankers", [("conveyor", {"input": "barrel", "stations": [{"label": "Longer route", "what": "tanker", "out": "barrel"}, {"label": "More days at sea", "what": "clockFace", "out": "barrel"}, {"label": "More tankers tied up", "what": "tanker", "out": "coinStack"}], "cap": "Same oil, more ships", "unit": "", "red": 2})]),
 ("ripples", [("dominoes", {"chain": [{"label": "Steering fails", "what": "tanker"}, {"label": "Queue builds", "what": "containerShip"}, {"label": "Detours", "what": "clockFace"}, {"label": "Insurance, freight up", "what": "documentPage"}, {"label": "Factories wait", "what": "factory"}, {"label": "Fuel prices rise", "what": "fuelPump"}], "cap": "The day it closes", "redIndex": 0, "note": "hypothetical"})]),
 ("neighbours", [("branchTree", {"root": {"label": "Malacca", "what": "tanker", "kids": [{"label": "China", "what": "refineryColumn"}, {"label": "Japan", "what": "city", "red": True}, {"label": "South Korea", "what": "factory"}, {"label": "Taiwan", "what": "chip"}]}, "cap": "Who gets oil this way", "note": "most of their imports"})]),
 ("stock", [("objectCounter", {"value": 1.2, "unit": "billion barrels", "per": "in storage (approx.)", "object": "oilTank", "each": 0.1, "cap": "China's oil stockpile", "note": "analyst estimate", "redIndex": 0})]),
 ("stockpile", [("calendarCountdown", {"days": 100, "startDay": 1, "month": "STOCK", "label": "days of imports (approx.)", "what": "oilTank", "cap": "How long it lasts"})]),
]
mg = [{"id": b, "parts": [{"kind": k, "data": d} for k, d in parts]} for b, parts in MG]

# ---------------- map (plan data) ----------------
MAP = {"bounds": [30, 182, -16, 80], "center": [95, 25], "k": 0.42, "highlight": ["CHN"],
  "routes": {"main": {"pts": [[50.2, 26.6], [56.4, 26.4], [59.5, 23.5], [63, 18], [70, 11], [78, 6.5], [84, 6], [91, 6.3], [95.5, 6.2], [98.2, 4.6], [100.6, 2.7], [103.6, 1.2], [105.4, 2.4], [107.6, 6], [110.5, 11.5], [113.8, 17], [117.6, 21.8], [120.6, 25.6], [122.2, 30.2]]},
    "lombok": {"pts": [[84, 6], [92, 0], [100, -7], [108, -10.2], [115.8, -8.9], [117.6, -5], [118.4, 0], [119.6, 6], [120.6, 13], [121, 20], [121.6, 25.6], [122.2, 30.2]]},
    "myanmar": {"pts": [[84, 6], [88, 12], [91.5, 17.5], [93.6, 19.4], [95.5, 21.2], [97.6, 22.6], [100.2, 24.2], [102.7, 25.0]]},
    "gwadar": {"pts": [[62.3, 25.1], [64.5, 27.5], [67.2, 30.2], [70.6, 32.6], [73.2, 34.6], [75.4, 36.8], [76.0, 39.4]], "land": True},
    "kra": {"pts": [[91, 6.3], [95.6, 8.0], [98.4, 8.7], [99.4, 8.9], [100.4, 8.6], [103, 9.3], [107.6, 11.5], [110.5, 14], [113.8, 18], [117.6, 22], [120.6, 25.6], [122.2, 30.2]]},
    "arctic": {"pts": [[122.2, 30.2], [127.5, 33.6], [133, 37.5], [140, 43], [145, 49], [156, 51.5], [164, 58], [172, 63], [179, 66], [178, 70.5], [165, 72.2], [150, 74.6], [135, 75.6], [118, 77.6], [100, 77.6], [82, 75.2], [70, 74.4], [55, 72.8], [42, 70.4], [33.5, 69.3]]}},
  "pins": {"malacca": [100.4, 3.0], "singapore": [103.8, 1.3], "gulf": [50.2, 26.6], "china": [122.2, 30.2]},
  "signs": [["gulf", "GULF", 50.2, 26.6, -1.6, -1.6], ["china", "CHINA", 122.2, 30.2, 1.8, -1.4], ["malacca", "MALACCA", 100.4, 3.0, -3.4, 0.9], ["singapore", "SINGAPORE", 103.8, 1.3, 2.6, 1.6],
    ["lombok", "LOMBOK", 115.8, -8.9, 0, 1.9], ["myanmar", "KYAUKPHYU", 93.6, 19.4, -3.8, 0.8], ["myanmar2", "KUNMING", 102.7, 25.0, 2.6, -1.0], ["gwadar", "GWADAR", 62.3, 25.1, -1.4, 1.8],
    ["gwadar2", "KASHGAR", 76.0, 39.4, 0, -1.8], ["kra", "KRA", 99.4, 8.9, -2.4, -0.4], ["arctic", "NORTHERN SEA ROUTE", 110, 77.6, 0, 1.9]],
  "introWith": {"gulf": "route:main", "china": "route:main"}}

# ---------------- a visual for every voiced line ----------------
st = lambda s, subject="focus", **kw: {"set": s, "subject": subject, **kw}
mgv = lambda b, f=0: {"mg": b, "focus": f}
mp = lambda s="map": {"map": True, "subject": s}
LV = {1: st("strait_queue", "queue"), 2: st("strait_queue", callout="≈2 million barrels"), 3: mgv("gap"), 4: mgv("ships"), 5: st("anchorage", "anchored"), 6: st("beijing", "focus"), 7: mgv("killswitch"),
  8: st("strait_queue", framing="threeQuarter"), 9: mp(), 10: mp("route:main"), 11: mp("pin:malacca"), 12: mp("pin:singapore"), 13: mgv("history"), 14: mp("route:lombok"), 15: mgv("detour"),
  16: st("singapore_waterfront", "set"), 17: st("container_port"), 18: mgv("ports"), 19: st("tanker_lane"), 20: mgv("oil", 0), 21: mgv("oil", "sourceCard1:number"), 22: mgv("share"),
  23: st("chip_port", callout="Chips, heading west"), 24: st("palm_plantation", callout="Palm oil"), 25: st("bulk_terminal", callout="Ore, cars, everything"), 26: mgv("phone"), 27: mgv("chinaimports"), 28: st("china_refinery", callout="World's biggest crude importer"),
  29: mgv("viamalacca"), 30: st("phillip_morning", "set"), 31: mgv("dilemma", 0), 32: mgv("dilemma", 1), 33: st("phillip_dusk", "set"), 34: st("navy_at_sea"), 35: mgv("navies"), 36: st("distant_base", "warships"),
  37: st("changi", callout="US Navy logistics, since 1992"), 38: st("changi", "carrier", callout="Carrier pier"), 39: st("andaman_island", callout="Andaman & Nicobar Command"), 40: st("anchorage"),
  41: mgv("exits", 0), 42: mgv("exits", 1), 43: mgv("exits", 2), 44: st("suez", framing="orbitBack"), 45: st("ice_convoy", "set"), 46: st("phillip_morning", "set"),
  47: st("blockade", callout="Blockade (hypothetical)"), 48: mgv("deterrence"), 49: mgv("piracy"), 50: st("skiff_dusk", "tanker", callout="Petty theft"), 51: st("joint_patrol", callout="Joint patrols since 2004"),
  52: mgv("accident"), 53: st("suez", callout="Ever Given, 2021"), 54: mgv("suezcost", 0), 55: mgv("suezcost", "objectCounter1:count"), 56: st("phillip_dusk", "set"),
  57: mp(), 58: mp("route:myanmar"), 59: st("kyaukphyu", callout="Kyaukphyu terminal"), 60: st("pipeline_hills", callout="Twin pipelines to Yunnan"), 61: mgv("pipes", 0), 62: st("pipeline_hills", "pipeline", callout="Gas: ≈12 bcm / year", framing="lateralLow"),
  63: mp("route:gwadar"), 64: st("gwadar", callout="CPEC, ≈$62 bn headline"), 65: mp("route:gwadar"), 66: mgv("karakoram"), 67: mgv("kracanal"), 68: mp("route:kra"), 69: st("kra_isthmus", callout="Kra Isthmus"),
  70: mp("route:arctic"), 71: st("ice_convoy", "set", callout="2024: ≈3 Mt transit cargo"), 72: st("ice_convoy", callout="Russian icebreaker"), 73: mp(), 74: mgv("pipeshare"),
  75: st("myanmar_checkpoint", callout="Civil war since 2021"), 76: st("ocean_crossing", callout="Still by sea"), 77: mgv("gwadarport"), 78: mgv("krastatus"), 79: mgv("arcticvsmalacca"),
  80: st("phillip_morning", "set"), 81: st("strait_blocked", callout="What if: steering fails"), 82: st("strait_blocked", "queue"), 83: mp("route:lombok"), 84: st("tanker_lane", "tankers", callout="More days, more tankers"),
  85: mgv("ripples", 0), 86: mgv("ripples", 1), 87: st("far_town", "town", callout="Fuel prices"), 88: mgv("neighbours", 0), 89: mp(), 90: mgv("stock", 0), 91: mgv("stockpile", 0),
  92: st("strait_queue", framing="lateralLow"), 93: st("phillip_dusk", "set"), 94: st("phillip_morning", "set")}
plan = {"film": "malacca", "seed": 11, "sets": list(S.values()), "mg": mg, "map": MAP, "lines": {str(k): v for k, v in LV.items()}}
(F / "plan.json").write_text(json.dumps(plan, indent=1, ensure_ascii=False), encoding="utf8")
print("sets", len(S), "mg beats", len(mg), "lines", len(LV))
