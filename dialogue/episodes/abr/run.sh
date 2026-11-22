# abr end to end (from repo root): plan -> gestures -> gates (engine + static + head-clear) -> sheets -> full render
cd /c/Repos/HFPipleine
node dialogue/compiler/autoplan.mjs abr --plan-md && node dialogue/episodes/abr/gestures.mjs
Q="node runtime/jobq.js --kind render --"
$Q node dialogue/engine/render.mjs epeval abr dialogue/episodes/abr/headcheck.js > dialogue/episodes/abr/out/headcheck.json
node dialogue/compiler/review.mjs abr --run
$Q node dialogue/episodes/abr/mgsheet.mjs
T0=$(date +%s); $Q node dialogue/engine/render.mjs epvideo abr | grep -E "epvideo|FAIL"; echo "render_s $(( $(date +%s)-T0 ))"
