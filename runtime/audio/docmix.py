"""Doc2D mix (mix.py --profile doc). See README.md for the cue format, levels and the music plan.
voice + ambience regions (1.5 s equal-power crossfades, ducked under voice) + action SFX / stingers + music
(per-chapter mood map, track changes snapped to downbeats, sidechain-ducked) + silence beats -> -14 LUFS master + QA gate."""
import json, os, re, subprocess, hashlib, tempfile
import numpy as np, soundfile as sf
from scipy.signal import resample_poly
from dsp import SR, lpf, hpf, lufs, momentary_max, db, st
import ambience, sfx, qa

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
LIB = os.path.join(ROOT, 'video-engine', 'assets', 'music-lib')
XF = 1.5                         # ambience crossfade (s)
AMB_DUCK, PAD_DUCK = 3.0, 8.0    # extra dB pulled from ambience / music while the voice speaks
SIL_FLOOR = -45.0                # dB applied to everything but the voice during a silence beat
PAD_FADE_IN, PAD_FADE_OUT, SWELL = 3.0, 3.5, 4.0
STING = {'hit': (5, 1.6), 'hit_soft': (3, 1.0), 'reveal': (3, 1.5), 'logo': (4, 1.4)}  # bed dip (dB, s) under stingers
CUE_KEYS = ('t', 'kind', 'k', 'gain', 'dur')
DEFAULT_ARC = ['tension', 'investigative', 'calm', 'investigative', 'tension', 'investigative', 'dread', 'calm', 'investigative', 'hopeful']


def seed(*a): return int(hashlib.md5(repr(a).encode()).hexdigest()[:8], 16)


def parse(cues):
    """Split a raw __sfx list into sfx events, ambience regions, music markers and silence beats.
    Ambience regions may carry `t` (shifted by per-chapter merges); then start=t and end=t+(t1-t0).
    `silence_hit` = silence beat of `dur` (0.8) then a `hit` as it ends (the reveal tag)."""
    ev, amb, mus, sil = [], [], [], []
    for c in cues:
        if 'amb' in c:
            t0, t1 = float(c['t0']), float(c['t1'])
            if 't' in c: t0, t1 = float(c['t']), float(c['t']) + (t1 - t0)
            amb.append(dict(c, t0=t0, t1=t1))
        elif 'music' in c: mus.append(c)
        elif 'silence' in c: sil.append(c)
        elif c.get('kind', c.get('k')) == 'silence_hit':
            d = float(c.get('dur', 0.8)); sil.append({'t': c['t'], 'silence': d}); ev.append({'t': c['t'] + d, 'kind': 'hit', 'gain': c.get('gain', 0)})
        elif c.get('kind', c.get('k')) in sfx.GEN: ev.append(dict(c, kind=c.get('kind', c.get('k'))))
        else: print('docmix: skipping unknown cue', c)
    return ev, sorted(amb, key=lambda c: c['t0']), sorted(mus, key=lambda c: c['t']), sil


def voice_activity(v):
    """0..1 smoothed speech activity (attack ~60 ms, release ~500 ms), per sample."""
    H = int(0.02 * SR); fr = len(v) // H
    rms = 20 * np.log10(np.sqrt((v[:fr * H].reshape(fr, H) ** 2).mean(1)) + 1e-9)
    act = (rms > np.percentile(rms, 95) - 22).astype(float); out = np.zeros(fr); s = 0.0
    for i, a in enumerate(act):
        k = 1 - np.exp(-0.02 / (0.06 if a > s else 0.5)); s += (a - s) * k; out[i] = s
    return np.interp(np.arange(len(v)), np.arange(fr) * H + H / 2, out)


def ramp_env(N, pts):
    """Piecewise-linear gain envelope (dB) from [(t, dB), ...]."""
    if not pts: return np.ones(N)
    pts = sorted(pts); return db(np.interp(np.arange(N) / SR, [p[0] for p in pts], [p[1] for p in pts]))


