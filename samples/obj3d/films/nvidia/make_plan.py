# Producer step for the Nvidia film (miniature v2): writes plan.json = places (composer specs), MG beats (kinds + data), map spec,
# and a visual for every voiced line. Every number shown comes from the sourced script header (script.md); allegations are labelled.
# Run: python make_plan.py
import json, pathlib
F = pathlib.Path(__file__).parent
S = {}
DENS = {"trees": 1.6, "city": 1.35, "town": 1.4, "car": 1.3}   # fuller places: more scenery around every subject (no quotas: scaled from each spec)
def setp(id, ground, place, light="morning", ambient=("birds",), **kw):
  place = [dict(e, n=max(1, round(e["n"] * DENS[e["what"]]))) if e["what"] in DENS and "n" in e and not e.get("focus") else e for e in place]
  S[id] = {"id": id, "ground": ground, "place": place, "light": {"time": light}, "ambient": list(ambient), **kw}
TOWN = lambda n, w="edge": {"what": "town", "n": n, "where": w}
CITY = lambda n, w="edge", **k: {"what": "city", "n": n, "where": w, **k}
ROAD = lambda a="edge:west", b="edge:east", name=None: {"what": "road", "from": a, "to": b, **({"name": name} if name else {})}
TREES = lambda n, w="edge": {"what": "trees", "n": n, "where": w}

# ---------------- places (all generated at runtime from these specs) ----------------
# Santa Clara headquarters, many states of the same week (different layouts, seeds, light, companions)
setp("hq_night", {"kind": "hills", "seed": 201, "relief": 0.18, "size": 260, "shore": False}, [
  {"what": "campus", "where": "center", "focus": True, "name": "hq"}, ROAD("edge:west", "hq", "road"), {"what": "car", "n": 10, "where": "road"},
  {"what": "midrise", "n": 14, "where": "edge"}, TREES(90), {"what": "people", "n": 3, "where": "near hq"}, CITY(60)], light="evening")
setp("hq_exit", {"kind": "plain", "seed": 207, "relief": 0.15, "size": 250, "shore": False}, [
  {"what": "campus", "where": "center", "name": "hq"}, ROAD("hq", "edge:south", "drive"), {"what": "car", "n": 1, "where": "drive", "focus": True, "name": "leaving", "t": 0.55},
  {"what": "car", "n": 14, "where": "near hq"}, {"what": "people", "n": 4, "where": "near hq"}, TREES(70), TOWN(30)], light="evening")
setp("hq_day", {"kind": "hills", "seed": 213, "relief": 0.25, "size": 270, "shore": False}, [
  {"what": "campus", "where": "center", "focus": True, "name": "hq"}, {"what": "campus", "where": "near hq", "size": 16}, {"what": "solarArray", "where": "near hq", "rows": 5, "cols": 10},
  ROAD(), {"what": "car", "n": 16, "where": "road"}, {"what": "bus", "n": 2, "where": "road"}, TREES(110), {"what": "midrise", "n": 12, "where": "edge"}], light="noon")
setp("hq_sunday", {"kind": "plain", "seed": 219, "relief": 0.12, "size": 240, "shore": False}, [
  {"what": "campus", "where": "center", "focus": True, "name": "hq"}, ROAD("edge:north", "hq"), {"what": "car", "n": 2, "where": "near hq"}, TREES(80), TOWN(24), CITY(60)], light="overcast")
setp("hq_board", {"kind": "city", "seed": 223, "relief": 0.1, "size": 240, "shore": False}, [
  {"what": "tower", "where": "center", "floors": 14, "focus": True, "name": "office"}, {"what": "campus", "where": "near office", "size": 15}, {"what": "midrise", "n": 22, "where": "edge"},
  ROAD(), {"what": "car", "n": 12, "where": "road"}, {"what": "people", "n": 3, "where": "near office"}, TREES(50)], light="afternoon")
setp("hq_wed", {"kind": "hills", "seed": 229, "relief": 0.2, "size": 250, "shore": False}, [
  {"what": "campus", "where": "center", "focus": True, "name": "hq"}, {"what": "datacenter", "where": "near hq"}, ROAD("edge:east", "hq"), {"what": "car", "n": 8, "where": "near hq"},
  {"what": "people", "n": 5, "where": "near hq"}, TREES(90), CITY(60)], light="evening")
setp("hq_morning", {"kind": "plain", "seed": 233, "relief": 0.14, "size": 250, "shore": False}, [
  {"what": "campus", "where": "center", "focus": True, "name": "hq"}, ROAD("edge:west", "edge:east", "road"), {"what": "bus", "n": 3, "where": "road"}, {"what": "car", "n": 12, "where": "road"},
  {"what": "people", "n": 6, "where": "near hq"}, {"what": "helipad", "where": "near hq"}, TREES(70), {"what": "midrise", "n": 10, "where": "edge"}], light="morning")
setp("hq_kress", {"kind": "city", "seed": 239, "relief": 0.1, "size": 240, "shore": False}, [
  {"what": "campus", "where": "center", "name": "hq"}, {"what": "people", "n": 3, "where": "near hq", "focus": True, "name": "team"}, {"what": "tower", "n": 6, "where": "edge"},
  ROAD(), {"what": "car", "n": 10, "where": "road"}, TREES(60)], light="afternoon")
