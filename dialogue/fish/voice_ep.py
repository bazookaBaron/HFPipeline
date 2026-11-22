"""Generic DIALOGUE voice for an episode (Fish REST drama-3; Leo=Stickzy spk0, Walter=Adrian spk1; key never printed).
Usage: python voice_ep.py <slug> tts|check|reroll N [N..]|build
 tts   : batches of whole lines (<=460 bytes) -> take_<slug>/B<k>.mp3 + ASR json
 check : per-line f0 + swap detection (leave-one-out)
 reroll: single-speaker re-roll of line N (1-based) -> take_<slug>/R<N>.mp3 (+ASR)
 build : line-accurate rebuild from batches (+rerolls), cap gaps, beat before the button -> voice_<slug>_1x.wav, 1.3x -> voice_<slug>.wav, words_<slug>.json"""
import sys, re, json, subprocess, urllib.request, urllib.error, wave
from pathlib import Path
import numpy as np
D = Path(__file__).parent; slug = sys.argv[1]; cmd = sys.argv[2]
S = D.parent / "episodes" / slug / "script.md"; T = D / f"take_{slug}"; T.mkdir(exist_ok=True)
LEO, WAL = "55046bd7267d4a618380d1e8f93a056a", "bf322df2096a46f18c579d0baa36f41d"
SR = 48000; MAXGAP, TH = 0.85, 10 ** (-38 / 20)
L = []
for l in S.read_text(encoding="utf8").split("#end")[0].splitlines():
    m = re.match(r"(LEO|WALTER) \(([^)]*)\) \[[^\]]*\]: (.*)", l)
    if m: L.append((m[1], m[2], m[3]))
nl = lambda x: re.sub(r'[^a-z0-9]', '', x.lower())


def batches():
    out, cur, size = [], [], 0
    for i, (sp, emo, t) in enumerate(L):
        b = len(f"<|speaker:0|>[{emo}] {t}".encode())
        if cur and (size + b > 460 or i == len(L) - 1): out.append(cur); cur, size = [], 0
        cur.append(i); size += b
    out.append(cur); return out


def key():
    for l in (D.parents[1] / ".vendor-assets" / ".env").read_text().splitlines():
        if l.startswith("FISH_API_KEY="): return l.split("=", 1)[1].strip().strip('"')


def tts(txt, ref, path):
    body = {"text": txt, "reference_id": ref, "format": "mp3", "mp3_bitrate": 192, "latency": "normal"}
    req = urllib.request.Request("https://api.fish.audio/v1/tts", data=json.dumps(body).encode(), headers={"Authorization": "Bearer " + key(), "Content-Type": "application/json", "model": "drama-3"})
    try: a = urllib.request.urlopen(req, timeout=300).read()
    except urllib.error.HTTPError as e: print("HTTP", e.code, e.read()[:300]); sys.exit(1)
    path.write_bytes(a); print(path.name, len(txt.encode()), "B ->", len(a), "B audio")


def asr(p):
    from faster_whisper import WhisperModel
    m = WhisperModel("small", device="cpu", compute_type="int8")
    x = np.frombuffer(subprocess.run(["ffmpeg", "-v", "error", "-i", str(p), "-ac", "1", "-ar", "16000", "-f", "f32le", "-"], capture_output=True).stdout, dtype="<f4")
    seg, _ = m.transcribe(x, language="en", word_timestamps=True, vad_filter=False)
    out = [(round(w.start, 2), round(w.end, 2), w.word.strip()) for s in seg for w in s.words]
    json.dump(out, open(p.with_suffix(".json"), "w")); return out


def lines_words(w, idxs):
    i = 0; r = {}
    for n in idxs:
        tgt = len(nl(L[n][2])); j = i; acc = ''
        while j < len(w) and len(acc) < tgt - 1: acc += nl(w[j][2]); j += 1
        r[n] = (i, max(j, i + 1)); i = j
    return r


def load(p):
    r = subprocess.run(["ffmpeg", "-v", "error", "-i", str(p), "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"], capture_output=True, check=True)
    return np.frombuffer(r.stdout, dtype="<f4")


def tighten(x):
    win = int(0.01 * SR); n = len(x) // win
    env = np.sqrt((x[:n * win].reshape(n, win) ** 2).mean(1)); sil = env < TH; out = []; i = 0
    while i < n:
        j = i
        while j < n and sil[j] == sil[i]: j += 1
        seg = x[i * win:j * win]
        if sil[i]: seg = seg[:min(len(seg), int(MAXGAP * SR))]
        out.append(seg); i = j
    out.append(x[n * win:]); return np.concatenate(out)


def trim(x):
    idx = np.where(np.abs(x) > TH)[0]; return x[idx[0]:idx[-1] + 1]


def rtrim(n):
    w = json.load(open(T / f"R{n + 1}.json")); fw = nl(L[n][2].split()[0]); j = next((i for i, x in enumerate(w) if nl(x[2]) == fw), 0)
    a = max(0, w[j][0] - 0.05) if j else 0; x = load(T / f"R{n + 1}.mp3"); return trim(x[int(a * SR):])


g = lambda s: np.zeros(int(s * SR), dtype="<f4")
B = batches()


def feat(y, sr, a, b):
    import librosa
    seg = y[int(a * sr):int((b + .2) * sr)]; M = librosa.feature.mfcc(y=seg, sr=sr, n_mfcc=20); e = librosa.feature.rms(y=seg)[0]
    v = M[:, e[:M.shape[1]] > np.median(e)]; return np.concatenate([v[1:].mean(1), v[1:].std(1)])