# ------------------------------------------------------------------ structure: chapters, #part endings, endcard
def structure(D, a, vdur, cues):
    """Auto cues from the project's own files (script.txt #part / chapters.json / words.json):
    logo before each chapter opener, a riser into every #part cut, a logo on the endcard, and a mood marker per chapter.
    Anything already cued by hand within 3 s wins."""
    W = _load(f'{D}/words.json'); C = _load(f'{D}/chapters.json'); out = []
    if not W: return out
    have = lambda kind, t: any(c.get('kind') == kind and abs(c['t'] - t) < 4 for c in cues)
    first = lambda line: min((w['s'] for w in W if w['line'] >= line), default=None)
    last_before = lambda line: max((w['e'] for w in W if w['line'] < line), default=None)
    starts = []
    for i, ch in enumerate(C or []):
        s = first(ch['first_line'])
        if s is None: continue
        starts.append(s); pe = last_before(ch['first_line'])
        if i > 0 and pe is not None and not have('logo', s - 1.7): out.append({'t': round(max(pe + 0.15, s - 1.7), 3), 'kind': 'logo', 'auto': 1})
    maxline = max(w['line'] for w in W)
    for line in _part_lines(D):
        if line > maxline: continue          # part break beyond this voice track (trimmed project)
        e = last_before(line)
        if e is not None and not have('riser', e): out.append({'t': round(e + 0.25, 3), 'kind': 'riser', 'dur': 2.6, 'auto': 1})
    if a.endcard_logo and not have('logo', vdur): out.append({'t': round(vdur + 0.3, 3), 'kind': 'logo', 'auto': 1})
    if not any(c.get('music') == 'mood' for c in cues):
        moods = _moods(D, a, len(starts) or 1)
        if moods:
            for i, m in enumerate(moods): out.append({'t': 0.0 if i == 0 else starts[i] - 0.4, 'music': 'mood', 'mood': m, 'auto': 1})
    return out


def _load(p):
    try: return json.load(open(p, encoding='utf8'))
    except (OSError, ValueError): return None


def _part_lines(D):
    """Spoken-line indices that follow each #part marker (same counting as shorts.js: non-empty, non-# lines)."""
    try: L = open(f'{D}/script.txt', encoding='utf8').read().splitlines()
    except OSError: return []
    out, n = [], 0
    for l in L:
        if re.match(r'^#\s*part\b', l, re.I): out.append(n)
        elif l.strip() and not l.lstrip().startswith('#'): n += 1
    return [x for x in out if x > 0]


def _moods(D, a, nch):
    if a.moods: m = a.moods.split(',')
    else:
        j = _load(f'{D}/moods.json')
        if isinstance(j, dict): j = j.get('chapters')
        if j: m = list(j)
        elif a.music == 'none': return []
        else: m = DEFAULT_ARC[:nch - 1] + ['hopeful'] if nch > 1 else ['investigative']
    return (m + [m[-1]] * nch)[:nch]


# ------------------------------------------------------------------ music: mood map, downbeat-snapped changes
def _tracks():
    return [t for t in json.load(open(f'{LIB}/index.json'))['tracks'] if t.get('kind') == 'music' and t.get('licensed')]


def _pick(tr, mood, D, i, prev):
    c = [t for t in tr if t['mood'] == mood and t['id'] not in prev] or [t for t in tr if t['mood'] == mood] or \
        [t for t in tr if t['mood'] in ('investigative', 'calm')]
    return sorted(c, key=lambda t: hashlib.md5(f"{os.path.basename(D)}{i}{t['id']}".encode()).hexdigest())[0]