setp("hq_chair", {"kind": "hills", "seed": 241, "relief": 0.22, "size": 250, "shore": False}, [
  {"what": "midrise", "where": "center", "floors": 6, "focus": True, "name": "boardroom"}, {"what": "campus", "where": "near boardroom", "size": 17}, TREES(100), ROAD(), {"what": "car", "n": 7, "where": "road"}, CITY(60)], light="morning")
setp("hq_board2", {"kind": "plain", "seed": 251, "relief": 0.12, "size": 240, "shore": False}, [
  {"what": "campus", "where": "center", "focus": True, "name": "hq"}, {"what": "datacenter", "n": 2, "where": "edge"}, {"what": "solarArray", "where": "edge"}, TREES(60), ROAD(), CITY(60)], light="overcast")
setp("hq_end", {"kind": "hills", "seed": 257, "relief": 0.2, "size": 260, "shore": False}, [
  {"what": "campus", "where": "center", "focus": True, "name": "hq"}, ROAD("edge:south", "hq"), {"what": "car", "n": 4, "where": "near hq"}, TREES(110), {"what": "midrise", "n": 16, "where": "edge"}, CITY(60)], light="evening")
setp("hq_last", {"kind": "plain", "seed": 263, "relief": 0.15, "size": 260, "shore": False}, [
  {"what": "campus", "where": "center", "focus": True, "name": "hq"}, {"what": "campus", "where": "edge", "size": 15}, ROAD(), {"what": "car", "n": 8, "where": "road"}, TREES(90), TOWN(30), CITY(60)], light="dawn")
# data centres (the AI boom)
setp("dc_dusk", {"kind": "plain", "seed": 271, "relief": 0.1, "size": 270, "shore": False}, [
  {"what": "datacenter", "n": 4, "where": "center", "focus": True, "focusIndex": 1, "name": "halls"}, {"what": "solarArray", "n": 2, "where": "edge"}, {"what": "windTurbine", "n": 5, "where": "edge"},
  ROAD(), {"what": "truck", "n": 5, "where": "road"}, CITY(60)], light="evening")
setp("dc_rows", {"kind": "plain", "seed": 277, "relief": 0.08, "size": 260, "shore": False}, [
  {"what": "datacenter", "n": 6, "where": "center", "focus": True, "focusIndex": 2, "name": "halls"}, ROAD(), {"what": "truck", "n": 4, "where": "road"}, CITY(60)], light="noon")
setp("dc_build", {"kind": "plain", "seed": 281, "relief": 0.15, "size": 260, "shore": False}, [
  {"what": "datacenter", "n": 3, "where": "center", "name": "halls"}, {"what": "excavator", "n": 3, "where": "near halls", "focus": True, "focusIndex": 0, "name": "diggers"}, {"what": "crates", "n": 6, "where": "near halls"},
  {"what": "truck", "n": 8, "where": "road"}, ROAD(), {"what": "spoil", "n": 4, "where": "near halls"}, CITY(60)], light="afternoon")
setp("dc_hum", {"kind": "hills", "seed": 283, "relief": 0.2, "size": 270, "shore": False}, [
  {"what": "datacenter", "n": 5, "where": "center", "focus": True, "focusIndex": 0, "name": "halls"}, {"what": "windTurbine", "n": 7, "where": "hills"}, ROAD(), {"what": "truck", "n": 3, "where": "road"}, TREES(60)], light="evening")
# origins
setp("diner", {"kind": "plain", "seed": 307, "relief": 0.1, "size": 230, "shore": False}, [
  {"what": "house", "where": "center", "roof": "flat", "focus": True, "name": "diner"}, ROAD("edge:west", "edge:east", "road"), {"what": "car", "n": 9, "where": "near diner"},
  {"what": "people", "n": 3, "where": "near diner"}, TOWN(50), TREES(40), CITY(60)], light="afternoon")
setp("research_park", {"kind": "hills", "seed": 311, "relief": 0.3, "size": 250, "shore": False}, [
  {"what": "midrise", "n": 3, "where": "center", "focus": True, "focusIndex": 0, "name": "labs"}, {"what": "people", "n": 4, "where": "near labs"}, {"what": "house", "n": 10, "where": "edge"}, TREES(100), ROAD(), CITY(60)], light="morning")
# Washington and Beijing
setp("washington", {"kind": "city", "seed": 317, "relief": 0.08, "size": 270, "shore": False}, [
  {"what": "govHall", "where": "center", "w": 13, "focus": True, "name": "capitol"}, CITY(120), ROAD(), {"what": "car", "n": 14, "where": "road"}, TREES(70, "near capitol")], light="morning")
setp("commerce", {"kind": "city", "seed": 331, "relief": 0.08, "size": 250, "shore": False}, [
  {"what": "govHall", "where": "center", "w": 10, "focus": True, "name": "agency"}, {"what": "midrise", "n": 20, "where": "edge"}, ROAD(), {"what": "car", "n": 10, "where": "road"}, {"what": "people", "n": 3, "where": "near agency"}], light="afternoon")
