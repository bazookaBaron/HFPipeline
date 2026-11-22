# url_enter end to end (from repo root): plan -> gestures -> gates (engine + static + head-clear) -> sheets -> full render
cd /c/Repos/HFPipleine
node dialogue/compiler/autoplan.mjs url_enter --plan-md && node dialogue/episodes/url_enter/gestures.mjs
Q="node runtime/jobq.js --kind render --"
$Q node dialogue/engine/render.mjs epeval url_enter dialogue/episodes/url_enter/headcheck.js > dialogue/episodes/url_enter/out/headcheck.json
node dialogue/compiler/review.mjs url_enter --run
$Q node dialogue/episodes/url_enter/mgsheet.mjs
T0=$(date +%s); $Q node dialogue/engine/render.mjs epvideo url_enter | grep -E "epvideo|FAIL"; echo "render_s $(( $(date +%s)-T0 ))"
