"""VibeVoice-1.5B one-take narration (experimental A/B engine; not wired into voice.py).

Run with the vibevoice venv, through the queue:
  node runtime/jobq.js --kind voice --prio 5 -- ".venvs/vibevoice/Scripts/python.exe -I runtime/voice_gen_vv.py \
      --text out/bw/voice-ab/url-short.txt --out out/bw/voice-ab/url-short-vibevoice-raw.wav"

The whole text is generated in ONE model.generate call (no chunking / stitching).
The reference wav is fed as the Speaker 1 voice prompt (speech prefill = voice cloning).
Writes <out> (24 kHz mono float wav) and <out>.json with timing / VRAM stats.
"""
import argparse, json, os, sys, time, threading, subprocess

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODEL = os.path.join(ROOT, ".vendor-tts", "models", "VibeVoice-1.5B")
TOK = os.path.join(ROOT, ".vendor-tts", "models", "Qwen2.5-1.5B-tokenizer")
VOICE = os.path.join(ROOT, "voice-pipeline", "voices", "narrator-explainer", "reference.wav")


def smi_poll(stop, peak):
    while not stop.is_set():
        try:
            o = subprocess.run(["nvidia-smi", "--query-gpu=memory.used", "--format=csv,noheader,nounits"],
                               capture_output=True, text=True, timeout=5).stdout.strip().splitlines()
            peak[0] = max(peak[0], int(o[0]))
        except Exception:
            pass
        stop.wait(1.0)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--text", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--voice", default=VOICE)
    ap.add_argument("--model", default=MODEL)
    ap.add_argument("--tokenizer", default=TOK)
    ap.add_argument("--cfg", type=float, default=1.3)
    ap.add_argument("--steps", type=int, default=10, help="DDPM inference steps (demo default 10)")
    ap.add_argument("--quant", choices=["none", "8bit", "4bit"], default="none",
                    help="bitsandbytes quantization of the Qwen LM only (tokenizers/diffusion head stay bf16)")
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("--no-clone", action="store_true", help="disable speech prefill (control run)")
    ap.add_argument("--max-length-times", type=float, default=3.0)
    ap.add_argument("--turns", action="store_true", help="each text line becomes its own Speaker 1 turn (same single generate call)")
    a = ap.parse_args()

    import torch
    from vibevoice.modular.modeling_vibevoice_inference import VibeVoiceForConditionalGenerationInference
    from vibevoice.processor.vibevoice_processor import VibeVoiceProcessor

    torch.manual_seed(a.seed); torch.cuda.manual_seed_all(a.seed)
    raw = open(a.text, encoding="utf-8").read().replace("’", "'")
    if a.turns:  # one "Speaker 1:" turn per non-empty line, still ONE generate call (turn boundaries give sentence/beat pauses)
        script = "\n".join(f"Speaker 1: {' '.join(l.split())}" for l in raw.splitlines() if l.strip())
    else:
        script = f"Speaker 1: {' '.join(raw.split())}"

    stop, peak = threading.Event(), [0]
    th = threading.Thread(target=smi_poll, args=(stop, peak), daemon=True); th.start()

    t0 = time.time()
    # build the processor by hand: the model's preprocessor_config.json hard-codes the hub id Qwen/Qwen2.5-1.5B,
    # we load the tokenizer from the local copy instead (no hub calls at run time)
    from vibevoice.modular.modular_vibevoice_text_tokenizer import VibeVoiceTextTokenizerFast
    from vibevoice.processor.vibevoice_tokenizer_processor import VibeVoiceTokenizerProcessor
    proc = VibeVoiceProcessor(tokenizer=VibeVoiceTextTokenizerFast.from_pretrained(a.tokenizer),
                              audio_processor=VibeVoiceTokenizerProcessor(sampling_rate=24000, normalize_audio=True,
                                                                          target_dB_FS=-25, eps=1e-6),
                              speech_tok_compress_ratio=3200, db_normalize=True)
    kw = dict(torch_dtype=torch.bfloat16, device_map="cuda", attn_implementation="sdpa")
    if a.quant != "none":
        from transformers import BitsAndBytesConfig
        skip = ["acoustic_tokenizer", "semantic_tokenizer", "prediction_head", "acoustic_connector",
                "semantic_connector", "lm_head"]
        kw["quantization_config"] = (BitsAndBytesConfig(load_in_8bit=True, llm_int8_skip_modules=skip)
                                     if a.quant == "8bit" else
                                     BitsAndBytesConfig(load_in_4bit=True, bnb_4bit_quant_type="nf4",
                                                        bnb_4bit_compute_dtype=torch.bfloat16,
                                                        llm_int8_skip_modules=skip))
    model = VibeVoiceForConditionalGenerationInference.from_pretrained(a.model, **kw)
    model.eval(); model.set_ddpm_inference_steps(num_steps=a.steps)
    t_load = time.time() - t0
    print(f"[vv] loaded in {t_load:.1f}s quant={a.quant} vram_alloc={torch.cuda.memory_allocated()/2**30:.2f}GB", flush=True)

    inputs = proc(text=[script], voice_samples=[[a.voice]], padding=True, return_tensors="pt",
                  return_attention_mask=True)
    for k, v in inputs.items():
        if torch.is_tensor(v):
            inputs[k] = v.to("cuda")
    torch.cuda.reset_peak_memory_stats()
    t1 = time.time()
    out = model.generate(**inputs, max_new_tokens=None, cfg_scale=a.cfg, tokenizer=proc.tokenizer,
                         generation_config={"do_sample": False}, verbose=False, is_prefill=not a.no_clone,
                         max_length_times=a.max_length_times)
    t_gen = time.time() - t1
    stop.set()
    audio = out.speech_outputs[0]
    dur = audio.shape[-1] / 24000 if audio is not None else 0
    os.makedirs(os.path.dirname(os.path.abspath(a.out)), exist_ok=True)
    proc.save_audio(audio, output_path=a.out)
    stats = dict(text=a.text, out=a.out, quant=a.quant, cfg=a.cfg, steps=a.steps, seed=a.seed, clone=not a.no_clone,
                 load_s=round(t_load, 1), gen_s=round(t_gen, 1), audio_s=round(dur, 2),
                 rtf=round(t_gen / dur, 2) if dur else None,
                 torch_peak_gb=round(torch.cuda.max_memory_allocated() / 2**30, 2), smi_peak_mb=peak[0],
                 prefill_tokens=int(inputs["input_ids"].shape[1]),
                 generated_tokens=int(out.sequences.shape[1] - inputs["input_ids"].shape[1]))
    json.dump(stats, open(a.out + ".json", "w"), indent=1)
    print("[vv]", json.dumps(stats), flush=True)


if __name__ == "__main__":
    main()
