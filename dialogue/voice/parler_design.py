"""Parler-TTS Mini v1.1 voice design (parler venv). Text descriptions + fixed seeds only (no named speakers).
Writes 2 candidate seeds per option to casting/_cand/ref_<char>_<opt>_s<seed>.wav; pick_refs.py verifies + picks.
Run through jobq: node runtime/jobq.js --kind voice --prio 1 -- <parler python> parler_design.py"""
import json
import os
import sys
import time

os.environ.setdefault("HF_HOME", "C:/Repos/HFPipleine/.vendor/hf-home-parler")
sys.path.insert(0, os.path.dirname(__file__))
import numpy as np
import torch
from common import *
from parler_tts import ParlerTTSForConditionalGeneration
from transformers import AutoTokenizer, set_seed

Q = " Very close-sounding recording, no background noise, very clear audio."
T_SHORT = ("The market opens early on Saturday mornings. Most of the stalls sell vegetables, "
           "and one old shop at the corner sells only tea and biscuits.")
T_MID = ("The market opens early on Saturday mornings. Most of the stalls sell vegetables, a few sell spices, "
         "and one old shop at the corner sells only tea and biscuits.")
T_LONG = ("The market opens early on Saturday mornings. Most of the stalls sell vegetables, a few sell spices, "
          "and one old shop at the corner sells nothing but tea and biscuits to anyone who walks past.")
TEXT = {"dadu": T_SHORT, "rohan": T_LONG, "arjun": T_MID, "meera": T_LONG}
DESC = {
    "dadu": {
        "A": "An elderly Indian man with a deep, warm, slightly gravelly voice, speaking slowly and gently, calm and kind, Indian English accent.",
        "B": "An old Indian man with a low, rough, raspy voice, speaking very slowly with a soft, tender, fatherly tone, Indian English accent.",
        "C": "An elderly Indian man with a mid-low, mellow, slightly breathy voice, speaking slowly and a little wistfully, warm and quiet, Indian English accent."},
    "rohan": {
        "A": "A young Indian man in his early twenties with a light, bright voice, speaking quickly and casually, slightly animated, Indian English accent.",
        "B": "A young Indian man with a mid-pitched, relaxed, slightly nasal voice, speaking fast in a casual, playful way, Indian English accent.",
        "C": "A young Indian man with a higher-pitched, energetic, clear voice, speaking at a fast pace with a teasing, lively tone, Indian English accent."},
    "arjun": {
        "A": "An Indian man in his early thirties with a mid-low, even, dry voice, speaking at a moderate pace in a flat, understated, calm tone, Indian English accent.",
        "B": "An Indian man in his thirties with a low, smooth, slightly husky voice, speaking steadily and quietly, dry and unhurried, Indian English accent.",
        "C": "An Indian man in his thirties with a mid-pitched, crisp, clear voice, speaking at a measured pace in a controlled, deadpan, professional tone, Indian English accent."},
    "meera": {
        "A": "An Indian woman in her early thirties with a clear, warm, confident voice, speaking at a moderate-fast pace, sharp and direct, Indian English accent.",
        "B": "An Indian woman in her thirties with a low, rich, smooth voice, speaking at a steady pace, warm and assured, Indian English accent.",
        "C": "An Indian woman in her thirties with a bright, crisp, slightly higher voice, speaking quickly and expressively, friendly and clear, Indian English accent."},
}
BASE = {"dadu": 1100, "rohan": 1200, "arjun": 1300, "meera": 1400}
NAME = "C:/Repos/HFPipleine/.vendor/parler-tts-mini-v1.1"
dev = "cuda"
model = ParlerTTSForConditionalGeneration.from_pretrained(NAME, torch_dtype=torch.float16).to(dev)
tok = AutoTokenizer.from_pretrained(NAME)
CAND.mkdir(parents=True, exist_ok=True)
logp = CAND / "parler_log.json"
log = json.load(open(logp)) if logp.exists() else {}
for c in CHARS:
    for oi, o in enumerate(OPTS):
        for k in range(2):
            seed = BASE[c] + oi * 10 + k
            out = CAND / f"ref_{c}_{o}_s{seed}.wav"
            if out.exists():
                continue
            desc = DESC[c][o] + Q
            ids = tok(desc, return_tensors="pt").input_ids.to(dev)
            pids = tok(TEXT[c], return_tensors="pt").input_ids.to(dev)
            set_seed(seed)
            t = time.time()
            with torch.no_grad():
                g = model.generate(input_ids=ids, prompt_input_ids=pids, do_sample=True, temperature=1.0)
            a = g.float().cpu().numpy().squeeze()
            a = a / max(1e-6, np.abs(a).max()) * 0.9
            write_wav(out, a, model.config.sampling_rate)
            log[out.name] = {"char": c, "opt": o, "seed": seed, "description": desc, "text": TEXT[c],
                             "gen_s": round(time.time() - t, 1)}
            print(out.name, log[out.name]["gen_s"], "s", flush=True)
            json.dump(log, open(logp, "w"), indent=1)
