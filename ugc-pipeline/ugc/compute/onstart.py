"""The script a rented machine runs at boot: install pinned ComfyUI, fetch models, start ComfyUI on
127.0.0.1 only, and run a dead-man switch that destroys the machine by itself.

Image: vastai/pytorch 2.9.1 + CUDA 13 wheels (cu130), py3.12, dated tag. Blackwell (RTX 50) needs CUDA 12.8+;
the Comfy-Org model card recommends cu130 for the int8 weights. Hosts are filtered by cuda_max_good >= 13.
ComfyUI v0.46.3 (commit below, checked with `git ls-remote`; its supported_models.py has MiniMaxH3).

Dead-man switch, what it guarantees and what it does not:
 + In a running container it destroys the machine (DELETE /api/v0/instances/<id> with the per-instance
   CONTAINER_API_KEY that Vast injects) at the hard wall-clock limit, after `idle_minutes` with an empty
   ComfyUI queue, if setup fails, or if ComfyUI is not up after the setup limit. If destroy is refused it
   tries stop, then keeps retrying every minute and kills ComfyUI so the GPU idles.
 - It cannot help while the container is not running (image pull, host offline, onstart never ran), if the
   host cannot reach console.vast.ai, or if the container key lacks destroy rights (stop still bills storage).
   The Mac-side destroy, `reap`, and the account balance are the other layers.
"""
from __future__ import annotations
import base64
import gzip

COMFY_TAG = "v0.46.3"
COMFY_COMMIT = "cab5f4e13b83c58482cd514afb22ca925e117638"
IMAGE = "vastai/pytorch:2.9.1-cu130-cuda-13.2-mini-py312-2026-11-20"
LIMIT = 4048
SETUP_LIMIT_S = 5400

# file name -> (repo, pinned revision, path in repo, ComfyUI models subfolder, exact bytes); from the HF API (blobs=true)
FILES = {
    "Minimax-h3_Singularity_ref2va_v2_pruned_int8.safetensors": ("WarmBloodAban/Minimax-h3_Singularity", "1259cf16cd0b655ba691a32fb46a409142762972", "Minimax-h3_Singularity_ref2va_v2_pruned_int8.safetensors", "diffusion_models", 20967647456),
    "qwen3vl_32b_minimax_h3_nvfp4_awq.safetensors": ("Comfy-Org/MiniMax-H3", "4b53a35191437de05370da548e59aeabe2a5a09a", "text_encoders/qwen3vl_32b_minimax_h3_nvfp4_awq.safetensors", "text_encoders", 15687142551),
    "minimax_h3_video_vae_fp16.safetensors": ("Comfy-Org/MiniMax-H3", "4b53a35191437de05370da548e59aeabe2a5a09a", "vae/minimax_h3_video_vae_fp16.safetensors", "vae", 5207808496),
    "minimax_h3_audio_vae_fp32.safetensors": ("Comfy-Org/MiniMax-H3", "4b53a35191437de05370da548e59aeabe2a5a09a", "vae/minimax_h3_audio_vae_fp32.safetensors", "vae", 605254808),
    "minimax_h3_ref2v_turbo_4step_v0.1_comfyui_bf16.safetensors": ("Comfy-Org/MiniMax-H3", "4b53a35191437de05370da548e59aeabe2a5a09a", "loras/minimax_h3_ref2v_turbo_4step_v0.1_comfyui_bf16.safetensors", "loras", 1956193000),
    "minimax-h3-facial-realism-closeup-cp2000.safetensors": ("prithivMLmods/MiniMax-H3-Facial-Realism-CloseUp", "c89656bd0cb71873133dd2c7a925f306a21c633c", "minimax-h3-facial-realism-closeup-cp2000.safetensors", "loras", 74570624),
}
MODEL_KEYS = ("unet", "text_encoder", "video_vae", "audio_vae", "turbo_lora", "skin_lora")

DEADMAN = r'''API=https://console.vast.ai;K=${CONTAINER_API_KEY:-};ID=${CONTAINER_ID:-};up=0;last=$T0
die(){ echo "$(date -u +%FT%TZ) deadman: $1";pkill -f 'main.py --listen'
while :;do
if [ -n "$K" ]&&[ -n "$ID" ];then
for p in "" "/";do curl -fsS -m 30 -X DELETE -H "Authorization: Bearer $K" "$API/api/v0/instances/$ID$p"&&{ echo destroy requested;sleep 600;};done
curl -fsS -m 30 -X PUT -H "Authorization: Bearer $K" -H 'Content-Type: application/json' -d '{"state":"stopped"}' "$API/api/v0/instances/$ID"&&echo stop requested
else echo "no instance credentials: cannot stop billing";fi
sleep 60;done;}
step(){
now=$(date +%s);el=$((now-T0))
[ -e /workspace/SETUP_FAILED ]&&die "setup failed"
[ $el -ge $MAXS ]&&die "hard limit ${MAXS}s"
n=$(curl -fsS -m 5 http://127.0.0.1:8188/queue 2>/dev/null|python -c 'import json,sys;d=json.load(sys.stdin);print(len(d["queue_running"])+len(d["queue_pending"]))' 2>/dev/null)
if [ -n "$n" ];then [ $up = 0 ]&&{ up=1;last=$now;};[ "$n" != 0 ]&&last=$now
elif [ $up = 1 ]&&pgrep -f 'main.py --listen' >/dev/null;then last=$now;fi
[ $up = 1 ]&&[ $((now-last)) -ge $IDLES ]&&die "idle ${IDLES}s"
[ $up = 0 ]&&[ $el -ge $SETUPS ]&&die "ComfyUI not up after ${SETUPS}s"
}
[ -n "${DM_TEST:-}" ]||while :;do step;sleep 20;done
'''

