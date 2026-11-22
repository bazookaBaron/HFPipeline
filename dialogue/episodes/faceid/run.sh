# faceid end to end (from repo root): plan -> gestures -> gates (engine + static + head-clear) -> sheets -> full render
cd /c/Repos/HFPipleine
node dialogue/compiler/autoplan.mjs faceid --plan-md && node dialogue/episodes/faceid/gestures.mjs
Q="node runtime/jobq.js --kind render --"
$Q node dialogue/engine/render.mjs epeval faceid dialogue/episodes/faceid/headcheck.js > dialogue/episodes/faceid/out/headcheck.json
node dialogue/compiler/review.mjs faceid --run
$Q node dialogue/episodes/faceid/mgsheet.mjs
T0=$(date +%s); $Q node dialogue/engine/render.mjs epvideo faceid | grep -E "epvideo|FAIL"; echo "render_s $(( $(date +%s)-T0 ))"
