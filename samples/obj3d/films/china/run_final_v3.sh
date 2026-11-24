#!/bin/sh
# China v3 (films/china_v3 = plan_v3 + the same voice): gates -> render -> mix, all through jobq.
# Render only if every gate passes (render.mjs also refuses a PLAN.v3 film without a fresh passing out/china_v3_169_gates.json).
cd /c/Repos/HFPipleine
export QS="ar=16x9&film=china_v3"
L=samples/obj3d/out
node runtime/jobq.js --kind snap --prio 1 -- "node samples/obj3d/render.mjs shots film" > $L/china_v3_shots.log 2>&1
grep -q "V3 GATES PASS" $L/china_v3_shots.log || { echo "SHOTS: $(grep 'V3 GATES' $L/china_v3_shots.log)"; exit 1; }
echo "SHOTS PASS $(date +%H:%M)"
node runtime/jobq.js --kind snap --prio 1 -- "node samples/obj3d/render.mjs lines film china_v3" > $L/china_v3_lines.log 2>&1
grep -q "LINE GATE PASS" $L/china_v3_lines.log || { echo "LINES: fail"; grep "^FAIL" $L/china_v3_lines.log | cut -c1-220 | head -20; exit 1; }
echo "GATES PASS $(date +%H:%M)"
[ "$1" = "gates" ] && exit 0
VW=1920 VH=1080 node runtime/jobq.js --kind render --prio 1 -- "node samples/obj3d/render.mjs video film 30" > $L/china_v3_render.log 2>&1
grep "frames\|wrote\|REFUSING" $L/china_v3_render.log | tail -2; echo "RENDER DONE $(date +%H:%M)"
grep -q "wrote" $L/china_v3_render.log || exit 1
node runtime/jobq.js --kind ff --prio 1 -- "python samples/obj3d/audio/mix.py china_v3 169" > $L/china_v3_mix.log 2>&1
tail -5 $L/china_v3_mix.log; echo "MIX DONE $(date +%H:%M)"
