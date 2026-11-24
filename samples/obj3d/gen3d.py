"""Prompt -> SDXL product image -> Hunyuan3D-2 mini turbo (ComfyUI native) -> GLB. Standalone test, not a pipeline.
Usage: gen3d.py [name ...]   (default: all OBJECTS)"""
import os, sys, json, time, glob, shutil, threading, subprocess
sys.path.insert(0, r"C:\Repos\HFPipleine\vangogh\tools")
import comfy

HERE = os.path.dirname(os.path.abspath(__file__)); OUT = os.path.join(HERE, "out"); os.makedirs(OUT, exist_ok=True)
COMFY_OUT = os.path.join(comfy.ROOT, "ComfyUI", "output")

OBJECTS = {
    "ship": "a single cable laying ship, white vessel with a large cable drum on the deck and a crane at the stern, bridge at the front, side three-quarter view",
    "worker": "a single faceless smooth art mannequin construction worker wearing a hard hat and overalls, standing, arms at sides, full body, front view",
    "phoneguy": "a single faceless smooth art mannequin of a casual person standing and looking down at a smartphone held in both hands, full body, front view",
    "spool": "a single large wooden cable reel drum with thick cable wound around it, standing upright, three-quarter view",
    "car": "a single small hatchback car, simple rounded shapes, side three-quarter view",
    "leader": "a single faceless smooth art mannequin of a short fat man wearing a long buttoned tunic suit and wide trousers, one hand raised giving a speech, full body, front three-quarter view",
    "soldier": "a single faceless smooth art mannequin dressed as a soldier in a short fitted military tunic jacket, belt, straight trousers, boots and a peaked cap, no coat, no cape, standing stiffly at attention, both arms hanging straight down, hands flat against the thighs, heels together, full body, front view",
    "gun": "a single sci-fi pistol, side three-quarter view",
    "mannequin": "a single standing wooden art mannequin figure, full body, front three-quarter view",
    "burj": "the Burj Khalifa skyscraper alone, very tall slender stepped spire tower, full height visible, no base, front view",
    "dragon": "a single western dragon standing on four legs, thick wings spread, tail curled, no base, side three-quarter view",
    "building": "a single modern mid-rise office building, flat roof with rooftop units, regular grid of windows, front three-quarter view",
}
STYLE = ", low poly faceted, white architectural scale model, matte white plaster material, stylized 3d game asset, isolated on pure white background, centered, entire object visible, soft studio lighting, clean simple shapes"
NEG = "base, pedestal, platform, plinth, ground, island, rocks, background, scenery, floor, shadow, multiple objects, text, watermark, cropped, cut off, blurry"

def wf3d(img, seed, steps, cfg, octree):
    return {
        "1": {"class_type": "ImageOnlyCheckpointLoader", "inputs": {"ckpt_name": "hunyuan3d-dit-v2-mini-turbo.safetensors"}},
        "2": {"class_type": "LoadImage", "inputs": {"image": img}},
        "3": {"class_type": "CLIPVisionEncode", "inputs": {"clip_vision": ["1", 1], "image": ["2", 0], "crop": "none"}},
        "4": {"class_type": "Hunyuan3Dv2Conditioning", "inputs": {"clip_vision_output": ["3", 0]}},
        "5": {"class_type": "EmptyLatentHunyuan3Dv2", "inputs": {"resolution": 3072, "batch_size": 1}},
        "6": {"class_type": "KSampler", "inputs": {"model": ["1", 0], "seed": seed, "steps": steps, "cfg": cfg, "sampler_name": "euler",
              "scheduler": "normal", "positive": ["4", 0], "negative": ["4", 1], "latent_image": ["5", 0], "denoise": 1.0}},
        "7": {"class_type": "VAEDecodeHunyuan3D", "inputs": {"samples": ["6", 0], "vae": ["1", 2], "num_chunks": 8000, "octree_resolution": octree}},
        "8": {"class_type": "VoxelToMesh", "inputs": {"voxel": ["7", 0], "algorithm": "surface net", "threshold": 0.6}},
        "9": {"class_type": "SaveGLB", "inputs": {"mesh": ["8", 0], "filename_prefix": "obj3d/" + img.split(".")[0]}},
    }

class VramPeak(threading.Thread):
    def __init__(s): super().__init__(daemon=True); s.peak = 0; s.go = True
    def run(s):
        while s.go:
            try:
                v = int(subprocess.run(["nvidia-smi", "--query-gpu=memory.used", "--format=csv,noheader,nounits"], capture_output=True, text=True).stdout.split()[0])
                s.peak = max(s.peak, v)
            except Exception: pass
            time.sleep(0.5)

names = sys.argv[1:] or list(OBJECTS)
steps, cfg, octree = int(os.environ.get("STEPS", 10)), float(os.environ.get("CFG", 5.0)), int(os.environ.get("OCTREE", 256))
report = {}
comfy.ensure()
for n in names:
    r = {}
    t0 = time.time()
    img = comfy.run("txt2img", {"ckpt": "sd_xl_base_1.0.safetensors", "lora": 1.0, "pos": OBJECTS[n] + STYLE, "neg": NEG,
                                "w": 1024, "h": 1024, "seed": int(os.environ.get("SEED", 7)), "steps": 8, "cfg": 1.5})[0]
    import numpy as np
    a = np.asarray(img).copy(); a[a.min(-1) > 222] = 255  # pure white background, no off-white texture for the 3D model to copy
    from PIL import Image as _I; img = _I.fromarray(a)
    ip = os.path.join(OUT, n + ".png"); img.save(ip); r["image_s"] = round(time.time() - t0, 1)
    comfy.free()  # drop SDXL before the 3D model
    up = comfy.upload(ip, n + ".png")
    vp = VramPeak(); vp.start(); t1 = time.time()
    comfy.wait(comfy.submit(wf3d(up, 42, steps, cfg, octree)))
    r["mesh_s"] = round(time.time() - t1, 1); vp.go = False; r["vram_peak_mb"] = vp.peak
    g = sorted(glob.glob(os.path.join(COMFY_OUT, "obj3d", n + "*.glb")), key=os.path.getmtime)[-1]
    shutil.copy(g, os.path.join(OUT, n + ".glb")); r["glb_mb"] = round(os.path.getsize(g) / 1e6, 1)
    report[n] = r; print(n, json.dumps(r), flush=True)
    comfy.free()
json.dump(report, open(os.path.join(OUT, "report.json"), "w"), indent=1)