def f0of(y, sr, a, b):
    import librosa
    f0, vf, _ = librosa.pyin(y[int(a * sr):int((b + .15) * sr)], fmin=70, fmax=420, sr=sr); f = f0[vf & ~np.isnan(f0)]
    return float(np.median(f)) if len(f) else 0.0


if cmd == "tts":
    for k, idx in enumerate(B):
        txt = "".join(f"<|speaker:{0 if L[i][0] == 'LEO' else 1}|>[{L[i][1]}] {L[i][2]}" for i in idx)
        (T / f"B{k}.mp3").exists() or tts(txt, [LEO, WAL], T / f"B{k}.mp3"); (T / f"B{k}.txt").write_text(txt, encoding="utf8"); asr(T / f"B{k}.mp3")
    print("batches", [[i + 1 for i in b] for b in B])
elif cmd == "reroll":
    for n in map(int, sys.argv[3:]):
        sp, emo, t = L[n - 1]; tts(f"[{emo}] {t}", LEO if sp == "LEO" else WAL, T / f"R{n}.mp3"); asr(T / f"R{n}.mp3")
elif cmd in ("check", "build"):
    import librosa
    info = {}
    for k, idx in enumerate(B):
        w = json.load(open(T / f"B{k}.json")); al = lines_words(w, idx); y, sr = librosa.load(T / f"B{k}.mp3", sr=16000)
        for n in idx:
            i0, i1 = al[n]; a, b = w[i0][0], w[i1 - 1][1]
            info[n] = dict(src=f"B{k}", ft=feat(y, sr, a, b), f0=f0of(y, sr, a, b), words=" ".join(x[2] for x in w[i0:i1]), wpm=(i1 - i0) / (b - a) * 60)
    for n in range(len(L)):
        r = T / f"R{n + 1}.json"
        if r.exists():
            w = json.load(open(r)); y, sr = librosa.load(T / f"R{n + 1}.mp3", sr=16000); a, b = w[0][0], w[-1][1]
            info[n] = dict(src=f"R{n + 1}", ft=feat(y, sr, a, b), f0=f0of(y, sr, a, b), words=" ".join(x[2] for x in w), wpm=len(w) / (b - a) * 60)
    sus = []
    for n, d in sorted(info.items()):
        mL = np.median([info[j]['f0'] for j in info if j != n and L[j][0] == 'LEO']); mW = np.median([info[j]['f0'] for j in info if j != n and L[j][0] == 'WALTER'])
        mid = (mL + mW) / 2; isL = L[n][0] == 'LEO'
        wrong = ((d['f0'] > mid) != isL) if mL > mW else ((d['f0'] < mid) != isL)
        X = np.array([info[j]['ft'] for j in info]); mu, sd = X.mean(0), X.std(0) + 1e-6; z = lambda j: (info[j]['ft'] - mu) / sd
        cl = {sp: np.mean([z(j) for j in info if j != n and L[j][0] == sp], 0) for sp in ("LEO", "WALTER")}
        cs = {sp: float(np.dot(z(n), c) / np.linalg.norm(z(n)) / np.linalg.norm(c)) for sp, c in cl.items()}
        mw = max(cs, key=cs.get) != L[n][0]; d['mf'] = mw
        wrong = mw or (wrong and False)
        if wrong: sus.append(n + 1)
        print(f"L{n + 1:2d} {L[n][0]:6s} f0={d['f0']:5.0f} wpm={d['wpm']:4.0f} {d['src']:4s} {'<<< SWAP?' if wrong else ''} cos L{cs['LEO']:+.2f} W{cs['WALTER']:+.2f} | {d['words']}")
    print("Leo/Walter median f0:", round(mL), round(mW), "| suspects:", sus)
    if cmd == "build":
        lastn = len(L) - 1; out = []
        for k, idx in enumerate(B):
            w = json.load(open(T / f"B{k}.json")); al = lines_words(w, idx); x = load(T / f"B{k}.mp3")
            cuts = [0.0] + [(w[al[p][1] - 1][1] + w[al[q][0]][0]) / 2 for p, q in zip(idx[:-1], idx[1:])] + [len(x) / SR]
            for c, n in enumerate(idx):
                s = rtrim(n) if info[n]['src'].startswith("R") else trim(tighten(x[int(cuts[c] * SR):int(cuts[c + 1] * SR)]))
                if n == lastn: out.append(g(1.35))
                out += [s, g(.22)]
            out.append(g(.3))
        v = trim(np.concatenate(out)); v = v / np.max(np.abs(v)) * 0.89
        p1 = D / f"voice_{slug}_1x.wav"
        with wave.open(str(p1), "wb") as wv:
            wv.setnchannels(1); wv.setsampwidth(2); wv.setframerate(SR); wv.writeframes((v * 32767).astype("<i2").tobytes())
        subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", str(p1), "-filter:a", "atempo=1.3", "-ar", str(SR), str(D / f"voice_{slug}.wav")], check=True)
        print("voice 1x", round(len(v) / SR, 2), "s -> 1.3x", round(len(v) / SR / 1.3, 2), "s")
        w = asr(D / f"voice_{slug}.wav"); json.dump(w, open(D / f"words_{slug}.json", "w")); print("words", len(w))