setp("doj_us", {"kind": "city", "seed": 337, "relief": 0.08, "size": 250, "shore": False}, [
  {"what": "govHall", "where": "center", "w": 9, "focus": True, "name": "court"}, {"what": "tower", "n": 14, "where": "edge"}, ROAD(), {"what": "car", "n": 9, "where": "road"}, TREES(40)], light="overcast")
setp("white_house", {"kind": "plain", "seed": 347, "relief": 0.08, "size": 240, "shore": False}, [
  {"what": "govHall", "where": "center", "w": 8, "focus": True, "name": "residence"}, TREES(80, "near residence"), CITY(60), {"what": "helipad", "where": "near residence"}], light="noon")
setp("senate", {"kind": "city", "seed": 349, "relief": 0.08, "size": 250, "shore": False}, [
  {"what": "govHall", "where": "center", "w": 12, "focus": True, "name": "senate"}, {"what": "govHall", "where": "near senate", "w": 8}, CITY(80), ROAD(), {"what": "car", "n": 10, "where": "road"}], light="afternoon")
setp("house_hill", {"kind": "hills", "seed": 353, "relief": 0.15, "size": 250, "shore": False}, [
  {"what": "govHall", "where": "center", "w": 11, "focus": True, "name": "house"}, TREES(90), CITY(50), ROAD(), {"what": "car", "n": 8, "where": "road"}, {"what": "people", "n": 4, "where": "near house"}], light="evening")
setp("doj_dc", {"kind": "city", "seed": 359, "relief": 0.08, "size": 240, "shore": False}, [
  {"what": "govHall", "where": "center", "w": 10, "focus": True, "name": "justice"}, {"what": "midrise", "n": 18, "where": "edge"}, {"what": "people", "n": 3, "where": "near justice"}, ROAD(), {"what": "bus", "n": 2, "where": "road"}], light="morning")
setp("capitol_closed", {"kind": "plain", "seed": 367, "relief": 0.1, "size": 250, "shore": False}, [
  {"what": "govHall", "where": "center", "w": 12, "focus": True, "name": "capitol"}, {"what": "barrier", "n": 4, "where": "near capitol"}, {"what": "car", "n": 6, "where": "near capitol"}, CITY(70), TREES(50)], light="evening")
setp("beijing", {"kind": "city", "seed": 373, "relief": 0.1, "size": 260, "shore": False}, [
  {"what": "govHall", "where": "center", "w": 11, "focus": True, "name": "ministry"}, CITY(150), ROAD(), {"what": "car", "n": 14, "where": "road"}, TREES(60, "near ministry")], light="evening")
setp("courthouse", {"kind": "city", "seed": 379, "relief": 0.08, "size": 240, "shore": False}, [
  {"what": "govHall", "where": "center", "w": 9, "focus": True, "name": "court"}, {"what": "midrise", "n": 16, "where": "edge"}, {"what": "people", "n": 4, "where": "near court"}, TREES(40)], light="noon")
# New York
setp("law_firm", {"kind": "city", "seed": 389, "relief": 0.06, "size": 250, "shore": "east"}, [
  {"what": "tower", "where": "center", "floors": 22, "style": "step", "focus": True, "name": "firm"}, CITY(150), ROAD(), {"what": "car", "n": 14, "where": "road"}], light="afternoon")
setp("wall_street", {"kind": "city", "seed": 397, "relief": 0.06, "size": 250, "shore": "south"}, [
  {"what": "govHall", "where": "center", "w": 8, "focus": True, "name": "exchange"}, CITY(180), {"what": "people", "n": 5, "where": "near exchange"}, ROAD(), {"what": "car", "n": 10, "where": "road"}], light="morning")
setp("law_office", {"kind": "city", "seed": 401, "relief": 0.06, "size": 240, "shore": False}, [
  {"what": "tower", "where": "center", "floors": 18, "style": "cyl", "focus": True, "name": "office"}, CITY(130), ROAD(), {"what": "car", "n": 10, "where": "road"}], light="evening")
# Singapore, Malaysia, Taiwan
setp("sg_court", {"kind": "city", "seed": 409, "relief": 0.08, "size": 260, "shore": "south"}, [
  {"what": "quay", "len": 110, "name": "quay"}, {"what": "govHall", "where": "behind quay", "w": 9, "focus": True, "name": "court"}, CITY(160, "behind quay"), {"what": "ferry", "n": 2, "where": "quay"}, TREES(60, "shore")], light="afternoon")
setp("sg_towers", {"kind": "city", "seed": 419, "relief": 0.06, "size": 260, "shore": "south"}, [
  {"what": "tower", "where": "center", "floors": 24, "focus": True, "name": "tower"}, CITY(170), {"what": "people", "n": 2, "where": "near tower", "name": "pair"}, {"what": "skiff", "n": 4, "where": "shore"}, TREES(50, "shore")], light="morning")