def music_plan(a, D, mus, N):
    """-> list of segments {start, end, track, mood, entry, grid[]} (timeline seconds) or []."""
    tr = _tracks(); moods = [m for m in mus if m['music'] == 'mood']
    if a.music not in ('auto', 'none', ''):
        rel = os.path.relpath(os.path.abspath(a.music), LIB).replace('\\', '/')
        t = next((t for t in tr if t['file'] == rel), {'file': os.path.abspath(a.music), 'id': rel, 'credit': ''})
        segs = [{'start': moods[0]['t'] if moods else 0.0, 'track': t, 'mood': 'forced'}]
    elif moods:
        segs, prev = [], []
        for i, m in enumerate(moods):
            if segs and segs[-1]['mood'] == m['mood']: continue
            t = _pick(tr, m['mood'], D, i, prev[-2:]); prev.append(t['id']); segs.append({'start': m['t'], 'track': t, 'mood': m['mood']})
    elif any(m['music'] == 'pad_in' for m in mus) and a.music != 'none':
        segs = [{'start': 0.0, 'track': _pick(tr, (a.mood or 'calm').split()[0], D, 0, []), 'mood': a.mood or 'calm'}]
    else: return []
    for i, s in enumerate(segs):
        t = s['track']; s['entry'] = float(t.get('entry') or 0)
        if i:  # snap the change onto the outgoing track's phrase (±3 s) or bar line (±2 s)
            p = segs[i - 1]; off = p['start'] - p['entry']; T = s['start']
            ph = [x + off for x in p['track'].get('phrases', []) if x + off > p['start'] + 4]
            dn = [x + off for x in p['track'].get('downbeats', []) if x + off > p['start'] + 4]
            best = min(ph, key=lambda x: abs(x - T), default=None)
            if best is None or abs(best - T) > 3: best = min(dn, key=lambda x: abs(x - T), default=None)
            if best is not None and abs(best - T) <= 3: s['start'] = round(best, 3)
            s['snap'] = round(s['start'] - T, 2)
    for i, s in enumerate(segs):
        s['end'] = segs[i + 1]['start'] if i + 1 < len(segs) else N / SR
        s['grid'] = [round(x - s['entry'] + s['start'], 3) for x in s['track'].get('downbeats', []) if x >= s['entry'] and s['start'] <= x - s['entry'] + s['start'] < s['end']]
    return segs


def decode(path, start, n):
    r = subprocess.run(['ffmpeg', '-v', 'error', '-stream_loop', '-1', '-ss', str(start), '-i', path, '-t', str(n / SR + 0.1),
                        '-f', 'f32le', '-ac', '2', '-ar', str(SR), '-'], capture_output=True, check=True)
    x = np.frombuffer(r.stdout, np.float32).reshape(-1, 2).T.astype(np.float64)
    return np.pad(x, ((0, 0), (0, max(0, n - x.shape[1]))))[:, :n]


def render_music(segs, mus, N, vL, a):
    P = np.zeros((2, N)); tail = 1.2
    for i, s in enumerate(segs):
        i0 = int(s['start'] * SR); i1 = min(N, int((s['end'] + tail) * SR)); n = i1 - i0
        if n <= 0: continue
        path = s['track']['file'] if os.path.isabs(s['track']['file']) else f"{LIB}/{s['track']['file']}"
        x = lpf(hpf(decode(path, s['entry'], n), 90), 7000); x *= db(vL + a.pad_db - lufs(x))
        k = np.arange(n) / SR
        fin = np.clip(k / (2.5 if i == 0 else 0.06), 0, 1); fout = np.clip((s['end'] + tail - s['start'] - k) / tail, 0, 1) if i + 1 < len(segs) else 1
        P[:, i0:i1] += x * np.sin(fin * np.pi / 2) * np.sin(np.clip(fout, 0, 1) * np.pi / 2)
    on = bool([m for m in mus if m['music'] == 'mood']) or a.music not in ('auto', 'none', '')
    pts = [(0, 0 if on else -120)]
    for m in mus:  # pad_in / pad_out toggle the music on top of the plan
        t = m['t']
        if m['music'] == 'pad_in' and not on: pts += [(t, -120), (t + PAD_FADE_IN, 0)]; on = True
        elif m['music'] == 'pad_out' and on: pts += [(t, 0), (t + PAD_FADE_OUT, -120)]; on = False
    g = ramp_env(N, pts + [(N / SR, pts[-1][1])])
    for m in mus:
        if m['music'] == 'swell':
            w = np.clip((np.arange(N) / SR - m['t']) / SWELL, 0, 1); g *= db(m.get('gain', 5) * np.sin(np.pi * w) ** 2)
    return P * g


PAYOFF_WINDOW = 12.0     # s before the final line in which no transition stinger may play (user rule, 2026-10-19)
TRANSITION = {'hit', 'hit_soft', 'reveal', 'riser', 'whoosh_soft', 'logo'}


