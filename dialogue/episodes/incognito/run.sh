# incognito end to end (from repo root): plan -> gestures -> gates (engine + static + head-clear) -> sheets -> full render
cd /c/Repos/HFPipleine
node dialogue/compiler/autoplan.mjs incognito --plan-md && node dialogue/episodes/incognito/gestures.mjs
Q="node runtime/jobq.js --kind render --"
$Q node dialogue/engine/render.mjs epeval incognito dialogue/episodes/incognito/headcheck.js > dialogue/episodes/incognito/out/headcheck.json
node dialogue/compiler/review.mjs incognito --run
$Q node dialogue/episodes/incognito/mgsheet.mjs
T0=$(date +%s); $Q node dialogue/engine/render.mjs epvideo incognito | grep -E "epvideo|FAIL"; echo "render_s $(( $(date +%s)-T0 ))"
