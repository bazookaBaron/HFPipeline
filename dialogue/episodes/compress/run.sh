# compress end to end (from repo root): plan -> gestures -> gates (engine + static + head-clear) -> sheets -> full render
cd /c/Repos/HFPipleine
node dialogue/compiler/autoplan.mjs compress --plan-md && node dialogue/episodes/compress/gestures.mjs
Q="node runtime/jobq.js --kind render --"
$Q node dialogue/engine/render.mjs epeval compress dialogue/episodes/compress/headcheck.js > dialogue/episodes/compress/out/headcheck.json
node dialogue/compiler/review.mjs compress --run
$Q node dialogue/episodes/compress/mgsheet.mjs
T0=$(date +%s); $Q node dialogue/engine/render.mjs epvideo compress | grep -E "epvideo|FAIL"; echo "render_s $(( $(date +%s)-T0 ))"
