"""Search the Openverse audio API (api.openverse.org/v1/audio/) for each need in needs.json.
Only cc0 / by licences, freesound + wikimedia sources (no music catalogues). Writes candidates.json.
  python -I dialogue/sfx/tools/ov_search.py <needs.json> <candidates.json> [need_id ...]"""
import json, sys, time, urllib.error, urllib.parse, urllib.request
sys.stdout.reconfigure(encoding="utf-8", errors="replace")  # titles can hold non-cp1252 chars (-I ignores PYTHONIOENCODING)

API = "https://api.openverse.org/v1/audio/"
UA = {"User-Agent": "HFPipeline-dialogue-sfx/1.0"}
OK_LIC = {"cc0", "by"}


def search(q, page_size=20):  # anonymous max is 20 (40 -> 401)
    qs = urllib.parse.urlencode({"q": q, "license": "cc0,by", "source": "freesound,wikimedia_audio",
                                 "page_size": page_size, "mature": "false"})
    for attempt in range(8):
        try:
            with urllib.request.urlopen(urllib.request.Request(f"{API}?{qs}", headers=UA), timeout=40) as r:
                return json.load(r).get("results", [])
        except urllib.error.HTTPError as e:
            if e.code == 403:   # Cloudflare challenge page for this query: never try to get around it, skip the query
                print("  skip (403 challenge)", q, flush=True); return []
            print("  retry", q, e, flush=True); time.sleep(70)  # 429 = anonymous burst limit: wait out the minute
        except Exception as e:
            print("  retry", q, e, flush=True); time.sleep(70)  # anonymous burst limit: wait out the minute
    return []


def main(needs_path, out_path, only):
    needs = json.load(open(needs_path, encoding="utf-8"))
    try:
        out = json.load(open(out_path, encoding="utf-8"))
    except Exception:
        out = {}
    for nid, n in needs.items():
        if only and nid not in only: continue
        seen, rows = set(), []
        for q in n["queries"]:
            for r in search(q):
                lic = (r.get("license") or "").lower()
                if lic not in OK_LIC or r["id"] in seen: continue
                dur = (r.get("duration") or 0) / 1000.0
                if dur < n.get("min_s", 0) or dur > n.get("max_s", 1e9): continue
                text = ((r.get("title") or "") + " " + " ".join(t["name"] for t in r.get("tags") or [])).lower()
                if any(w in text for w in n.get("exclude", [])): continue
                seen.add(r["id"])
                rows.append({"id": r["id"], "title": r.get("title"), "creator": r.get("creator"),
                             "landing": r.get("foreign_landing_url"), "url": r.get("url"), "filetype": r.get("filetype"),
                             "license": lic, "license_version": r.get("license_version"), "license_url": r.get("license_url"),
                             "source": r.get("source"), "duration_s": dur, "query": q,
                             "tags": [t["name"] for t in r.get("tags") or []][:12]})
            time.sleep(6)
        rows.sort(key=lambda x: x["license"] != "cc0")  # cc0 first, stable within
        out[nid] = rows
        print(nid, len(rows), "cc0:", sum(r["license"] == "cc0" for r in rows), flush=True)
        json.dump(out, open(out_path, "w", encoding="utf-8"), indent=1)
    json.dump(out, open(out_path, "w", encoding="utf-8"), indent=1)


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2], set(sys.argv[3:]))