setp("megaspeed_dc", {"kind": "coast", "seed": 421, "relief": 0.12, "size": 260, "shore": "south"}, [
  {"what": "datacenter", "where": "land near shore", "focus": True, "name": "dc"}, {"what": "datacenter", "where": "near dc"}, {"what": "midrise", "n": 22, "where": "inland"}, {"what": "quay", "len": 60},
  {"what": "containerShip", "where": "quay"}, ROAD("quay", "edge:north", "road"), {"what": "truck", "n": 5, "where": "road"}], light="noon")
setp("johor_dc", {"kind": "hills", "seed": 431, "relief": 0.25, "size": 260, "shore": "south", "landFrac": 0.7}, [
  {"what": "datacenter", "n": 3, "where": "inland", "focus": True, "focusIndex": 0, "name": "halls"}, {"what": "plantation", "rows": 12, "cols": 16, "where": "inland"}, ROAD("edge:west", "halls", "road"),
  {"what": "truck", "n": 6, "where": "road"}, TOWN(24, "shore")], light="afternoon")
setp("changi_air", {"kind": "plain", "seed": 433, "relief": 0.06, "size": 260, "shore": "south", "landFrac": 0.8}, [
  {"what": "cargoJet", "where": "center", "focus": True, "name": "jet"}, {"what": "cargoJet", "n": 2, "where": "near jet"}, {"what": "warehouse", "n": 5, "where": "near jet"}, {"what": "truck", "n": 6, "where": "near jet"},
  {"what": "radarMast", "where": "edge"}, TREES(40, "edge")], light="morning")
setp("taipei_night", {"kind": "hills", "seed": 439, "relief": 0.35, "size": 260, "shore": False}, [
  {"what": "tower", "where": "center", "floors": 26, "style": "step", "name": "tower"}, CITY(160), {"what": "people", "n": 2, "where": "near tower", "focus": True, "name": "pair"}, ROAD(), {"what": "car", "n": 12, "where": "road"}], light="evening")
setp("sg_evening", {"kind": "city", "seed": 443, "relief": 0.06, "size": 250, "shore": "south"}, [
  {"what": "quay", "len": 90, "name": "quay"}, CITY(150, "behind quay"), {"what": "people", "n": 2, "where": "quay", "focus": True, "name": "pair"}, {"what": "ferry", "where": "quay"}, {"what": "skiff", "n": 3, "where": "shore"}], light="evening")
setp("chip_port", {"kind": "coast", "seed": 457, "relief": 0.15, "size": 270, "shore": "south"}, [
  {"what": "fab", "where": "land near shore", "name": "fab"}, {"what": "quay", "len": 90, "name": "quay"}, {"what": "containerShip", "where": "quay", "focus": True, "name": "ship"}, {"what": "gantryCrane", "n": 3, "where": "quay"},
  {"what": "containerYard", "where": "behind quay", "cols": 7, "rows": 4}, ROAD("quay", "edge:north", "road"), {"what": "truck", "n": 8, "where": "road"}, {"what": "cargoJet", "where": "inland"}], light="afternoon")
setp("nasdaq_sq", {"kind": "city", "seed": 467, "relief": 0.06, "size": 250, "shore": False}, [
  {"what": "tower", "where": "center", "floors": 20, "style": "slab", "focus": True, "name": "exchange"}, CITY(170), {"what": "people", "n": 6, "where": "near exchange"}, ROAD(), {"what": "bus", "n": 2, "where": "road"}, {"what": "car", "n": 12, "where": "road"}], light="evening")
setp("fab_taiwan", {"kind": "coast", "seed": 479, "relief": 0.25, "size": 260, "shore": "west"}, [
  {"what": "fab", "where": "land near shore", "focus": True, "name": "fab"}, {"what": "warehouse", "n": 4, "where": "near fab"}, {"what": "quay", "len": 60}, {"what": "containerShip", "where": "quay"},
  ROAD("quay", "edge:east", "road"), {"what": "truck", "n": 6, "where": "road"}, {"what": "midrise", "n": 18, "where": "inland"}], light="morning")
setp("sf_press", {"kind": "hills", "seed": 487, "relief": 0.3, "size": 250, "shore": "west"}, [
  {"what": "tower", "where": "center", "floors": 16, "focus": True, "name": "office"}, CITY(130), ROAD(), {"what": "car", "n": 10, "where": "road"}, TREES(40)], light="afternoon")
setp("hq_press", {"kind": "plain", "seed": 491, "relief": 0.12, "size": 240, "shore": False}, [
  {"what": "campus", "where": "center", "name": "hq"}, {"what": "people", "n": 4, "where": "near hq", "focus": True, "name": "press"}, {"what": "car", "n": 9, "where": "near hq"}, {"what": "bus", "where": "near hq"}, TREES(70), CITY(60)], light="morning")
setp("tainan", {"kind": "coast", "seed": 499, "relief": 0.2, "size": 250, "shore": "west"}, [
  {"what": "house", "n": 1, "where": "center", "focus": True, "name": "home"}, TOWN(90, "inland"), {"what": "fishingBoat", "n": 4, "where": "shore"}, TREES(50, "shore"), ROAD()], light="afternoon")
