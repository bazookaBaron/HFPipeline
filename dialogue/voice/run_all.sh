#!/bin/bash
# full casting sequence; GPU steps via jobq
set -e
cd /c/Repos/HFPipleine
V=C:/Repos/HFPipleine/dialogue/voice
JQ="node runtime/jobq.js --kind voice --prio 1 --"
P=C:/Repos/HFPipleine/.venvs/parler/Scripts/python.exe
W=C:/Repos/HFPipleine/.venvs/whisper/Scripts/python.exe
C=C:/Repos/HFPipleine/.vendor/engines/CosyVoice/.venv/Scripts/python.exe
echo "== parler_design (skip: done)"
echo "== pick_refs (skip: done)"
echo "== audition_manifest (skip: done)"
echo "== audition synth"; $JQ $C $V/dlg_voice.py batch $V/casting/audition_manifest.json
echo "== audition_pick"; $W $V/audition_pick.py
echo "== guard render"
$JQ $C $V/dlg_voice.py render C:/Repos/HFPipleine/dialogue/samples/campfire_guard.md $V/casting/_guard "dadu=$V/refs/dadu_A.wav,rohan=$V/refs/rohan_A.wav" --seeds 2
echo "== mix"; $W $V/dialogue_mix.py $V/casting/_guard $V/casting/guard_preview_AA.wav
echo ALL_DONE
