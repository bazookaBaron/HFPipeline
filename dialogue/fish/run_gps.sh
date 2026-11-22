set -e
cd /c/Repos/HFPipleine/dialogue/fish
python voice_tighten_gps.py
ffmpeg -y -v error -i voice_gps_1x.wav -af atempo=1.5 -ar 48000 -ac 1 voice_gps.wav
/c/Repos/HFPipleine/.venvs/whisper/Scripts/python.exe asr.py voice_gps.wav words_gps.json
