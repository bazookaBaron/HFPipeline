set -e
cd /c/Repos/HFPipleine/dialogue/fish
python splice_send.py
ffmpeg -y -v error -i voice_send_1x.wav -af atempo=1.5 -ar 48000 -ac 1 voice_send.wav
/c/Repos/HFPipleine/.venvs/whisper/Scripts/python.exe asr.py voice_send.wav words_send.json
echo ASRDONE
