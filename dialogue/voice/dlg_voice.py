"""Per-line dialogue synthesis with Fun-CosyVoice3 inference_instruct2 (CosyVoice venv).

Same model/paths as the installed engine (.vendor/engines/CosyVoice, Fun-CosyVoice3-0.5B). The Qwen load/cache
repairs are imported (read-only) from the VoiceStudio sidecar (.vendor/voicestudio).

Instruct format (example.py / sidecar _instruct):  "You are a helpful assistant. <instruction><|endofprompt|>"

  dlg_voice.py batch  <manifest.json>                 items: {out,text,tag?,note?,instruct?,ref,seed}
  dlg_voice.py render <script.md> <out_dir> <voices>  voices e.g. dadu=refs/dadu_A.wav,rohan=refs/rohan_A.wav
        [--seeds 3]   -> out_dir/manifest.json + candidate wavs; dialogue_mix.py picks takes + mixes.
Run GPU work through jobq:  node runtime/jobq.js --kind voice --prio 1 -- <cosy python> dlg_voice.py ...
"""
import importlib.util
import json
import os
import re
import sys
import time

CHECKOUT = "C:/Repos/HFPipleine/.vendor/engines/CosyVoice"
MODEL_DIR = CHECKOUT + "/pretrained_models/Fun-CosyVoice3-0.5B"
SIDECAR = "C:/Repos/HFPipleine/.vendor/voicestudio/backend/engines/cosyvoice_subprocess/main.py"
SYSTEM_PROMPT = "You are a helpful assistant."
EOP = "<|endofprompt|>"

# emotion tag -> English instruction (CosyVoice 3 understands natural-language style directions)
EMOTION = {
    "warm": "Speak in a warm, kind, gentle voice.",
    "amused": "Speak in an amused, lightly teasing voice, as if suppressing a smile.",
    "annoyed": "Speak in an annoyed, mildly irritated voice, a little clipped.",
    "curious": "Speak in a curious, interested voice with a rising, questioning energy.",
    "thinking": "Speak slowly in a thoughtful, hesitant voice, as if working something out.",
    "surprised": "Speak in a surprised, astonished voice with a sudden lift in pitch.",
    "tender": "Speak in a soft, tender, affectionate voice, almost a whisper.",
    "laugh": "Speak while laughing, in an amused, incredulous voice, with a laugh in the words.",
    "flat": "Speak in a flat, deadpan, emotionless monotone.",
    "heavy": "Speak in a heavy, weary, sad voice, with a sigh.",
    "firm": "Speak in a firm, steady, decisive voice.",
    "worried": "Speak in a worried, anxious, slightly tense voice.",
    # user 2026-11-09: deep-talk registers
    "sad": "Speak in a quiet, sad voice, low and slow, holding back emotion.",
    "hesitant": "Speak hesitantly, with small pauses and unsure starts, as if afraid to say it.",
    "tired": "Speak in a tired, drained, low-energy voice, slow, with a soft exhale.",
    "emotional": "Speak with emotion close to the surface, voice slightly unsteady, as if near tears but holding it together.",
    "reflective": "Speak softly and reflectively, as if remembering something far away.",
    "vulnerable": "Speak softly and openly, a little fragile, like admitting something for the first time.",
}
# fixed character pace/timbre hints (spec: dadu 120-140 wpm, rohan 160-185, arjun 150-165, meera 160-175)
CHAR_HINT = {
    "dadu": "Speak slowly, in the voice of a calm elderly man.",
    "rohan": "Speak quickly and casually, like a young man.",
    "arjun": "Speak at a measured, even pace.",
    "meera": "Speak clearly and briskly, with confidence.",
}


def build_instruct(tag=None, note=None, char=None, use_char_hint=True):
    parts = []
    if use_char_hint and char in CHAR_HINT:
        parts.append(CHAR_HINT[char])
    for t in (tag or "").split(","):
        t = t.strip().lower()
        if t in EMOTION:
            parts.append(EMOTION[t])
    if note:
        parts.append(note.strip().rstrip(".") + ".")
    return f"{SYSTEM_PROMPT} {' '.join(parts) or 'Speak naturally.'}{EOP}"


# ---------------------------------------------------------------- script parsing (no torch)
LINE_RE = re.compile(r"^([A-Z][A-Z_]+)\s*(?:\(([^)]*)\))?\s*:\s*(.+)$")


