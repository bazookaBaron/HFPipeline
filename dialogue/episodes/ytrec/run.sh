# ytrec end to end (from repo root): plan -> gestures -> gates (engine + static + head-clear) -> sheets -> full render
cd /c/Repos/HFPipleine
node dialogue/compiler/autoplan.mjs ytrec --plan-md && node dialogue/episodes/ytrec/gestures.mjs
Q="node runtime/jobq.js --kind render --"
$Q node dialogue/engine/render.mjs epeval ytrec dialogue/episodes/ytrec/headcheck.js > dialogue/episodes/ytrec/out/headcheck.json
node dialogue/compiler/review.mjs ytrec --run
$Q node dialogue/episodes/ytrec/mgsheet.mjs
T0=$(date +%s); $Q node dialogue/engine/render.mjs epvideo ytrec | grep -E "epvideo|FAIL"; echo "render_s $(( $(date +%s)-T0 ))"