def payoff_rule(ev, D, a):
    """No section-change / transition stinger in the run-in to the final payoff: drop hit / hit_soft / reveal / whoosh_soft /
    logo / riser cues from (final line start - 12 s) to the final line's end, plus any riser whose build overlaps that window.
    A silence_hit there keeps its silence and loses its hit. The endcard logo (after the final line) is kept.
    The final line = the last spoken line below 99 (99 is a spoken endcard)."""
    W = _load(f'{D}/words.json')
    if not W or getattr(a, 'payoff_rule', True) is False: return ev
    mx = max(w['line'] for w in W); lines = [w for w in W if w['line'] < 99 or mx > 99] or W; L = max(w['line'] for w in lines)  # line 99 = spoken endcard only when it is the last line (long-forms can have 100+ lines)
    s = min(w['s'] for w in lines if w['line'] == L); e = max(w['e'] for w in lines if w['line'] == L); w0 = s - PAYOFF_WINDOW
    def bad(c):
        if c['kind'] not in TRANSITION: return False
        if c['kind'] == 'riser': return c['t'] > w0 and c['t'] - (c.get('dur') or 3.0) < e
        return w0 <= c['t'] <= e
    drop = [c for c in ev if bad(c)]
    if drop: print(f"docmix: payoff rule -- final line at {s:.1f}s, dropping {len(drop)} transition cue(s):", [(c['kind'], round(c['t'], 1)) for c in drop])
    return [c for c in ev if not bad(c)]


# ------------------------------------------------------------------ main
def run(a, D):
    voice, sr = sf.read(f'{D}/vo/voice.wav', dtype='float64'); voice = voice if voice.ndim == 1 else voice.mean(1)
    if sr != SR: voice = resample_poly(voice, SR, sr)
    raw = json.load(open(a.cues or f'{D}/sfx.json')); vL = lufs(voice); Nv = len(voice)
    late = [c for c in raw if (c.get('t0', c.get('t', 0)) or 0) > Nv / SR + 10]
    if late: print(f'docmix: dropping {len(late)} cues past the voice end (+10 s):', late[:3]); raw = [c for c in raw if c not in late]
    auto = structure(D, a, Nv / SR, raw) if a.structure == 'auto' else []
    ev, amb, mus, sil = parse(raw + auto)
    ev = payoff_rule(ev, D, a)
    ends = [c['t1'] for c in amb] + [c['t'] + min(c.get('dur') or 1, 6) + 3 for c in ev]   # long beds (fire 40 s) are cut by the tail fade, not allowed to stretch the film
    N = int(max(Nv / SR + 1.0, max(ends, default=0)) * SR)
    print(f'docmix: {len(ev)} sfx ({sum(1 for c in auto if "kind" in c)} auto), {len(amb)} amb regions, {len(mus)} music markers, '
          f'{len(sil)} silences; voice {vL:.1f} LUFS')
    va = np.pad(voice_activity(voice), (0, N - Nv))

    A = np.zeros((2, N))
    for c in amb:
        loop = ambience.get(c['amb']); L = loop.shape[1]
        s0 = max(0, c['t0'] - XF / 2); s1 = c['t1'] + XF / 2; i0, n = int(s0 * SR), int((s1 - s0) * SR)
        if i0 >= N: continue
        idx = (seed(c['amb'], c['t0']) % L + np.arange(n)) % L; x = loop[:, idx]; t = s0 + np.arange(n) / SR
        fi = np.clip((t - (c['t0'] - XF / 2)) / XF, 0, 1) if c['t0'] > 0 else np.ones(n)
        fo = np.clip(((c['t1'] + XF / 2) - t) / XF, 0, 1)
        g = np.sin(fi * np.pi / 2) * np.sin(fo * np.pi / 2) * db(vL + a.amb_db - (-23) + c.get('gain', 0))
        b = min(N, i0 + n); A[:, i0:b] += (x * g)[:, :b - i0]
    A *= db(-AMB_DUCK * va)

    S = np.zeros((2, N)); dips = []
    for c in sorted(ev, key=lambda c: c['t']):
        k = c['kind']; prm = {q: v for q, v in c.items() if q not in CUE_KEYS and q != 'auto'}
        x = sfx.make(k, seed(k, c['t']), c.get('dur'), **prm)
        x *= db(vL + a.soft_db + sfx.TRIM.get(k, 0) + c.get('gain', 0) - momentary_max(x))
        i = int(c['t'] * SR) - (x.shape[1] if sfx.ALIGN.get(k) == 'end' else 0)
        if k == 'riser':  # the riser ends on the cut: trim its reverb tail to land exactly at t
            core = int((c.get('dur') or 3.0) * SR); x = x[:, :core]; i = int(c['t'] * SR) - core; dips.append((c['t'], 8, 1.2))
        if k in STING: dips.append((c['t'], *STING[k]))
        a0 = max(0, i); b = min(N, i + x.shape[1])
        if b > a0: S[:, a0:b] += x[:, a0 - i:b - i]

    segs = music_plan(a, D, mus, N); P = render_music(segs, mus, N, vL, a) if segs else np.zeros((2, N))
    P *= db(-PAD_DUCK * va)
    if segs:
        json.dump([{k: (v if k != 'track' else v['id']) for k, v in s.items()} for s in segs], open(f'{D}/music_plan.json', 'w'), indent=1)
        print('music:', ', '.join(f"{s['start']:.1f}s {s['mood']}:{s['track']['id']}" + (f" (snap {s['snap']:+.2f})" if 'snap' in s else '') for s in segs))

    # stingers carve the bed briefly; silence beats drop everything but the voice
    pts = [(0, 0)]
    for t, d_db, dur in sorted(dips): pts += [(t - 0.05, 0), (t, -d_db), (t + dur * 0.3, -d_db), (t + dur, 0)]
    g = ramp_env(N, pts + [(N / SR, 0)]); A *= g; P *= g
    pts = []
    for c in sil:
        t, d = c['t'], c['silence']; pts += [(t - 0.08, 0), (t, SIL_FLOOR), (t + d, SIL_FLOOR), (t + d + 0.4, 0)]
    if pts: g = ramp_env(N, [(0, 0)] + pts + [(N / SR, 0)]); A *= g; S *= g; P *= g
    tail = np.clip((N / SR - np.arange(N) / SR) / 1.5, 0, 1); A *= tail; P *= tail; S *= tail

    for name, x in (('amb', A), ('sfx', S), ('pad', P)): sf.write(f'{D}/{name}.wav', x.T.astype(np.float32), SR, subtype='FLOAT')
    V = st(np.pad(voice, (0, N - Nv)))
    master(V + A + S + P, a, f'{D}/{a.out}')
    credits = sorted({s['track'].get('credit', '') for s in segs} - {''})
    if credits: open(f'{D}/credits.txt', 'w', encoding='utf8').write(''.join('Music: ' + c + '\n' for c in credits))
    print('wrote', f'{D}/{a.out}', '| credits:', len(credits))
    mix = sf.read(f'{D}/{a.out}', dtype='float64')[0].T
    ok, _ = qa.check(mix, a.lufs, V, A + P, S, [(c['t'], c['silence']) for c in sil], f'{D}/qa.json')
    if not ok and a.qa_gate: raise SystemExit('mix QA failed (see qa.json; --no-qa-gate to bypass)')


