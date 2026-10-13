"""Stage A (F5 engine): generate N takes per paragraph chunk.

C:/Repos/tts-venv/Scripts/python.exe runtime/voice_gen_f5.py <chunks.json> --voice narrator-explainer --takes 4 --speed 1.0
chunks.json = [{"id", "say", "dir"}]; writes <dir>/<id>_t<k>.wav. Picking/aligning/splitting is voice_pick.py.
The reference gets a 0.5 s silent tail so the first/last generated words aren't swallowed.
"""
import argparse, json, os, sys, tempfile
from contextlib import redirect_stdout
import numpy as np, soundfile as sf

HERE = os.path.dirname(os.path.abspath(__file__)); VP = os.path.join(os.path.dirname(HERE), "voice-pipeline")
sys.path.insert(0, VP)
ap = argparse.ArgumentParser(); ap.add_argument("chunks"); ap.add_argument("--voice", default="narrator-explainer")
ap.add_argument("--takes", type=int, default=4); ap.add_argument("--speed", type=float, default=1.0); ap.add_argument("--nfe", type=int, default=32)
a = ap.parse_args()
vdir = os.path.join(VP, "voices", a.voice); prof = json.load(open(os.path.join(vdir, "profile.json")))
from tts_worker import VoiceWorker  # same F5 load path as the worker (transformers stub)
W = VoiceWorker()
with redirect_stdout(sys.stderr):
    W._load()
x, sr = sf.read(os.path.join(vdir, prof["reference_audio"])); x = x if x.ndim == 1 else x.mean(1)
ref = os.path.join(tempfile.mkdtemp(prefix="f5ref_"), "ref.wav"); sf.write(ref, np.concatenate([x, np.zeros(int(0.5 * sr))]), sr)
for c in json.load(open(a.chunks, encoding="utf8")):
    for k in range(a.takes):
        out = os.path.join(c["dir"], f"{c['id']}_t{k}.wav")
        if os.path.exists(out):
            continue
        with redirect_stdout(sys.stderr):
            W.f5.infer(ref_file=ref, ref_text=prof["reference_text"], gen_text=c["say"], file_wave=out,
                       speed=a.speed, nfe_step=a.nfe, seed=1000 + 7919 * k, remove_silence=False)
    print("gen", c["id"], c["say"][:60], flush=True)
