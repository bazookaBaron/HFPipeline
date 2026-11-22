"""Download the top Openverse candidates per need into a fresh directory (untrusted data: audio only), then
decode each to 48 kHz 16-bit FLAC (disk is tight) with ffmpeg into <work>/wav/<need>/ for vetting.
  python -I dialogue/sfx/tools/ov_download.py <candidates.json> <work dir> [--per N] [need_id ...]"""
import json, os, subprocess, sys, time
sys.stdout.reconfigure(encoding="utf-8", errors="replace")  # titles can hold non-cp1252 chars (-I ignores PYTHONIOENCODING)

UA = {"User-Agent": "HFPipeline-dialogue-sfx/1.0"}
AUDIO_EXT = {"mp3", "wav", "ogg", "flac", "oga", "m4a", "aiff", "aif", "opus"}
MAX_BYTES = 40 * 1024 * 1024


def fetch(url, dst):
    """curl (Windows cert store; Python's bundled store rejected the CDN chain). Audio content-type + size cap."""
    r = subprocess.run(["curl", "-sS", "-L", "--fail", "--max-filesize", str(MAX_BYTES), "-A", UA["User-Agent"],
                        "-o", dst, "-w", "%{content_type}", url], capture_output=True, text=True, timeout=180)
    if r.returncode != 0:
        raise ValueError(f"curl {r.returncode}: {r.stderr.strip()[:120]}")
    ct = r.stdout.strip().lower()
    if not (ct.startswith("audio/") or "octet-stream" in ct or "ogg" in ct):
        os.remove(dst); raise ValueError(f"not audio: {ct}")
    return os.path.getsize(dst)


def main():
    a = sys.argv[1:]
    cands, work = json.load(open(a[0], encoding="utf-8")), a[1]
    per = 6
    if "--per" in a:
        i = a.index("--per"); per = int(a[i + 1]); a = a[:i] + a[i + 2:]
    only = set(a[2:])
    dl, wav = os.path.join(work, "dl"), os.path.join(work, "wav")
    log = {}
    for nid, rows in cands.items():
        if only and nid not in only: continue
        os.makedirs(os.path.join(dl, nid), exist_ok=True); os.makedirs(os.path.join(wav, nid), exist_ok=True)
        got = 0
        for r in rows:
            if got >= per: break
            ext = (r.get("filetype") or r["url"].rsplit(".", 1)[-1]).lower()
            if ext not in AUDIO_EXT: continue
            src = os.path.join(dl, nid, f"{r['id']}.{ext}")
            out = os.path.join(wav, nid, f"{r['id']}.flac")
            try:
                if not os.path.exists(src): fetch(r["url"], src); time.sleep(1)
                # decode only (no filters yet); cap ambience to 4 min to keep vetting fast
                cmd = ["ffmpeg", "-nostdin", "-v", "error", "-y", "-i", src, "-t", "150" if nid.startswith("amb.") and nid != "amb.birds.owl" else "240", "-vn", "-ar", "48000", "-c:a", "flac", "-sample_fmt", "s16", out]
                subprocess.run(cmd, check=True, timeout=180)
                got += 1; log[r["id"]] = "ok"
                print(nid, "ok", r["license"], (r.get("title") or "")[:50], flush=True)
            except Exception as e:
                log[r["id"]] = f"fail: {e}"; print(nid, "FAIL", (r.get("title") or "")[:50], e, flush=True)
    json.dump(log, open(os.path.join(work, "download_log.json"), "w"), indent=1)


if __name__ == "__main__":
    main()
