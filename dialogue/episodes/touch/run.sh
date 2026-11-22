# touch end to end (from repo root): plan -> gestures -> gates (engine + static + head-clear) -> sheets -> full render
cd /c/Repos/HFPipleine
node dialogue/compiler/autoplan.mjs touch --plan-md && node dialogue/episodes/touch/gestures.mjs
Q="node runtime/jobq.js --kind render --"
$Q node dialogue/engine/render.mjs epeval touch dialogue/episodes/touch/headcheck.js > dialogue/episodes/touch/out/headcheck.json
node dialogue/compiler/review.mjs touch --run
$Q node dialogue/episodes/touch/mgsheet.mjs
T0=$(date +%s); $Q node dialogue/engine/render.mjs epvideo touch | grep -E "epvideo|FAIL"; echo "render_s $(( $(date +%s)-T0 ))"