HEAD = r'''#!/bin/bash
W=/workspace;mkdir -p $W/models;exec >>$W/setup.log 2>&1
[ -x /venv/main/bin/python ]&&export PATH=/venv/main/bin:$PATH
for v in CONTAINER_API_KEY CONTAINER_ID;do [ -n "${!v:-}" ]||export "$v=$(tr '\0' '\n' </proc/1/environ|sed -n "s/^$v=//p")";done
[ -n "${CONTAINER_ID:-}" ]||export CONTAINER_ID=${VAST_CONTAINERLABEL#C.}
[ -n "${CONTAINER_API_KEY:-}" ]||export CONTAINER_API_KEY=$(cat ~/.vast_api_key 2>/dev/null)
cat >/root/deadman.sh <<'EOF'
@DEADMAN@EOF
T0=$(date +%s) MAXS=@MAXS@ IDLES=@IDLES@ SETUPS=@SETUPS@ setsid nohup bash /root/deadman.sh >>$W/deadman.log 2>&1 </dev/null &
fail(){ echo "setup failed: $1";touch $W/SETUP_FAILED;exit 1;}
[ "$(df -BG --output=avail $W|tail -1|tr -dc 0-9)" -ge @DISKG@ ]||fail "less than @DISKG@ GB free"
command -v aria2c >/dev/null||timeout 180 sh -c 'apt-get update -qq&&apt-get install -y -qq aria2'
dl(){ f=$W/models/$4/$(basename $3);u=https://huggingface.co/$1/resolve/$2/$3;mkdir -p $(dirname $f)
for i in 1 2 3 4 5 6;do
[ "$(stat -c%s $f 2>/dev/null||echo 0)" = $5 ]&&return 0
[ "$(stat -c%s $f.part 2>/dev/null||echo 0)" -gt $5 ]&&rm -f $f.part $f.part.aria2
if command -v aria2c >/dev/null;then aria2c -c -x8 -s8 -k16M --file-allocation=none --console-log-level=warn --summary-interval=0 -d $(dirname $f) -o $(basename $f).part $u
else curl -fsSL -C - --retry 3 -o $f.part $u;fi
[ "$(stat -c%s $f.part 2>/dev/null||echo 0)" = $5 ]&&mv $f.part $f&&rm -f $f.part.aria2
sleep 3;done
[ "$(stat -c%s $f 2>/dev/null||echo 0)" = $5 ];}
P=""
'''

TAIL = r'''cd $W
if [ "$(git -C ComfyUI rev-parse HEAD 2>/dev/null)" != @COMMIT@ ];then
mkdir -p ComfyUI&&cd ComfyUI&&git init -q&&git remote add origin https://github.com/comfyanonymous/ComfyUI.git 2>/dev/null
git fetch -q --depth 1 origin @COMMIT@&&git checkout -q -f FETCH_HEAD;cd $W;fi
[ "$(git -C ComfyUI rev-parse HEAD)" = @COMMIT@ ]||fail "ComfyUI is not at @COMMIT@"
pip freeze 2>/dev/null|grep -iE '^(torch|torchvision|torchaudio)=='>/tmp/pins.txt
pip install -q -r ComfyUI/requirements.txt -c /tmp/pins.txt||fail "pip install"
F=0;for p in $P;do wait $p||F=1;done
[ $F = 0 ]||fail "a model download failed or has the wrong size"
cd ComfyUI&&setsid nohup python main.py --listen 127.0.0.1 --port 8188 --disable-auto-launch --models-directory $W/models >>$W/comfy.log 2>&1 </dev/null &
for i in $(seq 90);do curl -fsS -m 3 http://127.0.0.1:8188/system_stats >/dev/null 2>&1&&{ touch $W/READY;exit 0;};sleep 2;done
fail "ComfyUI did not start"
'''


def model_files(cfg: dict) -> list[tuple[str, tuple]]:
    out = []
    for k in MODEL_KEYS:
        name = cfg["model"][k]
        if name not in FILES:
            raise ValueError(f"model.{k} = {name!r} has no pinned source or size; add it to FILES in ugc/compute/onstart.py")
        out.append((name, FILES[name]))
    return out


def total_bytes(cfg: dict) -> int:
    return sum(f[1][4] for f in model_files(cfg))


def full_script(cfg: dict, max_hours: float) -> str:
    dls = "".join(f"dl {r} {rev} {path} {dest} {size}&P=\"$P $!\"\n" for _, (r, rev, path, dest, size) in model_files(cfg))
    free_gb = int(total_bytes(cfg) / 1e9) + 10
    head = (HEAD.replace("@DEADMAN@", DEADMAN).replace("@MAXS@", str(int(max_hours * 3600)))
            .replace("@IDLES@", str(int(cfg["budget"]["idle_minutes"] * 60))).replace("@SETUPS@", str(SETUP_LIMIT_S))
            .replace("@DISKG@", str(free_gb)))
    return head + dls + TAIL.replace("@COMMIT@", COMFY_COMMIT)


def script(cfg: dict, max_hours: float | None = None) -> str:
    """onstart text, at most 4048 characters: plain if it fits, else gzip+base64 wrapped (documented Vast limit)."""
    text = full_script(cfg, 12.0 if max_hours is None else max_hours)
    if len(text) <= LIMIT:
        return text
    b64 = base64.b64encode(gzip.compress(text.encode(), 9, mtime=0)).decode()
    wrapped = f"#!/bin/bash\necho {b64}|base64 -d|gunzip >/root/ugc_setup.sh\nbash /root/ugc_setup.sh\n"
    if len(wrapped) > LIMIT:
        raise ValueError(f"onstart is {len(wrapped)} characters even compressed; the Vast limit is {LIMIT}. Shorten ugc/compute/onstart.py")
    return wrapped
