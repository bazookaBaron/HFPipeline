"""Standalone 2.5D set sample: generate candidate set plates with local ComfyUI SDXL (no pipeline integration)."""
import os, sys, json
sys.path.insert(0, r"C:\Repos\HFPipleine\vangogh\tools")
import comfy

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "plates")
os.makedirs(OUT, exist_ok=True)

POS = ("stylized 3d animated film still, narrow old asian night market street after rain, "
       "wet cobblestone road with colourful reflections, glowing paper lanterns strung overhead, "
       "warm neon shop signs, food stalls with steam, hanging cables, potted plants, "
       "street receding into soft blue fog, empty clear foreground street, eye level wide shot, "
       "cinematic lighting, teal and orange palette, rich detail, octane render, pixar style environment")
NEG = ("people, person, crowd, character, text, watermark, logo, letters, blurry, lowres, "
       "deformed, photo, grainy, oversaturated, frame, border")

seeds = [int(s) for s in sys.argv[1:]] or [11, 23, 37, 41]
for s in seeds:
    imgs = comfy.run("txt2img", {"ckpt": "sd_xl_base_1.0.safetensors", "lora": 1.0, "pos": POS, "neg": NEG,
                                 "w": 1344, "h": 768, "seed": s, "steps": 8, "cfg": 1.5})
    p = os.path.join(OUT, f"cand_{s}.png"); imgs[0].save(p); print("wrote", p, flush=True)
comfy.free()
