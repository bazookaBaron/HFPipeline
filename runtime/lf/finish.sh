#!/bin/bash
# Usage (from repo root): bash runtime/lf/finish.sh out/longform/<slug> <themeId>
# Zero-LLM finishing: inject __sfx -> sfxmerge -> mix -> stitch -> outro -> concat -> pad to >= 8:00 -> 720p copy.
set -e
P="$1"; THEME="$2"; R="$(cd "$(dirname "$0")/../.." && pwd)"; cd "$R"
for f in "$P"/ch*/index.html; do grep -q "__sfx" "$f" || sed -i 's#</body>#<script>window.__sfx=(window.V\&\&V.sfx)||[];</script></body>#' "$f"; done
(cd "$P" && python "$R/runtime/lf/sfxmerge.py")
python runtime/mix.py "$P" --music auto --sfx-rate 0.8 --sfx-db -9 --music-db -21 --bpm 80-115 --energy 2-4 --mood "documentary curious" | tail -2
(cd "$P" && python "$R/runtime/lf/stitch.py" && mv -f longform-rough.mp4 main.mp4)
node runtime/lf_outro.js "$THEME" "$P/outro.mp4" | tail -1
cd "$P"; printf "file 'main.mp4'\nfile 'outro.mp4'\n" > _final.txt
ffmpeg -v error -y -f concat -safe 0 -i _final.txt -c copy final.mp4
D=$(ffprobe -v error -show_entries format=duration -of csv=p=0 final.mp4)
PAD=$(python -c "print(max(0,round(482-float('$D'),2)))")
if python -c "import sys;sys.exit(0 if float('$PAD')>0 else 1)"; then
  ffmpeg -v error -y -i final.mp4 -vf "tpad=stop_mode=clone:stop_duration=$PAD" -af "apad=pad_dur=$PAD" -c:v libx264 -crf 18 -preset medium -c:a aac -b:a 192k final-8m.mp4 && mv -f final-8m.mp4 final.mp4
fi
ffmpeg -v error -y -i final.mp4 -vf scale=1280:-2 -c:v libx264 -crf 25 -preset veryfast -c:a aac -b:a 160k final-720p.mp4
echo "ALL DONE $(ffprobe -v error -show_entries format=duration -of csv=p=0 final.mp4)s"
