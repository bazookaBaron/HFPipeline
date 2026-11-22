"""CosyVoice venv: speaker embeddings with CosyVoice's bundled campplus.onnx.
usage: embed.py <in.json: [wav paths]> <out.json: {path: [192 floats]}>"""
import json
import sys

import numpy as np
import onnxruntime
import torch
import torchaudio
import torchaudio.compliance.kaldi as kaldi

ONNX = "C:/Repos/HFPipleine/.vendor/engines/CosyVoice/pretrained_models/Fun-CosyVoice3-0.5B/campplus.onnx"
so = onnxruntime.SessionOptions()
so.intra_op_num_threads = 1
sess = onnxruntime.InferenceSession(ONNX, sess_options=so, providers=["CPUExecutionProvider"])
out = {}
for p in json.load(open(sys.argv[1])):
    wav, sr = torchaudio.load(p)
    wav = wav.mean(0, keepdim=True)
    if sr != 16000:
        wav = torchaudio.functional.resample(wav, sr, 16000)
    feat = kaldi.fbank(wav, num_mel_bins=80, dither=0, sample_frequency=16000)
    feat = feat - feat.mean(dim=0, keepdim=True)
    e = sess.run(None, {sess.get_inputs()[0].name: feat.unsqueeze(0).numpy()})[0].flatten()
    out[p] = (e / np.linalg.norm(e)).tolist()
json.dump(out, open(sys.argv[2], "w"))
print("embedded", len(out))
