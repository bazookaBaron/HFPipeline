"""Stage A (Chatterbox engine): generate N takes per paragraph chunk, cloning the same narrator voice.

C:/Repos/chatterbox-venv/Scripts/python.exe runtime/voice_gen_cb.py <chunks.json> --voice narrator-explainer --takes 4
chunks.json = [{"id", "say", "dir", "dry"?, "stress"?}]; writes <dir>/<id>_t<k>.wav (picked by voice_pick.py in tts-venv).
Takes vary (exaggeration, cfg_weight) across Chatterbox's recommended range: higher exaggeration = more expressive,
lower cfg_weight = slower, more deliberate pacing. "dry": true (a `{dry}` sarcasm line) scales exaggeration by DRY_EX
for a flatter, deadpan read. --speed is accepted for interface parity (Chatterbox has no speed knob).
"""
import argparse, json, os
import torch, torchaudio as ta
from chatterbox.tts import ChatterboxTTS

HERE = os.path.dirname(os.path.abspath(__file__)); VP = os.path.join(os.path.dirname(HERE), "voice-pipeline")
ap = argparse.ArgumentParser(); ap.add_argument("chunks"); ap.add_argument("--voice", default="narrator-explainer")
ap.add_argument("--takes", type=int, default=4); ap.add_argument("--speed", type=float, default=1.0)
a = ap.parse_args()
vdir = os.path.join(VP, "voices", a.voice); prof = json.load(open(os.path.join(vdir, "profile.json")))
ref = os.path.join(vdir, prof["reference_audio"])
GRID = [(0.5, 0.5), (0.6, 0.4), (0.45, 0.5), (0.7, 0.35), (0.55, 0.45), (0.65, 0.4)]
DRY_EX, STRESS_EX = 0.6, 1.25  # tune on the long-form pilot
model = ChatterboxTTS.from_pretrained(device="cuda" if torch.cuda.is_available() else "cpu")
for c in json.load(open(a.chunks, encoding="utf8")):
    for k in range(a.takes):
        out = os.path.join(c["dir"], f"{c['id']}_t{k}.wav")
        if os.path.exists(out):
            continue
        ex, cfg = GRID[k % len(GRID)]
        if c.get("dry"):
            ex *= DRY_EX
        elif c.get("stress"):   # {stress:word}: a touch more expressive for that line
            ex = min(1.0, ex * STRESS_EX)
        torch.manual_seed(1000 + 7919 * k)
        wav = model.generate(c["say"], audio_prompt_path=ref, exaggeration=ex, cfg_weight=cfg)
        ta.save(out, wav, model.sr)
    print("gen", c["id"], c["say"][:60], flush=True)
