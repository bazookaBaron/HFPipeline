# qr end to end (from repo root): plan -> gestures -> gates (engine + static + head-clear) -> sheets -> full render
cd /c/Repos/HFPipleine
node dialogue/compiler/autoplan.mjs qr --plan-md && node dialogue/episodes/qr/gestures.mjs
Q="node runtime/jobq.js --kind render --"
$Q node dialogue/engine/render.mjs epeval qr dialogue/episodes/qr/headcheck.js > dialogue/episodes/qr/out/headcheck.json
node dialogue/compiler/review.mjs qr --run
$Q node dialogue/episodes/qr/mgsheet.mjs
T0=$(date +%s); $Q node dialogue/engine/render.mjs epvideo qr | grep -E "epvideo|FAIL"; echo "render_s $(( $(date +%s)-T0 ))"
