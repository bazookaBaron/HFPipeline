"""ComfyUI API-format graph for the MiniMax H3 Singularity V2 Ref2VA recipe.

Verified against ComfyUI master (nodes_minimax_h3.py, nodes_video.py, comfy_api/latest/_io.py) and the
Comfy-Org video_minimax_h3_r2v template. Autogrow inputs use the dotted key "<input id>.<prefix><n>",
e.g. "ref_images.ref_image_0": Autogrow._expand_schema_for_dynamic builds expected_id with finalize_prefix
(".".join) and tests `expected_id in live_inputs`, and live_inputs is the flat API-format inputs dict.
"""
from __future__ import annotations
import hashlib

from ugc.contract import Clip, Tier

REF_IMAGE_SIZE = "match"      # "max" can be several times slower (node tooltip)
SAVE_PREFIX = "video/ugc"


def take_seed(clip_seed: int, take: int) -> int:
    """Deterministic, new for every take, under 2**53 so JSON and JavaScript agree."""
    h = hashlib.sha256(f"{clip_seed}:{take}".encode()).digest()
    return int.from_bytes(h[:8], "big") % (2 ** 53)


def build(clip: Clip, tier: Tier, cfg: dict, prompt: str, sheet_name: str, voice_name: str) -> dict:
    m = cfg["model"]
    g: dict[str, dict] = {}

    def add(nid: str, class_type: str, **inputs) -> list:
        g[nid] = {"class_type": class_type, "inputs": inputs}
        return [nid, 0]

    model = add("unet", "UNETLoader", unet_name=m["unet"], weight_dtype="default")
    for nid, key, strength in (("lora_turbo", "turbo_lora", tier.turbo), ("lora_skin", "skin_lora", tier.skin)):
        if strength > 0:
            model = add(nid, "LoraLoaderModelOnly", model=model, lora_name=m[key], strength_model=strength)
    clip_m = add("clip", "CLIPLoader", clip_name=m["text_encoder"], type="minimax", device="default")
    vae = add("vae", "VAELoader", vae_name=m["video_vae"])
    avae = add("audio_vae", "VAELoader", vae_name=m["audio_vae"])
    img = add("sheet", "LoadImage", image=sheet_name)
    aud = add("voice", "LoadAudio", audio=voice_name)
    cond = add("cond", "MiniMaxH3ReferenceToVideo", **{
        "clip": clip_m, "vae": vae, "audio_vae": avae, "prompt": prompt,
        "width": tier.width, "height": tier.height, "length": m["frames"],
        "ref_image_size": REF_IMAGE_SIZE,
        "ref_images.ref_image_0": img, "ref_audios.ref_audio_0": aud})
    latent = ["cond", 1]
    guider = add("guider", "BasicGuider", model=model, conditioning=cond)
    noise = add("noise", "RandomNoise", noise_seed=clip.seed)
    sampler = add("sampler", "KSamplerSelect", sampler_name="euler")
    sigmas = add("sigmas", "BasicScheduler", model=model, scheduler="beta", steps=tier.steps, denoise=1)
    out = add("sample", "SamplerCustomAdvanced", noise=noise, guider=guider, sampler=sampler, sigmas=sigmas, latent_image=latent)
    frames = add("decode", "VAEDecode", samples=out, vae=vae)
    sound = add("decode_audio", "VAEDecodeAudio", samples=out, vae=avae)
    video = add("video", "CreateVideo", images=frames, fps=m["fps"], audio=sound)
    add("save", "SaveVideo", video=video, filename_prefix=SAVE_PREFIX, format="mp4", codec="auto", **{"format.codec": "auto"})
    return g
