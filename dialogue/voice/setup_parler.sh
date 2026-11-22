set -e
cd /c/Repos/HFPipleine
.vendor/uv-python/cpython-3.12-windows-x86_64-none/python.exe -m venv .venvs/parler
.venvs/parler/Scripts/python.exe -m pip install -q --upgrade pip
.venvs/parler/Scripts/python.exe -m pip install -q torch torchaudio --index-url https://download.pytorch.org/whl/cu124
.venvs/parler/Scripts/python.exe -m pip install -q git+https://github.com/huggingface/parler-tts soundfile numpy
HF_HOME=/c/Repos/HFPipleine/.vendor/hf-home-parler .venvs/parler/Scripts/python.exe -c "from huggingface_hub import snapshot_download; print(snapshot_download('parler-tts/parler-tts-mini-v1.1'))"
echo SETUP_DONE