setp("fab_hills", {"kind": "hills", "seed": 461, "relief": 0.3, "size": 260, "shore": False}, [
  {"what": "fab", "where": "center", "focus": True, "name": "fab"}, {"what": "fab", "where": "near fab"}, {"what": "midrise", "n": 12, "where": "edge"}, ROAD(), {"what": "truck", "n": 5, "where": "road"}, TREES(80)], light="morning")

# ---------------- MG beats (kinds + data; nothing prebuilt) ----------------
MG = [
 ("filing", [("annotatedDoc", {"head": "Form 8-K (SEC filing)", "ref": "Nvidia, 12 Nov 2026", "cap": "What the company filed", "body": [
    {"t": "Jensen Huang resigned as President, Chief Executive Officer and director.", "hi": 2, "note": "founder, CEO since 1993"},
    {"t": "Colette Kress appointed interim Chief Executive Officer.", "hi": 1, "note": "also stays CFO"},
    {"t": "Harvey C. Jones appointed Chair of the Board.", "hi": 1, "note": "first chair"}]})]),
 ("gpu", [("explodedView", {"object": "gpu", "parts": [{"label": "Graphics chip", "what": "chip"}, {"label": "Cooling fans", "what": "valveWheel"}, {"label": "Memory", "what": "battery"}, {"label": "Board", "what": "documentPage"}],
    "cap": "GeForce 256, 1999: sold as the first GPU", "focusPart": 0})]),
 ("cpugpu", [("splitAvsB", {"a": {"label": "CPU", "object": "laptop"}, "b": {"label": "GPU", "object": "gpu"}, "rows": [
    {"label": "Cores", "a": "a few big ones", "b": "thousands of small"}, {"label": "Sums at once", "a": "a handful", "b": "thousands"}, {"label": "Drawing game worlds", "a": False, "b": True}],
    "cap": "Why graphics chips are different", "note": "parallel maths"})]),
 ("rise", [("timelineStrip", {"events": [{"year": 1993, "label": "Founded at a diner", "what": "building"}, {"year": 1999, "label": "GeForce 256", "what": "gpu"}, {"year": 2006, "label": "CUDA", "what": "laptop"},
    {"year": 2012, "label": "AlexNet, on 2 Nvidia cards", "what": "gpu"}, {"year": 2022, "label": "ChatGPT", "what": "server"}], "cap": "From games to AI"})]),
 ("share", [("shareRing", {"slices": [{"label": "Nvidia", "value": 85}, {"label": "Everyone else", "value": 15}], "object": "gpu", "unit": "of AI chips (approx.)", "cap": "Analyst estimates: 80-90%", "redIndex": 0, "note": "roughly 80 to 90%"})]),
 ("dcrevenue", [("illustratedBars", {"items": [{"label": "Data centers", "value": 193.7}, {"label": "Everything else", "value": 22.2}], "object": "server", "unit": "$ bn, FY2026", "cap": "Nvidia revenue $215.9 bn", "redIndex": 0})]),
 ("mcap", [("lineEvent", {"values": [0.36, 0.55, 1.0, 1.2, 2.2, 3.3, 4.0, 5.0, 4.6, 5.5, 5.7], "labels": ["2022", "", "2023", "", "2024", "", "Jul 25", "Oct 25", "", "May 26", "Oct 26"],
    "events": [{"at": 2, "label": "$1 tn"}, {"at": 6, "label": "$4 tn"}, {"at": 7, "label": "$5 tn"}], "unit": "$ tn", "cap": "Nvidia's market value (approx.)", "redEvent": 2})]),
 ("why", [("branchTree", {"root": {"label": "AI chips", "what": "gpu", "kids": [{"label": "Weapons", "what": "warship"}, {"label": "Codebreaking", "what": "padlock"}, {"label": "Surveillance", "what": "magnifier", "red": True}]},
    "cap": "The US government's stated reasons (2022)"})]),
 ("ban2022", [("stampedPermit", {"title": "Export licence", "no": "7 Oct 2022 rules", "cap": "The first line", "stamp": "DENIED", "sign": "US Commerce", "fields": [
    {"k": "Item", "v": "Most powerful AI chips"}, {"k": "Destination", "v": "China"}, {"k": "Reason", "v": "military use risk"}], "checks": ["Performance cap", "End user"]})]),
 ("rules", [("stepRail", {"steps": [{"label": "2022: top chips banned", "what": "stamp"}, {"label": "Slower China versions", "what": "gpu"}, {"label": "2023: line moved", "what": "documentPage"},
    {"label": "H20 fits under", "what": "chip"}, {"label": "2025: H20 needs licence", "what": "padlock"}, {"label": "H200 allowed, 25% cut", "what": "coinStack"}], "cap": "Cat and mouse", "note": "each rule, a new chip"})]),
 ("h20rule", [("valveSwitch", {"flow": {"label": "H20 chips to China", "what": "gpu"}, "valve": {"label": "Licence rule"}, "stages": [{"label": "China sales", "what": "server"}, {"label": "Revenue", "what": "coinStack"}, {"label": "$5.5 bn hit", "what": "documentPage"}], "cap": "April 2025: the H20 needs a licence (charges up to $5.5 bn flagged)", "closedNote": "licence required"})]),
 ("nytfirst", [("sourceCard", {"value": "29 Oct 2026", "unit": "first report of an espionage effort", "cap": "Where the story starts", "source": {"pub": "The New York Times", "title": "report on Huang and Alice Huang", "year": "2026", "page": "as relayed by TechCrunch"}})]),
 ("cut15", [("waffleGrid", {"parts": [{"label": "To the US government", "value": 15}, {"label": "To Nvidia", "value": 85}], "total": 100, "unit": "of H20 China revenue", "cap": "The August 2025 deal", "object": "gpu", "redIndex": 0, "note": "15 cents in every dollar"})]),
 ("h200", [("splitAvsB", {"a": {"label": "H200", "object": "gpu"}, "b": {"label": "Blackwell", "object": "server"}, "rows": [{"label": "Sale to China", "a": True, "b": False}, {"label": "US government cut", "a": "25%", "b": "-"}],
    "cap": "December 2025 rules", "note": "newest chips stay banned"})]),
 ("middle", [("dependencyChain", {"cap": "A ban is only as strong as the middle", "chain": [{"n": "Chip maker", "what": "gpu", "load": 0.3}, {"n": "Partner", "what": "server", "load": 0.5},
    {"n": "Paperwork", "what": "documentPage", "load": 0.93, "note": "the weak link"}, {"n": "End user", "what": "building", "load": 0.45}]})]),
 ("owner", [("orgChart", {"cap": "Who controlled Megaspeed (as reported)", "root": {"n": "Alice Huang", "what": "person", "children": [{"n": "Megaspeed, Singapore", "what": "server", "stake": "controlling (C4ADS)", "red": True,
    "children": [{"n": "Malaysian affiliate", "what": "server", "stake": "affiliate"}]}]}})]),
 ("partner", [("ganttBars", {"tasks": [{"label": "Megaspeed set up (Mar 2023)", "start": 2, "end": 9, "what": "building"}, {"label": "Nvidia cloud partner (Oct 2023)", "start": 9, "end": 46, "what": "server"},
    {"label": "US probe reported (2024)", "start": 20, "end": 46, "what": "magnifier"}, {"label": "Singapore probe (2025)", "start": 24, "end": 37, "what": "documentPage"}], "unit": "mo", "cap": "Megaspeed, months from Jan 2023 (as reported)", "redIndex": 1})]),
 ("bought", [("objectCounter", {"value": 4.8, "unit": "billion dollars", "per": "of Nvidia hardware (approx.)", "object": "gpu", "each": 0.5, "cap": "Megaspeed + affiliate, 2-3 years", "note": "reported by CBS, TechCrunch", "redIndex": 0})]),
 ("photos", [("sourceCard", {"value": "Dec 2023", "unit": "earliest verified photo together", "cap": "How long it went back", "source": {"pub": "Reuters", "title": "photo verification", "year": "Nov 2026", "page": "verified images"}})]),
 ("memo", [("annotatedDoc", {"head": "Classified memo (as reported)", "ref": "NYT, 6 Nov 2026", "cap": "The spy claim", "body": [
    {"t": "Alice Huang was recruited by China's Ministry of State Security.", "hi": 2, "note": "reported, not proven"},
    {"t": "Drafted under the Secretary of State, spring 2026.", "hi": 1, "note": "per the NYT"}]})]),
 ("disputed", [("balanceScale", {"left": {"label": "Memo, FT report: recruited", "what": "documentPage", "n": 2, "weight": 3}, "right": {"label": "Doubts, DOJ, China's denial", "what": "magnifier", "n": 3, "weight": 2}, "cap": "Disputed", "note": "no public evidence"})]),
 ("information", [("stampedPermit", {"title": "One report's claim", "no": "The Information, 9 Nov", "cap": "Not independently verified", "stamp": "UNVERIFIED", "sign": "-", "fields": [
    {"k": "Claim", "v": "≈$7.5 bn chip sales to China"}, {"k": "Tied to", "v": "the relationship"}, {"k": "Confirmed by others", "v": "no"}], "checks": ["Second source", "Documents"]})]),
 ("dayswing", [("thermoScale", {"value": -4.3, "min": -15, "max": 0, "unit": "%", "markers": [{"at": -13, "label": "Low of the day (approx.)"}, {"at": -4.3, "label": "Close: -4.3%"}], "cap": "Nvidia shares, Thu 12 Nov", "note": "vs the day before", "object": "coinStack"})]),
 ("lost", [("objectCounter", {"value": 1.4, "unit": "trillion dollars", "per": "of value lost in a month (approx.)", "object": "coinStack", "each": 0.1, "cap": "About a quarter of the company", "note": "on paper, ≈-24%", "redIndex": 0}),
           ("shareRing", {"slices": [{"label": "Jensen Huang", "value": 3.6}, {"label": "Other shareholders", "value": 96.4}], "object": "coinStack", "unit": "of Nvidia (approx.)", "cap": "Huang's own stake", "redIndex": 0, "note": "about 3.6%"})]),
 ("verdict", [("splitAvsB", {"a": {"label": "Confirmed", "object": "stamp"}, "b": {"label": "Alleged", "object": "magnifier"}, "rows": [
    {"label": "Affair admitted", "a": True, "b": False}, {"label": "Resigned", "a": True, "b": False}, {"label": "Board investigating", "a": True, "b": False}, {"label": "Megaspeed bought billions", "a": True, "b": False}],
    "cap": "What we actually know", "note": "from filings and statements"})]),
 ("spyclaim", [("branchTree", {"root": {"label": "Recruited?", "what": "magnifier", "kids": [{"label": "Memo: yes", "what": "documentPage"}, {"label": "Officials: unsure", "what": "clockFace"},
    {"label": "DOJ: no verdict", "what": "podium", "red": True}, {"label": "Beijing: no", "what": "building"}]}, "cap": "Recruited by Chinese intelligence? Alleged, not proven"})]),
 ("trumpq", [("quoteCard", {"quote": "I know the FBI is looking into it", "em": "FBI is looking", "by": "President Donald Trump", "role": "FBI has not confirmed", "when": "9 Nov 2026"})]),
 ("layers", [("layerStack", {"layers": [{"label": "Affair: admitted", "what": "documentPage"}, {"label": "Resignation: filed", "what": "stamp"}, {"label": "Board probe: open", "what": "magnifier"},
    {"label": "Spy claim: alleged", "what": "warningSign"}, {"label": "Chip diversion: alleged", "what": "gpu"}], "cap": "Confirmed below, claims on top", "redIndex": 4})]),
 ("earnings", [("stepRail", {"steps": [{"label": "12 Nov: resignation", "what": "documentPage"}, {"label": "17 Nov: earnings", "what": "coinStack"}, {"label": "Congress, closed doors (expected)", "what": "podium"}, {"label": "Law firm findings (no date)", "what": "magnifier"}], "cap": "What comes next", "note": "first results without Huang"})]),
 ("loop", [("feedbackLoop", {"stages": [{"label": "Tighter export rule", "what": "documentPage"}, {"label": "Smuggled chips cost more", "what": "coinStack"}, {"label": "Bigger smuggling payoff", "what": "gpu"}, {"label": "More enforcement", "what": "magnifier"}],
    "cap": "Why the rules keep moving", "loopLabel": "reinforcing", "sign": "+"})]),
 ("arc", [("sizeCircles", {"items": [{"label": "33 years", "value": 12000, "object": "building"}, {"label": "5 days", "value": 5, "object": "documentPage"}], "unit": "days (approx.)", "cap": "33 years, then 5 days", "redIndex": 1, "note": "about 12,000 days vs 5"})]),
]
mg = [{"id": b, "parts": [{"kind": k, "data": d} for k, d in parts]} for b, parts in MG]