def master(mix, a, out):
    """Gain-stage to target, 4x-oversampled limiter at -2 dBFS, then two-pass linear loudnorm (-14 / TP -1.5)."""
    mix = mix * db(a.lufs - lufs(mix))
    with tempfile.TemporaryDirectory() as td:
        pre = f'{td}/pre.wav'; sf.write(pre, mix.T.astype(np.float32), SR, subtype='FLOAT')
        lim = 'aresample=192000,alimiter=limit=0.79:attack=2:release=80:level=disabled,aresample=48000'
        r = subprocess.run(['ffmpeg', '-hide_banner', '-y', '-i', pre, '-af', f'{lim},loudnorm=I={a.lufs}:TP=-1.5:LRA=20:print_format=json',
                            '-f', 'null', '-'], capture_output=True, text=True, check=True)
        m = json.loads(r.stderr[r.stderr.rindex('{'):r.stderr.rindex('}') + 1])
        ln = (f"loudnorm=I={a.lufs}:TP=-1.5:LRA=20:linear=true:measured_I={m['input_i']}:measured_TP={m['input_tp']}"
              f":measured_LRA={m['input_lra']}:measured_thresh={m['input_thresh']}:offset={m['target_offset']}:print_format=json")
        r = subprocess.run(['ffmpeg', '-hide_banner', '-y', '-i', pre, '-af', f'{lim},{ln},aresample=48000', '-c:a', 'pcm_s16le', out],
                           capture_output=True, text=True, check=True)
        m2 = json.loads(r.stderr[r.stderr.rindex('{'):r.stderr.rindex('}') + 1])
        print(f"master: {m2['normalization_type']} -> {m2['output_i']} LUFS, TP {m2['output_tp']} dBTP, LRA {m2['output_lra']}")
