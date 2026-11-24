"""Channel variants of a finished miniature film without re-rendering it (MINIATURE-LESSONS 19).

Every film ships twice: out/<film>_169_final_partition.mp4 and out/<film>_169_final_powder.mp4. The only difference is the last line
(the channel-named end line, voiced separately per channel) and the end card name + mark (film.html ?channel=<ch>).
Run from anywhere AFTER the main render (out/<film>_169.mp4) exists:

    python samples/obj3d/variants.py <film> [--ch partition,powder] [--from STAGE] [--only STAGE]

films/<film>/channels.json: {"partition": {"name": "Partition Lines", "line": "NARR (plain, dry): ..."}, "powder": {...}}
  (lines come from the script writer; never write them yourself)

stages, per channel (each heavy step goes through runtime/jobq.js):
  voice   python audio/voice.py <film> alt <ch>  (jobq voice; Fish, the film's own model + voice + tempo; cached in take/alt_<ch>.mp3;
          stops if the channel name is not heard as separate words - reroll with `voice.py <film> alt <ch> --reroll`)
  prep    films/<film>/variants/<ch>/{lines.json, words.json, voice.wav, beds.json, sound.json}: last line text/end swapped,
          the main last line cut out of voice.wav and the alternate take dropped in at the same sample (same gain as the main build)
  gate    render.mjs shots film with ?channel=<ch>  (jobq snap) -> out/<film>_<ch>_169_gates.json (the v3 gates, never loosened)
  render  render.mjs video film, env FROM = 1 s before the splice keyframe (jobq render) -> frames only from there to the end
  splice  checks the 30 overlap frames + the frames up to the final shot against the main render (PSNR), encodes the tail with the
          main render's x264 settings, stream-copies the main render up to the splice keyframe and concatenates (no re-encode of the head)
          -> out/<film>_<ch>_spliced_169.mp4; stills of the frames either side of the splice in out/review/variants/<film>/
  mix     audio/mix.py <film> 169 --voice/--lines/--beds/--sound of the variant (jobq ff; -14 LUFS / -1 dBTP) -> out/<film>_169_final_<ch>.mp4
  check   voice-join waveform + click metric at the swapped line, loudness of the final, duration/frames sanity
The splice point is the last keyframe of the main render >= 1.5 s before the final shot (the run holding the last line), because
only that shot depends on the film length T (the last line's end). Everything before it renders identically, and the splice
stage proves it (min PSNR of the overlap frames).
"""
import sys, json, subprocess, shutil, wave, re, os
from pathlib import Path
import numpy as np

HERE = Path(__file__).resolve().parent; ROOT = HERE.parents[1]; OUT = HERE / "out"
SR, FPS = 48000, 30
argv = sys.argv[1:]


def opt(k, d=None):
    if k in argv: i = argv.index(k); v = argv[i + 1]; del argv[i:i + 2]; return v
    return d


CHS = opt("--ch"); FROM_ST = opt("--from"); ONLY = opt("--only")
film = argv[0]; F = HERE / "films" / film
CHJ = json.load(open(F / "channels.json", encoding="utf8"))
CHS = CHS.split(",") if CHS else [k for k in ("partition", "powder") if k in CHJ]
STAGES = ["voice", "prep", "gate", "render", "splice", "mix", "check"]
run_st = [ONLY] if ONLY else STAGES[STAGES.index(FROM_ST):] if FROM_ST else STAGES
MAIN = OUT / f"{film}_169.mp4"
assert MAIN.exists(), f"main render missing: {MAIN}"


def sh(cmd, **kw): return subprocess.run(cmd, check=True, capture_output=True, text=True, **kw).stdout


def jobq(kind, cmd, env=None):
    print(f"[variants] jobq {kind}: {cmd}", flush=True)
    r = subprocess.run(["node", "runtime/jobq.js", "--kind", kind, "--prio", "1", "--", cmd], cwd=ROOT, env={**os.environ, **(env or {})})
    return r.returncode