# ---------------- map (plan data): Singapore - Malaysia - China corridor ----------------
MAP = {"bounds": [90, 135, -8, 45], "center": [111, 18], "k": 0.42, "highlight": ["CHN"],
  "routes": {"smuggle": {"pts": [[103.85, 1.3], [103.75, 1.55], [104.6, 3.5], [106.5, 8], [109.5, 13], [112.5, 18], [114.2, 22.3]]},
    "suspect": {"pts": [[103.7, 1.6], [102.0, 3.0], [104.3, 6.5], [107.8, 11.5], [111.5, 17], [114.0, 21.5], [116.5, 25.5], [121.4, 31.2]]}},
  "pins": {"singapore": [103.85, 1.3], "johor": [103.7, 1.6], "china": [116.4, 39.9], "taiwan": [120.2, 23.0]},
  "signs": [["singapore", "SINGAPORE", 103.85, 1.3, 2.6, 1.4], ["johor", "MALAYSIA", 102.2, 3.6, -3.0, -0.6], ["china", "CHINA", 116.4, 39.9, 1.8, -1.4], ["taiwan", "TAIWAN", 120.9, 23.6, 2.2, 0.4],
    ["smuggle", "SHENZHEN / HONG KONG", 114.2, 22.3, -1.0, -1.6], ["suspect", "SHANGHAI", 121.4, 31.2, 2.0, -1.0]],
  "introWith": {"singapore": "route:smuggle", "china": "route:smuggle", "johor": "route:suspect", "taiwan": "route:suspect"}}

