"""earshot venv: per-segment tone forced-choice (CLAP), gender check, laugh check, bed description."""
import json, sys
from earshot import api
TONE = ["a person speaking excitedly", "a person speaking sarcastically", "a person whispering",
        "a person laughing while talking", "a person speaking in a flat deadpan monotone", "a frustrated angry person speaking",
        "a calm narrator speaking", "a worried anxious person speaking", "a cheerful happy person speaking",
        "a person shouting", "a confused person asking a question", "a sad person speaking"]
GENDER = ["a man speaking", "a woman speaking", "a child speaking"]
LAUGH = ["people laughing", "a person speaking"]
out = {}
for v in sys.argv[1:]:
    P = json.load(open(f"{v}.prosody.json")); path = f"{v}.48k.wav"
    rec = {"full_describe": api.describe(path), "segments": [], "gaps": []}
    for s in P["segments"]:
        a, b = s["start"], max(s["end"], s["start"] + 0.6)
        r = {"i": s["i"], "text": s["text"]}
        try:
            m = api.match(path, TONE, start=a, end=b)
            r["tone"] = sorted([(x["query"], round(x["p_vs_alts"], 3), round(x["z"], 2)) for x in m["results"]], key=lambda t: -t[1])[:4] if "results" in m else m
            g = api.match(path, GENDER, start=a, end=b)
            r["gender"] = [(x["query"], round(x["p_vs_alts"], 3)) for x in g["results"]] if "results" in g else g
            l = api.match(path, LAUGH, start=a, end=b)
            r["laugh"] = [(x["query"], round(x["p_vs_alts"], 3), round(x["z"], 2)) for x in l["results"]] if "results" in l else l
        except Exception as e:
            r["error"] = repr(e)
        rec["segments"].append(r); print(v, s["i"], r.get("tone", r.get("error"))[:2] if isinstance(r.get("tone"), list) else r, flush=True)
    segs = P["segments"]
    for k in range(len(segs) - 1):
        a, b = segs[k]["end"] + 0.05, segs[k + 1]["start"] - 0.05
        if b - a >= 0.5:
            try:
                d = api.describe(path, start=a, end=b, top=5)
                rec["gaps"].append({"start": round(a, 2), "end": round(b, 2), "tags": d.get("tags", d.get("summary"))})
            except Exception as e:
                rec["gaps"].append({"start": a, "end": b, "error": repr(e)})
    out[v] = rec
    json.dump(rec, open(f"{v}.earshot.json", "w"), indent=1, default=str)
