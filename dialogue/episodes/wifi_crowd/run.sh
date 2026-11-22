# wifi_crowd end to end (from repo root): plan -> gestures -> gates (engine + static + head-clear) -> sheets -> full render
cd /c/Repos/HFPipleine
node dialogue/compiler/autoplan.mjs wifi_crowd --plan-md && node dialogue/episodes/wifi_crowd/gestures.mjs
Q="node runtime/jobq.js --kind render --"
$Q node dialogue/engine/render.mjs epeval wifi_crowd dialogue/episodes/wifi_crowd/headcheck.js > dialogue/episodes/wifi_crowd/out/headcheck.json
node dialogue/compiler/review.mjs wifi_crowd --run
$Q node dialogue/episodes/wifi_crowd/mgsheet.mjs
T0=$(date +%s); $Q node dialogue/engine/render.mjs epvideo wifi_crowd | grep -E "epvideo|FAIL"; echo "render_s $(( $(date +%s)-T0 ))"