# ---------------- a visual for every voiced line ----------------
st = lambda s, subject="focus", **kw: {"set": s, "subject": subject, **kw}
mgv = lambda b, f=0: {"mg": b, "focus": f}
mp = lambda s="map": {"map": True, "subject": s}
LV = {
  1: st("hq_night", callout="Nvidia HQ, Santa Clara"), 2: st("hq_exit", "hq", callout="33 years"), 3: mgv("filing", 0), 4: st("nasdaq_sq", callout="Down 13% intraday"), 5: st("washington", callout="Washington"),
  6: st("dc_dusk", callout="The AI boom"),
  7: st("diner", callout="A Denny's, East San Jose, 1993"), 8: st("tainan", callout="Born in Tainan, Taiwan, 1963"), 9: mgv("gpu", 0), 10: mgv("cpugpu", 0), 11: st("research_park", callout="CUDA, 2006"), 12: mgv("rise", 3),
  13: st("dc_rows", callout="The same sums, billions of times"), 14: st("dc_build", callout="Late 2022: everyone wants chips"), 15: mgv("share", 0), 16: mgv("dcrevenue", 0), 17: mgv("mcap", 0),
  18: st("hq_day", callout="Santa Clara"),
  19: st("commerce", framing="lateralLow", callout="US Commerce Department"), 20: mgv("why", 0), 21: mgv("ban2022", 0), 22: st("fab_taiwan", callout="Slower chips, just under the line"), 23: mgv("rules", 2), 24: mgv("h20rule", 0),
  25: mgv("cut15", 0), 26: mgv("h200", 0), 27: mp("route:smuggle"), 28: st("sg_court", framing="highOblique", callout="Singapore charges, Feb 2025 (≈US$390m)"), 29: st("doj_us", framing="orbitBack", callout="US charges, Aug 2025"), 30: mgv("middle", 0),
  31: st("sg_towers", callout="Alice Huang: no relation"), 32: st("megaspeed_dc", callout="Megaspeed, Singapore"), 33: mgv("owner", 0), 34: mgv("partner", 0), 35: mgv("bought", 0),
  36: mp("route:suspect"), 37: st("johor_dc", callout="Megaspeed: no violations found"), 38: st("changi_air", callout="Barred from returning"), 39: st("taipei_night", "tower", callout="Photos since Dec 2023 (Reuters)"),
  40: st("sg_evening", "set"),
  41: mgv("nytfirst", 0), 42: st("hq_press", "press", callout="Nvidia: 'not unusual or unexpected'"), 43: mgv("memo", 0), 44: mgv("disputed", 0), 45: st("hq_sunday", callout="Sun 8 Nov: letter to staff"),
  46: st("hq_board", callout="Independent investigation"), 47: st("white_house", callout="Trump: 'FBI is looking into it'"), 48: mgv("information", 0), 49: st("sf_press", callout="Not independently verified"),
  50: st("law_firm", callout="Tue: outside lawyers hired"), 51: st("hq_wed", callout="NYT: another affair alleged (unconfirmed)"), 52: st("hq_end", framing="highOblique", callout="Wed 11 Nov: resignation accepted"),
  53: st("hq_morning", callout="Out as CEO and director"),
  54: mgv("dayswing", 0), 55: mgv("lost", 0), 56: st("wall_street", callout="Under $4 trillion at the open"), 57: st("hq_kress", "team", callout="Colette Kress: interim CEO"),
  58: st("hq_chair", callout="Harvey Jones: first chair"), 59: st("senate", callout="Senate Banking: Huang + Lutnick summoned"), 60: st("house_hill", callout="House: closed-door briefing"),
  61: st("beijing", callout="Beijing: 'baseless'"), 62: st("doj_dc", callout="Justice Dept: no conclusion"),
  63: st("courthouse"), 64: mgv("verdict", 0), 65: mgv("verdict", 1), 66: mgv("spyclaim", 0), 67: mp("route:suspect"), 68: mgv("trumpq", 0), 69: st("hq_board2", callout="Board: 'no reason to believe'"),
  70: mgv("layers", 0),
  71: mgv("earnings", 0), 72: st("capitol_closed", callout="Closed-door testimony (expected)"), 73: mgv("loop", 0), 74: st("law_office", callout="What the board knew, and when"),
  75: st("dc_hum"), 76: st("chip_port", callout="Who checks the route?"),
  77: st("hq_end"), 78: mgv("arc", 0), 79: st("fab_hills"), 80: st("hq_last", endcard=True)}
