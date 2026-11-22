"""Build casting/audition_manifest.json: every option x 2-3 in-character lines x 3 seeds, for dlg_voice.py batch."""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from common import *

LINES = {
    "dadu": [("Nineteen seventy-one. The jute mill by the river was hiring a clerk. Shirt. Tie. A chair with wheels.", "warm"),
             ("Keep showing up. And this time... learn the guard's name.", "warm")],
    "rohan": [("Forty-two applications. Forty-two, we'll keep your CV on file.", "flat"),
              ("You became the guard?", "laugh")],
    # written true to the SCRIPT-VOICE.md section 2 voice sheets
    "arjun": [("Per my last email, we have eleven days of runway. I'm sure it's fine.", "flat"),
              ("Ninety-four percent of the budget is gone. I'd call that front-loaded.", "worried")],
    "meera": [("Okay, who actually asked him if he wants the promotion?", "curious"),
              ("You've checked your phone four times. Just text her.", "amused")],
}
SEEDS = 3
items = []
for c in CHARS:
    for o in OPTS:
        for li, (text, tag) in enumerate(LINES[c]):
            for s in range(SEEDS):
                items.append({"char": c, "opt": o, "line": li, "text": text, "tag": tag,
                              "ref": str(REFS / f"{c}_{o}.wav").replace("\\", "/"),
                              "seed": 4000 + li * 10 + s,
                              "out": str(CAND / f"aud_{c}_{o}_l{li}_s{s}.wav").replace("\\", "/")})
json.dump(items, open(CAST / "audition_manifest.json", "w"), indent=1)
print(len(items), "items")