def parse_script(path):
    """-> list of {char, tags, note, pause, text, interrupted}. Skips headings, [[mg]], #end, bullets."""
    out = []
    for raw in open(path, encoding="utf8"):
        m = LINE_RE.match(raw.strip())
        if not m:
            continue
        who, meta, text = m.group(1).lower(), m.group(2) or "", m.group(3)
        tags, pause, note = [], None, []
        for p in [s.strip() for s in meta.split(",") if s.strip()]:
            if p.startswith("pause="):
                pause = float(p[6:])
            elif p in EMOTION:
                tags.append(p)
            else:
                note.append(p)
        text = re.sub(r"\[\[.*?\]\]", "", text).replace("*", "").strip()
        interrupted = text.endswith("-") and not text.endswith("--")
        text = text.rstrip("-").strip()
        text = re.sub(r"([?!.])-\s", r"\1 ", text)
        if text:
            out.append({"char": who, "tags": ",".join(tags), "note": ", ".join(note), "pause": pause,
                        "text": text, "interrupted": interrupted})
    return out


# ---------------------------------------------------------------- model
_model = None


def load_model():
    global _model
    if _model is not None:
        return _model
    os.environ["OMNIVOICE_COSYVOICE_DIR"] = CHECKOUT
    os.environ["MODELSCOPE_CACHE"] = "C:/Repos/HFPipleine/.vendor/hf-home/modelscope"
    os.environ["HF_HOME"] = "C:/Repos/HFPipleine/.vendor/hf-home"
    os.environ["HF_HUB_OFFLINE"] = "1"
    for p in (CHECKOUT + "/third_party/Matcha-TTS", CHECKOUT):
        if p not in sys.path:
            sys.path.insert(0, p)
    spec = importlib.util.spec_from_file_location("cosy_sidecar", SIDECAR)
    sc = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(sc)  # only stdlib imports at module level
    from cosyvoice.cli.cosyvoice import AutoModel
    with sc._qwen_full_precision_load():
        m = AutoModel(model_dir=MODEL_DIR)
    sc._repair_qwen_cache(m)
    _model = m
    return m


def synth(text, instruct, ref_wav, seed, out_path):
    """One line -> 24 kHz mono int16 wav. Returns (seconds_audio, seconds_gen)."""
    import numpy as np
    import torch
    import wave
    m = load_model()
    torch.manual_seed(int(seed))
    t = time.time()
    chunks = [c["tts_speech"] for c in m.inference_instruct2(text, instruct, ref_wav, stream=False)]
    wav = torch.cat(chunks, dim=1).squeeze(0).float().cpu().numpy()
    sr = int(getattr(m, "sample_rate", 24000))
    if sr != 24000:
        import torchaudio
        wav = torchaudio.functional.resample(torch.from_numpy(wav), sr, 24000).numpy()
    pcm = (np.clip(wav, -1, 1) * 32767).astype("<i2")
    with wave.open(str(out_path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(24000)
        w.writeframes(pcm.tobytes())
    return len(pcm) / 24000, time.time() - t


def run_batch(items):
    meta = []
    for it in items:
        if os.path.exists(it["out"]) and not it.get("force"):
            continue
        ins = it.get("instruct") or build_instruct(it.get("tag"), it.get("note"), it.get("char"))
        os.makedirs(os.path.dirname(it["out"]), exist_ok=True)
        a, g = synth(it["text"], ins, it["ref"], it["seed"], it["out"])
        it.update(audio_s=round(a, 2), gen_s=round(g, 2), instruct_used=ins)
        meta.append(it)
        print(f"{os.path.basename(it['out'])}  audio={a:.1f}s gen={g:.1f}s", flush=True)
    return meta


def main():
    if len(sys.argv) < 3:
        sys.exit(__doc__)
    cmd = sys.argv[1]
    if cmd == "batch":
        items = json.load(open(sys.argv[2]))
        done = run_batch(items)
        json.dump(items, open(sys.argv[2], "w"), indent=1)
    elif cmd == "render":
        script, outdir, voices = sys.argv[2], sys.argv[3], sys.argv[4]
        seeds = int(sys.argv[sys.argv.index("--seeds") + 1]) if "--seeds" in sys.argv else 3
        vmap = dict(v.split("=", 1) for v in voices.split(","))
        lines = parse_script(script)
        items = []
        for i, ln in enumerate(lines):
            for s in range(seeds):
                items.append({"line": i, "char": ln["char"], "text": ln["text"], "tag": ln["tags"], "note": ln["note"],
                              "ref": vmap[ln["char"]], "seed": 7000 + i * 10 + s,
                              "out": f"{outdir}/l{i:02d}_s{s}.wav"})
        os.makedirs(outdir, exist_ok=True)
        json.dump({"script": script, "lines": lines, "items": items}, open(f"{outdir}/manifest.json", "w"), indent=1)
        run_batch(items)
        json.dump({"script": script, "lines": lines, "items": items}, open(f"{outdir}/manifest.json", "w"), indent=1)


if __name__ == "__main__":
    main()
