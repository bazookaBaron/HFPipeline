# autocorrect end to end (from repo root): plan -> gestures -> gates (engine + static + head-clear) -> sheets -> full render
cd /c/Repos/HFPipleine
node dialogue/compiler/autoplan.mjs autocorrect --plan-md && node dialogue/episodes/autocorrect/gestures.mjs
Q="node runtime/jobq.js --kind render --"
$Q node dialogue/engine/render.mjs epeval autocorrect dialogue/episodes/autocorrect/headcheck.js > dialogue/episodes/autocorrect/out/headcheck.json
node dialogue/compiler/review.mjs autocorrect --run
$Q node dialogue/episodes/autocorrect/mgsheet.mjs
T0=$(date +%s); $Q node dialogue/engine/render.mjs epvideo autocorrect | grep -E "epvideo|FAIL"; echo "render_s $(( $(date +%s)-T0 ))"
