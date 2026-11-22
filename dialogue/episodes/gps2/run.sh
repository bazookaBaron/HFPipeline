# gps2 end to end (from repo root): plan -> gestures -> gates (engine + static + head-clear) -> sheets -> full render
cd /c/Repos/HFPipleine
node dialogue/compiler/autoplan.mjs gps2 --plan-md && node dialogue/episodes/gps2/gestures.mjs
Q="node runtime/jobq.js --kind render --"
$Q node dialogue/engine/render.mjs epeval gps2 dialogue/episodes/gps2/headcheck.js > dialogue/episodes/gps2/out/headcheck.json
node dialogue/compiler/review.mjs gps2 --run
$Q node dialogue/episodes/gps2/mgsheet.mjs
T0=$(date +%s); $Q node dialogue/engine/render.mjs epvideo gps2 | grep -E "epvideo|FAIL"; echo "render_s $(( $(date +%s)-T0 ))"
