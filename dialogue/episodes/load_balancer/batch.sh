# one queued job: engine gates + head check + contact sheet + MG sheet + full render (single RAM wait)
cd /c/Repos/HFPipleine; O=dialogue/episodes/load_balancer/out; R="node dialogue/engine/render.mjs"
$R epgate load_balancer > $O/epgate.log 2>&1
$R epeval load_balancer dialogue/episodes/load_balancer/headcheck.js > $O/headcheck.log 2>&1
$R sheet load_balancer > $O/sheet.log 2>&1
node dialogue/episodes/load_balancer/mgsheet.mjs > $O/mgsheet.log 2>&1
T0=$(date +%s); $R epvideo load_balancer > $O/epvideo.log 2>&1; echo "render_s $(( $(date +%s)-T0 ))" >> $O/epvideo.log
