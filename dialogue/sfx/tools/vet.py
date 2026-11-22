"""Vet every downloaded candidate with earshot in one process (models load once):
  rank (all candidates of a need vs its brief), find (best section / moments), match (brief vs realistic
  confusions, on the chosen section) and realness. Writes <work>/vet.json.
  .vendor/earshot/.venv/Scripts/python.exe -I dialogue/sfx/tools/vet.py <needs.json> <work dir> [need_id ...]"""
import glob, json, os, sys
import soundfile as sf
from earshot import api

needs = json.load(open(sys.argv[1], encoding="utf-8"))
W = sys.argv[2]
only = set(sys.argv[3:])
vp = os.path.join(W, "vet.json")
out = json.load(open(vp)) if os.path.exists(vp) else {}
AMB_WIN = 50.0  # seconds of the best section to keep for a bed (loop is cut from it)


def slim_match(m):
    return {"z": m.get("z"), "verdict": m.get("verdict"), "p_vs_alts": m.get("p_vs_alts"),
            "closest_vocab": [(x["term"], round(x["z"], 2)) for x in m.get("closest_vocab", [])[:3]]}


for nid, n in needs.items():
    if only and nid not in only: continue
    files = sorted(glob.glob(os.path.join(W, "wav", nid, "*.flac")) + glob.glob(os.path.join(W, "wav", nid, "*.wav")))
    if not files: continue
    brief, alts, kind = n["brief"], n["alts"], n["kind"]
    rk = api.rank(files, brief)
    rec = {"brief": brief, "alts": alts, "rank_summary": rk["summary"],
           "rank": [(r["name"], r["z"], r["verdict"]) for r in rk["results"]], "files": {}}
    for f in files:
        dur = sf.info(f).duration
        fr = {"dur": round(dur, 2)}
        try:
            if kind == "amb":
                if dur > AMB_WIN + 5:
                    fd = api.find(f, brief, win=AMB_WIN, hop=5.0, top=1)
                    seg = fd["segments"][0] if fd.get("segments") else None
                    s0, s1 = (seg["start"], seg["end"]) if seg else (0.0, min(dur, AMB_WIN))
                else:
                    s0, s1 = 0.0, dur
                fr["section"] = [round(s0, 2), round(s1, 2)]
                fr["match"] = slim_match(api.match(f, brief, alts=alts, start=s0, end=s1))
                rl = api.realness(f, start=s0, end=s1)
            else:
                fd = api.find(f, brief, top=4)
                segs = [{"start": s["start"], "end": s["end"], "z": s.get("z"), "verdict": s.get("verdict")}
                        for s in fd.get("segments", [])]
                fr["moments"] = segs
                if segs:
                    s0, s1 = segs[0]["start"], segs[0]["end"]
                    fr["match"] = slim_match(api.match(f, brief, alts=alts, start=s0, end=s1))
                else:
                    fr["match"] = slim_match(api.match(f, brief, alts=alts))
                rl = api.realness(f)
            fr["realness"] = {"p_real": rl.get("p_real"), "verdict": rl.get("verdict")}
        except Exception as e:
            fr["error"] = str(e)
        rec["files"][os.path.splitext(os.path.basename(f))[0]] = fr
        m = fr.get("match", {})
        print(nid, os.path.basename(f)[:12], fr.get("section") or len(fr.get("moments", [])), m.get("z"), m.get("verdict"),
              fr.get("realness", {}).get("verdict"), flush=True)
    out[nid] = rec
    json.dump(out, open(vp, "w"), indent=1, default=str)
