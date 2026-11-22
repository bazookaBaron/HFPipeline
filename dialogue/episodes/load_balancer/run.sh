# load_balancer end to end (from repo root): plan -> gestures -> gates (engine + static + head-clear) -> sheets -> full render
cd /c/Repos/HFPipleine
node dialogue/compiler/autoplan.mjs load_balancer --plan-md && node dialogue/episodes/load_balancer/gestures.mjs
Q="node runtime/jobq.js --kind render --"
$Q node dialogue/engine/render.mjs epeval load_balancer dialogue/episodes/load_balancer/headcheck.js > dialogue/episodes/load_balancer/out/headcheck.json
node dialogue/compiler/review.mjs load_balancer --run
$Q node dialogue/episodes/load_balancer/mgsheet.mjs
T0=$(date +%s); $Q node dialogue/engine/render.mjs epvideo load_balancer | grep -E "epvideo|FAIL"; echo "render_s $(( $(date +%s)-T0 ))"
