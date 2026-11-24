#!/bin/sh
# v3 re-cut (film id trump_v3 = plan_v3.json + the same voice): gates -> render, render only if every gate passes (old + v3).
# Outputs: out/trump_v3_169.mp4 (picture), out/trump_v3_169_gates.json; the old film (out/trump_169*.mp4) is never touched.
# Mix (separate, needs the world SFX library): node runtime/jobq.js --kind ff --prio 1 -- "python samples/obj3d/audio/mix.py trump_v3 169"
cd /c/Repos/HFPipleine
export JOBQ_MAX_WAIT_MIN=10 QS="ar=16x9&film=trump_v3"; L=samples/obj3d/films/trump
node runtime/jobq.js --kind snap --prio 1 -- "node samples/obj3d/render.mjs shots film" > $L/v3_shots.log 2>&1
grep -q '"pass":false' $L/v3_shots.log && { echo "SHOTS: a gate failed"; exit 1; }
grep -q '"stillBad":0' $L/v3_shots.log || { echo "SHOTS: blocked frames"; exit 1; }
grep -q "V3 GATES PASS" $L/v3_shots.log || { echo "SHOTS: v3 gates did not pass"; exit 1; }
node runtime/jobq.js --kind snap --prio 1 -- "node samples/obj3d/render.mjs lines film trump_v3" > $L/v3_lines.log 2>&1
grep -q "LINE GATE PASS" $L/v3_lines.log || { echo "LINES: fail"; grep FAIL $L/v3_lines.log | head; exit 1; }
echo "GATES PASS $(date +%H:%M)"
VW=1920 VH=1080 node runtime/jobq.js --kind render --prio 1 -- "node samples/obj3d/render.mjs video film 30" > $L/v3_render.log 2>&1
grep "frames\|wrote\|REFUSING" $L/v3_render.log | tail -3; echo "RENDER DONE $(date +%H:%M)"
