# cold_battery end to end (from repo root): plan -> gestures -> gates (engine + static + head-clear) -> sheets -> full render
cd /c/Repos/HFPipleine
node dialogue/compiler/autoplan.mjs cold_battery --plan-md && node dialogue/episodes/cold_battery/gestures.mjs
Q="node runtime/jobq.js --kind render --"
$Q node dialogue/engine/render.mjs epeval cold_battery dialogue/episodes/cold_battery/headcheck.js > dialogue/episodes/cold_battery/out/headcheck.json
node dialogue/compiler/review.mjs cold_battery --run
$Q node dialogue/episodes/cold_battery/mgsheet.mjs
T0=$(date +%s); $Q node dialogue/engine/render.mjs epvideo cold_battery | grep -E "epvideo|FAIL"; echo "render_s $(( $(date +%s)-T0 ))"
