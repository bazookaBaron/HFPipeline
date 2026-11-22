"""indextts venv: proof test - can IndexTTS2 (timbre from our prompt, emotion from a separate source) carry the
reference expression that OmniVoice cannot?  usage: idx_proof.py <remake dir, e.g. dialogue/voice/remake/A>
 b = emo_audio_prompt = the reference turn clip (remake-only route: copies the acted emotion)
 c = emo_vector per role (production route, no reference needed)
Writes <dir>/idx_proof/t##_{b,c}.wav and proof_abab.wav (ref | omnivoice pick | b | c per line)."""
import json, os, sys, time
import numpy as np, soundfile as sf, librosa

os.environ.setdefault("HF_HOME", "C:/Repos/HFPipleine/.vendor/hf-home")
HF = "C:/Repos/HFPipleine"; ENG = HF + "/.vendor/engines/index-tts"; CB = HF + "/dialogue/voice/clone_bakeoff"
D = os.path.abspath(sys.argv[1]); O = D + "/idx_proof"; os.makedirs(O, exist_ok=True)
cfg = json.load(open(D + "/lines.json", encoding="utf-8"))
REF = json.load(open(cfg["ref_turns"])); TURN = {t["turn"]: t for t in REF["turns"]}
picks = json.load(open(D + "/picks.json"))["picks"]
VD = json.load(open(CB + "/voice_defaults.json"))
TURNS = [int(x) for x in os.environ.get("TURNS", "3,8,9,13,17,18").split(",")]
# emo vector order: happy, angry, sad, afraid, disgusted, melancholic, surprised, calm
VEC = {"USER": [0, 0, 0, 0.45, 0, 0, 0.55, 0], "CLAUDE": [0, 0, 0, 0, 0, 0.15, 0, 0.75]}
sr = 24000
ref, _ = librosa.load(cfg["ref_turns"].replace(".turns.json", ".48k.wav"), sr=sr)
lines = {ln["turn"]: ln for ln in cfg["lines"]}

os.chdir(ENG); sys.path.insert(0, ENG)
from indextts.infer_v2_5 import IndexTTS2  # noqa: E402
m = IndexTTS2(cfg_path=ENG + "/checkpoints/config.yaml", model_dir=ENG + "/checkpoints", use_bf16=True,
              use_cuda_kernel=False, use_deepspeed=False, use_qwen_emo=False)
for tn in TURNS:
    t = TURN[tn]; role = t["role"]; spk = CB + "/" + VD[cfg["voices"][role]]["ref_wav"]; text = lines[tn]["v"][0]
    clip = f"{O}/ref_t{tn:02d}.wav"
    sf.write(clip, ref[int(t["start"] * sr):int(t["end"] * sr)], sr)
    for tag, kw in (("b", {"emo_audio_prompt": clip, "emo_alpha": 0.9}), ("c", {"emo_vector": VEC[role], "emo_alpha": 1.0})):
        out = f"{O}/t{tn:02d}_{tag}.wav"
        if os.path.exists(out):
            continue
        t0 = time.time()
        m.infer(spk_audio_prompt=spk, text=text, output_path=out, lang="EN", verbose=False, **kw)
        print(f"t{tn:02d} {tag} {time.time() - t0:.0f}s", flush=True)


def norm(x):
    return x / (np.percentile(np.abs(x), 99.5) + 1e-6) * 0.5


ab = []
gap = lambda s: np.zeros(int(s * sr), np.float32)
for tn in TURNS:
    t = TURN[tn]
    seq = [ref[int(t["start"] * sr):int(t["end"] * sr)], librosa.load(f"{D}/takes/{picks[str(tn)]['take']}", sr=sr)[0]]
    seq += [librosa.load(f"{O}/t{tn:02d}_{k}.wav", sr=sr)[0] for k in "bc"]
    for x in seq:
        ab += [norm(x), gap(0.4)]
    ab.append(gap(0.8))
sf.write(f"{O}/proof_abab.wav", np.concatenate(ab), sr)
print("wrote", f"{O}/proof_abab.wav", flush=True)
