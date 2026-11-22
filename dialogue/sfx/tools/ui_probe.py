"""Closest earshot vocabulary readings for each rendered UI candidate (helps phrase briefs; diagnostics only).
  .vendor/earshot/.venv/Scripts/python.exe -I dialogue/sfx/tools/ui_probe.py <work dir>"""
import glob, json, os, sys
from earshot import api

W = sys.argv[1]
out = {}
for f in sorted(glob.glob(os.path.join(W, "ui_cands", "*.wav"))):
    m = api.match(f, "a sound effect")
    cv = [(x["term"], round(x["z"], 2)) for x in m.get("closest_vocab", [])[:4]]
    out[os.path.basename(f)] = cv
    print(os.path.basename(f), cv, flush=True)
json.dump(out, open(os.path.join(W, "ui_probe.json"), "w"), indent=1)
