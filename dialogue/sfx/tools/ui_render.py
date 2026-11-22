"""Render Earshot bank candidates for the DIALOGUE MG/UI set and vet them with earshot (one process).
Run with the earshot venv python:
  .vendor/earshot/.venv/Scripts/python.exe -I dialogue/sfx/tools/ui_render.py <work dir>
Writes <work>/ui_cands/*.wav and <work>/ui_vet.json (match + rank per role)."""
import json, os, sys
from earshot import api

WORK = sys.argv[1]
C = os.path.join(WORK, "ui_cands"); os.makedirs(C, exist_ok=True)

# role -> (brief, alts, [(bank id, render kwargs)])  -- soft, short, mid-register candidates only
ROLES = {
    "ui.pop.soft": ("a bubble pop", ["a cork pop", "a water drop", "a mouse click"],
                    [("ui_pop/soft", {}), ("ui_pop/step", {}), ("pro_pop/boop", {}), ("pro_pop/bloop", {}), ("pop/4", {}), ("pro_pop_in/round", {})]),
    "ui.pop.tiny": ("a chat message pop", ["a mouse click", "a water drop", "a camera shutter click"],
                    [("ui_pop/blip", {}), ("pro_pop/tink", {}), ("drip/tiny", {}), ("pro_pop/thup", {})]),
    "ui.card.slide": ("a quick swipe", ["a gust of wind rushing past", "cloth rustling", "a stick swung fast through the air"],
                      [("swipe/paper", {}), ("swipe/glide", {}), ("swipe/velvet", {}), ("swipe/cloth", {}), ("swish/soft", {}), ("swipe/flick", {})]),
    "ui.line.tick": ("a soft UI button tap", ["a mouse click", "a clock ticking", "a clicky mechanical keyboard"],
                     [("pro_typing_key/soft", {}), ("pro_hover_tick/soft", {}), ("pro_tap/soft", {}), ("tap/soft", {}), ("pro_tap/finger", {}), ("fit/tick/domino", {}), ("pro_click/soft", {}), ("hover_tick/air", {}), ("click/soft", {})]),
    "ui.line.draw": ("paper rustling", ["a keyboard typing fast", "a gust of wind rushing past", "a ratchet clicking"],
                     [("pro_typing_run/soft", {"dur": 0.8}), ("swish/soft", {"dur": 0.5}), ("swipe/paper", {"dur": 0.45}), ("swipe/cloth", {"dur": 0.5})]),
    "ui.whoosh.soft": ("a soft air whoosh", ["a deep cinematic whoosh", "a gust of wind rushing past", "a stick swung fast through the air"],
                       [("swish/soft", {}), ("whoosh_fast/sleeve", {}), ("swipe/velvet", {}), ("pro_whoosh_big/windy", {"dur": 0.7}), ("fit/whoosh.short/bamboo_swish", {})]),
    "ui.ding.number": ("a notification ding", ["an alarm clock beeping", "a doorbell", "a singing bowl"],
                       [("notify/mid_tine", {}), ("notify/mid_wood", {}), ("mallet/celesta", {}), ("mallet/glock", {}), ("pro_notify/ding_1822", {}), ("pro_notify/ding_2045", {}), ("mallet/marimba", {})]),
    "ui.pin.drop": ("a small object dropping on a table", ["a knock on a door", "coins dropping", "a water drop"],
                    [("pro_pop_in/knock", {}), ("knock/wood", {}), ("pro_tap/knock", {}), ("tap/table", {}), ("fit/land.light/finger_wood", {}), ("knock/desk", {}), ("drip/drop", {}), ("pro_pop_in/deep", {}), ("fit/land.light/fingertip_book", {})]),
}

out = {}
for role, (brief, alts, cands) in ROLES.items():
    files = []
    for bid, kw in cands:
        fn = os.path.join(C, role.replace(".", "_") + "__" + bid.replace("/", "_").replace(".", "-") + ".wav")
        api.sfx_render(bid, fn, **kw)
        files.append((bid, kw, fn))
    rk = api.rank([f for _, _, f in files], brief)
    rows = []
    for bid, kw, fn in files:
        m = api.match(fn, brief, alts=alts)
        ms = api.measure(fn)
        rows.append({"bank_id": bid, "kw": kw, "file": fn, "z": m.get("z"), "verdict": m.get("verdict"),
                     "p_vs_alts": m.get("p_vs_alts"), "dur": ms.get("duration"), "centroid_hz": ms.get("centroid_hz"),
                     "decay_ms": ms.get("decay_ms"), "peak_dbfs": ms.get("peak_dbfs")})
    rows.sort(key=lambda r: -(r["z"] or -99))
    out[role] = {"brief": brief, "alts": alts, "rank_summary": rk["summary"], "rank_order": [r["name"] for r in rk["results"]], "cands": rows}
    print(role, [(r["bank_id"], round(r["z"] or 0, 2), r["verdict"], r["centroid_hz"] and int(r["centroid_hz"])) for r in rows], flush=True)
json.dump(out, open(os.path.join(WORK, "ui_vet.json"), "w"), indent=1, default=str)