# script grew from 80 to 87 lines (renumber.json: old -> new); new lines get their own visuals
RN = {int(k): v for k, v in json.loads((F / "renumber.json").read_text()).items()}
LV = {RN[k]: v for k, v in LV.items()}
LV.update({35: st("megaspeed_dc", framing="lateralLow", callout="Cloud partner: rents out Nvidia computing"), 40: st("sg_court", callout="Singapore: US help 'limited'"),
  50: st("white_house", framing="orbitBack", callout="Trump: believes Huang didn't know"), 51: st("courthouse", callout="Mon 9 Nov: class action filed"),
  60: mgv("lost", 9), 64: st("white_house", framing="lateralLow", callout="Trump suggests Tim Cook"), 67: st("commerce", framing="orbitBack", callout="Democrats write to Commerce")})
assert sorted(LV) == list(range(1, 88)), sorted(set(range(1, 88)) - set(LV))
plan = {"film": "nvidia", "seed": 23, "endcard": {"name": "Blind Luck Time"}, "sets": list(S.values()), "mg": mg, "map": MAP, "lines": {str(k): v for k, v in LV.items()}}
(F / "plan.json").write_text(json.dumps(plan, indent=1, ensure_ascii=False), encoding="utf8")
used = {v["set"] for v in LV.values() if "set" in v}
print("sets", len(S), "used", len(used), "unused", sorted(set(S) - used), "mg beats", len(mg), "lines", len(LV))
