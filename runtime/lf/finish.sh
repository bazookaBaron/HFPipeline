#!/bin/bash
# Usage (from repo root): bash runtime/lf/finish.sh out/longform/<slug> <themeId>
# Zero-LLM finishing: voice gates -> inject __sfx -> sfxmerge -> mix -> stitch -> outro -> concat -> pad to the next
# whole second -> 720p copy. Env: TTS_PY (tts-venv python), PROSODY_MAX (default 2.0), SKIP_VOICE_GATES=1 (re-finish only).
set -e
P="$1"; THEME="$2"; R="$(cd "$(dirname "$0")/../.." && pwd)"; cd "$R"
TTS_PY="${TTS_PY:-C:/Repos/tts-venv/Scripts/python.exe}"; PROSODY_MAX="${PROSODY_MAX:-2.0}"
# pad_to_second <seconds>: padding that rounds the length up to the next whole second (0 if already whole)
pad_to_second() { python -c "import math,sys;d=float(sys.argv[1]);p=math.ceil(d-1e-3)-d;print(round(p,3) if p>1e-3 else 0)" "$1"; }
[ "$PAD_ONLY" ] && { pad_to_second "$PAD_ONLY"; exit 0; }
if [ -z "$SKIP_VOICE_GATES" ]; then
  VC=$("$TTS_PY" runtime/voicecheck.py "$P" --final) || { echo "$VC" | grep BAD; echo "GATE FAIL: voicecheck --final (unclear lines)"; exit 1; }
  echo "$VC" | tail -1
  PEN=$("$TTS_PY" runtime/prosody.py "$P/vo/voice.wav" | sed -n 's/.*penalty \([0-9.]*\).*/\1/p')
  python -c "import sys;sys.exit(0 if float('${PEN:-99}')<=float('$PROSODY_MAX') else 1)" || { echo "GATE FAIL: prosody penalty ${PEN:-?} > $PROSODY_MAX"; exit 1; }
  echo "voice gates ok (prosody $PEN)"
fi
for f in "$P"/ch*/index.html; do grep -q "__sfx" "$f" || sed -i 's#</body>#<script>window.__sfx=(window.V\&\&V.sfx)||[];</script></body>#' "$f"; done
(cd "$P" && python "$R/runtime/lf/sfxmerge.py")
python runtime/mix.py "$P" --music auto --sfx-rate 0.8 --sfx-db -9 --music-db -21 --bpm 80-115 --energy 2-4 --mood "documentary curious" | tail -2
(cd "$P" && python "$R/runtime/lf/stitch.py" && mv -f longform-rough.mp4 main.mp4)
node runtime/lf_outro.js "$THEME" "$P/outro.mp4" | tail -1
cd "$P"; printf "file 'main.mp4'\nfile 'outro.mp4'\n" > _final.txt
ffmpeg -v error -y -f concat -safe 0 -i _final.txt -c copy final.mp4
D=$(ffprobe -v error -show_entries format=duration -of csv=p=0 final.mp4)
PAD=$(pad_to_second "$D")
if [ "$PAD" != "0" ]; then
  ffmpeg -v error -y -i final.mp4 -vf "tpad=stop_mode=clone:stop_duration=$PAD" -af "apad=pad_dur=$PAD" -c:v libx264 -crf 18 -preset medium -c:a aac -b:a 192k final-pad.mp4 && mv -f final-pad.mp4 final.mp4
fi
ffmpeg -v error -y -i final.mp4 -vf scale=1280:-2 -c:v libx264 -crf 25 -preset veryfast -c:a aac -b:a 160k final-720p.mp4
echo "ALL DONE $(ffprobe -v error -show_entries format=duration -of csv=p=0 final.mp4)s"