def rwav(p):
    with wave.open(str(p)) as w:
        assert w.getframerate() == SR and w.getnchannels() == 1, p
        return np.frombuffer(w.readframes(w.getnframes()), "<i2").astype(np.float32) / 32768


def wwav(p, x):
    with wave.open(str(p), "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes((np.clip(x, -1, 1) * 32767).astype("<i2").tobytes())


def keyframes(t0, t1):
    o = sh(["ffprobe", "-v", "error", "-select_streams", "v", "-skip_frame", "nokey", "-show_entries", "frame=pts_time", "-of", "csv=p=0", "-read_intervals", f"{t0}%{t1}", str(MAIN)])
    return sorted({round(float(x.strip(",")) * FPS) for x in o.split() if x.strip(",")})


def nframes(p): return int(sh(["ffprobe", "-v", "error", "-count_packets", "-select_streams", "v", "-show_entries", "stream=nb_read_packets", "-of", "csv=p=0", str(p)]).strip())


def final_shot_start():
    """first line of the run holding the last line (same set / MG beat / map as the plan's last line)"""
    P = json.load(open(F / "plan.json", encoding="utf8"))["lines"]; L = json.load(open(F / "lines.json"))
    key = lambda n: (lambda v: ("set:" + v["set"]) if v.get("set") else ("mg:" + v["mg"]) if v.get("mg") else "map")(P.get(str(n), {}))
    i = len(L) - 1
    while i > 0 and key(L[i - 1]["n"]) == key(L[-1]["n"]): i -= 1
    return L[i]["start"], L[i]["n"]


def splice_frame():
    t_shot, n_shot = final_shot_start(); lim = t_shot - 1.5
    ks = [k for k in keyframes(max(0, lim - 40), lim + 0.1) if k <= lim * FPS and k >= 30]
    assert ks, "no keyframe before the final shot"
    return ks[-1], t_shot, n_shot


def stage_voice(ch):
    j = F / "take" / f"alt_{ch}.json"; want = re.sub(r"\s*\{[^}]*\}", "", CHJ[ch]["line"].split(": ", 1)[1]).strip()
    if j.exists() and json.load(open(j)).get("text") == want and json.load(open(j)).get("name_heard") and (F / "take" / f"alt_{ch}.wav").exists():
        print(f"[voice] {ch}: cached take ok"); return
    rc = jobq("voice", f"python samples/obj3d/audio/voice.py {film} alt {ch}")
    if rc: sys.exit(f"[voice] {ch}: stop (rc {rc}) - name not heard as separate words or Fish error; reroll once, then the writer's fallback form")


def stage_prep(ch):
    A = json.load(open(F / "take" / f"alt_{ch}.json")); assert A["name_heard"], f"{ch}: name check failed"
    D = F / "variants" / ch; D.mkdir(parents=True, exist_ok=True)
    L = json.load(open(F / "lines.json")); last = dict(L[-1]); s0 = A["main_start"]
    last.update(text=A["text"], end=round(last["start"] + A["dur"], 2), channel=ch); L[-1] = last
    json.dump(L, open(D / "lines.json", "w"), indent=1)
    W = json.load(open(F / "words.json")); main_end = s0 + A["main_dur"]
    W = [w for w in W if w[1] <= s0 - 0.05 or w[0] >= main_end + 0.3] + [[round(s0 + a, 2), round(s0 + b, 2), t] for a, b, t in A["words"]]
    json.dump(sorted(W, key=lambda w: w[0]), open(D / "words.json", "w"))
    v = rwav(F / "voice.wav"); y = rwav(F / "take" / f"alt_{ch}.wav"); a = int(round(s0 * SR)), int(round(main_end * SR))
    pre = np.abs(v[a[0] - int(0.3 * SR):a[0] - int(0.01 * SR)]).max(); post = np.abs(v[a[1] + int(0.05 * SR):]).max() if len(v) > a[1] + int(0.05 * SR) else 0
    assert pre < 0.02 and post < 0.02, f"voice.wav is not silent around the last line (pre {pre:.3f}, post {post:.3f}): cannot swap it cleanly"
    n = max(len(v), a[0] + len(y) + int(0.5 * SR)); out = np.zeros(n, np.float32); out[:len(v)] = v
    out[a[0]:a[1] + int(0.05 * SR)] = 0; out[a[0]:a[0] + len(y)] += y
    wwav(D / "voice.wav", out)
    T_new = np.ceil((last["end"] + 3.6) * 10) / 10
    B = json.load(open(F / "beds.json")); tmax = max(b["t1"] for b in B)
    for b in B:
        if b["t1"] >= tmax - 1e-6: b["t1"] = float(max(b["t1"], T_new))   # the last bed runs to the new end
    json.dump(B, open(D / "beds.json", "w"))
    S = json.load(open(F / "sound.json")); S["video"] = f"out/{film}_{ch}_spliced.mp4"; json.dump(S, open(D / "sound.json", "w"))
    print(f"[prep] {ch}: last line {L[-1]['start']}-{last['end']} (main ends {A['main_start'] + A['main_dur']:.2f}), T {T_new}, voice {n / SR:.1f} s -> {D}")


def stage_gate(ch):
    rc = jobq("snap", "node samples/obj3d/render.mjs shots film", {"QS": f"ar=16x9&film={film}&channel={ch}"})
    g = json.load(open(OUT / f"{film}_{ch}_169_gates.json")); print(f"[gate] {ch}: pass={g['pass']} {g['fails']}")
    for p in OUT.glob(f"{film}_{ch}_169_s[0-9][0-9].jpg"): p.unlink()   # shot stills of the variant = the main film's; keep only the gate record
    if rc or not g["pass"]: sys.exit(f"[gate] {ch}: v3 gates fail - fix the cause, never loosen")


def stage_render(ch):
    k, t_shot, n_shot = splice_frame(); f0 = k - 30
    print(f"[render] {ch}: splice keyframe {k} ({k / FPS:.3f} s), final shot (L{n_shot}) at {t_shot} s, rendering from frame {f0}")
    rc = jobq("render", "node samples/obj3d/render.mjs video film 30", {"QS": f"ar=16x9&film={film}&channel={ch}", "FROM": f"{f0 / FPS:.6f}"})
    if rc: sys.exit(f"[render] {ch}: render failed rc {rc}")
    json.dump({"k": k, "f0": f0, "t_shot": t_shot}, open(F / "variants" / ch / "splice.json", "w"))


def psnr_series(f0, n, frames_dir, start_number=0):
    o = subprocess.run(["ffmpeg", "-v", "error", "-ss", f"{f0 / FPS:.6f}", "-i", str(MAIN), "-framerate", str(FPS), "-start_number", str(start_number), "-i", str(frames_dir / "%05d.jpg"),
                        "-lavfi", f"[0:v]trim=end_frame={n},setpts=PTS-STARTPTS[a];[1:v]trim=end_frame={n},setpts=PTS-STARTPTS,format=yuv420p[b];[a][b]psnr=stats_file=-", "-f", "null", "-"],
                       capture_output=True, text=True).stdout
    return [float(m) if m != "inf" else 99.0 for m in re.findall(r"psnr_avg:(\S+)", o)]


def stage_splice(ch):
    sp = json.load(open(F / "variants" / ch / "splice.json")); k, f0 = sp["k"], sp["f0"]
    fd = OUT / f"frames_{film}_{ch}_169_from{f0}"; nt = len(list(fd.glob("*.jpg")))
    shot_f = int(sp["t_shot"] * FPS) - 20   # identical-picture region: overlap + splice .. just before the final shot's transition
    ps = psnr_series(f0, shot_f - f0, fd)
    mn = min(ps); print(f"[splice] {ch}: {len(ps)} frames {f0}..{shot_f - 1} vs main render: PSNR min {mn:.1f} dB, mean {np.mean(ps):.1f} dB")
    if mn < 35: sys.exit(f"[splice] {ch}: the tail does not match the main render before the final shot (min PSNR {mn:.1f}) - not splicing")
    tmp = OUT / f"_splice_{film}_{ch}"; tmp.mkdir(exist_ok=True)
    tail, head = tmp / "tail.mp4", tmp / "head.mp4"
    subprocess.run(["node", "runtime/jobq.js", "--kind", "ff", "--prio", "1", "--", f'ffmpeg -y -v error -framerate {FPS} -start_number 30 -i "{fd / "%05d.jpg"}" -c:v libx264 -pix_fmt yuv420p -crf 16 -preset slow "{tail}"'], cwd=ROOT, check=True)
    sh(["ffmpeg", "-y", "-v", "error", "-i", str(MAIN), "-map", "0:v", "-c", "copy", "-frames:v", str(k), str(head)])
    nh, ntl = nframes(head), nframes(tail); assert nh == k, f"head has {nh} frames, wanted {k}"; assert ntl == nt - 30, (ntl, nt)
    (tmp / "list.txt").write_text(f"file '{head.as_posix()}'\nfile '{tail.as_posix()}'\n")
    outv = OUT / f"{film}_{ch}_spliced_169.mp4"
    sh(["ffmpeg", "-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", str(tmp / "list.txt"), "-c", "copy", str(outv)])
    nf = nframes(outv); assert nf == k + ntl, (nf, k, ntl)
    err = subprocess.run(["ffmpeg", "-v", "error", "-ss", f"{(k - 90) / FPS:.4f}", "-i", str(outv), "-f", "null", "-"], capture_output=True, text=True).stderr.strip()
    assert not err, "decode errors after the splice: " + err[:300]
    rv = OUT / "review" / "variants" / film; rv.mkdir(parents=True, exist_ok=True)
    for f in (k - 2, k - 1, k, k + 1):   # frames either side of the splice, from the delivered file
        sh(["ffmpeg", "-y", "-v", "error", "-i", str(outv), "-vf", f"select=eq(n\\,{f})", "-frames:v", "1", "-q:v", "2", str(rv / f"{ch}_splice_f{f}.jpg")])
    # continuity across the cut: spliced vs main at the 30 frames each side (all must be the same picture)
    o = subprocess.run(["ffmpeg", "-v", "error", "-ss", f"{(k - 30) / FPS:.6f}", "-i", str(outv), "-ss", f"{(k - 30) / FPS:.6f}", "-i", str(MAIN),
                        "-lavfi", "[0:v]trim=end_frame=60,setpts=PTS-STARTPTS[a];[1:v]trim=end_frame=60,setpts=PTS-STARTPTS[b];[a][b]psnr=stats_file=-", "-f", "null", "-"], capture_output=True, text=True).stdout
    ps2 = [float(m) if m != "inf" else 99.0 for m in re.findall(r"psnr_avg:(\S+)", o)]
    # motion step at the cut vs its neighbours (a visible jump shows as a step much larger than the frame-to-frame steps around it)
    o = subprocess.run(["ffmpeg", "-v", "error", "-ss", f"{(k - 6) / FPS:.6f}", "-i", str(outv), "-ss", f"{(k - 5) / FPS:.6f}", "-i", str(outv),
                        "-lavfi", "[0:v]trim=end_frame=11,setpts=PTS-STARTPTS[a];[1:v]trim=end_frame=11,setpts=PTS-STARTPTS[b];[a][b]psnr=stats_file=-", "-f", "null", "-"], capture_output=True, text=True).stdout
    steps = [float(m) if m != "inf" else 99.0 for m in re.findall(r"psnr_avg:(\S+)", o)]
    rep = dict(splice_frame=k, splice_t=round(k / FPS, 4), overlap_psnr_min=round(mn, 2), overlap_psnr_mean=round(float(np.mean(ps)), 2), frames_checked=len(ps),
               cut_vs_main_psnr_min=round(min(ps2), 2) if ps2 else None, step_psnr_around_cut=[round(x, 1) for x in steps], step_at_cut=round(steps[5], 1) if len(steps) > 5 else None,
               head_frames=nh, tail_frames=ntl, total_frames=nf, out=str(outv))
    json.dump(rep, open(F / "variants" / ch / "splice_check.json", "w"), indent=1); print("[splice]", json.dumps(rep))
    shutil.rmtree(tmp)


def stage_mix(ch):
    D = F / "variants" / ch
    rc = jobq("ff", f"python samples/obj3d/audio/mix.py {film} 169 --out samples/obj3d/films/{film}/variants/{ch} --sound samples/obj3d/films/{film}/variants/{ch}/sound.json "
                    f"--beds samples/obj3d/films/{film}/variants/{ch}/beds.json --voice samples/obj3d/films/{film}/variants/{ch}/voice.wav --lines samples/obj3d/films/{film}/variants/{ch}/lines.json")
    if rc: sys.exit(f"[mix] {ch}: mix failed rc {rc}")
    fin = OUT / f"{film}_169_final_{ch}.mp4"; shutil.move(str(D / f"{film}_169_mix.mp4"), fin); print(f"[mix] {ch}: -> {fin}")


def stage_check(ch):
    D = F / "variants" / ch; A = json.load(open(F / "take" / f"alt_{ch}.json")); v = rwav(D / "voice.wav"); s0 = A["main_start"]; a = int(round(s0 * SR)); b = a + int(A["dur"] * SR)
    d = np.abs(np.diff(v)); win = lambda x0, x1: float(d[max(0, x0):x1].max())
    rep = dict(join_in_jump=round(win(a - 240, a + 240), 4), join_out_jump=round(win(b - 240, b + 480), 4), speech_p99_jump=round(float(np.percentile(d[a:b], 99)), 4),
               pre_silence_peak=round(float(np.abs(v[a - int(0.3 * SR):a - 48]).max()), 4), alt_peak=round(float(np.abs(v[a:b]).max()), 3))
    rv = OUT / "review" / "variants" / film; rv.mkdir(parents=True, exist_ok=True)
    for nm, src in (("main", F / "voice.wav"), (ch, D / "voice.wav")):
        sh(["ffmpeg", "-y", "-v", "error", "-ss", f"{s0 - 1.5:.3f}", "-t", f"{A['dur'] + 3:.3f}", "-i", str(src), "-filter_complex", "showwavespic=s=1600x300:colors=0x2b2a27", "-frames:v", "1", str(rv / f"voice_join_{nm}.png")])
    fin = OUT / f"{film}_169_final_{ch}.mp4"
    r = subprocess.run(["ffmpeg", "-hide_banner", "-i", str(fin), "-map", "0:a", "-af", "ebur128=peak=true", "-f", "null", "-"], capture_output=True, text=True).stderr
    I = re.findall(r"I:\s+(-?[\d.]+) LUFS", r); P = re.findall(r"Peak:\s+(-?[\d.]+) dBFS", r)
    vd = float(sh(["ffprobe", "-v", "error", "-select_streams", "v", "-show_entries", "stream=duration", "-of", "csv=p=0", str(fin)]).strip())
    ad = float(sh(["ffprobe", "-v", "error", "-select_streams", "a", "-show_entries", "stream=duration", "-of", "csv=p=0", str(fin)]).strip())
    rep.update(final=str(fin), lufs=float(I[-1]) if I else None, true_peak=float(P[-1]) if P else None, video_s=vd, audio_s=ad, last_line_end=round(s0 + A["dur"], 2))
    json.dump(rep, open(D / "check.json", "w"), indent=1); print("[check]", json.dumps(rep))


for ch in CHS:
    assert ch in CHJ, f"channel {ch} not in channels.json"
    for st in run_st: globals()["stage_" + st](ch)
print("[variants] done:", ", ".join(str(OUT / f"{film}_169_final_{c}.mp4") for c in CHS) if "mix" in run_st else "")
